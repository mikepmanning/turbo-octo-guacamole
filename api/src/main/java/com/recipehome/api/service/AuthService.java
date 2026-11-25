package com.recipehome.api.service;

import com.recipehome.api.dto.AuthResponse;
import com.recipehome.api.dto.ChangePasswordRequest;
import com.recipehome.api.dto.UpdateProfileRequest;
import com.recipehome.api.dto.LoginRequest;
import com.recipehome.api.dto.RegisterRequest;
import com.recipehome.api.dto.UserDTO;

public interface AuthService {

    /** Creates the account (password BCrypt-hashed) and logs the new user in. */
    AuthResponse register(RegisterRequest request);

    /** Checks the email and password and returns a new token. */
    AuthResponse login(LoginRequest request);

    /** The active user with this id (from a token), or {@code InvalidCredentialsException}. */
    UserDTO getUser(Long id);

    /** Replaces the user's email, names and date of birth; 409 if the email belongs to someone else. */
    UserDTO updateProfile(Long id, UpdateProfileRequest request);

    /** Sets a new password after checking the current one ({@code IncorrectPasswordException}). */
    void changePassword(Long id, ChangePasswordRequest request);
}
