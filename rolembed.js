/**
 * Module Rôles & Catégories Interactives pour Cacabot
 * Commande Epsys-only : !rolembed
 * Rôles détaillés dans des panneaux privés éphémères
 */

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const EPSYS_ID = '436218312574107658';
const HEADER_IMAGE_URL = 'https://cdn.discordapp.com/attachments/1480756332373213275/1556919172556922990/roles.png';

// Données des catégories et rôles
const ROLE_CATEGORIES = {
    mentions: {
        titre: "1. RÔLES MENTIONNÉS",
        couleur: 0xe74c3c,
        description: 
            "Les rôles ci-dessous peuvent souvent être mentionnés dans certains salons, mais ils sont peut-être ceux qui vous intéresseront le plus !\n" +
            "═══════════════════════════════════════\n\n" +
            "[ 📢 ]\n" +
            "• **1. Le rôle <@&855782754108309524> pour être au courant des mises à jour du serveur dans <#720057528351850547> :**\n" +
            "> Les mentions y sont peu fréquentes, mais toujours importantes si vous comptez rester sur le long terme dans le serveur\n\n" +
            "[ ▶️ ]\n" +
            "• **2. Le rôle d'<@&844839770894893056> :**\n" +
            "> Pour être à la page sur toutes les sorties de mes chaînes YouTube dans le salon <#730795053563248640>\n\n" +
            "[ 👁️ ]\n" +
            "• **3. Le rôle de <@&862058765674741760> :**\n" +
            "> Pour recevoir chaque ping du salon <#862253918583390238> lorsqu'un stream a lieu sur la chaîne Twitch\n" +
            "═══════════════════════════════════════",
        roles: [
            { id: '855782754108309524', label: 'Mentions', emoji: '📍' },
            { id: '844839770894893056', label: 'Abonné.e', emoji: '▶️' },
            { id: '862058765674741760', label: 'Viewer.euse', emoji: '👁️' }
        ]
    },
    pronoms: {
        titre: "2. PRONOMS",
        couleur: 0x9b59b6,
        description:
            "Peut-être les rôles les plus importants. Ils vous permettent de montrer au public vos pronoms afin que vous vous sentiez plus en sécurité et que personne ne se trompe en discutant avec vous.\n" +
            "═══════════════════════════════════════\n\n" +
            "[ ♂️ ]\n" +
            "• **1. <@&1466013945826508952> :**\n" +
            "> He/Him | Il/Lui\n\n" +
            "[ ♀️ ]\n" +
            "• **2. <@&1466014641195847834> :**\n" +
            "> She/Her | Elle\n\n" +
            "[ ⚧️ ]\n" +
            "• **3. <@&1466014803876122685> :**\n" +
            "> They/Them | Iel/Le.a\n\n" +
            "[ ✳️ ]\n" +
            "• **4. <@&1466015187919310861> :**\n" +
            "> Pour tous les autres pronoms non cités ci-dessus (ex : Ael / ul / ol / etc.)\n" +
            "═══════════════════════════════════════",
        roles: [
            { id: '1466013945826508952', label: 'He/Him', emoji: '♂️' },
            { id: '1466014641195847834', label: 'She/Her', emoji: '♀️' },
            { id: '1466014803876122685', label: 'They/Them', emoji: '⚧️' },
            { id: '1466015187919310861', label: 'Neopronoms', emoji: '✳️' }
        ]
    },
    salons: {
        titre: "3. RÔLES DE SALON",
        couleur: 0x3498db,
        description:
            "Tous les rôles de cette liste sont utiles si vous souhaitez recevoir des mentions ou être associé.e aux salons correspondants :\n" +
            "═══════════════════════════════════════\n\n" +
            "[ 🌈 ]\n" +
            "• **1. Le rôle <@&1343366711688036374> :**\n" +
            "> Pour avoir accès au salon <#1343364919512273039> lorsque vous dépassez le niveau de serveur 5 (= 500 messages)\n" +
            "> Un salon dédié aux conversations sur le thème des **LGBT**, de la politique, de la santé mentale et de l'identité\n\n" +
            "[ 🔍 ]\n" +
            "• **2. Le rôle d'<@&1343543129055297628> :**\n" +
            "> Pour être associé.e au salon <#1324878635219292170> ouvert à tous publics\n" +
            "> Un salon où ont lieu des enquêtes et des analyses sur des mystères d'internet, de nouveaux **ARG**, de sites étranges et des histoires intrigantes\n\n" +
            "[ ⚔️ ]\n" +
            "• **3. Le rôle d'<@&1514179579835584602> :**\n" +
            "> Si vous êtes habitué.e du jeu **League of Legends**, vous pouvez vous rendre dans le salon <#1556846852664729680>\n" +
            "> Toujours ouvert si vous souhaitez trouver un groupe, des ami.es avec qui jouer ou partager des memes\n\n" +
            "[ ⛏️ ]\n" +
            "• **4. Le rôle de <@&1521832711336235041> :**\n" +
            "> Pour montrer votre intérêt pour **Minecraft** et rechercher un groupe dans le salon <#1494342240053756068> (ouvert à tout le monde)\n" +
            "═══════════════════════════════════════",
        roles: [
            { id: '1343366711688036374', label: 'LGBT-friendly', emoji: '🌈' },
            { id: '1343543129055297628', label: 'Enquêteur.ice', emoji: '🔍' },
            { id: '1514179579835584602', label: 'Invocateur.ice', emoji: '⚔️' },
            { id: '1521832711336235041', label: 'Minecraftien.ne', emoji: '⛏️' }
        ]
    },
    jeux: {
        titre: "4. MINI-JEUX & ROULETTE",
        couleur: 0xf1c40f,
        description:
            "Ces rôles vous alertent dès le lancement d'une session de jeu sur le serveur !\n" +
            "═══════════════════════════════════════\n\n" +
            "[ 🎰 ]\n" +
            "• **1. Le rôle <@&1558968669751615528> :**\n" +
            "> Reçoit les alertes spéciales et les lancements d'Happy Hour dans le salon <#1553954760900608091>\n\n" +
            "[ 🟨 ]\n" +
            "• **2. Le rôle <@&1558966826564845590> :**\n" +
            "> Ping automatique chaque jour à **10h00** (6 lettres) et **19h00** (7 lettres) dans <#1559041936256409650>\n\n" +
            "[ 🧩 ]\n" +
            "• **3. Le rôle <@&1559041004114542592> :**\n" +
            "> Ping automatique chaque jour à **15h00** pour le Rébus Regaïen (5 manches de 5 min) dans <#1556089022718152764>\n\n" +
            "[ 🪢 ]\n" +
            "• **4. Le rôle <@&1559041461230505994> :**\n" +
            "> Ping automatique tous les soirs à **21h00** pour la session quotidienne du Pendu dans <#1559041872868024370>\n" +
            "═══════════════════════════════════════",
        roles: [
            { id: '1558968669751615528', label: 'Addict Gambling', emoji: '🎰' },
            { id: '1558966826564845590', label: 'Fan de Motus', emoji: '🟨' },
            { id: '1559041004114542592', label: 'Rébusien.ne', emoji: '🧩' },
            { id: '1559041461230505994', label: 'Exécuteur.ice', emoji: '🪢' }
        ]
    }
};

