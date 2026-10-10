"""Read-only HTTP checks; --demo also signs in using the documented demo accounts."""

import argparse
import json
import sys
from datetime import date
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://localhost:3000")
    parser.add_argument("--demo", action="store_true")
    args = parser.parse_args()
    base = args.url.rstrip("/")
    checked = 0

    def request(path, token=None, body=None, expected=200):
        nonlocal checked
        headers = {"Accept": "application/json"}
        if token:
            headers["Authorization"] = "Bearer " + token
        if body is not None:
            headers["Content-Type"] = "application/json"
        req = Request(
            base + path,
            headers=headers,
            data=json.dumps(body).encode() if body is not None else None,
        )
        try:
            response = urlopen(req, timeout=30)
        except HTTPError as exc:
            response = exc
        with response:
            if response.status != expected:
                raise RuntimeError(
                    f"{path}: HTTP {response.status}, expected {expected}"
                )
            raw = response.read()
            if path.startswith("/api/") and expected == 200:
                result = json.loads(raw)
                if not result.get("success"):
                    raise RuntimeError(f"{path}: API reported failure")
                checked += 1
                return result
        checked += 1
        return None

    try:
        for path in [
            "/",
            "/login",
            "/service-worker.js",
            "/static/manifest.webmanifest",
            "/api/health",
            "/api/ready",
        ]:
            request(path)
        request("/api/auth/me", expected=401)
        if args.demo:
            common = ["/api/auth/me"]
            paths = {
                "admin": [
                    "/api/vehicles",
                    "/api/repairs",
                    "/api/inventory",
                    "/api/mechanics",
                    "/api/auth/users",
                    "/api/service/visits",
                    "/api/service/resources",
                    "/api/maintenance/profiles",
                    "/api/maintenance/reminders",
                    "/api/finance/receipts",
                    "/api/finance/expenses",
                    "/api/hr/operations",
                    "/api/service/employees",
                    "/api/messaging/conversations",
                    "/api/bookings",
                    "/api/settings/params",
                ],
                "advisor": [
                    "/api/vehicles",
                    "/api/service/visits",
                    "/api/service/resources",
                    "/api/advisor/followups",
                    "/api/messaging/conversations",
                    "/api/bookings",
                    "/api/maintenance/reminders",
                ],
                "accountant": [
                    "/api/repairs",
                    "/api/finance/receipts",
                    "/api/finance/expenses",
                    "/api/service/visits",
                    f"/api/reports/revenue?month={date.today():%Y-%m}",
                ],
                "hr": ["/api/service/employees", "/api/hr/operations"],
                "mechanic": [
                    "/api/repairs/my-tasks",
                    "/api/service/visits",
                    "/api/inventory",
                    "/api/hr/operations",
                ],
                "customer": [
                    "/api/vehicles/my-vehicles",
                    "/api/repairs/my-repairs",
                    "/api/service/visits",
                    "/api/maintenance/reminders",
                    "/api/messaging/conversations",
                    "/api/ai/chat/info",
                ],
            }
            for role, endpoints in paths.items():
                login = request(
                    "/api/auth/login",
                    body={
                        "email": f"{role}.demo@autopro.com",
                        "password": "Demo123456!",
                    },
                )
                token = login["data"]["token"]
                request(f"/static/{role}/index.html")
                for path in common + endpoints:
                    request(path, token)
                if role != "admin":
                    request("/api/auth/users", token, expected=403)
                print(f"OK {role}: portal, APIs and access boundaries")
        print(f"Passed {checked} HTTP checks at {base}")
        return 0
    except (RuntimeError, URLError, TimeoutError, ValueError, KeyError) as exc:
        # Do not print request bodies, credentials or response payloads.
        print(f"Check failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
