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

const SET1_NAME = 'Set 1 - Vestiges Regaïens';
const BOOSTER_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6h
const HALF_COOLDOWN_MS = 3 * 60 * 60 * 1000; // 3h
const MAX_FREE_BOOSTERS = 2;
const BOOSTER_GIF_DELAY_MS = 4000; // 4 secondes
const TRADE_INACTIVITY_MS = 24 * 60 * 60 * 1000; // 24h

const POINTS_PER_BOOSTER = 5;
const POINTS_PER_DUPLICATE = 3;
const POINTS_PER_TRADE = 3;
const MESSAGES_PER_POINT = 15;
const VOCAL_MINUTES_PER_POINT = 10;

const PULL_BOOST_ROLE_KEY = 'ROLE_TCG';
const PULL_MULTIPLIERS = [1, 2, 3, 5, 10, 20, 50, 100];
const PUNITION_RARITIES = [
    { code: 'E', rarity: 'Épique', emoji: '🟣' },
    { code: 'L', rarity: 'Légendaire', emoji: '🟡' },
    { code: 'F', rarity: 'Full Art', emoji: '🌈' },
    { code: 'N', rarity: 'Négative', emoji: '🕳️' }
];
const PUNITION_LEVELS = [1, 0.5, 0.2, 0.1, 0];

const STORE_PRICES = {
    booster: 100,
    luckyBooster: 75,
    holoTransform: 50,
    halfCooldown: 25
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
    'Négative': 5
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
    'Négative': { color: 0x2ecc71, hex: '#2ECC71', glow: 'rgba(46, 204, 113, 0.55)', emoji: '🕳️' }
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
    trackBattlePassProgress: () => {}
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
    return data;
}

// ==========================================
//   CATALOGUE & SCAN AUTOMATIQUE SET 1
// ==========================================

const TCG_ROOT = path.resolve(process.cwd(), 'TCG');
const TCG_ASSETS_DIR = path.join(TCG_ROOT, 'Assets');
const TCG_SET1_DIR = path.join(TCG_ROOT, 'Set 1');
const TCG_PROXIES_DIR = path.join(TCG_ROOT, 'Proxies'); // Volume persistant (/app/TCG/Proxies)

const PROXY_TTL_MS = 2 * 60 * 1000; // Micro-cache RAM éphémère de 2 min sur les miniatures uniquement
const PROXY_MAX_RAM_ITEMS = 120;

let cardCatalog = [];
let cardById = new Map();
let cardByNumCode = new Map();
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

