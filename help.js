// ==========================================
//   AIDE : !help et !helpx pour Cacabot
// ==========================================

const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

// =========================
//   BUILDERS DE PAGES !HELPX
// =========================

function buildHelpxHomeEmbed(user, botAvatarUrl = null) {
    const displayName = user?.displayName || user?.username || 'Epsys';
    return new EmbedBuilder()
        .setColor(0x5865f2)
        .setAuthor({ name: 'Cacabot • Administration Regaïa', iconURL: botAvatarUrl || undefined })
        .setTitle('👑 Centre d\'Administration (Epsys-Only)')
        .setDescription(
            `Panneau privé réservé à <@436218312574107658> *(et aux Modos pour les commandes marquées)*.\n` +
            `────────────────────────────────────────\n` +
            `### 🧭 Thématiques disponibles\n` +
            `🤖 **Cacabot, Admin & Serveur**\n` +
            `-# Diagnostic, saves, messages du bot, modération, embeds, rôles & YouTube.\n` +
            `────────────────────────────────────────\n` +
            `🎮 **Mini-Jeux & Arbitrage**\n` +
            `-# Relances d'urgence, mots/rébus forcés, indices, scores & parties de test.\n` +
            `────────────────────────────────────────\n` +
            `🎰 **Roulette (Admin)**\n` +
            `-# Édition des stats, succès, cooldowns, effets forcés & nettoyages.\n` +
            `────────────────────────────────────────\n` +
            `🎫 **Battle Pass (Admin)**\n` +
            `-# Ajout d'XP, validation de quêtes, dons d'items & aperçu onboarding.\n` +
            `────────────────────────────────────────\n` +
            `🧪 **Tests & Générateurs**\n` +
            `-# Simulations d'anniversaire, stream Twitch & envois manuels.\n` +
            `────────────────────────────────────────\n` +
            `👥 **Pour les Autres Membres**\n` +
            `-# Rappels ciblés, compteurs de messages, anniversaires & modération quotes.\n` +
            `────────────────────────────────────────\n` +
            `-# 💡 Sélectionne une catégorie dans le menu déroulant ci-dessous 👇`
        )
        .setFooter({ text: `Regaïa • Panel privé de ${displayName}` });
}

