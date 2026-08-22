import { Router } from 'express';
import { answerQuestion } from '../src/ragService.js';

const router = Router();

// POST /api/chat  { question, topK?, history? }
router.post('/', async (req, res) => {
  try {
    const { question, topK, history } = req.body || {};
    if (!question || typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({ error: 'Field "question" is required and must be a non-empty string.' });
    }
    const result = await answerQuestion(question, { topK, history });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[chat] error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate an answer.' });
  }
});

export default router;
