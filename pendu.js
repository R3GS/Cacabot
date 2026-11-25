/**
 * Module Pendu Quotidien pour Cacabot (Regaïa)
 * Rendez-vous tous les soirs à 21h00 dans #pendu (1559041872868024370)
 * Mots de 7 lettres • 3 essais par joueur • Durée : 1h
 * Modification sur place de l'embed • Suppression des lettres uniques
 * Victoire au plus grand nombre de bonnes lettres trouvées
 */

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require('discord.js');

const PENDU_CHANNEL_ID = '1559041872868024370';
const EPSYS_ID = '436218312574107658';

let penduTestSessions = new Map(); // channelId -> sessionTest

// Étapes visuelles du pendu (7 étapes pour 7 erreurs collectives)
const PENDU_DESSINS = [
    "```\n  +---+\n  |   |\n      |\n      |\n      |\n      |\n=========\n```",
    "```\n  +---+\n  |   |\n  O   |\n      |\n      |\n      |\n=========\n```",
    "```\n  +---+\n  |   |\n  O   |\n  |   |\n      |\n      |\n=========\n```",
    "```\n  +---+\n  |   |\n  O   |\n /|   |\n      |\n      |\n=========\n```",
    "```\n  +---+\n  |   |\n  O   |\n /|\\  |\n      |\n      |\n=========\n```",
    "```\n  +---+\n  |   |\n  O   |\n /|\\  |\n /    |\n      |\n=========\n```",
    "```\n  +---+\n  |   |\n  O   |\n /|\\  |\n / \\  |\n      |\n=========\n```"
];

// Dictionnaire de 150 mots variés de 7 lettres
const PENDU_DICTIONNAIRE = [
    "ABRICOT", "ANIMAUX", "BAGARRE", "BATEAUX", "BICYCLE", "BISTROT", "BONHEUR", "BOUQUET", "BUREAUX", "CAPRICE",
    "CHATEAU", "CHARIOT", "CLAVIER", "COFFRET", "COPAINS", "COULEUR", "COURAGE", "COUTEAU", "CUISINE", "DANGERS",
    "DESTINS", "DIAMANT", "DIPLOME", "DRAPEAU", "ECLIPSE", "ENFANTS", "ENIGMES", "ETOILES", "FAMILLE", "FANTOME",
    "FLAMMES", "FLEUVES", "FORTUNE", "FOUDRES", "FROMAGE", "GALAXIE", "GATEAUX", "GLACONS", "GUITARE", "HORIZON",
    "JOURNAL", "JOURNEE", "JUNGLES", "LANGAGE", "LEGENDE", "LIVRETS", "LUMIERE", "LUNETTE", "MACHINE", "MAISONS",
    "MANIERE", "MARTEAU", "MESSAGE", "MINUTES", "MIRACLE", "MONSTRE", "MUSIQUE", "MYSTERE", "NATIONS", "NAVIGUE",
    "NOUVEAU", "NUMEROS", "OCTOBRE", "OISEAUX", "ORANGES", "PANIERS", "PAQUETS", "PARFUMS", "PATRONS", "PENSEES",
    "PIERRES", "PLANETE", "POISSON", "POLICES", "POMPIER", "PORTAIL", "POUVOIR", "PRINCES", "PROPOSE", "RACINES",
    "RAYONNE", "REGARDS", "RESEAUX", "RIDEAUX", "RIVAGES", "ROCHERS", "SAISONS", "SALADES", "SECRETS", "SERPENT",
    "SILENCE", "SOLEILS", "SOMMETS", "SOURCES", "TABLEAU", "TALENTS", "TORTUES", "TOURNER", "TRAVAIL", "TRESORS",
    "TROUPES", "TUNNELS", "VACANCE", "VALEURS", "VALISES", "VAPEURS", "VERTIGE", "VILLAGE", "VISAGES", "VOITURE",
    "VOYAGES", "VOYANTS", "CIRCULE", "CONSEIL", "CONTACT", "CORRECT", "COUREUR", "CREATIF", "CRISTAL", "CULTURE",
    "DECIDER", "DEFENSE", "DISCUTE", "ECHELLE", "EMOTION", "ENERGIE", "ESPACES", "ESSENCE", "EXEMPLE", "FACTEUR",
    "FESTIFS", "FIDELES", "FINALES", "FLEXION", "FORMULE", "FOULEES", "GLISSES", "HABITAT", "HORLOGE", "HAUTEUR",
    "HORREUR", "HAMEAUX", "IMPACTS", "INVENTE", "LECTEUR", "LOGIQUE", "LUNAIRE", "MEMOIRE", "MEMBRES", "MENSUEL",
    "NATURES", "OPINION", "ORGANES", "ORIGINE", "PARFUME", "PARTAGE", "PASSION", "PENSEUR", "PISTONS", "POURPRE",
    "PORTIER", "POTIONS", "PRESENT", "RAPIDES", "RECOLTE", "REFLETS", "REGULER", "RELIURE", "REPOSER", "ROUTIER",
    "SECONDE", "SENTIER", "STATION", "TACTILE", "TEMPLES", "TORRENT", "THEATRE", "UNIVERS", "VALIDES", "VARIETE"
].filter(m => m.length === 7);

let penduBridge = {
    getPenduData: () => ({}),
    setPenduData: () => {},
    getPenduStats: () => ({}),
    setPenduStats: () => {},

    getPenduPublicationPending: () => null,
    setPenduPublicationPending: () => {},

    getMotusStats: () => ({}),
    getRebusStats: () => ({}),
    demanderSauvegarde: () => {},
    saveAll: async () => {
        throw new Error('[PENDU] Sauvegarde immédiate non configurée.');
    },
    trackBattlePassProgress: () => {},
    grantTcgPoints: async () => []
};

function initPenduState(bridge) {
    penduBridge = { ...penduBridge, ...bridge };
}

function getPenduDateKey() {
    const now = new Date();
    const paris = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    return paris.getFullYear() * 10000 + (paris.getMonth() + 1) * 100 + paris.getDate();
}

function getPenduWeekKey(dateKey = null) {
    let date;

    if (
        Number.isInteger(Number(dateKey)) &&
        /^\d{8}$/.test(String(dateKey))
    ) {
        const valeur = String(dateKey);

        const annee = Number(valeur.slice(0, 4));
        const mois = Number(valeur.slice(4, 6));
        const jour = Number(valeur.slice(6, 8));

        date = new Date(Date.UTC(annee, mois - 1, jour));

        // Rejeter une date impossible plutôt que de laisser
        // Date normaliser silencieusement le mois ou le jour.
        if (
            date.getUTCFullYear() !== annee ||
            date.getUTCMonth() !== mois - 1 ||
            date.getUTCDate() !== jour
        ) {
            throw new Error(
                `[PENDU] Date de session invalide : ${dateKey}`
            );
        }
    } else {
        const maintenant = new Date();

        const parties = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Europe/Paris',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).formatToParts(maintenant);

        const valeur = type =>
            Number(parties.find(partie => partie.type === type)?.value);

        date = new Date(Date.UTC(
            valeur('year'),
            valeur('month') - 1,
            valeur('day')
        ));
    }

    // ISO 8601 : lundi = premier jour de la semaine.
    const jourSemaine = date.getUTCDay() || 7;

    // Le jeudi détermine l'année ISO.
    date.setUTCDate(date.getUTCDate() + 4 - jourSemaine);

    const anneeISO = date.getUTCFullYear();
    const premierJanvier = new Date(Date.UTC(anneeISO, 0, 1));

    const semaine = Math.ceil(
        ((date - premierJanvier) / 86400000 + 1) / 7
    );

    return `${anneeISO}-W${semaine}`;
}

function getMotDuPendu(dateKey) {
    const x = Math.sin(dateKey + 2121) * 10000;
    const rnd = x - Math.floor(x);
    return PENDU_DICTIONNAIRE[Math.floor(rnd * PENDU_DICTIONNAIRE.length)];
}

function tempsAvantProchainPendu() {
    const now = new Date();
    const parisNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    const h = parisNow.getHours();

    const cible = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    cible.setHours(21, 0, 0, 0);

    let jourStr = "ce soir";
    if (h >= 21) {
        cible.setDate(cible.getDate() + 1);
        jourStr = "demain";
    }

    const diff = cible - parisNow;
    const heures = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    return { jourStr, heures, minutes, timestamp: Math.floor((Date.now() + diff) / 1000) };
}

function buildMasqueMot(mot, lettresTrouvees) {
    return mot.split('').map(l => lettresTrouvees.includes(l) ? l : '_').join(' ');
}

function buildPenduEmbed(session) {
    const expireTimestamp = Math.floor(session.expireAt / 1000);

    // Révéler le mot dans l'embed principal une fois la partie terminée.
    // Pendant une partie active, conserver uniquement les lettres trouvées.
    const masque = session.termine
        ? session.mot.split('').join(' ')
        : buildMasqueMot(session.mot, session.lettresTrouvees);

    const erreursIndex = Math.min(session.erreursCollectives, PENDU_DESSINS.length - 1);
    const potence = PENDU_DESSINS[erreursIndex];

    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const trouvees = session.lettresTrouvees || [];
    const fausses = session.lettresFausses || [];

    // Lettres disponibles (non encore tentées)
    const disponibles = alphabet.filter(l => !trouvees.includes(l) && !fausses.includes(l));
    const disposStr = disponibles.length > 0 ? `\`${disponibles.join(' ')}\`` : '*Toutes les lettres ont été tentées*';
    const compteurDisponibles = `-# *${disponibles.length} lettre${disponibles.length > 1 ? 's' : ''} restante${disponibles.length > 1 ? 's' : ''}*`;

    // Lettres refusées barrées (ex: ~~A~~ • ~~I~~ • ~~M~~)
    const faussesTriees = [...new Set(fausses)].sort();
    const faussesStr = faussesTriees.length > 0
        ? faussesTriees.map(l => `~~${l}~~`).join(' • ')
        : '*Aucune pour l\'instant*';

    // Mots tentés
    const motsTentesStr = (session.motsTentes && session.motsTentes.length > 0)
        ? session.motsTentes.join(', ')
        : '*Aucun pour l\'instant*';

    // Jauge visuelle de vie (6 étapes avec tête de mort si dernière vie)
    const nbErreurs = Math.min(Math.max(session.erreursCollectives || 0, 0), 6);
    const jaugeErreurs = nbErreurs === 5
        ? '🟥🟥🟥🟥🟥💀'
        : '🟥'.repeat(nbErreurs) + '⬜'.repeat(6 - nbErreurs);

    let dernierCoupTexte = '';
    if (session.dernierCoup) {
        dernierCoupTexte = `🎯 **Dernier coup :** <@${session.dernierCoup.userId}> a tenté **« ${session.dernierCoup.proposition} »** ➔ ${session.dernierCoup.statut}\n\n`;
    }

    let participantsTxt = '';
    const entriesJoueurs = Object.entries(session.tentativesJoueurs || {});

    if (entriesJoueurs.length > 0) {
        const limiteAffichage = 15;

        const joueursAffiches = entriesJoueurs.slice(0, limiteAffichage);
        const joueursSupplementaires = Math.max(
            entriesJoueurs.length - limiteAffichage,
            0
        );

        const liste = joueursAffiches
            .map(([uid, nb]) => `<@${uid}> (${nb}/3)`)
            .join(' • ');

        participantsTxt =
            `👥 **Participants (${entriesJoueurs.length}) — essais utilisés :** ${liste}` +
            (
                joueursSupplementaires > 0
                    ? `\n-# … et ${joueursSupplementaires} autre(s) participant(s).`
                    : ''
            ) +
            '\n\n';
    }

    // Alerte et couleur d'ambiance selon le stade de la potence
    let alertePotence = '';
    let couleurEmbed = 0x9b59b6; // Violet calme au début
    if (session.erreursCollectives === 4) {
        couleurEmbed = 0xe67e22; // Orange d'avertissement (2 vies restantes)
        alertePotence = `⚠️ **Attention :** Plus que **2 erreurs** avant le pendu !\n`;
    } else if (session.erreursCollectives >= 6) {
        couleurEmbed = 0x7f1d1d;
        alertePotence = `💀 **PENDU COMPLET : LES 6 ERREURS ONT ÉTÉ ATTEINTES !**\n`;
    } else if (session.erreursCollectives === 5) {
        couleurEmbed = 0xff0000;
        alertePotence = `🚨🚨 **DANGER MORTEL : PLUS QU'UNE SEULE ERREUR !** 🚨🚨\n`;
    }

    const estModeTest = !session.dateKey;

    return new EmbedBuilder()
        .setColor(couleurEmbed)
        .setTitle(
            estModeTest
                ? '🧪 PENDU — MODE TEST'
                : '🪢 LE PENDU QUOTIDIEN DE REGAÏA (21h00)'
        )
        .setDescription(
            (
                estModeTest
                    ? `🧪 **Session de test — sans notification du rôle officiel**\n\n`
                    : `📢 **Notification :** <@&1559041461230505994>\n\n`
            ) +
            `🔤 **Mot de 7 lettres à deviner :**\n# \`${masque}\`\n\n` +
            `⌨️ **Disponibles :** ${disposStr}\n` +
            `${compteurDisponibles}\n` +
            `❌ **Éliminées :** ${faussesStr}\n` +
            `📝 **Mots tentés :** \`${motsTentesStr}\`\n\n` +
            `${potence}\n` +
            `⚠️ **Erreurs collectives :** **${session.erreursCollectives}/6**  \`[ ${jaugeErreurs} ]\`\n` +
            alertePotence + `\n` +
            (dernierCoupTexte || '') +
            (participantsTxt || '') +
            `⏳ **Fin de la session :** <t:${expireTimestamp}:R> (à <t:${expireTimestamp}:t>)\n\n` +
            (
                estModeTest
                    ? `-# 🧪 **Mode test :** essais illimités • Propose une lettre ou un mot de 7 lettres dans ce salon.`
                    : `-# 🎯 **Règle :** 3 essais personnels par joueur (lettre ou mot de 7 lettres) • Écris directement dans ce salon.`
            )
        )
        .setFooter({
            text: estModeTest
                ? 'Mode test du Pendu • Aucun classement officiel'
                : 'Rendez-vous tous les soirs à 21h00 ! • !pendu pour voir le statut'
        });
}

