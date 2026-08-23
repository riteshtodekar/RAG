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
  if (name === 'quiz') renderQuizView();
  if (name === 'flashcards') renderFlashcardsView();
  if (name === 'interview') renderInterviewView();
}

function populateSubjectSelect(select) {
  select.innerHTML = state.subjects.map((s) =>
    `<option value="${s.id}">${escapeHtml(s.name)}</option>`
  ).join('') || '<option value="">No subjects yet — create one first</option>';
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

// ============================================================
// QUIZ MODE
// ============================================================
const quizState = { quiz: null, currentIndex: 0, answers: [], selectedOption: null, score: 0 };

function renderQuizView() {
  populateSubjectSelect($('#quizSubjectSelect'));
  if (state.activeSubjectId) $('#quizSubjectSelect').value = state.activeSubjectId;
  $('#quizSetup').style.display = '';
  $('#quizActive').style.display = 'none';
  $('#quizReview').style.display = 'none';
}

$('#quizSubjectSelect').addEventListener('change', (e) => { state.activeSubjectId = e.target.value; });

$('#quizGenerateBtn').addEventListener('click', async () => {
  const subjectId = $('#quizSubjectSelect').value;
  if (!subjectId) return toast('Create a subject first.', 'error');
  const count = parseInt($('#quizCount').value, 10);
  const difficulty = $('#quizDifficulty').value;
  const btn = $('#quizGenerateBtn');
  btn.disabled = true; btn.textContent = 'Generating…';
  try {
    const { quiz } = await api('/quiz/generate', { method: 'POST', body: JSON.stringify({ subjectId, count, difficulty }) });
    quizState.quiz = quiz;
    quizState.currentIndex = 0;
    quizState.answers = [];
    quizState.score = 0;
    $('#quizSetup').style.display = 'none';
    $('#quizActive').style.display = '';
    renderQuizQuestion();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Generate quiz';
  }
});

function renderQuizQuestion() {
  const q = quizState.quiz.questions[quizState.currentIndex];
  quizState.selectedOption = null;
  $('#quizProgressPill').textContent = `Question ${quizState.currentIndex + 1} / ${quizState.quiz.questions.length}`;
  $('#quizScorePill').textContent = `Score so far: ${quizState.score}`;
  $('#quizQuestionText').textContent = q.question;
  $('#quizOptions').innerHTML = q.options.map((opt, i) => `
    <button class="btn btn-ghost" data-opt="${i}" style="justify-content:flex-start; text-align:left; padding:12px 14px;">${escapeHtml(opt)}</button>
  `).join('');
  $all('[data-opt]').forEach((btn) => {
    btn.addEventListener('click', () => {
      $all('[data-opt]').forEach((b) => { b.style.borderColor = 'var(--paper-line)'; b.style.background = 'transparent'; });
      btn.style.borderColor = 'var(--brass)';
      btn.style.background = 'var(--brass-soft)';
      quizState.selectedOption = parseInt(btn.dataset.opt, 10);
      $('#quizNextBtn').disabled = false;
    });
  });
  $('#quizNextBtn').disabled = true;
  $('#quizNextBtn').textContent = quizState.currentIndex === quizState.quiz.questions.length - 1 ? 'Finish quiz' : 'Submit answer';
}

$('#quizNextBtn').addEventListener('click', () => {
  const q = quizState.quiz.questions[quizState.currentIndex];
  const isCorrect = quizState.selectedOption === q.correctIndex;
  quizState.score += isCorrect ? 3 : -1;
  quizState.answers.push({ questionIndex: quizState.currentIndex, selectedIndex: quizState.selectedOption });

  if (quizState.currentIndex < quizState.quiz.questions.length - 1) {
    quizState.currentIndex += 1;
    renderQuizQuestion();
  } else {
    submitQuiz();
  }
});

async function submitQuiz() {
  try {
    const { attempt } = await api(`/quiz/${quizState.quiz.id}/submit`, {
      method: 'POST',
      body: JSON.stringify({ answers: quizState.answers }),
    });
    renderQuizReview(attempt);
  } catch (err) {
    toast(err.message, 'error');
  }
}

function renderQuizReview(attempt) {
  $('#quizActive').style.display = 'none';
  const topicRows = Object.entries(attempt.topicTally).map(([topic, t]) => {
    const pct = t.total ? Math.round((t.correct / t.total) * 100) : 0;
    const cls = pct >= 70 ? 'pill-sage' : pct >= 40 ? 'pill-brass' : 'pill-brick';
    return `<div class="doc-row"><span class="doc-name">${escapeHtml(topic)}</span><span class="pill ${cls}">${t.correct}/${t.total} · ${pct}%</span></div>`;
  }).join('');

  const reviewRows = attempt.review.map((r, i) => `
    <div class="card" style="margin-bottom:10px;">
      <div style="display:flex; justify-content:space-between; gap:10px;">
        <b style="font-size:13.5px;">${i + 1}. ${escapeHtml(r.question)}</b>
        <span class="pill ${r.isCorrect ? 'pill-sage' : 'pill-brick'}">${r.isCorrect ? 'Correct' : 'Incorrect'}</span>
      </div>
      <p style="font-size:12.5px; color:var(--text-muted); margin:8px 0 4px;">Correct answer: ${escapeHtml(r.options[r.correctIndex])}</p>
      <p style="font-size:12.5px; color:var(--text-muted); margin:0;">${escapeHtml(r.explanation)}</p>
    </div>`).join('');

  $('#quizReview').innerHTML = `
    <div class="card" style="margin-bottom:16px; text-align:center; padding:32px;">
      <div class="view-eyebrow" style="margin-bottom:8px;">Quiz complete</div>
      <div style="font-family:var(--font-mono); font-size:34px; font-weight:600;">${attempt.score} <span style="font-size:16px; color:var(--text-muted);">/ ${attempt.maxScore}</span></div>
      <p style="color:var(--text-muted); font-size:13px; margin:8px 0 0;">${attempt.correct} correct · ${attempt.incorrect} incorrect · ${attempt.skipped} skipped &nbsp;(+3 / &minus;1 / 0 scoring)</p>
      <button class="btn btn-brass" id="quizRetakeBtn" style="margin-top:16px;">New quiz</button>
    </div>
    <h3 style="font-family:var(--font-display); font-size:15px; margin:0 0 10px;">By topic</h3>
    <div class="card" style="margin-bottom:20px;">${topicRows || '<p style="color:var(--text-muted); font-size:12.5px;">No topic data.</p>'}</div>
    <h3 style="font-family:var(--font-display); font-size:15px; margin:0 0 10px;">Review</h3>
    ${reviewRows}
  `;
  $('#quizReview').style.display = '';
  $('#quizRetakeBtn').addEventListener('click', renderQuizView);
}

// ============================================================
// FLASHCARDS
// ============================================================
const fcState = { due: [], index: 0, flipped: false };

function renderFlashcardsView() {
  populateSubjectSelect($('#fcSubjectSelect'));
  if (state.activeSubjectId) $('#fcSubjectSelect').value = state.activeSubjectId;
  loadFlashcardCounts();
  loadDueQueue();
}

$('#fcSubjectSelect').addEventListener('change', (e) => {
  state.activeSubjectId = e.target.value;
  loadFlashcardCounts();
  loadDueQueue();
});

async function loadFlashcardCounts() {
  const subjectId = $('#fcSubjectSelect').value;
  if (!subjectId) return;
  try {
    const [{ cards: all }, { cards: due }] = await Promise.all([
      api(`/flashcards?subjectId=${subjectId}`),
      api(`/flashcards/due?subjectId=${subjectId}`),
    ]);
    $('#fcTotalCount').textContent = `${all.length} total cards`;
    $('#fcDueCount').textContent = `${due.length} due today`;
  } catch { /* non-fatal */ }
}

$('#fcGenerateBtn').addEventListener('click', async () => {
  const subjectId = $('#fcSubjectSelect').value;
  if (!subjectId) return toast('Create a subject first.', 'error');
  const count = parseInt($('#fcGenCount').value, 10);
  const btn = $('#fcGenerateBtn');
  btn.disabled = true; btn.textContent = 'Generating…';
  try {
    await api('/flashcards/generate', { method: 'POST', body: JSON.stringify({ subjectId, count }) });
    toast('Flashcards generated.', 'success');
    await loadFlashcardCounts();
    await loadDueQueue();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Generate cards';
  }
});

async function loadDueQueue() {
  const subjectId = $('#fcSubjectSelect').value;
  if (!subjectId) { $('#fcReviewArea').innerHTML = ''; return; }
  const { cards } = await api(`/flashcards/due?subjectId=${subjectId}`);
  fcState.due = cards;
  fcState.index = 0;
  fcState.flipped = false;
  renderFlashcard();
}

function renderFlashcard() {
  const area = $('#fcReviewArea');
  if (!fcState.due.length) {
    area.innerHTML = `
      <div class="card empty-state">
        <h3>Nothing due right now</h3>
        <p>Generate cards above, or come back once today's queue refills.</p>
      </div>`;
    return;
  }
  const card = fcState.due[fcState.index];
  area.innerHTML = `
    <div class="card" style="min-height:220px; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; cursor:pointer; padding:36px 24px;" id="fcFlipCard">
      <span class="pill pill-brass" style="margin-bottom:16px;">${escapeHtml(card.topic)}</span>
      <p style="font-size:16px; font-weight:600; margin:0;">${escapeHtml(fcState.flipped ? card.back : card.front)}</p>
      <p style="color:var(--text-muted); font-size:12px; margin-top:14px;">${fcState.flipped ? '' : 'Click to reveal answer'}</p>
    </div>
    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:14px;">
      <span class="pill">${fcState.index + 1} / ${fcState.due.length} due</span>
      <div id="fcRateButtons" style="display:flex; gap:8px; ${fcState.flipped ? '' : 'visibility:hidden;'}">
        <button class="btn btn-ghost btn-sm" data-q="1">Again</button>
        <button class="btn btn-ghost btn-sm" data-q="3">Hard</button>
        <button class="btn btn-ghost btn-sm" data-q="4">Good</button>
        <button class="btn btn-brass btn-sm" data-q="5">Easy</button>
      </div>
    </div>`;

  $('#fcFlipCard').addEventListener('click', () => { fcState.flipped = !fcState.flipped; renderFlashcard(); });
  $all('#fcRateButtons [data-q]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await api(`/flashcards/${card.id}/review`, { method: 'POST', body: JSON.stringify({ quality: parseInt(btn.dataset.q, 10) }) });
        fcState.due.splice(fcState.index, 1);
        if (fcState.index >= fcState.due.length) fcState.index = 0;
        fcState.flipped = false;
        renderFlashcard();
        loadFlashcardCounts();
      } catch (err) { toast(err.message, 'error'); }
    });
  });
}

