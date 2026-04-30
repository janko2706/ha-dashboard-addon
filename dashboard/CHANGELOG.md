# Changelog

## 1.1.6
- Fix "no screens found": revert to fbdev driver with /dev/fb0 exposed to container (was missing from devices list — root cause of original 1.1.4 failure); drop hardcoded Modes from xorg.conf so fbdev auto-detects framebuffer resolution, immune to kernel cmdline resolution changes

## 1.1.5
- Fix "AddScreen/ScreenInit failed for driver 0": expose /dev/dri/renderD128 (GPU render node) to the container — modesetting driver requires both card0 and renderD128; add AccelMethod=none fallback to avoid render-node dependency

## 1.1.4
- Fix "no screens found": switched Xorg driver from fbdev to modesetting (Pi 4 uses vc4 KMS/DRM, not legacy framebuffer); use /dev/dri/card0 instead of /dev/fb0

## 1.1.3
- Fix Xorg "Switching VT failed" crash: replaced `-novtswitch` with `-sharevts` so Xorg shares VT1 instead of trying to activate it against the HAOS-owned console

## 1.1.2
- Fix Xorg permissions: replaced `privileged: [SYS_ADMIN]` with `full_access: true` to grant all required Linux capabilities (including `CAP_SYS_TTY_CONFIG`) for VT access

## 1.1.1
- Fix Docker build: replaced missing `xdpyinfo` package with `x11-utils` (which includes `xdpyinfo`) in Dockerfile
- Fix HA config validation: replaced unsupported `SYS_TTY_CONFIG` privilege with `SYS_ADMIN`

## 1.1.0
- Initial release: React + TypeScript dashboard served via Python HTTP server, rendered by Chromium in kiosk mode on Xorg/fbdev
