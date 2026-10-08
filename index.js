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
try { registerFont('./Cowboy Movie.ttf', { family: 'CowboyMovie' }); } catch(e) { console.error('Font non trouvée:', e.message); }

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

///wanted.js
const { handleWantedMessage, handleWantedButton, handleWantedSlash, scheduleWanted } = require('./wanted.js');

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

// =========================
//     DONNÉES WANTED
// =========================
// Déporté dans ./wanted.js

const FEUR_IMMUNE = ['1503495713097519355'];

// =========================
//     LOGIQUE MOTUS (10h & 19h)
// =========================
// Déporté dans ./minijeux.js

const TWITCH_CHANNEL_ID = '862253918583390238';
const TWITCH_ROLE_ID = '862058765674741760';
const TWITCH_USER = 'epsys_';

// =========================
//    SURVEILLANCE TWITCH
// =========================

async function buildTwitchLivePayload() {
    const liveUrl = `https://twitch.tv/${TWITCH_USER}`;
    const previewUrl = `https://static-cdn.jtvnw.net/previews-ttv/live_user_${TWITCH_USER}-1280x720.jpg?t=${Date.now()}`;

    const [titreRaw, jeuRaw, avatarRaw] = await Promise.all([
        fetch(`https://decapi.me/twitch/title/${TWITCH_USER}`).then(r => r.text()).catch(() => 'Live Twitch !'),
        fetch(`https://decapi.me/twitch/game/${TWITCH_USER}`).then(r => r.text()).catch(() => 'Just Chatting'),
        fetch(`https://decapi.me/twitch/avatar/${TWITCH_USER}`).then(r => r.text()).catch(() => null)
    ]);

    const titre = titreRaw.trim() || 'En direct sur Twitch !';
    const jeu = jeuRaw.trim() || 'Just Chatting';
    const avatar = (avatarRaw && avatarRaw.startsWith('http')) ? avatarRaw.trim() : null;

    const embed = new EmbedBuilder()
        .setColor(0x9146ff)
        .setAuthor({ 
            name: `En direct sur Twitch !`, 
            url: liveUrl 
        })
        .setTitle(titre)
        .setURL(liveUrl)
        .addFields(
            { name: '🎮 Jeu / Catégorie', value: `\`${jeu}\``, inline: true },
            { name: '📺 Chaîne', value: `[twitch.tv/${TWITCH_USER}](${liveUrl})`, inline: true }
        )
        .setImage(previewUrl)
        .setFooter({ text: '🔴 Live Twitch • Notification automatique' })
        .setTimestamp();

    if (avatar) embed.setThumbnail(avatar);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel('▶️ Rejoindre le stream')
            .setStyle(ButtonStyle.Link)
            .setURL(liveUrl)
    );

    return {
        content: `📢 Hey <@&${TWITCH_ROLE_ID}> !\n**Epsys** vient de lancer un live !`,
        embeds: [embed],
        components: [row]
    };
}

async function verifierTwitchLive() {
    try {
        const res = await fetch(`https://decapi.me/twitch/uptime/${TWITCH_USER}`).catch(() => null);
        if (!res || !res.ok) return; // Si DecAPI plante (erreur 500/502/timeout), on ignore totalement

        const resUptime = (await res.text()).trim();

        // Rejette si la réponse est vide, contient du HTML Cloudflare ou un message d'erreur
        if (!resUptime || resUptime.startsWith('<') || resUptime.toLowerCase().includes('error')) return;

        // Vérifie si le mot-clé hors-ligne est présent
        const estHorsLigne = resUptime.toLowerCase().includes('offline') || resUptime.toLowerCase().includes('not found');

        // Quand un live est RÉELLEMENT en cours, DecAPI renvoie obligatoirement un format de temps : "X minutes, Y seconds"
        const aDureeValide = /\b(second|minute|hour|day)s?\b/i.test(resUptime);

        const estEnLigne = !estHorsLigne && aDureeValide;

        if (estEnLigne && !twitchLiveEnCours) {
            twitchLiveEnCours = true;
            const channel = client.channels.cache.get(TWITCH_CHANNEL_ID);
            if (!channel) return;

            const payload = await buildTwitchLivePayload();
            await channel.send(payload);
            console.log(`[Twitch] Vrai live détecté pour ${TWITCH_USER} (${resUptime}) !`);
        } else if (!estEnLigne && twitchLiveEnCours) {
            twitchLiveEnCours = false; // Réinitialise quand le live s'arrête
        }
    } catch (e) {
        // En cas de crash réseau, ne jamais considérer que le live est lancé
    }
}

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
    //         !DIE
    // =========================

    if (command === "!wanted") {
    const args = raw.trim().split(/\s+/);
    if (args[1]?.toLowerCase() === 'set') return { needsWantedSet: true };
    return { needsWanted: true };
}

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

    // =========================
    //         !QUESTION
    // =========================

    if (command === "!question") {
        return { needsQuestion: true };
    }


    // =========================
    //         !DESTIN
    // =========================

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

const rappelReports = new Map();
const pendingRappels = new Map();
function generateRappelId() {
    return `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

const pomodoroSessions = new Map();
const vocalMessages = new Map();
const dernierMessageParUtilisateur = new Map();
const MOD_CHANNEL_ID = '1555402748193669192';

// --- Anti-phishing ---
const PHISHING_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:discor(?:d(?:app)?|cl|cb|ct|cl-app|d-nitro|d-gift|dapp|dstatus)?[-_.]+(?:gift|nitro|giveaway|drop|claim|steam|promo|boost|vip|com\.ru|xyz|tk|ga|ml|cf|gq|club|top|click|link)|steamcommuni(?:i|l)ty\.[a-z]+)\b/i;

// --- Slowmode d'urgence ---
const slowmodeTrackers = new Map(); // channelId -> [{ userId, timestamp }]
const slowmodeActifs = new Set();   // channelIds actuellement en slowmode d'urgence

// --- Anti-spam ---
const spamTracker = new Map(); // userId -> timestamps[]
const SPAM_WINDOW_MS = 5000;
const SPAM_THRESHOLD = 5;
const SPAM_TIMEOUT_MS = 5 * 60 * 1000;
const SPAM_EXEMPT_CHANNELS = ['1553954760900608091'];
const SPAM_EXEMPT_REGEX = /^!(rlt|roulette)(\s+go)?\s*$/i;

// --- Anti-raid ---
const raidJoinTracker = new Map();   // guildId -> [{ userId, timestamp }]
const raidFlaggedUsers = new Map();  // userId -> true (en attente de son 1er message)
const raidMuteRecord = new Map();    // userId -> timestamp de fin du timeout raid
const RAID_ACCOUNT_AGE_MS = 14 * 24 * 60 * 60 * 1000; // 2 semaines
const RAID_WINDOW_MS = 60 * 1000;    // 60s
const RAID_THRESHOLD = 3;
const RAID_TIMEOUT_MS = 5 * 60 * 1000;
const RAID_ESCALATION_WINDOW_MS = 15 * 60 * 1000; // 15min après la fin du mute

// --- Roulette ---
const EPSYS_ID = '436218312574107658';
const MODO_ROLE_ID = '720081311716606004';
function estModo(member) {
    return member?.roles?.cache?.has(MODO_ROLE_ID) ?? false;
}

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

const mutedChannels = new Map();
    function isChannelMuted(channelId) {
        const entry = mutedChannels.get(channelId);
        if (!entry) return false;
        if (Date.now() >= entry.until) { mutedChannels.delete(channelId); return false; }
        return true;
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

    // Recherche exacte d'abord
    const exact = guild.members.cache.filter(m =>
        (m.displayName && m.displayName.toLowerCase() === q) ||
        (m.user.username && m.user.username.toLowerCase() === q)
    );
    if (exact.size === 1) return { found: exact.first(), multiple: false, candidates: [] };
    if (exact.size > 1) {
        const candidates = exact.map(m => m.displayName ?? m.user.username);
        return { found: null, multiple: true, candidates };
    }

    // Recherche partielle
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


// Logique !flip déportée dans ./social.js

function decodeHtmlEntities(text) {
    if (!text) return text;
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(code));
}

async function scheduleRappel(channelId, targetId, texte, ms) {
    const rappelId = generateRappelId();
    const triggerAt = Date.now() + ms;

    const timeout = setTimeout(async () => {
        pendingRappels.delete(rappelId);
        try {
            const channel = await client.channels.fetch(channelId);
            const reportButton = new ButtonBuilder()
                .setCustomId(`rappel_report_${targetId}`)
                .setLabel('🔁 Reporter')
                .setStyle(ButtonStyle.Secondary);
            const reportRow = new ActionRowBuilder().addComponents(reportButton);
            const sentReminder = await channel.send({ content: `🔔 <@${targetId}> Rappel : **${texte}**`, components: [reportRow] });
            rappelReports.set(sentReminder.id, { targetId, texte, channelId });
        } catch (e) {
            console.error('Erreur scheduleRappel:', e);
        }
    }, ms);

    pendingRappels.set(rappelId, { targetId, texte, channelId, triggerAt, timeout });
    return rappelId;
}

function getMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getTodayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getWeekKey() {
    const d = new Date();
    const startOfYear = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil(((d - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${String(week).padStart(2,'0')}`;
}

function cleanOldData() {
    const now = new Date();
    // Garder seulement les 7 derniers jours
    Object.keys(dailyData).forEach(key => {
        const d = new Date(key);
        if ((now - d) / 86400000 > 7) delete dailyData[key];
    });
    // Garder seulement les 4 dernières semaines
    const currentWeek = getWeekKey();
    const [cy, cw] = currentWeek.split('-W').map(Number);
    Object.keys(weeklyData).forEach(key => {
        const [wy, ww] = key.split('-W').map(Number);
        const diff = (cy - wy) * 52 + (cw - ww);
        if (diff > 4) delete weeklyData[key];
    });
}

// Logique blagues et lovecalc déportée dans ./social.js

// Désactiver tous les boutons d'un message
async function disableButtons(interaction) {
    try {
        const msg = interaction.message;
        const newRows = msg.components.map(row => {
            const newRow = new ActionRowBuilder();
            newRow.addComponents(row.components.map(btn => {
                return ButtonBuilder.from(btn).setDisabled(true);
            }));
            return newRow;
        });
        await msg.edit({ components: newRows });
    } catch (e) {}
}

