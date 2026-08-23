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
  const response = await ai.models.generateContent({
    model: config.gemini.model,
    contents,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: config.gemini.temperature,
      maxOutputTokens: config.gemini.maxOutputTokens,
    },
  });

  return response.text;
}

/**
 * Ask Gemini to return structured JSON matching a given schema.
 * Used by quiz generation, flashcard generation, and mock interview flows.
 * @param {string} prompt - full instruction, including any context block
 * @param {object} schema - a Gemini responseSchema object (JSON Schema subset)
 * @param {string} [systemInstruction]
 */
export async function generateStructured(prompt, schema, systemInstruction) {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: config.gemini.model,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      systemInstruction,
      temperature: config.gemini.temperature,
      maxOutputTokens: config.gemini.maxOutputTokens,
      responseMimeType: 'application/json',
      responseSchema: schema,
    },
  });

  const raw = response.text;
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Model did not return valid JSON: ${err.message}`);
  }
}
