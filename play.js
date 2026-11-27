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
const { getPlayCards, getPlayCatalog, renderPlayBinder } = require('./tcg.js');

const PLAY_CHANNEL_ID = '1575601558458994758';
const PLAY_TEST_CHANNEL_ID = '1480756332373213275';
const PLAY_TEST_OWNER_ID = '436218312574107658';
const TEST_NAMES = ['Moka', 'Pixel', 'Biscotte'];
const STATE_PATH = process.env.REGADEX_PLAY_STATE_PATH || path.join(__dirname, '.play-threads.json');
const IDLE_MS = 15 * 60_000;
const JOIN_MS = 30_000;
const PICK_MS = 90_000;
const RATE_MS = 10_000;
const CONTINUE_MS = 60_000;
const ROUND_COUNT = 5;
const COLOR = 0x7955bf;
const RATINGS = [
    ['like', 'J’aime', 50, ButtonStyle.Success],
    ['meh', 'Meh', 0, ButtonStyle.Secondary],
    ['no', 'Pas drôle', -50, ButtonStyle.Danger],
    ['love', 'J’adore !', 100, ButtonStyle.Primary]
];
const GUIDES = {
    vitrine: ['Vitrine à thème', 'Complète la phrase avec 1 ou 2 cartes de ton classeur.', '🎭',
        'Cinq manches. Cherche les cartes possédées par nom ou numéro dans les 90 secondes. Les réponses sont anonymes et défilent dix secondes chacune. Une note par réponse des autres. Sans vote, elle vaut Meh. J’adore ! s’utilise une fois sur les cinq manches.'],
    cavale: ['Cartes en cavale', 'Reconnais les illustrations à partir de détails zoomés.', '🔍',
        'Écris le nom dans le fil. Les petites fautes sont acceptées si le nom reste reconnaissable. L’image dézoome un peu chaque minute. Première bonne réponse gagnante, révélation au bout de cinq minutes maximum. Cinq cartes par partie.'],
    casting: ['Casting de l’enfer', 'Défends ton candidat dans un débat de cinq minutes.', '🎙️',
        'Deux volontaires tirés au sort, ou un duel à deux. Chacun peut changer de carte trois fois en privé avant de la verrouiller. Les cartes sont révélées ensemble. Le public vote à la fin du débat. En duel, les deux personnes votent.'],
    devine: ['Devine-carte', 'Enquête à tour de rôle avec les réponses Oui ou Non du MJ.', '🕵️',
        'Le MJ est tiré parmi les volontaires. Tu peux poser une question, proposer une carte en privé ou passer sans dépenser ton quota. Après deux tours expirés, tu peux revenir avec Reprendre ma place. Une dernière minute de réponses s’ouvre quand les questions sont épuisées.'],
    classement: ['Le Classement impossible', 'Classe quatre cartes et défends ton choix devant la classe.', '📋',
        'Les inscrits votent pour un tirage commun ou individuel. Tout le monde reçoit la même consigne. Verrouille ta liste en privé, puis présente-la à ton tour. Le salon vote pour le classement le mieux défendu ou le plus drôle.'],
    fmk: ['Fuck, Marry, Kill', 'Trois cartes communes et un choix par carte.', '💌',
        'Place les trois cartes en privé, verrouille le trio puis explique chaque choix. Tu as quatre minutes. Un trio verrouillé compte même sans justification. Après les résultats, le salon vote pour la meilleure justification.']
};
const MIN_PLAYERS = { vitrine: 2, cavale: 1, casting: 2, devine: 2, classement: 1, fmk: 1 };
const PROMPTS = [
    'Cacabot a été remplacé par ___ pendant son congé maladie.',
    'Le serveur allait bien, jusqu’au jour où ___ est devenu modo.',
    'Pour entrer à Regaïa, il faut apporter ___.',
    'La dernière chose qu’on a retrouvée dans les sauvegardes : ___.',
    'La commu a demandé un nouveau set. Cacabot a livré ___.',
    'La raison officielle du retard du prochain booster : ___.',
    'Dans la prochaine mise à jour, ___ sera responsable du support.',
    '___ et ___ ont décidé de refaire tout le serveur à 4 h du matin.',
    'Le duo le moins crédible pour sauver Regaïa : ___ et ___.',
    'J’ai demandé de l’aide à ___ et quelqu’un m’a envoyé ___.',
    '___ partage désormais sa chambre avec ___.',
    'Le premier débat de la soirée oppose ___ à ___.'
];

const menus = new Map();
const sessions = new Map();
const threadRecords = new Map();
let recordsReady = false;

