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
    ChannelType,
    ButtonStyle
} = require('discord.js');
const { createCanvas, loadImage, registerFont } = require('canvas');

console.log('====== [DEBUG CANVASS FONT] ======');
        console.log('1. Nom à écrire :', cleanName);
        console.log('2. Valeur brute ctx.font actuelle :', ctx.font);
        ctx.font = 'bold 120px LemonMilk';
        console.log('3. Valeur brute ctx.font après assignation :', ctx.font);
        console.log('4. Largeur mesurée par Canvas :', ctx.measureText(cleanName).width);
        console.log('==================================');
        
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
    demanderSauvegarde: () => {},
    EPSYS_ID: '436218312574107658'
};

function initWelcomeState(bridge) {
    welcomeState = { ...welcomeState, ...bridge };
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
        let fontSize = 110;

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Police LemonMilk avec fallback DejaVu Sans
        ctx.font = `bold ${fontSize}px LemonMilk, "DejaVu Sans", sans-serif`;

        // Réduction dynamique si le pseudo dépasse
        const maxTextWidth = 1350;
        while (ctx.measureText(cleanName).width > maxTextWidth && fontSize > 40) {
            fontSize -= 5;
            ctx.font = `bold ${fontSize}px LemonMilk, "DejaVu Sans", sans-serif`;
        }

        const posY = 825;

        // Ombre portée sombre et nette
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 4;
        ctx.shadowOffsetY = 4;

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

    const sub = interaction.options.getSubcommand(false);
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
    if (!customId || !customId.startsWith('welcome_')) return false;

    if (interaction.isChannelSelectMenu() && customId === 'welcome_select_channel') {
        if (interaction.user.id !== welcomeState.EPSYS_ID) {
            await interaction.reply({ content: "Seule Epsys peut modifier cela.", ephemeral: true });
            return true;
        }
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
        if (interaction.user.id !== welcomeState.EPSYS_ID) {
            await interaction.reply({ content: "Seule Epsys peut modifier cela.", ephemeral: true });
            return true;
        }
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
        if (interaction.user.id !== welcomeState.EPSYS_ID) {
            await interaction.reply({ content: "Seule Epsys peut tester.", ephemeral: true });
            return true;
        }
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