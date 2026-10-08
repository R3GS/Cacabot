/**
 * Module Anniversaires pour Cacabot
 * Commandes : !anniversaire, /anniversaire et notification quotidienne
 */

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const BIRTHDAY_CHANNEL_ID = '720057528867618909';
const BIRTHDAY_GIF = 'https://cdn.discordapp.com/attachments/1128032964924670053/1505358556851863583/jdg-joueur-du-grenier.gif';

let birthdayState = {
    getBirthdayData: () => ({ birthdays: {}, channels: {} }),
    saveBirthdays: async () => {},
    findMemberByName: () => ({ found: null, multiple: false, candidates: [] }),
    askDisambiguation: () => {},
    EPSYS_ID: '436218312574107658'
};

function initBirthdayState(bridge) {
    birthdayState = { ...birthdayState, ...bridge };
}

function getGuildBirthdays(guildId) {
    const data = birthdayState.getBirthdayData();
    if (!data.birthdays[guildId]) data.birthdays[guildId] = {};
    return data.birthdays[guildId];
}

function getBirthdayChannelId(guildId) {
    const data = birthdayState.getBirthdayData();
    return data.channels[guildId] ?? BIRTHDAY_CHANNEL_ID;
}

function estAnniversaireAujourdhui(guildId, userId) {
    if (!guildId || !userId) return false;
    const data = birthdayState.getBirthdayData();
    const dateAnniv = data.birthdays[guildId]?.[userId];
    if (!dateAnniv) return false;
    const now = new Date();
    const parisNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    const today = `${String(parisNow.getDate()).padStart(2, '0')}/${String(parisNow.getMonth() + 1).padStart(2, '0')}`;
    return dateAnniv === today;
}

async function checkBirthdays(client) {
    const now = new Date();
    const parisNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    const today = `${String(parisNow.getDate()).padStart(2, '0')}/${String(parisNow.getMonth() + 1).padStart(2, '0')}`;
    const data = birthdayState.getBirthdayData();

    for (const guild of client.guilds.cache.values()) {
        const guildBirthdays = data.birthdays[guild.id] ?? {};
        for (const [userId, date] of Object.entries(guildBirthdays)) {
            if (date !== today) continue;

            const channel = guild.channels.cache.get(getBirthdayChannelId(guild.id));
            if (!channel) continue;

            if (userId === client.user.id) {
                await channel.send('JOYEUX ANNIVERSAIRE À MOI !! 🎉🎉🎉');
                await channel.send('https://cdn.discordapp.com/attachments/1480756332373213275/1506635925126512790/dance.gif');
                continue;
            }

            const member = guild.members.cache.get(userId);
            if (member?.user.bot) {
                await channel.send(`JOYEUX ANNIVERSAIRE, COLLÈGUE <@${userId}> ! 🎉\nTu fais partie des bots qui rendent ce serveur encore meilleur, alors, que ta vie reste longue et belle <3`);
                await channel.send('https://cdn.discordapp.com/attachments/1480756332373213275/1506636764771778660/cyclops-ryu.gif');
                continue;
            }

            await channel.send(`<@${userId}> JOYEUX ANNIVERSAIRE !!! 🎉🎉🎉`);
            await channel.send(BIRTHDAY_GIF);
        }
    }
}

function scheduleBirthdayCheck(client) {
    const now = new Date();
    const parisNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    const parisMidnight = new Date(parisNow);
    parisMidnight.setHours(24, 0, 0, 0);
    const delay = parisMidnight - parisNow;

    setTimeout(async () => {
        await checkBirthdays(client);
        scheduleBirthdayCheck(client);
    }, delay);
}