function buildHelpxCategoryEmbed(category, user, botAvatarUrl = null) {
    const displayName = user?.displayName || user?.username || 'Epsys';
    const embed = new EmbedBuilder()
        .setAuthor({ name: 'Cacabot • Panel Epsys-Only', iconURL: botAvatarUrl || undefined })
        .setFooter({ text: `Regaïa • Panel privé de ${displayName}` });

    // 1. CACABOT, ADMIN & SERVEUR
    if (category === 'cacabot') {
        return embed
            .setColor(0x5865f2)
            .setTitle('🤖 Cacabot, Admin & Serveur')
            .setDescription(
                `Gestion complète du bot, de ses messages, des salons et des configurations.\n\n` +
                `### 🩺 Santé & Sauvegardes\n` +
                `\`!diag\` *(ou \`!cacatest\`)* • Diagnostic complet de tous les modules et APIs\n` +
                `\`!save\` • \`!lastsave\` • Forcer un backup \`#json\` ou voir l'heure du dernier\n\n` +
                `### 🛡️ Modération & Voix de Cacabot\n` +
                `\`!up [réponse / ID / lien]\` *(Modos)* • Remonte une suggestion ou un vote roulette\n` +
                `-# ↳ Aussi disponible via \`/up\` et \`Clic droit -> Applications -> 🆙 Remonter (up)\`\n` +
                `\`!prune [1-100]\` *(Modos)* • Suppression en masse de messages récents\n` +
                `\`!say [#salon/ID] [texte]\` • Envoyer un message au nom de Cacabot\n` +
                `\`!reply [ID] [texte]\` • \`!edit [ID] [texte]\` • Répondre ou éditer un message du bot\n` +
                `\`!chut [durée]\` / \`!unchut\` • Couper ou réactiver les répliques dans le salon\n` +
                `\`!bug\` *(en réponse)* • \`!bug resolve [N]\` • \`!bug clear\` • Gérer la liste des bugs\n\n` +
                `### ⚙️ Configuration & Communauté\n` +
                `\`!embed\` / \`!embed modify [ID]\` • Créateur et éditeur interactif d'embeds\n` +
                `\`!rolereac\` • \`!rolebtn\` • \`!rolembed\` • Gérer rôles-réactions, boutons & panneaux\n` +
                `\`!ytabo config\` • Panneau interactif des abonnements YouTube\n` +
                `\`!welcome\` / \`!welcome test\` • Configurer l'accueil et tester l'affiche Canvas\n` +
                `\`!tribunal [@membre]\` *(ou \`!trib\` / \`!archives\`)* • Tribunal des bannis & logs \`.txt\``
            );
    }

    // 2. MINI-JEUX & ARBITRAGE
    if (category === 'minijeux') {
        return embed
            .setColor(0x2ecc71)
            .setTitle('🎮 Mini-Jeux & Arbitrage')
            .setDescription(
                `Contrôle des sessions quotidiennes, trucages, indices et tests isolés.\n\n` +
                `### ♻️ Relances d'urgence\n` +
                `\`!motusforce\` *(ou \`!motus restart\`)* • Ferme le Motus en cours et en relance un neuf\n` +
                `\`!rebusforce\` *(ou \`!rebus restart\`)* • Ferme le Rébus et relance 5 nouvelles manches\n` +
                `\`!penduforce\` *(ou \`!pendu restart\`)* • Ferme le Pendu et relance une partie officielle\n\n` +
                `### 🎯 Contenu forcé, Indices & Scores\n` +
                `\`!motus set [mot]\` • Impose le mot secret du prochain Motus\n` +
                `\`!rebus set [titre ou emojis rép]\` • Impose le rébus secret de la prochaine session\n` +
                `\`!rebus indice\` • \`!pendu indice\` • Révèle un indice immédiat sur la partie en cours\n` +
                `\`!jeupts [@membre]\` *(ou \`!points\`)* • Panneau interactif des points Motus, Rébus & Pendu\n\n` +
                `### 🧪 Sessions Solo de Test\n` +
                `\`!motustest [6/7]\` • \`!rebustest\` • \`!pendutest\` • Parties de test dans le salon actuel`
            );
    }

    // 3. ROULETTE (ADMIN)
    if (category === 'roulette') {
        return embed
            .setColor(0xf1c40f)
            .setTitle('🎰 Roulette (Administration)')
            .setDescription(
                `Gestion des statistiques, succès, cooldowns et effets spéciaux.\n\n` +
                `### 📊 Statistiques & Succès\n` +
                `\`!stats set [@membre]\` • Panneau complet pour modifier tirages, gains, bonus & malus\n` +
                `\`!successgive [@membre]\` • Menu pour réattribuer des succès perdus\n` +
                `\`!rltsuccesforce [id/test] [@membre]\` • Débloque un succès de force ou teste une carte\n\n` +
                `### 🎛️ Effets & Cooldowns\n` +
                `\`!reroll [@membre]\` • Réinitialise immédiatement le cooldown d'un·e membre\n` +
                `\`!bonusforce [id] [@membre]\` / \`!malusforce [id] [@membre]\` • Impose un tirage\n` +
                `\`!rltid\` *(ou \`!rouletteid\`)* • Liste triée des IDs bonus, malus & spéciaux\n` +
                `\`!removestate [@membre] [nom]\` • Retire un seul effet actif *(pseudo, mute, transfo...)*\n` +
                `\`!resetrlt [@membre]\` *(ou \`!resetroulettestate\`)* • Remise à zéro de tout l'état actif`
            );
    }

    // 4. BATTLE PASS (ADMIN)
    if (category === 'battlepass') {
        return embed
            .setColor(0xe67e22)
            .setTitle('🎫 Battle Pass (Administration)')
            .setDescription(
                `Outils d'inspection, d'attribution de récompenses et de test du pass.\n\n` +
                `### ⚡ XP, Quêtes & Inventaire\n` +
                `\`!bp [@membre]\` *(ou \`!pass\`)* • Inspecter le pass d'un membre + bouton **⚡ Ajouter XP**\n` +
                `\`!bp questforce [@membre]\` • Menu déroulant pour valider de force une quête en cours\n` +
                `\`!bpgive [@membre] [id] [qté]\` • Déposer un bonus dans l'inventaire roulette d'un membre\n` +
                `\`!bpgiveid\` • Liste complète des identifiants compatibles avec \`!bpgive\`\n\n` +
                `### 🔍 Prévisualisation\n` +
                `\`!bp embedtest\` • Aperçu de l'embed d'activation vu par les nouveaux membres`
            );
    }

    // 5. TESTS & GÉNÉRATEURS
    if (category === 'generateurs') {
        return embed
            .setColor(0x9b59b6)
            .setTitle('🧪 Tests & Générateurs')
            .setDescription(
                `Déclenchements manuels, simulations d'alertes et réglages de salons.\n\n` +
                `### 🎉 Alertes & Envois manuels\n` +
                `\`!anniversairetest\` • Tester l'embed, le GIF et l'alerte d'anniversaire\n` +
                `\`!streamtest\` • Tester l'embed d'annonce de live Twitch\n` +
                `\`!horoscope [ID_salon]\` • Forcer l'envoi de l'horoscope du jour dans un salon précis\n` +
                `\`!anniversaire room [ID_salon]\` • Définir le salon officiel des anniversaires`
            );
    }

    // 6. POUR LES AUTRES MEMBRES
    if (category === 'autres') {
        return embed
            .setColor(0x3498db)
            .setTitle('👥 Pour les Autres Membres')
            .setDescription(
                `Commandes d'édition ou d'action ciblée sur le profil d'un membre.\n\n` +
                `### 🔧 Actions & Modération\n` +
                `\`!rappel [ID_membre] [durée] [motif]\` • Programmer un rappel pour quelqu'un d'autre\n` +
                `\`!setmessages [@membre / ID] [nombre]\` • Définir le compteur de messages \`!top\`\n` +
                `\`!anniv set [pseudo] JJ/MM\` / \`remove [pseudo]\` *(Modos)* • Gérer l'anniv d'un membre\n` +
                `\`!quote remove [ID]\` *(Modos)* • Supprimer n'importe quelle citation des archives`
            );
    }

    return embed.setTitle('❓ Inconnu').setDescription('Catégorie introuvable.');
}

