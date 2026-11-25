package com.recipehome.api.dto;

import com.recipehome.api.enums.FamilyRole;

import java.time.LocalDateTime;
import java.util.List;

/**
 * The logged-in user's family. {@code inviteCode} and {@code inviteCodeCreatedAt} are only sent to the owner
 * (null for members, and when the owner has revoked the code). Members are listed owner first, then by when
 * they joined.
 */
public record FamilyDTO(
        Long id,
        String name,
        FamilyRole myRole,
        String inviteCode,
        LocalDateTime inviteCodeCreatedAt,
        LocalDateTime createdAt,
        List<FamilyMemberDTO> members) {

    public record FamilyMemberDTO(
            Long userId,
            String firstName,
            String lastName,
            String email,
            FamilyRole role,
            LocalDateTime joinedAt) {
    }
}
