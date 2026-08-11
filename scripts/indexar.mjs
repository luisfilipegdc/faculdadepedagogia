// Regenera conteudo/index.json a partir dos .md em conteudo/<disciplina>/
// Sem dependências. Node 18+.
import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONTEUDO = join(RAIZ, "conteudo");

function parseFrontmatter(texto) {
  const m = texto.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { meta: {}, corpo: texto };
  const meta = {};
  for (const linha of m[1].split(/\r?\n/)) {
    const par = linha.match(/^([A-Za-zÀ-ÿ_][\w\-À-ÿ]*)\s*:\s*(.*)$/);
    if (!par) continue;
    const chave = par[1].trim();
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
    meta[chave] = valor;
  }
  return { meta, corpo: texto.slice(m[0].length) };
}

function secoes(corpo) {
  const mapa = {};
  const partes = corpo.split(/^##\s+/m).slice(1);
  for (const parte of partes) {
    const quebra = parte.indexOf("\n");
    const titulo = (quebra === -1 ? parte : parte.slice(0, quebra)).trim();
    mapa[titulo.toLowerCase()] = quebra === -1 ? "" : parte.slice(quebra + 1);
  }
  return mapa;
}

function contarItens(mapa, titulo) {
  const bloco = mapa[titulo.toLowerCase()];
  if (!bloco) return 0;
  return bloco.split(/\r?\n/).filter((l) => /^\s*(-|\d+\.)\s+\S/.test(l)).length;
}

// lembretes.md fica na raiz de conteudo/ e não é aula
const NAO_E_AULA = new Set(["lembretes.md"]);

function itensDe(mapa, titulo) {
  const bloco = mapa[titulo.toLowerCase()];
  if (!bloco) return [];
  return bloco
    .split(/\r?\n/)
    .map((l) => l.match(/^\s*(?:-|\d+\.)\s+(.*)$/))
    .filter(Boolean)
    .map((m) => m[1].trim())
    .filter(Boolean);
}

// "Autor, *Obra* (1979) — nota" e as três variações que aparecem de fato:
// sem autor, sem obra, e a tarefa de leitura que não é obra nenhuma.
function parseLeitura(linha) {
  // link legítimo no fim da linha: [rótulo](url) — sai da nota e vira botão
  let resto = linha;
  let link = null;
  const mLink = resto.match(/\s*\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)\s*$/);
  if (mLink) {
    link = { rotulo: mLink[1].trim(), url: mLink[2] };
    resto = resto.slice(0, mLink.index);
  }

  const corte = resto.indexOf(" — ");
  const texto = (corte === -1 ? resto : resto.slice(0, corte)).trim();
  const nota = corte === -1 ? "" : resto.slice(corte + 3).trim();

  const mObra = texto.match(/\*([^*]+)\*/);
  const mAno = texto.match(/\((\d{4})\)/);
  let autor = texto;
  if (mObra) autor = autor.replace(mObra[0], "");
  if (mAno) autor = autor.replace(mAno[0], "");
  autor = autor.replace(/^[\s,;]+|[\s,;]+$/g, "");

  return {
    texto,
    nota,
    link,
    obra: mObra ? mObra[1].trim() : "",
    autor: mObra ? autor : "",
    ano: mAno ? mAno[1] : "",
  };
}

const chaveObra = (s) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

async function listarMd(dir, raiz = true) {
  const saida = [];
  let entradas;
  try {
    entradas = await readdir(dir, { withFileTypes: true });
  } catch {
    return saida;
  }
  for (const e of entradas) {
    const caminho = join(dir, e.name);
    if (e.isDirectory()) saida.push(...(await listarMd(caminho, false)));
    else if (e.name.endsWith(".md") && !(raiz && NAO_E_AULA.has(e.name)))
      saida.push(caminho);
  }
  return saida;
}

// "- 2026-08-13 :: texto" -> { data, texto }
async function lerLembretes() {
  let texto;
  try {
    texto = await readFile(join(CONTEUDO, "lembretes.md"), "utf8");
  } catch {
    return [];
  }
  return texto
    .split(/\r?\n/)
    .map((l) => l.match(/^\s*-\s+(\d{4}-\d{2}-\d{2})\s*::\s*(.+)$/))
    .filter(Boolean)
    .map((m) => ({ data: m[1], texto: m[2].trim() }))
    .sort((a, b) => a.data.localeCompare(b.data));
}

const arquivos = await listarMd(CONTEUDO);
const aulas = [];
const todasLeituras = [];

