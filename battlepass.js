/**
 * Module Battle Pass pour Cacabot (Regaïa)
 * Commandes : !bp, !pass, !battlepass et leurs équivalents Slash
 */

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    StringSelectMenuBuilder,
    ButtonStyle
} = require('discord.js');

const XP_PAR_NIVEAU = 500;
const NIVEAU_MAX = 25;

let bpBridge = {
    client: null,
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
//  HELPERS DE TEMPS & PROFIL
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
            notifs: 'paliers', // 'paliers', 'niveaux', 'quetes', 'desactive'
            mpBloques: false
        };
        bpData.joueurs[userId] = p;
    }

    // Valeur par défaut pour les anciens profils
    if (!p.notifs) p.notifs = 'paliers';

    // Reset Quotidien
    if (p.dernierJourDate !== today) {
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
//  SYSTÈME DE NOTIFICATIONS PRIVÉES (MP)
// ==========================================

async function envoyerNotificationMP(userId, titre, description, forceTest = false) {
    const p = getOuCreerProfilBP(userId);
    if (!forceTest && p.notifs === 'desactive') return false;

    const client = bpBridge.client;
    if (!client) return false;

    try {
        const user = await client.users.fetch(userId).catch(() => null);
        if (!user) return false;

        const embed = new EmbedBuilder()
            .setColor(0xffd20a)
            .setTitle(titre)
            .setDescription(description)
            .addFields(
                { name: '⚙️ Tes notifications actuelles', value: getLibelleNotif(p.notifs), inline: false },
                { name: 'Conseil', value: '-# *Tu peux modifier tes alertes avec le menu déroulant ci-dessous à tout moment.*' }
            )
            .setFooter({ text: 'Battle Pass Regaïa • Cacabot' })
            .setTimestamp();

        const row = buildNotifSettingsRow(p.notifs);
        await user.send({ embeds: [embed], components: [row] });
        
        p.mpBloques = false; // Les MP passent bien !
        bpBridge.demanderSauvegarde();
        return true;
    } catch (err) {
        // Erreur 50007 : l'utilisateur a bloqué ses MP
        if (err.code === 50007) {
            p.mpBloques = true;
            bpBridge.demanderSauvegarde();
        }
        return false;
    }
}

function getLibelleNotif(val) {
    switch (val) {
        case 'quetes': return '🔔 À chaque quête terminée';
        case 'niveaux': return '⭐ À chaque niveau passé (Niv. 1 à 25)';
        case 'paliers': return '🏆 Uniquement aux Paliers Majeurs (Niv. 5, 10, 15, 20, 25)';
        case 'desactive': return '🔕 Désactivées';
        default: return '🏆 Paliers majeurs uniquement';
    }
}

function buildNotifSettingsRow(valeurActuelle) {
    const menu = new StringSelectMenuBuilder()
        .setCustomId('bp_notifs_select')
        .setPlaceholder('Modifier mes alertes MP...')
        .addOptions([
            { label: '📜 Toutes les quêtes', description: 'Reçois un MP dès qu\'une quête est validée', value: 'quetes', default: valeurActuelle === 'quetes' },
            { label: '⭐ Tous les niveaux', description: 'Reçois un MP à chaque niveau gagné', value: 'niveaux', default: valeurActuelle === 'niveaux' },
            { label: '🏆 Paliers majeurs', description: 'Reçois un MP aux niveaux 5, 10, 15, 20, 25', value: 'paliers', default: valeurActuelle === 'paliers' },
            { label: '🔕 Désactiver', description: 'Ne recevoir aucun MP', value: 'desactive', default: valeurActuelle === 'desactive' }
        ]);

    return new ActionRowBuilder().addComponents(menu);
}

// ==========================================
//  TRACKER CENTRAL D'ACTIVITÉ & AUTO-CLAIM
// ==========================================

function ajouterXpEtMonteeDeNiveau(userId, p, xpBrut, titreQuete) {
    const mult = getMultiplicateurStreak(p.streak);
    const xpGagne = Math.round(xpBrut * mult);
    p.xp += xpGagne;

    const paliersDebloques = [];
    while (p.xp >= XP_PAR_NIVEAU && p.niveau < NIVEAU_MAX) {
        p.xp -= XP_PAR_NIVEAU;
        p.niveau++;
        p.paliersReclames.push(p.niveau);
        const reco = RECOMPENSES_PALIERS[p.niveau];
        if (reco) {
            paliersDebloques.push(`**Niveau ${p.niveau}** : ${reco.nom}`);
            attribuerRecompenseInventaire(userId, reco.item);

            const doitEnvoyerMP = (p.notifs === 'niveaux') || (p.notifs === 'paliers' && reco.majeur);
            if (doitEnvoyerMP) {
                envoyerNotificationMP(
                    userId,
                    `🎉 NOUVEAU NIVEAU DÉVERROUILLÉ : NIVEAU ${p.niveau} !`,
                    `Félicitations ! Tu as franchi un palier du Pass de Combat !\n\n🎁 **Récompense :** ${reco.nom}\n*Déposée directement dans ton inventaire (\`!rlt claim\`) !*`
                );
            }
        }
    }

    if (p.niveau >= NIVEAU_MAX) {
        p.xp = XP_PAR_NIVEAU;
    }

    if (p.notifs === 'quetes') {
        let msg = `Tu as validé la quête : **${titreQuete}** (+${xpGagne} XP) !`;
        if (paliersDebloques.length > 0) {
            msg += `\n\n🏆 **Paliers débloqués :**\n${paliersDebloques.join('\n')}\n*Récompense(s) dans ton inventaire (\`!rlt claim\`) !*`;
        }
        envoyerNotificationMP(userId, '✅ QUÊTE VALIDÉE & XP CRÉDITÉ !', msg);
    }
}

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
                q.reclamee = true; // Réclamée automatiquement
                const today = getTodayKey();
                if (p.dernierJourStreak !== today) {
                    p.streak = (p.streak || 0) + 1;
                    p.dernierJourStreak = today;
                    checkStreakRewards(userId, p.streak);
                }
                ajouterXpEtMonteeDeNiveau(userId, p, q.xp, q.desc);
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
                q.reclamee = true; // Réclamée automatiquement
                ajouterXpEtMonteeDeNiveau(userId, p, q.xp, q.desc);
            }
            modifie = true;
        }
    }

    if (modifie) bpBridge.demanderSauvegarde();
}

