package com.recipehome.api.service;

import com.recipehome.api.dto.FamilyDTO;

import java.util.Optional;

/**
 * The logged-in user's family. Every method takes the user's id (from their token). Failures are
 * {@code FamilyException}s: not in a family (404), already in one (409), owner only (403), invalid code (404),
 * not a member (404), or a rule about the action (422).
 */
public interface FamilyService {

    /** The user's family, or empty if they aren't in one. */
    Optional<FamilyDTO> getMyFamily(Long userId);

    /** Creates a family with the user as owner, and an invite code. */
    FamilyDTO createFamily(Long userId, String name);

    /** Owner only. */
    FamilyDTO renameFamily(Long userId, String name);

    /** Owner only: a new invite code, replacing (and so revoking) the current one. */
    FamilyDTO newInviteCode(Long userId);

    /** Owner only: no code works until the owner makes a new one. */
    FamilyDTO revokeInviteCode(Long userId);

    /** Joins the family with this code (ignoring case, spaces and dashes) as a member. */
    FamilyDTO joinFamily(Long userId, String code);

    /**
     * Leaves the family. The owner can only leave as its last member, which deletes the family; otherwise they
     * must make someone else the owner first.
     */
    void leaveFamily(Long userId);

    /** Owner only: removes another member. */
    FamilyDTO removeMember(Long userId, Long memberUserId);

    /** Owner only: makes another member the owner; the current owner becomes a member. */
    FamilyDTO makeOwner(Long userId, Long memberUserId);

    /** Owner only: deletes the family (soft delete) and removes everyone from it. */
    void deleteFamily(Long userId);
}