function buildPenduRow(session) {
    // Aucun bouton pour une session absente, terminée ou expirée.
    if (
        !session ||
        session.termine ||
        !Number.isFinite(session.expireAt) ||
        Date.now() >= session.expireAt
    ) {
        return [];
    }

    const nbVotes = (session.votesPacte || []).length;
    const estTropDangereux = session.erreursCollectives >= 5;
    const label = estTropDangereux 
        ? '💡 Pacte indisponible (1 seule vie restante)' 
        : `💡 Pacte : Indice (${nbVotes}/3 votes) | Sacrifier 1 vie`;

    const btnPacte = new ButtonBuilder()
        .setCustomId('pendu_pacte_indice')
        .setLabel(label)
        .setStyle(estTropDangereux ? ButtonStyle.Secondary : ButtonStyle.Danger)
        .setDisabled(estTropDangereux);

    return [new ActionRowBuilder().addComponents(btnPacte)];
}

let lancementPenduEnCours = false;

async function lancerPenduQuotidien(guild, force = false) {
    const channel = guild.channels.cache.get(PENDU_CHANNEL_ID);
    if (!channel) {
        console.warn('[PENDU] Salon officiel introuvable.');
        return false;
    }

    if (lancementPenduEnCours) {
        console.log('[PENDU] Un lancement est déjà en cours.');
        return false;
    }

    const dateKey = getPenduDateKey();
    const sessionActuelle = penduBridge.getPenduData();

    // Cette protection s'applique également à !penduforce.
    // Une publication incertaine ne doit jamais être rejouée
    // avant réconciliation avec les messages Discord.
    if (penduBridge.getPenduPublicationPending()) {
        console.error(
            '[PENDU] Lancement refusé : publication précédente ' +
            'en attente de réconciliation.'
        );

        return false;
    }

    if (!force && sessionActuelle?.dateKey === dateKey) {
        console.log(
            `[PENDU] Session du ${dateKey} déjà enregistrée : lancement ignoré.`
        );
        return false;
    }

    lancementPenduEnCours = true;

    try {
        // Une session terminée peut encore posséder des récompenses
        // en attente de confirmation RegaDex.
        //
        // Ne jamais la remplacer avant d'avoir terminé et
        // sauvegardé son attribution, même lors d'un lancement forcé.
        // Une victoire historique sans marqueur ne doit jamais
        // être récompensée automatiquement : elle peut déjà
        // avoir été créditée par l'ancien système.
        const attributionAncienneEnAttente = Boolean(
            sessionActuelle?.termine &&
            sessionActuelle.recompensesClassementTraitees === true &&
            sessionActuelle.recompensesRevelationTraitees !== true
        );

        if (attributionAncienneEnAttente) {
            console.warn(
                '[PENDU] Récompenses de la session précédente en attente :',
                sessionActuelle.recompensesRewardKey ||
                sessionActuelle.messageId
            );

            try {
                await attribuerRecompensesRevelationPendu(
                    sessionActuelle,
                    sessionActuelle.vainqueurId || null
                );
            } catch (error) {
                console.error(
                    '[PENDU] Nouvelle partie reportée : les récompenses ' +
                    'de la précédente ne sont pas confirmées.',
                    error
                );

                return false;
            }

            if (!sessionActuelle.recompensesRevelationTraitees) {
                console.error(
                    '[PENDU] Nouvelle partie refusée : ' +
                    'attribution précédente toujours en attente.'
                );

                return false;
            }
        }

        // Signaler les anciennes sessions ambiguës sans
        // inventer une nouvelle attribution.
        if (
            sessionActuelle?.termine &&
            !sessionActuelle.recompensesClassementTraitees &&
            !sessionActuelle.recompensesRevelationTraitees
        ) {
            console.warn(
                '[PENDU] Session historique sans marqueur de récompense :',
                sessionActuelle.messageId,
                'Aucune attribution automatique supplémentaire.'
            );
        }

        // Enregistrer durablement la session précédente avant
        // de créer et publier la nouvelle.
        //
        // Si la sauvegarde échoue, conserver l'ancienne session
        // pour permettre une nouvelle tentative ultérieure.
        try {
            await penduBridge.saveAll();
        } catch (error) {
            console.error(
                '[PENDU] Nouvelle partie reportée : sauvegarde ' +
                'de la session précédente impossible.',
                error
            );

            return false;
        }

        const mot = getMotDuPendu(dateKey);
        const expireAt = Date.now() + 60 * 60 * 1000;

        const nouvelleSession = {
            dateKey,
            mot,
            lettresTrouvees: [],
            lettresFausses: [],
            motsTentes: [],
            erreursCollectives: 0,
            expireAt,
            termine: false,
            vainqueurId: null,
            coupDePoker: null,
            votesPacte: [],
            tentativesJoueurs: {},
            bonnesLettresParJoueur: {},
            dernierCoup: null,
            compteurMessagesLongs: 0,
            messageId: null,
            // Identifiant immuable, même si l'embed est republié plus bas.
            sessionId: require('node:crypto').randomUUID()
        };

        const embed = buildPenduEmbed(nouvelleSession);

        // Un identifiant aléatoire distingue les publications forcées
        // successives, y compris lorsqu'elles ont la même date.
        const publicationToken = require('node:crypto').randomUUID();

        const publicationPending = {
            token: publicationToken,
            // Figer l'intention avant l'envoi : ne pas partager l'objet mutable.
            session: structuredClone(nouvelleSession),
            createdAt: Date.now(),

            // Identifier précisément la session remplacée.
            // Nécessaire pour distinguer une reprise légitime
            // d'une incohérence entre deux publications.
            previousMessageId: sessionActuelle?.messageId || null
        };

        penduBridge.setPenduPublicationPending(publicationPending);

        // Étape indispensable : sauvegarder l'intention AVANT
        // de publier quoi que ce soit sur Discord.
        try {
            await penduBridge.saveAll();
        } catch (error) {
            // Un échec réseau ne prouve pas que Discord n'a pas reçu
            // la sauvegarde : garder le journal et bloquer un relancement.
            penduBridge.setPenduPublicationPending(publicationPending);

            console.error(
                '[PENDU] Publication annulée : intention non sauvegardée.',
                error
            );

            return false;
        }

        // Le token figure dans le message officiel.
        // Il permettra de retrouver exactement cette publication.
        const sent = await channel.send({
            content:
                `📢 <@&1559041461230505994> ` +
                `**LE PENDU QUOTIDIEN DE 21H EST LANCÉ !** 🪢\n` +
                `Venez deviner le mot mystère de 7 lettres !\n` +
                `-# Référence Pendu : ${publicationToken}`,
            embeds: [embed],
            components: buildPenduRow(nouvelleSession)
        });

        nouvelleSession.messageId = sent.id;

        // Le message Discord a été publié.
        // La session devient active en mémoire, mais le journal
        // reste présent tant que sa persistance n'est pas confirmée.
        penduBridge.setPenduData(nouvelleSession);
        penduBridge.demanderSauvegarde();

        try {
            // Première sauvegarde :
            // enregistrer la session et son messageId tout en
            // conservant l'intention de publication.
            await penduBridge.saveAll();

            // Le message et la session sont désormais retrouvables
            // depuis une sauvegarde confirmée.
            penduBridge.setPenduPublicationPending(null);

            try {
                // Deuxième sauvegarde :
                // confirmer durablement la clôture du journal.
                await penduBridge.saveAll();
            } catch (error) {
                // Si la clôture n'est pas confirmée, rétablir
                // le journal afin de bloquer tout nouveau lancement.
                penduBridge.setPenduPublicationPending(
                    publicationPending
                );

                penduBridge.demanderSauvegarde();

                console.error(
                    '[PENDU] Session sauvegardée, mais clôture ' +
                    'du journal non confirmée :',
                    error
                );
            }

            console.log(
                '[PENDU] Nouvelle session publiée :',
                nouvelleSession.messageId
            );
        } catch (error) {
            // La publication Discord a réussi, mais pas la
            // première sauvegarde de confirmation.
            //
            // Conserver le journal pour empêcher notamment
            // un nouveau !penduforce dans le même processus.
            penduBridge.setPenduPublicationPending(
                publicationPending
            );

            penduBridge.demanderSauvegarde();

            console.error(
                '[PENDU] Message publié, sauvegarde non confirmée. ' +
                'Nouveaux lancements bloqués jusqu’à réconciliation :',
                error
            );
        }

        // Fermer visuellement l'ancienne partie sans risquer
        // d'annuler le lancement de la nouvelle.
        if (
            sessionActuelle?.messageId &&
            sessionActuelle.messageId !== sent.id
        ) {
            try {
                const ancienMessage = await channel.messages
                    .fetch(sessionActuelle.messageId)
                    .catch(() => null);

                if (ancienMessage) {
                    const ancienneSessionTerminee = {
                        ...sessionActuelle,
                        termine: true
                    };

                    await ancienMessage.edit({
                        embeds: [buildPenduEmbed(ancienneSessionTerminee)],
                        components: []
                    });
                }
            } catch (error) {
                console.warn(
                    '[PENDU] Impossible de clôturer visuellement l’ancienne partie :',
                    error
                );
            }
        }

        console.log(
            `[PENDU] Session ${dateKey} lancée avec succès ` +
            `(message ${sent.id}).`
        );

        return true;

    } catch (error) {
        console.error(
            '[PENDU] Échec du lancement de la session :',
            error
        );

        return false;

    } finally {
        // Libération garantie, même si Discord refuse l'envoi.
        lancementPenduEnCours = false;
    }
}

// ==========================================
//  CLASSEMENTS ET STATISTIQUES
// ==========================================