const escapeText = text => String(text).replace(/[\\`*_~|<>]/g, '\\$&');
const normalize = text => String(text).normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase();
const cut = (text, size) => String(text).slice(0, size).replace(/[\uD800-\uDBFF]$/, '');
const expiry = time => '<t:' + Math.ceil(time / 1000) + ':R>';
const idFor = (...parts) => ['play', ...parts].join(':');
const row = (...components) => new ActionRowBuilder().addComponents(components);
const button = (id, label, style = ButtonStyle.Secondary) =>
    new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
const embed = title => new EmbedBuilder().setColor(COLOR).setTitle(title);
const privateResponse = (interaction, content) => interaction.reply({ content, flags: MessageFlags.Ephemeral });

function saveThreadRecords() {
    fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
    const temp = STATE_PATH + '.tmp';
    const data = [...threadRecords.values()].map(({ id, parentId, lastActivity, slowmode }) => ({ id, parentId, lastActivity, slowmode }));
    fs.writeFileSync(temp, JSON.stringify(data), { mode: 0o600 });
    fs.renameSync(temp, STATE_PATH);
}

function scheduleCleanup(record, client, delay = Math.max(1, record.lastActivity + IDLE_MS - Date.now())) {
    clearTimeout(record.timer);
    record.timer = setTimeout(() => {
        const session = sessions.get(record.id);
        const cleanup = () => deleteIdleThread(record, client);
        void (session ? enqueue(session, cleanup) : cleanup())
            .catch(error => {
                console.error('[PLAY] Nettoyage du fil :', error);
                if (threadRecords.has(record.id)) scheduleCleanup(record, client, 60_000);
            });
    }, delay);
    record.timer.unref();
}

function persistRecordActivity(record, client) {
    record.lastActivity = Date.now();
    scheduleCleanup(record, client);
    try { saveThreadRecords(); } catch (error) { console.error('[PLAY] Persistances des fils :', error); }
}

async function deleteIdleThread(record, client) {
    if (!threadRecords.has(record.id)) return;
    if (Date.now() - record.lastActivity < IDLE_MS) {
        scheduleCleanup(record, client);
        return;
    }
    let thread;
    try {
        thread = await client.channels.fetch(record.id, { force: true });
    } catch (error) {
        if (error.code !== 10003) throw error;
    }
    if (Date.now() - record.lastActivity < IDLE_MS) {
        scheduleCleanup(record, client);
        return;
    }
    if (thread?.isThread() && thread.parentId === record.parentId && thread.ownerId === client.user.id) {
        await thread.delete('Mini-jeu RegaDex inactif depuis 15 minutes').catch(error => {
            if (error.code !== 10003) throw error;
        });
    }
    const session = sessions.get(record.id);
    if (session) {
        clearTimeout(session.timer);
        clearTimeout(session.botTimer);
    }
    sessions.delete(record.id);
    threadRecords.delete(record.id);
    saveThreadRecords();
}

async function restorePlayThreads(client) {
    try {
        const saved = fs.existsSync(STATE_PATH) ? JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')) : [];
        for (const item of saved) {
            if (!/^\d{17,22}$/.test(item.id) || !Number.isFinite(item.lastActivity)) continue;
            const parentId = item.parentId || PLAY_CHANNEL_ID;
            if (![PLAY_CHANNEL_ID, PLAY_TEST_CHANNEL_ID].includes(parentId)) continue;
            const record = { ...item, parentId, timer: null };
            threadRecords.set(record.id, record);
            scheduleCleanup(record, client);
            if (Number.isInteger(record.slowmode) && record.slowmode >= 0 && record.slowmode <= 21_600) {
                try {
                    const thread = await client.channels.fetch(record.id, { force: true });
                    if (thread?.isThread() && thread.parentId === record.parentId && thread.ownerId === client.user.id) {
                        await thread.setRateLimitPerUser(record.slowmode, 'Reprise après redémarrage de Cacabot');
                    }
                    record.slowmode = null;
                } catch (error) {
                    console.warn('[PLAY] Restauration du mode lent :', error);
                }
            }
        }
        if (saved.length) saveThreadRecords();
        recordsReady = true;
    } catch (error) {
        console.error('[PLAY] Lecture du registre des fils :', error);
    }
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
            if (sessions.get(session.thread.id) === session && session.timerRevision === revision && session.phase !== 'closed') {
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
    const main = embed(menu.test ? '🧪 Mini-jeux RegaDex · Mode test' : 'Mini-jeux RegaDex');
    const select = new StringSelectMenuBuilder().setCustomId(idFor(guide ? 'guidegame' : 'game', menu.id));
    if (guide) {
        const current = GUIDES[guide];
        main.setAuthor({ name: 'RegaDex · Guide des mini-jeux' })
            .setDescription(current ? '**' + current[2] + ' ' + current[0] + '**\n\n' + current[3] : 'Choisis un mini-jeu pour lire ses règles.');
        select.setPlaceholder('Quel guide veux-tu lire ?').addOptions(Object.entries(GUIDES).map(([value, [label, , emoji]]) => ({ label, value, emoji })));
        return { embeds: [main], components: [row(select), row(button(idFor('menu', menu.id), 'Retour'))] };
    }
    main.setAuthor({ name: 'RegaDex · Salon de jeu' })
        .setDescription(menu.test ? 'Choisis un jeu, puis ajoute **1 à 3 adversaires simulés**. Les cartes et décisions des bots sont tirées au hasard.' :
            'Choisis un jeu ci-dessous. Cacabot ouvre un fil et laisse **30 secondes** pour rejoindre.')
        .addFields(Object.values(GUIDES).map(([name, value, icon]) => ({ name: icon + ' ' + name, value, inline: true })))
        .setFooter({ text: 'Parties ouvertes ou sur invitation · Vote pour le prochain jeu en fin de partie' });
    select.setPlaceholder('Choisir un mini-jeu').addOptions(Object.entries(GUIDES).map(([value, [label, description, emoji]]) => ({ label, value, description, emoji })));
    return { embeds: [main], components: [row(select), row(button(idFor('guide', menu.id), 'Guide'))] };
}

function launchMenu(menu) {
    const [name, description, icon] = GUIDES[menu.game];
    if (menu.test) return { embeds: [embed(icon + ' ' + name + ' · Test').setDescription(description)
        .addFields({ name: 'Mode test', value: 'Choisis le nombre de bots. Tu joues normalement et tu peux avancer le chrono depuis les paramètres du fil.' })],
        components: [row(new StringSelectMenuBuilder().setCustomId(idFor('bots', menu.id)).setPlaceholder('Nombre de bots')
            .addOptions(TEST_NAMES.map((_, i) => ({ label: String(i + 1) + ' bot(s)', value: String(i + 1) })))),
        row(button(idFor('menu', menu.id), 'Retour'))] };
    const preview = embed(icon + ' ' + name).setDescription(description + '\n\nLe fil est public. Choisis qui peut participer.')
        .addFields(
            { name: 'Ouvert', value: 'Les membres du salon peuvent s’inscrire.', inline: true },
            { name: 'Sur invitation', value: 'Seuls les membres sélectionnés peuvent jouer.', inline: true }
        ).setFooter({ text: '30 secondes d’inscription par partie' });
    return { embeds: [preview], components: [
        row(button(idFor('open', menu.id), 'Ouvert', ButtonStyle.Primary), button(idFor('invite', menu.id), 'Sur invitation')),
        row(button(idFor('menu', menu.id), 'Retour'))
    ] };
}

async function handlePlayMessage(message) {
    if (message.author.bot) return false;
    const record = threadRecords.get(message.channelId);
    if (record) persistRecordActivity(record, message.client);
    const session = sessions.get(message.channelId);
    if (session?.game === 'cavale' && session.phase === 'game' && session.state?.step === 'guess' &&
        session.players.has(message.author.id) && !message.content.trim().startsWith('!')) {
        return enqueue(session, () => cavaleGuess(session, message)).catch(async error => {
            await recoverSession(session, error);
            return true;
        });
    }
    const test = /^!playx$/i.test(message.content.trim());
    if (test && (message.channelId !== PLAY_TEST_CHANNEL_ID || message.author.id !== PLAY_TEST_OWNER_ID)) return false;
    if (!test && (message.channelId !== PLAY_CHANNEL_ID || !/^!play$/i.test(message.content.trim()))) return false;
    if (!recordsReady) {
        await message.reply({ content: 'Les mini-jeux sont en cours de chargement.', allowedMentions: { repliedUser: false } });
        return true;
    }
    const menu = { id: message.id, owner: message.author.id, channelId: message.channelId, test, launching: false, expires: Date.now() + IDLE_MS };
    const reply = await message.reply({ ...chooseGameMenu(menu), allowedMentions: { repliedUser: false } });
    menu.messageId = reply.id;
    menus.set(menu.id, menu);
    setTimeout(() => menus.delete(menu.id), IDLE_MS).unref();
    return true;
}

function readPlayer(interaction) {
    return { id: interaction.user.id, name: interaction.member?.displayName || interaction.user.globalName || interaction.user.username,
        avatar: interaction.user.displayAvatarURL({ extension: 'png', size: 128 }) };
}

async function createSession(interaction, menu, invited = null, botCount = 0) {
    menu.launching = true;
    try {
        await interaction.deferUpdate();
        const thread = await interaction.message.startThread({
            name: (menu.test ? 'Test · ' : '') + GUIDES[menu.game][0] + ' · ' + cut(readPlayer(interaction).name, 55),
            autoArchiveDuration: 60,
            reason: menu.test ? 'Mini-jeu créé via !playx' : 'Mini-jeu créé via !play'
        });
        const record = { id: thread.id, parentId: menu.channelId, lastActivity: Date.now(), slowmode: null, timer: null };
        threadRecords.set(thread.id, record);
        scheduleCleanup(record, thread.client);
        saveThreadRecords();
        if (thread.members.add) await thread.members.add(menu.owner).catch(error => console.warn('[PLAY] Inscription de l’hôte :', error));

        const hostPlayer = readPlayer(interaction);
        const bots = new Map(TEST_NAMES.slice(0, botCount).map((name, i) => ['bot-' + i, { id: 'bot-' + i, name: name + ' [bot]' }]));
        const session = {
            thread, record, host: menu.owner, game: menu.game, invited, test: menu.test, bots, allowLate: false, queue: Promise.resolve(),
            players: new Map([[menu.owner, hostPlayer], ...bots]), people: new Map([[menu.owner, hostPlayer], ...bots]), pending: new Map(),
            optedOut: new Set(), results: new Map(), timer: null, round: 0
        };
        sessions.set(thread.id, session);
        try {
            await openLobby(session);
        } catch (error) {
            await recoverSession(session, error);
            throw error;
        }
        menus.delete(menu.id);
        const [name, summary, icon] = GUIDES[session.game];
        await interaction.editReply({ embeds: [embed(icon + ' ' + name + ' · Fil ouvert')
            .setDescription(summary + '\n\n**Fil de jeu** · <#' + thread.id + '>')
            .addFields({ name: 'Dans le fil', value: session.test ?
                'Epsys et ' + bots.size + ' bot(s) simulé(s). Le premier message explique le jeu et donne accès au réglage du chrono.' :
                '**Rejoindre** t’inscrit en 30 secondes. Le premier message du fil contient les règles et les réglages de l’hôte.' })],
            components: [row(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Ouvrir le fil')
                .setURL('https://discord.com/channels/' + thread.guildId + '/' + thread.id))] });
    } finally {
        menu.launching = false;
    }
}

function editThreadMessage(session, message, payload) {
    // Message#edit looks up the channel again. The game's thread manager already has the channel ID.
    return session.thread.messages.edit(message.id, payload);
}

function controlId(session, action, ...rest) {
    return idFor(action, session.thread.id, ...rest);
}

function sessionButtons(session, joinLabel = 'Rejoindre') {
    return row(
        button(controlId(session, 'join', session.lobbyId), joinLabel, ButtonStyle.Primary).setDisabled(session.test || (session.phase !== 'lobby' && !session.allowLate)),
        button(controlId(session, 'late', session.lobbyId), 'Arrivées en cours : ' + (session.allowLate ? 'ouvertes' : 'fermées')).setDisabled(session.test),
        button(controlId(session, 'settings', session.lobbyId), 'Paramètres du fil'),
        button(controlId(session, 'cancel', session.lobbyId), 'Annuler', ButtonStyle.Danger)
    );
}

function lobbyPayload(session) {
    const [name, summary, icon, guide] = GUIDES[session.game];
    return { embeds: [embed(icon + ' ' + name + ' · Inscriptions')
        .setAuthor({ name: session.test ? 'RegaDex · Partie de test' : 'RegaDex · Salon de jeu' })
        .setDescription(summary + '\n\n**' + session.players.size + '** inscrit·es · ' +
            (session.test ? session.bots.size + ' bot(s) simulé(s)' : session.invited ? 'Sur invitation' : 'Inscriptions ouvertes') +
            ' · Début ' + expiry(session.deadline))
        .addFields(
            { name: 'Comment jouer', value: guide },
            { name: 'À quoi servent les boutons ?', value: session.test ?
                '**Paramètres du fil** permet d’avancer le chrono de test. **Annuler** ferme la partie.' :
                '**Rejoindre** t’inscrit. **Arrivées en cours** change l’accès après le départ. **Paramètres du fil** gère les invitations. **Annuler** ferme la partie.' }
        ).setFooter({ text: '30 secondes d’inscription · Les réglages du fil sont réservés à l’hôte' })],
        components: [sessionButtons(session)] };
}

async function openLobby(session) {
    if (session.lobby) await editThreadMessage(session, session.lobby, { components: [] });
    for (const [id, player] of session.pending) session.players.set(id, player);
    session.pending.clear();
    session.phase = 'lobby';
    session.board = null;
    session.state = null;
    session.ballot = null;
    session.lobbyId = (session.lobbyId || 0) + 1;
    session.round = 0;
    session.scores = new Map();
    session.loveUsed = new Set();
    session.best = [];
    session.prompts = shuffled(PROMPTS);
    session.usedPrompts = new Set();
    session.deadline = Date.now() + JOIN_MS;
    session.lobby = await session.thread.send(lobbyPayload(session));
    phaseTimer(session, Math.max(1, session.deadline - Date.now()), () => startSelectedGame(session));
}

async function updateLobby(session) {
    if (session.phase === 'lobby') await editThreadMessage(session, session.lobby, lobbyPayload(session));
    else if (session.phase !== 'closed') {
        await editThreadMessage(session, session.lobby, {
            embeds: [embed(GUIDES[session.game][0] + ' · Partie en cours').setDescription(GUIDES[session.game][3])
                .addFields({ name: 'Rejoindre et paramétrer le fil', value: session.test ?
                    '**Paramètres du fil** permet à Epsys d’avancer le chrono. **Annuler** met fin au test.' :
                    '**Rejoindre** te place à la manche suivante si les arrivées sont ouvertes. **Paramètres du fil** gère les invitations et les arrivées.' })],
            components: [sessionButtons(session, 'Rejoindre la prochaine manche')]
        });
    }
}

function pickPayload(session) {
    return { embeds: [embed('Vitrine à thème · Manche ' + session.round + '/' + ROUND_COUNT)
        .setDescription('**' + session.prompt + '**\n\n' + session.holes + ' carte(s) à choisir · ' +
            session.answers.size + '/' + session.roundPlayers.size + ' réponses · Fin ' + expiry(session.deadline))
        .addFields({ name: 'Préparer ta réponse', value: '**Choisir ma réponse** cherche par nom ou numéro. **Classeur** ouvre le catalogue complet en privé pour t’inspirer.' })],
    components: [row(button(controlId(session, 'pick', session.lobbyId, session.round), 'Choisir ma réponse', ButtonStyle.Primary),
        button(controlId(session, 'binder'), 'Classeur'))] };
}

async function startRound(session) {
    for (const [id, player] of session.pending) session.players.set(id, player);
    session.pending.clear();
    const starting = session.round === 0;
    session.round++;
    const cardCounts = new Map([...session.players.keys()].map(id => [id, playCardsFor(session, id).length]));
    const canPlayTwo = [...cardCounts.values()].filter(count => count >= 2).length >= 2;
    session.prompt = session.prompts.find(prompt => !session.usedPrompts.has(prompt) &&
        (canPlayTwo || !prompt.includes('___', prompt.indexOf('___') + 3)));
    session.usedPrompts.add(session.prompt);
    session.holes = session.prompt.match(/___/g).length;
    session.roundPlayers = new Set([...cardCounts].filter(([, count]) => count >= session.holes).map(([id]) => id));
    if (session.roundPlayers.size < 2) {
        await closeSession(session, 'Il faut au moins deux joueurs avec assez de cartes pour cette manche.');
        return;
    }
    session.phase = 'pick';
    session.answers = new Map();
    session.drafts = new Map();
    session.deadline = Date.now() + PICK_MS;
    if (starting) await updateLobby(session);
    session.board = await session.thread.send(pickPayload(session));
    phaseTimer(session, Math.max(1, session.deadline - Date.now()), () => startRatings(session));
}

function searchModal(session, player, draft) {
    const query = new TextInputBuilder().setCustomId('query').setLabel('Nom ou numéro de la carte')
        .setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(100);
    if (draft.query) query.setValue(cut(draft.query, 100));
    return new ModalBuilder().setCustomId(controlId(session, 'search', session.lobbyId, session.round, player))
        .setTitle('Chercher une carte').addComponents(row(query));
}

function playingCards(session, player, draft) {
    const query = normalize(draft.query);
    const prefix = [];
    const other = [];
    for (const card of playCardsFor(session, player)) {
        if (draft.cards.includes(card.id)) continue;
        const name = normalize(card.name);
        if (!query || name.startsWith(query) || normalize(card.numCode) === query || normalize(card.id) === query) prefix.push(card);
        else if (name.includes(query)) other.push(card);
    }
    return [...prefix, ...other];
}

function completePhrase(phrase, cards) {
    let index = 0;
    return phrase.replace(/___/g, () => cards[index++]?.name || '___');
}

function draftPayload(session, user, draft) {
    const cards = draft.cards.map(id => playCardsFor(session, user).find(c => c.id === id)).filter(Boolean);
    const key = [session.lobbyId, session.round, user];
    const available = playingCards(session, user, draft);
    const pages = Math.max(1, Math.ceil(available.length / 25));
    draft.page = Math.min(Math.max(draft.page, 0), pages - 1);
    const preview = embed('Ta réponse').setDescription(
        escapeText(completePhrase(session.prompt, cards)) + '\n\n**' + cards.length + '/' + session.holes + '** cartes sélectionnées' +
        (session.answers.has(user) ? '\nTa dernière réponse est enregistrée.' : '')
    ).setFooter({ text: 'Résultats ' + (draft.page + 1) + '/' + pages });
    const controls = [
        button(controlId(session, 'query', ...key), 'Rechercher'),
        button(controlId(session, 'clear', ...key), 'Recommencer').setDisabled(cards.length === 0),
        button(controlId(session, 'swap', ...key), 'Inverser').setDisabled(cards.length !== 2),
        button(controlId(session, 'lock', ...key), 'Valider', ButtonStyle.Success).setDisabled(cards.length !== session.holes)
    ];
    const components = [row(...controls)];
    if (cards.length < session.holes && available.length) {
        const options = available.slice(draft.page * 25, (draft.page + 1) * 25).map(card => (
            { label: cut(card.name, 100), value: card.id, description: cut('N° ' + card.numCode + ' · ' + card.setLabel + ' · ' + card.rarity, 100) }
        ));
        components.unshift(row(new StringSelectMenuBuilder().setCustomId(controlId(session, 'card', ...key))
            .setPlaceholder('Choisir une carte possédée').addOptions(options)));
        if (pages > 1) components.push(row(
            button(controlId(session, 'prev', ...key), 'Précédent').setDisabled(draft.page === 0),
            button(controlId(session, 'next', ...key), 'Suivant').setDisabled(draft.page + 1 >= pages)
        ));
    } else if (cards.length < session.holes) preview.setFooter({ text: 'Aucune carte restante ne correspond à la recherche.' });
    return { embeds: [preview], components };
}

async function restoreSlowmode(session) {
    if (session.record.slowmode == null) return;
    await session.thread.setRateLimitPerUser(session.record.slowmode, 'Fin du vote RegaDex');
    session.record.slowmode = null;
    saveThreadRecords();
}

async function startRatings(session) {
    clearTimeout(session.timer);
    session.phase = 'reveal';
    session.entries = shuffled([...session.answers.values()]);
    if (session.entries.length < 2) {
        await editThreadMessage(session, session.board, { embeds: [embed('Manche ' + session.round).setDescription('Il faut deux réponses valides pour ouvrir le vote.')], components: [] });
        await finishRound(session);
        return;
    }
    session.record.slowmode = session.thread.rateLimitPerUser ?? 0;
    saveThreadRecords();
    try {
        await session.thread.setRateLimitPerUser(21_600, 'Vote Vitrine à thème');
    } catch (error) {
        if (error.code !== 50013) throw error;
        session.record.slowmode = null; // Discord a refusé la modification.
        saveThreadRecords();
        console.warn('[PLAY] Le bot n’a pas la permission de modifier le mode lent.');
    }
    session.voteIndex = 0;
    await showRating(session);
}

async function showRating(session) {
    const entry = session.entries[session.voteIndex];
    if (!entry) {
        await finishRound(session);
        return;
    }
    session.phase = 'reveal';
    const cardImage = await drawVoteCards(entry.cards).catch(error => {
        console.warn('[PLAY] Aperçu des cartes :', error);
        return null;
    });
    const page = embed('Manche ' + session.round + '/' + ROUND_COUNT + ' · Réponse ' +
        (session.voteIndex + 1) + '/' + session.entries.length)
        .setDescription(escapeText(completePhrase(session.prompt, entry.cards)))
        .addFields({ name: 'Comment voter', value: 'Choisis une note pour cette réponse. **J’adore !** se joue une seule fois par partie. Tu ne notes que les réponses des autres.' })
        .setFooter({ text: '10 secondes pour voter · Sans note : Meh' });
    if (cardImage) page.setImage('attachment://reponse.png');
    await editThreadMessage(session, session.board, {
        embeds: [page], attachments: [], files: cardImage ? [new AttachmentBuilder(cardImage, { name: 'reponse.png' })] : [],
        components: [row(...RATINGS.map(([key, label, points, style]) => button(
            controlId(session, 'rate', session.lobbyId, session.round, session.voteIndex, key),
            label + ' (' + (points > 0 ? '+' : '') + points + ')', style
        )))]
    });
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
    const authors = session.entries.map((entry, index) => '**' + (index + 1) + '.** ' +
        escapeText(session.people.get(entry.user)?.name || 'Participant·e') + ' · ' + entry.score + ' pts');
    const reveal = embed('Manche ' + session.round + ' · Réponses dévoilées');
    reveal.setDescription(cut(authors.join('\n') || 'Aucune réponse enregistrée.', 3900));
    await editThreadMessage(session, session.board, { embeds: [reveal], components: [], attachments: [] });
    const top = ranked(session.entries.length >= 2 ? session.entries : []).filter(entry => entry.rank <= 3);
    for (const entry of top.filter(item => item.rank === 1)) {
        if (!session.best.length || entry.score > session.best[0].score) session.best = [];
        if (!session.best.length || entry.score === session.best[0].score) session.best.push({ ...entry, prompt: session.prompt });
    }
    for (let i = 0; i < top.length; i += 3) {
        await sendResult(session, 'Manche ' + session.round + ' · Résultats', top.slice(i, i + 3), {
            prompt: session.prompt, cards: true
        });
    }
    if (session.round < ROUND_COUNT) await startRound(session);
    else await showPodium(session);
}

function bestResponseDescription(best) {
    if (!best.length) return '';
    const label = best.length === 1 ? 'Meilleure réponse de la session' : 'Meilleures réponses ex æquo';
    const lines = best.map(entry => '• ' + escapeText(completePhrase(entry.prompt, entry.cards)) + ' — **' + entry.score + ' pts**');
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
    await sendResult(session, 'Vitrine à thème · Podium', top.slice(0, 3), {
        podium: true, description: best, best: session.best,
        components: [row(button(controlId(session, 'standing', session.lobbyId, 0), 'Voir le classement'))]
    });
    session.continuing = new Set();
    session.leaving = new Set();
    session.deadline = Date.now() + CONTINUE_MS;
    session.continueMessage = await session.thread.send(continuePayload(session));
    phaseTimer(session, Math.max(1, session.deadline - Date.now()), () => finishContinue(session));
}

function continuePayload(session) {
    const mentionList = set => [...set].map(id => playerRef(session, id)).join(', ') || '—';
    return {
        allowedMentions: { parse: [] },
        embeds: [embed('Continuer ?').setDescription(cut(
            '**Oui** · ' + mentionList(session.continuing) + '\n**Non** · ' + mentionList(session.leaving), 3700
        ) + '\n\nFin ' + expiry(session.deadline))],
        components: [row(button(controlId(session, 'yes', session.lobbyId), 'Oui', ButtonStyle.Success),
            button(controlId(session, 'leave', session.lobbyId), 'Non', ButtonStyle.Secondary))]
    };
}

async function finishContinue(session) {
    clearTimeout(session.timer);
    await editThreadMessage(session, session.continueMessage, { components: [] });
    for (const [user] of session.players) {
        if (!session.continuing.has(user)) session.players.delete(user);
    }
    for (const user of session.leaving) {
        session.optedOut.add(user);
        if (!session.bots.has(user)) await session.thread.members.remove(user).catch(error => console.warn('[PLAY] Désinscription du fil :', error));
    }
    if (!session.players.size || (session.test && !session.continuing.has(PLAY_TEST_OWNER_ID))) {
        await closeSession(session, 'Session terminée. Merci d’avoir joué !');
        return;
    }
    await nextGamePoll(session, new Set(session.players.keys()));
}

async function closeSession(session, reason) {
    session.phase = 'closed';
    clearTimeout(session.timer);
    clearTimeout(session.botTimer);
    await restoreSlowmode(session).catch(error => console.error('[PLAY] Restauration du mode lent :', error));
    const messages = [session.lobby, session.board, session.continueMessage, session.ballot?.message].filter(Boolean);
    await Promise.allSettled(messages.map(message => editThreadMessage(session, message, { components: [] })));
    await session.thread.send({ content: reason, allowedMentions: { parse: [] } }).catch(error => console.warn('[PLAY] Clôture :', error));
}

async function recoverSession(session, error) {
    console.error('[PLAY] Déroulement de la partie :', error);
    await enqueue(session, () => closeSession(session, 'La partie a été interrompue par une erreur. Vous pouvez en relancer une avec !play.'));
}

async function drawVoteCards(cards) {
    const canvas = createCanvas(cards.length * 210 + 20, 304);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#171029';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await Promise.all(cards.map((card, index) => drawCard(ctx, card, 14 + index * 210, 12, 190, 266)));
    return canvas.toBuffer('image/png');
}

async function drawCard(ctx, card, x, y, width, height) {
    let image;
    try { image = await loadImage(card.filePath); } catch { return; }
    const scale = Math.min(width / image.width, height / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    ctx.drawImage(image, x + (width - w) / 2, y + (height - h) / 2, w, h);
}

async function loadAvatar(player) {
    if (!player?.avatar) return null;
    try {
        const response = await fetch(player.avatar, { signal: AbortSignal.timeout(1800) });
        if (!response.ok) return null;
        return await loadImage(Buffer.from(await response.arrayBuffer()));
    } catch { return null; }
}

function drawAvatar(ctx, avatar, player, x, y, radius) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#6d499c';
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    if (avatar) ctx.drawImage(avatar, x - radius, y - radius, radius * 2, radius * 2);
    else {
        ctx.fillStyle = 'white';
        ctx.font = 'bold 35px Sans';
        ctx.fillText(cut(player?.name || '?', 1).toUpperCase(), x, y + 12);
    }
    ctx.restore();
}

function stage(ctx, width, height) {
    const background = ctx.createLinearGradient(0, 0, 0, height);
    background.addColorStop(0, '#130e24');
    background.addColorStop(0.65, '#311544');
    background.addColorStop(1, '#100b20');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
    for (const center of [width * 0.24, width * 0.76]) {
        const beam = ctx.createRadialGradient(center, 0, 24, center, 110, height * 0.86);
        beam.addColorStop(0, '#f2b965a8');
        beam.addColorStop(1, '#f2b96500');
        ctx.fillStyle = beam;
        ctx.beginPath();
        ctx.moveTo(center - 24, 0);
        ctx.lineTo(center + 24, 0);
        ctx.lineTo(center + 230, height - 100);
        ctx.lineTo(center - 230, height - 100);
        ctx.closePath();
        ctx.fill();
    }
    ctx.fillStyle = '#160d25';
    ctx.fillRect(0, height - 110, width, 110);
}

async function resultsCanvas(session, title, entries, options = {}) {
    const width = 1100;
    const stageHeight = options.cards ? 650 : 540;
    const showcase = options.podium && options.best?.length === 1 ? options.best[0] : null;
    const height = stageHeight + (showcase ? 124 : 0);
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    stage(ctx, width, stageHeight);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff7e9';
    ctx.font = 'bold 44px Sans';
    ctx.fillText(title, width / 2, 68, width - 80);
    if (options.prompt) {
        ctx.font = '25px Sans';
        ctx.fillText(options.prompt, width / 2, 113, width - 100);
    }
    if (!entries.length) return canvas.toBuffer('image/png');
    const avatars = await Promise.all(entries.map(entry => loadAvatar(session.people.get(entry.user))));
    const column = width / (entries.length + 1);
    const positions = options.podium && entries.length === 3 ? [1, 0, 2] : entries.map((_, index) => index);
    for (const [index, entry] of entries.entries()) {
        const player = session.people.get(entry.user);
        const x = column * (positions[index] + 1);
        const first = entry.rank === 1;
        const avatarY = options.cards ? 410 : (first ? 225 : 255);
        if (options.cards) {
            const cards = entry.cards || [];
            await Promise.all(cards.map((card, cardIndex) => {
                const w = first ? 122 : 108;
                return drawCard(ctx, card, x - (cards.length * (w + 8)) / 2 + cardIndex * (w + 8), 155, w, w * 1.4);
            }));
        }
        drawAvatar(ctx, avatars[index], player, x, avatarY, first ? 42 : 36);
        const top = avatarY + 54;
        ctx.fillStyle = first ? '#815331' : '#4a3367';
        const blockWidth = Math.min(245, column - 18);
        ctx.fillRect(x - blockWidth / 2, top, blockWidth, stageHeight - 45 - top);
        ctx.fillStyle = first ? '#ffe2ab' : '#ffffff';
        ctx.font = 'bold 25px Sans';
        ctx.fillText('#' + entry.rank + ' · ' + (player?.name || 'Participant·e'), x, top + 32, blockWidth - 18);
        ctx.font = 'bold 42px Sans';
        ctx.fillText(entry.score + ' pts', x, top + 82, blockWidth - 18);
    }
    if (showcase) {
        ctx.fillStyle = '#291a3c';
        ctx.fillRect(0, stageHeight, width, 124);
        ctx.fillStyle = '#ffe2ab';
        ctx.font = 'bold 28px Sans';
        ctx.fillText('Meilleure réponse · ' + showcase.score + ' pts', width / 2, stageHeight + 38);
        ctx.fillStyle = '#fff7e9';
        ctx.font = '25px Sans';
        ctx.fillText(completePhrase(showcase.prompt, showcase.cards), width / 2, stageHeight + 84, width - 70);
    }
    return canvas.toBuffer('image/png');
}

async function sendResult(session, title, entries, options) {
    const result = embed(title);
    const lines = entries.map(entry => '**#' + entry.rank + '** · ' +
        escapeText(session.people.get(entry.user)?.name || 'Participant·e') + ' · **' + entry.score + ' pts**');
    const description = [lines.join('\n'), options.description].filter(Boolean).join('\n\n');
    if (description) result.setDescription(cut(description, 4096));
    const image = await resultsCanvas(session, title, entries, options).catch(error => {
        console.warn('[PLAY] Canvas des résultats :', error);
        return null;
    });
    if (image) result.setImage('attachment://resultats.png');
    await session.thread.send({
        embeds: [result], files: image ? [new AttachmentBuilder(image, { name: 'resultats.png' })] : [],
        components: options.components || [], allowedMentions: { parse: [] }
    });
}

async function standingsPayload(session, lobbyId, page) {
    const results = session.results.get(lobbyId);
    const lines = [
        ...results.entries.map(entry => '**#' + entry.rank + '** · ' +
            escapeText(session.people.get(entry.user)?.name || 'Participant·e') + ' · **' + entry.score + ' pts**'),
        ...results.best.map(entry => '⭐ ' + escapeText(completePhrase(entry.prompt, entry.cards)) + ' · **' + entry.score + ' pts**')
    ];
    const pages = Math.max(1, Math.ceil(lines.length / 3));
    const safe = Math.max(0, Math.min(page, pages - 1));
    const view = embed('Vitrine à thème · Classement')
        .setDescription(lines.slice(safe * 3, (safe + 1) * 3).join('\n') || 'Tout le classement figure sur le podium.')
        .setFooter({ text: 'Page ' + (safe + 1) + '/' + pages });
    const entries = results.entries.slice(safe * 3, (safe + 1) * 3);
    const image = entries.length ? await resultsCanvas(session, 'Vitrine à thème · Classement', entries)
        .catch(error => { console.warn('[PLAY] Canvas du classement :', error); return null; }) : null;
    if (image) view.setImage('attachment://classement.png');
    return {
        embeds: [view], attachments: [], files: image ? [new AttachmentBuilder(image, { name: 'classement.png' })] : [],
        components: pages > 1 ? [row(
            button(controlId(session, 'standing', lobbyId, safe - 1), 'Précédent').setDisabled(safe === 0),
            button(controlId(session, 'standing', lobbyId, safe + 1), 'Suivant').setDisabled(safe === pages - 1)
        )] : []
    };
}

async function showBinder(interaction, session, action, parts) {
    const [rawSet, rawPage, rawTheme] = parts;
    const set = Number(rawSet) || 1;
    const page = Number(rawPage) || 0;
    const theme = rawTheme === 'W' ? 'W' : 'B';
    if (action === 'binder') await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    else await interaction.deferUpdate();
    persistRecordActivity(session.record, interaction.client);
    const result = await renderPlayBinder(interaction.user, set, page, theme);
    const view = embed('RegaDex · Classeur complet')
        .setDescription(result.setName)
        .setImage('attachment://classeur.jpg')
        .setFooter({ text: 'Page ' + (result.page + 1) + '/' + result.totalPages + ' · ' + (theme === 'W' ? 'Clair' : 'Nuit') });
    const components = [row(
        button(controlId(session, 'browse', result.set, result.page - 1, theme), 'Précédente').setDisabled(result.page === 0),
        button(controlId(session, 'browse', result.set, result.page + 1, theme), 'Suivante').setDisabled(result.page + 1 >= result.totalPages),
        button(controlId(session, 'browse', result.set, result.page, theme === 'W' ? 'B' : 'W'), 'Changer le thème')
    )];
    if (result.sets.length > 1) components.push(row(new StringSelectMenuBuilder().setCustomId(controlId(session, 'binderset', theme))
        .setPlaceholder('Changer de set').addOptions(result.sets.map(item => ({ label: item.name, value: String(item.id), default: item.id === result.set })))));
    await interaction.editReply({
        embeds: [view], components, attachments: [], files: [new AttachmentBuilder(result.buffer, { name: 'classeur.jpg' })]
    });
}

async function menuInteraction(interaction, action, menu) {
    if (interaction.user.id !== menu.owner) return privateResponse(interaction, 'Ce menu appartient à la personne qui a lancé !play.');
    if (menu.launching) return privateResponse(interaction, 'Le fil est déjà en cours de création.');
    switch (action) {
        case 'menu': return interaction.update(chooseGameMenu(menu));
        case 'guide': return interaction.update(chooseGameMenu(menu, 'all'));
        case 'guidegame': return interaction.update(chooseGameMenu(menu, interaction.values[0]));
        case 'game':
            if (interaction.values && GUIDES[interaction.values[0]]) menu.game = interaction.values[0];
            return menu.game ? interaction.update(launchMenu(menu)) : interaction.update(chooseGameMenu(menu));
        case 'bots': {
            const amount = Number(interaction.values?.[0]);
            if (menu.test && menu.game && Number.isInteger(amount) && amount >= 1 && amount <= TEST_NAMES.length)
                return createSession(interaction, menu, null, amount);
            return privateResponse(interaction, 'Choisis entre un et trois bots.');
        }
        case 'open': return !menu.test && menu.game ? createSession(interaction, menu) :
            privateResponse(interaction, 'Ce lancement est indisponible.');
        case 'invite': {
            if (menu.test || !menu.game) return privateResponse(interaction, 'Ce lancement est indisponible.');
            const users = new UserSelectMenuBuilder().setCustomId(idFor('inviteusers', menu.id))
                .setPlaceholder('Choisir les membres invités').setMinValues(1).setMaxValues(25);
            return interaction.update({ embeds: [embed('Sur invitation').setDescription('Sélectionne les membres qui pourront jouer.')],
                components: [row(users), row(button(idFor('game', menu.id), 'Retour'))] });
        }
        case 'inviteusers': return !menu.test && menu.game ? createSession(interaction, menu, new Set([menu.owner, ...interaction.values])) :
            privateResponse(interaction, 'Ce lancement est indisponible.');
        default: return privateResponse(interaction, 'Ce bouton a expiré.');
    }
}

async function rateResponse(interaction, session, parts) {
    const [lobbyId, round, index, rating] = parts;
    if (session.phase !== 'rating' || Number(lobbyId) !== session.lobbyId || Number(round) !== session.round ||
        Number(index) !== session.voteIndex || Date.now() >= session.deadline) return privateResponse(interaction, 'Vote clos pour cette réponse.');
    const id = interaction.user.id;
    const entry = session.entries[session.voteIndex];
    if (id === entry.user || !session.players.has(id)) return privateResponse(interaction, 'Tu ne peux pas noter cette réponse.');
    if (entry.votes.has(id)) return privateResponse(interaction, 'Ta note est déjà enregistrée.');
    const note = RATINGS.find(item => item[0] === rating);
    if (!note) return privateResponse(interaction, 'Note inconnue.');
    if (rating === 'love' && session.loveUsed.has(id)) return privateResponse(interaction, 'Tu as déjà utilisé J’adore ! pendant cette session.');
    if (rating === 'love') session.loveUsed.add(id);
    entry.votes.set(id, note[2]);
    touchInteraction(session, interaction);
    return privateResponse(interaction, note[1] + ' enregistré.');
}

async function pickInteraction(interaction, session, action, parts) {
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
    if (action === 'pick' || action === 'query') return interaction.showModal(searchModal(session, id, draft));
    if (action === 'search') {
        draft.query = interaction.fields.getTextInputValue('query').trim();
        draft.page = 0;
        return interaction.reply({ ...draftPayload(session, id, draft), flags: MessageFlags.Ephemeral });
    }
    if (action === 'prev') draft.page--;
    if (action === 'next') draft.page++;
    if (action === 'clear') draft.cards = [];
    if (action === 'swap') draft.cards.reverse();
    if (action === 'card') {
        const selected = interaction.values[0];
        if (draft.cards.length < session.holes && playingCards(session, id, draft).some(card => card.id === selected)) {
            draft.cards.push(selected);
            draft.query = '';
            draft.page = 0;
        }
    }
    if (action === 'lock') {
        const owned = playCardsFor(session, id);
        const selected = draft.cards.map(cardId => owned.find(card => card.id === cardId));
        if (selected.length !== session.holes || selected.some(card => !card)) return privateResponse(interaction, 'Choisis toutes les cartes dans ton classeur.');
        session.answers.set(id, { user: id, cards: selected, votes: new Map(), score: 0 });
        await interaction.update({ embeds: [embed('Réponse enregistrée').setDescription(escapeText(completePhrase(session.prompt, selected)))], components: [] });
        if (session.answers.size >= session.roundPlayers.size) await startRatings(session);
        else await editThreadMessage(session, session.board, pickPayload(session));
        return;
    }
    return interaction.update(draftPayload(session, id, draft));
}

async function sessionInteraction(interaction, session, action, parts) {
    const player = readPlayer(interaction);
    const user = player.id;
    if (action === 'standing') {
        const [lobby, page] = parts.map(Number);
        if (!session.results.has(lobby)) return privateResponse(interaction, 'Ce classement a expiré.');
        if (interaction.message.flags?.has(MessageFlags.Ephemeral)) await interaction.deferUpdate();
        else await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        persistRecordActivity(session.record, interaction.client);
        return interaction.editReply(await standingsPayload(session, lobby, page));
    }
    if (action === 'binder' || action === 'browse' || action === 'binderset') {
        const params = action === 'binderset' ? [interaction.values[0], 0, parts[0]] : parts;
        return showBinder(interaction, session, action, params);
    }
    if (action === 'pages') return gameResultPages(interaction, session, parts);
    if (session.phase === 'closed') return privateResponse(interaction, 'Cette partie est terminée.');
    if (action === 'ballot') return voteBallot(interaction, session, parts);
    if (action === 'gameaction') return gameInteraction(interaction, session, parts);
    if (['join', 'late', 'cancel', 'settings', 'settingsLate', 'settingsInvite', 'settingsUsers', 'skipClock'].includes(action) && Number(parts[0]) !== session.lobbyId)
        return privateResponse(interaction, 'Ce menu d’inscription a expiré.');
    if (['settings', 'settingsLate', 'settingsInvite', 'settingsUsers', 'skipClock'].includes(action))
        return threadSettings(interaction, session, action, parts);
    if (action === 'rate') return rateResponse(interaction, session, parts);
    if (['pick', 'query', 'search', 'prev', 'next', 'clear', 'swap', 'card', 'lock'].includes(action))
        return pickInteraction(interaction, session, action, parts);
    if (action === 'join') {
        if (session.test || session.optedOut.has(user) || (session.invited && !session.invited.has(user)))
            return privateResponse(interaction, 'Cette partie ne t’est pas ouverte.');
        if (session.players.has(user) || session.pending.has(user)) return privateResponse(interaction, 'Tu es déjà inscrit·e.');
        if (session.phase === 'lobby' && Date.now() >= session.deadline) return privateResponse(interaction, 'Les inscriptions viennent de se terminer.');
        if (session.phase !== 'lobby' && !session.allowLate) return privateResponse(interaction, 'Les arrivées en cours sont fermées.');
        const target = session.phase === 'lobby' ? session.players : session.pending;
        target.set(user, player);
        session.people.set(user, player);
        persistRecordActivity(session.record, interaction.client);
        await privateResponse(interaction, session.phase === 'lobby' ? 'Tu es inscrit·e !' : 'Tu rejoindras la prochaine manche ou session.');
        if (session.thread.members.add) await session.thread.members.add(user).catch(error => console.warn('[PLAY] Inscription Discord :', error));
        if (session.phase === 'lobby') await updateLobby(session);
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
        else await editThreadMessage(session, session.continueMessage, continuePayload(session));
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
            // Les votes et formulaires sont acquittés aussitôt, même si un Canvas est en cours.
            if (action === 'rate' || ['pick', 'query', 'search', 'prev', 'next', 'clear', 'swap', 'card', 'binder', 'browse', 'binderset', 'standing', 'pages'].includes(action))
                await sessionInteraction(interaction, session, action, parts);
            else await enqueue(session, () => sessionInteraction(interaction, session, action, parts));
        } else await privateResponse(interaction, 'Ce menu a expiré. Lance une nouvelle partie avec !play.');
    } catch (error) {
        console.error('[PLAY] Interaction :', error);
        if (!interaction.deferred && !interaction.replied) await privateResponse(interaction, 'Le mini-jeu a rencontré une erreur.').catch(() => {});
        else await interaction.followUp({ content: 'Le mini-jeu a rencontré une erreur.', flags: MessageFlags.Ephemeral }).catch(() => {});
        if (session && ['lock', 'join', 'late', 'cancel', 'yes', 'leave', 'gameaction', 'ballot', 'skipClock'].includes(action))
            await recoverSession(session, error);
    }
    return true;
}


// Parcours commun aux cinq autres jeux et aux votes entre parties.
const CASTING_QUESTIONS = [
    'Qui devrait représenter Regaïa devant un tribunal ?',
    'Qui devrait gérer les plaintes du serveur pendant une semaine ?',
    'Qui engagerais-tu pour sauver une soirée qui part en vrille ?',
    'Qui ferait le meilleur remplaçant de Cacabot ?',
    'À qui confierais-tu les clés du serveur pendant 24 heures ?'
];
const RANKING_PROMPTS = [
    'Du plus au moins fiable pour garder ton chat.',
    'Du premier au dernier que tu appellerais pour déménager.',
    'Du plus au moins doué pour faire croire qu’il travaille.',
    'Du plus au moins crédible pour présenter le journal de 20 heures.',
    'Du premier au dernier à survivre à une nuit dans un château hanté.'
];
const FMK_LABELS = ['Fuck', 'Marry', 'Kill'];
const answerKey = value => normalize(value ?? '').replace(/[^\p{Letter}\p{Number}]+/gu, ' ').trim();
const nameKeys = card => new Set([answerKey(card.name), answerKey(card.baseName)].filter(Boolean));

function promotePending(session) {
    for (const [id, player] of session.pending) session.players.set(id, player);
    session.pending.clear();
}

function sampleCards(count, excluded = new Set(), distinctNames = false) {
    const cards = shuffled(getPlayCatalog()).filter(card => !excluded.has(card.id));
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

function gameButton(session, action, label, style, argument = '') {
    return button(controlId(session, 'gameaction', session.lobbyId, session.state.revision, action, argument), label, style);
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

async function gameBoard(session, text, components = [], attachment = null, mentions = [], title = gameTitle(session)) {
    const page = embed(title).setDescription(cut(text, 4000));
    const tip = STEP_TIPS[session.state?.step];
    if (tip && components.length) page.addFields({ name: 'Utiliser les boutons', value: tip });
    if (attachment) page.setImage('attachment://' + attachment.name);
    const realMentions = mentions.filter(id => !session.bots.has(id));
    const payload = { embeds: [page], components, allowedMentions: { parse: [], users: realMentions } };
    if (realMentions.length) payload.content = realMentions.map(id => playerRef(session, id)).join(' ');
    else if (session.board) payload.content = null;
    if (attachment) payload.files = [attachment];
    if (session.board) await editThreadMessage(session, session.board, { ...payload, attachments: [] });
    else session.board = await session.thread.send(payload);
}

async function threadVoters(session) {
    if (session.test) return new Set(session.players.keys());
    let ids = new Set(session.players.keys());
    if (session.thread.members.fetch) {
        try {
            const present = new Set();
            let after;
            for (;;) {
                const members = await session.thread.members.fetch({ cache: false, withMember: true, limit: 100, after });
                for (const member of members.values()) {
                    if (member.id !== session.thread.client.user.id && !member.guildMember?.user?.bot) present.add(member.id);
                }
                const last = members.lastKey();
                if (members.size < 100 || !last || last === after) break;
                after = last;
            }
            ids = present;
        } catch (error) { console.warn('[PLAY] Lecture des personnes du fil :', error); }
    }
    for (const id of session.optedOut) ids.delete(id);
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
    await updateLobby(session);
    if (session.game === 'cavale') return startCavale(session);
    if (session.game === 'casting') return startCasting(session);
    if (session.game === 'devine') return startDevine(session);
    if (session.game === 'classement') return startRanking(session);
    return startSocialChoices(session, 'fmk');
}

async function finishGame(session, text, attachment = null, components = []) {
    gameStep(session, 'finished');
    await gameBoard(session, text, components, attachment);
    await nextGamePoll(session, await threadVoters(session));
}

async function openBallot(session, { title, description, voters, options, choose, ms = CONTINUE_MS, canFinishEarly = () => true }) {
    clearTimeout(session.timer);
    session.phase = 'ballot';
    const ballot = { id: session.ballotId = (session.ballotId || 0) + 1, voters, options,
        votes: new Map(), choose, title, description, canFinishEarly };
    session.ballot = ballot;
    session.deadline = Date.now() + ms;
    ballot.message = await session.thread.send(ballotPayload(session, ballot));
    phaseTimer(session, Math.max(1, session.deadline - Date.now()), () => finishBallot(session, ballot));
}

function ballotPayload(session, ballot) {
    const options = ballot.options;
    const customId = controlId(session, 'ballot', ballot.id);
    const controls = options.length > 25
        ? new UserSelectMenuBuilder().setCustomId(customId).setPlaceholder('Sélectionner un·e participant·e')
        : new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder('Choisir ton vote')
            .addOptions(options.map(({ value, label, emoji }) => ({ value, label: cut(label, 100), ...(emoji ? { emoji } : {}) })));
    return { embeds: [embed(ballot.title).setDescription(ballot.description + '\n\n' +
        ballot.votes.size + '/' + ballot.voters.size + ' votes · Fin ' + expiry(session.deadline))],
        components: [row(controls)], allowedMentions: { parse: [] } };
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
    await privateResponse(interaction, 'Ton vote est enregistré.');
    if (ballot.votes.size >= ballot.voters.size && ballot.canFinishEarly(ballot.votes)) await finishBallot(session, ballot);
    else await editThreadMessage(session, ballot.message, ballotPayload(session, ballot));
}

async function finishBallot(session, ballot) {
    if (session.ballot !== ballot || session.phase !== 'ballot') return;
    clearTimeout(session.timer);
    session.phase = 'game';
    const counts = new Map();
    for (const choice of ballot.votes.values()) counts.set(choice, (counts.get(choice) || 0) + 1);
    const maximum = Math.max(0, ...counts.values());
    const leaders = [...counts].filter(([, count]) => count === maximum).map(([value]) => value);
    await editThreadMessage(session, ballot.message, {
        embeds: [embed(ballot.title).setDescription(
            ballot.votes.size ? ballot.options.filter(option => counts.has(option.value))
                .map(option => '**' + escapeText(option.label) + '** · ' + counts.get(option.value)).join('\n').slice(0, 3800) : 'Aucun vote enregistré.'
        )], components: []
    });
    await ballot.choose(leaders, ballot.votes);
}

async function nextGamePoll(session, voters) {
    if (!voters.size) return closeSession(session, 'Session terminée. Merci d’avoir joué !');
    const options = Object.entries(GUIDES).map(([value, [label, , emoji]]) => ({ value, label, emoji }));
    await openBallot(session, { title: '🎮 Prochain mini-jeu', description: 'Choisis la suite. En cas d’égalité, Cacabot tire au sort.',
        voters, options, choose: async (leaders, votes) => {
            if (!leaders.length) return closeSession(session, 'Aucun vote enregistré. La session est terminée.');
            const winner = leaders[randomInt(leaders.length)];
            if (!session.players.has(session.host)) session.host = session.players.keys().next().value || votes.keys().next().value;
            session.game = winner;
            await session.thread.send({ embeds: [embed(gameTitle(session)).setDescription('Le vote a choisi ce mini-jeu. Les inscriptions ouvrent dans ce fil.')],
                allowedMentions: { parse: [] } });
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
    const threshold = guess.length >= 8 ? 2 : guess.length >= 4 ? 1 : 0;
    if (!threshold || names.has(guess)) return false;
    let best = Infinity;
    for (const name of expected) best = Math.min(best, distance(guess, name));
    return best <= threshold && ![...names].some(name => !expected.has(name) && Math.abs(guess.length - name.length) <= best && distance(guess, name) <= best);
}

async function startCavale(session) {
    const state = session.state;
    state.cards = sampleCards(5, new Set(), true);
    if (!state.cards.length) return finishGame(session, 'Aucune carte disponible dans le catalogue.');
    state.names = new Set(getPlayCatalog().flatMap(card => [...nameKeys(card)]));
    state.index = 0;
    await cavaleRound(session);
}

async function cavaleRound(session) {
    const state = session.state;
    if (state.index >= state.cards.length) {
        const entries = ranked([...session.scores].map(([user, score]) => ({ user, score })));
        const text = entries.length ? entries.map(item => '**#' + item.rank + '** · ' +
            escapeText(session.people.get(item.user)?.name || 'Enquêteur') + ' · **' + item.score + '** carte(s)').join('\n') : 'Personne n’a trouvé de carte.';
        return finishGame(session, '**Classement final**\n' + text);
    }
    promotePending(session);
    gameStep(session, 'guess');
    state.zoom = 0;
    state.roundStarted = Date.now();
    try {
        state.image = await loadImage(state.cards[state.index].filePath);
    } catch (error) {
        console.warn('[PLAY] Illustration de Cartes en cavale indisponible :', error);
        state.index++;
        return cavaleRound(session);
    }
    await cavaleZoom(session);
}

async function cavaleZoom(session) {
    const state = session.state;
    const source = state.image;
    const sourceSide = Math.min(source.width, source.height);
    const side = sourceSide * (0.27 + state.zoom * 0.095);
    const x = source.width * 0.49 - side / 2;
    const y = source.height * 0.46 - side / 2;
    const canvas = createCanvas(620, 620);
    canvas.getContext('2d').drawImage(source, x, y, side, side, 0, 0, canvas.width, canvas.height);
    await gameBoard(session, '**Carte ' + (state.index + 1) + '/' + state.cards.length +
        '** · Indice ' + (state.zoom + 1) + '/5\nÉcris ta réponse dans le fil. Prochain indice ou révélation ' +
        expiry(state.roundStarted + (state.zoom + 1) * 60_000) + '.', [],
    new AttachmentBuilder(canvas.toBuffer('image/png'), { name: 'indice.png' }));
    phaseTimer(session, Math.max(1, state.roundStarted + (state.zoom + 1) * 60_000 - Date.now()), async () => {
        if (++state.zoom === 5) await revealCavale(session);
        else await cavaleZoom(session);
    });
}

async function cavaleGuess(session, message) {
    if (session.phase !== 'game' || session.state.step !== 'guess' || !session.players.has(message.author.id)) return false;
    const state = session.state;
    if (Date.now() >= state.roundStarted + 300_000 || !matchesCard(message.content, state.cards[state.index], state.names)) return false;
    await revealCavale(session, message.author.id);
    return true;
}

async function revealCavale(session, winner = null) {
    const state = session.state;
    gameStep(session, 'reveal');
    const card = state.cards[state.index];
    if (winner) session.scores.set(winner, (session.scores.get(winner) || 0) + 1);
    await gameBoard(session, '**' + escapeText(card.name) + '** · N° ' + card.numCode + '\n' +
        (winner ? playerRef(session, winner) + ' gagne la manche !' : 'Le délai de cinq minutes est terminé.'), [], cardFile(card));
    state.image = null;
    state.index++;
    session.board = null; // Conserve la révélation pendant l’affichage de l’indice suivant.
    phaseTimer(session, 3000, () => cavaleRound(session));
}

async function startDevine(session) {
    const state = session.state;
    state.volunteers = new Set();
    gameStep(session, 'volunteer');
    await gameBoard(session, 'Qui veut être maître du jeu ? Le MJ sera tiré au sort parmi les volontaires dans 30 secondes.',
        [row(gameButton(session, 'volunteer', 'Être volontaire', ButtonStyle.Primary))]);
    phaseTimer(session, JOIN_MS, () => setupDevine(session));
}

async function setupDevine(session) {
    const state = session.state;
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
    await gameBoard(session, playerRef(session, state.mj) + ' est MJ. Ouvre la carte secrète pour lancer l’enquête.',
        [row(gameButton(session, 'secret', 'Ouvrir la carte secrète', ButtonStyle.Primary))], null, [state.mj]);
    phaseTimer(session, CONTINUE_MS, () => openDevineStop(session));
}

function devineHistory(session) {
    const state = session.state;
    const lines = state.log.map(({ asker, question, answer }, i) =>
        '**' + (i + 1) + '.** ' + playerRef(session, asker) + ' · ' + escapeText(question) + ' → **' + answer + '**');
    return lines;
}

function devineUtilities(session) {
    return row(
        button(controlId(session, 'binder'), 'Classeur'),
        gameButton(session, 'history', 'Tout l’historique').setDisabled(!session.state.log?.length),
        gameButton(session, 'return', 'Reprendre ma place').setDisabled(![...session.state.investigators.values()].some(p => p.paused))
    );
}

async function devineBoard(session, status, controls, mentions = []) {
    const lines = devineHistory(session);
    const history = lines.slice(-6).join('\n') || 'Aucune réponse pour le moment.';
    await gameBoard(session, status + '\n\n**Questions et réponses**\n' + history,
        [...controls, devineUtilities(session)], null, mentions);
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
    const control = row(
        gameButton(session, 'ask', 'Poser une question', ButtonStyle.Primary).setDisabled(!investigator.left),
        gameButton(session, 'guess', 'Proposer une carte', ButtonStyle.Success),
        gameButton(session, 'pass', finalQuestioner ? 'Passer aux dernières réponses' : 'Passer mon tour')
    );
    await devineBoard(session, 'Au tour de ' + playerRef(session, current) + ' · **' + investigator.left + '** question(s) restante(s) · 1 minute.',
        [control], [current]);
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
    await devineBoard(session, 'Personne n’a joué pendant le dernier tour de table. Une minute pour reprendre.',
        [row(gameButton(session, 'resume', 'Reprendre la partie', ButtonStyle.Primary))]);
    phaseTimer(session, CONTINUE_MS, () => finishDevine(session, 'Personne n’a repris la partie.'));
}

async function devineLastChance(session) {
    gameStep(session, 'finalGuess');
    session.state.finalGuesses = new Set();
    await devineBoard(session, '**Dernière chance · 1 minute**\nChaque enquêteur peut tenter une dernière réponse en privé.',
        [row(gameButton(session, 'guess', 'Proposer ma dernière carte', ButtonStyle.Success))]);
    phaseTimer(session, CONTINUE_MS, () => finishDevine(session, 'Personne n’a trouvé pendant la dernière chance.'));
}

async function devineWaitingMJ(session) {
    gameStep(session, 'waitingMJ');
    const { mj, pendingQuestion } = session.state;
    await devineBoard(session, playerRef(session, mj) + ', tu as une minute pour répondre à ' + playerRef(session, pendingQuestion.asker) + '.', [
        row(gameButton(session, 'mjpanel', 'Ouvrir le pupitre MJ', ButtonStyle.Primary))
    ], [mj]);
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
        ? gameButton(session, 'mjpanel', 'Ouvrir le pupitre MJ', ButtonStyle.Primary)
        : gameButton(session, 'secret', 'Ouvrir la carte secrète', ButtonStyle.Primary);
    await devineBoard(session, 'Le MJ n’a pas répondu. Vous pouvez voter pour arrêter. **' +
        state.stopVotes.size + '/' + Math.ceil(state.investigators.size / 2) + '** vote(s).', [
        row(mjAction, gameButton(session, 'stop', 'Arrêter', ButtonStyle.Danger))
    ]);
}

async function finishDevine(session, reason, winner = null) {
    const state = session.state;
    return finishGame(session, (winner ? playerRef(session, winner) + ' a trouvé !' : reason) + '\n\n**' +
        escapeText(state.card.name) + '** · N° ' + state.card.numCode, cardFile(state.card));
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
        return ack('Tu es volontaire pour être MJ.');
    }
    if (op === 'secret' && user === state.mj && ['mjReady', 'stopVote'].includes(state.step)) {
        touchInteraction(session, interaction);
        await interaction.reply({ content: 'Carte secrète : **' + escapeText(state.card.name) + '**',
            files: [cardFile(state.card)], flags: MessageFlags.Ephemeral });
        return devineTurn(session);
    }
    if (op === 'history' && state.log?.length) {
        const lines = devineHistory(session);
        const text = lines.join('\n');
        touchInteraction(session, interaction);
        if (text.length < 3900) return interaction.reply({ embeds: [embed('Historique de l’enquête').setDescription(text)],
            flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
        const plain = state.log.map((item, index) => (index + 1) + '. ' + item.question + ' — ' + item.answer).join('\n');
        return interaction.reply({ files: [new AttachmentBuilder(Buffer.from(plain), { name: 'historique-enquete.txt' })],
            flags: MessageFlags.Ephemeral });
    }
    if (op === 'return' && investigator?.paused && state.step !== 'finished') {
        investigator.paused = false;
        investigator.misses = 0;
        await ack('Tu reprends ta place dans la rotation.');
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
        await ack('L’enquête reprend.');
        return devineTurn(session);
    }
    if (op === 'stop' && state.step === 'stopVote' && investigator) {
        state.stopVotes.add(user);
        await ack('Ton vote d’arrêt est enregistré.');
        if (state.stopVotes.size >= Math.ceil(state.investigators.size / 2)) return finishDevine(session, 'Les joueurs ont arrêté l’enquête.');
        return showDevineStop(session);
    }
    if (op === 'mjpanel' && user === state.mj && state.pendingQuestion && ['waitingMJ', 'stopVote'].includes(state.step)) {
        touchInteraction(session, interaction);
        return interaction.reply({
            embeds: [embed('Pupitre du MJ').setDescription('**Carte : ' + escapeText(state.card.name) + '**\n' +
                escapeText(state.pendingQuestion.question))],
            components: [row(gameButton(session, 'answer', 'Oui', ButtonStyle.Success, 'yes'),
                gameButton(session, 'answer', 'Non', ButtonStyle.Danger, 'no'),
                gameButton(session, 'answer', 'À reformuler', ButtonStyle.Secondary, 'retry'))],
            flags: MessageFlags.Ephemeral
        });
    }
    if (op === 'answer' && user === state.mj && state.pendingQuestion && ['waitingMJ', 'stopVote'].includes(state.step) &&
        ['yes', 'no', 'retry'].includes(argument)) {
        const question = state.pendingQuestion;
        await ack(argument === 'retry' ? 'La question doit être reformulée.' : 'Ta réponse est enregistrée.');
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
        await ack('Tu passes sans dépenser de question.');
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
        await ack('Ta question est transmise au MJ.');
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
        await ack(correct ? 'Bonne réponse !' : 'Ce n’est pas la bonne carte.');
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
    const group = session.players.size > 2 ? [
        { value: 'group|bank', label: 'Groupe · Sujet préparé' },
        { value: 'group|custom', label: 'Groupe · Sujet écrit par un membre' }
    ] : [];
    await gameBoard(session, 'L’hôte choisit le format du débat et l’origine de la question.', [row(gameSelect(session, 'castSetup', [
        ...group, { value: 'duel|bank', label: '1 contre 1 · Sujet préparé' },
        { value: 'duel|custom', label: '1 contre 1 · Sujet écrit par un membre' }
    ], 'Choisir le format'))]);
    phaseTimer(session, JOIN_MS, () => castingSetup(session, session.players.size > 2 ? 'group|bank' : 'duel|bank'));
}

async function castingSetup(session, value) {
    const state = session.state;
    const [mode, source] = value.split('|');
    state.duel = mode === 'duel';
    state.custom = source === 'custom';
    state.volunteers = new Set();
    gameStep(session, 'castVolunteer');
    if (state.duel && session.players.size === 2) {
        state.volunteers = new Set(session.players.keys());
        return selectDebaters(session);
    }
    await gameBoard(session, 'Inscris-toi pour débattre. Deux volontaires seront tirés au sort dans 30 secondes.',
        [row(gameButton(session, 'castVolunteer', 'Je veux débattre', ButtonStyle.Primary))]);
    phaseTimer(session, JOIN_MS, () => selectDebaters(session));
}

async function selectDebaters(session) {
    const state = session.state;
    if (state.volunteers.size < 2) return finishGame(session, 'Il faut deux volontaires pour lancer le débat.');
    state.debaters = shuffled(state.volunteers).slice(0, 2);
    state.prompt = shuffled(CASTING_QUESTIONS)[0];
    if (!state.custom) return castingCards(session);
    const spectators = [...session.players.keys()].filter(id => !state.debaters.includes(id));
    state.writer = shuffled(spectators.length ? spectators : state.debaters)[0];
    gameStep(session, 'castPrompt');
    await gameBoard(session, playerRef(session, state.writer) + ', tu as 45 secondes pour écrire la question du débat.',
        [row(gameButton(session, 'castWrite', 'Écrire la question', ButtonStyle.Primary))], null, [state.writer]);
    phaseTimer(session, 45_000, () => castingCards(session));
}

async function castingCards(session) {
    const state = session.state;
    const cards = sampleCards(2, new Set(), true);
    if (cards.length < 2) return finishGame(session, 'Deux cartes différentes sont nécessaires pour le Casting.');
    state.drawn = new Set(cards.map(card => card.id));
    state.slots = new Map(state.debaters.map((id, i) => [id, { card: cards[i], remaining: 3, locked: false }]));
    gameStep(session, 'castCards');
    await gameBoard(session, '**' + escapeText(state.prompt) + '**\n\n' +
        state.debaters.map(id => playerRef(session, id)).join(' contre ') + '\nVous avez 90 secondes pour verrouiller vos cartes privées.',
    [row(gameButton(session, 'castPanel', 'Voir ma carte', ButtonStyle.Primary))], null, state.debaters);
    phaseTimer(session, PICK_MS, () => castingDebate(session));
}

function castingPanel(session, slot) {
    const view = embed('Ma carte · Casting').setDescription('**' + escapeText(slot.card.name) + '**\n' +
        slot.remaining + '/3 changements restants' + (slot.locked ? ' · Carte verrouillée' : '')).setImage('attachment://carte.png');
    return { embeds: [view], files: [cardFile(slot.card)], components: [row(
        gameButton(session, 'castReroll', 'Changer de carte').setDisabled(slot.locked || slot.remaining === 0),
        gameButton(session, 'castLock', 'Verrouiller', ButtonStyle.Success).setDisabled(slot.locked)
    )] };
}

async function castingDebate(session) {
    const state = session.state;
    for (const slot of state.slots.values()) slot.locked = true;
    gameStep(session, 'castDebate');
    const cards = state.debaters.map(id => state.slots.get(id).card);
    const art = await drawVoteCards(cards).catch(error => { console.warn('[PLAY] Cartes du Casting :', error); return null; });
    await gameBoard(session, '**' + escapeText(state.prompt) + '**\n\n' +
        state.debaters.map((id, i) => playerRef(session, id) + ' défend **' + escapeText(cards[i].name) + '**').join('\n') +
        '\n\nVous avez **5 minutes** pour débattre dans ce fil.', [],
    art ? new AttachmentBuilder(art, { name: 'candidats.png' }) : null, state.debaters);
    phaseTimer(session, 300_000, () => castingVote(session, false));
}

async function castingVote(session, second) {
    const state = session.state;
    const voters = state.duel ? new Set(state.debaters) : await threadVoters(session);
    if (!state.duel) for (const id of state.debaters) voters.delete(id);
    if (!voters.size) return finishGame(session, 'Le débat est terminé. Le public n’a désigné personne.');
    const options = state.debaters.map(value => ({ value, label: session.people.get(value)?.name || 'Participant·e' }));
    await openBallot(session, { title: second ? '🎙️ Départage du duel' : '🎙️ Qui vous a convaincus ?',
        description: second ? 'Le duel est à 1–1. Mettez-vous d’accord sur la personne qui a remporté le débat.' :
            'Vote pour la personne qui a le mieux défendu sa carte.',
        voters, options,
        canFinishEarly: votes => !state.duel || second || new Set(votes.values()).size === 1,
        choose: async (leaders, votes) => {
            if (state.duel && votes.size === 2 && leaders.length === 2 && !second) return castingVote(session, true);
            if (leaders.length === 1) return finishGame(session, 'Le débat est remporté par ' + playerRef(session, leaders[0]) + '.');
            return finishGame(session, leaders.length ? 'Le débat se termine sur un match nul.' : 'Le débat est terminé. Aucun vote enregistré.');
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
        touchInteraction(session, interaction);
        return privateResponse(interaction, 'Ton inscription au tirage est enregistrée.');
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
        await privateResponse(interaction, 'Le sujet est enregistré.');
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
        return;
    }
    return privateResponse(interaction, 'Cette action ne t’est pas ouverte.');
}

async function startRanking(session) {
    gameStep(session, 'rankSetup');
    await gameBoard(session, 'L’hôte choisit comment obtenir la consigne.', [row(
        gameButton(session, 'rankBank', 'Consigne préparée', ButtonStyle.Primary),
        gameButton(session, 'rankCustom', 'Consigne d’un membre')
    )]);
    phaseTimer(session, JOIN_MS, () => rankingSetup(session, false));
}

async function rankingSetup(session, custom) {
    const state = session.state;
    state.prompt = shuffled(RANKING_PROMPTS)[0];
    if (!custom) return rankingModeVote(session);
    state.writer = shuffled(session.players.keys())[0];
    gameStep(session, 'rankWrite');
    await gameBoard(session, playerRef(session, state.writer) + ', écris la consigne du classement dans les 45 secondes.',
        [row(gameButton(session, 'rankWrite', 'Écrire la consigne', ButtonStyle.Primary))], null, [state.writer]);
    phaseTimer(session, 45_000, () => rankingModeVote(session));
}

async function rankingModeVote(session) {
    await openBallot(session, {
        title: '📋 Quelles cartes pour le classement ?', description: escapeText(session.state.prompt),
        voters: new Set(session.players.keys()), options: [
            { value: 'common', label: 'Les mêmes cartes pour tout le monde' },
            { value: 'random', label: 'Un tirage par personne' }
        ], choose: leaders => startSocialChoices(session, 'classement', leaders.length ? shuffled(leaders)[0] : 'common')
    });
}

async function startSocialChoices(session, kind, mode = 'common') {
    const state = session.state;
    state.kind = kind;
    state.common = mode === 'common';
    const size = kind === 'fmk' ? 3 : 4;
    state.members = [...session.players.keys()];
    const common = sampleCards(size, new Set(), true);
    if (common.length < size) return finishGame(session, 'Le catalogue ne contient pas assez de cartes différentes pour ce jeu.');
    state.slots = new Map(state.members.map(id => [id, { cards: state.common ? common : sampleCards(size, new Set(), true),
        order: [], locked: false, reasons: null }]));
    gameStep(session, 'socialChoices');
    const ms = kind === 'fmk' ? 240_000 : 120_000;
    state.choiceDeadline = Date.now() + ms;
    const art = state.common ? await drawVoteCards(common).catch(error => { console.warn('[PLAY] Cartes du tirage :', error); return null; }) : null;
    await gameBoard(session, (kind === 'fmk' ? 'Répartis ces cartes entre **Fuck**, **Marry** et **Kill**.' :
        '**' + escapeText(state.prompt) + '**\n' + (state.common ? 'Tirage commun.' : 'Tirage individuel.')) +
        '\nChoisis tes cartes en privé. Fin ' + expiry(state.choiceDeadline) + '.',
    [row(gameButton(session, 'socialPanel', kind === 'fmk' ? 'Faire mes choix' : 'Faire mon classement', ButtonStyle.Primary))],
    art ? new AttachmentBuilder(art, { name: 'tirage.png' }) : null);
    phaseTimer(session, Math.max(1, state.choiceDeadline - Date.now()), () => finishSocialChoices(session));
}

function socialLabels(state) {
    return state.kind === 'fmk' ? FMK_LABELS : ['1er', '2e', '3e', '4e'];
}

function socialLines(state, slot) {
    return socialLabels(state).map((label, i) => '**' + label + '** · ' +
        (slot.order[i] ? escapeText(slot.cards.find(card => card.id === slot.order[i]).name) : '—')).join('\n');
}

function socialPanel(session, slot) {
    const state = session.state;
    const display = embed(state.kind === 'fmk' ? 'Tes choix FMK' : 'Ton classement')
        .setDescription(socialLines(state, slot) + (slot.locked ? '\n\nChoix verrouillés.' : ''));
    if (slot.artAvailable) display.setImage('attachment://mes-cartes.png');
    const remaining = slot.cards.filter(card => !slot.order.includes(card.id));
    const components = [];
    if (!slot.locked && remaining.length) components.push(row(gameSelect(session, 'socialPick',
        remaining.map(card => ({ value: card.id, label: cut(card.name, 100), description: 'N° ' + card.numCode })),
        'Carte pour ' + socialLabels(state)[slot.order.length])));
    if (!slot.locked) components.push(row(
        gameButton(session, 'socialReset', 'Recommencer').setDisabled(!slot.order.length),
        gameButton(session, 'socialLock', 'Verrouiller', ButtonStyle.Success).setDisabled(remaining.length > 0)
    ));
    if (slot.locked && state.kind === 'fmk' && !slot.reasons) {
        components.push(row(gameButton(session, 'socialReasons', 'Rédiger mes justifications', ButtonStyle.Primary)));
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
    return [...state.slots.values()].every(slot => slot.locked && (state.kind !== 'fmk' || slot.reasons !== null));
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
        await privateResponse(interaction, 'La consigne est enregistrée.');
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
        const art = !state.common ? await drawVoteCards(slot.cards).catch(error => { console.warn('[PLAY] Cartes du classement :', error); return null; }) : null;
        slot.artAvailable = Boolean(art);
        const payload = socialPanel(session, slot);
        if (art) {
            payload.files = [new AttachmentBuilder(art, { name: 'mes-cartes.png' })];
        }
        return interaction.editReply(payload);
    }
    if (op === 'fmkReasons' && state.kind === 'fmk' && slot.locked && !slot.reasons) {
        slot.reasons = FMK_LABELS.map((_, i) => interaction.fields.getTextInputValue('why' + i).trim());
        touchInteraction(session, interaction);
        await privateResponse(interaction, 'Tes justifications sont enregistrées.');
        if (socialAllReady(state)) await finishSocialChoices(session);
        return;
    }
    if (op === 'socialReasons' && state.kind === 'fmk' && slot.locked && !slot.reasons) {
        touchInteraction(session, interaction);
        return interaction.showModal(fmkModal(session, slot));
    }
    if (slot.locked) return privateResponse(interaction, 'Tes choix sont verrouillés.');
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
        await interaction.update(socialPanel(session, slot));
        if (socialAllReady(state)) await finishSocialChoices(session);
        return;
    } else return privateResponse(interaction, 'Complète la liste avant de la verrouiller.');
    touchInteraction(session, interaction);
    return interaction.update(socialPanel(session, slot));
}

async function fmkChart(common, slots) {
    const canvas = createCanvas(1100, 650);
    const ctx = canvas.getContext('2d');
    stage(ctx, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.font = 'bold 44px Sans';
    ctx.fillStyle = '#fff7e9';
    ctx.fillText('FMK · Résultats', 550, 78);
    const counts = common.map(card => ({
        card, values: FMK_LABELS.map((_, index) => [...slots.values()]
            .filter(slot => slot.locked && slot.order[index] === card.id).length)
    }));
    const max = Math.max(1, ...counts.flatMap(item => item.values));
    const colors = ['#ec73b6', '#87ddb6', '#ad99ed'];
    for (const [i, item] of counts.entries()) {
        const x = 185 + i * 365;
        await drawCard(ctx, item.card, x - 54, 102, 108, 151);
        ctx.fillStyle = '#fff7e9';
        ctx.font = 'bold 26px Sans';
        ctx.fillText(item.card.name, x, 290, 316);
        for (const [j, value] of item.values.entries()) {
            const y = 338 + j * 68;
            ctx.fillStyle = '#fff7e9';
            ctx.textAlign = 'left';
            ctx.font = 'bold 23px Sans';
            ctx.fillText(FMK_LABELS[j], x - 124, y);
            ctx.fillStyle = '#473452';
            ctx.fillRect(x - 124, y + 12, 236, 15);
            ctx.fillStyle = colors[j];
            ctx.fillRect(x - 124, y + 12, 236 * value / max, 15);
            ctx.fillStyle = '#fff7e9';
            ctx.textAlign = 'right';
            ctx.fillText(String(value), x + 115, y);
        }
        ctx.textAlign = 'center';
    }
    return canvas.toBuffer('image/png');
}

async function fmkPeopleCanvas(session, items, safe, pages) {
    const canvas = createCanvas(1100, 180 + 115 * items.length);
    const ctx = canvas.getContext('2d');
    stage(ctx, canvas.width, canvas.height);
    ctx.fillStyle = '#fff7e9';
    ctx.textAlign = 'center';
    ctx.font = 'bold 40px Sans';
    ctx.fillText('FMK · Choix · ' + (safe + 1) + '/' + pages, 550, 64);
    const avatars = await Promise.all(items.map(([id]) => loadAvatar(session.people.get(id))));
    for (const [i, [id, slot]] of items.entries()) {
        const y = 111 + i * 115;
        const player = session.people.get(id);
        ctx.fillStyle = '#312044';
        ctx.fillRect(46, y, 1008, 104);
        drawAvatar(ctx, avatars[i], player, 100, y + 51, 32);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#fff7e9';
        ctx.font = 'bold 25px Sans';
        ctx.fillText(player?.name || 'Participant·e', 160, y + 39, 850);
        ctx.font = '22px Sans';
        if (!slot.locked) ctx.fillText('Vote nul', 160, y + 76);
        else {
            for (const [j, label] of FMK_LABELS.entries()) {
                const card = slot.cards.find(item => item.id === slot.order[j]);
                ctx.fillText(label + ' · ' + card.name, 160 + j * 292, y + 76, 272);
            }
        }
        ctx.textAlign = 'center';
    }
    return canvas.toBuffer('image/png');
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
    const display = embed('FMK · Choix des participant·es').setDescription(selected.map(([id, slot]) =>
        '**' + escapeText(session.people.get(id)?.name || 'Participant·e') + '**\n' +
        (slot.locked ? socialLines({ kind: 'fmk' }, slot) : 'Vote nul')).join('\n\n'))
        .setFooter({ text: 'Page ' + (page + 1) + '/' + pages });
    const canvas = await fmkPeopleCanvas(session, selected, page, pages).catch(error => {
        console.warn('[PLAY] Canvas FMK des choix :', error);
        return null;
    });
    if (canvas) display.setImage('attachment://fmk-choix.png');
    await interaction.editReply({
        embeds: [display], attachments: [], files: canvas ? [new AttachmentBuilder(canvas, { name: 'fmk-choix.png' })] : [],
        components: pages > 1 ? [row(
            button(controlId(session, 'pages', lobby, page - 1), 'Précédente').setDisabled(!page),
            button(controlId(session, 'pages', lobby, page + 1), 'Suivante').setDisabled(page + 1 >= pages)
        )] : []
    });
}

async function publishFmk(session, state) {
    if (!session.fmkResults) session.fmkResults = new Map();
    session.fmkResults.set(session.lobbyId, { slots: state.slots });
    const common = state.slots.values().next().value.cards;
    const lines = common.map(card => '**' + escapeText(card.name) + '** — ' +
        FMK_LABELS.map((label, i) => label + ' ' + [...state.slots.values()]
            .filter(slot => slot.locked && slot.order[i] === card.id).length).join(' · '));
    const invalid = [...state.slots.values()].filter(slot => !slot.locked).length;
    const canvas = await fmkChart(common, state.slots).catch(error => { console.warn('[PLAY] Diagrammes FMK :', error); return null; });
    const result = embed('💌 FMK · Résultats').setDescription(lines.join('\n') + '\n\n' + invalid + ' vote(s) nul(s).');
    if (canvas) result.setImage('attachment://fmk-resultats.png');
    await session.thread.send({
        embeds: [result], files: canvas ? [new AttachmentBuilder(canvas, { name: 'fmk-resultats.png' })] : [],
        components: [row(button(controlId(session, 'pages', session.lobbyId, 0), 'Voir les choix individuels'))], allowedMentions: { parse: [] }
    });
}

async function finishSocialChoices(session) {
    const state = session.state;
    gameStep(session, 'socialReveal');
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
    if (session.board) await editThreadMessage(session, session.board, { components: [] });
    session.board = null;
    state.presenter = presenter;
    const slot = state.slots.get(presenter);
    gameStep(session, 'presenting');
    const choices = socialLines(state, slot);
    const ms = state.kind === 'fmk' ? 30_000 : 60_000;
    let details = '';
    let attachment = null;
    if (state.kind === 'fmk') {
        const reasons = FMK_LABELS.map((label, index) => label + ' · ' +
            (slot.reasons?.[index] || (slot.reasons ? 'Aucune justification' : 'Temps écoulé')));
        details = '\n\n' + reasons.map(escapeText).join('\n\n');
        if (details.length > 3300) {
            details = '\n\nJustifications complètes dans le fichier joint.';
            const display = embed(gameTitle(session)).setDescription(playerRef(session, presenter) + ' · ' + choices + details);
            session.board = await session.thread.send({ embeds: [display], files: [
                new AttachmentBuilder(Buffer.from(reasons.join('\n\n')), { name: 'justifications.txt' })
            ], components: [row(gameButton(session, 'presentDone', 'J’ai fini', ButtonStyle.Success),
                gameButton(session, 'presentPass', 'Passer'))], allowedMentions: { parse: [] }, content: playerRef(session, presenter) });
            phaseTimer(session, ms, () => presentNext(session));
            return;
        }
    } else {
        const art = await drawVoteCards(slot.order.map(id => slot.cards.find(card => card.id === id)))
            .catch(error => { console.warn('[PLAY] Cartes présentées :', error); return null; });
        if (art) attachment = new AttachmentBuilder(art, { name: 'classement.png' });
    }
    await gameBoard(session, '**Présentation ' + state.presentIndex + '/' + state.presenters.length + '**\n' + playerRef(session, presenter) + '\n\n' +
        choices + details + (state.kind === 'classement' ? '\n\nTu as une minute pour défendre ton classement.' : ''),
    [row(gameButton(session, 'presentDone', 'J’ai fini', ButtonStyle.Success), gameButton(session, 'presentPass', 'Passer'))],
    attachment, [presenter]);
    phaseTimer(session, ms, () => presentNext(session));
}

async function socialFinalVote(session) {
    const state = session.state;
    const ids = state.kind === 'fmk' ? state.presenters.filter(id => state.slots.get(id).reasons?.some(Boolean)) : state.presenters;
    if (!ids.length) return finishGame(session, 'Merci d’avoir joué ! Aucune justification à départager.');
    const voters = await threadVoters(session);
    if (!voters.size) return finishGame(session, 'Les présentations sont terminées.');
    const title = state.kind === 'fmk' ? '💌 Vote pour la meilleure justification' : '📋 Vote pour le classement le mieux défendu ou le plus drôle';
    if (session.board) await editThreadMessage(session, session.board, { components: [] });
    session.board = null;
    await openBallot(session, {
        title, description: 'Sélectionne une personne.', voters,
        options: ids.map(value => ({ value, label: session.people.get(value)?.name || 'Participant·e' })),
        choose: leaders => finishGame(session, leaders.length ? '**' + (leaders.length > 1 ? 'Ex æquo' : 'Victoire') +
            '** · ' + leaders.map(id => playerRef(session, id)).join(', ') : 'Aucun vote enregistré. Merci d’avoir joué !')
    });
}

function touchInteraction(session, interaction) {
    if (!session.bots.has(interaction.user.id)) persistRecordActivity(session.record, interaction.client);
}

async function gameInteraction(interaction, session, [lobby, revision, op, argument]) {
    const state = session.state;
    if (!state || session.phase !== 'game' || session.lobbyId !== Number(lobby) || state.revision !== Number(revision) ||
        (session.deadline > 0 && Date.now() >= session.deadline)) return privateResponse(interaction, 'Cette action a expiré.');
    if (session.game === 'devine') return devineAction(interaction, session, op, argument);
    if (session.game === 'casting') return castingAction(interaction, session, op);
    if (session.game === 'classement' || session.game === 'fmk') return socialAction(interaction, session, op);
    return privateResponse(interaction, 'Cette action n’est pas disponible.');
}


const STEP_TIPS = {
    volunteer: '**Être volontaire** t’ajoute au tirage du maître du jeu.',
    mjReady: '**Ouvrir la carte secrète** n’est utilisable que par le MJ. La carte reste cachée au groupe.',
    turn: '**Poser une question** ouvre un formulaire. **Proposer une carte** envoie une tentative privée. **Passer** garde ton quota. **Classeur** ouvre le catalogue complet.',
    waitingMJ: '**Ouvrir le pupitre MJ** montre la question en privé et permet de répondre Oui, Non ou À reformuler.',
    stopVote: '**Arrêter** ajoute ta voix. Il faut au moins la moitié des enquêteurs inscrits.',
    dormant: '**Reprendre la partie** relance le tour. **Reprendre ma place** te réinscrit dans la rotation si ton chrono a expiré deux fois.',
    finalGuess: '**Proposer ma dernière carte** envoie une tentative privée unique. **Classeur** permet de revoir le catalogue.',
    castingSetup: 'Le menu combine le format du débat et l’origine de la question. Seul l’hôte choisit.',
    castVolunteer: '**Je veux débattre** t’inscrit au tirage des deux personnes qui débattent.',
    castPrompt: '**Écrire la question** ouvre le formulaire de la personne désignée.',
    castCards: '**Voir ma carte** ouvre le tirage en privé. Tu peux la changer trois fois ou la verrouiller.',
    rankSetup: '**Consigne préparée** tire une question. **Consigne d’un membre** désigne sa personne au hasard.',
    rankWrite: '**Écrire la consigne** ouvre le formulaire de la personne désignée.',
    socialChoices: 'Ouvre ton panneau privé, place tes cartes dans l’ordre demandé, puis clique sur **Verrouiller**.',
    presenting: '**J’ai fini** et **Passer** donnent la parole à la personne suivante.'
};

function playerRef(session, id) {
    const bot = session.bots.get(id);
    return bot ? escapeText(bot.name) : '<@' + id + '>';
}

function playCardsFor(session, id) {
    if (!session.test) return getPlayCards(id);
    return getPlayCatalog().map(card => ({ ...card, setLabel: 'Set ' + card.id.split('-')[0] }));
}

function settingsPayload(session, invites = false) {
    const view = embed('⚙️ Paramètres du fil').setDescription(session.test ?
        'Les adversaires sont simulés. Le chronomètre de cette étape peut être avancé pour tester la suivante.' :
        '**Accès :** ' + (session.invited ? 'Sur invitation' : 'Ouvert') + ' · **Arrivées en cours :** ' + (session.allowLate ? 'ouvertes' : 'fermées') +
        '\nLes personnes qui arrivent en cours de jeu entrent à la manche suivante.');
    const current = session.advancePhase && session.deadline > Date.now();
    if (session.test) return { embeds: [view], components: [row(
        button(controlId(session, 'skipClock', session.lobbyId, session.timerRevision), 'Avancer le chrono', ButtonStyle.Primary).setDisabled(!current)
    )] };
    const components = [row(
        button(controlId(session, 'settingsLate', session.lobbyId), session.allowLate ? 'Fermer les arrivées' : 'Ouvrir les arrivées'),
        button(controlId(session, 'settingsInvite', session.lobbyId), 'Ajouter des invités').setDisabled(!session.invited)
    )];
    if (invites) components.push(row(new UserSelectMenuBuilder().setCustomId(controlId(session, 'settingsUsers', session.lobbyId))
        .setPlaceholder('Ajouter des membres à la liste des invités').setMaxValues(25)));
    return { embeds: [view], components };
}

async function threadSettings(interaction, session, action, parts) {
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
        await interaction.update({ embeds: [embed('⚙️ Paramètres du fil').setDescription('Chrono de test avancé.')], components: [] });
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
        client: session.thread.client, values, fields: { getTextInputValue: key => fields[key] ?? '' },
        reply: noop, update: noop, deferUpdate: noop, deferReply: noop, editReply: noop, showModal: noop
    };
}

function scheduleTestBots(session, revision, ms) {
    const delay = Math.min(Math.max(1, ms - 50), 900 + randomInt(1101));
    session.botTimer = setTimeout(() => {
        void enqueue(session, async () => {
            if (sessions.get(session.thread.id) !== session || session.timerRevision !== revision || session.phase === 'closed') return;
            await runTestBots(session, revision);
        }).catch(error => recoverSession(session, error));
    }, delay);
    session.botTimer.unref();
}

const BOT_REASONS = ['Le dossier est solide.', 'Toute la salle avait déjà deviné.', 'Ça répond à la question sans vraiment y répondre.',
    'Il fallait trancher.', 'La carte a gagné au premier regard.', 'Ce choix fait plus de sens dans ma tête.'];
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
            await session.thread.send({ content: '🤖 **' + escapeText(session.bots.get(id).name) + '** propose **' + escapeText(guess.name) + '**.',
                allowedMentions: { parse: [] } });
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
                    const query = shuffled(['La carte est-elle légendaire ?', 'Son numéro est-il supérieur à 50 ?', 'Le nom contient-il plusieurs mots ?',
                        'Est-ce une carte du premier set ?', 'Est-ce une carte Négative ?'])[0];
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
            if (state.slots.has(id)) await session.thread.send({
                content: '🤖 **' + escapeText(session.bots.get(id).name) + '** défend **' +
                    escapeText(state.slots.get(id).card.name) + '** : ' + botReason(), allowedMentions: { parse: [] }
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
                    await session.thread.send({ content: '🤖 **' + escapeText(session.bots.get(id).name) + '** : ' + botReason(), allowedMentions: { parse: [] } });
                }
                return socialAction(interaction, session, 'presentDone');
            }
            break;
    }
}

module.exports = { handlePlayMessage, handlePlayInteraction, restorePlayThreads };