// ============================================================
// MOCK INTERVIEW
// ============================================================
const ivState = { sessionId: null, total: 0, current: 0 };

function renderInterviewView() {
  populateSubjectSelect($('#ivSubjectSelect'));
  const opts = $('#ivSubjectSelect');
  opts.innerHTML = '<option value="">No subject (JD only)</option>' + opts.innerHTML;
  if (state.activeSubjectId) opts.value = state.activeSubjectId;
  $('#ivSetup').style.display = '';
  $('#ivActive').style.display = 'none';
  $('#ivComplete').style.display = 'none';
}

$('#ivStartBtn').addEventListener('click', async () => {
  const subjectId = $('#ivSubjectSelect').value || null;
  const jdText = $('#ivJdText').value.trim();
  const numQuestions = parseInt($('#ivCount').value, 10);
  if (!subjectId && !jdText) return toast('Pick a subject or paste a JD first.', 'error');
  const btn = $('#ivStartBtn');
  btn.disabled = true; btn.textContent = 'Preparing questions…';
  try {
    const res = await api('/interview/start', { method: 'POST', body: JSON.stringify({ subjectId, jdText, numQuestions }) });
    ivState.sessionId = res.sessionId;
    ivState.total = res.total;
    ivState.current = 0;
    $('#ivSetup').style.display = 'none';
    $('#ivActive').style.display = '';
    $('#ivFeedbackCard').innerHTML = '';
    renderInterviewQuestion(res.firstQuestion);
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Start interview';
  }
});

