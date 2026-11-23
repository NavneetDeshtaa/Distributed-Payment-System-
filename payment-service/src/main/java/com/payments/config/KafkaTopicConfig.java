package com.payments.config;

import org.apache.kafka.clients.admin.AdminClientConfig;
import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;
import org.springframework.kafka.core.KafkaAdmin;

import java.util.HashMap;
import java.util.Map;

/**
 * Enterprise Kafka Topic & Partition Topology Configuration.
 * 
 * Replaces implicit dynamic auto-creation with explicit, version-controlled
 * topic definitions, partitions, and replication topologies.
 */
@Configuration
public class KafkaTopicConfig {

    @Value("${spring.kafka.bootstrap-servers:localhost:9092}")
    private String bootstrapServers;

    @Value("${payment.kafka.topic:payment.created}")
    private String paymentCreatedTopic;

    @Bean
    public KafkaAdmin kafkaAdmin() {
        Map<String, Object> configs = new HashMap<>();
        configs.put(AdminClientConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        KafkaAdmin admin = new KafkaAdmin(configs);
        // Resilient startup: does not fail Spring context if Kafka broker is temporarily starting up
        admin.setFatalIfBrokerNotAvailable(false);
        admin.setAutoCreate(true);
        return admin;
    }

    /**
     * Primary transaction ingestion topic.
     * 3 Partitions: Enables up to 3 parallel consumer threads for horizontal scaling.
     * Keyed by userId: Guarantees strict sequential ordering per user account.
     */
    @Bean
    public NewTopic paymentCreatedTopic() {
        return TopicBuilder.name(paymentCreatedTopic)
                .partitions(3)
                .replicas(1)
                .build();
    }

    /**
     * Request pipe for asynchronous Python ML Fraud screening.
     * 3 Partitions: Balances evaluation load across Python worker processes.
     */
    @Bean
    public NewTopic fraudRequestTopic() {
        return TopicBuilder.name("fraud.request")
                .partitions(3)
                .replicas(1)
                .build();
    }

    /**
     * Response pipe from Python ML service back to Java settlement.
     * 3 Partitions: Parallelizes settlement consumption.
     */
    @Bean
    public NewTopic fraudResultTopic() {
        return TopicBuilder.name("fraud.result")
                .partitions(3)
                .replicas(1)
                .build();
    }

    /**
     * Broadcast stream for detected fraud anomalies and security alerts.
     */
    @Bean
    public NewTopic fraudAlertsTopic() {
        return TopicBuilder.name("fraud.alerts")
                .partitions(3)
                .replicas(1)
                .build();
    }

    /**
     * Reconciliation alerts for audit discrepancies (imbalances, stale payments).
     */
    @Bean
    public NewTopic reconciliationAlertsTopic() {
        return TopicBuilder.name("reconciliation.alerts")
                .partitions(3)
                .replicas(1)
                .build();
    }

    /**
     * Dead Letter Queue for merchant webhook deliveries that exceeded max retries.
     * 1 Partition: Preserves FIFO sequencing for failed webhook triage and replay.
     */
    @Bean
    public NewTopic webhookDlqTopic() {
        return TopicBuilder.name("webhook.DLQ")
                .partitions(1)
                .replicas(1)
                .build();
    }
}