function buildPenduGuideEmbed() {
    return new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle('📘 Guide du Pendu Quotidien')
        .setDescription(
            `Le Pendu se joue tous les soirs à **21h00** dans <#${PENDU_CHANNEL_ID}> (jusqu'à **22h00**) :\n\n` +
            `• **Mot mystère :** strictement **7 lettres**.\n` +
            `• **Essais personnels :** **3 essais** par joueur *(1 lettre unique ou directement le mot de 7 lettres)*.\n` +
            `• **Potence collective :** **6 erreurs max** pour tout le salon *(indice de survie auto à 4/6 erreurs + bouton Pacte à 3 votes)*.\n\n` +
            `### 🏆 Récompenses\n` +
            `• Le/la/les joueurs ayant trouvé le plus de bonnes lettres remportent la manche (**+3 pts** au classement hebdo \`!pendutop\`).\n` +
            `• **Prime Coup de Poker :** **+2 pts bonus** si tu trouves le mot entier alors qu'il reste au moins 3 lettres cachées !\n` +
            `• **+2 points RegaDex** instantanés pour le/la/les vainqueur·es *(rôle Collectionneur.euse requis)*.`
        )
        .setFooter({ text: 'Tape !pendu pour voir l\'état de la partie ou remettre l\'embed en bas' });
}

function buildPenduStatsEmbed(cible) {
    const stats = penduBridge.getPenduStats() || {};
    const s = stats[cible.id] || {};

    // Compatibilité avec les anciens profils et les champs manquants.
    const nombreValide = (valeur) => {
        const nombre = Number(valeur);
        return Number.isFinite(nombre) && nombre >= 0 ? nombre : 0;
    };

    const victoires = nombreValide(s.victoires);
    const parties = nombreValide(s.parties);
    const points = nombreValide(s.points);

    const pct = parties > 0
        ? Math.round((victoires / parties) * 100)
        : 0;

    // Compatible avec GuildMember et User.
    const nom = cible.displayName
        || cible.globalName
        || cible.user?.globalName
        || cible.user?.username
        || cible.username
        || 'Joueur inconnu';

    return new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle(`🪢 Statistiques Pendu de ${nom}`)
        .addFields(
            { name: '🏆 Victoires', value: `**${victoires}**`, inline: true },
            { name: '⭐ Points gagnés', value: `**${points}**`, inline: true },
            { name: '🎮 Parties jouées', value: `**${parties}**`, inline: true },
            { name: '📈 Taux de réussite', value: `**${pct}%**`, inline: true }
        )
        .setFooter({
            text: 'Pendu Quotidien tous les soirs à 21h00 • Regaïa'
        });
}

function buildClassementHebdomadaireEmbed(guild, authorId) {
    const weekKey = getPenduWeekKey();
    const penduStats = penduBridge.getPenduStats();
    const motusStats = penduBridge.getMotusStats();
    const rebusStats = penduBridge.getRebusStats();

    const membresIds = new Set([
        ...Object.keys(penduStats),
        ...Object.keys(motusStats),
        ...Object.keys(rebusStats)
    ]);

    const table = [];

    const scoreValide = (valeur) => {
        const nombre = Number(valeur);
        return Number.isFinite(nombre) && nombre >= 0 ? nombre : 0;
    };

    for (const uid of membresIds) {
        const pPendu = scoreValide(
            penduStats[uid]?.hebdo?.[weekKey]
        );

        const pMotus = scoreValide(
            motusStats[uid]?.hebdo?.[weekKey]
        ) * 3;

        const pRebus = scoreValide(
            rebusStats[uid]?.hebdo?.[weekKey]
        );

        const total = pPendu + pMotus + pRebus;

        if (total > 0) {
            table.push({ uid, pMotus, pRebus, pPendu, total });
        }
    }

    table.sort((a, b) => b.total - a.total);
    const top7 = table.slice(0, 7);

    const medailles = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣'];

    const lignes = top7.map((item, i) => {
        const med = medailles[i];

        // Les mentions fonctionnent même si le membre n'est pas en cache.
        const joueur = `<@${item.uid}>`;

        return `${med} ${joueur}\n` +
               `> 🟩 Motus : **${item.pMotus} pts** | 🧩 Rébus : **${item.pRebus} pts** | 🪢 Pendu : **${item.pPendu} pts**\n` +
               `> 🌟 **Total Semaine : ${item.total} pts**`;
    });

    const userRankIndex = table.findIndex(item => item.uid === authorId);
    let footerTxt = "Participe au Motus (10h/19h), Rébus (15h) et Pendu (21h) pour marquer des points !";
    if (userRankIndex !== -1) {
        footerTxt = `Ta position : #${userRankIndex + 1} avec ${table[userRankIndex].total} points cumulés cette semaine !`;
    }

    const embed = new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle(`🏆 CLASSEMENT HEBDOMADAIRE DES MINI-JEUX (${weekKey})`)
        .setDescription(
            `Voici les scores des meilleurs joueurs de la semaine combinant tous les mini-jeux du serveur !\n\n` +
            (lignes.length > 0 ? lignes.join('\n\n') : '*Aucun point marqué cette semaine.*')
        )
        .setFooter({ text: footerTxt });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`pendu_top10_${authorId}`)
            .setLabel('👑 Top 10 Général du Serveur')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`pendu_view_stats_${authorId}`)
            .setLabel('🪢 Mes Stats')
            .setStyle(ButtonStyle.Secondary)
    );

    return { embed, row };
}

function buildTop10GlobalEmbed(guild, authorId) {
    const penduStats = penduBridge.getPenduStats();
    const motusStats = penduBridge.getMotusStats();
    const rebusStats = penduBridge.getRebusStats();

    const membresIds = new Set([
        ...Object.keys(penduStats),
        ...Object.keys(motusStats),
        ...Object.keys(rebusStats)
    ]);

    const table = [];

    const scoreValide = (valeur) => {
        const nombre = Number(valeur);
        return Number.isFinite(nombre) && nombre >= 0 ? nombre : 0;
    };

    for (const uid of membresIds) {
        const pPendu = scoreValide(
            penduStats[uid]?.points
        );

        const pMotus = scoreValide(
            motusStats[uid]?.victoires
        ) * 3;

        const pRebus = scoreValide(
            rebusStats[uid]?.points
        );

        const total = pPendu + pMotus + pRebus;

        if (total > 0) {
            table.push({ uid, pMotus, pRebus, pPendu, total });
        }
    }

    table.sort((a, b) => b.total - a.total);
    const top10 = table.slice(0, 10);

    const medailles = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

    const colonnes = top10.map((item, i) => {
        const med = medailles[i];

        // Ne pas dépendre du cache des membres du serveur.
        const joueur = `<@${item.uid}>`;

        return `${med} ${joueur} — **${item.total} pts** (🟩 ${item.pMotus} | 🧩 ${item.pRebus} | 🪢 ${item.pPendu})`;
    });

    const embed = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle('👑 TOP 10 DES MEILLEURS JOUEURS DU SERVEUR (GLOBAL)')
        .setDescription(
            `Le panthéon des maîtres des mini-jeux de Regaïa !\n\n` +
            (colonnes.length > 0 ? colonnes.join('\n') : '*Aucun joueur classé.*')
        )
        .setFooter({ text: 'Barème : 3 pts / victoire Motus • 1 pt / manche Rébus • 3 pts / victoire Pendu' });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`pendu_hebdo_${authorId}`)
            .setLabel('⬅️ Retour au Classement Hebdo')
            .setStyle(ButtonStyle.Secondary)
    );

    return { embed, row };
}

// ==========================================
//  GESTION DES MESSAGES (!)
// ==========================================

