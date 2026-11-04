/**
 * Module Bienvenue pour Cacabot
 * Affiche de bienvenue Canvas, configuration et commandes !welcome / /welcome
 */

const fs = require('fs');
const path = require('path');
const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ChannelSelectMenuBuilder,
    UserSelectMenuBuilder,
    ChannelType,
    ButtonStyle,
    MessageFlags
} = require('discord.js');

const ROLE_MEMBRE_REGAIEN = '720080477926457476';
const { createCanvas, loadImage, registerFont } = require('canvas');

// ==========================================
//  ENREGISTREMENT SÉCURISÉ DE LA POLICE
// ==========================================
let lemonMilkChargee = false;
const cheminsPossiblesPolice = [
    './LEMONMILK-Bold.otf',
    './LemonMilk-Bold.otf',
    './lemonmilk-bold.otf',
    './LEMONMILK.otf',
    './LemonMilk.otf',
    './lemonmilk.otf',
    './assets/LEMONMILK-Bold.otf',
    './assets/LemonMilk-Bold.otf'
];

for (const chemin of cheminsPossiblesPolice) {
    if (fs.existsSync(chemin)) {
        try {
            registerFont(chemin, { family: 'LemonMilk', weight: 'bold' });
            registerFont(chemin, { family: 'LEMONMILK', weight: 'bold' });
            lemonMilkChargee = true;
            console.log(`[Welcome] ✅ Police LemonMilk chargée depuis ${chemin}`);
            break;
        } catch (e) {
            console.error(`[Welcome] Échec du chargement de la police depuis ${chemin} :`, e.message);
        }
    }
}

if (!lemonMilkChargee) {
    console.warn("[Welcome] Attention : La police LemonMilk est introuvable. Police par défaut utilisée.");
}

const WELCOME_BACKGROUNDS = [
    ['./DHMISWelcome.png', './dhmiswelcome.png'],
    ['./EndacopiaWelcome.png', './endacopiawelcome.png'],
    ['./FNAFWelcome.png', './fnafwelcome.png'],
    ['./KinitoPETWelcome.png', './kinitopetwelcome.png'],
    ['./MouthwashingWelcome.png', './mouthwashingwelcome.png'],
    ['./PoppyWelcome.png', './poppywelcome.png'],
    ['./UndertaleWelcome.png', './undertalewelcome.png']
];

let welcomeState = {
    getWelcomeData: () => ({ channelId: null, actif: true }),
    getReactionRolesData: () => ({}),
    demanderSauvegarde: () => {},
    EPSYS_ID: '436218312574107658'
};

function initWelcomeState(bridge) {
    welcomeState = { ...welcomeState, ...bridge };
}

// ==========================================
//  UTILITAIRES DE RATTRAPAGE DES RÔLES-RÉACTIONS
// ==========================================

function trouverRoleIdPourReaction(rolesMap, reaction) {
    if (!rolesMap) return null;
    const name = reaction.emoji.name;
    const id = reaction.emoji.id;
    const customKey = id ? `<:${name}:${id}>` : null;
    const animKey = id ? `<a:${name}:${id}>` : null;

    if (customKey && rolesMap[customKey]) return rolesMap[customKey];
    if (animKey && rolesMap[animKey]) return rolesMap[animKey];
    if (id && rolesMap[id]) return rolesMap[id];
    if (name && rolesMap[name]) return rolesMap[name];

    for (const [key, rId] of Object.entries(rolesMap)) {
        if (id && key.includes(id)) return rId;
        if (name && key === name) return rId;
    }
    return null;
}

/**
 * Scanne tous les messages de rôles-réactions configurés pour un membre spécifique
 */
async function synchroniserRolesMembre(member) {
    const reactionRolesData = welcomeState.getReactionRolesData?.() ?? {};
    const rolesAjoutes = [];
    if (!member || !member.guild) return rolesAjoutes;

    for (const [msgId, config] of Object.entries(reactionRolesData)) {
        if (!config?.channelId || !config?.roles) continue;
        const channel = member.guild.channels.cache.get(config.channelId) 
            ?? await member.guild.channels.fetch(config.channelId).catch(() => null);
        if (!channel?.isTextBased()) continue;

        const msg = await channel.messages.fetch(msgId).catch(() => null);
        if (!msg) continue;

        for (const reaction of msg.reactions.cache.values()) {
            const roleId = trouverRoleIdPourReaction(config.roles, reaction);
            if (!roleId || member.roles.cache.has(roleId)) continue;

            try {
                const users = await reaction.users.fetch();
                if (users.has(member.id)) {
                    await member.roles.add(roleId).catch(() => {});
                    const roleObj = member.guild.roles.cache.get(roleId);
                    rolesAjoutes.push(roleObj ? roleObj.name : roleId);
                }
            } catch (e) {}
        }
    }
    return rolesAjoutes;
}

