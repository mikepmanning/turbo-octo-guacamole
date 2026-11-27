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

    /** Everyone in the user's active family (the user included), with the family id; empty without a family. */
    @Query("SELECT new com.recipehome.api.repository.FamilyMemberRepository$GroupMember(f.id, other.user.id) "
            + "FROM FamilyMember me JOIN me.family f, FamilyMember other "
            + "WHERE me.user.id = :userId AND f.isActive = true AND other.family = f")
    List<GroupMember> findGroupOf(@Param("userId") Long userId);

    record GroupMember(Long familyId, Long userId) {
    }
}