function parseCardFilename(filename, category, folderRarity) {
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

    const sortIndex = isNegative ? 1000 + numValue : numValue;
    const id = `1-${numCode}`;

    return {
        id,
        setNumber: 1,
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

    assetPaths = {
        openingGif: findExistingFile(TCG_ASSETS_DIR, ['Ouverture Set 1.gif']),
        mysteryCard: findExistingFile(TCG_ASSETS_DIR, ['Carte mystère.png', 'Carte mystere.png']),
        boosterPng: findExistingFile(TCG_ASSETS_DIR, ['Booster Set 1.png']),
        eventBanner: findExistingFile(TCG_SET1_DIR, ['Event banner Set 1.png']) || findExistingFile(TCG_ASSETS_DIR, ['Event banner Set 1.png']),
        set1Logo: findExistingFile(findSubdir(TCG_ASSETS_DIR, ['Set 1']) || path.join(TCG_ASSETS_DIR, 'Set 1'), ['Logo.png']),
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

    if (!assetPaths.openingGif) missingAssets.push('TCG/Assets/Ouverture Set 1.gif');
    if (!assetPaths.mysteryCard) missingAssets.push('TCG/Assets/Carte mystère.png');
    if (!assetPaths.boosterPng) missingAssets.push('TCG/Assets/Booster Set 1.png');
    if (!assetPaths.eventBanner) missingAssets.push('TCG/Set 1/Event banner Set 1.png');
    if (!assetPaths.set1Logo) missingAssets.push('TCG/Set 1/Logo.png');
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

    for (const cat of CATEGORIES) {
        const catDir = findSubdir(TCG_SET1_DIR, [cat]);
        if (!catDir) {
            unrecognizedFiles.push(`Dossier catégorie manquant : TCG/Set 1/${cat}`);
            continue;
        }

        for (const rf of rarityFolders) {
            const rarDir = findSubdir(catDir, rf.candidates);
            if (!rarDir) {
                unrecognizedFiles.push(`Dossier rareté manquant : TCG/Set 1/${cat}/${rf.key}`);
                continue;
            }

            const files = fs.readdirSync(rarDir).filter(f => !f.startsWith('.'));
            for (const file of files) {
                const fullPath = path.join(rarDir, file);
                if (fs.statSync(fullPath).isDirectory()) continue;

                const parsed = parseCardFilename(file, cat, rf.key);
                if (!parsed) {
                    unrecognizedFiles.push(`TCG/Set 1/${cat}/${path.basename(rarDir)}/${file}`);
                    continue;
                }
                parsed.filePath = fullPath;

                if (newById.has(parsed.id)) {
                    duplicateCodes.push(`${parsed.id} (${file} vs ${newById.get(parsed.id).filename})`);
                    continue;
                }

                newCatalog.push(parsed);
                newById.set(parsed.id, parsed);
                newByNumCode.set(parsed.numCode.toUpperCase(), parsed);
            }
        }
    }

    // Lier chaque carte Holo à sa version normale
    for (const card of newCatalog) {
        if (!card.isHolo) continue;
        const baseMatch = newCatalog.find(c =>
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

    // Vérifier les 96 classiques + 13 négatives = 109 attendues
    for (let i = 1; i <= 96; i++) {
        if (!newByNumCode.has(`${i}`)) missingCards.push(`1-${i}`);
    }
    for (let i = 1; i <= 13; i++) {
        if (!newByNumCode.has(`Ø${i}`)) missingCards.push(`1-Ø${i}`);
    }

    newCatalog.sort((a, b) => a.sortIndex - b.sortIndex);
    cardCatalog = newCatalog;
    cardById = newById;
    cardByNumCode = newByNumCode;
    proxyRamCache.clear();
    if (proxyRamClearTimer) {
        clearTimeout(proxyRamClearTimer);
        proxyRamClearTimer = null;
    }
    hotBuffers.clear();

    console.log(`🃏 RegaDex ${SET1_NAME} scanné : ${cardCatalog.length}/109 cartes reconnues.`);

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
                luckyBooster: 99,
                holoTransform: 99,
                halfCooldown: 99
            },
            activeBonuses: {
                luckyBooster: false,
                halfCooldown: false
            },
            pityRare: false,
            theme: 'B',
            notifFreq: 'each',
            favoriteCardId: cardCatalog[0]?.id || null,
            stats: {
                boostersOpened: 0,
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
                luckyBooster: 0,
                holoTransform: 0,
                halfCooldown: 0
            },
            activeBonuses: {
                luckyBooster: false,
                halfCooldown: false
            },
            pityRare: false,
            theme: 'B',
            notifFreq: 'each',
            favoriteCardId: null,
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
    if (!u.inventory) u.inventory = { booster: 0, luckyBooster: 0, holoTransform: 0, halfCooldown: 0 };
    if (!u.activeBonuses) u.activeBonuses = { luckyBooster: false, halfCooldown: false };
    if (typeof u.pityRare !== 'boolean') u.pityRare = false;
    if (u.theme !== 'W' && u.theme !== 'B') u.theme = 'B';
    if (u.notifFreq !== 'each' && u.notifFreq !== 'full') u.notifFreq = 'each';
    if (!u.stats) u.stats = { boostersOpened: 0, tradesCompleted: 0, duplicatesObtained: 0 };

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
    return (u.freeBoosters || 0) + (u.inventory?.booster || 0);
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

function getUserCompletionStats(u) {
    let uniqueCount = 0;
    let totalCopies = 0;
    const byCategory = {
        'Items': { owned: 0, total: 0 },
        'Personnages': { owned: 0, total: 0 },
        'Références': { owned: 0, total: 0 }
    };

    for (const c of cardCatalog) {
        if (byCategory[c.category]) byCategory[c.category].total++;
        const q = u.cards?.[c.id] || 0;
        if (q > 0) {
            uniqueCount++;
            totalCopies += q;
            if (byCategory[c.category]) byCategory[c.category].owned++;
        }
    }
    return { uniqueCount, totalCopies, totalSet: cardCatalog.length || 109, byCategory };
}

function resolveCardQuery(rawQuery) {
    if (!rawQuery) return { card: null, matches: [] };
    const q = rawQuery.trim();
    if (!q) return { card: null, matches: [] };

    // 1. Format explicite 1-48, 1-Ø12, Ø12, 48
    const cleaned = q.replace(/^#/, '').trim();
    const codeMatch = cleaned.match(/^(?:1\s*-\s*)?(Ø|O)?\s*(\d+)$/iu);
    if (codeMatch) {
        const isNeg = Boolean(codeMatch[1]);
        const num = parseInt(codeMatch[2], 10);
        const key = isNeg ? `Ø${num}` : `${num}`;
        const found = cardByNumCode.get(key.toUpperCase());
        if (found) return { card: found, matches: [found] };
    }

    // 2. Recherche par nom exact puis partiel
    const normQ = normalizeText(q);
    if (!normQ) return { card: null, matches: [] };

    const exact = cardCatalog.filter(c => c.normalizedName === normQ || c.normalizedDisplayName === normQ);
    if (exact.length === 1) return { card: exact[0], matches: exact };
    if (exact.length > 1) return { card: null, matches: exact };

    const partial = cardCatalog.filter(c =>
        c.normalizedName.includes(normQ) ||
        (c.normalizedDisplayName && c.normalizedDisplayName.includes(normQ)) ||
        c.id.toLowerCase() === cleaned.toLowerCase()
    );
    if (partial.length === 1) return { card: partial[0], matches: partial };
    return { card: null, matches: partial };
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

function drawBoosterCards(u, userId = null, member = null) {
    const luckyActive = Boolean(u.activeBonuses?.luckyBooster);
    const pityActive = Boolean(u.pityRare);
    const raritySums = getRarityBaseWeightSums();
    const picked = [];
    const pickedIds = new Set();

    // Si pityRare est actif : garantir 1 carte de rareté 'Rare'
    let slots = 3;
    if (pityActive) {
        const rareCandidates = cardCatalog.filter(c => c.rarity === 'Rare' && !pickedIds.has(c.id));
        if (rareCandidates.length > 0) {
            const c = pickWeightedCard(rareCandidates, raritySums, userId, member);
            picked.push(c);
            pickedIds.add(c.id);
            slots--;
        }
    }

    for (let i = 0; i < slots; i++) {
        let pool = cardCatalog.filter(c => !(luckyActive && c.rarity === 'Commune') && !pickedIds.has(c.id) && getEffectiveCardWeight(c, raritySums, userId, member) > 0);
        if (pool.length === 0) {
            pool = cardCatalog.filter(c => !pickedIds.has(c.id) && getEffectiveCardWeight(c, raritySums, userId, member) > 0);
        }
        const fallback = pool.length > 0 ? pool : cardCatalog.filter(c => !pickedIds.has(c.id));
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

    // Mise à jour Pity : si les 3 cartes sont Communes, le PROCHAIN booster aura 1 Rare garantie
    const allCommunes = picked.length === 3 && picked.every(c => c.rarity === 'Commune');
    u.pityRare = allCommunes;

    return { cards: picked, luckyUsed: luckyActive, pityUsed: pityActive, triggeredNextPity: allCommunes };
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

function getFilteredSortedCards(categoryFilter, sortMode, u = null, ownedOnly = false, rarityCode = 'all') {
    let list = categoryFilter === 'complet'
        ? [...cardCatalog]
        : cardCatalog.filter(c => c.category === categoryFilter);

    const targetRarity = BINDER_RARITY_CODES[rarityCode] || null;
    if (targetRarity) {
        list = list.filter(c => c.rarity === targetRarity);
    }

    if (ownedOnly && u) {
        list = list.filter(c => (u.cards?.[c.id] || 0) > 0);
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
        category = 'complet',
        perPageMode = '18',
        page = 0,
        sortMode = 'number',
        rarityFilter = 'all',
        ownedOnly = false
    } = options;

    const W = 1600;
    const H = 900;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    const isLight = u.theme === 'W';
    const textColor = isLight ? '#111111' : '#FFFFFF';
    const subTextColor = isLight ? '#333333' : '#CCCCCC';

    drawBackground(ctx, isLight ? 'W' : 'B', W, H);

    // Logo Set 1 - Vestiges Regaïens centré et légèrement remonté en arrière-plan
    if (assetPaths.set1Logo) {
        const logoW = 1132;
        const logoH = 467;
        const logoProxy = await loadAssetProxy(assetPaths.set1Logo, logoW, logoH, { cacheKey: 'Set1_Logo.png' });
        if (logoProxy?.img) {
            const logoX = Math.round((W - logoW) / 2);
            const logoY = Math.round((H - logoH) / 2) - 24;
            ctx.save();
            ctx.globalAlpha = isLight ? 0.85 : 0.90;
            ctx.drawImage(logoProxy.img, logoX - logoProxy.pad, logoY - logoProxy.pad);
            ctx.restore();
        }
    }

    const allCategoryCards = getFilteredSortedCards(category, sortMode, u, false, rarityFilter);
    const cardsList = ownedOnly ? allCategoryCards.filter(c => (u.cards?.[c.id] || 0) > 0) : allCategoryCards;
    const grid = getBinderGridConfig(perPageMode, cardsList.length);
    const totalPages = Math.max(1, Math.ceil(cardsList.length / grid.perPage));
    const safePage = Math.max(0, Math.min(page, totalPages - 1));
    const slice = cardsList.slice(safePage * grid.perPage, (safePage + 1) * grid.perPage);

    // En-tête (LEMON MILK Bold)
    const ownedInView = allCategoryCards.filter(c => (u.cards?.[c.id] || 0) > 0).length;
    const totalInView = allCategoryCards.length;
    const pct = totalInView > 0 ? Math.round((ownedInView / totalInView) * 100) : 0;
    const rarityLabel = BINDER_RARITY_CODES[rarityFilter];
    const baseLabel = category === 'complet' ? `RegaDex • ${SET1_NAME}` : `RegaDex • ${category}`;
    const headerTags = [];
    if (rarityLabel) headerTags.push(rarityLabel);
    if (ownedOnly) headerTags.push('Possédées');
    const headerLabel = headerTags.length > 0 ? `${baseLabel} (${headerTags.join(' • ')})` : baseLabel;

    ctx.fillStyle = isLight ? 'rgba(255,255,255,0.72)' : 'rgba(15,17,24,0.72)';
    drawRoundRect(ctx, 32, 18, W - 64, 62, 14);
    ctx.fill();

    ctx.fillStyle = textColor;
    ctx.font = 'bold 25px "LemonMilk", "Sans"';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const displayName = targetUser.displayName || targetUser.username || 'Collectionneur';
    ctx.fillText(`${headerLabel} — ${displayName}`, 56, 49, W * 0.56);

    ctx.textAlign = 'right';
    ctx.font = 'bold 20px "LemonMilk", "Sans"';
    ctx.fillText(`${ownedInView}/${totalInView} (${pct}%)  •  Page ${safePage + 1}/${totalPages}`, W - 56, 49, W * 0.34);

    // Zone grille
    const { padX, startY, cellW, cellH, labelH, cardW, cardH, fontSize } = computeBinderCardDims(W, H, grid);
    const mysteryProxy = ownedOnly ? null : await loadAssetProxy(assetPaths.mysteryCard, cardW, cardH, { mysteryShadow: true });

    if (slice.length === 0) {
        ctx.fillStyle = subTextColor;
        ctx.font = 'bold 28px "LemonMilk", "Sans"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(rarityLabel ? 'Aucune carte trouvée pour ce filtre.' : 'Aucune carte possédée dans cette catégorie.', W / 2, H / 2 + 20, W - 120);
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

async function renderBoosterRecapCanvas(cards, isNewFlags, theme = 'B') {
    const W = 1280;
    const H = 1040;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    const isLight = theme === 'W';

    drawBackground(ctx, isLight ? 'W' : 'B', W, H);

    ctx.fillStyle = isLight ? 'rgba(255,255,255,0.78)' : 'rgba(12,14,20,0.78)';
    drawRoundRect(ctx, 40, 22, W - 80, 66, 16);
    ctx.fill();

    ctx.fillStyle = isLight ? '#111111' : '#FFFFFF';
    ctx.font = 'bold 31px "LemonMilk", "Sans"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Récapitulatif du Booster ${SET1_NAME}`, W / 2, 55, W - 120);

    // Triangle inversé : 2 cartes en haut, 1 centrée en bas
    const cardW = 285;
    const cardH = 399;
    const positions = [
        { x: W / 2 - cardW - 60, y: 112 },
        { x: W / 2 + 60, y: 112 },
        { x: W / 2 - cardW / 2, y: 565 }
    ];

    for (let i = 0; i < Math.min(cards.length, 3); i++) {
        const card = cards[i];
        const pos = positions[i];

        const proxy = await loadCardProxy(card, cardW, cardH, { glow: true });
        if (proxy?.img) {
            ctx.drawImage(proxy.img, pos.x - proxy.pad, pos.y - proxy.pad);
        }

        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.font = 'bold 18px "LemonMilk", "Sans"';
        ctx.fillStyle = isLight ? '#111111' : '#FFFFFF';
        const statusTxt = isNewFlags[i] ? 'NOUVELLE !' : 'DOUBLON (+3 PTS)';
        ctx.fillText(`${card.id} • ${card.rarity} • ${statusTxt}`, pos.x + cardW / 2, pos.y + cardH + 10, cardW + 90);
    }

    return toJpeg(canvas, 0.90);
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

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 28px "LemonMilk", "Sans"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Échange RegaDex terminé', W / 2, 68, W - 120);

    // Flèche centrale en Sans pour garantir le glyphe Unicode ⇄
    ctx.fillStyle = '#2ECC71';
    ctx.font = 'bold 46px "Sans"';
    ctx.fillText('⇄', W / 2, H / 2 + 10);

    const drawSide = async (title, list, startX, boxW) => {
        ctx.fillStyle = '#262C3D';
        drawRoundRect(ctx, startX, 112, boxW, H - 160, 16);
        ctx.fill();

        ctx.fillStyle = '#F1C40F';
        ctx.font = 'bold 22px "LemonMilk", "Sans"';
        ctx.textAlign = 'center';
        ctx.fillText(`Offre de ${title}`, startX + boxW / 2, 146, boxW - 40);

        if (list.length === 0) {
            ctx.fillStyle = '#AAAAAA';
            ctx.font = 'bold 20px "LemonMilk", "Sans"';
            ctx.fillText('Aucune carte', startX + boxW / 2, H / 2 + 10, boxW - 40);
            return;
        }

        const cW = 165;
        const cH = 231;
        const gap = 16;
        const totalW = list.length * cW + (list.length - 1) * gap;
        const firstX = startX + (boxW - totalW) / 2;

        for (let i = 0; i < list.length; i++) {
            const card = cardById.get(list[i]);
            if (!card) continue;
            const x = firstX + i * (cW + gap);
            const y = 195;
            const proxy = await loadCardProxy(card, cW, cH, { glow: false });
            if (proxy?.img) ctx.drawImage(proxy.img, x, y, cW, cH);

            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 15px "LemonMilk", "Sans"';
            ctx.textAlign = 'center';
            ctx.fillText(card.id, x + cW / 2, y + cH + 18, cW + 10);
        }
    };

    await drawSide(nameA, cardsA, 48, 580);
    await drawSide(nameB, cardsB, W - 48 - 580, 580);

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
    if (u.pityRare) activeEffects.push('✨ **Pity Rare garantie**');

    const favCard = u.favoriteCardId && (u.cards?.[u.favoriteCardId] || 0) > 0
        ? cardById.get(u.favoriteCardId)
        : null;

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
                value:
                    `• Prêts à ouvrir : **${totalAvail}**\n` +
                    `• Gratuits : **${u.freeBoosters}/${MAX_FREE_BOOSTERS}**\n` +
                    `• Inventaire : **${u.inventory?.booster || 0}**\n` +
                    timerLine,
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
            name: '🔥 Effets actifs sur ton prochain booster',
            value: activeEffects.join('\n'),
            inline: false
        });
    }

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
            .setDisabled(totalAvail <= 0),
        new ButtonBuilder()
            .setCustomId(`tcg:binder:open:${userId}:${userId}:1`)
            .setLabel('Classeur')
            .setEmoji('📖')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`tcg:profile:${userId}:1:0`)
            .setLabel('Mon profil')
            .setEmoji('👤')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`tcg:store:open:${userId}:1`)
            .setLabel('Store')
            .setEmoji('🛒')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`tcg:claim:open:${userId}:1`)
            .setLabel('Inventaire')
            .setEmoji('🎒')
            .setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:top:total:${userId}:1`)
            .setLabel('Top')
            .setEmoji('🏆')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`tcg:hubflex:${userId}`)
            .setLabel('Définir Flex')
            .setEmoji('⭐')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`tcg:theme:${userId}`)
            .setLabel(u.theme === 'W' ? 'Mode Clair' : 'Mode Nuit')
            .setEmoji(u.theme === 'W' ? '☀️' : '🌙')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`tcg:notif:menu:${userId}:1`)
            .setLabel(hasNotif ? 'Notifications ✓' : 'Notifications')
            .setEmoji('🔔')
            .setStyle(hasNotif ? ButtonStyle.Primary : ButtonStyle.Secondary)
    );

    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:help:${userId}:1`)
            .setLabel('Commandes')
            .setEmoji('📖')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`tcg:guide:${userId}:1`)
            .setLabel('Guide')
            .setEmoji('📘')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`tcg:credits:${userId}:1`)
            .setLabel('Crédits')
            .setEmoji('📜')
            .setStyle(ButtonStyle.Secondary),
        buildCloseButton(userId)
    );

    return [row1, row2, row3];
}

