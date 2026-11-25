package com.recipehome.api.controller;

import com.recipehome.api.repository.FamilyMemberRepository;
import com.recipehome.api.repository.FamilyRepository;
import com.recipehome.api.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.matchesPattern;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Creating, joining and managing a family through the whole stack, with real users and tokens.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class FamilyIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private FamilyRepository familyRepository;
    @Autowired private FamilyMemberRepository memberRepository;

    private String ada;
    private String grace;
    private String alan;
    private long graceId;
    private long alanId;

    @BeforeEach
    void registerUsers() throws Exception {
        ada = register("ada@example.com", "Ada");
        grace = register("grace@example.com", "Grace");
        alan = register("alan@example.com", "Alan");
        graceId = userRepository.findByEmailAndIsActiveTrue("grace@example.com").orElseThrow().getId();
        alanId = userRepository.findByEmailAndIsActiveTrue("alan@example.com").orElseThrow().getId();
    }

    @AfterEach
    void cleanUp() {
        memberRepository.deleteAll();
        familyRepository.deleteAll();
        userRepository.deleteAll();
    }

    private String register(String email, String firstName) throws Exception {
        Map<String, Object> body = Map.of("email", email, "password", "correct horse", "firstName", firstName,
                "lastName", "Test", "dateOfBirth", "1990-01-01");
        String json = mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(json).get("token").asString();
    }

    private ResultActions as(String token, MockHttpServletRequestBuilder request) throws Exception {
        return mockMvc.perform(request.header("Authorization", "Bearer " + token));
    }

    private ResultActions as(String token, MockHttpServletRequestBuilder request, Object body) throws Exception {
        return as(token, request.contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(body)));
    }

    private JsonNode json(ResultActions result) throws Exception {
        return objectMapper.readTree(result.andReturn().getResponse().getContentAsString());
    }

    /** Ada creates "The Lovelaces"; returns its invite code. */
    private String adaCreatesFamily() throws Exception {
        return json(as(ada, post("/api/family"), Map.of("name", "The Lovelaces"))).get("inviteCode").asString();
    }

    @Test
    void someoneNotInAFamilyGetsNoContent() throws Exception {
        as(ada, get("/api/family")).andExpect(status().isNoContent()).andExpect(content().string(""));
    }

    @Test
    void creatingAFamilyMakesTheUserItsOwnerWithAnInviteCode() throws Exception {
        as(ada, post("/api/family"), Map.of("name", "  The Lovelaces "))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("The Lovelaces"))
                .andExpect(jsonPath("$.myRole").value("OWNER"))
                .andExpect(jsonPath("$.inviteCode").value(matchesPattern("[A-HJ-NP-Z2-9]{8}")))
                .andExpect(jsonPath("$.inviteCodeCreatedAt").exists())
                .andExpect(jsonPath("$.members", hasSize(1)))
                .andExpect(jsonPath("$.members[0].firstName").value("Ada"))
                .andExpect(jsonPath("$.members[0].email").value("ada@example.com"))
                .andExpect(jsonPath("$.members[0].role").value("OWNER"));

        as(ada, get("/api/family")).andExpect(status().isOk()).andExpect(jsonPath("$.name").value("The Lovelaces"));
    }

    @Test
    void aFamilyNeedsAName() throws Exception {
        as(ada, post("/api/family"), Map.of("name", " "))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.name").value("Family name is required"));
    }

    @Test
    void othersJoinWithTheCode_ignoringCaseSpacesAndDashes() throws Exception {
        String code = adaCreatesFamily();
        String typed = " " + code.substring(0, 4).toLowerCase() + "-" + code.substring(4) + " ";

        as(grace, post("/api/family/join"), Map.of("code", typed))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("The Lovelaces"))
                .andExpect(jsonPath("$.myRole").value("MEMBER"))
                .andExpect(jsonPath("$.inviteCode").value(nullValue()))
                .andExpect(jsonPath("$.members", hasSize(2)))
                .andExpect(jsonPath("$.members[0].role").value("OWNER"))
                .andExpect(jsonPath("$.members[1].firstName").value("Grace"));

        as(ada, get("/api/family")).andExpect(jsonPath("$.members", hasSize(2)));
    }

    @Test
    void aWrongCodeDoesNotJoin() throws Exception {
        adaCreatesFamily();

        as(grace, post("/api/family/join"), Map.of("code", "AAAAAAAA"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("That invite code isn't valid. It may have been revoked: ask for a new one."));
        as(grace, get("/api/family")).andExpect(status().isNoContent());
    }

    @Test
    void aRevokedCodeStopsWorking_untilTheOwnerMakesANewOne() throws Exception {
        String code = adaCreatesFamily();

        as(ada, delete("/api/family/invite-code"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.inviteCode").value(nullValue()))
                .andExpect(jsonPath("$.inviteCodeCreatedAt").value(nullValue()));
        as(grace, post("/api/family/join"), Map.of("code", code)).andExpect(status().isNotFound());

        String newCode = json(as(ada, post("/api/family/invite-code")).andExpect(status().isOk())).get("inviteCode").asString();
        assertThat(newCode).isNotEqualTo(code);
        as(grace, post("/api/family/join"), Map.of("code", newCode)).andExpect(status().isOk());
    }

    @Test
    void aNewCodeReplacesTheOldOne() throws Exception {
        String code = adaCreatesFamily();

        as(ada, post("/api/family/invite-code")).andExpect(jsonPath("$.inviteCode").value(not(code)));

        as(grace, post("/api/family/join"), Map.of("code", code)).andExpect(status().isNotFound());
    }

    @Test
    void aUserIsInOneFamilyAtATime() throws Exception {
        String code = adaCreatesFamily();
        as(grace, post("/api/family/join"), Map.of("code", code));

        String conflict = "You are already in a family. Leave it before creating or joining another.";
        as(grace, post("/api/family"), Map.of("name", "Hoppers"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.error").value(conflict));
        as(ada, post("/api/family/join"), Map.of("code", code))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.error").value(conflict));
    }

    @Test
    void onlyTheOwnerManagesTheFamily() throws Exception {
        String code = adaCreatesFamily();
        as(grace, post("/api/family/join"), Map.of("code", code));
        as(alan, post("/api/family/join"), Map.of("code", code));

        String ownerOnly = "Only the family owner can do that";
        as(grace, put("/api/family"), Map.of("name", "Mine now")).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value(ownerOnly));
        as(grace, post("/api/family/invite-code")).andExpect(status().isForbidden());
        as(grace, delete("/api/family/invite-code")).andExpect(status().isForbidden());
        as(grace, delete("/api/family/members/" + alanId)).andExpect(status().isForbidden());
        as(grace, post("/api/family/members/" + alanId + "/make-owner")).andExpect(status().isForbidden());
        as(grace, delete("/api/family")).andExpect(status().isForbidden());

        as(ada, get("/api/family")).andExpect(jsonPath("$.name").value("The Lovelaces"))
                .andExpect(jsonPath("$.members", hasSize(3)));
    }

    @Test
    void theOwnerRenamesTheFamily() throws Exception {
        adaCreatesFamily();

        as(ada, put("/api/family"), Map.of("name", "Team Lovelace"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Team Lovelace"));
    }

    @Test
    void theOwnerRemovesAMember_whoCanThenJoinAnother() throws Exception {
        String code = adaCreatesFamily();
        as(grace, post("/api/family/join"), Map.of("code", code));

        as(ada, delete("/api/family/members/" + graceId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.members", hasSize(1)));
        as(grace, get("/api/family")).andExpect(status().isNoContent());
        as(grace, post("/api/family"), Map.of("name", "Hoppers")).andExpect(status().isCreated());
    }

    @Test
    void theOwnerCannotRemoveThemselves_orSomeoneOutsideTheFamily() throws Exception {
        adaCreatesFamily();
        long adaId = userRepository.findByEmailAndIsActiveTrue("ada@example.com").orElseThrow().getId();

        as(ada, delete("/api/family/members/" + adaId)).andExpect(status().isUnprocessableContent());
        as(ada, delete("/api/family/members/" + graceId))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("That person isn't in your family"));
    }

    @Test
    void aMemberLeaves() throws Exception {
        String code = adaCreatesFamily();
        as(grace, post("/api/family/join"), Map.of("code", code));

        as(grace, post("/api/family/leave")).andExpect(status().isNoContent());

        as(grace, get("/api/family")).andExpect(status().isNoContent());
        as(ada, get("/api/family")).andExpect(jsonPath("$.members", hasSize(1)));
    }

    @Test
    void theOwnerHandsOverBeforeLeaving() throws Exception {
        String code = adaCreatesFamily();
        as(grace, post("/api/family/join"), Map.of("code", code));

        as(ada, post("/api/family/leave"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.error").value("Make someone else the owner before you leave, or delete the family."));

        as(ada, post("/api/family/members/" + graceId + "/make-owner"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.myRole").value("MEMBER"))
                .andExpect(jsonPath("$.inviteCode").value(nullValue()))
                .andExpect(jsonPath("$.members[0].firstName").value("Grace"))
                .andExpect(jsonPath("$.members[0].role").value("OWNER"));
        as(grace, get("/api/family")).andExpect(jsonPath("$.myRole").value("OWNER"))
                .andExpect(jsonPath("$.inviteCode").value(code));

        as(ada, post("/api/family/leave")).andExpect(status().isNoContent());
        as(grace, get("/api/family")).andExpect(jsonPath("$.members", hasSize(1)));
    }

    @Test
    void theLastMemberLeavingDeletesTheFamily() throws Exception {
        String code = adaCreatesFamily();

        as(ada, post("/api/family/leave")).andExpect(status().isNoContent());

        as(ada, get("/api/family")).andExpect(status().isNoContent());
        as(grace, post("/api/family/join"), Map.of("code", code)).andExpect(status().isNotFound());
        assertThat(familyRepository.findAll()).allSatisfy(f -> assertThat(f.getIsActive()).isFalse());
    }

    @Test
    void deletingTheFamilyFreesEveryone_andItsCodeStopsWorking() throws Exception {
        String code = adaCreatesFamily();
        as(grace, post("/api/family/join"), Map.of("code", code));

        as(ada, delete("/api/family")).andExpect(status().isNoContent());

        as(ada, get("/api/family")).andExpect(status().isNoContent());
        as(grace, get("/api/family")).andExpect(status().isNoContent());
        as(alan, post("/api/family/join"), Map.of("code", code)).andExpect(status().isNotFound());
        as(grace, post("/api/family"), Map.of("name", "Hoppers")).andExpect(status().isCreated());
    }

    @Test
    void actionsNeedAFamily() throws Exception {
        as(ada, put("/api/family"), Map.of("name", "X"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("You are not in a family"));
        as(ada, post("/api/family/leave")).andExpect(status().isNotFound());
    }

    @Test
    void theFamilyApiNeedsALogin() throws Exception {
        mockMvc.perform(get("/api/family")).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/family/join").contentType(MediaType.APPLICATION_JSON).content("{\"code\":\"X\"}"))
                .andExpect(status().isUnauthorized());
    }
}
