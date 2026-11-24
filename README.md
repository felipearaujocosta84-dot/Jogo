# EXTREME RACING — Etapas 1 a 4

Jogo de corrida 3D para Android feito com **Babylon.js + Havok Physics + Vite + Capacitor**.
Esta etapa entrega a base jogável: física automotiva própria, a primeira pista completa,
3 a 7 adversários com IA, câmeras de terceira pessoa e cockpit, controles touch, menus,
garagem, campeonato, contra o relógio e treino.

---

## 1. Como rodar (sem saber programar)

Você precisa do **Node.js 20 ou mais novo** (https://nodejs.org → botão "LTS").

### Opção A — no computador, jogando no celular pelo Wi-Fi
1. Descompacte a pasta `EXTREME-RACING` no computador.
2. Abra um terminal dentro dela (no Windows: clique com o botão direito na pasta → "Abrir no Terminal").
3. Digite, um de cada vez:
   ```
   npm install
   npm run dev
   ```
4. O terminal mostra dois endereços, por exemplo:
   `Local: http://localhost:5173/` e `Network: http://192.168.0.15:5173/`
5. No **computador**, abra o endereço *Local* no Chrome (teclado funciona, veja os comandos abaixo).
6. No **celular** (mesma rede Wi-Fi), abra o endereço *Network* no Chrome e gire o celular para o modo horizontal.

### Opção B — direto no celular Android (Termux)
1. Instale o app **Termux** (pelo F-Droid).
2. No Termux:
   ```
   pkg install nodejs-lts unzip
   termux-setup-storage
   cp ~/storage/downloads/EXTREME-RACING.zip ~ && unzip EXTREME-RACING.zip && cd EXTREME-RACING
   npm install
   npm run dev
   ```
3. Abra `http://localhost:5173` no Chrome do celular.

### Testes automáticos da física e da IA
```
npm test
```
Simula em Node (sem navegador) suspensão, aceleração, velocidade máxima, frenagem com ABS,
curva, transferência de peso, freio de mão/drift, a geometria das 4 pistas e voltas completas
de 3 carros controlados pela IA em todas as pistas, com contagem de voltas e classificação.

### O que já foi verificado
- `npm test`: todos os testes de física, pistas, trechos especiais (vales sob as pontes, água sob as pontes da costa, túneis) e IA passam (IA no nível Difícil completa voltas nas 4 pistas sem sair das barreiras).
- Todos os arquivos passam na verificação de sintaxe e de importações (bundle com esbuild).
- Menus, garagem, configurações, pausa, HUD, controles e o carregamento das 4 pistas (com túneis, pontes e cidade) foram percorridos num Chrome automatizado, sem erros de JavaScript.
- **Ainda não testado com o Babylon.js/Havok reais rodando** (o ambiente de desenvolvimento estava sem internet para instalar os pacotes). Se aparecer erro ao abrir, copie a mensagem do console (Chrome → ⋮ → Mais ferramentas → Ferramentas do desenvolvedor) e envie para correção.

---

## 2. Gerar o APK Android (Capacitor)

Precisa do **Android Studio** instalado no computador.
```
npm install
npm run build
npx cap add android        # só na primeira vez
npx cap sync android
npx cap open android       # abre o projeto no Android Studio
```
No Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**. O APK fica em
`android/app/build/outputs/apk/debug/app-debug.apk`.

**Travar em modo horizontal:** depois do `npx cap add android`, abra
`android/app/src/main/AndroidManifest.xml` e, na tag `<activity ...>`, acrescente:
```
android:screenOrientation="sensorLandscape"
```
Sempre que alterar o código: `npm run android:sync` e gere o APK de novo.

---

## 3. Controles

| Ação | Celular | Teclado (teste no PC) |
|---|---|---|
| Acelerar | botão ACELERAR | ↑ ou W |
| Frear / ré | botão FREIO (segure parado para engatar a ré no automático) | ↓ ou S |
| Direção | volante virtual, setas ou inclinação (Configurações) | ← → ou A D |
| Freio de mão | FREIO DE MÃO | Espaço |
| Marchas (câmbio manual) | + / − | E / Q (ou Shift / Ctrl) |
| Câmera | CÂM | C |
| Pausa | II | Esc ou P |
| Reposicionar carro | RESET | R |

---

## 4. O que está implementado

**Física automotiva (src/vehicles)** — o chassi é um corpo rígido Havok com massa, centro
de massa e inércia reais; cada roda lança um raio até o solo:
- suspensão independente (mola, amortecedor com compressão/extensão diferentes, batente) e barras estabilizadoras;
- pneus com modelo Pacejka simplificado, escorregamento combinado (longitudinal + lateral), rotação de cada roda integrada de forma estável;
- transferência de peso emergente (as cargas vêm da suspensão), aderência por superfície (asfalto, zebra, grama, brita, areia, terra) e por clima;
- motor com curva de torque, RPM, freio-motor, limitador e embreagem na largada; câmbio automático e manual com tempo de troca; ré;
- diferencial autoblocante (RWD/AWD com divisão de torque), ABS, controle de tração, controle de estabilidade opcional;
- aerodinâmica: arrasto e downforce dianteiro/traseiro; derrapagem e drift com freio de mão; colisões físicas com muros e outros carros.

**Pistas (src/tracks)** — traçados fechados em escala real gerados por spline:
| Pista | Extensão | Estado na Etapa 1 |
|---|---|---|
| Grand International Circuit | 5,19 km | **completa**: arquibancadas, boxes, garagens, pit lane, torre, paddock, painéis, postes, vegetação, colinas |
| Mountain Racing | 4,54 km, 100 m de desnível | **completa (Etapa 2)**: Ponte da Ravina (arco), Túnel do Pico (340 m), Viaduto do Vale (460 m, 46 m de altura), Túnel da Serra, Desfiladeiro com paredões de rocha, pinheiros, rochas, picos nevados |
| Desert Speedway | 6,64 km | **completa (Etapa 3)**: complexo de largada (arquibancadas, boxes, torre), Cânion Vermelho de arenito, Ponte do Leito Seco, arco de pedra, oásis com lagoa e palmeiras, miragens no asfalto quente, dunas, mesas rochosas, cactos |
| Coastal Racing | 4,46 km | **completa (Etapa 2)**: Ponte da Baía (estaiada, 520 m, sobre a água), orla e praia, Centro com prédios alinhados à rua, calçadas e janelas que acendem à noite, Ponte do Canal, coqueiros, bairros ao fundo |

Dentro dos túneis a iluminação escurece, os faróis acendem e a chuva para. Pontes têm
tabuleiro, pilares até o fundo do vale e o terreno abaixo é rebaixado (vira água na costa).
Os trechos especiais aparecem coloridos no mapa da seleção de pista.

Todas têm largada/chegada com semáforo, grid, checkpoints em sequência, voltas, cronômetro,
classificação, zebras, áreas de escape, barreiras com colisão e detecção de contramão.

**IA (src/ai/RacingAI.js)** — usa a mesma física do jogador. Segue uma linha de corrida
calculada, planeja a frenagem pela curvatura (considera downforce e descidas), acelera nas
retas, ultrapassa pelo lado com mais espaço, evita bater por trás, comete erros
(esterço, frenagem tardia/antecipada, tirada de pé) e tem 4 níveis: Fácil, Médio, Difícil, Expert.

**Gráficos** — materiais PBR, pintura com verniz (clear coat), reflexos do céu na lataria,
sol dinâmico com sombras, neblina, céu atmosférico, ciclo dia/noite, faróis à noite, chuva com
pista molhada (menos aderência) e poças, **tempestade de areia** no deserto (poeira,
visibilidade baixa, menos aderência), **miragens** no asfalto quente, fumaça dos pneus, poeira fora do asfalto e
**marcas de pneu** que ficam no asfalto nas derrapagens, frenagens fortes e arrancadas. Presets
**Baixo / Médio / Alto / Ultra** com detecção automática do aparelho e resolução adaptativa
pelo FPS (no Galaxy A05s a detecção escolhe Baixo ou Médio).

**Áudio** — sintetizado em tempo real (não precisa de arquivos): motor que muda com RPM e
carga, estouros no corte, trocas de marcha, pneus, vento, colisões, chuva, ambiente por pista.

**Replay (Etapa 4)** — toda corrida é gravada (todos os carros, 30 quadros/s). No fim, ou
pela pausa, toque em **VER REPLAY**: câmeras de TV na beira da pista (com zoom), perseguição,
helicóptero e cockpit; reproduzir/pausar, 0,25x a 4x, voltar/avançar 10 s, barra de tempo e
escolha do carro acompanhado. Ao sair do replay a corrida continua de onde parou.

**Fantasma (Etapa 4)** — no Contra o Relógio e no Treino, sua melhor volta com cada carro em
cada pista fica salva no aparelho e aparece como um carro translúcido (sem colisão) a partir da
largada de cada volta. Bateu o tempo? O fantasma é substituído pela nova volta.

**Conquistas (Etapa 4)** — 14 conquistas com prêmio em créditos (primeira vitória, vencer nas
4 pistas, Expert, tempestade, campeão, 300 km/h, drift, volta limpa, vencer o fantasma,
colecionador, preparação total, 500 km…). Botão 🏆 no menu mostra progresso.

**Modos** — Corrida rápida, Campeonato (4 etapas, pontuação 25-18-15-12-10-8, prêmio),
Contra o relógio (recordes salvos, delta na tela), Treinamento (voltas livres).

**Garagem** — 6 carros, comprados com os créditos ganhos nas corridas:

| Carro | Classe | Tração | Potência | 0-100 km/h* | Máx.* |
|---|---|---|---|---|---|
| Vortex GT | Esportivo | RWD | ~450 cv | 6,1 s | ~310 km/h |
| Stratos R9 | Supercarro | RWD | ~620 cv | 4,7 s | ~355 km/h |
| Zenith HX | Hipercarro | AWD | ~920 cv | 2,6 s | ~385 km/h |
| Apex RS (novo) | Carro de pista, 1180 kg, muito downforce | RWD | ~570 cv | 4,1 s | ~300 km/h |
| Titan GT12 (novo) | Grã-turismo V12, câmbio de 8 marchas, pesado | RWD | ~780 cv | 6,5 s | ~360 km/h |
| Volt E-X (novo) | Hipercarro elétrico, uma marcha, regeneração | AWD | ~1000 cv | 2,8 s | ~320 km/h |

\* medidos na simulação física dos testes.

Melhorias de motor, freios, transmissão, suspensão, aerofólio e pneus (alteram a física);
pintura, acabamento metálico/fosco, desenho e cor dos aros.

**Setup (Etapa 3)** — aba SETUP da garagem, por carro: relação final (curta/longa),
distribuição de freio, molas e amortecedores, altura, cambagem dianteira e traseira
(melhor aderência perto de −2,5°), balanço aerodinâmico, autoblocante e pressão dos pneus.
Cada ajuste muda a física de verdade; "Restaurar padrão" volta ao original.

---

## 5. Arquivos externos (opcionais)

O jogo funciona sem nenhum arquivo externo. Os carros usam um modelo 3D **procedural**
(carroceria esculpida, cabine, faróis, lanternas, retrovisores, aerofólio, rodas com aros e
freios, interior com bancos, painel funcional e volante) até que você importe modelos GLB.

### Modelos dos carros (recomendado)
Coloque em `public/assets/cars/` com estes nomes exatos:
- `vortex.glb` (esportivo), `stratos.glb` (supercarro), `zenith.glb` (hipercarro),
  `apex.glb` (carro de pista), `titan.glb` (grã-turismo), `volt.glb` (elétrico)

Requisitos do GLB:
- escala em **metros**, frente do carro para **+Z**, rodas tocando o chão em **y = 0**, centro entre os eixos na origem;
- nós das rodas chamados `wheel_FL`, `wheel_FR`, `wheel_RL`, `wheel_RR` (cada roda separada, com o pivô no centro da roda);
- opcional: `steering_wheel` (volante), malhas `brake_light...` (lanternas), material da carroceria com nome contendo `paint` ou `body` (para a pintura da garagem funcionar);
- até ~60 mil triângulos por carro para rodar bem no celular.

Use apenas modelos com licença que permita uso em jogo (ex.: CC0 ou CC-BY com crédito, ou
modelos comprados com licença comercial). Não use modelos de marcas reais sem autorização.
Se o arquivo não existir ou estiver inválido, o modelo procedural é usado automaticamente
(o console do navegador mostra quais arquivos opcionais foram encontrados).

### Texturas fotográficas (opcional, Etapa 2)
Coloque em `public/assets/textures/` (JPG, de preferência 1024×1024 ou 2048×2048, que
se repitam sem emenda — "seamless/tileable"):
- `asphalt_albedo.jpg` — asfalto (as faixas brancas passam a ser desenhadas à parte)
- `asphalt_normal.jpg` — mapa de normais do asfalto
- `grass_albedo.jpg` — grama (áreas de escape e terreno)
- `rock_albedo.jpg` — rocha (desfiladeiro, morros dos túneis, montanhas)
- `sand_albedo.jpg` — areia (deserto e praia)

Fontes com licença livre (CC0): ambientCG.com e polyhaven.com (baixe a versão "1K JPG"
e renomeie o arquivo "Color" para o nome acima). Arquivos ausentes = textura procedural.

### Sons gravados (opcional, Etapa 4)
Sem arquivos o áudio é sintetizado. Para usar gravações reais, coloque arquivos **OGG** em
`public/assets/sounds/` com estes nomes:

| Arquivo | O que é |
|---|---|
| `engine_low.ogg` | motor em giro constante, gravado perto de **2500 rpm** (loop sem emenda) |
| `engine_high.ogg` | motor em giro constante, gravado perto de **6500 rpm** (loop) |
| `<carro>_low.ogg` / `<carro>_high.ogg` | o mesmo, só para um carro: `vortex`, `stratos`, `zenith`, `apex`, `titan`, `volt` (o elétrico só usa estes) |
| `skid.ogg`, `wind.ogg`, `rain.ogg` | pneus cantando, vento, chuva (loops) |
| `impact.ogg` | batida (som curto) |
| `amb_crowd.ogg`, `amb_forest.ogg`, `amb_wind.ogg`, `amb_ocean.ogg` | ambiente de cada pista (loops) |

O jogo ajusta o tom das gravações pelo RPM e mistura as duas faixas (baixa/alta). Use apenas
sons com licença livre (ex.: freesound.org com licença CC0) e converta para OGG.

---

## 6. Estrutura

```
EXTREME-RACING/
├── index.html, package.json, vite.config.js, capacitor.config.json
├── public/assets/{cars,tracks,textures,sounds,ui}  public/environments
├── tests/physics.test.mjs  (+ tests/sim/RigidBodySim.js)
└── src/
    ├── main.js
    ├── core/        Game, SceneManager, AssetManager, PhysicsGroups
    ├── vehicles/    Vehicle, VehiclePhysics, WheelSystem, Engine, Transmission,
    │                VehicleCatalog, CarModelFactory, VehicleEffects
    ├── cameras/     CameraController
    ├── tracks/      TrackManager, TrackGeometry, TrackBuilder, TrackMaterials,
    │                GrandCircuit, MountainRacing, DesertSpeedway, CoastalRacing,
    │                environments/ (Circuit, Mountain, Desert, Coastal)
    ├── ai/          RacingAI
    ├── race/        RaceManager, RaceSession
    ├── garage/      GarageManager, ShowroomScene
    ├── audio/       AudioManager
    ├── ui/          MainMenu, GarageUI, RaceHUD, MobileControls, SettingsUI, dom
    ├── systems/     WeatherSystem, GraphicsSettings, SaveSystem, InputManager
    ├── utils/       MathUtils
    └── styles/      main.css
```
Física, IA, pistas e regras de corrida são módulos puros (sem Babylon) e por isso podem ser
testados em Node; o Havok entra pela "ponte" em `vehicles/Vehicle.js`.

---

## 7. Próximas etapas

- ~~**Etapa 2**~~ — concluída: Mountain e Coastal completas (túneis, pontes, viaduto, desfiladeiro, baía, cidade), marcas de pneu, suporte a texturas fotográficas.
- ~~**Etapa 3**~~ — concluída: Desert Speedway completa (cânion, oásis, miragens, tempestade de areia), 3 carros novos (incluindo um elétrico) e setup completo na garagem.
- ~~**Etapa 4**~~ — concluída: replays com câmeras de TV, fantasma salvo, conquistas e suporte a sons gravados.
- **Etapa 5** — otimização final por aparelho, ícone/tela de abertura, publicação do APK/AAB.
