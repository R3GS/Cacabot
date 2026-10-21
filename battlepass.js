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
    // ==========================================
    //  TIER 1 : FACILES (50 XP)
    // ==========================================
    { id: 'petit_coucou', tier: 'facile', xp: 50, desc: 'Envoyer au moins 10 messages naturels sur le serveur', objectif: 10, type: 'message' },
    { id: 'lancer_des', tier: 'facile', xp: 50, desc: 'Faire son 1er tirage de roulette de la journée (!rlt go)', objectif: 1, type: 'roulette_roll' },
    { id: 'double_jet', tier: 'facile', xp: 50, desc: 'Effectuer 2 tirages de roulette dans la journée', objectif: 2, type: 'roulette_roll' },
    { id: 'papotage_rapide', tier: 'facile', xp: 50, desc: 'Discuter au moins 5 minutes en salon vocal avec du monde', objectif: 5, type: 'vocal_min' },
    { id: 'citoyen_engage', tier: 'facile', xp: 50, desc: 'Voter sur une suggestion active dans #suggestions', objectif: 1, type: 'sugg_vote' },
    { id: 'noctambule_matinal', tier: 'facile', xp: 50, desc: 'Poster un message entre 00h et 08h du matin', objectif: 1, type: 'message_nuit' },
    { id: 'pause_midi', tier: 'facile', xp: 50, desc: 'Envoyer au moins 3 messages entre 12h et 14h', objectif: 3, type: 'message_midi' },
    { id: 'curieux_stats', tier: 'facile', xp: 50, desc: 'Consulter son état ou ses malus roulette (!rlt state)', objectif: 1, type: 'rlt_state' },
    { id: 'tour_salons', tier: 'facile', xp: 50, desc: 'Parler dans au moins 2 salons textuels différents', objectif: 2, type: 'salons_diff' },
    { id: 'assiduite_soir', tier: 'facile', xp: 50, desc: 'Participer à une discussion après 19h', objectif: 3, type: 'message_soir' },
    { id: 'client_casino', tier: 'facile', xp: 50, desc: 'Faire un tirage de roulette sans aucun bonus ni malus actif', objectif: 1, type: 'roulette_neutre' },
    { id: 'garder_rythme', tier: 'facile', xp: 50, desc: 'Envoyer des messages à au moins 2 heures d\'intervalle', objectif: 2, type: 'heures_diff' },
    { id: 'decouverte_inventaire', tier: 'facile', xp: 50, desc: 'Consulter son inventaire de récompenses (!rlt claim)', objectif: 1, type: 'rlt_claim_check' },
    { id: 'tirage_matinal', tier: 'facile', xp: 50, desc: 'Faire un tirage de roulette avant midi', objectif: 1, type: 'roulette_matin' },
    { id: 'debut_soiree', tier: 'facile', xp: 50, desc: 'Envoyer au moins 5 messages entre 18h et 20h', objectif: 5, type: 'message_soir_debut' },
    { id: 'reaction_commu', tier: 'facile', xp: 50, desc: 'Réagir avec un emoji sous les messages de 3 membres', objectif: 3, type: 'reaction_add' },
    { id: 'coup_essai_motus', tier: 'facile', xp: 50, desc: 'Proposer 1 mot au Motus du matin (10h) ou du soir (19h)', objectif: 1, type: 'minijeu_essai' },
    { id: 'premiere_lettre', tier: 'facile', xp: 50, desc: 'Proposer au moins une lettre lors d\'une session de Pendu (21h)', objectif: 1, type: 'pendu_essai' },
    { id: 'pendu_express', tier: 'facile', xp: 50, desc: 'Être le premier joueur à proposer une lettre après le lancement de 21h00', objectif: 1, type: 'pendu_premier' },

    // ==========================================
    //  TIER 2 : MOYENNES (100 XP)
    // ==========================================
    { id: 'habitue_comptoir', tier: 'moyen', xp: 100, desc: 'Envoyer au moins 35 messages sur le serveur dans la journée', objectif: 35, type: 'message' },
    { id: 'soiree_posee_vocal', tier: 'moyen', xp: 100, desc: 'Passer au moins 20 minutes cumulées en salon vocal avec du monde', objectif: 20, type: 'vocal_min' },
    { id: 'heure_de_pointe', tier: 'moyen', xp: 100, desc: 'Faire au moins 1 tirage pendant l\'Happy Hour (20h - 21h)', objectif: 1, type: 'happy_hour_roll' },
    { id: 'double_happy_hour', tier: 'moyen', xp: 100, desc: 'Faire 2 tirages de roulette pendant l\'Happy Hour (20h - 21h)', objectif: 2, type: 'happy_hour_roll' },
    { id: 'remue_meninges', tier: 'moyen', xp: 100, desc: 'Proposer au moins 2 essais valides au Motus (10h ou 19h)', objectif: 2, type: 'minijeu_essai' },
    { id: 'rdv_rebus', tier: 'moyen', xp: 100, desc: 'Participer au Rébus Regaïen de 15h00 (au moins 1 tentative)', objectif: 1, type: 'rebus_part' },
    { id: 'conso_inventaire', tier: 'moyen', xp: 100, desc: 'Activer un objet depuis son inventaire de roulette (!rlt claim)', objectif: 1, type: 'item_consomme' },
    { id: 'chasseur_bonus', tier: 'moyen', xp: 100, desc: 'Décrocher un bonus à la roulette (hors résultat nul ou malus)', objectif: 1, type: 'bonus_gagne' },
    { id: 'perseverance_casino', tier: 'moyen', xp: 100, desc: 'Effectuer au moins 4 tirages de roulette dans la journée', objectif: 4, type: 'roulette_roll' },
    { id: 'bouclier_pret', tier: 'moyen', xp: 100, desc: 'Posséder au moins 1 charge de bouclier active dans son état', objectif: 1, type: 'bouclier_actif' },
    { id: 'discussion_active', tier: 'moyen', xp: 100, desc: 'Envoyer au moins 15 messages dans un même salon textuel', objectif: 15, type: 'message_salon_unique' },
    { id: 'fidele_poste', tier: 'moyen', xp: 100, desc: 'Continuer à discuter alors qu\'on a un cooldown roulette actif', objectif: 5, type: 'msg_sous_cooldown' },
    { id: 'noctambule_vocal', tier: 'moyen', xp: 100, desc: 'Passer au moins 15 minutes en salon vocal après 22h', objectif: 15, type: 'vocal_nuit' },
    { id: 'vocal_bande', tier: 'moyen', xp: 100, desc: 'Être en salon vocal avec au moins 3 personnes réunies', objectif: 10, type: 'vocal_groupe' },
    { id: 'double_service_motus', tier: 'moyen', xp: 100, desc: 'Participer à la fois au Motus de 10h et à celui de 19h', objectif: 2, type: 'motus_double_session' },
    { id: 'devoir_civique', tier: 'moyen', xp: 100, desc: 'Participer à un Vote Public sur la roulette (voter ✅ ou ❌)', objectif: 1, type: 'vote_public_part' },
    { id: 'defenseur_pare', tier: 'moyen', xp: 100, desc: 'Bloquer un malus de roulette grâce à un bouclier actif', objectif: 1, type: 'malus_pare' },
    { id: 'mot_mystere', tier: 'moyen', xp: 100, desc: 'Proposer au moins 3 lettres ou mots au cours d\'une session de Pendu', objectif: 3, type: 'pendu_essai' },

    // ==========================================
    //  TIER 3 : DÉFIS & TROLLS (150 XP)
    // ==========================================
    { id: 'guerrier_loose', tier: 'defi', xp: 150, desc: 'Subir un malus de texte et envoyer au moins 3 messages sous son effet', objectif: 3, type: 'malus_msg' },
    { id: 'victime_exemplaire', tier: 'defi', xp: 150, desc: 'Subir un mute roulette et revenir discuter dès la fin du mute', objectif: 1, type: 'mute_survecu' },
    { id: 'survivant_malus', tier: 'defi', xp: 150, desc: 'Envoyer au moins 10 messages tout en ayant un malus roulette actif', objectif: 10, type: 'malus_msg' },
    { id: 'cerveau_or_motus', tier: 'defi', xp: 150, desc: 'Être le/la premier.e à trouver le mot du jour au Motus', objectif: 1, type: 'motus_win' },
    { id: 'dechiffreur_rebus', tier: 'defi', xp: 150, desc: 'Trouver la solution d\'une manche au Rébus Regaïen de 15h', objectif: 1, type: 'rebus_win' },
    { id: 'plein_happy_hour', tier: 'defi', xp: 150, desc: 'Faire au moins 3 tirages pendant l\'Happy Hour (20h - 21h)', objectif: 3, type: 'happy_hour_roll' },
    { id: 'pity_activee', tier: 'defi', xp: 150, desc: 'Décrocher un bonus garanti grâce au système de Pity', objectif: 1, type: 'pity_win' },
    { id: 'chimiste_herbe', tier: 'defi', xp: 150, desc: 'Annuler un malus actif via la mécanique de contre-poison', objectif: 1, type: 'contre_poison' },
    { id: 'marathonien_vocal', tier: 'defi', xp: 150, desc: 'Passer au moins 45 minutes cumulées en salon vocal dans la journée', objectif: 45, type: 'vocal_min' },
    { id: 'grand_bavard', tier: 'defi', xp: 150, desc: 'Dépasser les 75 messages envoyés sur le serveur en une seule journée', objectif: 75, type: 'message' },
    { id: 'couronne_tete', tier: 'defi', xp: 150, desc: 'Décrocher le bonus de la Couronne ou parler sous son effet', objectif: 5, type: 'couronne_msg' },
    { id: 'jackpot_en_vue', tier: 'defi', xp: 150, desc: 'Monter son boost Jackpot roulette accumulé à +20% ou plus', objectif: 1, type: 'jackpot_haut' },
    { id: 'haute_tension', tier: 'defi', xp: 150, desc: 'Lancer un tirage de roulette en ayant déjà 2 malus cumulés', objectif: 1, type: 'roll_sous_malus_cumules' },
    { id: 'coup_de_genie', tier: 'defi', xp: 150, desc: 'Obtenir un bonus très rare (probabilité ≤ 1%) à la roulette', objectif: 1, type: 'bonus_rare' },
    { id: 'sauve_par_gong', tier: 'defi', xp: 150, desc: 'Utiliser une Éponge à malus ou un Ticket Coupe-File de son inventaire', objectif: 1, type: 'skip_ou_eponge' },
    { id: 'session_casino_totale', tier: 'defi', xp: 150, desc: 'Effectuer au moins 6 tirages de roulette sur l\'ensemble de la journée', objectif: 6, type: 'roulette_roll' },
    { id: 'vise_juste', tier: 'defi', xp: 150, desc: 'Trouver au moins 2 bonnes lettres différentes au cours d\'une session de Pendu', objectif: 2, type: 'pendu_bonne_lettre' }
];

