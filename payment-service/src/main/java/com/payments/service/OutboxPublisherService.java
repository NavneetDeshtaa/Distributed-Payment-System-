package com.payments.service;

import com.payments.entity.OutboxEvent;
import com.payments.entity.OutboxEventStatus;
import com.payments.repository.OutboxEventRepository;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

@Service
public class OutboxPublisherService {

    private static final Logger log = LoggerFactory.getLogger(OutboxPublisherService.class);

    private final OutboxEventRepository outboxEventRepository;
    private final KafkaTemplate<String, String> kafkaTemplate;

    @Value("${payment.kafka.topic:payment.created}")
    private String paymentTopic;

    public OutboxPublisherService(OutboxEventRepository outboxEventRepository,
                                  KafkaTemplate<String, String> kafkaTemplate) {
        this.outboxEventRepository = outboxEventRepository;
        this.kafkaTemplate = kafkaTemplate;
    }

    /**
     * Polling Publisher: Runs every 1 second.
     * 1. SELECT * FROM outbox_events WHERE status = 'NEW' ORDER BY created_at LIMIT 50.
     * 2. Pushes records to Kafka topic payment.created with userId as message key (partition key affinity).
     * 3. Sets x-event-id header for Idempotent Consumer Deduplication (Phase 3).
     * 4. On Kafka broker ACK, marks outbox record as PUBLISHED.
     */
    @Scheduled(fixedDelayString = "${payment.outbox.polling-rate-ms:1000}")
    @Transactional
    public void publishPendingEvents() {
        List<OutboxEvent> pendingEvents = outboxEventRepository.findTop50ByStatusOrderByCreatedAtAsc(OutboxEventStatus.NEW);
        if (pendingEvents.isEmpty()) {
            return;
        }

        log.info("Outbox Poller: Found {} NEW events to publish to Kafka topic '{}'", pendingEvents.size(), paymentTopic);

        for (OutboxEvent event : pendingEvents) {
            try {
                // Build ProducerRecord with key and x-event-id header for idempotent deduplication
                ProducerRecord<String, String> record = new ProducerRecord<>(
                        paymentTopic,
                        event.getPartitionKey(),
                        event.getPayload()
                );
                record.headers().add("x-event-id", event.getId().toString().getBytes(StandardCharsets.UTF_8));
                if (event.getTraceId() != null) {
                    record.headers().add("x-trace-id", event.getTraceId().getBytes(StandardCharsets.UTF_8));
                }

                CompletableFuture<SendResult<String, String>> future = kafkaTemplate.send(record);

                // Wait synchronously for broker ACK to ensure at-least-once delivery to broker
                SendResult<String, String> result = future.get(5, TimeUnit.SECONDS);

                // On broker ACK, mark as PUBLISHED
                event.setStatus(OutboxEventStatus.PUBLISHED);
                event.setUpdatedAt(Instant.now());
                outboxEventRepository.save(event);

                log.info("Published outbox event id={}, aggregateId={}, partition={}, offset={}",
                        event.getId(), event.getAggregateId(),
                        result.getRecordMetadata().partition(),
                        result.getRecordMetadata().offset());

            } catch (Exception e) {
                event.setRetryCount(event.getRetryCount() + 1);
                event.setUpdatedAt(Instant.now());
                outboxEventRepository.save(event);

                log.warn("Failed to publish outbox event id={} to Kafka (retry {}): {}",
                        event.getId(), event.getRetryCount(), e.getMessage());
                // Break out of batch if broker is unreachable (e.g. Kafka Down Survival Test)
                break;
            }
        }
    }
}
