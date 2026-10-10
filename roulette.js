const {
    EmbedBuilder, ActionRowBuilder, ButtonBuilder,
    StringSelectMenuBuilder, UserSelectMenuBuilder, ButtonStyle, ChannelType
} = require('discord.js');

const ROULETTE_COOLDOWN_MS = 15 * 60 * 1000;
const ROULETTE_COOLDOWN_EXEMPT = ['744217896581857281', '902651805614358568'];
const ROULETTE_JACKPOT_INCREMENT = 0.01;
const ROULETTE_JACKPOT_MAX = 0.5;
const ROULETTE_HOF_CHANNEL_ID = '1554331383361577010';
const ROULETTE_SALON_ID = '1553954760900608091';
const ROULETTE_HOF_SEUIL = 0.0005;
const ROULETTE_ROLE_ADDICT_ID = '1555245236249436160';
const ROULETTE_ADDICT_SEUIL = 500;
const ROULETTE_TAUX_ECHEC = 0.5;
const ROULETTE_PITY_MALUS = 3;
const ROULETTE_PITY_NULS = 5;

const ROULETTE_WEBHOOK_EXCLUS = new Set([
    '1553948893354401923', '1544686219223498762', '862253918583390238',
    '730795053563248640', '745115366065176598', '738514269234266242'
]);

const ROULETTE_EMOJIS_ALEATOIRES = ['😂','😍','🔥','💀','🎉','😭','👀','🤡','😏','👁️👄👁️','🫦','😡'];
const ROULETTE_BOOMER_FINS = [
    ', A BON ENTENDEUR... 🤣🤣', '.... BISOUS A LA FAMILLE 🍷👍',
    '....PAUVRE FRANCE....\nAmitiés ..', '... A MEDITER ☕🙋‍♂️',
    '....C ETAIT MIEUX AVANT !!!! 😡', '...\nBisous   -Mamie'
];

const ROULETTE_EXISTENTIEL_FINS = [
    '\nmais bon, au final, on va tous mourir seuls dans le néant...',
    '\net pourtant l\'univers se fiche éperdument de notre existence...',
    '\nest-ce que ça vaut vraiment la peine de continuer à faire semblant...?',
    '\ntout ça pour finir poussière dans un monde indifférent.',
    '\nmais à quoi bon, puisque rien n\'a de sens au fond.',
    '\nun jour plus personne ne se souviendra même de ce message.'
];

const ROULETTE_LINKEDIN_FINS = [
    '\nEn tant que leader agile, cette synergie m\'inspire au quotidien. Belle journée à tous ! 🚀 #Mindset #Leadership',
    '\nVoilà pourquoi l\'échec est une formidable opportunité de disruption et de croissance. 💡 #Growth #Success',
    '\nCe matin à 5h30, en prenant ma douche froide, j\'ai réalisé l\'importance de ce KPI. 💼 #MorningRoutine #Networking',
    '\nEt vous, comment réinventez-vous votre valeur ajoutée dans l\'écosystème corporate ? 🤝 #Inspiration #B2B',
    '\nRestez focus sur vos objectifs, l\'excellence opérationnelle n\'attend pas. 📈 #Motivation #Business'
];

const ROULETTE_ECHO_REPLIQUES = [
    "C'est faux.", "Gênant.", "Qui a demandé ?", "Ratio.",
    "Intéressant... non en vrai on s'en fout.", "Tu forces un peu là.",
    "Supprime.", "Ok et ?", "On s'en branle un peu non ?", "Bizarre ce message."
];

const rouletteEchoUntil = new Map();

const ROULETTE_ACHIEVEMENTS = [
    { id: 'forteresse', nom: 'Forteresse impénétrable', emoji: '🏰', desc: 'Accumuler un total de 10 boucliers dans sa réserve' },
    { id: 'chat-noir', nom: 'Victime du Destin', emoji: '🐈‍⬛', desc: 'Subir la Malédiction du Chat Noir avec +5% de bonus boosté ou plus' },
    { id: 'malus-prime', nom: 'La totale', emoji: '💥', desc: 'Décrocher et subir le MALUS PRIME' },
    { id: 'double-peine', nom: 'La Double Peine', emoji: '⏳', desc: 'Tomber sur Cooldown 45 min alors qu\'il reste des charges actives' },
    { id: 'condamne-plebe', nom: 'Condamnation publique', emoji: '🪓', desc: 'Être exclu.e 1 jour suite au vote public' },
    { id: 'incomprehensible', nom: 'L\'Incompréhensible', emoji: '🔤', desc: 'Cumuler 3 malus de texte ou plus en même temps' },
    { id: 'hof', nom: 'Superstar', emoji: '🏆', desc: 'Décrocher un gain légendaire du Hall of Fame (≤ 0,05%)' },
    { id: 'pare-balles', nom: 'Pare-Balles', emoji: '🛡️', desc: 'Bloquer un mute de 20 min ou une exclusion grâce à un bouclier' },
    { id: 'pharmacien', nom: 'Chimiste en herbe', emoji: '🧪', desc: 'Déclencher la mécanique de contre-poison pour annuler un malus actif' },
    { id: 'braquage-parfait', nom: 'Braquage Parfait', emoji: '🎰', desc: 'Obtenir 3 bonus sur les 3 tirages gratuits d\'un Coup Triple' },
    { id: 'innocente', nom: 'L\'Innocenté.e', emoji: '🕊️', desc: 'Sortir libre d\'un vote public' },
    { id: 'veteran-250', nom: 'Pro du gambling', emoji: '🎲', desc: 'Atteindre 250 tirages au total' },
    { id: 'centurion-500', nom: 'Gambling addict', emoji: '👑', desc: 'Atteindre 500 tirages au total' },
    { id: 'baptiseur', nom: 'Gravé dans la roche', emoji: '✍️', desc: 'Verrouiller le pseudo d\'un.e autre membre avec le bonus Pseudo au choix' },
    { id: 'epingle', nom: 'Maman je passe à la télé !', emoji: '📌', desc: 'Épingler un message dans le salon avec le bonus Message épinglé' },
    { id: 'tournee-patron', nom: 'C\'est ma tournée !', emoji: '🍻', desc: 'Déclencher l\'événement rare de la Tournée générale (1/600)' },
    { id: 'survivant-enfer', nom: 'Survivant.e de l\'Enfer', emoji: '☠️', desc: 'Tirer l\'Exclusion d\'une semaine ou le Ban définitif' },
    { id: 'ascension-sociale', nom: 'L\'Ascension Sociale', emoji: '👑', desc: 'Monter d\'un rang de Regaïen ou toucher Regaïen légendaire' },
    { id: 'jour-de-gloire', nom: 'Jour de Gloire', emoji: '🎂', desc: 'Obtenir un bonus sur la roulette le jour de son anniversaire' },
    { id: 'oiseau-nuit', nom: 'Oiseau de Nuit', emoji: '🔥', desc: 'Effectuer au moins 10 tirages pendant une session d\'Happy Hour' },
    { id: 'sniper-impitoyable', nom: 'Sniper', emoji: '🎯', desc: 'Rediriger avec succès un malus avec la Redirection au choix' },
    { id: 'tete-dure', nom: 'Tête Dure', emoji: '🛡️', desc: 'Esquiver au moins 5 fois le Feur de Cacabot grâce à l\'Anti-Feur' },
    { id: 'laristocrate', nom: 'Aristocrate', emoji: '👑', desc: 'Décrocher le bonus de la Couronne 12h' },
    { id: 'enchainement-fatal', nom: 'Enchaînement Fatal', emoji: '🪨', desc: 'Subir 3 malus consécutifs d\'affilée sans aucun répit' },
    { id: 'silence-radio', nom: 'Silence Radio', emoji: '🤫', desc: 'Subir l\'Exclusion de 1 jour' },
    { id: 'le-sauvetage', nom: 'Sauvetage', emoji: '📈', desc: 'Décrocher un bonus garanti grâce au système de Pity' },
    { id: 'crise-quarantaine', nom: 'Crise de la Quarantaine', emoji: '👶', desc: 'Cumuler le Mode Boomer et le Baby Mode en même temps' },
    { id: 'fan-carlos', nom: 'Fan de Carlos', emoji: '🎶', desc: 'Faire spawn PAPAYOU.mp3 3 fois dans la même journée' },
    { id: 'seum-en-personne', nom: 'Le seum en personne', emoji: '🧻', desc: 'Avoir subi au moins 10 malus différents sur la roulette' },
    { id: 'argent-epsys', nom: 'De l\'argent !', emoji: '💶', desc: 'Recevoir 5€ de la YouTube money d\'Epsys (0,015%)' }
];

const ROULETTE_NOMS_COMMANDES = {
    timeout3: 'malus-timeout-3min', timeout5: 'malus-timeout-5min', timeout20: 'malus-timeout-20min',
    exclu1h: 'malus-exclu-heure', exclu1j: 'malus-exclu-jour', exclu1semaine: 'malus-exclu-semaine',
    pseudo1semaine: 'malus-pseudo-lock-semaine', pseudo1mois: 'malus-pseudo-lock-mois', ban: 'malus-ban',
    papayou: 'bonus-gif-ou-audio', antifeur: 'bonus-anti-feur', couptriple: 'bonus-coup-triple', cooldowncourt: 'bonus-cooldown-court',
    jackpotboost: 'bonus-jackpot-boost', superbouclier: 'bonus-super-bouclier',
    couronne: 'bonus-couronne', redirect: 'bonus-redirect-malus', rolesup: 'bonus-role-superieur',
    legendaire: 'bonus-legendaire', elu: 'bonus-elu-roulette', youtube: 'bonus-youtube-credit',
    goodies: 'bonus-epsys-goodies', petitdej: 'bonus-epsys-petitdej', twitch: 'bonus-twitch-jeu',
    commande: 'bonus-commande-perso', '5e': 'bonus-epsys-5e', photo: 'bonus-epsys-photo',
    pseudochoix: 'bonus-pseudo-choix', epingle: 'bonus-epingle', prime: 'malus-prime', chatnoir: 'malus-chat-noir', boomer: 'malus-boomer',
    uwu: 'malus-uwu-24h', lettre: 'malus-lettre-interdite', emoji: 'malus-emoji', cooldown45: 'malus-cooldown-45',
    bouclier: 'bonus-bouclier', redirectchoix: 'bonus-redirect-choix', leet: 'malus-leet',
    caps: 'malus-caps', emojionly: 'malus-emoji-only', censure: 'malus-censure', mots: 'malus-mots-melanges',
    lettres: 'malus-lettres-melangees', limite100: 'malus-limite-100', limite30: 'malus-limite-30',
    tournee: 'special-tournee-generale', bebe: 'malus-bebe',
    brisebouclier: 'malus-brise-bouclier', existentiel: 'malus-existentiel',
    linkedin: 'malus-linkedin', echo: 'malus-echo',
    vote: 'special-vote-immunite-exclusion',
    votepublic: 'bonus-vote-gagnant', votegagnant: 'bonus-vote-gagnant'
};

const ROULETTE_TABLE = [
    { id: 'bonus-gif-ou-audio', type: 'bonus', poids: 1/10, nom: 'PAPAYOU.mp3', desc: 'PAPAYOU.mp3' },
    { id: 'bonus-cooldown-court', type: 'bonus', poids: 1/10, nom: 'Cooldown réduit à 5 min', desc: 'Les 3 prochains tirages ont un cooldown de 5 minutes' },
    { id: 'bonus-bouclier', type: 'bonus', poids: 1/12, nom: 'Immunité au prochain malus', desc: 'Immunité au prochain malus' },
    { id: 'bonus-anti-feur', type: 'bonus', poids: 1/15, nom: 'Immunité Anti-Feur (24h)', desc: 'Cacabot réagit avec 🛡️ au lieu de te répondre Feur pendant 24h' },
    { id: 'bonus-jackpot-boost', type: 'bonus', poids: 1/17, nom: 'Boost Jackpot (+25%)', desc: '+25% de chance de bonus sur tes 2 prochains tirages (cumulable)' },
    { id: 'bonus-coup-triple', type: 'bonus', poids: 1/20, nom: 'Coup Triple', desc: 'Tes 3 prochains tirages sont immédiats et sans aucun cooldown' },
    { id: 'bonus-super-bouclier', type: 'bonus', poids: 1/35, nom: 'Super Bouclier (3 malus)', desc: 'Immunité totale contre tes 3 prochains malus (cumulable)' },
    { id: 'bonus-couronne', type: 'bonus', poids: 1/50, nom: 'Couronne 👑 pendant 12h', desc: 'Une couronne 👑 sous tes messages pendant 12h' },
    { id: 'bonus-redirect-malus', type: 'bonus', poids: 1/85, nom: '3 malus redirigés au hasard', desc: '3 prochains malus redirigés vers un.e autre membre' },
    { id: 'bonus-redirect-choix', type: 'bonus', poids: 1/100, nom: 'Malus redirigé au choix', desc: 'Redirige ton prochain malus vers la personne de ton choix' },
    { id: 'bonus-epingle', type: 'bonus', poids: 1/150, nom: 'Message épinglé', desc: 'Un message épinglé définitivement dans le salon' },
    { id: 'bonus-role-superieur', type: 'bonus', poids: 1/170, nom: 'Rôle de Regaïen.ne niv. supérieur', desc: 'Rôle de Regaïen.ne supérieur' },
    { id: 'bonus-pseudo-choix', type: 'bonus', poids: 1/250, nom: 'Pseudo au choix', desc: 'Choisis le pseudo d\'un·e membre, verrouillé pendant 48h' },
    { id: 'bonus-legendaire', type: 'bonus', poids: 1/420, nom: 'Regaïen·ne légendraire', desc: 'Rôle de Regaïen·ne légendraire' },
    { id: 'bonus-twitch-jeu', type: 'bonus', poids: 1/850, nom: 'Choix du jeu du prochain stream Twitch', desc: 'Choix du jeu du prochain stream Twitch' },
    { id: 'bonus-commande-perso', type: 'bonus', poids: 1/1700, nom: 'Commande Cacabot personnalisée', desc: 'Ajoute une commande Cacabot de ton choix' },
    { id: 'bonus-epsys-5e', type: 'bonus', poids: 1/3400, nom: '5€ de la YouTube Money d\'Epsys', desc: '5€ de la YouTube Money d\'Epsys' },
    { id: 'bonus-epsys-photo', type: 'bonus', poids: 1/5000, nom: 'Photo disgracieuse d\'Epsys dédicacée', desc: '1 photo disgracieuse d\'Epsys signée' },
    { id: 'bonus-elu-roulette', type: 'bonus', poids: 1/7000, nom: 'Rôle Élu·e de la Roulette', desc: 'Rôle spécial d\'Élu·e de la Roulette' },
    { id: 'bonus-youtube-credit', type: 'bonus', poids: 1/8500, nom: 'Pseudo crédité sous chaque vidéo YouTube', desc: 'Pseudo crédité sous chaque vidéo YouTube' },
    { id: 'bonus-epsys-goodies', type: 'bonus', poids: 1/12500, nom: 'Goodies d\'Epsys', desc: 'Goodies d\'Epsys gratuit au choix' },
    { id: 'bonus-epsys-petitdej', type: 'bonus', poids: 1/17000, nom: 'Petit déj apporté par Epsys en maid dress', desc: 'Petit déj apporté par Epsys en maid dress' },
    { id: 'malus-timeout-3min', type: 'malus', poids: 1/10, nom: 'Mute de 3 minutes', desc: 'Mute de 3 minutes' },
    { id: 'malus-timeout-5min', type: 'malus', poids: 1/15, nom: 'Mute de 5 minutes', desc: 'Mute de 5 minutes' },
    { id: 'malus-cooldown-45', type: 'malus', poids: 1/20, nom: 'Cooldown de 45 min', desc: 'Les 2 prochains tirages ont un cooldown de 45 minutes' },
    { id: 'malus-timeout-20min', type: 'malus', poids: 1/25, nom: 'Mute de 20 minutes', desc: 'Mute de 20 minutes' },
    { id: 'malus-emoji-only', type: 'malus', poids: 1/35, nom: 'Emoji only pendant 1h', desc: 'Tous ses mots sont remplacés par des emojis pendant 1h' },
    { id: 'malus-bebe', type: 'malus', poids: 1/45, nom: 'Parler bébé pendant 2h', desc: 'Les « j » deviennent « z » et « r » deviennent « w » pendant 2h' },
    { id: 'malus-emoji', type: 'malus', poids: 1/55, nom: 'Emoji obligatoire', desc: 'Doit finir chaque message par un emoji aléatoire pendant 6h' },
    { id: 'malus-chat-noir', type: 'malus', poids: 1/65, nom: 'Malédiction du Chat Noir', desc: 'Réinitialise ta pity et ton boost de bonus à zéro' },
    { id: 'malus-caps', type: 'malus', poids: 1/70, nom: 'MAJUSCULES pendant 2h', desc: 'Doit parler en MAJUSCULES pendant 2h' },
    { id: 'malus-boomer', type: 'malus', poids: 1/75, nom: 'Mode Boomer pendant 2h', desc: 'Parle comme un boomer sur Facebook pendant 2h' },
    { id: 'malus-brise-bouclier', type: 'malus', poids: 1/30, nom: 'Brise-Bouclier', desc: 'Détruit instantanément toutes tes charges de bouclier' },
    { id: 'malus-echo', type: 'malus', poids: 1/40, nom: 'Écho condescendant pendant 1h', desc: 'Cacabot te lâche des remarques cassantes sous tes messages pendant 1h' },
    { id: 'malus-existentiel', type: 'malus', poids: 1/60, nom: 'Crise existentielle pendant 2h', desc: 'Finit chaque phrase par une conclusion sombre pendant 2h' },
    { id: 'malus-linkedin', type: 'malus', poids: 1/65, nom: 'Gourou LinkedIn pendant 2h', desc: 'Finit chaque phrase par un cliché de gourou corporate pendant 2h' },
    { id: 'malus-censure', type: 'malus', poids: 1/85, nom: 'Censure pendant 2h', desc: 'Un mot sur 3 est censuré (▇▇) pendant 2h' },
    { id: 'malus-exclu-heure', type: 'malus', poids: 1/100, nom: 'Exclusion de 1 heure', desc: 'Exclusion de 1 heure' },
    { id: 'malus-mots-melanges', type: 'malus', poids: 1/120, nom: 'Mots mélangés pendant 2h', desc: 'Les mots de chaque message sont mélangés pendant 2h' },
    { id: 'malus-pseudo-lock-semaine', type: 'malus', poids: 1/150, nom: 'Pseudo horrible verrouillé pendant 1 semaine', desc: 'Pseudo horrible verrouillé pendant 1 semaine' },
    { id: 'malus-lettres-melangees', type: 'malus', poids: 1/180, nom: 'Lettres mélangées pendant 1h', desc: 'Les lettres de chaque mot sont mélangées pendant 1h' },
    { id: 'malus-limite-100', type: 'malus', poids: 1/220, nom: 'Limite de 100 caractères pendant 2h', desc: 'Messages coupés à 100 caractères maximum pendant 2h' },
    { id: 'malus-limite-30', type: 'malus', poids: 1/270, nom: 'Limite de 30 caractères pendant 1h', desc: 'Messages coupés à 30 caractères maximum pendant 1h' },
    { id: 'malus-leet', type: 'malus', poids: 1/330, nom: 'Leet speak pendant 6h', desc: 'Tous ses messages sont écrits en leet speak pendant 6h' },
    { id: 'malus-lettre-interdite', type: 'malus', poids: 1/400, nom: 'Lettre interdite pendant 6h', desc: 'Ne peut plus utiliser une lettre au hasard pendant 6h' },
    { id: 'malus-uwu-24h', type: 'malus', poids: 1/480, nom: 'UwU obligatoire pendant 6h', desc: 'Doit finir chaque message par UwU pendant 6h' },
    { id: 'malus-prime', type: 'malus', poids: 1/800, nom: 'MALUS PRIME', desc: 'Cumule TOUS les malus de texte/pseudo en même temps' },
    { id: 'malus-pseudo-lock-mois', type: 'malus', poids: 1/900, nom: 'Pseudo horrible verrouillé pendant 1 mois', desc: 'Pseudo horrible verrouillé pendant 1 mois' },
    { id: 'malus-exclu-jour', type: 'malus', poids: 1/1000, nom: 'Exclusion de 1 jour', desc: 'Exclusion de 1 jour' },
    { id: 'malus-exclu-semaine', type: 'malus', poids: 1/1200, nom: 'Exclusion de 1 semaine', desc: 'Exclusion de 1 semaine' },
    { id: 'malus-ban', type: 'malus', poids: 1/15000, nom: 'Ban définitif', desc: 'Ban définitif' },
    { id: 'special-vote-immunite-exclusion', type: 'special', poids: 1/125, nom: 'Vote public', desc: 'Vote public : tirage à volonté pendant 1min ou exclusion 1 jour' },
    { id: 'special-tournee-generale', type: 'special', poids: 1/600, nom: 'Tournée générale', desc: 'Tournée générale ! Les cooldowns sont éteints pendant 1 minute' }
];

