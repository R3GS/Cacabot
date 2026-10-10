/**
 * Module YouTube pour Cacabot
 * Commandes : !youtube, !last, !stats, !ytabo config et leurs équivalents Slash
 */

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    StringSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    ChannelType,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ButtonStyle
} = require('discord.js');

const EPSYS_ID = '436218312574107658';
const youtubeSearches = new Map(); // messageId -> { videos, authorId }

let ytState = {
    client: null,
    getYoutubeWatchData: () => ({}),
    demanderSauvegarde: () => {}
};

function initYoutubeState(bridge) {
    ytState = { ...ytState, ...bridge };
}

function decodeHtmlEntities(text) {
    if (!text) return text;
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(code));
}

function formatNumber(num) {
    const n = parseInt(num, 10);
    if (isNaN(n)) return '0';
    if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace('.0', '') + ' Md';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + ' M';
    if (n >= 1_000) return (n / 1_000).toFixed(1).replace('.0', '') + ' k';
    return n.toLocaleString('fr-FR');
}

function buildYoutubeEmbed(videos, index) {
    const video = videos[index];
    const snippet = video.snippet;
    const stats = video.statistics || {};

    const duration = video.contentDetails.duration
        .replace('PT', '')
        .replace('H', 'h ')
        .replace('M', 'min ')
        .replace('S', 's');

    const views = stats.viewCount ? parseInt(stats.viewCount, 10).toLocaleString('fr-FR') : '0';
    const likes = stats.likeCount ? parseInt(stats.likeCount, 10).toLocaleString('fr-FR') : 'Masqué';
    const comments = stats.commentCount ? parseInt(stats.commentCount, 10).toLocaleString('fr-FR') : 'Désactivés';
    const date = new Date(snippet.publishedAt).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'long', year: 'numeric'
    });

    const miniatureUrl = snippet.thumbnails.maxres?.url ?? snippet.thumbnails.high?.url ?? snippet.thumbnails.default?.url;

    return new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle(decodeHtmlEntities(snippet.title))
        .setURL(`https://www.youtube.com/watch?v=${video.id}`)
        .setImage(miniatureUrl)
        .addFields(
            { name: '📺 Chaîne', value: snippet.channelTitle, inline: true },
            { name: '⏱️ Durée', value: duration, inline: true },
            { name: '👁️ Vues', value: views, inline: true },
            { name: '👍 Likes', value: likes, inline: true },
            { name: '💬 Commentaires', value: comments, inline: true },
            { name: '📅 Publié le', value: date, inline: true }
        )
        .setFooter({ text: `Résultat ${index + 1}/${videos.length}` });
}

function buildYoutubeRow(index, authorId, videoUrl, totalVideos) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`yt_prev_${authorId}_${index}`)
            .setLabel('⏮️ Précédent')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(index === 0),
        new ButtonBuilder()
            .setCustomId(`yt_next_${authorId}_${index}`)
            .setLabel('⏭️ Suivant')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(index >= totalVideos - 1),
        new ButtonBuilder()
            .setLabel('🔗 Ouvrir')
            .setStyle(ButtonStyle.Link)
            .setURL(videoUrl),
        new ButtonBuilder()
            .setCustomId(`yt_close_${authorId}`)
            .setLabel('❌ Fermer')
            .setStyle(ButtonStyle.Danger)
    );
}

async function resolveChannelId(query) {
    const urlMatch = query.match(/(?:youtube\.com\/(?:channel\/|c\/|@)|@)([a-zA-Z0-9_-]+)/);
    const handle = urlMatch ? urlMatch[1] : null;

    if (query.includes('youtube.com/channel/')) {
        return query.split('channel/')[1].split(/[/?]/)[0];
    }

    const searchTerm = handle ?? query;
    try {
        const forHandleRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=id,snippet&forHandle=${encodeURIComponent(searchTerm.replace('@', ''))}&key=${process.env.YOUTUBE_API_KEY}`);
        const forHandleData = await forHandleRes.json();
        if (forHandleData.items && forHandleData.items.length > 0) {
            return { id: forHandleData.items[0].id, title: forHandleData.items[0].snippet.title };
        }

        const searchRes = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(searchTerm)}&type=channel&maxResults=1&key=${process.env.YOUTUBE_API_KEY}`);
        const searchData = await searchRes.json();
        if (searchData.items && searchData.items.length > 0) {
            return { id: searchData.items[0].snippet.channelId, title: searchData.items[0].snippet.channelTitle };
        }
    } catch (e) {}

    return null;
}

