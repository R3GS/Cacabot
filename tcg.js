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
const TCG_TEST_CHANNEL_ID = '1480756332373213275'; // Crash-test & Alertes intégrité
const TCG_TRADE_LOG_CHANNEL_ID = '1572168354435964928'; // Salon privé Epsys
const AFK_VOCAL_CHANNEL_ID = '1542345102930874449';

const BOOSTER_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6h
const HALF_COOLDOWN_MS = 3 * 60 * 60 * 1000; // 3h
const MAX_FREE_BOOSTERS = 2;
const BOOSTER_GIF_DELAY_MS = 5500; // 5,5 secondes
const TRADE_INACTIVITY_MS = 24 * 60 * 60 * 1000; // 24h

const POINTS_PER_BOOSTER = 5;
const POINTS_PER_DUPLICATE = 3;
const MESSAGES_PER_POINT = 15;
const VOCAL_MINUTES_PER_POINT = 10;

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
    'Commune': 45,
    'Rare': 25,
    'Épique': 15,
    'Légendaire': 10,
    'Full Art': 4,
    'Négative': 1
};
const RARITY_META = {
    'Commune': { color: 0xe6d5b8, hex: '#E6D5B8', glow: '#E6D5B8', emoji: '⚪' },
    'Rare': { color: 0x3498db, hex: '#3498DB', glow: '#3498DB', emoji: '🔵' },
    'Épique': { color: 0x9b59b6, hex: '#A855F7', glow: '#A855F7', emoji: '🟣' },
    'Légendaire': { color: 0xf1c40f, hex: '#F1C40F', glow: '#F1C40F', emoji: '🟡' },
    'Full Art': { color: 0xffffff, hex: '#FFFFFF', glow: '#FFFFFF', emoji: '🌈' },
    'Négative': { color: 0x2ecc71, hex: '#2ECC71', glow: '#2ECC71', emoji: '🕳️' }
};

const CATEGORIES = ['Items', 'Personnages', 'Références'];

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
    return data;
}

// ==========================================
//   CATALOGUE & SCAN AUTOMATIQUE SET 1
// ==========================================

const TCG_ROOT = path.resolve(process.cwd(), 'TCG');
const TCG_ASSETS_DIR = path.join(TCG_ROOT, 'Assets');
const TCG_SET1_DIR = path.join(TCG_ROOT, 'Set 1');

let cardCatalog = [];
let cardById = new Map();
let cardByNumCode = new Map();
let assetPaths = {
    openingGif: null,
    mysteryCard: null,
    boosterPng: null,
    eventBanner: null,
    bgW: null,
    bgB: null
};

const imageCache = new Map();
const thumbCache = new Map();
const boostersEnCours = new Set();
const boosterSessions = new Map(); // messageId -> session
const pendingConfirms = new Map(); // confirmId -> payload
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
        name: rawName,
        baseName,
        normalizedName: normalizeText(rawName),
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
        bgW: findExistingFile(TCG_ASSETS_DIR, ['Background RegaDex W.png', 'Background Readex W.png']),
        bgB: findExistingFile(TCG_ASSETS_DIR, ['Background RegaDex B.png', 'Background Readex B.png'])
    };

    if (!assetPaths.openingGif) missingAssets.push('TCG/Assets/Ouverture Set 1.gif');
    if (!assetPaths.mysteryCard) missingAssets.push('TCG/Assets/Carte mystère.png');
    if (!assetPaths.boosterPng) missingAssets.push('TCG/Assets/Booster Set 1.png');
    if (!assetPaths.eventBanner) missingAssets.push('TCG/Set 1/Event banner Set 1.png');
    if (!assetPaths.bgW) missingAssets.push('TCG/Assets/Background RegaDex W.png (ou Readex W.png)');
    if (!assetPaths.bgB) missingAssets.push('TCG/Assets/Background RegaDex B.png (ou Readex B.png)');

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
    imageCache.clear();
    thumbCache.clear();

    console.log(`🃏 RegaDex Set 1 scanné : ${cardCatalog.length}/109 cartes reconnues.`);

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

