package com.payments.entity;

import jakarta.persistence.*;
import org.springframework.data.domain.Persistable;

import java.time.Instant;

@Entity
@Table(name = "processed_events")
public class ProcessedEvent implements Persistable<String> {

    @Id
    @Column(name = "event_id", length = 512, nullable = false)
    private String eventId;

    @Column(name = "consumer_group", length = 100, nullable = false)
    private String consumerGroup;

    @Column(name = "topic", length = 100, nullable = false)
    private String topic;

    @Column(name = "processed_at", nullable = false)
    private Instant processedAt;

    @Transient
    private boolean isNewRecord = true;

    public ProcessedEvent() {
    }

    public ProcessedEvent(String eventId, String consumerGroup, String topic, Instant processedAt) {
        this.eventId = eventId;
        this.consumerGroup = consumerGroup;
        this.topic = topic;
        this.processedAt = processedAt != null ? processedAt : Instant.now();
        this.isNewRecord = true;
    }

    @Override
    public String getId() {
        return eventId;
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

    public String getEventId() {
        return eventId;
    }

    public void setEventId(String eventId) {
        this.eventId = eventId;
    }

    public String getConsumerGroup() {
        return consumerGroup;
    }

    public void setConsumerGroup(String consumerGroup) {
        this.consumerGroup = consumerGroup;
    }

    public String getTopic() {
        return topic;
    }

    public void setTopic(String topic) {
        this.topic = topic;
    }

    public Instant getProcessedAt() {
        return processedAt;
    }

    public void setProcessedAt(Instant processedAt) {
        this.processedAt = processedAt;
    }
}
