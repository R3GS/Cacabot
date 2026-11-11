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
    getMotusStats: () => ({}),
    getRebusStats: () => ({}),
    demanderSauvegarde: () => {},
    trackBattlePassProgress: () => {}
};

function initPenduState(bridge) {
    penduBridge = { ...penduBridge, ...bridge };
}

function getPenduDateKey() {
    const now = new Date();
    const paris = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    return paris.getFullYear() * 10000 + (paris.getMonth() + 1) * 100 + paris.getDate();
}

function getPenduWeekKey() {
    const d = new Date();
    const paris = new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    const onejan = new Date(paris.getFullYear(), 0, 1);
    const week = Math.ceil((((paris.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);
    return `${paris.getFullYear()}-W${week}`;
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
    const masque = buildMasqueMot(session.mot, session.lettresTrouvees);
    const erreursIndex = Math.min(session.erreursCollectives, PENDU_DESSINS.length - 1);
    const potence = PENDU_DESSINS[erreursIndex];

    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const trouvees = session.lettresTrouvees || [];
    const fausses = session.lettresFausses || [];

    // Lettres disponibles (non encore tentées)
    const disponibles = alphabet.filter(l => !trouvees.includes(l) && !fausses.includes(l));
    const disposStr = disponibles.length > 0 ? `\`${disponibles.join(' ')}\`` : '*Toutes les lettres ont été tentées*';

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
        const liste = entriesJoueurs.map(([uid, nb]) => `<@${uid}> (${nb}/3)`).join(' • ');
        participantsTxt = `👥 **Essais utilisés :** ${liste}\n\n`;
    }

    // Alerte et couleur d'ambiance selon le stade de la potence
    let alertePotence = '';
    let couleurEmbed = 0x9b59b6; // Violet calme au début
    if (session.erreursCollectives === 4) {
        couleurEmbed = 0xe67e22; // Orange d'avertissement (2 vies restantes)
        alertePotence = `⚠️ **Attention :** Plus que **2 erreurs** avant le pendu !\n`;
    } else if (session.erreursCollectives >= 5) {
        couleurEmbed = 0xff0000; // Rouge sang d'alarme maximale (dernière vie !)
        alertePotence = `🚨🚨 **DANGER MORTEL : PLUS QU'UNE SEULE ERREUR !** 🚨🚨\n`;
    }

    return new EmbedBuilder()
        .setColor(couleurEmbed)
        .setTitle('🪢 LE PENDU QUOTIDIEN DE REGAÏA (21h00)')
        .setDescription(
            `📢 **Notification :** <@&1559041461230505994>\n\n` +
            `🔤 **Mot de 7 lettres à deviner :**\n# \`${masque}\`\n\n` +
            `⌨️ **Disponibles :** ${disposStr}\n` +
            `❌ **Éliminées :** ${faussesStr}\n` +
            `📝 **Mots tentés :** \`${motsTentesStr}\`\n\n` +
            `${potence}\n` +
            `⚠️ **Erreurs collectives :** **${session.erreursCollectives}/6**  \`[ ${jaugeErreurs} ]\`\n` +
            alertePotence + `\n` +
            (dernierCoupTexte || '') +
            (participantsTxt || '') +
            `⏳ **Fin de la session :** <t:${expireTimestamp}:R> (à <t:${expireTimestamp}:t>)\n\n` +
            `-# 🎯 **Règle :** 3 essais personnels par joueur (lettre ou mot de 7 lettres) • Écris directement dans ce salon.`
        )
        .setFooter({ text: 'Rendez-vous tous les soirs à 21h00 ! • !pendu pour voir le statut' });
}

function buildPenduRow(session) {
    if (!session || session.termine) return [];
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

async function lancerPenduQuotidien(guild) {
    const channel = guild.channels.cache.get(PENDU_CHANNEL_ID);
    if (!channel) return;

    const dateKey = getPenduDateKey();
    const mot = getMotDuPendu(dateKey);
    const expireAt = Date.now() + 60 * 60 * 1000;

    const nouvelleSession = {
        dateKey,
        mot,
        lettresTrouvees: [],
        lettresFausses: [],
        motsTentes: [], // Liste collective des mots de 7 lettres tentés
        erreursCollectives: 0,
        expireAt,
        termine: false,
        vainqueurId: null,
        coupDePoker: null, // Joueur ayant réussi la prime coup de poker
        votesPacte: [],    // Votes en cours pour le pacte
        tentativesJoueurs: {}, // userId -> totalEssais
        bonnesLettresParJoueur: {}, // userId -> count
        dernierCoup: null,
        compteurMessagesLongs: 0,
        messageId: null
    };

    const embed = buildPenduEmbed(nouvelleSession);

    const sent = await channel.send({
        content: `📢 <@&1559041461230505994> **LE PENDU QUOTIDIEN DE 21H EST LANCÉ !** 🪢\nVenez deviner le mot mystère de 7 lettres !`,
        embeds: [embed],
        components: buildPenduRow(nouvelleSession)
    });

    nouvelleSession.messageId = sent.id;
    penduBridge.setPenduData(nouvelleSession);
    penduBridge.demanderSauvegarde();
}

// ==========================================
//  CLASSEMENTS ET STATISTIQUES
// ==========================================

function buildPenduStatsEmbed(cible) {
    const stats = penduBridge.getPenduStats();
    const s = stats[cible.id] ?? { victoires: 0, parties: 0, points: 0 };
    const pct = s.parties > 0 ? Math.round((s.victoires / s.parties) * 100) : 0;

    return new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle(`🪢 Statistiques Pendu de ${cible.displayName}`)
        .addFields(
            { name: '🏆 Victoires', value: `**${s.victoires}**`, inline: true },
            { name: '⭐ Points gagnés', value: `**${s.points}**`, inline: true },
            { name: '🎮 Parties jouées', value: `**${s.parties}**`, inline: true },
            { name: '📈 Taux de réussite', value: `**${pct}%**`, inline: true }
        )
        .setFooter({ text: 'Pendu Quotidien tous les soirs à 21h00 • Regaïa' });
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
    for (const uid of membresIds) {
        const pPendu = (penduStats[uid]?.hebdo?.[weekKey] ?? penduStats[uid]?.points) || 0;
        const pMotus = (motusStats[uid]?.victoires || 0) * 3;
        const pRebus = rebusStats[uid]?.points || 0;
        const total = pPendu + pMotus + pRebus;

        if (total > 0) {
            table.push({ uid, pMotus, pRebus, pPendu, total });
        }
    }

    table.sort((a, b) => b.total - a.total);
    const top7 = table.slice(0, 7);

    const medailles = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣'];
    const lignes = top7.map((item, i) => {
        const m = guild.members.cache.get(item.uid);
        const nom = (m?.displayName || 'Ancien membre').slice(0, 14);
        const med = medailles[i];
        return `${med} **${nom}**\n` +
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
    for (const uid of membresIds) {
        const pPendu = (penduStats[uid]?.points || 0);
        const pMotus = (motusStats[uid]?.victoires || 0) * 3;
        const pRebus = rebusStats[uid]?.points || 0;
        const total = pPendu + pMotus + pRebus;

        if (total > 0) {
            table.push({ uid, pMotus, pRebus, pPendu, total });
        }
    }

    table.sort((a, b) => b.total - a.total);
    const top10 = table.slice(0, 10);

    const medailles = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    const colonnes = top10.map((item, i) => {
        const m = guild.members.cache.get(item.uid);
        const nom = (m?.displayName || 'Membre').slice(0, 14);
        const med = medailles[i];
        return `${med} **${nom}** — **${item.total} pts** (🟩 ${item.pMotus} | 🧩 ${item.pRebus} | 🪢 ${item.pPendu})`;
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

        const motAlea = PENDU_DICTIONNAIRE[Math.floor(Math.random() * PENDU_DICTIONNAIRE.length)];
        const expireAt = Date.now() + 60 * 60 * 1000;

        const sessionTest = {
            mot: motAlea,
            lettresTrouvees: [],
            lettresFausses: [],
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
        if (sTest && !sTest.termine && Date.now() < sTest.expireAt) {
            // Une proposition au Pendu doit obligatoirement être un mot unique (pas une phrase de discussion)
            const motsMessage = message.content.trim().split(/\s+/);
            if (motsMessage.length !== 1) {
                return false;
            }

            const rawGuess = message.content.trim().toUpperCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .replace(/[^A-Z]/g, "");

            // Si ce n'est ni 1 lettre ni un mot de 7 lettres : on ne touche pas au jeu !
            if (rawGuess.length !== 1 && rawGuess.length !== 7) {
                return false;
            }

            // Détection des doublons en mode test
            const doublonTest = (rawGuess.length === 1 && (sTest.lettresTrouvees.includes(rawGuess) || sTest.lettresFausses.includes(rawGuess)))
                || (rawGuess.length === 7 && sTest.lettresRefusees.includes(rawGuess));

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
                    sTest.lettresTrouvees = [...new Set(sTest.mot.split(''))];
                    sTest.bonnesLettres += 7;
                    sTest.dernierCoup = {
                        userId: message.author.id,
                        proposition: rawGuess,
                        statut: '🟢 **Mot exact trouvé !** 🎉'
                    };
                } else {
                    sTest.erreursCollectives++;
                    sTest.lettresRefusees.push(rawGuess);
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

                const embedVictoireTest = new EmbedBuilder()
                    .setColor(0x2ecc71)
                    .setTitle('🎉 [TEST] MOT DÉCOUVERT AVEC SUCCÈS !')
                    .setDescription(
                        `🔤 **Le mot était bien :** \`${sTest.mot}\`\n\n` +
                        `• **Erreurs commises :** ${sTest.erreursCollectives}/6\n` +
                        `• **Lettres refusées :** \`${sTest.lettresRefusees.join(' ') || 'Aucune'}\``
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

                const embedDefaiteTest = new EmbedBuilder()
                    .setColor(0xe74c3c)
                    .setTitle('💀 [TEST] PENDU COMPLET ! (Fin de partie)')
                    .setDescription(
                        `${PENDU_DESSINS[6]}\n` +
                        `Le nombre d'erreurs maximal (6/6) a été atteint !\n\n` +
                        `🔤 **Le mot mystère était :** \`${sTest.mot}\`\n\n` +
                        `❌ **Lettres refusées :** \`${sTest.lettresRefusees.join(' ') || 'Aucune'}\``
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
        if (session.mot && !session.termine && session.expireAt && now < session.expireAt) {
            // Une proposition au Pendu doit être un mot unique (évite que "c'est bon" ou "ah ouais" fassent 7 lettres)
            const motsMessage = message.content.trim().split(/\s+/);
            const estMotUnique = (motsMessage.length === 1);

            const rawGuess = message.content.trim().toUpperCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .replace(/[^A-Z]/g, "");

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

                if (!penduStats[uid]) penduStats[uid] = { victoires: 0, parties: 0, points: 0, hebdo: {} };
                if (session.tentativesJoueurs[uid] === 1) {
                    penduStats[uid].parties++;
                    penduBridge.trackBattlePassProgress?.(uid, 'pendu_jours', 1);
                }

                // Cas 1 : Mot complet de 7 lettres
                if (rawGuess.length === 7) {
                    if (rawGuess === motComplet) {
                        const restantes = motComplet.split('').filter(l => !session.lettresTrouvees.includes(l));
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
                            const voyellesRestantes = motComplet.split('').filter(l => 'AEIOUY'.includes(l) && !session.lettresTrouvees.includes(l));
                            if (voyellesRestantes.length > 0) {
                                await message.channel.send(`🛡️ **INDICE DE SURVIE (4/6 erreurs) :** Il reste encore **${voyellesRestantes.length} voyelle(s)** non découverte(s) dans ce mot !`);
                            } else {
                                const lettresRestantes = motComplet.split('').filter(l => !session.lettresTrouvees.includes(l));
                                const lettreOfferte = lettresRestantes[Math.floor(Math.random() * lettresRestantes.length)];
                                session.lettresTrouvees.push(lettreOfferte);
                                await message.channel.send(`🛡️ **INDICE DE SURVIE (4/6 erreurs) :** La potence approche ! Cacabot vous offre la lettre **« ${lettreOfferte} »** !`);
                            }
                        }
                    }
                }

                // Vérification de la victoire (mot complet révélé)
                const motEntierementTrouve = motComplet.split('').every(l => session.lettresTrouvees.includes(l));

                if (motEntierementTrouve) {
                    session.termine = true;

                    // Détection du score maximal de bonnes lettres
                    let maxBonnes = 0;
                    for (const score of Object.values(session.bonnesLettresParJoueur)) {
                        if (score > maxBonnes) maxBonnes = score;
                    }

                    // Attribution de la victoire à TOUS les joueurs ex-æquo ayant ce score max
                    const vainqueurs = Object.keys(session.bonnesLettresParJoueur).filter(
                        pId => session.bonnesLettresParJoueur[pId] === maxBonnes && maxBonnes > 0
                    );
                    if (vainqueurs.length === 0) vainqueurs.push(uid);

                    session.vainqueurId = vainqueurs[0];
                    const weekKey = getPenduWeekKey();

                    for (const vId of vainqueurs) {
                        if (!penduStats[vId]) penduStats[vId] = { victoires: 0, parties: 0, points: 0, hebdo: {} };
                        penduStats[vId].victoires++;
                        penduStats[vId].points += 3;

                        if (!penduStats[vId].hebdo) penduStats[vId].hebdo = {};
                        penduStats[vId].hebdo[weekKey] = (penduStats[vId].hebdo[weekKey] || 0) + 3;

                        penduBridge.trackBattlePassProgress?.(vId, 'pendu_win', 1);
                        penduBridge.trackBattlePassProgress?.(vId, 'minijeu_win', 1);
                    }

                    // Attribution du bonus Coup de poker (+2 points pour avoir trouvé le mot complet avec >= 3 lettres cachées)
                    if (session.coupDePoker) {
                        const pokerId = session.coupDePoker;
                        if (!penduStats[pokerId]) penduStats[pokerId] = { victoires: 0, parties: 0, points: 0, hebdo: {} };
                        penduStats[pokerId].points += 2;
                        if (!penduStats[pokerId].hebdo) penduStats[pokerId].hebdo = {};
                        penduStats[pokerId].hebdo[weekKey] = (penduStats[pokerId].hebdo[weekKey] || 0) + 2;
                    }

                    for (const participantId of Object.keys(session.tentativesJoueurs)) {
                        penduBridge.trackBattlePassProgress?.(participantId, 'pendu_victoire_collective', 1);
                    }
                    penduBridge.demanderSauvegarde();

                    // Bilan de chaque participant avec ses essais (sans liste individuelle répétée)
                    const lignesParticipants = Object.keys(session.tentativesJoueurs).map(pId => {
                        const m = message.guild.members.cache.get(pId);
                        const nom = m?.displayName || `<@${pId}>`;
                        const bonnes = session.bonnesLettresParJoueur[pId] || 0;
                        const essais = session.tentativesJoueurs[pId] || 0;
                        const couronne = vainqueurs.includes(pId) ? ' 👑' : '';
                        return `• **${nom}**${couronne} : **${bonnes}** bonne(s) lettre(s) (${essais}/3 essai${essais > 1 ? 's' : ''})`;
                    }).join('\n');

                    let texteAnnonceVictoire = vainqueurs.length > 1
                        ? `🤝 **ÉGALITÉ AU SOMMET !** Victoire partagée entre ${vainqueurs.map(id => `<@${id}>`).join(' et ')} (avec **${maxBonnes}** bonne(s) lettre(s) chacun·e) !\n⭐ **Récompense :** +3 points au classement hebdo pour chacun·e !`
                        : `🏆 **Vainqueur de la manche :** <@${vainqueurs[0]}> (avec **${maxBonnes}** bonne(s) lettre(s)) !\n⭐ **Récompense :** +3 points au classement hebdomadaire !`;

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
                            .setCustomId(`pendu_view_stats_${vainqueurs[0]}`)
                            .setLabel('📊 Mes stats Pendu')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId(`pendu_view_hebdo_${vainqueurs[0]}`)
                            .setLabel('🏆 Classement Hebdomadaire')
                            .setStyle(ButtonStyle.Success)
                    );

                    // Mise à jour finale de l'embed principal
                    if (session.messageId) {
                        const msgEmbed = await message.channel.messages.fetch(session.messageId).catch(() => null);
                        if (msgEmbed) {
                            await msgEmbed.edit({ embeds: [buildPenduEmbed(session)] }).catch(() => {});
                        }
                    }

                    await message.channel.send({ embeds: [embedVictoire], components: [rowStats] });
                    return true;
                }

                // Vérification de la défaite collective (6 erreurs atteintes)
                if (session.erreursCollectives >= 6) {
                    session.termine = true;
                    penduBridge.demanderSauvegarde();

                    if (session.messageId) {
                        const msgEmbed = await message.channel.messages.fetch(session.messageId).catch(() => null);
                        if (msgEmbed) {
                            await msgEmbed.edit({ embeds: [buildPenduEmbed(session)] }).catch(() => {});
                        }
                    }

                    const lignesDefaite = Object.keys(session.tentativesJoueurs).map(pId => {
                        const m = message.guild.members.cache.get(pId);
                        const nom = m?.displayName || `<@${pId}>`;
                        const bonnes = session.bonnesLettresParJoueur[pId] || 0;
                        const essais = session.tentativesJoueurs[pId] || 0;
                        return `• **${nom}** : **${bonnes}** bonne(s) lettre(s) (${essais}/3 essai${essais > 1 ? 's' : ''})`;
                    }).join('\n');

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

                // Après 15 messages de discussion, renvoi de l'embed qui devient la nouvelle référence active
                if (session.compteurMessagesLongs >= 15) {
                    session.compteurMessagesLongs = 0;

                    // Option 1 : on supprime l'ancien embed pour éviter qu'il reste figé plus haut
                    if (session.messageId) {
                        const ancienMsg = await message.channel.messages.fetch(session.messageId).catch(() => null);
                        if (ancienMsg) await ancienMsg.delete().catch(() => {});
                    }

                    const embedRappel = buildPenduEmbed(session);
                    const sentRappel = await message.channel.send({
                        content: '🔔 **Rappel du mot à deviner :**',
                        embeds: [embedRappel],
                        components: buildPenduRow(session),
                        flags: [MessageFlags.SuppressNotifications]
                    });

                    // Le nouveau message devient celui qui sera modifié par la suite !
                    session.messageId = sentRappel.id;
                    penduBridge.demanderSauvegarde();
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

        const lettresRestantes = session.mot.split('').filter(l => !session.lettresTrouvees.includes(l));
        if (lettresRestantes.length === 0) {
            await message.reply("Toutes les lettres ont déjà été trouvées !");
            return true;
        }

        const lettreOfferte = lettresRestantes[Math.floor(Math.random() * lettresRestantes.length)];
        session.lettresTrouvees.push(lettreOfferte);
        penduBridge.demanderSauvegarde();

        if (session.messageId) {
            const msgEmbed = await message.channel.messages.fetch(session.messageId).catch(() => null);
            if (msgEmbed) await msgEmbed.edit({ embeds: [buildPenduEmbed(session)] }).catch(() => {});
        }

        await message.channel.send(`💡 **Indice accordé par Epsys :** La lettre **« ${lettreOfferte} »** est présente dans le mot !`);
        return true;
    }

    // Commande de redémarrage d'urgence / forçage Pendu (Epsys-only) : !penduforce ou !pendu restart
    if (command === '!penduforce' || (command === '!pendu' && (rawContent.split(/\s+/)[1]?.toLowerCase() === 'restart' || rawContent.split(/\s+/)[1]?.toLowerCase() === 'relancer'))) {
        if (message.author.id !== EPSYS_ID) {
            await message.reply("Cette commande est réservée à Epsys.");
            return true;
        }

        // Annulation et fermeture de l'ancienne session
        session.termine = true;
        penduBridge.demanderSauvegarde();

        await message.reply("♻️ **Session Pendu précédente fermée !** Lancement immédiat d'une toute nouvelle partie officielle (7 lettres, 6 erreurs collectives, 1h)...");
        if (message.guild) {
            await lancerPenduQuotidien(message.guild);
        }
        return true;
    }

    // 2. Commande principale !pendu
    if (command === '!pendu') {
        const enCours = session.mot && !session.termine && session.expireAt && now < session.expireAt;

        if (enCours) {
            // Si la commande est tapée dans le salon officiel du Pendu
            if (message.channel.id === PENDU_CHANNEL_ID) {
                // Option 1 : on supprime l'ancien embed et la commande pour ne garder qu'un seul embed vivant tout en bas
                if (session.messageId) {
                    const ancienMsg = await message.channel.messages.fetch(session.messageId).catch(() => null);
                    if (ancienMsg) await ancienMsg.delete().catch(() => {});
                }

                await message.delete().catch(() => {});

                const embed = buildPenduEmbed(session);
                const sent = await message.channel.send({
                    content: '🪢 **Partie de Pendu en cours (remise en bas du salon) :**',
                    embeds: [embed],
                    components: buildPenduRow(session)
                });

                session.messageId = sent.id;
                penduBridge.demanderSauvegarde();
                return true;
            }

            // Si tapée dans un autre salon : simple affichage informatif sans toucher à l'embed officiel
            const embed = buildPenduEmbed(session);
            await message.reply({ content: `🪢 **Une partie de Pendu est actuellement EN COURS dans <#${PENDU_CHANNEL_ID}> !**`, embeds: [embed] });
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
            new ButtonBuilder()
                .setCustomId(`pendu_view_hebdo_${message.author.id}`)
                .setLabel('🏆 Classement Hebdomadaire')
                .setStyle(ButtonStyle.Primary)
        );

        await message.reply({ embeds: [embedAttente], components: [row] });
        return true;
    }

    // 3. Commande !pendustats
    if (command === '!pendustats' || command === '!pendustat') {
        let cible = message.mentions.members.first();
        if (!cible) {
            const query = message.content.trim().split(/\s+/).slice(1).join(" ");
            if (query && helpers?.findMemberByName) cible = helpers.findMemberByName(message.guild, query).found;
        }
        if (!cible) cible = message.member;

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
            return interaction.reply({ content: '🪢 **Une partie de Pendu est actuellement EN COURS !**', embeds: [embed] });
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
            new ButtonBuilder()
                .setCustomId(`pendu_view_hebdo_${interaction.user.id}`)
                .setLabel('🏆 Classement Hebdomadaire')
                .setStyle(ButtonStyle.Primary)
        );

        return interaction.reply({ embeds: [embedAttente], components: [row] });
    }

    if (cmd === 'pendustats') {
        const cibleUser = interaction.options.getUser('membre') ?? interaction.user;
        const member = interaction.guild?.members.cache.get(cibleUser.id) ?? interaction.member;
        return interaction.reply({ embeds: [buildPenduStatsEmbed(member)] });
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

async function handlePenduButton(interaction) {
    if (!interaction.isButton()) return false;
    const customId = interaction.customId;

    // Gestion du Pacte du Pendu (Vote démocratique : 3 votes = 1 vie sacrifiée contre 1 lettre)
    if (customId === 'pendu_pacte_indice') {
        const session = penduBridge.getPenduData();
        if (!session || !session.mot || session.termine) {
            return interaction.reply({ content: "Aucune partie de Pendu n'est en cours !", ephemeral: true });
        }
        if (session.erreursCollectives >= 5) {
            return interaction.reply({ content: "⚠️ Trop dangereux ! Il ne reste qu'une seule erreur avant le pendu (5/6), vous ne pouvez plus sacrifier de vie !", ephemeral: true });
        }
        if (!session.votesPacte) session.votesPacte = [];

        const uid = interaction.user.id;
        if (session.votesPacte.includes(uid)) {
            return interaction.reply({ content: "Tu as déjà voté pour ce pacte ! Attends que d'autres joueurs votent.", ephemeral: true });
        }

        session.votesPacte.push(uid);

        if (session.votesPacte.length < 3) {
            penduBridge.demanderSauvegarde();
            if (interaction.message?.editable) {
                await interaction.update({ components: buildPenduRow(session) }).catch(() => {});
            } else {
                await interaction.deferUpdate().catch(() => {});
            }
            await interaction.followUp({ content: `🕯️ <@${uid}> a voté pour le **Pacte du Pendu** (${session.votesPacte.length}/3 votes requis pour sacrifier 1 vie contre 1 indice) !`, ephemeral: false });
            return true;
        }

        // 3 votes atteints : Pacte scellé !
        session.votesPacte = [];
        session.erreursCollectives++;

        const motComplet = session.mot;
        const lettresRestantes = motComplet.split('').filter(l => !session.lettresTrouvees.includes(l));
        
        let lettreOfferte = null;
        if (lettresRestantes.length > 0) {
            lettreOfferte = lettresRestantes[Math.floor(Math.random() * lettresRestantes.length)];
            session.lettresTrouvees.push(lettreOfferte);
        }

        session.dernierCoup = {
            userId: uid,
            proposition: 'PACTE',
            statut: lettreOfferte ? `🕯️ **Pacte scellé !** (+1 erreur) ➔ Lettre **« ${lettreOfferte} »** offerte !` : `🕯️ **Pacte scellé !** (+1 erreur)`
        };

        penduBridge.demanderSauvegarde();

        if (interaction.message?.editable) {
            await interaction.update({ embeds: [buildPenduEmbed(session)], components: buildPenduRow(session) }).catch(() => {});
        } else {
            await interaction.deferUpdate().catch(() => {});
        }

        await interaction.channel.send({
            content: `🕯️ **LE PACTE DU PENDU A ÉTÉ SCELLÉ !**\n3 membres ont voté : **1 erreur collective a été sacrifiée** (potence à **${session.erreursCollectives}/6**), mais Cacabot vous offre la lettre **« ${lettreOfferte} »** ! 🪢`
        });

        // Si la lettre révélée par le pacte complète le mot !
        if (motComplet.split('').every(l => session.lettresTrouvees.includes(l))) {
            session.termine = true;
            penduBridge.demanderSauvegarde();
            if (session.messageId) {
                const msgEmbed = await interaction.channel.messages.fetch(session.messageId).catch(() => null);
                if (msgEmbed) await msgEmbed.edit({ embeds: [buildPenduEmbed(session)], components: [] }).catch(() => {});
            }
            await interaction.channel.send(`🎉 **LE PACTE A RÉVÉLÉ LA DERNIÈRE LETTRE !** Le mot était **« ${motComplet} »** ! Bravo à toute l'équipe !`);
        }

        return true;
    }

    if (customId.startsWith('stop_test_pendu_')) {
        if (interaction.user.id !== EPSYS_ID) {
            await interaction.reply({ content: "Seule Epsys peut arrêter ce test.", ephemeral: true });
            return true;
        }
        const chId = customId.replace('stop_test_pendu_', '');
        const session = penduTestSessions.get(chId);
        const motSecret = session ? session.mot : 'inconnu';
        penduTestSessions.delete(chId);
        await interaction.update({ components: [] });
        await interaction.channel.send(`🛑 **Test Pendu arrêté !** Le mot était : **${motSecret}**.`);
        return true;
    }

    if (customId.startsWith('pendu_view_stats_')) {
        const uid = customId.split('_')[3];
        const member = interaction.guild.members.cache.get(uid) || interaction.member;
        return interaction.reply({ embeds: [buildPenduStatsEmbed(member)], ephemeral: true });
    }

    if (customId.startsWith('pendu_view_hebdo_') || customId.startsWith('pendu_hebdo_')) {
        const authorId = customId.split('_')[3] || interaction.user.id;
        const { embed, row } = buildClassementHebdomadaireEmbed(interaction.guild, authorId);
        if (interaction.message?.editable) {
            return interaction.update({ embeds: [embed], components: [row] });
        }
        return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    }

    if (customId.startsWith('pendu_top10_')) {
        const authorId = customId.split('_')[2];
        const { embed, row } = buildTop10GlobalEmbed(interaction.guild, authorId);
        return interaction.update({ embeds: [embed], components: [row] });
    }

    return false;
}

module.exports = {
    PENDU_CHANNEL_ID,
    initPenduState,
    lancerPenduQuotidien,
    handlePenduMessage,
    handlePenduSlash,
    handlePenduButton
};