async function getCommitCount() {
    try {
        let page = 1;
        let total = 0;
        while (true) {
            const res = await fetch(`https://api.github.com/repos/R3GS/Cacabot/commits?path=index.js&per_page=100&page=${page}`, {
                headers: {
                    'Authorization': `token ${process.env.GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            const data = await res.json();
            if (!Array.isArray(data) || data.length === 0) break;
            total += data.length;
            if (data.length < 100) break;
            page++;
        }
        return total;
    } catch (e) {
        return null;
    }
}

async function startPomodoro(channel, participantsMention, workMin, breakMin, cycle, phase, reason = 'Session de travail') {
    const isWork = phase === 'work';
    const longBreak = cycle % 4 === 0 && !isWork;
    const breakDuration = longBreak ? 15 : breakMin;
    const totalMs = (isWork ? workMin : breakDuration) * 60 * 1000;
    const endTime = Date.now() + totalMs;

    const buildEmbed = (remainingMs) => {
        const mins = Math.floor(remainingMs / 60000);
        const secs = Math.floor((remainingMs % 60000) / 1000);
        const totalDuration = isWork ? workMin : breakDuration;
        const elapsed = totalDuration - Math.ceil(remainingMs / 60000);
        const barLength = 20;
        const filled = Math.round((Math.max(0, elapsed) / totalDuration) * barLength);
        const bar = '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, barLength - filled));

        return new EmbedBuilder()
            .setColor(isWork ? 0xe74c3c : 0x2ecc71)
            .setTitle(isWork ? `🍅 ${reason}` : (longBreak ? '☕ Grande pause !' : '⏸️ Pause'))
            .setDescription(participantsMention)
            .addFields(
                { name: 'Cycle', value: `${cycle}`, inline: true },
                { name: 'Phase', value: isWork ? `Travail (${workMin} min)` : `Pause (${breakDuration} min)`, inline: true },
                { name: 'Temps restant', value: `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`, inline: true },
                { name: 'Progression', value: `\`${bar}\``, inline: false }
            )
            .setFooter({ text: '!pomodoro stop pour arrêter' });
    };

    const sentMsg = await channel.send({
        content: isWork
            ? `${participantsMention} 🍅 C'est parti pour ${workMin} minutes de travail !`
            : `${participantsMention} ${longBreak ? '☕ Grande pause de 15 minutes !' : `⏸️ Pause de ${breakDuration} minutes !`}`,
        embeds: [buildEmbed(totalMs)],
        components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`pomo_skip_${channel.id}`)
                .setLabel('⏭️ Skip')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`pomo_stop_${channel.id}`)
                .setLabel('⏹️ Stop')
                .setStyle(ButtonStyle.Danger)
        )]
    });

    const updateInterval = setInterval(async () => {
        const remainingMs = endTime - Date.now();
        if (remainingMs <= 0) { clearInterval(updateInterval); return; }
        await sentMsg.edit({ embeds: [buildEmbed(remainingMs)] }).catch(() => {});
    }, 5000);

    const nextPhase = () => {
        clearInterval(updateInterval);
        pomodoroSessions.delete(channel.id);
        sentMsg.delete().catch(() => {});
        if (isWork) {
            startPomodoro(channel, participantsMention, workMin, breakMin, cycle, 'break');
        } else {
            startPomodoro(channel, participantsMention, workMin, breakMin, cycle + 1, 'work');
        }
    };

    const timeout = setTimeout(nextPhase, totalMs);

    pomodoroSessions.set(channel.id, {
        timeout,
        updateInterval,
        skip: nextPhase,
        message: sentMsg,
        cycle,
        phase
    });
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

        // Ping automatique du rôle quand un utilisateur spécifique poste dans un salon spécifique
        if (message.channel.id === '1460051840015269908' && message.author.id === '1525026449768321098') {
            await message.channel.send(`<@&1504492103194120273>`);
        }

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

    // Supprimer le message précédent si Shin poste sa pub Twitch dans le salon #Promo
    const REPOST_WATCH_USER = '1070742213635625050';
    const REPOST_WATCH_CHANNEL = '1230637295649034240';

        if (message.author.id === REPOST_WATCH_USER && message.channel.id === REPOST_WATCH_CHANNEL) {
        const contientLien = message.content.includes('https://www.twitch.tv/belrose_shin');

        if (contientLien) {
            const cle = `${message.channel.id}-${message.author.id}`;
            const precedent = dernierMessageParUtilisateur.get(cle);

            if (precedent) {
                await precedent.delete().catch(() => {});
            }

            dernierMessageParUtilisateur.set(cle, message);
        }
    }

    // !chut / !unchut
    const CHUT_AUTHORIZED = ['738191002187202630', '436218312574107658', '1070742213635625050', '899733709173948487', '375746968737021962', '116682911314345993'];
    const chutCommand = message.content.trim().split(/\s+/)[0]?.toLowerCase();

    if (chutCommand === '!chut') {
        if (!CHUT_AUTHORIZED.includes(message.author.id)) {
            return message.reply("Tu n'es pas autorisé.e à faire cette commande.");
        }
        const args = message.content.trim().split(/\s+/);
        const timeStr = args[1]?.toLowerCase();
        let ms = 0;
        if (timeStr?.endsWith('min')) ms = parseInt(timeStr) * 60 * 1000;
        else if (timeStr?.endsWith('h')) ms = parseInt(timeStr) * 60 * 60 * 1000;
        else return message.reply('Format invalide ! Utilise `!chut Xmin` ou `!chut Xh`. Ex : `!chut 10min`');
        if (isNaN(ms) || ms <= 0) return message.reply('Durée invalide !');
        if (ms > 24 * 60 * 60 * 1000) return message.reply('Maximum 24h !');

        const ancien = mutedChannels.get(message.channel.id);
        if (ancien) clearTimeout(ancien.timeout);

        const until = Date.now() + ms;
        const timeout = setTimeout(() => mutedChannels.delete(message.channel.id), ms);
        mutedChannels.set(message.channel.id, { until, timeout });
        return message.react('🤐').catch(() => {});
    }

    if (chutCommand === '!unchut') {
        if (!CHUT_AUTHORIZED.includes(message.author.id)) {
            return message.reply("Tu n'es pas autorisé.e à faire cette commande.");
        }
        const ancien = mutedChannels.get(message.channel.id);
        if (ancien) clearTimeout(ancien.timeout);
        mutedChannels.delete(message.channel.id);
        return message.react('👋').catch(() => {});
    }

        // !stop / !unstop / "Cacabot stop" / "Cacabot reviens" (accessible à tout le monde, 1h fixe)
    const STOP_DURATION_MS = 60 * 60 * 1000;
    const stopCommand = message.content.trim().split(/\s+/)[0]?.toLowerCase();
    const stopCleaned = message.content
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();

    const isStopTrigger = stopCommand === '!stop' || /\bcacabot\s+stop\b/.test(stopCleaned);
    const isUnstopTrigger = stopCommand === '!unstop' || /\bcacabot\s+reviens\b/.test(stopCleaned);

    if (isStopTrigger) {
        const ancien = mutedChannels.get(message.channel.id);
        if (ancien) clearTimeout(ancien.timeout);

        const until = Date.now() + STOP_DURATION_MS;
        const timeout = setTimeout(() => mutedChannels.delete(message.channel.id), STOP_DURATION_MS);
        mutedChannels.set(message.channel.id, { until, timeout });
        return message.react('🤐').catch(() => {});
    }

    if (isUnstopTrigger) {
        const ancien = mutedChannels.get(message.channel.id);
        if (ancien) clearTimeout(ancien.timeout);
        mutedChannels.delete(message.channel.id);
        return message.react('👋').catch(() => {});
    }

        // Anti-phishing (Faux Nitro / Liens de vol de compte)
    if (message.guild && message.member && !estModo(message.member) && PHISHING_REGEX.test(message.content)) {
        await message.delete().catch(() => {});
        await message.member.timeout(24 * 60 * 60 * 1000, 'Anti-phishing automatique (lien frauduleux)').catch(() => {});
        
        await message.channel.send(`🛡️ **${message.member.displayName}** a envoyé un lien frauduleux (compte probablement piraté). Il a été mis en pause 24h.`);

        const modChan = message.guild.channels.cache.get(MOD_CHANNEL_ID);
        if (modChan) {
            const embedPhish = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('🚨 ALERTE PHISHING / FAUX NITRO')
                .setDescription(`Un lien malveillant a été stoppé net dans <#${message.channel.id}>.`)
                .addFields(
                    { name: '👤 Auteur', value: `<@${message.author.id}> (\`${message.author.id}\`)`, inline: true },
                    { name: '🔗 Contenu bloqué', value: `\`\`\`${message.content.slice(0, 500)}\`\`\``, inline: false }
                )
                .setTimestamp();

            const banBtn = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`antiphish_ban_${message.author.id}`)
                    .setLabel('🔨 Bannir le compte piraté')
                    .setStyle(ButtonStyle.Danger)
            );
            await modChan.send({ embeds: [embedPhish], components: [banBtn] });
        }
        return;
    }

    // Slowmode d'urgence automatique (anti-débordement)
    if (message.guild && !message.author.bot && message.channel.type === ChannelType.GuildText && !slowmodeActifs.has(message.channel.id)) {
        const now = Date.now();
        const logs = (slowmodeTrackers.get(message.channel.id) || []).filter(e => now - e.timestamp < 8000);
        logs.push({ userId: message.author.id, timestamp: now });
        slowmodeTrackers.set(message.channel.id, logs);

        const auteursUniques = new Set(logs.map(e => e.userId));
        // Si 15 messages ou plus en 8 secondes par au moins 3 personnes différentes
        if (logs.length >= 15 && auteursUniques.size >= 3) {
            slowmodeActifs.add(message.channel.id);
            slowmodeTrackers.delete(message.channel.id);

            const ancienSlowmode = message.channel.rateLimitPerUser || 0;
            await message.channel.setRateLimitPerUser(10, 'Slowmode d\'urgence automatique').catch(() => {});

            await message.channel.send('🛑 **Oula, le salon s\'emballe !** Slowmode temporaire de **10 secondes** activé pendant **3 minutes** pour apaiser les esprits.');

            setTimeout(async () => {
                await message.channel.setRateLimitPerUser(ancienSlowmode, 'Fin du slowmode d\'urgence').catch(() => {});
                slowmodeActifs.delete(message.channel.id);
                await message.channel.send('✅ **Fin du slowmode d\'urgence**, retour au rythme normal !').catch(() => {});
            }, 3 * 60 * 1000);
        }
    }

        // Anti-spam
    if (
        message.guild && message.member &&
        !CHUT_AUTHORIZED.includes(message.author.id) &&
        !SPAM_EXEMPT_CHANNELS.includes(message.channel.id) &&
        !SPAM_EXEMPT_REGEX.test(message.content.trim())
    ) {
        const now = Date.now();
        const spamTimestamps = (spamTracker.get(message.author.id) || []).filter(t => now - t < SPAM_WINDOW_MS);
        spamTimestamps.push(now);
        spamTracker.set(message.author.id, spamTimestamps);

        if (spamTimestamps.length >= SPAM_THRESHOLD) {
            spamTracker.delete(message.author.id);
            try {
                await message.member.timeout(SPAM_TIMEOUT_MS, 'Anti-spam automatique');
                await message.channel.send(`🔇 **${message.member.displayName}** a été mis en pause **5 minutes** pour spam.`);
            } catch (err) {
                console.error('Erreur timeout anti-spam:', err);
            }
        }
    }

    // Anti-raid : timeout au 1er message d'un compte flaggé pendant une rafale
    if (message.guild && message.member && raidFlaggedUsers.has(message.author.id)) {
        raidFlaggedUsers.delete(message.author.id);
        try {
            await message.member.timeout(RAID_TIMEOUT_MS, 'Anti-raid automatique').catch(() => {});
            raidMuteRecord.set(message.author.id, Date.now() + RAID_TIMEOUT_MS);
            await message.channel.send(`🚨 **${message.member.displayName}** fait partie d'une vague d'arrivées suspectes et a été mis en pause **5 minutes**.`);
            await message.member.send("Ton compte a été repéré dans une vague d'arrivées suspectes sur le serveur, tu as été mis en pause 5 minutes. Si tu quittes et reviens dans les 15 minutes qui suivent la fin de cette pause, tu seras automatiquement exclu du serveur.").catch(() => {});

            const modLogChan = message.guild.channels.cache.get(MOD_CHANNEL_ID);
            if (modLogChan) {
                const raidEmbed = new EmbedBuilder()
                    .setColor(0xff0033)
                    .setTitle('🚨 ALERTE ANTI-RAID')
                    .setDescription(`Un compte suspect a tenté d'écrire pendant une vague d'arrivées et a été mis en pause 5 min.`)
                    .addFields(
                        { name: '👤 Suspect', value: `<@${message.author.id}> (\`${message.author.id}\`)`, inline: true },
                        { name: '📍 Salon ciblé', value: `<#${message.channel.id}>`, inline: true },
                        { name: '💬 Premier message', value: `\`\`\`${message.content.slice(0, 500) || '*Vide / Média*'}\`\`\``, inline: false }
                    )
                    .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                    .setTimestamp();

                const raidButtons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`mod_action_kick_${message.author.id}`).setLabel('👢 Expulser').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId(`mod_action_ban_${message.author.id}`).setLabel('🔨 Bannir').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId(`mod_action_dismiss_${message.author.id}`).setLabel('✅ Ignorer').setStyle(ButtonStyle.Success)
                );
                await modLogChan.send({ embeds: [raidEmbed], components: [raidButtons] });
            }
        } catch (err) {
            console.error('Erreur timeout anti-raid:', err);
        }
    }

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

    // Remplacement liens Instagram (Reels + Posts)
    const instaRegex = /https?:\/\/(?:www\.)?instagram\.com\/(?:reel|p)\/[^\s]+/gi;
    const instaMatches = message.content.match(instaRegex);
    if (instaMatches) {
        const auteurNom = message.member?.displayName ?? message.author.username;
        const liensConvertis = instaMatches.map(url => url.replace('instagram.com', 'kkinstagram.com'));

        const row = new ActionRowBuilder().addComponents(
            instaMatches.slice(0, 5).map((url, i) =>
                new ButtonBuilder()
                    .setLabel(instaMatches.length > 1 ? `🔗 Lien original ${i + 1}` : '🔗 Lien original')
                    .setStyle(ButtonStyle.Link)
                    .setURL(url)
            )
        );

        await message.delete().catch(() => {});
        await message.channel.send(`**${auteurNom}** a reposté cette publication Instagram !\n-# *(je change juste le lien pour que tout le monde y ait accès)*`);
        setTimeout(() => {
            message.channel.send({ content: liensConvertis.join('\n'), components: [row] }).catch(() => {});
        }, 300);
        return;
    }

    // Remplacement liens TikTok
    const tiktokRegex = /https?:\/\/(?:vm\.|vt\.|www\.|m\.)?tiktok\.com\/[^\s]+/gi;
    const tiktokMatches = message.content.match(tiktokRegex);
    if (tiktokMatches) {
        const auteurNom = message.member?.displayName ?? message.author.username;
        const convertUrl = (url) => url.replace(/(?:vm\.|vt\.|www\.|m\.)?tiktok\.com/i, (match) => {
            if (/^vm\./i.test(match)) return 'vm.kktiktok.com';
            if (/^vt\./i.test(match)) return 'vt.kktiktok.com';
            if (/^m\./i.test(match)) return 'm.kktiktok.com';
            if (/^www\./i.test(match)) return 'www.kktiktok.com';
            return 'kktiktok.com';
        });
        const liensConvertis = tiktokMatches.map(convertUrl);
        await message.delete().catch(() => {});
        await message.channel.send(`**${auteurNom}** a reposté ce TikTok !\n-# *(je change juste le lien pour que tout le monde y ait accès)*`);
        setTimeout(() => {
            message.channel.send(liensConvertis.join('\n')).catch(() => {});
        }, 300);
        return;
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

    // !wanted
    if (await handleWantedMessage(message, response, { topData, findMemberByName, askDisambiguation })) return;

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

    // !profil
    if (response?.needsProfil) {
        let cible = message.mentions.users.first();
        const auteurNom = message.member?.displayName ?? message.author.username;

        if (!cible) {
            const args = message.content.trim().split(/\s+/).slice(1).join(" ");
            if (args.length > 0) {
                const result = findMemberByName(message.guild, args);
                if (result.multiple) {
                    askDisambiguation(message, message.guild, result.candidates, (user) => { cible = user; message.client.emit('messageCreate', message); });
                    return;
                }
                if (result.found) cible = result.found.user;
            }
        }

        if (!cible) cible = message.author;

        const member = message.guild?.members.cache.get(cible.id);
        const joinedAt = member?.joinedAt
            ? member.joinedAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
            : 'Inconnue';
        const createdAt = cible.createdAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
        const roles = member?.roles.cache
            .filter(r => r.id !== message.guild.id)
            .sort((a, b) => b.position - a.position)
            .map(r => `<@&${r.id}>`)
            .slice(0, 5)
            .join(' ') || 'Aucun';

        const nbMessages = topData.messages[cible.id] ?? 0;

        const birthdayRaw = getGuildBirthdays(message.guild.id)[cible.id];
        const moisNoms = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
        let birthdayStr = 'Inconnu';
        if (birthdayRaw) {
            const [j, m] = birthdayRaw.split('/').map(Number);
            birthdayStr = `${j} ${moisNoms[m - 1]}`;
        }

        // Vérification rétroactive des succès roulette
        let userAchs = rouletteAchievements.get(cible.id);
        if (!userAchs) {
            userAchs = {};
            rouletteAchievements.set(cible.id, userAchs);
        }
        const rStats = rouletteStats.get(cible.id);
        const nbTirages = rStats?.tirages ?? 0;
        if (nbTirages >= 250 && !userAchs['veteran-250']) userAchs['veteran-250'] = Date.now();
        if (nbTirages >= 500 && !userAchs['centurion-500']) userAchs['centurion-500'] = Date.now();
        const nbBoucliersRes = rouletteBouclierActif.get(cible.id) || 0;
        if (nbBoucliersRes >= 10 && !userAchs['forteresse']) userAchs['forteresse'] = Date.now();

        // Calcul des Succès du serveur
        const badges = [];

        // 1. Badge Créatrice
        if (cible.id === EPSYS_ID) badges.push('• 👑 Créatrice du serveur et de Cacabot');

        // 2. Tirages Roulette
        if (nbTirages >= 500) badges.push('• 🎰 Gambling Addict (500+ tirages)');
        else if (nbTirages >= 100) badges.push('• 🎰 Habitué.e de la Roulette (100+ tirages)');

        // 3. Succès Roulette
        const nbAchs = Object.keys(userAchs).length;
        if (nbAchs >= 15) badges.push(`• 🏆 Trophy Hunter (${nbAchs}/30 succès)`);
        else if (nbAchs >= 5) badges.push(`• 🤠 Aventurier.e de la Roulette (${nbAchs}/30 succès)`);

        // 4. Victoires Motus
        const mStats = motusStats[cible.id];
        const nbVictoires = mStats?.victoires ?? 0;
        if (nbVictoires >= 10) badges.push(`• 🟩 Motus Master (${nbVictoires} victoires)`);
        else if (nbVictoires >= 3) badges.push(`• 🟨 Débutant.e du Motus (${nbVictoires} victoires)`);

        // 5. Médailles d'or du Rébus Regaïen (Top 1 de session)
        const rRebus = rebusStats[cible.id];
        const nbTop1 = rRebus?.victoires ?? 0;
        if (nbTop1 >= 10) badges.push(`• 🥇 Maître du Rébus (10 médailles d'or)`);
        else if (nbTop1 >= 5) badges.push(`• 🥇 Expert.e du Rébus (5 médailles d'or)`);
        else if (nbTop1 >= 3) badges.push(`• 🥇 As du Rébus (3 médailles d'or)`);

        // 6. Citations enregistrées
        const nbQuotes = quotesData.filter(q => q.authorId === cible.id).length;
        if (nbQuotes >= 5) badges.push(`• 📜 Légende (${nbQuotes} citations)`);

        // 6. Messages envoyés sur le serveur
        if (nbMessages >= 5000) badges.push('• 🗣️ Monument de Regaïa (5 000+ messages)');
        else if (nbMessages >= 1000) badges.push('• 💬 Membre Bavard.e (1 000+ messages)');
        else if (nbMessages >= 250) badges.push('• 🌱 Jeune membre (250+ messages)');

        const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle(member?.displayName ?? cible.username)
            .setThumbnail(cible.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                { name: '👤 Pseudo', value: `${cible.username}`, inline: true },
                { name: '💬 Messages envoyés', value: `${nbMessages.toLocaleString('fr-FR')}`, inline: true },
                { name: '\u200b', value: '\u200b', inline: true },
                { name: '📅 Arrivée sur le serveur', value: joinedAt, inline: true },
                { name: '🎂 Anniversaire', value: birthdayStr, inline: true },
                { name: '\u200b', value: '\u200b', inline: true },
                { name: '🏆 Succès du serveur', value: badges.length > 0 ? badges.join('\n') : '*Aucun succès débloqué pour l\'instant.*', inline: false },
                { name: '🏷️ Rôles', value: roles, inline: false }
            )
            .setFooter({ text: `ID : ${cible.id}` });

        return message.reply({ embeds: [embed] });
    }

    // !avatar
    if (response?.needsAvatar) {
        let cible = message.mentions.users.first();

        if (!cible) {
            const args = message.content.trim().split(/\s+/).slice(1).join(" ");
            if (args.length > 0) {
                const result = findMemberByName(message.guild, args);
                if (result.multiple) {
                    askDisambiguation(message, message.guild, result.candidates, (user) => { cible = user; message.client.emit('messageCreate', message); });
                    return;
                }
                if (result.found) cible = result.found.user;
            }
        }

        if (!cible) cible = message.author;

        const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setImage(cible.displayAvatarURL({ dynamic: true, size: 1024 }));

        return message.reply({ embeds: [embed] });
    }

    // !flip est pris en charge par handleSocialMessage

    // Commandes Anniversaire (!anniversaire, !anniversairetest)
    if (await handleAnniversaireMessage(message, response)) return;

    // !topchef et !blague sont pris en charge par handleSocialMessage

    // !actif
    if (response?.needsActif) {
        cleanOldData();
        const authorId = message.author.id;

        const buildActifEmbed = (periode) => {
            const medals = ['\ud83e\udd47', '\ud83e\udd48', '\ud83e\udd49'];
            let counts, titre;
            if (periode === 'jour') {
                counts = dailyData[getTodayKey()] ?? {};
                titre = "\ud83d\udcc5 Membres les plus actifs aujourd'hui";
            } else if (periode === 'semaine') {
                counts = weeklyData[getWeekKey()] ?? {};
                titre = '\ud83d\udcc6 Membres les plus actifs cette semaine';
            } else {
                counts = monthlyData[getMonthKey()] ?? {};
                titre = '\ud83d\udcc6 Membres les plus actifs ce mois-ci';
            }
            const sorted = Object.entries(counts).filter(([uid]) => uid !== '1503495713097519355').sort((a, b) => b[1] - a[1]).slice(0, 10);
            const fields = sorted.length > 0
                ? sorted.map(([uid, count], i) => {
                    const member = message.guild.members.cache.get(uid);
                    const name = member?.displayName ?? 'Membre inconnu';
                    const medal = medals[i] ?? `**${i + 1}.**`;
                    return { name: `${medal} ${name}`, value: `${count} messages`, inline: false };
                })
                : [{ name: 'Aucune donn\u00e9e', value: 'Pas encore de messages !', inline: false }];
            return new EmbedBuilder().setColor(0xffd700).setTitle(titre).addFields(fields);
        };

        const buildActifRow = (periode) => {
            const jourBtn = new ButtonBuilder()
                .setCustomId(`actif_jour_${authorId}`)
                .setLabel('\ud83d\udcc5 Jour')
                .setStyle(periode === 'jour' ? ButtonStyle.Primary : ButtonStyle.Secondary);
            const semaineBtn = new ButtonBuilder()
                .setCustomId(`actif_semaine_${authorId}`)
                .setLabel('\ud83d\uddd3\ufe0f Semaine')
                .setStyle(periode === 'semaine' ? ButtonStyle.Primary : ButtonStyle.Secondary);
            const moisBtn = new ButtonBuilder()
                .setCustomId(`actif_mois_${authorId}`)
                .setLabel('\ud83d\udcc6 Mois')
                .setStyle(periode === 'mois' ? ButtonStyle.Primary : ButtonStyle.Secondary);
            return new ActionRowBuilder().addComponents(jourBtn, semaineBtn, moisBtn);
        };

        return message.reply({ embeds: [buildActifEmbed('jour')], components: [buildActifRow('jour')] });
    }

    // !top
    if (response?.needsTop) {
        const allSorted = Object.entries(topData.messages)
            .sort((a, b) => b[1] - a[1]);

        if (allSorted.length === 0) return message.reply("Pas encore de données !");

        const PAGE_SIZE = 10;
        const totalPages = Math.ceil(allSorted.length / PAGE_SIZE);
        const authorId = message.author.id;

        const buildTopEmbed = (page) => {
            const start = page * PAGE_SIZE;
            const slice = allSorted.slice(start, start + PAGE_SIZE);
            const medals = ['🥇', '🥈', '🥉'];
            const fields = slice.map(([uid, count], i) => {
                const member = message.guild.members.cache.get(uid);
                const name = member ? member.displayName : null;
                if (!name) return null;
                const rank = start + i;
                const medal = rank < 3 ? medals[rank] : `**${rank + 1}.**`;
                return { name: `${medal} ${name}`, value: `${count} messages`, inline: false };
            }).filter(Boolean);

            const userRank = allSorted.findIndex(([uid]) => uid === authorId);
            const userCount = topData.messages[authorId] || 0;
            let infoPerso = '';

            if (userRank !== -1) {
                const position = userRank + 1;
                if (userRank >= 10 && allSorted[9]) {
                    const diff = (allSorted[9][1] - userCount) + 1;
                    infoPerso = `> 👤 **Ta position :** **#${position}** avec **${userCount} messages** *(à ${diff} message${diff > 1 ? 's' : ''} du Top 10 !)*\n\n`;
                } else {
                    infoPerso = `> 👤 **Ta position :** **#${position}** avec **${userCount} messages** *(Tu es dans le Top 10 ! 🔥)*\n\n`;
                }
            }

            return new EmbedBuilder()
                .setColor(0xffd700)
                .setTitle('🏆 Classement des membres')
                .setDescription(infoPerso)
                .addFields(fields)
                .setFooter({ text: `Page ${page + 1}/${totalPages} • Compté depuis l'initialisation du bot` });
        };

        const buildTopRow = (page) => {
            const prev = new ButtonBuilder()
                .setCustomId(`top_prev_${authorId}_${page}`)
                .setLabel('\u2b05\ufe0f Arrière')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === 0);
            const next = new ButtonBuilder()
                .setCustomId(`top_next_${authorId}_${page}`)
                .setLabel('Suivant \u27a1\ufe0f')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page >= totalPages - 1);
            return new ActionRowBuilder().addComponents(prev, next);
        };

        return message.reply({ embeds: [buildTopEmbed(0)], components: totalPages > 1 ? [buildTopRow(0)] : [] });
    }

    // !setmessages
    if (response?.needsSetMessages) {
        const args = message.content.trim().split(/\s+/);
        const count = parseInt(args[args.length - 1]);

        // Accepte soit un @mention soit un ID brut
        const cible = message.mentions.users.first();
        const targetId = cible ? cible.id : args[1];

        if (!targetId || isNaN(count)) {
            return message.reply("Usage : `!setmessages @Membre NombreDeMessages` ou `!setmessages ID NombreDeMessages`");
        }

        topData.messages[targetId] = count;
        saveAll();

        const member = message.guild?.members.cache.get(targetId);
        const nom = member?.displayName ?? targetId;
        return message.reply(`\u2705 **${nom}** : ${count} messages enregistr\u00e9s !`);
    }

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

    /// !prune

    if (response?.needsPrune) {
    const member = message.guild.members.cache.get(message.author.id);
    const canKick = member?.permissions.has('KickMembers');
    if (!canKick) return message.reply("Tu n'as pas les permissions nécessaires pour faire ça !");

    const args = message.content.trim().split(/\s+/);
    const count = parseInt(args[1]);

    if (!count || count <= 0) return message.reply("Usage : `!prune X` — supprime les X derniers messages.");

    if (count > 100) {
        const embed = new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle('⚠️ Limite dépassée')
            .setDescription(`Discord ne permet pas de supprimer plus de **100 messages** à la fois.\n\nTu veux supprimer **${count} messages** — il faudra donc **${Math.ceil(count / 100)} suppressions** successives.\n\n**Je gère** : Cacabot enchaîne les suppressions automatiquement.\n**Je gère moi-même** : Cacabot s'arrête là, tu refais \`!prune 100\` autant de fois que nécessaire.`);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`prune_auto_${message.author.id}_${count}_${message.channel.id}`)
                .setLabel('🤖 Laisser Cacabot gérer')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`prune_manual_${message.author.id}`)
                .setLabel('✋ Je gère')
                .setStyle(ButtonStyle.Secondary)
        );

        return message.reply({ embeds: [embed], components: [row] });
    }

    try {
        const messages = await message.channel.messages.fetch({ limit: count + 1 });
        const toDelete = messages.filter(m => {
            const age = Date.now() - m.createdTimestamp;
            return age < 14 * 24 * 60 * 60 * 1000;
        });
        await message.channel.bulkDelete(toDelete, true);
        await message.delete().catch(() => {});
    } catch (e) {
        return message.channel.send("Erreur lors de la suppression. Les messages de plus de 14 jours ne peuvent pas être supprimés en bulk.");
    }
    return;
}

    // !pomodoro
    if (response?.needsPomodoro) {
    const args = message.content.trim().split(/\s+/);

    if (args[1]?.toLowerCase() === 'stop') {
        if (!pomodoroSessions.has(message.channel.id)) {
            return message.reply("Aucun pomodoro en cours dans ce salon !");
        }
        const stopSession = pomodoroSessions.get(message.channel.id);
        clearTimeout(stopSession.timeout);
        clearInterval(stopSession.updateInterval);
        if (stopSession?.message) await stopSession.message.delete().catch(() => {});
        pomodoroSessions.delete(message.channel.id);
        return message.reply("🍅 Pomodoro arrêté !");
    }

    if (pomodoroSessions.has(message.channel.id)) {
        return message.reply("Un pomodoro est déjà en cours dans ce salon ! Utilise `!pomodoro stop` pour l'arrêter.");
    }

    const workMenu = new StringSelectMenuBuilder()
        .setCustomId(`pomo_setup_work_${message.author.id}_${message.channel.id}`)
        .setPlaceholder('Durée de travail...')
        .addOptions([5,10,15,20,25,30,35,40,45,50,55,60].map(n => ({
            label: `${n} minutes`, value: `${n}`
        })));

    const breakMenu = new StringSelectMenuBuilder()
        .setCustomId(`pomo_setup_break_${message.author.id}_${message.channel.id}`)
        .setPlaceholder('Durée de pause...')
        .addOptions([5,10,15,20,25,30].map(n => ({
            label: `${n} minutes`, value: `${n}`
        })));

        const reasonMenu = new StringSelectMenuBuilder()
        .setCustomId(`pomo_setup_reason_${message.author.id}_${message.channel.id}`)
        .setPlaceholder('Raison du pomodoro...')
        .addOptions([
            { label: 'Devoirs', value: 'Devoirs', emoji: '📚' },
            { label: 'Montage', value: 'Montage', emoji: '🎬' },
            { label: 'Composition', value: 'Composition', emoji: '🎵' },
            { label: 'Écriture', value: 'Écriture', emoji: '✍️' },
            { label: 'Code', value: 'Code', emoji: '💻' },
        ]);

    const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('🍅 Configurer le Pomodoro')
        .setDescription('Choisis la durée de travail et la durée de pause !')
        .addFields(
            { name: '⏱️ Travail', value: 'Non défini', inline: true },
            { name: '⏸️ Pause', value: 'Non défini', inline: true },
            { name: '🎯 Raison', value: 'Non défini', inline: true }
        );

    return message.reply({ embeds: [embed], components: [
        new ActionRowBuilder().addComponents(workMenu),
        new ActionRowBuilder().addComponents(breakMenu),
        new ActionRowBuilder().addComponents(reasonMenu)
    ]});
}

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

    // !say
    if (response?.needsSay) {
        if (message.author.id !== '436218312574107658') return;
        const args = message.content.trim().split(/\s+/);
        if (args.length < 3) return message.reply({ content: "Usage : `!say [ID_salon] [message]`", ephemeral: true });
        const channelId = args[1];
        const texte = args.slice(2).join(' ');
        try {
            const target = await client.channels.fetch(channelId);
            if (!target) return message.reply('Salon introuvable.');
            await target.send(texte);
            await message.delete().catch(() => {});
        } catch (e) {
            return message.reply('Erreur : salon introuvable ou permissions insuffisantes.');
        }
        return;
    }

    // !streamtest (Epsys-only)
    if (response?.needsStreamTest) {
        if (message.author.id !== '436218312574107658') return;
        try {
            const payload = await buildTwitchLivePayload();
            // Répond directement à ton message dans le salon actuel, sans ping le rôle pour garder le test secret
            await message.reply({
                ...payload,
                allowedMentions: { repliedUser: false, parse: [] }
            });
            return message.react('🟣').catch(() => {});
        } catch (err) {
            console.error('Erreur !streamtest :', err);
            return message.reply(`❌ Erreur lors du test : \`${err.message}\``);
        }
    }

    // !edit (Epsys-only)
    if (response?.needsEdit) {
        if (message.author.id !== '436218312574107658') return;
        const args = message.content.trim().split(/\s+/);
        if (args.length < 3) return message.reply({ content: "Usage : `!edit [ID_du_message] [nouveau texte]`", ephemeral: true });

        const msgId = args[1];
        const nouveauTexte = message.content.replace(/^!edit\s+\d+\s+/i, '').trim();

        try {
            // Cherche dans le salon actuel d'abord
            let targetMsg = await message.channel.messages.fetch(msgId).catch(() => null);

            // Si introuvable ici, cherche dans les autres salons textuels du serveur
            if (!targetMsg && message.guild) {
                for (const ch of message.guild.channels.cache.values()) {
                    if (ch.type === ChannelType.GuildText || ch.type === ChannelType.GuildAnnouncement) {
                        targetMsg = await ch.messages.fetch(msgId).catch(() => null);
                        if (targetMsg) break;
                    }
                }
            }

            if (!targetMsg) return message.reply("Message introuvable ! Vérifie l'ID.");
            if (targetMsg.author.id !== client.user.id) return message.reply("Je ne peux modifier que mes propres messages !");

            await targetMsg.edit({ content: nouveauTexte });
            await message.delete().catch(() => {});
        } catch (err) {
            console.error("Erreur !edit :", err);
            return message.reply("Impossible de modifier ce message.");
        }
        return;
    }

    // !embed (Epsys-only)
    if (await handleEmbedMessage(message, response, client)) return;

    // !rolereac (Epsys-only)
    if (response?.needsRoleReac) {
        if (message.author.id !== '436218312574107658') return;
        const args = message.content.trim().split(/\s+/);

        if (args[1]?.toLowerCase() === 'list') {
            const listMsg = Object.entries(reactionRolesData);
            if (listMsg.length === 0) return message.reply("Aucun rôle réaction n'est configuré.");
            const lignes = listMsg.map(([mId, data]) => {
                const rolesLignes = Object.entries(data.roles).map(([em, rId]) => `• ${em} ➔ <@&${rId}>`).join('\n');
                return `📍 Message: \`${mId}\` (dans <#${data.channelId}>) :\n${rolesLignes}`;
            });
            const embed = new EmbedBuilder().setColor(0x5865f2).setTitle('🎭 Rôles Réaction Actifs').setDescription(lignes.join('\n\n'));
            return message.reply({ embeds: [embed] });
        }

        if (args[1]?.toLowerCase() === 'remove') {
            const msgId = args[2];
            const emojiStr = args[3];
            if (!msgId || !emojiStr) return message.reply("Usage : `!rolereac remove [ID_message] [emoji]`");
            if (!reactionRolesData[msgId] || !reactionRolesData[msgId].roles[emojiStr]) {
                return message.reply("Ce rôle réaction n'existe pas sur ce message.");
            }
            delete reactionRolesData[msgId].roles[emojiStr];
            if (Object.keys(reactionRolesData[msgId].roles).length === 0) delete reactionRolesData[msgId];
            demanderSauvegarde();
            return message.reply(`🗑️ Rôle réaction supprimé pour l'emoji ${emojiStr} sur le message \`${msgId}\`.`);
        }

        if (args.length < 4) {
            return message.reply("Usage :\n• Ajouter : `!rolereac [ID_message] [emoji] [@rôle / ID_rôle]`\n• Retirer : `!rolereac remove [ID_message] [emoji]`\n• Liste : `!rolereac list`");
        }

        const msgId = args[1];
        const emojiStr = args[2];
        const roleArg = args[3];
        const roleId = roleArg.replace(/<@&|>/g, '');
        const role = message.guild?.roles.cache.get(roleId);
        if (!role) return message.reply("Rôle introuvable ! Vérifie la mention ou l'ID.");

        try {
            let targetMsg = await message.channel.messages.fetch(msgId).catch(() => null);
            let targetChannel = message.channel;

            if (!targetMsg && message.guild) {
                for (const ch of message.guild.channels.cache.values()) {
                    if (ch.isTextBased()) {
                        targetMsg = await ch.messages.fetch(msgId).catch(() => null);
                        if (targetMsg) { targetChannel = ch; break; }
                    }
                }
            }

            if (!targetMsg) return message.reply("Message introuvable sur le serveur ! Vérifie l'ID.");

            // Le bot réagit sous le message
            await targetMsg.react(emojiStr).catch(() => {});

            if (!reactionRolesData[msgId]) {
                reactionRolesData[msgId] = { channelId: targetChannel.id, roles: {} };
            }
            reactionRolesData[msgId].roles[emojiStr] = role.id;
            demanderSauvegarde();

            await message.delete().catch(() => {});
            const conf = await message.channel.send(`✅ Rôle réaction configuré : ${emojiStr} donnera le rôle **${role.name}** sur le message [clique ici](${targetMsg.url}) !`);
        } catch (err) {
            return message.reply(`❌ Erreur : ${err.message}`);
        }
        return;
    }

    // !rolebtn (Epsys-only)
    if (response?.needsRoleBtn) {
        if (message.author.id !== '436218312574107658') return;
        const args = message.content.trim().split(/\s+/);
        const sub = args[1]?.toLowerCase();

        if (sub !== 'add' && sub !== 'remove') {
            return message.reply(
                "**Usage :**\n" +
                "• **Ajouter un bouton :** `!rolebtn add [ID_message] [@rôle] [couleur optionnelle] [Texte avec ou sans emoji]`\n" +
                "• **Supprimer un bouton :** `!rolebtn remove [ID_message] [@rôle]`\n\n" +
                "*Couleurs disponibles : bleu, mauve, vert, rouge, rose, orange, gris, blanc, jaune...*"
            );
        }

        const msgId = args[2];
        const roleArg = args[3];
        if (!msgId || !roleArg) return message.reply("Paramètres manquants ! Vérifie l'ID du message et le rôle.");

        const roleId = roleArg.replace(/<@&|>/g, '');
        const role = message.guild?.roles.cache.get(roleId);
        if (!role) return message.reply("Rôle introuvable ! Vérifie la mention ou l'ID.");

        // Recherche du message envoyé par Cacabot
        let targetMsg = await message.channel.messages.fetch(msgId).catch(() => null);
        if (!targetMsg && message.guild) {
            for (const ch of message.guild.channels.cache.values()) {
                if (ch.isTextBased()) {
                    targetMsg = await ch.messages.fetch(msgId).catch(() => null);
                    if (targetMsg) break;
                }
            }
        }

        if (!targetMsg) return message.reply("Message introuvable ! Vérifie l'ID.");
        if (targetMsg.author.id !== client.user.id) {
            return message.reply("Je ne peux ajouter des boutons que sur mes **propres messages** (par exemple créés avec `/embed` ou `!say`) !");
        }

        // --- Cas de suppression ---
        if (sub === 'remove') {
            const rows = targetMsg.components.map(row => {
                const newRow = ActionRowBuilder.from(row);
                newRow.setComponents(row.components.filter(c => c.customId !== `rolebtn_${role.id}`));
                return newRow;
            }).filter(row => row.components.length > 0);

            await targetMsg.edit({ components: rows }).catch(err => message.reply(`Erreur : ${err.message}`));
            await message.delete().catch(() => {});
            return message.channel.send(`🗑️ Bouton de rôle pour **${role.name}** retiré du message !`);
        }

        // --- Cas d'ajout ---
        let resteArgs = args.slice(4);
        let style = ButtonStyle.Secondary; // Gris par défaut

        const couleurMap = {
            bleu: ButtonStyle.Primary, mauve: ButtonStyle.Primary, violet: ButtonStyle.Primary, primary: ButtonStyle.Primary,
            vert: ButtonStyle.Success, success: ButtonStyle.Success,
            rouge: ButtonStyle.Danger, rose: ButtonStyle.Danger, danger: ButtonStyle.Danger,
            gris: ButtonStyle.Secondary, blanc: ButtonStyle.Secondary, noir: ButtonStyle.Secondary, secondary: ButtonStyle.Secondary,
            jaune: ButtonStyle.Secondary, orange: ButtonStyle.Danger, marron: ButtonStyle.Secondary
        };

        const premierMot = resteArgs[0]?.toLowerCase();
        if (premierMot && couleurMap[premierMot]) {
            style = couleurMap[premierMot];
            resteArgs.shift(); // On retire le mot de couleur pour ne garder que le texte
        }

        let texteBrut = resteArgs.join(' ').trim();
        if (!texteBrut) texteBrut = role.name;

        // Détection automatique d'un emoji en début de texte (ex: "🎮 Gamer" -> emoji: 🎮, label: "Gamer")
        let emoji = null;
        let label = texteBrut;
        const emojiMatch = texteBrut.match(/^((?:<a?:\w+:\d+>|\p{Extended_Pictographic}\uFE0F?))\s*(.*)$/u);
        if (emojiMatch) {
            emoji = emojiMatch[1];
            label = emojiMatch[2].trim() || role.name;
        }

        const newBtn = new ButtonBuilder()
            .setCustomId(`rolebtn_${role.id}`)
            .setStyle(style);

        if (label) newBtn.setLabel(label);
        if (emoji) newBtn.setEmoji(emoji);

        // Reconstruction des lignes de boutons (max 5 par ligne, max 25 au total)
        const rows = targetMsg.components.map(r => ActionRowBuilder.from(r));
        let placeTrouvee = false;

        // Vérifie si le bouton existe déjà pour le mettre à jour
        for (const row of rows) {
            const index = row.components.findIndex(c => c.data.custom_id === `rolebtn_${role.id}`);
            if (index !== -1) {
                row.components[index] = newBtn;
                placeTrouvee = true;
                break;
            }
        }

        // Sinon l'ajouter à la dernière ligne ou en créer une nouvelle
        if (!placeTrouvee) {
            let derniereLigne = rows[rows.length - 1];
            if (derniereLigne && derniereLigne.components.length < 5) {
                derniereLigne.addComponents(newBtn);
            } else if (rows.length < 5) {
                rows.push(new ActionRowBuilder().addComponents(newBtn));
            } else {
                return message.reply("Limite atteinte : ce message a déjà le maximum de 25 boutons !");
            }
        }

        await targetMsg.edit({ components: rows }).catch(err => message.reply(`Erreur : ${err.message}`));
        await message.delete().catch(() => {});
        return message.channel.send(`✅ Bouton de rôle pour **${role.name}** ajouté avec succès sur le message !`);
    }

    // !rappel
    if (response?.needsRappel) {
        const args = message.content.trim().split(/\s+/);
        const isEpsys = message.author.id === '436218312574107658';

        const sub = args[1]?.toLowerCase();

        if (sub === 'list') {
            const mine = [...pendingRappels.entries()].filter(([, r]) => r.targetId === message.author.id);
            if (mine.length === 0) return message.reply("Tu n'as aucun rappel en attente !");

            const fields = mine
                .sort((a, b) => a[1].triggerAt - b[1].triggerAt)
                .map(([id, r]) => {
                    const remainingMs = r.triggerAt - Date.now();
                    const mins = Math.max(0, Math.floor(remainingMs / 60000));
                    const secs = Math.max(0, Math.floor((remainingMs % 60000) / 1000));
                    const dansStr = mins > 0 ? `dans ${mins}min ${secs}s` : `dans ${secs}s`;
                    return { name: r.texte, value: dansStr, inline: false };
                });

            const embed = new EmbedBuilder()
                .setColor(0x5865f2)
                .setTitle('⏰ Tes rappels en attente')
                .addFields(fields);
            return message.reply({ embeds: [embed] });
        }

        if (sub === 'remove') {
            const query = args.slice(2).join(' ').toLowerCase();
            if (!query) return message.reply('Usage : `!rappel remove [nom du rappel]`');

            const mine = [...pendingRappels.entries()].filter(([, r]) => r.targetId === message.author.id);
            const match = mine.find(([, r]) => r.texte.toLowerCase() === query)
                ?? mine.find(([, r]) => r.texte.toLowerCase().includes(query));

            if (!match) return message.reply("Aucun rappel correspondant trouvé !");

            const [id, r] = match;
            clearTimeout(r.timeout);
            pendingRappels.delete(id);
            return message.reply(`🗑️ Rappel supprimé : **${r.texte}**`);
        }

        // Détecter si c'est !rappel [ID] Xmin/h [message] (Epsys only)
        const looksLikeId = args[1] && /^\d{17,19}$/.test(args[1]);

        if (looksLikeId && !isEpsys) {
            return message.reply("Tu n'es pas autoris\u00e9(e) \u00e0 utiliser cette variante de la commande.");
        }

        let targetId, timeStr, texte;

        if (looksLikeId && isEpsys) {
            // !rappel [ID] Xmin [message]
            if (args.length < 4) return message.reply('Usage : `!rappel [ID] Xmin/h [message]`');
            targetId = args[1];
            timeStr = args[2].toLowerCase();
            texte = args.slice(3).join(' ');
        } else {
            // !rappel Xmin [message]
            if (args.length < 3) return message.reply('Usage : `!rappel Xmin message` ou `!rappel Xh message`');
            targetId = message.author.id;
            timeStr = args[1].toLowerCase();
            texte = args.slice(2).join(' ');
        }

        let ms = 0;
        if (timeStr.endsWith('min')) ms = parseInt(timeStr) * 60 * 1000;
        else if (timeStr.endsWith('h')) ms = parseInt(timeStr) * 60 * 60 * 1000;
        else if (timeStr.endsWith('s')) ms = parseInt(timeStr) * 1000;
        else return message.reply('Format invalide ! Utilise `Xmin`, `Xh` ou `Xs`. Ex: `!rappel 10min acheter du pain`');
        if (isNaN(ms) || ms <= 0) return message.reply('Dur\u00e9e invalide !');
        if (ms > 24 * 60 * 60 * 1000) return message.reply('Maximum 24h !');

        await message.reply(`\u23f0 Rappel enregistr\u00e9 ! Je ping <@${targetId}> dans **${timeStr}**.`);
        scheduleRappel(message.channel.id, targetId, texte, ms);
        return;
    }

    // !ping
    if (response?.needsPing) {
        const sent = await message.reply('\ud83c\udfd3 Pong !');
        const latence = sent.createdTimestamp - message.createdTimestamp;
        const wsLatence = client.ws.ping;
        const embed = new EmbedBuilder()
            .setColor(latence < 100 ? 0x2ecc71 : latence < 250 ? 0xf39c12 : 0xe74c3c)
            .setTitle('\ud83c\udfd3 Pong !')
            .addFields(
                { name: '\ud83d\udce8 Latence', value: `${latence}ms`, inline: true },
                { name: '\ud83d\udd0c WebSocket', value: `${wsLatence}ms`, inline: true }
            );
        return sent.edit({ content: null, embeds: [embed] });
    }

    // !météo
    if (response?.needsMeteo) {
        const args = message.content.trim().split(/\s+/);
        const ville = args.slice(1).join(' ');
        if (!ville) return message.reply('Usage : `!météo [ville]`\nEx : `!météo Paris`');

        try {
            const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(ville)}&count=1&language=fr&format=json`);
            const geoData = await geoRes.json();

            if (!geoData.results || geoData.results.length === 0) {
                return message.reply(`Ville introuvable : **${ville}**`);
            }

            const { latitude, longitude, name, country } = geoData.results[0];

            const meteoRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`);
            const meteoData = await meteoRes.json();
            const current = meteoData.current;

            const weatherDesc = {
                0: '☀️ Ciel dégagé', 1: '🌤️ Plutôt dégagé', 2: '⛅ Partiellement nuageux', 3: '☁️ Couvert',
                45: '🌫️ Brouillard', 48: '🌫️ Brouillard givrant',
                51: '🌦️ Bruine légère', 53: '🌦️ Bruine', 55: '🌦️ Bruine forte',
                61: '🌧️ Pluie légère', 63: '🌧️ Pluie', 65: '🌧️ Pluie forte',
                71: '🌨️ Neige légère', 73: '🌨️ Neige', 75: '🌨️ Neige forte',
                80: '🌦️ Averses', 81: '🌦️ Averses fortes', 82: '⛈️ Averses violentes',
                95: '⛈️ Orage', 96: '⛈️ Orage avec grêle', 99: '⛈️ Orage violent avec grêle'
            };
            const description = weatherDesc[current.weather_code] || 'Conditions inconnues';

            // Heure locale sur place (format HHhMM)
            const localTime = current.time.split('T')[1]; // "18:59"
            const [heureLocale, minLocale] = localTime.split(':');
            const heureFormatee = `${heureLocale}h${minLocale}`;

            const embed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle(`🌍 Météo à ${name}${country ? ', ' + country : ''}`)
                .setDescription(description)
                .addFields(
                    { name: '🌡️ Température', value: `${current.temperature_2m}°C (ressenti ${current.apparent_temperature}°C)`, inline: true },
                    { name: '💧 Humidité', value: `${current.relative_humidity_2m}%`, inline: true },
                    { name: '💨 Vent', value: `${current.wind_speed_10m} km/h`, inline: true },
                    { name: '🕒 Heure locale', value: heureFormatee, inline: true }
                )
                .setFooter({ text: 'Données via Open-Meteo' })
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        } catch (e) {
            console.error('Erreur !meteo :', e);
            return message.reply("Erreur lors de la récupération de la météo. Réessaie plus tard.");
        }
    }

    // !info
    if (response?.needsInfo) {
        const startDate = new Date('2026-05-14T00:00:00');
        const now = new Date();
        const diff = now - startDate;

        const totalSeconds = Math.floor(diff / 1000);
        const totalMinutes = Math.floor(totalSeconds / 60);
        const totalHours = Math.floor(totalMinutes / 60);
        const totalDays = Math.floor(totalHours / 24);

        const months = Math.floor(totalDays / 30);
        const days = totalDays % 30;
        const hours = totalHours % 24;

        let uptime = '';
        if (months > 0) uptime += `${months} mois, `;
        if (months > 0 || days > 0) uptime += `${days} jour${days > 1 ? 's' : ''}, `;
        uptime += `${hours} heure${hours > 1 ? 's' : ''}`;

        const nbMembres = Object.keys(topData.messages).length;
        const nbCommandes = 30;

        const commitCount = await getCommitCount();
        const versionStr = commitCount ? `Version 1.${commitCount}` : 'Version inconnue';

        const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle('\ud83e\udd16 Infos de Cacabot')
            .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                { name: '\ud83d\udcbb Commandes', value: `${nbCommandes}`, inline: true },
                { name: '\ud83d\udcac Messages envoy\u00e9s', value: `${topData.messages['1503495713097519355']}`, inline: true },
                { name: '\u200b', value: '\u200b', inline: true },
                { name: '\ud83d\udc51 Cr\u00e9atrice', value: 'Epsys', inline: true },
                { name: '\ud83e\udd1d Collaboratrice', value: '[BDN](https://bdn-fr.xyz/)', inline: true },
                { name: '\u200b', value: '\u200b', inline: true },
                { name: '\ud83d\udcdf Version', value: versionStr, inline: true },
                { name: '\ud83d\udd52 En ligne depuis', value: uptime, inline: true },
                { name: '\u200b', value: '\u200b', inline: true }
            );

        return message.reply({ embeds: [embed] });
    }

    // !serveur
    if (response?.needsServeur) {
        const guild = message.guild;
        if (!guild) return;

        await guild.fetch();
        const owner = await guild.fetchOwner();

        const createdAt = guild.createdAt.toLocaleDateString('fr-FR', {
            day: 'numeric', month: 'long', year: 'numeric'
        });

        const embed = new EmbedBuilder()
            .setColor(0x00ebff)
            .setTitle(guild.name)
            .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
            .setDescription(guild.description || '*Aucune description*')
            .addFields(
                { name: '\ud83d\udc51 Propri\u00e9taire', value: owner.user.tag, inline: true },
                { name: '\ud83d\udcc5 Cr\u00e9ation', value: createdAt, inline: true },
                { name: '\u200b', value: '\u200b', inline: true },
                { name: '\ud83d\udc65 Membres', value: `${guild.memberCount}`, inline: true },
                { name: '\ud83d\udcac Salons', value: `${guild.channels.cache.size}`, inline: true },
                { name: '\ud83c\udff7\ufe0f R\u00f4les', value: `${guild.roles.cache.size}`, inline: true },
                { name: '\ud83d\ude80 Niveau de boost', value: `Niveau ${guild.premiumTier}`, inline: true },
                { name: '\ud83d\udcab Boosts', value: `${guild.premiumSubscriptionCount}`, inline: true },
                { name: '\ud83c\udd94 ID', value: guild.id, inline: true }
            )
            .addFields(
                { name: '\u200b', value: '[\ud83d\udd17 Lien d\'invitation du serveur](https://discord.com/invite/maAbUYb)', inline: false }
            );

        return message.reply({ embeds: [embed] });
    }

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

        // Commande Prune
        if (commandName === 'prune') {
            if (!interaction.member.permissions.has('KickMembers')) {
                return interaction.reply({ content: "Tu n'as pas les permissions nécessaires !", ephemeral: true });
            }
            const count = interaction.options.getInteger('nombre');
            if (count > 100) {
                const embed = new EmbedBuilder()
                    .setColor(0xe74c3c)
                    .setTitle('⚠️ Limite dépassée')
                    .setDescription(`Discord ne permet pas de supprimer plus de **100 messages** à la fois.\n\nChoisis l'option ci-dessous :`);

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`prune_auto_${interaction.user.id}_${count}_${interaction.channel.id}`).setLabel('🤖 Laisser Cacabot gérer').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId(`prune_manual_${interaction.user.id}`).setLabel('✋ Annuler').setStyle(ButtonStyle.Secondary)
                );
                return interaction.reply({ embeds: [embed], components: [row] });
            }
            try {
                const messages = await interaction.channel.messages.fetch({ limit: count });
                const toDelete = messages.filter(m => (Date.now() - m.createdTimestamp) < 14 * 24 * 60 * 60 * 1000);
                await interaction.channel.bulkDelete(toDelete, true);
                return interaction.reply({ content: `🗑️ **${toDelete.size}** messages supprimés !`, ephemeral: true });
            } catch (e) {
                return interaction.reply({ content: "Erreur lors de la suppression.", ephemeral: true });
            }
        }

        // Commande Rlttop
        if (await handleRouletteSlash(interaction, client)) return;

        if (commandName === 'help') {
            return await handleHelpInteraction(interaction);
        }

        if (commandName === 'profil') {
            const cibleUser = interaction.options.getUser('membre') ?? interaction.user;
            const member = interaction.guild?.members.cache.get(cibleUser.id);
            const joinedAt = member?.joinedAt
                ? member.joinedAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
                : 'Inconnue';
            const createdAt = cibleUser.createdAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
            const roles = member?.roles.cache
                .filter(r => r.id !== interaction.guild.id)
                .sort((a, b) => b.position - a.position)
                .map(r => `<@&${r.id}>`)
                .slice(0, 5)
                .join(' ') || 'Aucun';

            const nbMessages = topData.messages[cibleUser.id] ?? 0;
            const birthdayRaw = getGuildBirthdays(interaction.guild.id)[cibleUser.id];
            const moisNoms = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
            let birthdayStr = 'Inconnu';
            if (birthdayRaw) {
                const [j, m] = birthdayRaw.split('/').map(Number);
                birthdayStr = `${j} ${moisNoms[m - 1]}`;
            }

            // Calcul des Succès du serveur
            let userAchs = rouletteAchievements.get(cibleUser.id) ?? {};
            const rStats = rouletteStats.get(cibleUser.id);
            const nbTirages = rStats?.tirages ?? 0;

            const badges = [];
            if (cibleUser.id === EPSYS_ID) badges.push('• 👑 Créatrice du serveur et de Cacabot');
            if (nbTirages >= 500) badges.push('• 🎰 Gambling Addict (500+ tirages)');
            else if (nbTirages >= 100) badges.push('• 🎰 Habitué.e de la Roulette (100+ tirages)');

            const nbAchs = Object.keys(userAchs).length;
            if (nbAchs >= 15) badges.push(`• 🏆 Trophy Hunter (${nbAchs}/30 succès)`);
            else if (nbAchs >= 5) badges.push(`• 🤠 Aventurier.e de la Roulette (${nbAchs}/30 succès)`);

            const mStats = motusStats[cibleUser.id];
            const nbVictoires = mStats?.victoires ?? 0;
            if (nbVictoires >= 10) badges.push(`• 🟩 Motus Master (${nbVictoires} victoires)`);
            else if (nbVictoires >= 3) badges.push(`• 🟨 Débutant.e du Motus (${nbVictoires} victoires)`);

            const rRebus = rebusStats[cibleUser.id];
            const nbTop1 = rRebus?.victoires ?? 0;
            if (nbTop1 >= 10) badges.push(`• 🥇 Maître du Rébus (10 médailles d'or)`);
            else if (nbTop1 >= 5) badges.push(`• 🥇 Expert.e du Rébus (5 médailles d'or)`);
            else if (nbTop1 >= 3) badges.push(`• 🥇 As du Rébus (3 médailles d'or)`);

            const nbQuotes = quotesData.filter(q => q.authorId === cibleUser.id).length;
            if (nbQuotes >= 5) badges.push(`• 📜 Légende (${nbQuotes} citations)`);

            if (nbMessages >= 5000) badges.push('• 🗣️ Monument de Regaïa (5 000+ messages)');
            else if (nbMessages >= 1000) badges.push('• 💬 Membre Bavard.e (1 000+ messages)');
            else if (nbMessages >= 250) badges.push('• 🌱 Jeune membre (250+ messages)');

            const embed = new EmbedBuilder()
                .setColor(0x5865f2)
                .setTitle(member?.displayName ?? cibleUser.username)
                .setThumbnail(cibleUser.displayAvatarURL({ dynamic: true, size: 256 }))
                .addFields(
                    { name: '👤 Pseudo', value: `@${cibleUser.username}`, inline: true },
                    { name: '💬 Messages envoyés', value: `${nbMessages.toLocaleString('fr-FR')}`, inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                    { name: '📅 Arrivée sur le serveur', value: joinedAt, inline: true },
                    { name: '🎂 Anniversaire', value: birthdayStr, inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                    { name: '🏆 Succès du serveur', value: badges.length > 0 ? badges.join('\n') : '*Aucun succès débloqué pour l\'instant.*', inline: false },
                    { name: '🏷️ Rôles', value: roles, inline: false }
                )
                .setFooter({ text: `ID : ${cibleUser.id}` });

            return interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'top') {
            const allSorted = Object.entries(topData.messages).sort((a, b) => b[1] - a[1]);
            if (allSorted.length === 0) return interaction.reply({ content: "Pas encore de données !", ephemeral: true });

            const PAGE_SIZE = 10;
            const totalPages = Math.ceil(allSorted.length / PAGE_SIZE);
            const medals = ['🥇', '🥈', '🥉'];
            const fields = allSorted.slice(0, PAGE_SIZE).map(([uid, count], i) => {
                const member = interaction.guild?.members.cache.get(uid);
                if (!member) return null;
                const medal = i < 3 ? medals[i] : `**${i + 1}.**`;
                return { name: `${medal} ${member.displayName}`, value: `${count} messages`, inline: false };
            }).filter(Boolean);

            const embed = new EmbedBuilder()
                .setColor(0xffd700)
                .setTitle('🏆 Classement des membres')
                .addFields(fields)
                .setFooter({ text: `Page 1/${totalPages}` });

            const prev = new ButtonBuilder().setCustomId(`top_prev_${interaction.user.id}_0`).setLabel('⬅️ Arrière').setStyle(ButtonStyle.Secondary).setDisabled(true);
            const next = new ButtonBuilder().setCustomId(`top_next_${interaction.user.id}_0`).setLabel('Suivant ➡️').setStyle(ButtonStyle.Secondary).setDisabled(totalPages <= 1);
            const row = new ActionRowBuilder().addComponents(prev, next);

            return interaction.reply({ embeds: [embed], components: totalPages > 1 ? [row] : [] });
        }

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

        if (commandName === 'wanted') {
            return await handleWantedSlash(interaction, topData);
        }

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

        // =========================
        // LOT 4 : STATS, UTILITAIRES & YOUTUBE
        // =========================

        if (commandName === 'actif') {
            cleanOldData();
            const authorId = interaction.user.id;
            const medals = ['🥇', '🥈', '🥉'];
            const counts = dailyData[getTodayKey()] ?? {};
            const sorted = Object.entries(counts).filter(([uid]) => uid !== '1503495713097519355').sort((a, b) => b[1] - a[1]).slice(0, 10);
            const fields = sorted.length > 0
                ? sorted.map(([uid, count], i) => {
                    const member = interaction.guild?.members.cache.get(uid);
                    const name = member?.displayName ?? 'Membre inconnu';
                    const medal = medals[i] ?? `**${i + 1}.**`;
                    return { name: `${medal} ${name}`, value: `${count} messages`, inline: false };
                })
                : [{ name: 'Aucune donnée', value: 'Pas encore de messages aujourd\'hui !', inline: false }];

            const embed = new EmbedBuilder().setColor(0xffd700).setTitle("📅 Membres les plus actifs aujourd'hui").addFields(fields);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`actif_jour_${authorId}`).setLabel('📅 Jour').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`actif_semaine_${authorId}`).setLabel('🗓️ Semaine').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`actif_mois_${authorId}`).setLabel('📆 Mois').setStyle(ButtonStyle.Secondary)
            );
            return interaction.reply({ embeds: [embed], components: [row] });
        }

        if (commandName === 'avatar') {
            const cible = interaction.options.getUser('membre') ?? interaction.user;
            const embed = new EmbedBuilder()
                .setColor(0x5865f2)
                .setTitle(`Avatar de ${cible.username}`)
                .setImage(cible.displayAvatarURL({ dynamic: true, size: 1024 }));
            return interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'serveur') {
            const guild = interaction.guild;
            if (!guild) return interaction.reply({ content: "Cette commande ne peut être utilisée que sur un serveur.", ephemeral: true });
            await guild.fetch();
            const owner = await guild.fetchOwner();
            const createdAt = guild.createdAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

            const embed = new EmbedBuilder()
                .setColor(0x00ebff)
                .setTitle(guild.name)
                .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
                .setDescription(guild.description || '*Aucune description*')
                .addFields(
                    { name: '👑 Propriétaire', value: owner.user.tag, inline: true },
                    { name: '📅 Création', value: createdAt, inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                    { name: '👥 Membres', value: `${guild.memberCount}`, inline: true },
                    { name: '💬 Salons', value: `${guild.channels.cache.size}`, inline: true },
                    { name: '🏷️ Rôles', value: `${guild.roles.cache.size}`, inline: true },
                    { name: '🚀 Niveau de boost', value: `Niveau ${guild.premiumTier}`, inline: true },
                    { name: '💫 Boosts', value: `${guild.premiumSubscriptionCount}`, inline: true },
                    { name: '🆔 ID', value: guild.id, inline: true }
                )
                .addFields(
                    { name: '\u200b', value: '[🔗 Lien d\'invitation du serveur](https://discord.com/invite/maAbUYb)', inline: false }
                );
            return interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'meteo') {
            const ville = interaction.options.getString('ville');
            await interaction.deferReply();
            try {
                const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(ville)}&count=1&language=fr&format=json`);
                const geoData = await geoRes.json();
                if (!geoData.results || geoData.results.length === 0) {
                    return interaction.editReply(`Ville introuvable : **${ville}**`);
                }
                const { latitude, longitude, name, country } = geoData.results[0];
                const meteoRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`);
                const meteoData = await meteoRes.json();
                const current = meteoData.current;
                const weatherDesc = {
                    0: '☀️ Ciel dégagé', 1: '🌤️ Plutôt dégagé', 2: '⛅ Partiellement nuageux', 3: '☁️ Couvert',
                    45: '🌫️ Brouillard', 48: '🌫️ Brouillard givrant',
                    51: '🌦️ Bruine légère', 53: '🌦️ Bruine', 55: '🌦️ Bruine forte',
                    61: '🌧️ Pluie légère', 63: '🌧️ Pluie', 65: '🌧️ Pluie forte',
                    71: '🌨️ Neige légère', 73: '🌨️ Neige', 75: '🌨️ Neige forte',
                    80: '🌦️ Averses', 81: '🌦️ Averses fortes', 82: '⛈️ Averses violentes',
                    95: '⛈️ Orage', 96: '⛈️ Orage avec grêle', 99: '⛈️ Orage violent avec grêle'
                };
                const description = weatherDesc[current.weather_code] || 'Conditions inconnues';
                const localTime = current.time.split('T')[1];
                const [heureLocale, minLocale] = localTime.split(':');
                const heureFormatee = `${heureLocale}h${minLocale}`;

                const embed = new EmbedBuilder()
                    .setColor(0x3498db)
                    .setTitle(`🌍 Météo à ${name}${country ? ', ' + country : ''}`)
                    .setDescription(description)
                    .addFields(
                        { name: '🌡️ Température', value: `${current.temperature_2m}°C (ressenti ${current.apparent_temperature}°C)`, inline: true },
                        { name: '💧 Humidité', value: `${current.relative_humidity_2m}%`, inline: true },
                        { name: '💨 Vent', value: `${current.wind_speed_10m} km/h`, inline: true },
                        { name: '🕒 Heure locale', value: heureFormatee, inline: true }
                    )
                    .setFooter({ text: 'Données via Open-Meteo' })
                    .setTimestamp();
                return interaction.editReply({ embeds: [embed] });
            } catch (e) {
                return interaction.editReply("Erreur lors de la récupération de la météo.");
            }
        }

        if (commandName === 'pomodoro') {
            const sub = interaction.options.getSubcommand();
            if (sub === 'stop') {
                if (!pomodoroSessions.has(interaction.channel.id)) {
                    return interaction.reply({ content: "Aucun pomodoro en cours dans ce salon !", ephemeral: true });
                }
                const stopSession = pomodoroSessions.get(interaction.channel.id);
                clearTimeout(stopSession.timeout);
                clearInterval(stopSession.updateInterval);
                if (stopSession?.message) await stopSession.message.delete().catch(() => {});
                pomodoroSessions.delete(interaction.channel.id);
                return interaction.reply("⏹️ Pomodoro arrêté !");
            }
            if (sub === 'lancer') {
                if (pomodoroSessions.has(interaction.channel.id)) {
                    return interaction.reply({ content: "Un pomodoro est déjà en cours dans ce salon ! Utilise `/pomodoro stop` pour l'arrêter.", ephemeral: true });
                }
                const workMenu = new StringSelectMenuBuilder()
                    .setCustomId(`pomo_setup_work_${interaction.user.id}_${interaction.channel.id}`)
                    .setPlaceholder('Durée de travail...')
                    .addOptions([5,10,15,20,25,30,35,40,45,50,55,60].map(n => ({ label: `${n} minutes`, value: `${n}` })));

                const breakMenu = new StringSelectMenuBuilder()
                    .setCustomId(`pomo_setup_break_${interaction.user.id}_${interaction.channel.id}`)
                    .setPlaceholder('Durée de pause...')
                    .addOptions([5,10,15,20,25,30].map(n => ({ label: `${n} minutes`, value: `${n}` })));

                const reasonMenu = new StringSelectMenuBuilder()
                    .setCustomId(`pomo_setup_reason_${interaction.user.id}_${interaction.channel.id}`)
                    .setPlaceholder('Raison du pomodoro...')
                    .addOptions([
                        { label: 'Devoirs', value: 'Devoirs', emoji: '📚' },
                        { label: 'Montage', value: 'Montage', emoji: '🎬' },
                        { label: 'Composition', value: 'Composition', emoji: '🎵' },
                        { label: 'Écriture', value: 'Écriture', emoji: '✍️' },
                        { label: 'Code', value: 'Code', emoji: '💻' },
                    ]);

                const embed = new EmbedBuilder()
                    .setColor(0xe74c3c)
                    .setTitle('🍅 Configurer le Pomodoro')
                    .setDescription('Choisis la durée de travail et la durée de pause !')
                    .addFields(
                        { name: '⏱️ Travail', value: 'Non défini', inline: true },
                        { name: '⏸️ Pause', value: 'Non défini', inline: true },
                        { name: '🎯 Raison', value: 'Non défini', inline: true }
                    );

                return interaction.reply({ embeds: [embed], components: [
                    new ActionRowBuilder().addComponents(workMenu),
                    new ActionRowBuilder().addComponents(breakMenu),
                    new ActionRowBuilder().addComponents(reasonMenu)
                ]});
            }
        }

        if (commandName === 'rappel') {
            const sub = interaction.options.getSubcommand();
            if (sub === 'list') {
                const mine = [...pendingRappels.entries()].filter(([, r]) => r.targetId === interaction.user.id);
                if (mine.length === 0) return interaction.reply({ content: "Tu n'as aucun rappel en attente !", ephemeral: true });
                const fields = mine.sort((a, b) => a[1].triggerAt - b[1].triggerAt).map(([, r]) => {
                    const remainingMs = r.triggerAt - Date.now();
                    const mins = Math.max(0, Math.floor(remainingMs / 60000));
                    const secs = Math.max(0, Math.floor((remainingMs % 60000) / 1000));
                    const dansStr = mins > 0 ? `dans ${mins}min ${secs}s` : `dans ${secs}s`;
                    return { name: r.texte, value: dansStr, inline: false };
                });
                const embed = new EmbedBuilder().setColor(0x5865f2).setTitle('⏰ Tes rappels en attente').addFields(fields);
                return interaction.reply({ embeds: [embed] });
            }
            if (sub === 'remove') {
                const query = interaction.options.getString('nom').toLowerCase();
                const mine = [...pendingRappels.entries()].filter(([, r]) => r.targetId === interaction.user.id);
                const match = mine.find(([, r]) => r.texte.toLowerCase() === query) ?? mine.find(([, r]) => r.texte.toLowerCase().includes(query));
                if (!match) return interaction.reply({ content: "Aucun rappel correspondant trouvé !", ephemeral: true });
                const [id, r] = match;
                clearTimeout(r.timeout);
                pendingRappels.delete(id);
                return interaction.reply(`🗑️ Rappel supprimé : **${r.texte}**`);
            }
            if (sub === 'ajouter') {
                const timeStr = interaction.options.getString('temps').toLowerCase();
                const texte = interaction.options.getString('message');
                let ms = 0;
                if (timeStr.endsWith('min')) ms = parseInt(timeStr) * 60 * 1000;
                else if (timeStr.endsWith('h')) ms = parseInt(timeStr) * 60 * 60 * 1000;
                else if (timeStr.endsWith('s')) ms = parseInt(timeStr) * 1000;
                else return interaction.reply({ content: "Format invalide ! Utilise `Xmin`, `Xh` ou `Xs` (ex : `15min`).", ephemeral: true });
                if (isNaN(ms) || ms <= 0 || ms > 24 * 60 * 60 * 1000) return interaction.reply({ content: "Durée invalide (maximum 24h) !", ephemeral: true });

                scheduleRappel(interaction.channel.id, interaction.user.id, texte, ms);
                return interaction.reply(`⏰ Rappel enregistré ! Je te ping dans **${timeStr}** pour : **${texte}**.`);
            }
        }

        if (commandName === 'aternos') {
            return interaction.reply("L'IP actuelle du serveur Minecraft de Regaïa est : **papierprout.aternos.me**");
        }

        if (await handleYoutubeSlash(interaction)) return;

        if (commandName === 'ping') {
            await interaction.deferReply();
            const replyMsg = await interaction.fetchReply();
            const latence = replyMsg.createdTimestamp - interaction.createdTimestamp;
            const wsLatence = client.ws.ping;
            const embed = new EmbedBuilder()
                .setColor(latence < 100 ? 0x2ecc71 : latence < 250 ? 0xf39c12 : 0xe74c3c)
                .setTitle('🏓 Pong !')
                .addFields(
                    { name: '📨 Latence', value: `${latence}ms`, inline: true },
                    { name: '🔌 WebSocket', value: `${wsLatence}ms`, inline: true }
                );
            return interaction.editReply({ embeds: [embed] });
        }

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

    // Actions de modération sur les comptes récents
    if (interaction.isButton() && interaction.customId.startsWith('mod_action_')) {
        if (!estModo(interaction.member) && !interaction.member.permissions.has('KickMembers')) {
            return interaction.reply({ content: "Tu n'as pas la permission d'effectuer cette action.", ephemeral: true });
        }

        const parts = interaction.customId.split('_');
        const action = parts[2]; // kick, ban ou dismiss
        const targetId = parts[3];

        if (action === 'dismiss') {
            await interaction.message.edit({ components: [] }).catch(() => {});
            return interaction.reply(`✅ Alerte classée sans suite pour <@${targetId}> par <@${interaction.user.id}>.`);
        }

        if (action === 'kick') {
            const cible = await interaction.guild.members.fetch(targetId).catch(() => null);
            if (!cible) {
                return interaction.reply({ content: "Ce membre a déjà quitté le serveur.", ephemeral: true });
            }
            await cible.kick(`Expulsé par ${interaction.user.tag} (compte récent suspect)`)
                .then(async () => {
                    await interaction.message.edit({ components: [] }).catch(() => {});
                    interaction.reply(`👢 <@${targetId}> a été expulsé.e du serveur par <@${interaction.user.id}>.`);
                })
                .catch(() => interaction.reply({ content: "Impossible d'expulser ce membre (permissions insuffisantes).", ephemeral: true }));
            return;
        }

        if (action === 'ban') {
            await interaction.guild.members.ban(targetId, { reason: `Banni par ${interaction.user.tag} (compte récent suspect)` })
                .then(async () => {
                    await interaction.message.edit({ components: [] }).catch(() => {});
                    interaction.reply(`🔨 <@${targetId}> a été banni.e définitivement par <@${interaction.user.id}>.`);
                })
                .catch(() => interaction.reply({ content: "Impossible de bannir ce membre (permissions insuffisantes).", ephemeral: true }));
            return;
        }
    }

    // Bouton de bannissement rapide anti-phishing
    if (interaction.isButton() && interaction.customId.startsWith('antiphish_ban_')) {
        if (!estModo(interaction.member) && !interaction.member.permissions.has('BanMembers')) {
            return interaction.reply({ content: "Tu n'as pas la permission d'utiliser ce bouton !", ephemeral: true });
        }
        const targetId = interaction.customId.replace('antiphish_ban_', '');
        await interaction.guild.members.ban(targetId, { reason: 'Compte piraté / Phishing détecté par Cacabot' })
            .then(() => interaction.reply(`✅ Le compte <@${targetId}> a été définitivement banni par <@${interaction.user.id}>.`))
            .catch(() => interaction.reply({ content: "Impossible de bannir ce membre (permissions insuffisantes ou membre déjà parti).", ephemeral: true }));
        return;
    }

    // =========================
    // BOUTON RAPPEL REPORTER
    // =========================

    if (interaction.isButton() && interaction.customId.startsWith('rappel_report_')) {
        const targetId = interaction.customId.replace('rappel_report_', '');
        if (interaction.user.id !== targetId) {
            return interaction.reply({ content: "Ce rappel n'est pas pour toi !", ephemeral: true });
        }
        const data = rappelReports.get(interaction.message.id);
        if (!data) return interaction.reply({ content: "Ce rappel a expir\u00e9 !", ephemeral: true });

        const delayMenu = new StringSelectMenuBuilder()
            .setCustomId(`rappel_delay_${targetId}`)
            .setPlaceholder('Choisis un d\u00e9lai...')
            .addOptions(
                { label: '15 minutes', value: '15min' },
                { label: '30 minutes', value: '30min' },
                { label: '1 heure', value: '1h' },
                { label: '2 heures', value: '2h' },
                { label: '\u00c0 d\u00e9terminer', value: 'custom' }
            );
        const row = new ActionRowBuilder().addComponents(delayMenu);
        return interaction.update({ content: 'Choisis quand est-ce que tu veux que le rappel soit renvoy\u00e9 :', components: [row] });
    }

    // =========================
    // MENU DELAI RAPPEL
    // =========================

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('rappel_delay_')) {
        const targetId = interaction.customId.replace('rappel_delay_', '');
        if (interaction.user.id !== targetId) {
            return interaction.reply({ content: "Ce rappel n'est pas pour toi !", ephemeral: true });
        }
        const data = rappelReports.get(interaction.message.id);
        if (!data) return interaction.reply({ content: "Ce rappel a expir\u00e9 !", ephemeral: true });

        const value = interaction.values[0];

        if (value === 'custom') {
            await interaction.update({ content: 'Choisis un d\u00e9lai (ex : `10min`, `2h`) :', components: [] });

            const filter = m => m.author.id === targetId;
            const collector = interaction.channel.createMessageCollector({ filter, time: 5 * 60 * 1000, max: 1 });

            collector.on('collect', async (m) => {
                const timeStr = m.content.trim().toLowerCase();
                let ms = 0;
                if (timeStr.endsWith('min')) ms = parseInt(timeStr) * 60 * 1000;
                else if (timeStr.endsWith('h')) ms = parseInt(timeStr) * 60 * 60 * 1000;
                else if (timeStr.endsWith('s')) ms = parseInt(timeStr) * 1000;

                m.delete().catch(() => {});

                if (isNaN(ms) || ms <= 0 || ms > 24 * 60 * 60 * 1000) {
                    await interaction.editReply({ content: 'D\u00e9lai invalide ! Le report a \u00e9t\u00e9 annul\u00e9.', components: [] }).catch(() => {});
                    return;
                }

                await interaction.editReply({ content: `\u23f0 Rappel report\u00e9 ! Je ping <@${targetId}> dans **${timeStr}**.`, components: [] }).catch(() => {});
                scheduleRappel(data.channelId, targetId, data.texte, ms);
            });

            collector.on('end', (collected) => {
                if (collected.size === 0) {
                    interaction.editReply({ content: '\u23f1\ufe0f Temps \u00e9coul\u00e9, report annul\u00e9.', components: [] }).catch(() => {});
                }
            });
            return;
        }

        let ms = 0;
        if (value.endsWith('min')) ms = parseInt(value) * 60 * 1000;
        else if (value.endsWith('h')) ms = parseInt(value) * 60 * 60 * 1000;

        await interaction.update({ content: `\u23f0 Rappel report\u00e9 ! Je ping <@${targetId}> dans **${value}**.`, components: [] });
        scheduleRappel(data.channelId, targetId, data.texte, ms);
    }

    // =========================
    //     BOUTONS YOUTUBE
    // =========================
    if (await handleYoutubeButton(interaction)) return;

    // =========================
    //     BOUTONS WANTED
    // =========================
    if (await handleWantedButton(interaction, topData)) return;


    // =========================
    //     BOUTON POMODORO
    // =========================

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('pomo_setup_')) {
    const parts = interaction.customId.split('_');
    const type = parts[2];
    const authorId = parts[3];
    const channelId = parts[4];

    if (interaction.user.id !== authorId) {
        return interaction.reply({ content: "Ce menu ne t'est pas destiné !", ephemeral: true });
    }

    const value = interaction.values[0];
    const fields = interaction.message.embeds[0].fields;
    const workVal = type === 'work' ? `${value} min` : fields[0].value;
    const breakVal = type === 'break' ? `${value} min` : fields[1].value;
    const reasonVal = type === 'reason' ? value : (fields[2]?.value ?? 'Non défini');
    const ready = workVal !== 'Non défini' && breakVal !== 'Non défini' && reasonVal !== 'Non défini';

    const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('🍅 Configurer le Pomodoro')
        .setDescription(ready ? 'Prêt à lancer !' : 'Choisis la durée de travail et la durée de pause !')
        .addFields(
            { name: '⏱️ Travail', value: workVal, inline: true },
            { name: '⏸️ Pause', value: breakVal, inline: true },
            { name: '🎯 Raison', value: reasonVal, inline: true }
        );

    const rows = [
    new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`pomo_setup_work_${authorId}_${channelId}`)
            .setPlaceholder('Durée de travail...')
            .addOptions([5,10,15,20,25,30,35,40,45,50,55,60].map(n => ({
                label: `${n} minutes`, value: `${n}`
            })))
    ),
    new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`pomo_setup_break_${authorId}_${channelId}`)
            .setPlaceholder('Durée de pause...')
            .addOptions([5,10,15,20,25,30].map(n => ({
                label: `${n} minutes`, value: `${n}`
            })))
    ),
    new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`pomo_setup_reason_${authorId}_${channelId}`)
            .setPlaceholder('Raison du pomodoro...')
            .addOptions([
                { label: 'Devoirs', value: 'Devoirs', emoji: '📚' },
                { label: 'Montage', value: 'Montage', emoji: '🎬' },
                { label: 'Composition', value: 'Composition', emoji: '🎵' },
                { label: 'Écriture', value: 'Écriture', emoji: '✍️' },
                { label: 'Code', value: 'Code', emoji: '💻' },
            ])
    )
];

