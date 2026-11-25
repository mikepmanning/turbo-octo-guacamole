package com.recipehome.api.service.impl;

import com.recipehome.api.dto.FamilyDTO;
import com.recipehome.api.entity.Family;
import com.recipehome.api.entity.FamilyMember;
import com.recipehome.api.entity.User;
import com.recipehome.api.enums.FamilyRole;
import com.recipehome.api.exception.FamilyException;
import com.recipehome.api.exception.InvalidCredentialsException;
import com.recipehome.api.repository.FamilyMemberRepository;
import com.recipehome.api.repository.FamilyRepository;
import com.recipehome.api.repository.UserRepository;
import com.recipehome.api.service.FamilyService;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

@Service
@Transactional
public class FamilyServiceImpl implements FamilyService {

    /** No 0/O or 1/I, so codes read aloud or copied by hand don't get mixed up. */
    static final String CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    static final int CODE_LENGTH = 8;

    private final FamilyRepository familyRepository;
    private final FamilyMemberRepository memberRepository;
    private final UserRepository userRepository;
    private final SecureRandom random = new SecureRandom();

    public FamilyServiceImpl(FamilyRepository familyRepository, FamilyMemberRepository memberRepository,
                             UserRepository userRepository) {
        this.familyRepository = familyRepository;
        this.memberRepository = memberRepository;
        this.userRepository = userRepository;
    }

    /** What the user typed: upper case, without spaces or dashes ("abcd-2345" -> "ABCD2345"). */
    static String normalizeCode(String code) {
        return code.replaceAll("[\\s-]", "").toUpperCase(Locale.ROOT);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<FamilyDTO> getMyFamily(Long userId) {
        return memberRepository.findByUserId(userId).map(this::toDTO);
    }

    @Override
    public FamilyDTO createFamily(Long userId, String name) {
        User user = activeUser(userId);
        if (memberRepository.existsByUserId(userId)) throw FamilyException.alreadyInFamily();
        Family family = new Family();
        family.setName(name);
        setNewCode(family);
        FamilyMember owner = new FamilyMember(user, FamilyRole.OWNER);
        family.addMember(owner);
        save(family);
        return toDTO(owner);
    }

    @Override
    public FamilyDTO renameFamily(Long userId, String name) {
        FamilyMember me = ownerMembership(userId);
        me.getFamily().setName(name);
        return toDTO(me);
    }

    @Override
    public FamilyDTO newInviteCode(Long userId) {
        FamilyMember me = ownerMembership(userId);
        setNewCode(me.getFamily());
        return toDTO(me);
    }

    @Override
    public FamilyDTO revokeInviteCode(Long userId) {
        FamilyMember me = ownerMembership(userId);
        me.getFamily().setInviteCode(null);
        me.getFamily().setInviteCodeCreatedAt(null);
        return toDTO(me);
    }

    @Override
    public FamilyDTO joinFamily(Long userId, String code) {
        User user = activeUser(userId);
        if (memberRepository.existsByUserId(userId)) throw FamilyException.alreadyInFamily();
        Family family = familyRepository.findByInviteCodeAndIsActiveTrue(normalizeCode(code))
                .orElseThrow(FamilyException::invalidCode);
        FamilyMember member = new FamilyMember(user, FamilyRole.MEMBER);
        family.addMember(member);
        save(family);
        return toDTO(member);
    }

    @Override
    public void leaveFamily(Long userId) {
        FamilyMember me = membership(userId);
        Family family = me.getFamily();
        if (me.getRole() == FamilyRole.OWNER) {
            if (family.getMembers().size() > 1) {
                throw FamilyException.rule("Make someone else the owner before you leave, or delete the family.");
            }
            delete(family);
            return;
        }
        family.removeMember(me);
    }

    @Override
    public FamilyDTO removeMember(Long userId, Long memberUserId) {
        FamilyMember me = ownerMembership(userId);
        if (memberUserId.equals(userId)) {
            throw FamilyException.rule("You can't remove yourself. Make someone else the owner first, or delete the family.");
        }
        me.getFamily().removeMember(otherMember(me.getFamily(), memberUserId));
        return toDTO(me);
    }

    @Override
    public FamilyDTO makeOwner(Long userId, Long memberUserId) {
        FamilyMember me = ownerMembership(userId);
        if (memberUserId.equals(userId)) throw FamilyException.rule("You are already the owner");
        FamilyMember newOwner = otherMember(me.getFamily(), memberUserId);
        me.setRole(FamilyRole.MEMBER);
        newOwner.setRole(FamilyRole.OWNER);
        return toDTO(me);
    }

    @Override
    public void deleteFamily(Long userId) {
        delete(ownerMembership(userId).getFamily());
    }

    // --- helpers --------------------------------------------------------------------------

    private User activeUser(Long userId) {
        return userRepository.findByIdAndIsActiveTrue(userId).orElseThrow(InvalidCredentialsException::new);
    }

    private FamilyMember membership(Long userId) {
        return memberRepository.findByUserId(userId).orElseThrow(FamilyException::notInFamily);
    }

    private FamilyMember ownerMembership(Long userId) {
        FamilyMember me = membership(userId);
        if (me.getRole() != FamilyRole.OWNER) throw FamilyException.ownerOnly();
        return me;
    }

    private static FamilyMember otherMember(Family family, Long memberUserId) {
        return family.getMembers().stream()
                .filter(m -> m.getUser().getId().equals(memberUserId))
                .findFirst()
                .orElseThrow(FamilyException::notAMember);
    }

    private void setNewCode(Family family) {
        String code;
        do {
            StringBuilder sb = new StringBuilder(CODE_LENGTH);
            for (int i = 0; i < CODE_LENGTH; i++) {
                sb.append(CODE_ALPHABET.charAt(random.nextInt(CODE_ALPHABET.length())));
            }
            code = sb.toString();
        } while (familyRepository.existsByInviteCode(code));
        family.setInviteCode(code);
        family.setInviteCodeCreatedAt(LocalDateTime.now());
    }

    private void save(Family family) {
        try {
            familyRepository.saveAndFlush(family);
        } catch (DataIntegrityViolationException e) {
            // The same user joining or creating twice at once: the unique user_id catches the second.
            throw FamilyException.alreadyInFamily();
        }
    }

    private static void delete(Family family) {
        family.softDelete();
        family.setInviteCode(null);
        family.setInviteCodeCreatedAt(null);
        // Delete the memberships, so everyone is free to create or join another family.
        List.copyOf(family.getMembers()).forEach(family::removeMember);
    }

    private static final Comparator<FamilyMember> OWNER_FIRST_THEN_JOINED = Comparator
            .comparing((FamilyMember m) -> m.getRole() == FamilyRole.OWNER ? 0 : 1)
            .thenComparing(FamilyMember::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder()));

    /** The family as `me` sees it: only the owner gets the invite code. */
    private FamilyDTO toDTO(FamilyMember me) {
        Family family = me.getFamily();
        boolean owner = me.getRole() == FamilyRole.OWNER;
        List<FamilyDTO.FamilyMemberDTO> members = family.getMembers().stream()
                .sorted(OWNER_FIRST_THEN_JOINED)
                .map(m -> new FamilyDTO.FamilyMemberDTO(
                        m.getUser().getId(), m.getUser().getFirstName(), m.getUser().getLastName(),
                        m.getUser().getEmail(), m.getRole(), m.getCreatedAt()))
                .toList();
        return new FamilyDTO(family.getId(), family.getName(), me.getRole(),
                owner ? family.getInviteCode() : null,
                owner ? family.getInviteCodeCreatedAt() : null,
                family.getCreatedAt(), members);
    }
}
