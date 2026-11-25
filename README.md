# myvault

A private, single-user personal vault for notes, code snippets, documents, and binary files — built with **Next.js App Router**, **TypeScript**, **Tailwind CSS**, **Shiki**, and **Vercel Blob (Private)**.

## Architecture & Security Highlights

- **No External Database**: All metadata (`myvault/metadata/vault-index.json`) and file binaries (`myvault/objects/YYYY/<uuid>`) are stored exclusively in **Private Vercel Blob**.
- **Single-User Argon2id Authentication**: Password verification uses `@node-rs/argon2` (Argon2id) against `VAULT_PASSWORD_HASH`.
- **Signed HttpOnly Session Cookies**: Sessions (`myvault_session`) are signed with HMAC-SHA256 (`AUTH_SECRET`) using Node.js `crypto` with timing-safe verification.
- **Best-Effort Rate Limiting**: Login endpoint enforces per-IP attempt limits with lockout and progressive delay.
- **Safe File Serving**: All previews and downloads are proxied through authenticated Next.js API routes. Active web formats (`.html`, `.svg`) are never inline-rendered as trusted DOM/images.
- **Optimistic Concurrency**: Metadata writes use ETag-based `ifMatch` checks with automatic retry and pre-mutation backup snapshots.

## Local Development Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Generate Password Hash & Auth Secret

Run the interactive password hash generator:

```bash
npm run vault:hash-password
```

Generate a strong `AUTH_SECRET` (minimum 32 characters):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### 3. Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```env
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
VAULT_PASSWORD_HASH=$argon2id$v=19$m=19456,t=2,p=1$...
AUTH_SECRET=your-random-secret-at-least-32-characters
SESSION_MAX_AGE_SECONDS=604800
MAX_UPLOAD_SIZE_MB=100
```

> **Note:** `BLOB_READ_WRITE_TOKEN` must point to a **Private** Vercel Blob store.

### 4. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with your configured vault password.

## Verification Commands

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Vercel Deployment Checklist

1. Create a **Private** Vercel Blob store in your Vercel project (**Storage → Blob → Private**).
2. Add the environment variables in Vercel Project Settings:
   - `BLOB_READ_WRITE_TOKEN` (automatically added when linking Blob store)
   - `VAULT_PASSWORD_HASH`
   - `AUTH_SECRET`
   - `SESSION_MAX_AGE_SECONDS` (optional, default `604800`)
   - `MAX_UPLOAD_SIZE_MB` (optional, default `100`)
3. Deploy via `vercel --prod` or Git integration.
