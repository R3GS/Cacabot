const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const MOTUS_CHANNEL_ID = '1556089022718152764';

// Pont de persistance avec index.js (pour loadAll / saveAll)
let minijeuxBridge = {
    getMotusData: () => ({ dateKey: 0, mot: '', termine: false, vainqueurId: null, tentatives: {}, messageId: null }),
    setMotusData: () => {},
    getMotusStats: () => ({}),
    setMotusStats: () => {},
    getRebusStats: () => ({}),
    setRebusStats: () => {},
    demanderSauvegarde: () => {}
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
    const longueur = heureSession === 19 ? 7 : 6;
    const sessionKey = `${dateKey}_${heureSession}h`;
    const mot = getMotDuJour(dateKey + (heureSession === 19 ? 999 : 0), longueur);
    const expireAt = Date.now() + 60 * 60 * 1000;

    const nouvelleData = {
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

    if (message.channel.id === MOTUS_CHANNEL_ID && !message.content.startsWith('!')) {
        const now = Date.now();
        if (!motusData.mot || motusData.termine || (motusData.expireAt && now >= motusData.expireAt)) {
            if (!motusData.termine && motusData.expireAt && now >= motusData.expireAt) {
                motusData.termine = true;
                minijeuxBridge.demanderSauvegarde();
            }
            return false;
        }

        const rawGuess = message.content.trim().toUpperCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^A-Z]/g, "");

        const longueurAttendue = motusData.longueur || 6;

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

            if (rawGuess === motDuJour) {
                motusData.termine = true;
                motusData.vainqueurId = message.author.id;
                motusStats[message.author.id].victoires++;
                minijeuxBridge.demanderSauvegarde();

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
                return true;
            } else {
                minijeuxBridge.demanderSauvegarde();
                const infoReste = essaiNum === 3 
                    ? `\n-# *Tu as épuisé tes 3 essais pour cette session !*`
                    : `\n-# *Il te reste ${3 - essaiNum} essai${(3 - essaiNum) > 1 ? 's' : ''} !*`;

                await message.reply({
                    content: `**${lettresEspacées}**\n${grille} *(Essai ${essaiNum}/3)*${ligneAbsentes}${infoReste}`,
                    components: [rowOriginal]
                });
                return true;
            }
        }
    }

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
    if (!interaction.isButton()) return false;

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
    const channel = guild.channels.cache.get(MOTUS_CHANNEL_ID);
    if (!channel) return;

    const dateKey = getMotusDateKey();
    const theme = getRebusThemeDuJour(dateKey);

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
        scores: {},
        compteurMessages: 0
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

    if (rebusSession.manche > 5) {
        return terminerSessionRebus(channel);
    }

    const item = rebusSession.items[rebusSession.manche - 1];
    rebusSession.currentItem = item;
    rebusSession.expireAt = Date.now() + 5 * 60 * 1000;
    rebusSession.compteurMessages = 0;

    const embed = buildRebusEmbed(rebusSession.manche, item, rebusSession.expireAt);
    await channel.send({ embeds: [embed] });

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

async function handleRebusMessage(message, response, client, helpers) {
    // 1. Détection des réponses en cours dans le salon Rébus
    if (message.channel.id === MOTUS_CHANNEL_ID && rebusSession.active && rebusSession.currentItem && !message.content.startsWith('!')) {
        if (await verifierReponseRebus(message)) return true;

        rebusSession.compteurMessages = (rebusSession.compteurMessages || 0) + 1;
        if (rebusSession.compteurMessages >= 15) {
            rebusSession.compteurMessages = 0;
            const embedRappel = buildRebusEmbed(rebusSession.manche, rebusSession.currentItem, rebusSession.expireAt);
            await message.channel.send({ content: '🔔 **Rappel du rébus à deviner :**', embeds: [embedRappel] });
        }
        return false;
    }

    // 2. Commande !rebus
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

        await message.reply({ embeds: [embed] });
        return true;
    }

    // 3. Commande !rebusstats
    if (response?.needsRebusStats) {
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

    return false;
}

module.exports = {
    MOTUS_CHANNEL_ID,
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