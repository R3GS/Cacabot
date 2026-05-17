require('dotenv').config();
const JSONBIN_ID = '6a08f315adc21f119aaed5c7';
const JSONBIN_KEY = '$2a$10$4aNH8UsrNWZXAfraECrYp.yAWPzFvnOY7EAc8oifTNLrpfN3dnRuq';
const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${JSONBIN_ID}`;

let topData = { messages: {} };

async function loadTop() {
    try {
        const res = await fetch(JSONBIN_URL + '/latest', {
            headers: { 'X-Master-Key': JSONBIN_KEY }
        });
        const json = await res.json();
        topData = json.record;
        console.log('\u2705 topData charg\u00e9 depuis JSONBin');
    } catch (err) {
        console.error('Erreur chargement JSONBin:', err);
    }
}

async function saveTop() {
    try {
        await fetch(JSONBIN_URL, {
            method: 'PUT',
            headers: { 'X-Master-Key': JSONBIN_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify(topData)
        });
    } catch (err) {
        console.error('Erreur sauvegarde JSONBin:', err);
    }
}

setInterval(() => saveTop(), 5 * 60 * 1000);

const BIRTHDAY_BIN_ID = '6a0904bf250b1311c35f23a7';
const BIRTHDAY_BIN_URL = `https://api.jsonbin.io/v3/b/${BIRTHDAY_BIN_ID}`;
let birthdayData = { birthdays: {} };

async function loadBirthdays() {
    try {
        const res = await fetch(BIRTHDAY_BIN_URL + '/latest', {
            headers: { 'X-Master-Key': JSONBIN_KEY }
        });
        const json = await res.json();
        birthdayData = json.record;
        console.log('\u2705 Anniversaires charg\u00e9s depuis JSONBin');
    } catch (err) {
        console.error('Erreur chargement anniversaires:', err);
    }
}

