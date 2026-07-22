# 🤖 Bot de Telegram — Guia Gramado 2026

Um assistente no Telegram que responde perguntas sobre a viagem (roteiro, preços,
endereços, orçamento, mala...) lendo o conteúdo do site
`https://ofelipedosanuncios.github.io/viagem-gramado-2026/` e usando o Google
Gemini (plano **gratuito**) como cérebro.

- ✅ 100% grátis
- ✅ Sem risco de ban (Telegram é oficial)
- ✅ Node puro, **sem dependências** para instalar
- ✅ Sempre atualizado: relê o site sozinho a cada 10 minutos

---

## PARTE 1 — Criar o bot no Telegram (2 min)

1. No Telegram, procure por **@BotFather** e abra a conversa.
2. Envie `/newbot`.
3. Escolha um **nome** (ex.: `Guia Gramado`) e um **usuário** que termine em `bot`
   (ex.: `guia_gramado_familia_bot`).
4. O BotFather vai te dar um **token** parecido com
   `123456789:AAE...xyz`. **Guarde esse token.**

## PARTE 2 — Pegar a chave do Gemini (2 min)

1. Acesse **https://aistudio.google.com/apikey** (faça login com uma conta Google).
2. Clique em **"Create API key"** / "Criar chave de API".
3. Copie a chave gerada. **Guarde essa chave.**

> O plano gratuito do Gemini é mais que suficiente para uso familiar.

## PARTE 3 — Testar no seu PC (opcional, mas recomendado)

1. Abra a pasta `bot-telegram` no terminal.
2. Copie o arquivo de exemplo:
   - Windows (PowerShell): `Copy-Item .env.example .env`
   - Linux/VPS: `cp .env.example .env`
3. Abra o `.env` e cole o **token** e a **chave** nos campos certos.
4. Rode:
   ```
   node bot.js
   ```
5. Deve aparecer `🤖 Bot no ar!`. Vá ao Telegram, abra seu bot, mande `/start`
   e faça uma pergunta. 🎉
6. Para parar: `Ctrl + C`.

---

## PARTE 4 — Colocar no ar 24h no VPS Hostinger

Assim o bot funciona sempre, mesmo com seu PC desligado.

### 4.1 — Enviar os arquivos para o VPS

Conecte no seu VPS (pelo terminal SSH ou pelo **Terminal do navegador** no
painel da Hostinger) e crie a pasta:

```bash
mkdir -p ~/guia-gramado-bot
cd ~/guia-gramado-bot
```

Envie os arquivos `bot.js`, `package.json` e o `.env` (com seus dados
preenchidos) para essa pasta. Duas formas fáceis:

- **Opção A — copiar/colar:** crie os arquivos com `nano bot.js` e cole o conteúdo.
- **Opção B — SCP** (do seu PC): `scp -r bot-telegram/* usuario@IP_DO_VPS:~/guia-gramado-bot/`

### 4.2 — Instalar o Node (se ainda não tiver)

Verifique: `node --version`. Se der erro, instale:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 4.3 — Deixar rodando pra sempre com PM2

O **PM2** mantém o bot ligado e o reinicia sozinho se o VPS reiniciar:

```bash
sudo npm install -g pm2
cd ~/guia-gramado-bot
pm2 start bot.js --name gramado-bot
pm2 save
pm2 startup        # rode o comando que ele mandar de volta
```

Pronto! O bot está no ar 24h. ✅

### Comandos úteis do PM2

```bash
pm2 logs gramado-bot     # ver o que está acontecendo
pm2 restart gramado-bot  # reiniciar
pm2 stop gramado-bot     # parar
pm2 list                 # ver status
```

---

## PARTE 5 — Deixar o bot privado (opcional)

Para que só a família use:

1. Cada pessoa manda uma mensagem pro bot uma vez — ele responde com o **ID** dela.
   (Ou peça pra cada um falar com **@userinfobot** para descobrir o próprio ID.)
2. Coloque os IDs no `.env`, separados por vírgula:
   ```
   TELEGRAM_ALLOWED_IDS=123456789,987654321
   ```
3. Reinicie: `pm2 restart gramado-bot`.

Quem não estiver na lista recebe um aviso de que o bot é privado.

---

## Como ele se mantém atualizado?

Você continua editando o `index.html` normalmente (como já faz com o Claude Code).
Toda vez que você faz `git push`, o site atualiza — e o bot relê o site
automaticamente a cada 10 minutos. **Não precisa mexer no bot.**

## Dúvidas comuns

- **O bot parou de responder?** `pm2 logs gramado-bot` mostra o erro.
- **Troquei o token/chave?** Edite o `.env` e `pm2 restart gramado-bot`.
- **Quero mudar o texto de boas-vindas ou as regras?** Está tudo no `bot.js`,
  em português, comentado.
