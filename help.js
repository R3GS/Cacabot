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
        .setAuthor({ name: 'Cacabot • Guide de Regaïa', iconURL: botAvatarUrl || undefined })
        .setTitle('💩 Guide des Commandes & Fonctionnalités')
        .setDescription(
            `Bienvenue sur le guide de **Cacabot**, le bot compagnon de **Regaïa** !\n` +
            `Toutes les commandes fonctionnent avec le préfixe **\`!\`** ou en commande slash **\`/\`**.\n\n` +
            `### 🧭 Choisis une thématique dans le menu déroulant :\n` +
            `🎰 **Roulette & Battle Pass** — *Casino, inventaire, bonus et 25 paliers*\n` +
            `🎮 **Rendez-vous & Jeux** — *Motus (10h/19h), Rébus (15h), Pendu (21h)*\n` +
            `👥 **Profils & Vie du Serveur** — *Fiches, classements, anniversaires, citations*\n` +
            `🎭 **Interactions Sociales** — *Actions RP, câlins, baffes, rizz et drama*\n` +
            `🔮 **Oracles, Débats & Fun** — *Horoscope, destin, animal spirituel, dilemmes*\n` +
            `🛠️ **Utilitaires du Quotidien** — *Rappels (avec snooze), Pomodoro, météo, YouTube*\n\n` +
            `-# 💡 Sélectionne une catégorie ci-dessous pour ouvrir ses commandes 👇`
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
            .setDescription('Le cœur du divertissement et de la progression communautaire sur Regaïa.')
            .addFields(
                {
                    name: '🎲 La Roulette Regaïenne',
                    value:
                        '**`!rlt`** *(ou `!roulette`)* — Tente ta chance toutes les 15 min\n' +
                        '-# ↳ Réduit à **5 min en Happy Hour (20h)** ! Plein d\'effets et malus loufoques.\n' +
                        '🎒 **`!rlt claim`** — Inventaire (boucliers, relances et récompenses stockées)\n' +
                        '✨ **`!rlt state`** — Consulter tes transformations et effets actifs\n' +
                        '📊 **`!rlt stats [@membre]`** — Bilan complet des tirages (gains, pertes, nuls)\n' +
                        '🏆 **`!rlttop`** — Le Panthéon des chasseurs de succès'
                },
                {
                    name: '🎫 Le Battle Pass Mensuel',
                    value:
                        '**`!bp`** *(ou `!pass`)* — Consulter tes quêtes de la saison et tes paliers\n' +
                        '-# ↳ Quêtes quotidiennes et hebdos pour débloquer 25 paliers de récompenses.\n' +
                        '🎁 Bouton **Tout récupérer** disponible sous le pass pour claim tes gains en un clic !'
                }
            );
    }

    // 2. RENDEZ-VOUS & JEUX QUOTIDIENS
    if (category === 'minijeux') {
        return embed
            .setColor(0x2ecc71)
            .setTitle('🎮 Rendez-vous & Jeux Quotidiens')
            .setDescription(
                'Cacabot lance automatiquement les parties dans les salons dédiés.\n' +
                '**Pas besoin de commande pour jouer** : écris simplement ta proposition dans le salon pendant la session !'
            )
            .addFields(
                {
                    name: '🟩 Le Motus • Salon dédié',
                    value:
                        '⏰ Sessions chaque jour à **10h00** (6 lettres) et **19h00** (7 lettres)\n' +
                        '-# ↳ Propose ton mot directement dans le chat. Lettres bien placées en vert, mal placées en jaune !\n' +
                        '📊 Stats : **`!motustats [@membre]`** • 🏆 Classement : **`!motustop`**'
                },
                {
                    name: '🧩 Le Rébus Regaïen • Salon dédié',
                    value:
                        '⏰ Session chaque jour à **15h00** *(5 manches chronométrées de 5 minutes)*\n' +
                        '-# ↳ Déchiffre l\'énigme visuelle et écris la réponse exacte dans le chat pour marquer les points.\n' +
                        '📊 Stats : **`!rebusstats [@membre]`** • 🏆 Classement : **`!rebustop`**'
                },
                {
                    name: '🪢 Le Pendu Quotidien • Salon dédié',
                    value:
                        '⏰ Session chaque soir à **21h00** *(mot de 7 lettres, 3 essais max par joueur)*\n' +
                        '-# ↳ Propose une lettre ou tente le mot complet directement dans le salon !\n' +
                        '📊 Stats : **`!pendustats [@membre]`** • 🏆 Classement : **`!pendutop`**'
                }
            );
    }

    // 3. PROFILS & VIE DU SERVEUR
    if (category === 'serveur') {
        return embed
            .setColor(0x3498db)
            .setTitle('👥 Profils & Vie du Serveur')
            .setDescription('Tout ce qui concerne ton activité, ton identité et la communauté de Regaïa.')
            .addFields(
                {
                    name: '👤 Fiches Membre & Activité',
                    value:
                        '**`!profil [@membre]`** — Carte complète : rang, niveau, succès et date d\'arrivée\n' +
                        '**`!avatar [@membre]`** — Affiche la photo de profil en haute définition\n' +
                        '**`!top`** — Classement historique des membres les plus bavards\n' +
                        '**`!actif`** — Podiums des plus actifs *(Aujourd\'hui, Cette semaine, Ce mois-ci)*'
                },
                {
                    name: '🎂 Anniversaires',
                    value:
                        '**`!anniv set JJ/MM`** — Enregistre ta date pour qu\'on te le fête avec alerte\n' +
                        '**`!anniv show [@membre]`** — Date d\'anniversaire et compte à rebours\n' +
                        '**`!anniv list`** / **`!anniv next`** — Liste complète et prochain anniversaire à fêter'
                },
                {
                    name: '🏛️ Vie de Regaïa',
                    value:
                        '📜 **`!quote [numéro / recherche]`** — Citations cultes archivées du serveur\n' +
                        '💡 **`!suggestion [idée]`** — Soumettre une proposition au vote communautaire\n' +
                        '🏠 **`!serveur`** — Statistiques complètes du serveur (membres, boosts, création)'
                }
            );
    }

    // 4. INTERACTIONS SOCIALES & RP
    if (category === 'social') {
        return embed
            .setColor(0xe91e63)
            .setTitle('🎭 Interactions Sociales & Actions RP')
            .setDescription('Des commandes animées pour interagir avec les membres et mettre de l\'ambiance !')
            .addFields(
                {
                    name: '💖 Affection & Rizz',
                    value:
                        '💋 **`!kiss [@membre]`** — Embrasse quelqu\'un tendrement\n' +
                        '🫂 **`!hug [@membre]`** — Fais un câlin réconfortant\n' +
                        '💃 **`!danse [@membre]`** — Danse avec un partenaire ou solo\n' +
                        '🗿 **`!rizz [@membre]`** — Tente ton approche avec ton plus gros charme\n' +
                        '💕 **`!lovecalc @user1 @user2`** — Calcule la compatibilité amoureuse avec carte générée'
                },
                {
                    name: '💥 Bagarre, Provoc & Drama',
                    value:
                        '👊 **`!punch [@membre]`** — Décoche une baffe sans pitié\n' +
                        '🔫 **`!bang [@membre]`** — Tire sur un membre\n' +
                        '🗯️ **`!insult [@membre]`** — Tacle gentiment (ou pas) quelqu\'un\n' +
                        '🔨 **`!ban [@membre]`** — Bannis symboliquement un membre\n' +
                        '😛 **`!bait [@membre]`** — Ragebait quelqu\'un en direct'
                },
                {
                    name: '😆 Humeurs & Réactions',
                    value:
                        '**`!rire`** • **`!cry`** • **`!die`** • **`!explode`** • **`!run`**\n' +
                        '**`!palaref`** • **`!jailaref`**'
                }
            );
    }

    // 5. ORACLES, DÉBATS & FUN
    if (category === 'fun') {
        return embed
            .setColor(0x9b59b6)
            .setTitle('🔮 Oracles, Débats & Fun')
            .setDescription('Jeux de hasard, prédictions absurdes et questions pour animer le salon.')
            .addFields(
                {
                    name: '🔮 Oracles & Mystères',
                    value:
                        '**`!horoscope`** — L\'horoscope cosmique quotidien selon ton signe astral\n' +
                        '**`!destin`** — Prédictions absurdes et loufoques sur ton avenir\n' +
                        '**`!animal`** — Découvre ton animal spirituel parmi 7000 combinaisons'
                },
                {
                    name: '⚖️ Débats & Gastronomie',
                    value:
                        '❓ **`!question`** — Question de débat du soir parmi 6 thématiques\n' +
                        '⚖️ **`!choix [option 1 ou option 2]`** — Cacabot tranche un dilemme cornélien\n' +
                        '👨‍🍳 **`!topchef [nom ou photo]`** — La note gastronomique sans filtre de Cacabot'
                },
                {
                    name: '🎲 Hasard & Mascottes',
                    value:
                        '🪙 **`!flip [mise]`** — Lance une pièce *(solo ou duel de pari face à un membre)*\n' +
                        '🤣 **`!blague`** — Raconte une blague aléatoire *(Soft, Classique, Humour Noir)*\n' +
                        '🐒 **`!sylvain`** • 👗 **`!epsys`** • 🎬 **`!bougetoi`**'
                }
            );
    }

    // 6. UTILITAIRES DU QUOTIDIEN
    if (category === 'util') {
        return embed
            .setColor(0x95a5a6)
            .setTitle('🛠️ Utilitaires & Quotidien')
            .setDescription('Des outils pratiques pour ton quotidien, tes sessions de travail et la gestion du bot.')
            .addFields(
                {
                    name: '⏰ Organisation & Focus',
                    value:
                        '**`!rappel [durée] [motif]`** — Programme un rappel personnel *(ex: `!rappel 20min four`)*\n' +
                        '-# ↳ Boutons interactifs sous le rappel pour reporter de **+10 min** ou **+1h** en un clic !\n' +
                        '🍅 **`!pomodoro [travail] [pause]`** — Minuteur Pomodoro *(ex: `!pomodoro 25 5`)*\n' +
                        '🌦️ **`!meteo [ville]`** — Bulletin météo, température et ressenti en direct'
                },
                {
                    name: '📺 Médias & Minecraft',
                    value:
                        '🔍 **`!youtube [recherche]`** — Recherche interactive YouTube avec lecteur intégré\n' +
                        '🎬 **`!last [chaîne]`** & 📈 **`!stats [chaîne]`** — Dernier upload et stats d\'une chaîne\n' +
                        '⛏️ **`!aternos`** — Statut et adresse IP du serveur Minecraft Regaïa'
                },
                {
                    name: '🤖 Vie de Cacabot',
                    value:
                        'ℹ️ **`!botinfo`** *(alias `!about`)* — Version, temps d\'activité (uptime) et mémoire\n' +
                        '🏓 **`!ping`** — Mesure de la latence API et WebSocket\n' +
                        '🤫 **`!stop`** / **`!unstop`** — Mettre en pause ou relancer les répliques automatiques'
                }
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