/**
 * Module Pendu Quotidien pour Cacabot (Regaïa)
 * Rendez-vous tous les soirs à 21h00 dans #minijeux (1556089022718152764)
 * Mots de 7 lettres • 3 essais par joueur • Durée : 1h
 * Commandes : !pendu, !pendustats, !pendutop et leurs équivalents Slash
 */

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const PENDU_CHANNEL_ID = '1556089022718152764';
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

// Dictionnaire de 150 mots variés de 7 lettres (tous normalisés)
const PENDU_DICTIONNAIRE = [
    "ABRICOT", "ANIMAUX", "BAGARRE", "BATEAUX", "BICYCLE", "BISTROT", "BONHEUR", "BOUTEIL", "BUREAUX", "CAPRICE",
    "CHATEAU", "CHOCOLA", "CLAVIER", "COFFRET", "COPAINS", "COULEUR", "COURAGE", "COUTEAU", "CUISINE", "DANGERS",
    "DESTINS", "DIAMANT", "DIPLOME", "DRAPEAU", "ECLIPSE", "ENFANTS", "ENIGMES", "ETOILES", "FAMILLE", "FANTOME",
    "FLAMMES", "FLEUVES", "FORTUNE", "FOUDRES", "FROMAGE", "GALAXIE", "GATEAUX", "GLACONS", "GUITARE", "HORIZON",
    "JOURNAL", "JOURNEE", "JUNGLES", "LANGAGE", "LEGENDE", "LIVRETS", "LUMIERE", "LUNETTE", "MACHINE", "MAISONS",
    "MANIERE", "MARCHAL", "MESSAGE", "MINUTES", "MIRACLE", "MONSTRE", "MUSIQUE", "MYSTERE", "NATIONS", "NAVIGUE",
    "NOUVEAU", "NUMEROS", "OCEANS", "OISEAUX", "ORANGES", "PANIERS", "PAQUETS", "PARFUMS", "PATRONS", "PENSEES",
    "PIERRES", "PLANETE", "POISSON", "POLICES", "POMPIER", "PORTAIL", "POUVOIR", "PRINCES", "PROPOSE", "RACINES",
    "RAYONS", "REGARDS", "RESEAUX", "RIDEAUX", "RIVAGES", "ROCHERS", "SAISONS", "SALADES", "SECRETS", "SERPENT",
    "SILENCE", "SOLEILS", "SOMMETS", "SOURCES", "TABLEAU", "TALENTS", "TORTUES", "TOURNER", "TRAVAIL", "TRESORS",
    "TROUPES", "TUNNELS", "VACANCE", "VALEURS", "VALISES", "VAPEURS", "VICTOIR", "VILLAGE", "VISAGES", "VOITURS",
    "VOYAGES", "VOYANTS", "CIRCULE", "CONSEIL", "CONTACT", "CORRECT", "COURRIER", "CREATIF", "CRISTAL", "CULTURE",
    "DECIDER", "DEFENSE", "DISCUTE", "ECHELLE", "EMOTION", "ENERGIE", "ESPACES", "ESSENCE", "EXEMPLE", "FACTEUR",
    "FESTIFS", "FIDELES", "FINALES", "FLEXION", "FORMULE", "FOULEES", "GLISSES", "HABITAT", "HARMONY", "HAUTEUR",
    "HORREUR", "HUMOURS", "IMPACTY", "INVENTE", "LECTEUR", "LOGIQUE", "LUNAIRE", "MEMOIRE", "MEMBRES", "MENSUEL",
    "NATURES", "OPINION", "ORGANEZ", "ORIGINE", "PARFUME", "PARTAGE", "PASSION", "PENSEUR", "PISTONS", "POETIQUE",
    "PORTIER", "POTIONS", "PRESENT", "RAPIDES", "RECOLTE", "REFLETS", "REGULER", "RELIURE", "REPOSER", "ROBOTIC",
    "SECONDE", "SENTIER", "STATION", "TACTILE", "TEMPLES", "TERRAINS", "THEATRE", "UNIVERS", "VALIDES", "VARIETE"
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

    const faussesLettresStr = session.lettresFausses.length > 0 
        ? session.lettresFausses.sort().join(' ') 
        : '*Aucune pour l\'instant*';

    return new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle('🪢 LE PENDU QUOTIDIEN DE REGAÏA (21h00)')
        .setDescription(
            `Le Pendu est ouvert pendant **1 heure pile** !\n\n` +
            `🔤 **Mot de 7 lettres à deviner :**\n# \`${masque}\`\n\n` +
            `${potence}\n` +
            `❌ **Lettres absentes :** \`${faussesLettresStr}\`\n` +
            `⚠️ **Erreurs collectives :** **${session.erreursCollectives}/6**\n` +
            `⏳ **Fin de la session :** <t:${expireTimestamp}:R> (à <t:${expireTimestamp}:t>)\n\n` +
            `🎯 **Règle :** Tu as **3 essais personnels** pour proposer une lettre ou le mot entier de 7 lettres !\n` +
            `💬 *Écris directement ta lettre ou ton mot dans ce salon.*`
        )
        .setFooter({ text: 'Rendez-vous tous les soirs à 21h00 ! • !pendu pour voir le statut' });
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
        erreursCollectives: 0,
        expireAt,
        termine: false,
        vainqueurId: null,
        tentativesJoueurs: {}, // userId -> count
        compteurMessages: 0,
        messageId: null
    };

    const embed = buildPenduEmbed(nouvelleSession);
    embed.setDescription(`📢 **Alerte :** <@&1559041461230505994>\n\n` + embed.data.description);

    const sent = await channel.send({
        content: `📢 <@&1559041461230505994> **LE PENDU QUOTIDIEN DE 21H EST LANCÉ !** 🪢\nVenez deviner le mot mystère de 7 lettres !`,
        embeds: [embed]
    });

    nouvelleSession.messageId = sent.id;
    penduBridge.setPenduData(nouvelleSession);
    penduBridge.demanderSauvegarde();
}

