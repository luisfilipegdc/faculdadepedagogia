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

const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// "hoje" / "amanhã" / "em 3 dias" — data seca não diz nada a quem está com pressa
function quandoRelativo(iso) {
  const dias = Math.round(
    (Date.parse(iso + "T00:00:00") - Date.parse(hojeISO() + "T00:00:00")) / 86400000,
  );
  if (dias === 0) return "hoje";
  if (dias === 1) return "amanhã";
  if (dias < 0) return dataBonita(iso);
  if (dias < 7) return `em ${dias} dias`;
  return dataBonita(iso);
}

/* ---------------- estado de estudo (fica no navegador) ---------------- */

let ESTUDO = ler("estudo", {});

const doArquivo = (arquivo) => ESTUDO[arquivo] || {};

function salvarEstudo(arquivo, dados) {
  ESTUDO[arquivo] = { ...doArquivo(arquivo), ...dados };
  guardar("estudo", ESTUDO);
}

// cor própria por disciplina: triagem no olho, não na leitura
const MATIZES = [25, 152, 212, 282, 48, 334];
const matizDisciplina = (nome) => {
  const ordem = INDICE ? INDICE.ordemCor || INDICE.disciplinas : null;
  const i = ordem ? ordem.indexOf(nome) : -1;
  return MATIZES[(i < 0 ? 0 : i) % MATIZES.length];
};

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

// primeiro " — " que está fora de um par **negrito** (o título pode conter travessão)
function corteTravessao(txt) {
  let forte = false;
  for (let i = 0; i < txt.length; i++) {
    if (txt[i] === "*" && txt[i + 1] === "*") {
      forte = !forte;
      i++;
    } else if (!forte && txt.startsWith(" — ", i)) {
      return i;
    }
  }
  return -1;
}

