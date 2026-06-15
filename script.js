/* ============================================================
   STUDY PLANNER — script.js
   ============================================================ */

// ── Constants ─────────────────────────────────────────────────
const STORAGE_KEY = 'studyPlanner_v1';
const DAYS_SHORT   = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const BLOCK_TIMES  = ['07:00 – 08:00', '08:00 – 09:00', '09:00 – 10:00', '10:00 – 11:00'];

const SUBJECTS = [
  { id: 'bio', label: 'Biologia',               color: '#4caf7d' },
  { id: 'qui', label: 'Química',                color: '#f4883a' },
  { id: 'fis', label: 'Física',                 color: '#58b4e8' },
  { id: 'mat', label: 'Matemática',             color: '#3a6ecc' },
  { id: 'his', label: 'História',               color: '#e8c744' },
  { id: 'fil', label: 'Fil. e Sociologia',      color: '#e87fad' },
  { id: 'art', label: 'Artes e Literatura',     color: '#b689e0' },
  { id: 'gra', label: 'Gramática Tradicional',  color: '#8a9bb0' },
  { id: 'ing', label: 'Inglês',                 color: '#e05454' },
  { id: 'geo', label: 'Geografia e Atualidades',color: '#2e8b57' },
];

// ── State ─────────────────────────────────────────────────────
let weekOffset = 0;      // 0 = current week, -1 = previous, +1 = next…
let data       = {};     // { 'YYYY-MM-DD': [ {subject, note}, … ] }
let editing    = null;   // { dateKey, blockIndex }

// ── LocalStorage helpers ───────────────────────────────────────
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = {};
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getBlock(dateKey, idx) {
  return (data[dateKey] && data[dateKey][idx]) || { subject: null, note: '' };
}

function setBlock(dateKey, idx, subject, note) {
  if (!data[dateKey]) data[dateKey] = [];
  const existing = data[dateKey][idx] || {};
  data[dateKey][idx] = {
    subject,
    note,
    titulo:     existing.titulo     || '',
    descricao:  existing.descricao  || note,
    detalhes:   existing.detalhes   || '',
    duracao:    existing.duracao    || '',
    prioridade: existing.prioridade || ''
  };
  saveData();
}

// ── Date helpers ───────────────────────────────────────────────
function getWeekStart(offset = 0) {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun
  const diff = now.getDate() - day;
  const start = new Date(now.setDate(diff));
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + offset * 7);
  return start;
}

function toDateKey(date) {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

function formatWeekLabel(start) {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const opts = { day: '2-digit', month: 'short' };
  return `${start.toLocaleDateString('pt-BR', opts)} – ${end.toLocaleDateString('pt-BR', opts)}`;
}

function isToday(date) {
  const t = new Date();
  return date.getDate() === t.getDate()
      && date.getMonth() === t.getMonth()
      && date.getFullYear() === t.getFullYear();
}

// ── Subject lookup ─────────────────────────────────────────────
function getSubject(id) {
  return SUBJECTS.find(s => s.id === id) || null;
}

// ── Render calendar ────────────────────────────────────────────
function renderCalendar() {
  const grid      = document.getElementById('calendar-grid');
  const weekStart = getWeekStart(weekOffset);

  document.getElementById('week-label').textContent = formatWeekLabel(weekStart);
  grid.innerHTML = '';

  for (let d = 0; d < 7; d++) {
    const date    = new Date(weekStart);
    date.setDate(date.getDate() + d);
    const dateKey = toDateKey(date);

    // Day card
    const card = document.createElement('div');
    card.className = 'day-card' + (isToday(date) ? ' today' : '');

    // Day header
    const header = document.createElement('div');
    header.className = 'day-header';
    header.innerHTML = `
      <div class="day-name">${DAYS_SHORT[d]}</div>
      <div class="day-date">${date.getDate()}</div>
    `;
    card.appendChild(header);

    // Blocks
    const blocksEl = document.createElement('div');
    blocksEl.className = 'day-blocks';

    for (let i = 0; i < 4; i++) {
      const block = getBlock(dateKey, i);
      const subj  = block.subject ? getSubject(block.subject) : null;

      const el = document.createElement('div');
      el.className = 'study-block' + (subj ? ' block-filled' : ' block-empty');
      el.style.setProperty('--block-color', subj ? subj.color : 'var(--text-muted)');
      el.style.borderLeftColor = subj ? subj.color : 'var(--text-muted)';
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      el.setAttribute('aria-label', `Editar bloco ${i + 1} de ${DAYS_SHORT[d]} – ${subj ? subj.label : 'Vazio'}`);

      el.innerHTML = `
        <div class="block-time">${BLOCK_TIMES[i]}</div>
        <div class="block-subject">${subj ? subj.label : 'Clique para adicionar'}</div>
        ${block.note ? `<div class="block-note-preview">${escapeHtml(block.note)}</div>` : ''}
      `;

      el.addEventListener('click', () => openDetails(dateKey, i));
      el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openDetails(dateKey, i); });

      blocksEl.appendChild(el);
    }

    card.appendChild(blocksEl);
    grid.appendChild(card);
  }
}

