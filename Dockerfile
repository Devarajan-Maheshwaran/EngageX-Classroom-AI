# EngageX v2 — Backend Dockerfile
# Designed for Railway / Render free tier deployment.

FROM python:3.11-slim

WORKDIR /app

# System deps for librosa / torch CPU-only
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg libsndfile1 gcc g++ \
  && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY backend_v2/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --upgrade pip \
  && pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
  && pip install --no-cache-dir -r requirements.txt

# Copy source
COPY backend_v2/ ./

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
