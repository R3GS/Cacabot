require('dotenv').config();
const { validateBackup, computeBackupChecksum } = require('./backup-validator.js');
const { acquireInstanceGuard } = require('./instance-guard.js');

let topData = { messages: {} };
let birthdayData = { birthdays: {}, channels: {} };
let dailyData = {};
let weeklyData = {};
let monthlyData = {};
let youtubeWatchData = {};
let reactionRolesData = {}; // messageId -> { channelId, roles: { emojiKey: roleId } }
let motusData = { dateKey: 0, mot: '', termine: false, vainqueurId: null, tentatives: {}, messageId: null };
let motusStats = {}; // userId -> { victoires: number, parties: number }
let rebusStats = {};
let rebusLastDateKey = 0;
let rebusSessionData = null;
let penduData = { dateKey: 0, mot: '', lettresTrouvees: [], lettresFausses: [], erreursCollectives: 0, expireAt: 0, termine: false, vainqueurId: null, tentativesJoueurs: {}, compteurMessages: 0, messageId: null };
let penduStats = {};

// Intention de publication Pendu, indépendante de la session active.
// Elle est enregistrée avant l'envoi du message Discord.
let penduPublicationPending = null;

let twitchLiveEnCours = false;
let quotesData = []; // [{ id, texte, authorId, authorName, addedById, timestamp, channelId }]
let welcomeData = { channelId: null, actif: true };
let warnsData = {}; // userId -> [{ id, reason, modoId, modoTag, timestamp, expiredNotified }]
let destitutionVotesData = {}; // messageId -> { targetId, targetTag, authorId, channelId, raison, pour: [], contre: [], endsAt, cloture }
let dernierCommitSha = null;
let numeroBuild = 0;
let battlePassData = {};
let tcgData = { users: {}, notifs: {}, activeTrades: {} };
let donneesChargees = false;

function getVersionString() {
    if (numeroBuild <= 0) return '3.010';
    return `3.${String(numeroBuild).padStart(3, '0')}`;
}
const suggestionsData = new Map();

const BACKUP_CHANNEL_ID = '1556005171744604161';

async function loadAll() {
    try {
        const channel = await client.channels.fetch(BACKUP_CHANNEL_ID).catch(() => null);
        let jsonRecord = null;

        // 1. Rechercher les sauvegardes dans les 100 derniers
        // messages du salon, même si d'autres messages
        // ont été publiés après la dernière sauvegarde.
        if (channel) {
            const backupMessages = [];
            let avantMessageId = null;
            let messagesExamines = 0;
            const MAX_MESSAGES_BACKUP = 1000;

            while (messagesExamines < MAX_MESSAGES_BACKUP) {
                let messages;

                try {
                    messages = await channel.messages.fetch({
                        limit: 100,
                        ...(avantMessageId
                            ? { before: avantMessageId }
                            : {})
                    });
                } catch (err) {
                    console.error(
                        '❌ Impossible de poursuivre la recherche des sauvegardes :',
                        err
                    );
                    break;
                }

                if (!messages.size) break;

                messagesExamines += messages.size;

                const lot = [...messages.values()];

                backupMessages.push(
                    ...lot.filter(m =>
                        m.author?.id === client.user?.id &&
                        m.attachments.some(
                            attachment =>
                                attachment.name === 'cacabot_backup.json'
                        )
                    )
                );

                // Discord renvoie les messages les plus récents en premier.
                avantMessageId = lot[lot.length - 1].id;

                if (messages.size < 100) break;
            }

            console.log(
                `💾 ${backupMessages.length} sauvegarde(s) trouvée(s) ` +
                `parmi ${messagesExamines} messages Discord.`
            );

            // Essayer les sauvegardes de la plus récente
            // à la plus ancienne si l'une est corrompue.
            for (const backupMsg of backupMessages) {
                const attachment = backupMsg.attachments.find(
                    a => a.name === 'cacabot_backup.json'
                );

                if (!attachment) continue;

                try {
                    const res = await fetch(attachment.url);

                    if (!res.ok) {
                        throw new Error(
                            `Téléchargement HTTP ${res.status}`
                        );
                    }

                    const parsed = await res.json();

                    const validation = validateBackup(parsed);
                    if (!validation.valid) {
                        throw new Error(
                            'Structure de sauvegarde invalide : ' + validation.reason
                        );
                    }

                    jsonRecord = parsed;

                    console.log(
                        '✅ Données chargées depuis le salon de backup Discord !'
                    );

                    break;
                } catch (err) {
                    console.error(
                        `⚠️ Sauvegarde Discord ${backupMsg.id} inutilisable :`,
                        err
                    );
                }
            }
        }

        // Le chargement se fait désormais à 100% depuis le salon Discord <#1553954760900608091> ou #json

        if (!jsonRecord) {
            console.error(
                '🚨 Aucune sauvegarde Cacabot valide trouvée !'
            );

            console.error(
                '🚨 Chargement des données annulé pour éviter ' +
                'de remplacer les sauvegardes existantes ' +
                'par des données vides.'
            );

            // Ne jamais autoriser les sauvegardes tant
            // qu'aucune sauvegarde valide n'a été chargée.
            donneesChargees = false;

            // Arrêter le bot plutôt que démarrer avec
            // des inventaires, statistiques et points vides.
            throw new Error(
                'DÉMARRAGE ANNULÉ : aucune sauvegarde valide disponible.'
            );
        }

        // Mise à jour en place pour conserver les références mémoire de tous les modules
        topData.messages = jsonRecord.messages ?? {};
        birthdayData.birthdays = jsonRecord.birthdays ?? {};
        birthdayData.channels = jsonRecord.birthdayChannels ?? {};
        birthdayData.lastAnnouncements = jsonRecord.birthdayLastAnnouncements ?? {};
        
        Object.assign(dailyData, jsonRecord.daily ?? {});
        Object.assign(weeklyData, jsonRecord.weekly ?? {});
        Object.assign(monthlyData, jsonRecord.monthly ?? {});
        youtubeWatchData = jsonRecord.youtubeWatch ?? {};
        reactionRolesData = jsonRecord.reactionRoles ?? {};
        motusData = jsonRecord.motusData ?? { dateKey: 0, mot: '', termine: false, vainqueurId: null, tentatives: {}, messageId: null };
        motusStats = jsonRecord.motusStats ?? {};
        rebusStats = jsonRecord.rebusStats ?? {};
        rebusLastDateKey = jsonRecord.rebusLastDateKey ?? 0;
        rebusSessionData = jsonRecord.rebusSessionData ?? null;
        penduData = jsonRecord.penduData ?? { dateKey: 0, mot: '', lettresTrouvees: [], lettresFausses: [], erreursCollectives: 0, expireAt: 0, termine: false, vainqueurId: null, tentativesJoueurs: {}, compteurMessages: 0, messageId: null };
        penduStats = jsonRecord.penduStats ?? {};

        penduPublicationPending =
            jsonRecord.penduPublicationPending &&
            typeof jsonRecord.penduPublicationPending === 'object' &&
            !Array.isArray(jsonRecord.penduPublicationPending)
                ? jsonRecord.penduPublicationPending
                : null;

        avertissementsRedemarrageMinijeux =
            jsonRecord.avertissementsRedemarrageMinijeux &&
            typeof jsonRecord.avertissementsRedemarrageMinijeux === 'object' &&
            !Array.isArray(jsonRecord.avertissementsRedemarrageMinijeux)
                ? { ...jsonRecord.avertissementsRedemarrageMinijeux }
                : {};

        quotesData = jsonRecord.quotes ?? [];
        welcomeData = jsonRecord.welcomeData ?? { channelId: null, actif: true };
        warnsData = jsonRecord.warns ?? {};
        destitutionVotesData = jsonRecord.destitutionVotes ?? {};
        dernierCommitSha = jsonRecord.dernierCommitSha ?? null;
        if (jsonRecord.versionMajor === 3 && typeof jsonRecord.numeroBuild === 'number') {
            numeroBuild = jsonRecord.numeroBuild;
        } else {
            numeroBuild = -1; // Réinitialisation unique lors du passage en Version 3.0
        }
        if (jsonRecord.battlePassData) battlePassData = jsonRecord.battlePassData;
        if (jsonRecord.tcgData) tcgData = jsonRecord.tcgData;
        if (jsonRecord.bugs && typeof setBugsList === 'function') setBugsList(jsonRecord.bugs);

        suggestionsData.clear();
        for (const [k, v] of Object.entries(jsonRecord.suggestions ?? {})) {
            suggestionsData.set(k, v);
        }

        for (const [nom, map] of Object.entries(ROULETTE_ETATS)) {
            map.clear();
            for (const [k, v] of Object.entries(jsonRecord.roulette?.[nom] ?? {})) map.set(k, v);
        }

        donneesChargees = true;
        numeroBuild++; // Incrémentation uniquement au démarrage réussi !
        console.log(`✅ Toutes les données appliquées — Version ${getVersionString()}`);
        if (jsonRecord.versionMajor !== 3) demanderSauvegarde();

        // Si le salon était vide, on y dépose immédiatement le premier fichier de sauvegarde
        if (channel) {
            const messages = await channel.messages.fetch({ limit: 1 }).catch(() => null);
            if (!messages || messages.size === 0) {
                await saveAll();
            }
        }
    } catch (err) {
        // Interdire les sauvegardes si le chargement
        // des données a échoué.
        donneesChargees = false;

        console.error(
            '🚨 Échec critique du chargement des données Cacabot :',
            err
        );

        // Propager l'erreur pour interrompre
        // l'initialisation normale du bot.
        throw err;
    }
}

let lastsaveSaveTime = null;
let messagesSinceLastsaveSave = 0;

// Chaque sauvegarde attend la précédente.
// Une erreur n'empêche pas les tentatives suivantes.
let fileSauvegardes = Promise.resolve();

function saveAll() {
    const operation = fileSauvegardes
        .catch(() => {})
        .then(async () => {
            if (!donneesChargees) {
                throw new Error('Sauvegarde impossible : données non chargées.');
            }

            try {
        const channel = await client.channels.fetch(BACKUP_CHANNEL_ID).catch(() => null);
        if (!channel) {
            throw new Error(
                'Salon de sauvegarde introuvable ! Vérifie l’ID ou les permissions de Cacabot.'
            );
        }

        const payload = {
            messages: topData.messages,
            birthdays: birthdayData.birthdays,
            birthdayChannels: birthdayData.channels,
            birthdayLastAnnouncements: birthdayData.lastAnnouncements ?? {},
            daily: dailyData,
            weekly: weeklyData,
            monthly: monthlyData,
            youtubeWatch: youtubeWatchData,
            reactionRoles: reactionRolesData,
            motusData: motusData,
            motusStats: motusStats,
            rebusStats: rebusStats,
            rebusLastDateKey: rebusLastDateKey,
            rebusSessionData: rebusSessionData,
            penduData: penduData,
            penduStats: penduStats,
            penduPublicationPending,
            avertissementsRedemarrageMinijeux,
            quotes: quotesData,
            welcomeData: welcomeData,
            warns: warnsData,
            destitutionVotes: destitutionVotesData,
            dernierCommitSha: dernierCommitSha,
            versionMajor: 3,
            numeroBuild: numeroBuild,
            battlePassData: battlePassData,
            tcgData: tcgData,
            bugs: typeof getBugsList === 'function' ? getBugsList() : [],
            suggestions: Object.fromEntries(suggestionsData),
            roulette: Object.fromEntries(
                Object.entries(ROULETTE_ETATS).map(([nom, map]) => [nom, Object.fromEntries(map)])
            )
        };

        // Empreinte calculée sur les données avant ajout de l'empreinte.
        // La vérification est effectuée AVANT tout chargement en mémoire.
        payload.integrity = {
            algorithm: 'sha256',
            value: computeBackupChecksum(payload)
        };

        const jsonStr = JSON.stringify(payload, null, 2);
        const buffer = Buffer.from(jsonStr, 'utf-8');

        const now = new Date();
        const dateStr = now.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' }) + ' à ' + now.toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris' });

        await channel.send({
            content: `💾 **Sauvegarde Cacabot** — \`${dateStr}\``,
            files: [{ attachment: buffer, name: 'cacabot_backup.json' }]
        });

        lastsaveSaveTime = new Date();
        console.log(`💾 Nouvelle sauvegarde postée dans #${channel.name}`);

        // Protection des données : ne jamais supprimer automatiquement
        // les sauvegardes historiques. Elles sont le dernier recours
        // si la plus récente est endommagée ou incomplète.
        // Toute politique de rétention devra être testée séparément
        // sur une copie, avec validation d'intégrité préalable.
            } catch (err) {
                console.error('Erreur sauvegarde Discord:', err);
                throw err;
            }
        });

    fileSauvegardes = operation;

    return operation;
}

setInterval(() => {
    saveAll().catch(err => {
        console.error('❌ Sauvegarde automatique échouée :', err);
    });
}, 30 * 60 * 1000);

let saveEnAttente = null;
let delaiReessaiSauvegarde = 10000;

// Ne jamais perdre une demande de sauvegarde simplement parce que
// Discord a temporairement refusé l'envoi. La file saveAll()
// sérialise déjà les écritures ; un seul minuteur suffit ici.
function programmerSauvegardeDifferee(delai) {
    if (!donneesChargees || saveEnAttente) return;

    saveEnAttente = setTimeout(async () => {
        saveEnAttente = null;

        try {
            await saveAll();
            delaiReessaiSauvegarde = 10000;
        } catch (err) {
            console.error('❌ Sauvegarde différée échouée ; nouvel essai programmé :', err);
            delaiReessaiSauvegarde = Math.min(delaiReessaiSauvegarde * 2, 60000);
            programmerSauvegardeDifferee(delaiReessaiSauvegarde);
        }
    }, delai);
}

function demanderSauvegarde() {
    programmerSauvegardeDifferee(10000);
}

let arretEnCours = false;

// Messages de redémarrage à supprimer au prochain démarrage.
// Structure : { [channelId]: messageId }
let avertissementsRedemarrageMinijeux = {};

