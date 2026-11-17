#!/usr/bin/env bash
# Gera o APK do Vale da Lanterna (Android 6+), sem Android Studio:
#   aapt (recursos) → javac + dx (código) → zipalign → apksigner (assinatura v1+v2+v3).
# Ferramentas (Ubuntu/Debian): sudo apt-get install aapt apksigner dalvik-exchange zipalign android-sdk-platform-23 openjdk-17-jdk
# Uso: ./build-apk.sh            → dist/vale-da-lanterna.apk
#      VERSION_CODE=2 VERSION_NAME=1.1 ./build-apk.sh
# Assinatura: usa a chave em $KEYSTORE (padrão keystore/vale-da-lanterna.jks). Se não existir, cria uma nova.
# Guarde essa chave: atualizações do app precisam ser assinadas com a MESMA chave, senão o Android pede para
# desinstalar (e desinstalar apaga o progresso salvo no celular).
set -euo pipefail
cd "$(dirname "$0")"
GAME=..
ANDROID_JAR=$(ls /usr/lib/android-sdk/platforms/*/android.jar | sort | tail -1)
VERSION_CODE=${VERSION_CODE:-1}
VERSION_NAME=${VERSION_NAME:-1.0}
KEYSTORE=${KEYSTORE:-keystore/vale-da-lanterna.jks}
KS_PASS=${KS_PASS:-valedalanterna}
OUT=dist/vale-da-lanterna.apk

rm -rf build && mkdir -p build/assets/www/fonts build/classes dist
# jogo (só os arquivos que o index.html usa) + fontes locais (funciona offline)
cp "$GAME"/*.js build/assets/www/
cp -r "$GAME"/lib build/assets/www/
cp fonts/*.woff2 build/assets/www/fonts/
python3 - "$GAME/index.html" build/assets/www/index.html <<'PY'
import re, sys
s = open(sys.argv[1], encoding='utf-8').read()
s = re.sub(r'\s*<link rel="preconnect"[^>]*>', '', s)
s = re.sub(r'\s*<link href="https://fonts.googleapis.com[^>]*>', '', s)
faces = ''.join("  @font-face { font-family: 'Pixelify Sans'; font-weight: %d; font-display: swap; src: url('fonts/pixelify-sans-latin-%d-normal.woff2') format('woff2'); }\n" % (w, w) for w in (400, 600, 700))
s = s.replace('<style>\n', '<style>\n' + faces, 1)
open(sys.argv[2], 'w', encoding='utf-8').write(s)
PY
# recursos e manifesto
aapt package -f -M AndroidManifest.xml -S res -A build/assets -I "$ANDROID_JAR" -F build/app-unsigned.apk \
  --min-sdk-version 23 --target-sdk-version 34 --version-code "$VERSION_CODE" --version-name "$VERSION_NAME"
# código Java → dex
javac -nowarn -Xlint:-options -source 8 -target 8 -bootclasspath "$ANDROID_JAR" -d build/classes $(find src -name '*.java')
dalvik-exchange --dex --output=build/classes.dex build/classes
(cd build && aapt add -k app-unsigned.apk classes.dex >/dev/null)
zipalign -f -p 4 build/app-unsigned.apk build/app-aligned.apk
# chave de assinatura
if [ ! -f "$KEYSTORE" ]; then
  mkdir -p "$(dirname "$KEYSTORE")"
  keytool -genkeypair -noprompt -keystore "$KEYSTORE" -storepass "$KS_PASS" -keypass "$KS_PASS" -alias vale \
    -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Vale da Lanterna, O=Vale da Lanterna, C=BR" >/dev/null 2>&1
  echo "Nova chave criada em $KEYSTORE (guarde-a para as próximas atualizações)."
fi
apksigner sign --ks "$KEYSTORE" --ks-pass "pass:$KS_PASS" --ks-key-alias vale --min-sdk-version 23 --out "$OUT" build/app-aligned.apk
apksigner verify --min-sdk-version 23 "$OUT"
echo "APK pronto: android/$OUT ($(du -h "$OUT" | cut -f1))"
