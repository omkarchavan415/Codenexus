# CodeNexus

An adaptive placement-preparation platform. A student sets a goal (company, days left, hours per day), takes a subject-based diagnostic test, sees how their skills compare with the company's requirement profile, and gets a day-by-day roadmap with LeetCode problems. After each retest the remaining days are re-planned and the previous plan is kept as a version.

- **Frontend:** React 18, Vite, React Router, Tailwind, Recharts
- **Backend:** Node 22, Express, Mongoose, zod, JWT (access + rotating refresh), Helmet, rate limiting, pino
- **Data and queues:** MongoDB, optional Redis + BullMQ
- **AI:** Gemini (optional) generates questions that an admin must approve before any student sees them

## How it works

```
 Student                      React SPA (Vite)                    Express API                       Stores
 -------                      ----------------                    -----------                       ------
 set goal ───────────────────▶ Onboarding ────── PUT /me/goal ───▶ users
 take test ──────────────────▶ Test runner ───── POST /tests/start ▶ selector ──▶ questions (approved only)
                                                                         │ needs more questions?
                                                                         ▼
                                                          generation queue ──▶ Gemini ──▶ questions (pending)
                                                          (BullMQ if REDIS_URL,                     │
                                                           else in-process)                  admin approves
 submit ─────────────────────▶ Result page ──── POST /tests/:id/submit ▶ score ─▶ skill update ─▶ skills
 gap + plan ─────────────────▶ Roadmap ──────── POST /roadmap/generate ▶ gap ─▶ planner ─▶ roadmaps (versioned)
 solve problems ─────────────▶ Today / Roadmap ─ PUT /roadmap/problems/:id/solved ▶ problem progress
 retest ─────────────────────▶ ... ──────────── POST /roadmap/reschedule ▶ new version for remaining days
```

### Core rules

| Rule | Where |
| --- | --- |
| Tests are by subject/subtopic, never by company | `services/selector.js`, `services/testService.js` |
| Skill update: `level += 0.3 × (score − level)`, default level 0.5 | `services/skill.js` |
| Difficulty from skill: < 0.4 easy, < 0.7 medium, otherwise hard | `services/skill.js` |
| Question order on retest: unseen → nearest difficulty → Gemini generation → oldest seen | `services/selector.js` |
| Gap priority = weight (high 3, medium 2, low 1) × (1 − subject score) | `services/gap.js` |
| Days are split in proportion to priority; subtopics at or above 80% are skipped | `services/planner.js` |
| A day is made of resources, a hands-on task, LeetCode problems (DSA, SQL and a few OOP design problems only), one daily DSA warm-up on non-DSA days, and a short quiz on the last day of each block | `services/planner.js` |
| A quiz task starts a 5-question test on one subtopic; finishing it ticks the task and updates the skill level, without replacing the roadmap | `services/testService.js` |
| Every reschedule saves a new roadmap version (unique per user and version) | `services/roadmapService.js` |
| Gemini output is strict JSON, format-validated, de-duplicated by hash, verified by a second call, and saved as `pending` | `services/questionGenerator.js` |
| Answer keys are never sent before a test is submitted | `services/testService.js` |

## Quick start (Docker)

```bash
cp .env.example .env            # fill in the two JWT secrets
docker compose up --build
docker compose exec backend node seed/index.js
docker compose exec -e ADMIN_EMAIL=you@example.com -e ADMIN_PASSWORD='a-strong-password' backend node scripts/createAdmin.js
```

Open http://localhost:8080. The API is on http://localhost:5000 and `GET /health` reports database and Gemini status.

## Local development

Requires Node 20+ and a MongoDB (local, Docker, or Atlas).

```bash
# 1. backend
cd backend
cp .env.example .env            # set MONGODB_URI and the JWT secrets
npm install
npm run seed                    # questions, LeetCode problems, company profiles (idempotent)
npm run create-admin            # reads ADMIN_EMAIL / ADMIN_PASSWORD from .env
npm run dev                     # http://localhost:5000

# 2. frontend (second terminal)
cd frontend
npm install
npm run dev                     # http://localhost:5173, proxies /api to :5000
```

Start MongoDB quickly with `docker run -d -p 27017:27017 mongo:7`, and Redis (optional) with `docker run -d -p 6379:6379 redis:7-alpine`.

## Environment variables

