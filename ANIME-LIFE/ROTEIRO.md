# ANIME LIFE — Plano dos 350 capítulos

Este arquivo registra o **progresso real** da produção. O jogo mostra o mesmo status no painel **📚 Capítulos**.

## Estrutura
- **350 capítulos = 10 volumes × 35 capítulos.** Arcos de cada volume: `src/story/plan/volumes.js`.
  - O plano anterior (3.000 capítulos em 30 volumes) foi reduzido a pedido. Os 30 arcos foram condensados nos 10 volumes, e nada do que já estava escrito se perdeu.
- **Fases dentro de cada volume:**

  | Capítulos | Fase |
  |---|---|
  | 1–4 | Abertura |
  | 5–10 | Desenvolvimento |
  | 11–17 | Complicação |
  | 18–24 | Virada |
  | 25–31 | Crise |
  | 32–35 | Desfecho |

- **Catálogo:** `src/story/catalog.js` gera as 350 entradas, cada uma com número, volume, título, sinopse e status.
- **Desbloqueio:** o Capítulo 1 começa aberto, e cada capítulo abre quando o anterior é concluído. Capítulos concluídos podem ser revistos sem alterar o jogo salvo.

## Status de produção

| Status | Significado | Quantidade |
|---|---|---|
| **escrito** | Roteiro completo, jogável: cenas, diálogos, escolhas, consequências e gancho para o próximo capítulo | **6** |
| **roteirizado** | Título e sinopse definidos; o roteiro ainda não foi escrito | **344** (todos os capítulos de 7 a 350) |
| **planejado** | Só a posição no arco do volume | **0** |

### Capítulos escritos

| Nº | Título | Cenas | Passos de roteiro | Caminhos verificados |
|---|---|---|---|---|
| 1 | Apartamento 201 | 5 | 402 | ✔ |
| 2 | Cartões-postais de Kamakura | 5 | 381 | ✔ |
| 3 | O Bilhete que Kyo Guardou | 4 | 192 | ✔ |
| 4 | Revelação | 4 | 294 | ✔ |
| 5 | Domingo de Bicicleta | 4 | 184 | ✔ |
| 6 | Sexta-feira | 4 | 229 | ✔ |

O verificador (`node tools/story-check.mjs`) percorre todos os caminhos de escolha: hoje são 49.881 caminhos de cena, sem rótulo quebrado nem beco sem saída.

## Como os lotes são escritos
1. **Sinopses:** ✔ concluídas para os 350 capítulos, em `plan/vol01.js` a `plan/vol10.js`.
2. **Roteiro:** de 3 a 5 capítulos por lote, em `chapters/chN.js`, com:
   - 4 ou 5 cenas;
   - escolhas que dependem de decisões anteriores;
   - flags e memórias que serão usadas mais tarde;
   - gancho final.
3. **Registro:** acrescentar o capítulo a `chapters/index.js`. Ele passa a *escrito* sozinho no catálogo.
4. **Verificação:** rodar `npm test`, que percorre todos os caminhos e joga as cenas no navegador.

## Próximo lote
Capítulos 7 a 10 do Volume 1:
- A Exposição que Não Aconteceu
- Apagão
- O Nome no Verso
- Seguindo Pistas

Ganchos em aberto que esses capítulos precisam resolver:
- os números escondidos nos postais (Cap. 6);
- `c6.pedido` (aceitou, condição ou recusou o pedido do Sora);
- `c6.akane_olhar` ("você tem os olhos d—");
- `kyo.sabe_sora`;
- `kaito.ajuda` / `kaito.ideia` (Entregas Hayami);
- `c4.envelope_guardado` (o envelope "Para A." ainda não entregue);
- `mei.autoriza_sora`;
- `lado`, `promessa.sora`.

## Escala (estimativa honesta)
Um capítulo completo tem de 150 a 400 passos de roteiro. Os 350 capítulos somariam entre 50 mil e 140 mil passos. Em lotes de 3 a 5 capítulos, são cerca de 70 a 115 lotes.
