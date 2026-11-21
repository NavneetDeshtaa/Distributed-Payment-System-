package com.payments.repository;

import com.payments.entity.WebhookDelivery;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface WebhookDeliveryRepository extends JpaRepository<WebhookDelivery, UUID> {
    List<WebhookDelivery> findByStatusAndNextRetryAtBefore(String status, Instant cutoff);
    List<WebhookDelivery> findTop50ByOrderByCreatedAtDesc();
    List<WebhookDelivery> findByPaymentId(UUID paymentId);
    List<WebhookDelivery> findByStatus(String status);
}
