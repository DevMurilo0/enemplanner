const PLANS = [
  { id: '9', total: 9, folder: 'planos/9-semanas', title: '9 semanas', description: 'Cronograma inédito de 9 semanas.' },
  { id: '14', total: 14, folder: 'planos/14-semanas', title: '14 semanas', description: 'Cronograma inédito de 14 semanas.' },
  { id: '18', total: 18, folder: 'planos/18-semanas', title: '18 semanas', description: 'Cronograma inédito de 18 semanas.' },
  { id: '22', total: 22, folder: 'planos/22-semanas', title: '22 semanas', description: 'Cronograma inédito de 22 semanas.' },
  { id: '27', total: 27, folder: 'planos/27-semanas', title: '27 semanas', description: 'Cronograma inédito de 27 semanas.' },
  { id: '30', total: 30, folder: 'planos/30-semanas', title: '30 semanas', description: 'Cronograma inédito de 30 semanas.' },
  { id: '35', total: 35, folder: 'planos/35-semanas', title: '35 semanas', description: 'Cronograma completo de 35 semanas.' }
];

function fileName(number) {
  return `semana-${String(number).padStart(2, '0')}.json`;
}

async function fileExists(url) {
  try {
    const response = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    return response.ok;
  } catch {
    return false;
  }
}

function showNext(plan, week) {
  const box = document.getElementById('download-next');
  document.getElementById('download-next-title').textContent = `${plan.title} · Semana ${String(week).padStart(2, '0')} baixada`;
  box.hidden = false;
  localStorage.setItem('planner_last_download', JSON.stringify({ plan: plan.title, week, at: Date.now() }));
}

function makeWeekCard(plan, week, available, url) {
  const card = document.createElement('article');
  card.className = 'week-card';
  card.innerHTML = `
    <div class="week-card__top">
      <strong>Semana ${String(week).padStart(2, '0')}</strong>
      <span class="status ${available ? 'ok' : ''}" aria-hidden="true"></span>
    </div>
    <p>${available ? 'Arquivo pronto para importar no planner.' : 'Esta semana ainda não foi adicionada.'}</p>
    <div class="week-card__actions">
      <a class="download-btn ${available ? 'ok' : 'missing'}" ${available ? `href="${url}" download="${fileName(week)}"` : 'href="#" aria-disabled="true"'}>${available ? 'Baixar JSON' : 'Em breve'}</a>
    </div>
  `;

  if (available) {
    card.querySelector('a').addEventListener('click', () => showNext(plan, week));
  }
  return card;
}

async function populatePlan(plan, body, count) {
  if (body.dataset.loaded === 'true') return;
  body.dataset.loaded = 'true';
  const grid = body.querySelector('.weeks-grid');
  let availableCount = 0;

  const checks = await Promise.all(Array.from({ length: plan.total }, async (_, index) => {
    const week = index + 1;
    const url = `${plan.folder}/${fileName(week)}`;
    const available = await fileExists(url);
    return { week, url, available };
  }));

  checks.forEach(item => {
    if (item.available) availableCount++;
    grid.appendChild(makeWeekCard(plan, item.week, item.available, item.url));
  });
  count.textContent = `${availableCount}/${plan.total} disponíveis`;
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
          <div><strong>${plan.title}</strong><small>${plan.description}</small></div>
        </div>
        <span class="plan__count">verificando…</span>
      </button>
      <div class="plan__body" ${index === 0 ? '' : 'hidden'}>
        <div class="weeks-grid"></div>
      </div>
    `;

    const toggle = section.querySelector('.plan__toggle');
    const body = section.querySelector('.plan__body');
    const count = section.querySelector('.plan__count');

    toggle.addEventListener('click', async () => {
      const opening = body.hidden;
      body.hidden = !opening;
      toggle.setAttribute('aria-expanded', String(opening));
      if (opening) await populatePlan(plan, body, count);
    });

    root.appendChild(section);
    if (index === 0) populatePlan(plan, body, count);
  });
}

document.addEventListener('DOMContentLoaded', renderPlans);