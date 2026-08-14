# Contexto — Caderno de Pedagogia do Luis

Documento para colar em outra IA. Autossuficiente: quem lê isto não precisa do repositório
para entender a situação. Atualizado em **14/08/2026**.

---

## 1. Quem é e o que precisa

Luis é estudante de **Pedagogia** na **Universidade Católica de Brasília (UCB)**,
turma **GPE08N10213**, semestre **2026/2**. Aulas presenciais, **19h às 22h**, de segunda a sexta.

Ele **tem TDAH**. Isso não é detalhe de personalidade, é requisito de projeto:

- Prefere blocos curtos. Parágrafo de 8 linhas ele não lê.
- Tela cheia de opção trava a decisão. Uma ação principal por vez.
- Contador de pendência sem caminho de resolução gera ansiedade, não motivação.
- Layout bagunçado é motivo real de abandono — ele já rejeitou três versões por isso.

Estilo de resposta que funciona com ele: **ação primeiro**, passos numerados, sem preâmbulo,
listas de no máximo 5 itens, um próximo passo concreto no fim.

## 2. O que ele construiu

Um **caderno de estudos vivo** — site estático, sem framework, sem build, publicado na Vercel.
O conteúdo é markdown; o site é só um leitor.

**A regra central:** *"não é para ser um resumo, é uma base viva com todo o conhecimento que
estou pegando na aula — imagine um Notion por aula."* Nada de cortar conteúdo para caber.
Se um arquivo está ficando grande, quebra-se em mais subtítulos, não se resume.

### Arquitetura

```
conteudo/<disciplina>/AAAA-MM-DD-tema.md   ← as aulas (a única fonte de verdade)
conteudo/index.json                        ← gerado, nunca editado à mão
conteudo/cores.json                        ← ordem das disciplinas, append-only
conteudo/{horarios,curso,lembretes,links}.md
transcricoes/                              ← texto cru de áudio, nunca vira conteúdo direto
assets/{app.js,style.css}                  ← o leitor: rotas por hash, vanilla JS
scripts/indexar.mjs                        ← npm run indexar regenera o index.json
```

Node 18+, zero dependências. `npm run dev` sobe em localhost:3000.

### Contrato de cada aula

Frontmatter YAML simples (`chave: valor`, listas em `[a, b]`):
`disciplina, professor, tratamento, data, tema, tags, fonte, confianca`.

Seções, **nesta ordem** quando existirem (todas opcionais):

`## Resumo` → `## Desenvolvimento` → `## Conceitos` → `## Mapa` → `## Linha do tempo`
→ `## Flashcards` → `## Questões` → `## Para ler` → `## Pendências`

- **`## Desenvolvimento`** é onde a aula mora inteira, em `###` por trecho, na ordem em que aconteceu.
- **`## Resumo`** é porta de entrada, no máximo 5 parágrafos. Pode condensar à vontade porque
  nada se perde — o detalhe está no Desenvolvimento.
- **`::`** é o separador universal: conceito/definição, pergunta/resposta, ano/marco.
- **Linha do tempo:** `ano :: **Marco** — detalhe`. O ` — ` (travessão com espaços) é obrigatório.
- **`confianca`** = `alta` | `media` | `baixa`. Com `baixa` o site mostra aviso.
- **`tratamento`** é o `Prof.` / `Prof.ª`. **Nunca inferir a partir do nome** — se não souber,
  deixar vazio e perguntar.
- Aula ao vivo se escreve **em camadas**: o Luis manda pedaços durante a aula, cada pedaço vira
  um `###` novo, e as outras seções são atualizadas depois.

## 3. As cinco disciplinas

| Dia | Disciplina | Professor(a) | Carga |
|---|---|---|---|
| segunda | Fundamentos da Docência | Cláudio Amorim | 80h |
| terça | História da Educação | Alessandra Moulin | 80h |
| quarta | Fundamentos Filosóficos e Sociológicos da Educação | — | 80h |
| quinta | Estágio Supervisionado Obrigatório - Espaços Não Escolares | Rosa Maria | 80h |
| sexta | Fundamentos da Educação Bilíngue | Valícia Gomes | 80h |

Fonte: declaração de matrícula da UCB emitida em 05/08/2026.

## 4. O que já está registrado (6 aulas)

| Data | Disciplina | Tema | Fonte | Confiança |
|---|---|---|---|---|
| 04/08 | História da Educação | PIBID, intencionalidade pedagógica e Ubuntu | anotação de colega (foto) | baixa |
| 06/08 | Estágio | A pedagogia para além da sala de aula | áudio (28 min) | baixa |
| 08/08 | Fund. Filosóficos | Pós-modernidade e o fim das metanarrativas | anotação em aula | média |
| 10/08 | Fundamentos da Docência | O que é educação? Leitura de mundo e educação como ato político | anotação em aula | média |
| 11/08 | História da Educação | A trajetória histórica da educação — da Antiguidade à Contemporaneidade | anotação em aula | média |
| 14/08 | Fund. Educação Bilíngue | Primeira aula — em registro | anotação em aula | média |

Total: **64 conceitos, 70 flashcards, 40 questões, ~60 min de leitura, 56 pendências abertas.**
Nenhuma aula está em confiança `alta`.