if (ready) {
    rows.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`pomo_start_${authorId}_${channelId}_${parseInt(workVal)}_${parseInt(breakVal)}_${encodeURIComponent(reasonVal)}`)
            .setLabel('🍅 Lancer !')
            .setStyle(ButtonStyle.Danger)
    ));
}

return interaction.update({ embeds: [embed], components: rows });
}

    if (interaction.isButton() && interaction.customId.startsWith('pomo_')) {
    const parts = interaction.customId.split('_');
    const action = parts[1];

    if (action === 'start') {
        const authorId = parts[2];
        const channelId = parts[3];
        const workMin = parseInt(parts[4]);
        const breakMin = parseInt(parts[5]);
        const reason = decodeURIComponent(parts[6] ?? 'Session de travail');

        if (interaction.user.id !== authorId) {
            return interaction.reply({ content: "C'est pas ton pomodoro !", ephemeral: true });
        }

        if (pomodoroSessions.has(channelId)) {
            return interaction.reply({ content: "Un pomodoro est déjà en cours dans ce salon !", ephemeral: true });
        }

        const participantsMention = `<@${authorId}>`;
        await interaction.message.delete().catch(() => {});
        const channel = interaction.guild.channels.cache.get(channelId);
        if (!channel) return;

        await startPomodoro(channel, participantsMention, workMin, breakMin, 1, 'work', reason);
        return;
    }

    const channelId = parts[2];
    const session = pomodoroSessions.get(channelId);
    if (!session) return interaction.reply({ content: "Ce pomodoro n'existe plus !", ephemeral: true });

    if (action === 'stop') {
        clearTimeout(session.timeout);
        clearInterval(session.updateInterval);
        pomodoroSessions.delete(channelId);
        await session.message.delete().catch(() => {});
        return interaction.reply("⏹️ Pomodoro arrêté !");
    }

    if (action === 'skip') {
        clearTimeout(session.timeout);
        clearInterval(session.updateInterval);
        session.skip();
        return interaction.reply({ content: "⏭️ Phase skippée !", ephemeral: true });
    }
}

    if (await handleInteractionButton(interaction)) return;

    // =========================
    // BOUTONS ACTIF
    // =========================

    if (interaction.isButton() && (interaction.customId.startsWith('actif_jour_') || interaction.customId.startsWith('actif_semaine_') || interaction.customId.startsWith('actif_mois_'))) {
        const parts = interaction.customId.split('_');
        const periode = parts[1];
        const authorId = parts[2];

        if (interaction.user.id !== authorId) {
            return interaction.reply({ content: "Ce bouton ne t'est pas destin\u00e9 !", ephemeral: true });
        }

        const medals = ['\ud83e\udd47', '\ud83e\udd48', '\ud83e\udd49'];
        let counts, titre;
        if (periode === 'jour') {
            counts = dailyData[getTodayKey()] ?? {};
            titre = "\ud83d\udcc5 Membres les plus actifs aujourd'hui";
        } else if (periode === 'semaine') {
            counts = weeklyData[getWeekKey()] ?? {};
            titre = '\ud83d\uddd3\ufe0f Membres les plus actifs cette semaine';
        } else {
            counts = monthlyData[getMonthKey()] ?? {};
            titre = '\ud83d\udcc6 Membres les plus actifs ce mois-ci';
        }

        const sorted = Object.entries(counts).filter(([uid]) => uid !== '1503495713097519355').sort((a, b) => b[1] - a[1]).slice(0, 10);
        const fields = sorted.length > 0
            ? sorted.map(([uid, count], i) => {
                const member = interaction.guild.members.cache.get(uid);
                const name = member?.displayName ?? 'Membre inconnu';
                const medal = medals[i] ?? `**${i + 1}.**`;
                return { name: `${medal} ${name}`, value: `${count} messages`, inline: false };
            })
            : [{ name: 'Aucune donn\u00e9e', value: 'Pas encore de messages !', inline: false }];

        const embed = new EmbedBuilder().setColor(0xffd700).setTitle(titre).addFields(fields);

        const jourBtn = new ButtonBuilder()
            .setCustomId(`actif_jour_${authorId}`)
            .setLabel('\ud83d\udcc5 Jour')
            .setStyle(periode === 'jour' ? ButtonStyle.Primary : ButtonStyle.Secondary);
        const semaineBtn = new ButtonBuilder()
            .setCustomId(`actif_semaine_${authorId}`)
            .setLabel('\ud83d\uddd3\ufe0f Semaine')
            .setStyle(periode === 'semaine' ? ButtonStyle.Primary : ButtonStyle.Secondary);
        const moisBtn = new ButtonBuilder()
            .setCustomId(`actif_mois_${authorId}`)
            .setLabel('\ud83d\udcc6 Mois')
            .setStyle(periode === 'mois' ? ButtonStyle.Primary : ButtonStyle.Secondary);
        const row = new ActionRowBuilder().addComponents(jourBtn, semaineBtn, moisBtn);

        return interaction.update({ embeds: [embed], components: [row] });
    }

    // =========================
    // BOUTONS TOP
    // =========================

    if (interaction.isButton() && (interaction.customId.startsWith('top_prev_') || interaction.customId.startsWith('top_next_'))) {
        const parts = interaction.customId.split('_');
        const direction = parts[1]; // prev ou next
        const authorId = parts[2];
        const currentPage = parseInt(parts[3]);

        if (interaction.user.id !== authorId) {
            return interaction.reply({ content: "Ce bouton ne t'est pas destin\u00e9 !", ephemeral: true });
        }

        const newPage = direction === 'next' ? currentPage + 1 : currentPage - 1;
        const PAGE_SIZE = 10;
        const allSorted = Object.entries(topData.messages).sort((a, b) => b[1] - a[1]);
        const totalPages = Math.ceil(allSorted.length / PAGE_SIZE);

        const start = newPage * PAGE_SIZE;
        const slice = allSorted.slice(start, start + PAGE_SIZE);
        const medals = ['\ud83e\udd47', '\ud83e\udd48', '\ud83e\udd49'];
        const fields = slice.map(([uid, count], i) => {
            const member = interaction.guild.members.cache.get(uid);
            if (!member) return null;
            const rank = start + i;
            const medal = rank < 3 ? medals[rank] : `**${rank + 1}.**`;
            return { name: `${medal} ${member.displayName}`, value: `${count} messages`, inline: false };
        }).filter(Boolean);

        const userRank = allSorted.findIndex(([uid]) => uid === authorId);
        const userCount = topData.messages[authorId] || 0;
        let infoPerso = '';

        if (userRank !== -1) {
            const position = userRank + 1;
            if (userRank >= 10 && allSorted[9]) {
                const diff = (allSorted[9][1] - userCount) + 1;
                infoPerso = `> 👤 **Ta position :** **#${position}** avec **${userCount} messages** *(à ${diff} message${diff > 1 ? 's' : ''} du Top 10 !)*\n\n`;
            } else {
                infoPerso = `> 👤 **Ta position :** **#${position}** avec **${userCount} messages** *(Tu es dans le Top 10 ! 🔥)*\n\n`;
            }
        }

        const embed = new EmbedBuilder()
            .setColor(0xffd700)
            .setTitle('🏆 Classement des membres')
            .setDescription(infoPerso)
            .addFields(fields)
            .setFooter({ text: `Page ${newPage + 1}/${totalPages} • Compté depuis l'initialisation du bot` });

        const prev = new ButtonBuilder()
            .setCustomId(`top_prev_${authorId}_${newPage}`)
            .setLabel('\u2b05\ufe0f Arrière')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(newPage === 0);
        const next = new ButtonBuilder()
            .setCustomId(`top_next_${authorId}_${newPage}`)
            .setLabel('Suivant \u27a1\ufe0f')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(newPage >= totalPages - 1);
        const row = new ActionRowBuilder().addComponents(prev, next);

        return interaction.update({ embeds: [embed], components: [row] });
    }

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
        new SlashCommandBuilder().setName('roulette').setDescription('Tenter sa chance sur la Roulette Regaïenne')
            .addBooleanOption(opt => opt.setName('lancer').setDescription('Lancer immédiatement sans afficher l\'accueil')),
        new SlashCommandBuilder().setName('rlt').setDescription('Tenter sa chance sur la Roulette (raccourci)')
            .addBooleanOption(opt => opt.setName('lancer').setDescription('Lancer immédiatement sans afficher l\'accueil')),
        new SlashCommandBuilder().setName('rltsucces').setDescription('Consulter les 30 succès de la roulette')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à inspecter')),
        new SlashCommandBuilder().setName('roulettesucces').setDescription('Consulter les 30 succès de la roulette')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à inspecter')),
        new SlashCommandBuilder().setName('rltstats').setDescription('Voir les statistiques complètes de la roulette')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à inspecter')),
        new SlashCommandBuilder().setName('roulettestats').setDescription('Voir les statistiques complètes de la roulette')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à inspecter')),
        new SlashCommandBuilder().setName('rltstate').setDescription('Voir les bonus et malus actifs sur la roulette')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à inspecter')),
        new SlashCommandBuilder().setName('roulettestate').setDescription('Voir les bonus et malus actifs sur la roulette')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à inspecter')),
        new SlashCommandBuilder().setName('rlttop').setDescription('Classement des membres avec le plus de succès roulette'),
        new SlashCommandBuilder().setName('roulettetop').setDescription('Classement des membres avec le plus de succès roulette'),

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
        new SlashCommandBuilder().setName('wanted').setDescription('Affiche le criminel du jour'),
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
    setInterval(verifierTwitchLive, 60 * 1000);

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

