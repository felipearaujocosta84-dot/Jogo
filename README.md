# PS5 Launcher

Um launcher Android de verdade (tela inicial do celular) com visual inspirado no dashboard de consoles:
fundo azul-escuro animado, cartões grandes com capas, botão "Jogar", central de controle e suporte a controle Bluetooth.

> Projeto pessoal, sem ligação com a Sony. O ícone, os sons e os gráficos foram criados para este projeto.
> Se um dia quiser publicar na Play Store, troque o nome "PS5" (é marca registrada).

---

## 1. O que já funciona (versão 1.0)

| Sistema | Como funciona |
|---|---|
| Tela inicial padrão | O app se registra como "Tela inicial" do Android. Na primeira abertura ele pergunta se você quer usá-lo. |
| Dashboard | Abas **Jogos** e **Mídia**, fileira de cartões, o cartão selecionado cresce e mostra o nome, arte grande ao fundo, botão **Jogar**. |
| Jogos instalados | Detectados pela categoria "Jogo" que cada app informa ao Android. Os mais recentes aparecem primeiro. |
| Capas | O Android não fornece capas de jogos. Por padrão o cartão usa o ícone sobre a cor do jogo. Você pode escolher uma **capa da galeria** para cada jogo (toque e segure > Escolher capa). |
| Abrir jogos | Toque num cartão para selecionar, toque de novo (ou em **Jogar**) para abrir. |
| Biblioteca | Todos os apps, com busca e filtros (Todos, Jogos, Mídia, Ocultos). |
| Perfil | Nome, avatar (foto da galeria), estatísticas e jogos recentes. |
| Central de controle | Hora, data, bateria, lanterna, volume, brilho, atalhos para Wi-Fi, Internet, Bluetooth, modo avião, tela e bateria. |
| Configurações | Cor de destaque, fundo animado, tela cheia, orientação, sons, tela inicial padrão. |
| Relógio e bateria | No canto superior, atualizados pelo próprio Android. |
| Sons e transições | Sons originais ao navegar, abrir e voltar; som de abertura; animações entre telas. |
| Controle Bluetooth | Direcional/analógico movem a seleção. Veja os botões abaixo. |

### Botões do controle

| Botão | Ação |
|---|---|
| A / Cruz | Confirmar / abrir |
| B / Círculo | Voltar |
| X / Quadrado | Opções do app selecionado |
| Y / Triângulo | Biblioteca |
| L1 / R1 | Trocar entre Jogos e Mídia |
| Start / Options | Central de controle |
| Select / Share | Configurações |

### O que o Android NÃO permite (e por isso não é simulado)

- Ligar/desligar Wi-Fi, Bluetooth e modo avião direto pelo launcher: o botão abre o painel oficial do Android.
- Ajustar o brilho sem permissão: na primeira vez, a Central de Controle mostra o botão **Permitir ajuste de brilho**.
- Baixar capas oficiais automaticamente: você escolhe as imagens da galeria.
- Apagar ou alterar apps: o launcher só lê nome, ícone e categoria. "Ocultar" apenas esconde o app do launcher.

### Permissões

| Permissão | Para quê | Obrigatória? |
|---|---|---|
| Ver apps que aparecem na gaveta de apps | Listar seus jogos e apps | Sim (automática) |
| Modificar configurações do sistema | Controle de brilho | Não, só se você ativar |

Fotos de avatar e capas usam o seletor de fotos do Android, que não exige permissão de armazenamento.
Não precisa de root.

---

## 2. Como gerar o APK

Escolha **uma** das opções.

### Opção A: pelo GitHub (não precisa de computador potente; dá para fazer quase tudo pelo celular)

1. Crie uma conta grátis em https://github.com.
2. Crie um repositório novo (botão **New**), por exemplo `PS5Launcher`. Pode ser privado.
3. Envie todos os arquivos desta pasta para o repositório (no computador: **Add file > Upload files** e arraste o conteúdo da pasta; mantenha as subpastas, inclusive a pasta oculta `.github`).
4. Abra a aba **Actions**. O processo "Gerar APK" começa sozinho e leva cerca de 5 a 8 minutos.
5. Quando ficar verde, abra a página **Releases** do repositório e baixe `PS5Launcher.apk` pelo celular.

