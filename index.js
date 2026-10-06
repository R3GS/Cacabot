require('dotenv').config();

let topData = { messages: {} };
let birthdayData = { birthdays: {}, channels: {} };
    function getGuildBirthdays(guildId) {
        if (!birthdayData.birthdays[guildId]) birthdayData.birthdays[guildId] = {};
        return birthdayData.birthdays[guildId];
    }

    function getBirthdayChannelId(guildId) {
        return birthdayData.channels[guildId] ?? BIRTHDAY_CHANNEL_ID;
    }

    function estAnniversaireAujourdhui(guildId, userId) {
        if (!guildId || !userId) return false;
        const dateAnniv = birthdayData.birthdays[guildId]?.[userId];
        if (!dateAnniv) return false;
        const now = new Date();
        const parisNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
        const today = `${String(parisNow.getDate()).padStart(2, '0')}/${String(parisNow.getMonth() + 1).padStart(2, '0')}`;
        return dateAnniv === today;
    }
let dailyData = {};
let weeklyData = {};
let monthlyData = {};
let youtubeWatchData = {};
let reactionRolesData = {}; // messageId -> { channelId, roles: { emojiKey: roleId } }
let motusData = { dateKey: 0, mot: '', termine: false, vainqueurId: null, tentatives: {}, messageId: null };
let motusStats = {}; // userId -> { victoires: number, parties: number }
let twitchLiveEnCours = false;
let quotesData = []; // [{ id, texte, authorId, authorName, addedById, timestamp, channelId }]
let dernierCommitSha = null;
let donneesChargees = false;

const BACKUP_CHANNEL_ID = '1556005171744604161';

async function loadAll() {
    try {
        const channel = await client.channels.fetch(BACKUP_CHANNEL_ID).catch(() => null);
        let jsonRecord = null;

        // 1. Cherche d'abord le dernier fichier de sauvegarde dans ton salon Discord
        if (channel) {
            const messages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
            const backupMsg = messages?.find(m => m.attachments.size > 0 && m.attachments.first().name.endsWith('.json'));

            if (backupMsg) {
                const fileUrl = backupMsg.attachments.first().url;
                const res = await fetch(fileUrl);
                jsonRecord = await res.json();
                console.log('✅ Données chargées depuis le salon de backup Discord !');
            }
        }

        // Le chargement se fait désormais à 100% depuis le salon Discord <#1553954760900608091> ou #json

        if (!jsonRecord) {
            console.warn('⚠️ Aucune donnée précédente trouvée, démarrage à zéro.');
            donneesChargees = true;
            return;
        }

        topData = { messages: jsonRecord.messages ?? {} };
        birthdayData = { birthdays: jsonRecord.birthdays ?? {}, channels: jsonRecord.birthdayChannels ?? {} };
        dailyData = jsonRecord.daily ?? {};
        weeklyData = jsonRecord.weekly ?? {};
        monthlyData = jsonRecord.monthly ?? {};
        youtubeWatchData = jsonRecord.youtubeWatch ?? {};
        reactionRolesData = jsonRecord.reactionRoles ?? {};
        motusData = jsonRecord.motusData ?? { dateKey: 0, mot: '', termine: false, vainqueurId: null, tentatives: {}, messageId: null };
        motusStats = jsonRecord.motusStats ?? {};
        rebusStats = jsonRecord.rebusStats ?? {};
        quotesData = jsonRecord.quotes ?? [];
        dernierCommitSha = jsonRecord.dernierCommitSha ?? null;

        for (const [nom, map] of Object.entries(ROULETTE_ETATS)) {
            map.clear();
            for (const [k, v] of Object.entries(jsonRecord.roulette?.[nom] ?? {})) map.set(k, v);
        }

        donneesChargees = true;
        console.log('✅ Toutes les données ont été appliquées avec succès !');

        // Si le salon était vide, on y dépose immédiatement le premier fichier de sauvegarde
        if (channel) {
            const messages = await channel.messages.fetch({ limit: 1 }).catch(() => null);
            if (!messages || messages.size === 0) {
                await saveAll();
            }
        }
    } catch (err) {
        console.error('Erreur chargement des données:', err);
    }
}

let lastsaveSaveTime = null;
let messagesSinceLastsaveSave = 0;

async function saveAll() {
    if (!donneesChargees) { console.warn('⚠️ Sauvegarde ignorée : données non chargées'); return; }
    try {
        const channel = await client.channels.fetch(BACKUP_CHANNEL_ID).catch(() => null);
        if (!channel) {
            console.error('❌ Salon de sauvegarde introuvable ! Vérifie l\'ID ou les permissions de Cacabot.');
            return;
        }

        const payload = {
            messages: topData.messages,
            birthdays: birthdayData.birthdays,
            birthdayChannels: birthdayData.channels,
            daily: dailyData,
            weekly: weeklyData,
            monthly: monthlyData,
            youtubeWatch: youtubeWatchData,
            reactionRoles: reactionRolesData,
            motusData: motusData,
            motusStats: motusStats,
            rebusStats: rebusStats,
            quotes: quotesData,
            dernierCommitSha: dernierCommitSha,
            roulette: Object.fromEntries(
                Object.entries(ROULETTE_ETATS).map(([nom, map]) => [nom, Object.fromEntries(map)])
            )
        };

        const jsonStr = JSON.stringify(payload, null, 2);
        const buffer = Buffer.from(jsonStr, 'utf-8');

        const now = new Date();
        const dateStr = now.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' }) + ' à ' + now.toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris' });

        await channel.send({
            content: `💾 **Sauvegarde Cacabot** — \`${dateStr}\``,
            files: [{ attachment: buffer, name: 'cacabot_backup.json' }]
        });

        lastsaveSaveTime = new Date();
        console.log(`💾 Nouvelle sauvegarde postée dans #${channel.name}`);

        // Nettoie automatiquement le salon pour ne garder que les 10 dernières sauvegardes
        const messages = await channel.messages.fetch({ limit: 25 }).catch(() => null);
        if (messages && messages.size > 10) {
            const aSupprimer = [...messages.values()].slice(10);
            for (const m of aSupprimer) {
                await m.delete().catch(() => {});
            }
        }
    } catch (err) {
        console.error('Erreur sauvegarde Discord:', err);
    }
}

setInterval(() => saveAll(), 30 * 60 * 1000); // Sauvegarde automatique toutes les 30 minutes

let saveEnAttente = null;
function demanderSauvegarde() {
    if (saveEnAttente) return;
    saveEnAttente = setTimeout(async () => {
        saveEnAttente = null;
        await saveAll().catch(() => {});
    }, 10000);
}

process.on('SIGTERM', async () => {
    console.log('🛑 SIGTERM reçu, sauvegarde avant arrêt...');
    await saveAll();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('🛑 SIGINT reçu, sauvegarde avant arrêt...');
    await saveAll();
    process.exit(0);
});

// Aliases pour compatibilite
const saveTop = saveAll;
const saveBirthdays = saveAll;

const BIRTHDAY_CHANNEL_ID = '720057528867618909';
const BIRTHDAY_GIF = 'https://cdn.discordapp.com/attachments/1128032964924670053/1505358556851863583/jdg-joueur-du-grenier.gif';

async function checkBirthdays() {
    const now = new Date();
    const parisNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    const today = `${String(parisNow.getDate()).padStart(2, '0')}/${String(parisNow.getMonth() + 1).padStart(2, '0')}`;

    for (const guild of client.guilds.cache.values()) {
        const guildBirthdays = birthdayData.birthdays[guild.id] ?? {};
        for (const [userId, date] of Object.entries(guildBirthdays)) {
            if (date !== today) continue;

            const channel = guild.channels.cache.get(getBirthdayChannelId(guild.id));
            if (!channel) continue;

            // Anniversaire de Cacabot lui-même
            if (userId === client.user.id) {
                await channel.send('JOYEUX ANNIVERSAIRE À MOI !! 🎉🎉🎉');
                await channel.send('https://cdn.discordapp.com/attachments/1480756332373213275/1506635925126512790/dance.gif');
                continue;
            }

            // Vérifier si c'est un bot
            const member = guild.members.cache.get(userId);
            if (member?.user.bot) {
                await channel.send(`JOYEUX ANNIVERSAIRE, COLLÈGUE <@${userId}> ! 🎉\nTu fais partie des bots qui rendent ce serveur encore meilleur, alors, que ta vie reste longue et belle <3`);
                await channel.send('https://cdn.discordapp.com/attachments/1480756332373213275/1506636764771778660/cyclops-ryu.gif');
                continue;
            }

            // Membre normal
            await channel.send(`<@${userId}> JOYEUX ANNIVERSAIRE !!! 🎉🎉🎉`);
            await channel.send(BIRTHDAY_GIF);
        }
    }
}

const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ButtonBuilder,
    ChannelType,
    ButtonStyle,
    SlashCommandBuilder,
    REST,
    Routes
} = require('discord.js');

const embedDrafts = new Map(); // userId -> { embedData }

function parseEmbedColor(colorStr) {
    if (!colorStr) return 0x5865f2;
    const c = colorStr.trim().toLowerCase();
    const map = {
        bleu: 0x3498db, rouge: 0xe74c3c, vert: 0x2ecc71, or: 0xffd700, jaune: 0xf1c40f,
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

function buildEmbedModal(existingData = null) {
    const modal = new ModalBuilder()
        .setCustomId('embed_builder_modal')
        .setTitle("Créateur d'Embed");

    const titleInput = new TextInputBuilder()
        .setCustomId('embed_title')
        .setLabel("Titre de l'embed")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ex : Annonce importante")
        .setRequired(false);
    if (existingData?.titre) titleInput.setValue(existingData.titre);

    const descInput = new TextInputBuilder()
        .setCustomId('embed_desc')
        .setLabel("Description / Contenu (optionnel)")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Le texte principal de ton embed...")
        .setRequired(false);
    if (existingData?.desc) descInput.setValue(existingData.desc);

    const colorInput = new TextInputBuilder()
        .setCustomId('embed_color')
        .setLabel("Couleur (Hex ou nom)")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ex : #ff0000 ou bleu, rouge, or, vert, rose...")
        .setRequired(false);
    if (existingData?.couleurRaw) colorInput.setValue(existingData.couleurRaw);

    const imageInput = new TextInputBuilder()
        .setCustomId('embed_image')
        .setLabel("Image / Bannière (URL optionnelle)")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("https://exemple.com/image.png")
        .setRequired(false);
    if (existingData?.image) imageInput.setValue(existingData.image);

    const footerInput = new TextInputBuilder()
        .setCustomId('embed_footer')
        .setLabel("Pied de page (Footer optionnel)")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ex : L'équipe de Regaïa")
        .setRequired(false);
    if (existingData?.footer) footerInput.setValue(existingData.footer);

    modal.addComponents(
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(descInput),
        new ActionRowBuilder().addComponents(colorInput),
        new ActionRowBuilder().addComponents(imageInput),
        new ActionRowBuilder().addComponents(footerInput)
    );
    return modal;
}

const { createCanvas, loadImage, registerFont } = require('canvas');
process.env.PANGOCAIRO_BACKEND = 'fontconfig';
try { registerFont('./Cowboy Movie.ttf', { family: 'CowboyMovie' }); } catch(e) { console.error('Font non trouvée:', e.message); }
try { registerFont('./LEMONMILK-Bold.otf', { family: 'LemonMilk' }); } catch(e) { console.error('Font LemonMilk non trouvée:', e.message); }

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// =========================
//     DONNÉES WANTED
// =========================

const WANTED_EXCLUDED = ['159985870458322944', '1503495713097519355', '577856714347511828'];
let wantedOverride = null;
const FEUR_IMMUNE = ['1503495713097519355'];

function seedRndWanted(seed) { let x = Math.sin(seed + 1) * 10000; return x - Math.floor(x); }

function getWantedOfTheDay(dateKey, guild) {
    if (wantedOverride && wantedOverride.dateKey === dateKey) return wantedOverride.userId;
    const top30 = Object.entries(topData.messages)
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
    // Exclure les crimes qui mentionnent le criminel lui-même
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

function getAffaireEmbed(guild, dateKey, wantedID) {
    const top30 = Object.entries(topData.messages)
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

async function sendWantedMessage(target, guild, dateKey, wantedID, authorId, isReply = false) {
    const { embed } = getWantedEmbedData(guild, dateKey, wantedID);
    const prime = Math.floor(seedRndWanted(dateKey * 19) * 95) + 5;
    const nom = guild.members.cache.get(wantedID)?.displayName ?? wantedID;
    try {
        const avatarUrl = guild.members.cache.get(wantedID)?.user.displayAvatarURL({ extension: 'png', size: 512 });
        const imageBuffer = await generateWantedImage(avatarUrl, nom, prime);
        embed.setImage('attachment://wanted.png');
        const payload = { embeds: [embed], files: [{ attachment: imageBuffer, name: 'wanted.png' }], components: [buildWantedRow('avis', authorId)] };
        return isReply ? target.reply(payload) : target.send(payload);
    } catch (e) {
        embed.setThumbnail(guild.members.cache.get(wantedID)?.user.displayAvatarURL({ dynamic: true }));
        const payload = { embeds: [embed], components: [buildWantedRow('avis', authorId)] };
        return isReply ? target.reply(payload) : target.send(payload);
    }
}

async function sendDailyWanted(guild) {
    const now = new Date();
    const dateKey = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
    if (wantedOverride && wantedOverride.dateKey !== dateKey) wantedOverride = null;
    const channel = guild.channels.cache.get('720079691041472572');
    if (!channel) return;
    const wantedID = getWantedOfTheDay(dateKey, guild);
    if (!wantedID) return;
    await channel.send({ content: '# 🚨 AVIS DE RECHERCHE DU JOUR' });
    await sendWantedMessage(channel, guild, dateKey, wantedID, 'daily', false);
}

function scheduleWanted(guild) {
    const now = new Date();
    const parisNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    const next10h = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    next10h.setHours(10, 0, 0, 0);
    if (next10h <= parisNow) next10h.setDate(next10h.getDate() + 1);
    const delay = (next10h - parisNow) + (now - parisNow);
    setTimeout(async () => {
        await sendDailyWanted(guild);
        setInterval(() => sendDailyWanted(guild), 24 * 60 * 60 * 1000);
    }, delay);
    console.log(`⏰ Prochain wanted dans ${Math.floor(delay/3600000)}h${Math.floor((delay%3600000)/60000)}m`);
}

// =========================
//     LOGIQUE MOTUS (10h & 19h)
// =========================

const MOTUS_CHANNEL_ID = '1556089022718152764';
const TWITCH_CHANNEL_ID = '862253918583390238';
const TWITCH_ROLE_ID = '862058765674741760';
const TWITCH_USER = 'epsys_';

const MOTUS_6_LETTRES = [
    "ACTION", "AGENDA", "AIGLES", "ALBUMS", "ALERTE", "AMICAL", "ANANAS", "ANCIEN", "ANNEAU", "APPELS",
    "ARBRES", "ARCHES", "ARGENT", "ARMURE", "ARTIST", "ASPECT", "ASTUCE", "ATTACH", "AUTEUR", "AVENIR",
    "BALLES", "BALLON", "BANANE", "BANDES", "BARQUE", "BASSIN", "BATEAU", "BATTRE", "BEAUTE", "BIAISE",
    "BISTRO", "BLAGUE", "BLASON", "BLESSE", "BLONDE", "BONBON", "BORDEL", "BOTTES", "BOUCLE", "BOUGER",
    "BOUGIE", "BOULES", "BOURSE", "BOUTON", "BRAVES", "BRIQUE", "BRISER", "BRUMES", "BUDGET", "BUFFET",
    "BUREAU", "CABANE", "CADEAU", "CAHIER", "CALCUL", "CAMION", "CANAPE", "CANARD", "CANONS", "CARNET",
    "CARTON", "CASINO", "CASQUE", "CASTEL", "CENTRE", "CERCLE", "CHAINE", "CHAMPS", "CHANCE", "CHAQUE",
    "CHASSE", "CHAUVE", "CHEMIN", "CHEQUE", "CHEVAL", "CHIENS", "CHIMIE", "CHROME", "CHUTES", "CIMENT",
    "CIRQUE", "CITRON", "CLASSE", "CLIENT", "CLIMAT", "CLOWNS", "COFFRE", "COLERE", "COMBAT", "COMETE",
    "COMPTE", "CORDES", "CORONA", "COUSIN", "COTONS", "COUCOU", "COUDES", "COUPLE", "COURIR", "COURTE",
    "CRAYON", "CREPES", "CRIMES", "CRISES", "CROIRE", "CUISIN", "CUIVRE", "DANGER", "DANSER", "DEBATS",
    "DEBOUT", "DEBUTS", "DECHET", "DECIDE", "DECLIC", "DEFAUT", "DEFEND", "DELICE", "DEMAIN", "DEPART",
    "DESSIN", "DESTIN", "DEVANT", "DEVOIR", "DIABLE", "DICTEE", "DIRECT", "DISQUE", "DOUBLE", "DOUCHE",
    "DRAGON", "DRAMES", "DROITE", "ECHECS", "ECLAIR", "ECOLES", "ECORCE", "ECRANS", "ECRIRE", "EFFETS",
    "EFFORT", "EGLISE", "ELANCE", "ENCLOS", "ENFANT", "ENIGME", "ENGINS", "ENTREE", "EPAULE", "EPICES",
    "EPOQUE", "EQUIPE", "ERREUR", "ESPACE", "ESPOIR", "ESPRIT", "ESTIME", "ETAPES", "ETOILE", "EVITER",
    "EXAMEN", "EXPERT", "FACILE", "FARCES", "FARINE", "FAUCON", "FAVEUR", "FEMMES", "FENTES", "FIEVRE",
    "FIGUES", "FIGURE", "FILLES", "FLACON", "FLAMME", "FLECHE", "FLEURS", "FLEUVE", "FORCES", "FORMAT",
    "FOUDRE", "FRANCE", "FRERES", "FROIDE", "FUMEES", "FUSEES", "FUSION", "GAGNER", "GARAGE", "GARCON",
    "GARDES", "GATEAU", "GEANTS", "GENIES", "GENOUX", "GESTES", "GIBIER", "GIRAFE", "GLACES", "GLACON",
    "GLISSE", "GLOBAL", "GOUTER", "GRADES", "GRAINE", "GRAINS", "GRANDE", "GRAPHE", "GROTTE", "GROUPE",
    "GUITARE", "HABITS", "HACHIS", "HALLES", "HAMACS", "HANGAR", "HASARD", "HAUTES", "HERBES", "HEUREUX",
    "HEURES", "HIBOUX", "HIVER", "HOMMES", "HOTELS", "HUILER", "HUMAIN", "HUMOUR", "HYMNES", "ICONES",
    "IDEALS", "IDIOTS", "IMAGES", "IMPACT", "INDICE", "INVITE", "ISOLER", "JAMBES", "JARDIN", "JAUNES",
    "JETONS", "JOCKEY", "JOUETS", "JOURNAL", "JOYEUX", "JUGES", "JUMEAU", "JUNGLE", "JUPES", "JUSTES",
    "LACETS", "LAINES", "LANCER", "LAPINS", "LARGES", "LARMES", "LAVAGE", "LETTRE", "LEVEES", "LIBRES",
    "LIGNES", "LIMITS", "LIONS", "LIVRES", "LOISIR", "LOUVES", "LOYERS", "LUTTES", "MACHIN", "MADAME",
    "MAGIES", "MAIRES", "MAISON", "MALADE", "MANCHE", "MANEGE", "MANGER", "MARAIS", "MARCHE", "MARRON",
    "MASQUE", "MASSES", "MATCHS", "MATINS", "MAUDIT", "MELONS", "MENACE", "MERITE", "MEUBLE", "MICROS",
    "MILIEU", "MINCES", "MINUTE", "MIROIR", "MISERE", "MIXEUR", "MODELE", "MOMENT", "MONDES", "MONTRE",
    "MORDRE", "MOTEUR", "MOTIFS", "MOUCHE", "MOULES", "MOYENS", "MUSEES", "NATION", "NATURE", "NAVIRE",
    "NEIGES", "NOBLES", "NOIRES", "NOTICE", "NOTION", "NUAGES", "NUANCE", "NUMERO", "OBJETS", "OBSCUR",
    "ODEURS", "OEUVRE", "OFFRES", "OIGNON", "OISEAU", "OMBRES", "ONGLES", "ONGLET", "ORAGES", "ORANGE",
    "ORDRES", "ORGANE", "OUVRIR", "PAGNES", "PALAIS", "PANIER", "PANNES", "PAPIER", "PAQUET", "PARADE",
    "PARDON", "PARFUM", "PARLER", "PAROIS", "PARTIR", "PASSER", "PASTEL", "PATRIE", "PATRON", "PAUVRE",
    "PAYSAN", "PECHES", "PELOTE", "PENSEE", "PENTES", "PERLES", "PERMIS", "PETALE", "PHARES", "PHOTOS",
    "PHRASE", "PIGEON", "PILIER", "PILOTE", "PIQUER", "PIRATE", "PISTES", "PLAGES", "PLAINE", "PLANTE",
    "PLAQUE", "PLATRE", "PLEURS", "PLUMES", "POCHES", "POEMES", "POESIE", "POINTS", "POISON", "POULET",
    "POLICE", "POMMES", "PORTES", "POSTES", "POTION", "POUDRE", "POULES", "POUSSE", "PREUVE", "PRIERE",
    "PRINCE", "PRISON", "PRISES", "PROCES", "PROFIL", "PROJET", "PROMET", "PROPRE", "QUATRE", "RACINE",
    "RADARS", "RADIOS", "RAISIN", "RAMPES", "RANGES", "RAPIDE", "RAYONS", "REBORD", "RECITS", "RECORD",
    "REFLET", "REFUGE", "REGARD", "REGLES", "REGRET", "REINES", "RELAIS", "REMEDE", "REMISE", "RENARD",
    "REPOND", "REPOS", "RESEAU", "RESINE", "RESTES", "RETOUR", "REVUES", "RIDEAU", "RISQUE", "RIVAGE",
    "ROCHER", "ROMANS", "ROSACE", "ROUGES", "ROULES", "ROUTES", "RUBANS", "RUINES", "SABLES", "SABRES",
    "SACHET", "SAISON", "SALADE", "SALLES", "SALONS", "SAPINS", "SAUTER", "SAVANT", "SAVEUR", "SAVONS",
    "SCEAUX", "SCENES", "SEJOUR", "SENTIR", "SERVI", "SIECLE", "SIGNAL", "SIGNES", "SIMPLE", "SINGES",
    "SIRENE", "SOEURS", "SOLDAT", "SOLEIL", "SOMMET", "SONGES", "SORTIE", "SOUCIS", "SOUPES", "SOURCE",
    "SOURIS", "SPORTS", "STAGES", "STATUE", "STATUT", "STRESS", "STYLES", "SUCRES", "SUITES", "TABLES",
    "TACHES", "TAILLE", "TALENT", "TALONS", "TAPIS", "TARIFS", "TARTES", "TEINTE", "TEMPLE", "TENDRE",
    "TENUES", "TERMES", "TERRES", "TIGRES", "TISSUS", "TITRES", "TOILES", "TOMBES", "TONNER", "TORDRE",
    "TORTUE", "TOUCHE", "TOURNE", "TOURS", "TRACES", "TRAINS", "TRAITE", "TRAMES", "TRESOR", "TRIBUS",
    "TRICOT", "TRONCS", "TROUPE", "TUBES", "TUMEUR", "TUNNEL", "USINES", "VAGUES", "VALEUR", "VALISE",
    "VALLEE", "VAPEUR", "VEINES", "VENINS", "VENTRE", "VERRES", "VERROU", "VERSES", "VERTUS", "VIANDE",
    "VIBRER", "VICTOR", "VILLES", "VIOLON", "VIRAGE", "VISAGE", "VISITE", "VIVANT", "VOILES", "VOISIN",
    "VOLEUR", "VOYAGE", "WAGONS", "ZEBRES", "ZIGZAG"
].filter(w => w.length === 6);

const MOTUS_7_LETTRES = [
    "ABRICOT", "ANIMAUX", "BAGARRE", "BATEAUX", "BICYCLE", "BISTROT", "BONHEUR", "BOUTEIL", "BUREAUX", "CAPRICE",
    "CHATEAU", "CHOCOLA", "CLAVIER", "COFFRET", "COPAINS", "COULEUR", "COURAGE", "COUTEAU", "CUISINE", "DANGERS",
    "DESTINS", "DIAMANT", "DIPLOME", "DRAPEAU", "ECLIPSE", "ENFANTS", "ENIGMES", "ETOILES", "FAMILLE", "FANTOME",
    "FLAMMES", "FLEUVES", "FORTUNE", "FOUDRES", "FROMAGE", "GALAXIE", "GATEAUX", "GLACONS", "GUITARE", "HORIZON",
    "JOURNAL", "JOURNEE", "JUNGLES", "LANGAGE", "LEGENDE", "LIVRETS", "LUMIERE", "LUNETTE", "MACHINE", "MAISONS",
    "MANIERE", "MARCHAL", "MESSAGE", "MINUTES", "MIRACLE", "MONSTRE", "MUSIQUE", "MYSTERE", "NATIONS", "NAVIGUE",
    "NOUVEAU", "NUMEROS", "OCEANS", "OISEAUX", "ORANGES", "PANIERS", "PAQUETS", "PARFUMS", "PATRONS", "PENSEES",
    "PIERRES", "PLANETE", "POISSON", "POLICES", "POMPIER", "PORTAIL", "POUVOIR", "PRINCES", "PROPOSE", "RACINES",
    "RAYONS", "REGARDS", "RESEAUX", "RIDEAUX", "RIVAGES", "ROCHERS", "SAISONS", "SALADES", "SECRETS", "SERPENT",
    "SILENCE", "SOLEILS", "SOMMETS", "SOURCES", "TABLEAU", "TALENTS", "TORTUES", "TOURNER", "TRAVAIL", "TRESORS",
    "TROUPES", "TUNNELS", "VACANCE", "VALEURS", "VALISES", "VAPEURS", "VICTOIR", "VILLAGE", "VISAGES", "VOITURS",
    "VOYAGES", "VOYANTS", "CIRCULE", "CONSEIL", "CONTACT", "CORRECT", "COURRIER", "CREATIF", "CRISTAL", "CULTURE",
    "DECIDER", "DEFENSE", "DISCUTE", "ECHELLE", "EMOTION", "ENERGIE", "ESPACES", "ESSENCE", "EXEMPLE", "FACTEUR",
    "FESTIFS", "FIDELES", "FINALES", "FLEXION", "FORMULE", "FOULEES", "GLISSES", "HABITAT", "HARMONY", "HAUTEUR",
    "HORREUR", "HUMOURS", "IMPACTY", "INVENTE", "LECTEUR", "LOGIQUE", "LUNAIRE", "MEMOIRE", "MEMBRES", "MENSUEL",
    "NATURES", "OPINION", "ORGANEZ", "ORIGINE", "PARFUME", "PARTAGE", "PASSION", "PENSEUR", "PISTONS", "POETIQUE",
    "PORTIER", "POTIONS", "PRESENT", "RAPIDES", "RECOLTE", "REFLETS", "REGULER", "RELIURE", "REPOSER", "ROBOTIC",
    "SECONDE", "SENTIER", "STATION", "TACTILE", "TEMPLES", "TERRAINS", "THEATRE", "UNIVERS", "VALIDES", "VARIETE"
].filter(w => w.length === 7);

function getMotusDateKey() {
    const now = new Date();
    const paris = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    return paris.getFullYear() * 10000 + (paris.getMonth() + 1) * 100 + paris.getDate();
}

function getMotDuJour(dateKey, longueur = 6) {
    const dico = longueur === 7 ? MOTUS_7_LETTRES : MOTUS_6_LETTRES;
    const seedOffset = longueur === 7 ? 777 : 42;
    let x = Math.sin(dateKey + seedOffset) * 10000;
    const rnd = x - Math.floor(x);
    return dico[Math.floor(rnd * dico.length)];
}

function evaluerMotus(guess, solution, longueur = 6) {
    const res = Array(longueur).fill('⬛');
    const solLettres = solution.split('');
    const guessLettres = guess.split('');
    const restantes = {};

    for (const l of solLettres) restantes[l] = (restantes[l] || 0) + 1;

    // 1ère passe : lettres bien placées (Vert)
    for (let i = 0; i < longueur; i++) {
        if (guessLettres[i] === solLettres[i]) {
            res[i] = '🟩';
            restantes[guessLettres[i]]--;
        }
    }

    // 2ème passe : lettres mal placées (Jaune)
    for (let i = 0; i < longueur; i++) {
        if (res[i] === '🟩') continue;
        const l = guessLettres[i];
        if (restantes[l] > 0) {
            res[i] = '🟨';
            restantes[l]--;
        }
    }

    return res.join('');
}

function buildMotusEmbed(mot, dateKey, longueur = 6) {
    const premiereLettre = mot.charAt(0);
    const masque = `${premiereLettre} ` + '_ '.repeat(longueur - 1).trim();
    const estDifficile = longueur === 7;
    const titre = estDifficile ? '🟥 MOTUS DU SOIR — DIFFICILE (19h) 🟥' : '🟩 MOTUS DU MATIN (10h) 🟩';
    const couleur = estDifficile ? 0xe74c3c : 0x00b0f4;

    return new EmbedBuilder()
        .setColor(couleur)
        .setTitle(titre)
        .setDescription(
            `Le Motus est ouvert pendant **1 heure pile** !\n\n` +
            `🔤 **Mot à trouver :** \`${masque}\` (${longueur} lettres)\n` +
            `🎯 **Règle :** Tu as **3 essais individuels** pour trouver le mot !\n` +
            `⏳ **Temps limite :** 1 heure (fermeture et révélation du mot à ${estDifficile ? '20h00' : '11h00'})\n\n` +
            `🟩 **Vert** : Lettre bien placée\n` +
            `🟨 **Jaune** : Lettre présente mais mal placée\n` +
            `⬛ **Noir** : Lettre absente\n\n` +
            `*Écris simplement un mot de ${longueur} lettres commençant par **${premiereLettre}** dans ce salon !*`
        )
        .setFooter({ text: 'Rendez-vous à 10h (6 lettres) et 19h (7 lettres) ! • !motus pour le statut' });
}

function buildMotusStatsEmbed(cible, interactionUser) {
    const s = motusStats[cible.id] ?? { victoires: 0, parties: 0 };
    const pct = s.parties > 0 ? Math.round((s.victoires / s.parties) * 100) : 0;
    return new EmbedBuilder()
        .setColor(0x00b0f4)
        .setTitle(`📊 Statistiques Motus de ${cible.displayName}`)
        .addFields(
            { name: '🏆 Victoires', value: `**${s.victoires}**`, inline: true },
            { name: '🎮 Parties jouées', value: `**${s.parties}**`, inline: true },
            { name: '📈 Taux de réussite', value: `**${pct}%**`, inline: true }
        )
        .setFooter({ text: 'Motus 10h & 19h • Regaïa' });
}

async function envoyerMotusQuotidien(guild, heureSession = 10) {
    const channel = guild.channels.cache.get(MOTUS_CHANNEL_ID);
    if (!channel) return;

    const dateKey = getMotusDateKey();
    const longueur = heureSession === 19 ? 7 : 6;
    const sessionKey = `${dateKey}_${heureSession}h`;
    const mot = getMotDuJour(dateKey + (heureSession === 19 ? 999 : 0), longueur);
    const expireAt = Date.now() + 60 * 60 * 1000; // 1 heure de jeu pile

    motusData = {
        dateKey: sessionKey,
        mot: mot,
        longueur: longueur,
        expireAt: expireAt,
        heureSession: heureSession,
        termine: false,
        vainqueurId: null,
        tentatives: {},
        messageId: null
    };

    const embed = buildMotusEmbed(mot, dateKey, longueur);
    const texteAnnonce = heureSession === 19 
        ? '# 🟥 LE MOTUS DU SOIR (7 LETTRES - 1H) EST LANCÉ !' 
        : '# 🟩 LE MOTUS DU MATIN (6 LETTRES - 1H) EST LANCÉ !';

    const sent = await channel.send({ content: texteAnnonce, embeds: [embed] });
    motusData.messageId = sent.id;
    demanderSauvegarde();
}

function tempsAvantProchainMotus() {
    const now = new Date();
    const parisNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    const h = parisNow.getHours();

    let cible = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    let sessionNom = "10h00 (6 lettres)";
    let jourStr = "aujourd'hui";

    if (h < 10) {
        cible.setHours(10, 0, 0, 0);
        sessionNom = "10h00 (6 lettres)";
    } else if (h < 19) {
        cible.setHours(19, 0, 0, 0);
        sessionNom = "19h00 (7 lettres - Difficile)";
    } else {
        cible.setDate(cible.getDate() + 1);
        cible.setHours(10, 0, 0, 0);
        sessionNom = "10h00 (6 lettres)";
        jourStr = "demain";
    }

    const diff = cible - parisNow;
    const heures = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    return { jourStr, heures, minutes, sessionNom, timestamp: Math.floor((Date.now() + diff) / 1000) };
}

// =========================
//     DÉCODEUR D'EMOJIS (15h)
// =========================

const REBUS_FILMS = [
    ["👨‍🍳🐀🥖", "ratatouille"], ["🚢🧊💔", "titanic"], ["🦁👑🌅", "le roi lion", "roi lion"], ["🦖🏞️🚙", "jurassic park"], ["⚡🧙‍♂️👓", "harry potter"],
    ["🌌⚔️🪐", "star wars", "la guerre des etoiles"], ["🕶️💊🟢", "matrix"], ["🌀💤⏳", "inception"], ["🚗⚡🕒", "retour vers le futur"], ["⚔️🏛️🛡️", "gladiator"],
    ["💍🌋🧝‍♂️", "le seigneur des anneaux", "seigneur des anneaux"], ["🕷️🕸️🏙️", "spider-man", "spiderman"], ["🦇🃏🌃", "batman"], ["🤡🃏🩸", "joker"], ["🧅💚🫏", "shrek"],
    ["🤠🧸🚀", "toy story"], ["🐑🤫🍷", "le silence des agneaux", "silence des agneaux"], ["🏴‍☠️🧭🦜", "pirates des caraibes"], ["🏃‍♂️🍫🦐", "forrest gump"], ["🥊🧼💥", "fight club"],
    ["🍔💃🕺", "pulp fiction"], ["🪓🏨🚪", "shining"], ["🤠🐍💎", "indiana jones"], ["👽🚀🥚", "alien"], ["🤖🕶️🏍️", "terminator"],
    ["👉🚲🌕", "et l extraterrestre", "et"], ["🎹💃🌆", "la la land"], ["🚀⏳🕳️", "interstellar"], ["💣🎩⚛️", "oppenheimer"], ["💖👠🎀", "barbie"],
    ["🎸💀🌺", "coco"], ["🌊⛵🌀", "vaiana", "moana"], ["🎈🏠👴", "la haut", "up"], ["🚪👧👁️", "monstres et cie", "monstres et compagnie"], ["🐠🌊🔍", "le monde de nemo", "nemo"],
    ["🦸‍♂️👨‍👩‍👧‍👦💥", "les indestructibles", "indestructibles"], ["🏎️🏁⚡", "cars"], ["🦎💇‍♀️🏰", "raiponce"], ["❄️👭⛄", "la reine des neiges", "reine des neiges"], ["🦊🐰🚔", "zootopie"],
    ["🧠😢😡", "vice-versa", "vice versa"], ["🐼🔴👧", "alerte rouge"], ["🌱🤖🚀", "wall-e", "walle"], ["🤠⛓️🩸", "django unchained", "django"], ["🟡🗡️🥋", "kill bill"],
    ["🚕💨🚓", "taxi"], ["🧑‍🦽🤝🧑🏿", "intouchables"], ["🥄☕🥖", "le fabuleux destin d amelie poulain", "amelie poulain"], ["🔥🏙️💥", "la haine"], ["🏺👃👑", "asterix et obelix mission cleopatre", "mission cleopatre"],
    ["🕵️‍♂️🇪🇬🐫", "oss 117"], ["🍟🍺🌧️", "bienvenue chez les ch tis", "bienvenue chez les chtis"], ["🦆🥪🍷", "le diner de cons", "diner de cons"], ["🏰⚔️🧙‍♂️", "les visiteurs"], ["👑🍷🥩", "kaamelott"],
    ["👻🚫🔫", "ghostbusters", "sos fantomes"], ["🎲🦏🌿", "jumanji"], ["🕶️👽👔", "men in black", "mib"], ["🏹🔥🕊️", "hunger games"], ["🧛‍♂️🍎🐺", "twilight"],
    ["🏃‍♂️🧱🌿", "le labyrinthe", "labyrinthe"], ["🚕👩‍🦰💥", "le cinquieme element", "cinquieme element"], ["🪴🥛🔫", "leon"], ["💊🧠🧬", "lucy"], ["🍊🍝🔫", "le parrain", "parrain"],
    ["🏔️❄️🩸", "scarface"], ["💵🎰🔫", "casino"], ["🚗👴🔫", "gran torino"], ["🥊👩🩸", "million dollar baby"], ["🪓🪪🩸", "american psycho"], ["✂️👐🌳", "edward aux mains d argent", "edward"],
    ["🪲🧃👻", "beetlejuice"], ["👰💀💍", "les noces funebres", "noces funebres"], ["🎃👑🐕", "l etrange noel de monsieur jack"], ["🍫🎩🏭", "charlie et la chocolaterie"], ["🐇🫖🎩", "alice au pays des merveilles"],
    ["🎩🕊️⚡", "le prestige", "prestige"], ["⏳🔁🔄", "tenet"], ["🏖️🪖💥", "dunkerque"], ["🏝️🧠🏨", "shutter island"], ["📈🍾🐒", "le loup de wall street", "loup de wall street"],
    ["🍸🎷🥂", "gatsby le magnifique", "gatsby"], ["📺⛵🚪", "the truman show", "truman show"], ["🎭🟢🟨", "the mask", "the mask"], ["🙏⚡🌍", "bruce tout-puissant", "bruce tout puissant"], ["🤪🚗🏨", "dumb and dumber"],
    ["🤫📞🔪", "scream"], ["🔪🎃🩸", "halloween"], ["🏒🏕️🔪", "vendredi 13"], ["😴🧤🔪", "freddy les griffes de la nuit", "freddy"], ["🪚🩸🧩", "saw"],
    ["👻🏚️📹", "conjuring"], ["👧👗🩸", "annabelle"], ["🎈🤡🌧️", "ca", "it"], ["📹👻🛋️", "paranormal activity"], ["☕🥄🌀", "get out"],
    ["✂️🔴🧑‍🤝‍🧑", "us"], ["🤫👣👂", "sans un bruit"], ["🙈🐦🛶", "bird box"], ["🧟‍♂️☣️🏙️", "je suis une legende"], ["🧟‍♂️✈️🧱", "world war z"],
    ["🧟‍♂️🏏🍻", "shaun of the dead"], ["🧟‍♂️🎢🤡", "zombieland", "bienvenue a zombieland"], ["🏺📜🧟‍♂️", "la momie", "momie"], ["🦍🏙️✈️", "king kong"], ["🦎☢️🌊", "godzilla"],
    ["🚗🤖💥", "transformers"], ["🤖🌊👾", "pacific rim"], ["🏎️💨👨‍👩‍👧‍👦", "fast and furious"], ["🚗🎧🕶️", "baby driver"], ["🚗🔨🦂", "drive"],
    ["🐶🔫🕶️", "john wick"], ["📞🥋🔫", "taken"], ["⚖️🔫🔨", "equalizer"], ["☂️🥃👔", "kingsman"], ["💣👓🏃‍♂️", "mission impossible"],
    ["🍸🔫🤵", "james bond", "007"], ["🏢🦹‍♂️🦶", "die hard", "piege de cristal"], ["✈️🕶️🏍️", "top gun"], ["☄️👨‍🚀💥", "armageddon"], ["🌊❄️🗽", "le jour d apres"],
    ["🌋🏢💥", "2012"], ["🚀👩‍🚀🌍", "gravity"], ["🥔👨‍🚀🌱", "seul sur mars"], ["🛸👽🔤", "premier contact"], ["🦐👽🏙️", "district 9"],
    ["🤖🦿🩸", "robocop"], ["🏜️🛢️🎸", "mad max", "mad max fury road"], ["🚂❄️🥩", "snowpiercer"], ["📱❤️🤖", "her"], ["🤖💃🧬", "ex machina"],
    ["🏜️🪱👁️", "dune"], ["🦸‍♂️🔨⚡", "thor"], ["🦸‍♂️🛡️🇺🇸", "captain america"], ["🦸‍♂️🤖❤️", "iron man"], ["🦹‍♂️🧤💎", "avengers", "avengers infinity war"],
    ["🦝🌳🎧", "les gardiens de la galaxie", "gardiens de la galaxie"], ["🧙‍♂️👁️🌀", "doctor strange"], ["🗡️🔴🤪", "deadpool"], ["🐺🦾🩸", "wolverine", "logan"], ["🦸‍♂️🦽👨‍🦲", "x-men", "xmen"],
    ["🔱🌊🦈", "aquaman"], ["⚔️🛡️👩", "wonder woman"], ["🦸‍♂️🔴🟦", "superman"], ["⚡🏃‍♂️⚡", "flash"], ["⚡🧒🦸‍♂️", "shazam"],
    ["🦹‍♀️🏏💥", "suicide squad"], ["🎮🕹️👾", "pixels"], ["🕶️🕹️🏎️", "ready player one"], ["💾🏍️🔵", "tron"], ["⚔️🧙‍♂️🐺", "warcraft"],
    ["⚡🐭🔍", "detective pikachu"], ["🦔💨💍", "sonic"], ["🍄👨🏻🔧", "super mario bros", "mario"], ["🐻🍕🎤", "five nights at freddys", "fnaf"], ["🏴‍☠️🗺️🧭", "uncharted"],
    ["🏹🏺🧗‍♀️", "tomb raider"], ["🧟‍♀️🔫🏢", "resident evil"], ["🌫️📻🪓", "silent hill"], ["🗡️🦅🥷", "assassins creed"], ["🦖🏹🍖", "monster hunter"],
    ["🏎️🎮🏁", "gran turismo"], ["🗡️⏳👑", "prince of persia"], ["🥋🐉💥", "mortal kombat"], ["🚀🌕👨‍🚀", "apollo 13"], ["🐁⚡🪑", "la ligne verte", "ligne verte"],
    ["🔨⛏️🌧️", "les evades"], ["🎹🎼🏚️", "le pianiste"], ["📋🕯️🚂", "la liste de schindler", "schindler"], ["🏖️🪖🎖️", "il faut sauver le soldat ryan", "soldat ryan"], ["🪖🏃‍♂️✉️", "1917"],
    ["🔥🚁📻", "apocalypse now"], ["🪖🍩🪞", "full metal jacket"], ["🚂🔥💣", "le pont de la riviere kwai"], ["🔥👧🍬", "le tombeau des lucioles"], ["🐉🏯🏮", "le voyage de chihiro"],
    ["🐺🏹🌲", "princesse mononoke"], ["🏰💨🔥", "le chateau ambulant"], ["🐱🚌☂️", "mon voisin totoro", "totoro"], ["☄️👧👦", "your name"], ["🦈🩸🏖️", "les dents de la mer", "jaws"],
    ["🚿🔪😱", "psycho", "psychose"], ["🪟📸👀", "fenetre sur cour"], ["🐦🕊️👀", "les oiseaux"], ["🌂👜✨", "mary poppins"], ["🌈👠🌪️", "le magicien d oz"],
    ["🐎🏟️🏛️", "ben-hur", "ben hur"], ["⚔️🏴󠁧󠁢󠁳󠁣󠁴󠁿🛡️", "braveheart"], ["🗡️🌸🇯🇵", "le dernier samourai"], ["🐎🏛️🏹", "troie"], ["🛡️🩸⚔️", "300"],
    ["🏰⚔️🕌", "kingdom of heaven"], ["🏹🌲👑", "robin des bois"], ["🗡️🪨👑", "arthur", "excalibur"], ["🛸🌾🌽", "signes"], ["👽🚲☎️", "e.t."]
];

const REBUS_JEUX = [
    ["🧱⛏️🧟", "minecraft"], ["🚗💰🔫", "gta", "grand theft auto"], ["🪂🔫🕺", "fortnite"], ["⚔️🧙‍♀️🛡️", "league of legends", "lol"], ["🎯🔫💣", "valorant"],
    ["🤖🛡️🔫", "overwatch"], ["💣📦🎯", "counter strike", "csgo", "cs2"], ["🪖🔫🛩️", "call of duty", "cod"], ["🚁💥🪖", "battlefield"], ["🧱🔫🛡️", "rainbow six siege", "r6"],
    ["🏃‍♂️💨🔫", "apex legends", "apex"], ["🍳🪂🔫", "pubg"], ["🚗⚽🚀", "rocket league"], ["⚽👟🎮", "fifa", "ea fc"], ["🏀👟⛹️", "nba 2k", "2k"],
    ["🗡️🦅🦹🥷", "assassins creed"], ["🐺⚔️🧙‍♂️", "the witcher", "witcher"], ["🦾🌆🚗", "cyberpunk 2077", "cyberpunk"], ["🐲⚔️📜", "skyrim", "the elder scrolls"], ["☢️🥤🤠", "fallout"],
    ["🔥💀⚔️", "dark souls"], ["🩸🌕🐺", "bloodborne"], ["💍🌳⚔️", "elden ring"], ["🗡️🌸🥷", "sekiro"], ["🛡️🏰👹", "demon souls", "demons souls"],
    ["🗡️🛡️🧝", "zelda", "breath of the wild", "tears of the kingdom"], ["🍄👨🏻🧢", "mario", "super mario", "super mario odyssey"], ["🏎️🍌🍄", "mario kart"], ["🥊🍄⚔️", "super smash bros", "smash bros"], ["⚡🐭🔴", "pokemon"],
    ["🏝️🦝🔔", "animal crossing"], ["🦑🔫🎨", "splatoon"], ["🚀👩‍🚀👾", "metroid"], ["🌸⭐🍭", "kirby"], ["🦍🍌🌴", "donkey kong"],
    ["🦔💨💍", "sonic"], ["🧱🧩⬇️", "tetris"], ["🟡👻🍒", "pac-man", "pacman"], ["👾🚀🔫", "space invaders"], ["🥋🥊🔥", "street fighter"],
    ["🥊🥋⚡", "tekken"], ["🩸🥋💀", "mortal kombat"], ["🐉⚡🥋", "dragon ball fighterz", "dbfz"], ["🪓🩸🏛️", "god of war"], ["🍄🧟‍♂️👧", "the last of us", "tlou"],
    ["🏴‍☠️🧭🧗", "uncharted"], ["🕷️🕸️🏙️", "spider-man", "spiderman"], ["🏹🤖🦕", "horizon", "horizon zero dawn"], ["🗡️🌸🎭", "ghost of tsushima"], ["📦👶🌧️", "death stranding"],
    ["📦🐍🔫", "metal gear solid", "mgs"], ["🧟‍♂️🌿🔫", "resident evil"], ["🌫️📻🪓", "silent hill"], ["🚀👨‍🚀🧟", "dead space"], ["📹😱🏃", "outlast"],
    ["🏰🕯️😱", "amnesia"], ["🐻🍕🎤", "five nights at freddys", "fnaf"], ["🧸🏭😱", "poppy playtime"], ["🖋️😈📜", "bendy", "bendy and the ink machine"], ["🏡🕵️‍♂️🔑", "hello neighbor"],
    ["🌲📄😱", "slender", "slenderman"], ["👻📻🔦", "phasmophobia"], ["🔩🏭👹", "lethal company"], ["🚀🔪🕵️", "among us"], ["🏃‍♂️👑🤹", "fall guys"],
    ["🧱🎮🌍", "roblox"], ["🔧🛠️🔫", "garrys mod", "gmod"], ["🔵🟠🔫", "portal"], ["🔬👨‍🔬👽", "half-life", "half life"], ["🧟‍♂️💊🏃", "left 4 dead", "l4d"],
    ["🎩🔫💼", "team fortress 2", "tf2"], ["🌊🏙️💉", "bioshock"], ["🗡️🐀🎭", "dishonored"], ["☕👽🌀", "prey"], ["🪓🔥👹", "doom"],
    ["🪖🔫🏰", "wolfenstein"], ["🚀🔫👽", "halo"], ["🌌🔫👑", "destiny"], ["⚙️🪖🩸", "gears of war"], ["🏴‍☠️⛵💀", "sea of thieves"],
    ["🏎️🇲🇽🏖️", "forza", "forza horizon"], ["🏎️🚓💨", "need for speed", "nfs"], ["🏎️🏁🏆", "gran turismo"], ["🏎️💥🔥", "burnout"], ["🏎️✈️🚤", "the crew"],
    ["🏎️🏁🏎️", "f1", "formula 1"], ["🤠🐎💰", "red dead redemption", "rdr2"], ["🏫🎒🥊", "bully", "canis canem edit"], ["💊🔫❄️", "max payne"], ["🕵️‍♂️💼🔍", "la noire"],
    ["🎩🔫🚗", "mafia"], ["🥋🍜🔫", "sleeping dogs"], ["📱💻🦹", "watch dogs"], ["🌴🚜💣", "far cry"], ["❄️🏙️🎒", "the division"],
    ["🕶️🤫🔫", "splinter cell"], ["🕴️💼🔫", "hitman"], ["🏹🏺🧗", "tomb raider"], ["🦾🕶️🧬", "deus ex"], ["🚀👽🌌", "mass effect"],
    ["🐉⚔️🏰", "dragon age"], ["🎲⚔️🧙", "baldurs gate", "baldurs gate 3"], ["👿🔥🗡️", "diablo"], ["⚔️🛡️🏰", "world of warcraft", "wow"], ["🚀🐜🤖", "starcraft"],
    ["🃏🧝‍♂️✨", "hearthstone"], ["🗡️🧝‍♀️✨", "final fantasy"], ["🗝️🏰👑", "kingdom hearts"], ["🦖🏹🍖", "monster hunter"], ["🎭🏫🐱", "persona"],
    ["🐉🥊🥋", "yakuza", "like a dragon"], ["🤖👗🗡️", "nier automata", "nier"], ["✨🧚‍♀️⚔️", "genshin impact", "genshin"], ["🚂✨🌌", "honkai star rail"], ["🏰⚔️🛡️", "clash of clans"],
    ["👑🏰🃏", "clash royale"], ["🌵🔫⭐", "brawl stars"], ["🏃‍♂️🚇🛹", "subway surfers"], ["🏃‍♂️🐒💎", "temple run"], ["🍬🍭🔨", "candy crush"],
    ["🐦🟩🚀", "flappy bird"], ["🐦🐷💥", "angry birds"], ["🌻🧟‍♂️🧠", "plants vs zombies"], ["🍉🍌🗡️", "fruit ninja"], ["🟨🎶🔺", "geometry dash"],
    ["❤️💀🦴", "undertale"], ["👑🐐🗡️", "deltarune"], ["🪲⚔️🕸️", "hollow knight"], ["🍓🧗‍♀️🏔️", "celeste"], ["☕🎲😈", "cuphead"],
    ["🗡️🩸🚪", "dead cells"], ["🔥🏛️🗡️", "hades"], ["🃏🧗‍♂️🗼", "slay the spire"], ["👶😢💩", "the binding of isaac", "isaac"], ["🔫🏰🗝️", "enter the gungeon"],
    ["🌳⛏️🏰", "terraria"], ["🌾🚜🐔", "stardew valley"], ["🌲🔥🥩", "dont starve", "don't starve"], ["🌊🦈🚀", "subnautica"], ["🪵🌊🦈", "raft"],
    ["🌲🪓🧟", "the forest"], ["🪨☢️🏠", "rust"], ["🦕🦖🍖", "ark", "ark survival evolved"], ["🧟‍♂️🥫🎒", "dayz"], ["🔪🩸🔦", "dead by daylight", "dbd"],
    ["🎭💰🏦", "payday"], ["🤖🥷🚀", "warframe"], ["🚀🌌🪐", "no mans sky", "no man's sky"], ["🚀🐸💥", "kerbal space program"], ["🏙️🛣️🏗️", "cities skylines"],
    ["👨‍👩‍👧‍👦🏠💚", "les sims", "sims"], ["🎢🎡🎪", "rollercoaster tycoon"], ["🏛️👑🗺️", "civilization", "civ"], ["🏰⚔️🌾", "age of empires"], ["⚔️🏰🗺️", "total war"],
    ["👑🏰🩸", "crusader kings"], ["⚙️🏭🚂", "factorio"], ["☕🏭📦", "satisfactory"], ["🏢👮‍♂️🔑", "prison architect"], ["🍳🔥🍽️", "overcooked"],
    ["👫🧩🔨", "it takes two"], ["🏃‍♂️🔗🏃‍♂️", "a way out"], ["💣⏰🗣️", "keep talking and nobody explodes"], ["📦🛋️✨", "unpacking"], ["🐱🎒🤖", "stray"],
    ["🐐🤪💥", "goat simulator"], ["🍞🔥🍞", "i am bread"], ["🐙👔👨", "octodad"], ["👨‍⚕️🔪🫀", "surgeon simulator"], ["🪿🔔🧲", "untitled goose game", "goose game"],
    ["🪓🏺🧗", "getting over it"], ["👑🧗‍♂️🏰", "jump king"], ["📦🧗‍♂️☁️", "only up"], ["👧🧥🏮", "little nightmares"], ["🕷️🌲💀", "limbo"],
    ["🐷🧒🔴", "inside"], ["🥋👴👊", "sifu"], ["🐑👑🩸", "cult of the lamb"], ["🍣🤿🐟", "dave the diver"], ["🃏🤡♠️", "balatro"],
    ["🔫🦙🏰", "palworld"], ["🪖🤖🐛", "helldivers", "helldivers 2"], ["🐒👑🥋", "black myth wukong", "wukong"], ["⚔️🏺🏛️", "titan quest"], ["🚗⚽🔥", "supersonic acrobatic rocket-powered battle-cars"]
];

const REBUS_SERIES = [
    ["🧪⚗️🚐", "breaking bad"], ["⚖️👨‍💼📱", "better call saul"], ["👑🐉❄️", "game of thrones", "got"], ["🐉🏰👸", "house of the dragon"], ["🚲🧇🔦", "stranger things"],
    ["🧟‍♂️🏕️🏹", "the walking dead", "twd"], ["🍄👧🎒", "the last of us", "tlou"], ["🥃🚬🎩", "peaky blinders"], ["🦑👧🔴", "squid game"], ["🎭🏦💰", "la casa de papel", "casa de papel"],
    ["😈🍷🎹", "lucifer"], ["🕵️‍♂️🎻🇬🇧", "sherlock"], ["⏳🟦🚪", "doctor who"], ["📱👁️🪞", "black mirror"], ["⏳🌧️☢️", "dark"],
    ["☕🛋️👫", "friends"], ["☂️💛🍺", "how i met your mother", "himym"], ["⚛️🛋️🤓", "the big bang theory", "tbbt"], ["👮‍♂️🍩🏢", "brooklyn nine-nine", "b99"], ["📄🏢☕", "the office"],
    ["🌳🏞️🧇", "parks and recreation"], ["🧒📺🎳", "malcolm"], ["👨‍👩‍👧‍👦🏠🧢", "ma famille d abord"], ["🧒🏾🏫😭", "tout le monde deteste chris"], ["👑🍷🥩", "kaamelott"],
    ["☕🏢📹", "camera cafe"], ["👴👵🛋️", "scenes de menages"], ["👨‍⚕️🏥🤪", "h"], ["⏱️⚡💨", "bref"], ["🎭💼⭐", "dix pour cent"],
    ["🎩💎🗼", "lupin"], ["🕵️‍♂️🕶️🏢", "le bureau des legendes"], ["🗳️🏛️🇫🇷", "baron noir"], ["👮‍♀️⚖️🏢", "engrenages"], ["☀️🏢🌊", "plus belle la vie"],
    ["👫🛋️🍷", "un gars une fille"], ["⛓️🗺️🏃‍♂️", "prison break"], ["✈️🏝️💨", "lost"], ["🧬🦸‍♂️💥", "heroes"], ["⏰💣🔫", "24 heures chrono", "24"],
    ["🩸🔪💉", "dexter"], ["🕵️‍♀️🇺🇸💣", "homeland"], ["🍎🏘️🤫", "desperate housewives"], ["👨‍⚕️👩‍⚕️🏥", "greys anatomy", "grey's anatomy"], ["👨‍⚕️💊🦯", "dr house", "house"],
    ["👨‍⚕️🩺🧩", "good doctor"], ["👨‍⚕️🏥🎵", "scrubs"], ["🚑🏥🩸", "urgences", "er"], ["🪓⛵🛡️", "vikings"], ["👑🇬🇧🏰", "the crown"],
    ["🏰🎩☕", "downton abbey"], ["💌👒🐝", "la chronique des bridgerton", "bridgerton"], ["⏳🏴󠁧󠁢󠁳󠁣󠁴󠁿❤️", "outlander"], ["🕊️🔫🦸", "peacemaker"], ["🦸‍♂️🩸😈", "the boys"],
    ["🦸‍♂️🩸🧒", "gen v"], ["🦯🔴🥋", "daredevil"], ["🥃📸👊", "jessica jones"], ["💀🔫🩸", "the punisher"], ["📺🪄❤️", "wandavision"],
    ["⏳🟢🐊", "loki"], ["🤠👶🚀", "the mandalorian", "mandalorian"], ["🚀🪖⚙️", "andor"], ["⚔️🏜️🧙‍♂️", "obi-wan kenobi", "obi wan"], ["🐺⚔️🧙‍♂️", "the witcher"],
    ["👧🖤✋", "mercredi", "wednesday"], ["🥋🐍🏆", "cobra kai"], ["🏫🍆🚲", "sex education"], ["💊✨😢", "euphoria"], ["💊🇬🇧🎉", "skins"],
    ["🧢🥤🕵️", "riverdale"], ["💋👠🍸", "gossip girl"], ["🤫📱✉️", "pretty little liars"], ["🏫🍾🩸", "elite"], ["🎧📼💔", "13 reasons why"],
    ["🧢📖🔪", "you"], ["🧡⛓️👩", "orange is the new black"], ["🌿💰🔫", "narcos"], ["💵🛶💼", "ozark"], ["🧠🔍🕵️", "mindhunter"],
    ["❄️🩸🕵️", "fargo"], ["🏍️💀🔫", "sons of anarchy"], ["📻📦👮", "the wire"], ["🍝🔫🕶️", "les soprano", "the sopranos"], ["🚬🍸🏢", "mad men"],
    ["💼🚁👴", "succession"], ["🏨🌺🍸", "the white lotus"], ["☢️🏭📉", "chernobyl"], ["🪖🎖️🌍", "band of brothers", "freres d armes"], ["🤠🤖🏜️", "westworld"],
    ["🔴👗🤰", "the handmaids tale", "la servante ecarlate"], ["👻🚗🗡️", "supernatural"], ["🧛‍♂️🩸🐺", "the vampire diaries"], ["🧛‍♂️⚜️👑", "the originals"], ["🐺🏈🌕", "teen wolf"],
    ["🏹🟢🦹", "arrow"], ["⚡🏃‍♂️🔴", "the flash", "flash"], ["🌾🦸‍♂️🚜", "smallville"], ["✨🧙‍♀️📖", "charmed"], ["🧛‍♀️🗡️⚰️", "buffy contre les vampires", "buffy"]
];

const REBUS_ANIMES = [
    ["📓🍎✍️", "death note"], ["⚔️🧱🍖", "l attaque des titans", "snk", "attack on titan"], ["⚔️👹🐗", "demon slayer", "kimetsu no yaiba"], ["🤞👁️🥋", "jujutsu kaisen", "jjk"], ["🦸‍♂️🥦💥", "my hero academia", "mha"],
    ["🍥🦊🍜", "naruto", "naruto shippuden"], ["🐉⚡🥋", "dragon ball", "dragon ball z", "dbz"], ["🏴‍☠️👒🍖", "one piece"], ["🎣⚡🐜", "hunter x hunter", "hxh"], ["🗡️👻👘", "bleach"],
    ["🦾🤖⚗️", "fullmetal alchemist", "fma", "brotherhood"], ["☕👁️🩸", "tokyo ghoul"], ["⚔️🎮🏰", "sword art online", "sao"], ["🪚😈🩸", "chainsaw man"], ["🕵️‍♂️👧🥜", "spy x family"],
    ["🛵⏳👊", "tokyo revengers"], ["🤖🩸👼", "evangelion", "neon genesis evangelion"], ["🎷🚀🚬", "cowboy bebop"], ["👁️👑♟️", "code geass"], ["🔬🍌⏳", "steins gate"],
    ["🥦🧂👻", "mob psycho 100"], ["🥊👨‍🦲💥", "one punch man"], ["🪓⛵⚔️", "vinland saga"], ["⭐👊🧛", "jojo", "jojos bizarre adventure"], ["🍸♟️💀", "death parade"],
    ["🦠✋🩸", "parasyte"], ["🔫🧠🏢", "psycho-pass"], ["👨‍⚕️🇩🇪💉", "monster"], ["🏐🐦💥", "haikyuu", "haikyu"], ["🏀🔴⚡", "kuroko no basket", "kuroko"],
    ["⚽⛓️🔥", "blue lock"], ["🏀⛹️‍♂️💥", "slam dunk"], ["🏎️⛰️💨", "initial d"], ["👓💊🕵️", "detective conan"], ["⚡🐭🔴", "pokemon"],
    ["🃏👁️🐉", "yu-gi-oh", "yugioh"], ["🌀🦁⚡", "beyblade"], ["🦖🦕🥚", "digimon"], ["🌙🎀🐱", "sailor moon"], ["🌸👧🗝️", "cardcaptor sakura", "sakura"],
    ["🧙‍♂️🗝️🔥", "fairy tail"], ["🍺🐷⚔️", "seven deadly sins", "nanatsu no taizai"], ["🍀🗡️😈", "black clover"], ["🧪🗿⚡", "dr stone"], ["🚒🔥🧑‍🚒", "fire force"],
    ["💀🧙‍♀️🗡️", "soul eater"], ["🐙🏫🎯", "assassination classroom"], ["⚔️🪙👘", "noragami"], ["🗡️🔥✝️", "blue exorcist", "ao no exorcist"], ["🗡️🩸🦾", "berserk"],
    ["🩸🧛‍♂️🔫", "hellsing"], ["🏍️💊💥", "akira"], ["🤖🧠⚙️", "ghost in the shell"], ["🏹🌸🐕", "inuyasha"], ["🥋🐼♨️", "ranma 1/2", "ranma"],
    ["⚽🥅🏃", "olive et tom", "captain tsubasa"], ["🐎🏛️✨", "les chevaliers du zodiaque", "saint seiya"], ["👊💥💀", "ken le survivant", "hokuto no ken"], ["🔫🐦🏙️", "nicky larson", "city hunter"], ["🦾🔫🚬", "cobra"],
    ["🤖🛸🪐", "goldorak"], ["🚬🏍️👨‍🏫", "gto", "great teacher onizuka"], ["🐯🏫❤️", "toradora"], ["🎹🎻😭", "your lie in april"], ["🍞👨‍👩‍👧😭", "clannad"],
    ["🌸👻😭", "anohana"], ["✉️🦾😭", "violet evergarden"], ["❤️🧠🔫", "kaguya-sama", "love is war"], ["⭐🎤🩸", "oshi no ko"], ["🧝‍♀️🪄⏳", "frieren"],
    ["🏡👧👦", "the promised neverland"], ["🕳️🎈🤖", "made in abyss"], ["🔁🩸🍎", "re:zero", "rezero"], ["💥🐸🧙‍♀️", "konosuba"], ["💀👑🏰", "overlord"],
    ["🎲👑👧", "no game no life"], ["🧙‍♂️🦯👶", "mushoku tensei"], ["🟦🗡️👑", "moi quand je me reincarne en slime", "slime"], ["🗡️🕶️📱", "solo leveling"], ["⏳🧒🩸", "erased"],
    ["🐟🗽🔫", "banana fish"], ["🗡️🦿👹", "dororo"], ["🥊🔥🏆", "hajime no ippo"], ["🧑‍🍳🔥🍲", "food wars", "shokugeki no soma"], ["🦾🌆🔫", "cyberpunk edgerunners", "edgerunners"],
    ["🧁🥊🔧", "arcane"], ["🧛‍♂️🩸🏛️", "castlevania"], ["📚✍️🕵️", "bungo stray dogs"], ["🍵👔😈", "black butler"], ["🐻🔪🏫", "danganronpa"],
    ["✂️🧵🩸", "kill la kill"], ["🤖🌀🔩", "gurren lagann"], ["🎸🛵🛸", "flcl"], ["🚀🌌🕺", "space dandy"], ["🌻⚔️🎧", "samurai champloo"],
    ["🕶️🗡️🎤", "afro samurai"], ["🤠🔴🔫", "trigun"], ["😈🩸🏃", "devilman crybaby"], ["🍡🍶🗡️", "gintama"], ["🏹👘🏯", "kiznaiver"]
];

// =========================
//    MOTEUR RÉBUS REGAÏEN
// =========================

let rebusStats = {}; // userId -> { victoires: 0, points: 0, parties: 0 }
let rebusSession = {
    active: false,
    manche: 0,
    themeNom: '',
    items: [],
    currentItem: null,
    expireAt: 0,
    timer: null,
    scores: {}
};

function normaliserRebus(str) {
    if (!str) return '';
    return str.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/^(le|la|les|l'|un|une|des|the|a|an)\s+/i, '')
        .replace(/[^a-z0-9]/g, "");
}

function getRebusThemeDuJour(dateKey) {
    const themes = [
        { id: 'films', nom: '🎬 Films', pool: REBUS_FILMS, couleur: 0xe67e22 },
        { id: 'jeux', nom: '🎮 Jeux Vidéo', pool: REBUS_JEUX, couleur: 0x2ecc71 },
        { id: 'series', nom: '📺 Séries TV', pool: REBUS_SERIES, couleur: 0x3498db },
        { id: 'animes', nom: '⛩️ Animés & Mangas', pool: REBUS_ANIMES, couleur: 0xe91e63 }
    ];
    return themes[dateKey % themes.length];
}

function tempsAvantProchainRebus() {
    const now = new Date();
    const parisNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    const cible15h = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    cible15h.setHours(15, 0, 0, 0);

    let jourStr = "aujourd'hui";
    if (cible15h <= parisNow) {
        cible15h.setDate(cible15h.getDate() + 1);
        jourStr = "demain";
    }

    const diff = cible15h - parisNow;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return { jourStr, h, m, timestamp: Math.floor((Date.now() + diff) / 1000) };
}

function buildRebusStatsEmbed(cible) {
    const s = rebusStats[cible.id] ?? { victoires: 0, points: 0, parties: 0 };
    return new EmbedBuilder()
        .setColor(0xf39c12)
        .setTitle(`🧩 Stats Rébus Regaïen de ${cible.displayName}`)
        .addFields(
            { name: '🏆 Victoires de session', value: `**${s.victoires}**`, inline: true },
            { name: '⭐ Points totaux', value: `**${s.points}**`, inline: true },
            { name: '🎮 Sessions jouées', value: `**${s.parties}**`, inline: true }
        )
        .setFooter({ text: 'Rébus Regaïen tous les jours à 15h00 !' });
}

async function lancerSessionRebus(guild) {
    const channel = guild.channels.cache.get(MOTUS_CHANNEL_ID);
    if (!channel) return;

    const dateKey = getMotusDateKey();
    const theme = getRebusThemeDuJour(dateKey);

    // Tirer 5 rébus uniques au hasard dans le thème du jour
    const shuffled = [...theme.pool].sort(() => 0.5 - Math.random());
    const cinqItems = shuffled.slice(0, 5);

    rebusSession = {
        active: true,
        manche: 0,
        themeNom: theme.nom,
        themeCouleur: theme.couleur,
        items: cinqItems,
        currentItem: null,
        expireAt: 0,
        timer: null,
        scores: {}
    };

    await channel.send({
        content: `# 🧩 LE RÉBUS REGAÏEN DU JOUR EST LANCÉ !\n` +
                 `🎭 **Thème du jour :** ${theme.nom}\n` +
                 `🎯 **5 manches au programme** • **5 minutes** par manche !\n` +
                 `*La première manche commence dans quelques secondes...*`
    });

    setTimeout(() => passerMancheSuivanteRebus(guild), 4000);
}

async function passerMancheSuivanteRebus(guild) {
    const channel = guild.channels.cache.get(MOTUS_CHANNEL_ID);
    if (!channel) return;

    rebusSession.manche++;

    // Si les 5 manches sont terminées -> Clôture et Podium
    if (rebusSession.manche > 5) {
        return terminerSessionRebus(channel);
    }

    const item = rebusSession.items[rebusSession.manche - 1];
    rebusSession.currentItem = item;
    rebusSession.expireAt = Date.now() + 5 * 60 * 1000; // 5 minutes

    const embed = new EmbedBuilder()
        .setColor(0xf39c12)
        .setTitle(`🧩 Manche ${rebusSession.manche}/5`)
        .setDescription(
            `Devine ce que représentent ces emojis :\n\n` +
            `# ${item[0]}\n\n` +
            `⏳ **Temps limite :** 5 minutes (<t:${Math.floor(rebusSession.expireAt / 1000)}:R>) !\n` +
            `💬 *Tape directement le titre dans ce salon !*`
        )
        .setFooter({ text: `Manche ${rebusSession.manche}/5 • Le/la premier.e qui trouve marque 1 point` });

    await channel.send({ embeds: [embed] });

    // Timer de 5 minutes si personne ne trouve
    rebusSession.timer = setTimeout(async () => {
        if (!rebusSession.active || !rebusSession.currentItem) return;

        const titreReponse = item[1].charAt(0).toUpperCase() + item[1].slice(1);
        await channel.send(`⏰ **Temps écoulé !** Personne n'a trouvé.\nLa réponse était : **${titreReponse}** !`);
        rebusSession.currentItem = null;

        setTimeout(() => passerMancheSuivanteRebus(guild), 4000);
    }, 5 * 60 * 1000);
}

async function verifierReponseRebus(message) {
    if (!rebusSession.active || !rebusSession.currentItem) return false;

    const guessNorm = normaliserRebus(message.content);
    if (guessNorm.length < 2) return false;

    const item = rebusSession.currentItem;
    const reponsesValides = item.slice(1).map(r => normaliserRebus(r));

    // Si la proposition correspond à l'une des variantes acceptées
    if (reponsesValides.includes(guessNorm)) {
        clearTimeout(rebusSession.timer);
        rebusSession.currentItem = null;

        const uid = message.author.id;
        rebusSession.scores[uid] = (rebusSession.scores[uid] || 0) + 1;

        const titreReponse = item[1].charAt(0).toUpperCase() + item[1].slice(1);
        await message.reply(`✅ **Bravo <@${uid}> !** C'était bien **${titreReponse}** ! (+1 point)`);

        setTimeout(() => passerMancheSuivanteRebus(message.guild), 4000);
        return true;
    }
    return false;
}

async function terminerSessionRebus(channel) {
    clearTimeout(rebusSession.timer);
    rebusSession.active = false;
    rebusSession.currentItem = null;

    const scoresList = Object.entries(rebusSession.scores).sort((a, b) => b[1] - a[1]);

    if (scoresList.length === 0) {
        const embedNul = new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle('🏁 Fin du Rébus Regaïen')
            .setDescription(`Aucun point n'a été marqué aujourd'hui !\nRendez-vous demain à **15h00** pour une nouvelle session !`);
        await channel.send({ embeds: [embedNul] });
        demanderSauvegarde();
        return;
    }

    // Mise à jour des stats globales pour tous les participants
    const maxScore = scoresList[0][1];
    for (const [uid, pts] of scoresList) {
        if (!rebusStats[uid]) rebusStats[uid] = { victoires: 0, points: 0, parties: 0 };
        rebusStats[uid].points += pts;
        rebusStats[uid].parties++;
        if (pts === maxScore) rebusStats[uid].victoires++;
    }
    demanderSauvegarde();

    const medailles = ['🥇', '🥈', '🥉'];
    const lignesPodium = scoresList.map(([uid, pts], i) => {
        const med = medailles[i] ?? `**${i + 1}.**`;
        return `${med} <@${uid}> — **${pts} point${pts > 1 ? 's' : ''}**`;
    }).join('\n');

    const vainqueurs = scoresList.filter(s => s[1] === maxScore).map(s => `<@${s[0]}>`).join(', ');

    const embedVictoire = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle('🏆 PODIUM DU RÉBUS REGAÏEN !')
        .setDescription(
            `Félicitations à ${vainqueurs} pour cette victoire !\n\n` +
            `**__Classement de la session :__**\n${lignesPodium}`
        )
        .setFooter({ text: 'Rendez-vous demain à 15h00 ! • !rebus pour voir le statut' });

    const rowStats = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('rebus_view_stats')
            .setLabel('📊 Mes stats Rébus')
            .setStyle(ButtonStyle.Primary)
    );

    await channel.send({ embeds: [embedVictoire], components: [rowStats] });
}

// =========================
//    SURVEILLANCE TWITCH
// =========================

async function buildTwitchLivePayload() {
    const liveUrl = `https://twitch.tv/${TWITCH_USER}`;
    const previewUrl = `https://static-cdn.jtvnw.net/previews-ttv/live_user_${TWITCH_USER}-1280x720.jpg?t=${Date.now()}`;

    const [titreRaw, jeuRaw, avatarRaw] = await Promise.all([
        fetch(`https://decapi.me/twitch/title/${TWITCH_USER}`).then(r => r.text()).catch(() => 'Live Twitch !'),
        fetch(`https://decapi.me/twitch/game/${TWITCH_USER}`).then(r => r.text()).catch(() => 'Just Chatting'),
        fetch(`https://decapi.me/twitch/avatar/${TWITCH_USER}`).then(r => r.text()).catch(() => null)
    ]);

    const titre = titreRaw.trim() || 'En direct sur Twitch !';
    const jeu = jeuRaw.trim() || 'Just Chatting';
    const avatar = (avatarRaw && avatarRaw.startsWith('http')) ? avatarRaw.trim() : null;

    const embed = new EmbedBuilder()
        .setColor(0x9146ff)
        .setAuthor({ 
            name: `En direct sur Twitch !`, 
            url: liveUrl 
        })
        .setTitle(titre)
        .setURL(liveUrl)
        .addFields(
            { name: '🎮 Jeu / Catégorie', value: `\`${jeu}\``, inline: true },
            { name: '📺 Chaîne', value: `[twitch.tv/${TWITCH_USER}](${liveUrl})`, inline: true }
        )
        .setImage(previewUrl)
        .setFooter({ text: '🔴 Live Twitch • Notification automatique' })
        .setTimestamp();

    if (avatar) embed.setThumbnail(avatar);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel('▶️ Rejoindre le stream')
            .setStyle(ButtonStyle.Link)
            .setURL(liveUrl)
    );

    return {
        content: `📢 Hey <@&${TWITCH_ROLE_ID}> !\n**Epsys** vient de lancer un live !`,
        embeds: [embed],
        components: [row]
    };
}

async function verifierTwitchLive() {
    try {
        const res = await fetch(`https://decapi.me/twitch/uptime/${TWITCH_USER}`).catch(() => null);
        if (!res || !res.ok) return; // Si DecAPI plante (erreur 500/502/timeout), on ignore totalement

        const resUptime = (await res.text()).trim();

        // Rejette si la réponse est vide, contient du HTML Cloudflare ou un message d'erreur
        if (!resUptime || resUptime.startsWith('<') || resUptime.toLowerCase().includes('error')) return;

        // Vérifie si le mot-clé hors-ligne est présent
        const estHorsLigne = resUptime.toLowerCase().includes('offline') || resUptime.toLowerCase().includes('not found');

        // Quand un live est RÉELLEMENT en cours, DecAPI renvoie obligatoirement un format de temps : "X minutes, Y seconds"
        const aDureeValide = /\b(second|minute|hour|day)s?\b/i.test(resUptime);

        const estEnLigne = !estHorsLigne && aDureeValide;

        if (estEnLigne && !twitchLiveEnCours) {
            twitchLiveEnCours = true;
            const channel = client.channels.cache.get(TWITCH_CHANNEL_ID);
            if (!channel) return;

            const payload = await buildTwitchLivePayload();
            await channel.send(payload);
            console.log(`[Twitch] Vrai live détecté pour ${TWITCH_USER} (${resUptime}) !`);
        } else if (!estEnLigne && twitchLiveEnCours) {
            twitchLiveEnCours = false; // Réinitialise quand le live s'arrête
        }
    } catch (e) {
        // En cas de crash réseau, ne jamais considérer que le live est lancé
    }
}

// =========================
//     FONCTION PRINCIPALE
// =========================

function getResponse(raw) {
    const cleaned = raw
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s!]/g, "")
        .replace(/\s+/g, " ")
        .trim();

    const command = raw.trim().split(" ")[0].toLowerCase();

    const isUpper =
        raw.length > 0 &&
        raw === raw.toUpperCase() &&
        raw !== raw.toLowerCase();

    const reply = (normal, upper = normal.toUpperCase()) =>
        isUpper ? upper : normal;

    // =========================
    //         !HELP
    // =========================

    if (command === "!suggestion" || command === "!suggest" || command === "!sugg") {
        return { needsSuggestion: true };
    }

    if (command === "!help") {
        return { needsHelp: true };
    }

    // =========================
    //     COMMANDES UTILITAIRES
    // =========================

    if (raw.toLowerCase().match(/!aternos\b/)) {
        return "L'IP actuelle du serveur Minecraft de Rega\u00efa est : **papierprout.aternos.me**";
    }

    // =========================
    //        !BOUGETOI
    // =========================

    if (command === "!bougetoi" || command === "!montage" || command === "!video" || command === "!lavideo") {
        return { needsBougetoi: true };
    }

    // =========================
    //         !EPSYS
    // =========================

    if (command === "!epsys") {
        const gifs = [
            "https://cdn.discordapp.com/attachments/1480734932933542049/1504170153317761085/67.gif",
            "https://cdn.discordapp.com/attachments/1480734932933542049/1504168424136245368/Caramell_Dansen.gif",
            "https://cdn.discordapp.com/attachments/720057528867618909/1486636493417222216/2a088883-36e7-4eb4-ab2c-0d4942e21bfb.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1478476705642319985/ezgif-403e246b59051aa3.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1478480836683759636/ezgif-4910f713e8f8f838.gif",
            "https://cdn.discordapp.com/attachments/720079691041472572/1505409860970217574/epsys-dance.gif",
            "https://cdn.discordapp.com/attachments/720079691041472572/1513686805130510396/toupsys.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1513684027821920396/facepalm.gif",
            "https://cdn.discordapp.com/attachments/720079691041472572/1513683934490132611/spin2_1.gif",
            "https://cdn.discordapp.com/attachments/720057528867618910/1486127551771447486/eps.gif"
        ];

        return gifs[Math.floor(Math.random() * gifs.length)];
    }


    // =========================
    //         !SYLVAIN
    // =========================

    if (command === "!sylvain") {
        return { needsSylvain: true };
    }

    // =========================
    //         !ROULETTE
    // =========================

    if (command === "!roulette" || command === "!rlt") {
        const arg = raw.trim().split(" ")[1]?.toLowerCase();
        return { needsRoulette: true, direct: arg === 'go' };
    }

    if (command === "!roulettestate" || command === "!rltstate") {
        return { needsRouletteState: true };
    }

    if (command === "!roulettestats" || command === "!rltstats") {
        return { needsRouletteStats: true };
    }

    if (["!roulettesucces", "!rltsucces", "!roulettesuccess", "!rltsuccess"].includes(command)) {
        return { needsRouletteAchievements: true };
    }

    if (["!rlttop", "!roulettetop", "!rltleaderboard"].includes(command)) {
        return { needsRouletteTop: true };
    }

    // =========================
    //         !MOTUS
    // =========================

    if (command === "!motus") {
        return { needsMotus: true };
    }

    if (command === "!motustats" || command === "!motustat") {
        return { needsMotusStats: true };
    }

    // =========================
    //         !REBUS
    // =========================

    if (command === "!rebus" || command === "!decodeur" || command === "!emojis") {
        return { needsRebus: true };
    }

    if (command === "!rebusstats" || command === "!rebusstat") {
        return { needsRebusStats: true };
    }

    // =========================
    //         !QUOTE
    // =========================

    if (command === "!quote" || command === "!citation") {
        return { needsQuote: true };
    }

    // =========================
    //         !CHOIX
    // =========================

if (command === "!choix") {

    // Enlève la ponctuation de fin (?, !, ., etc.)
    let texteBrut = raw.replace(/^!choix\s*/i, "").trim().replace(/[?!.\s]+$/, "").trim();

    // Enlève "tu préfères" / "tu prefere" / "tu préfère" / "tu preferes" en début de phrase
    texteBrut = texteBrut.replace(/^tu\s+pr[ée]f[èe]res?\s+/i, "").trim();

    // Met une majuscule à la première lettre (gère aussi les accents)
    const capitalizeFirst = (str) => {
        if (!str) return str;
        return str.replace(/^\p{L}/u, (c) => c.toUpperCase());
    };

    // Découpe sur les "ou" (ex: "manger du caca ou boire du pipi")
    if (texteBrut.length > 0) {
        const propositions = texteBrut
            .split(/\s+ou\s+/i)
            .map(p => p.trim().replace(/[?!.\s]+$/, "").trim())
            .filter(p => p.length > 0);

        if (propositions.length >= 2) {
            const choisi = propositions[Math.floor(Math.random() * propositions.length)];

            // Intros où le choix est EN DÉBUT de phrase -> majuscule forcée
            const introsDebut = [
                (c) => `**${capitalizeFirst(c)}**, tous les jours`,
                (c) => `**${capitalizeFirst(c)}** je pense`,
                (c) => `**${capitalizeFirst(c)}**, et je changerai pas d'avis`,
                (c) => `**${capitalizeFirst(c)}**. Zéro débat.`
            ];

            // Intros où le choix n'est PAS en début de phrase -> casse d'origine gardée
            const introsMilieu = [
                (c) => `En vrai... **${c}**`,
                (c) => `Après mûre réflexion... **${c}**`,
                (c) => `Franchement, **${c}**`,
                (c) => `Bah, **${c}** ? Genre, c'est évident ?`
            ];

            const toutesIntros = [...introsDebut, ...introsMilieu];
            const introChoisie = toutesIntros[Math.floor(Math.random() * toutesIntros.length)];
            return introChoisie(choisi);
        }
    }

    if (Math.random() < 0.1) {
        if (texteBrut.length > 0) {
            return `"${texteBrut}" \u261d\ufe0f\ud83e\udd13\nNon tais-toi et oublie cette id\u00e9e stp`;
        }
    }

    const reponses = [
        "Oui, mais le monde n'est pas encore pr\u00eat.", "Non. Mauvaise id\u00e9e de base.", "Oui, mais t'assumes.", "Franchement je sais pas mais \u00e7a sent la merde.",
        "Oui mais \u00e7a va mal finir.", "Non mais tu vas quand m\u00eame le faire donc bon.", "Non.", "J'ai demand\u00e9 \u00e0 ma maman... Elle a dit oui.",
        "ABSOLUMENT!", "Euuuh... Non ?", "C'est quoi cette question encore ? Non.", "Oui, oui, oui et encore oui !", "Piti\u00e9 oui.", "Piti\u00e9 non.",
        "Mange tes morts \u00e0 la place de poser ce genre de questions.", "Totalement... Sauf que non, j'ai menti.", "Vous pensez ? Moi j'pense pas. C'est mon avis.",
        "Affirmatif.", "Oui je pensent.", "Ouient.", "Oui (stiti).", "\u00c9-VI-DEM-MENT", "Bah oui t'es d\u00e9bile ou quoi?", "Well yes, but actually no.",
        "Alors... Je savais la r\u00e9ponse, mais j'ai oubli\u00e9...", "Tu crois jsuis Akinator fdp?", "Peut-\u00eatreeeee.", "F\u00fbt un temps, on tuait des gens pour des questions moins connes que \u00e7a.",
        "Non + pas lu + ratio + ntm", "nn", "oe", "https://tenor.com/view/ui-jday-mister-jd-gif-25079300", "https://tenor.com/view/mais-oui-seb-jdg-mais-oui-gif-19057953",
        "https://cdn.discordapp.com/attachments/1128032964924670053/1504924989781053581/vous-pensez-moi-je-pense-pas.gif"
    ];

    return reponses[Math.floor(Math.random() * reponses.length)];
}

    // =========================
    //         !PRUNE
    // =========================

    if (command === "!youtube") {
        return { needsYoutube: true };
    }

    // =========================
    //        !YOUTUBE
    // =========================

    if (command === "!prune") {
        return { needsPrune: true };
    }

    // =========================
    //         !ANIMAL
    // =========================

    if (command === "!animal") {
        return { needsMention: true };
    }

    // =========================
    //        !LOVECALC
    // =========================

    if (command === "!lovecalc") {
        return { needsLovecalc: true };
    }

    // =========================
    //         !KISS
    // =========================

    if (command === "!kiss" || command === "!bisou") {
        return { needsKiss: true };
    }

    // =========================
    //         !KISS
    // =========================

    if (command === "!run" || command === "!court") {
        return { needsRun: true };
    }

    // =========================
    //         !HUG
    // =========================

    if (command === "!hug" || command === "!calin") {
        return { needsHug: true };
    }

    // =========================
    //         !DANSE
    // =========================

    if (command === "!danse" || command === "!dance") {
        return { needsDance: true };
    }

    // =========================
    //         !INSULTE
    // =========================

    if (command === "!insult") {
        return { needsInsult: true };
    }

    // =========================
    //         !RIRE
    // =========================

    if (command === "!rire") {
        return { needsLaugh: true };
    }

    // =========================
    //         !RIZZ
    // =========================

    if (command === "!rizz") {
        return { needsRizz: true };
    }

    // =========================
    //         !BANG
    // =========================

    if (command === "!bang" || command === "!tir" || command === "!pan") {
        return { needsBang: true };
    }

    // =========================
    //         !PUNCH
    // =========================

    if (command === "!punch" || command === "!frappe") {
        return { needsPunch: true };
    }

    // =========================
    //         !DIE
    // =========================

    if (command === "!wanted") {
    const args = raw.trim().split(/\s+/);
    if (args[1]?.toLowerCase() === 'set') return { needsWantedSet: true };
    return { needsWanted: true };
}

    if (command === "!cry" || command === "!pleure") {
        return { needsCry: true };
    }

    if (command === "!palaref" || command === "!pref") {
        return { needsPalaref: true };
    }
    
    if (command === "!jailaref" || command === "!glaref" || command === "!gref") {
        return { needsJailaref: true };
    }

    if (command === "!explode" || command === "!explose") {
        return { needsExplode: true };
    }

    if (command === "!bait") {
        return { needsBait: true };
    }

    if (command === "!ban") {
        return { needsBan: true };
    }

    if (command === "!die") {
        return { needsDie: true };
    }

    // =========================
    //         !PROFIL
    // =========================

    if (command === "!profil" || command === "!profile" || command === "!info") {
        return { needsProfil: true };
    }

    // =========================
    //         !AVATAR
    // =========================

    if (command === "!avatar") {
        return { needsAvatar: true };
    }

    // =========================
    //         !TOP
    // =========================

    if (command === "!anniversaire" || command === "!anniversairetest") {
        return { needsAnniversaire: true };
    }

    // =========================
    //         !FLIP
    // =========================

    if (command === "!flip") {
        return { needsFlip: true };
    }

    if (command === "!blague") {
        return { needsBlague: true };
    }

    if (command === "!topchef") {
        return { needsTopChef: true };
    }

    if (command === "!actif") {
        return { needsActif: true };
    }

    if (command === "!top") {
        return { needsTop: true };
    }

    // =========================
    //         !SETMESSAGES
    // =========================

    if (command === "!setmessages") {
        return { needsSetMessages: true };
    }

    // =========================
    //         !SERVEUR
    // =========================

    if (command === "!horoscope") {
        return { needsHoroscope: true };
    }

    if (command === "!meteo" || command === "!météo") {
        return { needsMeteo: true };
    }

    if (command === "!save") {
        return { needsSave: true };
    }

    if (command === "!helpx") {
        return { needsHelpx: true };
    }

    if (command === "!streamtest") {
        return { needsStreamTest: true };
    }

    if (command === "!lastsave") {
        return { needsLastsave: true };
    }

    if (command === "!say") {
        return { needsSay: true };
    }

    if (command === "!edit") {
        return { needsEdit: true };
    }

    if (command === "!embed") {
        return { needsEmbed: true };
    }

    if (command === "!rolereac" || command === "!rr") {
        return { needsRoleReac: true };
    }

    if (command === "!rolebtn" || command === "!btnrole") {
        return { needsRoleBtn: true };
    }

    if (command === "!rappel") {
        return { needsRappel: true };
    }

    if (command === "!pomodoro") {
        return { needsPomodoro: true };
    }

    if (command === "!ping") {
        return { needsPing: true };
    }

    if (command === "!botinfo" || command === "!about" || command === "!abt") {
        return { needsInfo: true };
    }

    if (command === "!serveur") {
        return { needsServeur: true };
    }

    if (command === "!stats") {
        return { needsStats: true };
    }

    if (command === "!last") {
        return { needsLastVideo: true };
    }

    // =========================
    //         !QUESTION
    // =========================

    if (command === "!question") {
        return { needsQuestion: true };
    }


    // =========================
    //         !DESTIN
    // =========================

    if (command === "!destin") {
        const destin = [
            "Tu multiplieras ton nombre de neurones par 2 le vendredi 28 Juillet 2034.",
            "Tu deviendras une l\u00e9gende locale dans un Intermarchi\u00e9 paum\u00e9.",
            "ChatGPT remplacera ton avenir.",
            "Tu refouleras ton homosexualit\u00e9 avant d'avoir des sentiments pour un twink entre 2028 et 2034.",
            "Tu vas te p\u00e9ter la gueule sur un trottoir le mois prochain (fais gaffe).",
            "Tu vas vouloir trop forcer un pet lundi prochain. Bon courage.",
            "Tu croiseras ton sosie parfait dans un Lidl mardi prochain \u00e0 14h32.",
            "Ta transidentit\u00e9 est tout sauf un fardeau. Sois fi\u00e8r.e de ce que tu es chouchou.",
            "Un homme que tu c\u00f4toies va malheureusement se couper accidentellement le zgeg avec une machette.",
            "Y a un truc qui pue dans ton frigo, pense \u00e0 le jeter avant de choper la coulante.",
            "Un \u00e9v\u00e9nement totalement nul mais humiliant va te d\u00e9finir socialement dans l'ann\u00e9e qui va suivre.",
            "Tu vas rire au mauvais moment, et tu vas t'en souvenir toute ta vie.",
            "Un inconnu qui te croisera dans la rue va te juger personnellement tr\u00e8s bient\u00f4t.",
            "Tu vas perdre un d\u00e9bat politique contre un chat errant.",
            "Un jour, tu comprendras un truc important\u2026 et tu l'oublieras 3 secondes apr\u00e8s.",
            "Quelqu'un va te r\u00e9pondre \u00abok\u00bb \u00e0 un message important et \u00e7a va te marquer \u00e0 vie.",
            "Un jour, tu vas \u00eatre t\u00e9moin d'un truc bizarre mais personne te croira.",
            "Tu vas devenir un souvenir flou dans la m\u00e9moire de quelqu'un que tu respectes.",
            "Tu vas devenir riche\u2026 mais uniquement en pi\u00e8ces en chocolat.",
            "Un jour, tu vas r\u00e9ussir un truc incroyable un jour. Personne saura lequel.",
            "Tu vas dire un truc intelligent par accident en 2031, tout le monde sera sur le cul.",
            "Un jour, ton karma va dire \u00abok j'arr\u00eate les conneries\u00bb et \u00e7a va changer ta vie.",
            "Un jour, tu vas survivre \u00e0 une situation trop bizarre pour \u00eatre expliqu\u00e9e sans alcool.",
            "Bient\u00f4t, ton cerveau va bug au moins 3 fois par semaine mais tkt c'est pas grave.",
            "Un jour, tu vas accidentellement d\u00e9fendre Bardella dans un d\u00e9bat politique alors que t'es de gauche, et tout le monde te d\u00e9testera.",
            "Un jour, tu vas \u00e9clater de rire dans un moment ultra s\u00e9rieux et c'est ok.",
            "Un jour, tu vas r\u00e9ussir un truc par pur hasard et faire genre c'\u00e9tait pr\u00e9vu.",
            "Ton destin est \u00e9crit avec un stylo qui fuit mais \u00e7a donne du style.",
            "Un jour, tu vas dire \u00abOn verra\u00bb et pour une fois \u00e7a va vraiment marcher.",
            "Un jour, tu vas faire un choix ultra d\u00e9cisif, et \u00e7a va \u00e9tonnamment bien se passer.",
            "D'ici peu, tu vas \u00eatre en retard \u00e0 quelque chose d'important mais \u00e7a va rien changer au final.",
            "Demain, sans pr\u00e9venir, tu comprendras sur insta un truc fondamental sur la vie\u2026 et tu diras \u00abah ok\u00bb avant de retourner scroller.",
            "Les anciens avaient pr\u00e9dit ton arriv\u00e9e dans un texte grav\u00e9 sur une caisse de supermarch\u00e9 Lidl en 2004.",
            "Tu vas bient\u00f4t vivre un moment SUPER IMPORTANT de ta vie, mais genre entre deux merdes de chien.",
            "Un inconnu va dire ton pr\u00e9nom dans une phrase tr\u00e8s s\u00e9rieuse sans savoir pourquoi, et \u00e7a va te hanter.",
            "Les signes \u00e9taient l\u00e0 depuis le d\u00e9but : ticket de caisse froiss\u00e9, pigeon qui te regarde, lumi\u00e8re bizarre au plafond... M\u00e9fie-toi...",
            "Tu vas prendre une d\u00e9cision d\u00e9bile qui sera interpr\u00e9t\u00e9e comme une proph\u00e9tie par quelqu'un d'autre.",
            "Ton futur d\u00e9pend d'un truc que t'as oubli\u00e9 dans une poche de veste depuis 3 mois.",
            "Un jour, tu vas survivre \u00e0 un moment important sans r\u00e9aliser que c'en \u00e9tait un.",
            "Un jour tu vas r\u00e9aliser que t'as surv\u00e9cu \u00e0 100% de tes jours difficiles, et c'est d\u00e9j\u00e0 tr\u00e8s bien.",
            "Tu vas progresser sans t'en rendre compte, il faut que tu tiennes bon, c'est juste temporaire.",
            "Sans pr\u00e9venir, un d\u00e9tail minuscule va te redonner l'envie de vivre.",
            "Tu vas r\u00e9ussir un truc que t'avais enterr\u00e9 mentalement depuis longtemps, et \u00e7a va faire bizarre. Mais \u00e7a va faire du bien.",
            "T'as d\u00e9j\u00e0 chang\u00e9 plus que tu ne le crois, mais ton cerveau ne veut pas te le dire. Alors c'est moi qui m'en charge : Tu as chang\u00e9, et c'est beau.",
            "Peu importe ce que les gens disent, ton identit\u00e9 n'a pas besoin d'autorisation pour exister.",
            "Quelque part dans l'univers, une version de toi est heureuse d'\u00eatre exactement ce qu'elle est.",
            "Le monde est bizarre, mais ton existence dedans est valide.",
            "Tu vas rencontrer des gens qui te comprendront sans que tu leur expliques ce que tu es, et \u00e7a va te surprendre.",
            "Y a aucune version correcte de toi \u00e0 atteindre, tu es d\u00e9j\u00e0 toi et c'est tout ce qui compte.",
            "Dans un univers alternatif, quelqu'un te remercie d'exister, sans raison pr\u00e9cise. Et c'est suffisant.",
            "Ton destin est \u00e9crit sur une bo\u00eete de raviolis p\u00e9rim\u00e9s depuis 2017.",
            "Une porte automatique va te reconna\u00eetre et h\u00e9siter \u00e0 s'ouvrir, volontairement.",
            "Un \u00e9v\u00e9nement totalement nul mais humiliant va te d\u00e9finir socialement pendant 3 mois minimum.",
            "Un inconnu va te regarder avec trop de certitude et \u00e7a va te perturber pendant des ann\u00e9es.",
            "Tu vas perdre un d\u00e9bat contre quelqu'un qui avait m\u00eame pas compris le sujet.",
            "Tu vas acqu\u00e9rir le pouvoir d'\u00eatre un putain de g\u00e9nie mais uniquement entre 3h12 et 3h14 du matin.",
            "Ton futur d\u00e9pend d'un objet que t'as jet\u00e9 sans t'en rendre compte en 2022.",
            "Un jour, tu vas r\u00e9ussir un truc incroyable et tu vas pr\u00e9tendre que c'\u00e9tait intentionnel alors que non.",
            "Tu vas progresser sans t'en rendre compte et un jour tu vas r\u00e9aliser que t'as surv\u00e9cu \u00e0 100% de tes pires jours. Beau travail, continue comme \u00e7a.",
            "Sans pr\u00e9venir, un d\u00e9tail ridicule va te redonner foi en la vie pendant 11 minutes, puis dispara\u00eetre. \u00c7a arrive \u00e0 tout le monde, tkt pas.",
            "Ton destin c'est un ticket de caisse Lidl froiss\u00e9 avec \u00e9crit dessus \u00abbonne chance fdp\u00bb en tout petit.",
            "Tu vas rater un moment cl\u00e9 de ta vie parce que t'\u00e9tais en train de fixer un mur comme si c'\u00e9tait ton daron.",
            "Demain, ton cerveau va bug en plein milieu d'une phrase et tu vas continuer \u00e0 parler comme si c'\u00e9tait normal.",
            "Un inconnu va te raconter sa vie comme si vous aviez une histoire ensemble alors que tu lui as juste ouvert une porte.",
            "D'ici peu, tu vas faire un choix important compl\u00e8tement au hasard et bizarrement \u00e7a va marcher et \u00e7a va t'\u00e9nerver.",
            "Tu vas bient\u00f4t foirer un d\u00e9bat avec une personne que tu d\u00e9testes, et sous la douche tu repenseras \u00e0 tout ce que t'aurais d\u00fb lui dire.",
            "Tu vas bient\u00f4t avoir une r\u00e9v\u00e9lation existentielle au rayon surgel\u00e9s du Leclerc de Roubaix \u00e0 16h37.",
            "Ton destin c'est un truc \u00e9crit \u00e0 l'encre qui bave et m\u00eame lui il sait pas trop o\u00f9 il va.",
            "Tu meurs demain.",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1504679674561953792/image.png",
            "https://i.pinimg.com/736x/23/55/f2/2355f2363ccca5871974b2289216e6a6.jpg",
            "https://i.pinimg.com/736x/3b/28/9e/3b289efdc603a8e916906e797fa6652c.jpg",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1504681138864521247/destin.mp4",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1504681627748401203/destin.mp4",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1504682385290170418/destin.mp4",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1504685026057519144/destin.mp4"
        ];

        return destin[Math.floor(Math.random() * destin.length)];
    }

    // =========================
    // PHRASES CONTENANT LES MOTS
    // =========================

    if (/\bh?e+h?y?\s+p[e]+t[i]+t|\beh\s+p[e]+t[i]+t/i.test(cleaned)) return { needsHePetit: true };
    if (cleaned.includes("j ai menti") || cleaned.includes("jai menti")) return { files: ["./jai_menti.mp3"] };
    if (cleaned === "lele" || cleaned === "ley ley" || /^papayou+$/.test(cleaned)) return { files: ["./PAPAYOU.mp3"] };
    if (cleaned.includes("absolute cacabot")) return "https://cdn.discordapp.com/attachments/1128032964924670053/1514231086153207998/ABSOLUTE_CACABOT.gif";
    if (cleaned.includes("henry tran") || cleaned.includes("singapour")) {
        const videos = [
            "https://cdn.discordapp.com/attachments/1128032964924670053/1504609617638854817/SINGAPOUR_1.mp4",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1504609645313134824/SINGAPOUR_2.mp4"
        ];
        return Math.random() < 0.5 ? videos[0] : videos[1];
    }
    if (cleaned.includes("ou quoi")) return reply("Ou feur");
    if (cleaned.includes("avec quoi")) return reply("Avec feur");

    const motsOui = cleaned.replace(/!/g, '').trim().split(/\s+/);
    if (motsOui.length > 0 && motsOui.every(m => m === 'oui')) {
        const texteStiti = Array(motsOui.length).fill("stiti").join(" ");
        return reply(texteStiti.charAt(0).toUpperCase() + texteStiti.slice(1));
    }
    if (cleaned.endsWith("oui")) return reply("Stiti");
    if (
        (cleaned.includes("cacabot") || cleaned.includes("caca bot") || raw.includes("1503495713097519355")) &&
        (cleaned.includes("jtm") || cleaned.includes("je t aime") || cleaned.includes("je taime") || cleaned.includes("jt aime"))
    ) return { needsJtm: true };

    if (cleaned.includes("bac blanc")) {
        const bacBlanc = [
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505380065435717712/yard_stare.jpg",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505378497533579415/ghost.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505378497894551623/wwii.jpg",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505378498271772794/stare.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505378498695663738/catstare.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505378499404501112/homelander.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505378499744104468/chaise.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505378500075585696/gustavo.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505378501266510026/vietnam_cat.gif"
        ];
        return bacBlanc[Math.floor(Math.random() * bacBlanc.length)];
    }
    if (cleaned.includes("lexys")) return "https://cdn.discordapp.com/attachments/720057528867618909/1498102442200404120/bac_blanc.gif";
    if (cleaned.includes("pas le prouver")) return "https://tenor.com/rkdM8FYGZO4.gif";
    if (/\bavec qui\b/.test(cleaned)) return reply("Avec quette");
    if (cleaned.includes("pour quoi faire")) return reply("Pour faire feur");
    if (cleaned.includes("pour quoi")) return reply("Pour feur");
    if (cleaned.includes("pourquoi")) return reply("Pourfeur");
    if (cleaned.includes("c est a quoi")) return reply("C'est à feur");
    if (/\bc est a qui\b/.test(cleaned)) return reply("C'est à quette");
    if (
        cleaned === "67" ||
        cleaned.includes(" 67 ") ||
        cleaned.startsWith("67 ") ||
        cleaned.endsWith(" 67")
    ) return "https://media.discordapp.net/attachments/1480734932933542049/1504170153317761085/67.gif";
    if (cleaned.includes("six seven")) return "https://media.discordapp.net/attachments/1480734932933542049/1504170153317761085/67.gif";
    if (
        cleaned === "monster" ||
        cleaned.includes(" monster ") ||
        cleaned.startsWith("monster ") ||
        cleaned.endsWith("monster")
    ) return "https://cdn.discordapp.com/attachments/1480756332373213275/1504649546045718758/pape_monster.png";
    const motsNon = cleaned.replace(/!/g, '').trim().split(/\s+/);
    if (motsNon.length > 0 && motsNon.every(m => m === 'non')) {
        const texteBril = Array(motsNon.length).fill("bril").join(" ");
        return reply(texteBril.charAt(0).toUpperCase() + texteBril.slice(1));
    }
    if (cleaned.endsWith("non")) return reply("Bril");
    if (cleaned.endsWith("bite")) return reply("Quoicoubite");
    if (cleaned.includes("cest quoi")) return reply("C'est feur");
    if (cleaned.includes("de quoi")) return reply("De feur");
    if (cleaned === "de qui") return reply("De quette");
    if (cleaned.endsWith("quoi")) return reply("Feur");
    const voleurMots = ['feur', 'quette', 'stiti', 'pfeur', 'stitient', 'feurent', 'bril'];
    for (const mot of voleurMots) {
        if (cleaned.includes(' ' + mot + ' ') || cleaned === mot || cleaned.startsWith(mot + ' ') || cleaned.endsWith(' ' + mot)) {
            const motFormate = mot.charAt(0).toUpperCase() + mot.slice(1);
            return `"${motFormate}" ? Tu veux me voler mon job ?`;
        }
    }

    // =========================
    // MESSAGES EXACTS UNIQUEMENT
    // =========================

    if (cleaned === "hein") return reply("Deux");
    if (cleaned === "allo" || cleaned === "allô") return reply("À l'huile");
    if (cleaned === "de") return reply("Trois");
    if (cleaned === "ouient") return reply("Stitient");
    if (cleaned === "pq" || cleaned === "pk") return reply("Pfeur");
    if (cleaned === "a" || cleaned === "ha" || cleaned === "ah") return "B";
    if (cleaned === "c") return "Non on arrête la vanne ici";
    if (cleaned === "ntm jax") return "https://cdn.discordapp.com/attachments/1206232717444775956/1504653708770672741/Capture_decran_2026-05-15_031617.png";

    // =========================
    // QUOI / QUI CLASSIQUES
    // =========================

    const quoiRegex = /^(quoi+|kwa|kouwa|kua|quoient)$/i;
    const lower = cleaned.replace(/\s+/g, " ");
    const isQuoi = quoiRegex.test(lower);
    const isQui = lower === "qui";

    if (!isQuoi && !isQui) return null;

    if (Math.random() < 0.05) return "VIDEO";

    if (isQui) return reply("Quette");
    if (lower === "quoient") return reply("Feurent");
    if (lower.startsWith("quoi")) {
        if (Math.random() < 0.5) return reply("Quoicoubeh");
        return reply("Feur");
    }

    return reply("Feur");
}

const pendingCheh = new Map();
const cooldowns = new Map();

const rappelReports = new Map();
const pendingRappels = new Map();
function generateRappelId() {
    return `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

const pomodoroSessions = new Map();
const youtubeSearches = new Map();
const vocalMessages = new Map();
const dernierMessageParUtilisateur = new Map();
const MOD_CHANNEL_ID = '1555402748193669192';

// --- Anti-phishing ---
const PHISHING_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:discor(?:d(?:app)?|cl|cb|ct|cl-app|d-nitro|d-gift|dapp|dstatus)?[-_.]+(?:gift|nitro|giveaway|drop|claim|steam|promo|boost|vip|com\.ru|xyz|tk|ga|ml|cf|gq|club|top|click|link)|steamcommuni(?:i|l)ty\.[a-z]+)\b/i;

// --- Slowmode d'urgence ---
const slowmodeTrackers = new Map(); // channelId -> [{ userId, timestamp }]
const slowmodeActifs = new Set();   // channelIds actuellement en slowmode d'urgence

// --- Anti-spam ---
const spamTracker = new Map(); // userId -> timestamps[]
const SPAM_WINDOW_MS = 5000;
const SPAM_THRESHOLD = 5;
const SPAM_TIMEOUT_MS = 5 * 60 * 1000;
const SPAM_EXEMPT_CHANNELS = ['1553954760900608091'];
const SPAM_EXEMPT_REGEX = /^!(rlt|roulette)(\s+go)?\s*$/i;

// --- Anti-raid ---
const raidJoinTracker = new Map();   // guildId -> [{ userId, timestamp }]
const raidFlaggedUsers = new Map();  // userId -> true (en attente de son 1er message)
const raidMuteRecord = new Map();    // userId -> timestamp de fin du timeout raid
const RAID_ACCOUNT_AGE_MS = 14 * 24 * 60 * 60 * 1000; // 2 semaines
const RAID_WINDOW_MS = 60 * 1000;    // 60s
const RAID_THRESHOLD = 3;
const RAID_TIMEOUT_MS = 5 * 60 * 1000;
const RAID_ESCALATION_WINDOW_MS = 15 * 60 * 1000; // 15min après la fin du mute

// --- Roulette ---
const rouletteFreeRollUntil = new Map(); // userId -> timestamp jusqu'où le cooldown est ignoré
const rouletteCooldowns = new Map(); // userId -> timestamp de fin de cooldown
const rouletteCouronneUntil = new Map(); // userId -> timestamp de fin
const rouletteAntiFeurUntil = new Map(); // userId -> timestamp de fin (24h)
const rouletteCoupTripleCharges = new Map(); // userId -> nombre de tirages gratuits restants
const rouletteCoupTripleScore = new Map();   // userId -> nombre de bonus d'affilée pendant le Coup Triple
const rouletteFreeRollCompteur = new Map();  // userId -> nombre de tirages pendant le tirage à volonté
const rouletteHappyHourCompteur = new Map(); // userId -> { date: string, count: number }
const rouletteAntiFeurDodges = new Map();    // userId -> nombre de feurs esquivés
const roulettePapayouDaily = new Map();      // userId -> { date: string, count: number }
const rouletteMalusConsecutifs = new Map();  // userId -> nombre de malus d'affilée
const rouletteMalusDifferents = new Map();   // userId -> Set de malus subis
const rouletteRedirectCharges = new Map(); // userId -> nombre de malus à rediriger
const roulettePseudoLock = new Map(); // userId -> { until: timestamp, pseudo: string }
const ROULETTE_COOLDOWN_MS = 15 * 60 * 1000;
const rouletteImmuniteUntil = new Map(); // userId -> timestamp de fin d'immunité au timeout
const rouletteResultats = new Map(); // id du message -> embed du résultat affiché
function memoriserResultatRoulette(messageId, embed) {
    rouletteResultats.set(messageId, embed);
    if (rouletteResultats.size > 200) rouletteResultats.delete(rouletteResultats.keys().next().value);
}
const rouletteChoixEnAttente = new Set(); // ids des messages dont le bonus alternatif n'a pas encore été choisi

function buildMenuFallbackRoulette(authorId) {
    const menu = new StringSelectMenuBuilder()
        .setCustomId(`roulette_fallback_${authorId}`)
        .setPlaceholder('Choisis un bonus à la place')
        .addOptions(
            { label: '🎉 Audio PAPAYOU', value: 'bonus-gif-ou-audio' },
            { label: '📈 Boost Jackpot (+25% sur 2 tirages)', value: 'bonus-jackpot-boost' },
            { label: '🔰 Super Bouclier (3 malus parés)', value: 'bonus-super-bouclier' },
            { label: '👑 Couronne pendant 12h', value: 'bonus-couronne' },
            { label: '😈 3 malus redirigés (cumulable)', value: 'bonus-redirect-malus' }
        );
    return new ActionRowBuilder().addComponents(menu);
}
const ROULETTE_COOLDOWN_EXEMPT = ['744217896581857281', '902651805614358568'];
const rouletteUwuUntil = new Map();        // userId -> timestamp de fin
const rouletteLettreInterdite = new Map(); // userId -> { until: timestamp, lettre: string }
const EPSYS_ID = '436218312574107658';
const MODO_ROLE_ID = '720081311716606004';
function estModo(member) {
    return member?.roles?.cache?.has(MODO_ROLE_ID) ?? false;
}
const rouletteEmojiUntil = new Map();          // userId -> timestamp de fin
const rouletteLeetUntil = new Map();           // userId -> timestamp de fin
const rouletteTransfos = new Map(); // userId -> { caps, emojiOnly, limite100, limite30, mots, lettres, censure } (chacun = timestamp de fin)
let rouletteTourneeJusquA = 0;      // fin de la Tournée générale (non sauvegardé, ça ne dure qu'1 minute)
const rouletteCooldown45Charges = new Map();   // userId -> nombre de tirages restants à 45min
const rouletteCooldownCourtCharges = new Map();   // userId -> nombre de tirages restants à 5min
const rouletteBouclierActif = new Map();       // userId -> nombre de charges de bouclier (cumulable)
const rouletteJackpotBoostCharges = new Map(); // userId -> nombre de tirages restants avec le boost
const rouletteJackpotBoostValue = new Map();   // userId -> % de boost cumulé (ex: 0.25, 0.50...)
const rouletteRedirectChoixCible = new Map();  // userId -> id du membre choisi pour la prochaine redirection
const rouletteJackpotBonus = new Map(); // userId -> % cumulé (0 à 1) de chance de bonus grâce aux "rien" d'affilée
const rouletteStats = new Map();        // userId -> { tirages, bonus, malus, rien, plusGrosGain: {nom, proba}|null, serieActuelle, pireSerie }
const rouletteAchievements = new Map(); // userId -> { [achievementId]: timestamp }
const suggestionsData = new Map();     // messageId -> { authorId, texte, pour: string[], contre: string[] }

const ROULETTE_ACHIEVEMENTS = [
    // ───────── LES 15 PREMIERS ─────────
    { id: 'forteresse',        nom: 'Forteresse impénétrable',     emoji: '🏰', desc: 'Accumuler un total de 10 boucliers dans sa réserve' },
    { id: 'chat-noir',         nom: 'Victime du Destin',          emoji: '🐈‍⬛', desc: 'Subir la Malédiction du Chat Noir avec +5% de bonus boosté ou plus' },
    { id: 'malus-prime',       nom: 'La totale',                  emoji: '💥', desc: 'Décrocher et subir le MALUS PRIME' },
    { id: 'double-peine',      nom: 'La Double Peine',            emoji: '⏳', desc: 'Tomber sur Cooldown 45 min alors qu\'il reste des charges actives' },
    { id: 'condamne-plebe',    nom: 'Condamnation publique',      emoji: '🪓', desc: 'Être exclu.e 1 jour suite au vote public' },
    { id: 'incomprehensible',  nom: 'L\'Incompréhensible',        emoji: '🔤', desc: 'Cumuler 3 malus de texte ou plus en même temps' },
    { id: 'hof',               nom: 'Superstar',                  emoji: '🏆', desc: 'Décrocher un gain légendaire du Hall of Fame (≤ 0,05%)' },
    { id: 'pare-balles',       nom: 'Pare-Balles',                emoji: '🛡️', desc: 'Bloquer un mute de 20 min ou une exclusion grâce à un bouclier' },
    { id: 'pharmacien',        nom: 'Chimiste en herbe',          emoji: '🧪', desc: 'Déclencher la mécanique de contre-poison pour annuler un malus actif' },
    { id: 'braquage-parfait',  nom: 'Braquage Parfait',           emoji: '🎰', desc: 'Obtenir 3 bonus sur les 3 tirages gratuits d\'un Coup Triple' },
    { id: 'innocente',         nom: 'L\'Innocenté.e',             emoji: '🕊️', desc: 'Sortir libre d\'un vote public' },
    { id: 'veteran-250',       nom: 'Pro du gambling',            emoji: '🎲', desc: 'Atteindre 250 tirages au total' },
    { id: 'centurion-500',     nom: 'Gambling addict',            emoji: '👑', desc: 'Atteindre 500 tirages au total' },
    { id: 'baptiseur',         nom: 'Gravé dans la roche',        emoji: '✍️', desc: 'Verrouiller le pseudo d\'un.e autre membre avec le bonus Pseudo au choix' },
    { id: 'epingle',           nom: 'Maman je passe à la télé !', emoji: '📌', desc: 'Épingler un message dans le salon avec le bonus Message épinglé' },

    // ───────── LES 15 NOUVEAUX ─────────
    { id: 'tournee-patron',    nom: 'C\'est ma tournée !',        emoji: '🍻', desc: 'Déclencher l\'événement rare de la Tournée générale (1/600)' },
    { id: 'survivant-enfer',   nom: 'Survivant.e de l\'Enfer',    emoji: '☠️', desc: 'Tirer l\'Exclusion d\'une semaine ou le Ban définitif' },
    { id: 'ascension-sociale', nom: 'L\'Ascension Sociale',       emoji: '👑', desc: 'Monter d\'un rang de Regaïen ou toucher Regaïen légendaire' },
    { id: 'jour-de-gloire',    nom: 'Jour de Gloire',             emoji: '🎂', desc: 'Obtenir un bonus sur la roulette le jour de son anniversaire' },
    { id: 'oiseau-nuit',       nom: 'Oiseau de Nuit',             emoji: '🔥', desc: 'Effectuer au moins 10 tirages pendant une session d\'Happy Hour' },
    { id: 'sniper-impitoyable',nom: 'Sniper',                     emoji: '🎯', desc: 'Rediriger avec succès un malus avec la Redirection au choix' },
    { id: 'tete-dure',         nom: 'Tête Dure',                  emoji: '🛡️', desc: 'Esquiver au moins 5 fois le Feur de Cacabot grâce à l\'Anti-Feur' },
    { id: 'laristocrate',      nom: 'Aristocrate',                emoji: '👑', desc: 'Décrocher le bonus de la Couronne 12h' },
    { id: 'enchainement-fatal',nom: 'Enchaînement Fatal',         emoji: '🪨', desc: 'Subir 3 malus consécutifs d\'affilée sans aucun répit' },
    { id: 'silence-radio',     nom: 'Silence Radio',              emoji: '🤫', desc: 'Subir l\'Exclusion de 1 jour' },
    { id: 'le-sauvetage',      nom: 'Sauvetage',                  emoji: '📈', desc: 'Décrocher un bonus garanti grâce au système de Pity' },
    { id: 'crise-quarantaine', nom: 'Crise de la Quarantaine',    emoji: '👶', desc: 'Cumuler le Mode Boomer et le Baby Mode en même temps' },
    { id: 'fan-carlos',        nom: 'Fan de Carlos',              emoji: '🎶', desc: 'Faire spawn PAPAYOU.mp3 3 fois dans la même journée' },
    { id: 'seum-en-personne',  nom: 'Le seum en personne',        emoji: '🧻', desc: 'Avoir subi au moins 10 malus différents sur la roulette' },
    { id: 'argent-epsys',      nom: 'De l\'argent !',             emoji: '💶', desc: 'Recevoir 5€ de la YouTube money d\'Epsys (0,015%)' }
];

async function deverrouillerSucces(userId, achId, channel) {
    let userAchs = rouletteAchievements.get(userId);
    if (!userAchs) {
        userAchs = {};
        rouletteAchievements.set(userId, userAchs);
    }
    if (userAchs[achId]) return; // déjà obtenu

    userAchs[achId] = Date.now();
    rouletteAchievements.set(userId, userAchs);
    demanderSauvegarde();

    const ach = ROULETTE_ACHIEVEMENTS.find(a => a.id === achId);
    if (!ach) return;

    const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle('🎊 SUCCÈS DÉVERROUILLÉ !')
        .setDescription(`<@${userId}> vient d'obtenir le succès **${ach.emoji} ${ach.nom}** !\n\n*${ach.desc}*`)
        .setImage('https://cdn.discordapp.com/attachments/1480756332373213275/1555806751448629410/achievement-unlocked_1.gif');

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`rlt_achs_${userId}_0_${userId}`)
            .setLabel('🎖️ Succès')
            .setStyle(ButtonStyle.Secondary)
    );

    await channel?.send({ embeds: [embed], components: [row] }).catch(() => {});
}
const ROULETTE_JACKPOT_INCREMENT = 0.01; // +1% par "rien"
const ROULETTE_JACKPOT_MAX = 0.5;        // plafond à 50%
const ROULETTE_HOF_CHANNEL_ID = '1554331383361577010';
const ROULETTE_SALON_ID = '1553954760900608091'; // Salon où envoyer les annonces Happy Hour

function estHappyHour() {
    const now = new Date();
    const parisDate = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    return parisDate.getHours() === 20; // Actif entre 20h00 et 20h59
}

let dernierEnvoiHappyHour = null;
function verifierHappyHour() {
    const now = new Date();
    const paris = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    const h = paris.getHours();
    const m = paris.getMinutes();
    const salon = client.channels.cache.get(ROULETTE_SALON_ID);
    if (!salon) return;

    if (h === 20 && m === 0 && dernierEnvoiHappyHour !== '20h00') {
        dernierEnvoiHappyHour = '20h00';
        salon.send('# __🎰 C\'EST L\'HAPPY HOUR SUR LA ROULETTE ! (20h - 21h)__\n🔥 Pendant 1 heure, les cooldowns de tout le monde passent à **5 minutes** au lieu de 15 ! Tentez votre chance !');
    } else if (h === 20 && m === 30 && dernierEnvoiHappyHour !== '20h30') {
        dernierEnvoiHappyHour = '20h30';
        salon.send('# __🎰 PLUS QUE 30 MINUTES D\'HAPPY HOUR !__\n⚡ Les tirages sont toujours à **5 minutes** de cooldown jusqu\'à 21h !');
    } else if (h === 21 && m === 0 && dernierEnvoiHappyHour !== '21h00') {
        dernierEnvoiHappyHour = '21h00';
        salon.send('# __🏁 FIN DE L\'HAPPY HOUR !__\nRetour au cooldown normal de 15 minutes. Merci d\'avoir joué !');
    }
}
const ROULETTE_WEBHOOK_EXCLUS = new Set([
    '1553948893354401923',
    '1544686219223498762',
    '862253918583390238',
    '730795053563248640',
    '745115366065176598',
    '738514269234266242'
]);
const ROULETTE_HOF_SEUIL = 0.0005; // 0,05%

const ROULETTE_EMOJIS_ALEATOIRES = ['😂','😍','🔥','💀','🎉','😭','👀','🤡','😏','👁️👄👁️','🫦','😡',];
const ROULETTE_BOOMER_FINS = [
    '..... A BON ENTENDEUR ... 🤣🤣',
    '.... BISOUS A LA FAMILLE .. 🍷👍',
    '.... PAUVRE FRANCE .... Amitiés ..',
    '... A MEDITER .... ☕🙋‍♂️',
    '.... C ETAIT MIEUX AVANT ... 😡',
    '...\nBisous   -Mamie'
];
function finitParUnEmoji(texte) {
    return /\p{Extended_Pictographic}\uFE0F?$/u.test(texte.trim());
}
// Messages que les malus webhook ne doivent PAS remplacer
function estMessageExempte(texte, mentionneBot) {
    const t = texte.trim();
    // Commande Cacabot (!commande, /commande)
    if (/^[!\/]/.test(t)) return true;
    // Message qui s'adresse à Cacabot ("cacabot stop", "jtm cacabot", @Cacabot...)
    if (mentionneBot || /caca\s?bot/i.test(t)) return true;
    // GIF seul (lien Tenor / Giphy / Klipy ou lien direct en .gif)
    if (/^https?:\/\/\S+$/i.test(t) && /(tenor\.com|giphy\.com|klipy\.com|\.gif(\?|$))/i.test(t)) return true;
    // Emojis seuls (classiques, avec teinte de peau, drapeaux, personnalisés)
    if (/^(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator}|[0-9#*]\uFE0F?\u20E3|[\uFE0F\u200D\u20E3]|<a?:\w+:\d+>|\s)+$/u.test(t)) return true;
    return false;
}
function activerTransfo(userId, type, dureeMs) {
    const t = rouletteTransfos.get(userId) ?? {};
    t[type] = Date.now() + dureeMs;
    rouletteTransfos.set(userId, t);
}
function basculerTransfo(userId, type, dureeMs) {
    const t = rouletteTransfos.get(userId) ?? {};
    if (t[type] && Date.now() < t[type]) {
        delete t[type];
        if (Object.keys(t).length === 0) rouletteTransfos.delete(userId);
        else rouletteTransfos.set(userId, t);
        return true; // Était actif, a été annulé
    }
    t[type] = Date.now() + dureeMs;
    rouletteTransfos.set(userId, t);
    return false; // N'était pas actif, a été appliqué
}
function surTexte(texte, fn) {
    return texte
        .split(/(<[^>]+>|https?:\/\/\S+|```[\s\S]*?```|`[^`]*`)/g)
        .map((morceau, idx) => idx % 2 === 1 ? morceau : fn(morceau))
        .join('');
}
function melanger(liste) {
    for (let i = liste.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [liste[i], liste[j]] = [liste[j], liste[i]];
    }
    return liste;
}
function appliquerTransfos(userId, texte) {
    const t = rouletteTransfos.get(userId);
    if (!t) return texte;
    const now = Date.now();
    for (const k of Object.keys(t)) if (now >= t[k]) delete t[k];
    if (Object.keys(t).length === 0) { rouletteTransfos.delete(userId); return texte; }

    let r = texte;
    if (t.mots && !r.includes('```')) r = melanger(r.split(/\s+/).filter(Boolean)).join(' ');
    if (t.lettres) r = surTexte(r, m => m.replace(/\p{L}{2,}/gu, mot => melanger([...mot]).join('')));
    if (t.censure) r = surTexte(r, m => m.replace(/\S+/g, mot => Math.random() < 1 / 3 ? '▇▇' : mot));
    if (t.emojiOnly) r = surTexte(r, m => m.replace(/\S+/g, () => ROULETTE_EMOJIS_ALEATOIRES[Math.floor(Math.random() * ROULETTE_EMOJIS_ALEATOIRES.length)]));
    if (t.bebe) r = surTexte(r, m => m.replace(/j/g, 'z').replace(/J/g, 'Z').replace(/r/g, 'w').replace(/R/g, 'W'));
    if (t.boomer) r = surTexte(r, m => m.replace(/[\.!\?]+/g, '..... ') + ' ' + ROULETTE_BOOMER_FINS[Math.floor(Math.random() * ROULETTE_BOOMER_FINS.length)]);
    if (t.caps) r = surTexte(r, m => m.toUpperCase());
    const max = Math.min(t.limite30 ? 30 : Infinity, t.limite100 ? 100 : Infinity);
    if (max !== Infinity && [...r].length > max) r = [...r].slice(0, max).join('').replace(/<[^>]*$/, '');
    return r;
}
function versLeet(texte) {
    const table = { a: '4', e: '3', i: '1', o: '0', s: '5', t: '7' };
    return texte
        .split(/(<[^>]+>|https?:\/\/\S+|```[\s\S]*?```|`[^`]*`)/g)
        .map((morceau, idx) => idx % 2 === 1 ? morceau : morceau.replace(/[aeiost]/gi, c => table[c.toLowerCase()]))
        .join('');
}
function retirerLettre(texte, lettre) {
    const regex = new RegExp(lettre, 'gi');
    return texte
        .split(/(<[^>]+>|https?:\/\/\S+|```[\s\S]*?```|`[^`]*`)/g)
        .map((morceau, idx) => idx % 2 === 1 ? morceau : morceau.replace(regex, ''))
        .join('');
}
const rouletteTimeoutUntil = new Map(); // userId -> timestamp de fin, UNIQUEMENT pour les timeouts causés par la roulette
const rouletteWebhooks = new Map(); // channelId -> Webhook
const rouletteNotifs = new Map();      // userId -> channelId (sauvegardé dans #json)
const rouletteNotifTimers = new Map(); // userId -> timeout (non sauvegardé, réarmé au démarrage)

function armerNotifRoulette(userId, channelId) {
    clearTimeout(rouletteNotifTimers.get(userId));
    const fin = rouletteCooldowns.get(userId) ?? 0;
    const delai = Math.max(fin - Date.now(), 0);
    const timer = setTimeout(async () => {
        rouletteNotifTimers.delete(userId);
        const finActuelle = rouletteCooldowns.get(userId) ?? 0;
        if (Date.now() < finActuelle) return armerNotifRoulette(userId, channelId); // cooldown rallongé entre-temps
        rouletteNotifs.delete(userId);
        const salon = await client.channels.fetch(channelId).catch(() => null);
        if (!salon) return;

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`roulette_tenter_${userId}`)
                .setLabel('🎰 Tenter sa chance')
                .setStyle(ButtonStyle.Primary)
        );

        await salon.send({
            content: `🎰 <@${userId}>, ton cooldown roulette est terminé ! Clique ci-dessous pour relancer immédiatement :`,
            components: [row]
        }).catch(() => {});
    }, Math.min(delai, 2 ** 31 - 1));
    rouletteNotifTimers.set(userId, timer);
}

function buildRowResultatRoulette(authorId, outcomeId, failIndex) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`roulette_probas_res_${authorId}_${outcomeId}_${failIndex}`).setLabel('🎲 Probabilités').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`roulette_notif_${authorId}`).setLabel('🔔 Me prévenir').setStyle(ButtonStyle.Secondary)
    );
}

const ROULETTE_NOMS_COMMANDES = {
    timeout3: 'malus-timeout-3min', timeout5: 'malus-timeout-5min', timeout20: 'malus-timeout-20min',
    exclu1h: 'malus-exclu-heure', exclu1j: 'malus-exclu-jour', exclu1semaine: 'malus-exclu-semaine',
    pseudo1semaine: 'malus-pseudo-lock-semaine', pseudo1mois: 'malus-pseudo-lock-mois', ban: 'malus-ban',
    papayou: 'bonus-gif-ou-audio', antifeur: 'bonus-anti-feur', couptriple: 'bonus-coup-triple', cooldowncourt: 'bonus-cooldown-court',
    jackpotboost: 'bonus-jackpot-boost', superbouclier: 'bonus-super-bouclier',
    couronne: 'bonus-couronne', redirect: 'bonus-redirect-malus', rolesup: 'bonus-role-superieur',
    legendaire: 'bonus-legendaire', elu: 'bonus-elu-roulette', youtube: 'bonus-youtube-credit',
    goodies: 'bonus-epsys-goodies', petitdej: 'bonus-epsys-petitdej', twitch: 'bonus-twitch-jeu',
    commande: 'bonus-commande-perso', '5e': 'bonus-epsys-5e', photo: 'bonus-epsys-photo',
    pseudochoix: 'bonus-pseudo-choix', epingle: 'bonus-epingle', prime: 'malus-prime', chatnoir: 'malus-chat-noir', boomer: 'malus-boomer',
    uwu: 'malus-uwu-24h', lettre: 'malus-lettre-interdite', emoji: 'malus-emoji', cooldown45: 'malus-cooldown-45',
    bouclier: 'bonus-bouclier', redirectchoix: 'bonus-redirect-choix', leet: 'malus-leet',
    caps: 'malus-caps', emojionly: 'malus-emoji-only', censure: 'malus-censure', mots: 'malus-mots-melanges',
    lettres: 'malus-lettres-melangees', limite100: 'malus-limite-100', limite30: 'malus-limite-30',
    tournee: 'special-tournee-generale', bebe: 'malus-bebe',
    vote: 'special-vote-immunite-exclusion'
};
// Table de tirage : de la plus rare à la plus courante. Un seul résultat par tirage.
// "rien" de base. Avec le pity, le vrai taux de rien tombe à ~50 % (mesuré par simulation)
const ROULETTE_TAUX_ECHEC = 0.5;
const ROULETTE_PITY_MALUS = 3; // malus depuis le dernier bonus => bonus garanti
const ROULETTE_PITY_NULS = 5;  // résultats nuls depuis le dernier bonus => bonus garanti

// type : 'bonus' | 'malus' | 'special'   poids : poids relatif   nom : titre d'embed   desc : ligne de la paytable
const ROULETTE_TABLE = [
    
    // ───────── BONUS (du plus fréquent au plus rare) ─────────
    { id: 'bonus-gif-ou-audio',        type: 'bonus',   poids: 1 / 10,    nom: 'PAPAYOU.mp3', desc: 'PAPAYOU.mp3' },
    { id: 'bonus-cooldown-court',      type: 'bonus',   poids: 1 / 10,    nom: 'Cooldown réduit à 5 min', desc: 'Les 3 prochains tirages ont un cooldown de 5 minutes' },
    { id: 'bonus-bouclier',            type: 'bonus',   poids: 1 / 12,    nom: 'Immunité au prochain malus', desc: 'Immunité au prochain malus' },
    { id: 'bonus-anti-feur',           type: 'bonus',   poids: 1 / 15,    nom: 'Immunité Anti-Feur (24h)', desc: 'Cacabot réagit avec 🛡️ au lieu de te répondre Feur pendant 24h' },
    { id: 'bonus-jackpot-boost',       type: 'bonus',   poids: 1 / 17,    nom: 'Boost Jackpot (+25%)', desc: '+25% de chance de bonus sur tes 2 prochains tirages (cumulable)' },
    { id: 'bonus-coup-triple',         type: 'bonus',   poids: 1 / 20,    nom: 'Coup Triple', desc: 'Tes 3 prochains tirages sont immédiats et sans aucun cooldown' },
    { id: 'bonus-super-bouclier',      type: 'bonus',   poids: 1 / 35,    nom: 'Super Bouclier (3 malus)', desc: 'Immunité totale contre tes 3 prochains malus (cumulable)' },
    { id: 'bonus-couronne',            type: 'bonus',   poids: 1 / 50,    nom: 'Couronne 👑 pendant 12h', desc: 'Une couronne 👑 sous tes messages pendant 12h' },
    { id: 'bonus-redirect-malus',      type: 'bonus',   poids: 1 / 85,    nom: '3 malus redirigés au hasard', desc: '3 prochains malus redirigés vers un.e autre membre' },
    { id: 'bonus-redirect-choix',      type: 'bonus',   poids: 1 / 100,   nom: 'Malus redirigé au choix', desc: 'Redirige ton prochain malus vers la personne de ton choix' },
    { id: 'bonus-epingle',             type: 'bonus',   poids: 1 / 150,   nom: 'Message épinglé', desc: 'Un message épinglé définitivement dans le salon (règles du serveur à respecter)' },
    { id: 'bonus-role-superieur',      type: 'bonus',   poids: 1 / 170,   nom: 'Rôle de Regaïen.ne niv. supérieur', desc: 'Rôle de Regaïen.ne supérieur' },
    { id: 'bonus-pseudo-choix',        type: 'bonus',   poids: 1 / 250,   nom: 'Pseudo au choix', desc: 'Choisis le pseudo d\'un·e membre, verrouillé pendant 48h (révocable si problématique)' },
    { id: 'bonus-legendaire',          type: 'bonus',   poids: 1 / 420,   nom: 'Regaïen·ne légendraire', desc: 'Rôle de Regaïen·ne légendraire' },
    { id: 'bonus-twitch-jeu',          type: 'bonus',   poids: 1 / 850,   nom: 'Choix du jeu du prochain stream Twitch', desc: 'Choix du jeu du prochain stream Twitch - jeu court uniquement' },
    { id: 'bonus-commande-perso',      type: 'bonus',   poids: 1 / 1700,  nom: 'Commande Cacabot personnalisée', desc: 'Ajoute une commande Cacabot de ton choix' },
    { id: 'bonus-epsys-5e',            type: 'bonus',   poids: 1 / 3400,  nom: '5€ de la YouTube Money d\'Epsys', desc: '5€ de la YouTube Money d\'Epsys' },
    { id: 'bonus-epsys-photo',         type: 'bonus',   poids: 1 / 5000,  nom: 'Photo disgracieuse d\'Epsys dédicacée', desc: '1 photo disgracieuse d\'Epsys signée et envoyée par la Poste' },
    { id: 'bonus-elu-roulette',        type: 'bonus',   poids: 1 / 7000,  nom: 'Rôle Élu·e de la Roulette', desc: 'Rôle spécial d\'**Élu·e de la Roulette**' },
    { id: 'bonus-youtube-credit',      type: 'bonus',   poids: 1 / 8500,  nom: 'Pseudo crédité sous chaque vidéo YouTube', desc: 'Pseudo crédité sous chaque vidéo YouTube' },
    { id: 'bonus-epsys-goodies',       type: 'bonus',   poids: 1 / 12500, nom: 'Goodies d\'Epsys', desc: 'Goodies d\'Epsys gratuit au choix: T-Shirt/Mug/Lot de 5pin\'s' },
    { id: 'bonus-epsys-petitdej',      type: 'bonus',   poids: 1 / 17000, nom: 'Petit déj apporté par Epsys en maid dress', desc: 'Petit déj apporté par Epsys en maid dress' },

    // ───────── MALUS (du plus fréquent au plus rare) ─────────
    { id: 'malus-timeout-3min',        type: 'malus',   poids: 1 / 10,    nom: 'Mute de 3 minutes', desc: 'Mute de 3 minutes' },
    { id: 'malus-timeout-5min',        type: 'malus',   poids: 1 / 15,    nom: 'Mute de 5 minutes', desc: 'Mute de 5 minutes' },
    { id: 'malus-cooldown-45',         type: 'malus',   poids: 1 / 20,    nom: 'Cooldown de 45 min', desc: 'Les 2 prochains tirages ont un cooldown de 45 minutes' },
    { id: 'malus-timeout-20min',       type: 'malus',   poids: 1 / 25,    nom: 'Mute de 20 minutes', desc: 'Mute de 20 minutes' },
    { id: 'malus-emoji-only',          type: 'malus',   poids: 1 / 35,    nom: 'Emoji only pendant 1h', desc: 'Tous ses mots sont remplacés par des emojis pendant 1h' },
    { id: 'malus-bebe',                type: 'malus',   poids: 1 / 45,    nom: 'Parler bébé pendant 2h', desc: 'Les « j » deviennent des « z » et les « r » des « w » dans tous ses messages pendant 2h' },
    { id: 'malus-emoji',               type: 'malus',   poids: 1 / 55,    nom: 'Emoji obligatoire', desc: 'Doit finir chaque message par un emoji aléatoire pendant 6h' },
    { id: 'malus-chat-noir',           type: 'malus',   poids: 1 / 65,    nom: 'Malédiction du Chat Noir', desc: 'Réinitialise immédiatement ta pity et ton boost de bonus à zéro' },
    { id: 'malus-caps',                type: 'malus',   poids: 1 / 70,    nom: 'MAJUSCULES pendant 2h', desc: 'Doit parler en MAJUSCULES pendant 2h' },
    { id: 'malus-boomer',              type: 'malus',   poids: 1 / 75,    nom: 'Mode Boomer pendant 2h', desc: 'Parle comme un boomer sur Facebook pendant 2h' },
    { id: 'malus-censure',             type: 'malus',   poids: 1 / 85,    nom: 'Censure pendant 2h', desc: 'Un mot sur 3 est censuré (▇▇) pendant 2h' },
    { id: 'malus-exclu-heure',         type: 'malus',   poids: 1 / 100,   nom: 'Exclusion de 1 heure', desc: 'Exclusion de 1 heure' },
    { id: 'malus-exclu-jour',          type: 'malus',   poids: 1 / 350,   nom: 'Exclusion de 1 jour', desc: 'Exclusion de 1 jour' },
    { id: 'malus-mots-melanges',       type: 'malus',   poids: 1 / 120,   nom: 'Mots mélangés pendant 2h', desc: 'Les mots de chaque message sont mélangés pendant 2h' },
    { id: 'malus-pseudo-lock-semaine', type: 'malus',   poids: 1 / 150,   nom: 'Pseudo horrible verrouillé pendant 1 semaine', desc: 'Pseudo horrible changé de force, verrouillé pendant 1 semaine' },
    { id: 'malus-lettres-melangees',   type: 'malus',   poids: 1 / 180,   nom: 'Lettres mélangées pendant 1h', desc: 'Les lettres de chaque mot sont mélangées pendant 1h' },
    { id: 'malus-limite-100',          type: 'malus',   poids: 1 / 220,   nom: 'Limite de 100 caractères pendant 2h', desc: 'Messages coupés à 100 caractères maximum pendant 2h' },
    { id: 'malus-limite-30',           type: 'malus',   poids: 1 / 270,   nom: 'Limite de 30 caractères pendant 1h', desc: 'Messages coupés à 30 caractères maximum pendant 1h' },
    { id: 'malus-leet',                type: 'malus',   poids: 1 / 330,   nom: 'Leet speak pendant 6h', desc: 'Tous ses messages sont écrits en leet speak (a→4, e→3...) pendant 6h' },
    { id: 'malus-lettre-interdite',    type: 'malus',   poids: 1 / 400,   nom: 'Lettre interdite pendant 6h', desc: 'Ne peut plus utiliser une lettre au hasard pendant 6h' },
    { id: 'malus-uwu-24h',             type: 'malus',   poids: 1 / 480,   nom: 'UwU obligatoire pendant 6h', desc: 'Doit finir chaque message par UwU pendant 6h' },
    { id: 'malus-pseudo-lock-mois',    type: 'malus',   poids: 1 / 600,   nom: 'Pseudo horrible verrouillé pendant 1 mois', desc: 'Pseudo horrible changé de force, verrouillé pendant 1 mois' },
    { id: 'malus-prime',               type: 'malus',   poids: 1 / 800,   nom: 'MALUS PRIME', desc: 'Cumule TOUS les malus de texte/pseudo en même temps (hors mute, exclusion, cooldown, ban)' },
    { id: 'malus-exclu-semaine',       type: 'malus',   poids: 1 / 1200,  nom: 'Exclusion de 1 semaine', desc: 'Exclusion de 1 semaine' },
    { id: 'malus-ban',                 type: 'malus',   poids: 1 / 15000, nom: 'Ban définitif', desc: 'Ban définitif (révocable si besoin)' },

    // ───────── SPÉCIAL (du plus fréquent au plus rare) ─────────
    { id: 'special-vote-immunite-exclusion', type: 'special', poids: 1 / 125, nom: 'Vote public', desc: 'Vote public : tirage à volonté pendant 3min (immunité au mute) ou exclusion pendant 1 jour, décidé en 2h' },
    { id: 'special-tournee-generale',  type: 'special', poids: 1 / 600,   nom: 'Tournée générale', desc: 'Tournée générale ! Les cooldowns de tout le monde sont éteints pendant 1 minute' },
];

// Généré depuis la table : plus de doublon à maintenir
const ROULETTE_NOMS = Object.fromEntries(ROULETTE_TABLE.map(e => [e.id, e.nom]));

const ROULETTE_ID_VERS_SLUG = Object.fromEntries(Object.entries(ROULETTE_NOMS_COMMANDES).map(([slug, id]) => [id, slug]));

const ROULETTE_EMOJIS_PAR_ID = {
    'bonus-epsys-petitdej': '🍳', 'bonus-epsys-goodies': '🎁', 'bonus-youtube-credit': '📹',
    'bonus-elu-roulette': '🎖️', 'bonus-epsys-photo': '📸', 'bonus-epsys-5e': '💶',
    'malus-ban': '☠️', 'bonus-commande-perso': '🛠️', 'bonus-twitch-jeu': '🎮',
    'malus-pseudo-lock-mois': '🔒', 'bonus-legendaire': '👑', 'malus-exclu-semaine': '🚫',
    'bonus-role-superieur': '🏆', 'malus-pseudo-lock-semaine': '🔐', 'special-vote-immunite-exclusion': '🗳️',
    'bonus-redirect-malus': '😈', 'malus-exclu-jour': '🚫', 'malus-lettre-interdite': '🔤',
    'malus-uwu-24h': '😳', 'bonus-couronne': '👑', 'malus-exclu-heure': '🚫',
    'bonus-super-bouclier': '🔰', 'malus-timeout-20min': '🔇', 'bonus-jackpot-boost': '📈',
    'malus-timeout-5min': '🔇', 'bonus-gif-ou-audio': '🎉', 'bonus-anti-feur': '🛡️', 'bonus-coup-triple': '🎰',
    'bonus-cooldown-court': '⚡', 'malus-timeout-3min': '🔇',
    'bonus-bouclier': '🛡️', 'bonus-redirect-choix': '🎯', 'bonus-pseudo-choix': '✏️',
    'bonus-epingle': '📌', 'malus-emoji': '😀', 'malus-leet': '🤖', 'malus-caps': '🔠',
    'malus-emoji-only': '🙂', 'malus-censure': '▇', 'malus-mots-melanges': '🔀',
    'malus-lettres-melangees': '🔡', 'malus-limite-100': '✂️', 'malus-limite-30': '✂️',
    'special-tournee-generale': '🥂', 'malus-cooldown-45': '⏳', 'malus-prime': '💥', 'malus-bebe': '🍼', 'malus-chat-noir': '🐈‍⬛', 'malus-boomer': '🧓'
};

function buildSuggestionEmbed(data, authorMember) {
    const pourCount = data.pour.length;
    const contreCount = data.contre.length;
    const total = pourCount + contreCount;

    const pourPct = total > 0 ? Math.round((pourCount / total) * 100) : 0;
    const contrePct = total > 0 ? (100 - pourPct) : 0;

    let barre = '░░░░░░░░░░';
    if (total > 0) {
        const nbVert = Math.round((pourCount / total) * 10);
        const nbRouge = 10 - nbVert;
        barre = '🟩'.repeat(nbVert) + '🟥'.repeat(nbRouge);
    }

    const avatarUrl = authorMember?.user?.displayAvatarURL({ dynamic: true, size: 256 }) 
                   ?? authorMember?.displayAvatarURL?.({ dynamic: true, size: 256 });

    const embed = new EmbedBuilder()
        .setColor(0xd96b00) // Orange chaleureux, légèrement foncé
        .setTitle('💡 NOUVELLE SUGGESTION')
        .setDescription(
            `**Proposition :**\n> ${data.texte}\n\n` +
            `**Auteur·rice :** <@${data.authorId}>\n\n` +
            `**Votes actuels :**\n` +
            `✅ **Pour :** ${pourCount} (${pourPct}%)\n` +
            `❌ **Contre :** ${contreCount} (${contrePct}%)\n\n` +
            `\`${barre}\``
        )
        .setFooter({ text: 'Clique sur un bouton pour voter ou modifier ton vote !\nUtilisez !suggestion pour soumettre vos idées' })
        .setTimestamp();

    if (avatarUrl) {
        embed.setThumbnail(avatarUrl); // Place l'avatar en haut à droite de l'embed
    }
    return embed;
}

function buildSuggestionRow(data) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('sugg_vote_pour')
            .setLabel(`Pour (${data.pour.length})`)
            .setEmoji('✅')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('sugg_vote_contre')
            .setLabel(`Contre (${data.contre.length})`)
            .setEmoji('❌')
            .setStyle(ButtonStyle.Danger)
    );
}

function buildHelpHomeEmbed() {
    return new EmbedBuilder()
        .setColor(0x00ffff)
        .setDescription(
            "# GUIDE DE CACABOT\n\n" +
            "Voici le manuel d'utilisation de <@1503495713097519355>.\n" +
            "Choisis une catégorie dans le menu ci-dessous pour afficher les commandes correspondantes !\n\n" +
            "🔥・**À LA UNE EN CE MOMENT :**\n" +
            "-# 🎰 `!roulette` | `!rlt` — La fameuse roulette qui te fait gagner des trucs... ou pas. → <#1553954760900608091>\n\n" +
            "💡・**ASTUCE :**\n" +
            "-# Tu as une idée d'amélioration pour le bot ou le serveur ? Envoie `!suggestion [ton idée]` dans le salon <#720079866199801937>\n\n" +
            "## **__CATÉGORIES DISPONIBLES :__**"
        )
        .addFields(
            // Ligne 1
            { name: '💥・Interactions & Social', value: 'Interagis, clashe, réagis ou amuse-toi avec les membres.', inline: true },
            { name: '🔮・Jeux, Hasard & Destin', value: 'La roulette, le criminel du jour, prédictions et hasard.', inline: true },
            { name: '\u200b', value: '\u200b', inline: true },

            // Ligne 2
            { name: '💬・Salons & Vie du Serveur', value: 'Le verdict Top Chef, questions du soir, choix et anniversaires.', inline: true },
            { name: '📊・Stats & Utilitaires', value: 'Classements, profils, avatar, météo, pomodoro et serveur.', inline: true },
            { name: '\u200b', value: '\u200b', inline: true },

            // Ligne 3 (YouTube à gauche, Cacabot à droite)
            { name: '<:YouTube:1505457903585198151>・YouTube', value: 'Recherche de vidéos, dernières sorties et stats de chaînes.', inline: true },
            { name: '🤖・Cacabot & Infos', value: 'Infos du bot, latence en direct, silence et gestion.', inline: true },
            { name: '\u200b', value: '\u200b', inline: true }
        );
}

function buildHelpMenu(authorId, messageId) {
    const menu = new StringSelectMenuBuilder()
        .setCustomId(`help_select_${authorId}_${messageId ?? ''}`)
        .setPlaceholder('Choisis une catégorie de commandes...')
        .addOptions(
            { label: 'Interactions & Social', emoji: '💥', description: 'kiss, hug, insult, die, ban, bait, punch, rizz...', value: 'interact' },
            { label: 'Jeux, Hasard & Destin', emoji: '🔮', description: 'roulette, wanted, destin, animal, flip, blague...', value: 'jeux' },
            { label: 'Salons & Vie du Serveur', emoji: '💬', description: 'topchef, question, choix, anniversaire, suggestion...', value: 'serveur' },
            { label: 'Stats & Utilitaires', emoji: '📊', description: 'top, actif, profil, avatar, serveur, météo, pomodoro...', value: 'util' },
            { label: 'YouTube', emoji: '1505457903585198151', description: 'youtube, last, stats...', value: 'youtube' },
            { label: 'Cacabot & Infos', emoji: '🤖', description: 'botinfo, ping, stop, unstop...', value: 'cacabot' }
        );
    return new ActionRowBuilder().addComponents(menu);
}

function buildHelpNavRow(authorId, messageId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`help_home_${authorId}_${messageId ?? ''}`)
            .setLabel('Accueil')
            .setEmoji('🏠')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`help_delete_${authorId}_${messageId ?? ''}`)
            .setLabel('Fermer')
            .setEmoji('🗑️')
            .setStyle(ButtonStyle.Danger)
    );
}

function buildHelpCategoryEmbed(category) {
    const embed = new EmbedBuilder();

    if (category === 'interact') {
        return embed.setColor(0xffdc5d)
            .setTitle('💥  Interactions & Social')
            .setDescription(
                "### 💖 __Amour, Charme & Affection :__\n" +
                "💋 **`!kiss`** | **`!bisou`** `[membre]`\n" +
                "-# Embrasser un·e membre (solo ou avec bouton pour embrasser en retour)\n" +
                "🫂 **`!hug`** | **`!calin`** `[membre]`\n" +
                "-# Faire un gros câlin réconfortant à quelqu'un\n" +
                "🗿 **`!rizz`** `[membre]`\n" +
                "-# Tenter de séduire un·e membre avec une technique douteuse\n\n" +

                "### ⚔️ __Bagarre, Clashes & Provoc :__\n" +
                "🥊 **`!punch`** | **`!frappe`** `[membre]`\n" +
                "-# Mettre une grosse droite à quelqu'un (bouton riposte disponible)\n" +
                "🔫 **`!bang`** | **`!tir`** `[membre]`\n" +
                "-# Dégainer et tirer sur un·e membre\n" +
                "🗯️ **`!insult`** `[membre]`\n" +
                "-# Insulter gratuitement quelqu'un avec un GIF bien salé\n" +
                "🎣 **`!bait`** `[membre]`\n" +
                "-# Ragebait un·e membre (qui aura un bouton spécial pour se venger)\n" +
                "🔨 **`!ban`** `[membre]`\n" +
                "-# Faussement bannir quelqu'un du serveur avec style\n\n" +

                "### 🎭 __Émotions & Délires :__\n" +
                "💃 **`!danse`** `[membre]`\n" +
                "-# S'ambiancer sur le dancefloor en solo ou inviter quelqu'un\n" +
                "😆 **`!rire`**\n" +
                "-# Se taper une grosse barre de rire (ou rire d'un membre)\n" +
                "😭 **`!cry`** | **`!pleure`** `[membre]`\n" +
                "-# Fondre en larmes tout seul ou à cause de quelqu'un\n" +
                "🏃 **`!run`** | **`!court`** `[membre]`\n" +
                "-# Prendre la fuite (les autres peuvent t'accompagner)\n" +
                "💥 **`!explode`**\n" +
                "-# Exploser sans aucune raison valable\n" +
                "☠️ **`!die`** `[membre]`\n" +
                "-# Mourir dans d'atroces souffrances (ou faire mourir un membre)\n\n" +

                "### 🧠 __Culture & Références :__\n" +
                "📜 **`!quote`** `[membre / ID]`\n" +
                "-# Ressortir une phrase culte du serveur hors-contexte (ou réponds à un message avec !quote pour l'enregistrer)\n" +
                "😎 **`!jailaref`** `[membre]`\n" +
                "-# Flexer parce que tu as la référence\n" +
                "😐 **`!palaref`** `[membre]`\n" +
                "-# Assumer publiquement que tu n'as absolument rien compris"
            );
    }

    if (category === 'jeux') {
        return embed.setColor(0xffd20a)
            .setTitle('🔮  Jeux, Hasard & Destin')
            .setDescription(
                "### 🎰 __Roulette Regaïenne :__\n" +
                "🎲 **`!roulette`** | **`!rlt`** `(ou !rlt go)`\n" +
                "-# Tenter sa chance sur la roulette !\n" +
                "🏆 **`!rlttop`**\n" +
                "-# Classement des membres ayant débloqué le plus de succès sur la roulette\n" +
                "🎖️ **`!rltsucces`** `[membre]`\n" +
                "-# Consulter tes 30 succès débloqués et ta progression\n" +
                "📊 **`!rltstate`** `[membre]`\n" +
                "-# Voir tous les bonus, malus et cooldowns actuellement actifs sur un·e membre\n" +
                "📈 **`!rltstats`** `[membre]`\n" +
                "-# Voir l'historique complet des tirages, ratios et pire série\n\n" +

                "### 🟩 __Motus Quotidien (10h & 19h) :__\n" +
                "🟩 **`!motus`**\n" +
                "-# Voir le statut du mot du jour et le temps restant jusqu'au prochain motus (10h & 19h)\n" +
                "📊 **`!motustats`** `[membre]`\n" +
                "-# Consulter les victoires, parties jouées et statistiques Motus d'un·e membre\n\n" +

                "### 🧩 __Rébus Regaïen (15h) :__\n" +
                "🧩 **`!rebus`**\n" +
                "-# Voir la session en cours et le temps restant jusqu'au prochain Rébus Regaïen à 15h00\n" +
                "📊 **`!rebusstats`** `[membre]`\n" +
                "-# Consulter les victoires, points et statistiques du Rébus Regaïen\n\n" +

                "### 🔮 __Destinée & Hasard :__\n" +
                "🔮 **`!destin`**\n" +
                "-# Découvrir ta prophétie...\n" +
                "🪐 **`!horoscope`**\n" +
                "-# L'oracle cosmique du jour selon Cacabot\n" +
                "🐕 **`!animal`** `[membre]`\n" +
                "-# Révèle ton animal spirituel (+ de 7000 combinaisons)\n" +
                "🪙 **`!flip`**\n" +
                "-# Jouer à pile ou face en solo ou lancer un vrai duel avec quelqu'un\n\n" +

                "### 🤣 __Fun & Délires :__\n" +
                "🚨 **`!wanted`**\n" +
                "-# Consulter l'avis de recherche et les preuves du criminel du jour\n" +
                "🤣 **`!blague`**\n" +
                "-# Menu interactif de blagues (Soft, Classique ou Humour Noir)\n" +
                "👔 **`!epsys`**\n" +
                "-# Envoie un GIF aléatoire d'Epsys\n" +
                "🎬 **`!bougetoi`** | **`!montage`**\n" +
                "-# Rappelle (vigoureusement) à Epsys d'aller monter sa prochaine vidéo\n" +
                "🐒 **`!sylvain`**\n" +
                "-# Singes forts ensemble"
            );
    }

    if (category === 'serveur') {
        return embed.setColor(0xe67e22)
            .setTitle('🍕  Salons & Vie du Serveur')
            .setDescription(
                "### 🍽️ __Salons Spécifiques :__\n" +
                "👨‍🍳 **`!topchef`**\n" +
                "-# Note et critique un plat dans <#1489096303508979833> sur 20 (en réponse ou mention)\n" +
                "💡 **`!suggestion`** `[ton idée]`\n" +
                "-# Proposer une idée pour le serveur dans <#720079866199801937>\n\n" +

                "### ⚖️ __Choix & Discussions :__\n" +
                "⚖️ **`!choix [x] ou [y]`**\n" +
                "-# Laisse Cacabot trancher ton dilemme\n" +
                "💬 **`!question`**\n" +
                "-# Déclenche une question de débat du soir parmi 6 thématiques\n\n" +

                "### 🎂 __Anniversaires :__\n" +
                "🎂 **`!anniversaire`**\n" +
                "-# Affiche toutes les commandes relatives aux anniversaires\n" +
                "☑️ **`!anniversaire set [JJ/MM]`**\n" +
                "-# Enregistrer ta date d'anniversaire pour recevoir un message le jour J\n" +
                "📋 **`!anniversaire list`** | **`next`** | **`show`**\n" +
                "-# Consulter la liste des dates du serveur, le prochain ou le tien"
            );
    }

    if (category === 'util') {
        return embed.setColor(0x3498db)
            .setTitle('📊  Stats & Utilitaires')
            .setDescription(
                "### 🏆 __Classements & Membres :__\n" +
                "🏆 **`!top`**\n" +
                "-# Classement général des membres les plus actif.ves (historique global)\n" +
                "📈 **`!actif`**\n" +
                "-# Podium interactif des plus actif.ves du Jour, de la Semaine et du Mois\n" +
                "🪪 **`!profil`** `[membre]`\n" +
                "-# Fiche détaillée de membre(messages, date d'arrivée, anniversaire, rôles)\n" +
                "🖼️ **`!avatar`** `[membre]`\n" +
                "-# Affiche la photo de profil d'un·e membre en grand format\n\n" +

                "### 🛠️ __Organisation & Productivité :__\n" +
                "🍅 **`!pomodoro`** `(ou !pomodoro stop)`\n" +
                "-# Lancer une session de travail minutée interactive avec temps de pause\n" +
                "⏰ **`!rappel [durée] [message]`**\n" +
                "-# Programmer un rappel perso (ex : `!rappel 30min acheter du pain`)\n" +
                "📋 **`!rappel list`** | **`remove`**\n" +
                "-# Voir ou annuler tes rappels en attente\n\n" +

                "### 🌐 __Infos & Autres :__\n" +
                "🏰 **`!serveur`**\n" +
                "-# Statistiques, niveau de boost et informations complètes sur Regaïa\n" +
                "⛅ **`!météo [ville]`**\n" +
                "-# Météo en direct, température ressentie, vent et heure locale\n" +
                "⛏️ **`!aternos`**\n" +
                "-# Affiche l'adresse IP du serveur Minecraft du serveur"
            );
    }

    if (category === 'youtube') {
        return embed.setColor(0xff0000)
            .setTitle('<:YouTube:1505457903585198151>  YouTube')
            .setDescription(
                "### 🔎 __Vidéos & Découverte :__\n" +
                "🔎 **`!youtube [recherche]`**\n" +
                "-# Recherche de vidéos avec lecteur interactif, aperçu 16:9, vues, likes et coms\n" +
                "🎬 **`!last [chaîne]`**\n" +
                "-# Affiche la toute dernière vidéo publiée par une chaîne en grand format\n" +
                "📊 **`!stats [chaîne]`**\n" +
                "-# Fiche détaillée d'une chaîne (abonnés, vues cumulées, vidéos, date de création)"
            );
    }

    if (category === 'cacabot') {
        return embed.setColor(0x5865f2)
            .setTitle('🤖  Cacabot & Infos')
            .setDescription(
                "### ℹ️ __À propos du Bot :__\n" +
                "🤖 **`!botinfo`** | **`!about`**\n" +
                "-# Version, uptime, nombre de messages envoyés et créatrices du bot\n" +
                "🏓 **`!ping`**\n" +
                "-# Teste la latence des réponses et du WebSocket Discord en direct\n\n" +

                "### 💭 __Gestion :__\n" +
                "🤫 **`!stop`** | **`!unstop`**\n" +
                "-# Endormir Cacabot pendant 1h sur le salon (ou le réveiller immédiatement)"
            );
    }

    return embed.setTitle('❓ Inconnu').setDescription('Catégorie introuvable.');
}

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
                { name: '📣 **!say [ID_salon] [message]**', value: 'Envoyer un message dans un salon au nom de Cacabot.' },
                { name: '✏️ **!edit [ID_message] [texte]**', value: 'Modifier un message envoyé par Cacabot.' },
                { name: '🟣 **!streamtest**', value: 'Tester et envoyer immédiatement l\'alerte live Twitch dans le salon dédié.' },
                { name: '💾 **!save**', value: 'Forcer une sauvegarde immédiate.' },
                { name: '💾 **!lastsave**', value: 'Afficher la date et l\'heure de la dernière sauvegarde.' }
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
        return embed.setTitle('👥 Rôles & Gestion des membres')
            .addFields(
                { name: '🔘 **!rolebtn add [ID] [@rôle] [couleur] [Texte]**', value: 'Ajouter un bouton cliquable de rôle sur un message de Cacabot.' },
                { name: '🗑️ **!rolebtn remove [ID] [@rôle]**', value: 'Retirer un bouton de rôle d\'un message.' },
                { name: '🎭 **!rolereac [ID] [emoji] [@rôle]**', value: 'Ajouter un rôle réaction classique par emoji (ou `!rolereac list/remove`).' },
                { name: '📜 **!quote remove [ID]**', value: 'Supprimer définitivement une citation des archives.' },
                { name: '⏰ **!rappel [ID] Xmin/h [message]**', value: 'Envoyer un rappel à un membre spécifique par son ID.' },
                { name: '📝 **!setmessages @Membre [nombre]**', value: 'Définir manuellement le nombre de messages d\'un membre.' }
            );
    }
    if (categorie === 'roulette') {
        return embed.setColor(0xffd20a).setTitle('🎰 Commandes roulette')
            .addFields(
                { name: '🔄 **!reroll [membre]**', value: 'Réinitialise le cooldown d\'un·e membre.' },
                { name: '🎉/💀 **!bonusforce / !malusforce [id] [membre]**', value: 'Impose un bonus ou un malus à un·e membre.' },
                { name: '📋 **!rouletteID / !rltid**', value: 'Affiche tous les identifiants de bonus/malus/spécial, triés par bouton.' },
                { name: '🎖️ **!rltsuccesforce [id] [membre]**', value: 'Donne un succès, liste les 30 IDs ou teste l\'animation (`!rltsuccesforce test`).' },
                { name: '♻️ **!resetroulettestate / !resetrlt [membre]**', value: 'Réinitialise tout l\'état roulette d\'un·e membre.' },
                { name: '🗑️ **!removestate [membre] [nom]**', value: 'Retire un seul effet actif d\'un·e membre.' }
            );
    }
    return embed.setTitle('❓ Inconnu').setDescription('Catégorie introuvable.');
}

function buildRouletteTypeEmbed(type) {
    const titres = { bonus: '🎉 Bonus', malus: '💀 Malus', special: '✨ Spéciaux' };
    const lignes = ROULETTE_TABLE
        .filter(e => e.type === type)
        .sort((a, b) => b.poids - a.poids)
        .map(e => {
            const emoji = ROULETTE_EMOJIS_PAR_ID[e.id] ?? '❓';
            const slug = ROULETTE_ID_VERS_SLUG[e.id];
            return slug ? `${emoji} **${e.nom}** — \`${slug}\`` : `${emoji} **${e.nom}**`;
        });
    return new EmbedBuilder()
        .setColor(0xffd20a)
        .setTitle(`${titres[type]} — !roulette`)
        .setDescription(lignes.join('\n'));
}

// --- Probas réelles et affichage (toujours calculés depuis la table) ---
function probaReelle(entry) {
    const total = ROULETTE_TABLE.reduce((s, e) => s + e.poids, 0);
    return entry.poids * (1 - ROULETTE_TAUX_ECHEC) / total;
}

function arrondiJoli(n) {
    if (n < 20) return Math.round(n);
    if (n < 100) return Math.round(n / 5) * 5;
    if (n < 1000) return Math.round(n / 10) * 10;
    if (n < 5000) return Math.round(n / 100) * 100;
    return Math.round(n / 500) * 500;
}

function probaAffichee(p) {
    const n = arrondiJoli(1 / p);
    const pct = 100 / n;
    return { n, pct: pct >= 0.1 ? String(parseFloat(pct.toFixed(2))) : pct.toFixed(3) };
}

// --- Tirage + pity ---
const roulettePity = new Map(); // userId -> { malus, nuls } depuis le dernier bonus

function piocherRoulette(pool, totalGlobal, defaut) {
    let tirage = Math.random() * totalGlobal;
    for (const e of pool) {
        if (tirage < e.poids) return e.id;
        tirage -= e.poids;
    }
    return defaut;
}

function tirerRoulette(userId, guildId = null) {
    const pity = roulettePity.get(userId) ?? { malus: 0, nuls: 0 };
    const garanti = pity.malus >= ROULETTE_PITY_MALUS || pity.nuls >= ROULETTE_PITY_NULS;

    let outcomeId;
    if (garanti) {
        const bonus = ROULETTE_TABLE.filter(e => e.type === 'bonus');
        outcomeId = piocherRoulette(bonus, bonus.reduce((s, e) => s + e.poids, 0), bonus[bonus.length - 1].id);
    } else {
        const boostCharges = rouletteJackpotBoostCharges.get(userId) || 0;
        const boostVal = boostCharges > 0 ? (rouletteJackpotBoostValue.get(userId) || 0.25) : 0;
        const boostAnniv = estAnniversaireAujourdhui(guildId, userId) ? 0.50 : 0;
        const totalJackpot = (rouletteJackpotBonus.get(userId) || 0) + boostVal + boostAnniv;

        if (totalJackpot > 0 && Math.random() < totalJackpot) {
            const bonus = ROULETTE_TABLE.filter(e => e.type === 'bonus');
            outcomeId = piocherRoulette(bonus, bonus.reduce((s, e) => s + e.poids, 0), bonus[bonus.length - 1].id);
        } else {
            const total = ROULETTE_TABLE.reduce((s, e) => s + e.poids, 0);
            outcomeId = piocherRoulette(ROULETTE_TABLE, total / (1 - ROULETTE_TAUX_ECHEC), 'aucun-resultat');
        }
    }

    const type = ROULETTE_TABLE.find(e => e.id === outcomeId)?.type;
    if (type === 'bonus') {
        roulettePity.delete(userId);
        rouletteJackpotBonus.delete(userId);
    } else if (type === 'malus') {
        pity.malus++; roulettePity.set(userId, pity);
    } else if (outcomeId === 'aucun-resultat') {
        pity.nuls++; roulettePity.set(userId, pity);
        const actuel = rouletteJackpotBonus.get(userId) || 0;
        rouletteJackpotBonus.set(userId, Math.min(ROULETTE_JACKPOT_MAX, actuel + ROULETTE_JACKPOT_INCREMENT));
    }
    return outcomeId;
}

// Registre des états roulette sauvegardés dans #json : pour en ajouter un, une seule ligne ici
const ROULETTE_ETATS = {
    cooldowns:       rouletteCooldowns,
    freeRoll:        rouletteFreeRollUntil,
    couronne:        rouletteCouronneUntil,
    antiFeur:        rouletteAntiFeurUntil,
    coupTriple:      rouletteCoupTripleCharges,
    pseudoLock:      roulettePseudoLock,
    redirectCharges: rouletteRedirectCharges,
    pity:            roulettePity,
    uwu:             rouletteUwuUntil,
    lettreInterdite: rouletteLettreInterdite,
    emoji:           rouletteEmojiUntil,
    leet:            rouletteLeetUntil,
    transfos:        rouletteTransfos,
    cooldown45:      rouletteCooldown45Charges,
    cooldownCourt:   rouletteCooldownCourtCharges,
    bouclier:        rouletteBouclierActif,
    jackpotBoostCharges: rouletteJackpotBoostCharges,
    jackpotBoostValue:   rouletteJackpotBoostValue,
    redirectChoixCible: rouletteRedirectChoixCible,
    jackpot:            rouletteJackpotBonus,
    stats:              rouletteStats,
    achievements:       rouletteAchievements,
    suggestions:        suggestionsData,
    immunite:           rouletteImmuniteUntil,
    timeoutRoulette:    rouletteTimeoutUntil,
    notifs:             rouletteNotifs,
    malusConsecutifs:   rouletteMalusConsecutifs,
    antiFeurDodges:     rouletteAntiFeurDodges,
    malusDifferents:    rouletteMalusDifferents,
    papayouDaily:       roulettePapayouDaily,
    coupTripleScore:    rouletteCoupTripleScore,
    happyHourCompteur:  rouletteHappyHourCompteur
};

const ROULETTE_FAILS = [
    "Retente ta chance dans 15 minutes ptdr", "Le hasard, ce traître 😔", "Nan là c'est mort", "Nope",
    "Raté, dommage", "Tout caca ce tirage...", "Rien du tout mdr", "C'est chiant ça fait tourner en rond pour rien",
    "OH! T'as rien gagné.", "OH MON DIEU! Rien.", "Nsm la roulette", "Bon bah salut hein.",
    "Rien, comme prévu", "Continue d'y croire, hein", "Nada", "Rien, à la prochaine!", "Ça pue", "Bah non",
    "T'y crois trop toi", "Aucun résultat, tkt", "Ptdrrr rien", "Reviens dans 15min lol", "Toujours rien avec toi",
    "Bof...", "Raté.", "Erreur_404", "Zéro, comme d'hab", "Ça sert à rien de réessayer tout de suite",
    "Chance de merde", "Rip ton tirage", "C'est mort pour cette fois", "Aucun résultat ptdr", "Nan",
    "Rien à dire de plus", "Vide total", "Rien du tout", "C'est pas ton jour on dirait", "Meh", "Retente ta chance",
    "Rien mdr désolé", "C'est raté", "Bon bah à toute à l'heure !", "Le hasard, le hasard...", "Toujours rien",
    "Pas de nouvelle, bonne nouvelle !", "Bof bof", "FF", "Ratio", "Hmmm, je crois qu'il y a rien... A moins que... Ah non, y a rien.",
    "Rien à signaler", "Naaaan", "Au revoir, bisous.   -Maman", "Rien, dsl", "[Insérer musique à la trompette]",
    "[Insérer musique triste au violon]", "Mdr t'espérais quoi", "Bah rien en fait", "Aucun effet", "C'est mort", "Ptdr non", "Rien pour toi",
    "Nul", "C'est un peu trop  calme... J'aime pas trop beaucoup ça...", "Aucun résultat, ratio", "C'est vide", "Chance en carton",
    "Ah.", "Rien, essaie encore. 'Fin pas tout de suite mais dans 15 minutes, quoi.", "Bof franchement", "Rip", "Nan c'est raté", "Rien du tout, sois pas triste",
    "Aucun résultat mdrrr", "C'est raté, tant pis", "Nul ce tirage", "Chance zéro", "Ptdr t'as rien eu",
    "Rien, la prochaine fois peut-être", "Nan, rien", "Aucun bonus, dommage", "C'est raté, à plus", "Rien de fou", "Chance ratée", "Mdr encore raté",
    "Nan c'est nul ce tirage", "Rien pour cette fois", "C'est mort, retente", "Aucun résultat",
    "Bof, rien", "Nul comme d'hab", "Rien à faire", "C'est vide", "Chance à chier", "Ptdr rien du tout",
    "Nan c'est raté, dommage", "Rien, la chance n'est pas de ton côté aujourd'hui"
];

const ROULETTE_NOMS_PSEUDO_LOCK = [
    "Caca boudin", "Diarrhée explosive", "_XxD4rkSasuk3xX_", "BardellaLover69", "Sam Gratlékouy", "CharlieKirkFanAccountV2",
    "Pierre Chabrier", "SansPlomb95", "Cherche une copine sur Maubeuge", "https://youtu.be/vCIG5VeP_I0",
    "Oestrodose", "Puff goût paf"
];

const ROULETTE_RANGS = [
    { id: '720080477926457476', label: 'Regaïen.ne' },
    { id: '720080749360971817', label: 'Regaïen.ne amateur.e' },
    { id: '720080968396046428', label: 'Regaïen.ne bavard.e' },
    { id: '720081125438914690', label: 'Regaïen.ne populaire' },
    { id: '1230643204664070328', label: 'Regaïen.ne légendraire' }
];

function estImmuniseRoulette(userId) {
    const fin = rouletteImmuniteUntil.get(userId);
    if (!fin) return false;
    if (Date.now() >= fin) { rouletteImmuniteUntil.delete(userId); return false; }
    return true;
}

function annulerTiragesAGogo(userId) {
    rouletteFreeRollUntil.delete(userId);
    rouletteCoupTripleCharges.delete(userId);
}

// Malus violent : prévient d'abord, applique 10s plus tard, puis le message est modifié
function malusDiffere(message, nom, titre, futur, passe, action) {
    message.differe = { action, texteFinal: `💀 **${nom}** ${passe}.` };
    return `⚠️ **${nom}**, tu es tombé.e sur le malus **${titre}** : tu seras ${futur}.\nProfite de tes **10 dernières secondes** !`;
}

async function appliquerEtDecrireResultat(outcomeId, message, auteurNom, failIndex) {
    switch (outcomeId) {
        case 'malus-timeout-3min':
            if (estImmuniseRoulette(message.member.id)) return `🛡️ **${auteurNom}** est immunisé·e et évite le mute de 3 minutes !`;
            if (estModo(message.member)) return `🛡️ **${auteurNom}** est Modo : le mute de 3 minutes est annulé !`;
            annulerTiragesAGogo(message.member.id);
            await message.member.timeout(3 * 60 * 1000, 'Roulette').catch(() => {});
            rouletteTimeoutUntil.set(message.member.id, Date.now() + 3 * 60 * 1000);
            return `**${auteurNom}** est mute pendant **3 minutes**.`;
        case 'malus-timeout-5min':
            if (estImmuniseRoulette(message.member.id)) return `🛡️ **${auteurNom}** est immunisé·e et évite le mute de 5 minutes !`;
            if (estModo(message.member)) return `🛡️ **${auteurNom}** est Modo : le mute de 5 minutes est annulé !`;
            annulerTiragesAGogo(message.member.id);
            await message.member.timeout(5 * 60 * 1000, 'Roulette').catch(() => {});
            rouletteTimeoutUntil.set(message.member.id, Date.now() + 5 * 60 * 1000);
            return `**${auteurNom}** est mute pendant **5 minutes**.`;
        case 'malus-timeout-20min':
            if (estImmuniseRoulette(message.member.id)) return `🛡️ **${auteurNom}** est immunisé·e et évite le mute de 20 minutes !`;
            annulerTiragesAGogo(message.member.id);
            if (estModo(message.member)) {
                rouletteCooldowns.set(message.member.id, Date.now() + 20 * 60 * 1000);
                return `🛡️ **${auteurNom}** est Modo : le mute de 20 minutes est remplacé par un cooldown de **20 minutes**.`;
            }
            await message.member.timeout(20 * 60 * 1000, 'Roulette').catch(() => {});
            rouletteTimeoutUntil.set(message.member.id, Date.now() + 20 * 60 * 1000);
            return `**${auteurNom}** est mute pendant **20 minutes**.`;
        case 'malus-exclu-heure':
            if (estImmuniseRoulette(message.member.id)) return `🛡️ **${auteurNom}** est immunisé·e et évite l'exclusion de 1 heure !`;
            annulerTiragesAGogo(message.member.id);
            if (estModo(message.member)) {
                rouletteCooldowns.set(message.member.id, Date.now() + 60 * 60 * 1000);
                return `🛡️ **${auteurNom}** est Modo : l'exclusion de 1 heure est remplacée par un cooldown de **1 heure**.`;
            }
            return malusDiffere(message, auteurNom, 'Exclusion de 1 heure', 'exclu.e pendant **1 heure**', 'a été exclu.e pendant **1 heure**',
                () => {
                    message.member.timeout(60 * 60 * 1000, 'Roulette').catch(() => {});
                    rouletteTimeoutUntil.set(message.member.id, Date.now() + 60 * 60 * 1000);
                });
        case 'malus-exclu-jour':
            if (estImmuniseRoulette(message.member.id)) return `🛡️ **${auteurNom}** est immunisé·e et évite l'exclusion de 1 jour !`;
            deverrouillerSucces(message.member.id, 'silence-radio', message.channel);
            annulerTiragesAGogo(message.member.id);
            if (estModo(message.member)) {
                rouletteCooldowns.set(message.member.id, Date.now() + 24 * 60 * 60 * 1000);
                return `🛡️ **${auteurNom}** est Modo : l'exclusion de 1 jour est remplacée par un cooldown de **1 jour**.`;
            }
            return malusDiffere(message, auteurNom, 'Exclusion de 1 jour', 'exclu.e pendant **1 jour**', 'a été exclu.e pendant **1 jour**',
                () => {
                    message.member.timeout(24 * 60 * 60 * 1000, 'Roulette').catch(() => {});
                    rouletteTimeoutUntil.set(message.member.id, Date.now() + 24 * 60 * 60 * 1000);
                });
        case 'malus-exclu-semaine':
            deverrouillerSucces(message.member.id, 'survivant-enfer', message.channel);
            if (estImmuniseRoulette(message.member.id)) return `🛡️ **${auteurNom}** est immunisé·e et évite l'exclusion de 1 semaine !`;
            annulerTiragesAGogo(message.member.id);
            if (estModo(message.member)) {
                rouletteCooldowns.set(message.member.id, Date.now() + 7 * 24 * 60 * 60 * 1000);
                return `🛡️ **${auteurNom}** est Modo : l'exclusion de 1 semaine est remplacée par un cooldown de **1 semaine**.`;
            }
            return malusDiffere(message, auteurNom, 'Exclusion de 1 semaine', 'exclu.e pendant **1 semaine**', 'a été exclu.e pendant **1 semaine**',
                () => {
                    message.member.timeout(7 * 24 * 60 * 60 * 1000, 'Roulette').catch(() => {});
                    rouletteTimeoutUntil.set(message.member.id, Date.now() + 7 * 24 * 60 * 60 * 1000);
                });
        case 'bonus-gif-ou-audio': {
            const todayStr = new Date().toDateString();
            const rec = roulettePapayouDaily.get(message.member.id) ?? { date: todayStr, count: 0 };
            rec.count = rec.date === todayStr ? rec.count + 1 : 1;
            rec.date = todayStr;
            roulettePapayouDaily.set(message.member.id, rec);
            if (rec.count >= 3) deverrouillerSucces(message.member.id, 'fan-carlos', message.channel);
            await message.channel.send({ files: ["./PAPAYOU.mp3"] }).catch(() => {});
            return `**${auteurNom}** a fait spawn un petit cadeau !`;
        }
        case 'bonus-anti-feur':
            rouletteAntiFeurUntil.set(message.member.id, Date.now() + 24 * 60 * 60 * 1000);
            return `🛡️ **${auteurNom}** est immunisé·e contre Cacabot pendant **24h** ! Il réagira avec 🛡️ à la place de Feur.`;
        case 'bonus-coup-triple': {
            rouletteCooldowns.delete(message.member.id);
            const chargesActuelles = rouletteCoupTripleCharges.get(message.member.id) || 0;
            const totalCharges = chargesActuelles + 3;
            rouletteCoupTripleCharges.set(message.member.id, totalCharges);
            return `🎰 **${auteurNom}** décroche le **COUP TRIPLE** ! **3 tirages supplémentaires** immédiats et sans aucun cooldown (${totalCharges} en réserve) !`;
        }
        case 'bonus-twitch-jeu':
            await message.channel.send(`Bravo ! Tu as gagné le choix du jeu du prochain stream Twitch (jeu court uniquement) ! <@436218312574107658> viendra te voir pour en discuter✨`);
            await message.channel.send({ files: ["https://media.tenor.com/PxSJqqZ_lDsAAAAM/jdg-joueur-du-grenier.gif"] }).catch(() => {});
            return `**${auteurNom}** a gagné le choix du jeu du prochain stream !`;
        case 'bonus-commande-perso':
            await message.channel.send(`Bravo ! Tu as gagné le droit d'ajouter une commande de ton choix à Cacabot (modifiable par les admins) ! <@436218312574107658> viendra te voir pour en discuter✨`);
            await message.channel.send({ files: ["https://media.tenor.com/PxSJqqZ_lDsAAAAM/jdg-joueur-du-grenier.gif"] }).catch(() => {});
            return `**${auteurNom}** a gagné une commande Cacabot personnalisée !`;
        case 'bonus-epsys-5e':
            deverrouillerSucces(message.member.id, 'argent-epsys', message.channel);
            await message.channel.send(`Bravo ! Tu as gagné 5€ de la YouTube Money d'Epsys ! <@436218312574107658> viendra te voir pour en discuter✨`);
            await message.channel.send({ files: ["https://media.tenor.com/PxSJqqZ_lDsAAAAM/jdg-joueur-du-grenier.gif"] }).catch(() => {});
            return `**${auteurNom}** a gagné 5€ !`;
        case 'bonus-epsys-photo':
            await message.channel.send(`Bravo ! Tu as gagné une photo disgracieuse d'Epsys signée et envoyée chez toi par la Poste ! <@436218312574107658> viendra te voir pour en discuter✨`);
            await message.channel.send({ files: ["https://media.tenor.com/PxSJqqZ_lDsAAAAM/jdg-joueur-du-grenier.gif"] }).catch(() => {});
            return `**${auteurNom}** a gagné une photo disgracieuse d'Epsys !`;
        case 'bonus-youtube-credit':
            await message.channel.send(`WOW, ça c'est de la chance ! Ton pseudo crédité sous chaque vidéo YouTube d'Epsys à partir d'aujourd'hui ! <@436218312574107658> viendra te voir pour en discuter✨`);
            await message.channel.send({ files: ["https://media.tenor.com/PxSJqqZ_lDsAAAAM/jdg-joueur-du-grenier.gif"] }).catch(() => {});
            return `**${auteurNom}** a gagné un crédit YouTube !`;
        case 'bonus-epsys-goodies':
            await message.channel.send(`Bravo ! Tu as gagné un goodie Epsys gratuit au choix (T-Shirt/Mug/Lot de 5 pin's) ! <@436218312574107658> viendra te voir pour en discuter✨`);
            await message.channel.send({ files: ["https://media.tenor.com/PxSJqqZ_lDsAAAAM/jdg-joueur-du-grenier.gif"] }).catch(() => {});
            return `**${auteurNom}** a gagné un goodie Epsys !`;
        case 'bonus-epsys-petitdej':
            await message.channel.send(`QUOI ?? Je pensais même pas que quelqu'un pouvait l'avoir ! Lors d'une prochaine convention ou rencontre IRL, Epsys devra t'apporter un petit déjeuner en maid dress x) <@436218312574107658> viendra te voir pour en discuter✨`);
            await message.channel.send({ files: ["https://media.tenor.com/PxSJqqZ_lDsAAAAM/jdg-joueur-du-grenier.gif"] }).catch(() => {});
            return `**${auteurNom}** a gagné le petit déj légendaire !`;
        
                case 'bonus-elu-roulette': {
            const roleId = '1553670290448457829';
            if (message.member.roles.cache.has(roleId)) {
                return `**${auteurNom}** a déjà le rôle **Élu·e de la Roulette** — pas de doublon possible !`;
            }
            await message.member.roles.add(roleId).catch(() => {});
            return `👑 **${auteurNom}** obtient le rôle **Élu·e de la Roulette** !`;
        }
                case 'bonus-role-superieur': {
            deverrouillerSucces(message.member.id, 'ascension-sociale', message.channel);
            let rangActuel = -1;
            for (let i = ROULETTE_RANGS.length - 1; i >= 0; i--) {
                if (message.member.roles.cache.has(ROULETTE_RANGS[i].id)) { rangActuel = i; break; }
            }
            if (rangActuel === ROULETTE_RANGS.length - 1) {
                return `**${auteurNom}** est déjà **${ROULETTE_RANGS[rangActuel].label}**, le rang max !\nChoisis un autre bonus à la place dans le menu ci-dessous.`;
            }
            const prochainRang = ROULETTE_RANGS[rangActuel + 1];
            if (rangActuel > 0) await message.member.roles.remove(ROULETTE_RANGS[rangActuel].id).catch(() => {});
            await message.member.roles.add(prochainRang.id).catch(() => {});
            return `**${auteurNom}** passe au rang **${prochainRang.label}** !`;
        }
        case 'bonus-legendaire': {
            deverrouillerSucces(message.member.id, 'ascension-sociale', message.channel);
            const roleId = ROULETTE_RANGS[ROULETTE_RANGS.length - 1].id;
            if (message.member.roles.cache.has(roleId)) {
                return `**${auteurNom}** est déjà **${ROULETTE_RANGS[ROULETTE_RANGS.length - 1].label}**, le rang max !\nChoisis un autre bonus à la place dans le menu ci-dessous.`;
            }
            for (const rang of ROULETTE_RANGS) {
                if (rang.id !== ROULETTE_RANGS[0].id && message.member.roles.cache.has(rang.id)) {
                    await message.member.roles.remove(rang.id).catch(() => {});
                }
            }
            await message.member.roles.add(roleId).catch(() => {});
            return `👑 **${auteurNom}** passe directement au rang **Regaïen·ne légendaire** !`;
        }

        case 'bonus-jackpot-boost': {
            const curCharges = rouletteJackpotBoostCharges.get(message.member.id) || 0;
            const curVal = rouletteJackpotBoostValue.get(message.member.id) || 0;
            const newCharges = curCharges + 2;
            const newVal = curVal + 0.25;
            rouletteJackpotBoostCharges.set(message.member.id, newCharges);
            rouletteJackpotBoostValue.set(message.member.id, newVal);
            return `📈 **${auteurNom}** active un **BOOST JACKPOT IMMÉDIAT** ! **+${Math.round(newVal * 100)}% de chance de bonus** sur ses **${newCharges} prochains tirages** (cumulable) !`;
        }
        case 'bonus-super-bouclier': {
            const actuelles = rouletteBouclierActif.get(message.member.id) || 0;
            const total = actuelles + 3;
            rouletteBouclierActif.set(message.member.id, total);
            if (total >= 10) deverrouillerSucces(message.member.id, 'forteresse', message.channel);
            return `🔰 **${auteurNom}** décroche le **SUPER BOUCLIER** ! **+3 charges de bouclier** ajoutées (${total} en réserve) !`;
        }
        case 'malus-ban':
            deverrouillerSucces(message.member.id, 'survivant-enfer', message.channel);
            if (estImmuniseRoulette(message.member.id)) return `🛡️ **${auteurNom}** est immunisé·e et évite le ban définitif !`;
            annulerTiragesAGogo(message.member.id);
            if (estModo(message.member)) {
                rouletteCooldowns.set(message.member.id, Date.now() + 7 * 24 * 60 * 60 * 1000);
                return `🛡️ **${auteurNom}** est Modo : le ban est remplacé par un cooldown de **1 semaine**.`;
            }
            return malusDiffere(message, auteurNom, 'Ban définitif', 'banni.e du serveur', 'a été banni.e du serveur',
                () => message.member.ban({ reason: 'Roulette' }).catch(() => {}));

        case 'bonus-couronne':
            deverrouillerSucces(message.member.id, 'laristocrate', message.channel);
            rouletteCouronneUntil.set(message.member.id, Date.now() + 12 * 60 * 60 * 1000);
            return `👑 **${auteurNom}** est officiellement respecté·e par Cacabot pendant **12h** !`;
        case 'malus-pseudo-lock-semaine': {
            const pseudo = ROULETTE_NOMS_PSEUDO_LOCK[Math.floor(Math.random() * ROULETTE_NOMS_PSEUDO_LOCK.length)];
            roulettePseudoLock.set(message.member.id, { until: Date.now() + 7 * 24 * 60 * 60 * 1000, pseudo });
            await message.member.setNickname(pseudo).catch(() => {});
            return `**${auteurNom}** se retrouve avec le pseudo **${pseudo}**, verrouillé pendant **1 semaine** !`;
        }
        case 'malus-pseudo-lock-mois': {
            const pseudo = ROULETTE_NOMS_PSEUDO_LOCK[Math.floor(Math.random() * ROULETTE_NOMS_PSEUDO_LOCK.length)];
            roulettePseudoLock.set(message.member.id, { until: Date.now() + 30 * 24 * 60 * 60 * 1000, pseudo });
            await message.member.setNickname(pseudo).catch(() => {});
            return `**${auteurNom}** se retrouve avec le pseudo **${pseudo}**, verrouillé pendant **1 mois** !`;
        }

        case 'malus-uwu-24h': {
            const finUwu = rouletteUwuUntil.get(message.member.id);
            if (finUwu && Date.now() < finUwu) {
                rouletteUwuUntil.delete(message.member.id);
                return `✨ **Miracle !** **${auteurNom}** retombe sur le malus **UwU** alors qu'il était encore actif : il est **annulé** !`;
            }
            rouletteUwuUntil.set(message.member.id, Date.now() + 6 * 60 * 60 * 1000);
            return `**${auteurNom}** doit terminer chacun de ses messages par **UwU** pendant **6h** !`;
        }
        case 'malus-lettre-interdite': {
            const lockLettre = rouletteLettreInterdite.get(message.member.id);
            if (lockLettre && Date.now() < lockLettre.until) {
                rouletteLettreInterdite.delete(message.member.id);
                return `✨ **Miracle !** **${auteurNom}** retombe sur la **lettre interdite** alors qu'elle était encore active : elle est **annulée** !`;
            }
            const lettre = String.fromCharCode(65 + Math.floor(Math.random() * 26));
            rouletteLettreInterdite.set(message.member.id, { until: Date.now() + 6 * 60 * 60 * 1000, lettre });
            return `**${auteurNom}** ne peut plus utiliser la lettre **${lettre}** pendant **6h** !`;
        }
        case 'bonus-redirect-malus': {
            const total = (rouletteRedirectCharges.get(message.member.id) || 0) + 3;
            rouletteRedirectCharges.set(message.member.id, total);
            return `😈 **${auteurNom}** peut rediriger ses **3 prochains malus** vers un·e autre membre ! (${total} en réserve)`;
        }
        case 'malus-emoji': {
            const finEmoji = rouletteEmojiUntil.get(message.member.id);
            if (finEmoji && Date.now() < finEmoji) {
                rouletteEmojiUntil.delete(message.member.id);
                return `✨ **Miracle !** **${auteurNom}** retombe sur l'**emoji obligatoire** alors qu'il était encore actif : il est **annulé** !`;
            }
            rouletteEmojiUntil.set(message.member.id, Date.now() + 6 * 60 * 60 * 1000);
            return `**${auteurNom}** doit terminer chacun de ses messages par un **emoji aléatoire** pendant **6h** !`;
        }
        case 'malus-chat-noir':
            if ((rouletteJackpotBonus.get(message.member.id) || 0) >= 0.05) {
                deverrouillerSucces(message.member.id, 'chat-noir', message.channel);
            }
            roulettePity.delete(message.member.id);
            rouletteJackpotBonus.delete(message.member.id);
            return `🐈‍⬛ **${auteurNom}** subit la **Malédiction du Chat Noir** : sa pity et son bonus jackpot accumulés sont réduits à zéro !`;
        case 'malus-caps':
            if (basculerTransfo(message.member.id, 'caps', 2 * 60 * 60 * 1000)) {
                return `✨ **Miracle !** **${auteurNom}** retombe sur les **MAJUSCULES** alors qu'elles étaient encore actives : le malus est **annulé** !`;
            }
            return `**${auteurNom}** doit **PARLER EN MAJUSCULES** pendant **2h** !`;
        case 'malus-boomer':
            if (basculerTransfo(message.member.id, 'boomer', 2 * 60 * 60 * 1000)) {
                return `✨ **Miracle !** **${auteurNom}** retombe sur le **mode Boomer** alors qu'il était encore actif : le malus est **annulé** !`;
            }
            return `🧓 **${auteurNom}** passe en **mode Boomer** pendant **2h** ..... A bon entendeur ... !`;
        case 'malus-emoji-only':
            if (basculerTransfo(message.member.id, 'emojiOnly', 60 * 60 * 1000)) {
                return `✨ **Miracle !** **${auteurNom}** retombe sur l'**emoji only** alors qu'il était encore actif : le malus est **annulé** !`;
            }
            return `**${auteurNom}** ne peut plus s'exprimer qu'en **emojis** pendant **1h** !`;
        case 'malus-censure':
            if (basculerTransfo(message.member.id, 'censure', 2 * 60 * 60 * 1000)) {
                return `✨ **Miracle !** **${auteurNom}** retombe sur la **censure** alors qu'elle était encore active : le malus est **annulé** !`;
            }
            return `**${auteurNom}** est **censuré·e** : un mot sur 3 disparaît pendant **2h** !`;
        case 'malus-mots-melanges':
            if (basculerTransfo(message.member.id, 'mots', 2 * 60 * 60 * 1000)) {
                return `✨ **Miracle !** **${auteurNom}** retombe sur les **mots mélangés** alors qu'ils étaient encore actifs : le malus est **annulé** !`;
            }
            return `**${auteurNom}** a les **mots mélangés** pendant **2h** !`;
        case 'malus-lettres-melangees':
            if (basculerTransfo(message.member.id, 'lettres', 60 * 60 * 1000)) {
                return `✨ **Miracle !** **${auteurNom}** retombe sur les **lettres mélangées** alors qu'elles étaient encore actives : le malus est **annulé** !`;
            }
            return `**${auteurNom}** a les **lettres mélangées** pendant **1h** !`;
        case 'malus-limite-100':
            if (basculerTransfo(message.member.id, 'limite100', 2 * 60 * 60 * 1000)) {
                return `✨ **Miracle !** **${auteurNom}** retombe sur la **limite de 100 caractères** alors qu'elle était encore active : le malus est **annulé** !`;
            }
            return `**${auteurNom}** est limité·e à **100 caractères** par message pendant **2h** !`;
        case 'malus-limite-30':
            if (basculerTransfo(message.member.id, 'limite30', 60 * 60 * 1000)) {
                return `✨ **Miracle !** **${auteurNom}** retombe sur la **limite de 30 caractères** alors qu'elle était encore active : le malus est **annulé** !`;
            }
            return `**${auteurNom}** est limité·e à **30 caractères** par message pendant **1h** !`;
        case 'special-tournee-generale':
            deverrouillerSucces(message.member.id, 'tournee-patron', message.channel);
            rouletteTourneeJusquA = Date.now() + 60 * 1000;
            return `🍻 **${auteurNom}** paie sa tournée ! **Tous les cooldowns sont éteints pendant 1 minute**, tirez à volonté !`;
        case 'malus-leet': {
            const finLeet = rouletteLeetUntil.get(message.member.id);
            if (finLeet && Date.now() < finLeet) {
                rouletteLeetUntil.delete(message.member.id);
                return `✨ **Miracle !** **${auteurNom}** retombe sur le **l33t sp34k** alors qu'il était encore actif : il est **annulé** !`;
            }
            rouletteLeetUntil.set(message.member.id, Date.now() + 6 * 60 * 60 * 1000);
            return `**${auteurNom}** parle maintenant en **l33t sp34k** pendant **6h** !`;
        }
        case 'malus-bebe':
            if (basculerTransfo(message.member.id, 'bebe', 2 * 60 * 60 * 1000)) {
                return `✨ **Miracle !** **${auteurNom}** retombe sur le **parler bébé** alors qu'il était encore actif : le malus est **annulé** !`;
            }
            return `🍼 **${auteurNom}** parle maintenant comme un bébé pendant **2h** : ses « j » deviennent des « z » et ses « r » des « w » !`;
        case 'malus-cooldown-45': {
            if ((rouletteCooldown45Charges.get(message.member.id) || 0) > 0) {
                deverrouillerSucces(message.member.id, 'double-peine', message.channel);
            }
            annulerTiragesAGogo(message.member.id);
            rouletteCooldowns.set(message.member.id, Date.now() + 45 * 60 * 1000);
            rouletteCooldown45Charges.set(message.member.id, 1);
            return `⏳ **${auteurNom}** aura un cooldown de **45 minutes** sur ses **2 prochains tirages** !`;
        }
        case 'bonus-cooldown-court': {
            const finActuel = rouletteCooldowns.get(message.member.id);
            if (finActuel && finActuel > Date.now() + 5 * 60 * 1000) rouletteCooldowns.set(message.member.id, Date.now() + 5 * 60 * 1000);
            rouletteCooldownCourtCharges.set(message.member.id, 3);
            return `⚡ **${auteurNom}** aura un cooldown de **5 minutes** sur ses **3 prochains tirages** !`;
        }
        case 'bonus-bouclier': {
            const actuelles = rouletteBouclierActif.get(message.member.id) || 0;
            const total = actuelles + 1;
            rouletteBouclierActif.set(message.member.id, total);
            if (total >= 10) deverrouillerSucces(message.member.id, 'forteresse', message.channel);
            return `🛡️ **${auteurNom}** gagne **1 charge de bouclier** (${total} en réserve) : son prochain malus sera annulé !`;
        }
        case 'bonus-redirect-choix': {
            await message.channel.send(`🎯 **${auteurNom}**, tu as gagné le pouvoir de choisir qui prendra ton prochain malus à ta place !\nMentionne la personne de ton choix avec **@membre** dans ce salon (tu as **5 minutes**) pour lui attribuer.`);
            const collector = message.channel.createMessageCollector({
                filter: m => m.author.id === message.member.id && m.mentions.members.first(),
                time: 5 * 60 * 1000, max: 1
            });
            collector.on('collect', (m) => {
                const cibleChoisie = m.mentions.members.first();
                rouletteRedirectChoixCible.set(message.member.id, cibleChoisie.id);
                message.channel.send(`✅ C'est enregistré ! Le prochain malus de **${auteurNom}** sera automatiquement envoyé à **${cibleChoisie.displayName}** !`);
            });
            return `🎯 **${auteurNom}** a gagné une redirection de malus au choix !`;
        }
        case 'bonus-pseudo-choix': {
            await message.channel.send(`✍️ **${auteurNom}**, tu as gagné le droit de renommer un·e membre et de bloquer son pseudo pendant **48h** !\nÉcris son **@mention** suivi du **nouveau pseudo** (exemple : \`@Caca Boudin\`) dans les **5 minutes**.`);
            const collector = message.channel.createMessageCollector({
                filter: m => m.author.id === message.member.id && m.mentions.members.first(),
                time: 5 * 60 * 1000, max: 1
            });
            collector.on('collect', async (m) => {
                const cibleChoisie = m.mentions.members.first();
                const nouveauPseudo = m.content.replace(/<@!?\d+>/g, '').trim().slice(0, 32);
                if (!cibleChoisie || !nouveauPseudo) {
                    return message.channel.send(`❌ Format invalide, le bonus de **${auteurNom}** est perdu.`);
                }
                roulettePseudoLock.set(cibleChoisie.id, { until: Date.now() + 48 * 60 * 60 * 1000, pseudo: nouveauPseudo });
                await cibleChoisie.setNickname(nouveauPseudo).catch(() => {});
                deverrouillerSucces(message.member.id, 'baptiseur', message.channel);
                message.channel.send(`✅ **${cibleChoisie.displayName}** se retrouve avec le pseudo **${nouveauPseudo}**, choisi par **${auteurNom}**, verrouillé pendant **48h** !`);
            });
            return `✍️ **${auteurNom}** a gagné le choix du pseudo d'un·e membre !`;
        }
        case 'bonus-epingle': {
            const collector = message.channel.createMessageCollector({
                filter: m => m.author.id === message.member.id,
                time: 5 * 60 * 1000, max: 1
            });
            collector.on('collect', async (m) => {
                await m.pin().catch(() => {});
                deverrouillerSucces(message.member.id, 'epingle', message.channel);
            });
            return `📌 **${auteurNom}** a gagné un droit spécial ! Envoie dans les **5 minutes** le message que tu veux épingler définitivement dans ce salon !`;
        }
        case 'special-vote-immunite-exclusion':
            message.vote = message.member;
            return `🗳️ **${auteurNom}** déclenche un **vote public** !`;
        case 'malus-prime': {
            deverrouillerSucces(message.member.id, 'malus-prime', message.channel);
            const fin6h = Date.now() + 6 * 60 * 60 * 1000;
            const lettreAlea = String.fromCharCode(65 + Math.floor(Math.random() * 26));
            rouletteLettreInterdite.set(message.member.id, { until: fin6h, lettre: lettreAlea });
            rouletteUwuUntil.set(message.member.id, fin6h);
            rouletteEmojiUntil.set(message.member.id, fin6h);
            rouletteLeetUntil.set(message.member.id, fin6h);
            activerTransfo(message.member.id, 'caps', 2 * 60 * 60 * 1000);
            activerTransfo(message.member.id, 'mots', 2 * 60 * 60 * 1000);
            activerTransfo(message.member.id, 'lettres', 60 * 60 * 1000);
            activerTransfo(message.member.id, 'bebe', 2 * 60 * 60 * 1000);
            return `☠️☠️☠️ **${auteurNom}** subit le **MALUS PRIME** : absolument tous les malus de texte en même temps (censure, emoji only, mute, exclusion, cooldown et ban épargnés) !`;
        }
        case 'aucun-resultat':
            return ROULETTE_FAILS[failIndex];
        default:
            console.error(`[Roulette] Résultat sans case : ${outcomeId}`);
            return `⚠️ Ce résultat n'est pas encore codé, <@436218312574107658> va devoir s'en occuper !`;
    }
}

function buildVoteRouletteEmbed(membre) {
    return new EmbedBuilder()
        .setColor(0xffd20a)
        .setTitle(`🗳️ VOTE PUBLIC ! (${libelleProbaRoulette('special-vote-immunite-exclusion')})`)
        .setDescription(`Que mérite **${membre.displayName}** ?\n\n✅ Tirage à volonté pendant 3min (immunité au mute)\n❌ Exclusion pendant 1 jour\n\nVote ouvert pendant **2h**.`);
}

async function demarrerVoteRoulette(msg, membre) {
    await msg.react('✅');
    await msg.react('❌');

    // Rappel 🆙 toutes les 55 min tant que le vote est ouvert
    const rappels = setInterval(() => { msg.reply('🆙').catch(() => {}); }, 55 * 60 * 1000);

    setTimeout(async () => {
        clearInterval(rappels);
        try {
            const fresh = await msg.channel.messages.fetch(msg.id);
            const reagirOui = await fresh.reactions.cache.get('✅')?.users.fetch() ?? new Map();
            const reagirNon = await fresh.reactions.cache.get('❌')?.users.fetch() ?? new Map();
            const idsOui = [...reagirOui.values()].filter(u => !u.bot).map(u => u.id);
            const idsNon = [...reagirNon.values()].filter(u => !u.bot).map(u => u.id);
            const doubles = new Set(idsOui.filter(id => idsNon.includes(id)));
            const oui = idsOui.filter(id => !doubles.has(id)).length;
            const non = idsNon.filter(id => !doubles.has(id)).length;
            if (oui >= non) {
                rouletteFreeRollUntil.set(membre.id, Date.now() + 3 * 60 * 1000);
                rouletteImmuniteUntil.set(membre.id, Date.now() + 3 * 60 * 1000);
                deverrouillerSucces(membre.id, 'innocente', msg.channel);
                await msg.reply(`✅ Le vote a tranché : **${membre.displayName}** gagne un tirage à volonté pendant 3 minutes !`);
            } else {
                deverrouillerSucces(membre.id, 'condamne-plebe', msg.channel);
                if (estModo(membre)) {
                    rouletteCooldowns.set(membre.id, Date.now() + 24 * 60 * 60 * 1000);
                    await msg.reply(`❌ Le vote a tranché : **${membre.displayName}** est Modo, l'exclusion est remplacée par un cooldown de **1 jour**.`);
                } else {
                    await membre.timeout(24 * 60 * 60 * 1000, 'Roulette - vote').catch(() => {});
                    rouletteTimeoutUntil.set(membre.id, Date.now() + 24 * 60 * 60 * 1000);
                    await msg.reply(`❌ Le vote a tranché : **${membre.displayName}** est exclu.e pendant 1 jour.`);
                }
            }
        } catch (e) {}
    }, 2 * 60 * 60 * 1000);
}

function buildRoulettePresentationEmbed(authorId, guildId = null) {
    const jackpot = authorId ? (rouletteJackpotBonus.get(authorId) || 0) : 0;
    const boostCharges = authorId ? (rouletteJackpotBoostCharges.get(authorId) || 0) : 0;
    const boostVal = boostCharges > 0 ? (rouletteJackpotBoostValue.get(authorId) || 0.25) : 0;
    const cEstSonAnniv = (authorId && guildId) ? estAnniversaireAujourdhui(guildId, authorId) : false;

    const fields = [
        {
            name: 'Présentation de la roulette 🍀',
            value: "La roulette qui te fait gagner des trucs... ou pas.",
            inline: false
        },
        {
            name: 'Cooldown ⏳',
            value: "15 minutes",
            inline: false
        },
        {
            name: 'Système de pity 📈',
            value: `Après **${ROULETTE_PITY_MALUS} malus** ou **${ROULETTE_PITY_NULS} résultats nuls** depuis ton dernier bonus, le tirage suivant est un **bonus garanti** !`,
            inline: false
        },
        {
            name: 'Happy hour 🔥',
            value: "Tous les soirs de **20h à 21h**, le cooldown passe à **5 minutes** pour tout le monde !",
            inline: false
        },
        {
            name: 'Hall of fame 🏆',
            value: `Les bonus ultra rares (moins de **${(ROULETTE_HOF_SEUIL * 100).toFixed(2)}%** de chance) sont affichés dans <#${ROULETTE_HOF_CHANNEL_ID}> !`,
            inline: false
        }
    ];

    if (cEstSonAnniv) {
        fields.unshift({
            name: '🎂・JOYEUX ANNIVERSAIRE ! 🎉',
            value: "C'est ton jour de fête aujourd'hui ! Tu bénéficies d'un **boost exceptionnel de +50% de chance de bonus** offert sur tous tes tirages de la journée !",
            inline: false
        });
    }

    const totalBoostPct = Math.round((jackpot + boostVal + (cEstSonAnniv ? 0.50 : 0)) * 100);
    if (totalBoostPct > 0) {
        fields.push({
            name: 'Bonus boosté 🎰',
            value: `Chance de bonus actuellement augmentée de **+${totalBoostPct}%** !`,
            inline: false
        });
    }

    fields.push(
        {
            name: 'Commandes utiles 💡',
            value: "📊 `!roulettestate` | `!rltstate` [membre]\n Voir les effets actifs d'un·e membre (malus, bonus, cooldown...)\n" +
                   "📈 `!roulettestats` | `!rltstats` [membre]\n Voir les statistiques d'un·e membre (tirages, bonus, malus, pire série...)",
            inline: false
        },
        {
            name: 'Probabilités 🎲',
            value: "Clique sur le bouton **🎲 Probabilités** sous ce message pour voir toutes les chances d'avoir certains bonus ou malus !",
            inline: false
        }
    );

    const embed = new EmbedBuilder()
        .setColor(cEstSonAnniv ? 0xff69b4 : 0xffd20a)
        .setTitle('🎰 | ROULETTE REGAÏENNE | 🎰')
        .setImage('https://img.draftbot.fr/1790778435185-73ff19eb6e704abb.gif')
        .addFields(fields);

    embed.data.fields = embed.data.fields.map(f => ({ ...f, value: f.value + '\n\u200b' }));
    embed.setFooter({ text: 'Astuce : Envoie [!roulette go] ou [!rlt go] pour faire un tirage instantané sans passer par cet écran !' });
    return embed;
}

function buildRouletteStateEmbed(cible, guildId = null) {
    const now = Date.now();
    const tstamp = (ms) => `<t:${Math.ceil(ms / 1000)}:R>`;
    const bonus = [];
    const malus = [];

    // --- BONUS ---
    if (guildId && estAnniversaireAujourdhui(guildId, cible.id)) {
        bonus.push('🎂 **Boost Anniversaire** (+50% de chance de bonus toute la journée !)');
    }
    if (rouletteCouronneUntil.has(cible.id) && now < rouletteCouronneUntil.get(cible.id)) {
        bonus.push(`👑 Couronne (fin ${tstamp(rouletteCouronneUntil.get(cible.id))})`);
    }
    if (rouletteAntiFeurUntil.has(cible.id) && now < rouletteAntiFeurUntil.get(cible.id)) {
        bonus.push(`🛡️ Immunité anti-feur (fin ${tstamp(rouletteAntiFeurUntil.get(cible.id))})`);
    }
    if (rouletteFreeRollUntil.has(cible.id) && now < rouletteFreeRollUntil.get(cible.id)) {
        bonus.push(`⚡ Tirage à volonté (fin ${tstamp(rouletteFreeRollUntil.get(cible.id))})`);
    }
    if (rouletteImmuniteUntil.has(cible.id) && now < rouletteImmuniteUntil.get(cible.id)) {
        bonus.push(`🛡️ Immunité au timeout (fin ${tstamp(rouletteImmuniteUntil.get(cible.id))})`);
    }
    if ((rouletteCoupTripleCharges.get(cible.id) || 0) > 0) {
        bonus.push(`🎰 ${rouletteCoupTripleCharges.get(cible.id)} tirage(s) gratuit(s) sans cooldown`);
    }
    const rawB = rouletteBouclierActif.get(cible.id);
    const nbB = typeof rawB === 'number' ? rawB : (rawB ? 1 : 0);
    if (nbB > 0) {
        bonus.push(`🛡️ ${nbB} charge${nbB > 1 ? 's' : ''} de bouclier active${nbB > 1 ? 's' : ''}`);
    }
    const bJCharges = rouletteJackpotBoostCharges.get(cible.id) || 0;
    if (bJCharges > 0) {
        const bJVal = Math.round((rouletteJackpotBoostValue.get(cible.id) || 0.25) * 100);
        bonus.push(`📈 Boost Jackpot : +${bJVal}% (${bJCharges} tirage${bJCharges > 1 ? 's' : ''} restant${bJCharges > 1 ? 's' : ''})`);
    }
    if ((rouletteRedirectCharges.get(cible.id) || 0) > 0) {
        bonus.push(`😈 ${rouletteRedirectCharges.get(cible.id)} redirection(s) de malus en réserve`);
    }
    if (rouletteRedirectChoixCible.has(cible.id)) {
        bonus.push('🎯 Redirection de malus au choix en attente');
    }
    if ((rouletteCooldownCourtCharges.get(cible.id) || 0) > 0) {
        bonus.push(`⚡ ${rouletteCooldownCourtCharges.get(cible.id)} tirage(s) à cooldown réduit (5 min)`);
    }

    // --- MALUS ---
    if (roulettePseudoLock.has(cible.id) && now < roulettePseudoLock.get(cible.id).until) {
        malus.push(`🔒 Pseudo verrouillé (${roulettePseudoLock.get(cible.id).pseudo}) (fin ${tstamp(roulettePseudoLock.get(cible.id).until)})`);
    }
    if (rouletteTimeoutUntil.has(cible.id) && now < rouletteTimeoutUntil.get(cible.id)) {
        malus.push(`💀 Timeout roulette (fin ${tstamp(rouletteTimeoutUntil.get(cible.id))})`);
    }
    if (rouletteUwuUntil.has(cible.id) && now < rouletteUwuUntil.get(cible.id)) {
        malus.push(`😳 Doit finir par UwU (fin ${tstamp(rouletteUwuUntil.get(cible.id))})`);
    }
    if (rouletteLettreInterdite.has(cible.id) && now < rouletteLettreInterdite.get(cible.id).until) {
        malus.push(`🔤 Lettre interdite : **${rouletteLettreInterdite.get(cible.id).lettre}** (fin ${tstamp(rouletteLettreInterdite.get(cible.id).until)})`);
    }
    if (rouletteEmojiUntil.has(cible.id) && now < rouletteEmojiUntil.get(cible.id)) {
        malus.push(`😀 Doit finir par un emoji (fin ${tstamp(rouletteEmojiUntil.get(cible.id))})`);
    }
    if (rouletteLeetUntil.has(cible.id) && now < rouletteLeetUntil.get(cible.id)) {
        malus.push(`🤖 Parle en l33t sp34k (fin ${tstamp(rouletteLeetUntil.get(cible.id))})`);
    }
    if ((rouletteCooldown45Charges.get(cible.id) || 0) > 0) {
        malus.push(`⏳ ${rouletteCooldown45Charges.get(cible.id)} tirage(s) restant(s) à cooldown de 45 min`);
    }

    const tf = rouletteTransfos.get(cible.id) ?? {};
    const libTf = {
        caps: '🔠 Majuscules obligatoires', emojiOnly: '🙂 Emoji only', limite100: '✂️ Limite 100 caractères',
        limite30: '✂️ Limite 30 caractères', mots: '🔀 Mots mélangés', lettres: '🔤 Lettres mélangées',
        censure: '▇ Mots censurés', bebe: '🍼 Parler bébé (j→z, r→w)', boomer: '🧓 Mode Boomer Facebook'
    };
    for (const [k, fin] of Object.entries(tf)) {
        if (now < fin && libTf[k]) malus.push(`${libTf[k]} (fin ${tstamp(fin)})`);
    }

    // --- COOLDOWN (FOOTER) ---
    const finCd = rouletteCooldowns.get(cible.id);
    let footerText = '⏳ Cooldown : Aucun (prêt à lancer !)';
    if (finCd && now < finCd) {
        const minsRestantes = Math.ceil((finCd - now) / 60000);
        footerText = `⏳ Cooldown restant : ~${minsRestantes} min`;
    }

    const pity = roulettePity.get(cible.id) ?? { malus: 0, nuls: 0 };
    const jackpotBoost = Math.round((rouletteJackpotBonus.get(cible.id) || 0) * 100);

    const pityTexte = `• **Malus subis :** **${pity.malus}/${ROULETTE_PITY_MALUS}** *(bonus garanti à 3)*\n` +
                      `• **Tirages nuls :** **${pity.nuls}/${ROULETTE_PITY_NULS}** *(bonus garanti à 5)*\n` +
                      `• **Boost accumulé :** **+${jackpotBoost}%** de chance bonus`;

    return new EmbedBuilder()
        .setColor(0xffd20a)
        .setTitle(`ÉTAT ROULETTE DE ${cible.displayName}`)
        .addFields(
            { name: 'BONUS :', value: (bonus.length ? bonus.join('\n') : '*Aucun bonus actif*') + '\n\u200b', inline: false },
            { name: 'MALUS :', value: (malus.length ? malus.join('\n') : '*Aucun malus actif*') + '\n\u200b', inline: false },
            { name: 'PROGRESSION PITY & JACKPOT 🍀', value: pityTexte, inline: false }
        )
        .setFooter({ text: footerText });
}

function buildRouletteAchievementsEmbed(cible, page = 0, authorId) {
    const userAchs = rouletteAchievements.get(cible.id) ?? {};
    const totalAchs = ROULETTE_ACHIEVEMENTS.length;
    const debl = Object.keys(userAchs).length;

    const PAGE_SIZE = 5;
    const totalPages = Math.ceil(totalAchs / PAGE_SIZE);
    const start = page * PAGE_SIZE;
    const slice = ROULETTE_ACHIEVEMENTS.slice(start, start + PAGE_SIZE);

    const lignes = slice.map(a => {
        const ts = userAchs[a.id];
        if (ts) {
            return `✅ **${a.emoji} ${a.nom}**\n${a.desc}\n-# *Débloqué <t:${Math.floor(ts / 1000)}:R>*`;
        }
        return `🔒 **${a.emoji} ${a.nom}**\n${a.desc}`;
    }).join('\n\n');

    const embed = new EmbedBuilder()
        .setColor(0xffd20a)
        .setTitle(`🎖️ Succès de ${cible.displayName} (${debl}/${totalAchs})`)
        .setDescription(lignes)
        .setFooter({ text: `Page ${page + 1}/${totalPages}` });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`rlt_achs_${cible.id}_${page - 1}_${authorId}`)
            .setLabel('⬅️ Précédent')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 0),
        new ButtonBuilder()
            .setCustomId(`rlt_achs_${cible.id}_${page + 1}_${authorId}`)
            .setLabel('➡️ Suivant')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page >= totalPages - 1),
        new ButtonBuilder()
            .setCustomId(`rlt_stats_back_${cible.id}_${authorId}`)
            .setLabel('↩️ Stats')
            .setStyle(ButtonStyle.Primary)
    );

    return { embed, row };
}

function buildRouletteStatsEmbed(cible) {
    const stats = rouletteStats.get(cible.id) ?? { tirages: 0, bonus: 0, malus: 0, rien: 0, plusGrosGain: null, pireSerie: 0 };
    const gain = stats.plusGrosGain
        ? `**${stats.plusGrosGain.nom}** (${probaAffichee(stats.plusGrosGain.proba).pct}%)`
        : 'Aucun bonus encore';

    return new EmbedBuilder()
        .setColor(0xffd20a)
        .setTitle(`📊 Stats roulette de ${cible.displayName}`)
        .setDescription(
            `🎲 Tirages : **${stats.tirages}**\n` +
            `🎉 Bonus : **${stats.bonus}**\n` +
            `💀 Malus : **${stats.malus}**\n` +
            `😶 Rien : **${stats.rien}**\n` +
            `🏆 Plus gros gain : ${gain}\n` +
            `📉 Plus longue série de malchance : **${stats.pireSerie}**`
        );
}

function updateRouletteStats(userId, outcomeId, entry) {
    const stats = rouletteStats.get(userId) ?? { tirages: 0, bonus: 0, malus: 0, rien: 0, plusGrosGain: null, serieActuelle: 0, pireSerie: 0 };
    stats.tirages++;
    if (stats.tirages >= 250) deverrouillerSucces(userId, 'veteran-250', client.channels.cache.get(ROULETTE_SALON_ID));
    if (stats.tirages >= 500) deverrouillerSucces(userId, 'centurion-500', client.channels.cache.get(ROULETTE_SALON_ID));
    if (entry?.type === 'bonus') {
        stats.bonus++;
        stats.serieActuelle = 0;
        const proba = probaReelle(entry);
        if (!stats.plusGrosGain || proba < stats.plusGrosGain.proba) stats.plusGrosGain = { nom: entry.nom, proba };
    } else if (entry?.type === 'malus') {
        stats.malus++;
        stats.serieActuelle++;
        stats.pireSerie = Math.max(stats.pireSerie, stats.serieActuelle);
    } else if (outcomeId === 'aucun-resultat') {
        stats.rien++;
        stats.serieActuelle++;
        stats.pireSerie = Math.max(stats.pireSerie, stats.serieActuelle);
    }
    rouletteStats.set(userId, stats);
}

const ROULETTE_ROLE_ADDICT_ID = '1555245236249436160';
const ROULETTE_ADDICT_SEUIL = 500;

async function verifierRoleGamblingAddict(membre) {
    if (!membre) return;
    const stats = rouletteStats.get(membre.id);
    if (!stats || stats.tirages < ROULETTE_ADDICT_SEUIL) return;
    if (membre.roles.cache.has(ROULETTE_ROLE_ADDICT_ID)) return;
    await membre.roles.add(ROULETTE_ROLE_ADDICT_ID, `Gambling addict : ${stats.tirages} rolls`)
        .catch(err => console.error('[Gambling addict] Impossible de donner le rôle :', err.message));
}

async function envoyerHallOfFame(guild, membre, entry) {
    if (!entry || entry.type !== 'bonus') return;
    const proba = probaReelle(entry);
    if (proba >= ROULETTE_HOF_SEUIL) return;

    const salon = guild.channels.cache.get(ROULETTE_HOF_CHANNEL_ID) 
        ?? await guild.channels.fetch(ROULETTE_HOF_CHANNEL_ID).catch(() => null);
    if (!salon) {
        console.error(`[Hall of Fame] Salon ${ROULETTE_HOF_CHANNEL_ID} introuvable`);
        return;
    }

    const { n, pct } = probaAffichee(proba);
    const nom = membre?.displayName ?? membre?.user?.username ?? 'Un·e membre';
    const avatar = membre?.user?.displayAvatarURL({ dynamic: true, size: 256 }) 
        ?? membre?.displayAvatarURL?.({ dynamic: true, size: 256 });
    const emoji = ROULETTE_EMOJIS_PAR_ID[entry.id] ?? '🏆';

    const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle('🏆 NOUVEL EXPLOIT AU PANTHÉON !')
        .setDescription(`Le destin a parlé ! Un bonus ultra rare vient d'être décroché sur la roulette !`)
        .addFields(
            { name: '👤 Membre récompensé·e', value: `<@${membre.id}> (${nom})`, inline: true },
            { name: `${emoji} Bonus obtenu`, value: `**${entry.nom}**`, inline: true },
            { name: '\u200b', value: '\u200b', inline: true },
            { name: '🎲 Chance de tirage', value: `**1/${n}** (${pct}%)`, inline: true },
            { name: '📅 Date de l\'exploit', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
        )
        .setFooter({ text: 'Panthéon de la Roulette • Regaïa' })
        .setTimestamp();

    if (avatar) embed.setThumbnail(avatar);
    deverrouillerSucces(membre.id, 'hof', salon);
    await salon.send({
        content: `🎉 Félicitations à <@${membre.id}> pour son coup de maître !`,
        embeds: [embed]
    }).catch(err => console.error('[Hall of Fame] Échec envoi :', err.message));
}

// Membres éligibles à une redirection aléatoire : top 30 des plus actifs, bots exclus, sans l'auteur du tirage
function membresTop30Roulette(guild, authorId) {
    return Object.entries(topData.messages)
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => guild.members.cache.get(id))
        .filter(m => m && !m.user.bot)
        .slice(0, 30)
        .filter(m => m.id !== authorId);
}

// Ping la personne qui reçoit un malus redirigé, avec la raison (envoyé après l'embed du résultat)
async function envoyerPingRedirection(channel, resultat) {
    if (!resultat.pingCible) return;
    await channel.send({
        content: resultat.pingCible.texte,
        allowedMentions: { users: [resultat.pingCible.id] }
    }).catch(() => {});
}

async function tirerEtConstruireResultatRoulette(authorId, guild, channel) {
    const now = Date.now();
    const finFreeRoll = rouletteFreeRollUntil.get(authorId);
    const chargesTriple = rouletteCoupTripleCharges.get(authorId) || 0;
    const enFreeRoll = (finFreeRoll && now < finFreeRoll) || now < rouletteTourneeJusquA || chargesTriple > 0;

    if (chargesTriple > 0) {
        rouletteCoupTripleCharges.set(authorId, chargesTriple - 1);
        if (chargesTriple - 1 === 0) rouletteCoupTripleCharges.delete(authorId);
    }

    if (!ROULETTE_COOLDOWN_EXEMPT.includes(authorId) && !enFreeRoll) {
        const finCooldown = rouletteCooldowns.get(authorId);
        if (finCooldown && now < finCooldown) {
            return { cooldown: true, reste: Math.ceil((finCooldown - now) / 1000 / 60) };
        }
        const chargesCourt = rouletteCooldownCourtCharges.get(authorId) || 0;
        const charges45 = rouletteCooldown45Charges.get(authorId) || 0;
        if (chargesCourt > 0) {
            rouletteCooldownCourtCharges.set(authorId, chargesCourt - 1);
            rouletteCooldowns.set(authorId, now + 5 * 60 * 1000);
        } else if (charges45 > 0) {
            rouletteCooldown45Charges.set(authorId, charges45 - 1);
            rouletteCooldowns.set(authorId, now + 45 * 60 * 1000);
        } else {
            const dureeCooldown = estHappyHour() ? 5 * 60 * 1000 : ROULETTE_COOLDOWN_MS;
            rouletteCooldowns.set(authorId, now + dureeCooldown);
        }
    }

    const membre = guild.members.cache.get(authorId);
    const auteurNom = membre?.displayName ?? 'Quelqu\'un';
    // 📈 Succès : Le Sauvetage (pity atteinte)
    const pityAvant = roulettePity.get(authorId) ?? { malus: 0, nuls: 0 };
    if (pityAvant.malus >= ROULETTE_PITY_MALUS || pityAvant.nuls >= ROULETTE_PITY_NULS) {
        deverrouillerSucces(authorId, 'le-sauvetage', channel);
    }

    const outcomeId = tirerRoulette(authorId, guild?.id);

    // 🔥 Succès : L'Oiseau de Nuit (10 tirages pendant Happy Hour)
    if (estHappyHour()) {
        const todayH = new Date().toDateString();
        const hh = rouletteHappyHourCompteur.get(authorId) ?? { date: todayH, count: 0 };
        hh.count = hh.date === todayH ? hh.count + 1 : 1;
        hh.date = todayH;
        rouletteHappyHourCompteur.set(authorId, hh);
        if (hh.count >= 10) deverrouillerSucces(authorId, 'oiseau-nuit', channel);
    }

    // 🪨 Succès : Enchaînement Fatal & 🧻 Le seum en personne
    if (outcomeId.startsWith('malus-')) {
        const cons = (rouletteMalusConsecutifs.get(authorId) || 0) + 1;
        rouletteMalusConsecutifs.set(authorId, cons);
        if (cons >= 3) deverrouillerSucces(authorId, 'enchainement-fatal', channel);

        let diffList = rouletteMalusDifferents.get(authorId);
        if (!Array.isArray(diffList)) { diffList = []; }
        if (!diffList.includes(outcomeId)) diffList.push(outcomeId);
        rouletteMalusDifferents.set(authorId, diffList);
        if (diffList.length >= 10) deverrouillerSucces(authorId, 'seum-en-personne', channel);
    } else {
        rouletteMalusConsecutifs.delete(authorId);
    }
    const failIndex = outcomeId === 'aucun-resultat' ? Math.floor(Math.random() * ROULETTE_FAILS.length) : 0;
    const entryTiree = ROULETTE_TABLE.find(e => e.id === outcomeId);
    updateRouletteStats(authorId, outcomeId, entryTiree);
    envoyerHallOfFame(guild, membre, entryTiree).catch(() => {});
    verifierRoleGamblingAddict(membre).catch(() => {});

    // 🎂 Succès : Jour de Gloire (bonus décroché le jour de son anniversaire)
    if (entryTiree?.type === 'bonus' && estAnniversaireAujourdhui(guild?.id, authorId)) {
        deverrouillerSucces(authorId, 'jour-de-gloire', channel);
    }
    let cible = membre;
    let cibleNom = auteurNom;
    let prefixeRedirect = '';
    let pingRedirection = null;

    // Consommation du boost jackpot (1 charge par tirage)
    const jCharges = rouletteJackpotBoostCharges.get(authorId) || 0;
    if (jCharges > 0) {
        if (jCharges - 1 <= 0) {
            rouletteJackpotBoostCharges.delete(authorId);
            rouletteJackpotBoostValue.delete(authorId);
        } else {
            rouletteJackpotBoostCharges.set(authorId, jCharges - 1);
        }
    }

    // Blocage par bouclier cumulable
    const rawBCharges = rouletteBouclierActif.get(authorId);
    const bCharges = typeof rawBCharges === 'number' ? rawBCharges : (rawBCharges ? 1 : 0);
    if (outcomeId.startsWith('malus-') && bCharges > 0) {
        const restantes = bCharges - 1;
        if (restantes <= 0) rouletteBouclierActif.delete(authorId);
        else rouletteBouclierActif.set(authorId, restantes);

        if (['malus-timeout-20min', 'malus-exclu-heure', 'malus-exclu-jour', 'malus-exclu-semaine', 'malus-ban'].includes(outcomeId)) {
            deverrouillerSucces(authorId, 'pare-balles', channel);
        }
        const msgRestantes = restantes > 0 ? ` (${restantes} charge${restantes > 1 ? 's' : ''} restante${restantes > 1 ? 's' : ''})` : '';
        const embed = buildRouletteResultEmbed(outcomeId, `🛡️ **${auteurNom}** évite le malus **${ROULETTE_NOMS[outcomeId]}** grâce à son bouclier !${msgRestantes}`);
        return { embeds: [embed], components: [buildRowResultatRoulette(authorId, outcomeId, failIndex)] };
    }

    if (outcomeId.startsWith('malus-')) {
        const cibleChoisieId = rouletteRedirectChoixCible.get(authorId);
        if (cibleChoisieId) {
            rouletteRedirectChoixCible.delete(authorId);
            const cibleChoisie = guild.members.cache.get(cibleChoisieId);
            if (cibleChoisie && cibleChoisie.id !== authorId) {
                cible = cibleChoisie;
                cibleNom = cible.displayName;
                deverrouillerSucces(authorId, 'sniper-impitoyable', channel);
                prefixeRedirect = `🎯 **${auteurNom}** avait choisi de rediriger son malus, envoyé vers **${cibleNom}** !\n`;
                pingRedirection = { id: cible.id, raison: " quelqu'un a choisi de te l'envoyer.." };
            }
        } else {
            const charges = rouletteRedirectCharges.get(authorId) || 0;
            if (charges > 0) {
                const candidats = membresTop30Roulette(guild, authorId);
                if (candidats.length > 0) {
                    cible = candidats[Math.floor(Math.random() * candidats.length)];
                    cibleNom = cible.displayName;
                    rouletteRedirectCharges.set(authorId, charges - 1);
                    prefixeRedirect = `😈 **${auteurNom}** avait un malus en réserve, redirigé vers **${cibleNom}** !\n`;
                    pingRedirection = { id: cible.id, raison: 'il/elle avait un malus en réserve' };
                }
            }
        }
    }

    const proxy = { member: cible, channel, guild };
    const texte = await appliquerEtDecrireResultat(outcomeId, proxy, cibleNom, failIndex);

    // 👶 Succès : Crise de la Quarantaine (Boomer + Parler Bébé en même temps)
    const tTransfo = rouletteTransfos.get(cible.id);
    if (tTransfo?.boomer && tTransfo?.bebe && Date.now() < tTransfo.boomer && Date.now() < tTransfo.bebe) {
        deverrouillerSucces(cible.id, 'crise-quarantaine', channel);
    }

    // 🧪 Succès : Le Pharmacien (contre-poison déclenché)
    if (texte.includes('Miracle !')) {
        deverrouillerSucces(cible.id, 'pharmacien', channel);
    }

    // 🔤 Succès : L'Incompréhensible (cumule 3 malus de texte ou plus en même temps)
    const nowCheck = Date.now();
    let malusTexteCumules = 0;
    if (rouletteUwuUntil.has(cible.id) && nowCheck < rouletteUwuUntil.get(cible.id)) malusTexteCumules++;
    if (rouletteLettreInterdite.has(cible.id) && nowCheck < rouletteLettreInterdite.get(cible.id).until) malusTexteCumules++;
    if (rouletteEmojiUntil.has(cible.id) && nowCheck < rouletteEmojiUntil.get(cible.id)) malusTexteCumules++;
    if (rouletteLeetUntil.has(cible.id) && nowCheck < rouletteLeetUntil.get(cible.id)) malusTexteCumules++;
    for (const fin of Object.values(rouletteTransfos.get(cible.id) ?? {})) {
        if (nowCheck < fin) malusTexteCumules++;
    }
    if (malusTexteCumules >= 3) {
        deverrouillerSucces(cible.id, 'incomprehensible', channel);
    }

    // 🎰 Succès : Le Braquage Parfait (3/3 bonus pendant un Coup Triple)
    if (outcomeId === 'bonus-coup-triple') {
        rouletteCoupTripleScore.set(authorId, 0);
    } else if (chargesTriple > 0) {
        if (entryTiree?.type === 'bonus') {
            const score = (rouletteCoupTripleScore.get(authorId) || 0) + 1;
            rouletteCoupTripleScore.set(authorId, score);
            if (score >= 3) deverrouillerSucces(authorId, 'braquage-parfait', channel);
        } else {
            rouletteCoupTripleScore.delete(authorId);
        }
    }

    demanderSauvegarde(); // Sauvegarde immédiate sur #json pour ne jamais perdre les malus actifs en cas de redémarrage
    const embed = buildRouletteResultEmbed(outcomeId, prefixeRedirect + texte, authorId);

    const roleMaxId = ROULETTE_RANGS[ROULETTE_RANGS.length - 1].id;
    const dejaMaxRole = (outcomeId === 'bonus-role-superieur' || outcomeId === 'bonus-legendaire') && cible.roles.cache.has(roleMaxId);

    if (dejaMaxRole) {
        return {
            embeds: [embed],
            components: [buildMenuFallbackRoulette(authorId), buildRowResultatRoulette(authorId, outcomeId, failIndex)],
            attenteChoix: true
        };
    }
    const differe = proxy.differe;
    return {
        embeds: proxy.vote ? [buildVoteRouletteEmbed(proxy.vote)] : [embed],
        components: [buildRowResultatRoulette(authorId, outcomeId, failIndex)],
        vote: proxy.vote ?? null,
        pingCible: pingRedirection ? { id: pingRedirection.id, texte: `🔔 <@${pingRedirection.id}>, **${auteurNom}** t'a redirigé le malus **${ROULETTE_NOMS[outcomeId]}** (${pingRedirection.raison}) !` } : null,
        differe: differe ? async () => {
            await differe.action();
            return buildRouletteResultEmbed(outcomeId, prefixeRedirect + differe.texteFinal);
        } : null
    };
}

async function assurerWebhookRoulette(channel) {
    if (channel.guild?.id !== '720057528351850547') return null;
    if (ROULETTE_WEBHOOK_EXCLUS.has(channel.id)) return null;
    if (rouletteWebhooks.has(channel.id)) return rouletteWebhooks.get(channel.id);
    try {
        const existants = await channel.fetchWebhooks();
        let webhook = existants.find(w => w.name === 'Cacabot Roulette');
        if (!webhook) {
            webhook = await channel.createWebhook({ name: 'Cacabot Roulette' });
        }
        rouletteWebhooks.set(channel.id, webhook);
        return webhook;
    } catch (err) {
        console.error(`Impossible de créer/récupérer le webhook roulette dans #${channel.name} :`, err.message);
        return null;
    }
}

async function initialiserWebhooksRoulette(guild) {
    if (guild.id !== '720057528351850547') return;
    const salons = guild.channels.cache.filter(c => c.type === ChannelType.GuildText);
    for (const salon of salons.values()) {
        await assurerWebhookRoulette(salon);
        await new Promise(r => setTimeout(r, 300));
    }
    console.log(`✅ Webhooks roulette prêts sur ${salons.size} salons de ${guild.name}`);
}

function libelleProbaRoulette(outcomeId) {
    if (outcomeId === 'aucun-resultat') {
        const { n, pct } = probaAffichee(ROULETTE_TAUX_ECHEC);
        return `1/${n} | ${pct}%`;
    }
    const entry = ROULETTE_TABLE.find(e => e.id === outcomeId);
    if (!entry) return null;
    const { n, pct } = probaAffichee(probaReelle(entry));
    return `1/${n} | ${pct}%`;
}

function buildRouletteResultEmbed(outcomeId, texte, authorId = null) {
    let delaiTexte = '15 minutes';
    if (authorId) {
        if ((rouletteCooldown45Charges.get(authorId) || 0) > 0) {
            delaiTexte = '45 minutes';
        } else if ((rouletteCooldownCourtCharges.get(authorId) || 0) > 0 || estHappyHour()) {
            delaiTexte = '5 minutes';
        }
    }

    const texteFinal = outcomeId === 'aucun-resultat'
        ? `${texte}\n\n*Échec du tirage, reviens dans ${delaiTexte} !*`
        : texte;

    const estContrePoison = texte.includes('Miracle !');
    const entry = ROULETTE_TABLE.find(e => e.id === outcomeId);
    const couleurs = { bonus: 0x00bf19, malus: 0x9e0000, special: 0xdb6600 };
    const prefixes = { bonus: '🎉 BONUS', malus: '💀 MALUS', special: '🌗 SPÉCIAL' };

    const couleur = estContrePoison
        ? 0x00bf19
        : outcomeId === 'aucun-resultat'
        ? 0x20876f
        : (entry ? (couleurs[entry.type] ?? 0x503649) : 0x99aab5);

    const titre = estContrePoison
        ? `✨ CONTRE-POISON ! - ${entry?.nom ?? ''} annulé !`
        : outcomeId === 'aucun-resultat'
        ? `💨 AUCUN RÉSULTAT ! (${libelleProbaRoulette('aucun-resultat')})`
        : entry ? `${prefixes[entry.type] ?? ''} - ${entry.nom} (${libelleProbaRoulette(outcomeId)})` : null;

    const embed = new EmbedBuilder().setColor(couleur).setDescription(texteFinal);
    if (titre) embed.setTitle(titre);
    return embed;
}

function buildRoulettePaytableEmbed() {
    const section = (titre, type) => {
        const lignes = ROULETTE_TABLE
            .filter(e => e.type === type)
            .sort((a, b) => b.poids - a.poids)
            .map(e => {
                const { n, pct } = probaAffichee(probaReelle(e));
                return `**1/${n}** (${pct}%) — ${e.desc}`;
            });
        return lignes.length ? `**${titre} :**\n${lignes.join('\n')}` : null;
    };

    return new EmbedBuilder()
        .setColor(0xffd20a)
        .setTitle('🎰 Probabilités')
        .setDescription([
            section('🎉 BONUS', 'bonus'),
            section('💀 MALUS', 'malus'),
            section('🗳️ SPÉCIAL', 'special'),
            '**😶 RIEN :**\n**1/2** (~50%) — Rien du tout',
            `**🍀 PITY :**\nAprès ${ROULETTE_PITY_MALUS} malus ou ${ROULETTE_PITY_NULS} résultats nuls, ton prochain tirage est un bonus garanti.`
        ].filter(Boolean).join('\n\n'));
}

const mutedChannels = new Map();
    function isChannelMuted(channelId) {
        const entry = mutedChannels.get(channelId);
        if (!entry) return false;
        if (Date.now() >= entry.until) { mutedChannels.delete(channelId); return false; }
        return true;
    }

// =========================
//           CHEH
// =========================

function checkCooldown(userId, cmd, seconds = 3) {
    const key = `${userId}_${cmd}`;
    const now = Date.now();
    if (cooldowns.has(key) && now - cooldowns.get(key) < seconds * 1000) return false;
    cooldowns.set(key, now);
    return true;
}
const CHEH_GIF = 'https://cdn.discordapp.com/attachments/1128032964924670053/1505363865137840180/cheh.gif';

// =========================
//     LOGIQUE !ANIMAL
// =========================

function getAnimalResponse(message, cibleUser) {
    const cible = cibleUser ?? message.mentions.users.first();

    const cibleNom = cible
        ? (message.guild?.members.cache.get(cible.id)?.displayName ?? cible.username)
        : null;

    const base = cible
        ? (cible.id === client.user.id
            ? "Mon animal spirituel est..."
            : `Hmmm, l'animal spirituel de **${cibleNom}** est...`)
        : "Hmmm, ton animal spirituel est...";

    const animauxMasc = [
        "Un rat de RER", "Un pigeon", "Un chat errant", "Un renard", "Un dauphin", "Un corbeau", "Un hamster", "Un chien", "Un crapaud", "Un panda",
        "Un h\u00e9risson", "Un taureau", "Un papillon", "Un putain de moustique", "Un axolotl", "Un raton laveur", "Un perroquet", "Un singe",
        "Un poisson", "Un li\u00e8vre", "Un scarab\u00e9e", "Un suricate", "Un \u00e9l\u00e9phant", "Un rhinoc\u00e9ros", "Un toucan", "Un capybara", "Un cheval",
        "Un bousier", "Un pingouin", "Un Pikachu", "Un mulot", "Un cochon", "Un lion", "Un moucheron", "Un chevreuil", "Un castor", "Un chacal",
        "Un aigle", "Un dromadaire", "Un gorille", "Un gu\u00e9pard", "Un hibou", "Un hippopotame", "Un jaguar", "Un kangourou", "Un koala",
        "Un l\u00e9opard", "Un lynx", "Un phoque", "Un serpent", "Un z\u00e8bre", "Un \u00e2ne", "Un canard", "Un cerf", "Un chameau", "Un coq", "Un dindon",
        "Un lapin", "Un loup", "Un mouton", "Un ours", "Un sanglier", "Un tigre", "Un accarien", "Un crocodile", "Un alligator", "Un cochon dinde",
        "Un furet", "Un alpaga", "Un mille-pattes", "Un ver de terre", "Un bandicoot", "Un blaireau", "Un bonobo", "Un morse"
    ];

    const animauxFem = [
        "Une girafe", "Une loutre", "Une mouette", "Une hy\u00e8ne", "Une mouche", "Une fourmi", "Une horrible araign\u00e9e", "Une mouche \u00e0 merde", "Une chouette",
        "Une baleine", "Une hirondelle", "Une lionne", "Une louve", "Une jument", "Une ch\u00e8vre", "Une chauve-souris", "Une gazelle", "Une vache",
        "Une grenouille", "Une biche", "Une gu\u00eape", "Une brebis", "Une marmotte", "Une souris", "Une dinde", "Une oie", "Une poule", "Une taupe",
        "Une musaraigne", "Une abeille", "Une chienne", "Une chatte", "Une truie", "Une larve", "Une tortue", "Une pieuvre", "Une crevette",
        "Une autruche", "Une coccinelle", "Une belette", "Une sardine", "Une otarie", "Une panth\u00e8re", "Une hu\u00eetre", "Une moule", "Une antilope"
    ];

    const etatsMasc = [
        "recherch\u00e9 pour le meurtre de 6 enfants.", "v\u00e9t\u00e9ran de la Seconde Guerre Mondiale.", "d\u00e9pressif.", "gay.", "compl\u00e8tement con.", "bourr\u00e9.",
        "perdu dans sa vie.", "plombier, mais aussi docteur, ing\u00e9nieur, professeur, livreur de pizza, m\u00e9chanicien, soldat, policier et astronaute.",
    ];

    const etatsFem = [
        "recherch\u00e9e pour le meurtre de 6 enfants.", "d\u00e9pressive.", "lesbienne.", "compl\u00e8tement conne.", "bourr\u00e9e.", "perdue dans sa vie."
    ];

    const etatsNeutres = [
        "en burn-out.", "sous coke.", "qui a la diarr\u00e9e.", "alcoolique.", "casse-couilles.", "qui collectionne les bouchons de li\u00e8ge.", "qui fuit l'URSSAF.",
        "asthmatique.", "qui pue du cul.", "de merde.", "transgenre \ud83c\udff3\ufe0f\u200d\u26a7\ufe0f", "sataniste.", "fan de Feldup.", "rockstar.", "addict \u00e0 TikTok.",
        "avec un fort accent belge.", "qui vote RN.", "fan de Norman.", "avec 2 de QI.", "SDF.", "sous k\u00e9tamine.", "qui s'est chi\u00e9 dessus.",
        "addict \u00e0 l'Oasis Tropical.", "DJ en Teknival.", "de la mafia italienne.", "adepte du fameux \u00abje ne suis pas raciste, j'ai un ami noir\u00bb.",
        "coprophage.", "\u00e0 la recherche du gros JDG.", "qui se l\u00e8ve \u00e0 4h du mat pour aller au taf.", "sous traitement hormonal.",
        "en manifestation LGBT.", "qui pleure sur un exercice de maths devant son p\u00e8re qui lui gueule dessus.", "genderfluid.",
        "en 4K Ultra HD IMAX Surround Dolby Digital.", "devant une s\u00e9rie Netflix de merde.", "qui utilise la commande !destin.", "trisomique.",
        "qui \u00e9tale son caca sur les murs.", "nostalgique des ann\u00e9es 2000.", "transphobe.", "raciste.", "qui a rat\u00e9 6 fois son bac.", "qui adore McFly & Calito."
    ];

    const isFem = Math.random() < 0.5;
    const animalList = isFem ? animauxFem : animauxMasc;
    const etatList = isFem ? [...etatsFem, ...etatsNeutres] : [...etatsMasc, ...etatsNeutres];

    const animal = animalList[Math.floor(Math.random() * animalList.length)];
    const etat = etatList[Math.floor(Math.random() * etatList.length)];

    return `${base}\n**${animal} ${etat}**`;
}

// =========================
//     LOGIQUE !KISS
// =========================

const kissGifs = [
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505016959584964811/adventure-time-princess-bubble-gum.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505016959153082529/two-men-kissing.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505016958847025324/littlebigwhale-gomart.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505016958154969261/arcane-arcane-season-2.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505016957789802586/catradora-catra.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505022253199265822/cat.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505022253623152671/mwah-mwah-girls-kissing.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505022904386064548/ezgif-336d393cc8b2e34b.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505022903991664640/animash-boys-love.gif"
];

function buildKissEmbed(auteurNom, cibleNom) {
    const gif = kissGifs[Math.floor(Math.random() * kissGifs.length)];
    return new EmbedBuilder()
        .setColor(0xff69b4)
        .setDescription(`\ud83d\udc8b **${auteurNom}** embrasse **${cibleNom}** !`)
        .setImage(gif);
}

// =========================
//     LOGIQUE !HUG
// =========================

const hugGifs = [
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505031085006782555/the-boys-the-boys-homelander.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505031086063878264/hug-annie-january.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505031087016120450/horty-baghera-jones.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505031089394024448/marceline-bubbline.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505031093131280414/catradora-hug.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505031094758543410/gumball-darwin.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505031096491049091/queenie-kinger.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505031104724209724/hug-anime.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505032164201332786/jinx-ekko.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505032164582887535/vi-hug-caitlyn-hug.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505032164901912696/yes.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505032165228937306/freddy-fazbear-hug-freddy.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505032165568548967/bonnie-fnaf-hug-bonnie.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505032165895962684/jinx-arcane-arcane-season-2.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505032464832135278/etoiles-alex.gif"
];

function buildHugEmbed(auteurNom, cibleNom) {
    const gif = hugGifs[Math.floor(Math.random() * hugGifs.length)];
    return new EmbedBuilder()
        .setColor(0x69d2ff)
        .setDescription(`\ud83e\udef2 **${auteurNom}** fait un c\u00e2lin \u00e0 **${cibleNom}** !`)
        .setImage(gif);
}

// =========================
//     LOGIQUE !DANCE
// =========================

const runGifs = [
    "https://cdn.discordapp.com/attachments/1128032964924670053/1506301175832514701/zooble.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1506301176164122905/pomni.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1506301187396341973/miles.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1506301187765436499/rocket.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1506301188260233317/viktor.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1506301188864217339/cest_normal_au_japon.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1506301189262934068/baby.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1506301189677908120/why_are_you_running.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1506301190101663986/dog.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1506301190491869214/flee.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1506301190990729389/joker.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1506301191397834882/foxy.gif"
];

function buildRunEmbed(description) {
    const gif = runGifs[Math.floor(Math.random() * runGifs.length)];
    return new EmbedBuilder()
        .setColor(0x66668a)
        .setDescription(description)
        .setImage(gif);
}

// =========================
//     LOGIQUE !DANCE
// =========================

const danceGifsSolo = [
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505042079074619402/dancing-groovy.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505042079376478209/shreck.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505042079795904583/silvagunner-siivagunner.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505042080232247377/fnaf-fredbear-dancing-to-happy.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505054866823970867/srpelo.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505042080932696295/mario-dancer-break-dance.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505042081318441161/dance-nsjdnsnd.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505042081826078802/caine.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505042082383925318/tadc-kinger.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505042089015119974/baldi-default.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505042089363243179/-.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505042089682014328/dancing-family.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505042090000777306/osaka-dance.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505042090294509658/bailes.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505042090625597501/black-kid-dancing.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505042090952884336/rat-rat-dance.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505042091233775695/spongebob-dance-spongebob-joget.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505042091795939378/arcane-league-of-legends.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505042092219695174/steve-minecraft.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505044391314591847/gandalf-dance.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505045016324739084/jdg-dance.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505045505678512268/cat.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505046876494237746/je-suis-jeune-misterjday.gif",
    "https://tenor.com/view/granny-dance-gif-11638418557026172594",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505047149082316932/misterjday-jday.gif"
];

const danceGifsDuo = [
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505046260233797720/caine-musical.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505046261038977104/zevent-zevent2021.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505046261441761392/dance.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505046262112845855/caramelldansen-dance.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505046262523891752/jinx-ekko.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505046262985134230/jdg-joueur-du-grenier.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505046263647965244/zevent2021-zevent.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505046264352477354/dance-minecraft.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505046264901799977/gif-meme.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505046265376014496/pomni-and-jax-daisy-bell.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505046271549771857/jam-baghera.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505046272032247980/furina-neuvillette.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505046272589955225/genshin-genshin-impact.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505046273080823920/danganronpa-monokuma.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505046273525284964/dachuu-chuuya.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505046274112753694/gumball-and-darwin.gif"
];

function buildDanceEmbed(description, solo) {
    const gifs = solo ? danceGifsSolo : danceGifsDuo;
    const gif = gifs[Math.floor(Math.random() * gifs.length)];
    return new EmbedBuilder()
        .setColor(0xba2222)
        .setDescription(description)
        .setImage(gif);
}

// =========================
//     LOGIQUE !INSULT
// =========================

const insultGifs = [
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505057050491879594/springtrap-middle.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505057050965708810/zooble-amazing-digital-circus.gif",
    "https://tenor.com/view/vilebrequin-vilebrequin-sylvain-levy-vilebrequin-sylvain-vilebrequin-levy-sylvain-levy-gif-21866498",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505057051502706838/fuck-off-fuck-you.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505057052093841618/birdie.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505057052597424178/dog-middle-finger.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505057053834608750/bubble-the-amazing-digital-circus.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505057054987911230/pomni-swears.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505057055621382164/nique-ta-mere-power-up.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505057058628833280/jdg-doigt-dhonneur.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505057059031220305/fnaf-springbonnie.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505057069517242509/jday-misterjday.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505057069907181649/vilebrequin-sylvain.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505057485818695802/jinx-jinx-arcane.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505057486338658447/vi-vi-arcane.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505058170471583815/jdg-ta-gueule.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505058170857455666/jdg-joueur-du-grenier.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505058171272695938/ferme-ta-gueule.gif"
];

function buildInsultEmbed(description) {
    const gif = insultGifs[Math.floor(Math.random() * insultGifs.length)];
    return new EmbedBuilder()
        .setColor(0x21fca8)
        .setDescription(description)
        .setImage(gif);
}

// =========================
//     LOGIQUE !LAUGH
// =========================

const laughGifs = [
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505063705681854595/jdg-joueur-du-grenier.gif",
    "https://tenor.com/view/sylvain-sylvain-rire-rire-vilebrequin-sylvain-lyve-gif-8633655158314530858",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505063706151882812/mr-jday-mdr.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505063706428571760/misterjday-mdr.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505065995864244334/laughing-emoji-laughing.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505065996531142737/stan-twitter-reaction-meme.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505065996963287171/el-risitas-juan-joya-borja.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505065997319540817/mario-smg4.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505065997898616873/homelander-homelander-laugh.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505065998288420864/homelander-laugh.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505065998598934650/charlie-morningstar-laughing.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505065998930415797/jax-laughing.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505065999475544144/caine-caine-tadc.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505065999865483424/jdg-joueur-du-grenier.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505066005339181096/laughing-hysterically-funny.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505066004928266382/lmfao.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505066005913796711/speed-trying-not-to-laugh.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505066006857519174/laughing-spider-man.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505066064000581802/laugh-lol.gif"
];

function buildLaughEmbed(description) {
    const gif = laughGifs[Math.floor(Math.random() * laughGifs.length)];
    return new EmbedBuilder()
        .setColor(0xffd900)
        .setDescription(description)
        .setImage(gif);
}

// =========================
//     LOGIQUE !RIZZ
// =========================

const rizzGifs = [
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505076332000968725/rizz-rizz-face_1.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505076350158110751/chica-fnaf-movie.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505076350787125288/rizz-rizz-face.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505076352234295456/shrek-shrek-meme.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505076353026752584/ai-baby.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505076357317529650/hehe.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505076357766582292/rizz-monkey.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505076358152327278/bee.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505076359242842213/rizz-fnaf-rizz.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505076363105669250/five-nights-at-freddys-freddy.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505076364376539317/dob-dob-dob-rizz.gif"
];

function buildRizzEmbed(description) {
    const gif = rizzGifs[Math.floor(Math.random() * rizzGifs.length)];
    return new EmbedBuilder()
        .setColor(0xff00bb)
        .setDescription(description)
        .setImage(gif);
}

// =========================
//     LOGIQUE !BANG
// =========================

const bangGifs = [
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505182766667399298/hazbin-hotel-angel-dust.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505182767019855923/nichijou-misato.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505182767359721573/tadc-guns-jax.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505182767653060648/the-amazing-digital-circus-tadc_1.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505182767971962940/jdg-joueur-du-grenier.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505182775316054228/chishiya-chishiya-shuntaro.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505182775760785580/the-amazing-digital-circus-tadc.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505182776117432481/gangle-tommy-gun-gangle-shooting-jax-and-pomni.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505182776679338044/the-amazing-digital-circus-tadc_2.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505182777103093840/the-amazing-digital-circus-tadc3.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505182777434443837/supaidaman-spiderman.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505182777845219428/murder-drones-attack.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505182778214453390/sigewinne-gun.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505182778642137168/firing-a-gun-caitlyn-kiramman.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505182778990526625/shoot-gun.gif"
];

function buildBangEmbed(description) {
    const gif = bangGifs[Math.floor(Math.random() * bangGifs.length)];
    return new EmbedBuilder()
        .setColor(0xc2461d)
        .setDescription(description)
        .setImage(gif);
}

// =========================
//     LOGIQUE !PUNCH
// =========================

const punchGifs = [
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505192207693381694/punch.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505192208037576794/the-boys-soldier-boy.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505192216065212476/markiplier.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505192216715460730/marvel-rivals.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505192219064139786/dehya-genshin-impact.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505192219701936298/ignited-bonnie-the-joy-of-creation.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505192220335144970/the-amazing-digital-circus-digital-circus.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505192221140324352/smg4-mario.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505192221517807727/le_cercle.gif"
];

function buildPunchEmbed(description) {
    const gif = punchGifs[Math.floor(Math.random() * punchGifs.length)];
    return new EmbedBuilder()
        .setColor(0x8b0000)
        .setDescription(description)
        .setImage(gif);
}

// =========================
//     LOGIQUE !DIE
// =========================

const dieGifs = [
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505200444522102854/gmod-ragdoll.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505200445004578976/jet-bean-killer-bean.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505200445411295432/memes-meme.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505200445839245393/furina-sad.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505200446334304366/sylvain-lyve-vilbrequin.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505200453086871612/star-wars-r2d2.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505200453569351770/death-undertale.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505200454026657882/tyler1-dead.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505200454752276580/tyler1-loltyler1.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505200455192674334/mrbruh.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505200455637008384/mario-super-mario.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505200455964168273/dies-cat.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505200456597635232/connor-falling-misson-acomplished-mission-accomplished.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505200457101086731/teletubbies-dying.gif"
];

function buildDieEmbed(description) {
    const gif = dieGifs[Math.floor(Math.random() * dieGifs.length)];
    return new EmbedBuilder()
        .setColor(0x700000)
        .setDescription(description)
        .setImage(gif);
}

// =========================
//     RECHERCHE PAR PSEUDO
// =========================

function findMemberByName(guild, query) {
    if (!guild) return { found: null, multiple: false, candidates: [] };
    const q = query.toLowerCase();

    // Recherche exacte d'abord
    const exact = guild.members.cache.filter(m =>
        (m.displayName && m.displayName.toLowerCase() === q) ||
        (m.user.username && m.user.username.toLowerCase() === q)
    );
    if (exact.size === 1) return { found: exact.first(), multiple: false, candidates: [] };
    if (exact.size > 1) {
        const candidates = exact.map(m => m.displayName ?? m.user.username);
        return { found: null, multiple: true, candidates };
    }

    // Recherche partielle
    const partial = guild.members.cache.filter(m =>
        (m.displayName && m.displayName.toLowerCase().includes(q)) ||
        (m.user.username && m.user.username.toLowerCase().includes(q))
    );
    if (partial.size === 0) return { found: null, multiple: false, candidates: [] };
    if (partial.size === 1) return { found: partial.first(), multiple: false, candidates: [] };
    const candidates = partial.map(m => m.displayName ?? m.user.username);
    return { found: null, multiple: true, candidates };
}

async function askDisambiguation(message, guild, candidates, callback) {
    const list = candidates.map(c => `* **${c}**`).join('\n');
    const prompt = await message.reply(`Il y a **${candidates.length}** personnes avec un pseudo similaire. Tu voulais parler de qui ? Essaie d'\u00eatre plus pr\u00e9cis.e !\n${list}`);

    const filter = m => m.author.id === message.author.id;
    const collector = message.channel.createMessageCollector({ filter, time: 20000 });

    collector.on('collect', m => {
        const q = m.content.trim().toLowerCase();
        const match = candidates.find(c => c.toLowerCase() === q);
        if (match) {
            collector.stop('found');
            m.delete().catch(() => {});
            prompt.delete().catch(() => {});
            const member = guild.members.cache.find(mb =>
                (mb.displayName && mb.displayName === match) ||
                (mb.user.username && mb.user.username === match)
            );
            if (member) callback(member.user);
        } else {
            const retry = candidates.map(c => `* **${c}**`).join('\n');
            message.reply(`Ce pseudo ne correspond pas exactement \u00e0 l'un des choix. Essaie encore !\n${retry}`)
                .then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));
            m.delete().catch(() => {});
        }
    });

    collector.on('end', (_, reason) => {
        if (reason !== 'found') {
            prompt.delete().catch(() => {});
            message.reply("Bon... On abandonne alors !").then(msg =>
                setTimeout(() => { msg.delete().catch(() => {}); message.delete().catch(() => {}); }, 3000)
            );
        }
    });
}


// =========================
//     LOGIQUE !FLIP
// =========================

const flipGifs = [
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505384734392324236/giphy.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505388045573165178/coin_flip.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505388046064025671/yumeko.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505388046382665728/two-face.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505388046692909237/pip_boy.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505388047036977172/flip.gif"
];

const PILE_IMG = "https://cdn.discordapp.com/attachments/1128032964924670053/1505389180132393163/pile.png";
const FACE_IMG = "https://cdn.discordapp.com/attachments/1128032964924670053/1505389180640034837/face.png";

async function doFlipSequence(channel, firstMessage, isPari, pileNom, faceNom, authorId) {
    const gif = flipGifs[Math.floor(Math.random() * flipGifs.length)];
    const isFace = Math.random() < 0.5;
    const resultatTexte = isFace ? "C'est **face** !" : "C'est **pile** !";
    const resultatImg = isFace ? FACE_IMG : PILE_IMG;

    if (firstMessage) {
        const lancerEmbed = new EmbedBuilder()
            .setColor(0xffd700)
            .setDescription(firstMessage)
            .setImage(gif);
        await channel.send({ embeds: [lancerEmbed] });
        await new Promise(r => setTimeout(r, 3000));
    } else {
        await new Promise(r => setTimeout(r, 1000));
    }

    await new Promise(r => setTimeout(r, 1000));
    const flipType = isPari ? "pari" : "simple";
    const relancerButton = new ButtonBuilder()
        .setCustomId(`flip_start_open_${flipType}`)
        .setLabel("\ud83e\ude99 Relancer la pi\u00e8ce")
        .setStyle(ButtonStyle.Secondary);
    const relancerRow = new ActionRowBuilder().addComponents(relancerButton);

    let description;
    if (isPari) {
        const gagnantNom = isFace ? faceNom : pileNom;
        description = `${resultatTexte}\n**${gagnantNom}**, la chance est dans ton camp !\nOn recommence ?`;
    } else if (pileNom) {
        // Lancer simple avec camp choisi
        const campChoisi = pileNom; // on reutilise pileNom pour stocker le camp
        const aGagne = (isFace && campChoisi === 'face') || (!isFace && campChoisi === 'pile');
        description = `${resultatTexte}\n${aGagne ? "Gagn\u00e9 !" : "Perdu..."}\nOn recommence ?`;
    } else {
        description = `${resultatTexte}\nOn recommence ?`;
    }

    const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setDescription(description)
        .setThumbnail(resultatImg);

    await channel.send({ embeds: [embed], components: [relancerRow] });
    flipEnCours = false;
}

async function sendFlipChoix(channel, message, authorId, customMsg) {
    const aid = authorId ?? 'unknown';
    const simpleBtn = new ButtonBuilder()
        .setCustomId(`flip_simple_${aid}`)
        .setLabel("\ud83e\ude99 Lancer simple")
        .setStyle(ButtonStyle.Secondary);
    const pariBtn = new ButtonBuilder()
        .setCustomId(`flip_pari_${aid}`)
        .setLabel("\u2694\ufe0f Pari")
        .setStyle(ButtonStyle.Secondary);
    const cancelBtn2 = new ButtonBuilder()
        .setCustomId(`flip_cancel_${aid}`)
        .setLabel("\u274c Annuler")
        .setStyle(ButtonStyle.Secondary);
    const row = new ActionRowBuilder().addComponents(simpleBtn, pariBtn, cancelBtn2);

    let texte;
    if (customMsg) {
        texte = customMsg;
    } else if (message) {
        const nom = message.member?.displayName ?? message.author.username;
        texte = `**${nom}**, c'est pour un lancer simple, ou alors pour parier avec quelqu'un ?`;
    } else {
        texte = "C'est pour un lancer simple, ou alors pour parier avec quelqu'un ?";
    }

    const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle("\ud83e\ude99 Pile ou face")
        .setDescription(texte);

    if (message) {
        return message.reply({ embeds: [embed], components: [row] });
    } else {
        return channel.send({ embeds: [embed], components: [row] });
    }
}

const flipParis = new Map();
let flipEnCours = false;

function decodeHtmlEntities(text) {
    if (!text) return text;
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(code));
}

async function scheduleRappel(channelId, targetId, texte, ms) {
    const rappelId = generateRappelId();
    const triggerAt = Date.now() + ms;

    const timeout = setTimeout(async () => {
        pendingRappels.delete(rappelId);
        try {
            const channel = await client.channels.fetch(channelId);
            const reportButton = new ButtonBuilder()
                .setCustomId(`rappel_report_${targetId}`)
                .setLabel('🔁 Reporter')
                .setStyle(ButtonStyle.Secondary);
            const reportRow = new ActionRowBuilder().addComponents(reportButton);
            const sentReminder = await channel.send({ content: `🔔 <@${targetId}> Rappel : **${texte}**`, components: [reportRow] });
            rappelReports.set(sentReminder.id, { targetId, texte, channelId });
        } catch (e) {
            console.error('Erreur scheduleRappel:', e);
        }
    }, ms);

    pendingRappels.set(rappelId, { targetId, texte, channelId, triggerAt, timeout });
    return rappelId;
}

function getMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getTodayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getWeekKey() {
    const d = new Date();
    const startOfYear = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil(((d - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${String(week).padStart(2,'0')}`;
}

function cleanOldData() {
    const now = new Date();
    // Garder seulement les 7 derniers jours
    Object.keys(dailyData).forEach(key => {
        const d = new Date(key);
        if ((now - d) / 86400000 > 7) delete dailyData[key];
    });
    // Garder seulement les 4 dernières semaines
    const currentWeek = getWeekKey();
    const [cy, cw] = currentWeek.split('-W').map(Number);
    Object.keys(weeklyData).forEach(key => {
        const [wy, ww] = key.split('-W').map(Number);
        const diff = (cy - wy) * 52 + (cw - ww);
        if (diff > 4) delete weeklyData[key];
    });
}

// =========================
//     LOGIQUE !BLAGUE
// =========================

async function sendBlague(interaction, cat, authorId) {
        const blaguesSoft = [
            `Qu'est-ce que se disent deux chiens qui se rencontrent à Tokyo ? Ils se jappent au nez.`,
            `Pourquoi un chat aime bien se faire photographier ? Parce qu'on lui dit "souris" !`,
            `Quel est le gâteau le plus rapide ? L'éclair !`,
            `Comment appelle-t-on un chien qui n'a pas de pattes ? On ne l'appelle pas car il ne peut pas venir !`,
            `Qu'est-ce qu'il ne faut jamais faire devant un poisson scie ? La planche.`,
            `Pourquoi les cahiers de mathématiques sont-ils tristes ? Parce qu'ils ont trop de problèmes.`,
            `Quelles sont les villes de France qui, une fois réunies, donnent 21 ? Troyes, Foix, Sète. (7x3 = 21)`,
            `Qu'est-ce qui a deux bosses et qu'on trouve au pôle Nord ? Un chameau qui est vraiment perdu.`,
            `Qu'est-ce qui tombe sans tomber ? La nuit.`,
            `Qu'est-ce qui est vert et qui saute d'arbre en arbre ? Un écureuil en survêtement.`,
            `Comment peut-on réduire le niveau de pollution dans les écoles ? En utilisant des crayons sans plomb.`,
            `Pourquoi un athlète court-il autour de son lit ? Pour rattraper le temps perdu !`,
            `Quel est l'animal le plus léger au monde ? La palourde (pas lourde).`,
            `Quelle est la différence entre une étoile et ma belle-mère ? L'étoile est un astre et ma belle-mère est un désastre.`,
            `Quelle est la différence entre un thermomètre et un maître d'école ? Aucune. On tremble quand ils affichent zéro.`,
            `Qu'est-ce que ça donne un pou qui tombe sur une cloche ? Un pou-ding.`,
            `Quel est l'animal le plus âgé ? Le mouton, parce qu'il est lainé.`,
            `Quelle est la différence entre un homme intelligent et un extra-terrestre ? Il n'y en a pas. On en a tous entendu parler, mais on n'en a jamais vu !`,
            `Quelle est la différence entre un avion et un chewing-gum ? Le chewing-gum ça colle et un avion ça décolle.`,
            `À quelle question ne peut-on jamais répondre ? Dors-tu ?`,
            `Il y a un coq qui pond un œuf sur le toit. De quel côté l'œuf va-t-il tomber ? Nulle part, un coq ne pond pas !`,
            `Qu'est-ce qui est petit, rond, vert et qui monte et qui descend ? Un petit pois dans un ascenseur !`,
            `Deux tomates traversent la rue, l'une se fait écraser, l'autre lui dit : Tu viens Ketchup !`,
            `Deux escargots rencontrent une limace. L'un d'eux dit : Tiens ! Une nudiste !`,
            `Combien font trois et trois ? demande l'instituteur. — Match nul, Monsieur !`,
            `Deux pommes de terre traversent la rue. Une se fait écraser et l'autre dit : Oh Purée.`,
            `La maîtresse demande à Toto : Quel est le futur de « Je bâille » ? — Je dors, Madame.`,
            `La maîtresse demande à Toto : Cite-moi un mammifère qui n'a pas de dents. — Ma grand-mère ?`,
            `Un enfant voit pour la première fois des vaches : Elles sont belles vos vaches. Mais elles doivent vous coûter drôlement cher en chewing-gum !`,
            `Un avion dit à une hélice : « Arrête de tourner comme ça ! Tu me donnes le vertige ! »`,
            `Deux grains de sable se promènent dans le désert. Au bout d'un moment, l'un dit à l'autre : Tu crois qu'on est suivi ?`,
        ];

        const blaquesClassique = [
            `C'est l'histoire du ptit dej, tu la connais ? Pas de bol.`,
            `C'est l'histoire d'une blague vaseuse. Mets tes bottes.`,
            `C'est l'histoire d'un pingouin qui respire par les fesses. Un jour il s'assoit et il meurt.`,
            `Comment appelle-t-on une chauve-souris avec une perruque ? Une souris.`,
            `Que dit un escargot quand il croise une limace ? « Oh la belle décapotable ».`,
            `Pourquoi les canards sont toujours à l'heure ? Parce qu'ils sont dans l'étang.`,
            `Que fait un crocodile quand il rencontre une superbe femelle ? Il Lacoste.`,
            `C'est quoi un petit pois avec une épée face à une carotte avec une épée ? Un bon duel.`,
            `Avec quoi ramasse-t-on la papaye ? Avec une foufourche.`,
            `Pourquoi les pêcheurs ne sont pas gros ? Parce qu'ils surveillent leur ligne.`,
            `Tu connais la blague de la chaise ? Elle est tellement longue.`,
            `C'est l'histoire d'un papier qui tombe à l'eau. Il crie : « Au secours ! J'ai pas pied ! »`,
            `Pourquoi n'y a-t-il plus de mammouths sur terre ? Parce qu'il n'y a plus de pappouths.`,
            `Que fait une fraise sur un cheval ? Tagada Tagada.`,
            `C'est l'histoire de Paf le chien qui traverse la route. Et paf le chien !`,
            `Qu'est ce qui n'est pas un steak ? Une pastèque.`,
            `Qu'est-ce qui est vert avec une cape ? Un concombre qui imite Super Tomate.`,
            `Comment appelle-t-on un chien qui n'a pas de pattes ? On ne l'appelle pas, on va le chercher.`,
            `Deux œufs discutent : — Pourquoi t'es tout vert et aussi poilu ? — Parce que j'suis un kiwi, ducon.`,
            `Comment appelle-t-on un bébé éléphant prématuré ? Un éléphant tôt.`,
            `Qu'est-ce qu'un canif ? Un petit fien.`,
            `Quel est le pays le plus cool du monde ? Le Yémen. Yeah, man.`,
            `Un mec rentre dans un café. Et plouf.`,
            `C'est l'histoire d'un aveugle qui rentre dans un bar. Et dans une table, et dans une chaise, et dans un mur...`,
            `Qu'est-ce qui est vert, qui tourne très très vite et qui devient rouge ? Une grenouille dans un mixeur.`,
            `C'est un mec qui entre dans un bar et qui dit « Salut c'est moi ! » Mais en fait c'était pas lui.`,
            `Quelle est la différence entre l'intelligence et les parachutes ? Aucune, quand on n'en a pas, on s'écrase.`,
            `Un homme demande à son médecin : « Docteur, il me reste combien de temps à vivre ? — 10. — 10 ans ? — 9, 8, 7... »`,
            `Un gendarme arrête un conducteur en excès de vitesse : « Papiers ? — Ciseaux ? »`,
            `Comment appelle-t-on une baguette qui ne trouve pas son chemin ? Un pain perdu.`,
            `Tu connais la blague du diable ? Elle est d'enfer.`,
            `Deux canards discutent : « Coin coin. — C'est dingue, j'allais dire la même chose ! »`,
            `Deux puces sortent du cinéma. L'une dit à l'autre : « On rentre à pieds ou on prend un chien ? »`,
            `Un jour, j'ai fait une blague sur Auchan. Mais elle a pas supermarché.`,
            `Deux lions discutent : « T'as une belle crinière. — Arrête, tu vas me faire rugir. »`,
            `Un chameau dit à un dromadaire : « Comment ça va ? — Bien, je bosse, et toi ? — Je bosse, je bosse. »`,
            `Deux souris voient passer une chauve-souris : « Regarde, un ange ! »`,
            `C'est deux fous qui marchent dans la rue. Le premier demande au second : « Je peux me mettre au milieu ? »`,
            `Quel est le comble pour un serrurier ? Mettre la clé sous la porte.`,
            `Comment appelle-t-on le pilote d'un corbillard ? Un pilote décès.`,
            `Que se disent deux yaourts dans un ascenseur ? « On va à quel laitage ? »`,
            `Quelle sensation ont les médicaments dans une boîte de pilule ? Ils se sentent comprimés.`,
            `Comment reconnaît-on un politicien qui ment ? Ses lèvres bougent.`,
            `Comment appelle-t-on un nain qui est facteur ? Un nain posteur.`,
            `Un patient s'adresse à son médecin : « J'ai très mal à l'œil gauche quand je bois mon café. — Vous avez essayé d'enlever la cuillère de la tasse ? »`,
            `Quelle est la meilleure chose de la Suisse ? Aucune idée, mais le drapeau est un gros plus.`,
            `De quoi a besoin un astronaute claustrophobe ? D'un peu d'espace.`,
            `Un homme entre dans un restaurant : « Garçon, que me recommandez-vous ? — Un autre restaurant ! »`,
            `Pourquoi les girafes n'existent pas ? Parce que c'est un coup monté.`,
            `Quel est le sport préféré des électriciens ? Le karaté, car ils connaissent toutes les prises.`,
        ];

        const blaquesNoir = [
            `Comment est-ce qu'on appelle un boomerang qui ne revient pas ? Un chat mort.`,
            `Que dit un aveugle lorsqu'on lui donne du papier de verre ? « C'est écrit tout petit. »`,
            `Pourquoi la petite fille tombe-t-elle de la balançoire ? Parce qu'elle n'a pas de bras.`,
            `Qu'est-ce qui est pire qu'un bébé dans une poubelle ? Un bébé dans deux poubelles.`,
            `Quelle partie du légume ne passe pas dans le mixer ? La chaise roulante.`,
            `Comment reconnaît-on une lettre envoyée par un lépreux ? La langue est collée au timbre.`,
            `Qu'est-ce qui a deux pattes et qui saigne ? Un demi-chien.`,
            `Peut-on prendre un bain quand on a la diarrhée ? Oui si vous en avez assez.`,
            `J'ai demandé à mon grand-père où il voulait être enterré. Il m'a dit « Surprends-moi ». Du coup je l'ai mis dans le congélateur.`,
            `Ma grand-mère est morte paisiblement dans son sommeil. Contrairement à ses passagers qui ont hurlé pendant tout l'accident de bus.`,
            `Pourquoi les orphelins ne jouent jamais à cache-cache ? Parce que personne ne vient les chercher.`,
            `C'est quoi la différence entre une pizza et un orphelin ? La pizza, on la partage avec toute la famille.`,
            `J'ai tué mon père avec une pelle. Ma mère a dit que c'était un accident… alors j'ai recommencé avec une vraie pelle.`,
            `Comment on console quelqu'un qui vient de perdre sa femme ? « Au moins t'as plus de disputes pour la télécommande. »`,
            `C'est quoi le comble pour un cancéreux ? Mourir d'une crise cardiaque avant que le cancer termine son travail.`,
            `Ma sœur est morte d'une overdose. Au moins elle est morte en faisant ce qu'elle aimait : décevoir mes parents.`,
            `Pourquoi les cimetières sont toujours pleins ? Parce que les gens meurent d'y aller.`,
            `J'ai fait un don d'organes. J'ai donné tous ceux de mon voisin, il en avait plus besoin.`,
            `C'est quoi la différence entre un arbre et un orphelin ? L'arbre, on sait où il est planté.`,
            `Ma grand-mère a Alzheimer. Le bon côté c'est que je peux lui raconter la même blague tous les jours, elle rit à chaque fois.`,
            `Pourquoi les aveugles ne font jamais de ski ? Parce qu'ils voient pas la fin de la piste… ni l'arbre.`,
            `Quelle est la pire combinaison de maladies ? Alzheimer et la diarrhée. Vous courez, mais vous ne savez plus où.`,
            `Comment les enfants de Tchernobyl comptent-ils jusqu'à 33 ? Sur leurs doigts.`,
            `C'est l'histoire d'un mec qui rentre dans un bar : « Je voudrais 2 bières. — Des pressions ? — Non, alcoolisme. »`,
            `Une petite fille discute avec sa mère : « Maman, est-ce que je pourrais avoir un chien à Noël ? — Non, tu auras de la dinde comme tout le monde. »`,
            `J'ai une blague sur Claude François… mais je crois que vous êtes au courant.`,
            `J'ai une blague sur Véronique Courjault… mais j'ai peur qu'elle jette un froid.`,
            `J'ai une blague sur le petit Grégory… mais elle va tomber à l'eau.`,
            `Qu'est-ce qui a 5 bras, 3 jambes et 2 pieds ? La ligne d'arrivée au marathon de Boston.`,
            `Maman, je ne veux plus dormir avec mon petit frère. — Tais-toi ! Je t'ai déjà dit qu'on n'avait pas assez d'argent pour l'enterrer.`,
            `Pourquoi un enfant chinois ne croit jamais au Père Noël ? Parce que c'est lui qui fabrique les jouets.`,
            `Comment sait-on quand un lépreux doit quitter une partie de poker ? Quand il perd la main.`,
            `C'est quoi le dernier repas d'un condamné à mort qui a Alzheimer ? « Encore la même chose, s'il vous plaît. »`,
            `Ma mère est morte en me mettant au monde. Depuis, chaque anniversaire c'est un peu awkward.`,
            `C'est quoi la différence entre une Ferrari et un tas d'enfants morts ? J'ai pas de Ferrari dans mon garage.`,
            `L'humour noir, c'est comme les enfants cancéreux… ça ne vieillit jamais.`,
            `Pourquoi les retraités adorent les bains de boue ? Pour s'habituer au goût de la terre.`,
            `Ma voisine est morte en dormant. Moi je suis encore vivant et je dors jamais. La vie est vraiment injuste.`,
            `Mon oncle est mort d'un cancer de la gorge. Il a fumé jusqu'au dernier jour. Un vrai guerrier.`,
            `Ma tante est morte en faisant du parapente. Au moins elle est partie en beauté… du 300 mètres.`,
            `J'ai enterré mon chien hier. C'était un bon chien. Dommage qu'il ait mordu le facteur.`,
            `Quel est le légume officiel de l'Allemagne ? Michael Schumacher.`,
            `J'ai perdu tous mes cheveux à cause de la chimio. Au moins maintenant je gagne du temps le matin.`,
            `Qu'est-ce qui est rouge et qui sent mauvais ? Un camion de pompiers qui brûle.`,
            `Qu'est-ce qui est pire que de trouver un ver dans ta pomme ? En trouver la moitié.`,
        ];

        const categories = {
            soft: { blagues: blaguesSoft, label: '\ud83d\ude0a Humour soft', color: 0x2ecc71 },
            classique: { blagues: blaquesClassique, label: '\ud83d\ude04 Humour classique', color: 0x3498db },
            noir: { blagues: blaquesNoir, label: '\ud83d\udda4 Humour noir', color: 0x2c2c2c }
        };

        const c = categories[cat];
        const blague = c.blagues[Math.floor(Math.random() * c.blagues.length)];

        const embed = new EmbedBuilder()
            .setColor(c.color)
            .setTitle(c.label)
            .setDescription(blague);

        const autreBtn = new ButtonBuilder()
            .setCustomId(`blague_autre_${authorId}_${cat}`)
            .setLabel('\ud83e\udd23 Une autre ?')
            .setStyle(ButtonStyle.Secondary);
        const menuBtn = new ButtonBuilder()
            .setCustomId(`blague_menu_back_${authorId}`)
            .setLabel('\ud83d\udd04 Autre type')
            .setStyle(ButtonStyle.Secondary);
        const row = new ActionRowBuilder().addComponents(autreBtn, menuBtn);

        return interaction.update({ embeds: [embed], components: [row] });
}

// =========================
//     LOGIQUE !HOROSCOPE
// =========================

function seedRandom(seed) {
    let x = Math.sin(seed + 1) * 10000;
    return x - Math.floor(x);
}

function getHoroscopeForSign(signIndex, dateKey) {
    const horoscopes = ["Tu vas perdre une chaussette aujourd'hui. L'autre sera retrouvée en 2031.", "Mercure est en rétrograde dans ta salle de bain. Évite les miroirs.", "Un pigeon te regarde. Il sait.", "Ton destin est écrit sur un ticket de caisse Lidl froissé.", "Tu vas dire \"ah ouais\" à quelque chose d'important sans vraiment écouter.", "Quelqu'un pense à toi en ce moment. C'est flippant.", "Les astres disent : mange tes légumes. Les astres ont tort.", "Tu vas rater un truc important parce que t'étais sur TikTok.", "Venus est en opposition avec ta flemme. La flemme gagne.", "T'as un truc entre les dents depuis ce matin. Personne t'a rien dit.", "Ton futur est flou mais ça sent la friture.", "Tu vas avoir une révélation existentielle aux toilettes à 14h37.", "Quelqu'un va te dire \"on en reparlera\" et on en reparlera jamais.", "Les étoiles forment aujourd'hui la forme d'un kebab. C'est un signe.", "Tu vas trébucher sur rien et faire semblant que c'était fait exprès.", "Une opportunité se présente. T'as pas envie. Tu la rates. Bien joué.", "Ton chat te juge. Ton chat a raison.", "Tu vas recevoir un message vocal de 4 minutes pour une info qui tient en 5 mots.", "Saturne te dit d'aller dormir. T'iras à 4h du mat quand même.", "Ton aura est d'une couleur que personne a encore inventée. C'est inquiétant.", "Tu vas oublier ce que tu voulais dire en plein milieu d'une phrase et—", "Un inconnu va te sourire dans la rue. C'était pas pour toi.", "Tu vas retrouver 2€ dans une vieille veste. C'est tout ce que t'auras aujourd'hui.", "Mars est en colère. Mars a des raisons.", "Tu vas faire un truc bien par accident et prétendre que c'était prévu.", "Quelque part dans l'univers, une version de toi a pris la bonne décision. Pas toi.", "Tu vas rire à une blague que t'as pas comprise. C'est normal.", "Les planètes s'alignent pour te dire que t'aurais dû rappeler ta mère.", "Tu vas te battre mentalement contre quelqu'un dans ta tête et perdre.", "Une araignée dans ta chambre te surveille depuis 3 semaines. Elle note tout.", "Ton destin croise aujourd'hui celui d'un homme qui sent le jambon.", "Tu vas dire \"je suis crevé\" 7 fois sans bouger du canapé.", "L'univers te réserve une surprise. C'est nul.", "Tu vas mettre de la musique pour travailler et écouter de la musique.", "Quelqu'un va te demander \"tu vas bien ?\" avec le ton de quelqu'un qui s'en fout.", "Ton énergie du jour : pile suffisante pour survivre, pas assez pour briller.", "Tu vas relire un vieux message embarrassant à 2h du matin. Bonne nuit.", "Jupiter dit que t'as du potentiel. Jupiter ment.", "Tu vas commander trop de nourriture et manger trop de nourriture quand même.", "Ton signe est en harmonie avec le chaos total aujourd'hui. Bienvenue.", "Tu vas expliquer quelque chose très clairement et la personne va pas comprendre.", "Un truc que t'as dit il y a 6 ans va te revenir en mémoire sous la douche.", "Tu vas ouvrir le frigo 4 fois sans rien prendre. La 5ème fois non plus.", "L'astrologue qui a écrit ça était au fond de son lit en pyjama pingouin.", "Tu vas avoir raison sur quelque chose et personne t'écoutera.", "Mercure est en rétrograde depuis que t'es né(e). Ça explique tout.", "Tu vas envoyer un message au mauvais groupe. Encore.", "Les étoiles forment aujourd'hui un grand point d'interrogation juste au-dessus de ta tête.", "Tu vas procrastiner quelque chose d'important en lisant un horoscope.", "Ton avenir ressemble à un buffet froid où il reste que du chou-fleur.", "Tu vas rater ton réveil mais te lever à la seconde où tu te rendors.", "Quelqu'un va te demander de l'aide pour un truc et tu vas souffrir.", "Les astres te conseillent d'éviter les hommes en Crocs aujourd'hui.", "Tu vas avoir une conversation imaginaire très convaincante sous la douche.", "Ton énergie de la semaine : \"bof mais ça ira.\"", "Tu vas regarder ton téléphone sans raison précise exactement 47 fois aujourd'hui.", "Vénus dit que l'amour est proche. Vénus a aussi dit ça la semaine dernière.", "Tu vas faire quelque chose de stupide et l'appeler \"une expérience de vie\".", "Un enfant va te regarder avec trop d'intensité dans les transports. Il voit des trucs.", "Tu vas te rappeler d'une dette que tu dois mais choisir de l'oublier à nouveau.", "Ton horoscope du jour est classifié secret défense. Voilà ce qu'on peut dire : fais gaffe.", "Une lumière clignotera dans ton appart ce soir. C'est Morse pour \"aide-moi\".", "Tu vas commencer une phrase par \"non mais écoute\" et avoir tort.", "Les constellations forment aujourd'hui la silhouette de ton ex. Coïncidence ?", "Tu vas perdre un objet, paniquer, le retrouver dans ta main.", "Aujourd'hui tu vas mourir... de rire. Peut-être. On garantit rien.", "Ton chakra du bas est bloqué. Ton chakra du haut s'en fout.", "Tu vas mettre tes écouteurs, lancer un podcast, et penser à autre chose pendant 40 minutes.", "L'univers te souffle quelque chose à l'oreille. C'est incompréhensible.", "Tu vas dire \"je fais ça demain\" pour quelque chose que tu as dit hier.", "Un ami va te partager un meme que t'avais envoyé il y a 3 ans.", "Ton avenir est entre tes mains. Tes mains tremblent un peu. On s'inquiète.", "Les étoiles indiquent une journée productive. Les étoiles te connaissent pas.", "Tu vas avoir faim mais pas envie de cuisiner. Ce soir c'est céréales.", "Quelque chose de bizarre va se passer aujourd'hui et tu vas pas savoir quoi en penser.", "Tu vas souffrir en silence pour un truc complètement évitable.", "Mercure est en sextile avec ta flemme. Ça donne rien de bon.", "Tu vas dire \"c'est bon j'ai compris\" sans avoir compris.", "Les astres révèlent que tu lis cet horoscope alors que t'avais mieux à faire.", "Quelqu'un va te donner un conseil nul avec beaucoup de confiance.", "Tu vas être en retard pour quelque chose et arriver exactement à temps. Miracle.", "Ton avenir s'annonce… présent. C'est déjà ça.", "Tu vas croiser quelqu'un qui te ressemble dans la rue et ça va te perturber.", "Les planètes suggèrent que tu manges quelque chose de chaud. Les planètes ont raison pour une fois.", "Tu vas regarder une vidéo YouTube \"juste 5 minutes\" et réémerger 2 heures plus tard.", "Le cosmos a un plan pour toi. Le cosmos refuse de le divulguer.", "Tu vas expliquer un meme à quelqu'un et le tuer dans la foulée.", "Saturne rétrograde dans ta to-do list. Rien n'avance.", "Tu vas faire une bonne action aujourd'hui par pure erreur.", "Quelqu'un va dire ton prénom dans une conversation sans s'adresser à toi et tu vas quand même te retourner.", "Ton instinct te dit quelque chose. Ton instinct a souvent tort mais là peut-être pas.", "Tu vas avoir une idée géniale et l'oublier avant de la noter.", "Les astres indiquent une rencontre inoubliable. C'est un chien errant.", "Tu vas survivre à cette journée. Bravo. C'était pas garanti.", "Ton énergie du jour est \"fonctionne mais le voyant clignote\".", "Tu vas prendre une décision importante en mode \"on verra bien\".", "Une bonne nouvelle arrive. Elle est accompagnée d'une moins bonne nouvelle.", "Tu vas faire semblant d'avoir lu quelque chose que t'as pas lu.", "L'univers entier s'est aligné aujourd'hui pour que tu lises cet horoscope. C'était pas la peine.", "Les astres révèlent que t'as une gueule de bois cosmique. C'est mérité.", "Mercure est dans ta merde aujourd'hui. Littéralement.", "Tu vas te lever du mauvais pied, trébucher, et te faire chier la gueule. Bonne journée.", "L'univers t'envoie un message : va te faire foutre, mais avec amour.", "Ton chakra du cul est particulièrement actif aujourd'hui. Évite les chaises en plastique.", "Tu vas péter au mauvais moment. Les planètes étaient au courant.", "Saturne te dit d'aller niquer ta mère. Saturne est en colère ce matin.", "Tu vas te chier dessous de rire. Ou juste te chier dessous. Les astres sont flous là-dessus.", "Venus est en opposition avec ton cerveau. Ton cerveau perd.", "Tu vas dire une connerie monumentale avec une confiance absolue. Les étoiles applaudissent.", "Ton avenir pue. Pas métaphoriquement. Il pue vraiment.", "Un inconnu va te faire chier aujourd'hui. Tu pourras rien dire.", "Les constellations forment aujourd'hui un grand doigt d'honneur en ta direction.", "Tu vas rater quelque chose d'important parce que t'étais en train de te gratter les fesses.", "Mercure rétrograde dans tes couilles/ovaires. Ça explique tout.", "Tu vas envoyer un message à quelqu'un que t'aimes pas par accident. Merde.", "L'univers a décidé que tu te feras chier aujourd'hui. L'univers s'assume.", "Tu vas faire un pet silencieux dans un endroit très calme. Les gens sauront que c'est toi.", "Ton destin sent la transpiration et le kebab froid. C'est toi qui vois.", "Jupiter te dit d'aller dormir. Jupiter peut aller se faire mettre.", "Tu vas te coincer le zizi/les seins dans quelque chose d'improbable.", "Les étoiles révèlent que quelqu'un pense à toi en ce moment. C'est pour te dire que t'es con(ne).", "Ton aura est d'un brun douteux aujourd'hui. Très douteux.", "Tu vas lâcher un pet pendant une visio. Les astres avaient prévenu.", "Un truc de merde va t'arriver. Les planètes haussent les épaules.", "Tu vas essayer de faire une bonne impression et te vautrer comme une merde.", "Mercure dit que t'es un boulet cosmique. Mercure est honnête.", "Tu vas passer la journée à rien foutre et quand même être crevé(e). C'est un talent.", "Ton horoscope du jour : ça va être de la merde, mais courageusement.", "Les astres ont vu ce que t'as fait la semaine dernière. Ils jugent pas. Si.", "Tu vas te battre avec une imprimante et perdre. Comme toujours.", "Quelqu'un va te faire une remarque chiante et t'auras pas de répartie. Tu y penseras à 3h du mat.", "Ton avenir ressemble à un kebab tombé par terre. T'as encore faim quand même.", "Tu vas rater ton bus, ta correspondance, et ta vie. Bonne journée !", "Les planètes t'envoient de l'amour. L'amour arrive avec 3 semaines de retard comme toujours.", "Tu vas dire \"j'arrive\" et arriver 45 minutes plus tard. Les étoiles soupirent.", "Ton énergie du jour : \"je m'en bats les couilles mais poliment.\"", "Une flatulence inattendue va changer le cours de ta journée.", "Tu vas te lever pour rien, rester debout 3 secondes, et te rasseoir. Les astres compatissent.", "Vénus est dans ta zone de confort. Bouge-toi le cul quand même.", "Tu vas manger quelque chose qui va te faire regretter d'avoir un système digestif.", "Les étoiles te souhaitent une bonne journée. Les étoiles sont naïves.", "Quelqu'un va te faire chier avec ses problèmes alors que t'as les tiens.", "Ton karma du jour : moyen-moyen avec une pointe de \"va te faire voir\".", "Tu vas perdre 2 heures sur Internet pour rien. Sauf si t'en perdais 3 hier. Alors c'est du progrès.", "Mercure est en rétrograde dans tes toilettes. Mets le ventilateur.", "Les astres révèlent que quelqu'un a pété dans l'ascenseur avant toi. C'était pas beau.", "Tu vas avoir la flemme d'une intensité cosmique rarement observée.", "Ton signe est en dissonance avec tout. Absolument tout. Même ton IKEA.", "L'univers te dit merde mais avec un sourire. Ça change rien au fond.", "Tu vas te planter les doigts de pied sur un meuble et jurer comme un charretier.", "Les planètes s'alignent pour te signaler que t'es un cas désespéré. Mais attendrissant.", "Tu vas envoyer un message d'amour au mauvais contact. Bonne chance.", "Saturne dit que tu peux aller te rhabiller. Saturne a ses raisons.", "Ton avenir brille. C'est peut-être juste de la sueur. On démêle pas bien.", "Tu vas dire une connerie et la défendre jusqu'à la mort par orgueil.", "Les étoiles forment aujourd'hui le mot \"nul\" juste au-dessus de ta tête.", "Tu vas te réveiller avec une chanson chiante dans la tête qui partira pas de la journée.", "Quelque chose va mal tourner. T'avais été prévenu(e). Là. Maintenant.", "Les astres te souhaitent bonne chance. Les astres rigolent quand même un peu.", "Tu vas tenter un truc stylé et te gameler comme une patate.", "Mercure est en sextile avec ta mauvaise foi. Ça donne un truc immonde.", "Ton chakra du nombril parle. Personne l'écoute. Normal.", "Tu vas te faire chier pendant 3h sur un truc qui prend 10 minutes aux gens normaux.", "Les planètes révèlent que t'as besoin d'une douche. Maintenant.", "Tu vas essayer de tenir une porte et ça va être gênant pour tout le monde.", "Ton destin est écrit en Comic Sans sur du papier toilette humide.", "Tu vas manger debout au-dessus de l'évier et prétendre que c'est un choix.", "Saturne rétrograde dans ta fierté. Elle en ressort pas.", "Les étoiles te regardent avec une sorte de pitié bienveillante. C'est touchant et triste.", "Tu vas répondre \"lol\" à un message sérieux par erreur.", "Mercure dit que t'as merdé. T'as merdé.", "Tu vas avoir une discussion très importante avec ton chat. Ton chat s'en bat les reins.", "Ton énergie du jour : chaussette mouillée mais qui garde le moral.", "Tu vas faire semblant de pas voir quelqu'un et te prendre un poteau dans la gueule.", "L'univers a décidé de te tester. L'univers va être déçu.", "Tu vas recevoir un \"ok\" en réponse à un message de 40 lignes. Les astres compatissent pas vraiment.", "Ton avenir ressemble à un Tupperware sans couvercle. Fonctionnel mais incomplet.", "Les planètes indiquent que tu vas te faire remballer. Souris quand même.", "Tu vas péter dans ton sommeil et te réveiller. Les étoiles trouvent ça drôle.", "Quelqu'un va te faire une blague de merde et attendre que tu ries. Tu vas rire.", "Ton horoscope du jour tient en un mot : mouais.", "Tu vas te lever pour faire quelque chose d'important et oublier quoi en chemin.", "Les astres révèlent que t'as la tête dans le cul depuis ce matin. Ressors-la.", "Tu vas regarder ton téléphone à l'envers pendant 3 secondes avant de réaliser.", "Mercure est en rétrograde dans ton estime de toi. Ça repart demain. Peut-être.", "Tu vas passer une heure à chercher tes clés. Elles sont dans ta main.", "Les étoiles te souhaitent du courage. Elles savent ce qui t'attend.", "Ton karma aujourd'hui : neutre avec des accents de \"t'aurais pu faire mieux\".", "Tu vas te convaincre que t'as été productif(ve) alors que t'as rien foutu.", "Les planètes s'alignent dans ta direction pour te dire un grand PFFFFFFFRT.", "Tu vas tenter de faire la bise à quelqu'un qui tend la main. Moment cosmique.", "Mercure te dit que t'es con(ne). Mercure a ses jours aussi.", "Ton avenir est flou comme une photo prise avec un doigt sur l'objectif.", "Tu vas tomber dans les escaliers en pensant qu'il en restait une marche. Les astres ont prévu les pansements.", "Les étoiles forment ce soir la silhouette d'un être qui te ressemble et qui a l'air perdu.", "Tu vas faire une bonne chose aujourd'hui. Par accident. Mais ça compte quand même.", "Mercure est en opposition avec ta dignité. La dignité perd aux points.", "Tu vas survivre à cette journée dans un état discutable mais vivant(e). C'est l'essentiel.", "Les astres révèlent que Pomni de TADC essaie de s'échapper de ton signe astrologique. Elle peut pas.", "Tu vas passer la journée comme Kinger de TADC : dans un coin, à trembler. Les planètes comprennent.", "Ton destin ressemble à un épisode de TADC : coloré, traumatisant, et sans issue claire.", "JDG a reviewé ton avenir. Il lui a mis 2/10. \"C'est de la merde.\"", "Springtrap se cache dans ton placard depuis 3 semaines. Évite d'ouvrir.", "Caine de TADC a décidé de ton destin aujourd'hui. Il a lancé un dé. Résultat : chaos.", "Tu vas avoir une journée aussi longue qu'un épisode de JDG sur un jeu de merde des années 90.", "Freddy Fazbear te surveille. Il attend juste le bon moment.", "Ton aura aujourd'hui : Jax de TADC après sa 3ème mauvaise décision de la journée.", "Tu vas abstraire comme Pomni de TADC mais sans la jolie tenue rose.", "FNAF lore a plus de sens que ton planning de la semaine.", "JDG ferait un meilleur boulot que toi aujourd'hui. Et il jouerait à Big Rigs pendant ce temps.", "Caine de TADC t'a ajouté au cirque. T'as pas eu le choix. Bienvenue.", "Tu vas te comporter exactement comme Bonnie un soir de panne de courant.", "Les planètes forment aujourd'hui la tête de Freddy. Il sourit. C'est pas bon signe.", "Ton énergie du jour : Gangle de TADC qui essaie de tenir le masque de la comédie mais y arrive plus.", "JDG résumerait ta journée en deux mots : \"c'est nul\".", "Tu vas te retrouver dans une situation aussi absurde qu'un épisode de TADC et personne te croira.", "Bubble de TADC a essayé de lire ton avenir. Elle a explosé avant de finir.", "Springtrap a lu ton horoscope. Il a ri. Ça fait peur.", "Tu vas agir exactement comme Jax de TADC : faire une connerie, sourire, recommencer.", "JDG a essayé de finir ta to-do list. Il a abandonné au niveau 1.", "Ton chakra du cirque numérique est particulièrement instable aujourd'hui.", "Chica te regarde depuis le fond de la cuisine. Elle a faim. Toi aussi. Mauvaise combinaison.", "Les étoiles révèlent que t'es coincé(e) dans le cirque comme tout le monde. Pas d'abstraction aujourd'hui.", "Kinger de TADC a essayé de t'expliquer quelque chose d'important. Il a paniqué avant de terminer.", "Ton avenir ressemble au lore de FNAF : trop compliqué, trop long, et t'es sûr(e) que t'as raté un truc.", "JDG a testé ta journée. Note finale : 3/20. \"Y'a un effort mais c'est vraiment pas bon.\"", "Zooble de TADC te regarde avec ses yeux détachés. Même iel a l'air inquiet pour toi.", "Les planètes s'alignent comme les animatroniques à 6h du mat. Fuis.", "Caine de TADC t'a donné une mission aujourd'hui. T'as pas compris les règles. Bonne chance.", "Tu vas être aussi perdu(e) que Pomni de TADC à son premier jour. Mais t'as pas son énergie.", "Les astres forment ce soir la silhouette de Golden Freddy. Dors bien.", "JDG a fait une vidéo sur toi. Elle dure 45 minutes. C'est pas flatteur.", "Ton destin est un jeu de merde de 1998 que JDG reviewerait pour rire.", "Tu vas abstraction-run ta vie comme Pomni de TADC mais sans parvenir à t'échapper.", "Springtrap est en embuscade dans ta journée. Il est patient. Très patient.", "Caine de TADC a improvisé un jeu pour toi aujourd'hui. Les règles changent toutes les 5 minutes.", "JDG te dirait \"c'est comme un mauvais jeu, mais t'es obligé(e) de le finir quand même.\"", "Tu vas passer ta journée comme Kinger de TADC : tout savoir, tout anticiper, paniquer quand même.", "Les animatroniques ont voté. T'es éliminé(e). On t'a pas dit de quoi.", "L'univers entier ressemble aujourd'hui à du TADC : coloré, piégé, sans sortie. Bonne journée.", "JDG a regardé ton énergie du jour. Il a éteint la caméra sans rien dire.", "Ton signe est en opposition avec Jax de TADC. Jax gagne toujours.", "Freddy Fazbear a lu ton horoscope. Il a hoché la tête lentement. C'est inquiétant.", "Les étoiles forment aujourd'hui le sourire de Caine de TADC. T'es dans son jeu maintenant.", "JDG te regarde jouer à ta propre vie. Il souffre en silence.", "Gangle de TADC a pleuré pour toi ce matin. Elle savait avant toi.", "Les animatroniques ont une réunion ce soir. Ton nom est sur l'ordre du jour.", "Ton destin a été écrit par Caine de TADC un soir de grande forme. C'est dire.", "Feldup a commencé un Findings sur ton avenir. Il a arrêté l'idée immédiatement.", "Ton destin fait l'objet d'un épisode de Findings. La vidéo dure 6 heures. Personne la finit.", "Feldup enquête sur toi depuis 3 semaines. Il a trouvé des trucs. Il garde ça pour lui, et tant mieux.", "Les astres révèlent que t'es un mystère d'internet que Feldup a classé \"trop bizarre à expliquer\".", "Ton aura a été analysée dans un Findings. Conclusion : \"on sait pas trop.\"", "Feldup a trouvé une vidéo de toi sur une plateforme oubliée de 2009. Il enquête.", "Les planètes forment aujourd'hui un fil Reddit que Feldup va décortiquer pendant 2 heures.", "Ton histoire a été soumise à Feldup pour un Findings. Il a dit \"trop dark même pour moi.\"", "Feldup a tracé les origines de ta malchance jusqu'en 2003. Il comprend pas encore le lien.", "Ton existence est un mystère d'internet que personne a encore vraiment expliqué. Feldup s'y colle.", "Les étoiles ont généré un thread 4chan sur ton destin. Feldup en fait un Findings de 5h.", "Feldup a passé 48h à analyser tes décisions de la semaine. Il a conclu que t'es une anomalie statistique.", "Ton chakra est documenté dans les archives d'un forum disparu en 2011. Feldup l'a retrouvé.", "Les astres ont classé ta journée dans la catégorie \"phénomène inexpliqué\". Feldup arrive.", "Feldup a fait un Findings sur quelqu'un qui te ressemble. T'es sûr(e) que c'était pas toi ?", "Ton avenir est un rabbit hole dont Feldup sort jamais vraiment indemne.", "Les planètes révèlent que ton passé internet mériterait un épisode entier de Findings. Commence à paniquer.", "Feldup enquête sur l'origine de ta mauvaise humeur depuis le début de la semaine. Il remonte à loin.", "Ton destin a été archivé sur Wayback Machine. Feldup l'a trouvé. Il prépare quelque chose.", "Les étoiles indiquent que t'es au centre d'un mystère que même Feldup peut pas résoudre en moins de 4h.", "Feldup a ouvert un nouvel onglet sur toi. Puis un autre. Puis encore un autre. Ça fait 47 onglets.", "Ton aura a laissé des traces sur des forums morts depuis 2007. Feldup les compile.", "Les astres révèlent que quelqu'un a posté sur toi sur un forum obscur en 2014. Feldup est sur le coup.", "Feldup a tenté de comprendre ta logique. Il a fait une pause. Il a repris. Il a abandonné.", "Ton existence génère le genre de questions que Feldup pose à 2h du mat avant de lancer un Findings.", "Les Archives Regaïennes ont un dossier sur toi. Il est dans les abysses. <@436218312574107658> hésite à y descendre.", "<@436218312574107658> a trouvé un ARG qui te concerne. Elle a coupé la caméra sans explication.", "Ton destin a été classé dans les Archives Regaïennes sous la catégorie \"ne pas ouvrir\".", "Les étoiles révèlent que t'es quelque part dans un iceberg qu'<@436218312574107658> prépare. T'es dans les abysses.", "Les Archives Regaïennes documentent ton aura depuis 2019. Personne a encore osé regarder jusqu'au bout.", "<@436218312574107658> a trouvé un jeu de merde qui te ressemble trait pour trait. Elle a souffert en silence.", "Ton existence est un ARG qu'<@436218312574107658> suit depuis des mois. Elle approche de la fin. Ça l'inquiète.", "Les Archives Regaïennes ont archivé tes pires décisions. Le dossier est volumineux.", "Ton destin est dans les abysses d'un iceberg qu'<@436218312574107658> a pas encore eu le courage de finir.", "Les Archives Regaïennes te concernent plus que tu le crois. <@436218312574107658> sait. Elle dit rien pour l'instant.", "Un jeu indé bizarre sorti en 2003 raconte exactement ta vie. <@436218312574107658> l'a trouvé. Elle prépare une vidéo.", "Les étoiles révèlent que t'es un mystère que les Archives Regaïennes ont classé \"inexpliqué à ce jour\".", "<@436218312574107658> a découvert un forum disparu en 2011 qui parle de toi. Elle descend dans les abysses.", "Ton aura a généré un ARG spontané. <@436218312574107658> enquête.", "Les Archives Regaïennes ont trois tomes qui te concernent. Le quatrième est censuré.", "<@436218312574107658> a joué à un jeu pourri qui reproduit exactement ta semaine. Elle a mis 2/10. Généreusement.", "Ton destin est l'épisode des Archives Regaïennes qu'<@436218312574107658> a mis le plus de temps à sortir. Elle comprend encore pas tout.", "Les étoiles ont généré un mystère d'internet à ton sujet. <@436218312574107658> est dessus depuis 3h du matin.", "T'es dans les abysses d'un iceberg qu'<@436218312574107658> a découvert par accident. Elle regrette un peu.", "Les Archives Regaïennes ont documenté ton énergie du jour : \"phénomène non-identifié, à surveiller.\"", "Ton existence entière pourrait faire l'objet d'un ARG. <@436218312574107658> a commencé à tirer les fils. Bonne chance.", "Les Archives Regaïennes te souhaitent une bonne journée. Elles savent des trucs. Elles disent rien.", "<@436218312574107658> a trouvé un ARG qui te cible personnellement. Elle prépare une vidéo. T'as pas été prévenu(e).", "Ton destin est quelque part dans les abysses d'un iceberg qu'<@436218312574107658> a pas encore osé toucher.", "Les Archives Regaïennes ont un épisode sur toi en post-production. <@436218312574107658> hésite à le sortir.", "Tu fais partie d'un mystère d'internet qu'<@436218312574107658> a découvert à 3h du mat. Elle dort plus depuis.", "Ton aura est classée dans les abysses d'un iceberg que personne a encore eu le courage de faire.", "<@436218312574107658> a retrouvé une trace de toi sur un site disparu en 2008. Elle creuse.", "Les Archives Regaïennes ont consacré un épisode entier à expliquer pourquoi tu fais des choix pareils. Ça dure 2h.", "T'es le genre de mystère qu'<@436218312574107658> tombe dessus par accident et qui lui bouffe 6 mois de recherches.", "Quelqu'un a posté sur toi sur un forum obscur en 2013. <@436218312574107658> l'a trouvé. Elle prend des notes.", "Ton existence a été indexée dans un ARG que personne a résolu. <@436218312574107658> est sur le coup.", "Les Archives Regaïennes te concernent plus que tu l'imagines. L'épisode sort quand <@436218312574107658> sera prête.", "T'es dans les abysses d'un iceberg qu'<@436218312574107658> a découvert en faisant des recherches sur autre chose.", "<@436218312574107658> a trouvé un jeu de 2001 dont le personnage principal te ressemble de façon troublante.", "Ton destin a laissé des traces sur Wayback Machine. <@436218312574107658> les a toutes archivées.", "Un mystère d'internet tourne autour de toi depuis des années. <@436218312574107658> vient juste de s'en rendre compte.", "Les Archives Regaïennes ont un épisode qui commence par toi et finit sur quelque chose de bien plus flippant.", "<@436218312574107658> a remonté la trace de ta malchance jusqu'à un événement de 2007 qu'elle peut pas encore expliquer.", "T'es quelque part dans les abysses d'un iceberg. <@436218312574107658> te cherche. Elle approche.", "Un ARG lancé en 2015 te ciblait sans que tu le saches. <@436218312574107658> vient de faire le lien.", "Les Archives Regaïennes ont documenté ta journée avant même que tu te lèves. <@436218312574107658> était prête.", "Ton passé internet est un rabbit hole qu'<@436218312574107658> explore depuis plusieurs semaines. Elle remonte à loin.", "<@436218312574107658> a trouvé un forum de 2010 qui décrit exactement ta personnalité. Elle sait pas quoi en penser.", "T'es le genre de cas que les Archives Regaïennes gardent pour la fin, quand tout le reste a été dit.", "Ton aura a été repérée dans un ARG que personne pensait être réel. <@436218312574107658> enquête.", "Les étoiles révèlent que t'es dans les abysses d'un iceberg qu'<@436218312574107658> a intitulé \"à ne pas regarder seul(e)\".", "<@436218312574107658> a retrouvé une vidéo YouTube supprimée qui te concerne. Elle a pris des captures d'écran.", "Les Archives Regaïennes ont un épisode sur un mystère qui commence par ta date de naissance. Coïncidence.", "T'es référencé(e) dans un wiki d'ARG abandonné depuis 2012. <@436218312574107658> l'a trouvé cette nuit.", "<@436218312574107658> a passé 4h à analyser une image qui te ressemble sur un site que personne visite plus.", "Ton destin est documenté quelque part dans les abysses. <@436218312574107658> descend. Elle prend une lampe.", "Les Archives Regaïennes ont failli te consacrer un épisode entier. <@436218312574107658> a jugé que c'était trop tôt.", "Un fichier audio trouvé sur un vieux forum contient ton prénom. <@436218312574107658> l'a écouté 12 fois.", "T'es le chapitre final d'un ARG que personne a encore résolu. <@436218312574107658> est à deux pas de la vérité.", "Les étoiles révèlent qu'<@436218312574107658> a un dossier sur toi. Il est épais. Elle l'ouvre ce soir.", "Ton existence génère le genre de questions qu'<@436218312574107658> pose à la caméra avec un regard inquiet.", "Les Archives Regaïennes ont un épisode qui finit sur toi. <@436218312574107658> a ajouté un avertissement au début.", "T'es dans les abysses d'un iceberg qu'<@436218312574107658> a intitulé \"je préfère pas savoir\" mais elle continue quand même.", "<@436218312574107658> a retrouvé un compte abandonné en 2009 dont l'avatar te ressemble. Elle creuse encore.", "Ton destin est le genre de rabbit hole dont <@436218312574107658> sort avec plus de questions que de réponses.", "Les Archives Regaïennes ont archivé un mystère qui commence exactement là où ta journée commence.", "<@436218312574107658> a trouvé une trace de toi dans un ARG qu'elle pensait fictif. Elle reconsidère tout.", "T'es référencé(e) dans les abysses d'un iceberg qu'<@436218312574107658> appelle \"le dossier qu'on touche pas\".", "Un site Geocities de 2004 parle de toi. <@436218312574107658> l'a trouvé. Elle prend des notes depuis une heure.", "Les Archives Regaïennes ont un épisode sur un mystère dont t'es involontairement au centre.", "<@436218312574107658> a découvert que ton prénom apparaît dans un ARG lancé il y a 8 ans. Personne avait fait le lien.", "Ton aura est dans les abysses d'un iceberg qu'<@436218312574107658> hésite à finir parce que la fin est trop bizarre.", "Les étoiles révèlent qu'<@436218312574107658> a trouvé quelque chose qui te concerne. Elle prépare ses sources.", "T'es le genre de mystère qu'<@436218312574107658> garde pour la fin d'un épisode pour que les gens restent jusqu'au bout.", "Les Archives Regaïennes ont un épisode en cours sur un phénomène inexpliqué. C'est toi. T'étais pas au courant.", "<@436218312574107658> a tout trouvé. Elle sait tout. L'épisode sort quand elle aura décidé que t'es prêt(e) à savoir.", "<@511929490964742144> a posté quelque chose dans le salon Shitpost. Personne sait quoi penser. Les astres non plus.", "Ton destin a été débattu dans le salon des Modos. Les conclusions sont classifiées.", "<@899733709173948487> a reconnu des patterns FNAF dans ton horoscope. Il a commencé à paniquer.", "<@738191002187202630> a regardé ton avenir. Elle a souri. C'est soit très bon soit très mauvais.", "Le pain d'<@436218312574107658> a plus de pouvoirs que toi aujourd'hui. Accepte-le.", "<@1070742213635625050> te répond depuis la Corée avec 7h de décalage. Les astres trouvent ça compliqué.", "Jérémy court quelque part dans ton destin. Il s'arrêtera pas. Il s'arrête jamais.", "<@704593833421438996> a essayé de coder ton avenir. Il y a un bug. Elle cherche encore.", "<@744217896581857281> a eu une idée géniale à 3h du mat avec ses lunettes de savant fou. Ça te concerne. Fuis.", "Les étoiles révèlent que <@511929490964742144> a posté un shitpost qui décrit exactement ta journée. Il savait pas.", "<@731078752708067403> a lancé un débat politique dans ta tête. Tu t'en remets pas depuis ce matin.", "<@1263920891264499733> a commenté ton horoscope avec un seul emoji. C'était suffisant.", "La soirée du Bac Blanc a laissé des traces dans l'univers. Les planètes flirtent encore.", "<@975959908702888046> a regardé ton aura. Elle a approuvé. Tu sais pas trop quoi en penser.", "<@375746968737021962> a analysé ta situation politique cosmique. Sa conclusion est brillante et légèrement inquiétante.", "Ton destin a été posté dans le salon Shitpost. Il a eu 12 réactions 💀.", "Le salon Bots a généré un bug à cause de toi. Cacabot en est partiellement responsable.", "<@899733709173948487> a trouvé des similarités entre toi et un animatronique. Il garde ça pour lui pour l'instant.", "<@738191002187202630> existe et les astres sont jaloux. C'est tout ce qu'ils ont à dire aujourd'hui.", "<@744217896581857281> a une théorie sur ton avenir. Elle implique un schéma compliqué sur un tableau blanc et beaucoup de fil rouge.", "Le pain d'<@436218312574107658> a été consulté pour lire ton avenir. Il a pas répondu. Comme toujours. C'est déjà une réponse.", "Jérémy est passé dans ta journée à toute vitesse. Il a rien dit. Il s'arrête jamais.", "<@731078752708067403> a essayé de débattre avec les étoiles. Les étoiles ont bloqué <@731078752708067403>.", "<@704593833421438996> a push du code dans ton destin sans lire les merge requests. Ça explique tout.", "Les planètes révèlent que quelqu'un parle de toi dans le salon des Modos en ce moment.", "<@511929490964742144> a shitposté tellement fort aujourd'hui que les astres ont demandé une pause.", "<@375746968737021962> a une opinion très précise sur ta situation. Elle est correcte. Ça t'énerve.", "<@1070742213635625050> envoie un message depuis Séoul. Il arrive avec 7h de retard cosmique.", "<@1263920891264499733> a validé ton énergie du jour. Ça suffit. T'as pas besoin d'autre validation.", "<@975959908702888046> a regardé ton outfit astral. Elle a apprécié.", "Le salon Cosplay & Outfits a jugé ton aura. Verdict : potentiel, mais à travailler.", "La soirée du Bac Blanc est canonique dans l'univers. Les planètes s'en souviennent encore.", "<@744217896581857281> a refait les calculs. Ton destin tient sur 3 post-it et un tableau de corrélations incompréhensible.", "<@899733709173948487> a identifié ton signe comme un personnage de TADC. Il refuse de dire lequel.", "Le pain d'<@436218312574107658> a bougé tout seul cette nuit. Les astres notent l'événement sans commenter.", "Jérémy court encore. Il a pas de destination. Il a pas besoin d'en avoir.", "<@704593833421438996> a debuggé ton karma. Elle a trouvé 7 erreurs. Elle corrige dans l'ordre.", "<@738191002187202630> a souri en pensant à toi ce matin. Les étoiles ont eu chaud.", "<@731078752708067403> a lancé un débat sur le meilleur système électoral dans le fil de ton destin. Tout le monde souffre.", "<@511929490964742144> a posté le gif Markiplier au bon moment. Comme toujours. Les astres saluent.", "<@375746968737021962> a commenté ta situation en trois phrases. C'était plus éclairant que cet horoscope entier.", "Ton destin ressemble au salon Shitpost : dense, incompréhensible, mais vivant.", "<@1070742213635625050> a envoyé un message à minuit heure coréenne pour te dire que ça allait aller. Il avait raison.", "<@975959908702888046> a une vision très précise de ton avenir. Elle la partage pas. Elle sourit juste.", "<@1263920891264499733> a regardé ton horoscope. Il a dit \"same\". C'est la réponse la plus juste.", "Le salon des Modos a voté sur quelque chose qui te concerne. Le résultat est secret.", "<@744217896581857281> a inventé un mot pour décrire ton énergie du jour. Personne comprend ce mot. <@744217896581857281> non plus.", "<@899733709173948487> a croisé ton nom dans un wiki FNAF. Il enquête.", "Le mariage de <@738191002187202630> et <@436218312574107658> a rééquilibré les forces cosmiques pour un moment. Les planètes s'en remettent encore.", "Cacabot a tout vu. Cacabot dit rien. Cacabot sait.", "Les étoiles ont posté dans le salon Shitpost. <@511929490964742144> a répondu plus vite qu'elles.", "Ton karma a été merge request par <@704593833421438996>. Elle attend la review depuis 3 jours.", "<@744217896581857281> a une théorie sur l'origine du pain d'<@436218312574107658>. Elle implique des dimensions parallèles et un four à micro-ondes.", "<@899733709173948487> a reconnu ton pattern de comportement dans le lore de FNAF Security Breach. Il est inquiet.", "<@738191002187202630> a existé aujourd'hui. Les astres ont trouvé ça injustement bien.", "<@375746968737021962> a expliqué ta situation géopolitique cosmique en 4 minutes. C'était fascinant et légèrement déprimant.", "Jérémy est passé. Il repassera. Il s'arrêtera toujours pas.", "Le pain d'<@436218312574107658> a regardé dans ta direction ce matin. T'as rien remarqué. C'est peut-être mieux.", "<@731078752708067403> a lancé un débat sur la proportionnelle dans le fil de tes rêves. Tu t'es réveillé(e) épuisé(e).", "<@511929490964742144> a shitposté quelque chose qui ressemble exactement à ton horoscope. C'était involontaire. Ou pas.", "<@1070742213635625050> a validé ton énergie depuis Séoul avec un pouce en l'air. Il savait pas pourquoi. Il avait quand même raison.", "<@1263920891264499733> a regardé ton destin. Il a haussé les épaules avec classe. C'est suffisant.", "<@975959908702888046> a commenté ton aura. Elle a dit \"cute\". Les astres rougissent.", "<@704593833421438996> a refactorisé ton avenir. C'est plus propre mais y a toujours un bug inexpliqué ligne 247.", "Le salon des Modos a un thread entier sur toi. Il est archivé. Il est long.", "<@744217896581857281> a dessiné un schéma de ton destin sur un tableau. Il y a des flèches partout. Aucune ne pointe dans la même direction.", "Les étoiles révèlent que Cacabot t'a observé(e) toute la semaine. Cacabot prend des notes.", "<@899733709173948487> a fait le lien entre ton signe et un personnage de TADC. Il garde l'info pour lui mais son regard dit tout.", "<@738191002187202630> a ri d'un truc aujourd'hui. L'univers entier a trouvé ça sympa.", "La soirée du Bac Blanc a changé la trajectoire des planètes. Elles flirtent encore entre elles depuis.", "<@375746968737021962> a prédit ta journée avec une précision troublante. Il a précisé que c'était \"juste de la logique\".", "<@511929490964742144> a posté le gif Markiplier exactement quand il fallait. Les astres notent l'excellence du timing.", "Ton destin a été debug par <@704593833421438996> à 2h du mat. Elle a trouvé l'erreur. Elle l'a pas corrigée. Elle dort.", "<@744217896581857281> a réfléchi à ton avenir avec ses lunettes de savant fou. Elle a conclu quelque chose d'important qu'elle a aussitôt oublié.", "Le pain d'<@436218312574107658> a disparu cette nuit. Il est revenu ce matin. Personne a posé de questions.", "Jérémy a croisé ton destin en courant. Il a pas ralenti. Il ralentit jamais.", "<@1070742213635625050> t'a envoyé un message depuis un café à Séoul. Il dit que t'inquiète pas. Il a l'air sûr de lui.", "<@731078752708067403> a lancé un débat sur le vote obligatoire dans ta to-do list. T'as rien demandé.", "<@975959908702888046> a validé ton outfit astral sans hésiter. C'est le meilleur retour que t'auras aujourd'hui.", "<@1263920891264499733> a lu ton horoscope et a dit \"mood\". C'est la critique la plus juste possible.", "Le salon Cosplay & Outfits a jugé l'esthétique de ton aura. Verdict : iconique mais perfectible.", "<@899733709173948487> a trouvé un easter egg FNAF dans ton horoscope. Il screenshot tout.", "Les planètes révèlent que quelqu'un spam le salon Bots pour interagir avec Cacabot depuis 20 minutes. C'est pour toi.", "<@704593833421438996> a push en prod ton avenir sans staging. Les conséquences sont en cours.", "<@744217896581857281> a inventé un mot pour ton énergie cosmique. Elle l'a écrit sur un post-it. Le post-it a disparu.", "<@738191002187202630> a souri et ça a suffi à stabiliser l'axe de rotation de la Terre aujourd'hui.", "<@375746968737021962> a une analyse politique de ton horoscope qui tient en 6 points. Le point 4 te concerne particulièrement.", "<@511929490964742144> a posté quelque chose dans le Shitpost qui était tellement absurde que les étoiles ont clignoté.", "Le pain d'<@436218312574107658> a émis un son cette nuit. Les astres ont décidé de ne pas enquêter.", "Jérémy a traversé ton salon en courant pendant que tu dormais. Les traces sont là si tu cherches bien.", "<@731078752708067403> a essayé de débattre avec Cacabot. Cacabot a répondu \"Feur\". <@731078752708067403> a pas su quoi dire.", "<@1070742213635625050> a envoyé une photo depuis un marché coréen. Elle était floue. Les astres pensent que c'était un signe.", "<@975959908702888046> a regardé ton destin avec un sourire connaisseur. Elle sait des trucs. Elle dit rien.", "<@1263920891264499733> a existé aujourd'hui. Les planètes trouvent ça cool.", "<@704593833421438996> a créé une fonction pour gérer ton karma. Elle est élégante. Elle marche pas encore tout à fait.", "<@744217896581857281> a eu une révélation sur le pain d'<@436218312574107658> à 4h du mat. Elle l'a notée. L'écriture est illisible.", "Les étoiles ont posté dans le salon Bots. Cacabot leur a répondu \"Feur\". Ambiance.", "<@899733709173948487> a regardé ton destin comme il regarde un épisode de TADC : avec intensité et une légère anxiété.", "<@738191002187202630> et <@436218312574107658> ont fondamentalement rééquilibré les forces de l'univers le soir du Bac Blanc. Les planètes en parlent encore.", "<@375746968737021962> a conclu que ta situation est \"objectivement intéressante d'un point de vue politique\". Il a pas tort.", "<@511929490964742144> a shitposté quelque chose ce matin qui prédit exactement ce qui va t'arriver aujourd'hui. Il le sait pas.", "Le salon des Modos a un vote en cours te concernant. Le résultat sera annoncé quand t'es pas là.", "<@744217896581857281> a refait ses calculs. Ton destin nécessite encore plus de fil rouge et un deuxième tableau blanc.", "Le pain d'<@436218312574107658> a été aperçu à deux endroits en même temps ce matin. Les astres prennent note.", "Jérémy court encore. Il a jamais commencé. Il arrêtera jamais. C'est son état naturel.", "<@704593833421438996> a ouvert une issue GitHub sur ton avenir. Elle est intitulée \"comportement inattendu\". Elle est ouverte depuis longtemps.", "<@1070742213635625050> a regardé l'heure à Séoul et s'est dit que toi t'étais sûrement encore debout à faire des bêtises. Il avait raison.", "<@731078752708067403> a tenté de convaincre les astres de voter autrement. Les astres ont fermé l'onglet.", "<@975959908702888046> a dessiné ton aura de mémoire. C'est étonnamment précis et légèrement flatteur.", "<@1263920891264499733> a validé ton existence d'un regard. C'est amplement suffisant.", "<@899733709173948487> a tracé des parallèles entre ton horoscope et le lore de FNAF Sister Location. Il est troublé.", "Les étoiles révèlent que le salon Shitpost te concerne plus que tu le crois ce soir.", "Cacabot a tout documenté. Cacabot garde les archives. Cacabot sourit pas parce que Cacabot a pas de visage. Mais Cacabot sait.", "<@375746968737021962> a regardé ta journée d'un œil analytique et a conclu que \"franchement c'est pas si mal dans l'absolu\".", "<@744217896581857281> a une nouvelle théorie. Elle implique le pain d'<@436218312574107658>, Jérémy, et un événement cosmique de 2019. Le schéma est complexe.", "<@511929490964742144> a rien posté depuis 3h. Les astres sont inquiets. C'est pas normal.", "<@738191002187202630> a existé avec une grâce particulière aujourd'hui. L'univers a pris bonne note.", "<@704593833421438996> a refactorisé le code source de ton destin. C'est plus lisible. Y a toujours un warning qu'elle ignore.", "Le pain d'<@436218312574107658> a regardé Jérémy courir. Il a rien dit. Il dit jamais rien. C'est ça qui fait peur.", "<@731078752708067403> a proposé une réforme du système cosmique. Les planètes ont dit non. <@731078752708067403> a relancé le débat.", "<@1070742213635625050> a envoyé un voice message depuis la Corée. Il dure 4 minutes. L'info principale est à la toute fin.", "<@975959908702888046> a regardé dans ta direction avec une expression que personne a réussi à déchiffrer. Les astres non plus.", "<@1263920891264499733> a commenté ton destin avec un émoji. Un seul. C'était le bon.", "<@899733709173948487> a fait une liste de tous les personnages TADC et FNAF qui te ressemblent. La liste est longue.", "Les Archives Regaïennes ont un épisode en préparation sur le pain d'<@436218312574107658>. <@436218312574107658> hésite encore à sortir les vraies conclusions.", "Toy Bonnie a regardé ton horoscope. Il a souri. C'est pire que quand il sourit pas.", "Pomni de TADC a tenté de s'échapper de ton signe astrologique. Elle a couru en rond pendant 3h.", "Les animatroniques ont tenu une réunion sur ton cas. Freddy a pris la parole en dernier. C'est jamais bon signe.", "Jax de TADC a sabordé ton planning de la journée par pur plaisir. Il regrette pas.", "Withered Bonnie te cherche depuis ce matin. Il a pas de visage mais il te trouvera quand même.", "Caine de TADC a créé un mini-jeu spécialement pour toi. Les règles sont inexistantes. Bonne chance.", "Golden Freddy est assis dans ton salon depuis une semaine. Tu l'as pas encore vu.", "Gangle de TADC pleure pour toi depuis ce matin. Elle sait ce qui t'attend. Elle peut rien faire.", "Les Marionettes de FNAF ont un dossier sur toi. Il est dans la pizzeria. La pizzeria est hantée.", "Kinger de TADC a tout anticipé pour ta journée. Il a paniqué avant même que ça commence.", "Ennard se balade dans tes canalisations depuis jeudi. Les astres suggèrent d'éviter les sous-sols.", "Zooble de TADC te regarde depuis l'autre côté de la pièce. Ses yeux sont détachés. Ils te suivent quand même.", "Springtrap a lu ton horoscope deux fois. Il a pris des notes. Ses notes sont illisibles mais nombreuses.", "Bubble de TADC a essayé de t'expliquer ton destin. Elle a explosé à mi-chemin. Message non transmis.", "Glamrock Freddy a essayé de te protéger aujourd'hui. Il a glitché au mauvais moment. Désolé.", "Ragatha de TADC t'a encouragé(e) ce matin avec un grand sourire. Elle souffre en silence. Comme toi.", "Ballora danse quelque part dans ton avenir. T'entends la musique si tu écoutes bien. T'as pas envie d'écouter.", "Jax de TADC a parié sur ta journée avec Caine de TADC. Jax a gagné. C'est mauvais signe pour toi.", "Circus Baby te regarde depuis les coulisses de ta vie. Elle attend le bon moment depuis longtemps.", "Pomni de TADC a essayé de documenter ta journée pour avoir un repère dans la réalité. Elle a abandonné.", "Les Nightguards de FNAF ont refusé le poste pour surveiller ta nuit. Même eux ont des limites.", "Caine de TADC a ajouté un obstacle supplémentaire dans ton planning. Il trouve ça drôle. Il a pas tort.", "Vanny court quelque part derrière toi. Lentement. Régulièrement. Depuis ce matin.", "Kaufmo de TADC a abstrait avant de pouvoir te dire ce qui t'attendait aujourd'hui. Message perdu.", "L'animatronique de la Pizzeria a bougé d'un centimètre cette nuit. Les caméras ont tout vu. Toi non.", "Tu vas te chier dessous mentalement avant même d'arriver à midi.", "Les astres révèlent que t'as une collection de trucs inutiles que tu gardes \"au cas où\". T'en auras besoin jamais.", "Ton aura sent le Monster Energy et les regrets.", "Tu vas perdre une game à cause d'un lag et blâmer ta connexion. C'était pas la connexion.", "Les étoiles révèlent que t'as encore des notifications non lues depuis 2019.", "Ton destin ressemble à un Creepypasta écrit par un gamin de 12 ans à 3h du mat. C'est toi le gamin.", "Tu vas mourir dans un jeu en mode \"easy\" et prétendre que le jeu est mal équilibré.", "Les planètes révèlent que t'as encore Minecraft installé. Tu joues plus mais tu désinstalles pas. C'est important.", "Ton chakra est bloqué par 47 onglets ouverts depuis 3 semaines.", "Tu vas relire un Creepypasta que t'avais adoré à 13 ans et réaliser qu'il était nul. C'est douloureux.", "Les étoiles révèlent que quelqu'un t'a dit \"skill issue\" aujourd'hui et avait raison.", "Ton avenir ressemble à un wiki abandonné sur un jeu que plus personne joue.", "Tu vas tomber dans un trou dans Minecraft et perdre ton stuff du nerf. Les astres compatissent pas.", "Les planètes révèlent que ton humeur du jour c'est \"NPC en attente de son trigger\".", "Tu vas lire le lore d'un jeu vidéo pendant 2h au lieu de jouer au jeu.", "Ton destin a été spoilé sur Reddit par quelqu'un avec zéro karma.", "Les étoiles révèlent que t'as encore une save de jeu de 2017 que tu reprends jamais mais supprime jamais.", "Tu vas te péter les doigts de pied sur un meuble et jurer en anglais par réflexe.", "Ton aura est le niveau tutoriel d'un jeu qui explique trop et trop longtemps.", "Les planètes ont tenté de te speedrun. Elles ont fait Any% parce que t'es trop compliqué(e) en 100%.", "Tu vas lire \"press F to pay respects\" dans ta tête dans un moment de deuil réel.", "Les astres révèlent que t'as un personnage préféré dans un jeu que personne d'autre a joué.", "Ton destin est un easter egg caché dans un jeu AA de 2009 que personne a trouvé sauf toi.", "Tu vas dire \"c'est comme dans [jeu vidéo]\" dans une conversation sérieuse et perdre tout le monde.", "Les étoiles révèlent que t'as une lore theory sur un jeu que tu gardes pour toi parce que personne comprendrait.", "Ton chakra du jour : chargement infini avec une barre de progression qui recule parfois.", "Tu vas craft quelque chose d'inutile dans un crafting game juste pour voir. Ça prend 3h.", "Les planètes révèlent que quelqu'un quelque part joue un personnage qui te ressemble dans un RPG. Il souffre.", "Ton avenir est un DLC pas encore annoncé. Il sortira en retard. Il coûtera trop cher.", "Tu vas avoir une théorie sur un jeu vidéo qui est en fait complètement correcte mais invérifiable.", "Les étoiles révèlent que t'as dit \"je joue juste encore 5 minutes\" il y a 4 heures.", "Ton énergie du jour : personnage secondaire qui mériterait son propre arc narratif.", "Tu vas mourir d'une façon stupide dans un jeu et regarder l'écran en silence pendant 10 secondes.", "Les planètes révèlent que t'as une playlist \"pour travailler\" qui contient que des OST de jeux vidéo.", "Ton destin ressemble à un jeu avec un ending secret que 3 personnes ont trouvé et que personne croit.", "Tu vas chercher sur Google comment faire quelque chose dans un jeu et tomber sur un forum de 2007 avec une réponse de \"lol bonne chance\".", "Les étoiles révèlent que t'as une peluche sur ton bureau que tu gardes depuis l'enfance et que tu touches pas mais qui doit rester là.", "Ton aura est un personnage qu'on joue pas au début mais qu'on unlock après 40h de jeu.", "Tu vas essayer de faire un truc stylé dans un jeu et te planter devant quelqu'un. Les astres ont regardé.", "Les planètes révèlent que t'as pleuré pour un personnage de jeu vidéo que t'admets pas avoir pleuré.", "Ton destin est une quête secondaire que le jeu t'oblige pas à faire mais que tu fais quand même à 100%.", "Les étoiles révèlent que t'as une théorie sur le lore d'un jeu qui relie tout parfaitement. Personne l'a écoutée.", "Ton chakra est le petit bruit de notification d'un jeu mobile que t'as désinstallé mais dont tu te souviens encore.", "Tu vas citer une réplique d'un jeu vidéo en pensant que c'est drôle. C'est drôle. Pour toi.", "Les planètes révèlent que ton personnage préféré est celui que tout le monde déteste sauf toi.", "Ton avenir ressemble à un jeu que les développeurs ont abandonné mais qui a une communauté de fans dévoués.", "Tu vas faire un saut de la foi dans un jeu et tomber dans le vide. Les astres avaient vu le bord.", "Les étoiles révèlent que t'as une opinion très tranchée sur quel jeu méritait plus de succès et tu la défends encore.", "Ton destin est un glitch de jeu vidéo que les développeurs ont jamais patché parce qu'ils savaient pas qu'il existait.", "Tu vas avoir les mains moites pendant un boss fight et prétendre que c'est la chaleur.", "Les planètes révèlent que t'as un skin dans un jeu que tu gardes depuis des années et que tu portes jamais parce qu'il est \"trop bien pour être gaspillé\".", "Ton aura est le bruit d'un floppy disk qui charge. Lentement. Mais il charge.", "Tu vas googler les symptômes d'une maladie de jeu vidéo dans la vraie vie. Juste pour voir.", "Les étoiles révèlent que quelque part t'as encore un Tamagotchi mort que t'as pas eu le courage de relancer.", "Ton destin est une quête buggée que tu peux plus compléter mais qui reste dans ton journal.", "Tu vas essayer d'expliquer le lore de FNAF à quelqu'un. Tu vas perdre la personne au bout de 3 minutes.", "Les planètes révèlent que ton cerveau charge ses ressources en arrière-plan depuis ce matin. Il finira ce soir peut-être.", "Ton énergie du jour : touche Echap appuyée trop longtemps pendant un cutscene obligatoire.", "Tu vas avoir un déclic sur quelque chose d'important exactement 5 secondes trop tard. Les astres avaient l'heure.", "Les étoiles révèlent que t'as un dossier de screenshots de moments de jeu que tu montreras jamais à personne.", "Ton avenir est un jeu en accès anticipé depuis 2018. Il sortira. Promis.", "Tu vas perdre un objet important dans la vraie vie et avoir le réflexe de chercher dans ton inventaire.", "Les planètes révèlent que ton chat t'a regardé jouer avec un mépris total et assumé.", "Ton destin est une fanfic de 200 chapitres sur un jeu de niche que tu suis depuis 3 ans.", "Tu vas entendre une musique et réaliser que c'est une OST de jeu vidéo que tu reconnaissais pas consciemment depuis des années.", "Les étoiles révèlent que t'as un tier list de trucs complètement inutiles quelque part. Elle est précise. Elle est juste.", "Ton chakra est un personnage en T-pose au loin qui disparaît quand tu t'approches.", "Tu vas relire des anciens messages et trouver une version de toi que tu comprends plus du tout.", "Les planètes révèlent que t'as une opinion très précise sur le meilleur ending d'un jeu et c'est pas le canon.", "Ton avenir est un ARG lancé par des devs d'un jeu indé qui ont jamais révélé si c'était intentionnel.", "Tu vas expliquer pourquoi un jeu est sous-estimé pendant 20 minutes à quelqu'un qui demandait juste le titre.", "Les étoiles révèlent que quelqu'un quelque part speed run ta vie en Any%. Il est déjà à la moitié.", "Ton destin est un mod de jeu vidéo installé par quelqu'un d'autre qui change tout sans prévenir.", "Les planètes te souhaitent bonne chance. Elles savent que t'en auras besoin. Elles savent que ça changera rien.", "<@390539577833684994> a composé une chanson sur ton destin. Elle est belle. Elle fait peur.", "<@390539577833684994> a écouté ton aura. Elle en a fait un son ambient. C'est troublant et magnifique.", "<@390539577833684994> ressemble tellement à Feldup que les planètes font encore la différence difficilement.", "<@390539577833684994> a produit le générique de ta journée. Il est court mais intense.", "Les étoiles révèlent que <@390539577833684994> a composé quelque chose qui te correspond exactement. Elle savait pas que c'était pour toi.", "<@390539577833684994> a regardé ton horoscope et a dit \"j'en ferai un sample\". Les astres sont flattés.", "Les planètes révèlent que <@390539577833684994> est simplement là, et ça suffit à améliorer la journée de tout le monde.", "<@390539577833684994> a produit le son de ton destin. Il est lo-fi, mélancolique, et étrangement beau.", "<@390539577833684994> existe et les astres trouvent ça vraiment bien pour tout le monde.", "<@899733709173948487> a analysé ton signe astrologique pendant 3h. Il a trouvé un pattern. Il dit rien pour l'instant.", "Les astres révèlent que <@899733709173948487> a classé ton signe dans son tier list Nintendo. T'es pas en S tier. Désolé.", "<@899733709173948487> a fait le lien entre ton comportement et un boss de jeu Nintendo. Il sait comment te battre.", "Les planètes révèlent que <@899733709173948487> a remarqué quelque chose dans ta façon d'agir que personne d'autre a vu. Il note tout.", "<@899733709173948487> a trouvé un easter egg caché dans ton destin. Il hésite à te le dire depuis 3 semaines.", "Les étoiles révèlent que <@899733709173948487> a une théorie sur toi. Elle est précise, documentée, et légèrement inquiétante.", "<@899733709173948487> perçoit des choses dans ton aura que les autres ratent complètement. Il observe en silence.", "Les astres indiquent que <@899733709173948487> a comparé ta journée à un niveau de jeu Nintendo. T'es bloqué au même endroit depuis un moment.", "<@899733709173948487> a détecté un comportement récurrent chez toi. Il l'a mis dans un spreadsheet. Il analyse encore.", "Les planètes révèlent que <@899733709173948487> sait exactement ce que tu vas faire ensuite. Il attendait que tu arrives là.", "<@511929490964742144> t'a envoyé un message en anglais mal orthographié. T'as mis 10 minutes à comprendre. C'était juste \"hello\".", "Les astres révèlent que <@511929490964742144> a commenté ton horoscope en anglais. \"ur futur is ded lmao\". Les planètes traduisent pas.", "<@511929490964742144> a prédit ta journée en trois mots anglais incorrects. C'était plus précis que cet horoscope entier.", "Les étoiles révèlent que <@511929490964742144> t'a envoyé un shitpost en \"english\". T'as compris à moitié. C'était suffisant.", "<@511929490964742144> a écrit quelque chose sur toi dans le salon shitpost. En anglais approximatif. Tout le monde a réagi avec 💀.", "Les planètes révèlent que <@511929490964742144> t'a dit \"ur a weirdo\" ce matin. C'était un compliment. Il confirme.", "<@511929490964742144> a résumé ton destin en un tweet mal écrit en anglais. Il a raison sur tout.", "Les astres révèlent que <@511929490964742144> pense à toi en ce moment. Il va poster quelque chose. En anglais. Avec des fautes. Sur toi.", "<@511929490964742144> a lu ton horoscope et a répondu \"gg ez\". Les étoiles sont d'accord.", "Les planètes révèlent que <@511929490964742144> a une opinion sur toi. Elle tient en 4 mots anglais mal orthographiés. Elle est juste."];
    const seed = dateKey * 100 + signIndex;
    const idx = Math.floor(seedRandom(seed) * horoscopes.length);
    return horoscopes[idx];
}


// Désactiver tous les boutons d'un message
async function disableButtons(interaction) {
    try {
        const msg = interaction.message;
        const newRows = msg.components.map(row => {
            const newRow = new ActionRowBuilder();
            newRow.addComponents(row.components.map(btn => {
                return ButtonBuilder.from(btn).setDisabled(true);
            }));
            return newRow;
        });
        await msg.edit({ components: newRows });
    } catch (e) {}
}


async function getCommitCount() {
    try {
        let page = 1;
        let total = 0;
        while (true) {
            const res = await fetch(`https://api.github.com/repos/R3GS/Cacabot/commits?path=index.js&per_page=100&page=${page}`, {
                headers: {
                    'Authorization': `token ${process.env.GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            const data = await res.json();
            if (!Array.isArray(data) || data.length === 0) break;
            total += data.length;
            if (data.length < 100) break;
            page++;
        }
        return total;
    } catch (e) {
        return null;
    }
}

async function generateLovecalcImage(avatar1Url, avatar2Url, percent) {
    const oldBackend = process.env.PANGOCAIRO_BACKEND;
    delete process.env.PANGOCAIRO_BACKEND;
    
    const canvas = createCanvas(500, 160);
    const ctx = canvas.getContext('2d');

    // Fond blanc pour forcer le contexte opaque
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 500, 160);

    // Layer 1 : background
    const bg = await loadImage('./lovecalcbg.png');
    ctx.drawImage(bg, 0, 0, 500, 160);

    // Layer 2 : carré rouge qui monte de bas en haut
    const heartTop = 42;
    const heartBottom = 118;
    const heartHeight = heartBottom - heartTop;
    const fillHeight = Math.round((percent / 100) * heartHeight);
    const fillY = heartBottom - fillHeight;
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(209, fillY, 82, fillHeight);

    // Layer 3 : photos de profil
    const av1 = await loadImage(avatar1Url);
    const av2 = await loadImage(avatar2Url);
    ctx.drawImage(av1, 25, 25, 110, 110);
    ctx.drawImage(av2, 365, 25, 110, 110);

    // Layer 4 : cadres
    const cadres = await loadImage('./lovecalccadres.png');
    ctx.drawImage(cadres, 0, 0, 500, 160);

    // Texte % au centre
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px "LemonMilk"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${percent}%`, 250, 80);

    const buffer = canvas.toBuffer('image/png');
    process.env.PANGOCAIRO_BACKEND = oldBackend;
    return buffer;
}

async function startPomodoro(channel, participantsMention, workMin, breakMin, cycle, phase, reason = 'Session de travail') {
    const isWork = phase === 'work';
    const longBreak = cycle % 4 === 0 && !isWork;
    const breakDuration = longBreak ? 15 : breakMin;
    const totalMs = (isWork ? workMin : breakDuration) * 60 * 1000;
    const endTime = Date.now() + totalMs;

    const buildEmbed = (remainingMs) => {
        const mins = Math.floor(remainingMs / 60000);
        const secs = Math.floor((remainingMs % 60000) / 1000);
        const totalDuration = isWork ? workMin : breakDuration;
        const elapsed = totalDuration - Math.ceil(remainingMs / 60000);
        const barLength = 20;
        const filled = Math.round((Math.max(0, elapsed) / totalDuration) * barLength);
        const bar = '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, barLength - filled));

        return new EmbedBuilder()
            .setColor(isWork ? 0xe74c3c : 0x2ecc71)
            .setTitle(isWork ? `🍅 ${reason}` : (longBreak ? '☕ Grande pause !' : '⏸️ Pause'))
            .setDescription(participantsMention)
            .addFields(
                { name: 'Cycle', value: `${cycle}`, inline: true },
                { name: 'Phase', value: isWork ? `Travail (${workMin} min)` : `Pause (${breakDuration} min)`, inline: true },
                { name: 'Temps restant', value: `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`, inline: true },
                { name: 'Progression', value: `\`${bar}\``, inline: false }
            )
            .setFooter({ text: '!pomodoro stop pour arrêter' });
    };

    const sentMsg = await channel.send({
        content: isWork
            ? `${participantsMention} 🍅 C'est parti pour ${workMin} minutes de travail !`
            : `${participantsMention} ${longBreak ? '☕ Grande pause de 15 minutes !' : `⏸️ Pause de ${breakDuration} minutes !`}`,
        embeds: [buildEmbed(totalMs)],
        components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`pomo_skip_${channel.id}`)
                .setLabel('⏭️ Skip')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`pomo_stop_${channel.id}`)
                .setLabel('⏹️ Stop')
                .setStyle(ButtonStyle.Danger)
        )]
    });

    const updateInterval = setInterval(async () => {
        const remainingMs = endTime - Date.now();
        if (remainingMs <= 0) { clearInterval(updateInterval); return; }
        await sentMsg.edit({ embeds: [buildEmbed(remainingMs)] }).catch(() => {});
    }, 5000);

    const nextPhase = () => {
        clearInterval(updateInterval);
        pomodoroSessions.delete(channel.id);
        sentMsg.delete().catch(() => {});
        if (isWork) {
            startPomodoro(channel, participantsMention, workMin, breakMin, cycle, 'break');
        } else {
            startPomodoro(channel, participantsMention, workMin, breakMin, cycle + 1, 'work');
        }
    };

    const timeout = setTimeout(nextPhase, totalMs);

    pomodoroSessions.set(channel.id, {
        timeout,
        updateInterval,
        skip: nextPhase,
        message: sentMsg,
        cycle,
        phase
    });
}

async function generateWantedImage(avatarUrl, displayName, primeAmount) {

    const canvas = createCanvas(977, 1273);
    const ctx = canvas.getContext('2d');

    // Charger le template
    const template = await loadImage('./wanted.png');
    ctx.drawImage(template, 0, 0, 977, 1273);

    // Charger et coller la photo de profil
    const avatar = await loadImage(avatarUrl);
    ctx.drawImage(avatar, 217, 447, 542, 542);

    // Après ctx.drawImage(avatar, 217, 447, 542, 542);

    const frame = await loadImage('./wanted-cadre.png'); // ton image de cadre
    ctx.drawImage(frame, 0, 0, 977, 1273);

    // Pseudo
    ctx.fillStyle = '#1a0a00';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const centerX = 977 / 2;
    const pseudoY = 447 + 542 + 65;
    const primeY = pseudoY + 100;

    ctx.save();
    ctx.translate(centerX, pseudoY + 20);
    ctx.scale(8, 8);
    ctx.textAlign = 'left';
    ctx.font = '17px "CowboyMovie"';
    const cleanName = displayName.toUpperCase().replace(/[^A-Z0-9+\"\+\*\/\.,; ]/g, '').trim();
    const tw = ctx.measureText(cleanName).width;
    ctx.fillText(cleanName, -(tw / 2), 0);
    ctx.restore();

    // Prime
    ctx.save();
    ctx.translate(centerX, primeY - 20);
    ctx.scale(5, 5);
    ctx.textAlign = 'left';
    ctx.font = '13px "CowboyMovie"';
    const primeClean = 'PRIME : ' + String(primeAmount).replace(/\s/g, '') + '$';
    const pw = ctx.measureText(primeClean).width;
    ctx.fillText(primeClean, -(pw / 2), 0);
    ctx.restore();

    return canvas.toBuffer('image/png');
}

// =========================
//     LISTENER MESSAGES
// =========================

    // Ping Notifs Shorts quand Gappy sort un nouveau TikTok
    client.on('messageCreate', async (message) => {
        if (message.author.id === client.user.id) {
            topData.messages['1503495713097519355'] = (topData.messages['1503495713097519355'] || 0) + 1;
            return;
        }
        if (message.author.bot) return;

        // Ping automatique du rôle quand un utilisateur spécifique poste dans un salon spécifique
        if (message.channel.id === '1460051840015269908' && message.author.id === '1525026449768321098') {
            await message.channel.send(`<@&1504492103194120273>`);
        }

        // =========================
        //   SALON DÉCODEUR D'EMOJIS
        // =========================
        if (message.channel.id === MOTUS_CHANNEL_ID && rebusSession.active && rebusSession.currentItem && !message.content.startsWith('!')) {
            if (await verifierReponseRebus(message)) return;

            // Renvoie l'embed original tous les 15 messages sans bonne réponse
            rebusSession.compteurMessages = (rebusSession.compteurMessages || 0) + 1;
            if (rebusSession.compteurMessages >= 15) {
                rebusSession.compteurMessages = 0;
                const embedRappel = buildRebusEmbed(rebusSession.manche, rebusSession.currentItem, rebusSession.expireAt);
                await message.channel.send({ content: '🔔 **Rappel du rébus à deviner :**', embeds: [embedRappel] });
            }
        }

        // =========================
        //     SALON MOTUS DU JOUR
        // =========================
        if (message.channel.id === MOTUS_CHANNEL_ID && !message.content.startsWith('!')) {
            const now = Date.now();

            // Si aucune session n'est en cours, qu'elle est déjà finie ou expirée : on ignore totalement le message
            if (!motusData.mot || motusData.termine || (motusData.expireAt && now >= motusData.expireAt)) {
                if (!motusData.termine && motusData.expireAt && now >= motusData.expireAt) {
                    motusData.termine = true;
                    demanderSauvegarde();
                }
                return;
            }

            const rawGuess = message.content.trim().toUpperCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .replace(/[^A-Z]/g, "");

            const longueurAttendue = motusData.longueur || 6;

            // Ignore strictement les messages qui ne font pas exactement la bonne longueur (6 lettres à 10h, 7 lettres à 19h)
            if (rawGuess.length === longueurAttendue) {
                const motDuJour = motusData.mot;

                if (!motusData.tentatives[message.author.id]) {
                    motusData.tentatives[message.author.id] = [];
                }

                const userTries = motusData.tentatives[message.author.id];
                if (userTries.length >= 3) {
                    await message.reply(`❌ <@${message.author.id}>, tu as déjà utilisé tes **3 essais** pour cette session ! Laisse les autres membres tenter leur chance.`);
                    return;
                }

                userTries.push(rawGuess);
                const essaiNum = userTries.length;

                // Mise à jour des statistiques
                if (!motusStats[message.author.id]) motusStats[message.author.id] = { victoires: 0, parties: 0 };
                if (essaiNum === 1) motusStats[message.author.id].parties++;

                const grille = evaluerMotus(rawGuess, motDuJour, longueurAttendue);
                const lettresEspacées = rawGuess.split('').join(' ');

                const rowOriginal = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`motus_show_original_${motusData.dateKey}`)
                        .setLabel("📜 Voir l'énoncé de la session")
                        .setStyle(ButtonStyle.Secondary)
                );

                // Lettres absentes testées par ce joueur
                const toutesLettresTentees = new Set(userTries.flatMap(t => t.split('')));
                const lettresAbsentes = [...toutesLettresTentees]
                    .filter(l => !motDuJour.includes(l))
                    .sort()
                    .join(' ');

                const ligneAbsentes = lettresAbsentes.length > 0 
                    ? `\n> ❌ **Lettres absentes :** \`${lettresAbsentes}\`` 
                    : '';

                if (rawGuess === motDuJour) {
                    motusData.termine = true;
                    motusData.vainqueurId = message.author.id;
                    motusStats[message.author.id].victoires++;
                    demanderSauvegarde();

                    await message.reply({
                        content: `**${lettresEspacées}**\n${grille} *(Essai ${essaiNum}/3)*`,
                        components: [rowOriginal]
                    });

                    const prochainRdv = motusData.heureSession === 10 
                        ? 'Rendez-vous ce soir à 19h00 pour le Motus difficile (7 lettres) !' 
                        : 'Rendez-vous demain à 10h00 pour le prochain Motus !';

                    const embedVictoire = new EmbedBuilder()
                        .setColor(0x2ecc71)
                        .setTitle('🎉 MOTUS TROUVÉ ! 🎉')
                        .setDescription(
                            `Félicitations à <@${message.author.id}> qui a trouvé le mot en **${essaiNum} essai${essaiNum > 1 ? 's' : ''}** !\n\n` +
                            `🔤 **Le mot était :** \`${motDuJour}\` (${longueurAttendue} lettres)\n` +
                            `🏆 **Total de victoires :** **${motusStats[message.author.id].victoires}**`
                        )
                        .setFooter({ text: prochainRdv });

                    const rowStats = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`motus_view_stats_${message.author.id}`)
                            .setLabel('📊 Mes stats Motus')
                            .setStyle(ButtonStyle.Primary)
                    );

                    await message.channel.send({ embeds: [embedVictoire], components: [rowStats] });
                    return;
                } else {
                    demanderSauvegarde();
                    const infoReste = essaiNum === 3 
                        ? `\n-# *Tu as épuisé tes 3 essais pour cette session !*`
                        : `\n-# *Il te reste ${3 - essaiNum} essai${(3 - essaiNum) > 1 ? 's' : ''} !*`;

                    await message.reply({
                        content: `**${lettresEspacées}**\n${grille} *(Essai ${essaiNum}/3)*${ligneAbsentes}${infoReste}`,
                        components: [rowOriginal]
                    });
                    return;
                }
            }
        }

    // Supprimer le message précédent si Shin poste sa pub Twitch dans le salon #Promo
    const REPOST_WATCH_USER = '1070742213635625050';
    const REPOST_WATCH_CHANNEL = '1230637295649034240';

        if (message.author.id === REPOST_WATCH_USER && message.channel.id === REPOST_WATCH_CHANNEL) {
        const contientLien = message.content.includes('https://www.twitch.tv/belrose_shin');

        if (contientLien) {
            const cle = `${message.channel.id}-${message.author.id}`;
            const precedent = dernierMessageParUtilisateur.get(cle);

            if (precedent) {
                await precedent.delete().catch(() => {});
            }

            dernierMessageParUtilisateur.set(cle, message);
        }
    }

    // !chut / !unchut
    const CHUT_AUTHORIZED = ['738191002187202630', '436218312574107658', '1070742213635625050', '899733709173948487', '375746968737021962', '116682911314345993'];
    const chutCommand = message.content.trim().split(/\s+/)[0]?.toLowerCase();

    if (chutCommand === '!chut') {
        if (!CHUT_AUTHORIZED.includes(message.author.id)) {
            return message.reply("Tu n'es pas autorisé.e à faire cette commande.");
        }
        const args = message.content.trim().split(/\s+/);
        const timeStr = args[1]?.toLowerCase();
        let ms = 0;
        if (timeStr?.endsWith('min')) ms = parseInt(timeStr) * 60 * 1000;
        else if (timeStr?.endsWith('h')) ms = parseInt(timeStr) * 60 * 60 * 1000;
        else return message.reply('Format invalide ! Utilise `!chut Xmin` ou `!chut Xh`. Ex : `!chut 10min`');
        if (isNaN(ms) || ms <= 0) return message.reply('Durée invalide !');
        if (ms > 24 * 60 * 60 * 1000) return message.reply('Maximum 24h !');

        const ancien = mutedChannels.get(message.channel.id);
        if (ancien) clearTimeout(ancien.timeout);

        const until = Date.now() + ms;
        const timeout = setTimeout(() => mutedChannels.delete(message.channel.id), ms);
        mutedChannels.set(message.channel.id, { until, timeout });
        return message.react('🤐').catch(() => {});
    }

    if (chutCommand === '!unchut') {
        if (!CHUT_AUTHORIZED.includes(message.author.id)) {
            return message.reply("Tu n'es pas autorisé.e à faire cette commande.");
        }
        const ancien = mutedChannels.get(message.channel.id);
        if (ancien) clearTimeout(ancien.timeout);
        mutedChannels.delete(message.channel.id);
        return message.react('👋').catch(() => {});
    }

        // !stop / !unstop / "Cacabot stop" / "Cacabot reviens" (accessible à tout le monde, 1h fixe)
    const STOP_DURATION_MS = 60 * 60 * 1000;
    const stopCommand = message.content.trim().split(/\s+/)[0]?.toLowerCase();
    const stopCleaned = message.content
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();

    const isStopTrigger = stopCommand === '!stop' || /\bcacabot\s+stop\b/.test(stopCleaned);
    const isUnstopTrigger = stopCommand === '!unstop' || /\bcacabot\s+reviens\b/.test(stopCleaned);

    // =========================
    // COMMANDES ADMIN ROULETTE (Epsys uniquement)
    // =========================
    const adminSuccesAliases = ['!roulettesuccesforce', '!rltsuccesforce', '!roulettesuccessforce', '!rltsuccessforce'];
    const rouletteAdminCommand = message.content.trim().split(" ")[0]?.toLowerCase();
    if (['!reroll', '!bonusforce', '!malusforce', '!rouletteid', '!rltid', '!resetroulettestate', '!resetrlt', '!removestate', ...adminSuccesAliases].includes(rouletteAdminCommand)) {
        if (message.author.id !== EPSYS_ID) {
            return message.reply("Cette commande est réservée à Epsys.");
        }

        const argsBruts = message.content.trim().split(" ").slice(1);

        if (rouletteAdminCommand === '!reroll') {
            const query = argsBruts.join(" ");
            const cible = message.mentions.members.first() ?? findMemberByName(message.guild, query).found;
            if (!cible) return message.reply("Membre introuvable.");
            rouletteCooldowns.delete(cible.id);
            rouletteFreeRollUntil.delete(cible.id);
            return message.reply(`Le cooldown de <@${cible.id}> a été réinitialisé ! ✅`);
        }

        if (rouletteAdminCommand === '!rouletteid' || rouletteAdminCommand === '!rltid') {
            const embed = buildRouletteTypeEmbed('bonus')
                .setDescription(
                    "`!bonusforce [id] [membre]` / `!malusforce [id] [membre]` — impose un résultat.\n" +
                    "Exemple : `!bonusforce couronne @Sasha`\n\n" +
                    buildRouletteTypeEmbed('bonus').data.description
                );
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`roulette_id_bonus_${message.author.id}`).setLabel('🎉 Bonus').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`roulette_id_malus_${message.author.id}`).setLabel('💀 Malus').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId(`roulette_id_special_${message.author.id}`).setLabel('✨ Spécial').setStyle(ButtonStyle.Secondary)
            );
            return message.reply({ embeds: [embed], components: [row] });
        }

        if (rouletteAdminCommand === '!bonusforce' || rouletteAdminCommand === '!malusforce') {
            const nom = argsBruts[0]?.toLowerCase();
            const query = argsBruts.slice(1).join(" ");
            const outcomeId = ROULETTE_NOMS_COMMANDES[nom];
            if (!outcomeId) return message.reply(`Nom inconnu. Fais \`!rltid\` pour voir la liste.`);
            const attendBonus = rouletteAdminCommand === '!bonusforce';
            const estSpecial = outcomeId.startsWith('special-');
            if (!estSpecial && attendBonus && !outcomeId.startsWith('bonus-')) return message.reply("Ce nom correspond à un malus, pas un bonus. Utilise `!malusforce`.");
            if (!estSpecial && !attendBonus && !outcomeId.startsWith('malus-')) return message.reply("Ce nom correspond à un bonus, pas un malus. Utilise `!bonusforce`.");

            const cible = message.mentions.members.first() ?? findMemberByName(message.guild, query).found;
            if (!cible) return message.reply("Membre introuvable.");

            const proxy = { member: cible, channel: message.channel, guild: message.guild };
            const texte = await appliquerEtDecrireResultat(outcomeId, proxy, cible.displayName, 0);
            const entryForcee = ROULETTE_TABLE.find(e => e.id === outcomeId);
            if (attendBonus) envoyerHallOfFame(message.guild, cible, entryForcee).catch(() => {});
            if (proxy.vote) {
                const envoye = await message.reply({ embeds: [buildVoteRouletteEmbed(proxy.vote)] });
                return demarrerVoteRoulette(envoye, proxy.vote);
            }
            const embed = buildRouletteResultEmbed(outcomeId, texte);
            return message.reply({ embeds: [embed] });
        }

        if (adminSuccesAliases.includes(rouletteAdminCommand)) {
            const sub = argsBruts[0]?.toLowerCase();

            // 1. Simulation d'un déblocage de succès (Test)
            if (sub === 'test') {
                const randomAch = ROULETTE_ACHIEVEMENTS[Math.floor(Math.random() * ROULETTE_ACHIEVEMENTS.length)];
                const embedTest = new EmbedBuilder()
                    .setColor(0xffd700)
                    .setTitle('🎊 SUCCÈS DÉVERROUILLÉ ! (TEST)')
                    .setDescription(`<@${message.author.id}> vient d'obtenir le succès **${randomAch.emoji} ${randomAch.nom}** !\n\n*📂 ${randomAch.desc}*`)
                    .setImage('https://cdn.discordapp.com/attachments/1480756332373213275/1555806751448629410/achievement-unlocked_1.gif');

                const rowTest = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`rlt_achs_${message.author.id}_0_${message.author.id}`)
                        .setLabel('🎖️ Succès')
                        .setStyle(ButtonStyle.Secondary)
                );
                return message.channel.send({ embeds: [embedTest], components: [rowTest] });
            }

            // 2. Sans argument : Afficher la liste complète des 30 IDs
            if (!sub) {
                const lignes = ROULETTE_ACHIEVEMENTS.map(a => `${a.emoji} **${a.nom}** — \`${a.id}\``);
                const embedList = new EmbedBuilder()
                    .setColor(0xffd700)
                    .setTitle('🎖️ Identifiants des 30 Succès de la Roulette')
                    .setDescription(
                        "**Commandes :**\n" +
                        "• `!rltsucces [id] [membre]` — Attribuer un succès à un·e membre\n" +
                        "• `!rltsucces test` — Simuler une annonce de succès en direct\n\n" +
                        "**Liste des IDs disponibles :**\n" +
                        lignes.join('\n')
                    );
                return message.reply({ embeds: [embedList] });
            }

            // 3. Donner un succès spécifique à un membre : !rltsucces [id] [membre]
            const ach = ROULETTE_ACHIEVEMENTS.find(a => a.id.toLowerCase() === sub);
            if (!ach) {
                return message.reply(`Identifiant inconnu : \`${sub}\`.\nTape simplement \`!rltsucces\` pour consulter les 30 identifiants valides.`);
            }

            const queryMembre = argsBruts.slice(1).join(" ");
            const cible = message.mentions.members.first() ?? (queryMembre ? findMemberByName(message.guild, queryMembre).found : message.member);
            if (!cible) return message.reply("Membre introuvable.");

            let userAchs = rouletteAchievements.get(cible.id);
            if (!userAchs) {
                userAchs = {};
                rouletteAchievements.set(cible.id, userAchs);
            }

            userAchs[ach.id] = Date.now();
            rouletteAchievements.set(cible.id, userAchs);
            demanderSauvegarde();

            // Envoi de l'embed officiel de déblocage avec le GIF et le bouton
            const embedUnlock = new EmbedBuilder()
                .setColor(0xffd700)
                .setTitle('🎊 SUCCÈS DÉVERROUILLÉ !')
                .setDescription(`<@${cible.id}> vient d'obtenir le succès **${ach.emoji} ${ach.nom}** !\n\n*📂 ${ach.desc}*`)
                .setImage('https://cdn.discordapp.com/attachments/1480756332373213275/1555806751448629410/achievement-unlocked_1.gif');

            const rowUnlock = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`rlt_achs_${cible.id}_0_${cible.id}`)
                    .setLabel('🎖️ Succès')
                    .setStyle(ButtonStyle.Secondary)
            );

            await message.channel.send({ embeds: [embedUnlock], components: [rowUnlock] });
            return message.reply(`✅ Le succès **${ach.nom}** a été débloqué et enregistré pour <@${cible.id}> !`);
        }

        if (rouletteAdminCommand === '!resetroulettestate' || rouletteAdminCommand === '!resetrlt') {
            const query = argsBruts.join(" ");
            const cible = message.mentions.members.first() ?? findMemberByName(message.guild, query).found;
            if (!cible) return message.reply("Membre introuvable.");

            rouletteCouronneUntil.delete(cible.id);
            rouletteRedirectCharges.delete(cible.id);
            rouletteCooldownCourtCharges.delete(cible.id);
            rouletteFreeRollUntil.delete(cible.id);
            rouletteUwuUntil.delete(cible.id);
            rouletteLettreInterdite.delete(cible.id);
            rouletteEmojiUntil.delete(cible.id);
            rouletteLeetUntil.delete(cible.id);
            rouletteTransfos.delete(cible.id);
            rouletteCooldown45Charges.delete(cible.id);
            rouletteBouclierActif.delete(cible.id);
            rouletteRedirectChoixCible.delete(cible.id);
            rouletteImmuniteUntil.delete(cible.id);

            if (roulettePseudoLock.has(cible.id)) {
                roulettePseudoLock.delete(cible.id);
                await cible.setNickname(null).catch(() => {});
            }
            if (rouletteTimeoutUntil.has(cible.id)) {
                rouletteTimeoutUntil.delete(cible.id);
                await cible.timeout(null).catch(() => {});
            }

            await saveAll();
            return message.reply(`L'état roulette de <@${cible.id}> a été entièrement réinitialisé.`);
        }

        if (rouletteAdminCommand === '!removestate') {
            const nom = argsBruts[argsBruts.length - 1]?.toLowerCase();
            const query = argsBruts.slice(0, -1).join(" ");
            const cible = message.mentions.members.first() ?? findMemberByName(message.guild, query).found;
            if (!cible) return message.reply("Membre introuvable.");

            switch (nom) {
                case 'couronne':
                    rouletteCouronneUntil.delete(cible.id);
                    break;
                case 'cooldown-court':
                    rouletteCooldownCourtCharges.delete(cible.id);
                    break;
                case 'pseudo-lock':
                    roulettePseudoLock.delete(cible.id);
                    await cible.setNickname(null).catch(() => {});
                    break;
                case 'redirect':
                    rouletteRedirectCharges.delete(cible.id);
                    break;
                case 'cooldown-zero':
                    rouletteFreeRollUntil.delete(cible.id);
                    break;
                case 'timeout':
                    if (!rouletteTimeoutUntil.has(cible.id) || Date.now() >= rouletteTimeoutUntil.get(cible.id)) {
                        return message.reply("Cette personne n'a pas de timeout actif venant de la roulette.");
                    }
                    rouletteTimeoutUntil.delete(cible.id);
                    await cible.timeout(null).catch(() => {});
                    break;
                case 'uwu':
                    rouletteUwuUntil.delete(cible.id);
                    break;
                case 'lettre':
                    rouletteLettreInterdite.delete(cible.id);
                    break;
                case 'emoji':
                    rouletteEmojiUntil.delete(cible.id);
                    break;
                case 'leet':
                    rouletteLeetUntil.delete(cible.id);
                    break;
                case 'transfo':
                    rouletteTransfos.delete(cible.id);
                    break;
                case 'cooldown45':
                    rouletteCooldown45Charges.delete(cible.id);
                    break;
                case 'bouclier':
                    rouletteBouclierActif.delete(cible.id);
                    break;
                case 'redirect-choix':
                    rouletteRedirectChoixCible.delete(cible.id);
                    break;
                case 'immunite':
                    rouletteImmuniteUntil.delete(cible.id);
                    break;
                default:
                    return message.reply("Nom inconnu. Options : `couronne`, `transfo`, `pseudo-lock`, `redirect`, `redirect-choix`, `cooldown-zero`, `cooldown45`, `cooldown-court`, `timeout`, `leet`, `uwu`, `lettre`, `emoji`, `bouclier`, `immunite`.");
            }
            await saveAll();            
            return message.reply(`\`${nom}\` a été retiré de <@${cible.id}>.`);
        }
    }

    if (isStopTrigger) {
        const ancien = mutedChannels.get(message.channel.id);
        if (ancien) clearTimeout(ancien.timeout);

        const until = Date.now() + STOP_DURATION_MS;
        const timeout = setTimeout(() => mutedChannels.delete(message.channel.id), STOP_DURATION_MS);
        mutedChannels.set(message.channel.id, { until, timeout });
        return message.react('🤐').catch(() => {});
    }

    if (isUnstopTrigger) {
        const ancien = mutedChannels.get(message.channel.id);
        if (ancien) clearTimeout(ancien.timeout);
        mutedChannels.delete(message.channel.id);
        return message.react('👋').catch(() => {});
    }

        // Anti-phishing (Faux Nitro / Liens de vol de compte)
    if (message.guild && message.member && !estModo(message.member) && PHISHING_REGEX.test(message.content)) {
        await message.delete().catch(() => {});
        await message.member.timeout(24 * 60 * 60 * 1000, 'Anti-phishing automatique (lien frauduleux)').catch(() => {});
        
        await message.channel.send(`🛡️ **${message.member.displayName}** a envoyé un lien frauduleux (compte probablement piraté). Il a été mis en pause 24h.`);

        const modChan = message.guild.channels.cache.get(MOD_CHANNEL_ID);
        if (modChan) {
            const embedPhish = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('🚨 ALERTE PHISHING / FAUX NITRO')
                .setDescription(`Un lien malveillant a été stoppé net dans <#${message.channel.id}>.`)
                .addFields(
                    { name: '👤 Auteur', value: `<@${message.author.id}> (\`${message.author.id}\`)`, inline: true },
                    { name: '🔗 Contenu bloqué', value: `\`\`\`${message.content.slice(0, 500)}\`\`\``, inline: false }
                )
                .setTimestamp();

            const banBtn = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`antiphish_ban_${message.author.id}`)
                    .setLabel('🔨 Bannir le compte piraté')
                    .setStyle(ButtonStyle.Danger)
            );
            await modChan.send({ embeds: [embedPhish], components: [banBtn] });
        }
        return;
    }

    // Slowmode d'urgence automatique (anti-débordement)
    if (message.guild && !message.author.bot && message.channel.type === ChannelType.GuildText && !slowmodeActifs.has(message.channel.id)) {
        const now = Date.now();
        const logs = (slowmodeTrackers.get(message.channel.id) || []).filter(e => now - e.timestamp < 8000);
        logs.push({ userId: message.author.id, timestamp: now });
        slowmodeTrackers.set(message.channel.id, logs);

        const auteursUniques = new Set(logs.map(e => e.userId));
        // Si 15 messages ou plus en 8 secondes par au moins 3 personnes différentes
        if (logs.length >= 15 && auteursUniques.size >= 3) {
            slowmodeActifs.add(message.channel.id);
            slowmodeTrackers.delete(message.channel.id);

            const ancienSlowmode = message.channel.rateLimitPerUser || 0;
            await message.channel.setRateLimitPerUser(10, 'Slowmode d\'urgence automatique').catch(() => {});

            await message.channel.send('🛑 **Oula, le salon s\'emballe !** Slowmode temporaire de **10 secondes** activé pendant **3 minutes** pour apaiser les esprits.');

            setTimeout(async () => {
                await message.channel.setRateLimitPerUser(ancienSlowmode, 'Fin du slowmode d\'urgence').catch(() => {});
                slowmodeActifs.delete(message.channel.id);
                await message.channel.send('✅ **Fin du slowmode d\'urgence**, retour au rythme normal !').catch(() => {});
            }, 3 * 60 * 1000);
        }
    }

        // Anti-spam
    if (
        message.guild && message.member &&
        !CHUT_AUTHORIZED.includes(message.author.id) &&
        !SPAM_EXEMPT_CHANNELS.includes(message.channel.id) &&
        !SPAM_EXEMPT_REGEX.test(message.content.trim())
    ) {
        const now = Date.now();
        const spamTimestamps = (spamTracker.get(message.author.id) || []).filter(t => now - t < SPAM_WINDOW_MS);
        spamTimestamps.push(now);
        spamTracker.set(message.author.id, spamTimestamps);

        if (spamTimestamps.length >= SPAM_THRESHOLD) {
            spamTracker.delete(message.author.id);
            try {
                await message.member.timeout(SPAM_TIMEOUT_MS, 'Anti-spam automatique');
                await message.channel.send(`🔇 **${message.member.displayName}** a été mis en pause **5 minutes** pour spam.`);
            } catch (err) {
                console.error('Erreur timeout anti-spam:', err);
            }
        }
    }

    // Anti-raid : timeout au 1er message d'un compte flaggé pendant une rafale
    if (message.guild && message.member && raidFlaggedUsers.has(message.author.id)) {
        raidFlaggedUsers.delete(message.author.id);
        try {
            await message.member.timeout(RAID_TIMEOUT_MS, 'Anti-raid automatique').catch(() => {});
            raidMuteRecord.set(message.author.id, Date.now() + RAID_TIMEOUT_MS);
            await message.channel.send(`🚨 **${message.member.displayName}** fait partie d'une vague d'arrivées suspectes et a été mis en pause **5 minutes**.`);
            await message.member.send("Ton compte a été repéré dans une vague d'arrivées suspectes sur le serveur, tu as été mis en pause 5 minutes. Si tu quittes et reviens dans les 15 minutes qui suivent la fin de cette pause, tu seras automatiquement exclu du serveur.").catch(() => {});

            const modLogChan = message.guild.channels.cache.get(MOD_CHANNEL_ID);
            if (modLogChan) {
                const raidEmbed = new EmbedBuilder()
                    .setColor(0xff0033)
                    .setTitle('🚨 ALERTE ANTI-RAID')
                    .setDescription(`Un compte suspect a tenté d'écrire pendant une vague d'arrivées et a été mis en pause 5 min.`)
                    .addFields(
                        { name: '👤 Suspect', value: `<@${message.author.id}> (\`${message.author.id}\`)`, inline: true },
                        { name: '📍 Salon ciblé', value: `<#${message.channel.id}>`, inline: true },
                        { name: '💬 Premier message', value: `\`\`\`${message.content.slice(0, 500) || '*Vide / Média*'}\`\`\``, inline: false }
                    )
                    .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                    .setTimestamp();

                const raidButtons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`mod_action_kick_${message.author.id}`).setLabel('👢 Expulser').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId(`mod_action_ban_${message.author.id}`).setLabel('🔨 Bannir').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId(`mod_action_dismiss_${message.author.id}`).setLabel('✅ Ignorer').setStyle(ButtonStyle.Success)
                );
                await modLogChan.send({ embeds: [raidEmbed], components: [raidButtons] });
            }
        } catch (err) {
            console.error('Erreur timeout anti-raid:', err);
        }
    }

    // Ping Cacabot seul -> "Quoi ? (Feur)"
    const strippedMsg = message.content.replace(/<@!?1503495713097519355>/g, '').trim();
    if (!isChannelMuted(message.channel.id) && message.content.includes('1503495713097519355') && strippedMsg.length === 0) {
        const finAf = rouletteAntiFeurUntil.get(message.author.id);
        if (finAf && Date.now() < finAf) {
            const d = (rouletteAntiFeurDodges.get(message.author.id) || 0) + 1;
            rouletteAntiFeurDodges.set(message.author.id, d);
            if (d >= 5) deverrouillerSucces(message.author.id, 'tete-dure', message.channel);
            return message.react('🛡️').catch(() => {});
        }
        return message.reply('Quoi ? (Feur)');
    }
    // Cheh
    const cleanedCheh = message.content.toLowerCase().trim();
    if (!isChannelMuted(message.channel.id) && pendingCheh.has(message.channel.id) && (cleanedCheh.includes('ntm') || cleanedCheh.includes('tg') || cleanedCheh.includes('nique ta') || cleanedCheh.includes('ta gueule') || cleanedCheh.includes('jte bz') || cleanedCheh.includes('bztmr') || cleanedCheh.includes('va te faire enculer') || cleanedCheh.includes('la ferme') || cleanedCheh.includes('tais-toi') || cleanedCheh.includes('mange tes'))) {
        pendingCheh.delete(message.channel.id);
        return message.reply(CHEH_GIF);
    }

    // Remplacement liens Instagram (Reels + Posts)
    const instaRegex = /https?:\/\/(?:www\.)?instagram\.com\/(?:reel|p)\/[^\s]+/gi;
    const instaMatches = message.content.match(instaRegex);
    if (instaMatches) {
        const auteurNom = message.member?.displayName ?? message.author.username;
        const liensConvertis = instaMatches.map(url => url.replace('instagram.com', 'kkinstagram.com'));

        const row = new ActionRowBuilder().addComponents(
            instaMatches.slice(0, 5).map((url, i) =>
                new ButtonBuilder()
                    .setLabel(instaMatches.length > 1 ? `🔗 Lien original ${i + 1}` : '🔗 Lien original')
                    .setStyle(ButtonStyle.Link)
                    .setURL(url)
            )
        );

        await message.delete().catch(() => {});
        await message.channel.send(`**${auteurNom}** a reposté cette publication Instagram !\n-# *(je change juste le lien pour que tout le monde y ait accès)*`);
        setTimeout(() => {
            message.channel.send({ content: liensConvertis.join('\n'), components: [row] }).catch(() => {});
        }, 300);
        return;
    }

    // Remplacement liens TikTok
    const tiktokRegex = /https?:\/\/(?:vm\.|vt\.|www\.|m\.)?tiktok\.com\/[^\s]+/gi;
    const tiktokMatches = message.content.match(tiktokRegex);
    if (tiktokMatches) {
        const auteurNom = message.member?.displayName ?? message.author.username;
        const convertUrl = (url) => url.replace(/(?:vm\.|vt\.|www\.|m\.)?tiktok\.com/i, (match) => {
            if (/^vm\./i.test(match)) return 'vm.kktiktok.com';
            if (/^vt\./i.test(match)) return 'vt.kktiktok.com';
            if (/^m\./i.test(match)) return 'm.kktiktok.com';
            if (/^www\./i.test(match)) return 'www.kktiktok.com';
            return 'kktiktok.com';
        });
        const liensConvertis = tiktokMatches.map(convertUrl);
        await message.delete().catch(() => {});
        await message.channel.send(`**${auteurNom}** a reposté ce TikTok !\n-# *(je change juste le lien pour que tout le monde y ait accès)*`);
        setTimeout(() => {
            message.channel.send(liensConvertis.join('\n')).catch(() => {});
        }, 300);
        return;
    }

    // Comptage messages pour !top
    if (message.guild && message.guild.id === '720057528351850547') {
        const uid = message.author.id;
        if (!topData.messages[uid]) topData.messages[uid] = 0;
        topData.messages[uid]++;

        // Sauvegarde tous les 75 messages
        messagesSinceLastsaveSave++;
        if (messagesSinceLastsaveSave >= 75) {
            messagesSinceLastsaveSave = 0;
            saveAll();
        }

        const todayKey = getTodayKey();
        if (!dailyData[todayKey]) dailyData[todayKey] = {};
        if (!dailyData[todayKey][uid]) dailyData[todayKey][uid] = 0;
        dailyData[todayKey][uid]++;

        const weekKey = getWeekKey();
        if (!weeklyData[weekKey]) weeklyData[weekKey] = {};
        if (!weeklyData[weekKey][uid]) weeklyData[weekKey][uid] = 0;
        weeklyData[weekKey][uid]++;

        const monthKey = getMonthKey();
        if (!monthlyData[monthKey]) monthlyData[monthKey] = {};
        if (!monthlyData[monthKey][uid]) monthlyData[monthKey][uid] = 0;
        monthlyData[monthKey][uid]++;
    }

    const response = FEUR_IMMUNE.includes(message.author.id) ? null : getResponse(message.content);

    const isExplicitCommand = message.content.trim().startsWith('!');
    if (isChannelMuted(message.channel.id) && !isExplicitCommand) {
        return;
    }

    if (response === null || response === undefined) return;

if (response?.needsLastVideo) {
    const query = message.content.trim().split(/\s+/).slice(1).join(' ');
    if (!query) return message.reply("Usage : `!last [nom ou URL de la chaîne]`");

    try {
        let channelId = null;
        const urlMatch = query.match(/(?:youtube\.com\/(?:channel\/|c\/|@)|@)([a-zA-Z0-9_-]+)/);
        const handle = urlMatch ? urlMatch[1] : null;

        if (query.includes('youtube.com/channel/')) {
            channelId = query.split('channel/')[1].split(/[/?]/)[0];
        } else {
            const searchTerm = handle ?? query;
            const forHandleRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(searchTerm.replace('@', ''))}&key=${process.env.YOUTUBE_API_KEY}`);
            const forHandleData = await forHandleRes.json();

            if (forHandleData.items && forHandleData.items.length > 0) {
                channelId = forHandleData.items[0].id;
            } else {
                const searchRes = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(searchTerm)}&type=channel&maxResults=1&key=${process.env.YOUTUBE_API_KEY}`);
                const searchData = await searchRes.json();
                if (searchData.items && searchData.items.length > 0) {
                    channelId = searchData.items[0].snippet.channelId;
                }
            }
        }

        if (!channelId) return message.reply("Chaîne introuvable !");

        const latestRes = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&maxResults=1&type=video&key=${process.env.YOUTUBE_API_KEY}`);
        const latestData = await latestRes.json();

        if (!latestData.items || latestData.items.length === 0) return message.reply("Aucune vidéo trouvée pour cette chaîne !");

        const video = latestData.items[0];
        const videoId = video.id.videoId;

        const detailRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoId}&key=${process.env.YOUTUBE_API_KEY}`);
        const detailData = await detailRes.json();
        const fullVideo = detailData.items[0];

        const duration = fullVideo.contentDetails.duration
            .replace('PT', '').replace('H', 'h ').replace('M', 'min ').replace('S', 's');
        const views = parseInt(fullVideo.statistics.viewCount).toLocaleString('fr-FR');
        const date = new Date(video.snippet.publishedAt).toLocaleDateString('fr-FR', {
            day: 'numeric', month: 'long', year: 'numeric'
        });

        const embed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle(decodeHtmlEntities(video.snippet.title))
            .setURL(`https://www.youtube.com/watch?v=${videoId}`)
            .setThumbnail(video.snippet.thumbnails.high.url)
            .addFields(
                { name: '📺 Chaîne', value: video.snippet.channelTitle, inline: true },
                { name: '⏱️ Durée', value: duration, inline: true },
                { name: '👁️ Vues', value: views, inline: true },
                { name: '📅 Publié le', value: date, inline: true }
            )

        const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
        .setLabel('🔗 Ouvrir')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://www.youtube.com/watch?v=${videoId}`),
    new ButtonBuilder()
        .setCustomId(`yt_close_${message.author.id}`)
        .setLabel('❌ Fermer')
        .setStyle(ButtonStyle.Danger)
);

return message.reply({ embeds: [embed], components: [row] });

    } catch (e) {
        console.error('Erreur !last:', e);
        return message.reply("Erreur lors de la récupération.");
    }
}

    // !animal
    if (response?.needsMention) {
        const args = message.content.trim().split(/\s+/).slice(1).join(" ");
        if (!message.mentions.users.first() && args.length > 0) {
            const result = findMemberByName(message.guild, args);
            if (result.multiple) {
                askDisambiguation(message, message.guild, result.candidates, (user) => {
                    message.reply(getAnimalResponse(message, user));
                });
                return;
            }
            if (result.found) {
                return message.reply(getAnimalResponse(message, result.found.user));
            }
        }
        return message.reply(getAnimalResponse(message));
    }

    // !suggestion
    if (response?.needsSuggestion) {
        const SUGGESTION_CHANNEL_ID = '720079866199801937';
        if (message.channel.id !== SUGGESTION_CHANNEL_ID) {
            return message.channel.send(`💡 <@${message.author.id}>, les suggestions se font uniquement dans le salon <#${SUGGESTION_CHANNEL_ID}> !`);
        }

        const texte = message.content.trim().split(/\s+/).slice(1).join(" ");
        if (!texte) {
            return message.reply("Usage : `!suggestion [ton idée/proposition]`\nExemple : `!suggestion Créer un salon Meubles IKEA`");
        }

        const data = {
            authorId: message.author.id,
            texte: texte,
            pour: [],
            contre: []
        };

        const embed = buildSuggestionEmbed(data, message.member);
        const row = buildSuggestionRow(data);

        await message.delete().catch(() => {});
        const sent = await message.channel.send({ embeds: [embed], components: [row] });

        suggestionsData.set(sent.id, data);
        demanderSauvegarde();
        return;
    }

    // !stats
    if (response?.needsStats) {
    const query = message.content.trim().split(/\s+/).slice(1).join(' ');
    if (!query) return message.reply("Usage : `!stats [nom ou URL de la chaîne]`");

    const formatNumber = (num) => {
        const n = parseInt(num);
        if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace('.0', '') + ' Md';
        if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + ' M';
        if (n >= 1_000) return (n / 1_000).toFixed(1).replace('.0', '') + ' k';
        return n.toLocaleString('fr-FR');
    };

    try {
        let channelId = null;

        // Détection d'une URL/handle YouTube
        const urlMatch = query.match(/(?:youtube\.com\/(?:channel\/|c\/|@)|@)([a-zA-Z0-9_-]+)/);
        const handle = urlMatch ? urlMatch[1] : null;

        if (query.includes('youtube.com/channel/')) {
            channelId = query.split('channel/')[1].split(/[/?]/)[0];
        } else {
            // Recherche par handle ou nom approximatif
            const searchTerm = handle ?? query;
            const forHandleRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(searchTerm.replace('@', ''))}&key=${process.env.YOUTUBE_API_KEY}`);
            const forHandleData = await forHandleRes.json();

            if (forHandleData.items && forHandleData.items.length > 0) {
                channelId = forHandleData.items[0].id;
            } else {
                const searchRes = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(searchTerm)}&type=channel&maxResults=1&key=${process.env.YOUTUBE_API_KEY}`);
                const searchData = await searchRes.json();
                if (searchData.items && searchData.items.length > 0) {
                    channelId = searchData.items[0].snippet.channelId;
                }
            }
        }

        if (!channelId) return message.reply("Chaîne introuvable !");

        const detailRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,brandingSettings&id=${channelId}&key=${process.env.YOUTUBE_API_KEY}`);
        const detailData = await detailRes.json();

        if (!detailData.items || detailData.items.length === 0) return message.reply("Chaîne introuvable !");

        const channel = detailData.items[0];
        const snippet = channel.snippet;
        const stats = channel.statistics;

        const createdDate = new Date(snippet.publishedAt).toLocaleDateString('fr-FR', {
            day: 'numeric', month: 'long', year: 'numeric'
        });

        const embed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle(snippet.title)
            .setURL(`https://www.youtube.com/channel/${channelId}`)
            .setThumbnail(snippet.thumbnails.high?.url ?? snippet.thumbnails.default.url)
            .setDescription(snippet.description ? snippet.description.slice(0, 200) + (snippet.description.length > 200 ? '...' : '') : '*Aucune description*')
            .addFields(
                { name: '👥 Abonnés', value: stats.hiddenSubscriberCount ? 'Caché' : formatNumber(stats.subscriberCount), inline: true },
                { name: '👁️ Vues totales', value: formatNumber(stats.viewCount), inline: true },
                { name: '🎬 Vidéos', value: formatNumber(stats.videoCount), inline: true },
                { name: '📅 Création', value: createdDate, inline: true }
            )
            .setFooter({ text: `ID : ${channelId}` });

        return message.reply({ embeds: [embed] });

    } catch (e) {
        console.error('Erreur stats YouTube:', e);
        return message.reply("Erreur lors de la récupération des stats.");
    }
}

    // !youtube
    if (response?.needsYoutube) {
    const query = message.content.trim().split(/\s+/).slice(1).join(' ');
    if (!query) return message.reply("Usage : `!youtube [recherche]`");

    try {
        const searchRes = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=5&key=${process.env.YOUTUBE_API_KEY}`);
        const searchData = await searchRes.json();
        console.log('YouTube API response:', JSON.stringify(searchData));

        if (!searchData.items || searchData.items.length === 0) {
            return message.reply("Aucun résultat trouvé !");
        }

        const videoIds = searchData.items.map(i => i.id.videoId).join(',');
        const detailRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoIds}&key=${process.env.YOUTUBE_API_KEY}`);
        const detailData = await detailRes.json();

        const videos = detailData.items;

        const buildYoutubeEmbed = (index) => {
            const video = videos[index];
            const snippet = video.snippet;
            const stats = video.statistics || {};

            const duration = video.contentDetails.duration
                .replace('PT', '')
                .replace('H', 'h ')
                .replace('M', 'min ')
                .replace('S', 's');

            const views = stats.viewCount ? parseInt(stats.viewCount).toLocaleString('fr-FR') : '0';
            const likes = stats.likeCount ? parseInt(stats.likeCount).toLocaleString('fr-FR') : 'Masqué';
            const comments = stats.commentCount ? parseInt(stats.commentCount).toLocaleString('fr-FR') : 'Désactivés';
            const date = new Date(snippet.publishedAt).toLocaleDateString('fr-FR', {
                day: 'numeric', month: 'long', year: 'numeric'
            });

            const miniatureUrl = snippet.thumbnails.maxres?.url ?? snippet.thumbnails.high?.url ?? snippet.thumbnails.default?.url;

            return new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle(snippet.title)
                .setURL(`https://www.youtube.com/watch?v=${video.id}`)
                .setImage(miniatureUrl)
                .addFields(
                    { name: '📺 Chaîne', value: snippet.channelTitle, inline: true },
                    { name: '⏱️ Durée', value: duration, inline: true },
                    { name: '👁️ Vues', value: views, inline: true },
                    { name: '👍 Likes', value: likes, inline: true },
                    { name: '💬 Commentaires', value: comments, inline: true },
                    { name: '📅 Publié le', value: date, inline: true }
                )
                .setFooter({ text: `Résultat ${index + 1}/${videos.length}` });
        };

        const buildYoutubeRow = (index, authorId, videoUrl) => {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`yt_prev_${authorId}_${index}`)
                    .setLabel('⏮️ Précédent')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(index === 0),
                new ButtonBuilder()
                    .setCustomId(`yt_next_${authorId}_${index}`)
                    .setLabel('⏭️ Suivant')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(index >= videos.length - 1),
                new ButtonBuilder()
                    .setLabel('🔗 Ouvrir')
                    .setStyle(ButtonStyle.Link)
                    .setURL(videoUrl),
                new ButtonBuilder()
                    .setCustomId(`yt_close_${authorId}`)
                    .setLabel('❌ Fermer')
                    .setStyle(ButtonStyle.Danger)
            );
        };

        const firstVideo = videos[0];
        const firstUrl = `https://www.youtube.com/watch?v=${firstVideo.id}`;

        const sent = await message.reply({
            embeds: [buildYoutubeEmbed(0)],
            components: [buildYoutubeRow(0, message.author.id, firstUrl)]
        });

        // Stocker les vidéos pour les boutons
        youtubeSearches.set(sent.id, { videos, authorId: message.author.id });

        // Supprimer après 5 minutes
        setTimeout(() => youtubeSearches.delete(sent.id), 5 * 60 * 1000);

    } catch (e) {
        console.error('Erreur YouTube:', e);
        return message.reply("Erreur lors de la recherche YouTube.");
    }
    return;
}

    // !lovecalc
    if (response?.needsLovecalc) {
    const args = message.content.trim().split(/\s+/);
    let user1 = message.mentions.users.first();
    let user2 = message.mentions.users.size >= 2 ? [...message.mentions.users.values()][1] : null;

    // Recherche par pseudo si pas de mention
    if (!user1 && args[1]) {
        const r = findMemberByName(message.guild, args[1]);
        if (r.found) user1 = r.found.user;
    }
    if (!user2 && args[2]) {
        const r = findMemberByName(message.guild, args[2]);
        if (r.found) user2 = r.found.user;
    }

    if (!user1 || !user2) {
        return message.reply('Usage : `!lovecalc @User1 @User2` ou `!lovecalc pseudo1 pseudo2`');
    }

    // Seed déterministe basé sur les deux IDs (même résultat peu importe l'ordre)
    const ids = [user1.id, user2.id].sort();
    const seed = parseInt(ids[0].slice(-4)) + parseInt(ids[1].slice(-4));
    const percent = (seed * 7 + 13) % 101;

    const nom1 = message.guild?.members.cache.get(user1.id)?.displayName ?? user1.username;
    const nom2 = message.guild?.members.cache.get(user2.id)?.displayName ?? user2.username;

    try {
        const av1 = user1.displayAvatarURL({ extension: 'png', size: 256 });
        const av2 = user2.displayAvatarURL({ extension: 'png', size: 256 });
        const buffer = await generateLovecalcImage(av1, av2, percent);

        const embed = new EmbedBuilder()
            .setColor(0xe91e63)
            .setDescription(`💕 **${nom1}** et **${nom2}** sont compatibles à **${percent}%** !`)
            .setImage('attachment://lovecalc.png');

        return message.reply({ embeds: [embed], files: [{ attachment: buffer, name: 'lovecalc.png' }] });
    } catch (e) {
        console.error('Erreur lovecalc:', e);
        return message.reply(`💕 **${nom1}** et **${nom2}** sont compatibles à **${percent}%** !`);
    }
}

    // !kiss
    if (response?.needsKiss) {
        let cible = message.mentions.users.first();
        const auteurNom = message.member?.displayName ?? message.author.username;

        if (!cible) {
            const args = message.content.trim().split(/\s+/).slice(1).join(" ");
            if (args.length > 0) {
                const result = findMemberByName(message.guild, args);
                if (result.multiple) {
                    askDisambiguation(message, message.guild, result.candidates, (user) => { cible = user; message.client.emit('messageCreate', message); });
                    return;
                }
                if (result.found) cible = result.found.user;
            }
        }

        if (!cible) {
            return message.reply("Euuh... Tu veux embrasser qui ? J'ai pas compris.");
        }

        const cibleNom = message.guild?.members.cache.get(cible.id)?.displayName ?? cible.username;

        if (cible.id === message.author.id) {
            const embedSelf = buildKissEmbed(auteurNom, auteurNom).setDescription(`\ud83d\udc8b **${auteurNom}** s'embrasse ! Attends... Comment c'est possible ?`);
            return message.reply({ embeds: [embedSelf] });
        }

        if (cible.id === client.user.id) {
            const embedBot = buildKissEmbed(auteurNom, "Cacabot").setDescription(`\ud83d\udc8b **${auteurNom}** m'embrasse ! Awww merci <3`);
            return message.reply({ embeds: [embedBot] });
        }

        const embed = buildKissEmbed(auteurNom, cibleNom);
        const kissBackButton = new ButtonBuilder()
            .setCustomId(`kiss_back_${message.author.id}_${cible.id}_${auteurNom}`)
            .setLabel("\ud83d\udc8b Embrasser en retour")
            .setStyle(ButtonStyle.Primary);
        const row = new ActionRowBuilder().addComponents(kissBackButton);
        return message.reply({ embeds: [embed], components: [row] });
    }

    // !run

    if (response?.needsRun) {
    let cible = message.mentions.users.first();
    const auteurNom = message.member?.displayName ?? message.author.username;

    if (!cible) {
        const args = message.content.trim().split(/\s+/).slice(1).join(" ");
        if (args.length > 0) {
            const result = findMemberByName(message.guild, args);
            if (result.multiple) {
                askDisambiguation(message, message.guild, result.candidates, (user) => { cible = user; message.client.emit('messageCreate', message); });
                return;
            }
            if (result.found) cible = result.found.user;
        }
    }

    if (!cible) {
        const embed = buildRunEmbed(`🏃 **${auteurNom}** fuit !`);
        const runJoinButton = new ButtonBuilder()
            .setCustomId(`run_join_${message.author.id}_${auteurNom}`)
            .setLabel("🏃 Accompagner")
            .setStyle(ButtonStyle.Secondary);
        const row = new ActionRowBuilder().addComponents(runJoinButton);
        return message.reply({ embeds: [embed], components: [row] });
    }

    if (cible.id === message.author.id) {
        const embed = buildRunEmbed(`🏃 **${auteurNom}** fuit !`);
        const runJoinButton = new ButtonBuilder()
            .setCustomId(`run_join_${message.author.id}_${auteurNom}`)
            .setLabel("🏃 Accompagner")
            .setStyle(ButtonStyle.Secondary);
        const row = new ActionRowBuilder().addComponents(runJoinButton);
        return message.reply({ embeds: [embed], components: [row] });
    }

    if (cible.id === client.user.id) {
        const embed = buildRunEmbed(`🏃 **${auteurNom}** me fuit ! Reviens-là !`);
        return message.reply({ embeds: [embed] });
    }

    const cibleNom = message.guild?.members.cache.get(cible.id)?.displayName ?? cible.username;
    const embed = buildRunEmbed(`🏃 **${auteurNom}** fuit de **${cibleNom}** !`);
    const runJoinButton = new ButtonBuilder()
        .setCustomId(`run_join_${message.author.id}_${auteurNom}_${cible.id}`)
        .setLabel("🏃 Accompagner")
        .setStyle(ButtonStyle.Secondary);
    const row = new ActionRowBuilder().addComponents(runJoinButton);
    return message.reply({ embeds: [embed], components: [row] });
}

    // !hug
    if (response?.needsHug) {
        let cible = message.mentions.users.first();
        const auteurNom = message.member?.displayName ?? message.author.username;

        if (!cible) {
            const args = message.content.trim().split(/\s+/).slice(1).join(" ");
            if (args.length > 0) {
                const result = findMemberByName(message.guild, args);
                if (result.multiple) {
                    askDisambiguation(message, message.guild, result.candidates, (user) => { cible = user; message.client.emit('messageCreate', message); });
                    return;
                }
                if (result.found) cible = result.found.user;
            }
        }

        if (!cible) {
            return message.reply("Euuh... Tu veux c\u00e2liner qui du coup ?");
        }

        const cibleNom = message.guild?.members.cache.get(cible.id)?.displayName ?? cible.username;

        if (cible.id === message.author.id) {
            const embedSelf = buildHugEmbed(auteurNom, auteurNom).setDescription(`\ud83e\udef2 **${auteurNom}** se fait un c\u00e2lin... \u00c7a va aller...`);
            return message.reply({ embeds: [embedSelf] });
        }

        if (cible.id === client.user.id) {
            const embedBot = buildHugEmbed(auteurNom, "Cacabot").setDescription(`\ud83e\udef2 **${auteurNom}** me fait un c\u00e2lin !`);
            return message.reply({ embeds: [embedBot] });
        }

        const embed = buildHugEmbed(auteurNom, cibleNom);
        const hugBackButton = new ButtonBuilder()
            .setCustomId(`hug_back_${message.author.id}_${cible.id}_${auteurNom}`)
            .setLabel("\ud83e\udef2 C\u00e2liner en retour")
            .setStyle(ButtonStyle.Primary);
        const row = new ActionRowBuilder().addComponents(hugBackButton);
        return message.reply({ embeds: [embed], components: [row] });
    }

    // !dance
    if (response?.needsDance) {
        let cible = message.mentions.users.first();
        const auteurNom = message.member?.displayName ?? message.author.username;

        if (!cible) {
            const args = message.content.trim().split(/\s+/).slice(1).join(" ");
            if (args.length > 0) {
                const result = findMemberByName(message.guild, args);
                if (result.multiple) {
                    askDisambiguation(message, message.guild, result.candidates, (user) => { cible = user; message.client.emit('messageCreate', message); });
                    return;
                }
                if (result.found) cible = result.found.user;
            }
        }

        if (!cible) {
            const embed = buildDanceEmbed(`\ud83d\udd7a **${auteurNom}** s'ambiance comme jamais !`, true);
            const danceJoinButton = new ButtonBuilder()
                .setCustomId(`dance_join_${message.author.id}_${auteurNom}`)
                .setLabel("\ud83d\udc83 Rejoindre la danse")
                .setStyle(ButtonStyle.Primary);
            const row = new ActionRowBuilder().addComponents(danceJoinButton);
            return message.reply({ embeds: [embed], components: [row] });
        }

        const cibleNom = message.guild?.members.cache.get(cible.id)?.displayName ?? cible.username;

        if (cible.id === client.user.id) {
            const embed = buildDanceEmbed(`\ud83d\udd7a **${auteurNom}** danse avec moi !`, false);
            return message.reply({ embeds: [embed] });
        }

        const embed = buildDanceEmbed(`\ud83d\udd7a **${auteurNom}** danse avec **${cibleNom}** !`, false);
        const danceBackButton = new ButtonBuilder()
            .setCustomId(`dance_back_${message.author.id}_${cible.id}_${auteurNom}`)
            .setLabel("\ud83d\udc83 Rejoindre la danse")
            .setStyle(ButtonStyle.Primary);
        const row = new ActionRowBuilder().addComponents(danceBackButton);
        return message.reply({ embeds: [embed], components: [row] });
    }

    // !insult
    if (response?.needsInsult) {
        let cible = message.mentions.users.first();
        const auteurNom = message.member?.displayName ?? message.author.username;

        if (!cible) {
            const args = message.content.trim().split(/\s+/).slice(1).join(" ");
            if (args.length > 0) {
                const result = findMemberByName(message.guild, args);
                if (result.multiple) {
                    askDisambiguation(message, message.guild, result.candidates, (user) => { cible = user; message.client.emit('messageCreate', message); });
                    return;
                }
                if (result.found) cible = result.found.user;
            }
        }

        if (!cible) {
            return message.reply("Mentionne quelqu'un pour l'insulter !");
        }

        if (cible.id === message.author.id) {
            return message.reply("Tu ne peux pas t'insulter toi-m\u00eame... Mentionne quelqu'un plut\u00f4t !");
        }

        if (cible.id === client.user.id) {
            const embed = buildInsultEmbed(`\ud83d\udd95 **${auteurNom}** m'insulte ! J'ai fait quoi ?!`);
            return message.reply({ embeds: [embed] });
        }

        const cibleNom = message.guild?.members.cache.get(cible.id)?.displayName ?? cible.username;
        const embed = buildInsultEmbed(`\ud83d\udd95 **${auteurNom}** insulte **${cibleNom}** !`);
        const insultBackButton = new ButtonBuilder()
            .setCustomId(`insult_back_${message.author.id}_${cible.id}_${auteurNom}`)
            .setLabel("\ud83d\udd95 Insulter en retour")
            .setStyle(ButtonStyle.Primary);
        const row = new ActionRowBuilder().addComponents(insultBackButton);
        return message.reply({ embeds: [embed], components: [row] });
    }

    // !laugh
    if (response?.needsLaugh) {
        let cible = message.mentions.users.first();
        const auteurNom = message.member?.displayName ?? message.author.username;

        if (!cible) {
            const args = message.content.trim().split(/\s+/).slice(1).join(" ");
            if (args.length > 0) {
                const result = findMemberByName(message.guild, args);
                if (result.multiple) {
                    askDisambiguation(message, message.guild, result.candidates, (user) => { cible = user; message.client.emit('messageCreate', message); });
                    return;
                }
                if (result.found) cible = result.found.user;
            }
        }

        if (cible && cible.id !== message.author.id && cible.id !== client.user.id) {
            const cibleNom = message.guild?.members.cache.get(cible.id)?.displayName ?? cible.username;
            const embed = buildLaughEmbed(`\ud83d\ude06 **${auteurNom}** se fout de la gueule de **${cibleNom}** !`);
            const laughButton = new ButtonBuilder()
                .setCustomId(`laugh_with_${message.author.id}_${auteurNom}`)
                .setLabel("\ud83d\ude06 Rire avec")
                .setStyle(ButtonStyle.Primary);
            const row = new ActionRowBuilder().addComponents(laughButton);
            return message.reply({ embeds: [embed], components: [row] });
        }

        const embed = buildLaughEmbed(`\ud83d\ude06 **${auteurNom}** se tape une barre !`);
        const laughButton = new ButtonBuilder()
            .setCustomId(`laugh_with_${message.author.id}_${auteurNom}`)
            .setLabel("\ud83d\ude06 Rire avec")
            .setStyle(ButtonStyle.Primary);
        const row = new ActionRowBuilder().addComponents(laughButton);
        return message.reply({ embeds: [embed], components: [row] });
    }

    // !rizz
    if (response?.needsRizz) {
        let cible = message.mentions.users.first();
        const auteurNom = message.member?.displayName ?? message.author.username;

        if (!cible) {
            const args = message.content.trim().split(/\s+/).slice(1).join(" ");
            if (args.length > 0) {
                const result = findMemberByName(message.guild, args);
                if (result.multiple) {
                    askDisambiguation(message, message.guild, result.candidates, (user) => { cible = user; message.client.emit('messageCreate', message); });
                    return;
                }
                if (result.found) cible = result.found.user;
            }
        }

        if (!cible) {
            return message.reply("Choisis quelqu'un que tu veux rizz !");
        }

        if (cible.id === message.author.id) {
            return message.reply("Tu ne peux pas te rizz toi-m\u00eame !");
        }

        if (cible.id === client.user.id) {
            const embed = buildRizzEmbed(`\ud83d\uddff **${auteurNom}** me rizz ! Eh beh \ud83d\ude0a`);
            return message.reply({ embeds: [embed] });
        }

        const cibleNom = message.guild?.members.cache.get(cible.id)?.displayName ?? cible.username;
        const embed = buildRizzEmbed(`\ud83d\uddff **${auteurNom}** rizz **${cibleNom}** !`);

        const rizzBackButton = new ButtonBuilder()
            .setCustomId(`rizz_back_${message.author.id}_${cible.id}_${auteurNom}`)
            .setLabel("\ud83d\uddff Rizz en retour")
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(rizzBackButton);
        return message.reply({ embeds: [embed], components: [row] });
    }



    // !wanted
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
                    return;
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
    const wantedID = getWantedOfTheDay(dateKey, message.guild);
    if (!wantedID) return message.reply('Aucun membre éligible trouvé !');
    return sendWantedMessage(message, message.guild, dateKey, wantedID, message.author.id, true);
}

    // !cry
    if (response?.needsCry) {
        const cryGifs = ["https://cdn.discordapp.com/attachments/1128032964924670053/1505906480916725791/zidane.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906486872768522/wwe.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906487413964941/cry2.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906487656972359/hamster.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906487959093359/interstellar.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906869598814310/cry.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906488625856622/powder.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906488932176034/vi.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906489271779449/gangle.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906489657790466/pomni.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906489947324589/fred.gif"];
        const gif = cryGifs[Math.floor(Math.random() * cryGifs.length)];
        const auteurNom = message.member?.displayName ?? message.author.username;
        let cible = message.mentions.users.first();

        if (!cible) {
            const query = message.content.trim().split(/\s+/).slice(1).join(' ');
            if (query) {
                if (client.user.username.toLowerCase().includes(query.toLowerCase()) || 'cacabot'.includes(query.toLowerCase())) {
                    cible = client.user;
                } else {
                    const result = findMemberByName(message.guild, query);
                    if (result.multiple) {
                        askDisambiguation(message, message.guild, result.candidates, async (user) => {
                            const cibleNom = message.guild?.members.cache.get(user.id)?.displayName ?? user.username;
                            const btn = new ButtonBuilder()
                                .setCustomId(`cry_with_${message.author.id}_${auteurNom}_${user.id}_${cibleNom}`)
                                .setLabel('\ud83d\ude2d Pleurer avec')
                                .setStyle(ButtonStyle.Secondary);
                            const row = new ActionRowBuilder().addComponents(btn);
                            const embed = new EmbedBuilder()
                                .setColor(0x597eff)
                                .setDescription(`\ud83d\ude2d **${auteurNom}** Pleure \u00e0 cause de **${cibleNom}**...`)
                                .setImage(gif);
                            message.reply({ embeds: [embed], components: [row] });
                        });
                        return;
                    }
                    if (result.found) cible = result.found.user;
                }
            }
        }

        let desc, targetId = null, cibleNom = null;

        if (cible && cible.id === message.author.id) {
            desc = `\ud83d\ude2d **${auteurNom}** Pleure...`;
            const embed = new EmbedBuilder().setColor(0x597eff).setDescription(desc).setImage(gif);
            return message.reply({ embeds: [embed] });
        } else if (cible && cible.id === '1503495713097519355') {
            desc = `\ud83d\ude2d **${auteurNom}** pleure \u00e0 cause de moi...`;
        } else if (cible) {
            cibleNom = message.guild?.members.cache.get(cible.id)?.displayName ?? cible.username;
            targetId = cible.id;
            desc = `\ud83d\ude2d **${auteurNom}** Pleure \u00e0 cause de **${cibleNom}**...`;
        } else {
            desc = `\ud83d\ude2d **${auteurNom}** Pleure...`;
        }

        const embed = new EmbedBuilder().setColor(0x597eff).setDescription(desc).setImage(gif);

        const btn = new ButtonBuilder()
            .setCustomId(`cry_with_${message.author.id}_${auteurNom}_${targetId ?? 'none'}_${cibleNom ?? 'none'}`)
            .setLabel('\ud83d\ude2d Pleurer avec')
            .setStyle(ButtonStyle.Secondary);
        const row = new ActionRowBuilder().addComponents(btn);
        return message.reply({ embeds: [embed], components: [row] });
    }

    // !palaref
    if (response?.needsPalaref) {
        const palarefGifs = ["https://cdn.discordapp.com/attachments/1128032964924670053/1505882858311647262/tyson.gif", "https://tenor.com/view/vilebrequin-vilebrequin-sylvain-levy-vilebrequin-sylvain-vilebrequin-levy-sylvain-levy-gif-24319115", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882865492164608/viktor.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882866192617624/zidane.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882866549260338/kaamelott.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882866867765278/palaref.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882866867765278/ants.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882867262296094/ants.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882867576606720/simpsons.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882867903758428/speed.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882868205752430/kinger.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882868520456332/pomni.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882872769151027/stare.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882873109020853/erivo.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882873427923024/hidethepain.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882873746686022/chieng.gif"];
        const gif = palarefGifs[Math.floor(Math.random() * palarefGifs.length)];
        const auteurNom = message.member?.displayName ?? message.author.username;
        let cible = message.mentions.users.first();

        if (!cible) {
            const query = message.content.trim().split(/\s+/).slice(1).join(" ");
            if (query) {
                if (client.user.username.toLowerCase().includes(query.toLowerCase()) || 'cacabot'.includes(query.toLowerCase())) {
                    cible = client.user;
                } else {
                    const result = findMemberByName(message.guild, query);
                    if (result.multiple) {
                        askDisambiguation(message, message.guild, result.candidates, async (user) => {
                            const cibleNom = message.guild?.members.cache.get(user.id)?.displayName ?? user.username;
                            const btn = new ButtonBuilder()
                                .setCustomId(`palaref_aussi_${message.author.id}_${auteurNom}_${user.id}`)
                                .setLabel('\ud83d\ude10 Pas la ref non plus')
                                .setStyle(ButtonStyle.Secondary);
                            const row = new ActionRowBuilder().addComponents(btn);
                            const embed = new EmbedBuilder()
                                .setColor(0x503649)
                                .setDescription(`\ud83d\ude10 **${auteurNom}** n'a pas la ref de **${cibleNom}**...`)
                                .setImage(gif);
                            message.reply({ embeds: [embed], components: [row] });
                        });
                        return;
                    }
                    if (result.found) cible = result.found.user;
                }
            }
        }

        let description;
        if (!cible) {
            description = `\ud83d\ude10 **${auteurNom}** n'a pas la ref...`;
        } else if (cible.id === message.author.id) {
            return message.reply({ content: "Tu n'as pas ta propre ref ? ...Hein ?", ephemeral: true });
        } else if (cible.id === client.user.id) {
            description = `\ud83d\ude10 **${auteurNom}** n'a pas ma ref...`;
        } else {
            const cibleNom = message.guild?.members.cache.get(cible.id)?.displayName ?? cible.username;
            description = `\ud83d\ude10 **${auteurNom}** n'a pas la ref de **${cibleNom}**...`;
        }

        const btn = new ButtonBuilder()
            .setCustomId(`palaref_aussi_${message.author.id}_${auteurNom}_${cible?.id ?? 'none'}`)
            .setLabel('\ud83d\ude10 Pas la ref non plus')
            .setStyle(ButtonStyle.Secondary);
        const row = new ActionRowBuilder().addComponents(btn);
        const embed = new EmbedBuilder()
            .setColor(0x503649)
            .setDescription(description)
            .setImage(gif);
        return message.reply({ embeds: [embed], components: [row] });
    }

    // !jailaref
    if (response?.needsJailaref) {
        const jailarefGifs = ["https://static2.klipy.com/ii/4493325008d34b7bf8cd6813cd5c1619/f1/7d/7y2QyYzWIYksGnnK.gif", "https://cdn.discordapp.com/attachments/720079691041472572/1548362421079646481/caf5c232438734937f6e1cf4c7bc5411.png", "https://media1.tenor.com/m/13XpzbwtVnYAAAAC/dway-the-roc.gif", "https://static2.klipy.com/ii/4493325008d34b7bf8cd6813cd5c1619/14/44/oqcpwYRAEpXGYqfyw.gif", "https://static2.klipy.com/ii/50d7c955398dfd7e3c8ba5281154280f/79/6d/eoUS3shzyQLpKm.gif", "https://static2.klipy.com/ii/d7aec6f6f171607374b2065c836f92f4/3d/31/08K8MgEk.gif", "https://static2.klipy.com/ii/4493325008d34b7bf8cd6813cd5c1619/64/b0/SdnOajVDadHUy.gif", "https://cdn.discordapp.com/attachments/720079691041472572/1548366731666268250/image2.gif", "https://static2.klipy.com/ii/9294a2e836d178ddc22430dd7765727e/44/86/6QBidjUuV1oBpAnHIw7o.gif"];
        const gif = jailarefGifs[Math.floor(Math.random() * jailarefGifs.length)];
        const auteurNom = message.member?.displayName ?? message.author.username;
        let cible = message.mentions.users.first();

        if (!cible) {
            const query = message.content.trim().split(/\s+/).slice(1).join(" ");
            if (query) {
                if (client.user.username.toLowerCase().includes(query.toLowerCase()) || 'cacabot'.includes(query.toLowerCase())) {
                    cible = client.user;
                } else {
                    const result = findMemberByName(message.guild, query);
                    if (result.multiple) {
                        askDisambiguation(message, message.guild, result.candidates, async (user) => {
                            const cibleNom = message.guild?.members.cache.get(user.id)?.displayName ?? user.username;
                            const btn = new ButtonBuilder()
                                .setCustomId(`jailaref_with_${message.author.id}_${auteurNom}_${user.id}`)
                                .setLabel('😎 J\'ai la ref aussi')
                                .setStyle(ButtonStyle.Secondary);
                            const row = new ActionRowBuilder().addComponents(btn);
                            const embed = new EmbedBuilder()
                                .setColor(0x503649)
                                .setDescription(`😎 **${auteurNom}** a la ref de **${cibleNom}** !`)
                                .setImage(gif);
                            message.reply({ embeds: [embed], components: [row] });
                        });
                        return;
                    }
                    if (result.found) cible = result.found.user;
                }
            }
        }

        let description;
        if (!cible) {
            description = `😎 **${auteurNom}** a la ref !`;
        } else if (cible.id === message.author.id) {
            return message.reply({ content: "Bah oui, t'as forcément ta propre ref...", ephemeral: true });
        } else if (cible.id === client.user.id) {
            description = `😎 **${auteurNom}** a ma ref !`;
        } else {
            const cibleNom = message.guild?.members.cache.get(cible.id)?.displayName ?? cible.username;
            description = `😎 **${auteurNom}** a la ref de **${cibleNom}** !`;
        }

        const btn = new ButtonBuilder()
            .setCustomId(`jailaref_with_${message.author.id}_${auteurNom}_${cible?.id ?? 'none'}`)
            .setLabel('😎 J\'ai la ref aussi')
            .setStyle(ButtonStyle.Secondary);
        const row = new ActionRowBuilder().addComponents(btn);
        const embed = new EmbedBuilder()
            .setColor(0x503649)
            .setDescription(description)
            .setImage(gif);
        return message.reply({ embeds: [embed], components: [row] });
    }

    // !bougetoi
    if (response?.needsBougetoi) {
        const phrases = [
            `<@${EPSYS_ID}>, faudrait te bouger, on attend ta vidéo ! Alors tu nous sors un logiciel de montage et tu t'y mets **__MAINTENANT__** stp`,
            `<@${EPSYS_ID}>, ON T'ATTEND ! Ouvre ton logiciel de montage et commence à travailler **__TOUT DE SUITE__** ! 🎬`,
            `<@${EPSYS_ID}>, t'as cru que la vidéo allait se monter toute seule ? Allez hop, on taffe sur le projet et plus vite que ça ! 😤`
        ];
        const phraseChoisie = phrases[Math.floor(Math.random() * phrases.length)];
        return message.channel.send({ content: phraseChoisie });
    }

    // !sylvain
    if (response?.needsSylvain) {
        const sylvainGifs = [
            "https://media1.tenor.com/m/camhluUNGO0AAAAd/sylvain-lyve-sylvain-levy.gif",
            "https://media1.tenor.com/m/mhNSNZ7Ye4wAAAAC/sylvain-lyve-vilbrequin.gif",
            "https://media1.tenor.com/m/n7NmIiefhZ4AAAAC/sylvain-lyve-vilbrequin.gif",
            "https://media1.tenor.com/m/p66oAFFJ2pcAAAAC/vilebrequin-vilebrequin-sylvain-levy.gif",
            "https://media1.tenor.com/m/XFUotrruCacAAAAC/vilebrequin-sylvain.gif",
            "https://media1.tenor.com/m/pCExmpKfecgAAAAC/vilebrequin-sylvain.gif",
            "https://media1.tenor.com/m/MkoOhxjfLeYAAAAC/vilebrequin-sylvain.gif",
            "https://media1.tenor.com/m/q5GDY7A8aUMAAAAC/vilebrequin-vilebrequin-sylvain-levy.gif",
            "https://media1.tenor.com/m/8K7M2XtHOFsAAAAC/vilebrequin-sylvain.gif",
            "https://media1.tenor.com/m/E3abpzYLviIAAAAC/vilebrequin-vilebrequin-sylvain-levy.gif",
            "https://media1.tenor.com/m/CH0fiUJj5psAAAAC/sylvain-lyve-sylvain-levy.gif",
            "https://media1.tenor.com/m/VD8UmHWnJPgAAAAC/vilebrequin-vilebrequin-sylvain.gif",
            "https://media1.tenor.com/m/UUO8TiMNDXAAAAAC/keep-pushing-race.gif",
            "https://media1.tenor.com/m/q9PEP4AcLKkAAAAC/vilebrequin-vilebrequin-sylvain-levy.gif",
            "https://media1.tenor.com/m/aNmsYZdcuG8AAAAC/vilebrequin-vilebrequin-sylvain-levy.gif",
            "https://media1.tenor.com/m/d9Dnn5iOeCoAAAAd/sylvain-sylvain-rire.gif"
        ];
        const gif = sylvainGifs[Math.floor(Math.random() * sylvainGifs.length)];

        const btn = new ButtonBuilder()
            .setCustomId('sylvain_again')
            .setLabel('🐒 Singe fort ensemble')
            .setStyle(ButtonStyle.Secondary);
        const row = new ActionRowBuilder().addComponents(btn);

        return message.reply({ files: [gif], components: [row] });
    }

// !roulettestate / !rltstate
if (response?.needsRouletteState) {
    const query = message.content.trim().split(/\s+/).slice(1).join(" ");
    let cible = message.mentions.members.first();
    if (!cible) {
        if (!query) {
            cible = message.member;
        } else {
            const result = findMemberByName(message.guild, query);
            if (result.multiple) {
                return askDisambiguation(message, message.guild, result.candidates, async (user) => {
                    const membre = message.guild.members.cache.get(user.id);
                    if (membre) message.reply({ embeds: [buildRouletteStateEmbed(membre, message.guild?.id)] });
                });
            }
            cible = result.found;
        }
    }
    if (!cible) return message.reply("Membre introuvable.");
    return message.reply({ embeds: [buildRouletteStateEmbed(cible, message.guild?.id)] });
}

// !roulettestats (publique)
if (response?.needsRouletteStats) {
    const query = message.content.trim().split(/\s+/).slice(1).join(" ");
    let cible = message.mentions.members.first();
    if (!cible) {
        if (!query) {
            cible = message.member;
        } else {
            const result = findMemberByName(message.guild, query);
            if (result.multiple) {
                return askDisambiguation(message, message.guild, result.candidates, async (user) => {
                    const membre = message.guild.members.cache.get(user.id);
                    if (membre) {
                        const row = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId(`rlt_achs_${membre.id}_0_${message.author.id}`).setLabel('🎖️ Succès').setStyle(ButtonStyle.Secondary)
                        );
                        message.reply({ embeds: [buildRouletteStatsEmbed(membre)], components: [row] });
                    }
                });
            }
            cible = result.found;
        }
    }
    if (!cible) return message.reply("Membre introuvable.");
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`rlt_achs_${cible.id}_0_${message.author.id}`).setLabel('🎖️ Succès').setStyle(ButtonStyle.Secondary)
    );
    return message.reply({ embeds: [buildRouletteStatsEmbed(cible)], components: [row] });
}

function buildRouletteTopEmbed(guild, authorId) {
    const totalAchs = ROULETTE_ACHIEVEMENTS.length;
    const entries = [...rouletteAchievements.entries()]
        .map(([uid, achs]) => ({ uid, count: Object.keys(achs || {}).length }))
        .filter(e => e.count > 0)
        .sort((a, b) => b.count - a.count);

    const medals = ['🥇', '🥈', '🥉'];
    const top10 = entries.slice(0, 10);
    const lignes = top10.map((e, i) => {
        const m = guild.members.cache.get(e.uid);
        const nom = m?.displayName ?? 'Ancien membre';
        const med = i < 3 ? medals[i] : `**${i + 1}.**`;
        return `${med} **${nom}** — **${e.count}/${totalAchs}** succès`;
    });

    const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle('🏆 Panthéon des Chasseurs de Succès (Roulette)')
        .setDescription(lignes.length > 0 ? lignes.join('\n\n') : '*Aucun succès débloqué pour l\'instant.*');

    const userRankIndex = entries.findIndex(e => e.uid === authorId);
    if (userRankIndex !== -1) {
        const userEntry = entries[userRankIndex];
        embed.setFooter({ text: `Ta position : #${userRankIndex + 1} avec ${userEntry.count}/${totalAchs} succès` });
    } else {
        embed.setFooter({ text: `Tu n'as pas encore de succès débloqué. Tape !rlt pour tenter ta chance !` });
    }

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`rlt_achs_${authorId}_0_${authorId}`)
            .setLabel('🎖️ Mes succès')
            .setStyle(ButtonStyle.Secondary)
    );

    return { embed, row };
}

// !rlttop (Classement des succès roulette)
if (response?.needsRouletteTop) {
    const { embed, row } = buildRouletteTopEmbed(message.guild, message.author.id);
    return message.reply({ embeds: [embed], components: [row] });
}

// !roulettesucces (publique)
if (response?.needsRouletteAchievements) {
    const query = message.content.trim().split(/\s+/).slice(1).join(" ");
    let cible = message.mentions.members.first();
    if (!cible) {
        if (!query) {
            cible = message.member;
        } else {
            const result = findMemberByName(message.guild, query);
            if (result.multiple) {
                return askDisambiguation(message, message.guild, result.candidates, async (user) => {
                    const membre = message.guild.members.cache.get(user.id);
                    if (membre) {
                        const { embed, row } = buildRouletteAchievementsEmbed(membre, 0, message.author.id);
                        message.reply({ embeds: [embed], components: [row] });
                    }
                });
            }
            cible = result.found;
        }
    }
    if (!cible) return message.reply("Membre introuvable.");
    const { embed, row } = buildRouletteAchievementsEmbed(cible, 0, message.author.id);
    return message.reply({ embeds: [embed], components: [row] });
}


    // !motus
    if (response?.needsMotus) {
        const { jourStr, heures, minutes, sessionNom, timestamp } = tempsAvantProchainMotus();
        const now = Date.now();
        const enCours = motusData.mot && !motusData.termine && motusData.expireAt && now < motusData.expireAt;

        let desc = `Le prochain Motus aura lieu **${jourStr} à ${sessionNom}** (dans **${heures}h ${minutes}min**, <t:${timestamp}:R>) !\n\n-# *Sessions tous les jours : 10h00 (6 lettres) et 19h00 (7 lettres - Difficile).*`;

        if (enCours) {
            const expireTimestamp = Math.floor(motusData.expireAt / 1000);
            const titreType = motusData.longueur === 7 ? '🟥 Motus du soir (7 lettres - Difficile)' : '🟩 Motus du matin (6 lettres)';
            desc = `🎮 **${titreType} est EN COURS dans <#${MOTUS_CHANNEL_ID}> !**\n\n` +
                   `Tu as **3 essais individuels** pour deviner le mot.\n` +
                   `⏳ **Fin de la session :** <t:${expireTimestamp}:R> (fermeture à <t:${expireTimestamp}:t>) !\n\n` +
                   `Prochaine session : **${jourStr} à ${sessionNom}** (<t:${timestamp}:R>).`;
        }

        const embed = new EmbedBuilder()
            .setColor(enCours && motusData.longueur === 7 ? 0xe74c3c : 0x00b0f4)
            .setTitle(enCours ? '🟩 MOTUS EN COURS !' : '🟩 Motus Quotidien de Regaïa')
            .setDescription(desc)
            .setFooter({ text: 'Salon dédié : <#1556089022718152764> • 3 essais individuels • 1 heure de jeu par session' });

        return message.reply({ embeds: [embed] });
    }

    // !motustats
    if (response?.needsMotusStats) {
        let cible = message.mentions.members.first();
        if (!cible) {
            const query = message.content.trim().split(/\s+/).slice(1).join(" ");
            if (query) cible = findMemberByName(message.guild, query).found;
        }
        if (!cible) cible = message.member;

        const embed = buildMotusStatsEmbed(cible, message.author);
        return message.reply({ embeds: [embed] });
    }

    // !rebus
    if (response?.needsRebus) {
        const { jourStr, h, m, timestamp } = tempsAvantProchainRebus();

        let desc = `Le prochain Rébus Regaïen aura lieu **${jourStr} à 15h00** (dans **${h}h ${m}min**, <t:${timestamp}:R>) !\n-# *Thème mystère révélé au début de la partie.*`;

        if (rebusSession.active && rebusSession.currentItem) {
            const expireTimestamp = Math.floor(rebusSession.expireAt / 1000);
            desc = `🎮 **Le Rébus Regaïen est EN COURS dans <#${MOTUS_CHANNEL_ID}> !**\n\n` +
                   `📍 **Manche en cours :** ${rebusSession.manche}/5\n` +
                   `⏳ **Fin de la manche :** <t:${expireTimestamp}:R> !\n\n` +
                   `Prochaine session complète : **${jourStr} à 15h00** (<t:${timestamp}:R>).`;
        }

        const embed = new EmbedBuilder()
            .setColor(0xf39c12)
            .setTitle(rebusSession.active ? '🧩 RÉBUS REGAÏEN EN COURS !' : '🧩 Rébus Regaïen Quotidien (15h00)')
            .setDescription(desc)
            .setFooter({ text: 'Salon dédié : <#1556089022718152764> • 5 manches de 5 minutes chaque jour à 15h00' });

        return message.reply({ embeds: [embed] });
    }

    // !rebusstats
    if (response?.needsRebusStats) {
        let cible = message.mentions.members.first();
        if (!cible) {
            const query = message.content.trim().split(/\s+/).slice(1).join(" ");
            if (query) cible = findMemberByName(message.guild, query).found;
        }
        if (!cible) cible = message.member;

        const embed = buildRebusStatsEmbed(cible);
        return message.reply({ embeds: [embed] });
    }

    // !quote
    if (response?.needsQuote) {
        const args = message.content.trim().split(/\s+/);
        const sub = args[1]?.toLowerCase();

        // 1. Suppression : !quote remove [ID]
        if (sub === 'remove' || sub === 'delete' || sub === 'del') {
            const idToRemove = parseInt(args[2]);
            if (isNaN(idToRemove)) return message.reply("Usage : `!quote remove [ID_citation]` (ex : `!quote remove 3`)");

            const index = quotesData.findIndex(q => q.id === idToRemove);
            if (index === -1) return message.reply(`Aucune citation trouvée avec l'identifiant **#${idToRemove}** !`);

            const q = quotesData[index];
            const estAuteur = q.authorId === message.author.id || q.addedById === message.author.id;
            const estAdmin = message.author.id === EPSYS_ID || estModo(message.member);

            if (!estAuteur && !estAdmin) {
                return message.reply("Tu ne peux supprimer que les citations que tu as enregistrées ou dont tu es l'auteur !");
            }

            quotesData.splice(index, 1);
            demanderSauvegarde();
            return message.reply(`🗑️ La citation **#${idToRemove}** a été supprimée des archives.`);
        }

        // 2. Enregistrement par réponse à un message : réponds à un message + !quote
        if (message.reference) {
            const repliedMsg = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
            if (!repliedMsg) return message.reply("Impossible de récupérer le message cité.");

            // Autorise les vrais humains ET les webhooks (ex: malus roulette), mais bloque les bots purs
            const estWebhook = Boolean(repliedMsg.webhookId);
            if (repliedMsg.author.bot && !estWebhook) {
                return message.reply("On ne cite pas les bots, seulement les membres et les webhooks !");
            }

            const texteCité = repliedMsg.content?.trim() || '';
            const imagePieceJointe = repliedMsg.attachments.first()?.url ?? null;

            if (!texteCité && !imagePieceJointe) {
                return message.reply("Ce message ne contient ni texte ni image à citer !");
            }

            // Évite d'enregistrer deux fois exactement la même citation
            const existeDeja = quotesData.some(q => q.texte === texteCité && q.authorId === repliedMsg.author.id && q.imageUrl === imagePieceJointe);
            if (existeDeja) return message.reply("Cette phrase ou image est déjà enregistrée dans les archives du serveur !");

            const nextId = quotesData.length > 0 ? Math.max(...quotesData.map(q => q.id)) + 1 : 1;
            const auteurNom = repliedMsg.member?.displayName ?? repliedMsg.author.username;
            const auteurAvatar = repliedMsg.author.displayAvatarURL({ dynamic: true, size: 256 });

            const nouvelleCitation = {
                id: nextId,
                texte: texteCité || '(Image)',
                authorId: repliedMsg.author.id,
                authorName: auteurNom,
                avatarUrl: auteurAvatar,
                isWebhook: estWebhook,
                imageUrl: imagePieceJointe,
                addedById: message.author.id,
                timestamp: repliedMsg.createdTimestamp,
                channelId: message.channel.id,
                messageUrl: repliedMsg.url ?? `https://discord.com/channels/${message.guild.id}/${message.channel.id}/${repliedMsg.id}`
            };

            quotesData.push(nouvelleCitation);
            demanderSauvegarde();

            const descriptionConf = estWebhook
                ? `> *« ${texteCité || 'Image'} »*\n\n— **${auteurNom}** *(Webhook)* dans <#${message.channel.id}>`
                : `> *« ${texteCité || 'Image'} »*\n\n— <@${repliedMsg.author.id}> dans <#${message.channel.id}>`;

            const embedConf = new EmbedBuilder()
                .setColor(0xf1c40f)
                .setTitle(`📜 Citation #${nextId} enregistrée !`)
                .setDescription(descriptionConf)
                .setFooter({ text: `Enregistrée par ${message.member?.displayName ?? message.author.username} • Tape !quote pour afficher une citation` });

            if (imagePieceJointe) embedConf.setImage(imagePieceJointe);

            return message.reply({ embeds: [embedConf] });
        }

        // 3. Affichage aléatoire / Recherche
        if (quotesData.length === 0) {
            return message.reply("📜 Aucune citation enregistrée pour l'instant ! Réponds à un message mythique avec `!quote` pour immortaliser une phrase.");
        }

        let pool = quotesData;
        let cible = message.mentions.users.first();
        let customFilterId = 'all';

        // 3.a : Recherche par mot-clé : !quote search [mot]
        if (sub === 'search' || sub === 'find' || sub === 'chercher') {
            const motCle = args.slice(2).join(" ").trim().toLowerCase();
            if (!motCle) return message.reply("Usage : `!quote search [mot-clé]` (ex : `!quote search caca`)");

            const resultats = quotesData.filter(q => q.texte?.toLowerCase().includes(motCle));
            if (resultats.length === 0) return message.reply(`🔍 Aucune citation ne contient le mot **« ${motCle} »** !`);
            pool = resultats;
            customFilterId = `search_${encodeURIComponent(motCle)}`;
        } else {
            const query = args.slice(1).join(" ").trim();
            const idDirect = parseInt(query);

            if (!isNaN(idDirect) && !query.includes('@')) {
                const quoteTrouvee = quotesData.find(q => q.id === idDirect);
                if (!quoteTrouvee) return message.reply(`Aucune citation trouvée avec le numéro **#${idDirect}** !`);
                pool = [quoteTrouvee];
            } else if (!cible && query.length > 0) {
                const result = findMemberByName(message.guild, query);
                if (result.found) cible = result.found.user;
            }

            if (cible) {
                pool = quotesData.filter(q => q.authorId === cible.id);
                if (pool.length === 0) {
                    const nom = message.guild?.members.cache.get(cible.id)?.displayName ?? cible.username;
                    return message.reply(`Aucune citation enregistrée pour **${nom}** !`);
                }
                customFilterId = cible.id;
            }
        }

        const quoteChoisie = pool[Math.floor(Math.random() * pool.length)];
        const auteurMembre = message.guild.members.cache.get(quoteChoisie.authorId);
        const avatarUrl = quoteChoisie.avatarUrl 
                       ?? auteurMembre?.user?.displayAvatarURL({ dynamic: true, size: 256 }) 
                       ?? auteurMembre?.displayAvatarURL?.({ dynamic: true, size: 256 });

        const lienMsg = quoteChoisie.messageUrl ?? `https://discord.com/channels/${message.guild.id}/${quoteChoisie.channelId}`;
        const auteurMention = quoteChoisie.isWebhook ? `**${quoteChoisie.authorName}** *(Webhook)*` : `<@${quoteChoisie.authorId}>`;

        const texteAffiche = quoteChoisie.texte && quoteChoisie.texte !== '(Image)'
            ? `## « ${quoteChoisie.texte} »\n\n    -${auteurMention}\n\n-# *[source](${lienMsg})*`
            : `    -${auteurMention}\n\n-# *[source](${lienMsg})*`;

        const embedQuote = new EmbedBuilder()
            .setColor(0xf1c40f)
            .setTitle(`📜 Citation N°${quoteChoisie.id}`)
            .setDescription(texteAffiche)
            .setFooter({ text: `[${quoteChoisie.id}/${quotesData.length}] • Réponds à un message en faisant !quote pour l'enregistrer !` });

        if (avatarUrl) embedQuote.setThumbnail(avatarUrl);
        if (quoteChoisie.imageUrl) embedQuote.setImage(quoteChoisie.imageUrl);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`quote_random_${customFilterId}`)
                .setLabel('🎲 Une autre citation')
                .setStyle(ButtonStyle.Secondary)
        );

        return message.reply({ embeds: [embedQuote], components: [row] });
    }

    // !roulette
    if (response?.needsRoulette) {
        if (response.direct) {
            const resultat = await tirerEtConstruireResultatRoulette(message.author.id, message.guild, message.channel);
            if (resultat.cooldown) {
                const notifRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('roulette_notif').setLabel('🔔 Me prévenir').setStyle(ButtonStyle.Secondary)
                );
                await message.reply({ content: `Attends la fin du cooldown avant de relancer un tirage ! Il te reste **${resultat.reste} minute${resultat.reste > 1 ? 's' : ''}**.`, components: [notifRow] });
                return;
            }
            const envoye = await message.reply({ embeds: resultat.embeds, components: resultat.components });
            await envoyerPingRedirection(message.channel, resultat);
            memoriserResultatRoulette(envoye.id, resultat.embeds[0]);
            if (resultat.attenteChoix) rouletteChoixEnAttente.add(envoye.id);
            if (resultat.vote) await demarrerVoteRoulette(envoye, resultat.vote);
            if (resultat.differe) {
                setTimeout(async () => {
                    const embedFinal = await resultat.differe();
                    memoriserResultatRoulette(envoye.id, embedFinal);
                    envoye.edit({ embeds: [embedFinal] }).catch(() => {});
                }, 10000);
            }
            return envoye;
        }
        const embed = buildRoulettePresentationEmbed(message.author.id, message.guild?.id);
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`roulette_probas_pres_${message.author.id}`).setLabel('🎲 Probabilités').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`roulette_tenter_${message.author.id}`).setLabel('🍀 Tenter sa chance').setStyle(ButtonStyle.Primary)
        );
        return message.reply({ embeds: [embed], components: [row] });
    }

    // !explode
    if (response?.needsExplode) {
        const explodeGifs = [
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505564402697375794/cat-cats.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505564403230183599/cat-explosion_1.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505564403653804153/floop-flop.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505564404031426661/cat-explodes.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505564404400521267/cat-funny.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505564404882870292/spideyvivi.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505564405281194064/cat-explode-cat-meme.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505564405847298150/explosion-missile.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505564406224781373/exploding-cat-cat-blowing-up.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505564406799532052/cat-gato.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505564412172570664/boomshakalaka.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505564412763836466/elgatitolover-cat.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505564413376335962/cat-explosion-ellie-cat-explosion.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505564413795635311/exploding-car-explode.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505564414147825774/cat-explosion.gif"
        ];
        const gif = explodeGifs[Math.floor(Math.random() * explodeGifs.length)];
        const auteurNom = message.member?.displayName ?? message.author.username;
        let cible = message.mentions.users.first();

        if (!cible) {
            const query = message.content.trim().split(/\s+/).slice(1).join(" ");
            if (query) {
                if (client.user.username.toLowerCase().includes(query.toLowerCase()) || 'cacabot'.includes(query.toLowerCase())) {
                    cible = client.user;
                } else {
                    const result = findMemberByName(message.guild, query);
                    if (result.multiple) {
                        askDisambiguation(message, message.guild, result.candidates, async (user) => {
                            const cibleNom = message.guild?.members.cache.get(user.id)?.displayName ?? user.username;
                            const explodeBtn = new ButtonBuilder()
                                .setCustomId(`explode_with_${message.author.id}_${auteurNom}`)
                                .setLabel("\ud83d\udca5 Exploser avec")
                                .setStyle(ButtonStyle.Secondary);
                            const row = new ActionRowBuilder().addComponents(explodeBtn);
                            const embed = new EmbedBuilder()
                                .setColor(0xec0f6e)
                                .setDescription(`\ud83d\udca5 **${auteurNom}** explose \u00e0 cause de **${cibleNom}** !`)
                                .setImage(gif);
                            message.reply({ embeds: [embed], components: [row] });
                        });
                        return;
                    }
                    if (result.found) cible = result.found.user;
                }
            }
        }

        let titre;
        if (cible && cible.id === client.user.id) {
            titre = `**${auteurNom}** explose \u00e0 cause de moi ! Nooon !`;
        } else if (cible && cible.id !== message.author.id) {
            const cibleNom = message.guild?.members.cache.get(cible.id)?.displayName ?? cible.username;
            titre = `\ud83d\udca5 **${auteurNom}** explose \u00e0 cause de **${cibleNom}** !`;
        } else {
            titre = `\ud83d\udca5 **${auteurNom}** explose !`;
        }

        const explodeBtn = new ButtonBuilder()
            .setCustomId(`explode_with_${message.author.id}_${auteurNom}`)
            .setLabel("\ud83d\udca5 Exploser avec")
            .setStyle(ButtonStyle.Secondary);
        const row = new ActionRowBuilder().addComponents(explodeBtn);

        const embed = new EmbedBuilder()
            .setColor(0xec0f6e)
            .setDescription(titre)
            .setImage(gif);

        return message.reply({ embeds: [embed], components: [row] });
    }

    // !bait
    if (response?.needsBait) {
        const baitGifs = [
            "https://cdn.discordapp.com/attachments/1072299294519988345/1304467586746028193/brandbird_4.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505570790706253864/tadc-bubble-tadc.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505570791683522760/tadc-the-amazing-digital-circus.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505570792279379988/tadc-caine-tadc.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505570793021505736/flight-flightreacts.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505570793718022226/superman-superman-flying.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505570795160731728/f8957342b4d99638.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505570795974295672/down-syndrome.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505570796981194822/flight.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505570797979172964/catreacts-ragebait.gif"
        ];
        const gif = baitGifs[Math.floor(Math.random() * baitGifs.length)];
        const auteurNom = message.member?.displayName ?? message.author.username;
        let cible = message.mentions.users.first();

        if (!cible) {
            const query = message.content.trim().split(/\s+/).slice(1).join(" ");
            if (query) {
                if (client.user.username.toLowerCase().includes(query.toLowerCase()) || 'cacabot'.includes(query.toLowerCase())) {
                    cible = client.user;
                } else {
                    const result = findMemberByName(message.guild, query);
                    if (result.multiple) {
                        askDisambiguation(message, message.guild, result.candidates, async (user) => {
                            const cibleNom = message.guild?.members.cache.get(user.id)?.displayName ?? user.username;
                            const vengBtn = new ButtonBuilder()
                                .setCustomId(`bait_venge_${user.id}_${message.author.id}_${auteurNom}`)
                                .setLabel("\ud83d\udca2 SE VENGER !")
                                .setStyle(ButtonStyle.Danger);
                            const row = new ActionRowBuilder().addComponents(vengBtn);
                            const embed = new EmbedBuilder()
                                .setColor(0xffb14a)
                                .setDescription(`\ud83d\ude1b **${auteurNom}** ragebait **${cibleNom}** !`)
                                .setImage(gif);
                            message.reply({ embeds: [embed], components: [row] });
                        });
                        return;
                    }
                    if (result.found) cible = result.found.user;
                }
            }
        }

        if (!cible) {
            return message.reply("Choisis quelqu'un que tu veux ragebait !");
        }

        if (cible.id === message.author.id) {
            return message.reply({ content: "Tu ne peux pas te ragebait toi-m\u00eame !" }).then(msg => setTimeout(() => { msg.delete().catch(() => {}); message.delete().catch(() => {}); }, 6000));
        }

        let titre;
        if (cible.id === client.user.id) {
            titre = `\ud83d\ude1b **${auteurNom}** me ragebait ! Gngngngn...`;
            const embed = new EmbedBuilder()
                .setColor(0xffb14a)
                .setDescription(titre)
                .setImage(gif);
            return message.reply({ embeds: [embed] });
        }

        const cibleNom = message.guild?.members.cache.get(cible.id)?.displayName ?? cible.username;
        titre = `\ud83d\ude1b **${auteurNom}** ragebait **${cibleNom}** !`;

        const vengBtn = new ButtonBuilder()
            .setCustomId(`bait_venge_${cible.id}_${message.author.id}_${auteurNom}`)
            .setLabel("\ud83d\udca2 SE VENGER !")
            .setStyle(ButtonStyle.Secondary);
        const row = new ActionRowBuilder().addComponents(vengBtn);

        const embed = new EmbedBuilder()
            .setColor(0xffb14a)
            .setDescription(titre)
            .setImage(gif);

        return message.reply({ embeds: [embed], components: [row] });
    }

    // !bang
    if (response?.needsBang) {
        let cible = message.mentions.users.first();
        const auteurNom = message.member?.displayName ?? message.author.username;

        if (!cible) {
            const args = message.content.trim().split(/\s+/).slice(1).join(" ");
            if (args.length > 0) {
                const result = findMemberByName(message.guild, args);
                if (result.multiple) {
                    askDisambiguation(message, message.guild, result.candidates, (user) => { cible = user; message.client.emit('messageCreate', message); });
                    return;
                }
                if (result.found) cible = result.found.user;
            }
        }

        if (!cible) {
            return message.reply("Mentionne la personne sur qui tu veux tirer !");
        }

        if (cible.id === message.author.id) {
            return message.reply("\u00c9vite de te tirer dessus :(");
        }

        if (cible.id === client.user.id) {
            const embed = buildBangEmbed(`\ud83d\udca5 **${auteurNom}** me tire dessus ! H\u00c9 !`);
            return message.reply({ embeds: [embed] });
        }

        const cibleNom = message.guild?.members.cache.get(cible.id)?.displayName ?? cible.username;
        const embed = buildBangEmbed(`\ud83d\udca5 **${auteurNom}** tire sur **${cibleNom}** !`);

        const bangBackButton = new ButtonBuilder()
            .setCustomId(`bang_back_${message.author.id}_${cible.id}_${auteurNom}`)
            .setLabel("\ud83d\udca5 Riposter !")
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(bangBackButton);
        return message.reply({ embeds: [embed], components: [row] });
    }

    // !punch
    if (response?.needsPunch) {
        let cible = message.mentions.users.first();
        const auteurNom = message.member?.displayName ?? message.author.username;

        if (!cible) {
            const args = message.content.trim().split(/\s+/).slice(1).join(" ");
            if (args.length > 0) {
                const result = findMemberByName(message.guild, args);
                if (result.multiple) {
                    askDisambiguation(message, message.guild, result.candidates, (user) => { cible = user; message.client.emit('messageCreate', message); });
                    return;
                }
                if (result.found) cible = result.found.user;
            }
        }

        if (!cible) {
            return message.reply("Mentionne quelqu'un que tu veux frapper !");
        }

        if (cible.id === message.author.id) {
            return message.reply("Tu ne peux pas te frapper toi-m\u00eame ! 'Fin si mais... Ne le fais pas.");
        }

        if (cible.id === client.user.id) {
            const embed = buildPunchEmbed(`\ud83e\udd1c **${auteurNom}** me frappe ! A\u00efeuh !`);
            return message.reply({ embeds: [embed] });
        }

        const cibleNom = message.guild?.members.cache.get(cible.id)?.displayName ?? cible.username;
        const embed = buildPunchEmbed(`\ud83e\udd1c **${auteurNom}** frappe **${cibleNom}** !`);

        const punchBackButton = new ButtonBuilder()
            .setCustomId(`punch_back_${message.author.id}_${cible.id}_${auteurNom}`)
            .setLabel("\ud83e\udd1c Frapper en retour")
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(punchBackButton);
        return message.reply({ embeds: [embed], components: [row] });
    }

    // !ban
        // !ban
    if (response?.needsBan) {
        const auteurNom = message.member?.displayName ?? message.author.username;
        let cible = message.mentions.users.first();

        if (!cible) {
            const query = message.content.trim().split(/\s+/).slice(1).join(" ");
            if (query) {
                if (client.user.username.toLowerCase().includes(query.toLowerCase()) || 'cacabot'.includes(query.toLowerCase())) {
                    cible = client.user;
                } else {
                    const result = findMemberByName(message.guild, query);
                    if (result.multiple) {
                        const banGifsDisamb = [
                            "https://cdn.discordapp.com/attachments/1128032964924670053/1505557423686029352/cat-screaming-cat-disappearing.gif",
                            "https://cdn.discordapp.com/attachments/1128032964924670053/1505557409148567572/ahh-kid-turns-blue-and-vanishes.gif",
                            "https://cdn.discordapp.com/attachments/1128032964924670053/1505557424092741764/duck-disappears.gif",
                            "https://cdn.discordapp.com/attachments/1128032964924670053/1505557424491462856/tom-skot.gif",
                            "https://cdn.discordapp.com/attachments/1128032964924670053/1505557424805777428/atoms-cry.gif",
                            "https://cdn.discordapp.com/attachments/1128032964924670053/1505557425288380576/sr-pelo-screaming.gif",
                            "https://cdn.discordapp.com/attachments/1128032964924670053/1505557425690775683/cat-scream.gif",
                            "https://cdn.discordapp.com/attachments/1128032964924670053/1505557426043355278/meme-quarantine.gif",
                            "https://cdn.discordapp.com/attachments/1128032964924670053/1505557426433294437/flight-flights.gif",
                            "https://cdn.discordapp.com/attachments/1128032964924670053/1505557426881958020/nikocado-avocado-nikocado.gif",
                            "https://cdn.discordapp.com/attachments/1128032964924670053/1505557427209109544/moist-moist-critical.gif"
                        ];
                        askDisambiguation(message, message.guild, result.candidates, async (user) => {
                            const cibleNom = message.guild?.members.cache.get(user.id)?.displayName ?? user.username;
                            const gif = banGifsDisamb[Math.floor(Math.random() * banGifsDisamb.length)];
                            const embed = new EmbedBuilder()
                                .setColor(0xcdc9dc)
                                .setDescription(`\ud83d\udd28 **${auteurNom}** bannit **${cibleNom}** !`)
                                .setImage(gif);
                            message.reply({ embeds: [embed] });
                        });
                        return;
                    }
                    if (result.found) cible = result.found.user;
                }
            }
        }

        if (!cible) {
            return message.reply("Choisis quelqu'un que tu veux bannir !");
        }

        if (cible.id === message.author.id) {
            return message.reply({ content: "Tu ne peux pas te bannir toi-m\u00eame ! Demande aux modos pour \u00e7a." });
        }

        const banGifs = [
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505557423686029352/cat-screaming-cat-disappearing.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505557409148567572/ahh-kid-turns-blue-and-vanishes.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505557424092741764/duck-disappears.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505557424491462856/tom-skot.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505557424805777428/atoms-cry.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505557425288380576/sr-pelo-screaming.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505557425690775683/cat-scream.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505557426043355278/meme-quarantine.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505557426433294437/flight-flights.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505557426881958020/nikocado-avocado-nikocado.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505557427209109544/moist-moist-critical.gif"
        ];
        const gif = banGifs[Math.floor(Math.random() * banGifs.length)];

        let titre;
        if (cible.id === client.user.id) {
            titre = `**${auteurNom}** me bannit... Pas cool.`;
        } else {
            const cibleNom = message.guild?.members.cache.get(cible.id)?.displayName ?? cible.username;
            titre = `\ud83d\udd28 **${auteurNom}** bannit **${cibleNom}** !`;
        }

        const embed = new EmbedBuilder()
            .setColor(0xcdc9dc)
            .setDescription(titre)
            .setImage(gif);

        return message.reply({ embeds: [embed] });
    }

    // !die
    if (response?.needsDie) {
        let cible = message.mentions.users.first();
        const auteurNom = message.member?.displayName ?? message.author.username;

        // Recherche partielle si pas de ping
        if (!cible) {
            const query = message.content.trim().split(/\s+/).slice(1).join(" ");
            if (query) {
                const lq = query.toLowerCase();
                // Vérifier si c'est le bot
                if (client.user.username.toLowerCase().includes(lq) || 'cacabot'.includes(lq)) {
                    cible = client.user;
                } else {
                    const result = findMemberByName(message.guild, query);
                    if (result.found) cible = result.found.user;
                }
            }
        }

        if (cible && cible.id === client.user.id) {
            const embed = buildDieEmbed(`\u2620\ufe0f **${auteurNom}** meurt \u00e0 cause de moi ! (cheh)`);
            const dieButton = new ButtonBuilder()
                .setCustomId(`die_with_${message.author.id}_${auteurNom}`)
                .setLabel("\u2620\ufe0f Mourir avec")
                .setStyle(ButtonStyle.Primary);
            const row = new ActionRowBuilder().addComponents(dieButton);
            return message.reply({ embeds: [embed], components: [row] });
        }

        let causeNom = null;

        // Cas !die @X
        if (cible && cible.id !== message.author.id) {
            causeNom = message.guild?.members.cache.get(cible.id)?.displayName ?? cible.username;
        }

        // Cas reply (priorité sur le ping si les deux sont présents)
        if (message.reference) {
            const repliedMsg = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
            if (repliedMsg && repliedMsg.author.id !== message.author.id && repliedMsg.author.id !== client.user.id) {
                causeNom = message.guild?.members.cache.get(repliedMsg.author.id)?.displayName ?? repliedMsg.author.username;
            }
        }

        const titre = causeNom
            ? `\u2620\ufe0f **${auteurNom}** meurt \u00e0 cause de **${causeNom}**`
            : `\u2620\ufe0f **${auteurNom}** meurt...`;

        const embed = buildDieEmbed(titre);

        const dieButton = new ButtonBuilder()
            .setCustomId(`die_with_${message.author.id}_${auteurNom}`)
            .setLabel("\u2620\ufe0f Mourir avec")
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(dieButton);
        return message.reply({ embeds: [embed], components: [row] });
    }

    // !profil
    if (response?.needsProfil) {
        let cible = message.mentions.users.first();
        const auteurNom = message.member?.displayName ?? message.author.username;

        if (!cible) {
            const args = message.content.trim().split(/\s+/).slice(1).join(" ");
            if (args.length > 0) {
                const result = findMemberByName(message.guild, args);
                if (result.multiple) {
                    askDisambiguation(message, message.guild, result.candidates, (user) => { cible = user; message.client.emit('messageCreate', message); });
                    return;
                }
                if (result.found) cible = result.found.user;
            }
        }

        if (!cible) cible = message.author;

        const member = message.guild?.members.cache.get(cible.id);
        const joinedAt = member?.joinedAt
            ? member.joinedAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
            : 'Inconnue';
        const createdAt = cible.createdAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
        const roles = member?.roles.cache
            .filter(r => r.id !== message.guild.id)
            .sort((a, b) => b.position - a.position)
            .map(r => `<@&${r.id}>`)
            .slice(0, 5)
            .join(' ') || 'Aucun';

        const nbMessages = topData.messages[cible.id] ?? 0;

        const birthdayRaw = getGuildBirthdays(message.guild.id)[cible.id];
        const moisNoms = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
        let birthdayStr = 'Inconnu';
        if (birthdayRaw) {
            const [j, m] = birthdayRaw.split('/').map(Number);
            birthdayStr = `${j} ${moisNoms[m - 1]}`;
        }

        // Vérification rétroactive des succès roulette
        let userAchs = rouletteAchievements.get(cible.id);
        if (!userAchs) {
            userAchs = {};
            rouletteAchievements.set(cible.id, userAchs);
        }
        const rStats = rouletteStats.get(cible.id);
        const nbTirages = rStats?.tirages ?? 0;
        if (nbTirages >= 250 && !userAchs['veteran-250']) userAchs['veteran-250'] = Date.now();
        if (nbTirages >= 500 && !userAchs['centurion-500']) userAchs['centurion-500'] = Date.now();
        const nbBoucliersRes = rouletteBouclierActif.get(cible.id) || 0;
        if (nbBoucliersRes >= 10 && !userAchs['forteresse']) userAchs['forteresse'] = Date.now();

        // Calcul des Succès du serveur
        const badges = [];

        // 1. Badge Créatrice
        if (cible.id === EPSYS_ID) badges.push('• 👑 Créatrice du serveur et de Cacabot');

        // 2. Tirages Roulette
        if (nbTirages >= 500) badges.push('🎰 Gambling Addict (500+ tirages)');
        else if (nbTirages >= 100) badges.push('🎰 Habitué.e de la Roulette (100+ tirages)');

        // 3. Succès Roulette
        const nbAchs = Object.keys(userAchs).length;
        if (nbAchs >= 15) badges.push(`• 🏆 Trophy Hunter (${nbAchs}/30 succès)`);
        else if (nbAchs >= 5) badges.push(`• 🤠 Aventurier.e de la Roulette (${nbAchs}/30 succès)`);

        // 4. Victoires Motus
        const mStats = motusStats[cible.id];
        const nbVictoires = mStats?.victoires ?? 0;
        if (nbVictoires >= 10) badges.push(`• 🟩 Motus Master (${nbVictoires} victoires)`);
        else if (nbVictoires >= 3) badges.push(`• 🟨 Débutant.e du Motus (${nbVictoires} victoires)`);

        // 5. Médailles d'or du Rébus Regaïen (Top 1 de session)
        const rRebus = rebusStats[cible.id];
        const nbTop1 = rRebus?.victoires ?? 0;
        if (nbTop1 >= 10) badges.push(`• 🥇 Maître du Rébus (10 médailles d'or)`);
        else if (nbTop1 >= 5) badges.push(`• 🥇 Expert.e du Rébus (5 médailles d'or)`);
        else if (nbTop1 >= 3) badges.push(`• 🥇 As du Rébus (3 médailles d'or)`);

        // 6. Citations enregistrées
        const nbQuotes = quotesData.filter(q => q.authorId === cible.id).length;
        if (nbQuotes >= 5) badges.push(`• 📜 Légende (${nbQuotes} citations)`);

        // 6. Messages envoyés sur le serveur
        if (nbMessages >= 5000) badges.push('• 🗣️ Monument de Regaïa (5 000+ messages)');
        else if (nbMessages >= 1000) badges.push('• 💬 Membre Bavard.e (1 000+ messages)');
        else if (nbMessages >= 250) badges.push('• 🌱 Jeune membre (250+ messages)');

        const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle(member?.displayName ?? cible.username)
            .setThumbnail(cible.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                { name: '👤 Pseudo', value: `${cible.username}`, inline: true },
                { name: '💬 Messages envoyés', value: `${nbMessages.toLocaleString('fr-FR')}`, inline: true },
                { name: '\u200b', value: '\u200b', inline: true },
                { name: '📅 Arrivée sur le serveur', value: joinedAt, inline: true },
                { name: '🎂 Anniversaire', value: birthdayStr, inline: true },
                { name: '\u200b', value: '\u200b', inline: true },
                { name: '🏆 Succès du serveur', value: badges.length > 0 ? badges.join('\n') : '*Aucun succès débloqué pour l\'instant.*', inline: false },
                { name: '🏷️ Rôles', value: roles, inline: false }
            )
            .setFooter({ text: `ID : ${cible.id}` });

        return message.reply({ embeds: [embed] });
    }

    // !avatar
    if (response?.needsAvatar) {
        let cible = message.mentions.users.first();

        if (!cible) {
            const args = message.content.trim().split(/\s+/).slice(1).join(" ");
            if (args.length > 0) {
                const result = findMemberByName(message.guild, args);
                if (result.multiple) {
                    askDisambiguation(message, message.guild, result.candidates, (user) => { cible = user; message.client.emit('messageCreate', message); });
                    return;
                }
                if (result.found) cible = result.found.user;
            }
        }

        if (!cible) cible = message.author;

        const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setImage(cible.displayAvatarURL({ dynamic: true, size: 1024 }));

        return message.reply({ embeds: [embed] });
    }

    // !flip
    if (response?.needsFlip) {
        if (flipEnCours) {
            message.reply("Un lancer est d\u00e9j\u00e0 en cours ! Attends ton tour.").then(msg => {
                setTimeout(() => { msg.delete().catch(() => {}); message.delete().catch(() => {}); }, 3000);
            });
            return;
        }
        flipEnCours = true;
        await sendFlipChoix(message.channel, message, message.author.id);
        return;
    }

    // !anniversaire
    if (response?.needsAnniversaire) {
        const isTest = message.content.trim().split(/\s+/)[0].toLowerCase() === '!anniversairetest';
        const args = message.content.trim().split(/\s+/);
        const sub = args[1]?.toLowerCase();

        if (isTest) {
            const channel = message.guild?.channels.cache.get(getBirthdayChannelId(message.guild.id));
            if (!channel) return message.reply("Salon introuvable !");
            await channel.send(`<@${message.author.id}> JOYEUX ANNIVERSAIRE !!! \ud83c\udf89\ud83c\udf89\ud83c\udf89`);
            await channel.send(BIRTHDAY_GIF);
            return;
        }

        if (sub === 'room') {
            if (message.author.id !== '436218312574107658') {
                return message.reply("Tu n'es pas autoris\u00e9(e) \u00e0 faire cette commande.");
            }
            const channelId = args[2];
            if (!channelId || !/^\d{17,19}$/.test(channelId)) {
                return message.reply("Usage : `!anniversaire room [ID_SALON]`");
            }
            const targetChannel = message.guild.channels.cache.get(channelId);
            if (!targetChannel) {
                return message.reply("Salon introuvable sur ce serveur !");
            }
            birthdayData.channels[message.guild.id] = channelId;
            await saveBirthdays();
            return message.reply(`\ud83c\udf82 Les messages d'anniversaire de ce serveur seront d\u00e9sormais envoy\u00e9s dans <#${channelId}> !`);
        }

        if (sub === 'set') {
            const lastArg = args[args.length - 1];
            const isDate = /^\d{2}\/\d{2}$/.test(lastArg);

            if (!isDate) {
                return message.reply("Format invalide ! Utilise `!anniversaire set JJ/MM` ou `!anniversaire set Pseudo JJ/MM`");
            }

            const date = lastArg;

            if (args.length > 3) {
                const query = args.slice(2, args.length - 1).join(" ");
                const result = findMemberByName(message.guild, query);
                if (result.multiple) {
                    askDisambiguation(message, message.guild, result.candidates, async (user) => {
                        getGuildBirthdays(message.guild.id)[user.id] = date;
                        await saveBirthdays();
                        const nom = message.guild?.members.cache.get(user.id)?.displayName ?? user.username;
                        message.reply(`\ud83c\udf82 L'anniversaire de **${nom}** a \u00e9t\u00e9 enregistr\u00e9 le **${date}** !`);
                    });
                    return;
                }
                if (!result.found) {
                    return message.reply("Membre introuvable !");
                }
                const targetUser = result.found.user;
                const nom = message.guild?.members.cache.get(targetUser.id)?.displayName ?? targetUser.username;
                getGuildBirthdays(message.guild.id)[targetUser.id] = date;
                await saveBirthdays();
                return message.reply(`\ud83c\udf82 L'anniversaire de **${nom}** a \u00e9t\u00e9 enregistr\u00e9 le **${date}** !`);
            }

            getGuildBirthdays(message.guild.id)[message.author.id] = date;
            await saveBirthdays();
            return message.reply(`\ud83c\udf82 Ton anniversaire a \u00e9t\u00e9 enregistr\u00e9 le **${date}** !`);
        }

        if (sub === 'remove') {
            const query = args.slice(2).join(" ");
            const guildBirthdays = getGuildBirthdays(message.guild.id);

            // Sans argument = supprimer le sien
            if (!query) {
                if (!guildBirthdays[message.author.id]) {
                    return message.reply("Tu n'as pas d'anniversaire enregistr\u00e9 !");
                }
                delete guildBirthdays[message.author.id];
                await saveBirthdays();
                return message.reply("\ud83d\uddd1\ufe0f Ton anniversaire a \u00e9t\u00e9 supprim\u00e9 !");
            }

            // Avec argument = supprimer celui de quelqu'un
            const result = findMemberByName(message.guild, query);
            if (result.multiple) {
                askDisambiguation(message, message.guild, result.candidates, async (user) => {
                    if (!guildBirthdays[user.id]) {
                        message.reply("Ce membre n'a pas d'anniversaire enregistr\u00e9 !");
                        return;
                    }
                    delete guildBirthdays[user.id];
                    await saveBirthdays();
                    const nom = message.guild?.members.cache.get(user.id)?.displayName ?? user.username;
                    message.reply(`\ud83d\uddd1\ufe0f L'anniversaire de **${nom}** a \u00e9t\u00e9 supprim\u00e9 !`);
                });
                return;
            }
            if (!result.found) {
                return message.reply("Membre introuvable !");
            }
            const targetUser = result.found.user;
            if (!guildBirthdays[targetUser.id]) {
                return message.reply("Ce membre n'a pas d'anniversaire enregistr\u00e9 !");
            }
            const nom = message.guild?.members.cache.get(targetUser.id)?.displayName ?? targetUser.username;
            delete guildBirthdays[targetUser.id];
            await saveBirthdays();
            return message.reply(`\ud83d\uddd1\ufe0f L'anniversaire de **${nom}** a \u00e9t\u00e9 supprim\u00e9 !`);
        }

        if (sub === 'show') {
            let cible = message.mentions.users.first();
            if (!cible) {
                const query = args.slice(1).join(' ');
                if (query) {
                    if (/^\d{17,19}$/.test(query)) {
                        cible = { id: query };
                    } else {
                        const result = findMemberByName(message.guild, query);
                        if (result.multiple) {
                            askDisambiguation(message, message.guild, result.candidates, async (user) => {
                                const date = getGuildBirthdays(message.guild.id)[user.id];
                                const nom = message.guild?.members.cache.get(user.id)?.displayName ?? user.username;
                                if (!date) return message.reply(`\ud83c\udf82 **${nom}** n'a pas encore enregistr\u00e9 son anniversaire.`);
                                const [d, m] = date.split('/').map(Number);
                                const now = new Date(); const next = new Date(now.getFullYear(), m - 1, d);
                                if (next < now) next.setFullYear(now.getFullYear() + 1);
                                const diffDays = Math.ceil((next - now) / (1000 * 60 * 60 * 24));
                                const joursStr = diffDays === 0 ? "c'est aujourd'hui \ud83c\udf89 !" : diffDays === 1 ? "c'est demain \ud83c\udf89 !" : `dans **${diffDays} jours** !`;
                                return message.reply(`\ud83c\udf82 L'anniversaire de **${nom}** est le **${date}** — ${joursStr}`);
                            });
                            return;
                        }
                        if (result.found) cible = result.found.user;
                    }
                }
            }
            if (cible && cible.id !== message.author.id) {
                const date = getGuildBirthdays(message.guild.id)[cible.id];
                const nom = message.guild?.members.cache.get(cible.id)?.displayName ?? cible.username ?? cible.id;
                if (!date) return message.reply(`\ud83c\udf82 **${nom}** n'a pas encore enregistr\u00e9 son anniversaire.`);
                const [d, m] = date.split('/').map(Number);
                const now = new Date(); const next = new Date(now.getFullYear(), m - 1, d);
                if (next < now) next.setFullYear(now.getFullYear() + 1);
                const diffDays = Math.ceil((next - now) / (1000 * 60 * 60 * 24));
                const joursStr = diffDays === 0 ? "c'est aujourd'hui \ud83c\udf89 !" : diffDays === 1 ? "c'est demain \ud83c\udf89 !" : `dans **${diffDays} jours** !`;
                return message.reply(`\ud83c\udf82 L'anniversaire de **${nom}** est le **${date}** — ${joursStr}`);
            }
            const date = getGuildBirthdays(message.guild.id)[message.author.id];
            if (!date) return message.reply("Tu n'as pas encore enregistr\u00e9 ton anniversaire ! Utilise `!anniversaire set JJ/MM`.");
            const [d, m] = date.split('/').map(Number);
            const now = new Date(); const next = new Date(now.getFullYear(), m - 1, d);
            if (next < now) next.setFullYear(now.getFullYear() + 1);
            const diffDays = Math.ceil((next - now) / (1000 * 60 * 60 * 24));
            const joursStr = diffDays === 0 ? "c'est aujourd'hui \ud83c\udf89 !" : diffDays === 1 ? "c'est demain \ud83c\udf89 !" : `dans **${diffDays} jours** !`;
            return message.reply(`\ud83c\udf82 Ton anniversaire est le **${date}** — ${joursStr}`);
        }

        if (sub === 'list') {
            const entries = Object.entries(getGuildBirthdays(message.guild.id));
            if (entries.length === 0) return message.reply("Aucun anniversaire enregistr\u00e9 !");
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

            const buildAnnivEmbed = (sorted, page, ordre) => {
                const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
                const slice = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
                const lines = slice.map(([uid, date]) => `<@${uid}> \u2014 **${date}**`).join('\n');
                return new EmbedBuilder()
                    .setColor(0xff69b4)
                    .setTitle('\ud83c\udf82 Anniversaires du serveur')
                    .setDescription(lines)
                    .setFooter({ text: `Page ${page + 1}/${totalPages} \u2022 ${ordre === 'chrono' ? '\ud83d\udd52 Ordre chronologique' : '\ud83d\udcc5 Ordre classique'}` });
            };

            const buildAnnivRow = (sorted, page, ordre) => {
                const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
                const prev = new ButtonBuilder()
                    .setCustomId(`anniv_list_${ordre}_${authorId}_${page}_prev`)
                    .setLabel('\u2b05\ufe0f Arri\u00e8re')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === 0);
                const next = new ButtonBuilder()
                    .setCustomId(`anniv_list_${ordre}_${authorId}_${page}_next`)
                    .setLabel('Suivant \u27a1\ufe0f')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page >= totalPages - 1);
                const chronoBtn = new ButtonBuilder()
                    .setCustomId(`anniv_list_chrono_${authorId}_${page}_switch`)
                    .setLabel('\ud83d\udd52 Ordre chronologique')
                    .setStyle(ordre === 'chrono' ? ButtonStyle.Primary : ButtonStyle.Secondary);
                const classiqueBtn = new ButtonBuilder()
                    .setCustomId(`anniv_list_classique_${authorId}_${page}_switch`)
                    .setLabel('\ud83d\udcc5 Ordre classique')
                    .setStyle(ordre === 'classique' ? ButtonStyle.Primary : ButtonStyle.Secondary);
                const row1 = new ActionRowBuilder().addComponents(prev, next);
                const row2 = new ActionRowBuilder().addComponents(chronoBtn, classiqueBtn);
                return [row1, row2];
            };

            const sorted = sortEntries('classique');
            const embed = buildAnnivEmbed(sorted, 0, 'classique');
            const rows = buildAnnivRow(sorted, 0, 'classique');
            return message.reply({ embeds: [embed], components: sorted.length > 0 ? rows : [] });
        }

        if (sub === 'next') {
            const entries = Object.entries(getGuildBirthdays(message.guild.id));
            if (entries.length === 0) return message.reply("Aucun anniversaire enregistr\u00e9 !");
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
            const joursStr = diffDays === 0 ? "c'est aujourd'hui \ud83c\udf89" : diffDays === 1 ? "demain \ud83c\udf89" : `dans **${diffDays} jours**`;
            return message.reply(`\ud83c\udf82 Le prochain anniversaire est celui de **${name}** le **${next[1]}** — ${joursStr} !`);
        }

        const anniversaireFields = [
            { name: '!anniversaire set JJ/MM', value: 'Enregistre ton anniversaire.', inline: false },
            { name: '!anniversaire set Pseudo JJ/MM', value: "Enregistre l'anniversaire de quelqu'un.", inline: false },
            { name: '!anniversaire show', value: 'Affiche ton anniversaire enregistr\u00e9.', inline: false },
            { name: '!anniversaire list', value: 'Liste tous les anniversaires du serveur.', inline: false },
            { name: '!anniversaire next', value: 'Affiche le prochain anniversaire du serveur.', inline: false },
            { name: '!anniversaire remove', value: 'Supprime ton anniversaire enregistr\u00e9.', inline: false }
        ];
        if (message.author.id === '436218312574107658') {
            anniversaireFields.push({ name: '!anniversaire room [ID_SALON]', value: 'D\u00e9finit le salon d\'annonce des anniversaires pour ce serveur. (Toi uniquement)', inline: false });
        }
        const anniversaireEmbed = new EmbedBuilder()
            .setColor(0xff69b4)
            .setTitle('\ud83c\udf82 Anniversaire')
            .addFields(...anniversaireFields);
        return message.reply({ embeds: [anniversaireEmbed] });
    }

    // !topchef
    if (response?.needsTopChef) {
        const critiques = [
            // Dithyrambiques / Admiratives
            "L'équilibre des textures, la brillance du jus, la gourmandise absolue... Maïté verse une larme de fierté depuis là-haut. **19.5/20**",
            "C'est indécent tellement ça donne faim. Envoie une part en Colissimo immédiatement ou je porte plainte. **19/20**",
            "Visuel digne d'un restaurant 4 étoiles Michelin. C'est du grand art, respect au chef ! **18.5/20**",
            "C'est tellement beau que j'oserais même pas planter ma fourchette dedans, je mettrais l'assiette sous cadre au Louvre. **20/20**",
            "La cuisson est millimétrée, l'assaisonnement est chirurgical, un sans-faute remarquable. **18/20**",
            "Un chef-d'œuvre de pure gourmandise. Si tu ne m'invites pas à dîner cette semaine, je supprime ton compte Discord. **19.5/20**",
            "C'est croustillant, c'est fondant, ça donne envie d'engloutir mon écran. **17.5/20**",
            "Y a beaucoup trop de fromage fondu, ce qui signifie mathématiquement que c'est la perfection absolue. **18/20**",

            // Cauchemardesques / Cursed
            "On dirait le résultat d'une expérience clandestine dans un labo abandonné de Tchernobyl... mais bizarrement ça doit se manger. **4/20**",
            "C'est visuellement terrorisant, même un chien errant affamé ferait trois pas en arrière. Courage à ton système digestif. **2/20**",
            "Gordon Ramsay vient de voir la photo : il a immédiatement supprimé son compte Twitter et s'est retiré dans un monastère tibétain. **1/20**",
            "Philippe Etchebest vient de défoncer un mur rien qu'en regardant ce dressage. **3/20**",
            "C'est carbonisé à l'extérieur et encore congelé au milieu. Une véritable prouesse thermodynamique. **5/20**",
            "Je sais pas si ça se mange avec une fourchette ou si ça s'exorcise avec de l'eau bénite et un prêtre. **3.5/20**",
            "Le terme « intoxication alimentaire » a été inventé spécifiquement pour anticiper ce plat. **0.5/20**",
            "J'ai montré la photo à mon chat, il a instinctivement commencé à gratter autour de mon téléphone comme si c'était sa litière. **1.5/20**",
            "Le dressage ressemble fidèlement à un constat d'accident de la route réalisé par la gendarmerie (mais ACAB sinon). **4/20**",
            "Si tu survis à la digestion de ce truc sans passer 48h aux toilettes, tu deviens officiellement immortel. **6/20**",

            // Goofy / Réconfort / Absurdes
            "Le genre de plat que tu manges debout au-dessus de l'évier à 3h42 du matin en caleçon sans aucun regret. **14/20**",
            "Ça ressemble à un plat cuisiné par mon daron en pleine crise de panique, mais au fond j'ai très envie de goûter. **12/20**",
            "C'est pas de la grande cuisine, mais ça comble un vide existentiel. C'est totalement validé. **13.5/20**",
            "On sent tout l'amour et le désespoir d'une personne qui avait une flemme monumentale d'aller faire des courses. **12/20**",
            "C'est ultra gras, c'est lourd, ça va boucher 3 artères principales, mais on n'a qu'une seule vie après tout. **15/20**",
            "Visuellement c'est un 4/20, mais spirituellement et caloriquement parlant c'est un coup de génie. **14.5/20**",
            "Ça a l'air très suspect mais j'engloutirais l'assiette entière en 30 secondes chrono sans respirer. **16/20**",
            "La présentation rappelle celle d'un étudiant fauché un dimanche soir de pluie. C'est émouvant et poétique. **11.5/20**",
            "Ça ressemble au repas que servirait une tavernière de RPG pour restaurer 45 points de vie. **13/20**",
            "Plat officiellement validé par le tribunal de Regaïa, mais vigoureusement condamné par le ministère de la Santé. **12.5/20**",
            "Pour un plat improvisé à l'arrache dans le serv d'Epsys, c'est franchement honorable. **15/20**",
            "Ce plat dégage une énergie purement chaotique mais étrangement réconfortante. **14/20**",
            "C'est le plat officiel du seum du dimanche soir. Un grand classique de la cuisine. **16.5/20**"
        ];

        let cibleMembre = message.member;
        if (message.reference) {
            const repliedMsg = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
            if (repliedMsg && repliedMsg.member) {
                cibleMembre = repliedMsg.member;
            }
        } else if (message.mentions.members.first()) {
            cibleMembre = message.mentions.members.first();
        }

        const nom = cibleMembre?.displayName ?? message.author.username;
        const phrase = critiques[Math.floor(Math.random() * critiques.length)];

        const embed = new EmbedBuilder()
            .setColor(0xe67e22)
            .setTitle(`👨‍🍳 Le Verdict Top Chef pour ${nom}`)
            .setDescription(`${phrase}`)
            .setFooter({ text: '- Cacabot Critique Gastronomique' });

        return message.reply({ embeds: [embed] });
    }

    // !blague
    if (response?.needsBlague) {
        const authorId = message.author.id;
        const embed = new EmbedBuilder()
            .setColor(0xe91e63)
            .setTitle('\ud83e\udd23 Blagues')
            .setDescription('Choisis une cat\u00e9gorie !');

        const menu = new StringSelectMenuBuilder()
            .setCustomId(`blague_menu_${authorId}`)
            .setPlaceholder('Choisis une cat\u00e9gorie')
            .addOptions(
                { label: '\ud83d\ude0a Humour soft', value: 'soft' },
                { label: '\ud83d\ude04 Humour classique', value: 'classique' },
                { label: '\ud83d\udda4 Humour noir', value: 'noir' }
            );

        const row = new ActionRowBuilder().addComponents(menu);
        return message.reply({ embeds: [embed], components: [row] });
    }

    // !actif
    if (response?.needsActif) {
        cleanOldData();
        const authorId = message.author.id;

        const buildActifEmbed = (periode) => {
            const medals = ['\ud83e\udd47', '\ud83e\udd48', '\ud83e\udd49'];
            let counts, titre;
            if (periode === 'jour') {
                counts = dailyData[getTodayKey()] ?? {};
                titre = "\ud83d\udcc5 Membres les plus actifs aujourd'hui";
            } else if (periode === 'semaine') {
                counts = weeklyData[getWeekKey()] ?? {};
                titre = '\ud83d\udcc6 Membres les plus actifs cette semaine';
            } else {
                counts = monthlyData[getMonthKey()] ?? {};
                titre = '\ud83d\udcc6 Membres les plus actifs ce mois-ci';
            }
            const sorted = Object.entries(counts).filter(([uid]) => uid !== '1503495713097519355').sort((a, b) => b[1] - a[1]).slice(0, 10);
            const fields = sorted.length > 0
                ? sorted.map(([uid, count], i) => {
                    const member = message.guild.members.cache.get(uid);
                    const name = member?.displayName ?? 'Membre inconnu';
                    const medal = medals[i] ?? `**${i + 1}.**`;
                    return { name: `${medal} ${name}`, value: `${count} messages`, inline: false };
                })
                : [{ name: 'Aucune donn\u00e9e', value: 'Pas encore de messages !', inline: false }];
            return new EmbedBuilder().setColor(0xffd700).setTitle(titre).addFields(fields);
        };

        const buildActifRow = (periode) => {
            const jourBtn = new ButtonBuilder()
                .setCustomId(`actif_jour_${authorId}`)
                .setLabel('\ud83d\udcc5 Jour')
                .setStyle(periode === 'jour' ? ButtonStyle.Primary : ButtonStyle.Secondary);
            const semaineBtn = new ButtonBuilder()
                .setCustomId(`actif_semaine_${authorId}`)
                .setLabel('\ud83d\uddd3\ufe0f Semaine')
                .setStyle(periode === 'semaine' ? ButtonStyle.Primary : ButtonStyle.Secondary);
            const moisBtn = new ButtonBuilder()
                .setCustomId(`actif_mois_${authorId}`)
                .setLabel('\ud83d\udcc6 Mois')
                .setStyle(periode === 'mois' ? ButtonStyle.Primary : ButtonStyle.Secondary);
            return new ActionRowBuilder().addComponents(jourBtn, semaineBtn, moisBtn);
        };

        return message.reply({ embeds: [buildActifEmbed('jour')], components: [buildActifRow('jour')] });
    }

    // !top
    if (response?.needsTop) {
        const allSorted = Object.entries(topData.messages)
            .sort((a, b) => b[1] - a[1]);

        if (allSorted.length === 0) return message.reply("Pas encore de données !");

        const PAGE_SIZE = 10;
        const totalPages = Math.ceil(allSorted.length / PAGE_SIZE);
        const authorId = message.author.id;

        const buildTopEmbed = (page) => {
            const start = page * PAGE_SIZE;
            const slice = allSorted.slice(start, start + PAGE_SIZE);
            const medals = ['🥇', '🥈', '🥉'];
            const fields = slice.map(([uid, count], i) => {
                const member = message.guild.members.cache.get(uid);
                const name = member ? member.displayName : null;
                if (!name) return null;
                const rank = start + i;
                const medal = rank < 3 ? medals[rank] : `**${rank + 1}.**`;
                return { name: `${medal} ${name}`, value: `${count} messages`, inline: false };
            }).filter(Boolean);

            const userRank = allSorted.findIndex(([uid]) => uid === authorId);
            const userCount = topData.messages[authorId] || 0;
            let infoPerso = '';

            if (userRank !== -1) {
                const position = userRank + 1;
                if (userRank >= 10 && allSorted[9]) {
                    const diff = (allSorted[9][1] - userCount) + 1;
                    infoPerso = `> 👤 **Ta position :** **#${position}** avec **${userCount} messages** *(à ${diff} message${diff > 1 ? 's' : ''} du Top 10 !)*\n\n`;
                } else {
                    infoPerso = `> 👤 **Ta position :** **#${position}** avec **${userCount} messages** *(Tu es dans le Top 10 ! 🔥)*\n\n`;
                }
            }

            return new EmbedBuilder()
                .setColor(0xffd700)
                .setTitle('🏆 Classement des membres')
                .setDescription(infoPerso)
                .addFields(fields)
                .setFooter({ text: `Page ${page + 1}/${totalPages} • Compté depuis l'initialisation du bot` });
        };

        const buildTopRow = (page) => {
            const prev = new ButtonBuilder()
                .setCustomId(`top_prev_${authorId}_${page}`)
                .setLabel('\u2b05\ufe0f Arrière')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === 0);
            const next = new ButtonBuilder()
                .setCustomId(`top_next_${authorId}_${page}`)
                .setLabel('Suivant \u27a1\ufe0f')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page >= totalPages - 1);
            return new ActionRowBuilder().addComponents(prev, next);
        };

        return message.reply({ embeds: [buildTopEmbed(0)], components: totalPages > 1 ? [buildTopRow(0)] : [] });
    }

    // !setmessages
    if (response?.needsSetMessages) {
        const args = message.content.trim().split(/\s+/);
        const count = parseInt(args[args.length - 1]);

        // Accepte soit un @mention soit un ID brut
        const cible = message.mentions.users.first();
        const targetId = cible ? cible.id : args[1];

        if (!targetId || isNaN(count)) {
            return message.reply("Usage : `!setmessages @Membre NombreDeMessages` ou `!setmessages ID NombreDeMessages`");
        }

        topData.messages[targetId] = count;
        saveAll();

        const member = message.guild?.members.cache.get(targetId);
        const nom = member?.displayName ?? targetId;
        return message.reply(`\u2705 **${nom}** : ${count} messages enregistr\u00e9s !`);
    }

    // hé petit
    if (response?.needsHePetit) {
        await message.reply({ files: ['./monty.gif'] });
        await message.channel.send({ files: ['./' + 'h\u00e9 petit.mp3'] });
        return;
    }

    // jtm cacabot
    if (response?.needsJtm) {
        const auteurNom = message.member?.displayName ?? message.author.username;
        return message.reply(`Moi aussi jtm **${auteurNom}** \u2764\ufe0f`);
    }

    // !horoscope
    if (response?.needsHoroscope) {
        const args = message.content.trim().split(/\s+/);
        const forcedChannelId = args[1] && message.author.id === '436218312574107658' ? args[1] : null;
        let targetChannel = message.channel;
        if (forcedChannelId) {
            try {
                targetChannel = await client.channels.fetch(forcedChannelId);
                if (!targetChannel) return message.reply('Salon introuvable.');
            } catch (e) {
                return message.reply('Salon introuvable.');
            }
        }
        const now = new Date();
        const dateKey = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
        const dateStr = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

        const signes = [
            { nom: 'B\u00e9lier', emoji: '\u2648' },
            { nom: 'Taureau', emoji: '\u2649' },
            { nom: 'G\u00e9meaux', emoji: '\u264a' },
            { nom: 'Cancer', emoji: '\u264b' },
            { nom: 'Lion', emoji: '\u264c' },
            { nom: 'Vierge', emoji: '\u264d' },
            { nom: 'Balance', emoji: '\u264e' },
            { nom: 'Scorpion', emoji: '\u264f' },
            { nom: 'Sagittaire', emoji: '\u2650' },
            { nom: 'Capricorne', emoji: '\u2651' },
            { nom: 'Verseau', emoji: '\u2652' },
            { nom: 'Poissons', emoji: '\u2653' },
            { nom: 'Loutre', emoji: '\ud83e\udda6' },
        ];

        const description = signes.map((s, i) => {
            const horoscope = getHoroscopeForSign(i, dateKey);
            return `${s.emoji} **${s.nom}**\n${horoscope}`;
        }).join('\n\n');

        const embed = new EmbedBuilder()
            .setColor(0x2c2f33)
            .setTitle('\ud83d\udd2e Horoscope du jour')
            .setDescription(description)
            .setThumbnail('https://cdn.discordapp.com/attachments/1128032964924670053/1505637234596905080/color-replaced.png')
            .setFooter({ text: `\ud83d\udcc5 ${dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}` });

        if (forcedChannelId) {
            const titres = [
                '# HOROSCOPE DU JOUR \ud83d\udd2e',
                "# L'ORACLE A PARL\u00c9 \ud83d\udd2e",
                '# LES ASTRES ONT PARL\u00c9 \ud83d\udd2e',
                '# LES \u00c9TOILES ONT PARL\u00c9 \ud83d\udd2e',
                "# L'UNIVERS NOUS ENVOIE SES SIGNES \ud83d\udd2e",
            ];
            const titre = titres[Math.floor(Math.random() * titres.length)];
            await targetChannel.send(titre);
            await targetChannel.send({ embeds: [embed] });
            return message.react('✅');
        }
        return message.reply({ embeds: [embed] });
    }

    // !save
    if (response?.needsSave) {
        if (message.author.id !== '436218312574107658') return;
        await saveAll();
        return message.reply('\ud83d\udcbe Sauvegarde forc\u00e9e effectu\u00e9e !');
    }

    // !helpx
    if (response?.needsHelpx) {
        if (message.author.id !== '436218312574107658') {
            return message.reply("Tu n'es pas autoris\u00e9(e) \u00e0 faire cette commande.");
        }
        const embed = buildHelpxPresentationEmbed();
        const row = new ActionRowBuilder().addComponents(buildHelpxMenu(message.author.id));
        return message.reply({ embeds: [embed], components: [row] });
    }

    /// !prune

    if (response?.needsPrune) {
    const member = message.guild.members.cache.get(message.author.id);
    const canKick = member?.permissions.has('KickMembers');
    if (!canKick) return message.reply("Tu n'as pas les permissions nécessaires pour faire ça !");

    const args = message.content.trim().split(/\s+/);
    const count = parseInt(args[1]);

    if (!count || count <= 0) return message.reply("Usage : `!prune X` — supprime les X derniers messages.");

    if (count > 100) {
        const embed = new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle('⚠️ Limite dépassée')
            .setDescription(`Discord ne permet pas de supprimer plus de **100 messages** à la fois.\n\nTu veux supprimer **${count} messages** — il faudra donc **${Math.ceil(count / 100)} suppressions** successives.\n\n**Je gère** : Cacabot enchaîne les suppressions automatiquement.\n**Je gère moi-même** : Cacabot s'arrête là, tu refais \`!prune 100\` autant de fois que nécessaire.`);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`prune_auto_${message.author.id}_${count}_${message.channel.id}`)
                .setLabel('🤖 Laisser Cacabot gérer')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`prune_manual_${message.author.id}`)
                .setLabel('✋ Je gère')
                .setStyle(ButtonStyle.Secondary)
        );

        return message.reply({ embeds: [embed], components: [row] });
    }

    try {
        const messages = await message.channel.messages.fetch({ limit: count + 1 });
        const toDelete = messages.filter(m => {
            const age = Date.now() - m.createdTimestamp;
            return age < 14 * 24 * 60 * 60 * 1000;
        });
        await message.channel.bulkDelete(toDelete, true);
        await message.delete().catch(() => {});
    } catch (e) {
        return message.channel.send("Erreur lors de la suppression. Les messages de plus de 14 jours ne peuvent pas être supprimés en bulk.");
    }
    return;
}

    // !pomodoro
    if (response?.needsPomodoro) {
    const args = message.content.trim().split(/\s+/);

    if (args[1]?.toLowerCase() === 'stop') {
        if (!pomodoroSessions.has(message.channel.id)) {
            return message.reply("Aucun pomodoro en cours dans ce salon !");
        }
        const stopSession = pomodoroSessions.get(message.channel.id);
        clearTimeout(stopSession.timeout);
        clearInterval(stopSession.updateInterval);
        if (stopSession?.message) await stopSession.message.delete().catch(() => {});
        pomodoroSessions.delete(message.channel.id);
        return message.reply("🍅 Pomodoro arrêté !");
    }

    if (pomodoroSessions.has(message.channel.id)) {
        return message.reply("Un pomodoro est déjà en cours dans ce salon ! Utilise `!pomodoro stop` pour l'arrêter.");
    }

    const workMenu = new StringSelectMenuBuilder()
        .setCustomId(`pomo_setup_work_${message.author.id}_${message.channel.id}`)
        .setPlaceholder('Durée de travail...')
        .addOptions([5,10,15,20,25,30,35,40,45,50,55,60].map(n => ({
            label: `${n} minutes`, value: `${n}`
        })));

    const breakMenu = new StringSelectMenuBuilder()
        .setCustomId(`pomo_setup_break_${message.author.id}_${message.channel.id}`)
        .setPlaceholder('Durée de pause...')
        .addOptions([5,10,15,20,25,30].map(n => ({
            label: `${n} minutes`, value: `${n}`
        })));

        const reasonMenu = new StringSelectMenuBuilder()
        .setCustomId(`pomo_setup_reason_${message.author.id}_${message.channel.id}`)
        .setPlaceholder('Raison du pomodoro...')
        .addOptions([
            { label: 'Devoirs', value: 'Devoirs', emoji: '📚' },
            { label: 'Montage', value: 'Montage', emoji: '🎬' },
            { label: 'Composition', value: 'Composition', emoji: '🎵' },
            { label: 'Écriture', value: 'Écriture', emoji: '✍️' },
            { label: 'Code', value: 'Code', emoji: '💻' },
        ]);

    const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('🍅 Configurer le Pomodoro')
        .setDescription('Choisis la durée de travail et la durée de pause !')
        .addFields(
            { name: '⏱️ Travail', value: 'Non défini', inline: true },
            { name: '⏸️ Pause', value: 'Non défini', inline: true },
            { name: '🎯 Raison', value: 'Non défini', inline: true }
        );

    return message.reply({ embeds: [embed], components: [
        new ActionRowBuilder().addComponents(workMenu),
        new ActionRowBuilder().addComponents(breakMenu),
        new ActionRowBuilder().addComponents(reasonMenu)
    ]});
}

    // !lastsave
    if (response?.needsLastsave) {
        if (message.author.id !== '436218312574107658') return;
        if (!lastsaveSaveTime) return message.reply('Aucune sauvegarde effectu\u00e9e depuis le d\u00e9marrage.');
        const diff = Date.now() - lastsaveSaveTime;
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        const dateStr = lastsaveSaveTime.toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
        return message.reply(`\ud83d\udcbe Derni\u00e8re sauvegarde : **${dateStr}** (il y a ${mins}min ${secs}s)`);
    }

    // !say
    if (response?.needsSay) {
        if (message.author.id !== '436218312574107658') return;
        const args = message.content.trim().split(/\s+/);
        if (args.length < 3) return message.reply({ content: "Usage : `!say [ID_salon] [message]`", ephemeral: true });
        const channelId = args[1];
        const texte = args.slice(2).join(' ');
        try {
            const target = await client.channels.fetch(channelId);
            if (!target) return message.reply('Salon introuvable.');
            await target.send(texte);
            await message.delete().catch(() => {});
        } catch (e) {
            return message.reply('Erreur : salon introuvable ou permissions insuffisantes.');
        }
        return;
    }

    // !streamtest (Epsys-only)
    if (response?.needsStreamTest) {
        if (message.author.id !== '436218312574107658') return;
        try {
            const payload = await buildTwitchLivePayload();
            // Répond directement à ton message dans le salon actuel, sans ping le rôle pour garder le test secret
            await message.reply({
                ...payload,
                allowedMentions: { repliedUser: false, parse: [] }
            });
            return message.react('🟣').catch(() => {});
        } catch (err) {
            console.error('Erreur !streamtest :', err);
            return message.reply(`❌ Erreur lors du test : \`${err.message}\``);
        }
    }

    // !edit (Epsys-only)
    if (response?.needsEdit) {
        if (message.author.id !== '436218312574107658') return;
        const args = message.content.trim().split(/\s+/);
        if (args.length < 3) return message.reply({ content: "Usage : `!edit [ID_du_message] [nouveau texte]`", ephemeral: true });

        const msgId = args[1];
        const nouveauTexte = message.content.replace(/^!edit\s+\d+\s+/i, '').trim();

        try {
            // Cherche dans le salon actuel d'abord
            let targetMsg = await message.channel.messages.fetch(msgId).catch(() => null);

            // Si introuvable ici, cherche dans les autres salons textuels du serveur
            if (!targetMsg && message.guild) {
                for (const ch of message.guild.channels.cache.values()) {
                    if (ch.type === ChannelType.GuildText || ch.type === ChannelType.GuildAnnouncement) {
                        targetMsg = await ch.messages.fetch(msgId).catch(() => null);
                        if (targetMsg) break;
                    }
                }
            }

            if (!targetMsg) return message.reply("Message introuvable ! Vérifie l'ID.");
            if (targetMsg.author.id !== client.user.id) return message.reply("Je ne peux modifier que mes propres messages !");

            await targetMsg.edit({ content: nouveauTexte });
            await message.delete().catch(() => {});
        } catch (err) {
            console.error("Erreur !edit :", err);
            return message.reply("Impossible de modifier ce message.");
        }
        return;
    }

    // !embed (Epsys-only)
    if (response?.needsEmbed) {
        if (message.author.id !== '436218312574107658') return;
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('open_embed_modal')
                .setLabel('📝 Ouvrir le formulaire d\'embed')
                .setStyle(ButtonStyle.Primary)
        );
        return message.reply({ content: "Clique ci-dessous pour ouvrir le créateur d'embed :", components: [row] });
    }

    // !rolereac (Epsys-only)
    if (response?.needsRoleReac) {
        if (message.author.id !== '436218312574107658') return;
        const args = message.content.trim().split(/\s+/);

        if (args[1]?.toLowerCase() === 'list') {
            const listMsg = Object.entries(reactionRolesData);
            if (listMsg.length === 0) return message.reply("Aucun rôle réaction n'est configuré.");
            const lignes = listMsg.map(([mId, data]) => {
                const rolesLignes = Object.entries(data.roles).map(([em, rId]) => `• ${em} ➔ <@&${rId}>`).join('\n');
                return `📍 Message: \`${mId}\` (dans <#${data.channelId}>) :\n${rolesLignes}`;
            });
            const embed = new EmbedBuilder().setColor(0x5865f2).setTitle('🎭 Rôles Réaction Actifs').setDescription(lignes.join('\n\n'));
            return message.reply({ embeds: [embed] });
        }

        if (args[1]?.toLowerCase() === 'remove') {
            const msgId = args[2];
            const emojiStr = args[3];
            if (!msgId || !emojiStr) return message.reply("Usage : `!rolereac remove [ID_message] [emoji]`");
            if (!reactionRolesData[msgId] || !reactionRolesData[msgId].roles[emojiStr]) {
                return message.reply("Ce rôle réaction n'existe pas sur ce message.");
            }
            delete reactionRolesData[msgId].roles[emojiStr];
            if (Object.keys(reactionRolesData[msgId].roles).length === 0) delete reactionRolesData[msgId];
            demanderSauvegarde();
            return message.reply(`🗑️ Rôle réaction supprimé pour l'emoji ${emojiStr} sur le message \`${msgId}\`.`);
        }

        if (args.length < 4) {
            return message.reply("Usage :\n• Ajouter : `!rolereac [ID_message] [emoji] [@rôle / ID_rôle]`\n• Retirer : `!rolereac remove [ID_message] [emoji]`\n• Liste : `!rolereac list`");
        }

        const msgId = args[1];
        const emojiStr = args[2];
        const roleArg = args[3];
        const roleId = roleArg.replace(/<@&|>/g, '');
        const role = message.guild?.roles.cache.get(roleId);
        if (!role) return message.reply("Rôle introuvable ! Vérifie la mention ou l'ID.");

        try {
            let targetMsg = await message.channel.messages.fetch(msgId).catch(() => null);
            let targetChannel = message.channel;

            if (!targetMsg && message.guild) {
                for (const ch of message.guild.channels.cache.values()) {
                    if (ch.isTextBased()) {
                        targetMsg = await ch.messages.fetch(msgId).catch(() => null);
                        if (targetMsg) { targetChannel = ch; break; }
                    }
                }
            }

            if (!targetMsg) return message.reply("Message introuvable sur le serveur ! Vérifie l'ID.");

            // Le bot réagit sous le message
            await targetMsg.react(emojiStr).catch(() => {});

            if (!reactionRolesData[msgId]) {
                reactionRolesData[msgId] = { channelId: targetChannel.id, roles: {} };
            }
            reactionRolesData[msgId].roles[emojiStr] = role.id;
            demanderSauvegarde();

            await message.delete().catch(() => {});
            const conf = await message.channel.send(`✅ Rôle réaction configuré : ${emojiStr} donnera le rôle **${role.name}** sur le message [clique ici](${targetMsg.url}) !`);
        } catch (err) {
            return message.reply(`❌ Erreur : ${err.message}`);
        }
        return;
    }

    // !rolebtn (Epsys-only)
    if (response?.needsRoleBtn) {
        if (message.author.id !== '436218312574107658') return;
        const args = message.content.trim().split(/\s+/);
        const sub = args[1]?.toLowerCase();

        if (sub !== 'add' && sub !== 'remove') {
            return message.reply(
                "**Usage :**\n" +
                "• **Ajouter un bouton :** `!rolebtn add [ID_message] [@rôle] [couleur optionnelle] [Texte avec ou sans emoji]`\n" +
                "• **Supprimer un bouton :** `!rolebtn remove [ID_message] [@rôle]`\n\n" +
                "*Couleurs disponibles : bleu, mauve, vert, rouge, rose, orange, gris, blanc, jaune...*"
            );
        }

        const msgId = args[2];
        const roleArg = args[3];
        if (!msgId || !roleArg) return message.reply("Paramètres manquants ! Vérifie l'ID du message et le rôle.");

        const roleId = roleArg.replace(/<@&|>/g, '');
        const role = message.guild?.roles.cache.get(roleId);
        if (!role) return message.reply("Rôle introuvable ! Vérifie la mention ou l'ID.");

        // Recherche du message envoyé par Cacabot
        let targetMsg = await message.channel.messages.fetch(msgId).catch(() => null);
        if (!targetMsg && message.guild) {
            for (const ch of message.guild.channels.cache.values()) {
                if (ch.isTextBased()) {
                    targetMsg = await ch.messages.fetch(msgId).catch(() => null);
                    if (targetMsg) break;
                }
            }
        }

        if (!targetMsg) return message.reply("Message introuvable ! Vérifie l'ID.");
        if (targetMsg.author.id !== client.user.id) {
            return message.reply("Je ne peux ajouter des boutons que sur mes **propres messages** (par exemple créés avec `/embed` ou `!say`) !");
        }

        // --- Cas de suppression ---
        if (sub === 'remove') {
            const rows = targetMsg.components.map(row => {
                const newRow = ActionRowBuilder.from(row);
                newRow.setComponents(row.components.filter(c => c.customId !== `rolebtn_${role.id}`));
                return newRow;
            }).filter(row => row.components.length > 0);

            await targetMsg.edit({ components: rows }).catch(err => message.reply(`Erreur : ${err.message}`));
            await message.delete().catch(() => {});
            return message.channel.send(`🗑️ Bouton de rôle pour **${role.name}** retiré du message !`);
        }

        // --- Cas d'ajout ---
        let resteArgs = args.slice(4);
        let style = ButtonStyle.Secondary; // Gris par défaut

        const couleurMap = {
            bleu: ButtonStyle.Primary, mauve: ButtonStyle.Primary, violet: ButtonStyle.Primary, primary: ButtonStyle.Primary,
            vert: ButtonStyle.Success, success: ButtonStyle.Success,
            rouge: ButtonStyle.Danger, rose: ButtonStyle.Danger, danger: ButtonStyle.Danger,
            gris: ButtonStyle.Secondary, blanc: ButtonStyle.Secondary, noir: ButtonStyle.Secondary, secondary: ButtonStyle.Secondary,
            jaune: ButtonStyle.Secondary, orange: ButtonStyle.Danger, marron: ButtonStyle.Secondary
        };

        const premierMot = resteArgs[0]?.toLowerCase();
        if (premierMot && couleurMap[premierMot]) {
            style = couleurMap[premierMot];
            resteArgs.shift(); // On retire le mot de couleur pour ne garder que le texte
        }

        let texteBrut = resteArgs.join(' ').trim();
        if (!texteBrut) texteBrut = role.name;

        // Détection automatique d'un emoji en début de texte (ex: "🎮 Gamer" -> emoji: 🎮, label: "Gamer")
        let emoji = null;
        let label = texteBrut;
        const emojiMatch = texteBrut.match(/^((?:<a?:\w+:\d+>|\p{Extended_Pictographic}\uFE0F?))\s*(.*)$/u);
        if (emojiMatch) {
            emoji = emojiMatch[1];
            label = emojiMatch[2].trim() || role.name;
        }

        const newBtn = new ButtonBuilder()
            .setCustomId(`rolebtn_${role.id}`)
            .setStyle(style);

        if (label) newBtn.setLabel(label);
        if (emoji) newBtn.setEmoji(emoji);

        // Reconstruction des lignes de boutons (max 5 par ligne, max 25 au total)
        const rows = targetMsg.components.map(r => ActionRowBuilder.from(r));
        let placeTrouvee = false;

        // Vérifie si le bouton existe déjà pour le mettre à jour
        for (const row of rows) {
            const index = row.components.findIndex(c => c.data.custom_id === `rolebtn_${role.id}`);
            if (index !== -1) {
                row.components[index] = newBtn;
                placeTrouvee = true;
                break;
            }
        }

        // Sinon l'ajouter à la dernière ligne ou en créer une nouvelle
        if (!placeTrouvee) {
            let derniereLigne = rows[rows.length - 1];
            if (derniereLigne && derniereLigne.components.length < 5) {
                derniereLigne.addComponents(newBtn);
            } else if (rows.length < 5) {
                rows.push(new ActionRowBuilder().addComponents(newBtn));
            } else {
                return message.reply("Limite atteinte : ce message a déjà le maximum de 25 boutons !");
            }
        }

        await targetMsg.edit({ components: rows }).catch(err => message.reply(`Erreur : ${err.message}`));
        await message.delete().catch(() => {});
        return message.channel.send(`✅ Bouton de rôle pour **${role.name}** ajouté avec succès sur le message !`);
    }

    // !rappel
    if (response?.needsRappel) {
        const args = message.content.trim().split(/\s+/);
        const isEpsys = message.author.id === '436218312574107658';

        const sub = args[1]?.toLowerCase();

        if (sub === 'list') {
            const mine = [...pendingRappels.entries()].filter(([, r]) => r.targetId === message.author.id);
            if (mine.length === 0) return message.reply("Tu n'as aucun rappel en attente !");

            const fields = mine
                .sort((a, b) => a[1].triggerAt - b[1].triggerAt)
                .map(([id, r]) => {
                    const remainingMs = r.triggerAt - Date.now();
                    const mins = Math.max(0, Math.floor(remainingMs / 60000));
                    const secs = Math.max(0, Math.floor((remainingMs % 60000) / 1000));
                    const dansStr = mins > 0 ? `dans ${mins}min ${secs}s` : `dans ${secs}s`;
                    return { name: r.texte, value: dansStr, inline: false };
                });

            const embed = new EmbedBuilder()
                .setColor(0x5865f2)
                .setTitle('⏰ Tes rappels en attente')
                .addFields(fields);
            return message.reply({ embeds: [embed] });
        }

        if (sub === 'remove') {
            const query = args.slice(2).join(' ').toLowerCase();
            if (!query) return message.reply('Usage : `!rappel remove [nom du rappel]`');

            const mine = [...pendingRappels.entries()].filter(([, r]) => r.targetId === message.author.id);
            const match = mine.find(([, r]) => r.texte.toLowerCase() === query)
                ?? mine.find(([, r]) => r.texte.toLowerCase().includes(query));

            if (!match) return message.reply("Aucun rappel correspondant trouvé !");

            const [id, r] = match;
            clearTimeout(r.timeout);
            pendingRappels.delete(id);
            return message.reply(`🗑️ Rappel supprimé : **${r.texte}**`);
        }

        // Détecter si c'est !rappel [ID] Xmin/h [message] (Epsys only)
        const looksLikeId = args[1] && /^\d{17,19}$/.test(args[1]);

        if (looksLikeId && !isEpsys) {
            return message.reply("Tu n'es pas autoris\u00e9(e) \u00e0 utiliser cette variante de la commande.");
        }

        let targetId, timeStr, texte;

        if (looksLikeId && isEpsys) {
            // !rappel [ID] Xmin [message]
            if (args.length < 4) return message.reply('Usage : `!rappel [ID] Xmin/h [message]`');
            targetId = args[1];
            timeStr = args[2].toLowerCase();
            texte = args.slice(3).join(' ');
        } else {
            // !rappel Xmin [message]
            if (args.length < 3) return message.reply('Usage : `!rappel Xmin message` ou `!rappel Xh message`');
            targetId = message.author.id;
            timeStr = args[1].toLowerCase();
            texte = args.slice(2).join(' ');
        }

        let ms = 0;
        if (timeStr.endsWith('min')) ms = parseInt(timeStr) * 60 * 1000;
        else if (timeStr.endsWith('h')) ms = parseInt(timeStr) * 60 * 60 * 1000;
        else if (timeStr.endsWith('s')) ms = parseInt(timeStr) * 1000;
        else return message.reply('Format invalide ! Utilise `Xmin`, `Xh` ou `Xs`. Ex: `!rappel 10min acheter du pain`');
        if (isNaN(ms) || ms <= 0) return message.reply('Dur\u00e9e invalide !');
        if (ms > 24 * 60 * 60 * 1000) return message.reply('Maximum 24h !');

        await message.reply(`\u23f0 Rappel enregistr\u00e9 ! Je ping <@${targetId}> dans **${timeStr}**.`);
        scheduleRappel(message.channel.id, targetId, texte, ms);
        return;
    }

    // !ping
    if (response?.needsPing) {
        const sent = await message.reply('\ud83c\udfd3 Pong !');
        const latence = sent.createdTimestamp - message.createdTimestamp;
        const wsLatence = client.ws.ping;
        const embed = new EmbedBuilder()
            .setColor(latence < 100 ? 0x2ecc71 : latence < 250 ? 0xf39c12 : 0xe74c3c)
            .setTitle('\ud83c\udfd3 Pong !')
            .addFields(
                { name: '\ud83d\udce8 Latence', value: `${latence}ms`, inline: true },
                { name: '\ud83d\udd0c WebSocket', value: `${wsLatence}ms`, inline: true }
            );
        return sent.edit({ content: null, embeds: [embed] });
    }

    // !météo
    if (response?.needsMeteo) {
        const args = message.content.trim().split(/\s+/);
        const ville = args.slice(1).join(' ');
        if (!ville) return message.reply('Usage : `!météo [ville]`\nEx : `!météo Paris`');

        try {
            const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(ville)}&count=1&language=fr&format=json`);
            const geoData = await geoRes.json();

            if (!geoData.results || geoData.results.length === 0) {
                return message.reply(`Ville introuvable : **${ville}**`);
            }

            const { latitude, longitude, name, country } = geoData.results[0];

            const meteoRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`);
            const meteoData = await meteoRes.json();
            const current = meteoData.current;

            const weatherDesc = {
                0: '☀️ Ciel dégagé', 1: '🌤️ Plutôt dégagé', 2: '⛅ Partiellement nuageux', 3: '☁️ Couvert',
                45: '🌫️ Brouillard', 48: '🌫️ Brouillard givrant',
                51: '🌦️ Bruine légère', 53: '🌦️ Bruine', 55: '🌦️ Bruine forte',
                61: '🌧️ Pluie légère', 63: '🌧️ Pluie', 65: '🌧️ Pluie forte',
                71: '🌨️ Neige légère', 73: '🌨️ Neige', 75: '🌨️ Neige forte',
                80: '🌦️ Averses', 81: '🌦️ Averses fortes', 82: '⛈️ Averses violentes',
                95: '⛈️ Orage', 96: '⛈️ Orage avec grêle', 99: '⛈️ Orage violent avec grêle'
            };
            const description = weatherDesc[current.weather_code] || 'Conditions inconnues';

            // Heure locale sur place (format HHhMM)
            const localTime = current.time.split('T')[1]; // "18:59"
            const [heureLocale, minLocale] = localTime.split(':');
            const heureFormatee = `${heureLocale}h${minLocale}`;

            const embed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle(`🌍 Météo à ${name}${country ? ', ' + country : ''}`)
                .setDescription(description)
                .addFields(
                    { name: '🌡️ Température', value: `${current.temperature_2m}°C (ressenti ${current.apparent_temperature}°C)`, inline: true },
                    { name: '💧 Humidité', value: `${current.relative_humidity_2m}%`, inline: true },
                    { name: '💨 Vent', value: `${current.wind_speed_10m} km/h`, inline: true },
                    { name: '🕒 Heure locale', value: heureFormatee, inline: true }
                )
                .setFooter({ text: 'Données via Open-Meteo' })
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        } catch (e) {
            console.error('Erreur !meteo :', e);
            return message.reply("Erreur lors de la récupération de la météo. Réessaie plus tard.");
        }
    }

    // !info
    if (response?.needsInfo) {
        const startDate = new Date('2026-05-14T00:00:00');
        const now = new Date();
        const diff = now - startDate;

        const totalSeconds = Math.floor(diff / 1000);
        const totalMinutes = Math.floor(totalSeconds / 60);
        const totalHours = Math.floor(totalMinutes / 60);
        const totalDays = Math.floor(totalHours / 24);

        const months = Math.floor(totalDays / 30);
        const days = totalDays % 30;
        const hours = totalHours % 24;

        let uptime = '';
        if (months > 0) uptime += `${months} mois, `;
        if (months > 0 || days > 0) uptime += `${days} jour${days > 1 ? 's' : ''}, `;
        uptime += `${hours} heure${hours > 1 ? 's' : ''}`;

        const nbMembres = Object.keys(topData.messages).length;
        const nbCommandes = 30;

        const commitCount = await getCommitCount();
        const versionStr = commitCount ? `Version 1.${commitCount}` : 'Version inconnue';

        const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle('\ud83e\udd16 Infos de Cacabot')
            .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                { name: '\ud83d\udcbb Commandes', value: `${nbCommandes}`, inline: true },
                { name: '\ud83d\udcac Messages envoy\u00e9s', value: `${topData.messages['1503495713097519355']}`, inline: true },
                { name: '\u200b', value: '\u200b', inline: true },
                { name: '\ud83d\udc51 Cr\u00e9atrice', value: 'Epsys', inline: true },
                { name: '\ud83e\udd1d Collaboratrice', value: '[BDN](https://bdn-fr.xyz/)', inline: true },
                { name: '\u200b', value: '\u200b', inline: true },
                { name: '\ud83d\udcdf Version', value: versionStr, inline: true },
                { name: '\ud83d\udd52 En ligne depuis', value: uptime, inline: true },
                { name: '\u200b', value: '\u200b', inline: true }
            );

        return message.reply({ embeds: [embed] });
    }

    // !serveur
    if (response?.needsServeur) {
        const guild = message.guild;
        if (!guild) return;

        await guild.fetch();
        const owner = await guild.fetchOwner();

        const createdAt = guild.createdAt.toLocaleDateString('fr-FR', {
            day: 'numeric', month: 'long', year: 'numeric'
        });

        const embed = new EmbedBuilder()
            .setColor(0x00ebff)
            .setTitle(guild.name)
            .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
            .setDescription(guild.description || '*Aucune description*')
            .addFields(
                { name: '\ud83d\udc51 Propri\u00e9taire', value: owner.user.tag, inline: true },
                { name: '\ud83d\udcc5 Cr\u00e9ation', value: createdAt, inline: true },
                { name: '\u200b', value: '\u200b', inline: true },
                { name: '\ud83d\udc65 Membres', value: `${guild.memberCount}`, inline: true },
                { name: '\ud83d\udcac Salons', value: `${guild.channels.cache.size}`, inline: true },
                { name: '\ud83c\udff7\ufe0f R\u00f4les', value: `${guild.roles.cache.size}`, inline: true },
                { name: '\ud83d\ude80 Niveau de boost', value: `Niveau ${guild.premiumTier}`, inline: true },
                { name: '\ud83d\udcab Boosts', value: `${guild.premiumSubscriptionCount}`, inline: true },
                { name: '\ud83c\udd94 ID', value: guild.id, inline: true }
            )
            .addFields(
                { name: '\u200b', value: '[\ud83d\udd17 Lien d\'invitation du serveur](https://discord.com/invite/maAbUYb)', inline: false }
            );

        return message.reply({ embeds: [embed] });
    }

    // !question
    if (response?.needsQuestion) {
        const embed = new EmbedBuilder()
            .setColor(0x9b59b6)
            .setTitle("\u2753 Question du soir")
            .setDescription("Choisis une cat\u00e9gorie pour recevoir une question al\u00e9atoire !");

        const menu = new StringSelectMenuBuilder()
            .setCustomId('question_menu')
            .setPlaceholder('Choisis une cat\u00e9gorie')
            .addOptions(
                { label: '\ud83d\udde3\ufe0f D\u00e9bats / Opinions', value: 'debats' },
                { label: '\ud83e\udd2b Confession / Introspection', value: 'confession' },
                { label: '\ud83e\udd14 Hypoth\u00e9tiques', value: 'hypothetiques' },
                { label: '\ud83c\udfe0 Sp\u00e9ciales Rega\u00efa', value: 'serveur' },
                { label: '\ud83e\udde0 Philosophie de comptoir', value: 'philosophie' },
                { label: '\ud83c\udfb2 Al\u00e9atoires / Chaos', value: 'aleatoires' }
            );

        const row = new ActionRowBuilder().addComponents(menu);
        return message.reply({ embeds: [embed], components: [row] });
    }

    // !help
    if (response?.needsHelp) {
        const embed = buildHelpHomeEmbed();
        const menuRow = buildHelpMenu(message.author.id, message.id);
        const navRow = buildHelpNavRow(message.author.id, message.id);
        return message.reply({ embeds: [embed], components: [menuRow, navRow] });
    }

    // Réponse texte simple
    if (response && typeof response === "object" && response.files) {
        return message.reply({ files: response.files });
    }

    if (typeof response === "string") {
        if (response.trim().length === 0) return;
        const finAntiFeur = rouletteAntiFeurUntil.get(message.author.id);

        // Le bouclier Anti-Feur ne s'active que sur les répliques réflexes (quoi, qui, oui, non...), jamais sur les commandes avec !
        if (!isExplicitCommand && finAntiFeur && Date.now() < finAntiFeur) {
            const d = (rouletteAntiFeurDodges.get(message.author.id) || 0) + 1;
            rouletteAntiFeurDodges.set(message.author.id, d);
            if (d >= 5) deverrouillerSucces(message.author.id, 'tete-dure', message.channel);
            return message.react('🛡️').catch(() => {});
        }
        const autoReplyMsg = await message.reply({ content: response });
        if (pendingCheh.has(message.channel.id)) clearTimeout(pendingCheh.get(message.channel.id).timeout);
        const chehTimeout = setTimeout(() => { pendingCheh.delete(message.channel.id); }, 10000);
        pendingCheh.set(message.channel.id, { timeout: chehTimeout, replyMsg: autoReplyMsg });
        return;
    }
});



    // =========================
    //     LISTENER INTERACTIONS
    // =========================

client.on('interactionCreate', async (interaction) => {
try {

    // =========================
    //   COMMANDES SLASH (/)
    // =========================
    if (interaction.isChatInputCommand()) {
        if (interaction.guildId !== '720057528351850547') {
            return interaction.reply({ content: "Les commandes slash de Cacabot sont exclusivement réservées au serveur Regaïa !", ephemeral: true });
        }

        const aliasMap = {
            rlt: 'roulette',
            roulettestats: 'rltstats',
            roulettestate: 'rltstate',
            roulettesucces: 'rltsucces',
            roulettetop: 'rlttop',
            bisou: 'kiss',
            calin: 'hug',
            court: 'run',
            dance: 'danse',
            frappe: 'punch',
            tir: 'bang',
            pan: 'bang',
            pleure: 'cry',
            explose: 'explode',
            citation: 'quote',
            decodeur: 'rebus',
            rebusstat: 'rebusstats',
            motustat: 'motustats',
            about: 'botinfo',
            montage: 'bougetoi',
            video: 'bougetoi',
            lavideo: 'bougetoi',
            sugg: 'suggestion',
            profile: 'profil'
        };

        const commandName = aliasMap[interaction.commandName] || interaction.commandName;

        // Commandes Motus
        if (commandName === 'motus') {
            const { jourStr, heures, minutes, sessionNom, timestamp } = tempsAvantProchainMotus();
            const now = Date.now();
            const enCours = motusData.mot && !motusData.termine && motusData.expireAt && now < motusData.expireAt;

            let desc = `Le prochain Motus aura lieu **${jourStr} à ${sessionNom}** (dans **${heures}h ${minutes}min**, <t:${timestamp}:R>) !\n\n-# *Sessions tous les jours : 10h00 (6 lettres) et 19h00 (7 lettres - Difficile).*`;

            if (enCours) {
                const expireTimestamp = Math.floor(motusData.expireAt / 1000);
                const titreType = motusData.longueur === 7 ? '🟥 Motus du soir (7 lettres - Difficile)' : '🟩 Motus du matin (6 lettres)';
                desc = `🎮 **${titreType} est EN COURS dans <#${MOTUS_CHANNEL_ID}> !**\n\n` +
                       `Tu as **3 essais individuels** pour deviner le mot.\n` +
                       `⏳ **Fin de la session :** <t:${expireTimestamp}:R> (fermeture à <t:${expireTimestamp}:t>) !\n\n` +
                       `Prochaine session : **${jourStr} à ${sessionNom}** (<t:${timestamp}:R>).`;
            }

            const embed = new EmbedBuilder()
                .setColor(enCours && motusData.longueur === 7 ? 0xe74c3c : 0x00b0f4)
                .setTitle(enCours ? '🟩 MOTUS EN COURS !' : '🟩 Motus Quotidien de Regaïa')
                .setDescription(desc)
                .setFooter({ text: 'Salon dédié : <#1556089022718152764> • 3 essais individuels • 1 heure de jeu par session' });

            return interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'motustats') {
            const cible = interaction.options.getUser('membre') ?? interaction.user;
            const member = interaction.guild?.members.cache.get(cible.id) ?? interaction.member;
            return interaction.reply({ embeds: [buildMotusStatsEmbed(member, interaction.user)] });
        }

        // Commandes Rébus Regaïen
        if (commandName === 'rebus') {
            const { jourStr, h, m, timestamp } = tempsAvantProchainRebus();

            let desc = `Le prochain Rébus Regaïen aura lieu **${jourStr} à 15h00** (dans **${h}h ${m}min**, <t:${timestamp}:R>) !\n-# *Thème mystère révélé au début de la partie.*`;

            if (rebusSession.active && rebusSession.currentItem) {
                const expireTimestamp = Math.floor(rebusSession.expireAt / 1000);
                desc = `🎮 **Le Rébus Regaïen est EN COURS dans <#${MOTUS_CHANNEL_ID}> !**\n\n` +
                       `📍 **Manche en cours :** ${rebusSession.manche}/5\n` +
                       `⏳ **Fin de la manche :** <t:${expireTimestamp}:R> !\n\n` +
                       `Prochaine session complète : **${jourStr} à 15h00** (<t:${timestamp}:R>).`;
            }

            const embed = new EmbedBuilder()
                .setColor(0xf39c12)
                .setTitle(rebusSession.active ? '🧩 RÉBUS REGAÏEN EN COURS !' : '🧩 Rébus Regaïen Quotidien (15h00)')
                .setDescription(desc)
                .setFooter({ text: 'Salon dédié : <#1556089022718152764> • 5 manches de 5 minutes chaque jour à 15h00' });

            return interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'rebusstats') {
            const cible = interaction.options.getUser('membre') ?? interaction.user;
            const member = interaction.guild?.members.cache.get(cible.id) ?? interaction.member;
            return interaction.reply({ embeds: [buildRebusStatsEmbed(member)] });
        }

        // Commande Quote
        if (commandName === 'quote') {
            if (quotesData.length === 0) return interaction.reply({ content: "📜 Aucune citation enregistrée pour l'instant !", ephemeral: true });
            const query = interaction.options.getString('recherche')?.trim().toLowerCase();
            let pool = quotesData;
            let customFilterId = 'all';

            if (query) {
                const idDirect = parseInt(query);
                if (!isNaN(idDirect)) {
                    const q = quotesData.find(x => x.id === idDirect);
                    if (q) pool = [q];
                } else {
                    const parMot = quotesData.filter(x => x.texte?.toLowerCase().includes(query) || x.authorName?.toLowerCase().includes(query));
                    if (parMot.length > 0) {
                        pool = parMot;
                        customFilterId = `search_${encodeURIComponent(query)}`;
                    }
                }
            }

            const quoteChoisie = pool[Math.floor(Math.random() * pool.length)];
            const auteurMembre = interaction.guild.members.cache.get(quoteChoisie.authorId);
            const avatarUrl = quoteChoisie.avatarUrl ?? auteurMembre?.user?.displayAvatarURL({ dynamic: true, size: 256 });
            const lienMsg = quoteChoisie.messageUrl ?? `https://discord.com/channels/${interaction.guild.id}/${quoteChoisie.channelId}`;
            const auteurMention = quoteChoisie.isWebhook ? `**${quoteChoisie.authorName}** *(Webhook)*` : `<@${quoteChoisie.authorId}>`;

            const texteAffiche = quoteChoisie.texte && quoteChoisie.texte !== '(Image)'
                ? `## « ${quoteChoisie.texte} »\n\n    -${auteurMention}\n\n-# *[source](${lienMsg})*`
                : `    -${auteurMention}\n\n-# *[source](${lienMsg})*`;

            const embedQuote = new EmbedBuilder()
                .setColor(0xf1c40f)
                .setTitle(`📜 Citation N°${quoteChoisie.id}`)
                .setDescription(texteAffiche)
                .setFooter({ text: `[${quoteChoisie.id}/${quotesData.length}] • Réponds à un message en faisant !quote pour l'enregistrer !` });

            if (avatarUrl) embedQuote.setThumbnail(avatarUrl);
            if (quoteChoisie.imageUrl) embedQuote.setImage(quoteChoisie.imageUrl);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`quote_random_${customFilterId}`).setLabel('🎲 Une autre citation').setStyle(ButtonStyle.Secondary)
            );
            return interaction.reply({ embeds: [embedQuote], components: [row] });
        }

        // Commande Lovecalc
        if (commandName === 'lovecalc') {
            await interaction.deferReply();
            const user1 = interaction.options.getUser('membre1');
            const user2 = interaction.options.getUser('membre2');

            const ids = [user1.id, user2.id].sort();
            const seed = parseInt(ids[0].slice(-4)) + parseInt(ids[1].slice(-4));
            const percent = (seed * 7 + 13) % 101;

            const nom1 = interaction.guild?.members.cache.get(user1.id)?.displayName ?? user1.username;
            const nom2 = interaction.guild?.members.cache.get(user2.id)?.displayName ?? user2.username;

            try {
                const av1 = user1.displayAvatarURL({ extension: 'png', size: 256 });
                const av2 = user2.displayAvatarURL({ extension: 'png', size: 256 });
                const buffer = await generateLovecalcImage(av1, av2, percent);

                const embed = new EmbedBuilder()
                    .setColor(0xe91e63)
                    .setDescription(`💕 **${nom1}** et **${nom2}** sont compatibles à **${percent}%** !`)
                    .setImage('attachment://lovecalc.png');

                return interaction.editReply({ embeds: [embed], files: [{ attachment: buffer, name: 'lovecalc.png' }] });
            } catch (e) {
                return interaction.editReply({ content: `💕 **${nom1}** et **${nom2}** sont compatibles à **${percent}%** !` });
            }
        }

        // Commande Prune
        if (commandName === 'prune') {
            if (!interaction.member.permissions.has('KickMembers')) {
                return interaction.reply({ content: "Tu n'as pas les permissions nécessaires !", ephemeral: true });
            }
            const count = interaction.options.getInteger('nombre');
            if (count > 100) {
                const embed = new EmbedBuilder()
                    .setColor(0xe74c3c)
                    .setTitle('⚠️ Limite dépassée')
                    .setDescription(`Discord ne permet pas de supprimer plus de **100 messages** à la fois.\n\nChoisis l'option ci-dessous :`);

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`prune_auto_${interaction.user.id}_${count}_${interaction.channel.id}`).setLabel('🤖 Laisser Cacabot gérer').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId(`prune_manual_${interaction.user.id}`).setLabel('✋ Annuler').setStyle(ButtonStyle.Secondary)
                );
                return interaction.reply({ embeds: [embed], components: [row] });
            }
            try {
                const messages = await interaction.channel.messages.fetch({ limit: count });
                const toDelete = messages.filter(m => (Date.now() - m.createdTimestamp) < 14 * 24 * 60 * 60 * 1000);
                await interaction.channel.bulkDelete(toDelete, true);
                return interaction.reply({ content: `🗑️ **${toDelete.size}** messages supprimés !`, ephemeral: true });
            } catch (e) {
                return interaction.reply({ content: "Erreur lors de la suppression.", ephemeral: true });
            }
        }

        // Commande Rlttop
        if (commandName === 'rlttop') {
            const { embed, row } = buildRouletteTopEmbed(interaction.guild, interaction.user.id);
            return interaction.reply({ embeds: [embed], components: [row] });
        }

        if (commandName === 'help') {
            const embed = buildHelpHomeEmbed();
            const menuRow = buildHelpMenu(interaction.user.id, null);
            const navRow = buildHelpNavRow(interaction.user.id, null);
            return interaction.reply({ embeds: [embed], components: [menuRow, navRow] });
        }

        if (commandName === 'roulette') {
            const lancerDirect = interaction.options.getBoolean('lancer') ?? false;
            if (lancerDirect) {
                await interaction.deferReply();
                const resultat = await tirerEtConstruireResultatRoulette(interaction.user.id, interaction.guild, interaction.channel);
                if (resultat.cooldown) {
                    const notifRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('roulette_notif').setLabel('🔔 Me prévenir').setStyle(ButtonStyle.Secondary)
                    );
                    return interaction.editReply({ content: `⏳ Attends la fin du cooldown avant de relancer un tirage ! Il te reste **${resultat.reste} min**.`, components: [notifRow] });
                }
                const envoye = await interaction.editReply({ embeds: resultat.embeds, components: resultat.components });
                await envoyerPingRedirection(interaction.channel, resultat);
                memoriserResultatRoulette(envoye.id, resultat.embeds[0]);
                if (resultat.attenteChoix) rouletteChoixEnAttente.add(envoye.id);
                if (resultat.vote) await demarrerVoteRoulette(envoye, resultat.vote);
                if (resultat.differe) {
                    setTimeout(async () => {
                        const embedFinal = await resultat.differe();
                        memoriserResultatRoulette(envoye.id, embedFinal);
                        envoye.edit({ embeds: [embedFinal] }).catch(() => {});
                    }, 10000);
                }
                return;
            }
            const embed = buildRoulettePresentationEmbed(interaction.user.id, interaction.guildId);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`roulette_probas_pres_${interaction.user.id}`).setLabel('🎲 Probabilités').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`roulette_tenter_${interaction.user.id}`).setLabel('🍀 Tenter sa chance').setStyle(ButtonStyle.Primary)
            );
            return interaction.reply({ embeds: [embed], components: [row] });
        }

        if (commandName === 'profil') {
            const cibleUser = interaction.options.getUser('membre') ?? interaction.user;
            const member = interaction.guild?.members.cache.get(cibleUser.id);
            const joinedAt = member?.joinedAt
                ? member.joinedAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
                : 'Inconnue';
            const createdAt = cibleUser.createdAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
            const roles = member?.roles.cache
                .filter(r => r.id !== interaction.guild.id)
                .sort((a, b) => b.position - a.position)
                .map(r => `<@&${r.id}>`)
                .slice(0, 5)
                .join(' ') || 'Aucun';

            const nbMessages = topData.messages[cibleUser.id] ?? 0;
            const birthdayRaw = getGuildBirthdays(interaction.guild.id)[cibleUser.id];
            const moisNoms = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
            let birthdayStr = 'Inconnu';
            if (birthdayRaw) {
                const [j, m] = birthdayRaw.split('/').map(Number);
                birthdayStr = `${j} ${moisNoms[m - 1]}`;
            }

            // Calcul des Succès du serveur
            let userAchs = rouletteAchievements.get(cibleUser.id) ?? {};
            const rStats = rouletteStats.get(cibleUser.id);
            const nbTirages = rStats?.tirages ?? 0;

            const badges = [];
            if (cibleUser.id === EPSYS_ID) badges.push('• 👑 Créatrice du serveur et de Cacabot');
            if (nbTirages >= 500) badges.push('• 🎰 Gambling Addict (500+ tirages)');
            else if (nbTirages >= 100) badges.push('• 🎰 Habitué.e de la Roulette (100+ tirages)');

            const nbAchs = Object.keys(userAchs).length;
            if (nbAchs >= 15) badges.push(`• 🏆 Trophy Hunter (${nbAchs}/30 succès)`);
            else if (nbAchs >= 5) badges.push(`• 🤠 Aventurier.e de la Roulette (${nbAchs}/30 succès)`);

            const mStats = motusStats[cibleUser.id];
            const nbVictoires = mStats?.victoires ?? 0;
            if (nbVictoires >= 10) badges.push(`• 🟩 Motus Master (${nbVictoires} victoires)`);
            else if (nbVictoires >= 3) badges.push(`• 🟨 Débutant.e du Motus (${nbVictoires} victoires)`);

            const rRebus = rebusStats[cibleUser.id];
            const nbTop1 = rRebus?.victoires ?? 0;
            if (nbTop1 >= 10) badges.push(`• 🥇 Maître du Rébus (10 médailles d'or)`);
            else if (nbTop1 >= 5) badges.push(`• 🥇 Expert.e du Rébus (5 médailles d'or)`);
            else if (nbTop1 >= 3) badges.push(`• 🥇 As du Rébus (3 médailles d'or)`);

            const nbQuotes = quotesData.filter(q => q.authorId === cibleUser.id).length;
            if (nbQuotes >= 5) badges.push(`• 📜 Légende (${nbQuotes} citations)`);

            if (nbMessages >= 5000) badges.push('• 🗣️ Monument de Regaïa (5 000+ messages)');
            else if (nbMessages >= 1000) badges.push('• 💬 Membre Bavard.e (1 000+ messages)');
            else if (nbMessages >= 250) badges.push('• 🌱 Jeune membre (250+ messages)');

            const embed = new EmbedBuilder()
                .setColor(0x5865f2)
                .setTitle(member?.displayName ?? cibleUser.username)
                .setThumbnail(cibleUser.displayAvatarURL({ dynamic: true, size: 256 }))
                .addFields(
                    { name: '👤 Pseudo', value: `@${cibleUser.username}`, inline: true },
                    { name: '💬 Messages envoyés', value: `${nbMessages.toLocaleString('fr-FR')}`, inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                    { name: '📅 Arrivée sur le serveur', value: joinedAt, inline: true },
                    { name: '🎂 Anniversaire', value: birthdayStr, inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                    { name: '🏆 Succès du serveur', value: badges.length > 0 ? badges.join('\n') : '*Aucun succès débloqué pour l\'instant.*', inline: false },
                    { name: '🏷️ Rôles', value: roles, inline: false }
                )
                .setFooter({ text: `ID : ${cibleUser.id}` });

            return interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'rltsucces') {
            const cibleUser = interaction.options.getUser('membre') ?? interaction.user;
            const member = interaction.guild?.members.cache.get(cibleUser.id) ?? interaction.member;
            const { embed, row } = buildRouletteAchievementsEmbed(member, 0, interaction.user.id);
            return interaction.reply({ embeds: [embed], components: [row] });
        }

        if (commandName === 'rltstats') {
            const cibleUser = interaction.options.getUser('membre') ?? interaction.user;
            const member = interaction.guild?.members.cache.get(cibleUser.id) ?? interaction.member;
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`rlt_achs_${member.id}_0_${interaction.user.id}`).setLabel('🎖️ Succès').setStyle(ButtonStyle.Secondary)
            );
            return interaction.reply({ embeds: [buildRouletteStatsEmbed(member)], components: [row] });
        }

        if (commandName === 'top') {
            const allSorted = Object.entries(topData.messages).sort((a, b) => b[1] - a[1]);
            if (allSorted.length === 0) return interaction.reply({ content: "Pas encore de données !", ephemeral: true });

            const PAGE_SIZE = 10;
            const totalPages = Math.ceil(allSorted.length / PAGE_SIZE);
            const medals = ['🥇', '🥈', '🥉'];
            const fields = allSorted.slice(0, PAGE_SIZE).map(([uid, count], i) => {
                const member = interaction.guild?.members.cache.get(uid);
                if (!member) return null;
                const medal = i < 3 ? medals[i] : `**${i + 1}.**`;
                return { name: `${medal} ${member.displayName}`, value: `${count} messages`, inline: false };
            }).filter(Boolean);

            const embed = new EmbedBuilder()
                .setColor(0xffd700)
                .setTitle('🏆 Classement des membres')
                .addFields(fields)
                .setFooter({ text: `Page 1/${totalPages}` });

            const prev = new ButtonBuilder().setCustomId(`top_prev_${interaction.user.id}_0`).setLabel('⬅️ Arrière').setStyle(ButtonStyle.Secondary).setDisabled(true);
            const next = new ButtonBuilder().setCustomId(`top_next_${interaction.user.id}_0`).setLabel('Suivant ➡️').setStyle(ButtonStyle.Secondary).setDisabled(totalPages <= 1);
            const row = new ActionRowBuilder().addComponents(prev, next);

            return interaction.reply({ embeds: [embed], components: totalPages > 1 ? [row] : [] });
        }

        const auteurNom = interaction.member?.displayName ?? interaction.user.username;
        const auteurId = interaction.user.id;

        if (commandName === 'kiss') {
            const cibleUser = interaction.options.getUser('membre');
            const cibleMember = interaction.guild?.members.cache.get(cibleUser.id);
            const cibleNom = cibleMember?.displayName ?? cibleUser.username;

            if (cibleUser.id === auteurId) {
                const embed = buildKissEmbed(auteurNom, auteurNom).setDescription(`💋 **${auteurNom}** s'embrasse ! Attends... Comment c'est possible ?`);
                return interaction.reply({ embeds: [embed] });
            }
            if (cibleUser.id === client.user.id) {
                const embed = buildKissEmbed(auteurNom, "Cacabot").setDescription(`💋 **${auteurNom}** m'embrasse ! Awww merci <3`);
                return interaction.reply({ embeds: [embed] });
            }
            const embed = buildKissEmbed(auteurNom, cibleNom);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`kiss_back_${auteurId}_${cibleUser.id}_${auteurNom}`).setLabel("💋 Embrasser en retour").setStyle(ButtonStyle.Primary)
            );
            return interaction.reply({ embeds: [embed], components: [row] });
        }

        if (commandName === 'hug') {
            const cibleUser = interaction.options.getUser('membre');
            const cibleMember = interaction.guild?.members.cache.get(cibleUser.id);
            const cibleNom = cibleMember?.displayName ?? cibleUser.username;

            if (cibleUser.id === auteurId) {
                const embed = buildHugEmbed(auteurNom, auteurNom).setDescription(`🫂 **${auteurNom}** se fait un câlin... Ça va aller...`);
                return interaction.reply({ embeds: [embed] });
            }
            if (cibleUser.id === client.user.id) {
                const embed = buildHugEmbed(auteurNom, "Cacabot").setDescription(`🫂 **${auteurNom}** me fait un câlin !`);
                return interaction.reply({ embeds: [embed] });
            }
            const embed = buildHugEmbed(auteurNom, cibleNom);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`hug_back_${auteurId}_${cibleUser.id}_${auteurNom}`).setLabel("🫂 Câliner en retour").setStyle(ButtonStyle.Primary)
            );
            return interaction.reply({ embeds: [embed], components: [row] });
        }

        if (commandName === 'rizz') {
            const cibleUser = interaction.options.getUser('membre');
            const cibleMember = interaction.guild?.members.cache.get(cibleUser.id);
            const cibleNom = cibleMember?.displayName ?? cibleUser.username;

            if (cibleUser.id === auteurId) return interaction.reply({ content: "Tu ne peux pas te rizz toi-même !", ephemeral: true });
            if (cibleUser.id === client.user.id) {
                const embed = buildRizzEmbed(`🗿 **${auteurNom}** me rizz ! Eh beh 😊`);
                return interaction.reply({ embeds: [embed] });
            }
            const embed = buildRizzEmbed(`🗿 **${auteurNom}** rizz **${cibleNom}** !`);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`rizz_back_${auteurId}_${cibleUser.id}_${auteurNom}`).setLabel("🗿 Rizz en retour").setStyle(ButtonStyle.Primary)
            );
            return interaction.reply({ embeds: [embed], components: [row] });
        }

        if (commandName === 'punch') {
            const cibleUser = interaction.options.getUser('membre');
            const cibleMember = interaction.guild?.members.cache.get(cibleUser.id);
            const cibleNom = cibleMember?.displayName ?? cibleUser.username;

            if (cibleUser.id === auteurId) return interaction.reply({ content: "Tu ne peux pas te frapper toi-même ! 'Fin si mais... Ne le fais pas.", ephemeral: true });
            if (cibleUser.id === client.user.id) {
                const embed = buildPunchEmbed(`🤜 **${auteurNom}** me frappe ! Aïeuh !`);
                return interaction.reply({ embeds: [embed] });
            }
            const embed = buildPunchEmbed(`🤜 **${auteurNom}** frappe **${cibleNom}** !`);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`punch_back_${auteurId}_${cibleUser.id}_${auteurNom}`).setLabel("🤜 Frapper en retour").setStyle(ButtonStyle.Primary)
            );
            return interaction.reply({ embeds: [embed], components: [row] });
        }

        if (commandName === 'bang') {
            const cibleUser = interaction.options.getUser('membre');
            const cibleMember = interaction.guild?.members.cache.get(cibleUser.id);
            const cibleNom = cibleMember?.displayName ?? cibleUser.username;

            if (cibleUser.id === auteurId) return interaction.reply({ content: "Évite de te tirer dessus :(", ephemeral: true });
            if (cibleUser.id === client.user.id) {
                const embed = buildBangEmbed(`💥 **${auteurNom}** me tire dessus ! HÉ !`);
                return interaction.reply({ embeds: [embed] });
            }
            const embed = buildBangEmbed(`💥 **${auteurNom}** tire sur **${cibleNom}** !`);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`bang_back_${auteurId}_${cibleUser.id}_${auteurNom}`).setLabel("💥 Riposter !").setStyle(ButtonStyle.Primary)
            );
            return interaction.reply({ embeds: [embed], components: [row] });
        }

        if (commandName === 'insult') {
            const cibleUser = interaction.options.getUser('membre');
            const cibleMember = interaction.guild?.members.cache.get(cibleUser.id);
            const cibleNom = cibleMember?.displayName ?? cibleUser.username;

            if (cibleUser.id === auteurId) return interaction.reply({ content: "Tu ne peux pas t'insulter toi-même... Mentionne quelqu'un plutôt !", ephemeral: true });
            if (cibleUser.id === client.user.id) {
                const embed = buildInsultEmbed(`🖕 **${auteurNom}** m'insulte ! J'ai fait quoi ?!`);
                return interaction.reply({ embeds: [embed] });
            }
            const embed = buildInsultEmbed(`🖕 **${auteurNom}** insulte **${cibleNom}** !`);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`insult_back_${auteurId}_${cibleUser.id}_${auteurNom}`).setLabel("🖕 Insulter en retour").setStyle(ButtonStyle.Primary)
            );
            return interaction.reply({ embeds: [embed], components: [row] });
        }

        if (commandName === 'bait') {
            const cibleUser = interaction.options.getUser('membre');
            const cibleMember = interaction.guild?.members.cache.get(cibleUser.id);
            const cibleNom = cibleMember?.displayName ?? cibleUser.username;

            if (cibleUser.id === auteurId) return interaction.reply({ content: "Tu ne peux pas te ragebait toi-même !", ephemeral: true });
            const baitGifs = [
                "https://cdn.discordapp.com/attachments/1072299294519988345/1304467586746028193/brandbird_4.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505570790706253864/tadc-bubble-tadc.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505570791683522760/tadc-the-amazing-digital-circus.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505570792279379988/tadc-caine-tadc.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505570793021505736/flight-flightreacts.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505570793718022226/superman-superman-flying.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505570795160731728/f8957342b4d99638.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505570795974295672/down-syndrome.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505570796981194822/flight.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505570797979172964/catreacts-ragebait.gif"
            ];
            const gif = baitGifs[Math.floor(Math.random() * baitGifs.length)];
            if (cibleUser.id === client.user.id) {
                const embed = new EmbedBuilder().setColor(0xffb14a).setDescription(`😜 **${auteurNom}** me ragebait ! Gngngngn...`).setImage(gif);
                return interaction.reply({ embeds: [embed] });
            }
            const embed = new EmbedBuilder().setColor(0xffb14a).setDescription(`😜 **${auteurNom}** ragebait **${cibleNom}** !`).setImage(gif);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`bait_venge_${cibleUser.id}_${auteurId}_${auteurNom}`).setLabel("💢 SE VENGER !").setStyle(ButtonStyle.Secondary)
            );
            return interaction.reply({ embeds: [embed], components: [row] });
        }

        if (commandName === 'ban') {
            const cibleUser = interaction.options.getUser('membre');
            const cibleMember = interaction.guild?.members.cache.get(cibleUser.id);
            const cibleNom = cibleMember?.displayName ?? cibleUser.username;

            if (cibleUser.id === auteurId) return interaction.reply({ content: "Tu ne peux pas te bannir toi-même !", ephemeral: true });
            const banGifs = [
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505557423686029352/cat-screaming-cat-disappearing.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505557409148567572/ahh-kid-turns-blue-and-vanishes.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505557424092741764/duck-disappears.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505557424491462856/tom-skot.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505557424805777428/atoms-cry.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505557425288380576/sr-pelo-screaming.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505557425690775683/cat-scream.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505557426043355278/meme-quarantine.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505557426433294437/flight-flights.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505557426881958020/nikocado-avocado-nikocado.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505557427209109544/moist-moist-critical.gif"
            ];
            const gif = banGifs[Math.floor(Math.random() * banGifs.length)];
            const titre = cibleUser.id === client.user.id ? `**${auteurNom}** me bannit... Pas cool.` : `🔨 **${auteurNom}** bannit **${cibleNom}** !`;
            const embed = new EmbedBuilder().setColor(0xcdc9dc).setDescription(titre).setImage(gif);
            return interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'danse') {
            const cibleUser = interaction.options.getUser('membre');
            if (!cibleUser) {
                const embed = buildDanceEmbed(`💃 **${auteurNom}** s'ambiance comme jamais !`, true);
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`dance_join_${auteurId}_${auteurNom}`).setLabel("💃 Rejoindre la danse").setStyle(ButtonStyle.Primary)
                );
                return interaction.reply({ embeds: [embed], components: [row] });
            }
            const cibleMember = interaction.guild?.members.cache.get(cibleUser.id);
            const cibleNom = cibleMember?.displayName ?? cibleUser.username;
            if (cibleUser.id === client.user.id) {
                const embed = buildDanceEmbed(`💃 **${auteurNom}** danse avec moi !`, false);
                return interaction.reply({ embeds: [embed] });
            }
            const embed = buildDanceEmbed(`💃 **${auteurNom}** danse avec **${cibleNom}** !`, false);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`dance_back_${auteurId}_${cibleUser.id}_${auteurNom}`).setLabel("💃 Rejoindre la danse").setStyle(ButtonStyle.Primary)
            );
            return interaction.reply({ embeds: [embed], components: [row] });
        }

        if (commandName === 'rire') {
            const cibleUser = interaction.options.getUser('membre');
            if (cibleUser && cibleUser.id !== auteurId && cibleUser.id !== client.user.id) {
                const cibleMember = interaction.guild?.members.cache.get(cibleUser.id);
                const cibleNom = cibleMember?.displayName ?? cibleUser.username;
                const embed = buildLaughEmbed(`😆 **${auteurNom}** se fout de la gueule de **${cibleNom}** !`);
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`laugh_with_${auteurId}_${auteurNom}`).setLabel("😆 Rire avec").setStyle(ButtonStyle.Primary)
                );
                return interaction.reply({ embeds: [embed], components: [row] });
            }
            const embed = buildLaughEmbed(`😆 **${auteurNom}** se tape une barre !`);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`laugh_with_${auteurId}_${auteurNom}`).setLabel("😆 Rire avec").setStyle(ButtonStyle.Primary)
            );
            return interaction.reply({ embeds: [embed], components: [row] });
        }

        if (commandName === 'cry') {
            const cryGifs = ["https://cdn.discordapp.com/attachments/1128032964924670053/1505906480916725791/zidane.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906486872768522/wwe.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906487413964941/cry2.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906487656972359/hamster.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906487959093359/interstellar.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906869598814310/cry.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906488625856622/powder.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906488932176034/vi.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906489271779449/gangle.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906489657790466/pomni.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906489947324589/fred.gif"];
            const gif = cryGifs[Math.floor(Math.random() * cryGifs.length)];
            const cibleUser = interaction.options.getUser('membre');
            let desc, targetId = null, cibleNom = null;
            if (cibleUser && cibleUser.id === auteurId) {
                desc = `😭 **${auteurNom}** Pleure...`;
                return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x597eff).setDescription(desc).setImage(gif)] });
            } else if (cibleUser && cibleUser.id === client.user.id) {
                desc = `😭 **${auteurNom}** pleure à cause de moi...`;
            } else if (cibleUser) {
                cibleNom = interaction.guild?.members.cache.get(cibleUser.id)?.displayName ?? cibleUser.username;
                targetId = cibleUser.id;
                desc = `😭 **${auteurNom}** Pleure à cause de **${cibleNom}**...`;
            } else {
                desc = `😭 **${auteurNom}** Pleure...`;
            }
            const embed = new EmbedBuilder().setColor(0x597eff).setDescription(desc).setImage(gif);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`cry_with_${auteurId}_${auteurNom}_${targetId ?? 'none'}_${cibleNom ?? 'none'}`).setLabel("😭 Pleurer avec").setStyle(ButtonStyle.Secondary)
            );
            return interaction.reply({ embeds: [embed], components: [row] });
        }

        if (commandName === 'run') {
            const cibleUser = interaction.options.getUser('membre');
            if (!cibleUser || cibleUser.id === auteurId) {
                const embed = buildRunEmbed(`🏃 **${auteurNom}** fuit !`);
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`run_join_${auteurId}_${auteurNom}`).setLabel("🏃 Accompagner").setStyle(ButtonStyle.Secondary)
                );
                return interaction.reply({ embeds: [embed], components: [row] });
            }
            if (cibleUser.id === client.user.id) {
                const embed = buildRunEmbed(`🏃 **${auteurNom}** me fuit ! Reviens-là !`);
                return interaction.reply({ embeds: [embed] });
            }
            const cibleMember = interaction.guild?.members.cache.get(cibleUser.id);
            const cibleNom = cibleMember?.displayName ?? cibleUser.username;
            const embed = buildRunEmbed(`🏃 **${auteurNom}** fuit de **${cibleNom}** !`);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`run_join_${auteurId}_${auteurNom}_${cibleUser.id}`).setLabel("🏃 Accompagner").setStyle(ButtonStyle.Secondary)
            );
            return interaction.reply({ embeds: [embed], components: [row] });
        }

        if (commandName === 'explode') {
            const explodeGifs = [
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505564402697375794/cat-cats.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505564403230183599/cat-explosion_1.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505564403653804153/floop-flop.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505564404031426661/cat-explodes.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505564404400521267/cat-funny.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505564404882870292/spideyvivi.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505564405281194064/cat-explode-cat-meme.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505564405847298150/explosion-missile.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505564406224781373/exploding-cat-cat-blowing-up.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505564406799532052/cat-gato.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505564412172570664/boomshakalaka.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505564412763836466/elgatitolover-cat.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505564413376335962/cat-explosion-ellie-cat-explosion.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505564413795635311/exploding-car-explode.gif",
                "https://cdn.discordapp.com/attachments/1128032964924670053/1505564414147825774/cat-explosion.gif"
            ];
            const gif = explodeGifs[Math.floor(Math.random() * explodeGifs.length)];
            const embed = new EmbedBuilder().setColor(0xec0f6e).setDescription(`💥 **${auteurNom}** explose !`).setImage(gif);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`explode_with_${auteurId}_${auteurNom}`).setLabel("💥 Exploser avec").setStyle(ButtonStyle.Secondary)
            );
            return interaction.reply({ embeds: [embed], components: [row] });
        }

        if (commandName === 'die') {
            const cibleUser = interaction.options.getUser('membre');
            if (cibleUser && cibleUser.id === client.user.id) {
                const embed = buildDieEmbed(`☠️ **${auteurNom}** meurt à cause de moi ! (cheh)`);
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`die_with_${auteurId}_${auteurNom}`).setLabel("☠️ Mourir avec").setStyle(ButtonStyle.Primary)
                );
                return interaction.reply({ embeds: [embed], components: [row] });
            }
            const causeNom = cibleUser && cibleUser.id !== auteurId ? (interaction.guild?.members.cache.get(cibleUser.id)?.displayName ?? cibleUser.username) : null;
            const titre = causeNom ? `☠️ **${auteurNom}** meurt à cause de **${causeNom}**` : `☠️ **${auteurNom}** meurt...`;
            const embed = buildDieEmbed(titre);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`die_with_${auteurId}_${auteurNom}`).setLabel("☠️ Mourir avec").setStyle(ButtonStyle.Primary)
            );
            return interaction.reply({ embeds: [embed], components: [row] });
        }

        if (commandName === 'jailaref') {
            const jailarefGifs = ["https://static2.klipy.com/ii/4493325008d34b7bf8cd6813cd5c1619/f1/7d/7y2QyYzWIYksGnnK.gif", "https://cdn.discordapp.com/attachments/720079691041472572/1548362421079646481/caf5c232438734937f6e1cf4c7bc5411.png", "https://media1.tenor.com/m/13XpzbwtVnYAAAAC/dway-the-roc.gif", "https://static2.klipy.com/ii/4493325008d34b7bf8cd6813cd5c1619/14/44/oqcpwYRAEpXGYqfyw.gif", "https://static2.klipy.com/ii/50d7c955398dfd7e3c8ba5281154280f/79/6d/eoUS3shzyQLpKm.gif", "https://static2.klipy.com/ii/d7aec6f6f171607374b2065c836f92f4/3d/31/08K8MgEk.gif", "https://static2.klipy.com/ii/4493325008d34b7bf8cd6813cd5c1619/64/b0/SdnOajVDadHUy.gif", "https://cdn.discordapp.com/attachments/720079691041472572/1548366731666268250/image2.gif", "https://static2.klipy.com/ii/9294a2e836d178ddc22430dd7765727e/44/86/6QBidjUuV1oBpAnHIw7o.gif"];
            const gif = jailarefGifs[Math.floor(Math.random() * jailarefGifs.length)];
            const cibleUser = interaction.options.getUser('membre');
            let desc;
            if (!cibleUser) desc = `😎 **${auteurNom}** a la ref !`;
            else if (cibleUser.id === auteurId) return interaction.reply({ content: "Bah oui, t'as forcément ta propre ref...", ephemeral: true });
            else if (cibleUser.id === client.user.id) desc = `😎 **${auteurNom}** a ma ref !`;
            else {
                const cibleNom = interaction.guild?.members.cache.get(cibleUser.id)?.displayName ?? cibleUser.username;
                desc = `😎 **${auteurNom}** a la ref de **${cibleNom}** !`;
            }
            const embed = new EmbedBuilder().setColor(0x503649).setDescription(desc).setImage(gif);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`jailaref_with_${auteurId}_${auteurNom}_${cibleUser?.id ?? 'none'}`).setLabel("😎 J'ai la ref aussi").setStyle(ButtonStyle.Secondary)
            );
            return interaction.reply({ embeds: [embed], components: [row] });
        }

        if (commandName === 'palaref') {
            const palarefGifs = ["https://cdn.discordapp.com/attachments/1128032964924670053/1505882858311647262/tyson.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882865492164608/viktor.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882866192617624/zidane.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882866549260338/kaamelott.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882866867765278/palaref.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882866867765278/ants.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882867262296094/ants.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882867576606720/simpsons.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882867903758428/speed.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882868205752430/kinger.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882868520456332/pomni.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882872769151027/stare.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882873109020853/erivo.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882873427923024/hidethepain.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882873746686022/chieng.gif"];
            const gif = palarefGifs[Math.floor(Math.random() * palarefGifs.length)];
            const cibleUser = interaction.options.getUser('membre');
            let desc;
            if (!cibleUser) desc = `😐 **${auteurNom}** n'a pas la ref...`;
            else if (cibleUser.id === auteurId) return interaction.reply({ content: "Tu n'as pas ta propre ref ? ...Hein ?", ephemeral: true });
            else if (cibleUser.id === client.user.id) desc = `😐 **${auteurNom}** n'a pas ma ref...`;
            else {
                const cibleNom = interaction.guild?.members.cache.get(cibleUser.id)?.displayName ?? cibleUser.username;
                desc = `😐 **${auteurNom}** n'a pas la ref de **${cibleNom}**...`;
            }
            const embed = new EmbedBuilder().setColor(0x503649).setDescription(desc).setImage(gif);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`palaref_aussi_${auteurId}_${auteurNom}_${cibleUser?.id ?? 'none'}`).setLabel("😐 Pas la ref non plus").setStyle(ButtonStyle.Secondary)
            );
            return interaction.reply({ embeds: [embed], components: [row] });
        }

        // =========================
        // LOT 2 : JEUX & DESTIN
        // =========================

        if (commandName === 'destin') {
            const destinReponse = getResponse("!destin");
            return interaction.reply({ content: destinReponse });
        }

        if (commandName === 'horoscope') {
            const now = new Date();
            const dateKey = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
            const dateStr = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

            const signes = [
                { nom: 'Bélier', emoji: '♈' }, { nom: 'Taureau', emoji: '♉' }, { nom: 'Gémeaux', emoji: '♊' },
                { nom: 'Cancer', emoji: '♋' }, { nom: 'Lion', emoji: '♌' }, { nom: 'Vierge', emoji: '♍' },
                { nom: 'Balance', emoji: '♎' }, { nom: 'Scorpion', emoji: '♏' }, { nom: 'Sagittaire', emoji: '♐' },
                { nom: 'Capricorne', emoji: '♑' }, { nom: 'Verseau', emoji: '♒' }, { nom: 'Poissons', emoji: '♓' },
                { nom: 'Loutre', emoji: '🦦' },
            ];

            const description = signes.map((s, i) => `${s.emoji} **${s.nom}**\n${getHoroscopeForSign(i, dateKey)}`).join('\n\n');

            const embed = new EmbedBuilder()
                .setColor(0x2c2f33)
                .setTitle('🔮 Horoscope du jour')
                .setDescription(description)
                .setThumbnail('https://cdn.discordapp.com/attachments/1128032964924670053/1505637234596905080/color-replaced.png')
                .setFooter({ text: `📅 ${dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}` });

            return interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'animal') {
            const cibleUser = interaction.options.getUser('membre') ?? interaction.user;
            return interaction.reply(getAnimalResponse(interaction, cibleUser));
        }

        if (commandName === 'flip') {
            if (flipEnCours) {
                return interaction.reply({ content: "Un lancer est déjà en cours ! Attends ton tour.", ephemeral: true });
            }
            flipEnCours = true;
            const aid = interaction.user.id;
            const nom = interaction.member?.displayName ?? interaction.user.username;
            const simpleBtn = new ButtonBuilder().setCustomId(`flip_simple_${aid}`).setLabel("🪙 Lancer simple").setStyle(ButtonStyle.Secondary);
            const pariBtn = new ButtonBuilder().setCustomId(`flip_pari_${aid}`).setLabel("⚔️ Pari").setStyle(ButtonStyle.Secondary);
            const cancelBtn = new ButtonBuilder().setCustomId(`flip_cancel_${aid}`).setLabel("❌ Annuler").setStyle(ButtonStyle.Secondary);
            const row = new ActionRowBuilder().addComponents(simpleBtn, pariBtn, cancelBtn);
            const embed = new EmbedBuilder()
                .setColor(0xffd700)
                .setTitle("🪙 Pile ou face")
                .setDescription(`**${nom}**, c'est pour un lancer simple, ou alors pour parier avec quelqu'un ?`);
            return interaction.reply({ embeds: [embed], components: [row] });
        }

        if (commandName === 'blague') {
            const type = interaction.options.getString('type');
            if (type) {
                const categories = {
                    soft: { label: '😊 Humour soft', color: 0x2ecc71 },
                    classique: { label: '😄 Humour classique', color: 0x3498db },
                    noir: { label: '🖤 Humour noir', color: 0x2c2c2c }
                };
                // Simule l'envoi d'une blague selon la catégorie choisie
                const embedMenu = new EmbedBuilder().setColor(categories[type].color).setTitle(categories[type].label);
                const autreBtn = new ButtonBuilder().setCustomId(`blague_autre_${interaction.user.id}_${type}`).setLabel('🤣 Une autre ?').setStyle(ButtonStyle.Secondary);
                const menuBtn = new ButtonBuilder().setCustomId(`blague_menu_back_${interaction.user.id}`).setLabel('🔄 Autre type').setStyle(ButtonStyle.Secondary);
                const row = new ActionRowBuilder().addComponents(autreBtn, menuBtn);
                // On passe par un message initial pour afficher la blague
                const fakeInteraction = {
                    update: async (data) => interaction.reply(data),
                    user: interaction.user
                };
                return sendBlague(fakeInteraction, type, interaction.user.id);
            }
            const embed = new EmbedBuilder().setColor(0xe91e63).setTitle('🤣 Blagues').setDescription('Choisis une catégorie !');
            const menu = new StringSelectMenuBuilder().setCustomId(`blague_menu_${interaction.user.id}`).setPlaceholder('Choisis une catégorie').addOptions(
                { label: '😊 Humour soft', value: 'soft' },
                { label: '😄 Humour classique', value: 'classique' },
                { label: '🖤 Humour noir', value: 'noir' }
            );
            const row = new ActionRowBuilder().addComponents(menu);
            return interaction.reply({ embeds: [embed], components: [row] });
        }

        if (commandName === 'wanted') {
            await interaction.deferReply();
            const now = new Date();
            const dateKey = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
            const wantedID = getWantedOfTheDay(dateKey, interaction.guild);
            if (!wantedID) return interaction.editReply('Aucun membre éligible trouvé !');
            const { embed } = getWantedEmbedData(interaction.guild, dateKey, wantedID);
            const prime = Math.floor(seedRndWanted(dateKey * 19) * 95) + 5;
            const nom = interaction.guild?.members.cache.get(wantedID)?.displayName ?? wantedID;
            try {
                const avatarUrl = interaction.guild?.members.cache.get(wantedID)?.user.displayAvatarURL({ extension: 'png', size: 512 });
                const imageBuffer = await generateWantedImage(avatarUrl, nom, prime);
                embed.setImage('attachment://wanted.png');
                return interaction.editReply({ embeds: [embed], files: [{ attachment: imageBuffer, name: 'wanted.png' }], components: [buildWantedRow('avis', interaction.user.id)] });
            } catch (e) {
                embed.setThumbnail(interaction.guild?.members.cache.get(wantedID)?.user.displayAvatarURL({ dynamic: true }));
                return interaction.editReply({ embeds: [embed], components: [buildWantedRow('avis', interaction.user.id)] });
            }
        }

        if (commandName === 'epsys') {
            const gif = getResponse("!epsys");
            return interaction.reply({ content: gif });
        }

        if (commandName === 'bougetoi') {
            const phrases = [
                `<@${EPSYS_ID}>, faudrait te bouger, on attend ta vidéo ! Alors tu nous sors un logiciel de montage et tu t'y mets **__MAINTENANT__** stp`,
                `<@${EPSYS_ID}>, ON T'ATTEND ! Ouvre ton logiciel de montage et commence à travailler **__TOUT DE SUITE__** ! 🎬`,
                `<@${EPSYS_ID}>, t'as cru que la vidéo allait se monter toute seule ? Allez hop, on taffe sur le projet et plus vite que ça ! 😤`
            ];
            const phraseChoisie = phrases[Math.floor(Math.random() * phrases.length)];
            return interaction.reply({ content: phraseChoisie });
        }

        if (commandName === 'sylvain') {
            const sylvainGifs = [
                "https://media1.tenor.com/m/camhluUNGO0AAAAd/sylvain-lyve-sylvain-levy.gif",
                "https://media1.tenor.com/m/mhNSNZ7Ye4wAAAAC/sylvain-lyve-vilbrequin.gif",
                "https://media1.tenor.com/m/n7NmIiefhZ4AAAAC/sylvain-lyve-vilbrequin.gif",
                "https://media1.tenor.com/m/p66oAFFJ2pcAAAAC/vilebrequin-vilebrequin-sylvain-levy.gif",
                "https://media1.tenor.com/m/XFUotrruCacAAAAC/vilebrequin-sylvain.gif",
                "https://media1.tenor.com/m/pCExmpKfecgAAAAC/vilebrequin-sylvain.gif",
                "https://media1.tenor.com/m/MkoOhxjfLeYAAAAC/vilebrequin-sylvain.gif",
                "https://media1.tenor.com/m/q5GDY7A8aUMAAAAC/vilebrequin-vilebrequin-sylvain-levy.gif",
                "https://media1.tenor.com/m/8K7M2XtHOFsAAAAC/vilebrequin-sylvain.gif",
                "https://media1.tenor.com/m/E3abpzYLviIAAAAC/vilebrequin-vilebrequin-sylvain-levy.gif",
                "https://media1.tenor.com/m/CH0fiUJj5psAAAAC/sylvain-lyve-sylvain-levy.gif",
                "https://media1.tenor.com/m/VD8UmHWnJPgAAAAC/vilebrequin-vilebrequin-sylvain.gif",
                "https://media1.tenor.com/m/UUO8TiMNDXAAAAAC/keep-pushing-race.gif",
                "https://media1.tenor.com/m/q9PEP4AcLKkAAAAC/vilebrequin-vilebrequin-sylvain-levy.gif",
                "https://media1.tenor.com/m/aNmsYZdcuG8AAAAC/vilebrequin-vilebrequin-sylvain-levy.gif",
                "https://media1.tenor.com/m/d9Dnn5iOeCoAAAAd/sylvain-sylvain-rire.gif"
            ];
            const gif = sylvainGifs[Math.floor(Math.random() * sylvainGifs.length)];
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('sylvain_again').setLabel('🐒 Singe fort ensemble').setStyle(ButtonStyle.Secondary)
            );
            return interaction.reply({ files: [gif], components: [row] });
        }

        if (commandName === 'rltstate') {
            const cibleUser = interaction.options.getUser('membre') ?? interaction.user;
            const member = interaction.guild?.members.cache.get(cibleUser.id) ?? interaction.member;
            return interaction.reply({ embeds: [buildRouletteStateEmbed(member, interaction.guildId)] });
        }

        // =========================
        // LOT 3 : SALONS & VIE DU SERVEUR
        // =========================

        if (commandName === 'topchef') {
            const critiques = [
                "L'équilibre des textures, la brillance du jus, la gourmandise absolue... Maïté verse une larme de fierté depuis là-haut. **19.5/20**",
                "C'est indécent tellement ça donne faim. Envoie une part en Colissimo immédiatement ou je porte plainte. **19/20**",
                "Visuel digne d'un restaurant 4 étoiles Michelin. C'est du grand art, respect au chef ! **18.5/20**",
                "C'est tellement beau que j'oserais même pas planter ma fourchette dedans, je mettrais l'assiette sous cadre au Louvre. **20/20**",
                "La cuisson est millimétrée, l'assaisonnement est chirurgical, un sans-faute remarquable. **18/20**",
                "Un chef-d'œuvre de pure gourmandise. Si tu ne m'invites pas à dîner cette semaine, je supprime ton compte Discord. **19.5/20**",
                "C'est croustillant, c'est fondant, ça donne envie d'engloutir mon écran. **17.5/20**",
                "Y a beaucoup trop de fromage fondu, ce qui signifie mathématiquement que c'est la perfection absolue. **18/20**",
                "On dirait le résultat d'une expérience clandestine dans un labo abandonné de Tchernobyl... mais bizarrement ça doit se manger. **4/20**",
                "C'est visuellement terrorisant, même un chien errant affamé ferait trois pas en arrière. Courage à ton système digestif. **2/20**",
                "Gordon Ramsay vient de voir la photo : il a immédiatement supprimé son compte Twitter et s'est retiré dans un monastère tibétain. **1/20**",
                "Philippe Etchebest vient de défoncer un mur rien qu'en regardant ce dressage. **3/20**",
                "C'est carbonisé à l'extérieur et encore congelé au milieu. Une véritable prouesse thermodynamique. **5/20**",
                "Je sais pas si ça se mange avec une fourchette ou si ça s'exorcise avec de l'eau bénite et un prêtre. **3.5/20**",
                "Le terme « intoxication alimentaire » a été inventé spécifiquement pour anticiper ce plat. **0.5/20**",
                "J'ai montré la photo à mon chat, il a instinctivement commencé à gratter autour de mon téléphone comme si c'était sa litière. **1.5/20**",
                "Le dressage ressemble fidèlement à un constat d'accident de la route réalisé par la gendarmerie (mais ACAB sinon). **4/20**",
                "Si tu survis à la digestion de ce truc sans passer 48h aux toilettes, tu deviens officiellement immortel. **6/20**",
                "Le genre de plat que tu manges debout au-dessus de l'évier à 3h42 du matin en caleçon sans aucun regret. **14/20**",
                "Ça ressemble à un plat cuisiné par mon daron en pleine crise de panique, mais au fond j'ai très envie de goûter. **12/20**",
                "C'est pas de la grande cuisine, mais ça comble un vide existentiel. C'est totalement validé. **13.5/20**",
                "On sent tout l'amour et le désespoir d'une personne qui avait une flemme monumentale d'aller faire des courses. **12/20**",
                "C'est ultra gras, c'est lourd, ça va boucher 3 artères principales, mais on n'a qu'une seule vie après tout. **15/20**",
                "Visuellement c'est un 4/20, mais spirituellement et caloriquement parlant c'est un coup de génie. **14.5/20**",
                "Ça a l'air très suspect mais j'engloutirais l'assiette entière en 30 secondes chrono sans respirer. **16/20**",
                "La présentation rappelle celle d'un étudiant fauché un dimanche soir de pluie. C'est émouvant et poétique. **11.5/20**",
                "Ça ressemble au repas que servirait une tavernière de RPG pour restaurer 45 points de vie. **13/20**",
                "Plat officiellement validé par le tribunal de Regaïa, mais vigoureusement condamné par le ministère de la Santé. **12.5/20**",
                "Pour un plat improvisé à l'arrache dans le serv d'Epsys, c'est franchement honorable. **15/20**",
                "Ce plat dégage une énergie purement chaotique mais étrangement réconfortante. **14/20**",
                "C'est le plat officiel du seum du dimanche soir. Un grand classique de la cuisine. **16.5/20**"
            ];
            const cibleUser = interaction.options.getUser('membre') ?? interaction.user;
            const cibleMember = interaction.guild?.members.cache.get(cibleUser.id);
            const nom = cibleMember?.displayName ?? cibleUser.username;
            const phrase = critiques[Math.floor(Math.random() * critiques.length)];

            const embed = new EmbedBuilder()
                .setColor(0xe67e22)
                .setTitle(`👨‍🍳 Le Verdict Top Chef pour ${nom}`)
                .setDescription(phrase)
                .setFooter({ text: '- Cacabot Critique Gastronomique' });

            return interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'question') {
            const embed = new EmbedBuilder()
                .setColor(0x9b59b6)
                .setTitle("❓ Question du soir")
                .setDescription("Choisis une catégorie pour recevoir une question aléatoire !");

            const menu = new StringSelectMenuBuilder()
                .setCustomId('question_menu')
                .setPlaceholder('Choisis une catégorie')
                .addOptions(
                    { label: '🗣️ Débats / Opinions', value: 'debats' },
                    { label: '🤫 Confession / Introspection', value: 'confession' },
                    { label: '🤔 Hypothétiques', value: 'hypothetiques' },
                    { label: '🏠 Spéciales Regaïa', value: 'serveur' },
                    { label: '🧠 Philosophie de comptoir', value: 'philosophie' },
                    { label: '🎲 Aléatoires / Chaos', value: 'aleatoires' }
                );

            const row = new ActionRowBuilder().addComponents(menu);
            return interaction.reply({ embeds: [embed], components: [row] });
        }

        if (commandName === 'choix') {
            const questionTexte = interaction.options.getString('question');
            const reponse = getResponse(`!choix ${questionTexte}`);
            return interaction.reply({ content: reponse });
        }

        if (commandName === 'suggestion') {
            const SUGGESTION_CHANNEL_ID = '720079866199801937';
            if (interaction.channel.id !== SUGGESTION_CHANNEL_ID) {
                return interaction.reply({ content: `💡 Les suggestions se font uniquement dans le salon <#${SUGGESTION_CHANNEL_ID}> !`, ephemeral: true });
            }

            const texte = interaction.options.getString('proposition');
            const data = {
                authorId: interaction.user.id,
                texte: texte,
                pour: [],
                contre: []
            };

            const embed = buildSuggestionEmbed(data, interaction.member);
            const row = buildSuggestionRow(data);

            const sent = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
            suggestionsData.set(sent.id, data);
            demanderSauvegarde();
            return;
        }

        if (commandName === 'anniversaire') {
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
                await saveBirthdays();
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
                await saveBirthdays();
                return interaction.reply(`🗑️ L'anniversaire de **${nom}** a été supprimé !`);
            }
        }

        // =========================
        // LOT 4 : STATS, UTILITAIRES & YOUTUBE
        // =========================

        if (commandName === 'actif') {
            cleanOldData();
            const authorId = interaction.user.id;
            const medals = ['🥇', '🥈', '🥉'];
            const counts = dailyData[getTodayKey()] ?? {};
            const sorted = Object.entries(counts).filter(([uid]) => uid !== '1503495713097519355').sort((a, b) => b[1] - a[1]).slice(0, 10);
            const fields = sorted.length > 0
                ? sorted.map(([uid, count], i) => {
                    const member = interaction.guild?.members.cache.get(uid);
                    const name = member?.displayName ?? 'Membre inconnu';
                    const medal = medals[i] ?? `**${i + 1}.**`;
                    return { name: `${medal} ${name}`, value: `${count} messages`, inline: false };
                })
                : [{ name: 'Aucune donnée', value: 'Pas encore de messages aujourd\'hui !', inline: false }];

            const embed = new EmbedBuilder().setColor(0xffd700).setTitle("📅 Membres les plus actifs aujourd'hui").addFields(fields);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`actif_jour_${authorId}`).setLabel('📅 Jour').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`actif_semaine_${authorId}`).setLabel('🗓️ Semaine').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`actif_mois_${authorId}`).setLabel('📆 Mois').setStyle(ButtonStyle.Secondary)
            );
            return interaction.reply({ embeds: [embed], components: [row] });
        }

        if (commandName === 'avatar') {
            const cible = interaction.options.getUser('membre') ?? interaction.user;
            const embed = new EmbedBuilder()
                .setColor(0x5865f2)
                .setTitle(`Avatar de ${cible.username}`)
                .setImage(cible.displayAvatarURL({ dynamic: true, size: 1024 }));
            return interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'serveur') {
            const guild = interaction.guild;
            if (!guild) return interaction.reply({ content: "Cette commande ne peut être utilisée que sur un serveur.", ephemeral: true });
            await guild.fetch();
            const owner = await guild.fetchOwner();
            const createdAt = guild.createdAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

            const embed = new EmbedBuilder()
                .setColor(0x00ebff)
                .setTitle(guild.name)
                .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
                .setDescription(guild.description || '*Aucune description*')
                .addFields(
                    { name: '👑 Propriétaire', value: owner.user.tag, inline: true },
                    { name: '📅 Création', value: createdAt, inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                    { name: '👥 Membres', value: `${guild.memberCount}`, inline: true },
                    { name: '💬 Salons', value: `${guild.channels.cache.size}`, inline: true },
                    { name: '🏷️ Rôles', value: `${guild.roles.cache.size}`, inline: true },
                    { name: '🚀 Niveau de boost', value: `Niveau ${guild.premiumTier}`, inline: true },
                    { name: '💫 Boosts', value: `${guild.premiumSubscriptionCount}`, inline: true },
                    { name: '🆔 ID', value: guild.id, inline: true }
                )
                .addFields(
                    { name: '\u200b', value: '[🔗 Lien d\'invitation du serveur](https://discord.com/invite/maAbUYb)', inline: false }
                );
            return interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'meteo') {
            const ville = interaction.options.getString('ville');
            await interaction.deferReply();
            try {
                const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(ville)}&count=1&language=fr&format=json`);
                const geoData = await geoRes.json();
                if (!geoData.results || geoData.results.length === 0) {
                    return interaction.editReply(`Ville introuvable : **${ville}**`);
                }
                const { latitude, longitude, name, country } = geoData.results[0];
                const meteoRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`);
                const meteoData = await meteoRes.json();
                const current = meteoData.current;
                const weatherDesc = {
                    0: '☀️ Ciel dégagé', 1: '🌤️ Plutôt dégagé', 2: '⛅ Partiellement nuageux', 3: '☁️ Couvert',
                    45: '🌫️ Brouillard', 48: '🌫️ Brouillard givrant',
                    51: '🌦️ Bruine légère', 53: '🌦️ Bruine', 55: '🌦️ Bruine forte',
                    61: '🌧️ Pluie légère', 63: '🌧️ Pluie', 65: '🌧️ Pluie forte',
                    71: '🌨️ Neige légère', 73: '🌨️ Neige', 75: '🌨️ Neige forte',
                    80: '🌦️ Averses', 81: '🌦️ Averses fortes', 82: '⛈️ Averses violentes',
                    95: '⛈️ Orage', 96: '⛈️ Orage avec grêle', 99: '⛈️ Orage violent avec grêle'
                };
                const description = weatherDesc[current.weather_code] || 'Conditions inconnues';
                const localTime = current.time.split('T')[1];
                const [heureLocale, minLocale] = localTime.split(':');
                const heureFormatee = `${heureLocale}h${minLocale}`;

                const embed = new EmbedBuilder()
                    .setColor(0x3498db)
                    .setTitle(`🌍 Météo à ${name}${country ? ', ' + country : ''}`)
                    .setDescription(description)
                    .addFields(
                        { name: '🌡️ Température', value: `${current.temperature_2m}°C (ressenti ${current.apparent_temperature}°C)`, inline: true },
                        { name: '💧 Humidité', value: `${current.relative_humidity_2m}%`, inline: true },
                        { name: '💨 Vent', value: `${current.wind_speed_10m} km/h`, inline: true },
                        { name: '🕒 Heure locale', value: heureFormatee, inline: true }
                    )
                    .setFooter({ text: 'Données via Open-Meteo' })
                    .setTimestamp();
                return interaction.editReply({ embeds: [embed] });
            } catch (e) {
                return interaction.editReply("Erreur lors de la récupération de la météo.");
            }
        }

        if (commandName === 'pomodoro') {
            const sub = interaction.options.getSubcommand();
            if (sub === 'stop') {
                if (!pomodoroSessions.has(interaction.channel.id)) {
                    return interaction.reply({ content: "Aucun pomodoro en cours dans ce salon !", ephemeral: true });
                }
                const stopSession = pomodoroSessions.get(interaction.channel.id);
                clearTimeout(stopSession.timeout);
                clearInterval(stopSession.updateInterval);
                if (stopSession?.message) await stopSession.message.delete().catch(() => {});
                pomodoroSessions.delete(interaction.channel.id);
                return interaction.reply("⏹️ Pomodoro arrêté !");
            }
            if (sub === 'lancer') {
                if (pomodoroSessions.has(interaction.channel.id)) {
                    return interaction.reply({ content: "Un pomodoro est déjà en cours dans ce salon ! Utilise `/pomodoro stop` pour l'arrêter.", ephemeral: true });
                }
                const workMenu = new StringSelectMenuBuilder()
                    .setCustomId(`pomo_setup_work_${interaction.user.id}_${interaction.channel.id}`)
                    .setPlaceholder('Durée de travail...')
                    .addOptions([5,10,15,20,25,30,35,40,45,50,55,60].map(n => ({ label: `${n} minutes`, value: `${n}` })));

                const breakMenu = new StringSelectMenuBuilder()
                    .setCustomId(`pomo_setup_break_${interaction.user.id}_${interaction.channel.id}`)
                    .setPlaceholder('Durée de pause...')
                    .addOptions([5,10,15,20,25,30].map(n => ({ label: `${n} minutes`, value: `${n}` })));

                const reasonMenu = new StringSelectMenuBuilder()
                    .setCustomId(`pomo_setup_reason_${interaction.user.id}_${interaction.channel.id}`)
                    .setPlaceholder('Raison du pomodoro...')
                    .addOptions([
                        { label: 'Devoirs', value: 'Devoirs', emoji: '📚' },
                        { label: 'Montage', value: 'Montage', emoji: '🎬' },
                        { label: 'Composition', value: 'Composition', emoji: '🎵' },
                        { label: 'Écriture', value: 'Écriture', emoji: '✍️' },
                        { label: 'Code', value: 'Code', emoji: '💻' },
                    ]);

                const embed = new EmbedBuilder()
                    .setColor(0xe74c3c)
                    .setTitle('🍅 Configurer le Pomodoro')
                    .setDescription('Choisis la durée de travail et la durée de pause !')
                    .addFields(
                        { name: '⏱️ Travail', value: 'Non défini', inline: true },
                        { name: '⏸️ Pause', value: 'Non défini', inline: true },
                        { name: '🎯 Raison', value: 'Non défini', inline: true }
                    );

                return interaction.reply({ embeds: [embed], components: [
                    new ActionRowBuilder().addComponents(workMenu),
                    new ActionRowBuilder().addComponents(breakMenu),
                    new ActionRowBuilder().addComponents(reasonMenu)
                ]});
            }
        }

        if (commandName === 'rappel') {
            const sub = interaction.options.getSubcommand();
            if (sub === 'list') {
                const mine = [...pendingRappels.entries()].filter(([, r]) => r.targetId === interaction.user.id);
                if (mine.length === 0) return interaction.reply({ content: "Tu n'as aucun rappel en attente !", ephemeral: true });
                const fields = mine.sort((a, b) => a[1].triggerAt - b[1].triggerAt).map(([, r]) => {
                    const remainingMs = r.triggerAt - Date.now();
                    const mins = Math.max(0, Math.floor(remainingMs / 60000));
                    const secs = Math.max(0, Math.floor((remainingMs % 60000) / 1000));
                    const dansStr = mins > 0 ? `dans ${mins}min ${secs}s` : `dans ${secs}s`;
                    return { name: r.texte, value: dansStr, inline: false };
                });
                const embed = new EmbedBuilder().setColor(0x5865f2).setTitle('⏰ Tes rappels en attente').addFields(fields);
                return interaction.reply({ embeds: [embed] });
            }
            if (sub === 'remove') {
                const query = interaction.options.getString('nom').toLowerCase();
                const mine = [...pendingRappels.entries()].filter(([, r]) => r.targetId === interaction.user.id);
                const match = mine.find(([, r]) => r.texte.toLowerCase() === query) ?? mine.find(([, r]) => r.texte.toLowerCase().includes(query));
                if (!match) return interaction.reply({ content: "Aucun rappel correspondant trouvé !", ephemeral: true });
                const [id, r] = match;
                clearTimeout(r.timeout);
                pendingRappels.delete(id);
                return interaction.reply(`🗑️ Rappel supprimé : **${r.texte}**`);
            }
            if (sub === 'ajouter') {
                const timeStr = interaction.options.getString('temps').toLowerCase();
                const texte = interaction.options.getString('message');
                let ms = 0;
                if (timeStr.endsWith('min')) ms = parseInt(timeStr) * 60 * 1000;
                else if (timeStr.endsWith('h')) ms = parseInt(timeStr) * 60 * 60 * 1000;
                else if (timeStr.endsWith('s')) ms = parseInt(timeStr) * 1000;
                else return interaction.reply({ content: "Format invalide ! Utilise `Xmin`, `Xh` ou `Xs` (ex : `15min`).", ephemeral: true });
                if (isNaN(ms) || ms <= 0 || ms > 24 * 60 * 60 * 1000) return interaction.reply({ content: "Durée invalide (maximum 24h) !", ephemeral: true });

                scheduleRappel(interaction.channel.id, interaction.user.id, texte, ms);
                return interaction.reply(`⏰ Rappel enregistré ! Je te ping dans **${timeStr}** pour : **${texte}**.`);
            }
        }

        if (commandName === 'aternos') {
            return interaction.reply("L'IP actuelle du serveur Minecraft de Regaïa est : **papierprout.aternos.me**");
        }

        if (commandName === 'youtube') {
            const query = interaction.options.getString('recherche');
            await interaction.deferReply();
            try {
                const searchRes = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=5&key=${process.env.YOUTUBE_API_KEY}`);
                const searchData = await searchRes.json();
                if (!searchData.items || searchData.items.length === 0) return interaction.editReply("Aucun résultat trouvé !");
                const videoIds = searchData.items.map(i => i.id.videoId).join(',');
                const detailRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoIds}&key=${process.env.YOUTUBE_API_KEY}`);
                const detailData = await detailRes.json();
                const videos = detailData.items;

                const buildYtEmbed = (index) => {
                    const v = videos[index];
                    const s = v.snippet;
                    const st = v.statistics || {};
                    const duration = v.contentDetails.duration.replace('PT', '').replace('H', 'h ').replace('M', 'min ').replace('S', 's');
                    const views = st.viewCount ? parseInt(st.viewCount).toLocaleString('fr-FR') : '0';
                    const likes = st.likeCount ? parseInt(st.likeCount).toLocaleString('fr-FR') : 'Masqué';
                    const comments = st.commentCount ? parseInt(st.commentCount).toLocaleString('fr-FR') : 'Désactivés';
                    const date = new Date(s.publishedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
                    const minUrl = s.thumbnails.maxres?.url ?? s.thumbnails.high?.url ?? s.thumbnails.default?.url;

                    return new EmbedBuilder()
                        .setColor(0xff0000)
                        .setTitle(s.title)
                        .setURL(`https://www.youtube.com/watch?v=${v.id}`)
                        .setImage(minUrl)
                        .addFields(
                            { name: '📺 Chaîne', value: s.channelTitle, inline: true },
                            { name: '⏱️ Durée', value: duration, inline: true },
                            { name: '👁️ Vues', value: views, inline: true },
                            { name: '👍 Likes', value: likes, inline: true },
                            { name: '💬 Commentaires', value: comments, inline: true },
                            { name: '📅 Publié le', value: date, inline: true }
                        )
                        .setFooter({ text: `Résultat ${index + 1}/${videos.length}` });
                };

                const firstVideo = videos[0];
                const firstUrl = `https://www.youtube.com/watch?v=${firstVideo.id}`;
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`yt_prev_${interaction.user.id}_0`).setLabel('⏮️ Précédent').setStyle(ButtonStyle.Secondary).setDisabled(true),
                    new ButtonBuilder().setCustomId(`yt_next_${interaction.user.id}_0`).setLabel('⏭️ Suivant').setStyle(ButtonStyle.Secondary).setDisabled(videos.length <= 1),
                    new ButtonBuilder().setLabel('🔗 Ouvrir').setStyle(ButtonStyle.Link).setURL(firstUrl),
                    new ButtonBuilder().setCustomId(`yt_close_${interaction.user.id}`).setLabel('❌ Fermer').setStyle(ButtonStyle.Danger)
                );
                const sent = await interaction.editReply({ embeds: [buildYtEmbed(0)], components: [row] });
                youtubeSearches.set(sent.id, { videos, authorId: interaction.user.id });
                setTimeout(() => youtubeSearches.delete(sent.id), 5 * 60 * 1000);
                return;
            } catch (e) {
                return interaction.editReply("Erreur lors de la recherche YouTube.");
            }
        }

        if (commandName === 'last') {
            const query = interaction.options.getString('chaine');
            await interaction.deferReply();
            try {
                let channelId = null;
                const urlMatch = query.match(/(?:youtube\.com\/(?:channel\/|c\/|@)|@)([a-zA-Z0-9_-]+)/);
                const handle = urlMatch ? urlMatch[1] : null;

                if (query.includes('youtube.com/channel/')) {
                    channelId = query.split('channel/')[1].split(/[/?]/)[0];
                } else {
                    const searchTerm = handle ?? query;
                    const forHandleRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(searchTerm.replace('@', ''))}&key=${process.env.YOUTUBE_API_KEY}`);
                    const forHandleData = await forHandleRes.json();
                    if (forHandleData.items && forHandleData.items.length > 0) {
                        channelId = forHandleData.items[0].id;
                    } else {
                        const searchRes = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(searchTerm)}&type=channel&maxResults=1&key=${process.env.YOUTUBE_API_KEY}`);
                        const searchData = await searchRes.json();
                        if (searchData.items && searchData.items.length > 0) {
                            channelId = searchData.items[0].snippet.channelId;
                        }
                    }
                }
                if (!channelId) return interaction.editReply("Chaîne introuvable !");

                const latestRes = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&maxResults=1&type=video&key=${process.env.YOUTUBE_API_KEY}`);
                const latestData = await latestRes.json();
                if (!latestData.items || latestData.items.length === 0) return interaction.editReply("Aucune vidéo trouvée pour cette chaîne !");

                const video = latestData.items[0];
                const videoId = video.id.videoId;
                const detailRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoId}&key=${process.env.YOUTUBE_API_KEY}`);
                const detailData = await detailRes.json();
                const fullVideo = detailData.items[0];

                const duration = fullVideo.contentDetails.duration.replace('PT', '').replace('H', 'h ').replace('M', 'min ').replace('S', 's');
                const views = parseInt(fullVideo.statistics.viewCount).toLocaleString('fr-FR');
                const date = new Date(video.snippet.publishedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

                const embed = new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle(decodeHtmlEntities(video.snippet.title))
                    .setURL(`https://www.youtube.com/watch?v=${videoId}`)
                    .setThumbnail(video.snippet.thumbnails.high.url)
                    .addFields(
                        { name: '📺 Chaîne', value: video.snippet.channelTitle, inline: true },
                        { name: '⏱️ Durée', value: duration, inline: true },
                        { name: '👁️ Vues', value: views, inline: true },
                        { name: '📅 Publié le', value: date, inline: true }
                    );

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setLabel('🔗 Ouvrir').setStyle(ButtonStyle.Link).setURL(`https://www.youtube.com/watch?v=${videoId}`),
                    new ButtonBuilder().setCustomId(`yt_close_${interaction.user.id}`).setLabel('❌ Fermer').setStyle(ButtonStyle.Danger)
                );
                return interaction.editReply({ embeds: [embed], components: [row] });
            } catch (e) {
                return interaction.editReply("Erreur lors de la récupération de la vidéo.");
            }
        }

        if (commandName === 'stats') {
            const query = interaction.options.getString('chaine');
            await interaction.deferReply();
            try {
                let channelId = null;
                const urlMatch = query.match(/(?:youtube\.com\/(?:channel\/|c\/|@)|@)([a-zA-Z0-9_-]+)/);
                const handle = urlMatch ? urlMatch[1] : null;

                if (query.includes('youtube.com/channel/')) {
                    channelId = query.split('channel/')[1].split(/[/?]/)[0];
                } else {
                    const searchTerm = handle ?? query;
                    const forHandleRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(searchTerm.replace('@', ''))}&key=${process.env.YOUTUBE_API_KEY}`);
                    const forHandleData = await forHandleRes.json();
                    if (forHandleData.items && forHandleData.items.length > 0) {
                        channelId = forHandleData.items[0].id;
                    } else {
                        const searchRes = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(searchTerm)}&type=channel&maxResults=1&key=${process.env.YOUTUBE_API_KEY}`);
                        const searchData = await searchRes.json();
                        if (searchData.items && searchData.items.length > 0) {
                            channelId = searchData.items[0].snippet.channelId;
                        }
                    }
                }
                if (!channelId) return interaction.editReply("Chaîne introuvable !");

                const detailRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,brandingSettings&id=${channelId}&key=${process.env.YOUTUBE_API_KEY}`);
                const detailData = await detailRes.json();
                if (!detailData.items || detailData.items.length === 0) return interaction.editReply("Chaîne introuvable !");

                const channel = detailData.items[0];
                const snippet = channel.snippet;
                const statistics = channel.statistics;
                const createdDate = new Date(snippet.publishedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

                const formatNumber = (num) => {
                    const n = parseInt(num);
                    if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace('.0', '') + ' Md';
                    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + ' M';
                    if (n >= 1_000) return (n / 1_000).toFixed(1).replace('.0', '') + ' k';
                    return n.toLocaleString('fr-FR');
                };

                const embed = new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle(snippet.title)
                    .setURL(`https://www.youtube.com/channel/${channelId}`)
                    .setThumbnail(snippet.thumbnails.high?.url ?? snippet.thumbnails.default.url)
                    .setDescription(snippet.description ? snippet.description.slice(0, 200) + (snippet.description.length > 200 ? '...' : '') : '*Aucune description*')
                    .addFields(
                        { name: '👥 Abonnés', value: statistics.hiddenSubscriberCount ? 'Caché' : formatNumber(statistics.subscriberCount), inline: true },
                        { name: '👁️ Vues totales', value: formatNumber(statistics.viewCount), inline: true },
                        { name: '🎬 Vidéos', value: formatNumber(statistics.videoCount), inline: true },
                        { name: '📅 Création', value: createdDate, inline: true }
                    )
                    .setFooter({ text: `ID : ${channelId}` });

                return interaction.editReply({ embeds: [embed] });
            } catch (e) {
                return interaction.editReply("Erreur lors de la récupération des stats.");
            }
        }

        if (commandName === 'botinfo') {
            const startDate = new Date('2026-05-14T00:00:00');
            const now = new Date();
            const diff = now - startDate;
            const totalHours = Math.floor(diff / (1000 * 60 * 60));
            const totalDays = Math.floor(totalHours / 24);
            const months = Math.floor(totalDays / 30);
            const days = totalDays % 30;
            const hours = totalHours % 24;

            let uptime = '';
            if (months > 0) uptime += `${months} mois, `;
            if (months > 0 || days > 0) uptime += `${days} jour${days > 1 ? 's' : ''}, `;
            uptime += `${hours} heure${hours > 1 ? 's' : ''}`;

            const commitCount = await getCommitCount();
            const versionStr = commitCount ? `Version 1.${commitCount}` : 'Version inconnue';

            const embed = new EmbedBuilder()
                .setColor(0x5865f2)
                .setTitle('🤖 Infos de Cacabot')
                .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }))
                .addFields(
                    { name: '💻 Commandes', value: '30+', inline: true },
                    { name: '💬 Messages envoyés', value: `${topData.messages['1503495713097519355'] ?? 0}`, inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                    { name: '👑 Créatrice', value: 'Epsys', inline: true },
                    { name: '🤝 Collaboratrice', value: '[BDN](https://bdn-fr.xyz/)', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                    { name: '📟 Version', value: versionStr, inline: true },
                    { name: '🕒 En ligne depuis', value: uptime, inline: true },
                    { name: '\u200b', value: '\u200b', inline: true }
                );
            return interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'ping') {
            await interaction.deferReply();
            const replyMsg = await interaction.fetchReply();
            const latence = replyMsg.createdTimestamp - interaction.createdTimestamp;
            const wsLatence = client.ws.ping;
            const embed = new EmbedBuilder()
                .setColor(latence < 100 ? 0x2ecc71 : latence < 250 ? 0xf39c12 : 0xe74c3c)
                .setTitle('🏓 Pong !')
                .addFields(
                    { name: '📨 Latence', value: `${latence}ms`, inline: true },
                    { name: '🔌 WebSocket', value: `${wsLatence}ms`, inline: true }
                );
            return interaction.editReply({ embeds: [embed] });
        }

        if (commandName === 'embed') {
            if (interaction.user.id !== '436218312574107658') {
                return interaction.reply({ content: "Cette commande est réservée à Epsys.", ephemeral: true });
            }
            return interaction.showModal(buildEmbedModal());
        }
    }

    // Bouton pour tirer une autre citation au hasard
    if (interaction.isButton() && interaction.customId.startsWith('quote_random_')) {
        const filterId = interaction.customId.replace('quote_random_', '');
        let pool = quotesData;

        if (filterId.startsWith('search_')) {
            const kw = decodeURIComponent(filterId.replace('search_', ''));
            pool = quotesData.filter(q => q.texte?.toLowerCase().includes(kw));
        } else if (filterId !== 'all') {
            pool = quotesData.filter(q => q.authorId === filterId);
        }

        if (pool.length === 0) {
            return interaction.reply({ content: "Aucune citation trouvée !", ephemeral: true });
        }

        const quoteChoisie = pool[Math.floor(Math.random() * pool.length)];
        const auteurMembre = interaction.guild.members.cache.get(quoteChoisie.authorId);
        const avatarUrl = quoteChoisie.avatarUrl 
                       ?? auteurMembre?.user?.displayAvatarURL({ dynamic: true, size: 256 }) 
                       ?? auteurMembre?.displayAvatarURL?.({ dynamic: true, size: 256 });

        const lienMsg = quoteChoisie.messageUrl ?? `https://discord.com/channels/${interaction.guild.id}/${quoteChoisie.channelId}`;
        const auteurMention = quoteChoisie.isWebhook ? `**${quoteChoisie.authorName}** *(Webhook)*` : `<@${quoteChoisie.authorId}>`;

        const texteAffiche = quoteChoisie.texte && quoteChoisie.texte !== '(Image)'
            ? `## « ${quoteChoisie.texte} »\n\n    -${auteurMention}\n\n-# *[source](${lienMsg})*`
            : `    -${auteurMention}\n\n-# *[source](${lienMsg})*`;

        const embedQuote = new EmbedBuilder()
            .setColor(0xf1c40f)
            .setTitle(`📜 Citation N°${quoteChoisie.id}`)
            .setDescription(texteAffiche)
            .setFooter({ text: `[${quoteChoisie.id}/${quotesData.length}] • Réponds à un message en faisant !quote pour l'enregistrer !` });

        if (avatarUrl) embedQuote.setThumbnail(avatarUrl);
        if (quoteChoisie.imageUrl) embedQuote.setImage(quoteChoisie.imageUrl);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`quote_random_${filterId}`)
                .setLabel('🎲 Une autre citation')
                .setStyle(ButtonStyle.Secondary)
        );

        return interaction.update({ embeds: [embedQuote], components: [row] });
    }

    // Bouton pour afficher l'énoncé du motus de la session
    if (interaction.isButton() && interaction.customId.startsWith('motus_show_original_')) {
        const dateKey = getMotusDateKey();
        const longueur = motusData.longueur || 6;
        const mot = motusData.mot || getMotDuJour(dateKey, longueur);
        const embed = buildMotusEmbed(mot, dateKey, longueur);
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Bouton pour voir ses propres stats Motus
    if (interaction.isButton() && interaction.customId.startsWith('motus_view_stats_')) {
        const member = interaction.member;
        const embed = buildMotusStatsEmbed(member, interaction.user);
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Bouton pour voir ses propres stats Rébus Regaïen
    if (interaction.isButton() && interaction.customId === 'rebus_view_stats') {
        const member = interaction.member;
        const embed = buildRebusStatsEmbed(member);
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Bouton ouvrant le Modal depuis !embed
    if (interaction.isButton() && interaction.customId === 'open_embed_modal') {
        if (interaction.user.id !== '436218312574107658') {
            return interaction.reply({ content: "Ce bouton est réservé à Epsys.", ephemeral: true });
        }
        return interaction.showModal(buildEmbedModal());
    }

    // Bouton pour retoucher l'embed pré-rempli
    if (interaction.isButton() && interaction.customId === 'embed_edit_draft') {
        if (interaction.user.id !== '436218312574107658') return;
        const draft = embedDrafts.get(interaction.user.id);
        return interaction.showModal(buildEmbedModal(draft));
    }

    // Soumission du formulaire Modal (Aperçu)
    if (interaction.isModalSubmit() && interaction.customId === 'embed_builder_modal') {
        if (interaction.user.id !== '436218312574107658') return;

        const titre = interaction.fields.getTextInputValue('embed_title')?.trim();
        const desc = interaction.fields.getTextInputValue('embed_desc')?.trim();
        const couleurRaw = interaction.fields.getTextInputValue('embed_color')?.trim();
        const image = interaction.fields.getTextInputValue('embed_image')?.trim();
        const footer = interaction.fields.getTextInputValue('embed_footer')?.trim();

        if (!titre && !desc && !image && !footer) {
            return interaction.reply({ content: "❌ Ton embed doit au moins contenir une image, un titre ou du texte !", ephemeral: true });
        }

        const embedPreview = new EmbedBuilder()
            .setColor(parseEmbedColor(couleurRaw));

        if (titre) embedPreview.setTitle(titre);
        if (desc) embedPreview.setDescription(desc);
        if (image && /^https?:\/\//i.test(image)) embedPreview.setImage(image);
        if (footer) embedPreview.setFooter({ text: footer });

        embedDrafts.set(interaction.user.id, { titre, desc, couleurRaw, image, footer, embed: embedPreview });

        const channelSelect = new ChannelSelectMenuBuilder()
            .setCustomId('embed_send_channel')
            .setPlaceholder('Choisis le salon où envoyer cet embed...')
            .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);

        const editBtn = new ButtonBuilder()
            .setCustomId('embed_edit_draft')
            .setLabel('✏️ Modifier l\'embed')
            .setStyle(ButtonStyle.Secondary);

        const cancelBtn = new ButtonBuilder()
            .setCustomId('embed_cancel_draft')
            .setLabel('❌ Annuler')
            .setStyle(ButtonStyle.Danger);

        const rowSelect = new ActionRowBuilder().addComponents(channelSelect);
        const rowButtons = new ActionRowBuilder().addComponents(editBtn, cancelBtn);

        const previewData = {
            content: "👀 **Voici l'aperçu de ton embed :**\n*(Choisis le salon ci-dessous, ou clique sur Modifier pour retoucher)*",
            embeds: [embedPreview],
            components: [rowSelect, rowButtons]
        };

        if (interaction.isFromMessage()) return interaction.update(previewData);
        return interaction.reply({ ...previewData, ephemeral: true });
    }

    // Sélection du salon de destination
    if (interaction.isChannelSelectMenu() && interaction.customId === 'embed_send_channel') {
        if (interaction.user.id !== '436218312574107658') return;

        const draft = embedDrafts.get(interaction.user.id);
        if (!draft) {
            return interaction.update({ content: "❌ Aucun brouillon d'embed trouvé ou il a expiré.", embeds: [], components: [] });
        }

        const channelId = interaction.values[0];
        const targetChannel = interaction.guild?.channels.cache.get(channelId);

        if (!targetChannel) {
            return interaction.update({ content: "❌ Salon introuvable.", embeds: [], components: [] });
        }

        await targetChannel.send({ embeds: [draft.embed ?? draft] }).catch(err => {
            return interaction.update({ content: `❌ Erreur lors de l'envoi : ${err.message}`, embeds: [], components: [] });
        });

        embedDrafts.delete(interaction.user.id);
        return interaction.update({
            content: `✅ **Embed envoyé avec succès dans <#${channelId}> !**`,
            embeds: [],
            components: []
        });
    }

    // Annulation du brouillon
    if (interaction.isButton() && interaction.customId === 'embed_cancel_draft') {
        if (interaction.user.id !== '436218312574107658') return;
        embedDrafts.delete(interaction.user.id);
        return interaction.update({ content: "🗑️ Création de l'embed annulée.", embeds: [], components: [] });
    }

    // Actions de modération sur les comptes récents
    if (interaction.isButton() && interaction.customId.startsWith('mod_action_')) {
        if (!estModo(interaction.member) && !interaction.member.permissions.has('KickMembers')) {
            return interaction.reply({ content: "Tu n'as pas la permission d'effectuer cette action.", ephemeral: true });
        }

        const parts = interaction.customId.split('_');
        const action = parts[2]; // kick, ban ou dismiss
        const targetId = parts[3];

        if (action === 'dismiss') {
            await interaction.message.edit({ components: [] }).catch(() => {});
            return interaction.reply(`✅ Alerte classée sans suite pour <@${targetId}> par <@${interaction.user.id}>.`);
        }

        if (action === 'kick') {
            const cible = await interaction.guild.members.fetch(targetId).catch(() => null);
            if (!cible) {
                return interaction.reply({ content: "Ce membre a déjà quitté le serveur.", ephemeral: true });
            }
            await cible.kick(`Expulsé par ${interaction.user.tag} (compte récent suspect)`)
                .then(async () => {
                    await interaction.message.edit({ components: [] }).catch(() => {});
                    interaction.reply(`👢 <@${targetId}> a été expulsé.e du serveur par <@${interaction.user.id}>.`);
                })
                .catch(() => interaction.reply({ content: "Impossible d'expulser ce membre (permissions insuffisantes).", ephemeral: true }));
            return;
        }

        if (action === 'ban') {
            await interaction.guild.members.ban(targetId, { reason: `Banni par ${interaction.user.tag} (compte récent suspect)` })
                .then(async () => {
                    await interaction.message.edit({ components: [] }).catch(() => {});
                    interaction.reply(`🔨 <@${targetId}> a été banni.e définitivement par <@${interaction.user.id}>.`);
                })
                .catch(() => interaction.reply({ content: "Impossible de bannir ce membre (permissions insuffisantes).", ephemeral: true }));
            return;
        }
    }

    // Bouton de bannissement rapide anti-phishing
    if (interaction.isButton() && interaction.customId.startsWith('antiphish_ban_')) {
        if (!estModo(interaction.member) && !interaction.member.permissions.has('BanMembers')) {
            return interaction.reply({ content: "Tu n'as pas la permission d'utiliser ce bouton !", ephemeral: true });
        }
        const targetId = interaction.customId.replace('antiphish_ban_', '');
        await interaction.guild.members.ban(targetId, { reason: 'Compte piraté / Phishing détecté par Cacabot' })
            .then(() => interaction.reply(`✅ Le compte <@${targetId}> a été définitivement banni par <@${interaction.user.id}>.`))
            .catch(() => interaction.reply({ content: "Impossible de bannir ce membre (permissions insuffisantes ou membre déjà parti).", ephemeral: true }));
        return;
    }

    // =========================
    // BOUTON RAPPEL REPORTER
    // =========================

    if (interaction.isButton() && interaction.customId.startsWith('rappel_report_')) {
        const targetId = interaction.customId.replace('rappel_report_', '');
        if (interaction.user.id !== targetId) {
            return interaction.reply({ content: "Ce rappel n'est pas pour toi !", ephemeral: true });
        }
        const data = rappelReports.get(interaction.message.id);
        if (!data) return interaction.reply({ content: "Ce rappel a expir\u00e9 !", ephemeral: true });

        const delayMenu = new StringSelectMenuBuilder()
            .setCustomId(`rappel_delay_${targetId}`)
            .setPlaceholder('Choisis un d\u00e9lai...')
            .addOptions(
                { label: '15 minutes', value: '15min' },
                { label: '30 minutes', value: '30min' },
                { label: '1 heure', value: '1h' },
                { label: '2 heures', value: '2h' },
                { label: '\u00c0 d\u00e9terminer', value: 'custom' }
            );
        const row = new ActionRowBuilder().addComponents(delayMenu);
        return interaction.update({ content: 'Choisis quand est-ce que tu veux que le rappel soit renvoy\u00e9 :', components: [row] });
    }

    // =========================
    // MENU DELAI RAPPEL
    // =========================

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('rappel_delay_')) {
        const targetId = interaction.customId.replace('rappel_delay_', '');
        if (interaction.user.id !== targetId) {
            return interaction.reply({ content: "Ce rappel n'est pas pour toi !", ephemeral: true });
        }
        const data = rappelReports.get(interaction.message.id);
        if (!data) return interaction.reply({ content: "Ce rappel a expir\u00e9 !", ephemeral: true });

        const value = interaction.values[0];

        if (value === 'custom') {
            await interaction.update({ content: 'Choisis un d\u00e9lai (ex : `10min`, `2h`) :', components: [] });

            const filter = m => m.author.id === targetId;
            const collector = interaction.channel.createMessageCollector({ filter, time: 5 * 60 * 1000, max: 1 });

            collector.on('collect', async (m) => {
                const timeStr = m.content.trim().toLowerCase();
                let ms = 0;
                if (timeStr.endsWith('min')) ms = parseInt(timeStr) * 60 * 1000;
                else if (timeStr.endsWith('h')) ms = parseInt(timeStr) * 60 * 60 * 1000;
                else if (timeStr.endsWith('s')) ms = parseInt(timeStr) * 1000;

                m.delete().catch(() => {});

                if (isNaN(ms) || ms <= 0 || ms > 24 * 60 * 60 * 1000) {
                    await interaction.editReply({ content: 'D\u00e9lai invalide ! Le report a \u00e9t\u00e9 annul\u00e9.', components: [] }).catch(() => {});
                    return;
                }

                await interaction.editReply({ content: `\u23f0 Rappel report\u00e9 ! Je ping <@${targetId}> dans **${timeStr}**.`, components: [] }).catch(() => {});
                scheduleRappel(data.channelId, targetId, data.texte, ms);
            });

            collector.on('end', (collected) => {
                if (collected.size === 0) {
                    interaction.editReply({ content: '\u23f1\ufe0f Temps \u00e9coul\u00e9, report annul\u00e9.', components: [] }).catch(() => {});
                }
            });
            return;
        }

        let ms = 0;
        if (value.endsWith('min')) ms = parseInt(value) * 60 * 1000;
        else if (value.endsWith('h')) ms = parseInt(value) * 60 * 60 * 1000;

        await interaction.update({ content: `\u23f0 Rappel report\u00e9 ! Je ping <@${targetId}> dans **${value}**.`, components: [] });
        scheduleRappel(data.channelId, targetId, data.texte, ms);
    }

    // =========================
    //     BOUTONS YOUTUBE
    // =========================

    if (interaction.isButton() && interaction.customId.startsWith('yt_')) {
    const parts = interaction.customId.split('_');
    const action = parts[1];
    const authorId = parts[2];

    if (interaction.user.id !== authorId) {
        return interaction.reply({ content: "C'est pas ta recherche !", ephemeral: true });
    }

    if (action === 'close') {
        youtubeSearches.delete(interaction.message.id);
        await interaction.message.delete().catch(() => {});
        return;
    }

    const search = youtubeSearches.get(interaction.message.id);
    if (!search) return interaction.reply({ content: "Cette recherche a expiré !", ephemeral: true });

    const currentIndex = parseInt(parts[3]);
    const newIndex = action === 'next' ? currentIndex + 1 : currentIndex - 1;
    const { videos } = search;
    const video = videos[newIndex];
    const videoUrl = `https://www.youtube.com/watch?v=${video.id}`;

    const buildYoutubeEmbed = (index) => {
        const v = videos[index];
        const snippet = v.snippet;
        const stats = v.statistics || {};

        const duration = v.contentDetails.duration
            .replace('PT', '')
            .replace('H', 'h ')
            .replace('M', 'min ')
            .replace('S', 's');

        const views = stats.viewCount ? parseInt(stats.viewCount).toLocaleString('fr-FR') : '0';
        const likes = stats.likeCount ? parseInt(stats.likeCount).toLocaleString('fr-FR') : 'Masqué';
        const comments = stats.commentCount ? parseInt(stats.commentCount).toLocaleString('fr-FR') : 'Désactivés';
        const date = new Date(snippet.publishedAt).toLocaleDateString('fr-FR', {
            day: 'numeric', month: 'long', year: 'numeric'
        });

        const miniatureUrl = snippet.thumbnails.maxres?.url ?? snippet.thumbnails.high?.url ?? snippet.thumbnails.default?.url;

        return new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle(snippet.title)
            .setURL(`https://www.youtube.com/watch?v=${v.id}`)
            .setImage(miniatureUrl)
            .addFields(
                { name: '📺 Chaîne', value: snippet.channelTitle, inline: true },
                { name: '⏱️ Durée', value: duration, inline: true },
                { name: '👁️ Vues', value: views, inline: true },
                { name: '👍 Likes', value: likes, inline: true },
                { name: '💬 Commentaires', value: comments, inline: true },
                { name: '📅 Publié le', value: date, inline: true }
            )
            .setFooter({ text: `Résultat ${index + 1}/${videos.length}` });
    };

    const buildYoutubeRow = (index) => {
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`yt_prev_${authorId}_${index}`)
                .setLabel('⏮️ Précédent')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(index === 0),
            new ButtonBuilder()
                .setCustomId(`yt_next_${authorId}_${index}`)
                .setLabel('⏭️ Suivant')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(index >= videos.length - 1),
            new ButtonBuilder()
                .setLabel('🔗 Ouvrir')
                .setStyle(ButtonStyle.Link)
                .setURL(videoUrl),
            new ButtonBuilder()
                .setCustomId(`yt_close_${authorId}`)
                .setLabel('❌ Fermer')
                .setStyle(ButtonStyle.Danger)
        );
    };

    return interaction.update({
        embeds: [buildYoutubeEmbed(newIndex)],
        components: [buildYoutubeRow(newIndex)]
    });
}

    // =========================
    //      BOUTONS PRUNE
    // =========================

    if (interaction.isButton() && interaction.customId.startsWith('prune_')) {
    const parts = interaction.customId.split('_');
    const action = parts[1];
    const authorId = parts[2];

    if (interaction.user.id !== authorId) {
        return interaction.reply({ content: "C'est pas ta commande !", ephemeral: true });
    }

    const member = interaction.guild.members.cache.get(authorId);
    if (!member?.permissions.has('KickMembers')) {
        return interaction.reply({ content: "Tu n'as plus les permissions nécessaires !", ephemeral: true });
    }

    if (action === 'manual') {
        await interaction.message.delete().catch(() => {});
        return interaction.reply({ content: "OK ! Utilise `!prune 100` autant de fois que nécessaire.", ephemeral: true });
    }

    if (action === 'auto') {
        const total = parseInt(parts[3]);
        const channelId = parts[4];
        const channel = interaction.guild.channels.cache.get(channelId);
        if (!channel) return interaction.reply({ content: "Salon introuvable !", ephemeral: true });

        await interaction.message.delete().catch(() => {});
        await interaction.reply({ content: `🗑️ Suppression en cours...`, ephemeral: true });

        let remaining = total;
        let totalDeleted = 0;

        while (remaining > 0) {
            const limit = Math.min(remaining, 100);
            try {
                const messages = await channel.messages.fetch({ limit: limit + 1 });
                const toDelete = messages.filter(m => {
                    const age = Date.now() - m.createdTimestamp;
                    return age < 14 * 24 * 60 * 60 * 1000;
                });
                if (toDelete.size === 0) break;
                await channel.bulkDelete(toDelete, true);
                totalDeleted += toDelete.size;
                remaining -= limit;
                if (remaining > 0) await new Promise(r => setTimeout(r, 1500));
            } catch (e) {
                break;
            }
        }
        return;
    }
}

    // =========================
    //     BOUTONS WANTED
    // =========================

    if (interaction.isButton() && interaction.customId.startsWith('wanted_tab_')) {
    const parts = interaction.customId.split('_');
    const tab = parts[2];
    const authorId = parts[3];

    if (authorId !== 'daily' && interaction.user.id !== authorId) {
        return interaction.reply({ content: 'Pour consulter les menus de l\'avis de recherche, utilise `!wanted` !', ephemeral: true });
    }

    const now = new Date();
    const dateKey = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
    const wantedID = getWantedOfTheDay(dateKey, interaction.guild);

    if (tab === 'avis') {
        const { embed } = getWantedEmbedData(interaction.guild, dateKey, wantedID);
        const prime = Math.floor(seedRndWanted(dateKey * 19) * 95) + 5;
        const nom = interaction.guild.members.cache.get(wantedID)?.displayName ?? wantedID;
        try {
            const avatarUrl = interaction.guild.members.cache.get(wantedID)?.user.displayAvatarURL({ extension: 'png', size: 512 });
            const imageBuffer = await generateWantedImage(avatarUrl, nom, prime);
            embed.setImage('attachment://wanted.png');
            return interaction.update({ embeds: [embed], files: [{ attachment: imageBuffer, name: 'wanted.png' }], components: [buildWantedRow('avis', authorId)] });
        } catch (e) {
            embed.setThumbnail(interaction.guild.members.cache.get(wantedID)?.user.displayAvatarURL({ dynamic: true }));
            return interaction.update({ embeds: [embed], components: [buildWantedRow('avis', authorId)] });
        }
    } else if (tab === 'preuves') {
        return interaction.update({ embeds: [getPreuvesEmbed(interaction.guild, dateKey, wantedID)], components: [buildWantedRow('preuves', authorId)] });
    } else if (tab === 'affaire') {
        return interaction.update({ embeds: [getAffaireEmbed(interaction.guild, dateKey, wantedID)], components: [buildWantedRow('affaire', authorId)] });
    }
}


    // =========================
    //     BOUTON POMODORO
    // =========================

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('pomo_setup_')) {
    const parts = interaction.customId.split('_');
    const type = parts[2];
    const authorId = parts[3];
    const channelId = parts[4];

    if (interaction.user.id !== authorId) {
        return interaction.reply({ content: "Ce menu ne t'est pas destiné !", ephemeral: true });
    }

    const value = interaction.values[0];
    const fields = interaction.message.embeds[0].fields;
    const workVal = type === 'work' ? `${value} min` : fields[0].value;
    const breakVal = type === 'break' ? `${value} min` : fields[1].value;
    const reasonVal = type === 'reason' ? value : (fields[2]?.value ?? 'Non défini');
    const ready = workVal !== 'Non défini' && breakVal !== 'Non défini' && reasonVal !== 'Non défini';

    const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('🍅 Configurer le Pomodoro')
        .setDescription(ready ? 'Prêt à lancer !' : 'Choisis la durée de travail et la durée de pause !')
        .addFields(
            { name: '⏱️ Travail', value: workVal, inline: true },
            { name: '⏸️ Pause', value: breakVal, inline: true },
            { name: '🎯 Raison', value: reasonVal, inline: true }
        );

    const rows = [
    new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`pomo_setup_work_${authorId}_${channelId}`)
            .setPlaceholder('Durée de travail...')
            .addOptions([5,10,15,20,25,30,35,40,45,50,55,60].map(n => ({
                label: `${n} minutes`, value: `${n}`
            })))
    ),
    new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`pomo_setup_break_${authorId}_${channelId}`)
            .setPlaceholder('Durée de pause...')
            .addOptions([5,10,15,20,25,30].map(n => ({
                label: `${n} minutes`, value: `${n}`
            })))
    ),
    new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`pomo_setup_reason_${authorId}_${channelId}`)
            .setPlaceholder('Raison du pomodoro...')
            .addOptions([
                { label: 'Devoirs', value: 'Devoirs', emoji: '📚' },
                { label: 'Montage', value: 'Montage', emoji: '🎬' },
                { label: 'Composition', value: 'Composition', emoji: '🎵' },
                { label: 'Écriture', value: 'Écriture', emoji: '✍️' },
                { label: 'Code', value: 'Code', emoji: '💻' },
            ])
    )
];

if (ready) {
    rows.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`pomo_start_${authorId}_${channelId}_${parseInt(workVal)}_${parseInt(breakVal)}_${encodeURIComponent(reasonVal)}`)
            .setLabel('🍅 Lancer !')
            .setStyle(ButtonStyle.Danger)
    ));
}

return interaction.update({ embeds: [embed], components: rows });
}

    if (interaction.isButton() && interaction.customId.startsWith('pomo_')) {
    const parts = interaction.customId.split('_');
    const action = parts[1];

    if (action === 'start') {
        const authorId = parts[2];
        const channelId = parts[3];
        const workMin = parseInt(parts[4]);
        const breakMin = parseInt(parts[5]);
        const reason = decodeURIComponent(parts[6] ?? 'Session de travail');

        if (interaction.user.id !== authorId) {
            return interaction.reply({ content: "C'est pas ton pomodoro !", ephemeral: true });
        }

        if (pomodoroSessions.has(channelId)) {
            return interaction.reply({ content: "Un pomodoro est déjà en cours dans ce salon !", ephemeral: true });
        }

        const participantsMention = `<@${authorId}>`;
        await interaction.message.delete().catch(() => {});
        const channel = interaction.guild.channels.cache.get(channelId);
        if (!channel) return;

        await startPomodoro(channel, participantsMention, workMin, breakMin, 1, 'work', reason);
        return;
    }

    const channelId = parts[2];
    const session = pomodoroSessions.get(channelId);
    if (!session) return interaction.reply({ content: "Ce pomodoro n'existe plus !", ephemeral: true });

    if (action === 'stop') {
        clearTimeout(session.timeout);
        clearInterval(session.updateInterval);
        pomodoroSessions.delete(channelId);
        await session.message.delete().catch(() => {});
        return interaction.reply("⏹️ Pomodoro arrêté !");
    }

    if (action === 'skip') {
        clearTimeout(session.timeout);
        clearInterval(session.updateInterval);
        session.skip();
        return interaction.reply({ content: "⏭️ Phase skippée !", ephemeral: true });
    }
}

    // =========================
    //       BOUTON RUN
    // =========================

    if (interaction.isButton() && interaction.customId.startsWith("run_join_")) {
        const parts = interaction.customId.split("_");
        const originalAuthorId = parts[2];
        const originalAuthorNom = parts[3];
        const cibleId = parts[4] ?? null;

        if (interaction.user.id === originalAuthorId) {
            return interaction.reply({ content: "Tu es déjà en fuite !", ephemeral: true });
        }
        if (cibleId && interaction.user.id === cibleId) {
            return interaction.reply({ content: "C'est toi qu'on fuit !", ephemeral: true });
        }

        const joinNom = interaction.member?.displayName ?? interaction.user.username;
        const embed = buildRunEmbed(`🏃 **${joinNom}** accompagne **${originalAuthorNom}** !`);
        return interaction.reply({ embeds: [embed] });
    }

    // =========================
    // BOUTONS ACTIF
    // =========================

    if (interaction.isButton() && (interaction.customId.startsWith('actif_jour_') || interaction.customId.startsWith('actif_semaine_') || interaction.customId.startsWith('actif_mois_'))) {
        const parts = interaction.customId.split('_');
        const periode = parts[1];
        const authorId = parts[2];

        if (interaction.user.id !== authorId) {
            return interaction.reply({ content: "Ce bouton ne t'est pas destin\u00e9 !", ephemeral: true });
        }

        const medals = ['\ud83e\udd47', '\ud83e\udd48', '\ud83e\udd49'];
        let counts, titre;
        if (periode === 'jour') {
            counts = dailyData[getTodayKey()] ?? {};
            titre = "\ud83d\udcc5 Membres les plus actifs aujourd'hui";
        } else if (periode === 'semaine') {
            counts = weeklyData[getWeekKey()] ?? {};
            titre = '\ud83d\uddd3\ufe0f Membres les plus actifs cette semaine';
        } else {
            counts = monthlyData[getMonthKey()] ?? {};
            titre = '\ud83d\udcc6 Membres les plus actifs ce mois-ci';
        }

        const sorted = Object.entries(counts).filter(([uid]) => uid !== '1503495713097519355').sort((a, b) => b[1] - a[1]).slice(0, 10);
        const fields = sorted.length > 0
            ? sorted.map(([uid, count], i) => {
                const member = interaction.guild.members.cache.get(uid);
                const name = member?.displayName ?? 'Membre inconnu';
                const medal = medals[i] ?? `**${i + 1}.**`;
                return { name: `${medal} ${name}`, value: `${count} messages`, inline: false };
            })
            : [{ name: 'Aucune donn\u00e9e', value: 'Pas encore de messages !', inline: false }];

        const embed = new EmbedBuilder().setColor(0xffd700).setTitle(titre).addFields(fields);

        const jourBtn = new ButtonBuilder()
            .setCustomId(`actif_jour_${authorId}`)
            .setLabel('\ud83d\udcc5 Jour')
            .setStyle(periode === 'jour' ? ButtonStyle.Primary : ButtonStyle.Secondary);
        const semaineBtn = new ButtonBuilder()
            .setCustomId(`actif_semaine_${authorId}`)
            .setLabel('\ud83d\uddd3\ufe0f Semaine')
            .setStyle(periode === 'semaine' ? ButtonStyle.Primary : ButtonStyle.Secondary);
        const moisBtn = new ButtonBuilder()
            .setCustomId(`actif_mois_${authorId}`)
            .setLabel('\ud83d\udcc6 Mois')
            .setStyle(periode === 'mois' ? ButtonStyle.Primary : ButtonStyle.Secondary);
        const row = new ActionRowBuilder().addComponents(jourBtn, semaineBtn, moisBtn);

        return interaction.update({ embeds: [embed], components: [row] });
    }

    // =========================
    // BOUTONS TOP
    // =========================

    if (interaction.isButton() && (interaction.customId.startsWith('top_prev_') || interaction.customId.startsWith('top_next_'))) {
        const parts = interaction.customId.split('_');
        const direction = parts[1]; // prev ou next
        const authorId = parts[2];
        const currentPage = parseInt(parts[3]);

        if (interaction.user.id !== authorId) {
            return interaction.reply({ content: "Ce bouton ne t'est pas destin\u00e9 !", ephemeral: true });
        }

        const newPage = direction === 'next' ? currentPage + 1 : currentPage - 1;
        const PAGE_SIZE = 10;
        const allSorted = Object.entries(topData.messages).sort((a, b) => b[1] - a[1]);
        const totalPages = Math.ceil(allSorted.length / PAGE_SIZE);

        const start = newPage * PAGE_SIZE;
        const slice = allSorted.slice(start, start + PAGE_SIZE);
        const medals = ['\ud83e\udd47', '\ud83e\udd48', '\ud83e\udd49'];
        const fields = slice.map(([uid, count], i) => {
            const member = interaction.guild.members.cache.get(uid);
            if (!member) return null;
            const rank = start + i;
            const medal = rank < 3 ? medals[rank] : `**${rank + 1}.**`;
            return { name: `${medal} ${member.displayName}`, value: `${count} messages`, inline: false };
        }).filter(Boolean);

        const userRank = allSorted.findIndex(([uid]) => uid === authorId);
        const userCount = topData.messages[authorId] || 0;
        let infoPerso = '';

        if (userRank !== -1) {
            const position = userRank + 1;
            if (userRank >= 10 && allSorted[9]) {
                const diff = (allSorted[9][1] - userCount) + 1;
                infoPerso = `> 👤 **Ta position :** **#${position}** avec **${userCount} messages** *(à ${diff} message${diff > 1 ? 's' : ''} du Top 10 !)*\n\n`;
            } else {
                infoPerso = `> 👤 **Ta position :** **#${position}** avec **${userCount} messages** *(Tu es dans le Top 10 ! 🔥)*\n\n`;
            }
        }

        const embed = new EmbedBuilder()
            .setColor(0xffd700)
            .setTitle('🏆 Classement des membres')
            .setDescription(infoPerso)
            .addFields(fields)
            .setFooter({ text: `Page ${newPage + 1}/${totalPages} • Compté depuis l'initialisation du bot` });

        const prev = new ButtonBuilder()
            .setCustomId(`top_prev_${authorId}_${newPage}`)
            .setLabel('\u2b05\ufe0f Arrière')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(newPage === 0);
        const next = new ButtonBuilder()
            .setCustomId(`top_next_${authorId}_${newPage}`)
            .setLabel('Suivant \u27a1\ufe0f')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(newPage >= totalPages - 1);
        const row = new ActionRowBuilder().addComponents(prev, next);

        return interaction.update({ embeds: [embed], components: [row] });
    }

    // =========================
    // BOUTONS ANNIVERSAIRE LIST
    // =========================

    if (interaction.isButton() && interaction.customId.startsWith('anniv_list_')) {
    const parts = interaction.customId.split('_');
    const ordre = parts[2];
    const authorId = parts[3];
    const currentPage = parseInt(parts[4]) || 0;
    const action = parts[5]; // prev, next, ou switch

    if (interaction.user.id !== authorId) {
        return interaction.reply({ content: "Ce bouton ne t'est pas destin\u00e9 !", ephemeral: true });
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
    const lines = slice.map(([uid, date]) => `<@${uid}> \u2014 **${date}**`).join('\n');

    const prev = new ButtonBuilder()
        .setCustomId(`anniv_list_${newOrdre}_${authorId}_${newPage}_prev`)
        .setLabel('\u2b05\ufe0f Arri\u00e8re')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(newPage === 0);
    const next = new ButtonBuilder()
        .setCustomId(`anniv_list_${newOrdre}_${authorId}_${newPage}_next`)
        .setLabel('Suivant \u27a1\ufe0f')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(newPage >= totalPages - 1);
    const chronoBtn = new ButtonBuilder()
        .setCustomId(`anniv_list_chrono_${authorId}_${newPage}_switch`)
        .setLabel('\ud83d\udd52 Ordre chronologique')
        .setStyle(newOrdre === 'chrono' ? ButtonStyle.Primary : ButtonStyle.Secondary);
    const classiqueBtn = new ButtonBuilder()
        .setCustomId(`anniv_list_classique_${authorId}_${newPage}_switch`)
        .setLabel('\ud83d\udcc5 Ordre classique')
        .setStyle(newOrdre === 'classique' ? ButtonStyle.Primary : ButtonStyle.Secondary);
    const row1 = new ActionRowBuilder().addComponents(prev, next);
    const row2 = new ActionRowBuilder().addComponents(chronoBtn, classiqueBtn);

    const embed = new EmbedBuilder()
        .setColor(0xff69b4)
        .setTitle('\ud83c\udf82 Anniversaires du serveur')
        .setDescription(lines)
        .setFooter({ text: `Page ${newPage + 1}/${totalPages} \u2022 ${newOrdre === 'chrono' ? '\ud83d\udd52 Ordre chronologique' : '\ud83d\udcc5 Ordre classique'}` });

    return interaction.update({ embeds: [embed], components: [row1, row2] });
}

    // =========================
    // BOUTON KISS BACK
    // =========================

    if (interaction.isButton() && interaction.customId.startsWith("kiss_back_")) {
        const parts = interaction.customId.split("_");
        const originalAuthorId = parts[2];
        const targetId = parts[3];
        const originalAuthorNom = parts.slice(4).join("_");
        const clickerId = interaction.user.id;

        if (clickerId === originalAuthorId) {
            return interaction.reply({ content: "Tu peux pas t'embrasser toi-m\u00eame... \ud83d\udc80", ephemeral: true });
        }
        if (clickerId !== targetId) {
            return interaction.reply({ content: "Pas sympa de voler les bisous des autres :/", ephemeral: true });
        }

        const retourNom = interaction.member?.displayName ?? interaction.user.username;
        const embed = buildKissEmbed(retourNom, originalAuthorNom);
        await interaction.message.edit({ components: [] }).catch(() => {});
        return interaction.reply({ embeds: [embed] });
    }

    // =========================
    // BOUTON HUG BACK
    // =========================

    if (interaction.isButton() && interaction.customId.startsWith("hug_back_")) {
        const parts = interaction.customId.split("_");
        const originalAuthorId = parts[2];
        const targetId = parts[3];
        const originalAuthorNom = parts.slice(4).join("_");
        const clickerId = interaction.user.id;

        if (clickerId === originalAuthorId) {
            return interaction.reply({ content: "Tu peux pas te c\u00e2liner toi-m\u00eame... \ud83d\udc80", ephemeral: true });
        }
        if (clickerId !== targetId) {
            return interaction.reply({ content: "Pas gentil de voler les c\u00e2lins des autres :/", ephemeral: true });
        }

        const retourNom = interaction.member?.displayName ?? interaction.user.username;
        const embed = buildHugEmbed(retourNom, originalAuthorNom);
        await interaction.message.edit({ components: [] }).catch(() => {});
        return interaction.reply({ embeds: [embed] });
    }

    // =========================
    // BOUTON DANCE JOIN (SOLO)
    // =========================

    if (interaction.isButton() && interaction.customId.startsWith("dance_join_")) {
        const parts = interaction.customId.split("_");
        const originalAuthorId = parts[2];
        const originalAuthorNom = parts.slice(3).join("_");

        if (interaction.user.id === originalAuthorId) {
            return interaction.reply({ content: "Tu danses d\u00e9j\u00e0 ! \ud83d\udd7a", ephemeral: true });
        }

        const rejointNom = interaction.member?.displayName ?? interaction.user.username;
        const embed = buildDanceEmbed(`\ud83d\udd7a **${rejointNom}** rejoint **${originalAuthorNom}** sur le dancefloor !`, false);
        return interaction.reply({ embeds: [embed] });
    }

    // =========================
    // BOUTON DANCE BACK
    // =========================

    if (interaction.isButton() && interaction.customId.startsWith("dance_back_")) {
        const parts = interaction.customId.split("_");
        const originalAuthorId = parts[2];
        const targetId = parts[3];
        const originalAuthorNom = parts.slice(4).join("_");
        const clickerId = interaction.user.id;

        if (clickerId === originalAuthorId) {
            return interaction.reply({ content: "Tu danses d\u00e9j\u00e0 ! \ud83d\udd7a", ephemeral: true });
        }
        if (clickerId !== targetId) {
            return interaction.reply({ content: "Non, tu n'es pas invit\u00e9.e sur le dancefloor cette fois !", ephemeral: true });
        }

        const retourNom = interaction.member?.displayName ?? interaction.user.username;
        const embed = buildDanceEmbed(`\ud83d\udd7a **${retourNom}** danse avec **${originalAuthorNom}** !`, false);
        return interaction.reply({ embeds: [embed] });
    }

    // =========================
    // BOUTON INSULT BACK
    // =========================

    if (interaction.isButton() && interaction.customId.startsWith("insult_back_")) {
        const parts = interaction.customId.split("_");
        const originalAuthorId = parts[2];
        const targetId = parts[3];
        const originalAuthorNom = parts.slice(4).join("_");
        const clickerId = interaction.user.id;

        if (clickerId === originalAuthorId) {
            return interaction.reply({ content: "Tu peux pas t'insulter toi-m\u00eame... \ud83d\udc80", ephemeral: true });
        }
        if (clickerId !== targetId) {
            return interaction.reply({ content: "Reste en dehors de la bagarre, crois-moi...", ephemeral: true });
        }

        const retourNom = interaction.member?.displayName ?? interaction.user.username;
        const embed = buildInsultEmbed(`\ud83d\udd95 **${retourNom}** insulte **${originalAuthorNom}** en retour !`);
        return interaction.reply({ embeds: [embed] });
    }

    // =========================
    // BOUTON LAUGH WITH
    // =========================

    if (interaction.isButton() && interaction.customId.startsWith("laugh_with_")) {
        const parts = interaction.customId.split("_");
        // format: laugh_with_{originalAuthorId}_{originalAuthorNom}
        const originalAuthorId = parts[2];
        const originalAuthorNom = parts.slice(3).join("_");

        if (interaction.user.id === originalAuthorId) {
            return interaction.reply({ content: "Tu vas rire avec toi-m\u00eame...? Attends, tu te sens bien ?", ephemeral: true });
        }

        const reurNom = interaction.member?.displayName ?? interaction.user.username;
        const embed = buildLaughEmbed(`\ud83d\ude06 **${reurNom}** rit avec **${originalAuthorNom}** !`);
        await disableButtons(interaction);
        return interaction.reply({ embeds: [embed] });
    }

    // =========================
    // BOUTON RIZZ BACK
    // =========================

    if (interaction.isButton() && interaction.customId.startsWith("rizz_back_")) {
        const parts = interaction.customId.split("_");
        // format: rizz_back_{originalAuthorId}_{targetId}_{originalAuthorNom}
        const originalAuthorId = parts[2];
        const targetId = parts[3];
        const originalAuthorNom = parts.slice(4).join("_");
        const clickerId = interaction.user.id;

        if (clickerId === originalAuthorId) {
            return interaction.reply({ content: "Tu vas te rizz en retour ? Hein ?", ephemeral: true });
        }
        if (clickerId !== targetId) {
            return interaction.reply({ content: "Ce rizz ne t'\u00e9tait pas adress\u00e9 \ud83d\ude14", ephemeral: true });
        }

        const retourNom = interaction.member?.displayName ?? interaction.user.username;
        const embed = buildRizzEmbed(`\ud83d\uddff **${retourNom}** rizz **${originalAuthorNom}** en retour !`);
        await interaction.message.edit({ components: [] }).catch(() => {});
        return interaction.reply({ embeds: [embed] });
    }


    // =========================
    // BOUTON BANG BACK
    // =========================

    if (interaction.isButton() && interaction.customId.startsWith("bang_back_")) {
        const parts = interaction.customId.split("_");
        // format: bang_back_{originalAuthorId}_{targetId}_{originalAuthorNom}
        const originalAuthorId = parts[2];
        const targetId = parts[3];
        const originalAuthorNom = parts.slice(4).join("_");
        const clickerId = interaction.user.id;

        if (clickerId === originalAuthorId) {
            return interaction.reply({ content: "Te tirer dessus ? Non. Tu n'es pas Kurt Cobain.", ephemeral: true });
        }
        if (clickerId !== targetId) {
            return interaction.reply({ content: "Reste \u00e0 couvert ! Ne t'embarque pas dans la fusillade !", ephemeral: true });
        }

        const retourNom = interaction.member?.displayName ?? interaction.user.username;
        const embed = buildBangEmbed(`\ud83d\udca5 **${retourNom}** riposte sur **${originalAuthorNom}** !`);
        await interaction.message.edit({ components: [] }).catch(() => {});
        return interaction.reply({ embeds: [embed] });
    }

    // =========================
    // BOUTON PUNCH BACK
    // =========================

    if (interaction.isButton() && interaction.customId.startsWith("punch_back_")) {
        const parts = interaction.customId.split("_");
        // format: punch_back_{originalAuthorId}_{targetId}_{originalAuthorNom}
        const originalAuthorId = parts[2];
        const targetId = parts[3];
        const originalAuthorNom = parts.slice(4).join("_");
        const clickerId = interaction.user.id;

        if (clickerId === originalAuthorId) {
            return interaction.reply({ content: "Mais ne te frappe pas, voyons !", ephemeral: true });
        }
        if (clickerId !== targetId) {
            return interaction.reply({ content: "Non ! Reste en dehors de la bagarre !", ephemeral: true });
        }

        const retourNom = interaction.member?.displayName ?? interaction.user.username;
        const embed = buildPunchEmbed(`\ud83e\udd1c **${retourNom}** frappe **${originalAuthorNom}** en retour !`);
        await interaction.message.edit({ components: [] }).catch(() => {});
        return interaction.reply({ embeds: [embed] });
    }

    // =========================
    // BOUTON DIE WITH
    // =========================

    if (interaction.isButton() && interaction.customId.startsWith("die_with_")) {
        const parts = interaction.customId.split("_");
        // format: die_with_{originalAuthorId}_{originalAuthorNom}
        const originalAuthorId = parts[2];
        const originalAuthorNom = parts.slice(3).join("_");
        const clickerId = interaction.user.id;

        if (clickerId === originalAuthorId) {
            return interaction.reply({ content: "Tu est d\u00e9j\u00e0 mort(e)...", ephemeral: true });
        }

        const mourrantNom = interaction.member?.displayName ?? interaction.user.username;
        const embed = buildDieEmbed(`\u2620\ufe0f **${mourrantNom}** meurt avec **${originalAuthorNom}**...`);
        await disableButtons(interaction);
        return interaction.reply({ embeds: [embed] });
    }

    // =========================
    // BOUTONS FLIP
    // =========================

    if (interaction.isButton() && interaction.customId.startsWith("flip_start_")) {
        const startAuthorId = interaction.user.id;
        const startType = interaction.customId.split("_")[3]; // simple ou pari
        const startNom = interaction.member?.displayName ?? interaction.user.username;
        flipEnCours = true;
        await interaction.deferUpdate().catch(() => {});
        let relancerMsg;
        if (startType === "simple") {
            relancerMsg = `**${startNom}**, cette fois, c'est aussi pour un lancer simple, ou alors pour parier avec quelqu'un ?`;
        } else if (startType === "pari") {
            relancerMsg = `**${startNom}**, cette fois, c'est pour un lancer simple, ou encore pour parier avec quelqu'un ?`;
        } else {
            relancerMsg = `**${startNom}**, c'est pour un lancer simple, ou alors pour parier avec quelqu'un ?`;
        }
        await sendFlipChoix(interaction.channel, null, startAuthorId, relancerMsg);
        return;
    }

    if (interaction.isButton() && interaction.customId.startsWith("flip_simple_")) {
        const simpleAuthorId = interaction.customId.split("_")[2];
        if (interaction.user.id !== simpleAuthorId) {
            return interaction.reply({ content: "C'est pas \u00e0 toi que je m'adresse, on jouera ensemble apr\u00e8s son tour si tu veux.", ephemeral: true });
        }
        // Modifier l'embed pour le choix de camp
        const pileBtn = new ButtonBuilder()
            .setCustomId(`flip_solo_pile_${simpleAuthorId}`)
            .setLabel("Pile")
            .setStyle(ButtonStyle.Secondary);
        const faceBtn = new ButtonBuilder()
            .setCustomId(`flip_solo_face_${simpleAuthorId}`)
            .setLabel("Face")
            .setStyle(ButtonStyle.Secondary);
        const cancelBtn = new ButtonBuilder()
            .setCustomId(`flip_cancel_${simpleAuthorId}`)
            .setLabel("\u274c Annuler")
            .setStyle(ButtonStyle.Secondary);
        const campRow = new ActionRowBuilder().addComponents(pileBtn, faceBtn, cancelBtn);
        const clickerNom = interaction.member?.displayName ?? interaction.user.username;
        const campEmbed = new EmbedBuilder()
            .setColor(0xffd700)
            .setTitle("\ud83e\ude99 Pile ou face")
            .setDescription(`**${clickerNom}**, choisis ton camp !`);
        await interaction.update({ embeds: [campEmbed], components: [campRow] });
        return;
    }

    if (interaction.isButton() && interaction.customId.startsWith("flip_cancel_")) {
        const cancelAuthorId = interaction.customId.split("_")[2];
        if (interaction.user.id !== cancelAuthorId) {
            return interaction.reply({ content: "H\u00e9 oh, pique pas ma pi\u00e8ce !", ephemeral: true });
        }
        flipEnCours = false;
        // Supprimer le pari du Map pour éviter le message de timeout
        flipParis.delete(interaction.message.id);
        await interaction.message.delete().catch(() => {});
        // Chercher et supprimer le dernier message !flip du lanceur
        const messages = await interaction.channel.messages.fetch({ limit: 20 }).catch(() => null);
        if (messages) {
            const flipMsg = messages.find(m => m.author.id === cancelAuthorId && m.content.toLowerCase().startsWith('!flip'));
            if (flipMsg) await flipMsg.delete().catch(() => {});
        }
        return;
    }

    if (interaction.isButton() && (interaction.customId.startsWith("flip_solo_pile_") || interaction.customId.startsWith("flip_solo_face_"))) {
        const parts = interaction.customId.split("_");
        const choix = parts[2]; // pile ou face
        const soloAuthorId = parts[3];
        if (interaction.user.id !== soloAuthorId) {
            return interaction.reply({ content: "H\u00e9 oh, pique pas ma pi\u00e8ce !", ephemeral: true });
        }
        const campTexte = choix === 'pile' ? 'Pile' : 'Face';
        const gif = flipGifs[Math.floor(Math.random() * flipGifs.length)];
        const lancerEmbed = new EmbedBuilder()
            .setColor(0xffd700)
            .setTitle("\ud83e\ude99 Pile ou face")
            .setDescription(`**${campTexte}**, c'est \u00e7a ? Ok !\nJe lance la pi\u00e8ce ! \ud83e\ude99`)
            .setImage(gif);
        await interaction.update({ embeds: [lancerEmbed], components: [] });
        await new Promise(r => setTimeout(r, 1000));
        await doFlipSequence(interaction.channel, null, false, choix, null, soloAuthorId);
        return;
    }

    if (interaction.isButton() && interaction.customId.startsWith("flip_pari_")) {
        const pariAuthorId = interaction.customId.split("_")[2];
        if (interaction.user.id !== pariAuthorId) {
            return interaction.reply({ content: "C'est pas \u00e0 toi que je m'adresse, on jouera ensemble apr\u00e8s son tour si tu veux.", ephemeral: true });
        }
        const pariEmbed = new EmbedBuilder()
            .setColor(0xffd700)
            .setTitle("\ud83e\ude99 Pile ou face")
            .setDescription("En l'attente des deux participant(e)s !")
            .addFields(
                { name: "\ud83d\udd34 Pile", value: "...", inline: true },
                { name: "\ud83d\udd34 Face", value: "...", inline: true }
            );

        const pileBtn = new ButtonBuilder()
            .setCustomId("flip_choose_pile")
            .setLabel("Pile")
            .setStyle(ButtonStyle.Secondary);
        const faceBtn = new ButtonBuilder()
            .setCustomId("flip_choose_face")
            .setLabel("Face")
            .setStyle(ButtonStyle.Secondary);
        const cancelPariBtn = new ButtonBuilder()
            .setCustomId(`flip_cancel_${pariAuthorId}`)
            .setLabel("\u274c Annuler")
            .setStyle(ButtonStyle.Secondary);
        const chooseRow = new ActionRowBuilder().addComponents(pileBtn, faceBtn, cancelPariBtn);

        await interaction.update({ embeds: [pariEmbed], components: [chooseRow] });
        const pariMsg = interaction.message;

        // Stocker l'etat du pari
        flipParis.set(pariMsg.id, { pile: null, face: null, messageId: pariMsg.id, channel: interaction.channel });

        // Timeout 30s
        setTimeout(async () => {
            const pari = flipParis.get(pariMsg.id);
            if (!pari) return;
            flipParis.delete(pariMsg.id);
            flipEnCours = false;
            const vide = (!pari.pile && !pari.face) ? "les deux camps sont vides !" : "l'un des camps est vide !";
            const expiredEmbed = new EmbedBuilder()
                .setColor(0xffd700)
                .setTitle("\ud83e\ude99 Pile ou face")
                .setDescription(`\u274c Le pari est annul\u00e9, ${vide}`);
            await pariMsg.edit({ embeds: [expiredEmbed], components: [] }).catch(() => {});
        }, 30000);
        return;
    }

    if (interaction.isButton() && (interaction.customId === "flip_choose_pile" || interaction.customId === "flip_choose_face")) {
        const choix = interaction.customId === "flip_choose_pile" ? "pile" : "face";
        const autreChoix = choix === "pile" ? "face" : "pile";
        const msgId = interaction.message.id;
        const pari = flipParis.get(msgId);

        if (!pari) return interaction.reply({ content: "Ce pari n'existe plus !", ephemeral: true });
        if (pari[choix]) return interaction.reply({ content: "Ce camp est d\u00e9j\u00e0 pris !", ephemeral: true });
        if (pari[autreChoix] === interaction.member?.displayName ?? interaction.user.username) {
            return interaction.reply({ content: "H\u00e9 oh, pique pas ma pi\u00e8ce !", ephemeral: true });
        }

        const nom = interaction.member?.displayName ?? interaction.user.username;
        pari[choix] = nom;
        flipParis.set(msgId, pari);

        const pileVal = pari.pile ? `**${pari.pile}**` : "...";
        const faceVal = pari.face ? `**${pari.face}**` : "...";
        const pileIcon = pari.pile ? "\ud83d\udfe2" : "\ud83d\udd34";
        const faceIcon = pari.face ? "\ud83d\udfe2" : "\ud83d\udd34";

        if (pari.pile && pari.face) {
            // Les deux sont la, countdown
            const countEmbed = new EmbedBuilder()
                .setColor(0xffd700)
                .setTitle("\ud83e\ude99 Pile ou face")
                .setDescription("Lancer dans 3")
                .addFields(
                    { name: `${pileIcon} Pile`, value: pileVal, inline: true },
                    { name: `${faceIcon} Face`, value: faceVal, inline: true }
                );
            await interaction.update({ embeds: [countEmbed], components: [] });
            flipParis.delete(msgId);

            await new Promise(r => setTimeout(r, 1000));
            await interaction.message.edit({ embeds: [countEmbed.setDescription("Lancer dans 2")] }).catch(() => {});
            await new Promise(r => setTimeout(r, 1000));
            await interaction.message.edit({ embeds: [countEmbed.setDescription("Lancer dans 1")] }).catch(() => {});
            await new Promise(r => setTimeout(r, 1000));
            const flipGif = flipGifs[Math.floor(Math.random() * flipGifs.length)];
            const finalEmbed = new EmbedBuilder()
                .setColor(0xffd700)
                .setTitle("\ud83e\ude99 C'est parti !")
                .setImage(flipGif)
                .addFields(
                    { name: `${pileIcon} Pile`, value: pileVal, inline: true },
                    { name: `${faceIcon} Face`, value: faceVal, inline: true }
                );
            await interaction.message.edit({ embeds: [finalEmbed], components: [] }).catch(() => {});
            await doFlipSequence(interaction.channel, null, true, pari.pile, pari.face, null);
        } else {
            const updEmbed = new EmbedBuilder()
                .setColor(0xffd700)
                .setTitle("\ud83e\ude99 Pile ou face")
                .setDescription("En l'attente des deux participant(e)s !")
                .addFields(
                    { name: `${pileIcon} Pile`, value: pileVal, inline: true },
                    { name: `${faceIcon} Face`, value: faceVal, inline: true }
                );
            await interaction.update({ embeds: [updEmbed], components: [interaction.message.components[0]] });
        }
        return;
    }

    // =========================
    // BOUTON CRY
    // =========================

    if (interaction.isButton() && interaction.customId.startsWith('cry_with_')) {
        const parts = interaction.customId.split('_');
        const originalAuthorId = parts[2];
        const originalAuthorNom = parts[3];
        const targetId = parts[4];
        const targetNom = parts[5];

        if (interaction.user.id === originalAuthorId) {
            return interaction.reply({ content: "Tu as d\u00e9j\u00e0 pleur\u00e9...", ephemeral: true });
        }
        if (targetId !== 'none' && interaction.user.id === targetId) {
            return interaction.reply({ content: `C'est toi qui a fait pleurer **${originalAuthorNom}** !`, ephemeral: true });
        }

        const cryGifs = ["https://cdn.discordapp.com/attachments/1128032964924670053/1505906480916725791/zidane.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906486872768522/wwe.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906487413964941/cry2.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906487656972359/hamster.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906487959093359/interstellar.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906869598814310/cry.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906488625856622/powder.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906488932176034/vi.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906489271779449/gangle.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906489657790466/pomni.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505906489947324589/fred.gif"];
        const gif = cryGifs[Math.floor(Math.random() * cryGifs.length)];
        const clickerNom = interaction.member?.displayName ?? interaction.user.username;

        const embed = new EmbedBuilder()
            .setColor(0x597eff)
            .setDescription(`\ud83d\ude2d **${clickerNom}** Pleure avec **${originalAuthorNom}**...`)
            .setImage(gif);

        await disableButtons(interaction);
        return interaction.reply({ embeds: [embed] });
    }

    // =========================
    // BOUTON PALAREF
    // =========================

    if (interaction.isButton() && interaction.customId.startsWith('palaref_with_')) {
        const parts = interaction.customId.split('_');
        const originalAuthorId = parts[2];
        const originalAuthorNom = parts[3];
        const targetId = parts[4];
        const targetNom = parts[5];

        if (interaction.user.id === originalAuthorId) {
            return interaction.reply({ content: "On a compris que t'avais pas la ref :(", ephemeral: true });
        }
        if (interaction.user.id === targetId) {
            return interaction.reply({ content: "Bah c'est ta ref", ephemeral: true });
        }

        const palarefGifs = ["https://cdn.discordapp.com/attachments/1128032964924670053/1505882858311647262/tyson.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882865492164608/viktor.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882866192617624/zidane.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882866549260338/kaamelott.gif", "https://klipy.com/gifs/tuc-gian-3", "https://cdn.discordapp.com/attachments/1480756332373213275/1548362733408362578/michel-palareff-v0-r9ywzo3614u31.png?ex=6aa6c8aa&is=6aa5772a&hm=20f2c75585bd442371e0095f00b4f1ffbf94e00b2e5ed5b1e56c5b3fd2c0b313&", "https://klipy.com/gifs/fnaf-215", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882866867765278/palaref.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882866867765278/ants.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882867262296094/ants.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882867576606720/simpsons.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882867903758428/speed.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882868205752430/kinger.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882868520456332/pomni.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882872769151027/stare.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882873109020853/erivo.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882873427923024/hidethepain.gif", "https://cdn.discordapp.com/attachments/1128032964924670053/1505882873746686022/chieng.gif"];
        const gif = palarefGifs[Math.floor(Math.random() * palarefGifs.length)];
        const clickerNom = interaction.member?.displayName ?? interaction.user.username;

        const embed = new EmbedBuilder()
            .setColor(0x503649)
            .setDescription(`\ud83d\ude10 **${clickerNom}** n'a pas la ref non plus...`)
            .setImage(gif);

        return interaction.reply({ embeds: [embed] });
    }

    // =========================
    // BOUTON JAILAREF
    // =========================

    if (interaction.isButton() && interaction.customId.startsWith('jailaref_with_')) {
        const parts = interaction.customId.split('_');
        const originalAuthorId = parts[2];
        const targetId = parts[4];

        if (interaction.user.id === originalAuthorId) {
            return interaction.reply({ content: "On a compris que t'avais la ref :)", ephemeral: true });
        }
        if (interaction.user.id === targetId) {
            return interaction.reply({ content: "Bah c'est ta ref", ephemeral: true });
        }

        const jailarefGifs = ["https://static2.klipy.com/ii/4493325008d34b7bf8cd6813cd5c1619/f1/7d/7y2QyYzWIYksGnnK.gif", "https://cdn.discordapp.com/attachments/720079691041472572/1548362421079646481/caf5c232438734937f6e1cf4c7bc5411.png", "https://media1.tenor.com/m/13XpzbwtVnYAAAAC/dway-the-roc.gif", "https://static2.klipy.com/ii/4493325008d34b7bf8cd6813cd5c1619/14/44/oqcpwYRAEpXGYqfyw.gif", "https://static2.klipy.com/ii/50d7c955398dfd7e3c8ba5281154280f/79/6d/eoUS3shzyQLpKm.gif", "https://static2.klipy.com/ii/d7aec6f6f171607374b2065c836f92f4/3d/31/08K8MgEk.gif", "https://static2.klipy.com/ii/4493325008d34b7bf8cd6813cd5c1619/64/b0/SdnOajVDadHUy.gif", "https://cdn.discordapp.com/attachments/720079691041472572/1548366731666268250/image2.gif", "https://static2.klipy.com/ii/9294a2e836d178ddc22430dd7765727e/44/86/6QBidjUuV1oBpAnHIw7o.gif"];
        const gif = jailarefGifs[Math.floor(Math.random() * jailarefGifs.length)];
        const clickerNom = interaction.member?.displayName ?? interaction.user.username;

        const embed = new EmbedBuilder()
            .setColor(0x503649)
            .setDescription(`😎 **${clickerNom}** a la ref aussi !`)
            .setImage(gif);

        return interaction.reply({ embeds: [embed] });
    }

    // =========================
    // BOUTON SYLVAIN
    // =========================

    if (interaction.isButton() && interaction.customId === 'sylvain_again') {
        const sylvainGifs = [
            "https://media1.tenor.com/m/camhluUNGO0AAAAd/sylvain-lyve-sylvain-levy.gif",
            "https://media1.tenor.com/m/mhNSNZ7Ye4wAAAAC/sylvain-lyve-vilbrequin.gif",
            "https://media1.tenor.com/m/n7NmIiefhZ4AAAAC/sylvain-lyve-vilbrequin.gif",
            "https://media1.tenor.com/m/p66oAFFJ2pcAAAAC/vilebrequin-vilebrequin-sylvain-levy.gif",
            "https://media1.tenor.com/m/XFUotrruCacAAAAC/vilebrequin-sylvain.gif",
            "https://media1.tenor.com/m/pCExmpKfecgAAAAC/vilebrequin-sylvain.gif",
            "https://media1.tenor.com/m/MkoOhxjfLeYAAAAC/vilebrequin-sylvain.gif",
            "https://media1.tenor.com/m/q5GDY7A8aUMAAAAC/vilebrequin-vilebrequin-sylvain-levy.gif",
            "https://media1.tenor.com/m/8K7M2XtHOFsAAAAC/vilebrequin-sylvain.gif",
            "https://media1.tenor.com/m/E3abpzYLviIAAAAC/vilebrequin-vilebrequin-sylvain-levy.gif",
            "https://media1.tenor.com/m/CH0fiUJj5psAAAAC/sylvain-lyve-sylvain-levy.gif",
            "https://media1.tenor.com/m/VD8UmHWnJPgAAAAC/vilebrequin-vilebrequin-sylvain.gif",
            "https://media1.tenor.com/m/UUO8TiMNDXAAAAAC/keep-pushing-race.gif",
            "https://media1.tenor.com/m/q9PEP4AcLKkAAAAC/vilebrequin-vilebrequin-sylvain-levy.gif",
            "https://media1.tenor.com/m/aNmsYZdcuG8AAAAC/vilebrequin-vilebrequin-sylvain-levy.gif",
            "https://media1.tenor.com/m/d9Dnn5iOeCoAAAAd/sylvain-sylvain-rire.gif"
        ];
        const gif = sylvainGifs[Math.floor(Math.random() * sylvainGifs.length)];

        const btn = new ButtonBuilder()
            .setCustomId('sylvain_again')
            .setLabel('🐒 Singe fort ensemble')
            .setStyle(ButtonStyle.Secondary);
        const row = new ActionRowBuilder().addComponents(btn);
        return interaction.reply({ files: [gif], components: [row] });
    }

    // =========================
    // BOUTONS ROULETTE
    // =========================

    if (interaction.isButton() && (interaction.customId === 'sugg_vote_pour' || interaction.customId === 'sugg_vote_contre')) {
        const msgId = interaction.message.id;
        const data = suggestionsData.get(msgId);
        if (!data) {
            return interaction.reply({ content: "Cette suggestion est trop ancienne ou introuvable.", ephemeral: true });
        }

        const userId = interaction.user.id;
        const votePour = interaction.customId === 'sugg_vote_pour';
        let feedback = '';

        if (votePour) {
            if (data.pour.includes(userId)) {
                data.pour = data.pour.filter(id => id !== userId);
                feedback = '❌ Vote « Pour » retiré !';
            } else {
                data.pour.push(userId);
                data.contre = data.contre.filter(id => id !== userId);
                feedback = '✅ Tu as voté « Pour » !';
            }
        } else {
            if (data.contre.includes(userId)) {
                data.contre = data.contre.filter(id => id !== userId);
                feedback = '❌ Vote « Contre » retiré !';
            } else {
                data.contre.push(userId);
                data.pour = data.pour.filter(id => id !== userId);
                feedback = '❌ Tu as voté « Contre » !';
            }
        }

        suggestionsData.set(msgId, data);
        demanderSauvegarde();

        const authorMember = interaction.guild.members.cache.get(data.authorId);
        const embed = buildSuggestionEmbed(data, authorMember);
        const row = buildSuggestionRow(data);

        await interaction.update({ embeds: [embed], components: [row] });
        return interaction.followUp({ content: feedback, ephemeral: true });
    }

    if (interaction.isButton() && interaction.customId.startsWith('rlt_achs_')) {
        const parts = interaction.customId.split('_');
        const cibleId = parts[2];
        const page = parseInt(parts[3], 10);
        const authorId = parts[4];
        if (interaction.user.id !== authorId) {
            return interaction.reply({ content: "Ce n'est pas ta commande, fais `!rltsucces` !", ephemeral: true });
        }
        const cible = interaction.guild.members.cache.get(cibleId);
        if (!cible) return interaction.reply({ content: "Membre introuvable.", ephemeral: true });

        const { embed, row } = buildRouletteAchievementsEmbed(cible, page, authorId);
        return interaction.update({ embeds: [embed], components: [row] });
    }

    if (interaction.isButton() && interaction.customId.startsWith('rlt_stats_back_')) {
        const parts = interaction.customId.split('_');
        const cibleId = parts[3];
        const authorId = parts[4];
        if (interaction.user.id !== authorId) {
            return interaction.reply({ content: "Ce n'est pas ta commande, fais `!rltstats` !", ephemeral: true });
        }
        const cible = interaction.guild.members.cache.get(cibleId);
        if (!cible) return interaction.reply({ content: "Membre introuvable.", ephemeral: true });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`rlt_achs_${cible.id}_0_${authorId}`).setLabel('🎖️ Succès').setStyle(ButtonStyle.Secondary)
        );
        return interaction.update({ embeds: [buildRouletteStatsEmbed(cible)], components: [row] });
    }

    if (interaction.isButton() && interaction.customId.startsWith('roulette_id_')) {
        const parts = interaction.customId.split('_');
        const type = parts[2];
        const authorId = parts[3];
        if (interaction.user.id !== authorId) {
            return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true });
        }
        return interaction.update({ embeds: [buildRouletteTypeEmbed(type)] });
    }

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

    if (interaction.isButton() && interaction.customId.startsWith('roulette_probas_pres_')) {
        const authorId = interaction.customId.split('_')[3];
        if (interaction.user.id !== authorId) {
            return interaction.reply({ content: "C'est pas ton tirage, tape `!roulette` toi-même 😌", ephemeral: true });
        }
        const embed = buildRoulettePaytableEmbed();
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`roulette_back_pres_${authorId}`).setLabel('⬅️ Retour').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`roulette_tenter_${authorId}`).setLabel('🍀 Tenter sa chance').setStyle(ButtonStyle.Primary)
        );
        return interaction.update({ embeds: [embed], components: [row] });
    }

    if (interaction.isButton() && interaction.customId.startsWith('roulette_back_pres_')) {
        const authorId = interaction.customId.split('_')[3];
        if (interaction.user.id !== authorId) {
            return interaction.reply({ content: "C'est pas ton tirage, tape `!roulette` toi-même 😌", ephemeral: true });
        }
        const embed = buildRoulettePresentationEmbed(authorId);
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`roulette_probas_pres_${authorId}`).setLabel('🎲 Probabilités').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`roulette_tenter_${authorId}`).setLabel('🍀 Tenter sa chance').setStyle(ButtonStyle.Primary)
        );
        return interaction.update({ embeds: [embed], components: [row] });
    }

    if (interaction.isButton() && interaction.customId.startsWith('roulette_tenter_')) {
        const authorId = interaction.customId.split('_')[2];
        if (interaction.user.id !== authorId) {
            return interaction.reply({ content: "C'est pas ton tirage, tape `!roulette` toi-même 😌", ephemeral: true });
        }
        const resultat = await tirerEtConstruireResultatRoulette(authorId, interaction.guild, interaction.channel);
    if (resultat.cooldown) {
        const notifRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('roulette_notif').setLabel('🔔 Me prévenir').setStyle(ButtonStyle.Secondary)
        );
        await interaction.reply({ content: `⏳ Attends la fin du cooldown avant de relancer un tirage ! Il te reste **${resultat.reste} min**.`, components: [notifRow], ephemeral: true });
        return;
    }
        await interaction.update({ embeds: resultat.embeds, components: resultat.components });
        await envoyerPingRedirection(interaction.channel, resultat);
        memoriserResultatRoulette(interaction.message.id, resultat.embeds[0]);
        if (resultat.attenteChoix) rouletteChoixEnAttente.add(interaction.message.id);
        if (resultat.vote) await demarrerVoteRoulette(interaction.message, resultat.vote);
        if (resultat.differe) {
            setTimeout(async () => {
                const embedFinal = await resultat.differe();
                memoriserResultatRoulette(interaction.message.id, embedFinal);
                interaction.message.edit({ embeds: [embedFinal] }).catch(() => {});
            }, 10000);
        }
        return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('roulette_fallback_')) {
        const authorId = interaction.customId.split('_')[2];
        if (interaction.user.id !== authorId) {
            return interaction.reply({ content: "C'est pas ton tirage, tape `!roulette` toi-même 😌", ephemeral: true });
        }
        const outcomeId = interaction.values[0];
        const auteurNom = interaction.member?.displayName ?? interaction.user.username;
        const texte = await appliquerEtDecrireResultat(outcomeId, interaction, auteurNom, 0);

        const embed = buildRouletteResultEmbed(outcomeId, texte);
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`roulette_probas_res_${authorId}_${outcomeId}_0`).setLabel('🎲 Probabilités').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`roulette_notif_${authorId}`).setLabel('🔔 Me prévenir').setStyle(ButtonStyle.Secondary)
        );
        rouletteChoixEnAttente.delete(interaction.message.id);
        memoriserResultatRoulette(interaction.message.id, embed);
        return interaction.update({ embeds: [embed], components: [row] });
    }

    if (interaction.isButton() && interaction.customId.startsWith('roulette_notif')) {
        const userId = interaction.user.id;
        const fin = rouletteCooldowns.get(userId) ?? 0;
        if (Date.now() >= fin) {
            return interaction.reply({ content: "Ton cooldown est déjà terminé, tu peux relancer dès maintenant ! 🎰", ephemeral: true });
        }
        if (rouletteNotifs.has(userId)) {
            return interaction.reply({ content: "T'inquiète pas, c'était déjà prévu, tu seras ping quand ton cooldown sera écoulé !", ephemeral: true });
        }
        rouletteNotifs.set(userId, interaction.channelId);
        armerNotifRoulette(userId, interaction.channelId);
        return interaction.reply({ content: `🔔 C'est noté ! Je te ping ici <t:${Math.ceil(fin / 1000)}:R>.`, ephemeral: true });
    }

    if (interaction.isButton() && interaction.customId.startsWith('roulette_probas_res_')) {
        const parts = interaction.customId.split('_');
        const authorId = parts[3];
        const outcomeId = parts[4];
        const failIndex = parts[5];
        if (interaction.user.id !== authorId) {
            return interaction.reply({ content: "C'est pas ton tirage, tape `!roulette` toi-même 😌", ephemeral: true });
        }
        const embed = buildRoulettePaytableEmbed();
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`roulette_back_res_${authorId}_${outcomeId}_${failIndex}`).setLabel('⬅️ Retour').setStyle(ButtonStyle.Secondary)
        );
        const components = rouletteChoixEnAttente.has(interaction.message.id)
            ? [buildMenuFallbackRoulette(authorId), row]
            : [row];
        return interaction.update({ embeds: [embed], components });
    }

    if (interaction.isButton() && interaction.customId.startsWith('roulette_back_res_')) {
        const parts = interaction.customId.split('_');
        const authorId = parts[3];
        const outcomeId = parts[4];
        const failIndex = parts[5];
        if (interaction.user.id !== authorId) {
            return interaction.reply({ content: "C'est pas ton tirage, tape `!roulette` toi-même 😌", ephemeral: true });
        }
        // Retour au résultat déjà tiré : on ré-affiche le même texte sans retirer ni réappliquer la sanction/le gain.
        let embed = rouletteResultats.get(interaction.message.id);
        if (!embed) {
            // Filet de sécurité (bot redémarré ou résultat trop ancien) : récap simplifié
            const auteurNom = interaction.guild?.members.cache.get(authorId)?.displayName ?? interaction.user.username;
            const nom = ROULETTE_NOMS[outcomeId] ?? outcomeId;
            const type = outcomeId.startsWith('malus-') ? 'le malus'
                       : outcomeId.startsWith('bonus-') ? 'le bonus'
                       : 'le résultat';
            const texte = outcomeId === 'aucun-resultat'
                ? ROULETTE_FAILS[parseInt(failIndex, 10)]
                : `**${auteurNom}** est tombé.e sur ${type} **${nom}**.\n*Il a déjà été appliqué, revenir ici ne le déclenche pas une deuxième fois.*`;
            embed = buildRouletteResultEmbed(outcomeId, texte);
        }
        const row = buildRowResultatRoulette(authorId, outcomeId, failIndex);
        const components = rouletteChoixEnAttente.has(interaction.message.id)
            ? [buildMenuFallbackRoulette(authorId), row]
            : [row];
        return interaction.update({ embeds: [embed], components });
    }

    // =========================
    // BOUTON EXPLODE WITH
    // =========================

    if (interaction.isButton() && interaction.customId.startsWith('explode_with_')) {
        const parts = interaction.customId.split('_');
        const originalAuthorId = parts[2];
        const originalAuthorNom = parts.slice(3).join('_');

        if (interaction.user.id === originalAuthorId) {
            return interaction.reply({ content: "Tu as d\u00e9j\u00e0 explos\u00e9 !", ephemeral: true });
        }

        const explodeGifs = [
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505564402697375794/cat-cats.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505564403230183599/cat-explosion_1.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505564403653804153/floop-flop.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505564404031426661/cat-explodes.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505564404400521267/cat-funny.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505564404882870292/spideyvivi.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505564405281194064/cat-explode-cat-meme.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505564405847298150/explosion-missile.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505564406224781373/exploding-cat-cat-blowing-up.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505564406799532052/cat-gato.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505564412172570664/boomshakalaka.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505564412763836466/elgatitolover-cat.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505564413376335962/cat-explosion-ellie-cat-explosion.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505564413795635311/exploding-car-explode.gif",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1505564414147825774/cat-explosion.gif"
        ];
        const gif = explodeGifs[Math.floor(Math.random() * explodeGifs.length)];
        const clickerNom = interaction.member?.displayName ?? interaction.user.username;

        const embed = new EmbedBuilder()
            .setColor(0xec0f6e)
            .setDescription(`\ud83d\udca5 **${clickerNom}** explose avec **${originalAuthorNom}** !`)
            .setImage(gif);

        await disableButtons(interaction);
        return interaction.reply({ embeds: [embed] });
    }

    // =========================
    // BOUTON BAIT VENGEANCE
    // =========================

    if (interaction.isButton() && interaction.customId.startsWith('bait_venge_')) {
        const parts = interaction.customId.split('_');
        const targetId = parts[2];
        const originalAuthorId = parts[3];
        const originalAuthorNom = parts.slice(4).join('_');
        const clickerId = interaction.user.id;

        if (clickerId === originalAuthorId) {
            return interaction.reply({ content: "Tu peux pas te venger de ton propre ragebait.", ephemeral: true });
        }
        if (clickerId !== targetId) {
            return interaction.reply({ content: "Ce ragebait ne t'était pas adressé...", ephemeral: true });
        }

        const vengeNom = interaction.member?.displayName ?? interaction.user.username;
        const embed = buildPunchEmbed(`\ud83d\udca2 **${vengeNom}** se venge de **${originalAuthorNom}** !`);
        await interaction.message.edit({ components: [] }).catch(() => {});
        await disableButtons(interaction);
        return interaction.reply({ embeds: [embed] });
    }

    // =========================
    // MENU SELECT BLAGUE
    // =========================

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('blague_menu_')) {
        const authorId = interaction.customId.split('_')[2];
        if (interaction.user.id !== authorId) {
            return interaction.reply({ content: "Ce menu ne t'est pas destin\u00e9 !", ephemeral: true });
        }

        const value = interaction.values[0];
        await sendBlague(interaction, value, authorId);
        return;
    }

    // =========================
    // BOUTON BLAGUE
    // =========================

    if (interaction.isButton() && interaction.customId.startsWith('blague_autre_')) {
        const parts = interaction.customId.split('_');
        const authorId = parts[2];
        const cat = parts[3];
        if (interaction.user.id !== authorId) {
            return interaction.reply({ content: "Ce bouton ne t'est pas destin\u00e9 !", ephemeral: true });
        }
        await sendBlague(interaction, cat, authorId);
        return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('blague_menu_back_')) {
        const authorId = interaction.customId.split('_')[3];
        if (interaction.user.id !== authorId) {
            return interaction.reply({ content: "Ce bouton ne t'est pas destin\u00e9 !", ephemeral: true });
        }
        const embed = new EmbedBuilder()
            .setColor(0xe91e63)
            .setTitle('\ud83e\udd23 Blagues')
            .setDescription('Choisis une cat\u00e9gorie !');
        const menu = new StringSelectMenuBuilder()
            .setCustomId(`blague_menu_${authorId}`)
            .setPlaceholder('Choisis une cat\u00e9gorie')
            .addOptions(
                { label: '\ud83d\ude0a Humour soft', value: 'soft' },
                { label: '\ud83d\ude04 Humour classique', value: 'classique' },
                { label: '\ud83d\udda4 Humour noir', value: 'noir' }
            );
        const row = new ActionRowBuilder().addComponents(menu);
        return interaction.update({ embeds: [embed], components: [row] });
    }

    // =========================
    // MENU SELECT QUESTION
    // =========================

    if (interaction.isStringSelectMenu() && interaction.customId === 'question_menu') {
        const questionsDebats = [
            "Si tu pouvais supprimer une invention de l'histoire, laquelle ce serait ?",
            "T'as un super-pouvoir inutile, lequel ?",
            "T'es plut\u00f4t \"mourir en h\u00e9ros\" ou \"survivre en l\u00e2che\" ?",
            "Pizza ananas : crime contre l'humanit\u00e9 ou g\u00e9nie incompris ?",
            "T'\u00e9changerais ta vie contre celle de quelqu'un d'autre ? Qui ?",
            "Les chats ou les chiens ? Justifie.",
            "T'es plut\u00f4t matin ou soir ? Et t'assumes ?",
            "Le pass\u00e9 ou le futur : tu pourrais visiter lequel ?",
            "T'aurais pr\u00e9f\u00e9r\u00e9 na\u00eetre 50 ans plus t\u00f4t ou 50 ans plus tard ?",
            "T'es plut\u00f4t \"tout planifier\" ou \"improviser jusqu'au chaos\" ?",
            "T'es d'accord que les gens qui mettent du lait avant les c\u00e9r\u00e9ales sont dangereux ?",
            "Si t'avais \u00e0 choisir entre perdre la vue ou l'ou\u00efe, ce serait quoi ?",
            "T'es plut\u00f4t mer ou montagne ? Et si t'as dit ni l'un ni l'autre, t'as tort.",
            "Minecraft ou Fortnite \u2014 le d\u00e9bat ultime. Tranche.",
            "Les films ou les s\u00e9ries ? T'as le droit d'h\u00e9siter mais pas longtemps.",
            "T'pr\u00e9f\u00e8res \u00eatre trop chaud ou trop froid ?",
            "T'es \"je r\u00e9ponds aux messages dans la seconde\" ou \"je laisse mariner 3 jours\" ?",
            "Si t'\u00e9tais un personnage de jeu vid\u00e9o, t'aurais quel r\u00f4le ? Tank, DPS, support ?",
            "T'es plut\u00f4t quelqu'un qui lit les instructions ou qui fonce et voit ce qui se passe ?",
            "Quel est le film/s\u00e9rie que tout le monde aime mais que toi tu trouves nul ?"
        ];

        const questionsConfession = [
            "Quelle est la chose la plus stupide que t'as faite pour impressionner quelqu'un ?",
            "T'as un talent cach\u00e9 que personne sur ce serveur conna\u00eet ?",
            "Quelle est ta honte secr\u00e8te en mati\u00e8re de musique ?",
            "T'as d\u00e9j\u00e0 menti pour \u00e9viter une soir\u00e9e ? Sur quoi ?",
            "Quel est le truc le plus enfantin que tu fais encore aujourd'hui ?",
            "T'as d\u00e9j\u00e0 fait semblant de pas voir quelqu'un dans la rue pour \u00e9viter de lui parler ?",
            "Quelle est la chose la plus bizarre que t'aies mang\u00e9e ?",
            "T'as une peur que t'assumes pas en public ?",
            "Quel est le moment le plus g\u00eanant de ta vie scolaire ?",
            "T'as d\u00e9j\u00e0 pleur\u00e9 devant un film/s\u00e9rie que t'aurais jamais avou\u00e9 ?",
            "T'as d\u00e9j\u00e0 eu une phase \"cringe\" dont tu parles plus ? Raconte.",
            "Quel est le mensonge le plus \u00e9labor\u00e9 que t'as jamais racont\u00e9 ?",
            "T'as une habitude bizarre que tu fais quand t'es seul.e ?",
            "Quel est le truc que t'as achet\u00e9 et que t'as jamais utilis\u00e9 ?",
            "T'as d\u00e9j\u00e0 googl\u00e9 quelque chose de tellement bizarre que t'aurais jamais montr\u00e9 ton historique ?",
            "Quelle est la d\u00e9cision la plus impulsive que t'as prise et dont t'es fi\u00e8r.e ?",
            "T'as d\u00e9j\u00e0 rat\u00e9 quelque chose d'important \u00e0 cause d'une s\u00e9rie/jeu ?",
            "Quel est le conseil le plus nul qu'on t'a jamais donn\u00e9 ?",
            "Quel est le truc que tu fais et que tu sais que c'est mal mais tu le fais quand m\u00eame ?",
            "T'as une opinion impopulaire que t'assumes compl\u00e8tement ?"
        ];

        const questionsHypothetiques = [
            "T'es le dernier humain sur Terre, mais t'as le choix d'un animal comme compagnon. Lequel ?",
            "Si t'avais 24h pour faire n'importe quoi sans cons\u00e9quences, ce serait quoi ?",
            "T'apprends que t'es en fait un personnage de fiction. Dans quel univers t'es ?",
            "T'as 1 million d'euros mais tu dois tout d\u00e9penser en 24h. Comment ?",
            "Si tu pouvais vivre dans n'importe quelle \u00e9poque de l'histoire, ce serait laquelle ?",
            "T'as le pouvoir de lire dans les pens\u00e9es, mais seulement d'une personne pour toujours. Qui ?",
            "Si t'\u00e9tais invisible pendant une heure, tu ferais quoi ?",
            "T'apprends que le monde finit dans 48h. Ta derni\u00e8re journ\u00e9e ressemble \u00e0 quoi ?",
            "Si tu pouvais ma\u00eetriser instantan\u00e9ment n'importe quelle comp\u00e9tence, ce serait laquelle ?",
            "T'as le choix : vivre 200 ans en bonne sant\u00e9 ou vivre normal mais avec 3 v\u0153ux. Tu choisis quoi ?",
            "Si t'avais un bouton pour effacer un souvenir de ta m\u00e9moire, t'en effacerais un ?",
            "T'es propuls\u00e9.e dans un jeu vid\u00e9o au hasard. Quel jeu t'esp\u00e8res tomber ?",
            "Si tu pouvais avoir une conversation avec toi-m\u00eame dans 10 ans, tu demanderais quoi ?",
            "T'as le choix entre voler ou \u00eatre invisible. T'es team quoi ?",
            "Si t'\u00e9tais un super-vilain, quelle serait ton obsession principale ?",
            "T'as la possibilit\u00e9 de tout recommencer depuis tes 10 ans avec ta m\u00e9moire actuelle. Tu acceptes ?",
            "Si t'avais acc\u00e8s au cerveau de n'importe qui pendant 10 minutes, qui ce serait ?",
            "T'apprends que t'as un jumeau/une jum\u00e8le quelque part. Ta r\u00e9action ?",
            "Si tu pouvais changer une loi dans ton pays, ce serait laquelle ?",
            "T'es seul.e sur une \u00eele d\u00e9serte avec une console et un seul jeu pour toujours. Lequel ?"
        ];

        const questionsServeur = [
            "Qui sur ce serveur survivrait le plus longtemps dans un film d'horreur ?",
            "Si Rega\u00efa \u00e9tait un pays, quelle serait sa capitale et son plat national ?",
            "Qui sur ce serveur serait le/la premier.e \u00e0 trahir le groupe en mode apocalypse zombie ?",
            "Si les membres de ce serveur formaient un groupe de musique, quel genre ce serait ?",
            "Qui serait le/la meilleur.e pr\u00e9sident.e du serveur ? Et le/la pire ?",
            "Si ce serveur \u00e9tait une s\u00e9rie TV, quel genre ce serait ?",
            "Qui serait le/la dernier.e debout lors d'une soir\u00e9e entre membres du serveur ?",
            "Si chaque membre avait un animal spirituel, lequel t'attribuerais-tu ?",
            "Quel membre du serveur serait le plus susceptible de devenir c\u00e9l\u00e8bre ? Pour quoi ?",
            "Si vous deviez partir en road trip ensemble, qui conduit et qui dort tout le trajet ?"
        ];

        const questionsPhilosophie = [
            "Est-ce qu'on peut vraiment faire confiance \u00e0 quelqu'un qui n'aime pas les animaux ?",
            "T'es plut\u00f4t \"le voyage compte plus que la destination\" ou \"juste arriver vite\" ?",
            "Est-ce qu'un.e ami.e qui te ment pour te prot\u00e9ger, c'est encore un.e vrai.e ami.e ?",
            "Si personne te voit faire quelque chose de bien, \u00e7a compte quand m\u00eame ?",
            "Est-ce que c'est mieux d'avoir v\u00e9cu quelque chose d'intense et de douloureux plut\u00f4t que rien du tout ?",
            "T'es d'accord que les gens changent vraiment, ou ils font juste semblant ?",
            "Est-ce qu'il y a des choses qu'on devrait garder secr\u00e8tes m\u00eame avec ses meilleurs ami.es ?",
            "T'es plut\u00f4t \"les regrets c'est utile\" ou \"no regrets, on assume tout\" ?",
            "Si le bonheur \u00e9tait une comp\u00e9tence, t'aurais quel niveau ?",
            "Est-ce qu'on choisit vraiment qui on aime ou c'est juste le hasard ?"
        ];

        const questionsAleatoires = [
            "T'as d\u00e9j\u00e0 parl\u00e9 \u00e0 une plante ? Elle t'a r\u00e9pondu ?",
            "Quel est le son le plus agaçant au monde selon toi ?",
            "Si t'avais \u00e0 sentir comme quelque chose pour toujours, ce serait quoi ?",
            "T'es capable de manger la m\u00eame chose tous les jours pendant un an pour 10 000\u20ac ? C'est quoi le plat ?",
            "Quel animal aurait le meilleur compte Instagram selon toi ?",
            "Si t'avais \u00e0 choisir une musique pour ta propre mort, ce serait laquelle ?",
            "T'arrives \u00e0 d\u00e9crire ta personnalit\u00e9 avec seulement trois emojis ?",
            "Quel est le film dont tu connais tous les dialogues par c\u0153ur sans l'avoir voulu ?",
            "T'as d\u00e9j\u00e0 eu une dispute avec quelqu'un sur quelque chose de compl\u00e8tement inutile ? C'\u00e9tait quoi ?",
            "Si ta vie \u00e9tait un genre de film, ce serait lequel ?",
            "Quel est le mot que tu trouves le plus beau dans n'importe quelle langue ?",
            "T'es du genre \u00e0 lire les termes et conditions ou tu cliques \"Accepter\" les yeux ferm\u00e9s ?",
            "Si t'\u00e9tais une boisson, tu serais laquelle ?",
            "T'as d\u00e9j\u00e0 eu un r\u00eave tellement bizarre que t'as mis des heures \u00e0 t'en remettre ?",
            "Quel est le truc le plus inutile que tu sais faire et dont t'es fi\u00e8r.e ?",
            "Si ta vie avait une bande-son, quel genre de musique ce serait ?",
            "T'es plut\u00f4t \"j'arrive en avance\" ou \"en retard mais avec style\" ?",
            "Quel est le truc que tout le monde fait en public et que personne avoue ?",
            "Si t'\u00e9tais un m\u00e8me, t'aurais quel format ?",
            "Quelle est la question que t'aurais voulu qu'on te pose ce soir ?"
        ];

        const categories = {
            debats: { questions: questionsDebats, label: '\ud83d\udde3\ufe0f D\u00e9bats / Opinions', color: 0xe74c3c },
            confession: { questions: questionsConfession, label: '\ud83e\udd2b Confession / Introspection', color: 0x9b59b6 },
            hypothetiques: { questions: questionsHypothetiques, label: '\ud83e\udd14 Hypoth\u00e9tiques', color: 0x3498db },
            serveur: { questions: questionsServeur, label: '\ud83c\udfe0 Sp\u00e9ciales Rega\u00efa', color: 0x2ecc71 },
            philosophie: { questions: questionsPhilosophie, label: '\ud83e\udde0 Philosophie de comptoir', color: 0xf39c12 },
            aleatoires: { questions: questionsAleatoires, label: '\ud83c\udfb2 Al\u00e9atoires / Chaos', color: 0x1abc9c }
        };

        const value = interaction.values[0];
        const cat = categories[value];
        const question = cat.questions[Math.floor(Math.random() * cat.questions.length)];

        const embed = new EmbedBuilder()
            .setColor(cat.color)
            .setTitle(cat.label)
            .setDescription(`\u2753 ${question}`);

        const newQuestionButton = new ButtonBuilder()
            .setCustomId(`question_new_${interaction.user.id}`)
            .setLabel("\u2753 Nouvelle question")
            .setStyle(ButtonStyle.Secondary);
        const buttonRow = new ActionRowBuilder().addComponents(newQuestionButton);

        return interaction.update({ embeds: [embed], components: [buttonRow] });
    }

    // =========================
    // INTERACTIONS !HELP OPTIMISÉ
    // =========================

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('help_select_')) {
        const parts = interaction.customId.split('_');
        const authorId = parts[2];
        const messageId = parts[3] ?? null;

        if (interaction.user.id !== authorId) {
            return interaction.reply({ content: "Ce menu d'aide ne t'est pas destiné !", ephemeral: true });
        }

        const category = interaction.values[0];
        const embed = buildHelpCategoryEmbed(category);
        const menuRow = buildHelpMenu(authorId, messageId);
        const navRow = buildHelpNavRow(authorId, messageId);
        return interaction.update({ embeds: [embed], components: [menuRow, navRow] });
    }

    if (interaction.isButton() && interaction.customId.startsWith('help_home_')) {
        const parts = interaction.customId.split('_');
        const authorId = parts[2];
        const messageId = parts[3] ?? null;

        if (interaction.user.id !== authorId) {
            return interaction.reply({ content: "Ce bouton ne t'est pas destiné !", ephemeral: true });
        }

        const embed = buildHelpHomeEmbed();
        const menuRow = buildHelpMenu(authorId, messageId);
        const navRow = buildHelpNavRow(authorId, messageId);
        return interaction.update({ embeds: [embed], components: [menuRow, navRow] });
    }

    if (interaction.isButton() && interaction.customId.startsWith('help_delete_')) {
        const parts = interaction.customId.split('_');
        const authorId = parts[2];
        const messageId = parts[3] ?? null;

        if (interaction.user.id !== authorId) {
            return interaction.reply({ content: "Tu ne peux pas supprimer ce message !", ephemeral: true });
        }

        await interaction.message.delete().catch(() => {});
        if (messageId && messageId !== '') {
            const originalMsg = await interaction.channel.messages.fetch(messageId).catch(() => null);
            if (originalMsg) await originalMsg.delete().catch(() => {});
        }
        return;
    }

    // Bouton nouvelle question pour !question
    if (interaction.isButton() && interaction.customId.startsWith('question_new_')) {
        const authorId = interaction.customId.split('_')[2];
        if (interaction.user.id !== authorId) {
            return interaction.reply({ content: "Ce bouton ne t'est pas destiné !", ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor(0x9b59b6)
            .setTitle("❓ Question du soir")
            .setDescription("Choisis une catégorie pour recevoir une question aléatoire !");

        const menu = new StringSelectMenuBuilder()
            .setCustomId('question_menu')
            .setPlaceholder('Choisis une catégorie')
            .addOptions(
                { label: '🗣️ Débats / Opinions', value: 'debats' },
                { label: '🤫 Confession / Introspection', value: 'confession' },
                { label: '🤔 Hypothétiques', value: 'hypothetiques' },
                { label: '🏠 Spéciales Regaïa', value: 'serveur' },
                { label: '🧠 Philosophie de comptoir', value: 'philosophie' },
                { label: '🎲 Aléatoires / Chaos', value: 'aleatoires' }
            );

        const row = new ActionRowBuilder().addComponents(menu);
        return interaction.update({ embeds: [embed], components: [row] });
    }
} catch (err) {
    console.error('Erreur interactionCreate:', err);
    if (err.code === 10062 || err.message?.includes('Unknown interaction') || err.message?.includes('expired')) {
        if (interaction.isButton()) {
            interaction.reply({ content: "Ce bouton n'est plus disponible !", ephemeral: true }).catch(() => {});
        }
    }
}
});

// =========================
//         CONNEXION
// =========================

client.on('channelCreate', async (channel) => {
    if (channel.type === ChannelType.GuildText) {
        await assurerWebhookRoulette(channel).catch(() => {});
    }
});

client.once('ready', async () => {
    console.log(`✅ ${client.user.tag} est connecté`);

    // Enregistrement des commandes Slash (/)
    const slashCommands = [
        // Général & Aide
        new SlashCommandBuilder().setName('help').setDescription('Ouvre le guide d\'utilisation officiel de Cacabot'),

        // Roulette & Raccourcis
        new SlashCommandBuilder().setName('roulette').setDescription('Tenter sa chance sur la Roulette Regaïenne')
            .addBooleanOption(opt => opt.setName('lancer').setDescription('Lancer immédiatement sans afficher l\'accueil')),
        new SlashCommandBuilder().setName('rlt').setDescription('Tenter sa chance sur la Roulette (raccourci)')
            .addBooleanOption(opt => opt.setName('lancer').setDescription('Lancer immédiatement sans afficher l\'accueil')),
        new SlashCommandBuilder().setName('rltsucces').setDescription('Consulter les 30 succès de la roulette')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à inspecter')),
        new SlashCommandBuilder().setName('roulettesucces').setDescription('Consulter les 30 succès de la roulette')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à inspecter')),
        new SlashCommandBuilder().setName('rltstats').setDescription('Voir les statistiques complètes de la roulette')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à inspecter')),
        new SlashCommandBuilder().setName('roulettestats').setDescription('Voir les statistiques complètes de la roulette')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à inspecter')),
        new SlashCommandBuilder().setName('rltstate').setDescription('Voir les bonus et malus actifs sur la roulette')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à inspecter')),
        new SlashCommandBuilder().setName('roulettestate').setDescription('Voir les bonus et malus actifs sur la roulette')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à inspecter')),
        new SlashCommandBuilder().setName('rlttop').setDescription('Classement des membres avec le plus de succès roulette'),
        new SlashCommandBuilder().setName('roulettetop').setDescription('Classement des membres avec le plus de succès roulette'),

        // Motus & Rébus Regaïen
        new SlashCommandBuilder().setName('motus').setDescription('Statut du Motus du jour (10h et 19h) et compte à rebours'),
        new SlashCommandBuilder().setName('motustats').setDescription('Consulter les victoires et parties au Motus')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à inspecter')),
        new SlashCommandBuilder().setName('rebus').setDescription('Statut du Rébus Regaïen du jour (15h00) et compte à rebours'),
        new SlashCommandBuilder().setName('decodeur').setDescription('Statut du Rébus Regaïen (raccourci)'),
        new SlashCommandBuilder().setName('rebusstats').setDescription('Consulter les victoires et points au Rébus Regaïen')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à inspecter')),

        // Citations & Profils
        new SlashCommandBuilder().setName('quote').setDescription('Afficher une citation culte du serveur')
            .addStringOption(opt => opt.setName('recherche').setDescription('Numéro, mot-clé ou membre')),
        new SlashCommandBuilder().setName('citation').setDescription('Afficher une citation culte (raccourci)')
            .addStringOption(opt => opt.setName('recherche').setDescription('Numéro, mot-clé ou membre')),
        new SlashCommandBuilder().setName('profil').setDescription('Fiche détaillée d\'un·e membre (messages, badges, etc.)')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à inspecter')),
        new SlashCommandBuilder().setName('profile').setDescription('Fiche détaillée d\'un·e membre (raccourci)')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à inspecter')),
        new SlashCommandBuilder().setName('avatar').setDescription('Affiche l\'avatar d\'un·e membre en grand format')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à inspecter')),
        new SlashCommandBuilder().setName('top').setDescription('Classement général des membres les plus actifs'),
        new SlashCommandBuilder().setName('actif').setDescription('Podium des membres les plus actifs (Jour, Semaine, Mois)'),

        // Jeux & Social
        new SlashCommandBuilder().setName('lovecalc').setDescription('Calculer la compatibilité amoureuse entre deux membres')
            .addUserOption(opt => opt.setName('membre1').setDescription('Premier membre').setRequired(true))
            .addUserOption(opt => opt.setName('membre2').setDescription('Deuxième membre').setRequired(true)),
        new SlashCommandBuilder().setName('flip').setDescription('Lancer une pièce à pile ou face (solo ou duel)'),
        new SlashCommandBuilder().setName('destin').setDescription('Prédit votre destin cosmique'),
        new SlashCommandBuilder().setName('horoscope').setDescription('L\'oracle cosmique du jour'),
        new SlashCommandBuilder().setName('animal').setDescription('Devine ton animal spirituel')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à analyser')),
        new SlashCommandBuilder().setName('blague').setDescription('Raconte une blague aléatoire')
            .addStringOption(opt => opt.setName('type').setDescription('Catégorie').addChoices(
                { name: 'Humour soft', value: 'soft' },
                { name: 'Humour classique', value: 'classique' },
                { name: 'Humour noir', value: 'noir' }
            )),
        new SlashCommandBuilder().setName('topchef').setDescription('Critique et note gastronomique d\'un plat')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à noter')),
        new SlashCommandBuilder().setName('wanted').setDescription('Affiche le criminel du jour'),
        new SlashCommandBuilder().setName('epsys').setDescription('Envoie un GIF aléatoire d\'Epsys'),
        new SlashCommandBuilder().setName('bougetoi').setDescription('Rappelle (vigoureusement) à Epsys d\'aller monter sa vidéo'),
        new SlashCommandBuilder().setName('sylvain').setDescription('Singe fort ensemble (Sylvain Lévy)'),
        new SlashCommandBuilder().setName('question').setDescription('Question de débat du soir'),
        new SlashCommandBuilder().setName('choix').setDescription('Laisse Cacabot trancher un dilemme')
            .addStringOption(opt => opt.setName('question').setDescription('Ex : pizza ou burger ?').setRequired(true)),
        new SlashCommandBuilder().setName('suggestion').setDescription('Proposer une idée pour le serveur')
            .addStringOption(opt => opt.setName('proposition').setDescription('Ton idée').setRequired(true)),
        new SlashCommandBuilder().setName('sugg').setDescription('Proposer une idée pour le serveur (raccourci)')
            .addStringOption(opt => opt.setName('proposition').setDescription('Ton idée').setRequired(true)),

        // Interactions (et leurs raccourcis français)
        new SlashCommandBuilder().setName('kiss').setDescription('Embrasser un·e membre')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à embrasser').setRequired(true)),
        new SlashCommandBuilder().setName('bisou').setDescription('Embrasser un·e membre (raccourci)')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à embrasser').setRequired(true)),
        new SlashCommandBuilder().setName('hug').setDescription('Faire un câlin à un·e membre')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à câliner').setRequired(true)),
        new SlashCommandBuilder().setName('calin').setDescription('Faire un câlin à un·e membre (raccourci)')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à câliner').setRequired(true)),
        new SlashCommandBuilder().setName('rizz').setDescription('Tenter de séduire un·e membre')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à rizz').setRequired(true)),
        new SlashCommandBuilder().setName('punch').setDescription('Frapper un·e membre')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à frapper').setRequired(true)),
        new SlashCommandBuilder().setName('frappe').setDescription('Frapper un·e membre (raccourci)')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à frapper').setRequired(true)),
        new SlashCommandBuilder().setName('bang').setDescription('Tirer sur un·e membre')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à viser').setRequired(true)),
        new SlashCommandBuilder().setName('tir').setDescription('Tirer sur un·e membre (raccourci)')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à viser').setRequired(true)),
        new SlashCommandBuilder().setName('insult').setDescription('Insulter gratuitement un·e membre')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à insulter').setRequired(true)),
        new SlashCommandBuilder().setName('bait').setDescription('Ragebait un·e membre')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à bait').setRequired(true)),
        new SlashCommandBuilder().setName('ban').setDescription('Faussement bannir un·e membre')
            .addUserOption(opt => opt.setName('membre').setDescription('Le membre à bannir').setRequired(true)),
        new SlashCommandBuilder().setName('danse').setDescription('S\'ambiancer sur le dancefloor')
            .addUserOption(opt => opt.setName('membre').setDescription('Avec qui danser')),
        new SlashCommandBuilder().setName('dance').setDescription('S\'ambiancer sur le dancefloor (raccourci)')
            .addUserOption(opt => opt.setName('membre').setDescription('Avec qui danser')),
        new SlashCommandBuilder().setName('rire').setDescription('Se taper une barre de rire')
            .addUserOption(opt => opt.setName('membre').setDescription('De qui rire')),
        new SlashCommandBuilder().setName('cry').setDescription('Pleurer en solo ou à cause de quelqu\'un')
            .addUserOption(opt => opt.setName('membre').setDescription('Qui te fait pleurer')),
        new SlashCommandBuilder().setName('pleure').setDescription('Pleurer en solo ou à cause de quelqu\'un (raccourci)')
            .addUserOption(opt => opt.setName('membre').setDescription('Qui te fait pleurer')),
        new SlashCommandBuilder().setName('run').setDescription('Prendre la fuite')
            .addUserOption(opt => opt.setName('membre').setDescription('Qui fuir')),
        new SlashCommandBuilder().setName('court').setDescription('Prendre la fuite (raccourci)')
            .addUserOption(opt => opt.setName('membre').setDescription('Qui fuir')),
        new SlashCommandBuilder().setName('explode').setDescription('Exploser sans aucune raison'),
        new SlashCommandBuilder().setName('explose').setDescription('Exploser sans aucune raison (raccourci)'),
        new SlashCommandBuilder().setName('die').setDescription('Mourir dans d\'atroces souffrances')
            .addUserOption(opt => opt.setName('membre').setDescription('Qui cause ta mort')),
        new SlashCommandBuilder().setName('jailaref').setDescription('Affirmer fièrement que tu as la référence')
            .addUserOption(opt => opt.setName('membre').setDescription('De qui')),
        new SlashCommandBuilder().setName('palaref').setDescription('Assumer que tu n\'as rien compris')
            .addUserOption(opt => opt.setName('membre').setDescription('De qui')),

        // Anniversaires
        new SlashCommandBuilder().setName('anniversaire').setDescription('Gestion des anniversaires du serveur')
            .addSubcommand(sub => sub.setName('show').setDescription('Affiche un anniversaire et le compte à rebours')
                .addUserOption(opt => opt.setName('membre').setDescription('Le membre')))
            .addSubcommand(sub => sub.setName('set').setDescription('Enregistre un anniversaire (format JJ/MM)')
                .addStringOption(opt => opt.setName('date').setDescription('Format JJ/MM (ex : 24/07)').setRequired(true))
                .addUserOption(opt => opt.setName('membre').setDescription('Attribuer à')))
            .addSubcommand(sub => sub.setName('list').setDescription('Liste complète des anniversaires'))
            .addSubcommand(sub => sub.setName('next').setDescription('Prochain anniversaire à fêter'))
            .addSubcommand(sub => sub.setName('remove').setDescription('Supprimer un anniversaire')
                .addUserOption(opt => opt.setName('membre').setDescription('Le membre'))),

        // Utilitaires & YouTube
        new SlashCommandBuilder().setName('serveur').setDescription('Informations complètes sur le serveur Regaïa'),
        new SlashCommandBuilder().setName('meteo').setDescription('Météo en direct d\'une ville')
            .addStringOption(opt => opt.setName('ville').setDescription('La ville').setRequired(true)),
        new SlashCommandBuilder().setName('pomodoro').setDescription('Session de travail Pomodoro')
            .addSubcommand(sub => sub.setName('lancer').setDescription('Démarrer un Pomodoro'))
            .addSubcommand(sub => sub.setName('stop').setDescription('Arrêter le Pomodoro')),
        new SlashCommandBuilder().setName('rappel').setDescription('Gérer tes rappels')
            .addSubcommand(sub => sub.setName('ajouter').setDescription('Programmer un rappel')
                .addStringOption(opt => opt.setName('temps').setDescription('Ex : 10min, 1h').setRequired(true))
                .addStringOption(opt => opt.setName('message').setDescription('Texte du rappel').setRequired(true)))
            .addSubcommand(sub => sub.setName('list').setDescription('Voir tes rappels en attente'))
            .addSubcommand(sub => sub.setName('remove').setDescription('Supprimer un rappel')
                .addStringOption(opt => opt.setName('nom').setDescription('Nom du rappel').setRequired(true))),
        new SlashCommandBuilder().setName('aternos').setDescription('IP du serveur Minecraft'),
        new SlashCommandBuilder().setName('youtube').setDescription('Rechercher une vidéo sur YouTube')
            .addStringOption(opt => opt.setName('recherche').setDescription('Titre ou mot-clé').setRequired(true)),
        new SlashCommandBuilder().setName('last').setDescription('Dernière vidéo publiée d\'une chaîne')
            .addStringOption(opt => opt.setName('chaine').setDescription('Nom de la chaîne').setRequired(true)),
        new SlashCommandBuilder().setName('stats').setDescription('Statistiques d\'une chaîne YouTube')
            .addStringOption(opt => opt.setName('chaine').setDescription('Nom de la chaîne').setRequired(true)),
        new SlashCommandBuilder().setName('botinfo').setDescription('Infos techniques et version de Cacabot'),
        new SlashCommandBuilder().setName('about').setDescription('Infos techniques (raccourci)'),
        new SlashCommandBuilder().setName('ping').setDescription('Latence du bot et WebSocket'),
        new SlashCommandBuilder().setName('prune').setDescription('Supprimer les derniers messages')
            .addIntegerOption(opt => opt.setName('nombre').setDescription('Nombre de messages à supprimer').setRequired(true)),
        new SlashCommandBuilder().setName('embed').setDescription('Créateur d\'embed (Epsys-only)')
    ].map(cmd => cmd.toJSON());

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    const REGAIA_GUILD_ID = '720057528351850547';

    for (const guild of client.guilds.cache.values()) {
        const body = guild.id === REGAIA_GUILD_ID ? slashCommands : [];
        await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), { body })
            .then(() => {
                if (guild.id === REGAIA_GUILD_ID) {
                    console.log(`✅ Commandes Slash (/) déployées exclusivement sur ${guild.name}`);
                }
            })
            .catch(err => console.error(`Erreur déploiement Slash sur ${guild.name}:`, err.message));
    }

    // Chargement immédiat des données sans attendre
    await loadAll();

    // Envoi immédiat du message de retour à la seconde où les commandes sont opérationnelles
    (async () => {
        try {
            const salonNotif = await client.channels.fetch('1480756332373213275').catch(() => null);
            if (salonNotif) {
                let nouveauCommitDetecte = false;
                if (process.env.GITHUB_TOKEN) {
                    const resCommits = await fetch('https://api.github.com/repos/R3GS/Cacabot/commits?per_page=1', {
                        headers: {
                            'Authorization': `token ${process.env.GITHUB_TOKEN}`,
                            'Accept': 'application/vnd.github.v3+json'
                        }
                    }).then(r => r.json()).catch(() => null);

                    const shaActuel = Array.isArray(resCommits) && resCommits[0]?.sha ? resCommits[0].sha : null;
                    if (shaActuel && shaActuel !== dernierCommitSha) {
                        dernierCommitSha = shaActuel;
                        nouveauCommitDetecte = true;
                        demanderSauvegarde();
                    }
                } else {
                    nouveauCommitDetecte = true;
                }

                if (nouveauCommitDetecte) {
                    const commitCount = await getCommitCount();
                    const versionTexte = commitCount ? ` *(Version 1.${commitCount})*` : '';
                    await salonNotif.send(`✅ Mise à jour faite, je suis de retour !${versionTexte}`);

                    // Envoi automatique du fichier index.js dans le salon d'archives de code
                    const salonCode = await client.channels.fetch('1556184304848085114').catch(() => null);
                    if (salonCode) {
                        const versionNom = commitCount ? `1.${commitCount}` : 'actuelle';
                        const dateStr = new Date().toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' }) + ' à ' + new Date().toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris' });

                        await salonCode.send({
                            content: `📦 **Code source — Version ${versionNom}**\n-# *Déployé le ${dateStr}*`,
                            files: [{ attachment: './index.js', name: `index_v${versionNom}.js` }]
                        }).catch(err => console.error("Erreur envoi index.js :", err.message));
                    }
                }
            }
        } catch (err) {
            console.error("Erreur notification de mise à jour :", err.message);
        }
    })();

    for (const [uid, chId] of rouletteNotifs) armerNotifRoulette(uid, chId);
    cleanOldData();
    setInterval(verifierHappyHour, 30 * 1000);
    setInterval(verifierTwitchLive, 60 * 1000);

    // Lancement et vérification automatique des Motus (10h et 19h) + arrêt après 1 heure
    let derniereSessionLancee = null;
    const verifierMotusAutomatique = async () => {
        const now = new Date();
        const paris = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
        const dateKey = paris.getFullYear() * 10000 + (paris.getMonth() + 1) * 100 + paris.getDate();
        const h = paris.getHours();
        const m = paris.getMinutes();
        const guildRegaia = client.guilds.cache.get('720057528351850547');

        // 1. Lancement du Motus du matin à 10h00 (6 lettres)
        if (h === 10 && m === 0 && derniereSessionLancee !== `${dateKey}_10h`) {
            derniereSessionLancee = `${dateKey}_10h`;
            if (guildRegaia) await envoyerMotusQuotidien(guildRegaia, 10);
        }

        // 2. Lancement du Rébus Regaïen à 15h00 (5 manches de 5 minutes)
        if (h === 15 && m === 0 && derniereSessionLancee !== `${dateKey}_15h`) {
            derniereSessionLancee = `${dateKey}_15h`;
            if (guildRegaia) await lancerSessionRebus(guildRegaia);
        }

        // 3. Lancement du Motus du soir à 19h00 (7 lettres - Difficile)
        if (h === 19 && m === 0 && derniereSessionLancee !== `${dateKey}_19h`) {
            derniereSessionLancee = `${dateKey}_19h`;
            if (guildRegaia) await envoyerMotusQuotidien(guildRegaia, 19);
        }

        // 3. Arrêt automatique après 1h de jeu si le mot n'a pas été trouvé
        if (motusData.mot && !motusData.termine && motusData.expireAt && Date.now() >= motusData.expireAt) {
            motusData.termine = true;
            const salon = client.channels.cache.get(MOTUS_CHANNEL_ID);
            if (salon) {
                const prochainTxt = motusData.heureSession === 10 
                    ? 'ce soir à **19h00 (7 lettres - Difficile)**' 
                    : 'demain matin à **10h00 (6 lettres)**';

                const embedFin = new EmbedBuilder()
                    .setColor(0xe74c3c)
                    .setTitle('⏰ TEMPS ÉCOULÉ ! (Fin du Motus)')
                    .setDescription(
                        `L'heure de jeu est terminée et personne n'a trouvé le mot !\n\n` +
                        `🔤 **Le mot était :** \`${motusData.mot}\`\n\n` +
                        `Rendez-vous ${prochainTxt} pour une nouvelle session !`
                    )
                    .setFooter({ text: 'Motus Quotidien • 1 heure de jeu par session' });

                await salon.send({ embeds: [embedFin] }).catch(() => {});
            }
            demanderSauvegarde();
        }
    };
    setInterval(verifierMotusAutomatique, 30 * 1000);

    // Tâches de fond sans bloquer l'état du bot
    for (const guild of client.guilds.cache.values()) {
        await guild.members.fetch().catch(() => {});
    }
    console.log(`✅ Membres fetchés`);

    for (const guild of client.guilds.cache.values()) {
        await initialiserWebhooksRoulette(guild);
    }

    const msUntilMidnightParis = () => {
        const now = new Date();
        const parisNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
        const parisMidnight = new Date(parisNow);
        parisMidnight.setHours(24, 0, 0, 0);
        return parisMidnight - parisNow;
    };

    function scheduleBirthdayCheck() {
        const delay = msUntilMidnightParis();
        setTimeout(async () => {
            await checkBirthdays();
            scheduleBirthdayCheck();
        }, delay);
    }
    scheduleBirthdayCheck();
});

// =========================
//     LISTENER REACTIONS
// =========================

// Boutons de rôles interactifs (Ajout / Retrait au clic)
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton() || !interaction.customId.startsWith('rolebtn_')) return;

    const roleId = interaction.customId.replace('rolebtn_', '');
    const role = interaction.guild?.roles.cache.get(roleId);

    if (!role) {
        return interaction.reply({ content: "❌ Ce rôle n'existe plus sur le serveur !", ephemeral: true });
    }

    const member = interaction.member;
    if (member.roles.cache.has(roleId)) {
        await member.roles.remove(roleId).catch(err => console.error("Erreur retrait rôle bouton:", err.message));
        return interaction.reply({ content: `❌ Le rôle **${role.name}** t'a été retiré !`, ephemeral: true });
    } else {
        await member.roles.add(roleId).catch(err => console.error("Erreur ajout rôle bouton:", err.message));
        return interaction.reply({ content: `✅ Tu as reçu le rôle **${role.name}** !`, ephemeral: true });
    }
});

// Rôles réaction automatiques (Ajout du rôle)
client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch().catch(() => {});
    if (reaction.message.partial) await reaction.message.fetch().catch(() => {});

    const msgConfig = reactionRolesData[reaction.message.id];
    if (!msgConfig) return;

    const emojiKey = reaction.emoji.id ? `<:${reaction.emoji.name}:${reaction.emoji.id}>` : reaction.emoji.name;
    const roleId = msgConfig.roles[emojiKey] || msgConfig.roles[reaction.emoji.name] || (reaction.emoji.id && msgConfig.roles[reaction.emoji.id]);

    if (roleId) {
        const member = reaction.message.guild?.members.cache.get(user.id) ?? await reaction.message.guild?.members.fetch(user.id).catch(() => null);
        if (member && !member.roles.cache.has(roleId)) {
            await member.roles.add(roleId).catch(err => console.error(`Erreur ajout rôle réaction:`, err.message));
        }
    }
});

// Rôles réaction automatiques (Retrait du rôle)
client.on('messageReactionRemove', async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch().catch(() => {});
    if (reaction.message.partial) await reaction.message.fetch().catch(() => {});

    const msgConfig = reactionRolesData[reaction.message.id];
    if (!msgConfig) return;

    const emojiKey = reaction.emoji.id ? `<:${reaction.emoji.name}:${reaction.emoji.id}>` : reaction.emoji.name;
    const roleId = msgConfig.roles[emojiKey] || msgConfig.roles[reaction.emoji.name] || (reaction.emoji.id && msgConfig.roles[reaction.emoji.id]);

    if (roleId) {
        const member = reaction.message.guild?.members.cache.get(user.id) ?? await reaction.message.guild?.members.fetch(user.id).catch(() => null);
        if (member && member.roles.cache.has(roleId)) {
            await member.roles.remove(roleId).catch(err => console.error(`Erreur retrait rôle réaction:`, err.message));
        }
    }
});

client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;
    if (reaction.emoji.name !== '🖕' && reaction.emoji.name !== 'middle_finger') return;

    const msg = reaction.message;
    if (msg.author.id !== client.user.id) return;

    // Vérifier que c'est la première réaction de ce type
    const emojiReaction = msg.reactions.cache.find(r =>
        r.emoji.name === '\uD83D\uDD95' || r.emoji.name === 'middle_finger'
    );
    if (emojiReaction && emojiReaction.count > 1) return;

    const memberNom = msg.guild?.members.cache.get(user.id)?.displayName ?? user.username;
    await msg.channel.send(`Bah alors, **${memberNom}**, on m'envoie un doigt d'honneur ?`);
});

client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;
    if (!['🛑', '❌', '👎', '🤫', '🔇'].includes(reaction.emoji.name)) return;

    const msg = reaction.message;
    if (msg.author.id !== client.user.id) return;
    if (!/feur|bril|quoicoubeh/i.test(msg.content)) return;

    const ancien = mutedChannels.get(msg.channel.id);
    if (ancien) clearTimeout(ancien.timeout);

    const until = Date.now() + STOP_DURATION_MS;
    const timeout = setTimeout(() => mutedChannels.delete(msg.channel.id), STOP_DURATION_MS);
    mutedChannels.set(msg.channel.id, { until, timeout });

    await msg.react('🆗').catch(() => {});
});

// Couronne roulette : réaction 👑 uniquement sur le premier message de chaque bloc de messages
const dernierAuteurParSalon = new Map(); // channelId -> userId du dernier message envoyé dans ce salon
client.on('messageCreate', async (message) => {
    if (!message.guild || message.webhookId) return;
    const precedentId = dernierAuteurParSalon.get(message.channel.id);
    dernierAuteurParSalon.set(message.channel.id, message.author.id);
    if (message.author.bot) return;
    const finCouronne = rouletteCouronneUntil.get(message.author.id);
    if (!finCouronne) return;
    if (Date.now() >= finCouronne) {
        rouletteCouronneUntil.delete(message.author.id);
        return;
    }
    if (precedentId === message.author.id) return; // même bloc : déjà couronné
    await message.react('👑').catch(() => {});
});


// Malus roulette (UwU + lettre interdite + emoji) : un seul repost via webhook
client.on('messageCreate', async (message) => {
    if (message.webhookId || message.author.bot || !message.guild) return;
    if (!message.content) return;
    if (ROULETTE_WEBHOOK_EXCLUS.has(message.channel.id) || ROULETTE_WEBHOOK_EXCLUS.has(message.channel.parentId)) return;
    if (estMessageExempte(message.content, message.mentions.users.has(client.user.id))) return;

    const id = message.author.id;
    const now = Date.now();
    let contenu = message.content;
    let modifie = false;

    const lock = rouletteLettreInterdite.get(id);
    if (lock) {
        if (now >= lock.until) rouletteLettreInterdite.delete(id);
        else {
            const sansLettre = retirerLettre(contenu, lock.lettre);
            if (sansLettre !== contenu) {
                contenu = sansLettre || '\u200b';
                modifie = true;
            }
        }
    }

    const finLeet = rouletteLeetUntil.get(id);
    if (finLeet) {
        if (now >= finLeet) rouletteLeetUntil.delete(id);
        else {
            const leet = versLeet(contenu);
            if (leet !== contenu) { contenu = leet; modifie = true; }
        }
    }

    const apresTransfos = appliquerTransfos(id, contenu);
    if (apresTransfos !== contenu) { contenu = apresTransfos; modifie = true; }

    const finUwu = rouletteUwuUntil.get(id);
    if (finUwu) {
        if (now >= finUwu) rouletteUwuUntil.delete(id);
        else { contenu = `${contenu} UwU`; modifie = true; }
    }

    const finEmoji = rouletteEmojiUntil.get(id);
    if (finEmoji) {
        if (now >= finEmoji) rouletteEmojiUntil.delete(id);
        else if (!finitParUnEmoji(contenu)) {
            contenu = `${contenu} ${ROULETTE_EMOJIS_ALEATOIRES[Math.floor(Math.random() * ROULETTE_EMOJIS_ALEATOIRES.length)]}`;
            modifie = true;
        }
    }

    if (!modifie) return;

    const salonWebhook = message.channel.isThread() ? message.channel.parent : message.channel;
    const webhook = await assurerWebhookRoulette(salonWebhook);
    if (!webhook) return;

    try {
        await webhook.send({
            content: contenu.slice(0, 2000),
            username: message.member?.displayName ?? message.author.username,
            avatarURL: message.member?.displayAvatarURL() ?? message.author.displayAvatarURL(),
            files: [...message.attachments.values()].map(a => a.url),
            threadId: message.channel.isThread() ? message.channel.id : undefined,
            allowedMentions: { parse: [] }
        });
        if (!client.webhookDeletedMessages) client.webhookDeletedMessages = new Set();
        client.webhookDeletedMessages.add(message.id);
        setTimeout(() => client.webhookDeletedMessages?.delete(message.id), 15000);
        await message.delete().catch(() => {});
    } catch (e) {}
});

// Verrouillage de pseudo roulette : remet le pseudo imposé si quelqu'un essaie de le changer
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    const lock = roulettePseudoLock.get(newMember.id);
    if (!lock) return;
    if (Date.now() >= lock.until) {
        roulettePseudoLock.delete(newMember.id);
        return;
    }
    if (newMember.nickname !== lock.pseudo) {
        await newMember.setNickname(lock.pseudo).catch(() => {});
    }
});

// =========================
//   LISTENER MEMBER JOIN
// =========================

client.on('guildMemberAdd', async (member) => {
    if (!topData.messages[member.id]) {
        topData.messages[member.id] = 0;
        saveAll();
        console.log(`✅ Nouveau membre : ${member.displayName} ajouté au top`);
    }

    if (member.guild.id === '720057528351850547') {
        const accountAge = Date.now() - member.user.createdTimestamp;
        const oneMonth = 30 * 24 * 60 * 60 * 1000;
                // --- Escalade anti-raid : kick si retour trop rapide après un timeout raid ---
        const previousRaidMuteEnd = raidMuteRecord.get(member.id);
        if (previousRaidMuteEnd && Date.now() - previousRaidMuteEnd < RAID_ESCALATION_WINDOW_MS) {
            raidMuteRecord.delete(member.id);
            await member.kick('Anti-raid : retour trop rapide après un timeout raid').catch(() => {});
            return;
        }

        // --- Détection anti-raid : rafale de comptes très récents ---
        if (accountAge < RAID_ACCOUNT_AGE_MS) {
            const joins = (raidJoinTracker.get(member.guild.id) || []).filter(j => Date.now() - j.timestamp < RAID_WINDOW_MS);
            joins.push({ userId: member.id, timestamp: Date.now() });
            raidJoinTracker.set(member.guild.id, joins);

            if (joins.length >= RAID_THRESHOLD) {
                for (const j of joins) raidFlaggedUsers.set(j.userId, true);
                raidJoinTracker.delete(member.guild.id);
            }
        }
        if (accountAge < oneMonth) {
            const modChannel = member.guild.channels.cache.get(MOD_CHANNEL_ID);
            if (!modChannel) return;
            const jours = Math.floor(accountAge / (24 * 60 * 60 * 1000));
            const embed = new EmbedBuilder()
                .setColor(0xff9900)
                .setTitle('⚠️ Compte récent détecté')
                .setDescription(`<@${member.id}> vient de rejoindre le serveur, mais son compte n'a été créé qu'il y a **${jours} jour${jours > 1 ? 's' : ''}**.\n\nC'est peut-être un bot ou un compte secondaire. Que souhaitez-vous faire ?`)
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                .setFooter({ text: `ID : ${member.id}` })
                .setTimestamp();

            const actionRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`mod_action_kick_${member.id}`)
                    .setLabel('👢 Expulser')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`mod_action_ban_${member.id}`)
                    .setLabel('🔨 Bannir')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`mod_action_dismiss_${member.id}`)
                    .setLabel('✅ Fausse alerte')
                    .setStyle(ButtonStyle.Success)
            );

            await modChannel.send({ embeds: [embed], components: [actionRow] });
        }
    }
});

const VOICE_WATCH_CONFIGS = [
    {
        guildId: '1515767395036172469',
        textChannelId: '1515767396407705762',
        vocalIds: [
            '1515767396407705763',
            '1515768236443173105',
            '1515768324892655720'
        ]
    },
    {
        guildId: '720057528351850547',
        textChannelId: '720080025130369115',
        vocalIds: [
            '720057528867618910',
            '1465882952251736165',
            '1514586546014261278',
            '1542345188385619988'
        ]
    }
];

client.on('voiceStateUpdate', async (oldState, newState) => {
    const config = VOICE_WATCH_CONFIGS.find(c => c.guildId === newState.guild.id);
    if (!config) return;
    const { guildId: GUILD_ID, textChannelId: TEXT_CHANNEL_ID, vocalIds: VOCAL_IDS } = config;

    const textChannel = newState.guild.channels.cache.get(TEXT_CHANNEL_ID);
    if (!textChannel) return;

    // Supprimer l'ancien message et annuler ses timers quoi qu'il arrive
    const supprimerAncien = async () => {
        const ancien = vocalMessages.get(GUILD_ID);
        if (!ancien) return;
        ancien.timeouts.forEach(t => clearTimeout(t));
        await ancien.message.delete().catch(() => {});
        vocalMessages.delete(GUILD_ID);
    };

    // Quelqu'un quitte un vocal surveillé sans rejoindre un autre vocal surveillé
    if (
        oldState.channelId && VOCAL_IDS.includes(oldState.channelId) &&
        (!newState.channelId || !VOCAL_IDS.includes(newState.channelId))
    ) {
        const ancien = vocalMessages.get(GUILD_ID);
        if (ancien?.memberId === newState.member?.id) {
            await supprimerAncien();
        }
        return;
    }

    // Quelqu'un rejoint un vocal surveillé
    if (!newState.channelId || !VOCAL_IDS.includes(newState.channelId)) return;
    if (oldState.channelId === newState.channelId) return;

    const channel = newState.channel;
    if (!channel || channel.members.size >= 2) return;

    const memberNom = newState.member?.displayName ?? newState.member?.user.username ?? 'Quelqu\'un';
    const memberId = newState.member?.id;
    const channelName = channel.name;

    // Supprimer l'ancien message avant d'envoyer le nouveau
    await supprimerAncien();

    const msg = await textChannel.send(`**${memberNom}** a rejoint **${channelName}** ! On se fait un ptit voc ? 👀`);

    const t1 = setTimeout(async () => {
        await newState.guild.members.fetch(memberId).catch(() => {});
        const member = newState.guild.members.cache.get(memberId);
        if (!member?.voice.channelId || !VOCAL_IDS.includes(member.voice.channelId)) return;
        await msg.edit(`**${memberNom}** attend depuis **30 minutes** en vocal... Quelqu'un ? 👀`).catch(() => {});
    }, 30 * 60 * 1000);

    const t2 = setTimeout(async () => {
        const member = newState.guild.members.cache.get(memberId);
        if (!member?.voice.channelId || !VOCAL_IDS.includes(member.voice.channelId)) return;
        await msg.edit(`**${memberNom}** attend depuis **1 heure** en vocal... C'est long quand même. 👀`).catch(() => {});
    }, 60 * 60 * 1000);

    const t3 = setTimeout(async () => {
        const member = newState.guild.members.cache.get(memberId);
        if (!member?.voice.channelId || !VOCAL_IDS.includes(member.voice.channelId)) return;
        await msg.edit(`**${memberNom}** attend depuis **2 heures** en vocal. Y a vraiment personne là ? 👀`).catch(() => {});
    }, 120 * 60 * 1000);

    vocalMessages.set(GUILD_ID, { message: msg, memberId, channelName, timeouts: [t1, t2, t3] });
});

client.login(process.env.TOKEN)
