/**
 * Module Répliques Réflexes & Détection de Commandes pour Cacabot
 * Feur, Stiti, Bril, répliques cultes, mèmes de Regaïa
 */

const { getDestinReponse } = require('./destin.js');
const { getHelpResponse } = require('./help.js');

async function getResponse(raw) {
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

    if (command === "!choix") {
        return { needsChoix: true };
    }

    if (command === "!welcome" || command === "!bienvenue") {
        return { needsWelcome: true };
    }

    if (command === "!help" || command === "!aide") {
        return { needsHelp: true, data: getHelpResponse("!help")?.data };
    }

    if (command === "!helpx") {
        return { needsHelpx: true };
    }

    if (command === "!ytabo" || command === "!ytaboconfig" || command === "!ytwatch") {
        return { needsYtabo: true };
    }

    if (command === "!suggestion" || command === "!suggest" || command === "!sugg") {
        return { needsSuggestion: true };
    }

    // =========================
    //     COMMANDES UTILITAIRES
    // =========================

    if (raw.toLowerCase().match(/!aternos\b/)) {
        return "L'IP actuelle du serveur Minecraft de Regaïa est : **papierprout.aternos.me**";
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
    //         !PRUNE & !YOUTUBE
    // =========================

    if (command === "!youtube") {
        return { needsYoutube: true };
    }

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
    //       INTERACTIONS
    // =========================

    if (command === "!kiss" || command === "!bisou") return { needsKiss: true };
    if (command === "!run" || command === "!court") return { needsRun: true };
    if (command === "!hug" || command === "!calin") return { needsHug: true };
    if (command === "!danse" || command === "!dance") return { needsDance: true };
    if (command === "!insult") return { needsInsult: true };
    if (command === "!rire") return { needsLaugh: true };
    if (command === "!rizz") return { needsRizz: true };
    if (command === "!bang" || command === "!tir" || command === "!pan") return { needsBang: true };
    if (command === "!punch" || command === "!frappe") return { needsPunch: true };
    if (command === "!cry" || command === "!pleure") return { needsCry: true };
    if (command === "!palaref" || command === "!pref") return { needsPalaref: true };
    if (command === "!jailaref" || command === "!glaref" || command === "!gref") return { needsJailaref: true };
    if (command === "!explode" || command === "!explose") return { needsExplode: true };
    if (command === "!bait") return { needsBait: true };
    if (command === "!ban") return { needsBan: true };
    if (command === "!die") return { needsDie: true };

    // =========================
    //         ACTIVITÉ
    // =========================

    if (command === "!profil" || command === "!profile" || command === "!info") return { needsProfil: true };
    if (command === "!avatar") return { needsAvatar: true };
    if (command === "!anniversaire" || command === "!anniversairetest") return { needsAnniversaire: true };
    if (command === "!flip") return { needsFlip: true };
    if (command === "!blague") return { needsBlague: true };
    if (command === "!topchef") return { needsTopChef: true };
    if (command === "!actif") return { needsActif: true };
    if (command === "!top") return { needsTop: true };
    if (command === "!setmessages") return { needsSetMessages: true };

    // =========================
    //      AUTRES OUTILS
    // =========================

    if (command === "!horoscope") return { needsHoroscope: true };
    if (command === "!meteo" || command === "!météo") return { needsMeteo: true };
    if (command === "!save") return { needsSave: true };
    if (command === "!streamtest") return { needsStreamTest: true };
    if (command === "!lastsave") return { needsLastsave: true };
    if (command === "!say") return { needsSay: true };
    if (command === "!edit") return { needsEdit: true };
    if (command === "!reply") return { needsReply: true };
    if (command === "!bug" || command === "!bugs") return { needsBug: true };
    if (command === "!embed") return { needsEmbed: true };
    if (command === "!rolereac" || command === "!rr") return { needsRoleReac: true };
    if (command === "!rolebtn" || command === "!btnrole") return { needsRoleBtn: true };
    if (command === "!rappel") return { needsRappel: true };
    if (command === "!pomodoro") return { needsPomodoro: true };
    if (command === "!ping") return { needsPing: true };
    if (command === "!botinfo" || command === "!about" || command === "!abt") return { needsInfo: true };
    if (command === "!serveur") return { needsServeur: true };
    if (command === "!stats") return { needsStats: true };
    if (command === "!last") return { needsLastVideo: true };
    if (command === "!question") return { needsQuestion: true };
    if (command === "!destin") return getDestinReponse();

    // =========================
    //  PHRASES & RÉPLIQUES AUTOMATIQUES
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
    //  MESSAGES EXACTS UNIQUEMENT
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
    //  QUOI / QUI CLASSIQUES
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

module.exports = { getResponse };