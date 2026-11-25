/**
 * Module Sécurité & Modération pour Cacabot
 * Anti-phishing, Anti-spam, Anti-raid, Slowmode d'urgence, Chut/Stop, Rôles Réactions
 */

const fs = require('fs');
const path = require('path');
const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    PermissionFlagsBits,
    UserSelectMenuBuilder,
    StringSelectMenuBuilder,
    AttachmentBuilder,
    MessageFlags
} = require('discord.js');

const MOD_CHANNEL_ID = '1555402748193669192';
const MODO_ROLE_ID = '720081311716606004';
const BANTEMP_AUTHORIZED_CHANNELS = ['720082701192921231', '1555402748193669192'];
const ROLE_TRIBUNAL_ID = '1569002165836451890';
const CATEGORIE_MODERATION_ID = '1555402058532659360';

// Trackers pour les sessions de configuration !tribunal et les salons actifs
const bantempSessions = new Map();
const tribunalSavedRoles = new Map();
const tribunalActiveCases = new Map(); // targetId => { channelId, targetTag, raison, modoId, modoTag, openedAt }

// Trackers pour la modération directe (!bannir, !kick, !mute, !lock, !warn)
const banSessions = new Map();
const kickSessions = new Map();
const muteSessions = new Map();
const channelLocks = new Map();
const destiSessions = new Map();

const DESTITUTION_DURATION_MS = 48 * 60 * 60 * 1000; // 48 heures
const DESTITUTION_MIN_VOTES = 4; // Quorum minimum de 4 votes

const WARN_REMINDER_AGE_MS = 60 * 24 * 60 * 60 * 1000; // 60 jours
const WARN_STEPS_DESC = [
    '1️⃣ **Warn 1 :** Avertissement officiel + MP',
    '2️⃣ **Warn 2 :** Mute automatique **30 min**',
    '3️⃣ **Warn 3 :** Mute automatique **6 heures**',
    '4️⃣ **Warn 4 :** Mute automatique **24 heures**',
    '5️⃣ **Warn 5 :** Alerte interactive staff (décision du modo)',
    '6️⃣ **Warn 6 :** Bannissement définitif automatique'
];

// --- GESTIONNAIRE D'ARCHIVES JUDICIAIRES (.TXT & JSON) ---
const ARCHIVES_DIR = path.join(__dirname, 'data', 'archives_tribunaux');
const ARCHIVES_INDEX_FILE = path.join(__dirname, 'data', 'archives_tribunaux.json');
const ITEMS_PER_PAGE = 10;

try {
    if (!fs.existsSync(ARCHIVES_DIR)) {
        fs.mkdirSync(ARCHIVES_DIR, { recursive: true });
    }
} catch (e) {
    console.warn('[Archives] Impossible de créer le dossier data/archives_tribunaux:', e);
}

function chargerArchives() {
    try {
        if (fs.existsSync(ARCHIVES_INDEX_FILE)) {
            const raw = fs.readFileSync(ARCHIVES_INDEX_FILE, 'utf-8');
            return JSON.parse(raw);
        }
    } catch (e) {
        console.warn('[Archives] Erreur lecture archives_tribunaux.json:', e);
    }
    return [];
}

function sauvegarderArchives(liste) {
    try {
        const dir = path.dirname(ARCHIVES_INDEX_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(ARCHIVES_INDEX_FILE, JSON.stringify(liste, null, 2), 'utf-8');
    } catch (e) {
        console.error('[Archives] Erreur sauvegarde archives_tribunaux.json:', e);
    }
}

// Génération de la retranscription .txt et archivage
async function genererEtSauvegarderTranscript({
    channel,
    targetId,
    targetTag,
    decision,
    verdictEmoji,
    modoUser,
    guild
}) {
    if (!channel || !channel.isTextBased()) return null;

    let messages = [];
    try {
        const fetched = await channel.messages.fetch({ limit: 100 });
        messages = Array.from(fetched.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    } catch (e) {
        console.warn('[Transcript] Erreur récupération messages:', e);
    }

    const caseInfo = tribunalActiveCases.get(targetId) || {};
    const finalTargetTag = targetTag || caseInfo.targetTag || 'Membre';
    const initialRaison = caseInfo.raison || 'Non spécifiée';
    const dateNow = new Date();
    const dateStr = dateNow.toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
    const fileTimestamp = dateNow.toISOString().replace(/[:.]/g, '-').slice(0, 19);

    const archives = chargerArchives();
    const dossierNum = archives.length + 1;
    const safeTag = finalTargetTag.toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 15) || 'membre';
    const fileName = `dossier_${dossierNum}_${safeTag}_${fileTimestamp}.txt`;
    const filePath = path.join(ARCHIVES_DIR, fileName);

    let content = `================================================================================\n`;
    content += `                    🏛️ ARCHIVES DU TRIBUNAL DE REGAÏA\n`;
    content += `                             DOSSIER N°${dossierNum}\n`;
    content += `================================================================================\n\n`;
    content += `• Salon archivé : #${channel.name} (${channel.id})\n`;
    content += `• Accusé(e)     : ${finalTargetTag} (ID: ${targetId})\n`;
    content += `• Motif initial : ${initialRaison}\n`;
    content += `• Date clôture  : ${dateStr}\n`;
    content += `• Décision      : ${decision}\n`;
    content += `• Modérateur    : ${modoUser?.tag || 'Inconnu'} (ID: ${modoUser?.id || 'N/A'})\n`;
    content += `• Messages      : ${messages.length}\n`;
    content += `\n--------------------------- RETRANSCRIPTION COMPLÈTE ---------------------------\n\n`;

    for (const msg of messages) {
        const time = new Date(msg.createdTimestamp).toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris' });
        const authorTag = msg.author?.tag || msg.author?.username || 'Inconnu';
        let body = msg.cleanContent || msg.content || '';

        if (msg.attachments && msg.attachments.size > 0) {
            const attList = msg.attachments.map(a => `[Fichier: ${a.name} (${a.url})]`).join(' ');
            body += (body ? ' ' : '') + attList;
        }

        if (msg.embeds && msg.embeds.length > 0 && !body) {
            const embTitles = msg.embeds.map(e => `[Embed: ${e.title || e.description || 'Aperçu'}]`).join(' ');
            body += (body ? ' ' : '') + embTitles;
        }

        content += `[${time}] [${authorTag}] : ${body}\n`;
    }

    content += `\n--------------------------------- FIN DU DOSSIER --------------------------------\n`;

    // 1. Écriture du fichier .txt sur le disque
    try {
        fs.writeFileSync(filePath, content, 'utf-8');
    } catch (e) {
        console.error('[Archives] Erreur écriture fichier .txt:', e);
    }

    // 2. Indexation JSON
    const archiveEntry = {
        id: dossierNum,
        fileName: fileName,
        targetId: targetId,
        targetTag: finalTargetTag,
        raison: initialRaison,
        decision: decision,
        verdictEmoji: verdictEmoji || '📁',
        modoId: modoUser?.id || null,
        modoTag: modoUser?.tag || 'Modo',
        date: dateStr,
        timestamp: Date.now(),
        messageCount: messages.length
    };

    archives.unshift(archiveEntry);
    sauvegarderArchives(archives);

    // 3. Envoi d'un exemplaire dans le salon des logs staff MOD_CHANNEL_ID
    try {
        const modChannel = guild.channels.cache.get(MOD_CHANNEL_ID) ?? await guild.channels.fetch(MOD_CHANNEL_ID).catch(() => null);
        if (modChannel && modChannel.isTextBased()) {
            const attachment = new AttachmentBuilder(Buffer.from(content, 'utf-8'), { name: fileName });
            const recapEmbed = new EmbedBuilder()
                .setColor(decision.includes('Banni') ? 0xd63031 : decision.includes('Innocenté') ? 0x00b894 : 0x0984e3)
                .setTitle(`📁 Archivage Dossier #${dossierNum} — Tribunal de Regaïa`)
                .setDescription(
                    `Le salon d'audition a été clôturé et son audience a été archivée avec succès.\n\n` +
                    `• **Accusé(e) :** \`${finalTargetTag}\` (<@${targetId}>)\n` +
                    `• **Verdict :** ${verdictEmoji || '⚖️'} **${decision}**\n` +
                    `• **Par :** <@${modoUser?.id}>\n` +
                    `• **Motif initial :** \`${initialRaison}\`\n` +
                    `• **Échanges :** \`${messages.length} messages retranscrits\``
                )
                .setFooter({ text: `Consultable à tout moment via !tribunal list ou !archives` })
                .setTimestamp();

            await modChannel.send({
                embeds: [recapEmbed],
                files: [attachment]
            }).catch(() => {});
        }
    } catch (e) {
        console.warn('[Archives] Impossible denvoyer au salon staff:', e);
    }

    return archiveEntry;
}

// Construction de la vue avec pagination & menu déroulant
function buildArchivesView(page = 1, filterTargetId = null) {
    let archives = chargerArchives();
    if (filterTargetId) {
        archives = archives.filter(a =>
            a.targetId === filterTargetId ||
            a.targetTag.toLowerCase().includes(filterTargetId.toLowerCase())
        );
    }

    const totalPages = Math.max(1, Math.ceil(archives.length / ITEMS_PER_PAGE));
    const currentPage = Math.min(Math.max(1, page), totalPages);

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const pageItems = archives.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('🏛️ Archives Judiciaires de Regaïa')
        .setDescription(
            `Consultez l'historique complet des auditions du Tribunal.\n` +
            `Sélectionnez un dossier dans le menu ci-dessous pour obtenir sa retranscription **.txt**.\n\n` +
            (filterTargetId ? `🔍 *Filtre actif :* \`${filterTargetId}\`\n\n` : '') +
            (pageItems.length === 0
                ? "*Aucune archive enregistrée pour le moment.*"
                : pageItems.map(item => {
                    return `📁 **Dossier #${item.id}** — \`${item.date}\`\n` +
                           `• **Accusé(e) :** \`${item.targetTag}\` (<@${item.targetId}>)\n` +
                           `• **Verdict :** ${item.verdictEmoji || '⚖️'} **${item.decision}** (par <@${item.modoId}>)\n` +
                           `• **Motif :** ${item.raison}`;
                }).join('\n\n')
            )
        )
        .setFooter({ text: `Page ${currentPage} sur ${totalPages} • Total : ${archives.length} dossier(s)` })
        .setTimestamp();

    const components = [];

    // Ligne 1 : Boutons Précédent / Suivant
    const navRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`arch_page_${currentPage - 1}_${filterTargetId || 'all'}`)
            .setLabel('◀️ Précédent')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage <= 1),
        new ButtonBuilder()
            .setCustomId(`arch_indicator`)
            .setLabel(`${currentPage}/${totalPages}`)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId(`arch_page_${currentPage + 1}_${filterTargetId || 'all'}`)
            .setLabel('➡️ Suivant')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage >= totalPages)
    );
    components.push(navRow);

    // Ligne 2 : Menu contextuel pour choisir le .txt
    if (pageItems.length > 0) {
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`arch_select_${currentPage}`)
            .setPlaceholder('📥 Choisir un dossier pour télécharger la retranscription .txt...')
            .addOptions(
                pageItems.map(item => ({
                    label: `Dossier #${item.id} — ${item.targetTag.slice(0, 30)}`,
                    description: `${item.decision.slice(0, 40)} • ${item.date}`.slice(0, 100),
                    value: String(item.id),
                    emoji: item.verdictEmoji || '📁'
                }))
            );
        components.push(new ActionRowBuilder().addComponents(selectMenu));
    }

    return { embed, components };
}

const STOP_DURATION_MS = 60 * 60 * 1000;
const CHUT_AUTHORIZED = [
    '738191002187202630',
    '436218312574107658',
    '1070742213635625050',
    '899733709173948487',
    '375746968737021962',
    '116682911314345993'
];

// --- Trackers mémoire ---
const PHISHING_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:discor(?:d(?:app)?|cl|cb|ct|cl-app|d-nitro|d-gift|dapp|dstatus)?[-_.]+(?:gift|nitro|giveaway|drop|claim|steam|promo|boost|vip|com\.ru|xyz|tk|ga|ml|cf|gq|club|top|click|link)|steamcommuni(?:i|l)ty\.[a-z]+)\b/i;
const slowmodeTrackers = new Map();
const slowmodeWarnStates = new Map();
const slowmodeWarnCooldowns = new Map();
const slowmodeActifs = new Set();

const AUTO_SLOWMODE_WINDOW_MS = 15 * 1000;
const AUTO_SLOWMODE_WARN_THRESHOLD = 15;
const AUTO_SLOWMODE_MIN_AUTHOR_MSGS = 5;
const AUTO_SLOWMODE_MASS_WARN_THRESHOLD = 22;
const AUTO_SLOWMODE_POST_WARN_THRESHOLD = 12;
const AUTO_SLOWMODE_WARN_COOLDOWN_MS = 60 * 1000;
const AUTO_SLOWMODE_SECONDS = 10;
const AUTO_SLOWMODE_DURATION_MS = 5 * 60 * 1000;
const AUTO_SLOWMODE_EXEMPT_CHANNELS = [
    '1553954760900608091', // Roulette
    '1559041936256409650', // Motus
    '1556089022718152764', // Rébus
    '1559041872868024370', // Pendu
    '1555402748193669192'  // Modération
];
const slowmodeSessions = new Map(); // channelId => { timeout, message, ancienSlowmode }

async function nettoyerBoutonAutoSlowmode(channelId, newContent = null) {
    const session = slowmodeSessions.get(channelId);
    if (!session) return false;
    clearTimeout(session.timeout);
    slowmodeSessions.delete(channelId);
    slowmodeActifs.delete(channelId);
    slowmodeTrackers.delete(channelId);
    slowmodeWarnStates.delete(channelId);
    if (session.message) {
        const editPayload = { components: [] };
        if (newContent) editPayload.content = newContent;
        await session.message.edit(editPayload).catch(() => {});
    }
    return true;
}

const spamTracker = new Map();
const raidJoinTracker = new Map();
const raidFlaggedUsers = new Map();
const raidMuteRecord = new Map();
const mutedChannels = new Map();

const SPAM_WINDOW_MS = 5000;
const SPAM_THRESHOLD = 5;
const SPAM_TIMEOUT_MS = 5 * 60 * 1000;
const SPAM_EXEMPT_CHANNELS = ['1553954760900608091'];
const SPAM_EXEMPT_REGEX = /^!(rlt|roulette)(\s+go)?\s*$/i;

const RAID_ACCOUNT_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const RAID_WINDOW_MS = 60 * 1000;
const RAID_THRESHOLD = 3;
const RAID_TIMEOUT_MS = 5 * 60 * 1000;
const RAID_ESCALATION_WINDOW_MS = 15 * 60 * 1000;

let securityState = {
    getReactionRolesData: () => ({}),
    getWarnsData: () => ({}),
    getDestitutionVotesData: () => ({}),
    demanderSauvegarde: () => {},
    client: null,
    EPSYS_ID: '436218312574107658'
};

// Alerte automatique si le membre ciblé quitte ou est banni pendant le tribunal
async function handleTribunalMemberRemove(memberOrUser, guildParam = null) {
    const userId = memberOrUser.id;
    const caseInfo = tribunalActiveCases.get(userId);
    if (!caseInfo || !caseInfo.channelId) return;

    const guild = memberOrUser.guild || guildParam || securityState.client?.guilds?.cache?.get('720057528351850547');
    if (!guild) return;

    const channel = guild.channels.cache.get(caseInfo.channelId) ?? await guild.channels.fetch(caseInfo.channelId).catch(() => null);
    if (!channel) return;

    const nom = memberOrUser.displayName || memberOrUser.username || caseInfo.targetTag || 'Le membre';

    const embed = new EmbedBuilder()
        .setColor(0xff9900)
        .setTitle('⚠️ Membre absent du serveur')
        .setDescription(
            `**${nom}** a quitté le serveur ou a été expulsé.e.\n\n` +
            `Le salon est donc inutile, vous pouvez :\n` +
            `• Supprimer manuellement le salon\n` +
            `• Cliquer sur le bouton ci-dessous pour fermer le salon automatiquement\n` +
            `• Ne rien faire`
        )
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tribunal_force_close_${userId}`)
            .setLabel('🗑️ Fermer le salon automatiquement')
            .setStyle(ButtonStyle.Danger)
    );

    await channel.send({
        content: `🔔 <@&${MODO_ROLE_ID}>`,
        embeds: [embed],
        components: [row]
    }).catch(() => {});
}

// Rattrapage automatique des salons de tribunal déjà ouverts au démarrage / redémarrage
async function synchroniserTribunauxExistants() {
    if (!securityState.client) return;
    try {
        const guild = securityState.client.guilds.cache.get('720057528351850547') ?? securityState.client.guilds.cache.first();
        if (!guild) return;

        const salonsTribunal = guild.channels.cache.filter(c =>
            c.parentId === CATEGORIE_MODERATION_ID &&
            c.name.startsWith('⚖') &&
            c.isTextBased()
        );

        for (const channel of salonsTribunal.values()) {
            const overwriteMembre = channel.permissionOverwrites?.cache?.find(po =>
                po.id !== securityState.client.user.id &&
                po.id !== guild.id &&
                po.id !== MODO_ROLE_ID
            );

            if (overwriteMembre) {
                const targetId = overwriteMembre.id;
                const member = guild.members.cache.get(targetId) ?? await guild.members.fetch(targetId).catch(() => null);
                const tag = member?.user?.tag || member?.displayName || 'Membre';
                tribunalActiveCases.set(targetId, {
                    channelId: channel.id,
                    targetTag: tag
                });
                console.log(`[Tribunal] Salon reconnecté : ${channel.name} pour ${tag} (${targetId})`);
            }
        }
    } catch (err) {
        console.warn('[Tribunal] Erreur synchro tribunaux existants:', err);
    }
}

function initSecurityState(bridge) {
    securityState = { ...securityState, ...bridge };
    if (securityState.client && !securityState.client._tribunalListenerAttached) {
        securityState.client._tribunalListenerAttached = true;
        securityState.client.on('guildMemberRemove', async (member) => {
            await handleTribunalMemberRemove(member);
        });
        securityState.client.on('guildBanAdd', async (ban) => {
            await handleTribunalMemberRemove(ban.user, ban.guild);
        });
        securityState.client.on('channelUpdate', async (oldChannel, newChannel) => {
            if (!newChannel || !slowmodeSessions.has(newChannel.id)) return;
            const newSlow = newChannel.rateLimitPerUser || 0;
            if (newSlow !== AUTO_SLOWMODE_SECONDS) {
                await nettoyerBoutonAutoSlowmode(
                    newChannel.id,
                    newSlow === 0
                        ? '✅ **Slowmode automatique retiré manuellement** *(retour au rythme normal)*.'
                        : `🐢 **Slowmode automatique modifié manuellement** *(nouveau slowmode : ${formatDurationFr(newSlow * 1000)})*.`
                );
            }
        });

        // Reconnexion immédiate des tribunaux en cours (même créés avant la mise à jour)
        if (securityState.client.isReady()) {
            synchroniserTribunauxExistants();
            setTimeout(() => verifierWarnsExpires(), 15000);
            setTimeout(() => verifierDestitutionsExpirees(), 15000);
        } else {
            securityState.client.once('clientReady', () => {
                synchroniserTribunauxExistants();
                setTimeout(() => verifierWarnsExpires(), 15000);
                setTimeout(() => verifierDestitutionsExpirees(), 15000);
            });
        }

        // Vérification toutes les heures des warns ayant atteint 60 jours
        setInterval(() => verifierWarnsExpires(), 60 * 60 * 1000);
        // Vérification chaque minute des votes de destitution expirés
        setInterval(() => verifierDestitutionsExpirees(), 60 * 1000);
    }
}

function estModo(member) {
    return member?.roles?.cache?.has(MODO_ROLE_ID) ?? false;
}

function peutModerer(member) {
    if (!member) return false;
    return member.id === securityState.EPSYS_ID || estModo(member);
}

// --- HELPERS MODÉRATION DIRECTE ---

function getWarnsMap() {
    return securityState.getWarnsData?.() || {};
}

function getUserWarns(userId) {
    const all = getWarnsMap();
    if (!Array.isArray(all[userId])) all[userId] = [];
    return all[userId];
}

function parseDurationMs(str) {
    if (!str) return null;
    const match = str.toLowerCase().trim().match(/^(\d+)\s*(s|sec|secs|m|min|mins|h|hr|hrs|j|d|jour|jours)$/);
    if (!match) return null;
    const val = parseInt(match[1], 10);
    if (isNaN(val) || val <= 0) return null;
    const unit = match[2];
    if (unit.startsWith('s')) return val * 1000;
    if (unit.startsWith('m')) return val * 60 * 1000;
    if (unit.startsWith('h')) return val * 60 * 60 * 1000;
    if (unit.startsWith('j') || unit === 'd') return val * 24 * 60 * 60 * 1000;
    return null;
}

function formatDurationFr(ms) {
    const totalSec = Math.round(ms / 1000);
    if (totalSec < 60) return `${totalSec} seconde${totalSec > 1 ? 's' : ''}`;
    const totalMin = Math.round(totalSec / 60);
    if (totalMin < 60) return `${totalMin} minute${totalMin > 1 ? 's' : ''}`;
    const totalH = Math.round(totalMin / 60);
    if (totalH < 24) return `${totalH} heure${totalH > 1 ? 's' : ''}`;
    const totalJ = Math.round(totalH / 24);
    return `${totalJ} jour${totalJ > 1 ? 's' : ''}`;
}

function getPurgeLabel(seconds) {
    if (!seconds || seconds <= 0) return '🚫 Désactivée *(messages conservés)*';
    if (seconds === 3600) return '🕒 Dernière **1 heure**';
    if (seconds === 21600) return '🕕 Dernières **6 heures**';
    if (seconds === 43200) return '🕛 Dernières **12 heures**';
    if (seconds === 86400) return '🗑️ Dernières **24 heures**';
    return `${seconds} secondes`;
}

// Logs staff silencieux par défaut pour ne pas spammer de notifications
async function logModerationStaff(guild, embed, { silent = true, content = undefined, components = undefined } = {}) {
    if (!guild) return null;
    const modChan = guild.channels.cache.get(MOD_CHANNEL_ID) ?? await guild.channels.fetch(MOD_CHANNEL_ID).catch(() => null);
    if (!modChan || !modChan.isTextBased()) return null;

    const payload = { embeds: [embed] };
    if (content) payload.content = content;
    if (components) payload.components = components;
    if (silent) payload.flags = [MessageFlags.SuppressNotifications];

    return modChan.send(payload).catch(() => null);
}

// MP systématique au membre sanctionné (avant kick/ban si applicable)
async function envoyerMpSanction(userOrMember, embedOrText) {
    if (!userOrMember) return false;
    try {
        const target = userOrMember.user ?? userOrMember;
        if (typeof embedOrText === 'string') {
            await target.send({ content: embedOrText });
        } else {
            await target.send({ embeds: [embedOrText] });
        }
        return true;
    } catch {
        return false;
    }
}

// Vérification hiérarchique complète
function verifierHierarchieSanction(executorMember, targetMember, targetId, { checkAction = null } = {}) {
    if (!targetId) return "❌ Membre introuvable.";
    if (targetId === executorMember?.id) return "❌ Tu ne peux pas appliquer cette sanction sur toi-même !";
    if (targetId === securityState.client?.user?.id) return "❌ Tu ne peux pas sanctionner Cacabot !";
    if (targetId === securityState.EPSYS_ID) return "❌ Impossible de sanctionner Epsys !";

    if (targetMember) {
        if (estModo(targetMember) && executorMember.id !== securityState.EPSYS_ID) {
            return "❌ Protection hiérarchique : impossible de sanctionner un(e) autre modérateur(trice) !";
        }
        if (
            executorMember.id !== securityState.EPSYS_ID &&
            executorMember.roles?.highest &&
            targetMember.roles?.highest &&
            targetMember.roles.highest.position >= executorMember.roles.highest.position
        ) {
            return "❌ Protection hiérarchique : ce membre possède un rôle supérieur ou égal au tien.";
        }
        if (checkAction === 'ban' && targetMember.bannable === false) {
            return "❌ Je n'ai pas les permissions (ou mon rôle est trop bas) pour bannir ce membre.";
        }
        if (checkAction === 'kick' && targetMember.kickable === false) {
            return "❌ Je n'ai pas les permissions (ou mon rôle est trop bas) pour expulser ce membre.";
        }
        if (checkAction === 'mute' && targetMember.moderatable === false) {
            return "❌ Je n'ai pas les permissions (ou mon rôle est trop bas) pour mute ce membre.";
        }
    }
    return null;
}

// Extraction intelligente de la cible (supporte le reply ET @mention / ID / pseudo)
async function extraireCibleEtReste(message, raw, { allowOfflineId = false, allowSpaceUsername = false } = {}) {
    const args = raw.split(/\s+/);
    let targetMember = null;
    let targetUser = null;
    let resteArgs = [];

    if (message.reference?.messageId) {
        const refMsg = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
        if (refMsg?.author) {
            const firstArgIsExplicitTarget = args[1] && (/^<@!?\d+>$/.test(args[1]) || /^\d{17,20}$/.test(args[1]));
            if (!firstArgIsExplicitTarget) {
                targetUser = refMsg.author;
                targetMember = message.guild.members.cache.get(refMsg.author.id)
                    ?? await message.guild.members.fetch(refMsg.author.id).catch(() => null);
                resteArgs = args.slice(1);
                return { targetMember, targetUser, targetId: targetUser.id, resteArgs, fromReply: true };
            }
        }
    }

    if (!args[1]) {
        return { targetMember: null, targetUser: null, targetId: null, resteArgs: [], fromReply: false };
    }

    targetMember = await trouverMembreServeur(message.guild, args[1]);
    if (targetMember) {
        targetUser = targetMember.user;
        resteArgs = args.slice(2);
        return { targetMember, targetUser, targetId: targetMember.id, resteArgs, fromReply: false };
    }

    if (allowSpaceUsername && args.length > 2) {
        const fullQuery = args.slice(1).join(' ');
        targetMember = await trouverMembreServeur(message.guild, fullQuery);
        if (targetMember) {
            return { targetMember, targetUser: targetMember.user, targetId: targetMember.id, resteArgs: [], fromReply: false };
        }
    }

    if (allowOfflineId) {
        const idMatch = args[1].match(/\d{17,20}/);
        if (idMatch) {
            targetUser = await securityState.client?.users?.fetch(idMatch[0]).catch(() => null);
            if (targetUser) {
                resteArgs = args.slice(2);
                return { targetMember: null, targetUser, targetId: targetUser.id, resteArgs, fromReply: false };
            }
        }
    }

    return { targetMember: null, targetUser: null, targetId: null, resteArgs: args.slice(2), notFoundQuery: args[1], fromReply: false };
}

// --- BUILDERS DES PANNEAUX INTERACTIFS ---

function buildBanConfirmPanel(sessionId) {
    const session = banSessions.get(sessionId);
    if (!session) return { embed: null, components: [] };

    const embed = new EmbedBuilder()
        .setColor(0xe03131)
        .setTitle('🔨 Confirmation de bannissement')
        .setDescription(`Tu es sur le point de bannir définitivement <@${session.targetId}> (\`${session.targetTag}\`).`)
        .setThumbnail(session.targetAvatar || null)
        .addFields(
            { name: '👤 Cible', value: `<@${session.targetId}> (\`${session.targetId}\`)`, inline: true },
            { name: '🧹 Purge des messages', value: getPurgeLabel(session.purgeSeconds), inline: true },
            { name: '📝 Raison', value: `\`\`\`${session.raison}\`\`\``, inline: false }
        )
        .setFooter({ text: 'Choisis la durée de purge ci-dessous puis confirme ou annule.' })
        .setTimestamp();

    const purgeMenu = new StringSelectMenuBuilder()
        .setCustomId(`ban_purge_${sessionId}`)
        .setPlaceholder('🧹 Purge des messages récents...')
        .addOptions(
            { label: 'Purge désactivée (0h)', description: 'Ne supprimer aucun message récent', emoji: '🚫', value: '0', default: session.purgeSeconds === 0 },
            { label: 'Purger 1 heure', description: 'Supprimer les messages envoyés depuis 1h', emoji: '🕒', value: '3600', default: session.purgeSeconds === 3600 },
            { label: 'Purger 6 heures', description: 'Supprimer les messages envoyés depuis 6h', emoji: '🕕', value: '21600', default: session.purgeSeconds === 21600 },
            { label: 'Purger 12 heures', description: 'Supprimer les messages envoyés depuis 12h', emoji: '🕛', value: '43200', default: session.purgeSeconds === 43200 },
            { label: 'Purger 24 heures', description: 'Supprimer les messages envoyés depuis 24h', emoji: '🗑️', value: '86400', default: session.purgeSeconds === 86400 }
        );

    const btnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`ban_confirm_${sessionId}`)
            .setLabel('🔨 Confirmer le ban')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId(`ban_reason_${sessionId}`)
            .setLabel('📝 Modifier la raison')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`ban_cancel_${sessionId}`)
            .setLabel('❌ Annuler')
            .setStyle(ButtonStyle.Secondary)
    );

    return {
        embed,
        components: [new ActionRowBuilder().addComponents(purgeMenu), btnRow]
    };
}

