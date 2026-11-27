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

const REGAIA_GUILD_ID = '720057528351850547';
const PLAY_CHANNEL_ID = '1575601558458994758';
const PLAY_TEST_CHANNEL_ID = '1480756332373213275';
const PLAY_TEST_OWNER_ID = '436218312574107658';
const TEST_NAMES = ['Moka', 'Pixel', 'Biscotte'];
const STATE_PATH = process.env.REGADEX_PLAY_STATE_PATH || path.join(__dirname, '.play-threads.json');
const TCG_BG_PATH = path.resolve(process.cwd(), 'TCG', 'Assets', 'Background RegaDex B.jpg');
const IDLE_MS = 15 * 60_000;
const JOIN_MS = 30_000;
const PICK_MS = 90_000;
const RATE_MS = 10_000;
const CONTINUE_MS = 60_000;
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
    castDebate: 'Débattez dans le fil • L’hôte peut passer au vote à tout moment.',
    rankSetup: 'Consigne préparée tire une question • Consigne d’un membre désigne quelqu’un au hasard.',
    rankWrite: 'Écrire la consigne ouvre le formulaire de la personne désignée.',
    socialChoices: 'Ouvre ton panneau privé, place tes cartes puis verrouille.',
    presenting: 'J’ai fini et Passer donnent la parole à la personne suivante.'
};

const menus = new Map();
const sessions = new Map();
const threadRecords = new Map();
let recordsReady = false;
let playBgCache = null;

const escapeText = text => String(text).replace(/[\\`*_~|<>]/g, '\\$&');
const normalize = text => String(text).normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase();
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
                    if (thread?.isThread() && thread.parentId === record.parentId && thread.ownerId === client.user.id && !thread.archived) {
                        await thread.setRateLimitPerUser(record.slowmode, 'Reprise après redémarrage de Cacabot');
                    }
                    record.slowmode = null;
                } catch (error) {
                    if (IGNORABLE_DISCORD_CODES.has(error?.code)) {
                        record.slowmode = null;
                    }
                    console.warn('[PLAY] Restauration du mode lent :', error?.code || error?.message || error);
                }
            }
        }
        if (saved.length) saveThreadRecords();
    } catch (error) {
        console.error('[PLAY] Lecture du registre des fils :', error);
    } finally {
        recordsReady = true;
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
    if (guide) {
        const current = GUIDES[guide];
        const minP = MIN_PLAYERS[guide];
        const main = embed(current ? current[2] + ' Guide — ' + current[0] : '📘 Guide des mini-jeux RegaDex', gameColor(guide) || 0x3498db)
            .setAuthor({ name: menu.test ? 'RegaDex Arcade • Guide (Mode test)' : 'RegaDex Arcade • Règles & Astuces' })
            .setDescription(
                current
                    ? current[3] + '\n' + SEP + '\n• **Joueurs minimum :** `' + minP + '`\n• **Durée :** ' + GAME_META[guide]
                    : 'Choisis un mini-jeu dans le menu ci-dessous pour découvrir son fonctionnement.'
            )
            .setFooter({ text: 'RegaDex Arcade • Sélectionne un autre jeu ou reviens au salon' });
        const select = new StringSelectMenuBuilder()
            .setCustomId(idFor('guidegame', menu.id))
            .setPlaceholder('Quel guide veux-tu lire ?')
            .addOptions(Object.entries(GUIDES).map(([value, [label, , emoji]]) => ({ label, value, emoji, default: value === guide })));
        return { embeds: [main], components: [row(select), row(button(idFor('menu', menu.id), 'Retour au menu', ButtonStyle.Secondary, '⬅️'))] };
    }

    const main = embed(menu.test ? '🧪 Mini-jeux RegaDex Arcade • Mode test' : '🎮 Mini-jeux RegaDex Arcade', 0xf1c40f)
        .setAuthor({ name: menu.test ? 'RegaDex Arcade • Environnement de test' : 'RegaDex Arcade • Salon de jeu' })
        .setDescription(
            (menu.test
                ? 'Choisis un jeu, puis ajoute **1 à 3 adversaires simulés**.\nLes cartes et décisions des bots sont tirées au hasard.\n'
                : 'Choisis un mini-jeu ci-dessous pour ouvrir un **fil dédié**.\nL’hôte pourra lancer la partie dès que le minimum de joueurs est atteint *(ou après 30s d’inscriptions)*.\n') +
            SEP
        )
        .addFields(Object.entries(GUIDES).map(([key, [name, value, icon]]) => ({
            name: icon + ' ' + name,
            value: value + '\n-# 👥 Min. `' + MIN_PLAYERS[key] + '` • ⏱️ ' + GAME_META[key],
            inline: true
        })))
        .setFooter({ text: 'Cartes classiques uniquement (hors Holo, Full Art & Négatives) • Enchaînement par vote' });

    const select = new StringSelectMenuBuilder()
        .setCustomId(idFor('game', menu.id))
        .setPlaceholder('🎲 Choisir un mini-jeu à lancer...')
        .addOptions(Object.entries(GUIDES).map(([value, [label, description, emoji]]) => ({
            label,
            value,
            description: cut('Min. ' + MIN_PLAYERS[value] + ' • ' + description, 100),
            emoji
        })));

    return { embeds: [main], components: [row(select), row(button(idFor('guide', menu.id), 'Guide des jeux', ButtonStyle.Secondary, '📘'))] };
}

function launchMenu(menu) {
    const [name, description, icon, rules] = GUIDES[menu.game];
    if (menu.test) {
        const preview = embed('🧪 ' + icon + ' ' + name + ' • Mode test', gameColor(menu.game))
            .setAuthor({ name: 'RegaDex Arcade • Test avec bots' })
            .setDescription(description + '\n' + SEP)
            .addFields({ name: 'Configuration', value: 'Choisis le nombre de bots. Tu joues normalement et peux avancer le chrono depuis **Paramètres du fil**.' });
        return {
            embeds: [preview],
            components: [
                row(new StringSelectMenuBuilder().setCustomId(idFor('bots', menu.id)).setPlaceholder('Nombre de bots')
                    .addOptions(TEST_NAMES.map((_, i) => ({ label: String(i + 1) + ' bot(s)', value: String(i + 1), emoji: '🤖' })))),
                row(button(idFor('menu', menu.id), 'Retour', ButtonStyle.Secondary, '⬅️'))
            ]
        };
    }

    const preview = embed(icon + ' ' + name, gameColor(menu.game))
        .setAuthor({ name: 'RegaDex Arcade • Configuration de partie' })
        .setDescription('### 📜 Principe\n' + description + '\n-# ' + rules + '\n' + SEP)
        .addFields(
            { name: '🌐 Partie ouverte', value: 'Tous les membres du salon peuvent rejoindre librement.', inline: true },
            { name: '🎟️ Sur invitation', value: 'Seuls les membres sélectionnés pourront s’inscrire.', inline: true },
            { name: '⏱️ Format', value: 'Min. `' + MIN_PLAYERS[menu.game] + '` joueur(s) • ' + GAME_META[menu.game], inline: false }
        )
        .setFooter({ text: 'Le fil reste public en lecture • 30s d’inscriptions max' });
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
    const trimmed = message.content.trim();
    const test = /^!playx$/i.test(trimmed);
    if (test && (message.channelId !== PLAY_TEST_CHANNEL_ID || message.author.id !== PLAY_TEST_OWNER_ID)) return false;
    if (!test) {
        if (!/^!play$/i.test(trimmed)) return false;
        if (!message.guild || message.guild.id !== REGAIA_GUILD_ID) return false;
        if (message.channelId !== PLAY_CHANNEL_ID) {
            const warn = await message.reply(silent({
                content: `🎮 <@${message.author.id}>, les mini-jeux **RegaDex Arcade** (\`!play\`) se lancent uniquement dans le salon dédié : <#${PLAY_CHANNEL_ID}>.`
            })).catch(() => null);
            if (warn) {
                const t = setTimeout(() => {
                    warn.delete().catch(() => {});
                    message.delete().catch(() => {});
                }, 8000);
                t.unref?.();
            }
            return true;
        }
    }
    if (!recordsReady) {
        await message.reply(silent({ content: '⏳ Les mini-jeux sont en cours de chargement, réessaie dans quelques secondes.' }));
        return true;
    }
    const menu = { id: message.id, owner: message.author.id, channelId: message.channelId, test, launching: false, expires: Date.now() + IDLE_MS };
    const reply = await message.reply(silent(chooseGameMenu(menu)));
    menu.messageId = reply.id;
    menus.set(menu.id, menu);
    setTimeout(() => menus.delete(menu.id), IDLE_MS).unref();
    return true;
}

