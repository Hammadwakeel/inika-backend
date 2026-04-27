# Inika Bot - Functional Requirements Document

**Version:** 1.0
**Date:** 2026-04-27
**Project:** Multi-Tenant AI Concierge Platform

---

## 1. Introduction

### 1.1 Purpose
This document defines the functional requirements for the Inika Bot platform, a multi-tenant AI concierge system for hospitality businesses.

### 1.2 Scope
The system provides WhatsApp integration, knowledge base management, automated guest journeys, booking synchronization, and AI-powered chat capabilities.

---

## 2. System Overview

### 2.1 Architecture
- **Frontend:** Next.js 15 (React 19) with TypeScript
- **Backend:** FastAPI (Python 3.11+)
- **Database:** SQLite (per-tenant isolation)
- **Authentication:** JWT with Bearer token support

### 2.2 Module Structure

| Module | Description |
|--------|-------------|
| WhatsApp Hub | WhatsApp Business API integration |
| Knowledge Engine | Document upload, FAISS vector indexing |
| Journey | Automated guest communication workflows |
| Booking | Reservation sync and management |
| RAG Chat | AI-powered retrieval-augmented chat |
| Dashboard | System status and metrics |

---

## 3. Functional Requirements

### 3.1 Authentication Module

#### FR-AUTH-001: Multi-Tenant Login
- Users authenticate with tenant_id, username, and password
- System validates credentials against tenant-specific database
- JWT token issued on successful authentication

#### FR-AUTH-002: Token Management
- JWT tokens with configurable expiration (default: 60 minutes)
- Tokens include username and tenant_id claims
- Support for Bearer token, cookie, and query parameter authentication

#### FR-AUTH-003: Tenant Isolation
- Each tenant has isolated SQLite database
- Database stored in `data/tenants/{tenant_id}/`
- Users cannot access data from other tenants

#### FR-AUTH-004: Account Security
- Login attempt rate limiting (5 attempts, 15-minute lockout)
- Password strength validation on bootstrap
- Failed attempt tracking by IP address

---

### 3.2 Dashboard Module

#### FR-DASH-001: System Status Display
- Real-time status for all modules (WhatsApp, Knowledge, Journey, Booking)
- Status indicators: OPERATIONAL, CONNECTED, PENDING, DISCONNECTED
- Auto-refresh every 30 seconds

#### FR-DASH-002: Module Cards
- Display 5 module cards: WhatsApp Hub, Knowledge Engine, Journey, Booking, Profile
- Each card shows: icon, title, description, stats, navigation link
- Hover animations with scale and shadow effects

#### FR-DASH-003: Live Activity Feed
- Real-time activity stream component
- SSE-based updates
- Activity types: messages, journey triggers, bookings

#### FR-DASH-004: System Metrics
- Uptime percentage
- Requests today counter
- Active sessions count
- Webhook status

---

### 3.3 WhatsApp Hub Module

#### FR-WA-001: WhatsApp Stream
- SSE endpoint for WhatsApp conversation stream
- Returns chat list and linked status
- Authentication via Bearer token

#### FR-WA-002: Message Handling
- Receive incoming WhatsApp messages
- Send automated replies based on AI processing
- Message routing to appropriate handlers

---

### 3.4 Knowledge Engine Module

#### FR-KNOW-001: Document Upload
- Upload text documents via API
- Store documents per tenant
- Support for plain text format

#### FR-KNOW-002: Vector Indexing
- Build FAISS index from uploaded documents
- Track document and vector counts
- Index status reporting (configured, ready)

#### FR-KNOW-003: Schema Management
- Define AI persona/identity schema
- Store behavioral rules and base identity
- Update schema per tenant

#### FR-KNOW-004: Wiki Status
- Check indexing status
- View indexed pages list
- Index health reporting

---

### 3.5 Journey Module

