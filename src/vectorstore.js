import { promises as fs } from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

// Simple local JSON-file vector store with in-process cosine-similarity
// search. No external database, no signup, no cost -- good fit for a
// project-scale knowledge base (up to a few thousand chunks).
//
// NOTE: this is not built for high concurrency or huge datasets. For a
// production system with heavy traffic or millions of vectors, a real
// vector database (Pinecone, Qdrant, etc.) is the right call. For a demo
// or student project, this keeps things simple and free.

let cache = null; // in-memory array of { id, values, metadata }
let writeQueue = Promise.resolve(); // serializes writes to avoid corruption

async function ensureFile() {
  const dir = path.dirname(config.vectorStore.path);
  await fs.mkdir(dir, { recursive: true });
  try {
    await fs.access(config.vectorStore.path);
  } catch {
    await fs.writeFile(config.vectorStore.path, '[]', 'utf-8');
  }
}

async function loadAll() {
  if (cache) return cache;
  await ensureFile();
  const raw = await fs.readFile(config.vectorStore.path, 'utf-8');
  try {
    cache = JSON.parse(raw || '[]');
  } catch {
    cache = [];
  }
  return cache;
}

function persist() {
  writeQueue = writeQueue.then(() =>
    fs.writeFile(config.vectorStore.path, JSON.stringify(cache), 'utf-8')
  );
  return writeQueue;
}

function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
}

/**
 * Upsert vectors into the local store.
 * @param {{id: string, values: number[], metadata: object}[]} vectors
 */
export async function upsertVectors(vectors) {
  if (!vectors.length) return;
  const all = await loadAll();
  const byId = new Map(all.map((r) => [r.id, r]));
  for (const v of vectors) byId.set(v.id, v);
  cache = Array.from(byId.values());
  await persist();
}

/**
 * Find the topK most similar vectors by cosine similarity.
 * @param {number[]} vector - query embedding
 * @param {number} topK
 */
export async function queryVectors(vector, topK = config.rag.topK) {
  const all = await loadAll();
  const scored = all.map((r) => ({
    id: r.id,
    score: cosineSimilarity(vector, r.values),
    metadata: r.metadata,
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

/** Delete all vectors belonging to a single ingested document. */
export async function deleteByDocumentId(documentId) {
  const all = await loadAll();
  cache = all.filter((r) => r.metadata?.documentId !== documentId);
  await persist();
}

/** Basic stats: total vector count and dimension. */
export async function getIndexStats() {
  const all = await loadAll();
  return {
    totalRecordCount: all.length,
    dimension: all[0]?.values?.length || config.embedding.dimension,
  };
}