function getOrCreateTcgUser(userId) {
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
    const nextAt = getNextBoosterTimestamp(u);
    if (!nextAt) {
        delete data.notifs[userId];
        tcgBridge.demanderSauvegarde();
        return;
    }

    notif.notifyAt = nextAt;
    const delay = Math.max(1000, nextAt - Date.now());
    const safeDelay = Math.min(delay, 2147483000);

    const timer = setTimeout(async () => {
        notifTimers.delete(userId);
        const latestData = getStoreData();
        const latestNotif = latestData.notifs?.[userId];
        if (!latestNotif) return;

        const userObj = getOrCreateTcgUser(userId);
        if (userObj.freeBoosters < 1 && getNextBoosterTimestamp(userObj)) {
            return armerNotifBooster(userId, client);
        }

        delete latestData.notifs[userId];
        tcgBridge.demanderSauvegarde();

        try {
            const c = client || tcgBridge.client;
            if (!c) return;
            const text = `🃏 <@${userId}>, ton **Booster gratuit Set 1** est prêt ! Tu as actuellement **${userObj.freeBoosters}/${MAX_FREE_BOOSTERS}** booster(s) gratuit(s) disponible(s) dans <#${TCG_CHANNEL_ID}>.`;
            if (latestNotif.mode === 'dm') {
                const user = await c.users.fetch(userId).catch(() => null);
                let dmOk = false;
                if (user) {
                    dmOk = await user.send(text).then(() => true).catch(() => false);
                }
                if (!dmOk) {
                    const fallbackCh = await c.channels.fetch(latestNotif.channelId || TCG_CHANNEL_ID).catch(() => null);
                    if (fallbackCh) {
                        await fallbackCh.send(`${text} *(Tes MP Discord étant fermés, je te préviens ici)*`).catch(() => {});
                    }
                }
            } else {
                const ch = await c.channels.fetch(latestNotif.channelId || TCG_CHANNEL_ID).catch(() => null);
                if (ch) await ch.send(text).catch(() => {});
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

    const exact = cardCatalog.filter(c => c.normalizedName === normQ);
    if (exact.length === 1) return { card: exact[0], matches: exact };
    if (exact.length > 1) return { card: null, matches: exact };

    const partial = cardCatalog.filter(c =>
        c.normalizedName.includes(normQ) ||
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

function pickWeightedRarity(excludeCommune = false, excludeRarities = new Set()) {
    const pool = RARITY_LIST.filter(r => {
        if (excludeCommune && r === 'Commune') return false;
        if (excludeRarities.has(r)) return false;
        return cardCatalog.some(c => c.rarity === r);
    });
    if (pool.length === 0) return null;

    const total = pool.reduce((sum, r) => sum + (RARITY_WEIGHTS[r] || 1), 0);
    let roll = Math.random() * total;
    for (const r of pool) {
        roll -= (RARITY_WEIGHTS[r] || 1);
        if (roll <= 0) return r;
    }
    return pool[pool.length - 1];
}

function pickCardFromPool(candidates) {
    // Holo = 2x plus rare que la carte normale (poids 1 vs 2)
    const totalWeight = candidates.reduce((s, c) => s + (c.isHolo ? 1 : 2), 0);
    let roll = Math.random() * totalWeight;
    for (const c of candidates) {
        roll -= (c.isHolo ? 1 : 2);
        if (roll <= 0) return c;
    }
    return candidates[candidates.length - 1];
}

function drawBoosterCards(u) {
    const luckyActive = Boolean(u.activeBonuses?.luckyBooster);
    const pityActive = Boolean(u.pityRare);

    const picked = [];
    const pickedIds = new Set();

    // Si pityRare est actif : garantir 1 carte de rareté 'Rare'
    let slots = 3;
    if (pityActive) {
        const rareCandidates = cardCatalog.filter(c => c.rarity === 'Rare' && !pickedIds.has(c.id));
        if (rareCandidates.length > 0) {
            const c = pickCardFromPool(rareCandidates);
            picked.push(c);
            pickedIds.add(c.id);
            slots--;
        }
    }

    for (let i = 0; i < slots; i++) {
        let chosenCard = null;
        const exhaustedRarities = new Set();

        for (let attempt = 0; attempt < RARITY_LIST.length; attempt++) {
            const r = pickWeightedRarity(luckyActive, exhaustedRarities);
            if (!r) break;
            const candidates = cardCatalog.filter(c => c.rarity === r && !pickedIds.has(c.id));
            if (candidates.length > 0) {
                chosenCard = pickCardFromPool(candidates);
                break;
            }
            exhaustedRarities.add(r);
        }

        if (!chosenCard) {
            const fallback = cardCatalog.filter(c => !pickedIds.has(c.id));
            if (fallback.length > 0) chosenCard = pickCardFromPool(fallback);
        }

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

async function loadCachedImage(filePath) {
    if (!filePath || !fs.existsSync(filePath)) return null;
    if (imageCache.has(filePath)) return imageCache.get(filePath);
    try {
        const img = await loadImage(filePath);
        imageCache.set(filePath, img);
        return img;
    } catch {
        return null;
    }
}

async function getCachedThumb(filePath, targetW, targetH) {
    if (!filePath) return null;
    const key = `${filePath}|${targetW}x${targetH}`;
    if (thumbCache.has(key)) return thumbCache.get(key);
    const img = await loadCachedImage(filePath);
    if (!img) return null;
    const c = createCanvas(targetW, targetH);
    const cctx = c.getContext('2d');
    cctx.drawImage(img, 0, 0, targetW, targetH);
    if (thumbCache.size > 400) thumbCache.clear();
    thumbCache.set(key, c);
    return c;
}

function drawCoverImage(ctx, img, w, h) {
    const scale = Math.max(w / img.width, h / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function getFilteredSortedCards(categoryFilter, sortMode) {
    let list = categoryFilter === 'complet'
        ? [...cardCatalog]
        : cardCatalog.filter(c => c.category === categoryFilter);

    if (sortMode === 'rarity') {
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
    if (perPageMode === '9') return { cols: 3, rows: 3, perPage: 9 };
    if (perPageMode === '18') return { cols: 6, rows: 3, perPage: 18 };
    if (perPageMode === '36') return { cols: 9, rows: 4, perPage: 36 };
    // Mode 'all'
    if (totalInCategory <= 27) return { cols: 9, rows: 3, perPage: Math.max(totalInCategory, 1) };
    if (totalInCategory <= 36) return { cols: 9, rows: 4, perPage: Math.max(totalInCategory, 1) };
    if (totalInCategory <= 50) return { cols: 10, rows: 5, perPage: Math.max(totalInCategory, 1) };
    return { cols: 16, rows: 7, perPage: Math.max(totalInCategory, 1) };
}

async function renderBinderCanvas(targetUser, u, options) {
    const {
        category = 'complet',
        perPageMode = '18',
        page = 0,
        sortMode = 'number'
    } = options;

    const W = 1920;
    const H = 1080;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    const isLight = u.theme === 'W';
    const textColor = isLight ? '#111111' : '#FFFFFF';
    const subTextColor = isLight ? '#333333' : '#CCCCCC';

    const bgPath = isLight ? assetPaths.bgW : assetPaths.bgB;
    const bgImg = await loadCachedImage(bgPath);
    if (bgImg) {
        drawCoverImage(ctx, bgImg, W, H);
    } else {
        ctx.fillStyle = isLight ? '#F4F1EA' : '#13151B';
        ctx.fillRect(0, 0, W, H);
    }

    const cardsList = getFilteredSortedCards(category, sortMode);
    const grid = getBinderGridConfig(perPageMode, cardsList.length);
    const totalPages = Math.max(1, Math.ceil(cardsList.length / grid.perPage));
    const safePage = Math.max(0, Math.min(page, totalPages - 1));
    const slice = cardsList.slice(safePage * grid.perPage, (safePage + 1) * grid.perPage);

    // En-tête (LEMON MILK Bold)
    const ownedInView = cardsList.filter(c => (u.cards?.[c.id] || 0) > 0).length;
    const pct = cardsList.length > 0 ? Math.round((ownedInView / cardsList.length) * 100) : 0;
    const headerLabel = category === 'complet' ? 'RegaDex • Set 1 Complet' : `RegaDex • ${category}`;

    ctx.fillStyle = isLight ? 'rgba(255,255,255,0.72)' : 'rgba(15,17,24,0.72)';
    drawRoundRect(ctx, 40, 22, W - 80, 74, 16);
    ctx.fill();

    ctx.fillStyle = textColor;
    ctx.font = 'bold 30px "LemonMilk", "Sans"';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const displayName = targetUser.displayName || targetUser.username || 'Collectionneur';
    ctx.fillText(`${headerLabel} — ${displayName}`, 68, 59, W * 0.56);

    ctx.textAlign = 'right';
    ctx.font = 'bold 24px "LemonMilk", "Sans"';
    ctx.fillText(`${ownedInView}/${cardsList.length} (${pct}%)  •  Page ${safePage + 1}/${totalPages}`, W - 68, 59, W * 0.34);

    // Zone grille
    const padX = 48;
    const startY = 114;
    const availW = W - padX * 2;
    const availH = H - startY - 26;

    const cellW = availW / grid.cols;
    const cellH = availH / grid.rows;
    const labelH = grid.rows >= 6 ? 22 : (grid.rows >= 4 ? 26 : 34);
    const maxCardH = cellH - labelH - 8;
    const maxCardW = cellW - 14;
    const cardRatio = 500 / 700;

    let cardH = maxCardH;
    let cardW = cardH * cardRatio;
    if (cardW > maxCardW) {
        cardW = maxCardW;
        cardH = cardW / cardRatio;
    }
    cardW = Math.floor(cardW);
    cardH = Math.floor(cardH);

    const fontSize = grid.rows >= 6 ? 14 : (grid.rows >= 4 ? 18 : 23);
    const mysteryThumb = await getCachedThumb(assetPaths.mysteryCard, cardW, cardH);

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
            const thumb = await getCachedThumb(card.filePath, cardW, cardH);
            if (thumb) {
                const meta = RARITY_META[card.rarity] || RARITY_META['Commune'];
                const glowHex = meta.glow || meta.hex || '#FFFFFF';

                // 1. Ombre portée noire légère
                ctx.save();
                ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
                ctx.shadowBlur = Math.max(5, Math.round(cardW * 0.05));
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = Math.max(2, Math.round(cardH * 0.02));
                ctx.drawImage(thumb, cardX, cardY, cardW, cardH);
                ctx.restore();

                // 2. Lueur de la couleur de la rareté (sans contour plein)
                ctx.save();
                ctx.shadowColor = glowHex;
                ctx.shadowBlur = Math.max(8, Math.round(cardW * 0.08));
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
                ctx.drawImage(thumb, cardX, cardY, cardW, cardH);
                ctx.restore();
            } else {
                ctx.fillStyle = RARITY_META[card.rarity]?.hex || '#888888';
                drawRoundRect(ctx, cardX, cardY, cardW, cardH, 8);
                ctx.fill();
            }
        } else {
            // Cartes mystères : ombre portée noire légère uniquement (pas de lueur pour éviter tout spoiler de rareté)
            ctx.save();
            ctx.globalAlpha = 0.78;
            ctx.shadowColor = 'rgba(0, 0, 0, 0.42)';
            ctx.shadowBlur = Math.max(5, Math.round(cardW * 0.05));
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = Math.max(2, Math.round(cardH * 0.02));
            if (mysteryThumb) {
                ctx.drawImage(mysteryThumb, cardX, cardY, cardW, cardH);
            } else {
                ctx.fillStyle = isLight ? '#CCCCCC' : '#2C2F3A';
                drawRoundRect(ctx, cardX, cardY, cardW, cardH, 8);
                ctx.fill();
            }
            ctx.restore();
        }

        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.font = `bold ${fontSize}px "LemonMilk", "Sans"`;
        ctx.fillStyle = owned ? textColor : subTextColor;
        const labelText = owned ? `#${card.numCode} • x${count}` : `#${card.numCode} • x0`;
        ctx.fillText(labelText, cx, cardY + cardH + 4, cellW - 8);
    }

    return {
        buffer: canvas.toBuffer('image/png'),
        totalPages,
        safePage,
        ownedInView,
        totalInView: cardsList.length
    };
}

async function renderBoosterRecapCanvas(cards, isNewFlags, theme = 'B') {
    const W = 1280;
    const H = 1040;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    const isLight = theme === 'W';

    const bgImg = await loadCachedImage(isLight ? assetPaths.bgW : assetPaths.bgB);
    if (bgImg) {
        drawCoverImage(ctx, bgImg, W, H);
    } else {
        ctx.fillStyle = isLight ? '#F4F1EA' : '#13151B';
        ctx.fillRect(0, 0, W, H);
    }

    ctx.fillStyle = isLight ? 'rgba(255,255,255,0.78)' : 'rgba(12,14,20,0.78)';
    drawRoundRect(ctx, 40, 22, W - 80, 66, 16);
    ctx.fill();

    ctx.fillStyle = isLight ? '#111111' : '#FFFFFF';
    ctx.font = 'bold 31px "LemonMilk", "Sans"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Récapitulatif du Booster Set 1', W / 2, 55, W - 120);

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
        const meta = RARITY_META[card.rarity] || RARITY_META['Commune'];

        const img = await loadCachedImage(card.filePath);
        if (img) {
            ctx.save();
            ctx.shadowColor = meta.glow || meta.hex;
            ctx.shadowBlur = 30;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            ctx.drawImage(img, pos.x, pos.y, cardW, cardH);
            ctx.restore();
        }

        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.font = 'bold 18px "LemonMilk", "Sans"';
        ctx.fillStyle = isLight ? '#111111' : '#FFFFFF';
        const statusTxt = isNewFlags[i] ? 'NOUVELLE !' : 'DOUBLON (+3 PTS)';
        ctx.fillText(`${card.id} • ${card.rarity} • ${statusTxt}`, pos.x + cardW / 2, pos.y + cardH + 10, cardW + 90);
    }

    return canvas.toBuffer('image/png');
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
            const img = await loadCachedImage(card.filePath);
            if (img) ctx.drawImage(img, x, y, cW, cH);

            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 15px "LemonMilk", "Sans"';
            ctx.textAlign = 'center';
            ctx.fillText(card.id, x + cW / 2, y + cH + 18, cW + 10);
        }
    };

    await drawSide(nameA, cardsA, 48, 580);
    await drawSide(nameB, cardsB, W - 48 - 580, 580);

    return canvas.toBuffer('image/png');
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
        .setTitle('🃏 Tableau de bord — Set 1')
        .setDescription(
            `Bienvenue dans ton espace **RegaDex** !\n` +
            `Ouvre tes boosters, remplis ton classeur et échange tes doublons.\n\n` +
            `### 📚 Progression Set 1\n` +
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
                    `• Thème : ${u.theme === 'W' ? '☀️ Clair (W)' : '🌙 Nuit (B)'}\n` +
                    `• Flex : ${favCard ? `\`${favCard.id}\` ${favCard.name}` : '*Aucune carte*'}`,
                inline: true
            }
        )
        .setFooter({ text: 'RegaDex TCG • Set 1 — Clique sur 📘 Guide si tu débutes' });

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
            .setCustomId(`tcg:notif:menu:${userId}:1`)
            .setLabel(hasNotif ? 'Alerte ✓' : 'Me prévenir')
            .setEmoji('🔔')
            .setStyle(hasNotif ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`tcg:theme:${userId}`)
            .setLabel(u.theme === 'W' ? 'Nuit (B)' : 'Clair (W)')
            .setEmoji(u.theme === 'W' ? '🌙' : '☀️')
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
            .setStyle(ButtonStyle.Secondary)
    );

    return [row1, row2];
}

function buildGuidePayload(userId, fromHub = true) {
    const sep = '\n────────────────────────────────────────\n';

    const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle('📘 Guide complet du RegaDex TCG — Set 1')
        .setDescription(
            `Collectionne les **109 cartes** du Set 1 *(Items, Personnages & Références)* en ouvrant des boosters et en échangeant tes doublons !\n` +
            sep +
            `### 🎁 1. Boosters & Ouverture\n` +
            `• Tu reçois **1 booster gratuit toutes les 6h** *(max **2** en attente)*.\n` +
            `• Chaque booster contient **3 cartes uniques**, révélées de la plus commune à la plus rare.\n` +
            `• **Système de Pity :** si un booster ne te donne que **3 Communes**, ton prochain booster garantit au moins **1 carte Rare**.\n` +
            `• Tu peux activer une **alerte 🔔** *(ici ou en MP)* pour être prévenu(e) dès que ton prochain booster est prêt !` +
            sep +
            `### ✨ 2. Raretés, Holos & Négatives\n` +
            `• **Taux de tirage :**\n` +
            `  ⚪ Commune \`45%\` • 🔵 Rare \`25%\` • 🟣 Épique \`15%\`\n` +
            `  🟡 Légendaire \`10%\` • 🌈 Full Art \`4%\` • 🕳️ Négative \`1%\`\n` +
            `• **Cartes Holographiques :** certaines cartes ont une version *Holo* avec leur propre numéro, **2× plus rare** que l'originale.\n` +
            `• **Cartes Négatives :** **13 cartes secrètes** numérotées \`1-Ø1\` à \`1-Ø13\`, les plus rares du Set 1.` +
            sep +
            `### 🪙 3. Points RegaDex & Store\n` +
            `• **Comment gagner des points :**\n` +
            `  15 messages = **+1pt** • 10 min en vocal *(≥ 3 membres, hors AFK)* = **+1pt**\n` +
            `  1 roulette = **+1pt** • 1 booster ouvert = **+5pts** • 1 doublon = **+3pts**\n` +
            `• **RegaDex Store (\`🛒 Store\`) :** tes achats vont dans ton **🎒 Inventaire** (\`!regadex claim\`) :\n` +
            `  • 🎁 **Booster** (\`100 pts\`) — Un booster supplémentaire à ouvrir.\n` +
            `  • 🍀 **Chanceux** (\`75 pts\`) — Retire toutes les *Communes* du prochain booster.\n` +
            `  • ✨ **Transfo Holo** (\`50 pts\`) — Transforme une carte compatible possédée en *Holo*.\n` +
            `  • ⚡ **Cooldown /2** (\`25 pts\`) — Le prochain rechargement gratuit passe à **3h** au lieu de 6h.` +
            sep +
            `### 📖 4. Classeur, Échanges & Commandes\n` +
            `• **Classeur :** filtre par catégorie, choisis l'affichage (\`9\`, \`18\`, \`36\` ou \`All\`) et le thème **Clair (W) / Nuit (B)**.\n` +
            `• **Voir le classeur d'un membre :** utilise le menu déroulant du classeur ou \`!classeur @membre\` *(cela mentionne la personne pour lui demander son accord)*.\n` +
            `• **Échanges (\`!trade [@]\` ou clic droit sur un membre) :** échange jusqu'à **3 doublons** *(cartes possédées en ≥ 2 exemplaires)* dans un thread dédié.\n` +
            `• **Commandes rapides :** \`!tcg\` • \`!open\` • \`!carte [n°/nom]\` *(cartes obtenues uniquement)* • \`!tcg flex\` *(utilisable partout sur le serveur)*`
        )
        .setFooter({ text: 'RegaDex Set 1 • Cacabot' });

    const components = fromHub
        ? [new ActionRowBuilder().addComponents(buildAccueilButton(userId))]
        : [];

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
            `Sans oublier <@390562565417336834> qui est toujours présente pour m'aider à vous offrir la meilleure qualité visuelle possible.\n\n` +
            `Et surtout, merci à toutes les personnes qui ouvrent des boosters, complètent leur classeur et font vivre le **RegaDex** sur **Regaïa** ! 💜\n` +
            `Chaque carte du Set 1 a été imaginée et montée avec soin pour la communauté.` +
            ` — ***Epsys***\n` +
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
                    `De l'intelligence artificielle a pu être utilisée sur certaines cartes **purement** à des fins d'**upscaling** *(amélioration de la résolution et de la netteté)*.\n` +
                    `**Aucune carte** n'a été **imaginée**, **modifiée** ou **générée à 100 %** par intelligence artificielle.\n` +
                    `────────────────────────────────────────`,
                inline: false
            }
        )
        .setFooter({ text: 'RegaDex • Créé par Epsys, pour Regaïa' });

    const components = fromHub
        ? [new ActionRowBuilder().addComponents(buildAccueilButton(userId))]
        : [];

    return { embeds: [embed], components };
}

function buildOpenPromptPayload(member, u, fromHub = false) {
    const totalAvail = getTotalAvailableBoosters(u);
    const nextTs = getNextBoosterTimestamp(u);
    const data = getStoreData();
    const hasNotif = Boolean(data.notifs?.[member.id]);
    const hubSuffix = fromHub ? ':1' : '';

    const desc = totalAvail > 0
        ? `### Vous avez **${totalAvail} booster${totalAvail > 1 ? 's' : ''} disponible${totalAvail > 1 ? 's' : ''}** !\nEn ouvrir un maintenant ?\n\n` +
          `🎁 **Gratuits :** \`${u.freeBoosters}/${MAX_FREE_BOOSTERS}\` • 🎒 **Inventaire :** \`${u.inventory?.booster || 0}\`` +
          (nextTs ? `\n⏱️ Prochain booster gratuit <t:${Math.floor(nextTs / 1000)}:R>` : '\n✅ Jauge gratuite pleine (`2/2`)')
        : `### Vous n'avez aucun booster disponible pour le moment.\n` +
          `⏱️ Prochain booster gratuit <t:${Math.floor(nextTs / 1000)}:R>\n` +
          `💡 Tu peux aussi acheter un booster à **${STORE_PRICES.booster} pts** dans le Store *(Solde : **${u.points} pts**)*.`;

    const embed = new EmbedBuilder()
        .setColor(totalAvail > 0 ? 0x2ecc71 : 0x95a5a6)
        .setAuthor({ name: `Boosters de ${member.displayName}`, iconURL: member.displayAvatarURL({ dynamic: true }) })
        .setTitle('🃏 Booster Set 1 — RegaDex')
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
            .setCustomId(`tcg:notif:here:${member.id}${hubSuffix}`)
            .setLabel('Me prévenir ici')
            .setEmoji('🔔')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!nextTs || hasNotif),
        new ButtonBuilder()
            .setCustomId(`tcg:notif:dm:${member.id}${hubSuffix}`)
            .setLabel('Me prévenir en MP')
            .setEmoji('📩')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!nextTs || hasNotif)
    );

    if (fromHub) {
        row.addComponents(buildAccueilButton(member.id));
    }

    return { embeds: [embed], components: [row], files };
}

