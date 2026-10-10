/**
 * Module Battle Pass pour Cacabot (Regaïa)
 * Commandes : !bp, !pass, !battlepass et leurs équivalents Slash
 */

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const XP_PAR_NIVEAU = 500;
const NIVEAU_MAX = 25;

let bpBridge = {
    getBattlePassData: () => ({}),
    demanderSauvegarde: () => {},
    crediterInventaireRoulette: () => {},
    rouletteBouclierActif: null,
    rouletteRedirectCharges: null,
    EPSYS_ID: '436218312574107658'
};

function initBattlePassState(bridge) {
    bpBridge = { ...bpBridge, ...bridge };
}

// ==========================================
//  DÉFINITION DES QUÊTES
// ==========================================

const QUETES_QUOTIDIENNES_POOL = [
    // Faciles (50 XP)
    { id: 'salutations', tier: 'facile', xp: 50, desc: 'Envoyer au moins 10 messages sur le serveur', objectif: 10, type: 'message' },
    { id: 'appel_casino', tier: 'facile', xp: 50, desc: 'Faire 1 tirage de roulette (!rlt go)', objectif: 1, type: 'roulette_roll' },
    { id: 'coup_de_coeur', tier: 'facile', xp: 50, desc: 'Faire une interaction bienveillante (!kiss, !hug, !danse)', objectif: 1, type: 'interact_gentil' },
    { id: 'reglements_compte', tier: 'facile', xp: 50, desc: 'Faire une interaction de combat (!punch, !bang, !insult)', objectif: 1, type: 'interact_combat' },
    { id: 'oracle', tier: 'facile', xp: 50, desc: 'Consulter son horoscope ou son destin (!horoscope, !destin)', objectif: 1, type: 'oracle' },
    { id: 'archive', tier: 'facile', xp: 50, desc: 'Consulter une citation culte (!quote)', objectif: 1, type: 'quote' },

    // Moyennes (100 XP)
    { id: 'pipelette', tier: 'moyen', xp: 100, desc: 'Envoyer 35 messages sur le serveur', objectif: 35, type: 'message' },
    { id: 'creuse_meninges', tier: 'moyen', xp: 100, desc: 'Proposer 2 essais au Motus ou 1 essai au Rébus', objectif: 2, type: 'minijeu_essai' },
    { id: 'papote_vocal', tier: 'moyen', xp: 100, desc: 'Passer au moins 15 minutes en salon vocal', objectif: 15, type: 'vocal_min' },
    { id: 'double_dose', tier: 'moyen', xp: 100, desc: 'Faire 2 tirages d\'affilée pendant l\'Happy Hour (20h-21h)', objectif: 2, type: 'happy_hour_roll' },
    { id: 'papayou', tier: 'moyen', xp: 100, desc: 'Faire spawn le bonus PAPAYOU.mp3 à la roulette', objectif: 1, type: 'papayou' },

    // Défis / Trolls (150 XP)
    { id: 'guerrier_loose', tier: 'defi', xp: 150, desc: 'Subir un malus et poster 3 messages sous son effet', objectif: 3, type: 'malus_msg' },
    { id: 'casse_cou', tier: 'defi', xp: 150, desc: 'Bloquer 5 Feur de Cacabot avec le bouclier Anti-Feur', objectif: 5, type: 'feur_dodge' },
    { id: 'jailaref', tier: 'defi', xp: 150, desc: 'Utiliser !jailaref ou !palaref dans une discussion', objectif: 1, type: 'ref' },
    { id: 'devotion', tier: 'defi', xp: 150, desc: 'Envoyer un GIF (!epsys) ou un coup de pression (!bougetoi)', objectif: 1, type: 'epsys_cmd' },
    { id: 'intello', tier: 'defi', xp: 150, desc: 'Trouver la solution d\'une session de Motus ou Rébus', objectif: 1, type: 'minijeu_win' }
];

