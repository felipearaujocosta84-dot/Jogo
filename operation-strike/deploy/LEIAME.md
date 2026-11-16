# Servidor multiplayer do OPERATION STRIKE — iniciar, hospedar e conectar o app

## O que roda no servidor
- **Colyseus** (WebSocket; vira **WSS** atrás do HTTPS): sala `social` (amigos, convites, grupo, presença) e salas `game` (partidas).
- **PostgreSQL**: contas (senha com scrypt), sessões (só o hash do token), perfis, cosméticos e amizades.
- **API HTTP**: `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/me`, `/api/ranking`, `/api/profile/:id`,
  `/api/status` (monitoramento: online, salas, tempo de tick, contadores) e `/api/health`.
- Também serve o jogo compilado (pasta `dist`) para jogar pelo navegador.
- Autoritativo: o cliente só envia comandos (movimento/mira/botões). Vida, dano, munição, abates, compras e resultado
  são calculados no servidor (mesma simulação do jogo), com compensação de latência nos tiros.

## Rodar no seu computador (desenvolvimento)
```sh
cd operation-strike
npm ci
npm run db:dev          # PostgreSQL local na porta 55432 (precisa do PostgreSQL instalado)
npm run build
DATABASE_URL=postgres://postgres@127.0.0.1:55432/opstrike npm start
# abra http://localhost:8080  → Jogar online → criar conta
```
Sem `DATABASE_URL` o servidor usa um banco em memória (aviso no log; tudo some ao reiniciar).

Testes de rede (clientes reais por WebSocket contra o servidor):
```sh
DATABASE_URL=postgres://postgres@127.0.0.1:55432/opstrike npm run test:net            # todos
DATABASE_URL=... npm run test:net -- x1 reconnect                                       # só alguns
```
`OS_TEST_MODE=1` (usado pelo `test:net`) libera um comando de posicionamento para os testes de tiro e afrouxa os
limites de cadastro — **nunca** use em produção.

## Hospedar numa VPS (Ubuntu 22.04/24.04, 2 vCPU / 2 GB RAM já atendem várias salas)
1. Aponte um domínio (registro **A**) para o IP da VPS. Ex.: `jogo.seudominio.com.br`.
2. Envie a pasta `operation-strike` para `/opt/operation-strike` (git clone ou scp).
3. Como root: `sh /opt/operation-strike/deploy/setup-vps.sh jogo.seudominio.com.br`
   — instala Node 22, PostgreSQL e Caddy, cria o usuário e o banco com senha aleatória, gera o `.env`,
   instala o serviço systemd (reinicia sozinho se cair) e o HTTPS automático (Let's Encrypt).
4. Em `/opt/operation-strike`: `sudo -u opstrike npm ci && sudo -u opstrike npm run build && systemctl restart operation-strike`
5. Teste: `curl https://jogo.seudominio.com.br/api/health` → `{"ok":true}`
6. Logs: `journalctl -u operation-strike -f` (uma linha JSON por evento). Status: `https://jogo.seudominio.com.br/api/status`.

Alternativas: `deploy/nginx.conf` (nginx + certbot) ou `deploy/docker-compose.yml` (Docker com PostgreSQL).
Firewall: libere só 22, 80 e 443 (`ufw allow 22,80,443/tcp && ufw enable`). A porta 8080 fica só em 127.0.0.1.

Variáveis (arquivo `.env`, nunca no app): ver `.env.example`.

## Conectar o app Android
No app: **Jogar online → aba CONTA → Servidor** e digite `https://jogo.seudominio.com.br`
(na rede local, para testes: `http://IP-DO-PC:8080`). Depois crie a conta ou entre.
O app não contém senhas nem chaves: só guarda o token da sessão do jogador.

## O que NÃO está feito por mim
O servidor **não está online**: não tenho acesso a uma VPS. Os passos acima são para você (ou eu, se você
fornecer o acesso) colocar no ar.

## Hospedar no Render (sem VPS)
O arquivo `render.yaml` (na raiz do repositório) cria o servidor e o PostgreSQL:
1. Crie a conta em https://render.com e conecte o GitHub.
2. **New → Blueprint** → escolha o repositório `Jogo` e o ramo `claude/operation-strike-fps-pyufgw` → **Apply**.
3. Aguarde o primeiro deploy (alguns minutos). O endereço fica como `https://operation-strike-xxxx.onrender.com`.
4. Teste no navegador: `https://SEU-ENDEREÇO/api/health` → `{"ok":true}`. O jogo também abre em `https://SEU-ENDEREÇO`.
5. No app: **Jogar online → CONTA → Servidor** = `https://SEU-ENDEREÇO`.
Planos no arquivo: web `starter` e banco `basic-256mb` (pagos, sempre ligados). O plano gratuito do web dorme sem uso
(primeira conexão demora ~1 min) e o banco gratuito expira — dá para testar trocando `plan: free` nos dois.
A cada envio de código no ramo, o Render atualiza sozinho (`autoDeploy`).
