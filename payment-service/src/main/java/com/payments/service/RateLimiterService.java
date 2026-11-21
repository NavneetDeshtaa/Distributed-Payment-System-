package com.payments.service;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class RateLimiterService {

    private static final Logger log = LoggerFactory.getLogger(RateLimiterService.class);
    private static final String RATE_LIMIT_PREFIX = "rate:limit:";

    private final StringRedisTemplate redisTemplate;
    private final RedisScript<Long> rateLimiterScript;
    private final BackpressureService backpressureService;

    @Value("${payment.rate-limiter.limit-per-window:100}")
    private long limitPerWindow;

    @Value("${payment.rate-limiter.window-seconds:60}")
    private long windowSeconds;

    // Graceful degradation in-memory fallback cache (50,000 entries, 2-minute TTL)
    private final Cache<String, AtomicInteger> caffeineFallbackCache = Caffeine.newBuilder()
            .maximumSize(50_000)
            .expireAfterWrite(2, TimeUnit.MINUTES)
            .build();

    private final AtomicLong redisSuccessCount = new AtomicLong(0);
    private final AtomicLong caffeineFallbackCount = new AtomicLong(0);
    private final AtomicLong totalAllowed = new AtomicLong(0);
    private final AtomicLong totalRejected = new AtomicLong(0);

    public RateLimiterService(StringRedisTemplate redisTemplate,
                              RedisScript<Long> rateLimiterScript,
                              BackpressureService backpressureService) {
        this.redisTemplate = redisTemplate;
        this.rateLimiterScript = rateLimiterScript;
        this.backpressureService = backpressureService;
    }

    /**
     * Evaluates rate limiting with Phase 5 Adaptive Closed-Loop Backpressure:
     * - Multiplies base limit by BackpressureService.getThrottleFactor()
     * - If Kafka consumer lag > 5,000 -> 50% limit reduction
     * - If Kafka consumer lag > 10,000 -> 90% limit reduction
     */
    public boolean allowRequest(String clientIdentifier) {
        String key = RATE_LIMIT_PREFIX + clientIdentifier;
        double throttleFactor = backpressureService != null ? backpressureService.getThrottleFactor() : 1.0;
        long effectiveLimit = Math.max(1, (long) (limitPerWindow * throttleFactor));

        try {
            Long currentCount = redisTemplate.execute(
                    rateLimiterScript,
                    Collections.singletonList(key),
                    String.valueOf(windowSeconds)
            );

            redisSuccessCount.incrementAndGet();

            if (currentCount != null && currentCount > effectiveLimit) {
                totalRejected.incrementAndGet();
                if (throttleFactor < 1.0 && backpressureService != null) {
                    backpressureService.incrementThrottledRequests();
                }
                log.warn("Rate limit EXCEEDED (Redis) for key={}: count={}/{} (Backpressure factor: {})",
                        key, currentCount, effectiveLimit, throttleFactor);
                return false;
            }

            totalAllowed.incrementAndGet();
            return true;

        } catch (Exception ex) {
            caffeineFallbackCount.incrementAndGet();
            log.warn("Redis unreachable for rate limiting ({}). Gracefully falling back to in-memory Caffeine cache.",
                    ex.getMessage());
            return checkCaffeineFallback(clientIdentifier, effectiveLimit);
        }
    }

    private boolean checkCaffeineFallback(String clientIdentifier, long effectiveLimit) {
        AtomicInteger counter = caffeineFallbackCache.get(clientIdentifier, k -> new AtomicInteger(0));
        int currentCount = counter.incrementAndGet();

        if (currentCount > effectiveLimit) {
            totalRejected.incrementAndGet();
            log.warn("Rate limit EXCEEDED (Caffeine Fallback) for key={}: count={}/{}",
                    clientIdentifier, currentCount, effectiveLimit);
            return false;
        }

        totalAllowed.incrementAndGet();
        return true;
    }

    public Map<String, Object> getStats() {
        double factor = backpressureService != null ? backpressureService.getThrottleFactor() : 1.0;
        long effectiveLimit = Math.max(1, (long) (limitPerWindow * factor));

        Map<String, Object> stats = new HashMap<>();
        stats.put("limitPerWindow", limitPerWindow);
        stats.put("effectiveLimit", effectiveLimit);
        stats.put("backpressureFactor", factor);
        stats.put("windowSeconds", windowSeconds);
        stats.put("redisSuccessCount", redisSuccessCount.get());
        stats.put("caffeineFallbackCount", caffeineFallbackCount.get());
        stats.put("totalAllowed", totalAllowed.get());
        stats.put("totalRejected", totalRejected.get());
        stats.put("caffeineCachedKeys", caffeineFallbackCache.estimatedSize());
        return stats;
    }
}
