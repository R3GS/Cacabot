require('dotenv').config();
const JSONBIN_ID = '6a08f315adc21f119aaed5c7';
const JSONBIN_KEY = '$2a$10$4aNH8UsrNWZXAfraECrYp.yAWPzFvnOY7EAc8oifTNLrpfN3dnRuq';
const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${JSONBIN_ID}`;

let topData = { messages: {} };
let birthdayData = { birthdays: {} };
let dailyData = {};
let weeklyData = {};
let monthlyData = {};

async function loadAll() {
    try {
        const res = await fetch(JSONBIN_URL + '/latest', {
            headers: { 'X-Master-Key': JSONBIN_KEY }
        });
        const json = await res.json();
        topData = { messages: json.record.messages ?? {} };
        birthdayData = { birthdays: json.record.birthdays ?? {} };
        dailyData = json.record.daily ?? {};
        weeklyData = json.record.weekly ?? {};
        monthlyData = json.record.monthly ?? {};
        console.log('\u2705 Donn\u00e9es charg\u00e9es depuis JSONBin');
    } catch (err) {
        console.error('Erreur chargement JSONBin:', err);
    }
}

let lastSaveTime = null;
let messagesSinceLastSave = 0;

async function saveAll() {
    try {
        await fetch(JSONBIN_URL, {
            method: 'PUT',
            headers: { 'X-Master-Key': JSONBIN_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: topData.messages, birthdays: birthdayData.birthdays, daily: dailyData, weekly: weeklyData, monthly: monthlyData })
        });
    } catch (err) {
        console.error('Erreur sauvegarde JSONBin:', err);
    }
}

setInterval(() => saveAll(), 60 * 60 * 1000);

// Aliases pour compatibilite
const saveTop = saveAll;
const saveBirthdays = saveAll;

const BIRTHDAY_CHANNEL_ID = '720057528867618909';
const BIRTHDAY_GIF = 'https://cdn.discordapp.com/attachments/1128032964924670053/1505358556851863583/jdg-joueur-du-grenier.gif';

async function checkBirthdays() {
    const now = new Date();
    const today = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}`;
    for (const [userId, date] of Object.entries(birthdayData.birthdays)) {
        if (date === today) {
            for (const guild of client.guilds.cache.values()) {
                const channel = guild.channels.cache.get(BIRTHDAY_CHANNEL_ID);
                if (!channel) continue;
                await channel.send(`<@${userId}> JOYEUX ANNIVERSAIRE !!! \ud83c\udf89\ud83c\udf89\ud83c\udf89`);
                await channel.send(BIRTHDAY_GIF);
            }
        }
    }
}

