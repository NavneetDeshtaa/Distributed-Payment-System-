package com.payments.service;

import com.payments.dto.PaymentCreatedEvent;
import com.payments.dto.PaymentResponse;
import com.payments.entity.Account;
import com.payments.entity.Payment;
import com.payments.entity.PaymentStatus;
import com.payments.exception.AccountNotFoundException;
import com.payments.exception.CurrencyMismatchException;
import com.payments.repository.AccountRepository;
import com.payments.repository.PaymentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.UUID;

@Service
public class PaymentAsyncSettlementService {

    private static final Logger log = LoggerFactory.getLogger(PaymentAsyncSettlementService.class);

    private final PaymentRepository paymentRepository;
    private final AccountRepository accountRepository;
    private final AccountService accountService;
    private final LedgerService ledgerService;
    private final PaymentCacheService paymentCacheService;

    @Value("${payment.simulation.simulate-consumer-crash:false}")
    private boolean simulateConsumerCrash;

    public PaymentAsyncSettlementService(PaymentRepository paymentRepository,
                                         AccountRepository accountRepository,
                                         AccountService accountService,
                                         LedgerService ledgerService,
                                         PaymentCacheService paymentCacheService) {
        this.paymentRepository = paymentRepository;
        this.accountRepository = accountRepository;
        this.accountService = accountService;
        this.ledgerService = ledgerService;
        this.paymentCacheService = paymentCacheService;
    }

    /**
     * Executes async settlement in a single ACID transaction:
     * 1. Validate balances
     * 2. DEBIT Payer Account (@Version)
     * 3. CREDIT Merchant Account (@Version)
     * 4. INSERT Ledger Entries (1 DEBIT + 1 CREDIT)
     * 5. Assert Invariant: SUM(DEBIT) == SUM(CREDIT) == amount
     * 6. UPDATE Payment (status = SUCCESS)
     * 7. Update Redis Layer 1 Cache with SUCCESS response
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void settlePaymentTransaction(PaymentCreatedEvent event) {
        UUID paymentId = event.getPaymentId();
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new IllegalArgumentException("Payment not found for id: " + paymentId));

        // Skip if already settled
        if (payment.getStatus() == PaymentStatus.SUCCESS) {
            log.info("Payment id={} is already settled. Skipping balance updates.", paymentId);
            return;
        }

        BigDecimal amount = event.getAmount().setScale(4, RoundingMode.HALF_UP);

        Account payerAccount = accountRepository.findByOwnerId(event.getUserId())
                .orElseGet(() -> {
                    log.info("Auto-provisioning missing payer account for userId={}", event.getUserId());
                    Account newAccount = new Account();
                    newAccount.setId(UUID.randomUUID());
                    newAccount.setOwnerId(event.getUserId());
                    newAccount.setBalance(new BigDecimal("10000.0000"));
                    newAccount.setCurrency(event.getCurrency() != null ? event.getCurrency() : "USD");
                    newAccount.setVersion(0L);
                    return accountRepository.saveAndFlush(newAccount);
                });

        Account merchantAccount = accountRepository.findByOwnerId(event.getMerchantId())
                .orElseGet(() -> {
                    log.info("Auto-provisioning missing merchant account for merchantId={}", event.getMerchantId());
                    Account newAccount = new Account();
                    newAccount.setId(UUID.randomUUID());
                    newAccount.setOwnerId(event.getMerchantId());
                    newAccount.setBalance(BigDecimal.ZERO.setScale(4));
                    newAccount.setCurrency(event.getCurrency() != null ? event.getCurrency() : "USD");
                    newAccount.setVersion(0L);
                    return accountRepository.saveAndFlush(newAccount);
                });

        if (!payerAccount.getCurrency().equalsIgnoreCase(event.getCurrency())) {
            throw new CurrencyMismatchException("Payer currency mismatch");
        }
        if (!merchantAccount.getCurrency().equalsIgnoreCase(event.getCurrency())) {
            throw new CurrencyMismatchException("Merchant currency mismatch");
        }

        // DEBIT payer
        accountService.debit(payerAccount, amount);

        // CREDIT merchant
        accountService.credit(merchantAccount, amount);

        // INSERT Ledger Entries & assert invariant
        ledgerService.recordEntries(payment, payerAccount, merchantAccount);

        // UPDATE Payment status = SUCCESS
        payment.setStatus(PaymentStatus.SUCCESS);
        paymentRepository.saveAndFlush(payment);

        // Update Redis Layer 1 Cache (24-hour TTL)
        PaymentResponse response = new PaymentResponse(
                payment.getId(),
                payment.getUserId(),
                payment.getMerchantId(),
                payment.getAmount(),
                payment.getCurrency(),
                payment.getStatus(),
                payment.getIdempotencyKey(),
                payment.getCreatedAt(),
                false
        );
        paymentCacheService.cachePayment(payment.getIdempotencyKey(), response);

        log.info("Async Settlement SUCCESS: paymentId={}, amount={} {}, payer={}, merchant={}",
                payment.getId(), amount, event.getCurrency(), payerAccount.getOwnerId(), merchantAccount.getOwnerId());
    }

    public boolean isSimulateConsumerCrash() {
        return simulateConsumerCrash;
    }

    public void setSimulateConsumerCrash(boolean simulateConsumerCrash) {
        this.simulateConsumerCrash = simulateConsumerCrash;
    }
}
