import { promises as fs } from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

// Local JSON-file registry of ingested documents (one entry per upload),
// so the UI can list "what's in this subject" without scanning every
// chunk in the vector store.

const DOCUMENTS_PATH = process.env.DOCUMENTS_STORE_PATH
  || path.join(path.dirname(config.vectorStore.path), 'documents.json');

let cache = null;
let writeQueue = Promise.resolve();

async function ensureFile() {
  const dir = path.dirname(DOCUMENTS_PATH);
  await fs.mkdir(dir, { recursive: true });
  try {
    await fs.access(DOCUMENTS_PATH);
  } catch {
    await fs.writeFile(DOCUMENTS_PATH, '[]', 'utf-8');
  }
}

async function loadAll() {
  if (cache) return cache;
  await ensureFile();
  const raw = await fs.readFile(DOCUMENTS_PATH, 'utf-8');
  try {
    cache = JSON.parse(raw || '[]');
  } catch {
    cache = [];
  }
  return cache;
}

function persist() {
  writeQueue = writeQueue.then(() =>
    fs.writeFile(DOCUMENTS_PATH, JSON.stringify(cache, null, 2), 'utf-8')
  );
  return writeQueue;
}

export async function listDocuments(subjectId) {
  const all = await loadAll();
  return subjectId ? all.filter((d) => d.subjectId === subjectId) : all;
}

export async function registerDocument({ documentId, subjectId, name, chunkCount }) {
  const all = await loadAll();
  const entry = {
    documentId,
    subjectId: subjectId || null,
    name,
    chunkCount,
    uploadedAt: new Date().toISOString(),
  };
  cache = [...all.filter((d) => d.documentId !== documentId), entry];
  await persist();
  return entry;
}

export async function removeDocument(documentId) {
  const all = await loadAll();
  const removed = all.find((d) => d.documentId === documentId);
  cache = all.filter((d) => d.documentId !== documentId);
  await persist();
  return removed || null;
}