/**
 * Scanne tous les rôles-réactions du serveur et rattrape tous les membres
 */
async function synchroniserTousLesRoles(guild) {
    const reactionRolesData = welcomeState.getReactionRolesData?.() ?? {};
    let totalAttribues = 0;
    const detailsMembres = new Map(); // memberId -> [nomRoles]

    for (const [msgId, config] of Object.entries(reactionRolesData)) {
        if (!config?.channelId || !config?.roles) continue;
        const channel = guild.channels.cache.get(config.channelId) 
            ?? await guild.channels.fetch(config.channelId).catch(() => null);
        if (!channel?.isTextBased()) continue;

        const msg = await channel.messages.fetch(msgId).catch(() => null);
        if (!msg) continue;

        for (const reaction of msg.reactions.cache.values()) {
            const roleId = trouverRoleIdPourReaction(config.roles, reaction);
            if (!roleId) continue;

            const roleObj = guild.roles.cache.get(roleId);
            const roleName = roleObj ? roleObj.name : roleId;

            try {
                const users = await reaction.users.fetch();
                for (const user of users.values()) {
                    if (user.bot) continue;
                    const member = guild.members.cache.get(user.id) ?? await guild.members.fetch(user.id).catch(() => null);
                    if (member && !member.roles.cache.has(roleId)) {
                        await member.roles.add(roleId).catch(() => {});
                        totalAttribues++;
                        if (!detailsMembres.has(member.id)) detailsMembres.set(member.id, []);
                        detailsMembres.get(member.id).push(roleName);
                    }
                }
            } catch (e) {}
        }
    }
    return { totalAttribues, detailsMembres };
}

async function chargerImageSecurisee(variantes) {
    for (const v of variantes) {
        try {
            if (fs.existsSync(v)) {
                return await loadImage(v);
            }
        } catch (e) {}
    }
    // Dernier essai direct au cas où
    for (const v of variantes) {
        try {
            return await loadImage(v);
        } catch (e) {}
    }
    return null;
}

async function generateWelcomeImage(avatarUrl, memberName) {
    try {
        const overlay = await chargerImageSecurisee([
            './Bienvenue.png',
            './bienvenue.png',
            './assets/Bienvenue.png',
            './assets/bienvenue.png'
        ]);
        if (!overlay) {
            throw new Error("L'image 'Bienvenue.png' est introuvable à la racine de ton bot !");
        }
        const w = overlay.width;
        const h = overlay.height;

        const canvas = createCanvas(w, h);
        const ctx = canvas.getContext('2d');

        // Fond aléatoire ou dégradé de secours
        const bgVariantes = WELCOME_BACKGROUNDS[Math.floor(Math.random() * WELCOME_BACKGROUNDS.length)];
        const bgImg = await chargerImageSecurisee(bgVariantes);
        if (bgImg) {
            ctx.drawImage(bgImg, 0, 0, w, h);
        } else {
            const grad = ctx.createLinearGradient(0, 0, w, h);
            grad.addColorStop(0, '#750000');
            grad.addColorStop(0.5, '#400000');
            grad.addColorStop(1, '#111111');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);
        }

        // Avatar circulaire
        const centerX = 1024;
        const centerY = 349.5;
        const radius = 255;

        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();

        try {
            const avatarImg = await loadImage(avatarUrl);
            ctx.drawImage(avatarImg, centerX - radius, centerY - radius, radius * 2, radius * 2);
        } catch (err) {
            ctx.fillStyle = '#2c2f33';
            ctx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
        }
        ctx.restore();

        // Cadre Bienvenue par-dessus
        ctx.drawImage(overlay, 0, 0, w, h);

        // Texte du pseudo
        const cleanName = (memberName || 'NOUVEAU MEMBRE').toUpperCase();
        let fontSize = 95;

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Lemon Milk Bold pur (nom officiel du fichier OTF)
        ctx.font = `${fontSize}px "LEMON MILK", LemonMilk`;

        // Réduction automatique si le pseudo est trop long
        const maxTextWidth = 1350;
        while (ctx.measureText(cleanName).width > maxTextWidth && fontSize > 40) {
            fontSize -= 5;
            ctx.font = `${fontSize}px "LEMON MILK", LemonMilk`;
        }

        const posY = 830;

        // Ombre portée puissante à distance 0 (halo noir intense centré)
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 22;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // Texte blanc pur
        ctx.fillStyle = '#ffffff';
        ctx.fillText(cleanName, centerX, posY);
        ctx.restore();

        return canvas.toBuffer('image/png');
    } catch (err) {
        throw err;
    }
}

