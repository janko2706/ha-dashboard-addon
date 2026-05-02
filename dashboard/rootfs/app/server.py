#!/usr/bin/env python3
"""
Minimal HTTP server for the HDMI dashboard add-on.

Serves static dashboard files from /app/dashboard/ and exposes
GET /config so the browser can retrieve connection details and entity IDs
without needing direct access to the filesystem.

Options are read from /data/options.json (written by the HA Supervisor).
Re-reading on every /config request means changes in the HA UI take
effect on the next browser reload without restarting the add-on.
"""

import json
import os
import http.server
import subprocess
import urllib.parse
from pathlib import Path

OPTIONS_PATH = os.environ.get("OPTIONS_PATH", "/data/options.json")
STATIC_DIR   = Path(os.environ.get("STATIC_DIR",   "/app/dashboard"))
PORT         = int(os.environ.get("PORT", "8080"))
DISPLAY      = os.environ.get("DISPLAY", ":0")
LAST_DISPLAY_CONFIG_LOG = None


def load_options() -> dict:
    try:
        with open(OPTIONS_PATH) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as exc:
        print(f"[server] WARNING: Could not read options: {exc}")
        return {}


def as_bool(value, default=False) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return bool(value)


def as_int(value, default=0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def build_config(opts: dict) -> dict:
    """Map flat options.json keys into the structured payload the browser expects."""
    return {
        "ha_url":             opts.get("ha_url")   or os.environ.get("HA_URL", ""),
        "ha_token":           opts.get("ha_token") or os.environ.get("HA_TOKEN", ""),
        "humidity_threshold": opts.get("humidity_threshold", 70),
        "display_power": {
            "enabled": as_bool(opts.get("display_power_control"), False),
            "sleep_delay_seconds": max(0, as_int(opts.get("display_sleep_delay_seconds"), 300)),
        },
        "entities": {
            "wohnzimmer": {
                "light":       opts.get("light_wohnzimmer", ""),
                "ambient":     opts.get("ambient_wohnzimmer", ""),
                "temperature": opts.get("temperature_wohnzimmer", ""),
                "humidity":    opts.get("humidity_wohnzimmer", ""),
            },
            "schlafzimmer": {
                "light":       opts.get("light_schlafzimmer", ""),
                "temperature": opts.get("temperature_schlafzimmer", ""),
                "humidity":    opts.get("humidity_schlafzimmer", ""),
            },
            "badezimmer": {
                "temperature": opts.get("temperature_badezimmer", ""),
                "humidity":    opts.get("humidity_badezimmer", ""),
            },
            "flur": {
                "light":    opts.get("light_flur", ""),
                "presence": opts.get("presence_flur", ""),
            },
            "toilette": {
                "light":    opts.get("light_toilette", ""),
                "presence": opts.get("presence_toilette", ""),
            },
        },
    }


def presence_entities(config: dict) -> list[str]:
    entity_sets = config.get("entities", {})
    return [
        entity_set["presence"]
        for entity_set in entity_sets.values()
        if entity_set.get("presence")
    ]


def log_display_config(config: dict):
    global LAST_DISPLAY_CONFIG_LOG

    display_power = config.get("display_power", {})
    summary = {
        "enabled": display_power.get("enabled"),
        "sleep_delay_seconds": display_power.get("sleep_delay_seconds"),
        "presence_entities": presence_entities(config),
    }
    if summary == LAST_DISPLAY_CONFIG_LOG:
        return

    LAST_DISPLAY_CONFIG_LOG = summary
    print(
        "[server] Display power config: "
        f"enabled={summary['enabled']} "
        f"sleep_delay_seconds={summary['sleep_delay_seconds']} "
        f"presence_entities={summary['presence_entities']}"
    )


def run_xset(*args: str) -> str:
    env = os.environ.copy()
    env["DISPLAY"] = DISPLAY

    try:
        completed = subprocess.run(
            ["xset", *args],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            env=env,
            text=True,
            timeout=5,
        )
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError(f"xset {' '.join(args)} timed out") from exc

    output = completed.stdout.strip()
    if completed.returncode != 0:
        detail = f": {output}" if output else ""
        raise RuntimeError(f"xset {' '.join(args)} failed{detail}")
    return output


def log_xset_state(label: str):
    print(f"[server] X11 display power state ({label}):")
    try:
        output = run_xset("q")
    except RuntimeError as exc:
        print(f"[server]   ERROR: {exc}")
        return

    for line in output.splitlines():
        print(f"[server]   {line}")


def set_display_power(state: str) -> dict:
    if state == "off":
        log_xset_state("before requested off")
        run_xset("s", "off")
        run_xset("s", "noblank")
        try:
            run_xset("+dpms")
            run_xset("dpms", "force", "off")
            result = {"state": "off", "method": "dpms"}
        except RuntimeError as dpms_error:
            print(f"[server] WARNING: DPMS display off failed, using X screensaver blanking: {dpms_error}")
            run_xset("s", "on")
            run_xset("s", "blank")
            run_xset("s", "activate")
            result = {"state": "off", "method": "screensaver", "warning": str(dpms_error)}

        log_xset_state("after requested off")
        return result

    if state == "on":
        log_xset_state("before requested on")
        errors = []
        wake_methods = []

        for args, method in (
            (("dpms", "force", "on"), "dpms"),
            (("s", "reset"), "screensaver"),
        ):
            try:
                run_xset(*args)
                wake_methods.append(method)
            except RuntimeError as exc:
                errors.append(str(exc))

        for args in (
            ("s", "off"),
            ("s", "noblank"),
            ("-dpms",),
        ):
            try:
                run_xset(*args)
            except RuntimeError as exc:
                errors.append(str(exc))

        if not wake_methods:
            raise RuntimeError("; ".join(errors))

        result = {"state": "on", "method": ",".join(wake_methods)}
        if errors:
            result["warning"] = "; ".join(errors)
        log_xset_state("after requested on")
        return result

    raise ValueError("state must be 'on' or 'off'")


class DashboardHandler(http.server.SimpleHTTPRequestHandler):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC_DIR), **kwargs)

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path == "/config":
            self._serve_config()
        elif path == "/display/status":
            self._serve_display_status()
        else:
            super().do_GET()

    def do_POST(self):
        if urllib.parse.urlparse(self.path).path == "/display/power":
            self._serve_display_power()
        else:
            self.send_error(404, "Not found")

    def _serve_config(self):
        payload = build_config(load_options())
        log_display_config(payload)
        self._send_json(200, payload)

    def _serve_display_status(self):
        try:
            output = run_xset("q")
        except RuntimeError as exc:
            self._send_json(500, {"error": str(exc)})
            return

        self._send_json(200, {"display": DISPLAY, "xset": output})

    def _serve_display_power(self):
        opts = load_options()
        if not as_bool(opts.get("display_power_control"), False):
            self._send_json(403, {"error": "display_power_control is disabled"})
            return

        try:
            length = int(self.headers.get("Content-Length", "0") or "0")
        except ValueError:
            self._send_json(400, {"error": "Invalid Content-Length"})
            return

        if length > 1024:
            self._send_json(413, {"error": "Request body too large"})
            return

        try:
            body = self.rfile.read(length) if length else b"{}"
            payload = json.loads(body.decode("utf-8") or "{}")
            state = payload.get("state")
            print(f"[server] Display power request: state={state}")
            result = set_display_power(state)
        except (json.JSONDecodeError, UnicodeDecodeError):
            self._send_json(400, {"error": "Invalid JSON"})
            return
        except ValueError as exc:
            self._send_json(400, {"error": str(exc)})
            return
        except RuntimeError as exc:
            print(f"[server] ERROR: Display power request failed: {exc}")
            self._send_json(500, {"error": str(exc)})
            return

        print(f"[server] Display power set to {result['state']} via {result['method']}")
        self._send_json(200, result)

    def _send_json(self, status: int, payload: dict):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        print(f"[server] {self.address_string()} - {fmt % args}")


if __name__ == "__main__":
    print(f"[server] Starting on :{PORT}, serving {STATIC_DIR}")
    with http.server.HTTPServer(("", PORT), DashboardHandler) as httpd:
        httpd.serve_forever()
