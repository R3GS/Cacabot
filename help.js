// ==========================================
//   AIDE : !help et !helpx pour Cacabot
// ==========================================

const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

function buildHelpxPresentationEmbed() {
    return new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('👑 Commandes Epsys-Only')
        .setDescription("Commandes exclusivement accessibles par <@436218312574107658>.\n\nChoisis une catégorie dans le menu ci-dessous 👇");
}

function buildHelpxMenu(authorId) {
    return new StringSelectMenuBuilder()
        .setCustomId(`helpx_menu_${authorId}`)
        .setPlaceholder('Choisis une catégorie')
        .addOptions(
            { label: 'Cacabot & Admin', emoji: '🤖', value: 'cacabot' },
            { label: 'Mini-jeux', emoji: '🎮', value: 'minijeux' },
            { label: 'Générateurs & Tests', emoji: '🧪', value: 'generateurs' },
            { label: 'Pour les autres', emoji: '👥', value: 'autres' },
            { label: 'Roulette', emoji: '🎰', value: 'roulette' },
            { label: 'Battle Pass', emoji: '🎫', value: 'battlepass' }
        );
}

function buildHelpxCategorieEmbed(categorie) {
    const embed = new EmbedBuilder().setColor(0x5865f2);

    if (categorie === 'cacabot') {
        return embed.setTitle('🤖 Commandes liées à Cacabot & Administration')
            .addFields(
                { name: '🩺 **!diag / !cacatest**', value: 'Diagnostic complet de l\'état de santé de tous les modules.' },
                { name: '⚖️ **!tribunal / !trib [@membre]**', value: 'Le tribunal des bannis.' },
                { name: '📄 **!archives / !tribunal archives**', value: 'Pour avoir accès aux archives des tribunaux (fichiers en .txt).' },
                { name: '📺 **!ytabo config**', value: 'Panneau interactif des abonnements et notifications YouTube.' },
                { name: '👋 **!welcome / !welcome test**', value: 'Configurer le salon d\'accueil ou tester l\'affiche Canvas.' },
                { name: '📣 **!say [ID Salon] [message]**', value: 'Envoyer un message dans un salon au nom de Cacabot.' },
                { name: '💬 **!reply [ID_message] [texte]**', value: 'Répondre directement à un message sous le nom de Cacabot.' },
                { name: '✏️ **!edit [ID_message] [texte]**', value: 'Modifier un message envoyé par Cacabot.' },
                { name: '🐛 **!bug / !bug resolve [N]**', value: 'Répondre à un message avec `!bug` pour le répertorier dans la liste des bugs.' },
                { name: '🖼️ **!embed / !embed modify [ID]**', value: 'Créateur et modificateur interactif d\'embeds complets.' },
                { name: '🎭 **!rolereac / !rolebtn**', value: 'Gérer les rôles réactions et boutons de rôles.' },
                { name: '🤐 **!chut [temps] / !unchut**', value: 'Faire taire Cacabot temporairement sur un salon.' },
                { name: '💾 **!save / !lastsave**', value: 'Forcer une sauvegarde ou consulter l\'heure de la dernière sauvegarde.' }
            );
    }

    if (categorie === 'minijeux') {
        return embed.setTitle('🎮 Commandes Mini-Jeux (Epsys-Only)')
            .addFields(
                { name: '♻️ **!penduforce**', value: 'Ferme la session de Pendu en cours et en relance une nouvelle immédiatement.' },
                { name: '♻️ **!rebusforce**', value: 'Ferme la session de Rébus en cours et relance une nouvelle session de 5 manches.' },
                { name: '♻️ **!motusforce**', value: 'Ferme le Motus en cours et relance immédiatement une nouvelle session.' },
                { name: '🔤 **!motus set / force [mot]**', value: 'Définit manuellement le mot secret de la prochaine session de Motus.' },
                { name: '🧩 **!rebus set / force [titre ou emojis réponse]**', value: 'Définit le rébus secret de la prochaine session de Rébus.' },
                { name: '📊 **!jeupts [@membre]**', value: 'Panneau interactif complet pour modifier les points/victoires de Motus, Rébus et Pendu.' },
                { name: '🟩 **!motustest [6/7]**', value: 'Lancer un Motus solo de test dans le salon actuel.' },
                { name: '🧩 **!rebustest**', value: 'Lancer une manche solo de test du Rébus dans le salon actuel.' },
                { name: '🪢 **!pendutest**', value: 'Lancer une partie solo de test du Pendu dans le salon actuel.' }
            );
    }

    if (categorie === 'generateurs') {
        return embed.setTitle('🧪 Générateurs & Tests en solo')
            .addFields(
                { name: '🎂 **!anniversairetest**', value: 'Tester l\'alerte et le GIF d\'anniversaire.' },
                { name: '🟣 **!streamtest**', value: 'Tester l\'embed d\'alerte de live Twitch.' },
                { name: '🔮 **!horoscope [ID_salon]**', value: 'Forcer l\'envoi de l\'horoscope du jour dans un salon spécifique.' },
            );
    }

    if (categorie === 'autres') {
        return embed.setTitle('👥 Commandes pour les autres membres')
            .addFields(
                { name: '⏰ **!rappel [ID] Xmin/h [message]**', value: 'Programmer un rappel pour un membre précis par son ID.' },
                { name: '📝 **!setmessages @Membre [nombre]**', value: 'Définir manuellement le compteur de messages d\'un membre.' }
            );
    }

    if (categorie === 'roulette') {
        return embed.setColor(0xffd20a).setTitle('🎰 Commandes Roulette (Epsys-Only)')
            .addFields(
                { name: '📊 **!stats set [membre]**', value: 'Panneau interactif complet pour modifier les stats roulette (tirages, bonus, malus, rien, plus gros gain, etc.).' },
                { name: '🎖️ **!successgive [membre]**', value: 'Panneau interactif avec menus contextuels pour redonner des succès perdus à un membre.' },
                { name: '🔄 **!reroll [membre]**', value: 'Réinitialise le cooldown d\'un·e membre.' },
                { name: '🎉/💀 **!bonusforce / !malusforce [id] [membre]**', value: 'Impose un bonus ou un malus à un·e membre.' },
                { name: '📋 **!rouletteid / !rltid**', value: 'Affiche tous les identifiants de bonus/malus/spécial, triés par bouton.' },
                { name: '♻️ **!resetroulettestate / !resetrlt [membre]**', value: 'Réinitialise tout l\'état roulette d\'un·e membre.' },
                { name: '🗑️ **!removestate [membre] [nom]**', value: 'Retire un seul effet actif d\'un·e membre (pseudo, mute, transfos, etc.).' },
                { name: '🎖️ **!rltsuccesforce [id/test] [membre]**', value: 'Débloque de force un succès de la roulette ou lance une carte de test.' }
            );
    }

    if (categorie === 'battlepass') {
        return embed.setColor(0x2ecc71).setTitle('🎫 Commandes Battle Pass (Epsys-Only)')
            .addFields(
                { name: '⚡ **!bp [membre]**', value: 'Inspecter le Battle Pass d\'un membre avec le bouton **⚡ Ajouter XP**.' },
                { name: '🛠️ **!bp questforce [membre]**', value: 'Menu déroulant pour compléter de force une quête en cours.' },
                { name: '🎁 **!bpgive [membre] [id] [qte]**', value: 'Déposer directement un bonus de palier dans l\'inventaire d\'un membre.' },
                { name: '📋 **!bpgiveid**', value: 'Liste de tous les identifiants de bonus à donner avec !bpgive.' },
                { name: '🔍 **!bp embedtest**', value: 'Prévisualiser l\'embed d\'onboarding que voient les nouveaux membres.' }
            );
    }

    return embed.setTitle('❓ Inconnu').setDescription('Catégorie introuvable.');
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
            `Toutes les commandes s'utilisent avec le préfixe **\`!\`** ou directement en commande slash **\`/\`**.\n\n` +
            `### 🧭 Thématiques disponibles\n\n` +
            `🎰 **Roulette & Battle Pass**\n` +
            `-# Casino toutes les 15 min, inventaire, quêtes et 25 paliers mensuels.\n\n` +
            `🎮 **Rendez-vous & Jeux Quotidiens**\n` +
            `-# Sessions automatiques : Motus (10h/19h), Rébus (15h) et Pendu (21h).\n\n` +
            `👥 **Profils & Vie du Serveur**\n` +
            `-# Fiches membres, podiums d'activité, anniversaires et citations mythiques.\n\n` +
            `🎭 **Interactions Sociales**\n` +
            `-# Actions animées : bisous, câlins, rizz, bagarres et réactions.\n\n` +
            `🔮 **Oracles, Débats & Fun**\n` +
            `-# Horoscope, destin, animal spirituel, dilemmes et pile ou face.\n\n` +
            `🛠️ **Utilitaires du Quotidien**\n` +
            `-# Rappels personnels avec snooze, Pomodoro, météo et YouTube.\n\n` +
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
                `Le système de casino et de progression communautaire de Regaïa.\n\n` +
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
                `*Mentionne un membre (ex: \`!kiss @Epsys\`) ou utilise la commande solo.*\n\n` +
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
                `\`!sylvain\` • \`!epsys\` • \`!bougetoi\` • Les mascottes cultes de Regaïa`
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
                `\`!botinfo\` *(ou \`!about\`)* • Version, temps d'activité (uptime) et mémoire\n` +
                `\`!ping\` • Mesure de la latence de réponse API et WebSocket\n` +
                `\`!stop\` / \`!unstop\` • Mettre en pause ou relancer les répliques automatiques`
            );
    }

    return embed.setTitle('❓ Inconnu').setDescription('Catégorie introuvable.');
}

