require('dotenv').config();

let topData = { messages: {} };
let birthdayData = { birthdays: {}, channels: {} };
let dailyData = {};
let weeklyData = {};
let monthlyData = {};
let youtubeWatchData = {};
let reactionRolesData = {}; // messageId -> { channelId, roles: { emojiKey: roleId } }
let motusData = { dateKey: 0, mot: '', termine: false, vainqueurId: null, tentatives: {}, messageId: null };
let motusStats = {}; // userId -> { victoires: number, parties: number }
let rebusStats = {};
let twitchLiveEnCours = false;
let quotesData = []; // [{ id, texte, authorId, authorName, addedById, timestamp, channelId }]
let welcomeData = { channelId: null, actif: true };
let dernierCommitSha = null;
let donneesChargees = false;
const suggestionsData = new Map();

const BACKUP_CHANNEL_ID = '1556005171744604161';

function getCommitCount() {
    try {
        const { execSync } = require('child_process');
        return execSync('git rev-list --count HEAD').toString().trim();
    } catch (e) {
        return null;
    }
}

async function loadAll() {
    try {
        const channel = await client.channels.fetch(BACKUP_CHANNEL_ID).catch(() => null);
        let jsonRecord = null;

        // 1. Cherche d'abord le dernier fichier de sauvegarde dans ton salon Discord
        if (channel) {
            const messages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
            const backupMsg = messages?.find(m => m.attachments.size > 0 && m.attachments.first().name.endsWith('.json'));

            if (backupMsg) {
                const fileUrl = backupMsg.attachments.first().url;
                const res = await fetch(fileUrl);
                jsonRecord = await res.json();
                console.log('✅ Données chargées depuis le salon de backup Discord !');
            }
        }

        // Le chargement se fait désormais à 100% depuis le salon Discord <#1553954760900608091> ou #json

        if (!jsonRecord) {
            console.warn('⚠️ Aucune donnée précédente trouvée, démarrage à zéro.');
            donneesChargees = true;
            return;
        }

        topData = { messages: jsonRecord.messages ?? {} };
        birthdayData = { birthdays: jsonRecord.birthdays ?? {}, channels: jsonRecord.birthdayChannels ?? {} };
        dailyData = jsonRecord.daily ?? {};
        weeklyData = jsonRecord.weekly ?? {};
        monthlyData = jsonRecord.monthly ?? {};
        youtubeWatchData = jsonRecord.youtubeWatch ?? {};
        reactionRolesData = jsonRecord.reactionRoles ?? {};
        motusData = jsonRecord.motusData ?? { dateKey: 0, mot: '', termine: false, vainqueurId: null, tentatives: {}, messageId: null };
        motusStats = jsonRecord.motusStats ?? {};
        rebusStats = jsonRecord.rebusStats ?? {};
        quotesData = jsonRecord.quotes ?? [];
        welcomeData = jsonRecord.welcomeData ?? { channelId: null, actif: true };
        dernierCommitSha = jsonRecord.dernierCommitSha ?? null;

        for (const [nom, map] of Object.entries(ROULETTE_ETATS)) {
            map.clear();
            for (const [k, v] of Object.entries(jsonRecord.roulette?.[nom] ?? {})) map.set(k, v);
        }

        donneesChargees = true;
        console.log('✅ Toutes les données ont été appliquées avec succès !');

        // Si le salon était vide, on y dépose immédiatement le premier fichier de sauvegarde
        if (channel) {
            const messages = await channel.messages.fetch({ limit: 1 }).catch(() => null);
            if (!messages || messages.size === 0) {
                await saveAll();
            }
        }
    } catch (err) {
        console.error('Erreur chargement des données:', err);
    }
}

let lastsaveSaveTime = null;
let messagesSinceLastsaveSave = 0;

async function saveAll() {
    if (!donneesChargees) { console.warn('⚠️ Sauvegarde ignorée : données non chargées'); return; }
    try {
        const channel = await client.channels.fetch(BACKUP_CHANNEL_ID).catch(() => null);
        if (!channel) {
            console.error('❌ Salon de sauvegarde introuvable ! Vérifie l\'ID ou les permissions de Cacabot.');
            return;
        }

        const payload = {
            messages: topData.messages,
            birthdays: birthdayData.birthdays,
            birthdayChannels: birthdayData.channels,
            daily: dailyData,
            weekly: weeklyData,
            monthly: monthlyData,
            youtubeWatch: youtubeWatchData,
            reactionRoles: reactionRolesData,
            motusData: motusData,
            motusStats: motusStats,
            rebusStats: rebusStats,
            quotes: quotesData,
            welcomeData: welcomeData,
            dernierCommitSha: dernierCommitSha,
            roulette: Object.fromEntries(
                Object.entries(ROULETTE_ETATS).map(([nom, map]) => [nom, Object.fromEntries(map)])
            )
        };

        const jsonStr = JSON.stringify(payload, null, 2);
        const buffer = Buffer.from(jsonStr, 'utf-8');

        const now = new Date();
        const dateStr = now.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' }) + ' à ' + now.toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris' });

        await channel.send({
            content: `💾 **Sauvegarde Cacabot** — \`${dateStr}\``,
            files: [{ attachment: buffer, name: 'cacabot_backup.json' }]
        });

        lastsaveSaveTime = new Date();
        console.log(`💾 Nouvelle sauvegarde postée dans #${channel.name}`);

        // Nettoie automatiquement le salon pour ne garder que les 10 dernières sauvegardes
        const messages = await channel.messages.fetch({ limit: 25 }).catch(() => null);
        if (messages && messages.size > 10) {
            const aSupprimer = [...messages.values()].slice(10);
            for (const m of aSupprimer) {
                await m.delete().catch(() => {});
            }
        }
    } catch (err) {
        console.error('Erreur sauvegarde Discord:', err);
    }
}

setInterval(() => saveAll(), 30 * 60 * 1000); // Sauvegarde automatique toutes les 30 minutes

let saveEnAttente = null;
function demanderSauvegarde() {
    if (saveEnAttente) return;
    saveEnAttente = setTimeout(async () => {
        saveEnAttente = null;
        await saveAll().catch(() => {});
    }, 10000);
}

process.on('SIGTERM', async () => {
    console.log('🛑 SIGTERM reçu, sauvegarde avant arrêt...');
    await saveAll();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('🛑 SIGINT reçu, sauvegarde avant arrêt...');
    await saveAll();
    process.exit(0);
});

// Aliases pour compatibilite
const saveTop = saveAll;
const saveBirthdays = saveAll;

const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ButtonBuilder,
    ChannelType,
    ButtonStyle,
    SlashCommandBuilder,
    REST,
    Routes
} = require('discord.js');

const { createCanvas, loadImage, registerFont } = require('canvas');

process.env.PANGOCAIRO_BACKEND = 'fontconfig';
const fs = require('fs');
try { 
    registerFont('./LEMONMILK-Bold.otf', { family: 'LEMONMILK' }); 
} catch(e) { 
    console.error('Font non trouvée:', e.message); 
}

// =========================
//      INTERSECTIONS
// =========================

///!destin
const { getDestinReponse } = require('./destin.js');

///!horoscope
const { getHoroscopeForSign, buildHoroscopeEmbed, execute: executeHoroscope } = require('./horoscope.js');

///animal.js
const { getAnimalResponse } = require('./animal.js');

///interaction.js
const { handleInteractionMessage, handleInteractionButton } = require('./interaction.js');

///help.js
const { getHelpResponse, handleHelpMessage, handleHelpInteraction } = require('./help.js');

///minijeux.js
const {
    MOTUS_CHANNEL_ID,
    initMinijeuxState,
    envoyerMotusQuotidien,
    lancerSessionRebus,
    handleMotusMessage,
    handleMotusButton,
    handleMotusSlash,
    handleRebusMessage,
    handleRebusButton,
    handleRebusSlash
} = require('./minijeux.js');

///social.js
const {
    resoudreChoix,
    handleSocialMessage,
    handleSocialSlash,
    handleSocialInteraction
} = require('./social.js');

///roulette.js
const {
    ROULETTE_ETATS,
    initRouletteBridge,
    verifierHappyHour,
    initialiserWebhooksRoulette,
    assurerWebhookRoulette,
    armerNotifRoulette,
    deverrouillerSucces,
    rouletteNotifs,
    rouletteAntiFeurUntil,
    rouletteAntiFeurDodges,
    rouletteAchievements,
    rouletteStats,
    rouletteBouclierActif,
    handleRouletteMessage,
    handleRouletteSlash,
    handleRouletteButton,
    handleRouletteCouronne,
    handleRouletteTransfoMessage,
    handleRoulettePseudoLock
} = require('./roulette.js');

///embeds.js
const {
    handleEmbedMessage,
    handleEmbedSlash,
    handleEmbedInteraction
} = require('./embeds.js');

///youtube.js
const {
    handleYoutubeMessage,
    handleYoutubeSlash,
    handleYoutubeButton
} = require('./youtube.js');

///anniversaire.js
const {
    initBirthdayState,
    getGuildBirthdays,
    getBirthdayChannelId,
    estAnniversaireAujourdhui,
    scheduleBirthdayCheck,
    handleAnniversaireMessage,
    handleAnniversaireSlash,
    handleAnniversaireButton
} = require('./anniversaire.js');

///security.js
const {
    initSecurityState,
    estModo,
    isChannelMuted,
    handleSecurityMessage,
    handleSecurityInteraction,
    handleSecurityMemberAdd,
    handleSecurityReactionAdd,
    handleSecurityReactionRemove
} = require('./security.js');

///quotes.js
const {
    initQuotesState,
    handleQuotesMessage,
    handleQuotesSlash,
    handleQuotesButton
} = require('./quotes.js');

initBirthdayState({
    getBirthdayData: () => birthdayData,
    saveBirthdays: async () => saveAll(),
    findMemberByName,
    askDisambiguation,
    EPSYS_ID: '436218312574107658'
});

initQuotesState({
    getQuotesData: () => quotesData,
    demanderSauvegarde,
    findMemberByName,
    estModo,
    EPSYS_ID: '436218312574107658'
});

///welcome.js
const {
    initWelcomeState,
    handleWelcomeMessage,
    handleWelcomeSlash,
    handleWelcomeInteraction,
    handleWelcomeMemberAdd
} = require('./welcome.js');

initWelcomeState({
    getWelcomeData: () => welcomeData,
    demanderSauvegarde,
    EPSYS_ID: '436218312574107658'
});

///tools.js
const {
    initToolsState,
    handleToolsMessage,
    handleToolsSlash,
    handleToolsInteraction
} = require('./tools.js');

initMinijeuxState({
    getMotusData: () => motusData,
    setMotusData: (d) => { motusData = d; },
    getMotusStats: () => motusStats,
    setMotusStats: (s) => { motusStats = s; },
    getRebusStats: () => rebusStats,
    setRebusStats: (s) => { rebusStats = s; },
    demanderSauvegarde: () => demanderSauvegarde()
});

initRouletteBridge({
    topData,
    demanderSauvegarde,
    saveAll,
    estAnniversaireAujourdhui,
    estModo,
    EPSYS_ID: '436218312574107658',
    findMemberByName,
    askDisambiguation,
    suggestionsData
});