// =========================
//  GESTION DES MESSAGES (!)
// =========================
async function handleAnniversaireMessage(message, response) {
    const raw = message.content.trim();
    const command = raw.split(/\s+/)[0]?.toLowerCase();

    if (command !== '!anniversaire' && command !== '!anniversairetest' && !response?.needsAnniversaire) {
        return false;
    }

    const isTest = command === '!anniversairetest';
    const args = raw.split(/\s+/);
    const sub = args[1]?.toLowerCase();
    const data = birthdayState.getBirthdayData();

    if (isTest) {
        const channel = message.guild?.channels.cache.get(getBirthdayChannelId(message.guild.id));
        if (!channel) { await message.reply("Salon introuvable !"); return true; }
        await channel.send(`<@${message.author.id}> JOYEUX ANNIVERSAIRE !!! 🎉🎉🎉`);
        await channel.send(BIRTHDAY_GIF);
        return true;
    }

    if (sub === 'room') {
        if (message.author.id !== birthdayState.EPSYS_ID) {
            await message.reply("Tu n'es pas autorisé(e) à faire cette commande.");
            return true;
        }
        const channelId = args[2];
        if (!channelId || !/^\d{17,19}$/.test(channelId)) {
            await message.reply("Usage : `!anniversaire room [ID_SALON]`");
            return true;
        }
        const targetChannel = message.guild.channels.cache.get(channelId);
        if (!targetChannel) {
            await message.reply("Salon introuvable sur ce serveur !");
            return true;
        }
        data.channels[message.guild.id] = channelId;
        await birthdayState.saveBirthdays();
        await message.reply(`🎂 Les messages d'anniversaire de ce serveur seront désormais envoyés dans <#${channelId}> !`);
        return true;
    }

    if (sub === 'set') {
        const lastArg = args[args.length - 1];
        const isDate = /^\d{2}\/\d{2}$/.test(lastArg);

        if (!isDate) {
            await message.reply("Format invalide ! Utilise `!anniversaire set JJ/MM` ou `!anniversaire set Pseudo JJ/MM`");
            return true;
        }

        const date = lastArg;

        if (args.length > 3) {
            const query = args.slice(2, args.length - 1).join(" ");
            const result = birthdayState.findMemberByName(message.guild, query);
            if (result.multiple) {
                birthdayState.askDisambiguation(message, message.guild, result.candidates, async (user) => {
                    getGuildBirthdays(message.guild.id)[user.id] = date;
                    await birthdayState.saveBirthdays();
                    const nom = message.guild?.members.cache.get(user.id)?.displayName ?? user.username;
                    message.reply(`🎂 L'anniversaire de **${nom}** a été enregistré le **${date}** !`);
                });
                return true;
            }
            if (!result.found) {
                await message.reply("Membre introuvable !");
                return true;
            }
            const targetUser = result.found.user;
            const nom = message.guild?.members.cache.get(targetUser.id)?.displayName ?? targetUser.username;
            getGuildBirthdays(message.guild.id)[targetUser.id] = date;
            await birthdayState.saveBirthdays();
            await message.reply(`🎂 L'anniversaire de **${nom}** a été enregistré le **${date}** !`);
            return true;
        }

        getGuildBirthdays(message.guild.id)[message.author.id] = date;
        await birthdayState.saveBirthdays();
        await message.reply(`🎂 Ton anniversaire a été enregistré le **${date}** !`);
        return true;
    }

    if (sub === 'remove') {
        const query = args.slice(2).join(" ");
        const guildBirthdays = getGuildBirthdays(message.guild.id);

        if (!query) {
            if (!guildBirthdays[message.author.id]) {
                await message.reply("Tu n'as pas d'anniversaire enregistré !");
                return true;
            }
            delete guildBirthdays[message.author.id];
            await birthdayState.saveBirthdays();
            await message.reply("🗑️ Ton anniversaire a été supprimé !");
            return true;
        }

        const result = birthdayState.findMemberByName(message.guild, query);
        if (result.multiple) {
            birthdayState.askDisambiguation(message, message.guild, result.candidates, async (user) => {
                if (!guildBirthdays[user.id]) {
                    message.reply("Ce membre n'a pas d'anniversaire enregistré !");
                    return;
                }
                delete guildBirthdays[user.id];
                await birthdayState.saveBirthdays();
                const nom = message.guild?.members.cache.get(user.id)?.displayName ?? user.username;
                message.reply(`🗑️ L'anniversaire de **${nom}** a été supprimé !`);
            });
            return true;
        }
        if (!result.found) {
            await message.reply("Membre introuvable !");
            return true;
        }
        const targetUser = result.found.user;
        if (!guildBirthdays[targetUser.id]) {
            await message.reply("Ce membre n'a pas d'anniversaire enregistré !");
            return true;
        }
        const nom = message.guild?.members.cache.get(targetUser.id)?.displayName ?? targetUser.username;
        delete guildBirthdays[targetUser.id];
        await birthdayState.saveBirthdays();
        await message.reply(`🗑️ L'anniversaire de **${nom}** a été supprimé !`);
        return true;
    }

    if (sub === 'show') {
        let cible = message.mentions.users.first();
        if (!cible) {
            const query = args.slice(2).join(' ');
            if (query) {
                if (/^\d{17,19}$/.test(query)) {
                    cible = { id: query };
                } else {
                    const result = birthdayState.findMemberByName(message.guild, query);
                    if (result.multiple) {
                        birthdayState.askDisambiguation(message, message.guild, result.candidates, async (user) => {
                            const date = getGuildBirthdays(message.guild.id)[user.id];
                            const nom = message.guild?.members.cache.get(user.id)?.displayName ?? user.username;
                            if (!date) return message.reply(`🎂 **${nom}** n'a pas encore enregistré son anniversaire.`);
                            const [d, m] = date.split('/').map(Number);
                            const now = new Date(); const next = new Date(now.getFullYear(), m - 1, d);
                            if (next < now) next.setFullYear(now.getFullYear() + 1);
                            const diffDays = Math.ceil((next - now) / (1000 * 60 * 60 * 24));
                            const joursStr = diffDays === 0 ? "c'est aujourd'hui 🎉 !" : diffDays === 1 ? "c'est demain 🎉 !" : `dans **${diffDays} jours** !`;
                            return message.reply(`🎂 L'anniversaire de **${nom}** est le **${date}** — ${joursStr}`);
                        });
                        return true;
                    }
                    if (result.found) cible = result.found.user;
                }
            }
        }
        if (cible && cible.id !== message.author.id) {
            const date = getGuildBirthdays(message.guild.id)[cible.id];
            const nom = message.guild?.members.cache.get(cible.id)?.displayName ?? cible.username ?? cible.id;
            if (!date) { await message.reply(`🎂 **${nom}** n'a pas encore enregistré son anniversaire.`); return true; }
            const [d, m] = date.split('/').map(Number);
            const now = new Date(); const next = new Date(now.getFullYear(), m - 1, d);
            if (next < now) next.setFullYear(now.getFullYear() + 1);
            const diffDays = Math.ceil((next - now) / (1000 * 60 * 60 * 24));
            const joursStr = diffDays === 0 ? "c'est aujourd'hui 🎉 !" : diffDays === 1 ? "c'est demain 🎉 !" : `dans **${diffDays} jours** !`;
            await message.reply(`🎂 L'anniversaire de **${nom}** est le **${date}** — ${joursStr}`);
            return true;
        }
        const date = getGuildBirthdays(message.guild.id)[message.author.id];
        if (!date) { await message.reply("Tu n'as pas encore enregistré ton anniversaire ! Utilise `!anniversaire set JJ/MM`."); return true; }
        const [d, m] = date.split('/').map(Number);
        const now = new Date(); const next = new Date(now.getFullYear(), m - 1, d);
        if (next < now) next.setFullYear(now.getFullYear() + 1);
        const diffDays = Math.ceil((next - now) / (1000 * 60 * 60 * 24));
        const joursStr = diffDays === 0 ? "c'est aujourd'hui 🎉 !" : diffDays === 1 ? "c'est demain 🎉 !" : `dans **${diffDays} jours** !`;
        await message.reply(`🎂 Ton anniversaire est le **${date}** — ${joursStr}`);
        return true;
    }

    if (sub === 'list') {
        const entries = Object.entries(getGuildBirthdays(message.guild.id));
        if (entries.length === 0) { await message.reply("Aucun anniversaire enregistré !"); return true; }
        const authorId = message.author.id;
        const PAGE_SIZE = 10;

        const sortEntries = (ordre) => {
            if (ordre === 'chrono') {
                const now = new Date();
                return [...entries].sort((a, b) => {
                    const [da, ma] = a[1].split('/').map(Number);
                    const [db, mb] = b[1].split('/').map(Number);
                    const dateA = new Date(now.getFullYear(), ma - 1, da);
                    const dateB = new Date(now.getFullYear(), mb - 1, db);
                    if (dateA < now) dateA.setFullYear(now.getFullYear() + 1);
                    if (dateB < now) dateB.setFullYear(now.getFullYear() + 1);
                    return dateA - dateB;
                });
            } else {
                return [...entries].sort((a, b) => {
                    const [da, ma] = a[1].split('/').map(Number);
                    const [db, mb] = b[1].split('/').map(Number);
                    return ma !== mb ? ma - mb : da - db;
                });
            }
        };

        const sorted = sortEntries('classique');
        const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
        const slice = sorted.slice(0, PAGE_SIZE);
        const lines = slice.map(([uid, date]) => `<@${uid}> — **${date}**`).join('\n');

        const embed = new EmbedBuilder()
            .setColor(0xff69b4)
            .setTitle('🎂 Anniversaires du serveur')
            .setDescription(lines)
            .setFooter({ text: `Page 1/${totalPages} • 📅 Ordre classique` });

        const prev = new ButtonBuilder().setCustomId(`anniv_list_classique_${authorId}_0_prev`).setLabel('⬅️ Arrière').setStyle(ButtonStyle.Secondary).setDisabled(true);
        const next = new ButtonBuilder().setCustomId(`anniv_list_classique_${authorId}_0_next`).setLabel('Suivant ➡️').setStyle(ButtonStyle.Secondary).setDisabled(totalPages <= 1);
        const chronoBtn = new ButtonBuilder().setCustomId(`anniv_list_chrono_${authorId}_0_switch`).setLabel('🕒 Ordre chronologique').setStyle(ButtonStyle.Secondary);
        const classiqueBtn = new ButtonBuilder().setCustomId(`anniv_list_classique_${authorId}_0_switch`).setLabel('📅 Ordre classique').setStyle(ButtonStyle.Primary);

        const row1 = new ActionRowBuilder().addComponents(prev, next);
        const row2 = new ActionRowBuilder().addComponents(chronoBtn, classiqueBtn);

        await message.reply({ embeds: [embed], components: [row1, row2] });
        return true;
    }

    if (sub === 'next') {
        const entries = Object.entries(getGuildBirthdays(message.guild.id));
        if (entries.length === 0) { await message.reply("Aucun anniversaire enregistré !"); return true; }
        const now = new Date();
        const toDate = (str) => {
            const [d, m] = str.split('/').map(Number);
            const year = (m < now.getMonth() + 1 || (m === now.getMonth() + 1 && d < now.getDate())) ? now.getFullYear() + 1 : now.getFullYear();
            return new Date(year, m - 1, d);
        };
        const next = entries.sort((a, b) => toDate(a[1]) - toDate(b[1]))[0];
        const member = message.guild?.members.cache.get(next[0]);
        const name = member?.displayName ?? `<@${next[0]}>`;
        const nextDate = toDate(next[1]);
        const diffMs = nextDate - now;
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        const joursStr = diffDays === 0 ? "c'est aujourd'hui 🎉" : diffDays === 1 ? "demain 🎉" : `dans **${diffDays} jours**`;
        await message.reply(`🎂 Le prochain anniversaire est celui de **${name}** le **${next[1]}** — ${joursStr} !`);
        return true;
    }

    const anniversaireFields = [
        { name: '!anniversaire set JJ/MM', value: 'Enregistre ton anniversaire.', inline: false },
        { name: '!anniversaire set Pseudo JJ/MM', value: "Enregistre l'anniversaire de quelqu'un.", inline: false },
        { name: '!anniversaire show', value: 'Affiche ton anniversaire enregistré.', inline: false },
        { name: '!anniversaire list', value: 'Liste tous les anniversaires du serveur.', inline: false },
        { name: '!anniversaire next', value: 'Affiche le prochain anniversaire du serveur.', inline: false },
        { name: '!anniversaire remove', value: 'Supprime ton anniversaire enregistré.', inline: false }
    ];
    if (message.author.id === birthdayState.EPSYS_ID) {
        anniversaireFields.push({ name: '!anniversaire room [ID_SALON]', value: 'Définit le salon d\'annonce des anniversaires pour ce serveur. (Toi uniquement)', inline: false });
    }
    const anniversaireEmbed = new EmbedBuilder()
        .setColor(0xff69b4)
        .setTitle('🎂 Anniversaire')
        .addFields(...anniversaireFields);
    await message.reply({ embeds: [anniversaireEmbed] });
    return true;
}

