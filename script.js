/* ============================================================
   Planner ENEM, experiência v2
   ============================================================ */

const STORAGE_KEY = 'studyPlanner_v1';
const TUTORIAL_KEY = 'studyPlanner_tutorial_seen_v2';
const INTRO_STATE_KEY = 'studyPlanner_intro_collapsed_v1';
const VIEW_KEY = 'studyPlanner_view_v1';
const DAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const BLOCK_TIMES = ['07:00 às 08:00', '08:00 às 09:00', '09:00 às 10:00', '10:00 às 11:00', '11:00 às 12:00'];
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

const AVAILABLE_PLANS = [
  {
    "id": "9",
    "total": 9,
    "folder": "downloads/planos/9-semanas",
    "title": "9 semanas"
  },
  {
    "id": "14",
    "total": 14,
    "folder": "downloads/planos/14-semanas",
    "title": "14 semanas"
  },
  {
    "id": "18",
    "total": 18,
    "folder": "downloads/planos/18-semanas",
    "title": "18 semanas"
  },
  {
    "id": "22",
    "total": 22,
    "folder": "downloads/planos/22-semanas",
    "title": "22 semanas"
  },
  {
    "id": "27",
    "total": 27,
    "folder": "downloads/planos/27-semanas",
    "title": "27 semanas"
  },
  {
    "id": "30",
    "total": 30,
    "folder": "downloads/planos/30-semanas",
    "title": "30 semanas"
  },
  {
    "id": "35",
    "total": 35,
    "folder": "downloads/planos/35-semanas",
    "title": "35 semanas"
  }
];

const PRIORITY_ORDER = { alta: 0, media: 1, baixa: 2, '': 3 };

let weekOffset = 0;
let monthOffset = 0;
let yearOffset = 0;
let viewMode = ['day', 'week', 'month', 'year'].includes(localStorage.getItem(VIEW_KEY)) ? localStorage.getItem(VIEW_KEY) : 'week';
let data = {};
let editing = null;
let detailsContext = null;
let toastTimer = null;
let distItems = [];
let selectedPlanSubjects = new Set(SUBJECTS.map(subject => subject.id));

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

function getWeekStartForDate(input) {
  const date = new Date(input);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - date.getDay());
  return date;
}

function getWeekOffsetForDate(input) {
  const target = getWeekStartForDate(input);
  const current = getWeekStart(0);
  return Math.round((target - current) / 604800000);
}

function getMonthAnchor(offset = monthOffset) {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + offset, 1);
}

function getYearAnchor(offset = yearOffset) {
  const now = new Date();
  return new Date(now.getFullYear() + offset, 0, 1);
}

function monthOffsetForDate(input) {
  const date = new Date(input);
  const now = new Date();
  return (date.getFullYear() - now.getFullYear()) * 12 + date.getMonth() - now.getMonth();
}

function yearOffsetForDate(input) {
  return new Date(input).getFullYear() - new Date().getFullYear();
}

function getCurrentAnchorDate() {
  if (viewMode === 'day') return new Date();
  if (viewMode === 'month') return getMonthAnchor();
  if (viewMode === 'year') return getYearAnchor();
  return getWeekStart(weekOffset);
}

function setViewMode(mode, anchorDate = null) {
  if (!['day', 'week', 'month', 'year'].includes(mode)) return;
  const anchor = anchorDate ? new Date(anchorDate) : getCurrentAnchorDate();
  if (mode === 'week') weekOffset = getWeekOffsetForDate(anchor);
  if (mode === 'month') monthOffset = monthOffsetForDate(anchor);
  if (mode === 'year') yearOffset = yearOffsetForDate(anchor);
  viewMode = mode;
  localStorage.setItem(VIEW_KEY, mode);
  renderCalendar();
}