const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions
    ]
});

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

    if (command === "!help") {
        return {
            data: new EmbedBuilder()
                .setColor(0x00ffff)
                .setTitle("\ud83d\udca9 AIDE \u00c0 CACABOT")
                .setDescription("Hey ! Voici Cacabot, qui, malgr\u00e9 son nom peu glorieux, offre de multiples commandes qui seront le Graal des gens qui aiment s'ennuyer !\n\nPour d\u00e9couvrir les diff\u00e9rentes commandes disponibles de Cacabot, choisis l'une des cat\u00e9gories ci-dessous !")
        };
    }

    // =========================
    //     COMMANDES UTILITAIRES
    // =========================

    if (raw.toLowerCase().match(/!aternos\b/)) {
        return "L'IP actuelle du serveur Minecraft de Rega\u00efa est : **papierprout.aternos.me**";
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
            "https://cdn.discordapp.com/attachments/720079691041472572/1505409860970217574/epsys-dance.gif"
        ];

        return gifs[Math.floor(Math.random() * gifs.length)];
    }

    // =========================
    //         !CHOIX
    // =========================

    if (command === "!choix") {

        if (Math.random() < 0.1) {
            const texte = raw.replace(/^!choix\s*/i, "").trim();
            if (texte.length > 0) {
                return `"${texte}" \u261d\ufe0f\ud83e\udd13\nNon tais-toi et oublie cette id\u00e9e stp`;
            }
        }

        const reponses = [
            "Oui, mais le monde n'est pas encore pr\u00eat.", "Non. Mauvaise id\u00e9e de base.", "Oui, mais t'assumes.", "Franchement je sais pas mais \u00e7a sent la merde.",
            "Oui mais \u00e7a va mal finir.", "Non mais tu vas quand m\u00eame le faire donc bon.", "Non vas te faire enculer.", "J'ai demand\u00e9 \u00e0 ma maman... Elle a dit oui.",
            "ABSOLUMENT!", "Euuuh... Non ?", "C'est quoi cette question de con encore ? Non.", "Oui, oui, oui et encore oui !", "Piti\u00e9 oui.", "Piti\u00e9 non.",
            "Mange tes morts \u00e0 la place de poser ce genre de questions.", "Totalement... Sauf que non, j'ai menti.", "Vous pensez ? Moi j'pense pas. C'est mon avis.",
            "Affirmatif.", "Oui je pensent.", "Ouient.", "Oui (stiti).", "\u00c9-VI-DEM-MENT", "Bah oui t'es d\u00e9bile ou quoi?", "Well yes, but actually no.",
            "Alors... Je savais la r\u00e9ponse, mais j'ai oubli\u00e9...", "Tu crois jsuis Akinator fdp?", "Peut-\u00eatreeeee.", "F\u00fbt un temps, on tuait des gens pour des questions moins connes que \u00e7a.",
            "Non + pas lu + ratio + ntm", "nn", "oe", "https://tenor.com/view/ui-jday-mister-jd-gif-25079300", "https://tenor.com/view/mais-oui-seb-jdg-mais-oui-gif-19057953",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1504924989781053581/vous-pensez-moi-je-pense-pas.gif"
        ];

        return reponses[Math.floor(Math.random() * reponses.length)];
    }

    // =========================
    //         !ANIMAL
    // =========================

    if (command === "!animal") {
        return { needsMention: true };
    }

    // =========================
    //         !KISS
    // =========================

    if (command === "!kiss") {
        return { needsKiss: true };
    }

    // =========================
    //         !HUG
    // =========================

    if (command === "!hug") {
        return { needsHug: true };
    }

    // =========================
    //         !DANSE
    // =========================

    if (command === "!danse") {
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

    if (command === "!bang") {
        return { needsBang: true };
    }

    // =========================
    //         !PUNCH
    // =========================

    if (command === "!punch") {
        return { needsPunch: true };
    }

    // =========================
    //         !DIE
    // =========================

    if (command === "!explode") {
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

    if (command === "!profil") {
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

    if (command === "!save") {
        return { needsSave: true };
    }

    if (command === "!helpx") {
        return { needsHelpx: true };
    }

    if (command === "!last") {
        return { needsLast: true };
    }

    if (command === "!say") {
        return { needsSay: true };
    }

    if (command === "!rappel") {
        return { needsRappel: true };
    }

    if (command === "!ping") {
        return { needsPing: true };
    }

    if (command === "!info") {
        return { needsInfo: true };
    }

    if (command === "!serveur") {
        return { needsServeur: true };
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
    if (cleaned.includes("j ai menti") || cleaned.includes("jai menti")) return { files: ["https://cdn.discordapp.com/attachments/1480756332373213275/1505656212199309543/jai_menti.mp3"] };
    if (cleaned.includes("absolute cacabot")) return "https://media.discordapp.net/attachments/1504056056169369722/1505371569986474175/image.png";
    if (cleaned.includes("henry tran") || cleaned.includes("singapour")) {
        const videos = [
            "https://cdn.discordapp.com/attachments/1128032964924670053/1504609617638854817/SINGAPOUR_1.mp4",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1504609645313134824/SINGAPOUR_2.mp4"
        ];
        return Math.random() < 0.5 ? videos[0] : videos[1];
    }
    if (cleaned.includes("ou quoi")) return reply("Ou feur");
    if (cleaned.includes("avec quoi")) return reply("Avec feur");
    if (cleaned.endsWith("oui")) return reply("Stiti");
    if (
        (cleaned.includes("cacabot") || cleaned.includes("caca bot") || raw.includes("1503495713097519355")) &&
        (cleaned.includes("jtm") || cleaned.includes("je t aime") || cleaned.includes("je taime") || cleaned.includes("jt aime"))
    ) return { needsJtm: true };

    if (cleaned.includes("joyeux anniversaire") || cleaned.includes("bon anniversaire") || cleaned.includes("joyeux anniv") || cleaned.includes("bon anniv")) {
        return "https://cdn.discordapp.com/attachments/1128032964924670053/1505358556851863583/jdg-joueur-du-grenier.gif";
    }

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
    if (cleaned.includes("avec qui")) return reply("Avec quette");
    if (cleaned.includes("pour quoi faire")) return reply("Pour faire feur");
    if (cleaned.includes("pour quoi")) return reply("Pour feur");
    if (cleaned.includes("pour qui")) return reply("Pour quette");
    if (cleaned.includes("pourquoi")) return reply("Pourfeur");
    if (cleaned.includes("c est a quoi")) return reply("C'est \u00e0 feur");
    if (cleaned.includes("c est a qui")) return reply("C'est \u00e0 quette");
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
    if (cleaned.includes("markiplier") || cleaned.includes("thumbs up")) return "https://tenor.com/view/markiplier-mark-thumbs-up-nice-job-good-job-gif-25373350";
    if (cleaned.endsWith("non")) return reply("Bril");
    if (cleaned.endsWith("bite")) return reply("Quoicoubite");
    if (cleaned.includes("c est qui") || cleaned.includes("cest qui")) return reply("C'est quette");
    if (cleaned.includes("cest quoi")) return reply("C'est feur");
    if (cleaned.includes("de quoi")) return reply("De feur");
    if (cleaned.includes("de qui")) return reply("De quette");
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
    if (cleaned === "de") return reply("Trois");
    if (cleaned === "ouient") return reply("Stitient");
    if (cleaned === "pq" || cleaned === "pk") return reply("Pfeur");
    if (cleaned === "a" || cleaned === "ha" || cleaned === "ah") return "B";
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

// =========================
//     CHEH
// =========================

const pendingCheh = new Map();
const cooldowns = new Map();

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
        .setColor(0x51c21d)
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

// =========================
//     LISTENER MESSAGES
// =========================

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Réaction 👋 si le message cite "cacabot" (texte uniquement, pas le ping)
    if (message.content.toLowerCase().includes('cacabot')) {
        message.react('👋').catch(() => {});
    }

    // Ping Cacabot seul -> "Quoi ? (Feur)"
    const strippedMsg = message.content.replace(/<@!?1503495713097519355>/g, '').trim();
    if (message.content.includes('1503495713097519355') && strippedMsg.length === 0) {
        return message.reply('Quoi ? (Feur)');
    }

    // Cheh
    const cleanedCheh = message.content.toLowerCase().trim();
    if (pendingCheh.has(message.channel.id) && (cleanedCheh.includes('ntm') || cleanedCheh.includes('tg') || cleanedCheh.includes('nique ta') || cleanedCheh.includes('ta gueule') || cleanedCheh.includes('mange'))) {
        pendingCheh.delete(message.channel.id);
        return message.reply(CHEH_GIF);
    }

    // Comptage messages pour !top
    if (message.guild && message.guild.id === '720057528351850547') {
        const uid = message.author.id;
        if (!topData.messages[uid]) topData.messages[uid] = 0;
        topData.messages[uid]++;

        // Sauvegarde tous les 75 messages
        messagesSinceLastSave++;
        if (messagesSinceLastSave >= 75) {
            messagesSinceLastSave = 0;
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

    const response = getResponse(message.content);

    if (response === null || response === undefined) return;

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

        const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle(member?.displayName ?? cible.username)
            .setThumbnail(cible.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                { name: '\ud83d\udc64 Pseudo', value: `@${cible.username}`, inline: true },
                { name: '\ud83d\udcac Messages envoy\u00e9s', value: `${nbMessages}`, inline: true },
                { name: '\u200b', value: '\u200b', inline: true },
                { name: '\ud83d\udcc5 Arriv\u00e9e sur le serveur', value: joinedAt, inline: true },
                { name: '\ud83c\udf82 Compte cr\u00e9\u00e9 le', value: createdAt, inline: true },
                { name: '\u200b', value: '\u200b', inline: true },
                { name: '\ud83c\udff7\ufe0f R\u00f4les', value: roles, inline: false }
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
            const channel = message.guild?.channels.cache.get(BIRTHDAY_CHANNEL_ID);
            if (!channel) return message.reply("Salon introuvable !");
            await channel.send(`<@${message.author.id}> JOYEUX ANNIVERSAIRE !!! \ud83c\udf89\ud83c\udf89\ud83c\udf89`);
            await channel.send(BIRTHDAY_GIF);
            return;
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
                        birthdayData.birthdays[user.id] = date;
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
                birthdayData.birthdays[targetUser.id] = date;
                await saveBirthdays();
                return message.reply(`\ud83c\udf82 L'anniversaire de **${nom}** a \u00e9t\u00e9 enregistr\u00e9 le **${date}** !`);
            }

            birthdayData.birthdays[message.author.id] = date;
            await saveBirthdays();
            return message.reply(`\ud83c\udf82 Ton anniversaire a \u00e9t\u00e9 enregistr\u00e9 le **${date}** !`);
        }

        if (sub === 'remove') {
            const query = args.slice(2).join(" ");

            // Sans argument = supprimer le sien
            if (!query) {
                if (!birthdayData.birthdays[message.author.id]) {
                    return message.reply("Tu n'as pas d'anniversaire enregistr\u00e9 !");
                }
                delete birthdayData.birthdays[message.author.id];
                await saveBirthdays();
                return message.reply("\ud83d\uddd1\ufe0f Ton anniversaire a \u00e9t\u00e9 supprim\u00e9 !");
            }

            // Avec argument = supprimer celui de quelqu'un
            const result = findMemberByName(message.guild, query);
            if (result.multiple) {
                askDisambiguation(message, message.guild, result.candidates, async (user) => {
                    if (!birthdayData.birthdays[user.id]) {
                        message.reply("Ce membre n'a pas d'anniversaire enregistr\u00e9 !");
                        return;
                    }
                    delete birthdayData.birthdays[user.id];
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
            if (!birthdayData.birthdays[targetUser.id]) {
                return message.reply("Ce membre n'a pas d'anniversaire enregistr\u00e9 !");
            }
            const nom = message.guild?.members.cache.get(targetUser.id)?.displayName ?? targetUser.username;
            delete birthdayData.birthdays[targetUser.id];
            await saveBirthdays();
            return message.reply(`\ud83d\uddd1\ufe0f L'anniversaire de **${nom}** a \u00e9t\u00e9 supprim\u00e9 !`);
        }

        if (sub === 'show') {
            const date = birthdayData.birthdays[message.author.id];
            if (!date) return message.reply("Tu n'as pas encore enregistr\u00e9 ton anniversaire ! Utilise `!anniversaire set JJ/MM`");
            return message.reply(`\ud83c\udf82 Ton anniversaire est le **${date}** !`);
        }

        if (sub === 'list') {
            const entries = Object.entries(birthdayData.birthdays);
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
            const entries = Object.entries(birthdayData.birthdays);
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

        const anniversaireEmbed = new EmbedBuilder()
            .setColor(0xff69b4)
            .setTitle('\ud83c\udf82 Anniversaire')
            .addFields(
                { name: '!anniversaire set JJ/MM', value: 'Enregistre ton anniversaire.', inline: false },
                { name: '!anniversaire set Pseudo JJ/MM', value: "Enregistre l'anniversaire de quelqu'un.", inline: false },
                { name: '!anniversaire show', value: 'Affiche ton anniversaire enregistr\u00e9.', inline: false },
                { name: '!anniversaire list', value: 'Liste tous les anniversaires du serveur.', inline: false },
                { name: '!anniversaire next', value: 'Affiche le prochain anniversaire du serveur.', inline: false },
                { name: '!anniversaire remove', value: 'Supprime ton anniversaire enregistr\u00e9.', inline: false }
            );
        return message.reply({ embeds: [anniversaireEmbed] });
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

        if (allSorted.length === 0) return message.reply("Pas encore de donn\u00e9es !");

        const PAGE_SIZE = 10;
        const totalPages = Math.ceil(allSorted.length / PAGE_SIZE);
        const authorId = message.author.id;

        const buildTopEmbed = (page) => {
            const start = page * PAGE_SIZE;
            const slice = allSorted.slice(start, start + PAGE_SIZE);
            const medals = ['\ud83e\udd47', '\ud83e\udd48', '\ud83e\udd49'];
            const fields = slice.map(([uid, count], i) => {
                const member = message.guild.members.cache.get(uid);
                const name = member?.displayName ?? 'Membre inconnu';
                const rank = start + i;
                const medal = rank < 3 ? medals[rank] : `**${rank + 1}.**`;
                return { name: `${medal} ${name}`, value: `${count} messages`, inline: false };
            });
            return new EmbedBuilder()
                .setColor(0xffd700)
                .setTitle('\ud83c\udfc6 Classement des membres')
                .addFields(fields)
                .setFooter({ text: `Page ${page + 1}/${totalPages} \u2022 Compt\u00e9 depuis l'initialisation du bot` });
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
        const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle('\ud83d\udc51 Commandes Epsys-Only')
            .setDescription('Commandes exclusivement accessibles par <@436218312574107658>.')
            .addFields(
                { name: '\ud83d\udcdd !setmessages @Membre N', value: 'D\u00e9finir manuellement le nombre de messages d\'un membre.', inline: false },
                { name: '\ud83d\udce3 !say [ID_salon] [message]', value: 'Envoyer un message dans un salon au nom de Cacabot.', inline: false },
                { name: '\ud83d\udcbe !last', value: 'Afficher la date et l\'heure de la derni\u00e8re sauvegarde JSONBin.', inline: false },
                { name: '\ud83d\udd2e !horoscope [ID_salon]', value: 'Forcer l\'envoi de l\'horoscope dans un salon sp\u00e9cifique.', inline: false }
            );
        return message.reply({ embeds: [embed] });
    }

    // !last
    if (response?.needsLast) {
        if (message.author.id !== '436218312574107658') return;
        if (!lastSaveTime) return message.reply('Aucune sauvegarde effectu\u00e9e depuis le d\u00e9marrage.');
        const diff = Date.now() - lastSaveTime;
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        const dateStr = lastSaveTime.toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
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

    // !rappel
    if (response?.needsRappel) {
        const args = message.content.trim().split(/\s+/);
        const isEpsys = message.author.id === '436218312574107658';

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
        setTimeout(async () => {
            try {
                await message.channel.send(`\ud83d\udd14 <@${targetId}> Rappel : **${texte}**`);
            } catch (e) {}
        }, ms);
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

        const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle('\ud83e\udd16 Infos de Cacabot')
            .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                { name: '\ud83d\udcbb Commandes', value: `${nbCommandes}`, inline: true },
                { name: '\ud83d\udcac Messages envoy\u00e9s', value: `${topData.messages['1503495713097519355'] ?? 0}`, inline: true },
                { name: '\u200b', value: '\u200b', inline: true },
                { name: '\ud83d\udc51 Cr\u00e9atrice', value: 'Epsys', inline: true },
                { name: '\ud83e\udd1d Collaboratrice', value: '[BDN](https://bdn-fr.xyz/)', inline: true },
                { name: '\u200b', value: '\u200b', inline: true },
                { name: '\ud83d\udd52 En ligne depuis', value: uptime, inline: false }
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
    if (response?.data) {
        const menu = new StringSelectMenuBuilder()
            .setCustomId(`help_menu_${message.author.id}_${message.id}`)
            .setPlaceholder('Choisis une cat\u00e9gorie')
            .addOptions(
                { label: '\ud83c\udf89 Fun', description: 'Interact, Discussion, Anniversaire, Random', value: 'fun' },
                { label: '\ud83d\udee0 Utilitaire', description: 'Discord, YouTube, Autres', value: 'util' },
            );

        const row = new ActionRowBuilder().addComponents(menu);
        return message.reply({ embeds: [response.data], components: [row] });
    }

    // R\u00e9ponse texte simple
    if (typeof response === "string") {
        if (response.trim().length === 0) return;
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

        return interaction.update({ embeds: [embed], components: [row1, row2] });
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
            const name = member?.displayName ?? 'Membre inconnu';
            const rank = start + i;
            const medal = rank < 3 ? medals[rank] : `**${rank + 1}.**`;
            return { name: `${medal} ${name}`, value: `${count} messages`, inline: false };
        });

        const embed = new EmbedBuilder()
            .setColor(0xffd700)
            .setTitle('\ud83c\udfc6 Classement des membres')
            .addFields(fields)
            .setFooter({ text: `Page ${newPage + 1}/${totalPages} \u2022 Compt\u00e9 depuis l'initialisation du bot` });

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

    if (interaction.isButton() && (interaction.customId.startsWith('anniv_list_chrono_') || interaction.customId.startsWith('anniv_list_classique_'))) {
        const parts = interaction.customId.split('_');
        const ordre = parts[2];
        const authorId = parts[3];
        const currentPage = parseInt(parts[4]) || 0;
        const action = parts[5]; // prev, next, ou switch

        if (interaction.user.id !== authorId) {
            return interaction.reply({ content: "Ce bouton ne t'est pas destin\u00e9 !", ephemeral: true });
        }

        const entries = Object.entries(birthdayData.birthdays);
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

        return interaction.update({ embeds: [embed], components: [row] });
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
    // BOUTON DANCE JOIN (solo)
    // =========================

    if (interaction.isButton() && interaction.customId.startsWith("dance_join_")) {
        const parts = interaction.customId.split("_");
        const originalAuthorId = parts[2];
        const originalAuthorNom = parts.slice(3).join("_");
        const clickerId = interaction.user.id;

        if (clickerId === originalAuthorId) {
            return interaction.reply({ content: "Tu danses d\u00e9j\u00e0 ! \ud83d\udd7a", ephemeral: true });
        }

        const joinNom = interaction.member?.displayName ?? interaction.user.username;
        const embed = buildDanceEmbed(`\ud83d\udc83 **${joinNom}** rejoint **${originalAuthorNom}** sur le dancefloor !`, false);
        await disableButtons(interaction);
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
    // BOUTON EXPLODE WITH
    // =========================

    if (interaction.isButton() && interaction.customId.startsWith('explode_with_')) {
        const parts = interaction.customId.split('_');
        const originalAuthorId = parts[2];
        const originalAuthorNom = parts.slice(3).join('_');

        if (interaction.user.id === originalAuthorId) {
            await disableButtons(interaction);
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
                    { name: "!kiss", value: "Embrassez quelqu'un sur le serveur !" },
                    { name: "!hug", value: "Faites un c\u00e2lin \u00e0 quelqu'un sur le serveur !" },
                    { name: "!danse", value: "Dansez avec quelqu'un sur le serveur !" },
                    { name: "!insult", value: "Insulte quelqu'un du serveur ! (Oui c'est gratuit)" },
                    { name: "!die", value: "Mourez en direct sur le serveur !" },
                    { name: "!ban", value: "Bannir quelqu'un du serveur... symboliquement." },
                    { name: "!bait", value: "Ragebait quelqu'un du serveur, gratuitement." },
                    { name: "!explode", value: "Explose." },
                    { name: "!punch", value: "Frappez quelqu'un sur le serveur !" },
                    { name: "!bang", value: "Tirez sur quelqu'un sur le serveur !" },
                    { name: "!rizz", value: "Rizzez quelqu'un sur le serveur !" },
                    { name: "!rire", value: "Riez un bon coup !" }
                );
        }

        if (value === 'discussion') {
            embed = new EmbedBuilder()
                .setColor(0x6bb5ff)
                .setDescription("# \ud83d\udcac Discussion")
                .addFields(
                    { name: "!question", value: "Lance une question al\u00e9atoire parmi 6 cat\u00e9gories !" },
                    { name: "!choix", value: "Vous avez du mal \u00e0 faire un choix ? Demandez \u00e0 Cacabot." }
                );
        }

        if (value === 'random') {
            embed = new EmbedBuilder()
                .setColor(0xf5f8fa)
                .setDescription("# \ud83d\udca5 Random")
                .addFields(
                    { name: "!destin", value: "Pr\u00e9dit votre destin et fait part des \u00e9v\u00e8nements de votre futur." },
                    { name: "!animal", value: "Devine votre animal spirituel parmi pr\u00e8s de 7000 combinaisons !" },
                    { name: "!epsys", value: "Poste des GIFs al\u00e9atoires d'Epsys, parce que." },
                    { name: "!blague", value: "Lance une blague al\u00e9atoire en 3 cat\u00e9gories !" },
                    { name: "!flip", value: "Pour d\u00e9cider \u00e0 pile ou face !" },
                    { name: "!horoscope", value: "L'horoscope du jour selon Cacabot." }
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
                { label: '\ud83d\udc46 Interact', description: 'kiss, hug, insult, die, ban, bait, explode, punch, bang, rizz, rire, danse', value: 'interact' },
                { label: '\ud83d\udcac Discussion', description: 'question, choix', value: 'discussion' },
                { label: '\ud83c\udf82 Anniversaire', description: 'set, show, list, next', value: 'anniversaire' },
                { label: '\ud83d\udca5 Random', description: 'destin, animal, epsys, flip, blague, horoscope', value: 'random' }
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
    // BOUTON NOUVELLE QUESTION
    // =========================

    if (interaction.isButton() && interaction.customId.startsWith('question_new_')) {
        const authorId = interaction.customId.split('_')[2];
        if (interaction.user.id !== authorId) {
            return interaction.reply({ content: "Ce bouton ne t'est pas destin\u00e9 !", ephemeral: true });
        }

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
        return interaction.update({ embeds: [embed], components: [row] });
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
                    { name: "\ud83d\udcac !actif", value: "Affiche les membres les plus actifs du jour et de la semaine." },
                    { name: "\ud83e\udd16 !info", value: "Affiche les informations de Cacabot." },
                    { name: "\ud83c\udfd3 !ping", value: "Affiche la latence du bot." },
                    { name: "\u23f0 !rappel", value: "Se faire rappeler quelque chose dans X minutes/heures." }
                );
        }

        if (value === 'youtube') {
            embed = new EmbedBuilder()
                .setColor(0xff0000)
                .setDescription("# <:youtube_icon:1505457903585198151> YouTube")
                .setDescription("En construction... \ud83d\udd27");
        }

        if (value === 'autres') {
            embed = new EmbedBuilder()
                .setColor(0x95a5a6)
                .setDescription("# \ud83d\uddd2\ufe0f Autres")
                .addFields(
                    { name: "<:aternos_icon:1505454393049485362> !aternos", value: "Obtenir l'IP du serveur Aternos (Minecraft) de Rega\u00efa." },
                    { name: "\ud83e\udd16 !info", value: "Affiche les informations de Cacabot." },
                    { name: "\ud83c\udfd3 !ping", value: "Affiche la latence du bot." },
                    { name: "\u23f0 !rappel", value: "Se faire rappeler quelque chose dans X minutes/heures." }
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
        const helpAuthorId = interaction.customId.split('_')[3];
        if (interaction.user.id !== helpAuthorId) {
            return interaction.reply({ content: "Ce menu ne t'est pas destin\u00e9 !", ephemeral: true });
        }

        const utilEmbed = new EmbedBuilder()
            .setColor(0x8899a6)
            .setTitle("\ud83d\udee0 Utilitaire")
            .setDescription("<:discord_icon:1505454379669524532> **Discord** \u2014 Commandes relatives au serveur\n<:youtube_icon:1505457903585198151> **YouTube** \u2014 En construction...\n\ud83d\uddd2\ufe0f **Autres** \u2014 Autres commandes non-r\u00e9pertori\u00e9es");

        const utilMenu = new StringSelectMenuBuilder()
            .setCustomId(`help_util_${helpAuthorId}`)
            .setPlaceholder('Choisis une cat\u00e9gorie')
            .addOptions(
                { label: '\ud83d\udcac Discord', description: 'serveur, profil, avatar, top, actif', value: 'discord' },
                { label: '\ud83d\uddd2\ufe0f Autres', description: 'aternos, info, ping, rappel', value: 'autres' }
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
                    { label: '\ud83d\udc46 Interact', description: 'kiss, hug, insult, die, ban, bait, explode, punch, bang, rizz, rire, danse', value: 'interact' },
                    { label: '\ud83d\udcac Discussion', description: 'question, choix', value: 'discussion' },
                    { label: '\ud83c\udf82 Anniversaire', description: 'set, show, list, next', value: 'anniversaire' },
                    { label: '\ud83d\udca5 Random', description: 'destin, animal, epsys, flip, blague, horoscope', value: 'random' }
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
                .setDescription("<:discord_icon:1505454379669524532> **Discord** \u2014 Commandes relatives au serveur\n<:youtube_icon:1505457903585198151> **YouTube** \u2014 En construction...\n\ud83d\uddd2\ufe0f **Autres** \u2014 Autres commandes non-r\u00e9pertori\u00e9es");

            const utilMenu = new StringSelectMenuBuilder()
                .setCustomId(`help_util_${helpAuthorId}`)
                .setPlaceholder('Choisis une cat\u00e9gorie')
                .addOptions(
                    { label: '\ud83d\udcac Discord', description: 'serveur, profil, avatar, top, actif', value: 'discord' },
                    { label: '\u25b6\ufe0f YouTube', description: 'En construction...', value: 'youtube' },
                    { label: '\ud83d\uddd2\ufe0f Autres', description: 'aternos, info, ping, rappel', value: 'autres' }
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
                { label: '\ud83d\udee0 Utilitaire', description: 'Discord, YouTube, Autres', value: 'util' }
            );
        const row = new ActionRowBuilder().addComponents(menu);
        return interaction.update({ embeds: [embed], components: [row] });
    }
    } catch (err) {
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

client.once('ready', async () => {
    console.log(`\u2705 ${client.user.tag} est connect\u00e9`);
    await loadAll();
    cleanOldData();
    for (const guild of client.guilds.cache.values()) {
        await guild.members.fetch().catch(() => {});
    }
    console.log(`\u2705 Membres fetch\u00e9s`);

    const msUntilMidnight = () => {
        const now = new Date();
        const midnight = new Date(now);
        midnight.setHours(24, 0, 0, 0);
        return midnight - now;
    };
    setTimeout(function scheduleCheck() {
        checkBirthdays();
scheduleHoroscopeQuotidien();
        setInterval(checkBirthdays, 24 * 60 * 60 * 1000);
    }, msUntilMidnight());
});



// =========================
//   HOROSCOPE AUTOMATIQUE
// =========================

function scheduleHoroscopeQuotidien() {
    const now = new Date();
    // Calculer le prochain 8h heure de Paris
    const parisFmt = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: 'numeric', minute: 'numeric' });
    const parisNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    const next8h = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    next8h.setHours(8, 0, 0, 0);
    if (next8h <= parisNow) next8h.setDate(next8h.getDate() + 1);
    // Convertir en UTC
    const parisOffset = now - parisNow;
    const delay = next8h - parisNow + parisOffset;

    setTimeout(async () => {
        try {
            const channel = await client.channels.fetch('1505820995028516874');
            if (!channel) return;

            const now2 = new Date();
            const dateKey = now2.getFullYear() * 10000 + (now2.getMonth() + 1) * 100 + now2.getDate();
            const dateStr = now2.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

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

            const titres = [
                '# HOROSCOPE DU JOUR \ud83d\udd2e',
                "# L'ORACLE A PARL\u00c9 \ud83d\udd2e",
                '# LES ASTRES ONT PARL\u00c9 \ud83d\udd2e',
                '# LES \u00c9TOILES ONT PARL\u00c9 \ud83d\udd2e',
                "# L'UNIVERS NOUS ENVOIE SES SIGNES \ud83d\udd2e",
            ];
            const titre = titres[Math.floor(Math.random() * titres.length)];
            await channel.send(titre);
            await channel.send({ embeds: [embed] });
        } catch (err) {
            console.error('Erreur horoscope automatique:', err);
        }
        scheduleHoroscopeQuotidien();
    }, delay);

    const h = Math.floor(delay / 3600000);
    const m = Math.floor((delay % 3600000) / 60000);
    console.log(`\u23f0 Prochain horoscope automatique dans ${h}h${m}m`);
}

// =========================
//     LISTENER REACTIONS
// =========================

client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;
    if (reaction.emoji.name !== '\uD83D\uDD95' && reaction.emoji.name !== 'middle_finger') return;

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


// =========================
//   LISTENER MEMBER JOIN
// =========================

client.on('guildMemberAdd', async (member) => {
    if (!topData.messages[member.id]) {
        topData.messages[member.id] = 0;
        saveAll();
        console.log(`\u2705 Nouveau membre : ${member.displayName} ajouté au top`);
    }
});

client.login(process.env.TOKEN);