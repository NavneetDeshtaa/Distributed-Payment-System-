package com.payments.repository;

import com.payments.entity.ProcessedEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface ProcessedEventRepository extends JpaRepository<ProcessedEvent, String> {

    boolean existsByEventId(String eventId);

    List<ProcessedEvent> findTop50ByOrderByProcessedAtDesc();

    @Modifying
    @Query(value = "INSERT INTO processed_events (event_id, consumer_group, topic, processed_at) VALUES (:eventId, :consumerGroup, :topic, :processedAt)", nativeQuery = true)
    int insertNative(@Param("eventId") String eventId,
                     @Param("consumerGroup") String consumerGroup,
                     @Param("topic") String topic,
                     @Param("processedAt") Instant processedAt);
}
