package com.recipehome.api.exception;

/**
 * Thrown for a from/to date range that is backwards or too long; mapped to 400 by
 * {@link GlobalExceptionHandler}.
 */
public class InvalidDateRangeException extends RuntimeException {

    public InvalidDateRangeException(String message) {
        super(message);
    }
}
