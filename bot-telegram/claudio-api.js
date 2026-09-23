// =============================================================
//  Claudio, o guia da viagem — API do chat do site
//  Mesma logica do bot.js, mas atendendo o botao flutuante do
//  site em vez do Telegram. Node puro, sem dependencias.
//  Escuta so em 127.0.0.1 — quem expoe pra internet e o nginx.
// =============================================================

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Carregador de .env simples (sem biblioteca externa)
function carregarEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const linha of fs.readFileSync(envPath, "utf8").split("\n")) {
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

const PORT = Number(process.env.CLAUDIO_PORT || 3001);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
// Caminho do index.html publicado no proprio servidor
const SITE_FILE = process.env.SITE_FILE || "/var/www/gramado/index.html";

if (!GEMINI_API_KEY) {
  console.error("❌ Falta GEMINI_API_KEY no .env");
  process.exit(1);
}

// ---------- Limites (protegem a cota do Gemini) ----------
const MAX_PERGUNTA = 500; // caracteres por pergunta
const MAX_HISTORICO = 6; // ultimas 6 mensagens enviadas pelo site
const LIMITE_JANELA_MS = 10 * 60 * 1000; // 10 minutos
const LIMITE_POR_JANELA = 20; // 20 perguntas por IP na janela

// ---------- Imagem anexada (analise multimodal) ----------
const MIME_IMAGEM_PERMITIDO = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const MAX_IMAGEM_BASE64 = 6 * 1024 * 1024; // ~4.3MB de imagem original
const LIMITE_CORPO_HTTP = 8 * 1024 * 1024; // body maximo aceito na requisicao (imagem em base64 + resto do JSON)

const usoPorIp = new Map(); // ip -> { contador, expiraEm }

function dentroDoLimite(ip) {
  const agora = Date.now();
  const reg = usoPorIp.get(ip);
  if (!reg || agora > reg.expiraEm) {
    usoPorIp.set(ip, { contador: 1, expiraEm: agora + LIMITE_JANELA_MS });
    return true;
  }
  if (reg.contador >= LIMITE_POR_JANELA) return false;
  reg.contador++;
  return true;
}

// Limpeza periodica pra memoria nao crescer sem parar
setInterval(() => {
  const agora = Date.now();
  for (const [ip, reg] of usoPorIp) if (agora > reg.expiraEm) usoPorIp.delete(ip);
}, 5 * 60 * 1000).unref();

// ---------- Conteudo do site (lido do disco, com cache) ----------
let conteudoSite = "";
let siteAtualizadoEm = 0;
const SITE_TTL_MS = 5 * 60 * 1000;

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

function carregarSite(forcar = false) {
  const agora = Date.now();
  if (!forcar && conteudoSite && agora - siteAtualizadoEm < SITE_TTL_MS) {
    return conteudoSite;
  }
  try {
    conteudoSite = extrairTexto(fs.readFileSync(SITE_FILE, "utf8"));
    siteAtualizadoEm = agora;
    console.log(`✅ Site lido de ${SITE_FILE} (${conteudoSite.length} caracteres)`);
  } catch (e) {
    console.error("⚠️  Nao consegui ler o site:", e.message);
    if (!conteudoSite) conteudoSite = "(conteudo do site indisponivel no momento)";
  }
  return conteudoSite;
}

// ---------- Gemini ----------
const INSTRUCAO_SISTEMA = `Voce e o "Claudio", o guia da viagem da familia a Gramado (Guia Gramado 2026).
Voce conversa dentro do proprio site do guia, com os membros da familia.

Regras:
- Responda SEMPRE em portugues do Brasil, de forma curta, clara e amigavel.
- Priorize SEMPRE as informacoes do conteudo do site fornecido abaixo pra tudo que for da viagem em si (roteiro, precos, horarios, enderecos, decisoes da familia) — isso e o que foi decidido, nao invente nem contrarie.
- Se a pergunta for sobre algo que nao esta no site (clima previsto, se um lugar esta aberto hoje, noticias, precos ou horarios que podem ter mudado desde que o guia foi escrito etc.), pode usar a busca do Google pra responder — e deixe claro que essa parte veio de uma busca externa, nao do guia.
- Se o usuario mandar uma imagem, analise o conteudo dela (foto de comprovante, prato, roupa, lugar etc.) e responda considerando a pergunta junto com o que aparece na imagem.
- Formate valores em reais (R$) e horarios de forma legivel.
- Pode usar emojis com moderacao para ficar simpatico.
- Quando fizer sentido, organize em topicos ou passos.
- Voce se apresenta como Claudio quando perguntarem seu nome.`;

async function perguntarGemini(historico, pergunta, imagem) {
  const site = carregarSite();
  const contents = [];

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
    parts: [{ text: "Oi! Eu sou o Claudio, o guia da viagem. Pode perguntar. 😊" }],
  });

  for (const msg of historico.slice(-MAX_HISTORICO)) {
    contents.push({
      role: msg.papel === "user" ? "user" : "model",
      parts: [{ text: String(msg.texto || "").slice(0, MAX_PERGUNTA) }],
    });
  }

  const partesPergunta = [{ text: pergunta || "Analise esta imagem." }];
  if (imagem) partesPergunta.push({ inlineData: { mimeType: imagem.mimeType, data: imagem.dados } });
  contents.push({ role: "user", parts: partesPergunta });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
    }),
  });

  if (!resp.ok) {
    const erro = await resp.text();
    console.error("Erro Gemini:", resp.status, erro.slice(0, 300));
    throw new Error("Gemini HTTP " + resp.status);
  }
  const data = await resp.json();
  const texto =
    data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
  return texto.trim() || "Desculpe, nao consegui gerar uma resposta agora.";
}

