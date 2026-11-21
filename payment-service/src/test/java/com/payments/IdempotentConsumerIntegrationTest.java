package com.payments;

import com.payments.repository.ProcessedEventRepository;
import com.payments.service.IdempotentConsumerService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
public class IdempotentConsumerIntegrationTest {

    @Autowired
    private IdempotentConsumerService idempotentConsumerService;

    @Autowired
    private ProcessedEventRepository processedEventRepository;

    @BeforeEach
    void setUp() {
        processedEventRepository.deleteAll();
    }

    @Test
    @DisplayName("Idempotent Consumer: First event is registered; duplicate event is rejected as duplicate")
    void testIdempotentConsumerDeduplication() {
        String compositeEventId = "payment.created:0:evt-test-12345";
        String consumerGroup = "payment-consumer-group";
        String topic = "payment.created";

        // First attempt: Must succeed
        boolean firstAttempt = idempotentConsumerService.registerEventOrCheckDuplicate(compositeEventId, consumerGroup, topic);
        assertTrue(firstAttempt, "First arrival of event must be registered successfully");

        // Second attempt with exact same composite PK: Must be detected as duplicate
        boolean secondAttempt = idempotentConsumerService.registerEventOrCheckDuplicate(compositeEventId, consumerGroup, topic);
        assertFalse(secondAttempt, "Duplicate composite PK must be detected and return false");

        // Third attempt: Still duplicate
        boolean thirdAttempt = idempotentConsumerService.registerEventOrCheckDuplicate(compositeEventId, consumerGroup, topic);
        assertFalse(thirdAttempt, "Subsequent attempt must also return false");

        // Verify database contains the record and exists
        assertTrue(processedEventRepository.existsByEventId(compositeEventId), "processed_events table must contain the registered entry");
        assertTrue(processedEventRepository.findById(compositeEventId).isPresent());
    }
}