function shiftCurrentPeriod(amount) {
  if (viewMode === 'day') return;
  if (viewMode === 'week') weekOffset += amount;
  if (viewMode === 'month') monthOffset += amount;
  if (viewMode === 'year') yearOffset += amount;
  renderCalendar();
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
  return `${start.toLocaleDateString('pt-BR', opts)} a ${end.toLocaleDateString('pt-BR', opts)}`;
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

function renderWeekView() {
  const weekStart = getWeekStart(weekOffset);
  $('period-kind').textContent = 'Semana selecionada';
  $('week-label').textContent = formatWeekLabel(weekStart);
  const grid = $('calendar-grid');
  grid.classList.remove('calendar-grid--day');
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

}

function renderDayView() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  const dateKey = toDateKey(date);
  const dayIndex = date.getDay();
  const dayBlocks = Array.from({ length: MAX_BLOCKS_PER_DAY }, (_, i) => getBlock(dateKey, i));
  const filled = dayBlocks.filter(block => block.subject);
  const studied = filled.filter(block => block.studied);
  const grid = $('calendar-grid');

  $('period-kind').textContent = 'Hoje';
  $('week-label').textContent = date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long'
  });

  grid.classList.add('calendar-grid--day');
  grid.innerHTML = '';

  const card = document.createElement('article');
  card.className = 'day-card today';

  const header = document.createElement('div');
  header.className = 'day-header';
  header.innerHTML = `
    <div class="day-header-left">
      <span class="day-name">${DAYS_SHORT[dayIndex]}</span>
      <span class="day-date">${String(date.getDate()).padStart(2, '0')}</span>
    </div>
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
    blockEl.setAttribute('aria-label', `Hoje, bloco ${i + 1}. ${subject ? subject.label : 'Vazio'}`);

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

    blockEl.addEventListener('click', event => {
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

function getDateBlocks(date) {
  const dateKey = toDateKey(date);
  return Array.from({ length: MAX_BLOCKS_PER_DAY }, (_, index) => ({ ...getBlock(dateKey, index), dateKey, index }));
}

function getRangeBlocks(start, end) {
  const blocks = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  while (cursor < end) {
    blocks.push(...getDateBlocks(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return blocks;
}

function renderMonthView() {
  const root = $('month-view');
  const anchor = getMonthAnchor();
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const monthName = anchor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  $('period-kind').textContent = 'Mês selecionado';
  $('week-label').textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay.getDay(); i++) {
    cells.push('<div class="month-day month-day--empty" aria-hidden="true"></div>');
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const filled = getDateBlocks(date).filter(block => block.subject);
    const studied = filled.filter(block => block.studied);
    const subjects = [...new Set(filled.map(block => block.subject).filter(Boolean))].slice(0, 5);
    const dots = subjects.map(id => {
      const subject = getSubject(id);
      return subject ? `<span style="background:${subject.color}"></span>` : '';
    }).join('');

    cells.push(`
      <button class="month-day${isToday(date) ? ' today' : ''}" type="button" data-date="${toDateKey(date)}">
        <span class="month-day__number">${day}</span>
        <span class="month-day__count">${filled.length ? `${filled.length} conteúdo${filled.length === 1 ? '' : 's'}` : 'Livre'}</span>
        <span class="month-day__progress">${filled.length ? `${studied.length} de ${filled.length} concluídos` : 'Sem conteúdo'}</span>
        <span class="month-day__dots">${dots}</span>
      </button>
    `);
  }

  root.innerHTML = `
    <div class="month-weekdays">${DAYS_SHORT.map(day => `<span>${day}</span>`).join('')}</div>
    <div class="month-grid">${cells.join('')}</div>
  `;
  root.querySelectorAll('[data-date]').forEach(button => {
    button.addEventListener('click', () => setViewMode('week', new Date(`${button.dataset.date}T12:00:00`)));
  });
}

function renderYearView() {
  const root = $('year-view');
  const anchor = getYearAnchor();
  const year = anchor.getFullYear();
  $('period-kind').textContent = 'Ano selecionado';
  $('week-label').textContent = String(year);

  const cards = [];
  for (let month = 0; month < 12; month++) {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 1);
    const filled = getRangeBlocks(start, end).filter(block => block.subject);
    const studied = filled.filter(block => block.studied);
    const pct = filled.length ? Math.round((studied.length / filled.length) * 100) : 0;
    const name = start.toLocaleDateString('pt-BR', { month: 'long' });

    cards.push(`
      <button class="year-card" type="button" data-month="${month}">
        <div class="year-card__head">
          <strong>${name.charAt(0).toUpperCase() + name.slice(1)}</strong>
          <span>${pct}%</span>
        </div>
        <div class="year-card__bar"><span style="width:${pct}%"></span></div>
        <p>${filled.length ? `${studied.length} de ${filled.length} conteúdos concluídos` : 'Nenhum conteúdo planejado'}</p>
      </button>
    `);
  }

  root.innerHTML = `<div class="year-grid">${cards.join('')}</div>`;
  root.querySelectorAll('[data-month]').forEach(button => {
    button.addEventListener('click', () => setViewMode('month', new Date(year, Number(button.dataset.month), 1)));
  });
}

function getCurrentPeriodBlocks() {
  if (viewMode === 'day') return getDateBlocks(new Date());
  if (viewMode === 'month') {
    const start = getMonthAnchor();
    return getRangeBlocks(start, new Date(start.getFullYear(), start.getMonth() + 1, 1));
  }
  if (viewMode === 'year') {
    const start = getYearAnchor();
    return getRangeBlocks(start, new Date(start.getFullYear() + 1, 0, 1));
  }
  return getWeekBlocks();
}

function renderCalendar() {
  const week = $('calendar-grid');
  const month = $('month-view');
  const year = $('year-view');

  week.hidden = !['day', 'week'].includes(viewMode);
  month.hidden = viewMode !== 'month';
  year.hidden = viewMode !== 'year';

  document.querySelectorAll('[data-view]').forEach(button => {
    button.classList.toggle('active', button.dataset.view === viewMode);
    button.setAttribute('aria-pressed', String(button.dataset.view === viewMode));
  });

  const isDayView = viewMode === 'day';
  const periodName = isDayView ? 'dia' : viewMode === 'week' ? 'semana' : viewMode === 'month' ? 'mês' : 'ano';
  $('btn-prev').disabled = isDayView;
  $('btn-next').disabled = isDayView;
  $('btn-prev').setAttribute('aria-label', isDayView ? 'A visualização Dia mostra apenas hoje' : `${periodName} anterior`);
  $('btn-next').setAttribute('aria-label', isDayView ? 'A visualização Dia mostra apenas hoje' : `próximo ${periodName}`);

  const eyebrow = $('planner-view-eyebrow');
  const title = $('planner-view-title');
  const description = $('planner-view-description');

  if (viewMode === 'day') {
    eyebrow.textContent = 'Hoje';
    title.textContent = 'Seu dia de estudos';
    description.textContent = 'Veja somente os conteúdos planejados para hoje e marque o que já concluiu.';
    renderDayView();
  } else if (viewMode === 'week') {
    eyebrow.textContent = 'Planner semanal';
    title.textContent = 'O que você vai estudar';
    description.textContent = 'Clique em um bloco para ver detalhes ou editar. Marque a caixa quando concluir um conteúdo.';
    renderWeekView();
  } else if (viewMode === 'month') {
    eyebrow.textContent = 'Visão mensal';
    title.textContent = 'Seu mês em uma única tela';
    description.textContent = 'Cada dia mostra quantidade de conteúdos e progresso. Clique em uma data para abrir a semana correspondente.';
    renderMonthView();
  } else {
    eyebrow.textContent = 'Visão anual';
    title.textContent = 'O ano inteiro, sem perder o contexto';
    description.textContent = 'Veja o progresso de cada mês e clique em um deles para abrir a visão mensal.';
    renderYearView();
  }

  updateStats();
  updateQuickStart();
}

function toggleStudied(dateKey, index, studied) {
  setBlock(dateKey, index, { studied });
  renderCalendar();
}

function updateStats() {
  const blocks = getCurrentPeriodBlocks();
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
  const period = viewMode === 'day' ? 'dia' : viewMode === 'week' ? 'semana' : viewMode === 'month' ? 'mês' : 'ano';

  $('stat-filled').textContent = String(filled.length);
  $('stat-studied').textContent = `${studied.length}/${filled.length}`;
  $('stat-top-subject').textContent = topId ? getSubject(topId)?.label || 'Nenhuma' : 'Nenhuma';
  $('stat-progress-pct').textContent = `${pct}%`;
  $('stat-progress-fill').style.width = `${pct}%`;
  $('stat-period-copy').textContent = `conteúdos neste ${period}`;
  $('stat-subject-copy').textContent = `no ${period} selecionado`;
  $('progress-message').textContent = filled.length
    ? (pct === 100 ? `${period.charAt(0).toUpperCase() + period.slice(1)} concluído. Excelente consistência.` : `${filled.length - studied.length} conteúdo(s) ainda faltam.`)
    : `Nenhum conteúdo planejado neste ${period}.`;
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
  $('details-subject').textContent = subject?.label || 'Sem matéria';
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

function writeWeek(semana, weekStart) {
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
}

function applyWeek(semana) {
  writeWeek(semana, getWeekStart(weekOffset));
  saveData();
  renderCalendar();
}

function planFileName(number) {
  return `semana-${String(number).padStart(2, '0')}.json`;
}

function resetPlanSubjectSelection() {
  selectedPlanSubjects = new Set(SUBJECTS.map(subject => subject.id));
  renderPlanSubjectSelector();
}

function setAllPlanSubjects(selected) {
  selectedPlanSubjects = selected
    ? new Set(SUBJECTS.map(subject => subject.id))
    : new Set();
  renderPlanSubjectSelector();
  updatePlanImportSummary();
}

function renderPlanSubjectSelector() {
  const grid = $('plan-subjects-grid');
  if (!grid) return;

  grid.innerHTML = SUBJECTS.map(subject => {
    const selected = selectedPlanSubjects.has(subject.id);
    return `
      <button
        class="plan-subject-toggle${selected ? ' selected' : ''}"
        type="button"
        data-plan-subject="${subject.id}"
        aria-pressed="${selected}"
        style="--subject-color:${subject.color}"
      >
        <span class="plan-subject-toggle__dot"></span>
        <span>${escapeHtml(subject.label)}</span>
        <span class="plan-subject-toggle__state" aria-hidden="true">${selected ? '✓' : '+'}</span>
      </button>
    `;
  }).join('');

  grid.querySelectorAll('[data-plan-subject]').forEach(button => {
    button.addEventListener('click', () => {
      const id = button.dataset.planSubject;
      if (selectedPlanSubjects.has(id)) selectedPlanSubjects.delete(id);
      else selectedPlanSubjects.add(id);
      renderPlanSubjectSelector();
      updatePlanImportSummary();
    });
  });

  const count = selectedPlanSubjects.size;
  const countEl = $('plan-subjects-count');
  if (countEl) {
    countEl.textContent = count === SUBJECTS.length
      ? 'Todas as matérias selecionadas'
      : count === 0
        ? 'Nenhuma matéria selecionada'
        : `${count} de ${SUBJECTS.length} matérias selecionadas`;
  }
}

function getSelectedPlanSubjectIds() {
  return new Set(selectedPlanSubjects);
}

function organizeFilteredWeek(semana, selectedIds) {
  if (selectedIds.size === SUBJECTS.length) return semana;

  const contents = [];
  DAY_KEYS_ORDER.forEach(dayKey => {
    (semana[dayKey] || []).forEach(block => {
      const subjectId = resolveSubjectId(block.materia);
      if (!subjectId || !selectedIds.has(subjectId)) return;
      contents.push({
        materia: block.materia || '',
        titulo: block.titulo || '',
        descricao: block.descricao || '',
        detalhes: block.detalhes || '',
        duracao: block.duracao || '',
        prioridade: block.prioridade || ''
      });
    });
  });

  return distribute(contents).semana;
}

function populatePlanSelect() {
  const select = $('plan-select');
  if (select.options.length) return;
  select.innerHTML = AVAILABLE_PLANS.map(plan => `<option value="${plan.id}">${plan.title}</option>`).join('');
}

function updatePlanWeekOptions(preferredWeek = null) {
  const plan = AVAILABLE_PLANS.find(item => item.id === $('plan-select').value) || AVAILABLE_PLANS[0];
  const select = $('plan-week-start');
  const previous = Number(preferredWeek ?? select.value ?? 1);
  const selected = Math.min(Math.max(previous || 1, 1), plan.total);

  select.innerHTML = Array.from({ length: plan.total }, (_, index) => {
    const week = index + 1;
    return `<option value="${week}" ${week === selected ? 'selected' : ''}>Semana ${week}</option>`;
  }).join('');
}

function getSelectedPlanStartWeek() {
  const plan = AVAILABLE_PLANS.find(item => item.id === $('plan-select').value) || AVAILABLE_PLANS[0];
  const value = Number($('plan-week-start').value) || 1;
  return Math.min(Math.max(value, 1), plan.total);
}

function getPlanStartDate() {
  const raw = $('plan-start-date').value;
  const base = raw ? new Date(`${raw}T12:00:00`) : getWeekStart(weekOffset);
  return getWeekStartForDate(base);
}

function updatePlanImportSummary() {
  populatePlanSelect();
  updatePlanWeekOptions();

  const plan = AVAILABLE_PLANS.find(item => item.id === $('plan-select').value) || AVAILABLE_PLANS[0];
  const firstWeek = getSelectedPlanStartWeek();
  const weeksToImport = plan.total - firstWeek + 1;
  const start = getPlanStartDate();
  const end = new Date(start);
  end.setDate(end.getDate() + weeksToImport * 7 - 1);

  $('plan-start-label').textContent = firstWeek === 1
    ? `${plan.title}, desde a Semana 1`
    : `${plan.title}, começando pela Semana ${firstWeek}`;

  $('plan-range-label').textContent = `No calendário: ${start.toLocaleDateString('pt-BR')} a ${end.toLocaleDateString('pt-BR')}.`;

  const selectedCount = selectedPlanSubjects.size;
  const subjectsText = selectedCount === SUBJECTS.length
    ? ' Todas as matérias estão incluídas.'
    : selectedCount === 0
      ? ' Escolha pelo menos uma matéria para continuar.'
      : ` ${selectedCount} de ${SUBJECTS.length} matérias estão incluídas.`;

  $('plan-import-count').textContent = (firstWeek === 1
    ? `As ${plan.total} semanas do plano serão importadas.`
    : `Serão importadas ${weeksToImport} semanas, da Semana ${firstWeek} até a Semana ${plan.total}.`) + subjectsText;

  $('plan-run').disabled = selectedCount === 0;
  $('plan-run').textContent = selectedCount === 0
    ? 'Escolha uma matéria'
    : firstWeek === 1
      ? 'Importar plano completo'
      : `Importar ${weeksToImport} semanas`;
}

function openPlanImport(planId = null, startWeek = 1) {
  populatePlanSelect();
  if (planId && AVAILABLE_PLANS.some(plan => plan.id === String(planId))) $('plan-select').value = String(planId);
  updatePlanWeekOptions(startWeek);
  resetPlanSubjectSelection();

  const anchor = viewMode === 'week' ? getWeekStart(weekOffset) : getCurrentAnchorDate();
  $('plan-start-date').value = toDateKey(anchor);
  $('plan-import-status').hidden = true;
  $('plan-run').disabled = false;
  updatePlanImportSummary();
  openOverlay('plan-overlay');
}

function closePlanImport() {
  closeOverlay('plan-overlay');
}

function countExistingInPlanRange(start, totalWeeks) {
  const end = new Date(start);
  end.setDate(end.getDate() + totalWeeks * 7);
  return getRangeBlocks(start, end).filter(block => block.subject).length;
}

async function importFullPlan() {
  const plan = AVAILABLE_PLANS.find(item => item.id === $('plan-select').value);
  if (!plan) return;

  const firstWeek = getSelectedPlanStartWeek();
  const weeksToImport = plan.total - firstWeek + 1;
  const selectedSubjects = getSelectedPlanSubjectIds();

  if (!selectedSubjects.size) {
    $('plan-import-status').hidden = false;
    $('plan-import-status').textContent = 'Escolha pelo menos uma matéria para montar o cronograma.';
    return;
  }

  const start = getPlanStartDate();
  const existing = countExistingInPlanRange(start, weeksToImport);

  if (existing && !window.confirm(`Já existem ${existing} conteúdos nesse período. Deseja substituir e continuar?`)) return;

  const status = $('plan-import-status');
  const run = $('plan-run');
  status.hidden = false;
  status.textContent = firstWeek === 1
    ? `Carregando ${weeksToImport} semanas...`
    : `Carregando da Semana ${firstWeek} até a Semana ${plan.total}...`;
  run.disabled = true;
  run.textContent = 'Importando...';

  try {
    const weekNumbers = Array.from({ length: weeksToImport }, (_, index) => firstWeek + index);

    const weeks = await Promise.all(weekNumbers.map(async week => {
      const response = await fetch(`${plan.folder}/${planFileName(week)}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`A Semana ${week} não está disponível.`);
      const parsed = await response.json();
      const error = validateWeekJSON(parsed);
      if (error) throw new Error(`Semana ${week}: ${error}`);
      return {
        week,
        semana: organizeFilteredWeek(parsed.semana, selectedSubjects)
      };
    }));

    weeks.forEach(({ semana }, index) => {
      const weekStart = new Date(start);
      weekStart.setDate(weekStart.getDate() + index * 7);
      writeWeek(semana, weekStart);
    });

    saveData();
    closePlanImport();

    const customized = selectedSubjects.size !== SUBJECTS.length;
    const successMessage = firstWeek === 1
      ? customized
        ? `${plan.title} personalizado e importado com sucesso.`
        : `${plan.title} importado com sucesso.`
      : customized
        ? `Semana ${firstWeek} até Semana ${plan.total} importadas com as matérias escolhidas.`
        : `Semana ${firstWeek} até Semana ${plan.total} importadas com sucesso.`;

    showToast(successMessage, 'success');
    setViewMode('week', start);
  } catch (error) {
    status.hidden = false;
    status.textContent = error.message || 'Não foi possível importar o plano.';
    run.disabled = false;
    updatePlanImportSummary();
  }
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
  link.download = `planner_${toDateKey(weekStart)}.json`;
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
  $('btn-prev').addEventListener('click', () => shiftCurrentPeriod(-1));
  $('btn-next').addEventListener('click', () => shiftCurrentPeriod(1));

  document.querySelectorAll('[data-view]').forEach(button => {
    button.addEventListener('click', () => setViewMode(button.dataset.view, new Date()));
  });

  $('intro-collapse')?.addEventListener('click', () => setIntroCollapsed(true));
  $('intro-restore')?.addEventListener('click', () => setIntroCollapsed(false));

  [$('btn-import'), $('hint-import'), $('section-import')].forEach(btn => btn?.addEventListener('click', triggerImport));
  [$('btn-full-plan'), $('quick-full-plan'), $('section-full-plan'), $('help-full-plan')].forEach(btn => btn?.addEventListener('click', () => openPlanImport()));
  $('file-input').addEventListener('change', () => importJSON($('file-input').files[0]));

  $('btn-help').addEventListener('click', () => openHelp(true));
  $('help-close').addEventListener('click', closeHelp);

  $('plan-close').addEventListener('click', closePlanImport);
  $('plan-cancel').addEventListener('click', closePlanImport);
  $('plan-select').addEventListener('change', () => {
    updatePlanWeekOptions(1);
    updatePlanImportSummary();
  });
  $('plan-week-start').addEventListener('change', updatePlanImportSummary);
  $('plan-start-date').addEventListener('change', updatePlanImportSummary);
  $('plan-subjects-all').addEventListener('click', () => setAllPlanSubjects(true));
  $('plan-subjects-none').addEventListener('click', () => setAllPlanSubjects(false));
  $('plan-run').addEventListener('click', importFullPlan);

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
  const fullPlanId = params.get('plan');
  const fullPlanStartWeek = Number(params.get('startWeek')) || 1;
  const shouldImportPlan = params.get('full') === '1' && fullPlanId;
  if (shouldImport) {
    $('import-hint').hidden = false;
    $('btn-import').classList.add('pulse-import');
    setTimeout(() => $('btn-import').classList.remove('pulse-import'), 3000);
  }

  if (shouldImportPlan) setTimeout(() => openPlanImport(fullPlanId, fullPlanStartWeek), 120);

  const hasAnyData = Object.values(data).some(day => Array.isArray(day) && day.some(block => block?.subject));
  if (!localStorage.getItem(TUTORIAL_KEY) && !hasAnyData && !shouldImport && !shouldImportPlan) {
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