function buildWelcomeConfigEmbed() {
    const data = welcomeState.getWelcomeData();
    const salonStr = data.channelId ? `<#${data.channelId}>` : '*Aucun salon configuré*';
    const statutStr = data.actif ? '🟢 **Activé**' : '🔴 **Désactivé**';

    return new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('👋 Configuration des messages de Bienvenue')
        .setDescription(
            `Configure le salon où Cacabot enverra automatiquement la carte de bienvenue lorsqu'un nouveau membre rejoint le serveur.\n\n` +
            `• **Statut actuel :** ${statutStr}\n` +
            `• **Salon actuel :** ${salonStr}\n` +
            `• **Rôle donné à l'arrivée :** <@&${ROLE_MEMBRE_REGAIEN}> *(Regaïen.ne)*\n\n` +
            `*💡 Si Cacabot était éteint lors de l'arrivée d'un membre, clique sur le bouton rouge ci-dessous pour le régulariser.*`
        )
        .setFooter({ text: 'Panneau réservé à Epsys' });
}

function buildWelcomeConfigRows() {
    const data = welcomeState.getWelcomeData();

    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('welcome_select_channel')
        .setPlaceholder('Choisis le salon de bienvenue...')
        .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);

    const toggleBtn = new ButtonBuilder()
        .setCustomId('welcome_toggle_active')
        .setLabel(data.actif ? '🔴 Désactiver' : '🟢 Activer')
        .setStyle(data.actif ? ButtonStyle.Danger : ButtonStyle.Success);

    const testBtn = new ButtonBuilder()
        .setCustomId('welcome_test_btn')
        .setLabel('🖼️ Tester l\'affiche')
        .setStyle(ButtonStyle.Primary);

    const emergencyBtn = new ButtonBuilder()
        .setCustomId('welcome_emergency_menu')
        .setLabel('🚨 Menu d\'urgence (Rattrapage)')
        .setStyle(ButtonStyle.Danger);

    return [
        new ActionRowBuilder().addComponents(channelSelect),
        new ActionRowBuilder().addComponents(toggleBtn, testBtn, emergencyBtn)
    ];
}

async function buildEmergencyMenuEmbed(guild) {
    let membres = [];
    try {
        const tous = await guild.members.fetch({ limit: 50 }).catch(() => guild.members.cache);
        membres = Array.from(tous.values())
            .filter(m => !m.user.bot)
            .sort((a, b) => (b.joinedTimestamp || 0) - (a.joinedTimestamp || 0))
            .slice(0, 8);
    } catch (e) {
        membres = Array.from(guild.members.cache.values())
            .filter(m => !m.user.bot)
            .sort((a, b) => (b.joinedTimestamp || 0) - (a.joinedTimestamp || 0))
            .slice(0, 8);
    }

    const desc = membres.map((m, idx) => {
        const aRole = m.roles.cache.has(ROLE_MEMBRE_REGAIEN);
        const dateStr = m.joinedTimestamp ? `<t:${Math.floor(m.joinedTimestamp / 1000)}:R>` : 'Inconnue';
        const roleStatus = aRole ? '`✅ Rôle attribué`' : '`⚠️ Aucun rôle / Non accueilli`';
        return `**${idx + 1}.** <@${m.id}> (${m.displayName}) — ${dateStr}\n└ ${roleStatus}`;
    }).join('\n\n');

    return new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('🚨 Menu d\'Urgence — Rattrapage des Nouveaux Membres')
        .setDescription(
            `Ce menu permet d'accueillir manuellement un membre arrivé pendant une panne de Cacabot.\n\n` +
            `### 📋 Derniers membres ayant rejoint le serveur :\n${desc || '*Aucun membre trouvé.*'}\n\n` +
            `👉 **Sélectionne ci-dessous le membre à accueillir / rattraper :**`
        )
        .setFooter({ text: 'Étape 1/2 : Sélection du membre' });
}