function buildMuteDurationPanel(sessionId) {
    const session = muteSessions.get(sessionId);
    if (!session) return { embed: null, components: [] };

    const embed = new EmbedBuilder()
        .setColor(0xf39c12)
        .setTitle('🔇 Mise en sourdine — Durée requise')
        .setDescription(`Précise pendant combien de temps tu veux mute <@${session.targetId}> (\`${session.targetTag}\`).`)
        .setThumbnail(session.targetAvatar || null)
        .addFields(
            { name: '👤 Membre ciblé', value: `<@${session.targetId}>`, inline: true },
            { name: '📝 Raison', value: `\`${session.raison}\``, inline: true }
        )
        .setFooter({ text: 'Sélectionne une durée dans le menu déroulant pour appliquer le mute immédiatement.' })
        .setTimestamp();

    const durationMenu = new StringSelectMenuBuilder()
        .setCustomId(`mute_duration_${sessionId}`)
        .setPlaceholder('⏱️ Choisis la durée du mute...')
        .addOptions(
            { label: '5 minutes', emoji: '⏱️', value: '5min' },
            { label: '10 minutes', emoji: '⏱️', value: '10min' },
            { label: '15 minutes', emoji: '⏱️', value: '15min' },
            { label: '30 minutes', emoji: '⏱️', value: '30min' },
            { label: '1 heure', emoji: '🕒', value: '1h' },
            { label: '6 heures', emoji: '🕕', value: '6h' },
            { label: '12 heures', emoji: '🕛', value: '12h' },
            { label: '24 heures (1 jour)', emoji: '📅', value: '24h' },
            { label: '3 jours', emoji: '📆', value: '3j' },
            { label: '7 jours (1 semaine)', emoji: '🗓️', value: '7j' }
        );

    const btnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`mute_reason_${sessionId}`)
            .setLabel('📝 Modifier la raison')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`mute_cancel_${sessionId}`)
            .setLabel('❌ Annuler')
            .setStyle(ButtonStyle.Secondary)
    );

    return {
        embed,
        components: [new ActionRowBuilder().addComponents(durationMenu), btnRow]
    };
}

function formatWarnsListLines(warns, highlightId = null) {
    if (!warns || warns.length === 0) return '*Aucun avertissement actif.*';
    return warns.slice(-10).map(w => {
        const tsSec = Math.floor((w.timestamp || Date.now()) / 1000);
        const prefix = highlightId && String(w.id) === String(highlightId) ? '👉 ' : '';
        return `${prefix}**#${w.id}** • <t:${tsSec}:d> (<t:${tsSec}:R>) — par <@${w.modoId}>\n└ *${w.reason}*`;
    }).join('\n');
}

function buildWarnsCasierEmbed(targetUser, targetId, warns) {
    const count = warns.length;
    const nextStep = count >= 6
        ? '🔨 Ban définitif déjà atteint'
        : WARN_STEPS_DESC[count] || '🔨 Ban définitif';

    return new EmbedBuilder()
        .setColor(count === 0 ? 0x2ecc71 : count >= 4 ? 0xe74c3c : 0xf1c40f)
        .setTitle(`📋 Casier des avertissements — ${targetUser?.displayName || targetUser?.username || targetId}`)
        .setThumbnail(targetUser?.displayAvatarURL?.({ dynamic: true }) || null)
        .setDescription(
            `• **Membre :** <@${targetId}> (\`${targetId}\`)\n` +
            `• **Total actuel :** \`${count} / 6\` avertissement(s)\n` +
            `• **Prochain palier :** ${nextStep}\n\n` +
            `### 📜 Historique des warns\n` +
            formatWarnsListLines(warns)
        )
        .setFooter({ text: 'Utilise !unwarn @membre pour retirer un avertissement.' })
        .setTimestamp();
}

function buildUnwarnConfirmPanel(targetUser, targetId, selectedWarnId = null, isSixtyDaysAlert = false) {
    const warns = getUserWarns(targetId);
    if (warns.length === 0) {
        const emptyEmbed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('✅ Casier vierge')
            .setDescription(`<@${targetId}> ne possède aucun avertissement actif.`)
            .setTimestamp();
        return { embed: emptyEmbed, components: [] };
    }

    const targetWarn = warns.find(w => String(w.id) === String(selectedWarnId)) || warns[0];
    const tsSec = Math.floor((targetWarn.timestamp || Date.now()) / 1000);

    const embed = new EmbedBuilder()
        .setColor(isSixtyDaysAlert ? 0x9b59b6 : 0xe67e22)
        .setTitle(isSixtyDaysAlert ? '⏳ Avertissement vieux de 60+ jours' : '🧹 Retrait d\'avertissement — Confirmation')
        .setThumbnail(targetUser?.displayAvatarURL?.({ dynamic: true }) || null)
        .setDescription(
            (isSixtyDaysAlert
                ? `Un avertissement de <@${targetId}> a atteint **60 jours**. Souhaitez-vous le retirer ou le conserver ?\n\n`
                : `Casier de <@${targetId}> (\`${warns.length}/6\` warn(s)). Confirme l'action pour l'avertissement sélectionné :\n\n`) +
            `### 🎯 Avertissement ciblé (#${targetWarn.id})\n` +
            `• **Date :** <t:${tsSec}:F> (<t:${tsSec}:R>)\n` +
            `• **Modérateur :** <@${targetWarn.modoId}>\n` +
            `• **Raison :** \`${targetWarn.reason}\`\n\n` +
            `### 📜 Tous les avertissements du membre (${warns.length})\n` +
            formatWarnsListLines(warns, targetWarn.id)
        )
        .setFooter({ text: isSixtyDaysAlert ? 'Utilisable par tous les modérateurs' : 'Confirmation requise par un modérateur' })
        .setTimestamp();

    const components = [];
    if (!isSixtyDaysAlert && warns.length > 1) {
        const select = new StringSelectMenuBuilder()
            .setCustomId(`unwarn_pick_${targetId}`)
            .setPlaceholder('Choisir un autre avertissement dans la liste...')
            .addOptions(
                warns.slice(0, 25).map(w => ({
                    label: `Warn #${w.id} — ${String(w.reason).slice(0, 60)}`,
                    description: `Par ${w.modoTag || 'Modo'} le ${new Date(w.timestamp).toLocaleDateString('fr-FR')}`.slice(0, 100),
                    value: String(w.id),
                    default: String(w.id) === String(targetWarn.id)
                }))
            );
        components.push(new ActionRowBuilder().addComponents(select));
    }

    const prefix = isSixtyDaysAlert ? 'warn60' : 'unwarn';
    const btnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`${prefix}_remove_${targetId}_${targetWarn.id}`)
            .setLabel('🗑️ Enlever l\'avertissement')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`${prefix}_keep_${targetId}_${targetWarn.id}`)
            .setLabel('📌 Garder l\'avertissement')
            .setStyle(ButtonStyle.Secondary)
    );
    components.push(btnRow);

    return { embed, components };
}

// Vérification automatique des warns ayant atteint 60 jours
async function verifierWarnsExpires() {
    if (!securityState.client) return;
    try {
        const guild = securityState.client.guilds.cache.get('720057528351850547') ?? securityState.client.guilds.cache.first();
        if (!guild) return;
        const modChan = guild.channels.cache.get(MOD_CHANNEL_ID) ?? await guild.channels.fetch(MOD_CHANNEL_ID).catch(() => null);
        if (!modChan || !modChan.isTextBased()) return;

        const allWarns = getWarnsMap();
        const now = Date.now();
        let changed = false;

        for (const [targetId, warns] of Object.entries(allWarns)) {
            if (!Array.isArray(warns) || warns.length === 0) continue;
            for (const warn of warns) {
                if (!warn.expiredNotified && warn.timestamp && (now - warn.timestamp >= WARN_REMINDER_AGE_MS)) {
                    warn.expiredNotified = true;
                    changed = true;

                    const targetMember = guild.members.cache.get(targetId) ?? await guild.members.fetch(targetId).catch(() => null);
                    const targetUser = targetMember?.user ?? await securityState.client.users.fetch(targetId).catch(() => null);
                    const { embed, components } = buildUnwarnConfirmPanel(targetMember || targetUser, targetId, warn.id, true);

                    await modChan.send({
                        content: `🔔 <@&${MODO_ROLE_ID}> • Un avertissement de <@${targetId}> vient d'atteindre **60 jours**.`,
                        embeds: [embed],
                        components
                    }).catch(() => {});
                }
            }
        }

        if (changed) securityState.demanderSauvegarde();
    } catch (err) {
        console.warn('[Warns 60j] Erreur vérification:', err);
    }
}

// Application du mute (utilisée en instantané et depuis le menu contextuel)
async function executerMute({ guild, channel, executorUser, targetMember, durationMs, durationLabel, raison }) {
    const finSec = Math.floor((Date.now() + durationMs) / 1000);
    await targetMember.timeout(durationMs, `${raison} (par ${executorUser.tag})`);

    const mpEmbed = new EmbedBuilder()
        .setColor(0xf39c12)
        .setTitle('🔇 Tu as été mis(e) en sourdine sur Regaïa')
        .setDescription(
            `• **Durée :** **${durationLabel}** *(fin <t:${finSec}:R>)*\n` +
            `• **Raison :** \`${raison}\``
        )
        .setTimestamp();
    const mpOk = await envoyerMpSanction(targetMember, mpEmbed);

    const publicEmbed = new EmbedBuilder()
        .setColor(0xf39c12)
        .setTitle('🔇 Membre mis en sourdine')
        .setDescription(`<@${targetMember.id}> a été mute pendant **${durationLabel}**.`)
        .addFields(
            { name: '⏱️ Fin prévue', value: `<t:${finSec}:F> (<t:${finSec}:R>)`, inline: true },
            { name: '🛡️ Modérateur', value: `<@${executorUser.id}>`, inline: true },
            { name: '📝 Raison', value: `\`${raison}\``, inline: false }
        )
        .setFooter({ text: mpOk ? '📩 Membre prévenu en MP' : '⚠️ MP fermés' })
        .setTimestamp();

    const logEmbed = new EmbedBuilder()
        .setColor(0xf39c12)
        .setTitle('🔇 Log — Mute (!mute)')
        .setDescription(
            `• **Cible :** <@${targetMember.id}> (\`${targetMember.id}\`)\n` +
            `• **Modérateur :** <@${executorUser.id}>\n` +
            `• **Durée :** **${durationLabel}** (fin <t:${finSec}:R>)\n` +
            `• **Salon :** <#${channel.id}>\n` +
            `• **Raison :** \`${raison}\`\n` +
            `• **MP remis :** ${mpOk ? 'Oui' : 'Non'}`
        )
        .setTimestamp();
    await logModerationStaff(guild, logEmbed, { silent: true });

    return publicEmbed;
}

// --- HELPERS VOTE DE DESTITUTION (!destituation / !desti / !antimodo) ---

function getDestitutionVotesMap() {
    return securityState.getDestitutionVotesData?.() || {};
}

function buildDestiConfirmPanel(sessionId) {
    const session = destiSessions.get(sessionId);
    if (!session) return { embed: null, components: [] };

    const embed = new EmbedBuilder()
        .setColor(0xd63031)
        .setTitle('⚖️ Confirmation — Vote de destitution de Modérateur')
        .setThumbnail(session.targetAvatar || null)
        .setDescription(
            `Tu t'apprêtes à ouvrir un **vote exceptionnel anonyme de 48h** visant à décider si <@${session.targetId}> (\`${session.targetTag}\`) conserve son rôle de modérateur.\n\n` +
            `⚠️ **Attention :** La confirmation va **mentionner tous les modérateurs (<@&${MODO_ROLE_ID}>)** dans ce salon.`
        )
        .addFields(
            { name: '👤 Modérateur visé', value: `<@${session.targetId}> (\`${session.targetId}\`)`, inline: true },
            { name: '⏱️ Durée & Quorum', value: '**48 heures** • Min. **4 votes**', inline: true },
            { name: '📝 Motif invoqué', value: `\`\`\`${session.raison}\`\`\``, inline: false }
        )
        .setFooter({ text: 'Relis bien les informations avant de lancer le vote.' })
        .setTimestamp();

    const btnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`desti_confirm_${sessionId}`)
            .setLabel('🗳️ Lancer le vote & Ping Modos')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId(`desti_reason_${sessionId}`)
            .setLabel('📝 Modifier la raison')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`desti_cancel_${sessionId}`)
            .setLabel('❌ Annuler')
            .setStyle(ButtonStyle.Secondary)
    );

    return { embed, components: [btnRow] };
}

function buildDestiVoteEmbed(voteData, ended = false, outcomeText = null) {
    const endSec = Math.floor((voteData.endsAt || Date.now()) / 1000);
    const totalVotes = (voteData.pour?.length || 0) + (voteData.contre?.length || 0);

    const embed = new EmbedBuilder()
        .setColor(ended ? 0x2d3436 : 0xd63031)
        .setTitle(ended ? '⚖️ VOTE DE DESTITUTION CLÔTURÉ' : '⚖️ VOTE EXCEPTIONNEL — DESTITUTION DE MODÉRATEUR')
        .setThumbnail(voteData.targetAvatar || null)
        .setDescription(
            `Un vote anonyme a été ouvert par <@${voteData.authorId}> concernant le maintien du rôle modérateur de <@${voteData.targetId}> (\`${voteData.targetTag}\`).\n\n` +
            `• **Motif invoqué :**\n\`\`\`${voteData.raison}\`\`\`\n` +
            `📌 **Règles du scrutin :**\n` +
            `• **Votes 100% anonymes** réservés à l'équipe de modération *(seuls les totaux sont affichés)*.\n` +
            `• **<@${voteData.targetId}>** ne peut pas voter pour son propre sort.\n` +
            `• **Conditions de destitution :** minimum **${DESTITUTION_MIN_VOTES} votes** au total ET majorité pour le retrait (\`Retirer > Garder\`).\n` +
            (ended
                ? `\n🏁 **Résultat final :**\n${outcomeText}`
                : `\n⏳ **Clôture automatique :** <t:${endSec}:F> (<t:${endSec}:R>)`)
        )
        .addFields(
            { name: '🚪 Retirer le rôle', value: `**${voteData.pour?.length || 0}** vote(s)`, inline: true },
            { name: '🛡️ Garder modo', value: `**${voteData.contre?.length || 0}** vote(s)`, inline: true },
            { name: '📊 Participation', value: `**${totalVotes}** / ${DESTITUTION_MIN_VOTES} min.`, inline: true }
        )
        .setFooter({ text: ended ? 'Scrutin terminé • Votes anonymes' : 'Seul Epsys peut clôturer manuellement avant les 48h' })
        .setTimestamp();

    return embed;
}

function buildDestiVoteRow(voteData, disabled = false) {
    const pourCount = voteData.pour?.length || 0;
    const contreCount = voteData.contre?.length || 0;

    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('desti_vote_remove')
            .setLabel(`Retirer le rôle (${pourCount})`)
            .setEmoji('🚪')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId('desti_vote_keep')
            .setLabel(`Garder modo (${contreCount})`)
            .setEmoji('🛡️')
            .setStyle(ButtonStyle.Success)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId('desti_vote_close')
            .setLabel('Clôturer (Epsys)')
            .setEmoji('🔒')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled)
    );
}