const ROULETTE_NOMS = Object.fromEntries(ROULETTE_TABLE.map(e => [e.id, e.nom]));
const ROULETTE_ID_VERS_SLUG = Object.fromEntries(Object.entries(ROULETTE_NOMS_COMMANDES).map(([slug, id]) => [id, slug]));

const ROULETTE_EMOJIS_PAR_ID = {
    'bonus-epsys-petitdej': '🍳', 'bonus-epsys-goodies': '🎁', 'bonus-youtube-credit': '📹',
    'bonus-elu-roulette': '🎖️', 'bonus-epsys-photo': '📸', 'bonus-epsys-5e': '💶',
    'malus-ban': '☠️', 'bonus-commande-perso': '🛠️', 'bonus-twitch-jeu': '🎮',
    'malus-pseudo-lock-mois': '🔒', 'bonus-legendaire': '👑', 'malus-exclu-semaine': '🚫',
    'bonus-role-superieur': '🏆', 'malus-pseudo-lock-semaine': '🔐', 'special-vote-immunite-exclusion': '🗳️',
    'bonus-redirect-malus': '😈', 'malus-exclu-jour': '🚫', 'malus-lettre-interdite': '🔤',
    'malus-uwu-24h': '😳', 'bonus-couronne': '👑', 'malus-exclu-heure': '🚫',
    'bonus-super-bouclier': '🔰', 'malus-timeout-20min': '🔇', 'bonus-jackpot-boost': '📈',
    'malus-timeout-5min': '🔇', 'bonus-gif-ou-audio': '🎉', 'bonus-anti-feur': '🛡️', 'bonus-coup-triple': '🎰',
    'bonus-cooldown-court': '⚡', 'malus-timeout-3min': '🔇', 'bonus-bouclier': '🛡️', 'bonus-redirect-choix': '🎯',
    'bonus-pseudo-choix': '✏️', 'bonus-epingle': '📌', 'malus-emoji': '😀', 'malus-leet': '🤖',
    'malus-caps': '🔠', 'malus-emoji-only': '🙂', 'malus-censure': '▇', 'malus-mots-melanges': '🔀',
    'malus-lettres-melangees': '🔡', 'malus-limite-100': '✂️', 'malus-limite-30': '✂️',
    'special-tournee-generale': '🥂', 'malus-cooldown-45': '⏳', 'malus-prime': '💥', 'malus-bebe': '🍼',
    'malus-chat-noir': '🐈‍⬛', 'malus-boomer': '🧓',
    'malus-brise-bouclier': '🪓', 'malus-echo': '🪞',
    'malus-existentiel': '🥀', 'malus-linkedin': '👔'
};

const ROULETTE_FAILS = [
    "Retente ta chance dans 15 minutes ptdr", "Le hasard, ce traître 😔", "Nan là c'est mort", "Nope",
    "Raté, dommage", "Tout caca ce tirage...", "Rien du tout mdr", "C'est chiant ça fait tourner en rond pour rien",
    "OH! T'as rien gagné.", "OH MON DIEU! Rien.", "Nsm la roulette", "Bon bah salut hein.",
    "Rien, comme prévu", "Continue d'y croire, hein", "Nada", "Rien, à la prochaine!", "Ça pue", "Bah non",
    "T'y crois trop toi", "Aucun résultat, tkt", "Ptdrrr rien", "Reviens dans 15min lol", "Toujours rien avec toi",
    "Bof...", "Raté.", "Erreur_404", "Zéro, comme d'hab", "Ça sert à rien de réessayer tout de suite",
    "Chance de merde", "Rip ton tirage", "C'est mort pour cette fois", "Aucun résultat ptdr", "Nan",
    "Rien à dire de plus", "Vide total", "Rien du tout", "C'est pas ton jour on dirait", "Meh", "Retente ta chance",
    "Rien mdr désolé", "C'est raté", "Bon bah à toute à l'heure !", "Le hasard, le hasard...", "Toujours rien",
    "Pas de nouvelle, bonne nouvelle !", "Bof bof", "FF", "Ratio", "Hmmm, je crois qu'il y a rien... A moins que... Ah non, y a rien.",
    "Rien à signaler", "Naaaan", "Au revoir, bisous.   -Maman", "Rien, dsl", "[Insérer musique à la trompette]",
    "[Insérer musique triste au violon]", "Mdr t'espérais quoi", "Bah rien en fait", "Aucun effet", "C'est mort", "Ptdr non", "Rien pour toi",
    "Nul", "C'est un peu trop  calme... J'aime pas trop beaucoup ça...", "Aucun résultat, ratio", "C'est vide", "Chance en carton",
    "Ah.", "Rien, essaie encore. 'Fin pas tout de suite mais dans 15 minutes, quoi.", "Bof franchement", "Rip", "Nan c'est raté", "Rien du tout, sois pas triste",
    "Aucun résultat mdrrr", "C'est raté, tant pis", "Nul ce tirage", "Chance zéro", "Ptdr t'as rien eu",
    "Rien, la prochaine fois peut-être", "Nan, rien", "Aucun bonus, dommage", "C'est raté, à plus", "Rien de fou", "Chance ratée", "Mdr encore raté",
    "Nan c'est nul ce tirage", "Rien pour cette fois", "C'est mort, retente", "Aucun résultat",
    "Bof, rien", "Nul comme d'hab", "Rien à faire", "C'est vide", "Chance à chier", "Ptdr rien du tout",
    "Nan c'est raté, dommage", "Rien, la chance n'est pas de ton côté aujourd'hui"
];

const ROULETTE_NOMS_PSEUDO_LOCK = [
    "Caca boudin", "Diarrhée explosive", "_XxD4rkSasuk3xX_", "BardellaLover69", "Sam Gratlékouy", "CharlieKirkFanAccountV2",
    "Pierre Chabrier", "SansPlomb95", "Cherche une copine sur Maubeuge", "https://youtu.be/vCIG5VeP_I0",
    "Oestrodose", "Puff goût paf"
];

const ROULETTE_RANGS = [
    { id: '720080477926457476', label: 'Regaïen.ne' },
    { id: '720080749360971817', label: 'Regaïen.ne amateur.e' },
    { id: '720080968396046428', label: 'Regaïen.ne bavard.e' },
    { id: '720081125438914690', label: 'Regaïen.ne populaire' },
    { id: '1230643204664070328', label: 'Regaïen.ne légendraire' }
];

// Maps d'état
const rouletteFreeRollUntil = new Map();
const rouletteCooldowns = new Map();
const rouletteCouronneUntil = new Map();
const rouletteAntiFeurUntil = new Map();
const rouletteCoupTripleCharges = new Map();
const rouletteCoupTripleScore = new Map();
const rouletteFreeRollCompteur = new Map();
const rouletteHappyHourCompteur = new Map();
const rouletteAntiFeurDodges = new Map();
const roulettePapayouDaily = new Map();
const rouletteMalusConsecutifs = new Map();
const rouletteMalusDifferents = new Map();
const rouletteRedirectCharges = new Map();
const roulettePseudoLock = new Map();
const rouletteImmuniteUntil = new Map();
const rouletteResultats = new Map();
const rouletteChoixEnAttente = new Set();
const rouletteUwuUntil = new Map();
const rouletteLettreInterdite = new Map();
const rouletteEmojiUntil = new Map();
const rouletteLeetUntil = new Map();
const rouletteTransfos = new Map();
const rouletteInventaire = new Map();
let rouletteTourneeJusquA = 0;
const rouletteCooldown45Charges = new Map();
const rouletteCooldownCourtCharges = new Map();
const rouletteBouclierActif = new Map();
const rouletteJackpotBoostCharges = new Map();
const rouletteJackpotBoostValue = new Map();
const rouletteRedirectChoixCible = new Map();
const rouletteJackpotBonus = new Map();
const rouletteStats = new Map();
const rouletteAchievements = new Map();
const roulettePity = new Map();
const rouletteTimeoutUntil = new Map();
const rouletteWebhooks = new Map();
const rouletteNotifs = new Map();
const rouletteNotifTimers = new Map();
let dernierEnvoiHappyHour = null;

const ROULETTE_ETATS = {
    cooldowns: rouletteCooldowns,
    freeRoll: rouletteFreeRollUntil,
    couronne: rouletteCouronneUntil,
    antiFeur: rouletteAntiFeurUntil,
    coupTriple: rouletteCoupTripleCharges,
    pseudoLock: roulettePseudoLock,
    redirectCharges: rouletteRedirectCharges,
    pity: roulettePity,
    uwu: rouletteUwuUntil,
    lettreInterdite: rouletteLettreInterdite,
    emoji: rouletteEmojiUntil,
    leet: rouletteLeetUntil,
    transfos: rouletteTransfos,
    echo: rouletteEchoUntil,
    cooldown45: rouletteCooldown45Charges,
    cooldownCourt: rouletteCooldownCourtCharges,
    bouclier: rouletteBouclierActif,
    jackpotBoostCharges: rouletteJackpotBoostCharges,
    jackpotBoostValue: rouletteJackpotBoostValue,
    redirectChoixCible: rouletteRedirectChoixCible,
    jackpot: rouletteJackpotBonus,
    stats: rouletteStats,
    achievements: rouletteAchievements,
    immunite: rouletteImmuniteUntil,
    timeoutRoulette: rouletteTimeoutUntil,
    notifs: rouletteNotifs,
    malusConsecutifs: rouletteMalusConsecutifs,
    antiFeurDodges: rouletteAntiFeurDodges,
    malusDifferents: rouletteMalusDifferents,
    papayouDaily: roulettePapayouDaily,
    coupTripleScore: rouletteCoupTripleScore,
    happyHourCompteur: rouletteHappyHourCompteur,
    inventaire: rouletteInventaire
};

let bridge = {
    topData: { messages: {} },
    demanderSauvegarde: () => {},
    saveAll: async () => {},
    estAnniversaireAujourdhui: () => false,
    estModo: () => false,
    EPSYS_ID: '436218312574107658',
    findMemberByName: () => ({ found: null, multiple: false, candidates: [] }),
    askDisambiguation: () => {}
};

function initRouletteBridge(b) {
    bridge = { ...bridge, ...b };
    if (b.suggestionsData) ROULETTE_ETATS.suggestions = b.suggestionsData;
}

function estHappyHour() {
    const now = new Date();
    const parisDate = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    return parisDate.getHours() === 20;
}

function verifierHappyHour(client) {
    const now = new Date();
    const paris = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    const h = paris.getHours();
    const m = paris.getMinutes();
    const salon = client?.channels.cache.get(ROULETTE_SALON_ID);
    if (!salon) return;

    if (h === 20 && m === 0 && dernierEnvoiHappyHour !== '20h00') {
        dernierEnvoiHappyHour = '20h00';
        salon.send('# __🎰 C\'EST L\'HAPPY HOUR SUR LA ROULETTE ! (20h - 21h)__\n🔥 Pendant 1 heure, les cooldowns de tout le monde passent à **5 minutes** au lieu de 15 ! Tentez votre chance !');
    } else if (h === 20 && m === 30 && dernierEnvoiHappyHour !== '20h30') {
        dernierEnvoiHappyHour = '20h30';
        salon.send('# __🎰 PLUS QUE 30 MINUTES D\'HAPPY HOUR !__\n⚡ Les tirages sont toujours à **5 minutes** de cooldown jusqu\'à 21h !');
    } else if (h === 21 && m === 0 && dernierEnvoiHappyHour !== '21h00') {
        dernierEnvoiHappyHour = '21h00';
        salon.send('# __🏁 FIN DE L\'HAPPY HOUR !__\nRetour au cooldown normal de 15 minutes. Merci d\'avoir joué !');
    }
}

function memoriserResultatRoulette(messageId, embed) {
    rouletteResultats.set(messageId, embed);
    if (rouletteResultats.size > 200) rouletteResultats.delete(rouletteResultats.keys().next().value);
}

function buildMenuFallbackRoulette(authorId) {
    const menu = new StringSelectMenuBuilder()
        .setCustomId(`roulette_fallback_${authorId}`)
        .setPlaceholder('Choisis un bonus à la place')
        .addOptions(
            { label: '🎉 Audio PAPAYOU', value: 'bonus-gif-ou-audio' },
            { label: '📈 Boost Jackpot (+25% sur 2 tirages)', value: 'bonus-jackpot-boost' },
            { label: '🔰 Super Bouclier (3 malus parés)', value: 'bonus-super-bouclier' },
            { label: '👑 Couronne pendant 12h', value: 'bonus-couronne' },
            { label: '😈 3 malus redirigés (cumulable)', value: 'bonus-redirect-malus' }
        );
    return new ActionRowBuilder().addComponents(menu);
}

async function deverrouillerSucces(userId, achId, channel) {
    let userAchs = rouletteAchievements.get(userId);
    if (!userAchs) {
        userAchs = {};
        rouletteAchievements.set(userId, userAchs);
    }
    if (userAchs[achId]) return;

    userAchs[achId] = Date.now();
    rouletteAchievements.set(userId, userAchs);
    bridge.demanderSauvegarde();

    const ach = ROULETTE_ACHIEVEMENTS.find(a => a.id === achId);
    if (!ach) return;

    const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle('🎊 SUCCÈS DÉVERROUILLÉ !')
        .setDescription(`<@${userId}> vient d'obtenir le succès **${ach.emoji} ${ach.nom}** !\n\n*${ach.desc}*`)
        .setImage('https://cdn.discordapp.com/attachments/1480756332373213275/1555806751448629410/achievement-unlocked_1.gif');

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`rlt_achs_${userId}_0_${userId}`).setLabel('🎖️ Succès').setStyle(ButtonStyle.Secondary)
    );
    await channel?.send({ embeds: [embed], components: [row] }).catch(() => {});
}

function finitParUnEmoji(texte) {
    return /\p{Extended_Pictographic}\uFE0F?$/u.test(texte.trim());
}

function estMessageExempte(texte, mentionneBot) {
    const t = texte.trim();
    if (/^[!\/]/.test(t)) return true;
    if (mentionneBot || /caca\s?bot/i.test(t)) return true;
    if (/^https?:\/\/\S+$/i.test(t) && /(tenor\.com|giphy\.com|klipy\.com|\.gif(\?|$))/i.test(t)) return true;
    if (/^(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator}|[0-9#*]\uFE0F?\u20E3|[\uFE0F\u200D\u20E3]|<a?:\w+:\d+>|\s)+$/u.test(t)) return true;
    return false;
}

function activerTransfo(userId, type, dureeMs) {
    const t = rouletteTransfos.get(userId) ?? {};
    t[type] = Date.now() + dureeMs;
    rouletteTransfos.set(userId, t);
}

function basculerTransfo(userId, type, dureeMs) {
    const t = rouletteTransfos.get(userId) ?? {};
    if (t[type] && Date.now() < t[type]) {
        delete t[type];
        if (Object.keys(t).length === 0) rouletteTransfos.delete(userId);
        else rouletteTransfos.set(userId, t);
        return true;
    }
    t[type] = Date.now() + dureeMs;
    rouletteTransfos.set(userId, t);
    return false;
}

function surTexte(texte, fn) {
    return texte
        .split(/(<[^>]+>|https?:\/\/\S+|```[\s\S]*?```|`[^`]*`)/g)
        .map((morceau, idx) => idx % 2 === 1 ? morceau : fn(morceau))
        .join('');
}

function melanger(liste) {
    for (let i = liste.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [liste[i], liste[j]] = [liste[j], liste[i]];
    }
    return liste;
}

function appliquerTransfos(userId, texte) {
    const t = rouletteTransfos.get(userId);
    if (!t) return texte;
    const now = Date.now();
    for (const k of Object.keys(t)) if (now >= t[k]) delete t[k];
    if (Object.keys(t).length === 0) { rouletteTransfos.delete(userId); return texte; }

    let r = texte;
    if (t.mots && !r.includes('```')) r = melanger(r.split(/\s+/).filter(Boolean)).join(' ');
    if (t.lettres) r = surTexte(r, m => m.replace(/\p{L}{2,}/gu, mot => melanger([...mot]).join('')));
    if (t.censure) r = surTexte(r, m => m.replace(/\S+/g, mot => Math.random() < 1/3 ? '▇▇' : mot));
    if (t.emojiOnly) r = surTexte(r, m => m.replace(/\S+/g, () => ROULETTE_EMOJIS_ALEATOIRES[Math.floor(Math.random() * ROULETTE_EMOJIS_ALEATOIRES.length)]));
    if (t.bebe) r = surTexte(r, m => m.replace(/j/g, 'z').replace(/J/g, 'Z').replace(/r/g, 'w').replace(/R/g, 'W'));
    if (t.boomer) r = surTexte(r, m => m.replace(/[\.!\?]+/g, '..... ') + ' ' + ROULETTE_BOOMER_FINS[Math.floor(Math.random() * ROULETTE_BOOMER_FINS.length)]);
    if (t.existentiel) r = r + ROULETTE_EXISTENTIEL_FINS[Math.floor(Math.random() * ROULETTE_EXISTENTIEL_FINS.length)];
    if (t.linkedin) r = r + ROULETTE_LINKEDIN_FINS[Math.floor(Math.random() * ROULETTE_LINKEDIN_FINS.length)];
    if (t.caps) r = surTexte(r, m => m.toUpperCase());
    const max = Math.min(t.limite30 ? 30 : Infinity, t.limite100 ? 100 : Infinity);
    if (max !== Infinity && [...r].length > max) r = [...r].slice(0, max).join('').replace(/<[^>]*$/, '');
    return r;
}

function versLeet(texte) {
    const table = { a: '4', e: '3', i: '1', o: '0', s: '5', t: '7' };
    return texte
        .split(/(<[^>]+>|https?:\/\/\S+|```[\s\S]*?```|`[^`]*`)/g)
        .map((morceau, idx) => idx % 2 === 1 ? morceau : morceau.replace(/[aeiost]/gi, c => table[c.toLowerCase()]))
        .join('');
}

function retirerLettre(texte, lettre) {
    const regex = new RegExp(lettre, 'gi');
    return texte
        .split(/(<[^>]+>|https?:\/\/\S+|```[\s\S]*?```|`[^`]*`)/g)
        .map((morceau, idx) => idx % 2 === 1 ? morceau : morceau.replace(regex, ''))
        .join('');
}

function armerNotifRoulette(userId, channelId, client) {
    clearTimeout(rouletteNotifTimers.get(userId));
    const fin = rouletteCooldowns.get(userId) ?? 0;
    const delai = Math.max(fin - Date.now(), 0);
    const timer = setTimeout(async () => {
        rouletteNotifTimers.delete(userId);
        const finActuelle = rouletteCooldowns.get(userId) ?? 0;
        if (Date.now() < finActuelle) return armerNotifRoulette(userId, channelId, client);
        rouletteNotifs.delete(userId);
        const salon = await client.channels.fetch(channelId).catch(() => null);
        if (!salon) return;

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`roulette_tenter_${userId}`).setLabel('🎰 Tenter sa chance').setStyle(ButtonStyle.Primary)
        );
        await salon.send({
            content: `🎰 <@${userId}>, ton cooldown roulette est terminé ! Clique ci-dessous pour relancer immédiatement :`,
            components: [row]
        }).catch(() => {});
    }, Math.min(delai, 2 ** 31 - 1));
    rouletteNotifTimers.set(userId, timer);
}

function buildRowResultatRoulette(authorId, outcomeId, failIndex) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`roulette_probas_res_${authorId}_${outcomeId}_${failIndex}`).setLabel('🎲 Probabilités').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`roulette_notif_${authorId}`).setLabel('🔔 Me prévenir').setStyle(ButtonStyle.Secondary)
    );
}

