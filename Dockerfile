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
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy app structure (creating backend/ subfolder for imports)
COPY app/ ./backend/app/
COPY main.py ./backend/main.py
COPY knowledge_engine.py ./backend/knowledge_engine.py
COPY message_dispatcher.py ./backend/message_dispatcher.py
COPY whatsapp_bridge.js ./backend/whatsapp_bridge.js
COPY wiki_engine.py ./backend/wiki_engine.py

# Pre-install Node.js dependencies for WhatsApp bridge
COPY package.json ./backend/package.json
WORKDIR /app/backend
RUN npm install --production || npm install || true
WORKDIR /app

# Create directories for tenant data BEFORE switching to non-root user
RUN mkdir -p /app/data/tenants && chown -R 65532:65532 /app/data

# Cloud Run injects PORT env var (default 8080)
ENV PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PYTHONDONTWRITEBYTECODE=1

# Non-root user for security
USER appuser

EXPOSE 8080

# Health check - Cloud Run expects this
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8080/health/live || exit 1

# Cloud Run uses CMD directly, uvicorn picks up PORT from env
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8080"]