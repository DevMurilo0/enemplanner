const PLANS = [
  { id: '9', total: 9, folder: 'planos/9-semanas', title: '9 semanas', description: 'Cronograma inédito de 9 semanas.' },
  { id: '14', total: 14, folder: 'planos/14-semanas', title: '14 semanas', description: 'Cronograma inédito de 14 semanas.' },
  { id: '18', total: 18, folder: 'planos/18-semanas', title: '18 semanas', description: 'Cronograma inédito de 18 semanas.' },
  { id: '22', total: 22, folder: 'planos/22-semanas', title: '22 semanas', description: 'Cronograma inédito de 22 semanas.' },
  { id: '27', total: 27, folder: 'planos/27-semanas', title: '27 semanas', description: 'Cronograma inédito de 27 semanas.' },
  { id: '30', total: 30, folder: 'planos/30-semanas', title: '30 semanas', description: 'Cronograma inédito de 30 semanas.' },
  { id: '35', total: 35, folder: 'planos/35-semanas', title: '35 semanas', description: 'Cronograma completo de 35 semanas.' }
];

const PLAN_CACHE = new Map();
let explorerPlan = null;
let explorerWeeks = [];
let explorerSubject = 'all';

function fileName(number) {
  return `semana-${String(number).padStart(2, '0')}.json`;
}

