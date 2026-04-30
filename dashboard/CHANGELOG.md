# Changelog

## 1.1.3
- Fix Xorg "Switching VT failed" crash: replaced `-novtswitch` with `-sharevts` so Xorg shares VT1 instead of trying to activate it against the HAOS-owned console

## 1.1.2
- Fix Xorg permissions: replaced `privileged: [SYS_ADMIN]` with `full_access: true` to grant all required Linux capabilities (including `CAP_SYS_TTY_CONFIG`) for VT access

## 1.1.1
- Fix Docker build: replaced missing `xdpyinfo` package with `x11-utils` (which includes `xdpyinfo`) in Dockerfile
- Fix HA config validation: replaced unsupported `SYS_TTY_CONFIG` privilege with `SYS_ADMIN`

## 1.1.0
- Initial release: React + TypeScript dashboard served via Python HTTP server, rendered by Chromium in kiosk mode on Xorg/fbdev