async function cloturerVoteDestitution(msgId, closedByUser = null) {
    const allVotes = getDestitutionVotesMap();
    const voteData = allVotes[msgId];
    if (!voteData || voteData.cloture) return;
    voteData.cloture = true;

    const client = securityState.client;
    if (!client) return;

    const channel = client.channels.cache.get(voteData.channelId) ?? await client.channels.fetch(voteData.channelId).catch(() => null);
    const guild = channel?.guild ?? client.guilds.cache.get('720057528351850547') ?? client.guilds.cache.first();

    const pourCount = (voteData.pour || []).filter(id => id !== voteData.targetId).length;
    const contreCount = (voteData.contre || []).filter(id => id !== voteData.targetId).length;
    const totalVotes = pourCount + contreCount;

    const quorumAtteint = totalVotes >= DESTITUTION_MIN_VOTES;
    const destitue = quorumAtteint && pourCount > contreCount;

    let outcomeText;
    if (!quorumAtteint) {
        outcomeText = `🛡️ **Rôle conservé** — Le minimum de **${DESTITUTION_MIN_VOTES} votes** n'a pas été atteint (**${totalVotes}** votant(s)).`;
    } else if (destitue) {
        outcomeText = `🚪 **Rôle modérateur retiré** — Majorité atteinte (**${pourCount}** contre **${contreCount}**).`;
    } else {
        outcomeText = `🛡️ **Rôle conservé** — La majorité (ou égalité) maintient <@${voteData.targetId}> dans l'équipe (**${contreCount}** Garder vs **${pourCount}** Retirer).`;
    }

    if (closedByUser) {
        outcomeText += `\n*(Clôturé manuellement par <@${closedByUser.id}>)*`;
    }

    if (channel && channel.isTextBased()) {
        const voteMsg = await channel.messages.fetch(msgId).catch(() => null);
        if (voteMsg) {
            await voteMsg.edit({
                embeds: [buildDestiVoteEmbed(voteData, true, outcomeText)],
                components: [buildDestiVoteRow(voteData, true)]
            }).catch(() => {});
        }
    }

    const targetMember = guild ? (guild.members.cache.get(voteData.targetId) ?? await guild.members.fetch(voteData.targetId).catch(() => null)) : null;
    const targetUser = targetMember?.user ?? await client.users.fetch(voteData.targetId).catch(() => null);

    if (destitue) {
        let retraitOk = false;
        if (targetMember && targetMember.roles.cache.has(MODO_ROLE_ID)) {
            await targetMember.roles.remove(MODO_ROLE_ID, `Vote de destitution adopté (${pourCount} vs ${contreCount})`).then(() => {
                retraitOk = true;
            }).catch(() => {});
        }

        const mpEmbed = new EmbedBuilder()
            .setColor(0xd63031)
            .setTitle('⚖️ Décision de l\'équipe de modération (Regaïa)')
            .setDescription(
                `À l'issue d'un vote anonyme de l'équipe de modération, **ton rôle de modérateur a été retiré**.\n\n` +
                `• **Résultat :** ${pourCount} vote(s) pour le retrait / ${contreCount} vote(s) pour le maintien\n` +
                `• **Motif du vote :** \`${voteData.raison}\``
            )
            .setTimestamp();
        const mpOk = await envoyerMpSanction(targetMember || targetUser, mpEmbed);

        // Alerte dans le salon du vote avec mention du concerné
        if (channel && channel.isTextBased()) {
            const alertEmbed = new EmbedBuilder()
                .setColor(0xd63031)
                .setTitle('🚨 Rôle Modérateur retiré suite au vote')
                .setDescription(
                    `<@${voteData.targetId}> s'est vu retirer le rôle <@&${MODO_ROLE_ID}> suite au scrutin (${pourCount} Retirer vs ${contreCount} Garder).\n` +
                    `• **Statut du rôle :** ${retraitOk ? '✅ Retiré automatiquement' : '⚠️ Membre absent ou rôle déjà retiré'}\n` +
                    `• **Notification MP :** ${mpOk ? '📩 Envoyée' : '⚠️ MP fermés'}`
                )
                .setTimestamp();
            await channel.send({
                content: `🔔 <@${voteData.targetId}> | <@${securityState.EPSYS_ID}>`,
                embeds: [alertEmbed]
            }).catch(() => {});
        }

        // Log dans MOD_CHANNEL_ID (1555402748193669192)
        if (guild) {
            const logEmbed = new EmbedBuilder()
                .setColor(0xd63031)
                .setTitle('⚖️ Log — Destitution appliquée')
                .setDescription(
                    `• **Membre concerné :** <@${voteData.targetId}> (\`${voteData.targetTag}\`)\n` +
                    `• **Vote lancé par :** <@${voteData.authorId}>\n` +
                    `• **Salon du vote :** <#${voteData.channelId}>\n` +
                    `• **Score final :** **${pourCount}** Retirer vs **${contreCount}** Garder\n` +
                    `• **Motif :** \`${voteData.raison}\`\n` +
                    `• **MP remis :** ${mpOk ? 'Oui' : 'Non'}`
                )
                .setTimestamp();
            await logModerationStaff(guild, logEmbed, { silent: true });
        }
    } else {
        if (channel && channel.isTextBased()) {
            const keepEmbed = new EmbedBuilder()
                .setColor(0x00b894)
                .setTitle('🛡️ Vote terminé — Statut modérateur maintenu')
                .setDescription(
                    `Le vote concernant <@${voteData.targetId}> est clôturé.\n${outcomeText}`
                )
                .setTimestamp();
            await channel.send({
                embeds: [keepEmbed],
                flags: [MessageFlags.SuppressNotifications]
            }).catch(() => {});
        }

        if (guild && voteData.channelId !== MOD_CHANNEL_ID) {
            const logEmbed = new EmbedBuilder()
                .setColor(0x00b894)
                .setTitle('⚖️ Log — Vote destitution (Maintien)')
                .setDescription(
                    `• **Membre concerné :** <@${voteData.targetId}> (\`${voteData.targetTag}\`)\n` +
                    `• **Score final :** **${pourCount}** Retirer vs **${contreCount}** Garder (${totalVotes} votes)\n` +
                    `• **Motif :** \`${voteData.raison}\``
                )
                .setTimestamp();
            await logModerationStaff(guild, logEmbed, { silent: true });
        }
    }

    delete allVotes[msgId];
    securityState.demanderSauvegarde();
}

async function verifierDestitutionsExpirees() {
    try {
        const allVotes = getDestitutionVotesMap();
        const now = Date.now();
        for (const [msgId, voteData] of Object.entries(allVotes)) {
            if (!voteData || voteData.cloture) continue;
            if (now >= (voteData.endsAt || 0)) {
                await cloturerVoteDestitution(msgId, null);
            }
        }
    } catch (err) {
        console.warn('[Destitution] Erreur vérification expiration:', err);
    }
}

function isChannelMuted(channelId) {
    const entry = mutedChannels.get(channelId);
    if (!entry) return false;
    if (Date.now() >= entry.until) {
        mutedChannels.delete(channelId);
        return false;
    }
    return true;
}

// =========================
//    MESSAGES (Sécurité & Commandes)
// =========================

// --- Panneau de configuration pour !bantemp ---
function buildBantempConfigPanel(sessionId) {
    const session = bantempSessions.get(sessionId);
    if (!session) return { embed: null, rows: [] };

    const embed = new EmbedBuilder()
        .setColor(0xfa5252)
        .setTitle('⚖️ Tribunal de Regaïa - Configuration Modération')
        .setDescription(`Procédure d'audition ciblée sur <@${session.targetId}> (\`${session.targetId}\`).`)
        .addFields(
            { name: '📩 Prévenir en MP', value: session.mp ? '🟢 **OUI** *(message avec lien du salon)*' : '⚪ **NON**', inline: true },
            { name: '⚖️ Créer salon Tribunal', value: session.creerTicket ? '🟢 **OUI** *(dans Catégorie Modération)*' : '⚪ **NON**', inline: true },
            { name: '📝 Raison de la procédure', value: `\`\`\`${session.raison || 'Non spécifiée'}\`\`\``, inline: false }
        )
        .setFooter({ text: 'Ajuste les options avec les 3 boutons blancs, puis confirme ou annule.' })
        .setTimestamp();

    const rowOptions = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`bt_toggle_mp_${sessionId}`)
            .setLabel(`📩 MP : ${session.mp ? 'OUI' : 'NON'}`)
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`bt_set_reason_${sessionId}`)
            .setLabel('📝 Modifier la raison')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`bt_toggle_ticket_${sessionId}`)
            .setLabel(`⚖️ Salon Tribunal : ${session.creerTicket ? 'OUI' : 'NON'}`)
            .setStyle(ButtonStyle.Secondary)
    );

    const rowActions = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`bt_confirm_${sessionId}`)
            .setLabel('✅ Confirmer')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`bt_cancel_${sessionId}`)
            .setLabel('❌ Annuler')
            .setStyle(ButtonStyle.Danger)
    );

    return { embed, rows: [rowOptions, rowActions] };
}

// Recherche tolérante d'un membre sur l'ensemble du serveur (par ID direct avec/sans parenthèses, mention ou pseudo)
async function trouverMembreServeur(guild, query) {
    if (!guild || !query) return null;

    // 1. Extraction universelle d'un ID Discord (17 à 20 chiffres, même avec parenthèses, crochets ou mention)
    const idMatch = query.match(/\d{17,20}/);
    if (idMatch) {
        const id = idMatch[0];
        const parId = guild.members.cache.get(id) ?? await guild.members.fetch(id).catch(() => null);
        if (parId) return parId;
    }

    const q = query.toLowerCase().replace(/[@()]/g, '').trim();

    // 2. Recherche exacte sur pseudo, nom d'affichage ou tag
    const exact = guild.members.cache.find(m =>
        (m.user?.username && m.user.username.toLowerCase() === q) ||
        (m.user?.globalName && m.user.globalName.toLowerCase() === q) ||
        (m.displayName && m.displayName.toLowerCase() === q)
    );
    if (exact) return exact;

    // 3. Recherche partielle (commence par ou contient)
    const partiel = guild.members.cache.find(m =>
        (m.user?.username && m.user.username.toLowerCase().includes(q)) ||
        (m.user?.globalName && m.user.globalName.toLowerCase().includes(q)) ||
        (m.displayName && m.displayName.toLowerCase().includes(q))
    );
    return partiel || null;
}

