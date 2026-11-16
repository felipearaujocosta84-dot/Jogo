# Vale da Lanterna

Aventura para celular (HTML5 + canvas, sem dependências) feita com as ilustrações enviadas.
Kai, o garoto de cabelo branco e mochila azul, e o cachorrinho Floco precisam reacender a
Lanterna da Torre reunindo três relíquias pelo vale.

## Cenários (as imagens em `assets/`)
| Cenário | Imagem | O que acontece |
|---|---|---|
| Praça das Telhas | `praca.jpg` | Vó Aurora dá a missão e cura o Kai |
| Vila do Rio | `vila.jpg` | Junte 5 flores-lume para a Mel → **Pétala Solar** |
| Horta do Seu Tomé | `horta.jpg` | Espante 5 Musgos → **Orvalho do Poço** |
| Penhasco do Vento | `penhasco.jpg` | Ache 4 gravetos para Rui e Lina (os campistas da fogueira) → **Brasa Eterna** |
| Torre da Lanterna | `torre.jpg` | Baú secreto (+1 coração), chefe **Musgo Ancião** e o final |

## Controles
- **Celular:** arraste o dedo no lado esquerdo para andar; botão redondo = atacar (vira "Falar/Abrir/Porta" perto de alguém).
- **PC:** setas/WASD para andar, Espaço/J/E para atacar ou interagir, M liga/desliga o som.

O progresso é salvo automaticamente no navegador.

## Como rodar
Abra `index.html` por um servidor qualquer, por exemplo:
```bash
cd vale-da-lanterna && python3 -m http.server 8000
```
e acesse `http://localhost:8000` (ou o IP do computador, pelo celular na mesma rede).
