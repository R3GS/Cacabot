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
    const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('💩 Cacabot — Guide des commandes')
        .setDescription(
            `> *Bienvenue sur le guide de **Cacabot**, le bot compagnon de **Regaïa** !*\n` +
            `> *Toutes les commandes fonctionnent avec le préfixe \`!\` ou en slash \`/\`.*\n\n` +
            `### 🧭 Que souhaites-tu faire ?\n` +
            `Sélectionne une thématique dans le **menu déroulant ci-dessous** pour afficher ses commandes et astuces 👇\n\n` +
            `-# 💡 Tu peux naviguer librement d'une page à l'autre ou fermer ce guide avec 🗑️.`
        )
        .setFooter({ text: `Regaïa • Demandé par ${displayName}` });

    if (botAvatarUrl) embed.setThumbnail(botAvatarUrl);
    return embed;
}

function buildHelpCategoryEmbed(category, user, botAvatarUrl = null) {
    const displayName = user?.displayName || user?.username || 'Membre';
    const embed = new EmbedBuilder().setFooter({ text: `Regaïa • Demandé par ${displayName}` });
    if (botAvatarUrl) embed.setThumbnail(botAvatarUrl);

    if (category === 'minijeux') {
        return embed
            .setColor(0x2ecc71)
            .setTitle('🎮 Mini-Jeux Quotidiens')
            .setDescription('> *Des rendez-vous à heures fixes chaque jour sur Regaïa pour faire travailler tes méninges !*')
            .addFields(
                {
                    name: '🟩 Le Motus • 10h00 & 19h00',
                    value:
                        '> **`!motus [mot]`**\n' +
                        '-# ↳ 6 lettres à 10h, 7 lettres à 19h. Propose ton mot dans le salon de jeu !\n' +
                        '📊 Stats : `!motustats` • 🏆 Podium : `!motustop`'
                },
                {
                    name: '🧩 Le Rébus Regaïen • 15h00',
                    value:
                        '> **`!rebus [réponse]`**\n' +
                        '-# ↳ 5 manches chronométrées de 5 minutes avec énigmes visuelles.\n' +
                        '📊 Stats : `!rebusstats` • 🏆 Podium : `!rebustop`'
                },
                {
                    name: '🪢 Le Pendu Quotidien • 21h00',
                    value:
                        '> **`!pendu [lettre ou mot]`**\n' +
                        '-# ↳ 3 essais max par joueur pour deviner le mot secret de 7 lettres.\n' +
                        '📊 Stats : `!pendustats` • 🏆 Podium : `!pendutop`'
                }
            );
    }

    if (category === 'roulette') {
        return embed
            .setColor(0xf1c40f)
            .setTitle('🎰 Roulette & Battle Pass')
            .setDescription('> *Tente ta chance au casino de Regaïa et fais monter ton pass de combat mensuel !*')
            .addFields(
                {
                    name: '🎲 La Roulette Regaïenne',
                    value:
                        '> **`!rlt`** *(alias: `!roulette`)*\n' +
                        '-# ⏱️ Cooldown : 15 min • Réduit à **5 min en Happy Hour (20h)** !\n' +
                        '🎒 **`!rlt claim`** — Inventaire (boucliers, relances & récompenses)\n' +
                        '✨ **`!rlt state`** — Consulter tes bonus, malus et transformations actives\n' +
                        '📊 **`!rlt stats [@membre]`** & 🏆 **`!rlttop`** — Bilan et Panthéon des succès'
                },
                {
                    name: '🎫 Le Battle Pass Mensuel',
                    value:
                        '> **`!bp`** *(alias: `!pass`)*\n' +
                        '-# ↳ Quêtes quotidiennes & hebdomadaires, 25 paliers de récompenses à débloquer.\n' +
                        '🎁 Bouton **Tout récupérer** disponible directement sous le pass pour claim tes paliers d\'un coup !'
                }
            );
    }

    if (category === 'serveur') {
        return embed
            .setColor(0x3498db)
            .setTitle('👥 Vie du Serveur & Profils')
            .setDescription('> *Tout ce qui concerne ton activité, les membres et la vie sur Regaïa.*')
            .addFields(
                {
                    name: '👤 Profils & Activité',
                    value:
                        '> **`!profil`** `[@membre]`\n' +
                        '-# ↳ Rang d\'activité, succès débloqués, statistiques et date d\'arrivée.\n' +
                        '🖼️ **`!avatar`** `[@membre]` — Affiche la photo de profil en haute définition\n' +
                        '🏆 **`!top`** — Classement historique des membres les plus bavards\n' +
                        '⚡ **`!actif`** — Podiums des plus actifs *(Aujourd\'hui, Semaine, Mois)*'
                },
                {
                    name: '🎂 Les Anniversaires',
                    value:
                        '> **`!anniv set`** `[JJ/MM]` — Enregistre ta date pour qu\'on te le fête\n' +
                        '-# ↳ `!anniv show [@membre]` • `!anniv list` • `!anniv next`'
                },
                {
                    name: '🏛️ Regaïa & Communauté',
                    value:
                        '📜 **`!quote`** `[numéro / recherche]` — Citation mythique archivée *(ou aléatoire)*\n' +
                        '💡 **`!suggestion`** `[idée]` — Soumettre une proposition au vote communautaire\n' +
                        '🏠 **`!serveur`** — Statistiques complètes (membres, boosts, date de création)'
                }
            );
    }

    if (category === 'fun') {
        return embed
            .setColor(0xe91e63)
            .setTitle('🎭 Social, Fun & Oracles')
            .setDescription('> *Pour animer le chat, titiller tes potes ou tester ton avenir.*')
            .addFields(
                {
                    name: '💖 Affection & Rire',
                    value:
                        '💋 **`!kiss`** `[@membre]`\n' +
                        '🫂 **`!hug`** `[@membre]`\n' +
                        '💃 **`!danse`** `[@membre]`\n' +
                        '🗿 **`!rizz`** `[@membre]`\n' +
                        '😆 **`!rire`** • 😭 **`!cry`**',
                    inline: true
                },
                {
                    name: '💥 Bagarre & Drama',
                    value:
                        '👊 **`!punch`** `[@membre]`\n' +
                        '🔫 **`!bang`** `[@membre]`\n' +
                        '🗯️ **`!insult`** `[@membre]`\n' +
                        '🔨 **`!ban`** `[@membre]`\n' +
                        '😛 **`!bait`** `[@membre]`',
                    inline: true
                },
                {
                    name: '🔮 Oracles & Hasard',
                    value:
                        '> **`!horoscope`** — L\'horoscope cosmique quotidien de ton signe astral\n' +
                        '> **`!destin`** — Prédictions absurdes et loufoques sur ton avenir\n' +
                        '> **`!animal`** — Découvre ton animal spirituel parmi des milliers de combinaisons\n' +
                        '🪙 **`!flip [mise]`** — Pile ou face *(solo ou duel de pari face à un membre)*\n' +
                        '🤣 **`!blague`** — Raconte une blague aléatoire *(Soft, Classique, Humour Noir)*',
                    inline: false
                },
                {
                    name: '⚖️ Débats & Gastronomie',
                    value:
                        '❓ **`!question`** — Question de débat du soir parmi 6 thématiques\n' +
                        '⚖️ **`!choix [option 1 ou 2]`** — Cacabot tranche un dilemme cornélien\n' +
                        '👨‍🍳 **`!topchef [nom/photo]`** — Note gastronomique sans pitié de Cacabot\n' +
                        '💕 **`!lovecalc [@user1 @user2]`** — Test de compatibilité amoureuse',
                    inline: false
                }
            );
    }

    if (category === 'util') {
        return embed
            .setColor(0x95a5a6)
            .setTitle('🛠️ Utilitaires & Pratique')
            .setDescription('> *Des outils pratiques pour ton quotidien et la gestion de tes sessions.*')
            .addFields(
                {
                    name: '⏰ Organisation & Concentration',
                    value:
                        '> **`!rappel [durée] [motif]`**\n' +
                        '-# ↳ Boutons sous le rappel pour reporter de **+10 min** ou **+1h** en un clic !\n' +
                        '🍅 **`!pomodoro [travail] [pause]`** — Minuteur Pomodoro *(ex: `!pomodoro 25 5`)*\n' +
                        '🌦️ **`!meteo [ville]`** — Bulletin météo, température et ressenti en direct'
                },
                {
                    name: '📺 Médias & Minecraft',
                    value:
                        '🔍 **`!youtube [recherche]`** — Recherche interactive YouTube avec lecteur intégré\n' +
                        '🎬 **`!last [chaîne]`** & 📈 **`!stats [chaîne]`** — Dernier upload et stats YouTube\n' +
                        '⛏️ **`!aternos`** — Statut et adresse IP du serveur Minecraft Regaïa'
                },
                {
                    name: '🤖 Vie de Cacabot',
                    value:
                        'ℹ️ **`!botinfo`** *(alias `!about`)* — Version, temps d\'activité (uptime) et mémoire\n' +
                        '🏓 **`!ping`** — Mesure de la latence API et WebSocket\n' +
                        '🤫 **`!stop`** / **`!unstop`** — Mettre en pause ou réactiver les répliques automatiques'
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
        .setPlaceholder('Choisis une catégorie...')
        .addOptions(
            {
                label: 'Mini-Jeux Quotidiens',
                description: 'Motus, Rébus, Pendu, classements et stats',
                emoji: '🎮',
                value: 'minijeux',
                default: currentCategory === 'minijeux'
            },
            {
                label: 'Roulette & Battle Pass',
                description: 'Tirages, inventaire, quêtes et 25 paliers',
                emoji: '🎰',
                value: 'roulette',
                default: currentCategory === 'roulette'
            },
            {
                label: 'Vie du Serveur & Profils',
                description: 'Fiches membres, tops, anniversaires, citations',
                emoji: '👥',
                value: 'serveur',
                default: currentCategory === 'serveur'
            },
            {
                label: 'Social, Fun & Oracles',
                description: 'Interactions, horoscope, destin, pile ou face',
                emoji: '🎭',
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