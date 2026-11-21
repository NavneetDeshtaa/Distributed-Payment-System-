package com.payments.entity;

import jakarta.persistence.*;
import org.springframework.data.domain.Persistable;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "merchant_webhooks")
public class MerchantWebhook implements Persistable<UUID> {

    @Id
    private UUID id;

    @Column(name = "merchant_id", nullable = false, unique = true)
    private String merchantId;

    @Column(nullable = false, length = 512)
    private String url;

    @Column(nullable = false)
    private String secret;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Transient
    private boolean isNewRecord = true;

    public MerchantWebhook() {
    }

    public MerchantWebhook(UUID id, String merchantId, String url, String secret) {
        this.id = id != null ? id : UUID.randomUUID();
        this.merchantId = merchantId;
        this.url = url;
        this.secret = secret;
        this.active = true;
        this.createdAt = Instant.now();
        this.isNewRecord = true;
    }

    @Override
    public UUID getId() {
        return id;
    }

    @Override
    public boolean isNew() {
        return isNewRecord;
    }

    @PostPersist
    @PostLoad
    void markNotNew() {
        this.isNewRecord = false;
    }

    public String getMerchantId() {
        return merchantId;
    }

    public void setMerchantId(String merchantId) {
        this.merchantId = merchantId;
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }

    public String getSecret() {
        return secret;
    }

    public void setSecret(String secret) {
        this.secret = secret;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
