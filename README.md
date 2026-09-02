# Inventory Manager

An internal inventory, invoice, and project-component tracking system with AI-assisted
invoice extraction (Google Gemini — free tier), built with Next.js (App Router), Prisma, and PostgreSQL.

## Stack

- **Framework:** Next.js 16 (App Router, API routes)
- **Database:** PostgreSQL via Prisma ORM
- **File storage:** Vercel Blob (invoice document uploads)
- **AI extraction:** Google Gemini (free tier available, no card required) for reading invoice images/PDFs
- **UI:** React 19, Tailwind CSS, Radix UI, TanStack Query/Table

## Local development

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment variables** — copy `.env.example` to `.env` and fill in:
   - `DATABASE_URL` / `DIRECT_URL` — a PostgreSQL database (see [Database setup](#database-setup))
   - `BLOB_READ_WRITE_TOKEN` — a Vercel Blob token (see [File storage setup](#file-storage-setup))
   - `GEMINI_API_KEY` — optional; without it, invoice upload still works but skips AI auto-extraction. Get a free key at https://aistudio.google.com/apikey
   - `APP_PASSWORD` — **strongly recommended**; without it the app has no login screen at all and anyone with the URL can view/edit everything (see [Access control](#access-control))

3. **Push the schema and seed sample data**
   ```bash
   npx prisma db push
   npm run db:seed   # optional — adds sample suppliers/products/invoices
   ```

4. **Run the dev server**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000

## Access control

The app has one shared password for the whole team (not per-user accounts) —
set `APP_PASSWORD` and everyone sees a login screen before anything else.
**If `APP_PASSWORD` is unset, the app has no login gate at all** — fine for
local development, not fine for a deployed URL people outside your team
could stumble onto. Set it in Vercel's Environment Variables before sharing
the deployed link.

A separate `AUTH_SECRET` (random string) is used to sign the login session
cookie; if you skip it, `APP_PASSWORD` is reused for signing, which still
works but means changing the password logs everyone out immediately (usually
fine for a small team).

## Database setup

This project needs a real PostgreSQL database — it will **not** work with SQLite on
Vercel (serverless filesystems are ephemeral and read-only in production).

Recommended: **Neon** (serverless Postgres), connected via the Vercel Marketplace
integration — this auto-populates the right environment variables in your Vercel
project, including a pooled connection for the app and a direct connection for
schema pushes. See [Deploying to Vercel](#deploying-to-vercel) below for exact steps.

## File storage setup

Invoice documents (images/PDFs) are stored in **Vercel Blob**, not on disk — Vercel's
serverless functions don't share or persist a local filesystem across requests.
Connect a Blob store to your Vercel project (see below) and `BLOB_READ_WRITE_TOKEN`
is injected automatically.

## Deploying to Vercel

See the full step-by-step deployment guide (GitHub push, Vercel project setup,
database + blob storage provisioning, environment variables, and post-deploy
verification) provided separately by your Claude conversation, or ask Claude to
regenerate it — the key steps are:

1. Push this repo to GitHub.
2. Import the repo in Vercel.
3. Add the **Neon** integration (Storage tab) → auto-fills `DATABASE_URL` / `DIRECT_URL` / etc.
4. Add a **Blob store** (Storage tab) → auto-fills `BLOB_READ_WRITE_TOKEN`.
5. Add `GEMINI_API_KEY` manually (Settings → Environment Variables) — get a free key at aistudio.google.com/apikey.
6. Add `APP_PASSWORD` (and optionally `AUTH_SECRET`) manually — see [Access control](#access-control). Skipping this leaves the deployed app open to anyone with the URL.
7. Deploy. Vercel runs `prisma generate && prisma db push && next build` automatically.

## Project structure

```
src/app/api/          API routes (products, invoices, projects, dashboard, search, excel, settings)
src/app/               Pages (App Router)
src/lib/db.ts          Prisma client singleton
src/lib/storage.ts     Vercel Blob upload/delete helpers
src/lib/ai-extractor.ts  Gemini-based invoice OCR/extraction
src/lib/excel.ts       XLSX import/export
prisma/schema.prisma   Database schema (PostgreSQL)
prisma/seed.ts         Sample data seeder
```

## Scripts

| Command              | Description                                   |
|-----------------------|------------------------------------------------|
| `npm run dev`          | Start local dev server                        |
| `npm run build`        | Prisma generate + db push + Next.js build     |
| `npm run start`        | Start production server (after build)         |
| `npm run lint`         | Run ESLint                                    |
| `npm run db:push`      | Push schema changes to the database           |
| `npm run db:studio`    | Open Prisma Studio (visual DB browser)        |
| `npm run db:seed`      | Seed sample data                              |
