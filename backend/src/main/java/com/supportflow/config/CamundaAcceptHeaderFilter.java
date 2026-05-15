package com.supportflow.config;

import jakarta.servlet.*;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpSession;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;
import java.util.Collections;
import java.util.Enumeration;
import java.util.List;

@Configuration
public class CamundaAcceptHeaderFilter {

    private static final String JSON_ACCEPT = "application/hal+json, application/json";

    private Filter createCamundaFilter() {
        return new Filter() {
            @Override
            public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
                    throws IOException, ServletException {
                HttpServletRequest httpReq = (HttpServletRequest) request;

                // Sync CSRF token: if the browser sends an XSRF-TOKEN cookie,
                // store it in the session so Camunda's CsrfPreventionFilter validation passes.
                HttpSession session = httpReq.getSession(false);
                if (session != null && httpReq.getCookies() != null) {
                    for (Cookie c : httpReq.getCookies()) {
                        if ("XSRF-TOKEN".equals(c.getName())) {
                            session.setAttribute("CAMUNDA_CSRF_TOKEN", c.getValue());
                            break;
                        }
                    }
                }

                String accept = httpReq.getHeader("Accept");
                // Only override Accept when it's missing, wildcard-only, or contains
                // problematic types (like text/plain) that Jersey can't serialize.
                boolean needsOverride = accept == null
                        || accept.isBlank()
                        || (accept.contains("*/*")
                            && !accept.contains("application/json")
                            && !accept.contains("application/hal+json"));

                if (needsOverride) {
                    chain.doFilter(new HttpServletRequestWrapper(httpReq) {
                        @Override
                        public String getHeader(String name) {
                            if ("Accept".equalsIgnoreCase(name)) {
                                return JSON_ACCEPT;
                            }
                            return super.getHeader(name);
                        }

                        @Override
                        public Enumeration<String> getHeaders(String name) {
                            if ("Accept".equalsIgnoreCase(name)) {
                                return Collections.enumeration(List.of(JSON_ACCEPT));
                            }
                            return super.getHeaders(name);
                        }
                    }, response);
                } else {
                    chain.doFilter(httpReq, response);
                }
            }
        };
    }

    @Bean
    public FilterRegistrationBean<Filter> camundaJsonAcceptFilter() {
        FilterRegistrationBean<Filter> reg = new FilterRegistrationBean<>();
        reg.setFilter(createCamundaFilter());
        reg.addUrlPatterns("/engine-rest/*", "/camunda/api/*");
        reg.setOrder(1);
        return reg;
    }
}