Se a pasta `.github` não for enviada pelo navegador, crie o arquivo manualmente em
**Add file > Create new file**, com o nome `.github/workflows/gerar-apk.yml`, e cole o conteúdo do arquivo de mesmo nome deste projeto.

### Opção B: pelo Android Studio (computador)

1. Instale o Android Studio: https://developer.android.com/studio
2. **File > Open** e escolha a pasta `PS5Launcher`. Espere a sincronização terminar (a primeira vez baixa vários arquivos).
3. Menu **Build > Build App Bundle(s) / APK(s) > Build APK(s)**.
4. O APK fica em `app/build/outputs/apk/debug/app-debug.apk`. Para a versão otimizada (menor e mais leve), use o terminal do Android Studio: `./gradlew assembleRelease` e pegue `app/build/outputs/apk/release/app-release.apk`.

---

## 3. Instalar e usar como tela inicial

1. Abra o arquivo `PS5Launcher.apk` no celular.
2. Se o Android avisar sobre "fontes desconhecidas", permita a instalação para o navegador ou gerenciador de arquivos usado.
3. Abra o **PS5 Launcher**, digite seu nome e toque em **Definir agora**.
4. Escolha **PS5 Launcher** como tela inicial.

Para voltar ao launcher original: **Configurações do Android > Apps > Apps padrão > Tela inicial** (no Samsung: **Apps > Escolher apps padrão > Tela inicial**) e escolha o anterior. Nada no celular é apagado.

### Primeiros passos

- Se um jogo não aparecer em **Jogos**, abra a **Biblioteca**, toque e segure no app e escolha **Marcar como jogo**.
- Para deixar a tela com cara de console, escolha capas: toque e segure no jogo > **Escolher capa da galeria**. Imagens horizontais ou quadradas ficam melhores.
- Em celulares mais simples, se sentir lentidão, desligue **Fundo animado** nas Configurações.

---

## 4. Como o projeto está organizado

```
PS5Launcher/
├── .github/workflows/gerar-apk.yml   → receita que o GitHub usa para gerar o APK
├── keystore/ps5launcher.jks          → "assinatura" do app (permite atualizar sem desinstalar)
├── build.gradle.kts / settings.gradle.kts / gradle/ → configuração de compilação
└── app/
    ├── build.gradle.kts              → versões do app e bibliotecas usadas
    └── src/main/
        ├── AndroidManifest.xml       → registra o app como "Tela inicial"
        ├── res/                      → ícone, cores, sons (raw/) e textos
        └── java/com/ps5launcher/
            ├── MainActivity.kt       → a tela do launcher + botões do controle
            ├── LauncherApplication.kt→ cria as peças principais ao iniciar
            ├── data/
            │   ├── AppRepository.kt  → lê os apps instalados, ícones e cores; abre os apps
            │   ├── SettingsRepository.kt → salva preferências, capas e histórico
            │   └── ImageStore.kt     → guarda cópias das imagens escolhidas
            ├── system/
            │   ├── SoundManager.kt   → efeitos sonoros
            │   └── SystemControls.kt → tela inicial padrão, volume, brilho, lanterna, painéis
            └── ui/
                ├── LauncherViewModel.kt → "cérebro": tela atual, seleção, ações
                ├── LauncherRoot.kt   → junta fundo, telas e central de controle
                ├── theme/Theme.kt    → cores e tema
                ├── components/       → fundo animado, botões, relógio, bateria, avatar
                └── screens/          → Início, Biblioteca, Perfil, Configurações,
                                        Central de Controle, Boas-vindas, Opções do app
```

### Sobre a assinatura (keystore)

A pasta `keystore` contém a chave que assina o APK (senha `ps5launcher123`). Ela existe para que cada nova
versão instale por cima da anterior, sem perder suas configurações. Como é um projeto pessoal, ela fica junto
do código. Se um dia for publicar o app, gere uma chave nova e guarde a senha em segredo.

### Requisitos técnicos

- Android 8.0 ou superior (minSdk 26), alvo Android 15 (targetSdk 35)
- Kotlin 2.0, Jetpack Compose (Material 3), Gradle 8.9, Android Gradle Plugin 8.7
