/**
 * Module Surveillance & Watchers pour Cacabot
 * Live Twitch Epsys, Surveillance Vocale, Conversion Instagram/TikTok, Sentinelles
 */

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const TWITCH_CHANNEL_ID = '862253918583390238';
const TWITCH_ROLE_ID = '862058765674741760';
const TWITCH_USER = 'epsys_';
const EPSYS_ID = '436218312574107658';

let twitchLiveEnCours = false;
const vocalMessages = new Map();
const dernierMessageParUtilisateur = new Map();

const REPOST_WATCH_USER = '1070742213635625050';
const REPOST_WATCH_CHANNEL = '1230637295649034240';

const VOICE_WATCH_CONFIGS = [
    {
        guildId: '1515767395036172469',
        textChannelId: '1515767396407705762',
        vocalIds: [
            '1515767396407705763',
            '1515768236443173105',
            '1515768324892655720'
        ]
    },
    {
        guildId: '720057528351850547',
        textChannelId: '720080025130369115',
        vocalIds: [
            '720057528867618910',
            '1465882952251736165',
            '1514586546014261278',
            '1542345188385619988'
        ]
    }
];

// =========================
//    SURVEILLANCE TWITCH
// =========================

async function buildTwitchLivePayload() {
    const liveUrl = `https://twitch.tv/${TWITCH_USER}`;
    const previewUrl = `https://static-cdn.jtvnw.net/previews-ttv/live_user_${TWITCH_USER}-1280x720.jpg?t=${Date.now()}`;

    const [titreRaw, jeuRaw, avatarRaw] = await Promise.all([
        fetch(`https://decapi.me/twitch/title/${TWITCH_USER}`).then(r => r.text()).catch(() => 'Live Twitch !'),
        fetch(`https://decapi.me/twitch/game/${TWITCH_USER}`).then(r => r.text()).catch(() => 'Just Chatting'),
        fetch(`https://decapi.me/twitch/avatar/${TWITCH_USER}`).then(r => r.text()).catch(() => null)
    ]);

    const titre = titreRaw.trim() || 'En direct sur Twitch !';
    const jeu = jeuRaw.trim() || 'Just Chatting';
    const avatar = (avatarRaw && avatarRaw.startsWith('http')) ? avatarRaw.trim() : null;

    const embed = new EmbedBuilder()
        .setColor(0x9146ff)
        .setAuthor({ name: `En direct sur Twitch !`, url: liveUrl })
        .setTitle(titre)
        .setURL(liveUrl)
        .addFields(
            { name: '🎮 Jeu / Catégorie', value: `\`${jeu}\``, inline: true },
            { name: '📺 Chaîne', value: `[twitch.tv/${TWITCH_USER}](${liveUrl})`, inline: true }
        )
        .setImage(previewUrl)
        .setFooter({ text: '🔴 Live Twitch • Notification automatique' })
        .setTimestamp();

    if (avatar) embed.setThumbnail(avatar);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('▶️ Rejoindre le stream').setStyle(ButtonStyle.Link).setURL(liveUrl)
    );

    return {
        content: `📢 Hey <@&${TWITCH_ROLE_ID}> !\n**Epsys** vient de lancer un live !`,
        embeds: [embed],
        components: [row]
    };
}

async function verifierTwitchLive(client) {
    try {
        const res = await fetch(`https://decapi.me/twitch/uptime/${TWITCH_USER}`).catch(() => null);
        if (!res || !res.ok) return;

        const resUptime = (await res.text()).trim();
        if (!resUptime || resUptime.startsWith('<') || resUptime.toLowerCase().includes('error')) return;

        const estHorsLigne = resUptime.toLowerCase().includes('offline') || resUptime.toLowerCase().includes('not found');
        const aDureeValide = /\b(second|minute|hour|day)s?\b/i.test(resUptime);
        const estEnLigne = !estHorsLigne && aDureeValide;

        if (estEnLigne && !twitchLiveEnCours) {
            twitchLiveEnCours = true;
            const channel = client.channels.cache.get(TWITCH_CHANNEL_ID);
            if (!channel) return;

            const payload = await buildTwitchLivePayload();
            await channel.send(payload);
            console.log(`[Twitch] Vrai live détecté pour ${TWITCH_USER} (${resUptime}) !`);
        } else if (!estEnLigne && twitchLiveEnCours) {
            twitchLiveEnCours = false;
        }
    } catch (e) {}
}

// =========================
//    SENTINELLES MESSAGES
// =========================

