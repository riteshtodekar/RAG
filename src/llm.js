import { GoogleGenAI } from '@google/genai';
import { config } from './config.js';

let client;
function getClient() {
  if (!client) {
    client = new GoogleGenAI({ apiKey: config.gemini.apiKey });
  }
  return client;
}

const SYSTEM_INSTRUCTION = `You are a careful, precise assistant answering questions using ONLY the
provided context excerpts retrieved from the user's knowledge base.

Rules:
- Answer using only information found in the context below. Do not use outside knowledge.
- If the context does not contain enough information to answer, say so plainly instead of guessing.
- Cite which source(s) you used by referencing their [number] marker, e.g. "...as shown in [2]".
- Be concise and directly answer the question first, then add supporting detail if useful.`;

/**
 * Build a grounded prompt from retrieved chunks and ask Gemini to answer.
 * @param {string} question
 * @param {{text: string, metadata: object}[]} contextChunks
 * @param {{role: 'user'|'model', text: string}[]} [history]
 */
export async function generateAnswer(question, contextChunks, history = []) {
  const contextBlock = contextChunks
    .map((c, i) => `[${i + 1}] (source: ${c.metadata?.source || 'unknown'})\n${c.text}`)
    .join('\n\n---\n\n');

  const userTurn = `Context:\n${contextBlock || '(no relevant context found)'}\n\nQuestion: ${question}`;

  const contents = [
    ...history.map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
    { role: 'user', parts: [{ text: userTurn }] },
  ];

  const ai = getClient();
  const response = await callWithRetry(() => ai.models.generateContent({
    model: config.gemini.model,
    contents,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: config.gemini.temperature,
      maxOutputTokens: config.gemini.maxOutputTokens,
    },
  }));

  return response.text;
}

const RETRYABLE_STATUS = new Set([429, 503]);

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function callWithRetry(fn, { retries = 3, baseDelayMs = 1000 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = err?.status || err?.code || (err?.message?.match(/"code":\s*(\d+)/) || [])[1];
      const isRetryable = RETRYABLE_STATUS.has(Number(status)) || /RESOURCE_EXHAUSTED|UNAVAILABLE|overloaded/i.test(err?.message || '');
      if (!isRetryable || attempt === retries) throw err;
      const delay = baseDelayMs * 2 ** attempt + Math.random() * 300;
      console.warn(`[llm] transient error (attempt ${attempt + 1}/${retries + 1}), retrying in ${Math.round(delay)}ms:`, err.message);
      await sleep(delay);
    }
  }
  throw lastErr;
}

/**
 * Ask Gemini to return structured JSON matching a given schema.
 * Used by quiz generation, flashcard generation, and mock interview flows.
 * @param {string} prompt - full instruction, including any context block
 * @param {object} schema - a Gemini responseSchema object (JSON Schema subset)
 * @param {string} [systemInstruction]
 * @param {{maxOutputTokens?: number}} [opts]
 */
export async function generateStructured(prompt, schema, systemInstruction, opts = {}) {
  const ai = getClient();

  const response = await callWithRetry(() => ai.models.generateContent({
    model: config.gemini.model,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      systemInstruction,
      temperature: config.gemini.temperature,
      maxOutputTokens: opts.maxOutputTokens || config.gemini.maxOutputTokens,
      responseMimeType: 'application/json',
      responseSchema: schema,
    },
  }));

  const raw = response.text;
  try {
    return JSON.parse(raw);
  } catch (err) {
    // Truncated JSON (hit maxOutputTokens) surfaces here as an unterminated
    // string/object. Give a clearer error than the raw parser message.
    const looksTruncated = raw && !raw.trim().endsWith('}') && !raw.trim().endsWith(']');
    if (looksTruncated) {
      throw new Error('The model response was cut off before completing (likely too many items requested at once). Try a smaller count.');
    }
    throw new Error(`Model did not return valid JSON: ${err.message}`);
  }
}