function readPlayer(interaction) {
    return {
        id: interaction.user.id,
        name: interaction.member?.displayName || interaction.user.globalName || interaction.user.username,
        avatar: interaction.user.displayAvatarURL({ extension: 'png', size: 128 })
    };
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
            optedOut: new Set(), results: new Map(), timer: null, botTimer: null, round: 0
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
        await interaction.editReply({
            embeds: [embed(icon + ' ' + name + ' • Fil ouvert', gameColor(session.game))
                .setAuthor({ name: 'RegaDex Arcade • Session prête' })
                .setDescription(summary + '\n' + SEP + '\n🧵 **Fil de jeu :** <#' + thread.id + '>')
                .addFields({
                    name: 'Dans le fil',
                    value: session.test
                        ? 'Mode test avec **' + bots.size + ' bot(s)**. Utilise **⚙️ Paramètres** dans le fil pour avancer le chrono.'
                        : 'Clique sur **🙋 Rejoindre** dans le fil sous 30 secondes *(ou **▶️ Démarrer** si tu es l’hôte)*.'
                })],
            components: [row(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Ouvrir le fil')
                .setURL('https://discord.com/channels/' + thread.guildId + '/' + thread.id))]
        });
    } finally {
        menu.launching = false;
    }
}

async function editThreadMessage(session, message, payload) {
    if (!message) return null;
    try {
        return await session.thread.messages.edit(message.id, payload);
    } catch (error) {
        if (error?.code === 10008) {
            const hasContent = Boolean(payload?.embeds?.length || payload?.content);
            if (!hasContent) return null;
            const resend = { ...payload };
            delete resend.attachments;
            return session.thread.send(resend).catch(() => null);
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
    return idFor(action, session.thread.id, ...rest);
}

function sessionButtons(session, joinLabel = 'Rejoindre') {
    if (session.phase === 'lobby') {
        const minRequired = MIN_PLAYERS[session.game] || 1;
        return [
            row(
                button(controlId(session, 'join', session.lobbyId), joinLabel, ButtonStyle.Success, '🙋').setDisabled(session.test),
                button(controlId(session, 'quit', session.lobbyId), 'Quitter', ButtonStyle.Secondary, '🚪').setDisabled(session.test),
                button(controlId(session, 'startnow', session.lobbyId), 'Démarrer', ButtonStyle.Primary, '▶️')
                    .setDisabled(session.players.size < minRequired)
            ),
            row(
                button(controlId(session, 'late', session.lobbyId), 'Arrivées : ' + (session.allowLate ? 'ON' : 'OFF'), ButtonStyle.Secondary, '🔓').setDisabled(session.test),
                button(controlId(session, 'settings', session.lobbyId), 'Paramètres', ButtonStyle.Secondary, '⚙️'),
                button(controlId(session, 'cancel', session.lobbyId), 'Annuler', ButtonStyle.Danger, '✖️')
            )
        ];
    }
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
    const hostPlayer = session.people.get(session.host);
    const list = [...session.players.values()].map(p => '• **' + escapeText(p.name) + '**' + (p.id === session.host ? ' 👑' : '')).join('\n') || '*Aucun·e inscrit·e*';

    const page = embed(icon + ' ' + name + ' • Inscriptions', gameColor(session.game))
        .setAuthor({
            name: (session.test ? 'RegaDex Arcade • Test de ' : 'RegaDex Arcade • Salon de ') + (hostPlayer?.name || 'l’hôte'),
            iconURL: hostPlayer?.avatar || undefined
        })
        .setDescription(
            desc + '\n' + SEP + '\n' +
            '⏱️ **Lancement automatique :** ' + expiry(session.deadline) + ' *(ou dès que l’hôte clique sur **▶️ Démarrer**)*'
        )
        .addFields(
            { name: '👥 Participant·es (' + session.players.size + ')', value: cut(list, 1024), inline: true },
            {
                name: '⚙️ Paramètres',
                value:
                    '• **Accès :** ' + (session.test ? '🧪 Mode test (' + session.bots.size + ' bots)' : session.invited ? '🎟️ Sur invitation' : '🌐 Ouvert') + '\n' +
                    '• **Minimum :** `' + minP + '` joueur(s)\n' +
                    '• **Arrivées en cours :** ' + (session.allowLate ? '✅ Ouvertes' : '🔒 Fermées'),
                inline: true
            },
            { name: '📘 Comment jouer', value: cut(guide, 1024), inline: false }
        )
        .setFooter({ text: 'RegaDex Arcade • Suppression auto après 15 min d’inactivité' });

    return silent({ embeds: [page], components: sessionButtons(session) });
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
    if (session.phase === 'lobby') {
        const updated = await editThreadMessage(session, session.lobby, lobbyPayload(session));
        if (updated) session.lobby = updated;
    } else if (session.phase !== 'closed') {
        const [name, , icon, guide] = GUIDES[session.game];
        const page = embed(icon + ' ' + name + ' • Partie en cours', gameColor(session.game))
            .setDescription(
                '**' + session.players.size + '** joueur(s) en lice • ' +
                (session.test ? 'Mode test en cours.' : session.allowLate ? 'Les arrivées rejoignent dès la manche/partie suivante.' : 'Les arrivées en cours sont fermées.')
            )
            .addFields({ name: '📘 Rappel des règles', value: cut(guide, 1024), inline: false });
        const updated = await editThreadMessage(session, session.lobby, {
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
    }).join(' • ');

    const page = embed('🎭 Vitrine à thème • Manche ' + session.round + '/' + ROUND_COUNT, gameColor('vitrine'))
        .setAuthor({ name: 'RegaDex Arcade • Choix des cartes' })
        .setDescription(
            '> **' + session.prompt + '**\n\n' +
            '`' + progressBar(done, total, 12) + '` **' + done + '/' + total + '** réponses • Fin ' + expiry(session.deadline) + '\n' +
            SEP + '\n' +
            '🃏 **Cartes à placer :** `' + session.holes + '`\n' +
            '👥 **Statut :** ' + cut(statusLines, 900)
        )
        .setFooter({ text: 'Sélection 100% anonyme • Seules tes cartes classiques sont utilisables' });

    return silent({
        embeds: [page],
        components: [row(
            button(controlId(session, 'pick', session.lobbyId, session.round), 'Choisir ma réponse', ButtonStyle.Primary, '🃏'),
            button(controlId(session, 'binder'), 'Classeur', ButtonStyle.Secondary, '📖')
        )]
    });
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
        await closeSession(session, 'Il faut au moins deux joueurs avec assez de cartes éligibles pour cette manche.');
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
    const preview = embed('🃏 Ta réponse • Manche ' + session.round + '/' + ROUND_COUNT, gameColor('vitrine'))
        .setDescription(
            '> **' + escapeText(completePhrase(session.prompt, cards)) + '**\n\n' +
            '📦 **Cartes choisies :** `' + cards.length + '/' + session.holes + '`' +
            (session.answers.has(user) ? '\n✅ *Ta réponse précédente est déjà enregistrée.*' : '')
        )
        .setFooter({ text: 'Résultats ' + (draft.page + 1) + '/' + pages + ' • Utilise Rechercher pour filtrer' });

    const controls = [
        button(controlId(session, 'query', ...key), 'Rechercher', ButtonStyle.Secondary, '🔎'),
        button(controlId(session, 'clear', ...key), 'Reset', ButtonStyle.Secondary, '🧹').setDisabled(cards.length === 0),
        button(controlId(session, 'swap', ...key), 'Inverser', ButtonStyle.Secondary, '🔄').setDisabled(cards.length !== 2),
        button(controlId(session, 'lock', ...key), 'Valider', ButtonStyle.Success, '✅').setDisabled(cards.length !== session.holes)
    ];
    const components = [row(...controls)];
    if (cards.length < session.holes && available.length) {
        const options = available.slice(draft.page * 25, (draft.page + 1) * 25).map(card => {
            const rEmoji = (RARITY_STYLE[card.rarity] || RARITY_STYLE.Commune).emoji;
            return {
                label: cut(card.name, 100),
                value: card.id,
                description: cut(rEmoji + ' ' + card.rarity + ' • N° ' + card.numCode + ' • ' + cardSetLabel(card), 100)
            };
        });
        components.unshift(row(new StringSelectMenuBuilder().setCustomId(controlId(session, 'card', ...key))
            .setPlaceholder('Choisir une carte possédée...').addOptions(options)));
        if (pages > 1) components.push(row(
            button(controlId(session, 'prev', ...key), 'Précédente', ButtonStyle.Secondary, '◀️').setDisabled(draft.page === 0),
            button(controlId(session, 'next', ...key), 'Suivante', ButtonStyle.Secondary, '▶️').setDisabled(draft.page + 1 >= pages)
        ));
    } else if (cards.length < session.holes) preview.setFooter({ text: 'Aucune carte restante ne correspond à la recherche.' });
    return { embeds: [preview], components };
}

async function applySlowmode(session, seconds, reason) {
    try {
        if (session.record.slowmode == null) {
            session.record.slowmode = session.thread.rateLimitPerUser ?? 0;
            try { saveThreadRecords(); } catch (err) { console.warn('[PLAY] Sauvegarde slowmode :', err); }
        }
        if (session.thread.archived) {
            await session.thread.setArchived(false).catch(() => {});
        }
        await session.thread.setRateLimitPerUser(seconds, reason);
    } catch (error) {
        session.record.slowmode = null;
        try { saveThreadRecords(); } catch {}
        if (IGNORABLE_DISCORD_CODES.has(error?.code)) {
            console.warn('[PLAY] Mode lent ignoré :', error.code || error.message);
            return;
        }
        console.warn('[PLAY] Activation du mode lent impossible :', error);
    }
}

async function restoreSlowmode(session) {
    if (session.record.slowmode == null) return;
    const previous = session.record.slowmode;
    session.record.slowmode = null;
    try { saveThreadRecords(); } catch (err) { console.warn('[PLAY] Sauvegarde slowmode :', err); }
    try {
        if (session.thread.archived) return;
        await session.thread.setRateLimitPerUser(previous, 'Fin du vote RegaDex');
    } catch (error) {
        if (IGNORABLE_DISCORD_CODES.has(error?.code)) {
            console.warn('[PLAY] Restauration du mode lent ignorée :', error.code || error.message);
            return;
        }
        console.warn('[PLAY] Restauration du mode lent impossible :', error);
    }
}

async function startRatings(session) {
    clearTimeout(session.timer);
    clearTimeout(session.botTimer);
    session.phase = 'reveal';
    session.entries = shuffled([...session.answers.values()]);
    if (session.entries.length < 2) {
        const updated = await editThreadMessage(session, session.board, {
            embeds: [embed('🎭 Manche ' + session.round + ' • Vote annulé', gameColor('vitrine')).setDescription('Il faut au moins deux réponses valides pour ouvrir le vote.')],
            components: []
        });
        if (updated) session.board = updated;
        await finishRound(session);
        return;
    }
    await applySlowmode(session, 21_600, 'Vote Vitrine à thème');
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
    const page = embed('🎭 Manche ' + session.round + '/' + ROUND_COUNT + ' • Réponse ' +
        (session.voteIndex + 1) + '/' + session.entries.length, gameColor('vitrine'))
        .setAuthor({ name: 'RegaDex Arcade • Vote anonyme' })
        .setDescription('> **' + escapeText(completePhrase(session.prompt, entry.cards)) + '**\n\n⏳ *10 secondes pour voter — sans note, elle vaut Meh (`0`).*')
        .setFooter({ text: '❤️ J’adore ! est utilisable 1 seule fois par session • Tu ne notes que les réponses des autres' });
    if (cardImage) page.setImage('attachment://reponse.png');
    const updated = await editThreadMessage(session, session.board, silent({
        embeds: [page],
        attachments: [],
        files: cardImage ? [new AttachmentBuilder(cardImage, { name: 'reponse.png' })] : [],
        components: [row(...RATINGS.map(([key, label, points, style, emoji]) => button(
            controlId(session, 'rate', session.lobbyId, session.round, session.voteIndex, key),
            label + ' (' + (points > 0 ? '+' : '') + points + ')',
            style,
            emoji
        )))]
    }));
    if (updated) session.board = updated;
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
        escapeText(session.people.get(entry.user)?.name || 'Participant·e') + ' — **' + entry.score + ' pts**');
    const reveal = embed('🎭 Manche ' + session.round + ' • Réponses dévoilées', gameColor('vitrine'))
        .setDescription(cut(authors.join('\n') || 'Aucune réponse enregistrée.', 3900));
    const updated = await editThreadMessage(session, session.board, { embeds: [reveal], components: [], attachments: [] });
    if (updated) session.board = updated;
    const top = ranked(session.entries.length >= 2 ? session.entries : []).filter(entry => entry.rank <= 3);
    for (const entry of top.filter(item => item.rank === 1)) {
        if (!session.best.length || entry.score > session.best[0].score) session.best = [];
        if (!session.best.length || entry.score === session.best[0].score) session.best.push({ ...entry, prompt: session.prompt });
    }
    for (let i = 0; i < top.length; i += 3) {
        await sendResult(session, 'Manche ' + session.round + ' • Résultats', top.slice(i, i + 3), {
            prompt: session.prompt, cards: true
        });
    }
    if (session.round < ROUND_COUNT) await startRound(session);
    else await showPodium(session);
}

function bestResponseDescription(best) {
    if (!best.length) return '';
    const label = best.length === 1 ? '⭐ Meilleure réponse de la session' : '⭐ Meilleures réponses ex æquo';
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
    await sendResult(session, 'Vitrine à thème • Podium final', top.slice(0, 3), {
        podium: true, description: best, best: session.best,
        components: [row(button(controlId(session, 'standing', session.lobbyId, 0), 'Voir le classement', ButtonStyle.Secondary, '📊'))]
    });
    session.continuing = new Set();
    session.leaving = new Set();
    session.deadline = Date.now() + CONTINUE_MS;
    session.continueMessage = await session.thread.send(continuePayload(session));
    phaseTimer(session, Math.max(1, session.deadline - Date.now()), () => finishContinue(session));
}

function continuePayload(session) {
    const mentionList = set => [...set].map(id => '• ' + playerRef(session, id)).join('\n') || '*En attente*';
    const page = embed('🔄 Continuer sur un autre mini-jeu ?', 0x3498db)
        .setDescription('Choisis si tu restes pour le vote du prochain mini-jeu. Clôture ' + expiry(session.deadline))
        .addFields(
            { name: '✅ Restent (' + session.continuing.size + ')', value: cut(mentionList(session.continuing), 1024), inline: true },
            { name: '👋 Quittent (' + session.leaving.size + ')', value: cut(mentionList(session.leaving), 1024), inline: true }
        );
    return silent({
        embeds: [page],
        components: [row(
            button(controlId(session, 'yes', session.lobbyId), 'Oui, on continue !', ButtonStyle.Success, '✅'),
            button(controlId(session, 'leave', session.lobbyId), 'Non, je quitte', ButtonStyle.Secondary, '👋')
        )]
    });
}

async function finishContinue(session) {
    clearTimeout(session.timer);
    clearTimeout(session.botTimer);
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
    await restoreSlowmode(session);
    const messages = [session.lobby, session.board, session.continueMessage, session.ballot?.message].filter(Boolean);
    await Promise.allSettled(messages.map(message => editThreadMessage(session, message, { components: [] })));
    const page = embed('🏁 Session terminée', 0x95a5a6)
        .setDescription(reason)
        .setFooter({ text: 'Ce fil sera supprimé automatiquement après 15 min d’inactivité' });
    await session.thread.send(silent({ embeds: [page] })).catch(error => console.warn('[PLAY] Clôture :', error));
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

function drawGlassCard(ctx, x, y, w, h, { radius = 18, fill = 'rgba(17, 14, 29, 0.78)', border = 'rgba(255, 255, 255, 0.14)', lineWidth = 1.5 } = {}) {
    ctx.save();
    drawRoundRect(ctx, x, y, w, h, radius);
    ctx.fillStyle = fill;
    ctx.fill();
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

async function getPlayBgCanvas() {
    if (playBgCache) return playBgCache;
    try {
        if (fs.existsSync(TCG_BG_PATH)) playBgCache = await loadImage(TCG_BG_PATH);
    } catch (error) {
        console.warn('[PLAY] Fond RegaDex indisponible :', error.message);
    }
    return playBgCache;
}

function exportPng(canvas) {
    try {
        return canvas.toBuffer('image/png');
    } finally {
        canvas.width = canvas.height = 0;
    }
}

async function drawVoteCards(cards, options = {}) {
    const count = Math.max(1, cards.length);
    const cardW = options.cardW || 212;
    const cardH = Math.round(cardW * 1.4);
    const gap = options.gap || 26;
    const padX = 36;
    const headerH = options.header ? 66 : 24;
    const width = Math.max(460, padX * 2 + count * cardW + (count - 1) * gap);
    const height = headerH + cardH + 74;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    const bg = await getPlayBgCanvas();

    await stage(ctx, width, height, { bg, accent: options.accent || '#a78bfa' });

    if (options.header) {
        drawGlassCard(ctx, 24, 14, width - 48, 44, { radius: 12, fill: 'rgba(13, 12, 24, 0.78)' });
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff7e9';
        ctx.font = 'bold 20px "LemonMilk", "Sans"';
        ctx.fillText(options.header, width / 2, 36, width - 80);
    }

    const totalCardsW = count * cardW + (count - 1) * gap;
    const startX = Math.round((width - totalCardsW) / 2);
    const startY = headerH + 6;

    await Promise.all(cards.map(async (card, index) => {
        const x = startX + index * (cardW + gap);
        const theme = cardTheme(card);
        await drawCard(ctx, card, x, startY, cardW, cardH, { glow: theme.glow, border: theme.hex, radius: 12 });

        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 17px "LemonMilk", "Sans"';
        ctx.fillText(card.name, x + cardW / 2, startY + cardH + 10, cardW + 14);

        ctx.fillStyle = theme.hex;
        ctx.font = 'bold 13px "LemonMilk", "Sans"';
        ctx.fillText('N° ' + card.numCode + ' • ' + card.rarity, x + cardW / 2, startY + cardH + 34, cardW + 14);
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
        ctx.fillText(cut(player?.name || '?', 1).toUpperCase(), x, y + 1);
    }
    ctx.restore();
}

async function stage(ctx, width, height, opts = {}) {
    const bg = opts.bg !== undefined ? opts.bg : await getPlayBgCanvas();
    if (bg) {
        const scale = Math.max(width / bg.width, height / bg.height);
        const bw = bg.width * scale;
        const bh = bg.height * scale;
        ctx.drawImage(bg, (width - bw) / 2, (height - bh) / 2, bw, bh);
        const veil = ctx.createLinearGradient(0, 0, 0, height);
        veil.addColorStop(0, 'rgba(13, 10, 26, 0.72)');
        veil.addColorStop(0.55, 'rgba(23, 14, 42, 0.62)');
        veil.addColorStop(1, 'rgba(10, 8, 20, 0.86)');
        ctx.fillStyle = veil;
        ctx.fillRect(0, 0, width, height);
    } else {
        const background = ctx.createLinearGradient(0, 0, 0, height);
        background.addColorStop(0, '#130e24');
        background.addColorStop(0.65, '#2b1542');
        background.addColorStop(1, '#100b20');
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, width, height);
    }

    const accent = opts.accent || '#f2b965';
    for (const center of [width * 0.22, width * 0.78]) {
        const beam = ctx.createRadialGradient(center, 0, 16, center, height * 0.25, height * 0.85);
        beam.addColorStop(0, accent.startsWith('#') && accent.length === 7 ? accent + '36' : 'rgba(242, 185, 101, 0.22)');
        beam.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = beam;
        ctx.fillRect(0, 0, width, height);
    }

    drawFivePointStar(ctx, 48, 42, 9, 4, 'rgba(255, 226, 171, 0.5)', 'rgba(255, 215, 0, 0.35)');
    drawFivePointStar(ctx, width - 48, 42, 9, 4, 'rgba(255, 226, 171, 0.5)', 'rgba(255, 215, 0, 0.35)');
}

async function resultsCanvas(session, title, entries, options = {}) {
    const width = 1100;
    const stageHeight = options.cards ? 670 : 540;
    const showcase = options.podium && options.best?.length === 1 ? options.best[0] : null;
    const height = stageHeight + (showcase ? 132 : 0);
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    const unit = options.unit || 'pts';
    const bg = await getPlayBgCanvas();

    await stage(ctx, width, height, { bg, accent: '#f59e0b' });

    drawGlassCard(ctx, 36, 18, width - 72, options.prompt ? 104 : 74, {
        radius: 18,
        fill: 'rgba(14, 12, 26, 0.82)',
        border: 'rgba(255, 226, 171, 0.25)'
    });

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff7e9';
    ctx.font = 'bold 34px "LemonMilk", "Sans"';
    ctx.fillText(title, width / 2, options.prompt ? 50 : 55, width - 120);

    if (options.prompt) {
        ctx.fillStyle = '#d7ccf0';
        ctx.font = '21px Sans';
        ctx.fillText(options.prompt, width / 2, 93, width - 110);
    }

    if (!entries.length) return exportPng(canvas);

    const avatars = await Promise.all(entries.map(entry => loadAvatar(session.people.get(entry.user))));
    const column = width / (entries.length + 1);
    const positions = options.podium && entries.length === 3 ? [1, 0, 2] : entries.map((_, index) => index);
    const rankPalette = {
        1: { ring: '#ffd166', fill: 'rgba(130, 88, 28, 0.82)', border: '#ffd166', text: '#ffe8a3' },
        2: { ring: '#d7deeb', fill: 'rgba(66, 75, 102, 0.80)', border: '#cbd5e1', text: '#eef2f6' },
        3: { ring: '#d49a6a', fill: 'rgba(92, 57, 46, 0.80)', border: '#d49a6a', text: '#f6d5b8' }
    };

    for (const [index, entry] of entries.entries()) {
        const player = session.people.get(entry.user);
        const x = column * (positions[index] + 1);
        const first = entry.rank === 1;
        const style = rankPalette[entry.rank] || {
            ring: '#a78bfa',
            fill: 'rgba(48, 34, 74, 0.80)',
            border: 'rgba(167, 139, 250, 0.45)',
            text: '#ffffff'
        };
        const avatarY = options.cards ? 428 : (first ? 228 : 262);

        if (options.cards) {
            const cards = entry.cards || [];
            await Promise.all(cards.map((card, cardIndex) => {
                const w = first ? 128 : 112;
                const t = cardTheme(card);
                return drawCard(
                    ctx, card,
                    x - (cards.length * (w + 10)) / 2 + cardIndex * (w + 10),
                    152, w, w * 1.4,
                    { glow: t.glow, border: t.hex, radius: 10 }
                );
            }));
        }

        drawAvatar(ctx, avatars[index], player, x, avatarY, first ? 44 : 37, style.ring);
        const top = avatarY + (first ? 56 : 50);
        const blockWidth = Math.min(276, column - 20);
        const blockHeight = stageHeight - 28 - top;

        drawGlassCard(ctx, x - blockWidth / 2, top, blockWidth, blockHeight, {
            radius: 16,
            fill: style.fill,
            border: style.border,
            lineWidth: first ? 2.5 : 1.5
        });

        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = style.text;
        ctx.font = 'bold 21px "LemonMilk", "Sans"';
        ctx.fillText('#' + entry.rank + '  •  ' + (player?.name || 'Participant·e'), x, top + 18, blockWidth - 24);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 38px "LemonMilk", "Sans"';
        ctx.fillText(entry.score + ' ' + unit, x, top + 56, blockWidth - 24);
    }

    if (showcase) {
        drawGlassCard(ctx, 36, stageHeight + 8, width - 72, 108, {
            radius: 16,
            fill: 'rgba(26, 18, 44, 0.88)',
            border: 'rgba(255, 215, 0, 0.45)',
            lineWidth: 2
        });
        drawFivePointStar(ctx, 76, stageHeight + 42, 12, 5, '#ffd166', 'rgba(255, 209, 102, 0.65)');
        drawFivePointStar(ctx, width - 76, stageHeight + 42, 12, 5, '#ffd166', 'rgba(255, 209, 102, 0.65)');
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffe2ab';
        ctx.font = 'bold 22px "LemonMilk", "Sans"';
        ctx.fillText('MEILLEURE RÉPONSE • ' + showcase.score + ' ' + unit, width / 2, stageHeight + 42, width - 180);
        ctx.fillStyle = '#fff7e9';
        ctx.font = '23px Sans';
        ctx.fillText(completePhrase(showcase.prompt, showcase.cards), width / 2, stageHeight + 84, width - 90);
    }

    return exportPng(canvas);
}

async function sendResult(session, title, entries, options = {}) {
    const unit = options.unit || 'pts';
    const result = embed(title, gameColor(session.game))
        .setAuthor({ name: 'RegaDex · Résultats' });
    const medals = ['🥇', '🥈', '🥉'];
    const lines = entries.map(entry => (medals[entry.rank - 1] || '**#' + entry.rank + '**') + ' · **' +
        escapeText(session.people.get(entry.user)?.name || 'Participant·e') + '** — `' + entry.score + ' ' + unit + '`');
    const description = [lines.join('\n'), options.description].filter(Boolean).join('\n' + SEP + '\n');
    if (description) result.setDescription(cut(description, 4096));
    const image = await resultsCanvas(session, title, entries, options).catch(error => {
        console.warn('[PLAY] Canvas des résultats :', error);
        return null;
    });
    if (image) result.setImage('attachment://resultats.png');
    await session.thread.send({
        ...silent({
            embeds: [result],
            files: image ? [new AttachmentBuilder(image, { name: 'resultats.png' })] : [],
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
    const view = embed('🏆 Vitrine à thème · Classement', gameColor('vitrine'))
        .setAuthor({ name: 'RegaDex · Classement complet' })
        .setDescription(lines.slice(safe * 3, (safe + 1) * 3).join('\n') || 'Tout le classement figure sur le podium.')
        .setFooter({ text: 'Page ' + (safe + 1) + '/' + pages });
    const entries = results.entries.slice(safe * 3, (safe + 1) * 3);
    const image = entries.length ? await resultsCanvas(session, 'Vitrine à thème · Classement', entries)
        .catch(error => { console.warn('[PLAY] Canvas du classement :', error); return null; }) : null;
    if (image) view.setImage('attachment://classement.png');
    return {
        embeds: [view], attachments: [], files: image ? [new AttachmentBuilder(image, { name: 'classement.png' })] : [],
        components: pages > 1 ? [row(
            button(controlId(session, 'standing', lobbyId, safe - 1), 'Précédent', ButtonStyle.Secondary, '⬅️').setDisabled(safe === 0),
            button(controlId(session, 'standing', lobbyId, safe + 1), 'Suivant', ButtonStyle.Secondary, '➡️').setDisabled(safe === pages - 1)
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
    const view = embed('📖 RegaDex · Classeur complet', gameColor(session.game))
        .setAuthor({ name: 'Cartes éligibles aux mini-jeux' })
        .setDescription('**' + escapeText(result.setName) + '**\n*Seules les cartes classiques (hors Full Art, Négative et Holo) sont jouables.*')
        .setImage('attachment://classeur.jpg')
        .setFooter({ text: 'Page ' + (result.page + 1) + '/' + result.totalPages + ' · Thème ' + (theme === 'W' ? 'Clair' : 'Nuit') });
    const components = [row(
        button(controlId(session, 'browse', result.set, result.page - 1, theme), 'Précédente', ButtonStyle.Secondary, '⬅️').setDisabled(result.page === 0),
        button(controlId(session, 'browse', result.set, result.page + 1, theme), 'Suivante', ButtonStyle.Secondary, '➡️').setDisabled(result.page + 1 >= result.totalPages),
        button(controlId(session, 'browse', result.set, result.page, theme === 'W' ? 'B' : 'W'), 'Thème', ButtonStyle.Secondary, '🎨')
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
    const [lobbyId, round, index, rating] = parts;
    if (session.phase !== 'rating' || Number(lobbyId) !== session.lobbyId || Number(round) !== session.round ||
        Number(index) !== session.voteIndex || Date.now() >= session.deadline) return privateResponse(interaction, 'Vote clos pour cette réponse.');
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
    return privateResponse(interaction, prefix + '**' + note[1] + '** enregistré (`' + (note[2] > 0 ? '+' : '') + note[2] + ' pts`).');
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
        const payload = draftPayload(session, id, draft);
        if (interaction.isFromMessage?.()) return interaction.update(payload);
        return interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
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
        await interaction.update({
            embeds: [embed('✅ Réponse enregistrée', gameColor('vitrine')).setDescription(escapeText(completePhrase(session.prompt, selected)))],
            components: []
        });
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
    if (['join', 'late', 'cancel', 'startnow', 'quit', 'settings', 'settingsLate', 'settingsInvite', 'settingsUsers', 'skipClock'].includes(action) && Number(parts[0]) !== session.lobbyId)
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
        await privateResponse(interaction, session.phase === 'lobby' ? '✅ Tu es inscrit·e !' : '✅ Tu rejoindras la prochaine manche ou session.');
        if (session.thread.members.add) await session.thread.members.add(user).catch(error => console.warn('[PLAY] Inscription Discord :', error));
        if (session.phase === 'lobby') await updateLobby(session);
        return;
    }
    if (action === 'quit') {
        if (session.test) return privateResponse(interaction, 'Indisponible en mode test.');
        if (!session.players.has(user) && !session.pending.has(user))
            return privateResponse(interaction, 'Tu n’es pas inscrit·e à cette partie.');
        persistRecordActivity(session.record, interaction.client);
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
        if (session.thread.members?.remove) await session.thread.members.remove(user).catch(error => console.warn('[PLAY] Retrait du fil :', error));
        if (!session.players.size && !session.pending.size) await closeSession(session, 'Tous les participant·es ont quitté la partie.');
        return;
    }
    if (action === 'startnow') {
        if (session.host !== user) return privateResponse(interaction, 'Cette commande est réservée à l’hôte.');
        if (session.phase !== 'lobby') return privateResponse(interaction, 'La partie a déjà commencé.');
        if (session.players.size + session.pending.size < MIN_PLAYERS[session.game]) {
            return privateResponse(interaction, 'Il faut au moins **' + MIN_PLAYERS[session.game] + '** participant·es pour démarrer.');
        }
        persistRecordActivity(session.record, interaction.client);
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
            if (action === 'rate' || ['pick', 'query', 'search', 'prev', 'next', 'clear', 'swap', 'card', 'binder', 'browse', 'binderset', 'standing', 'pages'].includes(action))
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
    const keepAttachment = attachment === undefined;
    const page = embed(title, gameColor(session.game))
        .setAuthor({ name: 'RegaDex · Mini-jeux' })
        .setDescription(cut(text, 4000));
    if (fields.length) page.addFields(fields);
    const tip = STEP_TIPS[session.state?.step];
    if (tip && components.length) page.setFooter({ text: cut(tip, 2048) });
    if (attachment) page.setImage('attachment://' + attachment.name);
    else if (keepAttachment && session.board?.embeds?.[0]?.image?.url) {
        page.setImage(session.board.embeds[0].image.url);
    }
    const realMentions = mentions.filter(id => !session.bots.has(id));
    const payload = { embeds: [page], components, allowedMentions: { parse: [], users: realMentions } };
    if (realMentions.length) payload.content = realMentions.map(id => playerRef(session, id)).join(' ');
    else if (session.board) payload.content = null;
    if (attachment) payload.files = [attachment];
    if (session.board) {
        const editPayload = keepAttachment ? payload : { ...payload, attachments: [] };
        const updated = await editThreadMessage(session, session.board, editPayload);
        if (updated) session.board = updated;
    } else {
        session.board = await session.thread.send(realMentions.length ? payload : silent(payload));
    }
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
    clearTimeout(session.botTimer);
    session.phase = 'ballot';
    const ballot = {
        id: session.ballotId = (session.ballotId || 0) + 1,
        voters, options, votes: new Map(), choose, title, description, canFinishEarly
    };
    session.ballot = ballot;
    session.deadline = Date.now() + ms;
    ballot.message = await session.thread.send(silent(ballotPayload(session, ballot)));
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
    else await editThreadMessage(session, ballot.message, ballotPayload(session, ballot));
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
    await editThreadMessage(session, ballot.message, {
        embeds: [embed(ballot.title, gameColor(session.game)).setAuthor({ name: 'Résultat du scrutin' }).setDescription(summary)],
        components: []
    });
    await ballot.choose(leaders, ballot.votes);
}

async function nextGamePoll(session, voters) {
    if (!voters.size) return closeSession(session, 'Session terminée. Merci d’avoir joué !');
    const options = Object.entries(GUIDES).map(([value, [label, , emoji]]) => ({ value, label, emoji }));
    await openBallot(session, {
        title: '🎮 Prochain mini-jeu',
        description: 'Choisissez le prochain jeu à enchaîner. En cas d’égalité, Cacabot départage au hasard.',
        voters, options, choose: async (leaders, votes) => {
            if (!leaders.length) return closeSession(session, 'Aucun vote enregistré. La session est terminée.');
            const winner = leaders[randomInt(leaders.length)];
            if (!session.players.has(session.host)) session.host = session.players.keys().next().value || votes.keys().next().value;
            session.game = winner;
            await session.thread.send(silent({
                embeds: [embed(gameTitle(session), gameColor(winner))
                    .setAuthor({ name: 'Jeu suivant sélectionné' })
                    .setDescription('Le scrutin a parlé ! Ouverture d’une nouvelle table d’inscription.')],
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
    const threshold = guess.length >= 8 ? 2 : guess.length >= 4 ? 1 : 0;
    if (!threshold || names.has(guess)) return false;
    let best = Infinity;
    for (const name of expected) best = Math.min(best, distance(guess, name));
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
    state.index = 0;
    await cavaleRound(session);
}

async function cavaleRound(session) {
    const state = session.state;
    if (state.index >= state.cards.length) {
        const entries = ranked([...session.scores].map(([user, score]) => ({ user, score })));
        if (entries.length) {
            const top = entries.filter(entry => entry.rank <= 3).slice(0, 3);
            await sendResult(session, '🔍 Cartes en cavale · Podium', top, { podium: true, unit: 'carte(s)' });
        }
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
    ctx.fillText('ÉCRIS LE NOM DE LA CARTE DANS LE FIL', canvas.width / 2, 748);

    const png = exportPng(canvas);
    await gameBoard(
        session,
        'Écris directement le nom de la carte dans le fil *(fautes légères tolérées)*.\n' +
        'Prochain dézoom : ' + expiry(state.roundStarted + (state.zoom + 1) * 60_000),
        [],
        new AttachmentBuilder(png, { name: 'indice.png' }),
        [],
        '🔍 Cartes en cavale · Carte ' + (state.index + 1) + '/' + state.cards.length,
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
    const theme = cardTheme(card);
    if (winner) session.scores.set(winner, (session.scores.get(winner) || 0) + 1);
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
    return finishGame(
        session,
        (winner ? '🎉 ' + playerRef(session, winner) + ' a démasqué la carte secrète !' : '🕵️ ' + reason) + '\n' + SEP + '\n' +
        '**' + escapeText(state.card.name) + '** · `N° ' + state.card.numCode + '`\n' +
        theme.emoji + ' *' + escapeText(state.card.rarity) + '* · ' + escapeText(cardSetLabel(state.card)),
        cardFile(state.card)
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
        null, [], '🎙️ Casting de l’enfer · Volontaires',
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
    session.deadline = Date.now() + 45_000;
    await gameBoard(
        session,
        playerRef(session, state.writer) + ', rédige le sujet du débat avant ' + expiry(session.deadline) + '.',
        [row(gameButton(session, 'castWrite', 'Écrire la question', ButtonStyle.Primary, '', '✍️'))],
        null, [state.writer]
    );
    phaseTimer(session, 45_000, () => castingCards(session));
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
        null, mentions, '🎙️ Casting de l’enfer · Préparation',
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
    const view = embed('🃏 Ma carte · Casting de l’enfer', gameColor('casting'))
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
    const art = await drawVoteCards(cards, { header: 'CASTING DE L’ENFER • LES CANDIDATS', cardW: 230 })
        .catch(error => { console.warn('[PLAY] Cartes du Casting :', error); return null; });
    await gameBoard(
        session,
        '**Sujet :** ' + escapeText(state.prompt) + '\n' + SEP + '\n' +
        state.debaters.map((id, i) => '🎙️ ' + playerRef(session, id) + ' défend **' + escapeText(cards[i].name) + '**').join('\n') +
        '\n\nVous avez **5 minutes** pour débattre dans ce fil. Fin ' + expiry(session.deadline),
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
    const voters = state.duel ? new Set(state.debaters) : await threadVoters(session);
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
            if (leaders.length === 1) return finishGame(session, '🏆 Le débat est remporté par ' + playerRef(session, leaders[0]) + ' !');
            return finishGame(session, leaders.length ? '🤝 Le débat se termine sur un match nul.' : 'Le débat est terminé. Aucun vote enregistré.');
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
    session.deadline = Date.now() + 45_000;
    await gameBoard(
        session,
        playerRef(session, state.writer) + ', rédige la consigne du classement avant ' + expiry(session.deadline) + '.',
        [row(gameButton(session, 'rankWrite', 'Écrire la consigne', ButtonStyle.Primary, '', '✍️'))],
        null, [state.writer]
    );
    phaseTimer(session, 45_000, () => rankingModeVote(session));
}

async function rankingModeVote(session) {
    await openBallot(session, {
        title: '📋 Tirage des cartes pour le classement',
        description: '**Consigne :** ' + escapeText(session.state.prompt),
        voters: new Set(session.players.keys()),
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

async function renderSocialBoard(session, attachment = undefined) {
    const state = session.state;
    const readyCount = [...state.slots.values()].filter(slot => isSlotReady(state, slot)).length;
    const statusList = state.members
        .map(id => (isSlotReady(state, state.slots.get(id)) ? '✅' : '⏳') + ' ' + playerRef(session, id))
        .join(' · ');
    const intro = state.kind === 'fmk'
        ? 'Répartis secrètement ces 3 cartes entre **💖 Fuck**, **💍 Marry** et **💀 Kill**.'
        : '**Consigne :** ' + escapeText(state.prompt) + '\n*Mode : ' + (state.common ? 'Tirage commun' : 'Tirage individuel') + '*';
    await gameBoard(
        session,
        intro + '\n' + SEP + '\nFin de sélection ' + expiry(state.choiceDeadline),
        [row(gameButton(session, 'socialPanel', state.kind === 'fmk' ? 'Faire mes choix' : 'Faire mon classement', ButtonStyle.Primary, '', state.kind === 'fmk' ? '💌' : '📋'))],
        attachment,
        [],
        gameTitle(session),
        [{ name: 'Progression (' + readyCount + '/' + state.members.length + ')', value: progressBar(readyCount, state.members.length) + '\n' + statusList, inline: false }]
    );
}

async function startSocialChoices(session, kind, mode = 'common') {
    const state = session.state;
    state.kind = kind;
    state.common = mode === 'common';
    const size = kind === 'fmk' ? 3 : 4;
    state.members = [...session.players.keys()];
    const common = sampleCards(size, new Set(), true);
    if (common.length < size) return finishGame(session, 'Le catalogue ne contient pas assez de cartes différentes pour ce jeu.');
    state.slots = new Map(state.members.map(id => [id, {
        cards: state.common ? common : sampleCards(size, new Set(), true),
        order: [], locked: false, reasons: null
    }]));
    gameStep(session, 'socialChoices');
    const ms = kind === 'fmk' ? 240_000 : 120_000;
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
    if (op === 'fmkReasons' && state.kind === 'fmk' && slot.locked && !slot.reasons) {
        slot.reasons = FMK_LABELS.map((_, i) => interaction.fields.getTextInputValue('why' + i).trim());
        touchInteraction(session, interaction);
        if (interaction.isFromMessage?.()) await interaction.update({ ...socialPanel(session, slot), attachments: [] });
        else await privateResponse(interaction, '✅ Tes justifications sont enregistrées.');
        if (socialAllReady(state)) await finishSocialChoices(session);
        else await renderSocialBoard(session);
        return;
    }
    if (op === 'socialSkipReasons' && state.kind === 'fmk' && slot.locked && !slot.reasons) {
        slot.reasons = FMK_LABELS.map(() => '');
        touchInteraction(session, interaction);
        await interaction.update({ ...socialPanel(session, slot), attachments: [] });
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
        await interaction.update({ ...socialPanel(session, slot), attachments: [] });
        if (socialAllReady(state)) await finishSocialChoices(session);
        else await renderSocialBoard(session);
        return;
    } else return privateResponse(interaction, 'Complète la liste avant de la verrouiller.');
    touchInteraction(session, interaction);
    return interaction.update({ ...socialPanel(session, slot), attachments: [] });
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
        ctx.fillText(item.card.name, cx, 316, colW - 28);

        ctx.fillStyle = theme.hex;
        ctx.font = 'bold 13px "LemonMilk", "Sans"';
        ctx.fillText('N° ' + item.card.numCode + ' • ' + item.card.rarity, cx, 344, colW - 28);

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
        ctx.fillText(player?.name || 'Participant·e', 160, y + 18, 860);

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
                ctx.fillText(card?.name || '—', bx + 78, y + 60, 194);
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
    await session.thread.send({
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
            session.board = await session.thread.send(realPresenter.length ? msgPayload : silent(msgPayload));
            phaseTimer(session, ms, () => presentNext(session));
            return;
        }
    } else {
        const name = session.people.get(presenter)?.name || 'CLASSEMENT';
        const art = await drawVoteCards(slot.order.map(id => slot.cards.find(card => card.id === id)), {
            header: 'CLASSEMENT DE ' + name.toUpperCase(),
            cardW: 196
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
    const voters = await threadVoters(session);
    if (!voters.size) return finishGame(session, 'Les présentations sont terminées.');
    const title = state.kind === 'fmk' ? '💌 Meilleure justification FMK' : '📋 Meilleur classement défendu';
    if (session.board) await editThreadMessage(session, session.board, { components: [] });
    session.board = null;
    await openBallot(session, {
        title,
        description: 'Votez pour la prestation la plus drôle ou la mieux argumentée.',
        voters,
        options: ids.map(value => ({ value, label: session.people.get(value)?.name || 'Participant·e', emoji: state.kind === 'fmk' ? '💌' : '📋' })),
        choose: leaders => finishGame(
            session,
            leaders.length
                ? (leaders.length > 1 ? '🤝 **Ex æquo** : ' : '🏆 **Victoire de** ') + leaders.map(id => playerRef(session, id)).join(', ') + ' !'
                : 'Aucun vote enregistré. Merci d’avoir joué !'
        )
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

function playerRef(session, id) {
    const bot = session.bots.get(id);
    return bot ? '**' + escapeText(bot.name) + '**' : '<@' + id + '>';
}

function playCardsFor(session, id) {
    if (!session.test) return getPlayCards(id);
    return getPlayCatalog().map(card => ({ ...card, setLabel: cardSetLabel(card) }));
}

function settingsPayload(session, invites = false) {
    const view = embed('⚙️ Paramètres du fil', gameColor(session.game)).setDescription(session.test
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
        await interaction.update({ embeds: [embed('⚙️ Paramètres du fil', gameColor(session.game)).setDescription('⏩ Chrono de test avancé.')], components: [] });
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
            await session.thread.send({
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
            if (state.slots.has(id)) await session.thread.send({
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
                    await session.thread.send({
                        content: '🤖 **' + escapeText(session.bots.get(id).name) + '** : ' + botReason(),
                        allowedMentions: { parse: [] }
                    });
                }
                return socialAction(interaction, session, 'presentDone');
            }
            break;
    }
}

module.exports = { handlePlayMessage, handlePlayInteraction, restorePlayThreads };