function buildProfilePayload(member, u, fromHub = false, showRarities = false) {
    const comp = getUserCompletionStats(u);
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
        ? cardById.get(u.favoriteCardId)
        : null;

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
            `• 🔁 **Doublons obtenus :** **${u.stats?.duplicatesObtained || 0}**\n` +
            `• 🔄 **Échanges effectués :** **${u.stats?.tradesCompleted || 0}**\n` +
            `• 💎 **Carte la plus rare :** ${rarestLine}\n` +
            `• ⭐ **Carte Flex :** ${favCard ? `\`${favCard.id}\` **${favCard.name}**` : '*Aucune*'}` +
            rarityBlock
        )
        .setFooter({ text: `RegaDex TCG • ${SET1_NAME}` });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:profile:${member.id}:${fromHub ? '1' : '0'}:${showRarities ? '0' : '1'}`)
            .setLabel(showRarities ? 'Nb cartes par rareté : ON' : 'Nb cartes par rareté : OFF')
            .setEmoji('💎')
            .setStyle(showRarities ? ButtonStyle.Success : ButtonStyle.Secondary),
        buildAccueilButton(member.id),
        buildCloseButton(member.id)
    );

    return { embeds: [embed], components: [row] };
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
            `• \`!open\` • \`!booster\` — Ouvrir un booster ou voir ton timer\n` +
            `• \`!tcg notif\` — Configurer tes notifications de booster *(choix permanent, ici ou en MP)*\n\n` +
            `### 📚 Collection & Classement\n` +
            `• \`!classeur\` *(\`@membre\` pour demander l'accès à un autre)*\n` +
            `• \`!carte [n° ou nom]\` — Inspecter une carte déjà obtenue\n` +
            `• \`!tcg top\` — Classement du serveur\n\n` +
            `### 🛒 Boutique, Échanges & Flex\n` +
            `• \`!tcg store\` — Dépenser tes points RegaDex\n` +
            `• \`!tcg claim\` — Voir et activer tes achats / inventaire\n` +
            `• \`!trade [@membre]\` — Lancer un échange *(doublons ou dernière copie à rareté égale)*\n` +
            `• \`!flex\` *(\`!tcg flex\`)* — Montrer ta carte préférée *(<#${TCG_CHANNEL_ID}> & <#${SHITPOST_CHANNEL_ID}>)* • \`!flex @membre\`\n` +
            `• \`!flex modify [N°Set]-[N°Carte]\` pour la changer\n` +
            `────────────────────────────────────────\n` +
            `💡 *Les slash commands \`/regadex\` fonctionnent aussi, et les espaces après \`!tcg\` / \`!regadex\` / \`!rgdx\` sont optionnels !*`
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
            `• Chaque booster contient **3 cartes uniques**, révélées de la plus commune à la plus rare.\n` +
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
            `  1 roulette = **+1pt** • 1 booster ouvert = **+5pts** • 1 doublon = **+3pts**\n` +
            `  1 fil d'échange terminé = **+3pts** pour chacun·e *(1 seule fois par fil)*\n` +
            `• **RegaDex Store (\`🛒 Store\`) :** tes achats vont dans ton **🎒 Inventaire** (\`!regadex claim\`) :\n` +
            `  • 🎁 **Booster** (\`100 pts\`) — Un booster supplémentaire à ouvrir.\n` +
            `  • 🍀 **Chanceux** (\`75 pts\`) — Retire toutes les *Communes* du prochain booster.\n` +
            `  • ✨ **Transfo Holo** (\`50 pts\`) — Transforme une carte compatible possédée en *Holo*.\n` +
            `  • ⚡ **Cooldown /2** (\`25 pts\`) — Le prochain rechargement gratuit passe à **3h** au lieu de 6h.` +
            sep +
            `### 📖 4. Classeur, Échanges & Commandes\n` +
            `• **Classeur :** filtre par catégorie ou rareté, choisis la grille (\`4\`, \`18\`, \`36\` ou \`All\`), masque les cartes manquantes et change le thème **Clair (W) / Nuit (B)**.\n` +
            `• **Voir le classeur d'un membre :** utilise le menu déroulant du classeur ou \`!classeur @membre\` *(cela mentionne la personne pour lui demander son accord)*.\n` +
            `• **Échanges (\`!trade [@]\` ou clic droit sur un membre) :** échange jusqu'à **3 cartes** en doublon ou même **ta dernière copie** *(uniquement contre des cartes de **même rareté**)* ! Gagne **+3 pts RegaDex** à la fermeture du fil *(1 seul bonus par fil, même si plusieurs échanges y sont faits)*.\n` +
            `• **Commandes rapides :** \`!tcg\` • \`!tcg help\` • \`!open\` • \`!carte [n°/nom]\` *(cartes obtenues uniquement)* • \`!flex\` *(<#${TCG_CHANNEL_ID}> & <#${SHITPOST_CHANNEL_ID}>)*`
        )
        .setFooter({ text: `RegaDex ${SET1_NAME} • Cacabot` });

    const components = [
        new ActionRowBuilder().addComponents(
            buildAccueilButton(userId),
            new ButtonBuilder()
                .setCustomId(`tcg:help:${userId}:1`)
                .setLabel('Commandes')
                .setEmoji('📖')
                .setStyle(ButtonStyle.Secondary),
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
            `Merci à <@704593833421438996> d'héberger Cacabot, ce qui me permet de créer ce genre de jeux pour vous ;\n` +
            `Merci aussi à <@1070742213635625050> de m'avoir donné quelques inspirations pour créer les cartes ;\n` +
            `Merci infiniment à ma femme <@738191002187202630> qui m'a aidé et soutenu tout du long ;\n` +
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
    const reminderBlock = unactivatedReminders.length > 0
        ? `\n\n💡 *Rappel : tu as des bonus non activés dans ton inventaire (\`!regadex claim\`) :*\n${unactivatedReminders.map(r => `• ${r}`).join('\n')}`
        : '';

    const desc = totalAvail > 0
        ? `### Vous avez **${totalAvail} booster${totalAvail > 1 ? 's' : ''} disponible${totalAvail > 1 ? 's' : ''}** !\nEn ouvrir un maintenant ?\n\n` +
          `🎁 **Gratuits :** \`${u.freeBoosters}/${MAX_FREE_BOOSTERS}\` • 🎒 **Inventaire :** \`${u.inventory?.booster || 0}\`` +
          (nextTs ? `\n⏱️ Prochain booster gratuit <t:${Math.floor(nextTs / 1000)}:R>` : '\n✅ Jauge gratuite pleine (`2/2`)') +
          reminderBlock
        : `### Vous n'avez aucun booster disponible pour le moment.\n` +
          `⏱️ Prochain booster gratuit <t:${Math.floor(nextTs / 1000)}:R>\n` +
          `💡 Tu peux aussi acheter un booster à **${STORE_PRICES.booster} pts** dans le Store *(Solde : **${u.points} pts**)*.`;

    const embed = new EmbedBuilder()
        .setColor(totalAvail > 0 ? 0x2ecc71 : 0x95a5a6)
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
            .setDisabled(totalAvail <= 0),
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
            `🎁 **Booster ${SET1_NAME}** — \`${STORE_PRICES.booster} pts\`\n` +
            `-# Un booster de 3 cartes ${SET1_NAME} à ouvrir quand tu veux.\n\n` +
            `🍀 **Prochain booster chanceux** — \`${STORE_PRICES.luckyBooster} pts\`\n` +
            `-# Supprime toutes les cartes **Communes** de ton prochain booster.\n\n` +
            `✨ **Transformer une carte en Holographique** — \`${STORE_PRICES.holoTransform} pts\`\n` +
            `-# Transforme 1 de tes cartes compatibles possédées en sa version **holographique** !\n\n` +
            `⚡ **Diviser le cooldown par 2** — \`${STORE_PRICES.halfCooldown} pts\`\n` +
            `-# Activé dès l'ouverture du prochain booster : celui d'après prendra **3h** au lieu de 6h.`
        );

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:buy:booster:${member.id}${hubSuffix}`)
            .setLabel(`Booster (${STORE_PRICES.booster} pts)`)
            .setEmoji('🎁')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(u.points < STORE_PRICES.booster),
        new ButtonBuilder()
            .setCustomId(`tcg:buy:luckyBooster:${member.id}${hubSuffix}`)
            .setLabel(`Chanceux (${STORE_PRICES.luckyBooster} pts)`)
            .setEmoji('🍀')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(u.points < STORE_PRICES.luckyBooster),
        new ButtonBuilder()
            .setCustomId(`tcg:buy:holoTransform:${member.id}${hubSuffix}`)
            .setLabel(`Holo (${STORE_PRICES.holoTransform} pts)`)
            .setEmoji('✨')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(u.points < STORE_PRICES.holoTransform),
        new ButtonBuilder()
            .setCustomId(`tcg:buy:halfCooldown:${member.id}${hubSuffix}`)
            .setLabel(`Cooldown /2 (${STORE_PRICES.halfCooldown} pts)`)
            .setEmoji('⚡')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(u.points < STORE_PRICES.halfCooldown)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:claim:open:${member.id}:1`)
            .setLabel('Mon Inventaire')
            .setEmoji('🎒')
            .setStyle(ButtonStyle.Secondary),
        buildAccueilButton(member.id),
        buildCloseButton(member.id)
    );

    return { embeds: [embed], components: [row, row2] };
}

