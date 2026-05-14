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

    if (cleaned.includes("henry tran") || cleaned.includes("singapour")) {

        const videos = [
            "https://cdn.discordapp.com/attachments/1128032964924670053/1504609617638854817/SINGAPOUR_1.mp4?ex=6a079c67&is=6a064ae7&hm=e1c735cf1832acf172f04f26eee64b86e97b23625a6855d105587e9617175c68&",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1504609645313134824/SINGAPOUR_2.mp4?ex=6a079c6d&is=6a064aed&hm=4223c4b92b57102d627f85725af9e8efe96d001f08ba0830bb916add15a73583&"
        ];

        return Math.random() < 0.5 ? videos[0] : videos[1];
    }
    
    if (cleaned.includes("avec quoi")) {
        return isUpper ? "AVEC FEUR" : "Avec feur";
    }

    if (cleaned.endsWith("oui")) {
    return isUpper ? "STITI" : "Stiti";
    }
    
    if (cleaned.includes("avec qui")) {
        return isUpper ? "AVEC QUETTE" : "Avec quette";
    }

        if (cleaned.includes("test")) {
        return isUpper ? "ECHO ?" : "Echo ?";
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

    if (cleaned.endsWith("non")) {
        return isUpper ? "BRIL" : "Bril";
    }

    if (cleaned.endsWith("bite")) {
        return isUpper ? "QUOICOUBITE" : "Quoicoubite";
    }

    const isCestQui = cleaned.includes("c est qui") || cleaned.includes("cest qui");
    const isCestQuoi = cleaned.includes("c est quoi") || cleaned.includes("cest quoi");

    if (isCestQui) {
        return isUpper ? "C'EST QUETTE" : "C'est quette";
    }

    if (isCestQuoi) {
        return isUpper ? "C'EST FEUR" : "C'est feur";
    }
   
    if (cleaned.includes("de quoi")) {
        return isUpper ? "DE FEUR" : "De feur";
    }

    if (cleaned.includes("de qui")) {
        return isUpper ? "DE QUETTE" : "De quette";
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
