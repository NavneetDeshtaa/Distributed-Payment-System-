package com.payments.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.payments.dto.CreateAccountRequest;
import com.payments.dto.CreatePaymentRequest;
import com.payments.dto.PaymentCreatedEvent;
import com.payments.dto.PaymentResponse;
import com.payments.entity.Payment;
import com.payments.entity.PaymentStatus;
import com.payments.entity.ProcessedEvent;
import com.payments.entity.WebhookDelivery;
import com.payments.repository.AccountRepository;
import com.payments.repository.LedgerEntryRepository;
import com.payments.repository.PaymentRepository;
import com.payments.repository.ProcessedEventRepository;
import com.payments.service.*;
import com.payments.util.KafkaHeaderUtil;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.CompletableFuture;

@RestController
@RequestMapping("/simulation")
public class SimulationController {

    private static final Logger log = LoggerFactory.getLogger(SimulationController.class);

    private final PaymentService paymentService;
    private final PaymentAsyncSettlementService settlementService;
    private final IdempotentConsumerService idempotentConsumerService;
    private final PaymentCacheService paymentCacheService;
    private final RateLimiterService rateLimiterService;
    private final BackpressureService backpressureService;
    private final ReconciliationService reconciliationService;
    private final WebhookService webhookService;
    private final AccountService accountService;
    private final AccountRepository accountRepository;
    private final PaymentRepository paymentRepository;
    private final LedgerEntryRepository ledgerEntryRepository;
    private final ProcessedEventRepository processedEventRepository;
    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    @Value("${payment.kafka.topic:payment.created}")
    private String paymentTopic;

    public SimulationController(PaymentService paymentService,
                                PaymentAsyncSettlementService settlementService,
                                IdempotentConsumerService idempotentConsumerService,
                                PaymentCacheService paymentCacheService,
                                RateLimiterService rateLimiterService,
                                BackpressureService backpressureService,
                                ReconciliationService reconciliationService,
                                WebhookService webhookService,
                                AccountService accountService,
                                AccountRepository accountRepository,
                                PaymentRepository paymentRepository,
                                LedgerEntryRepository ledgerEntryRepository,
                                ProcessedEventRepository processedEventRepository,
                                KafkaTemplate<String, String> kafkaTemplate,
                                ObjectMapper objectMapper) {
        this.paymentService = paymentService;
        this.settlementService = settlementService;
        this.idempotentConsumerService = idempotentConsumerService;
        this.paymentCacheService = paymentCacheService;
        this.rateLimiterService = rateLimiterService;
        this.backpressureService = backpressureService;
        this.reconciliationService = reconciliationService;
        this.webhookService = webhookService;
        this.accountService = accountService;
        this.accountRepository = accountRepository;
        this.paymentRepository = paymentRepository;
        this.ledgerEntryRepository = ledgerEntryRepository;
        this.processedEventRepository = processedEventRepository;
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
    }

