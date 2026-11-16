# Vale da Lanterna

Aventura em mundo aberto para celular **na horizontal** (HTML5 + canvas, sem dependências).
Kai, o garoto de cabelo branco e mochila azul, e o cachorrinho Floco precisam reacender a
Lanterna da Torre reunindo três relíquias pelo vale.

## O mundo
Um mapa contínuo de 7600 × 4500 px, todo desenhado em código (pixel art gerada, sem imagens):
campos, florestas, trilhas, rio com ponte, mar, praia, lago, clareiras, casas, torre e fazenda.

| Região | O que tem |
|---|---|
| Praça das Telhas | Praça de pedra com chafariz, Vó Aurora, Oficina do Bruno, Casa do Téo, Casa da Vó |
| Vila do Rio | Casas à beira do rio, Mel, flores-lume, Padaria da Rosa, Casa da Mel |
| Horta do Seu Tomé | Celeiro, poço, plantações cercadas e Musgos comendo as couves |
| Penhasco do Vento | Barraca, trailer e fogueira de Rui e Lina à beira do mar |
| Torre da Lanterna | Torre de pedra, ruínas, baú secreto, chefe Musgo Ancião e o final |

## Casas (interiores)
Oficina do Bruno (bancada de criação), Casa do Téo, Casa da Vó Aurora (cama: descansar e salvar),
Padaria da Rosa (loja de tortas) e Casa da Mel (baú).

## Criação de itens
Materiais: madeira (bata nas árvores), pedra e cristal (bata nas rochas), fibra (corte o capim alto),
flores e cogumelos (passe por cima), seiva (cai dos Musgos).
Receitas: Poção de Cura, Feixe de Lenha, e na bancada: Espada de Pedra, Espada de Cristal,
Armadura de Folhas, Botas de Vento e Coleira do Floco.

## Missões
Principal: A Lanterna Apagada (3 relíquias + chefe).
Extras: Ferro e Fogo, Aprendiz de Artesão, Torta de Cogumelos, Cadê a Bolinha? e Caça aos Musgos.

## Controles
- **Celular:** arraste no lado esquerdo para andar; botão redondo = atacar / falar / entrar / criar;
  Mochila = itens, criação e missões; toque no minimapa para abrir o mapa.
- **PC:** setas/WASD, Espaço/J/E (ação), I (mochila), M (mapa), Q (usar poção).

O progresso é salvo automaticamente no navegador.

## Arquivos
`core.js` (tela, áudio, sprites), `world.js` (mundo, terreno, interiores), `game.js` (lógica e interface).

## Como rodar
```bash
cd vale-da-lanterna && python3 -m http.server 8000
```
e abra `http://localhost:8000` (ou o IP do computador, pelo celular na mesma rede).