async function envoyerAvertissementsRedemarrageMinijeux() {
    const maintenant = Date.now();

    const salonsActifs = [
        {
            channelId: MOTUS_CHANNEL_ID,
            actif: Boolean(
                motusData?.mot &&
                !motusData.termine &&
                motusData.expireAt > maintenant
            )
        },
        {
            channelId: PENDU_CHANNEL_ID,
            actif: Boolean(
                penduData?.mot &&
                !penduData.termine &&
                penduData.expireAt > maintenant
            )
        },
        {
            channelId: REBUS_CHANNEL_ID,
            actif: Boolean(
                rebusSessionData?.active &&
                rebusSessionData.limite16hTimestamp > maintenant
            )
        }
    ];

    for (const { channelId, actif } of salonsActifs) {
        if (!actif) continue;

        try {
            const salon = await client.channels.fetch(channelId);

            if (!salon?.isTextBased()) continue;

            const avertissement = await salon.send({
                content:
                    '🔄 **Redémarrage imminent de Cacabot !** ' +
                    'Veuillez patienter quelques secondes avant de reprendre la partie.',
                allowedMentions: { parse: [] }
            });

            avertissementsRedemarrageMinijeux[channelId] = avertissement.id;
        } catch (error) {
            console.error(
                `[MINI-JEUX] Impossible de prévenir le salon ${channelId} :`,
                error
            );
        }
    }
}

async function restaurerAvertissementsRedemarrageMinijeux() {
    const avertissements = {
        ...avertissementsRedemarrageMinijeux
    };

    for (const [channelId, messageId] of Object.entries(avertissements)) {
        try {
            const salon = await client.channels.fetch(channelId);

            if (!salon?.isTextBased()) continue;

            const ancienMessage = await salon.messages
                .fetch(messageId)
                .catch(() => null);

            if (ancienMessage) {
                await ancienMessage.delete().catch(() => {});
            }

            const maintenant = Date.now();

            const sessionActive =
                (
                    channelId === MOTUS_CHANNEL_ID &&
                    motusData?.mot &&
                    !motusData.termine &&
                    motusData.expireAt > maintenant
                ) ||
                (
                    channelId === PENDU_CHANNEL_ID &&
                    penduData?.mot &&
                    !penduData.termine &&
                    penduData.expireAt > maintenant
                ) ||
                (
                    channelId === REBUS_CHANNEL_ID &&
                    rebusSessionData?.active &&
                    rebusSessionData.limite16hTimestamp > maintenant
                );

            const contenu = sessionActive
                ? '✅ **Cacabot est de retour !** La session a été restaurée, vous pouvez reprendre la partie.'
                : '✅ **Cacabot est de retour !** La session précédente est terminée.';

            const retour = await salon.send({
                content: contenu,
                allowedMentions: { parse: [] }
            });

            setTimeout(() => {
                retour.delete().catch(() => {});
            }, 30 * 1000);

            delete avertissementsRedemarrageMinijeux[channelId];

        } catch (error) {
            console.error(
                `[MINI-JEUX] Erreur lors du retour dans ${channelId} :`,
                error
            );
        }
    }

    demanderSauvegarde();
}

async function arreterAvecSauvegarde(signal) {
    if (arretEnCours) return;
    arretEnCours = true;

    console.log(`🛑 ${signal} reçu, sauvegarde avant arrêt...`);

    if (donneesChargees && client.isReady()) {
        await envoyerAvertissementsRedemarrageMinijeux();
    }

    if (saveEnAttente) {
        clearTimeout(saveEnAttente);
        saveEnAttente = null;
    }

    // Un échec réseau transitoire pendant SIGTERM/SIGINT ne doit
    // pas provoquer un abandon immédiat de la dernière sauvegarde.
    // Le nombre d'essais est borné pour éviter de bloquer l'arrêt
    // indéfiniment si Discord reste indisponible.
    const MAX_ESSAIS_ARRET = 3;
    let sauvegardeConfirmee = !donneesChargees;

    for (let tentative = 1; tentative <= MAX_ESSAIS_ARRET && !sauvegardeConfirmee; tentative++) {
        try {
            await saveAll();
            sauvegardeConfirmee = true;
            console.log('✅ Sauvegarde finale effectuée.');
        } catch (err) {
            console.error(
                `🚨 Sauvegarde finale échouée (essai ${tentative}/${MAX_ESSAIS_ARRET}) :`,
                err
            );
            if (tentative < MAX_ESSAIS_ARRET) {
                await new Promise(resolve => setTimeout(resolve, 2000 * tentative));
            }
        }
    }

    if (!sauvegardeConfirmee) {
        console.error(
            '🚨 ARRÊT SANS CONFIRMATION DE SAUVEGARDE : ' +
            'conserver toutes les anciennes sauvegardes Discord.'
        );
    }

    process.exit(sauvegardeConfirmee ? 0 : 1);
}

process.on('SIGTERM', () => {
    arreterAvecSauvegarde('SIGTERM').catch(console.error);
});

process.on('SIGINT', () => {
    arreterAvecSauvegarde('SIGINT').catch(console.error);
});

// Empêche le bot de crasher sur les rejets Discord bénins (suppression, timeout ou ack)
process.on('unhandledRejection', (error) => {
    if (
        error?.code === 50035 ||
        error?.code === 10008 ||
        error?.code === 10062 ||
        error?.code === 40060 ||
        error?.code === 10015 ||
        error?.code === 10003 ||
        error?.code === 50001 ||
        error?.code === 50013
    ) {
        return console.warn('⚠️ Requête Discord ignorée (message supprimé, interaction expirée, permission ou salon fermé).');
    }
    console.error('⚠️ Erreur non gérée capturée :', error);
});

// Aliases pour compatibilite
const saveTop = saveAll;
const saveBirthdays = saveAll;

const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ButtonBuilder,
    ChannelType,
    ButtonStyle,
    SlashCommandBuilder,
    ContextMenuCommandBuilder,
    ApplicationCommandType,
    REST,
    Routes,
    MessageFlags
} = require('discord.js');

const { createCanvas, loadImage, registerFont } = require('canvas');
const fs = require('fs');

// =========================
//      INTERSECTIONS
// =========================

///repliques.js
const { getResponse } = require('./repliques.js');

///!destin
const { getDestinReponse, handleDestinSlash } = require('./destin.js');

///!horoscope
const { getHoroscopeForSign, buildHoroscopeEmbed, execute: executeHoroscope } = require('./horoscope.js');

///animal.js
const { getAnimalResponse, handleAnimalMessage, handleAnimalSlash } = require('./animal.js');

///interaction.js
const { handleInteractionMessage, handleInteractionButton, handleInteractionSlash } = require('./interaction.js');

///help.js
const { getHelpResponse, handleHelpMessage, handleHelpInteraction } = require('./help.js');

///minijeux.js
const {
    MOTUS_CHANNEL_ID,
    REBUS_CHANNEL_ID,
    isRebusSessionActive,
    initMinijeuxState,
    envoyerMotusQuotidien,
    lancerSessionRebus,
    restaurerSessionRebus,
    handleMotusMessage,
    handleMotusButton,
    handleMotusSlash,
    handleRebusMessage,
    handleRebusButton,
    handleRebusSlash
} = require('./minijeux.js');

///pendu.js
const {
    PENDU_CHANNEL_ID,
    initPenduState,
    lancerPenduQuotidien,
    handlePenduMessage,
    handlePenduSlash,
    handlePenduButton,
    reprendreRecompensesPendu,
    reconcilierPublicationPendu
} = require('./pendu.js');

///rolembed.js
const {
    handleRolembedMessage,
    handleRolembedInteraction
} = require('./rolembed.js');

///suggestion.js
const {
    initSuggestionState,
    handleSuggestionMessage,
    handleSuggestionSlash,
    handleSuggestionButton
} = require('./suggestion.js');

initSuggestionState({
    getSuggestionsData: () => suggestionsData,
    demanderSauvegarde,
    trackBattlePassProgress: (uid, type, amt, meta) => trackBattlePassProgress(uid, type, amt, meta)
});

initPenduState({
    getPenduData: () => penduData,
    setPenduData: (d) => { penduData = d; },
    getPenduStats: () => penduStats,
    setPenduStats: (s) => { penduStats = s; },

    getPenduPublicationPending: () => penduPublicationPending,
    setPenduPublicationPending: (publication) => {
        penduPublicationPending = publication;
    },

    getMotusStats: () => motusStats,
    getRebusStats: () => rebusStats,
    demanderSauvegarde: () => demanderSauvegarde(),
    saveAll: () => saveAll(),
    trackBattlePassProgress: (uid, type, amt, meta) =>
        trackBattlePassProgress(uid, type, amt, meta),
    grantTcgPoints: (uids, pts, rewardKey) =>
        grantMinigameTcgPoints(client, uids, pts, rewardKey)
});

///welcome.js
const {
    handleWelcomeMessage,
    handleWelcomeSlash,
    handleWelcomeInteraction,
    handleWelcomeMemberAdd,
    initWelcomeState
} = require('./welcome.js');

///social.js
const {
    resoudreChoix,
    handleSocialMessage,
    handleSocialSlash,
    handleSocialInteraction
} = require('./social.js');

///roulette.js
const {
    ROULETTE_ETATS,
    initRouletteBridge,
    verifierHappyHour,
    declencherHappyHourRoulette,
    initialiserWebhooksRoulette,
    assurerWebhookRoulette,
    armerNotifRoulette,
    restaurerNotifsRoulette,
    deverrouillerSucces,
    rouletteNotifs,
    rouletteAntiFeurUntil,
    rouletteAntiFeurDodges,
    rouletteAchievements,
    rouletteStats,
    rouletteBouclierActif,
    rouletteRedirectCharges,
    crediterInventaireRoulette,
    buildRouletteStateEmbed,
    rouletteVotesPublics,
    buildVoteRouletteRow,
    migrateVoteRouletteMessage,
    restaurerVotesRoulette,
    handleRouletteMessage,
    handleRouletteSlash,
    handleRouletteButton,
    handleRouletteCouronne,
    estSalonExcluMalusTexte,
    handleRouletteTransfoMessage,
    handleRoulettePseudoLock
} = require('./roulette.js');

// Vérifie si un membre a un malus textuel en cours (message remplacé par webhook puis supprimé)
function aMalusTextuelActif(userId, channel = null) {
    if (!userId || !ROULETTE_ETATS) return false;
    if (channel && estSalonExcluMalusTexte(channel)) return false;
    const tf = ROULETTE_ETATS.transfos?.get(userId);
    if (tf && Object.values(tf).some(fin => typeof fin === 'number' && fin > Date.now())) return true;
    if (ROULETTE_ETATS.uwu?.get(userId) > Date.now()) return true;
    if (ROULETTE_ETATS.lettreInterdite?.get(userId)?.until > Date.now()) return true;
    if (ROULETTE_ETATS.emoji?.get(userId) > Date.now()) return true;
    if (ROULETTE_ETATS.leet?.get(userId) > Date.now()) return true;
    if (ROULETTE_ETATS.echo?.get(userId) > Date.now()) return true;
    return false;
}

///embeds.js
const {
    handleEmbedMessage,
    handleEmbedSlash,
    handleEmbedInteraction
} = require('./embeds.js');

///youtube.js
const {
    initYoutubeState,
    handleYoutubeMessage,
    handleYoutubeSlash,
    handleYoutubeButton,
    verifierNouvellesVideosYouTube
} = require('./youtube.js');

///anniversaire.js
const {
    initBirthdayState,
    getGuildBirthdays,
    getBirthdayChannelId,
    estAnniversaireAujourdhui,
    scheduleBirthdayCheck,
    handleAnniversaireMessage,
    handleAnniversaireSlash,
    handleAnniversaireButton
} = require('./anniversaire.js');

///security.js
const {
    initSecurityState,
    estModo,
    isChannelMuted,
    handleSecurityMessage,
    handleSecurityInteraction,
    handleSecurityMemberAdd,
    handleSecurityReactionAdd,
    handleSecurityReactionRemove
} = require('./security.js');

///quotes.js
const {
    initQuotesState,
    handleQuotesMessage,
    handleQuotesSlash,
    handleQuotesButton
} = require('./quotes.js');

initBirthdayState({
    getBirthdayData: () => birthdayData,
    saveBirthdays: async () => saveAll(),
    findMemberByName,
    askDisambiguation,
    estModo,
    EPSYS_ID: '436218312574107658'
});

initQuotesState({
    getQuotesData: () => quotesData,
    demanderSauvegarde,
    findMemberByName,
    estModo,
    EPSYS_ID: '436218312574107658'
});

initWelcomeState({
    getWelcomeData: () => welcomeData,
    getReactionRolesData: () => reactionRolesData,
    demanderSauvegarde,
    EPSYS_ID: '436218312574107658'
});

///tools.js
const {
    initToolsState,
    handleToolsMessage,
    handleToolsSlash,
    handleToolsInteraction,
    getBugsList,
    setBugsList,
    restaurerRappels
} = require('./tools.js');

initMinijeuxState({
    getMotusData: () => motusData,
    setMotusData: (d) => { motusData = d; },
    getMotusStats: () => motusStats,
    setMotusStats: (s) => { motusStats = s; },
    getRebusStats: () => rebusStats,
    setRebusStats: (s) => { rebusStats = s; },
    getRebusSession: () => rebusSessionData,
    setRebusSession: (s) => { rebusSessionData = s; },
    saveNow: () => saveAll(),
    getPenduStats: () => penduStats,
    setPenduStats: (s) => { penduStats = s; },
    demanderSauvegarde: () => demanderSauvegarde(),
    trackBattlePassProgress: (uid, type, amt, meta) => trackBattlePassProgress(uid, type, amt, meta),
    grantTcgPoints: (uids, pts, rewardKey) =>
        grantMinigameTcgPoints(client, uids, pts, rewardKey)
});

///tcg.js
const {
    AFK_VOCAL_CHANNEL_ID,
    hasTcgRole,
    initTcgState,
    scanSet1Cards,
    getTcgCardsCount,
    restaurerNotifsTcg,
    verifierInactiviteTradesTcg,
    verifierBoosterHebdoTcg,
    verifierQueteCommunautaireTcg,
    backfillRecentOpeningsTcg,
    trackTcgMessagePoint,
    trackTcgVocalMinute,
    trackTcgRoulettePoint,
    addTcgPointsFromRoulette,
    addTcgBoostersFromRoulette,
    reduceTcgBoosterCooldown,
    grantMinigameTcgPoints,
    handleTcgTradeThreadMessage,
    handleTcgMessage,
    handleTcgSlash,
    handleTcgInteraction
} = require('./tcg.js');

