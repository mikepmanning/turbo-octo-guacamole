package com.recipehome.api.repository;

import com.recipehome.api.entity.Family;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface FamilyRepository extends JpaRepository<Family, Long> {

    /** The active family with this invite code (already normalized: upper case, no dash). */
    Optional<Family> findByInviteCodeAndIsActiveTrue(String inviteCode);

    /** Any family, active or not, with this code: codes are never reused. */
    boolean existsByInviteCode(String inviteCode);
}