const lemonMilkPaths = [
    './LEMONMILK-Bold.otf',
    './LemonMilk-Bold.otf',
    './lemonmilk-bold.otf',
    './LemonMilk.otf',
    './LEMONMILK.otf',
    './assets/LEMONMILK-Bold.otf',
    './assets/LemonMilk-Bold.otf'
];
for (const p of lemonMilkPaths) {
    if (fs.existsSync(p)) {
        try {
            registerFont(p, { family: 'LemonMilk', weight: 'bold' });
            registerFont(p, { family: 'LemonMilk', weight: 'normal' });
            break;
        } catch(e) {}
    }
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

initToolsState({
    client,
    topData
});

///activity.js
const {
    initActivityState,
    handleActivityMessage,
    handleActivitySlash,
    handleActivityButton,
    cleanOldData,
    getTodayKey,
    getWeekKey,
    getMonthKey
} = require('./activity.js');

initActivityState({
    topData,
    dailyData,
    weeklyData,
    monthlyData,
    getGuildBirthdays,
    rouletteAchievements,
    rouletteStats,
    rouletteBouclierActif,
    getMotusStats: () => motusStats,
    getRebusStats: () => rebusStats,
    getQuotesData: () => quotesData,
    demanderSauvegarde,
    saveAll,
    findMemberByName,
    askDisambiguation,
    client,
    EPSYS_ID: '436218312574107658'
});

initSecurityState({
    getReactionRolesData: () => reactionRolesData,
    demanderSauvegarde,
    client,
    EPSYS_ID: '436218312574107658'
});

///watcher.js
const {
    verifierTwitchLive,
    handleWatcherMessage,
    handleVoiceStateUpdate
} = require('./watcher.js');

// =========================
//     DONNÉES WANTED
// =========================
// Déporté dans ./wanted.js

const FEUR_IMMUNE = ['1503495713097519355'];

// =========================
//     LOGIQUE MOTUS (10h & 19h)
// =========================
// Déporté dans ./minijeux.js

// =========================
//     FONCTION PRINCIPALE
// =========================

async function getResponse(raw) {
    const cleaned = raw
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s!]/g, "")
        .replace(/\s+/g, " ")
        .trim();

    const command = raw.trim().split(" ")[0].toLowerCase();

    const isUpper =
        raw.length > 0 &&
        raw === raw.toUpperCase() &&
        raw !== raw.toLowerCase();

    const reply = (normal, upper = normal.toUpperCase()) =>
        isUpper ? upper : normal;

    if (command === "!welcome" || command === "!bienvenue") {
        return { needsWelcome: true };
    }

    if (command === "!suggestion" || command === "!suggest" || command === "!sugg") {
        return { needsSuggestion: true };
    }

    // =========================
    //     COMMANDES UTILITAIRES
    // =========================

    if (raw.toLowerCase().match(/!aternos\b/)) {
        return "L'IP actuelle du serveur Minecraft de Rega\u00efa est : **papierprout.aternos.me**";
    }

    // =========================
    //        !BOUGETOI
    // =========================

    if (command === "!bougetoi" || command === "!montage" || command === "!video" || command === "!lavideo") {
        return { needsBougetoi: true };
    }

    // =========================
    //         !EPSYS
    // =========================

    if (command === "!epsys") {
        const gifs = [
            "https://cdn.discordapp.com/attachments/1480734932933542049/1504170153317761085/67.gif",
            "https://cdn.discordapp.com/attachments/1480734932933542049/1504168424136245368/Caramell_Dansen.gif",
            "https://cdn.discordapp.com/attachments/720057528867618909/1486636493417222216/2a088883-36e7-4eb4-ab2c-0d4942e21bfb.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1478476705642319985/ezgif-403e246b59051aa3.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1478480836683759636/ezgif-4910f713e8f8f838.gif",
            "https://cdn.discordapp.com/attachments/720079691041472572/1505409860970217574/epsys-dance.gif",
            "https://cdn.discordapp.com/attachments/720079691041472572/1513686805130510396/toupsys.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1513684027821920396/facepalm.gif",
            "https://cdn.discordapp.com/attachments/720079691041472572/1513683934490132611/spin2_1.gif",
            "https://cdn.discordapp.com/attachments/720057528867618910/1486127551771447486/eps.gif"
        ];

        return gifs[Math.floor(Math.random() * gifs.length)];
    }


    // =========================
    //         !SYLVAIN
    // =========================

    if (command === "!sylvain") {
        return { needsSylvain: true };
    }

    // !roulette, !rlt, !rltstate, !rltstats, !rlttop déportés dans roulette.js

    // =========================
    //         !MOTUS
    // =========================

    if (command === "!motus") {
        return { needsMotus: true };
    }

    if (command === "!motustats" || command === "!motustat") {
        return { needsMotusStats: true };
    }

    // =========================
    //         !REBUS
    // =========================

    if (command === "!rebus" || command === "!decodeur" || command === "!emojis") {
        return { needsRebus: true };
    }

    if (command === "!rebusstats" || command === "!rebusstat") {
        return { needsRebusStats: true };
    }

    // =========================
    //         !QUOTE
    // =========================

    if (command === "!quote" || command === "!citation") {
        return { needsQuote: true };
    }

    // !motus & !motustats sont pris en charge par handleMotusMessage ci-dessus

    // =========================
    //         !PRUNE
    // =========================

    if (command === "!youtube") {
        return { needsYoutube: true };
    }

    // =========================
    //        !YOUTUBE
    // =========================

    if (command === "!prune") {
        return { needsPrune: true };
    }

    // =========================
    //         !ANIMAL
    // =========================

    if (command === "!animal") {
        return { needsMention: true };
    }

    // =========================
    //        !LOVECALC
    // =========================

    if (command === "!lovecalc") {
        return { needsLovecalc: true };
    }

    // =========================
    //         !KISS
    // =========================

    if (command === "!kiss" || command === "!bisou") {
        return { needsKiss: true };
    }

    // =========================
    //         !KISS
    // =========================

    if (command === "!run" || command === "!court") {
        return { needsRun: true };
    }

    // =========================
    //         !HUG
    // =========================

    if (command === "!hug" || command === "!calin") {
        return { needsHug: true };
    }

    // =========================
    //         !DANSE
    // =========================

    if (command === "!danse" || command === "!dance") {
        return { needsDance: true };
    }

    // =========================
    //         !INSULTE
    // =========================

    if (command === "!insult") {
        return { needsInsult: true };
    }

    // =========================
    //         !RIRE
    // =========================

    if (command === "!rire") {
        return { needsLaugh: true };
    }

    // =========================
    //         !RIZZ
    // =========================

    if (command === "!rizz") {
        return { needsRizz: true };
    }

    // =========================
    //         !BANG
    // =========================

    if (command === "!bang" || command === "!tir" || command === "!pan") {
        return { needsBang: true };
    }

    // =========================
    //         !PUNCH
    // =========================

    if (command === "!punch" || command === "!frappe") {
        return { needsPunch: true };
    }

    // =========================
    //       INTERACTIONS
    // =========================

    if (command === "!cry" || command === "!pleure") {
        return { needsCry: true };
    }

    if (command === "!palaref" || command === "!pref") {
        return { needsPalaref: true };
    }
    
    if (command === "!jailaref" || command === "!glaref" || command === "!gref") {
        return { needsJailaref: true };
    }

    if (command === "!explode" || command === "!explose") {
        return { needsExplode: true };
    }

    if (command === "!bait") {
        return { needsBait: true };
    }

    if (command === "!ban") {
        return { needsBan: true };
    }

    if (command === "!die") {
        return { needsDie: true };
    }

    // =========================
    //         !PROFIL
    // =========================

    if (command === "!profil" || command === "!profile" || command === "!info") {
        return { needsProfil: true };
    }

    // =========================
    //         !AVATAR
    // =========================

    if (command === "!avatar") {
        return { needsAvatar: true };
    }

    // =========================
    //         !TOP
    // =========================

    if (command === "!anniversaire" || command === "!anniversairetest") {
        return { needsAnniversaire: true };
    }

    // =========================
    //         !FLIP
    // =========================

    if (command === "!flip") {
        return { needsFlip: true };
    }

    if (command === "!blague") {
        return { needsBlague: true };
    }

    if (command === "!topchef") {
        return { needsTopChef: true };
    }

    if (command === "!actif") {
        return { needsActif: true };
    }

    if (command === "!top") {
        return { needsTop: true };
    }

    // =========================
    //         !SETMESSAGES
    // =========================

    if (command === "!setmessages") {
        return { needsSetMessages: true };
    }

    // =========================
    //         !SERVEUR
    // =========================

    if (command === "!horoscope") {
        return { needsHoroscope: true };
    }

    if (command === "!meteo" || command === "!météo") {
        return { needsMeteo: true };
    }

    if (command === "!save") {
        return { needsSave: true };
    }

    if (command === "!streamtest") {
        return { needsStreamTest: true };
    }

    if (command === "!lastsave") {
        return { needsLastsave: true };
    }

    if (command === "!say") {
        return { needsSay: true };
    }

    if (command === "!edit") {
        return { needsEdit: true };
    }

    if (command === "!embed") {
        return { needsEmbed: true };
    }

    if (command === "!rolereac" || command === "!rr") {
        return { needsRoleReac: true };
    }

    if (command === "!rolebtn" || command === "!btnrole") {
        return { needsRoleBtn: true };
    }

    if (command === "!rappel") {
        return { needsRappel: true };
    }

    if (command === "!pomodoro") {
        return { needsPomodoro: true };
    }

    if (command === "!ping") {
        return { needsPing: true };
    }

    if (command === "!botinfo" || command === "!about" || command === "!abt") {
        return { needsInfo: true };
    }

    if (command === "!serveur") {
        return { needsServeur: true };
    }

    if (command === "!stats") {
        return { needsStats: true };
    }

    if (command === "!last") {
        return { needsLastVideo: true };
    }

    if (command === "!question") {
        return { needsQuestion: true };
    }

        if (command === "!destin") {
        return getDestinReponse();
    }

    // =========================
    // PHRASES CONTENANT LES MOTS
    // =========================

    if (/\bh?e+h?y?\s+p[e]+t[i]+t|\beh\s+p[e]+t[i]+t/i.test(cleaned)) return { needsHePetit: true };
    if (cleaned.includes("j ai menti") || cleaned.includes("jai menti")) return { files: ["./jai_menti.mp3"] };
    if (cleaned === "lele" || cleaned === "ley ley" || /^papayou+$/.test(cleaned)) return { files: ["./PAPAYOU.mp3"] };
    if (cleaned.includes("absolute cacabot")) return "https://cdn.discordapp.com/attachments/1128032964924670053/1514231086153207998/ABSOLUTE_CACABOT.gif";
    if (cleaned.includes("henry tran") || cleaned.includes("singapour")) {
        const videos = [
            "https://cdn.discordapp.com/attachments/1128032964924670053/1504609617638854817/SINGAPOUR_1.mp4",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1504609645313134824/SINGAPOUR_2.mp4"
        ];
        return Math.random() < 0.5 ? videos[0] : videos[1];
    }
    if (cleaned.includes("ou quoi")) return reply("Ou feur");
    if (cleaned.includes("avec quoi")) return reply("Avec feur");

    const motsOui = cleaned.replace(/!/g, '').trim().split(/\s+/);
    if (motsOui.length > 0 && motsOui.every(m => m === 'oui')) {
        const texteStiti = Array(motsOui.length).fill("stiti").join(" ");
        return reply(texteStiti.charAt(0).toUpperCase() + texteStiti.slice(1));
    }
    if (cleaned.endsWith("oui")) return reply("Stiti");
    if (
        (cleaned.includes("cacabot") || cleaned.includes("caca bot") || raw.includes("1503495713097519355")) &&
        (cleaned.includes("jtm") || cleaned.includes("je t aime") || cleaned.includes("je taime") || cleaned.includes("jt aime"))
    ) return { needsJtm: true };

    if (cleaned.includes("bac blanc")) {
        const bacBlanc = [
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505380065435717712/yard_stare.jpg",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505378497533579415/ghost.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505378497894551623/wwii.jpg",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505378498271772794/stare.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505378498695663738/catstare.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505378499404501112/homelander.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505378499744104468/chaise.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505378500075585696/gustavo.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505378501266510026/vietnam_cat.gif"
        ];
        return bacBlanc[Math.floor(Math.random() * bacBlanc.length)];
    }
    if (cleaned.includes("lexys")) return "https://cdn.discordapp.com/attachments/720057528867618909/1498102442200404120/bac_blanc.gif";
    if (cleaned.includes("pas le prouver")) return "https://tenor.com/rkdM8FYGZO4.gif";
    if (/\bavec qui\b/.test(cleaned)) return reply("Avec quette");
    if (cleaned.includes("pour quoi faire")) return reply("Pour faire feur");
    if (cleaned.includes("pour quoi")) return reply("Pour feur");
    if (cleaned.includes("pourquoi")) return reply("Pourfeur");
    if (cleaned.includes("c est a quoi")) return reply("C'est à feur");
    if (/\bc est a qui\b/.test(cleaned)) return reply("C'est à quette");
    if (
        cleaned === "67" ||
        cleaned.includes(" 67 ") ||
        cleaned.startsWith("67 ") ||
        cleaned.endsWith(" 67")
    ) return "https://media.discordapp.net/attachments/1480734932933542049/1504170153317761085/67.gif";
    if (cleaned.includes("six seven")) return "https://media.discordapp.net/attachments/1480734932933542049/1504170153317761085/67.gif";
    if (
        cleaned === "monster" ||
        cleaned.includes(" monster ") ||
        cleaned.startsWith("monster ") ||
        cleaned.endsWith("monster")
    ) return "https://cdn.discordapp.com/attachments/1480756332373213275/1504649546045718758/pape_monster.png";
    const motsNon = cleaned.replace(/!/g, '').trim().split(/\s+/);
    if (motsNon.length > 0 && motsNon.every(m => m === 'non')) {
        const texteBril = Array(motsNon.length).fill("bril").join(" ");
        return reply(texteBril.charAt(0).toUpperCase() + texteBril.slice(1));
    }
    if (cleaned.endsWith("non")) return reply("Bril");
    if (cleaned.endsWith("bite")) return reply("Quoicoubite");
    if (cleaned.includes("cest quoi")) return reply("C'est feur");
    if (cleaned.includes("de quoi")) return reply("De feur");
    if (cleaned === "de qui") return reply("De quette");
    if (cleaned.endsWith("quoi")) return reply("Feur");
    const voleurMots = ['feur', 'quette', 'stiti', 'pfeur', 'stitient', 'feurent', 'bril'];
    for (const mot of voleurMots) {
        if (cleaned.includes(' ' + mot + ' ') || cleaned === mot || cleaned.startsWith(mot + ' ') || cleaned.endsWith(' ' + mot)) {
            const motFormate = mot.charAt(0).toUpperCase() + mot.slice(1);
            return `"${motFormate}" ? Tu veux me voler mon job ?`;
        }
    }

    // =========================
    // MESSAGES EXACTS UNIQUEMENT
    // =========================

    if (cleaned === "hein") return reply("Deux");
    if (cleaned === "allo" || cleaned === "allô") return reply("À l'huile");
    if (cleaned === "de") return reply("Trois");
    if (cleaned === "ouient") return reply("Stitient");
    if (cleaned === "pq" || cleaned === "pk") return reply("Pfeur");
    if (cleaned === "a" || cleaned === "ha" || cleaned === "ah") return "B";
    if (cleaned === "c") return "Non on arrête la vanne ici";
    if (cleaned === "ntm jax") return "https://cdn.discordapp.com/attachments/1206232717444775956/1504653708770672741/Capture_decran_2026-05-15_031617.png";

    // =========================
    // QUOI / QUI CLASSIQUES
    // =========================

    const quoiRegex = /^(quoi+|kwa|kouwa|kua|quoient)$/i;
    const lower = cleaned.replace(/\s+/g, " ");
    const isQuoi = quoiRegex.test(lower);
    const isQui = lower === "qui";

    if (!isQuoi && !isQui) return null;

    if (Math.random() < 0.05) return "VIDEO";

    if (isQui) return reply("Quette");
    if (lower === "quoient") return reply("Feurent");
    if (lower.startsWith("quoi")) {
        if (Math.random() < 0.5) return reply("Quoicoubeh");
        return reply("Feur");
    }

    return reply("Feur");
}

