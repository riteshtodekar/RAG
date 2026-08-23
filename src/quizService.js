import { v4 as uuidv4 } from 'uuid';
import { sampleChunksForSubject } from './vectorstore.js';
import { generateStructured } from './llm.js';
import { store } from './store.js';

const QUIZ_SCHEMA = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          options: { type: 'array', items: { type: 'string' }, minItems: 4, maxItems: 4 },
          correctIndex: { type: 'integer' },
          explanation: { type: 'string' },
          topic: { type: 'string' },
        },
        required: ['question', 'options', 'correctIndex', 'explanation', 'topic'],
      },
    },
  },
  required: ['questions'],
};

const SYSTEM = `You are an exam-question writer creating multiple-choice questions strictly
from the provided study material. Each question must have exactly 4 options,
one correct answer (0-indexed), a short explanation, and a short topic label
(2-4 words, e.g. "Regular Languages", "Test Automation Basics") used later for
weak-area tracking. Do not invent facts outside the given material. Vary
difficulty and avoid trivial wording repeats between questions.`;

export async function generateQuiz({ subjectId, count = 8, difficulty = 'mixed' }) {
  const chunks = await sampleChunksForSubject(subjectId, Math.max(count * 2, 10));
  if (!chunks.length) {
    throw new Error('No ingested material found for this subject yet — add documents first.');
  }
  const contextBlock = chunks.map((c, i) => `[${i + 1}] ${c.metadata?.text || ''}`).join('\n\n');

  const prompt = `Study material:\n${contextBlock}\n\nGenerate exactly ${count} multiple-choice questions ` +
    `at ${difficulty} difficulty, grounded only in the material above.`;

  const result = await generateStructured(prompt, QUIZ_SCHEMA, SYSTEM);
  const quiz = {
    id: uuidv4(),
    subjectId,
    createdAt: new Date().toISOString(),
    difficulty,
    questions: result.questions.slice(0, count),
  };
  await store.upsert('quizzes', quiz);
  return quiz;
}

export async function getQuiz(quizId) {
  return store.get('quizzes', quizId);
}

/**
 * Score a submitted quiz with +3/-1/-0 rules (matches C-CAT style scoring)
 * and record per-topic accuracy for weak-area tracking.
 * @param {string} quizId
 * @param {{questionIndex:number, selectedIndex:number|null}[]} answers
 */
export async function scoreQuiz(quizId, answers) {
  const quiz = await store.get('quizzes', quizId);
  if (!quiz) throw new Error('Quiz not found.');

  let score = 0;
  let correct = 0;
  let incorrect = 0;
  let skipped = 0;
  const topicTally = {};
  const review = [];

  quiz.questions.forEach((q, idx) => {
    const submitted = answers.find((a) => a.questionIndex === idx);
    const selectedIndex = submitted ? submitted.selectedIndex : null;
    const isCorrect = selectedIndex === q.correctIndex;
    const attempted = selectedIndex !== null && selectedIndex !== undefined;

    if (!attempted) { skipped++; }
    else if (isCorrect) { score += 3; correct++; }
    else { score -= 1; incorrect++; }

    if (!topicTally[q.topic]) topicTally[q.topic] = { correct: 0, total: 0 };
    if (attempted) {
      topicTally[q.topic].total++;
      if (isCorrect) topicTally[q.topic].correct++;
    }

    review.push({
      question: q.question,
      options: q.options,
      correctIndex: q.correctIndex,
      selectedIndex,
      explanation: q.explanation,
      topic: q.topic,
      isCorrect,
    });
  });

  const attempt = {
    id: uuidv4(),
    quizId,
    subjectId: quiz.subjectId,
    submittedAt: new Date().toISOString(),
    score,
    maxScore: quiz.questions.length * 3,
    correct,
    incorrect,
    skipped,
    total: quiz.questions.length,
    topicTally,
    review,
  };
  await store.upsert('quizAttempts', attempt);
  return attempt;
}

export async function listQuizAttempts(subjectId) {
  return store.list('quizAttempts', subjectId ? (a) => a.subjectId === subjectId : undefined);
}
