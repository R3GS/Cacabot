/**
 * Module Sécurité & Modération pour Cacabot
 * Anti-phishing, Anti-spam, Anti-raid, Slowmode d'urgence, Chut/Stop, Rôles Réactions
 */

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
    UserSelectMenuBuilder
} = require('discord.js');

const MOD_CHANNEL_ID = '1555402748193669192';
const MODO_ROLE_ID = '720081311716606004';
const BANTEMP_AUTHORIZED_CHANNELS = ['720082701192921231', '1555402748193669192'];
const ROLE_TRIBUNAL_ID = '1569002165836451890';
const CATEGORIE_MODERATION_ID = '1555402058532659360';

// Trackers pour les sessions de configuration !tribunal et les salons actifs
const bantempSessions = new Map();
const tribunalSavedRoles = new Map();
const tribunalActiveCases = new Map(); // targetId => { channelId, targetTag }

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
const slowmodeActifs = new Set();
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

        // Reconnexion immédiate des tribunaux en cours (même créés avant la mise à jour)
        if (securityState.client.isReady()) {
            synchroniserTribunauxExistants();
        } else {
            securityState.client.once('ready', () => synchroniserTribunauxExistants());
        }
    }
}

function estModo(member) {
    return member?.roles?.cache?.has(MODO_ROLE_ID) ?? false;
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

    // 0. !tribunal / !trib (ou !bantemp) (Modération / Tribunal)
    if (['!tribunal', '!trib', '!bantemp'].includes(command)) {
        if (!estModo(message.member)) {
            await message.reply("❌ Cette commande est réservée aux modérateurs.");
            return true;
        }

        if (!BANTEMP_AUTHORIZED_CHANNELS.includes(channelId)) {
            await message.reply("❌ Cette commande ne peut être utilisée que dans les salons de modération prévus.");
            return true;
        }

        const args = raw.split(/\s+/);

        // Si aucun identifiant n'est fourni
        if (!args[1]) {
            await message.reply(
                "⚖️ **Procédure du Tribunal de Regaïa**\n\n" +
                "**Usage :** `!tribunal [ID_DU_MEMBRE] [raison optionnelle]` (ou `!trib [ID]`)\n\n" +
                "💡 **Comment faire :**\n" +
                "1. Fais un clic droit (ou appui long sur téléphone) sur le profil du suspect ➔ **« Copier l'identifiant »**.\n" +
                "2. Tape ici : `!tribunal 123456789012345678` *(tu peux aussi mettre l'ID entre parenthèses ou son pseudo)*."
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

    // 4. Slowmode d'urgence automatique
    if (message.guild && !message.author.bot && message.channel.type === ChannelType.GuildText && !slowmodeActifs.has(message.channel.id)) {
        const now = Date.now();
        const logs = (slowmodeTrackers.get(message.channel.id) || []).filter(e => now - e.timestamp < 8000);
        logs.push({ userId: message.author.id, timestamp: now });
        slowmodeTrackers.set(message.channel.id, logs);

        const auteursUniques = new Set(logs.map(e => e.userId));
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

                // Enregistrement du salon actif pour la surveillance des départs
                tribunalActiveCases.set(session.targetId, {
                    channelId: salonTribunal.id,
                    targetTag: session.targetTag
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

            await interaction.editReply("✅ **Le/la membre a été innocenté et réintégré avec succès.**\nCe salon sera supprimé automatiquement dans **5 secondes**...");
            setTimeout(() => {
                interaction.channel.delete("Clôture Tribunal : membre innocenté").catch(() => {});
            }, 5000);
            return true;
        }

        if (action === 'ban') {
            await interaction.deferReply();
            tribunalActiveCases.delete(targetId);
            try {
                await interaction.guild.members.ban(targetId, {
                    reason: `Décision du Tribunal de modération par ${interaction.user.tag}`
                });
                tribunalSavedRoles.delete(targetId);
                await interaction.editReply(`🔨 **<@${targetId}> a été banni.e définitivement.**\nCe salon sera supprimé automatiquement dans **5 secondes**...`);
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
            tribunalActiveCases.delete(targetId);
            if (targetMember) {
                try {
                    await targetMember.kick(`Décision du Tribunal de modération par ${interaction.user.tag}`);
                    tribunalSavedRoles.delete(targetId);
                    await interaction.editReply(`👢 **<@${targetId}> a été expulsé.e du serveur.**\nCe salon sera supprimé automatiquement dans **5 secondes**...`);
                } catch (err) {
                    await interaction.editReply(`❌ Impossible d'expulser ce.tte membre (${err.message}).`);
                    return true;
                }
            } else {
                await interaction.editReply("ℹ️ Le/la membre n'est déjà plus sur le serveur.\nSuppression du salon dans **5 secondes**...");
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
            await interaction.reply("🗑️ **Fermeture et suppression du salon tribunal en cours...**");
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
        await interaction.reply("🗑️ **Suppression automatique du salon tribunal en cours...**");
        tribunalActiveCases.delete(targetId);
        tribunalSavedRoles.delete(targetId);
        setTimeout(() => {
            interaction.channel.delete(`Fermeture automatique après départ par ${interaction.user.tag}`).catch(() => {});
        }, 2000);
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