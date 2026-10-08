const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createCanvas, loadImage, registerFont } = require('canvas');

const WANTED_EXCLUDED = ['159985870458322944', '1503495713097519355', '577856714347511828'];
let wantedOverride = null;

function seedRndWanted(seed) {
    let x = Math.sin(seed + 1) * 10000;
    return x - Math.floor(x);
}

function getWantedOfTheDay(dateKey, guild, topData) {
    if (wantedOverride && wantedOverride.dateKey === dateKey) return wantedOverride.userId;
    const messages = topData?.messages ?? {};
    const top30 = Object.entries(messages)
        .filter(([uid]) => !WANTED_EXCLUDED.includes(uid))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 30)
        .map(([uid]) => uid)
        .filter(uid => { const m = guild?.members.cache.get(uid); return m && !m.user.bot; });
    if (top30.length === 0) return null;
    return top30[Math.floor(seedRndWanted(dateKey * 7) * top30.length)];
}

const WANTED_CRIMES = [
    "A volé le dernier McDo de la file à 23h47 en regardant les gens dans les yeux",
    "A spoilé la fin d'une série que personne regardait vraiment mais quand même",
    "A répondu OK à un message de 40 lignes envoyé avec les tripes",
    "A mangé des chips en réunion vocale sans couper son micro",
    "A laissé 1% de batterie sans brancher le chargeur. Volontairement.",
    "A mis du lait AVANT les céréales et l'assume encore",
    "A dit que Kaamelott c'était 'trop long'",
    "A liké ses propres messages Discord depuis un compte secondaire",
    "A soufflé les bougies du gâteau de quelqu'un d'autre",
    "A recalé un appel et répondu '?' comme si c'était une réponse acceptable",
    "A laissé un message vocal de 9 minutes pour demander 't'es là ?'",
    "A regardé une série entière en avance x2 et dit que c'était 'mieux'",
    "A tapé en minuscules dans un formulaire officiel",
    "A fait semblant de pas voir quelqu'un dans la rue pendant 400 mètres",
    "A écrit 'cordialement' à quelqu'un qu'iel déteste",
    "A squatté le chargeur commun toute une nuit sans remords",
    "A chanté faux pendant 3h dans un casque sans le savoir",
    "A installé une toolbar tierce sur l'ordi de quelqu'un pendant une aide 'rapide'",
    "A recyclé un mème de 2016 en le faisant passer pour nouveau",
    "A mangé la dernière part de pizza en mode 'je savais pas que c'était la dernière'",
    "A quitté un vocal Discord sans dire au revoir, à 4 reprises le même jour",
    "A dit 'je suis en chemin' depuis son canapé. Le trajet était de 40 minutes.",
    "A ouvert un paquet de chips dans un cinéma. Le film avait commencé depuis 3 minutes.",
    "A mis ses pieds sur le siège du train d'en face",
    "A pris la dernière tranche de pain de mie et remis le sachet vide dans le placard",
    "A répondu 'nn' à une question à laquelle la réponse était clairement 'oui'",
    "A utilisé Internet Explorer en 2025. Volontairement.",
    "A acheté une place de concert juste pour être dans la fosse et rester immobile",
    "A prétendu ne pas avoir reçu un message alors que la double coche bleue était visible",
    "A mangé quelque chose dans le frigo commun puis replacé le tupperware vide",
    "A joué de la musique dans un transport en commun sans écouteurs à 8h du matin",
    "A envoyé un 'lol' en réponse à l'annonce d'une mauvaise nouvelle",
    "A fait un spoil en disant 'attends c'est la partie où—' juste avant ladite partie",
    "A tapé très fort au clavier à 3h du mat en colocation",
    "A suivi quelqu'un sur Instagram, attendu qu'iel suive en retour, puis s'est désabonné",
    "A accepté les cookies tiers sur l'ordinateur de quelqu'un d'autre",
    "A chanté l'anniversaire à quelqu'un qui avait demandé à ne pas fêter son anniversaire",
    "A prétendu ne pas avoir de données mobiles pour éviter d'appeler",
    "A décrit un film sur 20 minutes à quelqu'un qui venait de le voir",
    "A fait de l'overscrolling sur le profil de quelqu'un et liké une photo de 2013",
    "A répondu à un message de groupe 4 jours plus tard comme si la conversation continuait",
    "A terminé le shampooing de quelqu'un et mis la bouteille vide sous la douche",
    "A envoyé un vocal de 4 minutes à 2h du mat sur un sujet qui pouvait attendre",
    "A prétendu connaître un artiste après en avoir écouté UNE chanson",
    "A tenté de faire passer un test MBTI comme une preuve scientifique",
    "A préparé un PowerPoint de 47 slides pour expliquer pourquoi ses vacances étaient mieux",
    "A voulu corriger la prononciation de quelqu'un devant toute une table",
    "A dit 'c'est pas si grave' à quelqu'un qui pleurait",
    "A décidé de réarranger toute la cuisine de quelqu'un d'autre 'pour l'optimiser'",
    "A raconté une blague en ajoutant 'et là normalement vous devez rire'",
    "A mis fin à une discussion en envoyant juste 'ok' et n'a plus jamais répondu",
    "A prétendu que ses 4h de sommeil c'était 'suffisant pour lui'",
    "A commandé une pizza sans demander les préférences des autres présents",
    "A répondu 'ouais c'est intéressant' à une passion que l'autre évoquait depuis 10 minutes",
    "A supprimé volontairement un projet musical de <@390539577833684994> pendant une session de travail",
    "A spoilé à <@738191002187202630> la fin d'une série qu'elle avait mis 3 mois à regarder",
    "A volé les cartes One Piece de <@1070742213635625050> pendant une soirée et dit 'j'ai rien pris'",
    "A insulté la mère de <@375746968737021962> dans un débat politique qui avait commencé sur la meilleure pasta",
    "A envoyé à <@511929490964742144> un shitpost qu'iel avait lui-même envoyé 2 jours avant",
    "A réveillé <@738191002187202630> à 4h du mat pour lui demander si elle dormait",
    "A prétendu que <@731078752708067403> avait tort sur un sujet politique alors qu'iel avait parfaitement raison",
    "A utilisé le compte Discord de <@744217896581857281> pour envoyer des messages cringe dans des serveurs de science",
    "A crashé la session de dev de <@436218312574107658> en pushant du code non testé directement en prod",
    "A dit à <@1263920891264499733> que les femboys c'était 'une phase'",
    "A donné à <@899733709173948487> des spoils sur TADC season 3 alors que personne l'avait vue",
    "A vendu les cartes One Piece de <@1070742213635625050> pour 3€ sur Vinted",
    "A prétendu avoir écouté le projet musical de <@975959908702888046> alors que c'était clairement un mensonge",
    "A convaincu <@375746968737021962> que son analyse politique était fausse avec un argument de mauvaise foi",
    "A détruit la théorie de <@744217896581857281> sur un tableau blanc devant tout le serveur",
    "A envoyé à <@390539577833684994> une demande de collab musicale en sachant pertinemment ne rien savoir faire",
    "A fait croire à <@738191002187202630> que le BPD était 'un truc inventé par TikTok'",
    "A tenté de débattre de politique avec <@731078752708067403> à 3h du mat et a perdu",
    "A dit à <@899733709173948487> que FNAF c'était 'pour les enfants'",
    "A volé les croissants de <@436218312574107658> qui étaient clairement étiquetés",
    "A revendu la collection de cartes de <@1070742213635625050> pièce par pièce sur un serveur concurrent",
    "A convaincu tout le serveur que <@390539577833684994> et Feldup étaient la même personne",
    "A piqué le dernier Monster Energy du frigo commun alors qu'il y avait le prénom de <@436218312574107658> dessus",
    "A prétendu être <@744217896581857281> dans un autre serveur pour donner de mauvais conseils scientifiques",
    "A dit à <@1263920891264499733> qu'être gay c'est 'juste une tendance du moment'",
    "A fait croire à <@899733709173948487> que le nouveau DLC FNAF était sorti alors que non",
    "A demandé à <@975959908702888046> de faire de la musique 'dans le style de Feldup' exprès pour énerver",
    "A mis fin à un débat de <@731078752708067403> en envoyant juste 'ok' et n'a plus jamais répondu",
    "A prétendu que <@390539577833684994> et Feldup étaient en couple pour créer le drama",
    "A volontairement ignoré le passing de <@390539577833684994> pour la comparer à Feldup pendant 20 minutes",
    "A demandé à <@375746968737021962> une analyse politique complète à 3h du mat puis a dit 'ok merci' et s'est déco",
];

