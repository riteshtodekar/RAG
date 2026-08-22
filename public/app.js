// ============================================================
// PRAGYAN — app shell logic
// ============================================================

const state = {
  subjects: [],
  activeSubjectId: null,
  documents: [],
};

// ---------- helpers ----------
function $(sel) { return document.querySelector(sel); }
function $all(sel) { return Array.from(document.querySelectorAll(sel)); }
function escapeHtml(str) {
  return (str || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function toast(message, type = '') {
  const stack = $('#toastStack');
  const el = document.createElement('div');
  el.className = `toast ${type}`.trim();
  el.textContent = message;
  stack.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

async function api(path, opts = {}) {
  const res = await fetch(`/api${path}`, {
    headers: opts.body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// ---------- view routing ----------
function showView(name) {
  $all('.view').forEach((v) => v.classList.remove('active'));
  $all('.nav-link').forEach((n) => n.classList.remove('active'));
  const view = $(`#view-${name}`);
  const link = $(`.nav-link[data-view="${name}"]`);
  if (view) view.classList.add('active');
  if (link) link.classList.add('active');
  if (name === 'study') renderStudyView();
}

$all('.nav-link').forEach((btn) => {
  btn.addEventListener('click', () => showView(btn.dataset.view));
});

// ---------- health check ----------
async function checkHealth() {
  const dot = $('#healthDot');
  try {
    await api('/health');
    dot.textContent = '● API connected';
    dot.style.color = '#6FBE8F';
  } catch {
    dot.textContent = '● API unreachable';
    dot.style.color = '#D98A8A';
  }
}

// ---------- subjects ----------
async function loadSubjects() {
  const { subjects } = await api('/subjects');
  state.subjects = subjects;
  if (!state.activeSubjectId && subjects.length) state.activeSubjectId = subjects[0].id;
  renderSubjects();
}

function subjectCardHtml(s) {
  return `
    <div class="card subject-card" data-subject="${s.id}">
      <div class="subject-card-top">
        <span class="pill pill-${s.color === 'brick' ? 'brick' : s.color === 'sage' ? 'sage' : 'brass'}">${s.documentCount || 0} docs</span>
      </div>
      <div>
        <h3 class="subject-name">${escapeHtml(s.name)}</h3>
        <p class="subject-meta">${escapeHtml(s.description || 'No description yet')}</p>
      </div>
      <button class="btn btn-ghost btn-sm" data-open="${s.id}">Open &rarr;</button>
    </div>`;
}

function renderSubjects() {
  const empty = `
    <div class="card empty-state" style="grid-column:1/-1;">
      <h3>No subjects yet</h3>
      <p>Create one for each exam track — GATE TOC, ISTQB, SDET interview bank — to keep retrieval scoped and focused.</p>
      <button class="btn btn-brass" id="emptyNewSubjectBtn">+ Create your first subject</button>
    </div>`;

  const grid = state.subjects.length
    ? state.subjects.map(subjectCardHtml).join('') +
      `<div class="card new-subject-card" id="inlineNewSubjectBtn">+<br/>New subject</div>`
    : empty;

  $('#subjectsGrid').innerHTML = grid;
  $('#dashSubjectGrid').innerHTML = state.subjects.length ? state.subjects.map(subjectCardHtml).join('') : empty;

  $all('[data-open]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.activeSubjectId = btn.dataset.open;
      showView('study');
    });
  });
  $all('.subject-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-open]')) return;
      state.activeSubjectId = card.dataset.subject;
      showView('study');
    });
  });
  const inlineBtn = $('#inlineNewSubjectBtn');
  if (inlineBtn) inlineBtn.addEventListener('click', promptNewSubject);
  const emptyBtn = $('#emptyNewSubjectBtn');
  if (emptyBtn) emptyBtn.addEventListener('click', promptNewSubject);

  // dashboard stats
  $('#statSubjects').textContent = state.subjects.length;
  $('#statDocs').textContent = state.subjects.reduce((sum, s) => sum + (s.documentCount || 0), 0);
  api('/stats').then(({ stats }) => { $('#statChunks').textContent = stats.totalRecordCount; }).catch(() => {});
}

async function promptNewSubject() {
  const name = prompt('Subject name (e.g. "GATE — Theory of Computation")');
  if (!name || !name.trim()) return;
  const description = prompt('One-line description (optional)') || '';
  try {
    const { subject } = await api('/subjects', { method: 'POST', body: JSON.stringify({ name, description }) });
    state.subjects.push(subject);
    state.activeSubjectId = subject.id;
    renderSubjects();
    toast(`Created "${subject.name}"`, 'success');
    showView('study');
  } catch (err) {
    toast(err.message, 'error');
  }
}

$('#subjectsNewBtn').addEventListener('click', promptNewSubject);
$('#dashNewSubjectBtn').addEventListener('click', promptNewSubject);

// ---------- study view ----------
function renderSubjectSelect() {
  const select = $('#studySubjectSelect');
  select.innerHTML = state.subjects.map((s) =>
    `<option value="${s.id}" ${s.id === state.activeSubjectId ? 'selected' : ''}>${escapeHtml(s.name)}</option>`
  ).join('') || '<option value="">No subjects yet</option>';
}

$('#studySubjectSelect').addEventListener('change', (e) => {
  state.activeSubjectId = e.target.value;
  renderStudyView();
});

