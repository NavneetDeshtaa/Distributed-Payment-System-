package com.payments.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;

@Configuration
public class RedisConfig {

    @Bean
    public StringRedisTemplate stringRedisTemplate(RedisConnectionFactory connectionFactory) {
        return new StringRedisTemplate(connectionFactory);
    }

    /**
     * Atomic token-bucket rate limiting Lua script:
     * Increments the counter for KEYS[1].
     * If the key is newly created (counter == 1), sets expiration to ARGV[1] seconds.
     * Returns the current request count.
     */
    @Bean
    public RedisScript<Long> rateLimiterScript() {
        String script =
                "local current = redis.call('INCR', KEYS[1])\n" +
                "if current == 1 then\n" +
                "    redis.call('EXPIRE', KEYS[1], ARGV[1])\n" +
                "end\n" +
                "return current";
        return new DefaultRedisScript<>(script, Long.class);
    }
}
