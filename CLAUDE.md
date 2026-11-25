# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RecipeHome is a recipe management application designed to help users easily store and manage their recipes. The long-term vision includes integration with voice assistants (Alexa and Google Home) to provide hands-free, step-by-step cooking guidance while users are actively cooking.

## Repository Structure

This is a monorepo with the following structure:
- `api/` - Spring Boot backend application (Java 25)
- `front-end/` - React frontend application (Vite + React)

The main application code is in the `api/` directory with base package `com.recipehome.api`. Navigate to `api/CLAUDE.md` for detailed backend development instructions.

## Development Commands

### Backend (API)

All Maven commands must be run from the `api/` directory:

#### Running the Backend
```bash
cd api
./mvnw spring-boot:run
```

On Windows:
```bash
cd api
mvnw.cmd spring-boot:run
```

### Building the Project
```bash
cd api
./mvnw clean package
```

### Running Tests
```bash
cd api
# Run all tests
./mvnw test

# Run a specific test class
./mvnw test -Dtest=RecipeHomeApplicationTests

# Run a specific test method
./mvnw test -Dtest=RecipeHomeApplicationTests#contextLoads
```

### Frontend

All npm commands must be run from the `front-end/` directory:

#### First-Time Setup
Requires Node.js 22.13 or newer (`front-end/.nvmrc`; run `nvm use` if you use nvm).
```bash
cd front-end
npm install
```

#### Running the Frontend
```bash
cd front-end
npm run dev
```

The frontend will run on `http://localhost:3000` and proxy API requests to the backend at `http://localhost:8080`.

**Important:** Make sure the backend is running before starting the frontend.

#### Building for Production
```bash
cd front-end
npm run build
```

#### Preview Production Build
```bash
cd front-end
npm run preview
```

#### Running Tests
```bash
cd front-end
npm test                # run all tests once with coverage; fails if line coverage < 80%
npm run test:watch      # re-run tests on file changes while developing (no coverage)
```

`npm test` writes an HTML report to `front-end/test_reports/index.html` (gitignored): a single self-contained file you can open directly in a browser, showing the test results with a Coverage tab. The coverage files it uses live in `test_reports/coverage/` (also viewable on their own via `coverage/index.html`, and `lcov.info` for tools).

To run a single test file, use `npx vitest run src/services/api.test.js` (or `test:watch`). `npm test -- <file>` also works, but fails the 80% check because coverage is measured across the whole app.

### Running the Full Stack

To run both backend and frontend together:

1. **Terminal 1 - Start the backend:**
   ```bash
   cd api
   mvnw.cmd spring-boot:run
   ```

2. **Terminal 2 - Start the frontend:**
   ```bash
   cd front-end
   npm run dev
   ```

3. **Access the application:**
   - Frontend: `http://localhost:3000`
   - Backend API: `http://localhost:8080/api`

## Frontend Architecture (front-end/)

### Technology Stack
- React 19
- Vite (build tool and dev server)
- JavaScript (ES6+)
- Vitest + React Testing Library (unit tests, jsdom environment)

### Project Structure
- `src/` - Source code
  - `services/api.js` - API client for backend communication
  - `App.jsx` - Main application component
  - `App.css` - Application styles
  - `main.jsx` - Application entry point

### API Integration
The frontend communicates with the Spring Boot backend via the API service layer (`src/services/api.js`). The Vite dev server is configured to proxy requests starting with `/api` to `http://localhost:8080`.

### Login
Every page except `/login` and `/register` needs a login. `App` wraps the routes in `AuthProvider` (`src/auth/`), and the logged-in pages sit under the `RequireAuth` layout route, which redirects visitors to `/login` (remembering the page in router state as `from`, so they return there after logging in) and shows "Signed in as …" with "Log out" above every page.
- `LoginPage` (email, password) and `RegisterPage` (first and last name, email, date of birth, password and a confirmation) link to each other. Both log the user in and go on to `from` or `/`. Register checks the fields in the browser first (`validateAccount` in `accountRules.js`: 8-72 character password, date of birth before today) and shows the server's field errors next to the fields.
- The session `{ token, expiresAt, user }` is kept in localStorage as `recipehome.session` (`getSession`/`saveSession`/`clearSession` in `api.js`), so a refresh or a new tab stays logged in until the token expires. Every API call goes through `apiFetch`, which adds `Authorization: Bearer <token>`. A 401 clears the session and fires `recipehome:session-expired`, and `AuthProvider` then logs out (back to the login page). On start `AuthProvider` refreshes the user from `GET /api/auth/me`.
- `/account` (`AccountPage`, linked as "My account" from the top bar) edits the user's names, email and date of birth (`PUT /api/auth/me`, then "Your details were saved." and `updateUser` refreshes the session) and changes the password (current password, new one twice; `PUT /api/auth/me/password`, then "Your password was changed." and the fields empty). Each form shows its own errors; a wrong current password appears next to that field. The checks are `validateProfile` / `validatePasswordChange` in `accountRules.js`, and the account forms share `FormField`.
- Use `useAuth()` (`authContext.js`) for `{ user, login, register, logout, updateUser }`. Tests render pages with a stand-in context via `src/test/renderWithAuth.jsx`.