function buildNotifMenuPayload(member, u, fromHub = false, statusNote = null) {
    const nextTs = getNextBoosterTimestamp(u);
    const data = getStoreData();
    const currentNotif = data.notifs?.[member.id];
    const hubSuffix = fromHub ? ':1' : '';

    let statusText = '🔕 **Alerte actuelle :** Désactivée';
    if (currentNotif) {
        statusText = currentNotif.mode === 'dm'
            ? '📩 **Alerte actuelle :** Active en **Message Privé**'
            : '🔔 **Alerte actuelle :** Active **dans ce salon**';
    }

    const embed = new EmbedBuilder()
        .setColor(currentNotif ? 0x3498db : 0x95a5a6)
        .setAuthor({ name: `Alertes Booster • ${member.displayName}`, iconURL: member.displayAvatarURL({ dynamic: true }) })
        .setTitle('🔔 Prévenir à l\'arrivée du prochain booster')
        .setDescription(
            (nextTs
                ? `⏱️ Prochain booster gratuit prêt **<t:${Math.floor(nextTs / 1000)}:R>**.\n\n`
                : `✅ Ta jauge de boosters gratuits est déjà pleine (**${u.freeBoosters}/${MAX_FREE_BOOSTERS}**).\n\n`) +
            statusText +
            (statusNote ? `\n\n${statusNote}` : '')
        );

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:notif:here:${member.id}${hubSuffix}`)
            .setLabel('Me prévenir ici')
            .setEmoji('🔔')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(!nextTs),
        new ButtonBuilder()
            .setCustomId(`tcg:notif:dm:${member.id}${hubSuffix}`)
            .setLabel('Me prévenir en MP')
            .setEmoji('📩')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!nextTs),
        new ButtonBuilder()
            .setCustomId(`tcg:notif:off:${member.id}${hubSuffix}`)
            .setLabel('Désactiver')
            .setEmoji('🔕')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(!currentNotif)
    );

    if (fromHub) {
        row.addComponents(buildAccueilButton(member.id));
    }

    return { embeds: [embed], components: [row] };
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
            `🎁 **Booster Set 1** — \`${STORE_PRICES.booster} pts\`\n` +
            `-# Un booster de 3 cartes Set 1 à ouvrir quand tu veux.\n\n` +
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
            .setCustomId(`tcg:claim:open:${member.id}${hubSuffix}`)
            .setLabel('Mon Inventaire')
            .setEmoji('🎒')
            .setStyle(ButtonStyle.Secondary)
    );
    if (fromHub) {
        row2.addComponents(buildAccueilButton(member.id));
    }

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
            `🎁 **Booster Set 1 :** \`${inv.booster || 0}\`\n` +
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

    const components = [row];
    if (fromHub) {
        components.push(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`tcg:store:open:${member.id}:1`)
                    .setLabel('RegaDex Store')
                    .setEmoji('🛒')
                    .setStyle(ButtonStyle.Secondary),
                buildAccueilButton(member.id)
            )
        );
    }

    return { embeds: [embed], components };
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
        .setTitle(mode === 'completion' ? '🏆 Classement RegaDex — Complétion Set 1' : '🏆 Classement RegaDex — Total de Cartes')
        .setDescription(lines.join('\n'))
        .setFooter({ text: 'RegaDex Set 1 • Cacabot' });
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
            .setLabel('Complétion Set 1 (/109)')
            .setEmoji('📚')
            .setStyle(mode === 'completion' ? ButtonStyle.Primary : ButtonStyle.Secondary)
    );
    if (fromHub) {
        row.addComponents(buildAccueilButton(authorId));
    }
    return [row];
}