function buildHelpxMenu(authorId, currentCategory = 'home', originalMessageId = '') {
    return new StringSelectMenuBuilder()
        .setCustomId(`helpx_menu_${authorId}_${originalMessageId}`)
        .setPlaceholder('Choisis une thématique admin...')
        .addOptions(
            {
                label: 'Cacabot, Admin & Serveur',
                description: 'Diag, saves, say/reply/edit, up, embeds, rôles & tribunal',
                emoji: '🤖',
                value: 'cacabot',
                default: currentCategory === 'cacabot'
            },
            {
                label: 'Mini-Jeux & Arbitrage',
                description: 'Relances force, mots/rébus forcés, indices, jeupts & tests',
                emoji: '🎮',
                value: 'minijeux',
                default: currentCategory === 'minijeux'
            },
            {
                label: 'Roulette (Admin)',
                description: 'Stats set, successgive, reroll, bonus/malusforce & reset',
                emoji: '🎰',
                value: 'roulette',
                default: currentCategory === 'roulette'
            },
            {
                label: 'Battle Pass (Admin)',
                description: 'Ajout XP, questforce, bpgive, bpgiveid & embedtest',
                emoji: '🎫',
                value: 'battlepass',
                default: currentCategory === 'battlepass'
            },
            {
                label: 'Tests & Générateurs',
                description: 'Anniv test, stream test, horoscope forcé & salon anniv',
                emoji: '🧪',
                value: 'generateurs',
                default: currentCategory === 'generateurs'
            },
            {
                label: 'Pour les Autres Membres',
                description: 'Rappels ciblés, setmessages, anniv & quotes modo',
                emoji: '👥',
                value: 'autres',
                default: currentCategory === 'autres'
            }
        );
}

function buildHelpxButtons(authorId, currentCategory = 'home', originalMessageId = '') {
    const row = new ActionRowBuilder();

    if (currentCategory !== 'home') {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`helpx_home_${authorId}_${originalMessageId}`)
                .setLabel('Accueil')
                .setEmoji('🏠')
                .setStyle(ButtonStyle.Secondary)
        );
    }

    row.addComponents(
        new ButtonBuilder()
            .setCustomId(`helpx_delete_${authorId}_${originalMessageId}`)
            .setLabel('Fermer')
            .setEmoji('🗑️')
            .setStyle(ButtonStyle.Secondary)
    );

    return row;
}

