/* ============================================================
   Planner ENEM — experiência v2
   ============================================================ */

const STORAGE_KEY = 'studyPlanner_v1';
const TUTORIAL_KEY = 'studyPlanner_tutorial_seen_v2';
const INTRO_STATE_KEY = 'studyPlanner_intro_collapsed_v1';
const DAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const BLOCK_TIMES = ['07:00 – 08:00', '08:00 – 09:00', '09:00 – 10:00', '10:00 – 11:00', '11:00 – 12:00'];
const DAY_KEYS_ORDER = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
const MAX_BLOCKS_PER_DAY = 5;

const SUBJECTS = [
  { id: 'bio', label: 'Biologia', color: '#7fa67f' },
  { id: 'qui', label: 'Química', color: '#c98a64' },
  { id: 'fis', label: 'Física', color: '#75a0b5' },
  { id: 'mat', label: 'Matemática', color: '#7e8fb8' },
  { id: 'his', label: 'História', color: '#b8a168' },
  { id: 'fil', label: 'Fil. e Sociologia', color: '#a9809a', aliases: ['filosofia e sociologia', 'filosofia', 'sociologia', 'fil. e sociologia', 'filosofia/sociologia'] },
  { id: 'art', label: 'Artes e Literatura', color: '#9784ad', aliases: ['artes e literatura', 'artes', 'literatura', 'arte'] },
  { id: 'gra', label: 'Gramática Tradicional', color: '#9097a0', aliases: ['gramática tradicional', 'gramatica tradicional', 'gramática', 'gramatica', 'português', 'portugues'] },
  { id: 'int', label: 'Interpretação de Texto', color: '#849a93', aliases: ['interpretação de texto', 'interpretacao de texto', 'interpretação', 'interpretacao', 'linguagens'] },
  { id: 'red', label: 'Redação', color: '#b48a73', aliases: ['redação', 'redacao', 'produção textual', 'producao textual'] },
  { id: 'ing', label: 'Inglês', color: '#b97770', aliases: ['ingles'] },
  { id: 'geo', label: 'Geografia e Atualidades', color: '#6f9980', aliases: ['geografia e atualidades', 'geografia', 'atualidades'] }
];

const PRIORITY_ORDER = { alta: 0, media: 1, baixa: 2, '': 3 };

let weekOffset = 0;
let data = {};
let editing = null;
let detailsContext = null;
let toastTimer = null;
let distItems = [];

const $ = (id) => document.getElementById(id);

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalize(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.\/]/g, '')
    .trim()
    .toLowerCase();
}

function resolveSubjectId(materiaStr) {
  if (!materiaStr) return null;
  const raw = materiaStr.trim().toLowerCase();
  const norm = normalize(materiaStr);

  let found = SUBJECTS.find(s => s.label.toLowerCase() === raw);
  if (found) return found.id;

  found = SUBJECTS.find(s => (s.aliases || []).some(a => a.toLowerCase() === raw));
  if (found) return found.id;

  found = SUBJECTS.find(s => normalize(s.label) === norm || (s.aliases || []).some(a => normalize(a) === norm));
  if (found) return found.id;

  found = SUBJECTS.find(s => {
    const label = normalize(s.label);
    const aliases = (s.aliases || []).map(normalize);
    return label.includes(norm) || norm.includes(label) || aliases.some(a => a.includes(norm) || norm.includes(a));
  });
  return found ? found.id : null;
}

function getSubject(id) {
  return SUBJECTS.find(s => s.id === id) || null;
}

function loadData() {
  try {
    data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (!data || typeof data !== 'object' || Array.isArray(data)) data = {};
  } catch {
    data = {};
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getBlock(dateKey, index) {
  return (data[dateKey] && data[dateKey][index]) || { subject: null, note: '', studied: false };
}

function setBlock(dateKey, index, patch) {
  if (!data[dateKey]) data[dateKey] = [];
  const existing = getBlock(dateKey, index);
  data[dateKey][index] = { ...existing, ...patch };
  saveData();
}

function getWeekStart(offset = 0) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay() + offset * 7);
  return start;
}

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatWeekLabel(start) {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const opts = { day: '2-digit', month: 'short' };
  return `${start.toLocaleDateString('pt-BR', opts)} – ${end.toLocaleDateString('pt-BR', opts)}`;
}

