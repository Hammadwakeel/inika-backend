# Inika Bot - Multi-Tenant AI Concierge Platform

A production-ready multi-tenant AI concierge platform for hospitality businesses, featuring WhatsApp integration, knowledge base management, automated guest journeys, booking synchronization, and AI-powered chat.

## Features

### Core Modules

| Module | Description |
|--------|-------------|
| **WhatsApp Hub** | Connect WhatsApp Business API, manage conversations, send automated replies |
| **Knowledge Engine** | Upload documents, build FAISS vector index, configure AI persona |
| **Journey** | Create automated guest communication workflows, send touchpoints at optimal times |
| **Booking** | Manage reservations, sync with external booking systems |
| **RAG Chat** | AI-powered chat with retrieval-augmented generation from your knowledge base |

### Key Capabilities

- **Multi-Tenancy**: Isolated data per tenant with secure JWT authentication
- **Streaming Responses**: Real-time AI responses with status indicators (searching_wiki, searching_faiss, generating_response)
- **Server-Sent Events**: Real-time streaming for chat, activity feeds, and WhatsApp
- **Wiki-Based RAG**: Karpathy LLM Wiki pattern with cross-references and semantic search
- **Weather Integration**: Adjust message timing based on weather conditions

## Tech Stack

### Backend
- **Framework**: FastAPI (Python 3.10+)
- **Database**: SQLite (per-tenant isolation)
- **Authentication**: JWT with Bearer token, cookie, and query param support
- **Vector Search**: FAISS for knowledge retrieval
- **LLM**: OpenRouter API
- **Search**: Tavily API for real-time web search

### Frontend
- **Framework**: Next.js 15 (React 19)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React

## Project Structure

```
inika-bot/
├── backend/
│   ├── app/
│   │   ├── core/
│   │   │   ├── auth.py          # JWT token handling
│   │   │   ├── config.py        # Configuration
│   │   │   ├── env.py           # Environment loader
│   │   │   └── tenant.py        # Tenant management
│   │   ├── middleware/
│   │   │   └── security.py      # Security headers & rate limiting
│   │   ├── models/
│   │   │   ├── auth.py          # Auth request/response models
│   │   │   └── schemas.py       # Pydantic schemas
│   │   ├── routes/
│   │   │   ├── auth.py          # Login, logout, bootstrap
│   │   │   ├── booking.py       # Booking sync & guest management
│   │   │   ├── dashboard.py     # System status & metrics
│   │   │   ├── dependencies.py  # Shared dependencies
│   │   │   ├── health.py        # Health check endpoints
│   │   │   ├── journey.py       # Journey scheduler & triggers
│   │   │   ├── migrations.py    # Database migrations
│   │   │   ├── proactive.py     # Proactive messaging engine
│   │   │   ├── rag.py           # RAG chat streaming
│   │   │   ├── settings.py      # Tenant settings
│   │   │   └── sse_streamer.py  # SSE utilities
│   │   └── services/
│   │       ├── auth.py          # Auth business logic
│   │       ├── booking_client.py # External booking API
│   │       ├── journey_llm_generator.py
│   │       ├── journey_personalization.py
│   │       ├── journey_scheduler.py
│   │       ├── journey_state.py
│   │       ├── journey_timing.py
│   │       ├── journey_weather.py
│   │       ├── llm_service.py   # OpenRouter LLM integration
│   │       ├── memory_manager.py # Session memory & search logs
│   │       ├── migrations.py
│   │       ├── proactive_engine.py
│   │       ├── router.py        # Smart query routing
│   │       ├── search_tool.py   # RAG & web search
│   │       ├── weather_service.py
│   │       └── wiki_search.py   # Wiki-based search
│   ├── knowledge_engine.py      # FAISS knowledge base
│   ├── main.py                  # WhatsApp Hub & app entry
│   ├── wiki_engine.py           # LLM Wiki pattern
│   ├── message_dispatcher.py    # Message routing
│   └── .env.example             # Environment template
├── frontend/
│   ├── app/
│   │   ├── booking/             # Booking management
│   │   ├── dashboard/           # Main control center
│   │   ├── journey/             # Journey management
│   │   ├── knowledge/           # Knowledge base config
│   │   ├── landing/             # Public landing page
│   │   ├── login/              # Authentication
│   │   ├── profile/            # User settings
│   │   └── whatsapp/           # WhatsApp Hub UI
│   ├── components/
│   │   ├── AppNav.tsx
│   │   ├── ChatView.tsx         # WhatsApp chat interface
│   │   ├── KnowledgePage.tsx
│   │   ├── LiveActivityFeed.tsx
│   │   ├── MarketingNav.tsx
│   │   └── NavigationWrapper.tsx
│   ├── lib/
│   │   └── api.ts              # API utilities
│   ├── .env.example
│   └── package.json
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
   pip install fastapi uvicorn pydantic python-jose passlib faiss-cpu openai httpx python-multipart slowapi
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

Access the application at `http://localhost:3000`

