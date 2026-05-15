# SupportFlow Backend - Dockerfile
# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM eclipse-temurin:17-jdk-alpine AS builder

WORKDIR /app

# Maven wrapper + pom first for dependency caching
COPY pom.xml .
COPY mvnw .
COPY .mvn .mvn

RUN sed -i 's/\r$//' mvnw && chmod +x mvnw && \
    ./mvnw dependency:go-offline -B -q

COPY src src

RUN ./mvnw package -DskipTests -Dmaven.test.skip=true -q

# ─── Stage 2: Runtime ────────────────────────────────────────────────────────
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

# Non-root user
RUN addgroup -g 1001 supportflow && \
    adduser -u 1001 -G supportflow -s /bin/sh -D supportflow

COPY --from=builder /app/target/*.jar app.jar

RUN mkdir -p /app/logs /app/uploads && \
    chown -R supportflow:supportflow /app

USER supportflow

# Container-aware JVM memory management (overrides JAVA_TOOL_OPTIONS from compose)
ENV JAVA_TOOL_OPTIONS="\
  -XX:InitialRAMPercentage=30.0 \
  -XX:MaxRAMPercentage=70.0 \
  -XX:+UseG1GC \
  -XX:+ExitOnOutOfMemoryError \
  -Djava.security.egd=file:/dev/./urandom"

ENV SPRING_PROFILES_ACTIVE=docker

HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=5 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/actuator/health || exit 1

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
