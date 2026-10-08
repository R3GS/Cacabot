/**
 * Module Sécurité & Modération pour Cacabot
 * Anti-phishing, Anti-spam, Anti-raid, Slowmode d'urgence, Chut/Stop, Rôles Réactions
 */

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType
} = require('discord.js');

const MOD_CHANNEL_ID = '1555402748193669192';
const MODO_ROLE_ID = '720081311716606004';
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

function initSecurityState(bridge) {
    securityState = { ...securityState, ...bridge };
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

async function handleSecurityMessage(message) {
    const channelId = message.channel.id;
    const raw = message.content.trim();
    const command = raw.split(/\s+/)[0]?.toLowerCase();

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