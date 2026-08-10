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

for (const caminho of arquivos) {
  const texto = await readFile(caminho, "utf8");
  const { meta, corpo } = parseFrontmatter(texto);
  const info = await stat(caminho);
  const rel = relative(RAIZ, caminho).split("\\").join("/");
  const palavras = corpo.split(/\s+/).filter(Boolean).length;
  const sec = secoes(corpo);

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

const lembretes = await lerLembretes();

const indice = {
  gerado: new Date().toISOString(),
  totalAulas: aulas.length,
  totalFlashcards: aulas.reduce((s, a) => s + a.flashcards, 0),
  disciplinas,
  lembretes,
  aulas,
};

await writeFile(
  join(CONTEUDO, "index.json"),
  JSON.stringify(indice, null, 2) + "\n",
  "utf8",
);

console.log(
  `indexado: ${aulas.length} aula(s), ${disciplinas.length} disciplina(s), ${indice.totalFlashcards} flashcard(s), ${lembretes.length} lembrete(s)`,
);