function buildRouletteTypeEmbed(type) {
    const titres = { bonus: '🎉 Bonus', malus: '💀 Malus', special: '✨ Spéciaux' };
    const lignes = ROULETTE_TABLE
        .filter(e => e.type === type)
        .sort((a, b) => b.poids - a.poids)
        .map(e => {
            const emoji = ROULETTE_EMOJIS_PAR_ID[e.id] ?? '❓';
            const slug = ROULETTE_ID_VERS_SLUG[e.id];
            return slug ? `${emoji} **${e.nom}** — \`${slug}\`` : `${emoji} **${e.nom}**`;
        });
    return new EmbedBuilder()
        .setColor(0xffd20a)
        .setTitle(`${titres[type]} — !roulette`)
        .setDescription(lignes.join('\n'));
}

function probaReelle(entry) {
    const total = ROULETTE_TABLE.reduce((s, e) => s + e.poids, 0);
    return entry.poids * (1 - ROULETTE_TAUX_ECHEC) / total;
}

function arrondiJoli(n) {
    if (n < 20) return Math.round(n);
    if (n < 100) return Math.round(n / 5) * 5;
    if (n < 1000) return Math.round(n / 10) * 10;
    if (n < 5000) return Math.round(n / 100) * 100;
    return Math.round(n / 500) * 500;
}

function probaAffichee(p) {
    const n = arrondiJoli(1 / p);
    const pct = 100 / n;
    return { n, pct: pct >= 0.1 ? String(parseFloat(pct.toFixed(2))) : pct.toFixed(3) };
}

function piocherRoulette(pool, totalGlobal, defaut) {
    let tirage = Math.random() * totalGlobal;
    for (const e of pool) {
        if (tirage < e.poids) return e.id;
        tirage -= e.poids;
    }
    return defaut;
}

function tirerRoulette(userId, guildId = null) {
    const pity = roulettePity.get(userId) ?? { malus: 0, nuls: 0 };
    const garanti = pity.malus >= ROULETTE_PITY_MALUS || pity.nuls >= ROULETTE_PITY_NULS;

    let outcomeId;
    if (garanti) {
        const bonus = ROULETTE_TABLE.filter(e => e.type === 'bonus');
        outcomeId = piocherRoulette(bonus, bonus.reduce((s, e) => s + e.poids, 0), bonus[bonus.length - 1].id);
    } else {
        const boostCharges = rouletteJackpotBoostCharges.get(userId) || 0;
        const boostVal = boostCharges > 0 ? (rouletteJackpotBoostValue.get(userId) || 0.25) : 0;
        const boostAnniv = bridge.estAnniversaireAujourdhui(guildId, userId) ? 0.50 : 0;
        const totalJackpot = (rouletteJackpotBonus.get(userId) || 0) + boostVal + boostAnniv;

        if (totalJackpot > 0 && Math.random() < totalJackpot) {
            const bonus = ROULETTE_TABLE.filter(e => e.type === 'bonus');
            outcomeId = piocherRoulette(bonus, bonus.reduce((s, e) => s + e.poids, 0), bonus[bonus.length - 1].id);
        } else {
            const total = ROULETTE_TABLE.reduce((s, e) => s + e.poids, 0);
            outcomeId = piocherRoulette(ROULETTE_TABLE, total / (1 - ROULETTE_TAUX_ECHEC), 'aucun-resultat');
        }
    }

    const type = ROULETTE_TABLE.find(e => e.id === outcomeId)?.type;
    if (type === 'bonus') {
        roulettePity.delete(userId);
        rouletteJackpotBonus.delete(userId);
    } else if (type === 'malus') {
        pity.malus++; roulettePity.set(userId, pity);
    } else if (outcomeId === 'aucun-resultat') {
        pity.nuls++; roulettePity.set(userId, pity);
        const actuel = rouletteJackpotBonus.get(userId) || 0;
        rouletteJackpotBonus.set(userId, Math.min(ROULETTE_JACKPOT_MAX, actuel + ROULETTE_JACKPOT_INCREMENT));
    }
    return outcomeId;
}

function estImmuniseRoulette(userId) {
    const fin = rouletteImmuniteUntil.get(userId);
    if (!fin) return false;
    if (Date.now() >= fin) { rouletteImmuniteUntil.delete(userId); return false; }
    return true;
}

function annulerTiragesAGogo(userId) {
    rouletteFreeRollUntil.delete(userId);
    rouletteCoupTripleCharges.delete(userId);
}

function malusDiffere(message, nom, titre, futur, passe, action) {
    message.differe = { action, texteFinal: `💀 **${nom}** ${passe}.` };
    return `⚠️ **${nom}**, tu es tombé.e sur le malus **${titre}** : tu seras ${futur}.\nProfite de tes **10 dernières secondes** !`;
}

