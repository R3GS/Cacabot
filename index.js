require('dotenv').config();
const fs = require('fs');

const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// =========================
// FEUR STATS STORAGE
// =========================

const STATS_FILE = "./feurStats.json";

const feurStats = fs.existsSync(STATS_FILE)
    ? JSON.parse(fs.readFileSync(STATS_FILE, "utf8"))
    : {};

function saveStats() {
    fs.writeFileSync(STATS_FILE, JSON.stringify(feurStats, null, 2));
}

// =========================
// MAIN LOGIC
// =========================

function getResponse(content, message) {
    const raw = content;
    const command = raw.trim().toLowerCase().split(" ")[0];

    const cleaned = raw
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();

    const isUpper =
        raw.length > 0 &&
        raw === raw.toUpperCase() &&
        raw !== raw.toLowerCase();

    // =========================
    // COMMANDES
    // =========================

    if (raw.toLowerCase().match(/!aternos\b/)) {
        return "L'IP actuelle du serveur Minecraft de Regaïa est : **papierprout.aternos.me**";
    }

    if (raw.toLowerCase().match(/!discord\b/)) {
        return "Si vous souhaitez inviter vos ami.es, voici le lien d'invitation du serveur Discord : ** https://discord.com/invite/maAbUYb **";
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

    // =========================
    // FEUR COMMAND
    // =========================

    if (raw.toLowerCase().startsWith("!feur")) {
        const user = message.mentions.users.first();

        if (!user) {
            return "Mentionne quelqu'un : !feur @pseudo";
        }

        const id = user.id;
        const stats = feurStats[id];

        const total = stats ? (stats.feur + stats.feurent) : 0;

        const isSelf = user.id === message.author.id;

        if (!stats || total === 0) {
            return isSelf
                ? "Tu ne t'es jamais fait feurisé.e !"
                : `${user.username} ne s'est jamais fait feurisé.e !`;
        }

        return isSelf
            ? `Tu t'es fait feurisé.e ${total} fois !`
            : `${user.username} s'est fait feurisé.e ${total} fois !`;
    }

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

    if (cleaned.includes("avec quoi")) return isUpper ? "AVEC FEUR" : "Avec feur";
    if (cleaned.endsWith("oui")) return isUpper ? "STITI" : "Stiti";

    if (cleaned.includes("bac blanc")) {
        return "https://cdn.discordapp.com/attachments/720057528867618909/1504075425985466481/1778669924015-18e38746e64899fb.png";
    }

    if (cleaned.includes("lexys")) {
        return "https://cdn.discordapp.com/attachments/720057528867618909/1498102442200404120/bac_blanc.gif";
    }

    if (cleaned.includes("avec qui")) return isUpper ? "AVEC QUETTE" : "Avec quette";
    if (cleaned.includes("pourquoi")) return isUpper ? "POURFEUR" : "Pourfeur";

    if (cleaned.includes("67") || cleaned.includes("six seven")) {
        return "https://media.discordapp.net/attachments/1480734932933542049/1504170153317761085/67.gif";
    }

    if (cleaned.includes("monster")) {
        return "https://cdn.discordapp.com/attachments/1480756332373213275/1504649546045718758/pape_monster.png";
    }

    if (cleaned.endsWith("non")) return isUpper ? "BRIL" : "Bril";
    if (cleaned.endsWith("bite")) return isUpper ? "QUOICOUBITE" : "Quoicoubite";

    if (cleaned === "ntm jax") {
        return "https://cdn.discordapp.com/attachments/1206232717444775956/1504653708770672741/Capture_decran_2026-05-15_031617.png";
    }

    if (cleaned === "hein") return isUpper ? "DEUX" : "Deux";
    if (cleaned === "de") return isUpper ? "TROIS" : "Trois";
    if (cleaned === "a" || cleaned === "ha" || cleaned === "ah") return "B";

    return null;
}

// =========================
// MESSAGE HANDLER
// =========================

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const response = getResponse(message.content, message);

    if (!response) return;

    // =========================
    // FEUR TRACKING (FIXED)
    // =========================

    const target = message.mentions.users.first();

    if (target) {
        const id = target.id;

        if (!feurStats[id]) {
            feurStats[id] = { feur: 0, feurent: 0 };
        }

        const text = message.content.toLowerCase();

        if (text.includes("feurent")) {
            feurStats[id].feurent++;
        } else if (text.includes("feur")) {
            feurStats[id].feur++;
        }

        saveStats();
    }

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