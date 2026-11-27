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
const { getPlayCards, renderPlayBinder } = require('./tcg.js');

const PLAY_CHANNEL_ID = '1575601558458994758';
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
    vitrine: ['Vitrine à thème', 'Choisis 1 ou 2 cartes de ton classeur pour compléter la phrase. Les réponses défilent anonymement pendant 10 secondes chacune. Tu peux noter chaque réponse des autres. Une note manquante vaut Meh. J’adore ! s’utilise une fois sur les 5 manches.'],
    cavale: ['Cartes en cavale', 'Retrouve le nom d’une carte à partir d’un détail zoomé.'],
    casting: ['Casting de l’enfer', 'Défends une carte tirée au hasard lors d’un débat de cinq minutes.'],
    devine: ['Devine-carte', 'Pose des questions au maître du jeu pour découvrir la carte secrète.'],
    classement: ['Le Classement impossible', 'Classe quatre cartes selon la consigne, puis présente ta liste.'],
    fmk: ['Fuck, Marry, Kill', 'Répartis trois cartes entre les trois choix et justifie-les.']
};
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
    const data = [...threadRecords.values()].map(({ id, lastActivity, slowmode }) => ({ id, lastActivity, slowmode }));
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
    if (thread?.isThread() && thread.parentId === PLAY_CHANNEL_ID && thread.ownerId === client.user.id) {
        await thread.delete('Mini-jeu RegaDex inactif depuis 15 minutes').catch(error => {
            if (error.code !== 10003) throw error;
        });
    }
    const session = sessions.get(record.id);
    if (session) clearTimeout(session.timer);
    sessions.delete(record.id);
    threadRecords.delete(record.id);
    saveThreadRecords();
}

