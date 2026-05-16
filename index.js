require('dotenv').config();

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
        GatewayIntentBits.MessageContent
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

function getAnimalResponse(message) {
    const cible = message.mentions.users.first();

    const base = cible
        ? (cible.id === client.user.id
            ? "Mon animal spirituel est..."
            : `Hmmm, l'animal spirituel de ${cible} est...`)
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
//     LISTENER MESSAGES
// =========================

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const response = getResponse(message.content);

    if (response === null || response === undefined) return;

    // !animal
    if (response?.needsMention) {
        return message.reply(getAnimalResponse(message));
    }

    // !kiss
    if (response?.needsKiss) {
        const cible = message.mentions.users.first();

        if (!cible) {
            return message.reply("Euuh... Tu veux embrasser qui du coup ?");
        }

        const auteurNom = message.member?.displayName ?? message.author.username;
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
        const cible = message.mentions.users.first();

        if (!cible) {
            return message.reply("Euuh... Tu veux c\u00e2liner qui du coup ?");
        }

        const auteurNom = message.member?.displayName ?? message.author.username;
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
        const cible = message.mentions.users.first();
        const auteurNom = message.member?.displayName ?? message.author.username;

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
        const cible = message.mentions.users.first();
        const auteurNom = message.member?.displayName ?? message.author.username;

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
        const auteurNom = message.member?.displayName ?? message.author.username;

        const embed = buildLaughEmbed(`\ud83d\ude06 **${auteurNom}** se tape une barre !`);
        const laughButton = new ButtonBuilder()
            .setCustomId(`laugh_with_${message.author.id}_${auteurNom}`)
            .setLabel("\ud83d\ude06 Rire avec")
            .setStyle(ButtonStyle.Primary);
        const row = new ActionRowBuilder().addComponents(laughButton);
        return message.reply({ embeds: [embed], components: [row] });
    }

    // !help
    if (response?.data) {
        const menu = new StringSelectMenuBuilder()
            .setCustomId('help_menu')
            .setPlaceholder('Choisis une cat\u00e9gorie')
            .addOptions(
                { label: '\ud83c\udf89 Fun', description: 'animal, destin, epsys, choix, kiss, hug, danse, insulte, rire', value: 'fun' },
                { label: '\ud83d\udee0 Utilitaire', description: 'discord, aternos', value: 'util' },
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
        const originalAuthorNom = parts.slice(3).join("_");

        const reurNom = interaction.member?.displayName ?? interaction.user.username;
        const embed = buildLaughEmbed(`\ud83d\ude06 **${reurNom}** rit avec **${originalAuthorNom}** !`);
        return interaction.reply({ embeds: [embed] });
    }

    // =========================
    // MENU SELECT
    // =========================

    if (interaction.isStringSelectMenu()) {
        if (interaction.customId !== 'help_menu') return;

        const value = interaction.values[0];
        let embed;

        if (value === 'fun') {
            embed = new EmbedBuilder()
                .setColor(0xffcc00)
                .setDescription("# \ud83c\udf89 Fun")
                .addFields(
                    { name: "!animal", value: "Devine votre animal spirituel parmi pr\u00e8s de 7000 combinaisons !" },
                    { name: "!destin", value: "Pr\u00e9dit votre destin et fait part des \u00e9v\u00e8nements de votre futur." },
                    { name: "!epsys", value: "Poste des GIFs al\u00e9atoires d'Epsys, parce que." },
                    { name: "!choix", value: "Vous avez du mal \u00e0 faire un choix ? Demandez \u00e0 Cacabot." },
                    { name: "!kiss", value: "Embrassez quelqu'un sur le serveur !" },
                    { name: "!hug", value: "Faites un c\u00e2lin \u00e0 quelqu'un sur le serveur !" },
                    { name: "!danse", value: "Dansez avec quelqu'un sur le serveur !" },
                    { name: "!insulte", value: "Insulte quelqu'un du serveur ! (Oui c'est gratuit)" },
                    { name: "!rire", value: "Riez un bon coup !" }
                );
        }

        if (value === 'util') {
            embed = new EmbedBuilder()
                .setColor(0x3498db)
                .setDescription("# \ud83d\udee0 Utilitaire")
                .addFields(
                    { name: "!discord", value: "Obtenir le lien officiel d'invitation de Rega\u00efa." },
                    { name: "!aternos", value: "Obtenir l'IP du serveur Aternos (Minecraft) de Rega\u00efa." }
                );
        }

        if (!embed) {
            embed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle("Erreur")
                .setDescription("Cat\u00e9gorie inconnue");
        }

        const backButton = new ButtonBuilder()
            .setCustomId('help_back')
            .setLabel('\u2b05 Retour')
            .setStyle(ButtonStyle.Secondary);
        const row = new ActionRowBuilder().addComponents(backButton);
        return interaction.update({ embeds: [embed], components: [row] });
    }

    // =========================
    // BOUTON RETOUR
    // =========================

    if (interaction.isButton() && interaction.customId === 'help_back') {
        const embed = new EmbedBuilder()
            .setColor(0x00ffff)
            .setTitle("\ud83d\udca9 AIDE \u00c0 CACABOT")
            .setDescription("Hey ! Voici Cacabot, qui, malgr\u00e9 son nom peu glorieux, offre de multiples commandes qui seront le Graal des gens qui aiment s'ennuyer !\n\nPour d\u00e9couvrir les diff\u00e9rentes commandes disponibles de Cacabot, choisis l'une des cat\u00e9gories ci-dessous !");

        const menu = new StringSelectMenuBuilder()
            .setCustomId('help_menu')
            .setPlaceholder('Choisis une cat\u00e9gorie')
            .addOptions(
                { label: '\ud83c\udf89 Fun', description: 'animal, destin, epsys, choix, kiss, hug, danse, insulte, rire', value: 'fun' },
                { label: '\ud83d\udee0 Utilitaire', description: 'discord, aternos', value: 'util' }
            );
        const row = new ActionRowBuilder().addComponents(menu);
        return interaction.update({ embeds: [embed], components: [row] });
    }
});

// =========================
//         CONNEXION
// =========================

client.once('ready', () => {
    console.log(`\u2705 ${client.user.tag} est connect\u00e9`);
});

client.login(process.env.TOKEN);