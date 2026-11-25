package com.recipehome.api.entity;

import com.recipehome.api.enums.FamilyRole;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/**
 * A user's place in a {@link Family}. The unique user_id keeps a user in at most one family. Leaving or being
 * removed deletes the row (not a soft delete), so the user is free to join another family. When the user
 * joined is {@code getCreatedAt()}.
 */
@Entity
@Table(name = "family_members", uniqueConstraints = @UniqueConstraint(
        name = "uk_family_members_user", columnNames = "user_id"))
public class FamilyMember extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "family_id", nullable = false)
    private Family family;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private FamilyRole role;

    public FamilyMember() {
    }

    public FamilyMember(User user, FamilyRole role) {
        this.user = user;
        this.role = role;
    }

    public Family getFamily() {
        return family;
    }

    public void setFamily(Family family) {
        this.family = family;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public FamilyRole getRole() {
        return role;
    }

    public void setRole(FamilyRole role) {
        this.role = role;
    }
}
