package com.recipehome.api.service;


import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.stereotype.Service;

import java.io.IOException;

@Service
public class RecipeJsonFetcherService {

    private final ObjectMapper objectMapper;

    public RecipeJsonFetcherService() {
        this.objectMapper = new ObjectMapper();
    }

    /**
     * Fetches the web page at the given URL and extracts the Schema.org Recipe JSON node.
     *
     * @param url The recipe URL to scrape.
     * @return JsonNode containing raw Schema.org recipe data.
     * @throws IOException if network request fails or no valid recipe JSON is found.
     */
    public JsonNode fetchRecipeJson(String url) throws IOException {
        // 1. Fetch HTML (setting a browser User-Agent prevents basic bot blocks)
        Document doc = Jsoup.connect(url)
                .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                .timeout(6000)
                .get();

        // 2. Query all <script type="application/ld+json"> blocks
        Elements scriptElements = doc.select("script[type=application/ld+json]");

        for (Element script : scriptElements) {
            String jsonContent = script.html().trim();
            if (jsonContent.isEmpty()) {
                continue;
            }

            try {
                JsonNode rootNode = objectMapper.readTree(jsonContent);
                JsonNode recipeNode = findRecipeNode(rootNode);

                if (recipeNode != null) {
                    return recipeNode; // Found it!
                }
            } catch (Exception e) {
                // Ignore malformed script blocks and check the remaining ones
            }
        }

        throw new IllegalArgumentException("No Schema.org Recipe JSON found at URL: " + url);
    }

    /**
     * Traverses different common JSON-LD structures (Direct object, Array, or @graph format).
     */
    public JsonNode findRecipeNode(JsonNode node) {
        if (node == null || node.isNull()) {
            return null;
        }

        // Case A: The JSON uses a top-level "@graph" array (very common in WordPress/Yoast SEO)
        if (node.has("@graph") && node.get("@graph").isArray()) {
            for (JsonNode item : node.get("@graph")) {
                if (isRecipeType(item)) {
                    return item;
                }
            }
        }

        // Case B: The script tag contains a top-level JSON array [...]
        if (node.isArray()) {
            for (JsonNode item : node) {
                if (isRecipeType(item)) {
                    return item;
                }
            }
        }

        // Case C: The script tag is a single direct JSON object {...}
        if (isRecipeType(node)) {
            return node;
        }

        return null;
    }

    /**
     * Checks if a JsonNode's "@type" field contains "Recipe".
     */
    private boolean isRecipeType(JsonNode node) {
        if (!node.has("@type")) {
            return false;
        }

        JsonNode typeNode = node.get("@type");

        // "@type": "Recipe"
        if (typeNode.isTextual()) {
            return "Recipe".equalsIgnoreCase(typeNode.asText());
        }

        // "@type": ["Recipe", "NewsArticle"]
        if (typeNode.isArray()) {
            for (JsonNode t : typeNode) {
                if (t.isTextual() && "Recipe".equalsIgnoreCase(t.asText())) {
                    return true;
                }
            }
        }

        return false;
    }
}