A aula mais densa é a de **11/08 (História da Educação)**: 17 blocos em Desenvolvimento,
32 conceitos, 35 flashcards, 19 questões. É a aula de referência do formato.

## 5. Avaliação (História da Educação, a única declarada até agora)

- **N1** — 4,5 pontos (1º bimestre): mapa mental individual da Unidade I (1,5)
  + atividade colaborativa em **trios**, entrega e apresentação em sala (3,0)
- **N2** — 4,5 pontos (2º bimestre): mapa mental individual da Unidade II (1,5)
  + atividade colaborativa em **duplas**, análise de fonte histórica (3,0)
- **IPI** — 1,0 ponto (Projeto Institucional)
- Aprovação direta a partir de **7,0**

Duas consequências práticas: a parte **coletiva vale o dobro da individual** (3,0 contra 1,5),
então com quem ele faz dupla e trio pesa mais que qualquer prova; e a individual é
**mapa mental nas duas vezes**, formato já conhecido.

**Nenhuma data de N1 ou N2 foi divulgada ainda.**

### Unidades de História da Educação

- **Unidade I** — Fundamentos globais e a constituição da escola: sociedades antigas,
  era medieval, modernidade, revolução industrial.
- **Unidade II** — Formação histórica brasileira (referência: **Dermeval Saviani**):
  Brasil colônia, Brasil imperial, Primeira República.
- **Unidade III** — Concepções políticas e o cenário contemporâneo: tradição e renovação,
  o controle e a crítica, a proposta transformadora, o presente.

## 6. Bibliografia registrada

**Bibliografia básica declarada** (História da Educação):

- Otaíza de O. Romanelli, *História da Educação no Brasil (1930/1973)*, 2014
- Célio da Cunha; Maria Abádia da Silva, *Pensamento Pedagógico e Políticas de Educação*, 2013
- Maria Lúcia Braga; Maria Helena Silveira, *O Programa Diversidade na Universidade e Construção
  de uma Política Educacional Anti-Racista*, 2007 (MEC/UNESCO)

**Citada de passagem:** Lyotard, *A Condição Pós-Moderna* (1979); Toffler, *O Choque do Futuro*
(1970); e outras. Dez obras no total, oito autores, mais cinco indicações sem título de obra
(assunto, não livro — ex.: "Fundamentos do EJA").

**Autores centrais mencionados nas aulas:** Paulo Freire (a professora frisou que é ícone para
uns e criticado por outros — a leitura depende da realidade), Dermeval Saviani (foco da Unidade II),
Platão (mito da caverna), Ubuntu como referência ética.

## 7. Pendências abertas — o que precisa ser resolvido

1. **Datas de N1 e N2** e das entregas colaborativas. Sem elas a agenda não funciona.
2. **O que conta como "fonte histórica"** na atividade da N2 — documento de época, legislação,
   foto, depoimento? Muda toda a preparação.
3. **Carga horária do Estágio**: a declaração diz 80h, o áudio soou como "40 horas em ambientes
   não escolares". Pode ser que 40h seja só a parte em campo.
4. **Tratamento e tema da primeira aula de Valícia Gomes** (Fund. Educação Bilíngue).
5. **Data da aula de Fundamentos Filosóficos** registrada em 08/08 — um sábado, mas a disciplina
   é de quarta. Provavelmente 05/08 ou 12/08. Não confirmado.
6. **Nome do professor de Fundamentos Filosóficos** — não registrado.
7. As 27 pendências da aula de 11/08 (termos que ficaram embolados na anotação).

## 8. Regras invioláveis

Se você for ajudar o Luis com esse material, estas não se negociam:

- **Nunca inventar** nome de autor, obra, conceito ou data que não apareceu no material.
  Palpite vai para `## Pendências` com um `?`, nunca para o corpo do texto como se fosse fato.
- **Nunca inferir tratamento** (`Prof.` / `Prof.ª`) a partir do nome de alguém.
- **Separar o que é dele do que é seu.** Material que a IA acrescentou por conta própria
  (contexto histórico, leitura adiantada) fica em bloco visualmente separado, nunca misturado
  com o que a professora falou. O caderno precisa ser confiável na véspera da prova.
- **O repositório é público.** Nada de telefone, endereço ou dado pessoal de terceiro —
  fica indexado e permanente no histórico do git. E-mail institucional só com pedido explícito.
- **Nunca link de cópia pirata** de livro, e nunca baixar o arquivo para dentro do repositório.
  Só repositório institucional, portal público ou a assinatura de e-books da faculdade.
  Sem fonte legítima conhecida, fica sem link.
- **Nunca resumir para caber.** Se está grande, quebra em mais subtítulos.

## 9. Decisões já tomadas (não reabrir sem ele pedir)

- **Flashcards**: ele não gostou do formato. Parados, "trabalhamos depois".
- **Supabase**: "futuramente", não agora.
- **Sem framework.** Não adicionar dependência sem ele pedir.
- **Cores por disciplina** saem da posição em `cores.json`, lista que só cresce e nunca é
  reordenada — senão as disciplinas trocam de cor entre si.
- **Layout**: já rejeitou capa/banner, três colunas e painel de oito módulos. A versão atual é
  home em três níveis, sem capa.