function buildEmergencyMenuRows() {
    const userSelect = new UserSelectMenuBuilder()
        .setCustomId('welcome_emergency_select_user')
        .setPlaceholder('Sélectionne le membre arrivé pendant la coupure...')
        .setMinValues(1)
        .setMaxValues(1);

    const syncRolesBtn = new ButtonBuilder()
        .setCustomId('welcome_emergency_sync_all_rr')
        .setLabel('🔄 Rattraper tous les rôles-réactions')
        .setStyle(ButtonStyle.Primary);

    const backBtn = new ButtonBuilder()
        .setCustomId('welcome_back_config')
        .setLabel('⬅️ Retour configuration')
        .setStyle(ButtonStyle.Secondary);

    return [
        new ActionRowBuilder().addComponents(userSelect),
        new ActionRowBuilder().addComponents(syncRolesBtn, backBtn)
    ];
}

// =========================
//  GESTION DES MESSAGES (!)
// =========================
async function handleWelcomeMessage(message, response) {
    const raw = message.content.trim();
    const command = raw.split(/\s+/)[0]?.toLowerCase();

    if (command !== '!welcome' && command !== '!bienvenue' && !response?.needsWelcome) {
        return false;
    }

    if (message.author.id !== welcomeState.EPSYS_ID) {
        await message.reply("Cette commande est réservée à Epsys.");
        return true;
    }

    const subCmd = raw.split(/\s+/)[1]?.toLowerCase();
    if (subCmd === 'test') {
        try {
            const args = raw.split(/\s+/);
            const query = args.slice(2).join(" ").trim();
            let cibleMembre = message.mentions.members.first();

            if (!cibleMembre && query) {
                const q = query.toLowerCase();
                cibleMembre = message.guild?.members.cache.find(m =>
                    (m.displayName && m.displayName.toLowerCase().includes(q)) ||
                    (m.user.username && m.user.username.toLowerCase().includes(q))
                );
            }
            if (!cibleMembre) cibleMembre = message.member;

            const avatarUrl = cibleMembre.user.displayAvatarURL({ extension: 'png', size: 512 });
            const cardBuffer = await generateWelcomeImage(avatarUrl, cibleMembre.displayName ?? cibleMembre.user.username);
            await message.reply({ 
                content: `🖼️ **Affiche test pour ${cibleMembre.displayName} :**`,
                files: [{ attachment: cardBuffer, name: 'bienvenue.png' }] 
            });
        } catch (err) {
            console.error("Erreur welcome test :", err);
            await message.reply(`❌ **Erreur d'affiche :** \`${err.message}\``);
        }
        return true;
    }

    await message.reply({
        embeds: [buildWelcomeConfigEmbed()],
        components: buildWelcomeConfigRows()
    });
    return true;
}

// =========================
//  GESTION DES SLASHS (/)
// =========================
async function handleWelcomeSlash(interaction) {
    if (interaction.commandName !== 'welcome') return false;

    if (interaction.user.id !== welcomeState.EPSYS_ID) {
        await interaction.reply({ content: "Cette commande est réservée à Epsys.", ephemeral: true });
        return true;
    }

    const sub = interaction.options.getSubcommand(false);
    if (sub === 'test') {
        await interaction.deferReply();
        try {
            const cibleUser = interaction.options.getUser('membre') ?? interaction.user;
            const cibleMembre = interaction.guild?.members.cache.get(cibleUser.id) ?? interaction.member;
            const avatarUrl = cibleUser.displayAvatarURL({ extension: 'png', size: 512 });
            const cardBuffer = await generateWelcomeImage(avatarUrl, cibleMembre?.displayName ?? cibleUser.username);
            await interaction.editReply({ 
                content: `🖼️ **Affiche test pour ${cibleMembre?.displayName ?? cibleUser.username} :**`,
                files: [{ attachment: cardBuffer, name: 'bienvenue.png' }] 
            });
        } catch (err) {
            await interaction.editReply({ content: `❌ **Erreur :** \`${err.message}\`` });
        }
        return true;
    }

    await interaction.reply({
        embeds: [buildWelcomeConfigEmbed()],
        components: buildWelcomeConfigRows(),
        ephemeral: true
    });
    return true;
}

