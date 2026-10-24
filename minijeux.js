const { 
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    StringSelectMenuBuilder, UserSelectMenuBuilder,
    ModalBuilder, TextInputBuilder, TextInputStyle 
} = require('discord.js');

const MOTUS_CHANNEL_ID = '1559041936256409650';
const REBUS_CHANNEL_ID = '1556089022718152764';
const EPSYS_ID = '436218312574107658';

let motusTestSessions = new Map(); // channelId -> session
let rebusTestSessions = new Map(); // channelId -> session

// Pont de persistance avec index.js (pour loadAll / saveAll)
let minijeuxBridge = {
    getMotusData: () => ({ dateKey: 0, mot: '', termine: false, vainqueurId: null, tentatives: {}, messageId: null }),
    setMotusData: () => {},
    getMotusStats: () => ({}),
    setMotusStats: () => {},
    getRebusStats: () => ({}),
    setRebusStats: () => {},
    getPenduStats: () => ({}),
    setPenduStats: () => {},
    demanderSauvegarde: () => {},
    trackBattlePassProgress: () => {}
};

function initMinijeuxState(bridge) {
    minijeuxBridge = bridge;
}

// Alias pour compatibilité
const initMotusState = initMinijeuxState;

// ==========================================
//               PARTIE MOTUS
// ==========================================

const MOTUS_6_LETTRES = [
    "ABRIER", "ABRUTE", "ABSENT", "ABUSER", "ACACIA", "ACCORD", "ACCROC", "ACCUSE", "ACHETE", "ACQUIS",
    "ACTEUR", "ACTIFS", "ACTION", "ADAPTE", "ADEPTE", "ADHERE", "ADIEUX", "ADMIRE", "ADOPTE", "ADOREE",
    "ADULTE", "AFFARE", "AFFAIS", "AFFAME", "AFFECT", "AFFILE", "AFFINE", "AFFLUE", "AFFOLE", "AFFRON",
    "AGACER", "AGENDA", "AGENTS", "AGILES", "AGITER", "AGNEAU", "AGRUME", "AIDANT", "AIGLES", "AIGUAS",
    "AIMANT", "AJOUTE", "AJUSTE", "ALARME", "ALBUMS", "ALCOVE", "ALERTE", "ALEVIN", "ALIGNY", "ALIGNE",
    "ALLAIT", "ALLANT", "ALLEGE", "ALLIER", "ALLUME", "ALPINY", "ALTERE", "ALVEOE", "AMANTS", "AMASSER",
    "AMATIR", "AMENDE", "AMICAL", "AMIRAL", "AMITIE", "AMORCE", "AMOURS", "AMUSER", "ANANAS", "ANCIEN",
    "ANCRES", "ANEMIE", "ANGERS", "ANGINE", "ANGLES", "ANIMER", "ANNEAU", "ANNEES", "ANNEXE", "ANNULE",
    "ANODIN", "ANORAK", "APERCU", "APLOMB", "APOTRE", "APPART", "APPELE", "APPELS", "APPORT", "APPUIS",
    "APPRET", "APTERE", "ARABES", "ARBITR", "ARBRES", "ARCEAU", "ARCHER", "ARCHES", "ARDENT", "ARDOIS",
    "ARGENT", "ARGILE", "ARMADA", "ARMEES", "ARMURE", "ARRETE", "ARRIEN", "ARRIVE", "ARROSE", "ARTIST",
    "ASPECT", "ASPIRR", "ASSAUT", "ASSEZ", "ASSIS", "ASSURE", "ASTUCE", "ATELIE", "ATHLEE", "ATLANR",
    "ATOUTS", "ATTACH", "ATTAQU", "ATTIRE", "AUDACE", "AUGURE", "AUMONE", "AURORE", "AUTEUR", "AVANCE",
    "AVARIE", "AVENIR", "AVERER", "AVERTI", "AVEUGI", "AVOINE", "AVOIRS", "AVOUER", "BABINE", "BACCAS",
    "BAGAGE", "BAGUES", "BAISER", "BAISSE", "BALADE", "BALAIS", "BALCON", "BALLES", "BALLON", "BAMBOU",
    "BANANE", "BANDES", "BANQUE", "BARBES", "BARONS", "BARQUE", "BARRER", "BASSIN", "BATEAU", "BATTRE",
    "BAVARD", "BEAUTE", "BECANE", "BEQUET", "BIAISE", "BISTRO", "BLAGUE", "BLASON", "BLESSE", "BLONDE",
    "BLOQUE", "BONBON", "BORDEL", "BOTTES", "BOUCLE", "BOUGER", "BOUGIE", "BOULES", "BOURSE", "BOUTON",
    "BRAVES", "BRIQUE", "BRISER", "BRONZE", "BRULER", "BRUMES", "BUDGET", "BUFFET", "BUREAU", "CABANE",
    "CADEAU", "CAHIER", "CALCUL", "CAMION", "CANAPE", "CANARD", "CANONS", "CARNET", "CARTON", "CASINO",
    "CASQUE", "CASTEL", "CENTRE", "CERCLE", "CHAINE", "CHAMPS", "CHANCE", "CHAQUE", "CHASSE", "CHAUVE",
    "CHEMIN", "CHEQUE", "CHEVAL", "CHIENS", "CHIMIE", "CHROME", "CHUTES", "CIMENT", "CIRQUE", "CITRON",
    "CLASSE", "CLIENT", "CLIMAT", "CLOWNS", "COFFRE", "COLERE", "COMBAT", "COMETE", "COMPTE", "CORDES",
    "CORONA", "COUSIN", "COTONS", "COUCOU", "COUDES", "COUPLE", "COURIR", "COURTE", "CRAYON", "CREPES",
    "CRIMES", "CRISES", "CROIRE", "CUISIN", "CUIVRE", "DANGER", "DANSER", "DEBATS", "DEBOUT", "DEBUTS",
    "DECHET", "DECIDE", "DECLIC", "DEFAUT", "DEFEND", "DELICE", "DEMAIN", "DEPART", "DESSIN", "DESTIN",
    "DEVANT", "DEVOIR", "DIABLE", "DICTEE", "DIRECT", "DISQUE", "DOUBLE", "DOUCHE", "DRAGON", "DRAMES",
    "DROITE", "ECHECS", "ECLAIR", "ECOLES", "ECORCE", "ECRANS", "ECRIRE", "EFFETS", "EFFORT", "EGLISE",
    "ELANCE", "ENCLOS", "ENFANT", "ENIGME", "ENGINS", "ENTREE", "EPAULE", "EPICES", "EPOQUE", "EQUIPE",
    "ERREUR", "ESPACE", "ESPOIR", "ESPRIT", "ESTIME", "ETAPES", "ETOILE", "EVITER", "EXAMEN", "EXPERT",
    "FACILE", "FARCES", "FARINE", "FAUCON", "FAVEUR", "FEMMES", "FENTES", "FIEVRE", "FIGUES", "FIGURE",
    "FILLES", "FLACON", "FLAMME", "FLECHE", "FLEURS", "FLEUVE", "FORCES", "FORMAT", "FOUDRE", "FRANCE",
    "FRERES", "FROIDE", "FUMEES", "FUSEES", "FUSION", "GAGNER", "GARAGE", "GARCON", "GARDES", "GATEAU",
    "GEANTS", "GENIES", "GENOUX", "GESTES", "GIBIER", "GIRAFE", "GLACES", "GLACON", "GLISSE", "GLOBAL",
    "GOUTER", "GRADES", "GRAINE", "GRAINS", "GRANDE", "GRAPHE", "GROTTE", "GROUPE", "HABITS", "HACHIS",
    "HALLES", "HAMACS", "HANGAR", "HASARD", "HAUTES", "HERBES", "HEURES", "HIBOUX", "HOMMES", "HOTELS",
    "HUILER", "HUMAIN", "HUMOUR", "HYMNES", "ICONES", "IDEALS", "IDIOTS", "IMAGES", "IMPACT", "INDICE",
    "INVITE", "ISOLER", "JAMBES", "JARDIN", "JAUNES", "JETONS", "JOCKEY", "JOUETS", "JOYEUX", "JUGES",
    "JUMEAU", "JUNGLE", "JUPES", "JUSTES", "LACETS", "LAINES", "LANCER", "LAPINS", "LARGES", "LARMES",
    "LAVAGE", "LETTRE", "LEVEES", "LIBRES", "LIGNES", "LIMITS", "LIVRES", "LOISIR", "LOUVES", "LOYERS",
    "LUTTES", "MACHIN", "MADAME", "MAGIES", "MAIRES", "MAISON", "MALADE", "MANCHE", "MANEGE", "MANGER",
    "MARAIS", "MARCHE", "MARRON", "MASQUE", "MASSES", "MATCHS", "MATINS", "MAUDIT", "MELONS", "MENACE",
    "MERITE", "MEUBLE", "MICROS", "MILIEU", "MINCES", "MINUTE", "MIROIR", "MISERE", "MIXEUR", "MODELE",
    "MOMENT", "MONDES", "MONTRE", "MORDRE", "MOTEUR", "MOTIFS", "MOUCHE", "MOULES", "MOYENS", "MUSEES",
    "NATION", "NATURE", "NAVIRE", "NEIGES", "NOBLES", "NOIRES", "NOTICE", "NOTION", "NUAGES", "NUANCE",
    "NUMERO", "OBJETS", "OBSCUR", "ODEURS", "OEUVRE", "OFFRES", "OIGNON", "OISEAU", "OMBRES", "ONGLES",
    "ONGLET", "ORAGES", "ORANGE", "ORDRES", "ORGANE", "OUVRIR", "PAGNES", "PALAIS", "PANIER", "PANNES",
    "PAPIER", "PAQUET", "PARADE", "PARDON", "PARFUM", "PARLER", "PAROIS", "PARTIR", "PASSER", "PASTEL",
    "PATRIE", "PATRON", "PAUVRE", "PAYSAN", "PECHES", "PELOTE", "PENSEE", "PENTES", "PERLES", "PERMIS",
    "PETALE", "PHARES", "PHOTOS", "PHRASE", "PIGEON", "PILIER", "PILOTE", "PIQUER", "PIRATE", "PISTES",
    "PLAGES", "PLAINE", "PLANTE", "PLAQUE", "PLATRE", "PLEURS", "PLUMES", "POCHES", "POEMES", "POESIE",
    "POINTS", "POISON", "POULET", "POLICE", "POMMES", "PORTES", "POSTES", "POTION", "POUDRE", "POULES",
    "POUSSE", "PREUVE", "PRIERE", "PRINCE", "PRISON", "PRISES", "PROCES", "PROFIL", "PROJET", "PROMET",
    "PROPRE", "QUATRE", "RACINE", "RADARS", "RADIOS", "RAISIN", "RAMPES", "RANGES", "RAPIDE", "RAYONS",
    "REBORD", "RECITS", "RECORD", "REFLET", "REFUGE", "REGARD", "REGLES", "REGRET", "REINES", "RELAIS",
    "REMEDE", "REMISE", "RENARD", "REPOND", "REPOS", "RESEAU", "RESINE", "RESTES", "RETOUR", "REVUES",
    "RIDEAU", "RISQUE", "RIVAGE", "ROCHER", "ROMANS", "ROSACE", "ROUGES", "ROULES", "ROUTES", "RUBANS",
    "RUINES", "SABLES", "SABRES", "SACHET", "SAISON", "SALADE", "SALLES", "SALONS", "SAPINS", "SAUTER",
    "SAVANT", "SAVEUR", "SAVONS", "SCEAUX", "SCENES", "SEJOUR", "SENTIR", "SIECLE", "SIGNAL", "SIGNES",
    "SIMPLE", "SINGES", "SIRENE", "SOEURS", "SOLDAT", "SOLEIL", "SOMMET", "SONGES", "SORTIE", "SOUCIS",
    "SOUPES", "SOURCE", "SOURIS", "SPORTS", "STAGES", "STATUE", "STATUT", "STRESS", "STYLES", "SUCRES",
    "SUITES", "TABLES", "TACHES", "TAILLE", "TALENT", "TALONS", "TAPIS", "TARIFS", "TARTES", "TEINTE",
    "TEMPLE", "TENDRE", "TENUES", "TERMES", "TERRES", "TIGRES", "TISSUS", "TITRES", "TOILES", "TOMBES",
    "TONNER", "TORDRE", "TORTUE", "TOUCHE", "TOURNE", "TOURS", "TRACES", "TRAINS", "TRAITE", "TRAMES",
    "TRESOR", "TRIBUS", "TRICOT", "TRONCS", "TROUPE", "TUBES", "TUMEUR", "TUNNEL", "USINES", "VAGUES",
    "VALEUR", "VALISE", "VALLEE", "VAPEUR", "VEINES", "VENINS", "VENTRE", "VERRES", "VERROU", "VERSES",
    "VERTUS", "VIANDE", "VIBRER", "VICTOR", "VILLES", "VIOLON", "VIRAGE", "VISAGE", "VISITE", "VIVANT",
    "VOILES", "VOISIN", "VOLEUR", "VOYAGE", "WAGONS", "ZEBRES", "ZIGZAG"
].filter(w => w.length === 6);