async function handlePenduMessage(message, response, client, helpers) {
    const session = penduBridge.getPenduData();
    const penduStats = penduBridge.getPenduStats();
    const now = Date.now();
    const rawContent = message.content.trim();
    const cmd = rawContent.split(/\s+/)[0]?.toLowerCase();
    const command = cmd;

    // 0. Commande de test Pendu (Epsys-only)
    if (cmd === '!pendutest') {
        if (message.author.id !== EPSYS_ID) {
            await message.reply("Cette commande de test est réservée à Epsys.");
            return true;
        }

        // Un test ne doit jamais intercepter les propositions
        // destinées à la partie officielle du Pendu.
        if (message.channel.id === PENDU_CHANNEL_ID) {
            await message.reply(
                "⛔ **Impossible de lancer un Pendu test dans le salon officiel !** " +
                "Utilise un autre salon pour éviter de perturber la partie quotidienne."
            );
            return true;
        }

        const ancienneSession = penduTestSessions.get(message.channel.id);

        if (ancienneSession) {
            const testEncoreActif =
                !ancienneSession.termine &&
                Number.isFinite(ancienneSession.expireAt) &&
                Date.now() < ancienneSession.expireAt;

            if (testEncoreActif) {
                await message.reply(
                    "⚠️ Un test du Pendu est déjà actif dans ce salon. " +
                    "Termine-le ou utilise son bouton « Stopper le mini-jeu » avant d'en lancer un autre."
                );
                return true;
            }

            // Nettoyage d'un ancien test terminé ou expiré.
            penduTestSessions.delete(message.channel.id);

            if (ancienneSession.messageId) {
                const ancienMessage = await message.channel.messages
                    .fetch(ancienneSession.messageId)
                    .catch(() => null);

                if (ancienMessage) {
                    await ancienMessage.edit({
                        components: []
                    }).catch(console.error);
                }
            }
        }

        const motAlea = PENDU_DICTIONNAIRE[Math.floor(Math.random() * PENDU_DICTIONNAIRE.length)];
        const expireAt = Date.now() + 60 * 60 * 1000;

        const sessionTest = {
            mot: motAlea,
            lettresTrouvees: [],
            lettresFausses: [],
            motsTentes: [],
            erreursCollectives: 0,
            expireAt,
            termine: false,
            tentatives: 0,
            bonnesLettres: 0,
            lettresRefusees: [],
            messageId: null
        };

        const embedTest = buildPenduEmbed(sessionTest);
        const rowStop = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`stop_test_pendu_${message.channel.id}`)
                .setLabel('🛑 Stopper le mini-jeu')
                .setStyle(ButtonStyle.Danger)
        );

        const sentTest = await message.channel.send({
            content: `🧪 **[MODE TEST] Partie de Pendu lancée dans ce salon ! (Essais illimités)**`,
            embeds: [embedTest],
            components: [rowStop]
        });

        sessionTest.messageId = sentTest.id;
        penduTestSessions.set(message.channel.id, sessionTest);
        return true;
    }

    // Gestion du salon de test solo
    if (penduTestSessions.has(message.channel.id) && !message.content.startsWith('!')) {
        const sTest = penduTestSessions.get(message.channel.id);

        // Nettoyage d'un test expiré lors du prochain message du salon.
        if (sTest && !sTest.termine && Date.now() >= sTest.expireAt) {
            sTest.termine = true;
            penduTestSessions.delete(message.channel.id);

            if (sTest.messageId) {
                const ancienMessage = await message.channel.messages
                    .fetch(sTest.messageId)
                    .catch(() => null);

                if (ancienMessage) {
                    await ancienMessage.edit({
                        embeds: [buildPenduEmbed(sTest)],
                        components: []
                    }).catch(console.error);
                }
            }

            await message.channel.send(
                `⏰ **[TEST] Temps écoulé !** Le test du Pendu est terminé.\n` +
                `🔤 Le mot mystère était : **${sTest.mot}**.`
            ).catch(console.error);

            return false;
        }

        if (sTest && !sTest.termine && Date.now() < sTest.expireAt) {
            // Une proposition au Pendu doit obligatoirement être un mot unique (pas une phrase de discussion)
            const motsMessage = message.content.trim().split(/\s+/);
            if (motsMessage.length !== 1) {
                return false;
            }

            const rawGuess = message.content.trim().toUpperCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

            // Accepter uniquement une lettre ou un mot de 7 lettres,
            // sans chiffres, ponctuation ni autres caractères parasites.
            if (
                !/^[A-Z]+$/.test(rawGuess) ||
                (rawGuess.length !== 1 && rawGuess.length !== 7)
            ) {
                return false;
            }

            // Détection des doublons en mode test
            const doublonTest =
                (rawGuess.length === 1 &&
                    (sTest.lettresTrouvees.includes(rawGuess) ||
                     sTest.lettresFausses.includes(rawGuess))) ||
                (rawGuess.length === 7 &&
                    (sTest.motsTentes || []).includes(rawGuess));

            if (doublonTest) {
                const terme = rawGuess.length === 1 ? `la lettre **« ${rawGuess} »**` : `le mot **« ${rawGuess} »**`;
                const mAvert = await message.channel.send(`⚠️ <@${message.author.id}>, ${terme} a déjà été proposé dans ce test !`);
                setTimeout(() => {
                    mAvert.delete().catch(() => {});
                    message.delete().catch(() => {});
                }, 5000);
                return true;
            }

            // Suppression automatique si c'est 1 seule lettre pour laisser le chat propre
            if (rawGuess.length === 1) {
                await message.delete().catch(() => {});
            }

            sTest.tentatives++;

            // Cas 1 : Mot complet de 7 lettres
            if (rawGuess.length === 7) {
                if (rawGuess === sTest.mot) {
                    const lettresRestantes = [
                        ...new Set(
                            sTest.mot.split('').filter(
                                lettre => !sTest.lettresTrouvees.includes(lettre)
                            )
                        )
                    ];

                    sTest.bonnesLettres += lettresRestantes.length;
                    sTest.lettresTrouvees = [...new Set(sTest.mot.split(''))];

                    sTest.dernierCoup = {
                        userId: message.author.id,
                        proposition: rawGuess,
                        statut: '🟢 **Mot exact trouvé !** 🎉'
                    };
                } else {
                    sTest.erreursCollectives++;

                    if (!sTest.motsTentes) {
                        sTest.motsTentes = [];
                    }

                    if (!sTest.motsTentes.includes(rawGuess)) {
                        sTest.motsTentes.push(rawGuess);
                    }

                    sTest.dernierCoup = {
                        userId: message.author.id,
                        proposition: rawGuess,
                        statut: '❌ **Mot incorrect !**'
                    };
                }
            }
            // Cas 2 : Lettre individuelle
            else if (rawGuess.length === 1) {
                if (sTest.mot.includes(rawGuess)) {
                    sTest.lettresTrouvees.push(rawGuess);
                    sTest.bonnesLettres++;
                    sTest.dernierCoup = {
                        userId: message.author.id,
                        proposition: rawGuess,
                        statut: '🟢 **Bonne lettre !**'
                    };
                } else {
                    sTest.lettresFausses.push(rawGuess);
                    sTest.lettresRefusees.push(rawGuess);
                    sTest.erreursCollectives++;
                    sTest.dernierCoup = {
                        userId: message.author.id,
                        proposition: rawGuess,
                        statut: '❌ **Refusée !**'
                    };
                }
            }

            // Vérification VICTOIRE
            const gagneTest = sTest.mot.split('').every(l => sTest.lettresTrouvees.includes(l));
            if (gagneTest) {
                sTest.termine = true;
                penduTestSessions.delete(message.channel.id);

                // Met à jour l'embed de base en retirant le bouton
                if (sTest.messageId) {
                    const msgEmbed = await message.channel.messages.fetch(sTest.messageId).catch(() => null);
                    if (msgEmbed) {
                        await msgEmbed.edit({ embeds: [buildPenduEmbed(sTest)], components: [] }).catch(() => {});
                    }
                }

                const lettresIncorrectesTest = [
                    ...new Set(sTest.lettresFausses || [])
                ].sort();

                const motsIncorrectsTest = [
                    ...new Set(sTest.motsTentes || [])
                ];

                const embedVictoireTest = new EmbedBuilder()
                    .setColor(0x2ecc71)
                    .setTitle('🎉 [TEST] MOT DÉCOUVERT AVEC SUCCÈS !')
                    .setDescription(
                        `🔤 **Le mot était bien :** \`${sTest.mot}\`\n\n` +
                        `• **Erreurs commises :** ${sTest.erreursCollectives}/6\n` +
                        `• **Lettres incorrectes :** \`${lettresIncorrectesTest.join(' ') || 'Aucune'}\`\n` +
                        `• **Mots incorrects :** \`${motsIncorrectsTest.join(', ') || 'Aucun'}\``
                    );

                await message.channel.send({ embeds: [embedVictoireTest] });
                return true;
            }

            // Vérification DÉFAITE (6 erreurs atteintes) -> Envoi de l'embed de fin officiel
            if (sTest.erreursCollectives >= 6) {
                sTest.termine = true;
                penduTestSessions.delete(message.channel.id);

                // Met à jour l'embed de base en potence complète sans bouton
                if (sTest.messageId) {
                    const msgEmbed = await message.channel.messages.fetch(sTest.messageId).catch(() => null);
                    if (msgEmbed) {
                        await msgEmbed.edit({ embeds: [buildPenduEmbed(sTest)], components: [] }).catch(() => {});
                    }
                }

                const lettresFaussesTest = [
                    ...new Set(sTest.lettresFausses || [])
                ].sort();

                const motsIncorrectsTest = [
                    ...new Set(sTest.motsTentes || [])
                ];

                const embedDefaiteTest = new EmbedBuilder()
                    .setColor(0xe74c3c)
                    .setTitle('💀 [TEST] PENDU COMPLET ! (Fin de partie)')
                    .setDescription(
                        `${PENDU_DESSINS[6]}\n` +
                        `Le nombre d'erreurs maximal (6/6) a été atteint !\n\n` +
                        `🔤 **Le mot mystère était :** \`${sTest.mot}\`\n\n` +
                        `❌ **Lettres incorrectes :** \`${lettresFaussesTest.join(' ') || 'Aucune'}\`\n` +
                        `📝 **Mots incorrects :** \`${motsIncorrectsTest.join(', ') || 'Aucun'}\``
                    );

                await message.channel.send({ embeds: [embedDefaiteTest] });
                return true;
            }

            // Si la partie continue : mise à jour sur place de l'embed
            if (sTest.messageId) {
                const msgEmbed = await message.channel.messages.fetch(sTest.messageId).catch(() => null);
                if (msgEmbed) {
                    await msgEmbed.edit({ embeds: [buildPenduEmbed(sTest)] }).catch(() => {});
                }
            }
            return true;
        }
    }

    // 1. Détection des propositions dans le salon officiel #pendu
    if (message.channel.id === PENDU_CHANNEL_ID && !message.content.startsWith('!')) {

        // Fermer une session officielle expirée dès le prochain message.
        if (
            session.mot &&
            !session.termine &&
            Number.isFinite(session.expireAt) &&
            now >= session.expireAt
        ) {
            session.termine = true;
            penduBridge.demanderSauvegarde();

            if (session.messageId) {
                const ancienMessage = await message.channel.messages
                    .fetch(session.messageId)
                    .catch(() => null);

                if (ancienMessage) {
                    await ancienMessage.edit({
                        embeds: [buildPenduEmbed(session)],
                        components: []
                    }).catch(console.error);
                }
            }

            await message.channel.send(
                `⏰ **TEMPS ÉCOULÉ !** La partie officielle du Pendu est terminée.\n` +
                `🔤 Le mot mystère était : **${session.mot}**.`
            ).catch(console.error);

            return false;
        }

        if (session.mot && !session.termine && session.expireAt && now < session.expireAt) {
            // Une proposition au Pendu doit être un mot unique (évite que "c'est bon" ou "ah ouais" fassent 7 lettres)
            const motsMessage = message.content.trim().split(/\s+/);
            const estMotUnique = (motsMessage.length === 1);

            const rawGuess = message.content.trim().toUpperCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

            // Une proposition doit contenir uniquement des lettres.
            // Les chiffres, symboles et ponctuations ne sont pas acceptés.
            if (estMotUnique && !/^[A-Z]+$/.test(rawGuess)) {
                return false;
            }

            // Initialisation des structures de données
            if (!session.tentativesJoueurs) session.tentativesJoueurs = {};
            if (!session.bonnesLettresParJoueur) session.bonnesLettresParJoueur = {};
            if (!session.lettresRefuseesParJoueur) session.lettresRefuseesParJoueur = {};

            const uid = message.author.id;

            // Cas A : Le joueur propose 1 seule lettre OU le mot entier de 7 lettres (UN SEUL MOT uniquement)
            if (estMotUnique && (rawGuess.length === 1 || rawGuess.length === 7)) {
                if (!session.tentativesJoueurs[uid]) session.tentativesJoueurs[uid] = 0;
                if (!session.bonnesLettresParJoueur[uid]) session.bonnesLettresParJoueur[uid] = 0;
                if (!session.lettresRefuseesParJoueur[uid]) session.lettresRefuseesParJoueur[uid] = [];

                // 1. Vérification : joueur ayant déjà épuisé ses 3 essais
                if (session.tentativesJoueurs[uid] >= 3) {
                    const mAvert = await message.channel.send(`❌ <@${uid}>, tu as déjà utilisé tes **3 essais** pour cette partie !`);
                    setTimeout(() => {
                        mAvert.delete().catch(() => {});
                        message.delete().catch(() => {});
                    }, 5000);
                    return true;
                }

                if (!session.motsTentes) session.motsTentes = [];
                if (!session.lettresFausses) session.lettresFausses = [];

                // 2. Vérification : doublons (lettre ou mot déjà proposé) -> réaction discrète anti-missclick, aucun spam dans le chat
                const estDoublonLettre = rawGuess.length === 1 && (session.lettresTrouvees.includes(rawGuess) || session.lettresFausses.includes(rawGuess));
                const estDoublonMot = rawGuess.length === 7 && session.motsTentes.includes(rawGuess);

                if (estDoublonLettre || estDoublonMot) {
                    // Tolérance anti-missclick : on réagit avec ⚠️ puis on supprime le message du joueur après 3 secondes sans polluer
                    await message.react('⚠️').catch(() => {});
                    setTimeout(() => {
                        message.delete().catch(() => {});
                    }, 3000);
                    return true;
                }

                // 3. Proposition valide : suppression immédiate de la lettre pour laisser le chat propre
                if (rawGuess.length === 1) {
                    await message.delete().catch(() => {});
                }

                session.tentativesJoueurs[uid]++;
                const motComplet = session.mot;
                const essaisRestants = 3 - session.tentativesJoueurs[uid];
                const pluriel = essaisRestants > 1 ? 's' : '';

                penduBridge.trackBattlePassProgress?.(uid, 'pendu_essai', 1);
                const nbTotalEssais = Object.values(session.tentativesJoueurs).reduce((a, b) => a + b, 0);
                if (nbTotalEssais === 1) {
                    penduBridge.trackBattlePassProgress?.(uid, 'pendu_premier', 1);
                }

                if (!penduStats[uid]) {
                    penduStats[uid] = {
                        victoires: 0,
                        parties: 0,
                        points: 0,
                        hebdo: {}
                    };
                }

                // Normaliser les anciens profils avant toute incrémentation.
                const statsJoueur = penduStats[uid];

                for (const champ of ['victoires', 'parties', 'points']) {
                    const valeur = Number(statsJoueur[champ]);

                    statsJoueur[champ] =
                        Number.isFinite(valeur) && valeur >= 0
                            ? valeur
                            : 0;
                }

                if (
                    !statsJoueur.hebdo ||
                    typeof statsJoueur.hebdo !== 'object' ||
                    Array.isArray(statsJoueur.hebdo)
                ) {
                    statsJoueur.hebdo = {};
                }

                if (session.tentativesJoueurs[uid] === 1) {
                    statsJoueur.parties++;
                    penduBridge.trackBattlePassProgress?.(uid, 'pendu_jours', 1);
                }

                // Cas 1 : Mot complet de 7 lettres
                if (rawGuess.length === 7) {
                    if (rawGuess === motComplet) {
                        // Compter les lettres distinctes encore cachées,
                        // et non leurs occurrences dans le mot.
                        const restantes = [
                            ...new Set(
                                motComplet.split('').filter(
                                    lettre => !session.lettresTrouvees.includes(lettre)
                                )
                            )
                        ];

                        const estCoupDePoker = restantes.length >= 3;

                        if (estCoupDePoker) {
                            session.coupDePoker = uid;
                        }

                        session.bonnesLettresParJoueur[uid] += Math.max(restantes.length, 1);
                        session.lettresTrouvees = [...new Set(motComplet.split(''))];
                        session.dernierCoup = {
                            userId: uid,
                            proposition: rawGuess,
                            statut: estCoupDePoker
                                ? `🎰 **COUP DE POKER RÉUSSI !** Mot exact avec **${restantes.length} lettres cachées** (+2 pts bonus) ! 🎉`
                                : `🟢 **Mot exact trouvé !** 🎉`
                        };
                    } else {
                        session.erreursCollectives++;

                        if (!session.motsTentes.includes(rawGuess)) {
                            session.motsTentes.push(rawGuess);
                        }

                        session.dernierCoup = {
                            userId: uid,
                            proposition: rawGuess,
                            statut: `❌ **Mot incorrect !** *(${essaisRestants}/3 essai${pluriel} restant${pluriel})*`
                        };

                        // L'indice de survie doit aussi se déclencher
                        // lorsque la quatrième erreur est un mot incorrect.
                        if (
                            session.erreursCollectives === 4 &&
                            !session.indiceDonne
                        ) {
                            session.indiceDonne = true;

                            const voyellesRestantes = [
                                ...new Set(
                                    motComplet.split('').filter(
                                        lettre =>
                                            'AEIOUY'.includes(lettre) &&
                                            !session.lettresTrouvees.includes(lettre)
                                    )
                                )
                            ];

                            if (voyellesRestantes.length > 0) {
                                await message.channel.send(
                                    `🛡️ **INDICE DE SURVIE (4/6 erreurs) :** ` +
                                    `Il reste encore **${voyellesRestantes.length} voyelle(s) différente(s)** ` +
                                    `non découverte(s) dans ce mot !`
                                );
                            } else {
                                const lettresRestantes = [
                                    ...new Set(
                                        motComplet.split('').filter(
                                            lettre =>
                                                !session.lettresTrouvees.includes(lettre)
                                        )
                                    )
                                ];

                                if (lettresRestantes.length > 0) {
                                    const lettreOfferte = lettresRestantes[
                                        Math.floor(Math.random() * lettresRestantes.length)
                                    ];

                                    session.lettresTrouvees.push(lettreOfferte);

                                    await message.channel.send(
                                        `🛡️ **INDICE DE SURVIE (4/6 erreurs) :** ` +
                                        `La potence approche ! Cacabot vous offre ` +
                                        `la lettre **« ${lettreOfferte} »** !`
                                    );
                                }
                            }
                        }
                    }
                }
                // Cas 2 : Lettre individuelle
                else if (rawGuess.length === 1) {
                    if (motComplet.includes(rawGuess)) {
                        session.lettresTrouvees.push(rawGuess);
                        session.bonnesLettresParJoueur[uid]++;
                        penduBridge.trackBattlePassProgress?.(uid, 'pendu_bonne_lettre', 1);
                        session.dernierCoup = {
                            userId: uid,
                            proposition: rawGuess,
                            statut: `🟢 **Bonne lettre !** *(${essaisRestants}/3 essai${pluriel} restant${pluriel})*`
                        };
                    } else {
                        if (!session.lettresFausses.includes(rawGuess)) {
                            session.lettresFausses.push(rawGuess);
                            session.erreursCollectives++;
                        }
                        session.dernierCoup = {
                            userId: uid,
                            proposition: rawGuess,
                            statut: `❌ **Refusée !** *(${essaisRestants}/3 essai${pluriel} restant${pluriel})*`
                        };

                        // Indice de survie automatique déclenché à la 4ème erreur collective (sur 6)
                        if (session.erreursCollectives === 4 && !session.indiceDonne) {
                            session.indiceDonne = true;

                            const voyellesRestantes = [
                                ...new Set(
                                    motComplet.split('').filter(
                                        lettre =>
                                            'AEIOUY'.includes(lettre) &&
                                            !session.lettresTrouvees.includes(lettre)
                                    )
                                )
                            ];

                            if (voyellesRestantes.length > 0) {
                                await message.channel.send(
                                    `🛡️ **INDICE DE SURVIE (4/6 erreurs) :** ` +
                                    `Il reste encore **${voyellesRestantes.length} voyelle(s) différente(s)** ` +
                                    `non découverte(s) dans ce mot !`
                                );
                            } else {
                                const lettresRestantes = [
                                    ...new Set(
                                        motComplet.split('').filter(
                                            lettre => !session.lettresTrouvees.includes(lettre)
                                        )
                                    )
                                ];

                                if (lettresRestantes.length > 0) {
                                    const lettreOfferte = lettresRestantes[
                                        Math.floor(Math.random() * lettresRestantes.length)
                                    ];

                                    session.lettresTrouvees.push(lettreOfferte);

                                    await message.channel.send(
                                        `🛡️ **INDICE DE SURVIE (4/6 erreurs) :** ` +
                                        `La potence approche ! Cacabot vous offre ` +
                                        `la lettre **« ${lettreOfferte} »** !`
                                    );
                                }
                            }
                        }
                    }
                }

                // Vérification de la victoire (mot complet révélé)
                const motEntierementTrouve = motComplet.split('').every(l => session.lettresTrouvees.includes(l));

                if (motEntierementTrouve) {
                    session.termine = true;

                    // Toutes les victoires utilisent désormais
                    // le même circuit de récompenses idempotent.
                    const vainqueurs = await attribuerRecompensesRevelationPendu(
                        session,
                        uid
                    );

                    const maxBonnes = Math.max(
                        0,
                        ...Object.values(
                            session.bonnesLettresParJoueur || {}
                        ).map(score => Number(score) || 0)
                    );

                    const tcgRewardPendu =
                        vainqueurs.tcgRewardPendu || [];

                    penduBridge.demanderSauvegarde();

                    // Bilan de victoire limité pour respecter la taille des embeds Discord.
                    // Les statistiques et les récompenses restent attribuées à tous les joueurs.
                    const participantsVictoire = Object.keys(
                        session.tentativesJoueurs || {}
                    );

                    const limiteParticipantsVictoire = 20;

                    // Afficher les vainqueurs en priorité.
                    const participantsTries = [
                        ...participantsVictoire.filter(pId => vainqueurs.includes(pId)),
                        ...participantsVictoire.filter(pId => !vainqueurs.includes(pId))
                    ];

                    const lignesVictoire = participantsTries
                        .slice(0, limiteParticipantsVictoire)
                        .map(pId => {
                            const bonnes = Number(
                                session.bonnesLettresParJoueur?.[pId]
                            ) || 0;

                            const essais = Number(
                                session.tentativesJoueurs[pId]
                            ) || 0;

                            const couronne = vainqueurs.includes(pId)
                                ? ' 👑'
                                : '';

                            return `• <@${pId}>${couronne} : **${bonnes}** bonne(s) lettre(s) ` +
                                `(${essais}/3 essai${essais > 1 ? 's' : ''})`;
                        });

                    const participantsSupplementaires = Math.max(
                        participantsTries.length - limiteParticipantsVictoire,
                        0
                    );

                    if (participantsSupplementaires > 0) {
                        lignesVictoire.push(
                            `*… et ${participantsSupplementaires} autre(s) participant(s).*`
                        );
                    }

                    const lignesParticipants = lignesVictoire.join('\n');

                    let texteAnnonceVictoire = vainqueurs.length > 1
                        ? `🤝 **ÉGALITÉ AU SOMMET !** Victoire partagée entre ${vainqueurs.map(id => `<@${id}>`).join(' et ')} (avec **${maxBonnes}** bonne(s) lettre(s) chacun·e) !\n⭐ **Récompense :** +3 points au classement hebdo pour chacun·e !`
                        : `🏆 **Vainqueur de la manche :** <@${vainqueurs[0]}> (avec **${maxBonnes}** bonne(s) lettre(s)) !\n⭐ **Récompense :** +3 points au classement hebdomadaire !`;

                    if (tcgRewardPendu.length > 0) {
                        texteAnnonceVictoire += `\n\n🃏 **Bonus RegaDex :** **+2 points RegaDex** par gagnant.e !`;

                        for (const uid of tcgRewardPendu) {
                            const soldePendu = tcgRewardPendu.balances?.[uid];

                            texteAnnonceVictoire += Number.isFinite(soldePendu)
                                ? `\n• <@${uid}> — 💰 **Nouveau solde : ${soldePendu} points RegaDex**`
                                : `\n• <@${uid}> — 🃏 **+2 points RegaDex attribués**`;
                        }
                    }

                    if (session.coupDePoker) {
                        texteAnnonceVictoire += `\n\n🎰 **PRIME COUP DE POKER :** <@${session.coupDePoker}> a osé tenter et trouver le mot entier alors qu'il restait au moins 3 lettres cachées ! **(+2 points bonus au classement hebdo)** 🔥`;
                    }

                    const faussesLettresFinal = (session.lettresFausses && session.lettresFausses.length > 0)
                        ? [...new Set(session.lettresFausses)].sort().join(' ') 
                        : 'Aucune';
                    const motsTentesFinal = (session.motsTentes && session.motsTentes.length > 0)
                        ? session.motsTentes.join(', ') 
                        : 'Aucun';

                    const embedVictoire = new EmbedBuilder()
                        .setColor(0x2ecc71)
                        .setTitle('🎉 LE MOT A ÉTÉ DÉCOUVERT ! 🎉')
                        .setDescription(
                            `🔤 **Le mot était bien :** \`${motComplet}\`\n\n` +
                            `${texteAnnonceVictoire}\n\n` +
                            `❌ **Lettres refusées :** \`${faussesLettresFinal}\`\n` +
                            `📝 **Mots tentés :** \`${motsTentesFinal}\`\n\n` +
                            `👥 **__Bilan des participant(e)s :__**\n${lignesParticipants || '*Aucun participant*'}`
                        )
                        .setFooter({ text: 'Rendez-vous demain soir à 21h00 pour le prochain Pendu !' });

                    const rowStats = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('pendu_my_stats')
                            .setLabel('Mes stats')
                            .setEmoji('📊')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('pendu_view_guide')
                            .setLabel('Guide')
                            .setEmoji('📘')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId(`pendu_view_hebdo_${vainqueurs[0]}`)
                            .setLabel('Classement Hebdomadaire')
                            .setEmoji('🏆')
                            .setStyle(ButtonStyle.Success)
                    );

                    // Mise à jour finale de l'embed principal
                    // Le bouton Pacte est supprimé dès la victoire.
                    if (session.messageId) {
                        const msgEmbed = await message.channel.messages
                            .fetch(session.messageId)
                            .catch(() => null);

                        if (msgEmbed) {
                            await msgEmbed.edit({
                                embeds: [buildPenduEmbed(session)],
                                components: []
                            }).catch(console.error);
                        }
                    }

                    await message.channel.send({
                        embeds: [embedVictoire],
                        components: [rowStats]
                    });

                    return true;
                }

                // Vérification de la défaite collective (6 erreurs atteintes)
                if (session.erreursCollectives >= 6) {
                    session.termine = true;
                    penduBridge.demanderSauvegarde();

                    // Retirer le bouton Pacte de l'embed officiel.
                    if (session.messageId) {
                        const msgEmbed = await message.channel.messages
                            .fetch(session.messageId)
                            .catch(() => null);

                        if (msgEmbed) {
                            await msgEmbed.edit({
                                embeds: [buildPenduEmbed(session)],
                                components: []
                            }).catch(console.error);
                        }
                    }

                    const participantsDefaite = Object.keys(
                        session.tentativesJoueurs || {}
                    );

                    // Limiter le bilan affiché sans supprimer les statistiques.
                    const limiteParticipants = 20;

                    const lignesParticipants = participantsDefaite
                        .slice(0, limiteParticipants)
                        .map(pId => {
                            const bonnes = Number(
                                session.bonnesLettresParJoueur?.[pId]
                            ) || 0;

                            const essais = Number(
                                session.tentativesJoueurs[pId]
                            ) || 0;

                            return `• <@${pId}> : **${bonnes}** bonne(s) lettre(s) ` +
                                `(${essais}/3 essai${essais > 1 ? 's' : ''})`;
                        });

                    const participantsMasques = Math.max(
                        participantsDefaite.length - limiteParticipants,
                        0
                    );

                    if (participantsMasques > 0) {
                        lignesParticipants.push(
                            `*… et ${participantsMasques} autre(s) participant(s).*`
                        );
                    }

                    const lignesDefaite = lignesParticipants.join('\n');

                    const faussesLettresFinal = (session.lettresFausses && session.lettresFausses.length > 0)
                        ? [...new Set(session.lettresFausses)].sort().join(' ') 
                        : 'Aucune';
                    const motsTentesFinal = (session.motsTentes && session.motsTentes.length > 0)
                        ? session.motsTentes.join(', ') 
                        : 'Aucun';

                    const embedDefaite = new EmbedBuilder()
                        .setColor(0xe74c3c)
                        .setTitle('💀 LE PENDU EST MORT ! (Défaite collective)')
                        .setDescription(
                            `${PENDU_DESSINS[6]}\n` +
                            `Le nombre d'erreurs maximal (6/6) a été atteint !\n\n` +
                            `🔤 **Le mot mystère était :** \`${motComplet}\`\n\n` +
                            `❌ **Lettres refusées :** \`${faussesLettresFinal}\`\n` +
                            `📝 **Mots tentés :** \`${motsTentesFinal}\`\n\n` +
                            `👥 **__Bilan des participant(e)s :__**\n${lignesDefaite || '*Aucune*'}\n\n` +
                            `Rendez-vous demain soir à **21h00** pour prendre votre revanche !`
                        );

                    await message.channel.send({ embeds: [embedDefaite] });
                    return true;
                }

                // Modification directe sur place de l'embed principal du salon
                if (session.messageId) {
                    const msgEmbed = await message.channel.messages.fetch(session.messageId).catch(() => null);
                    if (msgEmbed) {
                        await msgEmbed.edit({ embeds: [buildPenduEmbed(session)], components: buildPenduRow(session) }).catch(() => {});
                    }
                }

                penduBridge.demanderSauvegarde();
                return true;
            }

            // Cas B : Message de plus d'un caractère (discussion, phrase, mot hors format)
            if (rawContent.length > 1) {
                session.compteurMessagesLongs = (session.compteurMessagesLongs || 0) + 1;

                // Après 15 messages de discussion, replacer l'embed en bas du salon.
                if (session.compteurMessagesLongs >= 15) {
                    const ancienMessageId = session.messageId;

                    // Envoyer d'abord le rappel pour préserver l'embed actif
                    // si Discord refuse l'envoi du nouveau message.
                    const embedRappel = buildPenduEmbed(session);

                    const sentRappel = await message.channel.send({
                        content: '🔔 **Rappel du mot à deviner :**',
                        embeds: [embedRappel],
                        components: buildPenduRow(session),
                        flags: [MessageFlags.SuppressNotifications]
                    });

                    // Le nouveau message devient la référence officielle.
                    session.messageId = sentRappel.id;
                    session.compteurMessagesLongs = 0;
                    penduBridge.demanderSauvegarde();

                    // Supprimer l'ancien uniquement après l'envoi réussi.
                    if (ancienMessageId && ancienMessageId !== sentRappel.id) {
                        const ancienMsg = await message.channel.messages
                            .fetch(ancienMessageId)
                            .catch(() => null);

                        if (ancienMsg) {
                            await ancienMsg.delete().catch(console.error);
                        }
                    }
                }
            }
        }
    }

    // Commande manuelle d'indice pour le Pendu (Epsys-only)
    if (command === '!pendu' && rawContent.split(/\s+/)[1]?.toLowerCase() === 'indice') {
        if (message.author.id !== EPSYS_ID) {
            await message.reply("Cette commande est réservée à Epsys.");
            return true;
        }
        if (!session.mot || session.termine) {
            await message.reply("Aucune partie de Pendu n'est en cours.");
            return true;
        }

        if (
            !Number.isFinite(session.expireAt) ||
            Date.now() >= session.expireAt
        ) {
            await message.reply("⏰ Cette partie de Pendu a expiré.");
            return true;
        }

        const lettresRestantes = [
            ...new Set(
                session.mot.split('').filter(
                    lettre => !session.lettresTrouvees.includes(lettre)
                )
            )
        ];

        if (lettresRestantes.length === 0) {
            await message.reply("Toutes les lettres ont déjà été trouvées !");
            return true;
        }

        const lettreOfferte = lettresRestantes[
            Math.floor(Math.random() * lettresRestantes.length)
        ];

        session.lettresTrouvees.push(lettreOfferte);

        const motComplete = session.mot
            .split('')
            .every(lettre => session.lettresTrouvees.includes(lettre));

        if (motComplete) {
            await attribuerRecompensesRevelationPendu(session);
        }

        penduBridge.demanderSauvegarde();

        const salonOfficiel = message.guild?.channels.cache.get(PENDU_CHANNEL_ID);

        if (session.messageId && salonOfficiel) {
            const msgEmbed = await salonOfficiel.messages
                .fetch(session.messageId)
                .catch(() => null);

            if (msgEmbed) {
                await msgEmbed.edit({
                    embeds: [buildPenduEmbed(session)],
                    components: motComplete ? [] : buildPenduRow(session)
                }).catch(console.error);
            }
        }

        await message.channel.send(
            `💡 **Indice accordé par Epsys :** La lettre **« ${lettreOfferte} »** est présente dans le mot !` +
            (
                motComplete
                    ? `\n\n🎉 **Le mot est entièrement révélé : « ${session.mot} » !** La partie est terminée.`
                    : ''
            )
        );

        return true;
    }

    // Commande de redémarrage d'urgence / forçage Pendu (Epsys-only) : !penduforce ou !pendu restart
    if (command === '!penduforce' || (command === '!pendu' && (rawContent.split(/\s+/)[1]?.toLowerCase() === 'restart' || rawContent.split(/\s+/)[1]?.toLowerCase() === 'relancer'))) {
        if (message.author.id !== EPSYS_ID) {
            await message.reply("Cette commande est réservée à Epsys.");
            return true;
        }

        if (!message.guild) {
            await message.reply(
                "❌ Impossible de relancer le Pendu en dehors du serveur."
            );
            return true;
        }

        // Le lancement forcé crée et enregistre la nouvelle session.
        // Ne pas fermer l'ancienne avant d'avoir confirmé sa réussite.
        const ancienneSession = session;
        const ancienMessageId = ancienneSession.messageId;

        const lancementReussi = await lancerPenduQuotidien(
            message.guild,
            true
        );

        if (!lancementReussi) {
            await message.reply(
                "❌ Le nouveau Pendu n'a pas pu être lancé. " +
                "L'ancienne session est conservée."
            );
            return true;
        }

        // Le nouveau Pendu existe : retirer le bouton de l'ancien message.
        if (ancienMessageId) {
            const salonOfficiel = message.guild.channels.cache.get(
                PENDU_CHANNEL_ID
            );

            const ancienMessage = await salonOfficiel?.messages
                .fetch(ancienMessageId)
                .catch(() => null);

            if (ancienMessage) {
                await ancienMessage.edit({
                    components: []
                }).catch(console.error);
            }
        }

        await message.reply(
            "♻️ **Ancienne session remplacée !** " +
            "Un nouveau Pendu officiel de 7 lettres vient d'être lancé."
        );

        return true;
    }

    // 2. Commande principale !pendu
    if (command === '!pendu') {
        const enCours = session.mot && !session.termine && session.expireAt && now < session.expireAt;

        if (enCours) {
            // Si la commande est tapée dans le salon officiel du Pendu
            if (message.channel.id === PENDU_CHANNEL_ID) {
                const ancienMessageId = session.messageId;

                const embed = buildPenduEmbed(session);

                // Envoyer d'abord le nouveau message pour ne jamais perdre
                // l'embed actif si Discord refuse l'envoi.
                const sent = await message.channel.send({
                    content: '🪢 **Partie de Pendu en cours (remise en bas du salon) :**',
                    embeds: [embed],
                    components: buildPenduRow(session)
                });

                session.messageId = sent.id;
                penduBridge.demanderSauvegarde();

                // L'ancien message n'est supprimé qu'après la réussite
                // de l'envoi et l'enregistrement du nouveau.
                if (ancienMessageId && ancienMessageId !== sent.id) {
                    const ancienMsg = await message.channel.messages
                        .fetch(ancienMessageId)
                        .catch(() => null);

                    if (ancienMsg) {
                        await ancienMsg.delete().catch(console.error);
                    }
                }

                await message.delete().catch(() => {});

                return true;
            }

            // Si tapée dans un autre salon : simple affichage informatif sans toucher à l'embed officiel
            const embed = buildPenduEmbed(session);
            const rowInfo = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('pendu_my_stats').setLabel('Mes stats').setEmoji('📊').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('pendu_view_guide').setLabel('Guide').setEmoji('📘').setStyle(ButtonStyle.Secondary)
            );
            await message.reply({ content: `🪢 **Une partie de Pendu est actuellement EN COURS dans <#${PENDU_CHANNEL_ID}> !**`, embeds: [embed], components: [rowInfo] });
            return true;
        }

        const { jourStr, heures, minutes, timestamp } = tempsAvantProchainPendu();
        const embedAttente = new EmbedBuilder()
            .setColor(0x9b59b6)
            .setTitle('🪢 Pendu Quotidien de Regaïa (21h00)')
            .setDescription(
                `Le prochain Pendu aura lieu **${jourStr} à 21h00** (dans **${heures}h ${minutes}min**, <t:${timestamp}:R>) !\n\n` +
                `• **Longueur :** Strictement 7 lettres\n` +
                `• **Essais :** 3 essais personnels par membre\n` +
                `• **Durée :** 1 heure de jeu\n` +
                `• **Salon :** <#${PENDU_CHANNEL_ID}>`
            )
            .setFooter({ text: 'Rendez-vous tous les soirs à 21h00 • Tape !pendutop pour le classement' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('pendu_my_stats').setLabel('Mes stats').setEmoji('📊').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('pendu_view_guide').setLabel('Guide').setEmoji('📘').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`pendu_view_hebdo_${message.author.id}`)
                .setLabel('Classement Hebdomadaire')
                .setEmoji('🏆')
                .setStyle(ButtonStyle.Success)
        );

        await message.reply({ embeds: [embedAttente], components: [row] });
        return true;
    }

    // 3. Commande !pendustats
    if (command === '!pendustats' || command === '!pendustat') {
        const query = message.content.trim().split(/\s+/).slice(1).join(" ");

        let cible = message.mentions.members.first() || null;

        if (!cible && query && helpers?.findMemberByName) {
            const resultat = await helpers.findMemberByName(message.guild, query);
            cible = resultat?.found || null;
        }

        // Une recherche explicite ne doit jamais afficher les
        // statistiques de l'auteur si aucun membre n'a été trouvé.
        if (query && !cible) {
            await message.reply(
                "❌ **Membre introuvable !** Vérifie le pseudo ou mentionne directement le membre.\n" +
                "💡 Utilise `!pendustats` sans argument pour consulter tes propres statistiques."
            );
            return true;
        }

        if (!cible) {
            cible = message.member;
        }

        if (!cible) {
            await message.reply(
                "❌ Impossible de récupérer les informations de ce membre."
            );
            return true;
        }

        const embed = buildPenduStatsEmbed(cible);
        await message.reply({ embeds: [embed] });

        return true;
    }

    // 4. Commande !pendutop / !classement
    if (command === '!pendutop' || command === '!minijeux' || command === '!jeutop') {
        const { embed, row } = buildClassementHebdomadaireEmbed(message.guild, message.author.id);
        await message.reply({ embeds: [embed], components: [row] });
        return true;
    }

    return false;
}