// ==========================================
//   OUVERTURE DE BOOSTER (SÉQUENCE 5.5s)
// ==========================================

function buildBoosterCardEmbed(member, session, stepIndex) {
    const card = session.cards[stepIndex];
    const isNew = session.isNewFlags[stepIndex];
    const meta = RARITY_META[card.rarity] || RARITY_META['Commune'];

    const embed = new EmbedBuilder()
        .setColor(meta.color)
        .setAuthor({ name: `Ouverture de ${member.displayName}`, iconURL: member.displayAvatarURL({ dynamic: true }) })
        .setTitle(`${meta.emoji} Carte ${stepIndex + 1}/3 — ${card.name}`)
        .setDescription(
            `🆔 **Numéro :** \`${card.id}\` • 📁 **Catégorie :** \`${card.category}\`\n` +
            `✨ **Rareté :** **${card.rarity}**${card.isHolo ? ' **(Holographique)**' : ''}\n` +
            (isNew ? `🆕 **NOUVELLE CARTE AJOUTÉE AU REGADEX !**` : `🔁 **Doublon !** *+3 points RegaDex gagnés*`)
        )
        .setImage('attachment://carte_booster.png')
        .setFooter({ text: `Booster Set 1 • Révélation ${stepIndex + 1}/3` });

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
    } else {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`tcg:bstep:recap:${session.userId}`)
                .setLabel('Récapitulatif')
                .setEmoji('📊')
                .setStyle(ButtonStyle.Success)
        );
    }

    return { embeds: [embed], components: [row], files };
}

async function buildBoosterRecapPayload(member, session) {
    const u = getOrCreateTcgUser(session.userId);
    const buffer = await renderBoosterRecapCanvas(session.cards, session.isNewFlags, u.theme);
    const nextTs = getNextBoosterTimestamp(u);
    const data = getStoreData();
    const hasNotif = Boolean(data.notifs?.[session.userId]);
    const totalAvail = getTotalAvailableBoosters(u);
    const hubSuffix = session.fromHub ? ':1' : '';

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

    const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setAuthor({ name: `Booster Set 1 de ${member.displayName}`, iconURL: member.displayAvatarURL({ dynamic: true }) })
        .setTitle('📊 Récapitulatif du Booster')
        .setDescription(
            lines.join('\n') +
            `\n\n🪙 **Points RegaDex gagnés :** **+${session.ptsEarned} pts** *(Solde : ${u.points} pts)*` +
            cooldownLine +
            (bonusInfo.length > 0 ? `\n\n${bonusInfo.join('\n')}` : '')
        )
        .setImage('attachment://recap_booster.png')
        .setFooter({ text: `Boosters restants : ${totalAvail}` });

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

    if (session.fromHub) {
        row1.addComponents(buildAccueilButton(session.userId));
    }

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:notif:here:${session.userId}`)
            .setLabel('Me prévenir ici')
            .setEmoji('🔔')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!nextTs || hasNotif),
        new ButtonBuilder()
            .setCustomId(`tcg:notif:dm:${session.userId}`)
            .setLabel('Me prévenir en MP')
            .setEmoji('📩')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!nextTs || hasNotif)
    );

    return {
        embeds: [embed],
        components: [row1, row2],
        files: [new AttachmentBuilder(buffer, { name: 'recap_booster.png' })]
    };
}

async function startBoosterOpening(targetResponder, member, client, fromHub = false) {
    const userId = member.id;
    if (cardCatalog.length === 0) {
        const msg = "❌ Les cartes Set 1 ne sont pas encore chargées.";
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
        if (fromHub && targetResponder.isButton?.()) {
            await targetResponder.deferUpdate();
            return targetResponder.editReply({ content: null, ...payload, attachments: [] });
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
        const draw = drawBoosterCards(u);
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

        tcgBridge.trackBattlePassProgress(userId, 'tcg_booster', 1);
        if (duplicatesInPack > 0) {
            tcgBridge.trackBattlePassProgress(userId, 'tcg_doublon', duplicatesInPack);
        }

        const data = getStoreData();
        if (data.notifs?.[userId]) armerNotifBooster(userId, client);
        tcgBridge.demanderSauvegarde();

        const gifEmbed = new EmbedBuilder()
            .setColor(0xf1c40f)
            .setAuthor({ name: `Ouverture de ${member.displayName}`, iconURL: member.displayAvatarURL({ dynamic: true }) })
            .setTitle('✨ Ouverture du Booster Set 1 en cours...');

        const files = [];
        if (assetPaths.openingGif && fs.existsSync(assetPaths.openingGif)) {
            files.push(new AttachmentBuilder(assetPaths.openingGif, { name: 'ouverture_set1.gif' }));
            gifEmbed.setImage('attachment://ouverture_set1.gif');
        }

        let sentMsg;
        if (fromHub && targetResponder.isButton?.()) {
            await targetResponder.deferUpdate();
            sentMsg = await targetResponder.editReply({
                content: null,
                embeds: [gifEmbed],
                components: [],
                files,
                attachments: []
            });
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
            step: 0
        };
        boosterSessions.set(sentMsg.id, session);

        setTimeout(async () => {
            boostersEnCours.delete(userId);
            try {
                const firstPayload = buildBoosterCardEmbed(member, session, 0);
                await sentMsg.edit({ ...firstPayload, attachments: [] });
            } catch {}
        }, BOOSTER_GIF_DELAY_MS);
    } catch (err) {
        boostersEnCours.delete(userId);
        console.error('Erreur startBoosterOpening:', err);
    }
}

// ==========================================
//   AFFICHAGE CLASSEUR & CARTE & FLEX
// ==========================================

function buildBinderComponents(ownerId, viewerId, options, totalPages) {
    const { category, perPageMode, page, sortMode, fromHub = false } = options;
    const hubFlag = fromHub ? '1' : '0';

    const catMenu = new StringSelectMenuBuilder()
        .setCustomId(`tcg:bcat:${ownerId}:${viewerId}:${perPageMode}:${sortMode}:${hubFlag}`)
        .setPlaceholder('Choisir un classeur...')
        .addOptions([
            { label: 'Complet Set 1 (109 cartes)', value: 'complet', emoji: '📚', default: category === 'complet' },
            { label: 'Items (26 cartes)', value: 'Items', emoji: '🧰', default: category === 'Items' },
            { label: 'Personnages (49 cartes)', value: 'Personnages', emoji: '🧑', default: category === 'Personnages' },
            { label: 'Références (34 cartes)', value: 'Références', emoji: '🎬', default: category === 'Références' }
        ]);

    const perPageMenu = new StringSelectMenuBuilder()
        .setCustomId(`tcg:bsize:${ownerId}:${viewerId}:${category}:${sortMode}:${hubFlag}`)
        .setPlaceholder('Cartes par page...')
        .addOptions([
            { label: '9 cartes par page (3×3)', value: '9', default: perPageMode === '9' },
            { label: '18 cartes par page (6×3)', value: '18', default: perPageMode === '18' },
            { label: '36 cartes par page (9×4)', value: '36', default: perPageMode === '36' },
            { label: 'Tout sur 1 page (All)', value: 'all', default: perPageMode === 'all' }
        ]);

    const userMenu = new UserSelectMenuBuilder()
        .setCustomId(`tcg:binder:pickuser:${viewerId}`)
        .setPlaceholder('Consulter le classeur d\'un autre membre...');

    const navRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:bnav:first:${ownerId}:${viewerId}:${category}:${perPageMode}:${page}:${sortMode}:${hubFlag}`)
            .setLabel('Première page')
            .setEmoji('⏪')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page <= 0),
        new ButtonBuilder()
            .setCustomId(`tcg:bnav:prev:${ownerId}:${viewerId}:${category}:${perPageMode}:${page}:${sortMode}:${hubFlag}`)
            .setLabel('Précédent')
            .setEmoji('◀️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page <= 0),
        new ButtonBuilder()
            .setCustomId(`tcg:bnav:next:${ownerId}:${viewerId}:${category}:${perPageMode}:${page}:${sortMode}:${hubFlag}`)
            .setLabel('Suivant')
            .setEmoji('▶️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page >= totalPages - 1),
        new ButtonBuilder()
            .setCustomId(`tcg:bnav:last:${ownerId}:${viewerId}:${category}:${perPageMode}:${page}:${sortMode}:${hubFlag}`)
            .setLabel('Dernière page')
            .setEmoji('⏩')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page >= totalPages - 1)
    );

    const optRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tcg:bsort:${ownerId}:${viewerId}:${category}:${perPageMode}:${page}:${sortMode === 'number' ? 'rarity' : 'number'}:${hubFlag}`)
            .setLabel(sortMode === 'number' ? 'Tri : Rareté' : 'Tri : Numéro')
            .setEmoji('🔀')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`tcg:btheme:${ownerId}:${viewerId}:${category}:${perPageMode}:${page}:${sortMode}:${hubFlag}`)
            .setLabel('Thème B/W')
            .setEmoji('🌗')
            .setStyle(ButtonStyle.Secondary)
    );

    if (fromHub && ownerId === viewerId) {
        optRow.addComponents(buildAccueilButton(viewerId));
    }

    return [
        new ActionRowBuilder().addComponents(catMenu),
        new ActionRowBuilder().addComponents(perPageMenu),
        new ActionRowBuilder().addComponents(userMenu),
        navRow,
        optRow
    ];
}

async function buildBinderReplyPayload(ownerMember, viewerId, options = {}) {
    const ownerUser = ownerMember.user || ownerMember;
    const u = getOrCreateTcgUser(ownerMember.id);
    const opts = {
        category: options.category || 'complet',
        perPageMode: options.perPageMode || '18',
        page: options.page || 0,
        sortMode: options.sortMode || 'number',
        fromHub: Boolean(options.fromHub)
    };

    const rendered = await renderBinderCanvas(ownerMember, u, opts);
    opts.page = rendered.safePage;

    const embed = new EmbedBuilder()
        .setColor(u.theme === 'W' ? 0xecf0f1 : 0x2c3e50)
        .setAuthor({ name: `Classeur de ${ownerMember.displayName || ownerUser.username}`, iconURL: ownerUser.displayAvatarURL({ dynamic: true }) })
        .setDescription(
            `📖 **${opts.category === 'complet' ? 'Set 1 Complet' : opts.category}** • **${rendered.ownedInView}/${rendered.totalInView}** cartes • Tri : **${opts.sortMode === 'rarity' ? 'Rareté' : 'Numéro'}**`
        )
        .setImage('attachment://regadex_classeur.png')
        .setFooter({ text: `Page ${rendered.safePage + 1}/${rendered.totalPages} • Mode ${u.theme === 'W' ? 'Clair (W)' : 'Nuit (B)'}` });

    return {
        embeds: [embed],
        files: [new AttachmentBuilder(rendered.buffer, { name: 'regadex_classeur.png' })],
        components: buildBinderComponents(ownerMember.id, viewerId, opts, rendered.totalPages)
    };
}

function buildSingleCardPayload(card, viewerId) {
    const meta = RARITY_META[card.rarity] || RARITY_META['Commune'];
    const u = getOrCreateTcgUser(viewerId);
    const qty = u.cards?.[card.id] || 0;

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
        .setFooter({ text: 'RegaDex Set 1 • Utilise !carte [numéro ou nom]' });

    const files = [];
    if (card.filePath && fs.existsSync(card.filePath)) {
        files.push(new AttachmentBuilder(card.filePath, { name: 'carte_regadex.png' }));
    }

    return { embeds: [embed], files };
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
                .setCustomId(`tcg:binder:open:${authorMember.id}:${authorMember.id}:0`)
                .setLabel('Afficher mon classeur')
                .setEmoji('📖')
                .setStyle(ButtonStyle.Primary)
        );

        if (activeTrade) {
            const partnerId = activeTrade.initiatorId === authorMember.id ? activeTrade.targetId : activeTrade.initiatorId;
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`tcg:binder:ask:${partnerId}:${authorMember.id}`)
                    .setLabel('Classeur de mon partenaire')
                    .setEmoji('🤝')
                    .setStyle(ButtonStyle.Secondary)
            );
            return replySilent(targetResponder, { embeds: [embed], components: [row] });
        }

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
        return replySilent(targetResponder, {
            content: `🔎 **${ownedMatches.length}** carte(s) possédée(s) correspondent à \`${query}\` :`,
            components: [new ActionRowBuilder().addComponents(menu)]
        });
    }

    return replySilent(
        targetResponder,
        `🔒 Aucune carte découverte dans ton RegaDex ne correspond à \`${query}\`. Tape \`!carte\` pour voir les formats.`
    );
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
            const files = fav.filePath && fs.existsSync(fav.filePath)
                ? [new AttachmentBuilder(fav.filePath, { name: 'flex_card.png' })]
                : [];
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

    tcgBridge.trackBattlePassProgress(authorMember.id, 'tcg_flex', 1);

    const meta = RARITY_META[fav.rarity] || RARITY_META['Commune'];
    const embed = new EmbedBuilder()
        .setColor(meta.color)
        .setAuthor({ name: `${authorMember.displayName} flex sa carte préférée !`, iconURL: authorMember.displayAvatarURL({ dynamic: true }) })
        .setTitle(`⭐ ${fav.id} — ${fav.name}`)
        .setImage('attachment://flex_card.png')
        .setFooter({ text: 'Modifie avec !tcg flex modify [carte]' });

    const files = fav.filePath && fs.existsSync(fav.filePath)
        ? [new AttachmentBuilder(fav.filePath, { name: 'flex_card.png' })]
        : [];
    return replySilent(targetResponder, { embeds: [embed], files });
}