// Boutons de rôles interactifs (Attribution unique)
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton() || !interaction.customId.startsWith('rolebtn_')) return;

    const roleId = interaction.customId.replace('rolebtn_', '');
    const role = interaction.guild?.roles.cache.get(roleId);

    if (!role) {
        return interaction.reply({ content: "❌ Ce rôle n'existe plus sur le serveur !", ephemeral: true });
    }

    const member = interaction.member;
    if (member.roles.cache.has(roleId)) {
        return interaction.reply({ content: `Tu as déjà le rôle **${role.name}** !`, ephemeral: true });
    } else {
        await member.roles.add(roleId).catch(err => console.error("Erreur ajout rôle bouton:", err.message));
        return interaction.reply({ content: `✅ Tu as reçu le rôle **${role.name}** !`, ephemeral: true });
    }
});

// Rôles réaction automatiques (Ajout du rôle)
client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch().catch(() => {});
    if (reaction.message.partial) await reaction.message.fetch().catch(() => {});

    const msgConfig = reactionRolesData[reaction.message.id];
    if (!msgConfig) return;

    const emojiKey = reaction.emoji.id ? `<:${reaction.emoji.name}:${reaction.emoji.id}>` : reaction.emoji.name;
    const roleId = msgConfig.roles[emojiKey] || msgConfig.roles[reaction.emoji.name] || (reaction.emoji.id && msgConfig.roles[reaction.emoji.id]);

    if (roleId) {
        const member = reaction.message.guild?.members.cache.get(user.id) ?? await reaction.message.guild?.members.fetch(user.id).catch(() => null);
        if (member && !member.roles.cache.has(roleId)) {
            await member.roles.add(roleId).catch(err => console.error(`Erreur ajout rôle réaction:`, err.message));
        }
    }
});

