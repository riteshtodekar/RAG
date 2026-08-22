import { Router } from 'express';
import multer from 'multer';
import { ingestText, deleteDocument } from '../src/ragService.js';
import { extractText } from '../src/extractText.js';
import { config } from '../src/config.js';
import { registerDocument, removeDocument } from '../src/documents.js';
import { bumpDocumentCount } from '../src/subjects.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.rag.maxUploadMb * 1024 * 1024 },
});

// POST /api/ingest/text  { text, source?, subjectId? }
router.post('/text', async (req, res) => {
  try {
    const { text, source, subjectId } = req.body || {};
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Field "text" is required and must be a non-empty string.' });
    }
    const name = source || 'pasted-text';
    const result = await ingestText(text, { source: name, subjectId: subjectId || null });
    await registerDocument({ documentId: result.documentId, subjectId, name, chunkCount: result.chunkCount });
    if (subjectId) await bumpDocumentCount(subjectId, 1);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[ingest/text] error:', err);
    res.status(500).json({ error: err.message || 'Ingestion failed.' });
  }
});

// POST /api/ingest/file  (multipart/form-data, field name "file", optional field "subjectId")
router.post('/file', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Use form field name "file".' });
    }
    const subjectId = req.body?.subjectId || null;
    const text = await extractText(req.file.buffer, req.file.originalname, req.file.mimetype);
    if (!text || !text.trim()) {
      return res.status(422).json({ error: 'Could not extract any text from the uploaded file.' });
    }
    const result = await ingestText(text, { source: req.file.originalname, subjectId });
    await registerDocument({
      documentId: result.documentId,
      subjectId,
      name: req.file.originalname,
      chunkCount: result.chunkCount,
    });
    if (subjectId) await bumpDocumentCount(subjectId, 1);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[ingest/file] error:', err);
    res.status(500).json({ error: err.message || 'Ingestion failed.' });
  }
});

// GET /api/ingest/documents?subjectId=
router.get('/documents', async (req, res) => {
  try {
    const { listDocuments } = await import('../src/documents.js');
    res.json({ success: true, documents: await listDocuments(req.query.subjectId) });
  } catch (err) {
    console.error('[ingest/documents] error:', err);
    res.status(500).json({ error: err.message || 'Failed to list documents.' });
  }
});

// DELETE /api/ingest/:documentId
router.delete('/:documentId', async (req, res) => {
  try {
    const removed = await removeDocument(req.params.documentId);
    await deleteDocument(req.params.documentId);
    if (removed?.subjectId) await bumpDocumentCount(removed.subjectId, -1);
    res.json({ success: true });
  } catch (err) {
    console.error('[ingest/delete] error:', err);
    res.status(500).json({ error: err.message || 'Delete failed.' });
  }
});

export default router;