// ==========================================
//  GESTION DES COMMANDES SLASH (/)
// ==========================================

async function handlePenduSlash(interaction) {
    const cmd = interaction.commandName;
    const session = penduBridge.getPenduData();
    const now = Date.now();

    if (cmd === 'pendu') {
        const enCours = session.mot && !session.termine && session.expireAt && now < session.expireAt;

        if (enCours) {
            const embed = buildPenduEmbed(session);
            const rowInfo = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('pendu_my_stats').setLabel('Mes stats').setEmoji('📊').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('pendu_view_guide').setLabel('Guide').setEmoji('📘').setStyle(ButtonStyle.Secondary)
            );
            return interaction.reply({ content: '🪢 **Une partie de Pendu est actuellement EN COURS !**', embeds: [embed], components: [rowInfo] });
        }

        const { jourStr, heures, minutes, timestamp } = tempsAvantProchainPendu();
        const embedAttente = new EmbedBuilder()
            .setColor(0x9b59b6)
            .setTitle('🪢 Pendu Quotidien de Regaïa (21h00)')
            .setDescription(
                `Le prochain Pendu aura lieu **${jourStr} à 21h00** (dans **${heures}h ${minutes}min**, <t:${timestamp}:R>) !\n\n` +
                `• **Longueur :** Strictement 7 lettres\n` +
                `• **Essais :** 3 essais individuels par joueur\n` +
                `• **Durée :** 1 heure de jeu\n` +
                `• **Salon :** <#${PENDU_CHANNEL_ID}>`
            )
            .setFooter({ text: 'Rendez-vous tous les soirs à 21h00' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('pendu_my_stats').setLabel('Mes stats').setEmoji('📊').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('pendu_view_guide').setLabel('Guide').setEmoji('📘').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`pendu_view_hebdo_${interaction.user.id}`)
                .setLabel('Classement Hebdomadaire')
                .setEmoji('🏆')
                .setStyle(ButtonStyle.Success)
        );

        return interaction.reply({ embeds: [embedAttente], components: [row] });
    }

    if (cmd === 'pendustats') {
        const cibleUser = interaction.options.getUser('membre') ?? interaction.user;

        const member = interaction.guild?.members.cache.get(cibleUser.id)
            ?? await interaction.guild?.members.fetch(cibleUser.id).catch(() => null)
            ?? {
                id: cibleUser.id,
                displayName: cibleUser.globalName || cibleUser.username
            };

        return interaction.reply({
            embeds: [buildPenduStatsEmbed(member)]
        });
    }

    if (cmd === 'pendutop') {
        const { embed, row } = buildClassementHebdomadaireEmbed(interaction.guild, interaction.user.id);
        return interaction.reply({ embeds: [embed], components: [row] });
    }

    return false;
}

