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
                { name: '📺 **!ytabo config**', value: 'Panneau interactif des abonnements et notifications YouTube.' },
                { name: '👋 **!welcome / !welcome test**', value: 'Configurer le salon d\'accueil ou tester l\'affiche Canvas.' },
                { name: '📣 **!say [ID Salon] [message]**', value: 'Envoyer un message dans un salon au nom de Cacabot.' },
                { name: '✏️ **!edit [ID_message] [texte]**', value: 'Modifier un message envoyé par Cacabot.' },
                { name: '🖼️ **!embed / !embed modify [ID]**', value: 'Créateur et modificateur interactif d\'embeds complets.' },
                { name: '🎭 **!rolereac / !rolebtn**', value: 'Gérer les rôles réactions et boutons de rôles.' },
                { name: '🤐 **!chut [temps] / !unchut**', value: 'Faire taire Cacabot temporairement sur un salon.' },
                { name: '💾 **!save / !lastsave**', value: 'Forcer une sauvegarde ou consulter l\'heure de la dernière sauvegarde.' }
            );
    }

    if (categorie === 'generateurs') {
        return embed.setTitle('🧪 Générateurs & Tests en solo')
            .addFields(
                { name: '🪢 **!pendutest**', value: 'Lancer une partie de test solo du Pendu (7 lettres) dans n\'importe quel salon secret.' },
                { name: '🟩 **!motustest [6/7]**', value: 'Lancer un Motus solo de test (6 lettres par défaut, ou 7 avec `!motustest 7`).' },
                { name: '🧩 **!rebustest**', value: 'Lancer une manche solo de test du Rébus Regaïen.' },
                { name: '🎂 **!anniversairetest**', value: 'Tester l\'alerte et le GIF d\'anniversaire.' },
                { name: '🟣 **!streamtest**', value: 'Tester l\'embed d\'alerte de live Twitch.' },
                { name: '🔮 **!horoscope [ID_salon]**', value: 'Forcer l\'envoi de l\'horoscope du jour dans un salon spécifique.' },
            );
    }

    if (categorie === 'autres') {
        return embed.setTitle('👥 Commandes pour les autres membres')
            .addFields(
                { name: '⏰ **!rappel [ID] Xmin/h [message]**', value: 'Programmer un rappel pour un membre précis par son ID.' },
                { name: '📝 **!setmessages @Membre [nombre]**', value: 'Définir manuellement le compteur de messages d\'un membre.' },
                { name: '🎮 **!jeupts [@membre]**', value: 'Panneau interactif complet pour modifier les points/victoires de Motus, Rébus et Pendu.' }
            );
    }

    if (categorie === 'roulette') {
        return embed.setColor(0xffd20a).setTitle('🎰 Commandes Roulette (Epsys-Only)')
            .addFields(
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
                { name: '🔍 **!bp embedtest**', value: 'Prévisualiser l\'embed d\'onboarding que voient les nouveaux membres.' }
            );
    }

    return embed.setTitle('❓ Inconnu').setDescription('Catégorie introuvable.');
}

// =========================
//   DÉTECTION DES COMMANDES
// =========================