// "1988 :: **Constituição Federal** — texto" -> marco com ano, título e detalhe
function renderLinhaTempo(marcos) {
  if (!marcos.length) return "";
  const itensHtml = marcos
    .map((m) => {
      const corte = corteTravessao(m.verso);
      const titulo = corte === -1 ? m.verso : m.verso.slice(0, corte);
      const detalhe = corte === -1 ? "" : m.verso.slice(corte + 3);
      return `<li class="lt-marco">
        <span class="lt-ano">${inline(m.frente)}</span>
        <div class="lt-corpo">
          <span class="lt-titulo">${inline(titulo)}</span>
          ${detalhe ? `<span class="lt-detalhe">${inline(detalhe)}</span>` : ""}
        </div>
      </li>`;
    })
    .join("");
  return `<ol class="linha-tempo">${itensHtml}</ol>`;
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
      ${meta.professor ? `<span>${escapar([meta.tratamento, meta.professor].filter(Boolean).join(" "))}</span>` : ""}
      ${meta.data ? `<span>${dataBonita(meta.data)}</span>` : ""}
      <span>${aula.minutosLeitura} min de leitura</span>
      ${meta.fonte ? `<span class="selo">${escapar(meta.fonte)}</span>` : ""}
      ${(Array.isArray(meta.tags) ? meta.tags : []).map((t) => `<span class="selo selo-acento">${escapar(t)}</span>`).join("")}
    </div>
  `);

  const conf = (meta.confianca || "alta").toLowerCase();
  if (conf === "baixa" || conf === "media") {
    // o aviso precisa dizer de onde a aula veio de fato: dizer "transcrição de
    // áudio" numa aula anotada à mão é afirmar coisa errada sobre a fonte
    const origem = /áudio|audio/i.test(meta.fonte || "")
      ? `de uma transcrição de áudio de sala${conf === "baixa" ? " com qualidade ruim" : ""}`
      : "de anotação feita durante a aula, ainda sem conferência";
    partes.push(`<div class="aviso"><span aria-hidden="true">⚠</span><span>
      Estas anotações vieram ${origem}.
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

  const linha = pegar("Linha do tempo");
  if (linha) {
    const marcos = pares(linha.corpo).filter((m) => m.verso);
    if (marcos.length) {
      partes.push(
        `<section class="secao"><h2>Linha do tempo <span class="selo">${marcos.length} marcos</span></h2>${renderLinhaTempo(marcos)}</section>`,
      );
    }
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

  const est = doArquivo(aula.arquivo);
  partes.push(`<div class="fim-aula">
    <button id="marcar" class="btn btn-marcar" aria-pressed="${est.estudada ? "true" : "false"}">
      ${est.estudada ? "✓ Estudada" : "Marcar como estudada"}
    </button>
    <a class="btn-voltar" href="#/">Voltar ao caderno</a>
  </div>`);

  principal.innerHTML = partes.join("");
  document.title = `${meta.tema || aula.tema} — Caderno de Pedagogia`;
  principal.style.setProperty("--disc-h", matizDisciplina(aula.disciplina));

  // sumário: saber quantas seções faltam evita a sensação de página sem fim
  const titulos = [...principal.querySelectorAll(".secao h2")];
  if (titulos.length > 2) {
    const chips = titulos.map((h, i) => {
      const id = `sec-${i}`;
      h.closest(".secao").id = id;
      // o selo ("11", "conferir") conta para a seção, não para o rótulo do chip
      const rotulo = h.cloneNode(true);
      rotulo.querySelectorAll(".selo").forEach((s) => s.remove());
      return `<a class="chip" href="#${id}">${escapar(rotulo.textContent.trim().replace(/\s+/g, " "))}</a>`;
    });
    const nav = document.createElement("nav");
    nav.className = "sumario";
    nav.setAttribute("aria-label", "Seções da aula");
    nav.innerHTML = chips.join("");
    principal.querySelector(".meta").after(nav);
    // âncora de seção não deve trocar a rota da aula
    nav.addEventListener("click", (e) => {
      const a = e.target.closest("a");
      if (!a) return;
      e.preventDefault();
      document
        .getElementById(a.getAttribute("href").slice(1))
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  const botao = document.getElementById("abrir-flash");
  if (botao) botao.addEventListener("click", () => abrirFlash(cards));

  const marcar = document.getElementById("marcar");
  marcar.addEventListener("click", () => {
    const agora = !doArquivo(aula.arquivo).estudada;
    salvarEstudo(aula.arquivo, { estudada: agora });
    marcar.textContent = agora ? "✓ Estudada" : "Marcar como estudada";
    marcar.setAttribute("aria-pressed", agora ? "true" : "false");
  });

  salvarEstudo(aula.arquivo, { visto: new Date().toISOString() });
  window.__cards = cards;
}

function renderInicio(filtro = "") {
  window.__cards = null;
  document.title = "Caderno de Pedagogia";
  principal.style.removeProperty("--disc-h");
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

  const cartao = (a) => {
    const est = doArquivo(a.arquivo);
    return `
      <a class="cartao${est.estudada ? " cartao-feito" : ""}" href="#/aula/${encodeURIComponent(a.arquivo)}"
         style="--disc-h:${matizDisciplina(a.disciplina)}">
        <div class="cartao-tema">${est.estudada ? `<span class="tique" aria-label="estudada">✓</span>` : ""}${escapar(a.tema)}</div>
        <div class="cartao-meta">
          ${a.data ? `<span>${dataBonita(a.data)}</span>` : ""}
          ${a.professor ? `<span>${escapar([a.tratamento, a.professor].filter(Boolean).join(" "))}</span>` : ""}
          ${a.marcos ? `<span>${a.marcos} marcos</span>` : ""}
          ${a.flashcards ? `<span>${a.flashcards} flashcards</span>` : ""}
          ${a.questoes ? `<span>${a.questoes} questões</span>` : ""}
          ${a.confianca !== "alta" ? `<span class="selo selo-alerta">revisar</span>` : ""}
          ${a.pendencias ? `<span class="selo selo-alerta">${a.pendencias} pendência${a.pendencias > 1 ? "s" : ""}</span>` : ""}
        </div>
      </a>`;
  };

  const blocos = [...porDisciplina.entries()]
    .sort((x, y) => x[0].localeCompare(y[0], "pt-BR"))
    .map(
      ([disc, lista]) => `
      <section class="disciplina-bloco" style="--disc-h:${matizDisciplina(disc)}">
        <h2 class="disciplina-titulo" style="margin-top:0">${escapar(disc)} · ${lista.length} aula${lista.length > 1 ? "s" : ""}</h2>
        ${lista.map(cartao).join("")}
      </section>`,
    )
    .join("");

  const feitas = INDICE.aulas.filter((a) => doArquivo(a.arquivo).estudada).length;

  principal.innerHTML = `
    <p class="migalha">Curso de Pedagogia</p>
    <h1>Caderno de estudos</h1>
    <div class="meta">
      <span>${INDICE.totalAulas} aula${INDICE.totalAulas > 1 ? "s" : ""}</span>
      <span>${INDICE.disciplinas.length} disciplina${INDICE.disciplinas.length > 1 ? "s" : ""}</span>
      <span>${INDICE.totalFlashcards} flashcards</span>
      ${feitas ? `<span class="selo selo-ok">${feitas} estudada${feitas > 1 ? "s" : ""}</span>` : ""}
    </div>
    ${termo ? "" : renderLembretes() + renderRetomar()}
    ${blocos}`;
}

function renderLembretes() {
  const hoje = hojeISO();
  const proximos = (INDICE.lembretes || []).filter((l) => l.data >= hoje);
  if (!proximos.length) return "";
  return `<section class="lembretes" aria-label="Lembretes">
    ${proximos
      .slice(0, 3)
      .map((l) => {
        const quando = quandoRelativo(l.data);
        const urgente = quando === "hoje" || quando === "amanhã";
        return `<div class="lembrete${urgente ? " lembrete-urgente" : ""}">
          <span class="lembrete-quando">${quando}</span>
          <span class="lembrete-texto">${inline(l.texto)}</span>
        </div>`;
      })
      .join("")}
  </section>`;
}

// retomar custa menos que reescolher: uma sessão nova não deveria começar pela lista inteira
function renderRetomar() {
  const candidatas = INDICE.aulas
    .map((a) => ({ a, est: doArquivo(a.arquivo) }))
    .filter((x) => x.est.visto && !x.est.estudada)
    .sort((x, y) => y.est.visto.localeCompare(x.est.visto));
  if (!candidatas.length) return "";
  const { a } = candidatas[0];
  return `<a class="retomar" href="#/aula/${encodeURIComponent(a.arquivo)}" style="--disc-h:${matizDisciplina(a.disciplina)}">
    <span class="retomar-rotulo">Continuar de onde parou</span>
    <span class="retomar-tema">${escapar(a.tema)}</span>
    <span class="retomar-disc">${escapar(a.disciplina)}</span>
  </a>`;
}

/* ---------------- biblioteca ---------------- */

const botaoLink = (link) =>
  link
    ? `<a class="obra-link" href="${escapar(link.url)}" target="_blank" rel="noopener noreferrer">${escapar(link.rotulo)} ↗</a>`
    : "";

function renderBiblioteca() {
  window.__cards = null;
  principal.style.removeProperty("--disc-h");
  document.title = "Biblioteca — Caderno de Pedagogia";

  const bib = INDICE.biblioteca || { autores: [], tarefas: [] };
  const totalObras = bib.autores.reduce((s, a) => s + a.obras.length, 0);

  if (!totalObras && !bib.tarefas.length) {
    principal.innerHTML = `<p class="migalha"><a href="#/">Caderno</a></p><h1>Biblioteca</h1>
      <p class="vazio">Nenhuma leitura citada nas aulas ainda.</p>`;
    return;
  }

  const linkAula = (aula) =>
    `<a class="obra-aula" href="#/aula/${encodeURIComponent(aula.arquivo)}" style="--disc-h:${matizDisciplina(aula.disciplina)}">${escapar(aula.disciplina)} · ${dataBonita(aula.data)}</a>`;

  const blocos = bib.autores
    .map(
      (grupo) => `
      <section class="autor-bloco">
        <h2 class="autor-nome">${grupo.autor ? escapar(grupo.autor) : "Obras sem autor citado"}</h2>
        <ul class="lista-obras">
          ${grupo.obras
            .map(
              (o) => `
            <li class="obra">
              <div class="obra-titulo">${escapar(o.obra)}${o.ano ? ` <span class="obra-ano">${escapar(o.ano)}</span>` : ""}</div>
              ${botaoLink(o.link)}
              ${o.citacoes
                .map(
                  (c) => `<div class="obra-citacao">
                    ${c.nota ? `<span class="obra-nota">${inline(c.nota)}</span>` : ""}
                    ${linkAula(c.aula)}
                  </div>`,
                )
                .join("")}
            </li>`,
            )
            .join("")}
          ${grupo.mencoes
            .map(
              (m) => `
            <li class="obra obra-sem-titulo">
              <div class="obra-titulo">Sem obra específica indicada</div>
              ${botaoLink(m.link)}
              <div class="obra-citacao">
                ${m.nota ? `<span class="obra-nota">${inline(m.nota)}</span>` : ""}
                ${linkAula(m.aula)}
              </div>
            </li>`,
            )
            .join("")}
        </ul>
      </section>`,
    )
    .join("");

  const tarefas = bib.tarefas.length
    ? `<section class="autor-bloco">
        <h2 class="autor-nome">Indicações sem obra definida</h2>
        <p class="obra-aviso">O professor pediu o assunto, não um título. Confirmar a referência exata antes de citar em trabalho.</p>
        <ul class="lista-obras">
          ${bib.tarefas
            .map(
              (t) => `
            <li class="obra obra-sem-titulo">
              <div class="obra-titulo">${inline(t.texto)}</div>
              ${botaoLink(t.link)}
              <div class="obra-citacao">
                ${t.nota ? `<span class="obra-nota">${inline(t.nota)}</span>` : ""}
                ${linkAula(t.aula)}
              </div>
            </li>`,
            )
            .join("")}
        </ul>
      </section>`
    : "";

  principal.innerHTML = `
    <p class="migalha"><a href="#/">Caderno</a></p>
    <h1>Biblioteca</h1>
    <div class="meta">
      <span>${totalObras} obra${totalObras > 1 ? "s" : ""}</span>
      <span>${bib.autores.filter((a) => a.autor).length} autores</span>
      ${bib.tarefas.length ? `<span class="selo selo-alerta">${bib.tarefas.length} a confirmar</span>` : ""}
    </div>
    <p class="obra-aviso">Montada a partir do <b>Para ler</b> de cada aula — nada aqui foi acrescentado por fora.</p>
    ${blocos}${tarefas}`;
}

/* ---------------- modo flashcard ---------------- */

const overlay = document.getElementById("flashmodo");
const elCard = document.getElementById("flash-card");
const elTexto = document.getElementById("flash-texto");
const elRotulo = elCard.querySelector(".flash-rotulo");
const elContador = document.getElementById("flash-contador");
const elProgresso = document.getElementById("flash-progresso");

// blocos curtos: o baralho inteiro de uma vez é grande demais para começar
const BLOCO = 8;

const btnAcertei = document.getElementById("flash-acertei");
const btnErrei = document.getElementById("flash-errei");

let fila = []; // o que ainda não foi dominado
let baralho = []; // o bloco em curso
let posicao = 0;
let virado = false;
let emPausa = false;
let blocoNum = 0;

function abrirFlash(cards) {
  if (!cards || !cards.length) return;
  fila = cards.slice();
  blocoNum = 0;
  overlay.hidden = false;
  proximoBloco();
}

function proximoBloco() {
  baralho = fila.splice(0, BLOCO);
  posicao = 0;
  virado = false;
  emPausa = false;
  blocoNum++;
  elCard.disabled = false;
  btnAcertei.textContent = "Sei essa";
  btnErrei.textContent = "Ainda não sei";
  mostrarCard();
}

function fecharFlash() {
  overlay.hidden = true;
}

function mostrarCard() {
  if (posicao >= baralho.length) return pausar();
  const c = baralho[posicao];
  elRotulo.textContent = virado ? "resposta" : "pergunta";
  elTexto.innerHTML = inline(virado ? c.verso || "—" : c.frente);
  elContador.textContent = `bloco ${blocoNum} · ${posicao + 1}/${baralho.length}`;
  elProgresso.style.width = `${(posicao / baralho.length) * 100}%`;
}

// fim de bloco é o momento de parar sem culpa — e o único convite a continuar
function pausar() {
  emPausa = true;
  virado = false;
  elCard.disabled = true;
  elProgresso.style.width = "100%";
  elRotulo.textContent = fila.length ? "pausa" : "fim";
  elContador.textContent = `bloco ${blocoNum} concluído`;
  if (fila.length) {
    elTexto.textContent = `Bloco ${blocoNum} fechado. Faltam ${fila.length} carta${fila.length > 1 ? "s" : ""}.`;
    btnAcertei.textContent = `Mais ${Math.min(BLOCO, fila.length)}`;
    btnErrei.textContent = "Parar por hoje";
  } else {
    elTexto.textContent = "Baralho concluído. Boa!";
    btnAcertei.textContent = "Fechar";
    btnErrei.textContent = "Fechar";
  }
}

function virar() {
  if (emPausa) return;
  virado = !virado;
  mostrarCard();
}

function avancar(acertou) {
  if (emPausa) {
    if (acertou && fila.length) return proximoBloco();
    return fecharFlash();
  }
  const c = baralho[posicao];
  if (!acertou && c) fila.push(c); // erra agora, volta num bloco adiante
  posicao++;
  virado = false;
  mostrarCard();
}

elCard.addEventListener("click", virar);
document.getElementById("flash-sair").addEventListener("click", fecharFlash);
btnAcertei.addEventListener("click", () => avancar(true));
btnErrei.addEventListener("click", () => avancar(false));

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
  if (hash === "/biblioteca") {
    renderBiblioteca();
    window.scrollTo(0, 0);
    return;
  }
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
