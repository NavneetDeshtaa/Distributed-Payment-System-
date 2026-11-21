package com.payments.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.payments.entity.MerchantWebhook;
import com.payments.entity.Payment;
import com.payments.entity.WebhookDelivery;
import com.payments.repository.MerchantWebhookRepository;
import com.payments.repository.WebhookDeliveryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

@Service
public class WebhookService {

    private static final Logger log = LoggerFactory.getLogger(WebhookService.class);
    private static final String DLQ_TOPIC = "webhook.DLQ";
    private static final int MAX_RETRIES = 5;

    // Exponential backoff delays in seconds: 5s, 30s, 2m, 10m, 30m
    private static final int[] BACKOFF_SECONDS = {5, 30, 120, 600, 1800};

    private final MerchantWebhookRepository webhookConfigRepository;
    private final WebhookDeliveryRepository deliveryRepository;
    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public WebhookService(MerchantWebhookRepository webhookConfigRepository,
                          WebhookDeliveryRepository deliveryRepository,
                          KafkaTemplate<String, String> kafkaTemplate,
                          ObjectMapper objectMapper) {
        this.webhookConfigRepository = webhookConfigRepository;
        this.deliveryRepository = deliveryRepository;
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(3))
                .build();
    }

    public MerchantWebhook registerMerchantWebhook(String merchantId, String url, String secret) {
        MerchantWebhook webhook = webhookConfigRepository.findByMerchantId(merchantId)
                .orElse(new MerchantWebhook(UUID.randomUUID(), merchantId, url, secret));
        webhook.setUrl(url);
        webhook.setSecret(secret);
        webhook.setActive(true);
        return webhookConfigRepository.save(webhook);
    }

    /**
     * Creates and dispatches signed HTTPS/HTTP webhook upon payment completion.
     * Header: X-Signature: hex(hmac_sha256(secret, payload))
     */
    public void dispatchWebhook(Payment payment) {
        Optional<MerchantWebhook> configOpt = webhookConfigRepository.findByMerchantId(payment.getMerchantId());
        String merchantId = payment.getMerchantId();
        String targetUrl = configOpt.map(MerchantWebhook::getUrl).orElse("http://localhost:8080/simulation/webhooks/mock-merchant");
        String secret = configOpt.map(MerchantWebhook::getSecret).orElse("default-merchant-secret-key-32b");

        try {
            Map<String, Object> payloadMap = new HashMap<>();
            payloadMap.put("event", "payment.completed");
            payloadMap.put("paymentId", payment.getId().toString());
            payloadMap.put("userId", payment.getUserId());
            payloadMap.put("merchantId", payment.getMerchantId());
            payloadMap.put("amount", payment.getAmount());
            payloadMap.put("currency", payment.getCurrency());
            payloadMap.put("status", payment.getStatus().name());
            payloadMap.put("idempotencyKey", payment.getIdempotencyKey());
            payloadMap.put("timestamp", Instant.now().toString());

            String payloadJson = objectMapper.writeValueAsString(payloadMap);
            String signature = calculateHmacSha256(secret, payloadJson);

            WebhookDelivery delivery = new WebhookDelivery(
                    UUID.randomUUID(),
                    payment.getId(),
                    merchantId,
                    targetUrl,
                    payloadJson,
                    signature,
                    "PENDING"
            );
            deliveryRepository.save(delivery);

            sendDeliveryAttempt(delivery);

        } catch (Exception ex) {
            log.error("Failed to initiate webhook delivery for payment {}: {}", payment.getId(), ex.getMessage());
        }
    }

    private void sendDeliveryAttempt(WebhookDelivery delivery) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(delivery.getUrl()))
                    .header("Content-Type", "application/json")
                    .header("X-Signature", delivery.getSignature())
                    .header("X-Event", "payment.completed")
                    .timeout(Duration.ofSeconds(3))
                    .POST(HttpRequest.BodyPublishers.ofString(delivery.getPayload()))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            delivery.setLastResponseCode(response.statusCode());
            delivery.setUpdatedAt(Instant.now());

            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                delivery.setStatus("DELIVERED");
                delivery.setLastError(null);
                deliveryRepository.save(delivery);
                log.info("Webhook successfully delivered for paymentId={} (HTTP {})", delivery.getPaymentId(), response.statusCode());
            } else {
                handleDeliveryFailure(delivery, "HTTP " + response.statusCode() + ": " + response.body());
            }

        } catch (Exception ex) {
            handleDeliveryFailure(delivery, ex.getMessage());
        }
    }

    private void handleDeliveryFailure(WebhookDelivery delivery, String errorMsg) {
        delivery.setLastError(errorMsg);
        delivery.setUpdatedAt(Instant.now());

        if (delivery.getAttemptCount() >= MAX_RETRIES) {
            delivery.setStatus("FAILED_DLQ");
            deliveryRepository.save(delivery);

            // Route to Dead Letter Queue (webhook.DLQ)
            try {
                kafkaTemplate.send(DLQ_TOPIC, delivery.getMerchantId(), delivery.getPayload());
                log.warn("Webhook delivery reached max retries ({}). Routed to DLQ '{}' for paymentId={}",
                        MAX_RETRIES, DLQ_TOPIC, delivery.getPaymentId());
            } catch (Exception e) {
                log.error("Failed to route webhook to DLQ: {}", e.getMessage());
            }
        } else {
            delivery.setStatus("RETRYING");
            int delaySeconds = BACKOFF_SECONDS[Math.min(delivery.getAttemptCount() - 1, BACKOFF_SECONDS.length - 1)];
            delivery.setNextRetryAt(Instant.now().plusSeconds(delaySeconds));
            delivery.setAttemptCount(delivery.getAttemptCount() + 1);
            deliveryRepository.save(delivery);

            log.info("Webhook delivery failed for paymentId={} (Attempt {}/{}). Retrying in {}s: {}",
                    delivery.getPaymentId(), delivery.getAttemptCount() - 1, MAX_RETRIES, delaySeconds, errorMsg);
        }
    }

    @Scheduled(fixedDelay = 5000)
    public void retryScheduledWebhooks() {
        List<WebhookDelivery> pending = deliveryRepository.findByStatusAndNextRetryAtBefore("RETRYING", Instant.now());
        for (WebhookDelivery delivery : pending) {
            sendDeliveryAttempt(delivery);
        }
    }

    public static String calculateHmacSha256(String secret, String data) {
        try {
            Mac sha256Hmac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKey = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            sha256Hmac.init(secretKey);
            byte[] hash = sha256Hmac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception e) {
            throw new RuntimeException("HMAC-SHA256 generation failed", e);
        }
    }

    public List<WebhookDelivery> getRecentDeliveries() {
        return deliveryRepository.findTop50ByOrderByCreatedAtDesc();
    }
}