function renderInterviewQuestion(q) {
  $('#ivProgressPill').textContent = `Question ${ivState.current + 1} / ${ivState.total}`;
  $('#ivQTypePill').className = `pill ${q.type === 'technical' ? 'pill-brass' : 'pill-sage'}`;
  $('#ivQTypePill').textContent = q.type === 'technical' ? 'Technical' : 'Behavioral';
  $('#ivQuestionText').textContent = q.question;
  $('#ivAnswerText').value = '';
  $('#ivSubmitBtn').disabled = false;
  $('#ivSubmitBtn').textContent = 'Submit answer';
}

$('#ivSubmitBtn').addEventListener('click', async () => {
  const answer = $('#ivAnswerText').value.trim();
  if (!answer) return toast('Write an answer first.', 'error');
  const btn = $('#ivSubmitBtn');
  btn.disabled = true; btn.textContent = 'Evaluating…';
  try {
    const res = await api(`/interview/${ivState.sessionId}/answer`, { method: 'POST', body: JSON.stringify({ answer }) });
    const verdictClass = res.feedback.verdict === 'strong' ? 'pill-sage' : res.feedback.verdict === 'solid' ? 'pill-brass' : 'pill-brick';
    $('#ivFeedbackCard').innerHTML = `
      <div class="card" style="margin-top:14px;">
        <span class="pill ${verdictClass}" style="margin-bottom:10px;">${res.feedback.verdict.replace('_', ' ')}</span>
        <p style="font-size:13.5px; margin:0 0 10px;">${escapeHtml(res.feedback.feedback)}</p>
        <p style="font-size:12.5px; color:var(--text-muted); margin:0;"><b>A strong answer would cover:</b> ${escapeHtml(res.feedback.idealAnswerShape)}</p>
      </div>`;

    ivState.current = res.progress.current;
    if (res.status === 'complete') {
      $('#ivActive').style.display = 'none';
      $('#ivComplete').innerHTML = `
        <div class="card soon-hero">
          <h2>Interview complete</h2>
          <p>You answered ${res.progress.total} questions. Review the feedback above by scrolling back, or start a fresh session with different focus.</p>
          <button class="btn btn-brass" id="ivRestartBtn">Start another</button>
        </div>`;
      $('#ivComplete').style.display = '';
      $('#ivRestartBtn').addEventListener('click', renderInterviewView);
    } else {
      renderInterviewQuestion(res.nextQuestion);
    }
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
  }
});

// ---------- boot ----------
(async function init() {
  checkHealth();
  try {
    await loadSubjects();
  } catch (err) {
    toast('Could not load subjects — check the API is running.', 'error');
  }
})();