// =========================
//   BUILDERS DE PAGES !HELP
// =========================

function buildHelpHomeEmbed(user, botAvatarUrl = null) {
    const displayName = user?.displayName || user?.username || 'Membre';
    return new EmbedBuilder()
        .setColor(0x5865f2)
        .setAuthor({ name: 'Cacabot • Compagnon de Regaïa', iconURL: botAvatarUrl || undefined })
        .setTitle('💩 Centre d\'Aide & Commandes')
        .setDescription(
            `Bienvenue sur le guide officiel de **Cacabot** !\n` +
            `Toutes les commandes s'utilisent avec le préfixe **\`!\`** ou directement en commande slash **\`/\`**.\n` +
            `────────────────────────────────────────\n` +
            `### 🧭 Thématiques disponibles\n` +
            `🎰 **Roulette & Battle Pass**\n` +
            `-# Casino toutes les 15 min, inventaire, quêtes et 25 paliers mensuels.\n` +
            `────────────────────────────────────────\n` +
            `🎮 **Rendez-vous & Jeux Quotidiens**\n` +
            `-# Sessions automatiques : Motus (10h/19h), Rébus (15h) et Pendu (21h).\n` +
            `────────────────────────────────────────\n` +
            `👥 **Profils & Vie du Serveur**\n` +
            `-# Fiches membres, podiums d'activité, anniversaires et citations mythiques.\n` +
            `────────────────────────────────────────\n` +
            `🎭 **Interactions Sociales**\n` +
            `-# Actions animées : bisous, câlins, rizz, bagarres et réactions.\n` +
            `────────────────────────────────────────\n` +
            `🔮 **Oracles, Débats & Fun**\n` +
            `-# Horoscope, destin, animal spirituel, dilemmes et pile ou face.\n` +
            `────────────────────────────────────────\n` +
            `🛠️ **Utilitaires du Quotidien**\n` +
            `-# Rappels personnels avec snooze, Pomodoro, météo et YouTube.\n` +
            `────────────────────────────────────────\n` +
            `-# 💡 Sélectionne une catégorie dans le menu déroulant ci-dessous 👇`
        )
        .setFooter({ text: `Regaïa • Demandé par ${displayName}` });
}

