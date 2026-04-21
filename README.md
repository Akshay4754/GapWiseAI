# GapWise AI 🎯

> **AI-powered interview preparation platform** — upload your resume, paste the job description, and get a personalized interview report, predicted questions, skill gap analysis, and a tailored resume PDF — all in seconds.

![GapWise AI](https://img.shields.io/badge/Status-Live-brightgreen?style=for-the-badge)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=node.js)
![React](https://img.shields.io/badge/Frontend-React%20+%20Vite-61DAFB?style=for-the-badge&logo=react)
![MongoDB](https://img.shields.io/badge/Database-MongoDB-47A248?style=for-the-badge&logo=mongodb)
![Google Gemini](https://img.shields.io/badge/AI-Google%20Gemini-4285F4?style=for-the-badge&logo=google)

---

## ✨ Features

- 🔐 **Auth System** — Secure JWT-based login & registration
- 📄 **Resume Upload** — Upload your existing resume (PDF/text)
- 🤖 **AI Interview Report** — Gemini AI generates:
  - Match score (0–100) between your profile and the job
  - Technical questions with answers and interviewer intent
  - Behavioral questions with STAR-format guidance
  - Skill gap analysis with severity levels
  - 5-day personalized preparation plan
- 📥 **Resume PDF Generator** — Download an ATS-friendly, tailored resume PDF
- 📚 **Report History** — View all past interview reports

---

## 🛠️ Tech Stack

### Backend
| Technology | Purpose |
|---|---|
| Node.js + Express | REST API server |
| MongoDB + Mongoose | Database |
| JWT + bcryptjs | Authentication |
| Google Gemini AI (`@google/genai`) | AI report & resume generation |
| Puppeteer Core + Chromium | HTML → PDF conversion |
| Multer | Resume file uploads |
| Zod | Schema validation |

### Frontend
| Technology | Purpose |
|---|---|
| React 19 + Vite | UI framework |
| React Router v7 | Client-side routing |
| Axios | HTTP requests |
| SASS | Styling |

---

## 🚀 Getting Started (Local Development)

### Prerequisites
- Node.js >= 18
- MongoDB Atlas account (or local MongoDB)
- Google Gemini API key → [Get one here](https://aistudio.google.com/app/apikey)

### 1. Clone the repo
```bash
git clone https://github.com/Akshay4754/GapWiseAI.git
cd your-repo-name
```

### 2. Setup Backend
```bash
cd Backend
npm install
```

Create a `.env` file inside `Backend/`:
```env
PORT=3000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
GOOGLE_GENAI_API_KEY=your_gemini_api_key
FRONTEND_ORIGIN=http://localhost:5173
```

Start the backend:
```bash
npm run dev
```

### 3. Setup Frontend
```bash
cd Frontend
npm install
```

Create a `.env` file inside `Frontend/`:
```env
VITE_API_URL=http://localhost:3000
```

Start the frontend:
```bash
npm run dev
```

App will be live at `http://localhost:5173`

---

## 📁 Project Structure

```
YT-GENAI/
├── Backend/
│   ├── src/
│   │   ├── config/         # Database connection
│   │   ├── controllers/    # Route handlers (auth, interview)
│   │   ├── middlewares/    # JWT auth middleware
│   │   ├── models/         # Mongoose models (User, Interview, Blacklist)
│   │   ├── routes/         # Express routers
│   │   ├── services/       # AI & PDF generation logic
│   │   └── app.js          # Express app setup (CORS, routes)
│   ├── server.js           # Entry point
│   └── package.json
│
└── Frontend/
    ├── src/
    │   ├── features/
    │   │   ├── auth/       # Login, Register, Protected routes, useAuth hook
    │   │   └── interview/  # Interview report UI & API services
    │   └── app.routes.jsx  # Route definitions
    ├── public/
    │   └── _redirects      # Render SPA routing fix
    └── package.json
```

---

## 🌐 Deployment (Render)

This project is deployed on [Render](https://render.com) as two separate services:

### Backend — Web Service
| Setting | Value |
|---|---|
| Root Directory | `Backend` |
| Build Command | `npm install` |
| Start Command | `npm start` |

**Environment Variables to set on Render:**
```
MONGO_URI
JWT_SECRET
GOOGLE_GENAI_API_KEY
FRONTEND_ORIGIN=https://gapwise-frontend.onrender.com
```

### Frontend — Static Site
| Setting | Value |
|---|---|
| Root Directory | `Frontend` |
| Build Command | `npm install && npm run build` |
| Publish Directory | `dist` |

**Environment Variables to set on Render:**
```
VITE_API_URL=https://gapwise-backend.onrender.com
```

---

## 🔑 API Endpoints

### Auth
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Register new user |
| POST | `/api/auth/login` | Public | Login user |
| GET | `/api/auth/logout` | Private | Logout user |
| GET | `/api/auth/get-me` | Private | Get current user |

### Interview
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/interview/` | Private | Generate interview report |
| GET | `/api/interview/` | Private | Get all reports |
| GET | `/api/interview/report/:id` | Private | Get report by ID |
| POST | `/api/interview/resume/pdf/:id` | Private | Download resume PDF |

---

## 🧠 How the AI Works

1. User provides **job description**, **self description**, and optionally a **resume file**
2. Backend sends a structured prompt to **Google Gemini** with a strict JSON schema (via Zod)
3. Gemini returns a validated JSON report with questions, skill gaps, and preparation plan
4. For the resume PDF, Gemini generates custom HTML → converted to PDF via **Puppeteer + Chromium**
5. Fallback responses are used if the AI is temporarily unavailable (rate limits, etc.)

---


