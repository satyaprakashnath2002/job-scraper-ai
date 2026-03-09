# Job Scraper — Frontend

Next.js + TypeScript + Tailwind. Connects to the Job Scraper FastAPI backend.

## Run locally

```bash
npm install
cp .env.local.example .env.local
# Set NEXT_PUBLIC_API_URL=http://127.0.0.1:8000 in .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy on Vercel / Netlify

1. Import this repo; set **Root Directory** to `job-scraper-frontend`.
2. Add env: **NEXT_PUBLIC_API_URL** = your backend URL (e.g. `https://your-api.onrender.com`).
3. Deploy. Then add your frontend URL to the backend **CORS_ORIGINS** env var.

## Build

```bash
npm run build
npm start
```