// ── Render legend ──────────────────────────────────────────────
function renderLegend() {
  const legend = document.createElement('div');
  legend.className = 'legend';
  SUBJECTS.forEach(s => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `<span class="legend-dot" style="background:${s.color}"></span>${s.label}`;
    legend.appendChild(item);
  });
  document.body.appendChild(legend);
}

// ── Modal ──────────────────────────────────────────────────────
function openModal(dateKey, blockIndex) {
  editing = { dateKey, blockIndex };
  const block = getBlock(dateKey, blockIndex);

  // Populate subject grid
  const grid = document.getElementById('subject-grid');
  grid.innerHTML = '';
  SUBJECTS.forEach(s => {
    const btn = document.createElement('button');
    btn.className = 'subject-btn' + (block.subject === s.id ? ' selected' : '');
    btn.style.setProperty('--subject-color', s.color);
    btn.innerHTML = `<span class="subject-dot" style="background:${s.color}"></span>${s.label}`;
    btn.addEventListener('click', () => {
      grid.querySelectorAll('.subject-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
    grid.appendChild(btn);
  });

  document.getElementById('block-note').value = block.note || '';

  // Update modal title
  const date = new Date(dateKey + 'T00:00:00');
  document.getElementById('modal-title').textContent =
    `${DAYS_SHORT[date.getDay()]} · Bloco ${blockIndex + 1} · ${BLOCK_TIMES[blockIndex]}`;

  document.getElementById('modal-overlay').classList.add('open');
  document.getElementById('block-note').focus();
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  editing = null;
}

function saveBlock() {
  if (!editing) return;
  const selected = document.querySelector('.subject-btn.selected');
  const subjectId = selected ? SUBJECTS[
    [...document.querySelectorAll('.subject-btn')].indexOf(selected)
  ]?.id : null;
  const note = document.getElementById('block-note').value.trim();
  setBlock(editing.dateKey, editing.blockIndex, subjectId, note);
  closeModal();
  renderCalendar();
}

function clearBlock() {
  if (!editing) return;
  setBlock(editing.dateKey, editing.blockIndex, null, '');
  closeModal();
  renderCalendar();
}

// ── Utility ────────────────────────────────────────────────────
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Toast ──────────────────────────────────────────────────────
let toastTimer = null;

function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast toast--${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove('show'); }, 3500);
}

// ── Details Modal ──────────────────────────────────────────────
let detailsContext = null;

function openDetails(dateKey, blockIndex) {
  const block = getBlock(dateKey, blockIndex);

  if (!block.subject) {
    openModal(dateKey, blockIndex);
    return;
  }

  detailsContext = { dateKey, blockIndex };
  const subj = getSubject(block.subject);

  document.getElementById('details-dot').style.background = subj ? subj.color : 'var(--text-muted)';
  document.getElementById('details-subject').textContent  = subj ? subj.label : '—';

  const titulo = block.titulo || (block.note ? block.note.split('\n')[0] : '') || 'Sem título';
  document.getElementById('details-title').textContent = titulo;

  const meta = document.getElementById('details-meta');
  meta.innerHTML = '';
  const badges = [
    { icon: '⏱', value: block.duracao    || '' },
    { icon: '🎯', value: block.prioridade || '' },
  ];
  badges.forEach(({ icon, value }) => {
    if (!value) return;
    const span = document.createElement('span');
    span.className = 'details-badge';
    span.innerHTML = `<span class="details-badge-icon">${icon}</span>${escapeHtml(value)}`;
    meta.appendChild(span);
  });

  const descSection = document.getElementById('details-desc-section');
  const descEl      = document.getElementById('details-desc');
  const desc = block.descricao || block.note || '';
  if (desc) {
    descEl.textContent = desc;
    descSection.style.display = '';
  } else {
    descSection.style.display = 'none';
  }

  const detSection = document.getElementById('details-det-section');
  const detEl      = document.getElementById('details-det');
  if (block.detalhes && block.detalhes.trim()) {
    detEl.textContent = block.detalhes;
    detSection.style.display = '';
  } else {
    detSection.style.display = 'none';
  }

  const overlay = document.getElementById('details-overlay');
  overlay.classList.add('open');
  document.getElementById('details-close').focus();
}

function closeDetails() {
  document.getElementById('details-overlay').classList.remove('open');
  detailsContext = null;
}

function bindDetailsEvents() {
  const overlay = document.getElementById('details-overlay');
  document.getElementById('details-close').addEventListener('click', closeDetails);
  document.getElementById('details-close-btn').addEventListener('click', closeDetails);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeDetails(); });
  document.getElementById('details-edit-btn').addEventListener('click', () => {
    if (!detailsContext) return;
    const { dateKey, blockIndex } = detailsContext;
    closeDetails();
    openModal(dateKey, blockIndex);
  });
}

