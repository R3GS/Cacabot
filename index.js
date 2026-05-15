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
    const command = raw.trim().toLowerCase().split(" ")[0];

    const cleaned = raw
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // enlève les accents
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();

    const isUpper =
        raw.length > 0 &&
        raw === raw.toUpperCase() &&
        raw !== raw.toLowerCase();

    const reply = (normal, upper = normal.toUpperCase()) =>
        isUpper ? upper : normal;

    // =========================
    // PHRASES CONTENANT LES MOTS
    // =========================

    if (cleaned.includes("henry tran") || cleaned.includes("singapour")) {

        const videos = [
            "https://cdn.discordapp.com/attachments/1128032964924670053/1504609617638854817/SINGAPOUR_1.mp4",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1504609645313134824/SINGAPOUR_2.mp4"
        ];

        return Math.random() < 0.5 ? videos[0] : videos[1];
    }

    if (cleaned.includes("avec quoi")) {
        return isUpper ? "AVEC FEUR" : "Avec feur";
    }

    if (cleaned.endsWith("oui")) {
        return isUpper ? "STITI" : "Stiti";
    }

    if (cleaned.includes("bac blanc")) {
        return "https://cdn.discordapp.com/attachments/720057528867618909/1504075425985466481/1778669924015-18e38746e64899fb.png";
    }

    if (cleaned.includes("lexys")) {
        return "https://cdn.discordapp.com/attachments/720057528867618909/1498102442200404120/bac_blanc.gif";
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

    if (cleaned.includes("c est a quoi")) {
        return isUpper ? "C'EST À FEUR" : "C'est à feur";
    }

    if (cleaned.includes("cest a quoi")) {
        return isUpper ? "C'EST À FEUR" : "C'est à feur";
    }

    if (cleaned.includes("c est à quoi")) {
        return isUpper ? "C'EST À FEUR" : "C'est à feur";
    }

    if (cleaned.includes("cest à quoi")) {
        return isUpper ? "C'EST À FEUR" : "C'est à feur";
    }

    if (cleaned.includes("c est à qui")) {
        return isUpper ? "C'EST À QUETTE" : "C'est à quette";
    }

    if (cleaned.includes("cest à qui")) {
        return isUpper ? "C'EST À QUETTE" : "C'est à quette";
    }

    if (cleaned.includes("c est a qui")) {
        return isUpper ? "C'EST À QUETTE" : "C'est à quette";
    }

    if (cleaned.includes("cest a qui")) {
        return isUpper ? "C'EST À QUETTE" : "C'est à quette";
    }

    if (cleaned === "67" || cleaned.includes(" 67 ") || cleaned.startsWith("67 ") || cleaned.endsWith(" 67")) {
        return "https://media.discordapp.net/attachments/1480734932933542049/1504170153317761085/67.gif";
    }

    if (cleaned.includes("SIX SEVEN")) {
        return "https://media.discordapp.net/attachments/1480734932933542049/1504170153317761085/67.gif";
    }

    if (cleaned === "monster" || cleaned.includes(" monster ") || cleaned.startsWith("monster ") || cleaned.endsWith("monster")) {
        return "https://cdn.discordapp.com/attachments/1480756332373213275/1504649546045718758/pape_monster.png";
    }

    if (cleaned.includes("https://tenor.com/view/markiplier-mark-thumbs-up-nice-job-good-job-gif-25373350")) {
        return "https://tenor.com/view/markiplier-mark-thumbs-up-nice-job-good-job-gif-25373350";
    }

    if (cleaned.includes("cadillac")) {
        return "https://media.discordapp.net/attachments/720057528867618910/1496418452099825674/cadillac-removebg-preview.png";
    }

    if (cleaned.endsWith("non")) {
        return isUpper ? "BRIL" : "Bril";
    }

    if (cleaned.endsWith("bite")) {
        return isUpper ? "QUOICOUBITE" : "Quoicoubite";
    }

    if (cleaned.includes("c est qui")) {
        return isUpper ? "C'EST QUETTE" : "C'est quette";
    }

    if (cleaned === "ntm jax") {
        return "https://cdn.discordapp.com/attachments/1206232717444775956/1504653708770672741/Capture_decran_2026-05-15_031617.png";
    }

    if (raw.toLowerCase().match(/!aternos\b/)) {
    return "L'IP du serveur Minecraft de Regaïa est : papierprout.aternos.me";
}

    if (command === "!epsys") {
        const gifs = [
            "https://cdn.discordapp.com/attachments/1480734932933542049/1504170153317761085/67.gif",
            "https://cdn.discordapp.com/attachments/1480734932933542049/1504168424136245368/Caramell_Dansen.gif",
            "https://cdn.discordapp.com/attachments/720057528867618909/1486636493417222216/2a088883-36e7-4eb4-ab2c-0d4942e21bfb.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1478476705642319985/ezgif-403e246b59051aa3.gif",
            "https://tenor.com/view/r3gs_-capuche-love-hearts-gif-22642553",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1478480836683759636/ezgif-4910f713e8f8f838.gif"
        ];

    return gifs[Math.floor(Math.random() * gifs.length)];
}

    if (cleaned.includes("cest qui")) {
        return isUpper ? "C'EST QUETTE" : "C'est quette";
    }

    if (cleaned.includes("c est quoi")) {
        return isUpper ? "C'EST FEUR" : "C'est feur";
    }

    if (cleaned.includes("cest quoi")) {
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
