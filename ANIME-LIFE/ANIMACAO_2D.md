# Animação 2D dos personagens

Os personagens continuam sendo **as ilustrações originais**. Nada foi redesenhado.
A animação é feita por um shader (`src/animation/livingShader.js`) que **desloca levemente os próprios pixels** da ilustração. É a mesma ideia de ferramentas como o Live2D, em versão simplificada.
O único elemento acrescentado por cima do desenho é o rubor: um brilho rosado translúcido nas bochechas.

## O que já funciona com as imagens atuais

| Animação | Como é feita |
|---|---|
| Piscar natural | Compressão rápida e suave da região de cada olho, em intervalo aleatório e às vezes duplo. Não pisca no susto e pisca mais quando a personagem está envergonhada. |
| Boca durante a fala | O traço da boca é esticado verticalmente no ritmo das vogais do texto (a, e, i, o, u). Ela fecha nas pausas e no fim da fala. |
| Cabeça | Micro-movimentos, aceno leve ao falar e inclinação conforme a emoção (para baixo na tristeza, para o lado na vergonha). |
| Respiração | O tronco sobe e desce devagar. O ritmo muda com a emoção: mais rápido na surpresa e na raiva, mais lento na tristeza. |
| Cabelo | As mechas medidas em cada ilustração ondulam, com mais movimento nas pontas e uma "rajada" quando a emoção muda bruscamente. |
| Corpo | Pulinho de alegria, sobressalto, tremor de raiva, encolher de vergonha e balanço apaixonado. |
| Expressões | Neutro, feliz, triste, envergonhado, surpreso, irritado e apaixonado, mais tímido, decepcionado, desviando o olhar, curioso e sério. Cada uma combina olhos semicerrados ou arregalados, rubor, cabeça, respiração e um balão (♪ ! ? 💢 💧 ♡ ///). |
| Entrar e sair de cena | Desliza do lado, sobe e aparece. Ao sair, desce, desliza para fora e some. |

As expressões acompanham as falas sozinhas. Se o roteiro não definir a emoção, ela é deduzida do texto em `src/cinematic/Emotions.js`. Exemplos:
- "Eu estava com saudades de você." → tímido
- "Por que você fez isso comigo?" → decepção
- "Você está falando sério?" → surpresa

## Câmera cinematográfica 2D
O diretor em `src/cinematic/Director.js` escolhe o plano de cada fala:
- **aberto:** no começo da cena;
- **meio corpo:** na conversa normal;
- **close no rosto:** em perguntas e emoções fortes;
- **close extremo:** em revelações;
- **dois personagens** e **por cima do ombro:** o outro aparece desfocado em primeiro plano;
- **lateral:** com movimento horizontal lento.

A câmera faz uma aproximação lenta durante as falas importantes, corta seco quando a vez de falar muda de pessoa e se move suave quando a mesma pessoa continua.
O roteiro pode forçar um plano com `cam: 'close'` ou marcar uma revelação com `big: true`.

## Medidas de cada personagem (`src/characters/characters.json` → `rig`)
- **Valores:** porcentagem da largura e da altura de `full.webp`.
- **`eyes`:** `[cx, cy, largura, altura]` de cada olho visível. O Kyo tem um só, porque o outro está coberto pelo cabelo.
- **`mouth`:** `[cx, cy, largura]`.
- **`hair`:** até 3 zonas `[x0, y0, x1, y1, força]` de mechas que balançam.
- **`face`:** centro do rosto, usado pela câmera.

Para animar outro personagem, basta medir esses pontos (veja como no histórico do commit). Sem `rig`, o personagem aparece como ilustração estática.

## Imagens que deixariam a animação perfeita (pedido de recursos)
Com uma única ilustração por personagem existem limites que não dá para contornar sem novas imagens:
- **O piscar fecha o olho até ~40%, não 100%.** Um olho totalmente fechado precisa da pálpebra desenhada, e essa parte não existe na ilustração. Tentei gerar uma pálpebra artificialmente, mas ela ficava com recortes visíveis no close-up, então descartei.
- **A boca abre pouco.** Ela se forma a partir do traço existente; uma boca bem aberta, mostrando o interior, precisa ser desenhada.
- **O cabelo ondula junto com o que está atrás dele.** As mechas não estão separadas do corpo na imagem.

Se um artista desenhar estas **camadas a partir da ilustração original** (mesmo tamanho de `full.webp`, fundo transparente, só a parte que muda), o jogo passa a usá-las automaticamente:

| Arquivo (na pasta do personagem) | Conteúdo | Registro em `characters.json` |
|---|---|---|
| `layers/eyes_closed.webp` | Só os olhos fechados (pálpebras e cílios) | `"layers": { "eyesClosed": "layers/eyes_closed.webp" }` |
| `layers/mouth_open.webp` | Só a boca aberta (vogal "a") | `"layers": { "mouthOpen": "layers/mouth_open.webp" }` |
| `expressions/<emoção>.webp` | A ilustração inteira com outra expressão (happy, sad, angry, surprised, embarrassed, love) | `"expressions": { "happy": "expressions/happy.webp" }` |

O código para essas camadas está pronto (mistura no shader, alinhada à ilustração), mas **ainda não foi testado com arte real**, porque ela não existe.

## Desempenho (Android)
- **Custo:** um shader por personagem em cena (no máximo 2 ou 3) e nenhum arquivo extra para baixar.
- **Ajustes → Animação dos personagens:** *Completa*, *Leve* (sem cabelo) ou *Desligada*.
- **Sem WebGL:** o jogo volta sozinho para as ilustrações estáticas.
