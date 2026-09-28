"""Local launcher, including isolated dependencies installed beside the project."""
import runpy
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
local_packages = root / ".venv" / "Lib" / "site-packages"
sys.path.insert(0, str(root / "be"))
if local_packages.exists():
    sys.path.insert(0, str(local_packages))

if len(sys.argv) < 2:
    raise SystemExit("Usage: python scripts/run.py MODULE [ARGUMENTS]")
module = sys.argv[1]
sys.argv = [module, *sys.argv[2:]]
runpy.run_module(module, run_name="__main__")