function checkStreakRewards(userId, streak) {
    if (streak === 7) {
        bpBridge.crediterInventaireRoulette(userId, 'ticketSkip', 1);
        envoyerNotificationMP(userId, '🔥 1 SEMAINE DE STREAK !', 'Félicitations pour tes 7 jours consécutifs ! Tu reçois **1 Ticket Skip-Cooldown** offert dans ton inventaire !');
    } else if (streak === 14) {
        bpBridge.crediterInventaireRoulette(userId, 'superBouclier', 2);
        envoyerNotificationMP(userId, '🔥 2 SEMAINES DE STREAK !', 'Incroyable, 14 jours de suite ! Tu reçois **2 Super Boucliers** dans ton inventaire !');
    } else if (streak === 21) {
        bpBridge.crediterInventaireRoulette(userId, 'redirectChoix5', 5);
        envoyerNotificationMP(userId, '🔥 3 SEMAINES DE STREAK !', '21 jours d\'affilée ! Tu remportes **5 Redirections de malus au choix** (limité à 1 par jour) !');
    }
}

// ==========================================
//  VUES DISCORD (EMBEDS & MENUS)
// ==========================================

function buildBPHomeEmbed(membre) {
    const p = getOuCreerProfilBP(membre.id);
    const mult = getMultiplicateurStreak(p.streak);
    const multStr = mult > 1 ? ` *(+${Math.round((mult - 1) * 100)}% d'XP)*` : '';

    const pct = Math.min(100, Math.round((p.xp / XP_PAR_NIVEAU) * 100));
    const nbVert = Math.round((pct / 100) * 10);
    const barre = '🟩'.repeat(nbVert) + '⬜'.repeat(10 - nbVert);

    let desc = `### 🌟 Bienvenue dans le Pass de Combat de Regaïa !\n` +
               `Accomplis tes quêtes, maintiens ta série quotidienne et gravis les **25 paliers** du mois pour remporter des récompenses exclusives !\n\n` +
               `▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n\n` +
               `👤 **Membre :** <@${membre.id}>\n\n` +
               `⭐ **Niveau actuel :** **Niveau ${p.niveau}/${NIVEAU_MAX}**\n\n` +
               `📈 **Progression XP :** \`${barre}\` **${p.xp}/${XP_PAR_NIVEAU} XP**\n\n` +
               `🔥 **Série quotidienne :** **${p.streak} jour${p.streak > 1 ? 's' : ''} consécutif${p.streak > 1 ? 's' : ''}**${multStr}\n\n` +
               `▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n\n`;

    if (p.notifs !== 'desactive' && p.mpBloques) {
        desc += `⚠️ **Attention : Tes MP Discord sont fermés !**\n*Active l'option "Autoriser les messages privés" sur ce serveur pour recevoir tes alertes privées.*\n\n` +
                `▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n\n`;
    }

    const embed = new EmbedBuilder()
        .setColor(0xffd20a)
        .setTitle(`🎫 BATTLE PASS — SAISON ${bpBridge.getBattlePassData().saison || 1}`)
        .setDescription(desc)
        .addFields(
            { 
                name: '🎯 Prochain Palier Majeur', 
                value: `> ${getProchainPalierMajeurText(p.niveau)}\n\u200b`, 
                inline: false 
            },
            { 
                name: '🔔 Notifications privées (MP)', 
                value: `> Statut actuel : **${getLibelleNotif(p.notifs)}**\n> *(Modifiable avec le bouton ci-dessous)*`, 
                inline: false 
            }
        )
        .setFooter({ text: 'Fair-play exigé : le spam et le grind artificiel sont sanctionnés par le staff • Reset à 00h00' })
        .setThumbnail(membre.user.displayAvatarURL({ dynamic: true, size: 256 }));

    return embed;
}

