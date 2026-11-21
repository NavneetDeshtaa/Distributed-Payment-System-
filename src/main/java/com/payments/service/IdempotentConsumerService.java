package com.payments.service;

import com.payments.entity.ProcessedEvent;
import com.payments.repository.ProcessedEventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class IdempotentConsumerService {

    private static final Logger log = LoggerFactory.getLogger(IdempotentConsumerService.class);

    private final ProcessedEventRepository processedEventRepository;

    private final AtomicLong duplicateCount = new AtomicLong(0);
    private final AtomicLong processedCount = new AtomicLong(0);

    public IdempotentConsumerService(ProcessedEventRepository processedEventRepository) {
        this.processedEventRepository = processedEventRepository;
    }

    /**
     * Checks if the event has already been processed or attempts to register it.
     * Before processing, attempts: INSERT INTO processed_events (event_id, consumer_group, topic) VALUES (...).
     * Composite PK = "<topic>:<partition>:<eventId>"
     *
     * If DataIntegrityViolationException (duplicate PK) is thrown, log a warning,
     * discard the payload, and acknowledge Kafka immediately.
     *
     * @return true if this is the first time seeing the event (should proceed with settlement);
     *         false if duplicate detected (should skip processing and ACK Kafka).
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean registerEventOrCheckDuplicate(String compositeEventId, String consumerGroup, String topic) {
        // Fast-path idempotency check
        if (processedEventRepository.existsByEventId(compositeEventId)) {
            duplicateCount.incrementAndGet();
            log.warn("Duplicate event detected — skipping. Event ID: {}", compositeEventId);
            return false;
        }

        try {
            ProcessedEvent event = new ProcessedEvent(compositeEventId, consumerGroup, topic, Instant.now());
            processedEventRepository.saveAndFlush(event);
            processedCount.incrementAndGet();
            log.info("Registered new event for processing. Event ID: {}", compositeEventId);
            return true;
        } catch (DataIntegrityViolationException ex) {
            duplicateCount.incrementAndGet();
            log.warn("Duplicate event detected — skipping. Event ID: {}", compositeEventId);
            return false;
        } catch (Exception ex) {
            log.error("Unexpected error saving processed event {}: {}", compositeEventId, ex.getMessage());
            throw ex;
        }
    }

    public long getDuplicateCount() {
        return duplicateCount.get();
    }

    public long getProcessedCount() {
        return processedCount.get();
    }

    public List<ProcessedEvent> getRecentProcessedEvents() {
        return processedEventRepository.findTop50ByOrderByProcessedAtDesc();
    }
}