const QUETES_HEBDOMADAIRES_POOL = [
    // ==========================================
    //  1. ACTIVITÉ & PRÉSENCE TEXTUELLE
    // ==========================================
    { id: 'pilier_salon', xp: 350, desc: 'Envoyer au moins 200 messages sur le serveur au cours de la semaine', objectif: 200, type: 'message' },
    { id: 'grand_bavard_hebdo', xp: 450, desc: 'Dépasser les 350 messages textuels sur l\'ensemble de la semaine', objectif: 350, type: 'message' },
    { id: 'fidelite_poste', xp: 400, desc: 'Envoyer des messages au moins 5 jours distincts dans la semaine', objectif: 5, type: 'message_jours' },
    { id: 'semaine_complete', xp: 500, desc: 'Être actif.ve et présent.e dans les salons 6 jours différents sur 7', objectif: 6, type: 'message_jours' },
    { id: 'regularite_exemplaire', xp: 350, desc: 'Poster au moins 15 messages par jour sur 4 jours différents', objectif: 4, type: 'message_regulier' },
    { id: 'habitue_soirees', xp: 400, desc: 'Envoyer au moins 60 messages en soirée (après 20h) sur la semaine', objectif: 60, type: 'message_soir' },
    { id: 'esprit_groupe', xp: 350, desc: 'Participer à des discussions dans au moins 4 salons textuels différents', objectif: 4, type: 'salons_diff_hebdo' },
    { id: 'weekend_anime', xp: 350, desc: 'Envoyer au moins 50 messages cumulés entre le samedi et le dimanche', objectif: 50, type: 'message_weekend' },
    { id: 'leve_tot_assidu', xp: 350, desc: 'Participer au chat matinal (avant 10h) sur au moins 3 jours différents', objectif: 3, type: 'message_matin_jours' },
    { id: 'debatteur_regulier', xp: 400, desc: 'Envoyer au moins 25 messages dans un même salon sur 3 jours distincts', objectif: 3, type: 'debatteur_jours' },
    { id: 'garde_nuit', xp: 350, desc: 'Participer aux discussions nocturnes (après minuit) sur 3 nuits différentes', objectif: 3, type: 'message_nuit_jours' },

    // ==========================================
    //  2. ENDURANCE VOCALE & SALONS VOCAUX
    // ==========================================
    { id: 'habitue_micro', xp: 350, desc: 'Passer au moins 60 minutes cumulées en salon vocal sur la semaine', objectif: 60, type: 'vocal_min' },
    { id: 'resident_vocal', xp: 450, desc: 'Cumuler au moins 120 minutes (2 heures) en salon vocal sur la semaine', objectif: 120, type: 'vocal_min' },
    { id: 'marathonien_vocal_hebdo', xp: 500, desc: 'Cumuler au moins 180 minutes (3 heures) en salon vocal avec du monde', objectif: 180, type: 'vocal_min' },
    { id: 'regulier_vocal', xp: 400, desc: 'Discuter en salon vocal sur au moins 3 jours différents de la semaine', objectif: 3, type: 'vocal_jours' },
    { id: 'assidu_voix', xp: 450, desc: 'Passer au moins 20 minutes en vocal sur 4 jours distincts', objectif: 4, type: 'vocal_jours_20' },
    { id: 'session_long_cours', xp: 350, desc: 'Participer à une session vocale d\'au moins 45 minutes d\'affilée', objectif: 1, type: 'vocal_session_longue' },
    { id: 'noctambule_vocal_hebdo', xp: 400, desc: 'Passer au moins 40 minutes cumulées en vocal après 22h dans la semaine', objectif: 40, type: 'vocal_nuit' },
    { id: 'bande_complet', xp: 400, desc: 'Participer à un vocal réunissant au moins 3 membres sur 2 sessions', objectif: 2, type: 'vocal_groupe' },
    { id: 'weekend_vocal', xp: 350, desc: 'Passer au moins 60 minutes en salon vocal entre samedi et dimanche', objectif: 60, type: 'vocal_weekend' },
    { id: 'vocal_aprem', xp: 300, desc: 'Passer au moins 30 minutes en vocal entre 14h et 18h sur la semaine', objectif: 30, type: 'vocal_aprem' },

    // ==========================================
    //  3. ASSIDUITÉ DU BATTLE PASS & STREAKS
    // ==========================================
    { id: 'travailleur_acharne', xp: 350, desc: 'Valider au moins 10 quêtes quotidiennes au cours de la semaine', objectif: 10, type: 'quetes_daily_validees' },
    { id: 'chasseur_quetes', xp: 450, desc: 'Valider au moins 16 quêtes quotidiennes au cours de la semaine', objectif: 16, type: 'quetes_daily_validees' },
    { id: 'double_grand_chelem', xp: 400, desc: 'Compléter l\'intégralité de ses 4 quotidiennes au moins 2 jours différents', objectif: 2, type: 'full_daily' },
    { id: 'semaine_studieuse', xp: 500, desc: 'Réaliser le Grand Chelem (4/4 quotidiennes) sur au moins 3 jours différents', objectif: 3, type: 'full_daily' },
    { id: 'infaillible', xp: 500, desc: 'Maintenir sa série quotidienne (streak) active pendant les 7 jours de la semaine', objectif: 7, type: 'streak_hebdo' },
    { id: 'objectif_constance', xp: 350, desc: 'Valider au moins 1 quête quotidienne chaque jour pendant 5 jours consécutifs', objectif: 5, type: 'streak_hebdo_5' },

    // ==========================================
    //  4. CASINO, ROULETTE & HAPPY HOUR
    // ==========================================
    { id: 'client_fidele', xp: 350, desc: 'Effectuer au moins 25 tirages de roulette sur l\'ensemble de la semaine', objectif: 25, type: 'roulette_roll' },
    { id: 'accro_roulette', xp: 450, desc: 'Effectuer au moins 40 tirages de roulette dans la semaine', objectif: 40, type: 'roulette_roll' },
    { id: 'casino_maison', xp: 500, desc: 'Atteindre un total de 60 tirages de roulette sur la semaine', objectif: 60, type: 'roulette_roll' },
    { id: 'rdv_20h', xp: 400, desc: 'Participer à l\'Happy Hour (20h - 21h) sur au moins 3 soirs distincts', objectif: 3, type: 'hh_jours' },
    { id: 'inconditionnel_hh', xp: 500, desc: 'Participer à l\'Happy Hour sur au moins 4 soirs distincts', objectif: 4, type: 'hh_jours' },
    { id: 'specialiste_5min', xp: 400, desc: 'Réaliser au moins 8 tirages cumulés pendant les Happy Hours de la semaine', objectif: 8, type: 'happy_hour_roll' },
    { id: 'pare_toute_epreuve', xp: 400, desc: 'Bloquer au moins 5 malus grâce à des boucliers au cours de la semaine', objectif: 5, type: 'malus_pare' },
    { id: 'muraille_impenetrable', xp: 500, desc: 'Bloquer au moins 8 malus grâce à des boucliers dans la semaine', objectif: 8, type: 'malus_pare' },
    { id: 'grand_survivant_hebdo', xp: 400, desc: 'Subir au moins 3 malus textuels différents sur la semaine', objectif: 3, type: 'malus_diff' },
    { id: 'victime_heroique', xp: 450, desc: 'Subir au moins 6 malus de roulette au cours de la semaine', objectif: 6, type: 'malus_subis' },
    { id: 'chance_tourne', xp: 400, desc: 'Déclencher le bonus garanti de la Pity au moins 2 fois dans la semaine', objectif: 2, type: 'pity_win' },
    { id: 'gestionnaire_inventaire', xp: 350, desc: 'Utiliser au moins 3 objets de son inventaire roulette (!rlt claim)', objectif: 3, type: 'item_consomme' },
    { id: 'collectionneur_bonus', xp: 400, desc: 'Décrocher au moins 4 bonus différents à la roulette dans la semaine', objectif: 4, type: 'bonus_diff' },
    { id: 'voie_royale', xp: 400, desc: 'Participer à au moins 2 votes publics déclenchés sur la roulette dans la semaine', objectif: 2, type: 'vote_public_part' },

    // ==========================================
    //  5. MINI-JEUX : MOTUS & RÉBUS REGAÏEN
    // ==========================================
    { id: 'assidu_dictionnaire', xp: 350, desc: 'Proposer au moins 10 essais valides au Motus au cours de la semaine', objectif: 10, type: 'minijeu_essai' },
    { id: 'expert_lettres', xp: 450, desc: 'Proposer au moins 20 essais valides au Motus dans la semaine', objectif: 20, type: 'minijeu_essai' },
    { id: 'presence_deux_services', xp: 400, desc: 'Participer aux deux sessions Motus (10h et 19h) sur 3 jours différents', objectif: 3, type: 'motus_double_session' },
    { id: 'vainqueur_motus', xp: 450, desc: 'Être le/la premier.e à trouver le mot du jour au moins 1 fois dans la semaine', objectif: 1, type: 'motus_win' },
    { id: 'maitre_mots', xp: 500, desc: 'Remporter au moins 2 victoires au Motus dans la semaine', objectif: 2, type: 'motus_win' },
    { id: 'fidele_15h', xp: 350, desc: 'Participer au Rébus Regaïen de 15h sur au moins 3 jours différents', objectif: 3, type: 'rebus_jours' },
    { id: 'dechiffreur_regulier', xp: 450, desc: 'Remporter au moins 2 manches de Rébus Regaïen dans la semaine', objectif: 2, type: 'rebus_win' },
    { id: 'chasseur_gloire_hebdo', xp: 500, desc: 'Remporter au moins 3 victoires cumulées (Motus ou manches de Rébus)', objectif: 3, type: 'minijeu_win' },
    { id: 'omnipresent_enigmes', xp: 450, desc: 'Participer au Motus ET au Rébus sur au moins 3 jours distincts de la semaine', objectif: 3, type: 'minijeu_part_jours' },
    { id: 'fidele_potence', xp: 400, desc: 'Participer à au moins 4 sessions de Pendu différentes dans la semaine', objectif: 4, type: 'pendu_jours' },
    { id: 'bourreau_dejoue', xp: 450, desc: 'Remporter au moins 1 victoire au Pendu en découvrant le mot complet de 7 lettres', objectif: 1, type: 'pendu_win' },
    { id: 'alphabet_regaïen', xp: 400, desc: 'Découvrir un total cumulé de 10 bonnes lettres au Pendu sur la semaine', objectif: 10, type: 'pendu_bonne_lettre' },
    { id: 'esprit_equipe', xp: 350, desc: 'Participer à au moins 2 sessions où le mot du Pendu est trouvé collectivement', objectif: 2, type: 'pendu_victoire_collective' },
    { id: 'grand_chelem_minijeux', xp: 450, desc: 'Participer au Motus, au Rébus ET au Pendu le même jour sur 2 jours de la semaine', objectif: 2, type: 'grand_chelem_minijeux' },
    { id: 'tete_epaules', xp: 350, desc: 'Proposer au moins 15 lettres ou mots cumulés au Pendu sur la semaine', objectif: 15, type: 'pendu_essai' }
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

function aJoueALaRoulette(userId) {
    if (!bpBridge.rouletteStats) return false;
    const stats = bpBridge.rouletteStats.get(userId);
    return stats && stats.tirages > 0;
}

function getOuCreerProfilBP(userId, autoActif = false) {
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
        const estActifParDefaut = autoActif || aJoueALaRoulette(userId);
        p = {
            actif: estActifParDefaut,
            niveau: 1,
            xp: 0,
            paliersReclames: [],
            streak: 0,
            dernierJourStreak: null,
            dernierJourDate: null,
            semaineActuelle: null,
            quetesDuJour: [],
            quetesHebdo: [],
            notifs: 'desactive', // Alertes à zéro par défaut pour éviter tout MP intrusif
            mpBloques: false
        };
        bpData.joueurs[userId] = p;
    }

    // Sécurité : s'il n'avait pas le champ actif mais a déjà joué à la roulette
    if (p.actif === undefined) {
        p.actif = aJoueALaRoulette(userId) || (p.xp > 0) || (p.niveau > 1);
    }

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
        p.dailySalons = [];
        p.dailyHours = [];
        p.dailySalonCounts = {};
        p.dailyMotusSessions = [];
    }

    // Reset Hebdo
    if (p.semaineActuelle !== week) {
        p.semaineActuelle = week;
        p.quetesHebdo = tirerQuetesHebdo();
        p.weeklySalons = [];
        p.weeklyDays = [];
        p.weeklyDailyCount = 0;
    }

    // Rattrapage automatique de tous les paliers déjà atteints mais non reçus
    if (p.actif) {
        if (!p.paliersReclames) p.paliersReclames = [];
        for (let niv = 1; niv <= p.niveau; niv++) {
            if (!p.paliersReclames.includes(niv)) {
                p.paliersReclames.push(niv);
                const reco = RECOMPENSES_PALIERS[niv];
                if (reco) {
                    attribuerRecompenseInventaire(userId, reco.item);
                }
            }
        }
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

    // Persistance immédiate des gains
    bpBridge.demanderSauvegarde();

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
    if (!p.actif) return;

    let modifie = false;

    const nowParis = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    const heure = nowParis.getHours();
    const dayOfWeek = nowParis.getDay(); // 0 = Dimanche, 6 = Samedi
    const today = getTodayKey();

    if (!p.dailySalons) p.dailySalons = [];
    if (!p.dailyHours) p.dailyHours = [];
    if (!p.dailySalonCounts) p.dailySalonCounts = {};
    if (!p.weeklySalons) p.weeklySalons = [];
    if (!p.weeklyDays) p.weeklyDays = [];

    const typesActifs = new Set([type]);

    // 1. Déclencheurs contextuels de messages
    if (type === 'message') {
        if (heure >= 0 && heure < 8) typesActifs.add('message_nuit');
        if (heure >= 12 && heure < 14) typesActifs.add('message_midi');
        if (heure >= 18 && heure < 20) typesActifs.add('message_soir_debut');
        if (heure >= 19) typesActifs.add('message_soir');
        if (dayOfWeek === 0 || dayOfWeek === 6) typesActifs.add('message_weekend');
        if (heure < 10) typesActifs.add('message_matin_jours');

        if (meta.hasCooldown) typesActifs.add('msg_sous_cooldown');
        if (meta.hasCouronne) typesActifs.add('couronne_msg');

        // Suivi des heures distinctes
        if (!p.dailyHours.includes(heure)) {
            p.dailyHours.push(heure);
            if (p.dailyHours.length >= 2) typesActifs.add('heures_diff');
        }

        // Suivi des salons distincts (quotidien et hebdo)
        if (meta.channelId) {
            if (!p.dailySalons.includes(meta.channelId)) {
                p.dailySalons.push(meta.channelId);
            }
            if (p.dailySalons.length >= 2) typesActifs.add('salons_diff');

            if (!p.weeklySalons.includes(meta.channelId)) {
                p.weeklySalons.push(meta.channelId);
            }
            if (p.weeklySalons.length >= 4) typesActifs.add('salons_diff_hebdo');

            p.dailySalonCounts[meta.channelId] = (p.dailySalonCounts[meta.channelId] || 0) + 1;
            if (p.dailySalonCounts[meta.channelId] >= 15) typesActifs.add('message_salon_unique');
        }

        // Suivi des jours actifs dans la semaine
        if (!p.weeklyDays.includes(today)) {
            p.weeklyDays.push(today);
            typesActifs.add('message_jours');
        }
    }

    // 2. Déclencheurs Roulette
    if (type === 'roulette_roll') {
        if (heure < 12) typesActifs.add('roulette_matin');
        if (meta.sansEffetActif) typesActifs.add('roulette_neutre');
        if (meta.malusCumules >= 2) typesActifs.add('roll_sous_malus_cumules');
    }

    // 3. Déclencheurs Vocal
    if (type === 'vocal_min') {
        if (heure >= 22) typesActifs.add('vocal_nuit');
        if (heure >= 14 && heure < 18) typesActifs.add('vocal_aprem');
        if (dayOfWeek === 0 || dayOfWeek === 6) typesActifs.add('vocal_weekend');
        if (meta.groupeCount >= 3) typesActifs.add('vocal_groupe');
    }

    // 4. Streaks Hebdos
    if (p.streak >= 7) typesActifs.add('streak_hebdo');
    if (p.streak >= 5) typesActifs.add('streak_hebdo_5');

    const validerQuete = (q, amt) => {
        // Pour les quêtes de comptage d'ensembles uniques (salons, jours...)
        if (q.type === 'salons_diff') {
            q.progression = Math.min(q.objectif, p.dailySalons.length);
        } else if (q.type === 'salons_diff_hebdo') {
            q.progression = Math.min(q.objectif, p.weeklySalons.length);
        } else if (q.type === 'message_jours') {
            q.progression = Math.min(q.objectif, p.weeklyDays.length);
        } else if (q.type === 'message_salon_unique') {
            const maxDansUnSalon = Math.max(...Object.values(p.dailySalonCounts), 0);
            q.progression = Math.min(q.objectif, maxDansUnSalon);
        } else {
            q.progression = Math.min(q.objectif, q.progression + amt);
        }

        if (q.progression >= q.objectif && !q.terminee) {
            q.terminee = true;
            q.reclamee = true;
            if (p.dernierJourStreak !== today) {
                p.streak = (p.streak || 0) + 1;
                p.dernierJourStreak = today;
                checkStreakRewards(userId, p.streak);
            }
            ajouterXpEtMonteeDeNiveau(userId, p, q.xp, q.desc);

            // Méta-quêtes hebdos : nombre de quotidiennes validées
            p.weeklyDailyCount = (p.weeklyDailyCount || 0) + 1;
            for (const hq of p.quetesHebdo) {
                if (!hq.terminee && hq.type === 'quetes_daily_validees') {
                    hq.progression = Math.min(hq.objectif, p.weeklyDailyCount);
                    if (hq.progression >= hq.objectif) {
                        hq.terminee = true;
                        hq.reclamee = true;
                        ajouterXpEtMonteeDeNiveau(userId, p, hq.xp, hq.desc);
                    }
                }
            }

            // Méta-quête Grand Chelem (4/4 quotidiennes)
            const toutesTerminees = p.quetesDuJour.every(dq => dq.terminee);
            if (toutesTerminees && p.dernierGrandChelem !== today) {
                p.dernierGrandChelem = today;
                for (const hq of p.quetesHebdo) {
                    if (!hq.terminee && hq.type === 'full_daily') {
                        hq.progression = Math.min(hq.objectif, hq.progression + 1);
                        if (hq.progression >= hq.objectif) {
                            hq.terminee = true;
                            hq.reclamee = true;
                            ajouterXpEtMonteeDeNiveau(userId, p, hq.xp, hq.desc);
                        }
                    }
                }
            }
        }
    };

    // Application Quotidiennes
    for (const q of p.quetesDuJour) {
        if (q.terminee) continue;
        if (typesActifs.has(q.type)) {
            validerQuete(q, amount);
            modifie = true;
        }
    }

    // Application Hebdomadaires
    for (const q of p.quetesHebdo) {
        if (q.terminee) continue;
        if (typesActifs.has(q.type)) {
            validerQuete(q, amount);
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
                `${check} **${reco.nom.toUpperCase()}**\n`
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

function buildBPButtons(authorId, targetId = null) {
    const tid = targetId || authorId;
    const estSoiMeme = authorId === tid;
    const estAdminInspect = !estSoiMeme && authorId === bpBridge.EPSYS_ID;

    if (estAdminInspect) {
        // Vue modération Epsys sur un autre membre
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`bp_home_${authorId}_${tid}`).setLabel('🏠 Accueil').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`bp_quests_${authorId}_${tid}`).setLabel('📋 Ses Quêtes').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`bp_ladder_${authorId}_${tid}`).setLabel('🪜 Paliers').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`bp_addxp_${authorId}_${tid}`).setLabel('⚡ Ajouter XP').setStyle(ButtonStyle.Success)
        );
        return [row];
    }

    // Vue standard du membre sur son propre profil
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`bp_home_${authorId}_${tid}`).setLabel('🏠 Accueil').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`bp_quests_${authorId}_${tid}`).setLabel('📋 Mes Quêtes').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`bp_ladder_${authorId}_${tid}`).setLabel('🪜 Paliers').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`bp_rules_${authorId}_${tid}`).setLabel('📜 Règles').setStyle(ButtonStyle.Secondary),
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
    if (itemKey === 'redirectChoix') {
        const total = (bpBridge.rouletteRedirectCharges.get(userId) || 0) + 1;
        bpBridge.rouletteRedirectCharges.set(userId, total);
    } else if (itemKey === 'palierUltime') {
        bpBridge.crediterInventaireRoulette(userId, 'freeRoll1Min', 1);
        bpBridge.crediterInventaireRoulette(userId, 'epingleSalon', 1);
        const total = (bpBridge.rouletteRedirectCharges.get(userId) || 0) + 3;
        bpBridge.rouletteRedirectCharges.set(userId, total);
    } else {
        // Tous les autres items (tickets, boucliers, trèfles, éponges...) vont dans !rlt claim !
        bpBridge.crediterInventaireRoulette(userId, itemKey, 1);
    }
}

