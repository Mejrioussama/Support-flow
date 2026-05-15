package com.supportflow.repository;

import com.supportflow.entity.SupportCategory;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SupportCategoryRepository extends JpaRepository<SupportCategory, Long> {
    Optional<SupportCategory> findByCode(String code);
    boolean existsByCode(String code);
    List<SupportCategory> findAllByOrderBySortOrderAscLabelAsc();
    List<SupportCategory> findByIsActiveTrueOrderBySortOrderAscLabelAsc();
}