function isToday(date) {
  const today = new Date();
  return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
}

function getWeekBlocks() {
  const weekStart = getWeekStart(weekOffset);
  const blocks = [];
  for (let d = 0; d < 7; d++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + d);
    const dateKey = toDateKey(date);
    for (let i = 0; i < MAX_BLOCKS_PER_DAY; i++) blocks.push({ ...getBlock(dateKey, i), dateKey, index: i });
  }
  return blocks;
}

function showToast(message, type = 'success') {
  const toast = $('toast');
  toast.textContent = message;
  toast.className = `toast toast--${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3600);
}

function renderLegend() {
  const legend = $('subject-legend');
  legend.innerHTML = SUBJECTS.map(subject => `
    <span class="legend-item"><span class="legend-dot" style="background:${subject.color}"></span>${escapeHtml(subject.label)}</span>
  `).join('');
}

function renderCalendar() {
  const weekStart = getWeekStart(weekOffset);
  $('week-label').textContent = formatWeekLabel(weekStart);
  const grid = $('calendar-grid');
  grid.innerHTML = '';

  for (let d = 0; d < 7; d++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + d);
    const dateKey = toDateKey(date);
    const dayBlocks = Array.from({ length: MAX_BLOCKS_PER_DAY }, (_, i) => getBlock(dateKey, i));
    const filled = dayBlocks.filter(b => b.subject);
    const studied = filled.filter(b => b.studied);

    const card = document.createElement('article');
    card.className = `day-card${isToday(date) ? ' today' : ''}`;

    const header = document.createElement('div');
    header.className = 'day-header';
    header.innerHTML = `
      <div class="day-header-left"><span class="day-name">${DAYS_SHORT[d]}</span><span class="day-date">${String(date.getDate()).padStart(2, '0')}</span></div>
      ${filled.length ? `<span class="day-progress">${studied.length}/${filled.length}</span>` : ''}
    `;
    card.appendChild(header);

    const blocksEl = document.createElement('div');
    blocksEl.className = 'day-blocks';

    for (let i = 0; i < MAX_BLOCKS_PER_DAY; i++) {
      const block = getBlock(dateKey, i);
      const subject = getSubject(block.subject);
      const blockEl = document.createElement('div');
      blockEl.className = `study-block ${subject ? 'block-filled' : 'block-empty'}${block.studied ? ' is-studied' : ''}`;
      blockEl.style.setProperty('--block-color', subject ? subject.color : 'var(--line)');
      blockEl.setAttribute('role', 'button');
      blockEl.setAttribute('tabindex', '0');
      blockEl.setAttribute('aria-label', `${DAYS_SHORT[d]}, bloco ${i + 1}. ${subject ? subject.label : 'Vazio'}`);

      if (!subject) {
        blockEl.innerHTML = `<div class="empty-copy"><strong>Adicionar bloco</strong>${BLOCK_TIMES[i]}</div>`;
      } else {
        const preview = block.titulo || block.descricao || block.note || 'Conteúdo de estudo';
        blockEl.innerHTML = `
          <div class="block-header">
            <span class="block-time">${BLOCK_TIMES[i]}</span>
            <input type="checkbox" class="study-checkbox" ${block.studied ? 'checked' : ''} aria-label="Marcar como concluído" />
          </div>
          <div class="block-subject">${escapeHtml(subject.label)}</div>
          <div class="block-note-preview">${escapeHtml(preview)}</div>
        `;
      }

      blockEl.addEventListener('click', (event) => {
        if (event.target.classList.contains('study-checkbox')) {
          event.stopPropagation();
          toggleStudied(dateKey, i, event.target.checked);
          return;
        }
        subject ? openDetails(dateKey, i) : openEdit(dateKey, i);
      });
      blockEl.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          subject ? openDetails(dateKey, i) : openEdit(dateKey, i);
        }
      });
      blocksEl.appendChild(blockEl);
    }

    card.appendChild(blocksEl);
    grid.appendChild(card);
  }

  updateStats();
  updateQuickStart();
}

function toggleStudied(dateKey, index, studied) {
  setBlock(dateKey, index, { studied });
  renderCalendar();
}

function updateStats() {
  const blocks = getWeekBlocks();
  const filled = blocks.filter(b => b.subject);
  const studied = filled.filter(b => b.studied);
  const counts = {};
  filled.forEach(b => counts[b.subject] = (counts[b.subject] || 0) + 1);

  let topId = null;
  let topCount = 0;
  Object.entries(counts).forEach(([id, count]) => {
    if (count > topCount) {
      topCount = count;
      topId = id;
    }
  });

  const pct = filled.length ? Math.round((studied.length / filled.length) * 100) : 0;
  $('stat-filled').textContent = `${filled.length}`;
  $('stat-studied').textContent = `${studied.length}/${filled.length}`;
  $('stat-top-subject').textContent = topId ? getSubject(topId)?.label || '—' : '—';
  $('stat-progress-pct').textContent = `${pct}%`;
  $('stat-progress-fill').style.width = `${pct}%`;
  $('progress-message').textContent = filled.length
    ? (pct === 100 ? 'Semana concluída. Excelente consistência.' : `${filled.length - studied.length} bloco(s) ainda faltam.`)
    : 'Comece importando ou adicionando blocos.';
}

function applyIntroState() {
  const intro = $('quick-start');
  const restore = $('intro-restore');
  if (!intro || !restore) return;
  const collapsed = localStorage.getItem(INTRO_STATE_KEY) === '1';
  intro.hidden = collapsed;
  restore.hidden = !collapsed;
}

function setIntroCollapsed(collapsed) {
  localStorage.setItem(INTRO_STATE_KEY, collapsed ? '1' : '0');
  applyIntroState();
  if (collapsed) {
    $('planner-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function updateQuickStart() {
  applyIntroState();
}

function renderEnemCountdown() {
  const weeksEl = $('enem-weeks');
  const daysEl = $('enem-days');
  const weeksLabel = $('enem-weeks-label');
  const daysLabel = $('enem-days-label');
  const titleEl = $('enem-countdown-title');
  const dateEl = $('enem-countdown-date');
  const timeEl = $('enem-countdown-time');
  const waitingEl = $('enem-countdown-waiting');
  if (!weeksEl || !daysEl || !titleEl || !dateEl || !timeEl || !waitingEl) return;

  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const firstDay = Date.UTC(2026, 10, 8);
  const secondDay = Date.UTC(2026, 10, 15);
  const DAY_MS = 86400000;

  if (today > secondDay) {
    timeEl.hidden = true;
    waitingEl.hidden = false;
    titleEl.textContent = 'ENEM concluído';
    dateEl.textContent = 'Aguardando o calendário oficial da próxima edição.';
    return;
  }

  waitingEl.hidden = true;
  timeEl.hidden = false;

  const target = today < firstDay ? firstDay : secondDay;
  const diffDays = Math.max(0, Math.round((target - today) / DAY_MS));
  const weeks = Math.floor(diffDays / 7);
  const days = diffDays % 7;

  weeksEl.textContent = String(weeks);
  daysEl.textContent = String(days);
  weeksLabel.textContent = weeks === 1 ? 'semana' : 'semanas';
  daysLabel.textContent = days === 1 ? 'dia' : 'dias';

  if (target === firstDay) {
    titleEl.textContent = 'Até o 1º dia do ENEM 2026';
    dateEl.textContent = '8 de novembro de 2026';
  } else {
    titleEl.textContent = 'Até o 2º dia do ENEM 2026';
    dateEl.textContent = '15 de novembro de 2026';
  }
}

function openOverlay(id) {
  $(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeOverlay(id) {
  $(id).classList.remove('open');
  if (!document.querySelector('.overlay.open')) document.body.style.overflow = '';
}

function openEdit(dateKey, blockIndex) {
  editing = { dateKey, blockIndex };
  const block = getBlock(dateKey, blockIndex);
  const grid = $('subject-grid');
  grid.innerHTML = '';

  SUBJECTS.forEach(subject => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `subject-btn${block.subject === subject.id ? ' selected' : ''}`;
    btn.dataset.subject = subject.id;
    btn.style.setProperty('--subject-color', subject.color);
    btn.innerHTML = `<span class="subject-dot" style="background:${subject.color}"></span>${escapeHtml(subject.label)}`;
    btn.addEventListener('click', () => {
      grid.querySelectorAll('.subject-btn').forEach(x => x.classList.remove('selected'));
      btn.classList.add('selected');
    });
    grid.appendChild(btn);
  });

  $('block-note').value = block.note || block.descricao || block.titulo || '';
  const date = new Date(`${dateKey}T12:00:00`);
  $('edit-title').textContent = `${DAYS_SHORT[date.getDay()]} · ${BLOCK_TIMES[blockIndex]}`;
  openOverlay('edit-overlay');
  setTimeout(() => $('block-note').focus(), 50);
}

function closeEdit() {
  editing = null;
  closeOverlay('edit-overlay');
}

function saveEdit() {
  if (!editing) return;
  const selected = $('subject-grid').querySelector('.subject-btn.selected');
  const subject = selected?.dataset.subject || null;
  const note = $('block-note').value.trim();
  const existing = getBlock(editing.dateKey, editing.blockIndex);
  setBlock(editing.dateKey, editing.blockIndex, {
    subject,
    note,
    titulo: existing.titulo || note.split('\n')[0] || '',
    descricao: existing.descricao || note,
    detalhes: existing.detalhes || '',
    duracao: existing.duracao || '',
    prioridade: existing.prioridade || '',
    studied: existing.studied || false
  });
  closeEdit();
  renderCalendar();
  showToast('Bloco atualizado.', 'success');
}

function clearEdit() {
  if (!editing) return;
  if (!data[editing.dateKey]) data[editing.dateKey] = [];
  data[editing.dateKey][editing.blockIndex] = { subject: null, note: '', studied: false };
  saveData();
  closeEdit();
  renderCalendar();
  showToast('Bloco removido.', 'success');
}

function openDetails(dateKey, blockIndex) {
  const block = getBlock(dateKey, blockIndex);
  if (!block.subject) return openEdit(dateKey, blockIndex);
  detailsContext = { dateKey, blockIndex };
  const subject = getSubject(block.subject);

  $('details-dot').style.background = subject?.color || 'var(--muted)';
  $('details-subject').textContent = subject?.label || '—';
  $('details-title').textContent = block.titulo || block.note || block.descricao || 'Conteúdo de estudo';

  const meta = $('details-meta');
  meta.innerHTML = '';
  const badges = [
    ['Duração', block.duracao],
    ['Prioridade', block.prioridade]
  ].filter(([, value]) => value);
  badges.forEach(([label, value]) => {
    const span = document.createElement('span');
    span.className = 'details-badge';
    span.textContent = `${label}: ${value}`;
    meta.appendChild(span);
  });

  const desc = block.descricao || block.note || '';
  $('details-desc').textContent = desc;
  $('details-desc-section').style.display = desc ? '' : 'none';
  $('details-det').textContent = block.detalhes || '';
  $('details-det-section').style.display = block.detalhes ? '' : 'none';
  openOverlay('details-overlay');
}

function closeDetails() {
  detailsContext = null;
  closeOverlay('details-overlay');
}

function openHelp(markSeen = true) {
  if (markSeen) localStorage.setItem(TUTORIAL_KEY, '1');
  openOverlay('help-overlay');
}

function closeHelp() {
  closeOverlay('help-overlay');
}

function triggerImport() {
  closeHelp();
  $('file-input').value = '';
  $('file-input').click();
}

const REQUIRED_BLOCK_FIELDS = ['materia', 'cor', 'titulo', 'descricao', 'detalhes', 'duracao', 'prioridade'];

function validateWeekJSON(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return 'O arquivo não contém um objeto JSON válido.';
  if (!parsed.semana || typeof parsed.semana !== 'object') return 'A chave “semana” não foi encontrada.';

  for (const day of DAY_KEYS_ORDER) {
    if (!Array.isArray(parsed.semana[day])) return `O dia “${day}” não foi encontrado.`;
    if (parsed.semana[day].length > MAX_BLOCKS_PER_DAY) return `O dia “${day}” possui mais de ${MAX_BLOCKS_PER_DAY} blocos.`;
    for (let i = 0; i < parsed.semana[day].length; i++) {
      const block = parsed.semana[day][i];
      if (!block || typeof block !== 'object') return `O bloco ${i + 1} de “${day}” é inválido.`;
      for (const field of REQUIRED_BLOCK_FIELDS) {
        if (!(field in block)) return `O campo “${field}” está ausente no bloco ${i + 1} de “${day}”.`;
      }
    }
  }
  return null;
}

function applyWeek(semana) {
  const weekStart = getWeekStart(weekOffset);
  DAY_KEYS_ORDER.forEach((dayKey, d) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + d);
    const dateKey = toDateKey(date);
    const blocks = semana[dayKey] || [];
    data[dateKey] = [];

    for (let i = 0; i < MAX_BLOCKS_PER_DAY; i++) {
      const block = blocks[i];
      if (!block) {
        data[dateKey][i] = { subject: null, note: '', studied: false };
        continue;
      }
      const subjectId = resolveSubjectId(block.materia);
      data[dateKey][i] = {
        subject: subjectId,
        note: (block.descricao || block.titulo || '').trim(),
        titulo: block.titulo || '',
        descricao: block.descricao || '',
        detalhes: block.detalhes || '',
        duracao: block.duracao || '',
        prioridade: block.prioridade || '',
        studied: false
      };
    }
  });
  saveData();
  renderCalendar();
}

function importJSON(file) {
  if (!file) return;
  const reader = new FileReader();

  reader.onload = event => {
    let parsed;
    try {
      parsed = JSON.parse(event.target.result);
    } catch {
      return showToast('Esse arquivo não é um JSON válido.', 'error');
    }

    if (Array.isArray(parsed.conteudos)) {
      const contents = parsed.conteudos
        .map(c => ({
          materia: c.materia || '',
          titulo: c.titulo || '',
          descricao: c.descricao || c.detalhes || '',
          detalhes: c.detalhes || '',
          duracao: c.duracao || '',
          prioridade: c.prioridade || ''
        }))
        .filter(c => c.materia.trim());
      if (!contents.length) return showToast('Nenhum conteúdo com matéria definida foi encontrado.', 'error');
      const { semana, overflow } = distribute(contents);
      applyWeek(semana);
      showToast(overflow.length ? `${contents.length - overflow.length} conteúdos importados; ${overflow.length} não couberam.` : `${contents.length} conteúdos importados e distribuídos.`, overflow.length ? 'error' : 'success');
      return;
    }

    const error = validateWeekJSON(parsed);
    if (error) return showToast(error, 'error');
    applyWeek(parsed.semana);
    $('import-hint').hidden = true;
    showToast(`Semana importada em ${formatWeekLabel(getWeekStart(weekOffset))}.`, 'success');
  };

  reader.onerror = () => showToast('Não foi possível ler o arquivo.', 'error');
  reader.readAsText(file);
}

function exportJSON() {
  const weekStart = getWeekStart(weekOffset);
  const semana = {};

  DAY_KEYS_ORDER.forEach((dayKey, d) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + d);
    const dateKey = toDateKey(date);
    semana[dayKey] = [];

    for (let i = 0; i < MAX_BLOCKS_PER_DAY; i++) {
      const block = getBlock(dateKey, i);
      if (!block.subject) continue;
      const subject = getSubject(block.subject);
      semana[dayKey].push({
        materia: subject?.label || '',
        cor: subject?.color || '',
        titulo: block.titulo || block.note || '',
        descricao: block.descricao || block.note || '',
        detalhes: block.detalhes || '',
        duracao: block.duracao || '',
        prioridade: block.prioridade || ''
      });
    }
  });

  const blob = new Blob([JSON.stringify({ semana }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `planner-${toDateKey(weekStart)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('Semana exportada.', 'success');
}

function makeEmptyDistItem() {
  return { materia: '', titulo: '', descricao: '', detalhes: '', duracao: '', prioridade: 'media' };
}

function distribute(contents) {
  const remaining = contents.map((item, originalIndex) => ({ ...item, originalIndex }));
  remaining.sort((a, b) => {
    const pa = PRIORITY_ORDER[a.prioridade?.toLowerCase()] ?? 3;
    const pb = PRIORITY_ORDER[b.prioridade?.toLowerCase()] ?? 3;
    return pa - pb || a.originalIndex - b.originalIndex;
  });

  const grid = Array.from({ length: 7 }, () => []);
  const overflow = [];

  for (const item of remaining) {
    const subjectId = resolveSubjectId(item.materia);
    const candidates = grid
      .map((day, index) => ({ day, index, same: day.filter(x => resolveSubjectId(x.materia) === subjectId).length }))
      .filter(x => x.day.length < MAX_BLOCKS_PER_DAY)
      .sort((a, b) => a.same - b.same || a.day.length - b.day.length || a.index - b.index);

    if (!candidates.length) {
      overflow.push(item);
      continue;
    }
    candidates[0].day.push(item);
  }

  const semana = {};
  DAY_KEYS_ORDER.forEach((key, dayIndex) => {
    semana[key] = grid[dayIndex].map(item => {
      const subject = getSubject(resolveSubjectId(item.materia));
      return {
        materia: item.materia || '',
        cor: subject?.color || '',
        titulo: item.titulo || '',
        descricao: item.descricao || '',
        detalhes: item.detalhes || '',
        duracao: item.duracao || '',
        prioridade: item.prioridade || ''
      };
    });
  });
  return { semana, overflow };
}

function renderDistList() {
  const list = $('dist-list');
  list.innerHTML = '';

  distItems.forEach((item, index) => {
    const subject = getSubject(resolveSubjectId(item.materia));
    const card = document.createElement('div');
    card.className = 'dist-item';
    card.innerHTML = `
      <button class="dist-item-remove" type="button" data-remove="${index}" aria-label="Remover conteúdo">×</button>
      <div class="dist-item-row">
        <label>Matéria</label>
        <div class="dist-subject-indicator">
          <span class="dist-dot-preview" style="background:${subject?.color || '#555'}"></span>
          <select data-field="materia" data-index="${index}">
            <option value="">Selecione…</option>
            ${SUBJECTS.map(s => `<option value="${escapeHtml(s.label)}" ${normalize(item.materia) === normalize(s.label) ? 'selected' : ''}>${escapeHtml(s.label)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="dist-item-row">
        <label>Prioridade</label>
        <select data-field="prioridade" data-index="${index}">
          <option value="alta" ${item.prioridade === 'alta' ? 'selected' : ''}>Alta</option>
          <option value="media" ${item.prioridade === 'media' ? 'selected' : ''}>Média</option>
          <option value="baixa" ${item.prioridade === 'baixa' ? 'selected' : ''}>Baixa</option>
        </select>
      </div>
      <div class="dist-item-row full"><label>Título</label><input data-field="titulo" data-index="${index}" value="${escapeHtml(item.titulo)}" placeholder="Ex.: Função afim" /></div>
      <div class="dist-item-row full"><label>Descrição</label><textarea rows="2" data-field="descricao" data-index="${index}" placeholder="O que você vai estudar">${escapeHtml(item.descricao)}</textarea></div>
    `;
    list.appendChild(card);
  });

  list.querySelectorAll('[data-field]').forEach(input => {
    input.addEventListener('input', event => {
      const index = Number(event.target.dataset.index);
      distItems[index][event.target.dataset.field] = event.target.value;
      if (event.target.dataset.field === 'materia') renderDistList();
    });
  });

  list.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => {
      distItems.splice(Number(btn.dataset.remove), 1);
      if (!distItems.length) distItems.push(makeEmptyDistItem());
      renderDistList();
    });
  });
}

function openDistribute() {
  if (!distItems.length) distItems = [makeEmptyDistItem()];
  renderDistList();
  $('dist-result').hidden = true;
  openOverlay('dist-overlay');
}

function closeDistribute() {
  closeOverlay('dist-overlay');
}

function runDistribute() {
  const valid = distItems.filter(item => item.materia.trim() && (item.titulo.trim() || item.descricao.trim()));
  if (!valid.length) return showToast('Adicione pelo menos um conteúdo com matéria e título/descrição.', 'error');
  const { semana, overflow } = distribute(valid);
  applyWeek(semana);
  $('dist-result').hidden = false;
  $('dist-result').className = `dist-result${overflow.length ? '' : ' success'}`;
  $('dist-result').textContent = overflow.length
    ? `${valid.length - overflow.length} conteúdo(s) distribuído(s). ${overflow.length} não coube(ram) nos ${7 * MAX_BLOCKS_PER_DAY} blocos.`
    : `${valid.length} conteúdo(s) distribuído(s) com sucesso.`;
  if (!overflow.length) setTimeout(closeDistribute, 850);
}

function bindDropdown() {
  const more = $('btn-more');
  const menu = $('more-menu');
  more.addEventListener('click', event => {
    event.stopPropagation();
    const opening = menu.hidden;
    menu.hidden = !opening;
    more.setAttribute('aria-expanded', String(opening));
  });
  document.addEventListener('click', event => {
    if (!menu.hidden && !menu.contains(event.target) && event.target !== more) {
      menu.hidden = true;
      more.setAttribute('aria-expanded', 'false');
    }
  });
}

function bindEvents() {
  $('btn-prev').addEventListener('click', () => { weekOffset--; renderCalendar(); });
  $('btn-next').addEventListener('click', () => { weekOffset++; renderCalendar(); });

  $('intro-collapse')?.addEventListener('click', () => setIntroCollapsed(true));
  $('intro-restore')?.addEventListener('click', () => setIntroCollapsed(false));

  [$('btn-import'), $('quick-import'), $('hint-import'), $('section-import')].forEach(btn => btn?.addEventListener('click', triggerImport));
  $('file-input').addEventListener('change', () => importJSON($('file-input').files[0]));

  $('btn-help').addEventListener('click', () => openHelp(true));
  $('help-close').addEventListener('click', closeHelp);
  $('help-import').addEventListener('click', triggerImport);

  $('edit-close').addEventListener('click', closeEdit);
  $('btn-save').addEventListener('click', saveEdit);
  $('btn-clear').addEventListener('click', clearEdit);

  $('details-close').addEventListener('click', closeDetails);
  $('details-close-btn').addEventListener('click', closeDetails);
  $('details-edit-btn').addEventListener('click', () => {
    if (!detailsContext) return;
    const context = { ...detailsContext };
    closeDetails();
    openEdit(context.dateKey, context.blockIndex);
  });

  $('btn-distribute').addEventListener('click', openDistribute);
  $('section-distribute').addEventListener('click', openDistribute);
  $('dist-close').addEventListener('click', closeDistribute);
  $('dist-cancel').addEventListener('click', closeDistribute);
  $('dist-add').addEventListener('click', () => { distItems.push(makeEmptyDistItem()); renderDistList(); });
  $('dist-clear-list').addEventListener('click', () => { distItems = [makeEmptyDistItem()]; renderDistList(); $('dist-result').hidden = true; });
  $('dist-run').addEventListener('click', runDistribute);
  $('btn-export').addEventListener('click', exportJSON);

  document.querySelectorAll('.overlay').forEach(overlay => {
    overlay.addEventListener('click', event => { if (event.target === overlay) closeOverlay(overlay.id); });
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    document.querySelectorAll('.overlay.open').forEach(overlay => closeOverlay(overlay.id));
  });

  bindDropdown();
}

function handleEntryContext() {
  const params = new URLSearchParams(location.search);
  const shouldImport = params.get('import') === '1' || location.hash === '#importar';
  if (shouldImport) {
    $('import-hint').hidden = false;
    $('btn-import').classList.add('pulse-import');
    setTimeout(() => $('btn-import').classList.remove('pulse-import'), 3000);
  }

  const hasAnyData = Object.values(data).some(day => Array.isArray(day) && day.some(block => block?.subject));
  if (!localStorage.getItem(TUTORIAL_KEY) && !hasAnyData && !shouldImport) {
    setTimeout(() => openHelp(true), 550);
  }
}

function init() {
  loadData();
  bindEvents();
  renderLegend();
  renderCalendar();
  renderEnemCountdown();
  setInterval(renderEnemCountdown, 60 * 60 * 1000);
  handleEntryContext();
}

document.addEventListener('DOMContentLoaded', init);