function buildHelpCategoryEmbed(category, user, botAvatarUrl = null) {
    const displayName = user?.displayName || user?.username || 'Membre';
    const embed = new EmbedBuilder()
        .setAuthor({ name: 'Cacabot • Guide de Regaïa', iconURL: botAvatarUrl || undefined })
        .setFooter({ text: `Regaïa • Demandé par ${displayName}` });

    // 1. ROULETTE & BATTLE PASS
    if (category === 'roulette') {
        return embed
            .setColor(0xf1c40f)
            .setTitle('🎰 Roulette & Battle Pass')
            .setDescription(
                `Le système de casino et de progression communautaire de Regaïa.\n` +
                `-# 🔒 Accès : Nécessite le rôle Roulette à récupérer dans <#1559082682313474059> ou <#1559324422165373008> !\n\n` +
                `### 🎲 La Roulette Regaïenne\n` +
                `Tente ta chance toutes les 15 minutes pour remporter des bonus ou subir des malus éphémères.\n` +
                `-# ⏱️ Cooldown réduit à **5 min en Happy Hour (20h00)** !\n\n` +
                `\`!rlt\` • Tenter ta chance\n` +
                `\`!rlt claim\` • Ouvrir ton inventaire *(boucliers, relances & récompenses)*\n` +
                `\`!rlt state\` • Consulter tes transformations et effets actifs\n` +
                `\`!rlt stats [@membre]\` • Bilan complet de tes tirages\n` +
                `\`!rlttop\` • Le Panthéon des chasseurs de succès\n\n` +
                `### 🎫 Le Battle Pass Mensuel\n` +
                `Accomplis tes quêtes quotidiennes et hebdos pour débloquer 25 paliers de récompenses.\n\n` +
                `\`!bp\` *(ou \`!pass\`)* • Ouvrir ton Battle Pass de la saison\n` +
                `-# 🎁 Astuce : Le bouton **Tout récupérer** sous ton pass te permet d'encaisser tous tes paliers débloqués en un clic !`
            );
    }

    // 2. RENDEZ-VOUS & JEUX QUOTIDIENS
    if (category === 'minijeux') {
        return embed
            .setColor(0x2ecc71)
            .setTitle('🎮 Rendez-vous & Jeux Quotidiens')
            .setDescription(
                `Cacabot anime des sessions automatiques à heures fixes dans les salons dédiés.\n` +
                `*Pas besoin de commande pour jouer : écris directement ta proposition dans le salon !*\n\n` +
                `-# 🔒 Accès : Récupère tes rôles de jeux dans <#1559082682313474059> ou <#1559324422165373008> pour voir les salons et participer !\n\n` +
                `### 🟩 Le Motus\n` +
                `📅 Tous les jours à **10h00** (6 lettres) et **19h00** (7 lettres).\n` +
                `Écris simplement ton mot dans le chat pendant la session.\n` +
                `📊 **\`!motustats [@membre]\`** • 🏆 **\`!motustop\`**\n\n` +
                `### 🧩 Le Rébus Regaïen\n` +
                `📅 Tous les jours à **15h00** (5 manches de 5 minutes).\n` +
                `Déchiffre l'image et écris la réponse exacte dans le salon pour marquer des points.\n` +
                `📊 **\`!rebusstats [@membre]\`** • 🏆 **\`!rebustop\`**\n\n` +
                `### 🪢 Le Pendu\n` +
                `📅 Tous les soirs à **21h00** (mot de 7 lettres, 3 essais max par joueur).\n` +
                `Propose une lettre ou le mot complet directement dans le chat !\n` +
                `📊 **\`!pendustats [@membre]\`** • 🏆 **\`!pendutop\`**`
            );
    }

    // 3. PROFILS & VIE DU SERVEUR
    if (category === 'serveur') {
        return embed
            .setColor(0x3498db)
            .setTitle('👥 Profils & Vie du Serveur')
            .setDescription(
                `Tout ce qui concerne ton activité, ton identité et la communauté de Regaïa.\n\n` +
                `### 📊 Fiches & Activité\n` +
                `\`!profil [@membre]\` • Fiche complète : rang, stats, succès et date d'arrivée\n` +
                `\`!avatar [@membre]\` • Affiche la photo de profil en haute définition\n` +
                `\`!top\` • Classement historique des messages du serveur\n` +
                `\`!actif\` • Podiums d'activité *(Aujourd'hui, Cette semaine, Ce mois-ci)*\n\n` +
                `### 🎂 Les Anniversaires\n` +
                `\`!anniv set JJ/MM\` • Enregistre ta date d'anniversaire\n` +
                `\`!anniv show [@membre]\` • Affiche la date et le compte à rebours\n` +
                `\`!anniv list\` • Liste de tous les anniversaires du serveur\n` +
                `\`!anniv next\` • Affiche le tout prochain anniversaire à fêter\n\n` +
                `### 🏛️ Communauté Regaïa\n` +
                `\`!quote [numéro / recherche]\` • Citation mythique archivée *(ou au hasard)*\n` +
                `\`!suggestion [idée]\` • Soumettre une proposition au vote communautaire\n` +
                `\`!serveur\` • Statistiques et informations complètes sur le serveur`
            );
    }

    // 4. INTERACTIONS SOCIALES & RP
    if (category === 'social') {
        return embed
            .setColor(0xe91e63)
            .setTitle('🎭 Interactions Sociales & Actions RP')
            .setDescription(
                `Toutes les commandes animées pour interagir avec les membres du serveur.\n` +
                `*Mentionne un membre (ex: \`!kiss @membre\`) ou utilise la commande solo.*\n\n` +
                `### 💖 Affection & Rizz\n` +
                `\`kiss\` • \`hug\` • \`danse\` • \`rizz\` • \`lovecalc @user1 @user2\`\n\n` +
                `### 💥 Bagarre & Provoc\n` +
                `\`punch\` • \`bang\` • \`insult\` • \`ban\` • \`bait\`\n\n` +
                `### 😆 Humeurs & Réactions\n` +
                `\`rire\` • \`cry\` • \`die\` • \`explode\` • \`run\` • \`palaref\` • \`jailaref\``
            );
    }

    // 5. ORACLES, DÉBATS & FUN
    if (category === 'fun') {
        return embed
            .setColor(0x9b59b6)
            .setTitle('🔮 Oracles, Débats & Fun')
            .setDescription(
                `Prédictions loufoques, débats du soir et divertissements communautaires.\n\n` +
                `### 🔮 Oracles & Destin\n` +
                `\`!horoscope\` • L'horoscope cosmique quotidien selon ton signe\n` +
                `\`!destin\` • Prophéties absurdes et loufoques sur ton avenir\n` +
                `\`!animal\` • Découvre ton animal spirituel parmi 7000 combinaisons\n\n` +
                `### ⚖️ Débats & Gastronomie\n` +
                `\`!question\` • Lance une question de débat du soir parmi 6 thématiques\n` +
                `\`!choix [option 1 ou 2]\` • Laisse Cacabot trancher un dilemme cornélien\n` +
                `\`!topchef [nom/photo]\` • La note gastronomique sans pitié de Cacabot\n\n` +
                `### 🎲 Hasard & Mascottes\n` +
                `\`!flip [mise]\` • Pile ou face *(solo ou duel de pari face à un membre)*\n` +
                `\`!blague\` • Blague aléatoire *(Soft, Classique, Humour Noir)*\n` +
                `\`!sylvain\` • \`!epsys\` • \`!bougetoi\` • Parce que`
            );
    }

    // 6. UTILITAIRES DU QUOTIDIEN
    if (category === 'util') {
        return embed
            .setColor(0x95a5a6)
            .setTitle('🛠️ Utilitaires & Quotidien')
            .setDescription(
                `Des outils pratiques pour ton quotidien, tes sessions de travail et la gestion du bot.\n\n` +
                `### ⏰ Organisation & Focus\n` +
                `\`!rappel [durée] [motif]\` • Programme un rappel personnel *(ex: \`!rappel 20min four\`)*\n` +
                `-# ↳ Boutons sous le message pour reporter instantanément de **+10 min** ou **+1h** !\n` +
                `\`!pomodoro [travail] [pause]\` • Minuteur Pomodoro de concentration *(ex: \`!pomodoro 25 5\`)*\n` +
                `\`!meteo [ville]\` • Bulletin météo, température et conditions en direct\n\n` +
                `### 📺 Médias & Minecraft\n` +
                `\`!youtube [recherche]\` • Recherche interactive avec lecteur intégré\n` +
                `\`!last [chaîne]\` • Affiche le dernier upload d'une chaîne YouTube\n` +
                `\`!stats [chaîne]\` • Statistiques complètes d'une chaîne YouTube\n` +
                `\`!aternos\` • Statut et adresse IP du serveur Minecraft Regaïa\n\n` +
                `### 🤖 Vie de Cacabot\n` +
                `\`!botinfo\` *(ou \`!about\`)* • Version, temps d\'activité (uptime) et mémoire\n` +
                `\`!ping\` • Mesure de la latence de réponse API et WebSocket\n` +
                `\`!stop\` / \`!unstop\` • Mettre en pause ou relancer les répliques automatiques`
            );
    }

    return embed.setTitle('❓ Inconnu').setDescription('Catégorie introuvable.');
}

