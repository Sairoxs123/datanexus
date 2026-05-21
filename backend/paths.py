"""
Centralized path management for DataNexus backend.

In production (PyInstaller bundle): all data stored in %APPDATA%/datanexus
In development: all data stored relative to the current working directory.
"""

import os
import sys


def _is_frozen() -> bool:
    """Check if running inside a PyInstaller bundle."""
    return getattr(sys, 'frozen', False)


def get_data_dir() -> str:
    """
    Return the root directory for all application data.

    - Production:   %APPDATA%/datanexus   (e.g. C:/Users/<user>/AppData/Roaming/datanexus)
    - Development:  current working directory
    """
    if _is_frozen():
        appdata = os.environ.get('APPDATA', os.path.expanduser('~'))
        base = os.path.join(appdata, 'datanexus')
    else:
        base = os.getcwd()

    os.makedirs(base, exist_ok=True)
    return base


# Resolved once at import time
DATA_DIR = get_data_dir()


def data_path(*parts: str) -> str:
    """Join path segments relative to the application data directory."""
    return os.path.join(DATA_DIR, *parts)


def get_log_dir() -> str:
    """Return the directory for log files, creating it if needed."""
    log_dir = data_path("logs")
    os.makedirs(log_dir, exist_ok=True)
    return log_dir


def get_projects_dir() -> str:
    """Return the directory for project data, creating it if needed."""
    projects_dir = data_path("projects")
    os.makedirs(projects_dir, exist_ok=True)
    return projects_dir
