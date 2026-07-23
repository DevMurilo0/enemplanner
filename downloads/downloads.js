// Gera os cards de download para o plano de 14 semanas.
// Basta colocar os arquivos JSON em: downloads/planos/14-semanas/semana-01.json ... semana-14.json
// que o card correspondente vira "disponível" automaticamente.

const TOTAL_SEMANAS_14 = 14;
const PASTA_14 = "planos/14-semanas";

function nomeArquivo(numero) {
  return `semana-${String(numero).padStart(2, "0")}.json`;
}

async function arquivoExiste(url) {
  try {
    const res = await fetch(url, { method: "HEAD", cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

function criarCard(numero, disponivel, url) {
  const card = document.createElement("div");
  card.className = "dl-card";

  const titulo = document.createElement("span");
  titulo.className = "dl-card-title";
  titulo.textContent = `Semana ${String(numero).padStart(2, "0")}`;

  const status = document.createElement("span");
  status.className = `dl-card-status ${disponivel ? "dl-card-status--ok" : "dl-card-status--missing"}`;
  status.textContent = disponivel ? "Disponível" : "Em breve";

  const btn = document.createElement("a");
  btn.className = `dl-card-btn ${disponivel ? "dl-card-btn--ok" : "dl-card-btn--disabled"}`;
  btn.textContent = "Baixar JSON";
  if (disponivel) {
    btn.href = url;
    btn.setAttribute("download", nomeArquivo(numero));
  } else {
    btn.href = "#";
    btn.setAttribute("aria-disabled", "true");
  }

  card.append(titulo, status, btn);
  return card;
}

let jaCarregou14 = false;

async function montarGrade14() {
  const grid = document.getElementById("grid-14");
  const contador = document.getElementById("count-14");
  let disponiveis = 0;

  for (let i = 1; i <= TOTAL_SEMANAS_14; i++) {
    const url = `${PASTA_14}/${nomeArquivo(i)}`;
    const existe = await arquivoExiste(url);
    if (existe) disponiveis++;
    grid.appendChild(criarCard(i, existe, url));
  }

  contador.textContent = `${disponiveis}/${TOTAL_SEMANAS_14} disponíveis`;
}

function configurarAccordion() {
  const toggle = document.getElementById("toggle-14");
  const grid = document.getElementById("grid-14");

  toggle.addEventListener("click", async () => {
    const abrindo = grid.hasAttribute("hidden");

    if (abrindo && !jaCarregou14) {
      jaCarregou14 = true;
      await montarGrade14();
    }

    grid.toggleAttribute("hidden", !abrindo);
    toggle.setAttribute("aria-expanded", String(abrindo));
  });
}

configurarAccordion();
