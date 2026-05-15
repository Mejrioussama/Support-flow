# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS build

# Memory for build (keep reasonable for Docker)
ENV NODE_OPTIONS="--max-old-space-size=1536"

WORKDIR /app

# Install deps first (layer-cached)
COPY package*.json ./
RUN npm ci --prefer-offline

# Copy source and build
COPY . .
RUN npm run build -- --configuration docker

# ─── Stage 2: Runtime ────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# Drop to non-root: reuse nginx user (uid 101) already in the image
RUN mkdir -p /var/cache/nginx /var/log/nginx /var/run && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/cache/nginx /var/log/nginx /var/run/nginx.pid /etc/nginx/conf.d

COPY --from=build /app/dist/supportflow-frontend/browser/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf

RUN chown -R nginx:nginx /usr/share/nginx/html

USER nginx

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