async function appliquerEtDecrireResultat(outcomeId, message, auteurNom, failIndex) {
    const member = message.member;
    const estModoUser = bridge.estModo(member);

    switch (outcomeId) {
        case 'malus-timeout-3min':
            if (estImmuniseRoulette(member.id)) return `🛡️ **${auteurNom}** est immunisé·e et évite le mute de 3 minutes !`;
            if (estModoUser) return `🛡️ **${auteurNom}** est Modo : le mute de 3 minutes est annulé !`;
            annulerTiragesAGogo(member.id);
            await member.timeout(3 * 60 * 1000, 'Roulette').catch(() => {});
            rouletteTimeoutUntil.set(member.id, Date.now() + 3 * 60 * 1000);
            return `**${auteurNom}** est mute pendant **3 minutes**.`;
        case 'malus-timeout-5min':
            if (estImmuniseRoulette(member.id)) return `🛡️ **${auteurNom}** est immunisé·e et évite le mute de 5 minutes !`;
            if (estModoUser) return `🛡️ **${auteurNom}** est Modo : le mute de 5 minutes est annulé !`;
            annulerTiragesAGogo(member.id);
            await member.timeout(5 * 60 * 1000, 'Roulette').catch(() => {});
            rouletteTimeoutUntil.set(member.id, Date.now() + 5 * 60 * 1000);
            return `**${auteurNom}** est mute pendant **5 minutes**.`;
        case 'malus-timeout-20min':
            if (estImmuniseRoulette(member.id)) return `🛡️ **${auteurNom}** est immunisé·e et évite le mute de 20 minutes !`;
            annulerTiragesAGogo(member.id);
            if (estModoUser) {
                rouletteCooldowns.set(member.id, Date.now() + 20 * 60 * 1000);
                return `🛡️ **${auteurNom}** est Modo : le mute de 20 minutes est remplacé par un cooldown de **20 minutes**.`;
            }
            await member.timeout(20 * 60 * 1000, 'Roulette').catch(() => {});
            rouletteTimeoutUntil.set(member.id, Date.now() + 20 * 60 * 1000);
            return `**${auteurNom}** est mute pendant **20 minutes**.`;
        case 'malus-exclu-heure':
            if (estImmuniseRoulette(member.id)) return `🛡️ **${auteurNom}** est immunisé·e et évite l'exclusion de 1 heure !`;
            annulerTiragesAGogo(member.id);
            if (estModoUser) {
                rouletteCooldowns.set(member.id, Date.now() + 60 * 60 * 1000);
                return `🛡️ **${auteurNom}** est Modo : l'exclusion de 1 heure est remplacée par un cooldown de **1 heure**.`;
            }
            return malusDiffere(message, auteurNom, 'Exclusion de 1 heure', 'exclu.e pendant **1 heure**', 'a été exclu.e pendant **1 heure**',
                () => {
                    member.timeout(60 * 60 * 1000, 'Roulette').catch(() => {});
                    rouletteTimeoutUntil.set(member.id, Date.now() + 60 * 60 * 1000);
                });
        case 'malus-exclu-jour':
            if (estImmuniseRoulette(member.id)) return `🛡️ **${auteurNom}** est immunisé·e et évite l'exclusion de 1 jour !`;
            deverrouillerSucces(member.id, 'silence-radio', message.channel);
            annulerTiragesAGogo(member.id);
            if (estModoUser) {
                rouletteCooldowns.set(member.id, Date.now() + 24 * 60 * 60 * 1000);
                return `🛡️ **${auteurNom}** est Modo : l'exclusion de 1 jour est remplacée par un cooldown de **1 jour**.`;
            }
            return malusDiffere(message, auteurNom, 'Exclusion de 1 jour', 'exclu.e pendant **1 jour**', 'a été exclu.e pendant **1 jour**',
                () => {
                    member.timeout(24 * 60 * 60 * 1000, 'Roulette').catch(() => {});
                    rouletteTimeoutUntil.set(member.id, Date.now() + 24 * 60 * 60 * 1000);
                });
        case 'malus-exclu-semaine':
            deverrouillerSucces(member.id, 'survivant-enfer', message.channel);
            if (estImmuniseRoulette(member.id)) return `🛡️ **${auteurNom}** est immunisé·e et évite l'exclusion de 1 semaine !`;
            annulerTiragesAGogo(member.id);
            if (estModoUser) {
                rouletteCooldowns.set(member.id, Date.now() + 7 * 24 * 60 * 60 * 1000);
                return `🛡️ **${auteurNom}** est Modo : l'exclusion de 1 semaine est remplacée par un cooldown de **1 semaine**.`;
            }
            return malusDiffere(message, auteurNom, 'Exclusion de 1 semaine', 'exclu.e pendant **1 semaine**', 'a été exclu.e pendant **1 semaine**',
                () => {
                    member.timeout(7 * 24 * 60 * 60 * 1000, 'Roulette').catch(() => {});
                    rouletteTimeoutUntil.set(member.id, Date.now() + 7 * 24 * 60 * 60 * 1000);
                });
        case 'bonus-gif-ou-audio': {
            const todayStr = new Date().toDateString();
            const rec = roulettePapayouDaily.get(member.id) ?? { date: todayStr, count: 0 };
            rec.count = rec.date === todayStr ? rec.count + 1 : 1;
            rec.date = todayStr;
            roulettePapayouDaily.set(member.id, rec);
            if (rec.count >= 3) deverrouillerSucces(member.id, 'fan-carlos', message.channel);
            await message.channel.send({ files: ["./PAPAYOU.mp3"] }).catch(() => {});
            return `**${auteurNom}** a fait spawn un petit cadeau !`;
        }
        case 'bonus-anti-feur':
            rouletteAntiFeurUntil.set(member.id, Date.now() + 24 * 60 * 60 * 1000);
            return `🛡️ **${auteurNom}** est immunisé·e contre Cacabot pendant **24h** ! Il réagira avec 🛡️ à la place de Feur.`;
        case 'bonus-coup-triple': {
            rouletteCooldowns.delete(member.id);
            const chargesActuelles = rouletteCoupTripleCharges.get(member.id) || 0;
            const totalCharges = chargesActuelles + 3;
            rouletteCoupTripleCharges.set(member.id, totalCharges);
            return `🎰 **${auteurNom}** décroche le **COUP TRIPLE** ! **3 tirages supplémentaires** immédiats et sans aucun cooldown (${totalCharges} en réserve) !`;
        }
        case 'bonus-twitch-jeu':
            await message.channel.send(`Bravo ! Tu as gagné le choix du jeu du prochain stream Twitch (jeu court uniquement) ! <@${bridge.EPSYS_ID}> viendra te voir pour en discuter✨`);
            await message.channel.send({ files: ["https://media.tenor.com/PxSJqqZ_lDsAAAAM/jdg-joueur-du-grenier.gif"] }).catch(() => {});
            return `**${auteurNom}** a gagné le choix du jeu du prochain stream !`;
        case 'bonus-commande-perso':
            await message.channel.send(`Bravo ! Tu as gagné le droit d'ajouter une commande de ton choix à Cacabot (modifiable par les admins) ! <@${bridge.EPSYS_ID}> viendra te voir pour en discuter✨`);
            await message.channel.send({ files: ["https://media.tenor.com/PxSJqqZ_lDsAAAAM/jdg-joueur-du-grenier.gif"] }).catch(() => {});
            return `**${auteurNom}** a gagné une commande Cacabot personnalisée !`;
        case 'bonus-epsys-5e':
            deverrouillerSucces(member.id, 'argent-epsys', message.channel);
            await message.channel.send(`Bravo ! Tu as gagné 5€ de la YouTube Money d'Epsys ! <@${bridge.EPSYS_ID}> viendra te voir pour en discuter✨`);
            await message.channel.send({ files: ["https://media.tenor.com/PxSJqqZ_lDsAAAAM/jdg-joueur-du-grenier.gif"] }).catch(() => {});
            return `**${auteurNom}** a gagné 5€ !`;
        case 'bonus-epsys-photo':
            await message.channel.send(`Bravo ! Tu as gagné une photo disgracieuse d'Epsys signée et envoyée chez toi par la Poste ! <@${bridge.EPSYS_ID}> viendra te voir pour en discuter✨`);
            await message.channel.send({ files: ["https://media.tenor.com/PxSJqqZ_lDsAAAAM/jdg-joueur-du-grenier.gif"] }).catch(() => {});
            return `**${auteurNom}** a gagné une photo disgracieuse d'Epsys !`;
        case 'bonus-youtube-credit':
            await message.channel.send(`WOW, ça c'est de la chance ! Ton pseudo crédité sous chaque vidéo YouTube d'Epsys à partir d'aujourd'hui ! <@${bridge.EPSYS_ID}> viendra te voir pour en discuter✨`);
            await message.channel.send({ files: ["https://media.tenor.com/PxSJqqZ_lDsAAAAM/jdg-joueur-du-grenier.gif"] }).catch(() => {});
            return `**${auteurNom}** a gagné un crédit YouTube !`;
        case 'bonus-epsys-goodies':
            await message.channel.send(`Bravo ! Tu as gagné un goodie Epsys gratuit au choix (T-Shirt/Mug/Lot de 5 pin's) ! <@${bridge.EPSYS_ID}> viendra te voir pour en discuter✨`);
            await message.channel.send({ files: ["https://media.tenor.com/PxSJqqZ_lDsAAAAM/jdg-joueur-du-grenier.gif"] }).catch(() => {});
            return `**${auteurNom}** a gagné un goodie Epsys !`;
        case 'bonus-epsys-petitdej':
            await message.channel.send(`QUOI ?? Je pensais même pas que quelqu'un pouvait l'avoir ! Lors d'une prochaine convention ou rencontre IRL, Epsys devra t'apporter un petit déjeuner en maid dress x) <@${bridge.EPSYS_ID}> viendra te voir pour en discuter✨`);
            await message.channel.send({ files: ["https://media.tenor.com/PxSJqqZ_lDsAAAAM/jdg-joueur-du-grenier.gif"] }).catch(() => {});
            return `**${auteurNom}** a gagné le petit déj légendaire !`;
        case 'bonus-elu-roulette': {
            const roleId = '1553670290448457829';
            if (member.roles.cache.has(roleId)) return `**${auteurNom}** a déjà le rôle **Élu·e de la Roulette** — pas de doublon possible !`;
            await member.roles.add(roleId).catch(() => {});
            return `👑 **${auteurNom}** obtient le rôle **Élu·e de la Roulette** !`;
        }
        case 'bonus-role-superieur': {
            deverrouillerSucces(member.id, 'ascension-sociale', message.channel);
            let rangActuel = -1;
            for (let i = ROULETTE_RANGS.length - 1; i >= 0; i--) {
                if (member.roles.cache.has(ROULETTE_RANGS[i].id)) { rangActuel = i; break; }
            }
            if (rangActuel === ROULETTE_RANGS.length - 1) return `**${auteurNom}** est déjà **${ROULETTE_RANGS[rangActuel].label}**, le rang max !\nChoisis un autre bonus à la place dans le menu ci-dessous.`;
            const prochainRang = ROULETTE_RANGS[rangActuel + 1];
            if (rangActuel > 0) await member.roles.remove(ROULETTE_RANGS[rangActuel].id).catch(() => {});
            await member.roles.add(prochainRang.id).catch(() => {});
            return `**${auteurNom}** passe au rang **${prochainRang.label}** !`;
        }
        case 'bonus-legendaire': {
            deverrouillerSucces(member.id, 'ascension-sociale', message.channel);
            const roleId = ROULETTE_RANGS[ROULETTE_RANGS.length - 1].id;
            if (member.roles.cache.has(roleId)) return `**${auteurNom}** est déjà **${ROULETTE_RANGS[ROULETTE_RANGS.length - 1].label}**, le rang max !\nChoisis un autre bonus à la place dans le menu ci-dessous.`;
            for (const rang of ROULETTE_RANGS) {
                if (rang.id !== ROULETTE_RANGS[0].id && member.roles.cache.has(rang.id)) await member.roles.remove(rang.id).catch(() => {});
            }
            await member.roles.add(roleId).catch(() => {});
            return `👑 **${auteurNom}** passe directement au rang **Regaïen·ne légendaire** !`;
        }
        case 'bonus-jackpot-boost': {
            const curCharges = rouletteJackpotBoostCharges.get(member.id) || 0;
            const curVal = rouletteJackpotBoostValue.get(member.id) || 0;
            const newCharges = curCharges + 2;
            const newVal = curVal + 0.25;
            rouletteJackpotBoostCharges.set(member.id, newCharges);
            rouletteJackpotBoostValue.set(member.id, newVal);
            return `📈 **${auteurNom}** active un **BOOST JACKPOT IMMÉDIAT** ! **+${Math.round(newVal * 100)}% de chance de bonus** sur ses **${newCharges} prochains tirages** (cumulable) !`;
        }
        case 'bonus-super-bouclier': {
            const actuelles = rouletteBouclierActif.get(member.id) || 0;
            const total = actuelles + 3;
            rouletteBouclierActif.set(member.id, total);
            if (total >= 10) deverrouillerSucces(member.id, 'forteresse', message.channel);
            return `🔰 **${auteurNom}** décroche le **SUPER BOUCLIER** ! **+3 charges de bouclier** ajoutées (${total} en réserve) !`;
        }
        case 'malus-ban':
            deverrouillerSucces(member.id, 'survivant-enfer', message.channel);
            if (estImmuniseRoulette(member.id)) return `🛡️ **${auteurNom}** est immunisé·e et évite le ban définitif !`;
            annulerTiragesAGogo(member.id);
            if (estModoUser) {
                rouletteCooldowns.set(member.id, Date.now() + 7 * 24 * 60 * 60 * 1000);
                return `🛡️ **${auteurNom}** est Modo : le ban est remplacé par un cooldown de **1 semaine**.`;
            }
            return malusDiffere(message, auteurNom, 'Ban définitif', 'banni.e du serveur', 'a été banni.e du serveur', () => member.ban({ reason: 'Roulette' }).catch(() => {}));
        case 'bonus-couronne':
            deverrouillerSucces(member.id, 'laristocrate', message.channel);
            rouletteCouronneUntil.set(member.id, Date.now() + 12 * 60 * 60 * 1000);
            return `👑 **${auteurNom}** est officiellement respecté·e par Cacabot pendant **12h** !`;
        case 'malus-pseudo-lock-semaine': {
            const pseudo = ROULETTE_NOMS_PSEUDO_LOCK[Math.floor(Math.random() * ROULETTE_NOMS_PSEUDO_LOCK.length)];
            roulettePseudoLock.set(member.id, { until: Date.now() + 7 * 24 * 60 * 60 * 1000, pseudo });
            await member.setNickname(pseudo).catch(() => {});
            return `**${auteurNom}** se retrouve avec le pseudo **${pseudo}**, verrouillé pendant **1 semaine** !`;
        }
        case 'malus-pseudo-lock-mois': {
            const pseudo = ROULETTE_NOMS_PSEUDO_LOCK[Math.floor(Math.random() * ROULETTE_NOMS_PSEUDO_LOCK.length)];
            roulettePseudoLock.set(member.id, { until: Date.now() + 30 * 24 * 60 * 60 * 1000, pseudo });
            await member.setNickname(pseudo).catch(() => {});
            return `**${auteurNom}** se retrouve avec le pseudo **${pseudo}**, verrouillé pendant **1 mois** !`;
        }
        case 'malus-uwu-24h': {
            const finUwu = rouletteUwuUntil.get(member.id);
            if (finUwu && Date.now() < finUwu) {
                rouletteUwuUntil.delete(member.id);
                return `✨ **Miracle !** **${auteurNom}** retombe sur le malus **UwU** alors qu'il était encore actif : il est **annulé** !`;
            }
            rouletteUwuUntil.set(member.id, Date.now() + 6 * 60 * 60 * 1000);
            return `**${auteurNom}** doit terminer chacun de ses messages par **UwU** pendant **6h** !`;
        }
        case 'malus-lettre-interdite': {
            const lockLettre = rouletteLettreInterdite.get(member.id);
            if (lockLettre && Date.now() < lockLettre.until) {
                rouletteLettreInterdite.delete(member.id);
                return `✨ **Miracle !** **${auteurNom}** retombe sur la **lettre interdite** alors qu'elle était encore active : elle est **annulée** !`;
            }
            const lettre = String.fromCharCode(65 + Math.floor(Math.random() * 26));
            rouletteLettreInterdite.set(member.id, { until: Date.now() + 6 * 60 * 60 * 1000, lettre });
            return `**${auteurNom}** ne peut plus utiliser la lettre **${lettre}** pendant **6h** !`;
        }
        case 'bonus-redirect-malus': {
            const total = (rouletteRedirectCharges.get(member.id) || 0) + 3;
            rouletteRedirectCharges.set(member.id, total);
            return `😈 **${auteurNom}** peut rediriger ses **3 prochains malus** vers un·e autre membre ! (${total} en réserve)`;
        }
        case 'malus-emoji': {
            const finEmoji = rouletteEmojiUntil.get(member.id);
            if (finEmoji && Date.now() < finEmoji) {
                rouletteEmojiUntil.delete(member.id);
                return `✨ **Miracle !** **${auteurNom}** retombe sur l'**emoji obligatoire** alors qu'il était encore actif : il est **annulé** !`;
            }
            rouletteEmojiUntil.set(member.id, Date.now() + 6 * 60 * 60 * 1000);
            return `**${auteurNom}** doit terminer chacun de ses messages par un **emoji aléatoire** pendant **6h** !`;
        }
        case 'malus-chat-noir':
            if ((rouletteJackpotBonus.get(member.id) || 0) >= 0.05) deverrouillerSucces(member.id, 'chat-noir', message.channel);
            roulettePity.delete(member.id);
            rouletteJackpotBonus.delete(member.id);
            return `🐈‍⬛ **${auteurNom}** subit la **Malédiction du Chat Noir** : sa pity et son bonus jackpot accumulés sont réduits à zéro !`;
        case 'malus-caps':
            if (basculerTransfo(member.id, 'caps', 2 * 60 * 60 * 1000)) return `✨ **Miracle !** **${auteurNom}** retombe sur les **MAJUSCULES** alors qu'elles étaient encore actives : le malus est **annulé** !`;
            return `**${auteurNom}** doit **PARLER EN MAJUSCULES** pendant **2h** !`;
        case 'malus-boomer':
            if (basculerTransfo(member.id, 'boomer', 2 * 60 * 60 * 1000)) return `✨ **Miracle !** **${auteurNom}** retombe sur le **mode Boomer** alors qu'il était encore actif : le malus est **annulé** !`;
            return `🧓 **${auteurNom}** passe en **mode Boomer** pendant **2h** ..... A bon entendeur ... !`;
        case 'malus-brise-bouclier': {
            const rawB = rouletteBouclierActif.get(member.id);
            const nbB = typeof rawB === 'number' ? rawB : (rawB ? 1 : 0);
            rouletteBouclierActif.delete(member.id);
            if (nbB > 0) return `🪓 **${auteurNom}** subit le **BRISE-BOUCLIER** : ses **${nbB} charge${nbB > 1 ? 's' : ''} de bouclier** sont réduites en miettes !`;
            return `🪓 **${auteurNom}** subit le **BRISE-BOUCLIER** ! Heureusement, il/elle n'avait aucun bouclier en réserve... mais la menace était bien réelle !`;
        }
        case 'malus-existentiel':
            if (basculerTransfo(member.id, 'existentiel', 2 * 60 * 60 * 1000)) return `✨ **Miracle !** **${auteurNom}** retombe sur la **crise existentielle** : le malus est **annulé** !`;
            return `🥀 **${auteurNom}** entre en pleine **remise en question existentielle** pendant **2h**... à quoi bon ?`;
        case 'malus-linkedin':
            if (basculerTransfo(member.id, 'linkedin', 2 * 60 * 60 * 1000)) return `✨ **Miracle !** **${auteurNom}** retombe sur le **gourou LinkedIn** : le malus est **annulé** !`;
            return `👔 **${auteurNom}** se transforme en **gourou LinkedIn** pendant **2h** ! Soyons agile 🚀`;
        case 'malus-echo': {
            const finEcho = rouletteEchoUntil.get(member.id);
            if (finEcho && Date.now() < finEcho) {
                rouletteEchoUntil.delete(member.id);
                return `✨ **Miracle !** **${auteurNom}** retombe sur l'**écho condescendant** : Cacabot arrête de le/la clasher !`;
            }
            rouletteEchoUntil.set(member.id, Date.now() + 60 * 60 * 1000);
            return `🪞 **${auteurNom}** subit l'**Écho Condescendant** pendant **1h** : Cacabot va lui lâcher ses meilleures remarques cassantes !`;
        }
        case 'malus-emoji-only':
            if (basculerTransfo(member.id, 'emojiOnly', 60 * 60 * 1000)) return `✨ **Miracle !** **${auteurNom}** retombe sur l'**emoji only** alors qu'il était encore actif : le malus est **annulé** !`;
            return `**${auteurNom}** ne peut plus s'exprimer qu'en **emojis** pendant **1h** !`;
        case 'malus-censure':
            if (basculerTransfo(member.id, 'censure', 2 * 60 * 60 * 1000)) return `✨ **Miracle !** **${auteurNom}** retombe sur la **censure** alors qu'elle était encore active : le malus est **annulé** !`;
            return `**${auteurNom}** est **censuré·e** : un mot sur 3 disparaît pendant **2h** !`;
        case 'malus-mots-melanges':
            if (basculerTransfo(member.id, 'mots', 2 * 60 * 60 * 1000)) return `✨ **Miracle !** **${auteurNom}** retombe sur les **mots mélangés** alors qu'ils étaient encore actifs : le malus est **annulé** !`;
            return `**${auteurNom}** a les **mots mélangés** pendant **2h** !`;
        case 'malus-lettres-melangees':
            if (basculerTransfo(member.id, 'lettres', 60 * 60 * 1000)) return `✨ **Miracle !** **${auteurNom}** retombe sur les **lettres mélangées** alors qu'elles étaient encore actives : le malus est **annulé** !`;
            return `**${auteurNom}** a les **lettres mélangées** pendant **1h** !`;
        case 'malus-limite-100':
            if (basculerTransfo(member.id, 'limite100', 2 * 60 * 60 * 1000)) return `✨ **Miracle !** **${auteurNom}** retombe sur la **limite de 100 caractères** alors qu'elle était encore active : le malus est **annulé** !`;
            return `**${auteurNom}** est limité·e à **100 caractères** par message pendant **2h** !`;
        case 'malus-limite-30':
            if (basculerTransfo(member.id, 'limite30', 60 * 60 * 1000)) return `✨ **Miracle !** **${auteurNom}** retombe sur la **limite de 30 caractères** alors qu'elle était encore active : le malus est **annulé** !`;
            return `**${auteurNom}** est limité·e à **30 caractères** par message pendant **1h** !`;
        case 'special-tournee-generale':
            deverrouillerSucces(member.id, 'tournee-patron', message.channel);
            rouletteTourneeJusquA = Date.now() + 60 * 1000;
            return `🍻 **${auteurNom}** paie sa tournée ! **Tous les cooldowns sont éteints pendant 1 minute**, tirez à volonté !`;
        case 'malus-leet': {
            const finLeet = rouletteLeetUntil.get(member.id);
            if (finLeet && Date.now() < finLeet) {
                rouletteLeetUntil.delete(member.id);
                return `✨ **Miracle !** **${auteurNom}** retombe sur le **l33t sp34k** alors qu'il était encore actif : il est **annulé** !`;
            }
            rouletteLeetUntil.set(member.id, Date.now() + 6 * 60 * 60 * 1000);
            return `**${auteurNom}** parle maintenant en **l33t sp34k** pendant **6h** !`;
        }
        case 'malus-bebe':
            if (basculerTransfo(member.id, 'bebe', 2 * 60 * 60 * 1000)) return `✨ **Miracle !** **${auteurNom}** retombe sur le **parler bébé** alors qu'il était encore actif : le malus est **annulé** !`;
            return `🍼 **${auteurNom}** parle maintenant comme un bébé pendant **2h** : ses « j » deviennent des « z » et ses « r » des « w » !`;
        case 'malus-cooldown-45': {
            if ((rouletteCooldown45Charges.get(member.id) || 0) > 0) deverrouillerSucces(member.id, 'double-peine', message.channel);
            annulerTiragesAGogo(member.id);
            rouletteCooldowns.set(member.id, Date.now() + 45 * 60 * 1000);
            rouletteCooldown45Charges.set(member.id, 1);
            return `⏳ **${auteurNom}** aura un cooldown de **45 minutes** sur ses **2 prochains tirages** !`;
        }
        case 'bonus-cooldown-court': {
            const finActuel = rouletteCooldowns.get(member.id);
            if (finActuel && finActuel > Date.now() + 5 * 60 * 1000) rouletteCooldowns.set(member.id, Date.now() + 5 * 60 * 1000);
            rouletteCooldownCourtCharges.set(member.id, 3);
            return `⚡ **${auteurNom}** aura un cooldown de **5 minutes** sur ses **3 prochains tirages** !`;
        }
        case 'bonus-bouclier': {
            const actuelles = rouletteBouclierActif.get(member.id) || 0;
            const total = actuelles + 1;
            rouletteBouclierActif.set(member.id, total);
            if (total >= 10) deverrouillerSucces(member.id, 'forteresse', message.channel);
            return `🛡️ **${auteurNom}** gagne **1 charge de bouclier** (${total} en réserve) : son prochain malus sera annulé !`;
        }
        case 'bonus-redirect-choix': {
            await message.channel.send(`🎯 **${auteurNom}**, tu as gagné le pouvoir de choisir qui prendra ton prochain malus à ta place !\nMentionne la personne de ton choix avec **@membre** dans ce salon (tu as **5 minutes**).`);
            const collector = message.channel.createMessageCollector({
                filter: m => m.author.id === member.id && m.mentions.members.first(),
                time: 5 * 60 * 1000, max: 1
            });
            collector.on('collect', (m) => {
                const cibleChoisie = m.mentions.members.first();
                rouletteRedirectChoixCible.set(member.id, cibleChoisie.id);
                message.channel.send(`✅ C'est enregistré ! Le prochain malus de **${auteurNom}** sera automatiquement envoyé à **${cibleChoisie.displayName}** !`);
            });
            return `🎯 **${auteurNom}** a gagné une redirection de malus au choix !`;
        }
        case 'bonus-pseudo-choix': {
            await message.channel.send(`✍️ **${auteurNom}**, tu as gagné le droit de renommer un·e membre et de bloquer son pseudo pendant **48h** !\nÉcris son **@mention** suivi du **nouveau pseudo** dans les **5 minutes**.`);
            const collector = message.channel.createMessageCollector({
                filter: m => m.author.id === member.id && m.mentions.members.first(),
                time: 5 * 60 * 1000, max: 1
            });
            collector.on('collect', async (m) => {
                const cibleChoisie = m.mentions.members.first();
                const nouveauPseudo = m.content.replace(/<@!?\d+>/g, '').trim().slice(0, 32);
                if (!cibleChoisie || !nouveauPseudo) return message.channel.send(`❌ Format invalide, bonus perdu.`);
                roulettePseudoLock.set(cibleChoisie.id, { until: Date.now() + 48 * 60 * 60 * 1000, pseudo: nouveauPseudo });
                await cibleChoisie.setNickname(nouveauPseudo).catch(() => {});
                deverrouillerSucces(member.id, 'baptiseur', message.channel);
                message.channel.send(`✅ **${cibleChoisie.displayName}** se retrouve avec le pseudo **${nouveauPseudo}**, choisi par **${auteurNom}**, verrouillé pendant **48h** !`);
            });
            return `✍️ **${auteurNom}** a gagné le choix du pseudo d'un·e membre !`;
        }
        case 'bonus-epingle': {
            const collector = message.channel.createMessageCollector({
                filter: m => m.author.id === member.id,
                time: 5 * 60 * 1000, max: 1
            });
            collector.on('collect', async (m) => {
                await m.pin().catch(() => {});
                deverrouillerSucces(member.id, 'epingle', message.channel);
            });
            return `📌 **${auteurNom}** a gagné un droit spécial ! Envoie dans les **5 minutes** le message que tu veux épingler définitivement dans ce salon !`;
        }
        case 'special-vote-immunite-exclusion':
            message.vote = member;
            return `🗳️ **${auteurNom}** déclenche un **vote public** !`;
        case 'malus-prime': {
            deverrouillerSucces(member.id, 'malus-prime', message.channel);
            const fin6h = Date.now() + 6 * 60 * 60 * 1000;
            const lettreAlea = String.fromCharCode(65 + Math.floor(Math.random() * 26));
            rouletteLettreInterdite.set(member.id, { until: fin6h, lettre: lettreAlea });
            rouletteUwuUntil.set(member.id, fin6h);
            rouletteEmojiUntil.set(member.id, fin6h);
            rouletteLeetUntil.set(member.id, fin6h);
            activerTransfo(member.id, 'caps', 2 * 60 * 60 * 1000);
            activerTransfo(member.id, 'mots', 2 * 60 * 60 * 1000);
            activerTransfo(member.id, 'lettres', 60 * 60 * 1000);
            activerTransfo(member.id, 'bebe', 2 * 60 * 60 * 1000);
            return `☠️☠️☠️ **${auteurNom}** subit le **MALUS PRIME** : tous les malus de texte en même temps !`;
        }
        case 'aucun-resultat':
            return ROULETTE_FAILS[failIndex];
        default:
            return `⚠️ Ce résultat n'est pas encore codé.`;
    }
}

function crediterInventaireRoulette(userId, itemKey, quantite = 1) {
    const inv = rouletteInventaire.get(userId) ?? {};
    inv[itemKey] = (inv[itemKey] || 0) + quantite;
    rouletteInventaire.set(userId, inv);
    bridge.demanderSauvegarde();
}

function consommerInventaireRoulette(userId, itemKey) {
    const inv = rouletteInventaire.get(userId) ?? {};
    if (!inv[itemKey] || inv[itemKey] <= 0) return false;
    inv[itemKey]--;
    if (inv[itemKey] <= 0) delete inv[itemKey];
    if (Object.keys(inv).length === 0) rouletteInventaire.delete(userId);
    else rouletteInventaire.set(userId, inv);
    bridge.demanderSauvegarde();
    return true;
}

function buildInventaireEmbed(membre) {
    const inv = rouletteInventaire.get(membre.id) ?? {};
    const items = [];
    const options = [];

    if (inv.freeRoll1Min && inv.freeRoll1Min > 0) {
        items.push(`🎰 **Tirage à volonté (1 min)** : x${inv.freeRoll1Min}`);
        options.push({
            label: '🎰 Tirage à volonté (1 min)',
            description: `Activer 1 session d'1 min (en réserve : x${inv.freeRoll1Min})`,
            value: 'freeRoll1Min'
        });
    }

    const embed = new EmbedBuilder()
        .setColor(0xffd20a)
        .setTitle(`🎒 Inventaire de récompenses — ${membre.displayName}`)
        .setDescription(
            items.length > 0
                ? items.join('\n') + "\n\n*Choisis la récompense à activer dans le menu déroulant ci-dessous :*"
                : "*Ton inventaire est vide pour le moment.*"
        );

    let row = null;
    if (options.length > 0) {
        const menu = new StringSelectMenuBuilder()
            .setCustomId(`rlt_claim_menu_${membre.id}`)
            .setPlaceholder('Sélectionne une récompense à activer...')
            .addOptions(options);
        row = new ActionRowBuilder().addComponents(menu);
    }

    return { embed, row };
}