## API Endpoints

### Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/login` | POST | Login with username/password |
| `/auth/logout` | POST | Logout and clear session |
| `/auth/bootstrap` | POST | Create initial user account |
| `/auth/tenant-id` | GET | Generate new tenant ID |

### Dashboard

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/dashboard/status` | GET | Get real-time status for all modules |

### WhatsApp

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/whatsapp/stream` | GET | SSE stream for WhatsApp conversations |
| `/whatsapp/chats` | GET | Get chat list |
| `/whatsapp/messages` | GET | Get messages for a chat |
| `/whatsapp/send` | POST | Send a message |
| `/whatsapp/restart` | POST | Restart WhatsApp bridge |
| `/whatsapp/qr` | GET | Get QR code for linking |

### Journey

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/journey/status` | GET | Get journey scheduler status |
| `/journey/summary` | GET | Get guest journey statistics |
| `/journey/trigger` | POST | Trigger journey manually |
| `/journey/run-all` | POST | Run all active journeys |
| `/journey/start` | POST | Start scheduler |
| `/journey/stop` | POST | Stop scheduler |

### Booking

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/booking/todays` | GET | Get today's bookings |
| `/booking/sync` | GET | Sync bookings from external system |
| `/booking/guests` | GET | List all guests |
| `/booking/guest/{id}` | GET | Get guest details |
| `/booking/guest/{id}/journey` | GET | Get guest journey status |

### RAG Chat

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/rag/query/stream` | GET | Stream RAG-powered chat responses |
| `/rag/query` | POST | Non-streaming RAG query |
| `/rag/wiki/status` | GET | Get wiki indexing status |
| `/rag/wiki/pages` | GET | List wiki pages |
| `/rag/wiki/schema` | GET/POST | Get/save AI persona schema |
| `/rag/wiki/ingest` | POST | Ingest document to wiki |
| `/rag/wiki/lint` | POST | Lint and clean wiki |

### Knowledge Engine

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/knowledge/upload` | POST | Upload document to knowledge base |
| `/knowledge/status` | GET | Get indexing status |
| `/knowledge/identity` | GET/POST | Get/save AI identity |

### Health

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Full health check |
| `/health/live` | GET | Liveness probe |
| `/health/ready` | GET | Readiness probe |

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AXIOM_JWT_SECRET` | Yes | JWT signing secret (min 32 chars) |
| `AXIOM_COOKIE_SECURE` | No | Set `true` for HTTPS |
| `AXIOM_ALLOWED_ORIGINS` | No | CORS origins (comma-separated) |
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key for LLM |
| `TAVILY_API_KEY` | Yes | Tavily API key for web search |

### Request Authentication

All protected endpoints accept authentication via:
1. **Bearer Token** (recommended): `Authorization: Bearer <token>`
2. **Cookie**: `axiom_session=<token>`
3. **Query Param**: `?token=<token>`

## License

Proprietary - All rights reserved

## Support

For issues and feature requests, please open an issue on GitHub.
