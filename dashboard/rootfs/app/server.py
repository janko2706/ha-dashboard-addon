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
import urllib.parse
from pathlib import Path

OPTIONS_PATH = os.environ.get("OPTIONS_PATH", "/data/options.json")
STATIC_DIR   = Path(os.environ.get("STATIC_DIR",   "/app/dashboard"))
PORT         = int(os.environ.get("PORT", "8080"))


def load_options() -> dict:
    try:
        with open(OPTIONS_PATH) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as exc:
        print(f"[server] WARNING: Could not read options: {exc}")
        return {}


def build_config(opts: dict) -> dict:
    """Map flat options.json keys into the structured payload the browser expects."""
    return {
        "ha_url":             opts.get("ha_url")   or os.environ.get("HA_URL", ""),
        "ha_token":           opts.get("ha_token") or os.environ.get("HA_TOKEN", ""),
        "humidity_threshold": opts.get("humidity_threshold", 70),
        "weather_entity":     opts.get("weather_entity", ""),
        "entities": {
            "wohnzimmer": {
                "light":       opts.get("light_wohnzimmer", ""),
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


class DashboardHandler(http.server.SimpleHTTPRequestHandler):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC_DIR), **kwargs)

    def do_GET(self):
        if urllib.parse.urlparse(self.path).path == "/config":
            self._serve_config()
        else:
            super().do_GET()

    def _serve_config(self):
        payload = build_config(load_options())
        body = json.dumps(payload).encode("utf-8")
        self.send_response(200)
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