for (const caminho of arquivos) {
  const texto = await readFile(caminho, "utf8");
  const { meta, corpo } = parseFrontmatter(texto);
  const info = await stat(caminho);
  const rel = relative(RAIZ, caminho).split("\\").join("/");
  const palavras = corpo.split(/\s+/).filter(Boolean).length;
  const sec = secoes(corpo);

  const daAula = {
    arquivo: rel,
    tema: meta.tema || rel.split("/").pop().replace(/\.md$/, ""),
    disciplina: meta.disciplina || "Sem disciplina",
    data: meta.data || "",
  };
  for (const linha of itensDe(sec, "Para ler")) {
    todasLeituras.push({ ...parseLeitura(linha), aula: daAula });
  }

  aulas.push({
    arquivo: rel,
    disciplina: meta.disciplina || "Sem disciplina",
    professor: meta.professor || "",
    tratamento: meta.tratamento || "",
    data: meta.data || "",
    tema: meta.tema || rel.split("/").pop().replace(/\.md$/, ""),
    tags: Array.isArray(meta.tags) ? meta.tags : meta.tags ? [meta.tags] : [],
    fonte: meta.fonte || "",
    confianca: (meta.confianca || "alta").toLowerCase(),
    flashcards: contarItens(sec, "Flashcards"),
    questoes: contarItens(sec, "Questões"),
    conceitos: contarItens(sec, "Conceitos"),
    marcos: contarItens(sec, "Linha do tempo"),
    pendencias: contarItens(sec, "Pendências"),
    minutosLeitura: Math.max(1, Math.round(palavras / 200)),
    atualizado: info.mtime.toISOString(),
  });
}

aulas.sort((a, b) => (b.data || "").localeCompare(a.data || ""));

const disciplinas = [...new Set(aulas.map((a) => a.disciplina))].sort((a, b) =>
  a.localeCompare(b, "pt-BR"),
);

// A cor sai da posição nesta lista, que fica em conteudo/cores.json e só cresce:
// disciplina nova é anexada no fim e nenhuma outra muda de lugar.
//
// Ordenar por nome recoloria as vizinhas quando entrava uma disciplina no meio
// do alfabeto. Ordenar pela data da primeira aula tinha o mesmo defeito de outro
// jeito: cadastrar uma aula antiga de uma disciplina que já existe a faz pular
// para a frente e recolorir todas as outras. Só a lista persistida é estável.
const CORES = join(CONTEUDO, "cores.json");
let ordemCor = [];
try {
  const lido = JSON.parse(await readFile(CORES, "utf8"));
  if (Array.isArray(lido)) ordemCor = lido.filter((d) => typeof d === "string");
} catch {}

const novas = disciplinas.filter((d) => !ordemCor.includes(d));
if (novas.length) {
  ordemCor = [...ordemCor, ...novas];
  await writeFile(CORES, JSON.stringify(ordemCor, null, 2) + "\n", "utf8");
  console.log(`cor nova para: ${novas.join(", ")}`);
}

const lembretes = await lerLembretes();

// mesma obra citada em duas aulas vira uma entrada com as duas citações
const porObra = new Map();
const outras = [];
for (const l of todasLeituras) {
  if (!l.obra) {
    outras.push({ texto: l.texto, nota: l.nota, link: l.link, aula: l.aula });
    continue;
  }
  const chave = chaveObra(`${l.autor} ${l.obra}`);
  if (!porObra.has(chave)) {
    porObra.set(chave, {
      obra: l.obra,
      autor: l.autor,
      ano: l.ano,
      link: l.link,
      citacoes: [],
    });
  }
  const alvo = porObra.get(chave);
  if (!alvo.ano && l.ano) alvo.ano = l.ano;
  if (!alvo.link && l.link) alvo.link = l.link;
  alvo.citacoes.push({ nota: l.nota, aula: l.aula });
}

// agrupa por autor; "" vira o grupo das obras sem autor citado, sempre por último
const porAutor = new Map();
for (const o of [...porObra.values()].sort((a, b) =>
  a.obra.localeCompare(b.obra, "pt-BR"),
)) {
  const chave = chaveObra(o.autor);
  if (!porAutor.has(chave))
    porAutor.set(chave, { autor: o.autor, obras: [], mencoes: [] });
  porAutor.get(chave).obras.push({
    obra: o.obra,
    ano: o.ano,
    link: o.link,
    citacoes: o.citacoes,
  });
}

// "Paulo Freire — retomar junto com..." não é obra, mas é do Freire:
// só encaixa quando bate exatamente com um autor que já tem obra na lista.
const tarefas = [];
for (const o of outras) {
  const grupo = porAutor.get(chaveObra(o.texto));
  if (grupo) grupo.mencoes.push({ nota: o.nota, link: o.link, aula: o.aula });
  else tarefas.push(o);
}

const autores = [...porAutor.values()].sort((a, b) =>
  (a.autor || "￿").localeCompare(b.autor || "￿", "pt-BR"),
);
const totalObras = autores.reduce((s, a) => s + a.obras.length, 0);

const indice = {
  gerado: new Date().toISOString(),
  totalAulas: aulas.length,
  totalFlashcards: aulas.reduce((s, a) => s + a.flashcards, 0),
  disciplinas,
  ordemCor,
  lembretes,
  biblioteca: { autores, tarefas },
  aulas,
};

await writeFile(
  join(CONTEUDO, "index.json"),
  JSON.stringify(indice, null, 2) + "\n",
  "utf8",
);

console.log(
  `indexado: ${aulas.length} aula(s), ${disciplinas.length} disciplina(s), ${indice.totalFlashcards} flashcard(s), ${lembretes.length} lembrete(s), ${totalObras} obra(s) de ${autores.length} autor(es) + ${tarefas.length} indicação(ões)`,
);