#### FR-JOUR-001: Journey Templates
- Pre-configured journey templates:
  - checkin_morning (6-9 AM)
  - checkin_afternoon (12-2 PM)
  - checkin_evening (6-9 PM)
  - checkin_late (9 PM-12 AM)
  - checkout_morning (10 AM)
  - daily_morning (9 AM)
  - daily_lunch (12 PM)
  - daily_evening (7 PM)
  - post_stay (day after checkout)

#### FR-JOUR-002: Guest Management
- Track active guests per tenant
- Manage guest journey state
- Store message history per guest

#### FR-JOUR-003: Journey Scheduler
- Start/stop journey scheduler
- Trigger journeys manually (dry-run supported)
- Run all active journeys

#### FR-JOUR-004: Journey Summary
- Total active guests
- Templates available
- Messages sent count
- Guest progress tracking

#### FR-JOUR-005: Weather Integration
- Fetch weather data for location
- Adjust message timing based on weather
- Weather-aware personalization

---

### 3.6 Booking Module

#### FR-BOOK-001: Booking Sync
- Fetch bookings from external system
- Sync today's bookings
- Track booking status (confirmed, pending, cancelled)

#### FR-BOOK-002: Guest List
- List all guests with booking data
- Filter by date range
- Guest detail view

#### FR-BOOK-003: Journey Integration
- Start guest journey on booking confirmation
- Track guest journey status per booking
- Sync check-in/check-out events

#### FR-BOOK-004: External API Integration
- Connect to external booking system
- API key configuration
- Error handling and retries

---

### 3.7 RAG Chat Module

#### FR-RAG-001: Streaming Chat
- SSE-based streaming responses
- Real-time status indicators:
  - searching_wiki
  - searching_faiss
  - generating_response
- Message animation (slide in from left/right)

#### FR-RAG-002: RAG Pipeline
- Retrieve relevant context from FAISS
- Web search via Tavily API
- Generate response via OpenRouter LLM

#### FR-RAG-003: Wiki Search
- Semantic search across indexed documents
- Top-k results retrieval (configurable, default: 4)
- Source attribution in responses

#### FR-RAG-004: Error Handling
- Connection error detection
- Retry mechanism
- Graceful degradation

---

### 3.8 Profile Module

#### FR-PROF-001: Account Display
- Show username and tenant ID
- Display session status
- Account activity info

#### FR-PROF-002: Session Management
- Token expiration display
- Logout functionality
- Session validation

---

## 4. API Endpoints

### 4.1 Authentication

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/auth/login` | POST | No | User login |
| `/auth/logout` | POST | Yes | User logout |
| `/auth/bootstrap` | POST | No | Create initial user |
| `/auth/tenant-id` | GET | No | Generate tenant ID |

### 4.2 Dashboard

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/dashboard/status` | GET | Yes | System status |

### 4.3 WhatsApp

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/whatsapp/stream` | GET | Yes | WhatsApp stream |

### 4.4 Journey

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/journey/status` | GET | Yes | Journey status |
| `/journey/summary` | GET | Yes | Journey summary |
| `/journey/trigger` | POST | Yes | Trigger journey |
| `/journey/run-all` | POST | Yes | Run all journeys |
| `/journey/start` | POST | Yes | Start scheduler |
| `/journey/stop` | POST | Yes | Stop scheduler |

### 4.5 Booking

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/booking/todays` | GET | Yes | Today's bookings |
| `/booking/sync` | GET | Yes | Sync bookings |
| `/booking/guests` | GET | Yes | List guests |
| `/booking/guest/{id}` | GET | Yes | Guest detail |
| `/booking/guest/{id}/journey` | GET | Yes | Guest journey |

### 4.6 RAG

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/rag/query/stream` | GET | Yes | Stream query |
| `/rag/query` | POST | Yes | Non-streaming query |
| `/rag/wiki/status` | GET | Yes | Wiki status |
| `/rag/wiki/index` | GET | Yes | Index info |
| `/rag/wiki/pages` | GET | Yes | List pages |
| `/rag/wiki/schema` | GET/POST | Yes | Get/save schema |
| `/rag/wiki/ingest` | POST | Yes | Ingest document |
| `/rag/wiki/lint` | POST | Yes | Lint content |

