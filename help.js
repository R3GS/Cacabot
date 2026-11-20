// ==========================================
//   AIDE : !help et !helpx pour Cacabot
// ==========================================

const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

const EPSYS_ID = '436218312574107658';
const MODO_ROLE_ID = '720081311716606004';

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
            `-# Diagnostic, saves, messages du bot, sanctions modos, embeds, rôles & YouTube.\n` +
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
            `🃏 **RegaDex / TCG (Admin)**\n` +
            `-# Boosters (membre & rôle), points, cartes, cooldown, proxies & mode test !tcgx.\n` +
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
                `Gestion complète du bot, de ses messages, des salons et de la modération.\n\n` +
                `### 🩺 Santé & Sauvegardes\n` +
                `\`!diag\` *(ou \`!cacatest\`)* • Diagnostic complet de tous les modules et APIs\n` +
                `\`!save\` • \`!lastsave\` • Forcer un backup \`#json\` ou voir l'heure du dernier\n\n` +
                `### 🗣️ Voix de Cacabot & Bugs\n` +
                `\`!say [#salon/ID] [texte]\` • Envoyer un message au nom de Cacabot\n` +
                `\`!reply [ID] [texte]\` • \`!edit [ID] [texte]\` • Répondre ou éditer un message du bot\n` +
                `\`!chut [durée]\` / \`!unchut\` • Couper ou réactiver les répliques dans le salon\n` +
                `\`!bug\` *(liste)* • \`!bug\` *(en réponse)* • \`!bug resolve [N]\` • \`!bug clear\` • Suivi des bugs\n\n` +
                `### 🔨 Modération & Sanctions *(Modos + Epsys)*\n` +
                `\`!helpm\` • Ouvrir le centre d'aide Modération\n` +
                `\`!bannir [@membre/ID] [raison]\` • \`!unban [ID] [raison]\` • \`!kick [@membre/ID] [raison]\` *(ou \`!expulser\`)*\n` +
                `\`!mute [@membre/ID] [durée] [raison]\` • \`!unmute [@membre/ID] [raison]\`\n` +
                `\`!warn [@membre/ID] [raison]\` *(paliers 1→6)* • \`!warns\` *(ou \`!casier\`)* • \`!unwarn\`\n` +
                `\`!lock [raison]\` • \`!unlock\` • \`!slowmode [durée/off]\` • \`!prune [1-100]\`\n` +
                `\`!up [réponse/ID/lien]\` *(/up / menu Apps)* • \`!tribunal [ID/@membre]\` • \`!archives\` • \`!destituation [@modo]\`\n\n` +
                `### ⚙️ Configuration & Communauté\n` +
                `\`!embed\` / \`!embed modify [ID]\` • Créateur et éditeur interactif d'embeds\n` +
                `\`!rolereac\` • \`!rolebtn\` • \`!rolembed\` • Gérer rôles-réactions, boutons & panneaux\n` +
                `\`!ytabo config\` • Panneau interactif des abonnements YouTube\n` +
                `\`!welcome\` / \`!welcome test [@membre]\` • Configurer l'accueil, rôles auto & tester l'affiche`
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
                `Gestion des statistiques, succès, cooldowns, visuels HoF/HoS et effets spéciaux *(toutes les commandes fonctionnent avec ou sans espace)*.\n\n` +
                `### 📊 Statistiques & Succès\n` +
                `\`!stats set [@membre]\` • Panneau complet pour modifier tirages, gains, bonus & malus\n` +
                `\`!successgive [@membre]\` • Menu pour réattribuer des succès perdus\n` +
                `\`!rltsuccesforce [id/test] [@membre]\` • Débloque un succès de force ou teste une carte\n\n` +
                `### 🖼️ Tests Hall of Fame / Hall of Shame & Proxies PP\n` +
                `\`!rlthoftest [slug] [@membre]\` • Teste l'affiche Canvas **Hall of Fame** dans le salon actuel *(silencieux, ne poste pas dans le HoF)*\n` +
                `\`!rlthostest [slug] [@membre]\` • Teste l'affiche Canvas **Hall of Shame** dans le salon actuel *(silencieux, ne poste pas dans le HoS)*\n` +
                `\`!rltproxies\` *(\`warmup\` / \`purge\`)* • Diagnostic & pré-génération du cache des avatars membres (\`Roulette/Proxies\`)\n\n` +
                `### 🎛️ Effets & Cooldowns\n` +
                `\`!reroll [@membre]\` • Réinitialise immédiatement le cooldown d'un·e membre\n` +
                `\`!bonusforce [id] [@membre]\` / \`!malusforce [id] [@membre]\` • Impose un tirage\n` +
                `\`!rltid\` *(ou \`!rouletteid\`)* • Liste triée des IDs bonus, malus & spéciaux\n` +
                `\`!removestate [@membre] [nom]\` • Retire un seul effet actif *(pseudo, mute, transfo...)*\n` +
                `\`!rltgiveitem [id item] [@membre]\` • Donne un item du Battle Pass à un.e membre\n` +
                `\`!itemid\` • Consulter l'id des items du Battle Pass\n` +
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

    // 4b. REGADEX / TCG (ADMIN)
    if (category === 'tcg') {
        return embed
            .setColor(0xf1c40f)
            .setTitle('🃏 RegaDex / TCG (Administration)')
            .setDescription(
                `Gestion complète des boosters, points, cartes, cooldowns et cache RegaDex *(avec ou sans espace)*.\n\n` +
                `### 🎁 Boosters & Cooldown\n` +
                `\`!boostergive [@membre/ID] [nb]\` • Ajouter des boosters à l'inventaire d'un·e membre\n` +
                `\`!givebooster @rôle [nb]\` • Donner des boosters à tout un rôle *(\`@everyone\` inclus)*\n` +
                `\`!boosterremove [@membre/ID] [nb]\` • Retirer des boosters de l'inventaire\n` +
                `\`!rgdxcooldown reset [@membre/ID]\` *(ou \`!tcgcooldown\` / \`!regadexcooldown\`)* • Remet le stock gratuit à 2/2\n\n` +
                `### 🪙 Points & Cartes\n` +
                `\`!rgdxpts give [@membre/ID] [nb]\` / \`set\` *(ou \`!tcgpts\` / \`!regadexpts\`)* • Gérer les points\n` +
                `\`!rgdxcard give [@membre/ID] [carte]\` / \`remove\` *(ou \`!tcgcard\` / \`!regadexcard\`)* • Gérer les cartes *(compatible \`Spé-01\`)*\n` +
                `\`!tcgperso\` *(ou \`!rgdxperso\` / \`!cartesperso\`)* • Visualiser toutes les Cartes Perso (\`TCG/Cartes Perso\`) & leurs propriétaires\n` +
                `\`!tcgpunition [@membre/ID/pseudo]\` • Réduire ou bloquer les pulls Épiques / Légendaires / Full Art / Négatives d'un·e membre\n\n` +
                `\`!tcgpullchance\` • Augmenter les chances de pull d'une carte *(membre ou rôle Collectionneur.euse)*\n\n` +
                `\`!tcgtradeopen5min\` *(ou \`off\`)* • Lève tous les critères d'échange pendant **5 min** *(invisible pour les membres dans les échanges)*\n\n` +
                `### 🧪 Mode Test & Cache Proxies (Coolify)\n` +
                `\`!tcgx [sous-cmd]\` *(hub, open, store, claim, classeur, carte, flex, top, reset)* • Bac à sable isolé *(109/109 cartes x5, 999k pts)*\n` +
                `\`!tcgmastertest\` • \`!tcggodpacktest\` • \`!tcgtradetest [1-3]\` • Tester les visuels Maître du Set, God Pack & Trade\n` +
                `\`!tcgopenlast\` *(ou \`!tcglastopen\`)* • Voir le récap des 20 dernières ouvertures + détail par sélection\n` +
                `\`!rgdxproxies\` *(ou \`!tcgproxies\`)* • Diagnostic \`TCG/Proxies\` + menu pour générer Set par Set ou Cartes Perso\n` +
                `\`!rgdxproxies warmup [1|perso|all]\` • Pré-génère les miniatures & lueurs sur le volume *(ou via le menu)*\n` +
                `\`!rgdxproxies purge\` • Vide le cache disque pour forcer la régénération`
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
                description: 'Diag, saves, say/edit, sanctions modos, embeds & rôles',
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
                label: 'RegaDex / TCG (Admin)',
                description: 'boostergive, pullchance, rgdxpts/card, !tcgx & proxies',
                emoji: '🃏',
                value: 'tcg',
                default: currentCategory === 'tcg'
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
//   BUILDERS DE PAGES !HELPM (MODOS)
// =========================

function buildHelpmHomeEmbed(user, botAvatarUrl = null) {
    const displayName = user?.displayName || user?.username || 'Modo';
    return new EmbedBuilder()
        .setColor(0xe74c3c)
        .setAuthor({ name: 'Cacabot • Modération Regaïa', iconURL: botAvatarUrl || undefined })
        .setTitle('🛡️ Centre de Modération (Modos)')
        .setDescription(
            `Panneau réservé aux membres possédant le rôle <@&${MODO_ROLE_ID}> *(et à <@${EPSYS_ID}>)*.\n` +
            `-# 💡 Astuce : la plupart des commandes fonctionnent aussi en **répondant (reply)** au message du fautif !\n` +
            `────────────────────────────────────────\n` +
            `### 🧭 Thématiques disponibles\n` +
            `⚖️ **Sanctions & Casier**\n` +
            `-# !bannir, !unban, !kick, !mute, !unmute, !warn (paliers auto), !warns & !unwarn.\n` +
            `────────────────────────────────────────\n` +
            `🛡️ **Sécurité, Salons & Tribunal**\n` +
            `-# !tribunal, !archives, !lock/!unlock, !slowmode, !prune, !chut/!unchut & alertes.\n` +
            `────────────────────────────────────────\n` +
            `🧰 **Gestion & Communauté**\n` +
            `-# Remontée !up, gestion des anniversaires & suppression de quotes.\n` +
            `────────────────────────────────────────\n` +
            `📋 **Tout afficher**\n` +
            `-# Vue complète de toutes les commandes accessibles aux modérateurs.\n` +
            `────────────────────────────────────────\n` +
            `-# 👇 Sélectionne une catégorie dans le menu déroulant ci-dessous`
        )
        .setFooter({ text: `Regaïa • Panel Modération de ${displayName}` });
}

function buildHelpmCategoryEmbed(category, user, botAvatarUrl = null) {
    const displayName = user?.displayName || user?.username || 'Modo';
    const embed = new EmbedBuilder()
        .setAuthor({ name: 'Cacabot • Panel Modération', iconURL: botAvatarUrl || undefined })
        .setFooter({ text: `Regaïa • Panel Modération de ${displayName}` });

    const sanctionsSection =
        `### 🔨 Sanctions directes *(utilisables en reply !)*\n` +
        `\`!bannir [@membre / ID] [raison]\` • Confirmation + choix de purge *(0/1h/6h/12h/24h)*\n` +
        `\`!unban [ID] [raison]\` • Débannir un compte via son identifiant\n` +
        `\`!kick [@membre / ID] [raison]\` *(ou \`!expulser\`)* • Expulser un membre *(avec MP)*\n` +
        `\`!mute [@membre / ID] [durée] [raison]\` • Mute instantané *(ou menu déroulant si sans durée)*\n` +
        `\`!unmute [@membre / ID] [raison]\` • Retirer un mute immédiatement\n\n` +
        `### ⚠️ Avertissements & Casier\n` +
        `\`!warn [@membre / ID] [raison]\` • Enregistre un warn avec **paliers auto (1→6)**\n` +
        `-# ↳ **2 :** mute 30m • **3 :** 6h • **4 :** 24h • **5 :** alerte décision • **6 :** ban def *(rappel auto à 60j)*\n` +
        `\`!warns [@membre / ID]\` *(ou \`!casier\`)* • Consulter le casier complet\n` +
        `\`!unwarn [@membre / ID / Pseudo]\` • Retirer un avertissement via panneau de confirmation`;

    const moderationSection =
        `### ⚖️ Tribunal, Destitution & Archives\n` +
        `\`!tribunal [ID / @membre] [raison]\` *(ou \`!trib\` / \`!bantemp\`)* • Ouvre le tribunal *(salons modération)*\n` +
        `\`!archives\` *(ou \`!archive\` / \`!tribunal list\`)* • Télécharge les logs \`.txt\` des tribunaux\n` +
        `\`!destituation [@modo] [raison]\` *(ou \`!desti\` / \`!antimodo\`)* • Vote anonyme d'exclusion d'un modo *(48h, salons staff)*\n\n` +
        `### 🔒 Contrôle des salons & Silence\n` +
        `\`!lock [raison]\` • \`!unlock\` • Verrouiller ou déverrouiller l'envoi de messages dans un salon\n` +
        `\`!slowmode [durée / off]\` • Régler le mode lent *(ex: \`!slowmode 10\`, menu si vide)*\n` +
        `\`!prune [1-100]\` *(ou \`/prune\`)* • Suppression en masse *(perm. Gérer les messages)*\n` +
        `\`!chut [durée]\` • \`!unchut\` • Couper ou réactiver les répliques *(accès restreint)*`;

    const gestionSection =
        `### 📌 Remontée de messages\n` +
        `\`!up [réponse / ID / lien]\` • Remonte une suggestion ou un vote roulette\n` +
        `-# ↳ Aussi dispo via \`/up\` et \`Clic droit -> Applications -> 🆙 Remonter (up)\`\n\n` +
        `### 🎂 Anniversaires des membres\n` +
        `\`!anniversaire set [Pseudo] [JJ/MM]\` • \`remove [Pseudo]\` *(ou \`/anniversaire\`)*\n\n` +
        `### 📜 Citations archivées\n` +
        `\`!quote remove [ID]\` • Supprimer une citation *(+ bouton **🗑️ Supprimer** sur les embeds)*`;

    if (category === 'sanctions') {
        return embed
            .setColor(0xe03131)
            .setTitle('⚖️ Sanctions & Casier')
            .setDescription(sanctionsSection);
    }

    if (category === 'moderation') {
        return embed
            .setColor(0xe74c3c)
            .setTitle('🛡️ Sécurité, Salons & Tribunal')
            .setDescription(moderationSection);
    }

    if (category === 'gestion') {
        return embed
            .setColor(0x3498db)
            .setTitle('🧰 Gestion & Communauté')
            .setDescription(gestionSection);
    }

    if (category === 'all') {
        return embed
            .setColor(0xe67e22)
            .setTitle('📋 Toutes les commandes Modération')
            .setDescription(`${sanctionsSection}\n\n${moderationSection}\n\n${gestionSection}`);
    }

    return embed.setTitle('❓ Inconnu').setDescription('Catégorie introuvable.');
}

function buildHelpmMenu(authorId, currentCategory = 'home', originalMessageId = '') {
    return new StringSelectMenuBuilder()
        .setCustomId(`helpm_menu_${authorId}_${originalMessageId}`)
        .setPlaceholder('Choisis une thématique modo...')
        .addOptions(
            {
                label: 'Sanctions & Casier',
                description: 'Bannir, unban, kick, mute, unmute, warn, warns & unwarn',
                emoji: '⚖️',
                value: 'sanctions',
                default: currentCategory === 'sanctions'
            },
            {
                label: 'Sécurité, Salons & Tribunal',
                description: 'Tribunal, archives, lock/unlock, slowmode, prune & chut',
                emoji: '🛡️',
                value: 'moderation',
                default: currentCategory === 'moderation'
            },
            {
                label: 'Gestion & Communauté',
                description: 'Up, anniversaires des membres & quotes remove',
                emoji: '🧰',
                value: 'gestion',
                default: currentCategory === 'gestion'
            },
            {
                label: 'Tout afficher',
                description: 'Toutes les commandes modérateurs sur une seule page',
                emoji: '📋',
                value: 'all',
                default: currentCategory === 'all'
            }
        );
}

function buildHelpmButtons(authorId, currentCategory = 'home', originalMessageId = '') {
    const row = new ActionRowBuilder();

    if (currentCategory !== 'home') {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`helpm_home_${authorId}_${originalMessageId}`)
                .setLabel('Accueil')
                .setEmoji('🏠')
                .setStyle(ButtonStyle.Secondary)
        );
    }

    row.addComponents(
        new ButtonBuilder()
            .setCustomId(`helpm_delete_${authorId}_${originalMessageId}`)
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
            `🃏 **RegaDex (TCG)**\n` +
            `-# Boosters, classeur, Store, flex & échanges de cartes.\n` +
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
                `Tente ta chance toutes les 15 minutes pour remporter des bonus ou subir des malus éphémères *(avec ou sans espace : \`!rltgo\`, \`!rlt state\`, \`!rltstate\`...)*.\n` +
                `-# ⏱️ Cooldown réduit à **5 min en Happy Hour (20h00)** • Fiches en **version imagée Canvas** (switch texte dispo) !\n\n` +
                `\`!rlt\` • Ouvrir le Hub de la roulette *(ou \`!rlt go\` / \`!rltgo\` pour tirer direct)*\n` +
                `\`!rlt claim\` • Ouvrir ton inventaire *(boucliers, relances & récompenses)*\n` +
                `\`!rlt state [@membre]\` • Carte Canvas de tes effets & malus actifs\n` +
                `\`!rlt stats [@membre]\` • Carte Canvas du bilan complet de tes tirages\n` +
                `\`!rlt succes [@membre]\` • Galerie Canvas des **30 succès** *(10 par page)*\n` +
                `\`!rlttop\` • Podium & classements *(Succès, Tirages, Bonus, Malus)*\n` +
                `\`!rlt probas\` • Table complète des probabilités par onglets\n\n` +
                `### 🎫 Le Battle Pass Mensuel\n` +
                `Accomplis tes quêtes quotidiennes et hebdos pour débloquer 25 paliers de récompenses.\n\n` +
                `\`!bp\` *(ou \`!pass\`)* • Ouvrir ton Battle Pass de la saison\n` +
                `-# 🎁 Astuce : Le bouton **Tout récupérer** sous ton pass te permet d'encaisser tous tes paliers débloqués en un clic !`
            );
    }

    // 1b. REGADEX (TCG)
    if (category === 'tcg') {
        return embed
            .setColor(0xf1c40f)
            .setTitle('🃏 RegaDex — Jeu de Cartes (TCG)')
            .setDescription(
                `Collectionne les **109 cartes** du **Set 1 - Vestiges Regaïens** dans <#1572007962199851059> !\n` +
                `-# 🔒 Accès : Nécessite le rôle <@&1572007430152261672> *(toutes les commandes existent aussi sous \`/regadex\`)*. \n\n` +
                `### 🎁 Boosters, Store & Inventaire\n` +
                `\`!regadex\` *(ou \`!rgdx\` / \`!tcg\`)* • Hub principal RegaDex *(toutes les commandes marchent avec ou sans espace)*\n` +
                `\`!regadex open\` *(ou \`!tcggo\` / \`!tcgbooster\` / \`!open\`)* • Ouvrir un booster *(1/6h max 2 + 1/lundi 8h)*\n` +
                `\`!regadex store\` • Acheter boosters et bonus avec tes points RegaDex\n` +
                `\`!tcgclaim\` *(ou \`!regadex claim\`)* • Inventaire, achats & boosters du vendredi 8h *(max 2/2)*\n` +
                `\`!regadex notif\` • Configurer tes notifications de boosters *(choix permanent)*\n\n` +
                `### 📖 Collection, Wishlist, Échanges & Flex\n` +
                `\`!classeur [@membre]\` *(ou \`!collection\`)* • Classeur Canvas *(filtres Tout / Possédées / Doublons)*\n` +
                `\`!carte [N° ou nom]\` • Inspecter une carte & voir **qui l'a en doublon**\n` +
                `\`!wishlist\` *(\`!tcgwishlist\`)* • Gérer tes **5 cartes recherchées** *(prioritaires en \`!trade\`)*\n` +
                `\`!trade [@membre]\` *(ou Clic droit → Applications)* • Échanger jusqu'à 3 cartes *(+3 pts 1×/fil)*\n` +
                `\`!regadex top\` • Classements Total de cartes & Complétion Set 1 - Vestiges Regaïens\n` +
                `\`!tcg flex [@membre]\` *(<#1572007962199851059> & <#720079691041472572>)* • Montrer sa carte préférée`
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
                `\`!checklist\` • Gère tes checklists interactives *(créer, cocher et rayer les tâches)*\n` +
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
                label: 'RegaDex (TCG)',
                description: 'Set 1 - Vestiges Regaïens, classeur, Store, flex & échanges',
                emoji: '🃏',
                value: 'tcg',
                default: currentCategory === 'tcg'
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

    if (command === "!helpm") {
        return { needsHelpm: true };
    }

    return null;
}

// =========================
//   COMMANDES (messages)
// =========================

async function runHelpMessage(message, response) {
    // !helpx (Epsys-Only)
    if (response?.needsHelpx) {
        if (message.author.id !== EPSYS_ID) {
            return message.reply("Tu n'es pas autorisé(e) à faire cette commande.");
        }
        const botAvatarUrl = message.client?.user?.displayAvatarURL({ dynamic: true });
        const embed = buildHelpxHomeEmbed(message.author, botAvatarUrl);
        const menuRow = new ActionRowBuilder().addComponents(buildHelpxMenu(message.author.id, 'home', message.id));
        const btnRow = buildHelpxButtons(message.author.id, 'home', message.id);
        return message.reply({ embeds: [embed], components: [menuRow, btnRow] });
    }

    // !helpm (Modos + Epsys)
    if (response?.needsHelpm) {
        const isAllowed = message.author.id === EPSYS_ID || message.member?.roles?.cache?.has(MODO_ROLE_ID);
        if (!isAllowed) {
            return message.reply("Tu n'es pas autorisé(e) à faire cette commande.");
        }
        const botAvatarUrl = message.client?.user?.displayAvatarURL({ dynamic: true });
        const embed = buildHelpmHomeEmbed(message.author, botAvatarUrl);
        const menuRow = new ActionRowBuilder().addComponents(buildHelpmMenu(message.author.id, 'home', message.id));
        const btnRow = buildHelpmButtons(message.author.id, 'home', message.id);
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

    // 2d. Menu déroulant Modération (!helpm)
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('helpm_menu_')) {
        const parts = interaction.customId.split('_');
        const authorId = parts[2];
        const originalMessageId = parts[3] || '';
        if (interaction.user.id !== authorId) {
            return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true });
        }

        const category = interaction.values[0];
        const embed = buildHelpmCategoryEmbed(category, interaction.user, botAvatarUrl);
        const menuRow = new ActionRowBuilder().addComponents(buildHelpmMenu(authorId, category, originalMessageId));
        const btnRow = buildHelpmButtons(authorId, category, originalMessageId);
        return interaction.update({ embeds: [embed], components: [menuRow, btnRow] });
    }

    // 2e. Bouton Retour Accueil (!helpm)
    if (interaction.isButton() && interaction.customId.startsWith('helpm_home_')) {
        const parts = interaction.customId.split('_');
        const authorId = parts[2];
        const originalMessageId = parts[3] || '';
        if (interaction.user.id !== authorId) {
            return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true });
        }

        const embed = buildHelpmHomeEmbed(interaction.user, botAvatarUrl);
        const menuRow = new ActionRowBuilder().addComponents(buildHelpmMenu(authorId, 'home', originalMessageId));
        const btnRow = buildHelpmButtons(authorId, 'home', originalMessageId);
        return interaction.update({ embeds: [embed], components: [menuRow, btnRow] });
    }

    // 2f. Bouton Supprimer / Fermer (!helpm)
    if (interaction.isButton() && interaction.customId.startsWith('helpm_delete_')) {
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
    const cmd = message.content?.trim().split(/\s+/)[0]?.toLowerCase();
    if (cmd === '!helpm') {
        await runHelpMessage(message, { ...response, needsHelpm: true });
        return true;
    }

    if (!response?.needsHelpm && !response?.needsHelpx && !response?.data && !response?.needsHelp) return false;
    await runHelpMessage(message, response);
    return true;
}

async function handleHelpInteraction(interaction) {
    const isSlashHelp = interaction.isChatInputCommand && interaction.isChatInputCommand() && interaction.commandName === 'help';
    const isHelpComponent = (interaction.isButton() || interaction.isStringSelectMenu()) && /^help[xm]?_/.test(interaction.customId);

    if (!isSlashHelp && !isHelpComponent) return false;
    await runHelpInteraction(interaction);
    return true;
}

module.exports = { getHelpResponse, handleHelpMessage, handleHelpInteraction };