// =========================
//  HANDLERS MESSAGES & SLASH
// =========================

// Dictionnaire des identifiants simplifiés pour !bpgive
const BP_GIVE_ITEMS = {
    ticket: { id: 'ticketSkip', nom: '🎟️ Ticket Coupe-File (Skip Cooldown)' },
    ticketskip: { id: 'ticketSkip', nom: '🎟️ Ticket Coupe-File (Skip Cooldown)' },
    bouclier: { id: 'bouclier_1', nom: '🛡️ 1 Charge de Bouclier' },
    bouclier1: { id: 'bouclier_1', nom: '🛡️ 1 Charge de Bouclier' },
    bouclier5: { id: 'bouclier_5', nom: '🔰 Pack Défense (5 Boucliers)' },
    packdefense: { id: 'bouclier_5', nom: '🔰 Pack Défense (5 Boucliers)' },
    superbouclier: { id: 'superBouclier', nom: '🔰 Super Bouclier (3 Boucliers)' },
    trefle: { id: 'trefle20', nom: '🍀 Trèfle de Chance (+20% Jackpot)' },
    trefle20: { id: 'trefle20', nom: '🍀 Trèfle de Chance (+20% Jackpot)' },
    eponge: { id: 'eponge', nom: '🧹 Éponge à Malus' },
    minihh: { id: 'miniHH', nom: '⚡ Pass Mini Happy-Hour (2 tirages 5min)' },
    pity: { id: 'pityBoost', nom: '📈 Coup de Pouce Pity (+1 malus/nul)' },
    pityboost: { id: 'pityBoost', nom: '📈 Coup de Pouce Pity (+1 malus/nul)' },
    triple: { id: 'coupTriple', nom: '🎰 Coup Triple (3 tirages gratuits)' },
    couptriple: { id: 'coupTriple', nom: '🎰 Coup Triple (3 tirages gratuits)' },
    sniper: { id: 'redirectChoix', nom: '🎯 Le Sniper (1 Redirection au choix)' },
    redirectchoix: { id: 'redirectChoix', nom: '🎯 Le Sniper (1 Redirection au choix)' },
    redirect5: { id: 'redirectChoix5', nom: '🎯 5 Redirections au choix' },
    pseudo: { id: 'pseudoLockSemaine', nom: '✍️ Gravé dans la roche (Pseudo 1 sem.)' },
    pseudolock: { id: 'pseudoLockSemaine', nom: '✍️ Gravé dans la roche (Pseudo 1 sem.)' },
    freeroll: { id: 'freeRoll1Min', nom: '🎰 Tirage à volonté (1 min)' },
    epingle: { id: 'epingleSalon', nom: '📌 Épingle Salon' },
    ultime: { id: 'palierUltime', nom: '🏆 Pack Palier Ultime' }
};