const MOTUS_7_LETTRES = [
    "ABANDON", "ABATTEZ", "ABATTRE", "ABIMENT", "ABRICOT", "ABSENCE", "ACCEPTE", "ACCORDE", "ACCUEIL", "ACHETEZ",
    "ACTIVEE", "ADAPTEZ", "ADHERER", "ADMIREZ", "ADOPTEZ", "ADRESSE", "AFFAIRE", "AFFICHE", "AFFRONT", "AGACANT",
    "AGISSENT", "AGRANDI", "ALARMES", "ALIGNER", "ALLIAGE", "ALLUMER", "ALTERER", "AMATEUR", "AMELIOR", "AMENENT",
    "AMPOULE", "ANALYSE", "ANCIENS", "ANIMAUX", "ANNONCE", "APAISEZ", "APERCOI", "APLAUDI", "APOSTRE", "APPAREI",
    "APPELLE", "APPLIQU", "APPORTY", "APPORTS", "APPREND", "APPRETE", "ARBITRE", "ARCHERS", "ARDOISE", "ARGENTS",
    "ARRETES", "ARRIVEE", "ARRIVYS", "ARROSEZ", "ARTICLE", "ARTISAN", "ASPECTS", "ASSEMBL", "ASSISTE", "ASSOCIE",
    "ASSUREZ", "ATTAQUE", "ATTEINT", "ATTENDE", "ATTENTY", "ATTIRER", "ATTRAIT", "AUBERGE", "AUDACEZ", "AVANCES",
    "AVENIRS", "AVERTIR", "BAGARRE", "BATEAUX", "BICYCLE", "BISTROT", "BONHEUR", "BOUTEIL", "BUREAUX", "CAPRICE",
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

    for (let i = 0; i < longueur; i++) {
        if (guessLettres[i] === solLettres[i]) {
            res[i] = '🟩';
            restantes[guessLettres[i]]--;
        }
    }

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

function buildMotusEmbed(mot, dateKey, longueur = 6, manche = 1, totalManches = 2) {
    const premiereLettre = mot.charAt(0);
    const masque = `${premiereLettre} ` + '_ '.repeat(longueur - 1).trim();

    let diffStr = "moyen";
    let couleur = 0x00b0f4;
    if (longueur <= 4) {
        diffStr = "facile";
        couleur = 0x2ecc71;
    } else if (longueur >= 7) {
        diffStr = "difficile";
        couleur = 0xe74c3c;
    }

    const titre = totalManches > 1
        ? `🟩 MOTUS REGAÏEN — MANCHE ${manche}/${totalManches}`
        : `🟩 MOTUS REGAÏEN`;

    return new EmbedBuilder()
        .setColor(couleur)
        .setTitle(titre)
        .setDescription(
            `Le Motus est ouvert pendant **1 heure pile** !\n\n` +
            `🔤 **Mot à trouver :** \`${masque}\` (${longueur} lettres - Difficulté : **${diffStr}**)\n` +
            `🎯 **Règle :** Tu as **3 essais individuels** pour trouver le mot de cette manche !\n` +
            `⏳ **Temps limite :** 1 heure de session\n\n` +
            `🟩 **Vert** : Lettre bien placée\n` +
            `🟨 **Jaune** : Lettre présente mais mal placée\n` +
            `⬛ **Noir** : Lettre absente\n\n` +
            `*Écris simplement un mot de ${longueur} lettres commençant par **${premiereLettre}** dans ce salon !*`
        )
        .setFooter({ text: `Manche ${manche}/${totalManches} • Difficulté : ${diffStr} • !motus pour le statut` });
}

function buildMotusStatsEmbed(cible, interactionUser) {
    const motusStats = minijeuxBridge.getMotusStats();
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
    const sessionKey = `${dateKey}_${heureSession}h`;
    const motusData = minijeuxBridge.getMotusData() || {};

    let mot;
    let longueur;
    if (motusData.prochainMotForce) {
        mot = motusData.prochainMotForce;
        longueur = mot.length;
        delete motusData.prochainMotForce;
    } else {
        longueur = heureSession === 19 ? 7 : 6;
        mot = getMotDuJour(dateKey + (heureSession === 19 ? 999 : 0), longueur);
    }
    const expireAt = Date.now() + 60 * 60 * 1000;

    const nouvelleData = {
        dateKey: sessionKey,
        mot: mot,
        longueur: longueur,
        expireAt: expireAt,
        heureSession: heureSession,
        termine: false,
        manche: 1,
        totalManches: 2,
        enAttenteManche2: false,
        vainqueurId: null,
        vainqueurs: [],
        tentatives: {},
        messageId: null
    };

    minijeuxBridge.setMotusData(nouvelleData);

    const embed = buildMotusEmbed(mot, dateKey, longueur, 1, 2);
    embed.setDescription(`📢 **Alerte :** <@&1558966826564845590>\n\n` + embed.data.description);

    const texteAnnonce = heureSession === 19 
        ? `# 🟥 LE MOTUS DU SOIR (${longueur} LETTRES - MANCHE 1/2) EST LANCÉ !` 
        : `# 🟩 LE MOTUS DU MATIN (${longueur} LETTRES - MANCHE 1/2) EST LANCÉ !`;

    const sent = await channel.send({ 
        content: `📢 <@&1558966826564845590>\n${texteAnnonce}`, 
        embeds: [embed]
    });
    nouvelleData.messageId = sent.id;
    minijeuxBridge.setMotusData(nouvelleData);
    minijeuxBridge.demanderSauvegarde();
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

async function handleMotusMessage(message, response, client, helpers) {
    const motusData = minijeuxBridge.getMotusData();
    const motusStats = minijeuxBridge.getMotusStats();
    const rawContent = message.content.trim();
    const args = rawContent.split(/\s+/);
    const cmd = args[0]?.toLowerCase();

    // Commande Epsys pour décider manuellement du mot de la prochaine session
    if (cmd === '!motus' && (args[1]?.toLowerCase() === 'set' || args[1]?.toLowerCase() === 'force')) {
        if (message.author.id !== EPSYS_ID) {
            await message.reply("Cette commande est réservée à Epsys.");
            return true;
        }

        const motChoisi = args[2]?.toUpperCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^A-Z]/g, "");

        if (!motChoisi || motChoisi.length < 3) {
            await message.reply("Usage : `!motus set [mot]` (ex : `!motus set crocodile`). Minimum 3 lettres.");
            return true;
        }

        motusData.prochainMotForce = motChoisi;
        minijeuxBridge.demanderSauvegarde();

        let diffStr = "moyen";
        if (motChoisi.length <= 4) diffStr = "facile";
        else if (motChoisi.length >= 7) diffStr = "difficile";

        await message.reply(`✅ Le mot de la prochaine session de Motus sera **${motChoisi}** (${motChoisi.length} lettres - difficulté **${diffStr}**) ! L'embed classique sera utilisé.`);
        return true;
    }

    // Commande Panneau de Gestion des Scores (Epsys-only)
    if (cmd === '!jeupts' || cmd === '!points') {
        if (message.author.id !== EPSYS_ID) {
            await message.reply("Cette commande est réservée à Epsys.");
            return true;
        }

        let cible = message.mentions.members.first();
        if (!cible) {
            const query = rawContent.split(/\s+/).slice(1).join(" ");
            if (query && helpers?.findMemberByName) cible = helpers.findMemberByName(message.guild, query).found;
        }
        const targetId = cible ? cible.id : message.author.id;

        const embed = buildJeuPtsEmbed(message.guild, targetId, 'motus_victoires');
        const rows = buildJeuPtsComponents(targetId, 'motus_victoires');
        await message.reply({ embeds: [embed], components: rows });
        return true;
    }

    // Commande de test Motus (Epsys-only)
    if (cmd === '!motustest') {
        if (message.author.id !== EPSYS_ID) {
            await message.reply("Cette commande de test est réservée à Epsys.");
            return true;
        }

        const args = rawContent.split(/\s+/);
        const longueur = args[1] === '7' ? 7 : 6;
        const mot = getMotDuJour(Date.now() + Math.floor(Math.random() * 10000), longueur);
        const expireAt = Date.now() + 60 * 60 * 1000;

        motusTestSessions.set(message.channel.id, {
            mot,
            longueur,
            expireAt,
            termine: false,
            tentatives: {}
        });

        const embed = buildMotusEmbed(mot, getMotusDateKey(), longueur);
        const rowStop = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`stop_test_motus_${message.channel.id}`)
                .setLabel('🛑 Stopper le mini-jeu')
                .setStyle(ButtonStyle.Danger)
        );

        await message.reply({
            content: `🧪 **[MODE TEST] Motus solo lancé dans ce salon !** (Mot de ${longueur} lettres)`,
            embeds: [embed],
            components: [rowStop]
        });
        return true;
    }

    // Gestion des réponses dans un salon de test Motus
    if (motusTestSessions.has(message.channel.id) && !message.content.startsWith('!')) {
        const sessionTest = motusTestSessions.get(message.channel.id);
        if (sessionTest && !sessionTest.termine && Date.now() < sessionTest.expireAt) {
            const rawGuess = message.content.trim().toUpperCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .replace(/[^A-Z]/g, "");

            if (rawGuess.length === sessionTest.longueur) {
                if (!sessionTest.tentatives[message.author.id]) sessionTest.tentatives[message.author.id] = [];
                const userTries = sessionTest.tentatives[message.author.id];
                if (userTries.length >= 3) {
                    await message.reply("❌ Tu as déjà utilisé tes 3 essais pour cette session test !");
                    return true;
                }

                userTries.push(rawGuess);
                const essaiNum = userTries.length;
                const grille = evaluerMotus(rawGuess, sessionTest.mot, sessionTest.longueur);
                const lettresEspacées = rawGuess.split('').join(' ');

                if (rawGuess === sessionTest.mot) {
                    sessionTest.termine = true;
                    motusTestSessions.delete(message.channel.id);
                    await message.reply(`🎉 **[TEST RÉUSSI]** Bravo ! Le mot était bien **${sessionTest.mot}** (trouvé en ${essaiNum}/3 essai${essaiNum > 1 ? 's' : ''}) !`);
                } else {
                    await message.reply(`**${lettresEspacées}**\n${grille} *(Essai ${essaiNum}/3 en test)*`);
                }
                return true;
            }
        }
    }

    // Vérification salon Motus (officiel ou salon dédié aux mini-jeux)
    const estSalonMotus = message.channel.id === MOTUS_CHANNEL_ID || message.channel.id === '1556089022718152764';
    if (estSalonMotus && !message.content.startsWith('!')) {
        const now = Date.now();
        
        // Si aucune partie n'est chargée ou expirée
        if (!motusData.mot) return false;
        if (motusData.termine) return false;
        if (motusData.expireAt && now >= motusData.expireAt) {
            motusData.termine = true;
            minijeuxBridge.demanderSauvegarde();
            return false;
        }

        const rawGuess = message.content.trim().toUpperCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^A-Z]/g, "");

        const longueurAttendue = motusData.longueur || (motusData.mot ? motusData.mot.length : 6);

        if (rawGuess.length === longueurAttendue) {
            const motDuJour = motusData.mot;
            if (!motusData.tentatives[message.author.id]) {
                motusData.tentatives[message.author.id] = [];
            }

            const userTries = motusData.tentatives[message.author.id];
            if (userTries.length >= 3) {
                await message.reply(`❌ <@${message.author.id}>, tu as déjà utilisé tes **3 essais** pour cette session ! Laisse les autres membres tenter leur chance.`);
                return true;
            }

            userTries.push(rawGuess);
            const essaiNum = userTries.length;

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

            const toutesLettresTentees = new Set(userTries.flatMap(t => t.split('')));
            const lettresAbsentes = [...toutesLettresTentees]
                .filter(l => !motDuJour.includes(l))
                .sort()
                .join(' ');

            const ligneAbsentes = lettresAbsentes.length > 0 
                ? `\n> ❌ **Lettres absentes :** \`${lettresAbsentes}\`` 
                : '';

            const { MessageFlags } = require('discord.js');
            if (rawGuess === motDuJour) {
                motusStats[message.author.id].victoires++;
                minijeuxBridge.trackBattlePassProgress?.(message.author.id, 'motus_win', 1);
                minijeuxBridge.trackBattlePassProgress?.(message.author.id, 'minijeu_win', 1);

                await message.reply({
                    content: `**${lettresEspacées}**\n${grille} *(Essai ${essaiNum}/3)*`,
                    components: [rowOriginal],
                    flags: [MessageFlags.SuppressNotifications],
                    allowedMentions: { repliedUser: false }
                });

                const mancheActuelle = motusData.manche || 1;
                const totalManches = motusData.totalManches || 2;

                const rowStats = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`motus_view_stats_${message.author.id}`)
                        .setLabel('📊 Mes stats Motus')
                        .setStyle(ButtonStyle.Primary)
                );

                if (mancheActuelle < totalManches) {
                    // Préparation de la manche 2 dans 30 secondes
                    motusData.termine = true;
                    minijeuxBridge.demanderSauvegarde();

                    const embedManche1 = new EmbedBuilder()
                        .setColor(0x2ecc71)
                        .setTitle(`🎉 MANCHE ${mancheActuelle}/${totalManches} REMPORTÉE !`)
                        .setDescription(
                            `Félicitations à <@${message.author.id}> qui trouve le mot en **${essaiNum} essai${essaiNum > 1 ? 's' : ''}** !\n\n` +
                            `🔤 **Le mot était :** \`${motDuJour}\`\n\n` +
                            `⏳ **La manche 2 commence dans 30 secondes !** Vos 3 essais seront réinitialisés pour le prochain mot !`
                        )
                        .setFooter({ text: `Manche 2 dans 30 secondes chrono !` });

                    await message.channel.send({ embeds: [embedManche1], components: [rowStats] });

                    setTimeout(async () => {
                        const dateKey = getMotusDateKey();
                        const longueurM2 = motusData.heureSession === 19 ? 7 : 6;
                        const nouveauMot = getMotDuJour(dateKey + 5555, longueurM2);

                        motusData.mot = nouveauMot;
                        motusData.longueur = longueurM2;
                        motusData.manche = 2;
                        motusData.termine = false;
                        motusData.tentatives = {};
                        motusData.expireAt = Date.now() + 60 * 60 * 1000;
                        minijeuxBridge.demanderSauvegarde();

                        const embedM2 = buildMotusEmbed(nouveauMot, dateKey, longueurM2, 2, 2);
                        await message.channel.send({
                            content: `📢 **C'EST PARTI POUR LA MANCHE 2/2 !** Nouveau mot en jeu :`,
                            embeds: [embedM2]
                        });
                    }, 30000);
                    return true;
                }

                // Fin définitive de la session (après manche 2)
                motusData.termine = true;
                motusData.vainqueurId = message.author.id;
                minijeuxBridge.demanderSauvegarde();

                const prochainRdv = motusData.heureSession === 10 
                    ? 'Rendez-vous ce soir à 19h00 pour le Motus difficile (7 lettres) !' 
                    : 'Rendez-vous demain à 10h00 pour le prochain Motus !';

                const embedVictoire = new EmbedBuilder()
                    .setColor(0x2ecc71)
                    .setTitle('🏆 MOTUS TERMINÉ ! VICTOIRE DE LA SESSION !')
                    .setDescription(
                        `Félicitations à <@${message.author.id}> qui a trouvé le mot de la manche 2 en **${essaiNum} essai${essaiNum > 1 ? 's' : ''}** !\n\n` +
                        `🔤 **Le mot était :** \`${motDuJour}\` (${longueurAttendue} lettres)\n` +
                        `🏆 **Total de victoires de ${message.member?.displayName ?? message.author.username} :** **${motusStats[message.author.id].victoires}**`
                    )
                    .setFooter({ text: prochainRdv });

                await message.channel.send({ embeds: [embedVictoire], components: [rowStats] });
                return true;
            } else {
                minijeuxBridge.demanderSauvegarde();
                const infoReste = essaiNum === 3 
                    ? `\n-# *Tu as épuisé tes 3 essais pour cette session !*`
                    : `\n-# *Il te reste ${3 - essaiNum} essai${(3 - essaiNum) > 1 ? 's' : ''} !*`;

                await message.reply({
                    content: `**${lettresEspacées}**\n${grille} *(Essai ${essaiNum}/3)*${ligneAbsentes}${infoReste}`,
                    components: [rowOriginal],
                    flags: [MessageFlags.SuppressNotifications],
                    allowedMentions: { repliedUser: false }
                });
                return true;
            }
        }
    }

    // Commande de redémarrage d'urgence Motus (Epsys-only)
    if (cmd === '!motus' && rawContent.split(/\s+/)[1]?.toLowerCase() === 'restart') {
        if (message.author.id !== EPSYS_ID) {
            await message.reply("Cette commande est réservée à Epsys.");
            return true;
        }

        const nowParis = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
        const heureActuelle = nowParis.getHours();
        const heureSession = (heureActuelle >= 19) ? 19 : 10;

        // Annulation de l'ancienne session
        motusData.termine = true;
        minijeuxBridge.demanderSauvegarde();

        await message.reply(`♻️ **Session Motus précédente annulée !** Relance immédiate d'une nouvelle partie (${heureSession === 19 ? '7 lettres' : '6 lettres'})...`);
        if (message.guild) {
            await envoyerMotusQuotidien(message.guild, heureSession);
        }
        return true;
    }

    if (cmd === '!motus' || response?.needsMotus) {
        const { jourStr, heures, minutes, sessionNom, timestamp } = tempsAvantProchainMotus();
        const now = Date.now();
        const enCours = motusData.mot && !motusData.termine && motusData.expireAt && now < motusData.expireAt;

        let desc = `Le prochain Motus aura lieu **${jourStr} à ${sessionNom}** (dans **${heures}h ${minutes}min**, <t:${timestamp}:R>) !\n\n` +
                   `📍 **Salon officiel :** <#${MOTUS_CHANNEL_ID}>\n` +
                   `-# *Sessions tous les jours : 10h00 (6 lettres) et 19h00 (7 lettres - Difficile).*`;

        if (enCours) {
            const expireTimestamp = Math.floor(motusData.expireAt / 1000);
            const titreType = motusData.longueur === 7 ? '🟥 Motus du soir (7 lettres - Difficile)' : '🟩 Motus du matin (6 lettres)';
            desc = `🎮 **${titreType} est EN COURS !**\n\n` +
                   `📍 **Joue directement dans :** <#${MOTUS_CHANNEL_ID}>\n` +
                   `Tu as **3 essais individuels** pour deviner le mot.\n` +
                   `⏳ **Fin de la session :** <t:${expireTimestamp}:R> (fermeture à <t:${expireTimestamp}:t>) !\n\n` +
                   `Prochaine session : **${jourStr} à ${sessionNom}** (<t:${timestamp}:R>).`;
        }

        const embed = new EmbedBuilder()
            .setColor(enCours && motusData.longueur === 7 ? 0xe74c3c : 0x00b0f4)
            .setTitle(enCours ? '🟩 MOTUS EN COURS !' : '🟩 Motus Quotidien de Regaïa')
            .setDescription(desc);

        await message.reply({ embeds: [embed] });
        return true;
    }

    if (response?.needsMotusStats) {
        let cible = message.mentions.members.first();
        if (!cible) {
            const query = message.content.trim().split(/\s+/).slice(1).join(" ");
            if (query && helpers?.findMemberByName) cible = helpers.findMemberByName(message.guild, query).found;
        }
        if (!cible) cible = message.member;

        const embed = buildMotusStatsEmbed(cible, message.author);
        await message.reply({ embeds: [embed] });
        return true;
    }

    return false;
}

    async function handleMotusButton(interaction) {
    // Interceptions du panneau interactif !jeupts (Epsys-only)
    if (interaction.customId && interaction.customId.startsWith('jeupts')) {
        return await handleJeuPtsInteraction(interaction);
    }

    if (!interaction.isButton()) return false;

    if (interaction.customId.startsWith('stop_test_motus_')) {
        if (interaction.user.id !== EPSYS_ID) {
            await interaction.reply({ content: "Seule Epsys peut arrêter ce test.", ephemeral: true });
            return true;
        }
        const chId = interaction.customId.replace('stop_test_motus_', '');
        const session = motusTestSessions.get(chId);
        const motSecret = session ? session.mot : 'inconnu';
        motusTestSessions.delete(chId);
        await interaction.update({ components: [] });
        await interaction.channel.send(`🛑 **Test Motus arrêté !** Le mot était : **${motSecret}**.`);
        return true;
    }

    if (interaction.customId.startsWith('motus_show_original_')) {
        const motusData = minijeuxBridge.getMotusData();
        const dateKey = getMotusDateKey();
        const longueur = motusData.longueur || 6;
        const mot = motusData.mot || getMotDuJour(dateKey, longueur);
        const embed = buildMotusEmbed(mot, dateKey, longueur);
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return true;
    }

    if (interaction.customId.startsWith('motus_view_stats_')) {
        const member = interaction.member;
        const embed = buildMotusStatsEmbed(member, interaction.user);
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return true;
    }

    return false;
}

