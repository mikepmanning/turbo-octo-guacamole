package com.recipehome.api.exception;

import org.springframework.http.HttpStatus;

/**
 * A family action that can't be done, with the status it maps to in {@link GlobalExceptionHandler}.
 * Use the factory methods so the messages stay the same everywhere.
 */
public class FamilyException extends RuntimeException {

    private final HttpStatus status;

    private FamilyException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public static FamilyException notInFamily() {
        return new FamilyException(HttpStatus.NOT_FOUND, "You are not in a family");
    }

    public static FamilyException alreadyInFamily() {
        return new FamilyException(HttpStatus.CONFLICT,
                "You are already in a family. Leave it before creating or joining another.");
    }

    public static FamilyException ownerOnly() {
        return new FamilyException(HttpStatus.FORBIDDEN, "Only the family owner can do that");
    }

    public static FamilyException invalidCode() {
        return new FamilyException(HttpStatus.NOT_FOUND,
                "That invite code isn't valid. It may have been revoked: ask for a new one.");
    }

    public static FamilyException notAMember() {
        return new FamilyException(HttpStatus.NOT_FOUND, "That person isn't in your family");
    }

    /** A rule about the action itself, e.g. the owner leaving while others are still in the family. */
    public static FamilyException rule(String message) {
        return new FamilyException(HttpStatus.UNPROCESSABLE_CONTENT, message);
    }
}