// =========================
//  GESTION DES INTERACTIONS
// =========================
async function handleWelcomeInteraction(interaction) {
    const customId = interaction.customId;
    if (!customId || !customId.startsWith('welcome_')) return false;

    if (interaction.user.id !== welcomeState.EPSYS_ID) {
        await interaction.reply({ content: "Seule Epsys a accès à ce panneau.", ephemeral: true });
        return true;
    }

    // Retour au menu principal
    if (interaction.isButton() && customId === 'welcome_back_config') {
        await interaction.update({
            embeds: [buildWelcomeConfigEmbed()],
            components: buildWelcomeConfigRows()
        });
        return true;
    }

    // Configuration du salon par défaut
    if (interaction.isChannelSelectMenu() && customId === 'welcome_select_channel') {
        const data = welcomeState.getWelcomeData();
        data.channelId = interaction.values[0];
        welcomeState.demanderSauvegarde();
        await interaction.update({
            embeds: [buildWelcomeConfigEmbed()],
            components: buildWelcomeConfigRows()
        });
        return true;
    }

    // Activer / Désactiver
    if (interaction.isButton() && customId === 'welcome_toggle_active') {
        const data = welcomeState.getWelcomeData();
        data.actif = !data.actif;
        welcomeState.demanderSauvegarde();
        await interaction.update({
            embeds: [buildWelcomeConfigEmbed()],
            components: buildWelcomeConfigRows()
        });
        return true;
    }

    // Tester l'affiche
    if (interaction.isButton() && customId === 'welcome_test_btn') {
        await interaction.deferReply({ ephemeral: true });
        try {
            const avatarUrl = interaction.user.displayAvatarURL({ extension: 'png', size: 512 });
            const cardBuffer = await generateWelcomeImage(avatarUrl, interaction.member?.displayName ?? interaction.user.username);
            await interaction.editReply({ files: [{ attachment: cardBuffer, name: 'bienvenue.png' }] });
        } catch (err) {
            console.error("Erreur bouton welcome test :", err);
            await interaction.editReply({ content: `❌ **Erreur d'affiche :** \`${err.message}\`` });
        }
        return true;
    }

    // ------------------------------------------
    // 1. OUVERTURE DU MENU D'URGENCE
    // ------------------------------------------
    if (interaction.isButton() && customId === 'welcome_emergency_menu') {
        await interaction.deferUpdate();
        const embed = await buildEmergencyMenuEmbed(interaction.guild);
        await interaction.editReply({
            embeds: [embed],
            components: buildEmergencyMenuRows()
        });
        return true;
    }

    // ------------------------------------------
    // 2. CHOIX DU MEMBRE -> DEMANDE DU SALON
    // ------------------------------------------
    if (interaction.isUserSelectMenu() && customId === 'welcome_emergency_select_user') {
        const targetUserId = interaction.values[0];
        const targetMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);

        if (!targetMember) {
            await interaction.reply({ content: "❌ Impossible de trouver ce membre sur le serveur.", ephemeral: true });
            return true;
        }

        const data = welcomeState.getWelcomeData();
        const aRole = targetMember.roles.cache.has(ROLE_MEMBRE_REGAIEN);

        const stepEmbed = new EmbedBuilder()
            .setColor(0xf1c40f)
            .setTitle(`🎯 Rattrapage de Bienvenue : ${targetMember.displayName}`)
            .setDescription(
                `Membre sélectionné : <@${targetMember.id}> (\`${targetMember.user.tag}\`)\n` +
                `• **Arrivé(e) :** ${targetMember.joinedTimestamp ? `<t:${Math.floor(targetMember.joinedTimestamp / 1000)}:R>` : '*Inconnue*'}\n` +
                `• **Statut rôle Regaïen.ne :** ${aRole ? '✅ Déjà attribué' : '❌ Non attribué'}\n\n` +
                `**Ce que Cacabot va faire :**\n` +
                `1. 🏷️ Attribuer le rôle <@&${ROLE_MEMBRE_REGAIEN}> (Regaïen.ne)\n` +
                `2. 🖼️ Générer la bannière Canvas personnalisée avec son avatar\n` +
                `3. 🚀 Envoyer le panneau d'accueil dans le salon sélectionné\n\n` +
                `👉 **Choisis ci-dessous le salon dans lequel envoyer le panneau :**`
            )
            .setThumbnail(targetMember.user.displayAvatarURL({ extension: 'png', size: 256 }))
            .setFooter({ text: 'Étape 2/2 : Destination de l\'affiche' });

        const chanSelect = new ChannelSelectMenuBuilder()
            .setCustomId(`welcome_emergency_send_chan_${targetMember.id}`)
            .setPlaceholder('Choisis le salon où envoyer le panneau...')
            .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);

        const rowButtons = new ActionRowBuilder();
        if (data.channelId) {
            rowButtons.addComponents(
                new ButtonBuilder()
                    .setCustomId(`welcome_emergency_send_def_${targetMember.id}`)
                    .setLabel(`🚀 Salon par défaut (<#${data.channelId}>)`)
                    .setStyle(ButtonStyle.Success)
            );
        }
        rowButtons.addComponents(
            new ButtonBuilder()
                .setCustomId('welcome_emergency_menu')
                .setLabel('⬅️ Choisir un autre membre')
                .setStyle(ButtonStyle.Secondary)
        );

        const rows = [new ActionRowBuilder().addComponents(chanSelect), rowButtons];

        await interaction.update({ embeds: [stepEmbed], components: rows });
        return true;
    }

    // ------------------------------------------
    // 2bis. RATTRAPAGE GLOBAL DES RÔLES-RÉACTIONS
    // ------------------------------------------
    if (customId === 'welcome_emergency_sync_all_rr') {
        await interaction.deferUpdate();

        const resultat = await synchroniserTousLesRoles(interaction.guild);

        let desc = `### 🔄 Scan des rôles-réactions terminé !\n\n`;
        if (resultat.totalAttribues === 0) {
            desc += `✅ **Tous les membres sont déjà à jour.** Aucune réaction manquée n'a été détectée.`;
        } else {
            desc += `🎉 **${resultat.totalAttribues} rôle(s)** ont été rattrapés pour **${resultat.detailsMembres.size} membre(s)** pendant la coupure :\n\n`;
            let count = 0;
            for (const [memberId, roles] of resultat.detailsMembres.entries()) {
                if (count++ >= 10) {
                    desc += `*... et d'autres membres.*\n`;
                    break;
                }
                desc += `• <@${memberId}> : +${roles.join(', ')}\n`;
            }
        }

        const embedRes = new EmbedBuilder()
            .setColor(0x57f287)
            .setTitle('🛡️ Synchronisation des Rôles-Réactions')
            .setDescription(desc)
            .setFooter({ text: 'Rattrapage automatique Cacabot' });

        const rowRetour = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('welcome_emergency_menu').setLabel('🚨 Retour Menu d\'urgence').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('welcome_back_config').setLabel('🏠 Retour configuration').setStyle(ButtonStyle.Secondary)
        );

        await interaction.editReply({ embeds: [embedRes], components: [rowRetour] });
        return true;
    }

    // ------------------------------------------
    // 3. EXÉCUTION DU RATTRAPAGE (RÔLE + RÉACTIONS + CANVAS + ENVOI)
    // ------------------------------------------
    if (customId.startsWith('welcome_emergency_send_chan_') || customId.startsWith('welcome_emergency_send_def_')) {
        await interaction.deferUpdate();

        const data = welcomeState.getWelcomeData();
        const isDefault = customId.startsWith('welcome_emergency_send_def_');
        const targetUserId = isDefault
            ? customId.replace('welcome_emergency_send_def_', '')
            : customId.replace('welcome_emergency_send_chan_', '');

        const targetChanId = isDefault ? data.channelId : interaction.values[0];
        const targetChan = interaction.guild.channels.cache.get(targetChanId) ?? await interaction.guild.channels.fetch(targetChanId).catch(() => null);
        const targetMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);

        if (!targetMember || !targetChan) {
            await interaction.editReply({
                embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle('❌ Erreur').setDescription("Impossible de trouver le membre ou le salon cible.")],
                components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('welcome_emergency_menu').setLabel('⬅️ Recommencer').setStyle(ButtonStyle.Primary))]
            });
            return true;
        }

        // 1. Attribution automatique du rôle Regaïen.ne
        let roleAttribue = false;
        if (!targetMember.roles.cache.has(ROLE_MEMBRE_REGAIEN)) {
            await targetMember.roles.add(ROLE_MEMBRE_REGAIEN, 'Rattrapage d’urgence (Cacabot)').catch((err) => {
                console.error("[Welcome] Erreur attribution rôle rattrapage :", err.message);
            });
            roleAttribue = true;
        }

        // 2. Rattrapage des rôles-réactions cliqués pendant la coupure par ce membre
        const rolesReactionsRecup = await synchroniserRolesMembre(targetMember);
        const rolesReactionsTexte = rolesReactionsRecup.length > 0
            ? `\n• 🎭 **Rôles-réactions rattrapés :** +${rolesReactionsRecup.join(', ')}`
            : '';

        // 3. Génération et envoi de l'image
        try {
            const avatarUrl = targetMember.user.displayAvatarURL({ extension: 'png', size: 512 });
            const cardBuffer = await generateWelcomeImage(avatarUrl, targetMember.displayName);
            await targetChan.send({
                files: [{ attachment: cardBuffer, name: 'bienvenue.png' }],
                flags: [MessageFlags.SuppressNotifications]
            });

            const successEmbed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle('🎉 Rattrapage effectué avec succès !')
                .setDescription(
                    `Tout a été régularisé pour <@${targetMember.id}> :\n\n` +
                    `• 🏷️ **Rôle <@&${ROLE_MEMBRE_REGAIEN}> :** ${roleAttribue ? '✅ Attribué avec succès' : 'ℹ️ Déjà possédé'}\n` +
                    `• 🖼️ **Affiche Canvas :** ✅ Envoyée dans <#${targetChan.id}>` +
                    rolesReactionsTexte + `\n\n` +
                    `Le membre est maintenant prêt et intégré au serveur !`
                )
                .setFooter({ text: 'Rattrapage d\'urgence terminé' });

            const rowFin = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('welcome_emergency_menu').setLabel('🚨 Rattraper un autre membre').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('welcome_back_config').setLabel('🏠 Retour configuration').setStyle(ButtonStyle.Secondary)
            );

            await interaction.editReply({ embeds: [successEmbed], components: [rowFin] });
        } catch (err) {
            console.error("[Welcome] Erreur génération image rattrapage :", err);
            await interaction.editReply({
                embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle('❌ Erreur lors de l\'envoi').setDescription(`L'image n'a pas pu être envoyée : \`${err.message}\``)],
                components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('welcome_emergency_menu').setLabel('⬅️ Recommencer').setStyle(ButtonStyle.Primary))]
            });
        }

        return true;
    }

    return false;
}