// ==========================================
//  PANNEAU DE CONFIGURATION !YTABO CONFIG
// ==========================================

function getChannelsList() {
    const watchData = ytState.getYoutubeWatchData() || {};
    return Object.entries(watchData).map(([key, val]) => {
        if (typeof val === 'object' && val !== null) {
            return {
                channelId: String(val.channelId || key),
                title: String(val.title || val.name || key),
                discordChannelId: String(val.discordChannelId || val.channelId || 'Inconnu'),
                customMessage: val.customMessage || "📢 **Nouvelle vidéo de {chaine} !**\n{url}"
            };
        }
        return {
            channelId: String(key),
            title: String(key),
            discordChannelId: String(val),
            customMessage: "📢 **Nouvelle vidéo de {chaine} !**\n{url}"
        };
    }).filter(ch => ch.channelId && ch.channelId !== 'undefined');
}

function buildYtAboEmbed() {
    const channels = getChannelsList();

    const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('📺 Gestion des abonnements YouTube de Cacabot')
        .setDescription(
            `Configure les chaînes que Cacabot surveille. Dès qu'une vidéo sort, il l'envoie automatiquement dans le salon prévu !\n\n` +
            `**Chaînes suivies (${channels.length}) :**`
        )
        .setFooter({ text: 'Panneau réservé à Epsys • Sauvegardé dans #json' });

    if (channels.length === 0) {
        embed.addFields({ name: 'Aucun abonnement', value: 'Clique sur **➕ Ajouter une chaîne** ci-dessous pour commencer !' });
    } else {
        for (const ch of channels) {
            embed.addFields({
                name: `🔴 ${ch.title}`,
                value: `• Salon : <#${ch.discordChannelId}>\n• Message : \`${ch.customMessage}\``,
                inline: false
            });
        }
    }

    return embed;
}

function buildYtAboComponents() {
    const channels = getChannelsList();

    const rowButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('ytabo_add_btn')
            .setLabel('➕ Ajouter une chaîne')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('ytabo_test_btn')
            .setLabel('🔔 Tester les alertes')
            .setStyle(ButtonStyle.Primary)
    );

    const rows = [rowButtons];

    if (channels.length > 0) {
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('ytabo_remove_select')
            .setPlaceholder('🗑️ Supprimer une chaîne...')
            .addOptions(
                channels.slice(0, 25).map(ch => ({
                    label: ch.title.slice(0, 50),
                    description: `Salon : #${ch.discordChannelId}`.slice(0, 50),
                    value: ch.channelId
                }))
            );
        rows.push(new ActionRowBuilder().addComponents(selectMenu));
    }

    return rows;
}

// ==========================================
//  SURVEILLANCE ET ENVOI AUTOMATIQUE
// ==========================================

