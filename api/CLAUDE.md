# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RecipeHome is a Spring Boot 4.0.0 application designed to help users easily store and manage their recipes. The long-term vision includes integration with voice assistants (Alexa and Google Home) to provide hands-free, step-by-step cooking guidance while users are actively cooking.

The project uses:
- Java 25
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
  - `entity/` - JPA entity classes (Recipe, Step, Ingredient, BaseEntity)
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

**Recipe Endpoints** (`/api/recipes`)
- `POST /api/recipes` - Create a new recipe (with steps and ingredients)
- `GET /api/recipes` - Get all active recipes
- `GET /api/recipes/{id}` - Get recipe by ID
- `PUT /api/recipes/{id}` - Update a recipe
- `DELETE /api/recipes/{id}` - Soft delete a recipe
- `POST /api/recipes/{id}/restore` - Restore a soft-deleted recipe
- `GET /api/recipes/search?title={title}` - Search recipes by title
- `GET /api/recipes/category/{category}` - Get recipes by category
- `GET /api/recipes/filter/prep-time?maxMinutes={minutes}` - Filter by max prep time
- `GET /api/recipes/filter/total-time?maxMinutes={minutes}` - Filter by max total time
- `GET /api/recipes/count` - Count active recipes

**API Design Notes**
- Steps and ingredients are embedded within Recipe payloads (no separate endpoints)
- All create/update operations on steps and ingredients happen through the Recipe endpoint
- This simplified design reflects that steps and ingredients don't exist independently of recipes

### Technology Stack
The project is set up with these Spring Boot starters:
- `spring-boot-starter-data-jpa` - Database access layer
- `spring-boot-starter-validation` - Bean validation (JSR-303)
- `spring-boot-starter-webmvc` - REST API and web layer

### Testing
Test dependencies include JPA, validation, and web MVC test starters. The project uses JUnit 5 (Jupiter) for testing.
