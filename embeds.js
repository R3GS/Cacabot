/**
 * Module Gestionnaire d'Embeds pour Cacabot
 * Réservé à Epsys (ID: 436218312574107658)
 */

const {
    EmbedBuilder,
    ActionRowBuilder,
    ChannelSelectMenuBuilder,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ButtonBuilder,
    ChannelType,
    ButtonStyle
} = require('discord.js');

const EPSYS_ID = '436218312574107658';
const TRANSPARENT_SPACER_URL = 'https://cdn.discordapp.com/attachments/1480756332373213275/1556870914334007427/Blank.png';
const embedDrafts = new Map(); // userId -> draftData

function parseEmbedColor(colorStr) {
    if (!colorStr) return 0x5865f2;
    const c = colorStr.trim().toLowerCase();
    const map = {
        bleu: 0x3498db, rouge: 0xeb0000, vert: 0x2ecc71, or: 0xffd700, jaune: 0xf1c40f,
        violet: 0x9b59b6, noir: 0x2c2c2c, blanc: 0xffffff, orange: 0xe67e22, rose: 0xff69b4
    };
    if (map[c]) return map[c];
    if (c.startsWith('#')) {
        const num = parseInt(c.replace('#', ''), 16);
        if (!isNaN(num)) return num;
    }
    const num = parseInt(c, 16);
    if (!isNaN(num)) return num;
    return 0x5865f2;
}

function buildEmbedMainModal(existingData = null) {
    const modal = new ModalBuilder()
        .setCustomId(`embed_main_modal_${Date.now()}`)
        .setTitle("Texte principal & Couleur");

    const titleInput = new TextInputBuilder()
        .setCustomId('embed_title')
        .setLabel("Titre de l'embed")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ex : Annonce importante")
        .setRequired(false);
    if (existingData?.titre && existingData.titre.trim().length > 0) {
        titleInput.setValue(existingData.titre);
    }

    const descInput = new TextInputBuilder()
        .setCustomId('embed_desc')
        .setLabel("Description / Contenu (optionnel)")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Le texte principal de ton embed...")
        .setRequired(false);
    if (existingData?.desc && existingData.desc.trim().length > 0) {
        descInput.setValue(existingData.desc);
    }

    const colorInput = new TextInputBuilder()
        .setCustomId('embed_color')
        .setLabel("Couleur (Hex ou nom)")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ex : #eb0000 ou bleu, rouge, or, vert, rose...")
        .setRequired(false);
    if (existingData?.couleurRaw && existingData.couleurRaw.trim().length > 0) {
        colorInput.setValue(existingData.couleurRaw);
    }

    const footerInput = new TextInputBuilder()
        .setCustomId('embed_footer')
        .setLabel("Pied de page (Footer en bas)")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ex : L'équipe de Regaïa")
        .setRequired(false);
    if (existingData?.footer && existingData.footer.trim().length > 0) {
        footerInput.setValue(existingData.footer);
    }

    modal.addComponents(
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(descInput),
        new ActionRowBuilder().addComponents(colorInput),
        new ActionRowBuilder().addComponents(footerInput)
    );
    return modal;
}

function buildEmbedImagesModal(existingData = null) {
    const modal = new ModalBuilder()
        .setCustomId(`embed_images_modal_${Date.now()}`)
        .setTitle("Images & Icônes de l'Embed");

    const imageInput = new TextInputBuilder()
        .setCustomId('embed_image')
        .setLabel("Grande image (Bannière du bas - URL)")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("https://exemple.com/image.png")
        .setRequired(false);
    if (existingData?.image) imageInput.setValue(existingData.image);

    const thumbnailInput = new TextInputBuilder()
        .setCustomId('embed_thumbnail')
        .setLabel("Miniature (Haut à droite - URL)")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("https://exemple.com/logo.png")
        .setRequired(false);
    if (existingData?.thumbnail) thumbnailInput.setValue(existingData.thumbnail);

    const authorNameInput = new TextInputBuilder()
        .setCustomId('embed_author_name')
        .setLabel("Auteur (Texte en haut à gauche)")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ex : Epsys")
        .setRequired(false);
    if (existingData?.authorName) authorNameInput.setValue(existingData.authorName);

    const authorIconInput = new TextInputBuilder()
        .setCustomId('embed_author_icon')
        .setLabel("Icône Auteur (Haut à gauche - URL)")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("https://exemple.com/avatar.png")
        .setRequired(false);
    if (existingData?.authorIcon) authorIconInput.setValue(existingData.authorIcon);

    modal.addComponents(
        new ActionRowBuilder().addComponents(imageInput),
        new ActionRowBuilder().addComponents(thumbnailInput),
        new ActionRowBuilder().addComponents(authorNameInput),
        new ActionRowBuilder().addComponents(authorIconInput)
    );
    return modal;
}