### Backend (`backend/.env`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `NODE_ENV` | `development` | `production` in deployments |
| `PORT` | `5000` | API port |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/codenexus` | MongoDB connection string |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | required, 16+ chars | Token signing secrets. Use two different long random values |
| `ACCESS_TOKEN_TTL` | `15m` | Access token lifetime |
| `REFRESH_TOKEN_TTL_DAYS` | `7` | Refresh token lifetime |
| `BCRYPT_ROUNDS` | `12` | Password hashing cost |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed origins |
| `RATE_LIMIT_ENABLED`, `RATE_LIMIT_MAX`, `AUTH_RATE_LIMIT_MAX` | `true`, `300`, `20` | Requests per window, general and auth routes |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | empty | Both are needed to enable generation. The model name is yours to choose, so check the model list for your key |
| `GEMINI_TIMEOUT_MS` | `20000` | Per-call timeout |
| `REDIS_URL` | empty | Enables the BullMQ generation queue and shared cache. Empty means an in-process queue and memory cache |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | empty | Used only by `npm run create-admin` |
| `LOG_LEVEL` | `info` | pino level |

### Frontend (`frontend/.env`)

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | API origin when the frontend is hosted separately. Empty means same origin |
| `VITE_PROXY_TARGET` | Dev server proxy target (default `http://localhost:5000`) |

## Content

- **Questions:** 204 seeded questions with explanations, 6 per subtopic (2 easy, 2 medium, 2 hard) across DSA, OOP, DBMS, SQL, OS and CN (34 subtopics).
- **Problems:** 197 LeetCode problems: DSA and SQL for every subtopic (at least 2 each), plus 9 class-design problems for OOP. LeetCode has no problems that test DBMS, OS or networking theory, so those subjects get none. Earlier versions mapped loosely related problems to them (for example "Valid Sudoku" under ER Model); the seed now deactivates those.
- **Study items:** 96 items. Every subtopic has a Wikipedia reading and a YouTube lecture search (a search page never goes dead), DSA/SQL subtopics have an interactive practice link, and every OOP, DBMS, OS and CN subtopic has at least one hands-on practical (normalise a table, draw Gantt charts, subnet by hand, and so on). Replace the lecture searches with specific videos you trust from the admin Study items screen.
- **Companies:** TCS, Infosys, Accenture, Wipro, Cognizant, Amazon, Google, Microsoft and General Placement. The subject weights are a curated approximation of what each company tests, not official data. Edit them in the admin panel.

Upgrading an existing database: run `npm run seed` again. It is idempotent, adds the study items, and deactivates the retired problems. Then press "Reschedule" on the roadmap to get a plan with the new task kinds.

LeetCode URLs and resource links were written from known slugs and titles and have not been checked against the live sites. After seeding, run:

```bash
cd backend && npm run verify:problems
```

It requests every problem URL and every resource link (except YouTube searches) and lists any that fail, so you can fix or deactivate them in the admin Problems and Study items screens.

## Testing

```bash
cd backend
npm run test:unit                               # no database needed
TEST_MONGODB_URI=mongodb://127.0.0.1:27017/codenexus_test npm run test:integration
npm test                                        # both
cd ../frontend && npm test && npm run build
```

Integration tests need a real MongoDB (`TEST_MONGODB_URI`, or an in-memory server where one can be downloaded). Without either they are skipped and say so. CI (`.github/workflows/ci.yml`) runs them against a Mongo service container.

## API reference

All routes are under `/api`. Authenticated routes take `Authorization: Bearer <access token>`. Errors are `{ error: { code, message, details? } }`.

### Auth
| Method | Path | Notes |
| --- | --- | --- |
| POST | `/auth/register` | name, email, password. Returns user and tokens |
| POST | `/auth/login` | Returns user and tokens |
| POST | `/auth/refresh` | Rotates the refresh token. Reusing an old one revokes the session |
| POST | `/auth/logout` | Revokes the refresh token |

