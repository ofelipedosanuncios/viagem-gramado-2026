// =============================================================
//  Guia Gramado 2026 — Bot de Telegram
//  Responde perguntas sobre a viagem usando o conteudo do site
//  + Google Gemini (plano gratuito). Node puro, sem dependencias.
// =============================================================

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ---------- Config (vem do arquivo .env, carregado abaixo) ----------
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Carregador de .env simples (sem biblioteca externa)
function carregarEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  const linhas = fs.readFileSync(envPath, "utf8").split("\n");
  for (const linha of linhas) {
    const l = linha.trim();
    if (!l || l.startsWith("#")) continue;
    const idx = l.indexOf("=");
    if (idx === -1) continue;
    const chave = l.slice(0, idx).trim();
    let valor = l.slice(idx + 1).trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    if (!(chave in process.env)) process.env[chave] = valor;
  }
}
carregarEnv();

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SITE_URL =
  process.env.SITE_URL ||
  "https://ofelipedosanuncios.github.io/viagem-gramado-2026/";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
// Lista opcional de IDs autorizados (separados por virgula). Vazio = todos.
const ALLOWED_IDS = (process.env.TELEGRAM_ALLOWED_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (!TELEGRAM_TOKEN || !GEMINI_API_KEY) {
  console.error(
    "\n❌ Falta configurar o arquivo .env.\n" +
      "   Copie .env.example para .env e preencha TELEGRAM_TOKEN e GEMINI_API_KEY.\n"
  );
  process.exit(1);
}

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

// ---------- Conteudo do site (cache) ----------
let conteudoSite = "";
let siteAtualizadoEm = 0;
const SITE_TTL_MS = 10 * 60 * 1000; // recarrega o site a cada 10 min

// Remove tags de CSS/HTML deixando so o texto + os dados em JS.
function extrairTexto(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

async function carregarSite(forcar = false) {
  const agora = Date.now();
  if (!forcar && conteudoSite && agora - siteAtualizadoEm < SITE_TTL_MS) {
    return conteudoSite;
  }
  try {
    const resp = await fetch(SITE_URL, {
      headers: { "Cache-Control": "no-cache" },
    });
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    const html = await resp.text();
    conteudoSite = extrairTexto(html);
    siteAtualizadoEm = agora;
    console.log(
      `✅ Site carregado (${conteudoSite.length} caracteres) em ${new Date().toLocaleString(
        "pt-BR"
      )}`
    );
  } catch (e) {
    console.error("⚠️  Nao consegui carregar o site:", e.message);
    if (!conteudoSite) conteudoSite = "(conteudo do site indisponivel no momento)";
  }
  return conteudoSite;
}

// ---------- Memoria curta por conversa ----------
// Guarda as ultimas trocas de cada chat para dar contexto de acompanhamento.
const historicos = new Map(); // chatId -> [{papel, texto}]
const MAX_HISTORICO = 6; // ultimas 6 mensagens (3 idas e voltas)

function pegarHistorico(chatId) {
  return historicos.get(chatId) || [];
}
function guardarHistorico(chatId, papel, texto) {
  const h = pegarHistorico(chatId);
  h.push({ papel, texto });
  while (h.length > MAX_HISTORICO) h.shift();
  historicos.set(chatId, h);
}

// ---------- Gemini ----------
const INSTRUCAO_SISTEMA = `Voce e o assistente da viagem da familia a Gramado (Guia Gramado 2026).
Sua funcao e responder perguntas sobre a viagem: roteiro dia a dia, horarios, atracoes, precos, enderecos, orcamento, clima, checklist/mala e decisoes.

Regras:
- Responda SEMPRE em portugues do Brasil, de forma curta, clara e amigavel.
- Use SOMENTE as informacoes do conteudo do site fornecido abaixo. Nao invente precos, horarios ou enderecos.
- Se a informacao nao estiver no site, diga com honestidade que nao esta no guia e sugira o que poderia ser feito.
- Formate valores em reais (R$) e horarios de forma legivel.
- Pode usar emojis com moderacao para ficar simpatico.
- Quando fizer sentido, organize em topicos ou passos.`;

async function perguntarGemini(chatId, pergunta) {
  const site = await carregarSite();
  const historico = pegarHistorico(chatId);

  const contents = [];
  // Contexto do site + instrucao, como primeira mensagem do "usuario"
  contents.push({
    role: "user",
    parts: [
      {
        text:
          INSTRUCAO_SISTEMA +
          "\n\n===== CONTEUDO DO SITE DA VIAGEM =====\n" +
          site +
          "\n===== FIM DO CONTEUDO =====",
      },
    ],
  });
  contents.push({
    role: "model",
    parts: [{ text: "Entendido! Pode perguntar o que quiser sobre a viagem. 😊" }],
  });

  // Historico recente
  for (const msg of historico) {
    contents.push({
      role: msg.papel === "user" ? "user" : "model",
      parts: [{ text: msg.texto }],
    });
  }
  // Pergunta atual
  contents.push({ role: "user", parts: [{ text: pergunta }] });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
    }),
  });

  if (!resp.ok) {
    const erro = await resp.text();
    console.error("Erro Gemini:", resp.status, erro);
    throw new Error("Gemini HTTP " + resp.status);
  }
  const data = await resp.json();
  const texto =
    data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
  return texto.trim() || "Desculpe, nao consegui gerar uma resposta agora.";
}