async function saveBirthdays() {
    try {
        await fetch(BIRTHDAY_BIN_URL, {
            method: 'PUT',
            headers: { 'X-Master-Key': JSONBIN_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify(birthdayData)
        });
    } catch (err) {
        console.error('Erreur sauvegarde anniversaires:', err);
    }
}

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
        GatewayIntentBits.GuildMembers
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

    if (raw.toLowerCase().match(/!discord\b/)) {
        return "Si vous souhaitez inviter vos ami.es, voici le lien d'invitation du serveur Discord :\n**https://discord.com/invite/maAbUYb**";
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
            "https://tenor.com/view/r3gs_-capuche-love-hearts-gif-22642553",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1478480836683759636/ezgif-4910f713e8f8f838.gif"
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

    if (command === "!insulte") {
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

    if (cleaned.includes("henry tran") || cleaned.includes("singapour")) {
        const videos = [
            "https://cdn.discordapp.com/attachments/1128032964924670053/1504609617638854817/SINGAPOUR_1.mp4",
            "https://cdn.discordapp.com/attachments/1128032964924670053/1504609645313134824/SINGAPOUR_2.mp4"
        ];
        return Math.random() < 0.5 ? videos[0] : videos[1];
    }
    if (cleaned.includes("avec quoi")) return reply("Avec feur");
    if (cleaned.endsWith("oui")) return reply("Stiti");
    if (cleaned.includes("bac blanc")) return "https://cdn.discordapp.com/attachments/720057528867618909/1504075425985466481/1778669924015-18e38746e64899fb.png";
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
    if (cleaned.includes(" feur ") || cleaned === "feur" || cleaned.startsWith("feur ") || cleaned.endsWith(" feur")) return "\"Feur\" ? Tu veux me voler mon job ?";

    // =========================
    // MESSAGES EXACTS UNIQUEMENT
    // =========================

    if (cleaned === "hein") return reply("Deux");
    if (cleaned === "de") return reply("Trois");
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
//     LISTENER MESSAGES
// =========================

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Comptage messages pour !top
    if (message.guild) {
        const uid = message.author.id;
        if (!topData.messages[uid]) topData.messages[uid] = 0;
        topData.messages[uid]++;
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
            return message.reply("Euuh... Tu veux embrasser qui du coup ?").then(msg => setTimeout(() => { msg.delete().catch(() => {}); message.delete().catch(() => {}); }, 6000));
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
            return message.reply("Euuh... Tu veux c\u00e2liner qui du coup ?").then(msg => setTimeout(() => { msg.delete().catch(() => {}); message.delete().catch(() => {}); }, 6000));
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
            return message.reply({ embeds: [embed] });
        }

        const cibleNom = message.guild?.members.cache.get(cible.id)?.displayName ?? cible.username;

        if (cible.id === client.user.id) {
            const embed = buildDanceEmbed(`\ud83d\udd7a **${auteurNom}** danse avec moi !`, false);
            return message.reply({ embeds: [embed] });
        }

        const embed = buildDanceEmbed(`\ud83d\udd7a **${auteurNom}** danse avec **${cibleNom}** !`, false);
        const danceBackButton = new ButtonBuilder()
            .setCustomId(`dance_back_${message.author.id}_${cible.id}_${auteurNom}`)
            .setLabel("\ud83d\udd7a Rejoindre la danse")
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
            return message.reply("Mentionne quelqu'un pour l'insulter !").then(msg => setTimeout(() => { msg.delete().catch(() => {}); message.delete().catch(() => {}); }, 6000));
        }

        if (cible.id === message.author.id) {
            return message.reply("Tu ne peux pas t'insulter toi-m\u00eame... Mentionne quelqu'un plut\u00f4t !").then(msg => setTimeout(() => { msg.delete().catch(() => {}); message.delete().catch(() => {}); }, 6000));
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
            return message.reply("Choisis quelqu'un que tu veux rizz !").then(msg => setTimeout(() => { msg.delete().catch(() => {}); message.delete().catch(() => {}); }, 6000));
        }

        if (cible.id === message.author.id) {
            return message.reply("Tu ne peux pas te rizz toi-m\u00eame !").then(msg => setTimeout(() => { msg.delete().catch(() => {}); message.delete().catch(() => {}); }, 6000));
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
            return message.reply("Mentionne la personne sur qui tu veux tirer !").then(msg => setTimeout(() => { msg.delete().catch(() => {}); message.delete().catch(() => {}); }, 6000));
        }

        if (cible.id === message.author.id) {
            return message.reply("\u00c9vite de te tirer dessus :(").then(msg => setTimeout(() => { msg.delete().catch(() => {}); message.delete().catch(() => {}); }, 6000));
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
            return message.reply("Mentionne quelqu'un que tu veux frapper !").then(msg => setTimeout(() => { msg.delete().catch(() => {}); message.delete().catch(() => {}); }, 6000));
        }

        if (cible.id === message.author.id) {
            return message.reply("Tu ne peux pas te frapper toi-m\u00eame ! 'Fin si mais... Ne le fais pas.").then(msg => setTimeout(() => { msg.delete().catch(() => {}); message.delete().catch(() => {}); }, 6000));
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

    // !die
    if (response?.needsDie) {
        const cible = message.mentions.users.first();
        const auteurNom = message.member?.displayName ?? message.author.username;

        if (cible && cible.id === client.user.id) {
            return message.reply("Tu veux \u00abme mourir\u00bb ? Non merci.").then(msg => setTimeout(() => { msg.delete().catch(() => {}); message.delete().catch(() => {}); }, 6000));
        }

        if (cible && cible.id !== message.author.id) {
            return message.reply(`Tu ne peux pas \u00abmourir quelqu'un\u00bb ce n'est pas possible, **${auteurNom}**`).then(msg => setTimeout(() => { msg.delete().catch(() => {}); message.delete().catch(() => {}); }, 6000));
        }

        const embed = buildDieEmbed(`\u2620\ufe0f **${auteurNom}** meurt...`);

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

        const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle(member?.displayName ?? cible.username)
            .setThumbnail(cible.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                { name: '\ud83d\udc64 Pseudo', value: `@${cible.username}`, inline: true },
                { name: '\ud83c\udd94 ID', value: cible.id, inline: true },
                { name: '\u200b', value: '\u200b', inline: true },
                { name: '\ud83d\udcc5 Arriv\u00e9e sur le serveur', value: joinedAt, inline: true },
                { name: '\ud83c\udf82 Compte cr\u00e9\u00e9 le', value: createdAt, inline: true },
                { name: '\u200b', value: '\u200b', inline: true },
                { name: '\ud83c\udff7\ufe0f R\u00f4les', value: roles, inline: false }
            );

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

    // !anniversaire
    if (response?.needsAnniversaire) {
        const isTest = message.content.trim().split(/\s+/)[0].toLowerCase() === '!anniversairetest';
        const args = message.content.trim().split(/\s+/);
        const sub = args[1]?.toLowerCase();

        if (isTest) {
            const channel = message.guild?.channels.cache.get(BIRTHDAY_CHANNEL_ID);
            if (!channel) return message.reply("Salon introuvable !").then(msg => setTimeout(() => { msg.delete().catch(() => {}); message.delete().catch(() => {}); }, 6000));
            await channel.send(`<@${message.author.id}> JOYEUX ANNIVERSAIRE !!! \ud83c\udf89\ud83c\udf89\ud83c\udf89`);
            await channel.send(BIRTHDAY_GIF);
            return;
        }

        if (sub === 'set') {
            const date = args[2];
            if (!date || !/^\d{2}\/\d{2}$/.test(date)) {
                return message.reply("Format invalide ! Utilise `!anniversaire set JJ/MM`").then(msg => setTimeout(() => { msg.delete().catch(() => {}); message.delete().catch(() => {}); }, 6000));
            }
            birthdayData.birthdays[message.author.id] = date;
            await saveBirthdays();
            return message.reply(`\ud83c\udf82 Ton anniversaire a \u00e9t\u00e9 enregistr\u00e9 le **${date}** !`);
        }

        if (sub === 'show') {
            const date = birthdayData.birthdays[message.author.id];
            if (!date) return message.reply("Tu n'as pas encore enregistr\u00e9 ton anniversaire ! Utilise `!anniversaire set JJ/MM`").then(msg => setTimeout(() => { msg.delete().catch(() => {}); message.delete().catch(() => {}); }, 6000));
            return message.reply(`\ud83c\udf82 Ton anniversaire est le **${date}** !`);
        }

        if (sub === 'list') {
            const entries = Object.entries(birthdayData.birthdays);
            if (entries.length === 0) return message.reply("Aucun anniversaire enregistr\u00e9 !").then(msg => setTimeout(() => { msg.delete().catch(() => {}); message.delete().catch(() => {}); }, 6000));
            const sorted = entries.sort((a, b) => {
                const [da, ma] = a[1].split('/').map(Number);
                const [db, mb] = b[1].split('/').map(Number);
                return ma !== mb ? ma - mb : da - db;
            });
            const lines = sorted.map(([uid, date]) => {
                const member = message.guild?.members.cache.get(uid);
                const name = member?.displayName ?? uid;
                return `\ud83c\udf82 **${name}** \u2014 ${date}`;
            }).join('\n');
            const embed = new EmbedBuilder()
                .setColor(0xff69b4)
                .setTitle('\ud83c\udf82 Anniversaires du serveur')
                .setDescription(lines);
            return message.reply({ embeds: [embed] });
        }

        if (sub === 'next') {
            const entries = Object.entries(birthdayData.birthdays);
            if (entries.length === 0) return message.reply("Aucun anniversaire enregistr\u00e9 !").then(msg => setTimeout(() => { msg.delete().catch(() => {}); message.delete().catch(() => {}); }, 6000));
            const now = new Date();
            const toDate = (str) => {
                const [d, m] = str.split('/').map(Number);
                const year = (m < now.getMonth() + 1 || (m === now.getMonth() + 1 && d < now.getDate())) ? now.getFullYear() + 1 : now.getFullYear();
                return new Date(year, m - 1, d);
            };
            const next = entries.sort((a, b) => toDate(a[1]) - toDate(b[1]))[0];
            const member = message.guild?.members.cache.get(next[0]);
            const name = member?.displayName ?? `<@${next[0]}>`;
            return message.reply(`\ud83c\udf82 Le prochain anniversaire est celui de **${name}** le **${next[1]}** !`);
        }

        return message.reply("Sous-commandes disponibles : `set JJ/MM`, `show`, `list`, `next`").then(msg => setTimeout(() => { msg.delete().catch(() => {}); message.delete().catch(() => {}); }, 6000));
    }

    // !top
    if (response?.needsTop) {
        const sorted = Object.entries(topData.messages)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        if (sorted.length === 0) {
            return message.reply("Pas encore de donn\u00e9es !").then(msg => setTimeout(() => { msg.delete().catch(() => {}); message.delete().catch(() => {}); }, 6000));
        }

        const medals = ['\ud83e\udd47', '\ud83e\udd48', '\ud83e\udd49'];
        const fields = await Promise.all(sorted.map(async ([uid, count], i) => {
            const member = message.guild.members.cache.get(uid);
            const name = member?.displayName ?? `Membre inconnu`;
            const medal = medals[i] ?? `**${i + 1}.**`;
            return { name: `${medal} ${name}`, value: `${count} messages`, inline: false };
        }));

        const embed = new EmbedBuilder()
            .setColor(0xffd700)
            .setTitle('\ud83c\udfc6 Top 10 des membres les plus actifs')
            .addFields(fields)
            .setFooter({ text: "Compt\u00e9 depuis l'initialisation du bot" });

        return message.reply({ embeds: [embed] });
    }

    // !setmessages
    if (response?.needsSetMessages) {
        const cible = message.mentions.users.first();
        const args = message.content.trim().split(/\s+/);
        const count = parseInt(args[args.length - 1]);

        if (!cible || isNaN(count)) {
            return message.reply("Usage : `!setmessages @Membre NombreDeMessages`").then(msg => setTimeout(() => { msg.delete().catch(() => {}); message.delete().catch(() => {}); }, 6000));
        }

        topData.messages[cible.id] = count;
        saveTop(topData);

        const nom = message.guild?.members.cache.get(cible.id)?.displayName ?? cible.username;
        return message.reply(`\u2705 **${nom}** : ${count} messages enregistr\u00e9s !`).then(msg => setTimeout(() => { msg.delete().catch(() => {}); message.delete().catch(() => {}); }, 6000));
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
            .setFooter({ text: 'Regaia' });

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
            .setCustomId(`help_menu_${message.author.id}`)
            .setPlaceholder('Choisis une cat\u00e9gorie')
            .addOptions(
                { label: '\ud83c\udf89 Fun', description: 'animal, destin, epsys, choix, kiss, hug, danse, insulte, die, punch, bang, rizz, rire, question', value: 'fun' },
                { label: '\ud83d\udee0 Utilitaire', description: 'discord, aternos, serveur, profil, avatar', value: 'util' },
            );

        const row = new ActionRowBuilder().addComponents(menu);
        return message.reply({ embeds: [response.data], components: [row] });
    }

    // R\u00e9ponse texte simple
    if (typeof response === "string") {
        if (response.trim().length === 0) return;
        return message.reply({ content: response });
    }
});

// =========================
//     LISTENER INTERACTIONS
// =========================

client.on('interactionCreate', async (interaction) => {
    try {

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
        return interaction.reply({ embeds: [embed] });
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
        const helpAuthorId = interaction.customId.split('_')[2];
        if (interaction.user.id !== helpAuthorId) {
            return interaction.reply({ content: "Ce menu ne t'est pas destin\u00e9 !", ephemeral: true });
        }

        const value = interaction.values[0];
        let embed;

        if (value === 'interact') {
            embed = new EmbedBuilder()
                .setColor(0xff6b6b)
                .setDescription("# \ud83d\udc46 Interact")
                .addFields(
                    { name: "!kiss", value: "Embrassez quelqu'un sur le serveur !" },
                    { name: "!hug", value: "Faites un c\u00e2lin \u00e0 quelqu'un sur le serveur !" },
                    { name: "!danse", value: "Dansez avec quelqu'un sur le serveur !" },
                    { name: "!insulte", value: "Insulte quelqu'un du serveur ! (Oui c'est gratuit)" },
                    { name: "!die", value: "Mourez en direct sur le serveur !" },
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
                .setColor(0xa855f7)
                .setDescription("# \ud83d\udca5 Random")
                .addFields(
                    { name: "!destin", value: "Pr\u00e9dit votre destin et fait part des \u00e9v\u00e8nements de votre futur." },
                    { name: "!animal", value: "Devine votre animal spirituel parmi pr\u00e8s de 7000 combinaisons !" },
                    { name: "!epsys", value: "Poste des GIFs al\u00e9atoires d'Epsys, parce que." }
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
            .setCustomId(`help_fun_back_${helpAuthorId}`)
            .setLabel('\u2b05 Retour')
            .setStyle(ButtonStyle.Secondary);
        const backRow = new ActionRowBuilder().addComponents(backButton);
        return interaction.update({ embeds: [embed], components: [backRow] });
    }

    // =========================
    // BOUTON RETOUR FUN
    // =========================

    if (interaction.isButton() && interaction.customId.startsWith('help_fun_back_')) {
        const helpAuthorId = interaction.customId.split('_')[3];
        if (interaction.user.id !== helpAuthorId) {
            return interaction.reply({ content: "Ce menu ne t'est pas destin\u00e9 !", ephemeral: true });
        }

        const funEmbed = new EmbedBuilder()
            .setColor(0xffcc00)
            .setDescription("# \ud83c\udf89 Fun\n*Toutes les commandes pour animer le serveur et faire des trucs inutiles mais dr\u00f4les.*\n\n\ud83d\udc46 **Interact** \u2014 Interagis avec les membres du serveur\n\ud83d\udcac **Discussion** \u2014 Lance des d\u00e9bats ou laisse le hasard d\u00e9cider\n\ud83c\udf82 **Anniversaire** \u2014 Les commandes pour les anniversaires des membres du serveur !\n\ud83d\udca5 **Random** \u2014 Commandes al\u00e9atoires et surprises");

        const funMenu = new StringSelectMenuBuilder()
            .setCustomId(`help_fun_${helpAuthorId}`)
            .setPlaceholder('Choisis une cat\u00e9gorie')
            .addOptions(
                { label: '\ud83d\udc46 Interact', description: 'kiss, hug, insulte, die, punch, bang, rizz, rire, danse', value: 'interact' },
                { label: '\ud83d\udcac Discussion', description: 'question, choix', value: 'discussion' },
                { label: '\ud83c\udf82 Anniversaire', description: 'set, show, list, next', value: 'anniversaire' },
                { label: '\ud83d\udca5 Random', description: 'destin, animal, epsys', value: 'random' }
            );

        const funBackButton = new ButtonBuilder()
            .setCustomId(`help_back_${helpAuthorId}`)
            .setLabel('\u2b05 Retour')
            .setStyle(ButtonStyle.Secondary);
        const funRow = new ActionRowBuilder().addComponents(funMenu);
        const funBackRow = new ActionRowBuilder().addComponents(funBackButton);
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
    // MENU SELECT
    // =========================

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('help_menu_')) {
        const helpAuthorId = interaction.customId.split('_')[2];
        if (interaction.user.id !== helpAuthorId) {
            return interaction.reply({ content: "Ce menu ne t'est pas destin\u00e9 !", ephemeral: true });
        }

        const value = interaction.values[0];
        let embed;

        if (value === 'fun') {
            const funEmbed = new EmbedBuilder()
                .setColor(0xffcc00)
                .setDescription("# \ud83c\udf89 Fun\n*Toutes les commandes pour animer le serveur et faire des trucs inutiles mais dr\u00f4les.*\n\n\ud83d\udc46 **Interact** \u2014 Interagis avec les membres du serveur\n\ud83d\udcac **Discussion** \u2014 Lance des d\u00e9bats ou laisse le hasard d\u00e9cider\n\ud83c\udf82 **Anniversaire** \u2014 Les commandes pour les anniversaires des membres du serveur !\n\ud83d\udca5 **Random** \u2014 Commandes al\u00e9atoires et surprises");

            const funMenu = new StringSelectMenuBuilder()
                .setCustomId(`help_fun_${helpAuthorId}`)
                .setPlaceholder('Choisis une cat\u00e9gorie')
                .addOptions(
                    { label: '\ud83d\udc46 Interact', description: 'kiss, hug, insulte, die, punch, bang, rizz, rire, danse', value: 'interact' },
                    { label: '\ud83d\udcac Discussion', description: 'question, choix', value: 'discussion' },
                    { label: '\ud83c\udf82 Anniversaire', description: 'set, show, list, next', value: 'anniversaire' },
                    { label: '\ud83d\udca5 Random', description: 'destin, animal, epsys', value: 'random' }
                );

            const funBackButton = new ButtonBuilder()
                .setCustomId(`help_back_${helpAuthorId}`)
                .setLabel('\u2b05 Retour')
                .setStyle(ButtonStyle.Secondary);
            const funRow = new ActionRowBuilder().addComponents(funMenu);
            const funBackRow = new ActionRowBuilder().addComponents(funBackButton);
            return interaction.update({ embeds: [funEmbed], components: [funRow, funBackRow] });
        }

        if (value === 'util') {
            embed = new EmbedBuilder()
                .setColor(0x3498db)
                .setDescription("# \ud83d\udee0 Utilitaire")
                .addFields(
                    { name: "!discord", value: "Obtenir le lien officiel d'invitation de Rega\u00efa." },
                    { name: "!aternos", value: "Obtenir l'IP du serveur Aternos (Minecraft) de Rega\u00efa." },
                    { name: "!serveur", value: "Afficher les informations du serveur." },
                    { name: "!profil", value: "Afficher le profil d'un membre." },
                    { name: "!avatar", value: "Afficher l'avatar d'un membre en grand." }
                );
        }

        if (!embed) {
            embed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle("Erreur")
                .setDescription("Cat\u00e9gorie inconnue");
        }

        const backButton = new ButtonBuilder()
            .setCustomId(`help_back_${helpAuthorId}`)
            .setLabel('\u2b05 Retour')
            .setStyle(ButtonStyle.Secondary);
        const row = new ActionRowBuilder().addComponents(backButton);
        return interaction.update({ embeds: [embed], components: [row] });
    }

    // =========================
    // BOUTON RETOUR
    // =========================

    if (interaction.isButton() && interaction.customId.startsWith('help_back_')) {
        const helpAuthorId = interaction.customId.split('_')[2];
        if (interaction.user.id !== helpAuthorId) {
            return interaction.reply({ content: "Ce menu ne t'est pas destin\u00e9 !", ephemeral: true });
        }
        const embed = new EmbedBuilder()
            .setColor(0x00ffff)
            .setTitle("\ud83d\udca9 AIDE \u00c0 CACABOT")
            .setDescription("Hey ! Voici Cacabot, qui, malgr\u00e9 son nom peu glorieux, offre de multiples commandes qui seront le Graal des gens qui aiment s'ennuyer !\n\nPour d\u00e9couvrir les diff\u00e9rentes commandes disponibles de Cacabot, choisis l'une des cat\u00e9gories ci-dessous !");

        const menu = new StringSelectMenuBuilder()
            .setCustomId(`help_menu_${helpAuthorId}`)
            .setPlaceholder('Choisis une cat\u00e9gorie')
            .addOptions(
                { label: '\ud83c\udf89 Fun', description: 'animal, destin, epsys, choix, kiss, hug, danse, insulte, die, punch, bang, rizz, rire, question', value: 'fun' },
                { label: '\ud83d\udee0 Utilitaire', description: 'discord, aternos, serveur, profil, avatar', value: 'util' }
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
    await loadTop();
    await loadBirthdays();
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
        setInterval(checkBirthdays, 24 * 60 * 60 * 1000);
    }, msUntilMidnight());
});

client.login(process.env.TOKEN);