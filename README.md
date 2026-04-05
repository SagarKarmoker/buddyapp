# Appifylab

A small social-style feed app: register, log in, and use a shared feed with posts (text and images), comments, replies, likes, and public or private posts. The UI follows the provided reference HTML for Login, Register, and Feed.

## What is included

- **Client** (`client/`): React with Vite and TypeScript. Pages for login, registration, and the feed. Protected routes so only signed-in users reach the feed.
- **Server** (`server/`): Express API with TypeScript, Prisma ORM, and SQLite.
- **CI** (`.github/workflows/ci.yml`): Builds server and client on push and pull requests to `main`, runs Prisma against a temporary SQLite file, and can call an OnRender deploy hook if you configure the secret.

## Decisions

- **React + Vite instead of Next.js**: Keeps the app as a separate SPA and API, which matches the task and keeps deployment flexible.
- **JWT in an httpOnly cookie**: The token is not stored in `localStorage`, which reduces exposure to XSS stealing credentials. `sameSite: lax` and `secure` in production are set on the cookie.
- **SQLite**: Chosen for a single-process setup and simple local development. For production on a host like OnRender, use a persistent disk and point `DATABASE_URL` at a file on that disk so data survives restarts.
- **Passwords**: Hashed with bcrypt before storage.
- **Private posts**: Stored with a visibility flag; only the author can see them in the API. Related checks apply for comments and likes on private posts.
- **Post images**: The client sends a base64 payload; the server decodes it and writes files under `server/uploads/`, then stores a URL path on the post.

## Running locally

1. **Server** — from `server/`:

   - Create `server/.env` with `DATABASE_URL` (e.g. `file:./prisma/dev.db`), `JWT_SECRET`, `PORT`, and `CLIENT_URL` (your Vite origin, often `http://localhost:5173`).
   - `npm install`
   - `npx prisma generate` and `npx prisma db push` (or your migration flow)
   - `npm run dev`

2. **Client** — from `client/`:

   - `npm install`
   - `npm run dev`

The Vite dev server proxies `/api` to the backend port (see `client/vite.config.ts`).

## Environment variables (server)

| Variable       | Purpose |
|----------------|---------|
| `DATABASE_URL` | Prisma SQLite connection string |
| `JWT_SECRET`   | Signing key for JWTs |
| `PORT`         | API port (default 3001) |
| `CLIENT_URL`   | Allowed CORS origin for the browser app |

Set a strong `JWT_SECRET` in any shared or production environment.