async function handleMotusSlash(interaction) {
    const commandName = interaction.commandName;

    if (commandName === 'motus') {
        const motusData = minijeuxBridge.getMotusData();
        const { jourStr, heures, minutes, sessionNom, timestamp } = tempsAvantProchainMotus();
        const now = Date.now();
        const enCours = motusData.mot && !motusData.termine && motusData.expireAt && now < motusData.expireAt;

        let desc = `Le prochain Motus aura lieu **${jourStr} à ${sessionNom}** (dans **${heures}h ${minutes}min**, <t:${timestamp}:R>) dans le salon <#1559041936256409650> !\n\n-# *Sessions tous les jours : 10h00 (6 lettres) et 19h00 (7 lettres - Difficile).*`;

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
            .setFooter({ text: 'Salon dédié : <#1559041936256409650> • 3 essais individuels • 1 heure de jeu par session' });

        return interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'motustats') {
        const cible = interaction.options.getUser('membre') ?? interaction.user;
        const member = interaction.guild?.members.cache.get(cible.id) ?? interaction.member;
        return interaction.reply({ embeds: [buildMotusStatsEmbed(member, interaction.user)] });
    }

    return false;
}

// ==========================================
//               PARTIE RÉBUS
// ==========================================

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
    ["☕🏢📹", "camera cafe"], ["👴👵🛋️", "scenes de menages"], ["🏥👨‍⚕️🤣", "h", "hopital", "la serie h", "serie h", "l hopital", "l'hopital"], ["⏱️🗣️💨", "bref"], ["🎭💼💯", "dix pour cent"],
    ["🎩💎🗼", "lupin"], ["🕵️‍♂️🕶️🏢", "le bureau des legendes"], ["🗳️🏛️🇫🇷", "baron noir"], ["👮‍♀️⚖️🏢", "engrenages"], ["☀️🏢🌊", "plus belle la vie"],
    ["👫🛋️🍷", "un gars une fille"], ["⛓️🗺️🏃‍♂️", "prison break"], ["✈️🏝️💨", "lost"], ["🧬🦸‍♂️🌍", "heroes"], ["⏰💣🔫", "24 heures chrono", "24"],
    ["🩸🔪💉", "dexter"], ["🕵️‍♀️🇺🇸💣", "homeland"], ["🍎🏘️👩", "desperate housewives"], ["👨‍⚕️👩‍⚕️🏥", "greys anatomy", "grey's anatomy"], ["👨‍⚕️💊🦯", "dr house", "house"],
    ["👨‍⚕️🩺🧩", "good doctor"], ["👨‍⚕️🏥🎵", "scrubs"], ["🚑🏥🩸", "urgences", "er"], ["🪓⛵🛡️", "vikings"], ["👑🇬🇧🏰", "the crown"],
    ["🏰🎩☕", "downton abbey"], ["💌👒🐝", "la chronique des bridgerton", "bridgerton"], ["⏳🏴󠁧󠁢󠁳󠁣󠁴󠁿❤️", "outlander"], ["🕊️🔫🦸", "peacemaker"], ["🦸‍♂️🩸😈", "the boys"],
    ["🦸‍♂️🩸🧒", "gen v"], ["🦯🔴🥋", "daredevil"], ["🥃📸👊", "jessica jones"], ["💀🔫🩸", "the punisher"], ["📺🪄❤️", "wandavision"],
    ["⏳🟢🐊", "loki"], ["🤠👶🚀", "the mandalorian", "mandalorian"], ["🚀🪖⚙️", "andor"], ["⚔️🏜️🧙‍♂️", "obi-wan kenobi", "obi wan"], ["🐺⚔️🧙‍♂️", "the witcher"],
    ["👧🖤✋", "mercredi", "wednesday"], ["🥋🐍🏆", "cobra kai"], ["🏫🍆🚲", "sex education"], ["💊✨😢", "euphoria"], ["💊🇬🇧🎉", "skins"],
    ["🧢🥤🕵️", "riverdale"], ["💋👠🍸", "gossip girl"], ["🤫📱✉️", "pretty little liars"], ["🏫🍾🩸", "elite"], ["🎧📼💔", "13 reasons why"],
    ["🧢📖🔪", "you"], ["🧡⛓️👩", "orange is the new black"], ["🌿💰🔫", "narcos"], ["💵🛶💼", "ozark"], ["🧠🔍🕵️", "mindhunter"],
    ["❄️🩸🕵️", "fargo"], ["🏍️💀🔫", "sons of anarchy"], ["📻📦👮", "the wire"], ["🍝🔫🕶️", "les soprano", "the sopranos"], ["🚬🍸🏢", "mad men"],
    ["💼🚁👴", "succession"], ["🏨🪷🍸", "the white lotus", "white lotus"], ["☢️🏭📉", "chernobyl"], ["🪖🎖️🌍", "band of brothers", "freres d armes"], ["🤠🤖🏜️", "westworld"],
    ["🔴👗🤰", "the handmaids tale", "la servante ecarlate"], ["👻🚗🗡️", "supernatural"], ["🧛‍♂️🩸🐺", "the vampire diaries"], ["🧛‍♂️⚜️👑", "the originals"], ["🐺🏈🌕", "teen wolf"],
    ["🏹🟢🦹", "arrow"], ["⚡🏃‍♂️🔴", "the flash", "flash"], ["🌾🦸‍♂️🚜", "smallville"], ["✨🧙‍♀️📖", "charmed"], ["🧛‍♀️🗡️⚰️", "buffy contre les vampires", "buffy"]
];