// ── JSON structure maps ────────────────────────────────────────
// Maps JSON day keys → weekday index (0=Sun … 6=Sat)
const DAY_KEY_MAP = {
  domingo: 0, segunda: 1, terca: 2, quarta: 3,
  quinta: 4, sexta: 5, sabado: 6
};
const DAY_KEYS_ORDER = ['domingo','segunda','terca','quarta','quinta','sexta','sabado'];

// Subject label → id lookup (for import)
const SUBJECT_LABEL_MAP = Object.fromEntries(
  SUBJECTS.map(s => [s.label.toLowerCase(), s.id])
);

// ── Export ─────────────────────────────────────────────────────
function exportJSON() {
  const weekStart = getWeekStart(weekOffset);
  const semana = {};

  DAY_KEYS_ORDER.forEach((dayKey, d) => {
    const date    = new Date(weekStart);
    date.setDate(date.getDate() + d);
    const dateKey = toDateKey(date);

    semana[dayKey] = [];
    for (let i = 0; i < 4; i++) {
      const block = getBlock(dateKey, i);
      const subj  = block.subject ? getSubject(block.subject) : null;
      semana[dayKey].push({
        materia:    subj ? subj.label : '',
        cor:        subj ? subj.color : '',
        titulo:     block.note ? block.note.split('\n')[0] : '',
        descricao:  block.note || '',
        detalhes:   '',
        duracao:    '1h',
        prioridade: ''
      });
    }
  });

  const payload  = JSON.stringify({ semana }, null, 2);
  const blob     = new Blob([payload], { type: 'application/json' });
  const url      = URL.createObjectURL(blob);
  const a        = document.createElement('a');
  const label    = formatWeekLabel(weekStart).replace(/\s/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '');
  a.href         = url;
  a.download     = `planner_${label}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('✓ JSON exportado com sucesso!', 'success');
}

// ── Validation ─────────────────────────────────────────────────
const REQUIRED_BLOCK_FIELDS = ['materia','cor','titulo','descricao','detalhes','duracao','prioridade'];

function validateJSON(parsed) {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
    return 'O arquivo não é um objeto JSON válido.';

  if (!parsed.semana || typeof parsed.semana !== 'object')
    return 'Chave "semana" não encontrada no arquivo.';

  for (const dayKey of DAY_KEYS_ORDER) {
    if (!Array.isArray(parsed.semana[dayKey]))
      return `Dia "${dayKey}" não encontrado ou não é uma lista.`;

    const blocks = parsed.semana[dayKey];
    if (blocks.length > 4)
      return `"${dayKey}" possui ${blocks.length} blocos — máximo permitido é 4.`;

    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (typeof b !== 'object' || b === null)
        return `Bloco ${i + 1} de "${dayKey}" é inválido.`;
      for (const field of REQUIRED_BLOCK_FIELDS) {
        if (!(field in b))
          return `Campo "${field}" ausente no bloco ${i + 1} de "${dayKey}".`;
      }
    }
  }

  return null; // null = valid
}

// ── Import ─────────────────────────────────────────────────────
function importJSON(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    let parsed;
    try {
      parsed = JSON.parse(e.target.result);
    } catch {
      showToast('✗ Arquivo inválido: não é um JSON legível.', 'error');
      return;
    }

    // ── Formato "conteudos": distribui automaticamente ──────────
    if (parsed.conteudos && Array.isArray(parsed.conteudos)) {
      const contents = parsed.conteudos.map(c => ({
        materia:    c.materia    || '',
        titulo:     c.titulo     || '',
        descricao:  c.descricao  || c.detalhes || '',
        detalhes:   c.detalhes   || '',
        duracao:    c.duracao    || '1h',
        prioridade: c.prioridade || 'media'
      })).filter(c => c.materia.trim());

      if (contents.length === 0) {
        showToast('✗ Nenhum conteúdo com matéria definida encontrado.', 'error');
        return;
      }

      const { semana, overflow } = distribute(contents);

      const weekStart = getWeekStart(weekOffset);
      DAY_KEYS_ORDER.forEach((dayKey, d) => {
        const date    = new Date(weekStart);
        date.setDate(date.getDate() + d);
        const dateKey = toDateKey(date);
        data[dateKey] = [];
        semana[dayKey].forEach((b, i) => {
          const subjectId = resolveSubjectId(b.materia) || null;
          const note = (b.descricao || b.titulo || '').trim();
          data[dateKey][i] = {
            subject: subjectId, note,
            titulo: b.titulo, descricao: b.descricao,
            detalhes: b.detalhes, duracao: b.duracao, prioridade: b.prioridade
          };
        });
      });

      saveData();
      renderCalendar();

      if (overflow.length === 0) {
        showToast(`✓ ${contents.length} conteúdos distribuídos na semana!`, 'success');
      } else {
        showToast(`⚠ ${contents.length - overflow.length} distribuídos. ${overflow.length} não couberam.`, 'error');
      }
      return;
    }

    // ── Formato "semana": importação direta ─────────────────────
    const err = validateJSON(parsed);
    if (err) {
      showToast(`✗ ${err}`, 'error');
      return;
    }

    const weekStart = getWeekStart(weekOffset);
    DAY_KEYS_ORDER.forEach((dayKey, d) => {
      const date    = new Date(weekStart);
      date.setDate(date.getDate() + d);
      const dateKey = toDateKey(date);
      const blocks  = parsed.semana[dayKey];

      data[dateKey] = [];
      for (let i = 0; i < 4; i++) {
        const b = blocks[i];
        if (!b) {
          data[dateKey][i] = { subject: null, note: '' };
          continue;
        }
        const subjectId = SUBJECT_LABEL_MAP[b.materia.toLowerCase()] || null;
        const note = (b.descricao || b.titulo || '').trim();
        data[dateKey][i] = {
          subject:    subjectId,
          note,
          titulo:     b.titulo     || '',
          descricao:  b.descricao  || '',
          detalhes:   b.detalhes   || '',
          duracao:    b.duracao    || '',
          prioridade: b.prioridade || ''
        };
      }
    });

    saveData();
    renderCalendar();
    showToast('✓ Dados importados com sucesso!', 'success');
  };

  reader.onerror = () => showToast('✗ Erro ao ler o arquivo.', 'error');
  reader.readAsText(file);
}

// ── Auto-Distribute ────────────────────────────────────────────

// Priority order
const PRIORITY_ORDER = { alta: 0, media: 1, baixa: 2, '': 3 };

// Subject label → id (case-insensitive, partial match)
function resolveSubjectId(materiaStr) {
  const m = materiaStr.trim().toLowerCase();
  // exact match first
  const exact = SUBJECTS.find(s => s.label.toLowerCase() === m);
  if (exact) return exact.id;
  // partial match
  const partial = SUBJECTS.find(s => s.label.toLowerCase().includes(m) || m.includes(s.label.toLowerCase().split(' ')[0].toLowerCase()));
  return partial ? partial.id : null;
}

/**
 * distribute(contents)
 * contents: Array of { materia, titulo, descricao, detalhes, duracao, prioridade }
 * returns: { semana: { domingo:[], … }, overflow: [] }
 *
 * Algorithm:
 * 1. Sort by priority (alta→media→baixa). Within same priority, shuffle for variety.
 * 2. Build a 7×4 grid (days × slots). Fill column-by-column (one slot per day
 *    before moving to next row) to ensure even daily load.
 * 3. For each grid position, score each remaining content:
 *    - Hard reject: same matéria already in a previous slot TODAY (prefer variety)
 *    - Score = daysSinceLastUsed (higher = better spacing). Tie-break: priority.
 * 4. If all remaining share matéria with today, relax the hard reject and pick
 *    the best-scored anyway.
 * 5. Leftover contents go into overflow[].
 */
function distribute(contents) {
  const DAYS = 7;
  const SLOTS = 4;
  const TOTAL = DAYS * SLOTS; // 28

  // Sort: priority asc, then shuffle within same priority group
  const sorted = [...contents].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.prioridade?.toLowerCase()] ?? 3;
    const pb = PRIORITY_ORDER[b.prioridade?.toLowerCase()] ?? 3;
    return pa !== pb ? pa - pb : Math.random() - 0.5;
  });

  // grid[day][slot] = content or null
  const grid = Array.from({ length: DAYS }, () => Array(SLOTS).fill(null));
  const remaining = [...sorted];

  // lastUsedDay[subjectId] = last day index it was placed (-Infinity initially)
  const lastUsedDay = {};

  // Fill column-by-column (slot 0 across all days, then slot 1, …)
  for (let slot = 0; slot < SLOTS && remaining.length > 0; slot++) {
    for (let day = 0; day < DAYS && remaining.length > 0; day++) {
      const todaySubjects = new Set(
        grid[day].filter(Boolean).map(c => resolveSubjectId(c.materia))
      );

      // Score candidates
      function score(c) {
        const sid = resolveSubjectId(c.materia);
        const daysSince = sid && lastUsedDay[sid] !== undefined
          ? day - lastUsedDay[sid]
          : 999;
        return daysSince * 10 - (PRIORITY_ORDER[c.prioridade?.toLowerCase()] ?? 3);
      }

      // Prefer candidates whose subject is NOT already today
      let candidates = remaining.filter(c => !todaySubjects.has(resolveSubjectId(c.materia)));
      if (candidates.length === 0) candidates = remaining; // relax constraint

      // Pick highest score
      candidates.sort((a, b) => score(b) - score(a));
      const chosen = candidates[0];
      const idx = remaining.indexOf(chosen);
      remaining.splice(idx, 1);

      grid[day][slot] = chosen;
      const sid = resolveSubjectId(chosen.materia);
      if (sid) lastUsedDay[sid] = day;
    }
  }

  // Build output structure
  const dayKeys = ['domingo','segunda','terca','quarta','quinta','sexta','sabado'];
  const semana = {};
  dayKeys.forEach((key, d) => {
    semana[key] = grid[d].map(c => {
      if (!c) return { materia:'', cor:'', titulo:'', descricao:'', detalhes:'', duracao:'', prioridade:'' };
      const subj = SUBJECTS.find(s => s.id === resolveSubjectId(c.materia));
      return {
        materia:    c.materia    || '',
        cor:        subj ? subj.color : '',
        titulo:     c.titulo     || '',
        descricao:  c.descricao  || '',
        detalhes:   c.detalhes   || '',
        duracao:    c.duracao    || '',
        prioridade: c.prioridade || ''
      };
    });
  });

  return { semana, overflow: remaining };
}

// ── Distribute Modal UI ────────────────────────────────────────
let distItems = []; // live list of content objects being edited

function makeEmptyItem() {
  return { materia: '', titulo: '', descricao: '', detalhes: '', duracao: '1h', prioridade: 'media' };
}

function openDistModal() {
  if (distItems.length === 0) distItems = [makeEmptyItem()];
  renderDistList();
  document.getElementById('dist-result').style.display = 'none';
  document.getElementById('dist-overlay').classList.add('open');
  document.getElementById('dist-close').focus();
}

function closeDistModal() {
  document.getElementById('dist-overlay').classList.remove('open');
}

function renderDistList() {
  const container = document.getElementById('dist-list');
  container.innerHTML = '';

  distItems.forEach((item, idx) => {
    const card = document.createElement('div');
    card.className = 'dist-item';

    const subj = SUBJECTS.find(s => s.id === resolveSubjectId(item.materia));
    const dotColor = subj ? subj.color : 'var(--text-muted)';

    card.innerHTML = `
      <button class="dist-item-remove" data-idx="${idx}" aria-label="Remover conteúdo ${idx+1}" title="Remover">✕</button>

      <div class="dist-item-row">
        <label>Matéria</label>
        <div class="dist-subject-indicator">
          <span class="dist-dot-preview" id="dot-${idx}" style="background:${dotColor}"></span>
          <select data-field="materia" data-idx="${idx}">
            <option value="">— selecione —</option>
            ${SUBJECTS.map(s => `<option value="${s.label}" ${item.materia === s.label ? 'selected' : ''}>${s.label}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="dist-item-row">
        <label>Prioridade</label>
        <select data-field="prioridade" data-idx="${idx}">
          <option value="alta"  ${item.prioridade==='alta'  ? 'selected':''}>🔴 Alta</option>
          <option value="media" ${item.prioridade==='media' ? 'selected':''}>🟡 Média</option>
          <option value="baixa" ${item.prioridade==='baixa' ? 'selected':''}>🟢 Baixa</option>
        </select>
      </div>

      <div class="dist-item-row">
        <label>Título</label>
        <input type="text" data-field="titulo" data-idx="${idx}" value="${escapeHtml(item.titulo)}" placeholder="Ex: Funções do 2º grau" />
      </div>

      <div class="dist-item-row">
        <label>Duração</label>
        <input type="text" data-field="duracao" data-idx="${idx}" value="${escapeHtml(item.duracao)}" placeholder="Ex: 1h" />
      </div>

      <div class="dist-item-row full">
        <label>Descrição</label>
        <textarea data-field="descricao" data-idx="${idx}" placeholder="Resumo do que será estudado…" rows="2">${escapeHtml(item.descricao)}</textarea>
      </div>

      <div class="dist-item-row full">
        <label>Detalhes</label>
        <textarea data-field="detalhes" data-idx="${idx}" placeholder="Anotações, tópicos, referências…" rows="2">${escapeHtml(item.detalhes)}</textarea>
      </div>
    `;
    container.appendChild(card);
  });

  // Bind field changes
  container.querySelectorAll('[data-field]').forEach(el => {
    el.addEventListener('input', e => {
      const idx = +e.target.dataset.idx;
      const field = e.target.dataset.field;
      distItems[idx][field] = e.target.value;
      // Update dot colour live when matéria changes
      if (field === 'materia') {
        const subj = SUBJECTS.find(s => s.id === resolveSubjectId(e.target.value));
        const dot = document.getElementById(`dot-${idx}`);
        if (dot) dot.style.background = subj ? subj.color : 'var(--text-muted)';
      }
    });
  });

  // Remove buttons
  container.querySelectorAll('.dist-item-remove').forEach(btn => {
    btn.addEventListener('click', e => {
      distItems.splice(+e.currentTarget.dataset.idx, 1);
      if (distItems.length === 0) distItems.push(makeEmptyItem());
      renderDistList();
    });
  });
}

