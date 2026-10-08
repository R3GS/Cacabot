/**
 * Module Citations pour Cacabot
 * Commandes : !quote, !citation, /quote et bouton aléatoire
 */

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

let quotesState = {
    getQuotesData: () => [],
    demanderSauvegarde: () => {},
    findMemberByName: () => ({ found: null, multiple: false, candidates: [] }),
    estModo: () => false,
    EPSYS_ID: '436218312574107658'
};

function initQuotesState(bridge) {
    quotesState = { ...quotesState, ...bridge };
}

function buildQuoteEmbedAndRow(quote, totalQuotes, filterId, guild) {
    const auteurMembre = guild?.members.cache.get(quote.authorId);
    const avatarUrl = quote.avatarUrl 
                   ?? auteurMembre?.user?.displayAvatarURL({ dynamic: true, size: 256 }) 
                   ?? auteurMembre?.displayAvatarURL?.({ dynamic: true, size: 256 });

    const lienMsg = quote.messageUrl ?? `https://discord.com/channels/${guild?.id}/${quote.channelId}`;
    const auteurMention = quote.isWebhook ? `**${quote.authorName}** *(Webhook)*` : `<@${quote.authorId}>`;

    const texteAffiche = quote.texte && quote.texte !== '(Image)'
        ? `## « ${quote.texte} »\n\n    -${auteurMention}\n\n-# *[source](${lienMsg})*`
        : `    -${auteurMention}\n\n-# *[source](${lienMsg})*`;

    const embedQuote = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle(`📜 Citation N°${quote.id}`)
        .setDescription(texteAffiche)
        .setFooter({ text: `[${quote.id}/${totalQuotes}] • Réponds à un message en faisant !quote pour l'enregistrer !` });

    if (avatarUrl) embedQuote.setThumbnail(avatarUrl);
    if (quote.imageUrl) embedQuote.setImage(quote.imageUrl);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`quote_random_${filterId}`)
            .setLabel('🎲 Une autre citation')
            .setStyle(ButtonStyle.Secondary)
    );

    return { embed: embedQuote, row };
}

// =========================
//  GESTION DES MESSAGES (!)
// =========================
async function handleQuotesMessage(message, response) {
    const raw = message.content.trim();
    const command = raw.split(/\s+/)[0]?.toLowerCase();

    if (command !== '!quote' && command !== '!citation' && !response?.needsQuote) {
        return false;
    }

    const quotesData = quotesState.getQuotesData();
    const args = raw.split(/\s+/);
    const sub = args[1]?.toLowerCase();

    // 1. Suppression : !quote remove [ID]
    if (sub === 'remove' || sub === 'delete' || sub === 'del') {
        const idToRemove = parseInt(args[2], 10);
        if (isNaN(idToRemove)) {
            await message.reply("Usage : `!quote remove [ID_citation]` (ex : `!quote remove 3`)");
            return true;
        }

        const index = quotesData.findIndex(q => q.id === idToRemove);
        if (index === -1) {
            await message.reply(`Aucune citation trouvée avec l'identifiant **#${idToRemove}** !`);
            return true;
        }

        const q = quotesData[index];
        const estAuteur = q.authorId === message.author.id || q.addedById === message.author.id;
        const estAdmin = message.author.id === quotesState.EPSYS_ID || quotesState.estModo(message.member);

        if (!estAuteur && !estAdmin) {
            await message.reply("Tu ne peux supprimer que les citations que tu as enregistrées ou dont tu es l'auteur !");
            return true;
        }

        quotesData.splice(index, 1);
        quotesState.demanderSauvegarde();
        await message.reply(`🗑️ La citation **#${idToRemove}** a été supprimée des archives.`);
        return true;
    }

    // 2. Enregistrement par réponse à un message
    if (message.reference) {
        const repliedMsg = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
        if (!repliedMsg) {
            await message.reply("Impossible de récupérer le message cité.");
            return true;
        }

        const estWebhook = Boolean(repliedMsg.webhookId);
        if (repliedMsg.author.bot && !estWebhook) {
            await message.reply("On ne cite pas les bots, seulement les membres et les webhooks !");
            return true;
        }

        const texteCité = repliedMsg.content?.trim() || '';
        const imagePieceJointe = repliedMsg.attachments.first()?.url ?? null;

        if (!texteCité && !imagePieceJointe) {
            await message.reply("Ce message ne contient ni texte ni image à citer !");
            return true;
        }

        const existeDeja = quotesData.some(q => q.texte === texteCité && q.authorId === repliedMsg.author.id && q.imageUrl === imagePieceJointe);
        if (existeDeja) {
            await message.reply("Cette phrase ou image est déjà enregistrée dans les archives du serveur !");
            return true;
        }

        const nextId = quotesData.length > 0 ? Math.max(...quotesData.map(q => q.id)) + 1 : 1;
        const auteurNom = repliedMsg.member?.displayName ?? repliedMsg.author.username;
        const auteurAvatar = repliedMsg.author.displayAvatarURL({ dynamic: true, size: 256 });

        const nouvelleCitation = {
            id: nextId,
            texte: texteCité || '(Image)',
            authorId: repliedMsg.author.id,
            authorName: auteurNom,
            avatarUrl: auteurAvatar,
            isWebhook: estWebhook,
            imageUrl: imagePieceJointe,
            addedById: message.author.id,
            timestamp: repliedMsg.createdTimestamp,
            channelId: message.channel.id,
            messageUrl: repliedMsg.url ?? `https://discord.com/channels/${message.guild.id}/${message.channel.id}/${repliedMsg.id}`
        };

        quotesData.push(nouvelleCitation);
        quotesState.demanderSauvegarde();

        const descriptionConf = estWebhook
            ? `> *« ${texteCité || 'Image'} »*\n\n— **${auteurNom}** *(Webhook)* dans <#${message.channel.id}>`
            : `> *« ${texteCité || 'Image'} »*\n\n— <@${repliedMsg.author.id}> dans <#${message.channel.id}>`;

        const embedConf = new EmbedBuilder()
            .setColor(0xf1c40f)
            .setTitle(`📜 Citation #${nextId} enregistrée !`)
            .setDescription(descriptionConf)
            .setFooter({ text: `Enregistrée par ${message.member?.displayName ?? message.author.username} • Tape !quote pour afficher une citation` });

        if (imagePieceJointe) embedConf.setImage(imagePieceJointe);

        await message.reply({ embeds: [embedConf] });
        return true;
    }

    // 3. Affichage aléatoire / Recherche
    if (quotesData.length === 0) {
        await message.reply("📜 Aucune citation enregistrée pour l'instant ! Réponds à un message mythique avec `!quote` pour immortaliser une phrase.");
        return true;
    }

    let pool = quotesData;
    let cible = message.mentions.users.first();
    let customFilterId = 'all';

    if (sub === 'search' || sub === 'find' || sub === 'chercher') {
        const motCle = args.slice(2).join(" ").trim().toLowerCase();
        if (!motCle) {
            await message.reply("Usage : `!quote search [mot-clé]` (ex : `!quote search caca`)");
            return true;
        }

        const resultats = quotesData.filter(q => q.texte?.toLowerCase().includes(motCle));
        if (resultats.length === 0) {
            await message.reply(`🔍 Aucune citation ne contient le mot **« ${motCle} »** !`);
            return true;
        }
        pool = resultats;
        customFilterId = `search_${encodeURIComponent(motCle)}`;
    } else {
        const query = args.slice(1).join(" ").trim();
        const idDirect = parseInt(query, 10);

        if (!isNaN(idDirect) && !query.includes('@')) {
            const quoteTrouvee = quotesData.find(q => q.id === idDirect);
            if (!quoteTrouvee) {
                await message.reply(`Aucune citation trouvée avec le numéro **#${idDirect}** !`);
                return true;
            }
            pool = [quoteTrouvee];
        } else if (!cible && query.length > 0) {
            const result = quotesState.findMemberByName(message.guild, query);
            if (result.found) cible = result.found.user;
        }

        if (cible) {
            pool = quotesData.filter(q => q.authorId === cible.id);
            if (pool.length === 0) {
                const nom = message.guild?.members.cache.get(cible.id)?.displayName ?? cible.username;
                await message.reply(`Aucune citation enregistrée pour **${nom}** !`);
                return true;
            }
            customFilterId = cible.id;
        }
    }

    const quoteChoisie = pool[Math.floor(Math.random() * pool.length)];
    const { embed, row } = buildQuoteEmbedAndRow(quoteChoisie, quotesData.length, customFilterId, message.guild);
    await message.reply({ embeds: [embed], components: [row] });
    return true;
}