function sendFlexPicker(targetResponder, member, page = 0) {
    const u = getOrCreateTcgUser(member.id);
    const owned = cardCatalog.filter(c => (u.cards?.[c.id] || 0) > 0);
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

    const rows = [new ActionRowBuilder().addComponents(menu)];
    if (totalPages > 1) {
        rows.push(new ActionRowBuilder().addComponents(
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
        ));
    }

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

    const rows = [new ActionRowBuilder().addComponents(menu)];
    if (totalPages > 1 || fromHub) {
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
        if (fromHub) {
            btnRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`tcg:claim:open:${member.id}:1`)
                    .setLabel('Inventaire')
                    .setEmoji('🎒')
                    .setStyle(ButtonStyle.Secondary),
                buildAccueilButton(member.id)
            );
        }
        rows.push(btnRow);
    }

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

function formatOfferLines(offerIds) {
    if (!offerIds || offerIds.length === 0) return '*Aucune carte sélectionnée*';
    const counts = {};
    for (const id of offerIds) counts[id] = (counts[id] || 0) + 1;
    return Object.entries(counts).map(([id, q]) => {
        const c = cardById.get(id);
        const meta = c ? (RARITY_META[c.rarity] || RARITY_META['Commune']) : { emoji: '🃏' };
        return `${meta.emoji} \`${id}\` **${c ? c.name : id}**${q > 1 ? ` ×${q}` : ''}`;
    }).join('\n');
}

function buildTradeThreadPayload(trade) {
    const lockA = trade.lockedOffers[trade.initiatorId] ? '✅ Validée' : '⏳ En modification';
    const lockB = trade.lockedOffers[trade.targetId] ? '✅ Validée' : '⏳ En modification';

    const embed = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle('🔄 Table d\'échange RegaDex')
        .setDescription(
            `Règles : **3 cartes max** par personne • **Doublons uniquement** (\`≥ 2\` copies possédées) • Aucun point RegaDex.\n` +
            `-# Toute modification déverrouille automatiquement la validation des deux joueurs.\n\n` +
            `**Offre de <@${trade.initiatorId}>** (${lockA} • ${trade.offers[trade.initiatorId].length}/3) :\n` +
            `${formatOfferLines(trade.offers[trade.initiatorId])}\n\n` +
            `**Offre de <@${trade.targetId}>** (${lockB} • ${trade.offers[trade.targetId].length}/3) :\n` +
            `${formatOfferLines(trade.offers[trade.targetId])}`
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
        return (owned - already) >= 2;
    });
}

async function refreshTradePanel(thread, trade) {
    if (!trade.statusMessageId) return;
    const msg = await thread.messages.fetch(trade.statusMessageId).catch(() => null);
    if (!msg) return;
    await msg.edit(buildTradeThreadPayload(trade)).catch(() => {});
}

