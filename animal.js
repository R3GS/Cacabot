// =========================
//     LOGIQUE !ANIMAL
// =========================

function getAnimalResponse(message, cibleUser, botUserId) {
    const cible = cibleUser ?? message.mentions.users.first();

    const cibleNom = cible
        ? (message.guild?.members.cache.get(cible.id)?.displayName ?? cible.username)
        : null;

    const base = cible
        ? (cible.id === botUserId
            ? "Mon animal spirituel est..."
            : `Hmmm, l'animal spirituel de **${cibleNom}** est...`)
        : "Hmmm, ton animal spirituel est...";

    const animauxMasc = [
        "Un rat de RER", "Un pigeon", "Un chat errant", "Un renard", "Un dauphin", "Un corbeau", "Un hamster", "Un chien", "Un crapaud", "Un panda",
        "Un hérisson", "Un taureau", "Un papillon", "Un putain de moustique", "Un axolotl", "Un raton laveur", "Un perroquet", "Un singe",
        "Un poisson", "Un lièvre", "Un scarabée", "Un suricate", "Un éléphant", "Un rhinocéros", "Un toucan", "Un capybara", "Un cheval",
        "Un bousier", "Un pingouin", "Un Pikachu", "Un mulot", "Un cochon", "Un lion", "Un moucheron", "Un chevreuil", "Un castor", "Un chacal",
        "Un aigle", "Un dromadaire", "Un gorille", "Un guépard", "Un hibou", "Un hippopotame", "Un jaguar", "Un kangourou", "Un koala",
        "Un léopard", "Un lynx", "Un phoque", "Un serpent", "Un zèbre", "Un âne", "Un canard", "Un cerf", "Un chameau", "Un coq", "Un dindon",
        "Un lapin", "Un loup", "Un mouton", "Un ours", "Un sanglier", "Un tigre", "Un accarien", "Un crocodile", "Un alligator", "Un cochon dinde",
        "Un furet", "Un alpaga", "Un mille-pattes", "Un ver de terre", "Un bandicoot", "Un blaireau", "Un bonobo", "Un morse"
    ];

    const animauxFem = [
        "Une girafe", "Une loutre", "Une mouette", "Une hyène", "Une mouche", "Une fourmi", "Une horrible araignée", "Une mouche à merde", "Une chouette",
        "Une baleine", "Une hirondelle", "Une lionne", "Une louve", "Une jument", "Une chèvre", "Une chauve-souris", "Une gazelle", "Une vache",
        "Une grenouille", "Une biche", "Une guêpe", "Une brebis", "Une marmotte", "Une souris", "Une dinde", "Une oie", "Une poule", "Une taupe",
        "Une musaraigne", "Une abeille", "Une chienne", "Une chatte", "Une truie", "Une larve", "Une tortue", "Une pieuvre", "Une crevette",
        "Une autruche", "Une coccinelle", "Une belette", "Une sardine", "Une otarie", "Une panthère", "Une huître", "Une moule", "Une antilope"
    ];

    const etatsMasc = [
        "recherché pour le meurtre de 6 enfants.", "vétéran de la Seconde Guerre Mondiale.", "dépressif.", "gay.", "complètement con.", "bourré.",
        "perdu dans sa vie.", "plombier, mais aussi docteur, ingénieur, professeur, livreur de pizza, méchanicien, soldat, policier et astronaute.",
    ];

    const etatsFem = [
        "recherchée pour le meurtre de 6 enfants.", "dépressive.", "lesbienne.", "complètement conne.", "bourrée.", "perdue dans sa vie."
    ];

    const etatsNeutres = [
        "en burn-out.", "sous coke.", "qui a la diarrhée.", "alcoolique.", "casse-couilles.", "qui collectionne les bouchons de liège.", "qui fuit l'URSSAF.",
        "asthmatique.", "qui pue du cul.", "de merde.", "transgenre 🏳️‍⚧️", "sataniste.", "fan de Feldup.", "rockstar.", "addict à TikTok.",
        "avec un fort accent belge.", "qui vote RN.", "fan de Norman.", "avec 2 de QI.", "SDF.", "sous kétamine.", "qui s'est chié dessus.",
        "addict à l'Oasis Tropical.", "DJ en Teknival.", "de la mafia italienne.", "adepte du fameux «je ne suis pas raciste, j'ai un ami noir».",
        "coprophage.", "à la recherche du gros JDG.", "qui se lève à 4h du mat pour aller au taf.", "sous traitement hormonal.",
        "en manifestation LGBT.", "qui pleure sur un exercice de maths devant son père qui lui gueule dessus.", "genderfluid.",
        "en 4K Ultra HD IMAX Surround Dolby Digital.", "devant une série Netflix de merde.", "qui utilise la commande !destin.", "trisomique.",
        "qui étale son caca sur les murs.", "nostalgique des années 2000.", "transphobe.", "raciste.", "qui a raté 6 fois son bac.", "qui adore McFly & Calito."
    ];

    const isFem = Math.random() < 0.5;
    const animalList = isFem ? animauxFem : animauxMasc;
    const etatList = isFem ? [...etatsFem, ...etatsNeutres] : [...etatsMasc, ...etatsNeutres];

    const animal = animalList[Math.floor(Math.random() * animalList.length)];
    const etat = etatList[Math.floor(Math.random() * etatList.length)];

    return `${base}\n**${animal} ${etat}**`;
}

module.exports = { getAnimalResponse };