const WANTED_PREUVES = [
    "Des traces de doigts gras retrouvées sur un écran de téléphone non réclamé",
    "Un reçu de kebab daté de la nuit du crime avec une commande 'sans oignons' suspecte",
    "Un message vocal de 7 minutes retrouvé supprimé, partiellement récupéré",
    "Un historique de recherche Google contenant 'comment effacer ses traces' à 3h14",
    "Un emoji 💀 envoyé exactement 2 minutes avant les faits dans un groupe Discord",
    "Des traces de Nutella sur un clavier qui n'appartient pas au suspect",
    "Une commande Uber Eats passée depuis une adresse inconnue à 4h23 du matin",
    "Des screenshots pris en mode incognito retrouvés par synchronisation automatique",
    "Un like accidentel sur une photo de 2018 juste avant le crime",
    "Un post-it avec juste 'fait' écrit dessus et une date correspondante",
    "Une playlist Spotify intitulée 'ambiance neutre rien à voir' créée le jour J",
    "Un message 'je suis en chemin' envoyé depuis les coordonnées GPS du domicile",
    "Des traces de Monster Energy sur la scène, marque non consommée habituellement",
    "Un ticket de caisse Lidl avec un article 'câble HDMI' acheté sans raison apparente",
    "Un changement de statut Discord à 'Ne pas déranger' 3 minutes avant les faits",
    "Une photo floue prise accidentellement et sauvegardée automatiquement dans le cloud",
    "Un appel entrant ignoré de quelqu'un qui 'ne savait rien'",
    "Une chaussette orpheline retrouvée sur les lieux sans explication plausible",
    "Un vocal Discord mal coupé dans lequel on entend 'ch'uis sûr.e que personne a vu'",
    "Un fichier renommé '(version finale) (vraiment finale) (ne pas ouvrir)' daté du jour J",
    "Un 'vu' affiché à 2h17 suivi d'aucune réponse pendant 36 heures",
    "Un boîtier de carte One Piece retrouvé vide derrière le canapé",
    "<@390539577833684994> a confirmé avoir entendu quelque chose d'inhabituel ce soir-là",
    "<@744217896581857281> a retrouvé un schéma connexe dans ses notes sur un post-it illisible",
    "<@511929490964742144> a posté un shitpost cryptique exactement 4 minutes après les faits",
    "<@375746968737021962> a analysé le contexte politique de l'événement. Ses conclusions sont troublantes.",
    "<@738191002187202630> a été aperçu.e en train de sourire au moment des faits sans raison apparente",
    "<@899733709173948487> a trouvé des similarités avec un pattern connu de la base de données FNAF",
    "<@436218312574107658> a retrouvé dans ses archives un fichier portant un nom incriminant",
    "<@731078752708067403> a lancé un débat politique exactement une heure avant, possible diversion",
    "<@1070742213635625050> a envoyé un message depuis la Corée avec un décalage horaire suspect",
    "<@975959908702888046> a validé la scène d'un regard sans faire de commentaire",
    "<@1263920891264499733> a simplement regardé et dit 'gg' au moment des faits",
    "<@436218312574107658> a trouvé un bug dans le système de surveillance pile ce soir-là",
    "Une boîte de cartes One Piece retrouvée ouverte et partiellement vidée chez le suspect",
    "Un historique d'écoute Spotify révélant une obsession pour la playlist de <@390539577833684994>",
];

