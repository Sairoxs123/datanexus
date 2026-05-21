# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec for bundling the FastAPI backend as a standalone executable.
# This produces backend.exe which Tauri will launch as a sidecar process.

import os
import sys
from PyInstaller.utils.hooks import collect_submodules, collect_data_files

# Collect all submodules for packages that have dynamic imports
langchain_core_imports = collect_submodules('langchain_core')
langchain_ollama_imports = collect_submodules('langchain_ollama')
langgraph_imports = collect_submodules('langgraph')
sqlalchemy_imports = collect_submodules('sqlalchemy')
pydantic_imports = collect_submodules('pydantic')
pydantic_core_imports = collect_submodules('pydantic_core')

# Collect data files needed at runtime
langchain_core_datas = collect_data_files('langchain_core')
pydantic_datas = collect_data_files('pydantic')

a = Analysis(
    ['main.py'],
    pathex=['.'],
    binaries=[],
    datas=[
        # Bundle the ai_agent package
        ('ai_agent', 'ai_agent'),
        # Bundle app modules
        ('admin.py', '.'),
        ('admin_templates.py', '.'),
        ('paths.py', '.'),
    ] + langchain_core_datas + pydantic_datas,
    hiddenimports=[
        # --- Uvicorn internals (dynamic imports) ---
        'uvicorn',
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.loops.asyncio',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.http.h11_impl',
        'uvicorn.protocols.http.httptools_impl',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.protocols.websockets.wsproto_impl',
        'uvicorn.protocols.websockets.websockets_impl',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        'uvicorn.lifespan.off',

        # --- FastAPI / Starlette ---
        'fastapi',
        'fastapi.middleware',
        'fastapi.middleware.cors',
        'starlette',
        'starlette.responses',
        'starlette.routing',
        'starlette.middleware',
        'starlette.middleware.cors',

        # --- SQLModel / SQLAlchemy ---
        'sqlmodel',
        'sqlalchemy.dialects.sqlite',
        'sqlite3',

        # --- DuckDB ---
        'duckdb',

        # --- AI / LangChain / LangGraph ---
        'langchain_core',
        'langchain_ollama',
        'langgraph',
        'langgraph.graph',
        'langgraph.checkpoint',
        'langgraph.checkpoint.sqlite',
        'langgraph.checkpoint.sqlite.aio',
        'langgraph.checkpoint.serde',
        'langgraph.checkpoint.serde.jsonplus',
        'langgraph.prebuilt',
        'langsmith',
        'ollama',
        'httpx',
        'httpcore',
        'h11',
        'anyio',
        'anyio._backends',
        'anyio._backends._asyncio',
        'sniffio',

        # --- aiosqlite ---
        'aiosqlite',

        # --- Data processing ---
        'pandas',
        'pyarrow',
        'numpy',

        # --- Pydantic ---
        'pydantic',
        'pydantic_core',
        'annotated_types',
        'typing_extensions',

        # --- Our app modules ---
        'ai_agent',
        'ai_agent.agent',
        'ai_agent.utils',
        'ai_agent.utils.nodes',
        'ai_agent.utils.models',
        'ai_agent.utils.schemas',
        'ai_agent.utils.state',
        'ai_agent.utils.messages',
        'admin',
        'admin_templates',
        'paths',

        # --- Stdlib that PyInstaller sometimes misses ---
        'multiprocessing',
        'encodings',
        'encodings.utf_8',
        'encodings.ascii',
        'encodings.latin_1',
        'encodings.idna',
        'json',
        'uuid',
        'threading',
        'pathlib',
        'logging',
        'logging.handlers',
        'functools',
        'contextlib',
        'datetime',

        # --- Serialization ---
        'orjson',
        'ormsgpack',
        'msgpack',

        # --- Other deps ---
        'certifi',
        'charset_normalizer',
        'idna',
        'urllib3',
        'requests',
        'tenacity',
        'packaging',
        'yaml',
        'zstandard',
        'xxhash',
        'jsonpatch',
        'jsonpointer',
    ] + langchain_core_imports + langchain_ollama_imports + langgraph_imports + sqlalchemy_imports + pydantic_imports + pydantic_core_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # Exclude heavy unused packages to reduce size
        'spacy',
        'en_core_web_lg',
        'presidio_analyzer',
        'presidio_anonymizer',
        'thinc',
        'cymem',
        'preshed',
        'blis',
        'murmurhash',
        'srsly',
        'wasabi',
        'weasel',
        'catalogue',
        'confection',
        'tkinter',
        'matplotlib',
        'PIL',
        'scipy',
        'sklearn',
        'IPython',
        'notebook',
        'pytest',
        'test',
        'tests',
    ],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,  # Keep console visible for backend server logs
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
