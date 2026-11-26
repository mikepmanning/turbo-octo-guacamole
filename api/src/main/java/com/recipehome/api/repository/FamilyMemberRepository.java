package com.recipehome.api.repository;

import com.recipehome.api.entity.FamilyMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FamilyMemberRepository extends JpaRepository<FamilyMember, Long> {

    /** The user's membership, with its family, if they are in an active family. */
    @Query("SELECT m FROM FamilyMember m JOIN FETCH m.family f WHERE m.user.id = :userId AND f.isActive = true")
    Optional<FamilyMember> findByUserId(@Param("userId") Long userId);

    boolean existsByUserId(Long userId);

    /** Everyone in the family, by user id. */
    @Query("SELECT m.user.id FROM FamilyMember m WHERE m.family.id = :familyId")
    List<Long> findUserIdsByFamilyId(@Param("familyId") Long familyId);
}
