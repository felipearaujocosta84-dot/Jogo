#!/usr/bin/env bash
# Build do APK SEM o Android Gradle Plugin (ambientes sem acesso ao Google Maven).
# No Android Studio use o Gradle normalmente (./gradlew assembleDebug). Este script compila
# exatamente os mesmos fontes de app/src/main.
#
# Requisitos: JDK 17+, aapt, dalvik-exchange (dx), zipalign, apksigner (apt), kotlinc, android.jar (API 34).
# Variaveis: ANDROID_JAR, KOTLINC, KOTLIN_STDLIB, KEYSTORE (opcional).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/app/src/main"
OUT="$ROOT/build/manual"
ANDROID_JAR="${ANDROID_JAR:-/root/android-sdk/platforms/android-34/android.jar}"
KOTLINC="${KOTLINC:-kotlinc}"
KOTLIN_STDLIB="${KOTLIN_STDLIB:-$(dirname "$(readlink -f "$(command -v "$KOTLINC")")")/../lib/kotlin-stdlib.jar}"
KEYSTORE="${KEYSTORE:-$ROOT/build/debug.keystore}"
VERSION_CODE=$(grep -oP 'versionCode = \K[0-9]+' "$ROOT/app/build.gradle.kts")
VERSION_NAME=$(grep -oP 'versionName = "\K[^"]+' "$ROOT/app/build.gradle.kts")
APK_NAME="GamepadMapper-v${VERSION_NAME}-debug.apk"

rm -rf "$OUT"; mkdir -p "$OUT"/{gen,classes,manifest}

echo "==> [1/6] Manifesto (pacote + versao, como o AGP faria)"
sed -e "s|<manifest xmlns:android=\"http://schemas.android.com/apk/res/android\">|<manifest xmlns:android=\"http://schemas.android.com/apk/res/android\" package=\"com.gamepadmapper\" android:versionCode=\"$VERSION_CODE\" android:versionName=\"$VERSION_NAME\">\n    <uses-sdk android:minSdkVersion=\"26\" android:targetSdkVersion=\"34\" />|" \
    "$APP/AndroidManifest.xml" > "$OUT/manifest/AndroidManifest.xml"

echo "==> [2/6] Recursos (aapt)"
aapt package -f -m --auto-add-overlay --no-version-vectors \
    -M "$OUT/manifest/AndroidManifest.xml" -S "$APP/res" -I "$ANDROID_JAR" \
    -J "$OUT/gen" -F "$OUT/resources.ap_"

echo "==> [3/6] Kotlin/Java -> bytecode"
javac -nowarn -source 8 -target 8 -cp "$ANDROID_JAR" -d "$OUT/classes" $(find "$OUT/gen" -name '*.java') 2>&1 | grep -v 'warning' || true
"$KOTLINC" -nowarn -no-reflect -jvm-target 1.8 -Xlambdas=class -Xsam-conversions=class \
    -classpath "$ANDROID_JAR:$OUT/classes" -d "$OUT/classes" $(find "$APP/java" -name '*.kt') 2>&1 \
    | grep -v -E '^(Picked up|warning)' || true
test -f "$OUT/classes/com/gamepadmapper/service/GamepadAccessibilityService.class" || { echo "Falha na compilacao Kotlin"; exit 1; }

echo "==> [4/6] DEX (dx)"
cp "$KOTLIN_STDLIB" "$OUT/kotlin-stdlib.jar"
zip -q -d "$OUT/kotlin-stdlib.jar" 'META-INF/versions/*' 'META-INF/*.kotlin_module' >/dev/null 2>&1 || true
dalvik-exchange --dex --min-sdk-version=26 --output="$OUT/classes.dex" "$OUT/classes" "$OUT/kotlin-stdlib.jar"

echo "==> [5/6] Empacotar + alinhar"
cp "$OUT/resources.ap_" "$OUT/unsigned.apk"
(cd "$OUT" && zip -q -j unsigned.apk classes.dex)
zipalign -f -p 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"

echo "==> [6/6] Assinar (chave de debug)"
if [ ! -f "$KEYSTORE" ]; then
    keytool -genkeypair -keystore "$KEYSTORE" -storepass android -keypass android -alias androiddebugkey \
        -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US" >/dev/null 2>&1
fi
apksigner sign --ks "$KEYSTORE" --ks-pass pass:android --key-pass pass:android \
    --min-sdk-version 26 --out "$OUT/$APK_NAME" "$OUT/aligned.apk"
apksigner verify --min-sdk-version 26 "$OUT/$APK_NAME"
mkdir -p "$ROOT/apk" && cp "$OUT/$APK_NAME" "$ROOT/apk/"
echo "APK: $ROOT/apk/$APK_NAME ($(du -h "$OUT/$APK_NAME" | cut -f1))"
