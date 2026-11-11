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

function buildHelpHomeEmbed(user) {
    const displayName = user?.displayName || user?.username || 'Membre';
    return new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('💩 Cacabot — Guide des commandes')
        .setDescription(
            `Salut **${displayName}** ! Je suis **Cacabot**, le bot officiel de **Regaïa**.\n` +
            `Toutes mes commandes fonctionnent avec le préfixe \`!\` ou en commande slash \`/\`.\n\n` +
            `Choisis une catégorie dans le menu ci-dessous pour découvrir les fonctionnalités 👇`
        )
        .addFields(
            {
                name: '🎮 Mini-Jeux Quotidiens',
                value: 'Le Motus (10h & 19h), le Rébus Regaïen (15h), le Pendu (21h), ainsi que leurs classements et statistiques.'
            },
            {
                name: '🎰 Roulette & Battle Pass',
                value: 'La Roulette Regaïenne toutes les 15 min (5 min en Happy Hour à 20h), inventaire de récompenses et 25 paliers du Battle Pass.'
            },
            {
                name: '👥 Vie du Serveur & Profils',
                value: 'Fiches membres, tops des plus bavards, gestion des anniversaires, citations mythiques et suggestions.'
            },
            {
                name: '🎭 Social, Fun & Oracles',
                value: 'Interactions sociales animées (bisous, baffes, rizz), prophéties loufoques, horoscope du jour, pile ou face et débats.'
            },
            {
                name: '🛠️ Utilitaires du Quotidien',
                value: 'Rappels avec boutons snooze (+10m, +1h), minuteur Pomodoro, météo en direct, lecteur YouTube et statut du serveur.'
            }
        )
        .setFooter({ text: `Regaïa • Demandé par ${displayName}` });
}