const REBUS_ANIMES = [
    ["📓🍎✍️", "death note"], ["🧱👹⚔️", "l attaque des titans", "snk", "attack on titan", "shingeki no kyojin"], ["⚔️👹🎋", "demon slayer", "kimetsu no yaiba"], ["🤞👁️👹", "jujutsu kaisen", "jjk"], ["🦸‍♂️🥦💥", "my hero academia", "mha"],
    ["🍥🦊🍜", "naruto", "naruto shippuden"], ["🐉⚡🥋", "dragon ball", "dragon ball z", "dbz"], ["🏴‍☠️👒🍖", "one piece"], ["🎣⚡🐜", "hunter x hunter", "hxh"], ["🗡️👻👘", "bleach"],
    ["🦾🤖⚗️", "fullmetal alchemist", "fma", "brotherhood"], ["☕👁️🩸", "tokyo ghoul"], ["⚔️🎮🏰", "sword art online", "sao"], ["🪚😈🩸", "chainsaw man"], ["🕵️‍♂️👧🥜", "spy x family"],
    ["🛵⏳👊", "tokyo revengers"], ["🤖🩸👼", "evangelion", "neon genesis evangelion"], ["🤠🎷🚀", "cowboy bebop"], ["👁️👑♟️", "code geass"], ["🔬🍌⏱️", "steins gate", "steins;gate"],
    ["🥦👦👻", "mob psycho 100", "mob psycho", "mob"], ["🥊👨‍🦲💥", "one punch man"], ["🪓⛵⚔️", "vinland saga"], ["⭐👊🧛‍♂️", "jojo", "jojos bizarre adventure", "jojo bizarre adventure"], ["🍸♟️💀", "death parade"],
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

let rebusSession = {
    active: false,
    manche: 0,
    themeNom: '',
    items: [],
    currentItem: null,
    expireAt: 0,
    timer: null,
    scores: {},
    compteurMessages: 0
};

const REBUS_GENRES = {
    // Films
    'un film d\'animation / Disney / Pixar': ['ratatouille', 'le roi lion', 'toy story', 'shrek', 'coco', 'vaiana', 'la haut', 'monstres et cie', 'nemo', 'cars', 'raiponce', 'reine des neiges', 'zootopie', 'vice-versa', 'alerte rouge', 'wall-e'],
    'un film ou univers de super-héros': ['spider-man', 'batman', 'joker', 'avengers', 'iron man', 'thor', 'captain america', 'deadpool', 'wolverine', 'x-men', 'superman', 'aquaman', 'wonder woman', 'flash', 'suicide squad'],
    'un film de science-fiction culte': ['star wars', 'matrix', 'inception', 'interstellar', 'alien', 'terminator', 'dune', 'retour vers le futur', 'premier contact', 'gravity', 'jurassic park'],
    'un film d\'action / braquage': ['fast and furious', 'john wick', 'mission impossible', 'james bond', 'die hard', 'top gun', 'taxi', 'drive', 'taken', 'kingsman'],
    'un chef-d\'œuvre du Studio Ghibli': ['le voyage de chihiro', 'princesse mononoke', 'mon voisin totoro', 'le chateau ambulant', 'le tombeau des lucioles'],
    'un film d\'horreur ou épouvante': ['shining', 'saw', 'conjuring', 'annabelle', 'scream', 'halloween', 'ca', 'sans un bruit', 'get out', 'us', 'vendredi 13', 'freddy'],

    // Jeux Vidéo
    'un FPS / jeu de tir tactique': ['valorant', 'counter strike', 'call of duty', 'battlefield', 'overwatch', 'apex legends', 'rainbow six siege', 'doom', 'halo', 'team fortress 2'],
    'une franchise ou grand classique Nintendo': ['mario', 'zelda', 'pokemon', 'animal crossing', 'kirby', 'splatoon', 'smash bros', 'donkey kong', 'metroid'],
    'un Souls-like ou jeu d\'action exigeant': ['dark souls', 'bloodborne', 'elden ring', 'sekiro', 'demon souls', 'hades'],
    'un jeu de survie / craft': ['minecraft', 'terraria', 'rust', 'the forest', 'ark', 'subnautica', 'raft', 'dont starve', 'palworld'],
    'un jeu de combat': ['street fighter', 'tekken', 'mortal kombat', 'dragon ball fighterz', 'smash bros'],
    'un jeu de course': ['mario kart', 'rocket league', 'forza', 'need for speed', 'gran turismo', 'f1'],
    'un jeu d\'horreur': ['five nights at freddys', 'poppy playtime', 'phasmophobia', 'slender', 'resident evil', 'silent hill', 'outlast', 'dead space', 'dead by daylight'],

    // Séries
    'une sitcom / comédie': ['friends', 'how i met your mother', 'the big bang theory', 'brooklyn nine-nine', 'the office', 'malcolm', 'kaamelott', 'h', 'camera cafe'],
    'une série dramatique ou thriller culte': ['breaking bad', 'better call saul', 'peaky blinders', 'squid game', 'la casa de papel', 'dexter', 'prison break', 'sherlock', 'black mirror', 'dark', 'stranger things'],
    'une série médicale': ['dr house', 'greys anatomy', 'good doctor', 'urgences', 'scrubs', 'h'],
    'une série médiévale ou fantastique': ['game of thrones', 'house of the dragon', 'the witcher', 'vikings', 'the boys', 'the last of us', 'the walking dead'],

    // Animés
    'un shōnen d\'action culte': ['naruto', 'one piece', 'dragon ball', 'bleach', 'hunter x hunter', 'jujutsu kaisen', 'demon slayer', 'my hero academia', 'attack on titan', 'chainsaw man', 'black clover'],
    'un animé de sport': ['haikyuu', 'blue lock', 'kuroko no basket', 'slam dunk', 'initial d', 'captain tsubasa', 'hajime no ippo'],
    'un animé psychologique ou à mystère': ['death note', 'tokyo ghoul', 'monster', 'psycho-pass', 'code geass', 'steins gate', 'erased', 'detective conan']
};

function genererIndiceRebus(item) {
    if (!item) return "Aucun rébus en cours.";
    const reponses = item.slice(1);
    const titrePrincipal = item[1];

    // 1. Cherche si l'œuvre correspond à un genre connu
    for (const [genreLabel, titresDuGenre] of Object.entries(REBUS_GENRES)) {
        const match = reponses.some(rep => {
            const norm = normaliserRebus(rep);
            return titresDuGenre.some(t => norm === normaliserRebus(t) || norm.includes(normaliserRebus(t)));
        });
        if (match) {
            return `💡 **Indice :** C'est **${genreLabel}** !`;
        }
    }

    // 2. Si aucun genre attribué : masque des initiales de chaque mot
    const masque = titrePrincipal.split(' ').map(mot => {
        if (mot.length <= 2) return mot;
        return mot[0].toUpperCase() + ' ' + '_ '.repeat(mot.length - 1).trim();
    }).join('   ');

    return `💡 **Indice :** Le titre ressemble à :\n# \`${masque}\``;
}

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
    const rebusStats = minijeuxBridge.getRebusStats();
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

function buildRebusEmbed(manche, item, expireAt) {
    return new EmbedBuilder()
        .setColor(0xf39c12)
        .setTitle(`🧩 Manche ${manche}/5`)
        .setDescription(
            `Devine ce que représentent ces emojis :\n\n` +
            `# ${item[0]}\n\n` +
            `⏳ **Temps limite :** 5 minutes (<t:${Math.floor(expireAt / 1000)}:R>) !\n` +
            `💬 *Tape directement le titre dans ce salon !*`
        )
        .setFooter({ text: `Manche ${manche}/5 • Le/la premier.e qui trouve marque 1 point` });
}

async function lancerSessionRebus(guild) {
    const channel = guild.channels.cache.get(REBUS_CHANNEL_ID);
    if (!channel) return;

    const dateKey = getMotusDateKey();
    const theme = getRebusThemeDuJour(dateKey);

    const shuffled = [...theme.pool].sort(() => 0.5 - Math.random());
    const cinqItems = shuffled.slice(0, 5);

    // Injection du rébus forcé par Epsys si configuré
    const motusDataRef = minijeuxBridge.getMotusData() || {};
    if (motusDataRef.prochainRebusForce) {
        cinqItems[0] = motusDataRef.prochainRebusForce;
        delete motusDataRef.prochainRebusForce;
    }

    rebusSession = {
        active: true,
        manche: 0,
        themeNom: theme.nom,
        themeCouleur: theme.couleur,
        items: cinqItems,
        currentItem: null,
        expireAt: 0,
        timer: null,
        scores: {},
        compteurMessages: 0
    };

    const embedAnnonceRebus = new EmbedBuilder()
        .setColor(theme.couleur || 0xf39c12)
        .setTitle('🧩 LE RÉBUS REGAÏEN DU JOUR EST LANCÉ !')
        .setDescription(
            `📢 **Notification :** <@&1559041004114542592>\n\n` +
            `🎭 **Thème du jour :** ${theme.nom}\n` +
            `🎯 **5 manches au programme** • **5 minutes** par manche !\n\n` +
            `*La première manche commence dans quelques secondes...*`
        )
        .setFooter({ text: 'Rébus Regaïen tous les jours à 15h00' });

    await channel.send({
        content: `📢 <@&1559041004114542592> **Le Rébus Regaïen de 15h00 commence !**`,
        embeds: [embedAnnonceRebus]
    });

    setTimeout(() => passerMancheSuivanteRebus(guild), 4000);
}

async function passerMancheSuivanteRebus(guild) {
    const channel = guild.channels.cache.get(REBUS_CHANNEL_ID);
    if (!channel) return;

    rebusSession.manche++;

    if (rebusSession.manche > 5) {
        return terminerSessionRebus(channel);
    }

    const item = rebusSession.items[rebusSession.manche - 1];
    rebusSession.currentItem = item;
    rebusSession.expireAt = Date.now() + 5 * 60 * 1000;
    rebusSession.compteurMessages = 0;

    const { MessageFlags } = require('discord.js');
    const embed = buildRebusEmbed(rebusSession.manche, item, rebusSession.expireAt);
    await channel.send({ embeds: [embed], flags: [MessageFlags.SuppressNotifications] });

    // Indice automatique à 2 min 30 (mi-temps) si personne n'a trouvé
    const mancheEnCours = rebusSession.manche;
    setTimeout(async () => {
        if (!rebusSession.active || !rebusSession.currentItem || rebusSession.manche !== mancheEnCours) return;
        const indice = genererIndiceRebus(item);
        await channel.send(indice);
    }, 150 * 1000);

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

    const raw = message.content.trim().toLowerCase();
    const guessNorm = normaliserRebus(raw);
    if (!guessNorm || guessNorm.length < 1) return false;

    const item = rebusSession.currentItem;
    const reponsesValides = item.slice(1).map(r => normaliserRebus(r));

    // Prise en charge spéciale pour "H"
    const isHSpecial = reponsesValides.includes('h') && (
        guessNorm === 'h' || raw === 'h' || raw === 'la série h' || raw === 'la serie h' || raw === 'série h' || raw === 'serie h'
    );

    if (reponsesValides.includes(guessNorm) || isHSpecial) {
        clearTimeout(rebusSession.timer);
        rebusSession.currentItem = null;

        const uid = message.author.id;
        rebusSession.scores[uid] = (rebusSession.scores[uid] || 0) + 1;
        minijeuxBridge.trackBattlePassProgress?.(uid, 'rebus_win', 1);
        minijeuxBridge.trackBattlePassProgress?.(uid, 'minijeu_win', 1);

        const { MessageFlags } = require('discord.js');
        const titreReponse = item[1].charAt(0).toUpperCase() + item[1].slice(1);
        await message.reply({ 
            content: `✅ **Bravo <@${uid}> !** C'était bien **${titreReponse}** ! (+1 point)`,
            flags: [MessageFlags.SuppressNotifications],
            allowedMentions: { repliedUser: false }
        });

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
    const rebusStats = minijeuxBridge.getRebusStats();

    if (scoresList.length === 0) {
        const embedNul = new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle('🏁 Fin du Rébus Regaïen')
            .setDescription(`Aucun point n'a été marqué aujourd'hui !\nRendez-vous demain à **15h00** pour une nouvelle session !`);
        await channel.send({ embeds: [embedNul] });
        minijeuxBridge.demanderSauvegarde();
        return;
    }

    const maxScore = scoresList[0][1];
    for (const [uid, pts] of scoresList) {
        if (!rebusStats[uid]) rebusStats[uid] = { victoires: 0, points: 0, parties: 0 };
        rebusStats[uid].points += pts;
        rebusStats[uid].parties++;
        if (pts === maxScore) rebusStats[uid].victoires++;
    }
    minijeuxBridge.demanderSauvegarde();

    // Gestion propre des médailles avec ex-æquo (tous les premiers ont 🥇)
    let rangActuel = 1;
    const lignesPodium = scoresList.map(([uid, pts], i) => {
        if (i > 0 && pts < scoresList[i - 1][1]) rangActuel = i + 1;
        const med = rangActuel === 1 ? '🥇' : rangActuel === 2 ? '🥈' : rangActuel === 3 ? '🥉' : `**${rangActuel}.**`;
        return `${med} <@${uid}> — **${pts} point${pts > 1 ? 's' : ''}**`;
    }).join('\n');

    const vainqueurs = scoresList.filter(s => s[1] === maxScore).map(s => `<@${s[0]}>`);
    const texteVictoire = vainqueurs.length > 1
        ? `🤝 **ÉGALITÉ AU SOMMET !** Victoire partagée entre ${vainqueurs.join(' et ')} (**${maxScore} pts**) !`
        : `Félicitations à ${vainqueurs[0]} pour cette victoire (**${maxScore} pts**) !`;

    const embedVictoire = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle('🏆 PODIUM DU RÉBUS REGAÏEN !')
        .setDescription(
            `${texteVictoire}\n\n` +
            `**__Classement de la session :__**\n${lignesPodium}`
        )
        .setFooter({ text: 'Rendez-vous demain à 15h00 ! • !rebus pour voir le statut' });

    const rowStats = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('rebus_view_stats')
            .setLabel('📊 Mes stats Rébus')
            .setStyle(ButtonStyle.Primary)
    );

    const { MessageFlags } = require('discord.js');
    await channel.send({ 
        embeds: [embedVictoire], 
        components: [rowStats],
        flags: [MessageFlags.SuppressNotifications]
    });
}

async function handleRebusMessage(message, response, client, helpers) {
    const rawContent = message.content.trim();
    const args = rawContent.split(/\s+/);
    const cmd = args[0]?.toLowerCase();

    // Commande Epsys pour donner un indice immédiatement
    if (cmd === '!rebus' && args[1]?.toLowerCase() === 'indice') {
        if (message.author.id !== EPSYS_ID) {
            await message.reply("Cette commande est réservée à Epsys.");
            return true;
        }
        if (!rebusSession.active || !rebusSession.currentItem) {
            await message.reply("Aucune manche de Rébus n'est en cours actuellement.");
            return true;
        }
        const indice = genererIndiceRebus(rebusSession.currentItem);
        await message.channel.send(indice);
        return true;
    }

    // Commande Epsys pour décider manuellement du rébus de la prochaine session
    if (cmd === '!rebus' && (args[1]?.toLowerCase() === 'set' || args[1]?.toLowerCase() === 'force')) {
        if (message.author.id !== EPSYS_ID) {
            await message.reply("Cette commande est réservée à Epsys.");
            return true;
        }

        const query = args.slice(2).join(" ").trim();
        if (!query) {
            await message.reply(
                "Usage :\n" +
                "• Choisir un titre existant : `!rebus force titanic`\n" +
                "• Définir un rébus complet : `!rebus force 🚢🧊💔 Titanic`"
            );
            return true;
        }

        // Cas 1 : Rébus complet avec emojis en premier argument
        let itemChoisi = null;
        if (/\p{Extended_Pictographic}/u.test(args[2]) && args[3]) {
            const emojis = args[2];
            const reponse = args.slice(3).join(" ").trim().toLowerCase();
            itemChoisi = [emojis, reponse];
        } else {
            // Cas 2 : Recherche dans tous les pools existants
            const queryNorm = normaliserRebus(query);
            const tousLesPools = [...REBUS_FILMS, ...REBUS_JEUX, ...REBUS_SERIES, ...REBUS_ANIMES];
            itemChoisi = tousLesPools.find(item => item.slice(1).some(rep => normaliserRebus(rep) === queryNorm || rep.toLowerCase().includes(query.toLowerCase())));
        }

        if (!itemChoisi) {
            await message.reply(`❌ Aucun rébus trouvé pour **« ${query} »**. Tu peux aussi définir les emojis directement : \`!rebus force 🚢🧊💔 Titanic\``);
            return true;
        }

        const motusDataRef = minijeuxBridge.getMotusData() || {};
        motusDataRef.prochainRebusForce = itemChoisi;
        minijeuxBridge.demanderSauvegarde();

        const titreAffiche = itemChoisi[1].charAt(0).toUpperCase() + itemChoisi[1].slice(1);
        await message.reply(`✅ Le prochain Rébus de la manche 1 sera : **${itemChoisi[0]}** (*${titreAffiche}*) !`);
        return true;
    }

    // Commande de test Rébus (Epsys-only)
    if (cmd === '!rebustest') {
        if (message.author.id !== EPSYS_ID) {
            await message.reply("Cette commande de test est réservée à Epsys.");
            return true;
        }

        const dateKey = getMotusDateKey();
        const theme = getRebusThemeDuJour(dateKey);
        const itemAlea = theme.pool[Math.floor(Math.random() * theme.pool.length)];
        const expireAt = Date.now() + 5 * 60 * 1000;

        rebusTestSessions.set(message.channel.id, {
            item: itemAlea,
            expireAt,
            themeNom: theme.nom
        });

        const embedTest = new EmbedBuilder()
            .setColor(theme.couleur || 0xf39c12)
            .setTitle(`🧩 [TEST] Manche Rébus Test (${theme.nom})`)
            .setDescription(
                `Devine ce que représentent ces emojis :\n\n` +
                `# ${itemAlea[0]}\n\n` +
                `⏳ **Temps limite :** 5 minutes\n` +
                `💬 *Tape directement le titre dans ce salon !*`
            );

        const rowStop = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`stop_test_rebus_${message.channel.id}`)
                .setLabel('🛑 Stopper le mini-jeu')
                .setStyle(ButtonStyle.Danger)
        );

        await message.reply({
            content: `🧪 **[MODE TEST] Rébus solo lancé !**`,
            embeds: [embedTest],
            components: [rowStop]
        });
        return true;
    }

    // Gestion des réponses dans un salon de test Rébus
    if (rebusTestSessions.has(message.channel.id) && !message.content.startsWith('!')) {
        const sTest = rebusTestSessions.get(message.channel.id);
        if (sTest && Date.now() < sTest.expireAt) {
            const guessNorm = normaliserRebus(message.content);
            const reponsesValides = sTest.item.slice(1).map(r => normaliserRebus(r));

            if (reponsesValides.includes(guessNorm)) {
                rebusTestSessions.delete(message.channel.id);
                const titreReponse = sTest.item[1].charAt(0).toUpperCase() + sTest.item[1].slice(1);
                await message.reply(`✅ **[TEST RÉUSSI]** Bravo ! C'était bien **${titreReponse}** !`);
                return true;
            }
        }
    }

    // 1. Détection des réponses en cours dans le salon Rébus
    if (message.channel.id === REBUS_CHANNEL_ID && rebusSession.active && rebusSession.currentItem && !message.content.startsWith('!')) {
        if (await verifierReponseRebus(message)) return true;

        rebusSession.compteurMessages = (rebusSession.compteurMessages || 0) + 1;
        if (rebusSession.compteurMessages >= 15) {
            rebusSession.compteurMessages = 0;
            const embedRappel = buildRebusEmbed(rebusSession.manche, rebusSession.currentItem, rebusSession.expireAt);
            await message.channel.send({ content: '🔔 **Rappel du rébus à deviner :**', embeds: [embedRappel] });
        }
        return false;
    }

    // Commande de redémarrage d'urgence Rébus (Epsys-only)
    if (cmd === '!rebus' && rawContent.split(/\s+/)[1]?.toLowerCase() === 'restart') {
        if (message.author.id !== EPSYS_ID) {
            await message.reply("Cette commande est réservée à Epsys.");
            return true;
        }

        // Annulation et nettoyage complet de l'ancienne session
        if (rebusSession.timer) clearTimeout(rebusSession.timer);
        rebusSession.active = false;
        rebusSession.currentItem = null;

        await message.reply("♻️ **Session Rébus précédente annulée !** Relance immédiate d'une nouvelle partie (5 manches)...");
        if (message.guild) {
            await lancerSessionRebus(message.guild);
        }
        return true;
    }

    // 2. Commande !rebus
    if (cmd === '!rebus' || cmd === '!decodeur' || cmd === '!emojis' || response?.needsRebus) {
        const { jourStr, h, m, timestamp } = tempsAvantProchainRebus();
        let desc = `Le prochain Rébus Regaïen aura lieu **${jourStr} à 15h00** (dans **${h}h ${m}min**, <t:${timestamp}:R>) !\n\n` +
                   `📍 **Salon officiel :** <#${REBUS_CHANNEL_ID}>\n` +
                   `-# *Thème mystère révélé au début de la partie.*`;

        if (rebusSession.active && rebusSession.currentItem) {
            const expireTimestamp = Math.floor(rebusSession.expireAt / 1000);
            desc = `🎮 **Le Rébus Regaïen est EN COURS !**\n\n` +
                   `📍 **Joue directement dans :** <#${REBUS_CHANNEL_ID}>\n` +
                   `📍 **Manche en cours :** ${rebusSession.manche}/5\n` +
                   `⏳ **Fin de la manche :** <t:${expireTimestamp}:R> !\n\n` +
                   `Prochaine session complète : **${jourStr} à 15h00** (<t:${timestamp}:R>).`;
        }

        const embed = new EmbedBuilder()
            .setColor(0xf39c12)
            .setTitle(rebusSession.active ? '🧩 RÉBUS REGAÏEN EN COURS !' : '🧩 Rébus Regaïen Quotidien (15h00)')
            .setDescription(desc);

        await message.reply({ embeds: [embed] });
        return true;
    }

    // 3. Commande !rebusstats
    if (cmd === '!rebusstats' || cmd === '!rebusstat' || response?.needsRebusStats) {
        let cible = message.mentions.members.first();
        if (!cible) {
            const query = message.content.trim().split(/\s+/).slice(1).join(" ");
            if (query && helpers?.findMemberByName) cible = helpers.findMemberByName(message.guild, query).found;
        }
        if (!cible) cible = message.member;

        const embed = buildRebusStatsEmbed(cible);
        await message.reply({ embeds: [embed] });
        return true;
    }

    return false;
}

