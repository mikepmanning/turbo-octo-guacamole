package com.recipehome.api.controller;

import com.recipehome.api.dto.AuthResponse;
import com.recipehome.api.dto.ChangePasswordRequest;
import com.recipehome.api.dto.LoginRequest;
import com.recipehome.api.dto.RegisterRequest;
import com.recipehome.api.dto.UpdateProfileRequest;
import com.recipehome.api.dto.UserDTO;
import com.recipehome.api.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(request));
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    /** The logged-in user (the token's subject is their id). */
    @GetMapping("/me")
    public UserDTO me(@AuthenticationPrincipal Jwt jwt) {
        return authService.getUser(Long.valueOf(jwt.getSubject()));
    }

    /** Edit the logged-in user's email, names and date of birth. */
    @PutMapping("/me")
    public UserDTO updateProfile(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody UpdateProfileRequest request) {
        return authService.updateProfile(Long.valueOf(jwt.getSubject()), request);
    }

    /** Change the logged-in user's password (the current one is required). Existing tokens keep working. */
    @PutMapping("/me/password")
    public ResponseEntity<Void> changePassword(@AuthenticationPrincipal Jwt jwt,
                                               @Valid @RequestBody ChangePasswordRequest request) {
        authService.changePassword(Long.valueOf(jwt.getSubject()), request);
        return ResponseEntity.noContent().build();
    }
}
