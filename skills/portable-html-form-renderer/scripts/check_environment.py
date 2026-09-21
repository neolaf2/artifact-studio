#!/usr/bin/env python3
import json, shutil, sys
status = {
    "python": sys.version.split()[0],
    "yaml": False,
    "jsonschema": False,
}
try:
    import yaml  # noqa
    status["yaml"] = True
except ImportError:
    pass
try:
    import jsonschema  # noqa
    status["jsonschema"] = True
except ImportError:
    pass
print(json.dumps(status, indent=2))
sys.exit(0 if status["yaml"] else 1)
