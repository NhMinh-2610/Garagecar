"""A test signing key never reads or changes the deployment's private secret."""

import os

os.environ.setdefault("JWT_SECRET", "garagecar-tests-only-signing-secret-2026-unique")