initRouletteBridge({
    topData,
    demanderSauvegarde,
    saveAll,
    estAnniversaireAujourdhui,
    estModo,
    EPSYS_ID: '436218312574107658',
    findMemberByName,
    askDisambiguation,
    suggestionsData,
    trackBattlePassProgress: (uid, type, amt, meta) => trackBattlePassProgress(uid, type, amt, meta),
    trackTcgRoulettePoint: (uid, member) => trackTcgRoulettePoint(uid, member),
    hasTcgCollectorRole: (member) => hasTcgRole(member),
    addTcgPoints: (uid, pts, member) => addTcgPointsFromRoulette(uid, pts, member),
    addTcgBoosters: (uid, qty, member) => addTcgBoostersFromRoulette(uid, qty, member),
    reduceTcgBoosterCooldown: (uid, ms, member) => reduceTcgBoosterCooldown(uid, ms, member)
});


const lemonMilkPaths = [
    './LEMONMILK-Bold.otf',
    './LemonMilk-Bold.otf',
    './lemonmilk-bold.otf',
    './LemonMilk.otf',
    './LEMONMILK.otf',
    './assets/LEMONMILK-Bold.otf',
    './assets/LemonMilk-Bold.otf'
];
for (const p of lemonMilkPaths) {
    if (fs.existsSync(p)) {
        try {
            registerFont(p, { family: 'LemonMilk', weight: 'bold' });
            registerFont(p, { family: 'LemonMilk', weight: 'normal' });
            break;
        } catch (e) { console.warn('[INDEX] Chargement de police impossible :', p, e); }
    }
}

// Signaler les erreurs techniques dans le salon privé, sans spam ni mentions.
const ERROR_REPORT_CHANNEL_ID = '1556891268498325554';
const originalConsoleError = console.error.bind(console);
const errorReportQueue = [];
const errorReportRecent = new Map();
let errorReportClient = null;
let errorReportSending = false;
let errorReportLastSent = 0;

function sanitizeErrorReport(value) {
    let str = String(value ?? '');
    for (const secret of [process.env.TOKEN, process.env.DISCORD_TOKEN, process.env.GITHUB_TOKEN]) {
        if (typeof secret === 'string' && secret.length >= 8) {
            str = str.split(secret).join('[SECRET MASQUÉ]');
        }
    }
    return str.replace(/(authorization\s*[:=]\s*(?:bot|bearer)\s+)[^\s]+/gi, '$1[MASQUÉ]');
}

function queueDiscordErrorReport(args) {
    const error = args.find(item => item instanceof Error);
    const context = args.filter(item => item !== error).map(item =>
        typeof item === 'string' ? item : '[détails supplémentaires]'
    ).join(' ');
    const stack = error?.stack || '';
    const source = stack.split('\n').map(line => line.trim()).find(line =>
        /\.js:\d+:\d+/.test(line) && !line.includes('node_modules')
    ) || 'Emplacement non disponible';
    const title = sanitizeErrorReport(context || error?.message || 'Erreur non précisée').slice(0, 300);
    const detail = sanitizeErrorReport(error?.message || context || 'Voir les journaux du bot').slice(0, 500);
    const location = sanitizeErrorReport(source).slice(0, 350);
    const key = [title, detail, location].join('|');
    const now = Date.now();
    const previous = errorReportRecent.get(key);
    if (previous && now - previous < 10 * 60 * 1000) return;
    errorReportRecent.set(key, now);
    // Limiter la mémoire : retirer d'abord les anciennes erreurs, puis les plus vieilles.
    if (errorReportRecent.size > 200) {
        for (const [oldKey, timestamp] of errorReportRecent) {
            if (now - timestamp > 10 * 60 * 1000) errorReportRecent.delete(oldKey);
        }
        while (errorReportRecent.size > 200) {
            errorReportRecent.delete(errorReportRecent.keys().next().value);
        }
    }
    if (errorReportQueue.length >= 30) errorReportQueue.shift();
    errorReportQueue.push({ title, detail, location });
    void flushDiscordErrorReports();
}

async function flushDiscordErrorReports() {
    if (errorReportSending || !errorReportClient?.isReady?.() || !errorReportQueue.length) return;
    errorReportSending = true;
    try {
        while (errorReportQueue.length && errorReportClient?.isReady?.()) {
            const wait = Math.max(0, 2500 - (Date.now() - errorReportLastSent));
            if (wait) await new Promise(resolve => setTimeout(resolve, wait));
            const report = errorReportQueue[0];
            const channel = await errorReportClient.channels.fetch(ERROR_REPORT_CHANNEL_ID);
            if (!channel?.send) throw new Error('Salon de rapports introuvable ou inaccessible');
            await channel.send({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xe74c3c)
                        .setTitle('🚨 Cacabot a rencontré un problème')
                        .addFields(
                            { name: 'Problème', value: report.title.slice(0, 1024) || 'Erreur inconnue' },
                            { name: 'Détail', value: report.detail.slice(0, 1024) || 'Aucun détail disponible' },
                            { name: 'Fichier / ligne', value: report.location.slice(0, 1024) || 'Emplacement non disponible' }
                        )
                        .setTimestamp()
                ],
                allowedMentions: { parse: [] }
            });
            errorReportQueue.shift();
            errorReportLastSent = Date.now();
        }
    } catch (err) {
        originalConsoleError('[ERROR REPORTER] Envoi au salon impossible :', err);
        // Ne pas bloquer les commandes si Discord refuse les alertes.
        // Une prochaine erreur relancera l'envoi de la file en attente.
    } finally {
        errorReportSending = false;
    }
}

console.error = (...args) => {
    originalConsoleError(...args);
    try { queueDiscordErrorReport(args); }
    catch (err) { originalConsoleError('[ERROR REPORTER] Rapport impossible :', err); }
};

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});
errorReportClient = client;

// Les erreurs de connexion Discord passent aussi dans le salon de diagnostic.
client.on('error', err => console.error('[DISCORD] Erreur du client :', err));
client.on('shardError', err => console.error('[DISCORD] Erreur de connexion :', err));

initToolsState({
    client,
    getTopData: () => topData,
    getVersionString,
    demanderSauvegarde,
    estModo,
    getSuggestionsData: () => suggestionsData,
    getRouletteVotesPublics: () => rouletteVotesPublics,
    buildVoteRouletteRow,
    migrateVoteRouletteMessage
});

initYoutubeState({
    client,
    getYoutubeWatchData: () => youtubeWatchData,
    demanderSauvegarde
});

///battlepass.js
const {
    initBattlePassState,
    trackBattlePassProgress,
    handleBattlePassMessage,
    handleBattlePassSlash,
    handleBattlePassInteraction
} = require('./battlepass.js');

initBattlePassState({
    client,
    getBattlePassData: () => battlePassData,
    demanderSauvegarde,
    crediterInventaireRoulette,
    declencherHappyHourRoulette: (duree, raison, cl) => declencherHappyHourRoulette(duree, raison, cl || client),
    rouletteBouclierActif,
    rouletteRedirectCharges,
    rouletteStats,
    EPSYS_ID: '436218312574107658'
});

///activity.js
const {
    initActivityState,
    handleActivityMessage,
    handleActivitySlash,
    handleActivityButton,
    cleanOldData,
    getTodayKey,
    getWeekKey,
    getMonthKey
} = require('./activity.js');

initActivityState({
    topData,
    dailyData,
    weeklyData,
    monthlyData,
    getGuildBirthdays,
    rouletteAchievements,
    rouletteStats,
    rouletteBouclierActif,
    getMotusStats: () => motusStats,
    getRebusStats: () => rebusStats,
    getQuotesData: () => quotesData,
    getBattlePassData: () => battlePassData,
    demanderSauvegarde,
    saveAll,
    findMemberByName,
    askDisambiguation,
    client,
    EPSYS_ID: '436218312574107658'
});

initSecurityState({
    getReactionRolesData: () => reactionRolesData,
    getWarnsData: () => warnsData,
    getDestitutionVotesData: () => destitutionVotesData,
    demanderSauvegarde,
    client,
    EPSYS_ID: '436218312574107658'
});

initTcgState({
    client,
    getTcgData: () => tcgData,
    demanderSauvegarde,
    saveAll,
    findMemberByName,
    askDisambiguation,
    estModo,
    trackBattlePassProgress: (uid, type, amt, meta) => trackBattlePassProgress(uid, type, amt, meta),
    declencherHappyHourRoulette: (duree, raison, cl) => declencherHappyHourRoulette(duree, raison, cl || client)
});

///watcher.js
const {
    verifierTwitchLive,
    handleWatcherMessage,
    handleVoiceStateUpdate
} = require('./watcher.js');

const FEUR_IMMUNE = ['1503495713097519355'];

// =========================
//     LOGIQUE MOTUS (10h & 19h)
// =========================
// Déporté dans ./minijeux.js

// =========================
//  RÉPLIQUES RÉFLEXES
// =========================
// Déporté dans ./repliques.js

const pendingCheh = new Map();

const cooldowns = new Map();

const vocalMessages = new Map();
const dernierMessageParUtilisateur = new Map();
const EPSYS_ID = '436218312574107658';

// =========================
//           CHEH
// =========================

function checkCooldown(userId, cmd, seconds = 3) {
    const key = `${userId}_${cmd}`;
    const now = Date.now();
    if (cooldowns.has(key) && now - cooldowns.get(key) < seconds * 1000) return false;
    cooldowns.set(key, now);
    return true;
}
const CHEH_GIF = 'https://cdn.discordapp.com/attachments/1128032964924670053/1505363865137840180/cheh.gif';

// =========================
//     RECHERCHE PAR PSEUDO
// =========================

function findMemberByName(guild, query) {
    if (!guild) return { found: null, multiple: false, candidates: [] };
    const q = query.toLowerCase();

    const exact = guild.members.cache.filter(m =>
        (m.displayName && m.displayName.toLowerCase() === q) ||
        (m.user.username && m.user.username.toLowerCase() === q)
    );
    if (exact.size === 1) return { found: exact.first(), multiple: false, candidates: [] };
    if (exact.size > 1) {
        const candidates = exact.map(m => m.displayName ?? m.user.username);
        return { found: null, multiple: true, candidates };
    }

    const partial = guild.members.cache.filter(m =>
        (m.displayName && m.displayName.toLowerCase().includes(q)) ||
        (m.user.username && m.user.username.toLowerCase().includes(q))
    );
    if (partial.size === 0) return { found: null, multiple: false, candidates: [] };
    if (partial.size === 1) return { found: partial.first(), multiple: false, candidates: [] };
    const candidates = partial.map(m => m.displayName ?? m.user.username);
    return { found: null, multiple: true, candidates };
}

async function replyTemp(message, content, delaiSec = 6) {
    const msg = await message.reply(content).catch(() => null);
    if (msg) setTimeout(() => msg.delete().catch(() => {}), delaiSec * 1000);
    return msg;
}

async function askDisambiguation(message, guild, candidates, callback) {
    const list = candidates.map(c => `* **${c}**`).join('\n');
    const prompt = await message.reply(`Il y a **${candidates.length}** personnes avec un pseudo similaire. Tu voulais parler de qui ? Essaie d'\u00eatre plus pr\u00e9cis.e !\n${list}`);

    const filter = m => m.author.id === message.author.id;
    const collector = message.channel.createMessageCollector({ filter, time: 20000 });

    collector.on('collect', m => {
        const q = m.content.trim().toLowerCase();
        const match = candidates.find(c => c.toLowerCase() === q);
        if (match) {
            collector.stop('found');
            m.delete().catch(() => {});
            prompt.delete().catch(() => {});
            const member = guild.members.cache.find(mb =>
                (mb.displayName && mb.displayName === match) ||
                (mb.user.username && mb.user.username === match)
            );
            if (member) callback(member.user);
        } else {
            const retry = candidates.map(c => `* **${c}**`).join('\n');
            message.reply(`Ce pseudo ne correspond pas exactement \u00e0 l'un des choix. Essaie encore !\n${retry}`)
                .then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));
            m.delete().catch(() => {});
        }
    });

    collector.on('end', (_, reason) => {
        if (reason !== 'found') {
            prompt.delete().catch(() => {});
            message.reply("Bon... On abandonne alors !").then(msg =>
                setTimeout(() => { msg.delete().catch(() => {}); message.delete().catch(() => {}); }, 3000)
            );
        }
    });
}

async function disableButtons(interaction) {
    try {
        const msg = interaction.message;
        const newRows = msg.components.map(row => {
            const newRow = new ActionRowBuilder();
            newRow.addComponents(row.components.map(btn => ButtonBuilder.from(btn).setDisabled(true)));
            return newRow;
        });
        await msg.edit({ components: newRows });
    } catch (e) { if (e?.code !== 10008) console.warn('[INDEX] Désactivation des boutons échouée :', e); }
}

