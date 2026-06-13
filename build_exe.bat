@echo off
REM Build LedgerDiligence.exe — the desktop diligence workspace, with embeddings
REM bundled offline. Run from the repo root on Windows.

echo === 1/4  Building the dashboard ===
pushd frontend
call npm install
call npm run build
popd

echo === 2/4  Installing build tools ===
pip install -e .
pip install -r requirements-desktop.txt

echo === 3/4  Prefetching the embedding model (offline bundle) ===
python -c "from fastembed import TextEmbedding; TextEmbedding(model_name='BAAI/bge-small-en-v1.5', cache_dir='models')"

echo === 4/4  Compiling the EXE ===
pyinstaller ledger.spec --noconfirm --distpath dist_exe

echo.
echo Done.  ->  dist_exe\LedgerDiligence.exe
echo Put a .env (with LLM_API_KEY) next to the EXE before first run.