// Rôles réaction automatiques (Retrait du rôle)
client.on('messageReactionRemove', async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch().catch(() => {});
    if (reaction.message.partial) await reaction.message.fetch().catch(() => {});

    const msgConfig = reactionRolesData[reaction.message.id];
    if (!msgConfig) return;

    const emojiKey = reaction.emoji.id ? `<:${reaction.emoji.name}:${reaction.emoji.id}>` : reaction.emoji.name;
    const roleId = msgConfig.roles[emojiKey] || msgConfig.roles[reaction.emoji.name] || (reaction.emoji.id && msgConfig.roles[reaction.emoji.id]);

    if (roleId) {
        const member = reaction.message.guild?.members.cache.get(user.id) ?? await reaction.message.guild?.members.fetch(user.id).catch(() => null);
        if (member && member.roles.cache.has(roleId)) {
            await member.roles.remove(roleId).catch(err => console.error(`Erreur retrait rôle réaction:`, err.message));
        }
    }
});

client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;
    if (reaction.emoji.name !== '🖕' && reaction.emoji.name !== 'middle_finger') return;

    const msg = reaction.message;
    if (msg.author.id !== client.user.id) return;

    // Vérifier que c'est la première réaction de ce type
    const emojiReaction = msg.reactions.cache.find(r =>
        r.emoji.name === '\uD83D\uDD95' || r.emoji.name === 'middle_finger'
    );
    if (emojiReaction && emojiReaction.count > 1) return;

    const memberNom = msg.guild?.members.cache.get(user.id)?.displayName ?? user.username;
    await msg.channel.send(`Bah alors, **${memberNom}**, on m'envoie un doigt d'honneur ?`);
});