function buildVoteRouletteEmbed(membre) {
    return new EmbedBuilder()
        .setColor(0xffd20a)
        .setTitle(`🗳️ VOTE PUBLIC ! (${libelleProbaRoulette('special-vote-immunite-exclusion')})`)
        .setDescription(`Que mérite **${membre.displayName}** ?\n\n✅ Tirage à volonté pendant 1min (immunité au mute)\n❌ Exclusion pendant 1 jour\n\nVote ouvert pendant **2h**.`);
}

async function demarrerVoteRoulette(msg, membre) {
    await msg.react('✅').catch(() => {});
    await msg.react('❌').catch(() => {});

    const rappels = setInterval(() => { msg.reply('🆙').catch(() => {}); }, 55 * 60 * 1000);

    setTimeout(async () => {
        clearInterval(rappels);
        try {
            const fresh = await msg.channel.messages.fetch(msg.id).catch(() => null);
            const targetMsg = fresh || msg;

            const reactionOui = targetMsg.reactions.cache.find(r => r.emoji.name?.includes('✅'));
            const reactionNon = targetMsg.reactions.cache.find(r => r.emoji.name?.includes('❌'));

            const usersOui = reactionOui ? await reactionOui.users.fetch().catch(() => new Map()) : new Map();
            const usersNon = reactionNon ? await reactionNon.users.fetch().catch(() => new Map()) : new Map();

            const idsOui = [...usersOui.values()].filter(u => !u.bot).map(u => u.id);
            const idsNon = [...usersNon.values()].filter(u => !u.bot).map(u => u.id);
            const doubles = new Set(idsOui.filter(id => idsNon.includes(id)));
            const oui = idsOui.filter(id => !doubles.has(id)).length;
            const non = idsNon.filter(id => !doubles.has(id)).length;

            const posterReponse = async (texte) => {
                const envoye = await targetMsg.reply(texte).catch(() => null);
                if (!envoye) await targetMsg.channel.send(texte).catch(() => {});
            };

            if (oui >= non) {
                crediterInventaireRoulette(membre.id, 'freeRoll1Min', 1);
                deverrouillerSucces(membre.id, 'innocente', targetMsg.channel);

                const embedVictoire = new EmbedBuilder()
                    .setColor(0x00bf19)
                    .setTitle(`🕊️ JUGEMENT POPULAIRE : INNOCENTÉ.E !`)
                    .setDescription(
                        `La plèbe a parlé avec sagesse (${oui} pour vs ${non} contre) !\n\n` +
                        `🎉 <@${membre.id}>, tu remportes **1 minute de tirage à volonté** (sans cooldown et immunisé aux mutes) !\n\n` +
                        `🎁 **Si tu ne l'utilises pas tout de suite, ton cadeau sera stocké dans ton inventaire.**\nTape \`!roulette claim\` ou \`!rlt claim\` afin de l'activer !`
                    );

                const rowVictoire = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`rlt_claim_freeroll_${membre.id}`)
                        .setLabel('🎰 Activer mon tirage (1 min)')
                        .setStyle(ButtonStyle.Success)
                );

                await targetMsg.channel.send({
                    content: `🔔 <@${membre.id}>, le vote est terminé !`,
                    embeds: [embedVictoire],
                    components: [rowVictoire]
                }).catch(() => {});
            } else {
                deverrouillerSucces(membre.id, 'condamne-plebe', targetMsg.channel);
                if (bridge.estModo(membre)) {
                    rouletteCooldowns.set(membre.id, Date.now() + 24 * 60 * 60 * 1000);
                    await posterReponse(`❌ Le vote a tranché (${non} contre vs ${oui} pour) : **${membre.displayName}** est Modo, exclusion changée en cooldown de **1 jour**.`);
                } else {
                    await membre.timeout(24 * 60 * 60 * 1000, 'Roulette - vote').catch(() => {});
                    rouletteTimeoutUntil.set(membre.id, Date.now() + 24 * 60 * 60 * 1000);
                    await posterReponse(`❌ Le vote a tranché (${non} contre vs ${oui} pour) : **${membre.displayName}** est exclu.e pendant 1 jour.`);
                }
            }
            bridge.demanderSauvegarde();
        } catch (e) {
            console.error('Erreur lors de la conclusion du vote roulette :', e);
            await msg.channel.send(`⚠️ Une erreur est survenue lors du dépouillement du vote pour <@${membre.id}>.`).catch(() => {});
        }
    }, 2 * 60 * 60 * 1000);
}

function buildRoulettePresentationEmbed(authorId, guildId = null) {
    const jackpot = authorId ? (rouletteJackpotBonus.get(authorId) || 0) : 0;
    const boostCharges = authorId ? (rouletteJackpotBoostCharges.get(authorId) || 0) : 0;
    const boostVal = boostCharges > 0 ? (rouletteJackpotBoostValue.get(authorId) || 0.25) : 0;
    const cEstSonAnniv = (authorId && guildId) ? bridge.estAnniversaireAujourdhui(guildId, authorId) : false;

    const fields = [
        { name: 'Présentation de la roulette 🍀', value: "La roulette qui te fait gagner des trucs... ou pas.", inline: false },
        { name: 'Cooldown ⏳', value: "15 minutes", inline: false },
        { name: 'Système de pity 📈', value: `Après **${ROULETTE_PITY_MALUS} malus** ou **${ROULETTE_PITY_NULS} résultats nuls**, bonus garanti au tirage suivant !`, inline: false },
        { name: 'Happy hour 🔥', value: "Tous les soirs de **20h à 21h**, cooldown à **5 minutes** pour tout le monde !", inline: false },
        { name: 'Hall of fame 🏆', value: `Les bonus ultra rares (≤ **${(ROULETTE_HOF_SEUIL * 100).toFixed(2)}%**) dans <#${ROULETTE_HOF_CHANNEL_ID}> !`, inline: false }
    ];

    if (cEstSonAnniv) {
        fields.unshift({
            name: '🎂・JOYEUX ANNIVERSAIRE ! 🎉',
            value: "Boost exceptionnel de **+50% de chance de bonus** offert toute la journée !",
            inline: false
        });
    }

    const totalBoostPct = Math.round((jackpot + boostVal + (cEstSonAnniv ? 0.50 : 0)) * 100);
    if (totalBoostPct > 0) {
        fields.push({ name: 'Bonus boosté 🎰', value: `Chance de bonus augmentée de **+${totalBoostPct}%** !`, inline: false });
    }

    fields.push(
        {
            name: 'Commandes utiles 💡',
            value: "📊 `!roulettestate` | `!rltstate` [membre]\n Voir les effets actifs\n" +
                   "📈 `!roulettestats` | `!rltstats` [membre]\n Voir les statistiques complètes",
            inline: false
        },
        { name: 'Probabilités 🎲', value: "Clique sur **🎲 Probabilités** ci-dessous pour voir toutes les chances !", inline: false }
    );

    const embed = new EmbedBuilder()
        .setColor(cEstSonAnniv ? 0xff69b4 : 0xffd20a)
        .setTitle('🎰 | ROULETTE REGAÏENNE | 🎰')
        .setImage('https://img.draftbot.fr/1790778435185-73ff19eb6e704abb.gif')
        .addFields(fields);

    embed.data.fields = embed.data.fields.map(f => ({ ...f, value: f.value + '\n\u200b' }));
    embed.setFooter({ text: 'Astuce : Envoie [!roulette go] ou [!rlt go] pour tirer directement !' });
    return embed;
}

function buildRouletteStateEmbed(cible, guildId = null) {
    const now = Date.now();
    const tstamp = (ms) => `<t:${Math.ceil(ms / 1000)}:R>`;
    const bonus = [];
    const malus = [];

    if (guildId && bridge.estAnniversaireAujourdhui(guildId, cible.id)) {
        bonus.push('🎂 **Boost Anniversaire** (+50% de chance toute la journée !)');
    }
    if (rouletteCouronneUntil.has(cible.id) && now < rouletteCouronneUntil.get(cible.id)) {
        bonus.push(`👑 Couronne (fin ${tstamp(rouletteCouronneUntil.get(cible.id))})`);
    }
    if (rouletteAntiFeurUntil.has(cible.id) && now < rouletteAntiFeurUntil.get(cible.id)) {
        bonus.push(`🛡️ Immunité anti-feur (fin ${tstamp(rouletteAntiFeurUntil.get(cible.id))})`);
    }
    if (rouletteFreeRollUntil.has(cible.id) && now < rouletteFreeRollUntil.get(cible.id)) {
        bonus.push(`⚡ Tirage à volonté (fin ${tstamp(rouletteFreeRollUntil.get(cible.id))})`);
    }
    if (rouletteImmuniteUntil.has(cible.id) && now < rouletteImmuniteUntil.get(cible.id)) {
        bonus.push(`🛡️ Immunité au timeout (fin ${tstamp(rouletteImmuniteUntil.get(cible.id))})`);
    }
    const invCible = rouletteInventaire.get(cible.id) ?? {};
    if (invCible.freeRoll1Min && invCible.freeRoll1Min > 0) {
        bonus.push(`🎁 **${invCible.freeRoll1Min} tirage(s) à volonté (1 min) en inventaire** (\`!rlt claim\`)`);
    }
    if ((rouletteCoupTripleCharges.get(cible.id) || 0) > 0) {
        bonus.push(`🎰 ${rouletteCoupTripleCharges.get(cible.id)} tirage(s) gratuit(s) sans cooldown`);
    }
    const rawB = rouletteBouclierActif.get(cible.id);
    const nbB = typeof rawB === 'number' ? rawB : (rawB ? 1 : 0);
    if (nbB > 0) bonus.push(`🛡️ ${nbB} charge${nbB > 1 ? 's' : ''} de bouclier`);
    const bJCharges = rouletteJackpotBoostCharges.get(cible.id) || 0;
    if (bJCharges > 0) {
        const bJVal = Math.round((rouletteJackpotBoostValue.get(cible.id) || 0.25) * 100);
        bonus.push(`📈 Boost Jackpot : +${bJVal}% (${bJCharges} tirages restants)`);
    }
    if ((rouletteRedirectCharges.get(cible.id) || 0) > 0) {
        bonus.push(`😈 ${rouletteRedirectCharges.get(cible.id)} redirection(s) de malus`);
    }
    if (rouletteRedirectChoixCible.has(cible.id)) bonus.push('🎯 Redirection de malus au choix en attente');
    if ((rouletteCooldownCourtCharges.get(cible.id) || 0) > 0) {
        bonus.push(`⚡ ${rouletteCooldownCourtCharges.get(cible.id)} tirage(s) à cooldown réduit (5 min)`);
    }

    if (roulettePseudoLock.has(cible.id) && now < roulettePseudoLock.get(cible.id).until) {
        malus.push(`🔒 Pseudo verrouillé (${roulettePseudoLock.get(cible.id).pseudo}) (fin ${tstamp(roulettePseudoLock.get(cible.id).until)})`);
    }
    if (rouletteTimeoutUntil.has(cible.id) && now < rouletteTimeoutUntil.get(cible.id)) {
        malus.push(`💀 Timeout roulette (fin ${tstamp(rouletteTimeoutUntil.get(cible.id))})`);
    }
    if (rouletteUwuUntil.has(cible.id) && now < rouletteUwuUntil.get(cible.id)) {
        malus.push(`😳 Doit finir par UwU (fin ${tstamp(rouletteUwuUntil.get(cible.id))})`);
    }
    if (rouletteLettreInterdite.has(cible.id) && now < rouletteLettreInterdite.get(cible.id).until) {
        malus.push(`🔤 Lettre interdite : **${rouletteLettreInterdite.get(cible.id).lettre}** (fin ${tstamp(rouletteLettreInterdite.get(cible.id).until)})`);
    }
    if (rouletteEmojiUntil.has(cible.id) && now < rouletteEmojiUntil.get(cible.id)) {
        malus.push(`😀 Doit finir par un emoji (fin ${tstamp(rouletteEmojiUntil.get(cible.id))})`);
    }
    if (rouletteLeetUntil.has(cible.id) && now < rouletteLeetUntil.get(cible.id)) {
        malus.push(`🤖 Parle en l33t sp34k (fin ${tstamp(rouletteLeetUntil.get(cible.id))})`);
    }
    if ((rouletteCooldown45Charges.get(cible.id) || 0) > 0) {
        malus.push(`⏳ ${rouletteCooldown45Charges.get(cible.id)} tirage(s) à cooldown 45 min`);
    }

    const tf = rouletteTransfos.get(cible.id) ?? {};
    const libTf = {
        caps: '🔠 Majuscules obligatoires', emojiOnly: '🙂 Emoji only', limite100: '✂️ Limite 100 caractères',
        limite30: '✂️ Limite 30 caractères', mots: '🔀 Mots mélangés', lettres: '🔤 Lettres mélangées',
        censure: '▇ Mots censurés', bebe: '🍼 Parler bébé', boomer: '🧓 Mode Boomer'
    };
    for (const [k, fin] of Object.entries(tf)) {
        if (now < fin && libTf[k]) malus.push(`${libTf[k]} (fin ${tstamp(fin)})`);
    }

    const finCd = rouletteCooldowns.get(cible.id);
    let footerText = '⏳ Cooldown : Aucun (prêt à lancer !)';
    if (finCd && now < finCd) {
        const minsRestantes = Math.ceil((finCd - now) / 60000);
        footerText = `⏳ Cooldown restant : ~${minsRestantes} min`;
    }

    const pity = roulettePity.get(cible.id) ?? { malus: 0, nuls: 0 };
    const jackpotBoost = Math.round((rouletteJackpotBonus.get(cible.id) || 0) * 100);

    const pityTexte = `• **Malus subis :** **${pity.malus}/${ROULETTE_PITY_MALUS}** *(bonus garanti à 3)*\n` +
                      `• **Tirages nuls :** **${pity.nuls}/${ROULETTE_PITY_NULS}** *(bonus garanti à 5)*\n` +
                      `• **Boost accumulé :** **+${jackpotBoost}%** de chance bonus`;

    return new EmbedBuilder()
        .setColor(0xffd20a)
        .setTitle(`ÉTAT ROULETTE DE ${cible.displayName}`)
        .addFields(
            { name: 'BONUS :', value: (bonus.length ? bonus.join('\n') : '*Aucun bonus actif*') + '\n\u200b', inline: false },
            { name: 'MALUS :', value: (malus.length ? malus.join('\n') : '*Aucun malus actif*') + '\n\u200b', inline: false },
            { name: 'PROGRESSION PITY & JACKPOT 🍀', value: pityTexte, inline: false }
        )
        .setFooter({ text: footerText });
}

function buildRouletteAchievementsEmbed(cible, page = 0, authorId) {
    const userAchs = rouletteAchievements.get(cible.id) ?? {};
    const totalAchs = ROULETTE_ACHIEVEMENTS.length;
    const debl = Object.keys(userAchs).length;
    const PAGE_SIZE = 5;
    const totalPages = Math.ceil(totalAchs / PAGE_SIZE);
    const start = page * PAGE_SIZE;
    const slice = ROULETTE_ACHIEVEMENTS.slice(start, start + PAGE_SIZE);

    const lignes = slice.map(a => {
        const ts = userAchs[a.id];
        if (ts) return `✅ **${a.emoji} ${a.nom}**\n${a.desc}\n-# *Débloqué <t:${Math.floor(ts / 1000)}:R>*`;
        return `🔒 **${a.emoji} ${a.nom}**\n${a.desc}`;
    }).join('\n\n');

    const embed = new EmbedBuilder()
        .setColor(0xffd20a)
        .setTitle(`🎖️ Succès de ${cible.displayName} (${debl}/${totalAchs})`)
        .setDescription(lignes)
        .setFooter({ text: `Page ${page + 1}/${totalPages}` });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`rlt_achs_${cible.id}_${page - 1}_${authorId}`).setLabel('⬅️ Précédent').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
        new ButtonBuilder().setCustomId(`rlt_achs_${cible.id}_${page + 1}_${authorId}`).setLabel('➡️ Suivant').setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPages - 1),
        new ButtonBuilder().setCustomId(`rlt_stats_back_${cible.id}_${authorId}`).setLabel('↩️ Stats').setStyle(ButtonStyle.Primary)
    );
    return { embed, row };
}

function buildRouletteStatsEmbed(cible) {
    const stats = rouletteStats.get(cible.id) ?? { tirages: 0, bonus: 0, malus: 0, rien: 0, plusGrosGain: null, pireSerie: 0 };
    const gain = stats.plusGrosGain ? `**${stats.plusGrosGain.nom}** (${probaAffichee(stats.plusGrosGain.proba).pct}%)` : 'Aucun bonus encore';

    return new EmbedBuilder()
        .setColor(0xffd20a)
        .setTitle(`📊 Stats roulette de ${cible.displayName}`)
        .setDescription(
            `🎲 Tirages : **${stats.tirages}**\n` +
            `🎉 Bonus : **${stats.bonus}**\n` +
            `💀 Malus : **${stats.malus}**\n` +
            `😶 Rien : **${stats.rien}**\n` +
            `🏆 Plus gros gain : ${gain}\n` +
            `📉 Plus longue série de malchance : **${stats.pireSerie}**`
        );
}

function updateRouletteStats(userId, outcomeId, entry, client) {
    const stats = rouletteStats.get(userId) ?? { tirages: 0, bonus: 0, malus: 0, rien: 0, plusGrosGain: null, serieActuelle: 0, pireSerie: 0 };
    stats.tirages++;
    if (client) {
        const salon = client.channels.cache.get(ROULETTE_SALON_ID);
        if (stats.tirages >= 250) deverrouillerSucces(userId, 'veteran-250', salon);
        if (stats.tirages >= 500) deverrouillerSucces(userId, 'centurion-500', salon);
    }
    if (entry?.type === 'bonus') {
        stats.bonus++;
        stats.serieActuelle = 0;
        const proba = probaReelle(entry);
        if (!stats.plusGrosGain || proba < stats.plusGrosGain.proba) stats.plusGrosGain = { nom: entry.nom, proba };
    } else if (entry?.type === 'malus') {
        stats.malus++;
        stats.serieActuelle++;
        stats.pireSerie = Math.max(stats.pireSerie, stats.serieActuelle);
    } else if (outcomeId === 'aucun-resultat') {
        stats.rien++;
        stats.serieActuelle++;
        stats.pireSerie = Math.max(stats.pireSerie, stats.serieActuelle);
    }
    rouletteStats.set(userId, stats);
}

