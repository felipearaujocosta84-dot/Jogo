// =============================================================
// EXTREME RACING — ajustes do projeto Android (rodar depois de
// "npx cap add android"; pode rodar várias vezes sem problema):
//  • tela travada em paisagem e aceleração de hardware
//  • tela cheia imersiva e tela sempre acesa (MainActivity)
//  • versão do app a partir do package.json
//  • assinatura fixa nas builds de teste (instala por cima sem
//    apagar o progresso) e assinatura de lançamento por variáveis
//    de ambiente (KEYSTORE_FILE, KEYSTORE_PASSWORD, KEY_ALIAS, KEY_PASSWORD)
// =============================================================
import fs from 'fs';
import path from 'path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const android = path.join(root, 'android');
if (!fs.existsSync(android)) {
  console.error('Pasta android/ não encontrada. Rode antes: npx cap add android');
  process.exit(1);
}
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const cap = JSON.parse(fs.readFileSync(path.join(root, 'capacitor.config.json'), 'utf8'));
const MARK = '/* extreme-racing-setup */';

// ---------- AndroidManifest.xml ----------
const manifestPath = path.join(android, 'app/src/main/AndroidManifest.xml');
let manifest = fs.readFileSync(manifestPath, 'utf8');
if (!manifest.includes('android:screenOrientation')) {
  manifest = manifest.replace(/<activity(\s)/, '<activity android:screenOrientation="sensorLandscape"$1');
}
if (!manifest.includes('android:hardwareAccelerated')) {
  manifest = manifest.replace(/<application(\s)/, '<application android:hardwareAccelerated="true"$1');
}
fs.writeFileSync(manifestPath, manifest);
console.log('✓ AndroidManifest: paisagem + aceleração de hardware');

// ---------- MainActivity.java ----------
const pkgPath = cap.appId.split('.');
const activityPath = path.join(android, 'app/src/main/java', ...pkgPath, 'MainActivity.java');
fs.mkdirSync(path.dirname(activityPath), { recursive: true });
fs.writeFileSync(activityPath, `package ${cap.appId};

import android.os.Bundle;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

// ${MARK} tela cheia imersiva e tela sempre acesa durante o jogo
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        hideSystemBars();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    private void hideSystemBars() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.hide(WindowInsetsCompat.Type.systemBars());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
}
`);
console.log('✓ MainActivity: tela cheia + tela sempre acesa');

// ---------- app/build.gradle ----------
const gradlePath = path.join(android, 'app/build.gradle');
let gradle = fs.readFileSync(gradlePath, 'utf8');
const [maj, min, pat] = pkg.version.split('.').map((n) => parseInt(n, 10) || 0);
const versionCode = maj * 10000 + min * 100 + pat;
gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);
gradle = gradle.replace(/versionName\s+"[^"]*"/, `versionName "${pkg.version}"`);
if (!gradle.includes(MARK)) {
  const keystore = path.relative(path.join(android, 'app'), path.join(root, 'android-keystore/extreme-debug.keystore')).split(path.sep).join('/');
  const signing = `
    ${MARK}
    signingConfigs {
        fixedDebug {
            storeFile file("${keystore}")
            storePassword "android"
            keyAlias "androiddebugkey"
            keyPassword "android"
        }
        release {
            if (System.getenv("KEYSTORE_FILE")) {
                storeFile file(System.getenv("KEYSTORE_FILE"))
                storePassword System.getenv("KEYSTORE_PASSWORD")
                keyAlias System.getenv("KEY_ALIAS")
                keyPassword System.getenv("KEY_PASSWORD")
            }
        }
    }
`;
  gradle = gradle.replace(/android\s*\{/, (m) => `${m}${signing}`);
  gradle = gradle.replace(/buildTypes\s*\{/, (m) => `${m}
        debug {
            signingConfig signingConfigs.fixedDebug
        }`);
  gradle = gradle.replace(/release\s*\{(\s*minifyEnabled)/, (m, rest) => `release {
            if (System.getenv("KEYSTORE_FILE")) { signingConfig signingConfigs.release }${rest}`);
}
fs.writeFileSync(gradlePath, gradle);
console.log(`✓ build.gradle: versão ${pkg.version} (${versionCode}) e assinatura`);
