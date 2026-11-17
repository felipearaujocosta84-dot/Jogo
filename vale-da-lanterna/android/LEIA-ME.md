# Vale da Lanterna — app Android (APK)

App nativo e leve que roda o jogo num WebView em tela cheia, deitado, com a tela sempre acesa e **offline**
(os arquivos do jogo e a fonte Pixelify Sans vão dentro do APK). Android 6.0 ou mais novo (alvo: Android 14).

- **Voltar** do Android: fecha o celular do jogo, o menu, o mapa ou a construção; com nada aberto, salva e sai.
- O jogo salva ao ir para segundo plano. O progresso fica no armazenamento do app (desinstalar apaga o progresso).

## Gerar o APK
```
sudo apt-get install aapt apksigner dalvik-exchange zipalign android-sdk-platform-23 openjdk-17-jdk
./build-apk.sh                          # → dist/vale-da-lanterna.apk
VERSION_CODE=2 VERSION_NAME=1.1 ./build-apk.sh   # próximas versões
```
A assinatura usa `keystore/vale-da-lanterna.jks` (senha padrão `valedalanterna`, troque com `KS_PASS=`).
**Guarde essa chave** (ela não vai para o Git): atualizações precisam da mesma chave para instalar por cima sem
perder o progresso. Para usar uma chave guardada: `KEYSTORE=/caminho/chave.jks KS_PASS=... ./build-apk.sh`.

Arquivos: `AndroidManifest.xml`, `src/.../MainActivity.java`, `res/mipmap-*/ic_launcher.png` (ícone), `fonts/` (OFL).
