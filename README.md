# Sorteio OSEC

Sorteio por categorias com roleta animada: três nomes rolando para cima ao mesmo tempo,
e quem para na faixa do meio é o sorteado.

**Online:** https://feralog.github.io/Sorteio-OSEC/

## Categorias

| Categoria | Participantes |
|---|---|
| Jalecos Conforto | 23 |
| Pathway | 15 |
| Geny Jalecos | 13 |
| Acesso Total | 9 |
| Caixa de Brigadeiro | 12 |

## Como funciona

- O ganhador é escolhido **antes** da animação com `crypto.getRandomValues()` (sem viés de
  módulo) e a faixa é montada já com ele na linha do meio — a animação apenas revela o
  resultado, não o produz.
- A roleta acelera por ~0,7 s, passa ~67 nomes a ~42 nomes/s no pico e desacelera até
  parar, com duração sorteada entre 5,2 s e 6,1 s a cada rodada.
- Cada categoria guarda no navegador (`localStorage`) quem já saiu. A opção
  *"não repetir"* vem ligada — útil para categorias com mais de um prêmio.
- A lista de participantes é editável em lote na própria página (veja abaixo).
- Atalho: <kbd>Espaço</kbd> sorteia.

## Estrutura

```
index.html                 página inicial com as categorias
<categoria>.html           uma subpágina por categoria
assets/dados.js            nomes e prêmios (gerado a partir da planilha)
assets/sorteio.js          motor da roleta
assets/estilo.css          estilo compartilhado
```

Site estático puro — sem dependências externas, sem build. Basta abrir o `index.html`.

## Atualizar a lista de nomes

### Na hora, pelo site (edição em lote)

Na página da categoria, no painel **Participantes**, clique em **Editar lista**: a caixa
com os nomes vira um campo de texto com um nome por linha, já todo selecionado. É só
<kbd>Ctrl</kbd>+<kbd>A</kbd> e colar a lista nova por cima, depois **Salvar lista**
(<kbd>Ctrl</kbd>+<kbd>Enter</kbd> também salva, <kbd>Esc</kbd> fecha).

- Linhas vazias, espaços sobrando, marcadores (`-`, `1.`) e nomes repetidos são descartados.
- Também aceita nomes separados por `;` ou por vírgula quando vêm tudo numa linha só.
- A lista editada fica **só naquele navegador** (`localStorage`), por categoria, e vale para
  o sorteio, para as contagens e para a página inicial. **Restaurar original** volta para o
  que está em `dados.js`.
- Os resultados já sorteados continuam salvos; quem saiu mas não está mais na lista aparece
  marcado como *fora da lista* no painel **Sorteados**.

### De forma permanente, no código

Edite `assets/dados.js`. Cada categoria tem `slug`, `nome`, `icone`, `cor`, `premios[]` e
`nomes[]`. Para acrescentar uma categoria nova, copie um dos arquivos `<categoria>.html`,
troque o slug na última linha e adicione o bloco correspondente em `dados.js`.