function buildClaimPayload(member, u, fromHub = false) {
    const inv = u.inventory || {};
    const hubSuffix = fromHub ? ':1' : '';

    const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setAuthor({ name: `Inventaire RegaDex • ${member.displayName}`, iconURL: member.displayAvatarURL({ dynamic: true }) })
        .setTitle('🎒 Inventaire RegaDex (`!regadex claim`)')
        .setDescription(
            `Voici tes boosters et bonus en réserve *(stock illimité)* :\n\n` +
            `🎁 **Booster ${SET1_NAME} :** \`${inv.booster || 0}\`\n` +
            `🍀 **Prochain booster chanceux :** \`${inv.luckyBooster || 0}\` ${u.activeBonuses?.luckyBooster ? '*(Déjà actif sur le prochain booster !)*' : ''}\n` +
            `✨ **Transformation Holographique :** \`${inv.holoTransform || 0}\`\n` +
            `⚡ **Demi-cooldown (3h) :** \`${inv.halfCooldown || 0}\` ${u.activeBonuses?.halfCooldown ? '*(Déjà armé sur le prochain booster !)*' : ''}`
        );

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:open:${member.id}${hubSuffix}`)
            .setLabel(`Ouvrir Booster (${getTotalAvailableBoosters(u)})`)
            .setEmoji('🎁')
            .setStyle(ButtonStyle.Success)
            .setDisabled(getTotalAvailableBoosters(u) <= 0),
        new ButtonBuilder()
            .setCustomId(`tcg:use:luckyBooster:${member.id}${hubSuffix}`)
            .setLabel(`Activer Chanceux (${inv.luckyBooster || 0})`)
            .setEmoji('🍀')
            .setStyle(ButtonStyle.Primary)
            .setDisabled((inv.luckyBooster || 0) <= 0 || Boolean(u.activeBonuses?.luckyBooster)),
        new ButtonBuilder()
            .setCustomId(`tcg:use:holoTransform:${member.id}${hubSuffix}`)
            .setLabel(`Transformer Holo (${inv.holoTransform || 0})`)
            .setEmoji('✨')
            .setStyle(ButtonStyle.Primary)
            .setDisabled((inv.holoTransform || 0) <= 0),
        new ButtonBuilder()
            .setCustomId(`tcg:use:halfCooldown:${member.id}${hubSuffix}`)
            .setLabel(`Activer CD /2 (${inv.halfCooldown || 0})`)
            .setEmoji('⚡')
            .setStyle(ButtonStyle.Primary)
            .setDisabled((inv.halfCooldown || 0) <= 0 || Boolean(u.activeBonuses?.halfCooldown))
    );

    const row2 = new ActionRowBuilder().addComponents(
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

function clearBoosterInspectTimeout(session) {
    if (session?.inspectTimeout) {
        clearTimeout(session.inspectTimeout);
        session.inspectTimeout = null;
    }
}

function scheduleBoosterInspectTimeout(member, session) {
    clearBoosterInspectTimeout(session);
    if (!session?.message) return;

    session.inspectTimeout = setTimeout(async () => {
        session.inspectTimeout = null;
        if (boosterSessions.get(session.message.id) !== session) return;
        if (session.step >= 3) return;
        session.step = 3;
        try {
            const recapPayload = await buildBoosterRecapPayload(member, session);
            await session.message.edit({ content: null, ...recapPayload, attachments: [] });
        } catch {}
    }, BOOSTER_INSPECT_IDLE_MS);
}

async function disableBoosterOpenButtonOnMessage(message) {
    if (!message || !Array.isArray(message.components) || message.components.length === 0) return;
    let modified = false;
    const updatedRows = message.components.map(row => {
        const newRow = new ActionRowBuilder();
        for (const comp of row.components) {
            const json = comp.toJSON();
            if (json.custom_id && json.custom_id.startsWith('tcg:open:')) {
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
    const card = session.cards[stepIndex];
    const isNew = session.isNewFlags[stepIndex];
    const meta = RARITY_META[card.rarity] || RARITY_META['Commune'];

    const embed = new EmbedBuilder()
        .setColor(meta.color)
        .setAuthor({ name: `Ouverture de ${member.displayName}`, iconURL: member.displayAvatarURL({ dynamic: true }) })
        .setTitle(`${meta.emoji} Carte ${stepIndex + 1}/3 — ${card.name}`)
        .setDescription(
            `🆔 **Numéro :** \`${card.id}\`\n` +
            `📁 **Catégorie :** \`${card.category}\`\n` +
            `✨ **Rareté :** **${card.rarity}**${card.isHolo ? ' **(Holographique)**' : ''}\n` +
            (isNew ? `🆕 **NOUVELLE CARTE AJOUTÉE AU REGADEX !**` : `🔁 **Doublon !** *+3 points RegaDex gagnés*`)
        )
        .setImage('attachment://carte_booster.png')
        .setFooter({ text: `Booster ${SET1_NAME} • Révélation ${stepIndex + 1}/3` });

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
    if (stepIndex < 2) {
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
    } else if (stepIndex === 2) {
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
    if (session.luckyUsed) bonusInfo.push('🍀 Booster Chanceux appliqué');
    if (session.pityUsed) bonusInfo.push('✨ Pity appliquée (Rare garantie)');
    if (session.halfCdUsed) bonusInfo.push('⚡ Demi-cooldown activé (3h)');
    if (session.triggeredNextPity) bonusInfo.push('🛡️ 3 Communes : ton **prochain** booster aura une **Rare** garantie !');

    const cooldownLine = nextTs
        ? `\n⏱️ **Prochain booster gratuit :** <t:${Math.floor(nextTs / 1000)}:R>`
        : `\n✅ **Jauge gratuite pleine :** \`${u.freeBoosters}/${MAX_FREE_BOOSTERS}\``;

    const recapColor = u.theme === 'W' ? 0xffffff : 0x111216;

    return new EmbedBuilder()
        .setColor(recapColor)
        .setAuthor({ name: `Booster ${SET1_NAME} de ${member.displayName}`, iconURL: member.displayAvatarURL({ dynamic: true }) })
        .setTitle('📊 Récapitulatif du Booster')
        .setDescription(
            lines.join('\n') +
            `\n\n🪙 **Points RegaDex gagnés :** **+${session.ptsEarned} pts** *(Solde : ${u.points} pts)*` +
            `\n📚 **Progression ${SET1_NAME} :** **${comp.uniqueCount}/${comp.totalSet}** (${pctSet}%)` +
            cooldownLine +
            (bonusInfo.length > 0 ? `\n\n${bonusInfo.join('\n')}` : '')
        )
        .setImage('attachment://recap_booster.jpg')
        .setFooter({ text: `Boosters restants : ${totalAvail} • Mode ${u.theme === 'W' ? 'Clair (W)' : 'Nuit (B)'}` });
}

async function ensureSessionRecapBuffer(session, theme) {
    if (!session.recapBuffer || session.recapTheme !== theme) {
        session.recapBuffer = await renderBoosterRecapCanvas(session.cards, session.isNewFlags, theme);
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

    return {
        embeds: [embed],
        components: [row1],
        files: [new AttachmentBuilder(buffer, { name: 'recap_booster.jpg' })]
    };
}

async function buildBoosterStepPayload(member, session) {
    if (session.step === 3) {
        clearBoosterInspectTimeout(session);
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

    const rawPct = getCardPullProbability(card, luckyUsed, member.id, member);
    const pctStr = formatPullPercent(rawPct);
    const boostMult = getCardPullMultiplier(card.id, member.id, member);
    const tauxText = `**${pctStr}%** *(/carte)*${card.isHolo ? ' *(Holo)*' : ''}${luckyUsed ? ' *(🍀 Chanceux)*' : ''}${boostMult > 1 ? ` *(🎯 ×${boostMult})*` : ''}`;

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
            { name: '👤 Collectionneur·euse', value: `<@${member.id}> (${nom})`, inline: true },
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

async function startBoosterOpening(targetResponder, member, client, fromHub = false) {
    const userId = member.id;
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
    const totalAvail = getTotalAvailableBoosters(u);
    if (totalAvail <= 0) {
        const payload = buildOpenPromptPayload(member, u, fromHub);
        if (targetResponder.isButton?.()) {
            const isExistingRecap = Boolean(targetResponder.message?.id && boosterSessions.has(targetResponder.message.id));
            if (!isExistingRecap) {
                await targetResponder.deferUpdate();
                return targetResponder.editReply({ content: null, ...payload, attachments: [] });
            }
        }
        return targetResponder.isRepliable?.()
            ? targetResponder.reply({ ...payload, ephemeral: true })
            : replySilent(targetResponder, payload);
    }

    boostersEnCours.add(userId);

    try {
        // Consommer prioritairement un booster gratuit, sinon l'inventaire
        if (u.freeBoosters > 0) {
            const wasFull = u.freeBoosters >= MAX_FREE_BOOSTERS;
            u.freeBoosters -= 1;
            if (wasFull) {
                u.lastFreeRechargeAt = Date.now();
                u.currentRechargeMs = BOOSTER_COOLDOWN_MS;
            }
        } else {
            u.inventory.booster -= 1;
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

        // Tirage des 3 cartes
        const draw = drawBoosterCards(u, userId, member);
        u.activeBonuses.luckyBooster = false;

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
        u.stats.duplicatesObtained = (u.stats.duplicatesObtained || 0) + duplicatesInPack;

        if (!isSandboxId(userId)) {
            tcgBridge.trackBattlePassProgress(userId, 'tcg_booster', 1);
            if (duplicatesInPack > 0) {
                tcgBridge.trackBattlePassProgress(userId, 'tcg_doublon', duplicatesInPack);
            }

            const data = getStoreData();
            if (data.notifs?.[userId]) armerNotifBooster(userId, client);
            tcgBridge.demanderSauvegarde();
        }

        const gifEmbed = new EmbedBuilder()
            .setColor(0xf1c40f)
            .setAuthor({ name: `Ouverture de ${member.displayName}`, iconURL: member.displayAvatarURL({ dynamic: true }) })
            .setTitle(`✨ Ouverture du Booster ${SET1_NAME} en cours...`);

        const files = [];
        if (assetPaths.openingGif && fs.existsSync(assetPaths.openingGif)) {
            files.push(new AttachmentBuilder(assetPaths.openingGif, { name: 'ouverture_set1.gif' }));
            gifEmbed.setImage('attachment://ouverture_set1.gif');
        }

        let sentMsg;
        if (targetResponder.isButton?.()) {
            const isExistingRecap = Boolean(targetResponder.message?.id && boosterSessions.has(targetResponder.message.id));
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
            luckyUsed: draw.luckyUsed,
            pityUsed: draw.pityUsed,
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
            gifTimeout: null,
            message: sentMsg
        };
        boosterSessions.set(sentMsg.id, session);

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
                    }
                } catch {}
            }

            if (!session.pantheonSent && !isSandboxId(userId)) {
                session.pantheonSent = true;
                for (let i = 0; i < session.cards.length; i++) {
                    const pulledCard = session.cards[i];
                    if (pulledCard.rarity === 'Full Art' || pulledCard.rarity === 'Négative') {
                        await envoyerPantheonTcg(client, member, pulledCard, session.isNewFlags[i], session.luckyUsed).catch(() => {});
                    }
                }
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
    const { category, perPageMode, page, sortMode, rarityFilter = 'all', ownedOnly = false, fromHub = false } = options;
    const hubFlag = fromHub ? '1' : '0';
    const ownedFlag = ownedOnly ? '1' : '0';

    const effectiveSort = (rarityFilter !== 'all' && sortMode === 'rarity') ? 'number' : sortMode;

    const catMenu = new StringSelectMenuBuilder()
        .setCustomId(`tcg:bcat:${ownerId}:${viewerId}:${perPageMode}:${effectiveSort}:${rarityFilter}:${hubFlag}:${ownedFlag}`)
        .setPlaceholder('Choisir un classeur...')
        .addOptions([
            { label: `Complet ${SET1_NAME} (109 cartes)`, value: 'complet', emoji: '📚', default: category === 'complet' },
            { label: 'Items (26 cartes)', value: 'Items', emoji: '🧰', default: category === 'Items' },
            { label: 'Personnages (49 cartes)', value: 'Personnages', emoji: '🧑', default: category === 'Personnages' },
            { label: 'Références (34 cartes)', value: 'Références', emoji: '🎬', default: category === 'Références' }
        ]);

    const userMenu = new UserSelectMenuBuilder()
        .setCustomId(`tcg:binder:pickuser:${viewerId}`)
        .setPlaceholder('Consulter le classeur d\'un autre membre...');

    const navRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:bnav:first:${ownerId}:${viewerId}:${category}:${perPageMode}:${page}:${effectiveSort}:${rarityFilter}:${hubFlag}:${ownedFlag}`)
            .setEmoji('⏪')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page <= 0),
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
            .setCustomId(`tcg:bnav:last:${ownerId}:${viewerId}:${category}:${perPageMode}:${page}:${effectiveSort}:${rarityFilter}:${hubFlag}:${ownedFlag}`)
            .setEmoji('⏩')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page >= totalPages - 1)
    );

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

    const optRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:bsize:${ownerId}:${viewerId}:${category}:${nextPerPage}:${effectiveSort}:${rarityFilter}:${hubFlag}:${ownedFlag}`)
            .setLabel(`Grille : ${sizeLabel}`)
            .setEmoji('📐')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`tcg:brarity:${ownerId}:${viewerId}:${category}:${perPageMode}:${nextRarity}:${nextRarity !== 'all' && effectiveSort === 'rarity' ? 'number' : effectiveSort}:${hubFlag}:${ownedFlag}`)
            .setLabel(rBtn.label)
            .setEmoji(rBtn.emoji)
            .setStyle(rBtn.style),
        new ButtonBuilder()
            .setCustomId(`tcg:bsort:${ownerId}:${viewerId}:${category}:${perPageMode}:${page}:${nextSort}:${rarityFilter}:${hubFlag}:${ownedFlag}`)
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
            .setCustomId(`tcg:bowned:${ownerId}:${viewerId}:${category}:${perPageMode}:${effectiveSort}:${rarityFilter}:${hubFlag}:${ownedOnly ? '0' : '1'}`)
            .setLabel(ownedOnly ? 'Manquantes : Non' : 'Manquantes : Oui')
            .setEmoji(ownedOnly ? '🚫' : '👁️')
            .setStyle(ownedOnly ? ButtonStyle.Success : ButtonStyle.Secondary),
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
        new ActionRowBuilder().addComponents(userMenu),
        navRow,
        optRow,
        bottomRow
    ];
}

