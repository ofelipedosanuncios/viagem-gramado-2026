#!/usr/bin/env bash
# =============================================================
#  Instalador automatico do Bot Guia Gramado 2026 (para VPS)
#  Uso:  curl -fsSL <url>/deploy.sh -o d.sh && bash d.sh
# =============================================================
set -e

echo ""
echo "=================================================="
echo "  Instalador do Assistente de Viagem (Telegram)"
echo "=================================================="
echo ""

echo "==> [1/5] Verificando git e Node..."
if ! command -v git >/dev/null 2>&1; then
  apt-get update -y && apt-get install -y git
fi
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
if ! command -v pm2 >/dev/null 2>&1; then
  echo "==> Instalando PM2..."
  npm install -g pm2
fi

echo "==> [2/5] Baixando o bot..."
cd ~
rm -rf viagem-gramado-2026
git clone https://github.com/ofelipedosanuncios/viagem-gramado-2026.git
cd ~/viagem-gramado-2026/bot-telegram

echo ""
echo "==> [3/5] Configuracao (cole cada valor e aperte Enter)"
echo ""
printf "   Cole o TOKEN do Telegram: "
read -r TG </dev/tty
printf "   Cole a CHAVE do Gemini:   "
read -r GK </dev/tty

cat > .env <<EOF
TELEGRAM_TOKEN=$TG
GEMINI_API_KEY=$GK
SITE_URL=https://ofelipedosanuncios.github.io/viagem-gramado-2026/
GEMINI_MODEL=gemini-flash-lite-latest
TELEGRAM_ALLOWED_IDS=
EOF

echo ""
echo "==> [4/5] Ligando o bot com PM2..."
pm2 delete gramado-bot >/dev/null 2>&1 || true
pm2 start bot.js --name gramado-bot
pm2 save
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true

echo ""
echo "==> [5/5] Pronto! Status do bot:"
echo "=================================================="
pm2 list
echo "=================================================="
echo ""
echo "  Bot no ar 24h! Mande uma mensagem no Telegram"
echo "  para testar. Para ver os logs:  pm2 logs gramado-bot"
echo ""