// ==========================================
//  GESTION DES BOUTONS D'INTERACTION
// ==========================================

// Finalisation commune : victoire classique, indice ou Pacte.
// Le classement et le Battle Pass sont enregistrés ensemble,
// puis les récompenses TCG peuvent être reprises après redémarrage.
async function attribuerRecompensesRevelationPendu(
    session,
    fallbackWinnerId = null
) {
    const scores = session.bonnesLettresParJoueur || {};
    const maxBonnes = Math.max(
        0,
        ...Object.values(scores).map(valeur => {
            const nombre = Number(valeur);
            return Number.isFinite(nombre) && nombre >= 0 ? nombre : 0;
        })
    );

    const vainqueurs = maxBonnes > 0
        ? Object.keys(scores).filter(
            id => Number(scores[id]) === maxBonnes
        )
        : fallbackWinnerId
            ? [fallbackWinnerId]
            : [];

    // Conserver les gagnants déterminés lors de la première attribution.
    const gagnants = Array.isArray(session.recompensesVainqueurs)
        ? session.recompensesVainqueurs
        : vainqueurs;

    const resultat = [...gagnants];
    resultat.tcgRewardPendu = [];

    if (session.recompensesRevelationTraitees) {
        return resultat;
    }

    // Identifiant stable de la partie, y compris après redémarrage.
    const rewardKey = session.recompensesRewardKey ||
        `pendu:${session.dateKey}:${session.sessionId || session.messageId || 'legacy'}`;

    if (!session.recompensesClassementTraitees) {
        const stats = penduBridge.getPenduStats();

        // Utiliser la semaine de lancement de la partie,
        // jamais celle du redémarrage ou de la reprise.
        const weekKey = session.recompensesWeekKey ||
            getPenduWeekKey(session.dateKey);

        const preparerStats = id => {
            if (!stats[id]) {
                stats[id] = {
                    victoires: 0,
                    parties: 0,
                    points: 0,
                    hebdo: {}
                };
            }

            const joueur = stats[id];

            for (const champ of ['victoires', 'parties', 'points']) {
                const valeur = Number(joueur[champ]);
                joueur[champ] =
                    Number.isFinite(valeur) && valeur >= 0
                        ? valeur
                        : 0;
            }

            if (
                !joueur.hebdo ||
                typeof joueur.hebdo !== 'object' ||
                Array.isArray(joueur.hebdo)
            ) {
                joueur.hebdo = {};
            }

            return joueur;
        };

        session.recompensesVainqueurs = [...gagnants];
        session.recompensesWeekKey = weekKey;
        session.recompensesRewardKey = rewardKey;
        session.termine = true;
        session.vainqueurId = gagnants[0] || null;

        for (const id of gagnants) {
            const joueur = preparerStats(id);

            joueur.victoires++;
            joueur.points += 3;
            joueur.hebdo[weekKey] =
                (Number(joueur.hebdo[weekKey]) || 0) + 3;

            penduBridge.trackBattlePassProgress?.(
                id,
                'pendu_win',
                1,
                { eventKey: rewardKey }
            );

            penduBridge.trackBattlePassProgress?.(
                id,
                'minijeu_win',
                1,
                { eventKey: rewardKey }
            );
        }

        if (session.coupDePoker) {
            const joueur = preparerStats(session.coupDePoker);

            joueur.points += 2;
            joueur.hebdo[weekKey] =
                (Number(joueur.hebdo[weekKey]) || 0) + 2;
        }

        for (const id of Object.keys(session.tentativesJoueurs || {})) {
            penduBridge.trackBattlePassProgress?.(
                id,
                'pendu_victoire_collective',
                1,
                { eventKey: rewardKey }
            );
        }

        // Aucune attente asynchrone avant ce marqueur.
        // Les statistiques, le Battle Pass et ce marqueur
        // seront sauvegardés dans le même fichier JSON.
        session.recompensesClassementTraitees = true;
        penduBridge.demanderSauvegarde();
    }

    // Ne jamais attribuer les points TCG avant que le classement
    // et le Battle Pass soient sauvegardés avec leur marqueur.
    await penduBridge.saveAll();

    const gagnantsPersistes = session.recompensesVainqueurs || gagnants;
    const clePersistante = session.recompensesRewardKey || rewardKey;

    if (gagnantsPersistes.length > 0) {
        // Une erreur Discord ou une sauvegarde RegaDex échouée
        // doit interrompre la finalisation, sans marquer
        // l'attribution comme terminée.
        const attribution = await penduBridge.grantTcgPoints(
            gagnantsPersistes,
            2,
            clePersistante
        );

        if (!Array.isArray(attribution)) {
            throw new Error(
                '[PENDU] Réponse RegaDex invalide : attribution non confirmée.'
            );
        }

        // [] est valide si aucun gagnant ne possède le rôle requis.
        // Les indisponibilités techniques sont désormais signalées
        // par des exceptions dans tcg.js.
        resultat.tcgRewardPendu = attribution;
    }

    // Confirmer la finalisation uniquement après le traitement
    // RegaDex. Les registres persistants protègent les crédits
    // déjà effectués si cette étape doit être rejouée.
    session.recompensesRevelationTraitees = true;

    try {
        await penduBridge.saveAll();
    } catch (error) {
        // La confirmation n'est pas fiable : autoriser une reprise.
        // Les points de classement ne seront pas réattribués,
        // car recompensesClassementTraitees reste à true.
        session.recompensesRevelationTraitees = false;
        penduBridge.demanderSauvegarde();

        console.error(
            '[PENDU] Confirmation finale non sauvegardée ; ' +
            'récompenses laissées en attente de reprise :',
            error
        );

        throw error;
    }

    return resultat;
}