async function handleRebusButton(interaction) {
    if (!interaction.isButton()) return false;

    if (interaction.customId.startsWith('stop_test_rebus_')) {
        if (interaction.user.id !== EPSYS_ID) {
            await interaction.reply({ content: "Seule Epsys peut arrêter ce test.", ephemeral: true });
            return true;
        }
        const chId = interaction.customId.replace('stop_test_rebus_', '');
        const session = rebusTestSessions.get(chId);
        const reponse = session?.item ? session.item[1] : 'inconnue';
        rebusTestSessions.delete(chId);
        await interaction.update({ components: [] });
        await interaction.channel.send(`🛑 **Test Rébus arrêté !** La réponse était : **${reponse}**.`);
        return true;
    }

    if (interaction.customId === 'rebus_view_stats') {
        const member = interaction.member;
        const embed = buildRebusStatsEmbed(member);
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return true;
    }
    return false;
}

async function handleRebusSlash(interaction) {
    const commandName = interaction.commandName;

    if (commandName === 'rebus' || commandName === 'decodeur') {
        const { jourStr, h, m, timestamp } = tempsAvantProchainRebus();
        let desc = `Le prochain Rébus Regaïen aura lieu **${jourStr} à 15h00** (dans **${h}h ${m}min**, <t:${timestamp}:R>) !\n-# *Thème mystère révélé au début de la partie.*`;

        if (rebusSession.active && rebusSession.currentItem) {
            const expireTimestamp = Math.floor(rebusSession.expireAt / 1000);
            desc = `🎮 **Le Rébus Regaïen est EN COURS dans <#${REBUS_CHANNEL_ID}> !**\n\n` +
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

    return false;
}

// ==========================================
//   LOGIQUE DU PANNEAU !JEUPTS (EPSYS-ONLY)
// ==========================================

const JEUPTS_LABELS = {
    'motus_victoires': '🟩 Motus — Victoires',
    'motus_parties': '🟩 Motus — Parties jouées',
    'rebus_points': '🧩 Rébus — Points totaux',
    'rebus_victoires': '🧩 Rébus — Victoires de session',
    'rebus_parties': '🧩 Rébus — Parties jouées',
    'pendu_points': '🪢 Pendu — Points totaux',
    'pendu_victoires': '🪢 Pendu — Victoires',
    'pendu_parties': '🪢 Pendu — Parties jouées'
};

function buildJeuPtsEmbed(guild, targetUserId, selectedStat = 'motus_victoires', feedback = null) {
    const member = guild?.members.cache.get(targetUserId);
    const nom = member?.displayName || `<@${targetUserId}>`;
    const avatar = member?.user?.displayAvatarURL({ dynamic: true, size: 256 }) || null;

    const motusStats = minijeuxBridge.getMotusStats();
    const rebusStats = minijeuxBridge.getRebusStats();
    const penduStats = minijeuxBridge.getPenduStats ? minijeuxBridge.getPenduStats() : {};

    const m = motusStats[targetUserId] ?? { victoires: 0, parties: 0 };
    const r = rebusStats[targetUserId] ?? { points: 0, victoires: 0, parties: 0 };
    const p = penduStats[targetUserId] ?? { points: 0, victoires: 0, parties: 0 };

    const scoreGlobal = (m.victoires * 3) + r.points + p.points;

    let desc = `Panneau d'administration des scores de **${nom}**.\n\n`;
    if (feedback) {
        desc += `🔔 **Dernière action :** ${feedback}\n\n`;
    }
    desc += `👉 **Statistique actuellement ciblée :** **${JEUPTS_LABELS[selectedStat] || 'Non définie'}**\n` +
            `-# *Utilise les boutons ci-dessous pour modifier cette statistique spécifique.*`;

    const embed = new EmbedBuilder()
        .setColor(feedback ? 0x2ecc71 : 0xf1c40f)
        .setTitle(`🎮 Gestionnaire des Scores — ${nom}`)
        .setDescription(desc)
        .addFields(
            {
                name: '🟩 MOTUS',
                value: `• **Victoires :** \`${m.victoires}\`\n• **Parties :** \`${m.parties}\``,
                inline: true
            },
            {
                name: '🧩 RÉBUS REGAÏEN',
                value: `• **Points :** \`${r.points}\`\n• **Victoires :** \`${r.victoires}\`\n• **Parties :** \`${r.parties}\``,
                inline: true
            },
            {
                name: '🪢 PENDU QUOTIDIEN',
                value: `• **Points :** \`${p.points}\`\n• **Victoires :** \`${p.victoires}\`\n• **Parties :** \`${p.parties}\``,
                inline: true
            },
            {
                name: '🏆 SCORE GLOBAL COMBINÉ',
                value: `🌟 **${scoreGlobal} points cumulés**\n-# *(3 pts / vic. Motus • 1 pt / manche Rébus • 3 pts / vic. Pendu)*`,
                inline: false
            }
        )
        .setFooter({ text: 'Commande Epsys-Only • Sauvegarde automatique' })
        .setTimestamp();

    if (avatar) embed.setThumbnail(avatar);
    return embed;
}

function buildJeuPtsComponents(targetUserId, selectedStat = 'motus_victoires') {
    const motusStats = minijeuxBridge.getMotusStats();
    const rebusStats = minijeuxBridge.getRebusStats();
    const penduStats = minijeuxBridge.getPenduStats ? minijeuxBridge.getPenduStats() : {};

    const m = motusStats[targetUserId] ?? { victoires: 0, parties: 0 };
    const r = rebusStats[targetUserId] ?? { points: 0, victoires: 0, parties: 0 };
    const p = penduStats[targetUserId] ?? { points: 0, victoires: 0, parties: 0 };

    const rowUser = new ActionRowBuilder().addComponents(
        new UserSelectMenuBuilder()
            .setCustomId(`jeupts:user:${selectedStat}`)
            .setPlaceholder('👤 Choisir un autre membre...')
    );

    const rowStat = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`jeupts:stat:${targetUserId}`)
            .setPlaceholder('🎯 Choisir la statistique à modifier...')
            .addOptions([
                { label: `🟩 Motus : Victoires (Actuel : ${m.victoires})`, value: 'motus_victoires', default: selectedStat === 'motus_victoires' },
                { label: `🟩 Motus : Parties jouées (Actuel : ${m.parties})`, value: 'motus_parties', default: selectedStat === 'motus_parties' },
                { label: `🧩 Rébus : Points totaux (Actuel : ${r.points} pts)`, value: 'rebus_points', default: selectedStat === 'rebus_points' },
                { label: `🧩 Rébus : Victoires (Actuel : ${r.victoires})`, value: 'rebus_victoires', default: selectedStat === 'rebus_victoires' },
                { label: `🧩 Rébus : Parties jouées (Actuel : ${r.parties})`, value: 'rebus_parties', default: selectedStat === 'rebus_parties' },
                { label: `🪢 Pendu : Points totaux (Actuel : ${p.points} pts)`, value: 'pendu_points', default: selectedStat === 'pendu_points' },
                { label: `🪢 Pendu : Victoires (Actuel : ${p.victoires})`, value: 'pendu_victoires', default: selectedStat === 'pendu_victoires' },
                { label: `🪢 Pendu : Parties jouées (Actuel : ${p.parties})`, value: 'pendu_parties', default: selectedStat === 'pendu_parties' }
            ])
    );

    const rowButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`jeupts:act:${targetUserId}:${selectedStat}:add1`).setLabel('➕ +1').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`jeupts:act:${targetUserId}:${selectedStat}:add5`).setLabel('➕ +5').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`jeupts:act:${targetUserId}:${selectedStat}:sub1`).setLabel('➖ -1').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`jeupts:openmodal:${targetUserId}:${selectedStat}`).setLabel('✏️ Définir...').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`jeupts:act:${targetUserId}:${selectedStat}:reset`).setLabel('🗑️ Remise à 0').setStyle(ButtonStyle.Danger)
    );

    return [rowUser, rowStat, rowButtons];
}

