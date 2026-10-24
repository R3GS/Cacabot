/**
 * Module Suggestions pour Cacabot (Regaïa)
 * Commandes : !suggestion, !suggest, !sugg, /suggestion et boutons de vote
 */

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const SUGGESTION_CHANNEL_ID = '720079866199801937';

let suggestionBridge = {
    getSuggestionsData: () => new Map(),
    demanderSauvegarde: () => {},
    trackBattlePassProgress: () => {}
};

function initSuggestionState(bridge) {
    suggestionBridge = { ...suggestionBridge, ...bridge };
}

function buildSuggestionEmbed(data, authorMember) {
    const pourCount = data.pour.length;
    const contreCount = data.contre.length;
    const total = pourCount + contreCount;

    const pourPct = total > 0 ? Math.round((pourCount / total) * 100) : 0;
    const contrePct = total > 0 ? (100 - pourPct) : 0;

    let barre = '░░░░░░░░░░';
    if (total > 0) {
        const nbVert = Math.round((pourCount / total) * 10);
        const nbRouge = 10 - nbVert;
        barre = '🟩'.repeat(nbVert) + '🟥'.repeat(nbRouge);
    }

    const avatarUrl = authorMember?.user?.displayAvatarURL({ dynamic: true, size: 256 }) 
                   ?? authorMember?.displayAvatarURL?.({ dynamic: true, size: 256 });

    let couleur = 0xd96b00;
    let statutTexte = "⏳ **Statut :** En attente des votes de la communauté";

    if (data.statut === 'acceptee') {
        couleur = 0x2ecc71;
        statutTexte = "🟢 **Statut :** **RETENUE PAR LE STAFF !** 🎉";
    } else if (data.statut === 'etude') {
        couleur = 0xf1c40f;
        statutTexte = "🟡 **Statut :** **EN COURS D'ÉTUDE PAR LE STAFF** 🧐";
    } else if (data.statut === 'refusee') {
        couleur = 0xe74c3c;
        statutTexte = "🔴 **Statut :** **NON RETENUE**";
    }

    const embed = new EmbedBuilder()
        .setColor(couleur)
        .setTitle('💡 SUGGESTION DU SERVEUR')
        .setDescription(
            `${statutTexte}\n\n` +
            `**Proposition :**\n> ${data.texte}\n\n` +
            `**Auteur·rice :** <@${data.authorId}>\n\n` +
            `**Votes actuels :**\n` +
            `✅ **Pour :** ${pourCount} (${pourPct}%)\n` +
            `❌ **Contre :** ${contreCount} (${contrePct}%)\n\n` +
            `\`${barre}\``
        )
        .setFooter({ text: data.verrouille ? 'Votes clôturés par le staff' : 'Clique sur un bouton pour voter ou modifier ton vote !' })
        .setTimestamp();

    if (avatarUrl) embed.setThumbnail(avatarUrl);
    return embed;
}

function buildSuggestionRow(data) {
    const rowVotes = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('sugg_vote_pour')
            .setLabel(`Pour (${data.pour.length})`)
            .setEmoji('✅')
            .setStyle(ButtonStyle.Success)
            .setDisabled(Boolean(data.verrouille)),
        new ButtonBuilder()
            .setCustomId('sugg_vote_contre')
            .setLabel(`Contre (${data.contre.length})`)
            .setEmoji('❌')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(Boolean(data.verrouille))
    );

    const rowAdmin = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('sugg_adm_accepter').setLabel('🟢 Retenir').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('sugg_adm_etude').setLabel('🟡 Étudier').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('sugg_adm_refuser').setLabel('🔴 Refuser').setStyle(ButtonStyle.Secondary)
    );

    return [rowVotes, rowAdmin];
}

// =========================
//  GESTION DES MESSAGES (!)
// =========================
async function handleSuggestionMessage(message, response) {
    if (!response?.needsSuggestion) return false;

    if (message.channel.id !== SUGGESTION_CHANNEL_ID) {
        await message.channel.send(`💡 <@${message.author.id}>, les suggestions se font uniquement dans le salon <#${SUGGESTION_CHANNEL_ID}> !`);
        return true;
    }

    const texte = message.content.trim().split(/\s+/).slice(1).join(" ");
    if (!texte) {
        await message.reply("Usage : `!suggestion [ton idée/proposition]`\nExemple : `!suggestion Créer un salon Meubles IKEA`");
        return true;
    }

    const data = {
        authorId: message.author.id,
        texte: texte,
        pour: [],
        contre: []
    };

    const embed = buildSuggestionEmbed(data, message.member);
    const row = buildSuggestionRow(data);

    await message.delete().catch(() => {});
    const sent = await message.channel.send({ embeds: [embed], components: [row] });

    const suggestionsData = suggestionBridge.getSuggestionsData();
    suggestionsData.set(sent.id, data);
    suggestionBridge.demanderSauvegarde();
    return true;
}

