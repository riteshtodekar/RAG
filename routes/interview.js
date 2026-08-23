import { Router } from 'express';
import { startInterview, getInterview, submitInterviewAnswer } from '../src/interviewService.js';

const router = Router();

// POST /api/interview/start  { subjectId?, jdText?, numQuestions? }
router.post('/start', async (req, res) => {
  try {
    const { subjectId, jdText, numQuestions } = req.body || {};
    const session = await startInterview({ subjectId, jdText, numQuestions });
    res.json({
      success: true,
      sessionId: session.id,
      firstQuestion: session.questions[0],
      total: session.questions.length,
    });
  } catch (err) {
    console.error('[interview/start] error:', err);
    res.status(500).json({ error: err.message || 'Failed to start interview.' });
  }
});

// GET /api/interview/:sessionId
router.get('/:sessionId', async (req, res) => {
  try {
    const session = await getInterview(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found.' });
    res.json({ success: true, session });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to load session.' });
  }
});

// POST /api/interview/:sessionId/answer  { answer }
router.post('/:sessionId/answer', async (req, res) => {
  try {
    const { answer } = req.body || {};
    if (!answer || !answer.trim()) return res.status(400).json({ error: 'answer is required.' });
    const result = await submitInterviewAnswer(req.params.sessionId, answer);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[interview/answer] error:', err);
    res.status(500).json({ error: err.message || 'Failed to submit answer.' });
  }
});

export default router;