function modifierStatMiniJeu(targetUserId, statKey, action, valeurDirecte = null) {
    const motusStats = minijeuxBridge.getMotusStats();
    const rebusStats = minijeuxBridge.getRebusStats();
    const penduStats = minijeuxBridge.getPenduStats ? minijeuxBridge.getPenduStats() : {};

    if (!motusStats[targetUserId]) motusStats[targetUserId] = { victoires: 0, parties: 0 };
    if (!rebusStats[targetUserId]) rebusStats[targetUserId] = { points: 0, victoires: 0, parties: 0 };
    if (!penduStats[targetUserId]) penduStats[targetUserId] = { points: 0, victoires: 0, parties: 0, hebdo: {} };

    let ref = null;
    let prop = null;

    if (statKey === 'motus_victoires') { ref = motusStats[targetUserId]; prop = 'victoires'; }
    else if (statKey === 'motus_parties') { ref = motusStats[targetUserId]; prop = 'parties'; }
    else if (statKey === 'rebus_points') { ref = rebusStats[targetUserId]; prop = 'points'; }
    else if (statKey === 'rebus_victoires') { ref = rebusStats[targetUserId]; prop = 'victoires'; }
    else if (statKey === 'rebus_parties') { ref = rebusStats[targetUserId]; prop = 'parties'; }
    else if (statKey === 'pendu_points') { ref = penduStats[targetUserId]; prop = 'points'; }
    else if (statKey === 'pendu_victoires') { ref = penduStats[targetUserId]; prop = 'victoires'; }
    else if (statKey === 'pendu_parties') { ref = penduStats[targetUserId]; prop = 'parties'; }

    if (!ref || !prop) return 0;

    if (action === 'add1') ref[prop] = (ref[prop] || 0) + 1;
    else if (action === 'add5') ref[prop] = (ref[prop] || 0) + 5;
    else if (action === 'sub1') ref[prop] = Math.max(0, (ref[prop] || 0) - 1);
    else if (action === 'reset') ref[prop] = 0;
    else if (action === 'set' && valeurDirecte !== null) ref[prop] = Math.max(0, valeurDirecte);

    minijeuxBridge.demanderSauvegarde();
    return ref[prop];
}