function buildBPGiveIdEmbed() {
    return new EmbedBuilder()
        .setColor(0xffd20a)
        .setTitle('📋 Identifiants des Récompenses Battle Pass (!bpgiveid)')
        .setDescription(
            `Voici les identifiants pour donner des récompenses avec la commande :\n` +
            `👉 \`!bpgive [membre] [id] [quantité optionnelle]\`\n\n` +
            `• \`ticket\` — 🎟️ Ticket Coupe-File (Skip Cooldown)\n` +
            `• \`bouclier\` — 🛡️ 1 Charge de Bouclier\n` +
            `• \`bouclier5\` — 🔰 Pack Défense (5 Boucliers)\n` +
            `• \`superbouclier\` — 🔰 Super Bouclier (3 Boucliers)\n` +
            `• \`trefle\` — 🍀 Trèfle de Chance (+20% Jackpot)\n` +
            `• \`eponge\` — 🧹 Éponge à Malus\n` +
            `• \`minihh\` — ⚡ Pass Mini Happy-Hour (2 tirages à 5min)\n` +
            `• \`pity\` — 📈 Coup de Pouce Pity (+1 malus / +1 nul)\n` +
            `• \`triple\` — 🎰 Coup Triple (3 tirages gratuits)\n` +
            `• \`sniper\` — 🎯 Le Sniper (1 Redirection au choix)\n` +
            `• \`redirect5\` — 🎯 5 Redirections au choix\n` +
            `• \`pseudo\` — ✍️ Gravé dans la roche (Pseudo verrouillé 1 sem.)\n` +
            `• \`freeroll\` — 🎰 Tirage à volonté (1 min sans cooldown)\n` +
            `• \`epingle\` — 📌 Épingle Salon\n` +
            `• \`ultime\` — 🏆 Pack Palier Ultime (Free roll + Épingle + 3 Redirections)`
        )
        .setFooter({ text: 'Exemple : !bpgive @Epsys ticket 2' });
}