// =========================
//   COMPOSANTS (MENUS & BOUTONS)
// =========================

function buildHelpMenu(authorId, currentCategory = 'home') {
    return new StringSelectMenuBuilder()
        .setCustomId(`help_menu_${authorId}`)
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
        const embed = buildHelpxPresentationEmbed();
        const row = new ActionRowBuilder().addComponents(buildHelpxMenu(message.author.id));
        return message.reply({ embeds: [embed], components: [row] });
    }

    // !help
    if (response?.data || response?.needsHelp) {
        const botAvatarUrl = message.client?.user?.displayAvatarURL({ dynamic: true });
        const embed = buildHelpHomeEmbed(message.author, botAvatarUrl);
        const menuRow = new ActionRowBuilder().addComponents(buildHelpMenu(message.author.id, 'home'));
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
        const menuRow = new ActionRowBuilder().addComponents(buildHelpMenu(interaction.user.id, 'home'));
        const btnRow = buildHelpButtons(interaction.user.id, 'home');
        return interaction.reply({ embeds: [embed], components: [menuRow, btnRow] });
    }

    // 2. Menu déroulant Epsys (!helpx)
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('helpx_menu_')) {
        const authorId = interaction.customId.split('_')[2];
        if (interaction.user.id !== authorId) {
            return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true });
        }
        const embed = buildHelpxCategorieEmbed(interaction.values[0]);
        const row = new ActionRowBuilder().addComponents(buildHelpxMenu(authorId));
        return interaction.update({ embeds: [embed], components: [row] });
    }

    // 3. Menu déroulant principal (!help)
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('help_menu_')) {
        const authorId = interaction.customId.split('_')[2];
        if (interaction.user.id !== authorId) {
            return interaction.reply({ content: "Ce menu ne t'est pas destiné !", ephemeral: true });
        }

        const category = interaction.values[0];
        const embed = buildHelpCategoryEmbed(category, interaction.user, botAvatarUrl);
        const menuRow = new ActionRowBuilder().addComponents(buildHelpMenu(authorId, category));
        const btnRow = buildHelpButtons(authorId, category);
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
        const menuRow = new ActionRowBuilder().addComponents(buildHelpMenu(authorId, 'home'));
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