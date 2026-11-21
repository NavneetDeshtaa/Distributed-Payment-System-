package com.payments;

import com.payments.dto.CreateAccountRequest;
import com.payments.dto.CreatePaymentRequest;
import com.payments.dto.PaymentResponse;
import com.payments.entity.Account;
import com.payments.entity.OutboxEvent;
import com.payments.entity.Payment;
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
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
public class PaymentConcurrencyIntegrationTest {

    @Autowired
    private PaymentService paymentService;

    @Autowired
    private AccountService accountService;

    @Autowired
    private AccountRepository accountRepository;

    @Autowired
    private PaymentRepository paymentRepository;

    @Autowired
    private LedgerEntryRepository ledgerEntryRepository;

    @Autowired
    private OutboxEventRepository outboxEventRepository;

    @BeforeEach
    void setUp() {
        ledgerEntryRepository.deleteAll();
        outboxEventRepository.deleteAll();
        paymentRepository.deleteAll();
        accountRepository.deleteAll();

        accountService.createAccount(new CreateAccountRequest("race-user", new BigDecimal("1000.0000"), "USD"));
        accountService.createAccount(new CreateAccountRequest("race-merchant", new BigDecimal("0.0000"), "USD"));
    }

    @Test
    @DisplayName("Phase 2 Concurrency: Exactly 1 Payment & 1 Outbox Event created across concurrent identical Idempotency-Keys")
    void testConcurrentIdenticalIdempotencyKey() throws InterruptedException {
        int threadCount = 10;
        String sharedIdempotencyKey = "race-key-" + UUID.randomUUID();
        BigDecimal paymentAmount = new BigDecimal("50.0000");

        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch readyLatch = new CountDownLatch(threadCount);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(threadCount);

        List<PaymentResponse> successfulResponses = Collections.synchronizedList(new ArrayList<>());
        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger replayCount = new AtomicInteger(0);

        for (int i = 0; i < threadCount; i++) {
            executor.submit(() -> {
                readyLatch.countDown();
                try {
                    startLatch.await();
                    CreatePaymentRequest request = new CreatePaymentRequest("race-user", "race-merchant", paymentAmount, "USD");
                    PaymentResponse response = paymentService.processPayment(request, sharedIdempotencyKey);
                    successfulResponses.add(response);
                    successCount.incrementAndGet();
                    if (response.isIdempotentReplay()) {
                        replayCount.incrementAndGet();
                    }
                } catch (Exception e) {
                    System.err.println("Thread exception: " + e.getMessage());
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        readyLatch.await(5, TimeUnit.SECONDS);
        startLatch.countDown();
        doneLatch.await(10, TimeUnit.SECONDS);
        executor.shutdown();

        // 1. All concurrent threads succeeded
        assertEquals(threadCount, successCount.get());

        // 2. Exactly 1 creation, 9 replays
        assertEquals(1, threadCount - replayCount.get());
        assertEquals(threadCount - 1, replayCount.get());

        // 3. Exactly 1 payment in DB
        List<Payment> payments = paymentRepository.findAll();
        assertEquals(1, payments.size());

        // 4. Exactly 1 outbox event in DB
        List<OutboxEvent> outboxEvents = outboxEventRepository.findAll();
        assertEquals(1, outboxEvents.size());
        assertEquals("PAYMENT_CREATED", outboxEvents.get(0).getEventType());
        assertEquals("race-user", outboxEvents.get(0).getPartitionKey());
    }
}