const pendingCheh = new Map();
const cooldowns = new Map();

const vocalMessages = new Map();
const dernierMessageParUtilisateur = new Map();
const EPSYS_ID = '436218312574107658';

function buildSuggestionEmbed(data, authorMember) {
    const pourCount = data.pour.length;
    const contreCount = data.contre.length;
    const total = pourCount + contreCount;

    const pourPct = total > 0 ? Math.round((pourCount / total) * 100) : 0;
    const contrePct = total > 0 ? (100 - pourPct) : 0;

    let barre = '░░░░░░░░░░';
    if (total > 0) {
        const nbVert = Math.round((pourCount / total) * 10);
        const nbRouge = 10 - nbVert;
        barre = '🟩'.repeat(nbVert) + '🟥'.repeat(nbRouge);
    }

    const avatarUrl = authorMember?.user?.displayAvatarURL({ dynamic: true, size: 256 }) 
                   ?? authorMember?.displayAvatarURL?.({ dynamic: true, size: 256 });

    const embed = new EmbedBuilder()
        .setColor(0xd96b00)
        .setTitle('💡 NOUVELLE SUGGESTION')
        .setDescription(
            `**Proposition :**\n> ${data.texte}\n\n` +
            `**Auteur·rice :** <@${data.authorId}>\n\n` +
            `**Votes actuels :**\n` +
            `✅ **Pour :** ${pourCount} (${pourPct}%)\n` +
            `❌ **Contre :** ${contreCount} (${contrePct}%)\n\n` +
            `\`${barre}\``
        )
        .setFooter({ text: 'Clique sur un bouton pour voter ou modifier ton vote !\nUtilisez !suggestion pour soumettre vos idées' })
        .setTimestamp();

    if (avatarUrl) embed.setThumbnail(avatarUrl);
    return embed;
}

function buildSuggestionRow(data) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('sugg_vote_pour')
            .setLabel(`Pour (${data.pour.length})`)
            .setEmoji('✅')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('sugg_vote_contre')
            .setLabel(`Contre (${data.contre.length})`)
            .setEmoji('❌')
            .setStyle(ButtonStyle.Danger)
    );
}

// =========================
//           CHEH
// =========================

function checkCooldown(userId, cmd, seconds = 3) {
    const key = `${userId}_${cmd}`;
    const now = Date.now();
    if (cooldowns.has(key) && now - cooldowns.get(key) < seconds * 1000) return false;
    cooldowns.set(key, now);
    return true;
}
const CHEH_GIF = 'https://cdn.discordapp.com/attachments/1128032964924670053/1505363865137840180/cheh.gif';

// =========================
//     RECHERCHE PAR PSEUDO
// =========================

function findMemberByName(guild, query) {
    if (!guild) return { found: null, multiple: false, candidates: [] };
    const q = query.toLowerCase();

    const exact = guild.members.cache.filter(m =>
        (m.displayName && m.displayName.toLowerCase() === q) ||
        (m.user.username && m.user.username.toLowerCase() === q)
    );
    if (exact.size === 1) return { found: exact.first(), multiple: false, candidates: [] };
    if (exact.size > 1) {
        const candidates = exact.map(m => m.displayName ?? m.user.username);
        return { found: null, multiple: true, candidates };
    }

    const partial = guild.members.cache.filter(m =>
        (m.displayName && m.displayName.toLowerCase().includes(q)) ||
        (m.user.username && m.user.username.toLowerCase().includes(q))
    );
    if (partial.size === 0) return { found: null, multiple: false, candidates: [] };
    if (partial.size === 1) return { found: partial.first(), multiple: false, candidates: [] };
    const candidates = partial.map(m => m.displayName ?? m.user.username);
    return { found: null, multiple: true, candidates };
}

async function askDisambiguation(message, guild, candidates, callback) {
    const list = candidates.map(c => `* **${c}**`).join('\n');
    const prompt = await message.reply(`Il y a **${candidates.length}** personnes avec un pseudo similaire. Tu voulais parler de qui ? Essaie d'\u00eatre plus pr\u00e9cis.e !\n${list}`);

    const filter = m => m.author.id === message.author.id;
    const collector = message.channel.createMessageCollector({ filter, time: 20000 });

    collector.on('collect', m => {
        const q = m.content.trim().toLowerCase();
        const match = candidates.find(c => c.toLowerCase() === q);
        if (match) {
            collector.stop('found');
            m.delete().catch(() => {});
            prompt.delete().catch(() => {});
            const member = guild.members.cache.find(mb =>
                (mb.displayName && mb.displayName === match) ||
                (mb.user.username && mb.user.username === match)
            );
            if (member) callback(member.user);
        } else {
            const retry = candidates.map(c => `* **${c}**`).join('\n');
            message.reply(`Ce pseudo ne correspond pas exactement \u00e0 l'un des choix. Essaie encore !\n${retry}`)
                .then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));
            m.delete().catch(() => {});
        }
    });

    collector.on('end', (_, reason) => {
        if (reason !== 'found') {
            prompt.delete().catch(() => {});
            message.reply("Bon... On abandonne alors !").then(msg =>
                setTimeout(() => { msg.delete().catch(() => {}); message.delete().catch(() => {}); }, 3000)
            );
        }
    });
}

async function disableButtons(interaction) {
    try {
        const msg = interaction.message;
        const newRows = msg.components.map(row => {
            const newRow = new ActionRowBuilder();
            newRow.addComponents(row.components.map(btn => ButtonBuilder.from(btn).setDisabled(true)));
            return newRow;
        });
        await msg.edit({ components: newRows });
    } catch (e) {}
}

