// ==========================================
//   MODULE REGADEX (TCG) — CACABOT (REGAÏA)
// ==========================================

const fs = require('fs');
const path = require('path');
const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    UserSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ChannelType,
    AttachmentBuilder,
    MessageFlags
} = require('discord.js');
const { createCanvas, loadImage } = require('canvas');

// ==========================================
//   CONSTANTES & CONFIGURATION
// ==========================================

const GUILD_ID = '720057528351850547';
const EPSYS_ID = '436218312574107658';
const TCG_ROLE_ID = '1572007430152261672'; // Collectionneur.euse
const TCG_CHANNEL_ID = '1572007962199851059'; // Salon TCG
const ROLE_CHANNEL_ID = '1559082682313474059'; // Salon choix des rôles
const TCG_TEST_CHANNEL_ID = '1480756332373213275'; // Crash-test & Alertes intégrité
const TCG_TRADE_LOG_CHANNEL_ID = '1572168354435964928'; // Salon privé Epsys
const TCG_PANTHEON_CHANNEL_ID = '1572421633937768519'; // Panthéon RegaDex
const SHITPOST_CHANNEL_ID = '720079691041472572'; // Salon shitpost autorisé pour !flex
const AFK_VOCAL_CHANNEL_ID = '1542345102930874449';

// ==========================================
//   [SET 2] CONFIGURATION MULTI-SETS REGADEX
//   Pour activer le Set 2 plus tard :
//   1) Ajouter `2: { ... enabled: true }` dans SETS_CONFIG
//   2) Déposer les cartes dans TCG/Set 2/ et les assets dans TCG/Assets/ (ou TCG/Set 2/)
//   3) Suivre les repères `// [SET 2]` dans tcg.js et index.js
// ==========================================
const DEFAULT_SET_NUMBER = 1;
const SETS_CONFIG = {
    1: {
        number: 1,
        name: 'Set 1 - Vestiges Regaïens',
        shortName: 'Set 1',
        folderName: 'Set 1',
        expectedClassic: 96,
        expectedNegative: 13,
        totalExpected: 109,
        enabled: true
    }
    // [SET 2] Modèle prêt à activer le jour J :
    // 2: {
    //     number: 2,
    //     name: 'Set 2 - Nom du Set 2',
    //     shortName: 'Set 2',
    //     folderName: 'Set 2',
    //     expectedClassic: 96,
    //     expectedNegative: 13,
    //     totalExpected: 109,
    //     enabled: true
    // }
};

const SET1_NAME = SETS_CONFIG[1].name;
const BOOSTER_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6h
const HALF_COOLDOWN_MS = 3 * 60 * 60 * 1000; // 3h
const MAX_FREE_BOOSTERS = 2;
const MAX_WEEKLY_BOOSTERS = 2; // Plafond de boosters du vendredi 8h
const MAX_COMMUNITY_BOOSTERS = 2; // Plafond de boosters communautaires
const MAX_WISHLIST = 5;
const COMPLETION_MILESTONES = [
    { pct: 25, reward: 15 },
    { pct: 50, reward: 15 },
    { pct: 75, reward: 15 },
    { pct: 100, reward: 25 }
];
const BOOSTER_GIF_DELAY_MS = 4000; // 4 secondes
const CARD_3_AUTO_RECAP_MS = 10 * 1000; // 10 secondes sur la carte 3 avant récap auto
const TRADE_INACTIVITY_MS = 24 * 60 * 60 * 1000; // 24h
const GOD_PACK_BASE_CHANCE = 0.01; // 1% de base
const GOD_PACK_BOOST_MULT = 5; // x5 pendant 5 jours (5%)
const GOD_PACK_BOOST_DURATION_MS = 5 * 24 * 60 * 60 * 1000;
const EPSYS_FULL_ART_CARD_ID = '1-84';

const COMMUNITY_QUEST_POOL = [
    { type: 'open_boosters', target: 80, label: 'Ouvrir **80 boosters** au total' },
    { type: 'pull_rare', target: 35, label: 'Obtenir **35 cartes Rares**' },
    { type: 'pull_epic', target: 20, label: 'Obtenir **20 cartes Épiques**' },
    { type: 'pull_legendary', target: 8, label: 'Obtenir **8 cartes Légendaires**' },
    { type: 'pull_fullart', target: 3, label: 'Obtenir **3 cartes Full Art**' },
    { type: 'trades', target: 8, label: 'Effectuer **8 échanges** de cartes' }
];

const POINTS_PER_BOOSTER = 5;
const POINTS_PER_DUPLICATE = 3;
const POINTS_PER_TRADE = 3;
const MESSAGES_PER_POINT = 15;
const VOCAL_MINUTES_PER_POINT = 10;

function getActiveSets() {
    return Object.values(SETS_CONFIG).filter(s => s.enabled);
}

function getSetConfig(setNumber = DEFAULT_SET_NUMBER) {
    return SETS_CONFIG[setNumber] || SETS_CONFIG[DEFAULT_SET_NUMBER];
}

function getSetCatalog(setNumber = null) {
    if (!setNumber) return cardCatalog;
    return cardCatalog.filter(c => (c.setNumber || 1) === setNumber);
}

function getSetCardsCount(setNumber = DEFAULT_SET_NUMBER) {
    return getSetCatalog(setNumber).length;
}

const PULL_BOOST_ROLE_KEY = 'ROLE_TCG';
const PULL_BOOST_GUARANTEED = 'GUARANTEED';
const PULL_BOOST_TRIPLE = 'GUARANTEED_X3';
const PULL_MULTIPLIERS = [1, 2, 3, 5, 10, 20, 50, 100, PULL_BOOST_GUARANTEED, PULL_BOOST_TRIPLE];
const PUNITION_RARITIES = [
    { code: 'E', rarity: 'Épique', emoji: '🟣' },
    { code: 'L', rarity: 'Légendaire', emoji: '🟡' },
    { code: 'F', rarity: 'Full Art', emoji: '🌈' },
    { code: 'N', rarity: 'Négative', emoji: '🕳️' }
];
const PUNITION_LEVELS = [1, 0.5, 0.2, 0.1, 0];

const STORE_PRICES = {
    booster: 100,
    fiveCardBooster: 175,
    luckyBooster: 75,
    holoTransform: 50,
    negativeTransform: 1000,
    halfCooldown: 25,
    godPackBoost: 150
};

const CREDITS_LINKS = {
    texturelabs: 'https://texturelabs.org/',
    vectorstock: 'https://www.vectorstock.com/',
    magnific: 'https://magnific.ai/',
    pngimg: 'https://pngimg.com/',
    metalforge: 'https://metalforge.xyz/'
};

const RARITY_LIST = ['Commune', 'Rare', 'Épique', 'Légendaire', 'Full Art', 'Négative'];
const RARITY_ORDER = {
    'Commune': 0,
    'Rare': 1,
    'Épique': 2,
    'Légendaire': 3,
    'Full Art': 4,
    'Négative': 5,
    'Personnalisée': 6
};
const RARITY_WEIGHTS = {
    'Commune': 65,
    'Rare': 22,
    'Épique': 8,
    'Légendaire': 3,
    'Full Art': 1.5,
    'Négative': 0.5
};
const RARITY_META = {
    'Commune': { color: 0xe6d5b8, hex: '#E6D5B8', glow: 'rgba(230, 213, 184, 0.55)', emoji: '⚪' },
    'Rare': { color: 0x009dff, hex: '#009DFF', glow: 'rgba(0, 157, 255, 0.55)', emoji: '🔵' },
    'Épique': { color: 0x9b59b6, hex: '#A855F7', glow: 'rgba(168, 85, 247, 0.55)', emoji: '🟣' },
    'Légendaire': { color: 0xf1c40f, hex: '#F1C40F', glow: 'rgba(241, 196, 15, 0.55)', emoji: '🟡' },
    'Full Art': { color: 0xffffff, hex: '#FFFFFF', glow: 'rgba(255, 255, 255, 0.55)', emoji: '🌈' },
    'Négative': { color: 0x2ecc71, hex: '#2ECC71', glow: 'rgba(46, 204, 113, 0.55)', emoji: '🕳️' },
    'Personnalisée': { color: 0xff6b9d, hex: '#FF6B9D', glow: 'rgba(255, 107, 157, 0.65)', emoji: '🌟' }
};

const CATEGORIES = ['Items', 'Personnages', 'Références'];
const BINDER_RARITY_CODES = {
    all: null,
    C: 'Commune',
    R: 'Rare',
    E: 'Épique',
    L: 'Légendaire',
    F: 'Full Art',
    N: 'Négative'
};
const BINDER_RARITY_ORDER = ['all', 'C', 'R', 'E', 'L', 'F', 'N'];
const BINDER_RARITY_BTN = {
    all: { label: 'Rareté : OFF', emoji: '💎', style: ButtonStyle.Secondary },
    C: { label: 'Communes', emoji: '⚪', style: ButtonStyle.Primary },
    R: { label: 'Rares', emoji: '🔵', style: ButtonStyle.Primary },
    E: { label: 'Épiques', emoji: '🟣', style: ButtonStyle.Primary },
    L: { label: 'Légendaires', emoji: '🟡', style: ButtonStyle.Primary },
    F: { label: 'Full Art', emoji: '🌈', style: ButtonStyle.Primary },
    N: { label: 'Négatives', emoji: '🕳️', style: ButtonStyle.Primary }
};

// ==========================================
//   HELPERS SILENCIEUX (ZERO NOTIFS / PUSH)
// ==========================================

function withSilent(payload) {
    const obj = typeof payload === 'string' ? { content: payload } : { ...payload };
    if (obj.ephemeral || (Array.isArray(obj.flags) && obj.flags.includes(MessageFlags.Ephemeral))) {
        return obj;
    }
    const flags = Array.isArray(obj.flags)
        ? [...obj.flags]
        : (obj.flags ? [obj.flags] : []);
    if (!flags.includes(MessageFlags.SuppressNotifications)) {
        flags.push(MessageFlags.SuppressNotifications);
    }
    obj.flags = flags;
    if (!obj.allowedMentions) {
        obj.allowedMentions = { repliedUser: false };
    }
    return obj;
}

async function replySilent(target, payload) {
    const data = withSilent(payload);
    if (target.isRepliable?.()) {
        if (target.deferred || target.replied) {
            return target.followUp(data);
        }
        return target.reply(data);
    }
    return target.reply(data);
}

async function replyTempSilent(message, payload, delayMs = 8000) {
    const sent = await replySilent(message, payload).catch(() => null);
    if (sent && typeof sent.delete === 'function') {
        setTimeout(() => {
            sent.delete().catch(() => {});
        }, delayMs);
    }
    return sent;
}

async function sendSilent(channel, payload) {
    return channel.send(withSilent(payload));
}

async function deferReplySilent(interaction) {
    return interaction.deferReply({ flags: [MessageFlags.SuppressNotifications] });
}

const PANEL_AUTO_DELETE_MS = 20 * 60 * 1000; // 20 minutes d'inactivité
const panelAutoDeleteTimers = new Map(); // messageId -> Timeout

function cancelPanelAutoDelete(messageId) {
    if (!messageId) return;
    const t = panelAutoDeleteTimers.get(messageId);
    if (t) {
        clearTimeout(t);
        panelAutoDeleteTimers.delete(messageId);
    }
}

function schedulePanelAutoDelete(msg, triggerMessage = null) {
    if (!msg?.id || msg.flags?.has?.(MessageFlags.Ephemeral)) return msg;
    if (boosterSessions.has(msg.id)) return msg;
    cancelPanelAutoDelete(msg.id);
    const timer = setTimeout(async () => {
        panelAutoDeleteTimers.delete(msg.id);
        if (boosterSessions.has(msg.id)) return;
        const refId = triggerMessage?.id || msg.reference?.messageId;
        if (refId && msg.channel) {
            const trig = triggerMessage || await msg.channel.messages.fetch(refId).catch(() => null);
            if (trig && !trig.author?.bot) {
                await trig.delete().catch(() => {});
            }
        }
        await msg.delete().catch(() => {});
    }, PANEL_AUTO_DELETE_MS);
    timer.unref?.();
    panelAutoDeleteTimers.set(msg.id, timer);
    return msg;
}

async function replyPanelSilent(target, payload, ownerId = null) {
    if (isSandboxId(ownerId)) {
        return replySilent(target, payload);
    }
    const data = withSilent(payload);
    let sent = null;
    if (target.isRepliable?.()) {
        if (target.deferred || target.replied) {
            sent = await target.followUp({ ...data, fetchReply: true });
        } else {
            sent = await target.reply({ ...data, fetchReply: true });
        }
        schedulePanelAutoDelete(sent);
        return sent;
    }
    sent = await target.reply(data);
    schedulePanelAutoDelete(sent, target);
    return sent;
}

// ==========================================
//   BRIDGE AVEC INDEX.JS
// ==========================================

let tcgBridge = {
    client: null,
    getTcgData: () => ({}),
    demanderSauvegarde: () => {},
    saveAll: async () => {},
    findMemberByName: () => ({ found: null, multiple: false, candidates: [] }),
    askDisambiguation: () => {},
    estModo: () => false,
    trackBattlePassProgress: () => {},
    declencherHappyHourRoulette: () => {}
};

function initTcgState(bridge) {
    tcgBridge = { ...tcgBridge, ...bridge };
}

function getStoreData() {
    const data = tcgBridge.getTcgData();
    if (!data.users) data.users = {};
    if (!data.notifs) data.notifs = {};
    if (!data.activeTrades) data.activeTrades = {};
    if (!data.pullBoosts) data.pullBoosts = {};
    if (!data.pullPunishments) data.pullPunishments = {};
    if (typeof data.lastWeeklyBoosterKey !== 'string') data.lastWeeklyBoosterKey = '';
    if (!data.communityQuest) data.communityQuest = null;
    if (!Array.isArray(data.recentOpenings)) data.recentOpenings = [];
    return data;
}

// ==========================================
//   CATALOGUE & SCAN AUTOMATIQUE (MULTI-SETS)
// ==========================================

const TCG_ROOT = path.resolve(process.cwd(), 'TCG');
const TCG_ASSETS_DIR = path.join(TCG_ROOT, 'Assets');
const TCG_SET1_DIR = path.join(TCG_ROOT, 'Set 1');
const TCG_PERSO_DIR = path.join(TCG_ROOT, 'Cartes Perso');
const TCG_PROXIES_DIR = path.join(TCG_ROOT, 'Proxies'); // Volume persistant (/app/TCG/Proxies)

const PROXY_TTL_MS = 2 * 60 * 1000; // Micro-cache RAM éphémère de 2 min sur les miniatures uniquement
const PROXY_MAX_RAM_ITEMS = 120;

let cardCatalog = [];
let cardById = new Map();
let cardByNumCode = new Map();
let persoCatalog = [];
let persoById = new Map();
let persoByNumValue = new Map();

function getCardByIdAny(id) {
    if (!id) return null;
    return cardById.get(id) || persoById.get(id) || null;
}
let setAssets = {}; // [SET 2] Map setNumber -> { openingGif, boosterPng, eventBanner, logo }
let assetPaths = {
    openingGif: null,
    mysteryCard: null,
    boosterPng: null,
    eventBanner: null,
    set1Logo: null,
    bgW: null,
    bgB: null
};

// Les miniatures déjà redimensionnées (avec lueur/ombre pré-cuites) sont stockées sur disque dans TCG/Proxies (volume Coolify).
// En RAM, on ne garde que les 2 fonds 900p, les buffers récurrents et un micro-cache TTL des proxies
// vidé automatiquement après 2 minutes d'inactivité (0 Mo gardés au repos).
const bgCanvases = new Map();     // 'W' | 'B' -> fond pré-redimensionné en 1600x900
const proxyRamCache = new Map();  // proxyPath -> Image miniature (éphémère)
const proxyInFlight = new Map();  // proxyPath -> Promise<{img, pad}|null> (anti double-génération)
let proxyRamClearTimer = null;
let lastProxyWriteError = null;
let proxyWarmupRunning = false;
const hotBuffers = new Map();     // buffers des pièces jointes les plus envoyées
const boostersEnCours = new Set();
const boosterSessions = new Map(); // messageId -> session
const pendingConfirms = new Map(); // confirmId -> payload
const binderReturnStates = new Map(); // binderMsgId -> { ownerId, viewerId, category, perPageMode, page, sortMode, rarityFilter, ownedOnly, fromHub, expiresAt }
const pullChanceSessions = new Map(); // sessionId -> { targetKey, cardId, mult, cardPage, createdAt }
const punitionSessions = new Map(); // sessionId -> { targetUserId, createdAt }
const notifTimers = new Map(); // userId -> Timeout

const TRADE_FREE_WINDOW_MS = 5 * 60 * 1000;
let tradeFreeModeUntil = 0;

function isTradeFreeModeActive() {
    return Date.now() < tradeFreeModeUntil;
}

function normalizeText(str) {
    return String(str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function findExistingFile(dir, candidates) {
    if (!fs.existsSync(dir)) return null;
    for (const name of candidates) {
        const full = path.join(dir, name);
        if (fs.existsSync(full)) return full;
    }
    try {
        const files = fs.readdirSync(dir);
        for (const cand of candidates) {
            const normCand = normalizeText(cand);
            const match = files.find(f => normalizeText(f) === normCand);
            if (match) return path.join(dir, match);
        }
    } catch {}
    return null;
}

function findSubdir(parentDir, candidates) {
    if (!fs.existsSync(parentDir)) return null;
    for (const name of candidates) {
        const full = path.join(parentDir, name);
        if (fs.existsSync(full) && fs.statSync(full).isDirectory()) return full;
    }
    try {
        const entries = fs.readdirSync(parentDir, { withFileTypes: true }).filter(e => e.isDirectory());
        for (const cand of candidates) {
            const normCand = normalizeText(cand);
            const match = entries.find(e => normalizeText(e.name) === normCand);
            if (match) return path.join(parentDir, match.name);
        }
    } catch {}
    return null;
}

function parseCardFilename(filename, category, folderRarity, setNumber = DEFAULT_SET_NUMBER) {
    if (!filename.toLowerCase().endsWith('.png')) return null;
    const match = filename.match(/^(?:(Ø)(\d+)|(\d+))(?:\s*-\s*|\s+)(.+)\.png$/iu);
    if (!match) return null;

    const isNegative = Boolean(match[1]);
    const numValue = parseInt(isNegative ? match[2] : match[3], 10);
    const numCode = isNegative ? `Ø${numValue}` : `${numValue}`;
    const rawName = match[4].trim();
    const isHolo = /\bholo$/i.test(rawName);
    const baseName = rawName.replace(/\s+holo$/i, '').trim();
    const displayName = isHolo ? rawName.replace(/\bholo$/i, 'Holographique') : rawName;

    let rarity = folderRarity;
    if (folderRarity === 'Full Art & Négative') {
        rarity = isNegative ? 'Négative' : 'Full Art';
    }

    if (isNegative && folderRarity !== 'Full Art & Négative') return null;

    const sortIndex = (setNumber * 100000) + (isNegative ? 1000 + numValue : numValue);
    const id = `${setNumber}-${numCode}`;

    return {
        id,
        setNumber,
        numCode,
        numValue,
        sortIndex,
        name: displayName,
        baseName,
        normalizedName: normalizeText(rawName),
        normalizedDisplayName: normalizeText(displayName),
        normalizedBaseName: normalizeText(baseName),
        category,
        rarity,
        isHolo,
        isNegative,
        holoCounterpartId: null,
        baseCounterpartId: null,
        negativeCounterpartId: null,
        filePath: null,
        filename
    };
}

function parsePersoCardFilename(filename, fallbackNumValue = null) {
    const normalizedFile = String(filename || '').normalize('NFC');
    const extMatch = normalizedFile.match(/\.(png|jpe?g|webp)$/i);
    if (!extMatch) return null;
    const baseWithoutExt = normalizedFile.slice(0, -extMatch[0].length).trim();
    if (!baseWithoutExt) return null;

    const match = baseWithoutExt.match(/^sp[eé]\s*[-]?\s*(\d+)(?:(?:\s*-\s*|\s+)(.+))?$/iu);
    let rawDigits;
    let numValue;
    let rawName;

    if (match) {
        rawDigits = match[1];
        numValue = parseInt(rawDigits, 10);
        if (!Number.isFinite(numValue) || numValue <= 0) return null;
        rawName = (match[2] || `Spé-${rawDigits}`).trim();
    } else if (Number.isInteger(fallbackNumValue) && fallbackNumValue > 0) {
        numValue = fallbackNumValue;
        rawDigits = String(numValue).padStart(2, '0');
        rawName = baseWithoutExt;
    } else {
        return null;
    }

    const id = `Spé-${rawDigits}`;

    return {
        id,
        setNumber: 'perso',
        numCode: id,
        numValue,
        sortIndex: 9000000 + numValue,
        name: rawName,
        baseName: rawName,
        normalizedName: normalizeText(rawName),
        normalizedDisplayName: normalizeText(rawName),
        normalizedBaseName: normalizeText(rawName),
        category: 'Cartes Perso',
        rarity: 'Personnalisée',
        isPerso: true,
        isHolo: false,
        isNegative: false,
        holoCounterpartId: null,
        baseCounterpartId: null,
        negativeCounterpartId: null,
        filePath: null,
        filename
    };
}

async function scanSet1Cards(client = null) {
    const missingAssets = [];
    const missingCards = [];
    const unrecognizedFiles = [];
    const duplicateCodes = [];
    const orphanHolos = [];

    const newSetAssets = {};
    for (const setCfg of getActiveSets()) {
        const setDir = path.join(TCG_ROOT, setCfg.folderName);
        const setAssetsSub = findSubdir(TCG_ASSETS_DIR, [setCfg.folderName]) || path.join(TCG_ASSETS_DIR, setCfg.folderName);
        const sNum = setCfg.number;

        const assetsForSet = {
            openingGif: findExistingFile(TCG_ASSETS_DIR, [`Ouverture Set ${sNum}.gif`]) || findExistingFile(setDir, [`Ouverture Set ${sNum}.gif`]),
            boosterPng: findExistingFile(TCG_ASSETS_DIR, [`Booster Set ${sNum}.png`]) || findExistingFile(setDir, [`Booster Set ${sNum}.png`]),
            eventBanner: findExistingFile(setDir, [`Event banner Set ${sNum}.png`]) || findExistingFile(TCG_ASSETS_DIR, [`Event banner Set ${sNum}.png`]),
            logo: findExistingFile(setDir, ['Logo.png']) || findExistingFile(setAssetsSub, ['Logo.png'])
        };
        newSetAssets[sNum] = assetsForSet;

        if (!assetsForSet.openingGif) missingAssets.push(`TCG/Assets/Ouverture Set ${sNum}.gif`);
        if (!assetsForSet.boosterPng) missingAssets.push(`TCG/Assets/Booster Set ${sNum}.png`);
        if (!assetsForSet.eventBanner) missingAssets.push(`TCG/${setCfg.folderName}/Event banner Set ${sNum}.png`);
        if (!assetsForSet.logo) missingAssets.push(`TCG/${setCfg.folderName}/Logo.png`);
    }
    setAssets = newSetAssets;

    assetPaths = {
        openingGif: setAssets[1]?.openingGif || null,
        mysteryCard: findExistingFile(TCG_ASSETS_DIR, ['Carte mystère.png', 'Carte mystere.png']),
        boosterPng: setAssets[1]?.boosterPng || null,
        eventBanner: setAssets[1]?.eventBanner || null,
        set1Logo: setAssets[1]?.logo || null,
        bgW: findExistingFile(TCG_ASSETS_DIR, [
            'Background RegaDex W.jpg', 'Background RegaDex W.jpeg', 'Background RegaDex W.png',
            'Background Readex W.jpg', 'Background Readex W.jpeg', 'Background Readex W.png'
        ]),
        bgB: findExistingFile(TCG_ASSETS_DIR, [
            'Background RegaDex B.jpg', 'Background RegaDex B.jpeg', 'Background RegaDex B.png',
            'Background Readex B.jpg', 'Background Readex B.jpeg', 'Background Readex B.png'
        ])
    };

    // Les fonds source sont réduits une seule fois en 1600x900 puis libérés.
    bgCanvases.clear();
    await Promise.all([getBackground('W'), getBackground('B')]);

    if (!assetPaths.mysteryCard) missingAssets.push('TCG/Assets/Carte mystère.png');
    if (!assetPaths.bgW) missingAssets.push('TCG/Assets/Background RegaDex W.jpg (ou .png)');
    if (!assetPaths.bgB) missingAssets.push('TCG/Assets/Background RegaDex B.jpg (ou .png)');

    const newCatalog = [];
    const newById = new Map();
    const newByNumCode = new Map();

    const rarityFolders = [
        { key: 'Commune', candidates: ['Commune', 'Communes'] },
        { key: 'Rare', candidates: ['Rare', 'Rares'] },
        { key: 'Épique', candidates: ['Épique', 'Epique', 'Épiques', 'Epiques'] },
        { key: 'Légendaire', candidates: ['Légendaire', 'Legendaire', 'Légendaires', 'Legendaires'] },
        { key: 'Full Art & Négative', candidates: ['Full Art & Négative', 'Full Art & Négatives', 'Full Art & Negative', 'Full Art & Negatives'] }
    ];

    // [SET 2] Boucle dynamique sur tous les sets activés dans SETS_CONFIG
    for (const setCfg of getActiveSets()) {
        const setDir = path.join(TCG_ROOT, setCfg.folderName);
        if (!fs.existsSync(setDir)) {
            unrecognizedFiles.push(`Dossier Set manquant : TCG/${setCfg.folderName}`);
            continue;
        }

        for (const cat of CATEGORIES) {
            const catDir = findSubdir(setDir, [cat]);
            if (!catDir) {
                unrecognizedFiles.push(`Dossier catégorie manquant : TCG/${setCfg.folderName}/${cat}`);
                continue;
            }

            for (const rf of rarityFolders) {
                const rarDir = findSubdir(catDir, rf.candidates);
                if (!rarDir) {
                    unrecognizedFiles.push(`Dossier rareté manquant : TCG/${setCfg.folderName}/${cat}/${rf.key}`);
                    continue;
                }

                const files = fs.readdirSync(rarDir).filter(f => !f.startsWith('.'));
                for (const file of files) {
                    const fullPath = path.join(rarDir, file);
                    if (fs.statSync(fullPath).isDirectory()) continue;

                    const parsed = parseCardFilename(file, cat, rf.key, setCfg.number);
                    if (!parsed) {
                        unrecognizedFiles.push(`TCG/${setCfg.folderName}/${cat}/${path.basename(rarDir)}/${file}`);
                        continue;
                    }
                    parsed.filePath = fullPath;

                    if (newById.has(parsed.id)) {
                        duplicateCodes.push(`${parsed.id} (${file} vs ${newById.get(parsed.id).filename})`);
                        continue;
                    }

                    newCatalog.push(parsed);
                    newById.set(parsed.id, parsed);
                    newByNumCode.set(parsed.id.toUpperCase(), parsed);
                    if (!newByNumCode.has(parsed.numCode.toUpperCase())) {
                        newByNumCode.set(parsed.numCode.toUpperCase(), parsed);
                    }
                }
            }
        }

        // Lier chaque carte Holo à sa version normale (au sein du même Set)
        const setCards = newCatalog.filter(c => c.setNumber === setCfg.number);
        for (const card of setCards) {
            if (!card.isHolo) continue;
            const baseMatch = setCards.find(c =>
                !c.isHolo &&
                !c.isNegative &&
                c.category === card.category &&
                c.rarity === card.rarity &&
                c.normalizedBaseName === card.normalizedBaseName
            );
            if (baseMatch) {
                card.baseCounterpartId = baseMatch.id;
                baseMatch.holoCounterpartId = card.id;
            } else {
                orphanHolos.push(`${card.id} - ${card.name} (${card.category}/${card.rarity})`);
            }
        }

        // Lier chaque carte Full Art à sa version Négative correspondante (au sein du même Set)
        const cleanVariantName = (str) => normalizeText(str)
            .replace(/\b(full\s*art|negatives?|négatives?)\b/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        for (const card of setCards) {
            if (card.rarity !== 'Full Art' || card.isNegative || card.isHolo) continue;
            const negMatch =
                setCards.find(c => c.isNegative && c.rarity === 'Négative' && c.category === card.category && c.normalizedBaseName === card.normalizedBaseName) ||
                setCards.find(c => c.isNegative && c.rarity === 'Négative' && c.normalizedBaseName === card.normalizedBaseName) ||
                setCards.find(c => c.isNegative && c.rarity === 'Négative' && c.category === card.category && cleanVariantName(c.baseName) === cleanVariantName(card.baseName)) ||
                setCards.find(c => c.isNegative && c.rarity === 'Négative' && cleanVariantName(c.baseName) === cleanVariantName(card.baseName));
            if (negMatch) {
                card.negativeCounterpartId = negMatch.id;
            }
        }

        // Vérifier le nombre attendu de cartes classiques + négatives pour ce Set
        for (let i = 1; i <= setCfg.expectedClassic; i++) {
            const expectedId = `${setCfg.number}-${i}`;
            if (!newById.has(expectedId)) missingCards.push(expectedId);
        }
        for (let i = 1; i <= setCfg.expectedNegative; i++) {
            const expectedId = `${setCfg.number}-Ø${i}`;
            if (!newById.has(expectedId)) missingCards.push(expectedId);
        }
    }

    const newPersoCatalog = [];
    const newPersoById = new Map();
    const newPersoByNumValue = new Map();
    const resolvedPersoDir = findSubdir(TCG_ROOT, ['Cartes Perso', 'Cartes perso', 'CartesPerso']) || TCG_PERSO_DIR;
    if (fs.existsSync(resolvedPersoDir)) {
        const persoFiles = fs.readdirSync(resolvedPersoDir)
            .filter(f => !f.startsWith('.'))
            .filter(f => {
                try { return !fs.statSync(path.join(resolvedPersoDir, f)).isDirectory(); } catch { return false; }
            })
            .sort((a, b) => a.localeCompare(b, 'fr', { numeric: true, sensitivity: 'base' }));

        const data = getStoreData();
        if (!data.persoCardRegistry || typeof data.persoCardRegistry !== 'object') {
            data.persoCardRegistry = {};
        }
        const registry = data.persoCardRegistry;
        let registryChanged = false;
        const unnumberedFiles = [];

        for (const file of persoFiles) {
            const fullPath = path.join(resolvedPersoDir, file);
            const parsed = parsePersoCardFilename(file);
            if (!parsed) {
                if (/\.(png|jpe?g|webp)$/i.test(file)) {
                    unnumberedFiles.push(file);
                } else {
                    unrecognizedFiles.push(`TCG/Cartes Perso/${file}`);
                }
                continue;
            }
            parsed.filePath = fullPath;

            if (newPersoByNumValue.has(parsed.numValue)) {
                duplicateCodes.push(`${parsed.id} (${file} vs ${newPersoByNumValue.get(parsed.numValue).filename})`);
                continue;
            }

            const regKey = file.normalize('NFC');
            if (registry[regKey] !== parsed.numValue) {
                registry[regKey] = parsed.numValue;
                registryChanged = true;
            }

            newPersoCatalog.push(parsed);
            newPersoById.set(parsed.id, parsed);
            newPersoByNumValue.set(parsed.numValue, parsed);
        }

        const reservedByOtherUnnumbered = new Set();
        for (const f of unnumberedFiles) {
            const k = f.normalize('NFC');
            const savedNum = Number(registry[k]);
            if (Number.isInteger(savedNum) && savedNum > 0 && !newPersoByNumValue.has(savedNum)) {
                reservedByOtherUnnumbered.add(savedNum);
            }
        }

        for (const file of unnumberedFiles) {
            const fullPath = path.join(resolvedPersoDir, file);
            const regKey = file.normalize('NFC');
            let assignedNum = Number(registry[regKey]);

            if (!Number.isInteger(assignedNum) || assignedNum <= 0 || newPersoByNumValue.has(assignedNum)) {
                assignedNum = 1;
                while (newPersoByNumValue.has(assignedNum) || reservedByOtherUnnumbered.has(assignedNum)) {
                    assignedNum++;
                }
                registry[regKey] = assignedNum;
                reservedByOtherUnnumbered.add(assignedNum);
                registryChanged = true;
            }

            const parsed = parsePersoCardFilename(file, assignedNum);
            if (!parsed) {
                unrecognizedFiles.push(`TCG/Cartes Perso/${file}`);
                continue;
            }
            parsed.filePath = fullPath;

            newPersoCatalog.push(parsed);
            newPersoById.set(parsed.id, parsed);
            newPersoByNumValue.set(parsed.numValue, parsed);
        }

        if (registryChanged) {
            tcgBridge.demanderSauvegarde();
        }
    }
    newPersoCatalog.sort((a, b) => a.numValue - b.numValue);

    newCatalog.sort((a, b) => a.sortIndex - b.sortIndex);
    cardCatalog = newCatalog;
    cardById = newById;
    cardByNumCode = newByNumCode;
    persoCatalog = newPersoCatalog;
    persoById = newPersoById;
    persoByNumValue = newPersoByNumValue;
    proxyRamCache.clear();
    if (proxyRamClearTimer) {
        clearTimeout(proxyRamClearTimer);
        proxyRamClearTimer = null;
    }
    hotBuffers.clear();

    console.log(`🃏 RegaDex ${SET1_NAME} scanné : ${cardCatalog.length}/109 cartes reconnues (+ ${persoCatalog.length} carte(s) perso).`);

    const hasProblem =
        missingAssets.length > 0 ||
        missingCards.length > 0 ||
        unrecognizedFiles.length > 0 ||
        duplicateCodes.length > 0 ||
        orphanHolos.length > 0;

    if (client && hasProblem) {
        const alertChan = await client.channels.fetch(TCG_TEST_CHANNEL_ID).catch(() => null);
        if (alertChan) {
            const lines = [];
            if (missingAssets.length > 0) lines.push(`**🖼️ Assets manquants (${missingAssets.length}) :**\n${missingAssets.map(x => `• \`${x}\``).join('\n')}`);
            if (missingCards.length > 0) lines.push(`**🃏 Cartes manquantes (${missingCards.length}) :**\n\`${missingCards.join('`, `')}\``);
            if (unrecognizedFiles.length > 0) lines.push(`**❓ Fichiers non reconnus (${unrecognizedFiles.length}) :**\n${unrecognizedFiles.slice(0, 15).map(x => `• \`${x}\``).join('\n')}${unrecognizedFiles.length > 15 ? `\n*...et ${unrecognizedFiles.length - 15} autre(s)*` : ''}`);
            if (duplicateCodes.length > 0) lines.push(`**⚠️ Numéros en doublon (${duplicateCodes.length}) :**\n${duplicateCodes.map(x => `• ${x}`).join('\n')}`);
            if (orphanHolos.length > 0) lines.push(`**✨ Holos sans carte de base (${orphanHolos.length}) :**\n${orphanHolos.map(x => `• ${x}`).join('\n')}`);

            const embed = new EmbedBuilder()
                .setColor(0xe74c3c)
                .setTitle('⚠️ Rapport d\'intégrité RegaDex (Démarrage)')
                .setDescription(lines.join('\n\n').slice(0, 4000))
                .setFooter({ text: `Cartes valides chargées : ${cardCatalog.length}/109` })
                .setTimestamp();

            await alertChan.send({ content: `<@${EPSYS_ID}>`, embeds: [embed] }).catch(() => {});
        }
    }

    return {
        total: cardCatalog.length,
        missingAssets,
        missingCards,
        unrecognizedFiles,
        duplicateCodes,
        orphanHolos
    };
}

function getTcgCardsCount() {
    return cardCatalog.length;
}

const MAX_RECENT_OPENINGS = 20;

function recordRecentOpeningTcg(entry) {
    if (!entry || isSandboxId(entry.userId)) return;
    const data = getStoreData();
    data.recentOpenings = data.recentOpenings.filter(o => o.messageId !== entry.messageId);
    data.recentOpenings.unshift(entry);
    if (data.recentOpenings.length > MAX_RECENT_OPENINGS) {
        data.recentOpenings = data.recentOpenings.slice(0, MAX_RECENT_OPENINGS);
    }
    tcgBridge.demanderSauvegarde();
}

function parseRecapEmbedToOpening(msg, guild, botId) {
    if (!msg || msg.author?.id !== botId || !Array.isArray(msg.embeds) || msg.embeds.length === 0) return null;
    const recapEmbed = msg.embeds.find(e =>
        (typeof e?.title === 'string' && e.title.startsWith('📊 Récapitulatif du Booster')) ||
        (typeof e?.title === 'string' && e.title.includes('RÉCAPITULATIF') && e.title.includes('GOD PACK'))
    );
    if (!recapEmbed || !recapEmbed.description) return null;

    const authorTitle = recapEmbed.author?.name || '';
    const mName = authorTitle.match(/^Booster\s+.+?\s+de\s+(.+)$/i);
    const displayName = mName ? mName[1].trim() : 'Membre inconnu';

    let userId = null;
    if (guild?.members?.cache) {
        const lowerName = displayName.toLowerCase();
        const memberMatch = guild.members.cache.find(m =>
            (m.displayName && m.displayName.toLowerCase() === lowerName) ||
            (m.user?.username && m.user.username.toLowerCase() === lowerName)
        );
        if (memberMatch) userId = memberMatch.id;
    }

    const cards = [];
    for (const line of recapEmbed.description.split('\n')) {
        const mCard = line.trim().match(/^\S+\s+\*\*([^*]+)\*\*\s+—\s+\*\*(.+?)\*\*\s+\(\*([^*]+)\*\)\s+•\s+(.+)$/);
        if (mCard) {
            const cardId = mCard[1].trim();
            const catalogCard = cardById.get(cardId);
            cards.push({
                id: cardId,
                name: catalogCard?.name || mCard[2].trim(),
                rarity: catalogCard?.rarity || mCard[3].trim(),
                isHolo: Boolean(catalogCard?.isHolo),
                isNew: mCard[4].includes('Nouvelle')
            });
        }
        if (cards.length >= 5) break;
    }
    if (cards.length === 0) return null;

    const desc = recapEmbed.description;
    return {
        userId,
        displayName,
        channelId: msg.channelId,
        messageId: msg.id,
        timestamp: msg.createdTimestamp,
        isGodPack: Boolean(recapEmbed.title?.includes('GOD PACK') || desc.includes('GOD PACK DÉCROCHÉ')),
        luckyUsed: desc.includes('Booster Chanceux appliqué'),
        pityUsed: desc.includes('Pity appliquée'),
        cards
    };
}

async function backfillRecentOpeningsTcg(client) {
    try {
        if (!client) return;
        const data = getStoreData();
        if (data.recentOpenings.length >= MAX_RECENT_OPENINGS) return;

        const ch = client.channels.cache.get(TCG_CHANNEL_ID)
            || await client.channels.fetch(TCG_CHANNEL_ID).catch(() => null);
        if (!ch) return;

        const guild = ch.guild || client.guilds.cache.get(GUILD_ID) || null;
        const existingIds = new Set(data.recentOpenings.map(o => o.messageId));
        const found = [];

        let beforeId = undefined;
        for (let page = 0; page < 4; page++) {
            const batch = await ch.messages.fetch({ limit: 100, before: beforeId }).catch(() => null);
            if (!batch || batch.size === 0) break;

            for (const msg of batch.values()) {
                if (existingIds.has(msg.id)) continue;
                const parsed = parseRecapEmbedToOpening(msg, guild, client.user.id);
                if (parsed) {
                    found.push(parsed);
                    existingIds.add(msg.id);
                }
            }

            if (data.recentOpenings.length + found.length >= MAX_RECENT_OPENINGS) break;
            beforeId = batch.last()?.id;
            if (!beforeId) break;
        }

        if (found.length > 0) {
            data.recentOpenings = [...data.recentOpenings, ...found]
                .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
                .slice(0, MAX_RECENT_OPENINGS);
            tcgBridge.demanderSauvegarde();
            console.log(`📜 RegaDex : ${found.length} ouverture(s) rétroactive(s) récupérée(s) (${data.recentOpenings.length}/${MAX_RECENT_OPENINGS}).`);
        }
    } catch (err) {
        console.error('Erreur backfillRecentOpeningsTcg:', err);
    }
}

function buildOpenLastListPayload(guild) {
    const data = getStoreData();
    const list = (data.recentOpenings || []).slice(0, MAX_RECENT_OPENINGS);

    if (list.length === 0) {
        const emptyEmbed = new EmbedBuilder()
            .setColor(0x95a5a6)
            .setTitle('📜 20 dernières ouvertures RegaDex')
            .setDescription('*Aucune ouverture enregistrée pour le moment.*');
        return {
            embeds: [emptyEmbed],
            components: [new ActionRowBuilder().addComponents(buildCloseButton(EPSYS_ID))]
        };
    }

    const lines = list.map((o, idx) => {
        const who = o.userId ? `<@${o.userId}>` : `**${o.displayName || 'Inconnu'}**`;
        const ts = Math.floor((o.timestamp || Date.now()) / 1000);
        const cardsShort = (o.cards || []).map(c => {
            const meta = RARITY_META[c.rarity] || RARITY_META['Commune'];
            return `${meta.emoji}\`${c.id}\``;
        }).join(' ');
        const tag = o.isGodPack ? ' 🌟' : (o.pityUsed ? ' ✨' : (o.luckyUsed ? ' 🍀' : ''));
        const jump = (o.channelId && o.messageId)
            ? ` • [Voir](https://discord.com/channels/${GUILD_ID}/${o.channelId}/${o.messageId})`
            : '';
        return `**${idx + 1}.** <t:${ts}:R> — ${who}${tag} ➔ ${cardsShort}${jump}`;
    });

    const embed = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle(`📜 ${list.length} dernière${list.length > 1 ? 's' : ''} ouverture${list.length > 1 ? 's' : ''} RegaDex`)
        .setDescription(
            `${lines.join('\n')}\n\n` +
            `-# Sélectionne une ouverture ci-dessous pour voir le détail exact dans l'ordre d'apparition.`
        )
        .setFooter({ text: 'Commande Epsys-Only • RegaDex TCG' });

    const menu = new StringSelectMenuBuilder()
        .setCustomId(`tcg:ol:sel:${EPSYS_ID}`)
        .setPlaceholder('Inspecter une ouverture en détail...')
        .addOptions(list.map((o, idx) => {
            const member = o.userId ? guild?.members?.cache?.get(o.userId) : null;
            const name = (member?.displayName || o.displayName || 'Inconnu').slice(0, 35);
            const summary = (o.cards || []).map(c => `${c.id} (${c.rarity})`).join(' | ').slice(0, 100);
            const dStr = new Date(o.timestamp || Date.now()).toLocaleTimeString('fr-FR', {
                timeZone: 'Europe/Paris',
                hour: '2-digit',
                minute: '2-digit'
            });
            return {
                label: `#${idx + 1} • ${name} (${dStr})${o.isGodPack ? ' 🌟' : ''}`.slice(0, 100),
                description: summary || 'Détails de l\'ouverture',
                value: String(idx)
            };
        }));

    return {
        embeds: [embed],
        components: [
            new ActionRowBuilder().addComponents(menu),
            new ActionRowBuilder().addComponents(buildCloseButton(EPSYS_ID))
        ]
    };
}

function buildOpenLastDetailPayload(entry, index, guild) {
    const member = entry.userId ? guild?.members?.cache?.get(entry.userId) : null;
    const who = entry.userId ? `<@${entry.userId}> (${member?.displayName || entry.displayName})` : `**${entry.displayName}**`;
    const ts = Math.floor((entry.timestamp || Date.now()) / 1000);

    const totalEntryCards = (entry.cards || []).length || 3;
    const cardLines = (entry.cards || []).map((c, i) => {
        const meta = RARITY_META[c.rarity] || RARITY_META['Commune'];
        const state = c.isNew ? '🆕 Nouvelle' : '🔁 Doublon (+3 pts)';
        return `**Carte ${i + 1}/${totalEntryCards} :** ${meta.emoji} \`${c.id}\` **${c.name}** — *${c.rarity}*${c.isHolo ? ' *(Holo)*' : ''} • ${state}`;
    });

    const tags = [];
    if (totalEntryCards > 3) tags.push(`🎴 Booster ${totalEntryCards} cartes`);
    if (entry.isGodPack) tags.push('🌟 God Pack');
    if (entry.luckyUsed) tags.push('🍀 Chanceux');
    if (entry.pityUsed) tags.push('✨ Pity Rare');

    const jumpLine = (entry.channelId && entry.messageId)
        ? `\n🔗 [Aller au message d'origine](https://discord.com/channels/${GUILD_ID}/${entry.channelId}/${entry.messageId})`
        : '';

    const orderLabel = (entry.cards || []).map((_, i) => `Carte ${i + 1}/${totalEntryCards}`).join(' → ');

    const embed = new EmbedBuilder()
        .setColor(entry.isGodPack ? 0xFFD700 : 0x3498db)
        .setTitle(`🔍 Détail de l'ouverture #${index + 1}`)
        .setDescription(
            `👤 **Joueur :** ${who}\n` +
            `📅 **Date :** <t:${ts}:F> (<t:${ts}:R>)\n` +
            (tags.length > 0 ? `🏷️ **Modificateurs :** ${tags.join(' • ')}\n` : '') +
            jumpLine +
            `\n────────────────────────────────────────\n` +
            cardLines.join('\n')
        )
        .setFooter({ text: `Ordre exact : ${orderLabel}` });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:ol:back:${EPSYS_ID}`)
            .setLabel('Retour à la liste')
            .setEmoji('⬅️')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`tcg:ol:img:${index}:${EPSYS_ID}`)
            .setLabel('Visuel récap')
            .setEmoji('🖼️')
            .setStyle(ButtonStyle.Primary),
        buildCloseButton(EPSYS_ID)
    );

    return { embeds: [embed], components: [row], files: [], attachments: [] };
}

// ==========================================
//   PROFIL JOUEUR, COOLDOWN & NOTIFICATIONS
// ==========================================

const TCGX_SANDBOX_ID = 'tcgx_epsys';
let tcgxSandboxUser = null;

function isSandboxId(id) {
    return id === TCGX_SANDBOX_ID;
}

function canControlTcgOwner(interactionUserId, ownerId) {
    if (isSandboxId(ownerId)) return interactionUserId === EPSYS_ID;
    return interactionUserId === ownerId;
}

function buildTcgMemberProxy(realMember, userId) {
    if (!isSandboxId(userId)) return realMember;
    const baseName = realMember?.displayName || realMember?.user?.username || 'Epsys';
    return {
        id: TCGX_SANDBOX_ID,
        displayName: `${baseName} [MODE TEST !tcgx]`,
        username: realMember?.user?.username || 'Epsys',
        user: realMember?.user || realMember,
        displayAvatarURL: (opts) => (realMember?.user || realMember)?.displayAvatarURL?.(opts) || null,
        roles: realMember?.roles
    };
}

function getOrCreateTcgxSandbox(forceReset = false) {
    if (!tcgxSandboxUser || forceReset) {
        const cards = {};
        for (const c of cardCatalog) {
            cards[c.id] = 5;
        }
        tcgxSandboxUser = {
            points: 999999,
            msgProgress: 0,
            vocalMinutes: 0,
            cards,
            freeBoosters: MAX_FREE_BOOSTERS,
            lastFreeRechargeAt: Date.now(),
            currentRechargeMs: BOOSTER_COOLDOWN_MS,
            inventory: {
                booster: 999,
                weeklyBooster: 2,
                communityBooster: 2,
                masterBooster: 2,
                luckyBooster: 99,
                holoTransform: 99,
                halfCooldown: 99,
                godPackBoost: 99
            },
            activeBonuses: {
                luckyBooster: false,
                halfCooldown: false,
                godPackBoostUntil: 0
            },
            pityRare: false,
            theme: 'B',
            notifFreq: 'each',
            favoriteCardId: cardCatalog[0]?.id || null,
            wishlist: [],
            completionMilestones: {}, // [SET 2] Clés par numéro de set ('1', '2'...)
            masteredSets: { '1': Date.now() },
            stats: {
                boostersOpened: 0,
                boostersBySet: { '1': 0 },
                tradesCompleted: 0,
                duplicatesObtained: 0
            }
        };
    } else {
        for (const c of cardCatalog) {
            if ((tcgxSandboxUser.cards[c.id] || 0) < 1) {
                tcgxSandboxUser.cards[c.id] = 5;
            }
        }
        if (tcgxSandboxUser.points < 900000) tcgxSandboxUser.points = 999999;
        if ((tcgxSandboxUser.inventory?.booster || 0) < 50) tcgxSandboxUser.inventory.booster = 999;
        if (!Array.isArray(tcgxSandboxUser.wishlist)) tcgxSandboxUser.wishlist = [];
        if (!tcgxSandboxUser.completionMilestones) tcgxSandboxUser.completionMilestones = {};
        if (!tcgxSandboxUser.masteredSets) tcgxSandboxUser.masteredSets = { '1': Date.now() };
        if (!tcgxSandboxUser.stats.boostersBySet) tcgxSandboxUser.stats.boostersBySet = { '1': tcgxSandboxUser.stats.boostersOpened || 0 };
    }
    return tcgxSandboxUser;
}

function getOrCreateTcgUser(userId) {
    if (isSandboxId(userId)) {
        return getOrCreateTcgxSandbox(false);
    }
    const data = getStoreData();
    if (!data.users[userId]) {
        data.users[userId] = {
            points: 0,
            msgProgress: 0,
            vocalMinutes: 0,
            cards: {},
            freeBoosters: 1, // 1er booster prêt à l'arrivée dans le TCG
            lastFreeRechargeAt: Date.now(),
            currentRechargeMs: BOOSTER_COOLDOWN_MS,
            inventory: {
                booster: 0,
                weeklyBooster: 0,
                communityBooster: 0,
                masterBooster: 0,
                fiveCardBooster: 0,
                luckyBooster: 0,
                holoTransform: 0,
                negativeTransform: 0,
                halfCooldown: 0,
                godPackBoost: 0
            },
            activeBonuses: {
                luckyBooster: false,
                halfCooldown: false,
                godPackBoostUntil: 0
            },
            pityRare: false,
            theme: 'B',
            notifFreq: 'each',
            favoriteCardId: null,
            wishlist: [],
            completionMilestones: {}, // [SET 2] Clés par numéro de set ('1', '2'...)
            masteredSets: {},
            stats: {
                boostersOpened: 0,
                tradesCompleted: 0,
                duplicatesObtained: 0
            }
        };
    }

    const u = data.users[userId];
    if (typeof u.points !== 'number') u.points = 0;
    if (typeof u.msgProgress !== 'number') u.msgProgress = 0;
    if (typeof u.vocalMinutes !== 'number') u.vocalMinutes = 0;
    if (!u.cards) u.cards = {};
    if (typeof u.freeBoosters !== 'number') u.freeBoosters = 1;
    if (!u.lastFreeRechargeAt) u.lastFreeRechargeAt = Date.now();
    if (!u.currentRechargeMs) u.currentRechargeMs = BOOSTER_COOLDOWN_MS;
    if (!u.inventory) u.inventory = { booster: 0, fiveCardBooster: 0, weeklyBooster: 0, communityBooster: 0, masterBooster: 0, luckyBooster: 0, holoTransform: 0, negativeTransform: 0, halfCooldown: 0, godPackBoost: 0 };
    if (typeof u.inventory.weeklyBooster !== 'number') u.inventory.weeklyBooster = 0;
    if (u.inventory.weeklyBooster > MAX_WEEKLY_BOOSTERS) u.inventory.weeklyBooster = MAX_WEEKLY_BOOSTERS;
    if (typeof u.inventory.communityBooster !== 'number') u.inventory.communityBooster = 0;
    if (u.inventory.communityBooster > MAX_COMMUNITY_BOOSTERS) u.inventory.communityBooster = MAX_COMMUNITY_BOOSTERS;
    if (typeof u.inventory.masterBooster !== 'number') u.inventory.masterBooster = 0;
    if (typeof u.inventory.fiveCardBooster !== 'number') u.inventory.fiveCardBooster = 0;
    if (typeof u.inventory.negativeTransform !== 'number') u.inventory.negativeTransform = 0;
    if (typeof u.inventory.godPackBoost !== 'number') u.inventory.godPackBoost = 0;
    if (!u.activeBonuses) u.activeBonuses = { luckyBooster: false, halfCooldown: false, godPackBoostUntil: 0 };
    if (typeof u.activeBonuses.godPackBoostUntil !== 'number') u.activeBonuses.godPackBoostUntil = 0;
    if (typeof u.pityRare !== 'boolean') u.pityRare = false;
    if (u.theme !== 'W' && u.theme !== 'B') u.theme = 'B';
    if (u.notifFreq !== 'each' && u.notifFreq !== 'full') u.notifFreq = 'each';
    if (!Array.isArray(u.wishlist)) u.wishlist = [];
    if (!u.completionMilestones || typeof u.completionMilestones !== 'object') u.completionMilestones = {};
    if (!u.masteredSets || typeof u.masteredSets !== 'object') u.masteredSets = {};
    if (!u.stats) u.stats = { boostersOpened: 0, boostersBySet: {}, tradesCompleted: 0, duplicatesObtained: 0 };
    if (!u.stats.boostersBySet || typeof u.stats.boostersBySet !== 'object') {
        u.stats.boostersBySet = {};
        if ((u.stats.boostersOpened || 0) > 0) {
            u.stats.boostersBySet['1'] = u.stats.boostersOpened;
        }
    }

    syncFreeBoosters(u);
    return u;
}

function syncFreeBoosters(u) {
    const now = Date.now();
    if (u.freeBoosters >= MAX_FREE_BOOSTERS) {
        u.freeBoosters = MAX_FREE_BOOSTERS;
        u.lastFreeRechargeAt = now;
        u.currentRechargeMs = BOOSTER_COOLDOWN_MS;
        return;
    }

    const stepMs = u.currentRechargeMs || BOOSTER_COOLDOWN_MS;
    let elapsed = now - (u.lastFreeRechargeAt || now);

    if (elapsed >= stepMs) {
        u.freeBoosters += 1;
        u.lastFreeRechargeAt += stepMs;
        u.currentRechargeMs = BOOSTER_COOLDOWN_MS;
        elapsed = now - u.lastFreeRechargeAt;

        if (u.freeBoosters < MAX_FREE_BOOSTERS && elapsed >= BOOSTER_COOLDOWN_MS) {
            const extra = Math.floor(elapsed / BOOSTER_COOLDOWN_MS);
            u.freeBoosters = Math.min(MAX_FREE_BOOSTERS, u.freeBoosters + extra);
            u.lastFreeRechargeAt += extra * BOOSTER_COOLDOWN_MS;
        }
    }

    if (u.freeBoosters >= MAX_FREE_BOOSTERS) {
        u.freeBoosters = MAX_FREE_BOOSTERS;
        u.lastFreeRechargeAt = now;
        u.currentRechargeMs = BOOSTER_COOLDOWN_MS;
    }
}

function getNextBoosterTimestamp(u) {
    syncFreeBoosters(u);
    if (u.freeBoosters >= MAX_FREE_BOOSTERS) return null;
    const stepMs = u.currentRechargeMs || BOOSTER_COOLDOWN_MS;
    return (u.lastFreeRechargeAt || Date.now()) + stepMs;
}

function getFullBoosterTimestamp(u) {
    const nextTs = getNextBoosterTimestamp(u);
    if (!nextTs) return null;
    if (u.freeBoosters === 0) return nextTs + BOOSTER_COOLDOWN_MS;
    return nextTs;
}

function getTotalAvailableBoosters(u) {
    syncFreeBoosters(u);
    return (u.freeBoosters || 0)
        + (u.inventory?.weeklyBooster || 0)
        + (u.inventory?.communityBooster || 0)
        + (u.inventory?.masterBooster || 0)
        + (u.inventory?.booster || 0);
}

function getCurrentQuestWeekInfoParis() {
    const now = new Date();
    const parisNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    const mondayParis = new Date(parisNow.getTime());

    if (mondayParis.getDay() === 1 && mondayParis.getHours() < 8) {
        mondayParis.setDate(mondayParis.getDate() - 7);
    } else {
        const day = mondayParis.getDay();
        const diffToMonday = day === 0 ? -6 : (1 - day);
        mondayParis.setDate(mondayParis.getDate() + diffToMonday);
    }
    mondayParis.setHours(8, 0, 0, 0);

    const yyyy = mondayParis.getFullYear();
    const mm = String(mondayParis.getMonth() + 1).padStart(2, '0');
    const dd = String(mondayParis.getDate()).padStart(2, '0');
    const weekKey = `${yyyy}-${mm}-${dd}`;

    const nextMonday = new Date(mondayParis.getTime());
    nextMonday.setDate(nextMonday.getDate() + 7);
    const nextResetTs = Math.floor((Date.now() + (nextMonday.getTime() - parisNow.getTime())) / 1000);
    return { weekKey, nextResetTs, parisNow };
}

function getOrEnsureCommunityQuest() {
    const data = getStoreData();
    const { weekKey } = getCurrentQuestWeekInfoParis();
    if (!data.communityQuest || data.communityQuest.weekKey !== weekKey) {
        const prevType = data.communityQuest?.type || null;
        const candidates = COMMUNITY_QUEST_POOL.filter(q => q.type !== prevType);
        const picked = candidates[Math.floor(Math.random() * candidates.length)] || COMMUNITY_QUEST_POOL[0];
        data.communityQuest = {
            weekKey,
            type: picked.type,
            target: picked.target,
            label: picked.label,
            progress: 0,
            completed: false,
            completedAt: null,
            participants: []
        };
        tcgBridge.demanderSauvegarde();
    }
    if (!Array.isArray(data.communityQuest.participants)) {
        data.communityQuest.participants = [];
    }
    return data.communityQuest;
}

async function verifierQueteCommunautaireTcg(client) {
    try {
        const data = getStoreData();
        const { weekKey, nextResetTs, parisNow } = getCurrentQuestWeekInfoParis();
        const prevQuest = data.communityQuest;
        if (prevQuest && prevQuest.weekKey === weekKey) return false;

        const shouldAnnounce = Boolean(prevQuest) || (parisNow.getDay() === 1 && parisNow.getHours() === 8);
        const quest = getOrEnsureCommunityQuest();
        await tcgBridge.saveAll().catch(() => tcgBridge.demanderSauvegarde());

        if (shouldAnnounce && client) {
            const tcgChan = client.channels.cache.get(TCG_CHANNEL_ID)
                || await client.channels.fetch(TCG_CHANNEL_ID).catch(() => null);
            if (tcgChan) {
                const embed = new EmbedBuilder()
                    .setColor(0x3498db)
                    .setTitle('🤝 Nouvelle Quête Communautaire de la semaine !')
                    .setDescription(
                        `Une nouvelle semaine RegaDex commence !\n\n` +
                        `🎯 **Objectif :** ${quest.label}\n` +
                        `🎁 **Récompense collective :** **2 boosters communautaires** *(stock max 2)* + **15 pts RegaDex**\n` +
                        `👥 **Comment être éligible :** ouvre au moins **1 booster** pendant que la quête est encore en cours !\n` +
                        `⏳ **Réinitialisation :** <t:${nextResetTs}:R>`
                    )
                    .setFooter({ text: `RegaDex ${SET1_NAME} • Quête du lundi 8h` })
                    .setTimestamp();
                await sendSilent(tcgChan, { embeds: [embed] }).catch(() => {});
            }
        }
        return true;
    } catch (err) {
        console.error('Erreur verifierQueteCommunautaireTcg:', err);
        return false;
    }
}

async function progressCommunityQuest(client, events, boosterOpenerId = null) {
    const quest = getOrEnsureCommunityQuest();
    if (quest.completed) return false;

    let modified = false;
    if (boosterOpenerId && !isSandboxId(boosterOpenerId)) {
        if (!quest.participants.includes(boosterOpenerId)) {
            quest.participants.push(boosterOpenerId);
            modified = true;
        }
    }

    for (const ev of (events || [])) {
        if (quest.type === ev.type && ev.amount > 0) {
            quest.progress = Math.min(quest.target, (quest.progress || 0) + ev.amount);
            modified = true;
        }
    }

    if (quest.progress >= quest.target && !quest.completed) {
        quest.completed = true;
        quest.completedAt = Date.now();
        modified = true;

        for (const uid of quest.participants) {
            const u = getOrCreateTcgUser(uid);
            u.points = (u.points || 0) + 15;
            u.inventory.communityBooster = Math.min(MAX_COMMUNITY_BOOSTERS, (u.inventory.communityBooster || 0) + 2);
        }

        tcgBridge.demanderSauvegarde();

        const c = client || tcgBridge.client;
        const tcgChan = c
            ? (c.channels.cache.get(TCG_CHANNEL_ID) || await c.channels.fetch(TCG_CHANNEL_ID).catch(() => null))
            : null;
        if (tcgChan) {
            const mentionsList = quest.participants.length > 0
                ? quest.participants.map(id => `<@${id}>`).join(' ')
                : '*Aucun·e participant.e*';
            const { nextResetTs } = getCurrentQuestWeekInfoParis();
            const embed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle('🎉 QUÊTE COMMUNAUTAIRE TERMINÉE !')
                .setDescription(
                    `Bravo la team ! L'objectif de la semaine a été atteint : ${quest.label} (**${quest.progress}/${quest.target}**)\n\n` +
                    `🎁 **Récompenses distribuées à tous les participant.es :**\n` +
                    `• **+2 Boosters communautaires** *(prêts à ouvrir, stock max ${MAX_COMMUNITY_BOOSTERS})*\n` +
                    `• **+15 points RegaDex**\n\n` +
                    `⏳ Prochaine quête communautaire : <t:${nextResetTs}:R>`
                )
                .setFooter({ text: `RegaDex ${SET1_NAME} • Quête communautaire` })
                .setTimestamp();

            await tcgChan.send({
                content: `🎊 Félicitations aux participant.es : ${mentionsList}`,
                embeds: [embed],
                allowedMentions: { users: quest.participants }
            }).catch(() => {});
        }
        tcgBridge.declencherHappyHourRoulette?.(30, `Quête communautaire RegaDex terminée (${quest.label.replace(/\*\*/g, '')})`, c);
        return true;
    }

    if (modified) tcgBridge.demanderSauvegarde();
    return false;
}

async function verifierBoosterHebdoTcg(client) {
    try {
        const now = new Date();
        const paris = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
        // Tous les vendredis à partir de 8h00 (fenêtre 8h00 -> 8h59 Paris)
        if (paris.getDay() !== 5 || paris.getHours() !== 8) return false;

        const yyyy = paris.getFullYear();
        const mm = String(paris.getMonth() + 1).padStart(2, '0');
        const dd = String(paris.getDate()).padStart(2, '0');
        const fridayKey = `${yyyy}-${mm}-${dd}`;

        const data = getStoreData();
        if (data.lastWeeklyBoosterKey === fridayKey) return false;
        data.lastWeeklyBoosterKey = fridayKey;

        const guild = client.guilds.cache.get(GUILD_ID) || await client.guilds.fetch(GUILD_ID).catch(() => null);
        if (!guild) return false;

        await guild.members.fetch().catch(() => {});
        const targets = [...guild.members.cache.values()].filter(m => !m.user.bot && hasTcgRole(m));

        let credited = 0;
        let capped = 0;
        for (const m of targets) {
            const u = getOrCreateTcgUser(m.id);
            if ((u.inventory.weeklyBooster || 0) < MAX_WEEKLY_BOOSTERS) {
                u.inventory.weeklyBooster = (u.inventory.weeklyBooster || 0) + 1;
                credited++;
            } else {
                capped++;
            }
        }

        await tcgBridge.saveAll().catch(() => tcgBridge.demanderSauvegarde());

        const tcgChan = client.channels.cache.get(TCG_CHANNEL_ID)
            || await client.channels.fetch(TCG_CHANNEL_ID).catch(() => null);
        if (tcgChan) {
            const embed = new EmbedBuilder()
                .setColor(0xf1c40f)
                .setTitle('📅 Booster hebdomadaire du vendredi offert !')
                .setDescription(
                    `Bon vendredi les collectionneur·euses ! ☀️\n` +
                    `**+1 Booster gratuit hebdomadaire** vient d'être ajouté à tes boosters prêts à ouvrir !\n\n` +
                    `• 🎁 **Bénéficiaires :** **${credited}** membre${credited > 1 ? 's' : ''} crédité${credited > 1 ? 's' : ''}` +
                    (capped > 0 ? ` *(${capped} déjà au plafond de ${MAX_WEEKLY_BOOSTERS}/${MAX_WEEKLY_BOOSTERS})*` : '') + `\n` +
                    `• 📦 **Stock hebdo max :** **${MAX_WEEKLY_BOOSTERS}/${MAX_WEEKLY_BOOSTERS}** *(pense à ouvrir tes boosters avant vendredi prochain pour ne pas bloquer le suivant !)*\n\n` +
                    `👉 Tape \`!tcggo\` ou \`!open\` pour l'ouvrir !`
                )
                .setFooter({ text: `RegaDex ${SET1_NAME} • Bonus du vendredi 8h` })
                .setTimestamp();

            await tcgChan.send({
                content: `<@&${TCG_ROLE_ID}>`,
                embeds: [embed],
                allowedMentions: { roles: [TCG_ROLE_ID] }
            }).catch(() => {});
        }
        return true;
    } catch (err) {
        console.error('Erreur verifierBoosterHebdoTcg:', err);
        return false;
    }
}

function armerNotifBooster(userId, client) {
    if (notifTimers.has(userId)) {
        clearTimeout(notifTimers.get(userId));
        notifTimers.delete(userId);
    }

    const data = getStoreData();
    const notif = data.notifs?.[userId];
    if (!notif) return;

    const u = getOrCreateTcgUser(userId);
    const freq = (notif.frequency === 'full' || (!notif.frequency && u.notifFreq === 'full')) ? 'full' : 'each';
    notif.frequency = freq;

    const nextAt = getNextBoosterTimestamp(u);
    if (!nextAt) {
        // Choix permanent conservé même lorsque le stock est plein (2/2)
        notif.notifyAt = null;
        notif.armedAtFreeCount = u.freeBoosters;
        tcgBridge.demanderSauvegarde();
        return;
    }

    notif.notifyAt = freq === 'full' ? getFullBoosterTimestamp(u) : nextAt;
    notif.armedAtFreeCount = u.freeBoosters;

    const delay = Math.max(1000, nextAt - Date.now());
    const safeDelay = Math.min(delay, 2147483000);

    const timer = setTimeout(async () => {
        notifTimers.delete(userId);
        const latestData = getStoreData();
        const latestNotif = latestData.notifs?.[userId];
        if (!latestNotif) return;

        const userObj = getOrCreateTcgUser(userId);
        const currentFreq = latestNotif.frequency === 'full' ? 'full' : 'each';

        if (currentFreq === 'full') {
            if (userObj.freeBoosters < MAX_FREE_BOOSTERS && getNextBoosterTimestamp(userObj)) {
                return armerNotifBooster(userId, client);
            }
            latestNotif.notifyAt = null;
            latestNotif.armedAtFreeCount = userObj.freeBoosters;
            tcgBridge.demanderSauvegarde();
        } else {
            if (userObj.freeBoosters <= (latestNotif.armedAtFreeCount ?? 0) && getNextBoosterTimestamp(userObj)) {
                return armerNotifBooster(userId, client);
            }
            if (userObj.freeBoosters < MAX_FREE_BOOSTERS && getNextBoosterTimestamp(userObj)) {
                armerNotifBooster(userId, client);
            } else {
                latestNotif.notifyAt = null;
                latestNotif.armedAtFreeCount = userObj.freeBoosters;
                tcgBridge.demanderSauvegarde();
            }
        }

        try {
            const c = client || tcgBridge.client;
            if (!c) return;
            const notifEmbed = new EmbedBuilder()
                .setColor(0xf1c40f)
                .setTitle('🃏 Booster gratuit RegaDex disponible !')
                .setDescription(
                    `Ton **Booster gratuit ${SET1_NAME}** est prêt !\n` +
                    `Stock gratuit actuel : **${userObj.freeBoosters}/${MAX_FREE_BOOSTERS}**\n\n` +
                    `👉 Tu peux taper \`!tcg\` ou \`!open\`, ou cliquer directement sur **🎁 Ouvrir le booster** ci-dessous.\n` +
                    `*(Sinon, tu peux aussi le garder au chaud dans ton inventaire jusqu'à **2/2** max !)*`
                );

            const channelRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`tcg:open:${userId}`)
                    .setLabel('Ouvrir le booster')
                    .setEmoji('🎁')
                    .setStyle(ButtonStyle.Success),
                buildAccueilButton(userId),
                buildCloseButton(userId)
            );

            if (latestNotif.mode === 'dm') {
                const dmEmbed = new EmbedBuilder()
                    .setColor(0xf1c40f)
                    .setTitle('🃏 Booster gratuit RegaDex disponible !')
                    .setDescription(
                        `Ton **Booster gratuit ${SET1_NAME}** est prêt dans <#${TCG_CHANNEL_ID}> !\n` +
                        `Stock gratuit actuel : **${userObj.freeBoosters}/${MAX_FREE_BOOSTERS}**\n\n` +
                        `👉 Rejoins le salon <#${TCG_CHANNEL_ID}> et fais \`!tcg\` ou \`!open\` pour l'ouvrir, ou garde-le au chaud dans ton stock !`
                    );
                const dmRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setLabel('Aller ouvrir dans #tcg')
                        .setEmoji('📍')
                        .setStyle(ButtonStyle.Link)
                        .setURL(`https://discord.com/channels/${GUILD_ID}/${TCG_CHANNEL_ID}`)
                );

                const user = await c.users.fetch(userId).catch(() => null);
                let dmOk = false;
                if (user) {
                    dmOk = await user.send({ embeds: [dmEmbed], components: [dmRow] }).then(() => true).catch(() => false);
                }
                if (!dmOk) {
                    const fallbackCh = await c.channels.fetch(latestNotif.channelId || TCG_CHANNEL_ID).catch(() => null);
                    if (fallbackCh) {
                        await fallbackCh.send({
                            content: `<@${userId}> *(Tes MP Discord étant fermés, je te préviens ici)*`,
                            embeds: [notifEmbed],
                            components: [channelRow]
                        }).catch(() => {});
                    }
                }
            } else {
                const ch = await c.channels.fetch(latestNotif.channelId || TCG_CHANNEL_ID).catch(() => null);
                if (ch) {
                    await ch.send({
                        content: `<@${userId}>`,
                        embeds: [notifEmbed],
                        components: [channelRow]
                    }).catch(() => {});
                }
            }
        } catch {}
    }, safeDelay);

    notifTimers.set(userId, timer);
}

function restaurerNotifsTcg(client) {
    const data = getStoreData();
    if (!data.notifs) return;
    for (const uid of Object.keys(data.notifs)) {
        armerNotifBooster(uid, client);
    }
}

async function disableNotifButtonsOnMessage(message) {
    if (!message || !Array.isArray(message.components) || message.components.length === 0) return;
    let modified = false;
    const updatedRows = message.components.map(row => {
        const newRow = new ActionRowBuilder();
        for (const comp of row.components) {
            const json = comp.toJSON();
            if (json.custom_id && (json.custom_id.startsWith('tcg:notif:here:') || json.custom_id.startsWith('tcg:notif:dm:'))) {
                json.disabled = true;
                modified = true;
            }
            newRow.addComponents(ButtonBuilder.from(json));
        }
        return newRow;
    });
    if (modified) {
        await message.edit({ components: updatedRows }).catch(() => {});
    }
}

// ==========================================
//   GAINS DE POINTS REGADEX (MSG / VOCAL / RLT)
// ==========================================

function trackTcgMessagePoint(userId, member) {
    if (!member?.roles?.cache?.has(TCG_ROLE_ID)) return;
    const u = getOrCreateTcgUser(userId);
    u.msgProgress = (u.msgProgress || 0) + 1;
    if (u.msgProgress >= MESSAGES_PER_POINT) {
        u.msgProgress = 0;
        u.points += 1;
    }
}

function trackTcgVocalMinute(userId, member, voiceChannelId) {
    if (!voiceChannelId || voiceChannelId === AFK_VOCAL_CHANNEL_ID) return;
    if (!member?.roles?.cache?.has(TCG_ROLE_ID)) return;
    const u = getOrCreateTcgUser(userId);
    u.vocalMinutes = (u.vocalMinutes || 0) + 1;
    if (u.vocalMinutes >= VOCAL_MINUTES_PER_POINT) {
        u.vocalMinutes = 0;
        u.points += 1;
    }
}

function trackTcgRoulettePoint(userId, member) {
    if (!member?.roles?.cache?.has(TCG_ROLE_ID)) return;
    const u = getOrCreateTcgUser(userId);
    u.points += 1;
    tcgBridge.demanderSauvegarde();
}

// ==========================================
//   CONTRÔLES D'ACCÈS & RÉSOLUTION MEMBRE/CARTE
// ==========================================

function hasTcgRole(member) {
    if (!member) return false;
    return member.roles?.cache?.has(TCG_ROLE_ID) || false;
}

function isAllowedTcgChannel(channel) {
    if (!channel) return false;
    if (channel.id === TCG_CHANNEL_ID || channel.id === TCG_TEST_CHANNEL_ID) return true;
    if (channel.isThread && channel.isThread() && (channel.parentId === TCG_CHANNEL_ID || channel.parentId === TCG_TEST_CHANNEL_ID)) {
        return true;
    }
    return false;
}

function isAllowedFlexChannel(channel) {
    if (!channel) return false;
    if (isAllowedTcgChannel(channel)) return true;
    if (channel.id === SHITPOST_CHANNEL_ID) return true;
    if (channel.isThread && channel.isThread() && channel.parentId === SHITPOST_CHANNEL_ID) {
        return true;
    }
    return false;
}

function getUserCompletionStats(u, setNumber = null) {
    const list = getSetCatalog(setNumber);
    const setCfg = getSetConfig(setNumber || DEFAULT_SET_NUMBER);
    let uniqueCount = 0;
    let totalCopies = 0;
    const byCategory = {
        'Items': { owned: 0, total: 0 },
        'Personnages': { owned: 0, total: 0 },
        'Références': { owned: 0, total: 0 }
    };

    for (const c of list) {
        if (byCategory[c.category]) byCategory[c.category].total++;
        const q = u.cards?.[c.id] || 0;
        if (q > 0) {
            uniqueCount++;
            totalCopies += q;
            if (byCategory[c.category]) byCategory[c.category].owned++;
        }
    }
    const fallbackTotal = setNumber
        ? setCfg.totalExpected
        : getActiveSets().reduce((acc, s) => acc + s.totalExpected, 0);
    return { uniqueCount, totalCopies, totalSet: list.length || fallbackTotal, byCategory };
}

function checkAndGrantCompletionMilestones(userId, setNumber = DEFAULT_SET_NUMBER) {
    if (isSandboxId(userId)) return { unlocked: [], totalBonusPts: 0, masteredSets: [] };
    const u = getOrCreateTcgUser(userId);
    const comp = getUserCompletionStats(u, setNumber);
    if (!comp.totalSet || comp.totalSet <= 0) return { unlocked: [], totalBonusPts: 0, masteredSets: [] };

    const setKey = String(setNumber);
    if (!u.completionMilestones || typeof u.completionMilestones !== 'object') {
        u.completionMilestones = {};
    }
    if (!Array.isArray(u.completionMilestones[setKey])) {
        u.completionMilestones[setKey] = [];
    }
    if (!u.masteredSets || typeof u.masteredSets !== 'object') {
        u.masteredSets = {};
    }

    const setCfg = getSetConfig(setNumber);
    const exactPct = (comp.uniqueCount / comp.totalSet) * 100;
    const unlocked = [];
    const masteredSets = [];
    let totalBonusPts = 0;

    for (const m of COMPLETION_MILESTONES) {
        const reached = m.pct === 100 ? (comp.uniqueCount >= comp.totalSet) : (exactPct >= m.pct);
        if (reached && !u.completionMilestones[setKey].includes(m.pct)) {
            u.completionMilestones[setKey].push(m.pct);
            u.points = (u.points || 0) + m.reward;
            totalBonusPts += m.reward;
            unlocked.push({ pct: m.pct, reward: m.reward, setNumber, setName: setCfg.name });

            if (m.pct === 100 && !u.masteredSets[setKey]) {
                u.masteredSets[setKey] = Date.now();
                u.inventory.masterBooster = (u.inventory.masterBooster || 0) + 2;
                masteredSets.push(setNumber);
            }
        }
    }

    if (unlocked.length > 0) {
        tcgBridge.demanderSauvegarde();
    }
    return { unlocked, totalBonusPts, masteredSets };
}

function getCardDuplicateOwners(cardId, excludeUserId = null) {
    const data = getStoreData();
    const owners = [];
    for (const [uid, u] of Object.entries(data.users || {})) {
        if (isSandboxId(uid) || uid === excludeUserId) continue;
        const qty = u?.cards?.[cardId] || 0;
        if (qty >= 2) {
            owners.push({ uid, qty, extra: qty - 1 });
        }
    }
    owners.sort((a, b) => b.qty - a.qty);
    return owners;
}

function getSanitizedWishlist(u) {
    if (!Array.isArray(u?.wishlist)) return [];
    const seen = new Set();
    const valid = [];
    for (const id of u.wishlist) {
        if (cardById.has(id) && !seen.has(id)) {
            seen.add(id);
            valid.push(id);
            if (valid.length >= MAX_WISHLIST) break;
        }
    }
    return valid;
}

function resolveCardQuery(rawQuery, preferredSetNumber = null) {
    if (!rawQuery) return { card: null, matches: [], isCodeQuery: false };
    const q = String(rawQuery).trim();
    if (!q) return { card: null, matches: [], isCodeQuery: false };

    const cleaned = q.replace(/^#/, '').trim();

    // 0. Format Carte Perso : Spé-01, Spe-1, Spé 01
    const persoMatch = cleaned.match(/^sp[eé]\s*[-]?\s*(\d+)$/iu);
    if (persoMatch) {
        const rawDigits = persoMatch[1];
        const numVal = parseInt(rawDigits, 10);
        const exactPerso = persoCatalog.find(c => c.id.toLowerCase() === `spé-${rawDigits}`.toLowerCase())
            || persoByNumValue.get(numVal)
            || null;
        if (exactPerso) return { card: exactPerso, matches: [exactPerso], isCodeQuery: true };
        return { card: null, matches: [], isCodeQuery: true };
    }

    // 1. Format explicite 1-48, 2-48, 1-Ø12, Ø12, 48 ([SET 2] multi-sets)
    const codeMatch = cleaned.match(/^(?:(?:set\s*)?(\d+)\s*[-\s]\s*)?(Ø|O)?\s*(\d+)$/iu);
    if (codeMatch) {
        const explicitSet = codeMatch[1] ? parseInt(codeMatch[1], 10) : null;
        const isNeg = Boolean(codeMatch[2]);
        const num = parseInt(codeMatch[3], 10);
        const numKey = isNeg ? `Ø${num}` : `${num}`;

        if (explicitSet !== null) {
            const fullId = `${explicitSet}-${numKey}`.toUpperCase();
            const found = cardByNumCode.get(fullId) || cardById.get(`${explicitSet}-${numKey}`);
            if (found) return { card: found, matches: [found], isCodeQuery: true };
        } else {
            const codeMatches = cardCatalog.filter(c => c.numCode.toUpperCase() === numKey.toUpperCase());
            if (codeMatches.length === 1) {
                return { card: codeMatches[0], matches: codeMatches, isCodeQuery: true };
            }
            if (codeMatches.length > 1) {
                if (preferredSetNumber) {
                    const pref = codeMatches.find(c => (c.setNumber || 1) === preferredSetNumber);
                    if (pref) return { card: pref, matches: codeMatches, isCodeQuery: true };
                }
                return { card: null, matches: codeMatches, isCodeQuery: true };
            }
        }
    }

    // 2. Recherche intelligente par nom + modificateurs optionnels (rareté, holo, set)
    const normQ = normalizeText(q);
    if (!normQ) return { card: null, matches: [], isCodeQuery: false };
    const allSearchable = [...cardCatalog, ...persoCatalog];

    // 2a. Correspondance exacte brute avant extraction des mots-clés
    const rawExact = allSearchable.filter(c =>
        c.normalizedName === normQ ||
        c.normalizedDisplayName === normQ ||
        c.normalizedBaseName === normQ
    );
    if (rawExact.length === 1) return { card: rawExact[0], matches: rawExact, isCodeQuery: false };
    if (rawExact.length > 1) return { card: null, matches: rawExact, isCodeQuery: false };

    // 2b. Extraction des mots-clés de rareté / holo / set ("epsys full art", "tasty crousty full art", etc.)
    let stripped = ` ${normQ} `;
    let wantedRarity = null;
    let wantedHolo = null;
    let wantedPerso = false;
    let wantedSet = null;

    const setInText = stripped.match(/\bset\s*(\d+)\b/);
    if (setInText) {
        wantedSet = parseInt(setInText[1], 10);
        stripped = stripped.replace(/\bset\s*\d+\b/g, ' ');
    }

    if (/\b(?:full\s*arts?|fullart|fa)\b/.test(stripped)) {
        wantedRarity = 'Full Art';
        stripped = stripped.replace(/\b(?:full\s*arts?|fullart|fa)\b/g, ' ');
    } else if (/\b(?:negatives?|neg)\b/.test(stripped)) {
        wantedRarity = 'Négative';
        stripped = stripped.replace(/\b(?:negatives?|neg)\b/g, ' ');
    } else if (/\b(?:legendaires?|leg)\b/.test(stripped)) {
        wantedRarity = 'Légendaire';
        stripped = stripped.replace(/\b(?:legendaires?|leg)\b/g, ' ');
    } else if (/\b(?:epiques?|epic)\b/.test(stripped)) {
        wantedRarity = 'Épique';
        stripped = stripped.replace(/\b(?:epiques?|epic)\b/g, ' ');
    } else if (/\b(?:rares?)\b/.test(stripped)) {
        wantedRarity = 'Rare';
        stripped = stripped.replace(/\b(?:rares?)\b/g, ' ');
    } else if (/\b(?:communes?|commons?)\b/.test(stripped)) {
        wantedRarity = 'Commune';
        stripped = stripped.replace(/\b(?:communes?|commons?)\b/g, ' ');
    } else if (/\b(?:personnalisees?|perso|speciales?)\b/.test(stripped)) {
        wantedPerso = true;
        stripped = stripped.replace(/\b(?:personnalisees?|perso|speciales?)\b/g, ' ');
    }

    if (/\b(?:holographiques?|holos?)\b/.test(stripped)) {
        wantedHolo = true;
        stripped = stripped.replace(/\b(?:holographiques?|holos?)\b/g, ' ');
    }

    const cleanNameQuery = stripped.replace(/\s+/g, ' ').trim();
    const filteredPool = allSearchable.filter(c => {
        if (wantedRarity && c.rarity !== wantedRarity) return false;
        if (wantedPerso && !c.isPerso) return false;
        if (wantedHolo === true && !c.isHolo) return false;
        if (wantedSet !== null && Number(c.setNumber) !== wantedSet) return false;
        return true;
    });

    const searchPool = filteredPool.length > 0 ? filteredPool : allSearchable;
    if (!cleanNameQuery && filteredPool.length > 0) {
        if (filteredPool.length === 1) return { card: filteredPool[0], matches: filteredPool, isCodeQuery: false };
        return { card: null, matches: filteredPool, isCodeQuery: false };
    }

    const effectiveQuery = cleanNameQuery || normQ;

    const exactFiltered = searchPool.filter(c =>
        c.normalizedName === effectiveQuery ||
        c.normalizedDisplayName === effectiveQuery ||
        c.normalizedBaseName === effectiveQuery
    );
    if (exactFiltered.length === 1) return { card: exactFiltered[0], matches: exactFiltered, isCodeQuery: false };
    if (exactFiltered.length > 1) return { card: null, matches: exactFiltered, isCodeQuery: false };

    const tokens = effectiveQuery.split(/\s+/).filter(Boolean);
    const compactQ = effectiveQuery.replace(/\s+/g, '');
    const partial = searchPool.filter(c => {
        const hay = `${c.normalizedDisplayName || ''} ${c.normalizedBaseName || ''} ${c.normalizedName || ''}`;
        const compactHay = hay.replace(/\s+/g, '');
        if (hay.includes(effectiveQuery) || (compactQ.length >= 3 && compactHay.includes(compactQ))) return true;
        if (tokens.length > 1 && tokens.every(t => hay.includes(t))) return true;
        return c.id.toLowerCase() === cleaned.toLowerCase();
    });
    if (partial.length === 1) return { card: partial[0], matches: partial, isCodeQuery: false };
    if (partial.length > 1) return { card: null, matches: partial, isCodeQuery: false };

    // 2c. Fallback sur tout le catalogue (si un mot de rareté faisait partie du nom de la carte)
    const rawTokens = normQ.split(/\s+/).filter(Boolean);
    const fallbackMatches = allSearchable.filter(c => {
        const hay = `${c.normalizedDisplayName || ''} ${c.normalizedBaseName || ''} ${normalizeText(c.rarity)}`;
        return rawTokens.every(t => hay.includes(t));
    });
    if (fallbackMatches.length === 1) return { card: fallbackMatches[0], matches: fallbackMatches, isCodeQuery: false };
    return { card: null, matches: fallbackMatches, isCodeQuery: false };
}

async function resolveMemberArg(message, rawArg, onResolved) {
    const mentioned = message.mentions?.users?.first();
    if (mentioned) {
        const m = await message.guild.members.fetch(mentioned.id).catch(() => null);
        return onResolved(m || mentioned);
    }

    const clean = (rawArg || '').trim();
    if (!clean) return onResolved(null);

    if (/^\d{17,20}$/.test(clean)) {
        const m = await message.guild.members.fetch(clean).catch(() => null);
        if (m) return onResolved(m);
        return replySilent(message, '❌ Membre introuvable avec cet ID.');
    }

    const res = tcgBridge.findMemberByName(message.guild, clean);
    if (res.found) return onResolved(res.found);
    if (res.multiple) {
        return tcgBridge.askDisambiguation(message, message.guild, res.candidates, async (chosenUser) => {
            const m = await message.guild.members.fetch(chosenUser.id).catch(() => null);
            await onResolved(m || chosenUser);
        });
    }
    return replySilent(message, `❌ Aucun membre trouvé pour \`${clean}\`.`);
}

// ==========================================
//   TIRAGE DE BOOSTER (PROBAS, HOLO, PITY)
// ==========================================

function getRarityBaseWeightSums() {
    const sums = {};
    for (const c of cardCatalog) {
        sums[c.rarity] = (sums[c.rarity] || 0) + (c.isHolo ? 1 : 2);
    }
    return sums;
}

function isCardPullGuaranteed(cardId, userId = null, member = null) {
    if (!cardId || isSandboxId(userId)) return false;
    const data = getStoreData();
    const boosts = data.pullBoosts || {};

    if (userId && boosts[userId]?.[cardId] === PULL_BOOST_GUARANTEED) {
        return true;
    }

    const hasRole = member ? hasTcgRole(member) : Boolean(userId);
    if (hasRole && boosts[PULL_BOOST_ROLE_KEY]?.[cardId] === PULL_BOOST_GUARANTEED) {
        return true;
    }

    return false;
}

function getTripleTrollCards(userId = null, member = null) {
    if (isSandboxId(userId)) return [];
    const data = getStoreData();
    const boosts = data.pullBoosts || {};
    const found = [];
    const seenIds = new Set();

    const collectFromMap = (map) => {
        if (!map || typeof map !== 'object') return;
        for (const [cid, val] of Object.entries(map)) {
            if (val === PULL_BOOST_TRIPLE && !seenIds.has(cid)) {
                const c = cardById.get(cid);
                if (c) {
                    found.push(c);
                    seenIds.add(cid);
                }
            }
        }
    };

    if (userId) collectFromMap(boosts[userId]);
    const hasRole = member ? hasTcgRole(member) : Boolean(userId);
    if (hasRole) collectFromMap(boosts[PULL_BOOST_ROLE_KEY]);

    return found;
}

function getCardPullMultiplier(cardId, userId = null, member = null) {
    if (!cardId || isSandboxId(userId)) return 1;
    const data = getStoreData();
    const boosts = data.pullBoosts || {};
    let mult = 1;

    const userMult = userId ? boosts[userId]?.[cardId] : null;
    if (typeof userMult === 'number' && userMult > 1) {
        mult = Math.max(mult, userMult);
    }

    const roleMult = boosts[PULL_BOOST_ROLE_KEY]?.[cardId];
    const hasRole = member ? hasTcgRole(member) : Boolean(userId);
    if (hasRole && typeof roleMult === 'number' && roleMult > 1) {
        mult = Math.max(mult, roleMult);
    }

    return mult;
}

function getRarityPunishmentFactor(rarity, userId = null) {
    if (!rarity || !userId || isSandboxId(userId)) return 1;
    const data = getStoreData();
    const factor = data.pullPunishments?.[userId]?.[rarity];
    if (typeof factor === 'number' && factor >= 0 && factor < 1) {
        return factor;
    }
    return 1;
}

function getEffectiveCardWeight(card, raritySums, userId = null, member = null) {
    if (!card) return 0;
    const punishFactor = getRarityPunishmentFactor(card.rarity, userId);
    if (punishFactor <= 0) return 0;
    const rarityW = RARITY_WEIGHTS[card.rarity] || 0;
    const denom = raritySums[card.rarity] || 1;
    const cardBaseShare = rarityW * ((card.isHolo ? 1 : 2) / denom);
    const mult = getCardPullMultiplier(card.id, userId, member);
    return cardBaseShare * mult * punishFactor;
}

function getRarityPullSummary(userId = null, member = null) {
    const raritySums = getRarityBaseWeightSums();
    const totalsByRarity = {};
    let totalW = 0;
    for (const r of RARITY_LIST) totalsByRarity[r] = 0;
    for (const c of cardCatalog) {
        const w = getEffectiveCardWeight(c, raritySums, userId, member);
        totalsByRarity[c.rarity] = (totalsByRarity[c.rarity] || 0) + w;
        totalW += w;
    }
    const result = {};
    for (const r of RARITY_LIST) {
        result[r] = totalW > 0 ? (totalsByRarity[r] / totalW) * 100 : 0;
    }
    return result;
}

function getCardPullProbability(card, luckyUsed = false, userId = null, member = null) {
    if (!card) return 0;
    const raritySums = getRarityBaseWeightSums();
    const pool = cardCatalog.filter(c => !(luckyUsed && c.rarity === 'Commune'));
    let totalW = 0;
    let cardW = 0;
    for (const c of pool) {
        const w = getEffectiveCardWeight(c, raritySums, userId, member);
        totalW += w;
        if (c.id === card.id) cardW = w;
    }
    if (totalW <= 0) return 0;
    return (cardW / totalW) * 100;
}

function formatPullPercent(pct) {
    if (!Number.isFinite(pct) || pct <= 0) return '0';
    let decimals = 2;
    if (pct < 0.01) decimals = 4;
    else if (pct < 0.1) decimals = 3;
    else if (pct >= 10) decimals = 1;
    let str = pct.toFixed(decimals);
    if (str.includes('.')) {
        str = str.replace(/0+$/, '').replace(/\.$/, '');
    }
    return str.replace('.', ',');
}

function pickWeightedCard(candidates, raritySums, userId = null, member = null) {
    if (!candidates || candidates.length === 0) return null;
    const weights = candidates.map(c => getEffectiveCardWeight(c, raritySums, userId, member));
    const totalWeight = weights.reduce((s, w) => s + w, 0);
    if (totalWeight <= 0) return candidates[Math.floor(Math.random() * candidates.length)];

    let roll = Math.random() * totalWeight;
    for (let i = 0; i < candidates.length; i++) {
        roll -= weights[i];
        if (roll <= 0) return candidates[i];
    }
    return candidates[candidates.length - 1];
}

function drawGodPackCards(setNumber = DEFAULT_SET_NUMBER, userId = null, member = null, cardCount = 3) {
    const setPool = getSetCatalog(setNumber);
    const raritySums = getRarityBaseWeightSums();
    const picked = [];
    const pickedIds = new Set();

    const pickByRarity = (targetRarity) => {
        let candidates = setPool.filter(c => c.rarity === targetRarity && !pickedIds.has(c.id) && getEffectiveCardWeight(c, raritySums, userId, member) > 0);
        if (candidates.length === 0) {
            candidates = setPool.filter(c => c.rarity === targetRarity && !pickedIds.has(c.id));
        }
        if (candidates.length === 0) return null;
        const c = pickWeightedCard(candidates, raritySums, userId, member);
        if (c) {
            picked.push(c);
            pickedIds.add(c.id);
        }
        return c;
    };

    // 1 Légendaire + 1 Full Art + (50% Full Art / 50% Négative)
    pickByRarity('Légendaire');
    pickByRarity('Full Art');
    const thirdRarity = Math.random() < 0.5 ? 'Full Art' : 'Négative';
    if (!pickByRarity(thirdRarity)) {
        pickByRarity(thirdRarity === 'Full Art' ? 'Négative' : 'Full Art');
    }

    while (picked.length < cardCount) {
        const roll = Math.random();
        const extraRarity = roll < 0.45 ? 'Légendaire' : (roll < 0.80 ? 'Full Art' : 'Négative');
        if (!pickByRarity(extraRarity) && !pickByRarity('Légendaire') && !pickByRarity('Full Art') && !pickByRarity('Épique')) {
            break;
        }
    }

    picked.sort((a, b) => {
        const ra = RARITY_ORDER[a.rarity] ?? 0;
        const rb = RARITY_ORDER[b.rarity] ?? 0;
        if (ra !== rb) return ra - rb;
        if (a.isHolo !== b.isHolo) return a.isHolo ? 1 : -1;
        return a.sortIndex - b.sortIndex;
    });

    return picked;
}

function drawBoosterCards(u, userId = null, member = null, setNumber = DEFAULT_SET_NUMBER, cardCount = 3) {
    const tripleCards = getTripleTrollCards(userId, member);
    if (tripleCards.length > 0) {
        const pickedTriple = [];
        for (let i = 0; i < cardCount; i++) {
            pickedTriple.push(tripleCards[i % tripleCards.length]);
        }
        const allCommunes = pickedTriple.length === cardCount && pickedTriple.every(c => c.rarity === 'Commune');
        u.pityRare = allCommunes;
        return {
            cards: pickedTriple,
            luckyUsed: false,
            pityUsed: false,
            triggeredNextPity: allCommunes,
            isGodPack: false,
            godBoostUsed: false
        };
    }

    const setPool = getSetCatalog(setNumber); // [SET 2] Pool limité au Set du booster ouvert
    const guaranteedPool = setPool.filter(c => isCardPullGuaranteed(c.id, userId, member));
    const guaranteedCards = guaranteedPool.length > cardCount
        ? [...guaranteedPool].sort(() => Math.random() - 0.5).slice(0, cardCount)
        : guaranteedPool;

    const godBoostActive = Boolean(u.activeBonuses?.godPackBoostUntil && Date.now() < u.activeBonuses.godPackBoostUntil);
    const godChance = godBoostActive ? (GOD_PACK_BASE_CHANCE * GOD_PACK_BOOST_MULT) : GOD_PACK_BASE_CHANCE;
    if (Math.random() < godChance) {
        const godCards = drawGodPackCards(setNumber, userId, member, cardCount);
        if (godCards.length === cardCount) {
            for (const gCard of guaranteedCards) {
                if (!godCards.some(c => c.id === gCard.id)) {
                    const replaceIdx = godCards.findIndex(c => !guaranteedCards.some(gc => gc.id === c.id));
                    if (replaceIdx !== -1) godCards[replaceIdx] = gCard;
                }
            }
            godCards.sort((a, b) => {
                const ra = RARITY_ORDER[a.rarity] ?? 0;
                const rb = RARITY_ORDER[b.rarity] ?? 0;
                if (ra !== rb) return ra - rb;
                if (a.isHolo !== b.isHolo) return a.isHolo ? 1 : -1;
                return a.sortIndex - b.sortIndex;
            });
            // La pityRare déjà active est conservée pour le booster suivant
            return {
                cards: godCards,
                luckyUsed: false,
                pityUsed: false,
                triggeredNextPity: false,
                isGodPack: true,
                godBoostUsed: godBoostActive
            };
        }
    }

    const luckyActive = Boolean(u.activeBonuses?.luckyBooster);
    const pityActive = Boolean(u.pityRare);
    const raritySums = getRarityBaseWeightSums();
    const picked = [];
    const pickedIds = new Set();

    let slots = cardCount;
    for (const gCard of guaranteedCards) {
        if (slots <= 0) break;
        if (!pickedIds.has(gCard.id)) {
            picked.push(gCard);
            pickedIds.add(gCard.id);
            slots--;
        }
    }

    // Si pityRare est actif : garantir 1 carte de rareté 'Rare' (s'il reste de la place)
    if (pityActive && slots > 0 && !picked.some(c => c.rarity === 'Rare')) {
        const rareCandidates = setPool.filter(c => c.rarity === 'Rare' && !pickedIds.has(c.id));
        if (rareCandidates.length > 0) {
            const c = pickWeightedCard(rareCandidates, raritySums, userId, member);
            picked.push(c);
            pickedIds.add(c.id);
            slots--;
        }
    }

    for (let i = 0; i < slots; i++) {
        let pool = setPool.filter(c => !(luckyActive && c.rarity === 'Commune') && !pickedIds.has(c.id) && getEffectiveCardWeight(c, raritySums, userId, member) > 0);
        if (pool.length === 0) {
            pool = setPool.filter(c => !pickedIds.has(c.id) && getEffectiveCardWeight(c, raritySums, userId, member) > 0);
        }
        const fallback = pool.length > 0 ? pool : setPool.filter(c => !pickedIds.has(c.id));
        const chosenCard = pickWeightedCard(fallback, raritySums, userId, member);
        if (chosenCard) {
            picked.push(chosenCard);
            pickedIds.add(chosenCard.id);
        }
    }

    // Trier de la plus commune à la plus rare
    picked.sort((a, b) => {
        const ra = RARITY_ORDER[a.rarity] ?? 0;
        const rb = RARITY_ORDER[b.rarity] ?? 0;
        if (ra !== rb) return ra - rb;
        if (a.isHolo !== b.isHolo) return a.isHolo ? 1 : -1;
        return a.sortIndex - b.sortIndex;
    });

    // Mise à jour Pity : si toutes les cartes sont Communes, le PROCHAIN booster aura 1 Rare garantie
    const allCommunes = picked.length === cardCount && picked.every(c => c.rarity === 'Commune');
    u.pityRare = allCommunes;

    return { cards: picked, luckyUsed: luckyActive, pityUsed: pityActive, triggeredNextPity: allCommunes, isGodPack: false, godBoostUsed: godBoostActive };
}

// ==========================================
//   RENDU CANVAS (LEMON MILK BOLD + POLYFILL)
// ==========================================

function drawRoundRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

function scheduleProxyRamClear() {
    if (proxyRamClearTimer) clearTimeout(proxyRamClearTimer);
    proxyRamClearTimer = setTimeout(() => {
        proxyRamCache.clear();
        proxyRamClearTimer = null;
    }, PROXY_TTL_MS);
    proxyRamClearTimer.unref?.();
}

function setProxyRamCache(key, img) {
    if (proxyRamCache.has(key)) proxyRamCache.delete(key);
    while (proxyRamCache.size >= PROXY_MAX_RAM_ITEMS) {
        const oldestKey = proxyRamCache.keys().next().value;
        proxyRamCache.delete(oldestKey);
    }
    proxyRamCache.set(key, img);
    scheduleProxyRamClear();
}

function getProxyEffectOptions(targetW, opts = {}) {
    if (opts.glowColor) {
        const blur = Math.max(8, Math.round(targetW * 0.08));
        const pad = Math.max(12, Math.ceil(blur * 2));
        return {
            pad,
            blur,
            offsetY: 0,
            alpha: 1,
            shadowColor: opts.glowColor
        };
    }
    if (opts.mysteryShadow) {
        const targetH = opts.targetH || Math.round(targetW * 1.4);
        const blur = Math.max(5, Math.round(targetW * 0.05));
        const offsetY = Math.max(2, Math.round(targetH * 0.02));
        const pad = Math.max(10, Math.ceil(blur * 2) + offsetY);
        return {
            pad,
            blur,
            offsetY,
            alpha: 0.78,
            shadowColor: 'rgba(0, 0, 0, 0.42)'
        };
    }
    return { pad: 0, blur: 0, offsetY: 0, alpha: 1, shadowColor: null };
}

async function generateProxyBuffer(sourcePath, proxyPath, targetW, targetH, fx = {}) {
    const pad = fx.pad || 0;
    const outW = targetW + pad * 2;
    const outH = targetH + pad * 2;

    const srcImg = await loadImage(sourcePath);
    const c = createCanvas(outW, outH);
    const pctx = c.getContext('2d');
    pctx.imageSmoothingEnabled = true;
    pctx.patternQuality = 'best';

    if (typeof fx.alpha === 'number' && fx.alpha < 1) {
        pctx.globalAlpha = fx.alpha;
    }
    if (fx.shadowColor && fx.blur > 0) {
        pctx.shadowColor = fx.shadowColor;
        pctx.shadowBlur = fx.blur;
        pctx.shadowOffsetX = 0;
        pctx.shadowOffsetY = fx.offsetY || 0;
    }

    pctx.drawImage(srcImg, pad, pad, targetW, targetH);
    const pngBuf = c.toBuffer('image/png');
    c.width = c.height = 0; // Libère immédiatement la surface native Cairo

    try {
        fs.mkdirSync(path.dirname(proxyPath), { recursive: true });
        const tmpPath = `${proxyPath}.tmp.${process.pid}.${Date.now()}`;
        fs.writeFileSync(tmpPath, pngBuf);
        fs.renameSync(tmpPath, proxyPath);
        lastProxyWriteError = null;
    } catch (err) {
        lastProxyWriteError = err?.message || String(err);
        console.warn(`⚠️ Impossible d'écrire le proxy (${proxyPath}) :`, lastProxyWriteError);
    }

    return pngBuf;
}

async function getOrCreateProxyImage(sourcePath, proxyPath, targetW, targetH, fx = {}) {
    if (!sourcePath || !fs.existsSync(sourcePath)) return null;

    const pad = fx.pad || 0;
    const expectedW = targetW + pad * 2;
    const expectedH = targetH + pad * 2;

    if (proxyRamCache.has(proxyPath)) {
        const cached = proxyRamCache.get(proxyPath);
        if (cached && cached.width === expectedW && cached.height === expectedH) {
            setProxyRamCache(proxyPath, cached);
            return { img: cached, pad, fromDisk: true };
        }
        proxyRamCache.delete(proxyPath);
    }

    if (proxyInFlight.has(proxyPath)) {
        return proxyInFlight.get(proxyPath);
    }

    const task = (async () => {
        try {
            let proxyImg = null;
            let fromDisk = false;
            let hasDiskProxy = false;
            try {
                hasDiskProxy = fs.existsSync(proxyPath) && fs.statSync(proxyPath).size > 0;
            } catch {
                hasDiskProxy = false;
            }

            if (hasDiskProxy) {
                try {
                    const loaded = await loadImage(proxyPath);
                    if (loaded && loaded.width === expectedW && loaded.height === expectedH) {
                        proxyImg = loaded;
                        fromDisk = true;
                    }
                } catch {
                    proxyImg = null;
                }
            }

            if (!proxyImg) {
                const pngBuf = await generateProxyBuffer(sourcePath, proxyPath, targetW, targetH, fx);
                proxyImg = await loadImage(pngBuf);
                fromDisk = false;
            }

            if (proxyImg) setProxyRamCache(proxyPath, proxyImg);
            return proxyImg ? { img: proxyImg, pad, fromDisk } : null;
        } catch {
            return null;
        } finally {
            proxyInFlight.delete(proxyPath);
        }
    })();

    proxyInFlight.set(proxyPath, task);
    return task;
}

function getCardProxyPath(card, targetW, targetH) {
    if (card.isPerso) {
        return path.join(
            TCG_PROXIES_DIR,
            'Cartes Perso',
            `${targetW}x${targetH}`,
            card.filename
        );
    }
    return path.join(
        TCG_PROXIES_DIR,
        `Set ${card.setNumber || 1}`,
        card.category,
        card.rarity,
        `${targetW}x${targetH}`,
        card.filename
    );
}

async function loadCardProxy(card, targetW, targetH, opts = {}) {
    if (!card?.filePath) return null;
    const useGlow = opts.glow !== false;
    const meta = RARITY_META[card.rarity] || RARITY_META['Commune'];
    const fx = useGlow
        ? getProxyEffectOptions(targetW, { targetH, glowColor: meta.glow || 'rgba(255, 255, 255, 0.55)' })
        : getProxyEffectOptions(targetW, {});
    return getOrCreateProxyImage(card.filePath, getCardProxyPath(card, targetW, targetH), targetW, targetH, fx);
}

async function loadAssetProxy(filePath, targetW, targetH, opts = {}) {
    if (!filePath) return null;
    const proxyPath = path.join(
        TCG_PROXIES_DIR,
        '_Assets',
        `${targetW}x${targetH}`,
        opts.cacheKey || path.basename(filePath)
    );
    const fx = opts.mysteryShadow
        ? getProxyEffectOptions(targetW, { targetH, mysteryShadow: true })
        : getProxyEffectOptions(targetW, {});
    return getOrCreateProxyImage(filePath, proxyPath, targetW, targetH, fx);
}

// Buffer d'une pièce jointe récurrente (bannière, booster, GIF d'ouverture).
function getAssetBuffer(filePath) {
    if (!filePath || !fs.existsSync(filePath)) return null;
    if (hotBuffers.has(filePath)) return hotBuffers.get(filePath);
    try {
        const buffer = fs.readFileSync(filePath);
        hotBuffers.set(filePath, buffer);
        return buffer;
    } catch {
        return null;
    }
}

function drawCoverImage(ctx, img, w, h) {
    const scale = Math.max(w / img.width, h / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

async function getBackground(theme) {
    if (bgCanvases.has(theme)) return bgCanvases.get(theme);
    const p = theme === 'W' ? assetPaths.bgW : assetPaths.bgB;
    if (!p || !fs.existsSync(p)) return null;
    try {
        const src = await loadImage(p);
        const c = createCanvas(1600, 900);
        drawCoverImage(c.getContext('2d'), src, 1600, 900);
        bgCanvases.set(theme, c);
        return c;
    } catch {
        return null;
    }
}

function drawBackground(ctx, theme, w, h) {
    const bg = bgCanvases.get(theme);
    if (bg) return drawCoverImage(ctx, bg, w, h);
    ctx.fillStyle = theme === 'W' ? '#F4F1EA' : '#13151B';
    ctx.fillRect(0, 0, w, h);
}

function toPng(canvas) {
    const buffer = canvas.toBuffer('image/png');
    canvas.width = canvas.height = 0; // Libère immédiatement la mémoire native Cairo
    return buffer;
}

function toJpeg(canvas, quality = 0.90) {
    const buffer = canvas.toBuffer('image/jpeg', { quality, progressive: false, chromaSubsampling: true });
    canvas.width = canvas.height = 0; // Libère immédiatement la mémoire native Cairo
    return buffer;
}

function normalizeBinderOwnedMode(val) {
    if (val === '2' || val === 'dups') return '2';
    if (val === '1' || val === 'owned' || val === true) return '1';
    return '0';
}

function getFilteredSortedCards(categoryFilter, sortMode, u = null, ownedModeInput = '0', rarityCode = 'all', setNumber = DEFAULT_SET_NUMBER) {
    if (categoryFilter === 'perso') {
        let list = u ? persoCatalog.filter(c => (u.cards?.[c.id] || 0) > 0) : [];
        const ownedMode = normalizeBinderOwnedMode(ownedModeInput);
        if (ownedMode === '2' && u) {
            list = list.filter(c => (u.cards?.[c.id] || 0) >= 2);
        }
        if (sortMode === 'quantity' && u) {
            list.sort((a, b) => ((u.cards?.[b.id] || 0) - (u.cards?.[a.id] || 0)) || (a.numValue - b.numValue));
        } else {
            list.sort((a, b) => a.numValue - b.numValue);
        }
        return list;
    }

    const baseList = getSetCatalog(setNumber); // [SET 2] Filtre sur le Set affiché
    let list = categoryFilter === 'complet'
        ? [...baseList]
        : baseList.filter(c => c.category === categoryFilter);

    const targetRarity = BINDER_RARITY_CODES[rarityCode] || null;
    if (targetRarity) {
        list = list.filter(c => c.rarity === targetRarity);
    }

    const ownedMode = normalizeBinderOwnedMode(ownedModeInput);
    if (ownedMode === '1' && u) {
        list = list.filter(c => (u.cards?.[c.id] || 0) > 0);
    } else if (ownedMode === '2' && u) {
        list = list.filter(c => (u.cards?.[c.id] || 0) >= 2);
    }

    const effectiveSortMode = (targetRarity && sortMode === 'rarity') ? 'number' : sortMode;
    if (effectiveSortMode === 'quantity' && u) {
        list.sort((a, b) => {
            const qa = u.cards?.[a.id] || 0;
            const qb = u.cards?.[b.id] || 0;
            if (qb !== qa) return qb - qa;
            return a.sortIndex - b.sortIndex;
        });
    } else if (effectiveSortMode === 'rarity') {
        list.sort((a, b) => {
            const ra = RARITY_ORDER[a.rarity] ?? 0;
            const rb = RARITY_ORDER[b.rarity] ?? 0;
            if (ra !== rb) return ra - rb;
            if (a.isHolo !== b.isHolo) return a.isHolo ? 1 : -1;
            return a.sortIndex - b.sortIndex;
        });
    } else {
        list.sort((a, b) => a.sortIndex - b.sortIndex);
    }
    return list;
}

function getBinderGridConfig(perPageMode, totalInCategory) {
    if (perPageMode === '4' || perPageMode === '9') return { cols: 4, rows: 1, perPage: 4 };
    if (perPageMode === '18') return { cols: 6, rows: 3, perPage: 18 };
    if (perPageMode === '36') return { cols: 9, rows: 4, perPage: 36 };
    // Mode 'all'
    if (totalInCategory <= 27) return { cols: 9, rows: 3, perPage: Math.max(totalInCategory, 1) };
    if (totalInCategory <= 36) return { cols: 9, rows: 4, perPage: Math.max(totalInCategory, 1) };
    if (totalInCategory <= 50) return { cols: 10, rows: 5, perPage: Math.max(totalInCategory, 1) };
    return { cols: 16, rows: 7, perPage: Math.max(totalInCategory, 1) };
}

function computeBinderCardDims(W, H, grid) {
    const padX = 40;
    const startY = 96;
    const availW = W - padX * 2;
    const availH = H - startY - 20;

    const cellW = availW / grid.cols;
    const cellH = availH / grid.rows;
    const labelH = grid.rows === 1 ? 32 : (grid.rows >= 6 ? 19 : (grid.rows >= 4 ? 22 : 28));
    const maxCardH = cellH - labelH - 8;
    const maxCardW = cellW - (grid.cols <= 4 ? 24 : 12);
    const cardRatio = 500 / 700;

    let cardH = maxCardH;
    let cardW = cardH * cardRatio;
    if (cardW > maxCardW) {
        cardW = maxCardW;
        cardH = cardW / cardRatio;
    }
    return {
        padX,
        startY,
        cellW,
        cellH,
        labelH,
        cardW: Math.floor(cardW),
        cardH: Math.floor(cardH),
        fontSize: grid.rows === 1 ? 22 : (grid.rows >= 6 ? 12 : (grid.rows >= 4 ? 15 : 19))
    };
}

async function renderBinderCanvas(targetUser, u, options) {
    const {
        setNumber = DEFAULT_SET_NUMBER,
        category = 'complet',
        perPageMode = '18',
        page = 0,
        sortMode = 'number',
        rarityFilter = 'all'
    } = options;
    const ownedMode = normalizeBinderOwnedMode(options.ownedMode ?? options.ownedOnly);

    const W = 1600;
    const H = 900;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    const isLight = u.theme === 'W';
    const textColor = isLight ? '#111111' : '#FFFFFF';
    const subTextColor = isLight ? '#333333' : '#CCCCCC';

    drawBackground(ctx, isLight ? 'W' : 'B', W, H);

    const allCategoryCards = getFilteredSortedCards(category, sortMode, u, '0', rarityFilter, setNumber);
    const cardsList = ownedMode === '1'
        ? allCategoryCards.filter(c => (u.cards?.[c.id] || 0) > 0)
        : (ownedMode === '2' ? allCategoryCards.filter(c => (u.cards?.[c.id] || 0) >= 2) : allCategoryCards);
    const grid = getBinderGridConfig(perPageMode, cardsList.length);
    const totalPages = Math.max(1, Math.ceil(cardsList.length / grid.perPage));
    const safePage = Math.max(0, Math.min(page, totalPages - 1));
    const slice = cardsList.slice(safePage * grid.perPage, (safePage + 1) * grid.perPage);

    // En-tête (LEMON MILK Bold)
    const isPersoView = category === 'perso';
    const setCfg = getSetConfig(setNumber);
    const ownedInView = allCategoryCards.filter(c => (u.cards?.[c.id] || 0) > 0).length;
    const totalInView = allCategoryCards.length;
    const pct = totalInView > 0 ? Math.round((ownedInView / totalInView) * 100) : 0;
    const rarityLabel = isPersoView ? null : BINDER_RARITY_CODES[rarityFilter];
    const baseLabel = isPersoView
        ? 'RegaDex • Cartes Perso'
        : (category === 'complet' ? `RegaDex • ${setCfg.shortName}` : `RegaDex • ${category}`);
    const headerTags = [];
    if (rarityLabel) headerTags.push(rarityLabel);
    if (ownedMode === '1' && !isPersoView) headerTags.push('Possédées');
    else if (ownedMode === '2') headerTags.push('Doublons');
    const headerLabel = headerTags.length > 0 ? `${baseLabel} (${headerTags.join(' • ')})` : baseLabel;

    ctx.fillStyle = isLight ? 'rgba(255,255,255,0.72)' : 'rgba(15,17,24,0.72)';
    drawRoundRect(ctx, 32, 18, W - 64, 62, 14);
    ctx.fill();

    const logoH = 76;
    const logoW = Math.round((1132 / 467) * logoH);
    const logoX = Math.round((W - logoW) / 2);
    // [SET 2] Décalage vertical du logo par Set (Set 1 remonté de 3 px)
    const logoOffsetY = setNumber === 1 ? -3 : 0;
    const logoY = Math.round(49 - logoH / 2) + logoOffsetY;
    const maxSideW = Math.max(200, logoX - 56 - 24);

    ctx.fillStyle = textColor;
    ctx.font = 'bold 25px "LemonMilk", "Sans"';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const rawName = (targetUser.displayName || targetUser.username || 'Collectionneur').trim();
    const displayName = rawName.split(/\s+/)[0] || 'Collectionneur';
    ctx.fillText(`${headerLabel} — ${displayName}`, 56, 49, maxSideW);

    ctx.textAlign = 'right';
    ctx.font = 'bold 20px "LemonMilk", "Sans"';
    const rightSummary = ownedMode === '2'
        ? `${cardsList.length} doublon${cardsList.length > 1 ? 's' : ''}  •  Page ${safePage + 1}/${totalPages}`
        : (isPersoView
            ? `${ownedInView} carte${ownedInView > 1 ? 's' : ''} perso  •  Page ${safePage + 1}/${totalPages}`
            : `${ownedInView}/${totalInView} (${pct}%)  •  Page ${safePage + 1}/${totalPages}`);
    ctx.fillText(rightSummary, W - 56, 49, maxSideW);

    // Logo du Set en premier plan, petit et centré tout en haut ([SET 2] dynamique par Set)
    const activeLogoPath = setAssets[setNumber]?.logo || assetPaths.set1Logo;
    if (!isPersoView && activeLogoPath) {
        const logoProxy = await loadAssetProxy(activeLogoPath, logoW, logoH, { cacheKey: `Set${setNumber}_Logo_header.png` });
        if (logoProxy?.img) {
            ctx.drawImage(logoProxy.img, logoX - logoProxy.pad, logoY - logoProxy.pad);
        }
    }

    // Zone grille
    const { padX, startY, cellW, cellH, labelH, cardW, cardH, fontSize } = computeBinderCardDims(W, H, grid);
    const mysteryProxy = ownedMode !== '0' ? null : await loadAssetProxy(assetPaths.mysteryCard, cardW, cardH, { mysteryShadow: true });

    if (slice.length === 0) {
        ctx.fillStyle = subTextColor;
        ctx.font = 'bold 28px "LemonMilk", "Sans"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const emptyTxt = ownedMode === '2'
            ? 'Aucune carte en doublon dans cette vue.'
            : (rarityLabel ? 'Aucune carte trouvée pour ce filtre.' : 'Aucune carte possédée dans cette catégorie.');
        ctx.fillText(emptyTxt, W / 2, H / 2 + 20, W - 120);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = `bold ${fontSize}px "LemonMilk", "Sans"`;

    for (let idx = 0; idx < slice.length; idx++) {
        const card = slice[idx];
        const col = idx % grid.cols;
        const row = Math.floor(idx / grid.cols);

        const cx = padX + col * cellW + cellW / 2;
        const topY = startY + row * cellH + Math.max(2, (cellH - cardH - labelH) / 2);
        const cardX = Math.round(cx - cardW / 2);
        const cardY = Math.round(topY);

        const count = u.cards?.[card.id] || 0;
        const owned = count > 0;

        if (owned) {
            // Lueur de rareté déjà pré-cuite dans le proxy (0 ombre noire, 0 shadowBlur en direct)
            const proxy = await loadCardProxy(card, cardW, cardH, { glow: true });
            if (proxy?.img) {
                ctx.drawImage(proxy.img, cardX - proxy.pad, cardY - proxy.pad);
            } else {
                ctx.fillStyle = RARITY_META[card.rarity]?.hex || '#888888';
                drawRoundRect(ctx, cardX, cardY, cardW, cardH, 8);
                ctx.fill();
            }
        } else {
            // Carte mystère : opacité 0.78 + ombre noire pré-cuites dans _Assets (aucun spoiler)
            if (mysteryProxy?.img) {
                ctx.drawImage(mysteryProxy.img, cardX - mysteryProxy.pad, cardY - mysteryProxy.pad);
            } else {
                ctx.fillStyle = isLight ? 'rgba(204, 204, 204, 0.78)' : 'rgba(44, 47, 58, 0.78)';
                drawRoundRect(ctx, cardX, cardY, cardW, cardH, 8);
                ctx.fill();
            }
        }

        ctx.fillStyle = owned ? textColor : subTextColor;
        ctx.fillText(`${card.id} • x${count}`, cx, cardY + cardH + 4, cellW - 8);
    }

    return {
        buffer: toJpeg(canvas, 0.90),
        totalPages,
        safePage,
        ownedInView,
        totalInView
    };
}

async function renderBoosterRecapCanvas(cards, isNewFlags, theme = 'B', isGodPack = false) {
    const W = 1280;
    const H = 1040;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    const isLight = theme === 'W';

    drawBackground(ctx, isLight ? 'W' : 'B', W, H);

    if (isGodPack) {
        const grad = ctx.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, W * 0.72);
        grad.addColorStop(0, 'rgba(255, 215, 0, 0.24)');
        grad.addColorStop(0.55, 'rgba(241, 196, 15, 0.12)');
        grad.addColorStop(1, 'rgba(255, 165, 0, 0.04)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        ctx.save();
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 8;
        ctx.shadowColor = 'rgba(255, 215, 0, 0.85)';
        ctx.shadowBlur = 24;
        drawRoundRect(ctx, 18, 14, W - 36, H - 28, 24);
        ctx.stroke();
        ctx.restore();
    }

    ctx.fillStyle = isGodPack
        ? (isLight ? 'rgba(255, 248, 220, 0.90)' : 'rgba(28, 22, 8, 0.88)')
        : (isLight ? 'rgba(255,255,255,0.78)' : 'rgba(12,14,20,0.78)');
    drawRoundRect(ctx, 40, 22, W - 80, 66, 16);
    ctx.fill();

    if (isGodPack) {
        ctx.save();
        ctx.strokeStyle = '#F1C40F';
        ctx.lineWidth = 3;
        drawRoundRect(ctx, 40, 22, W - 80, 66, 16);
        ctx.stroke();
        ctx.restore();
    }

    ctx.fillStyle = isGodPack ? (isLight ? '#9A6700' : '#FFD700') : (isLight ? '#111111' : '#FFFFFF');
    ctx.font = 'bold 31px "LemonMilk", "Sans"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const isFivePack = cards.length > 3;
    const titleText = isGodPack
        ? (isFivePack ? `★ GOD PACK ${cards.length} CARTES ! — ${SET1_NAME} ★` : `★ GOD PACK ! — ${SET1_NAME} ★`)
        : (isFivePack ? `Récapitulatif du Booster ${cards.length} Cartes — ${SET1_NAME}` : `Récapitulatif du Booster ${SET1_NAME}`);
    ctx.fillText(titleText, W / 2, 55, W - 120);

    let cardW = 285;
    let cardH = 399;
    let positions;

    if (isFivePack) {
        // 5 cartes rangées par ordre d'obtention de gauche à droite et de haut en bas (3 en haut, 2 centrées en bas)
        cardW = 270;
        cardH = 378;
        const gapTop = 85;
        const topStartX = Math.round((W - (3 * cardW + 2 * gapTop)) / 2);
        const bottomCount = Math.max(1, cards.length - 3);
        const gapBottom = 110;
        const bottomStartX = Math.round((W - (bottomCount * cardW + (bottomCount - 1) * gapBottom)) / 2);

        positions = [
            { x: topStartX, y: 112 },
            { x: topStartX + cardW + gapTop, y: 112 },
            { x: topStartX + (cardW + gapTop) * 2, y: 112 },
            { x: bottomStartX, y: 560 },
            { x: bottomStartX + cardW + gapBottom, y: 560 }
        ];
    } else {
        // Triangle inversé : 2 cartes en haut, 1 centrée en bas
        positions = [
            { x: W / 2 - cardW - 60, y: 112 },
            { x: W / 2 + 60, y: 112 },
            { x: W / 2 - cardW / 2, y: 565 }
        ];
    }

    for (let i = 0; i < Math.min(cards.length, positions.length); i++) {
        const card = cards[i];
        const pos = positions[i];

        const proxy = await loadCardProxy(card, cardW, cardH, { glow: true });
        if (proxy?.img) {
            ctx.drawImage(proxy.img, pos.x - proxy.pad, pos.y - proxy.pad);
        }

        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.font = 'bold 18px "LemonMilk", "Sans"';
        ctx.fillStyle = isGodPack ? (isLight ? '#7A5200' : '#FFE066') : (isLight ? '#111111' : '#FFFFFF');
        const statusTxt = isNewFlags[i] ? 'NOUVELLE !' : 'DOUBLON (+3 PTS)';
        ctx.fillText(`${card.id} • ${card.rarity} • ${statusTxt}`, pos.x + cardW / 2, pos.y + cardH + 10, isFivePack ? cardW + 70 : cardW + 90);
    }

    return toJpeg(canvas, 0.90);
}

function formatMasterDisplayName(member) {
    const raw = (member?.displayName || member?.user?.username || member?.username || 'Collectionneur').trim();
    if (/\(\s*OG\b/i.test(raw)) {
        const cleaned = raw.replace(/\s*\([^)]*\bOG\b[^)]*\)/gi, '').trim();
        if (cleaned) {
            return cleaned.split(/\s+/)[0];
        }
        const noParens = raw.replace(/[()]/g, '').trim();
        return noParens.split(/\s+/)[0] || member?.user?.username || 'Collectionneur';
    }
    return raw;
}

function drawFivePointStar(ctx, cx, cy, outerR, innerR, fillStyle, shadowCol = null) {
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const angle = (-Math.PI / 2) + (i * Math.PI / 5);
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = fillStyle;
    if (shadowCol) {
        ctx.shadowColor = shadowCol;
        ctx.shadowBlur = 18;
    }
    ctx.fill();
    ctx.restore();
}

function computeFittedWrappedLines(ctx, text, maxWidth, startSize = 38, minSize = 22, maxCharsPerLine = 15) {
    const str = String(text || '').trim();
    if (!str) return { lines: [], fontSize: startSize, lineH: Math.round(startSize * 1.24) };

    const words = str.split(/\s+/);
    const shouldForceWrap = words.length > 1 && str.length > maxCharsPerLine;

    if (!shouldForceWrap) {
        ctx.font = `bold ${startSize}px "LemonMilk", "Sans"`;
        if (ctx.measureText(str).width <= maxWidth) {
            return { lines: [str], fontSize: startSize, lineH: Math.round(startSize * 1.24) };
        }
        if (words.length === 1) {
            for (let size = startSize - 2; size >= minSize; size -= 2) {
                ctx.font = `bold ${size}px "LemonMilk", "Sans"`;
                if (ctx.measureText(str).width <= maxWidth) {
                    return { lines: [str], fontSize: size, lineH: Math.round(size * 1.24) };
                }
            }
            return { lines: [str], fontSize: minSize, lineH: Math.round(minSize * 1.24) };
        }
    }

    for (let size = startSize; size >= minSize; size -= 2) {
        ctx.font = `bold ${size}px "LemonMilk", "Sans"`;
        let line1 = '';
        let line2 = '';
        for (const w of words) {
            const test = line1 ? `${line1} ${w}` : w;
            const fitsChars = !line1 || test.length <= maxCharsPerLine;
            if (fitsChars && ctx.measureText(test).width <= maxWidth) {
                line1 = test;
            } else {
                line2 = line2 ? `${line2} ${w}` : w;
            }
        }
        if (line1 && (!line2 || ctx.measureText(line2).width <= maxWidth || size === minSize)) {
            const lines = line2 ? [line1, line2] : [line1];
            return { lines, fontSize: size, lineH: Math.round(size * 1.24) };
        }
    }

    return { lines: [str], fontSize: minSize, lineH: Math.round(minSize * 1.24) };
}

function drawFittedWrappedText(ctx, text, centerX, startY, maxWidth, startSize = 38, minSize = 22, maxCharsPerLine = 15) {
    const layout = computeFittedWrappedLines(ctx, text, maxWidth, startSize, minSize, maxCharsPerLine);
    if (layout.lines.length === 0) return;
    ctx.font = `bold ${layout.fontSize}px "LemonMilk", "Sans"`;
    layout.lines.forEach((line, idx) => {
        ctx.fillText(line, centerX, startY + idx * layout.lineH, maxWidth);
    });
}

async function renderMasterSetCanvas(member, u, setNumber = DEFAULT_SET_NUMBER) {
    const W = 1600;
    const H = 900;
    const MID_Y = H / 2; // Méridienne centrale (450)
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.patternQuality = 'best';

    const isLight = u?.theme === 'W';
    const textColor = isLight ? '#111111' : '#FFFFFF';
    const shadowCol = isLight ? 'rgba(0, 0, 0, 0.25)' : 'rgba(0, 0, 0, 0.85)';

    // Background en résolution native 900p (1600x900)
    drawBackground(ctx, isLight ? 'W' : 'B', W, H);

    // Aura & contour doré identique au God Pack
    const grad = ctx.createRadialGradient(W / 2, H / 2, 90, W / 2, H / 2, W * 0.72);
    grad.addColorStop(0, 'rgba(255, 215, 0, 0.22)');
    grad.addColorStop(0.55, 'rgba(241, 196, 15, 0.11)');
    grad.addColorStop(1, 'rgba(255, 165, 0, 0.04)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 9;
    ctx.shadowColor = 'rgba(255, 215, 0, 0.85)';
    ctx.shadowBlur = 26;
    drawRoundRect(ctx, 20, 16, W - 40, H - 32, 28);
    ctx.stroke();
    ctx.restore();

    // 1. Rectangle doré d'en-tête (identique au God Pack) + Titre "MAÎTRE DU SET" + étoiles
    ctx.fillStyle = isLight ? 'rgba(255, 248, 220, 0.90)' : 'rgba(28, 22, 8, 0.88)';
    drawRoundRect(ctx, 48, 34, W - 96, 76, 18);
    ctx.fill();

    ctx.save();
    ctx.strokeStyle = '#F1C40F';
    ctx.lineWidth = 3;
    drawRoundRect(ctx, 48, 34, W - 96, 76, 18);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 48px "LemonMilk", "Sans"';
    const titleStr = 'MAÎTRE DU SET';
    const titleW = ctx.measureText(titleStr).width;
    const titleY = 72;
    ctx.fillStyle = isLight ? '#9A6700' : '#FFD700';
    ctx.shadowColor = shadowCol;
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 3;
    ctx.fillText(titleStr, W / 2, titleY, W - 260);
    ctx.restore();

    const starOffset = (titleW / 2) + 38;
    drawFivePointStar(ctx, (W / 2) - starOffset, titleY - 2, 19, 8.5, '#FFD700', 'rgba(255, 215, 0, 0.75)');
    drawFivePointStar(ctx, (W / 2) + starOffset, titleY - 2, 19, 8.5, '#FFD700', 'rgba(255, 215, 0, 0.75)');

    // 2. Logo du Set juste en dessous
    const activeLogoPath = setAssets[setNumber]?.logo || assetPaths.set1Logo;
    if (activeLogoPath && fs.existsSync(activeLogoPath)) {
        try {
            const logoImg = await loadImage(activeLogoPath);
            const logoH = 132;
            const logoW = Math.round((logoImg.width / logoImg.height) * logoH);
            ctx.save();
            ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
            ctx.shadowBlur = 14;
            ctx.drawImage(logoImg, Math.round((W - logoW) / 2), 120, logoW, logoH);
            ctx.restore();
        } catch {}
    }

    // 3. Colonne gauche : Booster du Set + Boosters ouverts + Cartes totales du Set
    const activeBoosterPath = setAssets[setNumber]?.boosterPng || assetPaths.boosterPng;
    const leftCenterX = 330;
    const leftCenterY = 490; // Milieu de la zone sous le bandeau doré
    const boosterH = 490;
    const boosterGap = 16;
    const boosterTextH = 110;
    const leftBlockTotalH = boosterH + boosterGap + boosterTextH;
    const boosterY = Math.round(leftCenterY - leftBlockTotalH / 2);

    if (activeBoosterPath && fs.existsSync(activeBoosterPath)) {
        try {
            const boosterImg = await loadImage(activeBoosterPath);
            const targetW = Math.round((boosterImg.width / boosterImg.height) * boosterH);
            const bx = Math.round(leftCenterX - targetW / 2);
            ctx.save();
            ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
            ctx.shadowBlur = 26;
            ctx.shadowOffsetY = 12;
            ctx.drawImage(boosterImg, bx, boosterY, targetW, boosterH);
            ctx.restore();
        } catch {}
    }

    const setKey = String(setNumber);
    const setBoostersCount = u?.stats?.boostersBySet?.[setKey]
        ?? (setNumber === 1 ? (u?.stats?.boostersOpened || 0) : 0);
    const setTotalCards = getUserCompletionStats(u || { cards: {} }, setNumber).totalCopies;
    const textStartY = boosterY + boosterH + boosterGap;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowColor = shadowCol;
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 2;

    ctx.font = 'bold 21px "LemonMilk", "Sans"';
    ctx.fillStyle = textColor;
    ctx.fillText(`Boosters Set ${setNumber} Ouverts = ${setBoostersCount}`, leftCenterX, textStartY, 440);

    ctx.font = 'bold 19px "LemonMilk", "Sans"';
    ctx.fillStyle = textColor;
    ctx.fillText(`Cartes totales (Set ${setNumber})`, leftCenterX, textStartY + 48, 440);

    ctx.shadowColor = isLight ? 'rgba(218, 165, 32, 0.70)' : 'rgba(255, 215, 0, 0.85)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.font = 'bold 36px "LemonMilk", "Sans"';
    ctx.fillStyle = isLight ? '#9A6700' : '#FFD700';
    ctx.fillText(`${setTotalCards}`, leftCenterX, textStartY + 74, 440);
    ctx.restore();

    // 4. Colonne centrale : PP centrée sur la méridienne + pseudo dessous
    const ppSize = 315;
    const ppX = Math.round((W - ppSize) / 2);
    const ppY = Math.round(MID_Y - ppSize / 2);
    const avatarUrl = (member?.user || member)?.displayAvatarURL?.({ extension: 'png', size: 1024 })
        || member?.displayAvatarURL?.({ extension: 'png', size: 1024 });

    ctx.save();
    ctx.shadowColor = 'rgba(241, 196, 15, 0.85)';
    ctx.shadowBlur = 38;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = isLight ? '#FFFFFF' : '#1E212D';
    drawRoundRect(ctx, ppX, ppY, ppSize, ppSize, 30);
    ctx.fill();
    ctx.restore();

    if (avatarUrl) {
        try {
            const avatarImg = await loadImage(avatarUrl);
            ctx.save();
            drawRoundRect(ctx, ppX, ppY, ppSize, ppSize, 30);
            ctx.clip();
            ctx.drawImage(avatarImg, ppX, ppY, ppSize, ppSize);
            ctx.restore();
        } catch {}
    }

    ctx.save();
    ctx.strokeStyle = '#F1C40F';
    ctx.lineWidth = 5;
    drawRoundRect(ctx, ppX, ppY, ppSize, ppSize, 30);
    ctx.stroke();
    ctx.restore();

    const masterName = formatMasterDisplayName(member);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = textColor;
    ctx.shadowColor = shadowCol;
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 3;
    drawFittedWrappedText(ctx, masterName, W / 2, ppY + ppSize + 26, 420, 36, 22, 16);
    ctx.restore();

    // 5. Colonne droite : Ensemble ("CARTE FLEXÉE" + Carte pleine résolution + Nom) centré sur la méridienne
    const rightCenterX = W - 330;
    const flexCard = (u?.favoriteCardId && (u?.cards?.[u.favoriteCardId] || 0) > 0 && getCardByIdAny(u.favoriteCardId))
        || cardById.get(EPSYS_FULL_ART_CARD_ID)
        || cardCatalog[0];

    const cW = 364;
    const cH = 510;
    const cX = Math.round(rightCenterX - cW / 2);

    if (flexCard) {
        const labelTopH = 26;
        const gapTop = 14;
        const gapBottom = 18;
        const nameLayout = computeFittedWrappedLines(ctx, flexCard.name, 360, 26, 15, 14);
        const nameTotalH = nameLayout.lines.length > 1
            ? (nameLayout.fontSize + nameLayout.lineH)
            : (nameLayout.fontSize || 26);

        const rightBlockTotalH = labelTopH + gapTop + cH + gapBottom + nameTotalH;
        const rightTopY = Math.round(MID_Y - rightBlockTotalH / 2);
        const cY = rightTopY + labelTopH + gapTop;

        // Libellé "CARTE PRÉFÉRÉE" juste au-dessus de la carte
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.font = 'bold 25px "LemonMilk", "Sans"';
        ctx.fillStyle = textColor;
        ctx.shadowColor = shadowCol;
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 3;
        ctx.fillText('CARTE PRÉFÉRÉE', rightCenterX, cY - gapTop, cW);
        ctx.restore();

        const meta = RARITY_META[flexCard.rarity] || RARITY_META['Commune'];
        if (flexCard.filePath && fs.existsSync(flexCard.filePath)) {
            const cImg = await loadImage(flexCard.filePath);
            ctx.save();
            ctx.shadowColor = meta.glow || 'rgba(255, 255, 255, 0.55)';
            ctx.shadowBlur = 32;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            ctx.drawImage(cImg, cX, cY, cW, cH);
            ctx.restore();
        }

        // Nom de la carte sous la carte
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = textColor;
        ctx.shadowColor = shadowCol;
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 3;
        ctx.font = `bold ${nameLayout.fontSize}px "LemonMilk", "Sans"`;
        nameLayout.lines.forEach((line, idx) => {
            ctx.fillText(line, rightCenterX, cY + cH + gapBottom + idx * nameLayout.lineH, 360);
        });
        ctx.restore();
    }

    const buffer = canvas.toBuffer('image/jpeg', { quality: 0.96, progressive: false, chromaSubsampling: false });
    canvas.width = canvas.height = 0;
    return buffer;
}

async function renderTradeRecapCanvas(nameA, cardsA, nameB, cardsB) {
    const W = 1360;
    const H = 680;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#151822';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#1E2331';
    drawRoundRect(ctx, 24, 24, W - 48, H - 48, 22);
    ctx.fill();

    // Titre + étoile dorée de chaque côté
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 30px "LemonMilk", "Sans"';
    const mainTitle = 'Échange RegaDex terminé';
    const mainTitleW = ctx.measureText(mainTitle).width;
    const mainTitleY = 66;
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 10;
    ctx.fillText(mainTitle, W / 2, mainTitleY, W - 200);
    ctx.restore();

    const starOff = (mainTitleW / 2) + 28;
    drawFivePointStar(ctx, (W / 2) - starOff, mainTitleY - 1, 13, 6, '#FFD700', 'rgba(255, 215, 0, 0.75)');
    drawFivePointStar(ctx, (W / 2) + starOff, mainTitleY - 1, 13, 6, '#FFD700', 'rgba(255, 215, 0, 0.75)');

    const boxY = 112;
    const boxH = H - 156;
    const boxW = 564;

    // Logo d'échange vert agrandi au centre des deux rectangles
    ctx.save();
    ctx.fillStyle = '#2ECC71';
    ctx.shadowColor = 'rgba(46, 204, 113, 0.45)';
    ctx.shadowBlur = 16;
    ctx.font = 'bold 74px "Sans"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⇄', W / 2, boxY + boxH / 2);
    ctx.restore();

    const drawSide = async (title, list, startX) => {
        // Rectangle gris clair avec ombre portée
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.52)';
        ctx.shadowBlur = 24;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 8;
        ctx.fillStyle = '#262C3D';
        drawRoundRect(ctx, startX, boxY, boxW, boxH, 18);
        ctx.fill();
        ctx.restore();

        // "OFFRE DE " en blanc + pseudo en doré uniquement
        const prefixTxt = 'Offre de ';
        const nameTxt = String(title || '');
        ctx.save();
        let fSize = 22;
        const maxHeaderW = boxW - 44;
        while (fSize > 13) {
            ctx.font = `bold ${fSize}px "LemonMilk", "Sans"`;
            if (ctx.measureText(prefixTxt).width + ctx.measureText(nameTxt).width <= maxHeaderW) break;
            fSize--;
        }
        const pW = ctx.measureText(prefixTxt).width;
        const nW = ctx.measureText(nameTxt).width;
        const sX = startX + (boxW - (pW + nW)) / 2;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(prefixTxt, sX, boxY + 38);
        ctx.fillStyle = '#FFD700';
        ctx.fillText(nameTxt, sX + pW, boxY + 38);
        ctx.restore();

        const cardsZoneTop = boxY + 68;
        const cardsZoneBottom = boxY + boxH - 18;

        if (list.length === 0) {
            ctx.save();
            ctx.fillStyle = '#AAAAAA';
            ctx.font = 'bold 20px "LemonMilk", "Sans"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Aucune carte', startX + boxW / 2, (cardsZoneTop + cardsZoneBottom) / 2, boxW - 40);
            ctx.restore();
            return;
        }

        let cW, cH, gap;
        if (list.length === 1) {
            cW = 240;
            cH = 336;
            gap = 0;
        } else if (list.length === 2) {
            cW = 215;
            cH = 301;
            gap = 34;
        } else {
            cW = 160;
            cH = 224;
            gap = 18;
        }

        const labelFontSize = list.length <= 2 ? 18 : 15;
        const labelBlockH = 12 + labelFontSize;
        const totalW = list.length * cW + (list.length - 1) * gap;
        const firstX = Math.round(startX + (boxW - totalW) / 2);
        const y = Math.round(cardsZoneTop + (cardsZoneBottom - cardsZoneTop - (cH + labelBlockH)) / 2);

        for (let i = 0; i < list.length; i++) {
            const card = cardById.get(list[i]);
            if (!card) continue;
            const x = firstX + i * (cW + gap);
            const proxy = await loadCardProxy(card, cW, cH, { glow: true });
            if (proxy?.img) ctx.drawImage(proxy.img, x - proxy.pad, y - proxy.pad);

            ctx.save();
            ctx.fillStyle = '#FFFFFF';
            ctx.font = `bold ${labelFontSize}px "LemonMilk", "Sans"`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
            ctx.shadowBlur = 6;
            ctx.fillText(card.id, x + cW / 2, y + cH + 12, cW + 10);
            ctx.restore();
        }
    };

    await drawSide(nameA, cardsA, 48);
    await drawSide(nameB, cardsB, W - 48 - boxW);

    return toJpeg(canvas, 0.90);
}

// ==========================================
//   EMBEDS & MENUS PRINCIPAUX (HUB, STORE, TOP, CRÉDITS)
// ==========================================

function buildAccueilButton(userId) {
    return new ButtonBuilder()
        .setCustomId(`tcg:hub:${userId}`)
        .setLabel('Accueil')
        .setEmoji('🏠')
        .setStyle(ButtonStyle.Secondary);
}

function buildCloseButton(userId) {
    return new ButtonBuilder()
        .setCustomId(`tcg:close:${userId}`)
        .setLabel('Fermer')
        .setEmoji('🗑️')
        .setStyle(ButtonStyle.Danger);
}

function buildProgressBar(current, total, length = 14) {
    if (!total || total <= 0) return '▱'.repeat(length);
    const ratio = Math.max(0, Math.min(1, current / total));
    const filled = Math.round(ratio * length);
    return '▰'.repeat(filled) + '▱'.repeat(length - filled);
}

function buildHubEmbed(member, u) {
    const comp = getUserCompletionStats(u);
    const nextTs = getNextBoosterTimestamp(u);
    const totalAvail = getTotalAvailableBoosters(u);
    const pct = comp.totalSet > 0 ? Math.round((comp.uniqueCount / comp.totalSet) * 100) : 0;
    const bar = buildProgressBar(comp.uniqueCount, comp.totalSet, 16);

    const timerLine = u.freeBoosters >= MAX_FREE_BOOSTERS
        ? '• Recharge : **Stock max (`2/2`)**'
        : `• Prochain : <t:${Math.floor(nextTs / 1000)}:R>`;

    const activeEffects = [];
    if (u.activeBonuses?.luckyBooster) activeEffects.push('🍀 **Booster Chanceux** *(sans Communes)*');
    if (u.activeBonuses?.halfCooldown) activeEffects.push('⚡ **Cooldown /2** *(3h)*');
    if (u.activeBonuses?.godPackBoostUntil && Date.now() < u.activeBonuses.godPackBoostUntil) {
        activeEffects.push(`🌟 **Taux God Pack ×5** *(fin <t:${Math.floor(u.activeBonuses.godPackBoostUntil / 1000)}:R>)*`);
    }
    if (u.pityRare) activeEffects.push('✨ **Pity Rare garantie**');

    const favCard = u.favoriteCardId && (u.cards?.[u.favoriteCardId] || 0) > 0
        ? getCardByIdAny(u.favoriteCardId)
        : null;

    const boosterLines = [
        `• Prêts à ouvrir : **${totalAvail}**`,
        `• Gratuits : **${u.freeBoosters}/${MAX_FREE_BOOSTERS}**`
    ];
    if ((u.inventory?.weeklyBooster || 0) > 0) {
        boosterLines.push(`• Hebdos (Vendredi) : **${u.inventory.weeklyBooster}/${MAX_WEEKLY_BOOSTERS}**`);
    }
    if ((u.inventory?.communityBooster || 0) > 0) {
        boosterLines.push(`• Communautaires : **${u.inventory.communityBooster}/${MAX_COMMUNITY_BOOSTERS}**`);
    }
    if ((u.inventory?.masterBooster || 0) > 0) {
        boosterLines.push(`• De Maître : **${u.inventory.masterBooster}**`);
    }
    if ((u.inventory?.booster || 0) > 0) {
        boosterLines.push(`• Bonus / Achetés : **${u.inventory.booster}**`);
    }
    if ((u.inventory?.fiveCardBooster || 0) > 0) {
        boosterLines.push(`• Boosters 5 cartes : **${u.inventory.fiveCardBooster}**`);
    }
    boosterLines.push(timerLine);

    const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setAuthor({
            name: `${member.displayName} • RegaDex TCG`,
            iconURL: member.displayAvatarURL({ dynamic: true })
        })
        .setTitle(`🃏 Tableau de bord — ${SET1_NAME}`)
        .setDescription(
            `Bienvenue dans ton espace **RegaDex** !\n` +
            `Ouvre tes boosters, remplis ton classeur et échange tes cartes.\n\n` +
            `### 📚 Progression ${SET1_NAME}\n` +
            `\`${bar}\` **${pct}%** — **${comp.uniqueCount}/${comp.totalSet}** découvertes *(${comp.totalCopies} au total)*\n\n` +
            `🧰 **Items :** \`${comp.byCategory['Items'].owned}/${comp.byCategory['Items'].total}\`  •  ` +
            `🧑 **Persos :** \`${comp.byCategory['Personnages'].owned}/${comp.byCategory['Personnages'].total}\`  •  ` +
            `🎬 **Réfs :** \`${comp.byCategory['Références'].owned}/${comp.byCategory['Références'].total}\`\n` +
            `────────────────────────────────────────`
        )
        .addFields(
            {
                name: '🎁 Tes Boosters',
                value: boosterLines.join('\n'),
                inline: true
            },
            {
                name: '🪙 Ton Profil',
                value:
                    `• Solde : **${u.points} pts**\n` +
                    `• Thème : ${u.theme === 'W' ? '☀️ Mode Clair' : '🌙 Mode Nuit'}\n` +
                    `• Flex : ${favCard ? `\`${favCard.id}\` ${favCard.name}` : '*Aucune carte*'}`,
                inline: true
            }
        )
        .setFooter({ text: `RegaDex TCG • ${SET1_NAME} — Clique sur 📘 Guide si tu débutes` });

    if (activeEffects.length > 0) {
        embed.addFields({
            name: '🔥 Effets actifs sur tes prochains boosters',
            value: activeEffects.join('\n'),
            inline: false
        });
    }

    // Quête communautaire hebdomadaire (en dernier avec séparateur)
    const quest = getOrEnsureCommunityQuest();
    const { nextResetTs } = getCurrentQuestWeekInfoParis();
    const qBar = buildProgressBar(quest.progress, quest.target, 16);
    const qPct = quest.target > 0 ? Math.min(100, Math.round((quest.progress / quest.target) * 100)) : 0;
    const qLines = quest.completed
        ? [
            `• ✅ **Quête terminée !** *(Récompenses envoyées aux **${quest.participants.length}** participant.es)*`,
            `• 🔄 Prochaine quête : <t:${nextResetTs}:R>`
        ]
        : [
            `• Récompense : **2 boosters communautaires** + **15 pts**`,
            `• Participant.es : **${quest.participants.length}** *(ouvre 1 booster pour participer)*`,
            `• Fin : <t:${nextResetTs}:R>`
        ];
    embed.addFields({
        name: '\u200b',
        value:
            `────────────────────────────────────────\n` +
            `**🌍 Quête communautaire de la semaine**\n` +
            `\`${qBar}\` **${qPct}%** — **${quest.progress}/${quest.target}** *(${quest.label.replace(/\*\*/g, '')})*\n\n` +
            qLines.join('\n'),
        inline: false
    });

    if (assetPaths.eventBanner && fs.existsSync(assetPaths.eventBanner)) {
        embed.setImage('attachment://event_banner_set1.png');
    }

    return embed;
}

function buildHubComponents(userId, u) {
    const totalAvail = getTotalAvailableBoosters(u);
    const data = getStoreData();
    const hasNotif = Boolean(data.notifs?.[userId]);

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:open:${userId}:1`)
            .setLabel(`Ouvrir (${totalAvail})`)
            .setEmoji('🎁')
            .setStyle(ButtonStyle.Success)
            .setDisabled(totalAvail <= 0)
    );
    if ((u.inventory?.fiveCardBooster || 0) > 0) {
        row1.addComponents(
            new ButtonBuilder()
                .setCustomId(`tcg:open5:${userId}:1`)
                .setLabel(`Ouvrir 5 cartes (${u.inventory.fiveCardBooster})`)
                .setEmoji('🎴')
                .setStyle(ButtonStyle.Success)
        );
    }
    row1.addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:binder:open:${userId}:${userId}:1`)
            .setLabel('Classeur')
            .setEmoji('📖')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`tcg:profile:${userId}:1:0`)
            .setLabel('Mon profil')
            .setEmoji('👤')
            .setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:store:open:${userId}:1`)
            .setLabel('Store')
            .setEmoji('🛒')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`tcg:claim:open:${userId}:1`)
            .setLabel('Inventaire')
            .setEmoji('🎒')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`tcg:top:total:${userId}:1`)
            .setLabel('Top')
            .setEmoji('🏆')
            .setStyle(ButtonStyle.Secondary)
    );

    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:notif:menu:${userId}:1`)
            .setLabel(hasNotif ? 'Notifications ✓' : 'Notifications')
            .setEmoji('🔔')
            .setStyle(hasNotif ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`tcg:guide:${userId}:1`)
            .setLabel('Guide')
            .setEmoji('📘')
            .setStyle(ButtonStyle.Secondary),
        buildCloseButton(userId)
    );

    return [row1, row2, row3];
}

function buildProfilePayload(member, u, fromHub = false, showRarities = false) {
    const comp = getUserCompletionStats(u, DEFAULT_SET_NUMBER);
    const pct = comp.totalSet > 0 ? Math.round((comp.uniqueCount / comp.totalSet) * 100) : 0;
    const msgCur = u.msgProgress || 0;
    const vocCur = u.vocalMinutes || 0;

    let rarestCard = null;
    for (const c of cardCatalog) {
        if ((u.cards?.[c.id] || 0) <= 0) continue;
        if (!rarestCard) {
            rarestCard = c;
            continue;
        }
        const ra = RARITY_ORDER[rarestCard.rarity] ?? 0;
        const rb = RARITY_ORDER[c.rarity] ?? 0;
        if (rb > ra || (rb === ra && c.isHolo && !rarestCard.isHolo)) {
            rarestCard = c;
        }
    }

    const rarestMeta = rarestCard ? (RARITY_META[rarestCard.rarity] || RARITY_META['Commune']) : null;
    const rarestLine = rarestCard
        ? `${rarestMeta.emoji} \`${rarestCard.id}\` **${rarestCard.name}** (*${rarestCard.rarity}*${rarestCard.isHolo ? ' • Holo' : ''})`
        : '*Aucune carte obtenue pour le moment*';

    const favCard = u.favoriteCardId && (u.cards?.[u.favoriteCardId] || 0) > 0
        ? getCardByIdAny(u.favoriteCardId)
        : null;

    const unlockedSet1 = Array.isArray(u.completionMilestones?.['1']) ? u.completionMilestones['1'] : [];
    const milestoneTags = COMPLETION_MILESTONES.map(m =>
        `${unlockedSet1.includes(m.pct) ? '✅' : '⬜'} ${m.pct}%`
    ).join(' • ');

    const masteredKeys = Object.keys(u.masteredSets || {}).sort((a, b) => Number(a) - Number(b));
    const masterRanksLine = masteredKeys.length > 0
        ? masteredKeys.map(k => `🏆 **Maître du ${getSetConfig(Number(k)).name}**`).join(' • ')
        : '*Aucun rang de Maître pour le moment*';
    const godBoostLine = (u.activeBonuses?.godPackBoostUntil && Date.now() < u.activeBonuses.godPackBoostUntil)
        ? `\n• 🌟 **Taux God Pack ×5 :** actif jusqu'au <t:${Math.floor(u.activeBonuses.godPackBoostUntil / 1000)}:F>`
        : '';

    const wishlistIds = getSanitizedWishlist(u);
    const wishlistSummary = wishlistIds.length > 0
        ? wishlistIds.map(id => {
            const c = cardById.get(id);
            const owned = (u.cards?.[id] || 0) > 0;
            return owned && c ? `\`${id}\` ${c.name}` : `\`${id}\` *(🔒)*`;
        }).join(', ')
        : '*Vide (`!tcgwishlist` pour ajouter jusqu\'à 5 cartes)*';

    let rarityBlock = '';
    if (showRarities) {
        const rarityLines = RARITY_LIST.map(r => {
            const meta = RARITY_META[r] || RARITY_META['Commune'];
            let totalInRarity = 0;
            let uniqueOwned = 0;
            let copiesOwned = 0;
            for (const c of cardCatalog) {
                if (c.rarity !== r) continue;
                totalInRarity++;
                const q = u.cards?.[c.id] || 0;
                if (q > 0) {
                    uniqueOwned++;
                    copiesOwned += q;
                }
            }
            return `${meta.emoji} **${r} :** **${copiesOwned}** carte${copiesOwned > 1 ? 's' : ''} *(\`${uniqueOwned}/${totalInRarity}\` uniques)*`;
        });
        rarityBlock = `\n────────────────────────────────────────\n### 💎 Cartes par rareté\n${rarityLines.join('\n')}`;
    }

    const embed = new EmbedBuilder()
        .setColor(0x9b59b6)
        .setAuthor({
            name: `Profil RegaDex • ${member.displayName}`,
            iconURL: member.displayAvatarURL({ dynamic: true })
        })
        .setTitle(`👤 Mon profil & Statistiques ${SET1_NAME}`)
        .setDescription(
            `### 🎯 Progression Points RegaDex *(Solde : **${u.points} pts**)*\n` +
            `• 💬 **Messages :** \`${buildProgressBar(msgCur, MESSAGES_PER_POINT, 10)}\` **${msgCur}/${MESSAGES_PER_POINT}** *(+1 pt à 15)*\n` +
            `• 🎙️ **Vocal :** \`${buildProgressBar(vocCur, VOCAL_MINUTES_PER_POINT, 10)}\` **${vocCur}/${VOCAL_MINUTES_PER_POINT} min** *(+1 pt / 10 min, ≥ 3 membres, hors AFK)*\n` +
            `-# 💡 Autres gains : Roulette **+1 pt** • Booster ouvert **+5 pts** • Doublon **+3 pts** • Échange **+3 pts** *(1×/fil)*\n` +
            `────────────────────────────────────────\n` +
            `### 📊 Statistiques de collection\n` +
            `• 🎁 **Boosters ouverts :** **${u.stats?.boostersOpened || 0}**\n` +
            `• 🃏 **Cartes obtenues :** **${comp.totalCopies}** au total *(\`${comp.uniqueCount}/${comp.totalSet}\` uniques — **${pct}%**)*\n` +
            `• 🏆 **Paliers Set 1 :** ${milestoneTags}\n` +
            `• 👑 **Rang(s) de Maître :** ${masterRanksLine}${godBoostLine}\n` +
            `• 🔁 **Doublons obtenus :** **${u.stats?.duplicatesObtained || 0}**\n` +
            `• 🔄 **Échanges effectués :** **${u.stats?.tradesCompleted || 0}**\n` +
            `• 💎 **Carte la plus rare :** ${rarestLine}\n` +
            `• ⭐ **Carte Flex :** ${favCard ? `\`${favCard.id}\` **${favCard.name}**` : '*Aucune*'}\n` +
            `• ❤️ **Wishlist (${wishlistIds.length}/${MAX_WISHLIST}) :** ${wishlistSummary}` +
            rarityBlock
        )
        .setFooter({ text: `RegaDex TCG • ${SET1_NAME}` });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:profile:${member.id}:${fromHub ? '1' : '0'}:${showRarities ? '0' : '1'}`)
            .setLabel(showRarities ? 'Nb cartes par rareté : ON' : 'Nb cartes par rareté : OFF')
            .setEmoji('💎')
            .setStyle(showRarities ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`tcg:wish:open:${member.id}:${fromHub ? '1' : '0'}:1`)
            .setLabel(`Wishlist (${wishlistIds.length}/${MAX_WISHLIST})`)
            .setEmoji('❤️')
            .setStyle(ButtonStyle.Secondary),
        buildAccueilButton(member.id),
        buildCloseButton(member.id)
    );

    return { embeds: [embed], components: [row] };
}

const WISH_FILTER_ORDER = ['missing', 'dups', 'all', 'owned'];
const WISH_FILTER_LABELS = {
    missing: 'Manquantes',
    dups: 'Dispo en doublon',
    all: 'Toutes les cartes',
    owned: 'Possédées'
};

function buildWishlistPayload(ownerMember, viewerId, fromHub = false, fromProfile = false, statusNote = null, options = {}) {
    const ownerId = ownerMember.id;
    const ownerU = getOrCreateTcgUser(ownerId);
    const viewerU = getOrCreateTcgUser(viewerId);
    const canEdit = canControlTcgOwner(viewerId, ownerId);
    const wishlistIds = getSanitizedWishlist(ownerU);
    ownerU.wishlist = wishlistIds;

    const hubFlag = fromHub ? '1' : '0';
    const profFlag = fromProfile ? '1' : '0';
    const addFilter = WISH_FILTER_ORDER.includes(options.addFilter) ? options.addFilter : 'missing';

    const lines = wishlistIds.length === 0
        ? ['*Aucune carte dans cette Wishlist pour le moment.*']
        : wishlistIds.map((id, idx) => {
            const c = cardById.get(id);
            const viewerOwns = (viewerU.cards?.[id] || 0) > 0;
            const ownerQty = ownerU.cards?.[id] || 0;
            const ownedTag = ownerQty > 0 ? ` *(déjà obtenue ×${ownerQty})*` : '';
            if (viewerOwns && c) {
                const meta = RARITY_META[c.rarity] || RARITY_META['Commune'];
                return `**${idx + 1}.** ${meta.emoji} \`${c.id}\` **${c.name}** *(${c.rarity})*${ownedTag}`;
            }
            return `**${idx + 1}.** 🔒 \`${id}\` *(Carte non découverte)*${ownedTag}`;
        });

    const embed = new EmbedBuilder()
        .setColor(0xe91e63)
        .setAuthor({
            name: `Wishlist RegaDex • ${ownerMember.displayName || ownerMember.username || 'Membre'}`,
            iconURL: (ownerMember.user || ownerMember).displayAvatarURL?.({ dynamic: true }) || undefined
        })
        .setTitle(`❤️ Wishlist RegaDex (${wishlistIds.length}/${MAX_WISHLIST})`)
        .setDescription(
            (statusNote ? `${statusNote}\n\n` : '') +
            lines.join('\n') +
            `\n\n-# 💡 Les cartes de ta Wishlist apparaissent tout en haut avec un ❤️ quand un membre te propose un \`!trade\`.`
        )
        .setFooter({ text: `Maximum ${MAX_WISHLIST} cartes • !wishlist [n° ou nom]` });

    const components = [];

    if (canEdit) {
        if (wishlistIds.length > 0) {
            const remMenu = new StringSelectMenuBuilder()
                .setCustomId(`tcg:wish:remsel:${ownerId}:${hubFlag}:${profFlag}`)
                .setPlaceholder('💔 Retirer une carte de ta Wishlist...')
                .addOptions(wishlistIds.map(id => {
                    const c = cardById.get(id);
                    const owned = (viewerU.cards?.[id] || 0) > 0;
                    return {
                        label: owned && c ? `${id} • ${c.name}`.slice(0, 100) : `🔒 ${id} • Carte non découverte`,
                        description: owned && c ? `${c.rarity} • Retirer de la Wishlist` : 'Retirer de la Wishlist',
                        value: id
                    };
                }));
            components.push(new ActionRowBuilder().addComponents(remMenu));
        }

        if (wishlistIds.length < MAX_WISHLIST) {
            const wishSet = new Set(wishlistIds);
            const dupsCache = new Map();
            const getDupsCount = (cid) => {
                if (!dupsCache.has(cid)) dupsCache.set(cid, getCardDuplicateOwners(cid, ownerId).length);
                return dupsCache.get(cid);
            };

            const pool = cardCatalog.filter(c => {
                if (wishSet.has(c.id)) return false;
                const qty = ownerU.cards?.[c.id] || 0;
                if (addFilter === 'missing') return qty <= 0;
                if (addFilter === 'dups') return qty <= 0 && getDupsCount(c.id) > 0;
                if (addFilter === 'owned') return qty > 0;
                return true;
            });

            if (pool.length > 0) {
                const perPage = pool.length > 25 ? 23 : 25;
                const totalPages = Math.max(1, Math.ceil(pool.length / perPage));
                const safePage = Math.max(0, Math.min(options.addPage || 0, totalPages - 1));
                const slice = pool.slice(safePage * perPage, (safePage + 1) * perPage);
                const opts = [];

                if (totalPages > 1 && safePage > 0) {
                    opts.push({
                        label: `⬅️ Page précédente (${safePage}/${totalPages})`,
                        description: 'Voir les cartes précédentes',
                        value: `__page:${safePage - 1}`
                    });
                }

                for (const c of slice) {
                    const meta = RARITY_META[c.rarity] || RARITY_META['Commune'];
                    const viewerOwns = (viewerU.cards?.[c.id] || 0) > 0;
                    const dupsCount = getDupsCount(c.id);
                    const dupsTxt = dupsCount > 0 ? `👥 ${dupsCount} en doublon` : 'Aucun doublon dispo';
                    opts.push({
                        label: viewerOwns
                            ? `${c.id} • ${c.name}`.slice(0, 100)
                            : `🔒 ${c.id} • Carte non découverte (${c.category})`.slice(0, 100),
                        description: viewerOwns
                            ? `${meta.emoji} ${c.rarity} • ×${viewerU.cards[c.id]} • ${dupsTxt}`.slice(0, 100)
                            : `${meta.emoji} ${c.rarity} • ${dupsTxt}`.slice(0, 100),
                        value: c.id
                    });
                }

                if (totalPages > 1 && safePage < totalPages - 1) {
                    opts.push({
                        label: `➡️ Page suivante (${safePage + 2}/${totalPages})`,
                        description: 'Voir la suite des cartes',
                        value: `__page:${safePage + 1}`
                    });
                }

                const addMenu = new StringSelectMenuBuilder()
                    .setCustomId(`tcg:wish:addsel:${ownerId}:${hubFlag}:${profFlag}:${addFilter}`)
                    .setPlaceholder(`➕ Ajouter (${WISH_FILTER_LABELS[addFilter]} • ${safePage + 1}/${totalPages})...`)
                    .addOptions(opts);
                components.push(new ActionRowBuilder().addComponents(addMenu));
            }
        }

        const nextFilter = WISH_FILTER_ORDER[(WISH_FILTER_ORDER.indexOf(addFilter) + 1) % WISH_FILTER_ORDER.length];
        const rowActions = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`tcg:wish:add:${ownerId}:${hubFlag}:${profFlag}`)
                .setLabel('Chercher (nom/n°)')
                .setEmoji('🔎')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(wishlistIds.length >= MAX_WISHLIST),
            new ButtonBuilder()
                .setCustomId(`tcg:wish:filter:${nextFilter}:${ownerId}:${hubFlag}:${profFlag}`)
                .setLabel(`Filtre : ${WISH_FILTER_LABELS[addFilter]}`)
                .setEmoji('🎯')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(wishlistIds.length >= MAX_WISHLIST),
            new ButtonBuilder()
                .setCustomId(`tcg:wish:clear:${ownerId}:${hubFlag}:${profFlag}`)
                .setLabel('Vider')
                .setEmoji('🧹')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(wishlistIds.length === 0)
        );
        components.push(rowActions);

        const rowNav = new ActionRowBuilder();
        if (fromProfile) {
            rowNav.addComponents(
                new ButtonBuilder()
                    .setCustomId(`tcg:profile:${ownerId}:${hubFlag}:0`)
                    .setLabel('Retour Profil')
                    .setEmoji('👤')
                    .setStyle(ButtonStyle.Secondary)
            );
        }
        rowNav.addComponents(buildAccueilButton(viewerId), buildCloseButton(viewerId));
        components.push(rowNav);
    } else {
        components.push(new ActionRowBuilder().addComponents(buildAccueilButton(viewerId), buildCloseButton(viewerId)));
    }

    return { embeds: [embed], components };
}

function buildHelpPayload(userId) {
    const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTitle('📖 Commandes utiles — RegaDex TCG')
        .setDescription(
            `Voici toutes les commandes disponibles pour naviguer rapidement dans le **RegaDex** :\n` +
            `────────────────────────────────────────\n` +
            `### 🃏 Menu & Infos\n` +
            `• \`!tcg\` • \`!regadex\` • \`!rgdx\` — Ouvrir le **Tableau de bord**\n` +
            `• \`!tcg profil\` — Ton profil RegaDex, quêtes de points & stats\n` +
            `• \`!tcg help\` • \`!tcghelp\` *(ou avec \`regadex\`/\`rgdx\`)* — Afficher ce mémo\n` +
            `• \`!tcg guide\` — Règles détaillées & taux de tirage\n` +
            `• \`!tcg credits\` — Crédits & remerciements\n\n` +
            `### 🎁 Boosters & Alertes\n` +
            `• \`!open\` • \`!booster\` • \`!tcggo\` • \`!tcgbooster\` — Ouvrir un booster ou voir ton timer\n` +
            `• \`!tcgnotif\` — Configurer tes notifications de booster *(choix permanent, ici ou en MP)*\n\n` +
            `### 📚 Collection, Wishlist & Classement\n` +
            `• \`!classeur\` *(\`@membre\` pour demander l'accès à un autre)*\n` +
            `• \`!carte [n° ou nom]\` — Inspecter une carte & voir **qui l'a en doublon**\n` +
            `• \`!wishlist\` *(\`!tcgwishlist\`)* — Gérer tes **${MAX_WISHLIST} cartes recherchées**\n` +
            `• \`!tcgtop\` — Classement du serveur\n\n` +
            `### 🛒 Boutique, Échanges & Flex\n` +
            `• \`!tcgstore\` — Dépenser tes points RegaDex\n` +
            `• \`!tcgclaim\` — Inventaire, achats & boosters hebdomadaires *(vendredi 8h)*\n` +
            `• \`!trade [@membre]\` — Lancer un échange *(tous types d'échanges autorisés)*\n` +
            `• \`!flex\` *(\`!tcgflex\`)* — Montrer ta carte préférée *(<#${TCG_CHANNEL_ID}> & <#${SHITPOST_CHANNEL_ID}>)* • \`!flex @membre\`\n` +
            `• \`!flexmodify [N°Set]-[N°Carte]\` pour la changer\n` +
            `────────────────────────────────────────\n` +
            `💡 *Les slash commands \`/regadex\` fonctionnent aussi, et toutes les commandes \`!tcg\` / \`!regadex\` / \`!rgdx\` marchent avec ou sans espace !*`
        )
        .setFooter({ text: `RegaDex ${SET1_NAME} • Cacabot` });

    const row = new ActionRowBuilder().addComponents(
        buildAccueilButton(userId),
        new ButtonBuilder()
            .setCustomId(`tcg:guide:${userId}:1`)
            .setLabel('Guide complet')
            .setEmoji('📘')
            .setStyle(ButtonStyle.Secondary),
        buildCloseButton(userId)
    );

    return { embeds: [embed], components: [row] };
}

function buildGuidePayload(userId, fromHub = true) {
    const sep = '\n────────────────────────────────────────\n';

    const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle(`📘 Guide complet du RegaDex TCG — ${SET1_NAME}`)
        .setDescription(
            `Collectionne les **109 cartes** du **${SET1_NAME}** *(Items, Personnages & Références)* en ouvrant des boosters et en échangeant tes cartes !\n` +
            sep +
            `### 🎁 1. Boosters & Notifications\n` +
            `• Tu reçois **1 booster gratuit toutes les 6h** *(max **2** en attente)*.\n` +
            `• **Bonus du vendredi 8h 📅 :** un booster offert chaque vendredi *(stock hebdo limité à **2/2** max)*.\n` +
            `• **Quêtes communautaires 🤝 :** chaque lundi 8h, un objectif collectif ! Tous ceux ayant ouvert un booster avant la fin gagnent **2 boosters communautaires** + **15 pts**.\n` +
            `• Chaque booster contient **3 cartes uniques**, révélées de la plus commune à la plus rare *(1% de chance de **God Pack** !)*. \n` +
            `• **Système de Pity :** si un booster ne te donne que **3 Communes**, ton prochain booster garantit au moins **1 carte Rare**.\n` +
            `• **Notifications 🔔 :** règle ton choix une bonne fois pour toutes *(à chaque booster ou à 2/2, ici ou en MP)* — il reste sauvegardé même après avoir atteint 2/2 et est modifiable/désactivable à tout moment !` +
            sep +
            `### ✨ 2. Raretés, Holos & Négatives\n` +
            `• **Taux de tirage :**\n` +
            `  ⚪ Commune \`65%\` • 🔵 Rare \`22%\` • 🟣 Épique \`8%\`\n` +
            `  🟡 Légendaire \`3%\` • 🌈 Full Art \`1,5%\` • 🕳️ Négative \`0,5%\`\n` +
            `• **Cartes Holographiques :** certaines cartes ont une version *Holo* avec leur propre numéro, **2× plus rare** que l'originale.\n` +
            `• **Cartes Négatives :** **13 cartes secrètes** numérotées \`1-Ø1\` à \`1-Ø13\`, les plus rares du ${SET1_NAME}.` +
            sep +
            `### 🪙 3. Points RegaDex & Store\n` +
            `• **Comment gagner des points :**\n` +
            `  15 messages = **+1pt** • 10 min en vocal *(≥ 3 membres, hors AFK)* = **+1pt**\n` +
            `  1 roulette = **+1pt** *(+ gains rares)* • 1 booster ouvert = **+5pts** • 1 doublon = **+3pts**\n` +
            `  1 fil d'échange terminé = **+3pts** *(1×/fil)* • Victoire Motus/Rébus/Pendu = **+2pts**\n` +
            `  **Paliers de complétion :** **+15pts** à \`25%\`, \`50%\`, \`75%\` • **+25pts + 2 boosters de Maître** à \`100%\`\n` +
            `• **RegaDex Store (\`🛒 Store\`) :** les boosters achetés sont **prêts à ouvrir** tout de suite, et les bonus vont dans ton **🎒 Inventaire** (\`!tcgclaim\`) :\n` +
            `  • 🎁 **Booster** (\`100 pts\`) — Un booster supplémentaire à ouvrir.\n` +
            `  • 🍀 **Chanceux** (\`75 pts\`) — Retire toutes les *Communes* du prochain booster.\n` +
            `  • ✨ **Transfo Holo** (\`50 pts\`) — Transforme une carte compatible possédée en *Holo*.\n` +
            `  • ⚡ **Cooldown /2** (\`25 pts\`) — Le prochain rechargement gratuit passe à **3h** au lieu de 6h.\n` +
            `  • 🌟 **Taux God Pack ×5 (5j)** (\`150 pts\`) — Multiplie par 5 tes chances de **God Pack** pendant 5 jours.\n` +
            `  • 🎴 **Booster 5 cartes** (\`175 pts\`) — Un booster de **5 cartes** *(sans toucher à ton cooldown gratuit)*.\n` +
            `  • 🕳️ **Full Art → Négative** (\`1000 pts\`) — Transforme une carte **Full Art** possédée en sa version **Négative**.` +
            sep +
            `### 📖 4. Classeur, Wishlist, Échanges & Commandes\n` +
            `• **Classeur :** filtre par catégorie, rareté ou affichage (**Tout** / **Possédées** / **Doublons**), choisis la grille (\`4\`, \`18\`, \`36\` ou \`All\`) et change le thème **Clair (W) / Nuit (B)**.\n` +
            `• **Wishlist & Doublons :** ajoute jusqu'à **5 cartes** dans ta \`!wishlist\` *(mises en avant dans \`!trade\`)* et utilise le bouton sous \`!carte\` ou \`Inspecter\` pour voir **qui a une carte en doublon** !\n` +
            `• **Échanges (\`!trade [@]\` ou clic droit sur un membre) :** échange jusqu'à **3 cartes** sans restriction *(dons, dernières copies et raretés différentes autorisés, avec avertissement et double confirmation si inéquitable)* ! Gagne **+3 pts RegaDex** à la fermeture du fil *(1 seul bonus par fil)*.\n` +
            `• **Commandes rapides :** \`!tcg\` • \`!tcghelp\` • \`!open\` / \`!tcggo\` / \`!tcgbooster\` • \`!tcgclaim\` • \`!carte [n°/nom]\` • \`!flex\` *(<#${TCG_CHANNEL_ID}> & <#${SHITPOST_CHANNEL_ID}>)*`
        )
        .setFooter({ text: `RegaDex ${SET1_NAME} • Cacabot` });

    const components = [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`tcg:help:${userId}:1`)
                .setLabel('Commandes')
                .setEmoji('📖')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`tcg:credits:${userId}:1`)
                .setLabel('Crédits')
                .setEmoji('📜')
                .setStyle(ButtonStyle.Secondary),
            buildAccueilButton(userId),
            buildCloseButton(userId)
        )
    ];

    return { embeds: [embed], components };
}

function buildHubPayload(member, u) {
    const embed = buildHubEmbed(member, u);
    const components = buildHubComponents(member.id, u);
    const files = [];
    if (assetPaths.eventBanner && fs.existsSync(assetPaths.eventBanner)) {
        files.push(new AttachmentBuilder(assetPaths.eventBanner, { name: 'event_banner_set1.png' }));
    }
    return { embeds: [embed], components, files };
}

function buildCreditsPayload(userId, fromHub = true) {
    const embed = new EmbedBuilder()
        .setColor(0xE67E22)
        .setTitle('📜 Crédits & Remerciements — RegaDex TCG')
        .setDescription(
            `────────────────────────────────────────\n` +
            `Merci à <@704593833421438996> d'héberger Cacabot, ce qui me permet de créer ce genre de jeux pour vous;\n` +
            `Merci aussi à <@1070742213635625050> de m'avoir donné quelques inspirations pour créer les cartes;\n` +
            `Merci infiniment à ma femme <@738191002187202630> qui m'a aidée et soutenue tout du long ❤️;\n` +
            `Sans oublier <@390562565417336834>, la bêta-testeuse officielle du TCG, qui est toujours présente pour m'aider à vous offrir la meilleure qualité visuelle possible.\n\n` +
            `Et surtout, merci à toutes les personnes qui ouvrent des boosters, complètent leur classeur et font vivre le **RegaDex** sur **Regaïa** ! 💜\n` +
            `Chaque carte du ${SET1_NAME} a été imaginée et montée avec soin pour la communauté.\n\n` +
            `— ***Epsys***\n` +
            `────────────────────────────────────────`
        )
        .addFields(
            {
                name: '🎨 Sites & Ressources utilisés pour les assets',
                value:
                    `• **[TextureLabs](${CREDITS_LINKS.texturelabs})** — Textures et effets graphiques\n` +
                    `• **[VectorStock](${CREDITS_LINKS.vectorstock})** — Éléments vectoriels\n` +
                    `• **[Magnific](${CREDITS_LINKS.magnific})** — FX haute définition\n` +
                    `• **[PNGimg](${CREDITS_LINKS.pngimg})** — Ressources PNG détourées\n` +
                    `• **[MetalForge](${CREDITS_LINKS.metalforge})** — Effets et textures métalliques\n` +
                    `────────────────────────────────────────`,
                inline: false
            },
            {
                name: '⚠️ Note de prévention — Utilisation d\'IA',
                value:
                    `De l'intelligence artificielle a pu être utilisée sur certaines cartes **purement** à des fins d'**upscaling** *(amélioration de la résolution et de la netteté)*, ou pour de légères retouches visuelles sur certains détails *(comme la **67 Full Art** et la **Maid Dress Légendaire**)*.\n` +
                    `**Aucune carte** n'a été **imaginée** ou **générée à 100 %** par intelligence artificielle.\n` +
                    `────────────────────────────────────────`,
                inline: false
            }
        )
        .setFooter({ text: 'RegaDex • Créé par Epsys, pour Regaïa' });

    const components = [
        new ActionRowBuilder().addComponents(
            buildAccueilButton(userId),
            buildCloseButton(userId)
        )
    ];

    return { embeds: [embed], components };
}

function buildOpenPromptPayload(member, u, fromHub = false) {
    const totalAvail = getTotalAvailableBoosters(u);
    const nextTs = getNextBoosterTimestamp(u);
    const data = getStoreData();
    const hasNotif = Boolean(data.notifs?.[member.id]);
    const hubSuffix = fromHub ? ':1' : '';

    const unactivatedReminders = [];
    if ((u.inventory?.luckyBooster || 0) > 0 && !u.activeBonuses?.luckyBooster) {
        unactivatedReminders.push(`🍀 **Booster Chanceux** (\`${u.inventory.luckyBooster}\` en inventaire)`);
    }
    if ((u.inventory?.halfCooldown || 0) > 0 && !u.activeBonuses?.halfCooldown) {
        unactivatedReminders.push(`⚡ **Cooldown /2** (\`${u.inventory.halfCooldown}\` en inventaire)`);
    }
    if ((u.inventory?.godPackBoost || 0) > 0 && !(u.activeBonuses?.godPackBoostUntil && Date.now() < u.activeBonuses.godPackBoostUntil)) {
        unactivatedReminders.push(`🌟 **Taux God Pack ×5** (\`${u.inventory.godPackBoost}\` en inventaire)`);
    }
    const reminderBlock = unactivatedReminders.length > 0
        ? `\n\n💡 *Rappel : tu as des bonus non activés dans ton inventaire (\`!regadex claim\`) :*\n${unactivatedReminders.map(r => `• ${r}`).join('\n')}`
        : '';

    const extraSegments = [];
    if ((u.inventory?.weeklyBooster || 0) > 0) extraSegments.push(`📅 **Hebdos (Vendredi) :** \`${u.inventory.weeklyBooster}/${MAX_WEEKLY_BOOSTERS}\``);
    if ((u.inventory?.communityBooster || 0) > 0) extraSegments.push(`🤝 **Communautaires :** \`${u.inventory.communityBooster}/${MAX_COMMUNITY_BOOSTERS}\``);
    if ((u.inventory?.masterBooster || 0) > 0) extraSegments.push(`🏆 **De Maître :** \`${u.inventory.masterBooster}\``);
    if ((u.inventory?.booster || 0) > 0) extraSegments.push(`🛒 **Bonus / Achetés :** \`${u.inventory.booster}\``);
    const fiveCardCount = u.inventory?.fiveCardBooster || 0;
    const extraLine = extraSegments.length > 0 ? ` • ${extraSegments.join(' • ')}` : '';
    const fiveLine = fiveCardCount > 0 ? `\n🎴 **Boosters 5 cartes en stock :** \`${fiveCardCount}\`` : '';

    const desc = (totalAvail > 0 || fiveCardCount > 0)
        ? `### Vous avez **${totalAvail + fiveCardCount} booster${(totalAvail + fiveCardCount) > 1 ? 's' : ''} prêt${(totalAvail + fiveCardCount) > 1 ? 's' : ''} à ouvrir** !\nEn ouvrir un maintenant ?\n\n` +
          `🎁 **Gratuits :** \`${u.freeBoosters}/${MAX_FREE_BOOSTERS}\`${extraLine}${fiveLine}` +
          (nextTs ? `\n⏱️ Prochain booster gratuit <t:${Math.floor(nextTs / 1000)}:R>` : '\n✅ Jauge gratuite pleine (`2/2`)') +
          reminderBlock
        : `### Vous n'avez aucun booster disponible pour le moment.\n` +
          `⏱️ Prochain booster gratuit <t:${Math.floor(nextTs / 1000)}:R>\n` +
          `💡 Tu peux aussi acheter un booster à **${STORE_PRICES.booster} pts** dans le Store *(Solde : **${u.points} pts**)*.`;

    const embed = new EmbedBuilder()
        .setColor((totalAvail > 0 || fiveCardCount > 0) ? 0x2ecc71 : 0x95a5a6)
        .setAuthor({ name: `Boosters de ${member.displayName}`, iconURL: member.displayAvatarURL({ dynamic: true }) })
        .setTitle(`🃏 Booster ${SET1_NAME} — RegaDex`)
        .setDescription(desc);

    const files = [];
    if (assetPaths.boosterPng && fs.existsSync(assetPaths.boosterPng)) {
        files.push(new AttachmentBuilder(assetPaths.boosterPng, { name: 'booster_set1.png' }));
        embed.setThumbnail('attachment://booster_set1.png');
    }

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:open:${member.id}${hubSuffix}`)
            .setLabel('Ouvrir un booster')
            .setEmoji('✨')
            .setStyle(ButtonStyle.Success)
            .setDisabled(totalAvail <= 0)
    );
    if (fiveCardCount > 0) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`tcg:open5:${member.id}${hubSuffix}`)
                .setLabel(`Ouvrir 5 cartes (${fiveCardCount})`)
                .setEmoji('🎴')
                .setStyle(ButtonStyle.Success)
        );
    }
    row.addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:notif:menu:${member.id}:ephem`)
            .setLabel(hasNotif ? 'Notifications ✓' : 'Notifications')
            .setEmoji('🔔')
            .setStyle(hasNotif ? ButtonStyle.Primary : ButtonStyle.Secondary),
        buildAccueilButton(member.id),
        buildCloseButton(member.id)
    );

    return { embeds: [embed], components: [row], files };
}

function buildNotifMenuPayload(member, u, fromHub = false, statusNote = null, ephemeralMode = false) {
    const nextTs = getNextBoosterTimestamp(u);
    const fullTs = getFullBoosterTimestamp(u);
    const data = getStoreData();
    const currentNotif = data.notifs?.[member.id];
    const freq = (currentNotif?.frequency === 'full' || (!currentNotif && u.notifFreq === 'full')) ? 'full' : 'each';
    const modeTag = fromHub ? ':1' : (ephemeralMode ? ':ephem' : '');

    let statusText = '🔕 **Notifications actuelles :** Désactivées';
    if (currentNotif) {
        const freqTxt = freq === 'full' ? 'tous les 2 boosters *(2/2)*' : 'à chaque booster *(1/2 & 2/2)*';
        statusText = currentNotif.mode === 'dm'
            ? `📩 **Notifications actuelles :** Actives en **Message Privé** *(${freqTxt})*`
            : `🔔 **Notifications actuelles :** Actives **dans ce salon** *(${freqTxt})*`;
    }

    let timerLine = '';
    if (!nextTs) {
        timerLine = `✅ Ta jauge de boosters gratuits est actuellement pleine (**${u.freeBoosters}/${MAX_FREE_BOOSTERS}**).\n\n`;
    } else if (freq === 'full') {
        timerLine = `⏱️ Stock plein (**2/2**) prêt **<t:${Math.floor(fullTs / 1000)}:R>**` +
            (u.freeBoosters === 0 ? ` *(1er booster <t:${Math.floor(nextTs / 1000)}:R>)*` : '') + '.\n\n';
    } else {
        timerLine = `⏱️ Prochain booster gratuit prêt **<t:${Math.floor(nextTs / 1000)}:R>**` +
            (u.freeBoosters === 0 && fullTs ? ` *(stock 2/2 <t:${Math.floor(fullTs / 1000)}:R>)*` : '') + '.\n\n';
    }

    const embed = new EmbedBuilder()
        .setColor(currentNotif ? 0x3498db : 0x95a5a6)
        .setAuthor({ name: `Notifications Booster • ${member.displayName}`, iconURL: member.displayAvatarURL({ dynamic: true }) })
        .setTitle('🔔 Notifications de boosters gratuits')
        .setDescription(
            timerLine +
            `🎯 **Fréquence :** ${freq === 'full' ? 'Tous les 2 boosters *(stock 2/2 plein)*' : 'À chaque booster *(1/2 puis 2/2)*'}\n` +
            statusText +
            `\n-# 💡 Ce choix reste **sauvegardé définitivement** entre tes ouvertures *(modifiable ou désactivable à tout moment)*.` +
            (statusNote ? `\n\n${statusNote}` : '')
        );

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:notif:freq_each:${member.id}${modeTag}`)
            .setLabel('Me prévenir à chaque booster')
            .setEmoji('🔔')
            .setStyle(freq === 'each' ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`tcg:notif:freq_full:${member.id}${modeTag}`)
            .setLabel('Me prévenir tous les 2 boosters')
            .setEmoji('📦')
            .setStyle(freq === 'full' ? ButtonStyle.Primary : ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:notif:here:${member.id}${modeTag}`)
            .setLabel('Me prévenir ici')
            .setEmoji('📍')
            .setStyle(currentNotif?.mode === 'channel' ? ButtonStyle.Success : ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`tcg:notif:dm:${member.id}${modeTag}`)
            .setLabel('Me prévenir par MP')
            .setEmoji('📩')
            .setStyle(currentNotif?.mode === 'dm' ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`tcg:notif:off:${member.id}${modeTag}`)
            .setLabel('Désactiver')
            .setEmoji('🔕')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(!currentNotif)
    );

    const rows = [row1, row2];
    if (!ephemeralMode) {
        rows.push(new ActionRowBuilder().addComponents(
            buildAccueilButton(member.id),
            buildCloseButton(member.id)
        ));
    }

    return { embeds: [embed], components: rows };
}

function buildStorePayload(member, u, fromHub = false) {
    const hubSuffix = fromHub ? ':1' : '';

    const embed = new EmbedBuilder()
        .setColor(0x9b59b6)
        .setAuthor({ name: `RegaDex Store • ${member.displayName}`, iconURL: member.displayAvatarURL({ dynamic: true }) })
        .setTitle('🛒 RegaDex Store')
        .setDescription(
            `🪙 **Ton solde :** **${u.points} points RegaDex**\n` +
            `────────────────────────────────────────\n` +
            `⚡ **Diviser le cooldown par 2** — \`${STORE_PRICES.halfCooldown} pts\`\n` +
            `-# Activé dès l'ouverture du prochain booster : celui d'après prendra **3h** au lieu de 6h.\n\n` +
            `✨ **Transformer une carte en Holographique** — \`${STORE_PRICES.holoTransform} pts\`\n` +
            `-# Transforme 1 de tes cartes compatibles possédées en sa version **holographique** !\n\n` +
            `🍀 **Prochain booster chanceux** — \`${STORE_PRICES.luckyBooster} pts\`\n` +
            `-# Supprime toutes les cartes **Communes** de ton prochain booster.\n\n` +
            `🎁 **Booster ${SET1_NAME}** — \`${STORE_PRICES.booster} pts\`\n` +
            `-# Un booster de 3 cartes ${SET1_NAME} à ouvrir quand tu veux.\n\n` +
            `🌟 **Taux de God Pack ×5 (5j)** — \`${STORE_PRICES.godPackBoost} pts\`\n` +
            `-# Passe tes chances d'obtenir un **God Pack** de **1% à 5%** pendant **5 jours** *(bonus personnel)*.\n\n` +
            `🎴 **Booster 5 cartes (${SET1_NAME})** — \`${STORE_PRICES.fiveCardBooster} pts\`\n` +
            `-# Un gros booster contenant **5 cartes** (sans doublon dans le même pack) !\n\n` +
            `🕳️ **Transformer une Full Art en Négative** — \`${STORE_PRICES.negativeTransform} pts\`\n` +
            `-# Transforme 1 de tes cartes **Full Art** compatibles possédées en sa version **Négative** !`
        );

    const storeBtn = (key, label, emoji) => new ButtonBuilder()
        .setCustomId(`tcg:buy:${key}:${member.id}${hubSuffix}`)
        .setLabel(`${label} (${STORE_PRICES[key]} pts)`)
        .setEmoji(emoji)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(u.points < STORE_PRICES[key]);

    // Ordre croissant de prix : gauche → droite, haut → bas
    const row = new ActionRowBuilder().addComponents(
        storeBtn('halfCooldown', 'CD /2', '⚡'),
        storeBtn('holoTransform', 'Holo', '✨'),
        storeBtn('luckyBooster', 'Chanceux', '🍀'),
        storeBtn('booster', 'Booster', '🎁'),
        storeBtn('godPackBoost', 'God Pack ×5', '🌟')
    );

    const row2 = new ActionRowBuilder().addComponents(
        storeBtn('fiveCardBooster', 'Booster 5 cartes', '🎴'),
        storeBtn('negativeTransform', 'Full Art → Négative', '🕳️')
    );

    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:claim:open:${member.id}:1`)
            .setLabel('Mon Inventaire')
            .setEmoji('🎒')
            .setStyle(ButtonStyle.Secondary),
        buildAccueilButton(member.id),
        buildCloseButton(member.id)
    );

    return { embeds: [embed], components: [row, row2, row3] };
}

function buildClaimPayload(member, u, fromHub = false) {
    const inv = u.inventory || {};
    const hubSuffix = fromHub ? ':1' : '';
    const godBoostActive = Boolean(u.activeBonuses?.godPackBoostUntil && Date.now() < u.activeBonuses.godPackBoostUntil);

    const boosterDetails = [];
    if ((inv.weeklyBooster || 0) > 0) boosterDetails.push(`📅 **Hebdomadaires (Vendredi 8h) :** \`${inv.weeklyBooster}/${MAX_WEEKLY_BOOSTERS}\``);
    if ((inv.communityBooster || 0) > 0) boosterDetails.push(`🤝 **Communautaires :** \`${inv.communityBooster}/${MAX_COMMUNITY_BOOSTERS}\``);
    if ((inv.masterBooster || 0) > 0) boosterDetails.push(`🏆 **Boosters de Maître :** \`${inv.masterBooster}\``);
    if ((inv.booster || 0) > 0) boosterDetails.push(`🛒 **Bonus / Achetés :** \`${inv.booster}\``);
    const boosterSubBlock = boosterDetails.length > 0 ? boosterDetails.join('\n') + '\n' : '';

    const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setAuthor({ name: `Inventaire RegaDex • ${member.displayName}`, iconURL: member.displayAvatarURL({ dynamic: true }) })
        .setTitle('🎒 Inventaire RegaDex (`!regadex claim`)')
        .setDescription(
            `Voici tes bonus en réserve :\n\n` +
            `🎁 **Boosters prêts à ouvrir :** \`${getTotalAvailableBoosters(u)}\` *(${SET1_NAME})*\n` +
            boosterSubBlock +
            `🎴 **Boosters 5 cartes :** \`${inv.fiveCardBooster || 0}\`\n` +
            `🍀 **Prochain booster chanceux :** \`${inv.luckyBooster || 0}\` ${u.activeBonuses?.luckyBooster ? '*(Déjà actif sur le prochain booster !)*' : ''}\n` +
            `✨ **Transformation Holographique :** \`${inv.holoTransform || 0}\`\n` +
            `🕳️ **Transformation Full Art → Négative :** \`${inv.negativeTransform || 0}\`\n` +
            `⚡ **Demi-cooldown (3h) :** \`${inv.halfCooldown || 0}\` ${u.activeBonuses?.halfCooldown ? '*(Déjà armé sur le prochain booster !)*' : ''}\n` +
            `🌟 **Taux God Pack ×5 (5j) :** \`${inv.godPackBoost || 0}\` ${godBoostActive ? `*(Actif pour toi : **5%** au lieu de 1% jusqu'au <t:${Math.floor(u.activeBonuses.godPackBoostUntil / 1000)}:F>)*` : '*(1% → 5%, personnel)*'}`
        );

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:open:${member.id}${hubSuffix}`)
            .setLabel(`Ouvrir Booster (${getTotalAvailableBoosters(u)})`)
            .setEmoji('🎁')
            .setStyle(ButtonStyle.Success)
            .setDisabled(getTotalAvailableBoosters(u) <= 0),
        new ButtonBuilder()
            .setCustomId(`tcg:open5:${member.id}${hubSuffix}`)
            .setLabel(`Booster 5 cartes (${inv.fiveCardBooster || 0})`)
            .setEmoji('🎴')
            .setStyle(ButtonStyle.Success)
            .setDisabled((inv.fiveCardBooster || 0) <= 0),
        new ButtonBuilder()
            .setCustomId(`tcg:use:luckyBooster:${member.id}${hubSuffix}`)
            .setLabel(`Chanceux (${inv.luckyBooster || 0})`)
            .setEmoji('🍀')
            .setStyle(ButtonStyle.Primary)
            .setDisabled((inv.luckyBooster || 0) <= 0 || Boolean(u.activeBonuses?.luckyBooster)),
        new ButtonBuilder()
            .setCustomId(`tcg:use:halfCooldown:${member.id}${hubSuffix}`)
            .setLabel(`CD /2 (${inv.halfCooldown || 0})`)
            .setEmoji('⚡')
            .setStyle(ButtonStyle.Primary)
            .setDisabled((inv.halfCooldown || 0) <= 0 || Boolean(u.activeBonuses?.halfCooldown)),
        new ButtonBuilder()
            .setCustomId(`tcg:use:godPackBoost:${member.id}${hubSuffix}`)
            .setLabel(`God Pack ×5 (${inv.godPackBoost || 0})`)
            .setEmoji('🌟')
            .setStyle(ButtonStyle.Primary)
            .setDisabled((inv.godPackBoost || 0) <= 0 || godBoostActive)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:use:holoTransform:${member.id}${hubSuffix}`)
            .setLabel(`Holo (${inv.holoTransform || 0})`)
            .setEmoji('✨')
            .setStyle(ButtonStyle.Primary)
            .setDisabled((inv.holoTransform || 0) <= 0),
        new ButtonBuilder()
            .setCustomId(`tcg:use:negativeTransform:${member.id}${hubSuffix}`)
            .setLabel(`Négative (${inv.negativeTransform || 0})`)
            .setEmoji('🕳️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled((inv.negativeTransform || 0) <= 0),
        new ButtonBuilder()
            .setCustomId(`tcg:store:open:${member.id}:1`)
            .setLabel('RegaDex Store')
            .setEmoji('🛒')
            .setStyle(ButtonStyle.Secondary),
        buildAccueilButton(member.id),
        buildCloseButton(member.id)
    );

    return { embeds: [embed], components: [row, row2] };
}

function buildTopEmbed(guild, mode = 'total') {
    const data = getStoreData();
    const entries = Object.entries(data.users || {}).map(([uid, u]) => {
        const comp = getUserCompletionStats(u);
        return {
            uid,
            unique: comp.uniqueCount,
            total: comp.totalCopies,
            totalSet: comp.totalSet,
            points: u.points || 0
        };
    });

    entries.sort((a, b) => {
        if (mode === 'completion') {
            if (b.unique !== a.unique) return b.unique - a.unique;
            return b.total - a.total;
        }
        if (b.total !== a.total) return b.total - a.total;
        return b.unique - a.unique;
    });

    const top15 = entries.filter(e => e.total > 0).slice(0, 15);
    const medals = ['🥇', '🥈', '🥉'];

    const lines = top15.length === 0
        ? ['*Aucune carte obtenue pour le moment !*']
        : top15.map((e, i) => {
            const prefix = medals[i] || `**${i + 1}.**`;
            const m = guild?.members?.cache?.get(e.uid);
            const name = m ? m.displayName : `<@${e.uid}>`;
            const pct = e.totalSet > 0 ? Math.round((e.unique / e.totalSet) * 100) : 0;
            return mode === 'completion'
                ? `${prefix} **${name}** — \`${e.unique}/${e.totalSet}\` (**${pct}%**) • *${e.total} cartes*`
                : `${prefix} **${name}** — **${e.total} cartes** • *${e.unique}/${e.totalSet} uniques*`;
        });

    return new EmbedBuilder()
        .setColor(mode === 'completion' ? 0x9b59b6 : 0xf1c40f)
        .setTitle(mode === 'completion' ? `🏆 Classement RegaDex — Complétion ${SET1_NAME}` : '🏆 Classement RegaDex — Total de Cartes')
        .setDescription(lines.join('\n'))
        .setFooter({ text: `RegaDex ${SET1_NAME} • Cacabot` });
}

function buildTopComponents(authorId, mode = 'total', fromHub = false) {
    const hubSuffix = fromHub ? ':1' : '';
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:top:total:${authorId}${hubSuffix}`)
            .setLabel('Total de cartes')
            .setEmoji('🃏')
            .setStyle(mode === 'total' ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`tcg:top:completion:${authorId}${hubSuffix}`)
            .setLabel(`Complétion ${SET1_NAME}`)
            .setEmoji('📚')
            .setStyle(mode === 'completion' ? ButtonStyle.Primary : ButtonStyle.Secondary),
        buildAccueilButton(authorId),
        buildCloseButton(authorId)
    );
    return [row];
}

// ==========================================
//   OUVERTURE DE BOOSTER (SÉQUENCE 5.5s)
// ==========================================

const BOOSTER_INSPECT_IDLE_MS = 5 * 60 * 1000; // 5 minutes

function clearCard3AutoRecapTimer(session) {
    if (session?.card3AutoRecapTimer) {
        clearTimeout(session.card3AutoRecapTimer);
        session.card3AutoRecapTimer = null;
    }
}

function clearBoosterInspectTimeout(session) {
    if (session?.inspectTimeout) {
        clearTimeout(session.inspectTimeout);
        session.inspectTimeout = null;
    }
}

function scheduleCard3AutoRecap(member, session, client) {
    clearCard3AutoRecapTimer(session);
    const lastIdx = Math.max(0, (session?.cards?.length || 3) - 1);
    if (!session?.message || session.hasReachedRecap || session.step !== lastIdx) return;

    session.card3AutoRecapTimer = setTimeout(async () => {
        session.card3AutoRecapTimer = null;
        if (boosterSessions.get(session.message.id) !== session) return;
        if (session.hasReachedRecap || session.step !== lastIdx) return;
        session.hasReachedRecap = true;
        try {
            const dualPayload = await buildBoosterStepPayload(member, session);
            await session.message.edit({ content: null, ...dualPayload, attachments: [] });
        } catch {}
        await triggerSessionPantheonIfNeeded(client, member, session).catch(() => {});
    }, CARD_3_AUTO_RECAP_MS);
    session.card3AutoRecapTimer.unref?.();
}

function scheduleBoosterInspectTimeout(member, session) {
    clearBoosterInspectTimeout(session);
    if (!session?.message) return;

    session.inspectTimeout = setTimeout(async () => {
        session.inspectTimeout = null;
        if (boosterSessions.get(session.message.id) !== session) return;
        const recapStep = session.cards.length;
        if (session.step >= recapStep) return;
        clearCard3AutoRecapTimer(session);
        session.hasReachedRecap = true;
        session.step = recapStep;
        try {
            const recapPayload = await buildBoosterRecapPayload(member, session);
            await session.message.edit({ content: null, ...recapPayload, attachments: [] });
        } catch {}
        await triggerSessionPantheonIfNeeded(tcgBridge.client, member, session).catch(() => {});
    }, BOOSTER_INSPECT_IDLE_MS);
}

async function disableBoosterOpenButtonOnMessage(message) {
    if (!message || !Array.isArray(message.components) || message.components.length === 0) return;
    let modified = false;
    const updatedRows = message.components.map(row => {
        const newRow = new ActionRowBuilder();
        for (const comp of row.components) {
            const json = comp.toJSON();
            if (json.custom_id && (json.custom_id.startsWith('tcg:open:') || json.custom_id.startsWith('tcg:open5:'))) {
                json.disabled = true;
                modified = true;
            }
            newRow.addComponents(ButtonBuilder.from(json));
        }
        return newRow;
    });
    if (modified) {
        await message.edit({ components: updatedRows }).catch(() => {});
    }
}

function buildBoosterCardEmbed(member, session, stepIndex) {
    const totalCards = session.cards.length;
    const lastIdx = Math.max(0, totalCards - 1);
    const card = session.cards[stepIndex];
    const isNew = session.isNewFlags[stepIndex];
    const meta = RARITY_META[card.rarity] || RARITY_META['Commune'];

    const embed = new EmbedBuilder()
        .setColor(meta.color)
        .setAuthor({ name: `Ouverture de ${member.displayName}`, iconURL: member.displayAvatarURL({ dynamic: true }) })
        .setTitle(`${meta.emoji} Carte ${stepIndex + 1}/${totalCards} — ${card.name}`)
        .setDescription(
            `🆔 **Numéro :** \`${card.id}\`\n` +
            `📁 **Catégorie :** \`${card.category}\`\n` +
            `✨ **Rareté :** **${card.rarity}**${card.isHolo ? ' **(Holographique)**' : ''}\n` +
            (isNew ? `🆕 **NOUVELLE CARTE AJOUTÉE AU REGADEX !**` : `🔁 **Doublon !** *+3 points RegaDex gagnés*`)
        )
        .setImage('attachment://carte_booster.png')
        .setFooter({ text: `Booster ${totalCards > 3 ? `${totalCards} cartes ` : ''}${SET1_NAME} • Révélation ${stepIndex + 1}/${totalCards}` });

    const files = [];
    if (card.filePath && fs.existsSync(card.filePath)) {
        files.push(new AttachmentBuilder(card.filePath, { name: 'carte_booster.png' }));
    }

    const row = new ActionRowBuilder();
    if (stepIndex > 0) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`tcg:bstep:prev:${session.userId}`)
                .setLabel('Arrière')
                .setEmoji('◀️')
                .setStyle(ButtonStyle.Secondary)
        );
    }
    if (stepIndex < lastIdx) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`tcg:bstep:next:${session.userId}`)
                .setLabel('Suivant')
                .setEmoji('▶️')
                .setStyle(ButtonStyle.Primary)
        );
    }

    if (session.hasReachedRecap) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`tcg:bstep:recap:${session.userId}`)
                .setLabel('Juste le récap')
                .setEmoji('📊')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`tcg:brecap:theme:${session.userId}`)
                .setLabel('Thème B/W')
                .setEmoji('🌗')
                .setStyle(ButtonStyle.Secondary)
        );
    } else if (stepIndex === lastIdx) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`tcg:bstep:recap:${session.userId}`)
                .setLabel('Récapitulatif')
                .setEmoji('📊')
                .setStyle(ButtonStyle.Success)
        );
    } else if (!session.skipUsed) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`tcg:bstep:skip:${session.userId}`)
                .setLabel('Skip')
                .setEmoji('⏭️')
                .setStyle(ButtonStyle.Secondary)
        );
    }

    const uOwner = getOrCreateTcgUser(session.userId);
    const isAlreadyFlex = uOwner.favoriteCardId === card.id;
    row.addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:setflex:${card.id}:${session.userId}:booster`)
            .setLabel(isAlreadyFlex ? 'Flex actuel' : 'Définir Flex')
            .setEmoji('⭐')
            .setStyle(isAlreadyFlex ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setDisabled(isAlreadyFlex)
    );

    return { embeds: [embed], components: [row], files };
}

function buildBoosterRecapEmbed(member, session, u) {
    const nextTs = getNextBoosterTimestamp(u);
    const totalAvail = getTotalAvailableBoosters(u);
    const comp = getUserCompletionStats(u);
    const pctSet = comp.totalSet > 0 ? Math.round((comp.uniqueCount / comp.totalSet) * 100) : 0;

    const lines = session.cards.map((c, i) => {
        const meta = RARITY_META[c.rarity] || RARITY_META['Commune'];
        const tag = session.isNewFlags[i] ? '🆕 Nouvelle' : '🔁 Doublon (+3 pts)';
        return `${meta.emoji} **${c.id}** — **${c.name}** (*${c.rarity}*) • ${tag}`;
    });

    const bonusInfo = [];
    if (session.fiveCardUsed) bonusInfo.push(`🎴 **Booster ${session.cards.length} cartes**`);
    if (session.isGodPack) bonusInfo.push(`🌟 **GOD PACK DÉCROCHÉ !** *(Tirage légendaire${session.godBoostUsed ? ' • Boost ×5 actif' : ''})*`);
    if (session.luckyUsed) bonusInfo.push('🍀 Booster Chanceux appliqué');
    if (session.pityUsed) bonusInfo.push('✨ Pity appliquée (Rare garantie)');
    if (session.halfCdUsed) bonusInfo.push('⚡ Demi-cooldown activé (3h)');
    if (session.triggeredNextPity) bonusInfo.push('🛡️ Que des Communes : ton **prochain** booster aura une **Rare** garantie !');
    if (Array.isArray(session.unlockedMilestones) && session.unlockedMilestones.length > 0) {
        for (const ms of session.unlockedMilestones) {
            const extraMaster = ms.pct === 100 ? ' & **+2 Boosters de Maître** (rang **Maître du Set** débloqué !)' : '';
            bonusInfo.push(`🏆 **Palier de complétion ${ms.pct}% (${ms.setName}) atteint :** **+${ms.reward} pts RegaDex**${extraMaster} !`);
        }
    }

    const cooldownLine = nextTs
        ? `\n⏱️ **Prochain booster gratuit :** <t:${Math.floor(nextTs / 1000)}:R>`
        : `\n✅ **Jauge gratuite pleine :** \`${u.freeBoosters}/${MAX_FREE_BOOSTERS}\``;

    const recapColor = session.isGodPack ? 0xFFD700 : (u.theme === 'W' ? 0xffffff : 0x111216);
    const milestoneNote = session.milestoneBonusPts > 0 ? ` *(+${session.milestoneBonusPts} pts de palier)*` : '';
    const recapTitle = session.isGodPack
        ? '🌟 RÉCAPITULATIF — GOD PACK ! 🌟'
        : (session.fiveCardUsed ? `📊 Récapitulatif du Booster ${session.cards.length} Cartes` : '📊 Récapitulatif du Booster');

    return new EmbedBuilder()
        .setColor(recapColor)
        .setAuthor({ name: `Booster ${SET1_NAME} de ${member.displayName}`, iconURL: member.displayAvatarURL({ dynamic: true }) })
        .setTitle(recapTitle)
        .setDescription(
            lines.join('\n') +
            `\n\n🪙 **Points RegaDex gagnés :** **+${session.ptsEarned} pts**${milestoneNote} *(Solde : ${u.points} pts)*` +
            `\n📚 **Progression ${SET1_NAME} :** **${comp.uniqueCount}/${comp.totalSet}** (${pctSet}%)` +
            cooldownLine +
            (bonusInfo.length > 0 ? `\n\n${bonusInfo.join('\n')}` : '')
        )
        .setImage('attachment://recap_booster.jpg')
        .setFooter({ text: `Boosters restants : ${totalAvail} • Mode ${u.theme === 'W' ? 'Clair (W)' : 'Nuit (B)'}` });
}

async function ensureSessionRecapBuffer(session, theme) {
    if (!session.recapBuffer || session.recapTheme !== theme) {
        session.recapBuffer = await renderBoosterRecapCanvas(session.cards, session.isNewFlags, theme, Boolean(session.isGodPack));
        session.recapTheme = theme;
    }
    return session.recapBuffer;
}

async function buildBoosterRecapPayload(member, session) {
    const u = getOrCreateTcgUser(session.userId);
    const buffer = await ensureSessionRecapBuffer(session, u.theme);
    const data = getStoreData();
    const hasNotif = Boolean(data.notifs?.[session.userId]);
    const totalAvail = getTotalAvailableBoosters(u);
    const hubSuffix = session.fromHub ? ':1' : '';

    const embed = buildBoosterRecapEmbed(member, session, u);

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:bstep:back3:${session.userId}`)
            .setLabel('Arrière')
            .setEmoji('◀️')
            .setStyle(ButtonStyle.Secondary)
    );

    if (totalAvail > 0) {
        row1.addComponents(
            new ButtonBuilder()
                .setCustomId(`tcg:open:${session.userId}${hubSuffix}`)
                .setLabel(`Ouvrir un autre (${totalAvail})`)
                .setEmoji('🎁')
                .setStyle(ButtonStyle.Success)
        );
    }

    row1.addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:brecap:theme:${session.userId}`)
            .setLabel('Thème B/W')
            .setEmoji('🌗')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`tcg:notif:menu:${session.userId}:ephem`)
            .setLabel(hasNotif ? 'Notifications ✓' : 'Notifications')
            .setEmoji('🔔')
            .setStyle(hasNotif ? ButtonStyle.Primary : ButtonStyle.Secondary)
    );

    if (session.fromHub) {
        row1.addComponents(buildAccueilButton(session.userId));
    }

    const components = [row1];
    if ((u.inventory?.fiveCardBooster || 0) > 0) {
        components.push(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`tcg:open5:${session.userId}${hubSuffix}`)
                    .setLabel(`Ouvrir 5 cartes (${u.inventory.fiveCardBooster})`)
                    .setEmoji('🎴')
                    .setStyle(ButtonStyle.Success)
            )
        );
    }

    return {
        embeds: [embed],
        components,
        files: [new AttachmentBuilder(buffer, { name: 'recap_booster.jpg' })]
    };
}

async function buildBoosterStepPayload(member, session) {
    if (session.step >= session.cards.length) {
        clearBoosterInspectTimeout(session);
        if (!session.milestoneAnnounced) {
            session.milestoneAnnounced = true;
            if (session.milestoneTimer) {
                clearTimeout(session.milestoneTimer);
                session.milestoneTimer = null;
            }
        }
        return buildBoosterRecapPayload(member, session);
    }

    const cardPayload = buildBoosterCardEmbed(member, session, session.step);
    if (!session.hasReachedRecap) {
        return cardPayload;
    }

    // Une fois le récap atteint, on le garde affiché AU-DESSUS de la visu individuelle
    scheduleBoosterInspectTimeout(member, session);
    const u = getOrCreateTcgUser(session.userId);
    const buffer = await ensureSessionRecapBuffer(session, u.theme);
    const recapEmbed = buildBoosterRecapEmbed(member, session, u);

    return {
        embeds: [recapEmbed, ...cardPayload.embeds],
        components: cardPayload.components,
        files: [new AttachmentBuilder(buffer, { name: 'recap_booster.jpg' }), ...cardPayload.files]
    };
}

async function envoyerPantheonTcg(client, member, card, isNew, luckyUsed = false) {
    if (!card || (card.rarity !== 'Full Art' && card.rarity !== 'Négative')) return;
    if (!member || isSandboxId(member.id)) return;

    const c = client || tcgBridge.client;
    if (!c) return;

    const salon = c.channels.cache.get(TCG_PANTHEON_CHANNEL_ID)
        ?? await c.channels.fetch(TCG_PANTHEON_CHANNEL_ID).catch(() => null);
    if (!salon) return;

    const meta = RARITY_META[card.rarity] || RARITY_META['Full Art'];
    const nom = member?.displayName ?? member?.user?.username ?? 'Un·e membre';
    const avatar = member?.user?.displayAvatarURL?.({ dynamic: true, size: 256 })
        ?? member?.displayAvatarURL?.({ dynamic: true, size: 256 });

    const rawPct = getCardPullProbability(card, luckyUsed, null, null);
    const pctStr = formatPullPercent(rawPct);
    const tauxText = `**${pctStr}%** *(/carte)*${card.isHolo ? ' *(Holo)*' : ''}${luckyUsed ? ' *(🍀 Chanceux)*' : ''}`;

    const titre = card.rarity === 'Négative'
        ? '🕳️ CARTE NÉGATIVE AU PANTHÉON !'
        : '🌈 CARTE FULL ART AU PANTHÉON !';

    const description =
        `Le destin a parlé ! Une carte **${card.rarity}**${card.isHolo ? ' **(Holographique)**' : ''} vient d'être tirée dans un **Booster ${SET1_NAME}** !\n` +
        (isNew ? `🆕 **Première découverte dans son RegaDex !**` : `🔁 **Nouvel exemplaire obtenu !**`);

    const embed = new EmbedBuilder()
        .setColor(meta.color)
        .setTitle(titre)
        .setDescription(description)
        .addFields(
            { name: '👤 Collectionneur·euse', value: `<@${member.id}>`, inline: true },
            { name: `${meta.emoji} Carte obtenue`, value: `**${card.id} — ${card.name}**`, inline: true },
            { name: '\u200b', value: '\u200b', inline: true },
            { name: '✨ Rareté', value: `**${card.rarity}**${card.isHolo ? ' *(Holo)*' : ''}`, inline: true },
            { name: '📁 Catégorie', value: `**${card.category}**`, inline: true },
            { name: '🎲 Taux de tirage', value: tauxText, inline: true },
            { name: '📅 Date du tirage', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
        )
        .setFooter({ text: 'Panthéon RegaDex • Regaïa' })
        .setTimestamp();

    if (avatar) embed.setThumbnail(avatar);

    const files = [];
    if (card.filePath && fs.existsSync(card.filePath)) {
        files.push(new AttachmentBuilder(card.filePath, { name: 'carte_pantheon.png' }));
        embed.setImage('attachment://carte_pantheon.png');
    }

    await sendSilent(salon, {
        content: `🎉 Félicitations à <@${member.id}> pour ce tirage exceptionnel !`,
        embeds: [embed],
        files
    }).catch(() => {});
}

async function envoyerTransfoNegativeTcg(client, member, baseCard, negCard, isNew) {
    if (!baseCard || !negCard || !member || isSandboxId(member.id)) return;

    const c = client || tcgBridge.client;
    if (!c) return;

    const salon = c.channels.cache.get(TCG_CHANNEL_ID)
        ?? await c.channels.fetch(TCG_CHANNEL_ID).catch(() => null);
    if (!salon) return;

    const meta = RARITY_META['Négative'];
    const embed = new EmbedBuilder()
        .setColor(meta.color)
        .setTitle('🕳️ TRANSFORMATION NÉGATIVE !')
        .setDescription(
            `<@${member.id}> a transformé sa **Full Art** \`${baseCard.id}\` **${baseCard.name}** en **${negCard.id} — ${negCard.name}** grâce au Store !\n` +
            (isNew ? `🆕 **Première découverte dans son RegaDex !**` : `🔁 **Nouvel exemplaire obtenu !**`)
        )
        .setFooter({ text: 'RegaDex • Regaïa' })
        .setTimestamp();

    const files = [];
    if (negCard.filePath && fs.existsSync(negCard.filePath)) {
        files.push(new AttachmentBuilder(negCard.filePath, { name: 'carte_negative.png' }));
        embed.setImage('attachment://carte_negative.png');
    }

    await sendSilent(salon, { embeds: [embed], files }).catch(() => {});
}

async function buildGodPackPantheonPayload(member, cards, isNewFlags, theme = 'B', godBoostUsed = false, isTest = false) {
    const buffer = await renderBoosterRecapCanvas(cards, isNewFlags, theme, true);
    const cardLines = cards.map((c, i) => {
        const meta = RARITY_META[c.rarity] || RARITY_META['Légendaire'];
        const status = isNewFlags[i] ? '🆕 Première découverte' : '🔁 Doublon';
        return `${meta.emoji} \`${c.id}\` **${c.name}** — *${c.rarity}*${c.isHolo ? ' *(Holo)*' : ''} • ${status}`;
    });

    const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle(isTest ? '🌟 [TEST] GOD PACK AU PANTHÉON ! 🌟' : '🌟 GOD PACK AU PANTHÉON ! 🌟')
        .setDescription(
            `Incroyable exploit sur le **${SET1_NAME}** ! <@${member.id}> vient de tirer un **God Pack**${godBoostUsed ? ' *(Boost ×5 actif)*' : ''} !\n\n` +
            cardLines.join('\n')
        )
        .addFields(
            { name: '👤 Collectionneur·euse', value: `<@${member.id}>`, inline: true },
            { name: '🎲 Taux du God Pack', value: godBoostUsed ? '**5%** *(×5 actif)*' : '**1%** *(Base)*', inline: true },
            { name: '📅 Date du tirage', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
        )
        .setImage('attachment://godpack_pantheon.jpg')
        .setFooter({ text: 'Panthéon RegaDex • Regaïa' })
        .setTimestamp();

    const avatar = member?.user?.displayAvatarURL?.({ dynamic: true, size: 256 })
        ?? member?.displayAvatarURL?.({ dynamic: true, size: 256 });
    if (avatar) embed.setThumbnail(avatar);

    return {
        content: `🌟 Légendaire !! Félicitations à <@${member.id}> pour ce **God Pack** !`,
        embeds: [embed],
        files: [new AttachmentBuilder(buffer, { name: 'godpack_pantheon.jpg' })]
    };
}

async function envoyerGodPackPantheonTcg(client, member, session) {
    if (!member || isSandboxId(member.id)) return;
    const c = client || tcgBridge.client;
    if (!c) return;
    const salon = c.channels.cache.get(TCG_PANTHEON_CHANNEL_ID)
        ?? await c.channels.fetch(TCG_PANTHEON_CHANNEL_ID).catch(() => null);
    if (!salon) return;

    const u = getOrCreateTcgUser(member.id);
    const payload = await buildGodPackPantheonPayload(member, session.cards, session.isNewFlags, u.theme, Boolean(session.godBoostUsed), false);
    await sendSilent(salon, payload).catch(() => {});
}

async function buildMasterSetPantheonPayload(member, u, setNumber = DEFAULT_SET_NUMBER, isTest = false) {
    const setCfg = getSetConfig(setNumber);
    const buffer = await renderMasterSetCanvas(member, u, setNumber);

    const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTitle(isTest ? `👑 [TEST] MAÎTRE DU ${setCfg.name.toUpperCase()} !` : `👑 MAÎTRE DU ${setCfg.name.toUpperCase()} !`)
        .setDescription(
            `Immense bravo à <@${member.id}> qui vient de compléter les **${setCfg.totalExpected} cartes** du **${setCfg.name}** !\n\n` +
            `🏆 **Rang permanent débloqué :** **Maître du ${setCfg.name}**\n` +
            `🎁 **Récompenses :** **+25 points RegaDex** & **+2 Boosters de Maître**`
        )
        .setImage('attachment://maitre_du_set.jpg')
        .setFooter({ text: 'Panthéon RegaDex • Regaïa' })
        .setTimestamp();

    return {
        content: `👑🎉 Chapeau bas à <@${member.id}>, nouveau/nouvelle **Maître du ${setCfg.name}** !`,
        embeds: [embed],
        files: [new AttachmentBuilder(buffer, { name: 'maitre_du_set.jpg' })]
    };
}

async function envoyerMaitreDuSetPantheonTcg(client, member, setNumber = DEFAULT_SET_NUMBER) {
    if (!member || isSandboxId(member.id)) return;
    const c = client || tcgBridge.client;
    if (!c) return;
    const salon = c.channels.cache.get(TCG_PANTHEON_CHANNEL_ID)
        ?? await c.channels.fetch(TCG_PANTHEON_CHANNEL_ID).catch(() => null);
    if (!salon) return;

    const u = getOrCreateTcgUser(member.id);
    const payload = await buildMasterSetPantheonPayload(member, u, setNumber, false);
    await sendSilent(salon, payload).catch(() => {});
}

async function triggerSessionPantheonIfNeeded(client, member, session) {
    if (!session || session.pantheonSent) return;
    session.pantheonSent = true;
    if (isSandboxId(session.userId)) return;

    if (session.isGodPack) {
        await envoyerGodPackPantheonTcg(client, member, session).catch(() => {});
    } else {
        for (let i = 0; i < session.cards.length; i++) {
            const pulledCard = session.cards[i];
            if (pulledCard.rarity === 'Full Art' || pulledCard.rarity === 'Négative') {
                await envoyerPantheonTcg(client, member, pulledCard, session.isNewFlags[i], session.luckyUsed).catch(() => {});
            }
        }
    }

    if (Array.isArray(session.pendingMasterSets) && session.pendingMasterSets.length > 0) {
        for (const sNum of session.pendingMasterSets) {
            await envoyerMaitreDuSetPantheonTcg(client, member, sNum).catch(() => {});
        }
    }
}

async function startBoosterOpening(targetResponder, member, client, fromHub = false, boosterType = 'normal') {
    const userId = member.id;
    const isFiveCard = boosterType === 'five';
    if (cardCatalog.length === 0) {
        const msg = `❌ Les cartes ${SET1_NAME} ne sont pas encore chargées.`;
        return targetResponder.replied || targetResponder.deferred
            ? targetResponder.followUp({ content: msg, ephemeral: true })
            : replySilent(targetResponder, msg);
    }

    if (boostersEnCours.has(userId)) {
        const msg = "⏳ Tu as déjà une ouverture de booster en cours ! Attends la fin de l'animation.";
        return targetResponder.isRepliable?.()
            ? targetResponder.reply({ content: msg, ephemeral: true })
            : replySilent(targetResponder, msg);
    }

    const u = getOrCreateTcgUser(userId);
    if (isFiveCard) {
        if ((u.inventory?.fiveCardBooster || 0) <= 0) {
            const msg = "❌ Tu n'as aucun **Booster 5 cartes** dans ton inventaire (`!regadex store` pour en acheter).";
            return targetResponder.isRepliable?.()
                ? targetResponder.reply({ content: msg, ephemeral: true })
                : replySilent(targetResponder, msg);
        }
    } else {
        const totalAvail = getTotalAvailableBoosters(u);
        if (totalAvail <= 0) {
            const payload = buildOpenPromptPayload(member, u, fromHub);
            if (targetResponder.isButton?.()) {
                const isExistingRecap = Boolean(
                    targetResponder.message?.id && (
                        boosterSessions.has(targetResponder.message.id) ||
                        targetResponder.message.embeds?.some(e =>
                            (typeof e?.title === 'string' && e.title.startsWith('📊 Récapitulatif du Booster')) ||
                            (typeof e?.title === 'string' && e.title.includes('RÉCAPITULATIF') && e.title.includes('GOD PACK'))
                        )
                    )
                );
                if (!isExistingRecap) {
                    await targetResponder.deferUpdate();
                    return targetResponder.editReply({ content: null, ...payload, attachments: [] });
                }
            }
            return targetResponder.isRepliable?.()
                ? targetResponder.reply({ ...payload, ephemeral: true })
                : replySilent(targetResponder, payload);
        }
    }

    boostersEnCours.add(userId);

    try {
        if (isFiveCard) {
            u.inventory.fiveCardBooster -= 1;
        } else {
            // Ordre de consommation : gratuit -> hebdo -> communautaire -> maître -> inventaire
            if (u.freeBoosters > 0) {
                const wasFull = u.freeBoosters >= MAX_FREE_BOOSTERS;
                u.freeBoosters -= 1;
                if (wasFull) {
                    u.lastFreeRechargeAt = Date.now();
                    u.currentRechargeMs = BOOSTER_COOLDOWN_MS;
                }
            } else if ((u.inventory.weeklyBooster || 0) > 0) {
                u.inventory.weeklyBooster -= 1;
            } else if ((u.inventory.communityBooster || 0) > 0) {
                u.inventory.communityBooster -= 1;
            } else if ((u.inventory.masterBooster || 0) > 0) {
                u.inventory.masterBooster -= 1;
            } else {
                u.inventory.booster -= 1;
            }
        }

        // Consommer le demi-cooldown si armé
        let halfCdUsed = false;
        if (u.activeBonuses.halfCooldown) {
            u.activeBonuses.halfCooldown = false;
            halfCdUsed = true;
            if (u.freeBoosters < MAX_FREE_BOOSTERS) {
                if (u.currentRechargeMs !== HALF_COOLDOWN_MS) {
                    const remaining = (u.lastFreeRechargeAt + u.currentRechargeMs) - Date.now();
                    if (remaining > 0) {
                        u.currentRechargeMs = HALF_COOLDOWN_MS;
                        u.lastFreeRechargeAt = Date.now() - Math.max(0, HALF_COOLDOWN_MS - Math.ceil(remaining / 2));
                    } else {
                        u.currentRechargeMs = HALF_COOLDOWN_MS;
                    }
                }
            }
        }

        // Tirage des cartes (3 ou 5)
        const cardCount = isFiveCard ? 5 : 3;
        const draw = drawBoosterCards(u, userId, member, DEFAULT_SET_NUMBER, cardCount);
        if (!draw.isGodPack) {
            u.activeBonuses.luckyBooster = false;
        }

        const isNewFlags = [];
        let duplicatesInPack = 0;

        for (const card of draw.cards) {
            const before = u.cards[card.id] || 0;
            u.cards[card.id] = before + 1;
            if (before === 0) {
                isNewFlags.push(true);
            } else {
                isNewFlags.push(false);
                duplicatesInPack++;
            }
        }

        const ptsEarned = POINTS_PER_BOOSTER + (duplicatesInPack * POINTS_PER_DUPLICATE);
        u.points += ptsEarned;
        u.stats.boostersOpened = (u.stats.boostersOpened || 0) + 1;
        if (!u.stats.boostersBySet) u.stats.boostersBySet = {};
        // [SET 2] Remplacer DEFAULT_SET_NUMBER par le setNumber du booster ouvert
        u.stats.boostersBySet[String(DEFAULT_SET_NUMBER)] = (u.stats.boostersBySet[String(DEFAULT_SET_NUMBER)] || 0) + 1;
        u.stats.duplicatesObtained = (u.stats.duplicatesObtained || 0) + duplicatesInPack;

        // [SET 2] Adapter le setNumber selon le booster ouvert
        const milestoneInfo = checkAndGrantCompletionMilestones(userId, DEFAULT_SET_NUMBER);

        if (!isSandboxId(userId)) {
            tcgBridge.trackBattlePassProgress(userId, 'tcg_booster', 1);
            if (duplicatesInPack > 0) {
                tcgBridge.trackBattlePassProgress(userId, 'tcg_doublon', duplicatesInPack);
            }

            const qEvents = [{ type: 'open_boosters', amount: 1 }];
            for (const c of draw.cards) {
                if (c.rarity === 'Rare') qEvents.push({ type: 'pull_rare', amount: 1 });
                else if (c.rarity === 'Épique') qEvents.push({ type: 'pull_epic', amount: 1 });
                else if (c.rarity === 'Légendaire') qEvents.push({ type: 'pull_legendary', amount: 1 });
                else if (c.rarity === 'Full Art') qEvents.push({ type: 'pull_fullart', amount: 1 });
            }
            await progressCommunityQuest(client, qEvents, userId).catch(() => {});

            const data = getStoreData();
            if (data.notifs?.[userId]) armerNotifBooster(userId, client);
            tcgBridge.demanderSauvegarde();
        }

        const gifEmbed = new EmbedBuilder()
            .setColor(0xf1c40f)
            .setAuthor({ name: `Ouverture de ${member.displayName}`, iconURL: member.displayAvatarURL({ dynamic: true }) })
            .setTitle(isFiveCard ? `🎴 Ouverture du Booster 5 Cartes ${SET1_NAME} en cours...` : `✨ Ouverture du Booster ${SET1_NAME} en cours...`);

        const files = [];
        if (assetPaths.openingGif && fs.existsSync(assetPaths.openingGif)) {
            files.push(new AttachmentBuilder(assetPaths.openingGif, { name: 'ouverture_set1.gif' }));
            gifEmbed.setImage('attachment://ouverture_set1.gif');
        }

        let sentMsg;
        if (targetResponder.isButton?.()) {
            const isExistingRecap = Boolean(
                targetResponder.message?.id && (
                    boosterSessions.has(targetResponder.message.id) ||
                    targetResponder.message.embeds?.some(e =>
                        (typeof e?.title === 'string' && e.title.startsWith('📊 Récapitulatif du Booster')) ||
                        (typeof e?.title === 'string' && e.title.includes('RÉCAPITULATIF') && e.title.includes('GOD PACK'))
                    )
                )
            );
            if (!isExistingRecap) {
                await targetResponder.deferUpdate();
                sentMsg = await targetResponder.editReply({
                    content: null,
                    embeds: [gifEmbed],
                    components: [],
                    files,
                    attachments: []
                });
            } else {
                sentMsg = await targetResponder.reply(withSilent({ embeds: [gifEmbed], files, fetchReply: true }));
                disableBoosterOpenButtonOnMessage(targetResponder.message).catch(() => {});
            }
        } else if (targetResponder.isRepliable?.()) {
            if (targetResponder.deferred || targetResponder.replied) {
                sentMsg = await targetResponder.followUp(withSilent({ embeds: [gifEmbed], files, fetchReply: true }));
            } else {
                sentMsg = await targetResponder.reply(withSilent({ embeds: [gifEmbed], files, fetchReply: true }));
            }
        } else {
            sentMsg = await targetResponder.reply(withSilent({ embeds: [gifEmbed], files }));
        }

        const session = {
            userId,
            cards: draw.cards,
            isNewFlags,
            ptsEarned,
            unlockedMilestones: milestoneInfo.unlocked,
            milestoneBonusPts: milestoneInfo.totalBonusPts,
            pendingMasterSets: milestoneInfo.masteredSets || [],
            milestoneAnnounced: false,
            milestoneTimer: null,
            luckyUsed: draw.luckyUsed,
            pityUsed: draw.pityUsed,
            fiveCardUsed: isFiveCard,
            isGodPack: Boolean(draw.isGodPack),
            godBoostUsed: Boolean(draw.godBoostUsed),
            halfCdUsed,
            triggeredNextPity: draw.triggeredNextPity,
            fromHub: Boolean(fromHub),
            step: 0,
            hasReachedRecap: false,
            skipUsed: false,
            pantheonSent: false,
            recapBuffer: null,
            recapTheme: null,
            inspectTimeout: null,
            card3AutoRecapTimer: null,
            gifTimeout: null,
            message: sentMsg
        };
        cancelPanelAutoDelete(sentMsg.id);
        boosterSessions.set(sentMsg.id, session);

        if (!isSandboxId(userId)) {
            recordRecentOpeningTcg({
                userId,
                displayName: member?.displayName || member?.user?.username || userId,
                channelId: sentMsg.channelId,
                messageId: sentMsg.id,
                timestamp: Date.now(),
                isGodPack: Boolean(draw.isGodPack),
                luckyUsed: Boolean(draw.luckyUsed),
                pityUsed: Boolean(draw.pityUsed),
                cards: draw.cards.map((c, idx) => ({
                    id: c.id,
                    name: c.name,
                    rarity: c.rarity,
                    isHolo: Boolean(c.isHolo),
                    isNew: Boolean(isNewFlags[idx])
                }))
            });
        }

        // Si un palier a été franchi et que le récapitulatif n'est pas affiché sous 2 minutes, mention discrète dans le salon
        if (session.unlockedMilestones.length > 0 && sentMsg?.channel) {
            session.milestoneTimer = setTimeout(async () => {
                session.milestoneTimer = null;
                if (session.milestoneAnnounced) return;
                session.milestoneAnnounced = true;
                const latestU = getOrCreateTcgUser(userId);
                const labels = session.unlockedMilestones.map(m => `**${m.pct}%** (+${m.reward} pts)`).join(', ');
                await sendSilent(
                    sentMsg.channel,
                    `🏆 <@${userId}>, bravo ! Tu as atteint ${session.unlockedMilestones.length > 1 ? 'les paliers' : 'le palier'} ${labels} de complétion du **${SET1_NAME}** *(Nouveau solde : **${latestU.points} pts**)* !`
                ).catch(() => {});
            }, 2 * 60 * 1000);
            session.milestoneTimer.unref?.();
        }

        // Libérer le buffer image du récap après 15 min, et la session après 2h
        const recapCleanTimer = setTimeout(() => {
            session.recapBuffer = null;
        }, 15 * 60 * 1000);
        recapCleanTimer.unref?.();

        const sessionExpireTimer = setTimeout(() => {
            if (session.gifTimeout) {
                clearTimeout(session.gifTimeout);
                session.gifTimeout = null;
            }
            if (session.milestoneTimer) {
                clearTimeout(session.milestoneTimer);
                session.milestoneTimer = null;
            }
            clearCard3AutoRecapTimer(session);
            clearBoosterInspectTimeout(session);
            session.recapBuffer = null;
            boosterSessions.delete(sentMsg.id);
        }, 2 * 60 * 60 * 1000);
        sessionExpireTimer.unref?.();

        session.gifTimeout = setTimeout(async () => {
            session.gifTimeout = null;
            boostersEnCours.delete(userId);
            if (!session.skipUsed) {
                try {
                    const firstPayload = buildBoosterCardEmbed(member, session, 0);
                    if (!session.skipUsed) {
                        await sentMsg.edit({ ...firstPayload, attachments: [] });
                        scheduleBoosterInspectTimeout(member, session);
                    }
                } catch {}
            }
        }, BOOSTER_GIF_DELAY_MS);
    } catch (err) {
        boostersEnCours.delete(userId);
        console.error('Erreur startBoosterOpening:', err);
    }
}

// ==========================================
//   AFFICHAGE CLASSEUR & CARTE & FLEX
// ==========================================

function buildBinderComponents(ownerId, viewerId, options, totalPages, ownerTheme = 'B') {
    const { setNumber = DEFAULT_SET_NUMBER, category, perPageMode, page, sortMode, rarityFilter = 'all', fromHub = false } = options;
    const isPersoView = category === 'perso';
    const ownedMode = normalizeBinderOwnedMode(options.ownedMode ?? options.ownedOnly);
    const hubFlag = fromHub ? '1' : '0';
    const ownedFlag = ownedMode;

    const effectiveSort = (isPersoView && sortMode === 'rarity')
        ? 'number'
        : ((rarityFilter !== 'all' && sortMode === 'rarity') ? 'number' : sortMode);
    const setCfg = getSetConfig(setNumber);
    const setCardsAll = getSetCatalog(setNumber);
    const countCat = (cat) => setCardsAll.filter(c => c.category === cat).length;

    const uOwner = getOrCreateTcgUser(ownerId);
    const ownedPersoCount = persoCatalog.filter(c => (uOwner.cards?.[c.id] || 0) > 0).length;
    const catOptions = [
        { label: `Complet ${setCfg.name} (${setCardsAll.length} cartes)`, value: 'complet', emoji: '📚', default: category === 'complet' },
        { label: `Items (${countCat('Items')} cartes)`, value: 'Items', emoji: '🧰', default: category === 'Items' },
        { label: `Personnages (${countCat('Personnages')} cartes)`, value: 'Personnages', emoji: '🧑', default: category === 'Personnages' },
        { label: `Références (${countCat('Références')} cartes)`, value: 'Références', emoji: '🎬', default: category === 'Références' }
    ];
    if (ownedPersoCount > 0 || isPersoView) {
        catOptions.push({
            label: `Cartes Perso (${ownedPersoCount} carte${ownedPersoCount > 1 ? 's' : ''})`,
            value: 'perso',
            emoji: '🌟',
            default: isPersoView
        });
    }

    const catMenu = new StringSelectMenuBuilder()
        .setCustomId(`tcg:bcat:${ownerId}:${viewerId}:${perPageMode}:${effectiveSort}:${rarityFilter}:${hubFlag}:${ownedFlag}`)
        .setPlaceholder('Choisir un classeur...')
        .addOptions(catOptions);

    const nextPerPage = perPageMode === '4' ? '18' : (perPageMode === '18' ? '36' : (perPageMode === '36' ? 'all' : '4'));
    const sizeLabel = perPageMode === 'all' ? 'All' : perPageMode;
    const rIdx = BINDER_RARITY_ORDER.indexOf(rarityFilter);
    const nextRarity = BINDER_RARITY_ORDER[(rIdx === -1 ? 0 : rIdx + 1) % BINDER_RARITY_ORDER.length];
    const rBtn = BINDER_RARITY_BTN[rarityFilter] || BINDER_RARITY_BTN.all;
    const canSortByRarity = rarityFilter === 'all';
    const nextSort = canSortByRarity
        ? (effectiveSort === 'number' ? 'rarity' : (effectiveSort === 'rarity' ? 'quantity' : 'number'))
        : (effectiveSort === 'number' ? 'quantity' : 'number');
    const currentSortLabel = effectiveSort === 'rarity'
        ? 'Tri : Rareté'
        : (effectiveSort === 'quantity' ? 'Tri : Quantité' : 'Tri : Numéro');
    const canInspect = canControlTcgOwner(viewerId, ownerId);

    const navRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:bnav:prev:${ownerId}:${viewerId}:${category}:${perPageMode}:${page}:${effectiveSort}:${rarityFilter}:${hubFlag}:${ownedFlag}`)
            .setEmoji('◀️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page <= 0)
    );

    if (perPageMode !== 'all') {
        navRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`tcg:bpage:${ownerId}:${viewerId}:${category}:${perPageMode}:${effectiveSort}:${rarityFilter}:${hubFlag}:${ownedFlag}`)
                .setLabel(`Page ${page + 1}/${totalPages}`)
                .setEmoji('🔢')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(totalPages <= 1)
        );
    }

    navRow.addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:bnav:next:${ownerId}:${viewerId}:${category}:${perPageMode}:${page}:${effectiveSort}:${rarityFilter}:${hubFlag}:${ownedFlag}`)
            .setEmoji('▶️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page >= totalPages - 1),
        new ButtonBuilder()
            .setCustomId(`tcg:bsize:${ownerId}:${viewerId}:${category}:${nextPerPage}:${effectiveSort}:${rarityFilter}:${hubFlag}:${ownedFlag}`)
            .setLabel(`Grille : ${sizeLabel}`)
            .setEmoji('📐')
            .setStyle(ButtonStyle.Secondary)
    );

    const nextOwnedMode = ownedMode === '0' ? '1' : (ownedMode === '1' ? '2' : '0');
    const ownedBtnCfg = ownedMode === '2'
        ? { label: 'Affichage : Doublons', emoji: '🔁', style: ButtonStyle.Success }
        : (ownedMode === '1'
            ? { label: 'Affichage : Possédées', emoji: '✅', style: ButtonStyle.Primary }
            : { label: 'Affichage : Tout', emoji: '👁️', style: ButtonStyle.Secondary });

    const persoSortNext = effectiveSort === 'number' ? 'quantity' : 'number';
    const filterRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:bowned:${ownerId}:${viewerId}:${category}:${perPageMode}:${effectiveSort}:${rarityFilter}:${hubFlag}:${nextOwnedMode}`)
            .setLabel(ownedBtnCfg.label)
            .setEmoji(ownedBtnCfg.emoji)
            .setStyle(ownedBtnCfg.style)
            .setDisabled(isPersoView),
        new ButtonBuilder()
            .setCustomId(`tcg:brarity:${ownerId}:${viewerId}:${category}:${perPageMode}:${nextRarity}:${nextRarity !== 'all' && effectiveSort === 'rarity' ? 'number' : effectiveSort}:${hubFlag}:${ownedFlag}`)
            .setLabel(rBtn.label)
            .setEmoji(rBtn.emoji)
            .setStyle(rBtn.style)
            .setDisabled(isPersoView),
        new ButtonBuilder()
            .setCustomId(`tcg:bsort:${ownerId}:${viewerId}:${category}:${perPageMode}:${page}:${isPersoView ? persoSortNext : nextSort}:${rarityFilter}:${hubFlag}:${ownedFlag}`)
            .setLabel(currentSortLabel)
            .setEmoji('🔀')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`tcg:btheme:${ownerId}:${viewerId}:${category}:${perPageMode}:${page}:${effectiveSort}:${rarityFilter}:${hubFlag}:${ownedFlag}`)
            .setLabel(ownerTheme === 'W' ? 'Mode Clair' : 'Mode Nuit')
            .setEmoji(ownerTheme === 'W' ? '☀️' : '🌙')
            .setStyle(ButtonStyle.Secondary)
    );

    const bottomRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:binspect:${ownerId}:${viewerId}:${category}:${perPageMode}:${page}:${effectiveSort}:${rarityFilter}:${hubFlag}:${ownedFlag}`)
            .setLabel('Inspecter')
            .setEmoji('🔎')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!canInspect),
        buildAccueilButton(viewerId),
        buildCloseButton(viewerId)
    );

    return [
        new ActionRowBuilder().addComponents(catMenu),
        navRow,
        filterRow,
        bottomRow
    ];
}

async function buildBinderReplyPayload(ownerMember, viewerId, options = {}) {
    const ownerUser = ownerMember.user || ownerMember;
    const u = getOrCreateTcgUser(ownerMember.id);
    const rawPerPage = options.perPageMode || '18';
    const isPersoCat = options.category === 'perso';
    const rarityFilter = isPersoCat ? 'all' : (BINDER_RARITY_CODES[options.rarityFilter] !== undefined ? options.rarityFilter : 'all');
    const rawSort = options.sortMode || 'number';
    const ownedMode = isPersoCat ? '0' : normalizeBinderOwnedMode(options.ownedMode ?? options.ownedOnly);
    const opts = {
        setNumber: options.setNumber || DEFAULT_SET_NUMBER, // [SET 2]
        category: options.category || 'complet',
        perPageMode: rawPerPage === '9' ? '4' : rawPerPage,
        page: options.page || 0,
        sortMode: (isPersoCat && rawSort === 'rarity') ? 'number' : ((rarityFilter !== 'all' && rawSort === 'rarity') ? 'number' : rawSort),
        rarityFilter,
        ownedMode,
        fromHub: Boolean(options.fromHub)
    };

    const rendered = await renderBinderCanvas(ownerMember, u, opts);
    opts.page = rendered.safePage;
    const rarityLabel = BINDER_RARITY_CODES[opts.rarityFilter];
    const ownedTag = opts.ownedMode === '2' ? ' *(Doublons x2+)*' : (opts.ownedMode === '1' ? ' *(Possédées)*' : '');
    const catTitle = isPersoCat ? 'Cartes Perso' : (opts.category === 'complet' ? getSetConfig(opts.setNumber).name : opts.category);
    const countTxt = isPersoCat
        ? `**${rendered.ownedInView}** carte${rendered.ownedInView > 1 ? 's' : ''}`
        : `**${rendered.ownedInView}/${rendered.totalInView}** cartes`;

    const embed = new EmbedBuilder()
        .setColor(u.theme === 'W' ? 0xecf0f1 : 0x2c3e50)
        .setAuthor({ name: `Classeur de ${ownerMember.displayName || ownerUser.username}`, iconURL: ownerUser.displayAvatarURL({ dynamic: true }) })
        .setDescription(
            `📖 **${catTitle}**` +
            `${rarityLabel ? ` • 💎 **${rarityLabel}**` : ''}` +
            `${ownedTag} • ${countTxt} • Tri : **${opts.sortMode === 'rarity' ? 'Rareté' : (opts.sortMode === 'quantity' ? 'Quantité' : 'Numéro')}**`
        )
        .setImage('attachment://regadex_classeur.jpg')
        .setFooter({ text: `Page ${rendered.safePage + 1}/${rendered.totalPages} • Mode ${u.theme === 'W' ? 'Clair (W)' : 'Nuit (B)'} • Classeur d'un membre : !classeur @membre` });

    return {
        embeds: [embed],
        files: [new AttachmentBuilder(rendered.buffer, { name: 'regadex_classeur.jpg' })],
        components: buildBinderComponents(ownerMember.id, viewerId, opts, rendered.totalPages, u.theme)
    };
}

function buildBinderInspectPayload(card, ownerId, viewerId, binderMsgId) {
    const meta = RARITY_META[card.rarity] || RARITY_META['Commune'];
    const u = getOrCreateTcgUser(ownerId);
    const qty = u.cards?.[card.id] || 0;
    const isAlreadyFlex = u.favoriteCardId === card.id;

    let extraLines = '';
    if (card.holoCounterpartId && (u.cards?.[card.holoCounterpartId] || 0) > 0) {
        extraLines += `\n✨ **Version Holographique :** \`${card.holoCounterpartId}\` *(x${u.cards[card.holoCounterpartId]})*`;
    } else if (card.baseCounterpartId && (u.cards?.[card.baseCounterpartId] || 0) > 0) {
        extraLines += `\n🃏 **Version Classique :** \`${card.baseCounterpartId}\` *(x${u.cards[card.baseCounterpartId]})*`;
    }
    if (card.negativeCounterpartId && (u.cards?.[card.negativeCounterpartId] || 0) > 0) {
        extraLines += `\n🕳️ **Version Négative :** \`${card.negativeCounterpartId}\` *(x${u.cards[card.negativeCounterpartId]})*`;
    }

    const rarityDesc = card.isPerso
        ? `🌟 **Rareté :** **${card.rarity}** *(Unique & Non échangeable)*`
        : `✨ **Rareté :** **${card.rarity}**${card.isHolo ? ' *(Holographique — 2× plus rare)*' : ''}`;

    const embed = new EmbedBuilder()
        .setColor(meta.color)
        .setTitle(`${meta.emoji} ${card.id} — ${card.name}`)
        .setDescription(
            `📁 **Catégorie :** ${card.category}\n` +
            `${rarityDesc}\n` +
            `📦 **Dans ton RegaDex :** \`x${qty}\`` +
            extraLines
        )
        .setImage('attachment://carte_regadex.png')
        .setFooter({ text: card.isPerso ? 'RegaDex • Cartes Perso • Inspection depuis le classeur' : `RegaDex ${SET1_NAME} • Inspection depuis le classeur` });

    const files = [];
    if (card.filePath && fs.existsSync(card.filePath)) {
        files.push(new AttachmentBuilder(card.filePath, { name: 'carte_regadex.png' }));
    }

    const inWishlist = getSanitizedWishlist(u).includes(card.id);
    const wishlistFull = getSanitizedWishlist(u).length >= MAX_WISHLIST;

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:binback:${binderMsgId}:${ownerId}:${viewerId}`)
            .setLabel('Retour au classeur')
            .setEmoji('⬅️')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`tcg:setflex:${card.id}:${ownerId}:binspect`)
            .setLabel(isAlreadyFlex ? 'Flex actuel' : 'Définir Flex')
            .setEmoji('⭐')
            .setStyle(isAlreadyFlex ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setDisabled(isAlreadyFlex || qty <= 0)
    );
    if (!card.isPerso) {
        row1.addComponents(
            new ButtonBuilder()
                .setCustomId(`tcg:wish:toggle:${card.id}:${ownerId}:binspect:${binderMsgId}`)
                .setLabel(inWishlist ? 'Dans la Wishlist' : '+ Wishlist')
                .setEmoji(inWishlist ? '💔' : '❤️')
                .setStyle(inWishlist ? ButtonStyle.Success : ButtonStyle.Secondary)
                .setDisabled(!inWishlist && wishlistFull)
        );
    }

    const canTransformHolo = !card.isPerso && !card.isHolo && Boolean(card.holoCounterpartId) && qty >= 1 && (u.inventory?.holoTransform || 0) >= 1;
    const canTransformNeg = !card.isPerso && card.rarity === 'Full Art' && Boolean(card.negativeCounterpartId) && qty >= 1 && (u.inventory?.negativeTransform || 0) >= 1;

    const row2 = new ActionRowBuilder();
    if (!card.isPerso) {
        row2.addComponents(
            new ButtonBuilder()
                .setCustomId(`tcg:carddups:${card.id}:${viewerId}`)
                .setLabel('Qui l\'a en doublon ?')
                .setEmoji('👥')
                .setStyle(ButtonStyle.Secondary)
        );
    }
    if (canTransformHolo) {
        row2.addComponents(
            new ButtonBuilder()
                .setCustomId(`tcg:cardholo:${card.id}:${ownerId}:binspect`)
                .setLabel('Passer en Holo')
                .setEmoji('✨')
                .setStyle(ButtonStyle.Primary)
        );
    }
    if (canTransformNeg) {
        row2.addComponents(
            new ButtonBuilder()
                .setCustomId(`tcg:cardneg:${card.id}:${ownerId}:binspect`)
                .setLabel('Passer en Négative')
                .setEmoji('🕳️')
                .setStyle(ButtonStyle.Primary)
        );
    }
    row2.addComponents(
        buildAccueilButton(viewerId),
        buildCloseButton(viewerId)
    );

    return { embeds: [embed], files, components: [row1, row2] };
}

function buildSingleCardPayload(card, viewerId, options = {}) {
    const meta = RARITY_META[card.rarity] || RARITY_META['Commune'];
    const u = getOrCreateTcgUser(viewerId);
    const qty = u.cards?.[card.id] || 0;
    const isPersoCard = Boolean(card.isPerso) || options.setNumber === 'perso';
    const activeSetNumber = isPersoCard ? 'perso' : (options.setNumber || card.setNumber || DEFAULT_SET_NUMBER);
    const setCfg = isPersoCard ? { name: 'Cartes Perso', shortName: 'Perso' } : getSetConfig(Number(activeSetNumber));
    const setOwned = isPersoCard
        ? persoCatalog.filter(c => (u.cards?.[c.id] || 0) > 0)
        : getSetCatalog(Number(activeSetNumber)).filter(c => (u.cards?.[c.id] || 0) > 0);
    const ownedCards = setOwned.length > 0 ? setOwned : cardCatalog.filter(c => (u.cards?.[c.id] || 0) > 0);
    const currentIdx = Math.max(0, ownedCards.findIndex(c => c.id === card.id));
    const canNav = ownedCards.length > 1;
    const isAlreadyFlex = u.favoriteCardId === card.id;

    // Anti-spoiler : n'afficher la version alternative que si le joueur la possède déjà !
    let extraLines = '';
    if (card.holoCounterpartId && (u.cards?.[card.holoCounterpartId] || 0) > 0) {
        extraLines += `\n✨ **Version Holo :** \`${card.holoCounterpartId}\` *(x${u.cards[card.holoCounterpartId]})*`;
    } else if (card.baseCounterpartId && (u.cards?.[card.baseCounterpartId] || 0) > 0) {
        extraLines += `\n🃏 **Version Classique :** \`${card.baseCounterpartId}\` *(x${u.cards[card.baseCounterpartId]})*`;
    }
    if (card.negativeCounterpartId && (u.cards?.[card.negativeCounterpartId] || 0) > 0) {
        extraLines += `\n🕳️ **Version Négative :** \`${card.negativeCounterpartId}\` *(x${u.cards[card.negativeCounterpartId]})*`;
    }

    const rarityDesc = card.isPerso
        ? `🌟 **Rareté :** **${card.rarity}** *(Unique & Non échangeable)*`
        : `✨ **Rareté :** **${card.rarity}**${card.isHolo ? ' *(Holographique — 2× plus rare)*' : ''}`;

    const embed = new EmbedBuilder()
        .setColor(meta.color)
        .setTitle(`${meta.emoji} ${card.id} — ${card.name}`)
        .setDescription(
            `📁 **Catégorie :** ${card.category}\n` +
            `${rarityDesc}\n` +
            `📦 **Dans ton RegaDex :** \`x${qty}\`` +
            extraLines
        )
        .setImage('attachment://carte_regadex.png')
        .setFooter({
            text: ownedCards.length > 0
                ? `RegaDex ${setCfg.name} • Carte possédée ${currentIdx + 1}/${ownedCards.length} • !carte [n° ou nom]`
                : `RegaDex ${setCfg.name} • Utilise !carte [numéro ou nom]`
        });

    const files = [];
    if (card.filePath && fs.existsSync(card.filePath)) {
        files.push(new AttachmentBuilder(card.filePath, { name: 'carte_regadex.png' }));
    }

    const inWishlist = getSanitizedWishlist(u).includes(card.id);
    const wishlistFull = getSanitizedWishlist(u).length >= MAX_WISHLIST;
    const activeSets = getActiveSets();
    const ownedPersoCount = persoCatalog.filter(c => (u.cards?.[c.id] || 0) > 0).length;
    const setTargetsCount = activeSets.length + (ownedPersoCount > 0 || isPersoCard ? 1 : 0);

    const components = [];

    if (ownedCards.length > 0) {
        const perMenuPage = ownedCards.length > 25 ? 23 : 25;
        const menuTotalPages = Math.max(1, Math.ceil(ownedCards.length / perMenuPage));
        const defaultMenuPage = Math.floor(currentIdx / perMenuPage);
        const safeMenuPage = typeof options.menuPage === 'number'
            ? Math.max(0, Math.min(options.menuPage, menuTotalPages - 1))
            : defaultMenuPage;

        const slice = ownedCards.slice(safeMenuPage * perMenuPage, (safeMenuPage + 1) * perMenuPage);
        const menuOptions = [];

        if (menuTotalPages > 1 && safeMenuPage > 0) {
            menuOptions.push({
                label: `⬅️ Cartes précédentes (Page ${safeMenuPage}/${menuTotalPages})`,
                description: 'Afficher les cartes précédentes de ta collection',
                value: `__page:${safeMenuPage - 1}`
            });
        }

        for (const c of slice) {
            const cMeta = RARITY_META[c.rarity] || RARITY_META['Commune'];
            menuOptions.push({
                label: `${c.id} • ${c.name}`.slice(0, 100),
                description: `${cMeta.emoji} ${c.rarity} • x${u.cards[c.id]}${u.favoriteCardId === c.id ? ' • ⭐ Flex' : ''}`.slice(0, 100),
                value: c.id,
                default: c.id === card.id
            });
        }

        if (menuTotalPages > 1 && safeMenuPage < menuTotalPages - 1) {
            menuOptions.push({
                label: `➡️ Cartes suivantes (Page ${safeMenuPage + 2}/${menuTotalPages})`,
                description: 'Afficher la suite de tes cartes possédées',
                value: `__page:${safeMenuPage + 1}`
            });
        }

        const cardMenu = new StringSelectMenuBuilder()
            .setCustomId(`tcg:cartesel:${viewerId}:${card.id}:${activeSetNumber}`)
            .setPlaceholder(
                menuTotalPages > 1
                    ? `Tes cartes possédées (Liste ${safeMenuPage + 1}/${menuTotalPages})...`
                    : `Tes cartes possédées (${ownedCards.length})...`
            )
            .addOptions(menuOptions);

        components.push(new ActionRowBuilder().addComponents(cardMenu));
    }

    const canTransformHolo = !card.isPerso && !card.isHolo && Boolean(card.holoCounterpartId) && qty >= 1 && (u.inventory?.holoTransform || 0) >= 1;
    const canTransformNeg = !card.isPerso && card.rarity === 'Full Art' && Boolean(card.negativeCounterpartId) && qty >= 1 && (u.inventory?.negativeTransform || 0) >= 1;

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:cartenav:prev:${card.id}:${viewerId}`)
            .setLabel('Précédente')
            .setEmoji('◀️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!canNav),
        new ButtonBuilder()
            .setCustomId(`tcg:cartenav:next:${card.id}:${viewerId}`)
            .setLabel('Suivante')
            .setEmoji('▶️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!canNav),
        new ButtonBuilder()
            .setCustomId(`tcg:setflex:${card.id}:${viewerId}:card`)
            .setLabel(isAlreadyFlex ? 'Flex actuel' : 'Définir Flex')
            .setEmoji('⭐')
            .setStyle(isAlreadyFlex ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setDisabled(isAlreadyFlex || qty <= 0)
    );
    if (!card.isPerso) {
        row1.addComponents(
            new ButtonBuilder()
                .setCustomId(`tcg:wish:toggle:${card.id}:${viewerId}:card`)
                .setLabel(inWishlist ? 'Dans la Wishlist' : '+ Wishlist')
                .setEmoji(inWishlist ? '💔' : '❤️')
                .setStyle(inWishlist ? ButtonStyle.Success : ButtonStyle.Secondary)
                .setDisabled(!inWishlist && wishlistFull)
        );
    }
    if (canTransformHolo) {
        row1.addComponents(
            new ButtonBuilder()
                .setCustomId(`tcg:cardholo:${card.id}:${viewerId}:card`)
                .setLabel('Passer en Holo')
                .setEmoji('✨')
                .setStyle(ButtonStyle.Primary)
        );
    }

    // S'active dès qu'un 2e Set ou des Cartes Perso sont disponibles
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:carteset:${activeSetNumber}:${card.id}:${viewerId}`)
            .setLabel(`Changer de Set (${setCfg.shortName})`)
            .setEmoji('🗂️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(setTargetsCount <= 1)
    );
    if (!card.isPerso) {
        row2.addComponents(
            new ButtonBuilder()
                .setCustomId(`tcg:carddups:${card.id}:${viewerId}`)
                .setLabel('Qui l\'a en doublon ?')
                .setEmoji('👥')
                .setStyle(ButtonStyle.Secondary)
        );
    }
    if (canTransformNeg) {
        row2.addComponents(
            new ButtonBuilder()
                .setCustomId(`tcg:cardneg:${card.id}:${viewerId}:card`)
                .setLabel('Passer en Négative')
                .setEmoji('🕳️')
                .setStyle(ButtonStyle.Primary)
        );
    }
    row2.addComponents(
        buildAccueilButton(viewerId),
        buildCloseButton(viewerId)
    );

    components.push(row1, row2);
    return { embeds: [embed], files, components };
}

function buildUnownedCardPayload(card, viewerId) {
    if (card.isPerso) {
        const row = new ActionRowBuilder().addComponents(
            buildAccueilButton(viewerId),
            buildCloseButton(viewerId)
        );
        return {
            content: `🔒 Tu ne possèdes pas la carte personnalisée \`${card.id}\`. *(Carte unique & non échangeable)*`,
            components: [row]
        };
    }

    const u = getOrCreateTcgUser(viewerId);
    const inWishlist = getSanitizedWishlist(u).includes(card.id);
    const wishlistFull = getSanitizedWishlist(u).length >= MAX_WISHLIST;

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:carddups:${card.id}:${viewerId}`)
            .setLabel('Qui l\'a en doublon ?')
            .setEmoji('👥')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`tcg:wish:toggle:${card.id}:${viewerId}:unowned`)
            .setLabel(inWishlist ? 'Dans la Wishlist' : '+ Wishlist')
            .setEmoji(inWishlist ? '💔' : '❤️')
            .setStyle(inWishlist ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setDisabled(!inWishlist && wishlistFull),
        new ButtonBuilder()
            .setCustomId(`tcg:cartemissing:${viewerId}:0`)
            .setLabel('Non découvertes')
            .setEmoji('🔒')
            .setStyle(ButtonStyle.Secondary),
        buildAccueilButton(viewerId),
        buildCloseButton(viewerId)
    );

    return {
        content: `🔒 Tu n'as pas encore découvert la carte \`${card.id}\` dans ton RegaDex ! La surprise reste totale 🤫`,
        components: [row]
    };
}

function buildCarteHubPayload(authorMember, channel, options = {}) {
    const uid = authorMember.id;
    const u = getOrCreateTcgUser(uid);
    const data = getStoreData();
    const activeTrade = data.activeTrades?.[channel?.id];

    const ownedCards = [...cardCatalog, ...persoCatalog].filter(c => (u.cards?.[c.id] || 0) > 0);
    const unownedCards = cardCatalog.filter(c => (u.cards?.[c.id] || 0) <= 0);
    const mode = options.mode === 'missing' ? 'missing' : 'owned';

    const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle('🔎 Cartes RegaDex (`!carte`)')
        .setDescription(
            `Sélectionne directement une carte ci-dessous ou clique sur **🔎 Chercher** *(ex : \`1-84\`, \`1-Ø1\`, \`Epsys Full Art\`)*.\n\n` +
            `• 📦 **Possédées :** \`${ownedCards.length}\` carte(s)\n` +
            `• 🔒 **Non découvertes :** \`${unownedCards.length}\` carte(s) *(zéro spoiler : tu peux voir qui les a en doublon et les ajouter en Wishlist)*`
        );

    const components = [];

    if (mode === 'missing') {
        if (unownedCards.length > 0) {
            const perPage = unownedCards.length > 25 ? 23 : 25;
            const totalPages = Math.max(1, Math.ceil(unownedCards.length / perPage));
            const safePage = Math.max(0, Math.min(options.page || 0, totalPages - 1));
            const slice = unownedCards.slice(safePage * perPage, (safePage + 1) * perPage);
            const opts = [];

            if (totalPages > 1 && safePage > 0) {
                opts.push({
                    label: `⬅️ Page précédente (${safePage}/${totalPages})`,
                    description: 'Voir les cartes non découvertes précédentes',
                    value: `__page:${safePage - 1}`
                });
            }
            for (const c of slice) {
                const meta = RARITY_META[c.rarity] || RARITY_META['Commune'];
                const dups = getCardDuplicateOwners(c.id, uid).length;
                opts.push({
                    label: `🔒 ${c.id} • Carte non découverte (${c.category})`.slice(0, 100),
                    description: `${meta.emoji} ${c.rarity} • ${dups > 0 ? `👥 ${dups} membre(s) en doublon` : 'Aucun doublon dispo'}`.slice(0, 100),
                    value: c.id
                });
            }
            if (totalPages > 1 && safePage < totalPages - 1) {
                opts.push({
                    label: `➡️ Page suivante (${safePage + 2}/${totalPages})`,
                    description: 'Voir la suite des cartes non découvertes',
                    value: `__page:${safePage + 1}`
                });
            }

            components.push(
                new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId(`tcg:cartemissingsel:${uid}`)
                        .setPlaceholder(`🔒 Cartes non découvertes (Page ${safePage + 1}/${totalPages})...`)
                        .addOptions(opts)
                )
            );
        }
    } else if (ownedCards.length > 0) {
        const perPage = ownedCards.length > 25 ? 23 : 25;
        const totalPages = Math.max(1, Math.ceil(ownedCards.length / perPage));
        const safePage = Math.max(0, Math.min(options.page || 0, totalPages - 1));
        const slice = ownedCards.slice(safePage * perPage, (safePage + 1) * perPage);
        const opts = [];

        if (totalPages > 1 && safePage > 0) {
            opts.push({
                label: `⬅️ Page précédente (${safePage}/${totalPages})`,
                description: 'Voir tes cartes précédentes',
                value: `__page:${safePage - 1}`
            });
        }
        for (const c of slice) {
            const meta = RARITY_META[c.rarity] || RARITY_META['Commune'];
            opts.push({
                label: `${c.id} • ${c.name}`.slice(0, 100),
                description: `${meta.emoji} ${c.rarity} • ×${u.cards[c.id]}${u.favoriteCardId === c.id ? ' • ⭐ Flex' : ''}`.slice(0, 100),
                value: c.id
            });
        }
        if (totalPages > 1 && safePage < totalPages - 1) {
            opts.push({
                label: `➡️ Page suivante (${safePage + 2}/${totalPages})`,
                description: 'Voir la suite de tes cartes possédées',
                value: `__page:${safePage + 1}`
            });
        }

        components.push(
            new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`tcg:cartesel:${uid}:__hub:${DEFAULT_SET_NUMBER}`)
                    .setPlaceholder(`📦 Tes cartes possédées (Page ${safePage + 1}/${totalPages})...`)
                    .addOptions(opts)
            )
        );
    }

    const rowTools = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:cartesearch:${uid}`)
            .setLabel('Chercher (nom/n°)')
            .setEmoji('🔎')
            .setStyle(ButtonStyle.Primary),
        mode === 'missing'
            ? new ButtonBuilder()
                .setCustomId(`tcg:cartehub:${uid}:0`)
                .setLabel(`Possédées (${ownedCards.length})`)
                .setEmoji('📦')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(ownedCards.length === 0)
            : new ButtonBuilder()
                .setCustomId(`tcg:cartemissing:${uid}:0`)
                .setLabel(`Non découvertes (${unownedCards.length})`)
                .setEmoji('🔒')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(unownedCards.length === 0),
        new ButtonBuilder()
            .setCustomId(`tcg:binder:open:${uid}:${uid}:1`)
            .setLabel('Mon classeur')
            .setEmoji('📖')
            .setStyle(ButtonStyle.Secondary)
    );
    components.push(rowTools);

    const rowNav = new ActionRowBuilder();
    if (activeTrade) {
        const partnerId = activeTrade.initiatorId === uid ? activeTrade.targetId : activeTrade.initiatorId;
        rowNav.addComponents(
            new ButtonBuilder()
                .setCustomId(`tcg:binder:ask:${partnerId}:${uid}`)
                .setLabel('Classeur partenaire')
                .setEmoji('🤝')
                .setStyle(ButtonStyle.Secondary)
        );
    }
    rowNav.addComponents(buildAccueilButton(uid), buildCloseButton(uid));
    components.push(rowNav);

    if (!activeTrade) {
        components.push(
            new ActionRowBuilder().addComponents(
                new UserSelectMenuBuilder()
                    .setCustomId(`tcg:binder:pickuser:${uid}`)
                    .setPlaceholder('Consulter le classeur d\'un autre membre...')
            )
        );
    }

    return { embeds: [embed], components };
}

async function sendBinderAccessWarning(targetResponder, requesterId, targetMember) {
    const targetName = targetMember.displayName || targetMember.username || 'ce membre';
    const embed = new EmbedBuilder()
        .setColor(0xf39c12)
        .setTitle('🔔 Confirmation avant mention')
        .setDescription(
            `Demander l'accès au classeur RegaDex de **${targetName}** (<@${targetMember.id}>) va **le/la mentionner** *(avec notification)* pour lui demander son autorisation.\n\n` +
            `Souhaites-tu envoyer la demande ?`
        );

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:binder:confirm:${targetMember.id}:${requesterId}`)
            .setLabel('Envoyer et mentionner')
            .setEmoji('🔔')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`tcg:binder:cancelask:${requesterId}`)
            .setLabel('Annuler')
            .setEmoji('❌')
            .setStyle(ButtonStyle.Secondary)
    );

    if (targetResponder.isRepliable?.()) {
        return targetResponder.reply({ embeds: [embed], components: [row], ephemeral: true });
    }
    return replyPanelSilent(targetResponder, { embeds: [embed], components: [row] }, requesterId);
}

async function handleCarteCommand(targetResponder, authorMember, rawArg, channel) {
    const query = (rawArg || '').trim();
    if (!query) {
        return replyPanelSilent(targetResponder, buildCarteHubPayload(authorMember, channel), authorMember.id);
    }

    const u = getOrCreateTcgUser(authorMember.id);
    const res = resolveCardQuery(query);

    // 1. Correspondance unique : vérifier la possession avant tout affichage (zéro spoiler)
    if (res.card) {
        if ((u.cards?.[res.card.id] || 0) <= 0) {
            if (res.isCodeQuery) {
                return replyPanelSilent(targetResponder, buildUnownedCardPayload(res.card, authorMember.id), authorMember.id);
            }
            return replyPanelSilent(
                targetResponder,
                `🔒 Tu n'as pas encore découvert cette carte dans ton RegaDex ! La surprise reste totale 🤫`,
                authorMember.id
            );
        }
        const payload = buildSingleCardPayload(res.card, authorMember.id);
        return replyPanelSilent(targetResponder, payload, authorMember.id);
    }

    // 2. Correspondances multiples : ne proposer QUE les cartes possédées
    if (res.matches.length > 1) {
        const ownedMatches = res.matches.filter(c => (u.cards?.[c.id] || 0) > 0);
        if (ownedMatches.length === 0) {
            return replyPanelSilent(
                targetResponder,
                `🔒 Tu ne possèdes aucune carte correspondant à cette recherche dans ton RegaDex !`,
                authorMember.id
            );
        }
        if (ownedMatches.length === 1) {
            const payload = buildSingleCardPayload(ownedMatches[0], authorMember.id);
            return replyPanelSilent(targetResponder, payload, authorMember.id);
        }

        const opts = ownedMatches.slice(0, 25).map(c => ({
            label: `${c.id} • ${c.name}`.slice(0, 100),
            description: `${c.category} • ${c.rarity} • x${u.cards[c.id]}`,
            value: c.id
        }));
        const menu = new StringSelectMenuBuilder()
            .setCustomId(`tcg:cartesel:${authorMember.id}`)
            .setPlaceholder('Plusieurs cartes possédées correspondent, choisis...')
            .addOptions(opts);
        const navRow = new ActionRowBuilder().addComponents(
            buildAccueilButton(authorMember.id),
            buildCloseButton(authorMember.id)
        );
        return replyPanelSilent(targetResponder, {
            content: `🔎 **${ownedMatches.length}** carte(s) possédée(s) correspondent à \`${query}\` :`,
            components: [new ActionRowBuilder().addComponents(menu), navRow]
        }, authorMember.id);
    }

    return replyPanelSilent(
        targetResponder,
        `🔒 Aucune carte découverte dans ton RegaDex ne correspond à \`${query}\`. Tape \`!carte\` pour voir les formats.`,
        authorMember.id
    );
}

async function buildFlexCardAttachment(card) {
    if (!card?.filePath || !fs.existsSync(card.filePath)) return null;
    try {
        const img = await loadImage(card.filePath);
        const targetW = Math.max(1, Math.round(img.width * 0.5));
        const targetH = Math.max(1, Math.round(img.height * 0.5));
        const canvas = createCanvas(targetW, targetH);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.patternQuality = 'best';
        ctx.drawImage(img, 0, 0, targetW, targetH);
        return new AttachmentBuilder(toPng(canvas), { name: 'flex_card.png' });
    } catch {
        return new AttachmentBuilder(card.filePath, { name: 'flex_card.png' });
    }
}

async function handleFlexCommand(targetResponder, authorMember, guild, rawArg) {
    const arg = (rawArg || '').trim();
    const authorU = getOrCreateTcgUser(authorMember.id);

    // 1. Modification : !tcg flex modify ...
    if (/^modify(?:\s+|$)/i.test(arg)) {
        const cardQuery = arg.replace(/^modify\s*/i, '').trim();
        if (!cardQuery) {
            return sendFlexPicker(targetResponder, authorMember, 0);
        }
        const res = resolveCardQuery(cardQuery);
        if (!res.card) {
            if (res.matches.length > 1) {
                const ownedMatches = res.matches.filter(c => (authorU.cards?.[c.id] || 0) > 0);
                if (ownedMatches.length === 0) {
                    return replySilent(targetResponder, "❌ Tu ne possèdes aucune des cartes correspondant à cette recherche.");
                }
                const menu = new StringSelectMenuBuilder()
                    .setCustomId(`tcg:flexset:${authorMember.id}`)
                    .setPlaceholder('Choisis ta nouvelle carte préférée...')
                    .addOptions(ownedMatches.slice(0, 25).map(c => ({
                        label: `${c.id} • ${c.name}`.slice(0, 100),
                        description: `${c.rarity} • Possédée x${authorU.cards[c.id]}`,
                        value: c.id
                    })));
                return replyPanelSilent(targetResponder, {
                    content: '✨ Choisis la carte à définir en préférée :',
                    components: [new ActionRowBuilder().addComponents(menu)]
                }, authorMember.id);
            }
            return replySilent(targetResponder, `❌ Carte introuvable pour \`${cardQuery}\`.`);
        }

        if ((authorU.cards?.[res.card.id] || 0) <= 0) {
            return replySilent(targetResponder, "❌ Tu dois d'abord posséder cette carte pour la mettre en carte préférée !");
        }

        authorU.favoriteCardId = res.card.id;
        tcgBridge.demanderSauvegarde();
        return replySilent(targetResponder, `⭐ Ta carte préférée est maintenant **${res.card.id} • ${res.card.name}** !`);
    }

    // 2. Flex d'un autre membre : !tcg flex <ID / @ / pseudo>
    if (arg) {
        const showMemberFlex = async (targetMember) => {
            if (!targetMember) return;
            const tu = getOrCreateTcgUser(targetMember.id);
            const fav = tu.favoriteCardId ? getCardByIdAny(tu.favoriteCardId) : null;
            if (!fav || (tu.cards?.[fav.id] || 0) <= 0) {
                return replySilent(targetResponder, `❌ **${targetMember.displayName || targetMember.username}** n'a pas encore défini de carte préférée.`);
            }
            const meta = RARITY_META[fav.rarity] || RARITY_META['Commune'];
            const embed = new EmbedBuilder()
                .setColor(meta.color)
                .setAuthor({ name: `Flex RegaDex de ${targetMember.displayName || targetMember.username}`, iconURL: (targetMember.user || targetMember).displayAvatarURL({ dynamic: true }) })
                .setTitle(`⭐ ${fav.id} — ${fav.name}`)
                .setDescription(`${meta.emoji} **Rareté :** ${fav.rarity}\n📦 **Exemplaires possédés :** \`x${tu.cards[fav.id]}\``)
                .setImage('attachment://flex_card.png');
            const flexAtt = await buildFlexCardAttachment(fav);
            const files = flexAtt ? [flexAtt] : [];
            return replySilent(targetResponder, { embeds: [embed], files });
        };

        if (targetResponder.isRepliable?.()) {
            return showMemberFlex(arg);
        }
        return resolveMemberArg(targetResponder, arg, showMemberFlex);
    }

    // 3. Flex personnel
    const fav = authorU.favoriteCardId ? getCardByIdAny(authorU.favoriteCardId) : null;
    if (!fav || (authorU.cards?.[fav.id] || 0) <= 0) {
        return sendFlexPicker(targetResponder, authorMember, 0);
    }

    if (!isSandboxId(authorMember.id)) {
        tcgBridge.trackBattlePassProgress(authorMember.id, 'tcg_flex', 1);
    }

    const meta = RARITY_META[fav.rarity] || RARITY_META['Commune'];
    const embed = new EmbedBuilder()
        .setColor(meta.color)
        .setAuthor({ name: `${authorMember.displayName} flex sa carte préférée !`, iconURL: authorMember.displayAvatarURL({ dynamic: true }) })
        .setTitle(`⭐ ${fav.id} — ${fav.name}`)
        .setImage('attachment://flex_card.png')
        .setFooter({ text: `Modifie avec !flex modify [carte] • ${SET1_NAME}` });
    const flexAtt = await buildFlexCardAttachment(fav);
    const files = flexAtt ? [flexAtt] : [];
    return replySilent(targetResponder, { embeds: [embed], files });
}

function sendFlexPicker(targetResponder, member, page = 0) {
    const u = getOrCreateTcgUser(member.id);
    const owned = [...cardCatalog, ...persoCatalog]
        .filter(c => (u.cards?.[c.id] || 0) > 0)
        .sort((a, b) => {
            const ra = RARITY_ORDER[a.rarity] ?? 0;
            const rb = RARITY_ORDER[b.rarity] ?? 0;
            if (rb !== ra) return rb - ra;
            if (a.isHolo !== b.isHolo) return b.isHolo ? 1 : -1;
            return a.sortIndex - b.sortIndex;
        });
    if (owned.length === 0) {
        return replySilent(targetResponder, "❌ Tu n'as pas encore de carte ! Ouvre d'abord un booster dans <#1572007962199851059>.");
    }

    const perPage = 25;
    const totalPages = Math.max(1, Math.ceil(owned.length / perPage));
    const safePage = Math.max(0, Math.min(page, totalPages - 1));
    const slice = owned.slice(safePage * perPage, (safePage + 1) * perPage);

    const menu = new StringSelectMenuBuilder()
        .setCustomId(`tcg:flexset:${member.id}`)
        .setPlaceholder(`Choisis ta carte préférée (Page ${safePage + 1}/${totalPages})...`)
        .addOptions(slice.map(c => ({
            label: `${c.id} • ${c.name}`.slice(0, 100),
            description: `${c.rarity} • x${u.cards[c.id]}`,
            value: c.id
        })));

    const btnRow = new ActionRowBuilder();
    if (totalPages > 1) {
        btnRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`tcg:flexpage:${member.id}:${safePage - 1}`)
                .setLabel('Précédent')
                .setEmoji('◀️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(safePage <= 0),
            new ButtonBuilder()
                .setCustomId(`tcg:flexpage:${member.id}:${safePage + 1}`)
                .setLabel('Suivant')
                .setEmoji('▶️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(safePage >= totalPages - 1)
        );
    }
    btnRow.addComponents(buildAccueilButton(member.id), buildCloseButton(member.id));

    const rows = [new ActionRowBuilder().addComponents(menu), btnRow];

    const content = '⭐ **Choisis ta carte préférée parmi ta collection :**';
    if (targetResponder.isButton?.() || targetResponder.isStringSelectMenu?.()) {
        return targetResponder.update({ content, embeds: [], components: rows, files: [], attachments: [] });
    }
    return replyPanelSilent(targetResponder, { content, components: rows }, member.id);
}

function sendHoloTransformPicker(targetResponder, member, page = 0, fromHub = false) {
    const u = getOrCreateTcgUser(member.id);
    const hubFlag = fromHub ? '1' : '0';
    const compatible = cardCatalog.filter(c =>
        !c.isHolo &&
        c.holoCounterpartId &&
        (u.cards?.[c.id] || 0) >= 1
    );

    if (compatible.length === 0) {
        const msg = "❌ Tu ne possèdes actuellement aucune carte compatible pouvant être transformée en version Holographique.";
        return targetResponder.isRepliable?.()
            ? targetResponder.reply({ content: msg, ephemeral: true })
            : replySilent(targetResponder, msg);
    }

    const perPage = 25;
    const totalPages = Math.max(1, Math.ceil(compatible.length / perPage));
    const safePage = Math.max(0, Math.min(page, totalPages - 1));
    const slice = compatible.slice(safePage * perPage, (safePage + 1) * perPage);

    const menu = new StringSelectMenuBuilder()
        .setCustomId(`tcg:holopick:${member.id}:${hubFlag}`)
        .setPlaceholder(`Choisis la carte à transformer (Page ${safePage + 1}/${totalPages})...`)
        .addOptions(slice.map(c => {
            const holo = cardById.get(c.holoCounterpartId);
            return {
                label: `${c.id} • ${c.name} → ${holo ? holo.id : 'Holo'}`.slice(0, 100),
                description: `${c.rarity} • Possédée x${u.cards[c.id]}`,
                value: c.id
            };
        }));

    const btnRow = new ActionRowBuilder();
    if (totalPages > 1) {
        btnRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`tcg:holopage:${member.id}:${safePage - 1}:${hubFlag}`)
                .setLabel('Précédent')
                .setEmoji('◀️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(safePage <= 0),
            new ButtonBuilder()
                .setCustomId(`tcg:holopage:${member.id}:${safePage + 1}:${hubFlag}`)
                .setLabel('Suivant')
                .setEmoji('▶️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(safePage >= totalPages - 1)
        );
    }
    btnRow.addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:claim:open:${member.id}:1`)
            .setLabel('Inventaire')
            .setEmoji('🎒')
            .setStyle(ButtonStyle.Secondary),
        buildAccueilButton(member.id),
        buildCloseButton(member.id)
    );
    const rows = [new ActionRowBuilder().addComponents(menu), btnRow];

    const payload = {
        content: '✨ **Transformation Holographique :** Choisis la carte à convertir *(consomme 1 copie normale → +1 version Holo)* :',
        embeds: [],
        components: rows,
        files: [],
        attachments: []
    };
    if (targetResponder.isButton?.()) return targetResponder.update(payload);
    return replySilent(targetResponder, payload);
}

// ==========================================
//   SYSTÈME D'ÉCHANGE (!TRADE & THREADS)
// ==========================================

function sendNegativeTransformPicker(targetResponder, member, page = 0, fromHub = false) {
    const u = getOrCreateTcgUser(member.id);
    const hubFlag = fromHub ? '1' : '0';
    const compatible = cardCatalog.filter(c =>
        c.rarity === 'Full Art' &&
        !c.isHolo &&
        c.negativeCounterpartId &&
        (u.cards?.[c.id] || 0) >= 1
    );

    if (compatible.length === 0) {
        const msg = "❌ Tu ne possèdes actuellement aucune carte **Full Art** pouvant être transformée en version Négative.";
        return targetResponder.isRepliable?.()
            ? targetResponder.reply({ content: msg, ephemeral: true })
            : replySilent(targetResponder, msg);
    }

    const perPage = 25;
    const totalPages = Math.max(1, Math.ceil(compatible.length / perPage));
    const safePage = Math.max(0, Math.min(page, totalPages - 1));
    const slice = compatible.slice(safePage * perPage, (safePage + 1) * perPage);

    const menu = new StringSelectMenuBuilder()
        .setCustomId(`tcg:negpick:${member.id}:${hubFlag}`)
        .setPlaceholder(`Choisis la Full Art à transformer (Page ${safePage + 1}/${totalPages})...`)
        .addOptions(slice.map(c => ({
            label: `${c.id} • ${c.name}`.slice(0, 100),
            description: `Full Art • Possédée x${u.cards[c.id]} • ➔ Négative`.slice(0, 100),
            value: c.id
        })));

    const btnRow = new ActionRowBuilder();
    if (totalPages > 1) {
        btnRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`tcg:negpage:${member.id}:${safePage - 1}:${hubFlag}`)
                .setLabel('Précédent')
                .setEmoji('◀️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(safePage <= 0),
            new ButtonBuilder()
                .setCustomId(`tcg:negpage:${member.id}:${safePage + 1}:${hubFlag}`)
                .setLabel('Suivant')
                .setEmoji('▶️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(safePage >= totalPages - 1)
        );
    }
    btnRow.addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:claim:open:${member.id}:1`)
            .setLabel('Inventaire')
            .setEmoji('🎒')
            .setStyle(ButtonStyle.Secondary),
        buildAccueilButton(member.id),
        buildCloseButton(member.id)
    );
    const rows = [new ActionRowBuilder().addComponents(menu), btnRow];

    const payload = {
        content: '🕳️ **Transformation Négative :** Choisis la Full Art à convertir *(consomme 1 copie → +1 version Négative)* :',
        embeds: [],
        components: rows,
        files: [],
        attachments: []
    };
    if (targetResponder.isButton?.()) return targetResponder.update(payload);
    return replySilent(targetResponder, payload);
}

function buildTradeConfirmPayload(confirmId, conf) {
    const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle('🔄 Proposition d\'échange RegaDex')
        .setDescription(
            `<@${conf.initiatorId}> souhaite ouvrir un échange de cartes avec <@${conf.targetId}> !\n\n` +
            `⚙️ **Paramètres du thread :**\n` +
            `• **Accessible au public :** ${conf.isPublic ? '✅ Oui' : '❌ Non *(silencieux)*'}\n` +
            (conf.isPublic
                ? `• **Tout le monde peut y parler :** ${conf.canEveryoneTalk ? '✅ Oui' : '❌ Non *(seuls les échangeurs parlent)*'}`
                : `• **Tout le monde peut y parler :** ❌ Non`) +
            `\n\n<@${conf.targetId}>, confirme ta présence pour lancer l'échange !`
        );

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:tconf:accept:${confirmId}`)
            .setLabel('Accepter l\'échange')
            .setEmoji('✅')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`tcg:tconf:decline:${confirmId}`)
            .setLabel('Refuser')
            .setEmoji('❌')
            .setStyle(ButtonStyle.Danger)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:tconf:pub:${confirmId}`)
            .setLabel(`Public : ${conf.isPublic ? 'Oui' : 'Non'}`)
            .setEmoji('👁️')
            .setStyle(ButtonStyle.Secondary)
    );

    if (conf.isPublic) {
        row2.addComponents(
            new ButtonBuilder()
                .setCustomId(`tcg:tconf:talk:${confirmId}`)
                .setLabel(`Tout le monde parle : ${conf.canEveryoneTalk ? 'Oui' : 'Non'}`)
                .setEmoji('💬')
                .setStyle(ButtonStyle.Secondary)
        );
    }

    return {
        content: `<@${conf.targetId}>`,
        embeds: [embed],
        components: [row1, row2]
    };
}

async function initiateTradePrompt(targetResponder, initiatorMember, targetMember) {
    if (!targetMember) {
        const embed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle('🔄 Lancer un échange RegaDex')
            .setDescription('Choisis le membre avec qui tu souhaites échanger des cartes dans le menu ci-dessous :');
        const row = new ActionRowBuilder().addComponents(
            new UserSelectMenuBuilder()
                .setCustomId(`tcg:tradepick:${initiatorMember.id}`)
                .setPlaceholder('Sélectionner un.e Collectionneur.euse...')
        );
        return replySilent(targetResponder, { embeds: [embed], components: [row] });
    }

    if (targetMember.user?.bot || targetMember.bot) {
        return targetResponder.reply({ content: "❌ Tu ne peux pas échanger avec un bot !", ephemeral: true });
    }
    if (targetMember.id === initiatorMember.id) {
        return targetResponder.reply({ content: "❌ Tu ne peux pas échanger avec toi-même !", ephemeral: true });
    }
    if (!hasTcgRole(targetMember)) {
        return targetResponder.reply({ content: `❌ <@${targetMember.id}> n'a pas le rôle <@&${TCG_ROLE_ID}>.`, ephemeral: true });
    }

    const confirmId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const conf = {
        id: confirmId,
        initiatorId: initiatorMember.id,
        targetId: targetMember.id,
        isPublic: true,
        canEveryoneTalk: false,
        createdAt: Date.now()
    };
    pendingConfirms.set(confirmId, conf);
    setTimeout(() => pendingConfirms.delete(confirmId), 15 * 60 * 1000);

    const payload = buildTradeConfirmPayload(confirmId, conf);
    return replySilent(targetResponder, payload);
}

function formatOfferLines(offerIds, ownerUserId = null) {
    if (!offerIds || offerIds.length === 0) return '*Aucune carte sélectionnée*';
    const counts = {};
    for (const id of offerIds) counts[id] = (counts[id] || 0) + 1;
    const ownerU = ownerUserId ? getOrCreateTcgUser(ownerUserId) : null;
    return Object.entries(counts).map(([id, q]) => {
        const c = cardById.get(id);
        const meta = c ? (RARITY_META[c.rarity] || RARITY_META['Commune']) : { emoji: '🃏' };
        const isLast = ownerU ? ((ownerU.cards?.[id] || 0) - q <= 0) : false;
        return `${meta.emoji} \`${id}\` **${c ? c.name : id}**${q > 1 ? ` ×${q}` : ''}${isLast ? ' *(⚠️ dernière copie)*' : ''}`;
    }).join('\n');
}

function buildTradeThreadPayload(trade) {
    const lockA = trade.lockedOffers[trade.initiatorId] ? '✅ Validée' : '⏳ En modification';
    const lockB = trade.lockedOffers[trade.targetId] ? '✅ Validée' : '⏳ En modification';
    const compA = getUserCompletionStats(getOrCreateTcgUser(trade.initiatorId));
    const compB = getUserCompletionStats(getOrCreateTcgUser(trade.targetId));
    const missingA = Math.max(0, compA.totalSet - compA.uniqueCount);
    const missingB = Math.max(0, compB.totalSet - compB.uniqueCount);

    const sep = '────────────────────────────────────────';
    const embed = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle('🔄 Table d\'échange RegaDex')
        .setDescription(
            `### 📜 Règles de l'échange\n` +
            `• **Cartes :** jusqu'à **3 cartes** par personne *(dons & dernières copies autorisés)*\n` +
            `• **Liberté totale :** tous les types d'échanges sont possibles *(double confirmation si inéquitable)*\n` +
            `• **Bonus :** **+${POINTS_PER_TRADE} pts RegaDex** offerts à la fermeture *(1× par fil)*\n` +
            `-# ⚠️ Toute modification déverrouille automatiquement la validation des deux joueurs.\n` +
            `${sep}\n` +
            `### 📊 Repère — ${SET1_NAME}\n` +
            `• Il manque **${missingA}/${compA.totalSet}** cartes à <@${trade.initiatorId}>\n` +
            `• Il manque **${missingB}/${compB.totalSet}** cartes à <@${trade.targetId}>\n` +
            `${sep}\n` +
            `### 🟦 Offre de <@${trade.initiatorId}> *(${lockA} • ${trade.offers[trade.initiatorId].length}/3)*\n` +
            `${formatOfferLines(trade.offers[trade.initiatorId], trade.initiatorId)}\n\n` +
            `### 🟪 Offre de <@${trade.targetId}> *(${lockB} • ${trade.offers[trade.targetId].length}/3)*\n` +
            `${formatOfferLines(trade.offers[trade.targetId], trade.targetId)}`
        )
        .setFooter({ text: `Échange #${(trade.tradeCount || 0) + 1} • Fermeture auto après 24h d'inactivité` });

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:tr:add:${trade.id}`)
            .setLabel('Ajouter une carte')
            .setEmoji('➕')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`tcg:tr:rem:${trade.id}`)
            .setLabel('Retirer une carte')
            .setEmoji('➖')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`tcg:tr:lock:${trade.id}`)
            .setLabel('Valider / Déverrouiller')
            .setEmoji('✅')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`tcg:tr:cancel:${trade.id}`)
            .setLabel('Annuler l\'échange')
            .setEmoji('❌')
            .setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [row1] };
}

function buildPostTradeDecisionPayload(trade) {
    const vA = trade.postTradeVotes?.[trade.initiatorId];
    const vB = trade.postTradeVotes?.[trade.targetId];
    const labelVote = (v) => v === 'again' ? '🔄 Nouvel échange' : (v === 'close' ? '🔒 Fermer' : '⏳ En attente');

    const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('🤝 Échange terminé ! Que souhaitez-vous faire ?')
        .setDescription(
            `Pour continuer ou clôturer le thread, les **deux** participant.es doivent faire le même choix :\n\n` +
            `• <@${trade.initiatorId}> : ${labelVote(vA)}\n` +
            `• <@${trade.targetId}> : ${labelVote(vB)}\n\n` +
            (trade.tradeCount >= 1
                ? `-# 🔒 Si vous fermez maintenant, le thread sera **archivé et verrouillé** (historique conservé).`
                : `-# 🗑️ Aucun échange effectué : si vous fermez, le thread sera **supprimé**.`)
        );

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:trpost:again:${trade.id}`)
            .setLabel('Faire un autre échange')
            .setEmoji('🔄')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`tcg:trpost:close:${trade.id}`)
            .setLabel('Fermer le thread')
            .setEmoji('🔒')
            .setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [row] };
}

function getTradableDuplicates(userId, currentOfferIds) {
    const u = getOrCreateTcgUser(userId);
    const offeredCount = {};
    for (const id of currentOfferIds) offeredCount[id] = (offeredCount[id] || 0) + 1;

    return cardCatalog.filter(c => {
        const owned = u.cards?.[c.id] || 0;
        const already = offeredCount[c.id] || 0;
        return (owned - already) >= 1;
    });
}

async function refreshTradePanel(thread, trade) {
    if (!trade.statusMessageId) return;
    const msg = await thread.messages.fetch(trade.statusMessageId).catch(() => null);
    if (!msg) return;
    await msg.edit(buildTradeThreadPayload(trade)).catch(() => {});
}

function buildTradeAddCardEphemeralPayload(trade, uid, page = 0, missingOnly = false) {
    const allTradables = getTradableDuplicates(uid, trade.offers[uid]);
    const partnerId = uid === trade.initiatorId ? trade.targetId : trade.initiatorId;
    const uPartner = getOrCreateTcgUser(partnerId);
    const u = getOrCreateTcgUser(uid);
    const offeredCount = {};
    for (const id of trade.offers[uid]) offeredCount[id] = (offeredCount[id] || 0) + 1;

    const partnerWishlist = getSanitizedWishlist(uPartner);
    const partnerWishSet = new Set(partnerWishlist);

    const baseFiltered = missingOnly
        ? allTradables.filter(c => (uPartner.cards?.[c.id] || 0) <= 0)
        : [...allTradables];

    // Mettre en tête les cartes présentes dans la Wishlist du partenaire
    const filtered = baseFiltered.sort((a, b) => {
        const wa = partnerWishSet.has(a.id) ? 1 : 0;
        const wb = partnerWishSet.has(b.id) ? 1 : 0;
        if (wb !== wa) return wb - wa;
        return a.sortIndex - b.sortIndex;
    });

    const missFlag = missingOnly ? '1' : '0';
    const toggleBtn = new ButtonBuilder()
        .setCustomId(`tcg:tr:addmiss:${trade.id}:${missingOnly ? '0' : '1'}`)
        .setLabel(missingOnly ? 'Ce qui lui manque : ON' : 'Ce qui lui manque uniquement')
        .setEmoji('🎯')
        .setStyle(missingOnly ? ButtonStyle.Success : ButtonStyle.Secondary);

    if (filtered.length === 0) {
        return {
            content: missingOnly
                ? '🎯 Aucune de tes cartes disponibles ne manque actuellement à ton partenaire.'
                : "❌ Tu n'as aucune carte disponible à proposer dans ton inventaire.",
            components: missingOnly ? [new ActionRowBuilder().addComponents(toggleBtn)] : []
        };
    }

    const totalPages = Math.max(1, Math.ceil(filtered.length / 25));
    const safePage = Math.max(0, Math.min(page, totalPages - 1));
    const slice = filtered.slice(safePage * 25, (safePage + 1) * 25);

    const menu = new StringSelectMenuBuilder()
        .setCustomId(`tcg:tr:addsel:${trade.id}`)
        .setPlaceholder(`Choisir une carte à ajouter (Page ${safePage + 1}/${totalPages})...`)
        .addOptions(slice.map(c => {
            const inWish = partnerWishSet.has(c.id);
            const missingForPartner = (uPartner.cards?.[c.id] || 0) <= 0;
            const remainingBeforeAdd = (u.cards[c.id] || 0) - (offeredCount[c.id] || 0);
            const lastCopyTag = remainingBeforeAdd === 1 ? ' • ⚠️ Dernière copie' : '';
            return {
                label: `${inWish ? '❤️ ' : ''}${c.id} • ${c.name}`.slice(0, 100),
                description: `${c.rarity} • x${u.cards[c.id]}${inWish ? ' • ❤️ Wishlist' : ''}${missingForPartner ? ' • 🆕 Lui manque' : ''}${lastCopyTag}`.slice(0, 100),
                value: c.id
            };
        }));

    const btnRow = new ActionRowBuilder();
    if (totalPages > 1) {
        btnRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`tcg:tr:addpage:${trade.id}:${safePage - 1}:${missFlag}`)
                .setEmoji('◀️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(safePage <= 0),
            new ButtonBuilder()
                .setCustomId(`tcg:tr:addpage:${trade.id}:${safePage + 1}:${missFlag}`)
                .setEmoji('▶️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(safePage >= totalPages - 1)
        );
    }
    btnRow.addComponents(toggleBtn);

    return {
        content: missingOnly
            ? '🎯 Choisis une carte **qui manque à ton partenaire** :'
            : '➕ Choisis une carte à ajouter à ton offre :',
        components: [new ActionRowBuilder().addComponents(menu), btnRow]
    };
}

function buildTradeUnfairConfirmPayload(trade) {
    const idA = trade.initiatorId;
    const idB = trade.targetId;
    const offerA = trade.offers[idA] || [];
    const offerB = trade.offers[idB] || [];
    const uA = getOrCreateTcgUser(idA);
    const uB = getOrCreateTcgUser(idB);
    const countMap = (arr) => {
        const m = {};
        for (const id of arr) m[id] = (m[id] || 0) + 1;
        return m;
    };
    const needA = countMap(offerA);
    const needB = countMap(offerB);
    const hasLastA = Object.entries(needA).some(([cid, q]) => ((uA.cards?.[cid] || 0) - q) <= 0);
    const hasLastB = Object.entries(needB).some(([cid, q]) => ((uB.cards?.[cid] || 0) - q) <= 0);

    const fmtRarities = (arr) => arr.length === 0
        ? '*Aucune carte (don)*'
        : arr.map(id => {
            const c = cardById.get(id);
            const r = c?.rarity || 'Commune';
            const m = RARITY_META[r] || RARITY_META['Commune'];
            return `${m.emoji} ${r}`;
        }).join(', ');
    const vA = Boolean(trade.unfairConfirm?.votes?.[idA]);
    const vB = Boolean(trade.unfairConfirm?.votes?.[idB]);

    const extraWarns = [];
    if (offerA.length === 0 || offerB.length === 0) {
        extraWarns.push('🎁 **Don à sens unique** *(aucune carte en retour)*');
    }
    if (hasLastA || hasLastB) {
        const who = [hasLastA ? `<@${idA}>` : null, hasLastB ? `<@${idB}>` : null].filter(Boolean).join(' & ');
        extraWarns.push(`⚠️ **Dernière copie sans doublon** engagée par ${who}`);
    }

    const embed = new EmbedBuilder()
        .setColor(0xf39c12)
        .setTitle('⚠️ Échange inéquitable — Confirmation requise')
        .setDescription(
            `Cet échange ne contient pas le même nombre ou les mêmes raretés de cartes des deux côtés :\n\n` +
            `• **<@${idA}>** (${offerA.length}) : ${fmtRarities(offerA)}\n` +
            `• **<@${idB}>** (${offerB.length}) : ${fmtRarities(offerB)}\n` +
            (extraWarns.length > 0 ? `\n${extraWarns.join('\n')}\n` : '') +
            `\nConfirmez-vous quand même cet échange ? Les **deux** participant.es doivent valider :\n` +
            `• <@${idA}> : ${vA ? '✅ Confirmé' : '⏳ En attente'}\n` +
            `• <@${idB}> : ${vB ? '✅ Confirmé' : '⏳ En attente'}`
        );

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:tr:uok:${trade.id}`)
            .setLabel("Confirmer l'échange")
            .setEmoji('✅')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`tcg:tr:ucancel:${trade.id}`)
            .setLabel('Annuler')
            .setEmoji('❌')
            .setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [row] };
}

async function executeTradeIfBothLocked(thread, trade, client) {
    const idA = trade.initiatorId;
    const idB = trade.targetId;
    if (!trade.lockedOffers[idA] || !trade.lockedOffers[idB]) return false;

    const freeMode = isTradeFreeModeActive();
    const offerA = trade.offers[idA] || [];
    const offerB = trade.offers[idB] || [];
    if (offerA.length === 0 && offerB.length === 0) {
        trade.lockedOffers[idA] = false;
        trade.lockedOffers[idB] = false;
        trade.unfairConfirm = null;
        tcgBridge.demanderSauvegarde();
        await refreshTradePanel(thread, trade);
        await sendSilent(thread, "❌ **Échange bloqué :** au moins un·e participant.e doit proposer **1 carte**.").catch(() => {});
        return false;
    }

    if ([...offerA, ...offerB].some(id => persoById.has(id))) {
        trade.lockedOffers[idA] = false;
        trade.lockedOffers[idB] = false;
        trade.unfairConfirm = null;
        tcgBridge.demanderSauvegarde();
        await refreshTradePanel(thread, trade);
        await sendSilent(thread, "❌ **Échange bloqué :** les cartes personnalisées (`Spé-X`) sont **uniques et non échangeables**.").catch(() => {});
        return false;
    }

    const uA = getOrCreateTcgUser(idA);
    const uB = getOrCreateTcgUser(idB);

    const countIds = (arr) => {
        const map = {};
        for (const id of arr) map[id] = (map[id] || 0) + 1;
        return map;
    };
    const needA = countIds(offerA);
    const needB = countIds(offerB);

    for (const [cid, q] of Object.entries(needA)) {
        if ((uA.cards[cid] || 0) - q < 0) {
            trade.lockedOffers[idA] = false;
            trade.lockedOffers[idB] = false;
            trade.unfairConfirm = null;
            tcgBridge.demanderSauvegarde();
            await refreshTradePanel(thread, trade);
            await sendSilent(thread, `❌ <@${idA}> ne possède plus assez d'exemplaires pour \`${cid}\`. Validation annulée.`).catch(() => {});
            return false;
        }
    }
    for (const [cid, q] of Object.entries(needB)) {
        if ((uB.cards[cid] || 0) - q < 0) {
            trade.lockedOffers[idA] = false;
            trade.lockedOffers[idB] = false;
            trade.unfairConfirm = null;
            tcgBridge.demanderSauvegarde();
            await refreshTradePanel(thread, trade);
            await sendSilent(thread, `❌ <@${idB}> ne possède plus assez d'exemplaires pour \`${cid}\`. Validation annulée.`).catch(() => {});
            return false;
        }
    }

    const getSortedRarities = (arr) => arr
        .map(id => cardById.get(id)?.rarity || 'Commune')
        .sort((a, b) => (RARITY_ORDER[a] ?? 0) - (RARITY_ORDER[b] ?? 0));
    const raritiesA = getSortedRarities(offerA);
    const raritiesB = getSortedRarities(offerB);
    const isBalanced = offerA.length === offerB.length && raritiesA.join('|') === raritiesB.join('|');

    if (!freeMode && !isBalanced && !(trade.unfairConfirm?.votes?.[idA] && trade.unfairConfirm?.votes?.[idB])) {
        trade.unfairConfirm = { votes: { [idA]: false, [idB]: false } };
        tcgBridge.demanderSauvegarde();
        await sendSilent(thread, buildTradeUnfairConfirmPayload(trade)).catch(() => {});
        return false;
    }

    // Transfert atomique
    for (const [cid, q] of Object.entries(needA)) {
        uA.cards[cid] -= q;
        if (uA.cards[cid] <= 0) {
            delete uA.cards[cid];
            if (uA.favoriteCardId === cid) uA.favoriteCardId = null;
        }
        uB.cards[cid] = (uB.cards[cid] || 0) + q;
    }
    for (const [cid, q] of Object.entries(needB)) {
        uB.cards[cid] -= q;
        if (uB.cards[cid] <= 0) {
            delete uB.cards[cid];
            if (uB.favoriteCardId === cid) uB.favoriteCardId = null;
        }
        uA.cards[cid] = (uA.cards[cid] || 0) + q;
    }

    trade.unfairConfirm = null;
    uA.stats.tradesCompleted = (uA.stats.tradesCompleted || 0) + 1;
    uB.stats.tradesCompleted = (uB.stats.tradesCompleted || 0) + 1;
    trade.tradeCount = (trade.tradeCount || 0) + 1;
    if (!trade.pointsRewarded) {
        trade.pointsRewarded = true;
        uA.points = (uA.points || 0) + POINTS_PER_TRADE;
        uB.points = (uB.points || 0) + POINTS_PER_TRADE;
    }
    trade.lastActivityAt = Date.now();

    const tradeMilestones = [];
    const masteredAfterTrade = [];
    for (const setCfg of getActiveSets()) {
        const msA = checkAndGrantCompletionMilestones(idA, setCfg.number);
        if (msA.unlocked.length > 0) {
            tradeMilestones.push(`<@${idA}> : ${msA.unlocked.map(m => `**${m.pct}%** (+${m.reward} pts${m.pct === 100 ? ' & +2 Boosters de Maître' : ''})`).join(', ')}`);
        }
        for (const sNum of (msA.masteredSets || [])) masteredAfterTrade.push({ uid: idA, setNumber: sNum });

        const msB = checkAndGrantCompletionMilestones(idB, setCfg.number);
        if (msB.unlocked.length > 0) {
            tradeMilestones.push(`<@${idB}> : ${msB.unlocked.map(m => `**${m.pct}%** (+${m.reward} pts${m.pct === 100 ? ' & +2 Boosters de Maître' : ''})`).join(', ')}`);
        }
        for (const sNum of (msB.masteredSets || [])) masteredAfterTrade.push({ uid: idB, setNumber: sNum });
    }

    await progressCommunityQuest(client, [{ type: 'trades', amount: 1 }]).catch(() => {});

    tcgBridge.trackBattlePassProgress(idA, 'tcg_trade', 1);
    tcgBridge.trackBattlePassProgress(idB, 'tcg_trade', 1);
    tcgBridge.demanderSauvegarde();

    const guild = thread.guild;
    const mA = await guild.members.fetch(idA).catch(() => null);
    const mB = await guild.members.fetch(idB).catch(() => null);
    const nameA = mA?.displayName || mA?.user?.username || idA;
    const nameB = mB?.displayName || mB?.user?.username || idB;

    for (const entry of masteredAfterTrade) {
        const masterMember = entry.uid === idA ? mA : mB;
        if (masterMember) {
            await envoyerMaitreDuSetPantheonTcg(client, masterMember, entry.setNumber).catch(() => {});
        }
    }

    const recapBuffer = await renderTradeRecapCanvas(nameA, offerA, nameB, offerB);
    const dateStr = new Date().toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' }) + ' à ' +
        new Date().toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris' });

    const recapEmbed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle(`✅ Échange #${trade.tradeCount} validé !`)
        .setDescription(
            `**${nameA}** (<@${idA}>) a donné :\n${formatOfferLines(offerA)}\n\n` +
            `**${nameB}** (<@${idB}>) a donné :\n${formatOfferLines(offerB)}` +
            (tradeMilestones.length > 0 ? `\n\n🏆 **Palier(s) de complétion atteint(s) :**\n${tradeMilestones.map(l => `• ${l}`).join('\n')}` : '')
        )
        .setImage('attachment://trade_recap.jpg')
        .setFooter({ text: `Effectué le ${dateStr}` });

    await sendSilent(thread, {
        embeds: [recapEmbed],
        files: [new AttachmentBuilder(recapBuffer, { name: 'trade_recap.jpg' })]
    }).catch(() => {});

    // Log privé Epsys-only dans 1572168354435964928
    const logChan = await client.channels.fetch(TCG_TRADE_LOG_CHANNEL_ID).catch(() => null);
    if (logChan) {
        const logEmbed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle(`📜 Log d'échange RegaDex — Thread ${thread.name}`)
            .setDescription(
                `📅 **Date :** ${dateStr}\n` +
                `👥 **Échangeur·euses :** **${nameA}** (<@${idA}>) ⇄ **${nameB}** (<@${idB}>)\n` +
                `🧵 **Thread :** <#${thread.id}>\n\n` +
                `**${nameA} → ${nameB} :**\n${formatOfferLines(offerA)}\n\n` +
                `**${nameB} → ${nameA} :**\n${formatOfferLines(offerB)}`
            )
            .setImage('attachment://trade_recap_log.jpg')
            .setTimestamp();

        await sendSilent(logChan, {
            embeds: [logEmbed],
            files: [new AttachmentBuilder(recapBuffer, { name: 'trade_recap_log.jpg' })]
        }).catch(() => {});
    }

    // Réinitialiser les offres et afficher la proposition de suite / fermeture
    trade.offers = { [idA]: [], [idB]: [] };
    trade.lockedOffers = { [idA]: false, [idB]: false };
    trade.postTradeVotes = { [idA]: null, [idB]: null };

    if (trade.statusMessageId) {
        const oldPanel = await thread.messages.fetch(trade.statusMessageId).catch(() => null);
        if (oldPanel) await oldPanel.edit({ components: [] }).catch(() => {});
        trade.statusMessageId = null;
    }

    await sendSilent(thread, buildPostTradeDecisionPayload(trade)).catch(() => {});
    return true;
}

async function sendTradeRewardBeforeClose(thread, trade) {
    if (!thread || !trade || !trade.pointsRewarded || trade.rewardAnnounced) return;
    trade.rewardAnnounced = true;
    const uA = getOrCreateTcgUser(trade.initiatorId);
    const uB = getOrCreateTcgUser(trade.targetId);
    const embed = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle('🪙 Points RegaDex gagnés !')
        .setDescription(
            `Merci pour votre échange ! Vous avez chacun gagné **+${POINTS_PER_TRADE} points RegaDex** *(1 seul bonus par fil d'échange)* :\n\n` +
            `• <@${trade.initiatorId}> : **+${POINTS_PER_TRADE} pts** *(Nouveau solde : **${uA.points} pts**)*\n` +
            `• <@${trade.targetId}> : **+${POINTS_PER_TRADE} pts** *(Nouveau solde : **${uB.points} pts**)*`
        );
    await sendSilent(thread, { embeds: [embed] }).catch(() => {});
}

async function handleTcgTradeThreadMessage(message) {
    if (!message.channel?.isThread?.()) return false;
    const data = getStoreData();
    const trade = data.activeTrades?.[message.channel.id];
    if (!trade || trade.closed) return false;

    trade.lastActivityAt = Date.now();

    if (!trade.isPublic || !trade.canEveryoneTalk) {
        const uid = message.author.id;
        const isTrader = uid === trade.initiatorId || uid === trade.targetId;
        const isStaff = uid === EPSYS_ID || tcgBridge.estModo(message.member);
        if (!isTrader && !isStaff) {
            await message.delete().catch(() => {});
            return true;
        }
    }
    return false;
}

async function verifierInactiviteTradesTcg(client) {
    const data = getStoreData();
    if (!data.activeTrades) return;
    const now = Date.now();
    let changed = false;

    for (const [threadId, trade] of Object.entries(data.activeTrades)) {
        if (!trade || trade.closed) {
            delete data.activeTrades[threadId];
            changed = true;
            continue;
        }
        if (now - (trade.lastActivityAt || now) >= TRADE_INACTIVITY_MS) {
            const thread = await client.channels.fetch(threadId).catch(() => null);
            const hadTrades = (trade.tradeCount || 0) >= 1;
            if (thread) {
                if (hadTrades) {
                    await sendTradeRewardBeforeClose(thread, trade);
                    await thread.setLocked(true).catch(() => {});
                    await thread.setArchived(true).catch(() => {});
                } else {
                    await thread.delete().catch(() => {});
                }
            }
            delete data.activeTrades[threadId];
            changed = true;
        }
    }

    if (changed) tcgBridge.demanderSauvegarde();
}

// ==========================================
//   COMMANDES ADMIN (EPSYS-ONLY)
// ==========================================

function buildPullChancePayload(sessionId, session, guild) {
    const data = getStoreData();
    const boosts = data.pullBoosts || {};
    const perPage = 25;
    const totalPages = Math.max(1, Math.ceil(cardCatalog.length / perPage));
    const safePage = Math.max(0, Math.min(session.cardPage || 0, totalPages - 1));
    session.cardPage = safePage;

    const cardSlice = cardCatalog.slice(safePage * perPage, (safePage + 1) * perPage);
    const selectedCard = session.cardId ? cardById.get(session.cardId) : null;

    let targetLabel = '*Aucune cible sélectionnée*';
    if (session.targetKey === PULL_BOOST_ROLE_KEY) {
        targetLabel = `👥 Tous les <@&${TCG_ROLE_ID}>`;
    } else if (session.targetKey) {
        const m = guild?.members?.cache?.get(session.targetKey);
        targetLabel = `👤 <@${session.targetKey}>${m ? ` (${m.displayName})` : ''}`;
    }

    const cardLabel = selectedCard
        ? `${RARITY_META[selectedCard.rarity]?.emoji || '🃏'} \`${selectedCard.id}\` **${selectedCard.name}** (*${selectedCard.rarity}*${selectedCard.isHolo ? ' • Holo' : ''})`
        : '*Aucune carte sélectionnée*';
    const multLabel = session.mult === 1
        ? '×1 *(Retirer le boost)*'
        : (session.mult === PULL_BOOST_GUARANTEED
            ? '🎯 **Garantie 1× (par booster)**'
            : (session.mult === PULL_BOOST_TRIPLE
                ? '🤡 **Full Troll 3× (tout le booster, tout set)**'
                : `**×${session.mult}**`));

    const activeLines = [];
    for (const [tKey, cardMap] of Object.entries(boosts)) {
        if (!cardMap || typeof cardMap !== 'object') continue;
        const entries = Object.entries(cardMap).filter(([, m]) => m === PULL_BOOST_GUARANTEED || m === PULL_BOOST_TRIPLE || (typeof m === 'number' && m > 1));
        if (entries.length === 0) continue;
        const tStr = tKey === PULL_BOOST_ROLE_KEY ? `<@&${TCG_ROLE_ID}>` : `<@${tKey}>`;
        const cStr = entries.map(([cid, m]) => {
            const c = cardById.get(cid);
            const boostTxt = m === PULL_BOOST_TRIPLE
                ? '🤡 **Full Troll 3×**'
                : (m === PULL_BOOST_GUARANTEED ? '🎯 **Garantie 1×**' : `**×${m}**`);
            return `\`${cid}\` ${c ? c.name : ''} (${boostTxt})`;
        }).join(', ');
        activeLines.push(`• ${tStr} : ${cStr}`);
    }

    const embed = new EmbedBuilder()
        .setColor(0xe67e22)
        .setTitle('🎯 Panneau !tcgpullchance (Epsys-Only)')
        .setDescription(
            `Modifie les probabilités de tirage d'une carte précise pour un·e membre ou tout le rôle <@&${TCG_ROLE_ID}>.\n\n` +
            `• **Cible :** ${targetLabel}\n` +
            `• **Carte :** ${cardLabel}\n` +
            `• **Multiplicateur :** ${multLabel}\n` +
            `────────────────────────────────────────\n` +
            `### 📌 Boosts actifs actuellement\n` +
            (activeLines.length > 0 ? activeLines.join('\n').slice(0, 1800) : '*Aucun boost actif (taux normaux à 100%).*')
        )
        .setFooter({ text: `${SET1_NAME} • Page cartes ${safePage + 1}/${totalPages}` });

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:pc:role:${sessionId}`)
            .setLabel('Rôle Collectionneur.euse')
            .setEmoji('👥')
            .setStyle(session.targetKey === PULL_BOOST_ROLE_KEY ? ButtonStyle.Success : ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`tcg:pc:cpage:${sessionId}:${safePage - 1}`)
            .setEmoji('◀️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(safePage <= 0),
        new ButtonBuilder()
            .setCustomId(`tcg:pc:cpage:${sessionId}:${safePage + 1}`)
            .setEmoji('▶️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(safePage >= totalPages - 1),
        new ButtonBuilder()
            .setCustomId(`tcg:pc:clear:${sessionId}`)
            .setLabel('Reset cible')
            .setEmoji('🧹')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!session.targetKey),
        buildCloseButton(EPSYS_ID)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new UserSelectMenuBuilder()
            .setCustomId(`tcg:pc:user:${sessionId}`)
            .setPlaceholder('Ou choisir un·e membre spécifique...')
    );

    const row3 = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`tcg:pc:card:${sessionId}`)
            .setPlaceholder(`Choisir une carte (Page ${safePage + 1}/${totalPages})...`)
            .addOptions(cardSlice.length > 0
                ? cardSlice.map(c => ({
                    label: `${c.id} • ${c.name}`.slice(0, 100),
                    description: `${c.category} • ${c.rarity}${c.isHolo ? ' • Holo' : ''}`.slice(0, 100),
                    value: c.id,
                    default: session.cardId === c.id
                }))
                : [{ label: 'Aucune carte chargée', value: 'none' }])
    );

    const row4 = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`tcg:pc:mult:${sessionId}`)
            .setPlaceholder('Choisir le multiplicateur de chance...')
            .addOptions(PULL_MULTIPLIERS.map(m => {
                if (m === PULL_BOOST_GUARANTEED) {
                    return {
                        label: '🎯 Garantie 1× à tous les coups',
                        description: 'La carte tombera 1 fois dans chaque booster de son set',
                        value: PULL_BOOST_GUARANTEED,
                        default: session.mult === PULL_BOOST_GUARANTEED
                    };
                }
                if (m === PULL_BOOST_TRIPLE) {
                    return {
                        label: '🤡 Full Troll 3× (Tout le booster)',
                        description: 'Les 3 cartes du booster seront cette carte (peu importe le set)',
                        value: PULL_BOOST_TRIPLE,
                        default: session.mult === PULL_BOOST_TRIPLE
                    };
                }
                return {
                    label: m === 1 ? '×1 — Retirer le boost (Taux normal)' : `×${m} — Chance de pull multipliée par ${m}`,
                    value: String(m),
                    default: session.mult === m
                };
            }))
    );

    const hasAnyBoost = activeLines.length > 0;
    const row5 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:pc:apply:${sessionId}`)
            .setLabel(
                session.mult === 1
                    ? 'Retirer le boost'
                    : (session.mult === PULL_BOOST_GUARANTEED
                        ? 'Appliquer : Garantie 1×'
                        : (session.mult === PULL_BOOST_TRIPLE ? 'Appliquer : Full Troll 3×' : `Appliquer ×${session.mult}`))
            )
            .setEmoji('✅')
            .setStyle(ButtonStyle.Success)
            .setDisabled(!session.targetKey || !session.cardId),
        new ButtonBuilder()
            .setCustomId(`tcg:pc:clearall:${sessionId}`)
            .setLabel('Tout supprimer')
            .setEmoji('🗑️')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(!hasAnyBoost)
    );

    return { embeds: [embed], components: [row1, row2, row3, row4, row5] };
}

function formatPunitionFactor(factor) {
    if (factor === 0) return '🚫 0% (Bloqué)';
    if (factor === 0.1) return '÷10';
    if (factor === 0.2) return '÷5';
    if (factor === 0.5) return '÷2';
    return 'Normal';
}

function buildPunitionPayload(sessionId, session, guild) {
    const data = getStoreData();
    const allPunishments = data.pullPunishments || {};
    const targetId = session.targetUserId || null;
    const userPunish = targetId ? (allPunishments[targetId] || {}) : {};

    let targetLabel = '*Aucun·e membre sélectionné·e*';
    if (targetId) {
        const m = guild?.members?.cache?.get(targetId);
        targetLabel = `👤 <@${targetId}>${m ? ` (${m.displayName})` : ''}`;
    }

    const restrictionLines = PUNITION_RARITIES.map(r => {
        const f = typeof userPunish[r.rarity] === 'number' ? userPunish[r.rarity] : 1;
        return `${r.emoji} **${r.rarity} :** ${formatPunitionFactor(f)}`;
    }).join('  •  ');

    let ratesLine = '';
    if (targetId && cardCatalog.length > 0) {
        const m = guild?.members?.cache?.get(targetId) || null;
        const summary = getRarityPullSummary(targetId, m);
        const rateParts = RARITY_LIST.map(r => {
            const meta = RARITY_META[r] || RARITY_META['Commune'];
            return `${meta.emoji} ${r} **${formatPullPercent(summary[r])}%**`;
        });
        ratesLine = `\n🎲 **Taux réels actuels :**\n${rateParts.join(' • ')}\n`;
    }

    const activeLines = [];
    for (const [uid, map] of Object.entries(allPunishments)) {
        if (!map || typeof map !== 'object') continue;
        const entries = PUNITION_RARITIES
            .filter(r => typeof map[r.rarity] === 'number' && map[r.rarity] >= 0 && map[r.rarity] < 1)
            .map(r => `${r.emoji} ${r.rarity} (**${formatPunitionFactor(map[r.rarity])}**)` );
        if (entries.length === 0) continue;
        activeLines.push(`• <@${uid}> : ${entries.join(', ')}`);
    }

    const hasTargetPunish = Boolean(targetId && PUNITION_RARITIES.some(r => typeof userPunish[r.rarity] === 'number' && userPunish[r.rarity] < 1));

    const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('⚖️ Panneau !tcgpunition (Epsys-Only)')
        .setDescription(
            `Réduit ou bloque les chances de tirer des cartes **Épiques**, **Légendaires**, **Full Art** et **Négatives** pour un·e membre.\n` +
            `-# Clique sur un bouton de rareté pour alterner : \`Normal → ÷2 → ÷5 → ÷10 → 0% (Bloqué)\`\n\n` +
            `• **Cible :** ${targetLabel}\n` +
            `• **Restrictions :** ${restrictionLines}` +
            ratesLine +
            `\n────────────────────────────────────────\n` +
            `### 📌 Punitions actives actuellement\n` +
            (activeLines.length > 0 ? activeLines.join('\n').slice(0, 1600) : '*Aucune punition active sur le serveur.*')
        )
        .setFooter({ text: `${SET1_NAME} • Commande secrète Epsys-Only` });

    const row1 = new ActionRowBuilder().addComponents(
        new UserSelectMenuBuilder()
            .setCustomId(`tcg:pun:user:${sessionId}`)
            .setPlaceholder('Choisir ou changer le/la membre ciblé·e...')
    );

    const row2 = new ActionRowBuilder().addComponents(
        ...PUNITION_RARITIES.map(r => {
            const f = targetId && typeof userPunish[r.rarity] === 'number' ? userPunish[r.rarity] : 1;
            const style = f === 0 ? ButtonStyle.Danger : (f < 1 ? ButtonStyle.Primary : ButtonStyle.Secondary);
            return new ButtonBuilder()
                .setCustomId(`tcg:pun:rar:${sessionId}:${r.code}`)
                .setLabel(`${r.rarity} : ${f === 0 ? '0% (Bloqué)' : formatPunitionFactor(f)}`)
                .setEmoji(r.emoji)
                .setStyle(style)
                .setDisabled(!targetId);
        })
    );

    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:pun:all5:${sessionId}`)
            .setLabel('Tout ÷5')
            .setEmoji('📉')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!targetId),
        new ButtonBuilder()
            .setCustomId(`tcg:pun:all0:${sessionId}`)
            .setLabel('Tout bloquer (0%)')
            .setEmoji('🚫')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(!targetId),
        new ButtonBuilder()
            .setCustomId(`tcg:pun:clear:${sessionId}`)
            .setLabel('Lever punition')
            .setEmoji('✅')
            .setStyle(ButtonStyle.Success)
            .setDisabled(!hasTargetPunish),
        new ButtonBuilder()
            .setCustomId(`tcg:pun:clearall:${sessionId}`)
            .setLabel('Tout reset')
            .setEmoji('🗑️')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(activeLines.length === 0),
        buildCloseButton(EPSYS_ID)
    );

    return { embeds: [embed], components: [row1, row2, row3] };
}

function walkProxyStats(dir) {
    let files = 0;
    let bytes = 0;
    const byDim = {};
    const scan = (curr) => {
        if (!fs.existsSync(curr)) return;
        for (const entry of fs.readdirSync(curr, { withFileTypes: true })) {
            if (entry.name.startsWith('.')) continue;
            const full = path.join(curr, entry.name);
            if (entry.isDirectory()) {
                scan(full);
            } else if (entry.name.toLowerCase().endsWith('.png')) {
                files++;
                let sz = 0;
                try { sz = fs.statSync(full).size; } catch {}
                bytes += sz;
                const parentName = path.basename(curr);
                const dimKey = /^\d+x\d+$/.test(parentName) ? parentName : 'autre';
                if (!byDim[dimKey]) byDim[dimKey] = { files: 0, bytes: 0 };
                byDim[dimKey].files++;
                byDim[dimKey].bytes += sz;
            }
        }
    };
    scan(dir);
    return { files, bytes, byDim };
}

function collectProxyJobs(targetScope = 'all') {
    const scope = String(targetScope || 'all').toLowerCase();
    const activeSets = getActiveSets();
    const targetSets = scope === 'all'
        ? activeSets
        : (scope.startsWith('set:')
            ? activeSets.filter(s => s.number === parseInt(scope.slice(4), 10))
            : []);
    const includePerso = scope === 'all' || scope === 'perso';

    const jobs = [];
    const seenJobKeys = new Set();
    const mysterySizes = new Map();
    const logoTargets = [];

    for (const setCfg of targetSets) {
        const setCards = getSetCatalog(setCfg.number);
        if (setCards.length === 0) continue;

        if (setAssets[setCfg.number]?.logo) {
            logoTargets.push({
                path: setAssets[setCfg.number].logo,
                cacheKey: `Set${setCfg.number}_Logo_header.png`
            });
        }

        const sizeMap = new Map();
        const catCounts = {
            complet: setCards.length,
            ...Object.fromEntries(CATEGORIES.map(cat => [cat, setCards.filter(c => c.category === cat).length]))
        };
        for (const count of Object.values(catCounts)) {
            for (const mode of ['4', '18', '36', 'all']) {
                const grid = getBinderGridConfig(mode, count);
                const dims = computeBinderCardDims(1600, 900, grid);
                const key = `${dims.cardW}x${dims.cardH}`;
                if (!sizeMap.has(key)) {
                    sizeMap.set(key, { w: dims.cardW, h: dims.cardH, glow: true, mystery: true });
                }
            }
        }
        if (!sizeMap.has('285x399')) {
            sizeMap.set('285x399', { w: 285, h: 399, glow: true, mystery: false });
        }

        for (const [k, s] of sizeMap.entries()) {
            if (s.mystery && !mysterySizes.has(k)) {
                mysterySizes.set(k, { w: s.w, h: s.h });
            }
            for (const card of setCards) {
                const jobKey = `${card.id}|${k}`;
                if (!seenJobKeys.has(jobKey)) {
                    seenJobKeys.add(jobKey);
                    jobs.push({ card, w: s.w, h: s.h, glow: s.glow });
                }
            }
        }
    }

    if (includePerso && persoCatalog.length > 0) {
        const persoSizeMap = new Map();
        for (const mode of ['4', '18', '36', 'all']) {
            const grid = getBinderGridConfig(mode, persoCatalog.length);
            const dims = computeBinderCardDims(1600, 900, grid);
            const key = `${dims.cardW}x${dims.cardH}`;
            if (!persoSizeMap.has(key)) {
                persoSizeMap.set(key, { w: dims.cardW, h: dims.cardH, glow: true });
            }
        }
        for (const [k, s] of persoSizeMap.entries()) {
            for (const card of persoCatalog) {
                const jobKey = `${card.id}|${k}`;
                if (!seenJobKeys.has(jobKey)) {
                    seenJobKeys.add(jobKey);
                    jobs.push({ card, w: s.w, h: s.h, glow: s.glow });
                }
            }
        }
    }

    return {
        jobs,
        mysterySizes: [...mysterySizes.values()],
        logoTargets
    };
}

async function runProxyWarmup(targetScope, scopeLabel, onProgressEdit) {
    proxyWarmupRunning = true;
    try {
        const { jobs, mysterySizes, logoTargets } = collectProxyJobs(targetScope);
        const totalItems = jobs.length + (assetPaths.mysteryCard ? mysterySizes.length : 0);
        const startedAt = Date.now();
        let done = 0;
        let generated = 0;
        let alreadyOnDisk = 0;
        let failed = 0;
        let lastEditAt = Date.now();

        for (const lg of logoTargets) {
            await loadAssetProxy(lg.path, 184, 76, { cacheKey: lg.cacheKey });
        }

        if (assetPaths.mysteryCard) {
            for (const mSize of mysterySizes) {
                const resM = await loadAssetProxy(assetPaths.mysteryCard, mSize.w, mSize.h, { mysteryShadow: true });
                done++;
                if (!resM) failed++;
                else if (resM.fromDisk) alreadyOnDisk++;
                else generated++;
            }
        }

        for (const job of jobs) {
            const resC = await loadCardProxy(job.card, job.w, job.h, { glow: job.glow });
            done++;
            if (!resC) failed++;
            else if (resC.fromDisk) alreadyOnDisk++;
            else generated++;

            if (!resC?.fromDisk || done % 15 === 0) {
                await new Promise(r => setTimeout(r, 8));
            }

            if (onProgressEdit && (Date.now() - lastEditAt >= 3000 || done === totalItems)) {
                lastEditAt = Date.now();
                const pct = Math.round((done / totalItems) * 100);
                await onProgressEdit(
                    `🔥 **Warmup RegaDex en cours (${scopeLabel})...**\n` +
                    `• Taille actuelle : \`${job.w}×${job.h}\`\n` +
                    `• Progression : **${done}/${totalItems}** (**${pct}%**)\n` +
                    `• Créées : **${generated}** • Déjà prêtes : **${alreadyOnDisk}**${failed ? ` • Échecs : **${failed}**` : ''}`
                );
            }
        }

        proxyRamCache.clear();
        if (proxyRamClearTimer) {
            clearTimeout(proxyRamClearTimer);
            proxyRamClearTimer = null;
        }

        const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
        const stats = walkProxyStats(TCG_PROXIES_DIR);
        const mb = (stats.bytes / (1024 * 1024)).toFixed(2);
        const errLine = lastProxyWriteError
            ? `\n⚠️ **Erreur d'écriture disque :** \`${lastProxyWriteError}\``
            : '\n✅ **Volume Coolify (`/app/TCG/Proxies`) : OK et persistant !**';

        if (onProgressEdit) {
            await onProgressEdit(
                `✅ **Warmup terminé (${scopeLabel}) en ${elapsedSec}s !**\n` +
                `• **${generated}** miniature(s) générée(s) • **${alreadyOnDisk}** déjà en cache${failed ? ` • **${failed}** échec(s)` : ''}\n` +
                `• Total sur disque : **${stats.files}** fichiers (**${mb} Mo** dans \`TCG/Proxies\`)` +
                errLine
            );
        }
    } finally {
        proxyWarmupRunning = false;
    }
}

function getPersoCardOwners(cardId) {
    const data = getStoreData();
    const owners = [];
    for (const [uid, u] of Object.entries(data.users || {})) {
        if (!isSandboxId(uid) && (u?.cards?.[cardId] || 0) > 0) {
            owners.push(uid);
        }
    }
    return owners;
}

function buildPersoAdminPayload(selectedCardId = null, requestedPage = 0, guild = null) {
    if (persoCatalog.length === 0) {
        const embed = new EmbedBuilder()
            .setColor(0xff6b9d)
            .setTitle('🌟 Cartes Perso RegaDex (0)')
            .setDescription(
                `Aucune carte personnalisée n'a été détectée dans \`TCG/Cartes Perso\`.\n\n` +
                `**Format attendu :** \`Spé-01 - Nom de la carte.png\`\n` +
                `Dépose tes cartes dans \`TCG/Cartes Perso/\` puis clique sur **🔄 Recharger** !`
            );
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('tcg:persoview:rescan:0:none')
                .setLabel('Recharger le dossier')
                .setEmoji('🔄')
                .setStyle(ButtonStyle.Primary),
            buildCloseButton(EPSYS_ID)
        );
        return { embeds: [embed], files: [], components: [row] };
    }

    let selectedIdx = selectedCardId ? persoCatalog.findIndex(c => c.id === selectedCardId) : 0;
    if (selectedIdx === -1) selectedIdx = 0;
    const perPage = 25;
    const totalPages = Math.max(1, Math.ceil(persoCatalog.length / perPage));
    const safePage = selectedCardId
        ? Math.floor(selectedIdx / perPage)
        : Math.max(0, Math.min(requestedPage, totalPages - 1));
    const slice = persoCatalog.slice(safePage * perPage, (safePage + 1) * perPage);
    const card = persoCatalog[selectedIdx] || slice[0] || persoCatalog[0];

    const owners = getPersoCardOwners(card.id);
    const ownerText = owners.length > 0
        ? owners.map(uid => `<@${uid}>`).join(', ')
        : '*🟢 Disponible (non attribuée)*';

    let assignedCount = 0;
    const listLines = slice.map(c => {
        const cOwners = getPersoCardOwners(c.id);
        const marker = c.id === card.id ? '▶️ ' : '';
        const status = cOwners.length > 0 ? `✅ ${cOwners.map(uid => `<@${uid}>`).join(', ')}` : '⚪ Libre';
        return `${marker}\`${c.id}\` **${c.name}** — ${status}`;
    });
    for (const c of persoCatalog) {
        if (getPersoCardOwners(c.id).length > 0) assignedCount++;
    }

    const embed = new EmbedBuilder()
        .setColor(0xff6b9d)
        .setTitle(`🌟 ${card.id} — ${card.name}`)
        .setDescription(
            `**📦 Total Cartes Perso :** **${persoCatalog.length}** *(Attribuées : **${assignedCount}** • Libres : **${persoCatalog.length - assignedCount}**)*\n` +
            `**📁 Fichier :** \`TCG/Cartes Perso/${card.filename}\`\n` +
            `**👤 Propriétaire :** ${ownerText}\n` +
            `**⚡ Donner :** \`!tcgcard give @membre ${card.id}\`\n` +
            `────────────────────────────────────────\n` +
            listLines.join('\n').slice(0, 2500)
        )
        .setImage('attachment://carte_perso_admin.png')
        .setFooter({ text: `Carte ${selectedIdx + 1}/${persoCatalog.length} • Page ${safePage + 1}/${totalPages} • Unique & Non échangeable` });

    const files = [];
    if (card.filePath && fs.existsSync(card.filePath)) {
        files.push(new AttachmentBuilder(card.filePath, { name: 'carte_perso_admin.png' }));
    }

    const menu = new StringSelectMenuBuilder()
        .setCustomId(`tcg:persoview:sel:${safePage}`)
        .setPlaceholder(`Choisir une carte perso (${safePage + 1}/${totalPages})...`)
        .addOptions(slice.map(c => {
            const cOwners = getPersoCardOwners(c.id);
            const mOwner = cOwners[0] && guild ? guild.members.cache.get(cOwners[0]) : null;
            const ownerDesc = cOwners.length > 0
                ? `✅ Attribuée${mOwner ? ` à ${mOwner.displayName}` : ''}`
                : '⚪ Disponible (non attribuée)';
            return {
                label: `🌟 ${c.id} • ${c.name}`.slice(0, 100),
                description: ownerDesc.slice(0, 100),
                value: c.id,
                default: c.id === card.id
            };
        }));

    const btnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:persoview:card:prev:${card.id}`)
            .setLabel('Précédente')
            .setEmoji('◀️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(persoCatalog.length <= 1),
        new ButtonBuilder()
            .setCustomId(`tcg:persoview:card:next:${card.id}`)
            .setLabel('Suivante')
            .setEmoji('▶️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(persoCatalog.length <= 1),
        new ButtonBuilder()
            .setCustomId(`tcg:persoview:rescan:${safePage}:${card.id}`)
            .setLabel('Recharger')
            .setEmoji('🔄')
            .setStyle(ButtonStyle.Primary),
        buildCloseButton(EPSYS_ID)
    );

    const components = [new ActionRowBuilder().addComponents(menu), btnRow];
    if (totalPages > 1) {
        components.push(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`tcg:persoview:page:${Math.max(0, safePage - 1)}:${card.id}`)
                    .setLabel('Page préc.')
                    .setEmoji('⏪')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(safePage <= 0),
                new ButtonBuilder()
                    .setCustomId(`tcg:persoview:page:${Math.min(totalPages - 1, safePage + 1)}:${card.id}`)
                    .setLabel('Page suiv.')
                    .setEmoji('⏩')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(safePage >= totalPages - 1)
            )
        );
    }

    return { embeds: [embed], files, components };
}

async function handleAdminTcgCommand(message, lowerContent) {
    // -1. !tcgopenlast / !tcglastopen (Epsys-only)
    if (/^!(?:tcg|regadex|rgdx|rgx)\s*(?:open\s*last|last\s*open)(?:\s|$)/i.test(lowerContent)) {
        if (message.author.id !== EPSYS_ID) return true;
        if (getStoreData().recentOpenings.length === 0) {
            await backfillRecentOpeningsTcg(message.client);
        }
        await replySilent(message, buildOpenLastListPayload(message.guild));
        return true;
    }

    // 0. !tcgpullchance (Epsys-only)
    if (/^!(?:tcg|rgdx|regadex)\s*pull\s*chance(?:\s|$)/i.test(lowerContent)) {
        if (message.author.id !== EPSYS_ID) return true;
        if (cardCatalog.length === 0) {
            await replySilent(message, `❌ Les cartes ${SET1_NAME} ne sont pas chargées.`);
            return true;
        }
        const now = Date.now();
        for (const [k, s] of pullChanceSessions.entries()) {
            if (now - (s.createdAt || 0) > 60 * 60 * 1000) pullChanceSessions.delete(k);
        }
        const sessionId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        const session = {
            targetKey: PULL_BOOST_ROLE_KEY,
            cardId: cardCatalog[0]?.id || null,
            mult: 5,
            cardPage: 0,
            createdAt: now
        };
        pullChanceSessions.set(sessionId, session);
        await replySilent(message, buildPullChancePayload(sessionId, session, message.guild));
        return true;
    }

    // 0bis. !tcgpunition [ID/@/pseudo] (Epsys-only)
    if (/^!(?:tcg|rgdx|regadex)\s*punition(?:\s|$)/i.test(lowerContent)) {
        if (message.author.id !== EPSYS_ID) return true;
        const now = Date.now();
        for (const [k, s] of punitionSessions.entries()) {
            if (now - (s.createdAt || 0) > 60 * 60 * 1000) punitionSessions.delete(k);
        }
        const rawArg = message.content.trim().replace(/^!(?:tcg|rgdx|regadex)\s*punition\s*/i, '').trim();
        const openPanel = async (targetUserId = null) => {
            const sessionId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
            const session = { targetUserId, createdAt: now };
            punitionSessions.set(sessionId, session);
            await replySilent(message, buildPunitionPayload(sessionId, session, message.guild));
        };

        if (!rawArg && message.mentions.users.size === 0) {
            await openPanel(null);
            return true;
        }
        await resolveMemberArg(message, rawArg, async (target) => {
            if (!target) return;
            if (target.user?.bot || target.bot) {
                await replySilent(message, '❌ Impossible de cibler un bot.');
                return;
            }
            await openPanel(target.id);
        });
        return true;
    }
    // 1. !boostergive [@membre/ID] [nb] / !booster give ...
    let m = lowerContent.match(/^!booster\s*give(?:\s+(.*))?$/i);
    if (m) {
        if (message.author.id !== EPSYS_ID) return true;
        const rawArgs = message.content.trim().replace(/^!booster\s*give\s*/i, '').trim();
        const tokens = rawArgs.split(/\s+/).filter(Boolean);
        let qty = 1;
        if (tokens.length > 0 && /^\d+$/.test(tokens[tokens.length - 1]) && tokens[tokens.length - 1].length <= 4) {
            qty = parseInt(tokens.pop(), 10);
        }
        const memberQuery = tokens.join(' ');
        if (!memberQuery && message.mentions.users.size === 0) {
            await replySilent(message, "Usage : `!boostergive [@membre/ID] [quantité]`");
            return true;
        }
        await resolveMemberArg(message, memberQuery, async (target) => {
            if (!target) return;
            const u = getOrCreateTcgUser(target.id);
            u.inventory.booster = (u.inventory.booster || 0) + Math.max(1, qty);
            tcgBridge.demanderSauvegarde();
            await replySilent(message, `🎁 **+${Math.max(1, qty)} booster(s)** ajouté(s) à l'inventaire de <@${target.id}> *(Total inventaire : ${u.inventory.booster})*.`);
        });
        return true;
    }

    // 1bis. !givebooster @rôle [nb] (Epsys-only)
    m = lowerContent.match(/^!give\s*booster(?:\s+(.*))?$/i);
    if (m) {
        if (message.author.id !== EPSYS_ID) return true;
        const rawArgs = message.content.trim().replace(/^!give\s*booster\s*/i, '').trim();
        const tokens = rawArgs.split(/\s+/).filter(Boolean);
        let qty = 1;
        const exactRoleMatch = rawArgs && message.guild.roles.cache.find(r => normalizeText(r.name) === normalizeText(rawArgs));
        if (!exactRoleMatch && tokens.length >= 2 && /^\d{1,4}$/.test(tokens[tokens.length - 1])) {
            qty = Math.max(1, parseInt(tokens.pop(), 10));
        }
        const roleQuery = tokens.join(' ').trim();

        let role = message.mentions.roles.first() || null;
        if (!role && roleQuery) {
            const idMatch = roleQuery.match(/^(?:<@&)?(\d{17,20})>?$/);
            if (idMatch) {
                role = message.guild.roles.cache.get(idMatch[1]) || await message.guild.roles.fetch(idMatch[1]).catch(() => null);
            } else if (roleQuery.toLowerCase() === '@everyone' || roleQuery.toLowerCase() === 'everyone') {
                role = message.guild.roles.everyone;
            } else {
                const normRole = normalizeText(roleQuery);
                role = message.guild.roles.cache.find(r => normalizeText(r.name) === normRole)
                    || message.guild.roles.cache.find(r => normalizeText(r.name).includes(normRole))
                    || null;
            }
        }

        if (!role) {
            await replySilent(message, "❌ Rôle introuvable. Usage : `!givebooster @rôle [quantité]` *(pour un seul membre, utilise `!boostergive @membre [quantité]`)*.");
            return true;
        }

        await message.guild.members.fetch().catch(() => {});
        const targets = [...role.members.values()].filter(mem => !mem.user.bot);
        if (targets.length === 0) {
            await replySilent(message, `❌ Aucun membre humain ne possède le rôle **${role.name}**.`);
            return true;
        }

        for (const target of targets) {
            const u = getOrCreateTcgUser(target.id);
            u.inventory.booster = (u.inventory.booster || 0) + qty;
        }
        tcgBridge.demanderSauvegarde();

        await replySilent(
            message,
            `🎁 **+${qty} booster${qty > 1 ? 's' : ''}** ajouté${qty > 1 ? 's' : ''} à l'inventaire des **${targets.length} membre${targets.length > 1 ? 's' : ''}** possédant le rôle **${role.name}** !`
        );
        return true;
    }

    // 2. !boosterremove [@membre/ID] [nb] / !booster remove ...
    m = lowerContent.match(/^!booster\s*remove(?:\s+(.*))?$/i);
    if (m) {
        if (message.author.id !== EPSYS_ID) return true;
        const rawArgs = message.content.trim().replace(/^!booster\s*remove\s*/i, '').trim();
        const tokens = rawArgs.split(/\s+/).filter(Boolean);
        let qty = 1;
        if (tokens.length > 0 && /^\d+$/.test(tokens[tokens.length - 1]) && tokens[tokens.length - 1].length <= 4) {
            qty = parseInt(tokens.pop(), 10);
        }
        const memberQuery = tokens.join(' ');
        await resolveMemberArg(message, memberQuery, async (target) => {
            if (!target) return replySilent(message, "Usage : `!boosterremove [@membre/ID] [quantité]`");
            const u = getOrCreateTcgUser(target.id);
            u.inventory.booster = Math.max(0, (u.inventory.booster || 0) - Math.max(1, qty));
            tcgBridge.demanderSauvegarde();
            await replySilent(message, `🗑️ **-${Math.max(1, qty)} booster(s)** retiré(s) de l'inventaire de <@${target.id}> *(Reste inventaire : ${u.inventory.booster})*.`);
        });
        return true;
    }

    // 3. !rgdxpts give/set | !tcgpts give/set | !regadexpts give/set
    m = lowerContent.match(/^!(?:rgdx|tcg|regadex)\s*pts\s*(give|set)(?:\s+(.*))?$/i);
    if (m) {
        if (message.author.id !== EPSYS_ID) return true;
        const action = m[1].toLowerCase();
        const rawArgs = message.content.trim().replace(/^!(?:rgdx|tcg|regadex)\s*pts\s*(?:give|set)\s*/i, '').trim();
        const tokens = rawArgs.split(/\s+/).filter(Boolean);
        const amountStr = tokens.pop();
        const amount = parseInt(amountStr, 10);
        const memberQuery = tokens.join(' ');
        if (isNaN(amount)) {
            await replySilent(message, `Usage : \`!rgdxpts ${action} [@membre/ID] [nombre]\``);
            return true;
        }
        await resolveMemberArg(message, memberQuery, async (target) => {
            if (!target) return;
            const u = getOrCreateTcgUser(target.id);
            if (action === 'give') u.points = Math.max(0, u.points + amount);
            else u.points = Math.max(0, amount);
            tcgBridge.demanderSauvegarde();
            await replySilent(message, `🪙 Points RegaDex de <@${target.id}> : **${u.points} pts**.`);
        });
        return true;
    }

    // 4. !rgdxcard give/remove | !tcgcard give/remove | !regadexcard give/remove
    m = lowerContent.match(/^!(?:rgdx|tcg|regadex)\s*card\s*(give|remove)(?:\s+(.*))?$/i);
    if (m) {
        if (message.author.id !== EPSYS_ID) return true;
        const action = m[1].toLowerCase();
        const rawArgs = message.content.trim().replace(/^!(?:rgdx|tcg|regadex)\s*card\s*(?:give|remove)\s*/i, '').trim();
        const tokens = rawArgs.split(/\s+/).filter(Boolean);
        if (tokens.length < 2) {
            await replySilent(message, `Usage : \`!rgdxcard ${action} [@membre/ID] [carte]\``);
            return true;
        }
        const memberToken = tokens.shift();
        const cardQuery = tokens.join(' ');
        const res = resolveCardQuery(cardQuery);
        if (!res.card) {
            await replySilent(message, `❌ Carte introuvable pour \`${cardQuery}\`.`);
            return true;
        }
        await resolveMemberArg(message, memberToken, async (target) => {
            if (!target) return;
            const u = getOrCreateTcgUser(target.id);

            if (res.card.isPerso && action === 'give') {
                const data = getStoreData();
                const otherOwner = Object.entries(data.users || {}).find(([uid, ud]) =>
                    uid !== target.id && !isSandboxId(uid) && (ud?.cards?.[res.card.id] || 0) > 0
                );
                if (otherOwner) {
                    await replySilent(
                        message,
                        `⚠️ **Carte perso unique :** \`${res.card.id}\` (**${res.card.name}**) est déjà possédée par <@${otherOwner[0]}>.\n` +
                        `-# Si tu veux la transférer, retire-la d'abord avec \`!tcgcard remove ${otherOwner[0]} ${res.card.id}\`.`
                    );
                    return;
                }
                if ((u.cards[res.card.id] || 0) >= 1) {
                    await replySilent(message, `ℹ️ <@${target.id}> possède déjà sa carte perso unique **${res.card.id} • ${res.card.name}** *(gardée à vie)*.`);
                    return;
                }
                u.cards[res.card.id] = 1;
                tcgBridge.demanderSauvegarde();
                await replySilent(message, `🌟 Carte personnalisée **${res.card.id} • ${res.card.name}** attribuée **à vie** à <@${target.id}> !`);
                return;
            }

            if (action === 'give') {
                u.cards[res.card.id] = (u.cards[res.card.id] || 0) + 1;
            } else {
                u.cards[res.card.id] = Math.max(0, (u.cards[res.card.id] || 0) - 1);
                if (u.cards[res.card.id] === 0) delete u.cards[res.card.id];
            }
            tcgBridge.demanderSauvegarde();
            await replySilent(message, `🃏 **${res.card.id} • ${res.card.name}** ${action === 'give' ? 'ajoutée à' : 'retirée de'} <@${target.id}> *(Quantité : ${u.cards[res.card.id] || 0})*.`);
        });
        return true;
    }

    // 5. !rgdxcooldown reset | !tcgcooldown reset | !regadexcooldown reset
    m = lowerContent.match(/^!(?:rgdx|tcg|regadex)\s*cooldown\s*reset(?:\s+(.*))?$/i);
    if (m) {
        if (message.author.id !== EPSYS_ID) return true;
        const memberQuery = message.content.trim().replace(/^!(?:rgdx|tcg|regadex)\s*cooldown\s*reset\s*/i, '').trim();
        if (!memberQuery && message.mentions.users.size === 0) {
            const u = getOrCreateTcgUser(message.author.id);
            u.freeBoosters = MAX_FREE_BOOSTERS;
            u.lastFreeRechargeAt = Date.now();
            tcgBridge.demanderSauvegarde();
            await replySilent(message, `⏱️ Cooldown booster RegaDex réinitialisé pour <@${message.author.id}> (**2/2 gratuits** prêts) !`);
            return true;
        }
        await resolveMemberArg(message, memberQuery, async (target) => {
            if (!target) return;
            const u = getOrCreateTcgUser(target.id);
            u.freeBoosters = MAX_FREE_BOOSTERS;
            u.lastFreeRechargeAt = Date.now();
            tcgBridge.demanderSauvegarde();
            await replySilent(message, `⏱️ Cooldown booster RegaDex réinitialisé pour <@${target.id}> (**2/2 gratuits** prêts) !`);
        });
        return true;
    }

    // 5bis. !tcgperso / !rgdxperso / !cartesperso (Epsys-only) — Visualiseur de toutes les Cartes Perso
    m = lowerContent.match(/^!(?:(?:rgdx|tcg|regadex)\s*perso|cartes?\s*perso)(?:\s+(.*))?$/i);
    if (m) {
        if (message.author.id !== EPSYS_ID) return true;
        const q = (m[1] || '').trim();
        let initialCardId = null;
        if (q) {
            const res = resolveCardQuery(q);
            if (res.card?.isPerso) initialCardId = res.card.id;
            else {
                const matchPerso = res.matches.find(c => c.isPerso);
                if (matchPerso) initialCardId = matchPerso.id;
            }
        }
        const payload = buildPersoAdminPayload(initialCardId, 0, message.guild);
        await replySilent(message, payload);
        return true;
    }

    // 6. !rgdxproxies [warmup [set|perso|all] / purge] | !tcgproxies (Epsys-only)
    m = lowerContent.match(/^!(?:rgdx|tcg|regadex)\s*proxies(?:\s+(.*))?$/i);
    if (m) {
        if (message.author.id !== EPSYS_ID) return true;
        const arg = (m[1] || '').trim().toLowerCase();

        if (arg === 'purge' || arg === 'clear' || arg === 'reset') {
            if (proxyWarmupRunning) {
                await replySilent(message, '⏳ Un warmup est déjà en cours, attends la fin avant de purger.');
                return true;
            }
            proxyRamCache.clear();
            if (proxyRamClearTimer) {
                clearTimeout(proxyRamClearTimer);
                proxyRamClearTimer = null;
            }
            let removedEntries = 0;
            if (fs.existsSync(TCG_PROXIES_DIR)) {
                for (const entry of fs.readdirSync(TCG_PROXIES_DIR)) {
                    if (entry.startsWith('.')) continue;
                    try {
                        fs.rmSync(path.join(TCG_PROXIES_DIR, entry), { recursive: true, force: true });
                        removedEntries++;
                    } catch {}
                }
            }
            lastProxyWriteError = null;
            await replySilent(
                message,
                `🧹 **Proxies RegaDex purgés !** (${removedEntries} dossier(s) supprimé(s) dans \`TCG/Proxies\`).\n👉 Utilise \`!rgdxproxies\` pour choisir quel Set pré-générer.`
            );
            return true;
        }

        const warmMatch = arg.match(/^(?:warmup|warm|build|pregen)(?:\s+(.+))?$/i);
        if (warmMatch) {
            const rawTarget = (warmMatch[1] || 'all').trim();
            let scope = 'all';
            let scopeLabel = 'Tous les Sets + Cartes Perso';
            if (rawTarget === 'perso' || rawTarget === 'persos') {
                scope = 'perso';
                scopeLabel = 'Cartes Perso';
            } else if (/^(?:set\s*)?(\d+)$/i.test(rawTarget)) {
                const sNum = parseInt(rawTarget.replace(/\D/g, ''), 10);
                scope = `set:${sNum}`;
                scopeLabel = getSetConfig(sNum).name;
            }
            const prep = collectProxyJobs(scope);
            if (prep.jobs.length === 0) {
                await replySilent(message, `❌ Aucune carte chargée pour **${scopeLabel}**.`);
                return true;
            }
            if (proxyWarmupRunning) {
                await replySilent(message, '⏳ Un warmup des proxies est déjà en cours !');
                return true;
            }
            const totalItems = prep.jobs.length + (assetPaths.mysteryCard ? prep.mysterySizes.length : 0);
            const statusMsg = await replySilent(
                message,
                `🔥 **Warmup RegaDex démarré (${scopeLabel}) !**\n• **${totalItems}** miniatures à vérifier/générer...\n⏳ Progression : \`0/${totalItems}\` (0%)...`
            );
            await runProxyWarmup(scope, scopeLabel, async (text) => {
                if (statusMsg) await statusMsg.edit(withSilent(text)).catch(() => {});
            });
            return true;
        }

        const stats = walkProxyStats(TCG_PROXIES_DIR);
        const mb = (stats.bytes / (1024 * 1024)).toFixed(2);
        const dimLines = Object.entries(stats.byDim)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([dim, d]) => `• \`${dim}\` : **${d.files}** fichier(s) (*${(d.bytes / (1024 * 1024)).toFixed(2)} Mo*)`);

        const statusHeader = lastProxyWriteError
            ? `⚠️ **Erreur d'écriture détectée :** \`${lastProxyWriteError}\``
            : (stats.files > 0
                ? '✅ **Installation confirmée :** le bot lit et écrit bien ses miniatures sur le volume.'
                : 'ℹ️ **Cache vide pour le moment :** choisis un Set dans le menu ci-dessous pour pré-générer ses miniatures.');

        const proxyOptions = getActiveSets().map(s => ({
            label: `${s.name} (${getSetCardsCount(s.number)} cartes)`.slice(0, 100),
            description: `Générer uniquement les proxies du Set ${s.number}`,
            value: `set:${s.number}`,
            emoji: '🃏'
        }));
        proxyOptions.push({
            label: `Cartes Perso (${persoCatalog.length} carte${persoCatalog.length > 1 ? 's' : ''})`,
            description: persoCatalog.length > 0 ? 'Générer uniquement les proxies de TCG/Cartes Perso' : 'Aucune carte perso détectée pour le moment',
            value: 'perso',
            emoji: '🌟'
        });
        proxyOptions.push({
            label: `Tout générer (${cardCatalog.length + persoCatalog.length} cartes)`,
            description: 'Pré-génère tous les Sets actifs + toutes les Cartes Perso',
            value: 'all',
            emoji: '🔥'
        });

        const proxyMenu = new StringSelectMenuBuilder()
            .setCustomId(`tcg:proxy:gen:${EPSYS_ID}`)
            .setPlaceholder('⚡ Choisir le Set / dossier à pré-générer...')
            .addOptions(proxyOptions);

        const closeRow = new ActionRowBuilder().addComponents(buildCloseButton(EPSYS_ID));

        await replySilent(message, {
            content:
                `🗂️ **Proxies RegaDex (\`TCG/Proxies\`)**\n` +
                `${statusHeader}\n\n` +
                `• **Total disque :** **${stats.files}** miniature(s) (**${mb} Mo**)\n` +
                `• **Micro-cache RAM :** **${proxyRamCache.size}/${PROXY_MAX_RAM_ITEMS}** (TTL 2 min)\n` +
                (dimLines.length > 0 ? `\n**Détail par format :**\n${dimLines.join('\n')}\n` : '\n') +
                `\n-# Commandes rapides : \`!rgdxproxies warmup [1|perso|all]\` • \`!rgdxproxies purge\``,
            components: [new ActionRowBuilder().addComponents(proxyMenu), closeRow]
        });
        return true;
    }

    return false;
}

// ==========================================
//   PARSEUR COMMANDES PRÉFIXE (AVEC OU SANS ESPACE)
// ==========================================

function normalizeTcgSubcommand(rawSub, rawRest = '') {
    let sub = (rawSub || 'hub').toLowerCase();
    let rest = (rawRest || '').trim();

    if (sub === 'flexmodify') {
        sub = 'flex';
        rest = `modify ${rest}`.trim();
    } else if (sub === 'booster' || sub === 'go' || sub === 'boosteropen' || sub === 'openbooster' || sub === 'boostergo' || sub === 'gobooster') {
        sub = 'open';
    } else if (sub === 'collection') {
        sub = 'classeur';
    } else if (sub === 'profile') {
        sub = 'profil';
    } else if (sub === 'aide') {
        sub = 'help';
    } else if (sub === 'notifs') {
        sub = 'notif';
    } else if (sub === 'inventaire' || sub === 'inv') {
        sub = 'claim';
    } else if (sub === 'boutique') {
        sub = 'store';
    }

    return { sub, rest };
}

function parseTcgCommand(content) {
    const trimmed = (content || '').trim();
    if (!trimmed.startsWith('!')) return null;

    // 1. Commandes préfixées !tcg / !regadex / !rgdx (avec ou sans espace)
    let m = trimmed.match(/^!(?:regadex|rgdx|tcg)\s*(flexmodify|flex|boosteropen|openbooster|boostergo|gobooster|open|booster|go|store|boutique|claim|inventaire|inv|classeur|collection|carte|trade|top|notifs?|profile|profil|wishlist|credits|guide|help|aide|hub)(?:\s+(.*))?$/i);
    if (m) {
        return normalizeTcgSubcommand(m[1], m[2] || '');
    }

    if (/^!(?:regadex|rgdx|tcg)(?:\s|$)/i.test(trimmed)) {
        return { sub: 'hub', rest: '' };
    }

    // 2. Alias directs !open, !booster, !boosteropen, !boostergo, !booster open / !booster go
    m = trimmed.match(/^!(boosteropen|openbooster|boostergo|gobooster|booster|open)(?:\s+(.*))?$/i);
    if (m) {
        const cmd = m[1].toLowerCase();
        const rest = (m[2] || '').trim();
        if (cmd === 'booster' && rest && !/^(?:open|go)$/i.test(rest)) return null;
        return { sub: 'open', rest: '' };
    }

    m = trimmed.match(/^!(?:classeur|collection)(?:\s+(.*))?$/i);
    if (m) return { sub: 'classeur', rest: (m[1] || '').trim() };

    m = trimmed.match(/^!carte(?:\s+(.*))?$/i);
    if (m) return { sub: 'carte', rest: (m[1] || '').trim() };

    m = trimmed.match(/^!trade(?:\s+(.*))?$/i);
    if (m) return { sub: 'trade', rest: (m[1] || '').trim() };

    m = trimmed.match(/^!wishlist(?:\s+(.*))?$/i);
    if (m) return { sub: 'wishlist', rest: (m[1] || '').trim() };

    m = trimmed.match(/^!(flexmodify|flex)(?:\s+(.*))?$/i);
    if (m) {
        let rest = (m[2] || '').trim();
        if (m[1].toLowerCase() === 'flexmodify') {
            rest = `modify ${rest}`.trim();
        }
        return { sub: 'flex', rest };
    }

    return null;
}

async function handleWishlistCommand(targetResponder, authorMember, rawArg) {
    const arg = (rawArg || '').trim();
    const u = getOrCreateTcgUser(authorMember.id);
    u.wishlist = getSanitizedWishlist(u);

    if (!arg) {
        return replyPanelSilent(targetResponder, buildWishlistPayload(authorMember, authorMember.id, false, false), authorMember.id);
    }

    if (/^(?:clear|vider|reset)$/i.test(arg)) {
        u.wishlist = [];
        if (!isSandboxId(authorMember.id)) tcgBridge.demanderSauvegarde();
        return replyPanelSilent(targetResponder, buildWishlistPayload(authorMember, authorMember.id, false, false, '🧹 *Wishlist vidée.*'), authorMember.id);
    }

    if (/^(?:add|ajouter|\+)\s+/i.test(arg)) {
        const q = arg.replace(/^(?:add|ajouter|\+)\s+/i, '').trim();
        const res = resolveCardQuery(q);
        if (!res.card) {
            const pickable = (res.matches || []).filter(c => !c.isPerso && (res.isCodeQuery || (u.cards?.[c.id] || 0) > 0));
            if (pickable.length > 0 && u.wishlist.length < MAX_WISHLIST) {
                const menu = new StringSelectMenuBuilder()
                    .setCustomId(`tcg:wish:addpick:${authorMember.id}:0:0`)
                    .setPlaceholder('Plusieurs cartes correspondent, choisis...')
                    .addOptions(pickable.slice(0, 25).map(c => {
                        const owned = (u.cards?.[c.id] || 0) > 0;
                        return {
                            label: owned ? `${c.id} • ${c.name}`.slice(0, 100) : `🔒 ${c.id} • Carte non découverte`,
                            description: owned ? `${c.rarity} • Ajouter à la Wishlist` : 'Ajouter à la Wishlist',
                            value: c.id
                        };
                    }));
                return replyPanelSilent(targetResponder, {
                    content: `🔎 Plusieurs cartes correspondent à \`${q}\` :`,
                    components: [new ActionRowBuilder().addComponents(menu)]
                }, authorMember.id);
            }
            return replySilent(targetResponder, `❌ Aucune carte trouvée pour \`${q}\`. Utilise \`!wishlist\` pour choisir directement dans le menu !`);
        }
        if (res.card.isPerso) {
            return replySilent(targetResponder, `❌ Les cartes personnalisées (\`${res.card.id}\`) sont **uniques et non échangeables**, impossible de les ajouter à la Wishlist.`);
        }
        if (u.wishlist.includes(res.card.id)) {
            return replySilent(targetResponder, buildWishlistPayload(authorMember, authorMember.id, false, false, `ℹ️ \`${res.card.id}\` est déjà dans ta Wishlist.`));
        }
        if (u.wishlist.length >= MAX_WISHLIST) {
            return replySilent(targetResponder, `⚠️ Ta Wishlist est pleine (**${MAX_WISHLIST}/${MAX_WISHLIST}**). Retire d'abord une carte via \`!wishlist\`.`);
        }
        u.wishlist.push(res.card.id);
        if (!isSandboxId(authorMember.id)) tcgBridge.demanderSauvegarde();
        return replySilent(targetResponder, buildWishlistPayload(authorMember, authorMember.id, false, false, `❤️ \`${res.card.id}\` ajoutée à ta Wishlist !`));
    }

    if (/^(?:remove|rem|retirer|del|-)\s+/i.test(arg)) {
        const q = arg.replace(/^(?:remove|rem|retirer|del|-)\s+/i, '').trim();
        const res = resolveCardQuery(q);
        if (!res.card || !u.wishlist.includes(res.card.id)) {
            return replySilent(targetResponder, `❌ Cette carte n'est pas dans ta Wishlist.`);
        }
        u.wishlist = u.wishlist.filter(id => id !== res.card.id);
        if (!isSandboxId(authorMember.id)) tcgBridge.demanderSauvegarde();
        return replySilent(targetResponder, buildWishlistPayload(authorMember, authorMember.id, false, false, `💔 \`${res.card.id}\` retirée de ta Wishlist.`));
    }

    // Si une carte directe est tapée (!wishlist 1-84), basculer ajout/retrait
    const cardRes = resolveCardQuery(arg);
    if (cardRes.card) {
        if (cardRes.card.isPerso) {
            return replyPanelSilent(targetResponder, `❌ Les cartes personnalisées (\`${cardRes.card.id}\`) sont **uniques et non échangeables**, impossible de les ajouter à la Wishlist.`, authorMember.id);
        }
        if (u.wishlist.includes(cardRes.card.id)) {
            u.wishlist = u.wishlist.filter(id => id !== cardRes.card.id);
            if (!isSandboxId(authorMember.id)) tcgBridge.demanderSauvegarde();
            return replyPanelSilent(targetResponder, buildWishlistPayload(authorMember, authorMember.id, false, false, `💔 \`${cardRes.card.id}\` retirée de ta Wishlist.`), authorMember.id);
        }
        if (u.wishlist.length >= MAX_WISHLIST) {
            return replyPanelSilent(targetResponder, `⚠️ Ta Wishlist est pleine (**${MAX_WISHLIST}/${MAX_WISHLIST}**).`, authorMember.id);
        }
        u.wishlist.push(cardRes.card.id);
        if (!isSandboxId(authorMember.id)) tcgBridge.demanderSauvegarde();
        return replyPanelSilent(targetResponder, buildWishlistPayload(authorMember, authorMember.id, false, false, `❤️ \`${cardRes.card.id}\` ajoutée à ta Wishlist !`), authorMember.id);
    }

    // Sinon consulter la wishlist d'un membre mentionné / cherché
    if (targetResponder.isRepliable?.()) {
        return replyPanelSilent(targetResponder, `❌ Carte introuvable pour \`${arg}\`.`, authorMember.id);
    }
    return resolveMemberArg(targetResponder, arg, async (targetMember) => {
        if (!targetMember) return;
        await replyPanelSilent(targetResponder, buildWishlistPayload(targetMember, authorMember.id, false, false), authorMember.id);
    });
}

async function handleTcgMessage(message) {
    if (!message.guild || message.guild.id !== GUILD_ID) return false;
    const raw = message.content.trim();
    if (!raw.startsWith('!')) return false;

    if (await handleAdminTcgCommand(message, raw.toLowerCase())) return true;

    if (/^!tcgtradeopen5min(?:\s|$)/i.test(raw)) {
        if (message.author.id !== EPSYS_ID) return true;
        const arg = (raw.split(/\s+/)[1] || '').toLowerCase();
        if (arg === 'off' || arg === 'stop') {
            tradeFreeModeUntil = 0;
            await replySilent(message, '🔒 **Mode échange libre RegaDex désactivé** *(retour aux critères normaux)*.');
        } else {
            tradeFreeModeUntil = Date.now() + TRADE_FREE_WINDOW_MS;
            const endTs = Math.floor(tradeFreeModeUntil / 1000);
            await replySilent(
                message,
                `🔓 **Mode échange libre RegaDex activé pour 5 minutes** *(expiration <t:${endTs}:R>)*.\n` +
                `-# Tous les critères d'échange (rareté, dernière copie, dons à sens unique, confirmation déséquilibrée) sont temporairement supprimés sans rien afficher aux membres dans les échanges.`
            );
        }
        return true;
    }

    if (/^!tcgmastertest(?:\s|$)/i.test(raw)) {
        if (message.author.id !== EPSYS_ID) return true;
        const u = getOrCreateTcgUser(message.author.id);
        const payload = await buildMasterSetPantheonPayload(message.member, u, DEFAULT_SET_NUMBER, true);
        await sendSilent(message.channel, payload);
        return true;
    }

    if (/^!tcggodpacktest(?:\s|$)/i.test(raw)) {
        if (message.author.id !== EPSYS_ID) return true;
        if (cardCatalog.length === 0) {
            await replySilent(message, `❌ Les cartes ${SET1_NAME} ne sont pas chargées.`);
            return true;
        }
        const u = getOrCreateTcgUser(message.author.id);
        const testCards = drawGodPackCards(DEFAULT_SET_NUMBER, message.author.id, message.member);
        const testFlags = testCards.map(c => (u.cards?.[c.id] || 0) <= 0);
        const payload = await buildGodPackPantheonPayload(message.member, testCards, testFlags, u.theme, false, true);
        await sendSilent(message.channel, payload);
        return true;
    }

    if (/^!tcgtradetest(?:\s|$)/i.test(raw)) {
        if (message.author.id !== EPSYS_ID) return true;
        if (cardCatalog.length === 0) {
            await replySilent(message, `❌ Les cartes ${SET1_NAME} ne sont pas chargées.`);
            return true;
        }
        const argMatch = raw.match(/^!tcgtradetest\s+([1-3])$/i);
        const countA = argMatch ? parseInt(argMatch[1], 10) : 1;
        const countB = argMatch ? parseInt(argMatch[1], 10) : 2;

        const pickRandomIds = (n) => {
            const pool = [...cardCatalog];
            const picked = [];
            while (picked.length < n && pool.length > 0) {
                const idx = Math.floor(Math.random() * pool.length);
                picked.push(pool.splice(idx, 1)[0].id);
            }
            return picked;
        };

        const cardsA = pickRandomIds(countA);
        const cardsB = pickRandomIds(countB);
        const nameA = message.member?.displayName || message.author.username;
        const nameB = 'Hyaeros';
        const recapBuffer = await renderTradeRecapCanvas(nameA, cardsA, nameB, cardsB);

        const testEmbed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('✅ [TEST] Échange #1 validé !')
            .setDescription(
                `**${nameA}** (<@${message.author.id}>) a donné :\n${formatOfferLines(cardsA)}\n\n` +
                `**${nameB}** a donné :\n${formatOfferLines(cardsB)}`
            )
            .setImage('attachment://trade_recap_test.jpg')
            .setFooter({ text: `Aperçu Visuel Trade • !tcgtradetest [1|2|3]` });

        await sendSilent(message.channel, {
            embeds: [testEmbed],
            files: [new AttachmentBuilder(recapBuffer, { name: 'trade_recap_test.jpg' })]
        });
        return true;
    }

    const sandboxMatch = raw.match(/^!tcgx\s*([a-z]*)(?:\s+(.*))?$/i);
    if (sandboxMatch) {
        if (message.author.id !== EPSYS_ID) return true;
        const norm = normalizeTcgSubcommand(sandboxMatch[1] || 'hub', sandboxMatch[2] || '');
        const sub = norm.sub;
        const rest = norm.rest;

        if (sub === 'reset') {
            getOrCreateTcgxSandbox(true);
            await replySilent(message, '🧪 **Compte test `!tcgx` réinitialisé !** (`109/109` cartes en `x5`, `999 999 pts`, `999` boosters en inventaire).');
            return true;
        }

        if (sub === 'trade') {
            await replySilent(message, '❌ Les échanges sont désactivés en mode test `!tcgx` pour préserver le fair-play du serveur.');
            return true;
        }

        const sandboxMember = buildTcgMemberProxy(message.member, TCGX_SANDBOX_ID);
        const su = getOrCreateTcgUser(TCGX_SANDBOX_ID);

        if (sub === 'hub') {
            await replySilent(message, buildHubPayload(sandboxMember, su));
            return true;
        }
        if (sub === 'help') {
            await replySilent(message, buildHelpPayload(TCGX_SANDBOX_ID));
            return true;
        }
        if (sub === 'guide') {
            await replySilent(message, buildGuidePayload(TCGX_SANDBOX_ID, false));
            return true;
        }
        if (sub === 'credits') {
            await replySilent(message, buildCreditsPayload(TCGX_SANDBOX_ID, false));
            return true;
        }
        if (sub === 'profil' || sub === 'profile') {
            await replySilent(message, buildProfilePayload(sandboxMember, su, false, false));
            return true;
        }
        if (sub === 'open' || sub === 'booster' || sub === 'go') {
            await replySilent(message, buildOpenPromptPayload(sandboxMember, su, false));
            return true;
        }
        if (sub === 'store') {
            await replySilent(message, buildStorePayload(sandboxMember, su, false));
            return true;
        }
        if (sub === 'claim') {
            await replySilent(message, buildClaimPayload(sandboxMember, su, false));
            return true;
        }
        if (sub === 'wishlist') {
            await handleWishlistCommand(message, sandboxMember, rest);
            return true;
        }
        if (sub === 'top') {
            await replySilent(message, {
                embeds: [buildTopEmbed(message.guild, 'total')],
                components: buildTopComponents(TCGX_SANDBOX_ID, 'total', false)
            });
            return true;
        }
        if (sub === 'classeur') {
            const sent = await replySilent(message, '📖 Chargement du classeur test `!tcgx`...');
            const payload = await buildBinderReplyPayload(sandboxMember, TCGX_SANDBOX_ID, { fromHub: false });
            await sent.edit({ content: null, ...payload });
            return true;
        }
        if (sub === 'carte') {
            await handleCarteCommand(message, sandboxMember, rest, message.channel);
            return true;
        }
        if (sub === 'flex') {
            await handleFlexCommand(message, sandboxMember, message.guild, rest);
            return true;
        }

        await replySilent(message, buildHubPayload(sandboxMember, su));
        return true;
    }

    const parsed = parseTcgCommand(raw);
    if (!parsed) return false;

    if (!hasTcgRole(message.member)) {
        await replyTempSilent(
            message,
            `🔒 <@${message.author.id}>, le **RegaDex TCG** et toutes ses commandes se passent exclusivement dans le salon dédié : <#${TCG_CHANNEL_ID}>\n(Si tu n'as pas accès à ce salon, c'est que tu n'as pas encore choisi le rôle <@&${TCG_ROLE_ID}> dans <#${ROLE_CHANNEL_ID}>)`
        );
        return true;
    }

    if (parsed.sub === 'flex' && !isAllowedFlexChannel(message.channel)) {
        await replyTempSilent(
            message,
            `⭐ <@${message.author.id}>, la commande \`!flex\` est uniquement autorisée dans <#${TCG_CHANNEL_ID}> et <#${SHITPOST_CHANNEL_ID}>.`
        );
        return true;
    }

    if (parsed.sub !== 'flex' && !isAllowedTcgChannel(message.channel)) {
        await replyTempSilent(
            message,
            `🃏 <@${message.author.id}>, le **RegaDex TCG** et ses commandes se passent exclusivement dans le salon dédié : <#${TCG_CHANNEL_ID}> *(seul \`!flex\` / \`!tcg flex\` est autorisé dans <#${TCG_CHANNEL_ID}> et <#${SHITPOST_CHANNEL_ID}>)*.\n(Si tu n'as pas accès à ce salon, c'est que tu n'as pas encore choisi le rôle <@&${TCG_ROLE_ID}> dans <#${ROLE_CHANNEL_ID}>)`
        );
        return true;
    }

    const u = getOrCreateTcgUser(message.author.id);

    if (parsed.sub === 'hub') {
        await replyPanelSilent(message, buildHubPayload(message.member, u), message.author.id);
        return true;
    }

    if (parsed.sub === 'help') {
        await replyPanelSilent(message, buildHelpPayload(message.author.id), message.author.id);
        return true;
    }

    if (parsed.sub === 'guide') {
        await replyPanelSilent(message, buildGuidePayload(message.author.id, false), message.author.id);
        return true;
    }

    if (parsed.sub === 'credits') {
        await replyPanelSilent(message, buildCreditsPayload(message.author.id, false), message.author.id);
        return true;
    }

    if (parsed.sub === 'open') {
        await replyPanelSilent(message, buildOpenPromptPayload(message.member, u, false), message.author.id);
        return true;
    }

    if (parsed.sub === 'store') {
        await replyPanelSilent(message, buildStorePayload(message.member, u, false), message.author.id);
        return true;
    }

    if (parsed.sub === 'claim') {
        await replyPanelSilent(message, buildClaimPayload(message.member, u, false), message.author.id);
        return true;
    }

    if (parsed.sub === 'top') {
        await replyPanelSilent(message, {
            embeds: [buildTopEmbed(message.guild, 'total')],
            components: buildTopComponents(message.author.id, 'total', false)
        }, message.author.id);
        return true;
    }

    if (parsed.sub === 'notif') {
        await replyPanelSilent(message, buildNotifMenuPayload(message.member, u, false), message.author.id);
        return true;
    }

    if (parsed.sub === 'profil') {
        await replyPanelSilent(message, buildProfilePayload(message.member, u, false, false), message.author.id);
        return true;
    }

    if (parsed.sub === 'wishlist') {
        await handleWishlistCommand(message, message.member, parsed.rest);
        return true;
    }

    if (parsed.sub === 'classeur') {
        if (!parsed.rest) {
            const sent = await replyPanelSilent(message, '📖 Chargement de ton classeur RegaDex...', message.author.id);
            const payload = await buildBinderReplyPayload(message.member, message.author.id, { fromHub: false });
            await sent.edit({ content: null, ...payload });
            return true;
        }

        await resolveMemberArg(message, parsed.rest, async (targetMember) => {
            if (!targetMember) return;
            if (targetMember.id === message.author.id) {
                const sent = await replyPanelSilent(message, '📖 Chargement de ton classeur RegaDex...', message.author.id);
                const payload = await buildBinderReplyPayload(message.member, message.author.id, { fromHub: false });
                await sent.edit({ content: null, ...payload });
                return;
            }
            await sendBinderAccessWarning(message, message.author.id, targetMember);
        });
        return true;
    }

    if (parsed.sub === 'carte') {
        await handleCarteCommand(message, message.member, parsed.rest, message.channel);
        return true;
    }

    if (parsed.sub === 'flex') {
        await handleFlexCommand(message, message.member, message.guild, parsed.rest);
        return true;
    }

    if (parsed.sub === 'trade') {
        if (!parsed.rest) {
            await initiateTradePrompt(message, message.member, null);
            return true;
        }
        await resolveMemberArg(message, parsed.rest, async (targetMember) => {
            if (targetMember) await initiateTradePrompt(message, message.member, targetMember);
        });
        return true;
    }

    return false;
}

// ==========================================
//   COMMANDES SLASH (/regadex)
// ==========================================

async function handleTcgSlash(interaction) {
    if (interaction.commandName !== 'regadex') return false;

    const sub = interaction.options.getSubcommand();
    const member = interaction.member;

    if (!hasTcgRole(member)) {
        await interaction.reply({ content: `🔒 Le **RegaDex TCG** est réservé aux membres ayant le rôle <@&${TCG_ROLE_ID}> ! (Récupère-le dans <#${ROLE_CHANNEL_ID}> pour accéder à <#${TCG_CHANNEL_ID}>.)`, ephemeral: true });
        return true;
    }

    if (sub === 'flex' && !isAllowedFlexChannel(interaction.channel)) {
        await interaction.reply({ content: `⭐ La commande \`/regadex flex\` est uniquement autorisée dans <#${TCG_CHANNEL_ID}> et <#${SHITPOST_CHANNEL_ID}>.`, ephemeral: true });
        return true;
    }

    if (sub !== 'flex' && !isAllowedTcgChannel(interaction.channel)) {
        await interaction.reply({ content: `🃏 Le **RegaDex TCG** se joue exclusivement dans <#${TCG_CHANNEL_ID}> ! *(Seule la sous-commande \`/regadex flex\` est autorisée dans <#${TCG_CHANNEL_ID}> et <#${SHITPOST_CHANNEL_ID}>. Si tu n'y as pas accès, choisis ton rôle dans <#${ROLE_CHANNEL_ID}>.)*`, ephemeral: true });
        return true;
    }

    const u = getOrCreateTcgUser(interaction.user.id);

    if (sub === 'hub') {
        await replyPanelSilent(interaction, buildHubPayload(member, u), interaction.user.id);
        return true;
    }
    if (sub === 'open' || sub === 'booster' || sub === 'go') {
        await replyPanelSilent(interaction, buildOpenPromptPayload(member, u, false), interaction.user.id);
        return true;
    }
    if (sub === 'store') {
        await replyPanelSilent(interaction, buildStorePayload(member, u, false), interaction.user.id);
        return true;
    }
    if (sub === 'claim') {
        await replyPanelSilent(interaction, buildClaimPayload(member, u, false), interaction.user.id);
        return true;
    }
    if (sub === 'top') {
        await replyPanelSilent(interaction, {
            embeds: [buildTopEmbed(interaction.guild, 'total')],
            components: buildTopComponents(interaction.user.id, 'total', false)
        }, interaction.user.id);
        return true;
    }
    if (sub === 'notif') {
        await replyPanelSilent(interaction, buildNotifMenuPayload(member, u, false), interaction.user.id);
        return true;
    }
    if (sub === 'profil') {
        await replyPanelSilent(interaction, buildProfilePayload(member, u, false, false), interaction.user.id);
        return true;
    }
    if (sub === 'wishlist') {
        const cible = interaction.options.getMember('membre');
        if (cible && cible.id !== interaction.user.id) {
            await replyPanelSilent(interaction, buildWishlistPayload(cible, interaction.user.id, false, false), interaction.user.id);
            return true;
        }
        await replyPanelSilent(interaction, buildWishlistPayload(member, interaction.user.id, false, false), interaction.user.id);
        return true;
    }
    if (sub === 'classeur') {
        const cible = interaction.options.getMember('membre');
        if (!cible || cible.id === interaction.user.id) {
            await deferReplySilent(interaction);
            const payload = await buildBinderReplyPayload(member, interaction.user.id, { fromHub: false });
            const msg = await interaction.editReply(payload);
            schedulePanelAutoDelete(msg);
            return true;
        }
        await sendBinderAccessWarning(interaction, interaction.user.id, cible);
        return true;
    }
    if (sub === 'carte') {
        const q = interaction.options.getString('recherche') || '';
        await handleCarteCommand(interaction, member, q, interaction.channel);
        return true;
    }
    if (sub === 'trade') {
        const cible = interaction.options.getMember('membre');
        await initiateTradePrompt(interaction, member, cible || null);
        return true;
    }
    if (sub === 'flex') {
        const cible = interaction.options.getMember('membre');
        const modif = interaction.options.getString('modifier');
        if (modif) {
            await handleFlexCommand(interaction, member, interaction.guild, `modify ${modif}`);
        } else if (cible) {
            await handleFlexCommand(interaction, member, interaction.guild, cible);
        } else {
            await handleFlexCommand(interaction, member, interaction.guild, '');
        }
        return true;
    }

    return false;
}

// ==========================================
//   INTERACTIONS (BOUTONS, MENUS, MODALS, CONTEXT)
// ==========================================

async function handleTcgInteraction(interaction) {
    // 1. Menu Contextuel Utilisateur (Clic droit -> Applications -> 🔄 Échanger (RegaDex))
    if (interaction.isUserContextMenuCommand?.() && interaction.commandName === '🔄 Échanger (RegaDex)') {
        if (interaction.guildId !== GUILD_ID) {
            await interaction.reply({ content: "Réservé au serveur Regaïa !", ephemeral: true });
            return true;
        }
        if (!hasTcgRole(interaction.member)) {
            await interaction.reply({ content: `🔒 Tu dois posséder le rôle <@&${TCG_ROLE_ID}>.`, ephemeral: true });
            return true;
        }
        if (!isAllowedTcgChannel(interaction.channel)) {
            await interaction.reply({ content: `🃏 Lance les échanges dans <#${TCG_CHANNEL_ID}> !`, ephemeral: true });
            return true;
        }
        const targetMember = await interaction.guild.members.fetch(interaction.targetId).catch(() => null);
        await initiateTradePrompt(interaction, interaction.member, targetMember);
        return true;
    }

    const cid = interaction.customId;
    if (!cid || !cid.startsWith('tcg:')) return false;

    const parts = cid.split(':');
    const action = parts[1];
    const client = interaction.client;

    if (interaction.message?.id && panelAutoDeleteTimers.has(interaction.message.id) && action !== 'close') {
        schedulePanelAutoDelete(interaction.message);
    }

    // ----- FERMER UN MENU (+ MESSAGE DE COMMANDE SI RÉPONSE) -----
    if (action === 'close' && interaction.isButton()) {
        const ownerId = parts[2];
        if (!canControlTcgOwner(interaction.user.id, ownerId)) {
            await interaction.reply({ content: "Seul l'auteur de ce menu peut le fermer !", ephemeral: true });
            return true;
        }
        const msg = interaction.message;
        cancelPanelAutoDelete(msg?.id);
        if (msg?.flags?.has?.(MessageFlags.Ephemeral)) {
            await interaction.update({ content: '🗑️ Menu fermé.', embeds: [], components: [], files: [], attachments: [] }).catch(() => {});
            return true;
        }
        await interaction.deferUpdate().catch(() => {});
        const refId = msg?.reference?.messageId;
        if (refId && msg.channel) {
            const triggerMsg = await msg.channel.messages.fetch(refId).catch(() => null);
            if (triggerMsg && (triggerMsg.author?.id === interaction.user.id || canControlTcgOwner(interaction.user.id, triggerMsg.author?.id))) {
                await triggerMsg.delete().catch(() => {});
            }
        }
        await msg.delete().catch(() => {});
        return true;
    }

    // ----- RETOUR ACCUEIL HUB -----
    if (action === 'hub' && interaction.isButton()) {
        const ownerId = parts[2];
        if (!canControlTcgOwner(interaction.user.id, ownerId)) {
            await interaction.reply({ content: "Ce menu ne t'est pas destiné !", ephemeral: true });
            return true;
        }
        const msg = interaction.message;
        const isBoosterRecap = Boolean(
            msg?.id && (
                boosterSessions.has(msg.id) ||
                msg.embeds?.some(e =>
                    (typeof e?.title === 'string' && e.title.startsWith('📊 Récapitulatif du Booster')) ||
                    (typeof e?.title === 'string' && e.title.includes('RÉCAPITULATIF') && e.title.includes('GOD PACK'))
                )
            )
        );
        const u = getOrCreateTcgUser(ownerId);
        const actorMember = buildTcgMemberProxy(interaction.member, ownerId);

        if (isBoosterRecap) {
            const updatedRows = (msg.components || []).map(row => {
                const newRow = new ActionRowBuilder();
                for (const comp of row.components) {
                    const json = comp.toJSON();
                    if (json.custom_id && json.custom_id.startsWith('tcg:hub:')) {
                        json.disabled = true;
                    }
                    newRow.addComponents(ButtonBuilder.from(json));
                }
                return newRow;
            });
            await interaction.update({ components: updatedRows }).catch(() => {});
            const sentHub = interaction.channel
                ? await sendSilent(interaction.channel, buildHubPayload(actorMember, u)).catch(() => null)
                : null;
            if (sentHub) schedulePanelAutoDelete(sentHub);
            return true;
        }

        await interaction.deferUpdate();
        await interaction.editReply({
            content: null,
            ...buildHubPayload(actorMember, u),
            attachments: []
        });
        return true;
    }

    // ----- AIDE COMMANDES -----
    if (action === 'help' && interaction.isButton()) {
        const ownerId = parts[2];
        if (!canControlTcgOwner(interaction.user.id, ownerId)) {
            await interaction.reply({ content: "Pas pour toi 😌", ephemeral: true });
            return true;
        }
        await interaction.update({ content: null, files: [], attachments: [], ...buildHelpPayload(ownerId) });
        return true;
    }

    // ----- PROFIL REGADEX & STATS -----
    if (action === 'profile' && interaction.isButton()) {
        const ownerId = parts[2];
        const fromHub = parts[3] === '1';
        const showRarities = parts[4] === '1';
        if (!canControlTcgOwner(interaction.user.id, ownerId)) {
            await interaction.reply({ content: "Pas pour toi 😌", ephemeral: true });
            return true;
        }
        const u = getOrCreateTcgUser(ownerId);
        const actorMember = buildTcgMemberProxy(interaction.member, ownerId);
        await interaction.update({
            content: null,
            files: [],
            attachments: [],
            ...buildProfilePayload(actorMember, u, fromHub, showRarities)
        });
        return true;
    }

    // ----- DÉFINIR FLEX DEPUIS LE HUB -----
    if (action === 'hubflex' && interaction.isButton()) {
        const ownerId = parts[2];
        if (!canControlTcgOwner(interaction.user.id, ownerId)) {
            await interaction.reply({ content: "Pas pour toi 😌", ephemeral: true });
            return true;
        }
        const actorMember = buildTcgMemberProxy(interaction.member, ownerId);
        await sendFlexPicker(interaction, actorMember, 0);
        return true;
    }

    // ----- GUIDE -----
    if (action === 'guide' && interaction.isButton()) {
        const ownerId = parts[2];
        const fromHub = parts[3] === '1';
        if (!canControlTcgOwner(interaction.user.id, ownerId)) {
            await interaction.reply({ content: "Pas pour toi 😌", ephemeral: true });
            return true;
        }
        const payload = buildGuidePayload(ownerId, fromHub);
        await interaction.update({ content: null, files: [], attachments: [], ...payload });
        return true;
    }

    // ----- CRÉDITS -----
    if (action === 'credits' && interaction.isButton()) {
        const ownerId = parts[2];
        const fromHub = parts[3] === '1';
        if (!canControlTcgOwner(interaction.user.id, ownerId)) {
            await interaction.reply({ content: "Pas pour toi 😌", ephemeral: true });
            return true;
        }
        const payload = buildCreditsPayload(ownerId, fromHub);
        await interaction.update({ content: null, files: [], attachments: [], ...payload });
        return true;
    }

    // ----- OUVERTURE DE BOOSTER -----
    if (action === 'open' && interaction.isButton()) {
        const ownerId = parts[2];
        const fromHub = parts[3] === '1';
        if (!canControlTcgOwner(interaction.user.id, ownerId)) {
            await interaction.reply({ content: "Ce bouton ne t'est pas destiné !", ephemeral: true });
            return true;
        }
        const actorMember = buildTcgMemberProxy(interaction.member, ownerId);
        await startBoosterOpening(interaction, actorMember, client, fromHub);
        return true;
    }

    // ----- OUVERTURE BOOSTER 5 CARTES -----
    if (action === 'open5' && interaction.isButton()) {
        const ownerId = parts[2];
        const fromHub = parts[3] === '1';
        if (!canControlTcgOwner(interaction.user.id, ownerId)) {
            await interaction.reply({ content: "Ce bouton ne t'est pas destiné !", ephemeral: true });
            return true;
        }
        const actorMember = buildTcgMemberProxy(interaction.member, ownerId);
        await startBoosterOpening(interaction, actorMember, client, fromHub, 'five');
        return true;
    }

    // ----- NAVIGATION DANS LE BOOSTER -----
    if (action === 'bstep' && interaction.isButton()) {
        const dir = parts[2];
        const ownerId = parts[3];
        if (!canControlTcgOwner(interaction.user.id, ownerId)) {
            await interaction.reply({ content: "Ce booster ne t'appartient pas !", ephemeral: true });
            return true;
        }
        const session = boosterSessions.get(interaction.message.id);
        if (!session) {
            await interaction.reply({ content: "⏳ Session d'ouverture expirée.", ephemeral: true });
            return true;
        }
        if (dir === 'skip') {
            if (session.skipUsed) {
                await interaction.reply({ content: "⏭️ Le bouton Skip n'est utilisable qu'une seule fois par ouverture !", ephemeral: true });
                return true;
            }
            if (session.gifTimeout) {
                clearTimeout(session.gifTimeout);
                session.gifTimeout = null;
            }
            clearCard3AutoRecapTimer(session);
            boostersEnCours.delete(session.userId);
            session.skipUsed = true;
            session.hasReachedRecap = true;
            session.step = session.cards.length;
        } else if (dir === 'next') {
            session.step = Math.min(session.cards.length - 1, session.step + 1);
        } else if (dir === 'prev') {
            clearCard3AutoRecapTimer(session);
            session.step = Math.max(0, session.step - 1);
        } else if (dir === 'back3') {
            session.step = session.cards.length - 1;
        } else if (dir === 'recap') {
            clearCard3AutoRecapTimer(session);
            session.hasReachedRecap = true;
            session.step = session.cards.length;
        }

        await interaction.deferUpdate();
        const actorMember = buildTcgMemberProxy(interaction.member, ownerId);
        const stepPayload = await buildBoosterStepPayload(actorMember, session);
        await interaction.editReply({ content: null, ...stepPayload, attachments: [] });

        if (session.step < session.cards.length) {
            scheduleBoosterInspectTimeout(actorMember, session);
        }
        if (session.step === session.cards.length - 1 && !session.hasReachedRecap) {
            scheduleCard3AutoRecap(actorMember, session, client);
        } else if (session.hasReachedRecap) {
            await triggerSessionPantheonIfNeeded(client, actorMember, session).catch(() => {});
        }
        return true;
    }

    // ----- THÈME B/W DANS LE RÉCAPITULATIF DE BOOSTER -----
    if (action === 'brecap' && parts[2] === 'theme' && interaction.isButton()) {
        const ownerId = parts[3];
        if (!canControlTcgOwner(interaction.user.id, ownerId)) {
            await interaction.reply({ content: "Ce booster ne t'appartient pas !", ephemeral: true });
            return true;
        }
        const session = boosterSessions.get(interaction.message.id);
        if (!session) {
            await interaction.reply({ content: "⏳ Session d'ouverture expirée.", ephemeral: true });
            return true;
        }
        const u = getOrCreateTcgUser(ownerId);
        u.theme = u.theme === 'W' ? 'B' : 'W';
        if (!isSandboxId(ownerId)) tcgBridge.demanderSauvegarde();
        session.recapBuffer = null;
        session.recapTheme = null;

        await interaction.deferUpdate();
        const actorMember = buildTcgMemberProxy(interaction.member, ownerId);
        const stepPayload = await buildBoosterStepPayload(actorMember, session);
        await interaction.editReply({ content: null, ...stepPayload, attachments: [] });
        return true;
    }

    // ----- NOTIFICATIONS BOOSTER -----
    if (action === 'notif' && interaction.isButton()) {
        const sub = parts[2];
        const ownerId = parts[3];
        const fromHub = parts[4] === '1';
        const ephemeralMode = parts[4] === 'ephem';
        if (!canControlTcgOwner(interaction.user.id, ownerId)) {
            await interaction.reply({ content: "Pas pour toi 😌", ephemeral: true });
            return true;
        }
        if (isSandboxId(ownerId)) {
            await interaction.reply({ content: "ℹ️ Mode test `!tcgx` : les notifications sont désactivées *(boosters déjà illimités)*.", ephemeral: true });
            return true;
        }
        const data = getStoreData();
        const u = getOrCreateTcgUser(ownerId);
        const nextTs = getNextBoosterTimestamp(u);

        if (sub === 'menu') {
            if (fromHub) {
                await interaction.update({
                    content: null,
                    files: [],
                    attachments: [],
                    ...buildNotifMenuPayload(interaction.member, u, true, null, false)
                });
                return true;
            }
            await interaction.reply({
                ...buildNotifMenuPayload(interaction.member, u, false, null, true),
                ephemeral: true
            });
            return true;
        }

        const isNotifPanel = fromHub || ephemeralMode || interaction.message?.embeds?.[0]?.title?.startsWith('🔔 Notifications');

        if (sub === 'freq_each' || sub === 'freq_full') {
            u.notifFreq = sub === 'freq_full' ? 'full' : 'each';
            if (data.notifs[ownerId]) {
                data.notifs[ownerId].frequency = u.notifFreq;
                armerNotifBooster(ownerId, client);
            }
            tcgBridge.demanderSauvegarde();
            const note = u.notifFreq === 'full'
                ? '📦 *Mode sélectionné : **tous les 2 boosters (stock 2/2)**.*'
                : '🔔 *Mode sélectionné : **à chaque booster (1/2 puis 2/2)**.*';
            await interaction.update({
                content: null,
                files: [],
                attachments: [],
                ...buildNotifMenuPayload(interaction.member, u, fromHub, note, ephemeralMode)
            });
            return true;
        }

        if (sub === 'off') {
            if (notifTimers.has(ownerId)) {
                clearTimeout(notifTimers.get(ownerId));
                notifTimers.delete(ownerId);
            }
            delete data.notifs[ownerId];
            tcgBridge.demanderSauvegarde();
            if (isNotifPanel) {
                await interaction.update({
                    content: null,
                    files: [],
                    attachments: [],
                    ...buildNotifMenuPayload(interaction.member, u, fromHub, '🔕 *Notifications booster désactivées.*', ephemeralMode)
                });
                return true;
            }
            await interaction.reply({ content: "🔕 Notifications booster désactivées.", ephemeral: true });
            return true;
        }

        const chosenFreq = u.notifFreq === 'full' ? 'full' : 'each';
        const targetTs = nextTs ? (chosenFreq === 'full' ? getFullBoosterTimestamp(u) : nextTs) : null;
        data.notifs[ownerId] = {
            mode: sub === 'dm' ? 'dm' : 'channel',
            frequency: chosenFreq,
            channelId: interaction.channelId,
            notifyAt: targetTs
        };
        armerNotifBooster(ownerId, client);
        tcgBridge.demanderSauvegarde();

        const freqLabel = chosenFreq === 'full' ? 'tous les 2 boosters (2/2)' : 'à chaque booster';
        const modeLabel = sub === 'dm' ? 'en MP' : 'dans ce salon';
        const confirmNote = targetTs
            ? `✅ *C'est enregistré ! Je te préviendrai **${modeLabel}** (${freqLabel}) <t:${Math.floor(targetTs / 1000)}:R>, puis automatiquement à chaque futur cycle.*`
            : `✅ *C'est enregistré ! Ton stock est actuellement plein (**2/2**), je te préviendrai **${modeLabel}** (${freqLabel}) dès que tu ouvriras un booster.*`;

        if (isNotifPanel) {
            await interaction.update({
                content: null,
                files: [],
                attachments: [],
                ...buildNotifMenuPayload(interaction.member, u, fromHub, confirmNote, ephemeralMode)
            });
            return true;
        }

        await interaction.reply({
            content: confirmNote.replace(/\*/g, '**'),
            ephemeral: true
        });
        await disableNotifButtonsOnMessage(interaction.message);
        return true;
    }

    // ----- THÈME HUB -----
    if (action === 'theme' && interaction.isButton()) {
        const ownerId = parts[2];
        if (!canControlTcgOwner(interaction.user.id, ownerId)) {
            await interaction.reply({ content: "Ce bouton ne t'est pas destiné !", ephemeral: true });
            return true;
        }
        const u = getOrCreateTcgUser(ownerId);
        u.theme = u.theme === 'W' ? 'B' : 'W';
        if (!isSandboxId(ownerId)) tcgBridge.demanderSauvegarde();
        const actorMember = buildTcgMemberProxy(interaction.member, ownerId);
        await interaction.update({ embeds: [buildHubEmbed(actorMember, u)], components: buildHubComponents(ownerId, u) });
        return true;
    }

    // ----- STORE & ACHATS & CLAIM -----
    if (action === 'store' && interaction.isButton()) {
        const ownerId = parts[3];
        const fromHub = parts[4] === '1';
        if (!canControlTcgOwner(interaction.user.id, ownerId)) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true }), true;
        const u = getOrCreateTcgUser(ownerId);
        const actorMember = buildTcgMemberProxy(interaction.member, ownerId);
        const payload = buildStorePayload(actorMember, u, fromHub);
        await interaction.update({ content: null, files: [], attachments: [], ...payload });
        return true;
    }

    if (action === 'claim' && interaction.isButton()) {
        const ownerId = parts[3];
        const fromHub = parts[4] === '1';
        if (!canControlTcgOwner(interaction.user.id, ownerId)) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true }), true;
        const u = getOrCreateTcgUser(ownerId);
        const actorMember = buildTcgMemberProxy(interaction.member, ownerId);
        const payload = buildClaimPayload(actorMember, u, fromHub);
        await interaction.update({ content: null, files: [], attachments: [], ...payload });
        return true;
    }

    if (action === 'buyholocancel' && interaction.isButton()) {
        const ownerId = parts[2];
        if (!canControlTcgOwner(interaction.user.id, ownerId)) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true }), true;
        await interaction.update({ content: '❌ Achat annulé.', embeds: [], components: [] });
        return true;
    }

    if (action === 'buyholoconf' && interaction.isButton()) {
        const ownerId = parts[2];
        const fromHub = parts[3] === '1';
        const storeMsgId = parts[4] || '';
        const hubSuffix = fromHub ? ':1' : '';
        if (!canControlTcgOwner(interaction.user.id, ownerId)) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true }), true;

        const price = STORE_PRICES.holoTransform;
        const u = getOrCreateTcgUser(ownerId);
        if (u.points < price) {
            await interaction.update({ content: "❌ Tu n'as plus assez de points RegaDex !", embeds: [], components: [] });
            return true;
        }

        u.points -= price;
        u.inventory.holoTransform = (u.inventory.holoTransform || 0) + 1;
        if (!isSandboxId(ownerId)) {
            tcgBridge.trackBattlePassProgress(ownerId, 'tcg_store_buy', 1);
            tcgBridge.demanderSauvegarde();
        }

        if (storeMsgId && interaction.channel) {
            const storeMsg = await interaction.channel.messages.fetch(storeMsgId).catch(() => null);
            if (storeMsg) {
                const actorMember = buildTcgMemberProxy(interaction.member, ownerId);
                await storeMsg.edit(buildStorePayload(actorMember, u, fromHub)).catch(() => {});
            }
        }

        const doneEmbed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('✅ Achat effectué dans le RegaDex Store !')
            .setDescription(
                `Tu as acheté : **✨ Transformer une carte en Holographique** pour \`${price} pts\` *(Solde restant : **${u.points} pts**)*.` +
                `\n\nSouhaites-tu l'utiliser tout de suite ou le garder dans ton inventaire (\`!regadex claim\`) ?`
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`tcg:postbuy:use:holoTransform:${ownerId}${hubSuffix}`)
                .setLabel('Activer maintenant')
                .setEmoji('⚡')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`tcg:postbuy:keep:holoTransform:${ownerId}${hubSuffix}`)
                .setLabel('Garder en inventaire')
                .setEmoji('🎒')
                .setStyle(ButtonStyle.Secondary)
        );
        await interaction.update({ content: null, embeds: [doneEmbed], components: [row] });
        return true;
    }

    if (action === 'buynegconf' && interaction.isButton()) {
        const ownerId = parts[2];
        const fromHub = parts[3] === '1';
        const storeMsgId = parts[4] || '';
        const hubSuffix = fromHub ? ':1' : '';
        if (!canControlTcgOwner(interaction.user.id, ownerId)) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true }), true;

        const price = STORE_PRICES.negativeTransform;
        const u = getOrCreateTcgUser(ownerId);
        if (u.points < price) {
            await interaction.update({ content: "❌ Tu n'as plus assez de points RegaDex !", embeds: [], components: [] });
            return true;
        }

        u.points -= price;
        u.inventory.negativeTransform = (u.inventory.negativeTransform || 0) + 1;
        if (!isSandboxId(ownerId)) {
            tcgBridge.trackBattlePassProgress(ownerId, 'tcg_store_buy', 1);
            tcgBridge.demanderSauvegarde();
        }

        if (storeMsgId && interaction.channel) {
            const storeMsg = await interaction.channel.messages.fetch(storeMsgId).catch(() => null);
            if (storeMsg) {
                const actorMember = buildTcgMemberProxy(interaction.member, ownerId);
                await storeMsg.edit(buildStorePayload(actorMember, u, fromHub)).catch(() => {});
            }
        }

        const doneEmbed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('✅ Achat effectué dans le RegaDex Store !')
            .setDescription(
                `Tu as acheté : **🕳️ Transformer une Full Art en Négative** pour \`${price} pts\` *(Solde restant : **${u.points} pts**)*.` +
                `\n\nSouhaites-tu l'utiliser tout de suite ou le garder dans ton inventaire (\`!regadex claim\`) ?`
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`tcg:postbuy:use:negativeTransform:${ownerId}${hubSuffix}`)
                .setLabel('Activer maintenant')
                .setEmoji('⚡')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`tcg:postbuy:keep:negativeTransform:${ownerId}${hubSuffix}`)
                .setLabel('Garder en inventaire')
                .setEmoji('🎒')
                .setStyle(ButtonStyle.Secondary)
        );
        await interaction.update({ content: null, embeds: [doneEmbed], components: [row] });
        return true;
    }

    if (action === 'buy' && interaction.isButton()) {
        const itemKey = parts[2];
        const ownerId = parts[3];
        const fromHub = parts[4] === '1';
        const hubSuffix = fromHub ? ':1' : '';
        if (!canControlTcgOwner(interaction.user.id, ownerId)) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true }), true;

        const price = STORE_PRICES[itemKey];
        const u = getOrCreateTcgUser(ownerId);
        if (!price || u.points < price) {
            await interaction.reply({ content: "❌ Tu n'as pas assez de points RegaDex !", ephemeral: true });
            return true;
        }

        if (itemKey === 'holoTransform') {
            const compatibleCount = cardCatalog.filter(c =>
                !c.isHolo &&
                c.holoCounterpartId &&
                (u.cards?.[c.id] || 0) >= 1
            ).length;
            const confEmbed = new EmbedBuilder()
                .setColor(compatibleCount > 0 ? 0xf1c40f : 0xe67e22)
                .setTitle('✨ Confirmation — Transformation Holographique')
                .setDescription(
                    `🪙 **Coût :** \`${price} pts\` *(Solde actuel : **${u.points} pts**)*\n` +
                    `🃏 **Cartes disponibles à transformer :** **${compatibleCount}** carte${compatibleCount > 1 ? 's' : ''}\n\n` +
                    (compatibleCount === 0
                        ? `⚠️ *Tu ne possèdes actuellement aucune carte compatible (non-Holo avec version Holographique). L'objet restera dans ton inventaire pour plus tard.*\n\n`
                        : '') +
                    `Confirmer cet achat ?`
                );
            const confRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`tcg:buyholoconf:${ownerId}:${fromHub ? '1' : '0'}:${interaction.message?.id || ''}`)
                    .setLabel(`Confirmer (${price} pts)`)
                    .setEmoji('✅')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`tcg:buyholocancel:${ownerId}`)
                    .setLabel('Annuler')
                    .setEmoji('❌')
                    .setStyle(ButtonStyle.Secondary)
            );
            await interaction.reply({ embeds: [confEmbed], components: [confRow], ephemeral: true });
            return true;
        }

        if (itemKey === 'negativeTransform') {
            const compatibleCount = cardCatalog.filter(c =>
                c.rarity === 'Full Art' &&
                !c.isHolo &&
                c.negativeCounterpartId &&
                (u.cards?.[c.id] || 0) >= 1
            ).length;
            const confEmbed = new EmbedBuilder()
                .setColor(compatibleCount > 0 ? 0x2ecc71 : 0xe67e22)
                .setTitle('🕳️ Confirmation — Transformation Négative')
                .setDescription(
                    `🪙 **Coût :** \`${price} pts\` *(Solde actuel : **${u.points} pts**)*\n` +
                    `🌈 **Full Art disponibles à transformer :** **${compatibleCount}** carte${compatibleCount > 1 ? 's' : ''}\n\n` +
                    (compatibleCount === 0
                        ? `⚠️ *Tu ne possèdes actuellement aucune Full Art compatible. L'objet restera dans ton inventaire pour plus tard.*\n\n`
                        : '') +
                    `Confirmer cet achat ?`
                );
            const confRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`tcg:buynegconf:${ownerId}:${fromHub ? '1' : '0'}:${interaction.message?.id || ''}`)
                    .setLabel(`Confirmer (${price} pts)`)
                    .setEmoji('✅')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`tcg:buyholocancel:${ownerId}`)
                    .setLabel('Annuler')
                    .setEmoji('❌')
                    .setStyle(ButtonStyle.Secondary)
            );
            await interaction.reply({ embeds: [confEmbed], components: [confRow], ephemeral: true });
            return true;
        }

        u.points -= price;
        u.inventory[itemKey] = (u.inventory[itemKey] || 0) + 1;

        if (!isSandboxId(ownerId)) {
            if (itemKey !== 'booster') {
                tcgBridge.trackBattlePassProgress(ownerId, 'tcg_store_buy', 1);
            }
            tcgBridge.demanderSauvegarde();
        }

        const labels = {
            booster: `🎁 Booster ${SET1_NAME}`,
            luckyBooster: '🍀 Prochain booster chanceux',
            fiveCardBooster: '🎴 Booster 5 cartes',
            holoTransform: '✨ Transformer une carte en Holographique',
            halfCooldown: '⚡ Diviser le cooldown du prochain booster par 2',
            godPackBoost: '🌟 Taux de God Pack ×5 (5j)'
        };

        const isBoosterBuy = itemKey === 'booster' || itemKey === 'fiveCardBooster';
        const confirmEmbed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('✅ Achat effectué dans le RegaDex Store !')
            .setDescription(
                `Tu as acheté : **${labels[itemKey]}** pour \`${price} pts\` *(Solde restant : **${u.points} pts**)*.` +
                (isBoosterBuy
                    ? (itemKey === 'fiveCardBooster'
                        ? `\n\n🎴 Il est **prêt à ouvrir** ! *(Boosters 5 cartes en stock : **${u.inventory.fiveCardBooster}**)*`
                        : `\n\n🎁 Il est **prêt à ouvrir** ! *(Total disponible : **${getTotalAvailableBoosters(u)}**)*`)
                    : (itemKey === 'godPackBoost'
                        ? `\n\n🎲 **Probabilités :** tes chances de tirer un **God Pack** passent de **1% à 5%** *(×5)* pendant **5 jours**.\n👤 **Bonus personnel :** il s'applique **uniquement à tes propres boosters**.`
                        : '') +
                      `\n\nSouhaites-tu l'utiliser tout de suite ou le garder dans ton inventaire (\`!regadex claim\`) ?`)
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`tcg:postbuy:use:${itemKey}:${ownerId}${hubSuffix}`)
                .setLabel(isBoosterBuy ? 'Ouvrir maintenant' : 'Activer maintenant')
                .setEmoji(isBoosterBuy ? '🎁' : '⚡')
                .setStyle(ButtonStyle.Success)
        );
        if (!isBoosterBuy) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`tcg:postbuy:keep:${itemKey}:${ownerId}${hubSuffix}`)
                    .setLabel('Garder en inventaire')
                    .setEmoji('🎒')
                    .setStyle(ButtonStyle.Secondary)
            );
        }
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`tcg:store:open:${ownerId}:1`)
                .setLabel('Store')
                .setEmoji('🛒')
                .setStyle(ButtonStyle.Secondary),
            buildAccueilButton(ownerId),
            buildCloseButton(ownerId)
        );

        await interaction.update({ content: null, embeds: [confirmEmbed], components: [row], files: [], attachments: [] });
        return true;
    }

    if (action === 'postbuy' && interaction.isButton()) {
        const sub = parts[2];
        const itemKey = parts[3];
        const ownerId = parts[4];
        const fromHub = parts[5] === '1';
        if (!canControlTcgOwner(interaction.user.id, ownerId)) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true }), true;
        const actorMember = buildTcgMemberProxy(interaction.member, ownerId);

        const backRows = [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`tcg:store:open:${ownerId}:1`).setLabel('Retour Store').setEmoji('🛒').setStyle(ButtonStyle.Secondary),
                buildAccueilButton(ownerId),
                buildCloseButton(ownerId)
            )
        ];

        if (sub === 'keep') {
            await interaction.update({
                content: "🎒 Parfait ! L'objet reste bien au chaud dans ton inventaire (`!regadex claim`).",
                embeds: [],
                components: backRows,
                files: [],
                attachments: []
            });
            return true;
        }

        const u = getOrCreateTcgUser(ownerId);
        if ((u.inventory[itemKey] || 0) <= 0) {
            await interaction.reply({ content: "❌ Cet objet n'est plus dans ton inventaire.", ephemeral: true });
            return true;
        }

        if (itemKey === 'booster') {
            await startBoosterOpening(interaction, actorMember, client, fromHub);
            return true;
        }
        if (itemKey === 'fiveCardBooster') {
            await startBoosterOpening(interaction, actorMember, client, fromHub, 'five');
            return true;
        }
        if (itemKey === 'negativeTransform') {
            await sendNegativeTransformPicker(interaction, actorMember, 0, fromHub);
            return true;
        }
        if (itemKey === 'luckyBooster') {
            if (u.activeBonuses.luckyBooster) {
                await interaction.reply({ content: "⚠️ Tu as déjà un bonus **Chanceux** actif pour ton prochain booster !", ephemeral: true });
                return true;
            }
            u.inventory.luckyBooster -= 1;
            u.activeBonuses.luckyBooster = true;
            if (!isSandboxId(ownerId)) tcgBridge.demanderSauvegarde();
            await interaction.update({
                content: "🍀 **Prochain booster chanceux activé !** Aucune carte Commune ne tombera dans ton prochain booster.",
                embeds: [],
                components: backRows,
                files: [],
                attachments: []
            });
            return true;
        }
        if (itemKey === 'halfCooldown') {
            if (u.activeBonuses.halfCooldown) {
                await interaction.reply({ content: "⚠️ Tu as déjà un bonus **Demi-cooldown** armé pour ton prochain booster !", ephemeral: true });
                return true;
            }
            u.inventory.halfCooldown -= 1;
            u.activeBonuses.halfCooldown = true;
            if (!isSandboxId(ownerId)) tcgBridge.demanderSauvegarde();
            await interaction.update({
                content: "⚡ **Demi-cooldown armé !** Dès l'ouverture de ton prochain booster, le suivant mettra **3h** au lieu de 6h.",
                embeds: [],
                components: backRows,
                files: [],
                attachments: []
            });
            return true;
        }
        if (itemKey === 'godPackBoost') {
            if (u.activeBonuses.godPackBoostUntil && Date.now() < u.activeBonuses.godPackBoostUntil) {
                await interaction.reply({
                    content: `⚠️ Ton bonus **God Pack ×5** est déjà actif jusqu'au <t:${Math.floor(u.activeBonuses.godPackBoostUntil / 1000)}:F> !`,
                    ephemeral: true
                });
                return true;
            }
            u.inventory.godPackBoost -= 1;
            u.activeBonuses.godPackBoostUntil = Date.now() + GOD_PACK_BOOST_DURATION_MS;
            if (!isSandboxId(ownerId)) tcgBridge.demanderSauvegarde();
            await interaction.update({
                content: `🌟 **Taux de God Pack ×5 (1% → 5%) activé pour 5 jours !** *(fin <t:${Math.floor(u.activeBonuses.godPackBoostUntil / 1000)}:R>)*`,
                embeds: [],
                components: backRows,
                files: [],
                attachments: []
            });
            return true;
        }
        if (itemKey === 'holoTransform') {
            await sendHoloTransformPicker(interaction, actorMember, 0, fromHub);
            return true;
        }
    }

    if (action === 'use' && interaction.isButton()) {
        const itemKey = parts[2];
        const ownerId = parts[3];
        const fromHub = parts[4] === '1';
        if (!canControlTcgOwner(interaction.user.id, ownerId)) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true }), true;
        const u = getOrCreateTcgUser(ownerId);
        if ((u.inventory[itemKey] || 0) <= 0) return interaction.reply({ content: "❌ Stock insuffisant.", ephemeral: true }), true;
        const actorMember = buildTcgMemberProxy(interaction.member, ownerId);

        if (itemKey === 'negativeTransform') {
            await sendNegativeTransformPicker(interaction, actorMember, 0, fromHub);
            return true;
        }
        if (itemKey === 'luckyBooster') {
            if (u.activeBonuses.luckyBooster) return interaction.reply({ content: "⚠️ Déjà actif sur ton prochain booster !", ephemeral: true }), true;
            u.inventory.luckyBooster -= 1;
            u.activeBonuses.luckyBooster = true;
            if (!isSandboxId(ownerId)) tcgBridge.demanderSauvegarde();
            await interaction.update(buildClaimPayload(actorMember, u, fromHub));
            await interaction.followUp({ content: "🍀 **Prochain booster chanceux activé !**", ephemeral: true });
            return true;
        }
        if (itemKey === 'halfCooldown') {
            if (u.activeBonuses.halfCooldown) return interaction.reply({ content: "⚠️ Déjà armé sur ton prochain booster !", ephemeral: true }), true;
            u.inventory.halfCooldown -= 1;
            u.activeBonuses.halfCooldown = true;
            if (!isSandboxId(ownerId)) tcgBridge.demanderSauvegarde();
            await interaction.update(buildClaimPayload(actorMember, u, fromHub));
            await interaction.followUp({ content: "⚡ **Demi-cooldown armé !**", ephemeral: true });
            return true;
        }
        if (itemKey === 'godPackBoost') {
            if (u.activeBonuses.godPackBoostUntil && Date.now() < u.activeBonuses.godPackBoostUntil) {
                return interaction.reply({
                    content: `⚠️ Ton bonus **God Pack ×5** est déjà actif jusqu'au <t:${Math.floor(u.activeBonuses.godPackBoostUntil / 1000)}:F> !`,
                    ephemeral: true
                }), true;
            }
            u.inventory.godPackBoost -= 1;
            u.activeBonuses.godPackBoostUntil = Date.now() + GOD_PACK_BOOST_DURATION_MS;
            if (!isSandboxId(ownerId)) tcgBridge.demanderSauvegarde();
            await interaction.update(buildClaimPayload(actorMember, u, fromHub));
            await interaction.followUp({
                content: `🌟 **Taux de God Pack ×5 (1% → 5%) activé pour 5 jours !** *(fin <t:${Math.floor(u.activeBonuses.godPackBoostUntil / 1000)}:R>)*`,
                ephemeral: true
            });
            return true;
        }
        if (itemKey === 'holoTransform') {
            await sendHoloTransformPicker(interaction, actorMember, 0, fromHub);
            return true;
        }
    }

    if (action === 'negpage' && interaction.isButton()) {
        const ownerId = parts[2];
        const page = parseInt(parts[3], 10) || 0;
        const fromHub = parts[4] === '1';
        if (!canControlTcgOwner(interaction.user.id, ownerId)) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true }), true;
        const actorMember = buildTcgMemberProxy(interaction.member, ownerId);
        await sendNegativeTransformPicker(interaction, actorMember, page, fromHub);
        return true;
    }

    if (action === 'negpick' && interaction.isStringSelectMenu()) {
        const ownerId = parts[2];
        if (!canControlTcgOwner(interaction.user.id, ownerId)) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true }), true;

        const baseId = interaction.values[0];
        const baseCard = cardById.get(baseId);
        const negCard = baseCard?.negativeCounterpartId ? cardById.get(baseCard.negativeCounterpartId) : null;
        const u = getOrCreateTcgUser(ownerId);

        if (!baseCard || !negCard || baseCard.rarity !== 'Full Art' || (u.cards[baseId] || 0) < 1 || (u.inventory.negativeTransform || 0) < 1) {
            await interaction.reply({ content: "❌ Transformation impossible (carte ou bonus manquant).", ephemeral: true });
            return true;
        }

        const wasNew = (u.cards[negCard.id] || 0) === 0;
        u.inventory.negativeTransform -= 1;
        u.cards[baseId] -= 1;
        if (u.cards[baseId] <= 0) {
            delete u.cards[baseId];
            if (u.favoriteCardId === baseId) u.favoriteCardId = null;
        }
        u.cards[negCard.id] = (u.cards[negCard.id] || 0) + 1;
        const negMilestones = checkAndGrantCompletionMilestones(ownerId, baseCard.setNumber || DEFAULT_SET_NUMBER);
        if (!isSandboxId(ownerId)) tcgBridge.demanderSauvegarde();
        for (const sNum of (negMilestones.masteredSets || [])) {
            await envoyerMaitreDuSetPantheonTcg(client, interaction.member, sNum).catch(() => {});
        }

        const msTxt = negMilestones.unlocked.length > 0
            ? `\n\n🏆 **Palier(s) de complétion atteint(s) :** ${negMilestones.unlocked.map(m => `**${m.pct}%** (+${m.reward} pts${m.pct === 100 ? ' & +2 Boosters de Maître' : ''})`).join(', ')}`
            : '';

        const embed = new EmbedBuilder()
            .setColor(RARITY_META['Négative']?.color || 0x2ecc71)
            .setTitle('🕳️ Transformation Négative réussie !')
            .setDescription(
                `Ta carte **${baseCard.id} • ${baseCard.name}** a basculé en **${negCard.id} • ${negCard.name}** !` +
                `${wasNew ? '\n🆕 **NOUVELLE CARTE AJOUTÉE AU REGADEX !**' : ''}${msTxt}`
            )
            .setImage('attachment://negative_result.png');

        const files = negCard.filePath && fs.existsSync(negCard.filePath)
            ? [new AttachmentBuilder(negCard.filePath, { name: 'negative_result.png' })]
            : [];
        const resultRows = [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`tcg:claim:open:${ownerId}:1`).setLabel('Inventaire').setEmoji('🎒').setStyle(ButtonStyle.Secondary),
                buildAccueilButton(ownerId),
                buildCloseButton(ownerId)
            )
        ];

        await interaction.deferUpdate();
        await interaction.editReply({ content: null, embeds: [embed], files, attachments: [], components: resultRows });
        envoyerTransfoNegativeTcg(client, interaction.member, baseCard, negCard, wasNew).catch(() => {});
        return true;
    }

    if (action === 'holopage' && interaction.isButton()) {
        const ownerId = parts[2];
        const page = parseInt(parts[3], 10) || 0;
        const fromHub = parts[4] === '1';
        if (!canControlTcgOwner(interaction.user.id, ownerId)) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true }), true;
        const actorMember = buildTcgMemberProxy(interaction.member, ownerId);
        await sendHoloTransformPicker(interaction, actorMember, page, fromHub);
        return true;
    }

    if (action === 'holopick' && interaction.isStringSelectMenu()) {
        const ownerId = parts[2];
        if (!canControlTcgOwner(interaction.user.id, ownerId)) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true }), true;

        const baseId = interaction.values[0];
        const baseCard = cardById.get(baseId);
        const holoCard = baseCard?.holoCounterpartId ? cardById.get(baseCard.holoCounterpartId) : null;
        const u = getOrCreateTcgUser(ownerId);

        if (!baseCard || !holoCard || (u.cards[baseId] || 0) < 1 || (u.inventory.holoTransform || 0) < 1) {
            await interaction.reply({ content: "❌ Transformation impossible (carte ou bonus manquant).", ephemeral: true });
            return true;
        }

        u.inventory.holoTransform -= 1;
        u.cards[baseId] -= 1;
        if (u.cards[baseId] === 0) delete u.cards[baseId];
        u.cards[holoCard.id] = (u.cards[holoCard.id] || 0) + 1;
        const holoMilestones = checkAndGrantCompletionMilestones(ownerId, baseCard.setNumber || DEFAULT_SET_NUMBER);
        if (!isSandboxId(ownerId)) tcgBridge.demanderSauvegarde();
        for (const sNum of (holoMilestones.masteredSets || [])) {
            await envoyerMaitreDuSetPantheonTcg(client, interaction.member, sNum).catch(() => {});
        }

        const msTxt = holoMilestones.unlocked.length > 0
            ? `\n\n🏆 **Palier(s) de complétion atteint(s) :** ${holoMilestones.unlocked.map(m => `**${m.pct}%** (+${m.reward} pts${m.pct === 100 ? ' & +2 Boosters de Maître' : ''})`).join(', ')}`
            : '';

        const embed = new EmbedBuilder()
            .setColor(RARITY_META[holoCard.rarity]?.color || 0xf1c40f)
            .setTitle('✨ Transformation Holographique réussie !')
            .setDescription(`Ta carte **${baseCard.id} • ${baseCard.name}** a évolué en **${holoCard.id} • ${holoCard.name}** !${msTxt}`)
            .setImage('attachment://holo_result.png');

        const files = holoCard.filePath && fs.existsSync(holoCard.filePath)
            ? [new AttachmentBuilder(holoCard.filePath, { name: 'holo_result.png' })]
            : [];
        const resultRows = [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`tcg:claim:open:${ownerId}:1`).setLabel('Inventaire').setEmoji('🎒').setStyle(ButtonStyle.Secondary),
                buildAccueilButton(ownerId),
                buildCloseButton(ownerId)
            )
        ];

        await interaction.deferUpdate();
        await interaction.editReply({ content: null, embeds: [embed], files, attachments: [], components: resultRows });
        return true;
    }

    // ----- CLASSEUR (NAVIGATION, FILTRE, TRI, PERMISSION) -----
    if (action === 'binder') {
        const sub = parts[2];

        if (sub === 'pickuser' && interaction.isUserSelectMenu()) {
            const viewerId = parts[3];
            if (!canControlTcgOwner(interaction.user.id, viewerId)) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true }), true;
            const targetId = interaction.values[0];
            if (targetId === viewerId) {
                await deferReplySilent(interaction);
                const actorMember = buildTcgMemberProxy(interaction.member, viewerId);
                const payload = await buildBinderReplyPayload(actorMember, viewerId, { fromHub: false });
                await interaction.editReply(payload);
                return true;
            }
            const realRequesterId = isSandboxId(viewerId) ? interaction.user.id : viewerId;
            const targetMember = await interaction.guild.members.fetch(targetId).catch(() => ({ id: targetId, displayName: 'ce membre' }));
            await sendBinderAccessWarning(interaction, realRequesterId, targetMember);
            return true;
        }

        if (sub === 'ask' && interaction.isButton()) {
            const targetId = parts[3];
            const viewerId = parts[4];
            if (interaction.user.id !== viewerId) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true }), true;
            const targetMember = await interaction.guild.members.fetch(targetId).catch(() => ({ id: targetId, displayName: 'ce membre' }));
            await sendBinderAccessWarning(interaction, viewerId, targetMember);
            return true;
        }

        if (sub === 'cancelask' && interaction.isButton()) {
            const viewerId = parts[3];
            if (interaction.user.id !== viewerId) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true }), true;
            await interaction.update({ content: '❌ Demande de consultation annulée.', embeds: [], components: [] });
            return true;
        }

        if (sub === 'confirm' && interaction.isButton()) {
            const targetId = parts[3];
            const viewerId = parts[4];
            if (interaction.user.id !== viewerId) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true }), true;

            await interaction.update({ content: `📨 Demande envoyée à <@${targetId}> *(avec mention)* !`, embeds: [], components: [] });

            const embed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle('📖 Demande de consultation de classeur')
                .setDescription(`<@${viewerId}> demande l'autorisation de consulter le classeur RegaDex de <@${targetId}>.`);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`tcg:binder:allow:${targetId}:${viewerId}`).setLabel('Autoriser l\'accès').setEmoji('✅').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`tcg:binder:deny:${targetId}:${viewerId}`).setLabel('Refuser').setEmoji('❌').setStyle(ButtonStyle.Danger)
            );

            // Envoi NON silencieux pour que la personne soit réellement mentionnée / notifiée
            await interaction.channel.send({
                content: `<@${targetId}>`,
                embeds: [embed],
                components: [row],
                allowedMentions: { users: [targetId] }
            });
            return true;
        }

        if ((sub === 'allow' || sub === 'deny') && interaction.isButton()) {
            const ownerId = parts[3];
            const viewerId = parts[4];
            if (interaction.user.id !== ownerId) {
                await interaction.reply({ content: `Seul <@${ownerId}> peut répondre à cette demande !`, ephemeral: true });
                return true;
            }
            if (sub === 'deny') {
                await interaction.update({ content: `❌ <@${ownerId}> a refusé l'accès à son classeur.`, embeds: [], components: [] });
                schedulePanelAutoDelete(interaction.message);
                return true;
            }
            await interaction.deferUpdate();
            const ownerMember = await interaction.guild.members.fetch(ownerId).catch(() => interaction.member);
            const payload = await buildBinderReplyPayload(ownerMember, viewerId, { fromHub: false });
            const edited = await interaction.editReply({ content: null, ...payload, attachments: [] });
            schedulePanelAutoDelete(edited || interaction.message);
            return true;
        }

        if (sub === 'open' && interaction.isButton()) {
            const ownerId = parts[3];
            const viewerId = parts[4];
            const fromHub = parts[5] === '1';
            if (!canControlTcgOwner(interaction.user.id, viewerId)) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true }), true;

            const ownerMember = isSandboxId(ownerId)
                ? buildTcgMemberProxy(interaction.member, TCGX_SANDBOX_ID)
                : await interaction.guild.members.fetch(ownerId).catch(() => interaction.member);

            if (fromHub) {
                await interaction.deferUpdate();
                const payload = await buildBinderReplyPayload(ownerMember, viewerId, { fromHub: true });
                await interaction.editReply({ content: null, ...payload, attachments: [] });
            } else {
                await deferReplySilent(interaction);
                const payload = await buildBinderReplyPayload(ownerMember, viewerId, { fromHub: false });
                await interaction.editReply(payload);
            }
            return true;
        }
    }

    if (action === 'binspect' && interaction.isButton()) {
        const ownerId = parts[2];
        const viewerId = parts[3];
        const category = parts[4];
        const perPageMode = parts[5];
        const page = parseInt(parts[6], 10) || 0;
        const sortMode = parts[7];
        const rarityFilter = parts[8] || 'all';
        const fromHub = parts[9] === '1';
        const ownedMode = normalizeBinderOwnedMode(parts[10]);

        if (!canControlTcgOwner(interaction.user.id, viewerId) && !canControlTcgOwner(interaction.user.id, ownerId)) {
            await interaction.reply({ content: "Ce classeur n'est pas à toi !", ephemeral: true });
            return true;
        }
        if (!canControlTcgOwner(interaction.user.id, ownerId)) {
            await interaction.reply({ content: "🔒 Tu ne peux inspecter en grand format que les cartes de ton propre classeur (anti-spoiler) !", ephemeral: true });
            return true;
        }

        const uOwner = getOrCreateTcgUser(ownerId);
        const cardsList = getFilteredSortedCards(category, sortMode, uOwner, ownedMode, rarityFilter);
        const grid = getBinderGridConfig(perPageMode, cardsList.length);
        const totalPages = Math.max(1, Math.ceil(cardsList.length / grid.perPage));
        const safePage = Math.max(0, Math.min(page, totalPages - 1));
        const slice = cardsList.slice(safePage * grid.perPage, (safePage + 1) * grid.perPage);
        const ownedOnPage = slice.filter(c => (uOwner.cards?.[c.id] || 0) > 0);

        if (ownedOnPage.length === 0) {
            await interaction.reply({ content: "🔒 Tu ne possèdes aucune carte sur cette page du classeur à inspecter !", ephemeral: true });
            return true;
        }

        const now = Date.now();
        for (const [k, v] of binderReturnStates.entries()) {
            if (now > (v.expiresAt || 0)) binderReturnStates.delete(k);
        }
        binderReturnStates.set(interaction.message.id, {
            ownerId,
            viewerId,
            category,
            perPageMode,
            page: safePage,
            sortMode,
            rarityFilter,
            ownedMode,
            fromHub,
            expiresAt: now + 30 * 60 * 1000
        });

        const menu = new StringSelectMenuBuilder()
            .setCustomId(`tcg:binsel:${interaction.message.id}:${ownerId}:${viewerId}`)
            .setPlaceholder('Choisis une carte possédée à inspecter...')
            .addOptions(ownedOnPage.slice(0, 25).map(c => ({
                label: `${c.id} • ${c.name}`.slice(0, 100),
                description: `${c.rarity} • Possédées : x${uOwner.cards[c.id]}`.slice(0, 100),
                value: c.id
            })));

        const content = ownedOnPage.length > 25
            ? '🔎 **Choisis la carte à inspecter** *(25 premières cartes possédées de cette vue — change de grille ou utilise les filtres si besoin)* :'
            : '🔎 **Choisis une carte possédée de cette page à inspecter :**';
        await interaction.reply({ content, components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
        return true;
    }

    if (action === 'binsel' && interaction.isStringSelectMenu()) {
        const binderMsgId = parts[2];
        const ownerId = parts[3];
        const viewerId = parts[4];
        if (!canControlTcgOwner(interaction.user.id, ownerId)) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true }), true;
        const card = getCardByIdAny(interaction.values[0]);
        const uOwner = getOrCreateTcgUser(ownerId);
        if (!card || (uOwner.cards?.[card.id] || 0) <= 0) {
            await interaction.reply({ content: "🔒 Tu ne possèdes pas cette carte !", ephemeral: true });
            return true;
        }
        const binderMsg = await interaction.channel?.messages?.fetch(binderMsgId).catch(() => null);
        if (!binderMsg) {
            await interaction.update({ content: "❌ Le message du classeur n'existe plus.", components: [] });
            return true;
        }
        const inspectPayload = buildBinderInspectPayload(card, ownerId, viewerId, binderMsgId);
        await binderMsg.edit({ content: null, ...inspectPayload, attachments: [] });
        await interaction.update({ content: `🔎 **${card.id} • ${card.name}** affichée dans le classeur !`, components: [] });
        return true;
    }

    if (action === 'binback' && interaction.isButton()) {
        const binderMsgId = parts[2];
        const ownerId = parts[3];
        const viewerId = parts[4];
        if (!canControlTcgOwner(interaction.user.id, viewerId) && !canControlTcgOwner(interaction.user.id, ownerId)) {
            await interaction.reply({ content: "Ce classeur n'est pas à toi !", ephemeral: true });
            return true;
        }
        const state = binderReturnStates.get(binderMsgId) || binderReturnStates.get(interaction.message.id) || {
            ownerId,
            viewerId,
            fromHub: false
        };
        await interaction.deferUpdate();
        const ownerMember = isSandboxId(state.ownerId)
            ? buildTcgMemberProxy(interaction.member, TCGX_SANDBOX_ID)
            : await interaction.guild.members.fetch(state.ownerId).catch(() => interaction.member);
        const payload = await buildBinderReplyPayload(ownerMember, state.viewerId, state);
        await interaction.editReply({ content: null, ...payload, attachments: [] });
        return true;
    }

    if (action === 'bpage' && interaction.isButton()) {
        const ownerId = parts[2];
        const viewerId = parts[3];
        const category = parts[4];
        const perPageMode = parts[5];
        const sortMode = parts[6];
        const rarityFilter = parts[7] || 'all';
        const fromHub = parts[8] === '1';
        const ownedMode = normalizeBinderOwnedMode(parts[9]);

        if (!canControlTcgOwner(interaction.user.id, viewerId) && !canControlTcgOwner(interaction.user.id, ownerId)) {
            await interaction.reply({ content: "Ce classeur n'est pas à toi !", ephemeral: true });
            return true;
        }

        const uOwner = getOrCreateTcgUser(ownerId);
        const cardsList = getFilteredSortedCards(category, sortMode, uOwner, ownedMode, rarityFilter);
        const grid = getBinderGridConfig(perPageMode, cardsList.length);
        const totalPages = Math.max(1, Math.ceil(cardsList.length / grid.perPage));

        const modal = new ModalBuilder()
            .setCustomId(`tcg:bpagesub:${ownerId}:${viewerId}:${category}:${perPageMode}:${sortMode}:${rarityFilter}:${fromHub ? '1' : '0'}:${ownedMode}`)
            .setTitle('Aller à une page du classeur');
        const input = new TextInputBuilder()
            .setCustomId('page_number')
            .setLabel(`Numéro de page (entre 1 et ${totalPages})`)
            .setPlaceholder(`Ex : 1 à ${totalPages}`)
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(5);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
        return true;
    }

    if ((action === 'bcat' || action === 'bsize' || action === 'bnav' || action === 'brarity' || action === 'bsort' || action === 'bowned' || action === 'btheme' || action === 'bpagesub')) {
        let ownerId, viewerId, category, perPageMode, page, sortMode, rarityFilter, fromHub, ownedMode;

        if (action === 'bcat' && interaction.isStringSelectMenu()) {
            ownerId = parts[2];
            viewerId = parts[3];
            perPageMode = parts[4];
            sortMode = parts[5];
            rarityFilter = parts[6] || 'all';
            fromHub = parts[7] === '1';
            ownedMode = normalizeBinderOwnedMode(parts[8]);
            category = interaction.values[0];
            if (category === 'perso') {
                rarityFilter = 'all';
                ownedMode = '0';
                if (sortMode === 'rarity') sortMode = 'number';
            }
            page = 0;
        } else if (action === 'bsize' && interaction.isButton()) {
            ownerId = parts[2];
            viewerId = parts[3];
            category = parts[4];
            perPageMode = parts[5];
            sortMode = parts[6];
            rarityFilter = parts[7] || 'all';
            fromHub = parts[8] === '1';
            ownedMode = normalizeBinderOwnedMode(parts[9]);
            page = 0;
        } else if (action === 'bsize' && interaction.isStringSelectMenu()) {
            ownerId = parts[2];
            viewerId = parts[3];
            category = parts[4];
            sortMode = parts[5];
            rarityFilter = 'all';
            fromHub = parts[6] === '1';
            ownedMode = normalizeBinderOwnedMode(parts[7]);
            perPageMode = interaction.values[0];
            page = 0;
        } else if (action === 'bnav' && interaction.isButton()) {
            const dir = parts[2];
            ownerId = parts[3];
            viewerId = parts[4];
            category = parts[5];
            perPageMode = parts[6];
            page = parseInt(parts[7], 10) || 0;
            sortMode = parts[8];
            rarityFilter = parts[9] || 'all';
            fromHub = parts[10] === '1';
            ownedMode = normalizeBinderOwnedMode(parts[11]);
            if (dir === 'first') page = 0;
            else if (dir === 'prev') page = Math.max(0, page - 1);
            else if (dir === 'next') page = page + 1;
            else if (dir === 'last') page = 999999;
        } else if (action === 'brarity' && interaction.isButton()) {
            ownerId = parts[2];
            viewerId = parts[3];
            category = parts[4];
            perPageMode = parts[5];
            rarityFilter = parts[6] || 'all';
            sortMode = (rarityFilter !== 'all' && parts[7] === 'rarity') ? 'number' : parts[7];
            fromHub = parts[8] === '1';
            ownedMode = normalizeBinderOwnedMode(parts[9]);
            page = 0;
        } else if (action === 'bsort' && interaction.isButton()) {
            ownerId = parts[2];
            viewerId = parts[3];
            category = parts[4];
            perPageMode = parts[5];
            page = 0;
            rarityFilter = parts[8] || 'all';
            sortMode = (rarityFilter !== 'all' && parts[7] === 'rarity') ? 'number' : parts[7];
            fromHub = parts[9] === '1';
            ownedMode = normalizeBinderOwnedMode(parts[10]);
        } else if (action === 'bowned' && interaction.isButton()) {
            ownerId = parts[2];
            viewerId = parts[3];
            category = parts[4];
            perPageMode = parts[5];
            sortMode = parts[6];
            rarityFilter = parts[7] || 'all';
            fromHub = parts[8] === '1';
            ownedMode = normalizeBinderOwnedMode(parts[9]);
            page = 0;
        } else if (action === 'btheme' && interaction.isButton()) {
            ownerId = parts[2];
            viewerId = parts[3];
            category = parts[4];
            perPageMode = parts[5];
            page = parseInt(parts[6], 10) || 0;
            sortMode = parts[7];
            rarityFilter = parts[8] || 'all';
            fromHub = parts[9] === '1';
            ownedMode = normalizeBinderOwnedMode(parts[10]);
            if (!canControlTcgOwner(interaction.user.id, ownerId)) {
                await interaction.reply({ content: "❌ Seul le propriétaire du classeur peut changer son thème Clair/Nuit.", ephemeral: true });
                return true;
            }
            const uOwner = getOrCreateTcgUser(ownerId);
            uOwner.theme = uOwner.theme === 'W' ? 'B' : 'W';
            if (!isSandboxId(ownerId)) tcgBridge.demanderSauvegarde();
        } else if (action === 'bpagesub' && interaction.isModalSubmit()) {
            ownerId = parts[2];
            viewerId = parts[3];
            category = parts[4];
            perPageMode = parts[5];
            sortMode = parts[6];
            rarityFilter = parts[7] || 'all';
            fromHub = parts[8] === '1';
            ownedMode = normalizeBinderOwnedMode(parts[9]);
            const rawPage = interaction.fields.getTextInputValue('page_number').trim();
            const pageNum = parseInt(rawPage, 10);
            if (!/^\d+$/.test(rawPage) || isNaN(pageNum) || pageNum < 1) {
                await interaction.reply({ content: "❌ Merci d'entrer un numéro de page valide (nombre entier ≥ 1).", ephemeral: true });
                return true;
            }
            page = pageNum - 1;
        } else {
            return false;
        }

        if (!canControlTcgOwner(interaction.user.id, viewerId) && !canControlTcgOwner(interaction.user.id, ownerId)) {
            await interaction.reply({ content: "Ce classeur n'est pas à toi !", ephemeral: true });
            return true;
        }

        if (action === 'bpagesub' && !interaction.isFromMessage?.()) {
            await deferReplySilent(interaction);
        } else {
            await interaction.deferUpdate();
        }
        const ownerMember = isSandboxId(ownerId)
            ? buildTcgMemberProxy(interaction.member, TCGX_SANDBOX_ID)
            : await interaction.guild.members.fetch(ownerId).catch(() => interaction.member);
        const payload = await buildBinderReplyPayload(ownerMember, viewerId, { category, perPageMode, page, sortMode, rarityFilter, ownedMode, fromHub });
        if (action === 'bpagesub' && !interaction.isFromMessage?.()) {
            const msg = await interaction.editReply(payload);
            schedulePanelAutoDelete(msg);
        } else {
            await interaction.editReply({ content: null, ...payload, attachments: [] });
        }
        return true;
    }

    // ----- SÉLECTION & NAVIGATION CARTE (!carte) + CHANGER DE SET + DÉFINIR FLEX -----
    if ((action === 'cartehub' || action === 'cartemissing') && interaction.isButton()) {
        const ownerId = parts[2];
        const page = parseInt(parts[3], 10) || 0;
        if (!canControlTcgOwner(interaction.user.id, ownerId)) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true }), true;
        const actorMember = buildTcgMemberProxy(interaction.member, ownerId);
        await interaction.update({
            content: null,
            ...buildCarteHubPayload(actorMember, interaction.channel, { mode: action === 'cartemissing' ? 'missing' : 'owned', page }),
            files: [],
            attachments: []
        });
        return true;
    }

    if (action === 'cartemissingsel' && interaction.isStringSelectMenu()) {
        const ownerId = parts[2];
        if (!canControlTcgOwner(interaction.user.id, ownerId)) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true }), true;
        const selected = interaction.values[0];
        if (selected.startsWith('__page:')) {
            const nextPage = parseInt(selected.slice('__page:'.length), 10) || 0;
            const actorMember = buildTcgMemberProxy(interaction.member, ownerId);
            await interaction.update({
                content: null,
                ...buildCarteHubPayload(actorMember, interaction.channel, { mode: 'missing', page: nextPage }),
                files: [],
                attachments: []
            });
            return true;
        }
        const card = cardById.get(selected);
        if (!card) return interaction.reply({ content: "❌ Carte introuvable.", ephemeral: true }), true;
        const u = getOrCreateTcgUser(ownerId);
        const payload = (u.cards?.[card.id] || 0) > 0
            ? buildSingleCardPayload(card, ownerId)
            : buildUnownedCardPayload(card, ownerId);
        await interaction.update({ content: null, embeds: [], files: [], attachments: [], ...payload });
        return true;
    }

    if (action === 'cartesearch' && interaction.isButton()) {
        const ownerId = parts[2];
        if (!canControlTcgOwner(interaction.user.id, ownerId)) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true }), true;
        const modal = new ModalBuilder()
            .setCustomId(`tcg:cartemodalsub:${ownerId}`)
            .setTitle('Rechercher une carte RegaDex');
        const input = new TextInputBuilder()
            .setCustomId('carte_query')
            .setLabel('Nom (ex: Epsys Full Art) ou N° (ex: 1-84)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(80);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
        return true;
    }

    if (action === 'cartemodalsub' && interaction.isModalSubmit()) {
        const ownerId = parts[2];
        if (!canControlTcgOwner(interaction.user.id, ownerId)) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true }), true;
        const query = interaction.fields.getTextInputValue('carte_query').trim();
        const u = getOrCreateTcgUser(ownerId);
        const res = resolveCardQuery(query);

        const sendOrUpdate = async (payload) => {
            if (interaction.isFromMessage?.()) {
                await interaction.deferUpdate();
                await interaction.editReply({ content: null, embeds: [], files: [], attachments: [], ...payload });
            } else {
                await interaction.reply({ ...payload, ephemeral: true });
            }
        };

        if (res.card) {
            if ((u.cards?.[res.card.id] || 0) <= 0) {
                if (res.isCodeQuery) {
                    await sendOrUpdate(buildUnownedCardPayload(res.card, ownerId));
                    return true;
                }
                await interaction.reply({
                    content: `🔒 Tu n'as pas encore découvert cette carte dans ton RegaDex ! La surprise reste totale 🤫`,
                    ephemeral: true
                });
                return true;
            }
            await sendOrUpdate(buildSingleCardPayload(res.card, ownerId));
            return true;
        }

        const ownedMatches = (res.matches || []).filter(c => (u.cards?.[c.id] || 0) > 0);
        if (ownedMatches.length === 1) {
            await sendOrUpdate(buildSingleCardPayload(ownedMatches[0], ownerId));
            return true;
        }
        if (ownedMatches.length > 1) {
            const menu = new StringSelectMenuBuilder()
                .setCustomId(`tcg:cartesel:${ownerId}`)
                .setPlaceholder('Plusieurs cartes possédées correspondent, choisis...')
                .addOptions(ownedMatches.slice(0, 25).map(c => ({
                    label: `${c.id} • ${c.name}`.slice(0, 100),
                    description: `${c.category} • ${c.rarity} • ×${u.cards[c.id]}`.slice(0, 100),
                    value: c.id
                })));
            await sendOrUpdate({
                content: `🔎 **${ownedMatches.length}** carte(s) possédée(s) correspondent à \`${query}\` :`,
                embeds: [],
                components: [
                    new ActionRowBuilder().addComponents(menu),
                    new ActionRowBuilder().addComponents(buildAccueilButton(ownerId), buildCloseButton(ownerId))
                ]
            });
            return true;
        }

        await interaction.reply({
            content: `🔒 Aucune carte découverte dans ton RegaDex ne correspond à \`${query}\`.`,
            ephemeral: true
        });
        return true;
    }

    if (action === 'cartesel' && interaction.isStringSelectMenu()) {
        const ownerId = parts[2];
        const currentCardId = parts[3] || null;
        const rawSet = parts[4] || String(DEFAULT_SET_NUMBER);
        const activeSetNumber = rawSet === 'perso' ? 'perso' : (parseInt(rawSet, 10) || DEFAULT_SET_NUMBER);
        if (!canControlTcgOwner(interaction.user.id, ownerId)) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true }), true;

        const selected = interaction.values[0];
        if (selected.startsWith('__page:') && currentCardId) {
            const nextMenuPage = parseInt(selected.slice('__page:'.length), 10) || 0;
            if (currentCardId === '__hub') {
                const actorMember = buildTcgMemberProxy(interaction.member, ownerId);
                await interaction.update({
                    content: null,
                    ...buildCarteHubPayload(actorMember, interaction.channel, { mode: 'owned', page: nextMenuPage }),
                    files: [],
                    attachments: []
                });
                return true;
            }
            const currentCard = getCardByIdAny(currentCardId);
            if (!currentCard) return true;
            await interaction.update({
                components: buildSingleCardPayload(currentCard, ownerId, { menuPage: nextMenuPage, setNumber: activeSetNumber }).components
            });
            return true;
        }

        const card = getCardByIdAny(selected);
        const u = getOrCreateTcgUser(ownerId);
        if (!card || (u.cards?.[card.id] || 0) <= 0) {
            await interaction.reply({ content: "🔒 Tu ne possèdes pas cette carte dans ton RegaDex !", ephemeral: true });
            return true;
        }
        await interaction.deferUpdate();
        await interaction.editReply({
            content: null,
            ...buildSingleCardPayload(card, ownerId, { setNumber: card.isPerso ? 'perso' : (card.setNumber || activeSetNumber) }),
            attachments: []
        });
        return true;
    }

    if (action === 'cartenav' && interaction.isButton()) {
        const dir = parts[2];
        const currentCardId = parts[3];
        const ownerId = parts[4];
        if (!canControlTcgOwner(interaction.user.id, ownerId)) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true }), true;
        const u = getOrCreateTcgUser(ownerId);
        const currentCard = getCardByIdAny(currentCardId);
        const activeSetNumber = currentCard?.isPerso ? 'perso' : (currentCard?.setNumber || DEFAULT_SET_NUMBER);
        const setOwned = activeSetNumber === 'perso'
            ? persoCatalog.filter(c => (u.cards?.[c.id] || 0) > 0)
            : getSetCatalog(activeSetNumber).filter(c => (u.cards?.[c.id] || 0) > 0);
        const ownedCards = setOwned.length > 0 ? setOwned : cardCatalog.filter(c => (u.cards?.[c.id] || 0) > 0);
        if (ownedCards.length === 0) {
            await interaction.reply({ content: "🔒 Tu ne possèdes aucune carte dans ton RegaDex !", ephemeral: true });
            return true;
        }
        let idx = ownedCards.findIndex(c => c.id === currentCardId);
        if (idx === -1) idx = 0;
        const targetIdx = dir === 'prev'
            ? (idx - 1 + ownedCards.length) % ownedCards.length
            : (idx + 1) % ownedCards.length;
        await interaction.deferUpdate();
        await interaction.editReply({
            content: null,
            ...buildSingleCardPayload(ownedCards[targetIdx], ownerId, { setNumber: activeSetNumber }),
            attachments: []
        });
        return true;
    }

    // Changement de Set (Set 1, Set 2..., Cartes Perso) dans !carte
    if (action === 'carteset' && interaction.isButton()) {
        const rawCurrentSet = parts[2] || String(DEFAULT_SET_NUMBER);
        const ownerId = parts[4];
        if (!canControlTcgOwner(interaction.user.id, ownerId)) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true }), true;
        const u = getOrCreateTcgUser(ownerId);
        const ownedPerso = persoCatalog.filter(c => (u.cards?.[c.id] || 0) > 0);
        const activeSets = getActiveSets();
        const targets = [
            ...activeSets.map(s => ({ key: String(s.number), label: s.name, setNum: s.number })),
            ...(ownedPerso.length > 0 ? [{ key: 'perso', label: 'Cartes Perso', setNum: 'perso' }] : [])
        ];
        if (targets.length <= 1) {
            await interaction.reply({ content: "⏳ Aucun autre Set disponible pour le moment !", ephemeral: true });
            return true;
        }
        const curIdx = Math.max(0, targets.findIndex(t => t.key === rawCurrentSet));
        const nextTarget = targets[(curIdx + 1) % targets.length];
        const nextOwned = nextTarget.key === 'perso'
            ? ownedPerso
            : getSetCatalog(nextTarget.setNum).filter(c => (u.cards?.[c.id] || 0) > 0);
        if (nextOwned.length === 0) {
            await interaction.reply({ content: `🔒 Tu ne possèdes encore aucune carte dans **${nextTarget.label}** !`, ephemeral: true });
            return true;
        }
        await interaction.deferUpdate();
        await interaction.editReply({
            content: null,
            ...buildSingleCardPayload(nextOwned[0], ownerId, { setNumber: nextTarget.setNum }),
            attachments: []
        });
        return true;
    }

    // ----- PASSER EN HOLO DEPUIS !CARTE / INSPECTER -----
    if (action === 'cardholo' && interaction.isButton()) {
        const cardId = parts[2];
        const ownerId = parts[3];
        const context = parts[4] || 'card';
        if (!canControlTcgOwner(interaction.user.id, ownerId)) {
            await interaction.reply({ content: "Pas pour toi 😌", ephemeral: true });
            return true;
        }
        const card = cardById.get(cardId);
        const holoCard = card?.holoCounterpartId ? cardById.get(card.holoCounterpartId) : null;
        const u = getOrCreateTcgUser(ownerId);

        if (!card || !holoCard || (u.cards?.[card.id] || 0) < 1 || (u.inventory?.holoTransform || 0) < 1) {
            await interaction.reply({ content: "❌ Transformation impossible (carte ou bonus manquant).", ephemeral: true });
            return true;
        }

        const qty = u.cards[card.id];
        const warnLast = qty === 1
            ? `\n⚠️ *Attention : tu n'as qu'**1 seule copie** de \`${card.id}\` — elle sera remplacée par la version Holo.*`
            : '';

        const confEmbed = new EmbedBuilder()
            .setColor(RARITY_META[holoCard.rarity]?.color || 0xf1c40f)
            .setTitle('✨ Passer cette carte en Holographique ?')
            .setDescription(
                `**${card.id} • ${card.name}** ➔ **${holoCard.id} • ${holoCard.name}**\n` +
                `🎒 Consomme **1 Transformation Holographique** *(restant après transfo : \`${u.inventory.holoTransform - 1}\`)*` +
                warnLast
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`tcg:cardholoconf:${card.id}:${ownerId}:${context}:${interaction.message?.id || ''}`)
                .setLabel('Confirmer')
                .setEmoji('✅')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`tcg:cardholocancel:${ownerId}`)
                .setLabel('Annuler')
                .setEmoji('❌')
                .setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({ embeds: [confEmbed], components: [row], ephemeral: true });
        return true;
    }

    if (action === 'cardholocancel' && interaction.isButton()) {
        const ownerId = parts[2];
        if (!canControlTcgOwner(interaction.user.id, ownerId)) {
            await interaction.reply({ content: "Pas pour toi 😌", ephemeral: true });
            return true;
        }
        await interaction.update({ content: '❌ Transformation annulée.', embeds: [], components: [] });
        return true;
    }

    if (action === 'cardholoconf' && interaction.isButton()) {
        const cardId = parts[2];
        const ownerId = parts[3];
        const context = parts[4] || 'card';
        const origMsgId = parts[5] || '';
        if (!canControlTcgOwner(interaction.user.id, ownerId)) {
            await interaction.reply({ content: "Pas pour toi 😌", ephemeral: true });
            return true;
        }
        const card = cardById.get(cardId);
        const holoCard = card?.holoCounterpartId ? cardById.get(card.holoCounterpartId) : null;
        const u = getOrCreateTcgUser(ownerId);

        if (!card || !holoCard || (u.cards?.[card.id] || 0) < 1 || (u.inventory?.holoTransform || 0) < 1) {
            await interaction.update({ content: "❌ Transformation impossible (carte ou bonus manquant).", embeds: [], components: [] });
            return true;
        }

        u.inventory.holoTransform -= 1;
        u.cards[card.id] -= 1;
        if (u.cards[card.id] <= 0) {
            delete u.cards[card.id];
            if (u.favoriteCardId === card.id) u.favoriteCardId = null;
        }
        u.cards[holoCard.id] = (u.cards[holoCard.id] || 0) + 1;
        const holoMilestones = checkAndGrantCompletionMilestones(ownerId, card.setNumber || DEFAULT_SET_NUMBER);
        if (!isSandboxId(ownerId)) tcgBridge.demanderSauvegarde();
        for (const sNum of (holoMilestones.masteredSets || [])) {
            await envoyerMaitreDuSetPantheonTcg(client, interaction.member, sNum).catch(() => {});
        }

        if (origMsgId && interaction.channel) {
            const origMsg = await interaction.channel.messages.fetch(origMsgId).catch(() => null);
            if (origMsg) {
                if (context === 'binspect') {
                    const state = binderReturnStates.get(origMsgId);
                    await origMsg.edit({
                        content: null,
                        ...buildBinderInspectPayload(holoCard, ownerId, state?.viewerId || ownerId, origMsgId),
                        attachments: []
                    }).catch(() => {});
                } else {
                    await origMsg.edit({
                        content: null,
                        ...buildSingleCardPayload(holoCard, ownerId),
                        attachments: []
                    }).catch(() => {});
                }
            }
        }

        const msTxt = holoMilestones.unlocked.length > 0
            ? `\n🏆 **Palier(s) atteint(s) :** ${holoMilestones.unlocked.map(m => `**${m.pct}%** (+${m.reward} pts)`).join(', ')}`
            : '';

        await interaction.update({
            content: `✨ **${card.id} • ${card.name}** a évolué en **${holoCard.id} • ${holoCard.name}** ! *(Transformations restantes : \`${u.inventory.holoTransform}\`)*${msTxt}`,
            embeds: [],
            components: []
        });
        return true;
    }

    // ----- PASSER EN NÉGATIVE DEPUIS !CARTE / INSPECTER -----
    if (action === 'cardneg' && interaction.isButton()) {
        const cardId = parts[2];
        const ownerId = parts[3];
        const context = parts[4] || 'card';
        if (!canControlTcgOwner(interaction.user.id, ownerId)) {
            await interaction.reply({ content: "Pas pour toi 😌", ephemeral: true });
            return true;
        }
        const card = cardById.get(cardId);
        const negCard = card?.negativeCounterpartId ? cardById.get(card.negativeCounterpartId) : null;
        const u = getOrCreateTcgUser(ownerId);

        if (!card || !negCard || card.rarity !== 'Full Art' || (u.cards?.[card.id] || 0) < 1 || (u.inventory?.negativeTransform || 0) < 1) {
            await interaction.reply({ content: "❌ Transformation impossible (carte ou bonus manquant).", ephemeral: true });
            return true;
        }

        const qty = u.cards[card.id];
        const negOwned = u.cards?.[negCard.id] || 0;
        const warnLast = qty === 1
            ? `\n⚠️ *Attention : tu n'as qu'**1 seule copie** de \`${card.id}\` — elle sera remplacée par sa version Négative.*`
            : '';

        const confEmbed = new EmbedBuilder()
            .setColor(RARITY_META['Négative']?.color || 0x2ecc71)
            .setTitle('🕳️ Passer cette carte en Négative ?')
            .setDescription(
                `**${card.id} • ${card.name}** ➔ 🕳️ **Version Négative**` +
                (negOwned > 0 ? ` *(\`${negCard.id}\`, déjà possédée x${negOwned})*` : '') + `\n` +
                `🎒 Consomme **1 Transformation Négative** *(restant après transfo : \`${u.inventory.negativeTransform - 1}\`)*` +
                warnLast
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`tcg:cardnegconf:${card.id}:${ownerId}:${context}:${interaction.message?.id || ''}`)
                .setLabel('Confirmer')
                .setEmoji('✅')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`tcg:cardholocancel:${ownerId}`)
                .setLabel('Annuler')
                .setEmoji('❌')
                .setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({ embeds: [confEmbed], components: [row], ephemeral: true });
        return true;
    }

    if (action === 'cardnegconf' && interaction.isButton()) {
        const cardId = parts[2];
        const ownerId = parts[3];
        const context = parts[4] || 'card';
        const origMsgId = parts[5] || '';
        if (!canControlTcgOwner(interaction.user.id, ownerId)) {
            await interaction.reply({ content: "Pas pour toi 😌", ephemeral: true });
            return true;
        }
        const card = cardById.get(cardId);
        const negCard = card?.negativeCounterpartId ? cardById.get(card.negativeCounterpartId) : null;
        const u = getOrCreateTcgUser(ownerId);

        if (!card || !negCard || card.rarity !== 'Full Art' || (u.cards?.[card.id] || 0) < 1 || (u.inventory?.negativeTransform || 0) < 1) {
            await interaction.update({ content: "❌ Transformation impossible (carte ou bonus manquant).", embeds: [], components: [] });
            return true;
        }

        const wasNew = (u.cards[negCard.id] || 0) === 0;
        u.inventory.negativeTransform -= 1;
        u.cards[card.id] -= 1;
        if (u.cards[card.id] <= 0) {
            delete u.cards[card.id];
            if (u.favoriteCardId === card.id) u.favoriteCardId = null;
        }
        u.cards[negCard.id] = (u.cards[negCard.id] || 0) + 1;
        const negMilestones = checkAndGrantCompletionMilestones(ownerId, card.setNumber || DEFAULT_SET_NUMBER);
        if (!isSandboxId(ownerId)) tcgBridge.demanderSauvegarde();
        for (const sNum of (negMilestones.masteredSets || [])) {
            await envoyerMaitreDuSetPantheonTcg(client, interaction.member, sNum).catch(() => {});
        }

        if (origMsgId && interaction.channel) {
            const origMsg = await interaction.channel.messages.fetch(origMsgId).catch(() => null);
            if (origMsg) {
                if (context === 'binspect') {
                    const state = binderReturnStates.get(origMsgId);
                    await origMsg.edit({
                        content: null,
                        ...buildBinderInspectPayload(negCard, ownerId, state?.viewerId || ownerId, origMsgId),
                        attachments: []
                    }).catch(() => {});
                } else {
                    await origMsg.edit({
                        content: null,
                        ...buildSingleCardPayload(negCard, ownerId),
                        attachments: []
                    }).catch(() => {});
                }
            }
        }

        const msTxt = negMilestones.unlocked.length > 0
            ? `\n🏆 **Palier(s) atteint(s) :** ${negMilestones.unlocked.map(m => `**${m.pct}%** (+${m.reward} pts)`).join(', ')}`
            : '';

        await interaction.update({
            content: `🕳️ **${card.id} • ${card.name}** a basculé en **${negCard.id} • ${negCard.name}** ! *(Transformations restantes : \`${u.inventory.negativeTransform}\`)*${msTxt}`,
            embeds: [],
            components: []
        });
        envoyerTransfoNegativeTcg(client, interaction.member, card, negCard, wasNew).catch(() => {});
        return true;
    }

    // ----- QUI A CETTE CARTE EN DOUBLON ? (!carte & Inspecter) -----
    if (action === 'carddups' && interaction.isButton()) {
        const cardId = parts[2];
        const ownerId = parts[3];
        if (!hasTcgRole(interaction.member) && interaction.user.id !== EPSYS_ID) {
            await interaction.reply({ content: `🔒 Réservé aux membres ayant le rôle <@&${TCG_ROLE_ID}>.`, ephemeral: true });
            return true;
        }
        if (isSandboxId(ownerId) && interaction.user.id !== EPSYS_ID) {
            await interaction.reply({ content: "Pas pour toi 😌", ephemeral: true });
            return true;
        }

        const card = cardById.get(cardId);
        const viewerU = getOrCreateTcgUser(interaction.user.id);
        const viewerOwns = (viewerU.cards?.[cardId] || 0) > 0;
        const cardTitle = viewerOwns && card ? `\`${card.id}\` **${card.name}**` : `\`${cardId}\``;

        const dups = getCardDuplicateOwners(cardId, interaction.user.id);
        if (dups.length === 0) {
            await interaction.reply({
                content: `😔 Personne sur le serveur ne possède ${cardTitle} en doublon pour le moment.`,
                ephemeral: true
            });
            return true;
        }

        const topDups = dups.slice(0, 20);
        await interaction.guild.members.fetch({ user: topDups.map(d => d.uid) }).catch(() => {});
        const lines = topDups.map(d => {
            const m = interaction.guild.members.cache.get(d.uid);
            const name = m ? `**${m.displayName}** (<@${d.uid}>)` : `<@${d.uid}>`;
            return `• ${name} — \`x${d.qty}\` *(${d.extra} doublon${d.extra > 1 ? 's' : ''})*`;
        });

        await interaction.reply({
            content:
                `👥 **Collectionneur·euses ayant ${cardTitle} en doublon (${dups.length}) :**\n` +
                lines.join('\n') +
                (dups.length > 20 ? `\n*...et ${dups.length - 20} autre(s) membre(s)*` : ''),
            ephemeral: true
        });
        return true;
    }

    // ----- WISHLIST (5 CARTES MAX) -----
    if (action === 'wish') {
        const sub = parts[2];

        if (sub === 'open' && interaction.isButton()) {
            const ownerId = parts[3];
            const fromHub = parts[4] === '1';
            const fromProfile = parts[5] === '1';
            if (!canControlTcgOwner(interaction.user.id, ownerId)) {
                await interaction.reply({ content: "Pas pour toi 😌", ephemeral: true });
                return true;
            }
            const actorMember = buildTcgMemberProxy(interaction.member, ownerId);
            await interaction.update({
                content: null,
                files: [],
                attachments: [],
                ...buildWishlistPayload(actorMember, ownerId, fromHub, fromProfile)
            });
            return true;
        }

        if (sub === 'toggle' && interaction.isButton()) {
            const cardId = parts[3];
            const ownerId = parts[4];
            const context = parts[5] || 'card';
            const binderMsgId = parts[6] || null;
            if (!canControlTcgOwner(interaction.user.id, ownerId)) {
                await interaction.reply({ content: "Pas pour toi 😌", ephemeral: true });
                return true;
            }
            const card = cardById.get(cardId);
            if (!card) {
                await interaction.reply({ content: "❌ Carte introuvable.", ephemeral: true });
                return true;
            }
            const u = getOrCreateTcgUser(ownerId);
            u.wishlist = getSanitizedWishlist(u);
            let feedback;
            if (u.wishlist.includes(cardId)) {
                u.wishlist = u.wishlist.filter(id => id !== cardId);
                feedback = `💔 \`${cardId}\` retirée de ta Wishlist.`;
            } else if (u.wishlist.length >= MAX_WISHLIST) {
                await interaction.reply({ content: `⚠️ Ta Wishlist est déjà pleine (**${MAX_WISHLIST}/${MAX_WISHLIST}**).`, ephemeral: true });
                return true;
            } else {
                u.wishlist.push(cardId);
                feedback = `❤️ \`${cardId}\` ajoutée à ta Wishlist !`;
            }
            if (!isSandboxId(ownerId)) tcgBridge.demanderSauvegarde();

            if (context === 'card') {
                await interaction.update({ components: buildSingleCardPayload(card, ownerId).components });
            } else if (context === 'unowned') {
                await interaction.update({ components: buildUnownedCardPayload(card, ownerId).components });
            } else if (context === 'binspect') {
                const state = binderReturnStates.get(interaction.message?.id);
                await interaction.update({
                    components: buildBinderInspectPayload(card, ownerId, state?.viewerId || ownerId, binderMsgId || interaction.message?.id).components
                });
            }
            await interaction.followUp({ content: feedback, ephemeral: true });
            return true;
        }

        if (sub === 'filter' && interaction.isButton()) {
            const nextFilter = parts[3] || 'missing';
            const ownerId = parts[4];
            const fromHub = parts[5] === '1';
            const fromProfile = parts[6] === '1';
            if (!canControlTcgOwner(interaction.user.id, ownerId)) {
                await interaction.reply({ content: "Pas pour toi 😌", ephemeral: true });
                return true;
            }
            const actorMember = buildTcgMemberProxy(interaction.member, ownerId);
            await interaction.update({
                content: null,
                files: [],
                attachments: [],
                ...buildWishlistPayload(actorMember, ownerId, fromHub, fromProfile, null, { addPage: 0, addFilter: nextFilter })
            });
            return true;
        }

        if ((sub === 'addsel' || sub === 'addpick') && interaction.isStringSelectMenu()) {
            const ownerId = parts[3];
            const fromHub = parts[4] === '1';
            const fromProfile = parts[5] === '1';
            const addFilter = parts[6] || 'missing';
            if (!canControlTcgOwner(interaction.user.id, ownerId)) {
                await interaction.reply({ content: "Pas pour toi 😌", ephemeral: true });
                return true;
            }
            const selected = interaction.values[0];
            const actorMember = buildTcgMemberProxy(interaction.member, ownerId);

            if (selected.startsWith('__page:')) {
                const nextPage = parseInt(selected.slice('__page:'.length), 10) || 0;
                await interaction.update({
                    content: null,
                    files: [],
                    attachments: [],
                    ...buildWishlistPayload(actorMember, ownerId, fromHub, fromProfile, null, { addPage: nextPage, addFilter })
                });
                return true;
            }

            const card = cardById.get(selected);
            if (!card) {
                await interaction.reply({ content: "❌ Carte introuvable.", ephemeral: true });
                return true;
            }
            const u = getOrCreateTcgUser(ownerId);
            u.wishlist = getSanitizedWishlist(u);
            if (u.wishlist.includes(card.id)) {
                await interaction.reply({ content: `ℹ️ \`${card.id}\` est déjà dans ta Wishlist.`, ephemeral: true });
                return true;
            }
            if (u.wishlist.length >= MAX_WISHLIST) {
                await interaction.reply({ content: `⚠️ Ta Wishlist est déjà pleine (**${MAX_WISHLIST}/${MAX_WISHLIST}**).`, ephemeral: true });
                return true;
            }
            u.wishlist.push(card.id);
            if (!isSandboxId(ownerId)) tcgBridge.demanderSauvegarde();
            await interaction.update({
                content: null,
                files: [],
                attachments: [],
                ...buildWishlistPayload(actorMember, ownerId, fromHub, fromProfile, `❤️ \`${card.id}\` ajoutée à ta Wishlist !`, { addPage: 0, addFilter })
            });
            return true;
        }

        if (sub === 'add' && interaction.isButton()) {
            const ownerId = parts[3];
            const fromHub = parts[4] === '1';
            const fromProfile = parts[5] === '1';
            if (!canControlTcgOwner(interaction.user.id, ownerId)) {
                await interaction.reply({ content: "Pas pour toi 😌", ephemeral: true });
                return true;
            }
            const modal = new ModalBuilder()
                .setCustomId(`tcg:wish:addsub:${ownerId}:${fromHub ? '1' : '0'}:${fromProfile ? '1' : '0'}`)
                .setTitle('Ajouter à ta Wishlist');
            const input = new TextInputBuilder()
                .setCustomId('wish_query')
                .setLabel('Nom (ex: Epsys Full Art) ou N° (ex: 1-84)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(80);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            await interaction.showModal(modal);
            return true;
        }

        if (sub === 'addsub' && interaction.isModalSubmit()) {
            const ownerId = parts[3];
            const fromHub = parts[4] === '1';
            const fromProfile = parts[5] === '1';
            if (!canControlTcgOwner(interaction.user.id, ownerId)) {
                await interaction.reply({ content: "Pas pour toi 😌", ephemeral: true });
                return true;
            }
            const query = interaction.fields.getTextInputValue('wish_query').trim();
            const u = getOrCreateTcgUser(ownerId);
            u.wishlist = getSanitizedWishlist(u);
            const res = resolveCardQuery(query);
            if (!res.card) {
                const pickable = (res.matches || []).filter(c => !c.isPerso && (res.isCodeQuery || (u.cards?.[c.id] || 0) > 0));
                if (pickable.length > 0 && u.wishlist.length < MAX_WISHLIST) {
                    const menu = new StringSelectMenuBuilder()
                        .setCustomId(`tcg:wish:addpick:${ownerId}:${fromHub ? '1' : '0'}:${fromProfile ? '1' : '0'}`)
                        .setPlaceholder('Plusieurs cartes correspondent, choisis...')
                        .addOptions(pickable.slice(0, 25).map(c => {
                            const owned = (u.cards?.[c.id] || 0) > 0;
                            return {
                                label: owned ? `${c.id} • ${c.name}`.slice(0, 100) : `🔒 ${c.id} • Carte non découverte`,
                                description: owned ? `${c.rarity} • Ajouter à la Wishlist` : 'Ajouter à la Wishlist',
                                value: c.id
                            };
                        }));
                    await interaction.reply({
                        content: `🔎 Plusieurs cartes correspondent à \`${query}\` :`,
                        components: [new ActionRowBuilder().addComponents(menu)],
                        ephemeral: true
                    });
                    return true;
                }
                await interaction.reply({
                    content: `❌ Aucune carte unique trouvée pour \`${query}\`. Tu peux aussi utiliser le menu déroulant directement dans \`!wishlist\` !`,
                    ephemeral: true
                });
                return true;
            }
            if (res.card.isPerso) {
                await interaction.reply({
                    content: `❌ Les cartes personnalisées (\`${res.card.id}\`) sont **uniques et non échangeables**, impossible de les ajouter à la Wishlist.`,
                    ephemeral: true
                });
                return true;
            }
            if (u.wishlist.includes(res.card.id)) {
                await interaction.reply({ content: `ℹ️ \`${res.card.id}\` est déjà dans ta Wishlist.`, ephemeral: true });
                return true;
            }
            if (u.wishlist.length >= MAX_WISHLIST) {
                await interaction.reply({ content: `⚠️ Ta Wishlist est déjà pleine (**${MAX_WISHLIST}/${MAX_WISHLIST}**).`, ephemeral: true });
                return true;
            }
            u.wishlist.push(res.card.id);
            if (!isSandboxId(ownerId)) tcgBridge.demanderSauvegarde();
            const actorMember = buildTcgMemberProxy(interaction.member, ownerId);
            const payload = buildWishlistPayload(actorMember, ownerId, fromHub, fromProfile, `❤️ \`${res.card.id}\` ajoutée à ta Wishlist !`);
            if (interaction.isFromMessage?.()) {
                await interaction.update({ content: null, files: [], attachments: [], ...payload });
            } else {
                await interaction.reply({ ...payload, ephemeral: true });
            }
            return true;
        }

        if (sub === 'remsel' && interaction.isStringSelectMenu()) {
            const ownerId = parts[3];
            const fromHub = parts[4] === '1';
            const fromProfile = parts[5] === '1';
            if (!canControlTcgOwner(interaction.user.id, ownerId)) {
                await interaction.reply({ content: "Pas pour toi 😌", ephemeral: true });
                return true;
            }
            const cardId = interaction.values[0];
            const u = getOrCreateTcgUser(ownerId);
            u.wishlist = getSanitizedWishlist(u).filter(id => id !== cardId);
            if (!isSandboxId(ownerId)) tcgBridge.demanderSauvegarde();
            const actorMember = buildTcgMemberProxy(interaction.member, ownerId);
            await interaction.update({
                content: null,
                files: [],
                attachments: [],
                ...buildWishlistPayload(actorMember, ownerId, fromHub, fromProfile, `💔 \`${cardId}\` retirée de ta Wishlist.`)
            });
            return true;
        }

        if (sub === 'clear' && interaction.isButton()) {
            const ownerId = parts[3];
            const fromHub = parts[4] === '1';
            const fromProfile = parts[5] === '1';
            if (!canControlTcgOwner(interaction.user.id, ownerId)) {
                await interaction.reply({ content: "Pas pour toi 😌", ephemeral: true });
                return true;
            }
            const u = getOrCreateTcgUser(ownerId);
            u.wishlist = [];
            if (!isSandboxId(ownerId)) tcgBridge.demanderSauvegarde();
            const actorMember = buildTcgMemberProxy(interaction.member, ownerId);
            await interaction.update({
                content: null,
                files: [],
                attachments: [],
                ...buildWishlistPayload(actorMember, ownerId, fromHub, fromProfile, '🧹 *Wishlist vidée.*')
            });
            return true;
        }
    }

    if (action === 'setflex' && interaction.isButton()) {
        const cardId = parts[2];
        const ownerId = parts[3];
        const context = parts[4] || 'card';
        if (!canControlTcgOwner(interaction.user.id, ownerId)) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true }), true;
        const card = getCardByIdAny(cardId);
        const u = getOrCreateTcgUser(ownerId);
        if (!card || (u.cards?.[card.id] || 0) <= 0) {
            await interaction.reply({ content: "❌ Tu ne possèdes pas cette carte.", ephemeral: true });
            return true;
        }
        u.favoriteCardId = card.id;
        if (!isSandboxId(ownerId)) tcgBridge.demanderSauvegarde();

        if (context === 'booster') {
            const session = boosterSessions.get(interaction.message?.id);
            if (session && session.step < session.cards.length) {
                const actorMember = buildTcgMemberProxy(interaction.member, ownerId);
                const cardPayload = buildBoosterCardEmbed(actorMember, session, session.step);
                await interaction.update({ components: cardPayload.components });
                await interaction.followUp({
                    content: `⭐ Ta carte préférée est maintenant **${card.id} • ${card.name}** ! Tape \`!flex\` pour frimer !`,
                    ephemeral: true
                });
                return true;
            }
        } else if (context === 'card') {
            const cardPayload = buildSingleCardPayload(card, ownerId);
            await interaction.update({ components: cardPayload.components });
            await interaction.followUp({
                content: `⭐ Ta carte préférée est maintenant **${card.id} • ${card.name}** ! Tape \`!flex\` pour frimer !`,
                ephemeral: true
            });
            return true;
        } else if (context === 'binspect') {
            const state = binderReturnStates.get(interaction.message?.id);
            const inspectPayload = buildBinderInspectPayload(card, ownerId, state?.viewerId || ownerId, interaction.message?.id);
            await interaction.update({ components: inspectPayload.components });
            await interaction.followUp({
                content: `⭐ Ta carte préférée est maintenant **${card.id} • ${card.name}** ! Tape \`!flex\` pour frimer !`,
                ephemeral: true
            });
            return true;
        }

        await interaction.reply({
            content: `⭐ Ta carte préférée est maintenant **${card.id} • ${card.name}** ! Tape \`!flex\` pour frimer !`,
            ephemeral: true
        });
        return true;
    }

    if (action === 'flexpage' && interaction.isButton()) {
        const ownerId = parts[2];
        const page = parseInt(parts[3], 10) || 0;
        if (!canControlTcgOwner(interaction.user.id, ownerId)) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true }), true;
        const actorMember = buildTcgMemberProxy(interaction.member, ownerId);
        await sendFlexPicker(interaction, actorMember, page);
        return true;
    }

    if (action === 'flexset' && interaction.isStringSelectMenu()) {
        const ownerId = parts[2];
        if (!canControlTcgOwner(interaction.user.id, ownerId)) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true }), true;
        const card = getCardByIdAny(interaction.values[0]);
        const u = getOrCreateTcgUser(ownerId);
        if (!card || (u.cards[card.id] || 0) <= 0) {
            await interaction.reply({ content: "❌ Tu ne possèdes pas cette carte.", ephemeral: true });
            return true;
        }
        u.favoriteCardId = card.id;
        if (!isSandboxId(ownerId)) tcgBridge.demanderSauvegarde();
        await interaction.update({
            content: `⭐ Ta carte préférée est maintenant **${card.id} • ${card.name}** ! Tape \`!flex\` pour frimer !`,
            embeds: [],
            components: [new ActionRowBuilder().addComponents(buildAccueilButton(ownerId), buildCloseButton(ownerId))],
            files: [],
            attachments: []
        });
        return true;
    }

    // ----- CLASSEMENTS (!regadex top / Hub) -----
    if (action === 'top' && interaction.isButton()) {
        const mode = parts[2];
        const ownerId = parts[3];
        const fromHub = parts[4] === '1';
        if (!canControlTcgOwner(interaction.user.id, ownerId)) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true }), true;
        const payload = {
            content: null,
            files: [],
            attachments: [],
            embeds: [buildTopEmbed(interaction.guild, mode)],
            components: buildTopComponents(ownerId, mode, fromHub)
        };
        await interaction.update(payload);
        return true;
    }

    // ----- TRADE : SÉLECTION PARTENAIRE + CONFIRMATION + CRÉATION THREAD -----
    if (action === 'tradepick' && interaction.isUserSelectMenu()) {
        const initiatorId = parts[2];
        if (interaction.user.id !== initiatorId) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true }), true;
        const targetMember = await interaction.guild.members.fetch(interaction.values[0]).catch(() => null);
        await interaction.message.delete().catch(() => {});
        await initiateTradePrompt(interaction, interaction.member, targetMember);
        return true;
    }

    if (action === 'tconf' && interaction.isButton()) {
        const sub = parts[2];
        const confirmId = parts[3];
        const conf = pendingConfirms.get(confirmId);
        if (!conf) {
            await interaction.reply({ content: "⏳ Cette proposition d'échange a expiré.", ephemeral: true });
            return true;
        }

        if (sub === 'pub' || sub === 'talk') {
            if (interaction.user.id !== conf.initiatorId) {
                await interaction.reply({ content: `Seul <@${conf.initiatorId}> peut régler les options du thread.`, ephemeral: true });
                return true;
            }
            if (sub === 'pub') {
                conf.isPublic = !conf.isPublic;
                if (!conf.isPublic) conf.canEveryoneTalk = false;
            } else {
                conf.canEveryoneTalk = !conf.canEveryoneTalk;
            }
            await interaction.update(buildTradeConfirmPayload(confirmId, conf));
            return true;
        }

        if (sub === 'decline') {
            if (interaction.user.id !== conf.targetId && interaction.user.id !== conf.initiatorId) {
                await interaction.reply({ content: "Cet échange ne te concerne pas !", ephemeral: true });
                return true;
            }
            pendingConfirms.delete(confirmId);
            await interaction.update({ content: `❌ Échange annulé par <@${interaction.user.id}>.`, embeds: [], components: [] });
            return true;
        }

        if (sub === 'accept') {
            if (interaction.user.id !== conf.targetId) {
                await interaction.reply({ content: `Seul <@${conf.targetId}> peut accepter cette proposition !`, ephemeral: true });
                return true;
            }
            pendingConfirms.delete(confirmId);
            await interaction.deferUpdate();

            const parentChannel = await client.channels.fetch(TCG_CHANNEL_ID).catch(() => interaction.channel);
            const mA = await interaction.guild.members.fetch(conf.initiatorId).catch(() => null);
            const mB = await interaction.guild.members.fetch(conf.targetId).catch(() => null);
            const nameA = (mA?.displayName || 'Membre1').slice(0, 20);
            const nameB = (mB?.displayName || 'Membre2').slice(0, 20);

            const thread = await parentChannel.threads.create({
                name: `🔄 Échange • ${nameA} × ${nameB}`,
                type: ChannelType.PublicThread,
                autoArchiveDuration: 1440
            });

            const data = getStoreData();
            const trade = {
                id: thread.id,
                initiatorId: conf.initiatorId,
                targetId: conf.targetId,
                isPublic: conf.isPublic,
                canEveryoneTalk: conf.isPublic ? conf.canEveryoneTalk : false,
                offers: { [conf.initiatorId]: [], [conf.targetId]: [] },
                lockedOffers: { [conf.initiatorId]: false, [conf.targetId]: false },
                postTradeVotes: { [conf.initiatorId]: null, [conf.targetId]: null },
                tradeCount: 0,
                closed: false,
                lastActivityAt: Date.now(),
                statusMessageId: null
            };
            data.activeTrades[thread.id] = trade;
            tcgBridge.demanderSauvegarde();

            const introMsg = await sendSilent(thread, {
                content: `👋 Bienvenue <@${conf.initiatorId}> et <@${conf.targetId}> dans votre salon d'échange !\n` +
                    ((!trade.isPublic || !trade.canEveryoneTalk) ? `-# 🔒 Thread en mode restreint : les messages des autres membres sont automatiquement supprimés.` : ''),
                ...buildTradeThreadPayload(trade)
            });
            trade.statusMessageId = introMsg.id;
            tcgBridge.demanderSauvegarde();

            await interaction.editReply({
                content: `✅ Échange accepté ! Rendez-vous dans le thread : <#${thread.id}>`,
                embeds: [],
                components: []
            });
            return true;
        }
    }

    // ----- TRADE EN COURS DANS LE THREAD -----
    if (action === 'tr') {
        const sub = parts[2];
        const threadId = parts[3];
        const data = getStoreData();
        const trade = data.activeTrades?.[threadId];
        if (!trade || trade.closed) {
            await interaction.reply({ content: "❌ Cet échange est terminé ou n'existe plus.", ephemeral: true });
            return true;
        }

        if (interaction.user.id !== trade.initiatorId && interaction.user.id !== trade.targetId) {
            await interaction.reply({ content: "❌ Seul.es les deux participant.es de l'échange peuvent utiliser ces contrôles.", ephemeral: true });
            return true;
        }

        trade.lastActivityAt = Date.now();
        const uid = interaction.user.id;
        const thread = interaction.channel;

        if (sub === 'cancel' && interaction.isButton()) {
            trade.closed = true;
            const hadTrades = (trade.tradeCount || 0) >= 1;
            delete data.activeTrades[threadId];
            tcgBridge.demanderSauvegarde();
            await replySilent(interaction, `❌ Échange annulé par <@${uid}>. Fermeture du thread...`);
            if (hadTrades) {
                await sendTradeRewardBeforeClose(thread, trade);
            }
            setTimeout(async () => {
                if (hadTrades) {
                    await thread.setLocked(true).catch(() => {});
                    await thread.setArchived(true).catch(() => {});
                } else {
                    await thread.delete().catch(() => {});
                }
            }, 3000);
            return true;
        }

        if (sub === 'lock' && interaction.isButton()) {
            trade.lockedOffers[uid] = !trade.lockedOffers[uid];
            trade.unfairConfirm = null;
            tcgBridge.demanderSauvegarde();
            await interaction.update(buildTradeThreadPayload(trade));
            await executeTradeIfBothLocked(thread, trade, client);
            return true;
        }

        if (sub === 'clear' && interaction.isButton()) {
            if (trade.offers[uid].length === 0) {
                await interaction.reply({ content: "Ton offre est déjà vide.", ephemeral: true });
                return true;
            }
            trade.offers[uid] = [];
            trade.lockedOffers[trade.initiatorId] = false;
            trade.lockedOffers[trade.targetId] = false;
            trade.unfairConfirm = null;
            tcgBridge.demanderSauvegarde();
            await interaction.update(buildTradeThreadPayload(trade));
            return true;
        }

        if (sub === 'uok' && interaction.isButton()) {
            if (!trade.unfairConfirm || !trade.lockedOffers[trade.initiatorId] || !trade.lockedOffers[trade.targetId]) {
                await interaction.reply({ content: "⏳ Cette demande de confirmation n'est plus active (les offres ont été modifiées ou déverrouillées).", ephemeral: true });
                return true;
            }
            trade.unfairConfirm.votes = trade.unfairConfirm.votes || {};
            trade.unfairConfirm.votes[uid] = true;
            if (trade.unfairConfirm.votes[trade.initiatorId] && trade.unfairConfirm.votes[trade.targetId]) {
                await interaction.update({ content: "✅ **Double confirmation validée !** Exécution de l'échange...", embeds: [], components: [] });
                await executeTradeIfBothLocked(thread, trade, client);
                return true;
            }
            tcgBridge.demanderSauvegarde();
            await interaction.update(buildTradeUnfairConfirmPayload(trade));
            return true;
        }

        if (sub === 'ucancel' && interaction.isButton()) {
            trade.unfairConfirm = null;
            trade.lockedOffers[trade.initiatorId] = false;
            trade.lockedOffers[trade.targetId] = false;
            tcgBridge.demanderSauvegarde();
            await refreshTradePanel(thread, trade);
            await interaction.update({ content: `❌ **Confirmation annulée par <@${uid}>** *(échange déséquilibré)*. Les offres ont été déverrouillées.`, embeds: [], components: [] });
            return true;
        }

        if (sub === 'add' && interaction.isButton()) {
            if (trade.offers[uid].length >= 3) {
                await interaction.reply({ content: "⚠️ Tu as déjà mis **3 cartes** (maximum par échange).", ephemeral: true });
                return true;
            }
            const tradables = getTradableDuplicates(uid, trade.offers[uid]);
            if (tradables.length === 0) {
                await interaction.reply({ content: "❌ Tu n'as aucune carte disponible dans ton inventaire.", ephemeral: true });
                return true;
            }
            const page = parseInt(parts[4] || '0', 10);
            const missingOnly = parts[5] === '1';
            await interaction.reply({ ...buildTradeAddCardEphemeralPayload(trade, uid, page, missingOnly), ephemeral: true });
            return true;
        }

        if (sub === 'addpage' && interaction.isButton()) {
            const page = parseInt(parts[4] || '0', 10);
            const missingOnly = parts[5] === '1';
            await interaction.update(buildTradeAddCardEphemeralPayload(trade, uid, page, missingOnly));
            return true;
        }

        if (sub === 'addmiss' && interaction.isButton()) {
            const missingOnly = parts[4] === '1';
            await interaction.update(buildTradeAddCardEphemeralPayload(trade, uid, 0, missingOnly));
            return true;
        }

        if (sub === 'addsel' && interaction.isStringSelectMenu()) {
            if (trade.offers[uid].length >= 3) {
                await interaction.reply({ content: "⚠️ Limite de 3 cartes atteinte.", ephemeral: true });
                return true;
            }
            const cardId = interaction.values[0];
            const u = getOrCreateTcgUser(uid);
            const already = trade.offers[uid].filter(id => id === cardId).length;
            const remainingBefore = (u.cards[cardId] || 0) - already;
            if (remainingBefore < 1) {
                await interaction.reply({ content: "❌ Tu ne possèdes plus d'exemplaire disponible pour cette carte.", ephemeral: true });
                return true;
            }
            const isLastCopy = remainingBefore === 1;
            const addedCard = cardById.get(cardId);
            trade.offers[uid].push(cardId);
            trade.lockedOffers[trade.initiatorId] = false;
            trade.lockedOffers[trade.targetId] = false;
            trade.unfairConfirm = null;
            tcgBridge.demanderSauvegarde();
            await refreshTradePanel(thread, trade);
            if (isLastCopy && !isTradeFreeModeActive()) {
                await interaction.update({
                    content: `✅ **${cardId}** ajoutée à ton offre !\n⚠️ **Attention :** c'est ta **dernière carte** dans ton inventaire *(tu n'auras plus aucun exemplaire après l'échange)*.`,
                    components: []
                });
                await sendSilent(
                    thread,
                    `⚠️ **Prévention :** <@${uid}> vient de proposer \`${cardId}\`${addedCard ? ` (**${addedCard.name}**)` : ''}, qui est sa **dernière carte** dans son inventaire !`
                ).catch(() => {});
            } else {
                await interaction.update({ content: `✅ **${cardId}** ajoutée à ton offre !`, components: [] });
            }
            return true;
        }

        if (sub === 'rem' && interaction.isButton()) {
            if (trade.offers[uid].length === 0) {
                await interaction.reply({ content: "Ton offre est déjà vide.", ephemeral: true });
                return true;
            }
            const menu = new StringSelectMenuBuilder()
                .setCustomId(`tcg:tr:remsel:${threadId}`)
                .setPlaceholder('Choisis la carte à retirer de ton offre...')
                .addOptions(trade.offers[uid].map((cid, idx) => {
                    const c = cardById.get(cid);
                    return {
                        label: `${cid} • ${c ? c.name : cid}`.slice(0, 100),
                        description: `Retirer de l'offre`,
                        value: `${idx}:${cid}`
                    };
                }));
            await interaction.reply({ content: '➖ Quelle carte veux-tu retirer ?', components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
            return true;
        }

        if (sub === 'remsel' && interaction.isStringSelectMenu()) {
            const idx = parseInt(interaction.values[0].split(':')[0], 10);
            if (isNaN(idx) || idx < 0 || idx >= trade.offers[uid].length) return true;
            const [removed] = trade.offers[uid].splice(idx, 1);
            trade.lockedOffers[trade.initiatorId] = false;
            trade.lockedOffers[trade.targetId] = false;
            trade.unfairConfirm = null;
            tcgBridge.demanderSauvegarde();

            await refreshTradePanel(thread, trade);
            await interaction.update({ content: `🗑️ **${removed}** retirée de ton offre.`, components: [] });
            return true;
        }

        if (sub === 'search' && interaction.isButton()) {
            const modal = new ModalBuilder()
                .setCustomId(`tcg:tr:modal:${threadId}`)
                .setTitle('Ajouter une carte par nom ou numéro');
            const input = new TextInputBuilder()
                .setCustomId('card_query')
                .setLabel('Numéro (ex: 1-48, Ø1) ou Nom de carte')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            await interaction.showModal(modal);
            return true;
        }

        if (sub === 'modal' && interaction.isModalSubmit()) {
            if (trade.offers[uid].length >= 3) {
                await interaction.reply({ content: "⚠️ Limite de 3 cartes atteinte.", ephemeral: true });
                return true;
            }
            const query = interaction.fields.getTextInputValue('card_query');
            const res = resolveCardQuery(query);
            if (res.card?.isPerso) {
                await interaction.reply({
                    content: `❌ Les cartes personnalisées (\`${res.card.id}\`) sont **uniques et non échangeables** !`,
                    ephemeral: true
                });
                return true;
            }
            const u = getOrCreateTcgUser(uid);

            if (res.card) {
                const already = trade.offers[uid].filter(id => id === res.card.id).length;
                const remainingBefore = (u.cards[res.card.id] || 0) - already;
                if (remainingBefore < 1) {
                    await interaction.reply({ content: `❌ Tu ne possèdes pas d'exemplaire disponible pour cette carte.`, ephemeral: true });
                    return true;
                }
                const isLastCopy = remainingBefore === 1;
                trade.offers[uid].push(res.card.id);
                trade.lockedOffers[trade.initiatorId] = false;
                trade.lockedOffers[trade.targetId] = false;
                trade.unfairConfirm = null;
                tcgBridge.demanderSauvegarde();
                await refreshTradePanel(thread, trade);
                if (isLastCopy && !isTradeFreeModeActive()) {
                    await interaction.reply({
                        content: `✅ **${res.card.id} • ${res.card.name}** ajoutée à ton offre !\n⚠️ **Attention :** c'est ta **dernière carte** dans ton inventaire *(tu n'auras plus aucun exemplaire après l'échange)*.`,
                        ephemeral: true
                    });
                    await sendSilent(
                        thread,
                        `⚠️ **Prévention :** <@${uid}> vient de proposer \`${res.card.id}\` (**${res.card.name}**), qui est sa **dernière carte** dans son inventaire !`
                    ).catch(() => {});
                } else {
                    await interaction.reply({ content: `✅ **${res.card.id} • ${res.card.name}** ajoutée à ton offre !`, ephemeral: true });
                }
                return true;
            }

            const tradableMatches = res.matches.filter(c => {
                if (c.isPerso) return false;
                const already = trade.offers[uid].filter(id => id === c.id).length;
                return (u.cards[c.id] || 0) - already >= 1;
            });
            if (tradableMatches.length === 0) {
                await interaction.reply({ content: `❌ Aucune carte disponible trouvée pour \`${query}\`.`, ephemeral: true });
                return true;
            }

            const partnerId = uid === trade.initiatorId ? trade.targetId : trade.initiatorId;
            const uPartner = getOrCreateTcgUser(partnerId);
            const menu = new StringSelectMenuBuilder()
                .setCustomId(`tcg:tr:addsel:${threadId}`)
                .setPlaceholder('Plusieurs cartes trouvées...')
                .addOptions(tradableMatches.slice(0, 25).map(c => {
                    const already = trade.offers[uid].filter(id => id === c.id).length;
                    const rem = (u.cards[c.id] || 0) - already;
                    const missingForPartner = (uPartner.cards?.[c.id] || 0) <= 0;
                    return {
                        label: `${c.id} • ${c.name}`.slice(0, 100),
                        description: `${c.rarity} • x${u.cards[c.id]}${rem === 1 ? ' • ⚠️ Dernière copie' : ''}${missingForPartner ? ' • 🆕 Lui manque' : ''}`.slice(0, 100),
                        value: c.id
                    };
                }));
            await interaction.reply({ content: '🔍 Choisis la carte à ajouter :', components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
            return true;
        }
    }

    // ----- POST-ÉCHANGE (ENCHAÎNER OU FERMER) -----
    if (action === 'trpost' && interaction.isButton()) {
        const choice = parts[2];
        const threadId = parts[3];
        const data = getStoreData();
        const trade = data.activeTrades?.[threadId];
        if (!trade || trade.closed) {
            await interaction.reply({ content: "❌ Ce thread est déjà clôturé.", ephemeral: true });
            return true;
        }
        if (interaction.user.id !== trade.initiatorId && interaction.user.id !== trade.targetId) {
            await interaction.reply({ content: "Seul.es les deux participant.es peuvent voter !", ephemeral: true });
            return true;
        }

        trade.lastActivityAt = Date.now();
        trade.postTradeVotes[interaction.user.id] = choice;
        tcgBridge.demanderSauvegarde();

        const vA = trade.postTradeVotes[trade.initiatorId];
        const vB = trade.postTradeVotes[trade.targetId];

        if (vA === 'again' && vB === 'again') {
            trade.offers = { [trade.initiatorId]: [], [trade.targetId]: [] };
            trade.lockedOffers = { [trade.initiatorId]: false, [trade.targetId]: false };
            trade.postTradeVotes = { [trade.initiatorId]: null, [trade.targetId]: null };
            trade.unfairConfirm = null;
            await interaction.update({ content: '🔄 **Nouvel échange lancé !**', embeds: [], components: [] });
            const panel = await sendSilent(interaction.channel, buildTradeThreadPayload(trade));
            trade.statusMessageId = panel.id;
            tcgBridge.demanderSauvegarde();
            return true;
        }

        if (vA === 'close' && vB === 'close') {
            trade.closed = true;
            const hadTrades = (trade.tradeCount || 0) >= 1;
            delete data.activeTrades[threadId];
            tcgBridge.demanderSauvegarde();

            await interaction.update({
                content: hadTrades
                    ? '🔒 **Les deux membres ont validé la fermeture.** Le thread est désormais verrouillé et archivé.'
                    : '🗑️ **Fermeture validée.** Suppression du thread...',
                embeds: [],
                components: []
            });
            if (hadTrades) {
                await sendTradeRewardBeforeClose(interaction.channel, trade);
            }
            setTimeout(async () => {
                if (hadTrades) {
                    await interaction.channel.setLocked(true).catch(() => {});
                    await interaction.channel.setArchived(true).catch(() => {});
                } else {
                    await interaction.channel.delete().catch(() => {});
                }
            }, 2500);
            return true;
        }

        await interaction.update(buildPostTradeDecisionPayload(trade));
        return true;
    }

    // ----- !TCGOPENLAST (EPSYS-ONLY) -----
    if (action === 'ol') {
        if (interaction.user.id !== EPSYS_ID) {
            await interaction.reply({ content: "Réservé à Epsys 😌", ephemeral: true });
            return true;
        }
        const sub = parts[2];
        const list = getStoreData().recentOpenings || [];

        if (sub === 'sel' && interaction.isStringSelectMenu()) {
            const idx = parseInt(interaction.values[0], 10);
            const entry = list[idx];
            if (!entry) {
                await interaction.reply({ content: "❌ Ouverture introuvable.", ephemeral: true });
                return true;
            }
            await interaction.update(buildOpenLastDetailPayload(entry, idx, interaction.guild));
            return true;
        }

        if (sub === 'back' && interaction.isButton()) {
            await interaction.update({ ...buildOpenLastListPayload(interaction.guild), files: [], attachments: [] });
            return true;
        }

        if (sub === 'img' && interaction.isButton()) {
            const idx = parseInt(parts[3], 10);
            const entry = list[idx];
            if (!entry) {
                await interaction.reply({ content: "❌ Ouverture introuvable.", ephemeral: true });
                return true;
            }
            await interaction.deferUpdate();
            const cardsObj = (entry.cards || []).map(c => cardById.get(c.id)).filter(Boolean);
            if (cardsObj.length === 0) return true;
            const flags = (entry.cards || []).map(c => Boolean(c.isNew));
            const buffer = await renderBoosterRecapCanvas(cardsObj, flags, 'B', Boolean(entry.isGodPack));
            const detail = buildOpenLastDetailPayload(entry, idx, interaction.guild);
            detail.embeds[0].setImage('attachment://recap_openlast.jpg');
            detail.files = [new AttachmentBuilder(buffer, { name: 'recap_openlast.jpg' })];
            await interaction.editReply(detail);
            return true;
        }
    }

    // ----- !TCGPULLCHANCE (EPSYS-ONLY) -----
    if (action === 'pc') {
        if (interaction.user.id !== EPSYS_ID) {
            await interaction.reply({ content: "Réservé à Epsys 😌", ephemeral: true });
            return true;
        }
        const sub = parts[2];
        const sessionId = parts[3];
        const session = pullChanceSessions.get(sessionId);
        if (!session) {
            await interaction.reply({ content: "⏳ Session `!tcgpullchance` expirée. Relance la commande.", ephemeral: true });
            return true;
        }
        const data = getStoreData();

        if (sub === 'role' && interaction.isButton()) {
            session.targetKey = PULL_BOOST_ROLE_KEY;
            await interaction.update(buildPullChancePayload(sessionId, session, interaction.guild));
            return true;
        }
        if (sub === 'user' && interaction.isUserSelectMenu()) {
            session.targetKey = interaction.values[0];
            await interaction.update(buildPullChancePayload(sessionId, session, interaction.guild));
            return true;
        }
        if (sub === 'cpage' && interaction.isButton()) {
            session.cardPage = parseInt(parts[4], 10) || 0;
            await interaction.update(buildPullChancePayload(sessionId, session, interaction.guild));
            return true;
        }
        if (sub === 'card' && interaction.isStringSelectMenu()) {
            const val = interaction.values[0];
            if (val !== 'none') session.cardId = val;
            await interaction.update(buildPullChancePayload(sessionId, session, interaction.guild));
            return true;
        }
        if (sub === 'mult' && interaction.isStringSelectMenu()) {
            const rawVal = interaction.values[0];
            if (rawVal === PULL_BOOST_GUARANTEED || rawVal === PULL_BOOST_TRIPLE) {
                session.mult = rawVal;
            } else {
                const mVal = parseInt(rawVal, 10);
                if (!isNaN(mVal) && mVal >= 1) session.mult = mVal;
            }
            await interaction.update(buildPullChancePayload(sessionId, session, interaction.guild));
            return true;
        }
        if (sub === 'apply' && interaction.isButton()) {
            if (!session.targetKey || !session.cardId) {
                await interaction.reply({ content: "❌ Choisis une cible et une carte.", ephemeral: true });
                return true;
            }
            if (!data.pullBoosts) data.pullBoosts = {};
            if (session.mult !== PULL_BOOST_GUARANTEED && session.mult !== PULL_BOOST_TRIPLE && session.mult <= 1) {
                if (data.pullBoosts[session.targetKey]) {
                    delete data.pullBoosts[session.targetKey][session.cardId];
                    if (Object.keys(data.pullBoosts[session.targetKey]).length === 0) {
                        delete data.pullBoosts[session.targetKey];
                    }
                }
            } else {
                if (!data.pullBoosts[session.targetKey]) data.pullBoosts[session.targetKey] = {};
                data.pullBoosts[session.targetKey][session.cardId] = session.mult;
            }
            tcgBridge.demanderSauvegarde();
            await interaction.update(buildPullChancePayload(sessionId, session, interaction.guild));
            return true;
        }
        if (sub === 'clear' && interaction.isButton()) {
            if (session.targetKey && data.pullBoosts?.[session.targetKey]) {
                delete data.pullBoosts[session.targetKey];
                tcgBridge.demanderSauvegarde();
            }
            await interaction.update(buildPullChancePayload(sessionId, session, interaction.guild));
            return true;
        }
        if (sub === 'clearall' && interaction.isButton()) {
            data.pullBoosts = {};
            tcgBridge.demanderSauvegarde();
            await interaction.update(buildPullChancePayload(sessionId, session, interaction.guild));
            return true;
        }
    }

    // ----- !TCGPUNITION (EPSYS-ONLY) -----
    if (action === 'pun') {
        if (interaction.user.id !== EPSYS_ID) {
            await interaction.reply({ content: "Réservé à Epsys 😌", ephemeral: true });
            return true;
        }
        const sub = parts[2];
        const sessionId = parts[3];
        const session = punitionSessions.get(sessionId);
        if (!session) {
            await interaction.reply({ content: "⏳ Session `!tcgpunition` expirée. Relance la commande.", ephemeral: true });
            return true;
        }
        const data = getStoreData();
        if (!data.pullPunishments) data.pullPunishments = {};

        if (sub === 'user' && interaction.isUserSelectMenu()) {
            const chosenId = interaction.values[0];
            const chosenMember = await interaction.guild.members.fetch(chosenId).catch(() => null);
            if (chosenMember?.user?.bot) {
                await interaction.reply({ content: "❌ Impossible de cibler un bot.", ephemeral: true });
                return true;
            }
            session.targetUserId = chosenId;
            await interaction.update(buildPunitionPayload(sessionId, session, interaction.guild));
            return true;
        }

        if (sub === 'rar' && interaction.isButton()) {
            const code = parts[4];
            const info = PUNITION_RARITIES.find(r => r.code === code);
            if (!session.targetUserId || !info) return true;
            const userMap = data.pullPunishments[session.targetUserId] || {};
            const current = typeof userMap[info.rarity] === 'number' ? userMap[info.rarity] : 1;
            const idx = PUNITION_LEVELS.indexOf(current);
            const next = PUNITION_LEVELS[(idx === -1 ? 0 : idx + 1) % PUNITION_LEVELS.length];

            if (next >= 1) {
                delete userMap[info.rarity];
            } else {
                userMap[info.rarity] = next;
            }
            if (Object.keys(userMap).length === 0) {
                delete data.pullPunishments[session.targetUserId];
            } else {
                data.pullPunishments[session.targetUserId] = userMap;
            }
            tcgBridge.demanderSauvegarde();
            await interaction.update(buildPunitionPayload(sessionId, session, interaction.guild));
            return true;
        }

        if ((sub === 'all5' || sub === 'all0') && interaction.isButton()) {
            if (!session.targetUserId) return true;
            const val = sub === 'all0' ? 0 : 0.2;
            const userMap = {};
            for (const r of PUNITION_RARITIES) userMap[r.rarity] = val;
            data.pullPunishments[session.targetUserId] = userMap;
            tcgBridge.demanderSauvegarde();
            await interaction.update(buildPunitionPayload(sessionId, session, interaction.guild));
            return true;
        }

        if (sub === 'clear' && interaction.isButton()) {
            if (session.targetUserId && data.pullPunishments[session.targetUserId]) {
                delete data.pullPunishments[session.targetUserId];
                tcgBridge.demanderSauvegarde();
            }
            await interaction.update(buildPunitionPayload(sessionId, session, interaction.guild));
            return true;
        }

        if (sub === 'clearall' && interaction.isButton()) {
            data.pullPunishments = {};
            tcgBridge.demanderSauvegarde();
            await interaction.update(buildPunitionPayload(sessionId, session, interaction.guild));
            return true;
        }
    }

    // ----- !RGDXPROXIES SÉLECTEUR PAR SET (EPSYS-ONLY) -----
    if (action === 'proxy' && parts[2] === 'gen' && interaction.isStringSelectMenu()) {
        if (interaction.user.id !== EPSYS_ID) {
            await interaction.reply({ content: "Réservé à Epsys 😌", ephemeral: true });
            return true;
        }
        const scope = interaction.values[0];
        let scopeLabel = 'Tous les Sets + Cartes Perso';
        if (scope === 'perso') scopeLabel = 'Cartes Perso';
        else if (scope.startsWith('set:')) scopeLabel = getSetConfig(parseInt(scope.slice(4), 10)).name;

        const prep = collectProxyJobs(scope);
        if (prep.jobs.length === 0) {
            await interaction.reply({ content: `❌ Aucune carte chargée dans **${scopeLabel}** pour le moment.`, ephemeral: true });
            return true;
        }
        if (proxyWarmupRunning) {
            await interaction.reply({ content: '⏳ Un warmup des proxies est déjà en cours !', ephemeral: true });
            return true;
        }

        const totalItems = prep.jobs.length + (assetPaths.mysteryCard ? prep.mysterySizes.length : 0);
        await interaction.deferUpdate();
        await interaction.editReply({
            content: `🔥 **Warmup RegaDex démarré (${scopeLabel}) !**\n• **${totalItems}** miniatures à vérifier/générer...\n⏳ Progression : \`0/${totalItems}\` (0%)...`,
            embeds: [],
            components: [],
            files: [],
            attachments: []
        });

        await runProxyWarmup(scope, scopeLabel, async (text) => {
            await interaction.editReply({
                content: text,
                embeds: [],
                components: [],
                files: [],
                attachments: []
            }).catch(() => {});
        });
        return true;
    }

    // ----- !TCGPERSO VISUALISEUR ADMIN (EPSYS-ONLY) -----
    if (action === 'persoview') {
        if (interaction.user.id !== EPSYS_ID) {
            await interaction.reply({ content: "Réservé à Epsys 😌", ephemeral: true });
            return true;
        }
        const sub = parts[2];

        if (sub === 'sel' && interaction.isStringSelectMenu()) {
            const cardId = interaction.values[0];
            await interaction.deferUpdate();
            await interaction.editReply({ content: null, ...buildPersoAdminPayload(cardId, 0, interaction.guild), attachments: [] });
            return true;
        }

        if (sub === 'card' && interaction.isButton()) {
            const dir = parts[3];
            const currentId = parts[4];
            if (persoCatalog.length === 0) {
                await interaction.update({ content: null, ...buildPersoAdminPayload(null, 0, interaction.guild), attachments: [] });
                return true;
            }
            let idx = persoCatalog.findIndex(c => c.id === currentId);
            if (idx === -1) idx = 0;
            const nextIdx = dir === 'prev'
                ? (idx - 1 + persoCatalog.length) % persoCatalog.length
                : (idx + 1) % persoCatalog.length;
            await interaction.deferUpdate();
            await interaction.editReply({ content: null, ...buildPersoAdminPayload(persoCatalog[nextIdx].id, 0, interaction.guild), attachments: [] });
            return true;
        }

        if (sub === 'page' && interaction.isButton()) {
            const targetPage = parseInt(parts[3], 10) || 0;
            const firstOfPage = persoCatalog[targetPage * 25]?.id || null;
            await interaction.deferUpdate();
            await interaction.editReply({ content: null, ...buildPersoAdminPayload(firstOfPage, targetPage, interaction.guild), attachments: [] });
            return true;
        }

        if (sub === 'rescan' && interaction.isButton()) {
            const currentPage = parseInt(parts[3], 10) || 0;
            const currentId = parts[4] === 'none' ? null : parts[4];
            await interaction.deferUpdate();
            await scanSet1Cards(client);
            await interaction.editReply({ content: null, ...buildPersoAdminPayload(currentId, currentPage, interaction.guild), attachments: [] });
            return true;
        }
    }

    return false;
}

function addTcgPointsFromRoulette(userId, points, member) {
    if (!member || !hasTcgRole(member)) return false;
    const u = getOrCreateTcgUser(userId);
    u.points = (u.points || 0) + points;
    tcgBridge.demanderSauvegarde();
    return true;
}

function addTcgBoostersFromRoulette(userId, qty, member) {
    if (!member || !hasTcgRole(member)) return false;
    const u = getOrCreateTcgUser(userId);
    u.inventory.booster = (u.inventory.booster || 0) + qty;
    tcgBridge.demanderSauvegarde();
    return true;
}

function reduceTcgBoosterCooldown(userId, reductionMs = 3 * 60 * 60 * 1000, member = null) {
    if (member && !hasTcgRole(member)) return { applied: false, noRole: true };
    const u = getOrCreateTcgUser(userId);
    if (u.freeBoosters >= MAX_FREE_BOOSTERS) {
        return { applied: false, alreadyFull: true, freeBoosters: u.freeBoosters, maxFree: MAX_FREE_BOOSTERS };
    }
    const freeBefore = u.freeBoosters;
    u.lastFreeRechargeAt = (u.lastFreeRechargeAt || Date.now()) - Math.max(0, reductionMs);
    syncFreeBoosters(u);
    tcgBridge.demanderSauvegarde();
    if (getStoreData().notifs?.[userId]) {
        armerNotifBooster(userId, tcgBridge.client);
    }
    return {
        applied: true,
        alreadyFull: false,
        grantedFree: u.freeBoosters > freeBefore,
        freeBoosters: u.freeBoosters,
        maxFree: MAX_FREE_BOOSTERS,
        nextAt: getNextBoosterTimestamp(u)
    };
}

async function grantMinigameTcgPoints(client, userIds, points = 2) {
    if (!Array.isArray(userIds) || userIds.length === 0) return [];
    const c = client || tcgBridge.client;
    if (!c) return [];
    const guild = c.guilds.cache.get(GUILD_ID) || await c.guilds.fetch(GUILD_ID).catch(() => null);
    if (!guild) return [];

    const rewarded = [];
    for (const uid of [...new Set(userIds)]) {
        const member = guild.members.cache.get(uid) || await guild.members.fetch(uid).catch(() => null);
        if (member && hasTcgRole(member)) {
            const u = getOrCreateTcgUser(uid);
            u.points = (u.points || 0) + points;
            rewarded.push(uid);
        }
    }
    if (rewarded.length > 0) {
        tcgBridge.demanderSauvegarde();
    }
    return rewarded;
}

module.exports = {
    TCG_ROLE_ID,
    TCG_CHANNEL_ID,
    TCG_TEST_CHANNEL_ID,
    TCG_TRADE_LOG_CHANNEL_ID,
    TCG_PANTHEON_CHANNEL_ID,
    AFK_VOCAL_CHANNEL_ID,
    hasTcgRole,
    initTcgState,
    scanSet1Cards,
    getTcgCardsCount,
    restaurerNotifsTcg,
    verifierInactiviteTradesTcg,
    verifierBoosterHebdoTcg,
    verifierQueteCommunautaireTcg,
    backfillRecentOpeningsTcg,
    trackTcgMessagePoint,
    trackTcgVocalMinute,
    trackTcgRoulettePoint,
    addTcgPointsFromRoulette,
    addTcgBoostersFromRoulette,
    reduceTcgBoosterCooldown,
    grantMinigameTcgPoints,
    handleTcgTradeThreadMessage,
    handleTcgMessage,
    handleTcgSlash,
    handleTcgInteraction
};