async function buildBinderReplyPayload(ownerMember, viewerId, options = {}) {
    const ownerUser = ownerMember.user || ownerMember;
    const u = getOrCreateTcgUser(ownerMember.id);
    const rawPerPage = options.perPageMode || '18';
    const rarityFilter = BINDER_RARITY_CODES[options.rarityFilter] !== undefined ? options.rarityFilter : 'all';
    const rawSort = options.sortMode || 'number';
    const opts = {
        category: options.category || 'complet',
        perPageMode: rawPerPage === '9' ? '4' : rawPerPage,
        page: options.page || 0,
        sortMode: (rarityFilter !== 'all' && rawSort === 'rarity') ? 'number' : rawSort,
        rarityFilter,
        ownedOnly: Boolean(options.ownedOnly),
        fromHub: Boolean(options.fromHub)
    };

    const rendered = await renderBinderCanvas(ownerMember, u, opts);
    opts.page = rendered.safePage;
    const rarityLabel = BINDER_RARITY_CODES[opts.rarityFilter];

    const embed = new EmbedBuilder()
        .setColor(u.theme === 'W' ? 0xecf0f1 : 0x2c3e50)
        .setAuthor({ name: `Classeur de ${ownerMember.displayName || ownerUser.username}`, iconURL: ownerUser.displayAvatarURL({ dynamic: true }) })
        .setDescription(
            `📖 **${opts.category === 'complet' ? SET1_NAME : opts.category}**` +
            `${rarityLabel ? ` • 💎 **${rarityLabel}**` : ''}` +
            `${opts.ownedOnly ? ' *(Possédées)*' : ''} • **${rendered.ownedInView}/${rendered.totalInView}** cartes • Tri : **${opts.sortMode === 'rarity' ? 'Rareté' : (opts.sortMode === 'quantity' ? 'Quantité' : 'Numéro')}**`
        )
        .setImage('attachment://regadex_classeur.jpg')
        .setFooter({ text: `Page ${rendered.safePage + 1}/${rendered.totalPages} • Mode ${u.theme === 'W' ? 'Clair (W)' : 'Nuit (B)'}` });

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

    const embed = new EmbedBuilder()
        .setColor(meta.color)
        .setTitle(`${meta.emoji} ${card.id} — ${card.name}`)
        .setDescription(
            `📁 **Catégorie :** ${card.category}\n` +
            `✨ **Rareté :** **${card.rarity}**${card.isHolo ? ' *(Holographique — 2× plus rare)*' : ''}\n` +
            `📦 **Dans ton RegaDex :** \`x${qty}\`` +
            extraLines
        )
        .setImage('attachment://carte_regadex.png')
        .setFooter({ text: `RegaDex ${SET1_NAME} • Inspection depuis le classeur` });

    const files = [];
    if (card.filePath && fs.existsSync(card.filePath)) {
        files.push(new AttachmentBuilder(card.filePath, { name: 'carte_regadex.png' }));
    }

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

    const row2 = new ActionRowBuilder().addComponents(
        buildAccueilButton(viewerId),
        buildCloseButton(viewerId)
    );

    return { embeds: [embed], files, components: [row1, row2] };
}

