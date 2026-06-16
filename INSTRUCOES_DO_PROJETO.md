# Instruções do Projeto - Guia Gramado 2026

Este documento serve para futuras alterações no guia da viagem, evitando precisar explicar tudo de novo em uma nova conversa.

## Dados principais

- Pasta local do projeto: `C:\Users\Felipe\OneDrive\Documentos\VIAGEM GRAMADO`
- Arquivo principal do site: `index.html`
- Repositório GitHub: `https://github.com/ofelipedosanuncios/viagem-gramado-2026`
- Site publicado: `https://ofelipedosanuncios.github.io/viagem-gramado-2026/`
- Publicação: GitHub Pages, branch `main`, pasta `/ (root)`

## Como pedir alterações ao Codex

Não cole o HTML inteiro na conversa. Peça as mudanças em lista, de preferência em lote.

Exemplo:

```text
Projeto: Guia Gramado 2026
Arquivo principal: index.html

Quero ajustar:
1. Trocar o horário do Snowland para 11h.
2. Remover Aldeia do Papai Noel do Dia 2.
3. Colocar Café Colonial Bela Vista no Dia 5.
4. Atualizar o preço da Hector para adulto R$ X e criança R$ Y.

Depois me diga quais arquivos foram alterados e como publicar.
```

## Onde mexer no `index.html`

O site é um HTML único, com CSS, conteúdo e JavaScript no mesmo arquivo.

Seções visuais da página:

- `section id="viagem"`: visão geral da viagem, famílias, voos, clima.
- `section id="roteiro"`: área onde os dias do roteiro são renderizados.
- `section id="mapa"`: comparador de distância entre locais.
- `section id="opcoes"`: atrações opcionais/plano B.
- `section id="decisoes"`: decisões confirmadas e pendentes.
- `section id="orcamento"`: orçamento calculado por família.
- `section id="checklist"`: mala, documentos e dia de viagem.
- `section id="pendencias"`: itens que ainda faltam fechar.

Blocos de dados principais:

- `const PLACES`: cadastro dos locais, atrações, restaurantes, endereços, contatos, preços, dicas e textos do modal.
- `const DAYS`: programação dia a dia da viagem.
- `const SWAPS`: lista de atrações que aparecem em "Opções / Plano B".
- `const TRAVELERS`: pessoas e idades usadas no cálculo de orçamento.
- `const MAPPTS`: pontos usados no mapa/distâncias.

## Regras para manter o site fácil de atualizar

- Manter tudo em `index.html` por enquanto.
- Não separar CSS ou JavaScript em outros arquivos sem necessidade.
- Manter codificação UTF-8.
- Ao alterar preços, revisar também o orçamento exibido na seção "Orçamento".
- Ao adicionar local novo que deve aparecer em distância/mapa, atualizar `PLACES` e `MAPPTS`.
- Ao adicionar local novo no roteiro, cadastrar primeiro em `PLACES` e depois usar o identificador dele em `DAYS`.
- Ao mexer em datas/horários, revisar também textos de decisões e pendências se eles mencionarem a mesma informação.

## Como publicar uma alteração

Fluxo simples:

1. Codex altera o arquivo local `index.html`.
2. Conferir o resultado localmente quando possível.
3. Entrar no repositório do GitHub.
4. Substituir/enviar o `index.html` atualizado.
5. Fazer commit no GitHub.
6. Aguardar o GitHub Pages atualizar o site.

Normalmente o link publicado continua o mesmo:

`https://ofelipedosanuncios.github.io/viagem-gramado-2026/`

## Observações técnicas

- A pasta `.git` local pode estar bloqueada pelo ambiente do Windows/Codex, então o envio automático por Git pode falhar.
- Se existir uma pasta `.gitpub`, ela veio de uma tentativa temporária de envio e não faz parte do site publicado.
- O conteúdo publicado no GitHub Pages depende apenas dos arquivos enviados ao repositório, principalmente `index.html`.
