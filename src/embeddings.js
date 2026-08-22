import { GoogleGenAI } from '@google/genai';
import { config } from './config.js';

let client;
function getClient() {
  if (!client) {
    client = new GoogleGenAI({ apiKey: config.gemini.apiKey });
  }
  return client;
}

// Keep batches small and conservative -- the free tier's request-per-minute
// limits are tight, so fewer, larger batches beat many small ones.
const BATCH_SIZE = 20;

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Embed a batch of strings with Gemini's embedding model.
 * @param {string[]} texts
 * @param {'RETRIEVAL_DOCUMENT'|'RETRIEVAL_QUERY'} taskType - Gemini tunes
 *   embeddings differently for the thing being stored ("document") vs. the
 *   thing being searched for ("query"). Always set this correctly.
 * @returns {Promise<number[][]>} embeddings, in the same order as `texts`
 */
export async function embedTexts(texts, taskType = 'RETRIEVAL_DOCUMENT') {
  if (!texts || texts.length === 0) return [];

  const ai = getClient();
  const batches = chunkArray(texts, BATCH_SIZE);
  const allEmbeddings = [];

  for (const batch of batches) {
    const response = await ai.models.embedContent({
      model: config.embedding.model,
      contents: batch,
      config: {
        taskType,
        outputDimensionality: config.embedding.dimension,
      },
    });

    for (const item of response.embeddings) {
      allEmbeddings.push(item.values);
    }
  }

  return allEmbeddings;
}

export async function embedQuery(text) {
  const [embedding] = await embedTexts([text], 'RETRIEVAL_QUERY');
  return embedding;
}
