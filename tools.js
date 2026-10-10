/**
 * Module Outils & Utilitaires pour Cacabot
 * Pomodoro, Rappels, Météo, Serveur, Botinfo, Ping, Prune, Say, Edit, Aternos
 */

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    StringSelectMenuBuilder,
    ButtonStyle,
    ChannelType
} = require('discord.js');

const EPSYS_ID = '436218312574107658';

let toolsState = {
    client: null,
    topData: { messages: {} }
};

function initToolsState(bridge) {
    toolsState.client = bridge.client;
    toolsState.topData = bridge.topData;
}

// =========================
//     ÉTATS EN MÉMOIRE
// =========================
const pendingRappels = new Map();
const rappelReports = new Map();
const pomodoroSessions = new Map();

// Helper git commit count sécurisé
function getCommitCount() {
    try {
        const { execSync } = require('child_process');
        return execSync('git rev-list --count HEAD').toString().trim();
    } catch (e) {
        return null;
    }
}

// =========================
//        RAPPELS
// =========================
function scheduleRappel(channelId, targetId, texte, ms) {
    const id = `${targetId}_${Date.now()}`;
    const triggerAt = Date.now() + ms;

    const timeout = setTimeout(async () => {
        pendingRappels.delete(id);
        const channel = toolsState.client?.channels.cache.get(channelId);
        if (!channel) return;

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`rappel_report_${targetId}`)
                .setLabel('⏰ Reporter')
                .setStyle(ButtonStyle.Secondary)
        );

        const sent = await channel.send({
            content: `⏰ <@${targetId}> ! **Rappel :** ${texte}`,
            components: [row]
        }).catch(() => null);

        if (sent) {
            rappelReports.set(sent.id, { channelId, targetId, texte, sentAt: Date.now() });
            setTimeout(() => rappelReports.delete(sent.id), 24 * 60 * 60 * 1000);
        }
    }, ms);

    pendingRappels.set(id, { targetId, texte, channelId, triggerAt, timeout });
}

// =========================
//        POMODORO
// =========================
function buildPomoControls(channelId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`pomo_stop_${channelId}`).setLabel('⏹️ Arrêter').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`pomo_skip_${channelId}`).setLabel('⏭️ Passer').setStyle(ButtonStyle.Secondary)
    );
}

async function startPomodoro(channel, participantsMention, workMin, breakMin, cycle, phase, reason) {
    const isWork = phase === 'work';
    const durationMin = isWork ? workMin : breakMin;
    const durationMs = durationMin * 60 * 1000;
    const endTimestamp = Math.floor((Date.now() + durationMs) / 1000);

    const embed = new EmbedBuilder()
        .setColor(isWork ? 0xe74c3c : 0x2ecc71)
        .setTitle(isWork ? `🍅 Pomodoro — Session #${cycle}` : `☕ Pause — Session #${cycle}`)
        .setDescription(
            `🎯 **Objectif :** ${reason}\n\n` +
            (isWork ? `C'est parti pour **${workMin} minutes** de concentration !` : `Prends une pause de **${breakMin} minutes** !`) +
            `\n\nFin de la phase : <t:${endTimestamp}:R>`
        )
        .setFooter({ text: `Cycle ${cycle} • Cacabot Pomodoro` });

    const msg = await channel.send({
        content: `🔔 ${participantsMention}`,
        embeds: [embed],
        components: [buildPomoControls(channel.id)]
    });

    const timeout = setTimeout(async () => {
        const nextPhase = isWork ? 'break' : 'work';
        const nextCycle = isWork ? cycle : cycle + 1;
        await startPomodoro(channel, participantsMention, workMin, breakMin, nextCycle, nextPhase, reason);
    }, durationMs);

    pomodoroSessions.set(channel.id, {
        message: msg,
        timeout,
        skip: async () => {
            clearTimeout(timeout);
            const nextPhase = isWork ? 'break' : 'work';
            const nextCycle = isWork ? cycle : cycle + 1;
            await startPomodoro(channel, participantsMention, workMin, breakMin, nextCycle, nextPhase, reason);
        }
    });
}