client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;
    if (!['🛑', '❌', '👎', '🤫', '🔇'].includes(reaction.emoji.name)) return;

    const msg = reaction.message;
    if (msg.author.id !== client.user.id) return;
    if (!/feur|bril|quoicoubeh/i.test(msg.content)) return;

    const ancien = mutedChannels.get(msg.channel.id);
    if (ancien) clearTimeout(ancien.timeout);

    const until = Date.now() + STOP_DURATION_MS;
    const timeout = setTimeout(() => mutedChannels.delete(msg.channel.id), STOP_DURATION_MS);
    mutedChannels.set(msg.channel.id, { until, timeout });

    await msg.react('🆗').catch(() => {});
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

    if (member.guild.id === '720057528351850547') {
        const accountAge = Date.now() - member.user.createdTimestamp;
        const oneMonth = 30 * 24 * 60 * 60 * 1000;
                // --- Escalade anti-raid : kick si retour trop rapide après un timeout raid ---
        const previousRaidMuteEnd = raidMuteRecord.get(member.id);
        if (previousRaidMuteEnd && Date.now() - previousRaidMuteEnd < RAID_ESCALATION_WINDOW_MS) {
            raidMuteRecord.delete(member.id);
            await member.kick('Anti-raid : retour trop rapide après un timeout raid').catch(() => {});
            return;
        }

        // --- Détection anti-raid : rafale de comptes très récents ---
        if (accountAge < RAID_ACCOUNT_AGE_MS) {
            const joins = (raidJoinTracker.get(member.guild.id) || []).filter(j => Date.now() - j.timestamp < RAID_WINDOW_MS);
            joins.push({ userId: member.id, timestamp: Date.now() });
            raidJoinTracker.set(member.guild.id, joins);

            if (joins.length >= RAID_THRESHOLD) {
                for (const j of joins) raidFlaggedUsers.set(j.userId, true);
                raidJoinTracker.delete(member.guild.id);
            }
        }
        if (accountAge < oneMonth) {
            const modChannel = member.guild.channels.cache.get(MOD_CHANNEL_ID);
            if (!modChannel) return;
            const jours = Math.floor(accountAge / (24 * 60 * 60 * 1000));
            const embed = new EmbedBuilder()
                .setColor(0xff9900)
                .setTitle('⚠️ Compte récent détecté')
                .setDescription(`<@${member.id}> vient de rejoindre le serveur, mais son compte n'a été créé qu'il y a **${jours} jour${jours > 1 ? 's' : ''}**.\n\nC'est peut-être un bot ou un compte secondaire. Que souhaitez-vous faire ?`)
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                .setFooter({ text: `ID : ${member.id}` })
                .setTimestamp();

            const actionRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`mod_action_kick_${member.id}`)
                    .setLabel('👢 Expulser')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`mod_action_ban_${member.id}`)
                    .setLabel('🔨 Bannir')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`mod_action_dismiss_${member.id}`)
                    .setLabel('✅ Fausse alerte')
                    .setStyle(ButtonStyle.Success)
            );

            await modChannel.send({ embeds: [embed], components: [actionRow] });
        }
    }
});

