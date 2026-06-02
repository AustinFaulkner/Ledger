# syntax=docker/dockerfile:1
#
# Clean, reproducible Linux web-app image. Installs ONLY the project's declared
# dependencies (requirements.txt + the frontend lockfile) — nothing from a developer's
# global environment — so the build is minimal and "only required packages" by
# construction. Serves the dashboard + API on one port, same as the desktop EXE.
#
#   docker build -t ledger-diligence .
#   docker run --rm -p 8000:8000 --env-file dist_exe/.env ledger-diligence
#
# Note: this is a Linux server image (good for cloud deployment + a clean-deps proof).
# It is NOT the Windows .exe — PyInstaller must run on Windows for that.

# --- Stage 1: build the React dashboard from the lockfile ---
FROM node:20-slim AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- Stage 2: slim Python runtime, only requirements.txt installed ---
FROM python:3.12-slim AS app
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/src \
    QOE_DATA_ROOT=/data \
    QOE_MODEL_CACHE=/models

# libgomp1 is needed by onnxruntime; everything else installs from wheels
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/
COPY --from=web /web/dist ./frontend/dist
RUN mkdir -p /data /models

EXPOSE 8000
# Embeddings download to /models on first use (keyword fallback if offline). Drop a
# token via --env-file or -e LLM_API_KEY=... to enable the AI analyses.
CMD ["uvicorn", "qoe.api:app", "--host", "0.0.0.0", "--port", "8000"]