function buildRoleEmbedPrincipal() {
    return new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle('ARBOREZ LES RÔLES QUI VOUS PLAISENT')
        .setImage(HEADER_IMAGE_URL)
        .setDescription(
            `╔══════════════════════════════════════════════╗\n\n` +
            `• 👏 **Bienvenue dans le salon des rôles :**\n` +
            `  ◦ *Ici, vous pourrez y sélectionner tous les rôles qui vous intéressent et que vous voudriez avoir en décoration sur votre profil de serveur !*\n\n` +
            `• 📜 **Une liste complète de rôles est disponible pour tous.tes les membres du serveur :**\n` +
            `  ◦ *Servez-vous, il n'y a aucune limite de rôles.*\n\n` +
            `╚══════════════════════════════════════════════╝\n\n` +
            `👇 **Cliquez sur une catégorie ci-dessous pour ouvrir votre panneau privé :**`
        )
        .setFooter({ text: 'Regaïa • Vos choix s\'ouvrent dans un menu privé interactif' });
}

function buildMainCategoryRows() {
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('rolecat_mentions').setLabel('📢 1. Rôles Mentionnés').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('rolecat_pronoms').setLabel('👤 2. Pronoms').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('rolecat_salons').setLabel('💬 3. Rôles de Salon').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('rolecat_jeux').setLabel('🎮 4. Mini-Jeux & Casino').setStyle(ButtonStyle.Success)
        )
    ];
}

