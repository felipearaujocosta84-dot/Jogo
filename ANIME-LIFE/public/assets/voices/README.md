# Vozes gravadas (opcional)

Hoje **não existe nenhuma voz gravada** no jogo. Todas as falas usam voz **sintetizada** (TTS), e a tela avisa isso.

Para usar a gravação de um dublador numa fala:
1. Salve o arquivo como `public/assets/voices/<id-da-cena>/<passo>.mp3`, por exemplo `c1s1/12.mp3`. O número do passo aparece no histórico de depuração (`cena:passo`).
2. Registre o arquivo em `manifest.json`:
   ```json
   { "c1s1:12": "c1s1/12.mp3" }
   ```

Quando a gravação existe, o jogo a toca no lugar da voz sintetizada, mostra "🎙 voz gravada" e ajusta a boca à duração do áudio.