// =========================
//  ARRIVÉE D'UN MEMBRE (EN DIRECT)
// =========================
async function handleWelcomeMemberAdd(member) {
    if (member.guild.id !== '720057528351850547' || member.user.bot) return;

    // Attribution automatique systématique du rôle Regaïen.ne
    if (!member.roles.cache.has(ROLE_MEMBRE_REGAIEN)) {
        await member.roles.add(ROLE_MEMBRE_REGAIEN, 'Arrivée sur le serveur (Rôle Regaïen.ne)').catch((err) => {
            console.error("[Welcome] Erreur attribution rôle à l'arrivée :", err.message);
        });
    }

    const data = welcomeState.getWelcomeData();
    if (data.actif && data.channelId) {
        const targetChan = member.guild.channels.cache.get(data.channelId);
        if (targetChan) {
            try {
                const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 512 });
                const cardBuffer = await generateWelcomeImage(avatarUrl, member.displayName);
                await targetChan.send({ 
                    files: [{ attachment: cardBuffer, name: 'bienvenue.png' }],
                    flags: [MessageFlags.SuppressNotifications]
                });
            } catch (err) {
                console.error("[Welcome] Erreur lors de l'envoi du message de bienvenue :", err.message);
            }
        }
    }
}

module.exports = {
    initWelcomeState,
    handleWelcomeMessage,
    handleWelcomeSlash,
    handleWelcomeInteraction,
    handleWelcomeMemberAdd
};