async function handleSecurityMessage(message) {
    const channelId = message.channel.id;
    const raw = message.content.trim();
    const command = raw.split(/\s+/)[0]?.toLowerCase();

    // 00. COMMANDES DE MODÉRATION DIRECTE (Modos + Epsys, utilisables dans tout salon)
    const MOD_COMMANDS = [
        '!bannir', '!unban', '!kick', '!expulser',
        '!mute', '!unmute',
        '!warn', '!warns', '!casier', '!unwarn',
        '!slowmode', '!lock', '!unlock'
    ];
    if (MOD_COMMANDS.includes(command)) {
        if (!message.guild) {
            await message.reply("❌ Cette commande est uniquement utilisable sur le serveur.");
            return true;
        }
        if (!peutModerer(message.member)) {
            await message.reply("❌ Cette commande est réservée aux modérateurs et à Epsys.");
            return true;
        }

        // --- !bannir [@membre/ID/reply] [raison] ---
        if (command === '!bannir') {
            const info = await extraireCibleEtReste(message, raw, { allowOfflineId: true });
            if (info.notFoundQuery) {
                await message.reply(`❌ Membre introuvable avec \`${info.notFoundQuery}\` *(essaie une mention, un pseudo exact ou son ID)*.`);
                return true;
            }
            if (!info.targetId) {
                const sessionId = `${Date.now()}_${message.author.id}`;
                banSessions.set(sessionId, {
                    authorId: message.author.id,
                    channelId: message.channel.id,
                    messageId: message.id,
                    targetId: null,
                    targetTag: null,
                    targetAvatar: null,
                    raison: 'Aucune raison précisée',
                    purgeSeconds: 0
                });
                setTimeout(() => banSessions.delete(sessionId), 5 * 60 * 1000);

                const selectEmbed = new EmbedBuilder()
                    .setColor(0xe03131)
                    .setTitle('🔨 Bannir un membre')
                    .setDescription('Sélectionne le membre à bannir dans le menu ci-dessous *(ou réponds à un message avec `!bannir [raison]`)*.')
                    .setTimestamp();
                const userRow = new ActionRowBuilder().addComponents(
                    new UserSelectMenuBuilder().setCustomId(`ban_select_user_${sessionId}`).setPlaceholder('👤 Choisir le membre à bannir...')
                );
                const cancelRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`ban_cancel_${sessionId}`).setLabel('❌ Annuler').setStyle(ButtonStyle.Secondary)
                );
                await message.reply({ embeds: [selectEmbed], components: [userRow, cancelRow] });
                return true;
            }

            const errHier = verifierHierarchieSanction(message.member, info.targetMember, info.targetId, { checkAction: 'ban' });
            if (errHier) {
                await message.reply(errHier);
                return true;
            }

            const existingBan = await message.guild.bans.fetch(info.targetId).catch(() => null);
            if (existingBan) {
                await message.reply(`ℹ️ <@${info.targetId}> est déjà banni(e) du serveur.`);
                return true;
            }

            const raison = info.resteArgs.join(' ').trim() || 'Aucune raison précisée';
            const sessionId = `${Date.now()}_${message.author.id}`;
            banSessions.set(sessionId, {
                authorId: message.author.id,
                channelId: message.channel.id,
                messageId: message.id,
                targetId: info.targetId,
                targetTag: info.targetUser?.tag || info.targetMember?.displayName || info.targetId,
                targetAvatar: info.targetUser?.displayAvatarURL?.({ dynamic: true }) || null,
                raison,
                purgeSeconds: 0
            });
            setTimeout(() => banSessions.delete(sessionId), 5 * 60 * 1000);

            const { embed, components } = buildBanConfirmPanel(sessionId);
            await message.reply({ embeds: [embed], components });
            return true;
        }

        // --- !unban [ID] [raison] ---
        if (command === '!unban') {
            const args = raw.split(/\s+/);
            const idMatch = args[1]?.match(/\d{17,20}/);
            if (!idMatch) {
                const usageEmbed = new EmbedBuilder()
                    .setColor(0x3498db)
                    .setTitle('🔓 Débannir un membre')
                    .setDescription('**Usage :** `!unban [ID_du_membre] [raison optionnelle]`\nExemple : `!unban 123456789012345678 Erreur de ban`');
                await message.reply({ embeds: [usageEmbed] });
                return true;
            }

            const targetId = idMatch[0];
            const banEntry = await message.guild.bans.fetch(targetId).catch(() => null);
            if (!banEntry) {
                await message.reply(`❌ Aucun bannissement actif trouvé pour l'ID \`${targetId}\`.`);
                return true;
            }

            const raison = args.slice(2).join(' ').trim() || 'Débannissement manuel';
            try {
                await message.guild.members.unban(targetId, `${raison} (par ${message.author.tag})`);
                const unbanEmbed = new EmbedBuilder()
                    .setColor(0x2ecc71)
                    .setTitle('🔓 Membre débanni')
                    .setDescription(`<@${targetId}> (\`${banEntry.user?.tag || targetId}\`) a été débanni(e) par <@${message.author.id}>.`)
                    .addFields({ name: '📝 Raison', value: `\`${raison}\`` })
                    .setTimestamp();
                await message.reply({ embeds: [unbanEmbed] });

                const logEmbed = new EmbedBuilder()
                    .setColor(0x2ecc71)
                    .setTitle('🔓 Log — Débannissement (!unban)')
                    .setDescription(
                        `• **Cible :** <@${targetId}> (\`${banEntry.user?.tag || targetId}\`)\n` +
                        `• **Modérateur :** <@${message.author.id}>\n` +
                        `• **Raison :** \`${raison}\``
                    )
                    .setTimestamp();
                await logModerationStaff(message.guild, logEmbed, { silent: true });
            } catch (err) {
                await message.reply(`❌ Impossible de débannir ce compte (${err.message}).`);
            }
            return true;
        }

        // --- !kick / !expulser [@membre/ID/reply] [raison] ---
        if (command === '!kick' || command === '!expulser') {
            const info = await extraireCibleEtReste(message, raw);
            if (info.notFoundQuery) {
                await message.reply(`❌ Membre introuvable sur le serveur avec \`${info.notFoundQuery}\`.`);
                return true;
            }
            if (!info.targetMember) {
                const sessionId = `${Date.now()}_${message.author.id}`;
                kickSessions.set(sessionId, {
                    authorId: message.author.id,
                    channelId: message.channel.id,
                    messageId: message.id,
                    targetId: null,
                    targetTag: null,
                    raison: 'Aucune raison précisée'
                });
                setTimeout(() => kickSessions.delete(sessionId), 5 * 60 * 1000);

                const selectEmbed = new EmbedBuilder()
                    .setColor(0xe67e22)
                    .setTitle('👢 Expulser un membre')
                    .setDescription('Sélectionne le membre à expulser dans le menu ci-dessous *(ou réponds à un message avec `!kick [raison]`)*.')
                    .setTimestamp();
                const userRow = new ActionRowBuilder().addComponents(
                    new UserSelectMenuBuilder().setCustomId(`kick_select_user_${sessionId}`).setPlaceholder('👤 Choisir le membre à expulser...')
                );
                const cancelRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`kick_cancel_${sessionId}`).setLabel('❌ Annuler').setStyle(ButtonStyle.Secondary)
                );
                await message.reply({ embeds: [selectEmbed], components: [userRow, cancelRow] });
                return true;
            }

            const errHier = verifierHierarchieSanction(message.member, info.targetMember, info.targetId, { checkAction: 'kick' });
            if (errHier) {
                await message.reply(errHier);
                return true;
            }

            const raison = info.resteArgs.join(' ').trim() || 'Aucune raison précisée';
            const mpEmbed = new EmbedBuilder()
                .setColor(0xe67e22)
                .setTitle('👢 Tu as été expulsé(e) du serveur Regaïa')
                .setDescription(`• **Raison :** \`${raison}\``)
                .setTimestamp();
            const mpOk = await envoyerMpSanction(info.targetMember, mpEmbed);

            try {
                await info.targetMember.kick(`${raison} (par ${message.author.tag})`);
                const kickEmbed = new EmbedBuilder()
                    .setColor(0xe67e22)
                    .setTitle('👢 Membre expulsé')
                    .setDescription(`<@${info.targetId}> (\`${info.targetUser?.tag || info.targetMember.displayName}\`) a été expulsé(e) par <@${message.author.id}>.`)
                    .addFields({ name: '📝 Raison', value: `\`${raison}\`` })
                    .setFooter({ text: mpOk ? '📩 Membre prévenu en MP' : '⚠️ MP fermés' })
                    .setTimestamp();
                await message.reply({ embeds: [kickEmbed] });

                const logEmbed = new EmbedBuilder()
                    .setColor(0xe67e22)
                    .setTitle('👢 Log — Expulsion (!kick)')
                    .setDescription(
                        `• **Cible :** <@${info.targetId}> (\`${info.targetId}\`)\n` +
                        `• **Modérateur :** <@${message.author.id}>\n` +
                        `• **Salon :** <#${message.channel.id}>\n` +
                        `• **Raison :** \`${raison}\`\n` +
                        `• **MP remis :** ${mpOk ? 'Oui' : 'Non'}`
                    )
                    .setTimestamp();
                await logModerationStaff(message.guild, logEmbed, { silent: true });
            } catch (err) {
                await message.reply(`❌ Impossible d'expulser ce membre (${err.message}).`);
            }
            return true;
        }

        // --- !mute [@membre/ID/reply] [durée] [raison] ---
        if (command === '!mute') {
            const info = await extraireCibleEtReste(message, raw);
            if (info.notFoundQuery) {
                await message.reply(`❌ Membre introuvable sur le serveur avec \`${info.notFoundQuery}\`.`);
                return true;
            }

            // Cas 1 : !mute tout court (sans cible ni reply) -> sélecteur de membre
            if (!info.targetMember) {
                const sessionId = `${Date.now()}_${message.author.id}`;
                muteSessions.set(sessionId, {
                    authorId: message.author.id,
                    channelId: message.channel.id,
                    targetId: null,
                    targetTag: null,
                    targetAvatar: null,
                    raison: 'Comportement inadapté'
                });
                setTimeout(() => muteSessions.delete(sessionId), 5 * 60 * 1000);

                const selectEmbed = new EmbedBuilder()
                    .setColor(0xf39c12)
                    .setTitle('🔇 Mettre un membre en sourdine')
                    .setDescription('Sélectionne le membre à mute dans le menu ci-dessous *(ou utilise `!mute @membre 15min [raison]`)*.')
                    .setTimestamp();
                const userRow = new ActionRowBuilder().addComponents(
                    new UserSelectMenuBuilder().setCustomId(`mute_select_user_${sessionId}`).setPlaceholder('👤 Choisir le membre à mute...')
                );
                const cancelRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`mute_cancel_${sessionId}`).setLabel('❌ Annuler').setStyle(ButtonStyle.Secondary)
                );
                await message.reply({ embeds: [selectEmbed], components: [userRow, cancelRow] });
                return true;
            }

            const errHier = verifierHierarchieSanction(message.member, info.targetMember, info.targetId, { checkAction: 'mute' });
            if (errHier) {
                await message.reply(errHier);
                return true;
            }

            const maybeDur = info.resteArgs[0];
            const parsedMs = parseDurationMs(maybeDur);

            // Cas 2 : Cible donnée mais pas de durée valide -> menu contextuel de durée
            if (!parsedMs) {
                const raison = info.resteArgs.join(' ').trim() || 'Comportement inadapté';
                const sessionId = `${Date.now()}_${message.author.id}`;
                muteSessions.set(sessionId, {
                    authorId: message.author.id,
                    channelId: message.channel.id,
                    targetId: info.targetId,
                    targetTag: info.targetUser?.tag || info.targetMember.displayName,
                    targetAvatar: info.targetUser?.displayAvatarURL?.({ dynamic: true }) || null,
                    raison
                });
                setTimeout(() => muteSessions.delete(sessionId), 5 * 60 * 1000);

                const { embed, components } = buildMuteDurationPanel(sessionId);
                await message.reply({ embeds: [embed], components });
                return true;
            }

            // Cas 3 : Durée précisée -> mute instantané
            if (parsedMs < 10 * 1000 || parsedMs > 28 * 24 * 60 * 60 * 1000) {
                await message.reply('❌ La durée d\'un mute doit être comprise entre **10 secondes** et **28 jours**.');
                return true;
            }

            const raison = info.resteArgs.slice(1).join(' ').trim() || 'Comportement inadapté';
            try {
                const publicEmbed = await executerMute({
                    guild: message.guild,
                    channel: message.channel,
                    executorUser: message.author,
                    targetMember: info.targetMember,
                    durationMs: parsedMs,
                    durationLabel: formatDurationFr(parsedMs),
                    raison
                });
                await message.reply({ embeds: [publicEmbed] });
            } catch (err) {
                await message.reply(`❌ Impossible de mute ce membre (${err.message}).`);
            }
            return true;
        }

        // --- !unmute [@membre/ID/reply] [raison] ---
        if (command === '!unmute') {
            const info = await extraireCibleEtReste(message, raw);
            if (info.notFoundQuery) {
                await message.reply(`❌ Membre introuvable sur le serveur avec \`${info.notFoundQuery}\`.`);
                return true;
            }
            if (!info.targetMember) {
                const selectEmbed = new EmbedBuilder()
                    .setColor(0x2ecc71)
                    .setTitle('🔊 Retirer une sourdine')
                    .setDescription('Sélectionne le membre à démute ci-dessous *(ou utilise `!unmute @membre`)*.')
                    .setTimestamp();
                const userRow = new ActionRowBuilder().addComponents(
                    new UserSelectMenuBuilder().setCustomId(`unmute_select_user_${message.author.id}`).setPlaceholder('👤 Choisir le membre à unmute...')
                );
                await message.reply({ embeds: [selectEmbed], components: [userRow] });
                return true;
            }

            if (!info.targetMember.isCommunicationDisabled()) {
                await message.reply(`ℹ️ <@${info.targetId}> n'est pas en sourdine actuellement.`);
                return true;
            }

            const raison = info.resteArgs.join(' ').trim() || 'Levée manuelle du mute';
            try {
                await info.targetMember.timeout(null, `${raison} (par ${message.author.tag})`);
                const mpEmbed = new EmbedBuilder()
                    .setColor(0x2ecc71)
                    .setTitle('🔊 Ta sourdine sur Regaïa a été levée')
                    .setDescription(`• **Raison :** \`${raison}\``)
                    .setTimestamp();
                const mpOk = await envoyerMpSanction(info.targetMember, mpEmbed);

                const unmuteEmbed = new EmbedBuilder()
                    .setColor(0x2ecc71)
                    .setTitle('🔊 Sourdine levée')
                    .setDescription(`<@${info.targetId}> peut à nouveau parler *(démute par <@${message.author.id}>)*.`)
                    .addFields({ name: '📝 Raison', value: `\`${raison}\`` })
                    .setFooter({ text: mpOk ? '📩 Membre prévenu en MP' : '⚠️ MP fermés' })
                    .setTimestamp();
                await message.reply({ embeds: [unmuteEmbed] });

                const logEmbed = new EmbedBuilder()
                    .setColor(0x2ecc71)
                    .setTitle('🔊 Log — Unmute (!unmute)')
                    .setDescription(
                        `• **Cible :** <@${info.targetId}> (\`${info.targetId}\`)\n` +
                        `• **Modérateur :** <@${message.author.id}>\n` +
                        `• **Raison :** \`${raison}\``
                    )
                    .setTimestamp();
                await logModerationStaff(message.guild, logEmbed, { silent: true });
            } catch (err) {
                await message.reply(`❌ Impossible de démute ce membre (${err.message}).`);
            }
            return true;
        }

        // --- !warn [@membre/ID/reply] [raison] ---
        if (command === '!warn') {
            const info = await extraireCibleEtReste(message, raw, { allowOfflineId: true });
            if (info.notFoundQuery) {
                await message.reply(`❌ Membre introuvable avec \`${info.notFoundQuery}\`.`);
                return true;
            }
            if (!info.targetId) {
                const usageEmbed = new EmbedBuilder()
                    .setColor(0xf1c40f)
                    .setTitle('⚠️ Avertir un membre (!warn)')
                    .setDescription(
                        '**Usages :**\n' +
                        '• `!warn @membre [raison]`\n' +
                        '• Ou réponds directement au message du membre avec `!warn [raison]`'
                    );
                await message.reply({ embeds: [usageEmbed] });
                return true;
            }

            const errHier = verifierHierarchieSanction(message.member, info.targetMember, info.targetId);
            if (errHier) {
                await message.reply(errHier);
                return true;
            }

            const raison = info.resteArgs.join(' ').trim();
            if (!raison) {
                await message.reply('❌ Merci de préciser la raison de l\'avertissement (ex : `!warn @membre Propos déplacés`).');
                return true;
            }

            const warns = getUserWarns(info.targetId);
            const nextId = warns.reduce((max, w) => Math.max(max, Number(w.id) || 0), 0) + 1;
            const newWarn = {
                id: nextId,
                reason: raison,
                modoId: message.author.id,
                modoTag: message.author.tag,
                timestamp: Date.now(),
                expiredNotified: false
            };
            warns.push(newWarn);
            securityState.demanderSauvegarde();

            const count = warns.length;
            let sanctionLabel = 'Avertissement officiel enregistré *(aucun mute auto)*';
            let color = 0xf1c40f;

            // Application automatique selon le palier
            if (count === 2) {
                color = 0xf39c12;
                if (info.targetMember) {
                    await info.targetMember.timeout(30 * 60 * 1000, `2ème warn : ${raison}`).catch(() => {});
                    sanctionLabel = '🔇 **Mute automatique de 30 minutes** *(Palier 2/6)*';
                } else {
                    sanctionLabel = '⚠️ Palier 2/6 atteint *(membre hors serveur, mute ignoré)*';
                }
            } else if (count === 3) {
                color = 0xe67e22;
                if (info.targetMember) {
                    await info.targetMember.timeout(6 * 60 * 60 * 1000, `3ème warn : ${raison}`).catch(() => {});
                    sanctionLabel = '🔇 **Mute automatique de 6 heures** *(Palier 3/6)*';
                } else {
                    sanctionLabel = '⚠️ Palier 3/6 atteint *(membre hors serveur, mute ignoré)*';
                }
            } else if (count === 4) {
                color = 0xd35400;
                if (info.targetMember) {
                    await info.targetMember.timeout(24 * 60 * 60 * 1000, `4ème warn : ${raison}`).catch(() => {});
                    sanctionLabel = '🔇 **Mute automatique de 24 heures** *(Palier 4/6)*';
                } else {
                    sanctionLabel = '⚠️ Palier 4/6 atteint *(membre hors serveur, mute ignoré)*';
                }
            } else if (count === 5) {
                color = 0xe74c3c;
                sanctionLabel = `🚨 **Palier 5/6 atteint !** Décision envoyée à <@${message.author.id}> dans <#${MOD_CHANNEL_ID}>.`;
            } else if (count >= 6) {
                color = 0x992d22;
                sanctionLabel = '🔨 **Bannissement définitif automatique** *(Palier 6/6)*';
            }

            // MP au membre (toujours envoyé AVANT le ban du palier 6)
            const mpEmbed = new EmbedBuilder()
                .setColor(color)
                .setTitle(`⚠️ Tu as reçu un avertissement sur Regaïa (${count}/6)`)
                .setDescription(
                    `• **Raison :** \`${raison}\`\n` +
                    `• **Conséquence :** ${sanctionLabel}\n\n` +
                    `*Attention : les avertissements s'accumulent jusqu'au palier 6 (bannissement définitif).*`
                )
                .setTimestamp();
            const mpOk = await envoyerMpSanction(info.targetMember || info.targetUser, mpEmbed);

            // Exécution du ban automatique au 6ème warn
            if (count >= 6) {
                await message.guild.members.ban(info.targetId, {
                    reason: `6ème avertissement atteint (${raison}) — par ${message.author.tag}`
                }).catch(() => {});
            }

            // Échelle des paliers pour le recul immédiat
            const echelleTxt = WARN_STEPS_DESC.map((ligne, idx) => {
                const palier = idx + 1;
                if (palier === count) return `👉 ${ligne} **(Actuel)**`;
                if (palier < count) return `~~${ligne}~~`;
                return ligne;
            }).join('\n');

            const warnEmbed = new EmbedBuilder()
                .setColor(color)
                .setTitle(`⚠️ Avertissement #${newWarn.id} — ${info.targetUser?.username || info.targetId} (${count}/6)`)
                .setThumbnail(info.targetUser?.displayAvatarURL?.({ dynamic: true }) || null)
                .setDescription(
                    `• **Membre :** <@${info.targetId}> (\`${info.targetId}\`)\n` +
                    `• **Modérateur :** <@${message.author.id}>\n` +
                    `• **Motif :** \`${raison}\`\n` +
                    `• **Sanction appliquée :** ${sanctionLabel}`
                )
                .addFields(
                    { name: `📜 Historique de ses warns (${count})`, value: formatWarnsListLines(warns, newWarn.id).slice(0, 1024), inline: false },
                    { name: '📈 Échelle & Prochaines punitions', value: echelleTxt, inline: false }
                )
                .setFooter({ text: mpOk ? '📩 Membre prévenu en MP • Sauvegardé dans #json' : '⚠️ MP fermés • Sauvegardé dans #json' })
                .setTimestamp();
            await message.reply({ embeds: [warnEmbed] });

            // Palier 5 : Embed spécial NON silencieux dans MOD_CHANNEL_ID utilisable uniquement par le modo auteur
            if (count === 5) {
                const alert5Embed = new EmbedBuilder()
                    .setColor(0xe74c3c)
                    .setTitle('🚨 PALIER 5/6 ATTEINT — Décision requise !')
                    .setThumbnail(info.targetUser?.displayAvatarURL?.({ dynamic: true }) || null)
                    .setDescription(
                        `<@${info.targetId}> vient de recevoir son **5ème avertissement** pour :\n` +
                        `\`\`\`${raison}\`\`\`\n` +
                        `<@${message.author.id}>, quelle sanction veux-tu appliquer *(tu es le/la seul(e) à pouvoir utiliser ces boutons)* ?`
                    )
                    .addFields({ name: '📜 Historique complet (5/6)', value: formatWarnsListLines(warns, newWarn.id).slice(0, 1024) })
                    .setFooter({ text: 'Prochain avertissement (6/6) = Ban définitif automatique' })
                    .setTimestamp();

                const row5 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`warn5_ban_${message.author.id}_${info.targetId}`)
                        .setLabel('🔨 Bannir définitivement')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId(`warn5_kick_${message.author.id}_${info.targetId}`)
                        .setLabel('👢 Expulser')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`warn5_mute7d_${message.author.id}_${info.targetId}`)
                        .setLabel('🔇 Mute 7 jours')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`warn5_ignore_${message.author.id}_${info.targetId}`)
                        .setLabel('✅ Laisser passer')
                        .setStyle(ButtonStyle.Success)
                );

                await logModerationStaff(message.guild, alert5Embed, {
                    silent: false,
                    content: `🔔 <@${message.author.id}> — Action requise suite au 5ème warn de <@${info.targetId}> !`,
                    components: [row5]
                });
            } else {
                const logEmbed = new EmbedBuilder()
                    .setColor(color)
                    .setTitle(`⚠️ Log — Warn #${newWarn.id} (${count}/6)`)
                    .setDescription(
                        `• **Cible :** <@${info.targetId}> (\`${info.targetId}\`)\n` +
                        `• **Modérateur :** <@${message.author.id}>\n` +
                        `• **Salon :** <#${message.channel.id}>\n` +
                        `• **Raison :** \`${raison}\`\n` +
                        `• **Sanction :** ${sanctionLabel}\n` +
                        `• **MP remis :** ${mpOk ? 'Oui' : 'Non'}`
                    )
                    .setTimestamp();
                await logModerationStaff(message.guild, logEmbed, { silent: true });
            }
            return true;
        }

        // --- !warns / !casier [@membre/ID/Pseudo/reply] ---
        if (command === '!warns' || command === '!casier') {
            const info = await extraireCibleEtReste(message, raw, { allowOfflineId: true, allowSpaceUsername: true });
            if (info.notFoundQuery) {
                await message.reply(`❌ Membre introuvable avec \`${info.notFoundQuery}\`.`);
                return true;
            }
            if (!info.targetId) {
                const selectEmbed = new EmbedBuilder()
                    .setColor(0x5865f2)
                    .setTitle('📋 Consulter un casier')
                    .setDescription('Sélectionne le membre dont tu veux voir les avertissements ci-dessous *(ou utilise `!warns @membre`)*.')
                    .setTimestamp();
                const userRow = new ActionRowBuilder().addComponents(
                    new UserSelectMenuBuilder().setCustomId(`warns_select_user_${message.author.id}`).setPlaceholder('👤 Choisir un membre...')
                );
                await message.reply({ embeds: [selectEmbed], components: [userRow] });
                return true;
            }

            const warns = getUserWarns(info.targetId);
            const casierEmbed = buildWarnsCasierEmbed(info.targetMember || info.targetUser, info.targetId, warns);
            await message.reply({ embeds: [casierEmbed] });
            return true;
        }

        // --- !unwarn [@membre/ID/Pseudo/reply] [ID_warn optionnel] ---
        if (command === '!unwarn') {
            const info = await extraireCibleEtReste(message, raw, { allowOfflineId: true, allowSpaceUsername: true });
            if (info.notFoundQuery) {
                await message.reply(`❌ Membre introuvable avec \`${info.notFoundQuery}\`.`);
                return true;
            }
            if (!info.targetId) {
                const selectEmbed = new EmbedBuilder()
                    .setColor(0xe67e22)
                    .setTitle('🧹 Retirer un avertissement')
                    .setDescription('Sélectionne le membre dans le menu ci-dessous *(ou utilise `!unwarn @membre / ID / Pseudo`)*.')
                    .setTimestamp();
                const userRow = new ActionRowBuilder().addComponents(
                    new UserSelectMenuBuilder().setCustomId(`unwarn_select_user_${message.author.id}`).setPlaceholder('👤 Choisir un membre...')
                );
                await message.reply({ embeds: [selectEmbed], components: [userRow] });
                return true;
            }

            const selectedWarnId = info.resteArgs[0]?.replace('#', '') || null;
            const { embed, components } = buildUnwarnConfirmPanel(info.targetMember || info.targetUser, info.targetId, selectedWarnId, false);
            await message.reply({ embeds: [embed], components });
            return true;
        }

        // --- !slowmode [secondes / off] ---
        if (command === '!slowmode') {
            const args = raw.split(/\s+/);
            const arg = args[1]?.toLowerCase();

            if (!arg) {
                const current = message.channel.rateLimitPerUser || 0;
                const smEmbed = new EmbedBuilder()
                    .setColor(0x3498db)
                    .setTitle('🐢 Mode lent du salon')
                    .setDescription(
                        `• **Salon :** <#${message.channel.id}>\n` +
                        `• **Slowmode actuel :** ${current > 0 ? `**${formatDurationFr(current * 1000)}**` : '**Désactivé (0s)**'}\n\n` +
                        `Choisis une valeur ci-dessous ou tape \`!slowmode [secondes / off]\`.`
                    )
                    .setTimestamp();
                const menu = new StringSelectMenuBuilder()
                    .setCustomId(`slowmode_select_${message.author.id}`)
                    .setPlaceholder('🐢 Régler le slowmode...')
                    .addOptions(
                        { label: 'Désactiver (0s)', emoji: '✅', value: '0', default: current === 0 },
                        { label: '5 secondes', emoji: '🐢', value: '5', default: current === 5 },
                        { label: '10 secondes', emoji: '🐢', value: '10', default: current === 10 },
                        { label: '30 secondes', emoji: '🐢', value: '30', default: current === 30 },
                        { label: '1 minute', emoji: '🕒', value: '60', default: current === 60 },
                        { label: '5 minutes', emoji: '🕕', value: '300', default: current === 300 },
                        { label: '15 minutes', emoji: '🕛', value: '900', default: current === 900 }
                    );
                await message.reply({ embeds: [smEmbed], components: [new ActionRowBuilder().addComponents(menu)] });
                return true;
            }

            let seconds = 0;
            if (['off', 'stop', '0', 'disable'].includes(arg)) {
                seconds = 0;
            } else if (/^\d+$/.test(arg)) {
                seconds = parseInt(arg, 10);
            } else {
                const ms = parseDurationMs(arg);
                if (!ms) {
                    await message.reply('❌ Format invalide ! Exemple : `!slowmode 10`, `!slowmode 2min` ou `!slowmode off`.');
                    return true;
                }
                seconds = Math.round(ms / 1000);
            }

            if (seconds < 0 || seconds > 21600) {
                await message.reply('❌ Le slowmode Discord doit être compris entre **0** et **21600 secondes (6 heures)**.');
                return true;
            }

            await nettoyerBoutonAutoSlowmode(
                message.channel.id,
                seconds === 0
                    ? `✅ **Slowmode automatique retiré** par <@${message.author.id}> *(via \`!slowmode\`)*.`
                    : `🐢 **Slowmode automatique remplacé** par <@${message.author.id}> *(via \`!slowmode\`)*.`
            );
            await message.channel.setRateLimitPerUser(seconds, `Slowmode défini par ${message.author.tag}`).catch(() => {});
            const resEmbed = new EmbedBuilder()
                .setColor(seconds === 0 ? 0x2ecc71 : 0x3498db)
                .setTitle(seconds === 0 ? '✅ Slowmode désactivé' : '🐢 Slowmode activé')
                .setDescription(
                    seconds === 0
                        ? `Le mode lent a été retiré dans <#${message.channel.id}> par <@${message.author.id}>.`
                        : `Le mode lent est désormais de **${formatDurationFr(seconds * 1000)}** dans <#${message.channel.id}> *(par <@${message.author.id}>)*.`
                )
                .setTimestamp();
            await message.reply({ embeds: [resEmbed] });

            const logEmbed = new EmbedBuilder()
                .setColor(seconds === 0 ? 0x2ecc71 : 0x3498db)
                .setTitle('🐢 Log — Slowmode (!slowmode)')
                .setDescription(
                    `• **Salon :** <#${message.channel.id}>\n` +
                    `• **Modérateur :** <@${message.author.id}>\n` +
                    `• **Valeur :** ${seconds === 0 ? 'Désactivé' : formatDurationFr(seconds * 1000)}`
                )
                .setTimestamp();
            await logModerationStaff(message.guild, logEmbed, { silent: true });
            return true;
        }

        // --- !lock [raison] ---
        if (command === '!lock') {
            const raison = raw.split(/\s+/).slice(1).join(' ').trim() || 'Verrouillage d\'urgence par la modération';
            const everyoneRole = message.guild.roles.everyone;
            const currentOverwrite = message.channel.permissionOverwrites.cache.get(everyoneRole.id);
            if (!channelLocks.has(channelId)) {
                const prevSend = currentOverwrite
                    ? (currentOverwrite.allow.has(PermissionFlagsBits.SendMessages) ? true : currentOverwrite.deny.has(PermissionFlagsBits.SendMessages) ? false : null)
                    : null;
                channelLocks.set(channelId, prevSend);
            }

            await message.channel.permissionOverwrites.edit(everyoneRole, { SendMessages: false }, { reason: `Verrouillé par ${message.author.tag} : ${raison}` }).catch(() => {});
            await message.channel.permissionOverwrites.edit(MODO_ROLE_ID, { SendMessages: true }, { reason: 'Maintien accès modération' }).catch(() => {});

            const lockEmbed = new EmbedBuilder()
                .setColor(0xe74c3c)
                .setTitle('🔒 Salon verrouillé')
                .setDescription(`L'envoi de messages a été temporairement bloqué par <@${message.author.id}>.`)
                .addFields({ name: '📝 Raison', value: `\`${raison}\`` })
                .setTimestamp();
            const unlockBtn = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`channel_unlock_${channelId}`).setLabel('🔓 Déverrouiller').setStyle(ButtonStyle.Success)
            );
            await message.reply({ embeds: [lockEmbed], components: [unlockBtn] });

            const logEmbed = new EmbedBuilder()
                .setColor(0xe74c3c)
                .setTitle('🔒 Log — Verrouillage (!lock)')
                .setDescription(
                    `• **Salon :** <#${channelId}>\n` +
                    `• **Modérateur :** <@${message.author.id}>\n` +
                    `• **Raison :** \`${raison}\``
                )
                .setTimestamp();
            await logModerationStaff(message.guild, logEmbed, { silent: true });
            return true;
        }

        // --- !unlock ---
        if (command === '!unlock') {
            const everyoneRole = message.guild.roles.everyone;
            const prevSend = channelLocks.has(channelId) ? channelLocks.get(channelId) : null;
            channelLocks.delete(channelId);

            await message.channel.permissionOverwrites.edit(everyoneRole, { SendMessages: prevSend }, { reason: `Déverrouillé par ${message.author.tag}` }).catch(() => {});

            const unlockEmbed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle('🔓 Salon déverrouillé')
                .setDescription(`Le salon <#${channelId}> a été rouvert par <@${message.author.id}>.`)
                .setTimestamp();
            await message.reply({ embeds: [unlockEmbed] });

            const logEmbed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle('🔓 Log — Déverrouillage (!unlock)')
                .setDescription(`• **Salon :** <#${channelId}>\n• **Modérateur :** <@${message.author.id}>`)
                .setTimestamp();
            await logModerationStaff(message.guild, logEmbed, { silent: true });
            return true;
        }
    }

    // 0b. !destituation / !desti / !antimodo (Salons staff uniquement, utilisable par tout le monde sauf contre Epsys)
    if (['!destituation', '!destitution', '!desti', '!antimodo'].includes(command)) {
        if (!message.guild) {
            await message.reply("❌ Cette commande est uniquement utilisable sur le serveur.");
            return true;
        }
        if (!BANTEMP_AUTHORIZED_CHANNELS.includes(channelId)) {
            await message.reply("❌ Cette commande exceptionnelle ne peut être lancée que dans les salons du staff.");
            return true;
        }

        const info = await extraireCibleEtReste(message, raw);
        if (info.notFoundQuery) {
            await message.reply(`❌ Membre introuvable sur le serveur avec \`${info.notFoundQuery}\`.`);
            return true;
        }

        if (!info.targetMember) {
            const sessionId = `desti_${Date.now()}_${message.author.id}`;
            destiSessions.set(sessionId, {
                authorId: message.author.id,
                channelId: message.channel.id,
                messageId: message.id,
                targetId: null,
                targetTag: null,
                targetAvatar: null,
                raison: 'Comportement incompatible avec le rôle de modérateur'
            });
            setTimeout(() => destiSessions.delete(sessionId), 10 * 60 * 1000);

            const selectEmbed = new EmbedBuilder()
                .setColor(0xd63031)
                .setTitle('⚖️ Lancer un vote de destitution')
                .setDescription('Sélectionne le **modérateur** concerné dans le menu ci-dessous *(ou tape `!destituation @modo [raison]`)*.')
                .setTimestamp();
            const userRow = new ActionRowBuilder().addComponents(
                new UserSelectMenuBuilder().setCustomId(`desti_select_user_${sessionId}`).setPlaceholder('👤 Choisir le modérateur visé...')
            );
            const cancelRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`desti_cancel_${sessionId}`).setLabel('❌ Annuler').setStyle(ButtonStyle.Secondary)
            );
            await message.reply({ embeds: [selectEmbed], components: [userRow, cancelRow] });
            return true;
        }

        if (info.targetId === securityState.EPSYS_ID) {
            await message.reply("❌ Impossible de lancer un vote de destitution contre **Epsys** !");
            return true;
        }
        if (info.targetId === message.client?.user?.id) {
            await message.reply("❌ Impossible de viser Cacabot !");
            return true;
        }
        if (!estModo(info.targetMember)) {
            await message.reply(`❌ <@${info.targetId}> ne possède pas le rôle modérateur (<@&${MODO_ROLE_ID}>).`);
            return true;
        }

        const raison = info.resteArgs.join(' ').trim() || 'Comportement incompatible avec le rôle de modérateur';
        const sessionId = `desti_${Date.now()}_${message.author.id}`;
        destiSessions.set(sessionId, {
            authorId: message.author.id,
            channelId: message.channel.id,
            messageId: message.id,
            targetId: info.targetId,
            targetTag: info.targetUser?.tag || info.targetMember.displayName,
            targetAvatar: info.targetUser?.displayAvatarURL?.({ dynamic: true }) || null,
            raison
        });
        setTimeout(() => destiSessions.delete(sessionId), 10 * 60 * 1000);

        const { embed, components } = buildDestiConfirmPanel(sessionId);
        await message.reply({ embeds: [embed], components });
        return true;
    }

    // 0. !tribunal / !trib (ou !bantemp) / !archives
    if (['!tribunal', '!trib', '!bantemp', '!archives', '!archive'].includes(command)) {
        if (!estModo(message.member)) {
            await message.reply("❌ Cette commande est réservée aux modérateurs.");
            return true;
        }

        if (!BANTEMP_AUTHORIZED_CHANNELS.includes(channelId)) {
            await message.reply("❌ Cette commande ne peut être utilisée que dans les salons de modération prévus.");
            return true;
        }

        const args = raw.split(/\s+/);
        const subCommand = args[1]?.toLowerCase();

        // Distributeur automatique d'Archives (!tribunal list, !trib list, !archives, !tribunal archives)
        if (['!archives', '!archive'].includes(command) || ['list', 'liste', 'archives', 'archive'].includes(subCommand)) {
            let filter = null;
            if (['!archives', '!archive'].includes(command) && args[1]) {
                filter = args[1].replace(/[<@!>]/g, '').trim();
            } else if (args[2]) {
                filter = args[2].replace(/[<@!>]/g, '').trim();
            }

            const { embed, components } = buildArchivesView(1, filter);
            await message.reply({ embeds: [embed], components });
            return true;
        }

        // Si aucun identifiant n'est fourni pour lancer un tribunal
        if (!args[1]) {
            await message.reply(
                "⚖️ **Procédure du Tribunal de Regaïa**\n\n" +
                "**Usage :** `!tribunal [ID_DU_MEMBRE] [raison optionnelle]` (ou `!trib [ID]`)\n\n" +
                "💡 **Comment faire :**\n" +
                "1. Fais un clic droit (ou appui long sur téléphone) sur le profil du suspect ➔ **« Copier l'identifiant »**.\n" +
                "2. Tape ici : `!tribunal 123456789012345678` *(tu peux aussi mettre l'ID entre parenthèses ou son pseudo)*.\n\n" +
                "📁 **Pour consulter les archives :** `!tribunal list` (ou `!archives`)"
            );
            return true;
        }

        // Recherche par ID (avec ou sans parenthèses), mention ou pseudo
        let cible = message.mentions?.members?.first ? message.mentions.members.first() : null;
        if (!cible && args[1]) {
            cible = await trouverMembreServeur(message.guild, args[1]);
        }

        if (!cible) {
            await message.reply(
                `❌ **Membre introuvable sur le serveur avec l'identifiant / pseudo :** \`${args[1]}\`\n` +
                "Assure-toi d'avoir bien copié son identifiant numérique (17 à 20 chiffres) et que le compte est encore présent sur le serveur."
            );
            return true;
        }

        if (cible.id === message.author.id) {
            await message.reply("❌ Tu ne peux pas lancer une procédure de tribunal contre toi-même !");
            return true;
        }

        const initialReason = args.slice(2).join(' ').trim() || "Suspicion de bot / Comportement inadapté";
        const sessionId = `bt_${Date.now()}_${message.author.id}`;

        bantempSessions.set(sessionId, {
            authorId: message.author.id,
            targetId: cible.id,
            targetTag: cible.user?.tag || cible.displayName,
            mp: true,
            raison: initialReason,
            creerTicket: true
        });

        setTimeout(() => bantempSessions.delete(sessionId), 10 * 60 * 1000);

        const { embed, rows } = buildBantempConfigPanel(sessionId);
        await message.reply({ embeds: [embed], components: rows });
        return true;
    }

    // 1. !chut / !unchut
    if (command === '!chut') {
        if (!CHUT_AUTHORIZED.includes(message.author.id)) {
            await message.reply("Tu n'es pas autorisé.e à faire cette commande.");
            return true;
        }
        const args = raw.split(/\s+/);
        const timeStr = args[1]?.toLowerCase();
        let ms = 0;
        if (timeStr?.endsWith('min')) ms = parseInt(timeStr) * 60 * 1000;
        else if (timeStr?.endsWith('h')) ms = parseInt(timeStr) * 60 * 60 * 1000;
        else {
            await message.reply('Format invalide ! Utilise `!chut Xmin` ou `!chut Xh`. Ex : `!chut 10min`');
            return true;
        }
        if (isNaN(ms) || ms <= 0) { await message.reply('Durée invalide !'); return true; }
        if (ms > 24 * 60 * 60 * 1000) { await message.reply('Maximum 24h !'); return true; }

        const ancien = mutedChannels.get(channelId);
        if (ancien) clearTimeout(ancien.timeout);

        const until = Date.now() + ms;
        const timeout = setTimeout(() => mutedChannels.delete(channelId), ms);
        mutedChannels.set(channelId, { until, timeout });
        await message.react('🤐').catch(() => {});
        return true;
    }

    if (command === '!unchut') {
        if (!CHUT_AUTHORIZED.includes(message.author.id)) {
            await message.reply("Tu n'es pas autorisé.e à faire cette commande.");
            return true;
        }
        const ancien = mutedChannels.get(channelId);
        if (ancien) clearTimeout(ancien.timeout);
        mutedChannels.delete(channelId);
        await message.react('👋').catch(() => {});
        return true;
    }

    // 2. !stop / !unstop
    const stopCleaned = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const isStopTrigger = command === '!stop' || /\bcacabot\s+stop\b/.test(stopCleaned);
    const isUnstopTrigger = command === '!unstop' || /\bcacabot\s+reviens\b/.test(stopCleaned);

    if (isStopTrigger) {
        const ancien = mutedChannels.get(channelId);
        if (ancien) clearTimeout(ancien.timeout);

        const until = Date.now() + STOP_DURATION_MS;
        const timeout = setTimeout(() => mutedChannels.delete(channelId), STOP_DURATION_MS);
        mutedChannels.set(channelId, { until, timeout });
        await message.react('🤐').catch(() => {});
        return true;
    }

    if (isUnstopTrigger) {
        const ancien = mutedChannels.get(channelId);
        if (ancien) clearTimeout(ancien.timeout);
        mutedChannels.delete(channelId);
        await message.react('👋').catch(() => {});
        return true;
    }

    // 3. Anti-phishing (Faux Nitro / Vol de compte)
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
                new ButtonBuilder().setCustomId(`antiphish_ban_${message.author.id}`).setLabel('🔨 Bannir le compte piraté').setStyle(ButtonStyle.Danger)
            );
            await modChan.send({ embeds: [embedPhish], components: [banBtn] });
        }
        return true;
    }

    // 4. Slowmode d'urgence automatique (Avertissement -> Slowmode 10s pendant 5min)
    const isExemptAutoSlowmode = AUTO_SLOWMODE_EXEMPT_CHANNELS instanceof Set
        ? AUTO_SLOWMODE_EXEMPT_CHANNELS.has(message.channel.id)
        : AUTO_SLOWMODE_EXEMPT_CHANNELS.includes(message.channel.id);

    if (
        message.guild &&
        !message.author.bot &&
        message.channel.type === ChannelType.GuildText &&
        !isExemptAutoSlowmode &&
        !slowmodeActifs.has(message.channel.id) &&
        (message.channel.rateLimitPerUser || 0) < AUTO_SLOWMODE_SECONDS
    ) {
        const now = Date.now();
        const chanId = message.channel.id;
        const warnState = slowmodeWarnStates.get(chanId);
        const slowmodeMinutes = Math.round(AUTO_SLOWMODE_DURATION_MS / 60000);

        if (warnState && now - warnState.warnedAt <= AUTO_SLOWMODE_WINDOW_MS) {
            warnState.count = (warnState.count || 0) + 1;

            if (warnState.count >= AUTO_SLOWMODE_POST_WARN_THRESHOLD) {
                slowmodeWarnStates.delete(chanId);
                slowmodeTrackers.delete(chanId);
                slowmodeWarnCooldowns.delete(chanId);
                slowmodeActifs.add(chanId);

                const ancienSlowmode = message.channel.rateLimitPerUser || 0;
                await message.channel.setRateLimitPerUser(AUTO_SLOWMODE_SECONDS, 'Slowmode automatique anti-spam continu').catch(() => {});

                const stopRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`auto_slowmode_stop_${chanId}`)
                        .setLabel('🔓 Retirer le slowmode')
                        .setStyle(ButtonStyle.Secondary)
                );

                const slowmodeMsg = await message.channel.send({
                    content:
                        `🛑 **Slowmode automatique activé** : **${AUTO_SLOWMODE_SECONDS} secondes** pendant **${slowmodeMinutes} minutes** *(le spam a continué après l'avertissement)*.\n` +
                        `🛡️ *(Bouton ci-dessous réservé aux modérateurs)*`,
                    components: [stopRow],
                    flags: [MessageFlags.SuppressNotifications]
                }).catch(() => null);

                const timeout = setTimeout(async () => {
                    const session = slowmodeSessions.get(chanId);
                    if (!session) return;
                    slowmodeSessions.delete(chanId);
                    slowmodeActifs.delete(chanId);
                    slowmodeTrackers.delete(chanId);
                    slowmodeWarnStates.delete(chanId);

                    await message.channel.setRateLimitPerUser(session.ancienSlowmode, 'Fin du slowmode automatique').catch(() => {});
                    if (session.message) {
                        await session.message.edit({
                            content: `🛑 **Slowmode automatique terminé** *(les ${slowmodeMinutes} minutes sont écoulées)*.`,
                            components: []
                        }).catch(() => {});
                    }
                    await message.channel.send({
                        content: '✅ **Fin du slowmode automatique**, retour au rythme normal !',
                        flags: [MessageFlags.SuppressNotifications]
                    }).catch(() => {});
                }, AUTO_SLOWMODE_DURATION_MS);

                slowmodeSessions.set(chanId, {
                    timeout,
                    message: slowmodeMsg,
                    ancienSlowmode
                });
            }
        } else {
            if (warnState) slowmodeWarnStates.delete(chanId);

            const logs = (slowmodeTrackers.get(chanId) || []).filter(entry => now - entry.ts < AUTO_SLOWMODE_WINDOW_MS);
            logs.push({ ts: now, authorId: message.author.id });
            slowmodeTrackers.set(chanId, logs);

            const lastWarnAt = slowmodeWarnCooldowns.get(chanId) || 0;
            if (now - lastWarnAt >= AUTO_SLOWMODE_WARN_COOLDOWN_MS) {
                const countsByAuthor = new Map();
                let maxPerAuthor = 0;
                for (const entry of logs) {
                    const c = (countsByAuthor.get(entry.authorId) || 0) + 1;
                    countsByAuthor.set(entry.authorId, c);
                    if (c > maxPerAuthor) maxPerAuthor = c;
                }

                const isTargetedBurst = logs.length >= AUTO_SLOWMODE_WARN_THRESHOLD && maxPerAuthor >= AUTO_SLOWMODE_MIN_AUTHOR_MSGS;
                const isMassBurst = logs.length >= AUTO_SLOWMODE_MASS_WARN_THRESHOLD;

                if (isTargetedBurst || isMassBurst) {
                    slowmodeTrackers.delete(chanId);
                    slowmodeWarnStates.set(chanId, { warnedAt: now, count: 0 });
                    slowmodeWarnCooldowns.set(chanId, now);
                    await message.channel.send({
                        content: '**__Attention au spam__** ! Tout spam **continu** verra le salon d\'origine subir un **__slowmode__** !',
                        flags: [MessageFlags.SuppressNotifications]
                    }).catch(() => {});
                }
            }
        }
    }

    // 5. Anti-spam
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

    // 6. Anti-raid : timeout au 1er message suspect
    if (message.guild && message.member && raidFlaggedUsers.has(message.author.id)) {
        raidFlaggedUsers.delete(message.author.id);
        try {
            await message.member.timeout(RAID_TIMEOUT_MS, 'Anti-raid automatique').catch(() => {});
            raidMuteRecord.set(message.author.id, Date.now() + RAID_TIMEOUT_MS);
            await message.channel.send(`🚨 **${message.member.displayName}** fait partie d'une vague d'arrivées suspectes et a été mis en pause **5 minutes**.`);
            await message.member.send("Ton compte a été repéré dans une vague d'arrivées suspectes sur le serveur, tu as été mis.e en pause 5 minutes. Si tu quittes et reviens dans les 15 minutes qui suivent la fin de cette pause, tu seras automatiquement exclu.e du serveur.").catch(() => {});

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

    // 7. !rolereac & !rolebtn (Epsys-only)
    if (command === '!rolereac' || command === '!rr') {
        if (message.author.id !== securityState.EPSYS_ID) return true;
        const args = raw.split(/\s+/);
        const reactionRolesData = securityState.getReactionRolesData();

        if (args[1]?.toLowerCase() === 'sync' || args[1]?.toLowerCase() === 'rattrapage') {
            const m = await message.reply("🔄 Analyse des rôles-réactions et rattrapage en cours...");
            let attribues = 0;
            const touches = new Set();

            for (const [msgId, cfg] of Object.entries(reactionRolesData)) {
                if (!cfg?.channelId || !cfg?.roles) continue;
                const ch = message.guild.channels.cache.get(cfg.channelId) ?? await message.guild.channels.fetch(cfg.channelId).catch(() => null);
                if (!ch?.isTextBased()) continue;
                const msg = await ch.messages.fetch(msgId).catch(() => null);
                if (!msg) continue;

                for (const reac of msg.reactions.cache.values()) {
                    const emojiKey = reac.emoji.id ? `<:${reac.emoji.name}:${reac.emoji.id}>` : reac.emoji.name;
                    const rId = cfg.roles[emojiKey] || cfg.roles[reac.emoji.name] || (reac.emoji.id && cfg.roles[reac.emoji.id]);
                    if (!rId) continue;

                    try {
                        const users = await reac.users.fetch();
                        for (const u of users.values()) {
                            if (u.bot) continue;
                            const mem = message.guild.members.cache.get(u.id) ?? await message.guild.members.fetch(u.id).catch(() => null);
                            if (mem && !mem.roles.cache.has(rId)) {
                                await mem.roles.add(rId).catch(() => {});
                                attribues++;
                                touches.add(mem.displayName);
                            }
                        }
                    } catch (e) {}
                }
            }

            if (attribues > 0) {
                await m.edit(`✅ **Rattrapage terminé !** ${attribues} rôle(s) attribué(s) à : ${Array.from(touches).join(', ')}.`);
            } else {
                await m.edit("ℹ️ Tous les rôles-réactions sont déjà parfaitement synchronisés.");
            }
            return true;
        }

        if (args[1]?.toLowerCase() === 'copy' || args[1]?.toLowerCase() === 'duplicate') {
            const sourceId = args[2]?.replace(/^.*\/([0-9]+)$/, '$1');
            const targetId = args[3]?.replace(/^.*\/([0-9]+)$/, '$1');

            if (!sourceId || !targetId) {
                await message.reply("Usage : `!rolereac copy [ID_message_source] [ID_message_cible]`");
                return true;
            }

            const sourceConfig = reactionRolesData[sourceId];
            if (!sourceConfig || !sourceConfig.roles || Object.keys(sourceConfig.roles).length === 0) {
                await message.reply(`❌ Aucun rôle-réaction trouvé sur le message source \`${sourceId}\` !`);
                return true;
            }

            // Recherche du message de destination
            let targetMsg = await message.channel.messages.fetch(targetId).catch(() => null);
            let targetChannel = message.channel;

            if (!targetMsg && message.guild) {
                for (const ch of message.guild.channels.cache.values()) {
                    if (ch.isTextBased()) {
                        targetMsg = await ch.messages.fetch(targetId).catch(() => null);
                        if (targetMsg) { targetChannel = ch; break; }
                    }
                }
            }

            if (!targetMsg) {
                await message.reply(`❌ Message de destination \`${targetId}\` introuvable sur le serveur !`);
                return true;
            }

            // Duplication de la configuration en mémoire
            reactionRolesData[targetId] = {
                channelId: targetChannel.id,
                roles: { ...sourceConfig.roles }
            };
            securityState.demanderSauvegarde();

            // Application automatique de tous les émojis sur le nouveau message
            const emojisAppliques = [];
            for (const emojiStr of Object.keys(sourceConfig.roles)) {
                try {
                    await targetMsg.react(emojiStr);
                    emojisAppliques.push(emojiStr);
                } catch (err) {
                    console.warn(`[RoleReac Copy] Impossible de réagir avec ${emojiStr}:`, err.message);
                }
            }

            const nbRoles = Object.keys(sourceConfig.roles).length;
            await message.reply(
                `✅ **${nbRoles} rôle(s)-réaction copiés avec succès !**\n` +
                `• **Source :** \`${sourceId}\`\n` +
                `• **Destination :** [Clique ici pour voir le message](${targetMsg.url})\n` +
                `• **Émojis appliqués :** ${emojisAppliques.join(' ')}`
            );
            return true;
        }

        if (args[1]?.toLowerCase() === 'list') {
            const listMsg = Object.entries(reactionRolesData);
            if (listMsg.length === 0) { await message.reply("Aucun rôle réaction n'est configuré."); return true; }
            const lignes = listMsg.map(([mId, data]) => {
                const rolesLignes = Object.entries(data.roles).map(([em, rId]) => `• ${em} ➔ <@&${rId}>`).join('\n');
                return `📍 Message: \`${mId}\` (dans <#${data.channelId}>) :\n${rolesLignes}`;
            });
            const embed = new EmbedBuilder().setColor(0x5865f2).setTitle('🎭 Rôles Réaction Actifs').setDescription(lignes.join('\n\n'));
            await message.reply({ embeds: [embed] });
            return true;
        }

        if (args[1]?.toLowerCase() === 'remove') {
            const msgId = args[2];
            const emojiStr = args[3];
            if (!msgId || !emojiStr) { await message.reply("Usage : `!rolereac remove [ID_message] [emoji]`"); return true; }
            if (!reactionRolesData[msgId] || !reactionRolesData[msgId].roles[emojiStr]) {
                await message.reply("Ce rôle réaction n'existe pas sur ce message.");
                return true;
            }
            delete reactionRolesData[msgId].roles[emojiStr];
            if (Object.keys(reactionRolesData[msgId].roles).length === 0) delete reactionRolesData[msgId];
            securityState.demanderSauvegarde();
            await message.reply(`🗑️ Rôle réaction supprimé pour l'emoji ${emojiStr} sur le message \`${msgId}\`.`);
            return true;
        }

        if (args.length < 4) {
            await message.reply("Usage :\n• Ajouter : `!rolereac [ID_message] [emoji] [@rôle / ID_rôle]`\n• Retirer : `!rolereac remove [ID_message] [emoji]`\n• Liste : `!rolereac list`");
            return true;
        }

        const msgId = args[1];
        const emojiStr = args[2];
        const roleId = args[3].replace(/<@&|>/g, '');
        const role = message.guild?.roles.cache.get(roleId);
        if (!role) { await message.reply("Rôle introuvable ! Vérifie la mention ou l'ID."); return true; }

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

        if (!targetMsg) { await message.reply("Message introuvable sur le serveur !"); return true; }
        await targetMsg.react(emojiStr).catch(() => {});

        if (!reactionRolesData[msgId]) reactionRolesData[msgId] = { channelId: targetChannel.id, roles: {} };
        reactionRolesData[msgId].roles[emojiStr] = role.id;
        securityState.demanderSauvegarde();

        await message.delete().catch(() => {});
        await message.channel.send(`✅ Rôle réaction configuré : ${emojiStr} donnera le rôle **${role.name}** sur le message [clique ici](${targetMsg.url}) !`);
        return true;
    }

    if (command === '!rolebtn' || command === '!btnrole') {
        if (message.author.id !== securityState.EPSYS_ID) return true;
        const args = raw.split(/\s+/);
        const sub = args[1]?.toLowerCase();

        if (sub !== 'add' && sub !== 'remove') {
            await message.reply(
                "**Usage :**\n" +
                "• **Ajouter un bouton :** `!rolebtn add [ID_message] [@rôle] [couleur optionnelle] [Texte avec ou sans emoji]`\n" +
                "• **Supprimer un bouton :** `!rolebtn remove [ID_message] [@rôle]`\n\n" +
                "*Couleurs disponibles : bleu, vert, rouge, gris...*"
            );
            return true;
        }

        const msgId = args[2];
        const roleId = args[3]?.replace(/<@&|>/g, '');
        const role = message.guild?.roles.cache.get(roleId);
        if (!msgId || !role) { await message.reply("Paramètres manquants ou rôle introuvable !"); return true; }

        let targetMsg = await message.channel.messages.fetch(msgId).catch(() => null);
        if (!targetMsg && message.guild) {
            for (const ch of message.guild.channels.cache.values()) {
                if (ch.isTextBased()) {
                    targetMsg = await ch.messages.fetch(msgId).catch(() => null);
                    if (targetMsg) break;
                }
            }
        }

        if (!targetMsg) { await message.reply("Message introuvable !"); return true; }
        if (targetMsg.author.id !== securityState.client?.user.id) {
            await message.reply("Je ne peux modifier que mes propres messages !");
            return true;
        }

        if (sub === 'remove') {
            const rows = targetMsg.components.map(row => {
                const newRow = ActionRowBuilder.from(row);
                newRow.setComponents(row.components.filter(c => c.customId !== `rolebtn_${role.id}`));
                return newRow;
            }).filter(row => row.components.length > 0);

            await targetMsg.edit({ components: rows }).catch(() => {});
            await message.delete().catch(() => {});
            await message.channel.send(`🗑️ Bouton pour **${role.name}** retiré !`);
            return true;
        }

        let resteArgs = args.slice(4);
        let style = ButtonStyle.Secondary;
        const couleurMap = {
            bleu: ButtonStyle.Primary, mauve: ButtonStyle.Primary,
            vert: ButtonStyle.Success, rouge: ButtonStyle.Danger,
            gris: ButtonStyle.Secondary
        };

        if (resteArgs[0] && couleurMap[resteArgs[0].toLowerCase()]) {
            style = couleurMap[resteArgs[0].toLowerCase()];
            resteArgs.shift();
        }

        let texteBrut = resteArgs.join(' ').trim() || role.name;
        let emoji = null, label = texteBrut;
        const emojiMatch = texteBrut.match(/^((?:<a?:\w+:\d+>|\p{Extended_Pictographic}\uFE0F?))\s*(.*)$/u);
        if (emojiMatch) {
            emoji = emojiMatch[1];
            label = emojiMatch[2].trim() || role.name;
        }

        const newBtn = new ButtonBuilder().setCustomId(`rolebtn_${role.id}`).setStyle(style);
        if (label) newBtn.setLabel(label);
        if (emoji) newBtn.setEmoji(emoji);

        const rows = targetMsg.components.map(r => ActionRowBuilder.from(r));
        let placeTrouvee = false;

        for (const row of rows) {
            const index = row.components.findIndex(c => c.data.custom_id === `rolebtn_${role.id}`);
            if (index !== -1) {
                row.components[index] = newBtn;
                placeTrouvee = true;
                break;
            }
        }

        if (!placeTrouvee) {
            let derniereLigne = rows[rows.length - 1];
            if (derniereLigne && derniereLigne.components.length < 5) derniereLigne.addComponents(newBtn);
            else if (rows.length < 5) rows.push(new ActionRowBuilder().addComponents(newBtn));
            else { await message.reply("Limite de 25 boutons atteinte !"); return true; }
        }

        await targetMsg.edit({ components: rows }).catch(() => {});
        await message.delete().catch(() => {});
        await message.channel.send(`✅ Bouton de rôle pour **${role.name}** ajouté !`);
        return true;
    }

    return false;
}

// =========================
//    INTERACTIONS (Boutons Mod & Rôles)
// =========================

async function handleSecurityInteraction(interaction) {
    // ==========================================
    //    TRIBUNAL : CONFIGURATION PAR LE MODO
    // ==========================================

    // Choix du membre depuis le menu déroulant natif Discord
    if (interaction.isUserSelectMenu() && interaction.customId.startsWith('bt_select_user_')) {
        const authorId = interaction.customId.replace('bt_select_user_', '');
        if (interaction.user.id !== authorId) {
            return interaction.reply({ content: "❌ Seul le modérateur ayant lancé la commande peut sélectionner le membre.", ephemeral: true });
        }

        const selectedUserId = interaction.values[0];
        if (selectedUserId === interaction.user.id) {
            return interaction.reply({ content: "❌ Tu ne peux pas lancer une procédure contre toi-même !", ephemeral: true });
        }

        const cible = interaction.guild?.members?.cache?.get(selectedUserId) ?? await interaction.guild?.members?.fetch(selectedUserId).catch(() => null);
        if (!cible) {
            return interaction.reply({ content: "❌ Membre introuvable sur le serveur.", ephemeral: true });
        }

        const sessionId = `bt_${Date.now()}_${interaction.user.id}`;
        bantempSessions.set(sessionId, {
            authorId: interaction.user.id,
            targetId: cible.id,
            targetTag: cible.user?.tag || cible.displayName,
            mp: true,
            raison: "Suspicion de bot / Comportement inadapté",
            creerTicket: true
        });

        setTimeout(() => bantempSessions.delete(sessionId), 10 * 60 * 1000);

        const { embed, rows } = buildBantempConfigPanel(sessionId);
        await interaction.update({ content: null, embeds: [embed], components: rows });
        return true;
    }

    // Boutons de bascule (MP, Ticket)
    if (interaction.isButton() && (interaction.customId.startsWith('bt_toggle_mp_') || interaction.customId.startsWith('bt_toggle_ticket_'))) {
        const isMp = interaction.customId.startsWith('bt_toggle_mp_');
        const sessionId = interaction.customId.replace(isMp ? 'bt_toggle_mp_' : 'bt_toggle_ticket_', '');
        const session = bantempSessions.get(sessionId);

        if (!session) return interaction.reply({ content: "❌ Cette session a expiré.", ephemeral: true });
        if (interaction.user.id !== session.authorId) {
            return interaction.reply({ content: "❌ Seul le modérateur ayant lancé la commande peut modifier ces options.", ephemeral: true });
        }

        if (isMp) session.mp = !session.mp;
        else session.creerTicket = !session.creerTicket;

        const { embed, rows } = buildBantempConfigPanel(sessionId);
        await interaction.update({ embeds: [embed], components: rows });
        return true;
    }

    // Bouton pour ouvrir la modale de raison
    if (interaction.isButton() && interaction.customId.startsWith('bt_set_reason_')) {
        const sessionId = interaction.customId.replace('bt_set_reason_', '');
        const session = bantempSessions.get(sessionId);

        if (!session) return interaction.reply({ content: "❌ Cette session a expiré.", ephemeral: true });
        if (interaction.user.id !== session.authorId) {
            return interaction.reply({ content: "❌ Seul le modérateur ayant lancé la commande peut modifier ces options.", ephemeral: true });
        }

        const modal = new ModalBuilder()
            .setCustomId(`bt_modal_reason_${sessionId}`)
            .setTitle('📝 Raison de la procédure');

        const reasonInput = new TextInputBuilder()
            .setCustomId('reason_text')
            .setLabel('Précise la raison ou choisis une suggestion')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Ex : Suspicion de bot / Raid / Insultes / Non-respect du règlement...')
            .setValue(session.raison || '')
            .setRequired(true)
            .setMaxLength(500);

        modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
        await interaction.showModal(modal);
        return true;
    }

    // Réception de la modale de raison
    if (interaction.isModalSubmit() && interaction.customId.startsWith('bt_modal_reason_')) {
        const sessionId = interaction.customId.replace('bt_modal_reason_', '');
        const session = bantempSessions.get(sessionId);

        if (!session) return interaction.reply({ content: "❌ Cette session a expiré.", ephemeral: true });
        session.raison = interaction.fields.getTextInputValue('reason_text').trim() || "Suspicion de bot / Comportement inadapté";

        const { embed, rows } = buildBantempConfigPanel(sessionId);
        await interaction.update({ embeds: [embed], components: rows });
        return true;
    }

    // Bouton Annuler
    if (interaction.isButton() && interaction.customId.startsWith('bt_cancel_')) {
        const sessionId = interaction.customId.replace('bt_cancel_', '');
        const session = bantempSessions.get(sessionId);

        if (!session) return interaction.reply({ content: "❌ Cette session a expiré.", ephemeral: true });
        if (interaction.user.id !== session.authorId) {
            return interaction.reply({ content: "❌ Seul le modérateur ayant lancé la commande peut annuler.", ephemeral: true });
        }

        bantempSessions.delete(sessionId);
        await interaction.update({ content: "❌ **Procédure de tribunal annulée.**", embeds: [], components: [] });
        return true;
    }

    // Bouton Confirmer : Isolement + Création de salon + MP
    if (interaction.isButton() && interaction.customId.startsWith('bt_confirm_')) {
        const sessionId = interaction.customId.replace('bt_confirm_', '');
        const session = bantempSessions.get(sessionId);

        if (!session) return interaction.reply({ content: "❌ Cette session a expiré.", ephemeral: true });
        if (interaction.user.id !== session.authorId) {
            return interaction.reply({ content: "❌ Seul le modérateur ayant lancé la commande peut confirmer.", ephemeral: true });
        }

        await interaction.update({ content: "⏳ **Mise en place de la procédure et isolement en cours...**", embeds: [], components: [] });

        const targetMember = await interaction.guild.members.fetch(session.targetId).catch(() => null);
        if (!targetMember) {
            await interaction.editReply({ content: "❌ Le membre est introuvable sur le serveur (il a peut-être quitté)." });
            bantempSessions.delete(sessionId);
            return true;
        }

        // 1. Sauvegarde des rôles initiaux et isolement vers le rôle Tribunal
        const rolesSauvegardes = targetMember.roles.cache
            .filter(r => r.id !== interaction.guild.id && !r.managed && r.id !== ROLE_TRIBUNAL_ID)
            .map(r => r.id);

        tribunalSavedRoles.set(session.targetId, rolesSauvegardes);

        try {
            if (rolesSauvegardes.length > 0) {
                await targetMember.roles.remove(rolesSauvegardes, 'Isolement Tribunal de modération').catch(() => {});
            }
            await targetMember.roles.add(ROLE_TRIBUNAL_ID, 'Attribution rôle Tribunal').catch(() => {});
        } catch (e) {
            console.error('[Tribunal] Erreur rôles:', e);
        }

        // 2. Création du salon spécial dans la catégorie Modération
        let salonTribunal = null;
        if (session.creerTicket) {
            const rawName = targetMember.user?.username || targetMember.displayName || 'membre';
            const safeName = rawName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_-]/g, '').slice(0, 20) || 'membre';
            const channelName = `⚖️・tribunal-${safeName}`;

            try {
                salonTribunal = await interaction.guild.channels.create({
                    name: channelName,
                    type: ChannelType.GuildText,
                    parent: CATEGORIE_MODERATION_ID,
                    permissionOverwrites: [
                        {
                            id: interaction.guild.id, // @everyone masqué
                            deny: [PermissionFlagsBits.ViewChannel]
                        },
                        {
                            id: MODO_ROLE_ID, // Rôle Modération
                            allow: [
                                PermissionFlagsBits.ViewChannel,
                                PermissionFlagsBits.SendMessages,
                                PermissionFlagsBits.ReadMessageHistory,
                                PermissionFlagsBits.AttachFiles,
                                PermissionFlagsBits.EmbedLinks
                            ]
                        },
                        {
                            id: session.targetId, // Le membre concerné (autorisé explicitement)
                            allow: [
                                PermissionFlagsBits.ViewChannel,
                                PermissionFlagsBits.SendMessages,
                                PermissionFlagsBits.ReadMessageHistory,
                                PermissionFlagsBits.AttachFiles,
                                PermissionFlagsBits.EmbedLinks
                            ]
                        },
                        {
                            id: interaction.client.user.id, // Cacabot
                            allow: [
                                PermissionFlagsBits.ViewChannel,
                                PermissionFlagsBits.SendMessages,
                                PermissionFlagsBits.ReadMessageHistory,
                                PermissionFlagsBits.ManageChannels
                            ]
                        }
                    ]
                });

                // Premier message dans le salon avec boutons de résolution
                const embedTribunal = new EmbedBuilder()
                    .setColor(0xe03131)
                    .setTitle('⚖️ AUDITION DU TRIBUNAL DE REGAÏA')
                    .setDescription(
                        `Bonjour <@${session.targetId}>,\n\n` +
                        `Tu as été temporairement placé.e dans ce salon d'audition réservé à la modération.\n` +
                        `Ce salon permet d'éclaircir la situation (suspicion de bot ou souci de comportement) afin de décider avec l'équipe si tu réintègres le serveur.`
                    )
                    .addFields(
                        { name: '📋 Raison invoquée', value: `\`\`\`${session.raison}\`\`\``, inline: false },
                        { name: '🛡️ Modérateur responsable', value: `<@${interaction.user.id}>`, inline: true },
                        { name: '📌 Consignes pour le membre', value: 'Merci de répondre aux questions des modérateurs ci-dessous pour lever les doutes.', inline: false }
                    )
                    .setFooter({ text: 'Dès que le cas est résolu, utilisez les boutons ci-dessous pour statuer.' })
                    .setTimestamp();

                const rowVerdict = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`tribunal_innocent_${session.targetId}`)
                        .setLabel('✅ Innocenter / Réintégrer')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`tribunal_ban_${session.targetId}`)
                        .setLabel('🔨 Bannir définitivement')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId(`tribunal_kick_${session.targetId}`)
                        .setLabel('👢 Expulser (Kick)')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`tribunal_close_${session.targetId}`)
                        .setLabel('🗑️ Fermer le salon')
                        .setStyle(ButtonStyle.Secondary)
                );

                await salonTribunal.send({
                    content: `🔔 <@${session.targetId}> | <@&${MODO_ROLE_ID}>`,
                    embeds: [embedTribunal],
                    components: [rowVerdict]
                });

                // Enregistrement du salon actif pour la surveillance des départs et l'archivage
                tribunalActiveCases.set(session.targetId, {
                    channelId: salonTribunal.id,
                    targetTag: session.targetTag,
                    raison: session.raison,
                    modoId: interaction.user.id,
                    modoTag: interaction.user.tag,
                    openedAt: Date.now()
                });
            } catch (err) {
                console.error('[Tribunal] Erreur création salon:', err);
            }
        }

        // 3. Notification en MP (si demandée)
        if (session.mp) {
            const lienSalon = salonTribunal ? `https://discord.com/channels/${interaction.guild.id}/${salonTribunal.id}` : '';
            const msgMp = salonTribunal
                ? `Tu fais l'objet d'une procédure de modération sur Regaïa, un salon privé a été ouvert : ${lienSalon} (<#${salonTribunal.id}>)\n\n**Raison :** ${session.raison}`
                : `Tu fais l'objet d'une procédure de modération sur Regaïa.\n\n**Raison :** ${session.raison}`;

            await targetMember.send(msgMp).catch(() => {
                if (salonTribunal) {
                    salonTribunal.send("ℹ️ *Les MP du membre sont désactivés ou fermés, le message privé n'a pas pu lui être remis.*").catch(() => {});
                }
            });
        }

        // 4. Rapport final dans le salon de commande modo
        await interaction.editReply({
            content:
                `✅ **Procédure du Tribunal initiée avec succès pour <@${session.targetId}> !**\n` +
                `• **Rôle Tribunal :** attribué\n` +
                `• **MP envoyé :** ${session.mp ? 'Oui' : 'Non'}\n` +
                `• **Salon d'audition :** ${salonTribunal ? `<#${salonTribunal.id}>` : '*Désactivé*'}`
        });

        bantempSessions.delete(sessionId);
        return true;
    }

    // ==========================================
    //    TRIBUNAL : VERDICTS DANS LE SALON
    // ==========================================
    if (interaction.isButton() && interaction.customId.startsWith('tribunal_')) {
        if (!estModo(interaction.member)) {
            return interaction.reply({ content: "❌ Seuls les modérateurs peuvent utiliser ces boutons.", ephemeral: true });
        }

        const [, action, targetId] = interaction.customId.split('_');
        const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);

        if (action === 'innocent') {
            await interaction.deferReply();
            const caseInfo = tribunalActiveCases.get(targetId);
            await genererEtSauvegarderTranscript({
                channel: interaction.channel,
                targetId: targetId,
                targetTag: targetMember?.displayName || caseInfo?.targetTag || 'Membre',
                decision: 'Innocenté.e & Réintégré.e',
                verdictEmoji: '✅',
                modoUser: interaction.user,
                guild: interaction.guild
            });
            tribunalActiveCases.delete(targetId);
            if (targetMember) {
                // Retrait du rôle tribunal
                await targetMember.roles.remove(ROLE_TRIBUNAL_ID, 'Innocenté.e par le Tribunal').catch(() => {});
                // Restauration des anciens rôles
                const savedRoles = tribunalSavedRoles.get(targetId) || [];
                if (savedRoles.length > 0) {
                    await targetMember.roles.add(savedRoles, 'Rétablissement suite au Tribunal').catch(() => {});
                }
                tribunalSavedRoles.delete(targetId);

                await targetMember.send("✅ La procédure de modération à ton encontre sur Regaïa est terminée : tu as été innocenté.e et tes accès ont été rétablis. Bon retour parmi nous !").catch(() => {});
            }

            await interaction.editReply("✅ **Le/la membre a été innocenté et réintégré avec succès.**\nAudition archivée en `.txt` dans les logs staff.\nCe salon sera supprimé automatiquement dans **5 secondes**...");
            setTimeout(() => {
                interaction.channel.delete("Clôture Tribunal : membre innocenté").catch(() => {});
            }, 5000);
            return true;
        }

        if (action === 'ban') {
            await interaction.deferReply();
            const caseInfo = tribunalActiveCases.get(targetId);
            await genererEtSauvegarderTranscript({
                channel: interaction.channel,
                targetId: targetId,
                targetTag: targetMember?.displayName || caseInfo?.targetTag || 'Membre',
                decision: 'Banni.e définitivement',
                verdictEmoji: '🔨',
                modoUser: interaction.user,
                guild: interaction.guild
            });
            tribunalActiveCases.delete(targetId);
            try {
                await interaction.guild.members.ban(targetId, {
                    reason: `Décision du Tribunal de modération par ${interaction.user.tag}`
                });
                tribunalSavedRoles.delete(targetId);
                await interaction.editReply(`🔨 **<@${targetId}> a été banni.e définitivement.**\nAudition archivée en \`.txt\` dans les logs staff.\nCe salon sera supprimé automatiquement dans **5 secondes**...`);
            } catch (err) {
                await interaction.editReply(`❌ Impossible de bannir ce.tte membre (${err.message}).`);
                return true;
            }
            setTimeout(() => {
                interaction.channel.delete("Clôture Tribunal : membre banni").catch(() => {});
            }, 5000);
            return true;
        }

        if (action === 'kick') {
            await interaction.deferReply();
            const caseInfo = tribunalActiveCases.get(targetId);
            await genererEtSauvegarderTranscript({
                channel: interaction.channel,
                targetId: targetId,
                targetTag: targetMember?.displayName || caseInfo?.targetTag || 'Membre',
                decision: 'Expulsé.e (Kick)',
                verdictEmoji: '👢',
                modoUser: interaction.user,
                guild: interaction.guild
            });
            tribunalActiveCases.delete(targetId);
            if (targetMember) {
                try {
                    await targetMember.kick(`Décision du Tribunal de modération par ${interaction.user.tag}`);
                    tribunalSavedRoles.delete(targetId);
                    await interaction.editReply(`👢 **<@${targetId}> a été expulsé.e du serveur.**\nAudition archivée en \`.txt\` dans les logs staff.\nCe salon sera supprimé automatiquement dans **5 secondes**...`);
                } catch (err) {
                    await interaction.editReply(`❌ Impossible d'expulser ce.tte membre (${err.message}).`);
                    return true;
                }
            } else {
                await interaction.editReply("ℹ️ Le/la membre n'est déjà plus sur le serveur.\nAudition archivée en `.txt` dans les logs staff.\nSuppression du salon dans **5 secondes**...");
            }
            setTimeout(() => {
                interaction.channel.delete("Clôture Tribunal : membre expulsé").catch(() => {});
            }, 5000);
            return true;
        }

        if (action === 'close') {
            // Vérification si le membre est toujours sur le serveur
            const cibleActuelle = await interaction.guild.members.fetch(targetId).catch(() => null);

            // Si le membre est encore là et possède toujours le rôle Tribunal : on bloque fermement la fermeture
            if (cibleActuelle && cibleActuelle.roles.cache.has(ROLE_TRIBUNAL_ID)) {
                const nomMembre = cibleActuelle.displayName || cibleActuelle.user?.username || 'ce membre';
                return interaction.reply({
                    content: `⚠️ <@${interaction.user.id}> **Action impossible !** Le salon ne peut être fermé, car <@${targetId}> est toujours dans ce salon. Si le salon se ferme, **${nomMembre}** n'aura aucune permission pour avoir accès à l'ensemble du serveur !`,
                    allowedMentions: { users: [interaction.user.id] }
                });
            }

            // Si le membre n'a plus le rôle tribunal ou a quitté le serveur, on autorise la fermeture
            await interaction.reply("🗑️ **Archivage et fermeture du salon tribunal en cours...**");
            const caseInfo = tribunalActiveCases.get(targetId);
            await genererEtSauvegarderTranscript({
                channel: interaction.channel,
                targetId: targetId,
                targetTag: cibleActuelle?.displayName || caseInfo?.targetTag || 'Membre',
                decision: 'Fermé manuellement',
                verdictEmoji: '🗑️',
                modoUser: interaction.user,
                guild: interaction.guild
            });
            tribunalActiveCases.delete(targetId);
            tribunalSavedRoles.delete(targetId);
            setTimeout(() => {
                interaction.channel.delete(`Fermé manuellement par ${interaction.user.tag}`).catch(() => {});
            }, 2000);
            return true;
        }
    }

    // Bouton de fermeture automatique si le membre a quitté le serveur
    if (interaction.isButton() && interaction.customId.startsWith('tribunal_force_close_')) {
        if (!estModo(interaction.member)) {
            return interaction.reply({ content: "❌ Seuls les modérateurs peuvent utiliser ce bouton.", ephemeral: true });
        }
        const targetId = interaction.customId.replace('tribunal_force_close_', '');
        await interaction.reply("🗑️ **Archivage et suppression automatique du salon tribunal en cours...**");
        const caseInfo = tribunalActiveCases.get(targetId);
        await genererEtSauvegarderTranscript({
            channel: interaction.channel,
            targetId: targetId,
            targetTag: caseInfo?.targetTag || 'Membre absent',
            decision: 'Départ / Expulsion externe',
            verdictEmoji: '⚠️',
            modoUser: interaction.user,
            guild: interaction.guild
        });
        tribunalActiveCases.delete(targetId);
        tribunalSavedRoles.delete(targetId);
        setTimeout(() => {
            interaction.channel.delete(`Fermeture automatique après départ par ${interaction.user.tag}`).catch(() => {});
        }, 2000);
        return true;
    }

    // ==========================================
    //    ARCHIVES DU TRIBUNAL : NAVIGATION & SÉLECTION
    // ==========================================
    // Changement de page dans la liste des archives
    if (interaction.isButton() && interaction.customId.startsWith('arch_page_')) {
        if (!estModo(interaction.member)) {
            return interaction.reply({ content: "❌ Seuls les modérateurs peuvent naviguer dans les archives.", ephemeral: true });
        }

        const parts = interaction.customId.split('_');
        const targetPage = parseInt(parts[2], 10) || 1;
        const filter = parts.slice(3).join('_');
        const filterTargetId = (filter === 'all' || !filter) ? null : filter;

        const { embed, components } = buildArchivesView(targetPage, filterTargetId);
        await interaction.update({ embeds: [embed], components });
        return true;
    }

    // Sélection d'une archive dans le menu contextuel
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('arch_select_')) {
        if (!estModo(interaction.member)) {
            return interaction.reply({ content: "❌ Seuls les modérateurs peuvent consulter les archives.", ephemeral: true });
        }

        const selectedId = parseInt(interaction.values[0], 10);
        const archives = chargerArchives();
        const archive = archives.find(a => a.id === selectedId);

        if (!archive) {
            return interaction.reply({ content: `❌ Dossier #${selectedId} introuvable dans l'index.`, ephemeral: true });
        }

        const filePath = path.join(ARCHIVES_DIR, archive.fileName);
        if (!fs.existsSync(filePath)) {
            return interaction.reply({ content: `❌ Le fichier texte \`${archive.fileName}\` est introuvable sur le disque.`, ephemeral: true });
        }

        await interaction.deferReply();

        const recap = new EmbedBuilder()
            .setColor(0x00b894)
            .setTitle(`📄 Retranscription du Dossier #${archive.id} — Tribunal`)
            .setDescription(
                `Voici la retranscription demandée par <@${interaction.user.id}> :\n\n` +
                `• **Accusé(e) :** \`${archive.targetTag}\` (<@${archive.targetId}>)\n` +
                `• **Date de clôture :** \`${archive.date}\`\n` +
                `• **Verdict :** ${archive.verdictEmoji || '⚖️'} **${archive.decision}**\n` +
                `• **Modérateur :** <@${archive.modoId}>\n` +
                `• **Motif initial :** \`${archive.raison}\`\n` +
                `• **Messages enregistrés :** \`${archive.messageCount || 0}\`\n\n` +
                `📎 *Le fichier .txt complet est attaché ci-dessous :*`
            )
            .setFooter({ text: 'Tribunal de Regaïa • Système d’archivage' })
            .setTimestamp();

        const attachment = new AttachmentBuilder(filePath, { name: archive.fileName });

        await interaction.editReply({
            embeds: [recap],
            files: [attachment]
        });
        return true;
    }

    // Bouton de rôle interactif
    if (interaction.isButton() && interaction.customId.startsWith('rolebtn_')) {
        const roleId = interaction.customId.replace('rolebtn_', '');
        const role = interaction.guild?.roles.cache.get(roleId);
        if (!role) return interaction.reply({ content: "❌ Ce rôle n'existe plus !", ephemeral: true });

        const member = interaction.member;
        if (member.roles.cache.has(roleId)) {
            return interaction.reply({ content: `Tu as déjà le rôle **${role.name}** !`, ephemeral: true });
        } else {
            await member.roles.add(roleId).catch(() => {});
            return interaction.reply({ content: `✅ Tu as reçu le rôle **${role.name}** !`, ephemeral: true });
        }
    }

    // Actions de modération sur les comptes récents
    if (interaction.isButton() && interaction.customId.startsWith('mod_action_')) {
        if (!estModo(interaction.member) && !interaction.member.permissions.has('KickMembers')) {
            return interaction.reply({ content: "Permission insuffisante.", ephemeral: true });
        }

        const parts = interaction.customId.split('_');
        const action = parts[2];
        const targetId = parts[3];

        if (action === 'dismiss') {
            await interaction.message.edit({ components: [] }).catch(() => {});
            return interaction.reply(`✅ Alerte classée sans suite pour <@${targetId}>.`);
        }

        if (action === 'kick') {
            const cible = await interaction.guild.members.fetch(targetId).catch(() => null);
            if (!cible) return interaction.reply({ content: "Membre déjà parti.", ephemeral: true });
            await cible.kick(`Expulsé par ${interaction.user.tag}`)
                .then(async () => {
                    await interaction.message.edit({ components: [] }).catch(() => {});
                    interaction.reply(`👢 <@${targetId}> expulsé.e du serveur.`);
                })
                .catch(() => interaction.reply({ content: "Impossible d'expulser ce membre.", ephemeral: true }));
            return;
        }

        if (action === 'ban') {
            await interaction.guild.members.ban(targetId, { reason: `Banni par ${interaction.user.tag}` })
                .then(async () => {
                    await interaction.message.edit({ components: [] }).catch(() => {});
                    interaction.reply(`🔨 <@${targetId}> banni.e définitivement.`);
                })
                .catch(() => interaction.reply({ content: "Impossible de bannir ce membre.", ephemeral: true }));
            return;
        }
    }

    // ==========================================
    //    MODÉRATION DIRECTE (!bannir, !kick, !mute, !warn, !unwarn, !slowmode, !lock)
    // ==========================================

    // --- Bouton Fermer générique sur annonce de ban (supprime embed + message !bannir du modo) ---
    if (interaction.isButton() && interaction.customId.startsWith('mod_close_')) {
        const parts = interaction.customId.split('_');
        const authorId = parts[2];
        const originalMsgId = parts[3] || '';
        if (interaction.user.id !== authorId && interaction.user.id !== securityState.EPSYS_ID) {
            return interaction.reply({ content: "❌ Seul le modérateur ayant lancé la commande (ou Epsys) peut fermer ce message.", ephemeral: true });
        }
        await interaction.message.delete().catch(() => {});
        if (originalMsgId) {
            const origMsg = await interaction.channel?.messages?.fetch(originalMsgId).catch(() => null);
            if (origMsg) await origMsg.delete().catch(() => {});
        }
        return true;
    }

    // --- !bannir : Sélection de membre depuis menu utilisateur ---
    if (interaction.isUserSelectMenu() && interaction.customId.startsWith('ban_select_user_')) {
        const sessionId = interaction.customId.replace('ban_select_user_', '');
        const session = banSessions.get(sessionId);
        if (!session) return interaction.reply({ content: "❌ Cette session a expiré.", ephemeral: true });
        if (interaction.user.id !== session.authorId) return interaction.reply({ content: "❌ Ce menu ne t'appartient pas.", ephemeral: true });

        const targetId = interaction.values[0];
        const targetMember = interaction.guild.members.cache.get(targetId) ?? await interaction.guild.members.fetch(targetId).catch(() => null);
        const errHier = verifierHierarchieSanction(interaction.member, targetMember, targetId, { checkAction: 'ban' });
        if (errHier) return interaction.reply({ content: errHier, ephemeral: true });

        session.targetId = targetId;
        session.targetTag = targetMember?.user?.tag || targetMember?.displayName || targetId;
        session.targetAvatar = targetMember?.user?.displayAvatarURL?.({ dynamic: true }) || null;

        const { embed, components } = buildBanConfirmPanel(sessionId);
        await interaction.update({ embeds: [embed], components });
        return true;
    }

    // --- !bannir : Choix durée de purge ---
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('ban_purge_')) {
        const sessionId = interaction.customId.replace('ban_purge_', '');
        const session = banSessions.get(sessionId);
        if (!session) return interaction.reply({ content: "❌ Cette session a expiré.", ephemeral: true });
        if (interaction.user.id !== session.authorId) return interaction.reply({ content: "❌ Seul l'auteur de la commande peut modifier cette option.", ephemeral: true });

        session.purgeSeconds = parseInt(interaction.values[0], 10) || 0;
        const { embed, components } = buildBanConfirmPanel(sessionId);
        await interaction.update({ embeds: [embed], components });
        return true;
    }

    // --- !bannir : Modale modifier la raison ---
    if (interaction.isButton() && interaction.customId.startsWith('ban_reason_')) {
        const sessionId = interaction.customId.replace('ban_reason_', '');
        const session = banSessions.get(sessionId);
        if (!session) return interaction.reply({ content: "❌ Cette session a expiré.", ephemeral: true });
        if (interaction.user.id !== session.authorId) return interaction.reply({ content: "❌ Seul l'auteur de la commande peut modifier la raison.", ephemeral: true });

        const modal = new ModalBuilder().setCustomId(`ban_modal_reason_${sessionId}`).setTitle('📝 Raison du bannissement');
        const input = new TextInputBuilder()
            .setCustomId('reason_text')
            .setLabel('Précise la raison du bannissement')
            .setStyle(TextInputStyle.Paragraph)
            .setValue(session.raison || '')
            .setRequired(true)
            .setMaxLength(400);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
        return true;
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('ban_modal_reason_')) {
        const sessionId = interaction.customId.replace('ban_modal_reason_', '');
        const session = banSessions.get(sessionId);
        if (!session) return interaction.reply({ content: "❌ Cette session a expiré.", ephemeral: true });
        session.raison = interaction.fields.getTextInputValue('reason_text').trim() || 'Aucune raison précisée';
        const { embed, components } = buildBanConfirmPanel(sessionId);
        await interaction.update({ embeds: [embed], components });
        return true;
    }

    // --- !bannir : Annuler / Confirmer ---
    if (interaction.isButton() && interaction.customId.startsWith('ban_cancel_')) {
        const sessionId = interaction.customId.replace('ban_cancel_', '');
        const session = banSessions.get(sessionId);
        if (!session) return interaction.reply({ content: "❌ Cette session a expiré.", ephemeral: true });
        if (interaction.user.id !== session.authorId) return interaction.reply({ content: "❌ Seul l'auteur peut annuler.", ephemeral: true });

        banSessions.delete(sessionId);
        const cancelEmbed = new EmbedBuilder().setColor(0x95a5a6).setTitle('❌ Bannissement annulé').setDescription('Aucune action n\'a été effectuée.');
        const closeRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`mod_close_${session.authorId}_${session.messageId}`).setLabel('🗑️ Fermer').setStyle(ButtonStyle.Secondary)
        );
        await interaction.update({ embeds: [cancelEmbed], components: [closeRow] });
        return true;
    }

    if (interaction.isButton() && interaction.customId.startsWith('ban_confirm_')) {
        const sessionId = interaction.customId.replace('ban_confirm_', '');
        const session = banSessions.get(sessionId);
        if (!session) return interaction.reply({ content: "❌ Cette session a expiré.", ephemeral: true });
        if (interaction.user.id !== session.authorId) return interaction.reply({ content: "❌ Seul l'auteur peut confirmer ce ban.", ephemeral: true });

        const targetMember = await interaction.guild.members.fetch(session.targetId).catch(() => null);
        const targetUser = targetMember?.user ?? await interaction.client.users.fetch(session.targetId).catch(() => null);

        const mpEmbed = new EmbedBuilder()
            .setColor(0xe03131)
            .setTitle('🔨 Tu as été banni(e) du serveur Regaïa')
            .setDescription(`• **Raison :** \`${session.raison}\``)
            .setTimestamp();
        const mpOk = await envoyerMpSanction(targetMember || targetUser, mpEmbed);

        try {
            await interaction.guild.members.ban(session.targetId, {
                deleteMessageSeconds: session.purgeSeconds || 0,
                reason: `${session.raison} (par ${interaction.user.tag})`
            });

            const publicBanEmbed = new EmbedBuilder()
                .setColor(0xe03131)
                .setTitle('🔨 Membre banni définitivement')
                .setThumbnail(session.targetAvatar || null)
                .setDescription(`<@${session.targetId}> (\`${session.targetTag}\`) a été banni(e) par <@${interaction.user.id}>.`)
                .addFields(
                    { name: '📝 Raison', value: `\`${session.raison}\``, inline: false },
                    { name: '🧹 Purge appliquée', value: getPurgeLabel(session.purgeSeconds), inline: true }
                )
                .setFooter({ text: mpOk ? '📩 Membre prévenu en MP' : '⚠️ MP fermés' })
                .setTimestamp();

            const closeRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`mod_close_${session.authorId}_${session.messageId}`)
                    .setLabel('🗑️ Fermer')
                    .setStyle(ButtonStyle.Secondary)
            );
            await interaction.update({ embeds: [publicBanEmbed], components: [closeRow] });

            const logEmbed = new EmbedBuilder()
                .setColor(0xe03131)
                .setTitle('🔨 Log — Bannissement (!bannir)')
                .setDescription(
                    `• **Cible :** <@${session.targetId}> (\`${session.targetId}\`)\n` +
                    `• **Modérateur :** <@${interaction.user.id}>\n` +
                    `• **Salon :** <#${interaction.channel.id}>\n` +
                    `• **Purge :** ${getPurgeLabel(session.purgeSeconds)}\n` +
                    `• **Raison :** \`${session.raison}\`\n` +
                    `• **MP remis :** ${mpOk ? 'Oui' : 'Non'}`
                )
                .setTimestamp();
            await logModerationStaff(interaction.guild, logEmbed, { silent: true });
            banSessions.delete(sessionId);
        } catch (err) {
            await interaction.reply({ content: `❌ Impossible de bannir ce membre (${err.message}).`, ephemeral: true });
        }
        return true;
    }

    // --- !kick : Menu de sélection + confirmation ---
    if (interaction.isUserSelectMenu() && interaction.customId.startsWith('kick_select_user_')) {
        const sessionId = interaction.customId.replace('kick_select_user_', '');
        const session = kickSessions.get(sessionId);
        if (!session) return interaction.reply({ content: "❌ Cette session a expiré.", ephemeral: true });
        if (interaction.user.id !== session.authorId) return interaction.reply({ content: "❌ Ce menu ne t'appartient pas.", ephemeral: true });

        const targetId = interaction.values[0];
        const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
        if (!targetMember) return interaction.reply({ content: "❌ Membre introuvable sur le serveur.", ephemeral: true });

        const errHier = verifierHierarchieSanction(interaction.member, targetMember, targetId, { checkAction: 'kick' });
        if (errHier) return interaction.reply({ content: errHier, ephemeral: true });

        session.targetId = targetId;
        session.targetTag = targetMember.user?.tag || targetMember.displayName;

        const confirmEmbed = new EmbedBuilder()
            .setColor(0xe67e22)
            .setTitle('👢 Confirmer l\'expulsion')
            .setDescription(`Expulser <@${targetId}> (\`${session.targetTag}\`) ?\n• **Raison :** \`${session.raison}\``)
            .setTimestamp();
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`kick_confirm_${sessionId}`).setLabel('👢 Expulser').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`kick_cancel_${sessionId}`).setLabel('❌ Annuler').setStyle(ButtonStyle.Secondary)
        );
        await interaction.update({ embeds: [confirmEmbed], components: [row] });
        return true;
    }

    if (interaction.isButton() && interaction.customId.startsWith('kick_cancel_')) {
        const sessionId = interaction.customId.replace('kick_cancel_', '');
        const session = kickSessions.get(sessionId);
        if (!session) return interaction.reply({ content: "❌ Cette session a expiré.", ephemeral: true });
        if (interaction.user.id !== session.authorId) return interaction.reply({ content: "❌ Seul l'auteur peut annuler.", ephemeral: true });
        kickSessions.delete(sessionId);
        await interaction.update({ embeds: [new EmbedBuilder().setColor(0x95a5a6).setTitle('❌ Expulsion annulée')], components: [] });
        return true;
    }

    if (interaction.isButton() && interaction.customId.startsWith('kick_confirm_')) {
        const sessionId = interaction.customId.replace('kick_confirm_', '');
        const session = kickSessions.get(sessionId);
        if (!session) return interaction.reply({ content: "❌ Cette session a expiré.", ephemeral: true });
        if (interaction.user.id !== session.authorId) return interaction.reply({ content: "❌ Seul l'auteur peut confirmer.", ephemeral: true });

        const targetMember = await interaction.guild.members.fetch(session.targetId).catch(() => null);
        if (!targetMember) return interaction.reply({ content: "❌ Membre déjà parti.", ephemeral: true });

        const mpEmbed = new EmbedBuilder().setColor(0xe67e22).setTitle('👢 Tu as été expulsé(e) de Regaïa').setDescription(`• **Raison :** \`${session.raison}\``).setTimestamp();
        const mpOk = await envoyerMpSanction(targetMember, mpEmbed);

        try {
            await targetMember.kick(`${session.raison} (par ${interaction.user.tag})`);
            const resEmbed = new EmbedBuilder()
                .setColor(0xe67e22)
                .setTitle('👢 Membre expulsé')
                .setDescription(`<@${session.targetId}> (\`${session.targetTag}\`) a été expulsé(e) par <@${interaction.user.id}>.`)
                .addFields({ name: '📝 Raison', value: `\`${session.raison}\`` })
                .setFooter({ text: mpOk ? '📩 Membre prévenu en MP' : '⚠️ MP fermés' })
                .setTimestamp();
            await interaction.update({ embeds: [resEmbed], components: [] });

            const logEmbed = new EmbedBuilder()
                .setColor(0xe67e22)
                .setTitle('👢 Log — Expulsion (!kick)')
                .setDescription(`• **Cible :** <@${session.targetId}> (\`${session.targetId}\`)\n• **Modérateur :** <@${interaction.user.id}>\n• **Raison :** \`${session.raison}\``)
                .setTimestamp();
            await logModerationStaff(interaction.guild, logEmbed, { silent: true });
            kickSessions.delete(sessionId);
        } catch (err) {
            await interaction.reply({ content: `❌ Impossible d'expulser ce membre (${err.message}).`, ephemeral: true });
        }
        return true;
    }

    // --- !mute : Sélection membre + menu contextuel durée + raison ---
    if (interaction.isUserSelectMenu() && interaction.customId.startsWith('mute_select_user_')) {
        const sessionId = interaction.customId.replace('mute_select_user_', '');
        const session = muteSessions.get(sessionId);
        if (!session) return interaction.reply({ content: "❌ Cette session a expiré.", ephemeral: true });
        if (interaction.user.id !== session.authorId) return interaction.reply({ content: "❌ Ce menu ne t'appartient pas.", ephemeral: true });

        const targetId = interaction.values[0];
        const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
        if (!targetMember) return interaction.reply({ content: "❌ Membre introuvable sur le serveur.", ephemeral: true });

        const errHier = verifierHierarchieSanction(interaction.member, targetMember, targetId, { checkAction: 'mute' });
        if (errHier) return interaction.reply({ content: errHier, ephemeral: true });

        session.targetId = targetId;
        session.targetTag = targetMember.user?.tag || targetMember.displayName;
        session.targetAvatar = targetMember.user?.displayAvatarURL?.({ dynamic: true }) || null;

        const { embed, components } = buildMuteDurationPanel(sessionId);
        await interaction.update({ embeds: [embed], components });
        return true;
    }

    if (interaction.isButton() && interaction.customId.startsWith('mute_reason_')) {
        const sessionId = interaction.customId.replace('mute_reason_', '');
        const session = muteSessions.get(sessionId);
        if (!session) return interaction.reply({ content: "❌ Cette session a expiré.", ephemeral: true });
        if (interaction.user.id !== session.authorId) return interaction.reply({ content: "❌ Seul l'auteur peut modifier la raison.", ephemeral: true });

        const modal = new ModalBuilder().setCustomId(`mute_modal_reason_${sessionId}`).setTitle('📝 Raison du mute');
        const input = new TextInputBuilder()
            .setCustomId('reason_text')
            .setLabel('Précise la raison')
            .setStyle(TextInputStyle.Short)
            .setValue(session.raison || '')
            .setRequired(true)
            .setMaxLength(300);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
        return true;
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('mute_modal_reason_')) {
        const sessionId = interaction.customId.replace('mute_modal_reason_', '');
        const session = muteSessions.get(sessionId);
        if (!session) return interaction.reply({ content: "❌ Cette session a expiré.", ephemeral: true });
        session.raison = interaction.fields.getTextInputValue('reason_text').trim() || 'Comportement inadapté';
        const { embed, components } = buildMuteDurationPanel(sessionId);
        await interaction.update({ embeds: [embed], components });
        return true;
    }

    if (interaction.isButton() && interaction.customId.startsWith('mute_cancel_')) {
        const sessionId = interaction.customId.replace('mute_cancel_', '');
        const session = muteSessions.get(sessionId);
        if (!session) return interaction.reply({ content: "❌ Cette session a expiré.", ephemeral: true });
        if (interaction.user.id !== session.authorId) return interaction.reply({ content: "❌ Seul l'auteur peut annuler.", ephemeral: true });
        muteSessions.delete(sessionId);
        await interaction.update({ embeds: [new EmbedBuilder().setColor(0x95a5a6).setTitle('❌ Mute annulé')], components: [] });
        return true;
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('mute_duration_')) {
        const sessionId = interaction.customId.replace('mute_duration_', '');
        const session = muteSessions.get(sessionId);
        if (!session) return interaction.reply({ content: "❌ Cette session a expiré.", ephemeral: true });
        if (interaction.user.id !== session.authorId) return interaction.reply({ content: "❌ Seul l'auteur de la commande peut choisir la durée.", ephemeral: true });

        const targetMember = await interaction.guild.members.fetch(session.targetId).catch(() => null);
        if (!targetMember) return interaction.reply({ content: "❌ Membre introuvable sur le serveur.", ephemeral: true });

        const ms = parseDurationMs(interaction.values[0]);
        if (!ms) return interaction.reply({ content: "❌ Durée invalide.", ephemeral: true });

        try {
            const publicEmbed = await executerMute({
                guild: interaction.guild,
                channel: interaction.channel,
                executorUser: interaction.user,
                targetMember,
                durationMs: ms,
                durationLabel: formatDurationFr(ms),
                raison: session.raison
            });
            muteSessions.delete(sessionId);
            await interaction.update({ embeds: [publicEmbed], components: [] });
        } catch (err) {
            await interaction.reply({ content: `❌ Impossible de mute ce membre (${err.message}).`, ephemeral: true });
        }
        return true;
    }

    // --- !unmute : Sélection membre ---
    if (interaction.isUserSelectMenu() && interaction.customId.startsWith('unmute_select_user_')) {
        const authorId = interaction.customId.replace('unmute_select_user_', '');
        if (interaction.user.id !== authorId) return interaction.reply({ content: "❌ Ce menu ne t'appartient pas.", ephemeral: true });

        const targetId = interaction.values[0];
        const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
        if (!targetMember) return interaction.reply({ content: "❌ Membre introuvable.", ephemeral: true });
        if (!targetMember.isCommunicationDisabled()) {
            return interaction.update({ embeds: [new EmbedBuilder().setColor(0x95a5a6).setDescription(`ℹ️ <@${targetId}> n'est pas en sourdine actuellement.`)], components: [] });
        }

        await targetMember.timeout(null, `Unmute par ${interaction.user.tag}`).catch(() => {});
        const mpOk = await envoyerMpSanction(targetMember, new EmbedBuilder().setColor(0x2ecc71).setTitle('🔊 Ta sourdine sur Regaïa a été levée').setTimestamp());

        const embed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('🔊 Sourdine levée')
            .setDescription(`<@${targetId}> a été démute par <@${interaction.user.id}>.`)
            .setFooter({ text: mpOk ? '📩 Membre prévenu en MP' : '⚠️ MP fermés' })
            .setTimestamp();
        await interaction.update({ embeds: [embed], components: [] });

        const logEmbed = new EmbedBuilder().setColor(0x2ecc71).setTitle('🔊 Log — Unmute (!unmute)').setDescription(`• **Cible :** <@${targetId}>\n• **Modérateur :** <@${interaction.user.id}>`).setTimestamp();
        await logModerationStaff(interaction.guild, logEmbed, { silent: true });
        return true;
    }

    // --- !warns : Sélection membre ---
    if (interaction.isUserSelectMenu() && interaction.customId.startsWith('warns_select_user_')) {
        const authorId = interaction.customId.replace('warns_select_user_', '');
        if (interaction.user.id !== authorId) return interaction.reply({ content: "❌ Ce menu ne t'appartient pas.", ephemeral: true });

        const targetId = interaction.values[0];
        const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
        const targetUser = targetMember?.user ?? await interaction.client.users.fetch(targetId).catch(() => null);
        const casierEmbed = buildWarnsCasierEmbed(targetMember || targetUser, targetId, getUserWarns(targetId));
        await interaction.update({ embeds: [casierEmbed], components: [] });
        return true;
    }

    // --- !unwarn & alerte 60 jours ---
    if (interaction.isUserSelectMenu() && interaction.customId.startsWith('unwarn_select_user_')) {
        const authorId = interaction.customId.replace('unwarn_select_user_', '');
        if (interaction.user.id !== authorId) return interaction.reply({ content: "❌ Ce menu ne t'appartient pas.", ephemeral: true });

        const targetId = interaction.values[0];
        const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
        const targetUser = targetMember?.user ?? await interaction.client.users.fetch(targetId).catch(() => null);
        const { embed, components } = buildUnwarnConfirmPanel(targetMember || targetUser, targetId, null, false);
        await interaction.update({ embeds: [embed], components });
        return true;
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('unwarn_pick_')) {
        if (!peutModerer(interaction.member)) return interaction.reply({ content: "❌ Réservé aux modérateurs.", ephemeral: true });
        const targetId = interaction.customId.replace('unwarn_pick_', '');
        const selectedWarnId = interaction.values[0];
        const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
        const targetUser = targetMember?.user ?? await interaction.client.users.fetch(targetId).catch(() => null);
        const { embed, components } = buildUnwarnConfirmPanel(targetMember || targetUser, targetId, selectedWarnId, false);
        await interaction.update({ embeds: [embed], components });
        return true;
    }

    if (interaction.isButton() && (interaction.customId.startsWith('unwarn_remove_') || interaction.customId.startsWith('warn60_remove_'))) {
        if (!peutModerer(interaction.member)) return interaction.reply({ content: "❌ Seuls les modérateurs peuvent retirer un avertissement.", ephemeral: true });

        const is60 = interaction.customId.startsWith('warn60_remove_');
        const parts = interaction.customId.split('_');
        const targetId = parts[2];
        const warnId = parts[3];

        const warns = getUserWarns(targetId);
        const idx = warns.findIndex(w => String(w.id) === String(warnId));
        if (idx === -1) {
            return interaction.update({ embeds: [new EmbedBuilder().setColor(0x95a5a6).setDescription('ℹ️ Cet avertissement a déjà été retiré.')], components: [] });
        }

        const [removed] = warns.splice(idx, 1);
        if (warns.length === 0) delete getWarnsMap()[targetId];
        securityState.demanderSauvegarde();

        const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
        const targetUser = targetMember?.user ?? await interaction.client.users.fetch(targetId).catch(() => null);
        const mpEmbed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('✅ Avertissement retiré sur Regaïa')
            .setDescription(
                `Un avertissement (**#${removed.id}** : \`${removed.reason}\`) a été retiré de ton casier${is60 ? ' après 60 jours' : ''}.\n` +
                `• **Avertissements restants :** \`${warns.length}/6\``
            )
            .setTimestamp();
        const mpOk = await envoyerMpSanction(targetMember || targetUser, mpEmbed);

        const doneEmbed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('🗑️ Avertissement retiré')
            .setDescription(
                `L'avertissement **#${removed.id}** (\`${removed.reason}\`) de <@${targetId}> a été supprimé par <@${interaction.user.id}>.\n` +
                `• **Casier actuel :** \`${warns.length}/6\` avertissement(s)`
            )
            .setFooter({ text: mpOk ? '📩 Membre prévenu en MP' : '⚠️ MP fermés' })
            .setTimestamp();
        await interaction.update({ embeds: [doneEmbed], components: [] });

        if (!is60) {
            const logEmbed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle('🗑️ Log — Retrait d\'avertissement (!unwarn)')
                .setDescription(
                    `• **Cible :** <@${targetId}> (\`${targetId}\`)\n` +
                    `• **Warn retiré :** #${removed.id} (\`${removed.reason}\`)\n` +
                    `• **Modérateur :** <@${interaction.user.id}>\n` +
                    `• **Restants :** \`${warns.length}/6\``
                )
                .setTimestamp();
            await logModerationStaff(interaction.guild, logEmbed, { silent: true });
        }
        return true;
    }

    if (interaction.isButton() && (interaction.customId.startsWith('unwarn_keep_') || interaction.customId.startsWith('warn60_keep_'))) {
        if (!peutModerer(interaction.member)) return interaction.reply({ content: "❌ Seuls les modérateurs peuvent utiliser ce bouton.", ephemeral: true });

        const parts = interaction.customId.split('_');
        const targetId = parts[2];
        const warnId = parts[3];

        const keepEmbed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle('📌 Avertissement conservé')
            .setDescription(`L'avertissement **#${warnId}** de <@${targetId}> a été maintenu dans le casier par <@${interaction.user.id}>.`)
            .setTimestamp();
        await interaction.update({ embeds: [keepEmbed], components: [] });
        return true;
    }

    // --- Palier 5/6 : Boutons exclusifs au modo qui a lancé le 5ème !warn ---
    if (interaction.isButton() && interaction.customId.startsWith('warn5_')) {
        const parts = interaction.customId.split('_');
        const action = parts[1];
        const authorId = parts[2];
        const targetId = parts[3];

        if (interaction.user.id !== authorId) {
            return interaction.reply({ content: `❌ Seul(e) <@${authorId}> (auteur du 5ème warn) peut décider de cette sanction !`, ephemeral: true });
        }

        const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
        const targetUser = targetMember?.user ?? await interaction.client.users.fetch(targetId).catch(() => null);

        if (action === 'ignore') {
            const embed = new EmbedBuilder()
                .setColor(0x95a5a6)
                .setTitle('✅ Palier 5/6 — Classé sans sanction immédiate')
                .setDescription(`<@${authorId}> a choisi de ne pas ajouter de sanction supplémentaire pour <@${targetId}> pour le moment.`)
                .setTimestamp();
            await interaction.update({ content: null, embeds: [embed], components: [] });
            return true;
        }

        if (action === 'mute7d') {
            if (!targetMember) return interaction.reply({ content: "❌ Ce membre n'est plus sur le serveur.", ephemeral: true });
            const ms = 7 * 24 * 60 * 60 * 1000;
            await targetMember.timeout(ms, `Palier 5/6 warn — décision de ${interaction.user.tag}`).catch(() => {});
            await envoyerMpSanction(targetMember, new EmbedBuilder().setColor(0xe74c3c).setTitle('🔇 Sanction Palier 5/6 sur Regaïa').setDescription('Suite à ton 5ème avertissement, tu as reçu un mute de **7 jours**.').setTimestamp());

            const embed = new EmbedBuilder()
                .setColor(0xf39c12)
                .setTitle('🔇 Palier 5/6 — Mute 7 jours appliqué')
                .setDescription(`<@${targetId}> a été mis(e) en sourdine **7 jours** par <@${authorId}>.`)
                .setTimestamp();
            await interaction.update({ content: null, embeds: [embed], components: [] });
            return true;
        }

        if (action === 'kick') {
            if (!targetMember) return interaction.reply({ content: "❌ Ce membre n'est déjà plus sur le serveur.", ephemeral: true });
            await envoyerMpSanction(targetMember, new EmbedBuilder().setColor(0xe67e22).setTitle('👢 Sanction Palier 5/6 sur Regaïa').setDescription('Suite à ton 5ème avertissement, tu as été expulsé(e) du serveur.').setTimestamp());
            try {
                await targetMember.kick(`Palier 5/6 warn — décision de ${interaction.user.tag}`);
                const embed = new EmbedBuilder().setColor(0xe67e22).setTitle('👢 Palier 5/6 — Membre expulsé').setDescription(`<@${targetId}> a été expulsé(e) par <@${authorId}>.`).setTimestamp();
                await interaction.update({ content: null, embeds: [embed], components: [] });
            } catch (err) {
                await interaction.reply({ content: `❌ Impossible d'expulser (${err.message}).`, ephemeral: true });
            }
            return true;
        }

        if (action === 'ban') {
            await envoyerMpSanction(targetMember || targetUser, new EmbedBuilder().setColor(0xe03131).setTitle('🔨 Sanction Palier 5/6 sur Regaïa').setDescription('Suite à ton 5ème avertissement, la modération a décidé ton bannissement définitif.').setTimestamp());
            try {
                await interaction.guild.members.ban(targetId, { reason: `Palier 5/6 warn — décision de ${interaction.user.tag}` });
                const embed = new EmbedBuilder().setColor(0xe03131).setTitle('🔨 Palier 5/6 — Membre banni').setDescription(`<@${targetId}> a été banni(e) définitivement par <@${authorId}>.`).setTimestamp();
                await interaction.update({ content: null, embeds: [embed], components: [] });
            } catch (err) {
                await interaction.reply({ content: `❌ Impossible de bannir (${err.message}).`, ephemeral: true });
            }
            return true;
        }
    }

    // --- !slowmode : menu contextuel ---
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('slowmode_select_')) {
        const authorId = interaction.customId.replace('slowmode_select_', '');
        if (interaction.user.id !== authorId && !peutModerer(interaction.member)) {
            return interaction.reply({ content: "❌ Réservé aux modérateurs.", ephemeral: true });
        }
        const seconds = parseInt(interaction.values[0], 10) || 0;
        await nettoyerBoutonAutoSlowmode(
            interaction.channel.id,
            seconds === 0
                ? `✅ **Slowmode automatique retiré** par <@${interaction.user.id}> *(via \`!slowmode\`)*.`
                : `🐢 **Slowmode automatique remplacé** par <@${interaction.user.id}> *(via \`!slowmode\`)*.`
        );
        await interaction.channel.setRateLimitPerUser(seconds, `Slowmode défini par ${interaction.user.tag}`).catch(() => {});

        const resEmbed = new EmbedBuilder()
            .setColor(seconds === 0 ? 0x2ecc71 : 0x3498db)
            .setTitle(seconds === 0 ? '✅ Slowmode désactivé' : '🐢 Slowmode activé')
            .setDescription(
                seconds === 0
                    ? `Le mode lent a été retiré dans <#${interaction.channel.id}> par <@${interaction.user.id}>.`
                    : `Le mode lent est désormais de **${formatDurationFr(seconds * 1000)}** dans <#${interaction.channel.id}> *(par <@${interaction.user.id}>)*.`
            )
            .setTimestamp();
        await interaction.update({ embeds: [resEmbed], components: [] });

        const logEmbed = new EmbedBuilder()
            .setColor(seconds === 0 ? 0x2ecc71 : 0x3498db)
            .setTitle('🐢 Log — Slowmode (!slowmode)')
            .setDescription(`• **Salon :** <#${interaction.channel.id}>\n• **Modérateur :** <@${interaction.user.id}>\n• **Valeur :** ${seconds === 0 ? 'Désactivé' : formatDurationFr(seconds * 1000)}`)
            .setTimestamp();
        await logModerationStaff(interaction.guild, logEmbed, { silent: true });
        return true;
    }

    // --- Bouton Modérateur : Retirer le slowmode automatique ---
    if (interaction.isButton() && interaction.customId.startsWith('auto_slowmode_stop_')) {
        if (!peutModerer(interaction.member)) {
            return interaction.reply({ content: '❌ Seuls les modérateurs peuvent retirer le slowmode.', ephemeral: true });
        }

        const targetChanId = interaction.customId.replace('auto_slowmode_stop_', '');
        const session = slowmodeSessions.get(targetChanId);

        if (!session) {
            slowmodeActifs.delete(targetChanId);
            await interaction.update({
                content: '✅ **Le slowmode automatique n\'est déjà plus actif.**',
                components: []
            }).catch(() => {});
            return true;
        }

        clearTimeout(session.timeout);
        slowmodeSessions.delete(targetChanId);
        slowmodeActifs.delete(targetChanId);
        slowmodeTrackers.delete(targetChanId);
        slowmodeWarnStates.delete(targetChanId);

        const restoreSeconds = session.ancienSlowmode || 0;
        await interaction.channel.setRateLimitPerUser(restoreSeconds, `Slowmode automatique retiré par ${interaction.user.tag}`).catch(() => {});

        await interaction.update({
            content: `✅ **Slowmode automatique retiré** par <@${interaction.user.id}> *(${restoreSeconds > 0 ? `retour au slowmode initial de ${restoreSeconds}s` : 'retour au rythme normal'})*.`,
            components: []
        }).catch(() => {});

        const logEmbed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('🔓 Log — Slowmode auto retiré')
            .setDescription(`• **Salon :** <#${targetChanId}>\n• **Modérateur :** <@${interaction.user.id}>`)
            .setTimestamp();
        await logModerationStaff(interaction.guild, logEmbed, { silent: true });
        return true;
    }

    // --- Bouton Déverrouiller sous l'embed de !lock ---
    if (interaction.isButton() && interaction.customId.startsWith('channel_unlock_')) {
        if (!peutModerer(interaction.member)) {
            return interaction.reply({ content: "❌ Seul.es les modérateur.ices peuvent déverrouiller ce salon.", ephemeral: true });
        }
        const targetChanId = interaction.customId.replace('channel_unlock_', '');
        const everyoneRole = interaction.guild.roles.everyone;
        const prevSend = channelLocks.has(targetChanId) ? channelLocks.get(targetChanId) : null;
        channelLocks.delete(targetChanId);

        await interaction.channel.permissionOverwrites.edit(everyoneRole, { SendMessages: prevSend }, { reason: `Déverrouillé par ${interaction.user.tag}` }).catch(() => {});
        const unlockEmbed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('🔓 Salon déverrouillé')
            .setDescription(`Le salon <#${targetChanId}> a été rouvert par <@${interaction.user.id}>.`)
            .setTimestamp();
        await interaction.update({ embeds: [unlockEmbed], components: [] });

        const logEmbed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('🔓 Log — Déverrouillage (!unlock)')
            .setDescription(`• **Salon :** <#${targetChanId}>\n• **Modérateur :** <@${interaction.user.id}>`)
            .setTimestamp();
        await logModerationStaff(interaction.guild, logEmbed, { silent: true });
        return true;
    }

    // ==========================================
    //    VOTE DE DESTITUTION (!destituation / !desti / !antimodo)
    // ==========================================

    if (interaction.isUserSelectMenu() && interaction.customId.startsWith('desti_select_user_')) {
        const sessionId = interaction.customId.replace('desti_select_user_', '');
        const session = destiSessions.get(sessionId);
        if (!session) return interaction.reply({ content: "❌ Cette session a expiré.", ephemeral: true });
        if (interaction.user.id !== session.authorId) return interaction.reply({ content: "❌ Ce menu ne t'appartient pas.", ephemeral: true });

        const targetId = interaction.values[0];
        if (targetId === securityState.EPSYS_ID) return interaction.reply({ content: "❌ Impossible de viser **Epsys** !", ephemeral: true });
        if (targetId === interaction.client?.user?.id) return interaction.reply({ content: "❌ Impossible de viser Cacabot !", ephemeral: true });

        const targetMember = interaction.guild.members.cache.get(targetId) ?? await interaction.guild.members.fetch(targetId).catch(() => null);
        if (!targetMember || !estModo(targetMember)) {
            return interaction.reply({ content: `❌ <@${targetId}> ne possède pas le rôle modérateur.`, ephemeral: true });
        }

        session.targetId = targetId;
        session.targetTag = targetMember.user?.tag || targetMember.displayName;
        session.targetAvatar = targetMember.user?.displayAvatarURL?.({ dynamic: true }) || null;

        const { embed, components } = buildDestiConfirmPanel(sessionId);
        await interaction.update({ embeds: [embed], components });
        return true;
    }

    if (interaction.isButton() && interaction.customId.startsWith('desti_reason_')) {
        const sessionId = interaction.customId.replace('desti_reason_', '');
        const session = destiSessions.get(sessionId);
        if (!session) return interaction.reply({ content: "❌ Cette session a expiré.", ephemeral: true });
        if (interaction.user.id !== session.authorId) return interaction.reply({ content: "❌ Seul l'auteur peut modifier la raison.", ephemeral: true });

        const modal = new ModalBuilder().setCustomId(`desti_modal_reason_${sessionId}`).setTitle('📝 Motif du vote de destitution');
        const input = new TextInputBuilder()
            .setCustomId('reason_text')
            .setLabel('Explique la raison de ce vote')
            .setStyle(TextInputStyle.Paragraph)
            .setValue(session.raison || '')
            .setRequired(true)
            .setMaxLength(500);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
        return true;
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('desti_modal_reason_')) {
        const sessionId = interaction.customId.replace('desti_modal_reason_', '');
        const session = destiSessions.get(sessionId);
        if (!session) return interaction.reply({ content: "❌ Cette session a expiré.", ephemeral: true });
        session.raison = interaction.fields.getTextInputValue('reason_text').trim() || 'Comportement incompatible avec le rôle de modérateur';
        const { embed, components } = buildDestiConfirmPanel(sessionId);
        await interaction.update({ embeds: [embed], components });
        return true;
    }

    if (interaction.isButton() && interaction.customId.startsWith('desti_cancel_')) {
        const sessionId = interaction.customId.replace('desti_cancel_', '');
        const session = destiSessions.get(sessionId);
        if (!session) return interaction.reply({ content: "❌ Cette session a expiré.", ephemeral: true });
        if (interaction.user.id !== session.authorId) return interaction.reply({ content: "❌ Seul l'auteur peut annuler.", ephemeral: true });
        destiSessions.delete(sessionId);
        await interaction.update({ content: "❌ **Vote de destitution annulé.**", embeds: [], components: [] });
        return true;
    }

    if (interaction.isButton() && interaction.customId.startsWith('desti_confirm_')) {
        const sessionId = interaction.customId.replace('desti_confirm_', '');
        const session = destiSessions.get(sessionId);
        if (!session) return interaction.reply({ content: "❌ Cette session a expiré.", ephemeral: true });
        if (interaction.user.id !== session.authorId) return interaction.reply({ content: "❌ Seul l'auteur peut lancer le vote.", ephemeral: true });

        destiSessions.delete(sessionId);
        await interaction.deferUpdate();
        await interaction.message.delete().catch(() => {});

        const voteData = {
            targetId: session.targetId,
            targetTag: session.targetTag,
            targetAvatar: session.targetAvatar,
            authorId: session.authorId,
            channelId: session.channelId,
            raison: session.raison,
            pour: [],
            contre: [],
            endsAt: Date.now() + DESTITUTION_DURATION_MS,
            cloture: false
        };

        const voteMsg = await interaction.channel.send({
            content: `🚨 <@&${MODO_ROLE_ID}> • **Un vote exceptionnel de destitution vient d'être ouvert !**`,
            embeds: [buildDestiVoteEmbed(voteData, false)],
            components: [buildDestiVoteRow(voteData, false)]
        });

        getDestitutionVotesMap()[voteMsg.id] = voteData;
        securityState.demanderSauvegarde();
        return true;
    }

    // Votes anonymes & clôture manuelle Epsys
    if (interaction.isButton() && ['desti_vote_remove', 'desti_vote_keep', 'desti_vote_close'].includes(interaction.customId)) {
        const allVotes = getDestitutionVotesMap();
        const voteData = allVotes[interaction.message.id];

        if (!voteData || voteData.cloture) {
            return interaction.reply({ content: "ℹ️ Ce vote est déjà clôturé ou introuvable.", ephemeral: true });
        }

        if (interaction.customId === 'desti_vote_close') {
            if (interaction.user.id !== securityState.EPSYS_ID) {
                return interaction.reply({ content: "❌ Seul **Epsys** peut clôturer ce vote manuellement avant la fin des 48h.", ephemeral: true });
            }
            await interaction.deferUpdate();
            await cloturerVoteDestitution(interaction.message.id, interaction.user);
            return true;
        }

        if (!peutModerer(interaction.member)) {
            return interaction.reply({ content: "❌ Seuls les modérateurs (et Epsys) peuvent participer à ce vote.", ephemeral: true });
        }

        if (interaction.user.id === voteData.targetId) {
            return interaction.reply({ content: "❌ Tu ne peux pas voter sur ta propre destitution !", ephemeral: true });
        }

        const voterId = interaction.user.id;
        voteData.pour = (voteData.pour || []).filter(id => id !== voterId);
        voteData.contre = (voteData.contre || []).filter(id => id !== voterId);

        let choixLabel;
        if (interaction.customId === 'desti_vote_remove') {
            voteData.pour.push(voterId);
            choixLabel = '🚪 Retirer le rôle Modo';
        } else {
            voteData.contre.push(voterId);
            choixLabel = '🛡️ Garder modo';
        }

        securityState.demanderSauvegarde();

        await interaction.update({
            embeds: [buildDestiVoteEmbed(voteData, false)],
            components: [buildDestiVoteRow(voteData, false)]
        });

        await interaction.followUp({
            content: `🗳️ Ton vote anonyme (**${choixLabel}**) a bien été enregistré *(tu peux modifier ton choix jusqu'à la fin des 48h)*.`,
            ephemeral: true
        }).catch(() => {});
        return true;
    }

    // Bouton de bannissement rapide anti-phishing
    if (interaction.isButton() && interaction.customId.startsWith('antiphish_ban_')) {
        if (!estModo(interaction.member) && !interaction.member.permissions.has('BanMembers')) {
            return interaction.reply({ content: "Permission insuffisante !", ephemeral: true });
        }
        const targetId = interaction.customId.replace('antiphish_ban_', '');
        await interaction.guild.members.ban(targetId, { reason: 'Compte piraté / Phishing détecté' })
            .then(() => interaction.reply(`✅ Le compte <@${targetId}> a été banni.`))
            .catch(() => interaction.reply({ content: "Impossible de bannir ce membre.", ephemeral: true }));
        return true;
    }

    return false;
}

