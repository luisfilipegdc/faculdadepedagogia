// Servidor estático mínimo para desenvolvimento local. Sem dependências.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, dirname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORTA = process.env.PORT || 3000;

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

createServer(async (req, res) => {
  const url = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const seguro = normalize(url).replace(/^(\.\.[/\\])+/, "");
  let caminho = join(RAIZ, seguro);
  if (seguro === "/" || seguro === "\\") caminho = join(RAIZ, "index.html");

  try {
    const dados = await readFile(caminho);
    res.writeHead(200, {
      "Content-Type": TIPOS[extname(caminho)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(dados);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("404 — não encontrado: " + seguro);
  }
}).listen(PORTA, () => {
  console.log(`caderno rodando em http://localhost:${PORTA}`);
});