const VOICE_WATCH_CONFIGS = [
    {
        guildId: '1515767395036172469',
        textChannelId: '1515767396407705762',
        vocalIds: [
            '1515767396407705763',
            '1515768236443173105',
            '1515768324892655720'
        ]
    },
    {
        guildId: '720057528351850547',
        textChannelId: '720080025130369115',
        vocalIds: [
            '720057528867618910',
            '1465882952251736165',
            '1514586546014261278',
            '1542345188385619988'
        ]
    }
];

client.on('voiceStateUpdate', async (oldState, newState) => {
    const config = VOICE_WATCH_CONFIGS.find(c => c.guildId === newState.guild.id);
    if (!config) return;
    const { guildId: GUILD_ID, textChannelId: TEXT_CHANNEL_ID, vocalIds: VOCAL_IDS } = config;

    const textChannel = newState.guild.channels.cache.get(TEXT_CHANNEL_ID);
    if (!textChannel) return;

    // Supprimer l'ancien message et annuler ses timers quoi qu'il arrive
    const supprimerAncien = async () => {
        const ancien = vocalMessages.get(GUILD_ID);
        if (!ancien) return;
        ancien.timeouts.forEach(t => clearTimeout(t));
        await ancien.message.delete().catch(() => {});
        vocalMessages.delete(GUILD_ID);
    };

    // Quelqu'un quitte un vocal surveillé sans rejoindre un autre vocal surveillé
    if (
        oldState.channelId && VOCAL_IDS.includes(oldState.channelId) &&
        (!newState.channelId || !VOCAL_IDS.includes(newState.channelId))
    ) {
        const ancien = vocalMessages.get(GUILD_ID);
        if (ancien?.memberId === newState.member?.id) {
            await supprimerAncien();
        }
        return;
    }

    // Quelqu'un rejoint un vocal surveillé
    if (!newState.channelId || !VOCAL_IDS.includes(newState.channelId)) return;
    if (oldState.channelId === newState.channelId) return;

    const channel = newState.channel;
    if (!channel || channel.members.size >= 2) return;

    const memberNom = newState.member?.displayName ?? newState.member?.user.username ?? 'Quelqu\'un';
    const memberId = newState.member?.id;
    const channelName = channel.name;

    // Supprimer l'ancien message avant d'envoyer le nouveau
    await supprimerAncien();

    const msg = await textChannel.send(`**${memberNom}** a rejoint **${channelName}** ! On se fait un ptit voc ? 👀`);

    const t1 = setTimeout(async () => {
        await newState.guild.members.fetch(memberId).catch(() => {});
        const member = newState.guild.members.cache.get(memberId);
        if (!member?.voice.channelId || !VOCAL_IDS.includes(member.voice.channelId)) return;
        await msg.edit(`**${memberNom}** attend depuis **30 minutes** en vocal... Quelqu'un ? 👀`).catch(() => {});
    }, 30 * 60 * 1000);

    const t2 = setTimeout(async () => {
        const member = newState.guild.members.cache.get(memberId);
        if (!member?.voice.channelId || !VOCAL_IDS.includes(member.voice.channelId)) return;
        await msg.edit(`**${memberNom}** attend depuis **1 heure** en vocal... C'est long quand même. 👀`).catch(() => {});
    }, 60 * 60 * 1000);

    const t3 = setTimeout(async () => {
        const member = newState.guild.members.cache.get(memberId);
        if (!member?.voice.channelId || !VOCAL_IDS.includes(member.voice.channelId)) return;
        await msg.edit(`**${memberNom}** attend depuis **2 heures** en vocal. Y a vraiment personne là ? 👀`).catch(() => {});
    }, 120 * 60 * 1000);

    vocalMessages.set(GUILD_ID, { message: msg, memberId, channelName, timeouts: [t1, t2, t3] });
});

client.login(process.env.TOKEN)