async function handleJeuPtsInteraction(interaction) {
    if (interaction.user.id !== EPSYS_ID) {
        return interaction.reply({ content: "Ce panneau est réservé à Epsys 😌", ephemeral: true });
    }

    const id = interaction.customId;

    // 1. Changement de membre (UserSelectMenu)
    if (id.startsWith('jeupts:user:')) {
        const selectedStat = id.replace('jeupts:user:', '');
        const targetUserId = interaction.values[0];
        const embed = buildJeuPtsEmbed(interaction.guild, targetUserId, selectedStat);
        const components = buildJeuPtsComponents(targetUserId, selectedStat);
        await interaction.update({ embeds: [embed], components });
        return true;
    }

    // 2. Changement de stat ciblée (StringSelectMenu)
    if (id.startsWith('jeupts:stat:')) {
        const targetUserId = id.replace('jeupts:stat:', '');
        const selectedStat = interaction.values[0];
        const embed = buildJeuPtsEmbed(interaction.guild, targetUserId, selectedStat);
        const components = buildJeuPtsComponents(targetUserId, selectedStat);
        await interaction.update({ embeds: [embed], components });
        return true;
    }

    // 3. Actions rapides par boutons (+1, +5, -1, reset)
    if (id.startsWith('jeupts:act:')) {
        const [, , targetUserId, selectedStat, action] = id.split(':');
        const nouveauScore = modifierStatMiniJeu(targetUserId, selectedStat, action);

        const actionsTexte = {
            'add1': `✅ **+1** ajouté ! *(Nouveau score : **${nouveauScore}**)*`,
            'add5': `✅ **+5** ajoutés ! *(Nouveau score : **${nouveauScore}**)*`,
            'sub1': `➖ **-1** retiré ! *(Nouveau score : **${nouveauScore}**)*`,
            'reset': `🗑️ Statistique remise à **0** !`
        };

        const feedback = actionsTexte[action] || `Stat mise à jour : **${nouveauScore}**`;
        const embed = buildJeuPtsEmbed(interaction.guild, targetUserId, selectedStat, feedback);
        const components = buildJeuPtsComponents(targetUserId, selectedStat);
        await interaction.update({ embeds: [embed], components });
        return true;
    }

    // 4. Ouverture de la Modal de saisie directe
    if (id.startsWith('jeupts:openmodal:')) {
        const [, , targetUserId, selectedStat] = id.split(':');
        const modal = new ModalBuilder()
            .setCustomId(`jeupts:submodal:${targetUserId}:${selectedStat}`)
            .setTitle('Définir le score manuellement');

        const input = new TextInputBuilder()
            .setCustomId('jeupts_input_val')
            .setLabel(`Valeur pour ${JEUPTS_LABELS[selectedStat] || 'la stat'}`)
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Entre un nombre entier (ex: 12)')
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
        return true;
    }

    // 5. Validation de la Modal
    if (interaction.isModalSubmit() && id.startsWith('jeupts:submodal:')) {
        const [, , targetUserId, selectedStat] = id.split(':');
        const valStr = interaction.fields.getTextInputValue('jeupts_input_val').trim();
        const num = parseInt(valStr, 10);

        if (isNaN(num) || num < 0) {
            return interaction.reply({ content: "❌ Nombre invalide ! Entre un nombre entier positif.", ephemeral: true });
        }

        const nouveauScore = modifierStatMiniJeu(targetUserId, selectedStat, 'set', num);
        const feedback = `✏️ Défini manuellement à **${nouveauScore}** !`;
        const embed = buildJeuPtsEmbed(interaction.guild, targetUserId, selectedStat, feedback);
        const components = buildJeuPtsComponents(targetUserId, selectedStat);
        await interaction.update({ embeds: [embed], components });
        return true;
    }

    return false;
}

module.exports = {
    MOTUS_CHANNEL_ID,
    REBUS_CHANNEL_ID,
    initMinijeuxState,
    initMotusState,
    getMotusDateKey,
    getMotDuJour,
    evaluerMotus,
    buildMotusEmbed,
    buildMotusStatsEmbed,
    envoyerMotusQuotidien,
    tempsAvantProchainMotus,
    handleMotusMessage,
    handleMotusButton,
    handleMotusSlash,
    lancerSessionRebus,
    handleRebusMessage,
    handleRebusButton,
    handleRebusSlash
};