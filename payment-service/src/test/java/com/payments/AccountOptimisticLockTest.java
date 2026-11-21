package com.payments;

import com.payments.dto.CreateAccountRequest;
import com.payments.entity.Account;
import com.payments.repository.AccountRepository;
import com.payments.repository.LedgerEntryRepository;
import com.payments.service.AccountService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.util.UUID;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
public class AccountOptimisticLockTest {

    @Autowired
    private AccountService accountService;

    @Autowired
    private AccountRepository accountRepository;

    @Autowired
    private LedgerEntryRepository ledgerEntryRepository;

    @BeforeEach
    void setUp() {
        ledgerEntryRepository.deleteAll();
        accountRepository.deleteAll();
    }

    @Test
    @DisplayName("Optimistic Locking (@Version) detects concurrent modifications on the same account")
    void testOptimisticLockingDetection() {
        accountService.createAccount(new CreateAccountRequest("opt-user", new BigDecimal("500.0000"), "USD"));

        Account session1Account = accountService.getAccount("opt-user");
        Account session2Account = accountService.getAccount("opt-user");

        assertEquals(0L, session1Account.getVersion());
        assertEquals(0L, session2Account.getVersion());

        // Session 1 mutates balance and updates account
        session1Account.setBalance(new BigDecimal("450.0000"));
        Account updated1 = accountRepository.saveAndFlush(session1Account);
        assertEquals(1L, updated1.getVersion(), "Account version increments after update");

        // Session 2 still holds version 0 and attempts to update
        session2Account.setBalance(new BigDecimal("400.0000"));
        assertThrows(OptimisticLockingFailureException.class, () -> {
            accountRepository.saveAndFlush(session2Account);
        }, "Updating with stale version 0 must throw OptimisticLockingFailureException");
    }
}