async function handlePenduButton(interaction) {
    if (!interaction.isButton()) return false;
    const customId = interaction.customId;

    // Gestion du Pacte du Pendu (Vote démocratique : 3 votes = 1 vie sacrifiée contre 1 lettre)
    if (customId === 'pendu_pacte_indice') {
        const session = penduBridge.getPenduData();
        if (
            !session ||
            !session.mot ||
            session.termine ||
            !Number.isFinite(session.expireAt) ||
            session.expireAt <= Date.now()
        ) {
            await interaction.followUp({
                content: "Aucune partie de Pendu n'est actuellement en cours !",
                ephemeral: true
            });
            return true;
        }

        if (session.messageId !== interaction.message?.id) {
            await interaction.followUp({
                content: "⚠️ Ce bouton appartient à un ancien message du Pendu. Utilise celui de la partie actuelle !",
                ephemeral: true
            });
            return true;
        }

        if (session.erreursCollectives >= 5) {
            await interaction.followUp({
                content: "⚠️ Trop dangereux ! Il ne reste qu'une seule erreur avant le pendu (5/6), vous ne pouvez plus sacrifier de vie !",
                ephemeral: true
            });
            return true;
        }

        if (!session.votesPacte) session.votesPacte = [];

        const uid = interaction.user.id;

        if (session.votesPacte.includes(uid)) {
            await interaction.followUp({
                content: "Tu as déjà voté pour ce pacte ! Attends que d'autres joueurs votent.",
                ephemeral: true
            });
            return true;
        }

        session.votesPacte.push(uid);

        if (session.votesPacte.length < 3) {
            penduBridge.demanderSauvegarde();

            if (interaction.message?.editable) {
                await interaction.editReply({
                    components: buildPenduRow(session)
                }).catch(error => {
                    console.error(
                        '[PENDU] Impossible d’actualiser les votes du Pacte :',
                        error
                    );
                });
            }

            await interaction.followUp({
                content:
                    `🕯️ <@${uid}> a voté pour le **Pacte du Pendu** ` +
                    `(${session.votesPacte.length}/3 votes requis pour ` +
                    `sacrifier 1 vie contre 1 indice) !`,
                ephemeral: false
            });

            return true;
        }

        // 3 votes atteints : Pacte scellé !
        session.votesPacte = [];
        session.erreursCollectives++;

        const motComplet = session.mot;

        // Chaque lettre distincte possède la même probabilité d'être offerte.
        const lettresRestantes = [
            ...new Set(
                motComplet.split('').filter(
                    lettre => !session.lettresTrouvees.includes(lettre)
                )
            )
        ];

        let lettreOfferte = null;

        if (lettresRestantes.length > 0) {
            lettreOfferte = lettresRestantes[
                Math.floor(Math.random() * lettresRestantes.length)
            ];

            session.lettresTrouvees.push(lettreOfferte);
        }

        // Vérifier immédiatement si le Pacte complète le mot.
        const motComplete = motComplet
            .split('')
            .every(lettre => session.lettresTrouvees.includes(lettre));

        let vainqueursPacte = [];

        // Verrouiller immédiatement la fin de partie.
        // Les récompenses seront traitées après l'accusé de réception Discord.
        if (motComplete) {
            session.termine = true;
        }

        session.dernierCoup = {
            userId: uid,
            proposition: 'PACTE',
            statut: lettreOfferte
                ? `🕯️ **Pacte scellé !** (+1 erreur) ➔ Lettre **« ${lettreOfferte} »** offerte !`
                : `🕯️ **Pacte scellé !** (+1 erreur)`
        };

        penduBridge.demanderSauvegarde();

        // Le clic a déjà été reconnu avant son entrée dans la file.
        // Actualiser le message sans répondre une deuxième fois.
        if (interaction.message?.editable) {
            await interaction.editReply({
                embeds: [buildPenduEmbed(session)],
                components: buildPenduRow(session)
            }).catch(error => {
                console.error(
                    '[PENDU] Impossible d’actualiser le Pacte :',
                    error
                );
            });
        }

        // Les récompenses peuvent être traitées après l'accusé
        // de réception, sans expiration de l'interaction.
        if (motComplete) {
            vainqueursPacte = await attribuerRecompensesRevelationPendu(session);
        }

        await interaction.channel.send({
            content:
                `🕯️ **LE PACTE DU PENDU A ÉTÉ SCELLÉ !**\n` +
                `3 membres ont voté : **1 erreur collective a été sacrifiée** ` +
                `(potence à **${session.erreursCollectives}/6**), ` +
                (
                    lettreOfferte
                        ? `mais Cacabot vous offre la lettre **« ${lettreOfferte} »** ! 🪢`
                        : `mais aucune lettre ne restait à révéler. 🪢`
                )
        });

        // Si la lettre révélée par le Pacte complète le mot.
        if (motComplete) {
            if (session.messageId) {
                const msgEmbed = await interaction.channel.messages
                    .fetch(session.messageId)
                    .catch(() => null);

                if (msgEmbed) {
                    await msgEmbed.edit({
                        embeds: [buildPenduEmbed(session)],
                        components: []
                    }).catch(console.error);
                }
            }

            const annonceVainqueurs = vainqueursPacte.length > 0
                ? `\n🏆 **Vainqueur(s) :** ${vainqueursPacte.map(id => `<@${id}>`).join(', ')} ` +
                  `— **+3 points** au classement et récompense RegaDex selon éligibilité.`
                : `\n🏆 Aucun vainqueur individuel : aucune bonne lettre n'avait été trouvée par un joueur.`;

            await interaction.channel.send(
                `🎉 **LE PACTE A RÉVÉLÉ LA DERNIÈRE LETTRE !** ` +
                `Le mot était **« ${motComplet} »** ! ` +
                `Bravo à toute l'équipe !` +
                annonceVainqueurs
            );
        }

        return true;
    }

    if (customId.startsWith('stop_test_pendu_')) {
        if (interaction.user.id !== EPSYS_ID) {
            await interaction.reply({
                content: "Seule Epsys peut arrêter ce test.",
                ephemeral: true
            });
            return true;
        }

        const chId = customId.replace('stop_test_pendu_', '');
        const session = penduTestSessions.get(chId);

        if (!session || session.messageId !== interaction.message?.id) {
            await interaction.reply({
                content: "⚠️ Ce bouton appartient à un ancien test du Pendu.",
                ephemeral: true
            });
            return true;
        }

        const motSecret = session.mot;
        penduTestSessions.delete(chId);

        await interaction.update({ components: [] });

        await interaction.channel.send(
            `🛑 **Test Pendu arrêté !** Le mot était : **${motSecret}**.`
        );

        return true;
    }

    if (customId === 'pendu_my_stats' || customId.startsWith('pendu_view_stats_')) {
        const utilisateur = interaction.user;

        // Récupérer un véritable GuildMember lorsque c'est possible.
        // Sinon, conserver l'identifiant fiable du compte Discord.
        const membre = interaction.guild?.members.cache.get(utilisateur.id)
            ?? await interaction.guild?.members.fetch(utilisateur.id).catch(() => null)
            ?? {
                id: utilisateur.id,
                displayName: utilisateur.globalName || utilisateur.username
            };

        return interaction.reply({
            embeds: [buildPenduStatsEmbed(membre)],
            ephemeral: true
        });
    }

    if (customId === 'pendu_view_guide') {
        return interaction.reply({ embeds: [buildPenduGuideEmbed()], ephemeral: true });
    }

    if (customId.startsWith('pendu_view_hebdo_') || customId.startsWith('pendu_hebdo_')) {
        const prefix = customId.startsWith('pendu_view_hebdo_')
            ? 'pendu_view_hebdo_'
            : 'pendu_hebdo_';

        const authorId = customId.slice(prefix.length) || interaction.user.id;
        const { embed, row } = buildClassementHebdomadaireEmbed(interaction.guild, authorId);

        if (interaction.message?.editable) {
            return interaction.update({
                embeds: [embed],
                components: [row]
            });
        }

        return interaction.reply({
            embeds: [embed],
            components: [row],
            ephemeral: true
        });
    }

    if (customId.startsWith('pendu_top10_')) {
        const authorId = customId.slice('pendu_top10_'.length)
            || interaction.user.id;

        const { embed, row } = buildTop10GlobalEmbed(
            interaction.guild,
            authorId
        );

        return interaction.update({
            embeds: [embed],
            components: [row]
        });
    }

    return false;
}

