import { v4 as uuidv4 } from 'uuid';
import { chunkText } from './chunker.js';
import { embedTexts, embedQuery } from './embeddings.js';
import { upsertVectors, queryVectors, deleteByDocumentId } from './vectorstore.js';
import { generateAnswer } from './llm.js';
import { config } from './config.js';

/**
 * Ingest raw text into the knowledge base: chunk -> embed -> upsert.
 * @param {string} text
 * @param {{source?: string, [key: string]: any}} metadata
 * @returns {Promise<{documentId: string, chunkCount: number}>}
 */
export async function ingestText(text, metadata = {}) {
  const chunks = chunkText(text);
  if (chunks.length === 0) {
    throw new Error('No extractable text content to ingest.');
  }

  const documentId = metadata.documentId || uuidv4();
  const embeddings = await embedTexts(chunks, 'RETRIEVAL_DOCUMENT');

  const vectors = chunks.map((chunk, i) => ({
    id: `${documentId}-${i}`,
    values: embeddings[i],
    metadata: {
      ...metadata,
      documentId,
      chunkIndex: i,
      text: chunk,
      source: metadata.source || 'unknown',
    },
  }));

  await upsertVectors(vectors);
  return { documentId, chunkCount: chunks.length };
}

/**
 * Answer a question using retrieval-augmented generation.
 * @param {string} question
 * @param {{topK?: number, history?: {role: string, text: string}[]}} opts
 */
export async function answerQuestion(question, opts = {}) {
  const topK = opts.topK || config.rag.topK;
  const queryEmbedding = await embedQuery(question);
  const matches = await queryVectors(queryEmbedding, topK, opts.subjectId);

  const contextChunks = matches.map((m) => ({
    text: m.metadata?.text || '',
    metadata: m.metadata || {},
    score: m.score,
  }));

  const answer = await generateAnswer(question, contextChunks, opts.history || []);

  return {
    answer,
    sources: contextChunks.map((c, i) => ({
      index: i + 1,
      source: c.metadata.source,
      documentId: c.metadata.documentId,
      chunkIndex: c.metadata.chunkIndex,
      score: c.score,
      preview: c.text.slice(0, 240),
    })),
  };
}

export async function deleteDocument(documentId) {
  await deleteByDocumentId(documentId);
}
