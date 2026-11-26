# Servidor de IA do ANIME LIFE

Intermediário seguro entre o jogo e a IA. **A chave da API fica só aqui**, nunca no app.
O app manda apenas o id do personagem e o contexto da conversa; as personalidades ficam neste servidor.
Assim, ninguém consegue usá-lo como um chat genérico.

## Rodar localmente
```bash
cd ANIME-LIFE/server
npm install
ANTHROPIC_API_KEY=sua-chave npm start     # http://localhost:8787
npm test                                   # testes com a IA simulada (sem custo)
```
No jogo: **Ajustes → Celular e IA → Servidor de IA** = endereço do servidor → **Testar**.
No APK Android, o endereço precisa ser **https://**.

## Colocar no ar
Qualquer serviço que rode Node 22 ou Docker serve, como Render, Railway, Fly.io ou uma VPS.
Use o `Dockerfile` desta pasta e defina as variáveis abaixo no painel do serviço.
Nunca coloque a chave em arquivos do repositório.

| Variável | Padrão | Para quê |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Chave da API (obrigatória) |
| `AI_PROVIDER` | `anthropic` | Provedor de IA (veja "Outros provedores") |
| `AI_MODEL` | `claude-opus-5-5` | Modelo. Para gastar bem menos, use `claude-haiku-5-5` |
| `AI_EFFORT` | `low` | Esforço de raciocínio (conversa casual = baixo, mais rápido e barato) |
| `AI_FALLBACKS` | `default` | Resgate automático quando o modelo recusa (só em modelos que suportam) |
| `RATE_PER_MINUTE` | `6` | Mensagens por minuto por aparelho |
| `DEVICE_DAILY_LIMIT` | `120` | Mensagens por dia por aparelho |
| `IP_DAILY_LIMIT` | `400` | Mensagens por dia por IP |
| `GLOBAL_DAILY_LIMIT` | `5000` | Mensagens por dia no servidor todo |
| `DAILY_TOKEN_BUDGET` | `20000000` | Teto diário de tokens; a saída conta 5 vezes |
| `ALLOWED_ORIGINS` | `*` | Origens permitidas (CORS). Ex.: `https://localhost,https://seu-site` |
| `APP_TOKEN` | — | Token opcional que o app precisa enviar. Filtra uso casual; não é segredo forte |
| `TRUST_PROXY` | — | Use `1` atrás de um proxy confiável, para ler o IP real |

## Controle de custos
- **O que vai para a IA:** só as últimas 12 mensagens, um resumo das antigas (até 900 caracteres), até 20 memórias e os fatos da história.
- **Resumo automático:** depois de 24 mensagens novas, as antigas viram resumo.
- **Cache:** o texto fixo (regras e personalidade) é marcado para cache.
- **Limites:** por aparelho, por IP, total do dia e de tokens. O app também tem um limite diário próprio, em Ajustes.
- **Registro:** os logs guardam tokens e tempo de cada chamada, nunca o conteúdo das mensagens.

## Rotas
- `GET /health`: status, provedor e modelo.
- `POST /v1/chat`: resposta do NPC. Devolve `replies` (1 a 3 bolhas), `mood`, `deltas` (cada um de -3 a +3) e `memories`.
- `POST /v1/spontaneous`: mensagem que o NPC envia por conta própria (bom dia, saudade, convite…).
- `POST /v1/summarize`: resume conversas antigas e extrai memórias.

**Erros** chegam como `{ error, retryAfter }`:
- `ia_ocupada`
- `muitas_mensagens`
- `limite_diario_aparelho`
- `recusado`
- `sem_conexao_ia`
- e outros.

O app mostra cada um em português e deixa reenviar.

## Outros provedores
`providers/index.mjs` é um registro de provedores. Hoje só existe o da Anthropic (`providers/anthropic.mjs`).
Para usar outro, crie `providers/<nome>.mjs` com a mesma interface:
`generate({ system, user, schema, maxTokens })` → `{ output, usage, model }`, mais `classify(err)`.
Depois, registre-o e defina `AI_PROVIDER=<nome>`.