async function renderStudyView() {
  renderSubjectSelect();
  const subject = state.subjects.find((s) => s.id === state.activeSubjectId);
  $('#studySubjectTitle').textContent = subject ? subject.name : 'Ask & Retrieve';
  $('#chatLog').innerHTML = subject
    ? '<p style="color:var(--text-muted); font-size:13px;">Ask anything grounded in what you\'ve ingested for this subject.</p>'
    : '<p style="color:var(--text-muted); font-size:13px;">Create a subject first, then come back here to ask questions.</p>';
  $('#sourcesList').innerHTML = '<p style="color:var(--text-muted); font-size:12.5px;">Ask a question to see cited sources here.</p>';
  await loadDocuments();
}

async function loadDocuments() {
  if (!state.activeSubjectId) { $('#docList').innerHTML = ''; return; }
  try {
    const { documents } = await api(`/ingest/documents?subjectId=${state.activeSubjectId}`);
    state.documents = documents;
    $('#docList').innerHTML = documents.length
      ? documents.map((d) => `
          <div class="doc-row">
            <span class="doc-name">📄 ${escapeHtml(d.name)}</span>
            <button class="btn btn-ghost btn-sm" data-del-doc="${d.documentId}">Remove</button>
          </div>`).join('')
      : '<p style="color:var(--text-muted); font-size:12.5px; margin-top:8px;">No documents in this subject yet.</p>';

    $all('[data-del-doc]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await api(`/ingest/${btn.dataset.delDoc}`, { method: 'DELETE' });
          toast('Document removed', 'success');
          const s = state.subjects.find((x) => x.id === state.activeSubjectId);
          if (s) s.documentCount = Math.max(0, (s.documentCount || 0) - 1);
          await loadDocuments();
        } catch (err) { toast(err.message, 'error'); }
      });
    });
  } catch (err) {
    console.error(err);
  }
}

// --- ingest ---
$('#ingestTextBtn').addEventListener('click', async () => {
  if (!state.activeSubjectId) return toast('Create a subject first.', 'error');
  const text = $('#ingestTextInput').value.trim();
  if (!text) return toast('Paste some text first.', 'error');
  const source = $('#ingestSourceLabel').value.trim() || 'pasted-text';
  const btn = $('#ingestTextBtn');
  btn.disabled = true; btn.textContent = 'Ingesting…';
  try {
    await api('/ingest/text', { method: 'POST', body: JSON.stringify({ text, source, subjectId: state.activeSubjectId }) });
    $('#ingestTextInput').value = '';
    $('#ingestSourceLabel').value = '';
    const s = state.subjects.find((x) => x.id === state.activeSubjectId);
    if (s) s.documentCount = (s.documentCount || 0) + 1;
    await loadDocuments();
    toast('Text ingested.', 'success');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Ingest text';
  }
});

$('#ingestFileBtn').addEventListener('click', async () => {
  if (!state.activeSubjectId) return toast('Create a subject first.', 'error');
  const file = $('#ingestFileInput').files[0];
  if (!file) return toast('Choose a file first.', 'error');
  const form = new FormData();
  form.append('file', file);
  form.append('subjectId', state.activeSubjectId);
  const btn = $('#ingestFileBtn');
  btn.disabled = true; btn.textContent = 'Uploading…';
  try {
    await api('/ingest/file', { method: 'POST', body: form });
    $('#ingestFileInput').value = '';
    const s = state.subjects.find((x) => x.id === state.activeSubjectId);
    if (s) s.documentCount = (s.documentCount || 0) + 1;
    await loadDocuments();
    toast('File ingested.', 'success');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Upload & ingest';
  }
});

// --- chat ---
function renderCitedAnswer(text, sources) {
  return escapeHtml(text).replace(/\[(\d+)\]/g, (m, n) => {
    const has = sources.find((s) => String(s.index) === n);
    return has ? `<span class="cite-badge" data-cite="${n}">${n}</span>` : m;
  });
}

function renderSources(sources) {
  $('#sourcesList').innerHTML = sources.length
    ? sources.map((s) => `
        <div class="source-item" id="src-${s.index}">
          <div class="src-name"><span class="cite-badge">${s.index}</span> ${escapeHtml(s.source)}</div>
          <div class="src-preview">${escapeHtml(s.preview)}${s.preview?.length >= 240 ? '…' : ''}</div>
        </div>`).join('')
    : '<p style="color:var(--text-muted); font-size:12.5px;">No sources matched this question.</p>';
}

async function sendChat() {
  if (!state.activeSubjectId) return toast('Create a subject first.', 'error');
  const input = $('#chatInput');
  const question = input.value.trim();
  if (!question) return;
  input.value = '';

  const log = $('#chatLog');
  log.innerHTML += `<div class="msg msg-user">${escapeHtml(question)}</div>`;
  const thinkingId = `thinking-${Date.now()}`;
  log.innerHTML += `<div class="msg msg-model" id="${thinkingId}">Thinking…</div>`;
  log.scrollTop = log.scrollHeight;

  try {
    const result = await api('/chat', {
      method: 'POST',
      body: JSON.stringify({ question, subjectId: state.activeSubjectId }),
    });
    document.getElementById(thinkingId).innerHTML = renderCitedAnswer(result.answer, result.sources || []);
    renderSources(result.sources || []);
    $all('.cite-badge[data-cite]').forEach((badge) => {
      badge.addEventListener('click', () => {
        const el = document.getElementById(`src-${badge.dataset.cite}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });
  } catch (err) {
    document.getElementById(thinkingId).textContent = `Error: ${err.message}`;
  }
  log.scrollTop = log.scrollHeight;
}

$('#chatSendBtn').addEventListener('click', sendChat);
$('#chatInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });

// ---------- boot ----------
(async function init() {
  checkHealth();
  try {
    await loadSubjects();
  } catch (err) {
    toast('Could not load subjects — check the API is running.', 'error');
  }
})();