function runDistribute() {
  // Sync any remaining edits (textarea fires input but let's be safe)
  const valids = distItems.filter(i => i.materia.trim());

  if (valids.length === 0) {
    showToast('✗ Adicione pelo menos um conteúdo com matéria definida.', 'error');
    return;
  }

  const { semana, overflow } = distribute(valids);

  // Apply to calendar (import path — reuse existing importJSON logic inline)
  const weekStart = getWeekStart(weekOffset);
  DAY_KEYS_ORDER.forEach((dayKey, d) => {
    const date    = new Date(weekStart);
    date.setDate(date.getDate() + d);
    const dateKey = toDateKey(date);
    data[dateKey] = [];
    semana[dayKey].forEach((b, i) => {
      const subjectId = resolveSubjectId(b.materia) || null;
      const note = (b.descricao || b.titulo || '').trim();
      data[dateKey][i] = { subject: subjectId, note,
        titulo: b.titulo, descricao: b.descricao,
        detalhes: b.detalhes, duracao: b.duracao, prioridade: b.prioridade };
    });
  });

  saveData();
  renderCalendar();

  // Show result feedback
  const resultEl = document.getElementById('dist-result');
  resultEl.style.display = '';
  if (overflow.length === 0) {
    resultEl.className = 'dist-result success';
    resultEl.textContent = `✓ ${valids.length} conteúdo(s) distribuído(s) com sucesso na semana atual.`;
    setTimeout(closeDistModal, 1400);
    showToast(`✓ ${valids.length} conteúdos distribuídos!`, 'success');
  } else {
    resultEl.className = 'dist-result';
    const names = overflow.map(c => `• ${c.materia}${c.titulo ? ': '+c.titulo : ''}`).join('\n');
    resultEl.textContent =
      `⚠ ${valids.length - overflow.length} distribuído(s). ` +
      `${overflow.length} não coube(ram) nos 28 blocos disponíveis:\n${names}`;
    showToast(`⚠ ${overflow.length} conteúdo(s) não distribuído(s).`, 'error');
  }
}