const WANTED_LIEUX = [
    "Le salon vocal 'général 1' de Regaïa un lundi soir",
    "Un Carrefour Market à 19h52 un mercredi",
    "Les toilettes d'un McDo",
    "Un bus de nuit ligne 38, dernière rame",
    "Le salon shitpost de Regaïa à 2h du matin",
    "Le parking d'un Lidl sous la pluie",
    "Une salle d'attente de médecin avec une télé qui diffuse BFMTV",
    "Un kebab de quartier à 20 minutes de la fermeture",
    "Les tréfonds d'un subreddit abandonné en 2019",
    "Un groupe WhatsApp familial créé pour Noël et jamais quitté",
    "L'arrière d'un Monoprix à l'heure de la réduction des invendus",
    "Un vocal Discord vide censé être 'pour bosser ensemble'",
    "Une file d'attente pour un concert sold-out",
    "La section commentaires d'une vidéo YouTube de 2011",
    "Un Disneyland Paris en pleine canicule",
    "Un Ikea un samedi après-midi",
    "Un aéroport low-cost à 5h du matin",
    "Le rayon surgelés d'un Leclerc à 16h37",
    "Une file d'attente de la CAF",
    "Un festival en pleine boue",
    "Le salon des Modos de Regaïa",
    "Un escape game avec des inconnus",
    "Un cinéma UGC lors d'une avant-première",
    "Chez <@436218312574107658>",
    "Une foire aux cartes à collectionner dans un gymnase de banlieue",
    "Les DM d'un serveur Discord de fans de TCG One Piece",
    "Un festival de musique indé sous un ciel menaçant",
    "Le salon général de Regaïa à une heure où tout le monde dormait sauf deux personnes",
];

