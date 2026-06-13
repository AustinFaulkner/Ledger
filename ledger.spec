# PyInstaller spec — compiles the diligence workspace into one self-contained EXE,
# INCLUDING the on-device embedding model (fastembed / ONNX) so retrieval is real and
# fully offline. Build:  build_exe.bat   (which prefetches the model into ./models first)

from pathlib import Path
from PyInstaller.utils.hooks import collect_all, collect_submodules

datas = [("frontend/dist", "frontend/dist")]
binaries = []

# Only the qoe modules the desktop app actually uses — NOT qoe.cli, which pulls in
# typer/rich/click (CLI-only, dead weight in the windowed EXE).
QOE_MODULES = [
    "qoe.api", "qoe.config", "qoe.llm", "qoe.qoe", "qoe.diligence",
    "qoe.retrieval", "qoe.ingest", "qoe.store", "qoe.embeddings",
    "qoe.redflags", "qoe.working_capital", "qoe.diligence_matrix", "qoe.readiness",
    "qoe.search", "qoe.profiling", "qoe.financials", "qoe.taxonomy", "qoe.databook",
]
hiddenimports = (
    collect_submodules("uvicorn")
    + QOE_MODULES
    + ["anyio", "fastapi", "starlette", "multipart", "webview"]
    # document-ingestion parsers (imported lazily inside qoe.ingest handlers, so list
    # them explicitly — a missing one silently breaks that file type in the bundle)
    + ["openpyxl", "xlrd", "striprtf", "striprtf.striprtf", "docx", "pypdf", "et_xmlfile"]
)

# Heavy packages installed globally (other projects) that this app never imports.
# Excluding them up front prunes the import graph → smaller EXE *and* faster builds
# (fewer hooks run, less to compress). boto3/botocore stay: the Bedrock backend needs them.
EXCLUDES = [
    "tkinter",
    # data-science stack we don't use (pandas dropped from ingest in favor of openpyxl).
    # NOT PIL/Pillow — fastembed imports it at package init (ImageEmbedding).
    "pandas", "scipy", "matplotlib", "sympy",
    "torch", "torchvision", "torchaudio", "tensorflow", "keras", "tensorboard",
    # CLI-only deps (qoe.cli is no longer collected). NOT click — uvicorn needs it.
    "typer", "rich",
    # yt_dlp + its dependency tree, force-added by yt_dlp's PyInstaller hook
    "yt_dlp", "curl_cffi", "websockets", "Crypto", "Cryptodome", "brotli",
    "brotlicffi", "mutagen", "secretstorage",
    # notebooks / test tooling
    "IPython", "ipykernel", "jupyter", "jupyter_client", "notebook",
    "nbconvert", "nbformat", "pytest", "_pytest",
]

# Collect the embedding stack in full — Python modules, native DLLs, and package data.
# onnxruntime ships native libraries; tokenizers is a Rust extension; both need their
# binaries/data or the model won't load inside the bundle.
for pkg in ("fastembed", "onnxruntime", "tokenizers", "huggingface_hub", "pydantic", "pptx",
            "openai", "httpx", "httpcore", "anyio"):
    pkg_datas, pkg_binaries, pkg_hidden = collect_all(pkg)
    datas += pkg_datas
    binaries += pkg_binaries
    hiddenimports += pkg_hidden

# The embedding model, prefetched into ./models by the build script → bundled offline.
# HF cache symlinks (snapshots → blobs) can't be recreated by PyInstaller on Windows
# without admin/Developer Mode, causing the EXE to fail unelevated. Dereference them.
if Path("models").exists():
    import shutil
    for link in sorted(Path("models").rglob("*")):
        if link.is_symlink():
            target = link.resolve()
            link.unlink()
            shutil.copyfile(target, link)
    for blobs in Path("models").rglob("blobs"):
        if blobs.is_dir():
            shutil.rmtree(blobs, ignore_errors=True)
    datas += [("models", "models")]

# Sample data rooms bundled for out-of-the-box demo (CrowdStrike + Zscaler public SEC).
if Path("samples").exists():
    datas += [("samples", "samples")]

a = Analysis(
    ["desktop.py"],
    pathex=["src"],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    excludes=EXCLUDES,
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="LedgerDiligence",
    debug=False,
    strip=False,
    upx=False,            # UPX can corrupt onnxruntime DLLs; off (size is not a concern)
    console=False,        # windowed app (pywebview supplies the window)
    disable_windowed_traceback=False,
)
