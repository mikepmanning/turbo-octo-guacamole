package com.recipehome.api.service;


import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.jsoup.Connection;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.InetAddress;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;
import java.util.function.Predicate;

/**
 * Fetches a recipe page for import. The server fetches whatever address a user types, so it only fetches public web
 * addresses: http(s) only, and a host that resolves to a private, loopback, link-local (cloud metadata) or otherwise
 * internal address is refused, at every redirect too (redirects are followed here, one checked hop at a time).
 */
@Service
public class RecipeJsonFetcherService {

    static final int MAX_REDIRECTS = 5;
    static final String INTERNAL_ADDRESS = "Recipes can't be imported from private or internal addresses";

    private static final String USER_AGENT =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

    private final ObjectMapper objectMapper;
    private final Predicate<InetAddress> allowedAddress;

    @Autowired
    public RecipeJsonFetcherService() {
        this(RecipeJsonFetcherService::isPublic);
    }

    /** With another address rule: tests also allow loopback, to fetch from a local server. */
    RecipeJsonFetcherService(Predicate<InetAddress> allowedAddress) {
        this.objectMapper = new ObjectMapper();
        this.allowedAddress = allowedAddress;
    }

    /** Whether this is a public internet address, not one of a private or reserved network. */
    static boolean isPublic(InetAddress address) {
        if (address.isAnyLocalAddress() || address.isLoopbackAddress() || address.isLinkLocalAddress()
                || address.isSiteLocalAddress() || address.isMulticastAddress()) {
            return false;
        }
        byte[] bytes = address.getAddress();
        if (bytes.length == 4) {
            int first = bytes[0] & 0xff;
            int second = bytes[1] & 0xff;
            return first != 0                                          // 0.0.0.0/8 "this network"
                    && !(first == 100 && (second & 0xc0) == 64)        // 100.64.0.0/10 carrier-grade NAT
                    && !(first == 192 && second == 0 && bytes[2] == 0) // 192.0.0.0/24 protocol assignments
                    && !(first == 198 && (second == 18 || second == 19)) // 198.18.0.0/15 benchmarking
                    && first < 240;                                    // 240.0.0.0/4 reserved, broadcast
        }
        return (bytes[0] & 0xfe) != 0xfc;                              // fc00::/7 unique local
    }

    /** The page at this address, following up to {@link #MAX_REDIRECTS} redirects, each checked first. */
    private Document fetchPage(String url) throws IOException {
        URI target = checkedAddress(url);
        for (int redirects = 0; ; redirects++) {
            Connection.Response response = Jsoup.connect(target.toString())
                    .userAgent(USER_AGENT)   // a browser User-Agent prevents basic bot blocks
                    .timeout(6000)
                    .followRedirects(false)
                    .execute();
            String location = response.header("Location");
            if (response.statusCode() < 300 || response.statusCode() >= 400 || location == null) {
                return response.parse();
            }
            if (redirects == MAX_REDIRECTS) throw new IOException("Too many redirects from " + url);
            target = checkedAddress(target.resolve(location).toString());
        }
    }

    /** The address, if it is an http(s) address whose host only resolves to allowed addresses. */
    private URI checkedAddress(String url) throws IOException {
        URI uri;
        try {
            uri = new URI(url);
        } catch (URISyntaxException e) {
            throw new IllegalArgumentException("Not a valid web address: " + url);
        }
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        if (!scheme.equals("http") && !scheme.equals("https")) {
            throw new IllegalArgumentException("Only http and https addresses can be imported");
        }
        if (uri.getHost() == null) throw new IllegalArgumentException("Not a valid web address: " + url);
        // A host with several addresses is refused if any is internal: the connection may use any of them.
        for (InetAddress address : InetAddress.getAllByName(uri.getHost())) {
            if (!allowedAddress.test(address)) throw new IllegalArgumentException(INTERNAL_ADDRESS);
        }
        return uri;
    }

    /**
     * Fetches the web page at the given URL and extracts the Schema.org Recipe JSON node.
     *
     * @param url The recipe URL to scrape.
     * @return JsonNode containing raw Schema.org recipe data.
     * @throws IOException if network request fails or no valid recipe JSON is found.
     */
    public JsonNode fetchRecipeJson(String url) throws IOException {
        // 1. Fetch HTML (public addresses only)
        Document doc = fetchPage(url);

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