function getProchainPalierMajeurText(niveau) {
    const majeurs = [5, 10, 15, 20, 25];
    const next = majeurs.find(n => n > niveau);
    if (!next) return '👑 **Palier Ultime atteint !** Tu as conquis la saison !';
    return `**Niveau ${next} :** ${RECOMPENSES_PALIERS[next].nom}`;
}

function buildBPQuestsEmbed(membre) {
    const p = getOuCreerProfilBP(membre.id);

    const quotidiennesLignes = p.quetesDuJour.map(q => {
        const icon = q.terminee ? '✅' : '⏳';
        return `${icon} **[${q.xp} XP] ${q.desc}**\n> Progression : \`${q.progression}/${q.objectif}\``;
    }).join('\n\n');

    const hebdosLignes = p.quetesHebdo.map(q => {
        const icon = q.terminee ? '✅' : '⏳';
        return `${icon} **[${q.xp} XP] ${q.desc}**\n> Progression : \`${q.progression}/${q.objectif}\``;
    }).join('\n\n');

    const desc = `# ☀️ QUÊTES QUOTIDIENNES\n` +
                 `*Réinitialisées chaque nuit à 00h00*\n\n` +
                 (quotidiennesLignes || '*Aucune quête active.*') +
                 `\n\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n\n` +
                 `# 📅 QUÊTES HEBDOMADAIRES\n` +
                 `*Réinitialisées chaque lundi*\n\n` +
                 (hebdosLignes || '*Aucune quête active.*');

    return new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle(`📋 QUÊTES DU PASS — ${membre.displayName}`)
        .setDescription(desc)
        .setFooter({ text: 'L\'XP est crédité automatiquement dès la validation d\'une quête !' });
}

function buildBPLadderEmbed(membre) {
    const p = getOuCreerProfilBP(membre.id);
    const lignes = [];

    lignes.push('### 🪜 ÉCHELLE DES RÉCOMPENSES — SAISON 1\n');

    for (let niv = NIVEAU_MAX; niv >= 1; niv--) {
        const reco = RECOMPENSES_PALIERS[niv];
        const isMajeur = reco.majeur;
        const estActuel = niv === p.niveau;
        const estPasse = niv < p.niveau;

        const check = estPasse ? '`[ ✓ ]`' : estActuel ? '`[ ▶ ]`' : '`[   ]`';

        if (isMajeur) {
            // Mise en valeur plus imposante pour les Paliers Majeurs
            const cadreActuel = estActuel ? ' 👉 **[TU ES ICI]**' : '';
            lignes.push(
                `\n⭐ **─── PALIER MAJEUR : NIVEAU ${niv} ───**${cadreActuel}\n` +
                `> ${check} **${reco.nom.toUpperCase()}**\n`
            );
        } else {
            if (estActuel) {
                lignes.push(`👉 🎯 **[NIV. ${String(niv).padStart(2, '0')}]** (${p.xp}/${XP_PAR_NIVEAU} XP) — ${reco.nom}`);
            } else {
                lignes.push(`${check} 🪜 **Niv. ${String(niv).padStart(2, '0')}** — ${reco.nom}`);
            }
        }
    }

    return new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle(`🪜 Échelle de Progression — ${membre.displayName}`)
        .setDescription(lignes.join('\n'))
        .setFooter({ text: '⭐ = Palier majeur (tous les 5 niveaux) • 500 XP par niveau' });
}

