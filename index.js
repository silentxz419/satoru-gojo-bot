require("dotenv").config();

const { Client, GatewayIntentBits } = require("discord.js");
const Groq = require("groq-sdk");
const fs = require("fs");

// 🤖 BOT
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// 🤖 IA
const apiKey = process.env.GROQ_API_KEY;

// ⚙️ CONFIG
let config = JSON.parse(fs.readFileSync("./config.json", "utf8"));

setInterval(() => {
  config = JSON.parse(fs.readFileSync("./config.json", "utf8"));
}, 3000);

// 🔄 recargar config
function loadConfig() {
  config = JSON.parse(fs.readFileSync("./config.json", "utf8"));
}

// 🚨 DATA
const warns = {};
const lastMessages = {};

// ========================
// 🚨 ANTI SPAM
// ========================
function isSpam(message) {
  const id = message.author.id;
  const now = Date.now();

  if (!lastMessages[id]) lastMessages[id] = [];

  lastMessages[id].push(now);
  lastMessages[id] = lastMessages[id].slice(-5);

  const diff = lastMessages[id][4] - lastMessages[id][0];

  return lastMessages[id].length === 5 && diff < 4000;
}

// ========================
// 🧠 TOXICIDAD
// ========================
function isToxic(message) {
  const text = message.content;

  const caps = text.length > 12 && text === text.toUpperCase();
  const spamSymbols = /([!?.])\1{3,}/.test(text);
  const repeated = /(.)\1{4,}/.test(text);

  return caps || spamSymbols || repeated;
}

// ========================
// 🚨 WARN SYSTEM
// ========================
async function addWarn(message) {
  const id = message.author.id;

  if (!warns[id]) warns[id] = 0;

  warns[id]++;

  message.channel.send(`⚠️ ${message.author}, advertencia ${warns[id]}/3`);

  const member = message.member;
  if (!member) return;

  // 🔇 MUTE
  if (warns[id] >= config.muteAfterWarns) {
    try {
      await member.timeout(config.muteTime);
      message.channel.send(`🔇 ${message.author.tag} fue silenciado.`);
    } catch (e) {}
  }

  // 🚫 BAN
  if (warns[id] >= config.banAfterWarns) {
    try {
      await member.ban();
      message.channel.send(`🚫 ${message.author.tag} fue baneado.`);
    } catch (e) {}

    warns[id] = 0;
  }
}

// ========================
// 💬 MESSAGE EVENT
// ========================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // 🚫 CANALES BLOQUEADOS
  if (config.blockedChannels.includes(message.channel.id)) return;

  // 🚫 @everyone
  if (message.mentions.everyone) {
    await message.delete().catch(() => {});
    return;
  }

  // 🚫 SPAM
  if (config.antiSpam && isSpam(message)) {
    await message.delete().catch(() => {});
    await addWarn(message);
    return;
  }

  // 🚨 TOXICIDAD
  if (config.antiToxic && isToxic(message)) {
    await message.delete().catch(() => {});
    await addWarn(message);
    return;
  }

  // 😂 MEME
  if (message.content.toLowerCase() === "!meme") {
    return message.reply("https://i.imgflip.com/1bij.jpg");
  }

  // 🔒 BLOQUEAR CANAL
  if (message.content.startsWith("!block")) {
    const id = message.channel.id;

    if (!config.blockedChannels.includes(id)) {
      config.blockedChannels.push(id);

      fs.writeFileSync("./config.json", JSON.stringify(config, null, 2));

      return message.reply("🚫 Canal bloqueado para el bot.");
    }
  }

  // 🔓 DESBLOQUEAR CANAL
  if (message.content.startsWith("!unblock")) {
    const id = message.channel.id;

    config.blockedChannels = config.blockedChannels.filter(c => c !== id);

    fs.writeFileSync("./config.json", JSON.stringify(config, null, 2));

    return message.reply("✅ Canal desbloqueado.");
  }

  // 🤖 IA
  if (!config.aiEnabled) return;
  if (!message.mentions.has(client.user)) return;

  try {
    const res = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "Eres un asistente de Discord. Eres calmado, útil y respetuoso. Respondes corto y claro."
        },
        {
          role: "user",
          content: message.content.replace(/<@!?\\d+>/g, "").trim()
        }
      ],
      model: "llama-3.3-70b-versatile"
    });

    message.reply(res.choices[0].message.content);

  } catch (err) {
    message.reply("❌ Error IA.");
  }
});

// 🚀 READY
client.once("ready", () => {
  console.log(`Conectado como ${client.user.tag}`);
});

// 🔑 LOGIN
const token = process.env.DISCORD_TOKEN;
