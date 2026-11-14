package com.recipehome.api.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Tests {@link RecipeJsonFetcherService} against pages served from a local
 * HTTP server, so the real fetch + parse path runs without internet access.
 */
class RecipeJsonFetcherServiceTest {

    private final RecipeJsonFetcherService fetcherService = new RecipeJsonFetcherService();

    private HttpServer server;

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(
                new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
        server.start();
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    @Test
    void fetchRecipeJson_ShouldFindRecipeInsideGraph() throws Exception {
        // WordPress / Yoast SEO style: one script with an @graph of many nodes
        String url = serve("/graph", 200, page("""
                {
                  "@context": "https://schema.org",
                  "@graph": [
                    { "@type": "WebPage", "name": "Burrito Bowls - Damn Delicious" },
                    { "@type": "Organization", "name": "Damn Delicious" },
                    {
                      "@type": "Recipe",
                      "name": "Instant Pot Chicken Burrito Bowls",
                      "recipeIngredient": [
                        "1 (15-ounce) can corn kernels (drained)",
                        "1 (4.5-ounce) can chopped green chiles"
                      ]
                    }
                  ]
                }
                """));

        JsonNode recipe = fetcherService.fetchRecipeJson(url);

        assertThat(recipe.get("name").asText()).isEqualTo("Instant Pot Chicken Burrito Bowls");
        assertThat(recipe.get("recipeIngredient")).hasSize(2);
    }

    @Test
    void fetchRecipeJson_ShouldFindRecipeInTopLevelArray() throws Exception {
        String url = serve("/array", 200, page("""
                [
                  { "@type": "BreadcrumbList", "name": "Breadcrumbs" },
                  { "@type": "Recipe", "name": "Grilled BBQ Chicken" }
                ]
                """));

        JsonNode recipe = fetcherService.fetchRecipeJson(url);

        assertThat(recipe.get("name").asText()).isEqualTo("Grilled BBQ Chicken");
    }

    @Test
    void fetchRecipeJson_ShouldFindDirectRecipeObjectWithTypeArray() throws Exception {
        String url = serve("/direct", 200, page("""
                { "@type": ["Recipe", "NewsArticle"], "name": "Chocolate Chip Cookies" }
                """));

        JsonNode recipe = fetcherService.fetchRecipeJson(url);

        assertThat(recipe.get("name").asText()).isEqualTo("Chocolate Chip Cookies");
    }

    @Test
    void fetchRecipeJson_ShouldSkipMalformedAndNonRecipeBlocks() throws Exception {
        String url = serve("/mixed", 200, page(
                "{ this is not valid json",
                "",
                """
                { "@type": "Organization", "name": "Some Site" }
                """,
                """
                { "@type": "Recipe", "name": "Spaghetti Carbonara" }
                """));

        JsonNode recipe = fetcherService.fetchRecipeJson(url);

        assertThat(recipe.get("name").asText()).isEqualTo("Spaghetti Carbonara");
    }

    @Test
    void fetchRecipeJson_ShouldThrowIllegalArgument_WhenPageHasNoRecipe() {
        String url = serve("/no-recipe", 200, page("""
                { "@type": "WebPage", "name": "About Us" }
                """));

        assertThatThrownBy(() -> fetcherService.fetchRecipeJson(url))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("No Schema.org Recipe JSON found at URL: " + url);
    }

    @Test
    void fetchRecipeJson_ShouldThrowIOException_WhenPageNotFound() {
        String url = serve("/missing", 404, "<html><body>Not Found</body></html>");

        assertThatThrownBy(() -> fetcherService.fetchRecipeJson(url))
                .isInstanceOf(IOException.class);
    }

    /**
     * Hits a real recipe site. Skipped by default; run with
     * RECIPEHOME_LIVE_TESTS=true to check scraping still works against the live page.
     */
    @Test
    @EnabledIfEnvironmentVariable(named = "RECIPEHOME_LIVE_TESTS", matches = "true")
    void fetchRecipeJson_Live_OnceUponAChef() throws Exception {
        JsonNode recipe = fetcherService.fetchRecipeJson(
                "https://www.onceuponachef.com/recipes/bbq-chicken.html#tabrecipe");

        assertThat(recipe).isNotNull();
        assertThat(recipe.has("name")).isTrue();
    }

    // --- helpers ---

    /** Serves {@code body} as text/html at {@code path} and returns its full URL. */
    private String serve(String path, int status, String body) {
        server.createContext(path, exchange -> {
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "text/html; charset=utf-8");
            exchange.sendResponseHeaders(status, bytes.length);
            try (OutputStream out = exchange.getResponseBody()) {
                out.write(bytes);
            }
        });
        return "http://127.0.0.1:" + server.getAddress().getPort() + path;
    }

    /** Builds an HTML page with one ld+json script block per argument. */
    private static String page(String... jsonLdBlocks) {
        StringBuilder html = new StringBuilder("<html><head><title>Recipe</title>");
        for (String block : jsonLdBlocks) {
            html.append("<script type=\"application/ld+json\">")
                    .append(block)
                    .append("</script>");
        }
        return html.append("</head><body><h1>Recipe</h1></body></html>").toString();
    }
}