const QUETES_HEBDOMADAIRES_POOL = [
    { id: 'pilier_comptoir', xp: 350, desc: 'Envoyer un total de 200 messages dans la semaine', objectif: 200, type: 'message' },
    { id: 'habitudes_vocal', xp: 300, desc: 'Passer au moins 60 minutes cumulées en vocal', objectif: 60, type: 'vocal_min' },
    { id: 'semaine_studieuse', xp: 500, desc: 'Compléter ses 4 quotidiennes au moins 3 jours différents', objectif: 3, type: 'full_daily' },
    { id: 'accro_roulette', xp: 350, desc: 'Effectuer au moins 30 tirages de roulette', objectif: 30, type: 'roulette_roll' },
    { id: 'pare_epreuve', xp: 400, desc: 'Bloquer 10 malus grâce à un bouclier ou contre-poison', objectif: 10, type: 'malus_pare' },
    { id: 'regulier_hh', xp: 400, desc: 'Participer à l\'Happy Hour sur 3 jours distincts (20h-21h)', objectif: 3, type: 'hh_jours' },
    { id: 'assidu_enigmes', xp: 350, desc: 'Participer à au moins 5 sessions de mini-jeux', objectif: 5, type: 'minijeu_part' },
    { id: 'chasseur_gloire', xp: 450, desc: 'Remporter au moins 2 victoires (Motus ou Rébus)', objectif: 2, type: 'minijeu_win' },
    { id: 'grand_survivant', xp: 400, desc: 'Subir au moins 3 malus différents dans la semaine', objectif: 3, type: 'malus_diff' }
];

// Récompenses des 25 paliers
const RECOMPENSES_PALIERS = {
    1: { nom: '🎟️ Ticket Coupe-File (Skip Cooldown)', item: 'ticketSkip' },
    2: { nom: '🛡️ 1 Charge de Bouclier', item: 'bouclier_1' },
    3: { nom: '🍀 Trèfle de Chance (+20% Jackpot)', item: 'trefle20' },
    4: { nom: '🧹 Éponge à Malus (Annule un malus de texte)', item: 'eponge' },
    5: { nom: '🔰 PACK DÉFENSE (5 Boucliers)', item: 'bouclier_5', majeur: true },
    6: { nom: '🎟️ Ticket Coupe-File', item: 'ticketSkip' },
    7: { nom: '⚡ Pass Mini Happy-Hour (2 rolls à 5 min)', item: 'miniHH' },
    8: { nom: '🛡️ 1 Charge de Bouclier', item: 'bouclier_1' },
    9: { nom: '📈 Coup de pouce Pity (+1 malus/nul)', item: 'pityBoost' },
    10: { nom: '🎰 COUP TRIPLE (3 tirages gratuits)', item: 'coupTriple', majeur: true },
    11: { nom: '🎟️ Ticket Coupe-File', item: 'ticketSkip' },
    12: { nom: '🍀 Trèfle de Chance (+20% Jackpot)', item: 'trefle20' },
    13: { nom: '🛡️ 1 Charge de Bouclier', item: 'bouclier_1' },
    14: { nom: '🧹 Éponge à Malus', item: 'eponge' },
    15: { nom: '🎯 LE SNIPER (1 Redirection de malus au choix)', item: 'redirectChoix', majeur: true },
    16: { nom: '🎟️ Ticket Coupe-File', item: 'ticketSkip' },
    17: { nom: '⚡ Pass Mini Happy-Hour', item: 'miniHH' },
    18: { nom: '🛡️ 1 Charge de Bouclier', item: 'bouclier_1' },
    19: { nom: '📈 Coup de pouce Pity (+1)', item: 'pityBoost' },
    20: { nom: '✍️ GRAVÉ DANS LA ROCHE (Pseudo verrouillé 1 sem. au choix)', item: 'pseudoLockSemaine', majeur: true },
    21: { nom: '🎟️ Ticket Coupe-File', item: 'ticketSkip' },
    22: { nom: '🍀 Trèfle de Chance (+20% Jackpot)', item: 'trefle20' },
    23: { nom: '🛡️ 1 Charge de Bouclier', item: 'bouclier_1' },
    24: { nom: '🧹 Éponge à Malus', item: 'eponge' },
    25: { nom: '🏆 PALIER ULTIME SAISON 1 (Rôle + 1min Free Roll + Épingle + 3 Redirections)', item: 'palierUltime', majeur: true }
};

// ==========================================
//  HELPERS DE TEMPS & INITIALISATION
// ==========================================

function getTodayKey() {
    const d = new Date();
    const paris = new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    return `${paris.getFullYear()}-${String(paris.getMonth() + 1).padStart(2, '0')}-${String(paris.getDate()).padStart(2, '0')}`;
}

