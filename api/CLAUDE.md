# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RecipeHome is a Spring Boot 4.0.0 application designed to help users easily store and manage their recipes. The long-term vision includes integration with voice assistants (Alexa and Google Home) to provide hands-free, step-by-step cooking guidance while users are actively cooking.

The project uses:
- Java 21
- Maven for build management
- PostgreSQL as the database
- Spring Data JPA for data persistence
- Spring Web MVC for REST API endpoints
- Bean Validation for input validation

## Development Commands

### First-Time Setup
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Edit `.env` and set your PostgreSQL password:
   ```
   DB_PASSWORD=your_actual_password
   ```
3. Ensure your PostgreSQL database `recipehome` exists

### Running the Application
```bash
./mvnw spring-boot:run
```

On Windows:
```bash
mvnw.cmd spring-boot:run
```

### Building the Project
```bash
./mvnw clean package
```

### Running Tests
```bash
# Run all tests
./mvnw test

# Run a specific test class
./mvnw test -Dtest=RecipeHomeApplicationTests

# Run a specific test method
./mvnw test -Dtest=RecipeHomeApplicationTests#contextLoads
```

### Other Useful Commands
```bash
# Clean build artifacts
./mvnw clean

# Verify the project (compile, test, package)
./mvnw verify

# Skip tests during build
./mvnw package -DskipTests
```

## Project Structure

The application follows standard Spring Boot Maven project layout:
- `src/main/java/com/recipehome/api/` - Main application code
  - `entity/` - JPA entity classes (Recipe, Step, Ingredient, MealPlan, MealPlanEntry, User, BaseEntity)
  - `config/` - `JpaConfig` (auditing) and `SecurityConfig` (which endpoints need a login, BCrypt, JWT keys)
  - `security/` - `TokenService` (issues login tokens) and `JwtProperties` (`recipehome.jwt.*`)
  - `enums/` - `Unit` (ingredient units) and `MealType` (Breakfast, Lunch, Snack, Dinner)
  - `exception/` - `GlobalExceptionHandler` and the not-found exceptions it maps to 404
  - `repository/` - Spring Data JPA repositories
  - `service/` - Service interfaces
  - `service/impl/` - Service implementations
  - `dto/` - Data Transfer Objects for API layer
  - `mapper/` - Mappers to convert between entities and DTOs
  - `controller/` - REST API controllers
- `src/main/resources/` - Configuration files and static resources
- `src/test/java/com/recipehome/api/` - Test code

Base package: `com.recipehome.api`

## Architecture Notes

### Spring Boot Configuration
- Main application class: `RecipeHomeApplication.java`
- Configuration: `application.properties` (currently minimal, only sets application name)
- The project uses Spring Boot 4.0.0 with auto-configuration enabled via `@SpringBootApplication`

### Database
- PostgreSQL is configured as the runtime database
- JPA/Hibernate is used for ORM
- Database configuration uses environment variables loaded from `.env` file
- `.env` file is excluded from git (sensitive credentials)
- Use `.env.example` as a template for local setup
- Environment variables:
  - `DB_HOST` - Database host (default: localhost)
  - `DB_PORT` - Database port (default: 5432)
  - `DB_NAME` - Database name (default: recipehome)
  - `DB_USERNAME` - Database username (default: postgres)
  - `DB_PASSWORD` - Database password (required, no default)
  - `HIBERNATE_DDL_AUTO` - Schema generation strategy (default: update)
  - `SEED_DATA` - Load sample recipes at startup (default: true; see Sample Data below)
  - `JWT_SECRET` - Signs login tokens, at least 32 characters (blank: a random key per run; see Login below)
  - `JWT_EXPIRATION` - How long a login lasts (default: 7d)

### Sample Data
- `src/main/resources/seed/recipes.json` holds 86 sample recipes in the `POST /api/recipes` body shape
  (varied categories, times from 5 to 1005 min, every unit, package sizes, one deliberately sparse recipe,
  20 Breakfast, 25 Lunch, 25 Dinner and 25 Snack recipes for meal-planning testing)
