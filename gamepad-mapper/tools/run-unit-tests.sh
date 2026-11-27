#!/usr/bin/env bash
# Roda os testes JVM da logica pura (sem Android) sem precisar do Android Gradle Plugin.
# No Android Studio: ./gradlew testDebugUnitTest
# Requisitos: kotlinc, junit-4.13.2.jar, hamcrest-core-1.3.jar, json-20240303.jar em $TEST_LIBS.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/app/src/main/java/com/gamepadmapper"
TEST_LIBS="${TEST_LIBS:-/tmp/sdkdl/testlibs}"
OUT="$ROOT/build/unit-tests"
CP="$TEST_LIBS/junit-4.13.2.jar:$TEST_LIBS/hamcrest-core-1.3.jar:$TEST_LIBS/json-20240303.jar"
rm -rf "$OUT"; mkdir -p "$OUT"
# Apenas fontes sem dependencia do Android: compilar sem android.jar garante essa separacao.
PURE=(
  "$SRC/input/PhysicalInput.kt" "$SRC/input/ControllerState.kt"
  "$SRC/profile/Profile.kt" "$SRC/profile/ProfileJson.kt" "$SRC/profile/ProfileTemplates.kt"
  "$SRC/touch/StickMath.kt" "$SRC/touch/TouchPlanner.kt"
)
kotlinc -nowarn -classpath "$CP" -d "$OUT" "${PURE[@]}" $(find "$ROOT/app/src/test/java" -name '*.kt') 2>&1 | grep -v '^Picked up' || true
CLASSES=$(cd "$OUT" && find com -name '*Test.class' | sed 's/\.class$//; s#/#.#g')
KSTD="$(dirname "$(readlink -f "$(command -v kotlinc)")")/../lib/kotlin-stdlib.jar"
java -cp "$OUT:$CP:$KSTD" org.junit.runner.JUnitCore $CLASSES 2>&1 | grep -v '^Picked up'
