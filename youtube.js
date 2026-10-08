/**
 * Module YouTube pour Cacabot
 * Commandes : !youtube, !last, !stats et leurs équivalents Slash
 */

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const youtubeSearches = new Map(); // messageId -> { videos, authorId }

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
    const forHandleRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(searchTerm.replace('@', ''))}&key=${process.env.YOUTUBE_API_KEY}`);
    const forHandleData = await forHandleRes.json();

    if (forHandleData.items && forHandleData.items.length > 0) {
        return forHandleData.items[0].id;
    }

    const searchRes = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(searchTerm)}&type=channel&maxResults=1&key=${process.env.YOUTUBE_API_KEY}`);
    const searchData = await searchRes.json();
    if (searchData.items && searchData.items.length > 0) {
        return searchData.items[0].snippet.channelId;
    }

    return null;
}

// =========================
//  GESTION DES MESSAGES (!)
// =========================
async function handleYoutubeMessage(message, response) {
    const raw = message.content.trim();
    const command = raw.split(/\s+/)[0]?.toLowerCase();

    // 1. Commande !last
    if (command === '!last' || response?.needsLastVideo) {
        const query = raw.split(/\s+/).slice(1).join(' ');
        if (!query) {
            await message.reply("Usage : `!last [nom ou URL de la chaîne]`");
            return true;
        }

        try {
            const channelId = await resolveChannelId(query);
            if (!channelId) {
                await message.reply("Chaîne introuvable !");
                return true;
            }

            const latestRes = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&maxResults=1&type=video&key=${process.env.YOUTUBE_API_KEY}`);
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
            const channelId = await resolveChannelId(query);
            if (!channelId) {
                await message.reply("Chaîne introuvable !");
                return true;
            }

            const detailRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,brandingSettings&id=${channelId}&key=${process.env.YOUTUBE_API_KEY}`);
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
                .setURL(`https://www.youtube.com/channel/${channelId}`)
                .setThumbnail(snippet.thumbnails.high?.url ?? snippet.thumbnails.default.url)
                .setDescription(snippet.description ? snippet.description.slice(0, 200) + (snippet.description.length > 200 ? '...' : '') : '*Aucune description*')
                .addFields(
                    { name: '👥 Abonnés', value: stats.hiddenSubscriberCount ? 'Caché' : formatNumber(stats.subscriberCount), inline: true },
                    { name: '👁️ Vues totales', value: formatNumber(stats.viewCount), inline: true },
                    { name: '🎬 Vidéos', value: formatNumber(stats.videoCount), inline: true },
                    { name: '📅 Création', value: createdDate, inline: true }
                )
                .setFooter({ text: `ID : ${channelId}` });

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
            const channelId = await resolveChannelId(query);
            if (!channelId) {
                await interaction.editReply("Chaîne introuvable !");
                return true;
            }

            const latestRes = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&maxResults=1&type=video&key=${process.env.YOUTUBE_API_KEY}`);
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
            const channelId = await resolveChannelId(query);
            if (!channelId) {
                await interaction.editReply("Chaîne introuvable !");
                return true;
            }

            const detailRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,brandingSettings&id=${channelId}&key=${process.env.YOUTUBE_API_KEY}`);
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
                .setURL(`https://www.youtube.com/channel/${channelId}`)
                .setThumbnail(snippet.thumbnails.high?.url ?? snippet.thumbnails.default.url)
                .setDescription(snippet.description ? snippet.description.slice(0, 200) + (snippet.description.length > 200 ? '...' : '') : '*Aucune description*')
                .addFields(
                    { name: '👥 Abonnés', value: statistics.hiddenSubscriberCount ? 'Caché' : formatNumber(statistics.subscriberCount), inline: true },
                    { name: '👁️ Vues totales', value: formatNumber(statistics.viewCount), inline: true },
                    { name: '🎬 Vidéos', value: formatNumber(statistics.videoCount), inline: true },
                    { name: '📅 Création', value: createdDate, inline: true }
                )
                .setFooter({ text: `ID : ${channelId}` });

            await interaction.editReply({ embeds: [embed] });
            return true;
        } catch (e) {
            await interaction.editReply("Erreur lors de la récupération des stats.");
            return true;
        }
    }

    return false;
}

// =========================
//  GESTION DES BOUTONS (yt_)
// =========================
async function handleYoutubeButton(interaction) {
    if (!interaction.isButton() || !interaction.customId.startsWith('yt_')) return false;

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

module.exports = {
    handleYoutubeMessage,
    handleYoutubeSlash,
    handleYoutubeButton
};