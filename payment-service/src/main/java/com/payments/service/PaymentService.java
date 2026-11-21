package com.payments.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.payments.dto.CreatePaymentRequest;
import com.payments.dto.PaymentCreatedEvent;
import com.payments.dto.PaymentResponse;
import com.payments.entity.OutboxEvent;
import com.payments.entity.OutboxEventStatus;
import com.payments.entity.Payment;
import com.payments.entity.PaymentStatus;
import com.payments.exception.DuplicateIdempotencyKeyException;
import com.payments.exception.RateLimitExceededException;
import com.payments.repository.OutboxEventRepository;
import com.payments.repository.PaymentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class PaymentService {

    private static final Logger log = LoggerFactory.getLogger(PaymentService.class);

    private final PaymentRepository paymentRepository;
    private final OutboxEventRepository outboxEventRepository;
    private final PaymentCacheService paymentCacheService;
    private final RateLimiterService rateLimiterService;
    private final ObjectMapper objectMapper;

    public PaymentService(PaymentRepository paymentRepository,
                          OutboxEventRepository outboxEventRepository,
                          PaymentCacheService paymentCacheService,
                          RateLimiterService rateLimiterService,
                          ObjectMapper objectMapper) {
        this.paymentRepository = paymentRepository;
        this.outboxEventRepository = outboxEventRepository;
        this.paymentCacheService = paymentCacheService;
        this.rateLimiterService = rateLimiterService;
        this.objectMapper = objectMapper;
    }

    /**
     * Phase 3: High Ingestion Scale Payment Flow
     * 1. Rate Limiting: Token-bucket check via Redis Lua script (with in-memory Caffeine fallback).
     * 2. Layer 1 Cache: Redis GET idem:<key>. On hit, returns cached PaymentResponse (sub-ms, 0 DB load).
     * 3. Database ACID Transaction:
     *    - Insert Payment (status = PENDING)
     *    - Insert OutboxEvent (status = NEW)
     * 4. Cache payment in Redis (24-hour TTL) and return 201 Created immediately.
     */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public PaymentResponse processPayment(CreatePaymentRequest request, String idempotencyKey) {
        if (idempotencyKey == null || idempotencyKey.trim().isEmpty()) {
            throw new IllegalArgumentException("Idempotency-Key header is mandatory");
        }

        // Step 1: Rate Limiter Protection
        if (!rateLimiterService.allowRequest(request.getUserId())) {
            throw new RateLimitExceededException("Rate limit exceeded for user: " + request.getUserId() + ". Please retry later.");
        }

        // Step 2: Layer 1 Redis Cache Check (GET idem:<key>)
        Optional<PaymentResponse> cachedOpt = paymentCacheService.getCachedPayment(idempotencyKey);
        if (cachedOpt.isPresent()) {
            log.info("Layer 1 Cache HIT: idempotencyKey={}. Returning cached payment directly from Redis (0 DB load).", idempotencyKey);
            return cachedOpt.get();
        }

        // Step 3: Layer 2 Database Processing with ACID Transaction
        return executePaymentTransaction(request, idempotencyKey);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    protected PaymentResponse executePaymentTransaction(CreatePaymentRequest request, String idempotencyKey) {
        BigDecimal amount = request.getAmount().setScale(4, RoundingMode.HALF_UP);

        // Step 3a: PostgreSQL Advisory Lock / Row Lock
        try {
            paymentRepository.acquireAdvisoryLock(idempotencyKey);
        } catch (Exception e) {
            log.debug("Advisory lock skipped: {}", e.getMessage());
        }

        Optional<Payment> existingPaymentOpt = paymentRepository.findByIdempotencyKeyForUpdate(idempotencyKey);
        if (existingPaymentOpt.isPresent()) {
            Payment existing = existingPaymentOpt.get();
            log.info("Database replay detected for idempotencyKey={}. Returning existing payment id={}",
                    idempotencyKey, existing.getId());
            PaymentResponse response = toResponse(existing, true);
            paymentCacheService.cachePayment(idempotencyKey, response);
            return response;
        }

        // Step 3b: INSERT Payment (status = PENDING)
        UUID paymentId = UUID.randomUUID();
        String traceId = "trace-" + UUID.randomUUID();
        Payment payment = new Payment(
                paymentId,
                request.getUserId(),
                request.getMerchantId(),
                amount,
                request.getCurrency().toUpperCase(),
                PaymentStatus.PENDING,
                idempotencyKey
        );

        Payment savedPayment;
        try {
            savedPayment = paymentRepository.saveAndFlush(payment);
        } catch (DataIntegrityViolationException ex) {
            log.warn("Concurrent insert caught by UNIQUE constraint on idempotency_key={}", idempotencyKey);
            Payment existing = paymentRepository.findByIdempotencyKey(idempotencyKey)
                    .orElseThrow(() -> new DuplicateIdempotencyKeyException("Payment already processed with key: " + idempotencyKey));
            PaymentResponse response = toResponse(existing, true);
            paymentCacheService.cachePayment(idempotencyKey, response);
            return response;
        }

        // Step 3c: INSERT OutboxEvent (status = NEW, partition_key = userId)
        UUID outboxEventId = UUID.randomUUID();
        PaymentCreatedEvent eventPayload = new PaymentCreatedEvent(
                outboxEventId.toString(),
                savedPayment.getId(),
                savedPayment.getUserId(),
                savedPayment.getMerchantId(),
                savedPayment.getAmount(),
                savedPayment.getCurrency(),
                savedPayment.getIdempotencyKey(),
                traceId,
                Instant.now()
        );

        String jsonPayload;
        try {
            jsonPayload = objectMapper.writeValueAsString(eventPayload);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize payment event payload", e);
        }

        OutboxEvent outboxEvent = new OutboxEvent(
                outboxEventId,
                "PAYMENT_CREATED",
                savedPayment.getId().toString(),
                savedPayment.getUserId(), // Partition key for Kafka partition affinity
                jsonPayload,
                OutboxEventStatus.NEW,
                traceId
        );
        outboxEventRepository.save(outboxEvent);

        log.info("Phase 3 Ingestion SUCCESS: paymentId={}, status=PENDING, outboxEventId={}, traceId={}",
                savedPayment.getId(), outboxEvent.getId(), traceId);

        // Step 4: Cache in Redis and return 201 Created immediately
        PaymentResponse response = toResponse(savedPayment, false);
        paymentCacheService.cachePayment(idempotencyKey, response);
        return response;
    }

    @Transactional(readOnly = true)
    public PaymentResponse getPaymentById(UUID id) {
        return paymentRepository.findById(id)
                .map(p -> toResponse(p, false))
                .orElseThrow(() -> new IllegalArgumentException("Payment not found for id: " + id));
    }

    @Transactional(readOnly = true)
    public List<PaymentResponse> getAllPayments() {
        return paymentRepository.findAll().stream()
                .map(p -> toResponse(p, false))
                .collect(Collectors.toList());
    }

    private PaymentResponse toResponse(Payment payment, boolean isReplay) {
        return new PaymentResponse(
                payment.getId(),
                payment.getUserId(),
                payment.getMerchantId(),
                payment.getAmount(),
                payment.getCurrency(),
                payment.getStatus(),
                payment.getIdempotencyKey(),
                payment.getCreatedAt(),
                isReplay
        );
    }
}