function getHelpResponse(command) {
    if (command === "!help" || command === "!aide") {
        return {
            data: new EmbedBuilder()
                .setColor(0x00ffff)
                .setTitle("💩 GUIDE D'AIDE DE CACABOT")
                .setDescription(
                    "Hey ! Voici Cacabot, le bot à tout faire de Regaïa !\n\n" +
                    "Choisis une catégorie dans le menu ci-dessous pour découvrir toutes les commandes disponibles 👇"
                )
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
    // !helpx
    if (response?.needsHelpx) {
        if (message.author.id !== '436218312574107658') {
            return message.reply("Tu n'es pas autorisé(e) à faire cette commande.");
        }
        const embed = buildHelpxPresentationEmbed();
        const row = new ActionRowBuilder().addComponents(buildHelpxMenu(message.author.id));
        return message.reply({ embeds: [embed], components: [row] });
    }

    // !help
    if (response?.data) {
        const menu = new StringSelectMenuBuilder()
            .setCustomId(`help_menu_${message.author.id}_${message.id}`)
            .setPlaceholder('Choisis une catégorie...')
            .addOptions(
                { label: '🎉 Fun & Mini-jeux', description: 'Pendu, Motus, Rébus, Roulette, Battle Pass...', emoji: '🎉', value: 'fun' },
                { label: '🛠️ Utilitaires & Serveur', description: 'Discord, Profil, Top, YouTube, Météo...', emoji: '🛠️', value: 'util' },
            );

        const row = new ActionRowBuilder().addComponents(menu);
        return message.reply({ embeds: [response.data], components: [row] });
    }
}

// =========================
//   MENUS ET BOUTONS
// =========================

async function runHelpInteraction(interaction) {
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('helpx_menu_')) {
        const authorId = interaction.customId.split('_')[2];
        if (interaction.user.id !== authorId) {
            return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true });
        }
        const embed = buildHelpxCategorieEmbed(interaction.values[0]);
        const row = new ActionRowBuilder().addComponents(buildHelpxMenu(authorId));
        return interaction.update({ embeds: [embed], components: [row] });
    }

    // MENU SELECT FUN
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('help_fun_')) {
        const funParts = interaction.customId.split('_');
        const helpAuthorId = funParts[2];
        const helpMessageId = funParts[3] ?? null;
        if (interaction.user.id !== helpAuthorId) {
            return interaction.reply({ content: "Ce menu ne t'est pas destiné !", ephemeral: true });
        }

        const value = interaction.values[0];
        let embed;

        if (value === 'minijeux') {
            embed = new EmbedBuilder()
                .setColor(0x9b59b6)
                .setDescription("# 🎮 Mini-Jeux & Pass de Combat")
                .addFields(
                    { name: "🪢 !pendu / !pendustats / !pendutop", value: "Le Pendu Quotidien à **21h00** (7 lettres, 3 essais), stats et classement hebdo !" },
                    { name: "🟩 !motus / !motustats", value: "Le Motus Quotidien à **10h00** (6 lettres) et **19h00** (7 lettres) !" },
                    { name: "🧩 !rebus / !rebusstats", value: "Le Rébus Regaïen à **15h00** (5 manches de 5 minutes) !" },
                    { name: "🎫 !pass / !bp", value: "Le Battle Pass mensuel de Regaïa : quêtes quotidiennes, hebdos et 25 paliers de récompenses !" },
                    { name: "🎰 !roulette / !rlt [go/claim/state/stats]", value: "La Roulette Regaïenne : tente ta chance toutes les 15 min (5 min en Happy Hour à 20h) !" },
                    { name: "🏆 !rlttop", value: "Le Panthéon des chasseurs de succès de la roulette !" }
                );
        }

        if (value === 'interact') {
            embed = new EmbedBuilder()
                .setColor(0xffdc5d)
                .setDescription("# 👆 Interactions Sociales")
                .addFields(
                    { name: "💋 !kiss / !bisou", value: "Embrasse quelqu'un sur le serveur !" },
                    { name: "🫂 !hug / !calin", value: "Fais un câlin chaleureux !" },
                    { name: "💃 !danse / !dance", value: "Danse solo ou avec un partenaire !" },
                    { name: "🗯️ !insult", value: "Insulte gentiment (ou pas) un membre !" },
                    { name: "👊 !punch / !frappe", value: "Frappe un membre !" },
                    { name: "🔫 !bang / !tir / !pan", value: "Tire sur un membre !" },
                    { name: "🗿 !rizz", value: "Tente de séduire avec ton meilleur rizz !" },
                    { name: "🏃 !run / !court", value: "Prends la fuite !" },
                    { name: "😆 !rire", value: "Ris de bon cœur !" },
                    { name: "😭 !cry / !pleure", value: "Pleure un bon coup..." },
                    { name: "☠️ !die", value: "Meurs en direct." },
                    { name: "🔨 !ban", value: "Bannis symboliquement quelqu'un !" },
                    { name: "😛 !bait", value: "Ragebait quelqu'un !" },
                    { name: "💥 !explode", value: "Explose sans raison." },
                    { name: "😐 !palaref / 😎 !jailaref", value: "Avoue que t'as pas la ref... ou affirme le contraire !" }
                );
        }

        if (value === 'discussion') {
            embed = new EmbedBuilder()
                .setColor(0x6bb5ff)
                .setDescription("# 💬 Discussion & Dilemmes")
                .addFields(
                    { name: "❓ !question", value: "Pose une question de débat du soir parmi 6 catégories !" },
                    { name: "⚖️ !choix [option 1 ou option 2]", value: "Laisse Cacabot trancher un dilemme cornélien !" },
                    { name: "👨‍🍳 !topchef", value: "Le verdict et la note gastronomique sans pitié de Cacabot sur un plat !" },
                    { name: "💕 !lovecalc [@user1 @user2]", value: "Calcule le pourcentage d'amour et génère une carte personnalisée !" }
                );
        }

        if (value === 'random') {
            embed = new EmbedBuilder()
                .setColor(0xf5f8fa)
                .setDescription("# 🔮 Hasard & Fun")
                .addFields(
                    { name: "🔮 !horoscope", value: "L'horoscope cosmique quotidien de tous les signes !" },
                    { name: "🧠 !destin", value: "Prédictions loufoques sur ton avenir." },
                    { name: "🐕 !animal", value: "Découvre ton animal spirituel parmi 7000 combinaisons !" },
                    { name: "🪙 !flip", value: "Lance une pièce à pile ou face (solo ou duel de pari) !" },
                    { name: "🤣 !blague", value: "Raconte une blague (Soft, Classique, Humour Noir) !" },
                    { name: "🎬 !bougetoi", value: "Rappelle à Epsys d'aller monter sa vidéo !" },
                    { name: "🐒 !sylvain", value: "Singe fort ensemble (Sylvain Lévy) !" },
                    { name: "👗 !epsys", value: "GIF aléatoire d'Epsys !" }
                );
        }

        if (value === 'anniversaire') {
            embed = new EmbedBuilder()
                .setColor(0xff69b4)
                .setDescription("# 🎂 Anniversaires")
                .addFields(
                    { name: "📅 !anniversaire set JJ/MM", value: "Enregistre ton anniversaire." },
                    { name: "👀 !anniversaire show [@membre]", value: "Affiche un anniversaire et le compte à rebours." },
                    { name: "📋 !anniversaire list", value: "Liste tous les anniversaires (classique ou chronologique)." },
                    { name: "🎉 !anniversaire next", value: "Affiche le prochain anniversaire à fêter !" },
                    { name: "🗑️ !anniversaire remove", value: "Supprime ton anniversaire." }
                );
        }

        const backButton = new ButtonBuilder()
            .setCustomId(`help_fun_back_${helpAuthorId}_${helpMessageId ?? ''}`)
            .setLabel('⬅️ Retour')
            .setStyle(ButtonStyle.Secondary);
        const deleteButton = new ButtonBuilder()
            .setCustomId(`help_delete_${helpAuthorId}_${helpMessageId ?? ''}`)
            .setLabel('❌ Supprimer')
            .setStyle(ButtonStyle.Secondary);
        const backRow = new ActionRowBuilder().addComponents(backButton, deleteButton);
        return interaction.update({ embeds: [embed], components: [backRow] });
    }

    // BOUTON RETOUR FUN
    if (interaction.isButton() && interaction.customId.startsWith('help_fun_back_')) {
        const funBackParts = interaction.customId.split('_');
        const helpAuthorId = funBackParts[3];
        const helpMessageId = funBackParts[4] ?? null;
        if (interaction.user.id !== helpAuthorId) {
            return interaction.reply({ content: "Ce menu ne t'est pas destiné !", ephemeral: true });
        }

        const funEmbed = new EmbedBuilder()
            .setColor(0xffcc00)
            .setDescription(
                "# 🎉 Fun & Divertissement\n" +
                "*Toutes les commandes pour animer le serveur et jouer ensemble.*\n\n" +
                "🎮 **Mini-Jeux & Pass** — Pendu, Motus, Rébus, Roulette, Battle Pass\n" +
                "👆 **Interact** — Interagis avec les membres\n" +
                "💬 **Discussion** — Débats, dilemmes, lovecalc et cuisine\n" +
                "🎂 **Anniversaire** — Gestion des anniversaires de Regaïa\n" +
                "🔮 **Hasard & Fun** — Horoscope, destin, animal spirituel, blagues..."
            );

        const funMenu = new StringSelectMenuBuilder()
            .setCustomId(`help_fun_${helpAuthorId}`)
            .setPlaceholder('Choisis une sous-catégorie...')
            .addOptions(
                { label: '🎮 Mini-Jeux & Pass', description: 'pendu, motus, rebus, roulette, pass', value: 'minijeux' },
                { label: '👆 Interactions', description: 'kiss, hug, insult, die, punch, bang, rizz...', value: 'interact' },
                { label: '💬 Discussion', description: 'question, choix, topchef, lovecalc', value: 'discussion' },
                { label: '🎂 Anniversaires', description: 'set, show, list, next, remove', value: 'anniversaire' },
                { label: '🔮 Hasard & Fun', description: 'horoscope, destin, animal, blague...', value: 'random' }
            );

        const funBackButton = new ButtonBuilder()
            .setCustomId(`help_back_${helpAuthorId}_${helpMessageId ?? ''}`)
            .setLabel('⬅️ Retour Accueil')
            .setStyle(ButtonStyle.Secondary);
        const funDeleteButton = new ButtonBuilder()
            .setCustomId(`help_delete_${helpAuthorId}_${helpMessageId ?? ''}`)
            .setLabel('❌ Supprimer')
            .setStyle(ButtonStyle.Secondary);
        const funRow = new ActionRowBuilder().addComponents(funMenu);
        const funBackRow = new ActionRowBuilder().addComponents(funBackButton, funDeleteButton);
        return interaction.update({ embeds: [funEmbed], components: [funRow, funBackRow] });
    }

    // MENU SELECT UTIL
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('help_util_')) {
        const helpAuthorId = interaction.customId.split('_')[2];
        const helpMessageId = interaction.customId.split('_')[3] ?? null;
        if (interaction.user.id !== helpAuthorId) {
            return interaction.reply({ content: "Ce menu ne t'est pas destiné !", ephemeral: true });
        }

        const value = interaction.values[0];
        let embed;

        if (value === 'discord') {
            embed = new EmbedBuilder()
                .setColor(0xbdddf4)
                .setDescription("# 💬 Vie du Serveur & Activité")
                .addFields(
                    { name: "👤 !profil [@membre]", value: "Affiche le profil complet, messages, stats et succès débloqués !" },
                    { name: "🖼️ !avatar [@membre]", value: "Affiche l'avatar d'un membre en haute résolution." },
                    { name: "🏆 !top", value: "Classement général des membres les plus bavards." },
                    { name: "📊 !actif", value: "Podium des plus actifs du jour, de la semaine et du mois !" },
                    { name: "📜 !quote [numéro/recherche]", value: "Affiche une citation mythique archivée du serveur." },
                    { name: "💡 !suggestion [idée]", value: "Soumettre une proposition au vote dans #suggestions !" },
                    { name: "🏠 !serveur", value: "Informations complètes sur Regaïa (création, membres, boost...)." }
                );
        }

        if (value === 'youtube') {
            embed = new EmbedBuilder()
                .setColor(0xff0000)
                .setDescription("# 📺 YouTube")
                .addFields(
                    { name: "🔍 !youtube [recherche]", value: "Recherche de vidéos avec lecteur interactif." },
                    { name: "🎬 !last [chaîne]", value: "Affiche la dernière vidéo publiée d'une chaîne." },
                    { name: "📈 !stats [chaîne]", value: "Statistiques complètes d'une chaîne YouTube." }
                );
        }

        if (value === 'autres') {
            embed = new EmbedBuilder()
                .setColor(0x95a5a6)
                .setDescription("# 📝 Utilitaires du quotidien")
                .addFields(
                    { name: "⏰ !rappel [temps] [message]", value: "Programmer un rappel (ex : `!rappel 15min gâteau au four`)." },
                    { name: "🍅 !pomodoro", value: "Configurer et lancer une session de concentration Pomodoro." },
                    { name: "🌦️ !météo [ville]", value: "Météo et température en direct d'une ville." },
                    { name: "⛏️ !aternos", value: "Obtenir l'adresse IP du serveur Minecraft de Regaïa." },
                    { name: "🧹 !prune [nombre]", value: "Supprimer rapidement les derniers messages (permission requise)." }
                );
        }

        if (value === 'cacabot') {
            embed = new EmbedBuilder()
                .setColor(0x5865f2)
                .setDescription("# 🤖 Cacabot")
                .addFields(
                    { name: "ℹ️ !botinfo / !about", value: "Informations techniques, version et uptime du bot." },
                    { name: "🏓 !ping", value: "Affiche la latence de réponse et du WebSocket Discord." },
                    { name: "🤫 !stop / !unstop", value: "Faire taire temporairement les répliques réflexes de Cacabot." }
                );
        }

        const backButton = new ButtonBuilder()
            .setCustomId(`help_back_util_${helpAuthorId}`)
            .setLabel('⬅️ Retour')
            .setStyle(ButtonStyle.Secondary);
        const deleteButton = new ButtonBuilder()
            .setCustomId(`help_delete_${helpAuthorId}_${helpMessageId ?? ''}`)
            .setLabel('❌ Supprimer')
            .setStyle(ButtonStyle.Secondary);
        const backRow = new ActionRowBuilder().addComponents(backButton, deleteButton);
        return interaction.update({ embeds: [embed], components: [backRow] });
    }

    // BOUTON RETOUR UTIL
    if (interaction.isButton() && interaction.customId.startsWith('help_back_util_')) {
        const helpAuthorId = interaction.customId.replace('help_back_util_', '');
        if (interaction.user.id !== helpAuthorId) {
            return interaction.reply({ content: "Ce menu ne t'est pas destiné !", ephemeral: true });
        }

        const utilEmbed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle("🛠️ Utilitaires")
            .setDescription(
                "💬 **Vie du Serveur** — Profils, classements, citations, suggestions...\n" +
                "📺 **YouTube** — Recherches et statistiques de chaînes\n" +
                "🤖 **Cacabot** — Informations, ping et gestion du bot\n" +
                "📝 **Quotidien** — Rappels, météo, pomodoro, aternos..."
            );

        const utilMenu = new StringSelectMenuBuilder()
            .setCustomId(`help_util_${helpAuthorId}`)
            .setPlaceholder('Choisis une sous-catégorie...')
            .addOptions(
                { label: '💬 Vie du Serveur', description: 'profil, top, actif, quote, suggestion, serveur', value: 'discord' },
                { label: '📺 YouTube', description: 'youtube, stats, last', value: 'youtube' },
                { label: '🤖 Cacabot', description: 'botinfo, ping, stop', value: 'cacabot' },
                { label: '📝 Quotidien', description: 'rappel, météo, pomodoro, aternos, prune', value: 'autres' }
            );

        const utilBackButton = new ButtonBuilder()
            .setCustomId(`help_back_${helpAuthorId}`)
            .setLabel('⬅️ Retour Accueil')
            .setStyle(ButtonStyle.Secondary);
        const utilDeleteButton = new ButtonBuilder()
            .setCustomId(`help_delete_${helpAuthorId}_`)
            .setLabel('❌ Supprimer')
            .setStyle(ButtonStyle.Secondary);
        const utilRow = new ActionRowBuilder().addComponents(utilMenu);
        const utilBackRow = new ActionRowBuilder().addComponents(utilBackButton, utilDeleteButton);
        return interaction.update({ embeds: [utilEmbed], components: [utilRow, utilBackRow] });
    }

    // MENU SELECT ACCUEIL (!help)
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('help_menu_')) {
        const parts = interaction.customId.split('_');
        const helpAuthorId = parts[2];
        const helpMessageId = parts[3] ?? null;
        if (interaction.user.id !== helpAuthorId) {
            return interaction.reply({ content: "Ce menu ne t'est pas destiné !", ephemeral: true });
        }

        const value = interaction.values[0];

        if (value === 'fun') {
            const funEmbed = new EmbedBuilder()
                .setColor(0xffcc00)
                .setDescription(
                    "# 🎉 Fun & Divertissement\n" +
                    "*Toutes les commandes pour animer le serveur et jouer ensemble.*\n\n" +
                    "🎮 **Mini-Jeux & Pass** — Pendu, Motus, Rébus, Roulette, Battle Pass\n" +
                    "👆 **Interact** — Interagis avec les membres\n" +
                    "💬 **Discussion** — Débats, dilemmes, lovecalc et cuisine\n" +
                    "🎂 **Anniversaire** — Gestion des anniversaires de Regaïa\n" +
                    "🔮 **Hasard & Fun** — Horoscope, destin, animal spirituel, blagues..."
                );

            const funMenu = new StringSelectMenuBuilder()
                .setCustomId(`help_fun_${helpAuthorId}`)
                .setPlaceholder('Choisis une sous-catégorie...')
                .addOptions(
                    { label: '🎮 Mini-Jeux & Pass', description: 'pendu, motus, rebus, roulette, pass', value: 'minijeux' },
                    { label: '👆 Interactions', description: 'kiss, hug, insult, die, punch, bang, rizz...', value: 'interact' },
                    { label: '💬 Discussion', description: 'question, choix, topchef, lovecalc', value: 'discussion' },
                    { label: '🎂 Anniversaires', description: 'set, show, list, next, remove', value: 'anniversaire' },
                    { label: '🔮 Hasard & Fun', description: 'horoscope, destin, animal, blague...', value: 'random' }
                );

            const funBackButton = new ButtonBuilder()
                .setCustomId(`help_back_${helpAuthorId}_${helpMessageId ?? ''}`)
                .setLabel('⬅️ Retour Accueil')
                .setStyle(ButtonStyle.Secondary);
            const funDeleteButton = new ButtonBuilder()
                .setCustomId(`help_delete_${helpAuthorId}_${helpMessageId ?? ''}`)
                .setLabel('❌ Supprimer')
                .setStyle(ButtonStyle.Secondary);
            const funRow = new ActionRowBuilder().addComponents(funMenu);
            const funBackRow = new ActionRowBuilder().addComponents(funBackButton, funDeleteButton);
            return interaction.update({ embeds: [funEmbed], components: [funRow, funBackRow] });
        }

        if (value === 'util') {
            const utilEmbed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle("🛠️ Utilitaires")
                .setDescription(
                    "💬 **Vie du Serveur** — Profils, classements, citations, suggestions...\n" +
                    "📺 **YouTube** — Recherches et statistiques de chaînes\n" +
                    "🤖 **Cacabot** — Informations, ping et gestion du bot\n" +
                    "📝 **Quotidien** — Rappels, météo, pomodoro, aternos..."
                );

            const utilMenu = new StringSelectMenuBuilder()
                .setCustomId(`help_util_${helpAuthorId}`)
                .setPlaceholder('Choisis une sous-catégorie...')
                .addOptions(
                    { label: '💬 Vie du Serveur', description: 'profil, top, actif, quote, suggestion, serveur', value: 'discord' },
                    { label: '📺 YouTube', description: 'youtube, stats, last', value: 'youtube' },
                    { label: '🤖 Cacabot', description: 'botinfo, ping, stop', value: 'cacabot' },
                    { label: '📝 Quotidien', description: 'rappel, météo, pomodoro, aternos, prune', value: 'autres' }
                );

            const utilBackButton = new ButtonBuilder()
                .setCustomId(`help_back_${helpAuthorId}`)
                .setLabel('⬅️ Retour Accueil')
                .setStyle(ButtonStyle.Secondary);
            const utilDeleteButton = new ButtonBuilder()
                .setCustomId(`help_delete_${helpAuthorId}_`)
                .setLabel('❌ Supprimer')
                .setStyle(ButtonStyle.Secondary);
            const utilRow = new ActionRowBuilder().addComponents(utilMenu);
            const utilBackRow = new ActionRowBuilder().addComponents(utilBackButton, utilDeleteButton);
            return interaction.update({ embeds: [utilEmbed], components: [utilRow, utilBackRow] });
        }
    }

    // BOUTON SUPPRIMER
    if (interaction.isButton() && interaction.customId.startsWith('help_delete_')) {
        const delParts = interaction.customId.split('_');
        const helpAuthorId = delParts[2];
        const helpMessageId = delParts[3] ?? null;
        if (interaction.user.id !== helpAuthorId) {
            return interaction.reply({ content: "Tu ne peux pas supprimer ce message !", ephemeral: true });
        }
        await interaction.message.delete().catch(() => {});
        if (helpMessageId && helpMessageId !== '') {
            const originalMsg = await interaction.channel.messages.fetch(helpMessageId).catch(() => null);
            if (originalMsg) await originalMsg.delete().catch(() => {});
        }
        return;
    }

    // BOUTON RETOUR ACCUEIL
    if (interaction.isButton() && interaction.customId.startsWith('help_back_')) {
        const backParts = interaction.customId.split('_');
        const helpAuthorId = backParts[2];
        const helpMessageId = backParts[3] ?? null;
        if (interaction.user.id !== helpAuthorId) {
            return interaction.reply({ content: "Ce menu ne t'est pas destiné !", ephemeral: true });
        }
        const embed = new EmbedBuilder()
            .setColor(0x00ffff)
            .setTitle("💩 GUIDE D'AIDE DE CACABOT")
            .setDescription(
                "Hey ! Voici Cacabot, le bot à tout faire de Regaïa !\n\n" +
                "Choisis une catégorie dans le menu ci-dessous pour découvrir toutes les commandes disponibles 👇"
            );

        const menu = new StringSelectMenuBuilder()
            .setCustomId(`help_menu_${helpAuthorId}_${helpMessageId ?? ''}`)
            .setPlaceholder('Choisis une catégorie...')
            .addOptions(
                { label: '🎉 Fun & Mini-jeux', description: 'Pendu, Motus, Rébus, Roulette, Battle Pass...', emoji: '🎉', value: 'fun' },
                { label: '🛠️ Utilitaires & Serveur', description: 'Discord, Profil, Top, YouTube, Météo...', emoji: '🛠️', value: 'util' }
            );
        const row = new ActionRowBuilder().addComponents(menu);
        return interaction.update({ embeds: [embed], components: [row] });
    }
}

// =========================
//   POINTS D'ENTRÉE EXPORTÉS
// =========================

async function handleHelpMessage(message, response) {
    if (!response?.needsHelpx && !response?.data) return false;
    await runHelpMessage(message, response);
    return true;
}

async function handleHelpInteraction(interaction) {
    if (!interaction.isButton() && !interaction.isStringSelectMenu()) return false;
    if (!/^helpx?_/.test(interaction.customId)) return false;
    await runHelpInteraction(interaction);
    return true;
}

module.exports = { getHelpResponse, handleHelpMessage, handleHelpInteraction };