function bindDistributeEvents() {
  document.getElementById('btn-distribute').addEventListener('click', openDistModal);
  document.getElementById('dist-close').addEventListener('click', closeDistModal);
  document.getElementById('dist-cancel').addEventListener('click', closeDistModal);
  document.getElementById('dist-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('dist-overlay')) closeDistModal();
  });
  document.getElementById('dist-add').addEventListener('click', () => {
    distItems.push(makeEmptyItem());
    renderDistList();
    // scroll to new item
    const list = document.getElementById('dist-list');
    list.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  document.getElementById('dist-clear-list').addEventListener('click', () => {
    distItems = [makeEmptyItem()];
    renderDistList();
    document.getElementById('dist-result').style.display = 'none';
  });
  document.getElementById('dist-run').addEventListener('click', runDistribute);
}

// ── Event listeners ────────────────────────────────────────────
function bindEvents() {
  document.getElementById('btn-prev').addEventListener('click', () => {
    weekOffset--;
    renderCalendar();
  });

  document.getElementById('btn-next').addEventListener('click', () => {
    weekOffset++;
    renderCalendar();
  });

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('btn-save').addEventListener('click', saveBlock);
  document.getElementById('btn-clear').addEventListener('click', clearBlock);

  // Close on overlay click
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });

  // Close on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal();
      closeDetails();
      closeDistModal();
    }
  });

  // ── Import / Export ──────────────────────────────────────────
  const fileInput = document.getElementById('file-input');

  document.getElementById('btn-import').addEventListener('click', () => {
    fileInput.value = '';   // reset so same file can be re-imported
    fileInput.click();
  });

  fileInput.addEventListener('change', () => {
    importJSON(fileInput.files[0]);
  });

  document.getElementById('btn-export').addEventListener('click', exportJSON);
}

// ── Init ───────────────────────────────────────────────────────
function init() {
  loadData();
  bindEvents();
  bindDetailsEvents();
  bindDistributeEvents();
  renderCalendar();
  renderLegend();
}

document.addEventListener('DOMContentLoaded', init);
