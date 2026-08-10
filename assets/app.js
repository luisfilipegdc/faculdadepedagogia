// Caderno de Pedagogia — leitor estático. Zero dependências.

const principal = document.getElementById("principal");
const busca = document.getElementById("busca");
const rodapeInfo = document.getElementById("rodape-info");

let INDICE = null;
const cacheAulas = new Map();

/* ---------------- utilidades ---------------- */

const escapar = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

// markdown inline: **negrito**, *itálico*, `código`, [texto](url)
function inline(txt) {
  return escapar(txt)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" rel="noopener">$1</a>');
}

const semAcento = (s) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const slug = (s) =>
  semAcento(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const guardar = (chave, valor) => {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {}
};
const ler = (chave, padrao) => {
  try {
    const v = localStorage.getItem(chave);
    return v === null ? padrao : JSON.parse(v);
  } catch {
    return padrao;
  }
};

function dataBonita(iso) {
  if (!iso) return "";
  const [a, m, d] = iso.split("-");
  if (!d) return iso;
  return `${d}/${m}/${a}`;
}

/* ---------------- parsing do markdown de aula ---------------- */

function parseFrontmatter(texto) {
  const m = texto.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { meta: {}, corpo: texto };
  const meta = {};
  for (const linha of m[1].split(/\r?\n/)) {
    const par = linha.match(/^([A-Za-zÀ-ÿ_][\w\-À-ÿ]*)\s*:\s*(.*)$/);
    if (!par) continue;
    let valor = par[2].trim();
    if (valor.startsWith("[") && valor.endsWith("]")) {
      valor = valor
        .slice(1, -1)
        .split(",")
        .map((v) => v.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else {
      valor = valor.replace(/^["']|["']$/g, "");
    }
    meta[par[1].trim()] = valor;
  }
  return { meta, corpo: texto.slice(m[0].length) };
}

function fatiarSecoes(corpo) {
  const mapa = new Map();
  for (const parte of corpo.split(/^##\s+/m).slice(1)) {
    const q = parte.indexOf("\n");
    const titulo = (q === -1 ? parte : parte.slice(0, q)).trim();
    mapa.set(semAcento(titulo), {
      titulo,
      corpo: q === -1 ? "" : parte.slice(q + 1).trim(),
    });
  }
  return mapa;
}

// lista com indentação -> árvore
function arvore(bloco) {
  const raiz = [];
  const pilha = [{ nivel: -1, filhos: raiz }];
  for (const linha of bloco.split(/\r?\n/)) {
    const m = linha.match(/^(\s*)-\s+(.*)$/);
    if (!m) continue;
    const nivel = Math.floor(m[1].replace(/\t/g, "  ").length / 2);
    const no = { texto: m[2].trim(), filhos: [] };
    while (pilha.length && pilha[pilha.length - 1].nivel >= nivel) pilha.pop();
    (pilha[pilha.length - 1]?.filhos || raiz).push(no);
    pilha.push({ nivel, filhos: no.filhos });
  }
  return raiz;
}

function itens(bloco) {
  return bloco
    .split(/\r?\n/)
    .map((l) => l.match(/^\s*(?:-|\d+\.)\s+(.*)$/))
    .filter(Boolean)
    .map((m) => m[1].trim())
    .filter(Boolean);
}

function pares(bloco) {
  return itens(bloco)
    .map((linha) => {
      const i = linha.indexOf("::");
      if (i === -1) return { frente: linha, verso: "" };
      return {
        frente: linha.slice(0, i).trim(),
        verso: linha.slice(i + 2).trim(),
      };
    })
    .filter((p) => p.frente);
}

function paragrafos(bloco) {
  return bloco
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/* ---------------- renderização ---------------- */

function renderMapa(nos) {
  if (!nos.length) return "";
  return `<ul class="mapa">${nos
    .map((n) => `<li>${inline(n.texto)}${renderMapa(n.filhos)}</li>`)
    .join("")}</ul>`;
}

function renderAula(aula, texto) {
  const { meta, corpo } = parseFrontmatter(texto);
  const sec = fatiarSecoes(corpo);
  const pegar = (nome) => sec.get(semAcento(nome));
  const partes = [];

  partes.push(`
    <p class="migalha"><a href="#/">Caderno</a> › ${escapar(aula.disciplina)}</p>
    <h1>${escapar(meta.tema || aula.tema)}</h1>
    <div class="meta">
      ${meta.professor ? `<span>Prof.ª ${escapar(meta.professor)}</span>` : ""}
      ${meta.data ? `<span>${dataBonita(meta.data)}</span>` : ""}
      <span>${aula.minutosLeitura} min de leitura</span>
      ${meta.fonte ? `<span class="selo">${escapar(meta.fonte)}</span>` : ""}
      ${(Array.isArray(meta.tags) ? meta.tags : []).map((t) => `<span class="selo selo-acento">${escapar(t)}</span>`).join("")}
    </div>
  `);

  const conf = (meta.confianca || "alta").toLowerCase();
  if (conf === "baixa" || conf === "media") {
    partes.push(`<div class="aviso"><span aria-hidden="true">⚠</span><span>
      Estas anotações vieram de uma transcrição de áudio de sala${conf === "baixa" ? " com qualidade ruim" : ""}.
      Nomes próprios e termos técnicos podem estar imprecisos — confira a seção <b>Pendências</b> antes de estudar para prova.
    </span></div>`);
  }

  const resumo = pegar("Resumo");
  if (resumo) {
    partes.push(`<section class="secao"><h2>Resumo</h2>
      ${paragrafos(resumo.corpo).map((p) => `<p>${inline(p)}</p>`).join("")}
    </section>`);
  }

  const conceitos = pegar("Conceitos");
  if (conceitos) {
    partes.push(`<section class="secao"><h2>Conceitos</h2>
      <ul class="lista-conceitos">${pares(conceitos.corpo)
        .map(
          (c) =>
            `<li><b>${inline(c.frente)}</b>${c.verso ? inline(c.verso) : ""}</li>`,
        )
        .join("")}</ul>
    </section>`);
  }

  const mapa = pegar("Mapa");
  if (mapa) {
    partes.push(
      `<section class="secao"><h2>Mapa conceitual</h2>${renderMapa(arvore(mapa.corpo))}</section>`,
    );
  }

  const flash = pegar("Flashcards");
  const cards = flash ? pares(flash.corpo) : [];
  if (cards.length) {
    partes.push(`<section class="secao">
      <div class="flash-cabecalho">
        <h2 style="margin-bottom:0">Flashcards <span class="selo">${cards.length}</span></h2>
        <button class="btn" id="abrir-flash">Estudar em tela cheia (f)</button>
      </div>
      <div class="cartoes" style="margin-top:1rem">
        ${cards
          .map(
            (c) =>
              `<details class="cartao-flash"><summary>${inline(c.frente)}</summary><div class="resposta">${inline(c.verso)}</div></details>`,
          )
          .join("")}
      </div>
    </section>`);
  }

  const questoes = pegar("Questões");
  if (questoes) {
    partes.push(`<section class="secao"><h2>Questões de revisão</h2>
      <ol class="lista-questoes">${itens(questoes.corpo)
        .map((q) => `<li>${inline(q)}</li>`)
        .join("")}</ol>
    </section>`);
  }

  const leituras = pegar("Para ler");
  if (leituras) {
    partes.push(`<section class="secao"><h2>Para ler</h2>
      <ul class="lista-simples">${itens(leituras.corpo)
        .map((l) => `<li>${inline(l)}</li>`)
        .join("")}</ul>
    </section>`);
  }

  const pend = pegar("Pendências");
  if (pend) {
    partes.push(`<section class="secao"><h2>Pendências <span class="selo selo-alerta">conferir</span></h2>
      <ul class="lista-simples">${itens(pend.corpo)
        .map((p) => `<li>${inline(p)}</li>`)
        .join("")}</ul>
    </section>`);
  }

  principal.innerHTML = partes.join("");
  document.title = `${meta.tema || aula.tema} — Caderno de Pedagogia`;

  const botao = document.getElementById("abrir-flash");
  if (botao) botao.addEventListener("click", () => abrirFlash(cards));
  window.__cards = cards;
}

function renderInicio(filtro = "") {
  window.__cards = null;
  document.title = "Caderno de Pedagogia";
  const termo = semAcento(filtro.trim());
  const aulas = INDICE.aulas.filter((a) => {
    if (!termo) return true;
    return semAcento(
      [a.tema, a.disciplina, a.professor, ...(a.tags || [])].join(" "),
    ).includes(termo);
  });

  if (!aulas.length) {
    principal.innerHTML = `<p class="migalha">Caderno</p><h1>Nada encontrado</h1>
      <p class="vazio">Nenhuma aula bate com “${escapar(filtro)}”.</p>`;
    return;
  }

  const porDisciplina = new Map();
  for (const a of aulas) {
    if (!porDisciplina.has(a.disciplina)) porDisciplina.set(a.disciplina, []);
    porDisciplina.get(a.disciplina).push(a);
  }

  const blocos = [...porDisciplina.entries()]
    .sort((x, y) => x[0].localeCompare(y[0], "pt-BR"))
    .map(
      ([disc, lista]) => `
      <section class="disciplina-bloco">
        <h2 class="disciplina-titulo" style="margin-top:0">${escapar(disc)} · ${lista.length} aula${lista.length > 1 ? "s" : ""}</h2>
        ${lista
          .map(
            (a) => `
          <a class="cartao" href="#/aula/${encodeURIComponent(a.arquivo)}">
            <div class="cartao-tema">${escapar(a.tema)}</div>
            <div class="cartao-meta">
              ${a.data ? `<span>${dataBonita(a.data)}</span>` : ""}
              ${a.professor ? `<span>Prof.ª ${escapar(a.professor)}</span>` : ""}
              ${a.flashcards ? `<span>${a.flashcards} flashcards</span>` : ""}
              ${a.questoes ? `<span>${a.questoes} questões</span>` : ""}
              ${a.confianca !== "alta" ? `<span class="selo selo-alerta">revisar</span>` : ""}
              ${a.pendencias ? `<span class="selo selo-alerta">${a.pendencias} pendência${a.pendencias > 1 ? "s" : ""}</span>` : ""}
            </div>
          </a>`,
          )
          .join("")}
      </section>`,
    )
    .join("");

  principal.innerHTML = `
    <p class="migalha">Curso de Pedagogia</p>
    <h1>Caderno de estudos</h1>
    <div class="meta">
      <span>${INDICE.totalAulas} aula${INDICE.totalAulas > 1 ? "s" : ""}</span>
      <span>${INDICE.disciplinas.length} disciplina${INDICE.disciplinas.length > 1 ? "s" : ""}</span>
      <span>${INDICE.totalFlashcards} flashcards</span>
    </div>
    ${blocos}`;
}

/* ---------------- modo flashcard ---------------- */

const overlay = document.getElementById("flashmodo");
const elCard = document.getElementById("flash-card");
const elTexto = document.getElementById("flash-texto");
const elRotulo = elCard.querySelector(".flash-rotulo");
const elContador = document.getElementById("flash-contador");
const elProgresso = document.getElementById("flash-progresso");

let baralho = [];
let posicao = 0;
let virado = false;

function abrirFlash(cards) {
  if (!cards || !cards.length) return;
  baralho = cards.slice();
  posicao = 0;
  virado = false;
  overlay.hidden = false;
  mostrarCard();
}

function fecharFlash() {
  overlay.hidden = true;
}

function mostrarCard() {
  if (posicao >= baralho.length) {
    elRotulo.textContent = "fim";
    elTexto.textContent = "Baralho concluído. Boa!";
    elContador.textContent = `${baralho.length}/${baralho.length}`;
    elProgresso.style.width = "100%";
    return;
  }
  const c = baralho[posicao];
  elRotulo.textContent = virado ? "resposta" : "pergunta";
  elTexto.innerHTML = inline(virado ? c.verso || "—" : c.frente);
  elContador.textContent = `${posicao + 1}/${baralho.length}`;
  elProgresso.style.width = `${(posicao / baralho.length) * 100}%`;
}

function virar() {
  virado = !virado;
  mostrarCard();
}

function avancar(acertou) {
  const c = baralho[posicao];
  if (!acertou && c) baralho.push(c);
  posicao++;
  virado = false;
  mostrarCard();
}

elCard.addEventListener("click", virar);
document.getElementById("flash-sair").addEventListener("click", fecharFlash);
document.getElementById("flash-acertei").addEventListener("click", () => avancar(true));
document.getElementById("flash-errei").addEventListener("click", () => avancar(false));

/* ---------------- teclado ---------------- */

document.addEventListener("keydown", (e) => {
  const digitando =
    document.activeElement &&
    ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName);

  if (!overlay.hidden) {
    if (e.key === "Escape") return fecharFlash();
    if (e.key === " ") {
      e.preventDefault();
      return virar();
    }
    if (e.key === "ArrowRight") return avancar(true);
    if (e.key === "ArrowLeft") return avancar(false);
    return;
  }

  if (digitando) {
    if (e.key === "Escape") document.activeElement.blur();
    return;
  }

  if (e.key === "/") {
    e.preventDefault();
    busca.focus();
  }
  if (e.key === "f" && window.__cards) abrirFlash(window.__cards);
});

/* ---------------- tema ---------------- */

const btnTema = document.getElementById("tema");
function aplicarTema(t) {
  document.documentElement.dataset.tema = t;
  guardar("tema", t);
}
aplicarTema(
  ler(
    "tema",
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "escuro" : "claro",
  ),
);
btnTema.addEventListener("click", () =>
  aplicarTema(document.documentElement.dataset.tema === "escuro" ? "claro" : "escuro"),
);

/* ---------------- roteamento ---------------- */

async function rotear() {
  const hash = location.hash.replace(/^#/, "") || "/";
  if (hash.startsWith("/aula/")) {
    const arquivo = decodeURIComponent(hash.slice("/aula/".length));
    const aula = INDICE.aulas.find((a) => a.arquivo === arquivo);
    if (!aula) {
      principal.innerHTML = `<h1>Aula não encontrada</h1><p class="vazio"><a href="#/">Voltar ao caderno</a></p>`;
      return;
    }
    let texto = cacheAulas.get(arquivo);
    if (!texto) {
      const r = await fetch("/" + arquivo);
      texto = await r.text();
      cacheAulas.set(arquivo, texto);
    }
    renderAula(aula, texto);
    window.scrollTo(0, 0);
    return;
  }
  renderInicio(busca.value);
}

busca.addEventListener("input", () => {
  if (location.hash && location.hash !== "#/") location.hash = "#/";
  else renderInicio(busca.value);
});

window.addEventListener("hashchange", rotear);

(async function iniciar() {
  try {
    const r = await fetch("/conteudo/index.json", { cache: "no-store" });
    INDICE = await r.json();
  } catch {
    principal.innerHTML = `<h1>Índice não encontrado</h1>
      <p class="vazio">Rode <code>npm run indexar</code> para gerar <code>conteudo/index.json</code>.</p>`;
    return;
  }
  rodapeInfo.textContent = `${INDICE.totalAulas} aulas · atualizado em ${dataBonita((INDICE.gerado || "").slice(0, 10))}`;
  rotear();
})();