function getWeekKey() {
    const d = new Date();
    const paris = new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    const onejan = new Date(paris.getFullYear(), 0, 1);
    const week = Math.ceil((((paris.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);
    return `${paris.getFullYear()}-W${week}`;
}

function getMonthKey() {
    const d = new Date();
    const paris = new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    return `${paris.getFullYear()}-${String(paris.getMonth() + 1).padStart(2, '0')}`;
}

function tirerQuetesDuJour(seedStr) {
    const faciles = [...QUETES_QUOTIDIENNES_POOL.filter(q => q.tier === 'facile')].sort(() => Math.random() - 0.5);
    const moyens = [...QUETES_QUOTIDIENNES_POOL.filter(q => q.tier === 'moyen')].sort(() => Math.random() - 0.5);
    const defis = [...QUETES_QUOTIDIENNES_POOL.filter(q => q.tier === 'defi')].sort(() => Math.random() - 0.5);

    return [
        { ...faciles[0], progression: 0, terminee: false, reclamee: false },
        { ...faciles[1], progression: 0, terminee: false, reclamee: false },
        { ...moyens[0], progression: 0, terminee: false, reclamee: false },
        { ...defis[0], progression: 0, terminee: false, reclamee: false }
    ];
}

function tirerQuetesHebdo() {
    const hebdos = [...QUETES_HEBDOMADAIRES_POOL].sort(() => Math.random() - 0.5);
    return [
        { ...hebdos[0], progression: 0, terminee: false, reclamee: false },
        { ...hebdos[1], progression: 0, terminee: false, reclamee: false },
        { ...hebdos[2], progression: 0, terminee: false, reclamee: false }
    ];
}

function getOuCreerProfilBP(userId) {
    const bpData = bpBridge.getBattlePassData();
    const currentMonth = getMonthKey();
    const today = getTodayKey();
    const week = getWeekKey();

    if (!bpData.saison || bpData.mois !== currentMonth) {
        bpData.saison = bpData.saison ? bpData.saison + 1 : 1;
        bpData.mois = currentMonth;
        bpData.joueurs = {};
    }

    if (!bpData.joueurs) bpData.joueurs = {};

    let p = bpData.joueurs[userId];
    if (!p) {
        p = {
            niveau: 1,
            xp: 0,
            paliersReclames: [],
            streak: 0,
            dernierJourStreak: null,
            dernierJourDate: null,
            semaineActuelle: null,
            quetesDuJour: [],
            quetesHebdo: [],
            historiqueJoursQuetes: []
        };
        bpData.joueurs[userId] = p;
    }

    // Reset Quotidien
    if (p.dernierJourDate !== today) {
        // Vérification de rupture de série
        if (p.dernierJourDate) {
            const hier = new Date();
            hier.setDate(hier.getDate() - 1);
            const hierKey = `${hier.getFullYear()}-${String(hier.getMonth() + 1).padStart(2, '0')}-${String(hier.getDate()).padStart(2, '0')}`;
            if (p.dernierJourStreak !== hierKey && p.dernierJourStreak !== today) {
                p.streak = 0; // Série brisée
            }
        }
        p.dernierJourDate = today;
        p.quetesDuJour = tirerQuetesDuJour(today);
    }

    // Reset Hebdo
    if (p.semaineActuelle !== week) {
        p.semaineActuelle = week;
        p.quetesHebdo = tirerQuetesHebdo();
    }

    return p;
}

function getMultiplicateurStreak(streak) {
    if (streak >= 14) return 1.25;
    if (streak >= 7) return 1.15;
    if (streak >= 3) return 1.10;
    return 1.0;
}

// ==========================================
//  TRACKER CENTRAL D'ACTIVITÉ
// ==========================================

function trackBattlePassProgress(userId, type, amount = 1, meta = {}) {
    const p = getOuCreerProfilBP(userId);
    let modifie = false;

    // 1. Quotidiennes
    for (const q of p.quetesDuJour) {
        if (q.terminee) continue;
        if (q.type === type) {
            q.progression = Math.min(q.objectif, q.progression + amount);
            if (q.progression >= q.objectif) {
                q.terminee = true;
                // Validation du jour de streak dès qu'au moins 1 quête est finie !
                const today = getTodayKey();
                if (p.dernierJourStreak !== today) {
                    p.streak = (p.streak || 0) + 1;
                    p.dernierJourStreak = today;
                    checkStreakRewards(userId, p.streak);
                }
            }
            modifie = true;
        }
    }

    // 2. Hebdomadaires
    for (const q of p.quetesHebdo) {
        if (q.terminee) continue;
        if (q.type === type) {
            q.progression = Math.min(q.objectif, q.progression + amount);
            if (q.progression >= q.objectif) {
                q.terminee = true;
            }
            modifie = true;
        }
    }

    if (modifie) bpBridge.demanderSauvegarde();
}

function checkStreakRewards(userId, streak) {
    // Récompenses de streak de la Bible
    if (streak === 7) {
        bpBridge.crediterInventaireRoulette(userId, 'ticketSkip', 1);
    } else if (streak === 14) {
        bpBridge.crediterInventaireRoulette(userId, 'superBouclier', 2);
    } else if (streak === 21) {
        bpBridge.crediterInventaireRoulette(userId, 'redirectChoix5', 5);
    }
}

// ==========================================
//  VUES DISCORD (EMBEDS & MENUS)
// ==========================================

function buildBPHomeEmbed(membre) {
    const p = getOuCreerProfilBP(membre.id);
    const mult = getMultiplicateurStreak(p.streak);
    const multStr = mult > 1 ? ` (+${Math.round((mult - 1) * 100)}% d'XP)` : '';

    const nbQuetesFinies = p.quetesDuJour.filter(q => q.terminee && !q.reclamee).length +
                          p.quetesHebdo.filter(q => q.terminee && !q.reclamee).length;

    // Barre de progression XP
    const pct = Math.min(100, Math.round((p.xp / XP_PAR_NIVEAU) * 100));
    const nbVert = Math.round((pct / 100) * 10);
    const barre = '🟩'.repeat(nbVert) + '⬜'.repeat(10 - nbVert);

    const embed = new EmbedBuilder()
        .setColor(0xffd20a)
        .setTitle(`🎫 BATTLE PASS — SAISON ${bpBridge.getBattlePassData().saison || 1}`)
        .setDescription(
            `Bienvenue dans le Pass de Combat officiel de Regaïa !\nAccomplis tes quêtes, maintiens ta série quotidienne et débloque les 25 paliers du mois !\n\n` +
            `👤 **Membre :** <@${membre.id}>\n` +
            `⭐ **Niveau actuel :** **Niveau ${p.niveau}/${NIVEAU_MAX}**\n` +
            `📈 **Progression XP :** \`${barre}\` **${p.xp}/${XP_PAR_NIVEAU} XP** (${pct}%)\n` +
            `🔥 **Série actuelle :** **${p.streak} jour${p.streak > 1 ? 's' : ''} consécutif${p.streak > 1 ? 's' : ''}**${multStr}\n\n` +
            (nbQuetesFinies > 0 ? `🎁 **${nbQuetesFinies} quête(s) terminée(s) en attente d'XP !** Clique sur *Récupérer* !` : `*Aucune quête en attente.*`)
        )
        .addFields(
            { name: '🎯 Prochain Palier Majeur', value: getProchainPalierMajeurText(p.niveau), inline: false },
            { name: '📜 Esprit de Regaïa', value: '-# *Le staff rappelle que le pass récompense l\'activité naturelle. Les conversations artificielles ou de pur grind ne sont pas tolérées.*' }
        )
        .setFooter({ text: 'Commandes : !bp • Reset quotidien à 00h00' })
        .setThumbnail(membre.user.displayAvatarURL({ dynamic: true, size: 256 }));

    return embed;
}

function getProchainPalierMajeurText(niveau) {
    const majeurs = [5, 10, 15, 20, 25];
    const next = majeurs.find(n => n > niveau);
    if (!next) return '👑 **Palier Ultime atteint !** Félicitations pour avoir conquis la saison !';
    return `**Niveau ${next} :** ${RECOMPENSES_PALIERS[next].nom}`;
}

function buildBPQuestsEmbed(membre) {
    const p = getOuCreerProfilBP(membre.id);

    const quotidiennesLignes = p.quetesDuJour.map(q => {
        const icon = q.reclamee ? '☑️' : q.terminee ? '✅' : '⏳';
        return `${icon} **[${q.xp} XP] ${q.desc}**\n> Progression : \`${q.progression}/${q.objectif}\``;
    }).join('\n\n');

    const hebdosLignes = p.quetesHebdo.map(q => {
        const icon = q.reclamee ? '☑️' : q.terminee ? '✅' : '⏳';
        return `${icon} **[${q.xp} XP] ${q.desc}**\n> Progression : \`${q.progression}/${q.objectif}\``;
    }).join('\n\n');

    return new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle(`📋 QUÊTES DU PASS — ${membre.displayName}`)
        .addFields(
            { name: '☀️ QUÊTES QUOTIDIENNES (Reset à 00h00)', value: quotidiennesLignes || '*Aucune quête*', inline: false },
            { name: '📅 QUÊTES HEBDOMADAIRES (Reset lundi)', value: hebdosLignes || '*Aucune quête*', inline: false }
        )
        .setFooter({ text: 'Valide au moins 1 quotidienne pour conserver ton Streak !' });
}

function buildBPLadderEmbed(membre) {
    const p = getOuCreerProfilBP(membre.id);
    const lignes = [];

    lignes.push('🪜 **ÉCHELLE DE PROGRESSION DU BATTLE PASS** (Saison 1)\n');

    for (let niv = 1; niv <= NIVEAU_MAX; niv++) {
        const reco = RECOMPENSES_PALIERS[niv];
        const isMajeur = reco.majeur;
        const prefix = isMajeur ? '⭐' : '║ ';

        if (niv < p.niveau) {
            lignes.push(`   ${prefix} ✅ **Niv. ${niv}** — ${reco.nom}`);
        } else if (niv === p.niveau) {
            lignes.push(`\n   ╠══ 🎯 **[TU ES ICI] NIVEAU ${niv}** (${p.xp}/${XP_PAR_NIVEAU} XP) ══╣\n`);
            lignes.push(`   ${prefix} 🔒 **Niv. ${niv}** — ${reco.nom}`);
        } else {
            lignes.push(`   ${prefix} 🔒 **Niv. ${niv}** — ${reco.nom}`);
        }
    }

    return new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle(`🪜 Échelle des Paliers — ${membre.displayName}`)
        .setDescription(lignes.join('\n'))
        .setFooter({ text: 'Chaque niveau requiert 500 XP' });
}

function buildBPButtons(authorId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`bp_home_${authorId}`).setLabel('🏠 Accueil').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`bp_quests_${authorId}`).setLabel('📋 Mes Quêtes').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`bp_ladder_${authorId}`).setLabel('🪜 Paliers & Échelle').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`bp_claim_${authorId}`).setLabel('🎁 Récupérer').setStyle(ButtonStyle.Success)
    );
}