function buildEmbedFieldModal(existingData = null, index = null) {
    const isEdit = index !== null && existingData !== null;
    const modal = new ModalBuilder()
        .setCustomId(isEdit ? `embed_field_modal_${index}` : 'embed_field_modal')
        .setTitle(isEdit ? `Modifier le champ #${index + 1}` : "Ajouter un champ à l'Embed");

    const nameInput = new TextInputBuilder()
        .setCustomId('field_name')
        .setLabel(isEdit ? "Titre (laisse vide pour supprimer)" : "Titre du champ")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ex : Règlement / Date de l'événement")
        .setRequired(!isEdit);
    if (existingData?.name) nameInput.setValue(existingData.name);

    const valueInput = new TextInputBuilder()
        .setCustomId('field_value')
        .setLabel("Contenu / Sous-texte du champ")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Le texte qui s'affiche sous le titre du champ...")
        .setRequired(!isEdit);
    if (existingData?.value) valueInput.setValue(existingData.value);

    const inlineInput = new TextInputBuilder()
        .setCustomId('field_inline')
        .setLabel("Aligné côte-à-côte ? (oui / non)")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("non (par défaut) ou oui")
        .setRequired(false);
    if (existingData) inlineInput.setValue(existingData.inline ? 'oui' : 'non');

    modal.addComponents(
        new ActionRowBuilder().addComponents(nameInput),
        new ActionRowBuilder().addComponents(valueInput),
        new ActionRowBuilder().addComponents(inlineInput)
    );
    return modal;
}