// =========================
//     LISTENER MESSAGES
// =========================

    // Ping Notifs Shorts quand Gappy sort un nouveau TikTok
    client.on('messageCreate', async (message) => {
        if (!donneesChargees) return;

        if (message.author.id === client.user.id) {
            topData.messages['1503495713097519355'] = (topData.messages['1503495713097519355'] || 0) + 1;
            return;
        }
        if (message.author.bot) return;

        // Surveillance des threads d'échange RegaDex (activité 24h & blocage des tiers)
        if (await handleTcgTradeThreadMessage(message)) return;

        // Commande prioritaire Rolembed (Epsys-only)
        if (message.content.trim().toLowerCase().startsWith('!rolembed')) {
            if (await handleRolembedMessage(message)) return;
        }

        // =========================
        //  COMMANDE DIAGNOSTIC (EPSYS)
        // =========================
        const commandeDiagnostic = message.content.trim().toLowerCase();

        if (
            commandeDiagnostic === '!diag minijeux' ||
            commandeDiagnostic === '!diag roulette' ||
            commandeDiagnostic === '!diag tcg'
        ) {
            if (message.author.id !== '436218312574107658') return;

            const type = commandeDiagnostic.split(' ')[1];

            await message.reply(
                construireDiagnosticSpecialise(type, message.author.id)
            );
            return;
        }

        if (commandeDiagnostic === '!diag' || commandeDiagnostic === '!cacatest') {
            if (message.author.id !== '436218312574107658') return;

            const sent = await message.reply('🔍 **Diagnostic de Cacabot en cours...** Analyse de tous les modules...');

            const modules = [
                { nom: 'Roulette', obj: typeof handleRouletteMessage === 'function' && typeof ROULETTE_ETATS === 'object' },
                // [SET 2] >= 109 reste valide quand les cartes du Set 2 s'ajouteront
                { nom: 'RegaDex (TCG)', obj: typeof handleTcgMessage === 'function' && typeof getTcgCardsCount === 'function' && getTcgCardsCount() >= 109 },
                { nom: 'Tools & Utilitaires', obj: typeof handleToolsMessage === 'function' && typeof handleToolsSlash === 'function' },
                { nom: 'Minijeux (Motus/Rébus)', obj: typeof handleMotusMessage === 'function' && typeof handleRebusMessage === 'function' },
                { nom: 'Pendu Quotidien', obj: typeof handlePenduMessage === 'function' },
                { nom: 'Suggestions', obj: typeof handleSuggestionMessage === 'function' },
                { nom: 'Anniversaires', obj: typeof handleAnniversaireMessage === 'function' && typeof getGuildBirthdays === 'function' },
                { nom: 'Citations (Quotes)', obj: typeof handleQuotesMessage === 'function' && Array.isArray(quotesData) },
                { nom: 'Bienvenue (Canvas)', obj: typeof handleWelcomeMessage === 'function' },
                { nom: 'YouTube', obj: typeof handleYoutubeMessage === 'function' },
                { nom: 'Embeds (Epsys)', obj: typeof handleEmbedMessage === 'function' },
                { nom: 'Social & Jeux', obj: typeof handleSocialMessage === 'function' },
                { nom: 'Interactions', obj: typeof handleInteractionMessage === 'function' },
                { nom: 'Help', obj: typeof handleHelpMessage === 'function' }
            ];

            const rapport = [];
            let modulesOk = 0;
            for (const m of modules) {
                if (m.obj) {
                    rapport.push(`✅ **${m.nom}** : Opérationnel`);
                    modulesOk++;
                } else {
                    rapport.push(`❌ **${m.nom}** : Incomplet ou non importé`);
                }
            }

            const backupChan = client.channels.cache.get(BACKUP_CHANNEL_ID);
            const backupOk = backupChan ? '✅ Connecté' : '❌ Salon introuvable';

            let meteoOk = '❌ Déconnecté';
            try {
                const resMeteo = await fetch('https://geocoding-api.open-meteo.com/v1/search?name=Paris&count=1&language=fr&format=json');
                if (resMeteo.ok) meteoOk = '✅ Opérationnel';
            } catch (e) {
                meteoOk = '⚠️ Timeout';
            }

            let twitchOk = '❌ Déconnecté';
            try {
                const resTwitch = await fetch('https://decapi.me/twitch/uptime/epsys_');
                if (resTwitch.ok) twitchOk = '✅ Opérationnel';
            } catch (e) {
                twitchOk = '⚠️ Timeout';
            }

            const ramMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
            const wsPing = client.ws.ping;
            const diffSave = lastsaveSaveTime ? `${Math.floor((Date.now() - lastsaveSaveTime) / 60000)} min` : 'Jamais';
            const totalMembres = client.guilds.cache.get('720057528351850547')?.memberCount ?? 0;

            const toutOk = modulesOk === modules.length;
            const embedDiag = new EmbedBuilder()
                .setColor(toutOk ? 0x2ecc71 : 0xe67e22)
                .setTitle('🩺 Cacabot • Tableau de santé')
                .setDescription(
                    `${toutOk ? '🟢 **Modules chargés avec succès**' : '🟠 **Certains modules sont à vérifier**'}\n` +
                    `**${modulesOk}/${modules.length} contrôles structurels validés**`
                )
                .addFields(
                    {
                        name: '🧩 Modules disponibles',
                        value: rapport.join('\n'),
                        inline: false
                    },
                    {
                        name: '💾 Persistance et services',
                        value: `**Sauvegarde :** ${backupOk} (dernière : ${diffSave})\n` +
                            `**Météo :** ${meteoOk}\n**Twitch :** ${twitchOk}`,
                        inline: false
                    },
                    {
                        name: '📡 Performances',
                        value: `**Discord :** ${wsPing} ms\n**Mémoire :** ${ramMb} Mo\n` +
                            `**Membres :** ${totalMembres}`,
                        inline: true
                    },
                    {
                        name: 'ℹ️ À savoir',
                        value: 'Ces indicateurs vérifient la présence des modules et la disponibilité ' +
                            'des services, pas toutes les fonctionnalités en conditions réelles.',
                        inline: false
                    }
                )
                .setFooter({ text: `Version ${getVersionString()} • Node.js ${process.version} • Dokploy` })
                .setTimestamp();

            await sent.edit({ content: null, embeds: [embedDiag] });
            return;
        }

        // Sentinelles, conversion de liens & surveillance
        if (await handleWatcherMessage(message)) return;

        // =========================
        //   SALON DÉCODEUR D'EMOJIS
        // =========================
        if (await handleRebusMessage(message, null, client, { findMemberByName })) return;

        // =========================
        //     SALON MOTUS DU JOUR
        // =========================
        if (await handleMotusMessage(message, null, client, { findMemberByName })) return;

        // =========================
        //   SALON PENDU QUOTIDIEN
        // =========================
        if (await handlePenduMessage(message, null, client, { findMemberByName })) return;

    // =========================
    //   SÉCURITÉ & MODÉRATION
    // =========================
    if (await handleSecurityMessage(message)) return;

    // =========================
    //   COMMANDES ROULETTE
    // =========================
    if (await handleRouletteMessage(message, null, client, { findMemberByName, askDisambiguation })) return;

    // Ping Cacabot seul -> "Quoi ? (Feur)" (Silencieux - ignoré si malus textuel pour éviter de répondre à un message supprimé)
    const strippedMsg = message.content.replace(/<@!?1503495713097519355>/g, '').trim();
    if (!isChannelMuted(message.channel.id) && message.content.includes('1503495713097519355') && strippedMsg.length === 0) {
        if (aMalusTextuelActif(message.author.id, message.channel)) return;
        const finAf = rouletteAntiFeurUntil.get(message.author.id);
        if (finAf && Date.now() < finAf) {
            const d = (rouletteAntiFeurDodges.get(message.author.id) || 0) + 1;
            rouletteAntiFeurDodges.set(message.author.id, d);
            if (d >= 5) deverrouillerSucces(message.author.id, 'tete-dure', message.channel);
            trackBattlePassProgress(message.author.id, 'feur_dodge', 1);
            return message.react('🛡️').catch(() => {});
        }
        return message.reply({ content: 'Quoi ? (Feur)', flags: [MessageFlags.SuppressNotifications], allowedMentions: { repliedUser: false } });
    }

    // Cheh (Silencieux - ignoré si malus textuel)
    const cleanedCheh = message.content.toLowerCase().trim();
    if (!isChannelMuted(message.channel.id) && pendingCheh.has(message.channel.id) && (cleanedCheh.includes('ntm') || cleanedCheh.includes('tg') || cleanedCheh.includes('nique ta') || cleanedCheh.includes('ta gueule') || cleanedCheh.includes('jte bz') || cleanedCheh.includes('bztmr') || cleanedCheh.includes('va te faire enculer') || cleanedCheh.includes('la ferme') || cleanedCheh.includes('tais-toi') || cleanedCheh.includes('mange tes'))) {
        pendingCheh.delete(message.channel.id);
        if (aMalusTextuelActif(message.author.id, message.channel)) return;
        return message.reply({ content: CHEH_GIF, flags: [MessageFlags.SuppressNotifications], allowedMentions: { repliedUser: false } });
    }

    // Comptage messages pour !top & Capteur Central Battle Pass
    if (message.guild && message.guild.id === '720057528351850547') {
        const uid = message.author.id;
        if (!topData.messages[uid]) topData.messages[uid] = 0;
        topData.messages[uid]++;

        const rawLower = message.content.trim().toLowerCase();
        const cmdPass = rawLower.split(/\s+/)[0];

        // Points RegaDex (1 pt tous les 15 messages naturels, tous salons confondus)
        if (!message.content.trim().startsWith('!')) {
            trackTcgMessagePoint(uid, message.member);
        }

        // 1. Quête messages simples avec métadonnées de salon et d'état
        if (message.content.trim().length >= 4 && !message.content.startsWith('!')) {
            const hasCooldown = (ROULETTE_ETATS.cooldowns?.get(uid) > Date.now());
            const hasCouronne = (ROULETTE_ETATS.couronne?.get(uid) > Date.now());
            trackBattlePassProgress(uid, 'message', 1, {
                channelId: message.channel.id,
                hasCooldown,
                hasCouronne
            });
            
            // Quête : parler sous un malus textuel
            const transfosMembre = ROULETTE_ETATS.transfos.get(uid);
            const aMalusActif = (transfosMembre && Object.keys(transfosMembre).length > 0) ||
                                (ROULETTE_ETATS.uwu.get(uid) > Date.now()) ||
                                (ROULETTE_ETATS.lettreInterdite.get(uid)?.until > Date.now()) ||
                                (ROULETTE_ETATS.emoji.get(uid) > Date.now()) ||
                                (ROULETTE_ETATS.leet.get(uid) > Date.now());
            if (aMalusActif && !estSalonExcluMalusTexte(message.channel)) {
                trackBattlePassProgress(uid, 'malus_msg', 1);
            }
        }

        // 2. Quêtes d'interactions & commandes (capturées AVANT que les sous-modules ne fassent return)
        if (['!kiss', '!hug', '!danse', '!dance', '!bisou', '!calin'].includes(cmdPass)) {
            trackBattlePassProgress(uid, 'interact_gentil', 1);
        } else if (['!punch', '!bang', '!insult', '!frappe', '!tir', '!pan'].includes(cmdPass)) {
            trackBattlePassProgress(uid, 'interact_combat', 1);
        } else if (['!horoscope', '!destin'].includes(cmdPass)) {
            trackBattlePassProgress(uid, 'oracle', 1);
        } else if (['!epsys', '!bougetoi', '!montage', '!video', '!lavideo'].includes(cmdPass)) {
            trackBattlePassProgress(uid, 'epsys_cmd', 1);
        } else if (['!quote', '!citation'].includes(cmdPass)) {
            trackBattlePassProgress(uid, 'quote', 1);
        } else if (['!jailaref', '!palaref', '!glaref', '!gref', '!pref'].includes(cmdPass)) {
            trackBattlePassProgress(uid, 'ref', 1);
        } else if (message.channel.id === MOTUS_CHANNEL_ID && rawLower.length >= 5 && rawLower.length <= 8) {
            trackBattlePassProgress(uid, 'minijeu_essai', 1);
            trackBattlePassProgress(uid, 'minijeu_part', 1);
        }

        // Comptage des messages avant sauvegarde
        messagesSinceLastsaveSave++;

        const todayKey = getTodayKey();
        if (!dailyData[todayKey]) dailyData[todayKey] = {};
        if (!dailyData[todayKey][uid]) dailyData[todayKey][uid] = 0;
        dailyData[todayKey][uid]++;

        const weekKey = getWeekKey();
        if (!weeklyData[weekKey]) weeklyData[weekKey] = {};
        if (!weeklyData[weekKey][uid]) weeklyData[weekKey][uid] = 0;
        weeklyData[weekKey][uid]++;

        const monthKey = getMonthKey();
        if (!monthlyData[monthKey]) monthlyData[monthKey] = {};
        if (!monthlyData[monthKey][uid]) monthlyData[monthKey][uid] = 0;
        monthlyData[monthKey][uid]++;
                // Sauvegarde après mise à jour de tous les compteurs
        if (messagesSinceLastsaveSave >= 75) {
            messagesSinceLastsaveSave = 0;

            saveAll().catch(err => {
                console.error(
                    '❌ Sauvegarde des 75 messages échouée :',
                    err
                );
            });
        }
    }

    const isExplicitCommand = message.content.trim().startsWith('!');
    const sousMalusTexte = !isExplicitCommand && aMalusTextuelActif(message.author.id, message.channel);
    const response = (FEUR_IMMUNE.includes(message.author.id) || sousMalusTexte) ? null : await getResponse(message.content);

    if (isChannelMuted(message.channel.id) && !isExplicitCommand) {
        return;
    }

    // Si ce n'est pas une réplique réflexe ET que ce n'est pas une commande commençant par !, on ignore
    if (!response && !isExplicitCommand) return;

// Commandes RegaDex TCG (!regadex, !rgdx, !tcg, !booster, !classeur, !carte, !trade...)
    if (await handleTcgMessage(message, { findMemberByName, askDisambiguation })) return;

// Commandes Battle Pass (!bp, !pass)
    if (await handleBattlePassMessage(message, { findMemberByName, askDisambiguation })) return;

    // Commandes YouTube (!youtube, !last, !stats)
    if (await handleYoutubeMessage(message, response)) return;

    // !animal
    if (await handleAnimalMessage(message, response, client, { findMemberByName, askDisambiguation })) return;

    // Commandes Bienvenue (!welcome, !bienvenue)
    if (await handleWelcomeMessage(message, response)) return;

    // Commandes Suggestions (!suggestion, !suggest, !sugg)
    if (await handleSuggestionMessage(message, response)) return;

    // Commandes sociales (!lovecalc, !topchef, !flip, !blague, !question, !sylvain, !bougetoi)
    if (await handleSocialMessage(message, response, client, { findMemberByName, askDisambiguation })) return;

    if (await handleInteractionMessage(message, response, client, { findMemberByName, askDisambiguation })) return;

    // Commandes Motus (!motus, !motustats)
    if (await handleMotusMessage(message, response, client, { findMemberByName })) return;

    // Commandes Rébus (!rebus, !rebusstats)
    if (await handleRebusMessage(message, response, client, { findMemberByName })) return;

    // Commandes Quotes (!quote, !citation)
    if (await handleQuotesMessage(message, response)) return;

    // Commandes Anniversaire (!anniversaire, !anniversairetest)
    if (await handleAnniversaireMessage(message, response)) return;

    // Commandes Activité (!profil, !avatar, !actif, !top, !setmessages)
    if (await handleActivityMessage(message, response)) return;

    // hé petit (Silencieux)
    if (response?.needsHePetit) {
        await message.reply({ files: ['./monty.gif'], flags: [MessageFlags.SuppressNotifications], allowedMentions: { repliedUser: false } });
        await message.channel.send({ files: ['./' + 'hé petit.mp3'], flags: [MessageFlags.SuppressNotifications] });
        return;
    }

    // jtm cacabot (Silencieux)
    if (response?.needsJtm) {
        const auteurNom = message.member?.displayName ?? message.author.username;
        return message.reply({ content: `Moi aussi jtm **${auteurNom}** ❤️`, flags: [MessageFlags.SuppressNotifications], allowedMentions: { repliedUser: false } });
    }

    // !horoscope
    if (response?.needsHoroscope) {
        await executeHoroscope(message, client, response);
        return;
    }

    // !save
    if (response?.needsSave) {
        if (message.author.id !== '436218312574107658') return;

        try {
            await saveAll();

            return message.reply(
                '💾 Sauvegarde forcée effectuée avec succès !'
            );
        } catch (err) {
            console.error(
                '❌ Échec de la sauvegarde forcée :',
                err
            );

            return message.reply(
                '❌ Impossible de sauvegarder les données actuellement. ' +
                'Vérifie le salon de sauvegarde Discord et les logs de Cacabot.'
            ).catch(() => {});
        }
    }

    // !helpx
    if (await handleHelpMessage(message, response)) return;

    // Commandes Utilitaires (!pomodoro, !rappel, !prune, !ping, !meteo, !botinfo, !serveur, !say, !edit, !aternos)
    if (await handleToolsMessage(message, response, client)) return;

    // !lastsave
    if (response?.needsLastsave) {
        if (message.author.id !== '436218312574107658') return;
        if (!lastsaveSaveTime) return message.reply('Aucune sauvegarde effectu\u00e9e depuis le d\u00e9marrage.');
        const diff = Date.now() - lastsaveSaveTime;
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        const dateStr = lastsaveSaveTime.toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
        return message.reply(`\ud83d\udcbe Derni\u00e8re sauvegarde : **${dateStr}** (il y a ${mins}min ${secs}s)`);
    }

    // !embed (Epsys-only)
    if (await handleEmbedMessage(message, response, client)) return;

    // !question est pris en charge par handleSocialMessage

    // Réponse texte simple (100% silencieuse)
    if (response && typeof response === "object" && response.files) {
        return message.reply({ 
            files: response.files,
            flags: [MessageFlags.SuppressNotifications],
            allowedMentions: { repliedUser: false }
        });
    }

    if (typeof response === "string") {
        if (response.trim().length === 0) return;

        // Répliques réflexes (feur, stiti, bril, etc.) : 1 fois sur 3 seulement
        const estUrl = /^https?:\/\//i.test(response.trim());
        if (!isExplicitCommand && !estUrl && Math.random() >= 1 / 3) return;

        const finAntiFeur = rouletteAntiFeurUntil.get(message.author.id);

        // Le bouclier Anti-Feur ne s'active que sur les répliques réflexes (quoi, qui, oui, non...), jamais sur les commandes avec !
        if (!isExplicitCommand && finAntiFeur && Date.now() < finAntiFeur) {
            const d = (rouletteAntiFeurDodges.get(message.author.id) || 0) + 1;
            rouletteAntiFeurDodges.set(message.author.id, d);
            if (d >= 5) deverrouillerSucces(message.author.id, 'tete-dure', message.channel);
            return message.react('🛡️').catch(() => {});
        }
        const autoReplyMsg = await message.reply({ 
            content: response,
            flags: [MessageFlags.SuppressNotifications],
            allowedMentions: { repliedUser: false }
        });
        if (pendingCheh.has(message.channel.id)) clearTimeout(pendingCheh.get(message.channel.id).timeout);
        const chehTimeout = setTimeout(() => { pendingCheh.delete(message.channel.id); }, 10000);
        pendingCheh.set(message.channel.id, { timeout: chehTimeout, replyMsg: autoReplyMsg });
        return;
    }
});



    // =========================
    //     DIAGNOSTICS SPÉCIALISÉS
    // =========================