// =========================
//     LISTENER MESSAGES
// =========================

    // Ping Notifs Shorts quand Gappy sort un nouveau TikTok
    client.on('messageCreate', async (message) => {
        if (message.author.id === client.user.id) {
            topData.messages['1503495713097519355'] = (topData.messages['1503495713097519355'] || 0) + 1;
            return;
        }
        if (message.author.bot) return;

        // =========================
        //  COMMANDE DIAGNOSTIC (EPSYS)
        // =========================
        if (message.content.trim().toLowerCase() === '!diag' || message.content.trim().toLowerCase() === '!cacatest') {
            if (message.author.id !== '436218312574107658') return;

            const sent = await message.reply('🔍 **Diagnostic de Cacabot en cours...** Analyse de tous les modules...');

            const modules = [
                { nom: 'Roulette', obj: typeof handleRouletteMessage === 'function' && typeof ROULETTE_ETATS === 'object' },
                { nom: 'Tools & Utilitaires', obj: typeof handleToolsMessage === 'function' && typeof handleToolsSlash === 'function' },
                { nom: 'Minijeux (Motus/Rébus)', obj: typeof handleMotusMessage === 'function' && typeof handleRebusMessage === 'function' },
                { nom: 'Anniversaires', obj: typeof handleAnniversaireMessage === 'function' && typeof getGuildBirthdays === 'function' },
                { nom: 'Citations (Quotes)', obj: typeof handleQuotesMessage === 'function' && Array.isArray(quotesData) },
                { nom: 'Bienvenue (Canvas)', obj: typeof handleWelcomeMessage === 'function' },
                { nom: 'YouTube', obj: typeof handleYoutubeMessage === 'function' },
                { nom: 'Embeds (Epsys)', obj: typeof handleEmbedMessage === 'function' },
                { nom: 'Social & Jeux', obj: typeof handleSocialMessage === 'function' },
                { nom: 'Interactions', obj: typeof handleInteractionMessage === 'function' },
                { nom: 'Wanted', obj: typeof handleWantedMessage === 'function' },
                { nom: 'Help', obj: typeof handleHelpMessage === 'function' }
            ];

            const rapport = [];
            let modulesOk = 0;
            for (const m of modules) {
                if (m.obj) {
                    rapport.push(`✅ **${m.nom}** : Opérationnel`);
                    modulesOk++;
                } else {
                    rapport.push(`❌ **${m.nom}** : Incomplet ou non importé`);
                }
            }

            const backupChan = client.channels.cache.get(BACKUP_CHANNEL_ID);
            const backupOk = backupChan ? '✅ Connecté' : '❌ Salon introuvable';

            let meteoOk = '❌ Déconnecté';
            try {
                const resMeteo = await fetch('https://geocoding-api.open-meteo.com/v1/search?name=Paris&count=1&language=fr&format=json');
                if (resMeteo.ok) meteoOk = '✅ Opérationnel';
            } catch (e) {
                meteoOk = '⚠️ Timeout';
            }

            let twitchOk = '❌ Déconnecté';
            try {
                const resTwitch = await fetch('https://decapi.me/twitch/uptime/epsys_');
                if (resTwitch.ok) twitchOk = '✅ Opérationnel';
            } catch (e) {
                twitchOk = '⚠️ Timeout';
            }

            const ramMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
            const wsPing = client.ws.ping;

            const embedDiag = new EmbedBuilder()
                .setColor(modulesOk === modules.length ? 0x2ecc71 : 0xe74c3c)
                .setTitle('🩺 RAPPORT DE SANTÉ COMPLET DE CACABOT')
                .setDescription(`**État global :** ${modulesOk === modules.length ? '🟢 **100% des systèmes sont opérationnels !**' : '🔴 **Certains modules ont un problème !**'}\n\n` + rapport.join('\n'))
                .addFields(
                    { name: '💾 Sauvegarde Discord (#json)', value: backupOk, inline: true },
                    { name: '🌦️ API Météo', value: meteoOk, inline: true },
                    { name: '🟣 Surveillance Twitch', value: twitchOk, inline: true },
                    { name: '🔌 Latence WebSocket', value: `${wsPing}ms`, inline: true },
                    { name: '⚡ RAM Dokploy', value: `${ramMb} Mo`, inline: true },
                    { name: '🤖 Commandes Slash (/)', value: `✅ Catalogue déployé (~45 commandes)`, inline: true }
                )
                .setFooter({ text: `Version Node.js ${process.version} • Dokploy Container` })
                .setTimestamp();

            await sent.edit({ content: null, embeds: [embedDiag] });
            return;
        }

        // Sentinelles, conversion de liens & surveillance
        if (await handleWatcherMessage(message)) return;

        // =========================
        //   COMMANDES ROULETTE
        // =========================
        if (await handleRouletteMessage(message, null, client)) return;

        // =========================
        //   SALON DÉCODEUR D'EMOJIS
        // =========================
        if (await handleRebusMessage(message, null, client, { findMemberByName })) return;

        // =========================
        //     SALON MOTUS DU JOUR
        // =========================
        if (await handleMotusMessage(message, null, client, { findMemberByName })) return;

    // =========================
    //   SÉCURITÉ & MODÉRATION
    // =========================
    if (await handleSecurityMessage(message)) return;

    // Ping Cacabot seul -> "Quoi ? (Feur)"
    const strippedMsg = message.content.replace(/<@!?1503495713097519355>/g, '').trim();
    if (!isChannelMuted(message.channel.id) && message.content.includes('1503495713097519355') && strippedMsg.length === 0) {
        const finAf = rouletteAntiFeurUntil.get(message.author.id);
        if (finAf && Date.now() < finAf) {
            const d = (rouletteAntiFeurDodges.get(message.author.id) || 0) + 1;
            rouletteAntiFeurDodges.set(message.author.id, d);
            if (d >= 5) deverrouillerSucces(message.author.id, 'tete-dure', message.channel);
            return message.react('🛡️').catch(() => {});
        }
        return message.reply('Quoi ? (Feur)');
    }
    // Cheh
    const cleanedCheh = message.content.toLowerCase().trim();
    if (!isChannelMuted(message.channel.id) && pendingCheh.has(message.channel.id) && (cleanedCheh.includes('ntm') || cleanedCheh.includes('tg') || cleanedCheh.includes('nique ta') || cleanedCheh.includes('ta gueule') || cleanedCheh.includes('jte bz') || cleanedCheh.includes('bztmr') || cleanedCheh.includes('va te faire enculer') || cleanedCheh.includes('la ferme') || cleanedCheh.includes('tais-toi') || cleanedCheh.includes('mange tes'))) {
        pendingCheh.delete(message.channel.id);
        return message.reply(CHEH_GIF);
    }

    // Comptage messages pour !top
    if (message.guild && message.guild.id === '720057528351850547') {
        const uid = message.author.id;
        if (!topData.messages[uid]) topData.messages[uid] = 0;
        topData.messages[uid]++;

        // Sauvegarde tous les 75 messages
        messagesSinceLastsaveSave++;
        if (messagesSinceLastsaveSave >= 75) {
            messagesSinceLastsaveSave = 0;
            saveAll();
        }

        const todayKey = getTodayKey();
        if (!dailyData[todayKey]) dailyData[todayKey] = {};
        if (!dailyData[todayKey][uid]) dailyData[todayKey][uid] = 0;
        dailyData[todayKey][uid]++;

        const weekKey = getWeekKey();
        if (!weeklyData[weekKey]) weeklyData[weekKey] = {};
        if (!weeklyData[weekKey][uid]) weeklyData[weekKey][uid] = 0;
        weeklyData[weekKey][uid]++;

        const monthKey = getMonthKey();
        if (!monthlyData[monthKey]) monthlyData[monthKey] = {};
        if (!monthlyData[monthKey][uid]) monthlyData[monthKey][uid] = 0;
        monthlyData[monthKey][uid]++;
    }

    const response = FEUR_IMMUNE.includes(message.author.id) ? null : await getResponse(message.content);

    const isExplicitCommand = message.content.trim().startsWith('!');
    if (isChannelMuted(message.channel.id) && !isExplicitCommand) {
        return;
    }

    if (response === null || response === undefined) return;

// Commandes YouTube (!youtube, !last, !stats)
    if (await handleYoutubeMessage(message, response)) return;

    // !animal
    if (response?.needsMention) {
        const args = message.content.trim().split(/\s+/).slice(1).join(" ");
        if (!message.mentions.users.first() && args.length > 0) {
            const result = findMemberByName(message.guild, args);
            if (result.multiple) {
                askDisambiguation(message, message.guild, result.candidates, (user) => {
                    message.reply(getAnimalResponse(message, user, client.user.id));
                });
                return;
            }
            if (result.found) {
                return message.reply(getAnimalResponse(message, result.found.user, client.user.id));
            }
        }
        return message.reply(getAnimalResponse(message, null, client.user.id));
    }

    // Commandes Bienvenue (!welcome, !bienvenue)
    if (await handleWelcomeMessage(message, response)) return;

    // !suggestion
    if (response?.needsSuggestion) {
        const SUGGESTION_CHANNEL_ID = '720079866199801937';
        if (message.channel.id !== SUGGESTION_CHANNEL_ID) {
            return message.channel.send(`💡 <@${message.author.id}>, les suggestions se font uniquement dans le salon <#${SUGGESTION_CHANNEL_ID}> !`);
        }

        const texte = message.content.trim().split(/\s+/).slice(1).join(" ");
        if (!texte) {
            return message.reply("Usage : `!suggestion [ton idée/proposition]`\nExemple : `!suggestion Créer un salon Meubles IKEA`");
        }

        const data = {
            authorId: message.author.id,
            texte: texte,
            pour: [],
            contre: []
        };

        const embed = buildSuggestionEmbed(data, message.member);
        const row = buildSuggestionRow(data);

        await message.delete().catch(() => {});
        const sent = await message.channel.send({ embeds: [embed], components: [row] });

        suggestionsData.set(sent.id, data);
        demanderSauvegarde();
        return;
    }

    // Commandes sociales (!lovecalc, !topchef, !flip, !blague, !question, !sylvain, !bougetoi)
    if (await handleSocialMessage(message, response, client, { findMemberByName, askDisambiguation })) return;

    if (await handleInteractionMessage(message, response, client, { findMemberByName, askDisambiguation })) return;

    // !cry
    if (response?.needsCry) {
        const cryGifs = ["https://cdn.discordapp.com/attachments/1128032964924670053/1505906480916725791/zidane.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906486872768522/wwe.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906487413964941/cry2.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906487656972359/hamster.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906487959093359/interstellar.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906869598814310/cry.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906488625856622/powder.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906488932176034/vi.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906489271779449/gangle.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906489657790466/pomni.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906489947324589/fred.gif"];
        const gif = cryGifs[Math.floor(Math.random() * cryGifs.length)];
        const auteurNom = message.member?.displayName ?? message.author.username;
        let cible = message.mentions.users.first();

        if (!cible) {
            const query = message.content.trim().split(/\s+/).slice(1).join(' ');
            if (query) {
                if (client.user.username.toLowerCase().includes(query.toLowerCase()) || 'cacabot'.includes(query.toLowerCase())) {
                    cible = client.user;
                } else {
                    const result = findMemberByName(message.guild, query);
                    if (result.multiple) {
                        askDisambiguation(message, message.guild, result.candidates, async (user) => {
                            const cibleNom = message.guild?.members.cache.get(user.id)?.displayName ?? user.username;
                            const btn = new ButtonBuilder()
                                .setCustomId(`cry_with_${message.author.id}_${auteurNom}_${user.id}_${cibleNom}`)
                                .setLabel('\ud83d\ude2d Pleurer avec')
                                .setStyle(ButtonStyle.Secondary);
                            const row = new ActionRowBuilder().addComponents(btn);
                            const embed = new EmbedBuilder()
                                .setColor(0x597eff)
                                .setDescription(`\ud83d\ude2d **${auteurNom}** Pleure \u00e0 cause de **${cibleNom}**...`)
                                .setImage(gif);
                            message.reply({ embeds: [embed], components: [row] });
                        });
                        return;
                    }
                    if (result.found) cible = result.found.user;
                }
            }
        }

        let desc, targetId = null, cibleNom = null;

        if (cible && cible.id === message.author.id) {
            desc = `\ud83d\ude2d **${auteurNom}** Pleure...`;
            const embed = new EmbedBuilder().setColor(0x597eff).setDescription(desc).setImage(gif);
            return message.reply({ embeds: [embed] });
        } else if (cible && cible.id === '1503495713097519355') {
            desc = `\ud83d\ude2d **${auteurNom}** pleure \u00e0 cause de moi...`;
        } else if (cible) {
            cibleNom = message.guild?.members.cache.get(cible.id)?.displayName ?? cible.username;
            targetId = cible.id;
            desc = `\ud83d\ude2d **${auteurNom}** Pleure \u00e0 cause de **${cibleNom}**...`;
        } else {
            desc = `\ud83d\ude2d **${auteurNom}** Pleure...`;
        }

        const embed = new EmbedBuilder().setColor(0x597eff).setDescription(desc).setImage(gif);

        const btn = new ButtonBuilder()
            .setCustomId(`cry_with_${message.author.id}_${auteurNom}_${targetId ?? 'none'}_${cibleNom ?? 'none'}`)
            .setLabel('\ud83d\ude2d Pleurer avec')
            .setStyle(ButtonStyle.Secondary);
        const row = new ActionRowBuilder().addComponents(btn);
        return message.reply({ embeds: [embed], components: [row] });
    }

    // !bougetoi & !sylvain sont pris en charge par handleSocialMessage

    // !motus & !motustats sont pris en charge par handleMotusMessage ci-dessus

    // !rebus & !rebusstats sont pris en charge par handleRebusMessage ci-dessus

    // Commandes Quotes (!quote, !citation)
    if (await handleQuotesMessage(message, response)) return;

    // Commandes Anniversaire (!anniversaire, !anniversairetest)
    if (await handleAnniversaireMessage(message, response)) return;

    // Commandes Activité (!profil, !avatar, !actif, !top, !setmessages)
    if (await handleActivityMessage(message, response)) return;

    // hé petit
    if (response?.needsHePetit) {
        await message.reply({ files: ['./monty.gif'] });
        await message.channel.send({ files: ['./' + 'h\u00e9 petit.mp3'] });
        return;
    }

    // jtm cacabot
    if (response?.needsJtm) {
        const auteurNom = message.member?.displayName ?? message.author.username;
        return message.reply(`Moi aussi jtm **${auteurNom}** \u2764\ufe0f`);
    }

    // !horoscope
    if (response?.needsHoroscope) {
        const args = message.content.trim().split(/\s+/);
        const forcedChannelId = args[1] && message.author.id === '436218312574107658' ? args[1] : null;
        let targetChannel = message.channel;
        if (forcedChannelId) {
            try {
                targetChannel = await client.channels.fetch(forcedChannelId);
                if (!targetChannel) return message.reply('Salon introuvable.');
            } catch (e) {
                return message.reply('Salon introuvable.');
            }
        }
        const now = new Date();
        const dateKey = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
        const dateStr = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

        const signes = [
            { nom: 'B\u00e9lier', emoji: '\u2648' },
            { nom: 'Taureau', emoji: '\u2649' },
            { nom: 'G\u00e9meaux', emoji: '\u264a' },
            { nom: 'Cancer', emoji: '\u264b' },
            { nom: 'Lion', emoji: '\u264c' },
            { nom: 'Vierge', emoji: '\u264d' },
            { nom: 'Balance', emoji: '\u264e' },
            { nom: 'Scorpion', emoji: '\u264f' },
            { nom: 'Sagittaire', emoji: '\u2650' },
            { nom: 'Capricorne', emoji: '\u2651' },
            { nom: 'Verseau', emoji: '\u2652' },
            { nom: 'Poissons', emoji: '\u2653' },
            { nom: 'Loutre', emoji: '\ud83e\udda6' },
        ];

        const description = signes.map((s, i) => {
            const horoscope = getHoroscopeForSign(i, dateKey);
            return `${s.emoji} **${s.nom}**\n${horoscope}`;
        }).join('\n\n');

        const embed = new EmbedBuilder()
            .setColor(0x2c2f33)
            .setTitle('\ud83d\udd2e Horoscope du jour')
            .setDescription(description)
            .setThumbnail('https://cdn.discordapp.com/attachments/1128032964924670053/1505637234596905080/color-replaced.png')
            .setFooter({ text: `\ud83d\udcc5 ${dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}` });

        if (forcedChannelId) {
            const titres = [
                '# HOROSCOPE DU JOUR \ud83d\udd2e',
                "# L'ORACLE A PARL\u00c9 \ud83d\udd2e",
                '# LES ASTRES ONT PARL\u00c9 \ud83d\udd2e',
                '# LES \u00c9TOILES ONT PARL\u00c9 \ud83d\udd2e',
                "# L'UNIVERS NOUS ENVOIE SES SIGNES \ud83d\udd2e",
            ];
            const titre = titres[Math.floor(Math.random() * titres.length)];
            await targetChannel.send(titre);
            await targetChannel.send({ embeds: [embed] });
            return message.react('✅');
        }
        return message.reply({ embeds: [embed] });
    }

    // !save
    if (response?.needsSave) {
        if (message.author.id !== '436218312574107658') return;
        await saveAll();
        return message.reply('\ud83d\udcbe Sauvegarde forc\u00e9e effectu\u00e9e !');
    }

    // !helpx
    if (await handleHelpMessage(message, response)) return;

    // Commandes Utilitaires (!pomodoro, !rappel, !prune, !ping, !meteo, !botinfo, !serveur, !say, !edit, !aternos)
    if (await handleToolsMessage(message, response, client)) return;

    // !lastsave
    if (response?.needsLastsave) {
        if (message.author.id !== '436218312574107658') return;
        if (!lastsaveSaveTime) return message.reply('Aucune sauvegarde effectu\u00e9e depuis le d\u00e9marrage.');
        const diff = Date.now() - lastsaveSaveTime;
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        const dateStr = lastsaveSaveTime.toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
        return message.reply(`\ud83d\udcbe Derni\u00e8re sauvegarde : **${dateStr}** (il y a ${mins}min ${secs}s)`);
    }

    // !embed (Epsys-only)
    if (await handleEmbedMessage(message, response, client)) return;

    // !question est pris en charge par handleSocialMessage

    // !help
    const cmdPrefix = message.content.trim().split(/\s+/)[0]?.toLowerCase();
    if (cmdPrefix === '!help' || cmdPrefix === '!aide') {
        const argHelp = message.content.trim().split(/\s+/).slice(1).join(' ') || null;
        const helpResp = getHelpResponse(argHelp);
        if (helpResp) {
            if (typeof helpResp === 'string') return message.reply(helpResp);
            return message.reply(helpResp);
        }
    }

    // Réponse texte simple
    if (response && typeof response === "object" && response.files) {
        return message.reply({ files: response.files });
    }

    if (typeof response === "string") {
        if (response.trim().length === 0) return;
        const finAntiFeur = rouletteAntiFeurUntil.get(message.author.id);

        // Le bouclier Anti-Feur ne s'active que sur les répliques réflexes (quoi, qui, oui, non...), jamais sur les commandes avec !
        if (!isExplicitCommand && finAntiFeur && Date.now() < finAntiFeur) {
            const d = (rouletteAntiFeurDodges.get(message.author.id) || 0) + 1;
            rouletteAntiFeurDodges.set(message.author.id, d);
            if (d >= 5) deverrouillerSucces(message.author.id, 'tete-dure', message.channel);
            return message.react('🛡️').catch(() => {});
        }
        const autoReplyMsg = await message.reply({ content: response });
        if (pendingCheh.has(message.channel.id)) clearTimeout(pendingCheh.get(message.channel.id).timeout);
        const chehTimeout = setTimeout(() => { pendingCheh.delete(message.channel.id); }, 10000);
        pendingCheh.set(message.channel.id, { timeout: chehTimeout, replyMsg: autoReplyMsg });
        return;
    }
});



    // =========================
    //     LISTENER INTERACTIONS
    // =========================

