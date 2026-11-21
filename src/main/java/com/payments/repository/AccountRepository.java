package com.payments.repository;

import com.payments.entity.Account;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface AccountRepository extends JpaRepository<Account, UUID> {

    Optional<Account> findByOwnerId(String ownerId);

    Optional<Account> findByOwnerIdAndCurrency(String ownerId, String currency);

    boolean existsByOwnerId(String ownerId);
}