// ==========================================
//  LOGIQUE DE RÉCUPÉRATION (CLAIM)
// ==========================================

function reclamerRecompensesEtXP(membre) {
    const p = getOuCreerProfilBP(membre.id);
    const mult = getMultiplicateurStreak(p.streak);
    let xpGagne = 0;
    const quetesValidees = [];

    // 1. Claim Quotidiennes
    for (const q of p.quetesDuJour) {
        if (q.terminee && !q.reclamee) {
            q.reclamee = true;
            const xpReel = Math.round(q.xp * mult);
            xpGagne += xpReel;
            quetesValidees.push(`${q.desc} (+${xpReel} XP)`);
        }
    }

    // 2. Claim Hebdos
    for (const q of p.quetesHebdo) {
        if (q.terminee && !q.reclamee) {
            q.reclamee = true;
            const xpReel = Math.round(q.xp * mult);
            xpGagne += xpReel;
            quetesValidees.push(`${q.desc} (+${xpReel} XP)`);
        }
    }

    p.xp += xpGagne;
    const paliersDebloques = [];

    // Montée de niveau
    while (p.xp >= XP_PAR_NIVEAU && p.niveau < NIVEAU_MAX) {
        p.xp -= XP_PAR_NIVEAU;
        p.niveau++;
        p.paliersReclames.push(p.niveau);
        const reco = RECOMPENSES_PALIERS[p.niveau];
        if (reco) {
            paliersDebloques.push(`**Niveau ${p.niveau}** : ${reco.nom}`);
            attribuerRecompenseInventaire(membre.id, reco.item);
        }
    }

    if (p.niveau >= NIVEAU_MAX) {
        p.xp = XP_PAR_NIVEAU; // Cap max
    }

    bpBridge.demanderSauvegarde();
    return { xpGagne, quetesValidees, paliersDebloques };
}

