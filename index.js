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

function getResponse(content) {
    const raw = content;

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
//     COMMANDES RANDOM
// =========================
    if (command === "!help") {
        return {
            data: new EmbedBuilder()
                .setColor(0x00ffff)
                .setTitle("💩 AIDE A CACABOT")
                .setDescription("Hey ! Voici Cacabot, qui, malgré son nom peu glorieux, offre de multiples commandes qui seront le Graal des gens qui aiment s'ennuyer !\n\nPour découvrir les différentes commandes disponibles de Cacabot, choisis l'une des catégories ci-dessous !")
        };
    }
    if (raw.toLowerCase().match(/!aternos\b/)) {
        return "L'IP actuelle du serveur Minecraft de Regaïa est : **papierprout.aternos.me**";
    }

    if (raw.toLowerCase().match(/!discord\b/)) {
        return "Si vous souhaitez inviter vos ami.es, voici le lien d'invitation du serveur Discord :\n** https://discord.com/invite/maAbUYb **";
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
//          !ANIMAL
// =========================

if (command === "!animal") {

    const base = "Hmmm, ton animal spirituel est...";

    const animaux = [
        "Un rat de RER", "Un pigeon", "Un chat errant", "Un renard", "Un dauphin", "Un corbeau", "Un hamster", "Un chien", "Un crapaud", "Un panda",
        "Un hérisson", "Un taureau", "Un papillon", "Un putain de moustique", "Un axolotl", "Un raton laveur", "Un perroquet", "Un singe",
        "Un poisson", "Un lièvre", "Un scarabée", "Un suricate", "Un éléphant", "Un rhinocéros", "Un toucan", "Un capybara", "Un cheval",
        "Un bousier", "Un pingouin", "Un Pikachu", "Un mulot", "Un cochon", "Un lion", "Un moucheron", "Un chevreuil", "Un castor", "Un chacal",
        "Un aigle", "Un dromadaire", "Un gorille", "Un guépard", "Un hibou", "Un hippopotame", "Un jaguar", "Un kangourou", "Un koala",
        "Un léopard", "Un lynx", "Un phoque", "Un serpent", "Un zèbre", "Un âne", "Un canard", "Un cerf", "Un chameau", "Un coq", "Un dindon",
        "Un lapin", "Un loup", "Un mouton", "Un ours", "Un sanglier", "Un tigre"
        ];

    const etatslist = [
        "en burn-out.", "sous coke.", "dépressif.", "qui a la diarrhée.", "cleptomane.", "alcoolique.", "casse-couilles.",
        "vétéran de la Seconde Guerre Mondiale.", "avec une chaîne YouTube vraiment nulle.", "en costard.", "gay.", "asthmatique.", "qui sent le roquefort.",
        "complètement con.", "de merde.", "transgenre (sois fièr.e).", "sataniste.", "fan de Feldup.", "rockstar.",
        "addict à TikTok.", "avec un fort accent belge.", "qui vote RN.", "fan de Norman.", "avec 2 de QI.", "SDF.", "bourré.",
        "sous kétamine.", "qui s'est chié dessus.", "addict à l'Oasis Tropical.", "DJ en Teknival.", "de la mafia italienne.",
        "amoureux de Lady Gaga.", "mangeur de caca.", "à la recherche du gros JDG.", "qui adore McFly & Carlito.", "qui rate son bac.",
        "qui se lève à 4h du mat pour aller au taf.", "sous traitement hormonal.", "en manifestation LGBT.", "qui révise son oral du bac blanc.",
        "en 4K Ultra HD IMAX Surround Dolby Digital.", "devant une série Netflix de merde.", "qui utilise la commande !destin.", "trisomique.",
        "qui étale son caca sur les murs.", "perdu dans sa vie.", "trader à Los Angeles.", "nostalgique des années 2000.", "transphobe.", "raciste."
        ];

    const animal = animaux[Math.floor(Math.random() * animaux.length)];
    const etat = etatslist[Math.floor(Math.random() * etatslist.length)];

    return `${base}\n**${animal} ${etat}**`;
}

// =========================
//         !DESTIN
// =========================

    if (command === "!destin") {
    const destin = [
        "Tu multiplieras ton nombre de neurones par 2 le vendredi 28 Juillet 2034.",
        "Tu deviendras une légende locale dans un Intermarché paumé.",
        "ChatGPT remplacera ton avenir.",
        "Tu refouleras ton homosexualité avant d'avoir des sentiments pour un twink entre 2028 et 2034.",
        "Tu vas te péter la gueule sur un trottoir le mois prochain (fais gaffe).",
        "Tu vas vouloir trop forcer un pet lundi prochain. Bon courage.",
        "Tu croiseras ton sosie parfait dans un Lidl mardi prochain à 14h32.",
        "Ta transidentité est tout sauf un fardeau. Sois fièr.e de ce que tu es chouchou.",
        "Un homme que tu côtoies va malheureusement se couper accidentellement le zgeg avec une machette.",
        "Y a un truc qui pue dans ton frigo, pense à le jeter avant de choper la coulante.",
        "Un événement totalement nul mais humiliant va te définir socialement dans l'année qui va suivre.",
        "Tu vas rire au mauvais moment, et ton destin va s’en souvenir.",
        "Un inconnu qui te croisera dans la rue va te juger personnellement très bientôt.",
        "Tu vas perdre un débat politique contre un chat errant.",
        "Un jour, tu comprendras un truc important… et tu l’oublieras 3 secondes après.",
        "Quelqu’un va te répondre «ok» à un message important et ça va te marquer à vie.",
        "Un jour, tu vas être témoin d’un truc bizarre mais personne te croira.",
        "Tu vas devenir un souvenir flou dans la mémoire de quelqu’un que tu respectes.",
        "Tu vas devenir riche… mais uniquement en pièces en chocolat.",
        "Un jour, tu vas réussir un truc incroyable un jour. Personne saura lequel.",
        "Tu vas dire un truc intelligent par accident en 2031, tout le monde sera sur le cul.",
        "Un jour, ton karma va dire «ok j’arrête les conneries» et ça va changer ta vie.",
        "Un jour, tu vas survivre à une situation trop bizarre pour être expliquée sans alcool.",
        "Bientôt, ton cerveau va bug au moins 3 fois par semaine mais tkt c'est pas grave.",
        "Un jour, tu vas accidentellement défendre Bardella dans un débat politique alors que t'es de gauche, et tout le monde te détestera.",
        "Un jour, tu vas éclater de rire dans un moment ultra sérieux et c’est ok.",
        "Un jour, tu vas réussir un truc par pur hasard et faire genre c’était prévu.",
        "Ton destin est écrit avec un stylo qui fuit mais ça donne du style.",
        "Un jour, tu vas dire «on verra» et pour une fois ça va vraiment marcher.",
        "Un jour, tu vas faire un choix ultra décisif, et ça va étonnamment bien se passer.",
        "D'ici peu, tu vas être en retard à quelque chose d’important mais ça va rien changer au final.",
        "Demain, sans prévenir, tu comprendras sur insta un truc fondamental sur la vie… et tu diras «ah ok» avant de retourner scroller.",
        "Les anciens avaient prédit ton arrivée dans un texte gravé sur une caisse de supermarché Lidl en 2004.",
        "Tu vas bientôt vivre un moment SUPER IMPORTANT de ta vie, mais genre entre deux merdes de chien.",
        "Un inconnu va dire ton prénom dans une phrase très sérieuse sans savoir pourquoi, et ça va te hanter.",
        "Les signes étaient là depuis le début : ticket de caisse froissé, pigeon qui te regarde, lumière bizarre au plafond... Méfie-toi...",
        "Tu vas prendre une décision débile qui sera interprétée comme une prophétie par quelqu’un d’autre.",
        "Ton futur dépend d’un truc que t’as oublié dans une poche de veste depuis 3 mois.",
        "Un jour, tu vas survivre à un moment important sans réaliser que c’en était un.",
        "Un jour tu vas réaliser que t’as survécu à 100% de tes jours difficiles, et c’est déjà très bien.",
        "Tu vas progresser sans t’en rendre compte, il faut que tu tiennes bon, c'est juste temporaire.",
        "Sans prévenir, un détail minuscule va te redonner l'envie de vivre.",
        "Tu vas réussir un truc que t’avais enterré mentalement depuis longtemps, et ça va faire bizarre. Mais ça va faire du bien.",
        "T’as déjà changé plus que tu ne le crois, mais ton cerveau ne veut pas te le dire. Alors c'est moi qui m'en charge : Tu as changé, et c'est beau.",
        "Peu importe ce que les gens disent, ton identité n’a pas besoin d’autorisation pour exister.",
        "Quelque part dans l’univers, une version de toi est heureuse d’être exactement ce qu’elle est.",
        "Le monde est bizarre, mais ton existence dedans est valide.",
        "Tu vas rencontrer des gens qui te comprendront sans que tu leur expliques ce que tu es, et ça va te surprendre.",
        "Y a aucune version correcte de toi à atteindre, tu es déjà toi et c'est tout ce qui compte.",
        "Dans un univers alternatif, quelqu’un te remercie d’exister, sans raison précise. Et c’est suffisant.",
        "Ton destin est écrit sur une boîte de raviolis périmés depuis 2017.",
        "Une porte automatique va te reconnaître et hésiter à s’ouvrir, volontairement.",
        "Un événement totalement nul mais humiliant va te définir socialement pendant 3 mois minimum.",
        "Un inconnu va te regarder avec trop de certitude et ça va te perturber pendant des années.",
        "Tu vas perdre un débat contre quelqu’un qui avait même pas compris le sujet.",
        "Tu vas acquérir le pouvoir d'être un putain de génie mais uniquement entre 3h12 et 3h14 du matin.",
        "Ton futur dépend d’un objet que t’as jeté sans t’en rendre compte en 2022.",
        "Un jour, tu vas réussir un truc incroyable et tu vas prétendre que c’était intentionnel alors que non.",
        "Tu vas progresser sans t’en rendre compte et un jour tu vas réaliser que t’as survécu à 100% de tes pires jours. Beau travail, continue comme ça.",
        "Sans prévenir, un détail ridicule va te redonner foi en la vie pendant 11 minutes, puis disparaître. Ça arrive à tout le monde, tkt pas.",
        "Ton destin c’est un ticket de caisse Lidl froissé avec écrit dessus «bonne chance fdp» en tout petit.",
        "Tu vas rater un moment clé de ta vie parce que t’étais en train de fixer un mur comme si c’était ton daron.",
        "Demain, ton cerveau va bug en plein milieu d’une phrase et tu vas continuer à parler comme si c’était normal.",
        "Un inconnu va te raconter sa vie comme si vous aviez une histoire ensemble alors que tu lui as juste ouvert une porte.",
        "D'ici peu, tu vas faire un choix important complètement au hasard et bizarrement ça va marcher et ça va t’énerver.",
        "Tu vas bientôt foirer un débat avec une personne que tu détestes, et sous la douche tu repenseras à tout ce que t'aurais dû lui dire.",
        "Tu vas bientôt avoir une révélation existentielle au rayon surgelés du Leclerc de Roubaix à 16h37.",
        "Ton destin c’est un truc écrit à l’encre qui bave et même lui il sait pas trop où il va.",
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
    if (cleaned.includes("avec quoi")) {
        return isUpper ? "AVEC FEUR" : "Avec feur";
    }
    if (cleaned.endsWith("oui")) {
        return isUpper ? "STITI" : "Stiti";
    }
    if (cleaned.includes("bac blanc")) {
        return "https://cdn.discordapp.com/attachments/720057528867618909/1504075425985466481/1778669924015-18e38746e64899fb.png";
    }
    if (cleaned.includes("lexys")) {
        return "https://cdn.discordapp.com/attachments/720057528867618909/1498102442200404120/bac_blanc.gif";
    }
    if (cleaned.includes("avec qui")) {
        return isUpper ? "AVEC QUETTE" : "Avec quette";
    }
    if (cleaned.includes("pour quoi faire")) {
        return isUpper ? "POUR FAIRE FEUR" : "Pour faire feur";
    }
    if (cleaned.includes("pour quoi")) {
        return isUpper ? "POUR FEUR" : "Pour feur";
    }
    if (cleaned.includes("pour qui")) {
        return isUpper ? "POUR QUETTE" : "Pour quette";
    }
    if (cleaned.includes("pourquoi")) {
        return isUpper ? "POURFEUR" : "Pourfeur";
    }
    if (cleaned.includes("c est a quoi")) {
        return isUpper ? "C'EST À FEUR" : "C'est à feur";
    }
    if (cleaned.includes("c est a qui")) {
        return isUpper ? "C'EST À QUETTE" : "C'est à quette";
    }
    if (cleaned === "67" || cleaned.includes(" 67 ") || cleaned.startsWith("67 ") || cleaned.endsWith(" 67")) {
        return "https://media.discordapp.net/attachments/1480734932933542049/1504170153317761085/67.gif";
    }
    if (cleaned.includes("six seven")) {
        return "https://media.discordapp.net/attachments/1480734932933542049/1504170153317761085/67.gif";
    }
    if (cleaned === "monster" || cleaned.includes(" monster ") || cleaned.startsWith("monster ") || cleaned.endsWith("monster")) {
        return "https://cdn.discordapp.com/attachments/1480756332373213275/1504649546045718758/pape_monster.png";
    }
    if (cleaned.includes("https://tenor.com/view/markiplier-mark-thumbs-up-nice-job-good-job-gif-25373350")) {
        return "https://tenor.com/view/markiplier-mark-thumbs-up-nice-job-good-job-gif-25373350";
    }
    if (cleaned.endsWith("non")) {
        return isUpper ? "BRIL" : "Bril";
    }
    if (cleaned.endsWith("bite")) {
        return isUpper ? "QUOICOUBITE" : "Quoicoubite";
    }
    if (cleaned.includes("c est qui")) {
        return isUpper ? "C'EST QUETTE" : "C'est quette";
    }
    if (cleaned === "ntm jax") {
        return "https://cdn.discordapp.com/attachments/1206232717444775956/1504653708770672741/Capture_decran_2026-05-15_031617.png";
    }
    if (cleaned.includes("cest qui")) {
        return isUpper ? "C'EST QUETTE" : "C'est quette";
    }
    if (cleaned.includes("c est quoi")) {
        return isUpper ? "C'EST FEUR" : "C'est feur";
    }
    if (cleaned.includes("de quoi")) {
        return isUpper ? "DE FEUR" : "De feur";
    }
    if (cleaned.includes("de qui")) {
        return isUpper ? "DE QUETTE" : "De quette";
    }

    // =========================
    // MESSAGES EXACTS UNIQUEMENT
    // =========================

    if (cleaned === "hein") {
        return isUpper ? "DEUX" : "Deux";
    }

    if (cleaned === "de") {
        return isUpper ? "TROIS" : "Trois";
    }

    if (cleaned === "a" || cleaned === "ha" || cleaned === "ah") {
        return "B";
    }

    // =========================
    // QUOI / QUI CLASSIQUES
    // =========================

    const quoiRegex = /^(quoi+|kwa|kouwa|kua|quoient)$/i;
    const lower = cleaned.replace(/\s+/g, " ");

    const isQuoi = quoiRegex.test(lower);
    const isQui = lower === "qui";

    if (!isQuoi && !isQui) return null;

    // 🎲 vidéo
    if (Math.random() < 0.05) {
        return "VIDEO";
    }

    // QUI
    if (isQui) {
        return isUpper ? "QUETTE" : "Quette";
    }

    // QUOIENT
    if (lower === "quoient") {
        return isUpper ? "FEURENT" : "Feurent";
    }

    // QUOI
    if (lower.startsWith("quoi")) {
        if (Math.random() < 0.5) {
            return isUpper ? "QUOICOUBEH" : "Quoicoubeh";
        }

        return isUpper ? "FEUR" : "Feur";
    }

    // fallback
    return isUpper ? "FEUR" : "Feur";
}

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const response = getResponse(message.content);

    if (!response) return;

    // MENU HELP
    if (response?.data) {
        const menu = new StringSelectMenuBuilder()
            .setCustomId('help_menu')
            .setPlaceholder('Choisis une catégorie')
            .addOptions(
                { label: 'Fun', value: 'fun' },
                { label: 'Utilitaire', value: 'util' },
            );

        const row = new ActionRowBuilder().addComponents(menu);

        return message.reply({
            embeds: [response.data],
            components: [row]
        });
    }

    // STRING SIMPLE
    if (typeof response === "string") {
        if (response.trim().length === 0) return;
        return message.reply({ content: response });
    }

    // EMBED SIMPLE (sécurité)
    if (response?.embeds || response?.embed) {
        return message.reply({ embeds: [response.data || response.embed] });
    }
});

client.once('ready', () => {
    console.log(`${client.user.tag} est connecté`);
});

client.login(process.env.TOKEN);

client.on('interactionCreate', async (interaction) => {

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
                .setTitle("🎉 Fun")
                .setDescription("!animal\n!destin\n!epsys");
        }

        if (value === 'util') {
            embed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle("🛠 Utilitaire")
                .setDescription("!discord\n!aternos");
        }

        if (!embed) {
            embed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle("Erreur")
                .setDescription("Catégorie inconnue");
        }

        const backButton = new ButtonBuilder()
            .setCustomId('help_back')
            .setLabel('⬅ Retour')
            .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(backButton);

        return interaction.update({
            embeds: [embed],
            components: [row]
        });
    }

    // =========================
    // BOUTON RETOUR
    // =========================

    if (interaction.isButton()) {

        if (interaction.customId !== 'help_back') return;

        const embed = new EmbedBuilder()
            .setColor(0x00ffff)
            .setTitle("💩 AIDE A CACABOT")
            .setDescription("Hey ! Voici Cacabot, qui, malgré son nom peu glorieux, offre de multiples commandes qui seront le Graal des gens qui aiment s'ennuyer !\n\nPour découvrir les différentes commandes disponibles de Cacabot, choisis l'une des catégories ci-dessous !");

        const menu = new StringSelectMenuBuilder()
            .setCustomId('help_menu')
            .setPlaceholder('Choisis une catégorie')
            .addOptions(
                { label: 'Fun', value: 'fun' },
                { label: 'Utilitaire', value: 'util' }
            );

        const row = new ActionRowBuilder().addComponents(menu);

        return interaction.update({
            embeds: [embed],
            components: [row]
        });
    }
});