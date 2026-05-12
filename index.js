require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

function getResponse(content) {
    const raw = content;

    const cleaned = raw
        .toLowerCase()
        .replace(/[^a-zàâçéèêëîïôûùüÿñæœ\s]/gi, "")
        .replace(/\s+/g, " ")
        .trim();

    const isUpper = raw === raw.toUpperCase();

    const isCestQui = cleaned.includes("c est qui") || cleaned.includes("cest qui");
    const isCestQuoi = cleaned.includes("c est quoi") || cleaned.includes("cest quoi");

    if (isCestQui) {
        return isUpper ? "C'EST QUETTE" : "C'est quette";
    }

    if (isCestQuoi) {
        return isUpper ? "C'EST FEUR" : "C'est feur";
    }

    const quoiRegex = /^(quoi+|kwa|kouwa|kua|quoient)$/i;
    const lower = cleaned.replace(/\s+/g, " ");

    const isQuoi = quoiRegex.test(lower);
    const isQui = lower === "qui";

    if (!isQuoi && !isQui) return null;

    if (Math.random() < 0.05) {
        return "VIDEO";
    }

    if (isQui) {
        return isUpper ? "QUETTE" : "Quette";
    }

    if (lower === "quoient") {
        return isUpper ? "FEURENT" : "Feurent";
    }

    if (lower.startsWith("quoi")) {
        if (Math.random() < 0.5) {
            return isUpper ? "QUOICOUBEH" : "Quoicoubeh";
        }
        return isUpper ? "FEUR" : "Feur";
    }

    return isUpper ? "FEUR" : "Feur";
}

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const response = getResponse(message.content);

    if (!response) return;

    if (response === "VIDEO") {
        await message.reply("https://www.coiffbot.fr/feur.mp4");
        return;
    }

    await message.reply(response);
});

client.once('ready', () => {
    console.log(`${client.user.tag} est connecté`);
});

client.login(process.env.TOKEN);