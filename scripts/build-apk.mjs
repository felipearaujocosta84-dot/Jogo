// =============================================================
// EXTREME RACING — gera o APK com um comando:  npm run apk
// Requisitos no computador: Node 20+, JDK 17 e Android SDK
// (o Android Studio instala o SDK). Resultado: EXTREME-RACING.apk
// Para o arquivo da Play Store (AAB assinado): npm run apk -- --release
// =============================================================
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const release = process.argv.includes('--release');
const win = process.platform === 'win32';
const run = (cmd, cwd = root) => {
  console.log(`\n▶ ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit', env: process.env });
};

run('npx vite build');
if (!fs.existsSync(path.join(root, 'android'))) run('npx cap add android');
run('node scripts/android-setup.mjs');
run('npx @capacitor/assets generate --android --iconBackgroundColor "#05070b" --iconBackgroundColorDark "#05070b" --splashBackgroundColor "#05070b" --splashBackgroundColorDark "#05070b"');
run('npx cap sync android');
const gradlew = win ? 'gradlew.bat' : './gradlew';
if (!win) fs.chmodSync(path.join(root, 'android/gradlew'), 0o755);
const task = release ? 'bundleRelease assembleRelease' : 'assembleDebug';
run(`${gradlew} ${task} --no-daemon`, path.join(root, 'android'));

const outputs = release
  ? [['android/app/build/outputs/apk/release/app-release.apk', 'EXTREME-RACING-release.apk'], ['android/app/build/outputs/bundle/release/app-release.aab', 'EXTREME-RACING.aab']]
  : [['android/app/build/outputs/apk/debug/app-debug.apk', 'EXTREME-RACING.apk']];
for (const [from, to] of outputs) {
  const src = path.join(root, from);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(root, to));
    console.log(`\n✅ Pronto: ${to} (${(fs.statSync(src).size / 1048576).toFixed(1)} MB)`);
  }
}
