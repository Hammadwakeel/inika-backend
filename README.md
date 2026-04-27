# Inika Bot - Multi-Tenant AI Concierge Platform

A production-ready multi-tenant AI concierge platform for hospitality businesses, featuring WhatsApp integration, knowledge base management, automated guest journeys, and booking synchronization.

## Features

### Core Modules

| Module | Description |
|--------|-------------|
| **WhatsApp Hub** | Connect WhatsApp Business API, manage conversations, send automated replies |
| **Knowledge Engine** | Upload documents, build FAISS vector index, configure AI identity |
| **Journey** | Create automated guest journeys, send touchpoints at optimal times |
| **Booking** | Manage reservations, sync availability with external systems |
| **RAG Chat** | AI-powered chat with retrieval-augmented generation from your knowledge base |

### Key Capabilities

- **Multi-Tenancy**: Isolated data per tenant with secure JWT authentication
- **Streaming Responses**: Real-time AI responses with status indicators
- **GSAP Animations**: Smooth entrance and hover animations across the UI
- **Three.js Backgrounds**: Futuristic animated backgrounds on landing pages
- **Monochrome Theme**: Clean white-on-black design aesthetic
- **Server-Sent Events**: Real-time streaming for chat and activity feeds

## Tech Stack

### Backend
- **Framework**: FastAPI (Python 3.10+)
- **Database**: SQLite (per-tenant isolation)
- **Authentication**: JWT with Bearer token support
- **Vector Search**: FAISS for knowledge retrieval
- **External APIs**: OpenRouter (LLM), Tavily (search), WhatsApp

### Frontend
- **Framework**: Next.js 15 (React 19)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **Animations**: GSAP + Three.js
- **Icons**: Lucide React

## Project Structure

```
inika-bot/
├── backend/
│   ├── app/
│   │   ├── core/          # Config, tenant management
│   │   ├── middleware/    # Security middleware
│   │   ├── models/        # Pydantic schemas
│   │   ├── routes/        # API endpoints
│   │   │   ├── auth.py           # Login, logout, bootstrap
│   │   │   ├── booking.py        # Booking sync
│   │   │   ├── dashboard.py      # Status & metrics
│   │   │   ├── journey.py        # Guest journeys
│   │   │   └── rag.py            # RAG chat streaming
│   │   └── services/      # Business logic
│   │       ├── auth_service.py
│   │       ├── booking_client.py
│   │       ├── journey_*.py      # Journey automation
│   │       ├── llm_service.py
│   │       ├── wiki_search.py
│   │       └── weather_service.py
│   ├── main.py            # FastAPI app entry
│   └── .env               # Environment variables
├── frontend/
│   ├── app/
│   │   ├── dashboard/     # Main control center
│   │   ├── booking/       # Booking management
│   │   ├── journey/       # Journey builder
│   │   ├── knowledge/     # Knowledge base config
│   │   ├── landing/       # Public landing page
│   │   ├── login/         # Authentication
│   │   ├── profile/       # User settings
│   │   └── rag/           # RAG chat interface
│   ├── components/
│   │   ├── AppNav.tsx
│   │   ├── ChatView.tsx
│   │   ├── RagChatBot.tsx
│   │   ├── ThreeBackground.tsx
│   │   └── ...
│   ├── package.json
│   └── tsconfig.json
├── data/
│   └── tenants/           # Per-tenant SQLite DBs
├── .env                   # Backend environment
├── .gitignore
└── README.md
```

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/shivwng1/inika-bot.git
   cd inika-bot
   ```

2. **Set up Python virtual environment**
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate  # Linux/Mac
   # or
   .venv\Scripts\activate     # Windows
   ```

3. **Install Python dependencies**
   ```bash
   pip install fastapi uvicorn pydantic python-jose passlib faiss-cpu openai httpx python-multipart
   ```

4. **Set up frontend**
   ```bash
   cd frontend
   npm install
   cd ..
   ```