### Student
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/subjects` | Subjects and subtopics |
| GET | `/companies` | Active company profiles (cached) |
| GET / PATCH | `/me` | Name, timezone, settings |
| PUT | `/me/goal` | company, days until deadline, hours per day |
| POST | `/me/password` | Change password |
| GET | `/me/dashboard` | Skills, streak, days left, plan progress |
| POST | `/tests/start` | subject, count, optional time limit, optional `subtopic` for a one-topic quiz. Returns questions without answers |
| GET | `/tests` | Past attempts |
| GET | `/tests/:id` | Result with explanations once submitted |
| POST | `/tests/:id/submit` | Scores, updates skills |
| GET | `/skills`, `/progress` | Skill levels and score history |
| POST | `/roadmap/generate` | Gap analysis and a new plan |
| POST | `/roadmap/reschedule` | Re-plan the remaining days as a new version |
| GET | `/roadmap` | Active roadmap |
| GET | `/roadmap/versions`, `/roadmap/versions/:version` | History |
| GET | `/roadmap/today` | Today's plan with overdue tasks and reschedule hint |
| PUT | `/roadmap/problems/:problemId/solved` | Mark solved or unsolved |
| PUT | `/roadmap/items/:itemId/done` | Mark a resource or practical done or not done |

### Admin (role `admin`)
| Method | Path | Notes |
| --- | --- | --- |
| GET, POST | `/admin/questions` | List with filters and paging, create |
| PUT, DELETE | `/admin/questions/:id` | Edit. Delete archives questions students have already seen |
| POST | `/admin/questions/:id/review`, `/admin/questions/bulk-review` | Approve or reject pending questions |
| PATCH | `/admin/questions/:id/flag` | Flag or clear a question |
| POST | `/admin/questions/import` | CSV or JSON, up to 500 rows, row-level errors |
| POST | `/admin/generate` | Ask Gemini for questions. They arrive as pending |
| GET | `/admin/quality` | timesAsked, timesCorrect, accuracy and flags |
| GET, POST, PUT, DELETE | `/admin/companies[/:id]` | Company profiles. Companies in use are deactivated, not deleted |
| GET, POST, PUT, DELETE | `/admin/problems[/:id]` | LeetCode problems |
| GET, POST, PUT, DELETE | `/admin/study-items[/:id]` | Resources and practicals. Items students finished are archived, not erased |
| GET | `/admin/stats` | Platform counts |

CSV import columns: `subject,subtopic,difficulty,text,optionA,optionB,optionC,optionD,correct,explanation` with `correct` as A to D.

### Operations
`GET /health` returns 200 with `status: ok` when MongoDB is connected, otherwise 503.

## Deployment

### MongoDB Atlas
1. Create a free cluster, a database user, and allow your API host's IP (or `0.0.0.0/0` while testing).
2. Copy the connection string, with the database name `codenexus`, into `MONGODB_URI`.

### API on Render
1. New Web Service from this repo, root directory `backend`, runtime Node, build `npm ci`, start `node src/server.js`. (Or choose Docker with `backend/Dockerfile`.)
2. Set env vars: `NODE_ENV=production`, `MONGODB_URI`, both JWT secrets, `CORS_ORIGINS=https://<your-vercel-domain>`, and optionally Gemini and `REDIS_URL` (a Render Key Value or Upstash Redis URL).
3. Health check path: `/health`.
4. From the service shell, run `node seed/index.js` once, then `ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/createAdmin.js`.

### Frontend on Vercel
1. Import the repo, root directory `frontend`, framework Vite (`vercel.json` already adds the SPA rewrite).
2. Set `VITE_API_URL=https://<your-render-service>.onrender.com`.
3. Add the Vercel domain to the API's `CORS_ORIGINS` and redeploy the API.

### Any Docker host
`docker compose up --build -d` runs the API, frontend (nginx, proxying `/api`), MongoDB and Redis. Put it behind HTTPS (Caddy or a cloud load balancer). For production use a managed MongoDB instead of the compose container.

## Security notes

Passwords are hashed with bcrypt. Refresh tokens are signed JWTs tracked server-side by id, rotated on every use, and reuse of an old one revokes the whole token family. All input is validated with zod. Helmet, CORS allow-listing and rate limiting (stricter on `/auth`) are on by default. Answer keys never leave the server before submission. Admin routes require the `admin` role, which can only be assigned with `create-admin`, never through registration. Gemini calls have timeouts and fall back to the approved bank, and generation jobs are idempotent (one job per subject/subtopic/difficulty, plus hash-based duplicate rejection).

## Project layout

```
backend/   src/{config,middleware,models,routes,services,utils}, seed/, scripts/, tests/
frontend/  src/{components,context,lib,pages,pages/admin}
docker-compose.yml   .github/workflows/ci.yml   .env.example
```
