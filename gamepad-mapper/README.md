# GAMEPAD MAPPER — Etapa 1

Aplicativo Android (Kotlin, interface nativa, tema Material escuro com azul neon) para usar controles
Bluetooth e USB OTG em jogos que só aceitam toque. Os botões e analógicos do controle viram
toques na tela, nas posições definidas pelo usuário em um editor visual.

- `minSdk 26` (Android 8.0) · `targetSdk 34` · sem bibliotecas pagas e sem internet
- APK pronto: [`apk/GamepadMapper-v1.1.0-debug.apk`](apk/GamepadMapper-v1.1.0-debug.apk) (assinado com chave de debug; instala por cima da 1.0.0 mantendo os perfis)

## Como instalar e usar

1. Instale o APK. É preciso permitir "instalar apps desconhecidos".
2. Abra **CONFIGURAÇÕES › ABRIR CONFIGURAÇÕES DE ACESSIBILIDADE** e ative **Gamepad Mapper**.
   - Android 13 ou superior: se a opção aparecer acinzentada, abra **Informações do app › ⋮ › Permitir configurações restritas**.
3. **CONECTAR CONTROLE**: pareie o controle por Bluetooth ou ligue por OTG. Depois teste os botões na tela de teste.
4. **CRIAR MAPEAMENTO**: dê um nome, vincule o jogo instalado e escolha a orientação.
   - O editor abre em tela cheia.
   - Em **FUNDO**, escolha uma captura de tela do jogo como referência.
   - Adicione, arraste e redimensione os botões e as zonas de analógico. Depois toque em **SALVAR**.
5. Abra o jogo (ou toque em **JOGAR** em *Meus jogos*). O perfil vinculado é ativado automaticamente.
6. **SELECT + START** pausa ou retoma o mapeamento a qualquer momento.

## Novidades da 1.1.0

- **Correção:** o mapeamento desligava quando aparecia uma janela flutuante sobre o jogo, como o Game Booster da Samsung, o pop-up do Play Games ou o teclado. Agora só telas de verdade (Activities) mudam o "app em primeiro plano".
- **Perfil ativo:** criar um perfil ou salvar no editor torna esse perfil o ativo.
- **Modelo Free Fire:** 16 comandos com nome. As posições são aproximadas do HUD padrão; alinhe com um print do jogo.
  - Andar: analógico esquerdo.
  - Câmera e mira: analógico direito.
  - Atirar: R2. Mira: L2.
  - A: pular. B: agachar. R3: deitar. X: recarregar. Y: pegar.
  - L1: gel. R1 e ←: armas.
  - Direcional ↑: kit médico. →: granada. ↓: mochila.
  - Select: mapa.
- **Nome por botão no editor:** por exemplo "Atirar", "Pular".
- **Diagnóstico em Configurações:**
  - teste de toque simples e mantido, em que o app toca sozinho num botão-alvo;
  - contador de botões do controle recebidos pelo serviço;
  - último app detectado;
  - mostra se o mapeamento está agindo agora.
- **Modo de compatibilidade de toque:** cada aperto vira um toque curto. Serve para aparelhos ou jogos que ignoram toques mantidos.

## Arquitetura

```
app/src/main/java/com/gamepadmapper/
├── input/      ControllerState (puro), PhysicalInput, GamepadEventParser, ControllerDetector
├── profile/    Profile/MappingElement (puro), ProfileJson (puro), ProfileRepository (arquivos JSON)
├── touch/      StickMath + TouchPlanner (puros) → GestureEngine (dispatchGesture)
├── service/    GamepadAccessibilityService, InputCaptureOverlay, MapperRuntime
├── settings/   AppSettings (SharedPreferences)
└── ui/         Main, Controller, Profiles, Editor (+EditorView), Settings, GamepadView, ProfileForm
```

Fluxo em tempo de jogo:

```
Botão  ──► AccessibilityService.onKeyEvent (filtro de teclas) ─┐
Analógico ► InputCaptureOverlay (janela focável, não tocável) ─┤
                                                               ▼
                       ControllerState ──► TouchPlanner(perfil, tela) ──► mapa id→TouchPoint
                                                               ▼
                       GestureEngine: um GestureDescription com todos os dedos,
                       StrokeDescription.continueStroke para manter/arrastar, encadeado por callback
```

- **TouchPlanner** é Kotlin puro e tem testes. Ele trata os modos dos botões: *segurar*, *toque rápido* e *alternar*.
- Para os analógicos, o TouchPlanner tem dois modos:
  - **joystick**: posição absoluta dentro do círculo.
  - **câmera/mira**: arrasto contínuo que recomeça no centro ao chegar na borda.
