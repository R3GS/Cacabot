'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomInt } = require('node:crypto');
const {
    ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
    MessageFlags, ModalBuilder, StringSelectMenuBuilder, TextInputBuilder,
    TextInputStyle, UserSelectMenuBuilder
} = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const { getPlayCards, getPlayCatalog, renderPlayBinder, grantMinigameTcgPoints } = require('./tcg.js');

const REGAIA_GUILD_ID = '720057528351850547';
const PLAY_CHANNEL_ID = '1575601558458994758';
const PLAY_TEST_CHANNEL_ID = '1480756332373213275';
const PLAY_TEST_OWNER_ID = '436218312574107658';
const TEST_NAMES = ['Moka', 'Pixel', 'Biscotte'];
const STATE_PATH = process.env.REGADEX_PLAY_STATE_PATH || path.join(__dirname, '.play-schedule.json');
const PLAY_ROLE_CHANNEL_ID = '1559082682313474059';
const PARIS_TZ = 'Europe/Paris';
const TCG_BG_PATH = path.resolve(process.cwd(), 'TCG', 'Assets', 'Background RegaDex B.jpg');
const IDLE_MS = 15 * 60_000;
const JOIN_MS = 30_000;
const READY_MS = 15_000;
const PICK_MS = 90_000;
const RATE_MS = 10_000;
const CONTINUE_MS = 60_000;
const WEEKDAY_SESSION_LIMIT = 3;
const SUNDAY_CUTOFF_HOUR = 18;
const WRITE_MS = 75_000;
const STOP_VOTE_MS = 120_000;
const ROUND_COUNT = 5;
const COLOR = 0xf1c40f;
const SEP = '────────────────────────────────────────';
const IGNORABLE_DISCORD_CODES = new Set([10003, 10008, 10062, 40060, 50001, 50013, 50083]);
const GAME_COLORS = {
    vitrine: 0x9b59b6,
    cavale: 0xe67e22,
    casting: 0xe74c3c,
    devine: 0x3498db,
    classement: 0x1abc9c,
    fmk: 0xe91e63
};
const GAME_META = {
    vitrine: '5 manches • ~8 min',
    cavale: '5 cartes • ~5-15 min',
    casting: 'Débat 5 min • 2 joueurs+',
    devine: 'Enquête • 2 joueurs+',
    classement: 'Top 4 • 1 joueur+',
    fmk: 'Trio + justifs • 1 joueur+'
};
const RARITY_STYLE = {
    Commune: { emoji: '⚪', hex: '#E6D5B8', glow: 'rgba(230, 213, 184, 0.50)' },
    Rare: { emoji: '🔵', hex: '#009DFF', glow: 'rgba(0, 157, 255, 0.55)' },
    'Épique': { emoji: '🟣', hex: '#A855F7', glow: 'rgba(168, 85, 247, 0.60)' },
    'Légendaire': { emoji: '🟡', hex: '#F1C40F', glow: 'rgba(241, 196, 15, 0.65)' },
    Personnalisée: { emoji: '🌟', hex: '#FF6B9D', glow: 'rgba(255, 107, 157, 0.60)' }
};
const RATINGS = [
    ['like', 'J’aime', 50, ButtonStyle.Success, '👍'],
    ['meh', 'Meh', 0, ButtonStyle.Secondary, '😐'],
    ['no', 'Pas drôle', -50, ButtonStyle.Danger, '👎'],
    ['love', 'J’adore !', 100, ButtonStyle.Primary, '❤️']
];
const GUIDES = {
    vitrine: ['Blanc Manger Caca', 'Complète la phrase avec 1 ou 2 cartes du TCG.', '🎭',
        'Cinq manches. Cherche les cartes par nom ou numéro en 90 secondes. Les réponses sont anonymes et défilent 10 secondes chacune. Une note par réponse des autres. Sans vote, elle vaut Meh. J’adore ! s’utilise une fois sur les cinq manches.'],
    cavale: ['Cartes zoomées', 'Reconnais les illustrations à partir de détails zoomés.', '🔍',
        'Écris le nom dans le salon. Les petites fautes sont acceptées si le nom reste reconnaissable. L’image dézoome un peu chaque minute. Première bonne réponse gagnante, révélation au bout de cinq minutes maximum. Cinq cartes par partie.'],
    casting: ['Débat de golmon', 'Choisis un sujet, et défends ton candidat dans un débat de cinq minutes.', '🎙️',
        'Deux volontaires tirés au sort, ou un duel à deux. Chacun peut changer de carte trois fois en privé avant de la verrouiller. Les cartes sont révélées ensemble. Le public vote à la fin du débat. En duel, les deux personnes votent.'],
    devine: ['Devine-carte', 'Devine une carte à tour de rôle avec les réponses Oui/Non du MJ.', '🕵️',
        'Le MJ est tiré parmi les volontaires. Tu peux poser une question, proposer une carte en privé ou passer sans dépenser ton quota. Après deux tours expirés, tu peux revenir avec Reprendre ma place. Une dernière minute trente s’ouvre quand les questions sont épuisées.'],
    classement: ['Le Classement impossible', 'Classe quatre cartes selon un sujet donné et défends ton choix devant le peuple.', '📋',
        'Les inscrits votent pour un tirage commun ou individuel. Tout le monde reçoit la même consigne. Verrouille ta liste en privé, puis présente-la à ton tour. Le salon vote pour le classement le mieux défendu ou le plus drôle.'],
    fmk: ['Fuck, Marry, Kill', 'Le jeu à la con parfait pour les cartes du TCG.', '💌',
        'Place les trois cartes Personnage, verrouille le trio puis explique chaque choix. Tu as 4 min 30. Un trio verrouillé compte même sans justification. Après les résultats, le salon vote pour la meilleure justification ou le meilleur trio.']
};
const MIN_PLAYERS = { vitrine: 2, cavale: 1, casting: 2, devine: 2, classement: 1, fmk: 1 };
const PROMPT_BLANK = '〔…〕';
const PROMPTS = [
    'Jordan Bardella a été remplacé par 〔…〕 pendant son congé maladie, et c’est un excellent choix.',
    'Le serveur allait bien, jusqu’au jour où 〔…〕 est devenu modo.',
    'La seule bonne raison de voter RN, ce serait 〔…〕.',
    'La pire chose qu’on a retrouvée dans les archives du serveur : 〔…〕.',
    'La commu attendait la nouvelle vidéo d’Epsys. À la place, elle a sorti 〔…〕.',
    'La raison officielle du retard de la prochaine vidéo d’Epsys : 〔…〕.',
    '〔…〕 et 〔…〕 ont décidé de refaire tout le serveur à 4 h du matin.',
    'Le duo le moins crédible pour sauver le pays : 〔…〕 et 〔…〕.',
    'Pour demander conseil sur mes hémorroïdes, j’ai demandé de l’aide à 〔…〕.',
    'J’ai croisé 〔…〕 à KFC. Je savais pas si je devais m’enfuir ou rester sur place.',
    'Le premier débat de la soirée oppose 〔…〕 à 〔…〕.',
    'Maman, pourquoi t’as mis 〔…〕 dans mon sandwich ?',
    'Rien n’a jamais autant sali mon esprit que 〔…〕',
    'Ce qui a définitivement foutu en l’air mes examens, c’est 〔…〕',
    'À l’enterrement de mamie, on a tous trouvé 〔…〕 dans son cercueil.',
    'Le truc le plus dégueulasse que j’ai jamais goûté, c’est 〔…〕',
    'Quand je me sens vraiment pas bien, je me console en pensant à 〔…〕.',
    'Le jour où j’ai découvert que papa collectionnait des photos de 〔…〕, mon innocence a été foutue en l’air.',
    '〔…〕 = le problème. 〔…〕 = la solution.',
    'Je pense que 〔…〕 ferait un.e excellent.e président.e',
    'Marre des wokistes ! Je voterai pour 〔…〕 aux prochaines présidentielles.',
    'Quand quelqu’un m’énerve, j’ai envie de lui mettre 〔…〕 dans la gueule.',
    'Si le monde pensait un peu plus à 〔…〕, les choses seraient sans doute meilleures...',
    'Je pensais avoir contracté un cancer, mais finalement, on m’a annoncé que j’avais 〔…〕...',
    'Maman m’a annoncé un secret... Elle trompe mon père avec 〔…〕.',
    'La seule chose que j’ai ramenée de la crémation de papa, c’est 〔…〕.',
    'J’ai ouvert l’urne de mamie pour voir. Franchement, je m’attendais à autre chose que 〔…〕.',
    'Le médecin m’a dit qu’il me restait six mois. J’ai demandé si je pouvais les passer avec 〔…〕.',
    'Sur sa carte de donneur d’organes, papa avait écrit à la main « je garde 〔…〕 ».',
    'Le psy m’a proposé de donner un nom à mon traumatisme. J’ai choisi 〔…〕.',
    'Le premier mot de mon enfant, c’était « 〔…〕 ». Depuis, on pense à le faire adopter.',
    'Le pire, dans le divorce, c’est que le juge m’a laissé la garde de 〔…〕.',
    'Dans son exposé sur le petit Grégory, mon fils avait mis 〔…〕 dans son PowerPoint, tout le monde était choqué.',
    'Papi refuse de parler de l’Occupation allemande depuis qu’on a retrouvé une photo de lui avec 〔…〕.',
    'Le Débarquement aurait duré vingt minutes si les Alliés avaient pensé à emmener 〔…〕 avec eux.',
    'C’était un buffet à volonté, et pourtant, je n’ai pas arrêté de prendre du 〔…〕.',
    'Le Premier ministre a promis de réduire la dette en vendant 〔…〕 sur Leboncoin.',
    'On m’a dit « votez bien », alors j’ai voté 〔…〕.',
    'Mon secret pour garder jeunesse éternelle ? C’est 〔…〕.',
    'J’ai acheté 〔…〕 dans votre magasin. J’aimerais me faire rembourser immédiatement s’il vous plaît.',
    'Si j’ai un enfant un jour, j’aimerais l’appeler 〔…〕. C’est le nom de sa grand-mère.',
    'Ok, j’avoue tout, j’avais un crush sur 〔…〕 y a quelques années.',
    'Qui c’est qui me fournit ma coke ? 〔…〕.',
    '〔…〕, la meilleure solution contre les mycoses de pied ! Seulement 29,99€ dans votre pharmacie préférée !',
    'Si je devais remplacer mes deux parents, je prendrais 〔…〕 et 〔…〕.',
    'Quand j’ai appris le décès de 〔…〕, j’ai énormément pleuré...',
    'On oublie GTA VI, ce soir c’est 〔…〕 Simulator.',
    '« Vous voulez une inhumation ou une crémation ? » Maman a répondu « 〔…〕 ».',
    'Sur l’acte de décès, le médecin a écrit « 〔…〕 ». Sur Facebook, maman a préféré écrire « 〔…〕 ».',
    'Pour le petit Grégory, j’ai pris 〔…〕 comme illustration. La prof m’a demandé de rester après le cours.',
    'Le sujet du bac, c’était « Expliquez les causes de la Seconde Guerre mondiale ». J’ai écrit « 〔…〕 ».',
    'Mon programme pour 2027 tient en deux mesures. Rendre 〔…〕 obligatoire et rembourser 〔…〕 à 100 %.',
    'Je suis en train de mater une série en ce moment, c’est « La Légende de 〔…〕 », c’est pas mal !'
];
const STEP_TIPS = {
    volunteer: 'Être volontaire t’ajoute au tirage du maître du jeu.',
    mjReady: 'Ouvrir la carte secrète est réservé au MJ. La carte reste cachée aux enquêteurs.',
    turn: 'Poser une question ouvre un formulaire • Proposer une carte envoie une tentative privée • Passer conserve ton quota.',
    waitingMJ: 'Ouvrir le pupitre MJ montre la question en privé pour répondre Oui, Non ou À reformuler.',
    stopVote: 'Arrêter ajoute ta voix (majorité des enquêteurs requise).',
    dormant: 'Reprendre la partie relance le tour • Reprendre ma place te réinscrit dans la rotation.',
    finalGuess: 'Proposer ma dernière carte envoie une tentative privée unique.',
    castingSetup: 'Le menu combine le format du débat et l’origine du sujet (réservé à l’hôte).',
    castVolunteer: 'Je veux débattre t’inscrit au tirage des deux candidats.',
    castPrompt: 'Écrire la question ouvre le formulaire de la personne désignée.',
    castCards: 'Voir / changer ma carte ouvre ton tirage en privé (3 relances max).',
    castDebate: 'Débattez dans le salon • L’hôte peut passer au vote à tout moment.',
    rankSetup: 'Consigne préparée tire une question • Consigne d’un membre désigne quelqu’un au hasard.',
    rankWrite: 'Écrire la consigne ouvre le formulaire de la personne désignée.',
    socialChoices: 'Ouvre ton panneau privé, place tes cartes puis verrouille.',
    presenting: 'J’ai fini et Passer donnent la parole à la personne suivante.'
};

const menus = new Map();
const sessions = new Map();
let playReady = false;
let scheduleState = { weekKey: '', order: [], started: {}, daily: {} };
let schedulerTimer = null;
let playBgCache = null;