async function verifierNouvellesVideosYouTube() {
    const watchData = ytState.getYoutubeWatchData();
    const client = ytState.client;
    if (!client || Object.keys(watchData).length === 0) return;

    for (const [channelId, config] of Object.entries(watchData)) {
        try {
            // Utilisation du flux RSS officiel (gratuit, 0 quota API consommé)
            const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
            const res = await fetch(rssUrl);
            if (!res.ok) continue;
            const xml = await res.text();

            const videoIdMatch = xml.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
            const titleMatch = xml.match(/<title>([^<]+)<\/title>/g); // Le 1er est le nom de la chaîne, le 2e est la vidéo
            const videoTitle = titleMatch && titleMatch[1] ? titleMatch[1].replace(/<\/?title>/g, '') : 'Nouvelle vidéo';

            if (!videoIdMatch) continue;
            const latestVideoId = videoIdMatch[1];

            // Si c'est la toute première fois qu'on ajoute la chaîne, on note l'ID sans spammer
            if (!config.lastVideoId) {
                config.lastVideoId = latestVideoId;
                ytState.demanderSauvegarde();
                continue;
            }

            // Nouvelle vidéo détectée !
            if (config.lastVideoId !== latestVideoId) {
                config.lastVideoId = latestVideoId;
                ytState.demanderSauvegarde();

                const targetChannel = client.channels.cache.get(config.discordChannelId);
                if (targetChannel) {
                    const videoUrl = `https://www.youtube.com/watch?v=${latestVideoId}`;
                    const messageTemplate = config.customMessage || "📢 **Nouvelle vidéo de {chaine} !**\n{url}";
                    const messageFinal = messageTemplate
                        .replace('{chaine}', config.title || 'YouTube')
                        .replace('{titre}', decodeHtmlEntities(videoTitle))
                        .replace('{url}', videoUrl);

                    await targetChannel.send(messageFinal);
                    console.log(`[YouTube] 📢 Nouvelle vidéo envoyée pour ${config.title} : ${latestVideoId}`);
                }
            }
        } catch (e) {
            console.error(`[YouTube] Erreur check chaîne ${channelId}:`, e.message);
        }
    }
}