// =========================
//         MÉTÉO
// =========================
async function fetchMeteoEmbed(ville) {
    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(ville)}&count=1&language=fr&format=json`);
    const geoData = await geoRes.json();
    if (!geoData.results || geoData.results.length === 0) return null;

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
    const [h, m] = localTime.split(':');

    return new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle(`🌍 Météo à ${name}${country ? ', ' + country : ''}`)
        .setDescription(description)
        .addFields(
            { name: '🌡️ Température', value: `${current.temperature_2m}°C (ressenti ${current.apparent_temperature}°C)`, inline: true },
            { name: '💧 Humidité', value: `${current.relative_humidity_2m}%`, inline: true },
            { name: '💨 Vent', value: `${current.wind_speed_10m} km/h`, inline: true },
            { name: '🕒 Heure locale', value: `${h}h${m}`, inline: true }
        )
        .setFooter({ text: 'Données via Open-Meteo' })
        .setTimestamp();
}

// =========================
//    HANDLER MESSAGES (!)
// =========================
async function handleToolsMessage(message, response, client) {
    const raw = message.content.trim();
    const command = raw.split(/\s+/)[0].toLowerCase();

    // !aternos
    if (raw.toLowerCase().match(/!aternos\b/)) {
        await message.reply("L'IP actuelle du serveur Minecraft de Regaïa est : **papierprout.aternos.me**");
        return true;
    }

    // !ping
    if (command === '!ping' || response?.needsPing) {
        const sent = await message.reply('🏓 Pong !');
        const latence = sent.createdTimestamp - message.createdTimestamp;
        const wsLatence = client.ws.ping;
        const embed = new EmbedBuilder()
            .setColor(latence < 100 ? 0x2ecc71 : latence < 250 ? 0xf39c12 : 0xe74c3c)
            .setTitle('🏓 Pong !')
            .addFields(
                { name: '📨 Latence', value: `${latence}ms`, inline: true },
                { name: '🔌 WebSocket', value: `${wsLatence}ms`, inline: true }
            );
        await sent.edit({ content: null, embeds: [embed] });
        return true;
    }

    // !meteo
    if (command === '!meteo' || command === '!météo' || response?.needsMeteo) {
        const args = raw.split(/\s+/);
        const ville = args.slice(1).join(' ');
        if (!ville) {
            await message.reply('Usage : `!météo [ville]`\nEx : `!météo Paris`');
            return true;
        }
        try {
            const embed = await fetchMeteoEmbed(ville);
            if (!embed) return message.reply(`Ville introuvable : **${ville}**`);
            await message.reply({ embeds: [embed] });
        } catch (e) {
            await message.reply("Erreur lors de la récupération de la météo.");
        }
        return true;
    }

    // !serveur
    if (command === '!serveur' || response?.needsServeur) {
        const guild = message.guild;
        if (!guild) return true;
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
            .addFields({ name: '\u200b', value: '[🔗 Lien d\'invitation du serveur](https://discord.com/invite/maAbUYb)', inline: false });

        await message.reply({ embeds: [embed] });
        return true;
    }

    // !botinfo / !info
    if (command === '!botinfo' || command === '!about' || command === '!abt' || response?.needsInfo) {
        const startDate = new Date('2026-05-14T00:00:00');
        const diff = Date.now() - startDate;
        const totalHours = Math.floor(diff / (1000 * 60 * 60));
        const totalDays = Math.floor(totalHours / 24);
        const months = Math.floor(totalDays / 30);
        const days = totalDays % 30;
        const hours = totalHours % 24;

        let uptime = '';
        if (months > 0) uptime += `${months} mois, `;
        if (months > 0 || days > 0) uptime += `${days} jour${days > 1 ? 's' : ''}, `;
        uptime += `${hours} heure${hours > 1 ? 's' : ''}`;

        const commitCount = getCommitCount();
        const versionStr = commitCount ? `Version 1.${commitCount}` : 'Version 1.0';

        const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle('🤖 Infos de Cacabot')
            .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                { name: '💻 Commandes', value: `30`, inline: true },
                { name: '💬 Messages envoyés', value: `${toolsState.topData.messages['1503495713097519355'] || 0}`, inline: true },
                { name: '\u200b', value: '\u200b', inline: true },
                { name: '👑 Créatrice', value: 'Epsys', inline: true },
                { name: '🤝 Collaboratrice', value: '[BDN](https://bdn-fr.xyz/)', inline: true },
                { name: '\u200b', value: '\u200b', inline: true },
                { name: '📑 Version', value: versionStr, inline: true },
                { name: '🕒 En ligne depuis', value: uptime, inline: true },
                { name: '\u200b', value: '\u200b', inline: true }
            );

        await message.reply({ embeds: [embed] });
        return true;
    }

    // !prune
    if (command === '!prune' || response?.needsPrune) {
        if (!message.member.permissions.has('ManageMessages') && message.author.id !== EPSYS_ID) {
            return message.reply("Tu n'as pas la permission de gérer les messages !");
        }
        const count = parseInt(raw.split(/\s+/)[1]);
        if (isNaN(count) || count < 1 || count > 100) {
            return message.reply("Précise un nombre entre 1 et 100 (ex: `!prune 10`).");
        }
        await message.delete().catch(() => {});
        const deleted = await message.channel.bulkDelete(count, true).catch(() => null);
        const msg = await message.channel.send(`🧹 **${deleted?.size ?? 0}** messages supprimés.`);
        setTimeout(() => msg.delete().catch(() => {}), 4000);
        return true;
    }

    // !rappel
    if (command === '!rappel' || response?.needsRappel) {
        const args = raw.split(/\s+/);
        const sub = args[1]?.toLowerCase();

        if (sub === 'list') {
            const mine = [...pendingRappels.entries()].filter(([, r]) => r.targetId === message.author.id);
            if (mine.length === 0) return message.reply("Tu n'as aucun rappel en attente !");

            const fields = mine.sort((a, b) => a[1].triggerAt - b[1].triggerAt).map(([, r]) => {
                const remainingMs = r.triggerAt - Date.now();
                const mins = Math.max(0, Math.floor(remainingMs / 60000));
                const secs = Math.max(0, Math.floor((remainingMs % 60000) / 1000));
                return { name: r.texte, value: mins > 0 ? `dans ${mins}min ${secs}s` : `dans ${secs}s`, inline: false };
            });

            return message.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('⏰ Tes rappels').addFields(fields)] });
        }

        if (sub === 'remove') {
            const query = args.slice(2).join(' ').toLowerCase();
            const match = [...pendingRappels.entries()].find(([, r]) => r.targetId === message.author.id && r.texte.toLowerCase().includes(query));
            if (!match) return message.reply("Aucun rappel correspondant trouvé !");
            clearTimeout(match[1].timeout);
            pendingRappels.delete(match[0]);
            return message.reply(`🗑️ Rappel supprimé : **${match[1].texte}**`);
        }

        const isEpsys = message.author.id === EPSYS_ID;
        const looksLikeId = args[1] && /^\d{17,19}$/.test(args[1]);
        let targetId = message.author.id, timeStr, texte;

        if (looksLikeId && isEpsys) {
            targetId = args[1];
            timeStr = args[2]?.toLowerCase();
            texte = args.slice(3).join(' ');
        } else {
            timeStr = args[1]?.toLowerCase();
            texte = args.slice(2).join(' ');
        }

        let ms = 0;
        if (timeStr?.endsWith('min')) ms = parseInt(timeStr) * 60 * 1000;
        else if (timeStr?.endsWith('h')) ms = parseInt(timeStr) * 60 * 60 * 1000;
        else if (timeStr?.endsWith('s')) ms = parseInt(timeStr) * 1000;
        else return message.reply('Format invalide ! Utilise `Xmin`, `Xh` ou `Xs`. Ex: `!rappel 10min gâteau au four`');

        if (isNaN(ms) || ms <= 0 || ms > 24 * 60 * 60 * 1000) return message.reply('Durée invalide (maximum 24h) !');

        await message.reply(`⏰ Rappel enregistré ! Je ping <@${targetId}> dans **${timeStr}**.`);
        scheduleRappel(message.channel.id, targetId, texte, ms);
        return true;
    }

    // !pomodoro
    if (command === '!pomodoro' || response?.needsPomodoro) {
        if (pomodoroSessions.has(message.channel.id)) {
            return message.reply("Un pomodoro est déjà en cours dans ce salon !");
        }
        const workMenu = new StringSelectMenuBuilder()
            .setCustomId(`pomo_setup_work_${message.author.id}_${message.channel.id}`)
            .setPlaceholder('Durée de travail...')
            .addOptions([5,10,15,20,25,30,35,40,45,50,55,60].map(n => ({ label: `${n} minutes`, value: `${n}` })));

        const breakMenu = new StringSelectMenuBuilder()
            .setCustomId(`pomo_setup_break_${message.author.id}_${message.channel.id}`)
            .setPlaceholder('Durée de pause...')
            .addOptions([5,10,15,20,25,30].map(n => ({ label: `${n} minutes`, value: `${n}` })));

        const reasonMenu = new StringSelectMenuBuilder()
            .setCustomId(`pomo_setup_reason_${message.author.id}_${message.channel.id}`)
            .setPlaceholder('Raison...')
            .addOptions([
                { label: 'Devoirs', value: 'Devoirs', emoji: '📚' },
                { label: 'Montage', value: 'Montage', emoji: '🎬' },
                { label: 'Composition', value: 'Composition', emoji: '🎵' },
                { label: 'Écriture', value: 'Écriture', emoji: '✍️' },
                { label: 'Code', value: 'Code', emoji: '💻' }
            ]);

        const embed = new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle('🍅 Configurer le Pomodoro')
            .setDescription('Choisis la durée de travail et la pause !')
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

    // !say (Epsys-only)
    if (command === '!say' || response?.needsSay) {
        if (message.author.id !== EPSYS_ID) return true;
        const texte = raw.slice(4).trim();
        if (!texte) return message.reply("Usage : `!say [ton texte]`");
        await message.delete().catch(() => {});
        await message.channel.send(texte);
        return true;
    }

    // !edit (Epsys-only)
    if (command === '!edit' || response?.needsEdit) {
        if (message.author.id !== EPSYS_ID) return true;
        const args = raw.split(/\s+/);
        const msgId = args[1];
        const newText = args.slice(2).join(' ');
        if (!msgId || !newText) return message.reply("Usage : `!edit [ID_message] [nouveau texte]`");
        const cible = await message.channel.messages.fetch(msgId).catch(() => null);
        if (!cible) return message.reply("Message introuvable.");
        if (cible.author.id !== client.user.id) return message.reply("Je ne peux modifier que mes messages !");
        await cible.edit(newText);
        await message.delete().catch(() => {});
        return true;
    }

    return false;
}

// =========================
//    HANDLER SLASH (/)
// =========================
async function handleToolsSlash(interaction, client) {
    const { commandName } = interaction;

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

    if (commandName === 'aternos') {
        return interaction.reply("L'IP actuelle du serveur Minecraft de Regaïa est : **papierprout.aternos.me**");
    }

    if (commandName === 'serveur') {
        const guild = interaction.guild;
        if (!guild) return interaction.reply({ content: "Uniquement sur serveur.", ephemeral: true });
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
                { name: '🚀 Boost', value: `Niveau ${guild.premiumTier}`, inline: true },
                { name: '💫 Boosts', value: `${guild.premiumSubscriptionCount}`, inline: true },
                { name: '🆔 ID', value: guild.id, inline: true }
            )
            .addFields({ name: '\u200b', value: '[🔗 Invitation](https://discord.com/invite/maAbUYb)', inline: false });

        return interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'meteo') {
        const ville = interaction.options.getString('ville');
        await interaction.deferReply();
        try {
            const embed = await fetchMeteoEmbed(ville);
            if (!embed) return interaction.editReply(`Ville introuvable : **${ville}**`);
            return interaction.editReply({ embeds: [embed] });
        } catch (e) {
            return interaction.editReply("Erreur météo.");
        }
    }

    if (commandName === 'prune') {
        if (!interaction.member.permissions.has('ManageMessages') && interaction.user.id !== EPSYS_ID) {
            return interaction.reply({ content: "Permission insuffisante !", ephemeral: true });
        }
        const count = interaction.options.getInteger('nombre');
        await interaction.deferReply({ ephemeral: true });
        const deleted = await interaction.channel.bulkDelete(count, true).catch(() => null);
        return interaction.editReply(`🧹 **${deleted?.size ?? 0}** messages supprimés.`);
    }

    if (commandName === 'pomodoro') {
        const sub = interaction.options.getSubcommand();
        if (sub === 'stop') {
            if (!pomodoroSessions.has(interaction.channel.id)) {
                return interaction.reply({ content: "Aucun pomodoro en cours !", ephemeral: true });
            }
            const s = pomodoroSessions.get(interaction.channel.id);
            clearTimeout(s.timeout);
            await s.message.delete().catch(() => {});
            pomodoroSessions.delete(interaction.channel.id);
            return interaction.reply("⏹️ Pomodoro arrêté !");
        }
        if (sub === 'lancer') {
            if (pomodoroSessions.has(interaction.channel.id)) {
                return interaction.reply({ content: "Un pomodoro est déjà en cours !", ephemeral: true });
            }
            const workMenu = new StringSelectMenuBuilder()
                .setCustomId(`pomo_setup_work_${interaction.user.id}_${interaction.channel.id}`)
                .setPlaceholder('Durée travail...')
                .addOptions([5,10,15,20,25,30,35,40,45,50,55,60].map(n => ({ label: `${n} minutes`, value: `${n}` })));

            const breakMenu = new StringSelectMenuBuilder()
                .setCustomId(`pomo_setup_break_${interaction.user.id}_${interaction.channel.id}`)
                .setPlaceholder('Durée pause...')
                .addOptions([5,10,15,20,25,30].map(n => ({ label: `${n} minutes`, value: `${n}` })));

            const reasonMenu = new StringSelectMenuBuilder()
                .setCustomId(`pomo_setup_reason_${interaction.user.id}_${interaction.channel.id}`)
                .setPlaceholder('Raison...')
                .addOptions([
                    { label: 'Devoirs', value: 'Devoirs', emoji: '📚' },
                    { label: 'Montage', value: 'Montage', emoji: '🎬' },
                    { label: 'Composition', value: 'Composition', emoji: '🎵' },
                    { label: 'Écriture', value: 'Écriture', emoji: '✍️' },
                    { label: 'Code', value: 'Code', emoji: '💻' }
                ]);

            const embed = new EmbedBuilder()
                .setColor(0xe74c3c)
                .setTitle('🍅 Configurer le Pomodoro')
                .setDescription('Choisis la durée de travail et la pause !')
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
            if (mine.length === 0) return interaction.reply({ content: "Aucun rappel en attente !", ephemeral: true });
            const fields = mine.sort((a, b) => a[1].triggerAt - b[1].triggerAt).map(([, r]) => {
                const rem = r.triggerAt - Date.now();
                const m = Math.max(0, Math.floor(rem / 60000));
                const s = Math.max(0, Math.floor((rem % 60000) / 1000));
                return { name: r.texte, value: m > 0 ? `dans ${m}min ${s}s` : `dans ${s}s`, inline: false };
            });
            return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('⏰ Tes rappels').addFields(fields)] });
        }
        if (sub === 'remove') {
            const query = interaction.options.getString('nom').toLowerCase();
            const match = [...pendingRappels.entries()].find(([, r]) => r.targetId === interaction.user.id && r.texte.toLowerCase().includes(query));
            if (!match) return interaction.reply({ content: "Rappel introuvable !", ephemeral: true });
            clearTimeout(match[1].timeout);
            pendingRappels.delete(match[0]);
            return interaction.reply(`🗑️ Rappel supprimé : **${match[1].texte}**`);
        }
        if (sub === 'ajouter') {
            const timeStr = interaction.options.getString('temps').toLowerCase();
            const texte = interaction.options.getString('message');
            let ms = 0;
            if (timeStr.endsWith('min')) ms = parseInt(timeStr) * 60 * 1000;
            else if (timeStr.endsWith('h')) ms = parseInt(timeStr) * 60 * 60 * 1000;
            else if (timeStr.endsWith('s')) ms = parseInt(timeStr) * 1000;
            else return interaction.reply({ content: "Format invalide ! (ex: `15min`)", ephemeral: true });

            scheduleRappel(interaction.channel.id, interaction.user.id, texte, ms);
            return interaction.reply(`⏰ Rappel enregistré dans **${timeStr}** pour : **${texte}**.`);
        }
    }

    if (commandName === 'botinfo') {
        const startDate = new Date('2026-05-14T00:00:00');
        const diff = Date.now() - startDate;
        const totalHours = Math.floor(diff / (1000 * 60 * 60));
        const totalDays = Math.floor(totalHours / 24);
        const months = Math.floor(totalDays / 30);
        const days = totalDays % 30;
        const hours = totalHours % 24;

        let uptime = '';
        if (months > 0) uptime += `${months} mois, `;
        if (months > 0 || days > 0) uptime += `${days} jour${days > 1 ? 's' : ''}, `;
        uptime += `${hours} heure${hours > 1 ? 's' : ''}`;

    function getCommitCount() {
    try {
        const { execSync } = require('child_process');
        return execSync('git rev-list --count HEAD').toString().trim();
    } catch (e) {
        return null;
    }
}
        
        const commitCount = getCommitCount();
        const versionStr = commitCount ? `Version 1.${commitCount}` : 'Version 1.0';

        const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle('🤖 Infos de Cacabot')
            .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                { name: '💻 Commandes', value: `30`, inline: true },
                { name: '💬 Messages envoyés', value: `${toolsState.topData.messages['1503495713097519355'] || 0}`, inline: true },
                { name: '\u200b', value: '\u200b', inline: true },
                { name: '👑 Créatrice', value: 'Epsys', inline: true },
                { name: '🤝 Collaboratrice', value: '[BDN](https://bdn-fr.xyz/)', inline: true },
                { name: '\u200b', value: '\u200b', inline: true },
                { name: '📑 Version', value: versionStr, inline: true },
                { name: '🕒 En ligne depuis', value: uptime, inline: true },
                { name: '\u200b', value: '\u200b', inline: true }
            );

        return interaction.reply({ embeds: [embed] });
    }

    return false;
}

// =========================
//    HANDLER INTERACTIONS
// =========================
async function handleToolsInteraction(interaction, client) {
    // Bouton Rappel Reporter
    if (interaction.isButton() && interaction.customId.startsWith('rappel_report_')) {
        const targetId = interaction.customId.replace('rappel_report_', '');
        if (interaction.user.id !== targetId) {
            return interaction.reply({ content: "Ce rappel n'est pas pour toi !", ephemeral: true });
        }
        const data = rappelReports.get(interaction.message.id);
        if (!data) return interaction.reply({ content: "Ce rappel a expiré !", ephemeral: true });

        const delayMenu = new StringSelectMenuBuilder()
            .setCustomId(`rappel_delay_${targetId}`)
            .setPlaceholder('Choisis un délai...')
            .addOptions(
                { label: '15 minutes', value: '15min' },
                { label: '30 minutes', value: '30min' },
                { label: '1 heure', value: '1h' },
                { label: '2 heures', value: '2h' }
            );
        return interaction.update({ content: 'Choisis quand le rappel sera renvoyé :', components: [new ActionRowBuilder().addComponents(delayMenu)] });
    }

    // Menu Délai Rappel
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('rappel_delay_')) {
        const targetId = interaction.customId.replace('rappel_delay_', '');
        if (interaction.user.id !== targetId) return interaction.reply({ content: "Ce rappel n'est pas pour toi !", ephemeral: true });
        const data = rappelReports.get(interaction.message.id);
        if (!data) return interaction.reply({ content: "Ce rappel a expiré !", ephemeral: true });

        const value = interaction.values[0];
        let ms = 0;
        if (value.endsWith('min')) ms = parseInt(value) * 60 * 1000;
        else if (value.endsWith('h')) ms = parseInt(value) * 60 * 60 * 1000;

        await interaction.update({ content: `⏰ Rappel reporté dans **${value}**.`, components: [] });
        scheduleRappel(data.channelId, targetId, data.texte, ms);
        return true;
    }

    // Pomodoro Menu Setup
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('pomo_setup_')) {
        const parts = interaction.customId.split('_');
        const type = parts[2];
        const authorId = parts[3];
        const channelId = parts[4];

        if (interaction.user.id !== authorId) return interaction.reply({ content: "Ce menu ne t'est pas destiné !", ephemeral: true });

        const value = interaction.values[0];
        const fields = interaction.message.embeds[0].fields;
        const workVal = type === 'work' ? `${value} min` : fields[0].value;
        const breakVal = type === 'break' ? `${value} min` : fields[1].value;
        const reasonVal = type === 'reason' ? value : (fields[2]?.value ?? 'Non défini');
        const ready = workVal !== 'Non défini' && breakVal !== 'Non défini' && reasonVal !== 'Non défini';

        const embed = new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle('🍅 Configurer le Pomodoro')
            .setDescription(ready ? 'Prêt à lancer !' : 'Choisis la durée de travail et de pause !')
            .addFields(
                { name: '⏱️ Travail', value: workVal, inline: true },
                { name: '⏸️ Pause', value: breakVal, inline: true },
                { name: '🎯 Raison', value: reasonVal, inline: true }
            );

        const rows = [
            new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId(`pomo_setup_work_${authorId}_${channelId}`).setPlaceholder('Durée travail...').addOptions([5,10,15,20,25,30,35,40,45,50,55,60].map(n => ({ label: `${n} minutes`, value: `${n}` })))
            ),
            new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId(`pomo_setup_break_${authorId}_${channelId}`).setPlaceholder('Durée pause...').addOptions([5,10,15,20,25,30].map(n => ({ label: `${n} minutes`, value: `${n}` })))
            ),
            new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId(`pomo_setup_reason_${authorId}_${channelId}`).setPlaceholder('Raison...').addOptions([
                    { label: 'Devoirs', value: 'Devoirs', emoji: '📚' },
                    { label: 'Montage', value: 'Montage', emoji: '🎬' },
                    { label: 'Composition', value: 'Composition', emoji: '🎵' },
                    { label: 'Écriture', value: 'Écriture', emoji: '✍️' },
                    { label: 'Code', value: 'Code', emoji: '💻' }
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

        await interaction.update({ embeds: [embed], components: rows });
        return true;
    }

    // Pomodoro Boutons
    if (interaction.isButton() && interaction.customId.startsWith('pomo_')) {
        const parts = interaction.customId.split('_');
        const action = parts[1];

        if (action === 'start') {
            const authorId = parts[2];
            const channelId = parts[3];
            const workMin = parseInt(parts[4]);
            const breakMin = parseInt(parts[5]);
            const reason = decodeURIComponent(parts[6] ?? 'Travail');

            if (interaction.user.id !== authorId) return interaction.reply({ content: "Ce n'est pas ton pomodoro !", ephemeral: true });
            if (pomodoroSessions.has(channelId)) return interaction.reply({ content: "Un pomodoro est déjà en cours ici !", ephemeral: true });

            await interaction.message.delete().catch(() => {});
            const channel = interaction.guild.channels.cache.get(channelId);
            if (channel) await startPomodoro(channel, `<@${authorId}>`, workMin, breakMin, 1, 'work', reason);
            return true;
        }

        const channelId = parts[2];
        const session = pomodoroSessions.get(channelId);
        if (!session) return interaction.reply({ content: "Ce pomodoro n'existe plus !", ephemeral: true });

        if (action === 'stop') {
            clearTimeout(session.timeout);
            pomodoroSessions.delete(channelId);
            await session.message.delete().catch(() => {});
            return interaction.reply("⏹️ Pomodoro arrêté !");
        }

        if (action === 'skip') {
            session.skip();
            return interaction.reply({ content: "⏭️ Phase passée !", ephemeral: true });
        }
    }

    return false;
}

module.exports = {
    initToolsState,
    handleToolsMessage,
    handleToolsSlash,
    handleToolsInteraction
};