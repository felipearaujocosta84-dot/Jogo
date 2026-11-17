#!/usr/bin/env bash
# Gera o APK do Vale da Lanterna (Android 6+), sem Android Studio:
#   aapt (recursos) → javac + dx (código) → zipalign → apksigner (assinatura v1+v2+v3).
# Ferramentas (Ubuntu/Debian): sudo apt-get install aapt apksigner dalvik-exchange zipalign android-sdk-platform-23 openjdk-17-jdk
# Uso: ./build-apk.sh            → dist/vale-da-lanterna.apk
#      VERSION_CODE=2 VERSION_NAME=1.1 ./build-apk.sh
#      PAD_MB=200 (padrão): o APK final fica com exatamente PAD_MB × 1.000.000 bytes (como o Android mostra);
#      PAD_MB=0 gera o APK leve. O enchimento é um arquivo de dados em assets/dados/pacote.bin que o jogo não usa.
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
# chave de assinatura
if [ ! -f "$KEYSTORE" ]; then
  mkdir -p "$(dirname "$KEYSTORE")"
  keytool -genkeypair -noprompt -keystore "$KEYSTORE" -storepass "$KS_PASS" -keypass "$KS_PASS" -alias vale \
    -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Vale da Lanterna, O=Vale da Lanterna, C=BR" >/dev/null 2>&1
  echo "Nova chave criada em $KEYSTORE (guarde-a para as próximas atualizações)."
fi
# alinha, assina e (se PAD_MB > 0) ajusta o enchimento até o tamanho exato
PAD_MB=${PAD_MB:-200}
python3 - "$PAD_MB" "$KEYSTORE" "$KS_PASS" "$OUT" <<'PY'
import os, random, subprocess, sys, zipfile, shutil
pad_mb, ks, ks_pass, out = int(sys.argv[1]), sys.argv[2], sys.argv[3], sys.argv[4]
target = pad_mb * 1000 * 1000
def build(pad, fine=0):
    shutil.copy('build/app-unsigned.apk', 'build/app-pad.apk')
    if pad > 0:
        rnd = random.Random(20261117)   # dados fixos: o mesmo build gera o mesmo arquivo
        info = zipfile.ZipInfo('assets/dados/pacote.bin', (2026, 1, 1, 0, 0, 0))
        info.comment = b'.' * fine     # ajuste fino: só entra no índice do zip (depois do bloco de assinatura)
        with zipfile.ZipFile('build/app-pad.apk', 'a', zipfile.ZIP_STORED) as z:
            with z.open(info, 'w', force_zip64=False) as f:
                left = pad
                while left > 0:
                    n = min(left, 8 << 20); f.write(rnd.randbytes(n)); left -= n
    subprocess.run(['zipalign', '-f', '-p', '4', 'build/app-pad.apk', 'build/app-aligned.apk'], check=True)
    subprocess.run(['apksigner', 'sign', '--ks', ks, '--ks-pass', 'pass:' + ks_pass, '--ks-key-alias', 'vale', '--min-sdk-version', '23', '--out', out, 'build/app-aligned.apk'], check=True, stderr=subprocess.DEVNULL)
    return os.path.getsize(out)
if pad_mb <= 0:
    build(0)
else:
    pad, fine = target - build(0) - 4096, 0
    for i in range(16):
        size = build(pad, fine)
        if size == target: break
        d = target - size
        if 0 < d < 8192 and fine + d < 60000: fine += d
        else: pad += d
    print('Tamanho final: %d bytes (alvo %d)' % (size, target))
PY
apksigner verify --min-sdk-version 23 "$OUT"
echo "APK pronto: android/$OUT ($(stat -c %s "$OUT") bytes)"