function buildBPRulesEmbed() {
    return new EmbedBuilder()
        .setColor(0xffd20a)
        .setTitle('📜 RÈGLES & FONCTIONNEMENT DU BATTLE PASS')
        .setDescription(
            `### 1. 🪜 Structure & Progression\n` +
            `• **Durée de saison :** 1 mois calendaire (reset complet des quêtes et des paliers le 1er de chaque mois à 00h00).\n` +
            `• **Progression linéaire :** 25 niveaux au total, coût fixe de **500 XP par niveau** (pas de courbe exponentielle).\n` +
            `• **Paliers Majeurs :** Niveaux **5, 10, 15, 20 et 25** débloquant des récompenses premium (Pack 5 Boucliers, Coup Triple, Sniper, Pseudo Verrouillé, Palier Ultime).\n\n` +
            `▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n\n` +
            `### 2. ☀️ Quêtes Quotidiennes (4 par jour)\n` +
            `• **Reset chaque nuit à 00h00 pile** (heure de Paris). Les quêtes non terminées expirent et ne se reportent pas.\n` +
            `• **Tirage équilibré :**\n` +
            `  - 🟢 **2 Faciles (50 XP)** : 10 messages, 1 roulette, 1 interaction bienveillante...\n` +
            `  - 🟡 **1 Moyenne (100 XP)** : 35 messages, 15 min en vocal, 2 essais mini-jeux...\n` +
            `  - 🔴 **1 Défi / Troll (150 XP)** : parler sous un malus, parer un Feur, résoudre une énigme...\n` +
            `• **Gain de base journalier :** **350 XP** (hors bonus de série).\n\n` +
            `▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n\n` +
            `### 3. 📅 Quêtes Hebdomadaires (3 par semaine)\n` +
            `• **Reset chaque lundi à 00h00.**\n` +
            `• **Objectifs d'endurance :** Rapportent entre **300 et 500 XP** chacune (200 messages, 60 min vocal, 30 tirages roulette, 2 victoires mini-jeux...).\n\n` +
            `▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n\n` +
            `### 4. 🔥 Séries Quotidiennes (Streaks) & Multiplicateurs\n` +
            `• **Maintien du Streak :** Valider au moins **1 quête quotidienne** dans la journée.\n` +
            `• **Pénalité :** Si un jour est sauté, la série retombe immédiatement à **0**.\n` +
            `• **Multiplicateurs d'XP passifs sur toutes les quêtes :**\n` +
            `  - 3 jours consécutifs : **+10% d'XP** (x1.10)\n` +
            `  - 7 jours consécutifs : **+15% d'XP** (x1.15)\n` +
            `  - 14 jours consécutifs : **+25% d'XP** (x1.25)\n` +
            `• **Bonus de palier de série offerts dans l'inventaire :**\n` +
            `  - **7 jours** : 1 Ticket Coupe-File (Skip Cooldown)\n` +
            `  - **14 jours** : 2 Super Boucliers\n` +
            `  - **21 jours** : 5 Redirections de malus au choix\n\n` +
            `▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n\n` +
            `### 5. ⚡ XP Automatique & Inventaire\n` +
            `• L'XP est injecté **automatiquement** dès qu'une quête est complétée.\n` +
            `• Le bonus de streak s'applique en temps réel, les niveaux se franchissent et les objets sont instantanément déposés dans l'inventaire Roulette (\`!rlt claim\`).\n\n` +
            `▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n\n` +
            `### 6. 🔕 Politique Anti-Spam (100% MP)\n` +
            `• Le bot n'envoie **JAMAIS** de notification de quête ou de niveau sur les salons publics.\n` +
            `• 4 réglages au choix via le bouton **🔔 Notifications MP** : Toutes les quêtes, Tous les niveaux, Paliers majeurs uniquement (défaut) ou Désactivé.\n` +
            `• Si tes MP sont fermés, l'erreur est absorbée silencieusement sans polluer les salons.\n\n` +
            `▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n\n` +
            `### 🚨 7. FAIR-PLAY & ESPRIT DU SERVEUR (STRICT) 🚨\n` +
            `⚠️ **Le Pass de Combat récompense l'activité naturelle, vivante et chaleureuse sur Regaïa.**\n` +
            `**Le flood artificiel, le monologue, le spam de commandes ou le grind forcé pour monter le pass sont STRICTEMENT INTERDITS et sanctionnables par le staff (réinitialisation du pass, mutes, voire exclusions).**`
        )
        .setFooter({ text: 'Règlement Officiel • Battle Pass Regaïa' });
}