function buildCategoryEphemeralPayload(member, catKey) {
    const cat = ROLE_CATEGORIES[catKey];
    if (!cat) return null;

    const embed = new EmbedBuilder()
        .setColor(cat.couleur)
        .setTitle(cat.titre)
        .setDescription(cat.description)
        .setFooter({ text: 'Clique sur un bouton pour t\'attribuer ou retirer le rôle • Visible uniquement par toi' });

    const buttons = cat.roles.map(r => {
        const hasRole = member.roles.cache.has(r.id);
        return new ButtonBuilder()
            .setCustomId(`roletoggle_${catKey}_${r.id}`)
            .setLabel(hasRole ? `✅ ${r.label}` : r.label)
            .setEmoji(r.emoji)
            .setStyle(hasRole ? ButtonStyle.Success : ButtonStyle.Secondary);
    });

    const rows = [];
    for (let i = 0; i < buttons.length; i += 5) {
        rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
    }

    return { embeds: [embed], components: rows };
}

// ==========================================
//  HANDLERS MESSAGES & INTERACTIONS
// ==========================================

async function handleRolembedMessage(message) {
    const raw = message.content.trim().toLowerCase();
    if (raw !== '!rolembed') return false;

    if (message.author.id !== EPSYS_ID) {
        await message.reply("Cette commande est réservée à Epsys.");
        return true;
    }

    await message.delete().catch(() => {});
    await message.channel.send({
        embeds: [buildRoleEmbedPrincipal()],
        components: buildMainCategoryRows()
    });
    return true;
}

async function handleRolembedInteraction(interaction) {
    if (!interaction.isButton()) return false;
    const customId = interaction.customId;

    // 1. Clic sur une catégorie principale -> Ouvre le panneau éphémère privé avec deferReply immédiat (anti-timeout)
    if (customId.startsWith('rolecat_')) {
        await interaction.deferReply({ ephemeral: true });
        const catKey = customId.replace('rolecat_', '');
        const payload = buildCategoryEphemeralPayload(interaction.member, catKey);
        if (payload) {
            await interaction.editReply(payload);
            return true;
        }
    }

    // 2. Clic sur un bouton de rôle à l'intérieur du panneau privé -> Toggle le rôle
    if (customId.startsWith('roletoggle_')) {
        const parts = customId.split('_');
        const catKey = parts[1];
        const roleId = parts[2];

        const role = interaction.guild?.roles.cache.get(roleId);
        if (!role) {
            await interaction.reply({ content: "❌ Ce rôle est introuvable !", ephemeral: true });
            return true;
        }

        const member = interaction.member;
        const hasRole = member.roles.cache.has(roleId);

        if (hasRole) {
            await member.roles.remove(roleId).catch(() => {});
        } else {
            await member.roles.add(roleId).catch(() => {});
        }

        // On rafraîchit immédiatement le panneau éphémère
        await interaction.guild.members.fetch(member.id);
        const updatedPayload = buildCategoryEphemeralPayload(member, catKey);
        await interaction.update(updatedPayload);
        return true;
    }

    return false;
}

module.exports = {
    handleRolembedMessage,
    handleRolembedInteraction
};