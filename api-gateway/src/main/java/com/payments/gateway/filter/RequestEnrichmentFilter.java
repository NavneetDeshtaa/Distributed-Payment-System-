package com.payments.gateway.filter;

import com.auth0.jwt.exceptions.JWTVerificationException;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.payments.gateway.config.JwtUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.util.UUID;

/**
 * Phase 5 Request Enrichment & Security Filter:
 * 1. Verifies JWT token on protected routes (/payments/**, /accounts/**).
 * 2. Extracts 'sub' claim into X-User-Id header.
 * 3. Generates and injects X-Correlation-ID header.
 * 4. Strips Authorization header so downstream microservices only trust validated headers.
 * 5. Rejects unauthenticated traffic with HTTP 401 Unauthorized.
 */
@Component
public class RequestEnrichmentFilter implements GlobalFilter, Ordered {

    private static final Logger log = LoggerFactory.getLogger(RequestEnrichmentFilter.class);

    private final JwtUtil jwtUtil;

    public RequestEnrichmentFilter(JwtUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String path = request.getURI().getPath();

        // Allow public routes without JWT verification
        if (path.startsWith("/auth/") || path.startsWith("/actuator/") || path.startsWith("/fallback")
                || path.startsWith("/simulation/") || path.startsWith("/webhooks/mock-merchant")) {
            return passThroughWithCorrelationId(exchange, chain);
        }

        // Check Authorization header
        String authHeader = request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            log.warn("Unauthorized request blocked by Edge Gateway: Missing Bearer token for path '{}'", path);
            return unauthorizedResponse(exchange, "Missing or invalid Authorization header");
        }

        String token = authHeader.substring(7);
        DecodedJWT decodedJwt;
        try {
            decodedJwt = jwtUtil.verifyToken(token);
        } catch (JWTVerificationException ex) {
            log.warn("Invalid JWT token presented at Edge Gateway: {}", ex.getMessage());
            return unauthorizedResponse(exchange, "JWT signature verification failed: " + ex.getMessage());
        }

        String userId = decodedJwt.getSubject();
        String correlationId = "corr-gw-" + UUID.randomUUID().toString().substring(0, 8);

        log.info("Edge Gateway Authenticated request: path='{}', user='{}', correlationId='{}'", path, userId, correlationId);

        // Mutate request: Injects X-User-Id, X-Correlation-ID, and STRIPS Authorization header!
        ServerHttpRequest mutatedRequest = request.mutate()
                .header("X-User-Id", userId)
                .header("X-Correlation-ID", correlationId)
                .headers(httpHeaders -> httpHeaders.remove(HttpHeaders.AUTHORIZATION))
                .build();

        return chain.filter(exchange.mutate().request(mutatedRequest).build());
    }

    private Mono<Void> passThroughWithCorrelationId(ServerWebExchange exchange, GatewayFilterChain chain) {
        String correlationId = "corr-pub-" + UUID.randomUUID().toString().substring(0, 8);
        ServerHttpRequest mutatedRequest = exchange.getRequest().mutate()
                .header("X-Correlation-ID", correlationId)
                .build();
        return chain.filter(exchange.mutate().request(mutatedRequest).build());
    }

    private Mono<Void> unauthorizedResponse(ServerWebExchange exchange, String message) {
        ServerHttpResponse response = exchange.getResponse();
        response.setStatusCode(HttpStatus.UNAUTHORIZED);
        response.getHeaders().add(HttpHeaders.CONTENT_TYPE, "application/json");
        String errorJson = String.format("{\"error\": \"Unauthorized\", \"message\": \"%s\", \"status\": 401}", message);
        return response.writeWith(Mono.just(response.bufferFactory().wrap(errorJson.getBytes())));
    }

    @Override
    public int getOrder() {
        return -100; // Run early before routing
    }
}