// ---------- Telegram ----------
async function tg(metodo, corpo) {
  const resp = await fetch(`${TELEGRAM_API}/${metodo}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
  return resp.json();
}

async function enviarMensagem(chatId, texto) {
  // Telegram limita ~4096 caracteres por mensagem
  const limite = 4000;
  for (let i = 0; i < texto.length; i += limite) {
    await tg("sendMessage", {
      chat_id: chatId,
      text: texto.slice(i, i + limite),
    });
  }
}

function autorizado(userId) {
  if (ALLOWED_IDS.length === 0) return true;
  return ALLOWED_IDS.includes(String(userId));
}

async function tratarMensagem(msg) {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  const texto = (msg.text || "").trim();
  if (!texto) return;

  if (!autorizado(userId)) {
    await enviarMensagem(
      chatId,
      "🔒 Este bot e privado da familia. Seu ID do Telegram e: " +
        userId +
        "\nPeca ao Felipe para liberar seu acesso."
    );
    console.log("Acesso negado para:", userId, msg.from?.first_name);
    return;
  }

  if (texto === "/start") {
    await enviarMensagem(
      chatId,
      "Ola! 👋 Eu sou o assistente da viagem a Gramado 2026.\n\n" +
        "Pode me perguntar qualquer coisa, por exemplo:\n" +
        "• O que faremos no Dia 3?\n" +
        "• Qual o preco do Snowland?\n" +
        "• Qual o endereco do nosso chale?\n" +
        "• Quanto vai custar pra minha familia?\n" +
        "• O que levar na mala?\n\n" +
        "Manda a pergunta! 😊"
    );
    return;
  }
  if (texto === "/ajuda" || texto === "/help") {
    await enviarMensagem(
      chatId,
      "Comandos:\n/start — apresentacao\n/ajuda — esta mensagem\n\n" +
        "Fora isso, e so mandar sua pergunta sobre a viagem normalmente."
    );
    return;
  }

  try {
    await tg("sendChatAction", { chat_id: chatId, action: "typing" });
    const resposta = await perguntarGemini(chatId, texto);
    guardarHistorico(chatId, "user", texto);
    guardarHistorico(chatId, "model", resposta);
    await enviarMensagem(chatId, resposta);
  } catch (e) {
    console.error("Erro ao responder:", e.message);
    await enviarMensagem(
      chatId,
      "😥 Tive um probleminha pra responder agora. Tenta de novo em instantes."
    );
  }
}

// ---------- Loop de long polling ----------
let offset = 0;
let rodando = true;

async function loop() {
  console.log("🤖 Bot no ar! Aguardando mensagens...");
  while (rodando) {
    try {
      const resp = await fetch(
        `${TELEGRAM_API}/getUpdates?timeout=30&offset=${offset}`,
        { signal: AbortSignal.timeout(40000) }
      );
      const data = await resp.json();
      if (!data.ok) {
        console.error("getUpdates falhou:", data);
        await esperar(3000);
        continue;
      }
      for (const update of data.result) {
        offset = update.update_id + 1;
        if (update.message) {
          // nao esperar (await) para processar em paralelo
          tratarMensagem(update.message).catch((e) =>
            console.error("Erro no tratamento:", e)
          );
        }
      }
    } catch (e) {
      if (e.name !== "TimeoutError") {
        console.error("Erro no loop:", e.message);
        await esperar(3000);
      }
    }
  }
}

function esperar(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

process.on("SIGINT", () => {
  console.log("\n👋 Encerrando bot...");
  rodando = false;
  process.exit(0);
});

// ---------- Start ----------
(async () => {
  await carregarSite(true);
  // Remove webhook antigo (caso exista) para o long polling funcionar
  await tg("deleteWebhook", { drop_pending_updates: false }).catch(() => {});
  loop();
})();