- `RecipeSeeder` loads them at startup when `recipehome.seed.enabled=${SEED_DATA:true}`, but only if
  the database has no recipes (including soft-deleted ones), so it never duplicates or changes data.
  Each recipe is validated like an API request before any is saved; a bad file stops startup with
  the recipe title and field
- To re-seed, empty the database, e.g. `TRUNCATE meal_plan_entries, meal_plan_meal_types, meal_plans,
  recipes, steps, ingredients, recipe_equipment, recipe_categories RESTART IDENTITY;` (meal plans
  reference recipes, so they must go too), then restart. Set `SEED_DATA=false` before production
- Tests: the test profile turns seeding off. Use `SeedRecipes.load()` for the data as `RecipeDTO`s,
  or opt a Spring test in with `recipehome.seed.enabled=true` (see `RecipeSeederTest`)

### Layered Architecture

The application follows a standard three-tier architecture:

**Repository Layer** (`com.recipehome.api.repository`)
- Uses Spring Data JPA for data access
- Repositories extend `JpaRepository<Entity, Long>`
- All query methods filter by `isActive = true` to respect soft deletes
- Custom query methods:
  - `RecipeRepository`: Search by title, category, prep time, total time
  - `StepRepository`: Find steps by recipe ID (ordered by stepOrder)
  - `IngredientRepository`: Find ingredients by recipe ID, search by name
  - `MealPlanRepository`: Find an active meal plan by ID; list active plans (latest start date first, entries fetched with them)
  - `MealPlanEntryRepository`: Meals planned in a date range in active plans, with their recipe and plan

**Service Layer** (`com.recipehome.api.service`)
- Contains business logic and transaction management
- All service methods are transactional via `@Transactional`
- Read-only operations marked with `@Transactional(readOnly = true)` for optimization
- Services handle:
  - Entity CRUD operations
  - Soft delete/restore operations
  - Maintaining bidirectional relationships (Step/Ingredient use Recipe helper methods)
  - Business validation and error handling

**Service Implementation Pattern**
- Interfaces in `service/` package define contracts
- Implementations in `service/impl/` package
- Constructor injection for dependencies (repositories)
- RuntimeExceptions thrown when entities not found (replace with custom exceptions as needed)

**Controller Layer** (`com.recipehome.api.controller`)
- REST API endpoints using Spring Web MVC
- `RecipeController` handles all recipe operations including embedded steps and ingredients
- `MealPlanController` lists, creates, returns, updates and deletes meal plans
- Uses DTOs for request/response payloads
- Mappers convert between entities and DTOs
- Validation handled via `@Valid` annotation on DTOs

**DTO and Mapper Pattern**
- DTOs (`com.recipehome.api.dto`) separate API contracts from domain entities
- `RecipeDTO` includes embedded `StepDTO` and `IngredientDTO` lists
- Mappers (`com.recipehome.api.mapper`) handle entity ↔ DTO conversion
- Steps and ingredients are always managed as part of the Recipe (no separate endpoints)

### REST API Endpoints

All endpoints are prefixed with `/api`

**Login** (`/api/auth`) - `AuthService`, `SecurityConfig`, `security/TokenService`
- Every `/api` endpoint needs `Authorization: Bearer <token>` except `POST /api/auth/register` and
  `POST /api/auth/login`. With no token, or one that is invalid, expired or from another issuer, the response is
  401 `{"error": "Please log in"}`. Paths outside `/api` (the Alexa endpoint `/alexa`) stay open. The API is
  stateless (no session or cookie), so CSRF protection is off
- `POST /api/auth/register` - body `{"email", "password", "firstName", "lastName", "dateOfBirth": "1990-12-10"}`,
  all required; returns 201 `{"token", "expiresAt", "user": {id, email, firstName, lastName, dateOfBirth}}`
  (the new user is logged in). 400 field errors (invalid email; password not 8-72 characters, since BCrypt
  only uses the first 72 bytes; date of birth not in the past); 409 `{"error": "An account with this email
  already exists"}`. Emails are trimmed and lower-cased, so they are unique regardless of case