async function handleBattlePassMessage(message, helpers = {}) {
    const raw = message.content.trim();
    const parts = raw.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const sub = parts[1]?.toLowerCase();

    // Commande !bpgiveid (Epsys-only)
    if (cmd === '!bpgiveid') {
        if (message.author.id !== bpBridge.EPSYS_ID) {
            await message.reply("Cette commande est réservée à Epsys.");
            return true;
        }
        await message.reply({ embeds: [buildBPGiveIdEmbed()] });
        return true;
    }

    // Commande !bpgive (Epsys-only)
    if (cmd === '!bpgive') {
        if (message.author.id !== bpBridge.EPSYS_ID) {
            await message.reply("Cette commande est réservée à Epsys.");
            return true;
        }

        if (parts.length < 3) {
            const embedAide = new EmbedBuilder()
                .setColor(0xe67e22)
                .setTitle('⚠️ Commande incomplète')
                .setDescription(
                    `Il faut préciser le/la membre et l'identifiant du bonus à lui donner !\n\n` +
                    `👉 **Syntaxe :** \`!bpgive [membre] [id du bonus] [quantité optionnelle]\`\n` +
                    `👉 **Exemples :**\n` +
                    `• \`!bpgive @Epsys ticket\`\n` +
                    `• \`!bpgive @Epsys bouclier5 2\`\n` +
                    `• \`!bpgive @Epsys trefle\`\n\n` +
                    `📋 Tape **\`!bpgiveid\`** pour voir la liste complète de tous les identifiants disponibles !`
                );
            await message.reply({ embeds: [embedAide] });
            return true;
        }

        const queryMembre = parts[1];
        let cible = message.mentions.members.first();
        if (!cible && helpers.findMemberByName) {
            cible = helpers.findMemberByName(message.guild, queryMembre).found;
        }

        if (!cible) {
            await message.reply("❌ Membre introuvable. Mentionne-le ou écris son pseudo exact.");
            return true;
        }

        const slug = parts[2].toLowerCase();
        const itemInfo = BP_GIVE_ITEMS[slug];

        if (!itemInfo) {
            await message.reply(`❌ Identifiant de bonus inconnu : \`${slug}\`.\nTape **\`!bpgiveid\`** pour voir la liste des bonus valides !`);
            return true;
        }

        const quantite = Math.max(1, parseInt(parts[3], 10) || 1);

        for (let i = 0; i < quantite; i++) {
            attribuerRecompenseInventaire(cible.id, itemInfo.id);
        }
        bpBridge.demanderSauvegarde();

        const embedSucces = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('🎁 Récompense Battle Pass attribuée !')
            .setDescription(
                `**${quantite > 1 ? `x${quantite} ` : ''}${itemInfo.nom}** ${quantite > 1 ? 'ont été déposés' : 'a été déposé'} avec succès dans l'inventaire de <@${cible.id}> !\n\n` +
                `*Le membre peut ${quantite > 1 ? 'les' : 'l\''}activer à tout moment avec \`!rlt claim\`.*`
            )
            .setFooter({ text: 'Cacabot Battle Pass • Commande Epsys' });

        await message.reply({ embeds: [embedSucces] });
        return true;
    }

    if (['!bp', '!pass', '!battlepass'].includes(cmd)) {
        // Commande d'administration Epsys : !bp questforce [membre]
        if (sub === 'questforce') {
            if (message.author.id !== bpBridge.EPSYS_ID) {
                await message.reply("Cette commande est réservée à Epsys.");
                return true;
            }

            const query = parts.slice(2).join(" ");
            let cible = message.mentions.members.first();
            if (!cible) {
                if (!query) cible = message.member;
                else if (helpers.findMemberByName) {
                    const result = helpers.findMemberByName(message.guild, query);
                    if (result.multiple && helpers.askDisambiguation) {
                        return helpers.askDisambiguation(message, message.guild, result.candidates, async (user) => {
                            const mb = message.guild.members.cache.get(user.id);
                            if (mb) afficherMenuQuestforce(message, mb);
                        });
                    }
                    cible = result.found;
                }
            }

            if (!cible) {
                await message.reply("Membre introuvable. Usage : `!bp questforce [pseudo/mention]`");
                return true;
            }

            return await afficherMenuQuestforce(message, cible);
        }

        // Commande de prévisualisation de l'embed d'onboarding : !bp embedtest
        if (sub === 'embedtest') {
            if (message.author.id !== bpBridge.EPSYS_ID) {
                await message.reply("Cette commande est réservée à Epsys.");
                return true;
            }
            const embedTest = buildBPOnboardingEmbed(message.member);
            const rowTest = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`bp_test_btn_actif`).setLabel('Activer le battle pass ! ✅').setStyle(ButtonStyle.Success).setDisabled(true),
                new ButtonBuilder().setCustomId(`bp_test_btn_refus`).setLabel('Annuler ❌').setStyle(ButtonStyle.Danger).setDisabled(true)
            );
            await message.reply({ content: "🔍 **Prévisualisation de l'embed d'activation (Boutons désactivés en mode test) :**", embeds: [embedTest], components: [rowTest] });
            return true;
        }

        // Inspection d'un autre membre : !bp [membre] ou !pass [membre]
        const queryMembre = parts.slice(1).join(" ");
        let cible = message.member;

        if (queryMembre) {
            const mention = message.mentions.members.first();
            if (mention) {
                cible = mention;
            } else if (helpers.findMemberByName) {
                const result = helpers.findMemberByName(message.guild, queryMembre);
                if (result.multiple && helpers.askDisambiguation) {
                    return helpers.askDisambiguation(message, message.guild, result.candidates, async (user) => {
                        const mb = message.guild.members.cache.get(user.id);
                        if (mb) {
                            const embed = buildBPHomeEmbed(mb);
                            const rows = buildBPButtons(message.author.id, mb.id);
                            message.reply({ embeds: [embed], components: rows });
                        }
                    });
                }
                if (result.found) cible = result.found;
                else {
                    await message.reply("Membre introuvable sur le serveur.");
                    return true;
                }
            }
        }

        // Si le membre inspecté (ou soi-même) n'a jamais activé le pass et n'a jamais joué à la roulette
        const pCible = getOuCreerProfilBP(cible.id);
        if (!pCible.actif && cible.id === message.author.id) {
            const embedOnboarding = buildBPOnboardingEmbed(message.member);
            const rowOnboarding = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`bp_activer_${message.author.id}`).setLabel('Activer le battle pass ! ✅').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`bp_refuser_${message.author.id}`).setLabel('Annuler ❌').setStyle(ButtonStyle.Danger)
            );
            await message.reply({ embeds: [embedOnboarding], components: [rowOnboarding] });
            return true;
        }

        const { MessageFlags } = require('discord.js');
        const embed = buildBPHomeEmbed(cible);
        const rows = buildBPButtons(message.author.id, cible.id);
        await message.reply({ 
            embeds: [embed], 
            components: rows,
            flags: [MessageFlags.SuppressNotifications],
            allowedMentions: { repliedUser: false }
        });
        return true;
    }
    return false;
}