function buildSingleCardPayload(card, viewerId) {
    const meta = RARITY_META[card.rarity] || RARITY_META['Commune'];
    const u = getOrCreateTcgUser(viewerId);
    const qty = u.cards?.[card.id] || 0;
    const ownedCards = cardCatalog.filter(c => (u.cards?.[c.id] || 0) > 0);
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

    const embed = new EmbedBuilder()
        .setColor(meta.color)
        .setTitle(`${meta.emoji} ${card.id} — ${card.name}`)
        .setDescription(
            `📁 **Catégorie :** ${card.category}\n` +
            `✨ **Rareté :** **${card.rarity}**${card.isHolo ? ' *(Holographique — 2× plus rare)*' : ''}\n` +
            `📦 **Dans ton RegaDex :** \`x${qty}\`` +
            extraLines
        )
        .setImage('attachment://carte_regadex.png')
        .setFooter({
            text: ownedCards.length > 0
                ? `RegaDex ${SET1_NAME} • Carte possédée ${currentIdx + 1}/${ownedCards.length} • !carte [n° ou nom]`
                : `RegaDex ${SET1_NAME} • Utilise !carte [numéro ou nom]`
        });

    const files = [];
    if (card.filePath && fs.existsSync(card.filePath)) {
        files.push(new AttachmentBuilder(card.filePath, { name: 'carte_regadex.png' }));
    }

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

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:binder:open:${viewerId}:${viewerId}:1`)
            .setLabel('Classeur')
            .setEmoji('📖')
            .setStyle(ButtonStyle.Primary),
        buildAccueilButton(viewerId),
        buildCloseButton(viewerId)
    );

    return { embeds: [embed], files, components: [row1, row2] };
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
    return replySilent(targetResponder, { embeds: [embed], components: [row] });
}

async function handleCarteCommand(targetResponder, authorMember, rawArg, channel) {
    const query = (rawArg || '').trim();
    if (!query) {
        const data = getStoreData();
        const activeTrade = data.activeTrades?.[channel?.id];

        const embed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle('🔎 Rechercher une carte RegaDex (`!carte`)')
            .setDescription(
                `Pour afficher une carte **que tu possèdes**, tape :\n` +
                `• \`!carte [N° Set]-[N° Carte]\` *(ex : \`!carte 1-84\`, \`!carte 1-Ø1\`)*\n` +
                `• \`!carte [Nom]\` *(ex : \`!carte Tasty Crousty\`, \`!carte Epsys\`)*\n\n` +
                `🔒 *Pour garder la surprise intacte, les cartes non découvertes restent verrouillées.*\n` +
                `🔔 *Attention : consulter le classeur d'un autre membre le mentionnera pour lui demander l'accès.*`
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`tcg:binder:open:${authorMember.id}:${authorMember.id}:1`)
                .setLabel('Mon classeur')
                .setEmoji('📖')
                .setStyle(ButtonStyle.Primary)
        );

        if (activeTrade) {
            const partnerId = activeTrade.initiatorId === authorMember.id ? activeTrade.targetId : activeTrade.initiatorId;
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`tcg:binder:ask:${partnerId}:${authorMember.id}`)
                    .setLabel('Classeur partenaire')
                    .setEmoji('🤝')
                    .setStyle(ButtonStyle.Secondary),
                buildCloseButton(authorMember.id)
            );
            return replySilent(targetResponder, { embeds: [embed], components: [row] });
        }

        row.addComponents(
            buildAccueilButton(authorMember.id),
            buildCloseButton(authorMember.id)
        );

        const userRow = new ActionRowBuilder().addComponents(
            new UserSelectMenuBuilder()
                .setCustomId(`tcg:binder:pickuser:${authorMember.id}`)
                .setPlaceholder('Consulter le classeur d\'un autre membre...')
        );
        return replySilent(targetResponder, { embeds: [embed], components: [row, userRow] });
    }

    const u = getOrCreateTcgUser(authorMember.id);
    const res = resolveCardQuery(query);

    // 1. Correspondance unique : vérifier la possession avant tout affichage (zéro spoiler)
    if (res.card) {
        if ((u.cards?.[res.card.id] || 0) <= 0) {
            return replySilent(
                targetResponder,
                `🔒 Tu n'as pas encore découvert cette carte dans ton RegaDex ! La surprise reste totale 🤫`
            );
        }
        const payload = buildSingleCardPayload(res.card, authorMember.id);
        return replySilent(targetResponder, payload);
    }

    // 2. Correspondances multiples : ne proposer QUE les cartes possédées
    if (res.matches.length > 1) {
        const ownedMatches = res.matches.filter(c => (u.cards?.[c.id] || 0) > 0);
        if (ownedMatches.length === 0) {
            return replySilent(
                targetResponder,
                `🔒 Tu ne possèdes aucune carte correspondant à cette recherche dans ton RegaDex !`
            );
        }
        if (ownedMatches.length === 1) {
            const payload = buildSingleCardPayload(ownedMatches[0], authorMember.id);
            return replySilent(targetResponder, payload);
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
        return replySilent(targetResponder, {
            content: `🔎 **${ownedMatches.length}** carte(s) possédée(s) correspondent à \`${query}\` :`,
            components: [new ActionRowBuilder().addComponents(menu), navRow]
        });
    }

    return replySilent(
        targetResponder,
        `🔒 Aucune carte découverte dans ton RegaDex ne correspond à \`${query}\`. Tape \`!carte\` pour voir les formats.`
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
                return replySilent(targetResponder, {
                    content: '✨ Choisis la carte à définir en préférée :',
                    components: [new ActionRowBuilder().addComponents(menu)]
                });
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
            const fav = tu.favoriteCardId ? cardById.get(tu.favoriteCardId) : null;
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
    const fav = authorU.favoriteCardId ? cardById.get(authorU.favoriteCardId) : null;
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
    const owned = cardCatalog
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
    return replySilent(targetResponder, { content, components: rows });
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

    const embed = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle('🔄 Table d\'échange RegaDex')
        .setDescription(
            `Règles : **3 cartes max** par personne • **Doublons** libre, ou **dernière copie** *(uniquement à nombre et raretés identiques)* • **+3 pts RegaDex** à la fermeture *(1× par fil)*.\n` +
            `-# Toute modification déverrouille automatiquement la validation des deux joueurs.\n` +
            `-# 📊 Repère ${SET1_NAME} : il manque **${missingA}/${compA.totalSet}** cartes à <@${trade.initiatorId}> et **${missingB}/${compB.totalSet}** à <@${trade.targetId}>.\n\n` +
            `**Offre de <@${trade.initiatorId}>** (${lockA} • ${trade.offers[trade.initiatorId].length}/3) :\n` +
            `${formatOfferLines(trade.offers[trade.initiatorId], trade.initiatorId)}\n\n` +
            `**Offre de <@${trade.targetId}>** (${lockB} • ${trade.offers[trade.targetId].length}/3) :\n` +
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
            .setCustomId(`tcg:tr:clear:${trade.id}`)
            .setLabel('Vider mon offre')
            .setEmoji('🧹')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`tcg:tr:search:${trade.id}`)
            .setLabel('Chercher (Modal)')
            .setEmoji('🔍')
            .setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:tr:lock:${trade.id}`)
            .setLabel('Valider / Déverrouiller mon offre')
            .setEmoji('✅')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`tcg:tr:cancel:${trade.id}`)
            .setLabel('Annuler l\'échange')
            .setEmoji('❌')
            .setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [row1, row2] };
}

function buildPostTradeDecisionPayload(trade) {
    const vA = trade.postTradeVotes?.[trade.initiatorId];
    const vB = trade.postTradeVotes?.[trade.targetId];
    const labelVote = (v) => v === 'again' ? '🔄 Nouvel échange' : (v === 'close' ? '🔒 Fermer' : '⏳ En attente');

    const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('🤝 Échange terminé ! Que souhaitez-vous faire ?')
        .setDescription(
            `Pour continuer ou clôturer le thread, les **deux** participants doivent faire le même choix :\n\n` +
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

    const filtered = missingOnly
        ? allTradables.filter(c => (uPartner.cards?.[c.id] || 0) <= 0)
        : allTradables;

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
            const missingForPartner = (uPartner.cards?.[c.id] || 0) <= 0;
            const remainingBeforeAdd = (u.cards[c.id] || 0) - (offeredCount[c.id] || 0);
            const lastCopyTag = remainingBeforeAdd === 1 ? ' • ⚠️ Dernière copie (même rareté)' : '';
            return {
                label: `${c.id} • ${c.name}`.slice(0, 100),
                description: `${c.rarity} • x${u.cards[c.id]}${lastCopyTag}${missingForPartner ? ' • 🆕 Lui manque' : ''}`.slice(0, 100),
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
    const fmtRarities = (arr) => arr.map(id => {
        const c = cardById.get(id);
        const r = c?.rarity || 'Commune';
        const m = RARITY_META[r] || RARITY_META['Commune'];
        return `${m.emoji} ${r}`;
    }).join(', ');
    const vA = Boolean(trade.unfairConfirm?.votes?.[idA]);
    const vB = Boolean(trade.unfairConfirm?.votes?.[idB]);

    const embed = new EmbedBuilder()
        .setColor(0xf39c12)
        .setTitle('⚠️ Échange déséquilibré — Confirmation requise')
        .setDescription(
            `Cet échange ne contient pas le même nombre ou les mêmes raretés de cartes des deux côtés :\n\n` +
            `• **<@${idA}>** (${offerA.length}) : ${fmtRarities(offerA)}\n` +
            `• **<@${idB}>** (${offerB.length}) : ${fmtRarities(offerB)}\n\n` +
            `Confirmez-vous cet échange ? Les **deux** participants doivent valider :\n` +
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

    const offerA = trade.offers[idA] || [];
    const offerB = trade.offers[idB] || [];
    if (offerA.length === 0 || offerB.length === 0) {
        trade.lockedOffers[idA] = false;
        trade.lockedOffers[idB] = false;
        trade.unfairConfirm = null;
        tcgBridge.demanderSauvegarde();
        await refreshTradePanel(thread, trade);
        await sendSilent(thread, "❌ **Échange bloqué :** les **deux** participants doivent obligatoirement proposer au moins **1 carte** en doublon *(les dons à sens unique sont interdits)*.").catch(() => {});
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

    const hasLastCopyA = Object.entries(needA).some(([cid, q]) => ((uA.cards[cid] || 0) - q) === 0);
    const hasLastCopyB = Object.entries(needB).some(([cid, q]) => ((uB.cards[cid] || 0) - q) === 0);
    if ((hasLastCopyA || hasLastCopyB) && !isBalanced) {
        trade.lockedOffers[idA] = false;
        trade.lockedOffers[idB] = false;
        trade.unfairConfirm = null;
        tcgBridge.demanderSauvegarde();
        await refreshTradePanel(thread, trade);
        await sendSilent(
            thread,
            "❌ **Échange bloqué :** au moins une carte proposée est la **dernière copie** dans l'inventaire d'un·e membre *(sans doublon)*.\n" +
            "➡️ Les échanges incluant une dernière copie sont autorisés **uniquement à nombre et raretés identiques** des deux côtés !"
        ).catch(() => {});
        return false;
    }

    if (!isBalanced && !(trade.unfairConfirm?.votes?.[idA] && trade.unfairConfirm?.votes?.[idB])) {
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

    tcgBridge.trackBattlePassProgress(idA, 'tcg_trade', 1);
    tcgBridge.trackBattlePassProgress(idB, 'tcg_trade', 1);
    tcgBridge.demanderSauvegarde();

    const guild = thread.guild;
    const mA = await guild.members.fetch(idA).catch(() => null);
    const mB = await guild.members.fetch(idB).catch(() => null);
    const nameA = mA?.displayName || mA?.user?.username || idA;
    const nameB = mB?.displayName || mB?.user?.username || idB;

    const recapBuffer = await renderTradeRecapCanvas(nameA, offerA, nameB, offerB);
    const dateStr = new Date().toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' }) + ' à ' +
        new Date().toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris' });

    const recapEmbed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle(`✅ Échange #${trade.tradeCount} validé !`)
        .setDescription(
            `**${nameA}** (<@${idA}>) a donné :\n${formatOfferLines(offerA)}\n\n` +
            `**${nameB}** (<@${idB}>) a donné :\n${formatOfferLines(offerB)}`
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
    const multLabel = session.mult === 1 ? '×1 *(Retirer le boost)*' : `**×${session.mult}**`;

    const activeLines = [];
    for (const [tKey, cardMap] of Object.entries(boosts)) {
        if (!cardMap || typeof cardMap !== 'object') continue;
        const entries = Object.entries(cardMap).filter(([, m]) => typeof m === 'number' && m > 1);
        if (entries.length === 0) continue;
        const tStr = tKey === PULL_BOOST_ROLE_KEY ? `<@&${TCG_ROLE_ID}>` : `<@${tKey}>`;
        const cStr = entries.map(([cid, m]) => {
            const c = cardById.get(cid);
            return `\`${cid}\` ${c ? c.name : ''} (**×${m}**)`;
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
            .addOptions(PULL_MULTIPLIERS.map(m => ({
                label: m === 1 ? '×1 — Retirer le boost (Taux normal)' : `×${m} — Chance de pull multipliée par ${m}`,
                value: String(m),
                default: session.mult === m
            })))
    );

    const hasAnyBoost = activeLines.length > 0;
    const row5 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:pc:apply:${sessionId}`)
            .setLabel(session.mult === 1 ? 'Retirer le boost' : `Appliquer ×${session.mult}`)
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

async function handleAdminTcgCommand(message, lowerContent) {
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

    // 6. !rgdxproxies [warmup / purge] | !tcgproxies [warmup / purge] (Epsys-only)
    m = lowerContent.match(/^!(?:rgdx|tcg|regadex)\s*proxies(?:\s+(.*))?$/i);
    if (m) {
        if (message.author.id !== EPSYS_ID) return true;
        const arg = (m[1] || '').trim().toLowerCase();

        const walkStats = (dir) => {
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
        };

        if (arg === 'purge' || arg === 'clear' || arg === 'reset') {
            if (proxyWarmupRunning) {
                await replySilent(message, '⏳ Un `!rgdxproxies warmup` est déjà en cours, attends la fin avant de purger.');
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
                `🧹 **Proxies RegaDex purgés !** (${removedEntries} dossier(s) supprimé(s) dans \`TCG/Proxies\`).\n👉 Lance \`!rgdxproxies warmup\` pour tout pré-générer proprement.`
            );
            return true;
        }

        if (arg === 'warmup' || arg === 'warm' || arg === 'build' || arg === 'pregen') {
            if (cardCatalog.length === 0) {
                await replySilent(message, `❌ Aucune carte ${SET1_NAME} chargée pour lancer le warmup.`);
                return true;
            }
            if (proxyWarmupRunning) {
                await replySilent(message, '⏳ Un warmup des proxies est déjà en cours !');
                return true;
            }

            proxyWarmupRunning = true;
            try {
                // Collecte toutes les tailles exactes utilisées (900p + Récap Booster)
                const sizeMap = new Map();
                const catCounts = {
                    complet: cardCatalog.length,
                    ...Object.fromEntries(CATEGORIES.map(cat => [cat, cardCatalog.filter(c => c.category === cat).length]))
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
                // Taille du Récapitulatif Booster
                if (!sizeMap.has('285x399')) {
                    sizeMap.set('285x399', { w: 285, h: 399, glow: true, mystery: false });
                }

                const sizes = [...sizeMap.values()];
                const totalItems = sizes.reduce((acc, s) => acc + cardCatalog.length + (s.mystery ? 1 : 0), 0);
                const startedAt = Date.now();
                let done = 0;
                let generated = 0;
                let alreadyOnDisk = 0;
                let failed = 0;
                let lastEditAt = Date.now();

                const statusMsg = await replySilent(
                    message,
                    `🔥 **Warmup RegaDex démarré !**\n• **${sizes.length}** formats à préparer : ${sizes.map(s => `\`${s.w}×${s.h}\``).join(', ')}\n• **${totalItems}** miniatures au total *(avec lueurs & ombres pré-cuites)*\n⏳ Progression : \`0/${totalItems}\` (0%)...`
                );

                if (assetPaths.set1Logo) {
                    await loadAssetProxy(assetPaths.set1Logo, 1132, 467, { cacheKey: 'Set1_Logo.png' });
                }

                for (const s of sizes) {
                    if (s.mystery && assetPaths.mysteryCard) {
                        const resM = await loadAssetProxy(assetPaths.mysteryCard, s.w, s.h, { mysteryShadow: true });
                        done++;
                        if (!resM) failed++;
                        else if (resM.fromDisk) alreadyOnDisk++;
                        else generated++;
                    }

                    for (const card of cardCatalog) {
                        const resC = await loadCardProxy(card, s.w, s.h, { glow: s.glow });
                        done++;
                        if (!resC) failed++;
                        else if (resC.fromDisk) alreadyOnDisk++;
                        else generated++;

                        // Cède un micro-instant à la boucle Node.js pour garder le bot fluide
                        if (!resC?.fromDisk || done % 15 === 0) {
                            await new Promise(r => setTimeout(r, 8));
                        }

                        if (statusMsg && (Date.now() - lastEditAt >= 3000 || done === totalItems)) {
                            lastEditAt = Date.now();
                            const pct = Math.round((done / totalItems) * 100);
                            await statusMsg.edit(withSilent(
                                `🔥 **Warmup RegaDex en cours...**\n` +
                                `• Taille actuelle : \`${s.w}×${s.h}\`\n` +
                                `• Progression : **${done}/${totalItems}** (**${pct}%**)\n` +
                                `• Créées : **${generated}** • Déjà prêtes : **${alreadyOnDisk}**${failed ? ` • Échecs : **${failed}**` : ''}`
                            )).catch(() => {});
                        }
                    }
                }

                proxyRamCache.clear();
                if (proxyRamClearTimer) {
                    clearTimeout(proxyRamClearTimer);
                    proxyRamClearTimer = null;
                }

                const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
                const stats = walkStats(TCG_PROXIES_DIR);
                const mb = (stats.bytes / (1024 * 1024)).toFixed(2);
                const errLine = lastProxyWriteError
                    ? `\n⚠️ **Erreur d'écriture disque :** \`${lastProxyWriteError}\``
                    : '\n✅ **Volume Coolify (`/app/TCG/Proxies`) : OK et persistant !**';

                if (statusMsg) {
                    await statusMsg.edit(withSilent(
                        `✅ **Warmup RegaDex terminé en ${elapsedSec}s !**\n` +
                        `• **${generated}** miniature(s) générée(s) • **${alreadyOnDisk}** déjà en cache${failed ? ` • **${failed}** échec(s)` : ''}\n` +
                        `• Total sur disque : **${stats.files}** fichiers (**${mb} Mo** dans \`TCG/Proxies\`)` +
                        errLine
                    )).catch(() => {});
                }
            } finally {
                proxyWarmupRunning = false;
            }
            return true;
        }

        const stats = walkStats(TCG_PROXIES_DIR);
        const mb = (stats.bytes / (1024 * 1024)).toFixed(2);
        const dimLines = Object.entries(stats.byDim)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([dim, d]) => `• \`${dim}\` : **${d.files}** fichier(s) (*${(d.bytes / (1024 * 1024)).toFixed(2)} Mo*)`);

        const statusHeader = lastProxyWriteError
            ? `⚠️ **Erreur d'écriture détectée :** \`${lastProxyWriteError}\``
            : (stats.files > 0
                ? '✅ **Installation confirmée :** le bot lit et écrit bien ses miniatures sur le volume.'
                : 'ℹ️ **Cache vide pour le moment :** lance `!rgdxproxies warmup` pour tout pré-générer en une fois.');

        await replySilent(
            message,
            `🗂️ **Proxies RegaDex (\`TCG/Proxies\`)**\n` +
            `${statusHeader}\n\n` +
            `• **Total disque :** **${stats.files}** miniature(s) (**${mb} Mo**)\n` +
            `• **Micro-cache RAM :** **${proxyRamCache.size}/${PROXY_MAX_RAM_ITEMS}** (TTL 2 min)\n` +
            (dimLines.length > 0 ? `\n**Détail par format :**\n${dimLines.join('\n')}\n` : '\n') +
            `\n-# Commandes : \`!rgdxproxies warmup\` (pré-générer) • \`!rgdxproxies purge\` (vider)`
        );
        return true;
    }

    return false;
}

