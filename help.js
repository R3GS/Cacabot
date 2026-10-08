// =========================
//   AIDE : !help et !helpx
// =========================

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
            { label: 'Cacabot', emoji: '🤖', value: 'cacabot' },
            { label: 'Générateurs', emoji: '🔮', value: 'generateurs' },
            { label: 'Pour les autres', emoji: '👥', value: 'autres' },
            { label: 'Roulette', emoji: '🎰', value: 'roulette' }
        );
}

function buildHelpxCategorieEmbed(categorie) {
    const embed = new EmbedBuilder().setColor(0x5865f2);
    if (categorie === 'cacabot') {
        return embed.setTitle('🤖 Commandes liées à Cacabot')
            .addFields(
                { name: '🩺 **!diag / !cacatest**', value: 'Lancer un diagnostic complet de l\'état de santé et de tous les modules de Cacabot.' },
                { name: '📣 **!say [ID_salon] [message]**', value: 'Envoyer un message dans un salon au nom de Cacabot.' },
                { name: '💾 **!save**', value: 'Forcer une sauvegarde immédiate dans le salon de backup Discord.' },
                { name: '💾 **!lastsave**', value: 'Afficher la date et l\'heure de la dernière sauvegarde Discord.' }
            );
    }
    if (categorie === 'generateurs') {
        return embed.setTitle('🔮 Commandes génératrices')
            .addFields(
                { name: '🔮 **!horoscope [ID_salon]**', value: 'Forcer l\'envoi de l\'horoscope dans un salon spécifique.' },
                { name: '🚨 **!wanted set @Membre/pseudo/ID**', value: 'Forcer le.a criminel.le du jour.' },
                { name: '🔄 **!wanted reset**', value: 'Générer un nouveau criminel du jour.' }
            );
    }
    if (categorie === 'autres') {
        return embed.setTitle('👥 Commandes pour les autres membres')
            .addFields(
                { name: '⏰ **!rappel [ID] Xmin/h [message]**', value: 'Envoyer un rappel à un membre spécifique par son ID.' },
                { name: '📝 **!setmessages @Membre**', value: 'Définir manuellement le nombre de messages d\'un membre.' }
            );
    }
    if (categorie === 'roulette') {
        return embed.setColor(0xffd20a).setTitle('🎰 Commandes roulette')
            .addFields(
                { name: '🔄 **!reroll [membre]**', value: 'Réinitialise le cooldown d\'un·e membre.' },
                { name: '🎉/💀 **!bonusforce / !malusforce [id] [membre]**', value: 'Impose un bonus ou un malus à un·e membre.' },
{ name: '📋 **!rouletteID / !rltid**', value: 'Affiche tous les identifiants de bonus/malus/spécial, triés par bouton.' },
                { name: '♻️ **!resetroulettestate / !resetrlt [membre]**', value: 'Réinitialise tout l\'état roulette d\'un·e membre.' },
                { name: '🗑️ **!removestate [membre] [nom]**', value: 'Retire un seul effet actif d\'un·e membre.' }
            );
    }
    return embed.setTitle('❓ Inconnu').setDescription('Catégorie introuvable.');
}

// =========================
//   DÉTECTION DES COMMANDES
// =========================