async function verifierRoleGamblingAddict(membre) {
    if (!membre) return;
    const stats = rouletteStats.get(membre.id);
    if (!stats || stats.tirages < ROULETTE_ADDICT_SEUIL) return;
    if (membre.roles.cache.has(ROULETTE_ROLE_ADDICT_ID)) return;
    await membre.roles.add(ROULETTE_ROLE_ADDICT_ID, `Gambling addict : ${stats.tirages} rolls`).catch(() => {});
}

async function envoyerHallOfFame(guild, membre, entry) {
    if (!entry || entry.type !== 'bonus') return;
    const proba = probaReelle(entry);
    if (proba >= ROULETTE_HOF_SEUIL) return;

    const salon = guild.channels.cache.get(ROULETTE_HOF_CHANNEL_ID) ?? await guild.channels.fetch(ROULETTE_HOF_CHANNEL_ID).catch(() => null);
    if (!salon) return;

    const { n, pct } = probaAffichee(proba);
    const nom = membre?.displayName ?? membre?.user?.username ?? 'Un·e membre';
    const avatar = membre?.user?.displayAvatarURL({ dynamic: true, size: 256 }) ?? membre?.displayAvatarURL?.({ dynamic: true, size: 256 });
    const emoji = ROULETTE_EMOJIS_PAR_ID[entry.id] ?? '🏆';

    const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle('🏆 NOUVEL EXPLOIT AU PANTHÉON !')
        .setDescription(`Le destin a parlé ! Un bonus ultra rare vient d'être décroché sur la roulette !`)
        .addFields(
            { name: '👤 Membre récompensé·e', value: `<@${membre.id}> (${nom})`, inline: true },
            { name: `${emoji} Bonus obtenu`, value: `**${entry.nom}**`, inline: true },
            { name: '\u200b', value: '\u200b', inline: true },
            { name: '🎲 Chance de tirage', value: `**1/${n}** (${pct}%)`, inline: true },
            { name: '📅 Date de l\'exploit', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
        )
        .setFooter({ text: 'Panthéon de la Roulette • Regaïa' })
        .setTimestamp();

    if (avatar) embed.setThumbnail(avatar);
    deverrouillerSucces(membre.id, 'hof', salon);
    await salon.send({ content: `🎉 Félicitations à <@${membre.id}> pour son coup de maître !`, embeds: [embed] }).catch(() => {});
}

function membresTop30Roulette(guild, authorId) {
    return Object.entries(bridge.topData.messages || {})
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => guild.members.cache.get(id))
        .filter(m => m && !m.user.bot)
        .slice(0, 30)
        .filter(m => m.id !== authorId);
}

async function envoyerPingRedirection(channel, resultat) {
    if (!resultat.pingCible) return;
    await channel.send({ content: resultat.pingCible.texte, allowedMentions: { users: [resultat.pingCible.id] } }).catch(() => {});
}

function libelleProbaRoulette(outcomeId) {
    if (outcomeId === 'aucun-resultat') {
        const { n, pct } = probaAffichee(ROULETTE_TAUX_ECHEC);
        return `1/${n} | ${pct}%`;
    }
    const entry = ROULETTE_TABLE.find(e => e.id === outcomeId);
    if (!entry) return null;
    const { n, pct } = probaAffichee(probaReelle(entry));
    return `1/${n} | ${pct}%`;
}

function buildRouletteResultEmbed(outcomeId, texte, authorId = null) {
    let delaiTexte = '15 minutes';
    if (authorId) {
        if ((rouletteCooldown45Charges.get(authorId) || 0) > 0) delaiTexte = '45 minutes';
        else if ((rouletteCooldownCourtCharges.get(authorId) || 0) > 0 || estHappyHour()) delaiTexte = '5 minutes';
    }

    const texteFinal = outcomeId === 'aucun-resultat' ? `${texte}\n\n*Échec du tirage, reviens dans ${delaiTexte} !*` : texte;
    const estContrePoison = texte.includes('Miracle !');
    const entry = ROULETTE_TABLE.find(e => e.id === outcomeId);
    const couleurs = { bonus: 0x00bf19, malus: 0x9e0000, special: 0xdb6600 };
    const prefixes = { bonus: '🎉 BONUS', malus: '💀 MALUS', special: '🌗 SPÉCIAL' };

    const couleur = estContrePoison ? 0x00bf19 : outcomeId === 'aucun-resultat' ? 0x20876f : (entry ? (couleurs[entry.type] ?? 0x503649) : 0x99aab5);
    const titre = estContrePoison ? `✨ CONTRE-POISON ! - ${entry?.nom ?? ''} annulé !` :
        outcomeId === 'aucun-resultat' ? `💨 AUCUN RÉSULTAT ! (${libelleProbaRoulette('aucun-resultat')})` :
        entry ? `${prefixes[entry.type] ?? ''} - ${entry.nom} (${libelleProbaRoulette(outcomeId)})` : null;

    const embed = new EmbedBuilder().setColor(couleur).setDescription(texteFinal);
    if (titre) embed.setTitle(titre);
    return embed;
}

function buildRoulettePaytableEmbed() {
    const section = (titre, type) => {
        const lignes = ROULETTE_TABLE
            .filter(e => e.type === type)
            .sort((a, b) => b.poids - a.poids)
            .map(e => {
                const { n, pct } = probaAffichee(probaReelle(e));
                return `**1/${n}** (${pct}%) — ${e.desc}`;
            });
        return lignes.length ? `**${titre} :**\n${lignes.join('\n')}` : null;
    };

    return new EmbedBuilder()
        .setColor(0xffd20a)
        .setTitle('🎰 Probabilités')
        .setDescription([
            section('🎉 BONUS', 'bonus'),
            section('💀 MALUS', 'malus'),
            section('🗳️ SPÉCIAL', 'special'),
            '**😶 RIEN :**\n**1/2** (~50%) — Rien du tout',
            `**🍀 PITY :**\nAprès ${ROULETTE_PITY_MALUS} malus ou ${ROULETTE_PITY_NULS} résultats nuls, bonus garanti.`
        ].filter(Boolean).join('\n\n'));
}

function buildRouletteTopEmbed(guild, authorId) {
    const totalAchs = ROULETTE_ACHIEVEMENTS.length;
    const entries = [...rouletteAchievements.entries()]
        .map(([uid, achs]) => ({ uid, count: Object.keys(achs || {}).length }))
        .filter(e => e.count > 0)
        .sort((a, b) => b.count - a.count);

    const medals = ['🥇', '🥈', '🥉'];
    const top10 = entries.slice(0, 10);
    const lignes = top10.map((e, i) => {
        const m = guild.members.cache.get(e.uid);
        const nom = m?.displayName ?? 'Ancien membre';
        const med = i < 3 ? medals[i] : `**${i + 1}.**`;
        return `${med} **${nom}** — **${e.count}/${totalAchs}** succès`;
    });

    const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle('🏆 Panthéon des Chasseurs de Succès (Roulette)')
        .setDescription(lignes.length > 0 ? lignes.join('\n\n') : '*Aucun succès débloqué pour l\'instant.*');

    const userRankIndex = entries.findIndex(e => e.uid === authorId);
    if (userRankIndex !== -1) {
        embed.setFooter({ text: `Ta position : #${userRankIndex + 1} avec ${entries[userRankIndex].count}/${totalAchs} succès` });
    } else {
        embed.setFooter({ text: `Tu n'as pas encore de succès. Tape !rlt pour tenter ta chance !` });
    }

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`rlt_achs_${authorId}_0_${authorId}`).setLabel('🎖️ Mes succès').setStyle(ButtonStyle.Secondary)
    );
    return { embed, row };
}

async function tirerEtConstruireResultatRoulette(authorId, guild, channel, client) {
    const now = Date.now();
    const finFreeRoll = rouletteFreeRollUntil.get(authorId);
    const chargesTriple = rouletteCoupTripleCharges.get(authorId) || 0;
    const enFreeRoll = (finFreeRoll && now < finFreeRoll) || now < rouletteTourneeJusquA || chargesTriple > 0;

    if (chargesTriple > 0) {
        rouletteCoupTripleCharges.set(authorId, chargesTriple - 1);
        if (chargesTriple - 1 === 0) rouletteCoupTripleCharges.delete(authorId);
    }

    if (!ROULETTE_COOLDOWN_EXEMPT.includes(authorId) && !enFreeRoll) {
        const finCooldown = rouletteCooldowns.get(authorId);
        if (finCooldown && now < finCooldown) {
            return { cooldown: true, reste: Math.ceil((finCooldown - now) / 1000 / 60) };
        }
        const chargesCourt = rouletteCooldownCourtCharges.get(authorId) || 0;
        const charges45 = rouletteCooldown45Charges.get(authorId) || 0;
        if (chargesCourt > 0) {
            rouletteCooldownCourtCharges.set(authorId, chargesCourt - 1);
            rouletteCooldowns.set(authorId, now + 5 * 60 * 1000);
        } else if (charges45 > 0) {
            rouletteCooldown45Charges.set(authorId, charges45 - 1);
            rouletteCooldowns.set(authorId, now + 45 * 60 * 1000);
        } else {
            const dureeCooldown = estHappyHour() ? 5 * 60 * 1000 : ROULETTE_COOLDOWN_MS;
            rouletteCooldowns.set(authorId, now + dureeCooldown);
        }
    }

    const membre = guild.members.cache.get(authorId);
    const auteurNom = membre?.displayName ?? 'Quelqu\'un';

    const pityAvant = roulettePity.get(authorId) ?? { malus: 0, nuls: 0 };
    if (pityAvant.malus >= ROULETTE_PITY_MALUS || pityAvant.nuls >= ROULETTE_PITY_NULS) {
        deverrouillerSucces(authorId, 'le-sauvetage', channel);
    }

    const outcomeId = tirerRoulette(authorId, guild?.id);

    if (estHappyHour()) {
        const todayH = new Date().toDateString();
        const hh = rouletteHappyHourCompteur.get(authorId) ?? { date: todayH, count: 0 };
        hh.count = hh.date === todayH ? hh.count + 1 : 1;
        hh.date = todayH;
        rouletteHappyHourCompteur.set(authorId, hh);
        if (hh.count >= 10) deverrouillerSucces(authorId, 'oiseau-nuit', channel);
    }

    if (outcomeId.startsWith('malus-')) {
        const cons = (rouletteMalusConsecutifs.get(authorId) || 0) + 1;
        rouletteMalusConsecutifs.set(authorId, cons);
        if (cons >= 3) deverrouillerSucces(authorId, 'enchainement-fatal', channel);

        let diffList = rouletteMalusDifferents.get(authorId);
        if (!Array.isArray(diffList)) diffList = [];
        if (!diffList.includes(outcomeId)) diffList.push(outcomeId);
        rouletteMalusDifferents.set(authorId, diffList);
        if (diffList.length >= 10) deverrouillerSucces(authorId, 'seum-en-personne', channel);
    } else {
        rouletteMalusConsecutifs.delete(authorId);
    }

    const failIndex = outcomeId === 'aucun-resultat' ? Math.floor(Math.random() * ROULETTE_FAILS.length) : 0;
    const entryTiree = ROULETTE_TABLE.find(e => e.id === outcomeId);
    updateRouletteStats(authorId, outcomeId, entryTiree, client);
    envoyerHallOfFame(guild, membre, entryTiree).catch(() => {});
    verifierRoleGamblingAddict(membre).catch(() => {});

    if (entryTiree?.type === 'bonus' && bridge.estAnniversaireAujourdhui(guild?.id, authorId)) {
        deverrouillerSucces(authorId, 'jour-de-gloire', channel);
    }

    let cible = membre;
    let cibleNom = auteurNom;
    let prefixeRedirect = '';
    let pingRedirection = null;

    const jCharges = rouletteJackpotBoostCharges.get(authorId) || 0;
    if (jCharges > 0) {
        if (jCharges - 1 <= 0) {
            rouletteJackpotBoostCharges.delete(authorId);
            rouletteJackpotBoostValue.delete(authorId);
        } else {
            rouletteJackpotBoostCharges.set(authorId, jCharges - 1);
        }
    }

    const rawBCharges = rouletteBouclierActif.get(authorId);
    const bCharges = typeof rawBCharges === 'number' ? rawBCharges : (rawBCharges ? 1 : 0);
    if (outcomeId.startsWith('malus-') && bCharges > 0) {
        const restantes = bCharges - 1;
        if (restantes <= 0) rouletteBouclierActif.delete(authorId);
        else rouletteBouclierActif.set(authorId, restantes);

        if (['malus-timeout-20min', 'malus-exclu-heure', 'malus-exclu-jour', 'malus-exclu-semaine', 'malus-ban'].includes(outcomeId)) {
            deverrouillerSucces(authorId, 'pare-balles', channel);
        }
        const msgRestantes = restantes > 0 ? ` (${restantes} charge${restantes > 1 ? 's' : ''} restante${restantes > 1 ? 's' : ''})` : '';
        const embed = buildRouletteResultEmbed(outcomeId, `🛡️ **${auteurNom}** évite le malus **${ROULETTE_NOMS[outcomeId]}** grâce à son bouclier !${msgRestantes}`);
        return { embeds: [embed], components: [buildRowResultatRoulette(authorId, outcomeId, failIndex)] };
    }

    if (outcomeId.startsWith('malus-')) {
        const cibleChoisieId = rouletteRedirectChoixCible.get(authorId);
        if (cibleChoisieId) {
            rouletteRedirectChoixCible.delete(authorId);
            const cibleChoisie = guild.members.cache.get(cibleChoisieId);
            if (cibleChoisie && cibleChoisie.id !== authorId) {
                cible = cibleChoisie;
                cibleNom = cible.displayName;
                deverrouillerSucces(authorId, 'sniper-impitoyable', channel);
                prefixeRedirect = `🎯 **${auteurNom}** avait choisi de rediriger son malus, envoyé vers **${cibleNom}** !\n`;
                pingRedirection = { id: cible.id, raison: " quelqu'un a choisi de te l'envoyer.." };
            }
        } else {
            const charges = rouletteRedirectCharges.get(authorId) || 0;
            if (charges > 0) {
                const candidats = membresTop30Roulette(guild, authorId);
                if (candidats.length > 0) {
                    cible = candidats[Math.floor(Math.random() * candidats.length)];
                    cibleNom = cible.displayName;
                    rouletteRedirectCharges.set(authorId, charges - 1);
                    prefixeRedirect = `😈 **${auteurNom}** avait un malus en réserve, redirigé vers **${cibleNom}** !\n`;
                    pingRedirection = { id: cible.id, raison: 'il/elle avait un malus en réserve' };
                }
            }
        }
    }

    const proxy = { member: cible, channel, guild };
    const texte = await appliquerEtDecrireResultat(outcomeId, proxy, cibleNom, failIndex);

    const tTransfo = rouletteTransfos.get(cible.id);
    if (tTransfo?.boomer && tTransfo?.bebe && Date.now() < tTransfo.boomer && Date.now() < tTransfo.bebe) {
        deverrouillerSucces(cible.id, 'crise-quarantaine', channel);
    }
    if (texte.includes('Miracle !')) deverrouillerSucces(cible.id, 'pharmacien', channel);

    const nowCheck = Date.now();
    let malusTexteCumules = 0;
    if (rouletteUwuUntil.has(cible.id) && nowCheck < rouletteUwuUntil.get(cible.id)) malusTexteCumules++;
    if (rouletteLettreInterdite.has(cible.id) && nowCheck < rouletteLettreInterdite.get(cible.id).until) malusTexteCumules++;
    if (rouletteEmojiUntil.has(cible.id) && nowCheck < rouletteEmojiUntil.get(cible.id)) malusTexteCumules++;
    if (rouletteLeetUntil.has(cible.id) && nowCheck < rouletteLeetUntil.get(cible.id)) malusTexteCumules++;
    for (const fin of Object.values(rouletteTransfos.get(cible.id) ?? {})) {
        if (nowCheck < fin) malusTexteCumules++;
    }
    if (malusTexteCumules >= 3) deverrouillerSucces(cible.id, 'incomprehensible', channel);

    if (outcomeId === 'bonus-coup-triple') {
        rouletteCoupTripleScore.set(authorId, 0);
    } else if (chargesTriple > 0) {
        if (entryTiree?.type === 'bonus') {
            const score = (rouletteCoupTripleScore.get(authorId) || 0) + 1;
            rouletteCoupTripleScore.set(authorId, score);
            if (score >= 3) deverrouillerSucces(authorId, 'braquage-parfait', channel);
        } else {
            rouletteCoupTripleScore.delete(authorId);
        }
    }

    bridge.demanderSauvegarde();
    const embed = buildRouletteResultEmbed(outcomeId, prefixeRedirect + texte, authorId);
    const roleMaxId = ROULETTE_RANGS[ROULETTE_RANGS.length - 1].id;
    const dejaMaxRole = (outcomeId === 'bonus-role-superieur' || outcomeId === 'bonus-legendaire') && cible.roles.cache.has(roleMaxId);

    if (dejaMaxRole) {
        return {
            embeds: [embed],
            components: [buildMenuFallbackRoulette(authorId), buildRowResultatRoulette(authorId, outcomeId, failIndex)],
            attenteChoix: true
        };
    }
    const differe = proxy.differe;
    return {
        embeds: proxy.vote ? [buildVoteRouletteEmbed(proxy.vote)] : [embed],
        components: [buildRowResultatRoulette(authorId, outcomeId, failIndex)],
        vote: proxy.vote ?? null,
        pingCible: pingRedirection ? { id: pingRedirection.id, texte: `🔔 <@${pingRedirection.id}>, **${auteurNom}** t'a redirigé le malus **${ROULETTE_NOMS[outcomeId]}** (${pingRedirection.raison}) !` } : null,
        differe: differe ? async () => {
            await differe.action();
            return buildRouletteResultEmbed(outcomeId, prefixeRedirect + differe.texteFinal);
        } : null
    };
}

async function assurerWebhookRoulette(channel) {
    if (channel.guild?.id !== '720057528351850547') return null;
    if (ROULETTE_WEBHOOK_EXCLUS.has(channel.id)) return null;
    if (rouletteWebhooks.has(channel.id)) return rouletteWebhooks.get(channel.id);
    try {
        const existants = await channel.fetchWebhooks();
        let webhook = existants.find(w => w.name === 'Cacabot Roulette');
        if (!webhook) webhook = await channel.createWebhook({ name: 'Cacabot Roulette' });
        rouletteWebhooks.set(channel.id, webhook);
        return webhook;
    } catch { return null; }
}

async function initialiserWebhooksRoulette(guild) {
    if (guild.id !== '720057528351850547') return;
    const salons = guild.channels.cache.filter(c => c.type === ChannelType.GuildText);
    for (const salon of salons.values()) {
        await assurerWebhookRoulette(salon);
        await new Promise(r => setTimeout(r, 300));
    }
    console.log(`✅ Webhooks roulette prêts sur ${salons.size} salons de ${guild.name}`);
}

