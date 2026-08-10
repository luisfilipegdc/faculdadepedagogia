# faculdadepedagogia

Caderno de estudos do curso de Pedagogia — transcrições de aula viram resumo, mapa conceitual, flashcards e questões de revisão.

**Site:** publicado na Vercel a cada push na `main`.

## Como funciona

```
conteudo/<disciplina>/<aula>.md   ← o conteúdo mora aqui
conteudo/index.json               ← gerado por `npm run indexar`
transcricoes/                     ← texto cru dos áudios, nunca publicado como aula
index.html + assets/              ← o leitor (site estático, zero dependência)
```

## Rodar local

```bash
npm run dev      # http://localhost:3000
```

## Adicionar uma aula

1. Criar `conteudo/<disciplina>/AAAA-MM-DD-tema.md` seguindo o contrato em [CLAUDE.md](./CLAUDE.md).
2. `npm run indexar`
3. `git add . && git commit -m "aula: <tema>" && git push`

## Deploy na Vercel

Importar o repo na Vercel e aceitar os padrões. Não há build step — `vercel.json` já aponta para os arquivos estáticos.

## Atalhos no site

| Tecla | Ação |
|---|---|
| `/` | buscar |
| `f` | modo flashcard |
| `espaço` | virar o card |
| `→` | próximo card |
| `esc` | sair do modo flashcard |
