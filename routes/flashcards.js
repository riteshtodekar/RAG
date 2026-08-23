import { Router } from 'express';
import {
  generateFlashcards,
  listFlashcards,
  listDueFlashcards,
  reviewFlashcard,
} from '../src/flashcardService.js';

const router = Router();

// POST /api/flashcards/generate  { subjectId, count? }
router.post('/generate', async (req, res) => {
  try {
    const { subjectId, count } = req.body || {};
    if (!subjectId) return res.status(400).json({ error: 'subjectId is required.' });
    const cards = await generateFlashcards({ subjectId, count });
    res.json({ success: true, cards });
  } catch (err) {
    console.error('[flashcards/generate] error:', err);
    res.status(500).json({ error: err.message || 'Flashcard generation failed.' });
  }
});

// GET /api/flashcards?subjectId=
router.get('/', async (req, res) => {
  try {
    res.json({ success: true, cards: await listFlashcards(req.query.subjectId) });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to list flashcards.' });
  }
});

// GET /api/flashcards/due?subjectId=
router.get('/due', async (req, res) => {
  try {
    res.json({ success: true, cards: await listDueFlashcards(req.query.subjectId) });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to load due cards.' });
  }
});

// POST /api/flashcards/:id/review  { quality: 1|3|4|5 }
router.post('/:id/review', async (req, res) => {
  try {
    const { quality } = req.body || {};
    if (![1, 3, 4, 5].includes(quality)) {
      return res.status(400).json({ error: 'quality must be one of 1 (again), 3 (hard), 4 (good), 5 (easy).' });
    }
    const card = await reviewFlashcard(req.params.id, quality);
    res.json({ success: true, card });
  } catch (err) {
    console.error('[flashcards/review] error:', err);
    res.status(500).json({ error: err.message || 'Review failed.' });
  }
});

export default router;
