package com.payments;

import com.payments.service.RateLimiterService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
public class RateLimiterServiceTest {

    @Autowired
    private RateLimiterService rateLimiterService;

    @Test
    @DisplayName("Rate Limiter allows normal requests and tracks stats")
    void testRateLimiterNormalRequests() {
        String testUser = "user-rl-" + UUID.randomUUID();

        // First 5 requests should easily pass under limit (100)
        for (int i = 0; i < 5; i++) {
            boolean allowed = rateLimiterService.allowRequest(testUser);
            assertTrue(allowed, "Request " + i + " should be allowed");
        }

        assertNotNull(rateLimiterService.getStats());
        assertTrue((Long) rateLimiterService.getStats().get("totalAllowed") >= 5);
    }
}
