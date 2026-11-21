package com.payments;

import com.payments.dto.PaymentResponse;
import com.payments.entity.PaymentStatus;
import com.payments.service.PaymentCacheService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
public class PaymentCacheServiceTest {

    @Autowired
    private PaymentCacheService paymentCacheService;

    @Test
    @DisplayName("Layer 1 Cache: Cache Miss, Cache Write, and Cache Hit (0 DB Load)")
    void testLayer1CacheOperations() {
        String testKey = "test-key-" + UUID.randomUUID();

        // 1. Cache Miss initially
        Optional<PaymentResponse> miss = paymentCacheService.getCachedPayment(testKey);
        assertTrue(miss.isEmpty(), "Initial lookup must be a cache miss");

        // 2. Write to cache
        UUID paymentId = UUID.randomUUID();
        PaymentResponse response = new PaymentResponse(
                paymentId,
                "alice",
                "bob",
                new BigDecimal("75.0000"),
                "USD",
                PaymentStatus.SUCCESS,
                testKey,
                Instant.now(),
                false
        );
        paymentCacheService.cachePayment(testKey, response, Duration.ofMinutes(5));

        // 3. Cache Hit on subsequent lookup
        Optional<PaymentResponse> hit = paymentCacheService.getCachedPayment(testKey);
        assertTrue(hit.isPresent(), "Subsequent lookup must be a cache hit from Redis");
        assertEquals(paymentId, hit.get().getId());
        assertEquals("alice", hit.get().getUserId());
        assertEquals(PaymentStatus.SUCCESS, hit.get().getStatus());
        assertTrue(hit.get().isIdempotentReplay(), "Cached responses should have idempotentReplay = true");
    }
}