const escapeText = text => String(text).replace(/[\\`*_~|<>]/g, '\\$&');
const normalize = text => String(text)
    .replace(/œ/gi, 'oe')
    .replace(/æ/gi, 'ae')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();
const cleanCanvasRaw = str => String(str || '')
    .replace(/<a?:\w+:\d+>/g, '')
    .replace(/<@!?\d+>/g, '@Membre')
    .replace(/\*\*|__|~~|`/g, '')
    .replace(/·/g, '•')
    .replace(/〔/g, '[')
    .replace(/〕/g, ']')
    .replace(/[\p{Extended_Pictographic}\uFE00-\uFE0F\u200D\u20E3]/gu, '')
    .replace(/[^\u0020-\u007E\u00A0-\u017F\u2013-\u2026\u20AC]/g, '')
    .replace(/\s+/g, ' ');
const cleanCanvasText = str => cleanCanvasRaw(str).trim();
const cut = (text, size) => String(text).slice(0, size).replace(/[\uD800-\uDBFF]$/, '');
const expiry = time => '<t:' + Math.ceil(time / 1000) + ':R>';
const idFor = (...parts) => ['play', ...parts].join(':');
const row = (...components) => new ActionRowBuilder().addComponents(components);
const button = (id, label, style = ButtonStyle.Secondary, emoji = null) => {
    const btn = new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
    if (emoji) btn.setEmoji(emoji);
    return btn;
};
const gameColor = game => GAME_COLORS[game] || COLOR;
const embed = (title, color = COLOR) => new EmbedBuilder().setColor(color).setTitle(title);
const cardSetLabel = card => card?.setLabel || (card?.id ? 'Set ' + String(card.id).split('-')[0] : 'RegaDex');
const progressBar = (current, total, length = 12) => {
    if (!total || total <= 0) return '▱'.repeat(length);
    const filled = Math.max(0, Math.min(length, Math.round((current / total) * length)));
    return '▰'.repeat(filled) + '▱'.repeat(length - filled);
};
const silent = (payload, users = []) => ({
    ...payload,
    flags: [MessageFlags.SuppressNotifications],
    allowedMentions: users.length ? { parse: [], users } : { parse: [], repliedUser: false }
});
const privateResponse = (interaction, content) => interaction.reply({ content, flags: MessageFlags.Ephemeral });

function localParisParts(date = new Date()) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
        timeZone: PARIS_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
        weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(date).map(part => [part.type, part.value]));
    return parts;
}
function localDateKey(parts) { return parts.year + '-' + parts.month + '-' + parts.day; }
function mondayOf(dateKey) {
    const [year, month, day] = dateKey.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    return date.toISOString().slice(0, 10);
}
function saveScheduleState() {
    fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
    const temp = STATE_PATH + '.tmp';
    fs.writeFileSync(temp, JSON.stringify(scheduleState), { mode: 0o600 });
    fs.renameSync(temp, STATE_PATH);
}
function ensureScheduleWeek(dateKey) {
    const monday = mondayOf(dateKey);
    if (scheduleState.weekKey !== monday || !Array.isArray(scheduleState.order) || scheduleState.order.length !== Object.keys(GUIDES).length) {
        scheduleState = { weekKey: monday, order: shuffled(Object.keys(GUIDES)), started: {}, daily: {} };
        saveScheduleState();
    }
}
function weekdayGame(dateKey) {
    ensureScheduleWeek(dateKey);
    const weekday = new Date(dateKey + 'T00:00:00Z').getUTCDay();
    if (weekday === 0) return null;
    return scheduleState.order[(weekday + 6) % 7] || null;
}
function nextPlayInfo(now = new Date()) {
    const parts = localParisParts(now), today = localDateKey(parts);
    const hour = Number(parts.hour), minute = Number(parts.minute);
    const dow = new Date(today + 'T00:00:00Z').getUTCDay();
    if (dow === 0 && hour < SUNDAY_CUTOFF_HOUR) return { date: today, sunday: true, game: null };
    if (dow !== 0 && (hour < 17 || (hour === 17 && minute === 0))) return { date: today, sunday: false, game: weekdayGame(today) };
    const date = new Date(today + 'T00:00:00Z');
    date.setUTCDate(date.getUTCDate() + 1);
    const key = date.toISOString().slice(0, 10);
    if (date.getUTCDay() === 0) return { date: key, sunday: true, game: null };
    return { date: key, sunday: false, game: weekdayGame(key) };
}
function playInfoEmbed(activeSession = null) {
    const next = nextPlayInfo();
    const date = new Date(next.date + 'T12:00:00Z');
    const dateLabel = new Intl.DateTimeFormat('fr-FR', { timeZone: PARIS_TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(date);
    const chosen = next.sunday ? '🗳️ **Vote de la communauté** pour choisir le jeu' :
        (GUIDES[next.game]?.[2] || '🎮') + ' **' + (GUIDES[next.game]?.[0] || 'Mini-jeu RegaDex') + '**';
    const active = activeSession && activeSession.phase !== 'closed'
        ? '\n\n### 🟢 Session en cours\n' + (activeSession.sunday && activeSession.phase === 'ballot' ? '🗳️ **Vote du dimanche en cours**' :
            (GUIDES[activeSession.game]?.[2] || '🎮') + ' **' + (GUIDES[activeSession.game]?.[0] || 'Mini-jeu') + '**') +
            ' — rejoins-la dans <#' + PLAY_CHANNEL_ID + '>.'
        : '';
    return embed('🎮 RegaDex Arcade · Les mini-jeux', 0x9b59b6)
        .setAuthor({ name: 'Les rendez-vous RegaDex' })
        .setDescription(
            'Chaque jour à **17 h (heure de Paris)**, Cacabot ouvre une session publique dans <#' + PLAY_CHANNEL_ID + '>.\n' +
            'Les inscriptions durent **30 secondes**, puis les personnes inscrites reçoivent **15 secondes** pour se préparer.\n\n' +
            '### 🎲 Au programme\n' +
            Object.entries(GUIDES).map(([id, [name, summary, icon]]) => icon + ' **' + name + '** — ' + summary).join('\n') +
            '\n\n' + SEP + '\n\n### ⏰ Prochaine session\n' + chosen +
            '\n📅 **' + dateLabel + ' à 17 h**\n\nRejoins <#' + PLAY_CHANNEL_ID + '> et appuie sur **Rejoindre** quand les inscriptions ouvrent.' +
            '\nSi tu ne vois pas ce salon, prends le rôle correspondant dans <#' + PLAY_ROLE_CHANNEL_ID + '>. ' +
            'Les tests Epsys se font avec !playx dans <#' + PLAY_TEST_CHANNEL_ID + '>. ' + active
        )
        .setFooter({ text: 'Du lundi au samedi : jeu planifié • Dimanche : vote libre entre 17 h et 18 h' });
}
async function announceTomorrow(channel) {
    const date = new Date(localDateKey(localParisParts()) + 'T12:00:00Z');
    date.setUTCDate(date.getUTCDate() + 1);
    const key = date.toISOString().slice(0, 10);
    const sunday = date.getUTCDay() === 0;
    const dateLabel = new Intl.DateTimeFormat('fr-FR', { timeZone: PARIS_TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(date);
    const game = sunday ? '🗳️ **Vote de la communauté** pour choisir le mini-jeu' :
        '🎮 **' + GUIDES[weekdayGame(key)][0] + '**';
    await channel.send(silent({ embeds: [embed('📅 Prochain rendez-vous RegaDex', 0x5865f2)
        .setDescription('La prochaine session aura lieu **' + dateLabel + ' à 17 h (heure de Paris)**.\n' + game)
        .setFooter({ text: 'Rendez-vous dans le salon des mini-jeux à 17 h • !play pour le programme' })] }))
        .catch(error => console.warn('[PLAY] Annonce du prochain rendez-vous :', error));
}
async function makeSession(channel, { host, game, test = false, invited = null, botCount = 0, startRound = 1, scheduled = false, sunday = false } = {}) {
    const id = channel.id;
    const existing = sessions.get(id);
    if (existing && existing.phase !== 'closed') return existing;
    const totalRounds = (game === 'vitrine' || game === 'cavale') ? ROUND_COUNT : 1;
    const safeStartRound = test ? Math.min(totalRounds, Math.max(1, Number(startRound) || 1)) : 1;
    const member = host && host !== channel.client.user.id ? channel.guild.members.cache.get(host) : null;
    const hostPlayer = member
        ? { id: host, name: member.displayName || member.user.username, avatar: member.user.displayAvatarURL({ extension: 'png', size: 128 }) }
        : { id: channel.client.user.id, name: 'Cacabot', avatar: channel.client.user.displayAvatarURL({ extension: 'png', size: 128 }) };
    const bots = new Map(test ? TEST_NAMES.slice(0, botCount).map((name, i) => ['bot-' + i, { id: 'bot-' + i, name: name + ' [bot]' }]) : []);
    const players = new Map(host && !scheduled ? [[host, hostPlayer], ...bots] : [...bots]);
    const session = {
        channel, host: hostPlayer.id, game, invited, test, bots, allowLate: false, queue: Promise.resolve(),
        players, people: new Map(players), pending: new Map(), optedOut: new Set(), results: new Map(),
        timer: null, botTimer: null, round: 0, startRound: safeStartRound, roundStarted: false,
        scheduled, sunday, scheduleDate: scheduled ? localDateKey(localParisParts()) : null,
        runId: Date.now().toString(36) + '-' + randomInt(1_000_000_000).toString(36)
    };
    sessions.set(id, session);
    return session;
}
async function launchScheduledSession(client, { game = null, sunday = false, dateKey }) {
    const channel = await client.channels.fetch(PLAY_CHANNEL_ID).catch(() => null);
    if (!channel?.isTextBased()) return;
    if (sessions.get(channel.id)?.phase && sessions.get(channel.id).phase !== 'closed') return;
    const session = await makeSession(channel, { host: client.user.id, game: game || 'vitrine', scheduled: true, sunday });
    session.scheduleDate = dateKey;
    if (sunday) {
        const voters = new Set([...channel.guild.members.cache.values()].filter(member => !member.user.bot).map(member => member.id));
        session.players.clear(); session.people.clear(); session.phase = 'ballot';
        await openBallot(session, {
            title: '🗳️ Dimanche RegaDex · Choisissez le jeu',
            description: 'Votez pour le mini-jeu de cette session. Le vote se ferme dès que tout le monde a voté ou après une minute. En cas d’égalité, Cacabot tire au sort.',
            voters, options: Object.entries(GUIDES).map(([value, [label, , emoji]]) => ({ value, label, emoji })), ms: 60_000,
            choose: async (leaders, votes) => {
                if (!leaders.length || Number(localParisParts().hour) >= SUNDAY_CUTOFF_HOUR) {
                    return closeSession(session, 'Le vote est clos. La session dominicale s’arrête à 18 h.');
                }
                session.game = leaders[randomInt(leaders.length)];
                const counts = new Map();
                for (const value of votes.values()) counts.set(value, (counts.get(value) || 0) + 1);
                const stats = Object.entries(GUIDES).map(([id, [name, , icon]]) => icon + ' **' + name + '** — ' + (counts.get(id) || 0) + ' vote(s)').join('\n');
                await channel.send(silent({ embeds: [embed('📊 Résultat du vote dominical', gameColor(session.game))
                    .setDescription('Le prochain jeu est **' + GUIDES[session.game][0] + '**.\n\n' + stats)] }));
                await openLobby(session);
            }
        });
        await channel.send(silent({ embeds: [embed('☀️ Dimanche RegaDex · Le salon choisit', 0xf1c40f)
            .setDescription('Vote public ouvert pendant **1 minute maximum**. Le vote est dans le message précédent. Après chaque partie, un nouveau vote déterminera la suite jusqu’à 18 h.')
            .setFooter({ text: 'Égalité : tirage au sort • Cacabot ne vote pas' })] }));
        return;
    }
    await openLobby(session);
}
async function tickPlaySchedule(client) {
    if (!playReady) return;
    const parts = localParisParts(), dateKey = localDateKey(parts), hour = Number(parts.hour);
    ensureScheduleWeek(dateKey);
    if (hour < 17) return;
    const dow = new Date(dateKey + 'T00:00:00Z').getUTCDay();
    const active = sessions.get(PLAY_CHANNEL_ID);
    if (active && active.phase !== 'closed') return;
    if (dow === 0) {
        if (hour >= SUNDAY_CUTOFF_HOUR || scheduleState.started[dateKey]) return;
        scheduleState.started[dateKey] = true; saveScheduleState();
        return launchScheduledSession(client, { sunday: true, dateKey });
    }
    if (scheduleState.started[dateKey]) return;
    const game = weekdayGame(dateKey);
    if (!game) return;
    scheduleState.started[dateKey] = true;
    scheduleState.daily[dateKey] = { sessions: 1, game };
    saveScheduleState();
    return launchScheduledSession(client, { game, dateKey });
}
async function startPlayScheduler(client) {
    try {
        if (fs.existsSync(STATE_PATH)) {
            const saved = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
            if (saved && typeof saved === 'object' && !Array.isArray(saved))
                scheduleState = { weekKey: saved.weekKey || '', order: saved.order || [], started: saved.started || {}, daily: saved.daily || {} };
        }
        ensureScheduleWeek(localDateKey(localParisParts()));
    } catch (error) {
        console.error('[PLAY] Lecture du calendrier :', error);
        scheduleState = { weekKey: '', order: [], started: {}, daily: {} };
        ensureScheduleWeek(localDateKey(localParisParts()));
    }
    playReady = true;
    if (schedulerTimer) clearInterval(schedulerTimer);
    schedulerTimer = setInterval(() => { void tickPlaySchedule(client).catch(error => console.error('[PLAY] Planification :', error)); }, 10_000);
    schedulerTimer.unref?.();
    await tickPlaySchedule(client);
}

function enqueue(session, action) {
    const job = session.queue.then(action);
    session.queue = job.catch(() => {});
    return job;
}

function phaseTimer(session, ms, action) {
    clearTimeout(session.timer);
    clearTimeout(session.botTimer);
    const revision = session.timerRevision = (session.timerRevision || 0) + 1;
    session.deadline = Date.now() + ms;
    session.timer = setTimeout(() => {
        void enqueue(session, async () => {
            if (sessions.get(session.channel.id) === session && session.timerRevision === revision && session.phase !== 'closed') {
                await action();
            }
        }).catch(error => recoverSession(session, error));
    }, ms);
    session.timer.unref();
    session.advancePhase = action;
    if (session.test) scheduleTestBots(session, revision, ms);
}

function shuffled(values) {
    const copy = [...values];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function chooseGameMenu(menu, guide) {
    if (guide) {
        const current = GUIDES[guide];
        const minP = MIN_PLAYERS[guide];
        const meta = current ? GAME_META[guide].replace(/\s*•\s*\d+\s*joueurs?\+?/i, '') : '';
        const main = embed(current ? current[2] + ' Guide — ' + current[0] : '📘 Guide des mini-jeux RegaDex', gameColor(guide) || 0x3498db)
            .setAuthor({ name: menu.test ? 'RegaDex Arcade • Guide (Mode test)' : 'RegaDex Arcade • Règles & Astuces' })
            .setDescription(
                current
                    ? '### 📜 Principe\n' + current[1] + '\n\n### 📘 Déroulement\n' + current[3] + '\n\n' +
                      '👥 **Joueurs minimum :** `' + minP + '`\n' +
                      '⏱️ **Format :** ' + meta
                    : 'Sélectionne un mini-jeu dans le menu déroulant ci-dessous pour afficher ses règles complètes.'
            )
            .setFooter({ text: 'RegaDex Arcade • Choisis un autre jeu ou reviens au menu principal' });
        const select = new StringSelectMenuBuilder()
            .setCustomId(idFor('guidegame', menu.id))
            .setPlaceholder('Quel guide veux-tu lire ?')
            .addOptions(Object.entries(GUIDES).map(([value, [label, , emoji]]) => ({ label, value, emoji, default: value === guide })));
        return { embeds: [main], components: [row(select), row(button(idFor('menu', menu.id), 'Retour au menu', ButtonStyle.Secondary, '⬅️'))] };
    }

    const intro = menu.test
        ? 'Choisis un mini-jeu, puis ajoute **1 à 3 adversaires simulés**.\nLes cartes et décisions des bots sont tirées au hasard.'
        : 'Sélectionne un mini-jeu à tester dans ce salon. La partie sera simulée avec des bots et des résultats aléatoires.';

    const gameList = Object.entries(GUIDES).map(([key, [name, value, icon]]) => {
        const min = MIN_PLAYERS[key];
        const playersTag = min > 1 ? min + '+ joueurs' : '1+ joueur';
        const meta = GAME_META[key].replace(/\s*•\s*\d+\s*joueurs?\+?/i, '');
        return icon + ' **' + name + '**  •  `' + playersTag + '`  •  *' + meta + '*\n> ' + value;
    }).join('\n\n');

    const main = embed(menu.test ? '🧪 Mini-jeux RegaDex Arcade • Mode test' : '🎮 Mini-jeux RegaDex Arcade', 0xf1c40f)
        .setAuthor({ name: menu.test ? 'RegaDex Arcade • Environnement de test' : 'RegaDex Arcade • Salon de jeu' })
        .setDescription(intro + '\n\n' + SEP + '\n\n' + gameList)
        .setFooter({ text: 'Cartes classiques uniquement (hors Holo, Full Art & Négatives) • !stop possible en partie' });

    const select = new StringSelectMenuBuilder()
        .setCustomId(idFor('game', menu.id))
        .setPlaceholder('🎲 Choisir un mini-jeu à lancer...')
        .addOptions(Object.entries(GUIDES).map(([value, [label, description, emoji]]) => ({
            label,
            value,
            description: cut('Min. ' + MIN_PLAYERS[value] + ' • ' + description, 100),
            emoji
        })));

    return { embeds: [main], components: [row(select), row(
        button(idFor('guide', menu.id), 'Guide des jeux', ButtonStyle.Secondary, '📘'),
        ...(menu.test ? [button(idFor('sundaytest', menu.id), 'Tester le dimanche', ButtonStyle.Primary, '☀️')] : [])
    )] };
}

function launchMenu(menu) {
    const [name, description, icon, rules] = GUIDES[menu.game];
    const min = MIN_PLAYERS[menu.game];
    const meta = GAME_META[menu.game].replace(/\s*•\s*\d+\s*joueurs?\+?/i, '');
    if (menu.test) {
        const botsCount = Math.min(TEST_NAMES.length, Math.max(1, Number(menu.botCount) || 2));
        const hasRounds = menu.game === 'vitrine' || menu.game === 'cavale';
        const totalRounds = hasRounds ? ROUND_COUNT : 1;
        const startRound = hasRounds ? Math.min(totalRounds, Math.max(1, Number(menu.startRound) || 1)) : 1;
        const botList = TEST_NAMES.slice(0, botsCount).map(n => n + ' [bot]').join(', ');
        const preview = embed('🧪 ' + icon + ' ' + name + ' • Mode test', gameColor(menu.game))
            .setAuthor({ name: 'RegaDex Arcade • Configuration !playx' })
            .setDescription(
                '### 📜 Principe\n' + description + '\n\n' +
                SEP + '\n\n' +
                '🤖 **Bots choisis :** `' + botsCount + '` *(' + escapeText(botList) + ')*\n' +
                '🎯 **Manche choisie :** `' + startRound + '/' + totalRounds + '`' + (hasRounds ? '' : ' *(partie en 1 manche)*') + '\n' +
                '⏱️ **Format :** ' + meta + '\n\n' +
                '> Ajuste tes options ci-dessous puis clique sur **🚀 Lancer le test**.'
            )
            .setFooter({ text: 'Dans le salon : !playx next avance le chrono, !playx stop ferme le test' });
        const rows = [
            row(new StringSelectMenuBuilder().setCustomId(idFor('bots', menu.id)).setPlaceholder('🤖 Nombre de bots')
                .addOptions(TEST_NAMES.map((_, i) => ({
                    label: String(i + 1) + ' bot' + (i > 0 ? 's' : ''),
                    description: TEST_NAMES.slice(0, i + 1).join(', '),
                    value: String(i + 1),
                    emoji: '🤖',
                    default: i + 1 === botsCount
                }))))
        ];
        if (hasRounds) {
            rows.push(row(new StringSelectMenuBuilder().setCustomId(idFor('startround', menu.id)).setPlaceholder('🎯 Manche de départ')
                .addOptions(Array.from({ length: totalRounds }, (_, i) => ({
                    label: 'Manche ' + (i + 1) + '/' + totalRounds,
                    description: i === totalRounds - 1 ? 'Tester directement la manche finale / podium' : 'Démarrer à la manche ' + (i + 1),
                    value: String(i + 1),
                    emoji: '🎯',
                    default: i + 1 === startRound
                })))));
        }
        rows.push(row(
            button(idFor('starttest', menu.id), 'Lancer le test', ButtonStyle.Success, '🚀'),
            button(idFor('menu', menu.id), 'Retour', ButtonStyle.Secondary, '⬅️')
        ));
        return { embeds: [preview], components: rows };
    }

    const preview = embed(icon + ' ' + name, gameColor(menu.game))
        .setAuthor({ name: 'RegaDex Arcade • Configuration de partie' })
        .setDescription(
            '### 📜 Principe\n' + description + '\n\n' +
            '### 📘 Règles rapides\n' + rules + '\n\n' +
            SEP + '\n\n' +
            '🌐 **Partie ouverte** — Tout le salon peut rejoindre librement.\n' +
            '🎟️ **Sur invitation** — Seuls les membres choisis peuvent s’inscrire.\n\n' +
            '👥 **Minimum :** `' + min + '` joueur(s)  •  ⏱️ **Format :** ' + meta
        )
        .setFooter({ text: 'Le jeu se déroule publiquement dans ce salon • !stop permet de demander l’arrêt' });
    return {
        embeds: [preview],
        components: [row(
            button(idFor('open', menu.id), 'Lancer (Ouvert)', ButtonStyle.Success, '🚀'),
            button(idFor('invite', menu.id), 'Sur invitation', ButtonStyle.Primary, '🎟️'),
            button(idFor('menu', menu.id), 'Retour', ButtonStyle.Secondary, '⬅️')
        )]
    };
}

async function handlePlayMessage(message) {
    if (message.author.bot) return false;
    const trimmed = message.content.trim();
    const active = sessions.get(message.channelId);
    if (active && active.phase !== 'closed' && /^!stop$/i.test(trimmed)) {
        return enqueue(active, () => triggerStopVote(active, message)).catch(async error => { await recoverSession(active, error); return true; });
    }
    if (active?.game === 'cavale' && !active.stopVoteActive && active.phase === 'game' && active.state?.step === 'guess' &&
        active.players.has(message.author.id) && !trimmed.startsWith('!')) {
        return enqueue(active, () => cavaleGuess(active, message)).catch(async error => { await recoverSession(active, error); return true; });
    }

    const testMatch = trimmed.match(/^!playx(?:\s+(next|stop))?$/i);
    if (testMatch) {
        if (message.channelId !== PLAY_TEST_CHANNEL_ID || message.author.id !== PLAY_TEST_OWNER_ID) return false;
        const action = testMatch[1]?.toLowerCase();
        const testSession = sessions.get(message.channelId);
        if (action === 'next') {
            if (!testSession || testSession.phase === 'closed' || !testSession.advancePhase) {
                await message.reply(silent({ content: 'Aucun chrono de test actif. Lance !playx pour préparer un test.' }));
                return true;
            }
            const advance = testSession.advancePhase;
            clearTimeout(testSession.timer); clearTimeout(testSession.botTimer); testSession.timerRevision++;
            await message.reply(silent({ content: '⏩ Chrono avancé. La prochaine étape du test démarre.' }));
            await enqueue(testSession, advance);
            return true;
        }
        if (action === 'stop') {
            if (!testSession || testSession.phase === 'closed') {
                await message.reply(silent({ content: 'Aucun test actif à arrêter.' }));
                return true;
            }
            await closeSession(testSession, 'Test arrêté par Epsys.');
            await message.reply(silent({ content: '🛑 Test fermé.' }));
            return true;
        }
        if (!playReady) {
            await message.reply(silent({ content: '⏳ Le module RegaDex Arcade se charge encore. Réessaie dans quelques secondes.' }));
            return true;
        }
        if (testSession && testSession.phase !== 'closed') {
            await message.reply(silent({ content: 'Un test est déjà actif dans ce salon. Utilise !playx next pour avancer ou !playx stop pour l’arrêter.' }));
            return true;
        }
        const menu = { id: message.id, owner: message.author.id, channelId: message.channelId, test: true, launching: false, expires: Date.now() + IDLE_MS };
        const reply = await message.reply(silent(chooseGameMenu(menu)));
        menu.messageId = reply.id; menus.set(menu.id, menu);
        setTimeout(() => menus.delete(menu.id), IDLE_MS).unref();
        return true;
    }

    const force = trimmed.match(/^!tcgforce\s+(\S+)$/i);
    if (force) {
        if (message.author.id !== PLAY_TEST_OWNER_ID || message.channelId !== PLAY_CHANNEL_ID) return false;
        if (active && active.phase !== 'closed') {
            await message.reply(silent({ content: 'Une session est déjà en cours dans le salon des mini-jeux. Termine-la avant de forcer un autre jeu.' }));
            return true;
        }
        const aliases = { debat: 'casting', blanc: 'vitrine', zoom: 'cavale', devine: 'devine', classement: 'classement', fmk: 'fmk' };
        const game = aliases[force[1].toLowerCase()];
        if (!game) {
            await message.reply(silent({ content: 'Jeu inconnu. Choix : debat, blanc, zoom, devine, classement ou fmk.' }));
            return true;
        }
        const session = await makeSession(message.channel, { host: message.author.id, game });
        await openLobby(session);
        await message.reply(silent({ content: '🧪 Session publique forcée : **' + GUIDES[game][0] + '**. Inscription ouverte pendant 30 secondes.' }));
        return true;
    }

    if (!/^!play$/i.test(trimmed)) return false;
    if (!message.guild || message.guild.id !== REGAIA_GUILD_ID) return false;
    if (!playReady) {
        await message.reply(silent({ content: '⏳ Le calendrier des mini-jeux se charge encore. Réessaie dans quelques secondes.' }));
        return true;
    }
    const reply = await message.reply({ embeds: [playInfoEmbed(sessions.get(PLAY_CHANNEL_ID))], allowedMentions: { parse: [] } });
    return Boolean(reply);
}

function readPlayer(interaction) {
    return {
        id: interaction.user.id,
        name: interaction.member?.displayName || interaction.user.globalName || interaction.user.username,
        avatar: interaction.user.displayAvatarURL({ extension: 'png', size: 128 })
    };
}

async function startTestSundayVote(session) {
    const voters = new Set(session.players.keys());
    await session.channel.send(silent({ embeds: [embed('☀️ Simulation du dimanche', 0xf1c40f)
        .setDescription('Les bots vont voter au hasard. Vote avec eux pour choisir le premier jeu, puis teste les scrutins après les parties. Les chronos restent accélérables avec !playx next.')]}));
    await openBallot(session, {
        title: '🗳️ Vote test · Choisissez le mini-jeu',
        description: 'Vote aléatoire des bots activé. Le vote se ferme dès que tous les bots et Epsys ont répondu ou après une minute.',
        voters, options: Object.entries(GUIDES).map(([value, [label, , emoji]]) => ({ value, label, emoji })), ms: 60_000,
        choose: async (leaders, votes) => {
            if (!leaders.length) return closeSession(session, 'Aucun choix enregistré. Simulation du dimanche terminée.');
            session.game = leaders[randomInt(leaders.length)];
            const counts = new Map();
            for (const value of votes.values()) counts.set(value, (counts.get(value) || 0) + 1);
            const stats = Object.entries(GUIDES).map(([id, [name, , icon]]) =>
                icon + ' **' + name + '** — ' + (counts.get(id) || 0) + ' vote(s)').join('\n');
            await session.channel.send(silent({ embeds: [embed('📊 Résultat simulé', gameColor(session.game))
                .setDescription('Premier jeu : **' + GUIDES[session.game][0] + '**.\n\n' + stats)] }));
            await openLobby(session);
        }
    });
}

async function createSession(interaction, menu, invited = null, botCount = 0, startRound = 1, sunday = false) {
    menu.launching = true;
    try {
        await interaction.deferUpdate();
        const channel = interaction.channel;
        if (!channel?.isTextBased()) throw new Error('Salon de jeu inaccessible.');
        const existing = sessions.get(channel.id);
        if (existing && existing.phase !== 'closed') {
            await interaction.editReply({ embeds: [embed('Une session est déjà active', 0xe67e22)
                .setDescription('Le salon de test ne peut héberger qu’une session à la fois. Utilise !playx next ou !playx stop.')], components: [] });
            return;
        }
        const session = await makeSession(channel, {
            host: menu.owner, game: menu.game, invited, test: menu.test, botCount, startRound
        });
        if (sunday && menu.test) {
            session.sunday = true;
            await startTestSundayVote(session);
        } else await openLobby(session);
        menus.delete(menu.id);
        const [name, summary, icon] = GUIDES[session.game];
        await interaction.editReply({
            embeds: [embed(icon + ' ' + name + ' • Session publique', gameColor(session.game))
                .setAuthor({ name: 'RegaDex Arcade' })
                .setDescription(summary + '\n' + SEP + '\n' +
                    (session.test
                        ? '🧪 Test lancé dans ce salon avec **' + session.bots.size + ' bot(s)**, au départ de la manche **' + session.startRound + '/' + ((session.game === 'vitrine' || session.game === 'cavale') ? ROUND_COUNT : 1) + '**.\n**!playx next** avance le chrono ; **!playx stop** ferme le test.'
                        : '🎮 Le jeu se déroule directement dans ce salon. L’inscription est ouverte pendant 30 secondes, puis les inscrit·es reçoivent 15 secondes avant le début.')
                )],
            components: []
        });
    } finally {
        menu.launching = false;
    }
}

async function editPlayMessage(session, message, payload) {
    if (!message) return null;
    try {
        const editPayload = { ...payload };
        delete editPayload.flags;
        return await session.channel.messages.edit(message.id, editPayload);
    } catch (error) {
        if (error?.code === 10008) {
            const hasContent = Boolean(payload?.embeds?.length || payload?.content);
            if (!hasContent) return null;
            const resend = { ...payload };
            delete resend.attachments;
            return session.channel.send(resend).catch(() => null);
        }
        if (IGNORABLE_DISCORD_CODES.has(error?.code)) {
            if (error.code === 10003) {
                session.phase = 'closed';
                clearTimeout(session.timer);
                clearTimeout(session.botTimer);
            }
            return null;
        }
        throw error;
    }
}

function controlId(session, action, ...rest) {
    return idFor(action, session.channel.id, ...rest);
}

function sessionButtons(session, joinLabel = 'Rejoindre') {
    if (session.phase === 'lobby') {
        const minRequired = MIN_PLAYERS[session.game] || 1;
        if (session.scheduled) return [row(
            button(controlId(session, 'join', session.lobbyId), joinLabel, ButtonStyle.Success, '🙋'),
            button(controlId(session, 'quit', session.lobbyId), 'Me retirer', ButtonStyle.Secondary, '🚪')
        )];
        return [
            row(
                button(controlId(session, 'join', session.lobbyId), joinLabel, ButtonStyle.Success, '🙋').setDisabled(session.test),
                button(controlId(session, 'quit', session.lobbyId), 'Quitter', ButtonStyle.Secondary, '🚪').setDisabled(session.test),
                button(controlId(session, 'startnow', session.lobbyId), 'Démarrer', ButtonStyle.Primary, '▶️').setDisabled(session.players.size < minRequired)
            ),
            row(
                button(controlId(session, 'late', session.lobbyId), 'Arrivées : ' + (session.allowLate ? 'ON' : 'OFF'), ButtonStyle.Secondary, '🔓').setDisabled(session.test),
                button(controlId(session, 'settings', session.lobbyId), 'Paramètres', ButtonStyle.Secondary, '⚙️'),
                button(controlId(session, 'cancel', session.lobbyId), 'Annuler', ButtonStyle.Danger, '✖️')
            )
        ];
    }
    if (session.scheduled) return [];
    return [row(
        button(controlId(session, 'join', session.lobbyId), joinLabel, ButtonStyle.Primary, '🙋').setDisabled(session.test || !session.allowLate),
        button(controlId(session, 'quit', session.lobbyId), 'Quitter', ButtonStyle.Secondary, '🚪').setDisabled(session.test),
        button(controlId(session, 'settings', session.lobbyId), 'Paramètres', ButtonStyle.Secondary, '⚙️'),
        button(controlId(session, 'cancel', session.lobbyId), 'Annuler', ButtonStyle.Danger, '✖️')
    )];
}

function lobbyPayload(session) {
    const [name, desc, icon, guide] = GUIDES[session.game];
    const minP = MIN_PLAYERS[session.game];
    const totalRounds = (session.game === 'vitrine' || session.game === 'cavale') ? ROUND_COUNT : 1;
    const chosenRound = Math.min(totalRounds, Math.max(1, session.startRound || 1));
    const hostPlayer = session.people.get(session.host);
    const list = [...session.players.values()].map(player => '• **' + escapeText(player.name) + '**' + (player.id === session.host ? ' 👑' : '')).join('\n') || '*Aucun·e inscrit·e*';
    const timing = session.scheduled
        ? '⏱️ **Inscriptions :** 30 secondes, puis 15 secondes de préparation avant le lancement automatique.'
        : '⏱️ **Lancement automatique :** ' + expiry(session.deadline) + (session.test ? '' : ' *(ou dès que l’hôte clique sur **▶️ Démarrer**)*');
    const page = embed(icon + ' ' + name + ' • Inscriptions', gameColor(session.game))
        .setAuthor({
            name: session.scheduled ? 'RegaDex Arcade • Session publique quotidienne' :
                (session.test ? 'RegaDex Arcade • Test de ' : 'RegaDex Arcade • Salon de ') + (hostPlayer?.name || 'l’hôte'),
            iconURL: hostPlayer?.avatar || undefined
        })
        .setDescription(desc + '\n' + SEP + '\n' +
            (session.test ? '🤖 **Bots :** `' + session.bots.size + '` • 🎯 **Manche choisie :** `' + chosenRound + '/' + totalRounds + '`\n' : '') + timing)
        .addFields(
            { name: '👥 Participant·es (' + session.players.size + ')', value: cut(list, 1024), inline: true },
            {
                name: '⚙️ Paramètres',
                value:
                    '• **Accès :** ' + (session.test ? '🧪 Mode test (' + session.bots.size + ' bots • Manche ' + chosenRound + '/' + totalRounds + ')' : session.invited ? '🎟️ Sur invitation' : '🌐 Ouvert') + '\n' +
                    '• **Minimum :** `' + minP + '` joueur(s)\n' +
                    '• **Arrivées en cours :** ' + (session.allowLate ? '✅ Ouvertes' : '🔒 Fermées'),
                inline: true
            },
            { name: '📘 Comment jouer', value: cut(guide, 1024), inline: false }
        )
        .setFooter({ text: 'RegaDex Arcade • Inscriptions 30 s • Préparation 15 s' });
    return silent({ embeds: [page], components: sessionButtons(session) });
}

async function openLobby(session) {
    if (session.lobby) await editPlayMessage(session, session.lobby, { components: [] });
    if (session.lobbyId) session.startRound = 1;
    session.roundStarted = false;
    for (const [id, player] of session.pending) session.players.set(id, player);
    session.pending.clear();
    session.phase = 'lobby';
    session.board = null; session.state = null; session.ballot = null;
    session.lobbyId = (session.lobbyId || 0) + 1; session.round = 0;
    session.scores = new Map(); session.loveUsed = new Set(); session.best = [];
    session.prompts = shuffled(PROMPTS); session.usedPrompts = new Set();
    session.deadline = Date.now() + (session.test ? 1_000 : JOIN_MS);
    if (session.scheduled && session.sunday && !session.test) {
        const day = session.scheduleDate || localDateKey(localParisParts());
        const daily = scheduleState.daily[day] || { sessions: 0, game: session.game };
        daily.sessions++; daily.game = session.game; scheduleState.daily[day] = daily; saveScheduleState();
    }
    session.lobby = await session.channel.send(lobbyPayload(session));
    phaseTimer(session, Math.max(1, session.deadline - Date.now()), () => prepareGameStart(session));
}
async function prepareGameStart(session) {
    if (session.phase !== 'lobby') return;
    await editPlayMessage(session, session.lobby, { components: [] });
    if (!session.test) {
        const ids = [...session.players.keys()].filter(id => !session.bots.has(id));
        const mentions = ids.map(id => '<@' + id + '>').join(' ');
        await session.channel.send({
            ...silent({ content: (mentions ? mentions + '\n' : '') + '⏳ **Les inscriptions sont closes.** La partie commence dans 15 secondes. Préparez-vous !' }, ids),
            allowedMentions: { parse: [], users: ids }
        });
        session.deadline = Date.now() + READY_MS;
        phaseTimer(session, READY_MS, () => startSelectedGame(session));
        return;
    }
    await startSelectedGame(session);
}

async function updateLobby(session) {
    if (session.phase === 'lobby') {
        const updated = await editPlayMessage(session, session.lobby, lobbyPayload(session));
        if (updated) session.lobby = updated;
    } else if (session.phase !== 'closed') {
        const [name, , icon, guide] = GUIDES[session.game];
        const page = embed(icon + ' ' + name + ' • Partie en cours', gameColor(session.game))
            .setDescription(
                '**' + session.players.size + '** joueur(s) en lice • ' +
                (session.test ? 'Mode test en cours.' : session.allowLate ? 'Les arrivées rejoignent dès la manche/partie suivante.' : 'Les arrivées en cours sont fermées.')
            )
            .addFields({ name: '📘 Rappel des règles', value: cut(guide, 1024), inline: false });
        const updated = await editPlayMessage(session, session.lobby, {
            embeds: [page],
            components: sessionButtons(session, 'Rejoindre ensuite')
        });
        if (updated) session.lobby = updated;
    }
}

function pickPayload(session) {
    const done = session.answers.size;
    const total = session.roundPlayers.size;
    const statusLines = [...session.roundPlayers].map(uid => {
        const pName = escapeText(session.people.get(uid)?.name || 'Membre');
        return (session.answers.has(uid) ? '✅ ' : '⏳ ') + pName;
    }).join('  •  ');

    const botAvatar = session.channel.client.user?.displayAvatarURL?.({ extension: 'png', size: 64 });
    const page = embed('🎭 Manche ' + session.round + '/' + ROUND_COUNT + ' · À vous de jouer', gameColor('vitrine'))
        .setAuthor({
            name: 'REGADEX ARCADE  •  BLANC MANGER CACA',
            iconURL: botAvatar || undefined
        })
        .setDescription(
            '## ✍️ La phrase à compléter\n' +
            '> **' + session.prompt + '**\n\n' +
            'Choisis tes cartes dans le classeur : **' + session.holes + '** carte' + (session.holes > 1 ? 's' : '') +
            ' à placer pour composer ta réponse.\n' +
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
            '📥 **Réponses reçues**\n' + progressBar(done, total, 14) + '  **' + done + '/' + total + '**' +
            '   ·   ⏳ **' + expiry(session.deadline) + '**'
        )
        .addFields({
            name: '👥 Joueurs de cette manche',
            value: cut(statusLines || '*Personne*', 900),
            inline: false
        })
        .setFooter({
            text: 'Réponse anonyme jusqu’au vote  •  Tes boutons apparaissent en privé  •  Manche ' +
                session.round + ' sur ' + ROUND_COUNT
        });

    return silent({
        embeds: [page],
        components: [row(
            button(controlId(session, 'pick', session.lobbyId, session.round), 'Choisir ma réponse', ButtonStyle.Primary, '🃏')
        )]
    });
}

async function startRound(session) {
    for (const [id, player] of session.pending) session.players.set(id, player);
    session.pending.clear();
    const starting = !session.roundStarted;
    session.roundStarted = true;
    session.round = session.round === 0 ? (session.startRound || 1) : session.round + 1;
    const cardCounts = new Map([...session.players.keys()].map(id => [id, playCardsFor(session, id).length]));
    const canPlayTwo = [...cardCounts.values()].filter(count => count >= 2).length >= 2;
    session.prompt = session.prompts.find(prompt => !session.usedPrompts.has(prompt) &&
        (canPlayTwo || prompt.split(PROMPT_BLANK).length === 2));
    session.usedPrompts.add(session.prompt);
    session.holes = session.prompt.split(PROMPT_BLANK).length - 1;
    session.roundPlayers = new Set([...cardCounts].filter(([, count]) => count >= session.holes).map(([id]) => id));
    if (session.roundPlayers.size < 2) {
        await closeSession(session, 'Il faut au moins deux joueurs avec assez de cartes éligibles pour cette manche.');
        return;
    }
    session.phase = 'pick';
    session.answers = new Map();
    session.drafts = new Map();
    session.deadline = Date.now() + PICK_MS;
    if (starting && session.lobby) await editPlayMessage(session, session.lobby, { components: [] });
    session.board = await session.channel.send(pickPayload(session));
    phaseTimer(session, Math.max(1, session.deadline - Date.now()), () => startRatings(session));
}

function searchModal(session, player, draft) {
    const query = new TextInputBuilder()
        .setCustomId('query')
        .setLabel('Nom, numéro ou mot-clé de la carte')
        .setPlaceholder('Ex : Caca, 042, Set 1...')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(100);
    if (draft.query) query.setValue(cut(draft.query, 100));
    return new ModalBuilder()
        .setCustomId(controlId(session, 'search', session.lobbyId, session.round, player))
        .setTitle('Chercher une carte')
        .addComponents(row(query));
}

function cardSearchRank(card, rawQuery) {
    const qNorm = normalize(rawQuery);
    const qKey = answerKey(rawQuery);
    const qNoArt = stripFrenchArticle(qKey);
    const qCompact = qKey.replace(/\s+/g, '');
    const qNum = qKey.replace(/^0+(?=\d)/, '');
    if (!qKey && !qNorm) return 0;

    const names = [...new Set([
        answerKey(card.name),
        answerKey(card.baseName),
        stripFrenchArticle(answerKey(card.name)),
        stripFrenchArticle(answerKey(card.baseName))
    ].filter(Boolean))];
    const codeKey = answerKey(card.numCode);
    const codeNoZero = codeKey.replace(/^0+(?=\d)/, '');
    const idNorm = normalize(card.id);
    const setKey = answerKey(cardSetLabel(card));

    if (names.includes(qKey) || (qNoArt && names.includes(qNoArt)) ||
        (codeKey && (codeKey === qKey || codeNoZero === qNum)) || idNorm === qNorm) return 1;
    if (names.some(n => n.startsWith(qKey) || (qNoArt && n.startsWith(qNoArt)) || n.replace(/\s+/g, '').startsWith(qCompact)) ||
        (codeKey && (codeKey.startsWith(qKey) || codeNoZero.startsWith(qNum)))) return 2;

    const tokens = qKey.split(/\s+/).filter(Boolean);
    const wordList = names.flatMap(n => n.split(/\s+/)).filter(Boolean);
    if (wordList.some(w => w.startsWith(qKey) || (qNoArt && w.startsWith(qNoArt)))) return 3;

    const haystack = [names.join(' '), codeKey, codeNoZero, setKey, answerKey(card.category), answerKey(card.rarity)].filter(Boolean).join(' ');
    if (haystack.includes(qKey) || (qCompact.length >= 2 && haystack.replace(/\s+/g, '').includes(qCompact))) return 4;
    const hayWords = haystack.split(/\s+/).filter(Boolean);
    if (tokens.length > 1 && tokens.every(t => {
        const tNum = t.replace(/^0+(?=\d)/, '');
        return hayWords.some(w => w.startsWith(t) || (tNum && w.replace(/^0+(?=\d)/, '').startsWith(tNum)));
    })) return 5;

    if (qCompact.length >= 3) {
        const threshold = qCompact.length >= 8 ? 2 : 1;
        for (const n of names) {
            if (distance(qKey, n) <= threshold || distance(qCompact, n.replace(/\s+/g, '')) <= threshold) return 6;
            for (const w of n.split(/\s+/)) {
                if (w.length >= 3 && distance(qKey, w) <= 1) return 6;
            }
        }
    }
    return 0;
}

function playingCards(session, player, draft) {
    const rawQuery = String(draft?.query || '').trim();
    const cards = playCardsFor(session, player).filter(card => !draft.cards.includes(card.id));
    if (!rawQuery) return cards;
    return cards
        .map((card, index) => ({ card, index, rank: cardSearchRank(card, rawQuery) }))
        .filter(item => item.rank > 0)
        .sort((a, b) => a.rank - b.rank || a.index - b.index)
        .map(item => item.card);
}

function completePhrase(phrase, cards) {
    let index = 0;
    return phrase.replaceAll(PROMPT_BLANK, () => cards[index++]?.name || PROMPT_BLANK);
}

function formatPhraseMarkdown(phrase, cards) {
    const parts = String(phrase || '').split(PROMPT_BLANK);
    let out = escapeText(parts[0] || '');
    for (let i = 1; i < parts.length; i++) {
        const card = cards?.[i - 1];
        out += (card ? '**' + escapeText(card.name) + '**' : escapeText(PROMPT_BLANK)) + escapeText(parts[i] || '');
    }
    return out;
}

function buildPhraseSegments(phrase, cards) {
    const parts = String(phrase || '').split(PROMPT_BLANK);
    const segments = [];
    for (let i = 0; i < parts.length; i++) {
        const chunk = cleanCanvasRaw(parts[i]);
        if (chunk) segments.push({ text: chunk, bold: false });
        if (i < parts.length - 1) {
            const cardName = cleanCanvasText(cards?.[i]?.name || '') || cleanCanvasText(PROMPT_BLANK);
            segments.push({ text: cardName, bold: true });
        }
    }
    if (segments.length) {
        segments[0].text = segments[0].text.replace(/^\s+/, '');
        segments[segments.length - 1].text = segments[segments.length - 1].text.replace(/\s+$/, '');
    }
    return segments.filter(seg => seg.text.length > 0);
}

function drawCenteredSegments(ctx, segments, centerX, centerY, maxW, baseSize = 26, minSize = 13) {
    let fontSize = baseSize;
    const measureTotal = size => segments.reduce((sum, seg) => {
        ctx.font = (seg.bold ? 'bold ' : '') + size + 'px Sans';
        return sum + ctx.measureText(seg.text).width;
    }, 0);
    let totalW = measureTotal(fontSize);
    while (totalW > maxW && fontSize > minSize) {
        fontSize -= 1;
        totalW = measureTotal(fontSize);
    }
    ctx.save();
    ctx.translate(centerX, centerY);
    if (totalW > maxW) ctx.scale(maxW / totalW, 1);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    let cursorX = -totalW / 2;
    for (const seg of segments) {
        ctx.font = (seg.bold ? 'bold ' : '') + fontSize + 'px Sans';
        ctx.fillText(seg.text, cursorX, 0);
        cursorX += ctx.measureText(seg.text).width;
    }
    ctx.restore();
}

function draftPayload(session, user, draft) {
    const owned = playCardsFor(session, user);
    const cards = draft.cards.map(id => owned.find(c => c.id === id)).filter(Boolean);
    const key = [session.lobbyId, session.round, user];
    const available = playingCards(session, user, draft);
    const pages = Math.max(1, Math.ceil(available.length / 25));
    draft.page = Math.min(Math.max(draft.page, 0), pages - 1);
    const queryText = String(draft.query || '').trim();
    const chosenLine = cards.length ? '\n🃏 **Sélection :** ' + cards.map(c => '**' + escapeText(c.name) + '**').join(' · ') : '';
    const filterLine = queryText ? '\n🔎 **Filtre actif :** `' + escapeText(cut(queryText, 60)) + '` (' + available.length + ' résultat' + (available.length > 1 ? 's' : '') + ')' : '';
    const preview = embed('🃏 Ta réponse • Manche ' + session.round + '/' + ROUND_COUNT, gameColor('vitrine'))
        .setDescription(
            '> **' + escapeText(completePhrase(session.prompt, cards)) + '**\n\n' +
            '📦 **Cartes choisies :** `' + cards.length + '/' + session.holes + '`' +
            chosenLine +
            filterLine +
            (session.answers.has(user) ? '\n✅ *Ta réponse précédente est déjà enregistrée.*' : '')
        )
        .setFooter({ text: 'Page ' + (draft.page + 1) + '/' + pages + ' • ' + available.length + ' carte' + (available.length > 1 ? 's' : '') + ' disponible' + (available.length > 1 ? 's' : '') });

    const controls = [
        button(controlId(session, 'query', ...key), 'Rechercher', ButtonStyle.Secondary, '🔎'),
        button(controlId(session, 'clearfilter', ...key), 'Effacer filtre', ButtonStyle.Secondary, '✖️').setDisabled(!queryText),
        ...(session.holes > 1 ? [
            button(controlId(session, 'clear', ...key), 'Reset', ButtonStyle.Secondary, '🧹').setDisabled(cards.length === 0),
            button(controlId(session, 'swap', ...key), 'Inverser', ButtonStyle.Secondary, '🔄').setDisabled(cards.length !== 2)
        ] : []),
        button(controlId(session, 'lock', ...key), 'Valider', ButtonStyle.Success, '✅').setDisabled(cards.length !== session.holes)
    ];
    const components = [row(...controls)];
    const canPickFromMenu = cards.length < session.holes || session.holes === 1;
    const navButtons = [];
    if (canPickFromMenu && available.length) {
        const options = available.slice(draft.page * 25, (draft.page + 1) * 25).map(card => {
            const rEmoji = (RARITY_STYLE[card.rarity] || RARITY_STYLE.Commune).emoji;
            return {
                label: cut(card.name, 100),
                value: card.id,
                description: cut(rEmoji + ' ' + card.rarity + ' • N° ' + card.numCode + ' • ' + cardSetLabel(card), 100)
            };
        });
        const placeholder = queryText
            ? 'Choisir parmi les résultats...'
            : (session.holes === 1 && cards.length === 1 ? 'Changer de carte...' : 'Choisir une carte possédée...');
        components.unshift(row(new StringSelectMenuBuilder().setCustomId(controlId(session, 'card', ...key))
            .setPlaceholder(placeholder).addOptions(options)));
        if (pages > 1) {
            navButtons.push(
                button(controlId(session, 'prev', ...key), 'Précédente', ButtonStyle.Secondary, '◀️').setDisabled(draft.page === 0),
                button(controlId(session, 'next', ...key), 'Suivante', ButtonStyle.Secondary, '▶️').setDisabled(draft.page + 1 >= pages)
            );
        }
    } else if (cards.length < session.holes || queryText) {
        preview.setFooter({ text: queryText ? 'Aucune carte trouvée pour ce filtre. Clique sur Effacer filtre.' : 'Aucune carte restante disponible.' });
    }
    navButtons.push(button(controlId(session, 'pbinder', ...key), 'Classeur', ButtonStyle.Secondary, '📖'));
    components.push(row(...navButtons));
    return { embeds: [preview], components };
}

async function applySlowmode() {}
async function restoreSlowmode() {}

async function startRatings(session) {
    clearTimeout(session.timer);
    clearTimeout(session.botTimer);
    session.phase = 'reveal';
    session.entries = shuffled([...session.answers.values()]);
    if (session.entries.length < 2) {
        const updated = await editPlayMessage(session, session.board, {
            embeds: [embed('🎭 Manche ' + session.round + ' • Vote annulé', gameColor('vitrine')).setDescription('Il faut au moins deux réponses valides pour ouvrir le vote.')],
            components: []
        });
        if (updated) session.board = updated;
        await finishRound(session);
        return;
    }
    session.voteIndex = 0;
    await showRating(session);
}

async function showRating(session) {
    const entry = session.entries[session.voteIndex];
    if (!entry) { await finishRound(session); return; }
    session.phase = 'reveal';
    if (session.board) await editPlayMessage(session, session.board, { components: [] });
    const cardImage = await drawVoteCards(entry.cards).catch(error => {
        console.warn('[PLAY] Aperçu des cartes :', error);
        return null;
    });
    session.deadline = Date.now() + RATE_MS;
    const page = embed('🎭 Manche ' + session.round + '/' + ROUND_COUNT + ' • Réponse ' +
        (session.voteIndex + 1) + '/' + session.entries.length, gameColor('vitrine'))
        .setAuthor({ name: 'RegaDex Arcade • Vote anonyme' })
        .setDescription('> ' + formatPhraseMarkdown(session.prompt, entry.cards) + '\n\n⏳ Clôture ' + expiry(session.deadline) + ' *— sans note, elle vaut Meh (0).*')
        .setFooter({ text: '❤️ J’adore ! est utilisable une fois par session • Tu ne notes que les réponses des autres' });
    if (cardImage) page.setImage('attachment://reponse.png');
    session.board = await session.channel.send(silent({
        embeds: [page],
        files: cardImage ? [new AttachmentBuilder(cardImage, { name: 'reponse.png' })] : [],
        components: [row(...RATINGS.map(([key, label, points, style, emoji]) => button(
            controlId(session, 'rate', session.lobbyId, session.round, session.voteIndex, key),
            label + ' (' + (points > 0 ? '+' : '') + points + ')', style, emoji
        )))]
    }));
    session.phase = 'rating';
    phaseTimer(session, RATE_MS, async () => {
        for (const points of entry.votes.values()) entry.score += points;
        session.scores.set(entry.user, (session.scores.get(entry.user) ?? 0) + entry.score);
        session.voteIndex++;
        await showRating(session);
    });
}

function ranked(entries) {
    const sorted = [...entries].sort((a, b) => b.score - a.score);
    let lastRank = 0;
    return sorted.map((entry, index) => {
        if (!index || sorted[index - 1].score !== entry.score) lastRank = index + 1;
        return { ...entry, rank: lastRank };
    });
}

async function finishRound(session) {
    session.phase = 'reveal';
    await restoreSlowmode(session);
    if (session.board) await editPlayMessage(session, session.board, { components: [] });

    const top = ranked(session.entries.length >= 2 ? session.entries : []).filter(entry => entry.rank <= 3);
    for (const entry of top.filter(item => item.rank === 1)) {
        if (!session.best.length || entry.score > session.best[0].score) session.best = [];
        if (!session.best.length || entry.score === session.best[0].score) session.best.push({ ...entry, prompt: session.prompt });
    }
    const isFinalRound = session.round >= ROUND_COUNT;
    const footer = top.length
        ? (isFinalRound
            ? 'Podium final dans 10 secondes !'
            : 'Début de la manche ' + (session.round + 1) + '/' + ROUND_COUNT + ' dans 10 secondes !')
        : undefined;
    for (let i = 0; i < top.length; i += 3) {
        await sendResult(session, 'Manche ' + session.round + ' • Résultats', top.slice(i, i + 3), {
            prompt: session.prompt,
            cards: true,
            footer: i + 3 >= top.length ? footer : undefined
        });
    }

    if (top.length) {
        session.phase = 'intermission';
        phaseTimer(session, 10_000, () => (isFinalRound ? showPodium(session) : startRound(session)));
        return;
    }
    if (isFinalRound) await showPodium(session);
    else await startRound(session);
}

function bestResponseDescription(best) {
    if (!best.length) return '';
    const label = best.length === 1 ? '⭐ Meilleure réponse de la session' : '⭐ Meilleures réponses ex æquo';
    const lines = best.map(entry => '• ' + formatPhraseMarkdown(entry.prompt, entry.cards) + ' — **' + entry.score + ' pts**');
    let description = '**' + label + '**\n';
    for (const line of lines) {
        if (description.length + line.length > 3800) break;
        description += line + '\n';
    }
    return description;
}

async function showPodium(session) {
    session.phase = 'continue';
    const entries = [];
    for (const player of session.players.values()) entries.push({ user: player.id, score: session.scores.get(player.id) ?? 0 });
    const standings = ranked(entries);
    const top = standings.filter(entry => entry.rank <= 3);
    session.results.set(session.lobbyId, { entries: [...top.slice(3), ...standings.filter(entry => entry.rank > 3)], best: session.best });
    const best = bestResponseDescription(session.best);
    await rewardMinigameWinners(session, standings.filter(entry => entry.rank === 1).map(entry => entry.user));
    await sendResult(session, 'Blanc Manger Caca • Podium final', top.slice(0, 3), {
        podium: true, description: best, best: session.best,
        components: [row(button(controlId(session, 'standing', session.lobbyId, 0), 'Voir le classement', ButtonStyle.Secondary, '📊'))]
    });
    session.continuing = new Set();
    session.leaving = new Set();
    session.deadline = Date.now() + CONTINUE_MS;
    if (session.sunday) return nextGamePoll(session, await sessionVoters(session));
    session.continueMessage = await session.channel.send(continuePayload(session));
    phaseTimer(session, Math.max(1, session.deadline - Date.now()), () => finishContinue(session));
}

function continuePayload(session) {
    const mentionList = set => [...set].map(id => '• ' + playerRef(session, id)).join('\n') || '*En attente*';
    const sunday = session.sunday;
    const title = sunday ? '🗳️ Continuer avec un autre mini-jeu ?' : '🔁 Rejouer une session ?';
    const desc = sunday
        ? 'Indique si tu restes pour la suite. Les personnes qui restent participeront au vote du prochain jeu. Clôture ' + expiry(session.deadline)
        : 'Indique si tu veux rejouer ' + (session.test ? 'ou arrêter le test' : '**' + (GUIDES[session.game]?.[0] || 'ce jeu') + '**') +
          '. Les personnes qui quittent ne sont plus comptées. Clôture ' + expiry(session.deadline);
    const page = embed(title, 0x3498db)
        .setDescription(desc)
        .addFields(
            { name: '✅ Restent (' + session.continuing.size + ')', value: cut(mentionList(session.continuing), 1024), inline: true },
            { name: '👋 Quittent (' + session.leaving.size + ')', value: cut(mentionList(session.leaving), 1024), inline: true }
        );
    return silent({ embeds: [page], components: [row(
        button(controlId(session, 'yes', session.lobbyId), sunday ? 'Oui, voter pour la suite' : 'Oui, on rejoue', ButtonStyle.Success, '✅'),
        button(controlId(session, 'leave', session.lobbyId), 'Non, je quitte', ButtonStyle.Secondary, '👋')
    )] });
}

async function finishContinue(session) {
    clearTimeout(session.timer); clearTimeout(session.botTimer);
    if (session.continueMessage) await editPlayMessage(session, session.continueMessage, { components: [] });
    for (const user of [...session.players.keys()]) {
        if (!session.continuing.has(user) && !(session.test && session.bots.has(user))) session.players.delete(user);
    }
    for (const user of session.leaving || []) session.optedOut.add(user);
    if (!session.players.size || (session.test && !session.continuing.has(PLAY_TEST_OWNER_ID))) {
        await closeSession(session, 'La session est terminée. Merci d’avoir joué !');
        return;
    }
    if (session.test || session.sunday) {
        if (session.sunday && Number(localParisParts().hour) >= SUNDAY_CUTOFF_HOUR) {
            return closeSession(session, 'Le rendez-vous du dimanche se termine à 18 h.');
        }
        return nextGamePoll(session, await sessionVoters(session));
    }
    const day = session.scheduleDate || localDateKey(localParisParts());
    const daily = scheduleState.daily[day] || { sessions: 1, game: session.game };
    if (daily.sessions >= WEEKDAY_SESSION_LIMIT) {
        return closeSession(session, 'Vous avez atteint les trois sessions du jour.');
    }
    daily.sessions++;
    daily.game = session.game;
    scheduleState.daily[day] = daily;
    saveScheduleState();
    await session.channel.send(silent({ embeds: [embed('🔁 Même mini-jeu, nouvelle session', gameColor(session.game))
        .setDescription('Vous avez choisi de continuer. **' + GUIDES[session.game][0] + '** recommence dans 30 secondes, avec ' +
            (WEEKDAY_SESSION_LIMIT - daily.sessions + 1) + ' session(s) restante(s) aujourd’hui.')
        .setFooter({ text: 'Les inscriptions ferment dans 30 secondes, puis 15 secondes de préparation' })] }));
    await openLobby(session);
}

async function closeSession(session, reason) {
    if (session.phase === 'closed') return;
    session.phase = 'closed'; session.stopVoteActive = false; session.pausedState = null;
    clearTimeout(session.timer); clearTimeout(session.botTimer);
    await restoreSlowmode(session);
    const messages = [session.lobby, session.board, session.state?.statusMessage, session.continueMessage, session.ballot?.message].filter(Boolean);
    await Promise.allSettled(messages.map(message => editPlayMessage(session, message, { components: [] })));
    const page = embed('🏁 Session terminée', 0x95a5a6).setDescription(reason)
        .setFooter({ text: 'Merci d’avoir joué à RegaDex Arcade !' });
    await session.channel.send(silent({ embeds: [page] })).catch(error => console.warn('[PLAY] Clôture :', error));
    if (session.scheduled && !session.test) await announceTomorrow(session.channel);
}

async function recoverSession(session, error) {
    console.error('[PLAY] Déroulement de la partie :', error);
    await enqueue(session, () => closeSession(session, 'La partie a été interrompue par une erreur. Vous pouvez en relancer une avec !play.'));
}

function cardTheme(card) {
    const s = RARITY_STYLE[card?.rarity] || {};
    return {
        hex: s.hex || '#e6d5b8',
        glow: s.glow || 'rgba(230, 213, 184, 0.45)',
        emoji: s.emoji || '🃏'
    };
}

function drawRoundRect(ctx, x, y, w, h, r = 14) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

function drawGlassCard(ctx, x, y, w, h, { radius = 18, fill = 'rgba(17, 14, 29, 0.78)', border = 'rgba(255, 255, 255, 0.14)', lineWidth = 1.5, glow = null, glowBlur = 24 } = {}) {
    ctx.save();
    drawRoundRect(ctx, x, y, w, h, radius);
    if (glow) {
        ctx.save();
        ctx.shadowColor = glow;
        ctx.shadowBlur = glowBlur;
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.restore();
    } else {
        ctx.fillStyle = fill;
        ctx.fill();
    }
    if (border) {
        ctx.strokeStyle = border;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
    }
    ctx.restore();
}

function drawFivePointStar(ctx, cx, cy, outerR, innerR, fillStyle, glow = null) {
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const angle = -Math.PI / 2 + (i * Math.PI) / 5;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    if (glow) {
        ctx.shadowColor = glow;
        ctx.shadowBlur = 14;
    }
    ctx.fillStyle = fillStyle;
    ctx.fill();
    ctx.restore();
}

const playAssetCache = new Map();
const missingAssetLogged = new Set();

function findSubdirCI(parentDir, name) {
    if (!parentDir || !fs.existsSync(parentDir)) return null;
    const direct = path.join(parentDir, name);
    try {
        if (fs.existsSync(direct) && fs.statSync(direct).isDirectory()) return direct;
        const target = name.toLowerCase();
        const hit = fs.readdirSync(parentDir, { withFileTypes: true })
            .find(entry => entry.isDirectory() && entry.name.toLowerCase() === target);
        return hit ? path.join(parentDir, hit.name) : null;
    } catch {
        return null;
    }
}

function findImageInSegments(baseDir, folderSegments, baseNames) {
    let dir = baseDir;
    for (const seg of folderSegments) {
        dir = findSubdirCI(dir, seg);
        if (!dir) return null;
    }
    try {
        const files = fs.readdirSync(dir);
        const exts = ['.jpg', '.jpeg', '.png', '.webp'];
        for (const base of baseNames) {
            for (const ext of exts) {
                const target = (base + ext).toLowerCase();
                const hit = files.find(f => f.toLowerCase() === target);
                if (hit) return path.join(dir, hit);
            }
        }
    } catch {
        return null;
    }
    return null;
}

async function getPlayAssetImage(filePath) {
    if (!filePath) return null;
    if (playAssetCache.has(filePath)) return playAssetCache.get(filePath);
    try {
        if (fs.existsSync(filePath)) {
            const img = await loadImage(filePath);
            playAssetCache.set(filePath, img);
            return img;
        }
    } catch (error) {
        console.warn('[PLAY] Fond indisponible (' + path.basename(filePath) + ') :', error.message);
    }
    return null;
}

async function getVitrineBg(isFinal) {
    const cacheKey = isFinal ? 'vitrine:top' : 'vitrine:classic';
    if (playAssetCache.has(cacheKey)) return playAssetCache.get(cacheKey);
    const roots = [...new Set([process.cwd(), __dirname])];
    const folderCandidates = isFinal
        ? [['Assets', 'Backgrounds'], ['Arcade', 'Backgrounds'], ['Arcade', 'Assets', 'Backgrounds'], ['TCG', 'Assets', 'Backgrounds'], ['Assets'], ['Arcade']]
        : [['Arcade', 'Backgrounds'], ['Arcade', 'Assets', 'Backgrounds'], ['Assets', 'Backgrounds'], ['TCG', 'Assets', 'Backgrounds'], ['Arcade']];
    const nameCandidates = isFinal ? ['Top', 'Final', 'Podium'] : ['Classic', 'Classique'];
    let resolved = null;
    for (const root of roots) {
        for (const segs of folderCandidates) {
            resolved = findImageInSegments(root, segs, nameCandidates);
            if (resolved) break;
        }
        if (resolved) break;
    }
    if (!resolved) {
        if (!missingAssetLogged.has(cacheKey)) {
            missingAssetLogged.add(cacheKey);
            let rootDirs = [];
            try { rootDirs = fs.readdirSync(process.cwd()); } catch {}
            console.warn('[PLAY] Fond vitrine introuvable (' + cacheKey + ') | cwd=' + process.cwd() + ' | contenu=' + rootDirs.join(', '));
        }
        return null;
    }
    const img = await getPlayAssetImage(resolved);
    if (img) playAssetCache.set(cacheKey, img);
    return img;
}

async function getPlayBgCanvas() {
    if (playBgCache) return playBgCache;
    playBgCache = await getPlayAssetImage(TCG_BG_PATH);
    return playBgCache;
}

function exportPng(canvas) {
    try {
        return canvas.toBuffer('image/png');
    } finally {
        canvas.width = canvas.height = 0;
    }
}

function encodeJpeg(canvas, quality = 0.92) {
    try {
        return canvas.toBuffer('image/jpeg', { quality, progressive: false, chromaSubsampling: true });
    } finally {
        canvas.width = canvas.height = 0;
    }
}

async function drawVoteCards(cards, options = {}) {
    const count = Math.max(1, cards.length);
    const cardW = options.cardW || 212;
    const cardH = Math.round(cardW * 1.4);
    const gap = options.gap || 28;
    const padX = 44;
    const numbered = Boolean(options.numbered);
    const headerH = options.header ? (numbered ? 92 : 70) : (numbered ? 46 : 24);
    const width = Math.max(540, padX * 2 + count * cardW + (count - 1) * gap);
    const height = headerH + cardH + 80;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    const bg = await getPlayBgCanvas();

    await stage(ctx, width, height, { bg, accent: options.accent || '#a78bfa' });

    if (options.header) {
        drawGlassCard(ctx, 26, 14, width - 52, 48, { radius: 14, fill: 'rgba(12, 15, 26, 0.86)', border: options.accent || '#a78bfa', lineWidth: 2 });
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff7e9';
        ctx.font = 'bold 21px "LemonMilk", "Sans"';
        ctx.fillText(cleanCanvasText(options.header), width / 2, 38, width - 92);
    }

    const totalCardsW = count * cardW + (count - 1) * gap;
    const startX = Math.round((width - totalCardsW) / 2);
    const startY = headerH + 6;
    const rankColors = ['#FFD700', '#D7DEEB', '#CD7F32', '#1ABC9C'];

    await Promise.all(cards.map(async (card, index) => {
        const x = startX + index * (cardW + gap);
        const theme = cardTheme(card);
        const rankHex = rankColors[index] || '#a78bfa';
        await drawCard(ctx, card, x, startY, cardW, cardH, {
            glow: numbered && index === 0 ? 'rgba(255, 215, 0, 0.65)' : theme.glow,
            border: numbered ? rankHex : theme.hex,
            radius: 12
        });

        if (numbered) {
            const badgeW = 68;
            const badgeH = 30;
            const bx = x + cardW / 2 - badgeW / 2;
            const by = startY - 18;
            drawGlassCard(ctx, bx, by, badgeW, badgeH, {
                radius: 10,
                fill: index === 0 ? 'rgba(42, 32, 8, 0.96)' : 'rgba(13, 16, 28, 0.94)',
                border: rankHex,
                lineWidth: 2.2
            });
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = rankHex;
            ctx.font = 'bold 17px "LemonMilk", "Sans"';
            ctx.fillText('#' + (index + 1), x + cardW / 2, by + badgeH / 2 + 1);
        }

        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 17px "LemonMilk", "Sans"';
        ctx.fillText(cleanCanvasText(card.name), x + cardW / 2, startY + cardH + 10, cardW + 16);

        ctx.fillStyle = theme.hex;
        ctx.font = 'bold 13px "LemonMilk", "Sans"';
        ctx.fillText(cleanCanvasText('N° ' + card.numCode + ' • ' + card.rarity), x + cardW / 2, startY + cardH + 34, cardW + 16);
    }));

    return exportPng(canvas);
}

async function drawCard(ctx, card, x, y, width, height, options = {}) {
    let image;
    try { image = await loadImage(card.filePath); } catch { return; }
    const scale = Math.min(width / image.width, height / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    const dx = x + (width - w) / 2;
    const dy = y + (height - h) / 2;
    const radius = options.radius ?? 10;

    ctx.save();
    if (options.angle) {
        const cx = x + width / 2;
        const cy = y + height / 2;
        ctx.translate(cx, cy);
        ctx.rotate(options.angle);
        ctx.translate(-cx, -cy);
    }

    ctx.save();
    if (options.glow) {
        ctx.shadowColor = options.glow;
        ctx.shadowBlur = 18;
    } else {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
        ctx.shadowBlur = 14;
        ctx.shadowOffsetY = 5;
    }
    drawRoundRect(ctx, dx, dy, w, h, radius);
    ctx.fillStyle = '#120d22';
    ctx.fill();
    ctx.restore();

    ctx.save();
    drawRoundRect(ctx, dx, dy, w, h, radius);
    ctx.clip();
    ctx.drawImage(image, dx, dy, w, h);
    ctx.restore();

    if (options.border) {
        ctx.save();
        drawRoundRect(ctx, dx, dy, w, h, radius);
        ctx.strokeStyle = options.border;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.restore();
    }

    ctx.restore();
}

async function loadAvatar(player) {
    if (!player?.avatar) return null;
    try {
        const response = await fetch(player.avatar, { signal: AbortSignal.timeout(1800) });
        if (!response.ok) return null;
        return await loadImage(Buffer.from(await response.arrayBuffer()));
    } catch { return null; }
}

function drawAvatar(ctx, avatar, player, x, y, radius, ringColor = '#a78bfa') {
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(x, y, radius + 3.5, 0, Math.PI * 2);
    ctx.fillStyle = ringColor;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#533582';
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    if (avatar) {
        ctx.drawImage(avatar, x - radius, y - radius, radius * 2, radius * 2);
    } else {
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold ' + Math.round(radius * 0.9) + 'px "LemonMilk", "Sans"';
        ctx.fillText(cut(cleanCanvasText(player?.name || '?'), 1).toUpperCase() || '?', x, y + 1);
    }
    ctx.restore();
}

async function stage(ctx, width, height, opts = {}) {
    const accent = opts.accent || '#FFD20A';
    if (opts.darkGrayBg) {
        const background = ctx.createLinearGradient(0, 0, 0, height);
        background.addColorStop(0, '#2c2f36');
        background.addColorStop(0.55, '#1e2026');
        background.addColorStop(1, '#121317');
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, width, height);
    } else {
        if (opts.blackBackdrop) {
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, width, height);
        }
        const bg = opts.bg !== undefined ? opts.bg : await getPlayBgCanvas();
        if (bg) {
            const scale = Math.max(width / bg.width, height / bg.height);
            const bw = bg.width * scale;
            const bh = bg.height * scale;
            ctx.save();
            ctx.globalAlpha = opts.bgOpacity ?? 1;
            ctx.drawImage(bg, (width - bw) / 2, (height - bh) / 2, bw, bh);
            ctx.restore();
            if (!opts.plainStage) {
                const veil = ctx.createLinearGradient(0, 0, 0, height);
                veil.addColorStop(0, 'rgba(11, 13, 24, 0.52)');
                veil.addColorStop(0.55, 'rgba(16, 14, 30, 0.44)');
                veil.addColorStop(1, 'rgba(8, 10, 20, 0.72)');
                ctx.fillStyle = veil;
                ctx.fillRect(0, 0, width, height);
            }
        } else if (!opts.blackBackdrop) {
            const background = ctx.createLinearGradient(0, 0, 0, height);
            background.addColorStop(0, '#130e24');
            background.addColorStop(0.65, '#26143d');
            background.addColorStop(1, '#0c0a18');
            ctx.fillStyle = background;
            ctx.fillRect(0, 0, width, height);
        }

        if (!opts.plainStage) {
            for (const center of [width * 0.22, width * 0.78]) {
                const beam = ctx.createRadialGradient(center, 0, 16, center, height * 0.28, height * 0.85);
                beam.addColorStop(0, accent.startsWith('#') && accent.length === 7 ? accent + '30' : 'rgba(255, 210, 10, 0.20)');
                beam.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = beam;
                ctx.fillRect(0, 0, width, height);
            }
        }
    }

    if (opts.frame !== false && width >= 900) {
        drawGlassCard(ctx, 18, 14, width - 36, height - 28, {
            radius: 26,
            fill: opts.plainStage || opts.darkGrayBg ? 'rgba(255, 255, 255, 0.02)' : 'rgba(10, 12, 22, 0.18)',
            border: opts.plainStage || opts.darkGrayBg
                ? 'rgba(255, 255, 255, 0.16)'
                : (accent.startsWith('#') && accent.length === 7 ? accent + '66' : 'rgba(255, 210, 10, 0.4)'),
            lineWidth: 2.5
        });
    }

    if (!opts.noCornerStars) {
        drawFivePointStar(ctx, 56, 52, 11, 5, accent, accent);
        drawFivePointStar(ctx, width - 56, 52, 11, 5, accent, accent);
    }
}

async function resultsCanvas(session, title, entries, options = {}) {
    const width = 1600;
    const stageHeight = 900;
    const showcase = options.podium && options.best?.length === 1 ? options.best[0] : null;
    const height = stageHeight;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    const unit = options.unit || 'pts';
    const isVitrine = session.game === 'vitrine';
    const isFinalVitrinePodium = isVitrine && Boolean(options.podium && !options.cards);
    const bg = isVitrine ? await getVitrineBg(isFinalVitrinePodium) : await getPlayBgCanvas();
    const accent = options.accent || '#FFD20A';

    await stage(ctx, width, height, {
        bg,
        accent,
        blackBackdrop: isVitrine,
        bgOpacity: isVitrine ? 0.5 : 1,
        plainStage: isVitrine,
        darkGrayBg: false,
        noCornerStars: isVitrine
    });

    drawGlassCard(ctx, 48, 28, width - 96, options.prompt ? 114 : 88, {
        radius: 20,
        fill: isVitrine ? 'rgba(26, 28, 34, 0.90)' : 'rgba(12, 15, 26, 0.88)',
        border: isVitrine ? 'rgba(255, 255, 255, 0.22)' : accent,
        lineWidth: 2.5
    });

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff7e9';
    ctx.font = 'bold 34px "LemonMilk", "Sans"';
    ctx.fillText(cleanCanvasText(title), width / 2, options.prompt ? 64 : 72, width - 160);

    if (options.prompt) {
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '22px Sans';
        ctx.fillText(cleanCanvasText(options.prompt), width / 2, 114, width - 140);
    }

    if (!entries.length) return encodeJpeg(canvas, 0.92);

    const avatars = await Promise.all(entries.map(entry => loadAvatar(session.people.get(entry.user))));
    const rankPalette = {
        1: { ring: '#FFD700', fill: 'rgba(42, 30, 10, 0.88)', border: '#FFD700', text: '#FFD700', glow: 'rgba(255, 215, 0, 0.35)' },
        2: { ring: '#D7DEEB', fill: 'rgba(26, 32, 48, 0.86)', border: '#D7DEEB', text: '#E2E8F0', glow: 'rgba(215, 222, 235, 0.30)' },
        3: { ring: '#CD7F32', fill: 'rgba(38, 24, 18, 0.86)', border: '#CD7F32', text: '#F4A261', glow: 'rgba(205, 127, 50, 0.35)' }
    };

    if (options.podium && !options.cards) {
        const podSlots = entries.length === 1
            ? [{ idx: 0, x: 520, y: 186, w: 560, h: 446 }]
            : entries.length === 2
                ? [{ idx: 0, x: 220, y: 182, w: 540, h: 452 }, { idx: 1, x: 840, y: 232, w: 540, h: 402 }]
                : [
                    { idx: 1, x: 74, y: 248, w: 438, h: 388 },
                    { idx: 0, x: 548, y: 170, w: 504, h: 466 },
                    { idx: 2, x: 1088, y: 274, w: 438, h: 362 }
                ];

        for (const pod of podSlots) {
            const entry = entries[pod.idx];
            if (!entry) continue;
            const player = session.people.get(entry.user);
            const first = entry.rank === 1;
            const style = rankPalette[entry.rank] || {
                ring: '#a78bfa',
                fill: 'rgba(26, 22, 46, 0.84)',
                border: 'rgba(167, 139, 250, 0.45)',
                text: '#ffffff'
            };

            drawGlassCard(ctx, pod.x, pod.y, pod.w, pod.h, {
                radius: 22,
                fill: style.fill,
                border: style.border,
                lineWidth: first ? 3 : 2,
                glow: isVitrine ? style.glow : null,
                glowBlur: 24
            });

            const cx = pod.x + pod.w / 2;
            const avR = isVitrine ? 56 : (first ? 66 : 52);
            const avY = pod.y + avR + 28;
            drawAvatar(ctx, avatars[pod.idx], player, cx, avY, avR, style.ring);

            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = style.text;
            ctx.font = 'bold ' + (first ? 24 : 20) + 'px "LemonMilk", "Sans"';
            ctx.fillText('#' + entry.rank + (first ? '  •  CHAMPION' : ''), cx, avY + avR + 40, pod.w - 40);

            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold ' + (first ? 32 : 26) + 'px "LemonMilk", "Sans"';
            ctx.fillText(cleanCanvasText(player?.name || 'Participant'), cx, avY + avR + 84, pod.w - 48);

            drawGlassCard(ctx, cx - 130, pod.y + pod.h - 92, 260, 58, {
                radius: 16,
                fill: 'rgba(255, 255, 255, 0.08)',
                border: style.border,
                lineWidth: 1.5
            });
            ctx.fillStyle = style.text;
            ctx.font = 'bold 30px "LemonMilk", "Sans"';
            ctx.fillText(cleanCanvasText(entry.score + ' ' + unit), cx, pod.y + pod.h - 63, 236);
        }

        const extraY = 664;
        if (showcase) {
            drawGlassCard(ctx, 48, extraY, width - 96, 194, {
                radius: 22,
                fill: isVitrine ? 'rgba(26, 28, 34, 0.92)' : 'rgba(16, 15, 32, 0.90)',
                border: '#FFD700',
                lineWidth: 2.5
            });
            if (!isVitrine) {
                drawFivePointStar(ctx, 96, extraY + 42, 13, 5, '#FFD700', '#FFD700');
                drawFivePointStar(ctx, width - 96, extraY + 42, 13, 5, '#FFD700', '#FFD700');
            }
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 24px "LemonMilk", "Sans"';
            ctx.fillText(cleanCanvasText('MEILLEURE RÉPONSE • ' + showcase.score + ' ' + unit), width / 2, extraY + 38, width - 220);
            drawCenteredSegments(ctx, buildPhraseSegments(showcase.prompt, showcase.cards), width / 2, extraY + 96, width - 140, 26, 13);
            const authorName = cleanCanvasText(session.people.get(showcase.user)?.name || 'Participant·e');
            ctx.save();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.font = 'italic 20px Sans';
            ctx.fillText('- ' + authorName, width / 2, extraY + 148, width - 160);
            ctx.restore();
        } else if (options.bonusCards?.length) {
            drawGlassCard(ctx, 48, extraY, width - 96, 194, {
                radius: 22,
                fill: 'rgba(14, 16, 28, 0.88)',
                border: accent,
                lineWidth: 2
            });
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = accent;
            ctx.font = 'bold 20px "LemonMilk", "Sans"';
            ctx.fillText(cleanCanvasText(options.bonusLabel || 'CARTES TROUVÉES'), 82, extraY + 40, 420);
            const list = options.bonusCards.slice(0, 5);
            const cW = 94;
            const cH = 132;
            const totalW = list.length * (cW + 18) - 18;
            const startX = width - 82 - totalW;
            await Promise.all(list.map((c, idx) => drawCard(ctx, c, startX + idx * (cW + 18), extraY + 30, cW, cH, {
                glow: cardTheme(c).glow, border: cardTheme(c).hex, radius: 8
            })));
        } else {
            const rest = options.standings?.slice(3, 7) || [];
            drawGlassCard(ctx, 48, extraY + 24, width - 96, 140, {
                radius: 20,
                fill: 'rgba(12, 15, 26, 0.86)',
                border: 'rgba(255, 255, 255, 0.16)',
                lineWidth: 1.5
            });
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#cbd5e1';
            ctx.font = 'bold 21px "LemonMilk", "Sans"';
            const summaryLine = rest.length
                ? rest.map(item => '#' + item.rank + ' ' + cleanCanvasText(session.people.get(item.user)?.name || 'Joueur') + ' (' + item.score + ' ' + unit + ')').join('   •   ')
                : 'MERCI D’AVOIR JOUÉ SUR REGADEX ARCADE !';
            ctx.fillText(summaryLine, width / 2, extraY + 94, width - 160);
        }

        return encodeJpeg(canvas, 0.92);
    }

    const colW = (width - 96) / Math.max(1, entries.length);
    const positions = options.podium && entries.length === 3 ? [1, 0, 2] : entries.map((_, index) => index);

    for (const [index, entry] of entries.entries()) {
        const player = session.people.get(entry.user);
        const x = 48 + colW * (positions[index] + 0.5);
        const first = entry.rank === 1;
        const style = rankPalette[entry.rank] || (isVitrine
            ? { ring: '#94a3b8', fill: 'rgba(34, 37, 45, 0.88)', border: 'rgba(255, 255, 255, 0.22)', text: '#ffffff' }
            : { ring: '#a78bfa', fill: 'rgba(26, 22, 46, 0.84)', border: 'rgba(167, 139, 250, 0.45)', text: '#ffffff' });

        if (options.cards) {
            const cards = entry.cards || [];
            if (isVitrine && cards.length === 1) {
                const w = 300;
                const h = 420;
                const t = cardTheme(cards[0]);
                await drawCard(ctx, cards[0], x - w / 2, 176, w, h, { glow: t.glow, border: t.hex, radius: 14 });
            } else if (isVitrine && cards.length === 2) {
                const w = 240;
                const h = 336;
                const slots = [
                    { cx: x - 68, cy: 342, angle: -0.055 },
                    { cx: x + 68, cy: 436, angle: 0.055 }
                ];
                for (let cardIndex = 0; cardIndex < cards.length; cardIndex++) {
                    const card = cards[cardIndex];
                    const pos = slots[cardIndex];
                    const t = cardTheme(card);
                    await drawCard(ctx, card, pos.cx - w / 2, pos.cy - h / 2, w, h, {
                        glow: t.glow, border: t.hex, radius: 13, angle: pos.angle
                    });
                }
            } else {
                for (let cardIndex = 0; cardIndex < cards.length; cardIndex++) {
                    const card = cards[cardIndex];
                    const w = isVitrine ? 160 : (first ? 168 : 146);
                    const t = cardTheme(card);
                    await drawCard(
                        ctx, card,
                        x - (cards.length * (w + 14) - 14) / 2 + cardIndex * (w + 14),
                        172, w, w * 1.4,
                        { glow: t.glow, border: t.hex, radius: 12 }
                    );
                }
            }
        }

        const avatarR = isVitrine ? 46 : (first ? 54 : 44);
        const avatarY = isVitrine ? (options.cards ? 688 : 260) : (options.cards ? 496 : 240);
        drawAvatar(ctx, avatars[index], player, x, avatarY, avatarR, style.ring);
        const blockHeight = isVitrine ? (options.cards ? 122 : 140) : null;
        const top = isVitrine
            ? (options.cards ? stageHeight - 28 - blockHeight : avatarY + avatarR + 16)
            : (avatarY + (first ? 68 : 58));
        const finalBlockHeight = blockHeight || (stageHeight - 36 - top);
        const blockWidth = Math.min(390, colW - 28);

        drawGlassCard(ctx, x - blockWidth / 2, top, blockWidth, finalBlockHeight, {
            radius: 18,
            fill: style.fill,
            border: style.border,
            lineWidth: first ? 2.8 : 1.8
        });

        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = style.text;
        ctx.font = 'bold 24px "LemonMilk", "Sans"';
        ctx.fillText(cleanCanvasText('#' + entry.rank + '  •  ' + (player?.name || 'Participant')), x, top + (isVitrine ? 18 : 20), blockWidth - 28);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold ' + (isVitrine ? 38 : 42) + 'px "LemonMilk", "Sans"';
        ctx.fillText(cleanCanvasText(entry.score + ' ' + unit), x, top + (isVitrine ? 56 : 64), blockWidth - 28);
    }

    return encodeJpeg(canvas, 0.92);
}

async function devineVictoryCanvas(session, winner) {
    const state = session.state;
    const card = state.card;
    const theme = cardTheme(card);
    const W = 1600, H = 900;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    await stage(ctx, W, H, { accent: winner ? '#3498db' : '#94a3b8' });

    drawGlassCard(ctx, 48, 28, W - 96, 92, { radius: 20, fill: 'rgba(12, 15, 26, 0.88)', border: '#3498db', lineWidth: 2.5 });
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#74C0FC';
    ctx.font = 'bold 34px "LemonMilk", "Sans"';
    ctx.fillText(winner ? 'DEVINE-CARTE  •  ENQUÊTE RÉSOLUE !' : 'DEVINE-CARTE  •  FIN DE PARTIE', W / 2, 74, W - 160);

    drawGlassCard(ctx, 76, 152, 470, 696, { radius: 24, fill: 'rgba(14, 17, 30, 0.86)', border: theme.hex, lineWidth: 2.5 });
    await drawCard(ctx, card, 146, 186, 330, 462, { glow: theme.glow, border: theme.hex, radius: 14 });
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 26px "LemonMilk", "Sans"';
    ctx.fillText(cleanCanvasText(card.name), 311, 672, 420);
    ctx.fillStyle = theme.hex;
    ctx.font = 'bold 18px "LemonMilk", "Sans"';
    ctx.fillText(cleanCanvasText('N° ' + card.numCode + '  •  ' + card.rarity + '  •  ' + cardSetLabel(card)), 311, 718, 420);

    drawGlassCard(ctx, 586, 152, 938, 696, { radius: 24, fill: 'rgba(14, 17, 30, 0.86)', border: winner ? '#FFD700' : 'rgba(255,255,255,0.2)', lineWidth: winner ? 3 : 2 });
    const winPlayer = winner ? session.people.get(winner) : null;
    const mjPlayer = session.people.get(state.mj);
    const [winAv, mjAv] = await Promise.all([loadAvatar(winPlayer), loadAvatar(mjPlayer)]);

    if (winner && winPlayer) {
        drawFivePointStar(ctx, 1055 - 230, 224, 14, 6, '#FFD700', '#FFD700');
        drawFivePointStar(ctx, 1055 + 230, 224, 14, 6, '#FFD700', '#FFD700');
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 24px "LemonMilk", "Sans"';
        ctx.fillText('DÉMASQUÉE PAR', 1055, 224);
        drawAvatar(ctx, winAv, winPlayer, 1055, 366, 92, '#FFD700');
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 42px "LemonMilk", "Sans"';
        ctx.fillText(cleanCanvasText(winPlayer.name), 1055, 504, 840);
    } else {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#f87171';
        ctx.font = 'bold 34px "LemonMilk", "Sans"';
        ctx.fillText('CARTE NON DÉMASQUÉE', 1055, 340, 820);
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '24px Sans';
        ctx.fillText('Le mystère est resté entier jusqu’au bout.', 1055, 410, 820);
    }

    drawGlassCard(ctx, 646, 616, 818, 178, { radius: 18, fill: 'rgba(255, 255, 255, 0.05)', border: 'rgba(116, 192, 252, 0.35)', lineWidth: 1.5 });
    drawAvatar(ctx, mjAv, mjPlayer, 738, 705, 48, '#74C0FC');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#74C0FC';
    ctx.font = 'bold 18px "LemonMilk", "Sans"';
    ctx.fillText('MAÎTRE DU JEU', 812, 672);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 26px "LemonMilk", "Sans"';
    ctx.fillText(cleanCanvasText(mjPlayer?.name || 'MJ'), 812, 712, 340);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 20px "LemonMilk", "Sans"';
    ctx.textAlign = 'right';
    ctx.fillText((state.log?.length || 0) + ' QUESTION(S) POSÉE(S)', 1428, 705);

    return encodeJpeg(canvas, 0.92);
}

async function castingVictoryCanvas(session, leaders, votes) {
    const state = session.state;
    const W = 1600, H = 900;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    await stage(ctx, W, H, { accent: '#e74c3c' });

    drawGlassCard(ctx, 48, 28, W - 96, 118, { radius: 20, fill: 'rgba(12, 15, 26, 0.88)', border: '#e74c3c', lineWidth: 2.5 });
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ff7675';
    ctx.font = 'bold 32px "LemonMilk", "Sans"';
    ctx.fillText(leaders.length === 1 ? 'DÉBAT DE GOLMON  •  VICTOIRE !' : 'DÉBAT DE GOLMON  •  VERDICT', W / 2, 66, W - 160);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '22px Sans';
    ctx.fillText(cleanCanvasText(state.prompt), W / 2, 112, W - 160);

    const voteCounts = new Map();
    for (const v of votes.values()) voteCounts.set(v, (voteCounts.get(v) || 0) + 1);
    const avatars = await Promise.all(state.debaters.map(id => loadAvatar(session.people.get(id))));

    for (let i = 0; i < state.debaters.length; i++) {
        const uid = state.debaters[i];
        const player = session.people.get(uid);
        const card = state.slots.get(uid)?.card;
        const isWin = leaders.includes(uid);
        const count = voteCounts.get(uid) || 0;
        const x = i === 0 ? 72 : 832;
        const y = 176;
        const bw = 696;
        const bh = 674;

        drawGlassCard(ctx, x, y, bw, bh, {
            radius: 24,
            fill: isWin ? 'rgba(42, 28, 12, 0.88)' : 'rgba(16, 18, 30, 0.84)',
            border: isWin ? '#FFD700' : 'rgba(255, 255, 255, 0.18)',
            lineWidth: isWin ? 3.5 : 1.5
        });

        const cx = x + bw / 2;
        if (isWin) {
            drawFivePointStar(ctx, cx - 140, y + 40, 12, 5, '#FFD700', '#FFD700');
            drawFivePointStar(ctx, cx + 140, y + 40, 12, 5, '#FFD700', '#FFD700');
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 22px "LemonMilk", "Sans"';
            ctx.fillText(leaders.length > 1 ? 'EX ÆQUO' : 'VAINQUEUR', cx, y + 40);
        } else {
            ctx.fillStyle = '#94a3b8';
            ctx.font = 'bold 20px "LemonMilk", "Sans"';
            ctx.fillText('FINALISTE', cx, y + 40);
        }

        drawAvatar(ctx, avatars[i], player, cx, y + 126, 56, isWin ? '#FFD700' : '#94a3b8');
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 28px "LemonMilk", "Sans"';
        ctx.fillText(cleanCanvasText(player?.name || 'Candidat'), cx, y + 210, bw - 48);

        if (card) {
            const theme = cardTheme(card);
            await drawCard(ctx, card, cx - 102, y + 250, 204, 286, { glow: theme.glow, border: theme.hex, radius: 12 });
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 20px "LemonMilk", "Sans"';
            ctx.fillText(cleanCanvasText(card.name), cx, y + 562, bw - 48);
        }

        drawGlassCard(ctx, cx - 140, y + 594, 280, 52, {
            radius: 14,
            fill: isWin ? 'rgba(255, 215, 0, 0.16)' : 'rgba(255, 255, 255, 0.06)',
            border: isWin ? '#FFD700' : 'rgba(255,255,255,0.2)',
            lineWidth: 1.5
        });
        ctx.fillStyle = isWin ? '#FFD700' : '#cbd5e1';
        ctx.font = 'bold 24px "LemonMilk", "Sans"';
        ctx.fillText(count + ' VOTE' + (count > 1 ? 'S' : ''), cx, y + 620);
    }

    return encodeJpeg(canvas, 0.92);
}

async function rankingVictoryCanvas(session, leaders, votes) {
    const state = session.state;
    const W = 1600, H = 900;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    await stage(ctx, W, H, { accent: '#1abc9c' });

    drawGlassCard(ctx, 48, 28, W - 96, 114, { radius: 20, fill: 'rgba(12, 15, 26, 0.88)', border: '#1abc9c', lineWidth: 2.5 });
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#2dd4bf';
    ctx.font = 'bold 32px "LemonMilk", "Sans"';
    ctx.fillText('LE CLASSEMENT IMPOSSIBLE  •  VICTOIRE !', W / 2, 64, W - 160);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '22px Sans';
    ctx.fillText(cleanCanvasText(state.prompt), W / 2, 108, W - 160);

    const voteCounts = new Map();
    for (const v of votes.values()) voteCounts.set(v, (voteCounts.get(v) || 0) + 1);
    const mainWinner = leaders[0];
    const winPlayer = session.people.get(mainWinner);
    const av = await loadAvatar(winPlayer);

    drawGlassCard(ctx, 48, 166, W - 96, 134, { radius: 20, fill: 'rgba(14, 24, 28, 0.88)', border: '#FFD700', lineWidth: 2.5 });
    drawAvatar(ctx, av, winPlayer, 138, 233, 46, '#FFD700');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 18px "LemonMilk", "Sans"';
    ctx.fillText(leaders.length > 1 ? 'GAGNANTS EX ÆQUO' : 'MEILLEUR CLASSEMENT DÉFENDU', 210, 206);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 30px "LemonMilk", "Sans"';
    ctx.fillText(cleanCanvasText(leaders.map(id => session.people.get(id)?.name || 'Participant').join(' & ')), 210, 248, 950);

    const wVotes = voteCounts.get(mainWinner) || 0;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#2dd4bf';
    ctx.font = 'bold 28px "LemonMilk", "Sans"';
    ctx.fillText(wVotes + ' VOTE' + (wVotes > 1 ? 'S' : ''), W - 86, 233);

    const slot = state.slots.get(mainWinner);
    const cards = (slot?.order || []).map(cid => slot.cards.find(c => c.id === cid)).filter(Boolean);
    const rankColors = ['#FFD700', '#D7DEEB', '#CD7F32', '#1ABC9C'];
    const cardW = 248;
    const cardH = 347;
    const gap = 74;
    const totalW = cards.length * cardW + Math.max(0, cards.length - 1) * gap;
    const startX = Math.round((W - totalW) / 2);

    await Promise.all(cards.map(async (card, idx) => {
        const cx = startX + idx * (cardW + gap);
        const cy = 368;
        const rColor = rankColors[idx] || '#1abc9c';
        await drawCard(ctx, card, cx, cy, cardW, cardH, { glow: cardTheme(card).glow, border: rColor, radius: 14 });
        drawGlassCard(ctx, cx + cardW / 2 - 44, cy - 22, 88, 36, { radius: 12, fill: 'rgba(12, 15, 26, 0.96)', border: rColor, lineWidth: 2.5 });
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = rColor;
        ctx.font = 'bold 20px "LemonMilk", "Sans"';
        ctx.fillText('#' + (idx + 1), cx + cardW / 2, cy - 4);
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 21px "LemonMilk", "Sans"';
        ctx.fillText(cleanCanvasText(card.name), cx + cardW / 2, cy + cardH + 14, cardW + 30);
    }));

    return encodeJpeg(canvas, 0.92);
}

async function fmkVictoryCanvas(session, leaders, votes) {
    const state = session.state;
    const W = 1600, H = 900;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    await stage(ctx, W, H, { accent: '#ec4899' });

    drawGlassCard(ctx, 48, 28, W - 96, 92, { radius: 20, fill: 'rgba(12, 15, 26, 0.88)', border: '#ec4899', lineWidth: 2.5 });
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f472b6';
    ctx.font = 'bold 32px "LemonMilk", "Sans"';
    ctx.fillText('FUCK  •  MARRY  •  KILL  —  MEILLEURE JUSTIFICATION', W / 2, 74, W - 160);

    const voteCounts = new Map();
    for (const v of votes.values()) voteCounts.set(v, (voteCounts.get(v) || 0) + 1);
    const mainWinner = leaders[0];
    const winPlayer = session.people.get(mainWinner);
    const av = await loadAvatar(winPlayer);

    drawGlassCard(ctx, 48, 144, W - 96, 128, { radius: 20, fill: 'rgba(28, 14, 30, 0.88)', border: '#FFD700', lineWidth: 2.5 });
    drawAvatar(ctx, av, winPlayer, 136, 208, 44, '#FFD700');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 18px "LemonMilk", "Sans"';
    ctx.fillText(leaders.length > 1 ? 'EX ÆQUO' : 'JUSTIFICATION GAGNANTE', 206, 184);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 30px "LemonMilk", "Sans"';
    ctx.fillText(cleanCanvasText(leaders.map(id => session.people.get(id)?.name || 'Participant').join(' & ')), 206, 224, 960);

    const wVotes = voteCounts.get(mainWinner) || 0;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#f472b6';
    ctx.font = 'bold 28px "LemonMilk", "Sans"';
    ctx.fillText(wVotes + ' VOTE' + (wVotes > 1 ? 'S' : ''), W - 86, 208);

    const slot = state.slots.get(mainWinner);
    const colors = ['#ec4899', '#34d399', '#a78bfa'];
    for (let i = 0; i < 3; i++) {
        const colX = 48 + i * 512;
        const colW = 480;
        const cx = colX + colW / 2;
        const card = slot?.cards.find(c => c.id === slot.order[i]);
        const reason = cleanCanvasText(slot?.reasons?.[i] || 'Aucune justification');

        drawGlassCard(ctx, colX, 296, colW, 560, { radius: 22, fill: 'rgba(14, 17, 30, 0.86)', border: colors[i], lineWidth: 2.2 });
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = colors[i];
        ctx.font = 'bold 24px "LemonMilk", "Sans"';
        ctx.fillText(FMK_LABELS[i].toUpperCase(), cx, 336);

        if (card) {
            await drawCard(ctx, card, cx - 102, 368, 204, 286, { glow: cardTheme(card).glow, border: cardTheme(card).hex, radius: 12 });
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 20px "LemonMilk", "Sans"';
            ctx.fillText(cleanCanvasText(card.name), cx, 678, colW - 40);
        }

        drawGlassCard(ctx, colX + 22, 704, colW - 44, 132, { radius: 14, fill: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.12)', lineWidth: 1 });
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '18px Sans';
        const words = reason.split(' ');
        const lines = [];
        let line = '';
        for (const w of words) {
            const test = line ? line + ' ' + w : w;
            if (test.length > 38 && lines.length < 2) { lines.push(line); line = w; }
            else line = test;
        }
        if (line) lines.push(line);
        lines.slice(0, 3).forEach((ln, idx) => ctx.fillText(cut(ln, 44), cx, 738 + idx * 28, colW - 68));
    }

    return encodeJpeg(canvas, 0.92);
}

async function sendResult(session, title, entries, options = {}) {
    const unit = options.unit || 'pts';
    const result = embed(title, gameColor(session.game))
        .setAuthor({ name: 'RegaDex Arcade • Résultats' });
    const medals = ['🥇', '🥈', '🥉'];
    const lines = entries.map(entry => (medals[entry.rank - 1] || '**#' + entry.rank + '**') + ' · **' +
        escapeText(session.people.get(entry.user)?.name || 'Participant·e') + '** — `' + entry.score + ' ' + unit + '`');
    const description = [lines.join('\n'), options.description].filter(Boolean).join('\n' + SEP + '\n');
    if (description) result.setDescription(cut(description, 4096));
    if (options.footer) result.setFooter({ text: options.footer });
    const image = await resultsCanvas(session, title, entries, options).catch(error => {
        console.warn('[PLAY] Canvas des résultats :', error);
        return null;
    });
    if (image) result.setImage('attachment://resultats.jpg');
    await session.channel.send({
        ...silent({
            embeds: [result],
            files: image ? [new AttachmentBuilder(image, { name: 'resultats.jpg' })] : [],
            components: options.components || []
        }),
        allowedMentions: { parse: [] }
    });
}

async function standingsPayload(session, lobbyId, page) {
    const results = session.results.get(lobbyId);
    const lines = [
        ...results.entries.map(entry => '**#' + entry.rank + '** · **' +
            escapeText(session.people.get(entry.user)?.name || 'Participant·e') + '** — `' + entry.score + ' pts`'),
        ...results.best.map(entry => '⭐ ' + escapeText(completePhrase(entry.prompt, entry.cards)) + ' — `' + entry.score + ' pts`')
    ];
    const pages = Math.max(1, Math.ceil(lines.length / 3));
    const safe = Math.max(0, Math.min(page, pages - 1));
    const view = embed('🏆 Blanc Manger Caca · Classement', gameColor('vitrine'))
        .setAuthor({ name: 'RegaDex · Classement complet' })
        .setDescription(lines.slice(safe * 3, (safe + 1) * 3).join('\n') || 'Tout le classement figure sur le podium.')
        .setFooter({ text: 'Page ' + (safe + 1) + '/' + pages });
    const entries = results.entries.slice(safe * 3, (safe + 1) * 3);
    const image = entries.length ? await resultsCanvas(session, 'Blanc Manger Caca · Classement', entries)
        .catch(error => { console.warn('[PLAY] Canvas du classement :', error); return null; }) : null;
    if (image) view.setImage('attachment://classement.jpg');
    return {
        embeds: [view], attachments: [], files: image ? [new AttachmentBuilder(image, { name: 'classement.jpg' })] : [],
        components: pages > 1 ? [row(
            button(controlId(session, 'standing', lobbyId, safe - 1), 'Précédent', ButtonStyle.Secondary, '⬅️').setDisabled(safe === 0),
            button(controlId(session, 'standing', lobbyId, safe + 1), 'Suivant', ButtonStyle.Secondary, '➡️').setDisabled(safe === pages - 1)
        )] : []
    };
}

const BINDER_SIZES = ['4', '8', '18', '36'];

async function showBinder(interaction, session, action, parts, pickContext = null) {
    const [rawSet, rawPage, rawTheme, rawSize] = parts;
    const set = Number(rawSet) || 1;
    const page = Number(rawPage) || 0;
    const theme = rawTheme === 'W' ? 'W' : 'B';
    const size = BINDER_SIZES.includes(rawSize) ? rawSize : '18';

    if (action === 'binder') await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    else await interaction.deferUpdate();

    const result = await renderPlayBinder(interaction.user, set, page, theme, size);
    const curSize = BINDER_SIZES.includes(result.perPageMode) ? result.perPageMode : size;
    const curIdx = BINDER_SIZES.indexOf(curSize);
    const biggerSize = BINDER_SIZES[Math.max(0, curIdx - 1)];
    const smallerSize = BINDER_SIZES[Math.min(BINDER_SIZES.length - 1, curIdx + 1)];
    const biggerPage = Math.floor((result.page * Number(curSize)) / Number(biggerSize));
    const smallerPage = Math.floor((result.page * Number(curSize)) / Number(smallerSize));

    const navAction = pickContext ? 'pbrowse' : 'browse';
    const setAction = pickContext ? 'pbinderset' : 'binderset';
    const ctxParts = pickContext ? [pickContext.lobbyId, pickContext.round, pickContext.owner] : [];

    const view = embed('📖 RegaDex • Classeur des mini-jeux', gameColor(session.game))
        .setAuthor({ name: 'Cartes classiques éligibles (hors Holo, Full Art & Négative)' })
        .setDescription('**' + escapeText(result.setName) + '** • Grille **' + curSize + '** cartes/page')
        .setImage('attachment://classeur.jpg')
        .setFooter({ text: 'Page ' + (result.page + 1) + '/' + result.totalPages + ' • Thème ' + (theme === 'W' ? 'Clair' : 'Nuit') });
    const components = [row(
        button(controlId(session, navAction, ...ctxParts, result.set, result.page - 1, theme, curSize), 'Précédente', ButtonStyle.Secondary, '⬅️').setDisabled(result.page === 0),
        button(controlId(session, navAction, ...ctxParts, result.set, result.page + 1, theme, curSize), 'Suivante', ButtonStyle.Secondary, '➡️').setDisabled(result.page + 1 >= result.totalPages),
        button(controlId(session, navAction, ...ctxParts, result.set, biggerPage, theme, biggerSize), 'Agrandir', ButtonStyle.Primary, '🔍').setDisabled(curIdx === 0),
        button(controlId(session, navAction, ...ctxParts, result.set, smallerPage, theme, smallerSize), 'Réduire', ButtonStyle.Secondary, '🔎').setDisabled(curIdx === BINDER_SIZES.length - 1),
        button(controlId(session, navAction, ...ctxParts, result.set, result.page, theme === 'W' ? 'B' : 'W', curSize), 'Thème', ButtonStyle.Secondary, '🎨')
    )];
    if (result.sets.length > 1) components.push(row(new StringSelectMenuBuilder().setCustomId(controlId(session, setAction, ...ctxParts, theme, curSize))
        .setPlaceholder('Changer de set').addOptions(result.sets.map(item => ({ label: item.name, value: String(item.id), default: item.id === result.set })))));
    if (pickContext) {
        components.push(row(button(controlId(session, 'pback', ...ctxParts), 'Retour', ButtonStyle.Secondary, '⬅️')));
    }
    await interaction.editReply({
        embeds: [view], components, attachments: [], files: [new AttachmentBuilder(result.buffer, { name: 'classeur.jpg' })]
    });
}

async function menuInteraction(interaction, action, menu) {
    if (interaction.user.id !== menu.owner) return privateResponse(interaction, 'Ce menu appartient à la personne qui a lancé la commande.');
    if (menu.launching) return privateResponse(interaction, 'La session est déjà en cours d’ouverture.');
    switch (action) {
        case 'menu': { menu.sunday = false; return interaction.update(chooseGameMenu(menu)); }
        case 'guide': return interaction.update(chooseGameMenu(menu, 'all'));
        case 'guidegame': return interaction.update(chooseGameMenu(menu, interaction.values[0]));
        case 'game':
            if (interaction.values && GUIDES[interaction.values[0]]) {
                menu.game = interaction.values[0];
                if (menu.test) {
                    menu.botCount = Math.min(TEST_NAMES.length, Math.max(1, (MIN_PLAYERS[menu.game] || 1) - 1, menu.botCount || 2));
                    menu.startRound = 1;
                }
            }
            return menu.game ? interaction.update(launchMenu(menu)) : interaction.update(chooseGameMenu(menu));
        case 'bots': {
            const amount = Number(interaction.values?.[0]);
            if (menu.test && menu.game && Number.isInteger(amount) && amount >= 1 && amount <= TEST_NAMES.length) {
                menu.botCount = amount;
                return interaction.update(launchMenu(menu));
            }
            return privateResponse(interaction, 'Choisis entre un et trois bots.');
        }
        case 'startround': {
            const chosen = Number(interaction.values?.[0]);
            if (menu.test && menu.game && Number.isInteger(chosen) && chosen >= 1 && chosen <= ROUND_COUNT) {
                menu.startRound = chosen;
                return interaction.update(launchMenu(menu));
            }
            return privateResponse(interaction, 'Manche invalide.');
        }
        case 'sundaytest': {
            if (!menu.test) return privateResponse(interaction, 'Cette option est réservée au mode test.');
            menu.sunday = true; menu.game = 'vitrine'; menu.startRound = 1;
            menu.botCount = Math.min(TEST_NAMES.length, Math.max(1, Number(menu.botCount) || 2));
            return interaction.update(launchMenu(menu));
        }
        case 'starttest': {
            if (!menu.test || !menu.game) return privateResponse(interaction, 'Ce lancement est indisponible.');
            const botsCount = Math.min(TEST_NAMES.length, Math.max(1, Number(menu.botCount) || 2));
            const startRound = (menu.game === 'vitrine' || menu.game === 'cavale')
                ? Math.min(ROUND_COUNT, Math.max(1, Number(menu.startRound) || 1))
                : 1;
            return createSession(interaction, menu, null, botsCount, startRound, Boolean(menu.sunday));
        }
        case 'open': return !menu.test && menu.game ? createSession(interaction, menu) :
            privateResponse(interaction, 'Ce lancement est indisponible.');
        case 'invite': {
            if (menu.test || !menu.game) return privateResponse(interaction, 'Ce lancement est indisponible.');
            const users = new UserSelectMenuBuilder().setCustomId(idFor('inviteusers', menu.id))
                .setPlaceholder('Choisir les membres invités').setMinValues(1).setMaxValues(25);
            return interaction.update({
                embeds: [embed('🎟️ Sur invitation', gameColor(menu.game)).setDescription('Sélectionne les membres qui pourront jouer.')],
                components: [row(users), row(button(idFor('game', menu.id), 'Retour', ButtonStyle.Secondary, '⬅️'))]
            });
        }
        case 'inviteusers': return !menu.test && menu.game ? createSession(interaction, menu, new Set([menu.owner, ...interaction.values])) :
            privateResponse(interaction, 'Ce lancement est indisponible.');
        default: return privateResponse(interaction, 'Ce bouton a expiré.');
    }
}

async function rateResponse(interaction, session, parts) {
    if (session.stopVoteActive) return privateResponse(interaction, '⏸️ La partie est en pause pendant le vote d’arrêt (`!stop`).');
    const [lobbyId, round, index, rating] = parts;
    const voteIdx = Number(index);
    if (session.phase !== 'rating' || Number(lobbyId) !== session.lobbyId || Number(round) !== session.round ||
        voteIdx !== session.voteIndex || Date.now() >= session.deadline) return privateResponse(interaction, 'Vote clos pour cette réponse.');
    const id = interaction.user.id;
    const entry = session.entries[session.voteIndex];
    if (id === entry.user || !session.players.has(id)) return privateResponse(interaction, 'Tu ne peux pas noter cette réponse.');
    if (entry.votes.has(id)) return privateResponse(interaction, 'Ta note est déjà enregistrée.');
    const note = RATINGS.find(item => item[0] === rating);
    if (!note) return privateResponse(interaction, 'Note inconnue.');
    if (rating === 'love' && session.loveUsed.has(id)) return privateResponse(interaction, 'Tu as déjà utilisé **J’adore !** pendant cette session.');
    if (rating === 'love') session.loveUsed.add(id);
    entry.votes.set(id, note[2]);
    touchInteraction(session, interaction);
    const prefix = note[4] ? note[4] + ' ' : '';
    await privateResponse(interaction, prefix + '**' + note[1] + '** enregistré (`' + (note[2] > 0 ? '+' : '') + note[2] + ' pts`).');

    const eligibleVoters = [...session.roundPlayers].filter(uid => uid !== entry.user && session.players.has(uid)).length;
    if (eligibleVoters > 0 && entry.votes.size >= eligibleVoters) {
        void enqueue(session, async () => {
            if (session.phase !== 'rating' || session.stopVoteActive || session.voteIndex !== voteIdx) return;
            clearTimeout(session.timer);
            clearTimeout(session.botTimer);
            session.timerRevision++;
            for (const points of entry.votes.values()) entry.score += points;
            session.scores.set(entry.user, (session.scores.get(entry.user) ?? 0) + entry.score);
            session.voteIndex++;
            await showRating(session);
        }).catch(error => recoverSession(session, error));
    }
}

async function pickInteraction(interaction, session, action, parts) {
    if (session.stopVoteActive) return privateResponse(interaction, '⏸️ La partie est en pause pendant le vote d’arrêt (`!stop`).');
    const id = interaction.user.id;
    const [lobbyId, round, owner] = parts;
    if (session.phase !== 'pick' || Number(lobbyId) !== session.lobbyId || Number(round) !== session.round || Date.now() >= session.deadline)
        return privateResponse(interaction, 'La sélection de cette manche est terminée.');
    if (!session.roundPlayers.has(id) || (owner && owner !== id)) return privateResponse(interaction, 'Cette sélection ne t’est pas ouverte.');
    let draft = session.drafts.get(id);
    if (!draft) {
        draft = { query: '', page: 0, cards: [] };
        session.drafts.set(id, draft);
    }
    touchInteraction(session, interaction);
    const isEphemeralMsg = Boolean(interaction.message?.flags?.has(MessageFlags.Ephemeral));

    if (action === 'pick') {
        return interaction.reply({ ...draftPayload(session, id, draft), flags: MessageFlags.Ephemeral });
    }
    if (action === 'query') {
        return interaction.showModal(searchModal(session, id, draft));
    }
    if (action === 'search') {
        draft.query = interaction.fields.getTextInputValue('query').trim();
        draft.page = 0;
        const payload = draftPayload(session, id, draft);
        if (isEphemeralMsg) return interaction.update(payload);
        return interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
    }
    if (action === 'clearfilter') {
        draft.query = '';
        draft.page = 0;
    }
    if (action === 'prev') draft.page--;
    if (action === 'next') draft.page++;
    if (action === 'clear') draft.cards = [];
    if (action === 'swap') draft.cards.reverse();
    if (action === 'card') {
        const selected = interaction.values[0];
        if (playingCards(session, id, draft).some(card => card.id === selected)) {
            if (session.holes === 1) {
                draft.cards = [selected];
                draft.query = '';
                draft.page = 0;
            } else if (draft.cards.length < session.holes) {
                draft.cards.push(selected);
                draft.query = '';
                draft.page = 0;
            }
        }
    }
    if (action === 'lock') {
        const owned = playCardsFor(session, id);
        const selected = draft.cards.map(cardId => owned.find(card => card.id === cardId));
        if (selected.length !== session.holes || selected.some(card => !card)) return privateResponse(interaction, 'Choisis toutes les cartes dans ton classeur.');
        session.answers.set(id, { user: id, cards: selected, votes: new Map(), score: 0 });
        const confirmPayload = {
            embeds: [embed('✅ Réponse enregistrée (secrète)', gameColor('vitrine')).setDescription('> **' + escapeText(completePhrase(session.prompt, selected)) + '**')],
            components: [], files: [], attachments: []
        };
        if (isEphemeralMsg) await interaction.update(confirmPayload);
        else await interaction.reply({ ...confirmPayload, flags: MessageFlags.Ephemeral });
        if (session.answers.size >= session.roundPlayers.size) await startRatings(session);
        else await editPlayMessage(session, session.board, pickPayload(session));
        return;
    }
    const payload = draftPayload(session, id, draft);
    if (isEphemeralMsg) return interaction.update({ ...payload, files: [], attachments: [] });
    return interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
}

async function sessionInteraction(interaction, session, action, parts) {
    const player = readPlayer(interaction);
    const user = player.id;
    if (action === 'standing') {
        const [lobby, page] = parts.map(Number);
        if (!session.results.has(lobby)) return privateResponse(interaction, 'Ce classement a expiré.');
        if (interaction.message.flags?.has(MessageFlags.Ephemeral)) await interaction.deferUpdate();
        else await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                return interaction.editReply(await standingsPayload(session, lobby, page));
    }
    if (action === 'binder' || action === 'browse' || action === 'binderset') {
        const params = action === 'binderset' ? [interaction.values[0], 0, parts[0], parts[1]] : parts;
        return showBinder(interaction, session, action, params);
    }
    if (action === 'pbinder' || action === 'pbrowse' || action === 'pbinderset') {
        if (session.phase === 'closed') return privateResponse(interaction, 'Cette partie est terminée.');
        if (session.stopVoteActive) return privateResponse(interaction, '⏸️ La partie est en pause pendant le vote d’arrêt (`!stop`).');
        const [lobbyId, round, owner, ...rest] = parts;
        if (session.phase !== 'pick' || Number(lobbyId) !== session.lobbyId || Number(round) !== session.round || Date.now() >= session.deadline)
            return privateResponse(interaction, 'La sélection de cette manche est terminée.');
        if (!session.roundPlayers.has(user) || (owner && owner !== user))
            return privateResponse(interaction, 'Cette sélection ne t’est pas ouverte.');
        const params = action === 'pbinder'
            ? [1, 0, 'B', '18']
            : (action === 'pbinderset' ? [interaction.values[0], 0, rest[0], rest[1]] : rest);
        return showBinder(interaction, session, action, params, { lobbyId, round, owner: user });
    }
    if (action === 'pages') return gameResultPages(interaction, session, parts);
    if (session.phase === 'closed') return privateResponse(interaction, 'Cette partie est terminée.');
    if (action === 'ballot') return voteBallot(interaction, session, parts);
    if (session.stopVoteActive && !['cancel', 'quit'].includes(action) && !(session.test && ['settings', 'skipClock'].includes(action))) {
        return privateResponse(interaction, '⏸️ La partie est en pause pendant le vote d’arrêt (`!stop`).');
    }
    if (action === 'gameaction') return gameInteraction(interaction, session, parts);
    if (['join', 'late', 'cancel', 'startnow', 'quit', 'settings', 'settingsLate', 'settingsInvite', 'settingsUsers', 'skipClock'].includes(action) && Number(parts[0]) !== session.lobbyId)
        return privateResponse(interaction, 'Ce menu d’inscription a expiré.');
    if (['settings', 'settingsLate', 'settingsInvite', 'settingsUsers', 'skipClock'].includes(action))
        return sessionSettings(interaction, session, action, parts);
    if (action === 'rate') return rateResponse(interaction, session, parts);
    if (['pick', 'query', 'search', 'prev', 'next', 'clear', 'clearfilter', 'swap', 'card', 'lock', 'pback'].includes(action))
        return pickInteraction(interaction, session, action === 'pback' ? 'back' : action, parts);
    if (action === 'join') {
        if (session.test || session.optedOut.has(user) || (session.invited && !session.invited.has(user)))
            return privateResponse(interaction, 'Cette partie ne t’est pas ouverte.');
        if (session.players.has(user) || session.pending.has(user)) return privateResponse(interaction, 'Tu es déjà inscrit·e.');
        if (session.phase === 'lobby' && Date.now() >= session.deadline) return privateResponse(interaction, 'Les inscriptions viennent de se terminer.');
        if (session.phase !== 'lobby' && !session.allowLate) return privateResponse(interaction, 'Les arrivées en cours sont fermées.');
        const target = session.phase === 'lobby' ? session.players : session.pending;
        target.set(user, player);
        session.people.set(user, player);
                await privateResponse(interaction, session.phase === 'lobby' ? '✅ Tu es inscrit·e !' : '✅ Tu rejoindras la prochaine manche ou session.');
        if (session.phase === 'lobby') await updateLobby(session);
        return;
    }
    if (action === 'quit') {
        if (session.test) return privateResponse(interaction, 'Indisponible en mode test.');
        if (!session.players.has(user) && !session.pending.has(user))
            return privateResponse(interaction, 'Tu n’es pas inscrit·e à cette partie.');
                session.players.delete(user);
        session.pending.delete(user);
        if (session.phase !== 'lobby') session.optedOut.add(user);
        if (user === session.host) {
            session.host = session.players.keys().next().value || session.pending.keys().next().value || null;
        }
        if (session.phase === 'lobby') {
            if (!session.players.size && !session.pending.size) {
                await interaction.deferUpdate();
                await closeSession(session, 'Tous les participant·es ont quitté la partie.');
                return;
            }
            await privateResponse(interaction, '🚪 Tu as quitté les inscriptions.');
            await updateLobby(session);
            return;
        }
        await privateResponse(interaction, '🚪 Tu as quitté la partie.');
        
        if (!session.players.size && !session.pending.size) await closeSession(session, 'Tous les participant·es ont quitté la partie.');
        return;
    }
    if (action === 'startnow') {
        if (session.host !== user) return privateResponse(interaction, 'Cette commande est réservée à l’hôte.');
        if (session.phase !== 'lobby') return privateResponse(interaction, 'La partie a déjà commencé.');
        if (session.players.size + session.pending.size < MIN_PLAYERS[session.game]) {
            return privateResponse(interaction, 'Il faut au moins **' + MIN_PLAYERS[session.game] + '** participant·es pour démarrer.');
        }
                await interaction.deferUpdate();
        await startSelectedGame(session);
        return;
    }
    if (action === 'late' || action === 'cancel') {
        if (session.host !== user) return privateResponse(interaction, 'Cette commande est réservée à l’hôte.');
        touchInteraction(session, interaction);
        await interaction.deferUpdate();
        if (action === 'cancel') await closeSession(session, 'Partie annulée par l’hôte.');
        else {
            session.allowLate = !session.allowLate;
            await updateLobby(session);
        }
        return;
    }
    if (action === 'yes' || action === 'leave') {
        if (session.phase !== 'continue' || Number(parts[0]) !== session.lobbyId || Date.now() >= session.deadline)
            return privateResponse(interaction, 'Ce vote est terminé.');
        if (!session.players.has(user)) return privateResponse(interaction, 'Ce vote est réservé au groupe de jeu.');
        touchInteraction(session, interaction);
        await interaction.deferUpdate();
        session.continuing.delete(user);
        session.leaving.delete(user);
        (action === 'yes' ? session.continuing : session.leaving).add(user);
        if (session.continuing.size + session.leaving.size >= session.players.size) await finishContinue(session);
        else await editPlayMessage(session, session.continueMessage, continuePayload(session));
        return;
    }
    return privateResponse(interaction, 'Ce bouton a expiré.');
}

async function handlePlayInteraction(interaction) {
    if (!interaction.customId?.startsWith('play:')) return false;
    const [, action, id, ...parts] = interaction.customId.split(':');
    const menu = menus.get(id);
    const session = sessions.get(id);
    try {
        if (menu && interaction.channelId === menu.channelId && interaction.message?.id === menu.messageId && menu.expires > Date.now())
            await menuInteraction(interaction, action, menu);
        else if (session && interaction.channelId === id) {
            if (session.test && interaction.user.id !== PLAY_TEST_OWNER_ID) {
                await privateResponse(interaction, 'Cette session de test est réservée à Epsys.');
                return true;
            }
            if (action === 'rate' || ['pick', 'query', 'search', 'prev', 'next', 'clear', 'clearfilter', 'swap', 'card', 'binder', 'browse', 'binderset', 'pbinder', 'pbrowse', 'pbinderset', 'pback', 'standing', 'pages'].includes(action))
                await sessionInteraction(interaction, session, action, parts);
            else await enqueue(session, () => sessionInteraction(interaction, session, action, parts));
        } else await privateResponse(interaction, 'Ce menu a expiré. Lance une nouvelle partie avec `!play`.');
    } catch (error) {
        if (IGNORABLE_DISCORD_CODES.has(error?.code)) return true;
        console.error('[PLAY] Interaction :', error);
        if (!interaction.deferred && !interaction.replied) await privateResponse(interaction, 'Le mini-jeu a rencontré une erreur.').catch(() => {});
        else await interaction.followUp({ content: 'Le mini-jeu a rencontré une erreur.', flags: MessageFlags.Ephemeral }).catch(() => {});
        if (session && ['lock', 'join', 'late', 'cancel', 'startnow', 'quit', 'yes', 'leave', 'gameaction', 'ballot', 'skipClock'].includes(action))
            await recoverSession(session, error);
    }
    return true;
}

// Parcours commun aux cinq autres jeux et aux votes entre parties.
const CASTING_QUESTIONS = [
    'Qui pourrait réaliser le meilleur film d’action possible ?',
    'Qui remplirait mieux le rôle de Président.e de la République ?',
    'Qui pourrait pécho la mère de ton adversaire ?',
    'Prouve que ta carte est meilleure que celle de ton adversaire.',
    'Quelle carte pourrait renverser tout le YouTube Game ?',
    'Qui pourrait être en tête de cortège dans une manifestation pacifiste ?',
    'Qui pourrait être le ou la meilleur.e prof devant 150 élèves ?',
    'Quelle carte pourrait être la plus drôle à voir IRL ?',
    'Qui pourrait se chier dessus en public et n’avoir aucune réaction ?',
    'Quelle carte pourrait avoir toute une série à son effigie ?',
    'Quelle carte pourrait soigner le cancer si c’était possible ?',
    'Prouve que ta carte est la pire de tout le TCG.',
];
const RANKING_PROMPTS = [
    'Du plus au moins fiable pour garder un bébé.',
    'Du premier au dernier que tu appellerais pour déménager.',
    'Du plus au moins drôle.',
    'Du plus au moins capable de devenir un danger public.',
    'Du meilleur au pire YouTuber si la carte en était un.',
    'Du plus au moins probable de devenir un pointeur.',
    'Du premier au dernier que tu mangerais si c’était de la nourriture.',
    'Du plus sain d’esprit au plus gros fou du bus.',
    'Du plus politisé à gauche au plus politisé à droite.'
];
const FMK_LABELS = ['Fuck', 'Marry', 'Kill'];
const answerKey = value => normalize(value ?? '').replace(/[^\p{Letter}\p{Number}]+/gu, ' ').trim();
const stripFrenchArticle = key => key.replace(/^(?:le|la|les|l|un|une|des|du)\s+/i, '').trim();
const nameKeys = card => new Set([answerKey(card.name), answerKey(card.baseName)].filter(Boolean));

async function triggerStopVote(session, message) {
    if (session.phase === 'closed') return true;
    const uid = message.author.id;
    if (!session.players.has(uid) && !session.pending.has(uid) && session.host !== uid) {
        await message.reply(silent({ content: '🛑 Seul·es les participant·es peuvent proposer d’arrêter la partie.' })).catch(() => {});
        return true;
    }
    if (session.stopVoteActive) {
        await message.reply(silent({ content: '⏳ Un vote d’arrêt est déjà en cours dans ce salon.' })).catch(() => {});
        return true;
    }
    const voters = await sessionVoters(session);
    for (const pid of session.players.keys()) voters.add(pid);
    if (session.test) for (const bid of session.bots.keys()) voters.delete(bid);
    if (!voters.size) return true;

    const now = Date.now();
    session.pausedState = {
        pausedAt: now,
        phase: session.phase,
        hadDeadline: Boolean(session.deadline && session.deadline > now),
        deadlineRemaining: session.advancePhase && session.deadline > now ? Math.max(5_000, session.deadline - now) : 0,
        advancePhase: session.advancePhase || null,
        ballot: session.phase === 'ballot' ? session.ballot : null,
        ballotDeadlineRemaining: session.phase === 'ballot' && session.ballot ? Math.max(5_000, (session.deadline || now) - now) : 0
    };
    session.stopVoteActive = true;
    clearTimeout(session.timer);
    clearTimeout(session.botTimer);
    session.timerRevision = (session.timerRevision || 0) + 1;

    await openBallot(session, {
        title: '🛑 Vote d’arrêt de la partie (!stop)',
        description: playerRef(session, uid) + ' demande d’arrêter la partie en cours.\n⏸️ **Le jeu et le chronomètre sont mis en pause** jusqu’à la clôture du vote *(2 minutes)*.',
        voters,
        ms: STOP_VOTE_MS,
        options: [
            { value: 'stop', label: 'Arrêter la partie', emoji: '🛑' },
            { value: 'resume', label: 'Continuer la partie', emoji: '▶️' }
        ],
        choose: async (_leaders, votes) => {
            const stopVotes = [...votes.values()].filter(v => v === 'stop').length;
            const resumeVotes = [...votes.values()].filter(v => v === 'resume').length;
            session.stopVoteActive = false;
            if (stopVotes > resumeVotes) {
                session.pausedState = null;
                await closeSession(session, '🛑 La partie a été arrêtée par vote (`!stop`).\nTu peux relancer une partie dans <#' + PLAY_CHANNEL_ID + '>.');
                return;
            }
            await resumeFromStopVote(session);
        }
    });
    return true;
}

async function resumeFromStopVote(session) {
    const saved = session.pausedState;
    session.pausedState = null;
    if (!saved || session.phase === 'closed') return;
    const pauseElapsed = Math.max(0, Date.now() - saved.pausedAt);
    if (session.state?.roundStarted) session.state.roundStarted += pauseElapsed;
    if (session.state?.choiceDeadline) session.state.choiceDeadline += pauseElapsed;

    await session.channel.send(silent({
        embeds: [embed('▶️ Reprise de la partie', gameColor(session.game))
            .setDescription('Le vote n’a pas atteint la majorité pour arrêter. Le chronomètre reprend là où il s’était arrêté.')]
    })).catch(() => {});

    if (saved.phase === 'ballot' && saved.ballot) {
        session.phase = 'ballot';
        session.ballot = saved.ballot;
        session.deadline = Date.now() + saved.ballotDeadlineRemaining;
        await editPlayMessage(session, saved.ballot.message, ballotPayload(session, saved.ballot));
        phaseTimer(session, Math.max(1000, saved.ballotDeadlineRemaining), () => finishBallot(session, saved.ballot));
        return;
    }

    session.phase = saved.phase;
    if (saved.advancePhase) {
        session.deadline = saved.hadDeadline ? Date.now() + saved.deadlineRemaining : 0;
        phaseTimer(session, Math.max(1000, saved.deadlineRemaining), saved.advancePhase);
    }
    if (saved.phase === 'lobby' && session.lobby) await updateLobby(session).catch(() => {});
    else if (saved.phase === 'pick' && session.board) await editPlayMessage(session, session.board, pickPayload(session));
    else if (saved.phase === 'game' && session.state?.step === 'socialChoices') await renderSocialBoard(session);
}

function promotePending(session) {
    for (const [id, player] of session.pending) session.players.set(id, player);
    session.pending.clear();
}

function sampleCards(count, excluded = new Set(), distinctNames = false, category = null) {
    const cards = shuffled(getPlayCatalog()).filter(card => !excluded.has(card.id) && (!category || card.category === category));
    if (!distinctNames) return cards.slice(0, count);
    const seen = new Set();
    return cards.filter(card => {
        const name = answerKey(card.baseName || card.name);
        if (seen.has(name)) return false;
        seen.add(name);
        return true;
    }).slice(0, count);
}

function gameTitle(session) {
    const [name, , icon] = GUIDES[session.game];
    return icon + ' ' + name;
}

function gameButton(session, action, label, style, argument = '', emoji = null) {
    return button(controlId(session, 'gameaction', session.lobbyId, session.state.revision, action, argument), label, style, emoji);
}

function gameSelect(session, action, options, label) {
    return new StringSelectMenuBuilder()
        .setCustomId(controlId(session, 'gameaction', session.lobbyId, session.state.revision, action))
        .setPlaceholder(label).addOptions(options);
}

function gameStep(session, step) {
    clearTimeout(session.timer);
    clearTimeout(session.botTimer);
    session.timerRevision = (session.timerRevision || 0) + 1;
    session.phase = 'game';
    session.state.step = step;
    session.state.revision++;
    session.deadline = 0;
}

async function gameBoard(session, text, components = [], attachment = null, mentions = [], title = gameTitle(session), fields = []) {
    const page = embed(title, gameColor(session.game)).setAuthor({ name: 'RegaDex · Mini-jeux' }).setDescription(cut(text, 4000));
    if (fields.length) page.addFields(fields);
    const tip = STEP_TIPS[session.state?.step];
    if (tip && components.length) page.setFooter({ text: cut(tip, 2048) });
    if (attachment) page.setImage('attachment://' + attachment.name);
    const realMentions = mentions.filter(id => !session.bots.has(id));
    const payload = { embeds: [page], components, allowedMentions: { parse: [], users: realMentions } };
    if (realMentions.length) payload.content = realMentions.map(id => playerRef(session, id)).join(' ');
    if (attachment) payload.files = [attachment];
    if (session.board) await editPlayMessage(session, session.board, { components: [] });
    session.board = await session.channel.send(realMentions.length ? payload : silent(payload));
}

async function sessionVoters(session) {
    if (session.test) return new Set(session.players.keys());
    const ids = new Set([...session.channel.guild.members.cache.values()]
        .filter(member => !member.user.bot && !session.optedOut.has(member.id))
        .map(member => member.id));
    for (const id of session.players.keys()) ids.add(id);
    return ids;
}

async function startSelectedGame(session) {
    promotePending(session);
    if (session.players.size < MIN_PLAYERS[session.game]) {
        await closeSession(session, 'Pas assez de personnes inscrites pour lancer ce jeu.');
        return;
    }
    if (session.game === 'vitrine') return startRound(session);
    session.state = { revision: 0, step: '' };
    session.phase = 'game';
    if (session.game === 'cavale') return startCavale(session);
    if (session.game === 'casting') return startCasting(session);
    if (session.game === 'devine') return startDevine(session);
    if (session.game === 'classement') return startRanking(session);
    return startSocialChoices(session, 'fmk');
}

async function rewardMinigameWinners(session, userIds) {
    const winners = [...new Set((userIds || []).filter(id => id && !session.bots.has(id)))];
    if (session.test || !winners.length) return [];
    const key = 'play-' + session.runId + '-' + session.lobbyId + '-' + session.game;
    try {
        const rewarded = await grantMinigameTcgPoints(session.channel.client, winners, 3, key);
        if (rewarded.length) {
            const names = rewarded.map(id => playerRef(session, id)).join(', ');
            await session.channel.send(silent({
                content: '🏆 ' + names + ' gagne' + (rewarded.length > 1 ? 'nt' : '') + ' **+3 points RegaDex** pour cette victoire !',
                allowedMentions: { parse: [], users: rewarded }
            }));
        }
        return rewarded;
    } catch (error) {
        console.error('[PLAY] Récompense de victoire RegaDex :', error);
        await session.channel.send(silent({ content: '⚠️ La récompense de victoire n’a pas pu être créditée. L’équipe a été avertie.' })).catch(() => {});
        return [];
    }
}

async function finishGame(session, text, attachment = null, components = []) {
    gameStep(session, 'finished');
    if (session.board) await editPlayMessage(session, session.board, { components: [] });
    await gameBoard(session, text, components, attachment);
    if (session.sunday) {
        if (session.scheduled && Number(localParisParts().hour) >= SUNDAY_CUTOFF_HOUR) {
            await closeSession(session, 'La session est terminée. Le rendez-vous du dimanche se termine à 18 h.');
            return;
        }
        return nextGamePoll(session, await sessionVoters(session));
    }
    session.phase = 'continue';
    session.continuing = new Set();
    session.leaving = new Set();
    session.deadline = Date.now() + CONTINUE_MS;
    session.continueMessage = await session.channel.send(continuePayload(session));
    phaseTimer(session, CONTINUE_MS, () => finishContinue(session));
}

async function openBallot(session, { title, description, voters, options, choose, ms = CONTINUE_MS, canFinishEarly = () => true }) {
    clearTimeout(session.timer);
    clearTimeout(session.botTimer);
    session.phase = 'ballot';
    const ballot = {
        id: session.ballotId = (session.ballotId || 0) + 1,
        voters, options, votes: new Map(), choose, title, description, canFinishEarly
    };
    session.ballot = ballot;
    session.deadline = Date.now() + ms;
    ballot.message = await session.channel.send(silent(ballotPayload(session, ballot)));
    phaseTimer(session, Math.max(1, session.deadline - Date.now()), () => finishBallot(session, ballot));
}

function ballotPayload(session, ballot) {
    const options = ballot.options;
    const customId = controlId(session, 'ballot', ballot.id);
    const controls = options.length > 25
        ? new UserSelectMenuBuilder().setCustomId(customId).setPlaceholder('Sélectionner un·e participant·e')
        : new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder('Choisir ton vote')
            .addOptions(options.map(({ value, label, emoji }) => ({ value, label: cut(label, 100), ...(emoji ? { emoji } : {}) })));
    return {
        embeds: [embed(ballot.title, gameColor(session.game))
            .setAuthor({ name: 'Urne RegaDex · Vote en cours' })
            .setDescription(
                ballot.description + '\n' + SEP + '\n' +
                progressBar(ballot.votes.size, ballot.voters.size) + ' **' + ballot.votes.size + '/' + ballot.voters.size + '** vote(s) · Clôture ' + expiry(session.deadline)
            )
            .setFooter({ text: 'Ton choix reste anonyme jusqu’à la clôture' })],
        components: [row(controls)],
        allowedMentions: { parse: [] }
    };
}

async function voteBallot(interaction, session, [id]) {
    const ballot = session.ballot;
    const user = interaction.user.id;
    const value = interaction.values?.[0];
    if (session.phase !== 'ballot' || ballot?.id !== Number(id) || Date.now() >= session.deadline)
        return privateResponse(interaction, 'Ce vote est clos.');
    if (!ballot.voters.has(user)) return privateResponse(interaction, 'Ce vote ne t’est pas ouvert.');
    if (!ballot.options.some(option => option.value === value)) return privateResponse(interaction, 'Ce choix ne fait pas partie du vote.');
    ballot.votes.set(user, value);
    touchInteraction(session, interaction);
    await privateResponse(interaction, '✅ Ton vote est enregistré.');
    if (ballot.votes.size >= ballot.voters.size && ballot.canFinishEarly(ballot.votes)) await finishBallot(session, ballot);
    else await editPlayMessage(session, ballot.message, ballotPayload(session, ballot));
}

async function finishBallot(session, ballot) {
    if (session.ballot !== ballot || session.phase !== 'ballot') return;
    clearTimeout(session.timer);
    clearTimeout(session.botTimer);
    session.phase = 'game';
    const counts = new Map();
    for (const choice of ballot.votes.values()) counts.set(choice, (counts.get(choice) || 0) + 1);
    const maximum = Math.max(0, ...counts.values());
    const leaders = [...counts].filter(([, count]) => count === maximum).map(([value]) => value);
    const summary = ballot.votes.size
        ? ballot.options
            .filter(option => counts.has(option.value))
            .sort((a, b) => (counts.get(b.value) || 0) - (counts.get(a.value) || 0))
            .map(option => {
                const count = counts.get(option.value) || 0;
                const crown = count === maximum ? '👑 ' : '• ';
                return crown + '**' + escapeText(option.label) + '** — `' + count + ' vote' + (count > 1 ? 's' : '') + '`';
            })
            .join('\n').slice(0, 3800)
        : 'Aucun vote enregistré.';
    await editPlayMessage(session, ballot.message, {
        embeds: [embed(ballot.title, gameColor(session.game)).setAuthor({ name: 'Résultat du scrutin' }).setDescription(summary)],
        components: []
    });
    await ballot.choose(leaders, ballot.votes);
}

async function nextGamePoll(session, voters) {
    if (session.test && !session.sunday) voters = new Set([...voters].filter(id => !session.bots.has(id)));
    if (!voters.size) return closeSession(session, 'Session terminée. Merci d’avoir joué !');
    const options = Object.entries(GUIDES).map(([value, [label, , emoji]]) => ({ value, label, emoji }));
    await openBallot(session, {
        title: '🎮 Prochain mini-jeu',
        description: session.sunday
            ? 'Votez pour le prochain mini-jeu à jouer avant 18 h. Le scrutin se ferme quand tout le monde a voté ou après une minute. En cas d’égalité, Cacabot tire au sort.'
            : 'Choisissez le prochain jeu à enchaîner. En cas d’égalité, Cacabot départage au hasard.',
        voters, options, choose: async (leaders, votes) => {
            if (!leaders.length) return closeSession(session, 'Aucun vote enregistré. La session est terminée.');
            const winner = leaders[randomInt(leaders.length)];
            if (!session.players.has(session.host)) session.host = session.players.keys().next().value || votes.keys().next().value;
            session.game = winner;

            const counts = new Map();
            for (const choice of votes.values()) counts.set(choice, (counts.get(choice) || 0) + 1);
            const votedGames = [...counts.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([gid, cnt]) => {
                    const [gName, , gEmoji] = GUIDES[gid] || [gid, '', '🎮'];
                    return (gid === winner ? '👑 ' : '• ') + gEmoji + ' **' + gName + '** — `' + cnt + ' vote' + (cnt > 1 ? 's' : '') + '`';
                }).join('\n');

            await session.channel.send(silent({
                embeds: [embed(gameTitle(session), gameColor(winner))
                    .setAuthor({ name: 'RegaDex Arcade • Changement de mini-jeu' })
                    .setDescription(
                        (leaders.length > 1
                            ? '🎲 Égalité départagée en faveur de **' + GUIDES[winner][0] + '** !'
                            : '🏆 Le scrutin a sélectionné **' + GUIDES[winner][0] + '** !') +
                        '\n' + SEP + '\n**🗳️ Jeux votés :**\n' + (votedGames || '*Aucun vote*')
                    )
                    .setFooter({ text: 'Ouverture d’une nouvelle table d’inscription...' })],
                allowedMentions: { parse: [] }
            }));
            await openLobby(session);
        }
    });
}

function gameModal(session, op, title, fields) {
    const modal = new ModalBuilder()
        .setCustomId(controlId(session, 'gameaction', session.lobbyId, session.state.revision, op))
        .setTitle(title);
    for (const field of fields) {
        modal.addComponents(row(new TextInputBuilder().setCustomId(field.id).setLabel(field.label)
            .setStyle(field.paragraph ? TextInputStyle.Paragraph : TextInputStyle.Short)
            .setRequired(field.required !== false).setMaxLength(field.max || 180)));
    }
    return modal;
}

function cardFile(card, name = 'carte.png') {
    return new AttachmentBuilder(card.filePath, { name });
}

function distance(a, b) {
    let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
    let older;
    for (let i = 1; i <= a.length; i++) {
        const next = [i];
        for (let j = 1; j <= b.length; j++) {
            next[j] = Math.min(next[j - 1] + 1, previous[j] + 1, previous[j - 1] + Number(a[i - 1] !== b[j - 1]));
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
                next[j] = Math.min(next[j], older[j - 2] + 1);
            }
        }
        older = previous;
        previous = next;
    }
    return previous[b.length];
}

function matchesCard(query, target, names) {
    const guess = answerKey(query);
    if (!guess || guess.length > 100) return false;
    const expected = nameKeys(target);
    if (expected.has(guess)) return true;

    const compactGuess = guess.replace(/\s+/g, '');
    const compactExpected = new Set([...expected].map(n => n.replace(/\s+/g, '')));
    if (compactExpected.has(compactGuess)) return true;

    const noArtGuess = stripFrenchArticle(guess);
    const noArtExpected = new Set([...expected].map(stripFrenchArticle).filter(Boolean));
    if (noArtGuess.length >= 3 && noArtExpected.has(noArtGuess) && !names.has(guess)) return true;

    const threshold = guess.length >= 8 ? 2 : guess.length >= 4 ? 1 : 0;
    if (!threshold || names.has(guess)) return false;
    let best = Infinity;
    for (const name of expected) best = Math.min(best, distance(guess, name));
    for (const name of compactExpected) best = Math.min(best, distance(compactGuess, name));
    return best <= threshold && ![...names].some(name => !expected.has(name) && Math.abs(guess.length - name.length) <= best && distance(guess, name) <= best);
}

function cavaleStandingsLine(session) {
    const entries = ranked([...session.scores].map(([user, score]) => ({ user, score })));
    return entries.length
        ? entries.slice(0, 6).map(item => '**#' + item.rank + '** ' + escapeText(session.people.get(item.user)?.name || 'Enquêteur') + ' (`' + item.score + '`)').join(' · ')
        : '*Aucun point pour l’instant*';
}

async function startCavale(session) {
    const state = session.state;
    state.cards = sampleCards(5, new Set(), true);
    if (!state.cards.length) return finishGame(session, 'Aucune carte disponible dans le catalogue.');
    state.names = new Set(getPlayCatalog().flatMap(card => [...nameKeys(card)]));
    state.wonCards = new Map();
    state.index = Math.min(Math.max(0, state.cards.length - 1), Math.max(0, (session.startRound || 1) - 1));
    await cavaleRound(session);
}

async function cavaleRound(session) {
    const state = session.state;
    if (state.index >= state.cards.length) {
        const entries = ranked([...session.scores].map(([user, score]) => ({ user, score })));
        if (entries.length) {
            const top = entries.filter(entry => entry.rank <= 3).slice(0, 3);
            const championCards = state.wonCards?.get(top[0]?.user) || [];
            await sendResult(session, '🔍 Cartes zoomées • Podium', top, {
                podium: true,
                unit: 'carte(s)',
                accent: '#e67e22',
                standings: entries,
                bonusCards: championCards,
                bonusLabel: 'CARTES DU CHAMPION'
            });
        }
        await rewardMinigameWinners(session, entries.filter(entry => entry.rank === 1).map(entry => entry.user));
        const text = entries.length
            ? entries.map(item => '**#' + item.rank + '** · **' + escapeText(session.people.get(item.user)?.name || 'Enquêteur') + '** — `' + item.score + ' carte(s)`').join('\n')
            : 'Personne n’a trouvé de carte sur cette manche.';
        session.board = null;
        return finishGame(session, '**🏁 Fin de l’enquête**\n\n' + text);
    }
    promotePending(session);
    gameStep(session, 'guess');
    state.zoom = 0;
    state.roundStarted = Date.now();
    try {
        state.image = await loadImage(state.cards[state.index].filePath);
    } catch (error) {
        console.warn('[PLAY] Illustration de Cartes zoomées indisponible :', error);
        state.index++;
        return cavaleRound(session);
    }
    await cavaleZoom(session);
}

async function cavaleZoom(session) {
    const state = session.state;
    const source = state.image;
    const sourceSide = Math.min(source.width, source.height);
    const side = sourceSide * (0.10 + state.zoom * 0.09);
    const sx = Math.max(0, Math.min(source.width - side, source.width * 0.49 - side / 2));
    const sy = Math.max(0, Math.min(source.height - side, source.height * 0.46 - side / 2));

    const canvas = createCanvas(720, 780);
    const ctx = canvas.getContext('2d');
    await stage(ctx, canvas.width, canvas.height, { accent: '#00bcd4' });

    drawGlassCard(ctx, 32, 18, canvas.width - 64, 54, { radius: 14, fill: 'rgba(13, 12, 24, 0.84)', border: 'rgba(0, 188, 212, 0.45)' });
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#e0f7fa';
    ctx.font = 'bold 22px "LemonMilk", "Sans"';
    ctx.fillText('CARTE ' + (state.index + 1) + '/' + state.cards.length + '  •  INDICE ' + (state.zoom + 1) + '/5', canvas.width / 2, 45);

    const frameX = 48;
    const frameY = 92;
    const frameSize = 624;
    drawGlassCard(ctx, frameX - 6, frameY - 6, frameSize + 12, frameSize + 12, { radius: 18, fill: '#0b0916', border: '#00bcd4', lineWidth: 2.5 });
    ctx.save();
    drawRoundRect(ctx, frameX, frameY, frameSize, frameSize, 14);
    ctx.clip();
    ctx.drawImage(source, sx, sy, side, side, frameX, frameY, frameSize, frameSize);
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#a5b4fc';
    ctx.font = 'bold 16px "LemonMilk", "Sans"';
    ctx.fillText('ÉCRIS LE NOM DE LA CARTE DANS LE SALON', canvas.width / 2, 748);

    const png = exportPng(canvas);
    await gameBoard(
        session,
        'Écris directement le nom de la carte dans le salon *(fautes légères tolérées)*.\n' +
        'Prochain dézoom : ' + expiry(state.roundStarted + (state.zoom + 1) * 60_000),
        [],
        new AttachmentBuilder(png, { name: 'indice.png' }),
        [],
        '🔍 Cartes zoomées · Carte ' + (state.index + 1) + '/' + state.cards.length,
        [
            { name: 'Niveau de zoom', value: progressBar(state.zoom + 1, 5, 5) + ' **Indice ' + (state.zoom + 1) + '/5**', inline: true },
            { name: 'Scores actuels', value: cavaleStandingsLine(session), inline: true }
        ]
    );
    phaseTimer(session, Math.max(1, state.roundStarted + (state.zoom + 1) * 60_000 - Date.now()), async () => {
        if (++state.zoom === 5) await revealCavale(session);
        else await cavaleZoom(session);
    });
}

async function cavaleGuess(session, message) {
    if (session.stopVoteActive || session.phase !== 'game' || session.state.step !== 'guess' || !session.players.has(message.author.id)) return false;
    const state = session.state;
    if (Date.now() >= state.roundStarted + 300_000 || !matchesCard(message.content, state.cards[state.index], state.names)) return false;
    await revealCavale(session, message.author.id);
    return true;
}

async function revealCavale(session, winner = null) {
    const state = session.state;
    gameStep(session, 'reveal');
    const card = state.cards[state.index];
    const theme = cardTheme(card);
    if (winner) {
        session.scores.set(winner, (session.scores.get(winner) || 0) + 1);
        if (!state.wonCards) state.wonCards = new Map();
        const list = state.wonCards.get(winner) || [];
        list.push(card);
        state.wonCards.set(winner, list);
    }
    await gameBoard(
        session,
        (winner ? '🎉 ' + playerRef(session, winner) + ' remporte la carte !' : '⌛ Temps écoulé ! Voici la carte cachée.') + '\n' + SEP + '\n' +
        '**' + escapeText(card.name) + '** · `N° ' + card.numCode + '`\n' +
        theme.emoji + ' *' + escapeText(card.rarity) + '* · ' + escapeText(cardSetLabel(card)),
        [],
        cardFile(card),
        [],
        '🔍 Carte révélée · ' + (state.index + 1) + '/' + state.cards.length,
        [{ name: 'Scores', value: cavaleStandingsLine(session), inline: false }]
    );
    state.image = null;
    state.index++;
    session.board = null;
    phaseTimer(session, 3500, () => cavaleRound(session));
}

async function renderDevineVolunteers(session) {
    const state = session.state;
    const list = [...state.volunteers].map(id => '• ' + playerRef(session, id)).join('\n') || '*Aucun volontaire pour le moment*';
    await gameBoard(
        session,
        'Qui souhaite incarner le **Maître du Jeu (MJ)** ?\nLe tirage au sort aura lieu ' + expiry(session.deadline) + '.',
        [row(
            gameButton(session, 'volunteer', 'Être volontaire', ButtonStyle.Primary, '', '✋'),
            gameButton(session, 'drawmj', 'Lancer le tirage', ButtonStyle.Success, '', '🎲').setDisabled(state.volunteers.size === 0)
        )],
        null, [], '🕵️ Devine-carte · Choix du MJ',
        [{ name: 'Volontaires (' + state.volunteers.size + ')', value: list, inline: false }]
    );
}

async function startDevine(session) {
    const state = session.state;
    state.volunteers = new Set();
    gameStep(session, 'volunteer');
    session.deadline = Date.now() + JOIN_MS;
    await renderDevineVolunteers(session);
    phaseTimer(session, JOIN_MS, () => setupDevine(session));
}

async function setupDevine(session) {
    const state = session.state;
    clearTimeout(session.timer);
    clearTimeout(session.botTimer);
    if (!state.volunteers.size) return finishGame(session, 'Aucun volontaire pour être MJ. On passe au vote du prochain jeu.');
    state.mj = shuffled(state.volunteers)[0];
    state.card = sampleCards(1, new Set(), true)[0];
    if (!state.card) return finishGame(session, 'Le catalogue ne contient aucune carte disponible.');
    state.names = new Set(getPlayCatalog().flatMap(card => [...nameKeys(card)]));
    const ids = [...session.players.keys()].filter(id => id !== state.mj);
    const limit = ids.length >= 5 ? 3 : ids.length >= 3 ? 4 : 5;
    state.investigators = new Map(ids.map(id => [id, { left: limit, misses: 0, paused: false }]));
    state.order = shuffled(ids);
    state.cursor = 0;
    state.log = [];
    state.idleActors = new Set();
    gameStep(session, 'mjReady');
    await gameBoard(
        session,
        playerRef(session, state.mj) + ' est tiré·e au sort comme **Maître du Jeu** !\n' +
        'Clique ci-dessous pour découvrir la carte secrète et lancer la partie *(**' + limit + '** questions par enquêteur)*.\n\n' +
        'Expiration ' + expiry(Date.now() + CONTINUE_MS) + '.',
        [row(gameButton(session, 'secret', 'Ouvrir la carte secrète', ButtonStyle.Primary, '', '🗝️'))],
        null, [state.mj]
    );
    phaseTimer(session, CONTINUE_MS, () => openDevineStop(session));
}

function devineHistory(session) {
    return session.state.log.map(({ asker, question, answer }, i) => {
        const icon = answer === 'Oui' ? '✅' : answer === 'Non' ? '❌' : '🔁';
        return '**' + (i + 1) + '.** ' + playerRef(session, asker) + ' : *' + escapeText(question) + '* → ' + icon + ' **' + answer + '**';
    });
}

function devineUtilities(session) {
    return row(
        button(controlId(session, 'binder'), 'Classeur', ButtonStyle.Secondary, '📖'),
        gameButton(session, 'history', 'Historique', ButtonStyle.Secondary, '', '📜').setDisabled(!session.state.log?.length),
        gameButton(session, 'return', 'Reprendre ma place', ButtonStyle.Secondary, '', '🔄').setDisabled(![...session.state.investigators.values()].some(p => p.paused))
    );
}

async function devineBoard(session, status, controls, mentions = []) {
    const state = session.state;
    const lines = devineHistory(session);
    const history = lines.slice(-6).join('\n') || '*Aucune question posée pour le moment.*';
    const quotas = [...state.investigators.entries()]
        .map(([id, p]) => (p.paused ? '💤 ' : id === state.current ? '▶️ ' : '🔎 ') + playerRef(session, id) + ' : `' + p.left + '`')
        .join(' · ');
    const fields = [
        { name: 'MJ & Enquêteurs (questions restantes)', value: '🎭 **MJ :** ' + playerRef(session, state.mj) + '\n' + (quotas || '—'), inline: false },
        { name: 'Dernières questions (' + state.log.length + ')', value: cut(history, 1024), inline: false }
    ];
    await gameBoard(session, status, [...controls, devineUtilities(session)], null, mentions, '🕵️ Devine-carte · Enquête', fields);
}

async function devineTurn(session, samePlayer = null) {
    const state = session.state;
    const withQuestions = [...state.investigators].filter(([, player]) => player.left > 0);
    const available = state.order.filter(id => !state.investigators.get(id).paused);
    if (!withQuestions.length) return devineLastChance(session);
    if (!available.length || available.every(id => state.idleActors.has(id))) return devineDormant(session);
    const finalQuestioner = withQuestions.length === 1 ? withQuestions[0][0] : null;
    if (finalQuestioner && !available.includes(finalQuestioner)) return devineLastChance(session);
    let current = samePlayer || finalQuestioner;
    if (!current) {
        for (let i = 0; i < state.order.length; i++) {
            const candidate = state.order[state.cursor++ % state.order.length];
            if (available.includes(candidate)) { current = candidate; break; }
        }
    }
    if (!current) return devineDormant(session);
    state.current = current;
    state.lastQuestioner = Boolean(finalQuestioner);
    state.pendingQuestion = null;
    const investigator = state.investigators.get(current);
    gameStep(session, 'turn');
    session.deadline = Date.now() + CONTINUE_MS;
    const control = row(
        gameButton(session, 'ask', 'Poser une question', ButtonStyle.Primary, '', '❓').setDisabled(!investigator.left),
        gameButton(session, 'guess', 'Proposer une carte', ButtonStyle.Success, '', '🎯'),
        gameButton(session, 'pass', finalQuestioner ? 'Dernières réponses' : 'Passer mon tour', ButtonStyle.Secondary, '', '⏭️')
    );
    await devineBoard(
        session,
        'Au tour de ' + playerRef(session, current) + ' · **' + investigator.left + '** question(s) restante(s)\nFin du tour ' + expiry(session.deadline),
        [control], [current]
    );
    phaseTimer(session, CONTINUE_MS, () => devinePass(session, true));
}

async function devinePass(session, expired) {
    const state = session.state;
    const player = state.investigators.get(state.current);
    if (expired && ++player.misses >= 2) player.paused = true;
    if (!expired) player.misses = 0;
    if (state.lastQuestioner) return devineLastChance(session);
    state.idleActors.add(state.current);
    await devineTurn(session);
}

async function devineDormant(session) {
    gameStep(session, 'dormant');
    session.deadline = Date.now() + CONTINUE_MS;
    await devineBoard(
        session,
        '⏸️ Personne n’a joué pendant le dernier tour de table. Cliquez pour reprendre avant ' + expiry(session.deadline) + '.',
        [row(gameButton(session, 'resume', 'Reprendre la partie', ButtonStyle.Primary, '', '▶️'))]
    );
    phaseTimer(session, CONTINUE_MS, () => finishDevine(session, 'Personne n’a repris la partie.'));
}

async function devineLastChance(session) {
    gameStep(session, 'finalGuess');
    session.state.finalGuesses = new Set();
    session.deadline = Date.now() + CONTINUE_MS;
    await devineBoard(
        session,
        '⏳ **Dernière chance** — Chaque enquêteur peut tenter une ultime proposition en privé avant ' + expiry(session.deadline) + '.',
        [row(gameButton(session, 'guess', 'Proposer ma dernière carte', ButtonStyle.Success, '', '🎯'))]
    );
    phaseTimer(session, CONTINUE_MS, () => finishDevine(session, 'Personne n’a trouvé pendant la dernière chance.'));
}

async function devineWaitingMJ(session) {
    gameStep(session, 'waitingMJ');
    session.deadline = Date.now() + CONTINUE_MS;
    const { mj, pendingQuestion } = session.state;
    await devineBoard(
        session,
        playerRef(session, mj) + ', réponds à la question de ' + playerRef(session, pendingQuestion.asker) + ' avant ' + expiry(session.deadline) + '.',
        [row(gameButton(session, 'mjpanel', 'Ouvrir le pupitre MJ', ButtonStyle.Primary, '', '🎛️'))],
        [mj]
    );
    phaseTimer(session, CONTINUE_MS, () => openDevineStop(session));
}

async function openDevineStop(session) {
    gameStep(session, 'stopVote');
    const state = session.state;
    state.stopVotes = new Set();
    await showDevineStop(session);
    if (session.test) scheduleTestBots(session, session.timerRevision, CONTINUE_MS);
}

async function showDevineStop(session) {
    const state = session.state;
    const mjAction = state.pendingQuestion
        ? gameButton(session, 'mjpanel', 'Ouvrir le pupitre MJ', ButtonStyle.Primary, '', '🎛️')
        : gameButton(session, 'secret', 'Ouvrir la carte secrète', ButtonStyle.Primary, '', '🗝️');
    await devineBoard(
        session,
        '⚠️ Le MJ n’a pas répondu à temps. Vous pouvez l’attendre ou voter pour arrêter (**' +
        state.stopVotes.size + '/' + Math.ceil(state.investigators.size / 2) + '** vote(s)).',
        [row(mjAction, gameButton(session, 'stop', 'Arrêter la partie', ButtonStyle.Danger, '', '🛑'))]
    );
}

async function finishDevine(session, reason, winner = null) {
    const state = session.state;
    const theme = cardTheme(state.card);
    if (session.board) await editPlayMessage(session, session.board, { components: [] });
    session.board = null;
    const poster = await devineVictoryCanvas(session, winner).catch(error => {
        console.warn('[PLAY] Canvas Devine-carte :', error);
        return null;
    });
    const attachment = poster ? new AttachmentBuilder(poster, { name: 'devine-victoire.jpg' }) : cardFile(state.card);
    if (winner) await rewardMinigameWinners(session, [winner]);
    return finishGame(
        session,
        (winner ? '🎉 ' + playerRef(session, winner) + ' a démasqué la carte secrète !' : '🕵️ ' + reason) + '\n' + SEP + '\n' +
        '**' + escapeText(state.card.name) + '** · `N° ' + state.card.numCode + '`\n' +
        theme.emoji + ' *' + escapeText(state.card.rarity) + '* · ' + escapeText(cardSetLabel(state.card)),
        attachment
    );
}

async function devineAction(interaction, session, op, argument) {
    const state = session.state;
    const user = interaction.user.id;
    const investigator = state.investigators?.get(user);
    const ack = async message => {
        touchInteraction(session, interaction);
        await privateResponse(interaction, message);
    };
    if (op === 'volunteer' && state.step === 'volunteer' && session.players.has(user)) {
        state.volunteers.add(user);
        await ack('✋ Tu es volontaire pour être MJ.');
        await renderDevineVolunteers(session);
        return;
    }
    if (op === 'drawmj' && state.step === 'volunteer') {
        if (user !== session.host) return privateResponse(interaction, 'Seul·e l’hôte peut lancer le tirage.');
        if (!state.volunteers.size) return privateResponse(interaction, 'Il faut au moins un volontaire.');
        touchInteraction(session, interaction);
        await interaction.deferUpdate();
        return setupDevine(session);
    }
    if (op === 'secret' && user === state.mj && ['mjReady', 'stopVote'].includes(state.step)) {
        touchInteraction(session, interaction);
        const theme = cardTheme(state.card);
        await interaction.reply({
            embeds: [embed('🗝️ Carte secrète à faire deviner', gameColor('devine'))
                .setDescription('**' + escapeText(state.card.name) + '** · `N° ' + state.card.numCode + '`\n' + theme.emoji + ' *' + escapeText(state.card.rarity) + '*')
                .setImage('attachment://carte.png')],
            files: [cardFile(state.card)],
            flags: MessageFlags.Ephemeral
        });
        return devineTurn(session);
    }
    if (op === 'history' && state.log?.length) {
        const lines = devineHistory(session);
        const text = lines.join('\n');
        touchInteraction(session, interaction);
        if (text.length < 3900) return interaction.reply({
            embeds: [embed('📜 Historique de l’enquête', gameColor('devine')).setDescription(text)],
            flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] }
        });
        const plain = state.log.map((item, index) => (index + 1) + '. ' + item.question + ' — ' + item.answer).join('\n');
        return interaction.reply({
            files: [new AttachmentBuilder(Buffer.from(plain), { name: 'historique-enquete.txt' })],
            flags: MessageFlags.Ephemeral
        });
    }
    if (op === 'return' && investigator?.paused && state.step !== 'finished') {
        investigator.paused = false;
        investigator.misses = 0;
        await ack('🔄 Tu reprends ta place dans la rotation.');
        if (state.step === 'dormant') {
            state.idleActors.clear();
            await devineTurn(session);
        }
        return;
    }
    if (op === 'resume' && state.step === 'dormant' && investigator) {
        investigator.paused = false;
        investigator.misses = 0;
        state.idleActors.clear();
        await ack('▶️ L’enquête reprend.');
        return devineTurn(session);
    }
    if (op === 'stop' && state.step === 'stopVote' && investigator) {
        state.stopVotes.add(user);
        await ack('🛑 Ton vote d’arrêt est enregistré.');
        if (state.stopVotes.size >= Math.ceil(state.investigators.size / 2)) return finishDevine(session, 'Les joueurs ont arrêté l’enquête.');
        return showDevineStop(session);
    }
    if (op === 'mjpanel' && user === state.mj && state.pendingQuestion && ['waitingMJ', 'stopVote'].includes(state.step)) {
        touchInteraction(session, interaction);
        return interaction.reply({
            embeds: [embed('🎛️ Pupitre du MJ', gameColor('devine'))
                .setDescription('**Carte secrète :** ' + escapeText(state.card.name) + '\n' + SEP + '\n**Question :** ' + escapeText(state.pendingQuestion.question))],
            components: [row(
                gameButton(session, 'answer', 'Oui', ButtonStyle.Success, 'yes', '✅'),
                gameButton(session, 'answer', 'Non', ButtonStyle.Danger, 'no', '❌'),
                gameButton(session, 'answer', 'À reformuler', ButtonStyle.Secondary, 'retry', '🔁')
            )],
            flags: MessageFlags.Ephemeral
        });
    }
    if (op === 'answer' && user === state.mj && state.pendingQuestion && ['waitingMJ', 'stopVote'].includes(state.step) &&
        ['yes', 'no', 'retry'].includes(argument)) {
        const question = state.pendingQuestion;
        await ack(argument === 'retry' ? '🔁 La question doit être reformulée.' : '✅ Ta réponse est enregistrée.');
        if (argument === 'retry') {
            state.log.push({ ...question, answer: 'À reformuler' });
            return devineTurn(session, question.asker);
        }
        state.investigators.get(question.asker).left--;
        state.log.push({ ...question, answer: argument === 'yes' ? 'Oui' : 'Non' });
        state.idleActors.clear();
        return devineTurn(session);
    }
    const onTurn = investigator && user === state.current && state.step === 'turn';
    const inFinal = investigator && state.step === 'finalGuess' && !state.finalGuesses.has(user);
    if (session.deadline > 0 && Date.now() >= session.deadline) return privateResponse(interaction, 'Le délai a expiré.');
    if (op === 'pass' && onTurn) {
        await ack('⏭️ Tu passes sans dépenser de question.');
        return devinePass(session, false);
    }
    if (op === 'ask' && onTurn && investigator.left) {
        touchInteraction(session, interaction);
        return interaction.showModal(gameModal(session, 'question', 'Poser une question', [{ id: 'text', label: 'Question pour le MJ', max: 240 }]));
    }
    if (op === 'question' && onTurn && investigator.left) {
        const text = interaction.fields.getTextInputValue('text').trim();
        if (!text) return privateResponse(interaction, 'Écris une question avant de valider.');
        investigator.misses = 0;
        state.pendingQuestion = { asker: user, question: text };
        await ack('❓ Ta question est transmise au MJ.');
        return devineWaitingMJ(session);
    }
    if (op === 'guess' && (onTurn || inFinal)) {
        touchInteraction(session, interaction);
        return interaction.showModal(gameModal(session, 'guessSubmit', 'Proposer une carte', [{ id: 'text', label: 'Nom de la carte', max: 100 }]));
    }
    if (op === 'guessSubmit' && (onTurn || inFinal)) {
        const guess = interaction.fields.getTextInputValue('text').trim();
        if (!guess) return privateResponse(interaction, 'Indique le nom de la carte.');
        if (inFinal) state.finalGuesses.add(user);
        const correct = matchesCard(guess, state.card, state.names);
        await ack(correct ? '🎉 Bonne réponse !' : '❌ Ce n’est pas la bonne carte.');
        if (correct) return finishDevine(session, '', user);
        if (inFinal) return;
        investigator.misses = 0;
        state.idleActors.clear();
        return devineTurn(session);
    }
    return privateResponse(interaction, 'Cette action ne t’est pas ouverte maintenant.');
}

async function startCasting(session) {
    gameStep(session, 'castingSetup');
    session.deadline = Date.now() + JOIN_MS;
    const group = session.players.size > 2 ? [
        { value: 'group|bank', label: 'Groupe · Sujet préparé', emoji: '🎭' },
        { value: 'group|custom', label: 'Groupe · Sujet écrit par un membre', emoji: '✍️' }
    ] : [];
    await gameBoard(
        session,
        playerRef(session, session.host) + ' choisit le format du débat et l’origine du sujet.\nDéfaut automatique ' + expiry(session.deadline) + '.',
        [row(gameSelect(session, 'castSetup', [
            ...group,
            { value: 'duel|bank', label: '1 contre 1 · Sujet préparé', emoji: '⚔️' },
            { value: 'duel|custom', label: '1 contre 1 · Sujet écrit par un membre', emoji: '✍️' }
        ], 'Choisir le format'))],
        null, [session.host]
    );
    phaseTimer(session, JOIN_MS, () => castingSetup(session, session.players.size > 2 ? 'group|bank' : 'duel|bank'));
}

async function renderCastingVolunteers(session) {
    const state = session.state;
    const list = [...state.volunteers].map(id => '• ' + playerRef(session, id)).join('\n') || '*Aucun·e volontaire pour le moment*';
    await gameBoard(
        session,
        'Inscrivez-vous pour débattre ! Deux candidat·es seront tiré·es au sort ' + expiry(session.deadline) + '.',
        [row(
            gameButton(session, 'castVolunteer', 'Je veux débattre', ButtonStyle.Primary, '', '🎙️'),
            gameButton(session, 'castDraw', 'Lancer le tirage', ButtonStyle.Success, '', '🎲').setDisabled(state.volunteers.size < 2)
        )],
        null, [], '🎙️ Débat de golmon · Volontaires',
        [{ name: 'Volontaires (' + state.volunteers.size + '/2 min)', value: list, inline: false }]
    );
}

async function castingSetup(session, value) {
    const state = session.state;
    clearTimeout(session.timer);
    clearTimeout(session.botTimer);
    const [mode, source] = value.split('|');
    state.duel = mode === 'duel';
    state.custom = source === 'custom';
    state.volunteers = new Set();
    gameStep(session, 'castVolunteer');
    if (state.duel && session.players.size === 2) {
        state.volunteers = new Set(session.players.keys());
        return selectDebaters(session);
    }
    session.deadline = Date.now() + JOIN_MS;
    await renderCastingVolunteers(session);
    phaseTimer(session, JOIN_MS, () => selectDebaters(session));
}

async function selectDebaters(session) {
    const state = session.state;
    clearTimeout(session.timer);
    clearTimeout(session.botTimer);
    if (state.volunteers.size < 2) return finishGame(session, 'Il faut au moins deux volontaires pour lancer le débat.');
    state.debaters = shuffled(state.volunteers).slice(0, 2);
    state.prompt = shuffled(CASTING_QUESTIONS)[0];
    if (!state.custom) return castingCards(session);
    const spectators = [...session.players.keys()].filter(id => !state.debaters.includes(id));
    state.writer = shuffled(spectators.length ? spectators : state.debaters)[0];
    gameStep(session, 'castPrompt');
    session.deadline = Date.now() + WRITE_MS;
    await gameBoard(
        session,
        playerRef(session, state.writer) + ', rédige le sujet du débat avant ' + expiry(session.deadline) + '.',
        [row(gameButton(session, 'castWrite', 'Écrire la question', ButtonStyle.Primary, '', '✍️'))],
        null, [state.writer]
    );
    phaseTimer(session, WRITE_MS, () => castingCards(session));
}

async function renderCastingCardsBoard(session, mentions = []) {
    const state = session.state;
    const statusList = state.debaters.map(id => {
        const locked = state.slots.get(id)?.locked;
        return (locked ? '✅' : '⏳') + ' ' + playerRef(session, id);
    }).join('\n');
    const lockedCount = [...state.slots.values()].filter(item => item.locked).length;
    await gameBoard(
        session,
        '**Sujet du débat :** ' + escapeText(state.prompt) + '\n' + SEP + '\n' +
        'Les deux candidat·es choisissent et verrouillent leur carte en privé.\nFin du tirage ' + expiry(session.deadline),
        [row(gameButton(session, 'castPanel', 'Voir / changer ma carte', ButtonStyle.Primary, '', '🃏'))],
        null, mentions, '🎙️ Débat de golmon · Préparation',
        [{ name: 'Candidat·es (' + lockedCount + '/2 prêt·es)', value: statusList, inline: false }]
    );
}

async function castingCards(session) {
    const state = session.state;
    clearTimeout(session.timer);
    clearTimeout(session.botTimer);
    const cards = sampleCards(2, new Set(), true);
    if (cards.length < 2) return finishGame(session, 'Deux cartes différentes sont nécessaires pour le Casting.');
    state.drawn = new Set(cards.map(card => card.id));
    state.slots = new Map(state.debaters.map((id, i) => [id, { card: cards[i], remaining: 3, locked: false }]));
    gameStep(session, 'castCards');
    session.deadline = Date.now() + PICK_MS;
    await renderCastingCardsBoard(session, state.debaters);
    phaseTimer(session, PICK_MS, () => castingDebate(session));
}

function castingPanel(session, slot) {
    const theme = cardTheme(slot.card);
    const view = embed('🃏 Ma carte · Débat de golmon', gameColor('casting'))
        .setDescription(
            '**' + escapeText(slot.card.name) + '** · `N° ' + slot.card.numCode + '`\n' +
            theme.emoji + ' *' + escapeText(slot.card.rarity) + '* · ' + escapeText(cardSetLabel(slot.card)) + '\n' + SEP + '\n' +
            '🎲 **' + slot.remaining + '/3** changement(s) restant(s)' + (slot.locked ? '\n🔒 **Carte verrouillée**' : '')
        )
        .setImage('attachment://carte.png');
    return {
        embeds: [view],
        files: [cardFile(slot.card)],
        components: [row(
            gameButton(session, 'castReroll', 'Changer de carte', ButtonStyle.Secondary, '', '🎲').setDisabled(slot.locked || slot.remaining === 0),
            gameButton(session, 'castLock', 'Verrouiller', ButtonStyle.Success, '', '🔒').setDisabled(slot.locked)
        )]
    };
}

async function castingDebate(session) {
    const state = session.state;
    clearTimeout(session.timer);
    clearTimeout(session.botTimer);
    for (const slot of state.slots.values()) slot.locked = true;
    gameStep(session, 'castDebate');
    session.deadline = Date.now() + 300_000;
    const cards = state.debaters.map(id => state.slots.get(id).card);
    const art = await drawVoteCards(cards, { header: 'DÉBAT DE GOLMON • LES CANDIDATS', cardW: 230 })
        .catch(error => { console.warn('[PLAY] Cartes du Casting :', error); return null; });
    await gameBoard(
        session,
        '**Sujet :** ' + escapeText(state.prompt) + '\n' + SEP + '\n' +
        state.debaters.map((id, i) => '🎙️ ' + playerRef(session, id) + ' défend **' + escapeText(cards[i].name) + '**').join('\n') +
        '\n\nVous avez **5 minutes** pour débattre dans ce salon. Fin ' + expiry(session.deadline),
        [row(gameButton(session, 'castEndDebate', 'Passer au vote', ButtonStyle.Primary, '', '🗳️'))],
        art ? new AttachmentBuilder(art, { name: 'candidats.png' }) : null,
        state.debaters
    );
    phaseTimer(session, 300_000, () => castingVote(session, false));
}

async function castingVote(session, second) {
    const state = session.state;
    clearTimeout(session.timer);
    clearTimeout(session.botTimer);
    const voters = state.duel ? new Set(state.debaters) : await sessionVoters(session);
    if (!state.duel) for (const id of state.debaters) voters.delete(id);
    if (!voters.size) return finishGame(session, 'Le débat est terminé. Le public n’a désigné personne.');
    const options = state.debaters.map(value => ({ value, label: session.people.get(value)?.name || 'Participant·e', emoji: '🎙️' }));
    await openBallot(session, {
        title: second ? '🎙️ Départage du duel' : '🎙️ Qui vous a convaincu·es ?',
        description: second
            ? 'Le duel est à 1–1. Mettez-vous d’accord sur la personne qui a remporté le débat.'
            : 'Votez pour la personne qui a le mieux défendu sa carte pendant le débat.',
        voters, options,
        canFinishEarly: votes => !state.duel || second || new Set(votes.values()).size === 1,
        choose: async (leaders, votes) => {
            if (state.duel && votes.size === 2 && leaders.length === 2 && !second) return castingVote(session, true);
            if (session.board) await editPlayMessage(session, session.board, { components: [] });
            session.board = null;
            const poster = leaders.length
                ? await castingVictoryCanvas(session, leaders, votes).catch(error => {
                    console.warn('[PLAY] Canvas Casting :', error);
                    return null;
                })
                : null;
            const attachment = poster ? new AttachmentBuilder(poster, { name: 'casting-victoire.jpg' }) : null;
            if (leaders.length) await rewardMinigameWinners(session, leaders);
            if (leaders.length === 1) return finishGame(session, '🏆 Le débat est remporté par ' + playerRef(session, leaders[0]) + ' !', attachment);
            return finishGame(session, leaders.length ? '🤝 Le débat se termine sur un match nul.' : 'Le débat est terminé. Aucun vote enregistré.', attachment);
        }
    });
}

async function castingAction(interaction, session, op) {
    const state = session.state;
    const user = interaction.user.id;
    const slot = state.slots?.get(user);
    if (op === 'castSetup' && user === session.host && state.step === 'castingSetup' &&
        /^(group|duel)\|(bank|custom)$/.test(interaction.values?.[0])) {
        touchInteraction(session, interaction);
        await interaction.deferUpdate();
        return castingSetup(session, interaction.values[0]);
    }
    if (op === 'castVolunteer' && state.step === 'castVolunteer' && session.players.has(user)) {
        state.volunteers.add(user);
        await privateResponse(interaction, '🎙️ Ton inscription au tirage est enregistrée.');
        touchInteraction(session, interaction);
        await renderCastingVolunteers(session);
        return;
    }
    if (op === 'castDraw' && state.step === 'castVolunteer') {
        if (user !== session.host) return privateResponse(interaction, 'Seul·e l’hôte peut lancer le tirage.');
        if (state.volunteers.size < 2) return privateResponse(interaction, 'Il faut au moins deux volontaires.');
        touchInteraction(session, interaction);
        await interaction.deferUpdate();
        return selectDebaters(session);
    }
    if (op === 'castEndDebate' && state.step === 'castDebate') {
        if (user !== session.host) return privateResponse(interaction, 'Seul·e l’hôte peut clore le débat en avance.');
        touchInteraction(session, interaction);
        await interaction.deferUpdate();
        return castingVote(session, false);
    }
    if (op === 'castWrite' && state.step === 'castPrompt' && user === state.writer) {
        touchInteraction(session, interaction);
        return interaction.showModal(gameModal(session, 'castPrompt', 'Sujet du débat', [{ id: 'text', label: 'Ta question', max: 180 }]));
    }
    if (op === 'castPrompt' && state.step === 'castPrompt' && user === state.writer) {
        const prompt = interaction.fields.getTextInputValue('text').trim();
        if (!prompt) return privateResponse(interaction, 'Écris une question avant de valider.');
        state.prompt = prompt;
        touchInteraction(session, interaction);
        await privateResponse(interaction, '✍️ Le sujet est enregistré.');
        return castingCards(session);
    }
    if (state.step !== 'castCards' || !slot) return privateResponse(interaction, 'Cette action ne t’est pas ouverte.');
    if (op === 'castPanel') {
        touchInteraction(session, interaction);
        return interaction.reply({ ...castingPanel(session, slot), flags: MessageFlags.Ephemeral });
    }
    if (slot.locked) return privateResponse(interaction, 'Ta carte est déjà verrouillée.');
    if (op === 'castReroll' && slot.remaining > 0) {
        const card = sampleCards(1, state.drawn, true)[0];
        if (!card) return privateResponse(interaction, 'Il ne reste plus de carte à tirer.');
        slot.remaining--;
        slot.card = card;
        state.drawn.add(card.id);
        touchInteraction(session, interaction);
        return interaction.update({ ...castingPanel(session, slot), attachments: [] });
    }
    if (op === 'castLock') {
        slot.locked = true;
        touchInteraction(session, interaction);
        await interaction.update({ ...castingPanel(session, slot), attachments: [] });
        if ([...state.slots.values()].every(item => item.locked)) return castingDebate(session);
        await renderCastingCardsBoard(session);
        return;
    }
    return privateResponse(interaction, 'Cette action ne t’est pas ouverte.');
}

async function startRanking(session) {
    gameStep(session, 'rankSetup');
    session.deadline = Date.now() + JOIN_MS;
    await gameBoard(
        session,
        playerRef(session, session.host) + ' choisit l’origine de la consigne.\nPar défaut ' + expiry(session.deadline) + '.',
        [row(
            gameButton(session, 'rankBank', 'Consigne préparée', ButtonStyle.Primary, '', '📋'),
            gameButton(session, 'rankCustom', 'Consigne d’un membre', ButtonStyle.Secondary, '', '✍️')
        )],
        null, [session.host]
    );
    phaseTimer(session, JOIN_MS, () => rankingSetup(session, false));
}

async function rankingSetup(session, custom) {
    const state = session.state;
    clearTimeout(session.timer);
    clearTimeout(session.botTimer);
    state.prompt = shuffled(RANKING_PROMPTS)[0];
    if (!custom) return rankingModeVote(session);
    state.writer = shuffled(session.players.keys())[0];
    gameStep(session, 'rankWrite');
    session.deadline = Date.now() + WRITE_MS;
    await gameBoard(
        session,
        playerRef(session, state.writer) + ', rédige la consigne du classement avant ' + expiry(session.deadline) + '.',
        [row(gameButton(session, 'rankWrite', 'Écrire la consigne', ButtonStyle.Primary, '', '✍️'))],
        null, [state.writer]
    );
    phaseTimer(session, WRITE_MS, () => rankingModeVote(session));
}

async function rankingModeVote(session) {
    const voters = new Set(session.players.keys());
    if (session.test) for (const bid of session.bots.keys()) voters.delete(bid);
    await openBallot(session, {
        title: '📋 Tirage des cartes pour le classement',
        description: '**Consigne :** ' + escapeText(session.state.prompt),
        voters,
        options: [
            { value: 'common', label: 'Les mêmes cartes pour tout le monde', emoji: '🤝' },
            { value: 'random', label: 'Un tirage différent par personne', emoji: '🎲' }
        ],
        choose: leaders => startSocialChoices(session, 'classement', leaders.length ? shuffled(leaders)[0] : 'common')
    });
}

function isSlotReady(state, slot) {
    return slot.locked && (state.kind !== 'fmk' || slot.reasons !== null);
}

function socialStatusPayload(session) {
    const state = session.state;
    const readyCount = [...state.slots.values()].filter(slot => isSlotReady(state, slot)).length;
    const statusList = state.members
        .map(id => (isSlotReady(state, state.slots.get(id)) ? '✅' : '⏳') + ' ' + playerRef(session, id))
        .join(' · ');
    return {
        embeds: [
            embed('📊 Suivi des choix (' + readyCount + '/' + state.members.length + ')', gameColor(session.game))
                .setDescription(
                    progressBar(readyCount, state.members.length) + '\n' +
                    cut(statusList, 1900) + '\n' + SEP + '\nFin de sélection ' + expiry(state.choiceDeadline)
                )
        ]
    };
}

async function renderSocialBoard(session, attachment = undefined) {
    const state = session.state;
    if (attachment !== undefined || !session.board) {
        const intro = state.kind === 'fmk'
            ? 'Répartis secrètement ces 3 cartes Personnage entre **💖 Fuck**, **💍 Marry** et **💀 Kill**.'
            : '**Consigne :** ' + escapeText(state.prompt) + '\n*Mode : ' + (state.common ? 'Tirage commun' : 'Tirage individuel') + '*';
        await gameBoard(
            session,
            intro + '\n' + SEP + '\nClique sur le bouton ci-dessous pour faire tes choix en privé.',
            [row(gameButton(session, 'socialPanel', state.kind === 'fmk' ? 'Faire mes choix' : 'Faire mon classement', ButtonStyle.Primary, '', state.kind === 'fmk' ? '💌' : '📋'))],
            attachment,
            [],
            gameTitle(session)
        );
    }
    const statusPayload = socialStatusPayload(session);
    state.statusMessage = await session.channel.send(silent(statusPayload));
}

async function startSocialChoices(session, kind, mode = 'common') {
    const state = session.state;
    state.kind = kind;
    state.common = mode === 'common';
    if (session.board) {
        await editPlayMessage(session, session.board, { components: [] }).catch(() => {});
        session.board = null;
    }
    state.statusMessage = null;
    const size = kind === 'fmk' ? 3 : 4;
    const category = kind === 'fmk' ? 'Personnages' : null;
    state.members = [...session.players.keys()];
    const common = sampleCards(size, new Set(), true, category);
    if (common.length < size) return finishGame(session, 'Le catalogue ne contient pas assez de cartes différentes pour ce jeu.');
    state.slots = new Map(state.members.map(id => [id, {
        cards: state.common ? common : sampleCards(size, new Set(), true, category),
        order: [], locked: false, reasons: null
    }]));
    gameStep(session, 'socialChoices');
    const ms = kind === 'fmk' ? 270_000 : 150_000;
    state.choiceDeadline = Date.now() + ms;
    const art = state.common
        ? await drawVoteCards(common, { header: kind === 'fmk' ? 'FUCK • MARRY • KILL' : 'TIRAGE COMMUN' })
            .catch(error => { console.warn('[PLAY] Cartes du tirage :', error); return null; })
        : null;
    await renderSocialBoard(session, art ? new AttachmentBuilder(art, { name: 'tirage.png' }) : null);
    phaseTimer(session, Math.max(1, state.choiceDeadline - Date.now()), () => finishSocialChoices(session));
}

function socialLabels(state) {
    return state.kind === 'fmk' ? FMK_LABELS : ['1er', '2e', '3e', '4e'];
}

function socialTag(state, index) {
    if (state.kind === 'fmk') return ['💖 Fuck', '💍 Marry', '💀 Kill'][index] || FMK_LABELS[index];
    return ['🥇 1er', '🥈 2e', '🥉 3e', '4️⃣ 4e'][index] || (index + 1) + 'e';
}

function socialLines(state, slot) {
    return socialLabels(state).map((_, i) => {
        const card = slot.order[i] ? slot.cards.find(item => item.id === slot.order[i]) : null;
        return '**' + socialTag(state, i) + '** · ' + (card ? escapeText(card.name) : '*À placer*');
    }).join('\n');
}

function socialPanel(session, slot) {
    const state = session.state;
    const lockedText = slot.locked
        ? (state.kind === 'fmk' && !slot.reasons
            ? '\n' + SEP + '\n🔒 **Trio verrouillé.** Rédige tes justifications ou valide tel quel.'
            : '\n' + SEP + '\n✅ **Choix enregistrés !**')
        : '';
    const display = embed(state.kind === 'fmk' ? '💌 Tes choix FMK' : '📋 Ton classement', gameColor(session.game))
        .setDescription(socialLines(state, slot) + lockedText);
    if (slot.artAvailable) display.setImage('attachment://mes-cartes.png');
    const remaining = slot.cards.filter(card => !slot.order.includes(card.id));
    const components = [];
    if (!slot.locked && remaining.length) components.push(row(gameSelect(
        session, 'socialPick',
        remaining.map(card => ({
            value: card.id,
            label: cut(card.name, 100),
            description: cut('N° ' + card.numCode + ' · ' + card.rarity + ' · ' + cardSetLabel(card), 100)
        })),
        'Choisir la carte pour ' + socialLabels(state)[slot.order.length]
    )));
    if (!slot.locked) components.push(row(
        gameButton(session, 'socialReset', 'Recommencer', ButtonStyle.Secondary, '', '🔄').setDisabled(!slot.order.length),
        gameButton(session, 'socialLock', 'Verrouiller', ButtonStyle.Success, '', '🔒').setDisabled(remaining.length > 0)
    ));
    if (slot.locked && state.kind === 'fmk' && !slot.reasons) {
        components.push(row(
            gameButton(session, 'socialReasons', 'Rédiger mes justifications', ButtonStyle.Primary, '', '✍️'),
            gameButton(session, 'socialSkipReasons', 'Valider sans texte', ButtonStyle.Success, '', '✅')
        ));
    }
    return { embeds: [display], components };
}

function fmkModal(session, slot) {
    return gameModal(session, 'fmkReasons', 'Tes trois justifications', FMK_LABELS.map((label, i) => {
        const card = slot.cards.find(item => item.id === slot.order[i]);
        return { id: 'why' + i, label: cut(label + ' · ' + card.name, 45), paragraph: true, max: 4000, required: false };
    }));
}

function socialAllReady(state) {
    return [...state.slots.values()].every(slot => isSlotReady(state, slot));
}

async function socialAction(interaction, session, op) {
    const state = session.state;
    const user = interaction.user.id;
    if ((op === 'rankBank' || op === 'rankCustom') && state.step === 'rankSetup' && user === session.host) {
        touchInteraction(session, interaction);
        await interaction.deferUpdate();
        return rankingSetup(session, op === 'rankCustom');
    }
    if (op === 'rankWrite' && state.step === 'rankWrite' && user === state.writer) {
        touchInteraction(session, interaction);
        return interaction.showModal(gameModal(session, 'rankPrompt', 'Consigne du classement', [{ id: 'text', label: 'Ta consigne', max: 180 }]));
    }
    if (op === 'rankPrompt' && state.step === 'rankWrite' && user === state.writer) {
        const prompt = interaction.fields.getTextInputValue('text').trim();
        if (!prompt) return privateResponse(interaction, 'Écris une consigne avant de valider.');
        state.prompt = prompt;
        touchInteraction(session, interaction);
        await privateResponse(interaction, '✍️ La consigne est enregistrée.');
        return rankingModeVote(session);
    }
    if (['presentDone', 'presentPass'].includes(op) && state.step === 'presenting' &&
        [state.presenter, session.host].includes(user)) {
        touchInteraction(session, interaction);
        await interaction.deferUpdate();
        return presentNext(session);
    }
    const slot = state.slots?.get(user);
    if (state.step !== 'socialChoices' || !slot || Date.now() >= state.choiceDeadline)
        return privateResponse(interaction, 'Ce choix ne t’est pas ouvert ou la sélection est terminée.');
    if (op === 'socialPanel') {
        touchInteraction(session, interaction);
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const art = !state.common
            ? await drawVoteCards(slot.cards, { header: 'TES CARTES POUR LE CLASSEMENT' }).catch(error => { console.warn('[PLAY] Cartes du classement :', error); return null; })
            : null;
        slot.artAvailable = Boolean(art);
        const payload = socialPanel(session, slot);
        if (art) payload.files = [new AttachmentBuilder(art, { name: 'mes-cartes.png' })];
        return interaction.editReply(payload);
    }
    const panelUpdate = () => slot.artAvailable ? socialPanel(session, slot) : { ...socialPanel(session, slot), attachments: [] };
    if (op === 'fmkReasons' && state.kind === 'fmk' && slot.locked && !slot.reasons) {
        slot.reasons = FMK_LABELS.map((_, i) => interaction.fields.getTextInputValue('why' + i).trim());
        touchInteraction(session, interaction);
        if (interaction.message?.flags?.has(MessageFlags.Ephemeral)) await interaction.update(panelUpdate());
        else await privateResponse(interaction, '✅ Tes justifications sont enregistrées.');
        if (socialAllReady(state)) await finishSocialChoices(session);
        else await renderSocialBoard(session);
        return;
    }
    if (op === 'socialSkipReasons' && state.kind === 'fmk' && slot.locked && !slot.reasons) {
        slot.reasons = FMK_LABELS.map(() => '');
        touchInteraction(session, interaction);
        await interaction.update(panelUpdate());
        if (socialAllReady(state)) await finishSocialChoices(session);
        else await renderSocialBoard(session);
        return;
    }
    if (op === 'socialReasons' && state.kind === 'fmk' && slot.locked && !slot.reasons) {
        touchInteraction(session, interaction);
        return interaction.showModal(fmkModal(session, slot));
    }
    if (slot.locked) return privateResponse(interaction, 'Tes choix sont déjà verrouillés.');
    if (op === 'socialPick') {
        const value = interaction.values?.[0];
        if (!slot.cards.some(card => card.id === value) || slot.order.includes(value))
            return privateResponse(interaction, 'Cette carte est déjà placée ou indisponible.');
        slot.order.push(value);
    } else if (op === 'socialReset') slot.order = [];
    else if (op === 'socialLock' && slot.order.length === slot.cards.length) {
        slot.locked = true;
        touchInteraction(session, interaction);
        if (state.kind === 'fmk') return interaction.showModal(fmkModal(session, slot));
        await interaction.update(panelUpdate());
        if (socialAllReady(state)) await finishSocialChoices(session);
        else await renderSocialBoard(session);
        return;
    } else return privateResponse(interaction, 'Complète la liste avant de la verrouiller.');
    touchInteraction(session, interaction);
    return interaction.update(panelUpdate());
}

async function fmkChart(common, slots) {
    const canvas = createCanvas(1120, 690);
    const ctx = canvas.getContext('2d');
    await stage(ctx, canvas.width, canvas.height, { accent: '#ec4899' });

    drawGlassCard(ctx, 36, 18, canvas.width - 72, 64, { radius: 16, fill: 'rgba(14, 12, 26, 0.84)', border: 'rgba(236, 72, 153, 0.45)' });
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 30px "LemonMilk", "Sans"';
    ctx.fillStyle = '#fff7e9';
    ctx.fillText('FUCK  •  MARRY  •  KILL  —  RÉSULTATS', canvas.width / 2, 50);

    const lockedCount = [...slots.values()].filter(slot => slot.locked).length;
    const counts = common.map(card => ({
        card,
        values: FMK_LABELS.map((_, index) => [...slots.values()].filter(slot => slot.locked && slot.order[index] === card.id).length)
    }));
    const max = Math.max(1, ...counts.flatMap(item => item.values));
    const colors = ['#ec4899', '#34d399', '#a78bfa'];

    for (const [i, item] of counts.entries()) {
        const colX = 44 + i * 354;
        const colW = 324;
        const cx = colX + colW / 2;
        const theme = cardTheme(item.card);

        drawGlassCard(ctx, colX, 102, colW, 560, { radius: 20, fill: 'rgba(19, 15, 34, 0.82)', border: 'rgba(255, 255, 255, 0.14)' });
        await drawCard(ctx, item.card, cx - 64, 122, 128, 179, { glow: theme.glow, border: theme.hex, radius: 10 });

        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px "LemonMilk", "Sans"';
        ctx.fillText(cleanCanvasText(item.card.name), cx, 316, colW - 28);

        ctx.fillStyle = theme.hex;
        ctx.font = 'bold 13px "LemonMilk", "Sans"';
        ctx.fillText(cleanCanvasText('N° ' + item.card.numCode + ' • ' + item.card.rarity), cx, 344, colW - 28);

        for (const [j, value] of item.values.entries()) {
            const y = 390 + j * 82;
            const pct = lockedCount > 0 ? Math.round((value / lockedCount) * 100) : 0;
            const barW = colW - 56;
            const bx = colX + 28;

            ctx.textAlign = 'left';
            ctx.fillStyle = colors[j];
            ctx.font = 'bold 18px "LemonMilk", "Sans"';
            ctx.fillText(FMK_LABELS[j].toUpperCase(), bx, y);

            ctx.textAlign = 'right';
            ctx.fillStyle = '#fff7e9';
            ctx.font = 'bold 17px "LemonMilk", "Sans"';
            ctx.fillText(value + ' (' + pct + '%)', bx + barW, y);

            drawRoundRect(ctx, bx, y + 28, barW, 18, 9);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.10)';
            ctx.fill();

            if (value > 0) {
                const fillW = Math.max(18, (barW * value) / max);
                drawRoundRect(ctx, bx, y + 28, fillW, 18, 9);
                ctx.fillStyle = colors[j];
                ctx.fill();
            }
        }
    }

    return exportPng(canvas);
}

async function fmkPeopleCanvas(session, items, safe, pages) {
    const canvas = createCanvas(1120, 148 + 124 * Math.max(1, items.length));
    const ctx = canvas.getContext('2d');
    await stage(ctx, canvas.width, canvas.height, { accent: '#ec4899' });

    drawGlassCard(ctx, 36, 18, canvas.width - 72, 60, { radius: 16, fill: 'rgba(14, 12, 26, 0.84)', border: 'rgba(236, 72, 153, 0.4)' });
    ctx.fillStyle = '#fff7e9';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 26px "LemonMilk", "Sans"';
    ctx.fillText('FMK  •  CHOIX INDIVIDUELS  (' + (safe + 1) + '/' + pages + ')', canvas.width / 2, 48);

    const avatars = await Promise.all(items.map(([id]) => loadAvatar(session.people.get(id))));
    const badgeColors = ['#ec4899', '#34d399', '#a78bfa'];

    for (const [i, [id, slot]] of items.entries()) {
        const y = 104 + i * 124;
        const player = session.people.get(id);
        drawGlassCard(ctx, 44, y, canvas.width - 88, 108, {
            radius: 18,
            fill: 'rgba(22, 17, 39, 0.84)',
            border: slot.locked ? 'rgba(236, 72, 153, 0.35)' : 'rgba(255, 255, 255, 0.10)'
        });
        drawAvatar(ctx, avatars[i], player, 102, y + 54, 34, slot.locked ? '#ec4899' : '#64748b');

        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#fff7e9';
        ctx.font = 'bold 21px "LemonMilk", "Sans"';
        ctx.fillText(cleanCanvasText(player?.name || 'Participant·e'), 160, y + 18, 860);

        if (!slot.locked) {
            ctx.fillStyle = '#94a3b8';
            ctx.font = '19px Sans';
            ctx.fillText('Vote nul (non verrouillé à temps)', 160, y + 58);
        } else {
            for (const [j, label] of FMK_LABELS.entries()) {
                const card = slot.cards.find(item => item.id === slot.order[j]);
                const bx = 160 + j * 298;
                drawGlassCard(ctx, bx, y + 52, 282, 38, { radius: 10, fill: 'rgba(255, 255, 255, 0.06)', border: badgeColors[j] });
                ctx.fillStyle = badgeColors[j];
                ctx.font = 'bold 14px "LemonMilk", "Sans"';
                ctx.fillText(label.toUpperCase(), bx + 12, y + 63);
                ctx.fillStyle = '#ffffff';
                ctx.font = '17px Sans';
                ctx.fillText(cleanCanvasText(card?.name || '—'), bx + 78, y + 60, 194);
            }
        }
    }
    return exportPng(canvas);
}

async function gameResultPages(interaction, session, [rawLobby, rawPage]) {
    const lobby = Number(rawLobby);
    const result = session.fmkResults?.get(lobby);
    if (!result) return privateResponse(interaction, 'Ce résultat a expiré.');
    if (interaction.message.flags?.has(MessageFlags.Ephemeral)) await interaction.deferUpdate();
    else await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    touchInteraction(session, interaction);
    const items = [...result.slots];
    const pages = Math.max(1, Math.ceil(items.length / 4));
    const page = Math.max(0, Math.min(Number(rawPage) || 0, pages - 1));
    const selected = items.slice(page * 4, page * 4 + 4);
    const display = embed('💌 FMK · Choix des participant·es', gameColor('fmk'))
        .setDescription(selected.map(([id, slot]) =>
            '**' + escapeText(session.people.get(id)?.name || 'Participant·e') + '**\n' +
            (slot.locked ? socialLines({ kind: 'fmk' }, slot) : '*Vote nul*')).join('\n\n'))
        .setFooter({ text: 'Page ' + (page + 1) + '/' + pages });
    const canvas = await fmkPeopleCanvas(session, selected, page, pages).catch(error => {
        console.warn('[PLAY] Canvas FMK des choix :', error);
        return null;
    });
    if (canvas) display.setImage('attachment://fmk-choix.png');
    await interaction.editReply({
        embeds: [display], attachments: [], files: canvas ? [new AttachmentBuilder(canvas, { name: 'fmk-choix.png' })] : [],
        components: pages > 1 ? [row(
            button(controlId(session, 'pages', lobby, page - 1), 'Précédente', ButtonStyle.Secondary, '⬅️').setDisabled(!page),
            button(controlId(session, 'pages', lobby, page + 1), 'Suivante', ButtonStyle.Secondary, '➡️').setDisabled(page + 1 >= pages)
        )] : []
    });
}

async function publishFmk(session, state) {
    if (!session.fmkResults) session.fmkResults = new Map();
    session.fmkResults.set(session.lobbyId, { slots: state.slots });
    const common = state.slots.values().next().value.cards;
    const lines = common.map(card => '**' + escapeText(card.name) + '** — ' +
        ['💖', '💍', '💀'].map((icon, i) => icon + ' `' + [...state.slots.values()]
            .filter(slot => slot.locked && slot.order[i] === card.id).length + '`').join(' · '));
    const invalid = [...state.slots.values()].filter(slot => !slot.locked).length;
    const canvas = await fmkChart(common, state.slots).catch(error => { console.warn('[PLAY] Diagrammes FMK :', error); return null; });
    const result = embed('💌 FMK · Résultats du scrutin', gameColor('fmk'))
        .setAuthor({ name: 'RegaDex · Récapitulatif' })
        .setDescription(lines.join('\n') + (invalid ? '\n\n⚠️ `' + invalid + '` vote(s) nul(s).' : ''));
    if (canvas) result.setImage('attachment://fmk-resultats.png');
    await session.channel.send({
        ...silent({
            embeds: [result],
            files: canvas ? [new AttachmentBuilder(canvas, { name: 'fmk-resultats.png' })] : [],
            components: [row(button(controlId(session, 'pages', session.lobbyId, 0), 'Voir les choix individuels', ButtonStyle.Secondary, '👥'))]
        }),
        allowedMentions: { parse: [] }
    });
}

async function finishSocialChoices(session) {
    const state = session.state;
    gameStep(session, 'socialReveal');
    if (session.board) await editPlayMessage(session, session.board, { components: [] });
    await session.channel.send(silent({ embeds: [embed('📋 Sélection terminée', gameColor(session.game))
        .setDescription('Passage à la présentation des choix.')] })).catch(() => {});
    session.board = null;
    state.statusMessage = null;
    if (state.kind === 'fmk') await publishFmk(session, state);
    state.presenters = state.members.filter(id => state.slots.get(id).locked);
    if (!state.presenters.length) return finishGame(session, 'Personne n’a verrouillé ses choix à temps.');
    state.presentIndex = 0;
    await presentNext(session);
}

async function presentNext(session) {
    const state = session.state;
    const presenter = state.presenters[state.presentIndex++];
    if (!presenter) return socialFinalVote(session);
    if (session.board) await editPlayMessage(session, session.board, { components: [] });
    session.board = null;
    state.presenter = presenter;
    const slot = state.slots.get(presenter);
    gameStep(session, 'presenting');
    const choices = socialLines(state, slot);
    const ms = state.kind === 'fmk' ? 60_000 : 90_000;
    session.deadline = Date.now() + ms;
    let details = '';
    let attachment = null;
    if (state.kind === 'fmk') {
        const reasons = FMK_LABELS.map((_, index) => '**' + socialTag(state, index) + '** · ' +
            (slot.reasons?.[index] ? escapeText(slot.reasons[index]) : (slot.reasons ? '*Aucune justification*' : '*Temps écoulé*')));
        details = '\n' + SEP + '\n' + reasons.join('\n\n');
        if (details.length > 3300) {
            details = '\n' + SEP + '\n*Justifications complètes dans le fichier joint.*';
            const plain = FMK_LABELS.map((label, index) => label + ' · ' + (slot.reasons?.[index] || 'Aucune justification')).join('\n\n');
            const display = embed(gameTitle(session), gameColor(session.game))
                .setAuthor({ name: 'Présentation ' + state.presentIndex + '/' + state.presenters.length })
                .setDescription(playerRef(session, presenter) + '\n\n' + choices + details);
            const realPresenter = session.bots.has(presenter) ? [] : [presenter];
            const msgPayload = {
                embeds: [display],
                files: [new AttachmentBuilder(Buffer.from(plain), { name: 'justifications.txt' })],
                components: [row(
                    gameButton(session, 'presentDone', 'J’ai fini', ButtonStyle.Success, '', '✅'),
                    gameButton(session, 'presentPass', 'Passer', ButtonStyle.Secondary, '', '⏭️')
                )],
                allowedMentions: { parse: [], users: realPresenter }
            };
            if (realPresenter.length) msgPayload.content = playerRef(session, presenter);
            session.board = await session.channel.send(realPresenter.length ? msgPayload : silent(msgPayload));
            phaseTimer(session, ms, () => presentNext(session));
            return;
        }
    } else {
        const name = session.people.get(presenter)?.name || 'CLASSEMENT';
        const art = await drawVoteCards(slot.order.map(id => slot.cards.find(card => card.id === id)), {
            header: 'CLASSEMENT DE ' + name.toUpperCase(),
            cardW: 196,
            numbered: true,
            accent: '#1abc9c'
        }).catch(error => { console.warn('[PLAY] Cartes présentées :', error); return null; });
        if (art) attachment = new AttachmentBuilder(art, { name: 'classement.png' });
    }
    await gameBoard(
        session,
        '🎙️ **Présentation ' + state.presentIndex + '/' + state.presenters.length + '** — ' + playerRef(session, presenter) + '\n' + SEP + '\n' +
        choices + details +
        (state.kind === 'classement' ? '\n\nDéfends ton classement avant ' + expiry(session.deadline) + ' !' : '\n\nSuite ' + expiry(session.deadline)),
        [row(
            gameButton(session, 'presentDone', 'J’ai fini', ButtonStyle.Success, '', '✅'),
            gameButton(session, 'presentPass', 'Passer', ButtonStyle.Secondary, '', '⏭️')
        )],
        attachment,
        [presenter]
    );
    phaseTimer(session, ms, () => presentNext(session));
}

async function socialFinalVote(session) {
    const state = session.state;
    const ids = state.kind === 'fmk' ? state.presenters.filter(id => state.slots.get(id).reasons?.some(Boolean)) : state.presenters;
    if (!ids.length) return finishGame(session, 'Merci d’avoir joué ! Aucune justification à départager.');
    const voters = await sessionVoters(session);
    if (!voters.size) return finishGame(session, 'Les présentations sont terminées.');
    const title = state.kind === 'fmk' ? '💌 Meilleure justification FMK' : '📋 Meilleur classement défendu';
    if (session.board) await editPlayMessage(session, session.board, { components: [] });
    session.board = null;
    await openBallot(session, {
        title,
        description: 'Votez pour la prestation la plus drôle ou la mieux argumentée.',
        voters,
        options: ids.map(value => ({ value, label: session.people.get(value)?.name || 'Participant·e', emoji: state.kind === 'fmk' ? '💌' : '📋' })),
        choose: async (leaders, votes) => {
            if (session.board) await editPlayMessage(session, session.board, { components: [] });
            session.board = null;
            const poster = leaders.length
                ? await (state.kind === 'fmk'
                    ? fmkVictoryCanvas(session, leaders, votes)
                    : rankingVictoryCanvas(session, leaders, votes)
                ).catch(error => {
                    console.warn('[PLAY] Canvas victoire social :', error);
                    return null;
                })
                : null;
            const attachment = poster ? new AttachmentBuilder(poster, { name: 'victoire.jpg' }) : null;
            if (leaders.length) await rewardMinigameWinners(session, leaders);
            return finishGame(
                session,
                leaders.length
                    ? (leaders.length > 1 ? '🤝 **Ex æquo** : ' : '🏆 **Victoire de** ') + leaders.map(id => playerRef(session, id)).join(', ') + ' !'
                    : 'Aucun vote enregistré. Merci d’avoir joué !',
                attachment
            );
        }
    });
}

function touchInteraction() {}

async function gameInteraction(interaction, session, [lobby, revision, op, argument]) {
    if (session.stopVoteActive) return privateResponse(interaction, '⏸️ La partie est en pause pendant le vote d’arrêt (`!stop`).');
    const state = session.state;
    if (!state || session.phase !== 'game' || session.lobbyId !== Number(lobby) || state.revision !== Number(revision) ||
        (session.deadline > 0 && Date.now() >= session.deadline)) return privateResponse(interaction, 'Cette action a expiré.');
    if (session.game === 'devine') return devineAction(interaction, session, op, argument);
    if (session.game === 'casting') return castingAction(interaction, session, op);
    if (session.game === 'classement' || session.game === 'fmk') return socialAction(interaction, session, op);
    return privateResponse(interaction, 'Cette action n’est pas disponible.');
}

function playerRef(session, id) {
    const bot = session.bots.get(id);
    return bot ? '**' + escapeText(bot.name) + '**' : '<@' + id + '>';
}

function playCardsFor(session, id) {
    if (!session.test) return getPlayCards(id);
    return getPlayCatalog().map(card => ({ ...card, setLabel: cardSetLabel(card) }));
}

function settingsPayload(session, invites = false) {
    const view = embed('⚙️ Paramètres du test', gameColor(session.game)).setDescription(session.test
        ? 'Les adversaires sont simulés. Le chronomètre de cette étape peut être avancé pour tester la suivante.'
        : '**Accès :** ' + (session.invited ? '🎟️ Sur invitation' : '🌐 Ouvert') + ' · **Arrivées en cours :** ' + (session.allowLate ? '✅ Ouvertes' : '🔒 Fermées') +
        '\nLes personnes qui arrivent en cours de jeu entrent à la manche suivante.');
    const current = session.advancePhase && session.deadline > Date.now();
    if (session.test) {
        return {
            embeds: [view],
            components: [row(button(controlId(session, 'skipClock', session.lobbyId, session.timerRevision), 'Avancer le chrono', ButtonStyle.Primary, '⏩').setDisabled(!current))]
        };
    }
    const components = [row(
        button(controlId(session, 'settingsLate', session.lobbyId), session.allowLate ? 'Fermer les arrivées' : 'Ouvrir les arrivées', ButtonStyle.Secondary, '🔓'),
        button(controlId(session, 'settingsInvite', session.lobbyId), 'Ajouter des invités', ButtonStyle.Primary, '🎟️').setDisabled(!session.invited)
    )];
    if (invites) components.push(row(new UserSelectMenuBuilder().setCustomId(controlId(session, 'settingsUsers', session.lobbyId))
        .setPlaceholder('Ajouter des membres à la liste des invités').setMaxValues(25)));
    return { embeds: [view], components };
}

async function sessionSettings(interaction, session, action, parts) {
    if (interaction.user.id !== session.host) return privateResponse(interaction, 'Ces réglages sont réservés à l’hôte.');
    if (action === 'settings') {
        touchInteraction(session, interaction);
        return interaction.reply({ ...settingsPayload(session), flags: MessageFlags.Ephemeral });
    }
    if (action === 'skipClock') {
        if (!session.test || session.timerRevision !== Number(parts[1]) || session.deadline <= Date.now() || !session.advancePhase)
            return privateResponse(interaction, 'Ce chrono a déjà changé. Rouvre les paramètres pour voir le chrono actuel.');
        const advance = session.advancePhase;
        clearTimeout(session.timer);
        clearTimeout(session.botTimer);
        session.timerRevision++;
        touchInteraction(session, interaction);
        await interaction.update({ embeds: [embed('⚙️ Paramètres du test', gameColor(session.game)).setDescription('⏩ Chrono de test avancé.')], components: [] });
        return advance();
    }
    if (session.test) return privateResponse(interaction, 'Ces réglages sont réservés aux parties publiques.');
    touchInteraction(session, interaction);
    if (action === 'settingsLate') {
        session.allowLate = !session.allowLate;
        await interaction.update(settingsPayload(session));
        return updateLobby(session);
    }
    if (!session.invited) return privateResponse(interaction, 'Tout le salon peut rejoindre cette partie.');
    if (action === 'settingsInvite') return interaction.update(settingsPayload(session, true));
    if (action === 'settingsUsers') {
        for (const id of interaction.values) {
            session.invited.add(id);
            session.optedOut.delete(id);
        }
        await interaction.update(settingsPayload(session));
        return updateLobby(session);
    }
}

function mockInteraction(session, id, values = [], fields = {}) {
    const noop = async () => {};
    return {
        user: { id, username: session.bots.get(id).name, displayAvatarURL: () => null },
        client: session.channel.client, values, fields: { getTextInputValue: key => fields[key] ?? '' },
        reply: noop, update: noop, deferUpdate: noop, deferReply: noop, editReply: noop, showModal: noop
    };
}

function scheduleTestBots(session, revision, ms) {
    const delay = Math.min(Math.max(1, ms - 50), 900 + randomInt(1101));
    session.botTimer = setTimeout(() => {
        void enqueue(session, async () => {
            if (sessions.get(session.channel.id) !== session || session.timerRevision !== revision || session.phase === 'closed') return;
            await runTestBots(session, revision);
        }).catch(error => recoverSession(session, error));
    }, delay);
    session.botTimer.unref();
}

const BOT_REASONS = [
    'Le dossier est solide.',
    'Toute la salle avait déjà deviné.',
    'Ça répond à la question sans vraiment y répondre.',
    'Il fallait trancher.',
    'La carte a gagné au premier regard.',
    'Ce choix fait plus de sens dans ma tête.'
];
const botReason = () => BOT_REASONS[randomInt(BOT_REASONS.length)];

async function runTestBots(session, revision) {
    for (const id of shuffled(session.bots.keys())) {
        if (session.timerRevision !== revision || session.phase === 'closed') break;
        if (session.players.has(id)) await runTestBot(session, id);
    }
}

async function runTestBot(session, id) {
    const interaction = mockInteraction(session, id);
    if (session.phase === 'ballot') {
        const ballot = session.ballot;
        if (!ballot.voters.has(id)) return;
        const option = shuffled(ballot.options)[0];
        return voteBallot(mockInteraction(session, id, [option.value]), session, [ballot.id]);
    }
    if (session.phase === 'pick' && session.roundPlayers.has(id) && !session.answers.has(id)) {
        const cards = shuffled(playCardsFor(session, id)).slice(0, session.holes).map(card => card.id);
        session.drafts.set(id, { cards, page: 0, query: '' });
        return pickInteraction(interaction, session, 'lock', [session.lobbyId, session.round, id]);
    }
    if (session.phase === 'rating') {
        const ratings = RATINGS.filter(([key]) => key !== 'love' || !session.loveUsed.has(id));
        return rateResponse(interaction, session, [session.lobbyId, session.round, session.voteIndex, shuffled(ratings)[0][0]]);
    }
    if (session.phase === 'continue') {
        return sessionInteraction(interaction, session, 'yes', [session.lobbyId]);
    }
    if (session.phase !== 'game' || !session.state) return;
    const state = session.state;
    switch (state.step) {
        case 'guess': {
            const target = state.cards[state.index];
            const guess = randomInt(6) <= state.zoom ? target : shuffled(getPlayCatalog().filter(card => card.id !== target.id))[0];
            if (!guess) return;
            await session.channel.send({
                content: '🤖 **' + escapeText(session.bots.get(id).name) + '** propose **' + escapeText(guess.name) + '**.',
                allowedMentions: { parse: [] }
            });
            return cavaleGuess(session, { author: { id }, content: guess.name });
        }
        case 'volunteer': return devineAction(interaction, session, 'volunteer');
        case 'mjReady': if (state.mj === id) return devineAction(interaction, session, 'secret'); break;
        case 'waitingMJ': if (state.mj === id) return devineAction(interaction, session, 'answer', randomInt(2) ? 'yes' : 'no'); break;
        case 'stopVote': if (state.mj !== id) return devineAction(interaction, session, 'stop'); break;
        case 'turn':
            if (state.current === id) {
                const player = state.investigators.get(id);
                if (player.left && randomInt(5) > 0) {
                    const query = shuffled([
                        'La carte est-elle légendaire ?',
                        'Son numéro est-il supérieur à 50 ?',
                        'Le nom contient-il plusieurs mots ?',
                        'Est-ce une carte du premier set ?'
                    ])[0];
                    return devineAction(mockInteraction(session, id, [], { text: query }), session, 'question');
                }
                return devineAction(interaction, session, 'pass');
            }
            break;
        case 'finalGuess':
            if (state.investigators.has(id)) {
                const card = randomInt(4) === 0 ? state.card : shuffled(getPlayCatalog().filter(card => card.id !== state.card.id))[0];
                if (card) return devineAction(mockInteraction(session, id, [], { text: card.name }), session, 'guessSubmit');
            }
            break;
        case 'castVolunteer': return castingAction(interaction, session, 'castVolunteer');
        case 'castPrompt':
            if (state.writer === id) return castingAction(mockInteraction(session, id, [], { text: shuffled(CASTING_QUESTIONS)[0] }), session, 'castPrompt');
            break;
        case 'castCards':
            if (state.slots.has(id) && !state.slots.get(id).locked) {
                const rerolls = randomInt(4);
                for (let i = 0; i < rerolls; i++) await castingAction(interaction, session, 'castReroll');
                return castingAction(interaction, session, 'castLock');
            }
            break;
        case 'castDebate':
            if (state.slots.has(id)) await session.channel.send({
                content: '🤖 **' + escapeText(session.bots.get(id).name) + '** défend **' +
                    escapeText(state.slots.get(id).card.name) + '** : ' + botReason(),
                allowedMentions: { parse: [] }
            });
            break;
        case 'rankWrite':
            if (state.writer === id) return socialAction(mockInteraction(session, id, [], { text: shuffled(RANKING_PROMPTS)[0] }), session, 'rankPrompt');
            break;
        case 'socialChoices': {
            const slot = state.slots.get(id);
            if (!slot || slot.locked) break;
            slot.order = shuffled(slot.cards).map(card => card.id);
            await socialAction(interaction, session, 'socialLock');
            if (state.kind === 'fmk') {
                const fields = Object.fromEntries(FMK_LABELS.map((_, i) => ['why' + i, botReason()]));
                await socialAction(mockInteraction(session, id, [], fields), session, 'fmkReasons');
            }
            break;
        }
        case 'presenting':
            if (state.presenter === id) {
                if (state.kind === 'classement') {
                    await session.channel.send({
                        content: '🤖 **' + escapeText(session.bots.get(id).name) + '** : ' + botReason(),
                        allowedMentions: { parse: [] }
                    });
                }
                return socialAction(interaction, session, 'presentDone');
            }
            break;
    }
}

module.exports = { handlePlayMessage, handlePlayInteraction, startPlayScheduler };