function lireNombreCartesDiagnostic() {
    try {
        if (typeof getTcgCardsCount !== 'function') return 'Indisponible';

        const total = getTcgCardsCount();
        return Number.isFinite(total) ? total : 'Indisponible';
    } catch (error) {
        console.error('[DIAG TCG] Lecture du catalogue impossible :', error);
        return 'Indisponible';
    }
}

const DIAG_OWNER_ID = '436218312574107658';
const DIAG_REDEPLOY_PREFIX = 'diag_redeploy:';

function construireBoutonsRedeploiement() {
    return [new ActionRowBuilder().addComponents(
        ...[
            ['minijeux', 'Mini-jeux', '🎮'],
            ['roulette', 'Roulette', '🎰'],
            ['tcg', 'RegaDex', '🃏']
        ].map(([type, label, emoji]) =>
            new ButtonBuilder()
                .setCustomId(DIAG_REDEPLOY_PREFIX + type)
                .setLabel(label)
                .setEmoji(emoji)
                .setStyle(ButtonStyle.Secondary)
        )
    )];
}

async function retirerAnciensBoutonsRedeploiement(salon, nouveauMessageId) {
    // Limité aux 100 derniers messages, sans suppression ni édition
    // d'autres contenus que les composants de nos annonces.
    try {
        const recents = await salon.messages.fetch({ limit: 100 });
        for (const msg of recents.values()) {
            if (
                msg.id === nouveauMessageId ||
                msg.author?.id !== salon.client.user?.id ||
                !msg.content?.includes('Mise à jour faite, je suis de retour !') ||
                !msg.components?.some(row =>
                    row.components?.some(component =>
                        component.customId?.startsWith(DIAG_REDEPLOY_PREFIX)
                    )
                )
            ) continue;
            await msg.edit({ components: [] }).catch(error =>
                console.warn('[DIAG] Retrait des anciens boutons impossible :', error)
            );
        }
    } catch (error) {
        console.warn('[DIAG] Recherche des anciennes annonces impossible :', error);
    }
}

function construireDiagnosticSpecialise(type, ownerId) {
    const diagnostics = {
        minijeux: {
            titre: '🎮 Diagnostic des mini-jeux',
            controles: [
                ['Module Motus', typeof handleMotusMessage === 'function'],
                ['Module Rébus', typeof handleRebusMessage === 'function'],
                ['Module Pendu', typeof handlePenduMessage === 'function'],
                ['Restauration Rébus', typeof restaurerSessionRebus === 'function'],
                ['État Rébus', typeof isRebusSessionActive === 'function']
            ],
            informations: [
                `Rébus actif : **${isRebusSessionActive() ? 'Oui' : 'Non'}**`,
                `Session Rébus sauvegardée : **${rebusSessionData?.active ? 'Active' : 'Inactive'}**`,
                `Rébus en pause : **${rebusSessionData?.enPause ? 'Oui' : 'Non'}**`,
                `Transition Rébus : **${rebusSessionData?.transition || 'Aucune'}**`,
                `Manche Rébus : **${rebusSessionData?.manche || 0}/5**`,
                `Échéance Rébus : **${rebusSessionData?.limite16hTimestamp ? `<t:${Math.floor(rebusSessionData.limite16hTimestamp / 1000)}:F>` : 'Aucune'}**`,
                `Motus : **${!motusData?.mot ? 'Aucune partie chargée' : motusData.termine ? 'Terminé' : motusData.expireAt > Date.now() ? 'En cours' : 'Expiré'}**`,
                `Pendu : **${!penduData?.mot ? 'Aucune partie chargée' : penduData.termine ? 'Terminé' : penduData.expireAt > Date.now() ? 'En cours' : 'Expiré'}**`
            ]
        },
        roulette: {
            titre: '🎰 Diagnostic Roulette',
            controles: [
                ['Module Roulette', typeof handleRouletteMessage === 'function'],
                ['Boutons Roulette', typeof handleRouletteButton === 'function'],
                ['Restauration notifications', typeof restaurerNotifsRoulette === 'function'],
                ['États persistants', typeof ROULETTE_ETATS === 'object' && ROULETTE_ETATS !== null]
            ],
            informations: [
                `Salon Roulette : <#1553954760900608091>`,
                `Sauvegarde chargée : **${donneesChargees ? 'Oui' : 'Non'}**`,
                `Latence Discord : **${client.ws.ping} ms**`
            ]
        },
        tcg: {
            titre: '🃏 Diagnostic RegaDex',
            controles: [
                ['Module TCG', typeof handleTcgMessage === 'function'],
                ['Interactions TCG', typeof handleTcgInteraction === 'function'],
                ['Catalogue chargé', typeof getTcgCardsCount === 'function' && lireNombreCartesDiagnostic() >= 109],
                ['Sauvegarde utilisateurs', !!tcgData?.users],
                ['Sauvegarde échanges', !!tcgData?.activeTrades]
            ],
            informations: [
                `Cartes cataloguées : **${lireNombreCartesDiagnostic()}**`,
                `Profils enregistrés : **${Object.keys(tcgData?.users || {}).length}**`,
                `Sauvegarde chargée : **${donneesChargees ? 'Oui' : 'Non'}**`
            ]
        }
    };

    const diag = diagnostics[type] || diagnostics.minijeux;
    const controlesOk = diag.controles.filter(([, ok]) => ok).length;

    const complet = controlesOk === diag.controles.length;
    const embed = new EmbedBuilder()
        .setColor(complet ? 0x2ecc71 : 0xe67e22)
        .setTitle(diag.titre)
        .setDescription(
            `${complet ? '🟢 **Tous les contrôles sont validés**' : '🟠 **Attention : certains contrôles ont échoué**'}\n` +
            `**${controlesOk} / ${diag.controles.length} vérifications réussies**`
        )
        .addFields(
            {
                name: '🛡️ Vérifications des modules',
                value: diag.controles.map(([nom, ok]) =>
                    `${ok ? '🟢' : '🔴'} **${nom}** — ${ok ? 'Disponible' : 'À vérifier'}`
                ).join('\n'),
                inline: false
            },
            {
                name: '📊 État actuel',
                value: diag.informations.join('\n'),
                inline: false
            },
            {
                name: 'ℹ️ Lecture du diagnostic',
                value: '🟢 Disponible = module chargé. 🔴 À vérifier = contrôle non validé. ' +
                    'Cela ne remplace pas un test fonctionnel en conditions réelles.',
                inline: false
            }
        )
        .setFooter({ text: `Cacabot ${getVersionString()} • Diagnostic ${type} • Actualisé` })
        .setTimestamp();

    const navigation = new ActionRowBuilder().addComponents(
        ...[
            ['minijeux', 'Mini-jeux', '🎮'],
            ['roulette', 'Roulette', '🎰'],
            ['tcg', 'RegaDex', '🃏']
        ].map(([id, label, emoji]) =>
            new ButtonBuilder()
                .setCustomId(`diag_special:${ownerId}:${id}`)
                .setLabel(label)
                .setEmoji(emoji)
                .setStyle(id === type ? ButtonStyle.Primary : ButtonStyle.Secondary)
                .setDisabled(id === type)
        )
    );

    const fermeture = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`diag_special:${ownerId}:fermer`)
            .setLabel('Fermer')
            .setEmoji('🔒')
            .setStyle(ButtonStyle.Danger)
    );

    return {
        embeds: [embed],
        components: [navigation, fermeture],
        allowedMentions: { parse: [] }
    };
}

    // =========================
    //     LISTENER INTERACTIONS
    // =========================

