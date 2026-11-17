# Vale da Lanterna

Aventura em mundo aberto para celular **na horizontal** (HTML5 + canvas, sem dependências).
Kai, o garoto de cabelo branco e mochila azul, e o cachorrinho Floco precisam reacender a
Lanterna da Torre reunindo três relíquias pelo vale.

## O mundo (infinito)
O Vale da Lanterna (7600 × 4500 px, feito à mão) é a região inicial. Em volta dele o mundo é
**gerado sem fim**, em pedaços de 512 px, conforme você anda — tudo em pixel art gerada por código.

- **Biomas:** Campos Abertos, Mata Fechada, Floresta Outonal, Deserto de Âmbar (cactos, palmeiras,
  oásis), Tundra Gelada (lagos congelados, pinheiros com neve), Pântano Sombrio e Bosque das Cerejeiras.
  Cada um tem chão, árvores, rochas, clima (neve, areia, folhas, pétalas, vaga-lumes) e Musgos próprios.
  Quanto mais longe do Vale, mais fortes os Musgos e mais moedas eles deixam.
- **Cidades grandes:** a cada 9000 px há uma cidade com muralha e portões, ruas de pedra em grade,
  praça com chafariz, dezenas de casas no estilo do bioma, feiras, parques, torre do relógio e moradores
  andando pelas ruas. Toda cidade tem **Mercado** (compra de comida e materiais), **Estalagem**
  (descansar e ouvir boatos), **Ferreiro** (bancada livre para criar equipamentos) e casas para visitar.
- **Estradas** ligam todas as cidades e saem do Vale pelos quatro lados.

## Personagens em 3D
Kai e Floco são modelos 3D (three.js, em `lib/`) com animação de andar, ataque com a espada e
equipamentos visíveis. Eles são renderizados em baixa resolução, com contorno, pela mesma câmera
de cima do jogo, para combinar com a pixel art. Sem WebGL, o jogo volta aos sprites 2D.

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
Extras: Ferro e Fogo, Aprendiz de Artesão, Torta de Cogumelos, Cadê a Bolinha?, Caça aos Musgos e Grande Viajante (visite 3 cidades).

## Controles
- **Celular:** arraste no lado esquerdo para andar; botão redondo = atacar / falar / entrar / criar;
  Mochila = itens, criação e missões; toque no minimapa para abrir o mapa.
- **PC:** setas/WASD, Espaço/J/E (ação), I (mochila), M (mapa), Q (usar poção).

O progresso é salvo automaticamente no navegador.

## Arquivos
`core.js` (tela, áudio, sprites), `world.js` (o Vale, terreno, interiores), `infinite.js` (mundo infinito, biomas, cidades), `char3d.js` (Kai e Floco em 3D), `game.js` (lógica e interface), `lib/three.min.js` (three.js r128, licença MIT).

## Como rodar
```bash
cd vale-da-lanterna && python3 -m http.server 8000
```
e abra `http://localhost:8000` (ou o IP do computador, pelo celular na mesma rede).
