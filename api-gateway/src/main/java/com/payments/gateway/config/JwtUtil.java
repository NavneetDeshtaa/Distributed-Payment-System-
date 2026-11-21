package com.payments.gateway.config;

import com.auth0.jwt.JWT;
import com.auth0.jwt.JWTVerifier;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.interfaces.DecodedJWT;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Date;
import java.util.List;

@Component
public class JwtUtil {

    private final String secret;
    private final Algorithm algorithm;
    private final JWTVerifier verifier;

    public JwtUtil(@Value("${gateway.jwt.secret:DistributedPaymentSystemSecretKey2026SecureJwtSigningKey}") String secret) {
        this.secret = secret;
        this.algorithm = Algorithm.HMAC256(secret);
        this.verifier = JWT.require(algorithm).withIssuer("payment-gateway").build();
    }

    public String generateToken(String userId, List<String> roles) {
        return JWT.create()
                .withIssuer("payment-gateway")
                .withSubject(userId)
                .withClaim("roles", roles)
                .withIssuedAt(new Date())
                .withExpiresAt(new Date(System.currentTimeMillis() + 3600_000)) // 1 hour
                .sign(algorithm);
    }

    public DecodedJWT verifyToken(String token) {
        return verifier.verify(token);
    }
}
