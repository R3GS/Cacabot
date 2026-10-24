/**
 * Module Activité & Profils pour Cacabot
 * Top, Actif (Jour/Semaine/Mois), Profils & Badges, Avatar, Setmessages
 */

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

let activityState = {
    topData: { messages: {} },
    dailyData: {},
    weeklyData: {},
    monthlyData: {},
    getGuildBirthdays: () => ({}),
    rouletteAchievements: new Map(),
    rouletteStats: new Map(),
    rouletteBouclierActif: new Map(),
    getMotusStats: () => ({}),
    getRebusStats: () => ({}),
    getQuotesData: () => [],
    demanderSauvegarde: () => {},
    saveAll: async () => {},
    findMemberByName: null,
    askDisambiguation: null,
    client: null,
    EPSYS_ID: '436218312574107658'
};

function initActivityState(bridge) {
    activityState = { ...activityState, ...bridge };
}

// =========================
//    HELPERS DE DATES
// =========================

function getMonthKey() {
    const parisNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    return `${parisNow.getFullYear()}-${String(parisNow.getMonth() + 1).padStart(2, '0')}`;
}

function getTodayKey() {
    const parisNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    return `${parisNow.getFullYear()}-${String(parisNow.getMonth() + 1).padStart(2, '0')}-${String(parisNow.getDate()).padStart(2, '0')}`;
}

