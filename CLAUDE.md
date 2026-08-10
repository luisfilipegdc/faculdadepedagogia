# faculdadepedagogia — instruções para o Claude Code

Caderno de estudos do curso de Pedagogia do Luis. Site estático, sem build, publicado na Vercel.

## Regra número 1

O conteúdo é **markdown em `conteudo/`**. O site é só um leitor. Nunca escreva conteúdo de aula dentro de HTML ou JS.

## Fluxo quando o Luis manda material novo

1. Se vier áudio → transcreva e salve o texto cru em `transcricoes/AAAA-MM-DD-slug.txt`. Nunca jogue transcrição crua em `conteudo/`.
2. Crie/edite `conteudo/<slug-da-disciplina>/AAAA-MM-DD-slug-do-tema.md` seguindo o contrato abaixo.
3. Rode `npm run indexar` para regenerar `conteudo/index.json`.
4. Commit e push. A Vercel publica sozinha.

## Contrato do arquivo de aula

Frontmatter YAML simples (chave: valor, uma por linha; listas em `[a, b]`):

```markdown
---
disciplina: Pedagogia em Espaços Não Escolares
professor: Rosa Maria
data: 2026-08-05
tema: Pedagogia para além da sala de aula
tags: [espaços não escolares, EJA, educação especial]
fonte: áudio
confianca: media
---

## Resumo

Parágrafos curtos. Uma ideia por parágrafo. No máximo 5 parágrafos.

## Conceitos

- **Termo** :: definição em uma frase.

## Mapa

- Ideia central
  - Ramo
    - Detalhe

## Linha do tempo

- 1988 :: **Nome do marco** — o que mudou, em uma frase.

## Flashcards

- Pergunta? :: Resposta curta.

## Questões

1. Pergunta aberta que cai em prova.

## Para ler

- Autor, *Obra* — por que importa.

## Pendências

- O que ficou confuso no áudio e precisa de confirmação.
```

Regras de conteúdo:

- **Blocos curtos.** Luis lê melhor em pedaços pequenos. Nada de parágrafo com 8 linhas.
- **`::` é o separador** de conceito/definição, pergunta/resposta e ano/marco. Não use outro.
- **`## Linha do tempo`** é `ano :: **Marco** — detalhe`. O ` — ` (travessão com espaços) separa o título do marco do texto explicativo; sem ele, tudo vira título. Use quando o professor mostrar cronologia — o site desenha o trilho.
- **Seções são opcionais**, mas a ordem acima é fixa quando existirem.
- **`confianca`** = `alta` | `media` | `baixa`. Use `baixa` quando a transcrição estava ruim; o site mostra um aviso.
- **Nunca invente** nome de autor, obra ou conceito que não apareceu no material. Se o áudio embaralhou, escreva o palpite em `## Pendências` com um `?`.

## Comandos

```bash
npm run indexar   # regenera conteudo/index.json a partir dos .md
npm run dev       # servidor local em http://localhost:3000
```

Sem dependências. Node 18+. Não adicione framework sem o Luis pedir.

## Estilo de resposta com o Luis

Ação primeiro, passos numerados, sem preâmbulo, listas de no máximo 5 itens, um próximo passo concreto no fim.
