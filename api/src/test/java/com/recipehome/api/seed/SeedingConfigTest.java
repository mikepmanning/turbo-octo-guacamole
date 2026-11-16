package com.recipehome.api.seed;

import org.junit.jupiter.api.Test;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.support.ResourcePropertySource;

import java.io.IOException;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** recipehome.seed.enabled=${SEED_DATA:true} in application.properties. */
class SeedingConfigTest {

    @Test
    void seedsByDefault_whenSeedDataIsNotSet() throws IOException {
        assertThat(seedEnabled(Map.of())).isTrue();
    }

    @Test
    void seedDataFalseTurnsSeedingOff() throws IOException {
        assertThat(seedEnabled(Map.of("SEED_DATA", "false"))).isFalse();
    }

    // Resolves the property from application.properties plus `variables` only, ignoring
    // this machine's real environment variables and system properties.
    private static Boolean seedEnabled(Map<String, Object> variables) throws IOException {
        StandardEnvironment environment = new StandardEnvironment();
        environment.getPropertySources().remove(StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME);
        environment.getPropertySources().remove(StandardEnvironment.SYSTEM_PROPERTIES_PROPERTY_SOURCE_NAME);
        environment.getPropertySources().addLast(new MapPropertySource("variables", variables));
        environment.getPropertySources().addLast(
                new ResourcePropertySource(new ClassPathResource("application.properties")));
        return environment.getProperty("recipehome.seed.enabled", Boolean.class);
    }
}