- Os ajustes de analógico são zona morta radial, sensibilidade por elemento e por perfil, e inversão do eixo Y.
- O direcional digital pode controlar um joystick virtual.
- **GestureEngine** respeita os limites do Android:
  - cada `dispatchGesture` cancela o gesto anterior, então todos os dedos ativos vão no mesmo gesto;
  - no máximo `getMaxStrokeCount()` dedos (10);
  - segmentos de 16 ms;
  - se o sistema cancelar o gesto, os toques são reenviados.
- **Perfis** ficam em `files/profiles/<id>.json`, com gravação atômica. Eles podem ser exportados e importados como `.gpmap.json`.

## O que depende de permissão especial / limitações reais

| Recurso | Requisito | Observações |
|---|---|---|
| Gerar toques | Serviço de acessibilidade ativado manualmente (`canPerformGestures`) | Única via sem root. Não funciona em telas seguras ou na tela de bloqueio. |
| Ler botões com o jogo aberto | Mesmo serviço (`flagRequestFilterKeyEvents`) | Funciona com o jogo em foco. |
| Ler analógicos com o jogo aberto | Janela de sobreposição focável (`TYPE_ACCESSIBILITY_OVERLAY`) | O Android **não** envia `MotionEvent` de analógico ao serviço de acessibilidade. A janela pega o foco de entrada, então o jogo perde o foco de janela. **Jogos que pausam ou ignoram a entrada sem foco não funcionarão com analógicos**; os botões continuam funcionando. Pode ser desligado nas Configurações. |
| Troca automática de perfil | Evento `TYPE_WINDOW_STATE_CHANGED` do mesmo serviço | Só o nome do pacote é lido. O conteúdo da tela não é lido. |
| Listar jogos instalados | `<queries>` para apps com ícone | Não usa `QUERY_ALL_PACKAGES`. |

Jogos que podem impedir o funcionamento:
- jogos com anti-cheat que detectam ou rejeitam toques injetados ou serviços de acessibilidade (há risco de banimento em jogos online competitivos);
- jogos que usam `FLAG_SECURE` ou telas protegidas;
- jogos que pausam ao perder o foco (afeta só os analógicos).

Não existe suporte universal. Nenhuma API pública permite isso sem root ou ADB.

## Compilar

### Android Studio (recomendado)
Abra a pasta `gamepad-mapper/` e rode `./gradlew assembleDebug` ou `./gradlew testDebugUnitTest`.
O projeto usa AGP 8.7.3, Kotlin 2.0.21 e Gradle 8.14.3 (via wrapper). O app usa apenas o framework Android, sem AndroidX.

### Sem Android Gradle Plugin (como o APK deste repositório foi gerado)
`tools/build-apk.sh` usa aapt, kotlinc, dx, zipalign e apksigner com os mesmos fontes. O APK vai para `apk/`.
`tools/run-unit-tests.sh` roda os testes JVM da lógica pura.

## Estado da Etapa 1

**Implementado e verificado aqui:**
- Compilação completa do APK. A assinatura v2/v3 foi verificada com `apksigner verify`. O manifesto e a config do serviço foram conferidos com `aapt dump`.
- 23 testes unitários passando:
  - zona morta e sensibilidade;
  - modos de botão;
  - joystick e câmera;
  - limite de 10 toques;
  - JSON dos perfis, com validação e limites de valores;
  - modelo Free Fire válido, sem botão físico repetido.
- Checagem de API: compilado também contra o `android.jar` público da API 23. Só aparecem símbolos de API 24+ (com minSdk 26) ou protegidos por `SDK_INT`, ou seja, nenhum uso de API oculta.

**Implementado, mas NÃO testado em aparelho real** (não havia emulador nem dispositivo neste ambiente):
- Telas e navegação: os quatro botões da tela inicial, *Conectar controle*, *Meus jogos*, *Editor* e *Configurações*.
- Detecção de controles e teste ao vivo dos botões e analógicos.
- Serviço de acessibilidade, captura de analógicos e geração de toques multitoque.
- Precisa de validação manual com controles Xbox, PlayStation e genéricos, e em jogos reais.

**Próximas etapas sugeridas:**
- Teste em aparelhos reais e ajuste fino de latência (`SEGMENT_MS`) e da velocidade do modo câmera.
- Controles genéricos sem keylayout (`KEYCODE_BUTTON_1..16`) aparecem no teste como "tecla não padronizada". Falta uma tela para remapear esses códigos.
- Editor direto sobre o jogo (sobreposição), em vez de usar uma captura como fundo.
- Macros e combos, botão de turbo e curva de resposta dos analógicos.
- Ajustar o layout quando a orientação ou resolução atual for diferente da salva no perfil.
- Assinatura de release própria e publicação.