function buildEmbedFromDraft(draft) {
    const embed = new EmbedBuilder().setColor(parseEmbedColor(draft.couleurRaw));
    if (draft.titre) embed.setTitle(draft.titre);
    if (draft.desc) embed.setDescription(draft.desc);
    if (draft.authorName) {
        embed.setAuthor({
            name: draft.authorName,
            iconURL: (draft.authorIcon && /^https?:\/\//i.test(draft.authorIcon)) ? draft.authorIcon : undefined
        });
    }
    if (draft.thumbnail && /^https?:\/\//i.test(draft.thumbnail)) embed.setThumbnail(draft.thumbnail);
    if (draft.image && /^https?:\/\//i.test(draft.image)) {
        embed.setImage(draft.image);
    } else if (draft.alignerLargeur) {
        embed.setImage(TRANSPARENT_SPACER_URL);
    }
    if (draft.fields && draft.fields.length > 0) {
        embed.addFields(draft.fields.map(f => ({ name: f.name, value: f.value, inline: f.inline ?? false })));
    }
    if (draft.footer) embed.setFooter({ text: draft.footer });
    if (draft.hasTimestamp) embed.setTimestamp();
    return embed;
}

async function trouverMessageCacabot(guild, salonActuel, messageId) {
    let target = await salonActuel.messages.fetch(messageId).catch(() => null);
    if (!target && guild) {
        for (const salon of guild.channels.cache.values()) {
            if (salon.isTextBased()) {
                target = await salon.messages.fetch(messageId).catch(() => null);
                if (target) break;
            }
        }
    }
    return target;
}

function rehydraterEmbedDepuisMessage(targetMsg, embedIndex = 0) {
    const exEmbed = targetMsg.embeds[embedIndex] ?? targetMsg.embeds[0];
    let couleurHex = '';
    if (exEmbed.color !== null && exEmbed.color !== undefined) {
        couleurHex = '#' + exEmbed.color.toString(16).padStart(6, '0');
    }
    const estSpacer = exEmbed.image?.url === TRANSPARENT_SPACER_URL;

    return {
        titre: exEmbed.title || '',
        desc: exEmbed.description || '',
        couleurRaw: couleurHex,
        footer: exEmbed.footer?.text || '',
        authorName: exEmbed.author?.name || '',
        authorIcon: exEmbed.author?.iconURL || '',
        thumbnail: exEmbed.thumbnail?.url || '',
        image: estSpacer ? '' : (exEmbed.image?.url || ''),
        alignerLargeur: estSpacer,
        fields: exEmbed.fields ? exEmbed.fields.map(f => ({ name: f.name, value: f.value, inline: f.inline ?? false })) : [],
        hasTimestamp: Boolean(exEmbed.timestamp),
        editingMessage: {
            channelId: targetMsg.channel.id,
            messageId: targetMsg.id,
            embedIndex: embedIndex
        }
    };
}

function buildEmbedControlRows(draft) {
    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('embed_send_channel')
        .setPlaceholder(draft.editingMessage ? 'Envoyer une copie dans un autre salon...' : 'Choisis le salon où envoyer cet embed...')
        .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);

    const editMainBtn = new ButtonBuilder().setCustomId('embed_edit_main').setLabel('✏️ Texte & Couleur').setStyle(ButtonStyle.Primary);
    const editImagesBtn = new ButtonBuilder().setCustomId('embed_edit_images').setLabel('🖼️ Images & Icônes').setStyle(ButtonStyle.Secondary);
    const addFieldBtn = new ButtonBuilder().setCustomId('embed_add_field').setLabel('➕ Ajouter un champ').setStyle(ButtonStyle.Success);
    const toggleTimeBtn = new ButtonBuilder().setCustomId('embed_toggle_time').setLabel(draft.hasTimestamp ? '🕒 Retirer Date/Heure' : '🕒 Ajouter Date/Heure').setStyle(draft.hasTimestamp ? ButtonStyle.Primary : ButtonStyle.Secondary);
    const toggleAlignBtn = new ButtonBuilder().setCustomId('embed_toggle_align').setLabel(draft.alignerLargeur ? '📏 Plein format : OUI' : '📏 Plein format : NON').setStyle(draft.alignerLargeur ? ButtonStyle.Primary : ButtonStyle.Secondary);
    const cancelBtn = new ButtonBuilder().setCustomId('embed_cancel_draft').setLabel('❌ Annuler').setStyle(ButtonStyle.Danger);

    const row1 = new ActionRowBuilder().addComponents(channelSelect);
    const row2 = new ActionRowBuilder().addComponents(editMainBtn, editImagesBtn, addFieldBtn, toggleTimeBtn, toggleAlignBtn);
    const row3 = new ActionRowBuilder();

    if (draft.editingMessage) {
        row3.addComponents(
            new ButtonBuilder().setCustomId('embed_save_edit').setLabel('💾 Mettre à jour le message').setStyle(ButtonStyle.Success)
        );
    }
    if (draft.fields && draft.fields.length > 0) {
        row3.addComponents(
            new ButtonBuilder().setCustomId('embed_edit_field').setLabel('✏️ Modifier un champ').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('embed_clear_fields').setLabel(`🗑️ Vider les champs (${draft.fields.length})`).setStyle(ButtonStyle.Secondary)
        );
    }
    row3.addComponents(cancelBtn);

    return [row1, row2, row3];
}

async function handleEmbedMessage(message, response, client) {
    const isEpsys = message.author.id === EPSYS_ID;
    const command = message.content.trim().split(/\s+/)[0]?.toLowerCase();

    if (command !== '!embed' && !response?.needsEmbed) return false;
    if (!isEpsys) return true;

    const argsEmbed = message.content.trim().split(/\s+/);
    const subEmbed = argsEmbed[1]?.toLowerCase();

    if (subEmbed === 'modify' || subEmbed === 'edit') {
        const rawId = argsEmbed[2];
        if (!rawId) {
            await message.reply("Usage : `!embed modify [ID_du_message] [numéro optionnel]`");
            return true;
        }
        const msgId = rawId.replace(/^.*\/([0-9]+)$/, '$1');
        const targetMsg = await trouverMessageCacabot(message.guild, message.channel, msgId);

        if (!targetMsg) { await message.reply("Message introuvable ! Vérifie l'ID."); return true; }
        if (targetMsg.author.id !== client.user.id) { await message.reply("Ce message n'a pas été envoyé par Cacabot !"); return true; }
        if (!targetMsg.embeds || targetMsg.embeds.length === 0) { await message.reply("Ce message ne contient aucun embed !"); return true; }

        let indexChoisi = 0;
        if (argsEmbed[3] && !isNaN(parseInt(argsEmbed[3], 10))) {
            indexChoisi = Math.max(0, parseInt(argsEmbed[3], 10) - 1);
        }

        if (targetMsg.embeds.length > 1 && !argsEmbed[3]) {
            const boutonsEmbeds = targetMsg.embeds.slice(0, 5).map((emb, idx) => {
                const labelNom = emb.title ? emb.title.slice(0, 25) : (emb.description ? emb.description.slice(0, 25) : `Embed #${idx + 1}`);
                return new ButtonBuilder()
                    .setCustomId(`embed_pick_idx_${targetMsg.channel.id}_${targetMsg.id}_${idx}`)
                    .setLabel(`Embed #${idx + 1} : ${labelNom}`)
                    .setStyle(ButtonStyle.Primary);
            });

            await message.reply({
                content: `📋 **Ce message contient ${targetMsg.embeds.length} embeds.** Lequel souhaites-tu modifier ?`,
                components: [new ActionRowBuilder().addComponents(boutonsEmbeds)]
            });
            return true;
        }

        const draft = rehydraterEmbedDepuisMessage(targetMsg, indexChoisi);
        embedDrafts.set(message.author.id, draft);

        const embedPreview = buildEmbedFromDraft(draft);
        await message.reply({
            content: `✏️ **Mode modification actif pour l'embed #${indexChoisi + 1} du message [${targetMsg.id}](${targetMsg.url}) !**`,
            embeds: [embedPreview],
            components: buildEmbedControlRows(draft)
        });
        return true;
    }

    embedDrafts.delete(message.author.id);
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('open_embed_modal').setLabel('📝 Ouvrir le formulaire d\'embed').setStyle(ButtonStyle.Primary)
    );
    await message.reply({ content: "Clique ci-dessous pour ouvrir le créateur d'embed :", components: [row] });
    return true;
}

