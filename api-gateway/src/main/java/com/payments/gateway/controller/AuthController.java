package com.payments.gateway.controller;

import com.payments.gateway.config.JwtUtil;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final JwtUtil jwtUtil;

    public AuthController(JwtUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
    }

    @PostMapping("/token")
    public ResponseEntity<Map<String, Object>> mintToken(
            @RequestParam(defaultValue = "alice") String userId,
            @RequestParam(defaultValue = "ROLE_USER") String role) {

        String token = jwtUtil.generateToken(userId, List.of(role));
        return ResponseEntity.ok(Map.of(
                "token", token,
                "tokenType", "Bearer",
                "expiresIn", 3600,
                "userId", userId,
                "roles", List.of(role)
        ));
    }
}