// =========================
//    ARRIVÉE MEMBRES (Anti-Raid)
// =========================

async function handleSecurityMemberAdd(member) {
    if (member.guild.id !== '720057528351850547') return;

    const accountAge = Date.now() - member.user.createdTimestamp;
    const oneMonth = 30 * 24 * 60 * 60 * 1000;

    // Escalade anti-raid
    const previousRaidMuteEnd = raidMuteRecord.get(member.id);
    if (previousRaidMuteEnd && Date.now() - previousRaidMuteEnd < RAID_ESCALATION_WINDOW_MS) {
        raidMuteRecord.delete(member.id);
        await member.kick('Anti-raid : retour trop rapide après timeout').catch(() => {});
        return;
    }

    // Détection rafale
    if (accountAge < RAID_ACCOUNT_AGE_MS) {
        const joins = (raidJoinTracker.get(member.guild.id) || []).filter(j => Date.now() - j.timestamp < RAID_WINDOW_MS);
        joins.push({ userId: member.id, timestamp: Date.now() });
        raidJoinTracker.set(member.guild.id, joins);

        if (joins.length >= RAID_THRESHOLD) {
            for (const j of joins) raidFlaggedUsers.set(j.userId, true);
            raidJoinTracker.delete(member.guild.id);
        }
    }

    // Alerte compte récent < 1 mois
    if (accountAge < oneMonth) {
        const modChannel = member.guild.channels.cache.get(MOD_CHANNEL_ID);
        if (!modChannel) return;
        const jours = Math.floor(accountAge / (24 * 60 * 60 * 1000));
        const embed = new EmbedBuilder()
            .setColor(0xff9900)
            .setTitle('⚠️ Compte récent détecté')
            .setDescription(`<@${member.id}> vient de rejoindre le serveur, mais son compte n'a été créé qu'il y a **${jours} jour${jours > 1 ? 's' : ''}**.\n\nQue souhaitez-vous faire ?`)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setFooter({ text: `ID : ${member.id}` })
            .setTimestamp();

        const actionRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`mod_action_kick_${member.id}`).setLabel('👢 Expulser').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`mod_action_ban_${member.id}`).setLabel('🔨 Bannir').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`mod_action_dismiss_${member.id}`).setLabel('✅ Fausse alerte').setStyle(ButtonStyle.Success)
        );

        await modChannel.send({ embeds: [embed], components: [actionRow] });
    }
}

