package com.supportflow.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.CacheManager;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.TimeUnit;

@Configuration
public class CacheConfig {

    /** Name of the cache holding AI copilot briefings, keyed by ticket id + last update. */
    public static final String AI_COPILOT_CACHE = "aiCopilot";

    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager cacheManager = new CaffeineCacheManager("agentRecommendations");
        cacheManager.setCaffeine(Caffeine.newBuilder()
            .expireAfterWrite(2, TimeUnit.MINUTES)
            .maximumSize(500));

        // Copilot briefings cost ~55s of CPU-only LLM inference to produce, but stay valid
        // as long as the ticket itself is unchanged (the cache key carries updatedAt, so an
        // edited ticket misses the cache and is regenerated). A longer TTL than the default
        // 2 minutes is what turns repeat ticket views from ~55s into an instant response.
        cacheManager.registerCustomCache(AI_COPILOT_CACHE, Caffeine.newBuilder()
            .expireAfterWrite(60, TimeUnit.MINUTES)
            .maximumSize(200)
            .build());
        return cacheManager;
    }
}
