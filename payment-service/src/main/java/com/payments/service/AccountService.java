package com.payments.service;

import com.payments.dto.AccountResponse;
import com.payments.dto.CreateAccountRequest;
import com.payments.entity.Account;
import com.payments.exception.AccountNotFoundException;
import com.payments.exception.InsufficientBalanceException;
import com.payments.repository.AccountRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class AccountService {

    private static final Logger log = LoggerFactory.getLogger(AccountService.class);

    private final AccountRepository accountRepository;

    public AccountService(AccountRepository accountRepository) {
        this.accountRepository = accountRepository;
    }

    public Account getAccount(String ownerId) {
        return accountRepository.findByOwnerId(ownerId)
                .orElseThrow(() -> new AccountNotFoundException("Account not found for owner: " + ownerId));
    }

    public AccountResponse getAccountResponse(String ownerId) {
        Account account = getAccount(ownerId);
        return toResponse(account);
    }

    public List<AccountResponse> getAllAccounts() {
        return accountRepository.findAll().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public AccountResponse createAccount(CreateAccountRequest request) {
        if (accountRepository.existsByOwnerId(request.getOwnerId())) {
            throw new IllegalArgumentException("Account already exists for owner: " + request.getOwnerId());
        }
        Account account = new Account(
                UUID.randomUUID(),
                request.getOwnerId(),
                request.getInitialBalance().setScale(4, RoundingMode.HALF_UP),
                request.getCurrency().toUpperCase()
        );
        Account saved = accountRepository.save(account);
        log.info("Created account for owner={} with initial balance={} {}", saved.getOwnerId(), saved.getBalance(), saved.getCurrency());
        return toResponse(saved);
    }

    /**
     * Debits the payer account.
     * Uses JPA @Version optimistic locking to detect concurrent modifications.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public Account debit(Account account, BigDecimal amount) {
        BigDecimal normalizedAmount = amount.setScale(4, RoundingMode.HALF_UP);
        if (account.getBalance().compareTo(normalizedAmount) < 0) {
            throw new InsufficientBalanceException(account.getOwnerId(), account.getBalance(), normalizedAmount);
        }
        BigDecimal newBalance = account.getBalance().subtract(normalizedAmount);
        account.setBalance(newBalance);
        Account updated = accountRepository.save(account);
        log.info("Debited account owner={}, amount={}, newBalance={}, version={}",
                account.getOwnerId(), normalizedAmount, updated.getBalance(), updated.getVersion());
        return updated;
    }

    /**
     * Credits the merchant account.
     * Uses JPA @Version optimistic locking to detect concurrent modifications.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public Account credit(Account account, BigDecimal amount) {
        BigDecimal normalizedAmount = amount.setScale(4, RoundingMode.HALF_UP);
        BigDecimal newBalance = account.getBalance().add(normalizedAmount);
        account.setBalance(newBalance);
        Account updated = accountRepository.save(account);
        log.info("Credited account owner={}, amount={}, newBalance={}, version={}",
                account.getOwnerId(), normalizedAmount, updated.getBalance(), updated.getVersion());
        return updated;
    }

    public AccountResponse toResponse(Account account) {
        return new AccountResponse(
                account.getId(),
                account.getOwnerId(),
                account.getBalance(),
                account.getCurrency(),
                account.getVersion(),
                account.getCreatedAt(),
                account.getUpdatedAt()
        );
    }
}