// ==========================================
//   PARSEUR COMMANDES PRÉFIXE (AVEC OU SANS ESPACE)
// ==========================================

function parseTcgCommand(content) {
    const trimmed = (content || '').trim();
    if (!trimmed.startsWith('!')) return null;

    let m = trimmed.match(/^!(?:regadex|rgdx|tcg)\s*(flexmodify|flex|open|store|claim|classeur|collection|carte|trade|top|notif|profil|profile|credits|guide|help|aide)?(?:\s+(.*))?$/i);
    if (m) {
        let sub = (m[1] || 'hub').toLowerCase();
        let rest = (m[2] || '').trim();
        if (sub === 'flexmodify') {
            sub = 'flex';
            rest = `modify ${rest}`.trim();
        }
        if (sub === 'collection') sub = 'classeur';
        if (sub === 'profile') sub = 'profil';
        if (sub === 'aide') sub = 'help';
        return { sub, rest };
    }

    m = trimmed.match(/^!(boosteropen|openbooster|booster|open)(?:\s+(.*))?$/i);
    if (m) {
        const cmd = m[1].toLowerCase();
        const rest = (m[2] || '').trim();
        if (cmd === 'booster' && rest && !/^open$/i.test(rest)) return null;
        return { sub: 'open', rest: '' };
    }

    m = trimmed.match(/^!(?:classeur|collection)(?:\s+(.*))?$/i);
    if (m) return { sub: 'classeur', rest: (m[1] || '').trim() };

    m = trimmed.match(/^!carte(?:\s+(.*))?$/i);
    if (m) return { sub: 'carte', rest: (m[1] || '').trim() };

    m = trimmed.match(/^!trade(?:\s+(.*))?$/i);
    if (m) return { sub: 'trade', rest: (m[1] || '').trim() };

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

async function handleTcgMessage(message) {
    if (!message.guild || message.guild.id !== GUILD_ID) return false;
    const raw = message.content.trim();
    if (!raw.startsWith('!')) return false;

    if (await handleAdminTcgCommand(message, raw.toLowerCase())) return true;

    if (/^!tcgx(?:\s|$)/i.test(raw)) {
        if (message.author.id !== EPSYS_ID) return true;
        const restRaw = raw.replace(/^!tcgx\s*/i, '').trim();
        const [subToken = 'hub', ...argTokens] = restRaw ? restRaw.split(/\s+/) : [];
        let sub = (subToken || 'hub').toLowerCase();
        let rest = argTokens.join(' ').trim();

        if (sub === 'collection') sub = 'classeur';
        if (sub === 'aide') sub = 'help';
        if (sub === 'flexmodify') {
            sub = 'flex';
            rest = `modify ${rest}`.trim();
        }

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
        if (sub === 'open' || sub === 'booster') {
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
        await replySilent(message, buildHubPayload(message.member, u));
        return true;
    }

    if (parsed.sub === 'help') {
        await replySilent(message, buildHelpPayload(message.author.id));
        return true;
    }

    if (parsed.sub === 'guide') {
        await replySilent(message, buildGuidePayload(message.author.id, false));
        return true;
    }

    if (parsed.sub === 'credits') {
        await replySilent(message, buildCreditsPayload(message.author.id, false));
        return true;
    }

    if (parsed.sub === 'open') {
        await replySilent(message, buildOpenPromptPayload(message.member, u, false));
        return true;
    }

    if (parsed.sub === 'store') {
        await replySilent(message, buildStorePayload(message.member, u, false));
        return true;
    }

    if (parsed.sub === 'claim') {
        await replySilent(message, buildClaimPayload(message.member, u, false));
        return true;
    }

    if (parsed.sub === 'top') {
        await replySilent(message, {
            embeds: [buildTopEmbed(message.guild, 'total')],
            components: buildTopComponents(message.author.id, 'total', false)
        });
        return true;
    }

    if (parsed.sub === 'notif') {
        await replySilent(message, buildNotifMenuPayload(message.member, u, false));
        return true;
    }

    if (parsed.sub === 'profil') {
        await replySilent(message, buildProfilePayload(message.member, u, false, false));
        return true;
    }

    if (parsed.sub === 'classeur') {
        if (!parsed.rest) {
            const sent = await replySilent(message, '📖 Chargement de ton classeur RegaDex...');
            const payload = await buildBinderReplyPayload(message.member, message.author.id, { fromHub: false });
            await sent.edit({ content: null, ...payload });
            return true;
        }

        await resolveMemberArg(message, parsed.rest, async (targetMember) => {
            if (!targetMember) return;
            if (targetMember.id === message.author.id) {
                const sent = await replySilent(message, '📖 Chargement de ton classeur RegaDex...');
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
        await replySilent(interaction, buildHubPayload(member, u));
        return true;
    }
    if (sub === 'open') {
        await replySilent(interaction, buildOpenPromptPayload(member, u, false));
        return true;
    }
    if (sub === 'store') {
        await replySilent(interaction, buildStorePayload(member, u, false));
        return true;
    }
    if (sub === 'claim') {
        await replySilent(interaction, buildClaimPayload(member, u, false));
        return true;
    }
    if (sub === 'top') {
        await replySilent(interaction, {
            embeds: [buildTopEmbed(interaction.guild, 'total')],
            components: buildTopComponents(interaction.user.id, 'total', false)
        });
        return true;
    }
    if (sub === 'notif') {
        await replySilent(interaction, buildNotifMenuPayload(member, u, false));
        return true;
    }
    if (sub === 'classeur') {
        const cible = interaction.options.getMember('membre');
        if (!cible || cible.id === interaction.user.id) {
            await deferReplySilent(interaction);
            const payload = await buildBinderReplyPayload(member, interaction.user.id, { fromHub: false });
            await interaction.editReply(payload);
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

    // ----- FERMER UN MENU (+ MESSAGE DE COMMANDE SI RÉPONSE) -----
    if (action === 'close' && interaction.isButton()) {
        const ownerId = parts[2];
        if (!canControlTcgOwner(interaction.user.id, ownerId)) {
            await interaction.reply({ content: "Seul l'auteur de ce menu peut le fermer !", ephemeral: true });
            return true;
        }
        const msg = interaction.message;
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
        const prevSession = boosterSessions.get(interaction.message?.id);
        if (prevSession) {
            clearBoosterInspectTimeout(prevSession);
            boosterSessions.delete(interaction.message.id);
        }
        await interaction.deferUpdate();
        const u = getOrCreateTcgUser(ownerId);
        const actorMember = buildTcgMemberProxy(interaction.member, ownerId);
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
            boostersEnCours.delete(session.userId);
            session.skipUsed = true;
            session.hasReachedRecap = true;
            session.step = 3;
        } else if (dir === 'next') session.step = Math.min(2, session.step + 1);
        else if (dir === 'prev') session.step = Math.max(0, session.step - 1);
        else if (dir === 'back3') session.step = 2;
        else if (dir === 'recap') {
            session.hasReachedRecap = true;
            session.step = 3;
        }

        await interaction.deferUpdate();
        const actorMember = buildTcgMemberProxy(interaction.member, ownerId);
        const stepPayload = await buildBoosterStepPayload(actorMember, session);
        await interaction.editReply({ content: null, ...stepPayload, attachments: [] });

        if (dir === 'skip' && !session.pantheonSent && !isSandboxId(session.userId)) {
            session.pantheonSent = true;
            for (let i = 0; i < session.cards.length; i++) {
                const pulledCard = session.cards[i];
                if (pulledCard.rarity === 'Full Art' || pulledCard.rarity === 'Négative') {
                    await envoyerPantheonTcg(client, actorMember, pulledCard, session.isNewFlags[i], session.luckyUsed).catch(() => {});
                }
            }
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
            holoTransform: '✨ Transformer une carte en Holographique',
            halfCooldown: '⚡ Diviser le cooldown du prochain booster par 2'
        };

        const confirmEmbed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('✅ Achat effectué dans le RegaDex Store !')
            .setDescription(
                `Tu as acheté : **${labels[itemKey]}** pour \`${price} pts\` *(Solde restant : **${u.points} pts**)*.` +
                `\n\nSouhaites-tu l'utiliser tout de suite ou le garder dans ton inventaire (\`!regadex claim\`) ?`
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`tcg:postbuy:use:${itemKey}:${ownerId}${hubSuffix}`)
                .setLabel(itemKey === 'booster' ? 'Ouvrir maintenant' : 'Activer maintenant')
                .setEmoji('⚡')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`tcg:postbuy:keep:${itemKey}:${ownerId}${hubSuffix}`)
                .setLabel('Garder en inventaire')
                .setEmoji('🎒')
                .setStyle(ButtonStyle.Secondary),
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
        if (itemKey === 'holoTransform') {
            await sendHoloTransformPicker(interaction, actorMember, 0, fromHub);
            return true;
        }
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
        if (!isSandboxId(ownerId)) tcgBridge.demanderSauvegarde();

        const embed = new EmbedBuilder()
            .setColor(RARITY_META[holoCard.rarity]?.color || 0xf1c40f)
            .setTitle('✨ Transformation Holographique réussie !')
            .setDescription(`Ta carte **${baseCard.id} • ${baseCard.name}** a évolué en **${holoCard.id} • ${holoCard.name}** !`)
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
                return true;
            }
            await interaction.deferUpdate();
            const ownerMember = await interaction.guild.members.fetch(ownerId).catch(() => interaction.member);
            const payload = await buildBinderReplyPayload(ownerMember, viewerId, { fromHub: false });
            await interaction.editReply({ content: null, ...payload, attachments: [] });
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
        const ownedOnly = parts[10] === '1';

        if (!canControlTcgOwner(interaction.user.id, viewerId) && !canControlTcgOwner(interaction.user.id, ownerId)) {
            await interaction.reply({ content: "Ce classeur n'est pas à toi !", ephemeral: true });
            return true;
        }
        if (!canControlTcgOwner(interaction.user.id, ownerId)) {
            await interaction.reply({ content: "🔒 Tu ne peux inspecter en grand format que les cartes de ton propre classeur (anti-spoiler) !", ephemeral: true });
            return true;
        }

        const uOwner = getOrCreateTcgUser(ownerId);
        const cardsList = getFilteredSortedCards(category, sortMode, uOwner, ownedOnly, rarityFilter);
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
            ownedOnly,
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
        const card = cardById.get(interaction.values[0]);
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
        const ownedOnly = parts[9] === '1';

        if (!canControlTcgOwner(interaction.user.id, viewerId) && !canControlTcgOwner(interaction.user.id, ownerId)) {
            await interaction.reply({ content: "Ce classeur n'est pas à toi !", ephemeral: true });
            return true;
        }

        const uOwner = getOrCreateTcgUser(ownerId);
        const cardsList = getFilteredSortedCards(category, sortMode, uOwner, ownedOnly, rarityFilter);
        const grid = getBinderGridConfig(perPageMode, cardsList.length);
        const totalPages = Math.max(1, Math.ceil(cardsList.length / grid.perPage));

        const modal = new ModalBuilder()
            .setCustomId(`tcg:bpagesub:${ownerId}:${viewerId}:${category}:${perPageMode}:${sortMode}:${rarityFilter}:${fromHub ? '1' : '0'}:${ownedOnly ? '1' : '0'}`)
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
        let ownerId, viewerId, category, perPageMode, page, sortMode, rarityFilter, fromHub, ownedOnly;

        if (action === 'bcat' && interaction.isStringSelectMenu()) {
            ownerId = parts[2];
            viewerId = parts[3];
            perPageMode = parts[4];
            sortMode = parts[5];
            rarityFilter = parts[6] || 'all';
            fromHub = parts[7] === '1';
            ownedOnly = parts[8] === '1';
            category = interaction.values[0];
            page = 0;
        } else if (action === 'bsize' && interaction.isButton()) {
            ownerId = parts[2];
            viewerId = parts[3];
            category = parts[4];
            perPageMode = parts[5];
            sortMode = parts[6];
            rarityFilter = parts[7] || 'all';
            fromHub = parts[8] === '1';
            ownedOnly = parts[9] === '1';
            page = 0;
        } else if (action === 'bsize' && interaction.isStringSelectMenu()) {
            ownerId = parts[2];
            viewerId = parts[3];
            category = parts[4];
            sortMode = parts[5];
            rarityFilter = 'all';
            fromHub = parts[6] === '1';
            ownedOnly = parts[7] === '1';
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
            ownedOnly = parts[11] === '1';
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
            ownedOnly = parts[9] === '1';
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
            ownedOnly = parts[10] === '1';
        } else if (action === 'bowned' && interaction.isButton()) {
            ownerId = parts[2];
            viewerId = parts[3];
            category = parts[4];
            perPageMode = parts[5];
            sortMode = parts[6];
            rarityFilter = parts[7] || 'all';
            fromHub = parts[8] === '1';
            ownedOnly = parts[9] === '1';
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
            ownedOnly = parts[10] === '1';
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
            ownedOnly = parts[9] === '1';
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
        const payload = await buildBinderReplyPayload(ownerMember, viewerId, { category, perPageMode, page, sortMode, rarityFilter, ownedOnly, fromHub });
        if (action === 'bpagesub' && !interaction.isFromMessage?.()) {
            await interaction.editReply(payload);
        } else {
            await interaction.editReply({ content: null, ...payload, attachments: [] });
        }
        return true;
    }

    // ----- SÉLECTION & NAVIGATION CARTE (!carte) + DÉFINIR FLEX -----
    if (action === 'cartesel' && interaction.isStringSelectMenu()) {
        const ownerId = parts[2];
        if (!canControlTcgOwner(interaction.user.id, ownerId)) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true }), true;
        const card = cardById.get(interaction.values[0]);
        const u = getOrCreateTcgUser(ownerId);
        if (!card || (u.cards?.[card.id] || 0) <= 0) {
            await interaction.reply({ content: "🔒 Tu ne possèdes pas cette carte dans ton RegaDex !", ephemeral: true });
            return true;
        }
        await interaction.deferUpdate();
        await interaction.editReply({ content: null, ...buildSingleCardPayload(card, ownerId), attachments: [] });
        return true;
    }

    if (action === 'cartenav' && interaction.isButton()) {
        const dir = parts[2];
        const currentCardId = parts[3];
        const ownerId = parts[4];
        if (!canControlTcgOwner(interaction.user.id, ownerId)) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true }), true;
        const u = getOrCreateTcgUser(ownerId);
        const ownedCards = cardCatalog.filter(c => (u.cards?.[c.id] || 0) > 0);
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
        await interaction.editReply({ content: null, ...buildSingleCardPayload(ownedCards[targetIdx], ownerId), attachments: [] });
        return true;
    }

    if (action === 'setflex' && interaction.isButton()) {
        const cardId = parts[2];
        const ownerId = parts[3];
        const context = parts[4] || 'card';
        if (!canControlTcgOwner(interaction.user.id, ownerId)) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true }), true;
        const card = cardById.get(cardId);
        const u = getOrCreateTcgUser(ownerId);
        if (!card || (u.cards?.[card.id] || 0) <= 0) {
            await interaction.reply({ content: "❌ Tu ne possèdes pas cette carte.", ephemeral: true });
            return true;
        }
        u.favoriteCardId = card.id;
        if (!isSandboxId(ownerId)) tcgBridge.demanderSauvegarde();

        if (context === 'booster') {
            const session = boosterSessions.get(interaction.message?.id);
            if (session && session.step < 3) {
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
        const card = cardById.get(interaction.values[0]);
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
                    ((!trade.isPublic || !trade.canEveryoneTalk) ? `🔒 *Thread en mode restreint : les messages des autres membres y sont automatiquement supprimés.*\n` : ''),
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
            await interaction.reply({ content: "❌ Seuls les deux participants de l'échange peuvent utiliser ces contrôles.", ephemeral: true });
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
            if (!trade.lockedOffers[uid] && (trade.offers[uid]?.length || 0) === 0) {
                await interaction.reply({ content: "❌ Tu dois proposer au moins **1 carte** avant de valider ton offre *(les dons à sens unique sont interdits)*.", ephemeral: true });
                return true;
            }
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
            if (isLastCopy) {
                await interaction.update({
                    content: `✅ **${cardId}** ajoutée à ton offre !\n⚠️ **Attention :** c'est ta **dernière carte** dans ton inventaire ! Elle ne pourra être échangée **qu'à rareté égale** *(même nombre et mêmes raretés)*.`,
                    components: []
                });
                await sendSilent(
                    thread,
                    `⚠️ **Prévention :** <@${uid}> vient de proposer \`${cardId}\`${addedCard ? ` (**${addedCard.name}**)` : ''}, qui est sa **dernière carte** dans son inventaire *(échange possible uniquement avec des cartes de **même rareté**)*.`
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
                if (isLastCopy) {
                    await interaction.reply({
                        content: `✅ **${res.card.id} • ${res.card.name}** ajoutée à ton offre !\n⚠️ **Attention :** c'est ta **dernière carte** dans ton inventaire *(échange autorisé uniquement à rareté égale)*.`,
                        ephemeral: true
                    });
                    await sendSilent(
                        thread,
                        `⚠️ **Prévention :** <@${uid}> vient de proposer \`${res.card.id}\` (**${res.card.name}**), qui est sa **dernière carte** dans son inventaire *(échange possible uniquement avec des cartes de **même rareté**)*.`
                    ).catch(() => {});
                } else {
                    await interaction.reply({ content: `✅ **${res.card.id} • ${res.card.name}** ajoutée à ton offre !`, ephemeral: true });
                }
                return true;
            }

            const tradableMatches = res.matches.filter(c => {
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
            await interaction.reply({ content: "Seuls les deux participants peuvent voter !", ephemeral: true });
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
            const mVal = parseInt(interaction.values[0], 10);
            if (!isNaN(mVal) && mVal >= 1) session.mult = mVal;
            await interaction.update(buildPullChancePayload(sessionId, session, interaction.guild));
            return true;
        }
        if (sub === 'apply' && interaction.isButton()) {
            if (!session.targetKey || !session.cardId) {
                await interaction.reply({ content: "❌ Choisis une cible et une carte.", ephemeral: true });
                return true;
            }
            if (!data.pullBoosts) data.pullBoosts = {};
            if (session.mult <= 1) {
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

    return false;
}

module.exports = {
    TCG_ROLE_ID,
    TCG_CHANNEL_ID,
    TCG_TEST_CHANNEL_ID,
    TCG_TRADE_LOG_CHANNEL_ID,
    TCG_PANTHEON_CHANNEL_ID,
    AFK_VOCAL_CHANNEL_ID,
    initTcgState,
    scanSet1Cards,
    getTcgCardsCount,
    restaurerNotifsTcg,
    verifierInactiviteTradesTcg,
    trackTcgMessagePoint,
    trackTcgVocalMinute,
    trackTcgRoulettePoint,
    handleTcgTradeThreadMessage,
    handleTcgMessage,
    handleTcgSlash,
    handleTcgInteraction
};