function buildBPOnboardingEmbed(membre) {
    return new EmbedBuilder()
        .setColor(0xffd20a)
        .setTitle('🎫 DÉCOUVRE LE BATTLE PASS DE LA ROULETTE !')
        .setDescription(
            `Bienvenue <@${membre.id}> ! Tu n'as pas encore rejoint le **Battle Pass mensuel de Regaïa**.\n\n` +
            `### 🎯 C'est quoi le Battle Pass ?\n` +
            `Chaque mois, monte à travers **25 niveaux** pour débloquer des récompenses gratuites pour la roulette regaïenne :\n` +
            `• 🛡️ Boucliers de protection contre les malus\n` +
            `• 🎟️ Tickets pour passer les cooldowns de roulette\n` +
            `• 🎰 Coups triples, redirections de malus et pouvoirs exclusifs\n\n` +
            `### ☀️ Comment monter en niveau ?\n` +
            `Accomplis 4 quêtes quotidiennes et 3 quêtes hebdos simples en participant au serveur (messages, vocaux, mini-jeux, interactions).\n\n` +
            `> 🔕 **Tranquillité garantie :** Toutes les alertes en message privé (MP) sont **désactivées par défaut**. Tu ne recevras aucun MP sans l'avoir choisi.\n\n` +
            `*Veux-tu activer ton Battle Pass pour la saison en cours ?*`
        )
        .setFooter({ text: 'Clique sur un bouton ci-dessous pour confirmer ton choix' })
        .setThumbnail(membre.user.displayAvatarURL({ dynamic: true, size: 256 }));
}