function attribuerRecompenseInventaire(userId, itemKey) {
    if (itemKey === 'bouclier_1') {
        const total = (bpBridge.rouletteBouclierActif.get(userId) || 0) + 1;
        bpBridge.rouletteBouclierActif.set(userId, total);
    } else if (itemKey === 'bouclier_5') {
        const total = (bpBridge.rouletteBouclierActif.get(userId) || 0) + 5;
        bpBridge.rouletteBouclierActif.set(userId, total);
    } else if (itemKey === 'redirectChoix') {
        const total = (bpBridge.rouletteRedirectCharges.get(userId) || 0) + 1;
        bpBridge.rouletteRedirectCharges.set(userId, total);
    } else if (itemKey === 'palierUltime') {
        bpBridge.crediterInventaireRoulette(userId, 'freeRoll1Min', 1);
        bpBridge.crediterInventaireRoulette(userId, 'epingleSalon', 1);
        const total = (bpBridge.rouletteRedirectCharges.get(userId) || 0) + 3;
        bpBridge.rouletteRedirectCharges.set(userId, total);
    } else {
        bpBridge.crediterInventaireRoulette(userId, itemKey, 1);
    }
}

// =========================
//  HANDLERS MESSAGES & SLASH
// =========================

async function handleBattlePassMessage(message) {
    const raw = message.content.trim();
    const cmd = raw.split(/\s+/)[0].toLowerCase();

    if (['!bp', '!pass', '!battlepass'].includes(cmd)) {
        const embed = buildBPHomeEmbed(message.member);
        const row = buildBPButtons(message.author.id);
        await message.reply({ embeds: [embed], components: [row] });
        return true;
    }
    return false;
}

