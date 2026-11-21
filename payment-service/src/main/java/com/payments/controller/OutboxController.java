package com.payments.controller;

import com.payments.entity.OutboxEvent;
import com.payments.entity.OutboxEventStatus;
import com.payments.repository.OutboxEventRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/outbox")
public class OutboxController {

    private final OutboxEventRepository outboxEventRepository;

    public OutboxController(OutboxEventRepository outboxEventRepository) {
        this.outboxEventRepository = outboxEventRepository;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getOutboxStatus() {
        long newEvents = outboxEventRepository.countByStatus(OutboxEventStatus.NEW);
        long publishedEvents = outboxEventRepository.countByStatus(OutboxEventStatus.PUBLISHED);
        long failedEvents = outboxEventRepository.countByStatus(OutboxEventStatus.FAILED);
        List<OutboxEvent> recentEvents = outboxEventRepository.findTop20ByOrderByCreatedAtDesc();

        Map<String, Object> response = new HashMap<>();
        response.put("newCount", newEvents);
        response.put("publishedCount", publishedEvents);
        response.put("failedCount", failedEvents);
        response.put("recentEvents", recentEvents);

        return ResponseEntity.ok(response);
    }
}
