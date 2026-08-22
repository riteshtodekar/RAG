import { Router } from 'express';
import multer from 'multer';
import { ingestText, deleteDocument } from '../src/ragService.js';
import { extractText } from '../src/extractText.js';
import { config } from '../src/config.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.rag.maxUploadMb * 1024 * 1024 },
});

// POST /api/ingest/text  { text, source? }
router.post('/text', async (req, res) => {
  try {
    const { text, source } = req.body || {};
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Field "text" is required and must be a non-empty string.' });
    }
    const result = await ingestText(text, { source: source || 'pasted-text' });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[ingest/text] error:', err);
    res.status(500).json({ error: err.message || 'Ingestion failed.' });
  }
});

// POST /api/ingest/file  (multipart/form-data, field name "file")
router.post('/file', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Use form field name "file".' });
    }
    const text = await extractText(req.file.buffer, req.file.originalname, req.file.mimetype);
    if (!text || !text.trim()) {
      return res.status(422).json({ error: 'Could not extract any text from the uploaded file.' });
    }
    const result = await ingestText(text, { source: req.file.originalname });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[ingest/file] error:', err);
    res.status(500).json({ error: err.message || 'Ingestion failed.' });
  }
});

// DELETE /api/ingest/:documentId
router.delete('/:documentId', async (req, res) => {
  try {
    await deleteDocument(req.params.documentId);
    res.json({ success: true });
  } catch (err) {
    console.error('[ingest/delete] error:', err);
    res.status(500).json({ error: err.message || 'Delete failed.' });
  }
});

export default router;