### 4.7 Health

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/health` | GET | No | Full health check |
| `/health/live` | GET | No | Liveness probe |
| `/health/ready` | GET | No | Readiness probe |

---

## 5. User Interfaces

### 5.1 Landing Page
- Public marketing page
- Three.js animated background
- Feature showcase
- Call-to-action buttons
- GSAP scroll animations

### 5.2 Login Page
- Tenant ID input
- Username input
- Password input
- Login button
- Particle animation background
- GSAP form animations

### 5.3 Dashboard Page
- Header with system status badges
- Module cards grid (5 columns)
- Live activity feed panel
- System metrics panel
- Footer with version info

### 5.4 Booking Page
- Booking management interface
- Guest list view
- Sync controls

### 5.5 Journey Page
- Journey builder/manager
- Template selection
- Guest journey list

### 5.6 RAG Chat Page
- Chat interface
- Message history
- Streaming responses
- Status indicators

### 5.7 Profile Page
- Account information
- Session details
- Logout option

---

## 6. Non-Functional Requirements

### 6.1 Performance
- Page load time < 3 seconds
- API response time < 500ms
- SSE streaming latency < 1 second

### 6.2 Security
- JWT token validation on all protected endpoints
- Tenant data isolation
- HTTPS in production
- Secure cookie settings

### 6.3 Reliability
- Health check endpoints for monitoring
- Graceful error handling
- Connection retry mechanisms

### 6.4 Compatibility
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile responsive design
- Touch-friendly interfaces

---

## 7. Configuration

### 7.1 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AXIOM_JWT_SECRET` | Yes | JWT signing secret |
| `AXIOM_COOKIE_SECURE` | No | Cookie HTTPS flag |
| `AXIOM_ALLOWED_ORIGINS` | No | CORS origins |
| `OPENROUTER_API_KEY` | Yes | LLM API key |
| `TAVILY_API_KEY` | Yes | Search API key |
| `INIKA_API_KEY` | Yes | Inika API key |

### 7.2 Docker Configuration
- Backend: Port 8000
- Frontend: Port 3000
- Nginx: Ports 80/443

---

## 8. Acceptance Criteria

### AC-1: Authentication
- [ ] User can login with valid credentials
- [ ] Invalid credentials show error message
- [ ] JWT token is stored and used for subsequent requests
- [ ] Logout clears session

### AC-2: Dashboard
- [ ] All 5 module cards display correctly
- [ ] Status badges show current system state
- [ ] Auto-refresh updates data every 30 seconds
- [ ] GSAP animations play on load and hover

### AC-3: WhatsApp Integration
- [ ] WhatsApp stream connects successfully
- [ ] Chat list displays correctly
- [ ] Messages can be received and processed

### AC-4: Knowledge Engine
- [ ] Documents can be uploaded
- [ ] FAISS index builds successfully
- [ ] Search returns relevant results

### AC-5: Journey Automation
- [ ] Journey templates load correctly
- [ ] Scheduler starts and stops
- [ ] Messages send at scheduled times
- [ ] Guest progress tracks accurately

### AC-6: Booking Sync
- [ ] External bookings sync successfully
- [ ] Guest list displays correctly
- [ ] Journey starts on booking

### AC-7: RAG Chat
- [ ] Streaming responses display in real-time
- [ ] Status indicators show progress
- [ ] RAG pipeline retrieves and generates correctly

### AC-8: Deployment
- [ ] Docker containers build successfully
- [ ] All services start correctly
- [ ] Health checks pass
- [ ] Frontend accessible on port 3000

---

## 9. Glossary

| Term | Definition |
|------|------------|
| Tenant | Isolated instance of the platform for a business |
| RAG | Retrieval-Augmented Generation |
| FAISS | Facebook AI Similarity Search |
| SSE | Server-Sent Events |
| JWT | JSON Web Token |
| GSAP | GreenSock Animation Platform |

---

**Document Status:** Approved
**Last Updated:** 2026-04-27
