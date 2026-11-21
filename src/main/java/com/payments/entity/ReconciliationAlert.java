package com.payments.entity;

import jakarta.persistence.*;
import org.springframework.data.domain.Persistable;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "reconciliation_alerts")
public class ReconciliationAlert implements Persistable<UUID> {

    @Id
    private UUID id;

    @Column(name = "alert_type", nullable = false, length = 100)
    private String alertType; // 'STALE_PAYMENT', 'GHOST_PAYMENT', 'DUPLICATE_LEDGER', 'LEDGER_IMBALANCE', 'ORPHAN_LEDGER'

    @Column(name = "entity_id")
    private String entityId;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String details;

    @Column(nullable = false, length = 20)
    private String severity; // 'WARN', 'CRITICAL'

    @Column(nullable = false)
    private boolean resolved = false;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Transient
    private boolean isNewRecord = true;

    public ReconciliationAlert() {
    }

    public ReconciliationAlert(UUID id, String alertType, String entityId, String details, String severity) {
        this.id = id != null ? id : UUID.randomUUID();
        this.alertType = alertType;
        this.entityId = entityId;
        this.details = details;
        this.severity = severity;
        this.resolved = false;
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

    public String getAlertType() {
        return alertType;
    }

    public void setAlertType(String alertType) {
        this.alertType = alertType;
    }

    public String getEntityId() {
        return entityId;
    }

    public void setEntityId(String entityId) {
        this.entityId = entityId;
    }

    public String getDetails() {
        return details;
    }

    public void setDetails(String details) {
        this.details = details;
    }

    public String getSeverity() {
        return severity;
    }

    public void setSeverity(String severity) {
        this.severity = severity;
    }

    public boolean isResolved() {
        return resolved;
    }

    public void setResolved(boolean resolved) {
        this.resolved = resolved;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