### Recipe Search
Search on the recipe list filters in the browser: `GET /api/recipes` already returns every recipe with its categories, ingredients and times, so no search endpoint is called. The rules are in `src/components/recipeFilters.js`; the UI is `RecipeSearch.jsx`. The search box needs every word to appear somewhere in the recipe (title, description, categories, ingredient names, equipment); the Filters panel adds category and ingredient "contains" filters and "at most N minutes" for prep/cook/total; everything is combined with AND and ignores case and accents. When a card matches only through something it doesn't show (ingredients, equipment), it gets a "Matches ingredient: …" note. Select mode works on the filtered results only. The search bar and the Select button are always shown, also while the recipes load (typed filters apply once they arrive); Select is disabled while there are no cards to select (loading, failed to load, no recipes, or no matches). The Filters panel also has "Only recipes excluded from meal plans" (`excludedOnly`, a boolean in the filters).

### Meal Planning
"Plan Meals" on the Meal Plans page (`/meal-plans`) opens `MealPlanSetupModal`: pick meals (Breakfast, Lunch, Snack, Dinner), 1-7 days and a start date. The page loads the recipes in the background when it opens; if the dialog is opened sooner it says "Loading recipes..." (with Retry if they fail) and shows the form once they arrive. Generate builds a draft in the browser from the recipes already loaded (`generatePlan` in `src/components/mealPlan.js`) and opens it at `/meal-plan/new` (`NewMealPlan`) in the router state; nothing is saved until "Save plan" (`POST /api/meal-plans`), which then shows the saved plan at `/meal-plans/:id` (`MealPlanView`).
- Pages: `/meal-plans` (`MealPlanList`, linked as "Meal Plans" from the recipe list) has "Plan Meals" and lists the saved plans, latest start date first, marked Upcoming/Current/Past; `/meal-plans/:id` (`MealPlanView`) shows one, with "Edit Plan" (edits in place, like RecipeDetail; `PUT /api/meal-plans/:id`, then "Changes saved.") and "Delete Plan" (asks, soft deletes, then the list says "“…” was deleted.").
- `MealPlanEditor` is the editing UI shared by the new and saved plan pages (like `RecipeEditor`): name, start date, grid, slot actions, Save/Cancel, and the discard dialog. Changing the start date moves the whole plan (`moveToStartDate`): each day's meals keep their day, and an automatic name ("Week of Nov 23") follows the new dates while a chosen name is kept. The date field keeps its text as the browser reports it while typing and the plan follows each complete date. A new plan always asks before discarding; an edit asks only if something changed. For a saved plan it gets the entries' recipe summaries (`knownRecipes`), so a recipe deleted since shows as "Old Tacos (no longer available)". `planFromSaved` turns a saved plan into a draft. Both pages draw the grid with `MealPlanGrid`.
- A meal draws from recipes whose categories include its name (whole category, ignoring case and accents). Each meal's recipes are shuffled and dealt one per day, so a recipe doesn't repeat within a meal until all have been used, and dealing avoids the same recipe twice in a day. A meal with no recipes gets empty slots (and can't be ticked in the dialog).
- In the editor each slot can be swapped for another random recipe (`pickRandomRecipe`), chosen with `RecipePickerDialog` (the meal's recipes, or any recipe with "Show all recipes"), or removed; empty slots can be filled again. On `/meal-plan/new` every edit is written back to the router state, so a refresh keeps the draft (editing a saved plan keeps changes in component state only). Cancel and "Back to Meal Plans" ask before discarding (then return to `/meal-plans`); the browser's Back button does not (`useBlocker` needs a data router, and the app uses `<BrowserRouter>`).
- "Avoid recent recipes" in the dialog (Don't avoid / previous 1, 2 or 4 weeks; remembered in localStorage as `recipehome.mealPlan.avoidDays`) looks at the days just before the start date (`avoidWindow`, e.g. 2 weeks before Nov 30 = Nov 16 - Nov 29) and fetches the meals planned in that period from every saved plan (`GET /api/meal-plans/meals`). It's a preference across all meals, not a hard rule: each meal's deck deals recipes not planned in the period first, then the recent ones least recently planned first, so no slot is left empty. The dialog shows what will be avoided and warns per meal when some recipes will be reused (`shortfalls`); Generate waits for the check (with Retry if it fails). The draft keeps `avoid: { from, to, lastPlanned }`: the review page says "Avoiding recipes planned Nov 16 – Nov 29", marks reused recipes "Also planned Nov 16" (also in the picker), and Swap/Random prefer recipes not planned then. Editing a saved plan doesn't avoid (the setting isn't stored).
- "Use up ingredients" in the dialog (up to 4 rows, e.g. chicken in 2 Dinner): a row matches recipes for that meal with an ingredient whose name contains the text (ignoring case and accents). The dialog lists the matching ingredient names with recipe counts so the user can untick ones they don't mean (e.g. "chicken stock"; stored as `excluded`), and says how many recipes qualify or warns when too few do. A row's meal is limited to the chosen meals and its count to the number of days. Generating places those meals first, on the earliest days, each a different recipe (not-recently-planned ones first; recent ones rather than none), then deals the rest as usual without repeating them. The review page shows a checklist ("Chicken: 2 of 2 dinners ✓", via `ingredientChecklist`) and "Uses chicken" badges (also in the picker), and Swap on such a slot keeps the ingredient when another recipe has it. Other meals of that type are still random, so they may happen to use the ingredient too. Saved plans don't store the requests.
- Recipes can be excluded from meal plans (`excludedFromMealPlans` on each recipe from `GET /api/recipes`): "Exclude from meal plans" / "Include in meal plans" on the recipe page (saved straight away), or for a selection in Select mode on the recipe list (`PUT /api/recipes/meal-plan-exclusion`). Their cards are tagged "Not in meal plans". `recipesForMeal` leaves them out, so generating, Swap/Random, use-up ingredients and the dialog's counts never use them; the dialog notes how many are excluded. The picker hides them unless "Show all recipes" is ticked (then they're tagged and can still be chosen deliberately), and a saved plan that already has one keeps it, tagged "Excluded from meal plans" when editing.
- The draft is plain data: `{ name, startDate, days, mealTypes, slots: { 'YYYY-MM-DD|LUNCH': recipeId | null }, avoid, useUp }`. Dates are `YYYY-MM-DD` strings in the local calendar; build them with `parseDate`/`toDateString`, never `new Date('YYYY-MM-DD')` (that is midnight UTC, the previous day in the Americas).

### Testing
- Vitest is configured in the `test` block of `vite.config.js`; coverage uses the V8 provider with an 80% line threshold (`src/main.jsx` is excluded).
- Reporters: `default` (terminal) plus `html` from `@vitest/ui`, written as a single file to `test_reports/index.html`. Coverage is written to `test_reports/coverage/`, the folder the report's Coverage tab reads, so Vitest doesn't make a second copy.
- Tests sit next to the code they cover: `RecipeForm.jsx` -> `RecipeForm.test.jsx`.
- `src/test/setup.js` loads the jest-dom matchers and cleans up after each test.
- `src/test/renderWithRouter.jsx` renders a page inside a `MemoryRouter` (with optional router state) and exposes the current path via `data-testid="location"`.
- `src/test/fixtures/` holds sample API payloads (units, imported and saved recipes, meal-planning recipes, draft and saved meal plans).
- Component tests mock the API layer with `vi.mock('../services/api')`; `api.test.js` tests the API layer itself against a stubbed `fetch`.
- `testTimeout` is 15s (Vitest's default is 5s): form tests that type through user-event take 3-5s under `npm test`.
- The environment is jsdom rather than happy-dom: happy-dom wrongly rejects `<input type="number" step="0.01">` values, which breaks RecipeForm's form validation.

## Backend Architecture (api/)

### Technology Stack
- Java 25
- Spring Boot 4.0.0
- PostgreSQL database
- Spring Data JPA for persistence
- Bean Validation (Jakarta Validation)
- Spring Web MVC for REST API

### Entity Model

The domain model uses a soft-delete pattern with audit timestamps:

**BaseEntity** (`api/src/main/java/com/recipehome/api/entity/BaseEntity.java`)
- All entities extend this class
- Provides: `id`, `createdAt`, `updatedAt`, `isActive`
- JPA auditing enabled via `@EnableJpaAuditing` in main application class
- Soft delete methods: `softDelete()` and `restore()` toggle `isActive` flag

**User** (table `users`) - `email` (unique, stored trimmed and lower-cased), `passwordHash` (BCrypt), `firstName`, `lastName`, `dateOfBirth`. Recipes and meal plans are not linked to users yet: every logged-in user sees the same data.

**Recipe** → **Step** and **Ingredient** (One-to-Many bidirectional)
- Recipe has `steps` (ordered by `stepOrder`) and `ingredients`
- Both Step and Ingredient have `@ManyToOne` back-reference to Recipe
- `CascadeType.ALL` and `orphanRemoval = true` on Recipe side
- Use helper methods on Recipe: `addStep()`, `removeStep()`, `addIngredient()`, `removeIngredient()` to maintain bidirectional consistency

**Recipe.excludedFromMealPlans** - never chosen automatically for meal plans (column `excluded_from_meal_plans`,
`DEFAULT false NOT NULL`, so `ddl-auto=update` can add it to a database that already has recipes). Set only through
`PUT /api/recipes/meal-plan-exclusion`; creating or updating a recipe ignores it, so an edit can't clear it.

**Recipe Collections**
- `equipment` - List of strings stored in `recipe_equipment` table via `@ElementCollection`
- `categories` - Set of strings stored in `recipe_categories` table via `@ElementCollection`

**MealPlan** → **MealPlanEntry** (One-to-Many bidirectional) → **Recipe** (Many-to-One)
- MealPlan has `name` (optional), `startDate`, `days` (1-7), and `mealTypes` (Set of the `MealType` enum: BREAKFAST, LUNCH, SNACK, DINNER, in `meal_plan_meal_types`)
- Each MealPlanEntry puts one recipe in one day's meal; unique per plan, date and meal type. Days of a meal type can have no entry (the user removed it)
- Use `MealPlan.addEntry()` / `removeEntry()`; entries point to Recipe, but Recipe has no link back

### Layered Architecture

The application follows a three-tier architecture:

**Repositories** (`api/src/main/java/com/recipehome/api/repository/`)
- `RecipeRepository`, `StepRepository`, `IngredientRepository`, `MealPlanRepository`
- Extend Spring Data JPA's `JpaRepository`
- All queries filter by `isActive = true` to respect soft deletes
- Provide domain-specific query methods (search by title, category, time, etc.)

**Services** (`api/src/main/java/com/recipehome/api/service/`)
- Service interfaces define business operations
- Implementations in `service/impl/` package
- Use `@Transactional` for transaction management
- Handle CRUD, soft delete/restore, and relationship management
- StepService and IngredientService use Recipe helper methods to maintain bidirectional relationships

**REST API** (`api/src/main/java/com/recipehome/api/controller/`)
- `RecipeController` exposes `/api/recipes` endpoints
- `MealPlanController` exposes `/api/meal-plans` (list, create, get, update and delete meal plans)
- `AuthController` exposes `/api/auth` (register, login, get and edit me, change password). Every other `/api` endpoint needs a login token (`SecurityConfig`)
- Steps and ingredients are embedded in Recipe payloads (no separate endpoints)
- All recipe operations handled through a single unified endpoint
- See `api/CLAUDE.md` for complete API endpoint documentation

### Key Implementation Patterns

1. **Bidirectional Relationships**: Always use helper methods (`addStep()`, `addIngredient()`) to maintain both sides of the relationship when adding/removing child entities. Service layer implementations use these methods.

2. **Soft Deletes**: Entities are not physically deleted. Use `softDelete()` method on any entity extending BaseEntity. All repository queries filter by `isActive = true`.

3. **Lazy Loading**: Step and Ingredient use `FetchType.LAZY` for the Recipe relationship. Be aware of potential LazyInitializationException outside transaction boundaries.

4. **Validation**: Entities use Jakarta Bean Validation annotations (`@NotBlank`, `@NotNull`, `@Positive`). These are validated automatically by Spring on controller inputs.

5. **Transaction Management**: Services use `@Transactional` annotation. Read-only operations use `@Transactional(readOnly = true)` for optimization.

### Database Configuration

Database credentials are managed via a `.env` file (not committed to git):

1. Copy `api/.env.example` to `api/.env`
2. Edit `api/.env` with your PostgreSQL credentials
3. The application loads these via the `spring-dotenv` library

Environment variables:
- `DB_HOST`, `DB_PORT`, `DB_NAME` - Connection details
- `DB_USERNAME`, `DB_PASSWORD` - Credentials
- `HIBERNATE_DDL_AUTO` - Schema management (update/validate/etc.)
- `SEED_DATA` - Load the 86 sample recipes into an empty database at startup (default: true)
- `JWT_SECRET` - Signs login tokens; at least 32 characters. If it is not set, a random key is used, so everyone is logged out when the server restarts (fine for development; set it everywhere else)
- `JWT_EXPIRATION` - How long a login lasts (default: `7d`)

See `api/CLAUDE.md` for detailed setup instructions.