function normalize(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function weekLabel(number) {
  return `Semana ${String(number).padStart(2, '0')}`;
}

function flattenWeek(week, semana) {
  const items = [];
  Object.values(semana || {}).forEach(day => {
    (day || []).forEach(block => {
      const title = (block.titulo || block.descricao || '').trim();
      if (!block.materia || !title) return;
      items.push({
        week,
        materia: block.materia.trim(),
        cor: block.cor || '#8a8a84',
        titulo: title,
        descricao: (block.descricao || '').trim(),
        detalhes: (block.detalhes || '').trim()
      });
    });
  });
  return items;
}

async function loadPlan(plan) {
  if (PLAN_CACHE.has(plan.id)) return PLAN_CACHE.get(plan.id);

  const promise = Promise.all(Array.from({ length: plan.total }, async (_, index) => {
    const week = index + 1;
    const response = await fetch(`${plan.folder}/${fileName(week)}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${weekLabel(week)} não está disponível.`);
    const parsed = await response.json();
    const items = flattenWeek(week, parsed.semana);
    return { week, semana: parsed.semana, items };
  }));

  PLAN_CACHE.set(plan.id, promise);
  try {
    return await promise;
  } catch (error) {
    PLAN_CACHE.delete(plan.id);
    throw error;
  }
}

function getSubjects(weeks) {
  const map = new Map();
  weeks.flatMap(entry => entry.items).forEach(item => {
    const key = normalize(item.materia);
    if (!map.has(key)) map.set(key, { id: key, label: item.materia, color: item.cor, count: 0 });
    map.get(key).count++;
  });
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
}

function uniqueSubjectPreview(items, limit = 4) {
  const seen = new Map();
  items.forEach(item => {
    const key = normalize(item.materia);
    if (!seen.has(key)) seen.set(key, { label: item.materia, color: item.cor });
  });
  const all = [...seen.values()];
  return {
    visible: all.slice(0, limit),
    remaining: Math.max(0, all.length - limit),
    total: all.length
  };
}

function makeWeekCard(plan, entry) {
  const card = document.createElement('article');
  card.className = 'week-card';
  const subjects = uniqueSubjectPreview(entry.items);
  const previews = entry.items.slice(0, 3);

  card.innerHTML = `
    <div class="week-card__head">
      <div>
        <span class="week-card__eyebrow">${weekLabel(entry.week)}</span>
        <strong>${entry.items.length} conteúdos</strong>
      </div>
      <button class="week-card__open" type="button">Ver semana</button>
    </div>

    <div class="week-card__subjects">
      ${subjects.visible.map(subject => `<span><i style="background:${subject.color}"></i>${escapeHtml(subject.label)}</span>`).join('')}
      ${subjects.remaining ? `<span class="week-card__more">+${subjects.remaining}</span>` : ''}
    </div>

    <div class="week-card__preview">
      ${previews.map(item => `<p><i style="background:${item.cor}"></i><span>${escapeHtml(item.titulo)}</span></p>`).join('')}
    </div>

    <div class="week-card__foot">
      <span>${subjects.total} matéria${subjects.total === 1 ? '' : 's'}</span>
      <span>Prévia da semana</span>
    </div>
  `;

  card.querySelector('.week-card__open').addEventListener('click', () => openExplorer(plan, entry.week));
  return card;
}

async function populatePlan(plan, body, meta) {
  if (body.dataset.loaded === 'true') return;
  body.dataset.loaded = 'true';
  const grid = body.querySelector('.weeks-grid');
  grid.innerHTML = '<div class="plan-loading">Carregando semanas...</div>';

  try {
    const weeks = await loadPlan(plan);
    const allItems = weeks.flatMap(entry => entry.items);
    const subjects = getSubjects(weeks);
    grid.innerHTML = '';
    weeks.forEach(entry => grid.appendChild(makeWeekCard(plan, entry)));
    meta.textContent = `${plan.total} semanas · ${allItems.length} conteúdos · ${subjects.length} matérias`;
  } catch (error) {
    grid.innerHTML = `<div class="plan-error">${escapeHtml(error.message || 'Não foi possível carregar este plano.')}</div>`;
    meta.textContent = 'erro ao carregar';
  }
}

function renderPlans() {
  const root = document.getElementById('plans');

  PLANS.forEach((plan, index) => {
    const section = document.createElement('section');
    section.className = 'plan';
    section.innerHTML = `
      <button class="plan__toggle" type="button" aria-expanded="${index === 0 ? 'true' : 'false'}">
        <div class="plan__title">
          <span class="plan__arrow">›</span>
          <div>
            <strong>${plan.title}</strong>
            <small>${plan.description}</small>
          </div>
        </div>
        <span class="plan__meta">carregando...</span>
      </button>

      <div class="plan__body" ${index === 0 ? '' : 'hidden'}>
        <div class="plan__actions">
          <div>
            <strong>Veja o plano antes de importar</strong>
            <p>Pesquise em todas as semanas ou abra uma semana específica logo abaixo.</p>
          </div>
          <div class="plan__action-buttons">
            <button class="button button--secondary plan-explore" type="button">Explorar plano</button>
            <a class="button button--primary" href="../?plan=${plan.id}&full=1">Importar plano</a>
          </div>
        </div>
        <div class="weeks-grid"></div>
      </div>
    `;

    const toggle = section.querySelector('.plan__toggle');
    const body = section.querySelector('.plan__body');
    const meta = section.querySelector('.plan__meta');
    const explore = section.querySelector('.plan-explore');

    toggle.addEventListener('click', async () => {
      const opening = body.hidden;
      body.hidden = !opening;
      toggle.setAttribute('aria-expanded', String(opening));
      if (opening) await populatePlan(plan, body, meta);
    });

    explore.addEventListener('click', () => openExplorer(plan, 'all'));

    root.appendChild(section);
    if (index === 0) populatePlan(plan, body, meta);
  });
}

function setExplorerScopeOptions(plan, selectedScope) {
  const select = document.getElementById('explorer-scope');
  select.innerHTML = `
    <option value="all">Plano inteiro</option>
    ${Array.from({ length: plan.total }, (_, index) => {
      const week = index + 1;
      return `<option value="${week}">${weekLabel(week)}</option>`;
    }).join('')}
  `;
  select.value = String(selectedScope);
}

function renderSubjectFilters() {
  const root = document.getElementById('subject-filters');
  const subjects = getSubjects(explorerWeeks);
  const allCount = explorerWeeks.flatMap(entry => entry.items).length;

  root.innerHTML = `
    <button class="subject-filter ${explorerSubject === 'all' ? 'active' : ''}" type="button" data-subject="all">
      Todas <span>${allCount}</span>
    </button>
    ${subjects.map(subject => `
      <button class="subject-filter ${explorerSubject === subject.id ? 'active' : ''}" type="button" data-subject="${escapeHtml(subject.id)}" style="--subject-color:${subject.color}">
        <i></i>${escapeHtml(subject.label)} <span>${subject.count}</span>
      </button>
    `).join('')}
  `;

  root.querySelectorAll('[data-subject]').forEach(button => {
    button.addEventListener('click', () => {
      explorerSubject = button.dataset.subject;
      renderSubjectFilters();
      renderExplorerResults();
    });
  });
}

function getFilteredItems() {
  const scope = document.getElementById('explorer-scope').value;
  const query = normalize(document.getElementById('explorer-search').value);

  return explorerWeeks
    .filter(entry => scope === 'all' || String(entry.week) === scope)
    .map(entry => {
      const items = entry.items.filter(item => {
        const subjectMatch = explorerSubject === 'all' || normalize(item.materia) === explorerSubject;
        if (!subjectMatch) return false;
        if (!query) return true;
        return normalize([item.materia, item.titulo, item.descricao, item.detalhes].join(' ')).includes(query);
      });
      return { ...entry, items };
    })
    .filter(entry => entry.items.length);
}

function renderExplorerResults() {
  const root = document.getElementById('explorer-body');
  const filteredWeeks = getFilteredItems();
  const resultCount = filteredWeeks.reduce((sum, entry) => sum + entry.items.length, 0);
  const scope = document.getElementById('explorer-scope').value;
  const activeSubject = explorerSubject === 'all'
    ? 'Todas as matérias'
    : getSubjects(explorerWeeks).find(subject => subject.id === explorerSubject)?.label || 'Matéria';

  document.getElementById('explorer-result-count').textContent = `${resultCount} conteúdo${resultCount === 1 ? '' : 's'}`;
  document.getElementById('explorer-active-filter').textContent = scope === 'all'
    ? activeSubject
    : `${weekLabel(Number(scope))} · ${activeSubject}`;

  if (!resultCount) {
    root.innerHTML = `
      <div class="empty-results">
        <strong>Nenhum conteúdo encontrado</strong>
        <p>Tente outra busca, outra matéria ou volte para “Todas”.</p>
      </div>
    `;
    return;
  }

  root.innerHTML = filteredWeeks.map(entry => {
    const grouped = new Map();
    entry.items.forEach(item => {
      const key = normalize(item.materia);
      if (!grouped.has(key)) grouped.set(key, { label: item.materia, color: item.cor, items: [] });
      grouped.get(key).items.push(item);
    });

    return `
      <section class="explorer-week">
        <header class="explorer-week__header">
          <div>
            <span>${weekLabel(entry.week)}</span>
            <strong>${entry.items.length} conteúdo${entry.items.length === 1 ? '' : 's'}</strong>
          </div>
        </header>

        <div class="explorer-subjects">
          ${[...grouped.values()].map(group => `
            <section class="subject-group" style="--subject-color:${group.color}">
              <header class="subject-group__header">
                <span class="subject-group__dot"></span>
                <strong>${escapeHtml(group.label)}</strong>
                <span>${group.items.length}</span>
              </header>
              <div class="subject-group__items">
                ${group.items.map(item => {
                  const extra = item.detalhes || (item.descricao !== item.titulo ? item.descricao : '');
                  return `
                    <article class="content-item">
                      <span class="content-item__line"></span>
                      <div>
                        <strong>${escapeHtml(item.titulo)}</strong>
                        ${extra ? `<p>${escapeHtml(extra)}</p>` : ''}
                      </div>
                    </article>
                  `;
                }).join('')}
              </div>
            </section>
          `).join('')}
        </div>
      </section>
    `;
  }).join('');
}

async function openExplorer(plan, scope = 'all') {
  const overlay = document.getElementById('explorer-overlay');
  explorerPlan = plan;
  explorerSubject = 'all';

  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');

  document.getElementById('explorer-title').textContent = `Plano de ${plan.title}`;
  document.getElementById('explorer-subtitle').textContent = 'Carregando conteúdos do cronograma...';
  document.getElementById('explorer-import').href = `../?plan=${plan.id}&full=1`;
  document.getElementById('explorer-search').value = '';
  document.getElementById('explorer-body').innerHTML = '<div class="explorer-loading">Carregando conteúdo...</div>';
  document.getElementById('subject-filters').innerHTML = '';

  setExplorerScopeOptions(plan, scope);

  try {
    explorerWeeks = await loadPlan(plan);
    const totalItems = explorerWeeks.flatMap(entry => entry.items).length;
    const subjects = getSubjects(explorerWeeks);
    document.getElementById('explorer-subtitle').textContent =
      `${plan.total} semanas · ${totalItems} conteúdos · ${subjects.length} matérias`;
    renderSubjectFilters();
    renderExplorerResults();
    setTimeout(() => document.getElementById('explorer-search').focus(), 80);
  } catch (error) {
    document.getElementById('explorer-body').innerHTML =
      `<div class="plan-error">${escapeHtml(error.message || 'Não foi possível abrir o plano.')}</div>`;
  }
}

function closeExplorer() {
  const overlay = document.getElementById('explorer-overlay');
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}

document.addEventListener('DOMContentLoaded', () => {
  renderPlans();

  document.getElementById('explorer-close').addEventListener('click', closeExplorer);
  document.getElementById('explorer-overlay').addEventListener('click', event => {
    if (event.target.id === 'explorer-overlay') closeExplorer();
  });
  document.getElementById('explorer-search').addEventListener('input', renderExplorerResults);
  document.getElementById('explorer-scope').addEventListener('change', renderExplorerResults);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeExplorer();
  });
});