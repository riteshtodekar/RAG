import { promises as fs } from 'node:fs';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config.js';

// Local JSON-file registry for subjects/decks (e.g. "GATE - Theory of
// Computation", "ISTQB Foundation", "SDET Interview Bank"). Mirrors the
// same no-database philosophy as vectorstore.js.

const SUBJECTS_PATH = process.env.SUBJECTS_STORE_PATH
  || path.join(path.dirname(config.vectorStore.path), 'subjects.json');

const PALETTE = ['brass', 'sage', 'brick', 'ink'];

let cache = null;
let writeQueue = Promise.resolve();

async function ensureFile() {
  const dir = path.dirname(SUBJECTS_PATH);
  await fs.mkdir(dir, { recursive: true });
  try {
    await fs.access(SUBJECTS_PATH);
  } catch {
    await fs.writeFile(SUBJECTS_PATH, '[]', 'utf-8');
  }
}

async function loadAll() {
  if (cache) return cache;
  await ensureFile();
  const raw = await fs.readFile(SUBJECTS_PATH, 'utf-8');
  try {
    cache = JSON.parse(raw || '[]');
  } catch {
    cache = [];
  }
  return cache;
}

function persist() {
  writeQueue = writeQueue.then(() =>
    fs.writeFile(SUBJECTS_PATH, JSON.stringify(cache, null, 2), 'utf-8')
  );
  return writeQueue;
}

export async function listSubjects() {
  return loadAll();
}

export async function getSubject(id) {
  const all = await loadAll();
  return all.find((s) => s.id === id) || null;
}

export async function createSubject({ name, description = '' }) {
  if (!name || !name.trim()) throw new Error('Subject name is required.');
  const all = await loadAll();
  const subject = {
    id: uuidv4(),
    name: name.trim(),
    description: description.trim(),
    color: PALETTE[all.length % PALETTE.length],
    documentCount: 0,
    createdAt: new Date().toISOString(),
  };
  cache = [...all, subject];
  await persist();
  return subject;
}

export async function deleteSubject(id) {
  const all = await loadAll();
  cache = all.filter((s) => s.id !== id);
  await persist();
}

export async function bumpDocumentCount(id, delta) {
  const all = await loadAll();
  const subject = all.find((s) => s.id === id);
  if (!subject) return;
  subject.documentCount = Math.max(0, (subject.documentCount || 0) + delta);
  await persist();
}
