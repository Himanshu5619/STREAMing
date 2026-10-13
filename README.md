# 📡 STREAMing — Real-Time WebSocket Streaming & Broadcasting Platform

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React-61DAFB.svg?logo=react)](https://react.dev)
[![WebSockets](https://img.shields.io/badge/Protocol-WebSockets-4A154B.svg)](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB%20Motor-47A248.svg?logo=mongodb)](https://www.mongodb.com)
[![JWT](https://img.shields.io/badge/Auth-JWT%20%2B%20Bcrypt-black.svg)](https://jwt.io)

**STREAMing** is a high-throughput, low-latency live media streaming and room broadcasting platform. Built on an asynchronous Python/FastAPI architecture with full duplex WebSockets, persistent MongoDB state management via Motor, and an interactive, responsive React frontend.

---

## 🚀 Architectural Highlights

- **Full-Duplex WebSocket Ingestion**: Event-driven bidirectional telemetry delivering frame rates and real-time messaging with low overhead.
- **Asynchronous FastAPI Engine**: Asynchronous I/O loop (`asyncio` + `motor`) handling concurrent client connections without thread starvation.
- **Stateless JWT & Cryptographic Security**: Secure authentication endpoints using bcrypt password salting and HS256-signed JSON Web Tokens.
- **Room-Based Channel Isolation**: Dynamic channel broadcasting enabling targeted payload delivery across disparate streaming sessions.
- **Modern Interactive Dashboard**: Tailwind-styled React single-page application with responsive audio/video controls.

---

## 📁 System Architecture

```
STREAMing/
├── backend/
│   ├── server.py              # FastAPI application, WebSocket handlers & API routes
│   └── requirements.txt       # Python dependencies (FastAPI, Motor, JWT, Pydantic)
├── frontend/
│   ├── src/                   # React components, hooks, and WebSocket client
│   ├── tailwind.config.js     # Tailwind CSS design system configuration
│   └── package.json           # Frontend dependency manifest
└── README.md                  # Comprehensive documentation
```

---

## 🛠️ Quick Start Guide

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm
- Running MongoDB instance (local or MongoDB Atlas)

---

### 1. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables (.env)
cat << 'ENV' > .env
MONGO_URL=mongodb://localhost:27017
DB_NAME=streaming_db
JWT_SECRET_KEY=super-secret-development-key-change-in-production
ENV

# Launch the FastAPI server with hot-reload
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

The API documentation will be available at `http://localhost:8000/docs`.

---

### 2. Frontend Setup

```bash
cd ../frontend

# Install dependencies
npm install

# Start development server
npm start
```

Access the web interface at `http://localhost:3000`.

---

## 🔑 Key API & WebSocket Routes

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Create a new user profile with hashed credentials |
| `POST` | `/api/auth/login` | Authenticate and obtain HS256 bearer JWT token |
| `GET` | `/api/rooms` | Retrieve active streaming channels |
| `WS` | `/ws/stream/{room_id}` | Full-duplex WebSocket channel for streaming frames and events |

---

## 🛡️ License

MIT License. Designed and maintained by [Himanshu Singh](https://github.com/Himanshu5619).