// =========================
//  GESTION DES MESSAGES (!)
// =========================
async function handleYoutubeMessage(message, response) {
    const raw = message.content.trim();
    const command = raw.split(/\s+/)[0]?.toLowerCase();

    // 0. Commande !ytabo (Epsys-only, avec ou sans espace)
    if (command === '!ytabo' || command === '!ytaboconfig' || command === '!ytwatch' || command === '!ytconfig') {
        if (message.author.id !== EPSYS_ID) {
            await message.reply("Cette commande est réservée à Epsys.");
            return true;
        }

        await message.reply({
            embeds: [buildYtAboEmbed()],
            components: buildYtAboComponents()
        });
        return true;
    }

    // 1. Commande !last
    if (command === '!last' || response?.needsLastVideo) {
        const query = raw.split(/\s+/).slice(1).join(' ');
        if (!query) {
            await message.reply("Usage : `!last [nom ou URL de la chaîne]`");
            return true;
        }

        try {
            const channelInfo = await resolveChannelId(query);
            if (!channelInfo) {
                await message.reply("Chaîne introuvable !");
                return true;
            }

            const latestRes = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelInfo.id}&order=date&maxResults=1&type=video&key=${process.env.YOUTUBE_API_KEY}`);
            const latestData = await latestRes.json();

            if (!latestData.items || latestData.items.length === 0) {
                await message.reply("Aucune vidéo trouvée pour cette chaîne !");
                return true;
            }

            const video = latestData.items[0];
            const videoId = video.id.videoId;

            const detailRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoId}&key=${process.env.YOUTUBE_API_KEY}`);
            const detailData = await detailRes.json();
            const fullVideo = detailData.items[0];

            const duration = fullVideo.contentDetails.duration
                .replace('PT', '').replace('H', 'h ').replace('M', 'min ').replace('S', 's');
            const views = parseInt(fullVideo.statistics.viewCount, 10).toLocaleString('fr-FR');
            const date = new Date(video.snippet.publishedAt).toLocaleDateString('fr-FR', {
                day: 'numeric', month: 'long', year: 'numeric'
            });

            const embed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle(decodeHtmlEntities(video.snippet.title))
                .setURL(`https://www.youtube.com/watch?v=${videoId}`)
                .setThumbnail(video.snippet.thumbnails.high.url)
                .addFields(
                    { name: '📺 Chaîne', value: video.snippet.channelTitle, inline: true },
                    { name: '⏱️ Durée', value: duration, inline: true },
                    { name: '👁️ Vues', value: views, inline: true },
                    { name: '📅 Publié le', value: date, inline: true }
                );

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('🔗 Ouvrir')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`https://www.youtube.com/watch?v=${videoId}`),
                new ButtonBuilder()
                    .setCustomId(`yt_close_${message.author.id}`)
                    .setLabel('❌ Fermer')
                    .setStyle(ButtonStyle.Danger)
            );

            await message.reply({ embeds: [embed], components: [row] });
            return true;
        } catch (e) {
            console.error('Erreur !last:', e);
            await message.reply("Erreur lors de la récupération.");
            return true;
        }
    }

    // 2. Commande !stats
    if (command === '!stats' || response?.needsStats) {
        const query = raw.split(/\s+/).slice(1).join(' ');
        if (!query) {
            await message.reply("Usage : `!stats [nom ou URL de la chaîne]`");
            return true;
        }

        try {
            const channelInfo = await resolveChannelId(query);
            if (!channelInfo) {
                await message.reply("Chaîne introuvable !");
                return true;
            }

            const detailRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,brandingSettings&id=${channelInfo.id}&key=${process.env.YOUTUBE_API_KEY}`);
            const detailData = await detailRes.json();

            if (!detailData.items || detailData.items.length === 0) {
                await message.reply("Chaîne introuvable !");
                return true;
            }

            const channel = detailData.items[0];
            const snippet = channel.snippet;
            const stats = channel.statistics;

            const createdDate = new Date(snippet.publishedAt).toLocaleDateString('fr-FR', {
                day: 'numeric', month: 'long', year: 'numeric'
            });

            const embed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle(snippet.title)
                .setURL(`https://www.youtube.com/channel/${channelInfo.id}`)
                .setThumbnail(snippet.thumbnails.high?.url ?? snippet.thumbnails.default.url)
                .setDescription(snippet.description ? snippet.description.slice(0, 200) + (snippet.description.length > 200 ? '...' : '') : '*Aucune description*')
                .addFields(
                    { name: '👥 Abonnés', value: stats.hiddenSubscriberCount ? 'Caché' : formatNumber(stats.subscriberCount), inline: true },
                    { name: '👁️ Vues totales', value: formatNumber(stats.viewCount), inline: true },
                    { name: '🎬 Vidéos', value: formatNumber(stats.videoCount), inline: true },
                    { name: '📅 Création', value: createdDate, inline: true }
                )
                .setFooter({ text: `ID : ${channelInfo.id}` });

            await message.reply({ embeds: [embed] });
            return true;
        } catch (e) {
            console.error('Erreur stats YouTube:', e);
            await message.reply("Erreur lors de la récupération des stats.");
            return true;
        }
    }

    // 3. Commande !youtube
    if (command === '!youtube' || response?.needsYoutube) {
        const query = raw.split(/\s+/).slice(1).join(' ');
        if (!query) {
            await message.reply("Usage : `!youtube [recherche]`");
            return true;
        }

        try {
            const searchRes = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=5&key=${process.env.YOUTUBE_API_KEY}`);
            const searchData = await searchRes.json();

            if (!searchData.items || searchData.items.length === 0) {
                await message.reply("Aucun résultat trouvé !");
                return true;
            }

            const videoIds = searchData.items.map(i => i.id.videoId).join(',');
            const detailRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoIds}&key=${process.env.YOUTUBE_API_KEY}`);
            const detailData = await detailRes.json();
            const videos = detailData.items;

            const firstVideo = videos[0];
            const firstUrl = `https://www.youtube.com/watch?v=${firstVideo.id}`;

            const sent = await message.reply({
                embeds: [buildYoutubeEmbed(videos, 0)],
                components: [buildYoutubeRow(0, message.author.id, firstUrl, videos.length)]
            });

            youtubeSearches.set(sent.id, { videos, authorId: message.author.id });
            setTimeout(() => youtubeSearches.delete(sent.id), 5 * 60 * 1000);
            return true;
        } catch (e) {
            console.error('Erreur YouTube:', e);
            await message.reply("Erreur lors de la recherche YouTube.");
            return true;
        }
    }

    return false;
}

