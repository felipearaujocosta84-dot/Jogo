#!/bin/sh
# PostgreSQL local para desenvolvimento e testes (porta 55432, dados em .data/pg).
# Depois: DATABASE_URL=postgres://postgres@127.0.0.1:55432/opstrike npm start
set -e
BIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1)
[ -z "$BIN" ] && BIN=$(dirname "$(command -v initdb)")
DIR=$(pwd)/.data/pg
if [ ! -d "$DIR/data" ]; then mkdir -p "$DIR" && "$BIN/initdb" -D "$DIR/data" -U postgres --auth=trust -E UTF8 >/dev/null; fi
"$BIN/pg_ctl" -D "$DIR/data" -o "-p 55432 -k $DIR" -l "$DIR/log.txt" start
sleep 2
psql "postgres://postgres@127.0.0.1:55432/postgres" -tc "SELECT 1 FROM pg_database WHERE datname='opstrike'" | grep -q 1 || psql "postgres://postgres@127.0.0.1:55432/postgres" -c "CREATE DATABASE opstrike"
echo "PostgreSQL pronto: postgres://postgres@127.0.0.1:55432/opstrike"
