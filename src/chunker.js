import { config } from './config.js';

const SEPARATORS = ['\n\n', '\n', '. ', ' ', ''];

/**
 * Recursively split `text` into chunks of roughly `chunkSize` characters,
 * preferring to break on paragraph/sentence boundaries, with `overlap`
 * characters repeated between consecutive chunks to preserve context.
 */
export function chunkText(
  text,
  chunkSize = config.rag.chunkSize,
  overlap = config.rag.chunkOverlap
) {
  const cleaned = text.replace(/\r\n/g, '\n').trim();
  if (!cleaned) return [];
  if (cleaned.length <= chunkSize) return [cleaned];

  const rawChunks = splitRecursive(cleaned, chunkSize, SEPARATORS);
  return addOverlap(rawChunks, overlap);
}

function splitRecursive(text, chunkSize, separators) {
  if (text.length <= chunkSize) return [text];

  const [sep, ...rest] = separators;
  if (sep === undefined) {
    // Last resort: hard cut.
    const chunks = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.slice(i, i + chunkSize));
    }
    return chunks;
  }

  const parts = sep === '' ? text.split('') : text.split(sep);
  const chunks = [];
  let current = '';

  for (const part of parts) {
    const candidate = current ? current + sep + part : part;
    if (candidate.length > chunkSize && current) {
      chunks.push(current);
      current = part;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);

  // Any chunk still too big gets split further with the next separator.
  return chunks.flatMap((c) =>
    c.length > chunkSize ? splitRecursive(c, chunkSize, rest) : [c]
  );
}

function addOverlap(chunks, overlap) {
  if (overlap <= 0 || chunks.length <= 1) return chunks;
  const result = [chunks[0]];
  for (let i = 1; i < chunks.length; i++) {
    const prevTail = chunks[i - 1].slice(-overlap);
    result.push(prevTail + chunks[i]);
  }
  return result;
}
