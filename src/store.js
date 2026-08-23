import { promises as fs } from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

// Local JSON-file stores for generated study content and activity —
// quizzes, flashcards, and interview sessions — all following the same
// no-database pattern as vectorstore.js / subjects.js / documents.js.

const DIR = path.dirname(config.vectorStore.path);
const FILES = {
  quizzes: process.env.QUIZZES_STORE_PATH || path.join(DIR, 'quizzes.json'),
  quizAttempts: process.env.QUIZ_ATTEMPTS_STORE_PATH || path.join(DIR, 'quiz-attempts.json'),
  flashcards: process.env.FLASHCARDS_STORE_PATH || path.join(DIR, 'flashcards.json'),
  interviews: process.env.INTERVIEWS_STORE_PATH || path.join(DIR, 'interviews.json'),
};

const caches = {};
const writeQueues = {};

async function ensureFile(file) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  try {
    await fs.access(file);
  } catch {
    await fs.writeFile(file, '[]', 'utf-8');
  }
}

async function loadAll(key) {
  if (caches[key]) return caches[key];
  const file = FILES[key];
  await ensureFile(file);
  const raw = await fs.readFile(file, 'utf-8');
  try {
    caches[key] = JSON.parse(raw || '[]');
  } catch {
    caches[key] = [];
  }
  return caches[key];
}

function persist(key) {
  const file = FILES[key];
  writeQueues[key] = (writeQueues[key] || Promise.resolve()).then(() =>
    fs.writeFile(file, JSON.stringify(caches[key], null, 2), 'utf-8')
  );
  return writeQueues[key];
}

async function upsert(key, record, idField = 'id') {
  const all = await loadAll(key);
  caches[key] = [...all.filter((r) => r[idField] !== record[idField]), record];
  await persist(key);
  return record;
}

async function list(key, filterFn) {
  const all = await loadAll(key);
  return filterFn ? all.filter(filterFn) : all;
}

async function get(key, id, idField = 'id') {
  const all = await loadAll(key);
  return all.find((r) => r[idField] === id) || null;
}

async function remove(key, id, idField = 'id') {
  const all = await loadAll(key);
  caches[key] = all.filter((r) => r[idField] !== id);
  await persist(key);
}

export const store = { loadAll, upsert, list, get, remove };