client.on('interactionCreate', async (interaction) => {
try {
    if (!donneesChargees) {
        if (interaction.isRepliable()) {
            await interaction.reply({
                content: '⏳ Cacabot charge ses données. Réessaie dans quelques instants.',
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
        }
        return;
    }

    // Boutons des annonces de redéploiement : diagnostic privé,
    // sans modifier le message public.
    if (
        interaction.isButton() &&
        interaction.customId.startsWith(DIAG_REDEPLOY_PREFIX)
    ) {
        if (interaction.user.id !== DIAG_OWNER_ID) {
            await interaction.reply({
                content: '⛔ Diagnostic réservé à Epsys.',
                flags: MessageFlags.Ephemeral
            });
            return;
        }
        const type = interaction.customId.slice(DIAG_REDEPLOY_PREFIX.length);
        if (['minijeux', 'roulette', 'tcg'].includes(type)) {
            await interaction.reply({
                ...construireDiagnosticSpecialise(type, interaction.user.id),
                flags: MessageFlags.Ephemeral
            });
        }
        return;
    }

    // =========================
    //   BOUTONS DIAGNOSTICS (EPSYS)
    // =========================
    if (
        interaction.isButton() &&
        interaction.customId.startsWith('diag_special:')
    ) {
        const [, ownerId, action] = interaction.customId.split(':');

        if (
            interaction.user.id !== ownerId ||
            interaction.user.id !== '436218312574107658'
        ) {
            await interaction.reply({
                content: '⛔ Ce diagnostic est réservé à Epsys.',
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        if (action === 'fermer') {
            await interaction.update({
                components: [],
                embeds: interaction.message.embeds,
                content: null
            });
            return;
        }

        if (['minijeux', 'roulette', 'tcg'].includes(action)) {
            await interaction.update(
                construireDiagnosticSpecialise(action, ownerId)
            );
            return;
        }
    }

    // =========================
    //   COMMANDES SLASH (/)
    // =========================
    if (interaction.isChatInputCommand()) {
        if (interaction.guildId !== '720057528351850547') {
            return interaction.reply({ content: "Les commandes slash de Cacabot sont exclusivement réservées au serveur Regaïa !", flags: 64 });
        }

        const aliasMap = {
            rlt: 'roulette',
            roulettestats: 'rltstats',
            roulettestate: 'rltstate',
            roulettesucces: 'rltsucces',
            roulettetop: 'rlttop',
            bisou: 'kiss',
            calin: 'hug',
            court: 'run',
            dance: 'danse',
            frappe: 'punch',
            tir: 'bang',
            pan: 'bang',
            pleure: 'cry',
            explose: 'explode',
            citation: 'quote',
            decodeur: 'rebus',
            rebusstat: 'rebusstats',
            motustat: 'motustats',
            about: 'botinfo',
            montage: 'bougetoi',
            video: 'bougetoi',
            lavideo: 'bougetoi',
            sugg: 'suggestion',
            profile: 'profil'
        };

        const commandName = aliasMap[interaction.commandName] || interaction.commandName;

        // Commandes Motus
        if (commandName === 'motus' || commandName === 'motustats' || commandName === 'motustop') {
            return await handleMotusSlash(interaction);
        }

        // Commandes Rébus Regaïen
        if (commandName === 'rebus' || commandName === 'decodeur' || commandName === 'rebusstats' || commandName === 'rebustop') {
            return await handleRebusSlash(interaction);
        }

        // Commandes Pendu Quotidien
        if (commandName === 'pendu' || commandName === 'pendustats' || commandName === 'pendutop') {
            return await handlePenduSlash(interaction);
        }

        // Commande Quote (/quote, /citation)
        if (await handleQuotesSlash(interaction)) return;

        // Commandes sociales
        if (['lovecalc', 'flip', 'blague', 'topchef', 'choix', 'question', 'sylvain', 'epsys', 'bougetoi'].includes(commandName)) {
            return await handleSocialSlash(interaction);
        }

        // Commandes Utilitaires Slash (/ping, /prune, /serveur, /meteo, /pomodoro, /rappel, /botinfo, /aternos)
        if (await handleToolsSlash(interaction, client)) return;

        // Commande Rlttop
        if (await handleRouletteSlash(interaction, client)) return;

        if (commandName === 'help') {
            return await handleHelpInteraction(interaction);
        }

        if (await handleTcgSlash(interaction)) return;

        if (await handleBattlePassSlash(interaction)) return;

        // Commandes Activité (/profil, /top)
        if (await handleActivitySlash(interaction)) return;

        // Commandes d'interactions (/kiss, /hug, /punch, /bang, /rizz, /danse, /rire, /cry, /run, /die, /explode, /bait, /ban, /jailaref, /palaref)
        if (await handleInteractionSlash(interaction, client)) return;

        // =========================
        // LOT 2 : JEUX & DESTIN
        // =========================

        if (await handleDestinSlash(interaction)) return;

        if (commandName === 'horoscope') {
            return interaction.reply({ embeds: [buildHoroscopeEmbed()] });
        }

        if (await handleAnimalSlash(interaction, client)) return;

        // flip et blague sont pris en charge par handleSocialSlash

        // epsys, bougetoi et sylvain sont pris en charge par handleSocialSlash

        if (commandName === 'rltstate') {
            const cibleUser = interaction.options.getUser('membre') ?? interaction.user;
            const member = interaction.guild?.members.cache.get(cibleUser.id) ?? interaction.member;
            return interaction.reply({ embeds: [buildRouletteStateEmbed(member, interaction.guildId)] });
        }

        // =========================
        // LOT 3 : SALONS & VIE DU SERVEUR
        // =========================

        // topchef, question et choix sont pris en charge par handleSocialSlash

        if (await handleWelcomeSlash(interaction)) return;

        if (await handleSuggestionSlash(interaction)) return;

    if (await handleAnniversaireSlash(interaction)) return;

        if (await handleYoutubeSlash(interaction)) return;

        if (await handleEmbedSlash(interaction, client)) return;
    }

    // =========================
    //   MENUS CONTEXTUELS (Clic droit -> Applications)
    // =========================
    if (interaction.isMessageContextMenuCommand()) {
        if (interaction.guildId !== '720057528351850547') {
            return interaction.reply({ content: "Les commandes de Cacabot sont exclusivement réservées au serveur Regaïa !", flags: 64 });
        }
        if (await handleToolsInteraction(interaction, client)) return;
        return;
    }

    if (interaction.isUserContextMenuCommand()) {
        if (await handleTcgInteraction(interaction)) return;
        return;
    }

    // Interactions RegaDex TCG (boutons, menus, modals)
    if (await handleTcgInteraction(interaction)) return;

    // Bouton pour tirer une autre citation au hasard
    if (await handleQuotesButton(interaction)) return;

    if (await handleMotusButton(interaction)) return;

    if (await handleRebusButton(interaction)) return;

    if (await handlePenduButton(interaction)) return;

    // Interactions Panneau Bienvenue
    if (await handleWelcomeInteraction(interaction)) return;

    // (Brouillons d'embeds gérés directement dans embeds.js)

    // Boutons de Sécurité & Rôles
    if (await handleRolembedInteraction(interaction)) return;
    if (await handleSecurityInteraction(interaction)) return;

    // =========================
    //     BOUTONS YOUTUBE
    // =========================
    if (await handleYoutubeButton(interaction)) return;

    if (await handleInteractionButton(interaction)) return;

    // Boutons Activité (actif jour/semaine/mois & pagination top)
    if (await handleActivityButton(interaction)) return;

    // =========================
    // BOUTONS ANNIVERSAIRE LIST
    // =========================
    if (await handleAnniversaireButton(interaction)) return;

    // Boutons du Battle Pass
    if (await handleBattlePassInteraction(interaction)) return;

    // Menus et boutons de !help et !helpx
    if (await handleHelpInteraction(interaction)) return;

    // Boutons et menus sociaux (flip, sylvain, blagues, questions)
    if (await handleSocialInteraction(interaction)) return;

    // sylvain_again est géré par handleSocialInteraction

    // =========================
    // BOUTONS ROULETTE
    // =========================
    if (await handleRouletteButton(interaction, client)) return;

    // =========================
    // INTERACTIONS EMBEDS (EPSYS)
    // =========================
    if (await handleEmbedInteraction(interaction, client)) return;

    // =========================
    // INTERACTIONS TOOLS
    // =========================
    if (await handleToolsInteraction(interaction, client)) return;

    // Boutons de vote Suggestions
    if (await handleSuggestionButton(interaction)) return;

    // blagues et questions sont gérées par handleSocialInteraction

    // question_new_ est géré par handleSocialInteraction
} catch (err) {
    if (err?.code === 10062 || err?.message?.includes('Unknown interaction') || err?.message?.includes('expired')) {
        return; // Interaction expirée sur Discord, ignorer silencieusement
    }
    console.error('Erreur interactionCreate:', err);
    try {
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: "Une erreur est survenue lors de l'exécution.", flags: 64 }).catch(() => {});
        } else if (interaction.deferred) {
            await interaction.followUp({ content: "Une erreur est survenue lors de l'exécution.", flags: 64 }).catch(() => {});
        }
    } catch (replyError) { console.warn('[INDEX] Notification d’erreur impossible :', replyError); }
}
});

// =========================
//         CONNEXION
// =========================

client.on('channelCreate', async (channel) => {
    if (channel.type === ChannelType.GuildText) {
        await assurerWebhookRoulette(channel).catch(err => {
            console.error('[INDEX] Création du webhook roulette échouée :', err);
        });
    }
});

client.once('clientReady', async () => {
    console.log(`✅ ${client.user.tag} est connecté`);
    void flushDiscordErrorReports();

    // Enregistrement des commandes Slash (/)
    const slashCommands = [
        // Général & Aide
        new SlashCommandBuilder().setName('help').setDescription('Ouvre le guide d\'utilisation officiel de Cacabot'),
        new SlashCommandBuilder().setName('pass').setDescription('Ouvre le Battle Pass de la saison (quêtes, niveaux, échelle)'),
        new SlashCommandBuilder().setName('bp').setDescription('Ouvre le Battle Pass de la saison (raccourci)'),

        // Roulette & Raccourcis
        new SlashCommandBuilder()
            .setName('roulette')
            .setDescription('🎰 Roulette Regaïenne (jeu, inventaire, stats, état, classement)')
            .addStringOption(option =>
                option.setName('action')
                    .setDescription('Action à effectuer')
                    .setRequired(false)
                    .addChoices(
                        { name: '🎲 go — Lancer le tirage', value: 'go' },
                        { name: '🎁 claim — Inventaire de récompenses', value: 'claim' },
                        { name: '📊 state — Effets et malus actifs', value: 'state' },
                        { name: '📈 stats — Statistiques de tirage', value: 'stats' },
                        { name: '🎖️ succes — Succès débloqués', value: 'succes' },
                        { name: '🏆 top — Panthéon des succès', value: 'top' },
                        { name: '🎲 probas — Table des probabilités', value: 'probas' },
                        { name: '📖 help — Guide complet de la Roulette', value: 'help' }
                    )
            ),

        // Motus & Rébus Regaïen & Pendu
        new SlashCommandBuilder().setName('motus').setDescription('Statut du Motus du jour (10h et 19h) et compte à rebours'),
        new SlashCommandBuilder().setName('motustats').setDescription('Consulter les victoires et parties au Motus')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à inspecter')),
        new SlashCommandBuilder().setName('motustop').setDescription('Classement général du Motus'),
        new SlashCommandBuilder().setName('rebus').setDescription('Statut du Rébus Regaïen du jour (15h00) et compte à rebours'),
        new SlashCommandBuilder().setName('decodeur').setDescription('Statut du Rébus Regaïen (raccourci)'),
        new SlashCommandBuilder().setName('rebusstats').setDescription('Consulter les victoires et points au Rébus Regaïen')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à inspecter')),
        new SlashCommandBuilder().setName('rebustop').setDescription('Classement général du Rébus Regaïen'),
        new SlashCommandBuilder().setName('pendu').setDescription('Statut du Pendu Quotidien (21h00) et mot en cours'),
        new SlashCommandBuilder().setName('pendustats').setDescription('Consulter les statistiques du Pendu')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à inspecter')),
        new SlashCommandBuilder().setName('pendutop').setDescription('Classement hebdomadaire des mini-jeux et Top 10 global'),

        // Citations & Profils
        new SlashCommandBuilder().setName('quote').setDescription('Afficher une citation culte du serveur')
            .addStringOption(opt => opt.setName('recherche').setDescription('Numéro, mot-clé ou membre')),
        new SlashCommandBuilder().setName('citation').setDescription('Afficher une citation culte (raccourci)')
            .addStringOption(opt => opt.setName('recherche').setDescription('Numéro, mot-clé ou membre')),
        new SlashCommandBuilder().setName('profil').setDescription('Fiche détaillée d\'un·e membre (messages, badges, etc.)')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à inspecter')),
        new SlashCommandBuilder().setName('profile').setDescription('Fiche détaillée d\'un·e membre (raccourci)')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à inspecter')),
        new SlashCommandBuilder().setName('avatar').setDescription('Affiche l\'avatar d\'un·e membre en grand format')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à inspecter')),
        new SlashCommandBuilder().setName('top').setDescription('Classement général des membres les plus actifs'),
        new SlashCommandBuilder().setName('actif').setDescription('Podium des membres les plus actifs (Jour, Semaine, Mois)'),

        // Jeux & Social
        new SlashCommandBuilder().setName('lovecalc').setDescription('Calculer la compatibilité amoureuse entre deux membres')
            .addUserOption(opt => opt.setName('membre1').setDescription('Premier membre').setRequired(true))
            .addUserOption(opt => opt.setName('membre2').setDescription('Deuxième membre (facultatif, par défaut toi-même)').setRequired(false)),
        new SlashCommandBuilder().setName('flip').setDescription('Lancer une pièce à pile ou face (solo ou duel)'),
        new SlashCommandBuilder().setName('destin').setDescription('Prédit votre destin cosmique'),
        new SlashCommandBuilder().setName('horoscope').setDescription('L\'oracle cosmique du jour'),
        new SlashCommandBuilder().setName('animal').setDescription('Devine ton animal spirituel')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à analyser')),
        new SlashCommandBuilder().setName('blague').setDescription('Raconte une blague aléatoire')
            .addStringOption(opt => opt.setName('type').setDescription('Catégorie').addChoices(
                { name: 'Humour soft', value: 'soft' },
                { name: 'Humour classique', value: 'classique' },
                { name: 'Humour noir', value: 'noir' }
            )),
        new SlashCommandBuilder().setName('topchef').setDescription('Critique et note gastronomique d\'un plat')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à noter')),
        new SlashCommandBuilder().setName('epsys').setDescription('Envoie un GIF aléatoire d\'Epsys'),
        new SlashCommandBuilder().setName('bougetoi').setDescription('Rappelle (vigoureusement) à Epsys d\'aller monter sa vidéo'),
        new SlashCommandBuilder().setName('sylvain').setDescription('Singe fort ensemble (Sylvain Lévy)'),
        new SlashCommandBuilder().setName('question').setDescription('Question de débat du soir'),
        new SlashCommandBuilder().setName('choix').setDescription('Laisse Cacabot trancher un dilemme')
            .addStringOption(opt => opt.setName('question').setDescription('Ex : pizza ou burger ?').setRequired(true)),
        new SlashCommandBuilder().setName('welcome').setDescription("Configurer ou tester l'accueil (Epsys-only)")
            .addSubcommand(sub => sub.setName('config').setDescription('Ouvrir le panneau de configuration'))
            .addSubcommand(sub => sub.setName('test').setDescription("Tester l'affiche avec ta photo ou un membre")
                .addUserOption(opt => opt.setName('membre').setDescription('Membre à tester (facultatif)'))),
        new SlashCommandBuilder().setName('suggestion').setDescription('Proposer une idée pour le serveur')
            .addStringOption(opt => opt.setName('proposition').setDescription('Ton idée').setRequired(true)),
        new SlashCommandBuilder().setName('sugg').setDescription('Proposer une idée pour le serveur (raccourci)')
            .addStringOption(opt => opt.setName('proposition').setDescription('Ton idée').setRequired(true)),

        // Interactions (et leurs raccourcis français)
        new SlashCommandBuilder().setName('kiss').setDescription('Embrasser un·e membre')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à embrasser').setRequired(true)),
        new SlashCommandBuilder().setName('bisou').setDescription('Embrasser un·e membre (raccourci)')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à embrasser').setRequired(true)),
        new SlashCommandBuilder().setName('hug').setDescription('Faire un câlin à un·e membre')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à câliner').setRequired(true)),
        new SlashCommandBuilder().setName('calin').setDescription('Faire un câlin à un·e membre (raccourci)')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à câliner').setRequired(true)),
        new SlashCommandBuilder().setName('rizz').setDescription('Tenter de séduire un·e membre')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à rizz').setRequired(true)),
        new SlashCommandBuilder().setName('punch').setDescription('Frapper un·e membre')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à frapper').setRequired(true)),
        new SlashCommandBuilder().setName('frappe').setDescription('Frapper un·e membre (raccourci)')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à frapper').setRequired(true)),
        new SlashCommandBuilder().setName('bang').setDescription('Tirer sur un·e membre')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à viser').setRequired(true)),
        new SlashCommandBuilder().setName('tir').setDescription('Tirer sur un·e membre (raccourci)')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à viser').setRequired(true)),
        new SlashCommandBuilder().setName('insult').setDescription('Insulter gratuitement un·e membre')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à insulter').setRequired(true)),
        new SlashCommandBuilder().setName('bait').setDescription('Ragebait un·e membre')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à bait').setRequired(true)),
        new SlashCommandBuilder().setName('ban').setDescription('Faussement bannir un·e membre')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à bannir').setRequired(true)),
        new SlashCommandBuilder().setName('danse').setDescription('S\'ambiancer sur le dancefloor')
            .addUserOption(opt => opt.setName('membre').setDescription('Avec qui danser')),
        new SlashCommandBuilder().setName('dance').setDescription('S\'ambiancer sur le dancefloor (raccourci)')
            .addUserOption(opt => opt.setName('membre').setDescription('Avec qui danser')),
        new SlashCommandBuilder().setName('rire').setDescription('Se taper une barre de rire')
            .addUserOption(opt => opt.setName('membre').setDescription('De qui rire')),
        new SlashCommandBuilder().setName('cry').setDescription('Pleurer en solo ou à cause de quelqu\'un')
            .addUserOption(opt => opt.setName('membre').setDescription('Qui te fait pleurer')),
        new SlashCommandBuilder().setName('pleure').setDescription('Pleurer en solo ou à cause de quelqu\'un (raccourci)')
            .addUserOption(opt => opt.setName('membre').setDescription('Qui te fait pleurer')),
        new SlashCommandBuilder().setName('run').setDescription('Prendre la fuite')
            .addUserOption(opt => opt.setName('membre').setDescription('Qui fuir')),
        new SlashCommandBuilder().setName('court').setDescription('Prendre la fuite (raccourci)')
            .addUserOption(opt => opt.setName('membre').setDescription('Qui fuir')),
        new SlashCommandBuilder().setName('spin').setDescription('Tourner sur soi-même ou avec quelqu’un')
            .addUserOption(opt => opt.setName('membre').setDescription('Avec qui tourner')),
        new SlashCommandBuilder().setName('explode').setDescription('Exploser sans aucune raison'),
        new SlashCommandBuilder().setName('explose').setDescription('Exploser sans aucune raison (raccourci)'),
        new SlashCommandBuilder().setName('die').setDescription('Mourir dans d\'atroces souffrances')
            .addUserOption(opt => opt.setName('membre').setDescription('Qui cause ta mort')),
        new SlashCommandBuilder().setName('jailaref').setDescription('Affirmer fièrement que tu as la référence')
            .addUserOption(opt => opt.setName('membre').setDescription('De qui')),
        new SlashCommandBuilder().setName('palaref').setDescription('Assumer que tu n\'as rien compris')
            .addUserOption(opt => opt.setName('membre').setDescription('De qui')),

        // Anniversaires
        new SlashCommandBuilder().setName('anniversaire').setDescription('Gestion des anniversaires du serveur')
            .addSubcommand(sub => sub.setName('show').setDescription('Affiche un anniversaire et le compte à rebours')
                .addUserOption(opt => opt.setName('membre').setDescription('Le membre')))
            .addSubcommand(sub => sub.setName('set').setDescription('Enregistre un anniversaire (format JJ/MM)')
                .addStringOption(opt => opt.setName('date').setDescription('Format JJ/MM (ex : 24/07)').setRequired(true))
                .addUserOption(opt => opt.setName('membre').setDescription('Attribuer à')))
            .addSubcommand(sub => sub.setName('list').setDescription('Liste complète des anniversaires'))
            .addSubcommand(sub => sub.setName('next').setDescription('Prochain anniversaire à fêter'))
            .addSubcommand(sub => sub.setName('remove').setDescription('Supprimer un anniversaire')
                .addUserOption(opt => opt.setName('membre').setDescription('Le membre'))),

        // Utilitaires & YouTube
        new SlashCommandBuilder().setName('serveur').setDescription('Informations complètes sur le serveur Regaïa'),
        new SlashCommandBuilder().setName('meteo').setDescription('Météo en direct d\'une ville')
            .addStringOption(opt => opt.setName('ville').setDescription('La ville').setRequired(true)),
        new SlashCommandBuilder().setName('pomodoro').setDescription('Session de travail Pomodoro')
            .addSubcommand(sub => sub.setName('lancer').setDescription('Démarrer un Pomodoro'))
            .addSubcommand(sub => sub.setName('stop').setDescription('Arrêter le Pomodoro')),
        new SlashCommandBuilder().setName('rappel').setDescription('Gérer tes rappels')
            .addSubcommand(sub => sub.setName('ajouter').setDescription('Programmer un rappel')
                .addStringOption(opt => opt.setName('temps').setDescription('Ex : 10min, 1h').setRequired(true))
                .addStringOption(opt => opt.setName('message').setDescription('Texte du rappel').setRequired(true)))
            .addSubcommand(sub => sub.setName('list').setDescription('Voir tes rappels en attente'))
            .addSubcommand(sub => sub.setName('remove').setDescription('Supprimer un rappel')
                .addStringOption(opt => opt.setName('nom').setDescription('Nom du rappel').setRequired(true))),
        new SlashCommandBuilder().setName('aternos').setDescription('IP du serveur Minecraft'),
        new SlashCommandBuilder().setName('youtube').setDescription('Rechercher une vidéo sur YouTube')
            .addStringOption(opt => opt.setName('recherche').setDescription('Titre ou mot-clé').setRequired(true)),
        new SlashCommandBuilder().setName('last').setDescription('Dernière vidéo publiée d\'une chaîne')
            .addStringOption(opt => opt.setName('chaine').setDescription('Nom de la chaîne').setRequired(true)),
        new SlashCommandBuilder().setName('stats').setDescription('Statistiques d\'une chaîne YouTube')
            .addStringOption(opt => opt.setName('chaine').setDescription('Nom de la chaîne').setRequired(true)),
        new SlashCommandBuilder().setName('botinfo').setDescription('Infos techniques et version de Cacabot'),
        new SlashCommandBuilder().setName('about').setDescription('Infos techniques (raccourci)'),
        new SlashCommandBuilder().setName('ping').setDescription('Latence du bot et WebSocket'),
        new SlashCommandBuilder().setName('prune').setDescription('Supprimer les derniers messages')
            .addIntegerOption(opt => opt.setName('nombre').setDescription('Nombre de messages à supprimer').setRequired(true)),
        new SlashCommandBuilder().setName('embed').setDescription('Créateur ou modificateur d\'embed (Epsys-only)')
            .addStringOption(opt => opt.setName('modifier').setDescription('ID du message contenant l\'embed à modifier')),
        new SlashCommandBuilder().setName('up').setDescription('Remonter une suggestion ou un vote de roulette en bas du salon (Modos)')
            .addStringOption(opt => opt.setName('message').setDescription('ID ou lien du message de Cacabot à remonter').setRequired(true)),
        new SlashCommandBuilder()
            .setName('regadex')
            .setDescription('🃏 RegaDex TCG — Boosters, classeur, Store, flex & échanges')
            .addSubcommand(sub => sub.setName('hub').setDescription('Ouvrir le menu principal RegaDex'))
            .addSubcommand(sub => sub.setName('open').setDescription('Voir et ouvrir tes boosters Set 1 - Vestiges Regaïens disponibles'))
            .addSubcommand(sub => sub.setName('booster').setDescription('Alias de open — Ouvrir tes boosters disponibles'))
            .addSubcommand(sub => sub.setName('go').setDescription('Alias de open — Ouvrir tes boosters disponibles'))
            .addSubcommand(sub => sub.setName('store').setDescription('Ouvrir le RegaDex Store'))
            .addSubcommand(sub => sub.setName('claim').setDescription('Consulter et utiliser ton inventaire RegaDex'))
            .addSubcommand(sub => sub.setName('profil').setDescription('Voir ton profil RegaDex, tes paliers & ta wishlist'))
            .addSubcommand(sub => sub.setName('wishlist').setDescription('Gérer ta wishlist RegaDex (5 cartes max)')
                .addUserOption(opt => opt.setName('membre').setDescription('Voir la wishlist d\'un membre')))
            .addSubcommand(sub => sub.setName('classeur').setDescription('Afficher ton classeur Canvas (ou celui d\'un membre)')
                .addUserOption(opt => opt.setName('membre').setDescription('Membre à inspecter')))
            .addSubcommand(sub => sub.setName('carte').setDescription('Afficher une carte précise ou les explications')
                .addStringOption(opt => opt.setName('recherche').setDescription('Numéro (ex: 1-84, Ø1) ou nom de la carte')))
            .addSubcommand(sub => sub.setName('trade').setDescription('Proposer un échange de cartes (tous types d\'échanges autorisés)')
                .addUserOption(opt => opt.setName('membre').setDescription('Membre avec qui échanger')))
            .addSubcommand(sub => sub.setName('top').setDescription('Classements RegaDex (Total & Complétion Set 1 - Vestiges Regaïens)'))
            .addSubcommand(sub => sub.setName('flex').setDescription('Afficher ou modifier ta carte préférée (#regadex et #shitpost)')
                .addUserOption(opt => opt.setName('membre').setDescription('Voir la carte préférée d\'un membre'))
                .addStringOption(opt => opt.setName('modifier').setDescription('Définir ta nouvelle carte préférée (numéro ou nom)')))
            .addSubcommand(sub => sub.setName('notif').setDescription('Configurer la notification de booster gratuit')),
        new ContextMenuCommandBuilder()
            .setName('🆙 Remonter (up)')
            .setType(ApplicationCommandType.Message),
        new ContextMenuCommandBuilder()
            .setName('🔄 Échanger (RegaDex)')
            .setType(ApplicationCommandType.User)
    ].map(cmd => cmd.toJSON());

    // Priorité absolue : charger les données persistantes
    // avant les requêtes de déploiement des commandes Discord.
    // Une exception dans un écouteur async "ready" ne ferme PAS
    // automatiquement la connexion Discord. Refuser explicitement
    // tout fonctionnement sans données validées.
    try {
        await loadAll();
    } catch (error) {
        donneesChargees = false;
        console.error('🚨 ARRÊT DE SÉCURITÉ : restauration impossible.', error);
        process.exit(1);
        return;
    }

    // Retrouver d'abord une éventuelle publication Discord
    // effectuée avant la dernière confirmation de sauvegarde.
    // En cas d'échec, le journal reste présent et bloque
    // les nouveaux lancements, y compris forcés.
    await reconcilierPublicationPendu(client).catch(error => {
        console.error(
            '[PENDU] Réconciliation de publication impossible :',
            error
        );
    });

    // Reprendre une attribution Pendu interrompue seulement
    // après restauration des données Battle Pass et RegaDex.
    await reprendreRecompensesPendu().catch(error => {
        console.error(
            '[PENDU] Reprise des récompenses impossible :',
            error
        );
    });

    // Réessayer également sans redémarrer Cacabot lorsqu'une
    // attribution est restée en attente après une erreur réseau
    // ou un échec de sauvegarde.
    let repriseRecompensesPenduEnCours = false;
    const repriseRecompensesPenduInterval = setInterval(async () => {
        if (repriseRecompensesPenduEnCours) return;
        repriseRecompensesPenduEnCours = true;
        try {
            // La réconciliation doit précéder la reprise des gains.
            await reconcilierPublicationPendu(client);
            await reprendreRecompensesPendu();
        } catch (error) {
            console.error(
                '[PENDU] Nouvelle tentative de réconciliation ' +
                'ou de reprise échouée :',
                error
            );
        } finally {
            repriseRecompensesPenduEnCours = false;
        }
    }, 60 * 1000);

    repriseRecompensesPenduInterval.unref?.();

    const serveurRebus = client.guilds.cache.get('720057528351850547')
        || await client.guilds.fetch('720057528351850547').catch(() => null);

    if (serveurRebus) {
        await restaurerSessionRebus(serveurRebus).catch(error => {
            console.error('[RÉBUS] Échec de restauration :', error);
        });
    }

    // Supprime les avertissements de l'arrêt précédent
    // et annonce le retour uniquement dans les salons concernés.
    await restaurerAvertissementsRedemarrageMinijeux();

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    const REGAIA_GUILD_ID = '720057528351850547';

    for (const guild of client.guilds.cache.values()) {
        const body = guild.id === REGAIA_GUILD_ID ? slashCommands : [];

        try {
            await rest.put(
                Routes.applicationGuildCommands(client.user.id, guild.id),
                { body }
            );

            if (guild.id === REGAIA_GUILD_ID) {
                console.log(
                    `✅ Commandes Slash (/) déployées exclusivement sur ${guild.name}`
                );
            }
        } catch (err) {
            console.error(
                `Erreur déploiement Slash sur ${guild.name}:`,
                err.message
            );
        }
    }

    // Scan du Set 1 RegaDex + alerte intégrité si carte/asset manquant
    await scanSet1Cards(client);
    await backfillRecentOpeningsTcg(client);
    restaurerNotifsTcg(client);
    scheduleNonOverlappingCheck('inactivité des échanges TCG', () => verifierInactiviteTradesTcg(client), 10 * 60 * 1000);
    // Une vérification lente ne doit pas multiplier les appels Discord au tick suivant.
    let boosterHebdoEnCours = false;
    let queteCommunautaireEnCours = false;
    async function verifierBoosterHebdoSansChevauchement() {
        if (boosterHebdoEnCours) return;
        boosterHebdoEnCours = true;
        try {
            await verifierBoosterHebdoTcg(client);
        } catch (err) {
            console.error('[INDEX] Vérification booster hebdomadaire échouée :', err);
        } finally {
            boosterHebdoEnCours = false;
        }
    }
    async function verifierQueteCommunautaireSansChevauchement() {
        if (queteCommunautaireEnCours) return;
        queteCommunautaireEnCours = true;
        try {
            await verifierQueteCommunautaireTcg(client);
        } catch (err) {
            console.error('[INDEX] Vérification quête communautaire échouée :', err);
        } finally {
            queteCommunautaireEnCours = false;
        }
    }
    void verifierBoosterHebdoSansChevauchement();
    void verifierQueteCommunautaireSansChevauchement();
    setInterval(() => {
        void verifierBoosterHebdoSansChevauchement();
        void verifierQueteCommunautaireSansChevauchement();
    }, 60 * 1000);

    // Réarmement des alertes roulette, votes publics et des rappels
    restaurerNotifsRoulette(client);
    if (typeof restaurerVotesRoulette === 'function') restaurerVotesRoulette(client);
    if (typeof restaurerRappels === 'function') restaurerRappels();

    // Envoi immédiat du message de retour à la seconde où les commandes sont opérationnelles
    (async () => {
        try {
            const salonNotif = await client.channels.fetch('1480756332373213275').catch(() => null);
            if (salonNotif) {
                let nouveauCommitDetecte = false;
                if (process.env.GITHUB_TOKEN) {
                    const resCommits = await fetch('https://api.github.com/repos/R3GS/Cacabot/commits?per_page=1', {
                        headers: {
                            'Authorization': `token ${process.env.GITHUB_TOKEN}`,
                            'Accept': 'application/vnd.github.v3+json'
                        }
                    }).then(r => r.json()).catch(() => null);

                    const shaActuel = Array.isArray(resCommits) && resCommits[0]?.sha ? resCommits[0].sha : null;
                    if (shaActuel && shaActuel !== dernierCommitSha) {
                        dernierCommitSha = shaActuel;
                        nouveauCommitDetecte = true;
                        demanderSauvegarde();
                    }
                } else {
                    nouveauCommitDetecte = true;
                }

                if (nouveauCommitDetecte) {
                    const versionTexte = ` *(Version ${getVersionString()})*`;
                    const msgRetour = await salonNotif.send({
                        content: `✅ Mise à jour faite, je suis de retour !${versionTexte}\nLaisse-moi encore 10 secondes et tu pourras exécuter des commandes...`,
                        components: construireBoutonsRedeploiement()
                    });
                    await retirerAnciensBoutonsRedeploiement(salonNotif, msgRetour.id);
                    setTimeout(async () => {
                        await msgRetour.edit(`✅ Mise à jour faite, je suis de retour !${versionTexte}\nTout est prêt :)`).catch(() => {});
                    }, 10000);

                    // Envoi automatique du fichier index.js dans le salon d'archives de code
                    const salonCode = await client.channels.fetch('1556184304848085114').catch(() => null);
                    if (salonCode) {
                        const versionNom = getVersionString();
                        const dateStr = new Date().toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' }) + ' à ' + new Date().toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris' });

                        await salonCode.send({
                            content: `📦 **Code source — Version ${versionNom}**\n-# *Déployé le ${dateStr}*`,
                            files: [{ attachment: './index.js', name: `index_v${versionNom}.js` }]
                        }).catch(err => console.error("Erreur envoi index.js :", err.message));
                    }
                }
            }
        } catch (err) {
            console.error("Erreur notification de mise à jour :", err.message);
        }
    })();

    cleanOldData();

    // Surveillance de l'activité en salon vocal pour le Battle Pass (chaque minute)
    setInterval(() => {
        const guildRegaia = client.guilds.cache.get('720057528351850547');
        if (!guildRegaia) return;

        const salonsVocaux = guildRegaia.channels.cache.filter(c => c.isVoiceBased());
        for (const salon of salonsVocaux.values()) {
            const membresHumains = salon.members.filter(m => !m.user.bot);
            // On compte les minutes si au moins 2 personnes sont ensemble dans le salon vocal
            if (membresHumains.size >= 2) {
                for (const membre of membresHumains.values()) {
                    if (!membre.voice.deaf && !membre.voice.serverDeaf) {
                        trackBattlePassProgress(membre.id, 'vocal_min', 1, {
                            groupeCount: membresHumains.size
                        });
                        // Points RegaDex : hors salon AFK et au moins 3 humains présents
                        if (salon.id !== AFK_VOCAL_CHANNEL_ID && membresHumains.size >= 3) {
                            trackTcgVocalMinute(membre.id, membre, salon.id);
                        }
                    }
                }
            }
        }
    }, 60 * 1000);

    // Évite les vérifications réseau simultanées si un appel dépasse son intervalle.
    function scheduleNonOverlappingCheck(label, task, intervalMs) {
        let running = false;
        return setInterval(async () => {
            if (running) return;
            running = true;
            try {
                await task();
            } catch (err) {
                console.error(`[INDEX] Vérification ${label} échouée :`, err);
            } finally {
                running = false;
            }
        }, intervalMs);
    }

    scheduleNonOverlappingCheck('Happy Hour', () => verifierHappyHour(client), 30 * 1000);
    scheduleNonOverlappingCheck('Twitch', () => verifierTwitchLive(client), 60 * 1000);
    scheduleNonOverlappingCheck('YouTube', () => verifierNouvellesVideosYouTube(), 3 * 60 * 1000); // Toutes les 3 minutes

    // Lancement et vérification automatique des mini-jeux (persisté contre les redéploiements)
    const verifierMotusAutomatique = async () => {
        if (!donneesChargees) return;
        const now = new Date();
        const paris = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
        const dateKey = paris.getFullYear() * 10000 + (paris.getMonth() + 1) * 100 + paris.getDate();
        const h = paris.getHours();
        const m = paris.getMinutes();
        const guildRegaia = client.guilds.cache.get('720057528351850547');

        // 1. Lancement du Motus du matin à 10h00 (6 lettres)
        if (h === 10 && m >= 0 && m < 5 && motusData.dateKey !== `${dateKey}_10h`) {
            motusData.dateKey = `${dateKey}_10h`;
            if (guildRegaia) await envoyerMotusQuotidien(guildRegaia, 10);
            await saveAll().catch(err => console.error('[INDEX] Sauvegarde quotidienne échouée :', err));
        }

        // 2. Lancement du Rébus Regaïen à 15h00
        if (
            h === 15 &&
            m >= 0 &&
            m < 5 &&
            rebusLastDateKey !== dateKey &&
            guildRegaia
        ) {
            const lancementReussi = await lancerSessionRebus(guildRegaia);

            if (lancementReussi) {
                rebusLastDateKey = dateKey;
                await saveAll().catch(console.error);
            }
        }

        // 3. Lancement du Motus du soir à 19h00 (7 lettres - Difficile)
        if (h === 19 && m >= 0 && m < 5 && motusData.dateKey !== `${dateKey}_19h`) {
            motusData.dateKey = `${dateKey}_19h`;
            if (guildRegaia) await envoyerMotusQuotidien(guildRegaia, 19);
            await saveAll().catch(err => console.error('[INDEX] Sauvegarde quotidienne échouée :', err));
        }

        // 4. Lancement du Pendu Quotidien à 21h00 (7 lettres - 1h)
        if (
            h === 21 &&
            m >= 0 &&
            m < 5 &&
            penduData.dateKey !== dateKey
        ) {
            if (!guildRegaia) {
                console.warn(
                    '[PENDU] Lancement impossible : serveur Regaïa introuvable.'
                );
            } else {
                // Ne pas inscrire la date avant le lancement :
                // lancerPenduQuotidien() enregistre elle-même
                // la nouvelle session après l'envoi Discord.
                const lancementReussi = await lancerPenduQuotidien(
                    guildRegaia
                );

                if (lancementReussi) {
                    await saveAll().catch(error => {
                        console.error(
                            '[PENDU] Sauvegarde après lancement échouée :',
                            error
                        );
                    });
                } else {
                    console.warn(
                        '[PENDU] Lancement non confirmé. ' +
                        'Nouvelle vérification au prochain passage.'
                    );
                }
            }
        }

        // 5. Arrêt automatique du Pendu après 1h de jeu (à 22h00)
        if (penduData.mot && !penduData.termine && penduData.expireAt && Date.now() >= penduData.expireAt) {
            penduData.termine = true;
            const salonPendu = client.channels.cache.get(PENDU_CHANNEL_ID);
            if (salonPendu) {
                salonPendu.send(`⏰ **Temps écoulé pour le Pendu !** Personne n'a trouvé le mot.\n🔤 Le mot était : **${penduData.mot}** ! Rendez-vous demain soir à 21h00 !`).catch(() => {});
            }
            demanderSauvegarde();
        }

        // Arrêt automatique après 1h de jeu si le mot n'a pas été trouvé
        if (motusData.mot && !motusData.termine && motusData.expireAt && Date.now() >= motusData.expireAt) {
            motusData.termine = true;
            const salon = client.channels.cache.get(MOTUS_CHANNEL_ID);
            if (salon) {
                const prochainTxt = motusData.heureSession === 10 
                    ? 'ce soir à **19h00 (7 lettres - Difficile)**' 
                    : 'demain matin à **10h00 (6 lettres)**';

                const embedFin = new EmbedBuilder()
                    .setColor(0xe74c3c)
                    .setTitle('⏰ TEMPS ÉCOULÉ ! (Fin du Motus)')
                    .setDescription(
                        `L'heure de jeu est terminée et personne n'a trouvé le mot !\n\n` +
                        `🔤 **Le mot était :** \`${motusData.mot}\`\n\n` +
                        `Rendez-vous ${prochainTxt} pour une nouvelle session !`
                    )
                    .setFooter({ text: 'Motus Quotidien • 1 heure de jeu par session' });

                await salon.send({ embeds: [embedFin] }).catch(() => {});
            }
            demanderSauvegarde();
        }
    };
    scheduleNonOverlappingCheck('mini-jeux', verifierMotusAutomatique, 30 * 1000);

    // Tâches de fond sans bloquer l'état du bot
    for (const guild of client.guilds.cache.values()) {
        await guild.members.fetch().catch(() => {});
    }
    console.log(`✅ Membres fetchés`);

    for (const guild of client.guilds.cache.values()) {
        await initialiserWebhooksRoulette(guild);
    }

    scheduleBirthdayCheck(client);
});