5. **Configure environment**
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env with your API keys:
   # - AXIOM_JWT_SECRET
   # - OPENROUTER_API_KEY
   # - TAVILY_API_KEY
   # - INIKA_API_KEY
   ```

### Running the Application

**Development mode:**

```bash
# Terminal 1 - Backend
cd backend
source .venv/bin/activate
uvicorn backend.app.main:app --reload --port 8000

# Terminal 2 - Frontend
cd frontend
npm run dev
```

**Production mode:**

```bash
# Build frontend
cd frontend
npm run build
npm start

# Run backend
cd backend
source .venv/bin/activate
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```

Access the application at `http://localhost:3000`

## API Documentation

### Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | POST | Login with tenant_id, username, password |
| `/api/auth/logout` | POST | Logout and clear session |
| `/api/auth/bootstrap` | POST | Create initial user account |
| `/api/auth/tenant-id` | GET | Generate new tenant ID |

### Modules

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/dashboard/status` | GET | Get system status for all modules |
| `/api/booking/sync` | GET | Sync bookings from external system |
| `/api/journey/summary` | GET | Get journey statistics |
| `/api/rag/chat` | POST | Stream RAG-powered chat responses |
| `/whatsapp/stream` | GET | WhatsApp conversation stream |

### Request Authentication

All protected endpoints accept authentication via:
1. **Bearer Token** (recommended): `Authorization: Bearer <token>`
2. **Cookie**: `axiom_session=<token>`
3. **Query Param**: `?token=<token>`

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AXIOM_JWT_SECRET` | Yes | JWT signing secret (min 32 chars) |
| `AXIOM_COOKIE_SECURE` | No | Set `true` for HTTPS (default: `false`) |
| `AXIOM_ALLOWED_ORIGINS` | No | CORS origins (comma-separated) |
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key for LLM |
| `TAVILY_API_KEY` | Yes | Tavily API key for web search |
| `INIKA_API_KEY` | Yes | Inika API key |

### Dashboard Status

The dashboard fetches real-time status from:

```typescript
interface DashboardStatus {
  whatsapp: { configured: boolean; ready: boolean; active: boolean; stats: {...} };
  knowledge: { configured: boolean; ready: boolean; active: boolean; stats: {...} };
  journey: { configured: boolean; ready: boolean; active: boolean; stats: {...} };
  booking: { configured: boolean; ready: boolean; active: boolean; stats: {...} };
}
```

## Deployment

### Docker (recommended for production)

```dockerfile
# Backend
FROM python:3.10-slim
WORKDIR /app
COPY backend/ ./backend/
RUN pip install -r backend/requirements.txt
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0"]

# Frontend
FROM node:18-alpine
WORKDIR /app
COPY frontend/ ./
RUN npm ci && npm run build
CMD ["npm", "start"]
```

### Production Checklist

- [ ] Set `AXIOM_COOKIE_SECURE=true`
- [ ] Use HTTPS/WSS (reverse proxy)
- [ ] Set `AXIOM_JWT_SECRET` to strong random value
- [ ] Configure `ALLOWED_ORIGINS` for production domain
- [ ] Enable SQLite WAL mode for concurrent reads
- [ ] Set up backups for `data/tenants/` directory

## Development

### TypeScript

Frontend uses strict TypeScript:
```bash
cd frontend
npx tsc --noEmit  # Type check
```

### Adding New Routes

1. Create route file in `backend/app/routes/`
2. Add router to `backend/app/main.py`
3. Create frontend page in `frontend/app/`

### Adding Journey Templates

Templates are in `backend/app/services/journey_templates/`:
- `checkin_morning.py`
- `checkin_afternoon.py`
- `checkin_evening.py`
- `checkin_late.py`
- `checkout_morning.py`
- `daily_morning.py`
- `daily_lunch.py`
- `daily_evening.py`
- `post_stay.py`

## License

Proprietary - All rights reserved

## Support

For issues and feature requests, please open an issue on GitHub.
