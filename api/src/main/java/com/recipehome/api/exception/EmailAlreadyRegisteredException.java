package com.recipehome.api.exception;

/** Registering with an email that already has an account; mapped to 409 by {@link GlobalExceptionHandler}. */
public class EmailAlreadyRegisteredException extends RuntimeException {

    public EmailAlreadyRegisteredException() {
        super("An account with this email already exists");
    }
}