// =========================
//  GESTION DES SLASHS (/)
// =========================
async function handleAnniversaireSlash(interaction) {
    if (interaction.commandName !== 'anniversaire') return false;

    const sub = interaction.options.getSubcommand();
    const guildBirthdays = getGuildBirthdays(interaction.guild.id);

    if (sub === 'show') {
        const cibleUser = interaction.options.getUser('membre') ?? interaction.user;
        const date = guildBirthdays[cibleUser.id];
        const nom = interaction.guild?.members.cache.get(cibleUser.id)?.displayName ?? cibleUser.username;
        if (!date) return interaction.reply({ content: `🎂 **${nom}** n'a pas encore enregistré son anniversaire.`, ephemeral: true });
        const [d, m] = date.split('/').map(Number);
        const now = new Date(); const next = new Date(now.getFullYear(), m - 1, d);
        if (next < now) next.setFullYear(now.getFullYear() + 1);
        const diffDays = Math.ceil((next - now) / (1000 * 60 * 60 * 24));
        const joursStr = diffDays === 0 ? "c'est aujourd'hui 🎉 !" : diffDays === 1 ? "c'est demain 🎉 !" : `dans **${diffDays} jours** !`;
        return interaction.reply(`🎂 L'anniversaire de **${nom}** est le **${date}** — ${joursStr}`);
    }

    if (sub === 'set') {
        const date = interaction.options.getString('date');
        if (!/^\d{2}\/\d{2}$/.test(date)) {
            return interaction.reply({ content: "Format invalide ! Utilise le format `JJ/MM` (ex : `24/07`).", ephemeral: true });
        }
        const cibleUser = interaction.options.getUser('membre') ?? interaction.user;
        const nom = interaction.guild?.members.cache.get(cibleUser.id)?.displayName ?? cibleUser.username;
        guildBirthdays[cibleUser.id] = date;
        await birthdayState.saveBirthdays();
        return interaction.reply(`🎂 L'anniversaire de **${nom}** a été enregistré le **${date}** !`);
    }

    if (sub === 'list') {
        const entries = Object.entries(guildBirthdays);
        if (entries.length === 0) return interaction.reply({ content: "Aucun anniversaire enregistré !", ephemeral: true });
        const authorId = interaction.user.id;
        const PAGE_SIZE = 10;

        const sorted = [...entries].sort((a, b) => {
            const [da, ma] = a[1].split('/').map(Number);
            const [db, mb] = b[1].split('/').map(Number);
            return ma !== mb ? ma - mb : da - db;
        });
        const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
        const slice = sorted.slice(0, PAGE_SIZE);
        const lines = slice.map(([uid, date]) => `<@${uid}> — **${date}**`).join('\n');
        const embed = new EmbedBuilder()
            .setColor(0xff69b4)
            .setTitle('🎂 Anniversaires du serveur')
            .setDescription(lines)
            .setFooter({ text: `Page 1/${totalPages} • 📅 Ordre classique` });

        const prev = new ButtonBuilder().setCustomId(`anniv_list_classique_${authorId}_0_prev`).setLabel('⬅️ Arrière').setStyle(ButtonStyle.Secondary).setDisabled(true);
        const next = new ButtonBuilder().setCustomId(`anniv_list_classique_${authorId}_0_next`).setLabel('Suivant ➡️').setStyle(ButtonStyle.Secondary).setDisabled(totalPages <= 1);
        const chronoBtn = new ButtonBuilder().setCustomId(`anniv_list_chrono_${authorId}_0_switch`).setLabel('🕒 Ordre chronologique').setStyle(ButtonStyle.Secondary);
        const classiqueBtn = new ButtonBuilder().setCustomId(`anniv_list_classique_${authorId}_0_switch`).setLabel('📅 Ordre classique').setStyle(ButtonStyle.Primary);
        const row1 = new ActionRowBuilder().addComponents(prev, next);
        const row2 = new ActionRowBuilder().addComponents(chronoBtn, classiqueBtn);
        return interaction.reply({ embeds: [embed], components: [row1, row2] });
    }

    if (sub === 'next') {
        const entries = Object.entries(guildBirthdays);
        if (entries.length === 0) return interaction.reply({ content: "Aucun anniversaire enregistré !", ephemeral: true });
        const now = new Date();
        const toDate = (str) => {
            const [d, m] = str.split('/').map(Number);
            const year = (m < now.getMonth() + 1 || (m === now.getMonth() + 1 && d < now.getDate())) ? now.getFullYear() + 1 : now.getFullYear();
            return new Date(year, m - 1, d);
        };
        const next = entries.sort((a, b) => toDate(a[1]) - toDate(b[1]))[0];
        const member = interaction.guild?.members.cache.get(next[0]);
        const name = member?.displayName ?? `<@${next[0]}>`;
        const nextDate = toDate(next[1]);
        const diffMs = nextDate - now;
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        const joursStr = diffDays === 0 ? "c'est aujourd'hui 🎉" : diffDays === 1 ? "demain 🎉" : `dans **${diffDays} jours**`;
        return interaction.reply(`🎂 Le prochain anniversaire est celui de **${name}** le **${next[1]}** — ${joursStr} !`);
    }

    if (sub === 'remove') {
        const cibleUser = interaction.options.getUser('membre') ?? interaction.user;
        if (!guildBirthdays[cibleUser.id]) {
            return interaction.reply({ content: "Cet anniversaire n'est pas enregistré !", ephemeral: true });
        }
        const nom = interaction.guild?.members.cache.get(cibleUser.id)?.displayName ?? cibleUser.username;
        delete guildBirthdays[cibleUser.id];
        await birthdayState.saveBirthdays();
        return interaction.reply(`🗑️ L'anniversaire de **${nom}** a été supprimé !`);
    }

    return false;
}