- `POST /api/auth/login` - body `{"email", "password"}`; returns the same response as register, or 401
  `{"error": "Invalid email or password"}` for an unknown email or a wrong password (the same message and
  about the same time, so a login doesn't reveal which emails have accounts)
- `GET /api/auth/me` - the logged-in user; 401 if the token's user no longer exists
- `PUT /api/auth/me` - edit the logged-in user: body `{"email", "firstName", "lastName", "dateOfBirth"}` (all
  required, same rules as register); returns the updated user. 409 if the email belongs to another user. The
  token keeps working (its subject is the id; its `email` claim may then be out of date, so don't rely on it)
- `PUT /api/auth/me/password` - body `{"currentPassword", "newPassword"}` (8-72 characters); 204. A wrong current
  password is a 400 field error `{"currentPassword": "Current password is incorrect"}`
  (`IncorrectPasswordException`), deliberately not 401, which the front end treats as "log in again".
  Tokens issued before the change stay valid until they expire
- Passwords are stored only as BCrypt hashes (`User.passwordHash`, never returned)
- Tokens are HS256 JWTs (Spring Security's OAuth2 resource server, Nimbus): subject = user id, claim `email`,
  issuer `recipehome`, lasting `recipehome.jwt.expiration` (`JWT_EXPIRATION`, default 7d). Signed with
  `JWT_SECRET` (at least 32 characters, or startup fails). If it is blank, a random key is made per run, so
  logins end on restart. In a controller, take `@AuthenticationPrincipal Jwt jwt` and use `jwt.getSubject()`
- There is no logout endpoint: the browser forgets the token. A token stays valid until it expires
- Tests: `@WebMvcTest` classes use `@AutoConfigureMockMvc(addFilters = false)` (controller logic only);
  `@SpringBootTest` + MockMvc classes use `@WithMockUser`; `AuthIntegrationTest` covers the real login flow

**Recipe Endpoints** (`/api/recipes`)
- `POST /api/recipes` - Create a new recipe (with steps and ingredients)
- `GET /api/recipes` - Get all active recipes
- `GET /api/recipes/{id}` - Get recipe by ID
- `PUT /api/recipes/{id}` - Update a recipe (full replacement; see below)
- `DELETE /api/recipes/{id}` - Soft delete a recipe
- `POST /api/recipes/bulk-delete` - Soft delete several recipes: body `{"ids": [1, 2]}` (1-100 ids), returns
  `{"deletedIds": [...]}`. All or nothing; unknown, already-deleted and repeated ids are skipped
- `POST /api/recipes/{id}/restore` - Restore a soft-deleted recipe
- `PUT /api/recipes/meal-plan-exclusion` - Exclude recipes from meal plans or include them again: body
  `{"ids": [1, 2], "excluded": true}` (1-100 ids), returns `{"updatedIds": [...]}` (the recipes now set that way, in
  request order; unknown, deleted and repeated ids are skipped). Recipes return the setting as `excludedFromMealPlans`;
  `POST`/`PUT /api/recipes` ignore it, so editing a recipe never changes it
- `GET /api/recipes/search?title={title}` - Search recipes by title
- `GET /api/recipes/category/{category}` - Get recipes by category
- `GET /api/recipes/filter/prep-time?maxMinutes={minutes}` - Filter by max prep time
- `GET /api/recipes/filter/total-time?maxMinutes={minutes}` - Filter by max total time
- `GET /api/recipes/count` - Count active recipes

**API Design Notes**
- Steps and ingredients are embedded within Recipe payloads (no separate endpoints)
- All create/update operations on steps and ingredients happen through the Recipe endpoint
- This simplified design reflects that steps and ingredients don't exist independently of recipes

**Updating a recipe (`PUT /api/recipes/{id}`)** - `RecipeService.updateRecipe(Long, RecipeDTO)`
- The body replaces the recipe's contents; send the whole recipe (last save wins, no version check)
- Steps and ingredients are matched by `id`: with a matching id -> updated in place; no id -> added;
  existing ones missing from the body -> deleted (orphanRemoval, not soft delete)
- Steps are renumbered 1..N in `stepOrder` order (Alexa looks steps up by number)
- `sourceUrl` is set on create and never changed by an update
- Errors: 404 unknown/inactive recipe (`RecipeNotFoundException`); 400 invalid fields, including
  nested ones such as `ingredients[0].name`; 422 a step/ingredient id that isn't this recipe's or is repeated

**Meal Plan Endpoints** (`/api/meal-plans`) - `MealPlanService`
- `POST /api/meal-plans` - Save a meal plan; returns 201 with the saved plan. Body:
  `{"name": "Week of Jun 1", "startDate": "2026-06-01", "days": 7, "mealTypes": ["BREAKFAST", "DINNER"],
  "entries": [{"date": "2026-06-01", "mealType": "BREAKFAST", "recipeId": 12}]}`. `name` is optional;
  meals the user left empty are simply not in `entries`
- `GET /api/meal-plans` - List active meal plans, latest start date first, as summaries without recipes:
  `{id, name, startDate, endDate, days, mealTypes, mealCount, createdAt, updatedAt}`
- `GET /api/meal-plans/{id}` - Get a meal plan
- `PUT /api/meal-plans/{id}` - Update a meal plan (full replacement, same body as POST; see below)
- `DELETE /api/meal-plans/{id}` - Soft delete a meal plan; 204, also for unknown or already deleted ids
- `GET /api/meal-plans/meals?from=2026-11-16&to=2026-11-29` - The meals planned in that date range (inclusive)
  in active plans, by date then meal: `[{date, mealType, recipeId, recipeTitle, mealPlanId, mealPlanName,
  mealPlanStartDate, mealPlanDays}]`. Compares meals by date, so a plan only partly in the range adds just the
  meals inside it. Used by the planner's "Avoid recent recipes". 400 if `from`/`to` is missing or not a date,
  `from` is after `to`, or the range is over 366 days (`InvalidDateRangeException`)
- Response: the plan with a calculated `endDate`, `mealTypes` in display order (Breakfast, Lunch, Snack,
  Dinner), and `entries` by date then meal, each with a recipe summary
  `{id, title, totalTimeMinutes, servings, deleted}`. `deleted` is true for a recipe soft-deleted after
  the plan was saved: the plan keeps it
- Rules (422, `IllegalArgumentException`): each entry's date is within the plan's days, its meal type is
  one of `mealTypes`, at most one entry per date and meal, and every recipe exists and isn't deleted.
  A recipe doesn't have to be in the meal's category (users can choose any recipe). Past start dates
  and overlapping plans are allowed
- Errors: 400 invalid fields (`days` not 1-7, no `startDate`, no `mealTypes` or `entries`, name over 100
  characters, `entries[0].recipeId` missing); 404 unknown/inactive plan (`MealPlanNotFoundException`)
- Updating (`MealPlanService.updateMealPlan`): the body replaces the plan's name, dates, meal types and
  entries. Entries are matched by date and meal type: same recipe -> left alone; different recipe ->
  updated in place; not in the body -> deleted (orphanRemoval); new -> added. Updating in place matters:
  Hibernate inserts before it deletes, so delete-then-insert for the same meal would hit the unique
  constraint. The dates may change too (moving the plan, e.g. a week later): overlapping dates are updated in
  place the same way. Recipes already in the plan may stay, in any meal, even if deleted since (so older plans
  stay editable and movable); recipes new to the plan must be active
- The plan is generated in the browser (front-end `mealPlan.js`); the server only validates and stores it

**Missing query parameters** - a required parameter that isn't there (e.g. `?title=` on search, `?from=` on
planned meals) is a 400 `{"error": "Missing parameter: from"}`

**Request bodies** - a body that isn't JSON, or a value of the wrong type (an unknown enum like a unit or
meal type, a date not in `YYYY-MM-DD`), is a 400 `{"error": "Invalid value for entries[0].date"}`
(`GlobalExceptionHandler`), or "Request body is missing or is not valid JSON" when no field is known

### Technology Stack
The project is set up with these Spring Boot starters:
- `spring-boot-starter-data-jpa` - Database access layer
- `spring-boot-starter-validation` - Bean validation (JSR-303)
- `spring-boot-starter-webmvc` - REST API and web layer

### Testing
Test dependencies include JPA, validation, and web MVC test starters. The project uses JUnit 5 (Jupiter) for testing.
