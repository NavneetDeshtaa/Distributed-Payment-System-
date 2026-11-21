package com.payments.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.payments.dto.PaymentResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class PaymentCacheService {

    private static final Logger log = LoggerFactory.getLogger(PaymentCacheService.class);
    private static final String IDEMPOTENCY_CACHE_PREFIX = "idem:";

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    @Value("${payment.cache.ttl-hours:24}")
    private long cacheTtlHours;

    private final AtomicLong cacheHits = new AtomicLong(0);
    private final AtomicLong cacheMisses = new AtomicLong(0);
    private final AtomicLong cacheWrites = new AtomicLong(0);

    public PaymentCacheService(StringRedisTemplate redisTemplate, ObjectMapper objectMapper) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
    }

    /**
     * Layer 1: Check Redis GET idem:<key>.
     * On hit, return cached PaymentResponse (sub-millisecond, 0 DB load).
     * Wrapped in try/catch for Graceful Degradation if Redis is unavailable.
     */
    public Optional<PaymentResponse> getCachedPayment(String idempotencyKey) {
        String cacheKey = IDEMPOTENCY_CACHE_PREFIX + idempotencyKey;
        try {
            String cachedJson = redisTemplate.opsForValue().get(cacheKey);
            if (cachedJson != null && !cachedJson.trim().isEmpty()) {
                PaymentResponse response = objectMapper.readValue(cachedJson, PaymentResponse.class);
                // Mark as replay when served from cache
                response.setIdempotentReplay(true);
                cacheHits.incrementAndGet();
                log.info("Layer 1 Cache HIT: key={} -> served sub-millisecond from Redis (0 DB load)", cacheKey);
                return Optional.of(response);
            }
            cacheMisses.incrementAndGet();
            log.debug("Layer 1 Cache MISS: key={}", cacheKey);
            return Optional.empty();
        } catch (Exception ex) {
            log.warn("Redis unreachable during cache lookup for key={}: {}. Gracefully falling back to PostgreSQL.",
                    cacheKey, ex.getMessage());
            return Optional.empty();
        }
    }

    /**
     * Cache successful payment with 24-hour TTL.
     */
    public void cachePayment(String idempotencyKey, PaymentResponse response) {
        cachePayment(idempotencyKey, response, Duration.ofHours(cacheTtlHours));
    }

    public void cachePayment(String idempotencyKey, PaymentResponse response, Duration ttl) {
        String cacheKey = IDEMPOTENCY_CACHE_PREFIX + idempotencyKey;
        try {
            String json = objectMapper.writeValueAsString(response);
            redisTemplate.opsForValue().set(cacheKey, json, ttl.getSeconds(), TimeUnit.SECONDS);
            cacheWrites.incrementAndGet();
            log.info("Cached payment in Redis: key={} with TTL={}s", cacheKey, ttl.getSeconds());
        } catch (Exception ex) {
            log.warn("Failed to cache payment in Redis for key={}: {}. Proceeding without cache.",
                    cacheKey, ex.getMessage());
        }
    }

    public boolean isRedisAvailable() {
        try {
            String pong = redisTemplate.getConnectionFactory().getConnection().ping();
            return "PONG".equalsIgnoreCase(pong);
        } catch (Exception e) {
            return false;
        }
    }

    public Map<String, Object> getCacheStats() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("hits", cacheHits.get());
        stats.put("misses", cacheMisses.get());
        stats.put("writes", cacheWrites.get());
        stats.put("redisConnected", isRedisAvailable());
        stats.put("ttlHours", cacheTtlHours);
        return stats;
    }
}