function buildBPButtons(authorId) {
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`bp_home_${authorId}`).setLabel('🏠 Accueil').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`bp_quests_${authorId}`).setLabel('📋 Mes Quêtes').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`bp_ladder_${authorId}`).setLabel('🪜 Paliers').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`bp_rules_${authorId}`).setLabel('📜 Règles').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`bp_notifs_${authorId}`).setLabel('🔔 Notifications MP').setStyle(ButtonStyle.Secondary)
    );

    return [row];
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

            // Notification MP si configurée
            const doitEnvoyerMP = (p.notifs === 'niveaux') || (p.notifs === 'paliers' && reco.majeur);
            if (doitEnvoyerMP) {
                envoyerNotificationMP(
                    membre.id,
                    `🎉 NOUVEAU NIVEAU DÉVERROUILLÉ : NIVEAU ${p.niveau} !`,
                    `Félicitations ! Tu as franchi un palier du Pass de Combat !\n\n🎁 **Récompense :** ${reco.nom}\n*Déposée directement dans ton inventaire (\`!rlt claim\`) !*`
                );
            }
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
        const rows = buildBPButtons(message.author.id);
        await message.reply({ embeds: [embed], components: rows });
        return true;
    }
    return false;
}

async function handleBattlePassSlash(interaction) {
    if (['bp', 'pass', 'battlepass'].includes(interaction.commandName)) {
        const embed = buildBPHomeEmbed(interaction.member);
        const rows = buildBPButtons(interaction.user.id);
        await interaction.reply({ embeds: [embed], components: rows });
        return true;
    }
    return false;
}

async function handleBattlePassInteraction(interaction) {
    const id = interaction.customId;
    if (!id) return false;

    // 1. Menu déroulant des notifications (en MP ou sur le serveur)
    if (id === 'bp_notifs_select') {
        const p = getOuCreerProfilBP(interaction.user.id);
        const choix = interaction.values[0];
        p.notifs = choix;
        bpBridge.demanderSauvegarde();

        if (choix === 'desactive') {
            await interaction.reply({ content: '🔕 **Notifications MP désactivées !** Tu ne recevras plus de message privé de Cacabot.', ephemeral: true });
            return true;
        }

        // Test d'envoi immédiat pour vérifier que les MPs ne sont pas fermés
        const testOk = await envoyerNotificationMP(
            interaction.user.id,
            '🔔 TEST DE NOTIFICATION BATTLE PASS',
            `Tes préférences ont été mises à jour sur : **${getLibelleNotif(choix)}** !\nCe message confirme que tes MP Discord sont bien ouverts.`,
            true
        );

        if (!testOk) {
            await interaction.reply({
                content: `⚠️ **T'as fermé tes MP de la part des membres du serveur, je peux rien t'envoyer !**\nOuvre d'abord tes messages privés dans tes paramètres Discord si tu veux recevoir tes alertes 😉`,
                ephemeral: true
            });
        } else {
            await interaction.reply({
                content: `✅ **Préférences enregistrées !** Je viens de t'envoyer un message privé de test pour confirmer.`,
                ephemeral: true
            });
        }
        return true;
    }

    if (!id.startsWith('bp_')) return false;

    const [, action, authorId] = id.split('_');
    if (interaction.user.id !== authorId) {
        return interaction.reply({ content: "Ce n'est pas ton pass de combat 😌", ephemeral: true });
    }

    if (action === 'home') {
        await interaction.update({ embeds: [buildBPHomeEmbed(interaction.member)], components: buildBPButtons(authorId) });
        return true;
    }

    if (action === 'quests') {
        await interaction.update({ embeds: [buildBPQuestsEmbed(interaction.member)], components: buildBPButtons(authorId) });
        return true;
    }

    if (action === 'ladder') {
        await interaction.update({ embeds: [buildBPLadderEmbed(interaction.member)], components: buildBPButtons(authorId) });
        return true;
    }

    if (action === 'rules') {
        await interaction.update({ embeds: [buildBPRulesEmbed()], components: buildBPButtons(authorId) });
        return true;
    }

    if (action === 'notifs') {
        const p = getOuCreerProfilBP(interaction.user.id);
        const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle('⚙️ Paramètres des Notifications Privées (MP)')
            .setDescription(
                `Choisis quand tu souhaites que Cacabot t'envoie un message privé pour ton Battle Pass !\n\n` +
                `• **Statut actuel :** **${getLibelleNotif(p.notifs)}**\n` +
                (p.mpBloques ? `\n⚠️ *Tes MP Discord semblent fermés aux membres du serveur.*` : '')
            )
            .setFooter({ text: 'Sélectionne une option dans le menu ci-dessous' });

        const rowMenu = buildNotifSettingsRow(p.notifs);
        await interaction.reply({ embeds: [embed], components: [rowMenu], ephemeral: true });
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