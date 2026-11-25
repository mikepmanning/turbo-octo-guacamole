package com.recipehome.api.exception;

/**
 * A login with an unknown email or a wrong password (deliberately the same message, so the response doesn't
 * reveal which emails have accounts); mapped to 401 by {@link GlobalExceptionHandler}.
 */
public class InvalidCredentialsException extends RuntimeException {

    public InvalidCredentialsException() {
        super("Invalid email or password");
    }
}
