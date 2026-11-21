package com.payments.config;

import com.payments.dto.CreateAccountRequest;
import com.payments.repository.AccountRepository;
import com.payments.service.AccountService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

@Component
@Profile("!test")
public class DatabaseSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DatabaseSeeder.class);

    private final AccountRepository accountRepository;
    private final AccountService accountService;

    public DatabaseSeeder(AccountRepository accountRepository, AccountService accountService) {
        this.accountRepository = accountRepository;
        this.accountService = accountService;
    }

    @Override
    public void run(String... args) {
        seedAccountIfNotExists("u1", new BigDecimal("1000.0000"), "USD");
        seedAccountIfNotExists("m1", new BigDecimal("0.0000"), "USD");
        seedAccountIfNotExists("u2", new BigDecimal("50.0000"), "USD");
        seedAccountIfNotExists("m2", new BigDecimal("0.0000"), "USD");
    }

    private void seedAccountIfNotExists(String ownerId, BigDecimal initialBalance, String currency) {
        if (!accountRepository.existsByOwnerId(ownerId)) {
            accountService.createAccount(new CreateAccountRequest(ownerId, initialBalance, currency));
            log.info("Seeded initial account: ownerId={}, balance={}, currency={}", ownerId, initialBalance, currency);
        } else {
            log.info("Account already exists for ownerId={}, skipping seed.", ownerId);
        }
    }
}