// ==========================================
//  CLASSEMENTS ET STATISTIQUES MULTI-JEUX
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

    // Agrégation des scores de tous les mini-jeux pour la semaine
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

    // Commande de test Pendu (Epsys-only)
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
            tentatives: 0
        };

        penduTestSessions.set(message.channel.id, sessionTest);

        const embedTest = new EmbedBuilder()
            .setColor(0x9b59b6)
            .setTitle('🪢 [MODE TEST] PENDU SOLO')
            .setDescription(
                `Partie de test lancée dans ce salon privé !\n\n` +
                `🔤 **Mot de 7 lettres :** \`${buildMasqueMot(motAlea, [])}\`\n\n` +
                `${PENDU_DESSINS[0]}\n` +
                `🎯 Tu as 3 essais pour proposer des lettres ou le mot complet de 7 lettres !`
            );

        await message.reply({
            content: `🧪 **[MODE TEST] Partie de Pendu lancée dans ce salon !**`,
            embeds: [embedTest]
        });
        return true;
    }

    // Gestion des réponses dans un salon de test Pendu
    if (penduTestSessions.has(message.channel.id) && !message.content.startsWith('!')) {
        const sTest = penduTestSessions.get(message.channel.id);
        if (sTest && !sTest.termine && Date.now() < sTest.expireAt) {
            const rawGuess = message.content.trim().toUpperCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .replace(/[^A-Z]/g, "");

            if (rawGuess.length === 1 || rawGuess.length === 7) {
                if (sTest.tentatives >= 3) {
                    await message.reply("❌ Tu as épuisé tes 3 essais pour cette session test !");
                    return true;
                }

                sTest.tentatives++;
                const essaiNum = sTest.tentatives;
                const motComplet = sTest.mot;

                if (rawGuess.length === 7) {
                    if (rawGuess === motComplet) {
                        sTest.lettresTrouvees = [...new Set(motComplet.split(''))];
                    } else {
                        sTest.erreursCollectives++;
                    }
                } else if (rawGuess.length === 1) {
                    if (motComplet.includes(rawGuess)) {
                        if (!sTest.lettresTrouvees.includes(rawGuess)) sTest.lettresTrouvees.push(rawGuess);
                    } else {
                        if (!sTest.lettresFausses.includes(rawGuess)) sTest.lettresFausses.push(rawGuess);
                        sTest.erreursCollectives++;
                    }
                }

                const gagne = motComplet.split('').every(l => sTest.lettresTrouvees.includes(l));
                if (gagne) {
                    sTest.termine = true;
                    penduTestSessions.delete(message.channel.id);
                    await message.reply(`🎉 **[TEST RÉUSSI]** Bravo ! Le mot était bien **${motComplet}** (trouvé en ${essaiNum}/3 essai${essaiNum > 1 ? 's' : ''}) !`);
                    return true;
                }

                if (sTest.erreursCollectives >= 6) {
                    sTest.termine = true;
                    penduTestSessions.delete(message.channel.id);
                    await message.reply(`💀 **[TEST PERDU]** Pendu complet ! Le mot était **${motComplet}**.`);
                    return true;
                }

                const masqueActuel = buildMasqueMot(motComplet, sTest.lettresTrouvees);
                const potence = PENDU_DESSINS[Math.min(sTest.erreursCollectives, 6)];
                await message.reply(`\`${masqueActuel}\`\n${potence}\nErreurs : ${sTest.erreursCollectives}/6 *(Essai ${essaiNum}/3)*`);
                return true;
            }
        }
    }

    // 1. Détection des propositions de jeu dans le salon #minijeux
    if (message.channel.id === PENDU_CHANNEL_ID && !message.content.startsWith('!')) {
        if (session.mot && !session.termine && session.expireAt && now < session.expireAt) {
            const rawGuess = message.content.trim().toUpperCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .replace(/[^A-Z]/g, "");

            // Vérification si c'est une lettre individuelle OU un mot de 7 lettres
            if (rawGuess.length === 1 || rawGuess.length === 7) {
                if (!session.tentativesJoueurs[message.author.id]) {
                    session.tentativesJoueurs[message.author.id] = 0;
                }

                if (session.tentativesJoueurs[message.author.id] >= 3) {
                    await message.reply(`❌ <@${message.author.id}>, tu as déjà utilisé tes **3 essais** pour cette partie ! Laisse les autres tenter leur chance.`);
                    return true;
                }

                session.tentativesJoueurs[message.author.id]++;
                const essaiNum = session.tentativesJoueurs[message.author.id];

                // Initialisation stats
                if (!penduStats[message.author.id]) penduStats[message.author.id] = { victoires: 0, parties: 0, points: 0, hebdo: {} };
                if (essaiNum === 1) penduStats[message.author.id].parties++;

                let bonneProposition = false;
                const motComplet = session.mot;

                // Cas 1 : Le joueur propose le mot entier de 7 lettres
                if (rawGuess.length === 7) {
                    if (rawGuess === motComplet) {
                        bonneProposition = true;
                        session.lettresTrouvees = [...new Set(motComplet.split(''))];
                    } else {
                        session.erreursCollectives++;
                    }
                } 
                // Cas 2 : Le joueur propose une lettre individuelle
                else if (rawGuess.length === 1) {
                    if (motComplet.includes(rawGuess)) {
                        bonneProposition = true;
                        if (!session.lettresTrouvees.includes(rawGuess)) {
                            session.lettresTrouvees.push(rawGuess);
                        }
                    } else {
                        if (!session.lettresFausses.includes(rawGuess)) {
                            session.lettresFausses.push(rawGuess);
                        }
                        session.erreursCollectives++;
                    }
                }

                // Vérification de la victoire (mot complet deviné)
                const motEntierementTrouve = motComplet.split('').every(l => session.lettresTrouvees.includes(l));

                if (motEntierementTrouve) {
                    session.termine = true;
                    session.vainqueurId = message.author.id;
                    penduStats[message.author.id].victoires++;
                    penduStats[message.author.id].points += 3;

                    const weekKey = getPenduWeekKey();
                    if (!penduStats[message.author.id].hebdo) penduStats[message.author.id].hebdo = {};
                    penduStats[message.author.id].hebdo[weekKey] = (penduStats[message.author.id].hebdo[weekKey] || 0) + 3;

                    penduBridge.trackBattlePassProgress?.(message.author.id, 'minijeu_win', 1);
                    penduBridge.demanderSauvegarde();

                    const embedVictoire = new EmbedBuilder()
                        .setColor(0x2ecc71)
                        .setTitle('🎉 LE MOT A ÉTÉ DÉCOUVERT ! 🎉')
                        .setDescription(
                            `Félicitations à <@${message.author.id}> qui a trouvé le mot en **${essaiNum}/3 essai${essaiNum > 1 ? 's' : ''}** !\n\n` +
                            `🔤 **Le mot était bien :** \`${motComplet}\`\n` +
                            `⭐ **Points remportés :** +3 points au classement !\n` +
                            `🏆 **Total victoires Pendu :** **${penduStats[message.author.id].victoires}**`
                        )
                        .setFooter({ text: 'Rendez-vous demain soir à 21h00 pour le prochain Pendu !' });

                    const rowStats = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`pendu_view_stats_${message.author.id}`)
                            .setLabel('📊 Mes stats Pendu')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId(`pendu_view_hebdo_${message.author.id}`)
                            .setLabel('🏆 Classement Hebdomadaire')
                            .setStyle(ButtonStyle.Success)
                    );

                    await message.reply({ embeds: [embedVictoire], components: [rowStats] });
                    return true;
                }

                // Vérification de la défaite collective (6 erreurs atteintes)
                if (session.erreursCollectives >= 6) {
                    session.termine = true;
                    penduBridge.demanderSauvegarde();

                    const embedDefaite = new EmbedBuilder()
                        .setColor(0xe74c3c)
                        .setTitle('💀 LE PENDU EST MORT ! (Défaite collective)')
                        .setDescription(
                            `${PENDU_DESSINS[6]}\n` +
                            `Le nombre d'erreurs maximal a été atteint !\n\n` +
                            `🔤 **Le mot mystère était :** \`${motComplet}\`\n\n` +
                            `Rendez-vous demain soir à **21h00** pour prendre votre revanche !`
                        );

                    await message.channel.send({ embeds: [embedDefaite] });
                    return true;
                }

                // Réponse d'avancement
                const masqueActuel = buildMasqueMot(motComplet, session.lettresTrouvees);
                const infoMsg = bonneProposition 
                    ? `🟢 **Bien joué !** La lettre fait partie du mot : \`${masqueActuel}\` *(Essai ${essaiNum}/3)*`
                    : `🔴 **Raté !** Cette lettre n'est pas dans le mot... Erreurs : **${session.erreursCollectives}/6** *(Essai ${essaiNum}/3)*`;

                await message.reply(infoMsg);
                penduBridge.demanderSauvegarde();

                // Gestion du rappel automatique après 15 messages
                session.compteurMessages = (session.compteurMessages || 0) + 1;
                if (session.compteurMessages >= 15) {
                    session.compteurMessages = 0;
                    const embedRappel = buildPenduEmbed(session);
                    await message.channel.send({ content: '🔔 **Rappel du mot à deviner :**', embeds: [embedRappel] });
                }
                return true;
            }
        }
    }

    // 2. Commande principale !pendu
    const rawCmd = message.content.trim().toLowerCase();
    const command = rawCmd.split(/\s+/)[0];

    if (command === '!pendu') {
        const enCours = session.mot && !session.termine && session.expireAt && now < session.expireAt;

        if (enCours) {
            const embed = buildPenduEmbed(session);
            await message.reply({ content: '🪢 **Une partie de Pendu est actuellement EN COURS !**', embeds: [embed] });
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