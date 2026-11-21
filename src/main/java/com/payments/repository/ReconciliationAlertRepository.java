package com.payments.repository;

import com.payments.entity.ReconciliationAlert;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ReconciliationAlertRepository extends JpaRepository<ReconciliationAlert, UUID> {
    List<ReconciliationAlert> findTop50ByOrderByCreatedAtDesc();
    List<ReconciliationAlert> findByResolvedFalse();
    long countByResolvedFalse();
}
