package com.recipehome.api.service.impl;

import com.recipehome.api.dto.AuthResponse;
import com.recipehome.api.dto.ChangePasswordRequest;
import com.recipehome.api.dto.LoginRequest;
import com.recipehome.api.dto.RegisterRequest;
import com.recipehome.api.dto.UpdateProfileRequest;
import com.recipehome.api.dto.UserDTO;
import com.recipehome.api.entity.User;
import com.recipehome.api.exception.EmailAlreadyRegisteredException;
import com.recipehome.api.exception.IncorrectPasswordException;
import com.recipehome.api.exception.InvalidCredentialsException;
import com.recipehome.api.repository.UserRepository;
import com.recipehome.api.security.TokenService;
import com.recipehome.api.service.AuthService;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.Optional;

@Service
@Transactional
public class AuthServiceImpl implements AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final TokenService tokenService;
    // Hash to check against when the email is unknown, so that login takes as long as with a wrong password
    // (otherwise response times would reveal which emails have accounts).
    private final String dummyHash;

    public AuthServiceImpl(UserRepository userRepository, PasswordEncoder passwordEncoder, TokenService tokenService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.tokenService = tokenService;
        this.dummyHash = passwordEncoder.encode("not-a-real-password");
    }

    /** Emails are compared trimmed and case-insensitively. */
    static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    @Override
    public AuthResponse register(RegisterRequest request) {
        String email = normalizeEmail(request.email());
        if (userRepository.existsByEmail(email)) {
            throw new EmailAlreadyRegisteredException();
        }
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setFirstName(request.firstName().trim());
        user.setLastName(request.lastName().trim());
        user.setDateOfBirth(request.dateOfBirth());
        try {
            user = userRepository.saveAndFlush(user);
        } catch (DataIntegrityViolationException e) {
            // Two sign-ups with the same email at once: the unique constraint catches the second.
            throw new EmailAlreadyRegisteredException();
        }
        return respond(user);
    }

    @Override
    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        Optional<User> user = userRepository.findByEmailAndIsActiveTrue(normalizeEmail(request.email()));
        String hash = user.map(User::getPasswordHash).orElse(dummyHash);
        boolean matches = passwordEncoder.matches(request.password(), hash);
        if (user.isEmpty() || !matches) {
            throw new InvalidCredentialsException();
        }
        return respond(user.get());
    }

    @Override
    @Transactional(readOnly = true)
    public UserDTO getUser(Long id) {
        return userRepository.findByIdAndIsActiveTrue(id)
                .map(UserDTO::from)
                .orElseThrow(InvalidCredentialsException::new);
    }

    @Override
    public UserDTO updateProfile(Long id, UpdateProfileRequest request) {
        User user = activeUser(id);
        String email = normalizeEmail(request.email());
        if (!email.equals(user.getEmail()) && userRepository.existsByEmailAndIdNot(email, id)) {
            throw new EmailAlreadyRegisteredException();
        }
        user.setEmail(email);
        user.setFirstName(request.firstName().trim());
        user.setLastName(request.lastName().trim());
        user.setDateOfBirth(request.dateOfBirth());
        try {
            userRepository.flush();
        } catch (DataIntegrityViolationException e) {
            // Someone else took the email at the same moment: the unique constraint catches it.
            throw new EmailAlreadyRegisteredException();
        }
        return UserDTO.from(user);
    }

    @Override
    public void changePassword(Long id, ChangePasswordRequest request) {
        User user = activeUser(id);
        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new IncorrectPasswordException();
        }
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
    }

    /** The token's user; gone or deactivated means the token is no good (401). */
    private User activeUser(Long id) {
        return userRepository.findByIdAndIsActiveTrue(id).orElseThrow(InvalidCredentialsException::new);
    }

    private AuthResponse respond(User user) {
        TokenService.IssuedToken token = tokenService.issue(user);
        return new AuthResponse(token.token(), token.expiresAt(), UserDTO.from(user));
    }
}