function getHelpResponse(command) {
    if (command === "!help") {
        return {
            data: new EmbedBuilder()
                .setColor(0x00ffff)
                .setTitle("\ud83d\udca9 AIDE \u00c0 CACABOT")
                .setDescription("Hey ! Voici Cacabot, qui, malgr\u00e9 son nom peu glorieux, offre de multiples commandes qui seront le Graal des gens qui aiment s'ennuyer !\n\nPour d\u00e9couvrir les diff\u00e9rentes commandes disponibles de Cacabot, choisis l'une des cat\u00e9gories ci-dessous !")
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
            return message.reply("Tu n'es pas autoris\u00e9(e) \u00e0 faire cette commande.");
        }
        const embed = buildHelpxPresentationEmbed();
        const row = new ActionRowBuilder().addComponents(buildHelpxMenu(message.author.id));
        return message.reply({ embeds: [embed], components: [row] });
    }

    // !help
    if (response?.data) {
        const menu = new StringSelectMenuBuilder()
            .setCustomId(`help_menu_${message.author.id}_${message.id}`)
            .setPlaceholder('Choisis une cat\u00e9gorie')
            .addOptions(
                { label: '\ud83c\udf89 Fun', description: 'Interact, Discussion, Anniversaire, Random', value: 'fun' },
                { label: '\ud83d\udee0 Utilitaire', description: 'Discord, YouTube, Cacabot, Autres', value: 'util' },
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

    if (interaction.isButton() && interaction.customId.startsWith('helpx_roulette_')) {
        const authorId = interaction.customId.split('_')[2];
        if (interaction.user.id !== authorId) {
            return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true });
        }
        const embed = new EmbedBuilder()
            .setColor(0xffd20a)
            .setTitle('🎰 Commandes admin roulette')
            .setDescription(
                "`!reroll [membre]` — réinitialise le cooldown d'un.e membre\n" +
                "`!bonusforce`/`!malusforce [ID bonus/malus] [membre]` — impose un bonus/malus à un.e membre\n" +
                "`!rouletteID`/`!rltID` — affiche les ID des bonus/malus\n" +
                "`!resetroulettestate`/`!resetrlt [membre]` — reset tout l'état roulette d'un.e membre\n" +
                "`!removestate [membre] [nom]` — retire un seul effet actif d'un.e membre"
            );
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // =========================
    // MENU SELECT FUN
    // =========================

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('help_fun_')) {
        const funParts = interaction.customId.split('_');
        const helpAuthorId = funParts[2];
        const helpMessageId = funParts[3] ?? null;
        if (interaction.user.id !== helpAuthorId) {
            return interaction.reply({ content: "Ce menu ne t'est pas destin\u00e9 !", ephemeral: true });
        }

        const value = interaction.values[0];
        let embed;

        if (value === 'interact') {
            embed = new EmbedBuilder()
                .setColor(0xffdc5d)
                .setDescription("# \ud83d\udc46 Interact")
                .addFields(
                    { name: "💋!kiss / !bisou", value: "Embrassez quelqu'un sur le serveur !" },
                    { name: "🫂!hug / !calin", value: "Faites un c\u00e2lin \u00e0 quelqu'un sur le serveur !" },
                    { name: "💃!danse / !dance", value: "Dansez avec quelqu'un sur le serveur !" },
                    { name: "🗯️!insult", value: "Insulte quelqu'un du serveur ! (Oui c'est gratuit)" },
                    { name: "☠️!die", value: "Mourez en direct sur le serveur !" },
                    { name: "🔨!ban", value: "Bannir quelqu'un du serveur... symboliquement." },
                    { name: "😛!bait", value: "Ragebait quelqu'un du serveur, gratuitement." },
                    { name: "💥!explode / !explose", value: "Explose." },
                    { name: "\ud83d\ude10 !palaref / !pref", value: "Ce moment g\u00eanant quand vous n'avez pas la ref..." },
                    { name: "\ud83d\ude2d !glaref / !gref / !jailaref", value: "Vous avez la ref!" },
                    { name: "\ud83d\ude2d !cry / !pleure", value: "Pleure." },
                    { name: "👊!punch / !frappe", value: "Frappez quelqu'un sur le serveur !" },
                    { name: "🔫!bang / !tir / !pan", value: "Tirez sur quelqu'un sur le serveur !" },
                    { name: "🗿!rizz", value: "Rizzez quelqu'un sur le serveur !" },
                    { name: "🏃!run", value: "Fuis quelqu'un sur le serveur !" },
                    { name: "😆!rire", value: "Riez un bon coup !" }
                );
        }

        if (value === 'discussion') {
            embed = new EmbedBuilder()
                .setColor(0x6bb5ff)
                .setDescription("# \ud83d\udcac Discussion")
                .addFields(
                    { name: "❓!question", value: "Lance une question al\u00e9atoire parmi 6 cat\u00e9gories !" },
                    { name: "⚖️!choix", value: "Vous avez du mal \u00e0 faire un choix ? Demandez \u00e0 Cacabot." }
                );
        }

        if (value === 'random') {
            embed = new EmbedBuilder()
                .setColor(0xf5f8fa)
                .setDescription("# \ud83d\udca5 Random")
                .addFields(
                    { name: "\ud83c\udfb0!roulette / !rlt", value: "Faire tourner la roulette et tomber sur un bonus... ou un malus." },
                    { name: "🧠!destin", value: "Pr\u00e9dit votre destin et fait part des \u00e9v\u00e8nements de votre futur." },
                    { name: "🐕!animal", value: "Devine votre animal spirituel parmi pr\u00e8s de 7000 combinaisons !" },
                    { name: "👔!epsys", value: "Poste des GIFs al\u00e9atoires d'Epsys, parce que." },
                    { name: "🤣!blague", value: "Lance une blague al\u00e9atoire en 3 cat\u00e9gories !" },
                    { name: "🪙!flip", value: "Pour d\u00e9cider \u00e0 pile ou face !" },
                    { name: "🔮!horoscope", value: "L'horoscope du jour selon Cacabot." },
                    { name: "\ud83d\udea8!wanted", value: "D\u00e9signe le criminel du jour parmi les membres." }
                );
        }

        if (value === 'anniversaire') {
            embed = new EmbedBuilder()
                .setColor(0xff69b4)
                .setDescription("# \ud83c\udf82 Anniversaire")
                .addFields(
                    { name: "!anniversaire set JJ/MM", value: "Enregistre ton anniversaire." },
                    { name: "!anniversaire show", value: "Affiche ton anniversaire enregistr\u00e9." },
                    { name: "!anniversaire list", value: "Liste tous les anniversaires du serveur." },
                    { name: "!anniversaire next", value: "Affiche le prochain anniversaire du serveur." }
                );
        }

        if (!embed) {
            embed = new EmbedBuilder().setColor(0xff0000).setTitle("Erreur").setDescription("Cat\u00e9gorie inconnue");
        }

        const backButton = new ButtonBuilder()
            .setCustomId(`help_fun_back_${helpAuthorId}_${helpMessageId ?? ''}`)
            .setLabel('\u2b05 Retour')
            .setStyle(ButtonStyle.Secondary);
        const deleteButton = new ButtonBuilder()
            .setCustomId(`help_delete_${helpAuthorId}_${helpMessageId ?? ''}`)
            .setLabel('\u274c Supprimer')
            .setStyle(ButtonStyle.Secondary);
        const backRow = new ActionRowBuilder().addComponents(backButton, deleteButton);
        return interaction.update({ embeds: [embed], components: [backRow] });
    }

    // =========================
    // BOUTON RETOUR FUN
    // =========================

    if (interaction.isButton() && interaction.customId.startsWith('help_fun_back_')) {
        const funBackParts = interaction.customId.split('_');
        const helpAuthorId = funBackParts[3];
        const helpMessageId = funBackParts[4] ?? null;
        if (interaction.user.id !== helpAuthorId) {
            return interaction.reply({ content: "Ce menu ne t'est pas destin\u00e9 !", ephemeral: true });
        }

        const funEmbed = new EmbedBuilder()
            .setColor(0xffcc00)
            .setDescription("# \ud83c\udf89 Fun\n*Toutes les commandes pour animer le serveur et faire des trucs inutiles mais dr\u00f4les.*\n\n\ud83d\udc46 **Interact** \u2014 Interagis avec les membres du serveur\n\ud83d\udcac **Discussion** \u2014 Lance des d\u00e9bats ou laisse le hasard d\u00e9cider\n\ud83c\udf82 **Anniversaire** \u2014 Pour les anniversaires des membres du serveur\n\ud83d\udca5 **Random** \u2014 Commandes al\u00e9atoires et surprises");

        const funMenu = new StringSelectMenuBuilder()
            .setCustomId(`help_fun_${helpAuthorId}`)
            .setPlaceholder('Choisis une cat\u00e9gorie')
            .addOptions(
                { label: '\ud83d\udc46 Interact', description: 'kiss, hug, insult, die, ban, bait, explode, palaref, jailaref, punch, bang, rizz, rire, danse, run', value: 'interact' },
                { label: '\ud83d\udcac Discussion', description: 'question, choix', value: 'discussion' },
                { label: '\ud83c\udf82 Anniversaire', description: 'set, show, list, next', value: 'anniversaire' },
                { label: '\ud83d\udca5 Random', description: 'roulette, destin, animal, epsys, flip, blague, horoscope, wanted', value: 'random' }
            );

        const funBackButton = new ButtonBuilder()
            .setCustomId(`help_back_${helpAuthorId}_${helpMessageId ?? ''}`)
            .setLabel('\u2b05 Retour')
            .setStyle(ButtonStyle.Secondary);
        const funDeleteButton = new ButtonBuilder()
            .setCustomId(`help_delete_${helpAuthorId}_${helpMessageId ?? ''}`)
            .setLabel('\u274c Supprimer')
            .setStyle(ButtonStyle.Secondary);
        const funRow = new ActionRowBuilder().addComponents(funMenu);
        const funBackRow = new ActionRowBuilder().addComponents(funBackButton, funDeleteButton);
        return interaction.update({ embeds: [funEmbed], components: [funRow, funBackRow] });
    }


    // =========================
    // MENU SELECT UTIL
    // =========================

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('help_util_')) {
        const helpAuthorId = interaction.customId.split('_')[2];
        const helpMessageId = interaction.customId.split('_')[3] ?? null;
        if (interaction.user.id !== helpAuthorId) {
            return interaction.reply({ content: "Ce menu ne t'est pas destin\u00e9 !", ephemeral: true });
        }

        const value = interaction.values[0];
        let embed;

        if (value === 'discord') {
            embed = new EmbedBuilder()
                .setColor(0xbdddf4)
                .setDescription("# \ud83d\udcac Discord")
                .addFields(
                    { name: "<:serveur_icon:1505456319946031144> !serveur", value: "Afficher les informations du serveur." },
                    { name: "\ud83d\udc64 !profil", value: "Afficher le profil d'un membre." },
                    { name: "\ud83d\uddbc\ufe0f !avatar", value: "Afficher l'avatar d'un membre en grand." },
                    { name: "\ud83c\udfc5 !top", value: "Afficher le top 10 des membres les plus actifs." },
                    { name: "\ud83d\udcac !actif", value: "Affiche les membres les plus actifs du jour et de la semaine." }
                );
        }

        if (value === 'youtube') {
            embed = new EmbedBuilder()
                .setColor(0xff0000)
                .setDescription("# <:youtube_icon:1505457903585198151> YouTube")
                .addFields(
                    { name: "🔎 !youtube", value: "Rechercher une vidéo sur YouTube." },
                    { name: "❗ !last", value: "Afficher la dernière vidéo d'une chaîne." },
                    { name: "📈 !stats", value: "Regarder les stats d'une chaîne YouTube." }
                    );
        }

        if (value === 'autres') {
            embed = new EmbedBuilder()
                .setColor(0x95a5a6)
                .setDescription("# \ud83d\uddd2\ufe0f Autres")
                .addFields(
                    { name: "<:aternos_icon:1505454393049485362> !aternos", value: "Obtenir l'IP du serveur Aternos (Minecraft) de Rega\u00efa." },
                    { name: "\u23f0 !rappel", value: "Se faire rappeler quelque chose dans X minutes/heures." },
                    { name: "\u26c5 !météo", value: "Affiche la météo d'une ville." },
                    { name: "🍅 !pomodoro", value: "Démarrer une séance de pomodoro." }
                );
        }

        if (value === 'cacabot') {
            embed = new EmbedBuilder()
                .setColor(0x5865f2)
                .setDescription("# \ud83e\udd16 Cacabot")
                .addFields(
                    { name: "\ud83e\udd16 !botinfo / !about / !abt", value: "Affiche les informations de Cacabot." },
                    { name: "🤫 !stop / !unstop", value: "Faire taire Cacabot pendant 1h, ou le faire revenir avant la fin." },
                    { name: "\ud83c\udfd3 !ping", value: "Affiche la latence du bot." }
                );
        }

        if (!embed) {
            embed = new EmbedBuilder().setColor(0xff0000).setTitle("Erreur").setDescription("Cat\u00e9gorie inconnue");
        }

        const backButton = new ButtonBuilder()
            .setCustomId(`help_back_util_${helpAuthorId}`)
            .setLabel('\u2b05 Retour')
            .setStyle(ButtonStyle.Secondary);
        const deleteButton = new ButtonBuilder()
            .setCustomId(`help_delete_${helpAuthorId}_${helpMessageId ?? ''}`)
            .setLabel('\u274c Supprimer')
            .setStyle(ButtonStyle.Secondary);
        const backRow = new ActionRowBuilder().addComponents(backButton, deleteButton);
        return interaction.update({ embeds: [embed], components: [backRow] });
    }

    // =========================
    // BOUTON RETOUR UTIL
    // =========================

    if (interaction.isButton() && interaction.customId.startsWith('help_back_util_')) {
        const helpAuthorId = interaction.customId.replace('help_back_util_', '');
        if (interaction.user.id !== helpAuthorId) {
            return interaction.reply({ content: "Ce menu ne t'est pas destin\u00e9 !", ephemeral: true });
        }

        const utilEmbed = new EmbedBuilder()
            .setColor(0x8899a6)
            .setTitle("\ud83d\udee0 Utilitaire")
            .setDescription("<:discord_icon:1505454379669524532> **Discord** \u2014 Commandes relatives au serveur\n<:youtube_icon:1505457903585198151> **YouTube** \u2014 Pour explorer le meilleur site de tous les temps\n\ud83e\udd16 **Cacabot** \u2014 Commandes relatives \u00e0 Cacabot\n\ud83d\uddd2\ufe0f **Autres** \u2014 Autres commandes non-r\u00e9pertori\u00e9es");

        const utilMenu = new StringSelectMenuBuilder()
            .setCustomId(`help_util_${helpAuthorId}`)
            .setPlaceholder('Choisis une cat\u00e9gorie')
            .addOptions(
                { label: '\ud83d\udcac Discord', description: 'serveur, info, avatar, top, actif', value: 'discord' },
                { label: '▶️ YouTube', description: 'youtube, stats, last', value: 'youtube' },
                { label: '\ud83e\udd16 Cacabot', description: 'botinfo, ping', value: 'cacabot' },
                { label: '\ud83d\uddd2\ufe0f Autres', description: 'aternos, rappel, météo, pomodoro', value: 'autres' }
            );

        const utilBackButton = new ButtonBuilder()
            .setCustomId(`help_back_${helpAuthorId}`)
            .setLabel('\u2b05 Retour')
            .setStyle(ButtonStyle.Secondary);
        const utilDeleteButton = new ButtonBuilder()
            .setCustomId(`help_delete_${helpAuthorId}_`)
            .setLabel('\u274c Supprimer')
            .setStyle(ButtonStyle.Secondary);
        const utilRow = new ActionRowBuilder().addComponents(utilMenu);
        const utilBackRow = new ActionRowBuilder().addComponents(utilBackButton, utilDeleteButton);
        return interaction.update({ embeds: [utilEmbed], components: [utilRow, utilBackRow] });
    }

    // =========================
    // MENU SELECT
    // =========================

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('help_menu_')) {
        const parts = interaction.customId.split('_');
        const helpAuthorId = parts[2];
        const helpMessageId = parts[3] ?? null;
        if (interaction.user.id !== helpAuthorId) {
            return interaction.reply({ content: "Ce menu ne t'est pas destin\u00e9 !", ephemeral: true });
        }

        const value = interaction.values[0];
        let embed;

        if (value === 'fun') {
            const funEmbed = new EmbedBuilder()
                .setColor(0xffcc00)
                .setDescription("# \ud83c\udf89 Fun\n*Toutes les commandes pour animer le serveur et faire des trucs inutiles mais dr\u00f4les.*\n\n\ud83d\udc46 **Interact** \u2014 Interagis avec les membres du serveur\n\ud83d\udcac **Discussion** \u2014 Lance des d\u00e9bats ou laisse le hasard d\u00e9cider\n\ud83c\udf82 **Anniversaire** \u2014 Pour les anniversaires des membres du serveur\n\ud83d\udca5 **Random** \u2014 Commandes al\u00e9atoires et surprises");

            const funMenu = new StringSelectMenuBuilder()
                .setCustomId(`help_fun_${helpAuthorId}`)
                .setPlaceholder('Choisis une cat\u00e9gorie')
                .addOptions(
                    { label: '\ud83d\udc46 Interact', description: 'kiss, hug, insult, die, ban, bait, explode, palaref, jailaref, punch, bang, rizz, rire, danse, run', value: 'interact' },
                    { label: '\ud83d\udcac Discussion', description: 'question, choix', value: 'discussion' },
                    { label: '\ud83c\udf82 Anniversaire', description: 'set, show, list, next', value: 'anniversaire' },
                    { label: '\ud83d\udca5 Random', description: 'destin, animal, epsys, flip, blague, horoscope, wanted', value: 'random' }
                );

            const funBackButton = new ButtonBuilder()
                .setCustomId(`help_back_${helpAuthorId}_${helpMessageId ?? ''}`)
                .setLabel('\u2b05 Retour')
                .setStyle(ButtonStyle.Secondary);
            const funDeleteButton = new ButtonBuilder()
                .setCustomId(`help_delete_${helpAuthorId}_${helpMessageId ?? ''}`)
                .setLabel('\u274c Supprimer')
                .setStyle(ButtonStyle.Secondary);
            const funRow = new ActionRowBuilder().addComponents(funMenu);
            const funBackRow = new ActionRowBuilder().addComponents(funBackButton, funDeleteButton);
            return interaction.update({ embeds: [funEmbed], components: [funRow, funBackRow] });
        }

        if (value === 'util') {
            const utilEmbed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle("\ud83d\udee0 Utilitaire")
                .setDescription("<:discord_icon:1505454379669524532> **Discord** \u2014 Commandes relatives au serveur\n<:youtube_icon:1505457903585198151> **YouTube** \u2014 Pour explorer le meilleur site de tous les temps\n\ud83e\udd16 **Cacabot** \u2014 Commandes relatives \u00e0 Cacabot\n\ud83d\uddd2\ufe0f **Autres** \u2014 Autres commandes non-r\u00e9pertori\u00e9es");

            const utilMenu = new StringSelectMenuBuilder()
                .setCustomId(`help_util_${helpAuthorId}`)
                .setPlaceholder('Choisis une cat\u00e9gorie')
                .addOptions(
                    { label: '\ud83d\udcac Discord', description: 'serveur, info, avatar, top, actif', value: 'discord' },
                    { label: '\u25b6\ufe0f YouTube', description: 'youtube, stats, last', value: 'youtube' },
                    { label: '\ud83e\udd16 Cacabot', description: 'botinfo, ping, stop', value: 'cacabot' },
                    { label: '\ud83d\uddd2\ufe0f Autres', description: 'aternos, rappel, météo, pomodoro', value: 'autres' }
                );

            const utilBackButton = new ButtonBuilder()
                .setCustomId(`help_back_${helpAuthorId}`)
                .setLabel('\u2b05 Retour')
                .setStyle(ButtonStyle.Secondary);
            const utilDeleteButton = new ButtonBuilder()
                .setCustomId(`help_delete_${helpAuthorId}_${helpMessageId ?? ''}`)
                .setLabel('\u274c Supprimer')
                .setStyle(ButtonStyle.Secondary);
            const utilRow = new ActionRowBuilder().addComponents(utilMenu);
            const utilBackRow = new ActionRowBuilder().addComponents(utilBackButton, utilDeleteButton);
            return interaction.update({ embeds: [utilEmbed], components: [utilRow, utilBackRow] });
        }

        if (!embed) {
            embed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle("Erreur")
                .setDescription("Cat\u00e9gorie inconnue");
        }

        const backButton = new ButtonBuilder()
            .setCustomId(`help_back_${helpAuthorId}_${helpMessageId ?? ''}`)
            .setLabel('\u2b05 Retour')
            .setStyle(ButtonStyle.Secondary);
        const deleteButton = new ButtonBuilder()
            .setCustomId(`help_delete_${helpAuthorId}_${helpMessageId ?? ''}`)
            .setLabel('\u274c Supprimer')
            .setStyle(ButtonStyle.Secondary);
        const row = new ActionRowBuilder().addComponents(backButton, deleteButton);
        return interaction.update({ embeds: [embed], components: [row] });
    }

    // =========================
    // BOUTON SUPPRIMER
    // =========================

    if (interaction.isButton() && interaction.customId.startsWith('help_delete_')) {
        const delParts = interaction.customId.split('_');
        const helpAuthorId = delParts[2];
        const helpMessageId = delParts[3] ?? null;
        if (interaction.user.id !== helpAuthorId) {
            return interaction.reply({ content: "Tu ne peux pas supprimer ce message !", ephemeral: true });
        }
        // Supprimer l'embed
        await interaction.message.delete().catch(() => {});
        // Supprimer le message original de la commande
        if (helpMessageId && helpMessageId !== '') {
            const originalMsg = await interaction.channel.messages.fetch(helpMessageId).catch(() => null);
            if (originalMsg) await originalMsg.delete().catch(() => {});
        }
        return;
    }

    // =========================
    // BOUTON RETOUR
    // =========================

    if (interaction.isButton() && interaction.customId.startsWith('help_back_')) {
        const backParts = interaction.customId.split('_');
        const helpAuthorId = backParts[2];
        const helpMessageId = backParts[3] ?? null;
        if (interaction.user.id !== helpAuthorId) {
            return interaction.reply({ content: "Ce menu ne t'est pas destin\u00e9 !", ephemeral: true });
        }
        const embed = new EmbedBuilder()
            .setColor(0x00ffff)
            .setTitle("\ud83d\udca9 AIDE \u00c0 CACABOT")
            .setDescription("Hey ! Voici Cacabot, qui, malgr\u00e9 son nom peu glorieux, offre de multiples commandes qui seront le Graal des gens qui aiment s'ennuyer !\n\nPour d\u00e9couvrir les diff\u00e9rentes commandes disponibles de Cacabot, choisis l'une des cat\u00e9gories ci-dessous !");

        const menu = new StringSelectMenuBuilder()
            .setCustomId(`help_menu_${helpAuthorId}_${helpMessageId ?? ''}`)
            .setPlaceholder('Choisis une cat\u00e9gorie')
            .addOptions(
                { label: '\ud83c\udf89 Fun', description: 'Interact, Discussion, Anniversaire, Random', value: 'fun' },
                { label: '\ud83d\udee0 Utilitaire', description: 'Discord, YouTube, Cacabot, Autres', value: 'util' }
            );
        const row = new ActionRowBuilder().addComponents(menu);
        return interaction.update({ embeds: [embed], components: [row] });
    }
}

// =========================
//   POINTS D'ENTRÉE (appelés depuis index.js)
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