package com.recipehome.api.dto;

import com.recipehome.api.entity.User;

import java.time.LocalDate;

/** A user as the API returns it (never the password hash). */
public record UserDTO(Long id, String email, String firstName, String lastName, LocalDate dateOfBirth) {

    public static UserDTO from(User user) {
        return new UserDTO(user.getId(), user.getEmail(), user.getFirstName(), user.getLastName(),
                user.getDateOfBirth());
    }
}
