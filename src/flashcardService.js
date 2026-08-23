import { v4 as uuidv4 } from 'uuid';
import { sampleChunksForSubject } from './vectorstore.js';
import { generateStructured } from './llm.js';
import { store } from './store.js';

const CARDS_SCHEMA = {
  type: 'object',
  properties: {
    cards: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          front: { type: 'string' },
          back: { type: 'string' },
          topic: { type: 'string' },
        },
        required: ['front', 'back', 'topic'],
      },
    },
  },
  required: ['cards'],
};

const SYSTEM = `You create active-recall flashcards strictly from the provided study
material. "front" is a short question or prompt, "back" is a concise, complete
answer (1-3 sentences). "topic" is a short 2-4 word label for grouping.
Do not invent facts outside the material.`;

export async function generateFlashcards({ subjectId, count = 10 }) {
  const chunks = await sampleChunksForSubject(subjectId, Math.max(count * 1.5, 10));
  if (!chunks.length) {
    throw new Error('No ingested material found for this subject yet — add documents first.');
  }
  const contextBlock = chunks.map((c, i) => `[${i + 1}] ${c.metadata?.text || ''}`).join('\n\n');
  const prompt = `Study material:\n${contextBlock}\n\nGenerate exactly ${count} flashcards grounded only in the material above.`;

  const result = await generateStructured(prompt, CARDS_SCHEMA, SYSTEM, { maxOutputTokens: Math.max(1536, count * 140) });
  const now = new Date().toISOString();
  const cards = result.cards.slice(0, count).map((c) => ({
    id: uuidv4(),
    subjectId,
    front: c.front,
    back: c.back,
    topic: c.topic,
    createdAt: now,
    // SM-2 scheduling state
    repetition: 0,
    easeFactor: 2.5,
    intervalDays: 0,
    nextReviewAt: now, // due immediately until first review
  }));
  for (const card of cards) await store.upsert('flashcards', card);
  return cards;
}

export async function listFlashcards(subjectId) {
  return store.list('flashcards', subjectId ? (c) => c.subjectId === subjectId : undefined);
}

export async function listDueFlashcards(subjectId) {
  const all = await listFlashcards(subjectId);
  const now = Date.now();
  return all.filter((c) => new Date(c.nextReviewAt).getTime() <= now);
}

/**
 * SM-2 algorithm. quality: 0-5 (we map Again=1, Hard=3, Good=4, Easy=5).
 */
export async function reviewFlashcard(cardId, quality) {
  const card = await store.get('flashcards', cardId);
  if (!card) throw new Error('Flashcard not found.');

  let { repetition, easeFactor, intervalDays } = card;

  if (quality < 3) {
    repetition = 0;
    intervalDays = 1;
  } else {
    repetition += 1;
    if (repetition === 1) intervalDays = 1;
    else if (repetition === 2) intervalDays = 6;
    else intervalDays = Math.round(intervalDays * easeFactor);

    easeFactor = Math.max(
      1.3,
      easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    );
  }

  const nextReviewAt = new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000).toISOString();
  const updated = {
    ...card,
    repetition,
    easeFactor: Number(easeFactor.toFixed(2)),
    intervalDays,
    nextReviewAt,
    lastReviewedAt: new Date().toISOString(),
    lastQuality: quality,
  };
  await store.upsert('flashcards', updated);
  return updated;
}