async function restorePlayThreads(client) {
    try {
        const saved = fs.existsSync(STATE_PATH) ? JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')) : [];
        for (const item of saved) {
            if (!/^\d{17,22}$/.test(item.id) || !Number.isFinite(item.lastActivity)) continue;
            const record = { ...item, timer: null };
            threadRecords.set(record.id, record);
            scheduleCleanup(record, client);
            if (Number.isInteger(record.slowmode) && record.slowmode >= 0 && record.slowmode <= 21_600) {
                try {
                    const thread = await client.channels.fetch(record.id, { force: true });
                    if (thread?.isThread() && thread.parentId === PLAY_CHANNEL_ID && thread.ownerId === client.user.id) {
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
    const main = embed('Mini-jeux RegaDex');
    const select = new StringSelectMenuBuilder().setCustomId(idFor(guide ? 'guidegame' : 'game', menu.id));
    if (guide) {
        const current = GUIDES[guide];
        main.setDescription(current ? '**' + current[0] + '**\n' + current[1] : 'Choisis un mini-jeu pour lire son guide.');
        select.setPlaceholder('Quel guide veux-tu lire ?').addOptions(Object.entries(GUIDES).map(([value, [label]]) => ({ label, value })));
        return { embeds: [main], components: [row(select), row(button(idFor('menu', menu.id), 'Retour'))] };
    }
    main.setDescription('Choisis un mini-jeu ou consulte son guide.');
    select.setPlaceholder('Choisir un mini-jeu').addOptions({ label: GUIDES.vitrine[0], value: 'vitrine' });
    return { embeds: [main], components: [row(select), row(button(idFor('guide', menu.id), 'Guide'))] };
}

function launchMenu(menu) {
    const preview = embed('Vitrine à thème').setDescription('Choisis comment ouvrir les inscriptions. Le fil sera public.');
    return { embeds: [preview], components: [
        row(button(idFor('open', menu.id), 'Ouvert', ButtonStyle.Primary), button(idFor('invite', menu.id), 'Sur invitation')),
        row(button(idFor('menu', menu.id), 'Retour'))
    ] };
}

async function handlePlayMessage(message) {
    if (message.author.bot) return false;
    const record = threadRecords.get(message.channelId);
    if (record && message.channel.parentId === PLAY_CHANNEL_ID) persistRecordActivity(record, message.client);
    if (message.channelId !== PLAY_CHANNEL_ID || !/^!play$/i.test(message.content.trim())) return false;
    if (!recordsReady) {
        await message.reply({ content: 'Les mini-jeux sont en cours de chargement.', allowedMentions: { repliedUser: false } });
        return true;
    }
    const menu = { id: message.id, owner: message.author.id, launching: false, expires: Date.now() + IDLE_MS };
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

async function createSession(interaction, menu, invited = null) {
    menu.launching = true;
    try {
        await interaction.deferUpdate();
        const thread = await interaction.message.startThread({
            name: 'Vitrine à thème · ' + cut(readPlayer(interaction).name, 65),
            autoArchiveDuration: 60,
            reason: 'Mini-jeu créé via !play'
        });
        const record = { id: thread.id, lastActivity: Date.now(), slowmode: null, timer: null };
        threadRecords.set(thread.id, record);
        scheduleCleanup(record, thread.client);
        saveThreadRecords();

        const hostPlayer = readPlayer(interaction);
        const session = {
            thread, record, host: menu.owner, invited, allowLate: false, queue: Promise.resolve(),
            players: new Map([[menu.owner, hostPlayer]]), people: new Map([[menu.owner, hostPlayer]]), pending: new Map(),
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
        await interaction.editReply({ embeds: [embed('Vitrine à thème').setDescription('La partie est ouverte dans <#' + thread.id + '>.')], components: [] });
    } finally {
        menu.launching = false;
    }
}

function controlId(session, action, ...rest) {
    return idFor(action, session.thread.id, ...rest);
}

function sessionButtons(session, joinLabel = 'Rejoindre') {
    return row(
        button(controlId(session, 'join', session.lobbyId), joinLabel, ButtonStyle.Primary).setDisabled(session.phase !== 'lobby' && !session.allowLate),
        button(controlId(session, 'late', session.lobbyId), 'Arrivées en cours : ' + (session.allowLate ? 'ouvertes' : 'fermées')),
        button(controlId(session, 'cancel', session.lobbyId), 'Annuler', ButtonStyle.Danger)
    );
}

function lobbyPayload(session) {
    return { embeds: [embed('Vitrine à thème · Inscriptions').setDescription(
        '**' + session.players.size + '** inscrit·es · ' +
        (session.invited ? 'Sur invitation' : 'Ouvert') + '\nDébut ' + expiry(session.deadline)
    )], components: [sessionButtons(session)] };
}

async function openLobby(session) {
    await session.lobby?.edit({ components: [] });
    for (const [id, player] of session.pending) session.players.set(id, player);
    session.pending.clear();
    session.phase = 'lobby';
    session.lobbyId = (session.lobbyId || 0) + 1;
    session.round = 0;
    session.scores = new Map();
    session.loveUsed = new Set();
    session.best = [];
    session.prompts = shuffled(PROMPTS);
    session.usedPrompts = new Set();
    session.deadline = Date.now() + JOIN_MS;
    session.lobby = await session.thread.send(lobbyPayload(session));
    phaseTimer(session, Math.max(1, session.deadline - Date.now()), () => startRound(session));
}

async function updateLobby(session) {
    if (session.phase === 'lobby') await session.lobby.edit(lobbyPayload(session));
    else if (session.phase !== 'closed') {
        await session.lobby.edit({
            embeds: [embed('Vitrine à thème · Partie en cours').setDescription('Les arrivées rejoignent la partie à la manche suivante.')],
            components: [sessionButtons(session, 'Rejoindre la prochaine manche')]
        });
    }
}

function pickPayload(session) {
    return { embeds: [embed('Vitrine à thème · Manche ' + session.round + '/' + ROUND_COUNT)
        .setDescription('**' + session.prompt + '**\n\n' + session.holes + ' carte(s) à choisir · ' +
            session.answers.size + '/' + session.roundPlayers.size + ' réponses · Fin ' + expiry(session.deadline))],
    components: [row(button(controlId(session, 'pick', session.lobbyId, session.round), 'Choisir ma réponse', ButtonStyle.Primary),
        button(controlId(session, 'binder'), 'Classeur'))] };
}

async function startRound(session) {
    for (const [id, player] of session.pending) session.players.set(id, player);
    session.pending.clear();
    const starting = session.round === 0;
    session.round++;
    const cardCounts = new Map([...session.players.keys()].map(id => [id, getPlayCards(id).length]));
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

function playingCards(player, draft) {
    const query = normalize(draft.query);
    const prefix = [];
    const other = [];
    for (const card of getPlayCards(player)) {
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
    const cards = draft.cards.map(id => getPlayCards(user).find(c => c.id === id)).filter(Boolean);
    const key = [session.lobbyId, session.round, user];
    const available = playingCards(user, draft);
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
        await session.board.edit({ embeds: [embed('Manche ' + session.round).setDescription('Il faut deux réponses valides pour ouvrir le vote.')], components: [] });
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
        .setDescription(escapeText(completePhrase(session.prompt, entry.cards))).setFooter({ text: '10 secondes pour voter • Sans note : Meh' });
    if (cardImage) page.setImage('attachment://reponse.png');
    await session.board.edit({
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
    await session.board.edit({ embeds: [reveal], components: [], attachments: [] });
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
    const mentionList = set => [...set].map(id => '<@' + id + '>').join(', ') || '—';
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
    await session.continueMessage.edit({ components: [] });
    for (const [user] of session.players) {
        if (!session.continuing.has(user)) session.players.delete(user);
    }
    for (const user of session.leaving) {
        session.optedOut.add(user);
        await session.thread.members.remove(user).catch(error => console.warn('[PLAY] Désinscription du fil :', error));
    }
    if (!session.players.size || session.players.size + session.pending.size < 2) {
        await closeSession(session, 'Session terminée. Merci d’avoir joué !');
        return;
    }
    session.phase = 'nextGame';
    session.nextVotes = new Set();
    session.deadline = Date.now() + CONTINUE_MS;
    session.nextMessage = await session.thread.send({
        embeds: [embed('Prochain mini-jeu').setDescription('Votez pour la prochaine partie. Fin ' + expiry(session.deadline))],
        components: [row(button(controlId(session, 'replay', session.lobbyId), 'Vitrine à thème', ButtonStyle.Primary))]
    });
    phaseTimer(session, Math.max(1, session.deadline - Date.now()), () => finishNextVote(session));
}

async function finishNextVote(session) {
    clearTimeout(session.timer);
    await session.nextMessage.edit({ components: [] });
    if (!session.nextVotes.size) {
        await closeSession(session, 'Aucun vote enregistré. La session est terminée.');
        return;
    }
    if (!session.players.has(session.host)) session.host = session.players.keys().next().value || session.host;
    await openLobby(session);
}

async function closeSession(session, reason) {
    session.phase = 'closed';
    clearTimeout(session.timer);
    await restoreSlowmode(session).catch(error => console.error('[PLAY] Restauration du mode lent :', error));
    const messages = [session.lobby, session.board, session.continueMessage, session.nextMessage].filter(Boolean);
    await Promise.allSettled(messages.map(message => message.edit({ components: [] })));
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
        case 'game': return interaction.update(launchMenu(menu));
        case 'open': return createSession(interaction, menu);
        case 'invite': {
            const users = new UserSelectMenuBuilder().setCustomId(idFor('inviteusers', menu.id))
                .setPlaceholder('Choisir les membres invités').setMinValues(1).setMaxValues(25);
            return interaction.update({ embeds: [embed('Sur invitation').setDescription('Sélectionne les membres qui pourront jouer.')],
                components: [row(users), row(button(idFor('game', menu.id), 'Retour'))] });
        }
        case 'inviteusers': return createSession(interaction, menu, new Set([menu.owner, ...interaction.values]));
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
    persistRecordActivity(session.record, interaction.client);
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
    persistRecordActivity(session.record, interaction.client);
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
        if (draft.cards.length < session.holes && playingCards(id, draft).some(card => card.id === selected)) {
            draft.cards.push(selected);
            draft.query = '';
            draft.page = 0;
        }
    }
    if (action === 'lock') {
        const owned = getPlayCards(id);
        const selected = draft.cards.map(cardId => owned.find(card => card.id === cardId));
        if (selected.length !== session.holes || selected.some(card => !card)) return privateResponse(interaction, 'Choisis toutes les cartes dans ton classeur.');
        session.answers.set(id, { user: id, cards: selected, votes: new Map(), score: 0 });
        await interaction.update({ embeds: [embed('Réponse enregistrée').setDescription(escapeText(completePhrase(session.prompt, selected)))], components: [] });
        if (session.answers.size >= session.roundPlayers.size) await startRatings(session);
        else await session.board.edit(pickPayload(session));
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
    if (session.phase === 'closed') return privateResponse(interaction, 'Cette partie est terminée.');
    if (['join', 'late', 'cancel'].includes(action) && Number(parts[0]) !== session.lobbyId)
        return privateResponse(interaction, 'Ce menu d’inscription a expiré.');
    if (action === 'rate') return rateResponse(interaction, session, parts);
    if (['pick', 'query', 'search', 'prev', 'next', 'clear', 'swap', 'card', 'lock'].includes(action))
        return pickInteraction(interaction, session, action, parts);
    if (action === 'join') {
        if (session.optedOut.has(user) || (session.invited && !session.invited.has(user)))
            return privateResponse(interaction, 'Cette partie ne t’est pas ouverte.');
        if (session.players.has(user) || session.pending.has(user)) return privateResponse(interaction, 'Tu es déjà inscrit·e.');
        if (session.phase === 'lobby' && Date.now() >= session.deadline) return privateResponse(interaction, 'Les inscriptions viennent de se terminer.');
        if (session.phase !== 'lobby' && !session.allowLate) return privateResponse(interaction, 'Les arrivées en cours sont fermées.');
        const target = session.phase === 'lobby' ? session.players : session.pending;
        target.set(user, player);
        session.people.set(user, player);
        persistRecordActivity(session.record, interaction.client);
        await privateResponse(interaction, session.phase === 'lobby' ? 'Tu es inscrit·e !' : 'Tu rejoindras la prochaine manche ou session.');
        if (session.phase === 'lobby') await updateLobby(session);
        return;
    }
    if (action === 'late' || action === 'cancel') {
        if (session.host !== user) return privateResponse(interaction, 'Cette commande est réservée à l’hôte.');
        persistRecordActivity(session.record, interaction.client);
        await interaction.deferUpdate();
        if (action === 'cancel') await closeSession(session, 'Partie annulée par l’hôte.');
        else {
            session.allowLate = !session.allowLate;
            await updateLobby(session);
        }
        return;
    }
    if (['yes', 'leave', 'replay'].includes(action)) {
        const phase = action === 'replay' ? 'nextGame' : 'continue';
        if (session.phase !== phase || Number(parts[0]) !== session.lobbyId || Date.now() >= session.deadline)
            return privateResponse(interaction, 'Ce vote est terminé.');
        if (!session.players.has(user)) return privateResponse(interaction, 'Ce vote est réservé au groupe de jeu.');
        persistRecordActivity(session.record, interaction.client);
        await interaction.deferUpdate();
        if (action === 'replay') {
            session.nextVotes.add(user);
            if (session.nextVotes.size >= session.players.size) await finishNextVote(session);
        } else {
            session.continuing.delete(user);
            session.leaving.delete(user);
            (action === 'yes' ? session.continuing : session.leaving).add(user);
            if (session.continuing.size + session.leaving.size >= session.players.size) await finishContinue(session);
            else await session.continueMessage.edit(continuePayload(session));
        }
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
        if (menu && interaction.channelId === PLAY_CHANNEL_ID && interaction.message?.id === menu.messageId && menu.expires > Date.now())
            await menuInteraction(interaction, action, menu);
        else if (session && interaction.channelId === id && interaction.channel.parentId === PLAY_CHANNEL_ID) {
            // Les votes et formulaires sont acquittés aussitôt, même si un Canvas est en cours.
            if (action === 'rate' || ['pick', 'query', 'search', 'prev', 'next', 'clear', 'swap', 'card', 'binder', 'browse', 'binderset', 'standing'].includes(action))
                await sessionInteraction(interaction, session, action, parts);
            else await enqueue(session, () => sessionInteraction(interaction, session, action, parts));
        } else await privateResponse(interaction, 'Ce menu a expiré. Lance une nouvelle partie avec !play.');
    } catch (error) {
        console.error('[PLAY] Interaction :', error);
        if (!interaction.deferred && !interaction.replied) await privateResponse(interaction, 'Le mini-jeu a rencontré une erreur.').catch(() => {});
        else await interaction.followUp({ content: 'Le mini-jeu a rencontré une erreur.', flags: MessageFlags.Ephemeral }).catch(() => {});
        if (session && ['lock', 'join', 'late', 'cancel', 'yes', 'leave', 'replay'].includes(action))
            await recoverSession(session, error);
    }
    return true;
}

module.exports = { handlePlayMessage, handlePlayInteraction, restorePlayThreads };