const WANTED_STATUTS = [
    "🔴 En fuite active",
    "🟠 Recherché.e activement",
    "🟡 Sous surveillance rapprochée",
    "⚫ Dangereusement en liberté",
    "🔵 Nie tout en bloc avec conviction",
    "🟣 A l'air innocent.e. Ne pas se fier aux apparences.",
    "🟤 A tenté de corrompre un témoin",
    "🔴 Récidiviste connu.e du tribunal de Regaïa",
    "🟠 A fui au dernier moment connu vers le Wokistan",
    "🟡 Coopère partiellement avec les enquêteurs",
];

function getWantedEmbedData(guild, dateKey, wantedID) {
    const pool = WANTED_CRIMES.filter(c => !c.includes(`<@${wantedID}>`));
    const crime = pool[Math.floor(seedRndWanted(dateKey * 3) * pool.length)];
    const now = new Date();
    const dateStr = now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    const embed = new EmbedBuilder()
        .setColor(0x8b0000)
        .setTitle('🚨 CRIMINEL(LE) DU JOUR')
        .setDescription(`<@${wantedID}> est activement recherché.e pour la raison suivante :\n\n**Crime :** ${crime}`)
        .setFooter({ text: `📅 ${dateStr} • !wanted pour consulter l'avis du jour` });
    return { embed, crime };
}

function getPreuvesEmbed(guild, dateKey, wantedID) {
    const pool = WANTED_PREUVES.filter(p => !p.includes(`<@${wantedID}>`));
    const idxs = [];
    while (idxs.length < 3) {
        const i = Math.floor(seedRndWanted((dateKey * (idxs.length + 11))) * pool.length);
        if (!idxs.includes(i)) idxs.push(i);
    }
    return new EmbedBuilder()
        .setColor(0x8b0000)
        .setTitle('🔍 Preuves accablantes')
        .setDescription(`**Preuve n°1 :** ${pool[idxs[0]]}\n\n**Preuve n°2 :** ${pool[idxs[1]]}\n\n**Preuve n°3 :** ${pool[idxs[2]]}`)
        .setFooter({ text: 'Ces preuves ont été validées par le tribunal de Regaïa.' });
}

