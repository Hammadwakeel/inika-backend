# Inika Bot Backend - Cloud Run Optimized
FROM python:3.12-slim

# Install Node.js for WhatsApp bridge (Baileys)
RUN apt-get update && apt-get install -y \
    nodejs \
    npm \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g npm@latest

WORKDIR /app

# Copy requirements first for better caching
COPY backend/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY backend/ ./backend/
COPY data/ ./data/

# Pre-install Node.js dependencies for WhatsApp bridge
COPY backend/package.json ./backend/package.json
WORKDIR /app/backend
RUN npm install --production || npm install || true
WORKDIR /app

# Environment variables - Cloud Run uses PORT
ENV PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

# Non-root user for security
RUN useradd -m -u 65532 appuser
USER appuser

EXPOSE 8000

# Health check - Cloud Run expects this
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/health/live || exit 1

# Cloud Run uses CMD directly, uvicorn picks up PORT from env
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]