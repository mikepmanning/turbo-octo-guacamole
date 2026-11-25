package com.recipehome.api.exception;

/**
 * The current password given to change the password is wrong. Mapped to 400 with the field
 * {@code currentPassword} by {@link GlobalExceptionHandler}: not 401, which means "log in again".
 */
public class IncorrectPasswordException extends RuntimeException {

    public IncorrectPasswordException() {
        super("Current password is incorrect");
    }
}
