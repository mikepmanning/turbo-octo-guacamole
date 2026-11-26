package com.recipehome.api;

import com.recipehome.api.entity.User;
import com.recipehome.api.repository.FamilyMemberRepository;
import com.recipehome.api.repository.FamilyRepository;
import com.recipehome.api.repository.MealPlanExclusionRepository;
import com.recipehome.api.repository.MealPlanRepository;
import com.recipehome.api.repository.RecipeRepository;
import com.recipehome.api.repository.UserRepository;
import com.recipehome.api.security.TokenService;
import org.springframework.context.ApplicationContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.time.LocalDate;
import java.util.UUID;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * Real users for @SpringBootTest tests: recipes and meal plans belong to whoever is logged in, so requests need
 * a real user's token rather than a mock user.
 */
public final class TestUsers {

    private TestUsers() {
    }

    /**
     * Empties every table, children first (exclusions and plans point at recipes, recipes and memberships at
     * users). Test classes with the same settings share one in-memory database, so start each test with this.
     */
    public static void clearDatabase(ApplicationContext context) {
        context.getBean(MealPlanExclusionRepository.class).deleteAll();
        context.getBean(MealPlanRepository.class).deleteAll();
        context.getBean(RecipeRepository.class).deleteAll();
        context.getBean(FamilyMemberRepository.class).deleteAll();
        context.getBean(FamilyRepository.class).deleteAll();
        context.getBean(UserRepository.class).deleteAll();
    }

    /** A saved user with a unique email (password "correct horse" is not set: log in with {@link #bearer}). */
    public static User createUser(ApplicationContext context, String firstName) {
        User user = new User();
        user.setEmail(firstName.toLowerCase() + "-" + UUID.randomUUID() + "@example.com");
        user.setPasswordHash("not used in these tests");
        user.setFirstName(firstName);
        user.setLastName("Test");
        user.setDateOfBirth(LocalDate.of(1990, 1, 1));
        return context.getBean(UserRepository.class).save(user);
    }

    /** "Bearer <token>" for this user, as the login endpoint would issue it. */
    public static String bearer(ApplicationContext context, User user) {
        return "Bearer " + context.getBean(TokenService.class).issue(user).token();
    }

    /** MockMvc with the real security filters that sends this user's token with every request. */
    public static MockMvc mockMvcAs(WebApplicationContext context, User user) {
        return MockMvcBuilders.webAppContextSetup(context)
                .apply(springSecurity())
                .defaultRequest(get("/").header("Authorization", bearer(context, user)))
                .build();
    }
}