// ---------- HTTP ----------
function json(res, status, obj) {
  const corpo = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(corpo),
    "Cache-Control": "no-store",
  });
  res.end(corpo);
}

function lerCorpo(req, limiteBytes = 32 * 1024) {
  return new Promise((resolve, reject) => {
    let dados = "";
    let tamanho = 0;
    req.on("data", (c) => {
      tamanho += c.length;
      if (tamanho > limiteBytes) {
        reject(new Error("corpo grande demais"));
        req.destroy();
        return;
      }
      dados += c;
    });
    req.on("end", () => resolve(dados));
    req.on("error", reject);
  });
}

const servidor = http.createServer(async (req, res) => {
  const caminho = (req.url || "").split("?")[0].replace(/\/+$/, "");
  const ip = req.headers["x-real-ip"] || req.socket.remoteAddress || "desconhecido";

  if (caminho.endsWith("/health")) {
    return json(res, 200, {
      ok: true,
      modelo: GEMINI_MODEL,
      site_chars: carregarSite().length,
    });
  }

  if (!caminho.endsWith("/chat")) return json(res, 404, { erro: "rota nao encontrada" });
  if (req.method !== "POST") return json(res, 405, { erro: "use POST" });

  if (!dentroDoLimite(ip)) {
    return json(res, 429, {
      erro: "Muitas perguntas seguidas. Espere alguns minutos e tente de novo. 🙂",
    });
  }

  let corpo;
  try {
    corpo = JSON.parse(await lerCorpo(req, LIMITE_CORPO_HTTP));
  } catch (e) {
    return json(res, e.message === "corpo grande demais" ? 413 : 400, {
      erro: e.message === "corpo grande demais" ? "Imagem grande demais." : "JSON invalido",
    });
  }

  const pergunta = String(corpo.pergunta || "").trim().slice(0, MAX_PERGUNTA);
  const historico = Array.isArray(corpo.historico) ? corpo.historico : [];

  let imagem = null;
  if (corpo.imagem && typeof corpo.imagem === "object") {
    const mimeType = String(corpo.imagem.mimeType || "");
    const dados = String(corpo.imagem.dados || "").replace(/^data:[^;]+;base64,/, "");
    if (!MIME_IMAGEM_PERMITIDO.has(mimeType)) {
      return json(res, 400, { erro: "Formato de imagem nao suportado." });
    }
    if (!dados || dados.length > MAX_IMAGEM_BASE64) {
      return json(res, 400, { erro: "Imagem vazia ou grande demais." });
    }
    imagem = { mimeType, dados };
  }

  if (!pergunta && !imagem) return json(res, 400, { erro: "pergunta vazia" });

  try {
    const resposta = await perguntarGemini(historico, pergunta, imagem);
    json(res, 200, { resposta });
  } catch (e) {
    console.error("Erro ao responder:", e.message);
    json(res, 502, {
      erro: "Tive um probleminha pra responder agora. Tenta de novo em instantes. 😥",
    });
  }
});

servidor.listen(PORT, "127.0.0.1", () => {
  carregarSite(true);
  console.log(`🧭 Claudio no ar em http://127.0.0.1:${PORT} (modelo: ${GEMINI_MODEL})`);
});