async function handleEmbedSlash(interaction, client) {
    if (interaction.commandName !== 'embed') return false;
    if (interaction.user.id !== EPSYS_ID) {
        await interaction.reply({ content: "Cette commande est réservée à Epsys.", ephemeral: true });
        return true;
    }

    const msgIdOption = interaction.options.getString('modifier')?.trim();
    if (msgIdOption) {
        const targetMsg = await trouverMessageCacabot(interaction.guild, interaction.channel, msgIdOption);
        if (!targetMsg) { await interaction.reply({ content: "Message introuvable ! Vérifie l'ID.", ephemeral: true }); return true; }
        if (targetMsg.author.id !== client.user.id) { await interaction.reply({ content: "Ce message n'a pas été envoyé par Cacabot !", ephemeral: true }); return true; }
        if (!targetMsg.embeds || targetMsg.embeds.length === 0) { await interaction.reply({ content: "Ce message ne contient aucun embed !", ephemeral: true }); return true; }

        const draft = rehydraterEmbedDepuisMessage(targetMsg);
        embedDrafts.set(interaction.user.id, draft);

        const embedPreview = buildEmbedFromDraft(draft);
        await interaction.reply({
            content: `✏️ **Mode modification actif pour le message [${targetMsg.id}](${targetMsg.url}) !**`,
            embeds: [embedPreview],
            components: buildEmbedControlRows(draft)
        });
        return true;
    }

    const draft = embedDrafts.get(interaction.user.id) ?? { fields: [], hasTimestamp: false };
    await interaction.showModal(buildEmbedMainModal(draft));
    return true;
}