// =========================
//   COMPOSANTS (MENUS & BOUTONS)
// =========================

function buildHelpMenu(authorId, currentCategory = 'home', originalMessageId = '') {
    return new StringSelectMenuBuilder()
        .setCustomId(`help_menu_${authorId}_${originalMessageId}`)
        .setPlaceholder('Choisis une thématique...')
        .addOptions(
            {
                label: 'Roulette & Battle Pass',
                description: 'Casino, inventaire, bonus actifs et 25 paliers',
                emoji: '🎰',
                value: 'roulette',
                default: currentCategory === 'roulette'
            },
            {
                label: 'Rendez-vous & Jeux Quotidiens',
                description: 'Motus (10h/19h), Rébus (15h), Pendu (21h) et tops',
                emoji: '🎮',
                value: 'minijeux',
                default: currentCategory === 'minijeux'
            },
            {
                label: 'Profils & Vie du Serveur',
                description: 'Fiches membres, tops d\'activité, anniversaires, quotes',
                emoji: '👥',
                value: 'serveur',
                default: currentCategory === 'serveur'
            },
            {
                label: 'Interactions Sociales & RP',
                description: 'Affection, clash, bagarres, duels et réactions',
                emoji: '🎭',
                value: 'social',
                default: currentCategory === 'social'
            },
            {
                label: 'Oracles, Débats & Fun',
                description: 'Horoscope, destin, animal spirituel, débats et blagues',
                emoji: '🔮',
                value: 'fun',
                default: currentCategory === 'fun'
            },
            {
                label: 'Utilitaires du Quotidien',
                description: 'Rappels avec snooze, pomodoro, météo, youtube',
                emoji: '🛠️',
                value: 'util',
                default: currentCategory === 'util'
            }
        );
}