// =========================
//    RÉACTIONS (Rôles & Mute)
// =========================

async function handleSecurityReactionAdd(reaction, user) {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch().catch(() => {});
    if (reaction.message.partial) await reaction.message.fetch().catch(() => {});

    // Mute rapide sur feur via réaction
    if (['🛑', '❌', '👎', '🤫', '🔇'].includes(reaction.emoji.name)) {
        const msg = reaction.message;
        if (msg.author.id === securityState.client?.user.id && /feur|bril|quoicoubeh/i.test(msg.content)) {
            const ancien = mutedChannels.get(msg.channel.id);
            if (ancien) clearTimeout(ancien.timeout);

            const until = Date.now() + STOP_DURATION_MS;
            const timeout = setTimeout(() => mutedChannels.delete(msg.channel.id), STOP_DURATION_MS);
            mutedChannels.set(msg.channel.id, { until, timeout });
            await msg.react('🆗').catch(() => {});
            return;
        }
    }

    // Rôles réaction
    const msgConfig = securityState.getReactionRolesData()[reaction.message.id];
    if (!msgConfig) return;

    const emojiKey = reaction.emoji.id ? `<:${reaction.emoji.name}:${reaction.emoji.id}>` : reaction.emoji.name;
    const roleId = msgConfig.roles[emojiKey] || msgConfig.roles[reaction.emoji.name] || (reaction.emoji.id && msgConfig.roles[reaction.emoji.id]);

    if (roleId) {
        const member = reaction.message.guild?.members.cache.get(user.id) ?? await reaction.message.guild?.members.fetch(user.id).catch(() => null);
        if (member && !member.roles.cache.has(roleId)) {
            await member.roles.add(roleId).catch(() => {});
        }
    }
}

async function handleSecurityReactionRemove(reaction, user) {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch().catch(() => {});
    if (reaction.message.partial) await reaction.message.fetch().catch(() => {});

    const msgConfig = securityState.getReactionRolesData()[reaction.message.id];
    if (!msgConfig) return;

    const emojiKey = reaction.emoji.id ? `<:${reaction.emoji.name}:${reaction.emoji.id}>` : reaction.emoji.name;
    const roleId = msgConfig.roles[emojiKey] || msgConfig.roles[reaction.emoji.name] || (reaction.emoji.id && msgConfig.roles[reaction.emoji.id]);

    if (roleId) {
        const member = reaction.message.guild?.members.cache.get(user.id) ?? await reaction.message.guild?.members.fetch(user.id).catch(() => null);
        if (member && member.roles.cache.has(roleId)) {
            await member.roles.remove(roleId).catch(() => {});
        }
    }
}

module.exports = {
    initSecurityState,
    estModo,
    isChannelMuted,
    handleSecurityMessage,
    handleSecurityInteraction,
    handleSecurityMemberAdd,
    handleSecurityReactionAdd,
    handleSecurityReactionRemove
};