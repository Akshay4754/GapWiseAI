# GapWise AI 🎯

> **AI-powered interview preparation platform** — upload your resume, paste the job description, and get a personalized interview report, predicted questions, skill gap analysis, and a tailored resume PDF — all in seconds.

![GapWise AI](https://img.shields.io/badge/Status-Live-brightgreen?style=for-the-badge)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=node.js)
![React](https://img.shields.io/badge/Frontend-React%20+%20Vite-61DAFB?style=for-the-badge&logo=react)
![MongoDB](https://img.shields.io/badge/Database-MongoDB-47A248?style=for-the-badge&logo=mongodb)
![Google Gemini](https://img.shields.io/badge/AI-Google%20Gemini-4285F4?style=for-the-badge&logo=google)
![Docker](https://img.shields.io/badge/Containerized-Docker-2496ED?style=for-the-badge&logo=docker)
![GitHub Actions](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-2088FF?style=for-the-badge&logo=githubactions)

---

# ✨ Features

- 🔐 **JWT Authentication System**
- 📄 **Resume Upload & Parsing**
- 🤖 **AI Interview Report Generation**
- 📊 **Skill Gap Analysis**
- 🧠 **Technical + Behavioral Questions**
- 📅 **Personalized Preparation Roadmap**
- 📥 **ATS-Friendly Resume PDF Generator**
- 📚 **Interview Report History**
- 🐳 **Dockerized Full Stack Application**
- ⚙️ **GitHub Actions CI/CD Pipeline**
- 🧪 **Automated API Testing with Jest & Supertest**

---

# 🛠️ Tech Stack

## Backend
| Technology | Purpose |
|---|---|
| Node.js + Express | REST API server |
| MongoDB + Mongoose | Database |
| JWT + bcryptjs | Authentication |
| Google Gemini AI (`@google/genai`) | AI report & resume generation |
| Puppeteer Core + Chromium | HTML → PDF conversion |
| Multer | Resume uploads |
| Zod | Schema validation |
| Jest + Supertest | API testing |

## Frontend
| Technology | Purpose |
|---|---|
| React 19 + Vite | Frontend framework |
| React Router v7 | Routing |
| Axios | API requests |
| SASS | Styling |

## DevOps & Deployment
| Technology | Purpose |
|---|---|
| Docker | Containerization |
| Docker Compose | Multi-container orchestration |
| GitHub Actions | CI/CD automation |
| Nginx | Frontend production server |
| Render | Deployment platform |

---

# 🚀 Local Development Setup

## Prerequisites
- Node.js >= 18
- Docker & Docker Compose
- MongoDB Atlas account (or local MongoDB)
- Google Gemini API key

---

# 1️⃣ Clone Repository

```bash
git clone https://github.com/Akshay4754/GapWiseAI.git
cd GapWiseAI
```

---

# 2️⃣ Backend Setup

```bash
cd Backend
npm install
```

Create `.env` inside `Backend/`

```env
PORT=3000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
GOOGLE_GENAI_API_KEY=your_gemini_api_key
FRONTEND_ORIGIN=http://localhost:5173
```

Run backend:

```bash
npm run dev
```

---

# 3️⃣ Frontend Setup

```bash
cd Frontend
npm install
```

Create `.env` inside `Frontend/`

```env
VITE_API_URL=http://localhost:3000
```

Run frontend:

```bash
npm run dev
```

Frontend runs at:

```bash
http://localhost:5173
```

---

# 🐳 Docker Setup

## Run Full Application

```bash
docker-compose up --build
```

## Build Containers Individually

### Backend

```bash
docker build -t gapwise-backend ./Backend
```

### Frontend

```bash
docker build -t gapwise-frontend ./Frontend
```

---

# ⚙️ CI/CD Pipeline

GitHub Actions workflow automatically:

- ✅ Installs dependencies
- ✅ Runs Jest tests
- ✅ Builds Docker images
- ✅ Pushes Docker images (after successful tests)

Workflow file:

```bash
.github/workflows/ci.yml
```

---

# 🔐 Required GitHub Secrets

Go to:

```bash
GitHub Repo → Settings → Secrets → Actions
```

Add:

```env
DOCKER_USERNAME
DOCKER_PASSWORD
MONGO_URI_TEST
```

---

# 📁 Updated Project Structure

```bash
GapWiseAI/
├── .github/
│   └── workflows/
│       └── ci.yml                 # GitHub Actions CI/CD pipeline
│
├── docker-compose.yml             # Multi-container orchestration
│
├── Backend/
│   ├── Dockerfile                 # Backend container setup
│   ├── .env.example               # Environment variables template
│   ├── package.json
│   ├── server.js                  # Backend entry point
│   ├── tests/
│   │   └── api.test.js            # Jest + Supertest tests
│   │
│   └── src/
│       ├── config/                # MongoDB configuration
│       ├── controllers/           # Route handlers
│       ├── middlewares/           # JWT middleware
│       ├── models/                # Mongoose models
│       ├── routes/                # Express routes
│       ├── services/              # Gemini AI & PDF generation
│       └── app.js                 # Express app configuration
│
├── Frontend/
│   ├── Dockerfile                 # Frontend container setup
│   ├── nginx.conf                 # Nginx production config
│   ├── package.json
│   ├── public/
│   │   └── _redirects             # SPA routing fix
│   │
│   └── src/
│       ├── features/
│       │   ├── auth/              # Authentication feature
│       │   └── interview/         # Interview dashboard
│       │
│       └── app.routes.jsx         # React routes
│
└── README.md
```

---

# 🌐 Deployment

## Backend — Render Web Service

| Setting | Value |
|---|---|
| Root Directory | `Backend` |
| Build Command | `npm install` |
| Start Command | `npm start` |

### Environment Variables

```env
MONGO_URI
JWT_SECRET
GOOGLE_GENAI_API_KEY
FRONTEND_ORIGIN=https://your-frontend-url.onrender.com
```

---

## Frontend — Render Static Site

| Setting | Value |
|---|---|
| Root Directory | `Frontend` |
| Build Command | `npm install && npm run build` |
| Publish Directory | `dist` |

### Environment Variables

```env
VITE_API_URL=https://your-backend-url.onrender.com
```

---

# 🧪 Running Tests

```bash
npm test
```

Uses:

- Jest
- Supertest

Test location:

```bash
Backend/tests/api.test.js
```

---

# 🔑 API Endpoints

## Auth Routes

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login user |
| GET | `/api/auth/logout` | Logout user |
| GET | `/api/auth/get-me` | Current user |

---

## Interview Routes

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/interview/` | Generate interview report |
| GET | `/api/interview/` | Fetch all reports |
| GET | `/api/interview/report/:id` | Fetch single report |
| POST | `/api/interview/resume/pdf/:id` | Generate resume PDF |

---

# 🧠 AI Workflow

1. User uploads resume + job description
2. Backend sends structured prompt to Gemini AI
3. AI generates:
   - Match score
   - Technical questions
   - Behavioral questions
   - Skill gaps
   - Preparation roadmap
4. Resume HTML generated
5. Puppeteer converts HTML → ATS-friendly PDF

---