// =========================
//  GESTION DES BOUTONS
// =========================
async function handleAnniversaireButton(interaction) {
    if (!interaction.isButton() || !interaction.customId.startsWith('anniv_list_')) return false;

    const parts = interaction.customId.split('_');
    const ordre = parts[2];
    const authorId = parts[3];
    const currentPage = parseInt(parts[4], 10) || 0;
    const action = parts[5];

    if (interaction.user.id !== authorId) {
        await interaction.reply({ content: "Ce bouton ne t'est pas destiné !", ephemeral: true });
        return true;
    }

    const entries = Object.entries(getGuildBirthdays(interaction.guild.id));
    const PAGE_SIZE = 10;

    const sortEntries = (o) => {
        if (o === 'chrono') {
            const now = new Date();
            return [...entries].sort((a, b) => {
                const [da, ma] = a[1].split('/').map(Number);
                const [db, mb] = b[1].split('/').map(Number);
                const dateA = new Date(now.getFullYear(), ma - 1, da);
                const dateB = new Date(now.getFullYear(), mb - 1, db);
                if (dateA < now) dateA.setFullYear(now.getFullYear() + 1);
                if (dateB < now) dateB.setFullYear(now.getFullYear() + 1);
                return dateA - dateB;
            });
        } else {
            return [...entries].sort((a, b) => {
                const [da, ma] = a[1].split('/').map(Number);
                const [db, mb] = b[1].split('/').map(Number);
                return ma !== mb ? ma - mb : da - db;
            });
        }
    };

    let newOrdre = ordre;
    let newPage = currentPage;
    if (action === 'prev') newPage = currentPage - 1;
    else if (action === 'next') newPage = currentPage + 1;
    else if (action === 'switch') { newOrdre = ordre === 'chrono' ? 'classique' : 'chrono'; newPage = 0; }

    const sorted = sortEntries(newOrdre);
    const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
    const slice = sorted.slice(newPage * PAGE_SIZE, (newPage + 1) * PAGE_SIZE);
    const lines = slice.map(([uid, date]) => `<@${uid}> — **${date}**`).join('\n');

    const prev = new ButtonBuilder()
        .setCustomId(`anniv_list_${newOrdre}_${authorId}_${newPage}_prev`)
        .setLabel('⬅️ Arrière')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(newPage === 0);
    const next = new ButtonBuilder()
        .setCustomId(`anniv_list_${newOrdre}_${authorId}_${newPage}_next`)
        .setLabel('Suivant ➡️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(newPage >= totalPages - 1);
    const chronoBtn = new ButtonBuilder()
        .setCustomId(`anniv_list_chrono_${authorId}_${newPage}_switch`)
        .setLabel('🕒 Ordre chronologique')
        .setStyle(newOrdre === 'chrono' ? ButtonStyle.Primary : ButtonStyle.Secondary);
    const classiqueBtn = new ButtonBuilder()
        .setCustomId(`anniv_list_classique_${authorId}_${newPage}_switch`)
        .setLabel('📅 Ordre classique')
        .setStyle(newOrdre === 'classique' ? ButtonStyle.Primary : ButtonStyle.Secondary);

    const row1 = new ActionRowBuilder().addComponents(prev, next);
    const row2 = new ActionRowBuilder().addComponents(chronoBtn, classiqueBtn);

    const embed = new EmbedBuilder()
        .setColor(0xff69b4)
        .setTitle('🎂 Anniversaires du serveur')
        .setDescription(lines)
        .setFooter({ text: `Page ${newPage + 1}/${totalPages} • ${newOrdre === 'chrono' ? '🕒 Ordre chronologique' : '📅 Ordre classique'}` });

    await interaction.update({ embeds: [embed], components: [row1, row2] });
    return true;
}

module.exports = {
    initBirthdayState,
    getGuildBirthdays,
    getBirthdayChannelId,
    estAnniversaireAujourdhui,
    checkBirthdays,
    scheduleBirthdayCheck,
    handleAnniversaireMessage,
    handleAnniversaireSlash,
    handleAnniversaireButton
};