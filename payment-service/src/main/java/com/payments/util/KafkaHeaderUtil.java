package com.payments.util;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.header.Header;
import org.slf4j.MDC;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

/**
 * Distributed Tracing Contract:
 * Injects and extracts x-trace-id, x-correlation-id, and x-event-id into Kafka headers.
 * Configures SLF4J MDC so all Java logs output matching trace_id and correlation_id.
 */
public class KafkaHeaderUtil {

    public static final String HEADER_TRACE_ID = "x-trace-id";
    public static final String HEADER_CORRELATION_ID = "x-correlation-id";
    public static final String HEADER_EVENT_ID = "x-event-id";

    public static final String MDC_TRACE_ID = "trace_id";
    public static final String MDC_CORRELATION_ID = "correlation_id";

    public static void injectHeaders(ProducerRecord<String, String> record, String traceId, String correlationId, String eventId) {
        if (traceId != null) {
            record.headers().add(HEADER_TRACE_ID, traceId.getBytes(StandardCharsets.UTF_8));
        }
        if (correlationId != null) {
            record.headers().add(HEADER_CORRELATION_ID, correlationId.getBytes(StandardCharsets.UTF_8));
        }
        if (eventId != null) {
            record.headers().add(HEADER_EVENT_ID, eventId.getBytes(StandardCharsets.UTF_8));
        }
    }

    public static String extractHeader(ConsumerRecord<?, ?> record, String headerName) {
        Header header = record.headers().lastHeader(headerName);
        if (header != null && header.value() != null) {
            return new String(header.value(), StandardCharsets.UTF_8);
        }
        return null;
    }

    public static String setupMdc(ConsumerRecord<?, ?> record) {
        String traceId = extractHeader(record, HEADER_TRACE_ID);
        if (traceId == null || traceId.trim().isEmpty()) {
            traceId = "tr-" + UUID.randomUUID().toString().substring(0, 8);
        }
        String correlationId = extractHeader(record, HEADER_CORRELATION_ID);
        if (correlationId == null || correlationId.trim().isEmpty()) {
            correlationId = "corr-" + UUID.randomUUID().toString().substring(0, 8);
        }

        MDC.put(MDC_TRACE_ID, traceId);
        MDC.put(MDC_CORRELATION_ID, correlationId);
        return traceId;
    }

    public static void clearMdc() {
        MDC.remove(MDC_TRACE_ID);
        MDC.remove(MDC_CORRELATION_ID);
    }
}