function buildHelpCategoryEmbed(category, user) {
    const displayName = user?.displayName || user?.username || 'Membre';
    const embed = new EmbedBuilder().setFooter({ text: `Regaïa • Demandé par ${displayName}` });

    if (category === 'minijeux') {
        return embed
            .setColor(0x2ecc71)
            .setTitle('🎮 Mini-Jeux Quotidiens')
            .setDescription('Rendez-vous à heures fixes pour faire travailler vos méninges et marquer des points !')
            .addFields(
                {
                    name: '🟩 Le Motus (10h00 & 19h00)',
                    value:
                        '`!motus [mot]` — Proposer un mot *(6 lettres à 10h, 7 lettres à 19h)*\n' +
                        '`!motustats [@membre]` — Taux de réussite et séries de victoires\n' +
                        '`!motustop` — Classement général des meilleurs joueurs'
                },
                {
                    name: '🧩 Le Rébus Regaïen (15h00)',
                    value:
                        '`!rebus [titre ou emojis]` — Proposer la solution *(5 manches de 5 min)*\n' +
                        '`!rebusstats` / `!rebustop` — Points individuels et podium de la semaine'
                },
                {
                    name: '🪢 Le Pendu (21h00)',
                    value:
                        '`!pendu [lettre ou mot]` — Proposer une lettre ou le mot *(3 essais max, mot de 7 lettres)*\n' +
                        '`!pendustats` / `!pendutop` — Statistiques personnelles et classement hebdomadaire'
                }
            );
    }

    if (category === 'roulette') {
        return embed
            .setColor(0xf1c40f)
            .setTitle('🎰 Roulette & Battle Pass')
            .setDescription('Tente ta chance au casino de Regaïa et fais progresser ton pass de combat mensuel.')
            .addFields(
                {
                    name: '🎲 La Roulette Regaïenne',
                    value:
                        '`!rlt` *(ou `!roulette`)* — Tente ta chance *(cooldown 15 min, réduit à 5 min en Happy Hour à 20h)*\n' +
                        '`!rlt claim` — Ouvre ton inventaire pour consommer boucliers, relances et récompenses\n' +
                        '`!rlt state` — Liste tes bonus, malus et transformations actives\n' +
                        '`!rlt stats [@membre]` — Bilan complet des tirages (gains, pertes, nuls)\n' +
                        '`!rlttop` — Le Panthéon des chasseurs de succès'
                },
                {
                    name: '🎫 Le Battle Pass Mensuel',
                    value:
                        '`!bp` *(ou `!pass`)* — Visualise tes quêtes quotidiennes/hebdos et réclame tes 25 paliers de récompenses'
                }
            );
    }

    if (category === 'serveur') {
        return embed
            .setColor(0x3498db)
            .setTitle('👥 Vie du Serveur & Profils')
            .setDescription('Tout ce qui concerne ton activité, les membres et la vie sur Regaïa.')
            .addFields(
                {
                    name: '📊 Profils & Activité',
                    value:
                        '`!profil [@membre]` — Fiche complète : rang, stats, succès et date d\'arrivée\n' +
                        '`!top` — Classement historique des membres les plus bavards\n' +
                        '`!actif` — Podium des plus actifs *(Aujourd\'hui, Cette semaine, Ce mois-ci)*\n' +
                        '`!avatar [@membre]` — Affiche la photo de profil en haute définition'
                },
                {
                    name: '🎂 Anniversaires',
                    value:
                        '`!anniv set [JJ/MM]` — Enregistre ta date d\'anniversaire\n' +
                        '`!anniv show [@membre]` — Date d\'anniversaire et compte à rebours\n' +
                        '`!anniv list` / `!anniv next` — Liste des anniversaires ou prochain à fêter'
                },
                {
                    name: '🏛️ Vie de Regaïa',
                    value:
                        '`!quote [numéro / recherche]` — Citation mythique archivée *(ou au hasard si vide)*\n' +
                        '`!suggestion [idée]` — Soumettre une idée au vote communautaire\n' +
                        '`!serveur` — Statistiques complètes du serveur (membres, boosts, création)'
                }
            );
    }

    if (category === 'fun') {
        return embed
            .setColor(0xe91e63)
            .setTitle('🎭 Social, Fun & Oracles')
            .setDescription('Pour animer le chat, titiller tes potes ou tester ton avenir.')
            .addFields(
                {
                    name: '👆 Interactions Sociales',
                    value:
                        '**Tendresse** : `!kiss`, `!hug`, `!danse`, `!rizz` [@membre]\n' +
                        '**Bagarre** : `!punch`, `!bang`, `!insult`, `!ban`, `!bait` [@membre]\n' +
                        '**Humeurs** : `!rire`, `!cry`, `!die`, `!explode`, `!run`, `!palaref`, `!jailaref`'
                },
                {
                    name: '🔮 Oracles & Hasard',
                    value:
                        '`!horoscope` — L\'horoscope cosmique quotidien de ton signe astrologique\n' +
                        '`!destin` — Prédictions loufoques sur ton avenir\n' +
                        '`!animal` — Découvre ton animal spirituel parmi des milliers de combinaisons\n' +
                        '`!flip [mise]` — Lance une pièce *(solo ou duel de pari face à un membre)*\n' +
                        '`!blague` — Blague aléatoire *(Soft, Classique, Humour Noir)*'
                },
                {
                    name: '⚖️ Débats & Gastronomie',
                    value:
                        '`!question` — Question de débat du soir parmi 6 thématiques\n' +
                        '`!choix [option 1 ou option 2]` — Laisse Cacabot trancher un dilemme cornélien\n' +
                        '`!topchef [nom ou photo]` — Critique gastronomique sans pitié de Cacabot\n' +
                        '`!lovecalc [@user1 @user2]` — Test d\'affinité amoureuse avec carte personnalisée'
                }
            );
    }

    if (category === 'util') {
        return embed
            .setColor(0x95a5a6)
            .setTitle('🛠️ Utilitaires & Pratique')
            .setDescription('Des outils pratiques pour ton quotidien et la gestion de tes sessions.')
            .addFields(
                {
                    name: '⏰ Organisation & Travail',
                    value:
                        '`!rappel [durée] [motif]` — Programme un rappel personnel *(ex: `!rappel 20min four`)* avec boutons snooze (+10m, +1h)\n' +
                        '`!pomodoro [travail] [pause]` — Lance une session de travail Pomodoro *(ex: `!pomodoro 25 5`)*\n' +
                        '`!meteo [ville]` — Météo, température et conditions en direct'
                },
                {
                    name: '📺 Médias & Minecraft',
                    value:
                        '`!youtube [recherche]` — Recherche interactive YouTube avec lecteur\n' +
                        '`!last [chaîne]` / `!stats [chaîne]` — Dernier upload et stats d\'une chaîne\n' +
                        '`!aternos` — Statut et adresse IP du serveur Minecraft Regaïa'
                },
                {
                    name: '🤖 Cacabot',
                    value:
                        '`!botinfo` *(ou `!about`)* — Version, temps d\'activité (uptime) et statistiques\n' +
                        '`!ping` — Mesure la latence API et WebSocket\n' +
                        '`!stop` / `!unstop` — Mettre en pause ou réactiver les répliques automatiques'
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
        const embed = buildHelpHomeEmbed(message.author);
        const menuRow = new ActionRowBuilder().addComponents(buildHelpMenu(message.author.id, 'home'));
        const btnRow = buildHelpButtons(message.author.id, 'home', message.id);
        return message.reply({ embeds: [embed], components: [menuRow, btnRow] });
    }
}

// =========================
//   INTERACTIONS (MENUS & BOUTONS & SLASH)
// =========================

async function runHelpInteraction(interaction) {
    // 1. Commande Slash /help
    if (interaction.isChatInputCommand && interaction.isChatInputCommand()) {
        const embed = buildHelpHomeEmbed(interaction.user);
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
        const embed = buildHelpCategoryEmbed(category, interaction.user);
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

        const embed = buildHelpHomeEmbed(interaction.user);
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