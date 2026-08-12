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
tratamento: Prof.ª
data: 2026-08-05
tema: Pedagogia para além da sala de aula
tags: [espaços não escolares, EJA, educação especial]
fonte: áudio
confianca: media
---

## Resumo

Parágrafos curtos. Uma ideia por parágrafo. No máximo 5 parágrafos.

## Desenvolvimento

### Subtítulo do trecho da aula

Aqui vai tudo, na ordem em que aconteceu. Parágrafos, listas, o que for.

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

- [básica] Autor, *Obra* (1979) — por que importa. [PDF na biblioteca da facul](https://...)

## Pendências

- O que ficou confuso no áudio e precisa de confirmação.
```

Regras de conteúdo:

- **O caderno não é resumo, é base viva.** A ideia é um Notion por aula: tudo o que apareceu fica registrado. `## Desenvolvimento` é onde a aula mora inteira, em `###` por trecho, na ordem em que aconteceu. **Nunca corte conteúdo para caber** — se está ficando grande, quebre em mais subtítulos.
- **`## Resumo` é a porta de entrada**, não o conteúdo. Máximo 5 parágrafos, e ele pode ser condensado à vontade porque nada se perde: o detalhe está no Desenvolvimento.
- **Aula ao vivo se escreve em camadas.** O Luis manda o material em pedaços enquanto a aula acontece; cada pedaço entra como novo `###`, e as outras seções são atualizadas depois.
- **Blocos curtos.** Luis lê melhor em pedaços pequenos. Nada de parágrafo com 8 linhas.
- **`::` é o separador** de conceito/definição, pergunta/resposta e ano/marco. Não use outro.
- **`## Linha do tempo`** é `ano :: **Marco** — detalhe`. O ` — ` (travessão com espaços) separa o título do marco do texto explicativo; sem ele, tudo vira título. Use quando o professor mostrar cronologia — o site desenha o trilho.
- **Seções são opcionais**, mas a ordem acima é fixa quando existirem.
- **`confianca`** = `alta` | `media` | `baixa`. Use `baixa` quando a transcrição estava ruim; o site mostra um aviso.
- **`tratamento`** é o `Prof.` / `Prof.ª` que aparece antes do nome. O site não deduz — sem esse campo, mostra só o nome. Nunca infira a partir do nome; se não souber, deixe vazio e pergunte.
- **Nunca invente** nome de autor, obra ou conceito que não apareceu no material. Se o áudio embaralhou, escreva o palpite em `## Pendências` com um `?`.

## Biblioteca

A página `#/biblioteca` é montada só a partir do `## Para ler` das aulas. O indexador separa `Autor`, `*Obra*` e `(ano)`, junta a mesma obra citada em aulas diferentes e agrupa por autor.

- Item **sem `*obra*`** não vira livro. Vai para "Indicações sem obra definida" — é o caso de "Fundamentos do EJA", que é assunto, não título.
- Item que é **só um nome de autor** encaixa junto das obras daquele autor, se ele já tiver alguma na lista. É correspondência exata, sem adivinhação.
- **Link é opcional**, no fim da linha, em `[rótulo](url)`. Vira botão na biblioteca.
- **`[básica]` no começo da linha** marca a bibliografia oficial da disciplina. A biblioteca separa essas obras num bloco "comece por aqui", acima do que só foi citado de passagem. Use só para o que o professor declarou como bibliografia básica — se tudo virar básica, a separação perde a função.
- **Marcar como lida** é estado do navegador, chave `lidas`, como o `estudada` das aulas. Não vai para o repositório.

Sobre o link: aponte para fonte legítima — repositório institucional, portal público, ou a assinatura de e-books da faculdade. **Nunca** cole link de cópia pirata, e nunca baixe o arquivo para dentro do repositório. Se não houver fonte legítima conhecida, deixe sem link.

## Lembretes

`conteudo/lembretes.md` — uma linha por lembrete, `AAAA-MM-DD :: texto`. Não é aula: o indexador ignora esse arquivo na contagem e joga a lista em `index.json`.

O site mostra só os que ainda não passaram, com "hoje" / "amanhã" / "em N dias" no lugar da data seca, e destaca em laranja quando é hoje ou amanhã. Lembrete vencido some sozinho — não precisa apagar à mão.

Quando o Luis disser "me lembra de X", acrescente a linha aqui **e** ofereça agendar o aviso de verdade; o arquivo sozinho só avisa quem abre o site.

## Estudo (estado no navegador)

Fica em `localStorage`, chave `estudo`: `{ "<arquivo>": { visto, estudada } }`. Nada disso vai para o repositório — é por dispositivo.

- **Continuar de onde parou** na home: a aula vista mais recentemente que ainda não foi marcada como estudada.
- **Cor por disciplina**: a matiz sai da posição em `conteudo/cores.json`, uma lista que **só cresce**. O indexador anexa disciplina nova no fim e nunca reordena o que já está lá, então nenhuma disciplina muda de cor por causa de outra. Esse arquivo é versionado — não apague nem reordene à mão, ou as cores viram outras.
- **Flashcards em blocos de 8.** Errou, a carta volta num bloco adiante — não no atual. O fim de bloco é uma parada legítima, com "Mais 8" e "Parar por hoje" lado a lado.

## Comandos

```bash
npm run indexar   # regenera conteudo/index.json a partir dos .md
npm run dev       # servidor local em http://localhost:3000
```

Sem dependências. Node 18+. Não adicione framework sem o Luis pedir.

## Estilo de resposta com o Luis

Ação primeiro, passos numerados, sem preâmbulo, listas de no máximo 5 itens, um próximo passo concreto no fim.
