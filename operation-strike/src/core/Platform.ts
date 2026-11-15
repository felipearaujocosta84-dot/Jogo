// Detecta se o jogo está rodando dentro do app Android (Capacitor) ou no navegador.
export const isNativeApp = (): boolean => {
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return !!cap?.isNativePlatform?.();
};
