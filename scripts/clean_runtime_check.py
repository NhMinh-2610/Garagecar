"""Run inside a fresh runtime image; no dependency inherited from local .venv."""

import importlib.util
import os
import subprocess
import sys
from pathlib import Path

assert importlib.util.find_spec("passlib") is None
assert not Path("/app/.env").exists()
subprocess.run(
    [
        sys.executable,
        "-m",
        "pip",
        "install",
        "--quiet",
        "--no-cache-dir",
        "-r",
        "requirements-dev.txt",
    ],
    check=True,
)
arguments = [
    sys.executable,
    "-m",
    "pytest",
    "-q",
    "tests/test_security_integrity.py",
    "-k",
    "legacy_bcrypt",
    "--tb=short",
    "-o",
    "asyncio_default_fixture_loop_scope=function",
]
if os.environ.get("GARAGE_JUNIT_PATH"):
    arguments.extend(["--junitxml", os.environ["GARAGE_JUNIT_PATH"]])
raise SystemExit(subprocess.call(arguments))