async function afficherMenuQuestforce(message, cible) {
    const p = getOuCreerProfilBP(cible.id);
    const embed = buildBPQuestsEmbed(cible);
    embed.setTitle(`🛠️ [ADMIN] Quêtes de ${cible.displayName} — Force Completion`);

    const options = [];
    p.quetesDuJour.forEach((q, idx) => {
        if (!q.terminee) {
            options.push({
                label: `☀️ [Q${idx + 1}] (+${q.xp} XP) ${q.desc}`.slice(0, 100),
                description: `Progression : ${q.progression}/${q.objectif} (Quotidienne)`.slice(0, 100),
                value: `daily::${q.id}`
            });
        }
    });

    p.quetesHebdo.forEach((q, idx) => {
        if (!q.terminee) {
            options.push({
                label: `📅 [H${idx + 1}] (+${q.xp} XP) ${q.desc}`.slice(0, 100),
                description: `Progression : ${q.progression}/${q.objectif} (Hebdomadaire)`.slice(0, 100),
                value: `weekly::${q.id}`
            });
        }
    });

    if (options.length === 0) {
        embed.setDescription("Toutes les quêtes de ce membre sont déjà terminées !");
        await message.reply({ embeds: [embed] });
        return true;
    }

    const menu = new StringSelectMenuBuilder()
        .setCustomId(`bp_questforce_select_${cible.id}`)
        .setPlaceholder('Sélectionne une quête à compléter de force...')
        .addOptions(options.slice(0, 25));

    const row = new ActionRowBuilder().addComponents(menu);
    await message.reply({ embeds: [embed], components: [row] });
    return true;
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
    // 1. Soumission de la modale "Ajouter XP" par Epsys
    if (interaction.isModalSubmit() && interaction.customId.startsWith('bp_modal_addxp_')) {
        if (interaction.user.id !== bpBridge.EPSYS_ID) {
            return interaction.reply({ content: "Action réservée à Epsys.", ephemeral: true });
        }

        const cibleId = interaction.customId.replace('bp_modal_addxp_', '');
        const xpValeurStr = interaction.fields.getTextInputValue('xp_amount').trim();
        const xpAmount = parseInt(xpValeurStr, 10);

        if (isNaN(xpAmount) || xpAmount <= 0) {
            return interaction.reply({ content: "❌ Montant d'XP invalide. Saisis un nombre entier positif.", ephemeral: true });
        }

        const p = getOuCreerProfilBP(cibleId);
        ajouterXpEtMonteeDeNiveau(cibleId, p, xpAmount, `[AJOUT ADMIN EPSYS]`);
        bpBridge.demanderSauvegarde();

        const cibleMembre = interaction.guild?.members.cache.get(cibleId);
        const embedMaj = buildBPHomeEmbed(cibleMembre || { displayName: `ID ${cibleId}` });

        if (interaction.message?.editable) {
            await interaction.message.edit({ embeds: [embedMaj], components: buildBPButtons(interaction.user.id, cibleId) }).catch(() => {});
        }

        await interaction.reply({
            content: `⚡ **+${xpAmount} XP ajoutés avec succès à <@${cibleId}> !**\nNiveau actuel : **Niv. ${p.niveau}** (${p.xp}/${XP_PAR_NIVEAU} XP).`,
            ephemeral: true
        });
        return true;
    }

    const id = interaction.customId;
    if (!id) return false;

    // Action Admin Epsys : Bouton "Ajouter XP" -> ouverture de la modale
    if (id.startsWith('bp_addxp_')) {
        const parts = id.split('_');
        const authorId = parts[2];
        const targetId = parts[3];

        if (interaction.user.id !== bpBridge.EPSYS_ID) {
            return interaction.reply({ content: "Ce bouton est réservé à Epsys.", ephemeral: true });
        }

        const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
        const modal = new ModalBuilder()
            .setCustomId(`bp_modal_addxp_${targetId}`)
            .setTitle(`⚡ Ajouter de l'XP Battle Pass`);

        const xpInput = new TextInputBuilder()
            .setCustomId('xp_amount')
            .setLabel("Montant d'XP à ajouter (ex : 50, 100, 500)")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('50')
            .setMinLength(1)
            .setMaxLength(5)
            .setRequired(true);

        const firstActionRow = new ActionRowBuilder().addComponents(xpInput);
        modal.addComponents(firstActionRow);

        await interaction.showModal(modal);
        return true;
    }

    // Action Admin Epsys : Forcer la complétion d'une quête
    if (id.startsWith('bp_questforce_select_')) {
        if (interaction.user.id !== bpBridge.EPSYS_ID) {
            return interaction.reply({ content: "Cette action est réservée à Epsys.", ephemeral: true });
        }

        const cibleId = id.replace('bp_questforce_select_', '');
        const valChoisie = interaction.values[0];
        const [categorie, queteId] = valChoisie.split('::');
        const p = getOuCreerProfilBP(cibleId);

        let queteTrouvee = null;
        if (categorie === 'daily') {
            queteTrouvee = p.quetesDuJour.find(q => q.id === queteId);
        } else {
            queteTrouvee = p.quetesHebdo.find(q => q.id === queteId);
        }

        if (!queteTrouvee || queteTrouvee.terminee) {
            return interaction.reply({ content: "Cette quête a déjà été terminée ou n'existe plus.", ephemeral: true });
        }

        // Complétion immédiate
        queteTrouvee.progression = queteTrouvee.objectif;
        queteTrouvee.terminee = true;
        queteTrouvee.reclamee = true;

        if (categorie === 'daily') {
            const today = getTodayKey();
            if (p.dernierJourStreak !== today) {
                p.streak = (p.streak || 0) + 1;
                p.dernierJourStreak = today;
                checkStreakRewards(cibleId, p.streak);
            }
        }

        ajouterXpEtMonteeDeNiveau(cibleId, p, queteTrouvee.xp, `[FORCÉ PAR ADMIN] ${queteTrouvee.desc}`);
        bpBridge.demanderSauvegarde();

        const cibleMembre = interaction.guild.members.cache.get(cibleId);
        const embedMaj = buildBPQuestsEmbed(cibleMembre || { displayName: `ID ${cibleId}` });
        embedMaj.setTitle(`✅ Quête complétée de force pour ${cibleMembre?.displayName ?? cibleId} !`);

        await interaction.update({ embeds: [embedMaj], components: [] });
        await interaction.followUp({
            content: `⚡ **Succès !** La quête **${queteTrouvee.desc}** (+${queteTrouvee.xp} XP) a été validée pour <@${cibleId}> !\nNiveau actuel : **Niv. ${p.niveau}** (${p.xp}/${XP_PAR_NIVEAU} XP).`,
            ephemeral: true
        });
        return true;
    }

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

    const parts = id.split('_');
    const action = parts[1];
    const authorId = parts[2];
    const targetId = parts[3] || authorId;

    if (interaction.user.id !== authorId) {
        return interaction.reply({ content: "Ce n'est pas ton menu 😌", ephemeral: true });
    }

    // Clic sur "Activer le battle pass ! ✅"
    if (action === 'activer') {
        const p = getOuCreerProfilBP(authorId, true);
        p.actif = true;
        bpBridge.demanderSauvegarde();

        const embedHome = buildBPHomeEmbed(interaction.member);
        const rowsHome = buildBPButtons(authorId);
        await interaction.update({ embeds: [embedHome], components: rowsHome });
        return true;
    }

    // Clic sur "Annuler ❌"
    if (action === 'refuser') {
        await interaction.update({
            content: "❌ **Battle Pass annulé !**\n*Tu pourras l'activer à tout moment en tapant `!bp` ou en faisant un tirage à la roulette.*",
            embeds: [],
            components: []
        });
        return true;
    }

    const cibleMembre = interaction.guild?.members.cache.get(targetId) || interaction.member;

    if (action === 'home') {
        await interaction.update({ embeds: [buildBPHomeEmbed(cibleMembre)], components: buildBPButtons(authorId, targetId) });
        return true;
    }

    if (action === 'quests') {
        await interaction.update({ embeds: [buildBPQuestsEmbed(cibleMembre)], components: buildBPButtons(authorId, targetId) });
        return true;
    }

    if (action === 'ladder') {
        await interaction.update({ embeds: [buildBPLadderEmbed(cibleMembre)], components: buildBPButtons(authorId, targetId) });
        return true;
    }

    if (action === 'rules') {
        await interaction.update({ embeds: [buildBPRulesEmbed()], components: buildBPButtons(authorId, targetId) });
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