function getWeekKey() {
    const parisNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    const startOfYear = new Date(parisNow.getFullYear(), 0, 1);
    const week = Math.ceil(((parisNow - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
    return `${parisNow.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function cleanOldData() {
    const now = new Date();
    Object.keys(activityState.dailyData).forEach(key => {
        const d = new Date(key);
        if ((now - d) / 86400000 > 7) delete activityState.dailyData[key];
    });
    const currentWeek = getWeekKey();
    const [cy, cw] = currentWeek.split('-W').map(Number);
    Object.keys(activityState.weeklyData).forEach(key => {
        const [wy, ww] = key.split('-W').map(Number);
        const diff = (cy - wy) * 52 + (cw - ww);
        if (diff > 4) delete activityState.weeklyData[key];
    });
    const currentMonth = getMonthKey();
    const [cmy, cmm] = currentMonth.split('-').map(Number);
    Object.keys(activityState.monthlyData).forEach(key => {
        const [my, mm] = key.split('-').map(Number);
        const diff = (cmy - my) * 12 + (cmm - mm);
        if (diff > 6) delete activityState.monthlyData[key];
    });
}

// =========================
//    BUILDERS D'EMBEDS
// =========================

function buildActifEmbed(periode, guild) {
    const medals = ['🥇', '🥈', '🥉'];
    let counts, titre;
    if (periode === 'jour') {
        counts = activityState.dailyData[getTodayKey()] ?? {};
        titre = "📅 Membres les plus actifs aujourd'hui";
    } else if (periode === 'semaine') {
        counts = activityState.weeklyData[getWeekKey()] ?? {};
        titre = '🗓️ Membres les plus actifs cette semaine';
    } else {
        counts = activityState.monthlyData[getMonthKey()] ?? {};
        titre = '📆 Membres les plus actifs ce mois-ci';
    }

    const sorted = Object.entries(counts)
        .filter(([uid]) => uid !== '1503495713097519355')
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    const fields = sorted.length > 0
        ? sorted.map(([uid, count], i) => {
            const member = guild.members.cache.get(uid);
            const name = member?.displayName ?? 'Membre inconnu';
            const medal = medals[i] ?? `**${i + 1}.**`;
            return { name: `${medal} ${name}`, value: `${count} messages`, inline: false };
        })
        : [{ name: 'Aucune donnée', value: 'Pas encore de messages !', inline: false }];

    return new EmbedBuilder().setColor(0xffd700).setTitle(titre).addFields(fields);
}

function buildActifRow(periode, authorId) {
    const jourBtn = new ButtonBuilder()
        .setCustomId(`actif_jour_${authorId}`)
        .setLabel('📅 Jour')
        .setStyle(periode === 'jour' ? ButtonStyle.Primary : ButtonStyle.Secondary);
    const semaineBtn = new ButtonBuilder()
        .setCustomId(`actif_semaine_${authorId}`)
        .setLabel('🗓️ Semaine')
        .setStyle(periode === 'semaine' ? ButtonStyle.Primary : ButtonStyle.Secondary);
    const moisBtn = new ButtonBuilder()
        .setCustomId(`actif_mois_${authorId}`)
        .setLabel('📆 Mois')
        .setStyle(periode === 'mois' ? ButtonStyle.Primary : ButtonStyle.Secondary);
    return new ActionRowBuilder().addComponents(jourBtn, semaineBtn, moisBtn);
}

function buildTopEmbed(page, authorId, guild) {
    const PAGE_SIZE = 10;
    const allSorted = Object.entries(activityState.topData.messages).sort((a, b) => b[1] - a[1]);
    const totalPages = Math.ceil(allSorted.length / PAGE_SIZE) || 1;

    const start = page * PAGE_SIZE;
    const slice = allSorted.slice(start, start + PAGE_SIZE);
    const medals = ['🥇', '🥈', '🥉'];
    const fields = slice.map(([uid, count], i) => {
        const member = guild?.members.cache.get(uid);
        if (!member) return null;
        const rank = start + i;
        const medal = rank < 3 ? medals[rank] : `**${rank + 1}.**`;
        return { name: `${medal} ${member.displayName}`, value: `${count} messages`, inline: false };
    }).filter(Boolean);

    const userRank = allSorted.findIndex(([uid]) => uid === authorId);
    const userCount = activityState.topData.messages[authorId] || 0;
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
}

function buildTopRow(page, authorId) {
    const PAGE_SIZE = 10;
    const allSorted = Object.entries(activityState.topData.messages).sort((a, b) => b[1] - a[1]);
    const totalPages = Math.ceil(allSorted.length / PAGE_SIZE) || 1;

    const prev = new ButtonBuilder()
        .setCustomId(`top_prev_${authorId}_${page}`)
        .setLabel('⬅️ Arrière')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0);
    const next = new ButtonBuilder()
        .setCustomId(`top_next_${authorId}_${page}`)
        .setLabel('Suivant ➡️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= totalPages - 1);
    return new ActionRowBuilder().addComponents(prev, next);
}

function buildProfilRow(cibleId, authorId, ongletActuel = 'profil') {
    const row = new ActionRowBuilder();

    if (ongletActuel === 'profil') {
        row.addComponents(
            new ButtonBuilder().setCustomId(`prof_tab_roulette_${cibleId}_${authorId}`).setLabel('🎰 Roulette').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`prof_tab_bp_${cibleId}_${authorId}`).setLabel('🎫 Battle Pass').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`prof_tab_minijeux_${cibleId}_${authorId}`).setLabel('🎮 Mini-jeux').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`prof_tab_avatar_${cibleId}_${authorId}`).setLabel('🖼️ Avatar HD').setStyle(ButtonStyle.Secondary)
        );
    } else {
        row.addComponents(
            new ButtonBuilder().setCustomId(`prof_tab_back_${cibleId}_${authorId}`).setLabel('👤 Fiche Profil').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`prof_tab_roulette_${cibleId}_${authorId}`).setLabel('🎰 Roulette').setStyle(ongletActuel === 'roulette' ? ButtonStyle.Success : ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`prof_tab_bp_${cibleId}_${authorId}`).setLabel('🎫 Battle Pass').setStyle(ongletActuel === 'bp' ? ButtonStyle.Success : ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`prof_tab_minijeux_${cibleId}_${authorId}`).setLabel('🎮 Mini-jeux').setStyle(ongletActuel === 'minijeux' ? ButtonStyle.Success : ButtonStyle.Secondary)
        );
    }

    return row;
}

function buildProfilSubEmbed(cibleUser, guild, tab) {
    const member = guild?.members.cache.get(cibleUser.id);
    const nom = member?.displayName ?? cibleUser.username;

    if (tab === 'roulette') {
        const stats = activityState.rouletteStats?.get(cibleUser.id) ?? { tirages: 0, bonus: 0, malus: 0, rien: 0, plusGrosGain: null, pireSerie: 0 };
        const userAchs = activityState.rouletteAchievements?.get(cibleUser.id) ?? {};
        const gain = stats.plusGrosGain ? `**${stats.plusGrosGain.nom}**` : '*Aucun bonus encore*';

        return new EmbedBuilder()
            .setColor(0xffd20a)
            .setTitle(`🎰 Statistiques Roulette — ${nom}`)
            .setThumbnail(cibleUser.displayAvatarURL({ dynamic: true, size: 256 }))
            .setDescription(
                `🎲 **Tirages totaux :** \`${stats.tirages}\`\n` +
                `🎉 **Bonus obtenus :** \`${stats.bonus}\`\n` +
                `💀 **Malus subis :** \`${stats.malus}\`\n` +
                `😶 **Résultats « Rien » :** \`${stats.rien}\`\n\n` +
                `🏆 **Plus gros gain :** ${gain}\n` +
                `📉 **Pire série de malchance :** \`${stats.pireSerie}\`\n` +
                `🎖️ **Succès débloqués :** \`${Object.keys(userAchs).length}/30\``
            )
            .setFooter({ text: 'Tape !rlt go pour tenter ta chance !' });
    }

    if (tab === 'bp') {
        const bpData = activityState.client?.battlePassData || {};
        const p = bpData.joueurs?.[cibleUser.id] ?? { niveau: 1, xp: 0, streak: 0, actif: false, quetesDuJour: [] };
        const barre = '🟩'.repeat(Math.min(10, Math.round((p.xp / 500) * 10))) + '⬜'.repeat(Math.max(0, 10 - Math.min(10, Math.round((p.xp / 500) * 10))));

        const quetesActives = (p.quetesDuJour || []).map(q => `${q.terminee ? '✅' : '⏳'} ${q.desc} (\`${q.progression}/${q.objectif}\`)`).join('\n') || '*Aucune quête en cours*';

        return new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle(`🎫 Battle Pass — ${nom}`)
            .setThumbnail(cibleUser.displayAvatarURL({ dynamic: true, size: 256 }))
            .setDescription(
                `⭐ **Niveau :** **Niv. ${p.niveau}/25**\n` +
                `📈 **Progression :** \`${barre}\` **${p.xp}/500 XP**\n` +
                `🔥 **Série active :** **${p.streak || 0} jour(s) consécutif(s)**\n\n` +
                `**__Quêtes Quotidiennes :__**\n${quetesActives}`
            )
            .setFooter({ text: 'Tape !bp pour ouvrir ton Battle Pass complet' });
    }

    if (tab === 'minijeux') {
        const motus = activityState.getMotusStats()[cibleUser.id] ?? { victoires: 0, parties: 0 };
        const rebus = activityState.getRebusStats()[cibleUser.id] ?? { victoires: 0, points: 0, parties: 0 };
        const scoreCombiné = (motus.victoires * 3) + rebus.points;

        return new EmbedBuilder()
            .setColor(0x00b0f4)
            .setTitle(`🎮 Mini-jeux du Serveur — ${nom}`)
            .setThumbnail(cibleUser.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                { name: '🟩 MOTUS (10h & 19h)', value: `• **Victoires :** \`${motus.victoires}\`\n• **Parties :** \`${motus.parties}\``, inline: true },
                { name: '🧩 RÉBUS (15h00)', value: `• **Points :** \`${rebus.points}\`\n• **Victoires :** \`${rebus.victoires}\``, inline: true },
                { name: '🌟 SCORE GLOBAL COMBINÉ', value: `🏆 **${scoreCombiné} points cumulés**\n-# *(3 pts / vic. Motus • 1 pt / manche Rébus)*`, inline: false }
            )
            .setFooter({ text: 'Sessions quotidiennes à 10h, 15h et 19h' });
    }

    if (tab === 'avatar') {
        return new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle(`🖼️ Avatar HD de ${nom}`)
            .setImage(cibleUser.displayAvatarURL({ dynamic: true, size: 1024 }))
            .setFooter({ text: `ID : ${cibleUser.id}` });
    }

    return buildProfilEmbed(cibleUser, guild);
}

function buildProfilEmbed(cibleUser, guild) {
    const member = guild?.members.cache.get(cibleUser.id);
    const joinedAt = member?.joinedAt
        ? member.joinedAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
        : 'Inconnue';
    const createdAt = cibleUser.createdAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    const roles = member?.roles.cache
        .filter(r => r.id !== guild.id)
        .sort((a, b) => b.position - a.position)
        .map(r => `<@&${r.id}>`)
        .slice(0, 5)
        .join(' ') || 'Aucun';

    const nbMessages = activityState.topData.messages[cibleUser.id] ?? 0;

    const guildBirthdays = activityState.getGuildBirthdays(guild.id);
    const birthdayRaw = guildBirthdays[cibleUser.id];
    const moisNoms = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    let birthdayStr = 'Inconnu';
    if (birthdayRaw) {
        const [j, m] = birthdayRaw.split('/').map(Number);
        birthdayStr = `${j} ${moisNoms[m - 1]}`;
    }

    // Vérification rétroactive des succès roulette
    let userAchs = activityState.rouletteAchievements.get(cibleUser.id);
    if (!userAchs) {
        userAchs = {};
        activityState.rouletteAchievements.set(cibleUser.id, userAchs);
    }
    const rStats = activityState.rouletteStats.get(cibleUser.id);
    const nbTirages = rStats?.tirages ?? 0;
    if (nbTirages >= 250 && !userAchs['veteran-250']) userAchs['veteran-250'] = Date.now();
    if (nbTirages >= 500 && !userAchs['centurion-500']) userAchs['centurion-500'] = Date.now();
    const nbBoucliersRes = activityState.rouletteBouclierActif.get(cibleUser.id) || 0;
    if (nbBoucliersRes >= 10 && !userAchs['forteresse']) userAchs['forteresse'] = Date.now();

    // Calcul des Succès du serveur
    const badges = [];
    if (cibleUser.id === activityState.EPSYS_ID) badges.push('• 👑 Créatrice du serveur et de Cacabot');
    if (nbTirages >= 500) badges.push('• 🎰 Gambling Addict (500+ tirages)');
    else if (nbTirages >= 100) badges.push('• 🎰 Habitué.e de la Roulette (100+ tirages)');

    const nbAchs = Object.keys(userAchs).length;
    if (nbAchs >= 15) badges.push(`• 🏆 Trophy Hunter (${nbAchs}/30 succès)`);
    else if (nbAchs >= 5) badges.push(`• 🤠 Aventurier.e de la Roulette (${nbAchs}/30 succès)`);

    const mStats = activityState.getMotusStats()[cibleUser.id];
    const nbVictoires = mStats?.victoires ?? 0;
    if (nbVictoires >= 10) badges.push(`• 🟩 Motus Master (${nbVictoires} victoires)`);
    else if (nbVictoires >= 3) badges.push(`• 🟨 Débutant.e du Motus (${nbVictoires} victoires)`);

    const rRebus = activityState.getRebusStats()[cibleUser.id];
    const nbTop1 = rRebus?.victoires ?? 0;
    if (nbTop1 >= 10) badges.push(`• 🥇 Maître du Rébus (10 médailles d'or)`);
    else if (nbTop1 >= 5) badges.push(`• 🥇 Expert.e du Rébus (5 médailles d'or)`);
    else if (nbTop1 >= 3) badges.push(`• 🥇 As du Rébus (3 médailles d'or)`);

    const nbQuotes = activityState.getQuotesData().filter(q => q.authorId === cibleUser.id).length;
    if (nbQuotes >= 5) badges.push(`• 📜 Légende (${nbQuotes} citations)`);

    if (nbMessages >= 5000) badges.push('• 🗣️ Monument de Regaïa (5 000+ messages)');
    else if (nbMessages >= 1000) badges.push('• 💬 Membre Bavard.e (1 000+ messages)');
    else if (nbMessages >= 250) badges.push('• 🌱 Jeune membre (250+ messages)');

    return new EmbedBuilder()
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
}

// =========================
//    HANDLER MESSAGES (!)
// =========================

async function handleActivityMessage(message, response) {
    // !profil
    if (response?.needsProfil) {
        let cible = message.mentions.users.first();
        if (!cible) {
            const args = message.content.trim().split(/\s+/).slice(1).join(" ");
            if (args.length > 0 && activityState.findMemberByName) {
                const result = activityState.findMemberByName(message.guild, args);
                if (result.multiple && activityState.askDisambiguation) {
                    activityState.askDisambiguation(message, message.guild, result.candidates, (user) => {
                        const embed = buildProfilEmbed(user, message.guild);
                        const row = buildProfilRow(user.id, message.author.id, 'profil');
                        message.reply({ embeds: [embed], components: [row] });
                    });
                    return true;
                }
                if (result.found) cible = result.found.user;
            }
        }
        if (!cible) cible = message.author;
        const embed = buildProfilEmbed(cible, message.guild);
        const row = buildProfilRow(cible.id, message.author.id, 'profil');
        await message.reply({ embeds: [embed], components: [row] });
        return true;
    }

    // !avatar
    if (response?.needsAvatar) {
        let cible = message.mentions.users.first();
        if (!cible) {
            const args = message.content.trim().split(/\s+/).slice(1).join(" ");
            if (args.length > 0 && activityState.findMemberByName) {
                const result = activityState.findMemberByName(message.guild, args);
                if (result.multiple && activityState.askDisambiguation) {
                    activityState.askDisambiguation(message, message.guild, result.candidates, (user) => {
                        const embed = new EmbedBuilder().setColor(0x5865f2).setImage(user.displayAvatarURL({ dynamic: true, size: 1024 }));
                        message.reply({ embeds: [embed] });
                    });
                    return true;
                }
                if (result.found) cible = result.found.user;
            }
        }
        if (!cible) cible = message.author;
        const embed = new EmbedBuilder().setColor(0x5865f2).setImage(cible.displayAvatarURL({ dynamic: true, size: 1024 }));
        await message.reply({ embeds: [embed] });
        return true;
    }

    // !actif
    if (response?.needsActif) {
        cleanOldData();
        const authorId = message.author.id;
        await message.reply({
            embeds: [buildActifEmbed('jour', message.guild)],
            components: [buildActifRow('jour', authorId)]
        });
        return true;
    }

    // !top
    if (response?.needsTop) {
        const allSorted = Object.entries(activityState.topData.messages).sort((a, b) => b[1] - a[1]);
        if (allSorted.length === 0) {
            await message.reply("Pas encore de données !");
            return true;
        }
        const totalPages = Math.ceil(allSorted.length / 10);
        await message.reply({
            embeds: [buildTopEmbed(0, message.author.id, message.guild)],
            components: totalPages > 1 ? [buildTopRow(0, message.author.id)] : []
        });
        return true;
    }

    // !setmessages
    if (response?.needsSetMessages) {
        if (message.author.id !== activityState.EPSYS_ID) {
            await message.reply("Cette commande est réservée à Epsys.");
            return true;
        }
        const args = message.content.trim().split(/\s+/);
        const rawCount = args[args.length - 1];
        const count = Number(rawCount);
        const cible = message.mentions.users.first();
        const targetId = cible ? cible.id : args[1];

        if (!targetId || !/^\d+$/.test(rawCount) || !Number.isSafeInteger(count)) {
            await message.reply("Usage : `!setmessages @Membre NombreDeMessages` ou `!setmessages ID NombreDeMessages`");
            return true;
        }

        activityState.topData.messages[targetId] = count;
        activityState.demanderSauvegarde();

        const member = message.guild?.members.cache.get(targetId);
        const nom = member?.displayName ?? targetId;
        await message.reply(`✅ **${nom}** : ${count} messages enregistrés !`);
        return true;
    }

    return false;
}

// =========================
//    HANDLER SLASH (/)
// =========================

async function handleActivitySlash(interaction) {
    const { commandName } = interaction;

    if (commandName === 'profil' || commandName === 'profile') {
        const cibleUser = interaction.options.getUser('membre') ?? interaction.user;
        const embed = buildProfilEmbed(cibleUser, interaction.guild);
        const row = buildProfilRow(cibleUser.id, interaction.user.id, 'profil');
        return interaction.reply({ embeds: [embed], components: [row] });
    }

    if (commandName === 'top') {
        const allSorted = Object.entries(activityState.topData.messages).sort((a, b) => b[1] - a[1]);
        if (allSorted.length === 0) return interaction.reply({ content: "Pas encore de données !", ephemeral: true });
        const totalPages = Math.ceil(allSorted.length / 10);
        return interaction.reply({
            embeds: [buildTopEmbed(0, interaction.user.id, interaction.guild)],
            components: totalPages > 1 ? [buildTopRow(0, interaction.user.id)] : []
        });
    }

    if (commandName === 'actif') {
        cleanOldData();
        return interaction.reply({
            embeds: [buildActifEmbed('jour', interaction.guild)],
            components: [buildActifRow('jour', interaction.user.id)]
        });
    }

    if (commandName === 'avatar') {
        const cible = interaction.options.getUser('membre') ?? interaction.user;
        const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle(`Avatar de ${cible.username}`)
            .setImage(cible.displayAvatarURL({ dynamic: true, size: 1024 }));
        return interaction.reply({ embeds: [embed] });
    }

    return false;
}

// =========================
//    HANDLER BOUTONS
// =========================

async function handleActivityButton(interaction) {
    // Boutons de navigation du Profil
    if (interaction.isButton() && interaction.customId.startsWith('prof_tab_')) {
        const parts = interaction.customId.split('_');
        const tab = parts[2];
        const cibleId = parts[3];
        const authorId = parts[4];

        if (interaction.user.id !== authorId) {
            return interaction.reply({ content: "Ce profil ne t'est pas destiné 😌", ephemeral: true });
        }

        const cibleUser = interaction.guild?.members.cache.get(cibleId)?.user 
                       || await interaction.client.users.fetch(cibleId).catch(() => null);

        if (!cibleUser) return interaction.reply({ content: "Membre introuvable !", ephemeral: true });

        const embed = (tab === 'back') 
            ? buildProfilEmbed(cibleUser, interaction.guild) 
            : buildProfilSubEmbed(cibleUser, interaction.guild, tab);

        const row = buildProfilRow(cibleId, authorId, tab === 'back' ? 'profil' : tab);
        await interaction.update({ embeds: [embed], components: [row] });
        return true;
    }

    // Boutons Actif
    if (interaction.isButton() && (interaction.customId.startsWith('actif_jour_') || interaction.customId.startsWith('actif_semaine_') || interaction.customId.startsWith('actif_mois_'))) {
        const parts = interaction.customId.split('_');
        const periode = parts[1];
        const authorId = parts[2];

        if (interaction.user.id !== authorId) {
            return interaction.reply({ content: "Ce bouton ne t'est pas destiné !", ephemeral: true });
        }

        return interaction.update({
            embeds: [buildActifEmbed(periode, interaction.guild)],
            components: [buildActifRow(periode, authorId)]
        });
    }

    // Boutons Top
    if (interaction.isButton() && (interaction.customId.startsWith('top_prev_') || interaction.customId.startsWith('top_next_'))) {
        const parts = interaction.customId.split('_');
        const direction = parts[1];
        const authorId = parts[2];
        const currentPage = parseInt(parts[3]);

        if (interaction.user.id !== authorId) {
            return interaction.reply({ content: "Ce bouton ne t'est pas destiné !", ephemeral: true });
        }

        const newPage = direction === 'next' ? currentPage + 1 : currentPage - 1;
        return interaction.update({
            embeds: [buildTopEmbed(newPage, authorId, interaction.guild)],
            components: [buildTopRow(newPage, authorId)]
        });
    }

    return false;
}

module.exports = {
    initActivityState,
    handleActivityMessage,
    handleActivitySlash,
    handleActivityButton,
    cleanOldData,
    getTodayKey,
    getWeekKey,
    getMonthKey
};