#!/bin/sh
# Preparação de uma VPS Ubuntu/Debian nova (rodar como root). Revise antes de executar.
# Instala Node 22, PostgreSQL, Caddy; cria usuário, banco e o serviço do jogo.
set -e
DOMINIO=${1:?uso: sh setup-vps.sh jogo.seudominio.com.br}
apt-get update
apt-get install -y curl git postgresql caddy || { echo "Instale o Caddy pelo repositório oficial: https://caddyserver.com/docs/install"; exit 1; }
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
id opstrike >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin opstrike
SENHA=$(head -c 24 /dev/urandom | base64 | tr -d '/+=')
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='opstrike'" | grep -q 1 || sudo -u postgres psql -c "CREATE USER opstrike WITH PASSWORD '$SENHA'"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='opstrike'" | grep -q 1 || sudo -u postgres psql -c "CREATE DATABASE opstrike OWNER opstrike"
mkdir -p /opt/operation-strike
echo "Copie o projeto (pasta operation-strike) para /opt/operation-strike e rode lá: npm ci && npm run build"
if [ ! -f /opt/operation-strike/.env ]; then
  sed -e "s#TROQUE_ESTA_SENHA#$SENHA#" -e "s#jogo.seudominio.com.br#$DOMINIO#" /opt/operation-strike/.env.example > /opt/operation-strike/.env 2>/dev/null || true
  chmod 600 /opt/operation-strike/.env
fi
sed "s#jogo.seudominio.com.br#$DOMINIO#" /opt/operation-strike/deploy/Caddyfile > /etc/caddy/Caddyfile 2>/dev/null || true
cp /opt/operation-strike/deploy/operation-strike.service /etc/systemd/system/ 2>/dev/null || true
chown -R opstrike /opt/operation-strike
systemctl daemon-reload
systemctl enable --now operation-strike || true
systemctl reload caddy || true
echo "Pronto. Teste: curl https://$DOMINIO/api/health"
