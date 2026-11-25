package com.recipehome.api.controller;

import com.recipehome.api.dto.FamilyDTO;
import com.recipehome.api.dto.FamilyNameRequest;
import com.recipehome.api.dto.JoinFamilyRequest;
import com.recipehome.api.service.FamilyService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The logged-in user's family: /api/family is always "my family". */
@RestController
@RequestMapping("/api/family")
public class FamilyController {

    private final FamilyService familyService;

    public FamilyController(FamilyService familyService) {
        this.familyService = familyService;
    }

    private static Long userId(Jwt jwt) {
        return Long.valueOf(jwt.getSubject());
    }

    /** 200 with the family, or 204 when the user isn't in one. */
    @GetMapping
    public ResponseEntity<FamilyDTO> getMyFamily(@AuthenticationPrincipal Jwt jwt) {
        return familyService.getMyFamily(userId(jwt))
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PostMapping
    public ResponseEntity<FamilyDTO> createFamily(@AuthenticationPrincipal Jwt jwt,
                                                  @Valid @RequestBody FamilyNameRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(familyService.createFamily(userId(jwt), request.name()));
    }

    @PutMapping
    public FamilyDTO renameFamily(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody FamilyNameRequest request) {
        return familyService.renameFamily(userId(jwt), request.name());
    }

    @DeleteMapping
    public ResponseEntity<Void> deleteFamily(@AuthenticationPrincipal Jwt jwt) {
        familyService.deleteFamily(userId(jwt));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/invite-code")
    public FamilyDTO newInviteCode(@AuthenticationPrincipal Jwt jwt) {
        return familyService.newInviteCode(userId(jwt));
    }

    @DeleteMapping("/invite-code")
    public FamilyDTO revokeInviteCode(@AuthenticationPrincipal Jwt jwt) {
        return familyService.revokeInviteCode(userId(jwt));
    }

    @PostMapping("/join")
    public FamilyDTO joinFamily(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody JoinFamilyRequest request) {
        return familyService.joinFamily(userId(jwt), request.code());
    }

    @PostMapping("/leave")
    public ResponseEntity<Void> leaveFamily(@AuthenticationPrincipal Jwt jwt) {
        familyService.leaveFamily(userId(jwt));
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/members/{memberUserId}")
    public FamilyDTO removeMember(@AuthenticationPrincipal Jwt jwt, @PathVariable Long memberUserId) {
        return familyService.removeMember(userId(jwt), memberUserId);
    }

    @PostMapping("/members/{memberUserId}/make-owner")
    public FamilyDTO makeOwner(@AuthenticationPrincipal Jwt jwt, @PathVariable Long memberUserId) {
        return familyService.makeOwner(userId(jwt), memberUserId);
    }
}