// =========================
//  GESTION DES SLASHS (/)
// =========================
async function handleYoutubeSlash(interaction) {
    const cmd = interaction.commandName;

    if (cmd === 'ytabo' || cmd === 'ytwatch') {
        if (interaction.user.id !== EPSYS_ID) {
            await interaction.reply({ content: "Cette commande est réservée à Epsys.", ephemeral: true });
            return true;
        }
        await interaction.reply({
            embeds: [buildYtAboEmbed()],
            components: buildYtAboComponents(),
            ephemeral: true
        });
        return true;
    }

    if (cmd === 'youtube') {
        const query = interaction.options.getString('recherche');
        await interaction.deferReply();
        try {
            const searchRes = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=5&key=${process.env.YOUTUBE_API_KEY}`);
            const searchData = await searchRes.json();

            if (!searchData.items || searchData.items.length === 0) {
                await interaction.editReply("Aucun résultat trouvé !");
                return true;
            }

            const videoIds = searchData.items.map(i => i.id.videoId).join(',');
            const detailRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoIds}&key=${process.env.YOUTUBE_API_KEY}`);
            const detailData = await detailRes.json();
            const videos = detailData.items;

            const firstVideo = videos[0];
            const firstUrl = `https://www.youtube.com/watch?v=${firstVideo.id}`;

            const row = buildYoutubeRow(0, interaction.user.id, firstUrl, videos.length);
            const sent = await interaction.editReply({ embeds: [buildYoutubeEmbed(videos, 0)], components: [row] });

            youtubeSearches.set(sent.id, { videos, authorId: interaction.user.id });
            setTimeout(() => youtubeSearches.delete(sent.id), 5 * 60 * 1000);
            return true;
        } catch (e) {
            await interaction.editReply("Erreur lors de la recherche YouTube.");
            return true;
        }
    }

    if (cmd === 'last') {
        const query = interaction.options.getString('chaine');
        await interaction.deferReply();
        try {
            const channelInfo = await resolveChannelId(query);
            if (!channelInfo) {
                await interaction.editReply("Chaîne introuvable !");
                return true;
            }

            const latestRes = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelInfo.id}&order=date&maxResults=1&type=video&key=${process.env.YOUTUBE_API_KEY}`);
            const latestData = await latestRes.json();

            if (!latestData.items || latestData.items.length === 0) {
                await interaction.editReply("Aucune vidéo trouvée pour cette chaîne !");
                return true;
            }

            const video = latestData.items[0];
            const videoId = video.id.videoId;
            const detailRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoId}&key=${process.env.YOUTUBE_API_KEY}`);
            const detailData = await detailRes.json();
            const fullVideo = detailData.items[0];

            const duration = fullVideo.contentDetails.duration
                .replace('PT', '').replace('H', 'h ').replace('M', 'min ').replace('S', 's');
            const views = parseInt(fullVideo.statistics.viewCount, 10).toLocaleString('fr-FR');
            const date = new Date(video.snippet.publishedAt).toLocaleDateString('fr-FR', {
                day: 'numeric', month: 'long', year: 'numeric'
            });

            const embed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle(decodeHtmlEntities(video.snippet.title))
                .setURL(`https://www.youtube.com/watch?v=${videoId}`)
                .setThumbnail(video.snippet.thumbnails.high.url)
                .addFields(
                    { name: '📺 Chaîne', value: video.snippet.channelTitle, inline: true },
                    { name: '⏱️ Durée', value: duration, inline: true },
                    { name: '👁️ Vues', value: views, inline: true },
                    { name: '📅 Publié le', value: date, inline: true }
                );

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setLabel('🔗 Ouvrir').setStyle(ButtonStyle.Link).setURL(`https://www.youtube.com/watch?v=${videoId}`),
                new ButtonBuilder().setCustomId(`yt_close_${interaction.user.id}`).setLabel('❌ Fermer').setStyle(ButtonStyle.Danger)
            );

            await interaction.editReply({ embeds: [embed], components: [row] });
            return true;
        } catch (e) {
            await interaction.editReply("Erreur lors de la récupération de la vidéo.");
            return true;
        }
    }

    if (cmd === 'stats') {
        const query = interaction.options.getString('chaine');
        await interaction.deferReply();
        try {
            const channelInfo = await resolveChannelId(query);
            if (!channelInfo) {
                await interaction.editReply("Chaîne introuvable !");
                return true;
            }

            const detailRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,brandingSettings&id=${channelInfo.id}&key=${process.env.YOUTUBE_API_KEY}`);
            const detailData = await detailRes.json();

            if (!detailData.items || detailData.items.length === 0) {
                await interaction.editReply("Chaîne introuvable !");
                return true;
            }

            const channel = detailData.items[0];
            const snippet = channel.snippet;
            const statistics = channel.statistics;
            const createdDate = new Date(snippet.publishedAt).toLocaleDateString('fr-FR', {
                day: 'numeric', month: 'long', year: 'numeric'
            });

            const embed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle(snippet.title)
                .setURL(`https://www.youtube.com/channel/${channelInfo.id}`)
                .setThumbnail(snippet.thumbnails.high?.url ?? snippet.thumbnails.default.url)
                .setDescription(snippet.description ? snippet.description.slice(0, 200) + (snippet.description.length > 200 ? '...' : '') : '*Aucune description*')
                .addFields(
                    { name: '👥 Abonnés', value: statistics.hiddenSubscriberCount ? 'Caché' : formatNumber(statistics.subscriberCount), inline: true },
                    { name: '👁️ Vues totales', value: formatNumber(statistics.viewCount), inline: true },
                    { name: '🎬 Vidéos', value: formatNumber(statistics.videoCount), inline: true },
                    { name: '📅 Création', value: createdDate, inline: true }
                )
                .setFooter({ text: `ID : ${channelInfo.id}` });

            await interaction.editReply({ embeds: [embed] });
            return true;
        } catch (e) {
            await interaction.editReply("Erreur lors de la récupération des stats.");
            return true;
        }
    }

    return false;
}

