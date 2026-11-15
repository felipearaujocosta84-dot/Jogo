import type { CapacitorConfig } from '@capacitor/cli';

// App Android (Capacitor): o jogo roda a partir dos arquivos locais (offline contra bots e treino).
// O esquema http permite conectar a servidores ws:// na rede local para o multiplayer.
const config: CapacitorConfig = {
  appId: 'com.operationstrike.game',
  appName: 'Operation Strike',
  webDir: 'dist',
  server: {
    androidScheme: 'http',
    cleartext: true
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#0b0d10'
  }
};

export default config;
