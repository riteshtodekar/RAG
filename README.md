# RAG App — Gemini Only (100% Free)

A ready-to-deploy Retrieval-Augmented Generation (RAG) application that runs entirely on **one free API key**:

- **Google Gemini** (`gemini-2.5-flash`) — generates grounded answers from retrieved context
- **Gemini's embedding model** (`gemini-embedding-001`) — turns your documents and questions into embeddings (same API key, no extra signup)
- **Local JSON file** — acts as the vector store, with cosine-similarity search done in plain JavaScript (no external database, no cost)
- **Node.js 22 + Express** — backend API and a minimal built-in test UI
- Deployable for free on **Render**, or on **Hostinger Node.js hosting**

No Voyage AI, no Pinecone, no other signups — just a Gemini API key from [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) (no credit card required).

---

## 1. What's included

```
rag-app/
├── server.js                 # Express app entry point
├── render.yaml                # Render Blueprint (one-click free deploy)
├── ecosystem.config.cjs      # PM2 process config (Hostinger uses PM2 under the hood)
├── package.json
├── .env.example               # copy to .env and fill in your key
├── routes/
│   ├── ingest.js              # POST /api/ingest/text, /api/ingest/file, DELETE /:id
│   └── chat.js                # POST /api/chat
├── src/
│   ├── config.js               # loads & validates env vars
│   ├── embeddings.js           # Gemini embeddings client
│   ├── vectorstore.js          # local JSON-file vector store + cosine similarity search
│   ├── llm.js                  # Gemini generation wrapper
│   ├── chunker.js               # text chunking (recursive splitter + overlap)
│   ├── extractText.js           # extracts text from txt/md/pdf uploads
│   └── ragService.js            # ties it all together: ingest + answer pipelines
├── data/                       # vectorstore.json lives here at runtime (gitignored)
├── scripts/
│   └── ingest-sample.js        # smoke test: ingests a sample doc and asks a question
└── public/                     # minimal test UI (paste text / upload file / chat)
```

## 2. Get your API key

Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey), sign in with a Google account, and generate a key. That's the only key this app needs.

## 3. Local setup

```bash
npm install
cp .env.example .env
# edit .env and paste in your GEMINI_API_KEY
```

Run a smoke test (ingests one sample paragraph, asks a question, prints the answer):

```bash
npm run ingest-sample
```

Start the app:

```bash
npm start
```

Visit `http://localhost:3000` for the built-in test UI, or call the API directly (see below).

## 4. API reference

All endpoints are under `/api`. If you set `APP_API_KEY` in `.env`, every request must include header `x-api-key: <APP_API_KEY>`.

### `POST /api/ingest/text`
```json
{ "text": "Your document content...", "source": "optional label" }
```
→ `{ "success": true, "documentId": "...", "chunkCount": 5 }`

### `POST /api/ingest/file`
`multipart/form-data` with field `file` (`.txt`, `.md`, `.csv`, or `.pdf`).
→ same response shape as above.

### `DELETE /api/ingest/:documentId`
Removes all chunks belonging to that document from the vector store.

### `POST /api/chat`
```json
{ "question": "What does the doc say about X?", "topK": 5, "history": [] }
```
→
```json
{
  "success": true,
  "answer": "...",
  "sources": [{ "index": 1, "source": "...", "score": 0.83, "preview": "..." }]
}
```

### `GET /api/health` / `GET /api/stats`
Health check and vector store stats (record count, dimension).

## 5. Deploying to Render (free)

`render.yaml` is included so Render can deploy this automatically as a Blueprint.

1. **Push this project to a GitHub repo** (make sure `.env` and `node_modules` are excluded — `.gitignore` already handles this).

2. **Create the Blueprint**
   Go to https://dashboard.render.com → **New** → **Blueprint** → connect the repo. Render reads `render.yaml` and pre-fills a free web service named `rag-app`.

3. **Fill in the secret env vars**
   You'll be prompted for:
   - `GEMINI_API_KEY` — your key from AI Studio
   - `APP_API_KEY` (optional — leave blank to disable the `x-api-key` check)

4. **Deploy**
   Click **Apply**. Render builds and starts the app; you'll get a URL like `https://rag-app.onrender.com`.

5. **Verify**
   Visit `https://<your-app>.onrender.com/api/health` → `{"status":"ok",...}`. The root URL serves the built-in test UI.

### Free tier limitations to know
- The service **spins down after ~15 minutes of no traffic** and takes 30–50s to wake up on the next request.
- Free plan gives **750 instance-hours/month**, and **no credit card is required**.
- **The vector store resets on redeploy/restart** since Render's free filesystem is ephemeral. This is fine for a demo or project submission — just re-ingest your content after a redeploy. If you need data to survive restarts, Render's paid persistent disks or switching to a real database are the options later.
- **Gemini's free tier has fairly tight rate limits** (roughly 5–15 requests/minute and 20–1,000/day depending on the model, as of early 2026) — plenty for demoing a project to a few people, not for real production traffic. If you hit `429` errors, wait a minute and retry.

## 6. Deploying to Hostinger (Node.js hosting)

1. **Create the Node.js app in hPanel**
   hPanel → **Websites** → your site → **Advanced → Node.js** → **Create Application**. Choose **Node.js 22.x**, set the application root, and set the **startup file** to `server.js`.

2. **Upload your project**
   Upload a zip of this project (excluding `node_modules` and `.env`) via File Manager, or use SFTP/Git if your plan supports it.

3. **Set environment variables**
   In the Node.js app screen, add `GEMINI_API_KEY` (and optionally `APP_API_KEY`) under **Environment variables**. Don't upload a `.env` file with real secrets.

4. **Install dependencies**
   Use hPanel's **NPM Install** button after upload.

5. **Start / restart the app**
   Use the **Start** button. `ecosystem.config.cjs` is included in case your plan lets you manage the process directly via PM2 over SSH.

6. **Point your domain/subdomain at the app**, then verify `https://your-domain/api/health`.

### Note on persistence for Hostinger
Unlike Render's free tier, Hostinger Node.js hosting typically gives you a persistent filesystem, so `data/vectorstore.json` should survive restarts there — a nice side benefit if you want ingested data to stick around.

## 7. Customizing

- **Chunk size / overlap** — `CHUNK_SIZE` / `CHUNK_OVERLAP` in `.env` (defaults: 1000 chars / 150 overlap).
- **Retrieval depth** — `TOP_K` in `.env`, or pass `topK` per-request to `/api/chat`.
- **Embedding dimension** — `EMBEDDING_DIMENSION` (768, 1536, or 3072 supported by `gemini-embedding-001`). Larger = slightly better retrieval quality, more storage.
- **Swap the LLM prompt** — edit `SYSTEM_INSTRUCTION` in `src/llm.js`.
- **Scale beyond a demo** — if you outgrow the local JSON store (thousands+ of chunks, concurrent heavy usage), swap `src/vectorstore.js` for a real vector database. The rest of the app (`ragService.js`, routes, UI) doesn't need to change since it only calls `upsertVectors` / `queryVectors` / `deleteByDocumentId`.
