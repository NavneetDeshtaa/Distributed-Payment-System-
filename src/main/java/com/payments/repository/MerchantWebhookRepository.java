package com.payments.repository;

import com.payments.entity.MerchantWebhook;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface MerchantWebhookRepository extends JpaRepository<MerchantWebhook, UUID> {
    Optional<MerchantWebhook> findByMerchantId(String merchantId);
}