// Réconcilier une publication dont l'intention a été sauvegardée
// avant channel.send(), mais dont la confirmation est incertaine.
async function reconcilierPublicationPendu(client) {
    const pending = penduBridge.getPenduPublicationPending();

    if (!pending) return false;

    if (
        typeof pending.token !== 'string' ||
        !pending.token ||
        !pending.session ||
        typeof pending.session !== 'object'
    ) {
        console.error(
            '[PENDU] Journal de publication invalide. ' +
            'Lancement bloqué pour éviter un doublon.'
        );

        return false;
    }

    const channel = await client.channels.fetch(PENDU_CHANNEL_ID);

    if (!channel?.messages?.fetch) {
        throw new Error(
            '[PENDU] Salon indisponible pour la réconciliation.'
        );
    }

    let before = null;
    let trouve = null;

    // Rechercher au maximum les 1000 derniers messages.
    // Si le message n'est pas trouvé, ne PAS en republier un :
    // l'absence dans cette fenêtre n'est pas une preuve d'échec.
    for (let page = 0; page < 10 && !trouve; page++) {
        const messages = await channel.messages.fetch({
            limit: 100,
            ...(before ? { before } : {})
        });

        if (!messages.size) break;

        const lot = [...messages.values()];

        trouve = lot.find(message =>
            message.author?.id === client.user?.id &&
            typeof message.content === 'string' &&
            message.content.includes(
                `Référence Pendu : ${pending.token}`
            )
        );

        before = lot[lot.length - 1].id;

        if (messages.size < 100) break;
    }

    if (!trouve) {
        console.error(
            '[PENDU] Publication introuvable ou non confirmée. ' +
            'Aucun nouveau message ne sera envoyé automatiquement.',
            pending.token
        );

        return false;
    }

    const sessionActuelle = penduBridge.getPenduData();

    const messageActuel = sessionActuelle?.messageId || null;
    const messagePrecedent = pending.previousMessageId || null;

    // Un rappel peut remplacer messageId après la publication initiale.
    // L'identifiant de session, lui, ne change jamais.
    const memePublication = messageActuel === trouve.id || (
        typeof pending.session.sessionId === 'string' &&
        pending.session.sessionId.length > 0 &&
        sessionActuelle?.sessionId === pending.session.sessionId
    );

    const ancienneSessionAttendue =
        messageActuel === messagePrecedent &&
        sessionActuelle?.dateKey !== undefined;

    // Une session portant déjà l'identifiant du nouveau
    // message doit conserver intégralement sa progression.
    //
    // Sinon, seule la session explicitement enregistrée
    // comme précédente peut être remplacée.
    if (!memePublication && !ancienneSessionAttendue) {
        console.error(
            '[PENDU] Réconciliation refusée : incohérence ' +
            'entre la session sauvegardée et le journal.',
            {
                messageActuel,
                messagePrecedent,
                messagePublication: trouve.id,
                token: pending.token
            }
        );

        return false;
    }

    // Ne jamais restaurer la copie initiale sur une partie
    // déjà reconnue : cela effacerait les essais et les lettres.
    const session = memePublication
        ? sessionActuelle
        : {
            ...pending.session,
            messageId: trouve.id
        };

    // Si le message est déjà celui de la session active,
    // conserver intégralement son état actuel.
    penduBridge.setPenduData(session);

    try {
        // Première sauvegarde : session restaurée + journal.
        await penduBridge.saveAll();
    } catch (error) {
        // Conserver le journal : aucun nouveau lancement
        // ne doit être autorisé dans cet état.
        penduBridge.demanderSauvegarde();
        throw error;
    }

    // La session restaurée est maintenant confirmée.
    penduBridge.setPenduPublicationPending(null);

    try {
        // Deuxième sauvegarde : clôture du journal.
        await penduBridge.saveAll();
    } catch (error) {
        // La clôture n'est pas confirmée.
        // Réactiver le blocage jusqu'à une prochaine tentative.
        penduBridge.setPenduPublicationPending(pending);
        penduBridge.demanderSauvegarde();

        throw error;
    }

    console.log(
        '[PENDU] Publication récupérée et journal clôturé :',
        trouve.id
    );

    return true;
}

// Reprendre une attribution interrompue après un redémarrage.
// Ne concerne que les sessions utilisant le nouveau marqueur.
async function reprendreRecompensesPendu() {
    const session = penduBridge.getPenduData();

    if (
        !session ||
        !session.termine ||
        session.recompensesRevelationTraitees === true
    ) {
        return false;
    }

    // Ne reprendre que les attributions dont le classement
    // possède déjà un marqueur explicite.
    //
    // Les sessions historiques peuvent avoir été récompensées
    // avant l'introduction de ces marqueurs.
    if (session.recompensesClassementTraitees !== true) {
        return false;
    }

    if (
        !Array.isArray(session.recompensesVainqueurs) ||
        typeof session.recompensesRewardKey !== 'string' ||
        !session.recompensesRewardKey
    ) {
        console.error(
            '[PENDU] Reprise refusée : attribution marquée ' +
            'mais données de récompense incomplètes.',
            session.messageId
        );

        return false;
    }

    console.log(
        '[PENDU] Reprise des récompenses interrompues :',
        session.recompensesRewardKey
    );

    await attribuerRecompensesRevelationPendu(
        session,
        session.vainqueurId || null
    );

    return true;
}

// Sérialiser les opérations qui peuvent modifier une session Pendu.
// Une erreur ne doit jamais bloquer les traitements suivants.
let fileOperationsPendu = Promise.resolve();

function executerOperationPendu(operation) {
    const execution = fileOperationsPendu.then(operation);

    fileOperationsPendu = execution.catch(error => {
        console.error('[PENDU] Erreur dans une opération :', error);
    });

    return execution;
}

module.exports = {
    PENDU_CHANNEL_ID,
    initPenduState,

    reconcilierPublicationPendu: client =>
        executerOperationPendu(
            () => reconcilierPublicationPendu(client)
        ),

    reprendreRecompensesPendu: () =>
        executerOperationPendu(
            () => reprendreRecompensesPendu()
        ),

    lancerPenduQuotidien: (guild, force = false) =>
        executerOperationPendu(
            () => lancerPenduQuotidien(guild, force)
        ),

    handlePenduMessage: (message, response, client, helpers) =>
        executerOperationPendu(
            () => handlePenduMessage(message, response, client, helpers)
        ),

    handlePenduSlash,

    handlePenduButton: async interaction => {
        if (
            !interaction.isButton() ||
            interaction.customId !== 'pendu_pacte_indice'
        ) {
            return handlePenduButton(interaction);
        }

        await interaction.deferUpdate();

        return executerOperationPendu(
            () => handlePenduButton(interaction)
        );
    }
};