import pdfParse from 'pdf-parse';

/**
 * Extract plain text from an uploaded file buffer based on its mimetype/extension.
 */
export async function extractText(buffer, filename, mimetype) {
  const lower = (filename || '').toLowerCase();

  if (mimetype === 'application/pdf' || lower.endsWith('.pdf')) {
    const { text } = await pdfParse(buffer);
    return text;
  }

  if (
    mimetype?.startsWith('text/') ||
    lower.endsWith('.txt') ||
    lower.endsWith('.md') ||
    lower.endsWith('.csv')
  ) {
    return buffer.toString('utf-8');
  }

  // Fallback: try to decode as UTF-8 text anyway.
  return buffer.toString('utf-8');
}
