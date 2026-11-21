package com.payments.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.payments.dto.PaymentCreatedEvent;
import com.payments.util.KafkaHeaderUtil;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.header.Header;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

@Service
public class PaymentEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(PaymentEventConsumer.class);
    private static final String FRAUD_REQUEST_TOPIC = "fraud.request";

    private final ObjectMapper objectMapper;
    private final IdempotentConsumerService idempotentConsumerService;
    private final KafkaTemplate<String, String> kafkaTemplate;

    @Value("${spring.kafka.consumer.group-id:payment-consumer-group}")
    private String consumerGroupId;

    public PaymentEventConsumer(ObjectMapper objectMapper,
                                IdempotentConsumerService idempotentConsumerService,
                                KafkaTemplate<String, String> kafkaTemplate) {
        this.objectMapper = objectMapper;
        this.idempotentConsumerService = idempotentConsumerService;
        this.kafkaTemplate = kafkaTemplate;
    }

    /**
     * Phase 4: Decoupled ML Fraud Pipeline.
     * Consumes 'payment.created' -> Deduplicates via EOS Table -> Publishes to 'fraud.request'.
     * Injects x-trace-id, x-correlation-id, and x-event-id for Distributed Tracing.
     */
    @KafkaListener(topics = "${payment.kafka.topic:payment.created}", groupId = "${spring.kafka.consumer.group-id:payment-consumer-group}")
    public void consumePaymentCreated(ConsumerRecord<String, String> record, Acknowledgment ack) {
        String traceId = KafkaHeaderUtil.setupMdc(record);

        // Extract Event ID
        String rawEventId = null;
        Header header = record.headers().lastHeader(KafkaHeaderUtil.HEADER_EVENT_ID);
        if (header != null && header.value() != null) {
            rawEventId = new String(header.value(), StandardCharsets.UTF_8);
        }

        PaymentCreatedEvent event;
        try {
            event = objectMapper.readValue(record.value(), PaymentCreatedEvent.class);
        } catch (Exception e) {
            log.error("Failed to deserialize Kafka message: {}", e.getMessage());
            if (ack != null) ack.acknowledge();
            KafkaHeaderUtil.clearMdc();
            return;
        }

        if (rawEventId == null || rawEventId.trim().isEmpty()) {
            if (event.getEventId() != null && !event.getEventId().trim().isEmpty()) {
                rawEventId = event.getEventId();
            } else if (event.getPaymentId() != null) {
                rawEventId = event.getPaymentId().toString();
            } else {
                rawEventId = UUID.randomUUID().toString();
            }
        }

        String compositeEventId = record.topic() + ":" + record.partition() + ":" + rawEventId;

        // Idempotent Deduplication Check
        boolean isNewEvent = idempotentConsumerService.registerEventOrCheckDuplicate(
                compositeEventId, consumerGroupId, record.topic());

        if (!isNewEvent) {
            log.info("Duplicate Kafka message acknowledged without forwarding to fraud: {}", compositeEventId);
            if (ack != null) ack.acknowledge();
            KafkaHeaderUtil.clearMdc();
            return;
        }

        try {
            // Forward to Python Fraud Microservice via 'fraud.request' topic
            String correlationId = KafkaHeaderUtil.extractHeader(record, KafkaHeaderUtil.HEADER_CORRELATION_ID);
            if (correlationId == null) {
                correlationId = "corr-" + UUID.randomUUID().toString().substring(0, 8);
            }

            ProducerRecord<String, String> fraudReq = new ProducerRecord<>(
                    FRAUD_REQUEST_TOPIC,
                    event.getUserId(),
                    record.value()
            );
            KafkaHeaderUtil.injectHeaders(fraudReq, traceId, correlationId, rawEventId);

            kafkaTemplate.send(fraudReq);
            log.info("Forwarded paymentId={} to topic '{}' with traceId={}", event.getPaymentId(), FRAUD_REQUEST_TOPIC, traceId);

            if (ack != null) {
                ack.acknowledge();
            }

        } catch (Exception ex) {
            log.error("Failed to forward payment to fraud.request: {}", ex.getMessage(), ex);
            if (ack != null) ack.acknowledge();
        } finally {
            KafkaHeaderUtil.clearMdc();
        }
    }
}
