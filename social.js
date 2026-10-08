const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder
} = require('discord.js');
const { createCanvas, loadImage } = require('canvas');

const EPSYS_ID = '436218312574107658';

// =========================
//         !EPSYS
// =========================
const EPSYS_GIFS = [
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

// =========================
//        !BOUGETOI
// =========================
const BOUGETOI_PHRASES = [
    `<@${EPSYS_ID}>, faudrait te bouger, on attend ta vidéo ! Alors tu nous sors un logiciel de montage et tu t'y mets **__MAINTENANT__** stp`,
    `<@${EPSYS_ID}>, ON T'ATTEND ! Ouvre ton logiciel de montage et commence à travailler **__TOUT DE SUITE__** ! 🎬`,
    `<@${EPSYS_ID}>, t'as cru que la vidéo allait se monter toute seule ? Allez hop, on taffe sur le projet et plus vite que ça ! 😤`
];

// =========================
//        !SYLVAIN
// =========================
const SYLVAIN_GIFS = [
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

// =========================
//        !TOPCHEF
// =========================
const TOPCHEF_CRITIQUES = [
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

// =========================
//         !CHOIX
// =========================
function resoudreChoix(raw) {
    let texteBrut = raw.replace(/^!choix\s*/i, "").trim().replace(/[?!.\s]+$/, "").trim();
    texteBrut = texteBrut.replace(/^tu\s+pr[ée]f[èe]res?\s+/i, "").trim();

    const capitalizeFirst = (str) => {
        if (!str) return str;
        return str.replace(/^\p{L}/u, (c) => c.toUpperCase());
    };

    if (texteBrut.length > 0) {
        const propositions = texteBrut
            .split(/\s+ou\s+/i)
            .map(p => p.trim().replace(/[?!.\s]+$/, "").trim())
            .filter(p => p.length > 0);

        if (propositions.length >= 2) {
            const choisi = propositions[Math.floor(Math.random() * propositions.length)];
            const introsDebut = [
                (c) => `**${capitalizeFirst(c)}**, tous les jours`,
                (c) => `**${capitalizeFirst(c)}** je pense`,
                (c) => `**${capitalizeFirst(c)}**, et je changerai pas d'avis`,
                (c) => `**${capitalizeFirst(c)}**. Zéro débat.`
            ];
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

    if (Math.random() < 0.1 && texteBrut.length > 0) {
        return `"${texteBrut}" ☝️🤓\nNon tais-toi et oublie cette idée stp`;
    }

    const reponses = [
        "Oui, mais le monde n'est pas encore prêt.", "Non. Mauvaise idée de base.", "Oui, mais t'assumes.", "Franchement je sais pas mais ça sent la merde.",
        "Oui mais ça va mal finir.", "Non mais tu vas quand même le faire donc bon.", "Non.", "J'ai demandé à ma maman... Elle a dit oui.",
        "ABSOLUMENT!", "Euuuh... Non ?", "C'est quoi cette question encore ? Non.", "Oui, oui, oui et encore oui !", "Pitié oui.", "Pitié non.",
        "Mange tes morts à la place de poser ce genre de questions.", "Totalement... Sauf que non, j'ai menti.", "Vous pensez ? Moi j'pense pas. C'est mon avis.",
        "Affirmatif.", "Oui je pensent.", "Ouient.", "Oui (stiti).", "É-VI-DEM-MENT", "Bah oui t'es débile ou quoi?", "Well yes, but actually no.",
        "Alors... Je savais la réponse, mais j'ai oublié...", "Tu crois jsuis Akinator fdp?", "Peut-êtreeeee.", "Fût un temps, on tuait des gens pour des questions moins connes que ça.",
        "Non + pas lu + ratio + ntm", "nn", "oe", "https://tenor.com/view/ui-jday-mister-jd-gif-25079300", "https://tenor.com/view/mais-oui-seb-jdg-mais-oui-gif-19057953",
        "https://cdn.discordapp.com/attachments/1128032964924670053/1504924989781053581/vous-pensez-moi-je-pense-pas.gif"
    ];

    return reponses[Math.floor(Math.random() * reponses.length)];
}

// =========================
//        !LOVECALC
// =========================
async function generateLovecalcImage(avatar1Url, avatar2Url, percent) {
    const oldBackend = process.env.PANGOCAIRO_BACKEND;
    delete process.env.PANGOCAIRO_BACKEND;

    const canvas = createCanvas(500, 160);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 500, 160);

    const bg = await loadImage('./lovecalcbg.png');
    ctx.drawImage(bg, 0, 0, 500, 160);

    const heartTop = 42;
    const heartBottom = 118;
    const heartHeight = heartBottom - heartTop;
    const fillHeight = Math.round((percent / 100) * heartHeight);
    const fillY = heartBottom - fillHeight;
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(209, fillY, 82, fillHeight);

    const av1 = await loadImage(avatar1Url);
    const av2 = await loadImage(avatar2Url);
    ctx.drawImage(av1, 25, 25, 110, 110);
    ctx.drawImage(av2, 365, 25, 110, 110);

    const cadres = await loadImage('./lovecalccadres.png');
    ctx.drawImage(cadres, 0, 0, 500, 160);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px "LemonMilk"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${percent}%`, 250, 80);

    const buffer = canvas.toBuffer('image/png');
    process.env.PANGOCAIRO_BACKEND = oldBackend;
    return buffer;
}

// =========================
//         !FLIP
// =========================
const FLIP_GIFS = [
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505384734392324236/giphy.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505388045573165178/coin_flip.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505388046064025671/yumeko.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505388046382665728/two-face.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505388046692909237/pip_boy.gif",
    "https://cdn.discordapp.com/attachments/1128032964924670053/1505388047036977172/flip.gif"
];
const PILE_IMG = "https://cdn.discordapp.com/attachments/1128032964924670053/1505389180132393163/pile.png";
const FACE_IMG = "https://cdn.discordapp.com/attachments/1128032964924670053/1505389180640034837/face.png";

const flipParis = new Map();
let flipEnCours = false;

async function doFlipSequence(channel, firstMessage, isPari, pileNom, faceNom, authorId) {
    const gif = FLIP_GIFS[Math.floor(Math.random() * FLIP_GIFS.length)];
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
        .setLabel("🪙 Relancer la pièce")
        .setStyle(ButtonStyle.Secondary);
    const relancerRow = new ActionRowBuilder().addComponents(relancerButton);

    let description;
    if (isPari) {
        const gagnantNom = isFace ? faceNom : pileNom;
        description = `${resultatTexte}\n**${gagnantNom}**, la chance est dans ton camp !\nOn recommence ?`;
    } else if (pileNom) {
        const campChoisi = pileNom;
        const aGagne = (isFace && campChoisi === 'face') || (!isFace && campChoisi === 'pile');
        description = `${resultatTexte}\n${aGagne ? "Gagné !" : "Perdu..."}\nOn recommence ?`;
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
        .setLabel("🪙 Lancer simple")
        .setStyle(ButtonStyle.Secondary);
    const pariBtn = new ButtonBuilder()
        .setCustomId(`flip_pari_${aid}`)
        .setLabel("⚔️ Pari")
        .setStyle(ButtonStyle.Secondary);
    const cancelBtn = new ButtonBuilder()
        .setCustomId(`flip_cancel_${aid}`)
        .setLabel("❌ Annuler")
        .setStyle(ButtonStyle.Secondary);
    const row = new ActionRowBuilder().addComponents(simpleBtn, pariBtn, cancelBtn);

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
        .setTitle("🪙 Pile ou face")
        .setDescription(texte);

    if (message) {
        return message.reply({ embeds: [embed], components: [row] });
    } else {
        return channel.send({ embeds: [embed], components: [row] });
    }
}

// =========================
//         !BLAGUE
// =========================
const BLAGUES_SOFT = [
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
    `Deux grains de sable se promènent dans le désert. Au bout d'un moment, l'un dit à l'autre : Tu crois qu'on est suivi ?`
];

const BLAGUES_CLASSIQUE = [
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
    `Quel est le sport préféré des électriciens ? Le karaté, car ils connaissent toutes les prises.`
];

const BLAGUES_NOIR = [
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
    `Qu'est-ce qui est pire que de trouver un ver dans ta pomme ? En trouver la moitié.`
];

async function sendBlague(interaction, cat, authorId) {
    const categories = {
        soft: { blagues: BLAGUES_SOFT, label: '😊 Humour soft', color: 0x2ecc71 },
        classique: { blagues: BLAGUES_CLASSIQUE, label: '😄 Humour classique', color: 0x3498db },
        noir: { blagues: BLAGUES_NOIR, label: '🖤 Humour noir', color: 0x2c2c2c }
    };

    const c = categories[cat];
    const blague = c.blagues[Math.floor(Math.random() * c.blagues.length)];

    const embed = new EmbedBuilder()
        .setColor(c.color)
        .setTitle(c.label)
        .setDescription(blague);

    const autreBtn = new ButtonBuilder()
        .setCustomId(`blague_autre_${authorId}_${cat}`)
        .setLabel('🤣 Une autre ?')
        .setStyle(ButtonStyle.Secondary);
    const menuBtn = new ButtonBuilder()
        .setCustomId(`blague_menu_back_${authorId}`)
        .setLabel('🔄 Autre type')
        .setStyle(ButtonStyle.Secondary);
    const row = new ActionRowBuilder().addComponents(autreBtn, menuBtn);

    return interaction.update({ embeds: [embed], components: [row] });
}

// =========================
//        !QUESTION
// =========================
const QUESTIONS_DEBATS = [
    "Si tu pouvais supprimer une invention de l'histoire, laquelle ce serait ?",
    "T'as un super-pouvoir inutile, lequel ?",
    "T'es plutôt \"mourir en héros\" ou \"survivre en lâche\" ?",
    "Pizza ananas : crime contre l'humanité ou génie incompris ?",
    "T'échangerais ta vie contre celle de quelqu'un d'autre ? Qui ?",
    "Les chats ou les chiens ? Justifie.",
    "T'es plutôt matin ou soir ? Et t'assumes ?",
    "Le passé ou le futur : tu pourrais visiter lequel ?",
    "T'aurais préféré naître 50 ans plus tôt ou 50 ans plus tard ?",
    "T'es plutôt \"tout planifier\" ou \"improviser jusqu'au chaos\" ?",
    "T'es d'accord que les gens qui mettent du lait avant les céréales sont dangereux ?",
    "Si t'avais à choisir entre perdre la vue ou l'ouïe, ce serait quoi ?",
    "T'es plutôt mer ou montagne ? Et si t'as dit ni l'un ni l'autre, t'as tort.",
    "Minecraft ou Fortnite — le débat ultime. Tranche.",
    "Les films ou les séries ? T'as le droit d'hésiter mais pas longtemps.",
    "T'préfères être trop chaud ou trop froid ?",
    "T'es \"je réponds aux messages dans la seconde\" ou \"je laisse mariner 3 jours\" ?",
    "Si t'étais un personnage de jeu vidéo, t'aurais quel rôle ? Tank, DPS, support ?",
    "T'es plutôt quelqu'un qui lit les instructions ou qui fonce et voit ce qui se passe ?",
    "Quel est le film/série que tout le monde aime mais que toi tu trouves nul ?"
];

const QUESTIONS_CONFESSION = [
    "Quelle est la chose la plus stupide que t'as faite pour impressionner quelqu'un ?",
    "T'as un talent caché que personne sur ce serveur connaît ?",
    "Quelle est ta honte secrète en matière de musique ?",
    "T'as déjà menti pour éviter une soirée ? Sur quoi ?",
    "Quel est le truc le plus enfantin que tu fais encore aujourd'hui ?",
    "T'as déjà fait semblant de pas voir quelqu'un dans la rue pour éviter de lui parler ?",
    "Quelle est la chose la plus bizarre que t'aies mangée ?",
    "T'as une peur que t'assumes pas en public ?",
    "Quel est le moment le plus gênant de ta vie scolaire ?",
    "T'as déjà pleuré devant un film/série que t'aurais jamais avoué ?",
    "T'as déjà eu une phase \"cringe\" dont tu parles plus ? Raconte.",
    "Quel est le mensonge le plus élaboré que t'as jamais raconté ?",
    "T'as une habitude bizarre que tu fais quand t'es seul.e ?",
    "Quel est le truc que t'as acheté et que t'as jamais utilisé ?",
    "T'as déjà googlé quelque chose de tellement bizarre que t'aurais jamais montré ton historique ?",
    "Quelle est la décision la plus impulsive que t'as prise et dont t'es fièr.e ?",
    "T'as déjà raté quelque chose d'important à cause d'une série/jeu ?",
    "Quel est le conseil le plus nul qu'on t'a jamais donné ?",
    "Quel est le truc que tu fais et que tu sais que c'est mal mais tu le fais quand même ?",
    "T'as une opinion impopulaire que t'assumes complètement ?"
];

const QUESTIONS_HYPOTHETIQUES = [
    "T'es le dernier humain sur Terre, mais t'as le choix d'un animal comme compagnon. Lequel ?",
    "Si t'avais 24h pour faire n'importe quoi sans conséquences, ce serait quoi ?",
    "T'apprends que t'es en fait un personnage de fiction. Dans quel univers t'es ?",
    "T'as 1 million d'euros mais tu dois tout dépenser en 24h. Comment ?",
    "Si tu pouvais vivre dans n'importe quelle époque de l'histoire, ce serait laquelle ?",
    "T'as le pouvoir de lire dans les pensées, mais seulement d'une personne pour toujours. Qui ?",
    "Si t'étais invisible pendant une heure, tu ferais quoi ?",
    "T'apprends que le monde finit dans 48h. Ta dernière journée ressemble à quoi ?",
    "Si tu pouvais maîtriser instantanément n'importe quelle compétence, ce serait laquelle ?",
    "T'as le choix : vivre 200 ans en bonne santé ou vivre normal mais avec 3 vœux. Tu choisis quoi ?",
    "Si t'avais un bouton pour effacer un souvenir de ta mémoire, t'en effacerais un ?",
    "T'es propulsé.e dans un jeu vidéo au hasard. Quel jeu t'espères tomber ?",
    "Si tu pouvais avoir une conversation avec toi-même dans 10 ans, tu demanderais quoi ?",
    "T'as le choix entre voler ou être invisible. T'es team quoi ?",
    "Si t'étais un super-vilain, quelle serait ton obsession principale ?",
    "T'as la possibilité de tout recommencer depuis tes 10 ans avec ta mémoire actuelle. Tu acceptes ?",
    "Si t'avais accès au cerveau de n'importe qui pendant 10 minutes, qui ce serait ?",
    "T'apprends que t'as un jumeau/une jumelle quelque part. Ta réaction ?",
    "Si tu pouvais changer une loi dans ton pays, ce serait laquelle ?",
    "T'es seul.e sur une île déserte avec une console et un seul jeu pour toujours. Lequel ?"
];

const QUESTIONS_SERVEUR = [
    "Qui sur ce serveur survivrait le plus longtemps dans un film d'horreur ?",
    "Si Regaïa était un pays, quelle serait sa capitale et son plat national ?",
    "Qui sur ce serveur serait le/la premier.e à trahir le groupe en mode apocalypse zombie ?",
    "Si les membres de ce serveur formaient un groupe de musique, quel genre ce serait ?",
    "Qui serait le/la meilleur.e président.e du serveur ? Et le/la pire ?",
    "Si ce serveur était une série TV, quel genre ce serait ?",
    "Qui serait le/la dernier.e debout lors d'une soirée entre membres du serveur ?",
    "Si chaque membre avait un animal spirituel, lequel t'attribuerais-tu ?",
    "Quel membre du serveur serait le plus susceptible de devenir célèbre ? Pour quoi ?",
    "Si vous deviez partir en road trip ensemble, qui conduit et qui dort tout le trajet ?"
];

const QUESTIONS_PHILOSOPHIE = [
    "Est-ce qu'on peut vraiment faire confiance à quelqu'un qui n'aime pas les animaux ?",
    "T'es plutôt \"le voyage compte plus que la destination\" ou \"juste arriver vite\" ?",
    "Est-ce qu'un.e ami.e qui te ment pour te protéger, c'est encore un.e vrai.e ami.e ?",
    "Si personne te voit faire quelque chose de bien, ça compte quand même ?",
    "Est-ce que c'est mieux d'avoir vécu quelque chose d'intense et de douloureux plutôt que rien du tout ?",
    "T'es d'accord que les gens changent vraiment, ou ils font juste semblant ?",
    "Est-ce qu'il y a des choses qu'on devrait garder secrètes même avec ses meilleurs ami.es ?",
    "T'es plutôt \"les regrets c'est utile\" ou \"no regrets, on assume tout\" ?",
    "Si le bonheur était une compétence, t'aurais quel niveau ?",
    "Est-ce qu'on choisit vraiment qui on aime ou c'est juste le hasard ?"
];

const QUESTIONS_ALEATOIRES = [
    "T'as déjà parlé à une plante ? Elle t'a répondu ?",
    "Quel est le son le plus agaçant au monde selon toi ?",
    "Si t'avais à sentir comme quelque chose pour toujours, ce serait quoi ?",
    "T'es capable de manger la même chose tous les jours pendant un an pour 10 000€ ? C'est quoi le plat ?",
    "Quel animal aurait le meilleur compte Instagram selon toi ?",
    "Si t'avais à choisir une musique pour ta propre mort, ce serait laquelle ?",
    "T'arrives à décrire ta personnalité avec seulement trois emojis ?",
    "Quel est le film dont tu connais tous les dialogues par cœur sans l'avoir voulu ?",
    "T'as déjà eu une dispute avec quelqu'un sur quelque chose de complètement inutile ? C'était quoi ?",
    "Si ta vie était un genre de film, ce serait lequel ?",
    "Quel est le mot que tu trouves le plus beau dans n'importe quelle langue ?",
    "T'es du genre à lire les termes et conditions ou tu cliques \"Accepter\" les yeux fermés ?",
    "Si t'étais une boisson, tu serais laquelle ?",
    "T'as déjà eu un rêve tellement bizarre que t'as mis des heures à t'en remettre ?",
    "Quel est le truc le plus inutile que tu sais faire et dont t'es fièr.e ?",
    "Si ta vie avait une bande-son, quel genre de musique ce serait ?",
    "T'es plutôt \"j'arrive en avance\" ou \"en retard mais avec style\" ?",
    "Quel est le truc que tout le monde fait en public et que personne avoue ?",
    "Si t'étais un mème, t'aurais quel format ?",
    "Quelle est la question que t'aurais voulu qu'on te pose ce soir ?"
];

function buildQuestionRow() {
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
    return new ActionRowBuilder().addComponents(menu);
}

// ==========================================
//               HANDLERS EXPORTÉS
// ==========================================

async function handleSocialMessage(message, response, client, helpers) {
    const { findMemberByName, askDisambiguation } = helpers;

    // 1. !bougetoi
    if (response?.needsBougetoi) {
        const phrase = BOUGETOI_PHRASES[Math.floor(Math.random() * BOUGETOI_PHRASES.length)];
        await message.channel.send({ content: phrase });
        return true;
    }

    // 2. !sylvain
    if (response?.needsSylvain) {
        const gif = SYLVAIN_GIFS[Math.floor(Math.random() * SYLVAIN_GIFS.length)];
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('sylvain_again').setLabel('🐒 Singe fort ensemble').setStyle(ButtonStyle.Secondary)
        );
        await message.reply({ files: [gif], components: [row] });
        return true;
    }

    // 3. !topchef
    if (response?.needsTopChef) {
        let cibleMembre = message.member;
        if (message.reference) {
            const repliedMsg = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
            if (repliedMsg && repliedMsg.member) cibleMembre = repliedMsg.member;
        } else if (message.mentions.members.first()) {
            cibleMembre = message.mentions.members.first();
        }

        const nom = cibleMembre?.displayName ?? message.author.username;
        const phrase = TOPCHEF_CRITIQUES[Math.floor(Math.random() * TOPCHEF_CRITIQUES.length)];
        const embed = new EmbedBuilder()
            .setColor(0xe67e22)
            .setTitle(`👨‍🍳 Le Verdict Top Chef pour ${nom}`)
            .setDescription(phrase)
            .setFooter({ text: '- Cacabot Critique Gastronomique' });

        await message.reply({ embeds: [embed] });
        return true;
    }

    // 4. !lovecalc
    if (response?.needsLovecalc) {
        const args = message.content.trim().split(/\s+/);
        let user1 = message.mentions.users.first();
        let user2 = message.mentions.users.size >= 2 ? [...message.mentions.users.values()][1] : null;

        if (!user1 && args[1]) {
            const r = findMemberByName(message.guild, args[1]);
            if (r.found) user1 = r.found.user;
        }
        if (!user2 && args[2]) {
            const r = findMemberByName(message.guild, args[2]);
            if (r.found) user2 = r.found.user;
        }

        if (!user1 || !user2) {
            await message.reply('Usage : `!lovecalc @User1 @User2` ou `!lovecalc pseudo1 pseudo2`');
            return true;
        }

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
            await message.reply({ embeds: [embed], files: [{ attachment: buffer, name: 'lovecalc.png' }] });
        } catch (e) {
            await message.reply(`💕 **${nom1}** et **${nom2}** sont compatibles à **${percent}%** !`);
        }
        return true;
    }

    // 5. !flip
    if (response?.needsFlip) {
        if (flipEnCours) {
            message.reply("Un lancer est déjà en cours ! Attends ton tour.").then(msg => {
                setTimeout(() => { msg.delete().catch(() => {}); message.delete().catch(() => {}); }, 3000);
            });
            return true;
        }
        flipEnCours = true;
        await sendFlipChoix(message.channel, message, message.author.id);
        return true;
    }

    // 6. !blague
    if (response?.needsBlague) {
        const authorId = message.author.id;
        const embed = new EmbedBuilder().setColor(0xe91e63).setTitle('🤣 Blagues').setDescription('Choisis une catégorie !');
        const menu = new StringSelectMenuBuilder()
            .setCustomId(`blague_menu_${authorId}`)
            .setPlaceholder('Choisis une catégorie')
            .addOptions(
                { label: '😊 Humour soft', value: 'soft' },
                { label: '😄 Humour classique', value: 'classique' },
                { label: '🖤 Humour noir', value: 'noir' }
            );
        const row = new ActionRowBuilder().addComponents(menu);
        await message.reply({ embeds: [embed], components: [row] });
        return true;
    }

    // 7. !question
    if (response?.needsQuestion) {
        const embed = new EmbedBuilder()
            .setColor(0x9b59b6)
            .setTitle("❓ Question du soir")
            .setDescription("Choisis une catégorie pour recevoir une question aléatoire !");
        await message.reply({ embeds: [embed], components: [buildQuestionRow()] });
        return true;
    }

    return false;
}

async function handleSocialSlash(interaction) {
    const commandName = interaction.commandName;

    if (commandName === 'topchef') {
        const cibleUser = interaction.options.getUser('membre') ?? interaction.user;
        const cibleMember = interaction.guild?.members.cache.get(cibleUser.id);
        const nom = cibleMember?.displayName ?? cibleUser.username;
        const phrase = TOPCHEF_CRITIQUES[Math.floor(Math.random() * TOPCHEF_CRITIQUES.length)];
        const embed = new EmbedBuilder()
            .setColor(0xe67e22)
            .setTitle(`👨‍🍳 Le Verdict Top Chef pour ${nom}`)
            .setDescription(phrase)
            .setFooter({ text: '- Cacabot Critique Gastronomique' });
        return interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'choix') {
        const questionTexte = interaction.options.getString('question');
        const reponse = resoudreChoix(`!choix ${questionTexte}`);
        return interaction.reply({ content: reponse });
    }

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

    if (commandName === 'flip') {
        if (flipEnCours) return interaction.reply({ content: "Un lancer est déjà en cours ! Attends ton tour.", ephemeral: true });
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
            const fakeInteraction = { update: async (data) => interaction.reply(data), user: interaction.user };
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

    if (commandName === 'epsys') {
        const gif = EPSYS_GIFS[Math.floor(Math.random() * EPSYS_GIFS.length)];
        return interaction.reply({ content: gif });
    }

    if (commandName === 'bougetoi') {
        const phrase = BOUGETOI_PHRASES[Math.floor(Math.random() * BOUGETOI_PHRASES.length)];
        return interaction.reply({ content: phrase });
    }

    if (commandName === 'sylvain') {
        const gif = SYLVAIN_GIFS[Math.floor(Math.random() * SYLVAIN_GIFS.length)];
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('sylvain_again').setLabel('🐒 Singe fort ensemble').setStyle(ButtonStyle.Secondary)
        );
        return interaction.reply({ files: [gif], components: [row] });
    }

    if (commandName === 'question') {
        const embed = new EmbedBuilder()
            .setColor(0x9b59b6)
            .setTitle("❓ Question du soir")
            .setDescription("Choisis une catégorie pour recevoir une question aléatoire !");
        return interaction.reply({ embeds: [embed], components: [buildQuestionRow()] });
    }

    return false;
}

async function handleSocialInteraction(interaction) {
    if (interaction.isButton()) {
        const id = interaction.customId;

        // Bouton Sylvain
        if (id === 'sylvain_again') {
            const gif = SYLVAIN_GIFS[Math.floor(Math.random() * SYLVAIN_GIFS.length)];
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('sylvain_again').setLabel('🐒 Singe fort ensemble').setStyle(ButtonStyle.Secondary)
            );
            await interaction.reply({ files: [gif], components: [row] });
            return true;
        }

        // Boutons Flip
        if (id.startsWith('flip_start_')) {
            const startAuthorId = interaction.user.id;
            const startType = id.split('_')[3];
            const startNom = interaction.member?.displayName ?? interaction.user.username;
            flipEnCours = true;
            await interaction.deferUpdate().catch(() => {});
            let relancerMsg = startType === 'simple'
                ? `**${startNom}**, cette fois, c'est aussi pour un lancer simple, ou alors pour parier avec quelqu'un ?`
                : `**${startNom}**, cette fois, c'est pour un lancer simple, ou encore pour parier avec quelqu'un ?`;
            await sendFlipChoix(interaction.channel, null, startAuthorId, relancerMsg);
            return true;
        }

        if (id.startsWith('flip_simple_')) {
            const simpleAuthorId = id.split('_')[2];
            if (interaction.user.id !== simpleAuthorId) {
                await interaction.reply({ content: "C'est pas à toi que je m'adresse, on jouera ensemble après son tour si tu veux.", ephemeral: true });
                return true;
            }
            const pileBtn = new ButtonBuilder().setCustomId(`flip_solo_pile_${simpleAuthorId}`).setLabel("Pile").setStyle(ButtonStyle.Secondary);
            const faceBtn = new ButtonBuilder().setCustomId(`flip_solo_face_${simpleAuthorId}`).setLabel("Face").setStyle(ButtonStyle.Secondary);
            const cancelBtn = new ButtonBuilder().setCustomId(`flip_cancel_${simpleAuthorId}`).setLabel("❌ Annuler").setStyle(ButtonStyle.Secondary);
            const campRow = new ActionRowBuilder().addComponents(pileBtn, faceBtn, cancelBtn);
            const clickerNom = interaction.member?.displayName ?? interaction.user.username;
            const campEmbed = new EmbedBuilder().setColor(0xffd700).setTitle("🪙 Pile ou face").setDescription(`**${clickerNom}**, choisis ton camp !`);
            await interaction.update({ embeds: [campEmbed], components: [campRow] });
            return true;
        }

        if (id.startsWith('flip_cancel_')) {
            const cancelAuthorId = id.split('_')[2];
            if (interaction.user.id !== cancelAuthorId) {
                await interaction.reply({ content: "Hé oh, pique pas ma pièce !", ephemeral: true });
                return true;
            }
            flipEnCours = false;
            flipParis.delete(interaction.message.id);
            await interaction.message.delete().catch(() => {});
            return true;
        }

        if (id.startsWith('flip_solo_pile_') || id.startsWith('flip_solo_face_')) {
            const parts = id.split('_');
            const choix = parts[2];
            const soloAuthorId = parts[3];
            if (interaction.user.id !== soloAuthorId) {
                await interaction.reply({ content: "Hé oh, pique pas ma pièce !", ephemeral: true });
                return true;
            }
            const campTexte = choix === 'pile' ? 'Pile' : 'Face';
            const gif = FLIP_GIFS[Math.floor(Math.random() * FLIP_GIFS.length)];
            const lancerEmbed = new EmbedBuilder()
                .setColor(0xffd700)
                .setTitle("🪙 Pile ou face")
                .setDescription(`**${campTexte}**, c'est ça ? Ok !\nJe lance la pièce ! 🪙`)
                .setImage(gif);
            await interaction.update({ embeds: [lancerEmbed], components: [] });
            await new Promise(r => setTimeout(r, 1000));
            await doFlipSequence(interaction.channel, null, false, choix, null, soloAuthorId);
            return true;
        }

        if (id.startsWith('flip_pari_')) {
            const pariAuthorId = id.split('_')[2];
            if (interaction.user.id !== pariAuthorId) {
                await interaction.reply({ content: "C'est pas à toi que je m'adresse !", ephemeral: true });
                return true;
            }
            const pariEmbed = new EmbedBuilder()
                .setColor(0xffd700)
                .setTitle("🪙 Pile ou face")
                .setDescription("En l'attente des deux participant(e)s !")
                .addFields({ name: "🔴 Pile", value: "...", inline: true }, { name: "🔴 Face", value: "...", inline: true });
            const chooseRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("flip_choose_pile").setLabel("Pile").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId("flip_choose_face").setLabel("Face").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`flip_cancel_${pariAuthorId}`).setLabel("❌ Annuler").setStyle(ButtonStyle.Secondary)
            );
            await interaction.update({ embeds: [pariEmbed], components: [chooseRow] });
            const pariMsg = interaction.message;
            flipParis.set(pariMsg.id, { pile: null, face: null, messageId: pariMsg.id, channel: interaction.channel });
            setTimeout(async () => {
                const pari = flipParis.get(pariMsg.id);
                if (!pari) return;
                flipParis.delete(pariMsg.id);
                flipEnCours = false;
                const vide = (!pari.pile && !pari.face) ? "les deux camps sont vides !" : "l'un des camps est vide !";
                const expiredEmbed = new EmbedBuilder().setColor(0xffd700).setTitle("🪙 Pile ou face").setDescription(`❌ Le pari est annulé, ${vide}`);
                await pariMsg.edit({ embeds: [expiredEmbed], components: [] }).catch(() => {});
            }, 30000);
            return true;
        }

        if (id === 'flip_choose_pile' || id === 'flip_choose_face') {
            const choix = id === 'flip_choose_pile' ? 'pile' : 'face';
            const autreChoix = choix === 'pile' ? 'face' : 'pile';
            const msgId = interaction.message.id;
            const pari = flipParis.get(msgId);
            if (!pari) return interaction.reply({ content: "Ce pari n'existe plus !", ephemeral: true });
            if (pari[choix]) return interaction.reply({ content: "Ce camp est déjà pris !", ephemeral: true });
            if (pari[autreChoix] === (interaction.member?.displayName ?? interaction.user.username)) {
                return interaction.reply({ content: "Hé oh, pique pas ma pièce !", ephemeral: true });
            }
            const nom = interaction.member?.displayName ?? interaction.user.username;
            pari[choix] = nom;
            flipParis.set(msgId, pari);
            const pileVal = pari.pile ? `**${pari.pile}**` : "...";
            const faceVal = pari.face ? `**${pari.face}**` : "...";
            const pileIcon = pari.pile ? "🟢" : "🔴";
            const faceIcon = pari.face ? "🟢" : "🔴";

            if (pari.pile && pari.face) {
                const countEmbed = new EmbedBuilder().setColor(0xffd700).setTitle("🪙 Pile ou face").setDescription("Lancer dans 3").addFields({ name: `${pileIcon} Pile`, value: pileVal, inline: true }, { name: `${faceIcon} Face`, value: faceVal, inline: true });
                await interaction.update({ embeds: [countEmbed], components: [] });
                flipParis.delete(msgId);
                await new Promise(r => setTimeout(r, 1000));
                await interaction.message.edit({ embeds: [countEmbed.setDescription("Lancer dans 2")] }).catch(() => {});
                await new Promise(r => setTimeout(r, 1000));
                await interaction.message.edit({ embeds: [countEmbed.setDescription("Lancer dans 1")] }).catch(() => {});
                await new Promise(r => setTimeout(r, 1000));
                const flipGif = FLIP_GIFS[Math.floor(Math.random() * FLIP_GIFS.length)];
                const finalEmbed = new EmbedBuilder().setColor(0xffd700).setTitle("🪙 C'est parti !").setImage(flipGif).addFields({ name: `${pileIcon} Pile`, value: pileVal, inline: true }, { name: `${faceIcon} Face`, value: faceVal, inline: true });
                await interaction.message.edit({ embeds: [finalEmbed], components: [] }).catch(() => {});
                await doFlipSequence(interaction.channel, null, true, pari.pile, pari.face, null);
            } else {
                const updEmbed = new EmbedBuilder().setColor(0xffd700).setTitle("🪙 Pile ou face").setDescription("En l'attente des deux participant(e)s !").addFields({ name: `${pileIcon} Pile`, value: pileVal, inline: true }, { name: `${faceIcon} Face`, value: faceVal, inline: true });
                await interaction.update({ embeds: [updEmbed], components: [interaction.message.components[0]] });
            }
            return true;
        }

        // Boutons Blagues
        if (id.startsWith('blague_autre_')) {
            const parts = id.split('_');
            const authorId = parts[2];
            const cat = parts[3];
            if (interaction.user.id !== authorId) return interaction.reply({ content: "Ce bouton ne t'est pas destiné !", ephemeral: true });
            await sendBlague(interaction, cat, authorId);
            return true;
        }

        if (id.startsWith('blague_menu_back_')) {
            const authorId = id.split('_')[3];
            if (interaction.user.id !== authorId) return interaction.reply({ content: "Ce bouton ne t'est pas destiné !", ephemeral: true });
            const embed = new EmbedBuilder().setColor(0xe91e63).setTitle('🤣 Blagues').setDescription('Choisis une catégorie !');
            const menu = new StringSelectMenuBuilder().setCustomId(`blague_menu_${authorId}`).setPlaceholder('Choisis une catégorie').addOptions(
                { label: '😊 Humour soft', value: 'soft' },
                { label: '😄 Humour classique', value: 'classique' },
                { label: '🖤 Humour noir', value: 'noir' }
            );
            const row = new ActionRowBuilder().addComponents(menu);
            await interaction.update({ embeds: [embed], components: [row] });
            return true;
        }

        // Bouton Question nouvelle
        if (id.startsWith('question_new_')) {
            const authorId = id.split('_')[2];
            if (interaction.user.id !== authorId) return interaction.reply({ content: "Ce bouton ne t'est pas destiné !", ephemeral: true });
            const embed = new EmbedBuilder().setColor(0x9b59b6).setTitle("❓ Question du soir").setDescription("Choisis une catégorie pour recevoir une question aléatoire !");
            await interaction.update({ embeds: [embed], components: [buildQuestionRow()] });
            return true;
        }
    }

    if (interaction.isStringSelectMenu()) {
        const id = interaction.customId;

        if (id.startsWith('blague_menu_')) {
            const authorId = id.split('_')[2];
            if (interaction.user.id !== authorId) return interaction.reply({ content: "Ce menu ne t'est pas destiné !", ephemeral: true });
            await sendBlague(interaction, interaction.values[0], authorId);
            return true;
        }

        if (id === 'question_menu') {
            const categories = {
                debats: { questions: QUESTIONS_DEBATS, label: '🗣️ Débats / Opinions', color: 0xe74c3c },
                confession: { questions: QUESTIONS_CONFESSION, label: '🤫 Confession / Introspection', color: 0x9b59b6 },
                hypothetiques: { questions: QUESTIONS_HYPOTHETIQUES, label: '🤔 Hypothétiques', color: 0x3498db },
                serveur: { questions: QUESTIONS_SERVEUR, label: '🏠 Spéciales Regaïa', color: 0x2ecc71 },
                philosophie: { questions: QUESTIONS_PHILOSOPHIE, label: '🧠 Philosophie de comptoir', color: 0xf39c12 },
                aleatoires: { questions: QUESTIONS_ALEATOIRES, label: '🎲 Aléatoires / Chaos', color: 0x1abc9c }
            };
            const cat = categories[interaction.values[0]];
            const question = cat.questions[Math.floor(Math.random() * cat.questions.length)];
            const embed = new EmbedBuilder().setColor(cat.color).setTitle(cat.label).setDescription(`❓ ${question}`);
            const btnRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`question_new_${interaction.user.id}`).setLabel("❓ Nouvelle question").setStyle(ButtonStyle.Secondary)
            );
            await interaction.update({ embeds: [embed], components: [btnRow] });
            return true;
        }
    }

    return false;
}

module.exports = {
    resoudreChoix,
    generateLovecalcImage,
    handleSocialMessage,
    handleSocialSlash,
    handleSocialInteraction
};