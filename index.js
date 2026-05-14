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

    // =========================
    // PHRASES CONTENANT LES MOTS
    // =========================

    if (cleaned.includes("avec quoi")) {
        return isUpper ? "AVEC FEUR" : "Avec feur";
    }

    if (cleaned.includes("avec qui")) {
        return isUpper ? "AVEC QUETTE" : "Avec quette";
    }

    if (cleaned.includes("pour quoi faire")) {
        return isUpper ? "POUR FAIRE FEUR" : "Pour faire feur";
    }

    if (cleaned.includes("pour quoi")) {
        return isUpper ? "POUR FEUR" : "Pour feur";
    }

    if (cleaned.includes("pour qui")) {
        return isUpper ? "POUR QUETTE" : "Pour quette";
    }

    if (cleaned.includes("pourquoi")) {
        return isUpper ? "POURFEUR" : "Pourfeur";
    }

    if (cleaned.includes("c est a quoi") || cleaned.includes("cest a quoi")) {
        return isUpper ? "À FEUR" : "À feur";
    }

    if (cleaned.includes("c est a qui") || cleaned.includes("cest a qui")) {
        return isUpper ? "À QUETTE" : "À quette";
    }

    if (cleaned.includes("non")) {
        return isUpper ? "BRIL" : "Bril";
    }

    const isCestQui = cleaned.includes("c est qui") || cleaned.includes("cest qui");
    const isCestQuoi = cleaned.includes("c est quoi") || cleaned.includes("cest quoi");

    if (isCestQui) {
        return isUpper ? "C'EST QUETTE" : "C'est quette";
    }

    if (isCestQuoi) {
        return isUpper ? "C'EST FEUR" : "C'est feur";
    }

    // =========================
    // MESSAGES EXACTS UNIQUEMENT
    // =========================

    if (cleaned === "de quoi") {
        return isUpper ? "DE FEUR" : "De feur";
    }

    if (cleaned === "de qui") {
        return isUpper ? "DE QUETTE" : "De quette";
    }

    if (cleaned === "hein") {
        return isUpper ? "DEUX" : "Deux";
    }

    if (cleaned === "de") {
        return isUpper ? "TROIS" : "Trois";
    }

    if (cleaned === "a" || cleaned === "ha" || cleaned === "ah") {
        return "B";
    }

    // =========================
    // QUOI / QUI CLASSIQUES
    // =========================

    const quoiRegex = /^(quoi+|kwa|kouwa|kua|quoient)$/i;
    const lower = cleaned.replace(/\s+/g, " ");

    const isQuoi = quoiRegex.test(lower);
    const isQui = lower === "qui";

    if (!isQuoi && !isQui) return null;

    // 🎲 vidéo
    if (Math.random() < 0.05) {
        return "VIDEO";
    }

    // QUI
    if (isQui) {
        return isUpper ? "QUETTE" : "Quette";
    }

    // QUOIENT
    if (lower === "quoient") {
        return isUpper ? "FEURENT" : "Feurent";
    }

    // QUOI
    if (lower.startsWith("quoi")) {
        if (Math.random() < 0.5) {
            return isUpper ? "QUOICOUBEH" : "Quoicoubeh";
        }

        return isUpper ? "FEUR" : "Feur";
    }

    // fallback
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
