const $ = (sel) => document.querySelector(sel);

// --- Tabs ---
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    $('#' + btn.dataset.tab).classList.add('active');
  });
});

function setStatus(msg, type = '') {
  const el = $('#ingestStatus');
  el.textContent = msg;
  el.className = 'status' + (type ? ' ' + type : '');
}

// --- Ingest: text ---
$('#ingestTextBtn').addEventListener('click', async () => {
  const text = $('#textInput').value.trim();
  const source = $('#textSource').value.trim();
  if (!text) return setStatus('Please paste some text first.', 'error');

  setStatus('Ingesting...');
  try {
    const res = await fetch('/api/ingest/text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, source }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ingestion failed.');
    setStatus(`Ingested ${data.chunkCount} chunk(s). Document ID: ${data.documentId}`, 'success');
    $('#textInput').value = '';
  } catch (err) {
    setStatus(err.message, 'error');
  }
});

// --- Ingest: file ---
$('#ingestFileBtn').addEventListener('click', async () => {
  const file = $('#fileInput').files[0];
  if (!file) return setStatus('Please choose a file first.', 'error');

  setStatus('Uploading & ingesting...');
  try {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/ingest/file', { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ingestion failed.');
    setStatus(`Ingested ${data.chunkCount} chunk(s) from "${file.name}".`, 'success');
    $('#fileInput').value = '';
  } catch (err) {
    setStatus(err.message, 'error');
  }
});

// --- Chat ---
const chatLog = $('#chatLog');
let history = [];

function appendBubble(role, text, sources) {
  const div = document.createElement('div');
  div.className = 'bubble ' + (role === 'user' ? 'user' : 'bot');
  div.textContent = text;
  if (sources && sources.length) {
    const s = document.createElement('div');
    s.className = 'sources';
    s.textContent = 'Sources: ' + sources.map((s) => `[${s.index}] ${s.source}`).join('  ');
    div.appendChild(s);
  }
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}

async function ask() {
  const input = $('#questionInput');
  const question = input.value.trim();
  if (!question) return;
  input.value = '';
  appendBubble('user', question);
  $('#askBtn').disabled = true;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, history }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed.');
    appendBubble('bot', data.answer, data.sources);
    history.push({ role: 'user', text: question });
    history.push({ role: 'model', text: data.answer });
    // Keep history bounded so requests stay small.
    if (history.length > 12) history = history.slice(-12);
  } catch (err) {
    appendBubble('bot', 'Error: ' + err.message);
  } finally {
    $('#askBtn').disabled = false;
  }
}

$('#askBtn').addEventListener('click', ask);
$('#questionInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') ask();
});
