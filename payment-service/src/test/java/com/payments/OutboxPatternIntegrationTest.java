package com.payments;

import com.payments.dto.CreateAccountRequest;
import com.payments.dto.CreatePaymentRequest;
import com.payments.dto.PaymentResponse;
import com.payments.entity.OutboxEvent;
import com.payments.entity.OutboxEventStatus;
import com.payments.entity.PaymentStatus;
import com.payments.repository.AccountRepository;
import com.payments.repository.LedgerEntryRepository;
import com.payments.repository.OutboxEventRepository;
import com.payments.repository.PaymentRepository;
import com.payments.service.AccountService;
import com.payments.service.PaymentService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
public class OutboxPatternIntegrationTest {

    @Autowired
    private PaymentService paymentService;

    @Autowired
    private AccountService accountService;

    @Autowired
    private PaymentRepository paymentRepository;

    @Autowired
    private OutboxEventRepository outboxEventRepository;

    @Autowired
    private AccountRepository accountRepository;

    @Autowired
    private LedgerEntryRepository ledgerEntryRepository;

    @BeforeEach
    void setUp() {
        ledgerEntryRepository.deleteAll();
        outboxEventRepository.deleteAll();
        paymentRepository.deleteAll();
        accountRepository.deleteAll();

        accountService.createAccount(new CreateAccountRequest("outbox-user", new BigDecimal("500.0000"), "USD"));
        accountService.createAccount(new CreateAccountRequest("outbox-merchant", new BigDecimal("0.0000"), "USD"));
    }

    @Test
    @DisplayName("Transactional Outbox: Ingestion creates Payment (PENDING) and OutboxEvent (NEW) atomically")
    void testTransactionalOutboxCreation() {
        String idempotencyKey = "outbox-test-" + UUID.randomUUID();
        CreatePaymentRequest request = new CreatePaymentRequest("outbox-user", "outbox-merchant", new BigDecimal("100.0000"), "USD");

        PaymentResponse response = paymentService.processPayment(request, idempotencyKey);

        assertNotNull(response);
        assertEquals(PaymentStatus.PENDING, response.getStatus(), "Ingestion status must be PENDING");
        assertFalse(response.isIdempotentReplay());

        // Check OutboxEvent in database
        List<OutboxEvent> outboxEvents = outboxEventRepository.findAll();
        assertEquals(1, outboxEvents.size(), "Exactly 1 outbox event must be persisted atomically");

        OutboxEvent event = outboxEvents.get(0);
        assertEquals(OutboxEventStatus.NEW, event.getStatus(), "Initial outbox status must be NEW");
        assertEquals("PAYMENT_CREATED", event.getEventType());
        assertEquals("outbox-user", event.getPartitionKey(), "Partition key must be userId for Kafka partition affinity");
        assertTrue(event.getPayload().contains(response.getId().toString()), "Payload must contain payment ID");
    }
}
