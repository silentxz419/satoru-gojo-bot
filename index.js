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
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// ⚙️ CONFIG
let config = {
  blockedChannels: []
};

// 🚨 DATA
const warns = {};
const lastMessages = {};

// 🚫 PALABRAS (base)
const badWords = [
  "idiota",
  "boludo",
  "imbecil",
  "estupido",
  "tonto",
  "gil",
  "tarado"
];

// 🧠 DETECCIÓN MEJORADA
function isBadMessage(text) {
  const msg = text.toLowerCase();

  return badWords.some(word =>
    msg.includes(word)
  );
}

// 🚨 ANTI SPAM
function isSpam(message) {
  const userId = message.author.id;
  const now = Date.now();

  if (!lastMessages[userId]) {
    lastMessages[userId] = [];
  }

  lastMessages[userId].push(now);

  // solo últimos 5 mensajes
  lastMessages[userId] = lastMessages[userId].slice(-5);

  const diff = lastMessages[userId][4] - lastMessages[userId][0];

  return lastMessages[userId].length === 5 && diff < 4000;
}

// 💬 EVENTO
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // 🚫 bloquear @everyone y @here correctamente
  if (message.mentions.everyone) {
    console.log("Bloqueado @everyone/@here");
    return;
  }

  // 🔥 DEBUG (opcional)
  console.log("Mensaje:", message.content);

  // 👇 TU LÓGICA DEL BOT AQUÍ
});

  if (config.blockedChannels.includes(message.channel.id)) return;

  const userId = message.author.id;

  // 🚫 SPAM
  if (isSpam(message)) {
    await message.delete().catch(() => {});

    message.channel.send(`⚠️ ${message.author}, no hagas spam.`);

    addWarn(message, userId);
    return;
  }

  // 🚫 INSULTOS
  if (isBadMessage(message.content)) {
    await message.delete().catch(() => {});

    addWarn(message, userId);
    return;
  }

  // 😂 MEME
  if (message.content.toLowerCase() === "!meme") {
    return message.reply("https://i.imgflip.com/1bij.jpg");
  }

  // 🤖 IA
  if (!message.mentions.has(client.user)) return;

  try {
    const response = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "Eres Satoru Gojo. Respondes sobre todo un poco y no hables con mucha confianza"
        },
        {
          role: "user",
          content: message.content.replace(/<@!?\\d+>/g, "").trim()
        }
      ],
      model: "llama-3.3-70b-versatile"
    });

    message.reply(response.choices[0].message.content);

  } catch (err) {
    message.reply("❌ Error IA.");
  }
});

// 🚨 SISTEMA DE WARNS PRO
async function addWarn(message, userId) {
  if (!warns[userId]) warns[userId] = 0;

  warns[userId]++;

  message.channel.send(
    `⚠️ ${message.author}, advertencia ${warns[userId]}/3`
  );

  const member = message.guild.members.cache.get(userId);
  if (!member) return;

  // 🔥 3 WARN = MUTE / BAN
  if (warns[userId] === 3) {
    try {
      await member.timeout(60 * 1000 * 10); // 10 min mute
      message.channel.send(`🔇 ${message.author.tag} muteado por 10 minutos.`);
    } catch (e) {}

  } else if (warns[userId] >= 5) {
    try {
      await member.ban();
      message.channel.send(`🚫 ${message.author.tag} fue baneado.`);
    } catch (e) {}

    warns[userId] = 0;
  }
}

client.login(process.env.DISCORD_TOKEN);