// =========================
//  GESTION DES SLASHS (/)
// =========================
async function handleQuotesSlash(interaction) {
    if (interaction.commandName !== 'quote' && interaction.commandName !== 'citation') {
        return false;
    }

    const quotesData = quotesState.getQuotesData();
    if (quotesData.length === 0) {
        await interaction.reply({ content: "📜 Aucune citation enregistrée pour l'instant !", ephemeral: true });
        return true;
    }

    const query = interaction.options.getString('recherche')?.trim().toLowerCase();
    let pool = quotesData;
    let customFilterId = 'all';

    if (query) {
        const idDirect = parseInt(query, 10);
        if (!isNaN(idDirect)) {
            const q = quotesData.find(x => x.id === idDirect);
            if (q) pool = [q];
        } else {
            const parMot = quotesData.filter(x => x.texte?.toLowerCase().includes(query) || x.authorName?.toLowerCase().includes(query));
            if (parMot.length > 0) {
                pool = parMot;
                customFilterId = `search_${encodeURIComponent(query)}`;
            }
        }
    }

    const quoteChoisie = pool[Math.floor(Math.random() * pool.length)];
    const { embed, row } = buildQuoteEmbedAndRow(quoteChoisie, quotesData.length, customFilterId, interaction.guild);
    await interaction.reply({ embeds: [embed], components: [row] });
    return true;
}

// =========================
//  GESTION DES BOUTONS
// =========================
async function handleQuotesButton(interaction) {
    if (!interaction.isButton() || !interaction.customId.startsWith('quote_random_')) {
        return false;
    }

    const filterId = interaction.customId.replace('quote_random_', '');
    const quotesData = quotesState.getQuotesData();
    let pool = quotesData;

    if (filterId.startsWith('search_')) {
        const kw = decodeURIComponent(filterId.replace('search_', ''));
        pool = quotesData.filter(q => q.texte?.toLowerCase().includes(kw));
    } else if (filterId !== 'all') {
        pool = quotesData.filter(q => q.authorId === filterId);
    }

    if (pool.length === 0) {
        await interaction.reply({ content: "Aucune citation trouvée !", ephemeral: true });
        return true;
    }

    const quoteChoisie = pool[Math.floor(Math.random() * pool.length)];
    const { embed, row } = buildQuoteEmbedAndRow(quoteChoisie, quotesData.length, filterId, interaction.guild);
    await interaction.update({ embeds: [embed], components: [row] });
    return true;
}

module.exports = {
    initQuotesState,
    handleQuotesMessage,
    handleQuotesSlash,
    handleQuotesButton
};