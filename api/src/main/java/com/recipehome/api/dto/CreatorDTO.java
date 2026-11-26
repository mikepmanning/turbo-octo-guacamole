package com.recipehome.api.dto;

import com.recipehome.api.entity.User;

/** Who added a recipe or created a meal plan, as others see them (no email). */
public record CreatorDTO(Long id, String firstName, String lastName) {

    /** Null for things without a creator (sample recipes). */
    public static CreatorDTO of(User user) {
        return user == null ? null : new CreatorDTO(user.getId(), user.getFirstName(), user.getLastName());
    }
}
