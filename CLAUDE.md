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

### Recipe Search
Search on the recipe list filters in the browser: `GET /api/recipes` already returns every recipe with its categories, ingredients and times, so no search endpoint is called. The rules are in `src/components/recipeSearch.js`; the UI is `RecipeSearch.jsx`. The search box needs every word to appear somewhere in the recipe (title, description, categories, ingredient names, equipment); the Filters panel adds category and ingredient "contains" filters and "at most N minutes" for prep/cook/total; everything is combined with AND and ignores case and accents. When a card matches only through something it doesn't show (ingredients, equipment), it gets a "Matches ingredient: …" note. Select mode works on the filtered results only.

### Testing
- Vitest is configured in the `test` block of `vite.config.js`; coverage uses the V8 provider with an 80% line threshold (`src/main.jsx` is excluded).
- Reporters: `default` (terminal) plus `html` from `@vitest/ui`, written as a single file to `test_reports/index.html`. Coverage is written to `test_reports/coverage/`, the folder the report's Coverage tab reads, so Vitest doesn't make a second copy.
- Tests sit next to the code they cover: `RecipeForm.jsx` -> `RecipeForm.test.jsx`.
- `src/test/setup.js` loads the jest-dom matchers and cleans up after each test.
- `src/test/renderWithRouter.jsx` renders a page inside a `MemoryRouter` (with optional router state) and exposes the current path via `data-testid="location"`.
- `src/test/fixtures/` holds sample API payloads (units, imported and saved recipes).
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

**Recipe** → **Step** and **Ingredient** (One-to-Many bidirectional)
- Recipe has `steps` (ordered by `stepOrder`) and `ingredients`
- Both Step and Ingredient have `@ManyToOne` back-reference to Recipe
- `CascadeType.ALL` and `orphanRemoval = true` on Recipe side
- Use helper methods on Recipe: `addStep()`, `removeStep()`, `addIngredient()`, `removeIngredient()` to maintain bidirectional consistency

**Recipe Collections**
- `equipment` - List of strings stored in `recipe_equipment` table via `@ElementCollection`
- `categories` - Set of strings stored in `recipe_categories` table via `@ElementCollection`

### Layered Architecture

The application follows a three-tier architecture:

**Repositories** (`api/src/main/java/com/recipehome/api/repository/`)
- `RecipeRepository`, `StepRepository`, `IngredientRepository`
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
- `SEED_DATA` - Load the 20 sample recipes into an empty database at startup (default: true)

See `api/CLAUDE.md` for detailed setup instructions.