// =========================
//  GESTION DES SLASHS (/)
// =========================
async function handleSuggestionSlash(interaction) {
    const cmd = interaction.commandName;
    if (cmd !== 'suggestion' && cmd !== 'sugg') return false;

    if (interaction.channel.id !== SUGGESTION_CHANNEL_ID) {
        await interaction.reply({ content: `💡 Les suggestions se font uniquement dans le salon <#${SUGGESTION_CHANNEL_ID}> !`, ephemeral: true });
        return true;
    }

    const texte = interaction.options.getString('proposition');
    const data = {
        authorId: interaction.user.id,
        texte: texte,
        pour: [],
        contre: []
    };

    const embed = buildSuggestionEmbed(data, interaction.member);
    const row = buildSuggestionRow(data);

    const sent = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
    const suggestionsData = suggestionBridge.getSuggestionsData();
    suggestionsData.set(sent.id, data);
    suggestionBridge.demanderSauvegarde();
    return true;
}

// =========================
//  GESTION DES BOUTONS DE VOTE
// =========================
async function handleSuggestionButton(interaction) {
    if (!interaction.isButton()) return false;
    const customId = interaction.customId;
    if (!customId.startsWith('sugg_')) return false;

    const msgId = interaction.message.id;
    const suggestionsData = suggestionBridge.getSuggestionsData();
    const data = suggestionsData.get(msgId);

    if (!data) {
        await interaction.reply({ content: "Cette suggestion est trop ancienne ou introuvable.", ephemeral: true });
        return true;
    }

    // 1. Décisions Staff / Epsys
    if (customId.startsWith('sugg_adm_')) {
        const estModo = interaction.member?.roles?.cache?.has('720081311716606004') || interaction.user.id === '436218312574107658';
        if (!estModo) {
            return interaction.reply({ content: "Seul le staff ou Epsys peut définir le statut d'une suggestion 😌", ephemeral: true });
        }

        if (customId === 'sugg_adm_accepter') {
            data.statut = 'acceptee';
            data.verrouille = true;
        } else if (customId === 'sugg_adm_etude') {
            data.statut = 'etude';
            data.verrouille = false;
        } else if (customId === 'sugg_adm_refuser') {
            data.statut = 'refusee';
            data.verrouille = true;
        }

        suggestionsData.set(msgId, data);
        suggestionBridge.demanderSauvegarde();

        const authorMember = interaction.guild.members.cache.get(data.authorId);
        const embed = buildSuggestionEmbed(data, authorMember);
        const rows = buildSuggestionRow(data);

        await interaction.update({ embeds: [embed], components: rows });
        return true;
    }

    // 2. Votes des membres
    if (data.verrouille) {
        return interaction.reply({ content: "Les votes sont clos sur cette suggestion !", ephemeral: true });
    }

    const userId = interaction.user.id;
    const votePour = customId === 'sugg_vote_pour';
    let feedback = '';

    if (votePour) {
        if (data.pour.includes(userId)) {
            data.pour = data.pour.filter(id => id !== userId);
            feedback = '❌ Vote « Pour » retiré !';
        } else {
            data.pour.push(userId);
            data.contre = data.contre.filter(id => id !== userId);
            feedback = '✅ Tu as voté « Pour » !';
            suggestionBridge.trackBattlePassProgress(userId, 'sugg_vote', 1);
        }
    } else {
        if (data.contre.includes(userId)) {
            data.contre = data.contre.filter(id => id !== userId);
            feedback = '❌ Vote « Contre » retiré !';
        } else {
            data.contre.push(userId);
            data.pour = data.pour.filter(id => id !== userId);
            feedback = '❌ Tu as voté « Contre » !';
            suggestionBridge.trackBattlePassProgress(userId, 'sugg_vote', 1);
        }
    }

    suggestionsData.set(msgId, data);
    suggestionBridge.demanderSauvegarde();

    const authorMember = interaction.guild.members.cache.get(data.authorId);
    const embed = buildSuggestionEmbed(data, authorMember);
    const row = buildSuggestionRow(data);

    await interaction.update({ embeds: [embed], components: [row] });
    await interaction.followUp({ content: feedback, ephemeral: true });
    return true;
}

module.exports = {
    initSuggestionState,
    buildSuggestionEmbed,
    buildSuggestionRow,
    handleSuggestionMessage,
    handleSuggestionSlash,
    handleSuggestionButton
};