async function handleRouletteMessage(message, response, client) {
    const raw = message.content.trim();
    const command = raw.split(" ")[0].toLowerCase();
    const adminSuccesAliases = ['!roulettesuccesforce', '!rltsuccesforce', '!roulettesuccessforce', '!rltsuccessforce'];

    if (['!reroll', '!bonusforce', '!malusforce', '!rouletteid', '!rltid', '!resetroulettestate', '!resetrlt', '!removestate', ...adminSuccesAliases].includes(command)) {
        if (message.author.id !== bridge.EPSYS_ID) {
            await message.reply("Cette commande est réservée à Epsys.");
            return true;
        }

        const argsBruts = raw.split(" ").slice(1);
        if (command === '!reroll') {
            const query = argsBruts.join(" ");
            const cible = message.mentions.members.first() ?? bridge.findMemberByName(message.guild, query).found;
            if (!cible) { await message.reply("Membre introuvable."); return true; }
            rouletteCooldowns.delete(cible.id);
            rouletteFreeRollUntil.delete(cible.id);
            await message.reply(`Le cooldown de <@${cible.id}> a été réinitialisé ! ✅`);
            return true;
        }
        if (command === '!rouletteid' || command === '!rltid') {
            const embed = buildRouletteTypeEmbed('bonus')
                .setDescription("`!bonusforce [id] [membre]` / `!malusforce [id] [membre]`\nExemple : `!bonusforce couronne @Sasha`\n\n" + buildRouletteTypeEmbed('bonus').data.description);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`roulette_id_bonus_${message.author.id}`).setLabel('🎉 Bonus').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`roulette_id_malus_${message.author.id}`).setLabel('💀 Malus').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId(`roulette_id_special_${message.author.id}`).setLabel('✨ Spécial').setStyle(ButtonStyle.Secondary)
            );
            await message.reply({ embeds: [embed], components: [row] });
            return true;
        }
        if (command === '!bonusforce' || command === '!malusforce') {
            const nom = argsBruts[0]?.toLowerCase();
            const query = argsBruts.slice(1).join(" ");
            const outcomeId = ROULETTE_NOMS_COMMANDES[nom];
            if (!outcomeId) { await message.reply(`Nom inconnu. Fais \`!rltid\` pour voir la liste.`); return true; }
            const attendBonus = command === '!bonusforce';
            const estSpecial = outcomeId.startsWith('special-');
            if (!estSpecial && attendBonus && !outcomeId.startsWith('bonus-')) { await message.reply("Ce nom correspond à un malus. Utilise `!malusforce`."); return true; }
            if (!estSpecial && !attendBonus && !outcomeId.startsWith('malus-')) { await message.reply("Ce nom correspond à un bonus. Utilise `!bonusforce`."); return true; }
            const cible = message.mentions.members.first() ?? bridge.findMemberByName(message.guild, query).found;
            if (!cible) { await message.reply("Membre introuvable."); return true; }

            if (outcomeId === 'bonus-vote-gagnant') {
                crediterInventaireRoulette(cible.id, 'freeRoll1Min', 1);
                deverrouillerSucces(cible.id, 'innocente', message.channel);

                const embedVictoire = new EmbedBuilder()
                    .setColor(0x00bf19)
                    .setTitle(`🕊️ JUGEMENT POPULAIRE : INNOCENTÉ.E ! (FORCÉ)`)
                    .setDescription(
                        `Epsys a accordé la grâce présidentielle !\n\n` +
                        `🎉 <@${cible.id}>, tu remportes **1 minute de tirage à volonté** (sans cooldown et immunisé aux mutes) !\n\n` +
                        `🎁 **Si tu ne l'utilises pas tout de suite, ton cadeau sera stocké dans ton inventaire.**\nTape \`!roulette claim\` ou \`!rlt claim\` afin de l'activer !`
                    );

                const rowVictoire = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`rlt_claim_freeroll_${cible.id}`)
                        .setLabel('🎰 Activer mon tirage (1 min)')
                        .setStyle(ButtonStyle.Success)
                );

                await message.channel.send({
                    content: `🔔 <@${cible.id}>, tu as reçu un bonus de vote public !`,
                    embeds: [embedVictoire],
                    components: [rowVictoire]
                });
                return true;
            }

            const proxy = { member: cible, channel: message.channel, guild: message.guild };
            const texte = await appliquerEtDecrireResultat(outcomeId, proxy, cible.displayName, 0);
            const entryForcee = ROULETTE_TABLE.find(e => e.id === outcomeId);
            if (attendBonus) envoyerHallOfFame(message.guild, cible, entryForcee).catch(() => {});
            if (proxy.vote) {
                const envoye = await message.reply({ embeds: [buildVoteRouletteEmbed(proxy.vote)] });
                await demarrerVoteRoulette(envoye, proxy.vote);
                return true;
            }
            await message.reply({ embeds: [buildRouletteResultEmbed(outcomeId, texte)] });
            return true;
        }
        if (adminSuccesAliases.includes(command)) {
            const sub = argsBruts[0]?.toLowerCase();
            if (sub === 'test') {
                const randomAch = ROULETTE_ACHIEVEMENTS[Math.floor(Math.random() * ROULETTE_ACHIEVEMENTS.length)];
                const embedTest = new EmbedBuilder()
                    .setColor(0xffd700).setTitle('🎊 SUCCÈS DÉVERROUILLÉ ! (TEST)')
                    .setDescription(`<@${message.author.id}> vient d'obtenir le succès **${randomAch.emoji} ${randomAch.nom}** !\n\n*📂 ${randomAch.desc}*`)
                    .setImage('https://cdn.discordapp.com/attachments/1480756332373213275/1555806751448629410/achievement-unlocked_1.gif');
                const rowTest = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`rlt_achs_${message.author.id}_0_${message.author.id}`).setLabel('🎖️ Succès').setStyle(ButtonStyle.Secondary));
                await message.channel.send({ embeds: [embedTest], components: [rowTest] });
                return true;
            }
            if (!sub) {
                const lignes = ROULETTE_ACHIEVEMENTS.map(a => `${a.emoji} **${a.nom}** — \`${a.id}\``);
                const embedList = new EmbedBuilder().setColor(0xffd700).setTitle('🎖️ Identifiants des 30 Succès').setDescription(lignes.join('\n'));
                await message.reply({ embeds: [embedList] });
                return true;
            }
            const ach = ROULETTE_ACHIEVEMENTS.find(a => a.id.toLowerCase() === sub);
            if (!ach) { await message.reply(`Identifiant inconnu : \`${sub}\`.`); return true; }
            const queryMembre = argsBruts.slice(1).join(" ");
            const cible = message.mentions.members.first() ?? (queryMembre ? bridge.findMemberByName(message.guild, queryMembre).found : message.member);
            if (!cible) { await message.reply("Membre introuvable."); return true; }

            let userAchs = rouletteAchievements.get(cible.id) ?? {};
            userAchs[ach.id] = Date.now();
            rouletteAchievements.set(cible.id, userAchs);
            bridge.demanderSauvegarde();

            const embedUnlock = new EmbedBuilder().setColor(0xffd700).setTitle('🎊 SUCCÈS DÉVERROUILLÉ !')
                .setDescription(`<@${cible.id}> vient d'obtenir le succès **${ach.emoji} ${ach.nom}** !\n\n*📂 ${ach.desc}*`)
                .setImage('https://cdn.discordapp.com/attachments/1480756332373213275/1555806751448629410/achievement-unlocked_1.gif');
            const rowUnlock = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`rlt_achs_${cible.id}_0_${cible.id}`).setLabel('🎖️ Succès').setStyle(ButtonStyle.Secondary));
            await message.channel.send({ embeds: [embedUnlock], components: [rowUnlock] });
            await message.reply(`✅ Succès **${ach.nom}** débloqué pour <@${cible.id}> !`);
            return true;
        }
        if (command === '!resetroulettestate' || command === '!resetrlt') {
            const query = argsBruts.join(" ");
            const cible = message.mentions.members.first() ?? bridge.findMemberByName(message.guild, query).found;
            if (!cible) { await message.reply("Membre introuvable."); return true; }
            for (const map of Object.values(ROULETTE_ETATS)) map.delete(cible.id);
            if (cible.setNickname) await cible.setNickname(null).catch(() => {});
            if (cible.timeout) await cible.timeout(null).catch(() => {});
            await bridge.saveAll();
            await message.reply(`L'état roulette de <@${cible.id}> a été réinitialisé.`);
            return true;
        }
        if (command === '!removestate') {
            const nom = argsBruts[argsBruts.length - 1]?.toLowerCase().replace(/_/g, '-');
            const query = argsBruts.slice(0, -1).join(" ");
            const cible = message.mentions.members.first() ?? bridge.findMemberByName(message.guild, query).found;
            if (!cible) { await message.reply("Membre introuvable."); return true; }

            const id = cible.id;
            let retire = false;

            // 1. Malus de transformations textuelles (boomer, bebe, caps, etc.)
            const tf = rouletteTransfos.get(id);
            const clesTransfos = {
                'boomer': 'boomer', 'bebe': 'bebe', 'baby': 'bebe', 'caps': 'caps',
                'censure': 'censure', 'mots': 'mots', 'mots-melanges': 'mots',
                'lettres': 'lettres', 'lettres-melangees': 'lettres',
                'emojionly': 'emojiOnly', 'emoji-only': 'emojiOnly',
                'limite100': 'limite100', 'limite-100': 'limite100',
                'limite30': 'limite30', 'limite-30': 'limite30',
                'existentiel': 'existentiel', 'linkedin': 'linkedin'
            };

            if (tf && clesTransfos[nom] && tf[clesTransfos[nom]]) {
                delete tf[clesTransfos[nom]];
                if (Object.keys(tf).length === 0) rouletteTransfos.delete(id);
                else rouletteTransfos.set(id, tf);
                retire = true;
            }

            // 2. Pseudo lock & Timeout
            if (nom === 'pseudo-lock' || nom === 'pseudo' || nom === 'pseudolock') {
                roulettePseudoLock.delete(id);
                await cible.setNickname(null).catch(() => {});
                retire = true;
            } else if (nom === 'timeout' || nom === 'mute') {
                rouletteTimeoutUntil.delete(id);
                await cible.timeout(null).catch(() => {});
                retire = true;
            }

            // 3. Autres malus & bonus spécifiques
            else if (nom === 'echo') { rouletteEchoUntil.delete(id); retire = true; }
            else if (nom === 'uwu') { rouletteUwuUntil.delete(id); retire = true; }
            else if (nom === 'lettre' || nom === 'lettre-interdite' || nom === 'lettreinterdite') { rouletteLettreInterdite.delete(id); retire = true; }
            else if (nom === 'emoji') { rouletteEmojiUntil.delete(id); retire = true; }
            else if (nom === 'leet' || nom === 'l33t') { rouletteLeetUntil.delete(id); retire = true; }
            else if (nom === 'antifeur' || nom === 'anti-feur') { rouletteAntiFeurUntil.delete(id); retire = true; }
            else if (nom === 'couronne') { rouletteCouronneUntil.delete(id); retire = true; }
            else if (nom === 'bouclier' || nom === 'superbouclier') { rouletteBouclierActif.delete(id); retire = true; }
            else if (nom === 'redirect' || nom === 'redirection') { rouletteRedirectCharges.delete(id); retire = true; }
            else if (nom === 'redirectchoix' || nom === 'redirect-choix') { rouletteRedirectChoixCible.delete(id); retire = true; }
            else if (nom === 'cooldowncourt' || nom === 'cooldown-court') { rouletteCooldownCourtCharges.delete(id); retire = true; }
            else if (nom === 'cooldown45' || nom === 'cooldown-45') { rouletteCooldown45Charges.delete(id); retire = true; }
            else if (nom === 'couptriple' || nom === 'coup-triple') { rouletteCoupTripleCharges.delete(id); retire = true; }
            else if (nom === 'freeroll' || nom === 'free-roll') { rouletteFreeRollUntil.delete(id); retire = true; }
            else if (nom === 'cooldown' || nom === 'cd') { rouletteCooldowns.delete(id); retire = true; }
            else if (nom === 'chatnoir' || nom === 'chat-noir') { retire = true; }
            else if (ROULETTE_ETATS[nom]) { ROULETTE_ETATS[nom].delete(id); retire = true; }

            await bridge.saveAll();

            if (retire) {
                await message.reply(`✅ Effet \`${nom}\` retiré avec succès de <@${id}> !`);
            } else {
                await message.reply(`⚠️ L'effet \`${nom}\` n'était pas actif sur <@${id}> (ou nom inconnu).`);
            }
            return true;
        }
    }

    if (command === '!roulettestate' || command === '!rltstate') {
        const query = raw.split(/\s+/).slice(1).join(" ");
        let cible = message.mentions.members.first();
        if (!cible) {
            if (!query) cible = message.member;
            else {
                const result = bridge.findMemberByName(message.guild, query);
                if (result.multiple) {
                    return bridge.askDisambiguation(message, message.guild, result.candidates, async (user) => {
                        const membre = message.guild.members.cache.get(user.id);
                        if (membre) message.reply({ embeds: [buildRouletteStateEmbed(membre, message.guild?.id)] });
                    });
                }
                cible = result.found;
            }
        }
        if (!cible) { await message.reply("Membre introuvable."); return true; }
        await message.reply({ embeds: [buildRouletteStateEmbed(cible, message.guild?.id)] });
        return true;
    }

    if (command === '!roulettestats' || command === '!rltstats') {
        const query = raw.split(/\s+/).slice(1).join(" ");
        let cible = message.mentions.members.first();
        if (!cible) {
            if (!query) cible = message.member;
            else {
                const result = bridge.findMemberByName(message.guild, query);
                if (result.multiple) {
                    return bridge.askDisambiguation(message, message.guild, result.candidates, async (user) => {
                        const membre = message.guild.members.cache.get(user.id);
                        if (membre) {
                            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`rlt_achs_${membre.id}_0_${message.author.id}`).setLabel('🎖️ Succès').setStyle(ButtonStyle.Secondary));
                            message.reply({ embeds: [buildRouletteStatsEmbed(membre)], components: [row] });
                        }
                    });
                }
                cible = result.found;
            }
        }
        if (!cible) { await message.reply("Membre introuvable."); return true; }
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`rlt_achs_${cible.id}_0_${message.author.id}`).setLabel('🎖️ Succès').setStyle(ButtonStyle.Secondary));
        await message.reply({ embeds: [buildRouletteStatsEmbed(cible)], components: [row] });
        return true;
    }

    if (['!rlttop', '!roulettetop', '!rltleaderboard'].includes(command)) {
        const { embed, row } = buildRouletteTopEmbed(message.guild, message.author.id);
        await message.reply({ embeds: [embed], components: [row] });
        return true;
    }

    if (['!roulettesucces', '!rltsucces', '!roulettesuccess', '!rltsuccess'].includes(command)) {
        const query = raw.split(/\s+/).slice(1).join(" ");
        let cible = message.mentions.members.first();
        if (!cible) {
            if (!query) cible = message.member;
            else {
                const result = bridge.findMemberByName(message.guild, query);
                if (result.multiple) {
                    return bridge.askDisambiguation(message, message.guild, result.candidates, async (user) => {
                        const membre = message.guild.members.cache.get(user.id);
                        if (membre) {
                            const { embed, row } = buildRouletteAchievementsEmbed(membre, 0, message.author.id);
                            message.reply({ embeds: [embed], components: [row] });
                        }
                    });
                }
                cible = result.found;
            }
        }
        if (!cible) { await message.reply("Membre introuvable."); return true; }
        const { embed, row } = buildRouletteAchievementsEmbed(cible, 0, message.author.id);
        await message.reply({ embeds: [embed], components: [row] });
        return true;
    }

    if (['!rouletteclaim', '!rltclaim', '!claim'].includes(command) || ((command === '!roulette' || command === '!rlt') && raw.split(" ")[1]?.toLowerCase() === 'claim')) {
        const { embed, row } = buildInventaireEmbed(message.member);
        await message.reply({ embeds: [embed], components: row ? [row] : [] });
        return true;
    }

    if (command === '!roulette' || command === '!rlt') {
        const direct = raw.split(" ")[1]?.toLowerCase() === 'go';
        if (direct) {
            const resultat = await tirerEtConstruireResultatRoulette(message.author.id, message.guild, message.channel, client);
            if (resultat.cooldown) {
                const notifRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('roulette_notif').setLabel('🔔 Me prévenir').setStyle(ButtonStyle.Secondary));
                await message.reply({ content: `Attends la fin du cooldown ! Il te reste **${resultat.reste} minute${resultat.reste > 1 ? 's' : ''}**.`, components: [notifRow] });
                return true;
            }
            // failIfNotExists: false permet de poster dans le salon même si le membre a supprimé son message
            const envoye = await message.reply({ 
                embeds: resultat.embeds, 
                components: resultat.components,
                failIfNotExists: false 
            }).catch(() => message.channel.send({ embeds: resultat.embeds, components: resultat.components }).catch(() => null));

            if (!envoye) return true;
            await envoyerPingRedirection(message.channel, resultat);
            memoriserResultatRoulette(envoye.id, resultat.embeds[0]);
            if (resultat.attenteChoix) rouletteChoixEnAttente.add(envoye.id);
            if (resultat.vote) await demarrerVoteRoulette(envoye, resultat.vote);
            if (resultat.differe) {
                setTimeout(async () => {
                    const embedFinal = await resultat.differe();
                    memoriserResultatRoulette(envoye.id, embedFinal);
                    envoye.edit({ embeds: [embedFinal] }).catch(() => {});
                }, 10000);
            }
            return true;
        }

        const embed = buildRoulettePresentationEmbed(message.author.id, message.guild?.id);
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`roulette_probas_pres_${message.author.id}`).setLabel('🎲 Probabilités').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`roulette_tenter_${message.author.id}`).setLabel('🍀 Tenter sa chance').setStyle(ButtonStyle.Primary)
        );
        await message.reply({ embeds: [embed], components: [row], failIfNotExists: false })
            .catch(() => message.channel.send({ embeds: [embed], components: [row] }).catch(() => null));
        return true;
    }

    return false;
}

