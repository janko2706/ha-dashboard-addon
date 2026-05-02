# Changelog

## 1.1.13
- Fix "zoomed in" display when Pi boots at 640×800: replace broken xorg.conf Virtual override and Chromium window-size approach with a CSS transform scale in app.js that shrinks the 1920×1080 canvas to fit whatever resolution the framebuffer actually reports
- Change viewport meta to `width=device-width, initial-scale=1` so Chromium uses the real screen width rather than a fixed 1920px viewport
- Remove `Virtual 1920 1080` from xorg.conf (caused only 640×800 of the 1920×1080 virtual desktop to be visible, making the app appear zoomed/clipped)
- Remove `--force-device-scale-factor=1` from Chromium flags (no longer needed with CSS-based scaling)
- NOTE: the permanent fix for 640×800 boot resolution is to add `hdmi_force_hotplug=1`, `hdmi_group=1`, `hdmi_mode=16` to `/boot/firmware/config.txt` on the Pi — see README

## 1.1.12
- Fix 640×800 display resolution: add `Virtual 1920 1080` to the xorg.conf Display subsection so X reports a 1920×1080 logical screen to Chromium even when the physical framebuffer is smaller (e.g. Pi boots at 640×800 without an HDMI signal at power-on)
- Add `--force-device-scale-factor=1` to Chromium kiosk flags to prevent DPI-based CSS pixel scaling when the physical resolution is low
- Remove `--window-size=1920,1080` and `--window-position=0,0` from the Chromium kiosk command; these flags forced the CSS viewport to 1920×1080 regardless of the actual Xorg display resolution, breaking the `<meta name="viewport" content="width=1920">` scale-to-fit that made the app render correctly on sub-1080p displays

## 1.1.11
- Add sun/moon arc strip above the floor plan and weather cards: a 1808 px wide SVG that tracks the current sun (or moon at night) position along the horizon using the display's physical orientation (back faces 156° SE) as the reference direction
- Sun arc shows today's path from sunrise to sunset with a past/future gradient, a glowing sun icon with rays, altitude-based vertical position, and sunrise/sunset time labels
- Moon arc mirrors the sun arc at night with the actual moon position (Meeus simplified algorithm, ~1° accuracy), a phase-accurate SVG disc (crescent/quarter/gibbous/full rendered via two-arc terminator technique), moonrise/moonset labels, and a cool blue-silver colour scheme
- Add second ambient-light bulb slot (`bulb2`) to Wohnzimmer, positioned in the top-right corner at 65% scale; wired to a new `ambient_wohnzimmer` option so it reflects the switch state independently of the main ceiling light
- Add `ambient` field to `EntitySet` and map `ambient_wohnzimmer` option through `server.py` → `/config` response
- Fix display blanking: disable X screen saver timer (`xset s off`), framebuffer blanking (`xset s noblank`), and DPMS at runtime (`xset -dpms`) to prevent the monitor from dropping signal after ~10 minutes of kiosk inactivity

## 1.1.10
- Hide the underlying Linux VT cursor before Xorg starts and reduce Chromium background-service log noise for kiosk mode
- Disable Chromium Vulkan/WebGPU/on-device model/background network probes and log Chromium's exit status if the kiosk process terminates
- Replace the HA weather-entity panel with a self-contained Open-Meteo weather widget showing current conditions and only the next two days
- Use Open-Meteo sunrise/sunset data to show a moon icon for clear current conditions after sunset and before sunrise
- Switch the weather card's sun glow animation to a moon visual at night while preserving cloud/rain/snow animation combinations
- Use a blue night background for clear and partly cloudy nighttime weather instead of the daytime yellow glow
- Restore the ApexCharts 24-hour temperature area chart in the weather widget

## 1.1.9
- Fix black X screen after Xorg starts by launching Chromium with X11/software-rendering-compatible flags instead of EGL/GPU rasterization, and add Chromium startup markers to the add-on log
- Fix false `Python server never started` readiness failure by replacing the missing `wget` dependency with a Python-based `/config` check, and make Python service startup logs unbuffered

## 1.1.8
- Fix fbdev `FBIOPUT_VSCREENINFO: Invalid argument` on KMS-backed `/dev/fb0` by matching Xorg to the framebuffer's apparent 16-bit layout instead of requesting 24/32-bit screen initialization

## 1.1.7
- Add Xorg startup diagnostics to the add-on log: print the expected display devices before launch, dump only the last 200 lines of `/var/log/Xorg.0.log` after failure, and pause after failure to avoid restart-loop log spam

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