function buildHelpButtons(authorId, currentCategory = 'home', originalMessageId = '') {
    const row = new ActionRowBuilder();

    if (currentCategory !== 'home') {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`help_home_${authorId}_${originalMessageId}`)
                .setLabel('Accueil')
                .setEmoji('🏠')
                .setStyle(ButtonStyle.Secondary)
        );
    }

    row.addComponents(
        new ButtonBuilder()
            .setCustomId(`help_delete_${authorId}_${originalMessageId}`)
            .setLabel('Fermer')
            .setEmoji('🗑️')
            .setStyle(ButtonStyle.Secondary)
    );

    return row;
}

// =========================
//   DÉTECTION DES COMMANDES
// =========================

function getHelpResponse(command) {
    if (command === "!help" || command === "!aide") {
        return {
            needsHelp: true,
            data: buildHelpHomeEmbed()
        };
    }

    if (command === "!helpx") {
        return { needsHelpx: true };
    }

    return null;
}

// =========================
//   COMMANDES (messages)
// =========================

async function runHelpMessage(message, response) {
    // !helpx (Epsys-Only)
    if (response?.needsHelpx) {
        if (message.author.id !== '436218312574107658') {
            return message.reply("Tu n'es pas autorisé(e) à faire cette commande.");
        }
        const botAvatarUrl = message.client?.user?.displayAvatarURL({ dynamic: true });
        const embed = buildHelpxHomeEmbed(message.author, botAvatarUrl);
        const menuRow = new ActionRowBuilder().addComponents(buildHelpxMenu(message.author.id, 'home', message.id));
        const btnRow = buildHelpxButtons(message.author.id, 'home', message.id);
        return message.reply({ embeds: [embed], components: [menuRow, btnRow] });
    }

    // !help
    if (response?.data || response?.needsHelp) {
        const botAvatarUrl = message.client?.user?.displayAvatarURL({ dynamic: true });
        const embed = buildHelpHomeEmbed(message.author, botAvatarUrl);
        const menuRow = new ActionRowBuilder().addComponents(buildHelpMenu(message.author.id, 'home', message.id));
        const btnRow = buildHelpButtons(message.author.id, 'home', message.id);
        return message.reply({ embeds: [embed], components: [menuRow, btnRow] });
    }
}

// =========================
//   INTERACTIONS (MENUS & BOUTONS & SLASH)
// =========================