async function handleEmbedInteraction(interaction, client) {
    const customId = interaction.customId;
    if (!customId) return false;

    // 1. Bouton initial ouverture formulaire
    if (interaction.isButton() && customId === 'open_embed_modal') {
        if (interaction.user.id !== EPSYS_ID) {
            await interaction.reply({ content: "Ce bouton est réservé à Epsys.", ephemeral: true });
            return true;
        }
        const draft = embedDrafts.get(interaction.user.id) ?? { fields: [], hasTimestamp: false };
        await interaction.showModal(buildEmbedMainModal(draft));
        return true;
    }

    // 2. Boutons de navigation/édition
    if (interaction.isButton() && customId === 'embed_edit_main') {
        if (interaction.user.id !== EPSYS_ID) return true;
        const draft = embedDrafts.get(interaction.user.id) ?? { fields: [], hasTimestamp: false };
        await interaction.showModal(buildEmbedMainModal(draft));
        return true;
    }

    if (interaction.isButton() && customId === 'embed_edit_images') {
        if (interaction.user.id !== EPSYS_ID) return true;
        const draft = embedDrafts.get(interaction.user.id) ?? { fields: [], hasTimestamp: false };
        await interaction.showModal(buildEmbedImagesModal(draft));
        return true;
    }

    if (interaction.isButton() && customId === 'embed_add_field') {
        if (interaction.user.id !== EPSYS_ID) return true;
        await interaction.showModal(buildEmbedFieldModal());
        return true;
    }

    if (interaction.isButton() && customId === 'embed_toggle_time') {
        if (interaction.user.id !== EPSYS_ID) return true;
        const draft = embedDrafts.get(interaction.user.id) ?? { fields: [], hasTimestamp: false };
        draft.hasTimestamp = !draft.hasTimestamp;
        embedDrafts.set(interaction.user.id, draft);
        await interaction.update({ content: "👀 **Aperçu en direct de ton embed :**", embeds: [buildEmbedFromDraft(draft)], components: buildEmbedControlRows(draft) });
        return true;
    }

    if (interaction.isButton() && customId === 'embed_toggle_align') {
        if (interaction.user.id !== EPSYS_ID) return true;
        const draft = embedDrafts.get(interaction.user.id) ?? { fields: [], hasTimestamp: false };
        draft.alignerLargeur = !draft.alignerLargeur;
        embedDrafts.set(interaction.user.id, draft);
        await interaction.update({ content: "👀 **Aperçu en direct de ton embed :**", embeds: [buildEmbedFromDraft(draft)], components: buildEmbedControlRows(draft) });
        return true;
    }

    if (interaction.isButton() && customId === 'embed_clear_fields') {
        if (interaction.user.id !== EPSYS_ID) return true;
        const draft = embedDrafts.get(interaction.user.id) ?? { fields: [], hasTimestamp: false };
        draft.fields = [];
        embedDrafts.set(interaction.user.id, draft);
        await interaction.update({ content: "👀 **Aperçu en direct de ton embed (champs réinitialisés) :**", embeds: [buildEmbedFromDraft(draft)], components: buildEmbedControlRows(draft) });
        return true;
    }

    if (interaction.isButton() && customId === 'embed_cancel_draft') {
        if (interaction.user.id !== EPSYS_ID) return true;
        embedDrafts.delete(interaction.user.id);
        await interaction.update({ content: "🗑️ Création de l'embed annulée.", embeds: [], components: [] });
        return true;
    }

    if (interaction.isButton() && customId.startsWith('embed_pick_idx_')) {
        if (interaction.user.id !== EPSYS_ID) return true;
        const parts = customId.split('_');
        const channelId = parts[3];
        const messageId = parts[4];
        const idx = parseInt(parts[5], 10);
        const channel = interaction.guild?.channels.cache.get(channelId);
        const targetMsg = await channel?.messages.fetch(messageId).catch(() => null);
        if (!targetMsg) { await interaction.reply({ content: "❌ Message introuvable !", ephemeral: true }); return true; }

        const draft = rehydraterEmbedDepuisMessage(targetMsg, idx);
        embedDrafts.set(interaction.user.id, draft);
        await interaction.update({
            content: `✏️ **Mode modification actif pour l'embed #${idx + 1} du message [${targetMsg.id}](${targetMsg.url}) !**`,
            embeds: [buildEmbedFromDraft(draft)],
            components: buildEmbedControlRows(draft)
        });
        return true;
    }

    if (interaction.isButton() && customId === 'embed_save_edit') {
        if (interaction.user.id !== EPSYS_ID) return true;
        const draft = embedDrafts.get(interaction.user.id);
        if (!draft || !draft.editingMessage) {
            await interaction.reply({ content: "❌ Aucun message original lié à ce brouillon !", ephemeral: true });
            return true;
        }
        const { channelId, messageId, embedIndex = 0 } = draft.editingMessage;
        const targetChannel = interaction.guild?.channels.cache.get(channelId);
        if (!targetChannel) { await interaction.reply({ content: "❌ Salon introuvable !", ephemeral: true }); return true; }

        const targetMsg = await targetChannel.messages.fetch(messageId).catch(() => null);
        if (!targetMsg) { await interaction.reply({ content: "❌ Message introuvable !", ephemeral: true }); return true; }

        const embedFinal = buildEmbedFromDraft(draft);
        const tousLesEmbeds = [...targetMsg.embeds];
        tousLesEmbeds[embedIndex] = embedFinal;
        await targetMsg.edit({ embeds: tousLesEmbeds }).catch(err => interaction.reply({ content: `❌ Erreur : ${err.message}`, ephemeral: true }));

        embedDrafts.delete(interaction.user.id);
        await interaction.update({ content: `✅ **L'embed #${embedIndex + 1} a été mis à jour avec succès sur [le message original](${targetMsg.url}) !**`, embeds: [], components: [] });
        return true;
    }

    if (interaction.isButton() && customId === 'embed_edit_field') {
        if (interaction.user.id !== EPSYS_ID) return true;
        const draft = embedDrafts.get(interaction.user.id);
        if (!draft || !draft.fields || draft.fields.length === 0) {
            await interaction.reply({ content: "❌ Aucun champ à modifier !", ephemeral: true });
            return true;
        }
        if (draft.fields.length === 1) {
            await interaction.showModal(buildEmbedFieldModal(draft.fields[0], 0));
            return true;
        }
        const menu = new StringSelectMenuBuilder()
            .setCustomId('embed_select_field_to_edit')
            .setPlaceholder('Choisis le champ à modifier...')
            .addOptions(draft.fields.slice(0, 25).map((f, i) => ({
                label: `Champ #${i + 1} : ${f.name.slice(0, 40)}`,
                description: f.value.slice(0, 50) || 'Sans contenu',
                value: String(i)
            })));
        await interaction.reply({ content: "📝 **Quel champ souhaites-tu modifier ?**", components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
        return true;
    }

    // 3. Menus déroulants (select menus)
    if (interaction.isStringSelectMenu() && customId === 'embed_select_field_to_edit') {
        if (interaction.user.id !== EPSYS_ID) return true;
        const draft = embedDrafts.get(interaction.user.id);
        const index = parseInt(interaction.values[0], 10);
        if (!draft || !draft.fields || !draft.fields[index]) {
            await interaction.reply({ content: "❌ Champ introuvable !", ephemeral: true });
            return true;
        }
        await interaction.showModal(buildEmbedFieldModal(draft.fields[index], index));
        return true;
    }

    if (interaction.isChannelSelectMenu() && customId === 'embed_send_channel') {
        if (interaction.user.id !== EPSYS_ID) return true;
        const draft = embedDrafts.get(interaction.user.id);
        if (!draft) {
            await interaction.update({ content: "❌ Aucun brouillon d'embed trouvé ou il a expiré.", embeds: [], components: [] });
            return true;
        }
        const channelId = interaction.values[0];
        const targetChannel = interaction.guild?.channels.cache.get(channelId);
        if (!targetChannel) {
            await interaction.update({ content: "❌ Salon introuvable.", embeds: [], components: [] });
            return true;
        }
        const embedFinal = buildEmbedFromDraft(draft);
        await targetChannel.send({ embeds: [embedFinal] }).catch(err => {
            return interaction.update({ content: `❌ Erreur : ${err.message}`, embeds: [], components: [] });
        });
        embedDrafts.delete(interaction.user.id);
        await interaction.update({ content: `✅ **Embed complet envoyé avec succès dans <#${channelId}> !**`, embeds: [], components: [] });
        return true;
    }

    // 4. Soumissions de modals
    if (interaction.isModalSubmit()) {
        if (interaction.user.id !== EPSYS_ID) return true;

        if (customId.startsWith('embed_main_modal')) {
            const draft = embedDrafts.get(interaction.user.id) ?? { fields: [], hasTimestamp: false };
            draft.titre = interaction.fields.getTextInputValue('embed_title')?.trim();
            draft.desc = interaction.fields.getTextInputValue('embed_desc')?.trim();
            draft.couleurRaw = interaction.fields.getTextInputValue('embed_color')?.trim();
            draft.footer = interaction.fields.getTextInputValue('embed_footer')?.trim();
            embedDrafts.set(interaction.user.id, draft);

            const payload = {
                content: "👀 **Aperçu en direct de ton embed :**",
                embeds: [buildEmbedFromDraft(draft)],
                components: buildEmbedControlRows(draft)
            };
            if (interaction.isFromMessage()) await interaction.update(payload);
            else await interaction.reply({ ...payload, ephemeral: true });
            return true;
        }

        if (customId.startsWith('embed_images_modal')) {
            const draft = embedDrafts.get(interaction.user.id) ?? { fields: [], hasTimestamp: false };
            draft.image = interaction.fields.getTextInputValue('embed_image')?.trim();
            draft.thumbnail = interaction.fields.getTextInputValue('embed_thumbnail')?.trim();
            draft.authorName = interaction.fields.getTextInputValue('embed_author_name')?.trim();
            draft.authorIcon = interaction.fields.getTextInputValue('embed_author_icon')?.trim();
            embedDrafts.set(interaction.user.id, draft);

            await interaction.update({
                content: "👀 **Aperçu en direct de ton embed :**",
                embeds: [buildEmbedFromDraft(draft)],
                components: buildEmbedControlRows(draft)
            });
            return true;
        }

        if (customId.startsWith('embed_field_modal')) {
            const draft = embedDrafts.get(interaction.user.id) ?? { fields: [], hasTimestamp: false };
            if (!draft.fields) draft.fields = [];

            const fName = interaction.fields.getTextInputValue('field_name')?.trim();
            const fValue = interaction.fields.getTextInputValue('field_value')?.trim();
            const fInline = interaction.fields.getTextInputValue('field_inline')?.trim().toLowerCase() === 'oui';

            const isEditMatch = customId.match(/^embed_field_modal_(\d+)$/);
            if (isEditMatch) {
                const index = parseInt(isEditMatch[1], 10);
                if (!fName) draft.fields.splice(index, 1);
                else draft.fields[index] = { name: fName, value: fValue, inline: fInline };
            } else if (fName && fValue) {
                draft.fields.push({ name: fName, value: fValue, inline: fInline });
            }
            embedDrafts.set(interaction.user.id, draft);

            const payload = {
                content: "👀 **Aperçu en direct de ton embed :**",
                embeds: [buildEmbedFromDraft(draft)],
                components: buildEmbedControlRows(draft)
            };
            if (interaction.isFromMessage()) await interaction.update(payload);
            else await interaction.reply({ ...payload, ephemeral: true });
            return true;
        }
    }

    return false;
}

module.exports = {
    handleEmbedMessage,
    handleEmbedSlash,
    handleEmbedInteraction
};