// ==========================================
//  INTERACTIONS (Boutons, Menus, Modals)
// ==========================================
async function handleYoutubeInteraction(interaction) {
    // 1. Boutons du lecteur de recherche (yt_prev, yt_next, yt_close)
    if (interaction.isButton() && interaction.customId.startsWith('yt_')) {
        const parts = interaction.customId.split('_');
        const action = parts[1];
        const authorId = parts[2];

        if (interaction.user.id !== authorId) {
            await interaction.reply({ content: "C'est pas ta recherche !", ephemeral: true });
            return true;
        }

        if (action === 'close') {
            youtubeSearches.delete(interaction.message.id);
            await interaction.message.delete().catch(() => {});
            return true;
        }

        const search = youtubeSearches.get(interaction.message.id);
        if (!search) {
            await interaction.reply({ content: "Cette recherche a expiré !", ephemeral: true });
            return true;
        }

        const currentIndex = parseInt(parts[3], 10);
        const newIndex = action === 'next' ? currentIndex + 1 : currentIndex - 1;
        const { videos } = search;
        const video = videos[newIndex];
        const videoUrl = `https://www.youtube.com/watch?v=${video.id}`;

        await interaction.update({
            embeds: [buildYoutubeEmbed(videos, newIndex)],
            components: [buildYoutubeRow(newIndex, authorId, videoUrl, videos.length)]
        });
        return true;
    }

    // 2. Boutons du panneau !ytabo config
    if (interaction.isButton() && interaction.customId === 'ytabo_add_btn') {
        if (interaction.user.id !== EPSYS_ID) {
            await interaction.reply({ content: "Réservé à Epsys.", ephemeral: true });
            return true;
        }

        const modal = new ModalBuilder()
            .setCustomId('ytabo_modal_add')
            .setTitle('Ajouter une chaîne YouTube')
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('ytabo_input_chaine')
                        .setLabel('Nom, lien ou @handle de la chaîne')
                        .setPlaceholder('Ex : @Epsys ou https://youtube.com/@Epsys')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('ytabo_input_channel_id')
                        .setLabel('ID du salon Discord de destination')
                        .setPlaceholder('Ex : 720057528867618909')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('ytabo_input_msg')
                        .setLabel('Message personnalisé (facultatif)')
                        .setPlaceholder('Ex : 📢 Nouvelle vidéo de {chaine} ! {url}')
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(false)
                )
            );

        await interaction.showModal(modal);
        return true;
    }

    // Modal Soumission
    if (interaction.isModalSubmit() && interaction.customId === 'ytabo_modal_add') {
        if (interaction.user.id !== EPSYS_ID) return true;

        await interaction.deferUpdate();
        const rawChaine = interaction.fields.getTextInputValue('ytabo_input_chaine').trim();
        const salonId = interaction.fields.getTextInputValue('ytabo_input_channel_id').trim().replace(/[<#>]/g, '');
        const customMsg = interaction.fields.getTextInputValue('ytabo_input_msg').trim();

        const channelInfo = await resolveChannelId(rawChaine);
        if (!channelInfo) {
            await interaction.followUp({ content: `❌ Impossible de trouver la chaîne YouTube : \`${rawChaine}\``, ephemeral: true });
            return true;
        }

        const watchData = ytState.getYoutubeWatchData();
        watchData[channelInfo.id] = {
            channelId: channelInfo.id,
            title: channelInfo.title,
            discordChannelId: salonId,
            customMessage: customMsg || "📢 **Nouvelle vidéo de {chaine} !**\n{url}",
            lastVideoId: null
        };

        ytState.demanderSauvegarde();

        await interaction.editReply({
            embeds: [buildYtAboEmbed()],
            components: buildYtAboComponents()
        });
        await interaction.followUp({ content: `✅ Abonnement ajouté pour **${channelInfo.title}** dans <#${salonId}> !`, ephemeral: true });
        return true;
    }

    // Menu suppression d'une chaîne
    if (interaction.isStringSelectMenu() && interaction.customId === 'ytabo_remove_select') {
        if (interaction.user.id !== EPSYS_ID) return true;

        const targetChannelId = interaction.values[0];
        const watchData = ytState.getYoutubeWatchData();
        const removedTitle = watchData[targetChannelId]?.title || targetChannelId;

        delete watchData[targetChannelId];
        ytState.demanderSauvegarde();

        await interaction.update({
            embeds: [buildYtAboEmbed()],
            components: buildYtAboComponents()
        });
        await interaction.followUp({ content: `🗑️ Abonnement supprimé pour **${removedTitle}**.`, ephemeral: true });
        return true;
    }

    // Bouton de test manuel
    if (interaction.isButton() && interaction.customId === 'ytabo_test_btn') {
        if (interaction.user.id !== EPSYS_ID) return true;
        await interaction.deferReply({ ephemeral: true });

        const channels = getChannelsList();
        if (channels.length === 0) {
            await interaction.editReply("⚠️ Aucune chaîne YouTube n'est actuellement configurée. Clique sur **➕ Ajouter une chaîne** d'abord !");
            return true;
        }

        const rapport = [];
        for (const ch of channels) {
            try {
                const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${ch.channelId}`;
                const res = await fetch(rssUrl);
                if (res.ok) {
                    const xml = await res.text();
                    const titleMatch = xml.match(/<title>([^<]+)<\/title>/g);
                    const videoTitle = titleMatch && titleMatch[1] ? titleMatch[1].replace(/<\/?title>/g, '') : 'Dernière vidéo';
                    rapport.push(`✅ **${ch.title}** : Connecté\n> Dernière vidéo détectée : *${decodeHtmlEntities(videoTitle).slice(0, 60)}*`);
                } else {
                    rapport.push(`❌ **${ch.title}** : Erreur flux HTTP ${res.status}`);
                }
            } catch (e) {
                rapport.push(`❌ **${ch.title}** : Erreur de connexion`);
            }
        }

        await interaction.editReply({
            content: `🔔 **Rapport de vérification YouTube en direct :**\n\n${rapport.join('\n\n')}\n\n*Les alertes automatiques surveillent ces chaînes toutes les 3 minutes.*`
        });
        return true;
    }

    return false;
}

module.exports = {
    initYoutubeState,
    handleYoutubeMessage,
    handleYoutubeSlash,
    handleYoutubeButton: handleYoutubeInteraction,
    verifierNouvellesVideosYouTube
};