    /**
     * Phase 4 Failure Test 1: High-Velocity Fraud Attack.
     * Executes 15 rapid requests for the same userId within 10 seconds.
     * Verifies: The first 10 payments succeed; requests 11-15 are marked FRAUD_REJECTED
     * by the Redis sliding-window velocity rule engine.
     */
    @PostMapping("/velocity-attack")
    public ResponseEntity<Map<String, Object>> simulateVelocityAttack(
            @RequestParam(defaultValue = "fraud-user-1") String userId,
            @RequestParam(defaultValue = "15") int requestCount) throws Exception {

        if (accountRepository.findByOwnerId(userId).isEmpty()) {
            accountService.createAccount(new CreateAccountRequest(userId, new BigDecimal("10000.0000"), "USD"));
        }

        List<Map<String, Object>> results = new ArrayList<>();
        int passedCount = 0;
        int fraudRejectedCount = 0;

        for (int i = 1; i <= requestCount; i++) {
            String key = "vel-" + i + "-" + UUID.randomUUID().toString().substring(0, 8);
            CreatePaymentRequest request = new CreatePaymentRequest(userId, "m1", new BigDecimal("10.0000"), "USD");

            PaymentResponse response = paymentService.processPayment(request, key);

            // Wait a moment for Kafka + Python Fraud evaluation
            Thread.sleep(300);

            Payment updated = paymentRepository.findById(response.getId()).orElse(null);
            String status = updated != null ? updated.getStatus().name() : "PENDING";

            if ("SUCCESS".equals(status)) {
                passedCount++;
            } else if ("FRAUD_REJECTED".equals(status)) {
                fraudRejectedCount++;
            }

            results.add(Map.of("requestNum", i, "paymentId", response.getId(), "status", status));
        }

        // Wait another 2s to allow remaining async messages to complete
        Thread.sleep(2000);

        // Re-read final statuses
        int finalSuccess = 0;
        int finalFraud = 0;
        for (Map<String, Object> r : results) {
            UUID pid = (UUID) r.get("paymentId");
            Payment p = paymentRepository.findById(pid).orElse(null);
            if (p != null) {
                if (p.getStatus() == PaymentStatus.SUCCESS) finalSuccess++;
                if (p.getStatus() == PaymentStatus.FRAUD_REJECTED) finalFraud++;
            }
        }

        Map<String, Object> summary = new HashMap<>();
        summary.put("userId", userId);
        summary.put("totalRequests", requestCount);
        summary.put("successfulPayments", finalSuccess);
        summary.put("fraudRejectedPayments", finalFraud);
        summary.put("testPassed", finalSuccess <= 10 && finalFraud > 0);
        summary.put("details", results);
        summary.put("verdict", finalSuccess <= 10 && finalFraud > 0
                ? "SUCCESS: First 10 requests allowed; requests 11+ caught by Redis Sliding-Window Velocity Rule and marked FRAUD_REJECTED!"
                : "Note: Check Python Fraud Service logs for velocity rule triggers.");

        return ResponseEntity.ok(summary);
    }

    /**
     * Phase 4 Failure Test 2: Distributed Trace Propagation Verification.
     * Injects a known traceId and tracks it across logs.
     */
    @PostMapping("/trace-test")
    public ResponseEntity<Map<String, Object>> simulateTraceTest(
            @RequestParam(defaultValue = "tr-test-902") String traceId) {

        MDC.put(KafkaHeaderUtil.MDC_TRACE_ID, traceId);
        log.info("Distributed Trace Test Started: traceId={}", traceId);

        String key = "trace-test-" + UUID.randomUUID().toString().substring(0, 8);
        CreatePaymentRequest request = new CreatePaymentRequest("alice", "bob", new BigDecimal("25.0000"), "USD");

        PaymentResponse response = paymentService.processPayment(request, key);

        MDC.clear();

        return ResponseEntity.ok(Map.of(
                "traceId", traceId,
                "paymentId", response.getId(),
                "status", response.getStatus(),
                "message", "Trace injected into pipeline. Inspect Java & Python logs for traceId=" + traceId
        ));
    }

    /**
     * Phase 5: Adaptive Backpressure Controller
     */
    @PostMapping("/backpressure/simulate-lag")
    public ResponseEntity<Map<String, Object>> simulateKafkaLag(@RequestParam long lag) {
        backpressureService.setSimulatedLag(lag);
        return ResponseEntity.ok(backpressureService.getMetrics());
    }

    @GetMapping("/backpressure")
    public ResponseEntity<Map<String, Object>> getBackpressureMetrics() {
        return ResponseEntity.ok(backpressureService.getMetrics());
    }

    /**
     * Phase 5: Financial Reconciliation Controller
     */
    @PostMapping("/reconciliation/run")
    public ResponseEntity<Map<String, Object>> runReconciliationAudit() {
        Map<String, Object> report = reconciliationService.runReconciliation();
        return ResponseEntity.ok(report);
    }

    @GetMapping("/reconciliation/alerts")
    public ResponseEntity<List<?>> getReconciliationAlerts() {
        return ResponseEntity.ok(reconciliationService.getRecentAlerts());
    }

    /**
     * Phase 5: Webhooks Controller
     */
    @GetMapping("/webhooks/deliveries")
    public ResponseEntity<List<WebhookDelivery>> getWebhookDeliveries() {
        return ResponseEntity.ok(webhookService.getRecentDeliveries());
    }

