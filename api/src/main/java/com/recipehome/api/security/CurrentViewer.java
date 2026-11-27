package com.recipehome.api.security;

import com.recipehome.api.repository.FamilyMemberRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * The {@link Viewer} for the current request: the user from the login token (its subject is the user id) and
 * their family. Without a token (Alexa at /alexa, the seeder, other startup code) the viewer is anonymous and
 * only sees public recipes. Looked up once per request.
 */
@Component
public class CurrentViewer {

    private static final String CACHE_KEY = CurrentViewer.class.getName();

    private final FamilyMemberRepository memberRepository;

    public CurrentViewer(FamilyMemberRepository memberRepository) {
        this.memberRepository = memberRepository;
    }

    public Viewer get() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (!(auth instanceof JwtAuthenticationToken token)) {
            return Viewer.anonymous();
        }
        RequestAttributes request = RequestContextHolder.getRequestAttributes();
        if (request != null && request.getAttribute(CACHE_KEY, RequestAttributes.SCOPE_REQUEST) instanceof Viewer cached) {
            return cached;
        }
        Viewer viewer = viewerFor(Long.valueOf(token.getName()));
        if (request != null) request.setAttribute(CACHE_KEY, viewer, RequestAttributes.SCOPE_REQUEST);
        return viewer;
    }

    /** The viewer for this user: them and, if they are in a family, everyone in it. One query. */
    public Viewer viewerFor(Long userId) {
        List<FamilyMemberRepository.GroupMember> group = memberRepository.findGroupOf(userId);
        if (group.isEmpty()) return new Viewer(userId, null, Set.of(userId));
        Set<Long> userIds = new HashSet<>();
        group.forEach(member -> userIds.add(member.userId()));
        userIds.add(userId);
        return new Viewer(userId, group.getFirst().familyId(), userIds);
    }
}