async function handleBattlePassSlash(interaction) {
    if (['bp', 'pass', 'battlepass'].includes(interaction.commandName)) {
        const embed = buildBPHomeEmbed(interaction.member);
        const row = buildBPButtons(interaction.user.id);
        await interaction.reply({ embeds: [embed], components: [row] });
        return true;
    }
    return false;
}

async function handleBattlePassInteraction(interaction) {
    const id = interaction.customId;
    if (!id || !id.startsWith('bp_')) return false;

    const [, action, authorId] = id.split('_');
    if (interaction.user.id !== authorId) {
        return interaction.reply({ content: "Ce n'est pas ton pass de combat 😌", ephemeral: true });
    }

    if (action === 'home') {
        await interaction.update({ embeds: [buildBPHomeEmbed(interaction.member)], components: [buildBPButtons(authorId)] });
        return true;
    }

    if (action === 'quests') {
        await interaction.update({ embeds: [buildBPQuestsEmbed(interaction.member)], components: [buildBPButtons(authorId)] });
        return true;
    }

    if (action === 'ladder') {
        await interaction.update({ embeds: [buildBPLadderEmbed(interaction.member)], components: [buildBPButtons(authorId)] });
        return true;
    }

    if (action === 'claim') {
        const res = reclamerRecompensesEtXP(interaction.member);
        if (res.xpGagne === 0) {
            return interaction.reply({ content: "⚠️ Tu n'as aucune quête complétée à réclamer pour l'instant !", ephemeral: true });
        }

        let desc = `🎉 **+${res.xpGagne} XP récupérés avec succès !**\n\n`;
        if (res.paliersDebloques.length > 0) {
            desc += `🏆 **NOUVEAUX PALIERS DÉVERROUILLÉS :**\n${res.paliersDebloques.join('\n')}\n*Tes récompenses ont été déposées dans ton inventaire (\`!rlt claim\`) !*\n\n`;
        }
        desc += `*Consulte tes stats à jour sur l'accueil !*`;

        await interaction.reply({ content: desc, ephemeral: true });
        await interaction.message.edit({ embeds: [buildBPHomeEmbed(interaction.member)], components: [buildBPButtons(authorId)] }).catch(() => {});
        return true;
    }

    return false;
}

module.exports = {
    initBattlePassState,
    trackBattlePassProgress,
    handleBattlePassMessage,
    handleBattlePassSlash,
    handleBattlePassInteraction
};