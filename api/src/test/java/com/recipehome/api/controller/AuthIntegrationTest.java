package com.recipehome.api.controller;

import com.recipehome.api.entity.User;
import com.recipehome.api.repository.UserRepository;
import com.recipehome.api.TestUsers;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.context.ApplicationContext;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.emptyOrNullString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Registering, logging in and using the token, through the whole stack (real security filters, H2 database).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ApplicationContext context;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private JwtEncoder jwtEncoder;

    @BeforeEach
    @AfterEach
    void cleanUp() {
        TestUsers.clearDatabase(context);
    }

    private Map<String, Object> registration() {
        Map<String, Object> body = new HashMap<>();
        body.put("email", "Ada@Example.com ");
        body.put("password", "correct horse");
        body.put("firstName", "Ada");
        body.put("lastName", "Lovelace");
        body.put("dateOfBirth", "1990-12-10");
        return body;
    }

    private ResultActions postJson(String url, Object body) throws Exception {
        return mockMvc.perform(post(url)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body)));
    }

    private String tokenFrom(ResultActions result) throws Exception {
        JsonNode json = objectMapper.readTree(result.andReturn().getResponse().getContentAsString());
        return json.get("token").asString();
    }

    @Test
    void registerCreatesTheUserWithAHashedPasswordAndLogsThemIn() throws Exception {
        String token = tokenFrom(postJson("/api/auth/register", registration())
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.token").value(not(emptyOrNullString())))
                .andExpect(jsonPath("$.expiresAt").exists())
                .andExpect(jsonPath("$.user.email").value("ada@example.com"))
                .andExpect(jsonPath("$.user.firstName").value("Ada"))
                .andExpect(jsonPath("$.user.lastName").value("Lovelace"))
                .andExpect(jsonPath("$.user.dateOfBirth").value("1990-12-10"))
                .andExpect(jsonPath("$.user.passwordHash").doesNotExist())
                .andExpect(jsonPath("$.user.password").doesNotExist()));

        User saved = userRepository.findByEmailAndIsActiveTrue("ada@example.com").orElseThrow();
        assertThat(saved.getPasswordHash()).isNotEqualTo("correct horse").startsWith("$2");
        assertThat(saved.getDateOfBirth()).isEqualTo(LocalDate.of(1990, 12, 10));

        mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("ada@example.com"));
    }

    @Test
    void anEmailCanOnlyBeRegisteredOnce_ignoringCase() throws Exception {
        postJson("/api/auth/register", registration()).andExpect(status().isCreated());

        Map<String, Object> again = registration();
        again.put("email", "ADA@example.COM");
        postJson("/api/auth/register", again)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("An account with this email already exists"));
    }

    @Test
    void registerValidatesEveryField() throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("email", "not-an-email");
        body.put("password", "short");
        body.put("firstName", " ");
        body.put("dateOfBirth", LocalDate.now().plusDays(1).toString());

        postJson("/api/auth/register", body)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.email").value("Enter a valid email address"))
                .andExpect(jsonPath("$.password").value("Password must be 8 to 72 characters"))
                .andExpect(jsonPath("$.firstName").value("First name is required"))
                .andExpect(jsonPath("$.lastName").value("Last name is required"))
                .andExpect(jsonPath("$.dateOfBirth").value("Date of birth must be in the past"));
        assertThat(userRepository.count()).isZero();
    }

    @Test
    void loginReturnsATokenThatOpensTheApi() throws Exception {
        postJson("/api/auth/register", registration()).andExpect(status().isCreated());

        String token = tokenFrom(postJson("/api/auth/login", Map.of("email", " ADA@example.com", "password", "correct horse"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.firstName").value("Ada")));

        mockMvc.perform(get("/api/recipes").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    @Test
    void loginWithAWrongPasswordOrUnknownEmailIsRefusedTheSameWay() throws Exception {
        postJson("/api/auth/register", registration()).andExpect(status().isCreated());

        postJson("/api/auth/login", Map.of("email", "ada@example.com", "password", "wrong password"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Invalid email or password"));
        postJson("/api/auth/login", Map.of("email", "nobody@example.com", "password", "correct horse"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Invalid email or password"));
    }

    @Test
    void theApiNeedsAToken() throws Exception {
        mockMvc.perform(get("/api/recipes"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Please log in"));
        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void aTamperedOrExpiredTokenIsRefused() throws Exception {
        String token = tokenFrom(postJson("/api/auth/register", registration()));

        mockMvc.perform(get("/api/recipes").header("Authorization", "Bearer " + token + "x"))
                .andExpect(status().isUnauthorized());

        Instant past = Instant.now().minusSeconds(3600);
        JwtClaimsSet expiredClaims = JwtClaimsSet.builder()
                .issuer("recipehome").subject("1")
                .issuedAt(past.minusSeconds(60)).expiresAt(past)
                .build();
        String expired = jwtEncoder.encode(JwtEncoderParameters.from(
                JwsHeader.with(MacAlgorithm.HS256).build(), expiredClaims)).getTokenValue();
        mockMvc.perform(get("/api/recipes").header("Authorization", "Bearer " + expired))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void aTokenFromAnotherIssuerIsRefused() throws Exception {
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("someone-else").subject("1")
                .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(3600))
                .build();
        String token = jwtEncoder.encode(JwtEncoderParameters.from(
                JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();

        mockMvc.perform(get("/api/recipes").header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void meRefusesATokenForAUserWhoNoLongerExists() throws Exception {
        String token = tokenFrom(postJson("/api/auth/register", registration()));
        userRepository.deleteAll();

        mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }

    private ResultActions putJson(String url, String token, Object body) throws Exception {
        return mockMvc.perform(put(url)
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body)));
    }

    private Map<String, Object> profile(String email) {
        Map<String, Object> body = new HashMap<>();
        body.put("email", email);
        body.put("firstName", " Augusta ");
        body.put("lastName", "King");
        body.put("dateOfBirth", "1985-12-10");
        return body;
    }

    @Test
    void theUserCanEditTheirDetails_andLogInWithTheNewEmail() throws Exception {
        String token = tokenFrom(postJson("/api/auth/register", registration()));

        putJson("/api/auth/me", token, profile(" Augusta@Example.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("augusta@example.com"))
                .andExpect(jsonPath("$.firstName").value("Augusta"))
                .andExpect(jsonPath("$.lastName").value("King"))
                .andExpect(jsonPath("$.dateOfBirth").value("1985-12-10"));

        mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.email").value("augusta@example.com"));
        postJson("/api/auth/login", Map.of("email", "augusta@example.com", "password", "correct horse"))
                .andExpect(status().isOk());
        postJson("/api/auth/login", Map.of("email", "ada@example.com", "password", "correct horse"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void keepingTheSameEmailIsFine() throws Exception {
        String token = tokenFrom(postJson("/api/auth/register", registration()));

        putJson("/api/auth/me", token, profile("ADA@example.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("ada@example.com"));
    }

    @Test
    void theEmailCannotBeChangedToSomeoneElses() throws Exception {
        String token = tokenFrom(postJson("/api/auth/register", registration()));
        Map<String, Object> other = registration();
        other.put("email", "grace@example.com");
        postJson("/api/auth/register", other).andExpect(status().isCreated());

        putJson("/api/auth/me", token, profile("Grace@example.com"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("An account with this email already exists"));
        assertThat(userRepository.findByEmailAndIsActiveTrue("ada@example.com")).isPresent();
    }

    @Test
    void editingValidatesTheFields() throws Exception {
        String token = tokenFrom(postJson("/api/auth/register", registration()));
        Map<String, Object> body = profile("nope");
        body.put("lastName", "");
        body.put("dateOfBirth", LocalDate.now().toString());

        putJson("/api/auth/me", token, body)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.email").value("Enter a valid email address"))
                .andExpect(jsonPath("$.lastName").value("Last name is required"))
                .andExpect(jsonPath("$.dateOfBirth").value("Date of birth must be in the past"));
    }

    @Test
    void editingNeedsALogin() throws Exception {
        mockMvc.perform(put("/api/auth/me").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(profile("a@example.com"))))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(put("/api/auth/me/password").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"correct horse\",\"newPassword\":\"new password\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void changingThePasswordNeedsTheCurrentOne_thenOnlyTheNewOneWorks() throws Exception {
        String token = tokenFrom(postJson("/api/auth/register", registration()));
        String oldHash = userRepository.findByEmailAndIsActiveTrue("ada@example.com").orElseThrow().getPasswordHash();

        putJson("/api/auth/me/password", token, Map.of("currentPassword", "wrong", "newPassword", "a new password"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.currentPassword").value("Current password is incorrect"));

        putJson("/api/auth/me/password", token, Map.of("currentPassword", "correct horse", "newPassword", "a new password"))
                .andExpect(status().isNoContent());

        String newHash = userRepository.findByEmailAndIsActiveTrue("ada@example.com").orElseThrow().getPasswordHash();
        assertThat(newHash).isNotEqualTo(oldHash).startsWith("$2").doesNotContain("a new password");
        postJson("/api/auth/login", Map.of("email", "ada@example.com", "password", "correct horse"))
                .andExpect(status().isUnauthorized());
        postJson("/api/auth/login", Map.of("email", "ada@example.com", "password", "a new password"))
                .andExpect(status().isOk());
    }

    @Test
    void theNewPasswordFollowsTheSameRules() throws Exception {
        String token = tokenFrom(postJson("/api/auth/register", registration()));

        putJson("/api/auth/me/password", token, Map.of("currentPassword", "", "newPassword", "short"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.currentPassword").value("Current password is required"))
                .andExpect(jsonPath("$.newPassword").value("Password must be 8 to 72 characters"));
    }

    @Test
    void theAlexaEndpointStaysOpen() throws Exception {
        // Amazon calls it without our token: it must not get "Please log in" (whatever the skill then answers).
        int status = mockMvc.perform(post("/alexa").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andReturn().getResponse().getStatus();
        assertThat(status).isNotEqualTo(401).isNotEqualTo(403);
    }
}
