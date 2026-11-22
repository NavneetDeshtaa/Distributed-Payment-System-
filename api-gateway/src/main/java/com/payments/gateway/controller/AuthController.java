package com.payments.gateway.controller;

import com.payments.gateway.config.JwtUtil;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@CrossOrigin(origins = "*", allowedHeaders = "*")
@RestController
@RequestMapping("/auth")
public class AuthController {

    private final JwtUtil jwtUtil;

    public AuthController(JwtUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
    }

    @RequestMapping(value = "/token", method = {RequestMethod.POST, RequestMethod.GET})
    public ResponseEntity<Map<String, Object>> mintToken(
            @RequestParam(required = false) String userId,
            @RequestParam(defaultValue = "ROLE_USER") String role,
            @RequestBody(required = false) Map<String, Object> body) {

        String effectiveUser = userId;
        if (effectiveUser == null && body != null && body.containsKey("userId")) {
            effectiveUser = String.valueOf(body.get("userId"));
        }
        if (effectiveUser == null || effectiveUser.trim().isEmpty()) {
            effectiveUser = "alice";
        }

        String effectiveRole = role;
        if (body != null && body.containsKey("role")) {
            effectiveRole = String.valueOf(body.get("role"));
        }

        String token = jwtUtil.generateToken(effectiveUser, List.of(effectiveRole));
        return ResponseEntity.ok(Map.of(
                "token", token,
                "tokenType", "Bearer",
                "expiresIn", 3600,
                "userId", effectiveUser,
                "roles", List.of(effectiveRole)
        ));
    }
}