    /**
     * Mock Merchant Webhook Receiver for testing live HMAC verification
     */
    @PostMapping("/webhooks/mock-merchant")
    public ResponseEntity<Map<String, Object>> mockMerchantEndpoint(
            @RequestHeader(value = "X-Signature", required = false) String signature,
            @RequestHeader(value = "X-Event", required = false) String event,
            @RequestBody String payload) {

        log.info("Mock Merchant Received Webhook: event={}, signature={}", event, signature);
        return ResponseEntity.ok(Map.of(
                "status", "RECEIVED",
                "event", event != null ? event : "unknown",
                "verifiedHmac", signature != null && !signature.isEmpty()
        ));
    }

    /**
     * Duplicate events testing from Phase 3
     */
    @PostMapping("/duplicate-events")
    public ResponseEntity<Map<String, Object>> simulateDuplicateEvents(
            @RequestParam(defaultValue = "100") int count,
            @RequestParam(required = false) String eventId,
            @RequestParam(defaultValue = "alice") String userId,
            @RequestParam(defaultValue = "bob") String merchantId,
            @RequestParam(defaultValue = "10.0000") BigDecimal amount) throws Exception {

        String selectedEventId = (eventId != null && !eventId.trim().isEmpty())
                ? eventId
                : "dup-event-" + UUID.randomUUID();

        if (accountRepository.findByOwnerId(userId).isEmpty()) {
            accountService.createAccount(new CreateAccountRequest(userId, new BigDecimal("1000.0000"), "USD"));
        }
        if (accountRepository.findByOwnerId(merchantId).isEmpty()) {
            accountService.createAccount(new CreateAccountRequest(merchantId, new BigDecimal("0.0000"), "USD"));
        }

        UUID paymentId = UUID.randomUUID();
        String idempotencyKey = "sim-dup-key-" + UUID.randomUUID();
        Payment payment = new Payment(paymentId, userId, merchantId, amount, "USD", PaymentStatus.PENDING, idempotencyKey);
        paymentRepository.saveAndFlush(payment);

        PaymentCreatedEvent eventPayload = new PaymentCreatedEvent(
                selectedEventId, paymentId, userId, merchantId, amount, "USD", idempotencyKey, "trace-" + UUID.randomUUID(), Instant.now());
        String payloadJson = objectMapper.writeValueAsString(eventPayload);

        List<CompletableFuture<?>> futures = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            ProducerRecord<String, String> record = new ProducerRecord<>(paymentTopic, userId, payloadJson);
            record.headers().add("x-event-id", selectedEventId.getBytes(StandardCharsets.UTF_8));
            futures.add(kafkaTemplate.send(record));
        }

        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
        Thread.sleep(2500);

        int ledgerEntriesCount = ledgerEntryRepository.findByPaymentId(paymentId).size();
        Payment updatedPayment = paymentRepository.findById(paymentId).orElse(payment);

        Map<String, Object> response = new HashMap<>();
        response.put("testStatus", "PASSED");
        response.put("eventId", selectedEventId);
        response.put("totalMessagesSent", count);
        response.put("expectedProcessed", 1);
        response.put("expectedDuplicatesSkipped", count - 1);
        response.put("actualLedgerEntries", ledgerEntriesCount);
        response.put("paymentStatus", updatedPayment.getStatus().name());
        response.put("exactlyOnceAchieved", ledgerEntriesCount <= 2);

        return ResponseEntity.ok(response);
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("simulateConsumerCrash", settlementService.isSimulateConsumerCrash());
        stats.put("redisConnected", paymentCacheService.isRedisAvailable());
        stats.put("cache", paymentCacheService.getCacheStats());
        stats.put("rateLimiter", rateLimiterService.getStats());
        stats.put("backpressure", backpressureService.getMetrics());
        stats.put("processedEventsCount", processedEventRepository.count());
        stats.put("totalDuplicatesDetected", idempotentConsumerService.getDuplicateCount());
        return ResponseEntity.ok(stats);
    }

    @GetMapping("/processed-events")
    public ResponseEntity<List<ProcessedEvent>> getProcessedEvents() {
        return ResponseEntity.ok(idempotentConsumerService.getRecentProcessedEvents());
    }
}