async function executeTradeIfBothLocked(thread, trade, client) {
    const idA = trade.initiatorId;
    const idB = trade.targetId;
    if (!trade.lockedOffers[idA] || !trade.lockedOffers[idB]) return false;

    const offerA = trade.offers[idA] || [];
    const offerB = trade.offers[idB] || [];
    if (offerA.length === 0 && offerB.length === 0) {
        trade.lockedOffers[idA] = false;
        trade.lockedOffers[idB] = false;
        await refreshTradePanel(thread, trade);
        await sendSilent(thread, "⚠️ Impossible de valider un échange vide !").catch(() => {});
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
        if ((uA.cards[cid] || 0) - q < 1) {
            trade.lockedOffers[idA] = false;
            trade.lockedOffers[idB] = false;
            await refreshTradePanel(thread, trade);
            await sendSilent(thread, `❌ <@${idA}> n'a plus assez de doublons pour \`${cid}\`. Validation annulée.`).catch(() => {});
            return false;
        }
    }
    for (const [cid, q] of Object.entries(needB)) {
        if ((uB.cards[cid] || 0) - q < 1) {
            trade.lockedOffers[idA] = false;
            trade.lockedOffers[idB] = false;
            await refreshTradePanel(thread, trade);
            await sendSilent(thread, `❌ <@${idB}> n'a plus assez de doublons pour \`${cid}\`. Validation annulée.`).catch(() => {});
            return false;
        }
    }

    // Transfert atomique
    for (const [cid, q] of Object.entries(needA)) {
        uA.cards[cid] -= q;
        uB.cards[cid] = (uB.cards[cid] || 0) + q;
    }
    for (const [cid, q] of Object.entries(needB)) {
        uB.cards[cid] -= q;
        uA.cards[cid] = (uA.cards[cid] || 0) + q;
    }

    uA.stats.tradesCompleted = (uA.stats.tradesCompleted || 0) + 1;
    uB.stats.tradesCompleted = (uB.stats.tradesCompleted || 0) + 1;
    trade.tradeCount = (trade.tradeCount || 0) + 1;
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
        .setImage('attachment://trade_recap.png')
        .setFooter({ text: `Effectué le ${dateStr}` });

    await sendSilent(thread, {
        embeds: [recapEmbed],
        files: [new AttachmentBuilder(recapBuffer, { name: 'trade_recap.png' })]
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
            .setImage('attachment://trade_recap_log.png')
            .setTimestamp();

        await sendSilent(logChan, {
            embeds: [logEmbed],
            files: [new AttachmentBuilder(recapBuffer, { name: 'trade_recap_log.png' })]
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
            if (thread) await thread.delete().catch(() => {});
            delete data.activeTrades[threadId];
            changed = true;
        }
    }

    if (changed) tcgBridge.demanderSauvegarde();
}

// ==========================================
//   COMMANDES ADMIN (EPSYS-ONLY)
// ==========================================

async function handleAdminTcgCommand(message, lowerContent) {
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

    return false;
}

// ==========================================
//   PARSEUR COMMANDES PRÉFIXE (AVEC OU SANS ESPACE)
// ==========================================

function parseTcgCommand(content) {
    const trimmed = (content || '').trim();
    if (!trimmed.startsWith('!')) return null;

    let m = trimmed.match(/^!(?:regadex|rgdx|tcg)\s*(flexmodify|flex|open|store|claim|classeur|collection|carte|trade|top|notif|credits|guide)?(?:\s+(.*))?$/i);
    if (m) {
        let sub = (m[1] || 'hub').toLowerCase();
        let rest = (m[2] || '').trim();
        if (sub === 'flexmodify') {
            sub = 'flex';
            rest = `modify ${rest}`.trim();
        }
        if (sub === 'collection') sub = 'classeur';
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

    return null;
}

async function handleTcgMessage(message) {
    if (!message.guild || message.guild.id !== GUILD_ID) return false;
    const raw = message.content.trim();
    if (!raw.startsWith('!')) return false;

    if (await handleAdminTcgCommand(message, raw.toLowerCase())) return true;

    const parsed = parseTcgCommand(raw);
    if (!parsed) return false;

    if (!hasTcgRole(message.member)) {
        await replySilent(message, `🔒 Le **RegaDex TCG** est réservé aux membres ayant le rôle <@&${TCG_ROLE_ID}> !`).catch(() => {});
        return true;
    }

    if (parsed.sub !== 'flex' && !isAllowedTcgChannel(message.channel)) {
        await replySilent(
            message,
            `🃏 Pour jouer au **RegaDex**, rendez-vous dans <#${TCG_CHANNEL_ID}> ! *(Seule la commande \`!tcg flex\` / \`!regadex flex\` est autorisée partout.)*`
        ).catch(() => {});
        return true;
    }

    const u = getOrCreateTcgUser(message.author.id);

    if (parsed.sub === 'hub') {
        await replySilent(message, buildHubPayload(message.member, u));
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
        await interaction.reply({ content: `🔒 Le **RegaDex TCG** est réservé aux membres ayant le rôle <@&${TCG_ROLE_ID}> !`, ephemeral: true });
        return true;
    }

    if (sub !== 'flex' && !isAllowedTcgChannel(interaction.channel)) {
        await interaction.reply({ content: `🃏 Pour jouer au **RegaDex**, rendez-vous dans <#${TCG_CHANNEL_ID}> ! *(Seule la sous-commande \`/regadex flex\` est autorisée partout.)*`, ephemeral: true });
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

    // ----- RETOUR ACCUEIL HUB -----
    if (action === 'hub' && interaction.isButton()) {
        const ownerId = parts[2];
        if (interaction.user.id !== ownerId) {
            await interaction.reply({ content: "Ce menu ne t'est pas destiné !", ephemeral: true });
            return true;
        }
        await interaction.deferUpdate();
        const u = getOrCreateTcgUser(ownerId);
        await interaction.editReply({
            content: null,
            ...buildHubPayload(interaction.member, u),
            attachments: []
        });
        return true;
    }

    // ----- GUIDE -----
    if (action === 'guide' && interaction.isButton()) {
        const ownerId = parts[2];
        const fromHub = parts[3] === '1';
        if (interaction.user.id !== ownerId) {
            await interaction.reply({ content: "Pas pour toi 😌", ephemeral: true });
            return true;
        }
        const payload = buildGuidePayload(ownerId, fromHub);
        if (fromHub) {
            await interaction.update({ content: null, files: [], attachments: [], ...payload });
        } else {
            await replySilent(interaction, payload);
        }
        return true;
    }

    // ----- CRÉDITS -----
    if (action === 'credits' && interaction.isButton()) {
        const ownerId = parts[2];
        const fromHub = parts[3] === '1';
        if (interaction.user.id !== ownerId) {
            await interaction.reply({ content: "Pas pour toi 😌", ephemeral: true });
            return true;
        }
        const payload = buildCreditsPayload(ownerId, fromHub);
        if (fromHub) {
            await interaction.update({ content: null, files: [], attachments: [], ...payload });
        } else {
            await replySilent(interaction, payload);
        }
        return true;
    }

    // ----- OUVERTURE DE BOOSTER -----
    if (action === 'open' && interaction.isButton()) {
        const ownerId = parts[2];
        const fromHub = parts[3] === '1';
        if (interaction.user.id !== ownerId) {
            await interaction.reply({ content: "Ce bouton ne t'est pas destiné !", ephemeral: true });
            return true;
        }
        await startBoosterOpening(interaction, interaction.member, client, fromHub);
        return true;
    }

    // ----- NAVIGATION DANS LE BOOSTER -----
    if (action === 'bstep' && interaction.isButton()) {
        const dir = parts[2];
        const ownerId = parts[3];
        if (interaction.user.id !== ownerId) {
            await interaction.reply({ content: "Ce booster ne t'appartient pas !", ephemeral: true });
            return true;
        }
        const session = boosterSessions.get(interaction.message.id);
        if (!session) {
            await interaction.reply({ content: "⏳ Session d'ouverture expirée.", ephemeral: true });
            return true;
        }
        if (dir === 'next') session.step = Math.min(2, session.step + 1);
        else if (dir === 'prev') session.step = Math.max(0, session.step - 1);
        else if (dir === 'back3') session.step = 2;
        else if (dir === 'recap') session.step = 3;

        await interaction.deferUpdate();
        if (session.step === 3) {
            const recapPayload = await buildBoosterRecapPayload(interaction.member, session);
            await interaction.editReply({ content: null, ...recapPayload, attachments: [] });
        } else {
            const cardPayload = buildBoosterCardEmbed(interaction.member, session, session.step);
            await interaction.editReply({ content: null, ...cardPayload, attachments: [] });
        }
        return true;
    }

    // ----- NOTIFICATIONS BOOSTER -----
    if (action === 'notif' && interaction.isButton()) {
        const sub = parts[2];
        const ownerId = parts[3];
        const fromHub = parts[4] === '1';
        if (interaction.user.id !== ownerId) {
            await interaction.reply({ content: "Pas pour toi 😌", ephemeral: true });
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
                    ...buildNotifMenuPayload(interaction.member, u, true)
                });
                return true;
            }
            if (!nextTs) {
                await interaction.reply({ content: "✅ Tu as déjà des boosters prêts !", ephemeral: true });
                return true;
            }
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`tcg:notif:here:${ownerId}`).setLabel('Me prévenir ici').setEmoji('🔔').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`tcg:notif:dm:${ownerId}`).setLabel('Me prévenir en MP').setEmoji('📩').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`tcg:notif:off:${ownerId}`).setLabel('Désactiver').setEmoji('🔕').setStyle(ButtonStyle.Danger)
            );
            await interaction.reply({ content: `🔔 Prochain booster gratuit <t:${Math.floor(nextTs / 1000)}:R> :`, components: [row], ephemeral: true });
            return true;
        }

        if (sub === 'off') {
            if (notifTimers.has(ownerId)) {
                clearTimeout(notifTimers.get(ownerId));
                notifTimers.delete(ownerId);
            }
            delete data.notifs[ownerId];
            tcgBridge.demanderSauvegarde();
            if (fromHub) {
                await interaction.update({
                    content: null,
                    files: [],
                    attachments: [],
                    ...buildNotifMenuPayload(interaction.member, u, true, '🔕 *Notification booster désactivée.*')
                });
                return true;
            }
            await interaction.reply({ content: "🔕 Notification booster désactivée.", ephemeral: true });
            return true;
        }

        if (!nextTs) {
            if (fromHub) {
                await interaction.update({
                    content: null,
                    files: [],
                    attachments: [],
                    ...buildNotifMenuPayload(interaction.member, u, true, '✅ *Ta jauge de boosters gratuits est déjà pleine (`2/2`) !*')
                });
                return true;
            }
            await interaction.reply({ content: "✅ Ta jauge de boosters gratuits est déjà pleine (`2/2`) !", ephemeral: true });
            return true;
        }

        data.notifs[ownerId] = {
            mode: sub === 'dm' ? 'dm' : 'channel',
            channelId: interaction.channelId,
            notifyAt: nextTs
        };
        armerNotifBooster(ownerId, client);
        tcgBridge.demanderSauvegarde();

        if (fromHub) {
            await interaction.update({
                content: null,
                files: [],
                attachments: [],
                ...buildNotifMenuPayload(
                    interaction.member,
                    u,
                    true,
                    `✅ *C'est noté ! Je te préviendrai **${sub === 'dm' ? 'en MP' : 'dans ce salon'}** <t:${Math.floor(nextTs / 1000)}:R>.*`
                )
            });
            return true;
        }

        await interaction.reply({
            content: `🔔 C'est noté ! Je te préviendrai **${sub === 'dm' ? 'en MP' : 'dans ce salon'}** <t:${Math.floor(nextTs / 1000)}:R>.`,
            ephemeral: true
        });
        await disableNotifButtonsOnMessage(interaction.message);
        return true;
    }

    // ----- THÈME HUB -----
    if (action === 'theme' && interaction.isButton()) {
        const ownerId = parts[2];
        if (interaction.user.id !== ownerId) {
            await interaction.reply({ content: "Ce bouton ne t'est pas destiné !", ephemeral: true });
            return true;
        }
        const u = getOrCreateTcgUser(ownerId);
        u.theme = u.theme === 'W' ? 'B' : 'W';
        tcgBridge.demanderSauvegarde();
        await interaction.update({ embeds: [buildHubEmbed(interaction.member, u)], components: buildHubComponents(ownerId, u) });
        return true;
    }

    // ----- STORE & ACHATS & CLAIM -----
    if (action === 'store' && interaction.isButton()) {
        const ownerId = parts[3];
        const fromHub = parts[4] === '1';
        if (interaction.user.id !== ownerId) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true }), true;
        const u = getOrCreateTcgUser(ownerId);
        const payload = buildStorePayload(interaction.member, u, fromHub);
        if (fromHub) {
            await interaction.update({ content: null, files: [], attachments: [], ...payload });
        } else {
            await replySilent(interaction, payload);
        }
        return true;
    }

    if (action === 'claim' && interaction.isButton()) {
        const ownerId = parts[3];
        const fromHub = parts[4] === '1';
        if (interaction.user.id !== ownerId) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true }), true;
        const u = getOrCreateTcgUser(ownerId);
        const payload = buildClaimPayload(interaction.member, u, fromHub);
        if (fromHub) {
            await interaction.update({ content: null, files: [], attachments: [], ...payload });
        } else {
            await replySilent(interaction, payload);
        }
        return true;
    }

    if (action === 'buy' && interaction.isButton()) {
        const itemKey = parts[2];
        const ownerId = parts[3];
        const fromHub = parts[4] === '1';
        const hubSuffix = fromHub ? ':1' : '';
        if (interaction.user.id !== ownerId) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true }), true;

        const price = STORE_PRICES[itemKey];
        const u = getOrCreateTcgUser(ownerId);
        if (!price || u.points < price) {
            await interaction.reply({ content: "❌ Tu n'as pas assez de points RegaDex !", ephemeral: true });
            return true;
        }

        u.points -= price;
        u.inventory[itemKey] = (u.inventory[itemKey] || 0) + 1;

        if (itemKey !== 'booster') {
            tcgBridge.trackBattlePassProgress(ownerId, 'tcg_store_buy', 1);
        }
        tcgBridge.demanderSauvegarde();

        const labels = {
            booster: '🎁 Booster Set 1',
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
                .setLabel(itemKey === 'booster' ? 'Ouvrir maintenant' : 'Utiliser / Activer maintenant')
                .setEmoji('⚡')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`tcg:postbuy:keep:${itemKey}:${ownerId}${hubSuffix}`)
                .setLabel('Garder en inventaire')
                .setEmoji('🎒')
                .setStyle(ButtonStyle.Secondary)
        );
        if (fromHub) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`tcg:store:open:${ownerId}:1`)
                    .setLabel('Store')
                    .setEmoji('🛒')
                    .setStyle(ButtonStyle.Secondary),
                buildAccueilButton(ownerId)
            );
        }

        if (fromHub) {
            await interaction.update({ content: null, embeds: [confirmEmbed], components: [row], files: [], attachments: [] });
        } else {
            await replySilent(interaction, { embeds: [confirmEmbed], components: [row] });
        }
        return true;
    }

    if (action === 'postbuy' && interaction.isButton()) {
        const sub = parts[2];
        const itemKey = parts[3];
        const ownerId = parts[4];
        const fromHub = parts[5] === '1';
        if (interaction.user.id !== ownerId) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true }), true;

        const backRows = fromHub
            ? [new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`tcg:store:open:${ownerId}:1`).setLabel('Retour Store').setEmoji('🛒').setStyle(ButtonStyle.Secondary),
                buildAccueilButton(ownerId)
            )]
            : [];

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
            if (!fromHub) await interaction.message.edit({ components: [] }).catch(() => {});
            await startBoosterOpening(interaction, interaction.member, client, fromHub);
            return true;
        }
        if (itemKey === 'luckyBooster') {
            if (u.activeBonuses.luckyBooster) {
                await interaction.reply({ content: "⚠️ Tu as déjà un bonus **Chanceux** actif pour ton prochain booster !", ephemeral: true });
                return true;
            }
            u.inventory.luckyBooster -= 1;
            u.activeBonuses.luckyBooster = true;
            tcgBridge.demanderSauvegarde();
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
            tcgBridge.demanderSauvegarde();
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
            await sendHoloTransformPicker(interaction, interaction.member, 0, fromHub);
            return true;
        }
    }

    if (action === 'use' && interaction.isButton()) {
        const itemKey = parts[2];
        const ownerId = parts[3];
        const fromHub = parts[4] === '1';
        if (interaction.user.id !== ownerId) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true }), true;
        const u = getOrCreateTcgUser(ownerId);
        if ((u.inventory[itemKey] || 0) <= 0) return interaction.reply({ content: "❌ Stock insuffisant.", ephemeral: true }), true;

        if (itemKey === 'luckyBooster') {
            if (u.activeBonuses.luckyBooster) return interaction.reply({ content: "⚠️ Déjà actif sur ton prochain booster !", ephemeral: true }), true;
            u.inventory.luckyBooster -= 1;
            u.activeBonuses.luckyBooster = true;
            tcgBridge.demanderSauvegarde();
            await interaction.update(buildClaimPayload(interaction.member, u, fromHub));
            await interaction.followUp({ content: "🍀 **Prochain booster chanceux activé !**", ephemeral: true });
            return true;
        }
        if (itemKey === 'halfCooldown') {
            if (u.activeBonuses.halfCooldown) return interaction.reply({ content: "⚠️ Déjà armé sur ton prochain booster !", ephemeral: true }), true;
            u.inventory.halfCooldown -= 1;
            u.activeBonuses.halfCooldown = true;
            tcgBridge.demanderSauvegarde();
            await interaction.update(buildClaimPayload(interaction.member, u, fromHub));
            await interaction.followUp({ content: "⚡ **Demi-cooldown armé !**", ephemeral: true });
            return true;
        }
        if (itemKey === 'holoTransform') {
            await sendHoloTransformPicker(interaction, interaction.member, 0, fromHub);
            return true;
        }
    }

    if (action === 'holopage' && interaction.isButton()) {
        const ownerId = parts[2];
        const page = parseInt(parts[3], 10) || 0;
        const fromHub = parts[4] === '1';
        if (interaction.user.id !== ownerId) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true }), true;
        await sendHoloTransformPicker(interaction, interaction.member, page, fromHub);
        return true;
    }

    if (action === 'holopick' && interaction.isStringSelectMenu()) {
        const ownerId = parts[2];
        const fromHub = parts[3] === '1';
        if (interaction.user.id !== ownerId) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true }), true;

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
        tcgBridge.demanderSauvegarde();

        const embed = new EmbedBuilder()
            .setColor(RARITY_META[holoCard.rarity]?.color || 0xf1c40f)
            .setTitle('✨ Transformation Holographique réussie !')
            .setDescription(`Ta carte **${baseCard.id} • ${baseCard.name}** a évolué en **${holoCard.id} • ${holoCard.name}** !`)
            .setImage('attachment://holo_result.png');

        const files = holoCard.filePath && fs.existsSync(holoCard.filePath)
            ? [new AttachmentBuilder(holoCard.filePath, { name: 'holo_result.png' })]
            : [];
        const resultRows = fromHub
            ? [new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`tcg:claim:open:${ownerId}:1`).setLabel('Inventaire').setEmoji('🎒').setStyle(ButtonStyle.Secondary),
                buildAccueilButton(ownerId)
            )]
            : [];

        await interaction.deferUpdate();
        await interaction.editReply({ content: null, embeds: [embed], files, attachments: [], components: resultRows });
        return true;
    }

    // ----- CLASSEUR (NAVIGATION, FILTRE, TRI, PERMISSION) -----
    if (action === 'binder') {
        const sub = parts[2];

        if (sub === 'pickuser' && interaction.isUserSelectMenu()) {
            const viewerId = parts[3];
            if (interaction.user.id !== viewerId) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true }), true;
            const targetId = interaction.values[0];
            if (targetId === viewerId) {
                await deferReplySilent(interaction);
                const payload = await buildBinderReplyPayload(interaction.member, viewerId, { fromHub: false });
                await interaction.editReply(payload);
                return true;
            }
            const targetMember = await interaction.guild.members.fetch(targetId).catch(() => ({ id: targetId, displayName: 'ce membre' }));
            await sendBinderAccessWarning(interaction, viewerId, targetMember);
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
            if (interaction.user.id !== viewerId) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true }), true;

            if (fromHub) {
                await interaction.deferUpdate();
                const ownerMember = await interaction.guild.members.fetch(ownerId).catch(() => interaction.member);
                const payload = await buildBinderReplyPayload(ownerMember, viewerId, { fromHub: true });
                await interaction.editReply({ content: null, ...payload, attachments: [] });
            } else {
                await deferReplySilent(interaction);
                const ownerMember = await interaction.guild.members.fetch(ownerId).catch(() => interaction.member);
                const payload = await buildBinderReplyPayload(ownerMember, viewerId, { fromHub: false });
                await interaction.editReply(payload);
            }
            return true;
        }
    }

    if ((action === 'bcat' || action === 'bsize' || action === 'bnav' || action === 'bsort' || action === 'btheme')) {
        let ownerId, viewerId, category, perPageMode, page, sortMode, fromHub;

        if (action === 'bcat' && interaction.isStringSelectMenu()) {
            ownerId = parts[2];
            viewerId = parts[3];
            perPageMode = parts[4];
            sortMode = parts[5];
            fromHub = parts[6] === '1';
            category = interaction.values[0];
            page = 0;
        } else if (action === 'bsize' && interaction.isStringSelectMenu()) {
            ownerId = parts[2];
            viewerId = parts[3];
            category = parts[4];
            sortMode = parts[5];
            fromHub = parts[6] === '1';
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
            fromHub = parts[9] === '1';
            if (dir === 'first') page = 0;
            else if (dir === 'prev') page = Math.max(0, page - 1);
            else if (dir === 'next') page = page + 1;
            else if (dir === 'last') page = 999999;
        } else if (action === 'bsort' && interaction.isButton()) {
            ownerId = parts[2];
            viewerId = parts[3];
            category = parts[4];
            perPageMode = parts[5];
            page = 0;
            sortMode = parts[7];
            fromHub = parts[8] === '1';
        } else if (action === 'btheme' && interaction.isButton()) {
            ownerId = parts[2];
            viewerId = parts[3];
            category = parts[4];
            perPageMode = parts[5];
            page = parseInt(parts[6], 10) || 0;
            sortMode = parts[7];
            fromHub = parts[8] === '1';
            if (interaction.user.id !== ownerId) {
                await interaction.reply({ content: "❌ Seul le propriétaire du classeur peut changer son thème Clair/Nuit.", ephemeral: true });
                return true;
            }
            const uOwner = getOrCreateTcgUser(ownerId);
            uOwner.theme = uOwner.theme === 'W' ? 'B' : 'W';
            tcgBridge.demanderSauvegarde();
        } else {
            return false;
        }

        if (interaction.user.id !== viewerId && interaction.user.id !== ownerId) {
            await interaction.reply({ content: "Ce classeur ne t'est pas ouvert !", ephemeral: true });
            return true;
        }

        await interaction.deferUpdate();
        const ownerMember = await interaction.guild.members.fetch(ownerId).catch(() => interaction.member);
        const payload = await buildBinderReplyPayload(ownerMember, viewerId, { category, perPageMode, page, sortMode, fromHub });
        await interaction.editReply({ content: null, ...payload, attachments: [] });
        return true;
    }

    // ----- SÉLECTION CARTE (!carte) & FLEX -----
    if (action === 'cartesel' && interaction.isStringSelectMenu()) {
        const ownerId = parts[2];
        if (interaction.user.id !== ownerId) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true }), true;
        const card = cardById.get(interaction.values[0]);
        const u = getOrCreateTcgUser(ownerId);
        if (!card || (u.cards?.[card.id] || 0) <= 0) {
            await interaction.reply({ content: "🔒 Tu ne possèdes pas cette carte dans ton RegaDex !", ephemeral: true });
            return true;
        }
        await interaction.deferUpdate();
        await interaction.editReply({ content: null, ...buildSingleCardPayload(card, ownerId), components: [], attachments: [] });
        return true;
    }

    if (action === 'flexpage' && interaction.isButton()) {
        const ownerId = parts[2];
        const page = parseInt(parts[3], 10) || 0;
        if (interaction.user.id !== ownerId) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true }), true;
        await sendFlexPicker(interaction, interaction.member, page);
        return true;
    }

    if (action === 'flexset' && interaction.isStringSelectMenu()) {
        const ownerId = parts[2];
        if (interaction.user.id !== ownerId) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true }), true;
        const card = cardById.get(interaction.values[0]);
        const u = getOrCreateTcgUser(ownerId);
        if (!card || (u.cards[card.id] || 0) <= 0) {
            await interaction.reply({ content: "❌ Tu ne possèdes pas cette carte.", ephemeral: true });
            return true;
        }
        u.favoriteCardId = card.id;
        tcgBridge.demanderSauvegarde();
        await interaction.update({ content: `⭐ Ta carte préférée est maintenant **${card.id} • ${card.name}** ! Tape \`!tcg flex\` pour frimer !`, embeds: [], components: [], files: [], attachments: [] });
        return true;
    }

    // ----- CLASSEMENTS (!regadex top / Hub) -----
    if (action === 'top' && interaction.isButton()) {
        const mode = parts[2];
        const ownerId = parts[3];
        const fromHub = parts[4] === '1';
        if (interaction.user.id !== ownerId) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true }), true;
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
            tcgBridge.demanderSauvegarde();
            await interaction.update(buildTradeThreadPayload(trade));
            await executeTradeIfBothLocked(thread, trade, client);
            return true;
        }

        if (sub === 'add' && interaction.isButton()) {
            if (trade.offers[uid].length >= 3) {
                await interaction.reply({ content: "⚠️ Tu as déjà mis **3 cartes** (maximum par échange).", ephemeral: true });
                return true;
            }
            const tradables = getTradableDuplicates(uid, trade.offers[uid]);
            if (tradables.length === 0) {
                await interaction.reply({ content: "❌ Tu n'as aucun doublon disponible (`≥ 2` exemplaires) à ajouter.", ephemeral: true });
                return true;
            }
            const page = parseInt(parts[4] || '0', 10);
            const totalPages = Math.max(1, Math.ceil(tradables.length / 25));
            const safePage = Math.max(0, Math.min(page, totalPages - 1));
            const slice = tradables.slice(safePage * 25, (safePage + 1) * 25);

            const u = getOrCreateTcgUser(uid);
            const menu = new StringSelectMenuBuilder()
                .setCustomId(`tcg:tr:addsel:${threadId}`)
                .setPlaceholder(`Choisir un doublon à ajouter (Page ${safePage + 1}/${totalPages})...`)
                .addOptions(slice.map(c => ({
                    label: `${c.id} • ${c.name}`.slice(0, 100),
                    description: `${c.rarity} • Possédées : x${u.cards[c.id]}`,
                    value: c.id
                })));

            const rows = [new ActionRowBuilder().addComponents(menu)];
            if (totalPages > 1) {
                rows.push(new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`tcg:tr:addpage:${threadId}:${safePage - 1}`).setLabel('◀️').setStyle(ButtonStyle.Secondary).setDisabled(safePage <= 0),
                    new ButtonBuilder().setCustomId(`tcg:tr:addpage:${threadId}:${safePage + 1}`).setLabel('▶️').setStyle(ButtonStyle.Secondary).setDisabled(safePage >= totalPages - 1)
                ));
            }
            await interaction.reply({ content: '➕ Choisis une carte en doublon à ajouter à ton offre :', components: rows, ephemeral: true });
            return true;
        }

        if (sub === 'addpage' && interaction.isButton()) {
            const page = parseInt(parts[4] || '0', 10);
            const tradables = getTradableDuplicates(uid, trade.offers[uid]);
            const totalPages = Math.max(1, Math.ceil(tradables.length / 25));
            const safePage = Math.max(0, Math.min(page, totalPages - 1));
            const slice = tradables.slice(safePage * 25, (safePage + 1) * 25);
            const u = getOrCreateTcgUser(uid);

            const menu = new StringSelectMenuBuilder()
                .setCustomId(`tcg:tr:addsel:${threadId}`)
                .setPlaceholder(`Choisir un doublon (Page ${safePage + 1}/${totalPages})...`)
                .addOptions(slice.map(c => ({
                    label: `${c.id} • ${c.name}`.slice(0, 100),
                    description: `${c.rarity} • Possédées : x${u.cards[c.id]}`,
                    value: c.id
                })));
            const rows = [new ActionRowBuilder().addComponents(menu)];
            if (totalPages > 1) {
                rows.push(new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`tcg:tr:addpage:${threadId}:${safePage - 1}`).setLabel('◀️').setStyle(ButtonStyle.Secondary).setDisabled(safePage <= 0),
                    new ButtonBuilder().setCustomId(`tcg:tr:addpage:${threadId}:${safePage + 1}`).setLabel('▶️').setStyle(ButtonStyle.Secondary).setDisabled(safePage >= totalPages - 1)
                ));
            }
            await interaction.update({ components: rows });
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
            if ((u.cards[cardId] || 0) - already < 2) {
                await interaction.reply({ content: "❌ Tu n'as plus de doublon disponible pour cette carte.", ephemeral: true });
                return true;
            }
            trade.offers[uid].push(cardId);
            trade.lockedOffers[trade.initiatorId] = false;
            trade.lockedOffers[trade.targetId] = false;
            tcgBridge.demanderSauvegarde();

            await refreshTradePanel(thread, trade);
            await interaction.update({ content: `✅ **${cardId}** ajoutée à ton offre !`, components: [] });
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
            tcgBridge.demanderSauvegarde();

            await refreshTradePanel(thread, trade);
            await interaction.update({ content: `🗑️ **${removed}** retirée de ton offre.`, components: [] });
            return true;
        }

        if (sub === 'search' && interaction.isButton()) {
            const modal = new ModalBuilder()
                .setCustomId(`tcg:tr:modal:${threadId}`)
                .setTitle('Ajouter un doublon par nom ou numéro');
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
                if ((u.cards[res.card.id] || 0) - already < 2) {
                    await interaction.reply({ content: `❌ Tu ne possèdes pas cette carte en doublon disponible.`, ephemeral: true });
                    return true;
                }
                trade.offers[uid].push(res.card.id);
                trade.lockedOffers[trade.initiatorId] = false;
                trade.lockedOffers[trade.targetId] = false;
                tcgBridge.demanderSauvegarde();
                await refreshTradePanel(thread, trade);
                await interaction.reply({ content: `✅ **${res.card.id} • ${res.card.name}** ajoutée à ton offre !`, ephemeral: true });
                return true;
            }

            const tradableMatches = res.matches.filter(c => {
                const already = trade.offers[uid].filter(id => id === c.id).length;
                return (u.cards[c.id] || 0) - already >= 2;
            });
            if (tradableMatches.length === 0) {
                await interaction.reply({ content: `❌ Aucun doublon disponible trouvé pour \`${query}\`.`, ephemeral: true });
                return true;
            }

            const menu = new StringSelectMenuBuilder()
                .setCustomId(`tcg:tr:addsel:${threadId}`)
                .setPlaceholder('Plusieurs doublons trouvés...')
                .addOptions(tradableMatches.slice(0, 25).map(c => ({
                    label: `${c.id} • ${c.name}`.slice(0, 100),
                    description: `${c.rarity} • Possédées : x${u.cards[c.id]}`,
                    value: c.id
                })));
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

    return false;
}

module.exports = {
    TCG_ROLE_ID,
    TCG_CHANNEL_ID,
    TCG_TEST_CHANNEL_ID,
    TCG_TRADE_LOG_CHANNEL_ID,
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