// =========================
//     LISTENER REACTIONS
// =========================

client.on('messageReactionAdd', async (reaction, user) => {
    if (!donneesChargees) return;

    try {
        await handleSecurityReactionAdd(reaction, user);
    } catch (err) {
        console.error('[INDEX] Réaction de sécurité échouée :', err);
    }

    if (user.bot) return;

    // Anti-triche vote public : suppression immédiate de la réaction si l'accusé.e vote pour son propre sort
    if (client.activeVotes && client.activeVotes.has(reaction.message.id)) {
        const accusedId = client.activeVotes.get(reaction.message.id);
        if (user.id === accusedId) {
            await reaction.users.remove(user.id).catch(() => {});
            return;
        }
    }

    trackBattlePassProgress(user.id, 'reaction_add', 1, { targetAuthorId: reaction.message?.author?.id });
    if (reaction.emoji.name !== '🖕' && reaction.emoji.name !== 'middle_finger') return;

    const msg = reaction.message;
    if (msg.author.id !== client.user.id) return;

    const emojiReaction = msg.reactions.cache.find(r =>
        r.emoji.name === '🖕' || r.emoji.name === 'middle_finger'
    );
    if (emojiReaction && emojiReaction.count > 1) return;

    const memberNom = msg.guild?.members.cache.get(user.id)?.displayName ?? user.username;
    await msg.channel.send({ 
        content: `Bah alors, **${memberNom}**, on m'envoie un doigt d'honneur ?`,
        flags: [MessageFlags.SuppressNotifications]
    }).catch(err => console.error('[INDEX] Réponse à la réaction impossible :', err));
});

