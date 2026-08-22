import { Router } from 'express';
import { listSubjects, createSubject, deleteSubject } from '../src/subjects.js';
import { listDocuments } from '../src/documents.js';
import { deleteDocument } from '../src/ragService.js';
import { removeDocument } from '../src/documents.js';

const router = Router();

// GET /api/subjects
router.get('/', async (req, res) => {
  try {
    res.json({ success: true, subjects: await listSubjects() });
  } catch (err) {
    console.error('[subjects] list error:', err);
    res.status(500).json({ error: err.message || 'Failed to list subjects.' });
  }
});

// POST /api/subjects  { name, description? }
router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body || {};
    const subject = await createSubject({ name, description });
    res.json({ success: true, subject });
  } catch (err) {
    console.error('[subjects] create error:', err);
    res.status(400).json({ error: err.message || 'Failed to create subject.' });
  }
});

// DELETE /api/subjects/:id  -- also removes its documents from the vector store
router.delete('/:id', async (req, res) => {
  try {
    const docs = await listDocuments(req.params.id);
    for (const doc of docs) {
      await deleteDocument(doc.documentId);
      await removeDocument(doc.documentId);
    }
    await deleteSubject(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('[subjects] delete error:', err);
    res.status(500).json({ error: err.message || 'Failed to delete subject.' });
  }
});

export default router;
