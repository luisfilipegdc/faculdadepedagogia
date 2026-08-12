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

// bloco livre: ### subtítulo, parágrafos e listas. É o que sustenta o
// ## Desenvolvimento, onde a aula fica inteira em vez de resumida.
function renderProsa(bloco) {
  const saida = [];
  let lista = null;
  let paragrafo = [];
  const fecharLista = () => {
    if (lista) saida.push(`<ul class="lista-simples">${lista.join("")}</ul>`);
    lista = null;
  };
  const fecharParagrafo = () => {
    if (paragrafo.length) saida.push(`<p>${inline(paragrafo.join(" "))}</p>`);
    paragrafo = [];
  };

  for (const linha of bloco.split(/\r?\n/)) {
    const t = linha.trim();
    if (!t) {
      fecharParagrafo();
      fecharLista();
      continue;
    }
    const sub = t.match(/^###\s+(.*)$/);
    if (sub) {
      fecharParagrafo();
      fecharLista();
      saida.push(`<h3 class="sub">${inline(sub[1])}</h3>`);
      continue;
    }
    const item = t.match(/^[-*]\s+(.*)$/);
    if (item) {
      fecharParagrafo();
      (lista ||= []).push(`<li>${inline(item[1])}</li>`);
      continue;
    }
    fecharLista();
    paragrafo.push(t);
  }
  fecharParagrafo();
  fecharLista();
  return saida.join("");
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

  const desenvolvimento = pegar("Desenvolvimento");
  if (desenvolvimento) {
    partes.push(`<section class="secao"><h2>Desenvolvimento</h2>
      ${renderProsa(desenvolvimento.corpo)}
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

  // material escrito por mim a pedido do Luis, não é o que a professora deu.
  // Fica visualmente separado para nunca ser confundido com conteúdo de aula.
  const adiantado = pegar("Estudo adiantado");
  if (adiantado) {
    partes.push(`<section class="secao"><h2>Estudo adiantado <span class="selo selo-alerta">material meu</span></h2>
      <div class="adiantado">
        <p class="adiantado-nota"><b>Isto não é o que a professora disse.</b>
        É material que escrevi a seu pedido para adiantar o estudo. Quando ela
        der esse conteúdo em aula, o dela entra no Desenvolvimento e este bloco sai.</p>
        ${renderProsa(adiantado.corpo)}
      </div>
    </section>`);
  }

  document.body.classList.remove("painel");
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

  // busca ativa: a lista simples responde melhor que o painel
  if (termo) {
    document.body.classList.remove("painel");
    principal.innerHTML = `
      <p class="migalha">Busca</p>
      <h1>${aulas.length} resultado${aulas.length > 1 ? "s" : ""}</h1>
      ${blocos}`;
    return;
  }

  document.body.classList.add("painel");
  principal.innerHTML = `
    <div class="painel-cab">
      <p class="migalha">Curso de Pedagogia</p>
      <h1>Faculdade — Pedagogia</h1>
      <div class="painel-meta">
        ${(INDICE.curso || []).map((c) => `<span><b>${escapar(c.rotulo)}</b>${escapar(c.valor)}</span>`).join("")}
      </div>
      <div class="painel-meta">
        <span><b>Aulas</b>${INDICE.totalAulas}</span>
        <span><b>Matérias</b>${INDICE.disciplinas.length}</span>
        <span><b>Obras</b>${(INDICE.biblioteca?.autores || []).reduce((s, g) => s + g.obras.length, 0)}</span>
        ${feitas ? `<span><b>Estudadas</b>${feitas}</span>` : ""}
      </div>
    </div>
    <div class="colunas">
      ${faixaUrgente()}
      ${blocoAgora()}
      ${blocoSemana()}
      ${blocoMaterias(porDisciplina)}
      ${gaveta("Cronograma da semana", "", modCronogramaCorpo())}
      ${gaveta("Leituras e links", (INDICE.biblioteca?.autores || []).reduce((s, g) => s + g.obras.length, 0), modLeiturasCorpo())}
      ${gaveta("Últimas aulas", INDICE.totalAulas, modUltimasCorpo())}
    </div>`;
}

const gaveta = (titulo, conta, corpo) => `
  <details class="gaveta">
    <summary>${titulo}${conta ? `<span class="gaveta-conta">${conta}</span>` : ""}</summary>
    <div class="gaveta-corpo">${corpo}</div>
  </details>`;

const urgentes = () => {
  const hoje = hojeISO();
  return (INDICE.lembretes || []).filter((l) => {
    const q = quandoRelativo(l.data);
    return l.data >= hoje && (q === "hoje" || q === "amanhã");
  });
};

// faixa fina: avisa sem roubar o lugar da ação principal
function faixaUrgente() {
  return urgentes()
    .map(
      (l) => `<div class="urgente">
        <span class="urgente-quando">${quandoRelativo(l.data)}</span>
        <span>${inline(l.texto)}</span>
      </div>`,
    )
    .join("");
}

// nível 1: uma coisa só, e é sempre estudar — é para isso que o site existe
function blocoAgora() {
  const c = INDICE.aulas
    .map((a) => ({ a, est: doArquivo(a.arquivo) }))
    .filter((x) => x.est.visto && !x.est.estudada)
    .sort((x, y) => y.est.visto.localeCompare(x.est.visto));
  const alvo = c.length ? c[0].a : INDICE.aulas[0];
  if (!alvo) return "";
  const voltando = c.length;
  return `<a class="agora" href="#/aula/${encodeURIComponent(alvo.arquivo)}" style="--disc-h:${matizDisciplina(alvo.disciplina)}">
    <span class="agora-rotulo">${voltando ? "Continuar de onde parou" : "Começar pela mais recente"}</span>
    <span class="agora-titulo">${escapar(alvo.tema)}</span>
    <span class="agora-sub">${escapar(alvo.disciplina)} · ${alvo.minutosLeitura} min de leitura</span>
  </a>`;
}

// nível 2: o que vem depois do que já está na faixa — nunca repete
function blocoSemana() {
  const hoje = hojeISO();
  const naFaixa = new Set(urgentes().map((l) => l.data + l.texto));
  const proximos = (INDICE.lembretes || []).filter(
    (l) => l.data >= hoje && !naFaixa.has(l.data + l.texto),
  );
  if (!proximos.length) return "";
  return `<section class="bloco">
    <h2 class="faixa-titulo">Agenda</h2>
    ${proximos
      .slice(0, 4)
      .map((l) => {
        const q = quandoRelativo(l.data);
        return `<div class="linha-simples${q === "hoje" || q === "amanhã" ? " linha-perto" : ""}">
          <span class="linha-quando">${q}</span>
          <span>${inline(l.texto)}</span>
        </div>`;
      })
      .join("")}
  </section>`;
}

function blocoMaterias(porDisciplina) {
  return `<section class="bloco">
    <h2 class="faixa-titulo">Matérias</h2>
    ${[...porDisciplina.entries()]
      .sort((x, y) => x[0].localeCompare(y[0], "pt-BR"))
      .map(
        ([d, lista]) => `
        <a class="linha-simples" href="#/" data-disc="${escapar(d)}" style="--disc-h:${matizDisciplina(d)}">
          <span class="item-ponto"></span>
          <span class="item-nome">${escapar(d)}</span>
          <span class="item-num">${lista.length} aula${lista.length > 1 ? "s" : ""}</span>
        </a>`,
      )
      .join("")}
  </section>`;
}

const mod = (titulo, extra, corpo) => `
  <section class="mod">
    <div class="mod-titulo"><span>${titulo}</span>${extra ? `<span>${extra}</span>` : ""}</div>
    <div class="mod-corpo">${corpo}</div>
  </section>`;




const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

function modCronogramaCorpo() {
  const fixos = INDICE.horarios || [];
  // sem horários declarados, o dia da semana sai das datas das aulas já registradas
  const porDia = new Map();
  for (const h of fixos) {
    const i = DIAS.indexOf(semAcento(h.dia) === "terca" ? "terça" : h.dia);
    if (i < 0) continue;
    if (!porDia.has(i)) porDia.set(i, []);
    porDia.get(i).push(h);
  }
  const deduzido = !fixos.length;
  if (deduzido) {
    for (const a of INDICE.aulas) {
      if (!a.data) continue;
      const i = new Date(a.data + "T12:00:00Z").getUTCDay();
      if (!porDia.has(i)) porDia.set(i, []);
      if (!porDia.get(i).some((x) => x.disciplina === a.disciplina))
        porDia.get(i).push({ disciplina: a.disciplina, hora: "" });
    }
  }
  const uteis = [1, 2, 3, 4, 5, 6];
  const cabecalho = uteis
    .map((d) => `<th>${DIAS[d].slice(0, 3)}</th>`)
    .join("");
  const celulas = uteis
    .map(
      (d) =>
        `<td>${(porDia.get(d) || [])
          .map(
            (h) =>
              `<span class="marca-disc" style="--disc-h:${matizDisciplina(h.disciplina)}" title="${escapar(h.disciplina)}">${escapar(h.disciplina.split(" ")[0])}${h.hora ? `<br>${escapar(h.hora)}` : ""}</span>`,
          )
          .join("")}</td>`,
    )
    .join("");
  return `<table class="cronograma"><thead><tr>${cabecalho}</tr></thead><tbody><tr>${celulas}</tr></tbody></table>
    ${deduzido ? `<div class="mod-vazio">Só o dia da semana, deduzido das datas das aulas. Os horários entram em <code>conteudo/horarios.md</code>.</div>` : ""}`;
}


function modUltimasCorpo() {
  return INDICE.aulas
    .map(
      (a) => `
    <a class="linha-simples" href="#/aula/${encodeURIComponent(a.arquivo)}" style="--disc-h:${matizDisciplina(a.disciplina)}">
      <span class="linha-quando">${dataBonita(a.data).slice(0, 5)}</span>
      <span class="item-nome">${doArquivo(a.arquivo).estudada ? '<span class="tique">✓</span>' : ""}${escapar(a.tema)}</span>
    </a>`,
    )
    .join("");
}


function modLeiturasCorpo() {
  const autores = INDICE.biblioteca?.autores || [];
  const obras = autores.flatMap((g) => g.obras.map((o) => ({ ...o, autor: g.autor })));
  const links = INDICE.links || [];
  const parteObras = obras.length
    ? obras
        .slice(0, 6)
        .map(
          (o) =>
            `<a class="link-ext" href="#/biblioteca">${escapar(o.obra)}<small>${escapar(o.autor || "sem autor")}${o.ano ? ` · ${o.ano}` : ""}</small></a>`,
        )
        .join("") +
      `<a class="linha-simples" href="#/biblioteca"><span class="item-nome">Ver a biblioteca inteira ↗</span></a>`
    : "";
  const parteLinks = links.length
    ? links
        .map(
          (l) =>
            `<a class="link-ext" href="${escapar(l.url)}" target="_blank" rel="noopener noreferrer">${escapar(l.rotulo)}<small>${escapar(l.nota || l.url)}</small></a>`,
        )
        .join("")
    : `<div class="mod-vazio">Portal do aluno e Teams entram em <code>conteudo/links.md</code>.</div>`;
  return parteObras + parteLinks;
}

/* ---------------- navegação lateral ---------------- */

const lateral = document.getElementById("lateral");

function renderLateral(ativo = "") {
  const porDisciplina = new Map();
  for (const a of INDICE.aulas) {
    if (!porDisciplina.has(a.disciplina)) porDisciplina.set(a.disciplina, []);
    porDisciplina.get(a.disciplina).push(a);
  }

  const secoes = [...porDisciplina.entries()]
    .sort((x, y) => x[0].localeCompare(y[0], "pt-BR"))
    .map(
      ([disc, lista]) => `
      <div class="nav-grupo" style="--disc-h:${matizDisciplina(disc)}">
        <div class="nav-disciplina"><span class="nav-ponto" aria-hidden="true"></span>${escapar(disc)}</div>
        ${lista
          .map((a) => {
            const est = doArquivo(a.arquivo);
            const atual = a.arquivo === ativo;
            return `<a class="nav-aula${atual ? " nav-atual" : ""}${est.estudada ? " nav-feita" : ""}"
                       href="#/aula/${encodeURIComponent(a.arquivo)}"${atual ? ' aria-current="page"' : ""}>
              <span class="nav-data">${a.data ? a.data.slice(8, 10) + "/" + a.data.slice(5, 7) : ""}</span>
              <span class="nav-tema">${escapar(a.tema)}</span>
            </a>`;
          })
          .join("")}
      </div>`,
    )
    .join("");

  lateral.innerHTML = `
    <a class="nav-item${ativo === "" && location.hash !== "#/biblioteca" ? " nav-atual" : ""}" href="#/">
      <span aria-hidden="true">🏠</span> Caderno
    </a>
    <a class="nav-item${location.hash === "#/biblioteca" ? " nav-atual" : ""}" href="#/biblioteca">
      <span aria-hidden="true">📖</span> Biblioteca
    </a>
    <div class="nav-titulo">Disciplinas</div>
    ${secoes}`;
}

const btnMenu = document.getElementById("menu");
btnMenu.addEventListener("click", () => {
  const aberto = document.body.classList.toggle("com-lateral");
  btnMenu.setAttribute("aria-expanded", aberto ? "true" : "false");
});
lateral.addEventListener("click", (e) => {
  if (e.target.closest("a")) {
    document.body.classList.remove("com-lateral");
    btnMenu.setAttribute("aria-expanded", "false");
  }
});

/* ---------------- biblioteca ---------------- */

/* leituras marcadas como lidas ficam no navegador, como o estudo das aulas */
let LIDAS = ler("lidas", {});
const foiLida = (chave) => !!LIDAS[chave];
function alternarLida(chave) {
  if (LIDAS[chave]) delete LIDAS[chave];
  else LIDAS[chave] = new Date().toISOString();
  guardar("lidas", LIDAS);
}
const chaveLeitura = (o) => semAcento(`${o.autor || ""} ${o.obra}`).replace(/[^a-z0-9]+/g, "-");

const botaoLink = (link) =>
  link
    ? `<a class="obra-link" href="${escapar(link.url)}" target="_blank" rel="noopener noreferrer">${escapar(link.rotulo)} ↗</a>`
    : "";

function renderBiblioteca() {
  window.__cards = null;
  document.body.classList.remove("painel");
  principal.style.removeProperty("--disc-h");
  document.title = "Biblioteca — Caderno de Pedagogia";

  const bib = INDICE.biblioteca || { autores: [], tarefas: [] };
  const todas = bib.autores.flatMap((g) =>
    g.obras.map((o) => ({ ...o, autor: g.autor })),
  );
  const basicas = todas.filter((o) => o.basica);
  const citadas = todas.filter((o) => !o.basica);

  if (!todas.length && !bib.tarefas.length) {
    principal.innerHTML = `<p class="migalha"><a href="#/">Caderno</a></p><h1>Biblioteca</h1>
      <p class="vazio">Nenhuma leitura citada nas aulas ainda.</p>`;
    return;
  }

  const lidas = todas.filter((o) => foiLida(chaveLeitura(o))).length;

  const cartaoObra = (o, destaque) => {
    const chave = chaveLeitura(o);
    const lida = foiLida(chave);
    const aulas = o.citacoes.map((c) => c.aula);
    const disc = aulas[0]?.disciplina || "";
    return `<article class="obra${destaque ? " obra-basica" : ""}${lida ? " obra-lida" : ""}"
             style="--disc-h:${matizDisciplina(disc)}">
      <div class="obra-topo">
        <div>
          <div class="obra-titulo">${escapar(o.obra)}${o.ano ? ` <span class="obra-ano">${escapar(o.ano)}</span>` : ""}</div>
          <div class="obra-autor">${escapar(o.autor || "sem autor citado")}</div>
        </div>
        <button class="marcar-lida" data-leitura="${chave}" aria-pressed="${lida}"
                title="${lida ? "Marcar como não lida" : "Marcar como lida"}">${lida ? "✓ lida" : "marcar lida"}</button>
      </div>
      ${o.citacoes[0]?.nota ? `<p class="obra-nota">${inline(o.citacoes[0].nota)}</p>` : ""}
      ${botaoLink(o.link)}
      <div class="obra-aulas">
        ${aulas
          .map(
            (a) =>
              `<a class="obra-aula" href="#/aula/${encodeURIComponent(a.arquivo)}" style="--disc-h:${matizDisciplina(a.disciplina)}">${escapar(a.disciplina)} · ${dataBonita(a.data).slice(0, 5)}</a>`,
          )
          .join("")}
      </div>
    </article>`;
  };

  const porAutor = (lista) => {
    const grupos = new Map();
    for (const o of lista) {
      const k = o.autor || "Sem autor citado";
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k).push(o);
    }
    return [...grupos.entries()]
      .sort((a, b) => (a[0] === "Sem autor citado" ? 1 : b[0] === "Sem autor citado" ? -1 : a[0].localeCompare(b[0], "pt-BR")))
      .map(
        ([autor, obras]) => `
        <div class="autor-bloco">
          <h3 class="autor-nome">${escapar(autor)}</h3>
          ${obras.map((o) => cartaoObra(o, false)).join("")}
        </div>`,
      )
      .join("");
  };

  principal.innerHTML = `
    <p class="migalha"><a href="#/">Caderno</a></p>
    <h1>Biblioteca</h1>
    <div class="meta">
      <span>${todas.length} obra${todas.length > 1 ? "s" : ""}</span>
      ${lidas ? `<span class="selo selo-ok">${lidas} lida${lidas > 1 ? "s" : ""}</span>` : ""}
    </div>

    ${
      basicas.length
        ? `<section class="secao">
            <h2>Bibliografia básica <span class="selo selo-ok">comece por aqui</span></h2>
            <p class="obra-aviso">As que a disciplina cobra. As outras foram citadas de passagem em aula.</p>
            ${basicas.map((o) => cartaoObra(o, true)).join("")}
          </section>`
        : ""
    }

    ${
      citadas.length
        ? `<section class="secao">
            <h2>Citadas em aula <span class="selo">${citadas.length}</span></h2>
            ${porAutor(citadas)}
          </section>`
        : ""
    }

    ${
      bib.tarefas.length
        ? `<details class="gaveta">
            <summary>Indicações sem obra definida<span class="gaveta-conta">${bib.tarefas.length}</span></summary>
            <div class="gaveta-corpo">
              <p class="obra-aviso">O professor pediu o assunto, não um título. Confirmar a referência antes de citar em trabalho.</p>
              ${bib.tarefas
                .map(
                  (t) => `<div class="obra obra-sem-titulo">
                    <div class="obra-titulo">${inline(t.texto)}</div>
                    ${t.nota ? `<p class="obra-nota">${inline(t.nota)}</p>` : ""}
                    <div class="obra-aulas"><a class="obra-aula" href="#/aula/${encodeURIComponent(t.aula.arquivo)}" style="--disc-h:${matizDisciplina(t.aula.disciplina)}">${escapar(t.aula.disciplina)} · ${dataBonita(t.aula.data).slice(0, 5)}</a></div>
                  </div>`,
                )
                .join("")}
            </div>
          </details>`
        : ""
    }`;

  principal.querySelectorAll("[data-leitura]").forEach((b) =>
    b.addEventListener("click", () => {
      alternarLida(b.dataset.leitura);
      renderBiblioteca();
    }),
  );
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
    renderLateral("");
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
    renderLateral(arquivo);
    window.scrollTo(0, 0);
    return;
  }
  renderInicio(busca.value);
  renderLateral("");
}

// clicar numa matéria do painel filtra a lista pela busca
principal.addEventListener("click", (e) => {
  const alvo = e.target.closest("[data-disc]");
  if (!alvo) return;
  e.preventDefault();
  busca.value = alvo.dataset.disc;
  renderInicio(busca.value);
});

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
