import { Router } from 'express';
import { generateQuiz, getQuiz, scoreQuiz, listQuizAttempts } from '../src/quizService.js';

const router = Router();

// POST /api/quiz/generate  { subjectId, count?, difficulty? }
router.post('/generate', async (req, res) => {
  try {
    const { subjectId, count, difficulty } = req.body || {};
    if (!subjectId) return res.status(400).json({ error: 'subjectId is required.' });
    const quiz = await generateQuiz({ subjectId, count, difficulty });
    res.json({ success: true, quiz });
  } catch (err) {
    console.error('[quiz/generate] error:', err);
    res.status(500).json({ error: err.message || 'Quiz generation failed.' });
  }
});

// GET /api/quiz/:quizId
router.get('/:quizId', async (req, res) => {
  try {
    const quiz = await getQuiz(req.params.quizId);
    if (!quiz) return res.status(404).json({ error: 'Quiz not found.' });
    res.json({ success: true, quiz });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to load quiz.' });
  }
});

// POST /api/quiz/:quizId/submit  { answers: [{questionIndex, selectedIndex}] }
router.post('/:quizId/submit', async (req, res) => {
  try {
    const { answers } = req.body || {};
    if (!Array.isArray(answers)) return res.status(400).json({ error: 'answers array is required.' });
    const attempt = await scoreQuiz(req.params.quizId, answers);
    res.json({ success: true, attempt });
  } catch (err) {
    console.error('[quiz/submit] error:', err);
    res.status(500).json({ error: err.message || 'Scoring failed.' });
  }
});

// GET /api/quiz/history/:subjectId
router.get('/history/:subjectId', async (req, res) => {
  try {
    const attempts = await listQuizAttempts(req.params.subjectId);
    res.json({ success: true, attempts });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to load history.' });
  }
});

export default router;
