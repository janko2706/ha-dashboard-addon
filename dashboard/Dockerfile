# ── Stage 1: Build React + TypeScript UI ──────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /build
COPY dashboard-ui/package*.json ./
RUN npm ci

COPY dashboard-ui/ ./
# Bring the floor plan SVG in so Vite copies it as a public asset
COPY rootfs/app/dashboard/floorplan.svg public/

RUN npm run build
# Output is at /build/dist

# ── Stage 2: Runtime image ─────────────────────────────────────────────────
# ARG must be re-declared after each FROM in multi-stage builds
ARG BUILD_FROM
FROM ${BUILD_FROM:-ghcr.io/home-assistant/base-debian:bookworm}

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    xserver-xorg-core \
    xserver-xorg-video-fbdev \
    xserver-xorg-input-evdev \
    x11-xserver-utils \
    x11-utils \
    chromium \
    unclutter \
    dbus \
    python3 \
    fonts-dejavu-core \
    fonts-noto \
    && rm -rf /var/lib/apt/lists/*

# Copy s6 scripts, Xorg config, and Python server
COPY rootfs /

# Built React app replaces the old static files
COPY --from=builder /build/dist /app/dashboard/

# s6 run scripts lose +x in COPY — restore them
RUN find /etc/s6-overlay -type f -name "run" -exec chmod +x {} \; && \
    chmod +x /app/server.py

RUN mkdir -p /tmp/.X11-unix && chmod 1777 /tmp/.X11-unix
RUN mkdir -p /root/.config/chromium

EXPOSE 8080