function getAffaireEmbed(guild, dateKey, wantedID, topData) {
    const messages = topData?.messages ?? {};
    const top30 = Object.entries(messages)
        .filter(([uid]) => !WANTED_EXCLUDED.includes(uid) && uid !== wantedID)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 30)
        .map(([uid]) => uid)
        .filter(uid => { const m = guild?.members.cache.get(uid); return m && !m.user.bot; });
    const prime = Math.floor(seedRndWanted(dateKey * 19) * 95) + 5;
    const lieu = WANTED_LIEUX[Math.floor(seedRndWanted(dateKey * 23) * WANTED_LIEUX.length)];
    const statut = WANTED_STATUTS[Math.floor(seedRndWanted(dateKey * 29) * WANTED_STATUTS.length)];
    const minDate = new Date('2014-01-01').getTime();
    const crimeDate = new Date(minDate + Math.floor(seedRndWanted(dateKey * 31) * (Date.now() - minDate))).toLocaleDateString('fr-FR');
    const temoinId = top30.length > 0 ? top30[Math.floor(seedRndWanted(dateKey * 37) * top30.length)] : null;
    return new EmbedBuilder()
        .setColor(0x8b0000)
        .setTitle('📋 Avancement de l\'affaire')
        .addFields(
            { name: '💰 Prime', value: `${prime.toLocaleString('fr-FR')}$`, inline: true },
            { name: '📅 Crime commis le', value: crimeDate, inline: true },
            { name: '\u200b', value: '\u200b', inline: true },
            { name: '📍 Lieu du crime', value: lieu, inline: true },
            { name: 'Statut', value: statut, inline: true },
            { name: '\u200b', value: '\u200b', inline: true },
            { name: '👁️ Témoin principal', value: temoinId ? `<@${temoinId}>` : 'Anonyme', inline: false }
        )
        .setFooter({ text: 'Dossier classifié — Tribunal de Regaïa' });
}

function buildWantedRow(activeTab, authorId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`wanted_tab_avis_${authorId}`).setLabel('📢 Avis de recherche').setStyle(activeTab === 'avis' ? ButtonStyle.Danger : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`wanted_tab_preuves_${authorId}`).setLabel('🔍 Preuves').setStyle(activeTab === 'preuves' ? ButtonStyle.Danger : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`wanted_tab_affaire_${authorId}`).setLabel('📋 Affaire').setStyle(activeTab === 'affaire' ? ButtonStyle.Danger : ButtonStyle.Secondary)
    );
}

async function sendWantedMessage(target, guild, dateKey, wantedID, authorId, topData, isReply = false) {
    const { embed } = getWantedEmbedData(guild, dateKey, wantedID);
    const nom = guild.members.cache.get(wantedID)?.displayName ?? wantedID;
    embed.setThumbnail(guild.members.cache.get(wantedID)?.user.displayAvatarURL({ dynamic: true }));
    const payload = { embeds: [embed], components: [buildWantedRow('avis', authorId)] };
    return isReply ? target.reply(payload) : target.send(payload);
}

async function sendDailyWanted(guild, topData) {
    const now = new Date();
    const dateKey = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
    if (wantedOverride && wantedOverride.dateKey !== dateKey) wantedOverride = null;
    const channel = guild.channels.cache.get('720079691041472572');
    if (!channel) return;
    const wantedID = getWantedOfTheDay(dateKey, guild, topData);
    if (!wantedID) return;
    await channel.send({ content: '# 🚨 AVIS DE RECHERCHE DU JOUR' });
    await sendWantedMessage(channel, guild, dateKey, wantedID, 'daily', topData, false);
}

function scheduleWanted(guild, topData) {
    const now = new Date();
    const parisNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    const next10h = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    next10h.setHours(10, 0, 0, 0);
    if (next10h <= parisNow) next10h.setDate(next10h.getDate() + 1);
    const delay = (next10h - parisNow) + (now - parisNow);
    setTimeout(async () => {
        await sendDailyWanted(guild, topData);
        setInterval(() => sendDailyWanted(guild, topData), 24 * 60 * 60 * 1000);
    }, delay);
    console.log(`⏰ Prochain wanted dans ${Math.floor(delay / 3600000)}h${Math.floor((delay % 3600000) / 60000)}m`);
}

