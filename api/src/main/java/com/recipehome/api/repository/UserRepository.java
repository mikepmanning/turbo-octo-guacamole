package com.recipehome.api.repository;

import com.recipehome.api.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    /** An active user by (already normalized) email. */
    Optional<User> findByEmailAndIsActiveTrue(String email);

    Optional<User> findByIdAndIsActiveTrue(Long id);

    /** Any user with this email, including deactivated ones: emails stay unique. */
    boolean existsByEmail(String email);
}