client.on('interactionCreate', async (interaction) => {
try {

    // =========================
    //   COMMANDES SLASH (/)
    // =========================
    if (interaction.isChatInputCommand()) {
        if (interaction.guildId !== '720057528351850547') {
            return interaction.reply({ content: "Les commandes slash de Cacabot sont exclusivement réservées au serveur Regaïa !", ephemeral: true });
        }

        const aliasMap = {
            rlt: 'roulette',
            roulettestats: 'rltstats',
            roulettestate: 'rltstate',
            roulettesucces: 'rltsucces',
            roulettetop: 'rlttop',
            bisou: 'kiss',
            calin: 'hug',
            court: 'run',
            dance: 'danse',
            frappe: 'punch',
            tir: 'bang',
            pan: 'bang',
            pleure: 'cry',
            explose: 'explode',
            citation: 'quote',
            decodeur: 'rebus',
            rebusstat: 'rebusstats',
            motustat: 'motustats',
            about: 'botinfo',
            montage: 'bougetoi',
            video: 'bougetoi',
            lavideo: 'bougetoi',
            sugg: 'suggestion',
            profile: 'profil'
        };

        const commandName = aliasMap[interaction.commandName] || interaction.commandName;

        // Commandes Motus
        if (commandName === 'motus' || commandName === 'motustats') {
            return await handleMotusSlash(interaction);
        }

        // Commandes Rébus Regaïen
        if (commandName === 'rebus' || commandName === 'decodeur' || commandName === 'rebusstats') {
            return await handleRebusSlash(interaction);
        }

        // Commande Quote (/quote, /citation)
        if (await handleQuotesSlash(interaction)) return;

        // Commandes sociales
        if (['lovecalc', 'flip', 'blague', 'topchef', 'choix', 'question', 'sylvain', 'epsys', 'bougetoi'].includes(commandName)) {
            return await handleSocialSlash(interaction);
        }

        // Commandes Utilitaires Slash (/ping, /prune, /serveur, /meteo, /pomodoro, /rappel, /botinfo, /aternos)
        if (await handleToolsSlash(interaction, client)) return;

        // Commande Rlttop
        if (await handleRouletteSlash(interaction, client)) return;

        if (commandName === 'help') {
            return await handleHelpInteraction(interaction);
        }

        // Commandes Activité (/profil, /top)
        if (await handleActivitySlash(interaction)) return;

        const auteurNom = interaction.member?.displayName ?? interaction.user.username;
        const auteurId = interaction.user.id;

        if (commandName === 'kiss') {
            const cibleUser = interaction.options.getUser('membre');
            const cibleMember = interaction.guild?.members.cache.get(cibleUser.id);
            const cibleNom = cibleMember?.displayName ?? cibleUser.username;

            if (cibleUser.id === auteurId) {
                const embed = buildKissEmbed(auteurNom, auteurNom).setDescription(`💋 **${auteurNom}** s'embrasse ! Attends... Comment c'est possible ?`);
                return interaction.reply({ embeds: [embed] });
            }
            if (cibleUser.id === client.user.id) {
                const embed = buildKissEmbed(auteurNom, "Cacabot").setDescription(`💋 **${auteurNom}** m'embrasse ! Awww merci <3`);
                return interaction.reply({ embeds: [embed] });
            }
            const embed = buildKissEmbed(auteurNom, cibleNom);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`kiss_back_${auteurId}_${cibleUser.id}_${auteurNom}`).setLabel("💋 Embrasser en retour").setStyle(ButtonStyle.Primary)
            );
            return interaction.reply({ embeds: [embed], components: [row] });
        }

        if (commandName === 'hug') {
            const cibleUser = interaction.options.getUser('membre');
            const cibleMember = interaction.guild?.members.cache.get(cibleUser.id);
            const cibleNom = cibleMember?.displayName ?? cibleUser.username;

            if (cibleUser.id === auteurId) {
                const embed = buildHugEmbed(auteurNom, auteurNom).setDescription(`🫂 **${auteurNom}** se fait un câlin... Ça va aller...`);
                return interaction.reply({ embeds: [embed] });
            }
            if (cibleUser.id === client.user.id) {
                const embed = buildHugEmbed(auteurNom, "Cacabot").setDescription(`🫂 **${auteurNom}** me fait un câlin !`);
                return interaction.reply({ embeds: [embed] });
            }
            const embed = buildHugEmbed(auteurNom, cibleNom);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`hug_back_${auteurId}_${cibleUser.id}_${auteurNom}`).setLabel("🫂 Câliner en retour").setStyle(ButtonStyle.Primary)
            );
            return interaction.reply({ embeds: [embed], components: [row] });
        }

        if (commandName === 'rizz') {
            const cibleUser = interaction.options.getUser('membre');
            const cibleMember = interaction.guild?.members.cache.get(cibleUser.id);
            const cibleNom = cibleMember?.displayName ?? cibleUser.username;

            if (cibleUser.id === auteurId) return interaction.reply({ content: "Tu ne peux pas te rizz toi-même !", ephemeral: true });
            if (cibleUser.id === client.user.id) {
                const embed = buildRizzEmbed(`🗿 **${auteurNom}** me rizz ! Eh beh 😊`);
                return interaction.reply({ embeds: [embed] });
            }
            const embed = buildRizzEmbed(`🗿 **${auteurNom}** rizz **${cibleNom}** !`);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`rizz_back_${auteurId}_${cibleUser.id}_${auteurNom}`).setLabel("🗿 Rizz en retour").setStyle(ButtonStyle.Primary)
            );
            return interaction.reply({ embeds: [embed], components: [row] });
        }

        if (commandName === 'punch') {
            const cibleUser = interaction.options.getUser('membre');
            const cibleMember = interaction.guild?.members.cache.get(cibleUser.id);
            const cibleNom = cibleMember?.displayName ?? cibleUser.username;

            if (cibleUser.id === auteurId) return interaction.reply({ content: "Tu ne peux pas te frapper toi-même ! 'Fin si mais... Ne le fais pas.", ephemeral: true });
            if (cibleUser.id === client.user.id) {
                const embed = buildPunchEmbed(`🤜 **${auteurNom}** me frappe ! Aïeuh !`);
                return interaction.reply({ embeds: [embed] });
            }
            const embed = buildPunchEmbed(`🤜 **${auteurNom}** frappe **${cibleNom}** !`);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`punch_back_${auteurId}_${cibleUser.id}_${auteurNom}`).setLabel("🤜 Frapper en retour").setStyle(ButtonStyle.Primary)
            );
            return interaction.reply({ embeds: [embed], components: [row] });
        }

        if (commandName === 'bang') {
            const cibleUser = interaction.options.getUser('membre');
            const cibleMember = interaction.guild?.members.cache.get(cibleUser.id);
            const cibleNom = cibleMember?.displayName ?? cibleUser.username;

            if (cibleUser.id === auteurId) return interaction.reply({ content: "Évite de te tirer dessus :(", ephemeral: true });
            if (cibleUser.id === client.user.id) {
                const embed = buildBangEmbed(`💥 **${auteurNom}** me tire dessus ! HÉ !`);
                return interaction.reply({ embeds: [embed] });
            }
            const embed = buildBangEmbed(`💥 **${auteurNom}** tire sur **${cibleNom}** !`);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`bang_back_${auteurId}_${cibleUser.id}_${auteurNom}`).setLabel("💥 Riposter !").setStyle(ButtonStyle.Primary)
            );
            return interaction.reply({ embeds: [embed], components: [row] });
        }

        if (commandName === 'insult') {
            const cibleUser = interaction.options.getUser('membre');
            const cibleMember = interaction.guild?.members.cache.get(cibleUser.id);
            const cibleNom = cibleMember?.displayName ?? cibleUser.username;

            if (cibleUser.id === auteurId) return interaction.reply({ content: "Tu ne peux pas t'insulter toi-même... Mentionne quelqu'un plutôt !", ephemeral: true });
            if (cibleUser.id === client.user.id) {
                const embed = buildInsultEmbed(`🖕 **${auteurNom}** m'insulte ! J'ai fait quoi ?!`);
                return interaction.reply({ embeds: [embed] });
            }
            const embed = buildInsultEmbed(`🖕 **${auteurNom}** insulte **${cibleNom}** !`);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`insult_back_${auteurId}_${cibleUser.id}_${auteurNom}`).setLabel("🖕 Insulter en retour").setStyle(ButtonStyle.Primary)
            );
            return interaction.reply({ embeds: [embed], components: [row] });
        }

        if (commandName === 'bait') {
            const cibleUser = interaction.options.getUser('membre');
            const cibleMember = interaction.guild?.members.cache.get(cibleUser.id);
            const cibleNom = cibleMember?.displayName ?? cibleUser.username;

            if (cibleUser.id === auteurId) return interaction.reply({ content: "Tu ne peux pas te ragebait toi-même !", ephemeral: true });
            const baitGifs = [
                "https://cdn.discordapp.com/attachments/1072299294519988345/1304467586746028193/brandbird_4.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505570790706253864/tadc-bubble-tadc.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505570791683522760/tadc-the-amazing-digital-circus.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505570792279379988/tadc-caine-tadc.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505570793021505736/flight-flightreacts.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505570793718022226/superman-superman-flying.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505570795160731728/f8957342b4d99638.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505570795974295672/down-syndrome.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505570796981194822/flight.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505570797979172964/catreacts-ragebait.gif"
            ];
            const gif = baitGifs[Math.floor(Math.random() * baitGifs.length)];
            if (cibleUser.id === client.user.id) {
                const embed = new EmbedBuilder().setColor(0xffb14a).setDescription(`😜 **${auteurNom}** me ragebait ! Gngngngn...`).setImage(gif);
                return interaction.reply({ embeds: [embed] });
            }
            const embed = new EmbedBuilder().setColor(0xffb14a).setDescription(`😜 **${auteurNom}** ragebait **${cibleNom}** !`).setImage(gif);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`bait_venge_${cibleUser.id}_${auteurId}_${auteurNom}`).setLabel("💢 SE VENGER !").setStyle(ButtonStyle.Secondary)
            );
            return interaction.reply({ embeds: [embed], components: [row] });
        }

        if (commandName === 'ban') {
            const cibleUser = interaction.options.getUser('membre');
            const cibleMember = interaction.guild?.members.cache.get(cibleUser.id);
            const cibleNom = cibleMember?.displayName ?? cibleUser.username;

            if (cibleUser.id === auteurId) return interaction.reply({ content: "Tu ne peux pas te bannir toi-même !", ephemeral: true });
            const banGifs = [
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505557423686029352/cat-screaming-cat-disappearing.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505557409148567572/ahh-kid-turns-blue-and-vanishes.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505557424092741764/duck-disappears.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505557424491462856/tom-skot.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505557424805777428/atoms-cry.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505557425288380576/sr-pelo-screaming.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505557425690775683/cat-scream.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505557426043355278/meme-quarantine.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505557426433294437/flight-flights.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505557426881958020/nikocado-avocado-nikocado.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505557427209109544/moist-moist-critical.gif"
            ];
            const gif = banGifs[Math.floor(Math.random() * banGifs.length)];
            const titre = cibleUser.id === client.user.id ? `**${auteurNom}** me bannit... Pas cool.` : `🔨 **${auteurNom}** bannit **${cibleNom}** !`;
            const embed = new EmbedBuilder().setColor(0xcdc9dc).setDescription(titre).setImage(gif);
            return interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'danse') {
            const cibleUser = interaction.options.getUser('membre');
            if (!cibleUser) {
                const embed = buildDanceEmbed(`💃 **${auteurNom}** s'ambiance comme jamais !`, true);
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`dance_join_${auteurId}_${auteurNom}`).setLabel("💃 Rejoindre la danse").setStyle(ButtonStyle.Primary)
                );
                return interaction.reply({ embeds: [embed], components: [row] });
            }
            const cibleMember = interaction.guild?.members.cache.get(cibleUser.id);
            const cibleNom = cibleMember?.displayName ?? cibleUser.username;
            if (cibleUser.id === client.user.id) {
                const embed = buildDanceEmbed(`💃 **${auteurNom}** danse avec moi !`, false);
                return interaction.reply({ embeds: [embed] });
            }
            const embed = buildDanceEmbed(`💃 **${auteurNom}** danse avec **${cibleNom}** !`, false);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`dance_back_${auteurId}_${cibleUser.id}_${auteurNom}`).setLabel("💃 Rejoindre la danse").setStyle(ButtonStyle.Primary)
            );
            return interaction.reply({ embeds: [embed], components: [row] });
        }

        if (commandName === 'rire') {
            const cibleUser = interaction.options.getUser('membre');
            if (cibleUser && cibleUser.id !== auteurId && cibleUser.id !== client.user.id) {
                const cibleMember = interaction.guild?.members.cache.get(cibleUser.id);
                const cibleNom = cibleMember?.displayName ?? cibleUser.username;
                const embed = buildLaughEmbed(`😆 **${auteurNom}** se fout de la gueule de **${cibleNom}** !`);
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`laugh_with_${auteurId}_${auteurNom}`).setLabel("😆 Rire avec").setStyle(ButtonStyle.Primary)
                );
                return interaction.reply({ embeds: [embed], components: [row] });
            }
            const embed = buildLaughEmbed(`😆 **${auteurNom}** se tape une barre !`);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`laugh_with_${auteurId}_${auteurNom}`).setLabel("😆 Rire avec").setStyle(ButtonStyle.Primary)
            );
            return interaction.reply({ embeds: [embed], components: [row] });
        }

        if (commandName === 'cry') {
            const cryGifs = ["https://cdn.discordapp.com/attachments/1128032964924670053/1505906480916725791/zidane.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906486872768522/wwe.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906487413964941/cry2.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906487656972359/hamster.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906487959093359/interstellar.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906869598814310/cry.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906488625856622/powder.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906488932176034/vi.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906489271779449/gangle.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906489657790466/pomni.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906489947324589/fred.gif"];
            const gif = cryGifs[Math.floor(Math.random() * cryGifs.length)];
            const cibleUser = interaction.options.getUser('membre');
            let desc, targetId = null, cibleNom = null;
            if (cibleUser && cibleUser.id === auteurId) {
                desc = `😭 **${auteurNom}** Pleure...`;
                return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x597eff).setDescription(desc).setImage(gif)] });
            } else if (cibleUser && cibleUser.id === client.user.id) {
                desc = `😭 **${auteurNom}** pleure à cause de moi...`;
            } else if (cibleUser) {
                cibleNom = interaction.guild?.members.cache.get(cibleUser.id)?.displayName ?? cibleUser.username;
                targetId = cibleUser.id;
                desc = `😭 **${auteurNom}** Pleure à cause de **${cibleNom}**...`;
            } else {
                desc = `😭 **${auteurNom}** Pleure...`;
            }
            const embed = new EmbedBuilder().setColor(0x597eff).setDescription(desc).setImage(gif);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`cry_with_${auteurId}_${auteurNom}_${targetId ?? 'none'}_${cibleNom ?? 'none'}`).setLabel("😭 Pleurer avec").setStyle(ButtonStyle.Secondary)
            );
            return interaction.reply({ embeds: [embed], components: [row] });
        }

        if (commandName === 'run') {
            const cibleUser = interaction.options.getUser('membre');
            if (!cibleUser || cibleUser.id === auteurId) {
                const embed = buildRunEmbed(`🏃 **${auteurNom}** fuit !`);
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`run_join_${auteurId}_${auteurNom}`).setLabel("🏃 Accompagner").setStyle(ButtonStyle.Secondary)
                );
                return interaction.reply({ embeds: [embed], components: [row] });
            }
            if (cibleUser.id === client.user.id) {
                const embed = buildRunEmbed(`🏃 **${auteurNom}** me fuit ! Reviens-là !`);
                return interaction.reply({ embeds: [embed] });
            }
            const cibleMember = interaction.guild?.members.cache.get(cibleUser.id);
            const cibleNom = cibleMember?.displayName ?? cibleUser.username;
            const embed = buildRunEmbed(`🏃 **${auteurNom}** fuit de **${cibleNom}** !`);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`run_join_${auteurId}_${auteurNom}_${cibleUser.id}`).setLabel("🏃 Accompagner").setStyle(ButtonStyle.Secondary)
            );
            return interaction.reply({ embeds: [embed], components: [row] });
        }

        if (commandName === 'explode') {
            const explodeGifs = [
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505564402697375794/cat-cats.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505564403230183599/cat-explosion_1.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505564403653804153/floop-flop.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505564404031426661/cat-explodes.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505564404400521267/cat-funny.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505564404882870292/spideyvivi.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505564405281194064/cat-explode-cat-meme.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505564405847298150/explosion-missile.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505564406224781373/exploding-cat-cat-blowing-up.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505564406799532052/cat-gato.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505564412172570664/boomshakalaka.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505564412763836466/elgatitolover-cat.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505564413376335962/cat-explosion-ellie-cat-explosion.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505564413795635311/exploding-car-explode.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505564414147825774/cat-explosion.gif"
            ];
            const gif = explodeGifs[Math.floor(Math.random() * explodeGifs.length)];
            const embed = new EmbedBuilder().setColor(0xec0f6e).setDescription(`💥 **${auteurNom}** explose !`).setImage(gif);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`explode_with_${auteurId}_${auteurNom}`).setLabel("💥 Exploser avec").setStyle(ButtonStyle.Secondary)
            );
            return interaction.reply({ embeds: [embed], components: [row] });
        }

        if (commandName === 'die') {
            const cibleUser = interaction.options.getUser('membre');
            if (cibleUser && cibleUser.id === client.user.id) {
                const embed = buildDieEmbed(`☠️ **${auteurNom}** meurt à cause de moi ! (cheh)`);
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`die_with_${auteurId}_${auteurNom}`).setLabel("☠️ Mourir avec").setStyle(ButtonStyle.Primary)
                );
                return interaction.reply({ embeds: [embed], components: [row] });
            }
            const causeNom = cibleUser && cibleUser.id !== auteurId ? (interaction.guild?.members.cache.get(cibleUser.id)?.displayName ?? cibleUser.username) : null;
            const titre = causeNom ? `☠️ **${auteurNom}** meurt à cause de **${causeNom}**` : `☠️ **${auteurNom}** meurt...`;
            const embed = buildDieEmbed(titre);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`die_with_${auteurId}_${auteurNom}`).setLabel("☠️ Mourir avec").setStyle(ButtonStyle.Primary)
            );
            return interaction.reply({ embeds: [embed], components: [row] });
        }

        if (commandName === 'jailaref') {
            const jailarefGifs = ["https://static2.klipy.com/ii/4493325008d34b7bf8cd6813cd5c1619/f1/7d/7y2QyYzWIYksGnnK.gif", "https://cdn.discordapp.com/attachments/720079691041472572/1548362421079646481/caf5c232438734937f6e1cf4c7bc5411.png", "https://media1.tenor.com/m/13XpzbwtVnYAAAAC/dway-the-roc.gif", "https://static2.klipy.com/ii/4493325008d34b7bf8cd6813cd5c1619/14/44/oqcpwYRAEpXGYqfyw.gif", "https://static2.klipy.com/ii/50d7c955398dfd7e3c8ba5281154280f/79/6d/eoUS3shzyQLpKm.gif", "https://static2.klipy.com/ii/d7aec6f6f171607374b2065c836f92f4/3d/31/08K8MgEk.gif", "https://static2.klipy.com/ii/4493325008d34b7bf8cd6813cd5c1619/64/b0/SdnOajVDadHUy.gif", "https://cdn.discordapp.com/attachments/720079691041472572/1548366731666268250/image2.gif", "https://static2.klipy.com/ii/9294a2e836d178ddc22430dd7765727e/44/86/6QBidjUuV1oBpAnHIw7o.gif"];
            const gif = jailarefGifs[Math.floor(Math.random() * jailarefGifs.length)];
            const cibleUser = interaction.options.getUser('membre');
            let desc;
            if (!cibleUser) desc = `😎 **${auteurNom}** a la ref !`;
            else if (cibleUser.id === auteurId) return interaction.reply({ content: "Bah oui, t'as forcément ta propre ref...", ephemeral: true });
            else if (cibleUser.id === client.user.id) desc = `😎 **${auteurNom}** a ma ref !`;
            else {
                const cibleNom = interaction.guild?.members.cache.get(cibleUser.id)?.displayName ?? cibleUser.username;
                desc = `😎 **${auteurNom}** a la ref de **${cibleNom}** !`;
            }
            const embed = new EmbedBuilder().setColor(0x503649).setDescription(desc).setImage(gif);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`jailaref_with_${auteurId}_${auteurNom}_${cibleUser?.id ?? 'none'}`).setLabel("😎 J'ai la ref aussi").setStyle(ButtonStyle.Secondary)
            );
            return interaction.reply({ embeds: [embed], components: [row] });
        }

        if (commandName === 'palaref') {
            const palarefGifs = ["https://cdn.discordapp.com/attachments/1128032964924670053/1505882858311647262/tyson.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882865492164608/viktor.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882866192617624/zidane.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882866549260338/kaamelott.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882866867765278/palaref.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882866867765278/ants.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882867262296094/ants.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882867576606720/simpsons.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882867903758428/speed.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882868205752430/kinger.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882868520456332/pomni.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882872769151027/stare.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882873109020853/erivo.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882873427923024/hidethepain.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882873746686022/chieng.gif"];
            const gif = palarefGifs[Math.floor(Math.random() * palarefGifs.length)];
            const cibleUser = interaction.options.getUser('membre');
            let desc;
            if (!cibleUser) desc = `😐 **${auteurNom}** n'a pas la ref...`;
            else if (cibleUser.id === auteurId) return interaction.reply({ content: "Tu n'as pas ta propre ref ? ...Hein ?", ephemeral: true });
            else if (cibleUser.id === client.user.id) desc = `😐 **${auteurNom}** n'a pas ma ref...`;
            else {
                const cibleNom = interaction.guild?.members.cache.get(cibleUser.id)?.displayName ?? cibleUser.username;
                desc = `😐 **${auteurNom}** n'a pas la ref de **${cibleNom}**...`;
            }
            const embed = new EmbedBuilder().setColor(0x503649).setDescription(desc).setImage(gif);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`palaref_aussi_${auteurId}_${auteurNom}_${cibleUser?.id ?? 'none'}`).setLabel("😐 Pas la ref non plus").setStyle(ButtonStyle.Secondary)
            );
            return interaction.reply({ embeds: [embed], components: [row] });
        }

        // =========================
        // LOT 2 : JEUX & DESTIN
        // =========================

        if (commandName === 'destin') {
            const destinReponse = getResponse("!destin");
            return interaction.reply({ content: destinReponse });
        }

        if (commandName === 'horoscope') {
            return interaction.reply({ embeds: [buildHoroscopeEmbed()] });
        }

        if (commandName === 'animal') {
            const cibleUser = interaction.options.getUser('membre') ?? interaction.user;
            return interaction.reply(getAnimalResponse(interaction, cibleUser));
        }

        // flip et blague sont pris en charge par handleSocialSlash

        // epsys, bougetoi et sylvain sont pris en charge par handleSocialSlash

        if (commandName === 'rltstate') {
            const cibleUser = interaction.options.getUser('membre') ?? interaction.user;
            const member = interaction.guild?.members.cache.get(cibleUser.id) ?? interaction.member;
            return interaction.reply({ embeds: [buildRouletteStateEmbed(member, interaction.guildId)] });
        }

        // =========================
        // LOT 3 : SALONS & VIE DU SERVEUR
        // =========================

        // topchef, question et choix sont pris en charge par handleSocialSlash

        if (await handleWelcomeSlash(interaction)) return;

        if (commandName === 'suggestion') {
            const SUGGESTION_CHANNEL_ID = '720079866199801937';
            if (interaction.channel.id !== SUGGESTION_CHANNEL_ID) {
                return interaction.reply({ content: `💡 Les suggestions se font uniquement dans le salon <#${SUGGESTION_CHANNEL_ID}> !`, ephemeral: true });
            }

            const texte = interaction.options.getString('proposition');
            const data = {
                authorId: interaction.user.id,
                texte: texte,
                pour: [],
                contre: []
            };

            const embed = buildSuggestionEmbed(data, interaction.member);
            const row = buildSuggestionRow(data);

            const sent = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
            suggestionsData.set(sent.id, data);
            demanderSauvegarde();
            return;
        }

    if (await handleAnniversaireSlash(interaction)) return;

        if (await handleYoutubeSlash(interaction)) return;

        if (await handleEmbedSlash(interaction, client)) return;
    }

    // Bouton pour tirer une autre citation au hasard
    if (await handleQuotesButton(interaction)) return;

    if (await handleMotusButton(interaction)) return;

    if (await handleRebusButton(interaction)) return;

    // Interactions Panneau Bienvenue
    if (await handleWelcomeInteraction(interaction)) return;

    // Annulation du brouillon
    if (interaction.isButton() && interaction.customId === 'embed_cancel_draft') {
        if (interaction.user.id !== '436218312574107658') return;
        embedDrafts.delete(interaction.user.id);
        return interaction.update({ content: "🗑️ Création de l'embed annulée.", embeds: [], components: [] });
    }

    // Boutons de Sécurité & Rôles
    if (await handleSecurityInteraction(interaction)) return;

    // =========================
    //     BOUTONS YOUTUBE
    // =========================
    if (await handleYoutubeButton(interaction)) return;

    if (await handleInteractionButton(interaction)) return;

    // Boutons Activité (actif jour/semaine/mois & pagination top)
    if (await handleActivityButton(interaction)) return;

    // =========================
    // BOUTONS ANNIVERSAIRE LIST
    // =========================
    if (await handleAnniversaireButton(interaction)) return;

    // Boutons et menus sociaux (flip, sylvain, blagues, questions)
    if (await handleSocialInteraction(interaction)) return;

    // =========================
    //        BOUTON CRY
    // =========================

    if (interaction.isButton() && interaction.customId.startsWith('cry_with_')) {
        const parts = interaction.customId.split('_');
        const originalAuthorId = parts[2];
        const originalAuthorNom = parts[3];
        const targetId = parts[4];
        const targetNom = parts[5];

        if (interaction.user.id === originalAuthorId) {
            return interaction.reply({ content: "Tu as d\u00e9j\u00e0 pleur\u00e9...", ephemeral: true });
        }
        if (targetId !== 'none' && interaction.user.id === targetId) {
            return interaction.reply({ content: `C'est toi qui a fait pleurer **${originalAuthorNom}** !`, ephemeral: true });
        }

        const cryGifs = ["https://cdn.discordapp.com/attachments/1128032964924670053/1505906480916725791/zidane.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906486872768522/wwe.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906487413964941/cry2.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906487656972359/hamster.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906487959093359/interstellar.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906869598814310/cry.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906488625856622/powder.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906488932176034/vi.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906489271779449/gangle.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906489657790466/pomni.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906489947324589/fred.gif"];
        const gif = cryGifs[Math.floor(Math.random() * cryGifs.length)];
        const clickerNom = interaction.member?.displayName ?? interaction.user.username;

        const embed = new EmbedBuilder()
            .setColor(0x597eff)
            .setDescription(`\ud83d\ude2d **${clickerNom}** Pleure avec **${originalAuthorNom}**...`)
            .setImage(gif);

        await disableButtons(interaction);
        return interaction.reply({ embeds: [embed] });
    }

    // sylvain_again est géré par handleSocialInteraction

    // =========================
    // BOUTONS ROULETTE
    // =========================
    if (await handleRouletteButton(interaction, client)) return;

    // =========================
    // INTERACTIONS EMBEDS (EPSYS)
    // =========================
    if (await handleEmbedInteraction(interaction, client)) return;

    // =========================
    // INTERACTIONS TOOLS
    // =========================
    if (await handleToolsInteraction(interaction, client)) return;

    // =========================
    // BOUTONS SUGGESTIONS
    // =========================
    if (interaction.isButton() && (interaction.customId === 'sugg_vote_pour' || interaction.customId === 'sugg_vote_contre')) {
        const msgId = interaction.message.id;
        const data = suggestionsData.get(msgId);
        if (!data) {
            return interaction.reply({ content: "Cette suggestion est trop ancienne ou introuvable.", ephemeral: true });
        }

        const userId = interaction.user.id;
        const votePour = interaction.customId === 'sugg_vote_pour';
        let feedback = '';

        if (votePour) {
            if (data.pour.includes(userId)) {
                data.pour = data.pour.filter(id => id !== userId);
                feedback = '❌ Vote « Pour » retiré !';
            } else {
                data.pour.push(userId);
                data.contre = data.contre.filter(id => id !== userId);
                feedback = '✅ Tu as voté « Pour » !';
            }
        } else {
            if (data.contre.includes(userId)) {
                data.contre = data.contre.filter(id => id !== userId);
                feedback = '❌ Vote « Contre » retiré !';
            } else {
                data.contre.push(userId);
                data.pour = data.pour.filter(id => id !== userId);
                feedback = '❌ Tu as voté « Contre » !';
            }
        }

        suggestionsData.set(msgId, data);
        demanderSauvegarde();

        const authorMember = interaction.guild.members.cache.get(data.authorId);
        const embed = buildSuggestionEmbed(data, authorMember);
        const row = buildSuggestionRow(data);

        await interaction.update({ embeds: [embed], components: [row] });
        return interaction.followUp({ content: feedback, ephemeral: true });
    }

    // blagues et questions sont gérées par handleSocialInteraction

    // =========================
    // INTERACTIONS !HELP OPTIMISÉ
    // =========================

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('help_select_')) {
        const parts = interaction.customId.split('_');
        const authorId = parts[2];
        const messageId = parts[3] ?? null;

        if (interaction.user.id !== authorId) {
            return interaction.reply({ content: "Ce menu d'aide ne t'est pas destiné !", ephemeral: true });
        }

        const category = interaction.values[0];
        const embed = buildHelpCategoryEmbed(category);
        const menuRow = buildHelpMenu(authorId, messageId);
        const navRow = buildHelpNavRow(authorId, messageId);
        return interaction.update({ embeds: [embed], components: [menuRow, navRow] });
    }

    if (interaction.isButton() && interaction.customId.startsWith('help_home_')) {
        const parts = interaction.customId.split('_');
        const authorId = parts[2];
        const messageId = parts[3] ?? null;

        if (interaction.user.id !== authorId) {
            return interaction.reply({ content: "Ce bouton ne t'est pas destiné !", ephemeral: true });
        }

        const embed = buildHelpHomeEmbed();
        const menuRow = buildHelpMenu(authorId, messageId);
        const navRow = buildHelpNavRow(authorId, messageId);
        return interaction.update({ embeds: [embed], components: [menuRow, navRow] });
    }

    if (interaction.isButton() && interaction.customId.startsWith('help_delete_')) {
        const parts = interaction.customId.split('_');
        const authorId = parts[2];
        const messageId = parts[3] ?? null;

        if (interaction.user.id !== authorId) {
            return interaction.reply({ content: "Tu ne peux pas supprimer ce message !", ephemeral: true });
        }

        await interaction.message.delete().catch(() => {});
        if (messageId && messageId !== '') {
            const originalMsg = await interaction.channel.messages.fetch(messageId).catch(() => null);
            if (originalMsg) await originalMsg.delete().catch(() => {});
        }
        return;
    }

    // question_new_ est géré par handleSocialInteraction
} catch (err) {
    console.error('Erreur interactionCreate:', err);
    if (err.code === 10062 || err.message?.includes('Unknown interaction') || err.message?.includes('expired')) {
        if (interaction.isButton()) {
            interaction.reply({ content: "Ce bouton n'est plus disponible !", ephemeral: true }).catch(() => {});
        }
    }
}
});

