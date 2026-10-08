/**
 * Module Bienvenue pour Cacabot
 * Affiche de bienvenue Canvas, configuration et commandes !welcome / /welcome
 */

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ChannelSelectMenuBuilder,
    ChannelType,
    ButtonStyle
} = require('discord.js');
const { createCanvas, loadImage } = require('canvas');

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
    demanderSauvegarde: () => {},
    EPSYS_ID: '436218312574107658'
};

function initWelcomeState(bridge) {
    welcomeState = { ...welcomeState, ...bridge };
}

async function chargerImageSecurisee(variantes) {
    for (const v of variantes) {
        try {
            return await loadImage(v);
        } catch (e) {}
    }
    return null;
}

async function generateWelcomeImage(avatarUrl, memberName) {
    const oldBackend = process.env.PANGOCAIRO_BACKEND;
    delete process.env.PANGOCAIRO_BACKEND;

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

        ctx.drawImage(overlay, 0, 0, w, h);

        const cleanName = (memberName || 'NOUVEAU MEMBRE').toUpperCase();
        let fontSize = 75;

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.font = `bold ${fontSize}px "LemonMilk"`;
        const maxTextWidth = 1350;
        while (ctx.measureText(cleanName).width > maxTextWidth && fontSize > 36) {
            fontSize -= 2;
            ctx.font = `bold ${fontSize}px "LemonMilk"`;
        }

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(6, Math.round(fontSize * 0.14));
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.strokeText(cleanName, centerX, 825);

        ctx.fillStyle = '#ffffff';
        ctx.fillText(cleanName, centerX, 825);
        ctx.restore();

        const buffer = canvas.toBuffer('image/png');
        if (oldBackend) process.env.PANGOCAIRO_BACKEND = oldBackend;
        return buffer;
    } catch (err) {
        if (oldBackend) process.env.PANGOCAIRO_BACKEND = oldBackend;
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
            `• **Salon actuel :** ${salonStr}`
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

    return [
        new ActionRowBuilder().addComponents(channelSelect),
        new ActionRowBuilder().addComponents(toggleBtn, testBtn)
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
            const avatarUrl = message.author.displayAvatarURL({ extension: 'png', size: 512 });
            const cardBuffer = await generateWelcomeImage(avatarUrl, message.member?.displayName ?? message.author.username);
            await message.reply({ files: [{ attachment: cardBuffer, name: 'bienvenue.png' }] });
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

    const sub = interaction.options.getSubcommand();
    if (sub === 'test') {
        await interaction.deferReply();
        try {
            const avatarUrl = interaction.user.displayAvatarURL({ extension: 'png', size: 512 });
            const cardBuffer = await generateWelcomeImage(avatarUrl, interaction.member?.displayName ?? interaction.user.username);
            await interaction.editReply({ files: [{ attachment: cardBuffer, name: 'bienvenue.png' }] });
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
    if (!customId) return false;

    if (interaction.isChannelSelectMenu() && customId === 'welcome_select_channel') {
        if (interaction.user.id !== welcomeState.EPSYS_ID) return true;
        const data = welcomeState.getWelcomeData();
        data.channelId = interaction.values[0];
        welcomeState.demanderSauvegarde();
        await interaction.update({
            embeds: [buildWelcomeConfigEmbed()],
            components: buildWelcomeConfigRows()
        });
        return true;
    }

    if (interaction.isButton() && customId === 'welcome_toggle_active') {
        if (interaction.user.id !== welcomeState.EPSYS_ID) return true;
        const data = welcomeState.getWelcomeData();
        data.actif = !data.actif;
        welcomeState.demanderSauvegarde();
        await interaction.update({
            embeds: [buildWelcomeConfigEmbed()],
            components: buildWelcomeConfigRows()
        });
        return true;
    }

    if (interaction.isButton() && customId === 'welcome_test_btn') {
        if (interaction.user.id !== welcomeState.EPSYS_ID) return true;
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

    return false;
}

// =========================
//  ARRIVÉE D'UN MEMBRE
// =========================
async function handleWelcomeMemberAdd(member) {
    const data = welcomeState.getWelcomeData();
    if (member.guild.id === '720057528351850547' && !member.user.bot && data.actif && data.channelId) {
        const targetChan = member.guild.channels.cache.get(data.channelId);
        if (targetChan) {
            try {
                const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 512 });
                const cardBuffer = await generateWelcomeImage(avatarUrl, member.displayName);
                await targetChan.send({ files: [{ attachment: cardBuffer, name: 'bienvenue.png' }] });
            } catch (err) {
                console.error("Erreur envoi bienvenue :", err.message);
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