async function handleWantedMessage(message, response, helpers) {
    const { topData, findMemberByName, askDisambiguation } = helpers;

    if (response?.needsWantedSet) {
        if (message.author.id !== '436218312574107658') return message.reply("Tu n'es pas autorisé.e à faire cette commande.");
        const now = new Date();
        const dateKey = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
        let targetId = null;
        const mentionned = message.mentions.users.first();
        if (mentionned) {
            targetId = mentionned.id;
        } else {
            const query = message.content.trim().split(/\s+/).slice(2).join(' ');
            if (query) {
                if (/^\d{17,19}$/.test(query)) {
                    targetId = query;
                } else {
                    const result = findMemberByName(message.guild, query);
                    if (result.multiple) {
                        askDisambiguation(message, message.guild, result.candidates, async (user) => {
                            if (WANTED_EXCLUDED.includes(user.id)) return message.reply('Ce membre ne peut pas être désigné.');
                            wantedOverride = { userId: user.id, dateKey };
                            message.reply(`🚨 Criminel.le du jour forcé.e : **${message.guild.members.cache.get(user.id)?.displayName ?? user.username}** !`);
                        });
                        return true;
                    }
                    if (result.found) targetId = result.found.user.id;
                }
            }
        }
        if (!targetId) return message.reply('Membre introuvable !');
        if (WANTED_EXCLUDED.includes(targetId)) return message.reply('Ce membre ne peut pas être désigné.');
        wantedOverride = { userId: targetId, dateKey };
        return message.reply(`🚨 Criminel.le du jour forcé.e : **${message.guild.members.cache.get(targetId)?.displayName ?? targetId}** !`);
    }

    if (response?.needsWanted) {
        const now = new Date();
        const dateKey = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
        const wantedID = getWantedOfTheDay(dateKey, message.guild, topData);
        if (!wantedID) return message.reply('Aucun membre éligible trouvé !');
        return sendWantedMessage(message, message.guild, dateKey, wantedID, message.author.id, topData, true);
    }

    return false;
}

async function handleWantedButton(interaction, topData) {
    if (!interaction.isButton() || !interaction.customId.startsWith('wanted_tab_')) return false;

    const parts = interaction.customId.split('_');
    const tab = parts[2];
    const authorId = parts[3];

    if (authorId !== 'daily' && interaction.user.id !== authorId) {
        await interaction.reply({ content: 'Pour consulter les menus de l\'avis de recherche, utilise `!wanted` !', ephemeral: true });
        return true;
    }

    const now = new Date();
    const dateKey = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
    const wantedID = getWantedOfTheDay(dateKey, interaction.guild, topData);

    if (tab === 'avis') {
        const { embed } = getWantedEmbedData(interaction.guild, dateKey, wantedID);
        embed.setThumbnail(interaction.guild.members.cache.get(wantedID)?.user.displayAvatarURL({ dynamic: true }));
        await interaction.update({ embeds: [embed], components: [buildWantedRow('avis', authorId)] });
        return true;
    } else if (tab === 'preuves') {
        await interaction.update({ embeds: [getPreuvesEmbed(interaction.guild, dateKey, wantedID)], components: [buildWantedRow('preuves', authorId)] });
        return true;
    } else if (tab === 'affaire') {
        await interaction.update({ embeds: [getAffaireEmbed(interaction.guild, dateKey, wantedID, topData)], components: [buildWantedRow('affaire', authorId)] });
        return true;
    }
    return false;
}

async function handleWantedSlash(interaction, topData) {
    await interaction.deferReply();
    const now = new Date();
    const dateKey = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
    const wantedID = getWantedOfTheDay(dateKey, interaction.guild, topData);
    if (!wantedID) return interaction.editReply('Aucun membre éligible trouvé !');
    const { embed } = getWantedEmbedData(interaction.guild, dateKey, wantedID);
    embed.setThumbnail(interaction.guild.members.cache.get(wantedID)?.user.displayAvatarURL({ dynamic: true }));
    return interaction.editReply({ embeds: [embed], components: [buildWantedRow('avis', interaction.user.id)] });
}

module.exports = {
    WANTED_EXCLUDED,
    getWantedOfTheDay,
    sendWantedMessage,
    sendDailyWanted,
    scheduleWanted,
    handleWantedMessage,
    handleWantedButton,
    handleWantedSlash
};