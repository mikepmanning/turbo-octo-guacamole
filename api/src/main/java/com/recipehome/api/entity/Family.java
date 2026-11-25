package com.recipehome.api.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * A group of users. Others join with the family's invite code, which the owner can replace or revoke
 * ({@code inviteCode} is null while there is none). Deleting a family soft-deletes it and removes its members,
 * so they can create or join another.
 */
@Entity
@Table(name = "families")
public class Family extends BaseEntity {

    @Column(nullable = false, length = 100)
    private String name;

    /** 8 characters from {@code FamilyServiceImpl.CODE_ALPHABET}, stored without the dash shown to users. */
    @Column(name = "invite_code", unique = true, length = 8)
    private String inviteCode;

    @Column(name = "invite_code_created_at")
    private LocalDateTime inviteCodeCreatedAt;

    @OneToMany(mappedBy = "family", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<FamilyMember> members = new ArrayList<>();

    public void addMember(FamilyMember member) {
        members.add(member);
        member.setFamily(this);
    }

    public void removeMember(FamilyMember member) {
        members.remove(member);
        member.setFamily(null);
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getInviteCode() {
        return inviteCode;
    }

    public void setInviteCode(String inviteCode) {
        this.inviteCode = inviteCode;
    }

    public LocalDateTime getInviteCodeCreatedAt() {
        return inviteCodeCreatedAt;
    }

    public void setInviteCodeCreatedAt(LocalDateTime inviteCodeCreatedAt) {
        this.inviteCodeCreatedAt = inviteCodeCreatedAt;
    }

    public List<FamilyMember> getMembers() {
        return members;
    }
}