// =========================
//         CONNEXION
// =========================

client.on('channelCreate', async (channel) => {
    if (channel.type === ChannelType.GuildText) {
        await assurerWebhookRoulette(channel).catch(() => {});
    }
});

client.once('ready', async () => {
    console.log(`✅ ${client.user.tag} est connecté`);

    // Enregistrement des commandes Slash (/)
    const slashCommands = [
        // Général & Aide
        new SlashCommandBuilder().setName('help').setDescription('Ouvre le guide d\'utilisation officiel de Cacabot'),

        // Roulette & Raccourcis
        new SlashCommandBuilder()
            .setName('roulette')
            .setDescription('🎰 Roulette Regaïenne')
            .addSubcommand(sub =>
                sub.setName('go')
                    .setDescription('🎲 Lancer immédiatement le tirage de la roulette')
            )
            .addSubcommand(sub =>
                sub.setName('claim')
                    .setDescription('🎁 Ouvrir son inventaire et activer ses récompenses')
            )
            .addSubcommand(sub =>
                sub.setName('top')
                    .setDescription('🏆 Voir le panthéon des chasseurs de succès')
            )
            .addSubcommand(sub =>
                sub.setName('state')
                    .setDescription('📊 Voir les effets, bonus et malus actifs')
                    .addUserOption(opt => opt.setName('membre').setDescription('Membre à inspecter (optionnel)'))
            )
            .addSubcommand(sub =>
                sub.setName('stats')
                    .setDescription('📈 Voir les statistiques de tirage')
                    .addUserOption(opt => opt.setName('membre').setDescription('Membre à inspecter (optionnel)'))
            )
            .addSubcommand(sub =>
                sub.setName('succes')
                    .setDescription('🎖️ Voir les succès débloqués')
                    .addUserOption(opt => opt.setName('membre').setDescription('Membre à inspecter (optionnel)'))
            ),

        // Motus & Rébus Regaïen
        new SlashCommandBuilder().setName('motus').setDescription('Statut du Motus du jour (10h et 19h) et compte à rebours'),
        new SlashCommandBuilder().setName('motustats').setDescription('Consulter les victoires et parties au Motus')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à inspecter')),
        new SlashCommandBuilder().setName('rebus').setDescription('Statut du Rébus Regaïen du jour (15h00) et compte à rebours'),
        new SlashCommandBuilder().setName('decodeur').setDescription('Statut du Rébus Regaïen (raccourci)'),
        new SlashCommandBuilder().setName('rebusstats').setDescription('Consulter les victoires et points au Rébus Regaïen')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à inspecter')),

        // Citations & Profils
        new SlashCommandBuilder().setName('quote').setDescription('Afficher une citation culte du serveur')
            .addStringOption(opt => opt.setName('recherche').setDescription('Numéro, mot-clé ou membre')),
        new SlashCommandBuilder().setName('citation').setDescription('Afficher une citation culte (raccourci)')
            .addStringOption(opt => opt.setName('recherche').setDescription('Numéro, mot-clé ou membre')),
        new SlashCommandBuilder().setName('profil').setDescription('Fiche détaillée d\'un·e membre (messages, badges, etc.)')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à inspecter')),
        new SlashCommandBuilder().setName('profile').setDescription('Fiche détaillée d\'un·e membre (raccourci)')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à inspecter')),
        new SlashCommandBuilder().setName('avatar').setDescription('Affiche l\'avatar d\'un·e membre en grand format')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à inspecter')),
        new SlashCommandBuilder().setName('top').setDescription('Classement général des membres les plus actifs'),
        new SlashCommandBuilder().setName('actif').setDescription('Podium des membres les plus actifs (Jour, Semaine, Mois)'),

        // Jeux & Social
        new SlashCommandBuilder().setName('lovecalc').setDescription('Calculer la compatibilité amoureuse entre deux membres')
            .addUserOption(opt => opt.setName('membre1').setDescription('Premier membre').setRequired(true))
            .addUserOption(opt => opt.setName('membre2').setDescription('Deuxième membre').setRequired(true)),
        new SlashCommandBuilder().setName('flip').setDescription('Lancer une pièce à pile ou face (solo ou duel)'),
        new SlashCommandBuilder().setName('destin').setDescription('Prédit votre destin cosmique'),
        new SlashCommandBuilder().setName('horoscope').setDescription('L\'oracle cosmique du jour'),
        new SlashCommandBuilder().setName('animal').setDescription('Devine ton animal spirituel')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à analyser')),
        new SlashCommandBuilder().setName('blague').setDescription('Raconte une blague aléatoire')
            .addStringOption(opt => opt.setName('type').setDescription('Catégorie').addChoices(
                { name: 'Humour soft', value: 'soft' },
                { name: 'Humour classique', value: 'classique' },
                { name: 'Humour noir', value: 'noir' }
            )),
        new SlashCommandBuilder().setName('topchef').setDescription('Critique et note gastronomique d\'un plat')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à noter')),
        new SlashCommandBuilder().setName('epsys').setDescription('Envoie un GIF aléatoire d\'Epsys'),
        new SlashCommandBuilder().setName('bougetoi').setDescription('Rappelle (vigoureusement) à Epsys d\'aller monter sa vidéo'),
        new SlashCommandBuilder().setName('sylvain').setDescription('Singe fort ensemble (Sylvain Lévy)'),
        new SlashCommandBuilder().setName('question').setDescription('Question de débat du soir'),
        new SlashCommandBuilder().setName('choix').setDescription('Laisse Cacabot trancher un dilemme')
            .addStringOption(opt => opt.setName('question').setDescription('Ex : pizza ou burger ?').setRequired(true)),
        new SlashCommandBuilder().setName('welcome').setDescription("Configurer ou tester l'accueil (Epsys-only)")
            .addSubcommand(sub => sub.setName('config').setDescription('Ouvrir le panneau de configuration'))
            .addSubcommand(sub => sub.setName('test').setDescription("Tester l'affiche avec ta photo")),
        new SlashCommandBuilder().setName('suggestion').setDescription('Proposer une idée pour le serveur')
            .addStringOption(opt => opt.setName('proposition').setDescription('Ton idée').setRequired(true)),
        new SlashCommandBuilder().setName('sugg').setDescription('Proposer une idée pour le serveur (raccourci)')
            .addStringOption(opt => opt.setName('proposition').setDescription('Ton idée').setRequired(true)),

        // Interactions (et leurs raccourcis français)
        new SlashCommandBuilder().setName('kiss').setDescription('Embrasser un·e membre')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à embrasser').setRequired(true)),
        new SlashCommandBuilder().setName('bisou').setDescription('Embrasser un·e membre (raccourci)')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à embrasser').setRequired(true)),
        new SlashCommandBuilder().setName('hug').setDescription('Faire un câlin à un·e membre')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à câliner').setRequired(true)),
        new SlashCommandBuilder().setName('calin').setDescription('Faire un câlin à un·e membre (raccourci)')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à câliner').setRequired(true)),
        new SlashCommandBuilder().setName('rizz').setDescription('Tenter de séduire un·e membre')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à rizz').setRequired(true)),
        new SlashCommandBuilder().setName('punch').setDescription('Frapper un·e membre')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à frapper').setRequired(true)),
        new SlashCommandBuilder().setName('frappe').setDescription('Frapper un·e membre (raccourci)')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à frapper').setRequired(true)),
        new SlashCommandBuilder().setName('bang').setDescription('Tirer sur un·e membre')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à viser').setRequired(true)),
        new SlashCommandBuilder().setName('tir').setDescription('Tirer sur un·e membre (raccourci)')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à viser').setRequired(true)),
        new SlashCommandBuilder().setName('insult').setDescription('Insulter gratuitement un·e membre')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à insulter').setRequired(true)),
        new SlashCommandBuilder().setName('bait').setDescription('Ragebait un·e membre')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à bait').setRequired(true)),
        new SlashCommandBuilder().setName('ban').setDescription('Faussement bannir un·e membre')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à bannir').setRequired(true)),
        new SlashCommandBuilder().setName('danse').setDescription('S\'ambiancer sur le dancefloor')
            .addUserOption(opt => opt.setName('membre').setDescription('Avec qui danser')),
        new SlashCommandBuilder().setName('dance').setDescription('S\'ambiancer sur le dancefloor (raccourci)')
            .addUserOption(opt => opt.setName('membre').setDescription('Avec qui danser')),
        new SlashCommandBuilder().setName('rire').setDescription('Se taper une barre de rire')
            .addUserOption(opt => opt.setName('membre').setDescription('De qui rire')),
        new SlashCommandBuilder().setName('cry').setDescription('Pleurer en solo ou à cause de quelqu\'un')
            .addUserOption(opt => opt.setName('membre').setDescription('Qui te fait pleurer')),
        new SlashCommandBuilder().setName('pleure').setDescription('Pleurer en solo ou à cause de quelqu\'un (raccourci)')
            .addUserOption(opt => opt.setName('membre').setDescription('Qui te fait pleurer')),
        new SlashCommandBuilder().setName('run').setDescription('Prendre la fuite')
            .addUserOption(opt => opt.setName('membre').setDescription('Qui fuir')),
        new SlashCommandBuilder().setName('court').setDescription('Prendre la fuite (raccourci)')
            .addUserOption(opt => opt.setName('membre').setDescription('Qui fuir')),
        new SlashCommandBuilder().setName('explode').setDescription('Exploser sans aucune raison'),
        new SlashCommandBuilder().setName('explose').setDescription('Exploser sans aucune raison (raccourci)'),
        new SlashCommandBuilder().setName('die').setDescription('Mourir dans d\'atroces souffrances')
            .addUserOption(opt => opt.setName('membre').setDescription('Qui cause ta mort')),
        new SlashCommandBuilder().setName('jailaref').setDescription('Affirmer fièrement que tu as la référence')
            .addUserOption(opt => opt.setName('membre').setDescription('De qui')),
        new SlashCommandBuilder().setName('palaref').setDescription('Assumer que tu n\'as rien compris')
            .addUserOption(opt => opt.setName('membre').setDescription('De qui')),

        // Anniversaires
        new SlashCommandBuilder().setName('anniversaire').setDescription('Gestion des anniversaires du serveur')
            .addSubcommand(sub => sub.setName('show').setDescription('Affiche un anniversaire et le compte à rebours')
                .addUserOption(opt => opt.setName('membre').setDescription('Le membre')))
            .addSubcommand(sub => sub.setName('set').setDescription('Enregistre un anniversaire (format JJ/MM)')
                .addStringOption(opt => opt.setName('date').setDescription('Format JJ/MM (ex : 24/07)').setRequired(true))
                .addUserOption(opt => opt.setName('membre').setDescription('Attribuer à')))
            .addSubcommand(sub => sub.setName('list').setDescription('Liste complète des anniversaires'))
            .addSubcommand(sub => sub.setName('next').setDescription('Prochain anniversaire à fêter'))
            .addSubcommand(sub => sub.setName('remove').setDescription('Supprimer un anniversaire')
                .addUserOption(opt => opt.setName('membre').setDescription('Le membre'))),

        // Utilitaires & YouTube
        new SlashCommandBuilder().setName('serveur').setDescription('Informations complètes sur le serveur Regaïa'),
        new SlashCommandBuilder().setName('meteo').setDescription('Météo en direct d\'une ville')
            .addStringOption(opt => opt.setName('ville').setDescription('La ville').setRequired(true)),
        new SlashCommandBuilder().setName('pomodoro').setDescription('Session de travail Pomodoro')
            .addSubcommand(sub => sub.setName('lancer').setDescription('Démarrer un Pomodoro'))
            .addSubcommand(sub => sub.setName('stop').setDescription('Arrêter le Pomodoro')),
        new SlashCommandBuilder().setName('rappel').setDescription('Gérer tes rappels')
            .addSubcommand(sub => sub.setName('ajouter').setDescription('Programmer un rappel')
                .addStringOption(opt => opt.setName('temps').setDescription('Ex : 10min, 1h').setRequired(true))
                .addStringOption(opt => opt.setName('message').setDescription('Texte du rappel').setRequired(true)))
            .addSubcommand(sub => sub.setName('list').setDescription('Voir tes rappels en attente'))
            .addSubcommand(sub => sub.setName('remove').setDescription('Supprimer un rappel')
                .addStringOption(opt => opt.setName('nom').setDescription('Nom du rappel').setRequired(true))),
        new SlashCommandBuilder().setName('aternos').setDescription('IP du serveur Minecraft'),
        new SlashCommandBuilder().setName('youtube').setDescription('Rechercher une vidéo sur YouTube')
            .addStringOption(opt => opt.setName('recherche').setDescription('Titre ou mot-clé').setRequired(true)),
        new SlashCommandBuilder().setName('last').setDescription('Dernière vidéo publiée d\'une chaîne')
            .addStringOption(opt => opt.setName('chaine').setDescription('Nom de la chaîne').setRequired(true)),
        new SlashCommandBuilder().setName('stats').setDescription('Statistiques d\'une chaîne YouTube')
            .addStringOption(opt => opt.setName('chaine').setDescription('Nom de la chaîne').setRequired(true)),
        new SlashCommandBuilder().setName('botinfo').setDescription('Infos techniques et version de Cacabot'),
        new SlashCommandBuilder().setName('about').setDescription('Infos techniques (raccourci)'),
        new SlashCommandBuilder().setName('ping').setDescription('Latence du bot et WebSocket'),
        new SlashCommandBuilder().setName('prune').setDescription('Supprimer les derniers messages')
            .addIntegerOption(opt => opt.setName('nombre').setDescription('Nombre de messages à supprimer').setRequired(true)),
        new SlashCommandBuilder().setName('embed').setDescription('Créateur ou modificateur d\'embed (Epsys-only)')
            .addStringOption(opt => opt.setName('modifier').setDescription('ID du message contenant l\'embed à modifier'))
    ].map(cmd => cmd.toJSON());

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    const REGAIA_GUILD_ID = '720057528351850547';

    for (const guild of client.guilds.cache.values()) {
        const body = guild.id === REGAIA_GUILD_ID ? slashCommands : [];
        await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), { body })
            .then(() => {
                if (guild.id === REGAIA_GUILD_ID) {
                    console.log(`✅ Commandes Slash (/) déployées exclusivement sur ${guild.name}`);
                }
            })
            .catch(err => console.error(`Erreur déploiement Slash sur ${guild.name}:`, err.message));
    }

    // Chargement immédiat des données sans attendre
    await loadAll();

    // Envoi immédiat du message de retour à la seconde où les commandes sont opérationnelles
    (async () => {
        try {
            const salonNotif = await client.channels.fetch('1480756332373213275').catch(() => null);
            if (salonNotif) {
                let nouveauCommitDetecte = false;
                if (process.env.GITHUB_TOKEN) {
                    const resCommits = await fetch('https://api.github.com/repos/R3GS/Cacabot/commits?per_page=1', {
                        headers: {
                            'Authorization': `token ${process.env.GITHUB_TOKEN}`,
                            'Accept': 'application/vnd.github.v3+json'
                        }
                    }).then(r => r.json()).catch(() => null);

                    const shaActuel = Array.isArray(resCommits) && resCommits[0]?.sha ? resCommits[0].sha : null;
                    if (shaActuel && shaActuel !== dernierCommitSha) {
                        dernierCommitSha = shaActuel;
                        nouveauCommitDetecte = true;
                        demanderSauvegarde();
                    }
                } else {
                    nouveauCommitDetecte = true;
                }

                if (nouveauCommitDetecte) {
                    const commitCount = await getCommitCount();
                    const versionTexte = commitCount ? ` *(Version 1.${commitCount})*` : '';
                    const msgRetour = await salonNotif.send(`✅ Mise à jour faite, je suis de retour !${versionTexte}\nLaisse-moi encore 10 secondes et tu pourras exéctuer des commandes...`);
                    setTimeout(async () => {
                        await msgRetour.edit(`✅ Mise à jour faite, je suis de retour !${versionTexte}\nTout est prêt :)`).catch(() => {});
                    }, 10000);

                    // Envoi automatique du fichier index.js dans le salon d'archives de code
                    const salonCode = await client.channels.fetch('1556184304848085114').catch(() => null);
                    if (salonCode) {
                        const versionNom = commitCount ? `1.${commitCount}` : 'actuelle';
                        const dateStr = new Date().toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' }) + ' à ' + new Date().toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris' });

                        await salonCode.send({
                            content: `📦 **Code source — Version ${versionNom}**\n-# *Déployé le ${dateStr}*`,
                            files: [{ attachment: './index.js', name: `index_v${versionNom}.js` }]
                        }).catch(err => console.error("Erreur envoi index.js :", err.message));
                    }
                }
            }
        } catch (err) {
            console.error("Erreur notification de mise à jour :", err.message);
        }
    })();

    for (const [uid, chId] of rouletteNotifs) armerNotifRoulette(uid, chId, client);
    cleanOldData();
    setInterval(() => verifierHappyHour(client), 30 * 1000);
    setInterval(() => verifierTwitchLive(client), 60 * 1000);

    // Lancement et vérification automatique des Motus (10h et 19h) + arrêt après 1 heure
    let derniereSessionLancee = null;
    const verifierMotusAutomatique = async () => {
        const now = new Date();
        const paris = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
        const dateKey = paris.getFullYear() * 10000 + (paris.getMonth() + 1) * 100 + paris.getDate();
        const h = paris.getHours();
        const m = paris.getMinutes();
        const guildRegaia = client.guilds.cache.get('720057528351850547');

        // 1. Lancement du Motus du matin à 10h00 (6 lettres)
        if (h === 10 && m === 0 && derniereSessionLancee !== `${dateKey}_10h`) {
            derniereSessionLancee = `${dateKey}_10h`;
            if (guildRegaia) await envoyerMotusQuotidien(guildRegaia, 10);
        }

        // 2. Lancement du Rébus Regaïen à 15h00 (5 manches de 5 minutes)
        if (h === 15 && m === 0 && derniereSessionLancee !== `${dateKey}_15h`) {
            derniereSessionLancee = `${dateKey}_15h`;
            if (guildRegaia) await lancerSessionRebus(guildRegaia);
        }

        // 3. Lancement du Motus du soir à 19h00 (7 lettres - Difficile)
        if (h === 19 && m === 0 && derniereSessionLancee !== `${dateKey}_19h`) {
            derniereSessionLancee = `${dateKey}_19h`;
            if (guildRegaia) await envoyerMotusQuotidien(guildRegaia, 19);
        }

        // 3. Arrêt automatique après 1h de jeu si le mot n'a pas été trouvé
        if (motusData.mot && !motusData.termine && motusData.expireAt && Date.now() >= motusData.expireAt) {
            motusData.termine = true;
            const salon = client.channels.cache.get(MOTUS_CHANNEL_ID);
            if (salon) {
                const prochainTxt = motusData.heureSession === 10 
                    ? 'ce soir à **19h00 (7 lettres - Difficile)**' 
                    : 'demain matin à **10h00 (6 lettres)**';

                const embedFin = new EmbedBuilder()
                    .setColor(0xe74c3c)
                    .setTitle('⏰ TEMPS ÉCOULÉ ! (Fin du Motus)')
                    .setDescription(
                        `L'heure de jeu est terminée et personne n'a trouvé le mot !\n\n` +
                        `🔤 **Le mot était :** \`${motusData.mot}\`\n\n` +
                        `Rendez-vous ${prochainTxt} pour une nouvelle session !`
                    )
                    .setFooter({ text: 'Motus Quotidien • 1 heure de jeu par session' });

                await salon.send({ embeds: [embedFin] }).catch(() => {});
            }
            demanderSauvegarde();
        }
    };
    setInterval(verifierMotusAutomatique, 30 * 1000);

    // Tâches de fond sans bloquer l'état du bot
    for (const guild of client.guilds.cache.values()) {
        await guild.members.fetch().catch(() => {});
    }
    console.log(`✅ Membres fetchés`);

    for (const guild of client.guilds.cache.values()) {
        await initialiserWebhooksRoulette(guild);
    }

    scheduleBirthdayCheck(client);
});