async function handleWatcherMessage(message) {
    // 1. Notification Shorts/TikTok Gappy
    if (message.channel.id === '1460051840015269908' && message.author.id === '1525026449768321098') {
        await message.channel.send(`<@&1504492103194120273>`);
    }

    // 2. Nettoyage de double pub Twitch Shin dans #Promo
    if (message.author.id === REPOST_WATCH_USER && message.channel.id === REPOST_WATCH_CHANNEL) {
        if (message.content.includes('https://www.twitch.tv/belrose_shin')) {
            const cle = `${message.channel.id}-${message.author.id}`;
            const precedent = dernierMessageParUtilisateur.get(cle);
            if (precedent) await precedent.delete().catch(() => {});
            dernierMessageParUtilisateur.set(cle, message);
        }
    }

    // 3. Remplacement liens Instagram (kkinstagram)
    const instaRegex = /https?:\/\/(?:www\.)?instagram\.com\/(?:reel|p)\/[^\s]+/gi;
    const instaMatches = message.content.match(instaRegex);
    if (instaMatches) {
        const auteurNom = message.member?.displayName ?? message.author.username;
        const liensConvertis = instaMatches.map(url => url.replace('instagram.com', 'kkinstagram.com'));

        const row = new ActionRowBuilder().addComponents(
            instaMatches.slice(0, 5).map((url, i) =>
                new ButtonBuilder()
                    .setLabel(instaMatches.length > 1 ? `🔗 Lien original ${i + 1}` : '🔗 Lien original')
                    .setStyle(ButtonStyle.Link)
                    .setURL(url)
            )
        );

        await message.delete().catch(() => {});
        await message.channel.send(`**${auteurNom}** a reposté cette publication Instagram !\n-# *(je change juste le lien pour que tout le monde y ait accès)*`);
        setTimeout(() => {
            message.channel.send({ content: liensConvertis.join('\n'), components: [row] }).catch(() => {});
        }, 300);
        return true;
    }

    // 4. Remplacement liens TikTok (kktiktok)
    const tiktokRegex = /https?:\/\/(?:vm\.|vt\.|www\.|m\.)?tiktok\.com\/[^\s]+/gi;
    const tiktokMatches = message.content.match(tiktokRegex);
    if (tiktokMatches) {
        const auteurNom = message.member?.displayName ?? message.author.username;
        const convertUrl = (url) => url.replace(/(?:vm\.|vt\.|www\.|m\.)?tiktok\.com/i, (match) => {
            if (/^vm\./i.test(match)) return 'vm.kktiktok.com';
            if (/^vt\./i.test(match)) return 'vt.kktiktok.com';
            if (/^m\./i.test(match)) return 'm.kktiktok.com';
            if (/^www\./i.test(match)) return 'www.kktiktok.com';
            return 'kktiktok.com';
        });
        const liensConvertis = tiktokMatches.map(convertUrl);

        await message.delete().catch(() => {});
        await message.channel.send(`**${auteurNom}** a reposté ce TikTok !\n-# *(je change juste le lien pour que tout le monde y ait accès)*`);
        setTimeout(() => {
            message.channel.send(liensConvertis.join('\n')).catch(() => {});
        }, 300);
        return true;
    }

    // 5. Commande !streamtest (Epsys-only)
    if (message.content.trim().toLowerCase() === '!streamtest') {
        if (message.author.id !== EPSYS_ID) return true;
        try {
            const payload = await buildTwitchLivePayload();
            await message.reply({ ...payload, allowedMentions: { repliedUser: false, parse: [] } });
            await message.react('🟣').catch(() => {});
        } catch (err) {
            await message.reply(`❌ Erreur lors du test : \`${err.message}\``);
        }
        return true;
    }

    return false;
}

// =========================
//    SURVEILLANCE VOCALE
// =========================

async function handleVoiceStateUpdate(oldState, newState) {
    const config = VOICE_WATCH_CONFIGS.find(c => c.guildId === newState.guild.id);
    if (!config) return;
    const { guildId: GUILD_ID, textChannelId: TEXT_CHANNEL_ID, vocalIds: VOCAL_IDS } = config;

    const textChannel = newState.guild.channels.cache.get(TEXT_CHANNEL_ID);
    if (!textChannel) return;

    const supprimerAncien = async () => {
        const ancien = vocalMessages.get(GUILD_ID);
        if (!ancien) return;
        ancien.timeouts.forEach(t => clearTimeout(t));
        await ancien.message.delete().catch(() => {});
        vocalMessages.delete(GUILD_ID);
    };

    // Quelqu'un quitte le vocal surveillé
    if (
        oldState.channelId && VOCAL_IDS.includes(oldState.channelId) &&
        (!newState.channelId || !VOCAL_IDS.includes(newState.channelId))
    ) {
        const ancien = vocalMessages.get(GUILD_ID);
        if (ancien?.memberId === newState.member?.id) {
            await supprimerAncien();
        }
        return;
    }

    // Quelqu'un rejoint un vocal surveillé
    if (!newState.channelId || !VOCAL_IDS.includes(newState.channelId)) return;
    if (oldState.channelId === newState.channelId) return;

    const channel = newState.channel;
    if (!channel || channel.members.size >= 2) return;

    const memberNom = newState.member?.displayName ?? newState.member?.user.username ?? 'Quelqu\'un';
    const memberId = newState.member?.id;
    const channelName = channel.name;

    await supprimerAncien();

    const msg = await textChannel.send(`**${memberNom}** a rejoint **${channelName}** ! On se fait un ptit voc ? 👀`);

    const t1 = setTimeout(async () => {
        await newState.guild.members.fetch(memberId).catch(() => {});
        const member = newState.guild.members.cache.get(memberId);
        if (!member?.voice.channelId || !VOCAL_IDS.includes(member.voice.channelId)) return;
        await msg.edit(`**${memberNom}** attend depuis **30 minutes** en vocal... Quelqu'un ? 👀`).catch(() => {});
    }, 30 * 60 * 1000);

    const t2 = setTimeout(async () => {
        const member = newState.guild.members.cache.get(memberId);
        if (!member?.voice.channelId || !VOCAL_IDS.includes(member.voice.channelId)) return;
        await msg.edit(`**${memberNom}** attend depuis **1 heure** en vocal... C'est long quand même. 👀`).catch(() => {});
    }, 60 * 60 * 1000);

    const t3 = setTimeout(async () => {
        const member = newState.guild.members.cache.get(memberId);
        if (!member?.voice.channelId || !VOCAL_IDS.includes(member.voice.channelId)) return;
        await msg.edit(`**${memberNom}** attend depuis **2 heures** en vocal. Y a vraiment personne là ? 👀`).catch(() => {});
    }, 120 * 60 * 1000);

    vocalMessages.set(GUILD_ID, { message: msg, memberId, channelName, timeouts: [t1, t2, t3] });
}

module.exports = {
    verifierTwitchLive,
    buildTwitchLivePayload,
    handleWatcherMessage,
    handleVoiceStateUpdate
};