package com.recipehome.api;

import com.recipehome.api.repository.RecipeRepository;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The Flyway migrations on a real PostgreSQL (Docker; skipped without it). Startup runs them on an empty database,
 * Hibernate then validates every entity against the tables (ddl-auto=validate) and the seeder fills them, so an
 * entity change without a matching migration fails here. The other H2 tests build their schema from the entities.
 */
@SpringBootTest(properties = {
        "spring.jpa.hibernate.ddl-auto=validate",
        "spring.flyway.enabled=true",
        "recipehome.seed.enabled=true",
        "recipehome.seed.top-up=false",
})
@Testcontainers(disabledWithoutDocker = true)
class MigrationsTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:15-alpine");

    @Autowired private Flyway flyway;
    @Autowired private RecipeRepository recipeRepository;

    @Test
    void anEmptyDatabaseGetsEveryMigration_andTheEntitiesMatchIt() {
        List<String> applied = Arrays.stream(flyway.info().applied()).map(m -> m.getVersion().getVersion()).toList();
        assertThat(applied).containsExactly("1", "2", "3");
        assertThat(flyway.info().pending()).isEmpty();
        assertThat(recipeRepository.count()).isEqualTo(86);   // the seeder could save into the migrated schema
    }

    @Test
    void v3AddsTheLookupIndexes() throws Exception {
        assertThat(query("public", "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx\\_%'"))
                .containsExactlyInAnyOrder("idx_steps_recipe", "idx_ingredients_recipe", "idx_recipe_categories_recipe",
                        "idx_recipe_equipment_recipe", "idx_recipes_created_by", "idx_meal_plans_created_by_start",
                        "idx_meal_plan_entries_date", "idx_family_members_family", "idx_shopping_list_items_list",
                        "idx_shopping_list_left_out_list");
    }

    @Test
    void aDatabaseBuiltBeforeFlywayIsBaselinedAtV1_andAlignedByV2() throws Exception {
        // An older database, as Hibernate's ddl-auto=update left it: the V1 tables, plus the old exclusion column
        // and hashed unique constraint names, and no Flyway history. Built in its own schema.
        Flyway build = flyway("legacy").target("1").load();
        build.migrate();
        sql("legacy",
                "ALTER TABLE recipes ADD COLUMN excluded_from_meal_plans boolean DEFAULT false NOT NULL",
                "ALTER TABLE users RENAME CONSTRAINT users_email_key TO uk6dotkott2kjsp8vw4d0m25fb7",
                "ALTER TABLE families RENAME CONSTRAINT families_invite_code_key TO ukpve49daqjq59t6hrm9lxs29ve",
                "ALTER TABLE shopping_lists RENAME CONSTRAINT shopping_lists_meal_plan_id_key TO uk4mm0yti14ydr0h83m599rusb0",
                "DROP TABLE flyway_schema_history");

        Flyway app = flyway("legacy").baselineOnMigrate(true).baselineVersion("1").load();
        app.migrate();

        MigrationInfo[] applied = app.info().applied();
        assertThat(applied).extracting(m -> m.getVersion().getVersion() + " " + m.getType())
                .containsExactly("1 BASELINE", "2 SQL", "3 SQL");
        assertThat(query("legacy", "SELECT column_name FROM information_schema.columns "
                + "WHERE table_schema = 'legacy' AND table_name = 'recipes' AND column_name = 'excluded_from_meal_plans'"))
                .isEmpty();
        assertThat(query("legacy", "SELECT c.conname FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace "
                + "WHERE n.nspname = 'legacy' AND c.contype = 'u' AND c.conname NOT LIKE 'uk\\_%' ORDER BY c.conname"))
                .containsExactly("families_invite_code_key", "shopping_lists_meal_plan_id_key", "users_email_key");
    }

    private static org.flywaydb.core.api.configuration.FluentConfiguration flyway(String schema) {
        return Flyway.configure()
                .dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .schemas(schema)
                .locations("classpath:db/migration");
    }

    private static void sql(String schema, String... statements) throws Exception {
        try (Connection connection = connect(schema); Statement statement = connection.createStatement()) {
            for (String sql : statements) statement.execute(sql);
        }
    }

    private static List<String> query(String schema, String sql) throws Exception {
        List<String> rows = new ArrayList<>();
        try (Connection connection = connect(schema); Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery(sql)) {
            while (result.next()) rows.add(result.getString(1));
        }
        return rows;
    }

    private static Connection connect(String schema) throws Exception {
        Connection connection = DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
        try (Statement statement = connection.createStatement()) {
            statement.execute("SET search_path TO " + schema);
        }
        return connection;
    }
}