async function handleRouletteSlash(interaction, client) {
    const cmd = interaction.commandName;
    const action = cmd === 'roulette' ? interaction.options.getString('action') : null;

    if (action === 'claim') {
        const member = interaction.guild?.members.cache.get(interaction.user.id) ?? interaction.member;
        const { embed, row } = buildInventaireEmbed(member);
        await interaction.reply({ embeds: [embed], components: row ? [row] : [] });
        return true;
    }

    if (action === 'stats') {
        const member = interaction.member;
        const rowBtns = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`rlt_achs_${member.id}_0_${interaction.user.id}`).setLabel('🎖️ Succès').setStyle(ButtonStyle.Secondary)
        );
        const rowUser = new ActionRowBuilder().addComponents(
            new UserSelectMenuBuilder().setCustomId(`rlt_inspect_stats_${interaction.user.id}`).setPlaceholder('🔍 Inspecter un autre membre...')
        );
        await interaction.reply({ embeds: [buildRouletteStatsEmbed(member)], components: [rowBtns, rowUser] });
        return true;
    }

    if (action === 'state') {
        const member = interaction.member;
        const rowUser = new ActionRowBuilder().addComponents(
            new UserSelectMenuBuilder().setCustomId(`rlt_inspect_state_${interaction.user.id}`).setPlaceholder('🔍 Inspecter un autre membre...')
        );
        await interaction.reply({ embeds: [buildRouletteStateEmbed(member, interaction.guildId)], components: [rowUser] });
        return true;
    }

    if (action === 'top') {
        const { embed, row } = buildRouletteTopEmbed(interaction.guild, interaction.user.id);
        await interaction.reply({ embeds: [embed], components: [row] });
        return true;
    }

    if (action === 'succes') {
        const member = interaction.member;
        const { embed, row } = buildRouletteAchievementsEmbed(member, 0, interaction.user.id);
        const rowUser = new ActionRowBuilder().addComponents(
            new UserSelectMenuBuilder().setCustomId(`rlt_inspect_succes_${interaction.user.id}`).setPlaceholder('🔍 Inspecter un autre membre...')
        );
        const components = row ? [row, rowUser] : [rowUser];
        await interaction.reply({ embeds: [embed], components });
        return true;
    }

    if (cmd === 'roulette') {
        if (action === 'go') {
            await interaction.deferReply();
            const res = await tirerEtConstruireResultatRoulette(interaction.user.id, interaction.guild, interaction.channel, client);
            if (res.cooldown) {
                const notifRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('roulette_notif').setLabel('🔔 Me prévenir').setStyle(ButtonStyle.Secondary));
                await interaction.editReply({ content: `⏳ Cooldown actif ! Il te reste **${res.reste} min**.`, components: [notifRow] });
                return true;
            }
            const env = await interaction.editReply({ embeds: res.embeds, components: res.components });
            await envoyerPingRedirection(interaction.channel, res);
            memoriserResultatRoulette(env.id, res.embeds[0]);
            if (res.attenteChoix) rouletteChoixEnAttente.add(env.id);
            if (res.vote) await demarrerVoteRoulette(env, res.vote);
            if (res.differe) {
                setTimeout(async () => {
                    const embedFinal = await res.differe();
                    memoriserResultatRoulette(env.id, embedFinal);
                    env.edit({ embeds: [embedFinal] }).catch(() => {});
                }, 10000);
            }
            return true;
        }

        const embed = buildRoulettePresentationEmbed(interaction.user.id, interaction.guildId);
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`roulette_probas_pres_${interaction.user.id}`).setLabel('🎲 Probabilités').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`roulette_tenter_${interaction.user.id}`).setLabel('🍀 Tenter sa chance').setStyle(ButtonStyle.Primary)
        );
        await interaction.reply({ embeds: [embed], components: [row] });
        return true;
    }

    return false;
}

async function handleRouletteButton(interaction, client) {
    const customId = interaction.customId;

    if (customId.startsWith('rlt_claim_menu_')) {
        const targetUserId = customId.split('_')[3];
        if (interaction.user.id !== targetUserId) {
            return interaction.reply({ content: "Ce n'est pas ton inventaire 😌", ephemeral: true });
        }

        const itemChoisi = interaction.values[0];
        const consomme = consommerInventaireRoulette(targetUserId, itemChoisi);
        if (!consomme) {
            return interaction.reply({ content: "Tu n'as plus cette récompense en réserve ou elle a déjà été activée !", ephemeral: true });
        }

        if (itemChoisi === 'freeRoll1Min') {
            rouletteFreeRollUntil.set(targetUserId, Date.now() + 60 * 1000);
            rouletteImmuniteUntil.set(targetUserId, Date.now() + 60 * 1000);
            bridge.demanderSauvegarde();

            // Met à jour l'embed d'inventaire après consommation
            const member = interaction.guild?.members.cache.get(targetUserId) ?? interaction.member;
            const majInv = buildInventaireEmbed(member);
            await interaction.update({ embeds: [majInv.embed], components: majInv.row ? [majInv.row] : [] }).catch(() => {});

            await interaction.followUp({
                content: `⚡ **C'EST PARTI !** <@${targetUserId}>, ton **tirage à volonté (1 min)** est activé ! Aucun cooldown et immunité aux mutes pendant 60 secondes ! Fais péter \`!rlt go\` ! 🎰`,
                ephemeral: false
            });
            return true;
        }

        return true;
    }

    if (customId.startsWith('rlt_claim_freeroll_')) {
        const targetUserId = customId.split('_')[3];
        if (interaction.user.id !== targetUserId) {
            return interaction.reply({ content: "Ce n'est pas ton cadeau 😌", ephemeral: true });
        }

        const consomme = consommerInventaireRoulette(targetUserId, 'freeRoll1Min');
        if (!consomme) {
            return interaction.reply({ content: "Tu n'as plus ce bonus en réserve ou il a déjà été activé !", ephemeral: true });
        }

        rouletteFreeRollUntil.set(targetUserId, Date.now() + 60 * 1000);
        rouletteImmuniteUntil.set(targetUserId, Date.now() + 60 * 1000);
        bridge.demanderSauvegarde();

        const rowDesactive = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('rlt_claim_desactive')
                .setLabel('✅ Bonus activé !')
                .setStyle(ButtonStyle.Success)
                .setDisabled(true)
        );

        if (interaction.message?.editable) {
            await interaction.message.edit({ components: [rowDesactive] }).catch(() => {});
        }

        await interaction.reply({
            content: `⚡ **C'EST PARTI !** <@${targetUserId}>, tu as **1 minute chrono** de tirages à volonté et sans aucun cooldown ! Fais péter \`!rlt go\` ou les boutons ! 🎰`,
            ephemeral: false
        });
        return true;
    }

    if (customId.startsWith('rlt_inspect_')) {
        const [, , type, authorId] = customId.split('_');
        if (interaction.user.id !== authorId) {
            return interaction.reply({ content: "Ce n'est pas ton menu d'inspection 😌", ephemeral: true });
        }

        const cibleId = interaction.values[0];
        const cible = interaction.guild.members.cache.get(cibleId);
        if (!cible) return interaction.reply({ content: "Membre introuvable sur le serveur.", ephemeral: true });

        const rowUser = new ActionRowBuilder().addComponents(
            new UserSelectMenuBuilder().setCustomId(`rlt_inspect_${type}_${authorId}`).setPlaceholder('🔍 Inspecter un autre membre...')
        );

        if (type === 'state') {
            await interaction.update({ embeds: [buildRouletteStateEmbed(cible, interaction.guildId)], components: [rowUser] });
            return true;
        } else if (type === 'stats') {
            const rowBtns = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`rlt_achs_${cible.id}_0_${authorId}`).setLabel('🎖️ Succès').setStyle(ButtonStyle.Secondary)
            );
            await interaction.update({ embeds: [buildRouletteStatsEmbed(cible)], components: [rowBtns, rowUser] });
            return true;
        } else if (type === 'succes') {
            const { embed, row } = buildRouletteAchievementsEmbed(cible, 0, authorId);
            const components = row ? [row, rowUser] : [rowUser];
            await interaction.update({ embeds: [embed], components });
            return true;
        }
        return true;
    }

    if (customId.startsWith('rlt_achs_')) {
        const [, , cibleId, pageStr, authorId] = customId.split('_');
        if (interaction.user.id !== authorId) return interaction.reply({ content: "Ce n'est pas ta commande !", ephemeral: true });
        const cible = interaction.guild.members.cache.get(cibleId);
        if (!cible) return interaction.reply({ content: "Membre introuvable.", ephemeral: true });
        const { embed, row } = buildRouletteAchievementsEmbed(cible, parseInt(pageStr, 10), authorId);
        await interaction.update({ embeds: [embed], components: [row] });
        return true;
    }
    if (customId.startsWith('rlt_stats_back_')) {
        const [, , , cibleId, authorId] = customId.split('_');
        if (interaction.user.id !== authorId) return interaction.reply({ content: "Ce n'est pas ta commande !", ephemeral: true });
        const cible = interaction.guild.members.cache.get(cibleId);
        if (!cible) return interaction.reply({ content: "Membre introuvable.", ephemeral: true });
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`rlt_achs_${cible.id}_0_${authorId}`).setLabel('🎖️ Succès').setStyle(ButtonStyle.Secondary));
        await interaction.update({ embeds: [buildRouletteStatsEmbed(cible)], components: [row] });
        return true;
    }
    if (customId.startsWith('roulette_id_')) {
        const [, , type, authorId] = customId.split('_');
        if (interaction.user.id !== authorId) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true });
        await interaction.update({ embeds: [buildRouletteTypeEmbed(type)] });
        return true;
    }
    if (customId.startsWith('roulette_probas_pres_')) {
        const authorId = customId.split('_')[3];
        if (interaction.user.id !== authorId) return interaction.reply({ content: "C'est pas ton tirage 😌", ephemeral: true });
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`roulette_back_pres_${authorId}`).setLabel('⬅️ Retour').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`roulette_tenter_${authorId}`).setLabel('🍀 Tenter sa chance').setStyle(ButtonStyle.Primary)
        );
        await interaction.update({ embeds: [buildRoulettePaytableEmbed()], components: [row] });
        return true;
    }
    if (customId.startsWith('roulette_back_pres_')) {
        const authorId = customId.split('_')[3];
        if (interaction.user.id !== authorId) return interaction.reply({ content: "C'est pas ton tirage 😌", ephemeral: true });
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`roulette_probas_pres_${authorId}`).setLabel('🎲 Probabilités').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`roulette_tenter_${authorId}`).setLabel('🍀 Tenter sa chance').setStyle(ButtonStyle.Primary)
        );
        await interaction.update({ embeds: [buildRoulettePresentationEmbed(authorId)], components: [row] });
        return true;
    }
    if (customId.startsWith('roulette_tenter_')) {
        const authorId = customId.split('_')[2];
        if (interaction.user.id !== authorId) return interaction.reply({ content: "C'est pas ton tirage 😌", ephemeral: true });
        const res = await tirerEtConstruireResultatRoulette(authorId, interaction.guild, interaction.channel, client);
        if (res.cooldown) {
            const notifRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('roulette_notif').setLabel('🔔 Me prévenir').setStyle(ButtonStyle.Secondary));
            await interaction.reply({ content: `⏳ Cooldown actif ! Il te reste **${res.reste} min**.`, components: [notifRow], ephemeral: true });
            return true;
        }
        await interaction.update({ embeds: res.embeds, components: res.components });
        await envoyerPingRedirection(interaction.channel, res);
        memoriserResultatRoulette(interaction.message.id, res.embeds[0]);
        if (res.attenteChoix) rouletteChoixEnAttente.add(interaction.message.id);
        if (res.vote) await demarrerVoteRoulette(interaction.message, res.vote);
        if (res.differe) {
            setTimeout(async () => {
                const embedFinal = await res.differe();
                memoriserResultatRoulette(interaction.message.id, embedFinal);
                interaction.message.edit({ embeds: [embedFinal] }).catch(() => {});
            }, 10000);
        }
        return true;
    }
    if (customId.startsWith('roulette_fallback_')) {
        const authorId = customId.split('_')[2];
        if (interaction.user.id !== authorId) return interaction.reply({ content: "C'est pas ton tirage 😌", ephemeral: true });
        const outcomeId = interaction.values[0];
        const auteurNom = interaction.member?.displayName ?? interaction.user.username;
        const texte = await appliquerEtDecrireResultat(outcomeId, interaction, auteurNom, 0);
        const embed = buildRouletteResultEmbed(outcomeId, texte);
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`roulette_probas_res_${authorId}_${outcomeId}_0`).setLabel('🎲 Probabilités').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`roulette_notif_${authorId}`).setLabel('🔔 Me prévenir').setStyle(ButtonStyle.Secondary)
        );
        rouletteChoixEnAttente.delete(interaction.message.id);
        memoriserResultatRoulette(interaction.message.id, embed);
        await interaction.update({ embeds: [embed], components: [row] });
        return true;
    }
    if (customId.startsWith('roulette_notif')) {
        const userId = interaction.user.id;
        const fin = rouletteCooldowns.get(userId) ?? 0;
        if (Date.now() >= fin) return interaction.reply({ content: "Ton cooldown est déjà terminé ! 🎰", ephemeral: true });
        if (rouletteNotifs.has(userId)) return interaction.reply({ content: "Tu seras déjà ping dès la fin de ton cooldown !", ephemeral: true });
        rouletteNotifs.set(userId, interaction.channelId);
        armerNotifRoulette(userId, interaction.channelId, client);
        await interaction.reply({ content: `🔔 Noté ! Je te ping ici <t:${Math.ceil(fin / 1000)}:R>.`, ephemeral: true });
        return true;
    }
    if (customId.startsWith('roulette_probas_res_')) {
        const [, , , authorId, outcomeId, failIndex] = customId.split('_');
        if (interaction.user.id !== authorId) return interaction.reply({ content: "C'est pas ton tirage 😌", ephemeral: true });
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`roulette_back_res_${authorId}_${outcomeId}_${failIndex}`).setLabel('⬅️ Retour').setStyle(ButtonStyle.Secondary));
        const components = rouletteChoixEnAttente.has(interaction.message.id) ? [buildMenuFallbackRoulette(authorId), row] : [row];
        await interaction.update({ embeds: [buildRoulettePaytableEmbed()], components });
        return true;
    }
    if (customId.startsWith('roulette_back_res_')) {
        const [, , , authorId, outcomeId, failIndex] = customId.split('_');
        if (interaction.user.id !== authorId) return interaction.reply({ content: "C'est pas ton tirage 😌", ephemeral: true });
        let embed = rouletteResultats.get(interaction.message.id);
        if (!embed) {
            const auteurNom = interaction.guild?.members.cache.get(authorId)?.displayName ?? interaction.user.username;
            const nom = ROULETTE_NOMS[outcomeId] ?? outcomeId;
            const texte = outcomeId === 'aucun-resultat' ? ROULETTE_FAILS[parseInt(failIndex, 10)] : `**${auteurNom}** est tombé.e sur **${nom}**.`;
            embed = buildRouletteResultEmbed(outcomeId, texte);
        }
        const row = buildRowResultatRoulette(authorId, outcomeId, failIndex);
        const components = rouletteChoixEnAttente.has(interaction.message.id) ? [buildMenuFallbackRoulette(authorId), row] : [row];
        await interaction.update({ embeds: [embed], components });
        return true;
    }
    return false;
}

async function handleRouletteCouronne(message, dernierAuteurParSalon) {
    if (!message.guild || message.webhookId) return;
    const precedentId = dernierAuteurParSalon.get(message.channel.id);
    dernierAuteurParSalon.set(message.channel.id, message.author.id);
    if (message.author.bot) return;

    const finCouronne = rouletteCouronneUntil.get(message.author.id);
    if (!finCouronne) return;
    if (Date.now() >= finCouronne) {
        rouletteCouronneUntil.delete(message.author.id);
        return;
    }
    if (precedentId === message.author.id) return;
    await message.react('👑').catch(() => {});
}

async function handleRouletteTransfoMessage(message, client) {
    if (message.webhookId || message.author.bot || !message.guild) return;
    if (!message.content) return;
    if (ROULETTE_WEBHOOK_EXCLUS.has(message.channel.id) || ROULETTE_WEBHOOK_EXCLUS.has(message.channel.parentId)) return;
    if (estMessageExempte(message.content, message.mentions.users.has(client.user.id))) return;

    const id = message.author.id;
    const now = Date.now();

    // Effet Écho Condescendant (1 chance sur 3)
    const finEcho = rouletteEchoUntil.get(id);
    if (finEcho) {
        if (now >= finEcho) {
            rouletteEchoUntil.delete(id);
        } else if (Math.random() < 0.35 && !message.content.startsWith('!')) {
            const replique = ROULETTE_ECHO_REPLIQUES[Math.floor(Math.random() * ROULETTE_ECHO_REPLIQUES.length)];
            setTimeout(() => { message.reply(replique).catch(() => {}); }, 1200);
        }
    }

    let contenu = message.content;
    let modifie = false;

    const lock = rouletteLettreInterdite.get(id);
    if (lock) {
        if (now >= lock.until) rouletteLettreInterdite.delete(id);
        else {
            const sansLettre = retirerLettre(contenu, lock.lettre);
            if (sansLettre !== contenu) {
                contenu = sansLettre || '\u200b';
                modifie = true;
            }
        }
    }
    const finLeet = rouletteLeetUntil.get(id);
    if (finLeet) {
        if (now >= finLeet) rouletteLeetUntil.delete(id);
        else {
            const leet = versLeet(contenu);
            if (leet !== contenu) { contenu = leet; modifie = true; }
        }
    }
    const apresTransfos = appliquerTransfos(id, contenu);
    if (apresTransfos !== contenu) { contenu = apresTransfos; modifie = true; }
    const finUwu = rouletteUwuUntil.get(id);
    if (finUwu) {
        if (now >= finUwu) rouletteUwuUntil.delete(id);
        else { contenu = `${contenu} UwU`; modifie = true; }
    }
    const finEmoji = rouletteEmojiUntil.get(id);
    if (finEmoji) {
        if (now >= finEmoji) rouletteEmojiUntil.delete(id);
        else if (!finitParUnEmoji(contenu)) {
            contenu = `${contenu} ${ROULETTE_EMOJIS_ALEATOIRES[Math.floor(Math.random() * ROULETTE_EMOJIS_ALEATOIRES.length)]}`;
            modifie = true;
        }
    }
    if (!modifie) return;

    const salonWebhook = message.channel.isThread() ? message.channel.parent : message.channel;
    const webhook = await assurerWebhookRoulette(salonWebhook);
    if (!webhook) return;

    try {
        await webhook.send({
            content: contenu.slice(0, 2000),
            username: message.member?.displayName ?? message.author.username,
            avatarURL: message.member?.displayAvatarURL() ?? message.author.displayAvatarURL(),
            files: [...message.attachments.values()].map(a => a.url),
            threadId: message.channel.isThread() ? message.channel.id : undefined,
            allowedMentions: { parse: [] }
        });
        if (!client.webhookDeletedMessages) client.webhookDeletedMessages = new Set();
        client.webhookDeletedMessages.add(message.id);
        setTimeout(() => client.webhookDeletedMessages?.delete(message.id), 15000);
        await message.delete().catch(() => {});
    } catch {}
}

async function handleRoulettePseudoLock(oldMember, newMember) {
    const lock = roulettePseudoLock.get(newMember.id);
    if (!lock) return;
    if (Date.now() >= lock.until) {
        roulettePseudoLock.delete(newMember.id);
        return;
    }
    if (newMember.nickname !== lock.pseudo) {
        await newMember.setNickname(lock.pseudo).catch(() => {});
    }
}

module.exports = {
    ROULETTE_ETATS,
    initRouletteBridge,
    verifierHappyHour,
    initialiserWebhooksRoulette,
    assurerWebhookRoulette,
    armerNotifRoulette,
    deverrouillerSucces,
    rouletteNotifs,
    rouletteAntiFeurUntil,
    rouletteAntiFeurDodges,
    rouletteAchievements,
    rouletteStats,
    rouletteBouclierActif,
    rouletteInventaire,
    handleRouletteMessage,
    handleRouletteSlash,
    handleRouletteButton,
    handleRouletteCouronne,
    handleRouletteTransfoMessage,
    handleRoulettePseudoLock
};