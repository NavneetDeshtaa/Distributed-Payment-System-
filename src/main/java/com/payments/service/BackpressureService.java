package com.payments.service;

import org.apache.kafka.clients.admin.AdminClient;
import org.apache.kafka.clients.admin.AdminClientConfig;
import org.apache.kafka.clients.admin.ListConsumerGroupOffsetsResult;
import org.apache.kafka.clients.consumer.OffsetAndMetadata;
import org.apache.kafka.common.TopicPartition;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class BackpressureService {

    private static final Logger log = LoggerFactory.getLogger(BackpressureService.class);

    @Value("${spring.kafka.bootstrap-servers:localhost:9092}")
    private String bootstrapServers;

    private final AtomicLong currentLag = new AtomicLong(0);
    private final AtomicLong simulatedLag = new AtomicLong(0);
    private final AtomicLong totalThrottledRequests = new AtomicLong(0);

    private AdminClient adminClient;

    @Scheduled(fixedDelay = 10000)
    public void evaluateConsumerLag() {
        if (simulatedLag.get() > 0) {
            currentLag.set(simulatedLag.get());
            return;
        }

        try {
            if (adminClient == null) {
                adminClient = AdminClient.create(Map.of(
                        AdminClientConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers,
                        AdminClientConfig.REQUEST_TIMEOUT_MS_CONFIG, "3000"
                ));
            }
            ListConsumerGroupOffsetsResult offsetsResult = adminClient.listConsumerGroupOffsets("payment-consumer-group");
            Map<TopicPartition, OffsetAndMetadata> offsets = offsetsResult.partitionsToOffsetAndMetadata().get();
            long estimatedLag = offsets.size();
            currentLag.set(estimatedLag);
        } catch (Exception e) {
            log.debug("Consumer lag query note: {}", e.getMessage());
        }
    }

    /**
     * Adaptive Throttle Multiplier:
     * - Lag < 1,000  -> Normal (1.0)
     * - Lag >= 1,000 -> Warning (1.0)
     * - Lag >= 5,000 -> 50% Throttle (0.5 multiplier)
     * - Lag >= 10,000 -> 90% Throttle (0.1 multiplier - triggers 429)
     */
    public double getThrottleFactor() {
        long lag = currentLag.get();
        if (lag >= 10000) {
            return 0.10; // 90% reduction
        } else if (lag >= 5000) {
            return 0.50; // 50% reduction
        } else {
            return 1.0;  // 100% capacity
        }
    }

    public String getBackpressureStatus() {
        long lag = currentLag.get();
        if (lag >= 10000) {
            return "CRITICAL_THROTTLE_90_PERCENT";
        } else if (lag >= 5000) {
            return "WARNING_THROTTLE_50_PERCENT";
        } else if (lag >= 1000) {
            return "ELEVATED_LAG_WARNING";
        } else {
            return "NORMAL_OPERATION";
        }
    }

    public void setSimulatedLag(long lag) {
        this.simulatedLag.set(lag);
        this.currentLag.set(lag);
        log.info("Simulated Kafka lag set to: {}", lag);
    }

    public void incrementThrottledRequests() {
        totalThrottledRequests.incrementAndGet();
    }

    public Map<String, Object> getMetrics() {
        Map<String, Object> map = new HashMap<>();
        map.put("currentLag", currentLag.get());
        map.put("throttleFactor", getThrottleFactor());
        map.put("status", getBackpressureStatus());
        map.put("simulatedLagActive", simulatedLag.get() > 0);
        map.put("totalThrottledRequests", totalThrottledRequests.get());
        return map;
    }
}