// =========================
//     LISTENER REACTIONS
// =========================

client.on('messageReactionAdd', async (reaction, user) => {
    await handleSecurityReactionAdd(reaction, user);

    if (user.bot) return;
    if (reaction.emoji.name !== '🖕' && reaction.emoji.name !== 'middle_finger') return;

    const msg = reaction.message;
    if (msg.author.id !== client.user.id) return;

    const emojiReaction = msg.reactions.cache.find(r =>
        r.emoji.name === '🖕' || r.emoji.name === 'middle_finger'
    );
    if (emojiReaction && emojiReaction.count > 1) return;

    const memberNom = msg.guild?.members.cache.get(user.id)?.displayName ?? user.username;
    await msg.channel.send(`Bah alors, **${memberNom}**, on m'envoie un doigt d'honneur ?`);
});

client.on('messageReactionRemove', async (reaction, user) => {
    await handleSecurityReactionRemove(reaction, user);
});

const dernierAuteurParSalon = new Map();
client.on('messageCreate', async (message) => {
    await handleRouletteCouronne(message, dernierAuteurParSalon);
    await handleRouletteTransfoMessage(message, client);
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
    await handleRoulettePseudoLock(oldMember, newMember);
});

// =========================
//   LISTENER MEMBER JOIN
// =========================

client.on('guildMemberAdd', async (member) => {
    if (!topData.messages[member.id]) {
        topData.messages[member.id] = 0;
        saveAll();
        console.log(`✅ Nouveau membre : ${member.displayName} ajouté au top`);
    }

    await handleWelcomeMemberAdd(member);
    await handleSecurityMemberAdd(member);
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    await handleVoiceStateUpdate(oldState, newState);
});

client.login(process.env.TOKEN);
