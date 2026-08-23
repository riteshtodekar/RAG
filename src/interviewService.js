import { v4 as uuidv4 } from 'uuid';
import { sampleChunksForSubject } from './vectorstore.js';
import { generateStructured } from './llm.js';
import { store } from './store.js';

const QUESTIONS_SCHEMA = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          type: { type: 'string', enum: ['technical', 'behavioral'] },
        },
        required: ['question', 'type'],
      },
    },
  },
  required: ['questions'],
};

const FEEDBACK_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['strong', 'solid', 'needs_work'] },
    feedback: { type: 'string' },
    idealAnswerShape: { type: 'string' },
  },
  required: ['verdict', 'feedback', 'idealAnswerShape'],
};

const QUESTION_GEN_SYSTEM = `You are an experienced technical interviewer. Generate a mix of technical
and behavioral interview questions based on the provided material (job
description and/or subject study material). Questions should be realistic,
specific, and asked one at a time in a real interview -- not generic.`;

const FEEDBACK_SYSTEM = `You are an experienced interviewer giving direct, constructive feedback on
one answer at a time. Be honest about weaknesses, not just encouraging.
"verdict" is your overall read, "feedback" is 2-4 sentences of specific
critique, "idealAnswerShape" is a short outline (not the full answer) of
what a strong answer would cover.`;

export async function startInterview({ subjectId, jdText, numQuestions = 6 }) {
  let contextBlock = '';
  if (jdText && jdText.trim()) {
    contextBlock += `Job description:\n${jdText.trim()}\n\n`;
  }
  if (subjectId) {
    const chunks = await sampleChunksForSubject(subjectId, 10);
    if (chunks.length) {
      contextBlock += `Subject study material:\n${chunks.map((c, i) => `[${i + 1}] ${c.metadata?.text || ''}`).join('\n\n')}`;
    }
  }
  if (!contextBlock.trim()) {
    throw new Error('Provide a job description or pick a subject with ingested material first.');
  }

  const prompt = `${contextBlock}\n\nGenerate exactly ${numQuestions} interview questions (mix of technical and behavioral) based on the above.`;
  const result = await generateStructured(prompt, QUESTIONS_SCHEMA, QUESTION_GEN_SYSTEM);

  const session = {
    id: uuidv4(),
    subjectId: subjectId || null,
    createdAt: new Date().toISOString(),
    questions: result.questions.slice(0, numQuestions),
    currentIndex: 0,
    turns: [], // { question, answer, feedback }
    status: 'in_progress',
  };
  await store.upsert('interviews', session);
  return session;
}

export async function getInterview(sessionId) {
  return store.get('interviews', sessionId);
}

export async function submitInterviewAnswer(sessionId, answerText) {
  const session = await store.get('interviews', sessionId);
  if (!session) throw new Error('Interview session not found.');
  if (session.status === 'complete') throw new Error('This interview session is already complete.');

  const currentQuestion = session.questions[session.currentIndex];
  const prompt = `Question asked: "${currentQuestion.question}" (type: ${currentQuestion.type})\n\nCandidate's answer: "${answerText}"\n\nEvaluate this answer.`;
  const feedback = await generateStructured(prompt, FEEDBACK_SCHEMA, FEEDBACK_SYSTEM);

  session.turns.push({
    question: currentQuestion.question,
    type: currentQuestion.type,
    answer: answerText,
    ...feedback,
  });
  session.currentIndex += 1;
  session.status = session.currentIndex >= session.questions.length ? 'complete' : 'in_progress';

  await store.upsert('interviews', session);
  return {
    feedback,
    nextQuestion: session.status === 'in_progress' ? session.questions[session.currentIndex] : null,
    status: session.status,
    progress: { current: session.currentIndex, total: session.questions.length },
  };
}
