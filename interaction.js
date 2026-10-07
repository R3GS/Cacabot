// =========================
//   INTERACTIONS (commandes + boutons)
//   kiss, hug, run, danse, insult, rire, rizz,
//   bang, punch, die, palaref, jailaref, explode, bait, ban
// =========================

const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

// Quelle commande (avec ses alias) correspond à quel "needs..."
const INTERACTION_COMMANDS = {
    "!kiss": "needsKiss", "!bisou": "needsKiss",
    "!run": "needsRun", "!court": "needsRun",
    "!hug": "needsHug", "!calin": "needsHug",
    "!danse": "needsDance", "!dance": "needsDance",
    "!insult": "needsInsult",
    "!rire": "needsLaugh",
    "!rizz": "needsRizz",
    "!bang": "needsBang", "!tir": "needsBang", "!pan": "needsBang",
    "!punch": "needsPunch", "!frappe": "needsPunch",
    "!palaref": "needsPalaref", "!pref": "needsPalaref",
    "!jailaref": "needsJailaref", "!glaref": "needsJailaref", "!gref": "needsJailaref",
    "!explode": "needsExplode", "!explose": "needsExplode",
    "!bait": "needsBait",
    "!ban": "needsBan",
    "!die": "needsDie"
};

const MESSAGE_FLAGS = [...new Set(Object.values(INTERACTION_COMMANDS))];

const BUTTON_PREFIXES = [
    "run_join_", "kiss_back_", "hug_back_", "dance_join_", "dance_back_",
    "insult_back_", "laugh_with_", "rizz_back_", "bang_back_", "punch_back_", "die_with_",
    "palaref_aussi_", "palaref_with_", "jailaref_with_", "explode_with_", "bait_venge_"
];

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
//   COMMANDES (messages)
// =========================

async function runInteractionMessage(message, response, client, { findMemberByName, askDisambiguation }) {
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

}

// =========================
//   BOUTONS
// =========================

async function runInteractionButton(interaction) {
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
    // BOUTON PALAREF
    // =========================

    if (interaction.isButton() && (interaction.customId.startsWith('palaref_aussi_') || interaction.customId.startsWith('palaref_with_'))) {
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

}

// =========================
//   POINTS D'ENTRÉE (appelés depuis index.js)
// =========================

async function handleInteractionMessage(message, response, client, helpers) {
    if (!MESSAGE_FLAGS.some(flag => response?.[flag])) return false;
    await runInteractionMessage(message, response, client, helpers);
    return true;
}

async function handleInteractionButton(interaction) {
    if (!interaction.isButton()) return false;
    if (!BUTTON_PREFIXES.some(p => interaction.customId.startsWith(p))) return false;
    await runInteractionButton(interaction);
    return true;
}

module.exports = { INTERACTION_COMMANDS, handleInteractionMessage, handleInteractionButton };