client.on('messageReactionRemove', async (reaction, user) => {
    if (!donneesChargees) return;
    try {
        await handleSecurityReactionRemove(reaction, user);
    } catch (err) {
        console.error('[INDEX] Retrait de réaction de sécurité échoué :', err);
    }
});

function estSessionMiniJeuActive(channelId) {
    const maintenant = Date.now();

    if (channelId === MOTUS_CHANNEL_ID) {
        return Boolean(
            motusData?.mot &&
            !motusData.termine &&
            motusData.expireAt > maintenant
        );
    }

    if (channelId === REBUS_CHANNEL_ID) {
        return isRebusSessionActive();
    }

    if (channelId === PENDU_CHANNEL_ID) {
        return Boolean(
            penduData?.mot &&
            !penduData.termine &&
            penduData.expireAt > maintenant
        );
    }

    return false;
}

const dernierAuteurParSalon = new Map();
client.on('messageCreate', async (message) => {
    if (!donneesChargees) return;
    try {
        await handleRouletteCouronne(message, dernierAuteurParSalon);

        // Les malus textuels ne modifient pas les propositions
        // pendant une session de Motus, Rébus ou Pendu.
        if (estSessionMiniJeuActive(message.channelId)) return;

        await handleRouletteTransfoMessage(message, client);
    } catch (err) {
        console.error('[INDEX] Traitement des effets roulette échoué :', err);
    }
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
    if (!donneesChargees) return;
    try {
        await handleRoulettePseudoLock(oldMember, newMember);
    } catch (err) {
        console.error('[INDEX] Gestion du pseudo roulette échouée :', err);
    }
});

// =========================
//   LISTENER MEMBER JOIN
// =========================

client.on('guildMemberAdd', async (member) => {
    if (!donneesChargees) return;
    if (!Object.prototype.hasOwnProperty.call(topData.messages, member.id)) {
        topData.messages[member.id] = 0;

        demanderSauvegarde();

        console.log(
            `✅ Nouveau membre : ${member.displayName} ajouté au top`
        );
    }

    try {
        await handleWelcomeMemberAdd(member);
    } catch (err) {
        console.error('[INDEX] Accueil du nouveau membre échoué :', err);
    }
    try {
        await handleSecurityMemberAdd(member);
    } catch (err) {
        console.error('[INDEX] Vérification de sécurité du nouveau membre échouée :', err);
    }
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    if (!donneesChargees) return;

    if (oldState.channelId && !newState.channelId) {
        const bpJoueur = battlePassData?.joueurs?.[newState.id];
        if (bpJoueur) bpJoueur.vocalCurrentSessionMinutes = 0;
    }
    try {
        await handleVoiceStateUpdate(oldState, newState);
    } catch (err) {
        console.error('[INDEX] Traitement du salon vocal échoué :', err);
    }
});

// Ne pas ouvrir une session Discord si une autre instance locale
// utilise déjà le même jeton. Le verrou est libéré par l'OS au crash.
async function demarrerAvecVerrou() {
    const verrou = await acquireInstanceGuard(process.env.TOKEN);
    console.log('🔒 Verrou local Cacabot actif (port ' + verrou.port + ').');
    try {
        await client.login(process.env.TOKEN);
    } catch (error) {
        await verrou.release();
        throw error;
    }
}

demarrerAvecVerrou().catch(error => {
    console.error('🚨 Démarrage Cacabot refusé :', error);
    // Les minuteurs du bot existent déjà à ce stade : un simple
    // exitCode laisserait un processus inactif tourner indéfiniment.
    // Aucun état membre n'a été chargé ou modifié par cette étape.
    process.exit(1);
});