async function runHelpInteraction(interaction) {
    const botAvatarUrl = interaction.client?.user?.displayAvatarURL({ dynamic: true });

    // 1. Commande Slash /help
    if (interaction.isChatInputCommand && interaction.isChatInputCommand()) {
        const embed = buildHelpHomeEmbed(interaction.user, botAvatarUrl);
        const menuRow = new ActionRowBuilder().addComponents(buildHelpMenu(interaction.user.id, 'home', ''));
        const btnRow = buildHelpButtons(interaction.user.id, 'home', '');
        return interaction.reply({ embeds: [embed], components: [menuRow, btnRow] });
    }

    // 2. Menu déroulant Epsys (!helpx)
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('helpx_menu_')) {
        const parts = interaction.customId.split('_');
        const authorId = parts[2];
        const originalMessageId = parts[3] || '';
        if (interaction.user.id !== authorId) {
            return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true });
        }

        const category = interaction.values[0];
        const embed = buildHelpxCategoryEmbed(category, interaction.user, botAvatarUrl);
        const menuRow = new ActionRowBuilder().addComponents(buildHelpxMenu(authorId, category, originalMessageId));
        const btnRow = buildHelpxButtons(authorId, category, originalMessageId);
        return interaction.update({ embeds: [embed], components: [menuRow, btnRow] });
    }

    // 2b. Bouton Retour Accueil (!helpx)
    if (interaction.isButton() && interaction.customId.startsWith('helpx_home_')) {
        const parts = interaction.customId.split('_');
        const authorId = parts[2];
        const originalMessageId = parts[3] || '';
        if (interaction.user.id !== authorId) {
            return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true });
        }

        const embed = buildHelpxHomeEmbed(interaction.user, botAvatarUrl);
        const menuRow = new ActionRowBuilder().addComponents(buildHelpxMenu(authorId, 'home', originalMessageId));
        const btnRow = buildHelpxButtons(authorId, 'home', originalMessageId);
        return interaction.update({ embeds: [embed], components: [menuRow, btnRow] });
    }

    // 2c. Bouton Supprimer / Fermer (!helpx)
    if (interaction.isButton() && interaction.customId.startsWith('helpx_delete_')) {
        const parts = interaction.customId.split('_');
        const authorId = parts[2];
        const originalMessageId = parts[3] || '';
        if (interaction.user.id !== authorId) {
            return interaction.reply({ content: "Tu ne peux pas supprimer ce message !", ephemeral: true });
        }

        await interaction.message.delete().catch(() => {});
        if (originalMessageId && originalMessageId !== '') {
            const originalMsg = await interaction.channel.messages.fetch(originalMessageId).catch(() => null);
            if (originalMsg) await originalMsg.delete().catch(() => {});
        }
        return;
    }

    // 3. Menu déroulant principal (!help)
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('help_menu_')) {
        const parts = interaction.customId.split('_');
        const authorId = parts[2];
        const originalMessageId = parts[3] || '';
        if (interaction.user.id !== authorId) {
            return interaction.reply({ content: "Ce menu ne t'est pas destiné !", ephemeral: true });
        }

        const category = interaction.values[0];
        const embed = buildHelpCategoryEmbed(category, interaction.user, botAvatarUrl);
        const menuRow = new ActionRowBuilder().addComponents(buildHelpMenu(authorId, category, originalMessageId));
        const btnRow = buildHelpButtons(authorId, category, originalMessageId);
        return interaction.update({ embeds: [embed], components: [menuRow, btnRow] });
    }

    // 4. Bouton Retour Accueil (!help)
    if (interaction.isButton() && interaction.customId.startsWith('help_home_')) {
        const parts = interaction.customId.split('_');
        const authorId = parts[2];
        const originalMessageId = parts[3] || '';
        if (interaction.user.id !== authorId) {
            return interaction.reply({ content: "Ce menu ne t'est pas destiné !", ephemeral: true });
        }

        const embed = buildHelpHomeEmbed(interaction.user, botAvatarUrl);
        const menuRow = new ActionRowBuilder().addComponents(buildHelpMenu(authorId, 'home', originalMessageId));
        const btnRow = buildHelpButtons(authorId, 'home', originalMessageId);
        return interaction.update({ embeds: [embed], components: [menuRow, btnRow] });
    }

    // 5. Bouton Supprimer / Fermer (!help)
    if (interaction.isButton() && interaction.customId.startsWith('help_delete_')) {
        const parts = interaction.customId.split('_');
        const authorId = parts[2];
        const originalMessageId = parts[3] || '';
        if (interaction.user.id !== authorId) {
            return interaction.reply({ content: "Tu ne peux pas supprimer ce message !", ephemeral: true });
        }

        await interaction.message.delete().catch(() => {});
        if (originalMessageId && originalMessageId !== '') {
            const originalMsg = await interaction.channel.messages.fetch(originalMessageId).catch(() => null);
            if (originalMsg) await originalMsg.delete().catch(() => {});
        }
        return;
    }
}

// =========================
//   POINTS D'ENTRÉE EXPORTÉS
// =========================

async function handleHelpMessage(message, response) {
    if (!response?.needsHelpx && !response?.data && !response?.needsHelp) return false;
    await runHelpMessage(message, response);
    return true;
}

async function handleHelpInteraction(interaction) {
    const isSlashHelp = interaction.isChatInputCommand && interaction.isChatInputCommand() && interaction.commandName === 'help';
    const isHelpComponent = (interaction.isButton() || interaction.isStringSelectMenu()) && /^helpx?_/.test(interaction.customId);

    if (!isSlashHelp && !isHelpComponent) return false;
    await runHelpInteraction(interaction);
    return true;
}

module.exports = { getHelpResponse, handleHelpMessage, handleHelpInteraction };