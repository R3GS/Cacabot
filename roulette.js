const fs = require('fs');
const path = require('path');
const {
    EmbedBuilder, ActionRowBuilder, ButtonBuilder,
    StringSelectMenuBuilder, UserSelectMenuBuilder, ButtonStyle, ChannelType,
    ModalBuilder, TextInputBuilder, TextInputStyle,
    AttachmentBuilder, MessageFlags
} = require('discord.js');
const { createCanvas, loadImage } = require('canvas');

function resolveRouletteBgPath() {
    const dirs = [
        path.join(process.cwd(), 'Roulette', 'Assets'),
        path.join(__dirname, 'Roulette', 'Assets')
    ];
    const candidates = ['background.png', 'background.jpg', 'background.jpeg', 'background.webp'];
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) continue;
        try {
            const files = fs.readdirSync(dir);
            for (const target of candidates) {
                const found = files.find(f => f.toLowerCase() === target);
                if (found) return path.join(dir, found);
            }
        } catch {}
    }
    return null;
}
const ROULETTE_BG_PATH = resolveRouletteBgPath() || path.join(process.cwd(), 'Roulette', 'Assets', 'Background.png');

const ROULETTE_HUB_AUTO_DELETE_MS = 20 * 60 * 1000; // 20 min (Hub uniquement)
const rouletteHubAutoDeleteTimers = new Map();

function canControlRouletteOwner(userId, ownerId) {
    return !ownerId || userId === ownerId || userId === bridge.EPSYS_ID;
}

function cancelRouletteHubAutoDelete(messageId) {
    if (!messageId) return;
    const t = rouletteHubAutoDeleteTimers.get(messageId);
    if (t) {
        clearTimeout(t);
        rouletteHubAutoDeleteTimers.delete(messageId);
    }
}

function scheduleRouletteHubAutoDelete(msg, triggerMessage = null) {
    if (!msg?.id || msg.flags?.has?.(MessageFlags.Ephemeral)) return msg;
    cancelRouletteHubAutoDelete(msg.id);
    const timer = setTimeout(async () => {
        rouletteHubAutoDeleteTimers.delete(msg.id);
        const refId = triggerMessage?.id || msg.reference?.messageId;
        if (refId && msg.channel) {
            const trig = triggerMessage || await msg.channel.messages.fetch(refId).catch(() => null);
            if (trig && !trig.author?.bot) {
                await trig.delete().catch(() => {});
            }
        }
        await msg.delete().catch(() => {});
    }, ROULETTE_HUB_AUTO_DELETE_MS);
    timer.unref?.();
    rouletteHubAutoDeleteTimers.set(msg.id, timer);
    return msg;
}

function buildRouletteAccueilButton(ownerId) {
    return new ButtonBuilder()
        .setCustomId(`rlt_hub:home:${ownerId}`)
        .setLabel('Accueil')
        .setEmoji('🏠')
        .setStyle(ButtonStyle.Secondary);
}

function buildRouletteCloseButton(ownerId) {
    return new ButtonBuilder()
        .setCustomId(`rlt_close:${ownerId}`)
        .setLabel('Fermer')
        .setEmoji('🗑️')
        .setStyle(ButtonStyle.Danger);
}
const ROULETTE_GIFS_DIR = path.join(process.cwd(), 'Roulette', 'GIFs');
const ROULETTE_PROXIES_DIR = path.join(process.cwd(), 'Roulette', 'Proxies');

const RLT_PROXY_TTL_MS = 2 * 60 * 1000;
const RLT_PROXY_MAX_RAM = 120;
const rltAvatarProxyRam = new Map();
const rltAvatarProxyInFlight = new Map();
let rltProxyRamTimer = null;
let rltLastProxyWriteError = null;
let rltProxyWarmupRunning = false;

function scheduleRltProxyRamClear() {
    if (rltProxyRamTimer) clearTimeout(rltProxyRamTimer);
    rltProxyRamTimer = setTimeout(() => {
        rltAvatarProxyRam.clear();
        rltProxyRamTimer = null;
    }, RLT_PROXY_TTL_MS);
}

function getMemberAvatarProxyInfo(member, size = 256) {
    const userId = member?.id || member?.user?.id;
    const hash = member?.avatar || member?.user?.avatar || 'default';
    const url = member?.displayAvatarURL?.({ extension: 'png', size })
        || member?.user?.displayAvatarURL?.({ extension: 'png', size })
        || null;
    const filePath = userId ? path.join(ROULETTE_PROXIES_DIR, `${userId}_${hash}_${size}.png`) : null;
    return { userId, hash, url, filePath };
}

async function loadAvatarProxy(member, size = 256) {
    const { userId, url, filePath } = getMemberAvatarProxyInfo(member, size);
    if (!userId || !filePath) return null;

    if (rltAvatarProxyRam.has(filePath)) {
        scheduleRltProxyRamClear();
        return rltAvatarProxyRam.get(filePath);
    }
    if (rltAvatarProxyInFlight.has(filePath)) {
        return rltAvatarProxyInFlight.get(filePath);
    }

    const promise = (async () => {
        try {
            if (fs.existsSync(filePath)) {
                const img = await loadImage(filePath);
                if (rltAvatarProxyRam.size >= RLT_PROXY_MAX_RAM) {
                    rltAvatarProxyRam.delete(rltAvatarProxyRam.keys().next().value);
                }
                rltAvatarProxyRam.set(filePath, img);
                scheduleRltProxyRamClear();
                return img;
            }
            if (!url) return null;
            const rawImg = await loadImage(url);
            const c = createCanvas(size, size);
            const cctx = c.getContext('2d');
            cctx.drawImage(rawImg, 0, 0, size, size);
            const pngBuf = c.toBuffer('image/png');
            try {
                fs.mkdirSync(ROULETTE_PROXIES_DIR, { recursive: true });
                for (const existing of fs.readdirSync(ROULETTE_PROXIES_DIR)) {
                    if (existing.startsWith(`${userId}_`) && existing.endsWith(`_${size}.png`) && path.join(ROULETTE_PROXIES_DIR, existing) !== filePath) {
                        fs.rmSync(path.join(ROULETTE_PROXIES_DIR, existing), { force: true });
                    }
                }
                fs.writeFileSync(filePath, pngBuf);
                rltLastProxyWriteError = null;
            } catch (err) {
                rltLastProxyWriteError = err.message;
            }
            const img = await loadImage(pngBuf);
            if (rltAvatarProxyRam.size >= RLT_PROXY_MAX_RAM) {
                rltAvatarProxyRam.delete(rltAvatarProxyRam.keys().next().value);
            }
            rltAvatarProxyRam.set(filePath, img);
            scheduleRltProxyRamClear();
            return img;
        } catch {
            return null;
        } finally {
            rltAvatarProxyInFlight.delete(filePath);
        }
    })();

    rltAvatarProxyInFlight.set(filePath, promise);
    return promise;
}

function walkRouletteProxyStats() {
    if (!fs.existsSync(ROULETTE_PROXIES_DIR)) return { files: 0, bytes: 0 };
    let files = 0;
    let bytes = 0;
    try {
        for (const f of fs.readdirSync(ROULETTE_PROXIES_DIR)) {
            if (f.startsWith('.')) continue;
            const st = fs.statSync(path.join(ROULETTE_PROXIES_DIR, f));
            if (st.isFile()) {
                files++;
                bytes += st.size;
            }
        }
    } catch {}
    return { files, bytes };
}

function purgeRouletteProxies() {
    rltAvatarProxyRam.clear();
    if (rltProxyRamTimer) {
        clearTimeout(rltProxyRamTimer);
        rltProxyRamTimer = null;
    }
    let removed = 0;
    if (fs.existsSync(ROULETTE_PROXIES_DIR)) {
        for (const f of fs.readdirSync(ROULETTE_PROXIES_DIR)) {
            if (f.startsWith('.')) continue;
            try {
                fs.rmSync(path.join(ROULETTE_PROXIES_DIR, f), { recursive: true, force: true });
                removed++;
            } catch {}
        }
    }
    rltLastProxyWriteError = null;
    return removed;
}

async function runRouletteAvatarWarmup(guild, onProgress) {
    if (rltProxyWarmupRunning) return null;
    rltProxyWarmupRunning = true;
    const startedAt = Date.now();
    try {
        const members = [...(guild?.members?.cache?.values() || [])].filter(m => m && m.user && !m.user.bot);
        const total = members.length;
        let done = 0, generated = 0, alreadyOnDisk = 0, failed = 0;

        for (const m of members) {
            const { filePath } = getMemberAvatarProxyInfo(m, 256);
            const existed = filePath && fs.existsSync(filePath);
            const img = await loadAvatarProxy(m, 256);
            done++;
            if (img) {
                if (existed) alreadyOnDisk++;
                else generated++;
            } else {
                failed++;
            }
            if (onProgress && (done % 25 === 0 || done === total)) {
                const pct = total > 0 ? Math.round((done / total) * 100) : 100;
                await onProgress(
                    `🔥 **Warmup PP Roulette en cours...**\n` +
                    `• Progression : **${done}/${total}** (**${pct}%**)\n` +
                    `• Créées : **${generated}** • Déjà en cache : **${alreadyOnDisk}**${failed ? ` • Échecs : **${failed}**` : ''}`
                );
            }
        }

        const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
        const stats = walkRouletteProxyStats();
        const mb = (stats.bytes / (1024 * 1024)).toFixed(2);
        const errLine = rltLastProxyWriteError
            ? `\n⚠️ **Erreur disque :** \`${rltLastProxyWriteError}\``
            : '\n✅ **Volume (`Roulette/Proxies`) : OK et persistant !**';

        if (onProgress) {
            await onProgress(
                `✅ **Warmup PP Roulette terminé en ${elapsed}s !**\n` +
                `• **${generated}** PP générée(s) • **${alreadyOnDisk}** déjà prête(s)${failed ? ` • **${failed}** échec(s)` : ''}\n` +
                `• Total sur disque : **${stats.files}** fichier(s) (**${mb} Mo**)` +
                errLine
            );
        }
        return { generated, alreadyOnDisk, failed, stats };
    } finally {
        rltProxyWarmupRunning = false;
    }
}

const ROULETTE_COOLDOWN_MS = 15 * 60 * 1000;
const ROULETTE_COOLDOWN_EXEMPT = ['744217896581857281', '902651805614358568'];
const ROULETTE_JACKPOT_INCREMENT = 0.01;
const ROULETTE_JACKPOT_MAX = 0.5;
const ROULETTE_HOF_CHANNEL_ID = '1554331383361577010';
const ROULETTE_HOS_CHANNEL_ID = '1563294813690929274';
const ROULETTE_SALON_ID = '1553954760900608091';
const ROULETTE_SALON_ADMIN_ID = '1480756332373213275';
const ROULETTE_HOF_SEUIL = 0.0005;
const ROULETTE_HOS_MALUS_IDS = new Set([
    'malus-prime',
    'malus-pseudo-lock-mois',
    'malus-exclu-jour',
    'malus-exclu-semaine',
    'malus-ban'
]);
const ROULETTE_MUTE_MALUS_IDS = new Set([
    'malus-timeout-3min',
    'malus-timeout-5min',
    'malus-timeout-20min'
]);
const ROULETTE_TEXT_MALUS_IDS = new Set([
    'malus-boomer', 'malus-bebe', 'malus-uwu-24h', 'malus-emoji', 'malus-emoji-only',
    'malus-leet', 'malus-caps', 'malus-sans-voyelle', 'malus-sans-consonne',
    'malus-lettre-interdite', 'malus-limite-100', 'malus-limite-30',
    'malus-existentiel', 'malus-linkedin', 'malus-echo', 'malus-censure',
    'malus-mots-melanges', 'malus-lettres-melangees', 'malus-mocking',
    'malus-begaiement', 'malus-publicite', 'malus-autocorrect', 'malus-oyez'
]);
const ROULETTE_ROLE_ADDICT_ID = '1555245236249436160';
const ROULETTE_ADDICT_SEUIL = 500;
const ROULETTE_TAUX_ECHEC = 0.5;
const ROULETTE_PITY_MALUS = 3;
const ROULETTE_PITY_NULS = 5;

function getRouletteGifAsset(filename, attachName) {
    if (!filename || !attachName) return null;
    const filePath = path.join(ROULETTE_GIFS_DIR, filename);
    if (!fs.existsSync(filePath)) return null;
    return new AttachmentBuilder(filePath, { name: attachName });
}

function getRouletteGifForOutcome(outcomeId, texte = '', gifOptions = {}) {
    if (gifOptions?.shieldBlocked) {
        return { file: 'Shield.gif', name: 'rlt_shield.gif' };
    }
    if (outcomeId === 'bonus-elu-roulette') return { file: 'Élu.gif', name: 'rlt_elu.gif' };
    if (outcomeId === 'bonus-epsys-photo') return { file: 'Photo.gif', name: 'rlt_photo.gif' };
    if (outcomeId === 'bonus-epsys-goodies' || outcomeId === 'bonus-partage-bonus') {
        return { file: 'Cadeau.gif', name: 'rlt_cadeau.gif' };
    }

    const entry = ROULETTE_TABLE.find(e => e.id === outcomeId);
    // 777.gif pour les autres bonus Hall of Fame (testé avant TCG pour bonus-regadex-perso)
    if (entry && entry.type === 'bonus' && probaReelle(entry) < ROULETTE_HOF_SEUIL) {
        return { file: '777.gif', name: 'rlt_777.gif' };
    }
    if (outcomeId === 'malus-ban') return { file: 'Ban.gif', name: 'rlt_ban.gif' };
    if (outcomeId === 'malus-prime') return { file: 'Explosion.gif', name: 'rlt_explosion.gif' };
    if (outcomeId === 'special-tournee-generale') return { file: 'Tournée.gif', name: 'rlt_tournee.gif' };
    if (outcomeId === 'malus-chat-noir') return { file: 'Chat noir.gif', name: 'rlt_chat_noir.gif' };
    if (['malus-pseudo-lock-semaine', 'malus-pseudo-lock-mois'].includes(outcomeId)) {
        return { file: 'Name.gif', name: 'rlt_name.gif' };
    }
    if (outcomeId === 'bonus-gif-ou-audio') return { file: 'Papayou.gif', name: 'rlt_papayou.gif' };
    if (outcomeId === 'bonus-epingle') return { file: 'Pin.gif', name: 'rlt_pin.gif' };
    if (outcomeId === 'bonus-jackpot-boost') return { file: 'Boost.gif', name: 'rlt_boost.gif' };
    if (['bonus-redirect-malus', 'bonus-redirect-choix'].includes(outcomeId)) {
        return { file: 'Redirection.gif', name: 'rlt_redirection.gif' };
    }
    if (['bonus-tcg-15pts', 'bonus-tcg-50pts'].includes(outcomeId)) {
        return { file: 'Points.gif', name: 'rlt_points.gif' };
    }
    if (['bonus-bouclier', 'bonus-super-bouclier', 'bonus-anti-feur'].includes(outcomeId)) {
        return { file: 'Shield.gif', name: 'rlt_shield.gif' };
    }
    if (['bonus-cooldown-court', 'bonus-coup-triple'].includes(outcomeId)) {
        return { file: 'Fast.gif', name: 'rlt_fast.gif' };
    }
    if (outcomeId?.startsWith('bonus-tcg-') || outcomeId === 'bonus-booster-consolation') {
        return { file: 'TCG.gif', name: 'rlt_tcg.gif' };
    }
    if (outcomeId === 'bonus-vote-gagnant') return { file: 'Dove.gif', name: 'rlt_dove.gif' };
    if (outcomeId === 'aucun-resultat') return { file: 'No.gif', name: 'rlt_no.gif' };
    if (texte && texte.includes('Miracle !')) return { file: 'Luck.gif', name: 'rlt_luck.gif' };
    if (ROULETTE_MUTE_MALUS_IDS.has(outcomeId) || ['malus-exclu-heure', 'malus-exclu-jour', 'malus-exclu-semaine'].includes(outcomeId)) {
        return { file: 'Mute.gif', name: 'rlt_mute.gif' };
    }
    if (outcomeId === 'malus-cooldown-45' || outcomeId === 'malus-looong-cooldown') {
        return { file: 'Cooldown.gif', name: 'rlt_cooldown.gif' };
    }

    const pickMalusGif = (pool) => {
        if (gifOptions?.malusGifSeed !== undefined) {
            return pool[Math.abs(gifOptions.malusGifSeed) % pool.length];
        }
        let h = 0;
        for (let i = 0; i < (outcomeId || '').length; i++) h = (h * 31 + outcomeId.charCodeAt(i)) | 0;
        return pool[Math.abs(h) % pool.length];
    };
    if (ROULETTE_TEXT_MALUS_IDS.has(outcomeId)) {
        return pickMalusGif([
            { file: 'Laugh.gif', name: 'rlt_laugh.gif' },
            { file: 'Bandage.gif', name: 'rlt_bandage.gif' },
            { file: 'Frown.gif', name: 'rlt_frown.gif' },
            { file: 'Peu.gif', name: 'rlt_peu.gif' }
        ]);
    }
    if (entry?.type === 'bonus') return { file: 'Luck.gif', name: 'rlt_luck.gif' };
    if (entry?.type === 'malus') {
        return pickMalusGif([
            { file: 'Ghost.gif', name: 'rlt_ghost.gif' },
            { file: 'Bandage.gif', name: 'rlt_bandage.gif' },
            { file: 'Frown.gif', name: 'rlt_frown.gif' },
            { file: 'Peu.gif', name: 'rlt_peu.gif' }
        ]);
    }
    return null;
}

function getRouletteOutcomeGifAttachment(outcomeId, texte = '', gifOptions = {}) {
    const info = getRouletteGifForOutcome(outcomeId, texte, gifOptions);
    if (!info) return null;
    return getRouletteGifAsset(info.file, info.name);
}

const ROULETTE_WEBHOOK_EXCLUS = new Set([
    '1553948893354401923', '1544686219223498762', '862253918583390238',
    '730795053563248640', '745115366065176598', '738514269234266242',
    '1480756332373213275', // Salon admin / staff
    '1572459715831664700'  // Catégorie exclue des malus textuels
]);

function estSalonExcluMalusTexte(channel) {
    if (!channel) return false;
    if (ROULETTE_WEBHOOK_EXCLUS.has(channel.id)) return true;
    if (channel.parentId && ROULETTE_WEBHOOK_EXCLUS.has(channel.parentId)) return true;
    if (channel.parent?.parentId && ROULETTE_WEBHOOK_EXCLUS.has(channel.parent.parentId)) return true;
    return false;
}

const ROULETTE_EMOJIS_ALEATOIRES = ['😂','😍','🔥','💀','🎉','😭','👀','🤡','😏','👁️👄👁️','🫦','😡'];
const ROULETTE_BOOMER_FINS = [
    ', A BON ENTENDEUR... 🤣🤣', '.... BISOUS A LA FAMILLE 🍷👍',
    '....PAUVRE FRANCE....\nAmitiés ..', '... A MEDITER ☕🙋‍♂️',
    '....C ETAIT MIEUX AVANT !!!! 😡', '...\nBisous   -Mamie',
    '.... LES JEUNES D AUJOURDHUI NE VEULENT PLUS TRAVAILLER.. bises gérard',
    '.... tapez 1 si vous etes d accord.. amitiés du 77 🌹',
    '.... encore un coup du gouvernement ça !! 🙄😡',
    '.... A PARTAGER EN MASSE AVANT SUPPRESSION FACEBOOK !!!',
    '.... bises a Jean-Pierre et aux gosses ... 🚗🍺',
    '.... de toute façon avec leurs téléphones greffés dans les mains.... 🤦‍♂️📵',
    '.... bon dimanche les loulous !! prenez soin de vous .. ☀️☕',
    '.... c\'est comme les 80 km/h une belle arnaque tout ça !!! 🚗💨',
    '.... Amitiés sincères de Chantal et Daniel .... 💐🐕'
];

const ROULETTE_EXISTENTIEL_FINS = [
    '\nmais bon, au final, on va tous mourir seuls dans le néant...',
    '\net pourtant l\'univers se fiche éperdument de notre existence...',
    '\nest-ce que ça vaut vraiment la peine de continuer à faire semblant...?',
    '\ntout ça pour finir poussière dans un monde indifférent.',
    '\nmais à quoi bon, puisque rien n\'a de sens au fond.',
    '\nun jour plus personne ne se souviendra même de ce message.',
    '\nchaque seconde qui passe nous rapproche inéluctablement du vide.',
    '\net dire que toute cette agitation finira oubliée sous la terre froide.',
    '\nl\'entropie gagne toujours à la fin. Bonne journée quand même.',
    '\non est juste des morceaux de viande qui attendent la fin sur un caillou flottant.',
    '\nnotre conscience n\'est qu\'un bug cosmique condamné à disparaître.',
    '\nà l\'échelle géologique, ce message n\'aura servi rigoureusement à rien.'
];

const ROULETTE_LINKEDIN_FINS = [
    '\nEn tant que leader agile, cette synergie m\'inspire au quotidien. Belle journée à tous ! 🚀 #Mindset #Leadership',
    '\nVoilà pourquoi l\'échec est une formidable opportunité de disruption et de croissance. 💡 #Growth #Success',
    '\nCe matin à 5h30, en prenant ma douche froide, j\'ai réalisé l\'importance de ce KPI. 💼 #MorningRoutine #Networking',
    '\nEt vous, comment réinventez-vous votre valeur ajoutée dans l\'écosystème corporate ? 🤝 #Inspiration #B2B',
    '\nRestez focus sur vos objectifs, l\'excellence opérationnelle n\'attend pas. 📈 #Motivation #Business',
    '\nPrenez 5 minutes pour célébrer vos micro-victoires. Disrupter, c\'est avant tout oser. 🌟 #Proud #TalentAcquisition',
    '\nJ\'ai refusé 15 offres pour vivre cette aventure humaine. La résilience n\'a pas de prix. 🔥 #WorkHard #ScaleUp',
    '\nCe café en terrasse m\'a appris plus sur le management 3.0 que 5 ans d\'école de commerce. ☕ #Authenticity',
    '\nAccepter l\'inconfort, c\'est scaler son capital humain. Et vous, quel a été votre déclic ? 🎯 #GrowthMindset',
    '\nPartagez ce post si vous croyez encore à l\'intrapreneuriat bienveillant en 2026. 💬 #DeepWork #Synergie'
];

const ROULETTE_ECHO_REPLIQUES = [
    "C'est faux", "Gênant.", "Qui a demandé ?", "Ratio.",
    "Intéressant... non en vrai on s'en fout.", "Tu forces un peu là.", "Wow, c'est super intéressant (non)",
    "Supprime.", "Ok et ?", "On s'en branle un peu non ?", "Bizarre ce message.",
    "Oui c'est bien", "Arrête de poster stp.", "Gros malaise...",
    "-# *baille*", "Ok.", "C'est bien Éléonore on est contents.", "Bahh... C'est bien ?", "...Bref, qui a faim ?",
    "https://tenor.com/view/f%C3%A9licitations-je-sais-pas-quoi-te-dire-gif-4771894558253473942",
    "T'avais vraiment besoin d'envoyer ça ?", "D'accord le clown 🤡", "Tu te relis des fois ?"
];

const rouletteEchoUntil = new Map();

const ROULETTE_PUBS_SPONSOR = [
    '\n\n*Message sponsorisé par [Carglass](<https://www.carglass.fr>) : Carglass répare, Carglass remplace !*',
    '\n\n*Publicité : Pour votre santé, mangez au moins cinq fruits et légumes par jour sur [MangerBouger](<https://www.mangerbouger.fr>).*',
    '\n\n*Ce message vous est offert par [NordVPN](<https://nordvpn.com>) : Protégez vos données dès maintenant !*',
    '\n\n*Un coup de barre ? [Mars](<https://www.mars.com>), et ça repart !*',
    '\n\n*Offre exclusive [IKEA](<https://www.ikea.com>) : Retrouvez votre meuble préféré en kit !*',
    '\n\n*Sponsorisé par [Sephora](<https://www.sephora.fr>) : Le pouvoir infini de la beauté.*',
    '\n\n*Besoin d\'énergie ? [Red Bull](<https://www.redbull.com>) vous donne des aiiiles !*',
    '\n\n*Parce que vous le valez bien. [L\'Oréal Paris](<https://www.loreal-paris.fr>).*',
    '\n\n*Ce message est sponsorisé par [Spotify](<https://www.spotify.com>) : Écoutez vos titres favoris sans interruption.*',
    '\n\n*Un break ? Prenez un [KitKat](<https://www.kitkat.fr>) !*'
];

const ROULETTE_AUTOCORRECT_PHRASES = [
    ' strapontin ',
    ' le caca est cuit ',
    ' Epsys je t\'aime énormément, je suis fan de toi depuis des années 💘 ',
    ' AAAAAAAAAAH J\'AI MARCHÉ SUR UN LEGO ',
    ' .............................................. ',
    ' j\'ai mangé un pneu ',
    ' jme suis chié dessus ',
    ' les gros pieds de feldup ',
    ' ...En vrai, quand on y pense, le RN a pas forcément tort, si ? Tout ça pour dire que ',
    ' Mario c\'est pas un jeu c\'est une license '
];

const ROULETTE_OYEZ_INTROS = [
    'Oyez, oyez, braves gens ! ',
    'Or écoutez donc, damoiseaux et damoiselles : ',
    'Par la barbe du Roi, apprenez que ',
    'Gentes dames et nobles seigneurs, sachez que ',
    'Holà manants ! Qu\'on se le dise en Regaïa : ',
    'Sus aux hérétiques ! Voici ma missive : ',
    'Par Saint-Jérémy, je vous le déclare tout net : ',
    'À tous les gueux de la taverne, écoutez ceci : ',
    'Diantre ! Que l\'on fasse sonner le cor, car ',
    'Mes bons sujets, veuillez ouïr ma parole : '
];

const ROULETTE_ACHIEVEMENTS = [
    { id: 'forteresse', nom: 'Forteresse impénétrable', emoji: '🏰', desc: 'Accumuler un total de 10 boucliers dans sa réserve' },
    { id: 'chat-noir', nom: 'Victime du Destin', emoji: '🐈‍⬛', desc: 'Subir la Malédiction du Chat Noir avec +5% de bonus boosté ou plus' },
    { id: 'malus-prime', nom: 'La totale', emoji: '💥', desc: 'Décrocher et subir le MALUS PRIME' },
    { id: 'double-peine', nom: 'La Double Peine', emoji: '⏳', desc: 'Tomber sur Cooldown 45 min alors qu\'il reste des charges actives' },
    { id: 'condamne-plebe', nom: 'Condamnation publique', emoji: '🪓', desc: 'Être exclu.e 1 jour suite au vote public' },
    { id: 'incomprehensible', nom: 'L\'Incompréhensible', emoji: '🔤', desc: 'Cumuler 3 malus de texte ou plus en même temps' },
    { id: 'hof', nom: 'Superstar', emoji: '🏆', desc: 'Décrocher un gain légendaire du Hall of Fame (≤ 0,05%)' },
    { id: 'pare-balles', nom: 'Pare-Balles', emoji: '🛡️', desc: 'Bloquer un mute de 20 min ou une exclusion grâce à un bouclier' },
    { id: 'pharmacien', nom: 'Chimiste en herbe', emoji: '🧪', desc: 'Déclencher la mécanique de contre-poison pour annuler un malus actif' },
    { id: 'braquage-parfait', nom: 'Braquage Parfait', emoji: '🎰', desc: 'Obtenir 3 bonus sur les 3 tirages gratuits d\'un Coup Triple' },
    { id: 'innocente', nom: 'L\'Innocenté.e', emoji: '🕊️', desc: 'Sortir libre d\'un vote public' },
    { id: 'veteran-250', nom: 'Pro du gambling', emoji: '🎲', desc: 'Atteindre 250 tirages au total' },
    { id: 'centurion-500', nom: 'Gambling addict', emoji: '👑', desc: 'Atteindre 500 tirages au total' },
    { id: 'baptiseur', nom: 'Gravé dans la roche', emoji: '✍️', desc: 'Verrouiller le pseudo d\'un.e autre membre avec le bonus Pseudo au choix' },
    { id: 'epingle', nom: 'Maman je passe à la télé !', emoji: '📌', desc: 'Épingler un message dans le salon avec le bonus Message épinglé' },
    { id: 'tournee-patron', nom: 'C\'est ma tournée !', emoji: '🍻', desc: 'Déclencher l\'événement rare de la Tournée générale (1/600)' },
    { id: 'survivant-enfer', nom: 'Survivant.e de l\'Enfer', emoji: '☠️', desc: 'Tirer l\'Exclusion d\'une semaine ou le Ban définitif' },
    { id: 'ascension-sociale', nom: 'L\'Ascension Sociale', emoji: '👑', desc: 'Monter d\'un rang de Regaïen ou toucher Regaïen légendaire' },
    { id: 'jour-de-gloire', nom: 'Jour de Gloire', emoji: '🎂', desc: 'Obtenir un bonus sur la roulette le jour de son anniversaire' },
    { id: 'oiseau-nuit', nom: 'Oiseau de Nuit', emoji: '🔥', desc: 'Effectuer au moins 10 tirages pendant une session d\'Happy Hour' },
    { id: 'sniper-impitoyable', nom: 'Sniper', emoji: '🎯', desc: 'Rediriger avec succès un malus avec la Redirection au choix' },
    { id: 'tete-dure', nom: 'Tête Dure', emoji: '🛡️', desc: 'Esquiver au moins 5 fois le Feur de Cacabot grâce à l\'Anti-Feur' },
    { id: 'laristocrate', nom: 'Aristocrate', emoji: '👑', desc: 'Décrocher le bonus de la Couronne 12h' },
    { id: 'enchainement-fatal', nom: 'Enchaînement Fatal', emoji: '🪨', desc: 'Subir 3 malus consécutifs d\'affilée sans aucun répit' },
    { id: 'silence-radio', nom: 'Silence Radio', emoji: '🤫', desc: 'Subir l\'Exclusion de 1 jour' },
    { id: 'le-sauvetage', nom: 'Sauvetage', emoji: '📈', desc: 'Décrocher un bonus garanti grâce au système de Pity' },
    { id: 'crise-quarantaine', nom: 'Crise de la Quarantaine', emoji: '👶', desc: 'Cumuler le Mode Boomer et le Baby Mode en même temps' },
    { id: 'fan-carlos', nom: 'Fan de Carlos', emoji: '🎶', desc: 'Faire spawn PAPAYOU.mp3 3 fois dans la même journée' },
    { id: 'seum-en-personne', nom: 'Le seum en personne', emoji: '🧻', desc: 'Avoir subi au moins 10 malus différents sur la roulette' },
    { id: 'argent-epsys', nom: 'De l\'argent !', emoji: '💶', desc: 'Recevoir 5€ de la YouTube money d\'Epsys (0,015%)' }
];

const ROULETTE_SECRET_ACHIEVEMENTS = [
    { id: 'secret-minuit', nom: 'Coucou Minuit', emoji: '🌙', desc: 'Lancer la roulette entre 00h00 et 00h05 (heure de Paris)' },
    { id: 'secret-triple-couronne', nom: 'Monarque Absolu.e', emoji: '🤴', desc: 'Décrocher un bonus avec Couronne, Anti-Feur et au moins 5 boucliers actifs' },
    { id: 'secret-kamikaze', nom: 'Touche-à-tout', emoji: '🧨', desc: 'Découvrir au moins 25 résultats différents dans son Roulettodex' },
    { id: 'secret-pingpong', nom: 'Retour à l\'envoyeur', emoji: '🏓', desc: 'Déclencher un contre-poison (Miracle !) en étant sous Malus x2' },
    { id: 'secret-dimanche', nom: 'Enfant du Chaos', emoji: '🌘', desc: 'Tirer la roulette pendant la Roulette Maudite / Dorée du dimanche' }
];

const ROULETTE_NOMS_COMMANDES = {
    timeout3: 'malus-timeout-3min', timeout5: 'malus-timeout-5min', timeout20: 'malus-timeout-20min',
    exclu1h: 'malus-exclu-heure', exclu1j: 'malus-exclu-jour', exclu1semaine: 'malus-exclu-semaine',
    pseudo1semaine: 'malus-pseudo-lock-semaine', pseudo1mois: 'malus-pseudo-lock-mois', ban: 'malus-ban',
    papayou: 'bonus-gif-ou-audio', antifeur: 'bonus-anti-feur', couptriple: 'bonus-coup-triple', cooldowncourt: 'bonus-cooldown-court',
    jackpotboost: 'bonus-jackpot-boost', superbouclier: 'bonus-super-bouclier',
    couronne: 'bonus-couronne', redirect: 'bonus-redirect-malus', rolesup: 'bonus-role-superieur',
    legendaire: 'bonus-legendaire', elu: 'bonus-elu-roulette', youtube: 'bonus-youtube-credit',
    goodies: 'bonus-epsys-goodies', petitdej: 'bonus-epsys-petitdej', twitch: 'bonus-twitch-jeu',
    commande: 'bonus-commande-perso', '5e': 'bonus-epsys-5e', photo: 'bonus-epsys-photo',
    carte: 'bonus-regadex-perso', carteperso: 'bonus-regadex-perso', regadex: 'bonus-regadex-perso',
    pseudochoix: 'bonus-pseudo-choix', epingle: 'bonus-epingle', prime: 'malus-prime', chatnoir: 'malus-chat-noir', boomer: 'malus-boomer',
    uwu: 'malus-uwu-24h', lettre: 'malus-lettre-interdite', emoji: 'malus-emoji', cooldown45: 'malus-cooldown-45',
    bouclier: 'bonus-bouclier', redirectchoix: 'bonus-redirect-choix', leet: 'malus-leet',
    caps: 'malus-caps', emojionly: 'malus-emoji-only', censure: 'malus-censure', mots: 'malus-mots-melanges',
    lettres: 'malus-lettres-melangees', limite100: 'malus-limite-100', limite30: 'malus-limite-30',
    tournee: 'special-tournee-generale', bebe: 'malus-bebe',
    brisebouclier: 'malus-brise-bouclier', existentiel: 'malus-existentiel',
    linkedin: 'malus-linkedin', echo: 'malus-echo',
    vote: 'special-vote-immunite-exclusion',
    votepublic: 'bonus-vote-gagnant', votegagnant: 'bonus-vote-gagnant',
    redirectbonushasard: 'malus-redirect-bonus-hasard', redirectbonuschoix: 'bonus-redirect-bonus-choix',
    zeroconsonne: 'malus-sans-consonne', sansconsonne: 'malus-sans-consonne',
    zerovoyelle: 'malus-sans-voyelle', sansvoyelle: 'malus-sans-voyelle',
    doubletemps: 'malus-double-temps-24h', malusx2: 'malus-double-temps-24h',
    mocking: 'malus-mocking', begaiement: 'malus-begaiement',
    publicite: 'malus-publicite', autocorrect: 'malus-autocorrect',
    looongcooldown: 'malus-looong-cooldown', taxe: 'malus-looong-cooldown',
    pickpocket: 'bonus-pickpocket', echangeurpoison: 'bonus-echangeur-poison',
    partagebonus: 'bonus-partage-bonus', partage: 'bonus-partage-bonus',
    plagiat: 'bonus-plagiat', diviseur: 'bonus-diviseur',
    oyez: 'malus-oyez', medieval: 'malus-oyez',
    tcg15: 'bonus-tcg-15pts', tcg50: 'bonus-tcg-50pts',
    tcg1booster: 'bonus-tcg-1booster', tcg5boosters: 'bonus-tcg-5boosters',
    boosterconsolation: 'bonus-booster-consolation', consolation: 'bonus-booster-consolation'
};

const ROULETTE_TABLE = [
    { id: 'bonus-gif-ou-audio', type: 'bonus', poids: 1/10, nom: 'PAPAYOU.mp3', desc: 'PAPAYOU.mp3' },
    { id: 'bonus-cooldown-court', type: 'bonus', poids: 1/10, nom: 'Cooldown réduit à 5 min', desc: 'Les 3 prochains tirages ont un cooldown de 5 minutes' },
    { id: 'bonus-bouclier', type: 'bonus', poids: 1/12, nom: 'Immunité au prochain malus', desc: 'Immunité au prochain malus' },
    { id: 'bonus-anti-feur', type: 'bonus', poids: 1/15, nom: 'Immunité Anti-Feur (24h)', desc: 'Cacabot réagit avec 🛡️ au lieu de te répondre Feur pendant 24h' },
    { id: 'bonus-jackpot-boost', type: 'bonus', poids: 1/17, nom: 'Boost Jackpot (+25%)', desc: '+25% de chance de bonus sur tes 2 prochains tirages (cumulable)' },
    { id: 'bonus-coup-triple', type: 'bonus', poids: 1/20, nom: 'Coup Triple', desc: 'Tes 3 prochains tirages sont immédiats et sans aucun cooldown' },
    { id: 'bonus-super-bouclier', type: 'bonus', poids: 1/35, nom: 'Super Bouclier (3 malus)', desc: 'Immunité totale contre tes 3 prochains malus (cumulable)' },
    { id: 'bonus-couronne', type: 'bonus', poids: 1/50, nom: 'Couronne 👑 pendant 12h', desc: 'Une couronne 👑 sous tes messages pendant 12h' },
    { id: 'bonus-plagiat', type: 'bonus', poids: 1/45, nom: 'Plagiat', desc: 'Copie un bonus actif au hasard sur un.e autre joueur.se sans lui retirer' },
    { id: 'bonus-partage-bonus', type: 'bonus', poids: 1/80, nom: 'Partage de bonus au choix', desc: 'Partage ton prochain bonus avec le membre de ton choix' },
    { id: 'bonus-redirect-malus', type: 'bonus', poids: 1/85, nom: '3 malus redirigés au hasard', desc: '3 prochains malus redirigés vers un.e autre membre' },
    { id: 'bonus-redirect-choix', type: 'bonus', poids: 1/100, nom: 'Malus redirigé au choix', desc: 'Redirige ton prochain malus vers la personne de ton choix' },
    { id: 'bonus-redirect-bonus-choix', type: 'bonus', poids: 1/100, nom: 'Bonus redirigé au choix', desc: 'Choisis le membre qui recevra ton prochain bonus à ta place' },
    { id: 'bonus-diviseur', type: 'bonus', poids: 1/120, nom: 'Diviseur (2h)', desc: 'Divise par 2 tous tes cooldowns pendant 2h (hors Happy Hour, même sous malus)' },
    { id: 'bonus-epingle', type: 'bonus', poids: 1/150, nom: 'Message épinglé', desc: 'Un message épinglé définitivement dans le salon' },
    { id: 'bonus-role-superieur', type: 'bonus', poids: 1/170, nom: 'Rôle de Regaïen.ne niv. supérieur', desc: 'Rôle de Regaïen.ne supérieur' },
    { id: 'bonus-pickpocket', type: 'bonus', poids: 1/40, nom: 'Pickpocket', desc: 'Vole 1 bouclier à un membre qui en a en réserve' },
    { id: 'bonus-echangeur-poison', type: 'bonus', poids: 1/75, nom: 'Échangeur de poison', desc: 'Transfère un de tes malus actifs vers la personne de ton choix' },
    { id: 'bonus-pseudo-choix', type: 'bonus', poids: 1/250, nom: 'Pseudo au choix', desc: 'Choisis le pseudo d\'un·e membre, verrouillé pendant 48h' },
    { id: 'bonus-legendaire', type: 'bonus', poids: 1/420, nom: 'Regaïen·ne légendraire', desc: 'Rôle de Regaïen·ne légendraire' },
    { id: 'bonus-regadex-perso', type: 'bonus', poids: 1/1000, nom: 'Carte RegaDex unique personnalisée', desc: 'Une carte RegaDex unique et personnalisée créée par Epsys' },
    { id: 'bonus-twitch-jeu', type: 'bonus', poids: 1/1500, nom: 'Choix du jeu du prochain stream Twitch', desc: 'Choix du jeu du prochain stream Twitch' },
    { id: 'bonus-commande-perso', type: 'bonus', poids: 1/1700, nom: 'Commande Cacabot personnalisée', desc: 'Ajoute une commande Cacabot de ton choix' },
    { id: 'bonus-epsys-5e', type: 'bonus', poids: 1/7500, nom: '5€ de la YouTube Money d\'Epsys', desc: '5€ de la YouTube Money d\'Epsys' },
    { id: 'bonus-epsys-photo', type: 'bonus', poids: 1/5000, nom: 'Photo disgracieuse d\'Epsys dédicacée', desc: '1 photo disgracieuse d\'Epsys signée' },
    { id: 'bonus-elu-roulette', type: 'bonus', poids: 1/7000, nom: 'Rôle Élu·e de la Roulette', desc: 'Rôle spécial d\'Élu·e de la Roulette' },
    { id: 'bonus-youtube-credit', type: 'bonus', poids: 1/8500, nom: 'Pseudo crédité sous chaque vidéo YouTube', desc: 'Pseudo crédité sous chaque vidéo YouTube' },
    { id: 'bonus-epsys-goodies', type: 'bonus', poids: 1/12500, nom: 'Goodies d\'Epsys', desc: 'Goodies d\'Epsys gratuit au choix' },
    { id: 'bonus-epsys-petitdej', type: 'bonus', poids: 1/17000, nom: 'Petit déj apporté par Epsys en maid dress', desc: 'Petit déj apporté par Epsys en maid dress' },
    { id: 'malus-timeout-3min', type: 'malus', poids: 1/10, nom: 'Mute de 3 minutes', desc: 'Mute de 3 minutes' },
    { id: 'malus-timeout-5min', type: 'malus', poids: 1/15, nom: 'Mute de 5 minutes', desc: 'Mute de 5 minutes' },
    { id: 'malus-cooldown-45', type: 'malus', poids: 1/20, nom: 'Cooldown de 45 min', desc: 'Les 2 prochains tirages ont un cooldown de 45 minutes' },
    { id: 'malus-timeout-20min', type: 'malus', poids: 1/25, nom: 'Mute de 20 minutes', desc: 'Mute de 20 minutes' },
    { id: 'malus-looong-cooldown', type: 'malus', poids: 1/25, nom: 'Looong cooldown (1h)', desc: 'Le prochain tirage a un cooldown de 1 heure (60 minutes)' },
    { id: 'malus-brise-bouclier', type: 'malus', poids: 1/30, nom: 'Brise-Bouclier', desc: 'Détruit instantanément toutes tes charges de bouclier' },
    { id: 'malus-begaiement', type: 'malus', poids: 1/45, nom: 'Bégaiement pendant 4h', desc: 'Bégaye sur chaque mot pendant 4h' },
    { id: 'malus-publicite', type: 'malus', poids: 1/50, nom: 'Publicité intrusive pendant 2h', desc: 'Ajoute un sponsor sous ses messages (environ 1 message sur 3) pendant 2h' },
    { id: 'malus-autocorrect', type: 'malus', poids: 1/55, nom: 'Autocorrect maudit pendant 3h', desc: 'Insère une phrase absurde au milieu de ses messages (1 fois sur 2) pendant 3h' },
    { id: 'malus-mocking', type: 'malus', poids: 1/60, nom: 'Mocking pendant 6h', desc: 'ÉcRiT cOmMe ÇA pendant 6h' },
    { id: 'malus-bebe', type: 'malus', poids: 1/40, nom: 'Parler bébé pendant 2h', desc: 'Les « j » deviennent « z » et « r » deviennent « w » pendant 2h' },
    { id: 'malus-echo', type: 'malus', poids: 1/40, nom: 'Écho condescendant pendant 3h', desc: 'Cacabot te lâche des remarques cassantes (environ 1 message sur 3) pendant 3h' },
    { id: 'malus-boomer', type: 'malus', poids: 1/45, nom: 'Mode Boomer pendant 2h', desc: 'Parle comme un boomer sur Facebook (environ 1 message sur 3) pendant 2h' },
    { id: 'malus-emoji', type: 'malus', poids: 1/45, nom: 'Emoji obligatoire', desc: 'Doit finir chaque message par un emoji aléatoire pendant 6h' },
    { id: 'malus-redirect-bonus-hasard', type: 'malus', poids: 1/50, nom: 'Prochain bonus redirigé au hasard', desc: 'Ton prochain bonus sera offert à un.e autre membre au hasard' },
    { id: 'malus-oyez', type: 'malus', poids: 1/45, nom: 'Oyez oyez ! pendant 3h', desc: 'Parle comme un crieur public médiéval (environ 1 message sur 2) pendant 3h' },
    { id: 'malus-existentiel', type: 'malus', poids: 1/50, nom: 'Crise existentielle pendant 3h', desc: 'Finit ses phrases par une conclusion sombre (environ 1 message sur 3) pendant 3h' },
    { id: 'malus-linkedin', type: 'malus', poids: 1/50, nom: 'Gourou LinkedIn pendant 3h', desc: 'Finit ses phrases par un cliché corporate (environ 1 message sur 3) pendant 3h' },
    { id: 'malus-caps', type: 'malus', poids: 1/60, nom: 'MAJUSCULES pendant 2h', desc: 'Doit parler en MAJUSCULES pendant 2h' },
    { id: 'malus-chat-noir', type: 'malus', poids: 1/65, nom: 'Malédiction du Chat Noir', desc: 'Réinitialise ta pity et ton boost de bonus à zéro' },
    { id: 'malus-emoji-only', type: 'malus', poids: 1/70, nom: 'Emoji only pendant 1h', desc: 'Tous ses mots sont remplacés par des emojis pendant 1h' },
    { id: 'malus-uwu-24h', type: 'malus', poids: 1/80, nom: 'UwU obligatoire pendant 6h', desc: 'Doit finir chaque message par UwU pendant 6h' },
    { id: 'malus-censure', type: 'malus', poids: 1/85, nom: 'Censure pendant 2h', desc: 'Un mot sur 3 est censuré (▇▇) pendant 2h' },
    { id: 'malus-exclu-heure', type: 'malus', poids: 1/100, nom: 'Exclusion de 1 heure', desc: 'Exclusion de 1 heure' },
    { id: 'malus-mots-melanges', type: 'malus', poids: 1/120, nom: 'Mots mélangés pendant 2h', desc: 'Les mots de chaque message sont mélangés pendant 2h' },
    { id: 'malus-pseudo-lock-semaine', type: 'malus', poids: 1/150, nom: 'Pseudo horrible verrouillé pendant 1 semaine', desc: 'Pseudo horrible verrouillé pendant 1 semaine' },
    { id: 'malus-lettres-melangees', type: 'malus', poids: 1/180, nom: 'Lettres mélangées pendant 1h', desc: 'Les lettres de chaque mot sont mélangées pendant 1h' },
    { id: 'malus-sans-consonne', type: 'malus', poids: 1/200, nom: '0 Consonne pendant 2h', desc: 'Toutes les consonnes disparaissent de ses messages pendant 2h' },
    { id: 'malus-limite-100', type: 'malus', poids: 1/220, nom: 'Limite de 100 caractères pendant 2h', desc: 'Messages coupés à 100 caractères maximum pendant 2h' },
    { id: 'malus-sans-voyelle', type: 'malus', poids: 1/250, nom: '0 Voyelle pendant 3h', desc: 'Toutes les voyelles disparaissent de ses messages pendant 3h' },
    { id: 'malus-limite-30', type: 'malus', poids: 1/270, nom: 'Limite de 30 caractères pendant 1h', desc: 'Messages coupés à 30 caractères maximum pendant 1h' },
    { id: 'malus-leet', type: 'malus', poids: 1/330, nom: 'Leet speak pendant 6h', desc: 'Tous ses messages sont écrits en leet speak pendant 6h' },
    { id: 'malus-double-temps-24h', type: 'malus', poids: 1/350, nom: 'Malus x2 pendant 24h', desc: 'La durée de tous ses prochains malus pendant 24h est multipliée par 2' },
    { id: 'malus-lettre-interdite', type: 'malus', poids: 1/400, nom: 'Lettre interdite pendant 6h', desc: 'Ne peut plus utiliser une lettre au hasard pendant 6h' },
    { id: 'malus-prime', type: 'malus', poids: 1/800, nom: 'MALUS PRIME', desc: 'Cumule TOUS les malus de texte/pseudo en même temps' },
    { id: 'malus-pseudo-lock-mois', type: 'malus', poids: 1/900, nom: 'Pseudo horrible verrouillé pendant 1 mois', desc: 'Pseudo horrible verrouillé pendant 1 mois' },
    { id: 'malus-exclu-jour', type: 'malus', poids: 1/1000, nom: 'Exclusion de 1 jour', desc: 'Exclusion de 1 jour' },
    { id: 'malus-exclu-semaine', type: 'malus', poids: 1/1200, nom: 'Exclusion de 1 semaine', desc: 'Exclusion de 1 semaine' },
    { id: 'malus-ban', type: 'malus', poids: 1/15000, nom: 'Ban définitif', desc: 'Ban définitif' },
    { id: 'special-vote-immunite-exclusion', type: 'special', poids: 1/125, nom: 'Vote public', desc: 'Vote public : tirage à volonté pendant 1min ou exclusion 1 jour' },
    { id: 'special-tournee-generale', type: 'special', poids: 1/600, nom: 'Tournée générale', desc: 'Tournée générale ! Happy Hour de 30 minutes pour tout le monde (5 min de cooldown)' },
    { id: 'bonus-tcg-15pts', type: 'bonus', tcgOnly: true, poids: 1/27, nom: '+15 pts RegaDex', desc: '+15 points RegaDex ajoutés à ton solde' },
    { id: 'bonus-tcg-50pts', type: 'bonus', tcgOnly: true, poids: 1/54, nom: '+50 pts RegaDex', desc: '+50 points RegaDex ajoutés à ton solde' },
    { id: 'bonus-tcg-1booster', type: 'bonus', tcgOnly: true, poids: 1/90, nom: '+1 Booster RegaDex', desc: '+1 Booster Set 1 prêt à ouvrir' },
    { id: 'bonus-tcg-5boosters', type: 'bonus', tcgOnly: true, poids: 1/445, nom: '+5 Boosters RegaDex', desc: '+5 Boosters Set 1 prêts à ouvrir' },
    { id: 'bonus-booster-consolation', type: 'bonus', tcgOnly: true, poids: 1/200, nom: 'Booster de consolation RegaDex', desc: 'Réduit de 3h le cooldown de ton prochain booster gratuit RegaDex' }
];

const ROULETTE_NOMS = Object.fromEntries(ROULETTE_TABLE.map(e => [e.id, e.nom]));
const ROULETTE_ID_VERS_SLUG = Object.fromEntries(Object.entries(ROULETTE_NOMS_COMMANDES).map(([slug, id]) => [id, slug]));

const ROULETTE_EMOJIS_PAR_ID = {
    'bonus-epsys-petitdej': '🍳', 'bonus-epsys-goodies': '🎁', 'bonus-youtube-credit': '📹',
    'bonus-elu-roulette': '🎖️', 'bonus-epsys-photo': '📸', 'bonus-epsys-5e': '💶',
    'malus-ban': '☠️', 'bonus-commande-perso': '🛠️', 'bonus-twitch-jeu': '🎮', 'bonus-regadex-perso': '🃏',
    'malus-pseudo-lock-mois': '🔒', 'bonus-legendaire': '👑', 'malus-exclu-semaine': '🚫',
    'bonus-role-superieur': '🏆', 'malus-pseudo-lock-semaine': '🔐', 'special-vote-immunite-exclusion': '🗳️',
    'bonus-redirect-malus': '😈', 'malus-exclu-jour': '🚫', 'malus-lettre-interdite': '🔤',
    'malus-uwu-24h': '😳', 'bonus-couronne': '👑', 'malus-exclu-heure': '🚫',
    'bonus-super-bouclier': '🔰', 'malus-timeout-20min': '🔇', 'bonus-jackpot-boost': '📈',
    'malus-timeout-5min': '🔇', 'bonus-gif-ou-audio': '🎉', 'bonus-anti-feur': '🛡️', 'bonus-coup-triple': '🎰',
    'bonus-cooldown-court': '⚡', 'malus-timeout-3min': '🔇', 'bonus-bouclier': '🛡️', 'bonus-redirect-choix': '🎯',
    'bonus-pseudo-choix': '✏️', 'bonus-epingle': '📌', 'malus-emoji': '😀', 'malus-leet': '🤖',
    'malus-caps': '🔠', 'malus-emoji-only': '🙂', 'malus-censure': '▇', 'malus-mots-melanges': '🔀',
    'malus-lettres-melangees': '🔡', 'malus-limite-100': '✂️', 'malus-limite-30': '✂️',
    'special-tournee-generale': '🥂', 'malus-cooldown-45': '⏳', 'malus-prime': '💥', 'malus-bebe': '🍼',
    'malus-chat-noir': '🐈‍⬛', 'malus-boomer': '🧓',
    'malus-brise-bouclier': '🪓', 'malus-echo': '🪞',
    'malus-existentiel': '🥀', 'malus-linkedin': '👔',
    'malus-redirect-bonus-hasard': '🎁', 'bonus-redirect-bonus-hasard': '🎁', 'bonus-redirect-bonus-choix': '🎀',
    'malus-sans-consonne': '🅾️', 'malus-sans-voyelle': '🚫',
    'malus-double-temps-24h': '⏳',
    'malus-mocking': '🤡', 'malus-begaiement': '🗣️',
    'malus-publicite': '📺', 'malus-autocorrect': '📱',
    'malus-looong-cooldown': '⏳',
    'bonus-pickpocket': '🦹', 'bonus-echangeur-poison': '🧪',
    'bonus-partage-bonus': '🤝',
    'bonus-plagiat': '📋', 'bonus-diviseur': '➗', 'malus-oyez': '📯',
    'bonus-tcg-15pts': '🪙', 'bonus-tcg-50pts': '💰',
    'bonus-tcg-1booster': '🃏', 'bonus-tcg-5boosters': '🎁',
    'bonus-booster-consolation': '🔋'
};

const ROULETTE_FAILS = [
    "Retente ta chance dans 15 minutes ptdr", "Le hasard, ce traître 😔", "Nan là c'est mort", "Nope",
    "Raté, dommage", "Tout caca ce tirage...", "Rien du tout mdr", "C'est chiant ça fait tourner en rond pour rien",
    "OH! T'as rien gagné.", "OH MON DIEU! Rien.", "Nsm la roulette", "Bon bah salut hein.",
    "Rien, comme prévu", "Continue d'y croire, hein", "Nada", "Rien, à la prochaine!", "Ça pue", "Bah non",
    "T'y crois trop toi", "Aucun résultat, tkt", "Ptdrrr rien", "Reviens dans 15min lol", "Toujours rien avec toi",
    "Bof...", "Raté.", "Erreur_404", "Zéro, comme d'hab", "Ça sert à rien de réessayer tout de suite",
    "Chance de merde", "Rip ton tirage", "C'est mort pour cette fois", "Aucun résultat ptdr", "Nan",
    "Rien à dire de plus", "Vide total", "Rien du tout", "C'est pas ton jour on dirait", "Meh", "Retente ta chance",
    "Rien mdr désolé", "C'est raté", "Bon bah à toute à l'heure !", "Le hasard, le hasard...", "Toujours rien",
    "Pas de nouvelle, bonne nouvelle !", "Bof bof", "FF", "Ratio", "Hmmm, je crois qu'il y a rien... A moins que... Ah non, y a rien.",
    "Rien à signaler", "Naaaan", "Au revoir, bisous.   -Maman", "Rien, dsl", "[Insérer musique à la trompette]",
    "[Insérer musique triste au violon]", "Mdr t'espérais quoi", "Bah rien en fait", "Aucun effet", "C'est mort", "Ptdr non", "Rien pour toi",
    "Nul", "C'est un peu trop  calme... J'aime pas trop beaucoup ça...", "Aucun résultat, ratio", "C'est vide", "Chance en carton",
    "Ah.", "Rien, essaie encore. 'Fin pas tout de suite mais dans 15 minutes, quoi.", "Bof franchement", "Rip", "Nan c'est raté", "Rien du tout, sois pas triste",
    "Aucun résultat mdrrr", "C'est raté, tant pis", "Nul ce tirage", "Chance zéro", "Ptdr t'as rien eu",
    "Rien, la prochaine fois peut-être", "Nan, rien", "Aucun bonus, dommage", "C'est raté, à plus", "Rien de fou", "Chance ratée", "Mdr encore raté",
    "Nan c'est nul ce tirage", "Rien pour cette fois", "C'est mort, retente", "Aucun résultat",
    "Bof, rien", "Nul comme d'hab", "Rien à faire", "C'est vide", "Chance à chier", "Ptdr rien du tout",
    "Nan c'est raté, dommage", "Rien, la chance n'est pas de ton côté aujourd'hui"
];

const ROULETTE_NOMS_PSEUDO_LOCK = [
    "Caca boudin", "Diarrhée explosive", "_XxD4rkSasuk3xX_", "BardellaLover69", "Sam Gratlékouy", "CharlieKirkFanAccountV2",
    "Pierre Chabrier", "SansPlomb95", "Cherche une copine sur Maubeuge", "https://youtu.be/vCIG5VeP_I0",
    "Oestrodose", "Puff goût paf"
];

const ROULETTE_RANGS = [
    { id: '720080477926457476', label: 'Regaïen.ne' },
    { id: '720080749360971817', label: 'Regaïen.ne amateur.e' },
    { id: '720080968396046428', label: 'Regaïen.ne bavard.e' },
    { id: '720081125438914690', label: 'Regaïen.ne populaire' },
    { id: '1230643204664070328', label: 'Regaïen.ne légendraire' }
];

// Maps d'état
const rouletteFreeRollUntil = new Map();
const rouletteCooldowns = new Map();
const rouletteCouronneUntil = new Map();
const rouletteAntiFeurUntil = new Map();
const rouletteCoupTripleCharges = new Map();
const rouletteCoupTripleScore = new Map();
const rouletteFreeRollCompteur = new Map();
const rouletteHappyHourCompteur = new Map();
const rouletteAntiFeurDodges = new Map();
const roulettePapayouDaily = new Map();
const rouletteMalusConsecutifs = new Map();
const rouletteMalusDifferents = new Map();
const rouletteRedirectCharges = new Map();
const roulettePseudoLock = new Map();
const rouletteImmuniteUntil = new Map();
const rouletteResultats = new Map();
const rouletteChoixEnAttente = new Set();
const rouletteUwuUntil = new Map();
const rouletteLettreInterdite = new Map();
const rouletteEmojiUntil = new Map();
const rouletteLeetUntil = new Map();
const rouletteTransfos = new Map();
const rouletteInventaire = new Map();
let rouletteTourneeJusquA = 0;
const rouletteCooldown45Charges = new Map();
const rouletteLooongCooldownCharges = new Map();
const rouletteCooldownCourtCharges = new Map();
const rouletteBouclierActif = new Map();
const rouletteJackpotBoostCharges = new Map();
const rouletteJackpotBoostValue = new Map();
const rouletteRedirectChoixCible = new Map();
const rouletteJackpotBonus = new Map();
const rouletteStats = new Map();
const rouletteAchievements = new Map();
const roulettePity = new Map();
const rouletteTimeoutUntil = new Map();
const rouletteWebhooks = new Map();
const rouletteNotifs = new Map();
const rouletteNotifTimers = new Map();
const rouletteNotifRepeat = new Map();
const rouletteNotifTarget = new Map();
const notifsEnvoyeesRecent = new Set();
let dernierEnvoiHappyHour = null;
const rouletteVoteRedirectCharges = new Map();
const rouletteVoteVotants = new Map();
const rouletteVotesPublics = new Map();
const rouletteVoteTimers = new Map();
const rouletteRedirectBonusCharges = new Map();
const rouletteRedirectBonusChoixCible = new Map();
const roulettePartageBonusChoixCible = new Map();
const rouletteDoubleTempsUntil = new Map();
const rouletteHistoriqueDerniersTirages = []; // Cache mémoire des 3 derniers tirages du serveur
const rouletteServerState = new Map();
const rouletteMpOptIn = new Map();
const rouletteRedirectRecus = new Map();
const ROULETTE_ANTI_ACHARNEMENT_MAX = 3;
const ROULETTE_ANTI_ACHARNEMENT_MS = 24 * 60 * 60 * 1000;
const ROULETTE_ANTI_ACHARNEMENT_MSG = "Cette personne a déjà reçu 3 malus redirigés dans les dernières 24h, je pense que c'est pas mal. Mais sinon réessaie demain si tu veux toujours sa mort !";
let dernierNettoyageEtats = 0;

function getRouletteHistorique() {
    const saved = rouletteServerState.get('historique');
    if (Array.isArray(saved)) return saved;
    return rouletteHistoriqueDerniersTirages;
}

function getRedirectsRecus24h(userId) {
    const now = Date.now();
    const raw = rouletteRedirectRecus.get(userId);
    if (!Array.isArray(raw) || raw.length === 0) return [];
    const valides = raw.filter(ts => typeof ts === 'number' && (now - ts) < ROULETTE_ANTI_ACHARNEMENT_MS);
    if (valides.length !== raw.length) {
        if (valides.length === 0) rouletteRedirectRecus.delete(userId);
        else rouletteRedirectRecus.set(userId, valides);
    }
    return valides;
}

function estProtegeAntiAcharnement(userId) {
    return getRedirectsRecus24h(userId).length >= ROULETTE_ANTI_ACHARNEMENT_MAX;
}

function enregistrerRedirectRecu(userId) {
    if (!userId) return;
    const valides = getRedirectsRecus24h(userId);
    valides.push(Date.now());
    rouletteRedirectRecus.set(userId, valides);
    bridge.demanderSauvegarde();
}

async function notifierMpInteractionRoulette(client, targetUserId, texte) {
    if (!client || !targetUserId || !rouletteMpOptIn.get(targetUserId)) return;
    try {
        const user = client.users.cache.get(targetUserId) || await client.users.fetch(targetUserId).catch(() => null);
        if (!user) return;
        await user.send({ content: texte }).catch(() => {});
    } catch {}
}

function purgerVieuxEtatsRoulette() {
    const now = Date.now();
    let modifie = false;

    for (const [uid, fin] of rouletteCooldowns.entries()) {
        if (now - fin > 2 * 60 * 60 * 1000) { rouletteCooldowns.delete(uid); modifie = true; }
    }
    const mapsExpiration = [
        rouletteFreeRollUntil, rouletteCouronneUntil, rouletteAntiFeurUntil,
        rouletteDiviseurUntil, rouletteImmuniteUntil, rouletteTimeoutUntil, rouletteUwuUntil,
        rouletteEmojiUntil, rouletteLeetUntil, rouletteEchoUntil, rouletteDoubleTempsUntil
    ];
    for (const map of mapsExpiration) {
        for (const [uid, fin] of map.entries()) {
            if (!fin || now >= fin) { map.delete(uid); modifie = true; }
        }
    }
    for (const [uid, obj] of rouletteLettreInterdite.entries()) {
        if (!obj || now >= obj.until) { rouletteLettreInterdite.delete(uid); modifie = true; }
    }
    for (const [uid, tf] of rouletteTransfos.entries()) {
        if (!tf || typeof tf !== 'object') { rouletteTransfos.delete(uid); modifie = true; continue; }
        let changed = false;
        for (const [k, fin] of Object.entries(tf)) {
            if (!fin || now >= fin) { delete tf[k]; changed = true; }
        }
        if (changed) {
            if (Object.keys(tf).length === 0) rouletteTransfos.delete(uid);
            else rouletteTransfos.set(uid, tf);
            modifie = true;
        }
    }
    for (const [msgId, vote] of rouletteVotesPublics.entries()) {
        if (vote?.cloture && vote.expireAt && (now - vote.expireAt) > 24 * 60 * 60 * 1000) {
            rouletteVotesPublics.delete(msgId);
            modifie = true;
        }
    }
    for (const uid of [...rouletteRedirectRecus.keys()]) {
        const avant = rouletteRedirectRecus.get(uid)?.length || 0;
        const apres = getRedirectsRecus24h(uid).length;
        if (apres !== avant) modifie = true;
    }
    const todayStr = new Date().toDateString();
    for (const [uid, rec] of roulettePapayouDaily.entries()) {
        if (!rec || rec.date !== todayStr) { roulettePapayouDaily.delete(uid); modifie = true; }
    }
    for (const [uid, rec] of rouletteHappyHourCompteur.entries()) {
        if (!rec || rec.date !== todayStr) { rouletteHappyHourCompteur.delete(uid); modifie = true; }
    }
    if (modifie) bridge.demanderSauvegarde();
}

function getMultiplicateurMalusTemps(userId) {
    const fin = rouletteDoubleTempsUntil.get(userId);
    if (fin && Date.now() < fin) return 2;
    return 1;
}

function getCiblesListe(map, userId) {
    const val = map.get(userId);
    if (Array.isArray(val)) return val.filter(Boolean);
    if (typeof val === 'string' && val.length > 0) return [val];
    return [];
}

function ajouterCibleListe(map, userId, cibleId) {
    const liste = getCiblesListe(map, userId);
    liste.push(cibleId);
    map.set(userId, liste);
    return liste;
}

const ROULETTE_ETATS = {
    cooldowns: rouletteCooldowns,
    freeRoll: rouletteFreeRollUntil,
    couronne: rouletteCouronneUntil,
    antiFeur: rouletteAntiFeurUntil,
    coupTriple: rouletteCoupTripleCharges,
    pseudoLock: roulettePseudoLock,
    redirectCharges: rouletteRedirectCharges,
    redirectBonusCharges: rouletteRedirectBonusCharges,
    redirectBonusChoixCible: rouletteRedirectBonusChoixCible,
    partageBonusChoixCible: roulettePartageBonusChoixCible,
    doubleTemps: rouletteDoubleTempsUntil,
    voteRedirect: rouletteVoteRedirectCharges,
    voteVotants: rouletteVoteVotants,
    votesPublics: rouletteVotesPublics,
    pity: roulettePity,
    uwu: rouletteUwuUntil,
    lettreInterdite: rouletteLettreInterdite,
    emoji: rouletteEmojiUntil,
    leet: rouletteLeetUntil,
    transfos: rouletteTransfos,
    echo: rouletteEchoUntil,
    cooldown45: rouletteCooldown45Charges,
    looongCooldown: rouletteLooongCooldownCharges,
    cooldownCourt: rouletteCooldownCourtCharges,
    bouclier: rouletteBouclierActif,
    jackpotBoostCharges: rouletteJackpotBoostCharges,
    jackpotBoostValue: rouletteJackpotBoostValue,
    redirectChoixCible: rouletteRedirectChoixCible,
    jackpot: rouletteJackpotBonus,
    stats: rouletteStats,
    achievements: rouletteAchievements,
    immunite: rouletteImmuniteUntil,
    timeoutRoulette: rouletteTimeoutUntil,
    notifs: rouletteNotifs,
    notifRepeat: rouletteNotifRepeat,
    notifTarget: rouletteNotifTarget,
    malusConsecutifs: rouletteMalusConsecutifs,
    antiFeurDodges: rouletteAntiFeurDodges,
    malusDifferents: rouletteMalusDifferents,
    papayouDaily: roulettePapayouDaily,
    coupTripleScore: rouletteCoupTripleScore,
    happyHourCompteur: rouletteHappyHourCompteur,
    inventaire: rouletteInventaire,
    serverState: rouletteServerState,
    mpOptIn: rouletteMpOptIn,
    redirectRecus: rouletteRedirectRecus
};

const rouletteDiviseurUntil = new Map();
const rouletteDiscovered = new Map();
ROULETTE_ETATS.diviseur = rouletteDiviseurUntil;
ROULETTE_ETATS.discovered = rouletteDiscovered;

let bridge = {
    topData: { messages: {} },
    demanderSauvegarde: () => {},
    saveAll: async () => {},
    estAnniversaireAujourdhui: () => false,
    estModo: () => false,
    EPSYS_ID: '436218312574107658',
    findMemberByName: () => ({ found: null, multiple: false, candidates: [] }),
    askDisambiguation: () => {}
};

let rouletteClient = null;

function initRouletteBridge(b) {
    bridge = { ...bridge, ...b };
    if (b.client) rouletteClient = b.client;
    if (b.suggestionsData) ROULETTE_ETATS.suggestions = b.suggestionsData;
}

let dernierEnvoiMaudite = null;

function estRouletteMauditeDoree(date = new Date()) {
    const parisDate = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    if (parisDate.getDay() !== 0) return false; // Dimanche uniquement
    const minutes = parisDate.getHours() * 60 + parisDate.getMinutes();
    return minutes >= (16 * 60 + 30) && minutes < (20 * 60); // 16h30 inclus à 20h00 exclus
}

function estHappyHour() {
    if (Date.now() < rouletteTourneeJusquA) return true;
    const now = new Date();
    const parisDate = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    return parisDate.getHours() === 20;
}

function verifierHappyHour(client) {
    if (!client) return;

    // Rétablissement automatique des pseudos quand le malus expire + purge silencieuse toutes les 30 min
    const nowTs = Date.now();
    if (nowTs - dernierNettoyageEtats >= 30 * 60 * 1000) {
        dernierNettoyageEtats = nowTs;
        purgerVieuxEtatsRoulette();
    }
    for (const [userId, lock] of roulettePseudoLock.entries()) {
        if (nowTs >= lock.until) {
            roulettePseudoLock.delete(userId);
            bridge.demanderSauvegarde();
            const guild = client.guilds.cache.first();
            const membre = guild?.members.cache.get(userId);
            if (membre && membre.nickname === lock.pseudo) {
                membre.setNickname(lock.originalNickname ?? null).catch(() => {});
            }
            notifierMpInteractionRoulette(
                client,
                userId,
                `🔓 Ton malus **Pseudo verrouillé** (\`${lock.pseudo}\`) sur **Regaïa** vient d'expirer ! Ton pseudo précédent a été rétabli.`
            );
        }
    }

    const now = new Date();
    const paris = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    const h = paris.getHours();
    const m = paris.getMinutes();
    const salon = client?.channels.cache.get(ROULETTE_SALON_ID);
    if (!salon) return;

    const { MessageFlags } = require('discord.js');
    const estDimanche = paris.getDay() === 0;
    if (estDimanche && h === 16 && m === 30 && dernierEnvoiMaudite !== 'dimanche-16h30') {
        dernierEnvoiMaudite = 'dimanche-16h30';
        salon.send({
            content: '# __🌘 ROULETTE MAUDITE / DORÉE ACTIVÉE ! (16h30 – 20h00)__\n🔥 Pendant **3h30**, le résultat **"Rien" tombe à 0%** : **100% Bonus ou Malus** à chaque tirage *(les ultra-rares restent rares)* !',
            flags: [MessageFlags.SuppressNotifications]
        }).catch(() => {});
    } else if (estDimanche && h === 20 && m === 0 && dernierEnvoiMaudite !== 'dimanche-20h00') {
        dernierEnvoiMaudite = 'dimanche-20h00';
        salon.send({
            content: '# __🌗 FIN DE LA ROULETTE MAUDITE / DORÉE !__\nRetour aux probabilités normales… et place à l\'**Happy Hour** jusqu\'à 21h !',
            flags: [MessageFlags.SuppressNotifications]
        }).catch(() => {});
    }

    if (h === 20 && m === 0 && dernierEnvoiHappyHour !== '20h00') {
        dernierEnvoiHappyHour = '20h00';
        salon.send({ content: '# __🎰 C\'EST L\'HAPPY HOUR SUR LA ROULETTE ! (20h - 21h)__\n🔥 Pendant 1 heure, les cooldowns de tout le monde passent à **5 minutes** au lieu de 15 ! Tentez votre chance !', flags: [MessageFlags.SuppressNotifications] });
    } else if (h === 20 && m === 30 && dernierEnvoiHappyHour !== '20h30') {
        dernierEnvoiHappyHour = '20h30';
        salon.send({ content: '# __🎰 PLUS QUE 30 MINUTES D\'HAPPY HOUR !__\n⚡ Les tirages sont toujours à **5 minutes** de cooldown jusqu\'à 21h !', flags: [MessageFlags.SuppressNotifications] });
    } else if (h === 21 && m === 0 && dernierEnvoiHappyHour !== '21h00') {
        dernierEnvoiHappyHour = '21h00';
        salon.send({ content: '# __🏁 FIN DE L\'HAPPY HOUR !__\nRetour au cooldown normal de 15 minutes. Merci d\'avoir joué !', flags: [MessageFlags.SuppressNotifications] });
    }
}

function declencherHappyHourRoulette(dureeMinutes = 30, raison = '', client = null) {
    const now = Date.now();
    const dureeMs = Math.max(1, dureeMinutes) * 60 * 1000;
    const base = Math.max(now, rouletteTourneeJusquA || 0);
    rouletteTourneeJusquA = base + dureeMs;
    for (const [uid, cd] of rouletteCooldowns.entries()) {
        if (cd > now + 5 * 60 * 1000) {
            rouletteCooldowns.set(uid, now + 5 * 60 * 1000);
        }
    }
    bridge.demanderSauvegarde();

    const cl = client || rouletteClient || bridge?.client;
    const salon = cl?.channels?.cache?.get(ROULETTE_SALON_ID);
    if (salon) {
        const finTs = Math.ceil(rouletteTourneeJusquA / 1000);
        const motif = raison ? `\n🎯 *Motif : ${raison}*` : '';
        salon.send({
            content: `# __🍻 HAPPY HOUR EXCEPTIONNEL (${dureeMinutes} MIN) !__\n🔥 Tous les cooldowns de la roulette passent à **5 minutes** jusqu'à <t:${finTs}:t> (<t:${finTs}:R>) !${motif}`,
            flags: [MessageFlags.SuppressNotifications]
        }).catch(() => {});
    }
    return rouletteTourneeJusquA;
}

function memoriserResultatRoulette(messageId, embed, outcomeId = null, gifOptions = {}) {
    rouletteResultats.set(messageId, { embed, outcomeId, gifOptions });
    if (rouletteResultats.size > 200) rouletteResultats.delete(rouletteResultats.keys().next().value);
}

function buildMenuFallbackRoulette(authorId) {
    const menu = new StringSelectMenuBuilder()
        .setCustomId(`roulette_fallback_${authorId}`)
        .setPlaceholder('Choisis un bonus à la place')
        .addOptions(
            { label: '🎉 Audio PAPAYOU', value: 'bonus-gif-ou-audio' },
            { label: '📈 Boost Jackpot (+25% sur 2 tirages)', value: 'bonus-jackpot-boost' },
            { label: '🔰 Super Bouclier (3 malus parés)', value: 'bonus-super-bouclier' },
            { label: '👑 Couronne pendant 12h', value: 'bonus-couronne' },
            { label: '😈 3 malus redirigés (cumulable)', value: 'bonus-redirect-malus' }
        );
    return new ActionRowBuilder().addComponents(menu);
}

async function deverrouillerSucces(userId, achId, channel) {
    let userAchs = rouletteAchievements.get(userId);
    if (!userAchs) {
        userAchs = {};
        rouletteAchievements.set(userId, userAchs);
    }
    if (userAchs[achId]) return;

    // Résolution garantie du salon pour ne jamais rater l'affichage d'un succès
    let targetChannel = channel;
    if (!targetChannel) {
        const client = rouletteClient || bridge?.client;
        targetChannel = client?.channels?.cache?.get(ROULETTE_SALON_ID);
        if (!targetChannel && client?.channels?.fetch) {
            targetChannel = await client.channels.fetch(ROULETTE_SALON_ID).catch(() => null);
        }
    }

    userAchs[achId] = Date.now();
    rouletteAchievements.set(userId, userAchs);
    bridge.demanderSauvegarde();

    const ach = ROULETTE_ACHIEVEMENTS.find(a => a.id === achId);
    if (!ach) return;

    const client = rouletteClient || bridge?.client;
    const guildObj = targetChannel?.guild || client?.guilds?.cache?.get('720057528351850547') || client?.guilds?.cache?.first();
    const memberObj = guildObj?.members?.cache?.get(userId);
    const userObj = memberObj?.user || client?.users?.cache?.get(userId);
    const displayName = memberObj?.displayName || userObj?.username || 'Joueur';
    const avatarUrl = memberObj?.displayAvatarURL?.({ dynamic: true }) || userObj?.displayAvatarURL?.({ dynamic: true }) || undefined;

    const totalAchs = ROULETTE_ACHIEVEMENTS.length;
    const debloques = Object.keys(userAchs).filter(id => ROULETTE_ACHIEVEMENTS.some(a => a.id === id)).length;
    const pct = totalAchs > 0 ? Math.round((debloques / totalAchs) * 100) : 0;
    const barre = buildRouletteBar(debloques, totalAchs, 14);

    const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setAuthor({ name: `${displayName} • Succès débloqué`, iconURL: avatarUrl })
        .setTitle('🎊 SUCCÈS DÉVERROUILLÉ !')
        .setDescription(
            `<@${userId}> vient d'obtenir le succès **${ach.emoji} ${ach.nom}** !\n\n` +
            `*${ach.desc}*\n\n` +
            `\`${barre}\` **${debloques}/${totalAchs} succès — ${pct}%**`
        )
        .setImage('https://cdn.discordapp.com/attachments/1480756332373213275/1555806751448629410/achievement-unlocked_1.gif');

    const { MessageFlags } = require('discord.js');
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`rlt_achs_${userId}_0_${userId}`).setLabel('🎖️ Succès').setStyle(ButtonStyle.Secondary)
    );
    await targetChannel?.send({ 
        embeds: [embed], 
        components: [row],
        flags: [MessageFlags.SuppressNotifications]
    }).catch(() => {});
}

async function deverrouillerSuccesSecret(userId, achId, channel) {
    let userAchs = rouletteAchievements.get(userId);
    if (!userAchs) {
        userAchs = {};
        rouletteAchievements.set(userId, userAchs);
    }
    if (userAchs[achId]) return;

    let targetChannel = channel;
    if (!targetChannel) {
        const client = rouletteClient || bridge?.client;
        targetChannel = client?.channels?.cache?.get(ROULETTE_SALON_ID);
        if (!targetChannel && client?.channels?.fetch) {
            targetChannel = await client.channels.fetch(ROULETTE_SALON_ID).catch(() => null);
        }
    }

    userAchs[achId] = Date.now();
    rouletteAchievements.set(userId, userAchs);
    bridge.demanderSauvegarde();

    const ach = ROULETTE_SECRET_ACHIEVEMENTS.find(a => a.id === achId);
    if (!ach) return;

    const cl = rouletteClient || bridge?.client;
    const guild = targetChannel?.guild || cl?.guilds?.cache?.first();
    const member = guild?.members?.cache?.get(userId);
    const displayName = member?.displayName || 'Membre';
    const avatarUrl = member?.displayAvatarURL?.({ dynamic: true }) || undefined;

    const embed = new EmbedBuilder()
        .setColor(0x9b59b6)
        .setAuthor({ name: `${displayName} • Succès Secret`, iconURL: avatarUrl })
        .setTitle('🕵️ SUCCÈS SECRET DÉVERROUILLÉ !')
        .setDescription(`<@${userId}> vient de percer le mystère du succès **${ach.emoji} ${ach.nom}** !\n\n*${ach.desc}*`)
        .setImage('https://cdn.discordapp.com/attachments/1480756332373213275/1555806751448629410/achievement-unlocked_1.gif');

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`rlt_secretachs_${userId}_${userId}_img_0`).setLabel('🕵️ Voir mes Secrets').setStyle(ButtonStyle.Primary)
    );
    await targetChannel?.send({
        embeds: [embed],
        components: [row],
        flags: [MessageFlags.SuppressNotifications]
    }).catch(() => {});
}

function finitParUnEmoji(texte) {
    return /\p{Extended_Pictographic}\uFE0F?$/u.test(texte.trim());
}

function estMessageExempte(texte) {
    const t = texte.trim();
    if (/^[!\/]/.test(t)) return true;
    if (/^https?:\/\/\S+$/i.test(t) && /(tenor\.com|giphy\.com|klipy\.com|\.gif(\?|$))/i.test(t)) return true;
    if (/^(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator}|[0-9#*]\uFE0F?\u20E3|[\uFE0F\u200D\u20E3]|<a?:\w+:\d+>|\s)+$/u.test(t)) return true;
    return false;
}

function activerTransfo(userId, type, dureeMs) {
    const t = rouletteTransfos.get(userId) ?? {};
    t[type] = Date.now() + dureeMs;
    rouletteTransfos.set(userId, t);
}

function basculerTransfo(userId, type, dureeMs) {
    const t = rouletteTransfos.get(userId) ?? {};
    if (t[type] && Date.now() < t[type]) {
        delete t[type];
        if (Object.keys(t).length === 0) rouletteTransfos.delete(userId);
        else rouletteTransfos.set(userId, t);
        return true;
    }
    t[type] = Date.now() + dureeMs;
    rouletteTransfos.set(userId, t);
    return false;
}

function surTexte(texte, fn) {
    return texte
        .split(/(<[^>]+>|https?:\/\/\S+|```[\s\S]*?```|`[^`]*`)/g)
        .map((morceau, idx) => idx % 2 === 1 ? morceau : fn(morceau))
        .join('');
}

function melanger(liste) {
    for (let i = liste.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [liste[i], liste[j]] = [liste[j], liste[i]];
    }
    return liste;
}

function appliquerTransfos(userId, texte) {
    const t = rouletteTransfos.get(userId);
    if (!t) return texte;
    const now = Date.now();
    for (const k of Object.keys(t)) if (now >= t[k]) delete t[k];
    if (Object.keys(t).length === 0) { rouletteTransfos.delete(userId); return texte; }

    let r = texte;
    if (t.mots && !r.includes('```')) r = melanger(r.split(/\s+/).filter(Boolean)).join(' ');
    if (t.lettres) r = surTexte(r, m => m.replace(/\p{L}{2,}/gu, mot => melanger([...mot]).join('')));
    if (t.censure) r = surTexte(r, m => m.replace(/\S+/g, mot => Math.random() < 1/3 ? '▇▇' : mot));
    if (t.emojiOnly) r = surTexte(r, m => m.replace(/\S+/g, () => ROULETTE_EMOJIS_ALEATOIRES[Math.floor(Math.random() * ROULETTE_EMOJIS_ALEATOIRES.length)]));
    if (t.bebe) r = surTexte(r, m => m.replace(/j/g, 'z').replace(/J/g, 'Z').replace(/r/g, 'w').replace(/R/g, 'W'));
    if (t.sansConsonne) r = surTexte(r, m => m.replace(/[b-df-hj-np-tv-xzç]/gi, ''));
    if (t.sansVoyelle) r = surTexte(r, m => m.replace(/[aeiouyàâäéèêëîïôöùûüÿ]/gi, ''));
    // Une phrase tous les 3 messages environ (1/3) pour Boomer, Existentiel et LinkedIn
    if (t.boomer && Math.random() < 0.33) r = surTexte(r, m => m.replace(/[\.!\?]+/g, '..... ') + ' ' + ROULETTE_BOOMER_FINS[Math.floor(Math.random() * ROULETTE_BOOMER_FINS.length)]);
    if (t.existentiel && Math.random() < 0.33) r = r + ROULETTE_EXISTENTIEL_FINS[Math.floor(Math.random() * ROULETTE_EXISTENTIEL_FINS.length)];
    if (t.linkedin && Math.random() < 0.33) r = r + ROULETTE_LINKEDIN_FINS[Math.floor(Math.random() * ROULETTE_LINKEDIN_FINS.length)];
    if (t.caps) r = surTexte(r, m => m.toUpperCase());
    if (t.mocking) r = surTexte(r, m => m.split('').map((c, i) => i % 2 === 0 ? c.toLowerCase() : c.toUpperCase()).join(''));
    if (t.begaiement) r = surTexte(r, m => m.replace(/\b([a-zA-ZÀ-ÿ])(\w{2,})/g, '$1-$1$2'));
    if (t.autocorrect && Math.random() < 0.5) {
        const mots = r.split(/\s+/);
        if (mots.length >= 2) {
            const milieu = Math.floor(mots.length / 2);
            const phraseRandom = ROULETTE_AUTOCORRECT_PHRASES[Math.floor(Math.random() * ROULETTE_AUTOCORRECT_PHRASES.length)];
            mots.splice(milieu, 0, phraseRandom.trim());
            r = mots.join(' ');
        } else {
            r = r + ' ' + ROULETTE_AUTOCORRECT_PHRASES[Math.floor(Math.random() * ROULETTE_AUTOCORRECT_PHRASES.length)].trim();
        }
    }
    if (t.publicite && Math.random() < 0.33) r = r + ROULETTE_PUBS_SPONSOR[Math.floor(Math.random() * ROULETTE_PUBS_SPONSOR.length)];
    if (t.oyez && Math.random() < 0.5) r = ROULETTE_OYEZ_INTROS[Math.floor(Math.random() * ROULETTE_OYEZ_INTROS.length)] + r;
    const max = Math.min(t.limite30 ? 30 : Infinity, t.limite100 ? 100 : Infinity);
    if (max !== Infinity && [...r].length > max) r = [...r].slice(0, max).join('').replace(/<[^>]*$/, '');
    return r;
}

function versLeet(texte) {
    const table = { a: '4', e: '3', i: '1', o: '0', s: '5', t: '7' };
    return texte
        .split(/(<[^>]+>|https?:\/\/\S+|```[\s\S]*?```|`[^`]*`)/g)
        .map((morceau, idx) => idx % 2 === 1 ? morceau : morceau.replace(/[aeiost]/gi, c => table[c.toLowerCase()]))
        .join('');
}

function retirerLettre(texte, lettre) {
    const regex = new RegExp(lettre, 'gi');
    return texte
        .split(/(<[^>]+>|https?:\/\/\S+|```[\s\S]*?```|`[^`]*`)/g)
        .map((morceau, idx) => idx % 2 === 1 ? morceau : morceau.replace(regex, ''))
        .join('');
}

function desarmerNotifRoulette(userId) {
    if (rouletteNotifTimers.has(userId)) {
        clearTimeout(rouletteNotifTimers.get(userId));
        rouletteNotifTimers.delete(userId);
    }
    if (rouletteNotifs.has(userId)) {
        rouletteNotifs.delete(userId);
        bridge.demanderSauvegarde();
    }
}

function aUneNotifRouletteActive(userId) {
    const fin = rouletteCooldowns.get(userId) ?? 0;
    return rouletteNotifs.has(userId) && Date.now() < fin;
}


function armerNotifRoulette(userId, channelId, client) {
    const ancienTimer = rouletteNotifTimers.get(userId);
    if (ancienTimer) {
        clearTimeout(ancienTimer);
        rouletteNotifTimers.delete(userId);
    }

    if (!client || !channelId) {
        console.warn(`[ROULETTE NOTIF] Client ou destination absent pour ${userId}`);
        return;
    }

    const fin = rouletteCooldowns.get(userId) ?? 0;
    const delai = Math.max(fin - Date.now(), 1000);

    const timer = setTimeout(async () => {
        // Ne pas exécuter un ancien timer remplacé.
        if (rouletteNotifTimers.get(userId) !== timer) return;
        rouletteNotifTimers.delete(userId);

        // Notification désactivée ou remplacée entre-temps.
        if (rouletteNotifs.get(userId) !== channelId) return;

        const finActuelle = rouletteCooldowns.get(userId) ?? 0;

        // Le cooldown a changé : on attend la nouvelle échéance.
        if (Date.now() < finActuelle) {
            armerNotifRoulette(userId, channelId, client);
            return;
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`roulette_tenter_${userId}`)
                .setLabel('🎰 Tenter sa chance')
                .setStyle(ButtonStyle.Primary)
        );

        let envoiReussi = false;

        const envoyerDansSalon = async (salonId, secours = false) => {
            try {
                const salon = client.channels.cache.get(salonId)
                    || await client.channels.fetch(salonId);

                if (!salon || typeof salon.send !== 'function') {
                    throw new Error('Salon introuvable ou non accessible');
                }

                await salon.send({
                    content: secours
                        ? `🎰 <@${userId}>, ton cooldown roulette est terminé ! *(Notification envoyée ici car la destination initiale est indisponible.)*`
                        : `🎰 <@${userId}>, ton cooldown roulette est terminé ! Clique ci-dessous pour relancer immédiatement :`,
                    components: [row],
                    allowedMentions: { users: [userId] }
                });

                return true;
            } catch (error) {
                console.warn(
                    `[ROULETTE NOTIF] Échec salon ${salonId} pour ${userId} :`,
                    error.message
                );
                return false;
            }
        };

        try {
            if (channelId === 'MP') {
                try {
                    const user = client.users.cache.get(userId)
                        || await client.users.fetch(userId);

                    const rowMp = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setLabel('🎰 Aller au salon #roulette')
                            .setStyle(ButtonStyle.Link)
                            .setURL('https://discord.com/channels/720057528351850547/1553954760900608091')
                    );

                    await user.send({
                        content: `🎰 <@${userId}>, ton cooldown roulette sur **Regaïa** est terminé ! Tu peux relancer ton tirage dès maintenant :`,
                        components: [rowMp]
                    });

                    envoiReussi = true;
                } catch (error) {
                    console.warn(
                        `[ROULETTE NOTIF] MP impossible pour ${userId} :`,
                        error.message
                    );
                }
            } else {
                envoiReussi = await envoyerDansSalon(channelId);
            }

            // Destination indisponible : secours dans #roulette.
            if (!envoiReussi && channelId !== ROULETTE_SALON_ID) {
                envoiReussi = await envoyerDansSalon(
                    ROULETTE_SALON_ID,
                    true
                );
            }

            // Une autre notification a pu être créée pendant l'envoi.
            // Ne jamais supprimer ou reprogrammer la nouvelle.
            if (rouletteNotifs.get(userId) !== channelId) return;
            if (rouletteNotifTimers.has(userId)) return;

            if (envoiReussi) {
                // Suppression UNIQUEMENT après confirmation d'envoi.
                rouletteNotifs.delete(userId);
                bridge.demanderSauvegarde();

                console.log(
                    `[ROULETTE NOTIF] Notification envoyée à ${userId}`
                );
            } else {
                // Aucun envoi réussi : conserver l'alerte.
                console.error(
                    `[ROULETTE NOTIF] Échec total pour ${userId}. Nouvelle tentative dans 60 secondes.`
                );

                const retryTimer = setTimeout(() => {
                    if (rouletteNotifTimers.get(userId) !== retryTimer) return;
                    rouletteNotifTimers.delete(userId);

                    if (rouletteNotifs.get(userId) === channelId) {
                        armerNotifRoulette(userId, channelId, client);
                    }
                }, 60 * 1000);

                rouletteNotifTimers.set(userId, retryTimer);
            }
        } catch (error) {
            console.error(
                `[ROULETTE NOTIF] Erreur inattendue pour ${userId} :`,
                error
            );

            if (rouletteNotifs.get(userId) === channelId &&
                !rouletteNotifTimers.has(userId)) {
                const retryTimer = setTimeout(() => {
                    if (rouletteNotifTimers.get(userId) !== retryTimer) return;
                    rouletteNotifTimers.delete(userId);

                    if (rouletteNotifs.get(userId) === channelId) {
                        armerNotifRoulette(userId, channelId, client);
                    }
                }, 60 * 1000);

                rouletteNotifTimers.set(userId, retryTimer);
            }
        }
    }, Math.min(delai, 2 ** 31 - 1));

    rouletteNotifTimers.set(userId, timer);
}

    const userId = member?.id || member?.user?.id;
    const ts = Math.ceil(finCooldown / 1000);
    const dejaAlerte = aUneNotifRouletteActive(userId) || Boolean(rouletteNotifRepeat.get(userId));
    const inv = rouletteInventaire.get(userId) ?? {};
    const hasTicket = (inv.ticketSkip || 0) > 0;
    const hasFreeRoll = (inv.freeRoll1Min || 0) > 0;

    let content = `⏳ Ton cooldown roulette n'est pas encore terminé ! Prochain tirage prêt **<t:${ts}:R>** *(à <t:${ts}:T>)*.`;
    if (!dejaAlerte) {
        content += `\n\n🔔 Clique sur le bouton **Alertes** sous le tirage (ou dans le hub \`!rlt\`) si tu veux être prévenu.e dès la fin de ton cooldown !`;
    }

    const components = [];
    if (hasTicket || hasFreeRoll) {
        const itemKey = hasTicket ? 'ticketSkip' : 'freeRoll1Min';
        const qte = hasTicket ? inv.ticketSkip : inv.freeRoll1Min;
        const itemLabel = hasTicket ? '🎟️ Ticket Coupe-File' : '🎰 Tirage à volonté (1 min)';
        content += `\n\n🎒 Tu as **${qte}x ${itemLabel}** en stock ! Veux-tu l'utiliser maintenant pour lancer un tirage immédiatement ?`;
        components.push(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`rlt_quickskip:yes:${itemKey}:${userId}`)
                    .setLabel('Oui, utiliser et tirer')
                    .setEmoji('✅')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`rlt_quickskip:no:${userId}`)
                    .setLabel('Non')
                    .setEmoji('❌')
                    .setStyle(ButtonStyle.Secondary)
            )
        );
    }

    return { content, components };
}

function buildRouletteNotifMenuPayload(member, ctx = 'ephem', statusNote = null) {
    const userId = member?.id || member?.user?.id;
    const finCd = rouletteCooldowns.get(userId) ?? 0;
    const hasCd = Date.now() < finCd;
    const currentNotif = hasCd ? rouletteNotifs.get(userId) : null;
    const isRepeat = Boolean(rouletteNotifRepeat.get(userId));
    const mpInteractions = Boolean(rouletteMpOptIn.get(userId));
    const savedTarget = rouletteNotifTarget.get(userId);
    const ctxSuffix = ctx === 'pub' ? ':pub' : ':ephem';

    let statusText = '🔕 **Alerte actuelle :** Désactivée';
    if (isRepeat) {
        const target = savedTarget || currentNotif;

        statusText = target === 'MP'
            ? '🔁 **Notifications automatiques : ACTIVÉES**\n📩 Destination : Messages privés\n✅ Rappel après chaque cooldown.'
            : target
                ? `🔁 **Notifications automatiques : ACTIVÉES**\n🔔 Destination : <#${target}>\n✅ Rappel après chaque cooldown.`
                : '🔁 **Notifications automatiques : ACTIVÉES**\n✅ Rappel après chaque cooldown.';
    } else if (currentNotif) {
        statusText = currentNotif === 'MP'
            ? '📩 **Alerte ponctuelle :** Active en Message Privé'
            : `🔔 **Alerte ponctuelle :** Active dans <#${currentNotif}>`;
    }

    const repeatText = isRepeat
        ? '🔁 **Fréquence :** Tous tes prochains tirages'
        : '1️⃣ **Fréquence :** Uniquement le prochain tirage';

    const mpInterText = mpInteractions
        ? '📩 **Alertes MP interactions :** Activées *(Pickpocket, Poison, Redirections, fin Pseudo Lock)*'
        : '🔕 **Alertes MP interactions :** Désactivées';

    const displayName = member?.displayName || member?.user?.username || 'Membre';
    const avatarUrl = member?.displayAvatarURL?.({ dynamic: true }) || member?.user?.displayAvatarURL?.({ dynamic: true }) || null;

    const embed = new EmbedBuilder()
        .setColor(currentNotif || isRepeat || mpInteractions ? 0x3498db : 0x95a5a6)
        .setAuthor({ name: `Alertes Roulette • ${displayName}`, iconURL: avatarUrl || undefined })
        .setTitle('🔔 Prévenir à la fin du cooldown roulette')
        .setDescription(
            (hasCd
                ? `⏱️ Prochain tirage prêt **<t:${Math.ceil(finCd / 1000)}:R>** *(à <t:${Math.ceil(finCd / 1000)}:T>)*.\n\n`
                : `✅ Ton cooldown roulette est déjà terminé ! Tu peux lancer ton tirage dès maintenant.\n\n`) +
            `${statusText}\n${repeatText}\n${mpInterText}` +
            (statusNote ? `\n\n${statusNote}` : '')
        );

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`roulette_notif:here:${userId}${ctxSuffix}`)
            .setLabel('Me prévenir ici')
            .setEmoji('🔔')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(!hasCd),
        new ButtonBuilder()
            .setCustomId(`roulette_notif:dm:${userId}${ctxSuffix}`)
            .setLabel('Me prévenir en MP')
            .setEmoji('📩')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!hasCd),
        new ButtonBuilder()
            .setCustomId(`roulette_notif:off:${userId}${ctxSuffix}`)
            .setLabel('Désactiver')
            .setEmoji('🔕')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(!currentNotif && !isRepeat)
    );

    const rowRepeat = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`roulette_notif:repeat_on:${userId}${ctxSuffix}`)
            .setLabel('Tous tirages')
            .setEmoji('🔁')
            .setStyle(isRepeat ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setDisabled(isRepeat),
        new ButtonBuilder()
            .setCustomId(`roulette_notif:repeat_off:${userId}${ctxSuffix}`)
            .setLabel('Que le prochain tirage')
            .setEmoji('1️⃣')
            .setStyle(!isRepeat ? ButtonStyle.Primary : ButtonStyle.Secondary)
            .setDisabled(!isRepeat),
        new ButtonBuilder()
            .setCustomId(`roulette_notif:mp_int_toggle:${userId}${ctxSuffix}`)
            .setLabel(mpInteractions ? 'MP interactions ✓' : 'MP interactions')
            .setEmoji('📩')
            .setStyle(mpInteractions ? ButtonStyle.Success : ButtonStyle.Secondary)
    );

    const navRow = new ActionRowBuilder();
    if (ctx !== 'ephem') navRow.addComponents(buildRouletteAccueilButton(userId));
    navRow.addComponents(buildRouletteCloseButton(userId));

    return { embeds: [embed], components: [row, rowRepeat, navRow] };
}

function buildRowResultatRoulette(authorId, outcomeId, failIndex) {
    const hasNotif = aUneNotifRouletteActive(authorId);
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('roulette_tour').setLabel('À mon tour').setEmoji('🎲').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`roulette_probas_res_${authorId}_${outcomeId}_${failIndex}`).setLabel('Probas').setEmoji('📊').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`roulette_claim_btn_${authorId}`).setLabel('Inventaire').setEmoji('🎒').setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('roulette_notif:menu')
            .setLabel(hasNotif ? 'Alertes ✓' : 'Alertes')
            .setEmoji('🔔')
            .setStyle(hasNotif ? ButtonStyle.Primary : ButtonStyle.Secondary)
    );
}

function buildRouletteTypeEmbed(type) {
    const titres = { bonus: '🎉 Bonus', malus: '💀 Malus', special: '✨ Spéciaux' };
    const lignes = ROULETTE_TABLE
        .filter(e => e.type === type)
        .sort((a, b) => b.poids - a.poids)
        .map(e => {
            const emoji = ROULETTE_EMOJIS_PAR_ID[e.id] ?? '❓';
            const slug = ROULETTE_ID_VERS_SLUG[e.id];
            return slug ? `${emoji} **${e.nom}** — \`${slug}\`` : `${emoji} **${e.nom}**`;
        });
    return new EmbedBuilder()
        .setColor(0xffd20a)
        .setTitle(`${titres[type]} — !roulette`)
        .setDescription(lignes.join('\n'));
}

function probaReelle(entry) {
    const total = ROULETTE_TABLE.reduce((s, e) => s + e.poids, 0);
    return entry.poids * (1 - ROULETTE_TAUX_ECHEC) / total;
}

function getTauxEchecRoulette() {
    return estRouletteMauditeDoree() ? 0 : ROULETTE_TAUX_ECHEC;
}

function probaEffectiveRoulette(entry) {
    const total = ROULETTE_TABLE.reduce((s, e) => s + e.poids, 0);
    return entry.poids * (1 - getTauxEchecRoulette()) / total;
}

function arrondiJoli(n) {
    if (n < 20) return Math.round(n);
    if (n < 100) return Math.round(n / 5) * 5;
    if (n < 1000) return Math.round(n / 10) * 10;
    if (n < 5000) return Math.round(n / 100) * 100;
    return Math.round(n / 500) * 500;
}

function probaAffichee(p) {
    const n = arrondiJoli(1 / p);
    const pct = 100 / n;
    return { n, pct: pct >= 0.1 ? String(parseFloat(pct.toFixed(2))) : pct.toFixed(3) };
}

function piocherRoulette(pool, totalGlobal, defaut) {
    let tirage = Math.random() * totalGlobal;
    for (const e of pool) {
        if (tirage < e.poids) return e.id;
        tirage -= e.poids;
    }
    return defaut;
}

function tirerRoulette(userId, guildId = null, isTcgCollector = false) {
    const pity = roulettePity.get(userId) ?? { malus: 0, nuls: 0 };
    const garanti = pity.malus >= ROULETTE_PITY_MALUS || pity.nuls >= ROULETTE_PITY_NULS;
    const poolEligible = ROULETTE_TABLE.filter(e => !e.tcgOnly || isTcgCollector);

    let outcomeId;
    if (garanti) {
        const bonus = poolEligible.filter(e => e.type === 'bonus');
        outcomeId = piocherRoulette(bonus, bonus.reduce((s, e) => s + e.poids, 0), bonus[bonus.length - 1].id);
    } else {
        const boostCharges = rouletteJackpotBoostCharges.get(userId) || 0;
        const boostVal = boostCharges > 0 ? (rouletteJackpotBoostValue.get(userId) || 0.25) : 0;
        const boostAnniv = bridge.estAnniversaireAujourdhui(guildId, userId) ? 0.50 : 0;
        const totalJackpot = (rouletteJackpotBonus.get(userId) || 0) + boostVal + boostAnniv;

        if (totalJackpot > 0 && Math.random() < totalJackpot) {
            const bonus = poolEligible.filter(e => e.type === 'bonus');
            outcomeId = piocherRoulette(bonus, bonus.reduce((s, e) => s + e.poids, 0), bonus[bonus.length - 1].id);
        } else {
            const total = poolEligible.reduce((s, e) => s + e.poids, 0);
            const tauxEchec = getTauxEchecRoulette();
            if (tauxEchec <= 0) {
                outcomeId = piocherRoulette(poolEligible, total, poolEligible[poolEligible.length - 1].id);
            } else {
                outcomeId = piocherRoulette(poolEligible, total / (1 - tauxEchec), 'aucun-resultat');
            }
        }
    }

    const type = ROULETTE_TABLE.find(e => e.id === outcomeId)?.type;
    if (type === 'bonus') {
        roulettePity.delete(userId);
        rouletteJackpotBonus.delete(userId);
    } else if (type === 'malus') {
        pity.malus++; roulettePity.set(userId, pity);
    } else if (outcomeId === 'aucun-resultat') {
        pity.nuls++; roulettePity.set(userId, pity);
        const actuel = rouletteJackpotBonus.get(userId) || 0;
        rouletteJackpotBonus.set(userId, Math.min(ROULETTE_JACKPOT_MAX, actuel + ROULETTE_JACKPOT_INCREMENT));
    }
    return outcomeId;
}

function estImmuniseRoulette(userId) {
    const fin = rouletteImmuniteUntil.get(userId);
    if (!fin) return false;
    if (Date.now() >= fin) { rouletteImmuniteUntil.delete(userId); return false; }
    return true;
}

function annulerTiragesAGogo(userId) {
    rouletteFreeRollUntil.delete(userId);
    rouletteCoupTripleCharges.delete(userId);
}

function malusDiffere(message, nom, titre, futur, passe, action) {
    message.differe = { action, texteFinal: `💀 **${nom}** ${passe}.` };
    return `⚠️ **${nom}**, tu es tombé.e sur le malus **${titre}** : tu seras ${futur}.\nProfite de tes **10 dernières secondes** !`;
}

function appliquerBonusMiracle(member, auteurNom, libelleMalus) {
    const curJ = rouletteJackpotBonus.get(member.id) || 0;
    rouletteJackpotBonus.set(member.id, Math.min(ROULETTE_JACKPOT_MAX, Number((curJ + 0.05).toFixed(4))));

    const nowM = Date.now();
    const finCd = rouletteCooldowns.get(member.id) || 0;
    let cdNote = '';
    if (finCd > nowM) {
        const nouveauCd = finCd - 5 * 60 * 1000;
        if (nouveauCd <= nowM) {
            rouletteCooldowns.delete(member.id);
            desarmerNotifRoulette(member.id);
            cdNote = ' & cooldown réinitialisé';
        } else {
            rouletteCooldowns.set(member.id, nouveauCd);
            cdNote = ' & -5 min de cooldown';
        }
    }
    bridge.demanderSauvegarde();
    return `✨ **Miracle !** **${auteurNom}** retombe sur ${libelleMalus} : le malus est **annulé** !\n-# 🍀 *Contre-poison : +5% Jackpot${cdNote}*`;
}

async function appliquerEtDecrireResultat(outcomeId, message, auteurNom, failIndex) {
    const member = message.member;
    const estModoUser = bridge.estModo(member);
    const multTemps = getMultiplicateurMalusTemps(member.id);

    switch (outcomeId) {
        case 'malus-redirect-bonus-hasard':
        case 'bonus-redirect-bonus-hasard': {
            const tot = (rouletteRedirectBonusCharges.get(member.id) || 0) + 1;
            rouletteRedirectBonusCharges.set(member.id, tot);
            return `🎁 **${auteurNom}** subit le malus **Prochain bonus redirigé au hasard** ! Son prochain bonus sera offert à un.e autre membre ! (${tot} en réserve)`;
        }
        case 'bonus-redirect-bonus-choix':
            crediterInventaireRoulette(member.id, 'redirectBonusChoix', 1);
            return `🎀 **${auteurNom}** a gagné une **Redirection de bonus au choix** !\n-# 🎒 *Stocké dans ton inventaire (\`!rlt claim\` pour choisir qui recevra ton prochain bonus).*`;
        case 'bonus-partage-bonus':
            crediterInventaireRoulette(member.id, 'partageBonus', 1);
            return `🤝 **${auteurNom}** a gagné un **Partage de bonus au choix** !\n-# 🎒 *Stocké dans ton inventaire (\`!rlt claim\` pour choisir avec qui partager ton prochain bonus).*`;
        case 'bonus-plagiat': {
            const nowPlag = Date.now();
            const candidats = [];
            const pushSiMembre = (uid, label, applyFn) => {
                if (uid === member.id) return;
                const src = message.guild?.members?.cache?.get(uid);
                if (!src || src.user?.bot) return;
                candidats.push({ src, label, applyFn });
            };

            for (const [uid, fin] of rouletteCouronneUntil.entries()) {
                if (fin > nowPlag) pushSiMembre(uid, 'Couronne 👑', () => {
                    rouletteCouronneUntil.set(member.id, Math.max(rouletteCouronneUntil.get(member.id) || 0, fin));
                });
            }
            for (const [uid, fin] of rouletteAntiFeurUntil.entries()) {
                if (fin > nowPlag) pushSiMembre(uid, 'Anti-Feur 🛡️', () => {
                    rouletteAntiFeurUntil.set(member.id, Math.max(rouletteAntiFeurUntil.get(member.id) || 0, fin));
                });
            }
            for (const [uid, fin] of rouletteDiviseurUntil.entries()) {
                if (fin > nowPlag) pushSiMembre(uid, 'Diviseur ➗', () => {
                    if (estHappyHour()) crediterInventaireRoulette(member.id, 'diviseur', 1);
                    else rouletteDiviseurUntil.set(member.id, Math.max(rouletteDiviseurUntil.get(member.id) || 0, fin));
                });
            }
            for (const [uid, qte] of rouletteBouclierActif.entries()) {
                const nb = typeof qte === 'number' ? qte : (qte ? 1 : 0);
                if (nb > 0) pushSiMembre(uid, 'Bouclier 🛡️', () => {
                    const tot = (rouletteBouclierActif.get(member.id) || 0) + 1;
                    rouletteBouclierActif.set(member.id, tot);
                    if (tot >= 10) deverrouillerSucces(member.id, 'forteresse', message.channel);
                });
            }
            for (const [uid, qte] of rouletteCoupTripleCharges.entries()) {
                if (qte > 0) pushSiMembre(uid, 'Coup Triple 🎰', () => {
                    rouletteCooldowns.delete(member.id);
                    rouletteCoupTripleCharges.set(member.id, (rouletteCoupTripleCharges.get(member.id) || 0) + Math.min(3, qte));
                });
            }
            for (const [uid, qte] of rouletteCooldownCourtCharges.entries()) {
                if (qte > 0) pushSiMembre(uid, 'Cooldown réduit (5 min) ⚡', () => {
                    rouletteCooldownCourtCharges.set(member.id, (rouletteCooldownCourtCharges.get(member.id) || 0) + Math.min(3, qte));
                });
            }
            for (const [uid, qte] of rouletteJackpotBoostCharges.entries()) {
                if (qte > 0) pushSiMembre(uid, 'Boost Jackpot 📈', () => {
                    rouletteJackpotBoostCharges.set(member.id, (rouletteJackpotBoostCharges.get(member.id) || 0) + 2);
                    rouletteJackpotBoostValue.set(member.id, (rouletteJackpotBoostValue.get(member.id) || 0) + 0.25);
                });
            }
            for (const [uid, qte] of rouletteRedirectCharges.entries()) {
                if (qte > 0) pushSiMembre(uid, 'Redirection de malus 😈', () => {
                    rouletteRedirectCharges.set(member.id, (rouletteRedirectCharges.get(member.id) || 0) + 1);
                });
            }

            if (candidats.length > 0) {
                const choix = candidats[Math.floor(Math.random() * candidats.length)];
                choix.applyFn();
                bridge.demanderSauvegarde();
                return `📋 **${auteurNom}** fait du **Plagiat** et copie le bonus **${choix.label}** de **${choix.src.displayName}** *(sans rien lui retirer)* !`;
            }

            const totBouclier = (rouletteBouclierActif.get(member.id) || 0) + 2;
            rouletteBouclierActif.set(member.id, totBouclier);
            if (totBouclier >= 10) deverrouillerSucces(member.id, 'forteresse', message.channel);
            bridge.demanderSauvegarde();
            return `📋 **${auteurNom}** tente un **Plagiat**... mais personne n'avait de bonus actif ! Cacabot lui offre **2 charges de bouclier** (${totBouclier} en réserve) !`;
        }
        case 'bonus-diviseur': {
            if (estHappyHour()) {
                crediterInventaireRoulette(member.id, 'diviseur', 1);
                return `➗ **${auteurNom}** a gagné le **Diviseur (2h)** !\n-# 🎒 *C'est l'Happy Hour : stocké dans ton inventaire (\`!rlt claim\`) pour ne pas le gaspiller !*`;
            }
            const nowDiv = Date.now();
            const baseDiv = Math.max(nowDiv, rouletteDiviseurUntil.get(member.id) || 0);
            const finDiv = baseDiv + 2 * 60 * 60 * 1000;
            rouletteDiviseurUntil.set(member.id, finDiv);
            const finCdActuel = rouletteCooldowns.get(member.id);
            if (finCdActuel && finCdActuel > nowDiv) {
                rouletteCooldowns.set(member.id, nowDiv + Math.ceil((finCdActuel - nowDiv) / 2));
            }
            bridge.demanderSauvegarde();
            return `➗ **${auteurNom}** active le **Diviseur** pendant **2h** (fin <t:${Math.ceil(finDiv / 1000)}:R>) ! Tous ses cooldowns sont divisés par 2 *(hors Happy Hour, même sous malus)* !`;
        }
        case 'malus-sans-consonne': {
            const duree = 2 * 60 * 60 * 1000 * multTemps;
            const h = 2 * multTemps;
            if (basculerTransfo(member.id, 'sansConsonne', duree)) return appliquerBonusMiracle(member, auteurNom, 'le malus **0 Consonne**');
            return `🅾️ **${auteurNom}** n'a plus le droit d'utiliser de **consonnes** pendant **${h}h** !${multTemps > 1 ? ' *(Durée x2 appliquée !)*' : ''}`;
        }
        case 'malus-sans-voyelle': {
            const duree = 3 * 60 * 60 * 1000 * multTemps;
            const h = 3 * multTemps;
            if (basculerTransfo(member.id, 'sansVoyelle', duree)) return appliquerBonusMiracle(member, auteurNom, 'le malus **0 Voyelle**');
            return `🚫 **${auteurNom}** n'a plus le droit d'utiliser de **voyelles** pendant **${h}h** !${multTemps > 1 ? ' *(Durée x2 appliquée !)*' : ''}`;
        }
        case 'malus-double-temps-24h': {
            const finActuelle = rouletteDoubleTempsUntil.get(member.id);
            if (finActuelle && Date.now() < finActuelle) {
                rouletteDoubleTempsUntil.delete(member.id);
                return appliquerBonusMiracle(member, auteurNom, 'le malus **Malus x2**');
            }
            rouletteDoubleTempsUntil.set(member.id, Date.now() + 24 * 60 * 60 * 1000);
            return `⏳ **${auteurNom}** subit le malus **Malus x2** : pendant **24h**, la durée de tous ses prochains malus textuels et pseudos sera **multipliée par 2** !`;
        }
        case 'malus-timeout-3min':
            if (estImmuniseRoulette(member.id)) return `🛡️ **${auteurNom}** est immunisé·e et évite le mute de 3 minutes !`;
            if (estModoUser) return `🛡️ **${auteurNom}** est Modo : le mute de 3 minutes est annulé !`;
            annulerTiragesAGogo(member.id);
            await member.timeout(3 * 60 * 1000, 'Roulette').catch(() => {});
            rouletteTimeoutUntil.set(member.id, Date.now() + 3 * 60 * 1000);
            return `**${auteurNom}** est mute pendant **3 minutes**.`;
        case 'malus-timeout-5min':
            if (estImmuniseRoulette(member.id)) return `🛡️ **${auteurNom}** est immunisé·e et évite le mute de 5 minutes !`;
            if (estModoUser) return `🛡️ **${auteurNom}** est Modo : le mute de 5 minutes est annulé !`;
            annulerTiragesAGogo(member.id);
            await member.timeout(5 * 60 * 1000, 'Roulette').catch(() => {});
            rouletteTimeoutUntil.set(member.id, Date.now() + 5 * 60 * 1000);
            return `**${auteurNom}** est mute pendant **5 minutes**.`;
        case 'malus-timeout-20min':
            if (estImmuniseRoulette(member.id)) return `🛡️ **${auteurNom}** est immunisé·e et évite le mute de 20 minutes !`;
            annulerTiragesAGogo(member.id);
            if (estModoUser) {
                rouletteCooldowns.set(member.id, Date.now() + 20 * 60 * 1000);
                return `🛡️ **${auteurNom}** est Modo : le mute de 20 minutes est remplacé par un cooldown de **20 minutes**.`;
            }
            await member.timeout(20 * 60 * 1000, 'Roulette').catch(() => {});
            rouletteTimeoutUntil.set(member.id, Date.now() + 20 * 60 * 1000);
            return `**${auteurNom}** est mute pendant **20 minutes**.`;
        case 'malus-exclu-heure':
            if (estImmuniseRoulette(member.id)) return `🛡️ **${auteurNom}** est immunisé·e et évite l'exclusion de 1 heure !`;
            annulerTiragesAGogo(member.id);
            if (estModoUser) {
                rouletteCooldowns.set(member.id, Date.now() + 60 * 60 * 1000);
                return `🛡️ **${auteurNom}** est Modo : l'exclusion de 1 heure est remplacée par un cooldown de **1 heure**.`;
            }
            return malusDiffere(message, auteurNom, 'Exclusion de 1 heure', 'exclu.e pendant **1 heure**', 'a été exclu.e pendant **1 heure**',
                () => {
                    member.timeout(60 * 60 * 1000, 'Roulette').catch(() => {});
                    rouletteTimeoutUntil.set(member.id, Date.now() + 60 * 60 * 1000);
                });
        case 'malus-exclu-jour':
            if (estImmuniseRoulette(member.id)) return `🛡️ **${auteurNom}** est immunisé·e et évite l'exclusion de 1 jour !`;
            deverrouillerSucces(member.id, 'silence-radio', message.channel);
            annulerTiragesAGogo(member.id);
            if (estModoUser) {
                rouletteCooldowns.set(member.id, Date.now() + 24 * 60 * 60 * 1000);
                return `🛡️ **${auteurNom}** est Modo : l'exclusion de 1 jour est remplacée par un cooldown de **1 jour**.`;
            }
            return malusDiffere(message, auteurNom, 'Exclusion de 1 jour', 'exclu.e pendant **1 jour**', 'a été exclu.e pendant **1 jour**',
                () => {
                    member.timeout(24 * 60 * 60 * 1000, 'Roulette').catch(() => {});
                    rouletteTimeoutUntil.set(member.id, Date.now() + 24 * 60 * 60 * 1000);
                });
        case 'malus-exclu-semaine':
            deverrouillerSucces(member.id, 'survivant-enfer', message.channel);
            if (estImmuniseRoulette(member.id)) return `🛡️ **${auteurNom}** est immunisé·e et évite l'exclusion de 1 semaine !`;
            annulerTiragesAGogo(member.id);
            if (estModoUser) {
                rouletteCooldowns.set(member.id, Date.now() + 7 * 24 * 60 * 60 * 1000);
                return `🛡️ **${auteurNom}** est Modo : l'exclusion de 1 semaine est remplacée par un cooldown de **1 semaine**.`;
            }
            return malusDiffere(message, auteurNom, 'Exclusion de 1 semaine', 'exclu.e pendant **1 semaine**', 'a été exclu.e pendant **1 semaine**',
                () => {
                    member.timeout(7 * 24 * 60 * 60 * 1000, 'Roulette').catch(() => {});
                    rouletteTimeoutUntil.set(member.id, Date.now() + 7 * 24 * 60 * 60 * 1000);
                });
        case 'bonus-gif-ou-audio': {
            const todayStr = new Date().toDateString();
            const rec = roulettePapayouDaily.get(member.id) ?? { date: todayStr, count: 0 };
            rec.count = rec.date === todayStr ? rec.count + 1 : 1;
            rec.date = todayStr;
            roulettePapayouDaily.set(member.id, rec);
            if (rec.count >= 3) deverrouillerSucces(member.id, 'fan-carlos', message.channel);
            if (!Array.isArray(message.files)) message.files = [];
            if (!message.files.includes('./PAPAYOU.mp3')) message.files.push('./PAPAYOU.mp3');
            return `**${auteurNom}** a fait spawn un petit cadeau !`;
        }
        case 'bonus-anti-feur':
            rouletteAntiFeurUntil.set(member.id, Date.now() + 24 * 60 * 60 * 1000);
            return `🛡️ **${auteurNom}** est immunisé·e contre Cacabot pendant **24h** ! Il réagira avec 🛡️ à la place de Feur.`;
        case 'bonus-coup-triple': {
            rouletteCooldowns.delete(member.id);
            const chargesActuelles = rouletteCoupTripleCharges.get(member.id) || 0;
            const totalCharges = chargesActuelles + 3;
            rouletteCoupTripleCharges.set(member.id, totalCharges);
            return `🎰 **${auteurNom}** décroche le **COUP TRIPLE** ! **3 tirages supplémentaires** immédiats et sans aucun cooldown (${totalCharges} en réserve) !`;
        }
        case 'bonus-regadex-perso': {
            const { MessageFlags } = require('discord.js');
            await message.channel.send({ content: `Bravo ! Tu as gagné une **carte RegaDex unique et personnalisée** créée spécialement pour toi ! <@${bridge.EPSYS_ID}> viendra te voir pour en discuter✨`, flags: [MessageFlags.SuppressNotifications] });
            await message.channel.send({ files: ["https://media.tenor.com/PxSJqqZ_lDsAAAAM/jdg-joueur-du-grenier.gif"], flags: [MessageFlags.SuppressNotifications] }).catch(() => {});
            return `**${auteurNom}** a gagné sa **carte RegaDex unique personnalisée** !`;
        }
        case 'bonus-twitch-jeu': {
            const { MessageFlags } = require('discord.js');
            await message.channel.send({ content: `Bravo ! Tu as gagné le choix du jeu du prochain stream Twitch (jeu court uniquement) ! <@${bridge.EPSYS_ID}> viendra te voir pour en discuter✨`, flags: [MessageFlags.SuppressNotifications] });
            await message.channel.send({ files: ["https://media.tenor.com/PxSJqqZ_lDsAAAAM/jdg-joueur-du-grenier.gif"], flags: [MessageFlags.SuppressNotifications] }).catch(() => {});
            return `**${auteurNom}** a gagné le choix du jeu du prochain stream !`;
        }
        case 'bonus-commande-perso': {
            const { MessageFlags } = require('discord.js');
            await message.channel.send({ content: `Bravo ! Tu as gagné le droit d'ajouter une commande de ton choix à Cacabot (modifiable par les admins) ! <@${bridge.EPSYS_ID}> viendra te voir pour en discuter✨`, flags: [MessageFlags.SuppressNotifications] });
            await message.channel.send({ files: ["https://media.tenor.com/PxSJqqZ_lDsAAAAM/jdg-joueur-du-grenier.gif"], flags: [MessageFlags.SuppressNotifications] }).catch(() => {});
            return `**${auteurNom}** a gagné une commande Cacabot personnalisée !`;
        }
        case 'bonus-epsys-5e': {
            const { MessageFlags } = require('discord.js');
            deverrouillerSucces(member.id, 'argent-epsys', message.channel);
            await message.channel.send({ content: `Bravo ! Tu as gagné 5€ de la YouTube Money d'Epsys ! <@${bridge.EPSYS_ID}> viendra te voir pour en discuter✨`, flags: [MessageFlags.SuppressNotifications] });
            await message.channel.send({ files: ["https://media.tenor.com/PxSJqqZ_lDsAAAAM/jdg-joueur-du-grenier.gif"], flags: [MessageFlags.SuppressNotifications] }).catch(() => {});
            return `**${auteurNom}** a gagné 5€ !`;
        }
        case 'bonus-epsys-photo': {
            const { MessageFlags } = require('discord.js');
            await message.channel.send({ content: `Bravo ! Tu as gagné une photo disgracieuse d'Epsys signée et envoyée chez toi par la Poste ! <@${bridge.EPSYS_ID}> viendra te voir pour en discuter✨`, flags: [MessageFlags.SuppressNotifications] });
            await message.channel.send({ files: ["https://media.tenor.com/PxSJqqZ_lDsAAAAM/jdg-joueur-du-grenier.gif"], flags: [MessageFlags.SuppressNotifications] }).catch(() => {});
            return `**${auteurNom}** a gagné une photo disgracieuse d'Epsys !`;
        }
        case 'bonus-youtube-credit': {
            const { MessageFlags } = require('discord.js');
            await message.channel.send({ content: `WOW, ça c'est de la chance ! Ton pseudo crédité sous chaque vidéo YouTube d'Epsys à partir d'aujourd'hui ! <@${bridge.EPSYS_ID}> viendra te voir pour en discuter✨`, flags: [MessageFlags.SuppressNotifications] });
            await message.channel.send({ files: ["https://media.tenor.com/PxSJqqZ_lDsAAAAM/jdg-joueur-du-grenier.gif"], flags: [MessageFlags.SuppressNotifications] }).catch(() => {});
            return `**${auteurNom}** a gagné un crédit YouTube !`;
        }
        case 'bonus-epsys-goodies': {
            const { MessageFlags } = require('discord.js');
            await message.channel.send({ content: `Bravo ! Tu as gagné un goodie Epsys gratuit au choix (T-Shirt/Mug/Lot de 5 pin's) ! <@${bridge.EPSYS_ID}> viendra te voir pour en discuter✨`, flags: [MessageFlags.SuppressNotifications] });
            await message.channel.send({ files: ["https://media.tenor.com/PxSJqqZ_lDsAAAAM/jdg-joueur-du-grenier.gif"], flags: [MessageFlags.SuppressNotifications] }).catch(() => {});
            return `**${auteurNom}** a gagné un goodie Epsys !`;
        }
        case 'bonus-epsys-petitdej': {
            const { MessageFlags } = require('discord.js');
            await message.channel.send({ content: `QUOI ?? Je pensais même pas que quelqu'un pouvait l'avoir ! Lors d'une prochaine convention ou rencontre IRL, Epsys devra t'apporter un petit déjeuner en maid dress x) <@${bridge.EPSYS_ID}> viendra te voir pour en discuter✨`, flags: [MessageFlags.SuppressNotifications] });
            await message.channel.send({ files: ["https://media.tenor.com/PxSJqqZ_lDsAAAAM/jdg-joueur-du-grenier.gif"], flags: [MessageFlags.SuppressNotifications] }).catch(() => {});
            return `**${auteurNom}** a gagné le petit déj légendaire !`;
        }
        case 'bonus-elu-roulette': {
            const roleId = '1553670290448457829';
            if (member.roles.cache.has(roleId)) return `**${auteurNom}** a déjà le rôle **Élu·e de la Roulette** — pas de doublon possible !`;
            await member.roles.add(roleId).catch(() => {});
            return `👑 **${auteurNom}** obtient le rôle **Élu·e de la Roulette** !`;
        }
        case 'bonus-role-superieur': {
            deverrouillerSucces(member.id, 'ascension-sociale', message.channel);
            let rangActuel = -1;
            for (let i = ROULETTE_RANGS.length - 1; i >= 0; i--) {
                if (member.roles.cache.has(ROULETTE_RANGS[i].id)) { rangActuel = i; break; }
            }
            if (rangActuel === ROULETTE_RANGS.length - 1) return `**${auteurNom}** est déjà **${ROULETTE_RANGS[rangActuel].label}**, le rang max !\nChoisis un autre bonus à la place dans le menu ci-dessous.`;
            const prochainRang = ROULETTE_RANGS[rangActuel + 1];
            if (rangActuel > 0) await member.roles.remove(ROULETTE_RANGS[rangActuel].id).catch(() => {});
            await member.roles.add(prochainRang.id).catch(() => {});
            return `**${auteurNom}** passe au rang **${prochainRang.label}** !`;
        }
        case 'bonus-legendaire': {
            deverrouillerSucces(member.id, 'ascension-sociale', message.channel);
            const roleId = ROULETTE_RANGS[ROULETTE_RANGS.length - 1].id;
            if (member.roles.cache.has(roleId)) return `**${auteurNom}** est déjà **${ROULETTE_RANGS[ROULETTE_RANGS.length - 1].label}**, le rang max !\nChoisis un autre bonus à la place dans le menu ci-dessous.`;
            for (const rang of ROULETTE_RANGS) {
                if (rang.id !== ROULETTE_RANGS[0].id && member.roles.cache.has(rang.id)) await member.roles.remove(rang.id).catch(() => {});
            }
            await member.roles.add(roleId).catch(() => {});
            return `👑 **${auteurNom}** passe directement au rang **Regaïen·ne légendaire** !`;
        }
        case 'bonus-jackpot-boost': {
            const curCharges = rouletteJackpotBoostCharges.get(member.id) || 0;
            const curVal = rouletteJackpotBoostValue.get(member.id) || 0;
            const newCharges = curCharges + 2;
            const newVal = curVal + 0.25;
            rouletteJackpotBoostCharges.set(member.id, newCharges);
            rouletteJackpotBoostValue.set(member.id, newVal);
            bridge.trackBattlePassProgress?.(member.id, 'jackpot_haut', 1);
            return `📈 **${auteurNom}** active un **BOOST JACKPOT IMMÉDIAT** ! **+${Math.round(newVal * 100)}% de chance de bonus** sur ses **${newCharges} prochains tirages** (cumulable) !`;
        }
        case 'bonus-super-bouclier': {
            const actuelles = rouletteBouclierActif.get(member.id) || 0;
            const total = actuelles + 3;
            rouletteBouclierActif.set(member.id, total);
            if (total >= 10) deverrouillerSucces(member.id, 'forteresse', message.channel);
            return `🔰 **${auteurNom}** décroche le **SUPER BOUCLIER** ! **+3 charges de bouclier** ajoutées (${total} en réserve) !`;
        }
        case 'malus-ban':
            deverrouillerSucces(member.id, 'survivant-enfer', message.channel);
            if (estImmuniseRoulette(member.id)) return `🛡️ **${auteurNom}** est immunisé·e et évite le ban définitif !`;
            annulerTiragesAGogo(member.id);
            if (estModoUser) {
                rouletteCooldowns.set(member.id, Date.now() + 7 * 24 * 60 * 60 * 1000);
                return `🛡️ **${auteurNom}** est Modo : le ban est remplacé par un cooldown de **1 semaine**.`;
            }
            return malusDiffere(message, auteurNom, 'Ban définitif', 'banni.e du serveur', 'a été banni.e du serveur', () => member.ban({ reason: 'Roulette' }).catch(() => {}));
        case 'bonus-couronne':
            deverrouillerSucces(member.id, 'laristocrate', message.channel);
            rouletteCouronneUntil.set(member.id, Date.now() + 12 * 60 * 60 * 1000);
            return `👑 **${auteurNom}** est officiellement respecté·e par Cacabot pendant **12h** !`;
        case 'malus-pseudo-lock-semaine': {
            const pseudo = ROULETTE_NOMS_PSEUDO_LOCK[Math.floor(Math.random() * ROULETTE_NOMS_PSEUDO_LOCK.length)];
            const lockExistant = roulettePseudoLock.get(member.id);
            const originalNickname = lockExistant?.originalNickname !== undefined ? lockExistant.originalNickname : (member.nickname ?? null);
            const dureeJours = 7 * multTemps;
            roulettePseudoLock.set(member.id, { until: Date.now() + dureeJours * 24 * 60 * 60 * 1000, pseudo, originalNickname });
            await member.setNickname(pseudo).catch(() => {});
            return `<@${member.id}> est renommé·e en **${pseudo}**, verrouillé pendant **${dureeJours} jours** !${multTemps > 1 ? ' *(Durée x2 appliquée !)*' : ''}`;
        }
        case 'malus-pseudo-lock-mois': {
            const pseudo = ROULETTE_NOMS_PSEUDO_LOCK[Math.floor(Math.random() * ROULETTE_NOMS_PSEUDO_LOCK.length)];
            const lockExistant = roulettePseudoLock.get(member.id);
            const originalNickname = lockExistant?.originalNickname !== undefined ? lockExistant.originalNickname : (member.nickname ?? null);
            const dureeJours = 30 * multTemps;
            roulettePseudoLock.set(member.id, { until: Date.now() + dureeJours * 24 * 60 * 60 * 1000, pseudo, originalNickname });
            await member.setNickname(pseudo).catch(() => {});
            return `<@${member.id}> est renommé·e en **${pseudo}**, verrouillé pendant **${dureeJours} jours** !${multTemps > 1 ? ' *(Durée x2 appliquée !)*' : ''}`;
        }
        case 'malus-uwu-24h': {
            const finUwu = rouletteUwuUntil.get(member.id);
            if (finUwu && Date.now() < finUwu) {
                rouletteUwuUntil.delete(member.id);
                return appliquerBonusMiracle(member, auteurNom, 'le malus **UwU**');
            }
            const duree = 6 * 60 * 60 * 1000 * multTemps;
            rouletteUwuUntil.set(member.id, Date.now() + duree);
            return `**${auteurNom}** doit terminer chacun de ses messages par **UwU** pendant **${6 * multTemps}h** !${multTemps > 1 ? ' *(Durée x2 appliquée !)*' : ''}`;
        }
        case 'malus-lettre-interdite': {
            const lockLettre = rouletteLettreInterdite.get(member.id);
            if (lockLettre && Date.now() < lockLettre.until) {
                rouletteLettreInterdite.delete(member.id);
                return appliquerBonusMiracle(member, auteurNom, 'la **lettre interdite**');
            }
            const lettre = String.fromCharCode(65 + Math.floor(Math.random() * 26));
            const duree = 6 * 60 * 60 * 1000 * multTemps;
            rouletteLettreInterdite.set(member.id, { until: Date.now() + duree, lettre });
            return `**${auteurNom}** ne peut plus utiliser la lettre **${lettre}** pendant **${6 * multTemps}h** !${multTemps > 1 ? ' *(Durée x2 appliquée !)*' : ''}`;
        }
        case 'bonus-redirect-malus': {
            const total = (rouletteRedirectCharges.get(member.id) || 0) + 3;
            rouletteRedirectCharges.set(member.id, total);
            return `😈 **${auteurNom}** peut rediriger ses **3 prochains malus** vers un·e autre membre ! (${total} en réserve)`;
        }
        case 'malus-emoji': {
            const finEmoji = rouletteEmojiUntil.get(member.id);
            if (finEmoji && Date.now() < finEmoji) {
                rouletteEmojiUntil.delete(member.id);
                return appliquerBonusMiracle(member, auteurNom, 'l\'**emoji obligatoire**');
            }
            const duree = 6 * 60 * 60 * 1000 * multTemps;
            rouletteEmojiUntil.set(member.id, Date.now() + duree);
            return `**${auteurNom}** doit terminer chacun de ses messages par un **emoji aléatoire** pendant **${6 * multTemps}h** !${multTemps > 1 ? ' *(Durée x2 appliquée !)*' : ''}`;
        }
        case 'malus-chat-noir':
            if ((rouletteJackpotBonus.get(member.id) || 0) >= 0.05) deverrouillerSucces(member.id, 'chat-noir', message.channel);
            roulettePity.delete(member.id);
            rouletteJackpotBonus.delete(member.id);
            return `🐈‍⬛ **${auteurNom}** subit la **Malédiction du Chat Noir** : sa pity et son bonus jackpot accumulés sont réduits à zéro !`;
        case 'malus-caps':
            if (basculerTransfo(member.id, 'caps', 2 * 60 * 60 * 1000 * multTemps)) return appliquerBonusMiracle(member, auteurNom, 'les **MAJUSCULES**');
            return `**${auteurNom}** doit **PARLER EN MAJUSCULES** pendant **${2 * multTemps}h** !${multTemps > 1 ? ' *(Durée x2 appliquée !)*' : ''}`;
        case 'malus-boomer':
            if (basculerTransfo(member.id, 'boomer', 2 * 60 * 60 * 1000 * multTemps)) return appliquerBonusMiracle(member, auteurNom, 'le **mode Boomer**');
            return `🧓 **${auteurNom}** passe en **mode Boomer** pendant **${2 * multTemps}h** *(environ 1 message sur 3)* ..... A bon entendeur ... !${multTemps > 1 ? ' *(Durée x2 appliquée !)*' : ''}`;
        case 'malus-oyez':
            if (basculerTransfo(member.id, 'oyez', 3 * 60 * 60 * 1000 * multTemps)) return appliquerBonusMiracle(member, auteurNom, '**Oyez oyez !**');
            return `📯 **${auteurNom}** devient crieur public médiéval pendant **${3 * multTemps}h** *(environ 1 message sur 2)* : Oyez, oyez !${multTemps > 1 ? ' *(Durée x2 appliquée !)*' : ''}`;
        case 'malus-brise-bouclier': {
            const rawB = rouletteBouclierActif.get(member.id);
            const nbB = typeof rawB === 'number' ? rawB : (rawB ? 1 : 0);
            rouletteBouclierActif.delete(member.id);
            if (nbB > 0) return `🪓 **${auteurNom}** subit le **BRISE-BOUCLIER** : ses **${nbB} charge${nbB > 1 ? 's' : ''} de bouclier** sont réduites en miettes !`;
            return `🪓 **${auteurNom}** subit le **BRISE-BOUCLIER** ! Heureusement, **${auteurNom}** n'avait aucun bouclier en réserve... mais la menace était bien réelle !`;
        }
        case 'malus-existentiel':
            if (basculerTransfo(member.id, 'existentiel', 3 * 60 * 60 * 1000 * multTemps)) return appliquerBonusMiracle(member, auteurNom, 'la **crise existentielle**');
            return `🥀 **${auteurNom}** entre en pleine **remise en question existentielle** pendant **${3 * multTemps}h** *(environ 1 message sur 3)*... à quoi bon ?${multTemps > 1 ? ' *(Durée x2 appliquée !)*' : ''}`;
        case 'malus-linkedin':
            if (basculerTransfo(member.id, 'linkedin', 3 * 60 * 60 * 1000 * multTemps)) return appliquerBonusMiracle(member, auteurNom, 'le **gourou LinkedIn**');
            return `👔 **${auteurNom}** se transforme en **gourou LinkedIn** pendant **${3 * multTemps}h** *(environ 1 message sur 3)* ! Soyons agile 🚀${multTemps > 1 ? ' *(Durée x2 appliquée !)*' : ''}`;
        case 'malus-echo': {
            const finEcho = rouletteEchoUntil.get(member.id);
            if (finEcho && Date.now() < finEcho) {
                rouletteEchoUntil.delete(member.id);
                return appliquerBonusMiracle(member, auteurNom, 'l\'**écho condescendant**');
            }
            const duree = 3 * 60 * 60 * 1000 * multTemps;
            rouletteEchoUntil.set(member.id, Date.now() + duree);
            return `🪞 **${auteurNom}** subit l'**Écho Condescendant** pendant **${3 * multTemps}h** *(environ 1 message sur 3)* : Cacabot va lui lâcher ses meilleures remarques cassantes !${multTemps > 1 ? ' *(Durée x2 appliquée !)*' : ''}`;
        }
        case 'malus-emoji-only':
            if (basculerTransfo(member.id, 'emojiOnly', 60 * 60 * 1000 * multTemps)) return appliquerBonusMiracle(member, auteurNom, 'l\'**emoji only**');
            return `**${auteurNom}** ne peut plus s'exprimer qu'en **emojis** pendant **${1 * multTemps}h** !${multTemps > 1 ? ' *(Durée x2 appliquée !)*' : ''}`;
        case 'malus-censure':
            if (basculerTransfo(member.id, 'censure', 2 * 60 * 60 * 1000 * multTemps)) return appliquerBonusMiracle(member, auteurNom, 'la **censure**');
            return `**${auteurNom}** est **censuré·e** : un mot sur 3 disparaît pendant **${2 * multTemps}h** !${multTemps > 1 ? ' *(Durée x2 appliquée !)*' : ''}`;
        case 'malus-mots-melanges':
            if (basculerTransfo(member.id, 'mots', 2 * 60 * 60 * 1000 * multTemps)) return appliquerBonusMiracle(member, auteurNom, 'les **mots mélangés**');
            return `**${auteurNom}** a les **mots mélangés** pendant **${2 * multTemps}h** !${multTemps > 1 ? ' *(Durée x2 appliquée !)*' : ''}`;
        case 'malus-lettres-melangees':
            if (basculerTransfo(member.id, 'lettres', 60 * 60 * 1000 * multTemps)) return appliquerBonusMiracle(member, auteurNom, 'les **lettres mélangées**');
            return `**${auteurNom}** a les **lettres mélangées** pendant **${1 * multTemps}h** !${multTemps > 1 ? ' *(Durée x2 appliquée !)*' : ''}`;
        case 'malus-limite-100':
            if (basculerTransfo(member.id, 'limite100', 2 * 60 * 60 * 1000 * multTemps)) return appliquerBonusMiracle(member, auteurNom, 'la **limite de 100 caractères**');
            return `**${auteurNom}** est limité·e à **100 caractères** par message pendant **${2 * multTemps}h** !${multTemps > 1 ? ' *(Durée x2 appliquée !)*' : ''}`;
        case 'malus-limite-30':
            if (basculerTransfo(member.id, 'limite30', 60 * 60 * 1000 * multTemps)) return appliquerBonusMiracle(member, auteurNom, 'la **limite de 30 caractères**');
            return `**${auteurNom}** est limité·e à **30 caractères** par message pendant **${1 * multTemps}h** !${multTemps > 1 ? ' *(Durée x2 appliquée !)*' : ''}`;
        case 'special-tournee-generale':
            deverrouillerSucces(member.id, 'tournee-patron', message.channel);
            rouletteTourneeJusquA = Date.now() + 30 * 60 * 1000;
            for (const [uid, cd] of rouletteCooldowns.entries()) {
                if (cd > Date.now() + 5 * 60 * 1000) {
                    rouletteCooldowns.set(uid, Date.now() + 5 * 60 * 1000);
                }
            }
            return `🍻 **${auteurNom}** paie sa tournée ! **Happy Hour exceptionnel de 30 minutes activé pour tout le monde !** (Cooldowns réduits à 5 minutes)`;
        case 'malus-leet': {
            const finLeet = rouletteLeetUntil.get(member.id);
            if (finLeet && Date.now() < finLeet) {
                rouletteLeetUntil.delete(member.id);
                return appliquerBonusMiracle(member, auteurNom, 'le **l33t sp34k**');
            }
            const duree = 6 * 60 * 60 * 1000 * multTemps;
            rouletteLeetUntil.set(member.id, Date.now() + duree);
            return `**${auteurNom}** parle maintenant en **l33t sp34k** pendant **${6 * multTemps}h** !${multTemps > 1 ? ' *(Durée x2 appliquée !)*' : ''}`;
        }
        case 'malus-bebe':
            if (basculerTransfo(member.id, 'bebe', 2 * 60 * 60 * 1000 * multTemps)) return appliquerBonusMiracle(member, auteurNom, 'le **parler bébé**');
            return `🍼 **${auteurNom}** parle maintenant comme un bébé pendant **${2 * multTemps}h** : ses « j » deviennent des « z » et ses « r » des « w » !${multTemps > 1 ? ' *(Durée x2 appliquée !)*' : ''}`;
        case 'bonus-pickpocket': {
            const candidatsBouclier = [...rouletteBouclierActif.entries()]
                .filter(([uid, b]) => uid !== member.id && (typeof b === 'number' ? b > 0 : Boolean(b)))
                .map(([uid]) => message.guild?.members.cache.get(uid))
                .filter(m => m && !m.user?.bot);

            if (candidatsBouclier.length > 0) {
                const victime = candidatsBouclier[Math.floor(Math.random() * candidatsBouclier.length)];
                const boucliersVictime = rouletteBouclierActif.get(victime.id) || 1;
                const restantesVictime = boucliersVictime - 1;
                if (restantesVictime <= 0) rouletteBouclierActif.delete(victime.id);
                else rouletteBouclierActif.set(victime.id, restantesVictime);

                const mesBoucliers = (rouletteBouclierActif.get(member.id) || 0) + 1;
                rouletteBouclierActif.set(member.id, mesBoucliers);

                bridge.demanderSauvegarde();
                message.pingCible = { id: victime.id, texte: `🦹 <@${victime.id}>, **${auteurNom}** t'a fait les poches et t'a volé **1 charge de bouclier** ! 🛡️` };
                notifierMpInteractionRoulette(
                    rouletteClient || bridge?.client,
                    victime.id,
                    `🦹 **${auteurNom}** t'a fait les poches à la Roulette et t'a volé **1 charge de bouclier** ! 🛡️`
                );
                return `🦹 **${auteurNom}** réussit un vol à la tire ! Iel dérobe **1 charge de bouclier** à **${victime.displayName}** ! (${mesBoucliers} bouclier${mesBoucliers > 1 ? 's' : ''} en réserve)`;
            } else {
                const mesBoucliers = (rouletteBouclierActif.get(member.id) || 0) + 1;
                rouletteBouclierActif.set(member.id, mesBoucliers);
                bridge.demanderSauvegarde();
                return `🦹 **${auteurNom}** tente un vol à la tire... mais personne sur le serveur n'avait de bouclier en réserve ! Cacabot lui offre donc **1 charge de bouclier** de consolation (${mesBoucliers} en réserve) !`;
            }
        }
        case 'bonus-echangeur-poison':
            crediterInventaireRoulette(member.id, 'echangeurPoison', 1);
            return `🧪 **${auteurNom}** a gagné un **Échangeur de poison** !\n-# 🎒 *Stocké dans ton inventaire (\`!rlt claim\` pour transférer un de tes malus actifs vers la personne de ton choix).*`;
        case 'malus-mocking':
            if (basculerTransfo(member.id, 'mocking', 6 * 60 * 60 * 1000 * multTemps)) return appliquerBonusMiracle(member, auteurNom, 'le **Mocking**');
            return `🤡 **${auteurNom}** sUbIt Le MoCkInG pEnDaNt **${6 * multTemps}h** !${multTemps > 1 ? ' *(Durée x2 appliquée !)*' : ''}`;
        case 'malus-begaiement':
            if (basculerTransfo(member.id, 'begaiement', 4 * 60 * 60 * 1000 * multTemps)) return appliquerBonusMiracle(member, auteurNom, 'le **Bégaiement**');
            return `🗣️ **${auteurNom}** b-bégaye s-sur c-chaque m-mot p-pendant **${4 * multTemps}h** !${multTemps > 1 ? ' *(Durée x2 appliquée !)*' : ''}`;
        case 'malus-publicite':
            if (basculerTransfo(member.id, 'publicite', 2 * 60 * 60 * 1000 * multTemps)) return appliquerBonusMiracle(member, auteurNom, 'la **Publicité intrusive**');
            return `📺 **${auteurNom}** subit la **Publicité intrusive** pendant **${2 * multTemps}h** *(environ 1 message sur 3)* ! Ses messages seront sponsorisés !${multTemps > 1 ? ' *(Durée x2 appliquée !)*' : ''}`;
        case 'malus-autocorrect':
            if (basculerTransfo(member.id, 'autocorrect', 3 * 60 * 60 * 1000 * multTemps)) return appliquerBonusMiracle(member, auteurNom, 'l\'**Autocorrect maudit**');
            return `📱 **${auteurNom}** subit l'**Autocorrect maudit** pendant **${3 * multTemps}h** : des phrases absurdes vont s'incruster dans ses messages (1 fois sur 2) !${multTemps > 1 ? ' *(Durée x2 appliquée !)*' : ''}`;
        case 'malus-looong-cooldown': {
            annulerTiragesAGogo(member.id);
            const divActif = (rouletteDiviseurUntil.get(member.id) || 0) > Date.now() && !estHappyHour();
            const dureeMs = divActif ? 30 * 60 * 1000 : 60 * 60 * 1000;
            rouletteCooldowns.set(member.id, Date.now() + dureeMs);
            if (divActif) {
                return `⏳ **${auteurNom}** subit le malus **Looong cooldown** (1h)... mais son **Diviseur** le divise par 2 : **30 minutes** de cooldown malgré le malus !`;
            }
            return `⏳ **${auteurNom}** subit le malus **Looong cooldown** : son prochain tirage a un cooldown de **1 heure** (60 minutes) !`;
        }
        case 'malus-cooldown-45': {
            if ((rouletteCooldown45Charges.get(member.id) || 0) > 0) deverrouillerSucces(member.id, 'double-peine', message.channel);
            annulerTiragesAGogo(member.id);
            const divActif = (rouletteDiviseurUntil.get(member.id) || 0) > Date.now() && !estHappyHour();
            const dureeMs = divActif ? Math.round(22.5 * 60 * 1000) : 45 * 60 * 1000;
            rouletteCooldowns.set(member.id, Date.now() + dureeMs);
            rouletteCooldown45Charges.set(member.id, 1);
            if (divActif) {
                return `⏳ **${auteurNom}** aura un cooldown de **45 minutes** sur ses **2 prochains tirages** — divisé par 2 grâce à son **Diviseur** (**22 min 30s** malgré le malus) !`;
            }
            return `⏳ **${auteurNom}** aura un cooldown de **45 minutes** sur ses **2 prochains tirages** !`;
        }
        case 'bonus-cooldown-court': {
            const nowCourt = Date.now();
            const divActif = (rouletteDiviseurUntil.get(member.id) || 0) > nowCourt && !estHappyHour();
            const cdCourtMs = divActif ? 150 * 1000 : 5 * 60 * 1000;
            const finActuel = rouletteCooldowns.get(member.id);
            const chargesActuelles = rouletteCooldownCourtCharges.get(member.id) || 0;
            if (finActuel && finActuel > nowCourt + cdCourtMs) {
                rouletteCooldowns.set(member.id, nowCourt + cdCourtMs);
                rouletteCooldownCourtCharges.set(member.id, chargesActuelles + 2);
            } else {
                rouletteCooldownCourtCharges.set(member.id, chargesActuelles + 3);
            }
            return `⚡ **${auteurNom}** aura un cooldown de **5 minutes** sur ses **3 prochains tirages** !`;
        }
        case 'bonus-bouclier': {
            const actuelles = rouletteBouclierActif.get(member.id) || 0;
            const total = actuelles + 1;
            rouletteBouclierActif.set(member.id, total);
            if (total >= 10) deverrouillerSucces(member.id, 'forteresse', message.channel);
            return `🛡️ **${auteurNom}** gagne **1 charge de bouclier** (${total} en réserve) : son prochain malus sera annulé !`;
        }
        case 'bonus-redirect-choix':
            crediterInventaireRoulette(member.id, 'redirectChoix', 1);
            return `🎯 **${auteurNom}** a gagné une **Redirection de malus au choix** !\n-# 🎒 *Stocké dans ton inventaire (\`!rlt claim\` pour l'utiliser quand tu veux sans limite de temps).*`;
        case 'bonus-pseudo-choix':
            crediterInventaireRoulette(member.id, 'pseudoChoix', 1);
            return `✍️ **${auteurNom}** a gagné le droit de **verrouiller le pseudo d'un·e membre pendant 48h** !\n-# 🎒 *Stocké dans ton inventaire (\`!rlt claim\` pour l'utiliser quand tu veux).*`;
        case 'bonus-epingle':
            crediterInventaireRoulette(member.id, 'epingleSalon', 1);
            return `📌 **${auteurNom}** a gagné le droit d'**épingler un message** dans ce salon !\n-# 🎒 *Stocké dans ton inventaire (\`!rlt claim\` pour l'utiliser quand tu veux).*`;
        case 'bonus-tcg-15pts':
            bridge.addTcgPoints?.(member.id, 15, member);
            return `🪙 **${auteurNom}** remporte **+15 points RegaDex** ! *(Ajoutés immédiatement à ton solde)*`;
        case 'bonus-tcg-50pts':
            bridge.addTcgPoints?.(member.id, 50, member);
            return `💰 **${auteurNom}** remporte **+50 points RegaDex** ! *(Ajoutés immédiatement à ton solde)*`;
        case 'bonus-tcg-1booster':
            bridge.addTcgBoosters?.(member.id, 1, member);
            return `🃏 **${auteurNom}** remporte **+1 Booster RegaDex** ! *(Prêt à ouvrir dans <#1572007962199851059>)*`;
        case 'bonus-tcg-5boosters':
            bridge.addTcgBoosters?.(member.id, 5, member);
            return `🎁 **${auteurNom}** décroche **+5 Boosters RegaDex** ! *(Prêts à ouvrir dans <#1572007962199851059>)*`;
        case 'bonus-booster-consolation': {
            const resRed = bridge.reduceTcgBoosterCooldown?.(member.id, 3 * 60 * 60 * 1000, member);
            if (resRed?.alreadyFull) {
                return `🔋 **${auteurNom}** obtient le **Booster de consolation RegaDex** !\n-# 🃏 *Ton stock gratuit RegaDex est déjà plein (${resRed.freeBoosters}/${resRed.maxFree}) : ouvre-en un dans <#1572007962199851059> !*`;
            }
            if (resRed?.applied && resRed.grantedFree) {
                return `🔋 **${auteurNom}** obtient le **Booster de consolation RegaDex** : **-3h** sur le cooldown !\n-# 🎉 *Un booster gratuit vient d'être immédiatement débloqué (${resRed.freeBoosters}/${resRed.maxFree}) dans <#1572007962199851059> !*`;
            }
            if (resRed?.applied && resRed.nextAt) {
                return `🔋 **${auteurNom}** obtient le **Booster de consolation RegaDex** : le cooldown de son prochain booster gratuit est réduit de **3h** (prêt <t:${Math.floor(resRed.nextAt / 1000)}:R>) !`;
            }
            return `🔋 **${auteurNom}** obtient le **Booster de consolation RegaDex** (-3h sur le cooldown RegaDex) !`;
        }
        case 'special-vote-immunite-exclusion':
            // Annulation absolue pour la fondatrice (Epsys)
            if (member.id === bridge.EPSYS_ID || member.id === '436218312574107658') {
                return `👑 **Immunité Fondatrice !** Pas de vote public sur **${auteurNom}** : le vote d'exclusion est **immédiatement annulé par décret impérial** ! 😌 Le peuple s'incline.`;
            }
            message.vote = member;
            return `🗳️ **${auteurNom}** déclenche un **vote public** !`;
        case 'malus-prime': {
            deverrouillerSucces(member.id, 'malus-prime', message.channel);
            const fin6h = Date.now() + 6 * 60 * 60 * 1000;
            const lettreAlea = String.fromCharCode(65 + Math.floor(Math.random() * 26));
            rouletteLettreInterdite.set(member.id, { until: fin6h, lettre: lettreAlea });
            rouletteUwuUntil.set(member.id, fin6h);
            rouletteEmojiUntil.set(member.id, fin6h);
            rouletteLeetUntil.set(member.id, fin6h);
            rouletteEchoUntil.set(member.id, fin6h);
            activerTransfo(member.id, 'caps', 2 * 60 * 60 * 1000);
            activerTransfo(member.id, 'mots', 2 * 60 * 60 * 1000);
            activerTransfo(member.id, 'lettres', 60 * 60 * 1000);
            activerTransfo(member.id, 'bebe', 2 * 60 * 60 * 1000);
            activerTransfo(member.id, 'boomer', 2 * 60 * 60 * 1000);
            activerTransfo(member.id, 'censure', 2 * 60 * 60 * 1000);

            // Verrouillage d'un pseudo horrible pendant 24h
            const pseudo = ROULETTE_NOMS_PSEUDO_LOCK[Math.floor(Math.random() * ROULETTE_NOMS_PSEUDO_LOCK.length)];
            const lockExistant = roulettePseudoLock.get(member.id);
            const originalNickname = lockExistant?.originalNickname !== undefined ? lockExistant.originalNickname : (member.nickname ?? null);
            roulettePseudoLock.set(member.id, { until: Date.now() + 24 * 60 * 60 * 1000, pseudo, originalNickname });
            await member.setNickname(pseudo).catch(() => {});

            return `☠️☠️☠️ **${auteurNom}** subit le **MALUS PRIME** : TOUS les malus de texte et un pseudo horrible verrouillés en même temps !`;
        }
        case 'aucun-resultat':
            return ROULETTE_FAILS[failIndex];
        default:
            return `⚠️ Ce résultat n'est pas encore codé.`;
    }
}

function crediterInventaireRoulette(userId, itemKey, quantite = 1) {
    const inv = rouletteInventaire.get(userId) ?? {};
    inv[itemKey] = (inv[itemKey] || 0) + quantite;
    rouletteInventaire.set(userId, inv);
    bridge.demanderSauvegarde();
}

function consommerInventaireRoulette(userId, itemKey) {
    const inv = rouletteInventaire.get(userId) ?? {};
    if (!inv[itemKey] || inv[itemKey] <= 0) return false;
    inv[itemKey]--;
    if (inv[itemKey] <= 0) delete inv[itemKey];
    if (Object.keys(inv).length === 0) rouletteInventaire.delete(userId);
    else rouletteInventaire.set(userId, inv);
    bridge.demanderSauvegarde();
    return true;
}

const ROULETTE_ITEMS_METADATA = {
    bouclier_1: {
        label: '🛡️ 1 Charge de Bouclier',
        emoji: '🛡️',
        desc: 'Ajoute 1 bouclier de protection contre le prochain malus'
    },
    bouclier_5: {
        label: '🔰 Pack Défense (5 Boucliers)',
        emoji: '🔰',
        desc: 'Ajoute 5 boucliers de protection contre les malus'
    },
    freeRoll1Min: {
        label: '🎰 Tirage à volonté (1 min)',
        emoji: '🎰',
        desc: '1 minute sans cooldown et immunisé aux mutes'
    },
    ticketSkip: {
        label: '🎟️ Ticket Coupe-File',
        emoji: '🎟️',
        desc: 'Réinitialise immédiatement ton cooldown de roulette'
    },
    trefle20: {
        label: '🍀 Trèfle de Chance (+20%)',
        emoji: '🍀',
        desc: '+20% de bonus jackpot sur tes 2 prochains tirages'
    },
    eponge: {
        label: '🧹 Éponge à Malus',
        emoji: '🧹',
        desc: 'Nettoie et annule tous tes malus textuels actifs'
    },
    miniHH: {
        label: '⚡ Pass Mini Happy-Hour',
        emoji: '⚡',
        desc: 'Tes 2 prochains tirages ont un cooldown réduit à 5 minutes'
    },
    pityBoost: {
        label: '📈 Coup de Pouce Pity',
        emoji: '📈',
        desc: 'Ajoute +1 malus et +1 nul pour rapprocher du bonus garanti'
    },
    coupTriple: {
        label: '🎰 Coup Triple',
        emoji: '🎰',
        desc: '3 tirages consécutifs sans aucun cooldown'
    },
    superBouclier: {
        label: '🔰 Super Bouclier',
        emoji: '🔰',
        desc: 'Ajoute +3 charges de bouclier de protection'
    },
    redirectChoix5: {
        label: '🎯 5 Redirections au choix',
        emoji: '🎯',
        desc: 'Ajoute 5 redirections ciblées en réserve'
    },
    redirectChoix: {
        label: '🎯 Redirection de malus au choix',
        emoji: '🎯',
        desc: 'Choisis le membre qui subira ton prochain malus à ta place'
    },
    redirectBonusChoix: {
        label: '🎀 Redirection de bonus au choix',
        emoji: '🎀',
        desc: 'Choisis le/la membre qui recevra ton prochain bonus à ta place'
    },
    partageBonus: {
        label: '🤝 Partage de bonus au choix',
        emoji: '🤝',
        desc: 'Partage ton prochain bonus avec le membre de ton choix (vous en profitez tous les deux)'
    },
    pseudoChoix: {
        label: '✍️ Pseudo au choix (48h)',
        emoji: '✍️',
        desc: 'Verrouille le pseudo du membre de ton choix pendant 48h'
    },
    pseudoLockSemaine: {
        label: '✍️ Gravé dans la roche',
        emoji: '✍️',
        desc: 'Verrouille le pseudo d\'un membre pendant 1 semaine'
    },
    echangeurPoison: {
        label: '🧪 Échangeur de poison',
        emoji: '🧪',
        desc: 'Transfère un de tes malus actifs vers le membre de ton choix'
    },
    diviseur: {
        label: '➗ Diviseur de cooldown (2h)',
        emoji: '➗',
        desc: 'Divise par 2 tous tes cooldowns pendant 2h (hors Happy Hour, même sous malus)'
    },
    epingleSalon: {
        label: '📌 Message épinglé',
        emoji: '📌',
        desc: 'Épingle définitivement un de tes messages dans le salon'
    },
    palierUltime: {
        label: '🏆 Pack Palier Ultime',
        emoji: '🏆',
        desc: 'Déballe : 1 Tirage à volonté (1min) + 1 Épingle + 3 Redirections'
    }
};

function buildInventaireEmbed(membre) {
    const inv = rouletteInventaire.get(membre.id) ?? {};
    const items = [];
    const options = [];

    for (const [key, qte] of Object.entries(inv)) {
        if (qte > 0 && ROULETTE_ITEMS_METADATA[key]) {
            const meta = ROULETTE_ITEMS_METADATA[key];
            items.push(`${meta.emoji} **${meta.label}** : x${qte}\n> *${meta.desc}*`);
            options.push({
                label: `${meta.label} (x${qte})`.slice(0, 100),
                description: meta.desc.slice(0, 100),
                value: key
            });
        }
    }

    const userId = membre.id;
    const pity = roulettePity.get(userId) ?? { malus: 0, nuls: 0 };
    const rawBoucliers = rouletteBouclierActif.get(userId);
    const boucliers = typeof rawBoucliers === 'number' ? rawBoucliers : (rawBoucliers ? 1 : 0);

    const boostJackpot = rouletteJackpotBonus.get(userId) || 0;
    const boostCharges = rouletteJackpotBoostCharges.get(userId) || 0;
    const boostValeur = boostCharges > 0
        ? (rouletteJackpotBoostValue.get(userId) || 0)
        : 0;
    const boostTotal = Math.round((boostJackpot + boostValeur) * 100);

    const finCooldown = rouletteCooldowns.get(userId) || 0;
    const maintenant = Date.now();
    const cooldownTexte = ROULETTE_COOLDOWN_EXEMPT.includes(userId)
        ? '⚡ Exempté'
        : (rouletteFreeRollUntil.get(userId) || 0) > maintenant
            ? '⚡ Tirage à volonté'
            : (rouletteCoupTripleCharges.get(userId) || 0) > 0
                ? '🎰 Coup Triple actif'
                : finCooldown > maintenant
                    ? `<t:${Math.ceil(finCooldown / 1000)}:R>`
                    : '✅ Prêt à tourner';

    const avatarInv = membre?.displayAvatarURL?.({ dynamic: true }) || membre?.user?.displayAvatarURL?.({ dynamic: true }) || undefined;
    const embed = new EmbedBuilder()
        .setColor(0xffd20a)
        .setAuthor({ name: `${membre.displayName} • Inventaire Roulette`, iconURL: avatarInv })
        .setTitle(`🎒 Inventaire de récompenses`)
        .setDescription(
            items.length > 0
                ? items.join('\n\n') + "\n\n*Choisis la récompense à activer dans le menu déroulant ci-dessous :*"
                : "*Ton inventaire est vide pour le moment.*"
        )
        .addFields({
            name: '📊 Statistiques de roulette',
            value:
                `🍀 **Pity malus :** ${pity.malus}/${ROULETTE_PITY_MALUS}\n` +
                `🍀 **Pity nuls :** ${pity.nuls}/${ROULETTE_PITY_NULS}\n` +
                `📈 **Boost bonus :** +${boostTotal}%` +
                (boostCharges > 0 ? ` (${boostCharges} tirage(s) boosté(s))` : '') + '\n' +
                `⏳ **Cooldown :** ${cooldownTexte}\n` +
                `🛡️ **Boucliers :** ${boucliers} charge(s)`
        });

    let row = null;
    if (options.length > 0) {
        const menu = new StringSelectMenuBuilder()
            .setCustomId(`rlt_claim_menu_${membre.id}`)
            .setPlaceholder('Sélectionne une récompense à activer...')
            .addOptions(options.slice(0, 25));
        row = new ActionRowBuilder().addComponents(menu);
    }

    return { embed, row };
}

function buildRouletteInventairePayload(membre, ownerId = membre.id, { home = true, close = true } = {}) {
    const { embed, row } = buildInventaireEmbed(membre);
    const components = [];
    if (row) components.push(row);
    const navRow = new ActionRowBuilder();
    if (home) navRow.addComponents(buildRouletteAccueilButton(ownerId));
    if (close) navRow.addComponents(buildRouletteCloseButton(ownerId));
    if (navRow.components.length > 0) components.push(navRow);
    return { embeds: [embed], components };
}

const rouletteVoteCanvasPending = new Map(); // msgId -> { timer, dirty, client, guild }

function buildVoteProgressBar(pourCount = 0, contreCount = 0, len = 10) {
    const total = pourCount + contreCount;
    if (total <= 0) return '⬜'.repeat(len);
    const greenBlocks = Math.round((pourCount / total) * len);
    const redBlocks = Math.max(0, len - greenBlocks);
    return '🟩'.repeat(greenBlocks) + '🟥'.repeat(redBlocks);
}

function buildVoteRouletteEmbed(membre, pourCount = 0, contreCount = 0, expireAt = null, isTest = false) {
    const total = pourCount + contreCount;
    const pctPour = total > 0 ? Math.round((pourCount / total) * 100) : 0;
    const pctContre = total > 0 ? (100 - pctPour) : 0;
    const bar = buildVoteProgressBar(pourCount, contreCount, 10);
    const expSec = Math.ceil((expireAt || (Date.now() + 2 * 60 * 60 * 1000)) / 1000);
    const nom = membre?.displayName || membre?.user?.username || 'Membre';
    const avatarUrl = membre?.displayAvatarURL?.({ dynamic: true }) || membre?.user?.displayAvatarURL?.({ dynamic: true }) || undefined;

    return new EmbedBuilder()
        .setColor(0xffd20a)
        .setAuthor({ name: `${nom} • Tribunal de la Roulette`, iconURL: avatarUrl })
        .setTitle(`${isTest ? '🧪 [TEST] ' : ''}🗳️ VOTE PUBLIC ! (${libelleProbaRoulette('special-vote-immunite-exclusion')})`)
        .setDescription(
            `Que mérite <@${membre.id}> ?\n\n` +
            `✅ **Victoire :** Redirection de ses **3 prochains malus au choix** vers qui iel veut !\n` +
            `❌ **Défaite :** Exclusion pendant **1 jour**\n\n` +
            `📊 **Tendance en direct :**\n` +
            `${bar}\n` +
            `✅ **${pourCount} Pour (${pctPour}%)**  •  ❌ **${contreCount} Contre (${pctContre}%)**\n\n` +
            `⏳ Clôture du vote **<t:${expSec}:R>** *(à <t:${expSec}:T>)*\n` +
            `-# *(L'accusé.e n'a pas le droit de voter sur son propre sort — Canvas actualisé toutes les 10s en cas de vote)*`
        )
        .setImage('attachment://rlt_vote.jpg');
}

async function renderRouletteVoteCanvas(membre, pourCount = 0, contreCount = 0, expireAt = null, isTest = false) {
    const W = 1200, H = 560;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    await drawRouletteBg(ctx, W, H, 0.45);

    const total = pourCount + contreCount;
    const ratioPour = total > 0 ? pourCount / total : 0;
    const ratioContre = total > 0 ? contreCount / total : 0;

    // Header
    drawGlassPanel(ctx, 36, 24, W - 72, 76, 18, 'rgba(12, 15, 26, 0.86)', '#FFD20A', 2);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFD20A';
    ctx.font = 'bold 26px "LemonMilk", "Sans"';
    ctx.fillText(`${isTest ? '[TEST] ' : ''}TRIBUNAL DE LA ROULETTE • VOTE PUBLIC`, W / 2, 62, W - 120);

    // Barre verte verticale à gauche (POUR)
    const barW = 140, barMaxH = 310, barBottomY = 486;
    const leftX = 95;
    drawGlassPanel(ctx, leftX - 18, 126, barW + 36, 404, 20, 'rgba(10, 26, 16, 0.80)', 'rgba(46, 204, 113, 0.65)', 2);
    ctx.fillStyle = '#2ECC71';
    ctx.font = 'bold 22px "LemonMilk", "Sans"';
    ctx.fillText('POUR', leftX + barW / 2, 156);

    drawGlassPanel(ctx, leftX, barBottomY - barMaxH, barW, barMaxH, 14, 'rgba(255, 255, 255, 0.08)', 'rgba(46, 204, 113, 0.35)', 1.5);
    const hPour = Math.max(total > 0 && pourCount === 0 ? 12 : 34, Math.round(barMaxH * ratioPour));
    if (pourCount > 0) {
        drawRoundRect(ctx, leftX + 4, barBottomY - hPour + 4, barW - 8, Math.max(18, hPour - 8), 10);
        ctx.fillStyle = '#2ECC71';
        ctx.fill();
    }
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 40px "LemonMilk", "Sans"';
    ctx.fillText(`${pourCount}`, leftX + barW / 2, 508);

    // Barre rouge verticale à droite (CONTRE)
    const rightX = W - 95 - barW;
    drawGlassPanel(ctx, rightX - 18, 126, barW + 36, 404, 20, 'rgba(30, 10, 14, 0.80)', 'rgba(255, 92, 92, 0.65)', 2);
    ctx.fillStyle = '#FF5C5C';
    ctx.font = 'bold 22px "LemonMilk", "Sans"';
    ctx.fillText('CONTRE', rightX + barW / 2, 156);

    drawGlassPanel(ctx, rightX, barBottomY - barMaxH, barW, barMaxH, 14, 'rgba(255, 255, 255, 0.08)', 'rgba(255, 92, 92, 0.35)', 1.5);
    const hContre = Math.max(total > 0 && contreCount === 0 ? 12 : 34, Math.round(barMaxH * ratioContre));
    if (contreCount > 0) {
        drawRoundRect(ctx, rightX + 4, barBottomY - hContre + 4, barW - 8, Math.max(18, hContre - 8), 10);
        ctx.fillStyle = '#FF5C5C';
        ctx.fill();
    }
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 40px "LemonMilk", "Sans"';
    ctx.fillText(`${contreCount}`, rightX + barW / 2, 508);

    // Carte centrale Accusé.e
    drawGlassPanel(ctx, 320, 126, W - 640, 404, 24, 'rgba(12, 15, 26, 0.84)', 'rgba(255, 210, 10, 0.5)', 2);
    await drawCircularAvatar(ctx, membre, W / 2, 258, 86, '#FFD20A', 'rgba(255, 210, 10, 0.45)');

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 34px "LemonMilk", "Sans"';
    ctx.fillText(formatRouletteDisplayName(membre), W / 2, 384, W - 680);

    const pctPour = total > 0 ? Math.round(ratioPour * 100) : 50;
    const pctContre = total > 0 ? (100 - pctPour) : 50;
    ctx.fillStyle = total > 0 ? (pourCount >= contreCount ? '#2ECC71' : '#FF5C5C') : 'rgba(255,255,255,0.68)';
    ctx.font = 'bold 20px "LemonMilk", "Sans"';
    ctx.fillText(
        total > 0 ? `${pctPour}% POUR  •  ${pctContre}% CONTRE` : 'EN ATTENTE DES PREMIERS VOTES',
        W / 2,
        436,
        W - 680
    );

    const restant = expireAt ? Math.max(0, expireAt - Date.now()) : 2 * 60 * 60 * 1000;
    ctx.fillStyle = 'rgba(255, 210, 10, 0.85)';
    ctx.font = 'bold 17px "LemonMilk", "Sans"';
    ctx.fillText(`TEMPS RESTANT : ${formatDureeCourte(restant)}`, W / 2, 488, W - 680);

    return canvas.toBuffer('image/jpeg', { quality: 0.90 });
}

function planifierMajCanvasVoteRoulette(msgId, voteData, client, guild) {
    if (!msgId || !voteData || voteData.cloture) return;
    const existing = rouletteVoteCanvasPending.get(msgId);
    if (existing) {
        existing.dirty = true;
        return;
    }

    const entry = { dirty: true, client, guild, timer: null };
    entry.timer = setTimeout(async () => {
        rouletteVoteCanvasPending.delete(msgId);
        const latest = rouletteVotesPublics.get(msgId);
        if (!latest || latest.cloture) return;
        try {
            const ch = client?.channels.cache.get(latest.channelId)
                || await client?.channels.fetch(latest.channelId).catch(() => null);
            const msg = ch ? await ch.messages.fetch(msgId).catch(() => null) : null;
            if (!msg) return;

            const g = ch.guild || guild || (latest.guildId ? client?.guilds.cache.get(latest.guildId) : null) || client?.guilds.cache.first();
            const membre = g
                ? (g.members.cache.get(latest.targetId) || await g.members.fetch(latest.targetId).catch(() => null))
                : { id: latest.targetId, displayName: 'Membre' };

            const pourList = (Array.isArray(latest.pour) ? latest.pour : []).filter(id => latest.isTest || id !== latest.targetId);
            const contreList = (Array.isArray(latest.contre) ? latest.contre : []).filter(id => latest.isTest || id !== latest.targetId);

            const buf = await renderRouletteVoteCanvas(membre, pourList.length, contreList.length, latest.expireAt, Boolean(latest.isTest));
            const att = new AttachmentBuilder(buf, { name: 'rlt_vote.jpg' });
            const embedMaj = buildVoteRouletteEmbed(membre, pourList.length, contreList.length, latest.expireAt, Boolean(latest.isTest));

            await msg.edit({
                embeds: [embedMaj],
                components: [buildVoteRouletteRow(pourList.length, contreList.length, false)],
                files: [att],
                attachments: []
            }).catch(() => {});
        } catch {}
    }, 10000);

    rouletteVoteCanvasPending.set(msgId, entry);
}

function buildVoteRouletteRow(pourCount = 0, contreCount = 0, disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('rlt_vote_pour')
            .setLabel(`Pour (${pourCount})`)
            .setEmoji('✅')
            .setStyle(ButtonStyle.Success)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId('rlt_vote_contre')
            .setLabel(`Contre (${contreCount})`)
            .setEmoji('❌')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(disabled)
    );
}

async function cloturerVoteRoulette(timerEntry, client) {
    const msgId = timerEntry.currentMsgId;
    if (timerEntry.interval) clearInterval(timerEntry.interval);
    rouletteVoteTimers.delete(msgId);
    const pendingCanvas = rouletteVoteCanvasPending.get(msgId);
    if (pendingCanvas?.timer) {
        clearTimeout(pendingCanvas.timer);
        rouletteVoteCanvasPending.delete(msgId);
    }

    const voteData = rouletteVotesPublics.get(msgId);
    if (!voteData || voteData.cloture) return;
    voteData.cloture = true;
    rouletteVotesPublics.set(msgId, voteData);

    client?.activeVotes?.delete(msgId);

    try {
        const channel = client?.channels.cache.get(voteData.channelId)
            || await client?.channels.fetch(voteData.channelId).catch(() => null);
        const guild = channel?.guild
            || (voteData.guildId ? client?.guilds.cache.get(voteData.guildId) : null)
            || client?.guilds.cache.first();

        const targetMsg = channel ? await channel.messages.fetch(msgId).catch(() => null) : null;
        const votantsValidesOui = (Array.isArray(voteData.pour) ? voteData.pour : []).filter(id => voteData.isTest || id !== voteData.targetId);
        const votantsValidesNon = (Array.isArray(voteData.contre) ? voteData.contre : []).filter(id => voteData.isTest || id !== voteData.targetId);
        const tousLesVotants = [...new Set([...votantsValidesOui, ...votantsValidesNon])];
        const oui = votantsValidesOui.length;
        const non = votantsValidesNon.length;

        const membre = guild
            ? (guild.members.cache.get(voteData.targetId) || await guild.members.fetch(voteData.targetId).catch(() => null))
            : null;

        if (targetMsg) {
            const membreRender = membre || { id: voteData.targetId, displayName: 'Membre' };
            const bufFin = await renderRouletteVoteCanvas(membreRender, oui, non, Date.now(), Boolean(voteData.isTest)).catch(() => null);
            const editPayload = {
                embeds: [buildVoteRouletteEmbed(membreRender, oui, non, Date.now(), Boolean(voteData.isTest))],
                components: [buildVoteRouletteRow(oui, non, true)]
            };
            if (bufFin) {
                editPayload.files = [new AttachmentBuilder(bufFin, { name: 'rlt_vote.jpg' })];
                editPayload.attachments = [];
            }
            await targetMsg.edit(editPayload).catch(() => {});
        }

        if (voteData.isTest) {
            rouletteVotesPublics.delete(msgId);
            return;
        }

        const salonRoulette = guild?.channels.cache.get(ROULETTE_SALON_ID) || channel;
        if (!salonRoulette) {
            bridge.demanderSauvegarde();
            return;
        }

        const ciblesNon = votantsValidesNon.length > 0 ? votantsValidesNon.map(id => `<@${id}>`).join(', ') : '*Aucun*';
        const ciblesOui = votantsValidesOui.length > 0 ? votantsValidesOui.map(id => `<@${id}>`).join(', ') : '*Aucun*';
        const avatarVictime = membre?.displayAvatarURL?.({ dynamic: true }) || undefined;
        const nomVictime = membre?.displayName || 'Membre';

        if (oui >= non) {
            const chargesActuelles = rouletteVoteRedirectCharges.get(voteData.targetId) || 0;
            rouletteVoteRedirectCharges.set(voteData.targetId, chargesActuelles + 3);
            rouletteVoteVotants.set(voteData.targetId, {
                oui: votantsValidesOui,
                non: votantsValidesNon,
                tous: [...tousLesVotants]
            });
            deverrouillerSucces(voteData.targetId, 'innocente', salonRoulette);

            const doveGif = getRouletteGifAsset('Dove.gif', 'rlt_dove.gif');
            const embedVictoire = new EmbedBuilder()
                .setColor(0x00bf19)
                .setAuthor({ name: `${nomVictime} • Jugement Populaire`, iconURL: avatarVictime })
                .setTitle(`🕊️ JUGEMENT POPULAIRE : INNOCENTÉ.E !`)
                .setDescription(
                    `La plèbe a parlé avec sagesse (${oui} pour vs ${non} contre) !\n\n` +
                    `🎉 <@${voteData.targetId}>, tu es acquitté.e et tu remportes **3 Redirections de malus au choix** !\n\n` +
                    `🎯 **Comment les utiliser ?**\n` +
                    `Lors de tes 3 prochains malus roulette, un **menu déroulant** s'affichera directement sous le tirage pour envoyer le malus à la personne de ton choix.\n\n` +
                    `😈 **Suggestions de cibles parmi les votant.es :**\n` +
                    `> ❌ **Celleux qui voulaient ta peau :** ${ciblesNon === '*Aucun*' ? '*Aucun (personne n\'a voté contre toi !)*' : ciblesNon}\n` +
                    `> ✅ **Celleux qui t'ont soutenu.e :** ${ciblesOui}\n\n` +
                    `*À toi de choisir si tu veux te venger ou tester la loyauté de ton entourage...*`
                );
            if (doveGif) embedVictoire.setThumbnail('attachment://rlt_dove.gif');

            await salonRoulette.send({
                content: `🔔 <@${voteData.targetId}>, le vote est terminé ! Tu as triomphé !`,
                embeds: [embedVictoire],
                files: doveGif ? [doveGif] : [],
                flags: [MessageFlags.SuppressNotifications]
            }).catch(() => {});
        } else {
            deverrouillerSucces(voteData.targetId, 'condamne-plebe', salonRoulette);
            const estModoCible = Boolean(membre && bridge.estModo(membre));
            let sanctionTexte;
            if (estModoCible) {
                rouletteCooldowns.set(voteData.targetId, Date.now() + 24 * 60 * 60 * 1000);
                sanctionTexte = `🛡️ <@${voteData.targetId}> est Modo : l'exclusion de **1 jour** est convertie en cooldown roulette de **24 heures**.`;
            } else {
                if (membre) await membre.timeout(24 * 60 * 60 * 1000, 'Roulette - vote').catch(() => {});
                rouletteTimeoutUntil.set(voteData.targetId, Date.now() + 24 * 60 * 60 * 1000);
                sanctionTexte = `🔇 <@${voteData.targetId}> est condamné.e et **exclu.e pendant 1 jour** !`;
            }

            const muteGif = getRouletteGifAsset('Mute.gif', 'rlt_mute.gif');
            const embedDefaite = new EmbedBuilder()
                .setColor(0x9e0000)
                .setAuthor({ name: `${nomVictime} • Jugement Populaire`, iconURL: avatarVictime })
                .setTitle(`⚖️ JUGEMENT POPULAIRE : CONDAMNÉ.E !`)
                .setDescription(
                    `La plèbe a rendu son verdict sans pitié (**${non} contre** vs **${oui} pour**) !\n\n` +
                    `${sanctionTexte}\n\n` +
                    `📜 **Détail des votes :**\n` +
                    `> ❌ **Celleux qui ont voté contre :** ${ciblesNon}\n` +
                    `> ✅ **Celleux qui ont tenté de te sauver :** ${ciblesOui}`
                );
            if (muteGif) embedDefaite.setThumbnail('attachment://rlt_mute.gif');

            await salonRoulette.send({
                content: `💀 <@${voteData.targetId}>, la sentence est tombée...`,
                embeds: [embedDefaite],
                files: muteGif ? [muteGif] : [],
                flags: [MessageFlags.SuppressNotifications]
            }).catch(() => {});
        }
        bridge.demanderSauvegarde();
    } catch (e) {
        console.error('Erreur lors de la conclusion du vote roulette :', e);
        const salonSecours = client?.channels.cache.get(ROULETTE_SALON_ID) || client?.channels.cache.get(voteData.channelId);
        await salonSecours?.send(`⚠️ Une erreur est survenue lors du dépouillement du vote pour <@${voteData.targetId}>.`).catch(() => {});
    }
}

function armerTimersVoteRoulette(msgId, voteData, client) {
    const restantMs = Math.max(1000, voteData.expireAt - Date.now());
    const timerEntry = { currentMsgId: msgId, interval: null, timeout: null };

    if (!voteData.isTest) {
        timerEntry.interval = setInterval(async () => {
            const currentId = timerEntry.currentMsgId;
            const ch = client?.channels.cache.get(voteData.channelId)
                || await client?.channels.fetch(voteData.channelId).catch(() => null);
            const currentMsg = ch ? await ch.messages.fetch(currentId).catch(() => null) : null;
            if (currentMsg) await currentMsg.reply('🆙').catch(() => {});
        }, 55 * 60 * 1000);
    }

    timerEntry.timeout = setTimeout(() => {
        cloturerVoteRoulette(timerEntry, client);
    }, restantMs);

    rouletteVoteTimers.set(msgId, timerEntry);
}

function migrateVoteRouletteMessage(oldMsgId, newMsgId) {
    const voteData = rouletteVotesPublics.get(oldMsgId);
    if (voteData) {
        rouletteVotesPublics.delete(oldMsgId);
        voteData.msgId = newMsgId;
        rouletteVotesPublics.set(newMsgId, voteData);
    }

    const timerEntry = rouletteVoteTimers.get(oldMsgId);
    if (timerEntry) {
        rouletteVoteTimers.delete(oldMsgId);
        timerEntry.currentMsgId = newMsgId;
        rouletteVoteTimers.set(newMsgId, timerEntry);
    }

    const client = rouletteClient || bridge?.client;
    if (client?.activeVotes?.has(oldMsgId)) {
        const accusedId = client.activeVotes.get(oldMsgId);
        client.activeVotes.delete(oldMsgId);
        client.activeVotes.set(newMsgId, accusedId);
    }

    bridge.demanderSauvegarde();
}

function restaurerVotesRoulette(client) {
    if (!client) return;
    for (const [msgId, voteData] of rouletteVotesPublics.entries()) {
        if (!voteData || voteData.cloture || voteData.isTest) continue;
        if (rouletteVoteTimers.has(msgId)) continue;
        armerTimersVoteRoulette(msgId, voteData, client);
    }
}

async function demarrerVoteRoulette(msg, membre, isTest = false) {
    // Sécurité absolue : jamais de vote réel sur Epsys (sauf commande test explicite)
    if (!isTest && (membre.id === bridge.EPSYS_ID || membre.id === '436218312574107658')) {
        return;
    }

    const expireAt = Date.now() + (isTest ? 5 * 60 * 1000 : 2 * 60 * 60 * 1000);
    const voteData = {
        msgId: msg.id,
        targetId: membre.id,
        channelId: msg.channel.id,
        guildId: msg.guild?.id || null,
        expireAt,
        pour: [],
        contre: [],
        cloture: false,
        isTest
    };

    rouletteVotesPublics.set(msg.id, voteData);
    const buf = await renderRouletteVoteCanvas(membre, 0, 0, expireAt, isTest).catch(() => null);
    const editPayload = {
        embeds: [buildVoteRouletteEmbed(membre, 0, 0, expireAt, isTest)],
        components: [buildVoteRouletteRow(0, 0, false)]
    };
    if (buf) {
        editPayload.files = [new AttachmentBuilder(buf, { name: 'rlt_vote.jpg' })];
        editPayload.attachments = [];
    }
    await msg.edit(editPayload).catch(() => {});
    armerTimersVoteRoulette(msg.id, voteData, msg.client);
    if (!isTest) bridge.demanderSauvegarde();
}

let _cachedRouletteBg = undefined;
async function getRouletteBg() {
    if (_cachedRouletteBg !== undefined) return _cachedRouletteBg;
    const chosenPath = resolveRouletteBgPath();
    if (!chosenPath) {
        _cachedRouletteBg = null;
        return null;
    }
    try {
        _cachedRouletteBg = await loadImage(chosenPath);
    } catch {
        _cachedRouletteBg = null;
    }
    return _cachedRouletteBg;
}

function cleanCanvasText(str) {
    return String(str || '')
        .replace(/<a?:\w+:\d+>/g, '')
        .replace(/<@!?\d+>/g, '@Membre')
        .replace(/\*\*|__|~~|`/g, '')
        .replace(/[\p{Extended_Pictographic}\uFE00-\uFE0F\u200D\u20E3]/gu, '')
        .replace(/[^\u0020-\u007E\u00C0-\u017F\u2018-\u2022\u20AC]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function formatRouletteDisplayName(memberOrName) {
    const raw = typeof memberOrName === 'string'
        ? memberOrName.trim()
        : (memberOrName?.displayName || memberOrName?.user?.username || memberOrName?.username || 'Membre').trim();
    if (/\(\s*OG\b/i.test(raw)) {
        const cleaned = raw.replace(/\s*\([^)]*\bOG\b[^)]*\)/gi, '').trim();
        if (cleaned) {
            return cleanCanvasText(cleaned.split(/\s+/)[0] || cleaned) || 'Membre';
        }
        const noParens = raw.replace(/[()]/g, '').trim();
        return cleanCanvasText(noParens.split(/\s+/)[0] || 'Membre') || 'Membre';
    }
    return cleanCanvasText(raw) || 'Membre';
}

function drawFivePointStar(ctx, cx, cy, outerR, innerR, fillStyle = '#FFD20A', glowCol = '#FFD20A') {
    ctx.save();
    if (glowCol) {
        ctx.shadowColor = glowCol;
        ctx.shadowBlur = 16;
    }
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const angle = (-Math.PI / 2) + (i * Math.PI / 5);
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = fillStyle;
    ctx.fill();
    ctx.restore();
}

function drawShameEmblem(ctx, cx, cy, r, color = '#E03131') {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r * 0.96, cy + r * 0.80);
    ctx.lineTo(cx - r * 0.96, cy + r * 0.80);
    ctx.closePath();
    ctx.fillStyle = 'rgba(224, 49, 49, 0.28)';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${Math.round(r * 1.1)}px "LemonMilk", "Sans"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', cx, cy + r * 0.24);
    ctx.restore();
}

function formatDureeCourte(ms) {
    if (ms <= 0) return '0s';
    const totalSec = Math.ceil(ms / 1000);
    const jours = Math.floor(totalSec / 86400);
    const heures = Math.floor((totalSec % 86400) / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (jours > 0) return heures > 0 ? `${jours}j ${heures}h` : `${jours}j`;
    if (heures > 0) return mins > 0 ? `${heures}h ${mins}m` : `${heures}h`;
    if (mins > 0) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    return `${totalSec}s`;
}

function drawRoundRect(ctx, x, y, w, h, r = 16) {
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    ctx.lineTo(x + rad, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
    ctx.lineTo(x, y + rad);
    ctx.quadraticCurveTo(x, y, x + rad, y);
    ctx.closePath();
}

function drawGlassPanel(ctx, x, y, w, h, r = 18, fill = 'rgba(13, 16, 28, 0.78)', stroke = 'rgba(255, 210, 10, 0.32)', lineWidth = 2) {
    ctx.save();
    drawRoundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
    }
    ctx.restore();
}

async function drawRouletteBg(ctx, W = 1600, H = 900, overlayAlpha = 0.42) {
    const bg = await getRouletteBg();
    if (bg) {
        const scale = Math.max(W / bg.width, H / bg.height);
        const dw = bg.width * scale;
        const dh = bg.height * scale;
        ctx.drawImage(bg, (W - dw) / 2, (H - dh) / 2, dw, dh);
        if (overlayAlpha > 0) {
            ctx.fillStyle = `rgba(8, 10, 18, ${overlayAlpha})`;
            ctx.fillRect(0, 0, W, H);
        }
    } else {
        const grad = ctx.createLinearGradient(0, 0, W, H);
        grad.addColorStop(0, '#101322');
        grad.addColorStop(0.5, '#1b1630');
        grad.addColorStop(1, '#0d101c');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
    }
}

async function drawCircularAvatar(ctx, memberOrUrl, cx, cy, radius, ringColor = '#FFD20A', glowColor = null) {
    ctx.save();
    if (glowColor) {
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 42;
    }
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 4, 0, Math.PI * 2);
    ctx.fillStyle = ringColor;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();
    let img = null;
    if (memberOrUrl && typeof memberOrUrl === 'object') {
        img = await loadAvatarProxy(memberOrUrl, 256);
    } else if (typeof memberOrUrl === 'string' && memberOrUrl) {
        try { img = await loadImage(memberOrUrl); } catch {}
    }
    if (img) {
        ctx.drawImage(img, cx - radius, cy - radius, radius * 2, radius * 2);
    } else {
        ctx.fillStyle = '#252940';
        ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    }
    ctx.restore();
}

function buildRouletteBar(val, max, length = 12) {
    const ratio = max > 0 ? Math.max(0, Math.min(1, val / max)) : 0;
    const filled = Math.round(ratio * length);
    return '█'.repeat(filled) + '░'.repeat(Math.max(0, length - filled));
}

function buildRoulettePresentationEmbed(authorId, guildId = null) {
    const cl = rouletteClient || bridge?.client;
    const guild = (guildId ? cl?.guilds?.cache?.get(guildId) : null) || cl?.guilds?.cache?.first();
    const member = authorId ? guild?.members?.cache?.get(authorId) : null;
    const displayName = member?.displayName || 'Joueur';
    const avatarUrl = member?.displayAvatarURL?.({ dynamic: true }) || undefined;

    const jackpot = authorId ? (rouletteJackpotBonus.get(authorId) || 0) : 0;
    const boostCharges = authorId ? (rouletteJackpotBoostCharges.get(authorId) || 0) : 0;
    const boostVal = boostCharges > 0 ? (rouletteJackpotBoostValue.get(authorId) || 0.25) : 0;
    const cEstSonAnniv = (authorId && guildId) ? bridge.estAnniversaireAujourdhui(guildId, authorId) : false;

    const now = Date.now();
    const finCd = authorId ? (rouletteCooldowns.get(authorId) || 0) : 0;
    const enFreeRoll = Boolean(authorId && (rouletteFreeRollUntil.get(authorId) || 0) > now);
    const chargesTriple = authorId ? (rouletteCoupTripleCharges.get(authorId) || 0) : 0;
    const rawB = authorId ? rouletteBouclierActif.get(authorId) : 0;
    const nbBoucliers = typeof rawB === 'number' ? rawB : (rawB ? 1 : 0);
    const pity = (authorId && roulettePity.get(authorId)) || { malus: 0, nuls: 0 };

    const stats = (authorId && rouletteStats.get(authorId)) || { tirages: 0, bonus: 0, malus: 0, rien: 0, plusGrosGain: null, pireSerie: 0 };
    const userAchs = (authorId && rouletteAchievements.get(authorId)) || {};
    const nbAchs = Object.keys(userAchs).filter(id => ROULETTE_ACHIEVEMENTS.some(a => a.id === id)).length;
    const totalAchs = ROULETTE_ACHIEVEMENTS.length;
    const achPct = totalAchs > 0 ? Math.round((nbAchs / totalAchs) * 100) : 0;

    let statutTirage = '• Statut : ✅ **Prêt à tourner !**';
    if (ROULETTE_COOLDOWN_EXEMPT.includes(authorId) || enFreeRoll) {
        statutTirage = '• Statut : ⚡ **Tirage à volonté actif**';
    } else if (chargesTriple > 0) {
        statutTirage = `• Statut : 🎰 **Coup Triple** *(${chargesTriple} gratuit${chargesTriple > 1 ? 's' : ''})*`;
    } else if (finCd > now) {
        statutTirage = `• Prochain tirage : **<t:${Math.ceil(finCd / 1000)}:R>**`;
    }

    const totalBoostPct = Math.round((jackpot + boostVal + (cEstSonAnniv ? 0.50 : 0)) * 100);
    const happyActif = estHappyHour();
    const histList = getRouletteHistorique();
    const historiqueTexte = histList.length > 0
        ? histList.map(h => `• **${h.nom}** ➔ ${h.gain}`).join('\n')
        : '*Aucun tirage récent pour le moment.*';

    const achBar = buildRouletteBar(nbAchs, totalAchs, 14);
    const pityMBar = buildRouletteBar(pity.malus, ROULETTE_PITY_MALUS, 6);
    const pityNBar = buildRouletteBar(pity.nuls, ROULETTE_PITY_NULS, 6);

    const invUser = authorId ? (rouletteInventaire.get(authorId) ?? {}) : {};
    const resumeEtat = authorId ? collectRouletteStateLists({ id: authorId }, guildId) : { bonus: [], malus: [] };

    const statutLines = [
        statutTirage,
        `• Cooldown : **${happyActif ? '5 min (Happy Hour 🔥)' : '15 minutes'}**`
    ];
    if ((invUser.ticketSkip || 0) > 0 || (invUser.freeRoll1Min || 0) > 0) {
        const stockParts = [];
        if (invUser.ticketSkip > 0) stockParts.push(`🎟️ **${invUser.ticketSkip}** Ticket(s) Coupe-File`);
        if (invUser.freeRoll1Min > 0) stockParts.push(`🎰 **${invUser.freeRoll1Min}** Tirage(s) 1 min`);
        statutLines.push('', `• En stock : ${stockParts.join(' • ')} *(\`!rlt claim\`)*`);
    }
    statutLines.push(
        `• Boucliers : **${nbBoucliers}** en réserve`,
        `• Boost bonus : **+${totalBoostPct}%**`
    );
    if (boostCharges > 0) statutLines.push(`• 📈 Jackpot Boost : **+${Math.round(boostVal * 100)}%** *(${boostCharges} tir.)*`);

    const armesList = [];
    if (authorId) {
        const rc = getCiblesListe(rouletteRedirectChoixCible, authorId);
        if (rc.length > 0) armesList.push(`🎯 Malus redirigé vers ${rc.map(id => `<@${id}>`).join(', ')}`);
        const rHas = rouletteRedirectCharges.get(authorId) || 0;
        if (rHas > 0) armesList.push(`😈 ${rHas} redirection(s) malus au hasard`);
        const rbc = getCiblesListe(rouletteRedirectBonusChoixCible, authorId);
        if (rbc.length > 0) armesList.push(`🎀 Bonus offert à ${rbc.map(id => `<@${id}>`).join(', ')}`);
        const rbh = rouletteRedirectBonusCharges.get(authorId) || 0;
        if (rbh > 0) armesList.push(`🎁 ${rbh} redirection(s) bonus au hasard`);
        const pbc = getCiblesListe(roulettePartageBonusChoixCible, authorId);
        if (pbc.length > 0) armesList.push(`🤝 Partage de bonus avec ${pbc.map(id => `<@${id}>`).join(', ')}`);
    }

    const profilLines = [
        `• Tirages totaux : **${stats.tirages}**`,
        `• Bonus / Malus : **${stats.bonus}** / **${stats.malus}**`,
        `• Succès : **${nbAchs}/${totalAchs}**`,
        `• Effets actifs : **${resumeEtat.bonus.length}** bonus / **${resumeEtat.malus.length}** malus *(\`!rlt state\`)*`,
        `• Pire série : **${stats.pireSerie || 0}**`
    ];

    const embed = new EmbedBuilder()
        .setColor(cEstSonAnniv ? 0xff69b4 : (happyActif ? 0xff6b00 : 0xffd20a))
        .setAuthor({ name: `${displayName} • Roulette Regaïenne`, iconURL: avatarUrl })
        .setTitle('🎰 Tableau de bord — La Roulette Regaïenne')
        .setDescription(
            (cEstSonAnniv ? `🎂 **JOYEUX ANNIVERSAIRE !** Boost exceptionnel **+50% de bonus** offert toute la journée !\n\n` : '') +
            `Bienvenue à la **Roulette Regaïenne** !\n` +
            `Tente ta chance pour décrocher des bonus rares, des cartes RegaDex, ou risquer les pires malus du serveur.\n\n` +
            (armesList.length > 0 ? `⚠️ **Prochain tirage armé :** ${armesList.join(' • ')}\n\n` : '') +
            `### 🎖️ Progression Succès & Pity\n` +
            `\`${achBar}\` **${achPct}%** — **${nbAchs}/${totalAchs}** succès débloqués *(\`!rlt succes\`)*\n\n` +
            `🛡️ **Pity Malus :** \`${pityMBar}\` \`${pity.malus}/${ROULETTE_PITY_MALUS}\`  •  ` +
            `💨 **Pity Nuls :** \`${pityNBar}\` \`${pity.nuls}/${ROULETTE_PITY_NULS}\` *(bonus garanti !)*\n` +
            `────────────────────────────────────────`
        )
        .addFields(
            { name: '🎯 Ton Statut', value: statutLines.join('\n'), inline: true },
            { name: '📊 Tes Stats', value: profilLines.join('\n'), inline: true },
            {
                name: '\u200b',
                value:
                    `────────────────────────────────────────\n` +
                    `**📜 Derniers tirages du serveur**\n` +
                    `${historiqueTexte}\n\n` +
                    `**✨ Infos & Panthéons**\n` +
                    `• 🔥 **Happy Hour :** Tous les soirs **20h – 21h** *(cooldown 5 min)*\n` +
                    `• 🏆 **Hall of Fame :** Bonus ≤ **${(ROULETTE_HOF_SEUIL * 100).toFixed(2)}%** dans <#${ROULETTE_HOF_CHANNEL_ID}>\n` +
                    `• 💀 **Hall of Shame :** Pires malus dans <#${ROULETTE_HOS_CHANNEL_ID}>`,
                inline: false
            }
        )
        .setImage('https://img.draftbot.fr/1790778435185-73ff19eb6e704abb.gif')
        .setFooter({ text: 'Astuce : !rlt go pour tirer direct • !rlt succes pour la galerie Canvas des succès' });

    return embed;
}

function buildRouletteHubPayload(authorId, guildId = null, origMsgId = '') {
    const embed = buildRoulettePresentationEmbed(authorId, guildId);
    const hasNotif = aUneNotifRouletteActive(authorId) || Boolean(rouletteNotifRepeat.get(authorId));
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`roulette_tenter_${authorId}`).setLabel('Tenter sa chance').setEmoji('🍀').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`rlt_probas:hub:bonus:${authorId}`).setLabel('Probabilités').setEmoji('🎲').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`rlt_hub:top:${authorId}`).setLabel('Top').setEmoji('🏆').setStyle(ButtonStyle.Secondary)
    );
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`rlt_hub:state:${authorId}`).setLabel('Mon état').setEmoji('📊').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`rlt_hub:stats:${authorId}`).setLabel('Mes stats').setEmoji('📈').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`rlt_hub:claim:${authorId}`).setLabel('Inventaire').setEmoji('🎒').setStyle(ButtonStyle.Secondary)
    );
    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`rlt_hub:guide:${authorId}`).setLabel('Guide').setEmoji('📖').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`rlt_hub:notif:${authorId}`).setLabel(hasNotif ? 'Alertes ✓' : 'Alertes').setEmoji('🔔').setStyle(hasNotif ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`rlt_hub:close:${authorId}:${origMsgId || ''}`).setLabel('Fermer').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
    );
    return { embeds: [embed], components: [row1, row2, row3] };
}

function buildRouletteGuidePayload(authorId) {
    const embed = new EmbedBuilder()
        .setColor(0xffd20a)
        .setTitle('📖 Guide de la Roulette Regaïenne')
        .setDescription(
            `Voici comment fonctionne la Roulette du serveur :\n\n` +
            `• **🎲 Tirages & Cooldown :** Un tirage toutes les **15 min** *(ou **5 min** pendant l'Happy Hour tous les soirs de 20h à 21h)*.\n` +
            `• **🍀 Pity & Jackpot :** Après **${ROULETTE_PITY_MALUS} malus** ou **${ROULETTE_PITY_NULS} tirages nuls** d'affilée, un **bonus est garanti** ! Chaque tirage nul augmente aussi ton jackpot personnel (+1% jusqu'à +50%).\n` +
            `• **🛡️ Boucliers & Contre-Poison :** Les boucliers bloquent automatiquement ton prochain malus *(sauf Brise-Bouclier)*. Retomber sur un malus textuel déjà actif l'annule par **Miracle !**.\n` +
            `• **🎒 Inventaire :** Certains bonus (Tickets Coupe-File, Redirections au choix, Pseudo au choix, Épinglage…) sont stockés dans ton inventaire (\`!rlt claim\`) pour être activés quand tu veux.\n` +
            `• **🏆 Panthéons :** Les bonus ultra-rares (≤ 0,05%) partent dans <#${ROULETTE_HOF_CHANNEL_ID}> et les pires malus dans <#${ROULETTE_HOS_CHANNEL_ID}>.`
        );

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`rlt_hub:cmds:${authorId}`).setLabel('Commandes').setEmoji('📜').setStyle(ButtonStyle.Primary),
        buildRouletteAccueilButton(authorId),
        buildRouletteCloseButton(authorId)
    );
    return { embeds: [embed], components: [row] };
}

function buildRouletteCmdsPayload(authorId) {
    const embed = new EmbedBuilder()
        .setColor(0xffd20a)
        .setTitle('📜 Commandes de la Roulette')
        .setDescription(
            `• \`!rlt\` *(ou \`/roulette\`)* — Ouvre le tableau de bord interactif.\n` +
            `• \`!rlt go\` *(ou \`/roulette go\`)* — Lance directement un tirage.\n` +
            `• \`!rlt state [@membre]\` — Affiche tes bonus/malus actifs (ou ceux d'un.e autre membre).\n` +
            `• \`!rlt stats [@membre]\` — Affiche les statistiques détaillées et la Pity.\n` +
            `• \`!rlt succes [@membre]\` — Ouvre la galerie des succès débloqués.\n` +
            `• \`!rlt top\` — Classements du serveur (succès, tirages, malus, bonus).\n` +
            `• \`!rlt claim\` — Ouvre ton inventaire de récompenses stockées.\n` +
            `• \`!rlt probas\` — Tableau complet des probabilités et raretés.\n` +
            `• \`!rlt notif\` — Règle tes alertes de fin de cooldown et MP d'interactions.\n` +
            `• \`!rlt help\` *(ou \`!rlthelp\`)* — Affiche cette liste de commandes.`
        );

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`rlt_hub:guide:${authorId}`).setLabel('Guide').setEmoji('📖').setStyle(ButtonStyle.Secondary),
        buildRouletteAccueilButton(authorId),
        buildRouletteCloseButton(authorId)
    );
    return { embeds: [embed], components: [row] };
}

function collectRouletteStateLists(cible, guildId = null) {
    const now = Date.now();
    const tstamp = (ms) => `<t:${Math.ceil(ms / 1000)}:R>`;
    const bonus = [];
    const malus = [];

    const addBonus = (txtEmbed, txtCanvas) => bonus.push({ txtEmbed, txtCanvas: txtCanvas || cleanCanvasText(txtEmbed) });
    const addMalus = (txtEmbed, txtCanvas) => malus.push({ txtEmbed, txtCanvas: txtCanvas || cleanCanvasText(txtEmbed) });

    if (guildId && bridge.estAnniversaireAujourdhui(guildId, cible.id)) {
        addBonus('🎂 **Boost Anniversaire** (+50% de chance toute la journée !)', 'Boost Anniversaire (+50% toute la journee)');
    }
    if (rouletteCouronneUntil.has(cible.id) && now < rouletteCouronneUntil.get(cible.id)) {
        const fin = rouletteCouronneUntil.get(cible.id);
        addBonus(`👑 Couronne (fin ${tstamp(fin)})`, `Couronne (reste ${formatDureeCourte(fin - now)})`);
    }
    if (rouletteAntiFeurUntil.has(cible.id) && now < rouletteAntiFeurUntil.get(cible.id)) {
        const fin = rouletteAntiFeurUntil.get(cible.id);
        addBonus(`🛡️ Immunité anti-feur (fin ${tstamp(fin)})`, `Immunité anti-feur (reste ${formatDureeCourte(fin - now)})`);
    }
    if (rouletteFreeRollUntil.has(cible.id) && now < rouletteFreeRollUntil.get(cible.id)) {
        const fin = rouletteFreeRollUntil.get(cible.id);
        addBonus(`⚡ Tirage à volonté (fin ${tstamp(fin)})`, `Tirage à volonté (reste ${formatDureeCourte(fin - now)})`);
    }
    if (rouletteImmuniteUntil.has(cible.id) && now < rouletteImmuniteUntil.get(cible.id)) {
        const fin = rouletteImmuniteUntil.get(cible.id);
        addBonus(`🛡️ Immunité au timeout (fin ${tstamp(fin)})`, `Immunité timeout (reste ${formatDureeCourte(fin - now)})`);
    }
    const invCible = rouletteInventaire.get(cible.id) ?? {};
    if (invCible.freeRoll1Min && invCible.freeRoll1Min > 0) {
        addBonus(`🎁 **${invCible.freeRoll1Min} tirage(s) à volonté (1 min) en inventaire** (\`!rlt claim\`)`, `${invCible.freeRoll1Min}x Tirage 1 min en inventaire`);
    }
    if ((rouletteCoupTripleCharges.get(cible.id) || 0) > 0) {
        const q = rouletteCoupTripleCharges.get(cible.id);
        addBonus(`🎰 ${q} tirage(s) gratuit(s) sans cooldown`, `${q} tirage(s) gratuit(s)`);
    }
    const rawB = rouletteBouclierActif.get(cible.id);
    const nbB = typeof rawB === 'number' ? rawB : (rawB ? 1 : 0);
    if (nbB > 0) addBonus(`🛡️ ${nbB} charge${nbB > 1 ? 's' : ''} de bouclier`, `${nbB} charge(s) de bouclier`);
    const bJCharges = rouletteJackpotBoostCharges.get(cible.id) || 0;
    if (bJCharges > 0) {
        const bJVal = Math.round((rouletteJackpotBoostValue.get(cible.id) || 0.25) * 100);
        addBonus(`📈 Boost Jackpot : +${bJVal}% (${bJCharges} tirages restants)`, `Boost Jackpot +${bJVal}% (${bJCharges} tirages)`);
    }
    if ((rouletteVoteRedirectCharges.get(cible.id) || 0) > 0) {
        const q = rouletteVoteRedirectCharges.get(cible.id);
        addBonus(`🎯 **${q} redirection(s) au choix (Vote public)**`, `${q} redirection(s) Vote public`);
    }
    if ((rouletteRedirectCharges.get(cible.id) || 0) > 0) {
        const q = rouletteRedirectCharges.get(cible.id);
        addBonus(`😈 ${q} redirection(s) de malus`, `${q} redirection(s) malus hasard`);
    }
    const ciblesMalusChoix = getCiblesListe(rouletteRedirectChoixCible, cible.id);
    if (ciblesMalusChoix.length > 0) {
        addBonus(`🎯 Redirection du prochain malus au choix (${ciblesMalusChoix.length}) ➔ ${ciblesMalusChoix.map(id => `<@${id}>`).join(', ')}`, `${ciblesMalusChoix.length} redirection(s) malus au choix`);
    }
    if ((rouletteRedirectBonusCharges.get(cible.id) || 0) > 0) {
        const q = rouletteRedirectBonusCharges.get(cible.id);
        addBonus(`🎁 ${q} redirection(s) de bonus au hasard`, `${q} redirection(s) bonus hasard`);
    }
    const ciblesBonusChoix = getCiblesListe(rouletteRedirectBonusChoixCible, cible.id);
    if (ciblesBonusChoix.length > 0) {
        addBonus(`🎀 Redirection du prochain bonus au choix (${ciblesBonusChoix.length}) ➔ ${ciblesBonusChoix.map(id => `<@${id}>`).join(', ')}`, `${ciblesBonusChoix.length} redirection(s) bonus au choix`);
    }
    const ciblesPartage = getCiblesListe(roulettePartageBonusChoixCible, cible.id);
    if (ciblesPartage.length > 0) {
        addBonus(`🤝 Partage du prochain bonus (${ciblesPartage.length}) ➔ ${ciblesPartage.map(id => `<@${id}>`).join(', ')}`, `${ciblesPartage.length} partage(s) de bonus`);
    }
    if (rouletteDiviseurUntil.has(cible.id) && now < rouletteDiviseurUntil.get(cible.id)) {
        const fin = rouletteDiviseurUntil.get(cible.id);
        addBonus(`➗ Diviseur de cooldown /2 (fin ${tstamp(fin)})`, `Diviseur /2 (reste ${formatDureeCourte(fin - now)})`);
    }
    if ((rouletteCooldownCourtCharges.get(cible.id) || 0) > 0) {
        const q = rouletteCooldownCourtCharges.get(cible.id);
        addBonus(`⚡ ${q} tirage(s) à cooldown réduit (5 min)`, `${q} tirage(s) cooldown 5 min`);
    }

    if (rouletteDoubleTempsUntil.has(cible.id) && now < rouletteDoubleTempsUntil.get(cible.id)) {
        const fin = rouletteDoubleTempsUntil.get(cible.id);
        addMalus(`⏳ Malus x2 pendant 24h (fin ${tstamp(fin)})`, `Malus x2 (reste ${formatDureeCourte(fin - now)})`);
    }
    if (roulettePseudoLock.has(cible.id) && now < roulettePseudoLock.get(cible.id).until) {
        const lock = roulettePseudoLock.get(cible.id);
        addMalus(`🔒 Pseudo verrouillé (${lock.pseudo}) (fin ${tstamp(lock.until)})`, `Pseudo lock: ${cleanCanvasText(lock.pseudo)} (reste ${formatDureeCourte(lock.until - now)})`);
    }
    if (rouletteTimeoutUntil.has(cible.id) && now < rouletteTimeoutUntil.get(cible.id)) {
        const fin = rouletteTimeoutUntil.get(cible.id);
        addMalus(`💀 Timeout roulette (fin ${tstamp(fin)})`, `Timeout roulette (reste ${formatDureeCourte(fin - now)})`);
    }
    if (rouletteUwuUntil.has(cible.id) && now < rouletteUwuUntil.get(cible.id)) {
        const fin = rouletteUwuUntil.get(cible.id);
        addMalus(`😳 Doit finir par UwU (fin ${tstamp(fin)})`, `UwU obligatoire (reste ${formatDureeCourte(fin - now)})`);
    }
    if (rouletteLettreInterdite.has(cible.id) && now < rouletteLettreInterdite.get(cible.id).until) {
        const li = rouletteLettreInterdite.get(cible.id);
        addMalus(`🔤 Lettre interdite : **${li.lettre}** (fin ${tstamp(li.until)})`, `Lettre interdite: ${li.lettre} (reste ${formatDureeCourte(li.until - now)})`);
    }
    if (rouletteEmojiUntil.has(cible.id) && now < rouletteEmojiUntil.get(cible.id)) {
        const fin = rouletteEmojiUntil.get(cible.id);
        addMalus(`😀 Doit finir par un emoji (fin ${tstamp(fin)})`, `Emoji obligatoire (reste ${formatDureeCourte(fin - now)})`);
    }
    if (rouletteLeetUntil.has(cible.id) && now < rouletteLeetUntil.get(cible.id)) {
        const fin = rouletteLeetUntil.get(cible.id);
        addMalus(`🤖 Parle en l33t sp34k (fin ${tstamp(fin)})`, `Leet speak (reste ${formatDureeCourte(fin - now)})`);
    }
    if ((rouletteCooldown45Charges.get(cible.id) || 0) > 0) {
        const q = rouletteCooldown45Charges.get(cible.id);
        addMalus(`⏳ ${q} tirage(s) à cooldown 45 min`, `${q} tirage(s) cooldown 45 min`);
    }
    if ((rouletteLooongCooldownCharges.get(cible.id) || 0) > 0) {
        const q = rouletteLooongCooldownCharges.get(cible.id);
        addMalus(`⏳ ${q} tirage(s) à cooldown 1 heure`, `${q} tirage(s) cooldown 1h`);
    }
    if (rouletteEchoUntil.has(cible.id) && now < rouletteEchoUntil.get(cible.id)) {
        const fin = rouletteEchoUntil.get(cible.id);
        addMalus(`🪞 Écho condescendant (1 msg sur 3) (fin ${tstamp(fin)})`, `Écho condescendant (reste ${formatDureeCourte(fin - now)})`);
    }

    const tf = rouletteTransfos.get(cible.id) ?? {};
    const libTf = {
        caps: '🔠 Majuscules obligatoires', emojiOnly: '🙂 Emoji only', limite100: '✂️ Limite 100 caractères',
        limite30: '✂️ Limite 30 caractères', mots: '🔀 Mots mélangés', lettres: '🔤 Lettres mélangées',
        censure: '▇ Mots censurés (1 mot sur 3)', bebe: '🍼 Parler bébé', boomer: '🧓 Mode Boomer (1 msg sur 3)',
        existentiel: '🥀 Crise existentielle (1 msg sur 3)', linkedin: '👔 Gourou LinkedIn (1 msg sur 3)',
        sansConsonne: '🅾️ 0 Consonne', sansVoyelle: '🚫 0 Voyelle',
        mocking: '🤡 Mocking', begaiement: '🗣️ Bégaiement',
        publicite: '📺 Publicité intrusive (1 msg sur 3)', autocorrect: '📱 Autocorrect maudit (1 msg sur 2)',
        oyez: '📯 Oyez oyez ! (1 msg sur 2)'
    };
    for (const [k, fin] of Object.entries(tf)) {
        if (now < fin && libTf[k]) {
            addMalus(`${libTf[k]} (fin ${tstamp(fin)})`, `${cleanCanvasText(libTf[k])} (reste ${formatDureeCourte(fin - now)})`);
        }
    }

    return { bonus, malus };
}

function buildRouletteStateEmbed(cible, guildId = null) {
    const now = Date.now();
    const { bonus, malus } = collectRouletteStateLists(cible, guildId);

    const finCd = rouletteCooldowns.get(cible.id);
    let footerText = '⏳ Cooldown : Aucun (prêt à lancer !)';
    if (finCd && now < finCd) {
        const minsRestantes = Math.ceil((finCd - now) / 60000);
        footerText = `⏳ Cooldown restant : ~${minsRestantes} min`;
    }

    const pity = roulettePity.get(cible.id) ?? { malus: 0, nuls: 0 };
    const jackpotBoost = Math.round((rouletteJackpotBonus.get(cible.id) || 0) * 100);

    const pityTexte = `• **Malus subis :** **${pity.malus}/${ROULETTE_PITY_MALUS}** *(bonus garanti à 3)*\n` +
                      `• **Tirages nuls :** **${pity.nuls}/${ROULETTE_PITY_NULS}** *(bonus garanti à 5)*\n` +
                      `• **Boost accumulé :** **+${jackpotBoost}%** de chance bonus`;

    const avatarState = cible?.displayAvatarURL?.({ dynamic: true }) || cible?.user?.displayAvatarURL?.({ dynamic: true }) || undefined;
    return new EmbedBuilder()
        .setColor(0xffd20a)
        .setAuthor({ name: `${cible.displayName} • État Roulette`, iconURL: avatarState })
        .setTitle(`📊 État actif`)
        .addFields(
            { name: 'BONUS :', value: (bonus.length ? bonus.map(b => b.txtEmbed).join('\n') : '*Aucun bonus actif*') + '\n\u200b', inline: false },
            { name: 'MALUS :', value: (malus.length ? malus.map(m => m.txtEmbed).join('\n') : '*Aucun malus actif*') + '\n\u200b', inline: false },
            { name: 'PROGRESSION PITY & JACKPOT 🍀', value: pityTexte, inline: false }
        )
        .setFooter({ text: footerText });
}

async function renderRouletteStateCanvas(cible, guildId = null) {
    const W = 1600, H = 900;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    await drawRouletteBg(ctx, W, H);

    const now = Date.now();
    const { bonus, malus } = collectRouletteStateLists(cible, guildId);
    const pity = roulettePity.get(cible.id) ?? { malus: 0, nuls: 0 };
    const jackpotBoost = Math.round((rouletteJackpotBonus.get(cible.id) || 0) * 100);
    const finCd = rouletteCooldowns.get(cible.id);
    const cdTxt = finCd && now < finCd ? `COOLDOWN : ${formatDureeCourte(finCd - now)}` : 'PRÊT À TIRER';

    // Header
    drawGlassPanel(ctx, 48, 36, W - 96, 130, 22, 'rgba(12, 15, 26, 0.84)', 'rgba(255, 210, 10, 0.48)', 2.5);
    await drawCircularAvatar(ctx, cible, 118, 101, 46, '#FFD20A');

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#FFD20A';
    ctx.font = 'bold 20px "LemonMilk", "Sans"';
    ctx.fillText('ÉTAT ACTIF ROULETTE', 190, 74);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 36px "LemonMilk", "Sans"';
    ctx.fillText(formatRouletteDisplayName(cible), 190, 118, 860);

    drawGlassPanel(ctx, W - 430, 66, 355, 68, 16, finCd && now < finCd ? 'rgba(230, 126, 34, 0.25)' : 'rgba(0, 191, 25, 0.25)', finCd && now < finCd ? '#E67E22' : '#00BF19', 2);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 22px "LemonMilk", "Sans"';
    ctx.fillText(cdTxt, W - 252, 100, 330);

    // Colonnes Bonus / Malus
    const colW = 736, colH = 540, topY = 190;
    drawGlassPanel(ctx, 48, topY, colW, colH, 22, 'rgba(10, 22, 16, 0.80)', 'rgba(0, 191, 25, 0.55)', 2);
    drawGlassPanel(ctx, 48 + colW + 32, topY, colW, colH, 22, 'rgba(26, 10, 14, 0.80)', 'rgba(224, 49, 49, 0.55)', 2);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#2ECC71';
    ctx.font = 'bold 26px "LemonMilk", "Sans"';
    ctx.fillText(`BONUS ACTIFS (${bonus.length})`, 82, topY + 42);

    ctx.fillStyle = '#FF5C5C';
    ctx.fillText(`MALUS ACTIFS (${malus.length})`, 48 + colW + 66, topY + 42);

    const drawList = (items, startX, accent, emptyLabel) => {
        if (items.length === 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.48)';
            ctx.font = 'bold 22px "LemonMilk", "Sans"';
            ctx.fillText(emptyLabel, startX, topY + 110);
            return;
        }
        const maxShow = 10;
        const shown = items.slice(0, maxShow);
        shown.forEach((it, i) => {
            const py = topY + 84 + i * 43;
            drawGlassPanel(ctx, startX, py, colW - 68, 36, 10, 'rgba(255,255,255,0.06)', accent, 1);
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 17px "LemonMilk", "Sans"';
            ctx.fillText(it.txtCanvas, startX + 16, py + 18, colW - 100);
        });
        if (items.length > maxShow) {
            ctx.fillStyle = '#FFD20A';
            ctx.font = 'bold 17px "LemonMilk", "Sans"';
            ctx.fillText(`+ ${items.length - maxShow} autre(s)...`, startX + 8, topY + colH - 22);
        }
    };

    drawList(bonus, 82, 'rgba(46, 204, 113, 0.35)', 'Aucun bonus actif pour le moment.');
    drawList(malus, 48 + colW + 66, 'rgba(255, 92, 92, 0.35)', 'Aucun malus actif !');

    // Barre Pity & Jackpot en bas
    drawGlassPanel(ctx, 48, 754, W - 96, 110, 20, 'rgba(12, 15, 26, 0.86)', 'rgba(255, 210, 10, 0.4)', 2);
    const segW = (W - 140) / 3;
    const infos = [
        { label: 'PITY MALUS', val: `${pity.malus} / ${ROULETTE_PITY_MALUS}`, color: '#FF6B6B' },
        { label: 'PITY NULS', val: `${pity.nuls} / ${ROULETTE_PITY_NULS}`, color: '#74C0FC' },
        { label: 'BOOST JACKPOT', val: `+${jackpotBoost}%`, color: '#FFD20A' }
    ];
    infos.forEach((inf, idx) => {
        const cx = 70 + idx * segW + segW / 2;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,255,255,0.68)';
        ctx.font = 'bold 18px "LemonMilk", "Sans"';
        ctx.fillText(inf.label, cx, 788);
        ctx.fillStyle = inf.color;
        ctx.font = 'bold 34px "LemonMilk", "Sans"';
        ctx.fillText(inf.val, cx, 830);
    });

    return canvas.toBuffer('image/jpeg', { quality: 0.92 });
}

async function buildRouletteStatePayload(cible, guildId = null, authorId = null, viewMode = 'img', fromHub = false) {
    const uid = authorId || cible.id;
    const isImg = viewMode !== 'txt';
    const nextView = isImg ? 'txt' : 'img';
    const hubFlag = fromHub ? '1' : '0';

    const rowBtns = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`rlt_view:state:${cible.id}:${nextView}:${uid}:${hubFlag}`)
            .setLabel(isImg ? 'Version imagée' : 'Version texte')
            .setEmoji(isImg ? '🖼️' : '📝')
            .setStyle(ButtonStyle.Secondary),
        buildRouletteAccueilButton(uid),
        buildRouletteCloseButton(uid)
    );

    const selectMenu = buildMenuChoixMembreRoulette(cible.guild, uid, `rlt_inspect_state_${uid}_${isImg ? 'img' : 'txt'}_${hubFlag}`, '🔍 Inspecter un autre membre...');
    const components = [rowBtns];
    if (selectMenu) components.push(new ActionRowBuilder().addComponents(selectMenu));

    if (!isImg) {
        return { embeds: [buildRouletteStateEmbed(cible, guildId)], components, files: [] };
    }

    const buf = await renderRouletteStateCanvas(cible, guildId);
    const att = new AttachmentBuilder(buf, { name: 'rlt_state.jpg' });
    const embed = new EmbedBuilder()
        .setColor(0xffd20a)
        .setTitle(`📊 État Roulette — ${cible.displayName}`)
        .setImage('attachment://rlt_state.jpg');
    return { embeds: [embed], components, files: [att] };
}

function buildRouletteAchievementsEmbed(cible, page = 0, authorId, viewMode = 'txt', fromHub = false) {
    const userAchs = rouletteAchievements.get(cible.id) ?? {};
    const totalAchs = ROULETTE_ACHIEVEMENTS.length;
    const debl = Object.keys(userAchs).filter(id => ROULETTE_ACHIEVEMENTS.some(a => a.id === id)).length;
    const hasSecret = ROULETTE_SECRET_ACHIEVEMENTS.some(a => Boolean(userAchs[a.id]));
    const PAGE_SIZE = 10;
    const totalPages = Math.max(1, Math.ceil(totalAchs / PAGE_SIZE));
    const safePage = Math.max(0, Math.min(page, totalPages - 1));
    const start = safePage * PAGE_SIZE;
    const slice = ROULETTE_ACHIEVEMENTS.slice(start, start + PAGE_SIZE);

    const lignes = slice.map(a => {
        const ts = userAchs[a.id];
        if (ts) return `✅ **${a.emoji} ${a.nom}** — *${a.desc}* (<t:${Math.floor(ts / 1000)}:R>)`;
        return `🔒 **${a.emoji} ${a.nom}** — *${a.desc}*`;
    }).join('\n');

    const embed = new EmbedBuilder()
        .setColor(0xffd20a)
        .setTitle(`🎖️ Succès de ${cible.displayName} (${debl}/${totalAchs})`)
        .setDescription(lignes)
        .setFooter({ text: `Page ${safePage + 1}/${totalPages}` });

    const hubFlag = fromHub ? '1' : '0';
    const nextView = viewMode === 'img' ? 'txt' : 'img';
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`rlt_achs_${cible.id}_${safePage - 1}_${authorId}_${viewMode}_${hubFlag}`).setLabel('⬅️ Précédent').setStyle(ButtonStyle.Secondary).setDisabled(safePage === 0),
        new ButtonBuilder().setCustomId(`rlt_achs_${cible.id}_${safePage + 1}_${authorId}_${viewMode}_${hubFlag}`).setLabel('➡️ Suivant').setStyle(ButtonStyle.Secondary).setDisabled(safePage >= totalPages - 1),
        new ButtonBuilder().setCustomId(`rlt_view:succes:${cible.id}:${nextView}:${safePage}:${authorId}:${hubFlag}`).setLabel(viewMode === 'img' ? 'Version imagée' : 'Version texte').setEmoji(viewMode === 'img' ? '🖼️' : '📝').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`rlt_stats_back_${cible.id}_${authorId}_${hubFlag}`).setLabel('↩️ Stats').setStyle(ButtonStyle.Primary)
    );
    if (hasSecret) {
        row.addComponents(
            new ButtonBuilder().setCustomId(`rlt_secretachs_${cible.id}_${authorId}_${viewMode}_${hubFlag}`).setLabel('Secrets').setEmoji('🕵️').setStyle(ButtonStyle.Primary)
        );
    }
    return { embed, row };
}

function buildRouletteSecretAchievementsPayload(cible, authorId, viewMode = 'img', fromHub = false) {
    const userAchs = rouletteAchievements.get(cible.id) ?? {};
    const deblSecret = ROULETTE_SECRET_ACHIEVEMENTS.filter(a => Boolean(userAchs[a.id])).length;
    const avatarUrl = cible.displayAvatarURL?.({ dynamic: true }) || undefined;
    const hubFlag = fromHub ? '1' : '0';

    const lignes = ROULETTE_SECRET_ACHIEVEMENTS.map(a => {
        const ts = userAchs[a.id];
        if (ts) return `✅ **${a.emoji} ${a.nom}** — *${a.desc}* (<t:${Math.floor(ts / 1000)}:R>)`;
        return `🔒 **???** — *??? (Condition secrète)*`;
    }).join('\n\n');

    const embed = new EmbedBuilder()
        .setColor(0x9b59b6)
        .setAuthor({ name: `${cible.displayName} • Succès Secrets`, iconURL: avatarUrl })
        .setTitle(`🕵️ Succès Secrets de ${cible.displayName} (${deblSecret}/${ROULETTE_SECRET_ACHIEVEMENTS.length})`)
        .setDescription(lignes)
        .setFooter({ text: 'Les succès non découverts restent ??? jusqu\'à leur déblocage.' });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`rlt_achs_${cible.id}_0_${authorId}_${viewMode}_${hubFlag}`).setLabel('⬅️ Succès classiques').setStyle(ButtonStyle.Secondary),
        buildRouletteAccueilButton(authorId),
        buildRouletteCloseButton(authorId)
    );
    return { embeds: [embed], components: [row], files: [] };
}

const ROULETTE_ACH_THEMES = {
    forteresse: 'shield', 'pare-balles': 'shield', 'tete-dure': 'shield',
    'malus-prime': 'skull', 'condamne-plebe': 'skull', 'survivant-enfer': 'skull',
    'enchainement-fatal': 'skull', 'chat-noir': 'skull', 'double-peine': 'skull',
    'silence-radio': 'skull', 'seum-en-personne': 'skull',
    'le-sauvetage': 'clover', 'oiseau-nuit': 'clover', pharmacien: 'clover',
    incomprehensible: 'clover', 'crise-quarantaine': 'clover',
    'centurion-500': 'crown', 'ascension-sociale': 'crown', laristocrate: 'crown',
    'jour-de-gloire': 'crown', 'argent-epsys': 'crown',
    hof: 'trophy', innocente: 'trophy', baptiseur: 'trophy',
    epingle: 'trophy', 'fan-carlos': 'trophy'
};

function drawAchievementVectorIcon(ctx, theme, cx, cy, r, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    if (theme === 'shield') {
        ctx.beginPath();
        ctx.moveTo(cx, cy - r * 0.85);
        ctx.lineTo(cx + r * 0.72, cy - r * 0.5);
        ctx.lineTo(cx + r * 0.65, cy + r * 0.15);
        ctx.quadraticCurveTo(cx, cy + r * 0.85, cx, cy + r * 0.9);
        ctx.quadraticCurveTo(cx, cy + r * 0.85, cx - r * 0.65, cy + r * 0.15);
        ctx.lineTo(cx - r * 0.72, cy - r * 0.5);
        ctx.closePath();
        ctx.stroke();
    } else if (theme === 'skull') {
        ctx.beginPath();
        ctx.arc(cx, cy - r * 0.15, r * 0.58, Math.PI, 0);
        ctx.lineTo(cx + r * 0.42, cy + r * 0.45);
        ctx.lineTo(cx - r * 0.42, cy + r * 0.45);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx - r * 0.22, cy - r * 0.1, r * 0.12, 0, Math.PI * 2);
        ctx.arc(cx + r * 0.22, cy - r * 0.1, r * 0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.14, cy + r * 0.45);
        ctx.lineTo(cx - r * 0.14, cy + r * 0.72);
        ctx.moveTo(cx + r * 0.14, cy + r * 0.45);
        ctx.lineTo(cx + r * 0.14, cy + r * 0.72);
        ctx.stroke();
    } else if (theme === 'clover') {
        const lobes = [
            [0, -r * 0.36], [-r * 0.36, 0], [r * 0.36, 0]
        ];
        for (const [dx, dy] of lobes) {
            ctx.beginPath();
            ctx.arc(cx + dx, cy + dy, r * 0.3, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.beginPath();
        ctx.moveTo(cx, cy + r * 0.1);
        ctx.quadraticCurveTo(cx + r * 0.05, cy + r * 0.65, cx + r * 0.3, cy + r * 0.85);
        ctx.stroke();
    } else if (theme === 'crown') {
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.72, cy + r * 0.45);
        ctx.lineTo(cx - r * 0.72, cy - r * 0.35);
        ctx.lineTo(cx - r * 0.32, cy + r * 0.05);
        ctx.lineTo(cx, cy - r * 0.55);
        ctx.lineTo(cx + r * 0.32, cy + r * 0.05);
        ctx.lineTo(cx + r * 0.72, cy - r * 0.35);
        ctx.lineTo(cx + r * 0.72, cy + r * 0.45);
        ctx.closePath();
        ctx.stroke();
    } else if (theme === 'trophy') {
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.5, cy - r * 0.65);
        ctx.lineTo(cx + r * 0.5, cy - r * 0.65);
        ctx.quadraticCurveTo(cx + r * 0.45, cy + r * 0.15, cx, cy + r * 0.25);
        ctx.quadraticCurveTo(cx - r * 0.45, cy + r * 0.15, cx - r * 0.5, cy - r * 0.65);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, cy + r * 0.25);
        ctx.lineTo(cx, cy + r * 0.68);
        ctx.moveTo(cx - r * 0.4, cy + r * 0.68);
        ctx.lineTo(cx + r * 0.4, cy + r * 0.68);
        ctx.stroke();
    } else {
        drawRoundRect(ctx, cx - r * 0.62, cy - r * 0.62, r * 1.24, r * 1.24, 4);
        ctx.stroke();
        for (const [px, py] of [[-0.28, -0.28], [0.28, -0.28], [0, 0], [-0.28, 0.28], [0.28, 0.28]]) {
            ctx.beginPath();
            ctx.arc(cx + px * r, cy + py * r, r * 0.1, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.restore();
}

async function renderRouletteAchievementsCanvas(cible, page = 0) {
    const W = 1600, H = 900;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    await drawRouletteBg(ctx, W, H);

    const userAchs = rouletteAchievements.get(cible.id) ?? {};
    const totalAchs = ROULETTE_ACHIEVEMENTS.length;
    const debl = Object.keys(userAchs).filter(id => ROULETTE_ACHIEVEMENTS.some(a => a.id === id)).length;
    const pct = totalAchs > 0 ? Math.round((debl / totalAchs) * 100) : 0;
    const estComplet = totalAchs > 0 && debl >= totalAchs;
    const PAGE_SIZE = 10;
    const totalPages = Math.max(1, Math.ceil(totalAchs / PAGE_SIZE));
    const safePage = Math.max(0, Math.min(page, totalPages - 1));
    const slice = ROULETTE_ACHIEVEMENTS.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

    // Header (lueur spéciale dorée si 30/30)
    if (estComplet) {
        ctx.save();
        ctx.shadowColor = '#FFD20A';
        ctx.shadowBlur = 24;
        drawGlassPanel(ctx, 48, 30, W - 96, 118, 20, 'rgba(26, 22, 10, 0.90)', '#FFD20A', 3.5);
        ctx.restore();
    } else {
        drawGlassPanel(ctx, 48, 30, W - 96, 118, 20, 'rgba(12, 15, 26, 0.85)', 'rgba(255, 210, 10, 0.5)', 2.5);
    }
    await drawCircularAvatar(ctx, cible, 112, 89, 42, '#FFD20A', estComplet ? '#FFD20A' : null);

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#FFD20A';
    ctx.font = 'bold 20px "LemonMilk", "Sans"';
    ctx.fillText(
        estComplet
            ? `SUCCÈS ROULETTE • ★ COMPLET 30/30 ★ • PAGE ${safePage + 1}/${totalPages}`
            : `SUCCÈS ROULETTE • PAGE ${safePage + 1}/${totalPages}`,
        178,
        66
    );

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 32px "LemonMilk", "Sans"';
    ctx.fillText(formatRouletteDisplayName(cible), 178, 108, 680);

    // Barre de progression droite
    const barX = 940, barY = 90, barW = 560, barH = 22;
    ctx.textAlign = 'right';
    ctx.fillStyle = estComplet ? '#FFD20A' : '#FFFFFF';
    ctx.font = 'bold 24px "LemonMilk", "Sans"';
    ctx.fillText(`${debl} / ${totalAchs} (${pct}%)`, barX + barW, 66);
    drawGlassPanel(ctx, barX, barY, barW, barH, 11, 'rgba(255,255,255,0.12)', 'rgba(255,210,10,0.4)', 1.5);
    if (pct > 0) {
        drawRoundRect(ctx, barX + 2, barY + 2, Math.max(16, ((barW - 4) * pct) / 100), barH - 4, 9);
        ctx.fillStyle = '#FFD20A';
        ctx.fill();
    }

    // Grille 5 colonnes x 2 lignes
    const cols = 5, rows = 2;
    const gapX = 20, gapY = 22, startX = 48, startY = 172;
    const cardW = Math.floor((W - startX * 2 - gapX * (cols - 1)) / cols);
    const cardH = Math.floor((H - startY - 40 - gapY * (rows - 1)) / rows);

    for (let i = 0; i < slice.length; i++) {
        const a = slice[i];
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cx = startX + col * (cardW + gapX);
        const cy = startY + row * (cardH + gapY);
        const ts = userAchs[a.id];
        const unlocked = Boolean(ts);

        if (estComplet && unlocked) {
            ctx.save();
            ctx.shadowColor = 'rgba(255, 210, 10, 0.55)';
            ctx.shadowBlur = 16;
            drawGlassPanel(ctx, cx, cy, cardW, cardH, 18, 'rgba(28, 24, 14, 0.90)', '#FFD20A', 3);
            ctx.restore();
        } else {
            drawGlassPanel(
                ctx, cx, cy, cardW, cardH, 18,
                unlocked ? 'rgba(20, 26, 40, 0.88)' : 'rgba(12, 14, 22, 0.72)',
                unlocked ? '#FFD20A' : 'rgba(255, 255, 255, 0.16)',
                unlocked ? 2.5 : 1.5
            );
        }

        // Badge statut (gauche) + Médaillon icône thématique (coin haut-droit)
        drawGlassPanel(
            ctx, cx + 16, cy + 16, cardW - 76, 34, 10,
            unlocked ? 'rgba(0, 191, 25, 0.25)' : 'rgba(255, 255, 255, 0.06)',
            unlocked ? '#2ECC71' : 'rgba(255,255,255,0.2)',
            1.5
        );
        ctx.textAlign = 'center';
        ctx.fillStyle = unlocked ? '#2ECC71' : 'rgba(255,255,255,0.5)';
        ctx.font = 'bold 15px "LemonMilk", "Sans"';
        ctx.fillText(unlocked ? 'DÉBLOQUÉ' : 'VERROUILLÉ', cx + 16 + (cardW - 76) / 2, cy + 33);

        drawGlassPanel(
            ctx, cx + cardW - 50, cy + 16, 34, 34, 10,
            unlocked ? 'rgba(255, 210, 10, 0.18)' : 'rgba(255, 255, 255, 0.04)',
            unlocked ? 'rgba(255, 210, 10, 0.6)' : 'rgba(255,255,255,0.16)',
            1.5
        );
        const theme = ROULETTE_ACH_THEMES[a.id] || 'dice';
        drawAchievementVectorIcon(ctx, theme, cx + cardW - 33, cy + 33, 10, unlocked ? '#FFD20A' : 'rgba(255,255,255,0.38)');

        // Titre succès
        ctx.fillStyle = unlocked ? '#FFD20A' : 'rgba(255,255,255,0.65)';
        ctx.font = 'bold 20px "LemonMilk", "Sans"';
        const nom = cleanCanvasText(a.nom);
        ctx.fillText(nom, cx + cardW / 2, cy + 92, cardW - 28);

        // Description multi-lignes simple
        ctx.fillStyle = unlocked ? '#EAEAEA' : 'rgba(255,255,255,0.42)';
        ctx.font = 'bold 14px "LemonMilk", "Sans"';
        const mots = cleanCanvasText(a.desc).split(' ');
        const lines = [];
        let cur = '';
        for (const m of mots) {
            if ((cur + ' ' + m).trim().length > 24) {
                if (cur) lines.push(cur);
                cur = m;
            } else {
                cur = (cur + ' ' + m).trim();
            }
        }
        if (cur) lines.push(cur);
        lines.slice(0, 4).forEach((ln, li) => {
            ctx.fillText(ln, cx + cardW / 2, cy + 146 + li * 24, cardW - 26);
        });

        // Date ou verrou
        ctx.fillStyle = unlocked ? 'rgba(255, 210, 10, 0.85)' : 'rgba(255,255,255,0.32)';
        ctx.font = 'bold 14px "LemonMilk", "Sans"';
        const dateStr = unlocked ? new Date(ts).toLocaleDateString('fr-FR') : '---';
        ctx.fillText(dateStr, cx + cardW / 2, cy + cardH - 26);
    }

    return canvas.toBuffer('image/jpeg', { quality: 0.92 });
}

async function buildRouletteAchievementsPayload(cible, page = 0, authorId = null, viewMode = 'img', fromHub = false) {
    const uid = authorId || cible.id;
    const isImg = viewMode !== 'txt';
    const currentView = isImg ? 'img' : 'txt';
    const { embed, row } = buildRouletteAchievementsEmbed(cible, page, uid, currentView, fromHub);
    const hubFlag = fromHub ? '1' : '0';
    const selectMenu = buildMenuChoixMembreRoulette(cible.guild, uid, `rlt_inspect_succes_${uid}_${currentView}_${hubFlag}`, '🔍 Inspecter un autre membre...');
    const rowNav = new ActionRowBuilder().addComponents(
        buildRouletteAccueilButton(uid),
        buildRouletteCloseButton(uid)
    );
    const components = [row];
    if (selectMenu) components.push(new ActionRowBuilder().addComponents(selectMenu));
    components.push(rowNav);

    if (!isImg) {
        return { embeds: [embed], components, files: [] };
    }

    const totalPages = Math.max(1, Math.ceil(ROULETTE_ACHIEVEMENTS.length / 10));
    const safePage = Math.max(0, Math.min(page, totalPages - 1));
    const buf = await renderRouletteAchievementsCanvas(cible, safePage);
    const att = new AttachmentBuilder(buf, { name: 'rlt_succes.jpg' });
    const userAchs = rouletteAchievements.get(cible.id) ?? {};
    const debl = Object.keys(userAchs).filter(id => ROULETTE_ACHIEVEMENTS.some(a => a.id === id)).length;
    const imgEmbed = new EmbedBuilder()
        .setColor(0xffd20a)
        .setTitle(`🎖️ Succès de ${cible.displayName} (${debl}/${ROULETTE_ACHIEVEMENTS.length})`)
        .setImage('attachment://rlt_succes.jpg')
        .setFooter({ text: `Page ${safePage + 1}/${totalPages}` });
    return { embeds: [imgEmbed], components, files: [att] };
}

function buildRouletteStatsEmbed(cible) {
    const stats = rouletteStats.get(cible.id) ?? { tirages: 0, bonus: 0, malus: 0, rien: 0, plusGrosGain: null, pireSerie: 0 };
    const gain = stats.plusGrosGain ? `**${stats.plusGrosGain.nom}** (${probaAffichee(stats.plusGrosGain.proba).pct}%)` : 'Aucun bonus encore';
    const avatarStats = cible?.displayAvatarURL?.({ dynamic: true }) || cible?.user?.displayAvatarURL?.({ dynamic: true }) || undefined;

    return new EmbedBuilder()
        .setColor(0xffd20a)
        .setAuthor({ name: `${cible.displayName} • Stats Roulette`, iconURL: avatarStats })
        .setTitle(`📊 Statistiques Roulette`)
        .setDescription(
            `🎲 Tirages : **${stats.tirages}**\n` +
            `🎉 Bonus : **${stats.bonus}**\n` +
            `💀 Malus : **${stats.malus}**\n` +
            `😶 Rien : **${stats.rien}**\n` +
            `🏆 Plus gros gain : ${gain}\n` +
            `📉 Plus longue série de malchance : **${stats.pireSerie}**` +
            (() => { const d = getRoulettodexInfo(cible.id); return `\n📖 Roulettodex : **${d.count}/${d.total}** (${d.pct}%)`; })()
        );
}

function getRoulettodexInfo(userId) {
    const validIds = new Set(ROULETTE_TABLE.map(e => e.id));
    const raw = rouletteDiscovered.get(userId);
    const list = Array.isArray(raw) ? raw.filter(id => validIds.has(id)) : [];
    const set = new Set(list);
    const total = ROULETTE_TABLE.length;
    const count = set.size;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return { set, count, total, pct };
}

function buildRouletteDexPayload(cible, cat = 'all', page = 0, authorId, fromHub = false) {
    const { set, count, total, pct } = getRoulettodexInfo(cible.id);
    const safeCat = ['all', 'bonus', 'malus', 'special'].includes(cat) ? cat : 'all';
    const uid = authorId || cible.id;
    const hubFlag = fromHub ? '1' : '0';

    const pool = ROULETTE_TABLE.filter(e => {
        if (safeCat === 'bonus') return e.type === 'bonus' && !e.tcgOnly;
        if (safeCat === 'malus') return e.type === 'malus';
        if (safeCat === 'special') return e.type === 'special' || Boolean(e.tcgOnly);
        return true;
    }).sort((a, b) => b.poids - a.poids);

    const PAGE_SIZE = 15;
    const totalPages = Math.max(1, Math.ceil(pool.length / PAGE_SIZE));
    const safePage = Math.max(0, Math.min(page, totalPages - 1));
    const slice = pool.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

    const lignes = slice.map(e => {
        const { n, pct: pStr } = probaAffichee(probaReelle(e));
        if (set.has(e.id)) {
            const em = ROULETTE_EMOJIS_PAR_ID[e.id] || '✨';
            return `✅ ${em} **${e.nom}** — \`1/${n}\` (${pStr}%)`;
        }
        const typeTxt = e.tcgOnly ? 'RegaDex TCG' : (e.type === 'bonus' ? 'Bonus' : e.type === 'malus' ? 'Malus' : 'Spécial');
        return `❓ **???** — *${typeTxt} (\`1/${n}\` • ${pStr}%)*`;
    }).join('\n');

    const bar = buildRouletteBar(count, total, 14);
    const avatarUrl = cible.displayAvatarURL?.({ dynamic: true }) || undefined;
    const embed = new EmbedBuilder()
        .setColor(0xffd20a)
        .setAuthor({ name: `${cible.displayName} • Roulettodex`, iconURL: avatarUrl })
        .setTitle(`📖 Roulettodex — ${count}/${total} (${pct}%)`)
        .setDescription(`\`${bar}\` **${count}/${total}** résultats découverts\n\n${lignes || '*Aucun résultat.*'}`)
        .setFooter({ text: `Page ${safePage + 1}/${totalPages} • Catégorie : ${safeCat}` });

    const rowCats = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`rlt_dex:${cible.id}:all:0:${uid}:${hubFlag}`).setLabel('Tout').setStyle(safeCat === 'all' ? ButtonStyle.Primary : ButtonStyle.Secondary).setDisabled(safeCat === 'all'),
        new ButtonBuilder().setCustomId(`rlt_dex:${cible.id}:bonus:0:${uid}:${hubFlag}`).setLabel('Bonus').setEmoji('🎉').setStyle(safeCat === 'bonus' ? ButtonStyle.Success : ButtonStyle.Secondary).setDisabled(safeCat === 'bonus'),
        new ButtonBuilder().setCustomId(`rlt_dex:${cible.id}:malus:0:${uid}:${hubFlag}`).setLabel('Malus').setEmoji('💀').setStyle(safeCat === 'malus' ? ButtonStyle.Danger : ButtonStyle.Secondary).setDisabled(safeCat === 'malus'),
        new ButtonBuilder().setCustomId(`rlt_dex:${cible.id}:special:0:${uid}:${hubFlag}`).setLabel('Spéciaux & TCG').setEmoji('✨').setStyle(safeCat === 'special' ? ButtonStyle.Primary : ButtonStyle.Secondary).setDisabled(safeCat === 'special')
    );

    const rowNav = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`rlt_dex:${cible.id}:${safeCat}:${safePage - 1}:${uid}:${hubFlag}:prev`).setLabel('⬅️').setStyle(ButtonStyle.Secondary).setDisabled(safePage === 0),
        new ButtonBuilder().setCustomId(`rlt_dex:${cible.id}:${safeCat}:${safePage + 1}:${uid}:${hubFlag}:next`).setLabel('➡️').setStyle(ButtonStyle.Secondary).setDisabled(safePage >= totalPages - 1),
        new ButtonBuilder().setCustomId(`rlt_stats_back_${cible.id}_${uid}_${hubFlag}`).setLabel('↩️ Stats').setStyle(ButtonStyle.Primary),
        buildRouletteAccueilButton(uid),
        buildRouletteCloseButton(uid)
    );

    return { embeds: [embed], components: [rowCats, rowNav], files: [], attachments: [] };
}

async function renderRouletteStatsCanvas(cible) {
    const W = 1600, H = 900;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    await drawRouletteBg(ctx, W, H);

    const stats = rouletteStats.get(cible.id) ?? { tirages: 0, bonus: 0, malus: 0, rien: 0, plusGrosGain: null, pireSerie: 0 };
    const userAchs = rouletteAchievements.get(cible.id) ?? {};
    const debl = Object.keys(userAchs).filter(id => ROULETTE_ACHIEVEMENTS.some(a => a.id === id)).length;
    const totalAchs = ROULETTE_ACHIEVEMENTS.length;
    const pity = roulettePity.get(cible.id) ?? { malus: 0, nuls: 0 };
    const jackpotBoost = Math.round((rouletteJackpotBonus.get(cible.id) || 0) * 100);
    const jackpotMaxPct = Math.round(ROULETTE_JACKPOT_MAX * 100);
    const isAddict = stats.tirages >= ROULETTE_ADDICT_SEUIL;

    // Header
    drawGlassPanel(ctx, 48, 36, W - 96, 150, 24, 'rgba(12, 15, 26, 0.85)', 'rgba(255, 210, 10, 0.5)', 2.5);
    await drawCircularAvatar(ctx, cible, 130, 111, 52, isAddict ? '#FF6B00' : '#FFD20A');

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#FFD20A';
    ctx.font = 'bold 20px "LemonMilk", "Sans"';
    ctx.fillText('STATISTIQUES ROULETTE', 210, 76);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 40px "LemonMilk", "Sans"';
    ctx.fillText(formatRouletteDisplayName(cible), 210, 126, 780);

    drawGlassPanel(ctx, W - 410, 68, 330, 86, 18, 'rgba(255, 210, 10, 0.14)', '#FFD20A', 2);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = 'bold 17px "LemonMilk", "Sans"';
    ctx.fillText('SUCCÈS DÉBLOQUÉS', W - 245, 92);
    ctx.fillStyle = '#FFD20A';
    ctx.font = 'bold 32px "LemonMilk", "Sans"';
    ctx.fillText(`${debl} / ${totalAchs}`, W - 245, 130);

    // 4 KPI Cards
    const kpis = [
        { label: 'TIRAGES TOTAUX', val: `${stats.tirages}`, color: '#FFD20A', bg: 'rgba(30, 26, 14, 0.82)' },
        { label: 'BONUS GAGNÉS', val: `${stats.bonus}`, color: '#2ECC71', bg: 'rgba(12, 28, 18, 0.82)' },
        { label: 'MALUS SUBIS', val: `${stats.malus}`, color: '#FF5C5C', bg: 'rgba(30, 12, 16, 0.82)' },
        { label: 'RIEN DU TOUT', val: `${stats.rien}`, color: '#74C0FC', bg: 'rgba(14, 22, 34, 0.82)' }
    ];
    const cardW = 356, gap = 26;
    kpis.forEach((k, i) => {
        const kx = 48 + i * (cardW + gap);
        drawGlassPanel(ctx, kx, 216, cardW, 180, 22, k.bg, k.color, 2);
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,255,255,0.72)';
        ctx.font = 'bold 20px "LemonMilk", "Sans"';
        ctx.fillText(k.label, kx + cardW / 2, 262);
        ctx.fillStyle = k.color;
        ctx.font = 'bold 58px "LemonMilk", "Sans"';
        ctx.fillText(k.val, kx + cardW / 2, 336);
    });

    // Barre ratio Bonus / Malus / Rien
    const total = Math.max(1, stats.bonus + stats.malus + stats.rien);
    const pctB = Math.round((stats.bonus / total) * 100);
    const pctM = Math.round((stats.malus / total) * 100);
    const pctR = Math.max(0, 100 - pctB - pctM);
    drawGlassPanel(ctx, 48, 424, W - 96, 100, 20, 'rgba(12, 15, 26, 0.84)', 'rgba(255, 255, 255, 0.2)', 2);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 18px "LemonMilk", "Sans"';
    ctx.fillText(`RÉPARTITION :   ${pctB}% BONUS   •   ${pctM}% MALUS   •   ${pctR}% RIEN`, 82, 454);

    const bx = 82, by = 478, bw = W - 164, bh = 24;
    const wB = Math.round((bw * stats.bonus) / total);
    const wM = Math.round((bw * stats.malus) / total);
    const wR = Math.max(0, bw - wB - wM);
    ctx.fillStyle = '#2ECC71';
    if (wB > 0) ctx.fillRect(bx, by, wB, bh);
    ctx.fillStyle = '#FF5C5C';
    if (wM > 0) ctx.fillRect(bx + wB, by, wM, bh);
    ctx.fillStyle = '#74C0FC';
    if (wR > 0) ctx.fillRect(bx + wB + wM, by, wR, bh);

    // Bas : Plus gros gain + Pire série & Jauges Pity/Jackpot
    const botY = 552, botH = 304;
    drawGlassPanel(ctx, 48, botY, 920, botH, 22, 'rgba(14, 17, 30, 0.84)', 'rgba(255, 210, 10, 0.48)', 2);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#FFD20A';
    ctx.font = 'bold 22px "LemonMilk", "Sans"';
    ctx.fillText('PLUS GROS GAIN OBTENU', 86, botY + 52);

    const gainNom = stats.plusGrosGain ? cleanCanvasText(stats.plusGrosGain.nom) : 'Aucun bonus obtenu';
    const gainProba = stats.plusGrosGain ? `Chance : 1/${probaAffichee(stats.plusGrosGain.proba).n} (${probaAffichee(stats.plusGrosGain.proba).pct}%)` : 'Tente ta chance avec !rlt go !';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 34px "LemonMilk", "Sans"';
    ctx.fillText(gainNom, 86, botY + 138, 840);
    ctx.fillStyle = '#2ECC71';
    ctx.font = 'bold 24px "LemonMilk", "Sans"';
    ctx.fillText(gainProba, 86, botY + 216, 840);

    drawGlassPanel(ctx, 996, botY, 556, botH, 22, 'rgba(14, 17, 30, 0.84)', 'rgba(255, 92, 92, 0.45)', 2);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#FF5C5C';
    ctx.font = 'bold 22px "LemonMilk", "Sans"';
    ctx.fillText('PIRE SÉRIE & PITY', 1030, botY + 42);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 18px "LemonMilk", "Sans"';
    ctx.fillText(`Pire série : ${stats.pireSerie || 0} malus/rien d'affilée`, 1030, botY + 78, 488);

    const gauges = [
        { label: 'PITY MALUS', val: pity.malus, max: ROULETTE_PITY_MALUS, valTxt: `${pity.malus}/${ROULETTE_PITY_MALUS}`, color: '#FF5C5C', y: botY + 114 },
        { label: 'PITY NULS', val: pity.nuls, max: ROULETTE_PITY_NULS, valTxt: `${pity.nuls}/${ROULETTE_PITY_NULS}`, color: '#74C0FC', y: botY + 176 },
        { label: 'JACKPOT CUMULÉ', val: jackpotBoost, max: jackpotMaxPct, valTxt: `+${jackpotBoost}% / +${jackpotMaxPct}%`, color: '#FFD20A', y: botY + 238 }
    ];
    for (const g of gauges) {
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(255,255,255,0.78)';
        ctx.font = 'bold 15px "LemonMilk", "Sans"';
        ctx.fillText(g.label, 1030, g.y);

        ctx.textAlign = 'right';
        ctx.fillStyle = g.color;
        ctx.fillText(g.valTxt, 1518, g.y);

        const gBarW = 488, gBarH = 14, gBarY = g.y + 14;
        drawGlassPanel(ctx, 1030, gBarY, gBarW, gBarH, 7, 'rgba(255,255,255,0.12)', 'rgba(255,255,255,0.18)', 1);
        const ratioG = g.max > 0 ? Math.max(0, Math.min(1, g.val / g.max)) : 0;
        if (ratioG > 0) {
            drawRoundRect(ctx, 1032, gBarY + 2, Math.max(10, Math.round((gBarW - 4) * ratioG)), gBarH - 4, 5);
            ctx.fillStyle = g.color;
            ctx.fill();
        }
    }

    return canvas.toBuffer('image/jpeg', { quality: 0.92 });
}

async function buildRouletteStatsPayload(cible, authorId = null, viewMode = 'img', fromHub = false) {
    const uid = authorId || cible.id;
    const isImg = viewMode !== 'txt';
    const currentView = isImg ? 'img' : 'txt';
    const nextView = isImg ? 'txt' : 'img';
    const hubFlag = fromHub ? '1' : '0';

    const rowBtns = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`rlt_view:stats:${cible.id}:${nextView}:${uid}:${hubFlag}`)
            .setLabel(isImg ? 'Version imagée' : 'Version texte')
            .setEmoji(isImg ? '🖼️' : '📝')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`rlt_achs_${cible.id}_0_${uid}_${currentView}_${hubFlag}`)
            .setLabel('Succès')
            .setEmoji('🎖️')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`rlt_dex:${cible.id}:all:0:${uid}:${hubFlag}`)
            .setLabel('Roulettodex')
            .setEmoji('📖')
            .setStyle(ButtonStyle.Secondary),
        buildRouletteAccueilButton(uid),
        buildRouletteCloseButton(uid)
    );

    const selectMenu = buildMenuChoixMembreRoulette(cible.guild, uid, `rlt_inspect_stats_${uid}_${currentView}_${hubFlag}`, '🔍 Inspecter un autre membre...');
    const components = [rowBtns];
    if (selectMenu) components.push(new ActionRowBuilder().addComponents(selectMenu));

    if (!isImg) {
        return { embeds: [buildRouletteStatsEmbed(cible)], components, files: [] };
    }

    const dex = getRoulettodexInfo(cible.id);
    const buf = await renderRouletteStatsCanvas(cible);
    const att = new AttachmentBuilder(buf, { name: 'rlt_stats.jpg' });
    const embed = new EmbedBuilder()
        .setColor(0xffd20a)
        .setTitle(`📊 Stats Roulette — ${cible.displayName}`)
        .setImage('attachment://rlt_stats.jpg')
        .setFooter({ text: `📖 Roulettodex : ${dex.count}/${dex.total} résultats découverts (${dex.pct}%)` });
    return { embeds: [embed], components, files: [att] };
}

function updateRouletteStats(userId, outcomeId, entry, client) {
    const stats = rouletteStats.get(userId) ?? { tirages: 0, bonus: 0, malus: 0, rien: 0, plusGrosGain: null, serieActuelle: 0, pireSerie: 0 };
    stats.tirages++;
    if (client) {
        const salon = client.channels.cache.get(ROULETTE_SALON_ID);
        if (stats.tirages >= 250) deverrouillerSucces(userId, 'veteran-250', salon);
        if (stats.tirages >= 500) deverrouillerSucces(userId, 'centurion-500', salon);
    }
    if (entry?.type === 'bonus') {
        stats.bonus++;
        stats.serieActuelle = 0;
        const proba = probaReelle(entry);
        if (!stats.plusGrosGain || proba < stats.plusGrosGain.proba) stats.plusGrosGain = { nom: entry.nom, proba };
    } else if (entry?.type === 'malus') {
        stats.malus++;
        stats.serieActuelle++;
        stats.pireSerie = Math.max(stats.pireSerie, stats.serieActuelle);
    } else if (outcomeId === 'aucun-resultat') {
        stats.rien++;
        stats.serieActuelle++;
        stats.pireSerie = Math.max(stats.pireSerie, stats.serieActuelle);
    }
    rouletteStats.set(userId, stats);

    if (outcomeId && outcomeId !== 'aucun-resultat' && entry) {
        let dex = rouletteDiscovered.get(userId);
        if (!Array.isArray(dex)) dex = [];
        if (!dex.includes(outcomeId)) {
            dex.push(outcomeId);
            rouletteDiscovered.set(userId, dex);
        }
        if (client && getRoulettodexInfo(userId).count >= 25) {
            const salon = client.channels.cache.get(ROULETTE_SALON_ID);
            deverrouillerSuccesSecret(userId, 'secret-kamikaze', salon);
        }
    }

    // Maintien de l'historique des 3 derniers tirages
    if (client) {
        const guild = client.guilds.cache.get('720057528351850547') || client.guilds.cache.first();
        const membreObj = guild?.members.cache.get(userId);
        const nomAuteur = membreObj?.displayName || 'Membre';
        let labelGain = '💨 Rien';
        if (entry?.nom) {
            const emoji = ROULETTE_EMOJIS_PAR_ID[entry.id] || (entry.type === 'bonus' ? '🎉' : '💀');
            labelGain = `${emoji} ${entry.nom}`;
        }
        const hist = [...getRouletteHistorique()];
        hist.unshift({ nom: nomAuteur, gain: labelGain });
        while (hist.length > 3) hist.pop();
        rouletteHistoriqueDerniersTirages.splice(0, rouletteHistoriqueDerniersTirages.length, ...hist);
        rouletteServerState.set('historique', hist);
    }
}

async function verifierRoleGamblingAddict(membre) {
    if (!membre) return;
    const stats = rouletteStats.get(membre.id);
    if (!stats || stats.tirages < ROULETTE_ADDICT_SEUIL) return;
    if (membre.roles.cache.has(ROULETTE_ROLE_ADDICT_ID)) return;
    await membre.roles.add(ROULETTE_ROLE_ADDICT_ID, `Gambling addict : ${stats.tirages} rolls`).catch(() => {});
}

async function renderRouletteCollectorPosterCanvas(membre, entry, lanceur = null, estPartage = false, isHof = true, isTest = false) {
    const W = 1600, H = 900;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    await drawRouletteBg(ctx, W, H, 0.24);

    const accent = isHof ? '#FFD20A' : '#E03131';
    const radial = ctx.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, W * 0.72);
    radial.addColorStop(0, isHof ? 'rgba(255, 210, 10, 0.08)' : 'rgba(224, 49, 49, 0.10)');
    radial.addColorStop(1, isHof ? 'rgba(18, 13, 4, 0.34)' : 'rgba(24, 5, 8, 0.38)');
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, W, H);

    // Cadre collector léger pour laisser apparaître Background.png derrière
    drawGlassPanel(ctx, 52, 44, W - 104, H - 88, 28, isHof ? 'rgba(10, 12, 22, 0.34)' : 'rgba(16, 8, 12, 0.36)', accent, 4);

    // Bannière supérieure + étoiles / emblèmes de chaque côté
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillStyle = accent;
    ctx.font = 'bold 28px "LemonMilk", "Sans"';
    const bannerTxt = `${isTest ? '[TEST] ' : ''}${isHof ? 'HALL OF FAME DE LA ROULETTE' : 'HALL OF SHAME DE LA ROULETTE'}`;
    ctx.fillText(bannerTxt, W / 2, 106);

    const bannerHalfW = ctx.measureText(bannerTxt).width / 2;
    if (isHof) {
        drawFivePointStar(ctx, W / 2 - bannerHalfW - 34, 105, 16, 7, '#FFD20A', '#FFD20A');
        drawFivePointStar(ctx, W / 2 + bannerHalfW + 34, 105, 16, 7, '#FFD20A', '#FFD20A');
    } else {
        drawShameEmblem(ctx, W / 2 - bannerHalfW - 34, 105, 14, '#E03131');
        drawShameEmblem(ctx, W / 2 + bannerHalfW + 34, 105, 14, '#E03131');
    }

    const estRedirige = lanceur && membre && lanceur.id !== membre.id;
    let sousTitre = isHof ? 'EXPLOIT ULTRA RARE DÉCROCHÉ' : 'MALUS LÉGENDAIRE SUBI';
    if (isHof && estPartage) sousTitre = `EXPLOIT PARTAGÉ PAR ${formatRouletteDisplayName(lanceur)}`;
    else if (isHof && estRedirige) sousTitre = `CADEAU OFFERT PAR ${formatRouletteDisplayName(lanceur)}`;
    else if (!isHof && estRedirige) sousTitre = `VICTIME PAR RICOCHET (${formatRouletteDisplayName(lanceur)})`;

    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.font = 'bold 20px "LemonMilk", "Sans"';
    ctx.fillText(sousTitre, W / 2, 148, W - 200);

    // Avatar central avec lueur dorée (HoF) ou rouge (HoS)
    await drawCircularAvatar(ctx, membre, W / 2, 304, 106, accent, accent);

    const nom = formatRouletteDisplayName(membre);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 46px "LemonMilk", "Sans"';
    ctx.fillText(nom, W / 2, 456, W - 220);

    // Carte résultat centrée verticalement entre le pseudo (456) et le pied de page (804)
    const boxY = 544;
    const boxH = 190;
    drawGlassPanel(ctx, 180, boxY, W - 360, boxH, 22, isHof ? 'rgba(255, 210, 10, 0.14)' : 'rgba(224, 49, 49, 0.16)', accent, 2.5);
    ctx.fillStyle = accent;
    ctx.font = 'bold 38px "LemonMilk", "Sans"';
    ctx.fillText(cleanCanvasText(entry.nom), W / 2, boxY + 72, W - 420);

    const { n, pct } = probaAffichee(probaReelle(entry));
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px "LemonMilk", "Sans"';
    ctx.fillText(`RARETÉ : 1 SUR ${n} (${pct}%)`, W / 2, boxY + 138);

    ctx.fillStyle = 'rgba(255,255,255,0.62)';
    ctx.font = 'bold 18px "LemonMilk", "Sans"';
    ctx.fillText(`REGAÏA • ${new Date().toLocaleDateString('fr-FR')}`, W / 2, 804);

    return canvas.toBuffer('image/jpeg', { quality: 0.94 });
}

async function buildHallOfFamePayload(membre, entry, lanceur = null, estPartage = false, isTest = false) {
    const { n, pct } = probaAffichee(probaReelle(entry));
    const nom = membre?.displayName ?? membre?.user?.username ?? 'Un·e membre';
    const emoji = ROULETTE_EMOJIS_PAR_ID[entry.id] ?? '🏆';
    const estRedirige = lanceur && lanceur.id !== membre.id;

    let titre = isTest ? '🏆 [TEST] NOUVEL EXPLOIT AU PANTHÉON !' : '🏆 NOUVEL EXPLOIT AU PANTHÉON !';
    let description = "Le destin a parlé ! Un bonus ultra rare vient d'être décroché sur la roulette !";
    let messageContent = isTest
        ? `🧪 **[TEST HOF]** Aperçu pour <@${membre.id}> :`
        : `🎉 Félicitations à <@${membre.id}> pour ce coup de maître !`;

    if (estPartage) {
        titre = `${isTest ? '[TEST] ' : ''}🤝 EXPLOIT PARTAGÉ AU PANTHÉON !`;
        description = `<@${lanceur.id}> a décroché un bonus légendaire et a choisi de le partager avec <@${membre.id}> !`;
        if (!isTest) messageContent = `🤝 Un exploit d'une générosité rare : félicitations à <@${lanceur.id}> et <@${membre.id}> !`;
    } else if (estRedirige) {
        titre = `${isTest ? '[TEST] ' : ''}🎁 CADEAU LÉGENDAIRE AU PANTHÉON !`;
        description = `<@${lanceur.id}> a décroché un bonus légendaire et l'a offert à <@${membre.id}> !`;
        if (!isTest) messageContent = `🎁 Incroyable coup du destin : <@${lanceur.id}> a offert son bonus ultra rare à <@${membre.id}> !`;
    }

    const buf = await renderRouletteCollectorPosterCanvas(membre, entry, lanceur, estPartage, true, isTest);
    const att = new AttachmentBuilder(buf, { name: 'rlt_hof.jpg' });

    const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle(titre)
        .setDescription(
            `${description}\n\n` +
            `👤 **Bénéficiaire :** <@${membre.id}> (${nom})\n` +
            `${emoji} **Bonus obtenu :** **${entry.nom}**\n` +
            `🎲 **Chance de tirage :** **1/${n}** (${pct}%)`
        )
        .setImage('attachment://rlt_hof.jpg')
        .setFooter({ text: isTest ? 'Prévisualisation Test • Panthéon de la Roulette' : 'Panthéon de la Roulette • Regaïa' })
        .setTimestamp();

    return { content: messageContent, embeds: [embed], files: [att] };
}

async function buildHallOfShamePayload(membre, entry, lanceur = null, isTest = false) {
    const { n, pct } = probaAffichee(probaReelle(entry));
    const nom = membre?.displayName ?? membre?.user?.username ?? 'Un·e membre';
    const emoji = ROULETTE_EMOJIS_PAR_ID[entry.id] ?? '💀';
    const estRedirige = lanceur && lanceur.id !== membre.id;

    const titre = estRedirige
        ? `${isTest ? '[TEST] ' : ''}🎯 NOUVELLE VICTIME PAR RICOCHET ! (MALUS REDIRIGÉ)`
        : `${isTest ? '[TEST] ' : ''}💀 NOUVELLE VICTIME AU HALL OF SHAME !`;
    const description = estRedirige
        ? `Le destin s'est acharné par procuration ! <@${lanceur.id}> a tiré ce malus légendaire et l'a envoyé en pleine tête à <@${membre.id}> !`
        : `Le destin s'est acharné ! Un malus légendaire vient de s'abattre sur la roulette !`;
    const messageContent = isTest
        ? `🧪 **[TEST HOS]** Aperçu pour <@${membre.id}> :`
        : (estRedirige
            ? `🎯 Coup dur ! <@${lanceur.id}> a redirigé son malus légendaire droit sur <@${membre.id}>... (cheh)`
            : `💀 Toutes nos pensées vont à <@${membre.id}> qui vient de toucher le fond... (cheh)`);

    const buf = await renderRouletteCollectorPosterCanvas(membre, entry, lanceur, false, false, isTest);
    const att = new AttachmentBuilder(buf, { name: 'rlt_hos.jpg' });

    const embed = new EmbedBuilder()
        .setColor(0x9e0000)
        .setTitle(titre)
        .setDescription(
            `${description}\n\n` +
            `👤 **Victime :** <@${membre.id}> (${nom})\n` +
            `${emoji} **Malus subi :** **${entry.nom}**\n` +
            `🎲 **Malchance de tirage :** **1/${n}** (${pct}%)`
        )
        .setImage('attachment://rlt_hos.jpg')
        .setFooter({ text: isTest ? 'Prévisualisation Test • Panthéon de la Honte' : 'Panthéon de la Honte • Regaïa' })
        .setTimestamp();

    return { content: messageContent, embeds: [embed], files: [att] };
}

async function envoyerHallOfFame(guild, membre, entry, lanceur = null, estPartage = false) {
    if (!entry || entry.type !== 'bonus') return;
    const proba = probaReelle(entry);
    if (proba >= ROULETTE_HOF_SEUIL) return;

    const salon = guild.channels.cache.get(ROULETTE_HOF_CHANNEL_ID) ?? await guild.channels.fetch(ROULETTE_HOF_CHANNEL_ID).catch(() => null);
    if (!salon) return;

    const payload = await buildHallOfFamePayload(membre, entry, lanceur, estPartage, false);
    await salon.send({
        ...payload,
        flags: [MessageFlags.SuppressNotifications]
    }).catch(() => {});
}

async function envoyerHallOfShame(guild, membre, entry, lanceur = null) {
    if (!entry || entry.type !== 'malus') return;
    if (!ROULETTE_HOS_MALUS_IDS.has(entry.id)) return;

    const salon = guild.channels.cache.get(ROULETTE_HOS_CHANNEL_ID) ?? await guild.channels.fetch(ROULETTE_HOS_CHANNEL_ID).catch(() => null);
    if (!salon) return;

    const payload = await buildHallOfShamePayload(membre, entry, lanceur, false);
    await salon.send({
        ...payload,
        flags: [MessageFlags.SuppressNotifications]
    }).catch(() => {});
}

const ROULETTE_ROLE_JOUEUR_ID = '1558968669751615528';

function buildMenuChoixMembreRoulette(guild, authorId, customId, placeholder) {
    return new UserSelectMenuBuilder()
        .setCustomId(customId)
        .setPlaceholder(placeholder)
        .setMinValues(1)
        .setMaxValues(1);
}

function membresTop30Roulette(guild, authorId) {
    if (!guild?.members?.cache) return [];
    const estEligible = (m) => m && m.user && !m.user.bot && m.id !== authorId && m.roles?.cache?.has?.(ROULETTE_ROLE_JOUEUR_ID);

    const messages = bridge?.topData?.messages || {};
    const candidatsTop = Object.entries(messages)
        .sort((a, b) => (b[1] || 0) - (a[1] || 0))
        .map(([id]) => guild.members.cache.get(id))
        .filter(estEligible)
        .slice(0, 30);

    if (candidatsTop.length > 0) return candidatsTop;

    // Fallback : n'importe quel membre du serveur qui possède le rôle roulette
    const tousMembres = guild.members.cache.values ? Array.from(guild.members.cache.values()) : [];
    return tousMembres.filter(estEligible);
}

async function envoyerPingRedirection(channel, resultat) {
    const liste = Array.isArray(resultat.pingsCible)
        ? resultat.pingsCible
        : (resultat.pingCible ? [resultat.pingCible] : []);
    if (liste.length === 0) return;

    const { MessageFlags } = require('discord.js');
    const userIds = [...new Set(liste.map(p => p.id).filter(Boolean))];
    const contenu = liste.map(p => p.texte).join('\n').slice(0, 2000);
    await channel.send({
        content: contenu,
        flags: [MessageFlags.SuppressNotifications],
        allowedMentions: { users: userIds }
    }).catch(() => {});
}

function libelleProbaRoulette(outcomeId) {
    if (outcomeId === 'aucun-resultat') {
        const taux = getTauxEchecRoulette();
        if (taux <= 0) return '0%';
        const { n, pct } = probaAffichee(taux);
        return `1/${n} | ${pct}%`;
    }
    const entry = ROULETTE_TABLE.find(e => e.id === outcomeId);
    if (!entry) return null;
    const { n, pct } = probaAffichee(probaEffectiveRoulette(entry));
    return `1/${n} | ${pct}%`;
}

function formaterEchecRoulette(texte, cooldownMinutes) {
    if (cooldownMinutes === 0) {
        return texte
            .replace(/'Fin pas tout de suite mais dans 15 minutes/gi, "'Fin en fait tout de suite")
            .replace(/dans 15 minutes/gi, 'tout de suite')
            .replace(/dans 15min/gi, 'tout de suite');
    }
    const minsEntieres = Math.floor(cooldownMinutes);
    const secs = Math.round((cooldownMinutes - minsEntieres) * 60);
    const libelleMin = secs > 0
        ? `${minsEntieres} min ${secs}s`
        : `${minsEntieres} minute${minsEntieres > 1 ? 's' : ''}`;
    const libelleCourt = secs > 0 ? `${minsEntieres}m${secs}s` : `${minsEntieres}min`;
    return texte
        .replace(/15 minutes/gi, libelleMin)
        .replace(/15min/gi, libelleCourt);
}

function libelleProbaFooter(outcomeId) {
    if (outcomeId === 'aucun-resultat') {
        const taux = getTauxEchecRoulette();
        if (taux <= 0) return '0%';
        const { n, pct } = probaAffichee(taux);
        return `1/${n} (${pct}%)`;
    }
    const entry = ROULETTE_TABLE.find(e => e.id === outcomeId);
    if (!entry) return null;
    const { n, pct } = probaAffichee(probaEffectiveRoulette(entry));
    return `1/${n} (${pct}%)`;
}

function formaterCitationRoulette(rawTxt) {
    const lines = String(rawTxt || '').split('\n');
    const out = [];
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
            out.push('');
        } else if (trimmed.startsWith('>') || trimmed.startsWith('-#')) {
            out.push(line);
        } else {
            out.push(`> ${line}`);
        }
    }
    return out.join('\n');
}

function buildRouletteResultEmbed(outcomeId, texte, authorId = null, auteurNom = null, cooldownMinutes = null, gifOptions = {}) {
    const nowTs = Date.now();
    let minsEffectives = cooldownMinutes;
    if (minsEffectives === null) {
        const finFreeRoll = authorId ? rouletteFreeRollUntil.get(authorId) : null;
        const chargesTriple = authorId ? (rouletteCoupTripleCharges.get(authorId) || 0) : 0;
        if (authorId && (ROULETTE_COOLDOWN_EXEMPT.includes(authorId) || (finFreeRoll && nowTs < finFreeRoll) || chargesTriple > 0)) {
            minsEffectives = 0;
        } else if (authorId) {
            const finCd = rouletteCooldowns.get(authorId);
            if (finCd && finCd > nowTs) {
                minsEffectives = Math.max(1, Math.ceil((finCd - nowTs) / 60000));
            } else if ((rouletteCooldownCourtCharges.get(authorId) || 0) > 0 || estHappyHour()) {
                minsEffectives = 5;
            } else if ((rouletteLooongCooldownCharges.get(authorId) || 0) > 0) {
                minsEffectives = 60;
            } else if ((rouletteCooldown45Charges.get(authorId) || 0) > 0) {
                minsEffectives = 45;
            } else {
                minsEffectives = Math.round(ROULETTE_COOLDOWN_MS / 60000);
            }
        } else {
            minsEffectives = Math.round(ROULETTE_COOLDOWN_MS / 60000);
        }
    }

    const finCd = authorId ? rouletteCooldowns.get(authorId) : null;
    const enFreeRoll = Boolean(authorId && (rouletteFreeRollUntil.get(authorId) || 0) > nowTs);
    const chargesTripleRestantes = gifOptions?.resteChargesTriple !== undefined
        ? gifOptions.resteChargesTriple
        : (authorId ? (rouletteCoupTripleCharges.get(authorId) || 0) : 0);

    let subContexte = '';
    if (gifOptions?.ticketSkipUsed) {
        subContexte = `-# 🎟️ Ticket coupe-file utilisé`;
    } else if (gifOptions?.freeRollUsed) {
        const finFr = rouletteFreeRollUntil.get(authorId);
        subContexte = finFr ? `-# ⚡ Tirage à volonté (1 min) activé (fin <t:${Math.ceil(finFr / 1000)}:R>)` : `-# ⚡ Tirage à volonté (1 min) activé`;
    } else if (chargesTripleRestantes > 0) {
        subContexte = `-# ⚡ Coup Triple (${chargesTripleRestantes} tirage${chargesTripleRestantes > 1 ? 's' : ''} gratuit${chargesTripleRestantes > 1 ? 's' : ''} restant${chargesTripleRestantes > 1 ? 's' : ''})`;
    } else if (enFreeRoll) {
        const finFr = rouletteFreeRollUntil.get(authorId);
        subContexte = finFr ? `-# ⚡ Tirage à volonté actif (fin <t:${Math.ceil(finFr / 1000)}:R>)` : `-# ⚡ Tirage à volonté actif`;
    } else if (minsEffectives === 0) {
        subContexte = outcomeId === 'aucun-resultat' ? `-# ⚡ Prochain tirage disponible immédiatement !` : '';
    } else if (finCd && finCd > nowTs) {
        const isSpecialCd = outcomeId === 'aucun-resultat' || estHappyHour() || minsEffectives !== Math.round(ROULETTE_COOLDOWN_MS / 60000);
        if (isSpecialCd) {
            subContexte = `-# ⏳ Prochain tirage <t:${Math.ceil(finCd / 1000)}:R>${estHappyHour() ? ' • 🔥 Happy Hour' : ''}`;
        }
    } else if (outcomeId === 'aucun-resultat') {
        subContexte = `-# ⏳ Prochain tirage dans ${minsEffectives} minute${minsEffectives > 1 ? 's' : ''}`;
    }

    let texteFinal = texte;
    if (outcomeId === 'aucun-resultat') {
        const texteAjuste = formaterEchecRoulette(texte, minsEffectives);
        texteFinal = `> *« ${texteAjuste} »*`;
        if (subContexte) texteFinal += `\n\n${subContexte}`;
    } else {
        texteFinal = formaterCitationRoulette(texte);
        if (subContexte) texteFinal += `\n${subContexte}`;
    }

    const estContrePoison = texte.includes('Miracle !');
    const entry = ROULETTE_TABLE.find(e => e.id === outcomeId);
    const estHof = Boolean(entry && entry.type === 'bonus' && probaReelle(entry) < ROULETTE_HOF_SEUIL);
    const estHos = Boolean(entry && entry.type === 'malus' && ROULETTE_HOS_MALUS_IDS.has(outcomeId));
    const estBonusRare = Boolean(entry && entry.type === 'bonus' && !entry.tcgOnly && !estHof && probaReelle(entry) <= 0.005);
    const estBonusTcg = Boolean(entry && entry.type === 'bonus' && entry.tcgOnly && !estHof);

    const couleur = gifOptions?.shieldBlocked ? 0x3498db :
        estContrePoison ? 0x2ecc71 :
        outcomeId === 'aucun-resultat' ? 0x546e7a :
        estHof ? 0xffd700 :
        estBonusTcg ? 0xf1c40f :
        estBonusRare ? 0x9b59b6 :
        entry?.type === 'bonus' ? 0x2ecc71 :
        estHos ? 0x8b0000 :
        entry?.type === 'malus' ? 0xc0392b :
        entry?.type === 'special' ? 0xdb6600 : 0x99aab5;

    const emojiOutcome = ROULETTE_EMOJIS_PAR_ID[outcomeId]
        || (entry?.type === 'bonus' ? '🎉' : entry?.type === 'malus' ? '💀' : '✨');
    const prefixeType = entry?.tcgOnly
        ? 'BONUS TCG'
        : entry?.type === 'bonus'
            ? 'BONUS'
            : entry?.type === 'malus'
                ? 'MALUS'
                : 'SPÉCIAL';

    const titre = gifOptions?.shieldBlocked
        ? `🛡️ BOUCLIER — ${entry?.nom ?? 'Malus'} paré !`
        : estContrePoison
            ? `✨ CONTRE-POISON — ${entry?.nom ?? 'Malus'} annulé !`
            : outcomeId === 'aucun-resultat'
                ? `💨 AUCUN RÉSULTAT`
                : entry
                    ? `${emojiOutcome} ${prefixeType} — ${entry.nom}`
                    : null;

    const embed = new EmbedBuilder().setColor(couleur).setDescription(texteFinal);
    if (titre) embed.setTitle(titre);

    const cl = rouletteClient || bridge?.client;
    const guildObj = gifOptions?.guild || cl?.guilds?.cache?.get('720057528351850547') || cl?.guilds?.cache?.first();
    const memberObj = authorId ? guildObj?.members?.cache?.get(authorId) : null;
    const userObj = memberObj?.user || (authorId ? cl?.users?.cache?.get(authorId) : null);
    const avatarUrl = gifOptions?.avatarUrl
        || memberObj?.displayAvatarURL?.({ dynamic: true })
        || userObj?.displayAvatarURL?.({ dynamic: true })
        || undefined;

    if (auteurNom) {
        let authorText = `${auteurNom} • Tirage Roulette`;
        if (gifOptions?.shieldBlocked) {
            authorText = `🛡️ MALUS PARÉ • ${auteurNom}`;
        } else if (estContrePoison) {
            authorText = `✨ CONTRE-POISON • ${auteurNom}`;
        } else if (estHof) {
            authorText = `🏆 EXPLOIT HALL OF FAME • ${auteurNom}`;
        } else if (estHos) {
            authorText = `💀 HALL OF SHAME • ${auteurNom}`;
        } else if (gifOptions?.pityActive && entry?.type === 'bonus') {
            authorText = `🍀 PITY ACTIVE • ${auteurNom}`;
        }
        embed.setAuthor({ name: authorText, iconURL: avatarUrl });
    }

    const probaFooter = libelleProbaFooter(outcomeId);
    const rawB = authorId ? rouletteBouclierActif.get(authorId) : 0;
    const nbBoucliers = typeof rawB === 'number' ? rawB : (rawB ? 1 : 0);
    const pityAct = (authorId && roulettePity.get(authorId)) || { malus: 0, nuls: 0 };
    const jBase = authorId ? (rouletteJackpotBonus.get(authorId) || 0) : 0;
    const jBoostCh = authorId ? (rouletteJackpotBoostCharges.get(authorId) || 0) : 0;
    const jBoostVal = jBoostCh > 0 ? (rouletteJackpotBoostValue.get(authorId) || 0.25) : 0;
    const jAnniv = (authorId && guildObj?.id && bridge.estAnniversaireAujourdhui(guildObj.id, authorId)) ? 0.50 : 0;
    const tauxBonusPct = Math.round((jBase + jBoostVal + jAnniv) * 100);

    const footerParts = [];
    if (probaFooter) footerParts.push(`🎲 Probabilités - ${probaFooter}`);
    if (outcomeId === 'aucun-resultat') {
        footerParts.push(`💨 Pity "Nuls" ${pityAct.nuls}/${ROULETTE_PITY_NULS}`);
    } else if (outcomeId.startsWith('malus-') && !gifOptions?.shieldBlocked && !estContrePoison && nbBoucliers === 0) {
        footerParts.push(`💀 Pity "Malus" ${pityAct.malus}/${ROULETTE_PITY_MALUS}`);
    } else {
        footerParts.push(`🛡️ ${nbBoucliers} bouclier(s) restants`);
    }
    footerParts.push(`📈 Taux de bonus +${tauxBonusPct}%`);
    if (authorId && (rouletteDiviseurUntil.get(authorId) || 0) > nowTs && !estHappyHour()) {
        footerParts.push('➗ Diviseur /2');
    }
    if (estRouletteMauditeDoree()) {
        footerParts.push('🌘 Roulette Maudite/Dorée');
    }
    embed.setFooter({ text: footerParts.join(' • ') });

    const gifInfo = getRouletteGifForOutcome(outcomeId, texteFinal, gifOptions);
    if (gifInfo && fs.existsSync(path.join(ROULETTE_GIFS_DIR, gifInfo.file))) {
        embed.setThumbnail(`attachment://${gifInfo.name}`);
    }
    return embed;
}

function buildRoulettePaytableEmbed(category = 'all') {
    const maudite = estRouletteMauditeDoree();
    const sectionFilter = (titre, pred) => {
        const lignes = ROULETTE_TABLE
            .filter(pred)
            .sort((a, b) => b.poids - a.poids)
            .map(e => {
                const { n, pct } = probaAffichee(probaEffectiveRoulette(e));
                const emoji = ROULETTE_EMOJIS_PAR_ID[e.id] ? `${ROULETTE_EMOJIS_PAR_ID[e.id]} ` : '';
                return `**1/${n}** (${pct}%) — ${emoji}${e.nom}`;
            });
        return lignes.length ? `**${titre} :**\n${lignes.join('\n')}` : null;
    };

    if (category === 'bonus') {
        return new EmbedBuilder()
            .setColor(0x00bf19)
            .setTitle('🎉 Probabilités — Bonus')
            .setDescription(sectionFilter('🎉 BONUS CLASSIQUES & RARES', e => e.type === 'bonus' && !e.tcgOnly) || '*Aucun.*');
    }
    if (category === 'malus') {
        return new EmbedBuilder()
            .setColor(0x9e0000)
            .setTitle('💀 Probabilités — Malus')
            .setDescription(sectionFilter('💀 MALUS', e => e.type === 'malus') || '*Aucun.*');
    }
    if (category === 'special') {
        return new EmbedBuilder()
            .setColor(0xdb6600)
            .setTitle('✨ Probabilités — Spéciaux & RegaDex TCG')
            .setDescription([
                sectionFilter('🗳️ SPÉCIAL', e => e.type === 'special'),
                sectionFilter('🃏 REGADEX TCG (Rôle Collectionneur.euse requis)', e => Boolean(e.tcgOnly))
            ].filter(Boolean).join('\n\n'));
    }
    if (category === 'ultrarares') {
        return new EmbedBuilder()
            .setColor(0x9b59b6)
            .setTitle('💎 Probabilités — Ultra-Rares (HoF & HoS)')
            .setDescription([
                sectionFilter('🏆 HALL OF FAME (Bonus ≤ 0,05%)', e => e.type === 'bonus' && probaReelle(e) < ROULETTE_HOF_SEUIL),
                sectionFilter('✨ AUTRES ULTRA-RARES (< 1/500)', e => e.type === 'bonus' && probaReelle(e) >= ROULETTE_HOF_SEUIL && probaReelle(e) < 0.002),
                sectionFilter('💀 HALL OF SHAME (Pires Malus)', e => e.type === 'malus' && ROULETTE_HOS_MALUS_IDS.has(e.id))
            ].filter(Boolean).join('\n\n') || '*Aucun.*');
    }
    if (category === 'pity') {
        return new EmbedBuilder()
            .setColor(maudite ? 0x9b59b6 : 0xffd20a)
            .setTitle('🍀 Probabilités — Rien, Pity & Règles')
            .setDescription(
                (maudite ? `🌘 **ÉVÉNEMENT ROULETTE MAUDITE / DORÉE EN COURS !** *(0% Rien jusqu'à 20h00)*\n\n` : '') +
                `**😶 RIEN :**\n${maudite ? '**0%** — Désactivé pendant l\'événement du dimanche !' : '**1/2** (~50%) — Aucun effet (cooldown normal)'}\n\n` +
                `**🍀 SYSTÈME DE PITY :**\nAprès **${ROULETTE_PITY_MALUS} malus** ou **${ROULETTE_PITY_NULS} résultats nuls** consécutifs, un **bonus est garanti** au tirage suivant.\n\n` +
                `**🌘 ROULETTE MAUDITE / DORÉE :**\n• Tous les **dimanches 16h30–20h00** : **0% Rien** *(100% Bonus ou Malus, les ultra-rares restent rares)*.\n\n` +
                `**🔥 HAPPY HOUR & JACKPOT :**\n• Tous les soirs **20h–21h** : cooldown à **5 min** pour tout le monde.\n` +
                `• Chaque tirage sans bonus augmente ton **Jackpot personnel** (+1% par tirage jusqu'à +50%).`
            );
    }

    return new EmbedBuilder()
        .setColor(0xffd20a)
        .setTitle('🎰 Probabilités de la Roulette')
        .setDescription([
            sectionFilter('🎉 BONUS', e => e.type === 'bonus' && !e.tcgOnly),
            sectionFilter('💀 MALUS', e => e.type === 'malus'),
            sectionFilter('🗳️ SPÉCIAL', e => e.type === 'special'),
            sectionFilter('🃏 REGADEX TCG (Rôle Collectionneur.euse requis)', e => Boolean(e.tcgOnly)),
            '**😶 RIEN :**\n**1/2** (~50%) — Rien du tout',
            `**🍀 PITY :**\nAprès ${ROULETTE_PITY_MALUS} malus ou ${ROULETTE_PITY_NULS} résultats nuls, bonus garanti.`
        ].filter(Boolean).join('\n\n'));
}

function buildRoulettePaytablePayload(category = 'bonus', ctx = 'pres', authorId, outcomeId = '', failIndex = '0') {
    const safeCat = ['bonus', 'malus', 'special', 'ultrarares', 'pity'].includes(category) ? category : 'bonus';
    const embed = buildRoulettePaytableEmbed(safeCat);
    const suffix = ctx === 'res' ? `:${outcomeId}:${failIndex}` : '';

    const rowTabs = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`rlt_probas:${ctx}:bonus:${authorId}${suffix}`).setLabel('Bonus').setEmoji('🎉').setStyle(safeCat === 'bonus' ? ButtonStyle.Success : ButtonStyle.Secondary).setDisabled(safeCat === 'bonus'),
        new ButtonBuilder().setCustomId(`rlt_probas:${ctx}:malus:${authorId}${suffix}`).setLabel('Malus').setEmoji('💀').setStyle(safeCat === 'malus' ? ButtonStyle.Danger : ButtonStyle.Secondary).setDisabled(safeCat === 'malus'),
        new ButtonBuilder().setCustomId(`rlt_probas:${ctx}:special:${authorId}${suffix}`).setLabel('Spéciaux & TCG').setEmoji('✨').setStyle(safeCat === 'special' ? ButtonStyle.Primary : ButtonStyle.Secondary).setDisabled(safeCat === 'special'),
        new ButtonBuilder().setCustomId(`rlt_probas:${ctx}:ultrarares:${authorId}${suffix}`).setLabel('Ultra-Rares').setEmoji('💎').setStyle(safeCat === 'ultrarares' ? ButtonStyle.Primary : ButtonStyle.Secondary).setDisabled(safeCat === 'ultrarares'),
        new ButtonBuilder().setCustomId(`rlt_probas:${ctx}:pity:${authorId}${suffix}`).setLabel('Pity & Règles').setEmoji('🍀').setStyle(safeCat === 'pity' ? ButtonStyle.Primary : ButtonStyle.Secondary).setDisabled(safeCat === 'pity')
    );

    const rowNav = new ActionRowBuilder();
    if (ctx === 'res') {
        rowNav.addComponents(buildRouletteCloseButton(authorId));
    } else {
        rowNav.addComponents(
            buildRouletteAccueilButton(authorId),
            new ButtonBuilder().setCustomId(`roulette_tenter_${authorId}`).setLabel('Tenter sa chance').setEmoji('🍀').setStyle(ButtonStyle.Primary),
            buildRouletteCloseButton(authorId)
        );
    }

    return { embeds: [embed], components: [rowTabs, rowNav] };
}

function getRouletteTopEntries(guild, mode = 'succes') {
    const totalAchs = ROULETTE_ACHIEVEMENTS.length;
    if (mode === 'succes') {
        return [...rouletteAchievements.entries()]
            .map(([uid, achs]) => {
                const count = Object.keys(achs || {}).filter(id => ROULETTE_ACHIEVEMENTS.some(a => a.id === id)).length;
                return { uid, count, label: `${count}/${totalAchs} succès` };
            })
            .filter(e => e.count > 0)
            .sort((a, b) => b.count - a.count);
    }
    const fieldMap = { tirages: 'tirages', bonus: 'bonus', malus: 'malus' };
    const unitMap = { tirages: 'tirages', bonus: 'bonus', malus: 'malus' };
    const key = fieldMap[mode] || 'tirages';
    const unit = unitMap[mode] || 'tirages';

    return [...rouletteStats.entries()]
        .map(([uid, st]) => ({ uid, count: st?.[key] || 0, label: `${st?.[key] || 0} ${unit}` }))
        .filter(e => e.count > 0)
        .sort((a, b) => b.count - a.count);
}

async function renderRouletteTopCanvas(guild, entries, authorId, mode = 'succes') {
    const W = 1600, H = 900;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    await drawRouletteBg(ctx, W, H);

    const titles = {
        succes: 'PANTHÉON DES CHASSEURS DE SUCCÈS',
        tirages: 'CLASSEMENT DES PLUS GROS JOUEURS',
        bonus: 'CLASSEMENT DES CHANCEUX (BONUS)',
        malus: 'CLASSEMENT DES MAUDITS (MALUS)'
    };
    const colors = { succes: '#FFD20A', tirages: '#74C0FC', bonus: '#2ECC71', malus: '#FF5C5C' };
    const accent = colors[mode] || '#FFD20A';

    // Titre
    drawGlassPanel(ctx, 48, 28, W - 96, 86, 20, 'rgba(12, 15, 26, 0.86)', accent, 2.5);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillStyle = accent;
    ctx.font = 'bold 30px "LemonMilk", "Sans"';
    ctx.fillText(titles[mode] || titles.succes, W / 2, 71, W - 160);

    // Podium Top 3
    const podiumOrder = [
        { idx: 1, x: 100, y: 158, w: 420, h: 240, rank: '#2', ring: '#C0C0C0', avY: 66, rankY: 132, nameY: 168 },
        { idx: 0, x: 560, y: 132, w: 480, h: 266, rank: '#1', ring: '#FFD700', avY: 72, rankY: 142, nameY: 188 },
        { idx: 2, x: 1080, y: 168, w: 420, h: 230, rank: '#3', ring: '#CD7F32', avY: 66, rankY: 128, nameY: 160 }
    ];

    for (const pod of podiumOrder) {
        const entry = entries[pod.idx];
        drawGlassPanel(ctx, pod.x, pod.y, pod.w, pod.h, 22, 'rgba(14, 17, 30, 0.84)', pod.ring, pod.idx === 0 ? 3 : 2);
        const cx = pod.x + pod.w / 2;
        if (entry) {
            const m = guild?.members?.cache?.get(entry.uid);
            await drawCircularAvatar(ctx, m || null, cx, pod.y + pod.avY, pod.idx === 0 ? 48 : 40, pod.ring);
            ctx.fillStyle = pod.ring;
            ctx.font = 'bold 24px "LemonMilk", "Sans"';
            ctx.fillText(pod.rank, cx, pod.y + pod.rankY);
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 24px "LemonMilk", "Sans"';
            ctx.fillText(formatRouletteDisplayName(m || 'Ancien membre'), cx, pod.y + pod.nameY, pod.w - 40);
            ctx.fillStyle = accent;
            ctx.font = 'bold 20px "LemonMilk", "Sans"';
            ctx.fillText(cleanCanvasText(entry.label), cx, pod.y + pod.h - 26, pod.w - 40);
        } else {
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            ctx.font = 'bold 24px "LemonMilk", "Sans"';
            ctx.fillText(`${pod.rank} — Libre`, cx, pod.y + pod.h / 2);
        }
    }

    // Rangs #4 à #10 (2 colonnes)
    const rest = entries.slice(3, 10);
    for (let i = 0; i < 7; i++) {
        const e = rest[i];
        const col = i < 4 ? 0 : 1;
        const row = i < 4 ? i : i - 4;
        const rx = col === 0 ? 48 : 816;
        const ry = 422 + row * 86;
        const rw = 736, rh = 72;
        const isSelf = e?.uid === authorId;
        drawGlassPanel(ctx, rx, ry, rw, rh, 16, isSelf ? 'rgba(255, 210, 10, 0.18)' : 'rgba(12, 15, 26, 0.80)', isSelf ? '#FFD20A' : 'rgba(255,255,255,0.18)', isSelf ? 2.5 : 1.5);

        ctx.textAlign = 'left';
        ctx.fillStyle = accent;
        ctx.font = 'bold 24px "LemonMilk", "Sans"';
        ctx.fillText(`#${i + 4}`, rx + 24, ry + rh / 2);

        if (e) {
            const m = guild?.members?.cache?.get(e.uid);
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 22px "LemonMilk", "Sans"';
            ctx.fillText(formatRouletteDisplayName(m || 'Ancien membre'), rx + 92, ry + rh / 2, 390);
            ctx.textAlign = 'right';
            ctx.fillStyle = accent;
            ctx.font = 'bold 20px "LemonMilk", "Sans"';
            ctx.fillText(cleanCanvasText(e.label), rx + rw - 24, ry + rh / 2, 220);
        } else {
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.font = 'bold 20px "LemonMilk", "Sans"';
            ctx.fillText('Place disponible', rx + 92, ry + rh / 2);
        }
    }

    // Bandeau position utilisateur
    const userRank = entries.findIndex(e => e.uid === authorId);
    const posTxt = userRank !== -1
        ? `TA POSITION : #${userRank + 1} SUR ${entries.length}  (${cleanCanvasText(entries[userRank].label)})`
        : 'TU N\'ES PAS ENCORE CLASSÉ.E SUR CE PODIUM — TAPE !RLT GO !';
    drawGlassPanel(ctx, 48, 796, W - 96, 72, 18, 'rgba(12, 15, 26, 0.88)', accent, 2);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 22px "LemonMilk", "Sans"';
    ctx.fillText(posTxt, W / 2, 832, W - 140);

    return canvas.toBuffer('image/jpeg', { quality: 0.92 });
}

function buildRouletteTopEmbed(guild, authorId, mode = 'succes') {
    const entries = getRouletteTopEntries(guild, mode);
    const medals = ['🥇', '🥈', '🥉'];
    const top10 = entries.slice(0, 10);
    const lignes = top10.map((e, i) => {
        const m = guild?.members?.cache?.get(e.uid);
        const nom = m?.displayName ?? 'Ancien membre';
        const med = i < 3 ? medals[i] : `**${i + 1}.**`;
        return `${med} **${nom}** — **${e.label}**`;
    });

    const titleMap = {
        succes: '🏆 Panthéon des Chasseurs de Succès (Roulette)',
        tirages: '🎲 Classement — Total de Tirages',
        bonus: '🎉 Classement — Bonus Gagnés',
        malus: '💀 Classement — Malus Subis'
    };

    const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle(titleMap[mode] || titleMap.succes)
        .setDescription(lignes.length > 0 ? lignes.join('\n\n') : '*Aucune donnée pour l\'instant.*');

    const userRankIndex = entries.findIndex(e => e.uid === authorId);
    if (userRankIndex !== -1) {
        embed.setFooter({ text: `Ta position : #${userRankIndex + 1} (${entries[userRankIndex].label})` });
    } else {
        embed.setFooter({ text: `Pas encore classé·e ici. Tape !rlt go pour tenter ta chance !` });
    }

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`rlt_achs_${authorId}_0_${authorId}`).setLabel('🎖️ Mes succès').setStyle(ButtonStyle.Secondary)
    );
    return { embed, row };
}

async function buildRouletteTopPayload(guild, authorId, mode = 'succes', viewMode = 'img', fromHub = false) {
    const safeMode = ['succes', 'tirages', 'bonus', 'malus'].includes(mode) ? mode : 'succes';
    const isImg = viewMode !== 'txt';
    const currentView = isImg ? 'img' : 'txt';
    const nextView = isImg ? 'txt' : 'img';
    const hubFlag = fromHub ? '1' : '0';

    const selectMode = new StringSelectMenuBuilder()
        .setCustomId(`rlt_top_mode:${currentView}:${authorId}:${hubFlag}`)
        .setPlaceholder('Choisir un classement...')
        .addOptions(
            { label: 'Chasseurs de Succès', value: 'succes', emoji: '🎖️', default: safeMode === 'succes' },
            { label: 'Total de Tirages', value: 'tirages', emoji: '🎲', default: safeMode === 'tirages' },
            { label: 'Bonus Gagnés', value: 'bonus', emoji: '🎉', default: safeMode === 'bonus' },
            { label: 'Malus Subis', value: 'malus', emoji: '💀', default: safeMode === 'malus' }
        );

    const rowBtns = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`rlt_view:top:${nextView}:${safeMode}:${authorId}:${hubFlag}`)
            .setLabel(isImg ? 'Version imagée' : 'Version texte')
            .setEmoji(isImg ? '🖼️' : '📝')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`rlt_achs_${authorId}_0_${authorId}_${currentView}_${hubFlag}`)
            .setLabel('Mes succès')
            .setEmoji('🎖️')
            .setStyle(ButtonStyle.Secondary),
        buildRouletteAccueilButton(authorId),
        buildRouletteCloseButton(authorId)
    );

    const components = [new ActionRowBuilder().addComponents(selectMode), rowBtns];
    const { embed } = buildRouletteTopEmbed(guild, authorId, safeMode);

    if (!isImg) {
        return { embeds: [embed], components, files: [] };
    }

    const entries = getRouletteTopEntries(guild, safeMode);
    const buf = await renderRouletteTopCanvas(guild, entries, authorId, safeMode);
    const att = new AttachmentBuilder(buf, { name: 'rlt_top.jpg' });
    const imgEmbed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle(embed.data.title)
        .setImage('attachment://rlt_top.jpg')
        .setFooter(embed.data.footer || null);
    return { embeds: [imgEmbed], components, files: [att] };
}

async function tirerEtConstruireResultatRoulette(authorId, guild, channel, client) {
    const now = Date.now();
    const finFreeRoll = rouletteFreeRollUntil.get(authorId);
    const enFreeRollTemps = Boolean(finFreeRoll && now < finFreeRoll);
    const chargesTriple = rouletteCoupTripleCharges.get(authorId) || 0;
    const estExemptCooldown = ROULETTE_COOLDOWN_EXEMPT.includes(authorId);

    if (!estExemptCooldown && !enFreeRollTemps && chargesTriple === 0) {
        const finCooldown = rouletteCooldowns.get(authorId);
        if (finCooldown && now < finCooldown) {
            return { cooldown: true, reste: Math.ceil((finCooldown - now) / 1000 / 60), finCooldown };
        }
    }

    let resteChargesTriple = chargesTriple;
    if (chargesTriple > 0) {
        resteChargesTriple = chargesTriple - 1;
        if (resteChargesTriple === 0) rouletteCoupTripleCharges.delete(authorId);
        else rouletteCoupTripleCharges.set(authorId, resteChargesTriple);
    }

    let cooldownMinutes = 0;
    const diviseurFin = rouletteDiviseurUntil.get(authorId) || 0;
    const aDiviseur = diviseurFin > now;
    if (diviseurFin && !aDiviseur) rouletteDiviseurUntil.delete(authorId);
    const multDiviseur = (aDiviseur && !estHappyHour()) ? 0.5 : 1;

    if (!estExemptCooldown && !enFreeRollTemps && resteChargesTriple === 0) {
        const chargesCourt = rouletteCooldownCourtCharges.get(authorId) || 0;
        const charges45 = rouletteCooldown45Charges.get(authorId) || 0;
        const chargesLooong = rouletteLooongCooldownCharges.get(authorId) || 0;
        if (chargesCourt > 0 && (!estHappyHour() || charges45 > 0 || chargesLooong > 0)) {
            if (chargesCourt - 1 <= 0) rouletteCooldownCourtCharges.delete(authorId);
            else rouletteCooldownCourtCharges.set(authorId, chargesCourt - 1);
            const duree = Math.round(5 * 60 * 1000 * multDiviseur);
            cooldownMinutes = duree / 60000;
            rouletteCooldowns.set(authorId, now + duree);
        } else if (chargesLooong > 0) {
            if (chargesLooong - 1 <= 0) rouletteLooongCooldownCharges.delete(authorId);
            else rouletteLooongCooldownCharges.set(authorId, chargesLooong - 1);
            const duree = Math.round(60 * 60 * 1000 * multDiviseur);
            cooldownMinutes = duree / 60000;
            rouletteCooldowns.set(authorId, now + duree);
        } else if (charges45 > 0) {
            if (charges45 - 1 <= 0) rouletteCooldown45Charges.delete(authorId);
            else rouletteCooldown45Charges.set(authorId, charges45 - 1);
            const duree = Math.round(45 * 60 * 1000 * multDiviseur);
            cooldownMinutes = duree / 60000;
            rouletteCooldowns.set(authorId, now + duree);
        } else {
            const baseDuree = estHappyHour() ? 5 * 60 * 1000 : ROULETTE_COOLDOWN_MS;
            const dureeCooldown = estHappyHour() ? baseDuree : Math.round(baseDuree * multDiviseur);
            cooldownMinutes = dureeCooldown / 60000;
            rouletteCooldowns.set(authorId, now + dureeCooldown);
        }

        if (rouletteNotifRepeat.get(authorId)) {
            const cibleNotif = rouletteNotifTarget.get(authorId) || rouletteNotifs.get(authorId) || channel?.id;
            if (cibleNotif) {
                rouletteNotifs.set(authorId, cibleNotif);
                rouletteNotifTarget.set(authorId, cibleNotif);
                armerNotifRoulette(authorId, cibleNotif, client);
                bridge.demanderSauvegarde();
            }
        }
    }

    let membre = guild?.members?.cache?.get(authorId);
    if (!membre && guild) {
        membre = await guild.members.fetch(authorId).catch(() => null);
    }
    const auteurNom = membre?.displayName ?? 'Quelqu\'un';

    if (client) rouletteClient = client;
    const pityAvant = roulettePity.get(authorId) ?? { malus: 0, nuls: 0 };
    const estPityActive = (pityAvant.malus >= ROULETTE_PITY_MALUS || pityAvant.nuls >= ROULETTE_PITY_NULS);
    const isTcgCollector = bridge.hasTcgCollectorRole ? bridge.hasTcgCollectorRole(membre) : false;

    const outcomeId = tirerRoulette(authorId, guild?.id, isTcgCollector);

    // ==========================================
    //  BRANCHEMENT BATTLE PASS (ROULETTE ROLL & BONUS)
    // ==========================================
    if (bridge.trackBattlePassProgress) {
        // Décompte des malus cumulés pour la quête "Haute Tension"
        let nbMalusCumules = 0;
        const nowCk = Date.now();
        if (rouletteUwuUntil.has(authorId) && nowCk < rouletteUwuUntil.get(authorId)) nbMalusCumules++;
        if (rouletteEmojiUntil.has(authorId) && nowCk < rouletteEmojiUntil.get(authorId)) nbMalusCumules++;
        if (rouletteLeetUntil.has(authorId) && nowCk < rouletteLeetUntil.get(authorId)) nbMalusCumules++;
        for (const fin of Object.values(rouletteTransfos.get(authorId) ?? {})) {
            if (nowCk < fin) nbMalusCumules++;
        }

        const estNeutre = (outcomeId === 'aucun-resultat') && nbMalusCumules === 0 && (rouletteBouclierActif.get(authorId) || 0) === 0;

        if (bridge.trackTcgRoulettePoint) {
            bridge.trackTcgRoulettePoint(authorId, membre);
        }

        bridge.trackBattlePassProgress(authorId, 'roulette_roll', 1, {
            isHappyHour: estHappyHour(),
            sansEffetActif: estNeutre,
            malusCumules: nbMalusCumules
        });

        if (estHappyHour()) {
            bridge.trackBattlePassProgress(authorId, 'happy_hour_roll', 1);
        }
        if (outcomeId === 'bonus-gif-ou-audio') {
            bridge.trackBattlePassProgress(authorId, 'papayou', 1);
        }
        if (pityAvant.malus >= ROULETTE_PITY_MALUS || pityAvant.nuls >= ROULETTE_PITY_NULS) {
            bridge.trackBattlePassProgress(authorId, 'pity_win', 1);
        }
        const bActif = (rouletteBouclierActif.get(authorId) || 0) > 0;
        if (bActif) bridge.trackBattlePassProgress(authorId, 'bouclier_actif', 1);
        const boostJackpotVal = (rouletteJackpotBoostCharges.get(authorId) || 0) > 0 ? (rouletteJackpotBoostValue.get(authorId) || 0.25) : 0;
        const totalJackpotReel = (rouletteJackpotBonus.get(authorId) || 0) + boostJackpotVal;
        if (totalJackpotReel >= 0.20) {
            bridge.trackBattlePassProgress(authorId, 'jackpot_haut', 1);
        }
    }

    if (estHappyHour()) {
        const todayH = new Date().toDateString();
        const hh = rouletteHappyHourCompteur.get(authorId) ?? { date: todayH, count: 0 };
        hh.count = hh.date === todayH ? hh.count + 1 : 1;
        hh.date = todayH;
        rouletteHappyHourCompteur.set(authorId, hh);
        if (hh.count >= 10) deverrouillerSucces(authorId, 'oiseau-nuit', channel);
    }

    // Si ce n'est pas un malus, on remet la série de malus consécutifs à 0
    if (!outcomeId.startsWith('malus-')) {
        rouletteMalusConsecutifs.delete(authorId);
    }

    const failIndex = outcomeId === 'aucun-resultat' ? Math.floor(Math.random() * ROULETTE_FAILS.length) : 0;
    const entryTiree = ROULETTE_TABLE.find(e => e.id === outcomeId);
    updateRouletteStats(authorId, outcomeId, entryTiree, client);
    if (entryTiree && entryTiree.type === 'bonus' && probaReelle(entryTiree) < ROULETTE_HOF_SEUIL) {
        deverrouillerSucces(authorId, 'hof', channel);
    }
    verifierRoleGamblingAddict(membre).catch(() => {});

    // Succès secrets temporels
    if (estRouletteMauditeDoree()) {
        deverrouillerSuccesSecret(authorId, 'secret-dimanche', channel);
    }
    const parisRoll = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    if (parisRoll.getHours() === 0 && parisRoll.getMinutes() <= 5) {
        deverrouillerSuccesSecret(authorId, 'secret-minuit', channel);
    }

    if (entryTiree?.type === 'bonus') {
        // Le succès Sauvetage ne se déclenche que si le bonus a RÉELLEMENT été sauvé par la pity
        if (estPityActive) {
            deverrouillerSucces(authorId, 'le-sauvetage', channel);
        }
        const rawBNow = rouletteBouclierActif.get(authorId);
        const nbBNow = typeof rawBNow === 'number' ? rawBNow : (rawBNow ? 1 : 0);
        if ((rouletteCouronneUntil.get(authorId) || 0) > now && (rouletteAntiFeurUntil.get(authorId) || 0) > now && nbBNow >= 5) {
            deverrouillerSuccesSecret(authorId, 'secret-triple-couronne', channel);
        }
        if (bridge.trackBattlePassProgress) {
            bridge.trackBattlePassProgress(authorId, 'bonus_gagne', 1);
            bridge.trackBattlePassProgress(authorId, 'bonus_diff', 1);
            if (probaReelle(entryTiree) <= 0.01) {
                bridge.trackBattlePassProgress(authorId, 'bonus_rare', 1);
            }
        }
        if (bridge.estAnniversaireAujourdhui(guild?.id, authorId)) {
            deverrouillerSucces(authorId, 'jour-de-gloire', channel);
        }
    }

    let cibles = [membre];
    let prefixeRedirect = '';
    const pingsRedirection = [];

    const resoudreCibles = async (ids) => {
        const res = [];
        for (const id of ids) {
            if (!id || id === authorId) continue;
            const m = guild?.members?.cache?.get(id) || await guild?.members?.fetch?.(id).catch(() => null);
            if (m && m.id !== authorId) res.push(m);
        }
        return res;
    };

    // Redirection des BONUS vers une ou plusieurs cibles au choix, ou au hasard
    if (entryTiree?.type === 'bonus' && !outcomeId.startsWith('bonus-redirect-bonus-')) {
        const ciblesBonusIds = getCiblesListe(rouletteRedirectBonusChoixCible, authorId);
        if (ciblesBonusIds.length > 0) {
            rouletteRedirectBonusChoixCible.delete(authorId);
            const ciblesChoisies = await resoudreCibles(ciblesBonusIds);
            const ciblesEligibles = entryTiree.tcgOnly
                ? ciblesChoisies.filter(m => bridge.hasTcgCollectorRole?.(m))
                : ciblesChoisies;
            const ciblesRefusees = entryTiree.tcgOnly
                ? ciblesChoisies.filter(m => !bridge.hasTcgCollectorRole?.(m))
                : [];

            for (const _ref of ciblesRefusees) {
                crediterInventaireRoulette(authorId, 'redirectBonusChoix', 1);
            }

            if (ciblesEligibles.length > 0) {
                cibles = ciblesEligibles;
                const nomsUniques = [...new Set(ciblesEligibles.map(m => m.displayName))].map(n => `**${n}**`).join(', ');
                prefixeRedirect = ciblesEligibles.length > 1
                    ? `🎀 **${auteurNom}** avait cumulé **${ciblesEligibles.length} redirections de bonus**, offert simultanément à ${nomsUniques} !\n`
                    : `🎀 **${auteurNom}** avait choisi de rediriger son bonus, offert à **${ciblesEligibles[0].displayName}** !\n`;
                for (const cid of new Set(ciblesEligibles.map(m => m.id))) {
                    pingsRedirection.push({
                        id: cid,
                        texte: `🔔 <@${cid}>, **${auteurNom}** t'a offert son bonus **${ROULETTE_NOMS[outcomeId]}** ! 🎁`
                    });
                    notifierMpInteractionRoulette(
                        client,
                        cid,
                        `🎁 **${auteurNom}** t'a offert son bonus Roulette **${ROULETTE_NOMS[outcomeId] || outcomeId}** !`
                    );
                }
                if (ciblesRefusees.length > 0) {
                    const nomsRef = [...new Set(ciblesRefusees.map(m => `**${m.displayName}**`))].join(', ');
                    prefixeRedirect += `↩️ *Redirection(s) vers ${nomsRef} remboursée(s) (rôle Collectionneur.euse manquant).* \n`;
                }
            } else if (ciblesRefusees.length > 0) {
                const nomsRef = [...new Set(ciblesRefusees.map(m => `**${m.displayName}**`))].join(', ');
                prefixeRedirect = `↩️ **${auteurNom}** : ta redirection de bonus vers ${nomsRef} a été **remboursée** (rôle Collectionneur.euse manquant) — tu conserves donc le bonus !\n`;
            }
        } else {
            const chargesBonus = rouletteRedirectBonusCharges.get(authorId) || 0;
            if (chargesBonus > 0) {
                const candidats = membresTop30Roulette(guild, authorId);
                if (candidats.length > 0) {
                    const cibleAlea = candidats[Math.floor(Math.random() * candidats.length)];
                    if (entryTiree.tcgOnly && !bridge.hasTcgCollectorRole?.(cibleAlea)) {
                        prefixeRedirect = `↩️ La redirection aléatoire est tombée sur **${cibleAlea.displayName}** qui n'a pas le rôle Collectionneur.euse : charge conservée, **${auteurNom}** garde le bonus !\n`;
                    } else {
                        cibles = [cibleAlea];
                        rouletteRedirectBonusCharges.set(authorId, chargesBonus - 1);
                        prefixeRedirect = `🎁 **${auteurNom}** avait un bonus à rediriger au hasard, offert à **${cibleAlea.displayName}** !\n`;
                        pingsRedirection.push({
                            id: cibleAlea.id,
                            texte: `🔔 <@${cibleAlea.id}>, **${auteurNom}** t'a offert son bonus **${ROULETTE_NOMS[outcomeId]}** ! 🎁`
                        });
                        notifierMpInteractionRoulette(
                            client,
                            cibleAlea.id,
                            `🎁 **${auteurNom}** t'a offert son bonus Roulette **${ROULETTE_NOMS[outcomeId] || outcomeId}** !`
                        );
                    }
                }
            }
        }
    }

    const jCharges = rouletteJackpotBoostCharges.get(authorId) || 0;
    if (jCharges > 0) {
        if (jCharges - 1 <= 0) {
            rouletteJackpotBoostCharges.delete(authorId);
            rouletteJackpotBoostValue.delete(authorId);
        } else {
            rouletteJackpotBoostCharges.set(authorId, jCharges - 1);
        }
    }

    const rawBCharges = rouletteBouclierActif.get(authorId);
    const bCharges = typeof rawBCharges === 'number' ? rawBCharges : (rawBCharges ? 1 : 0);
    const estModoImmuniseMute = Boolean(membre && bridge.estModo?.(membre) && ROULETTE_MUTE_MALUS_IDS.has(outcomeId));
    // Le Brise-Bouclier est inarrêtable ; les modos gardent leur bouclier sur les mutes
    if (outcomeId.startsWith('malus-') && outcomeId !== 'malus-brise-bouclier' && bCharges > 0 && !estModoImmuniseMute) {
        const restantes = bCharges - 1;
        if (restantes <= 0) rouletteBouclierActif.delete(authorId);
        else rouletteBouclierActif.set(authorId, restantes);

        // Le malus a été paré : aucun malus n'est subi, brise la série consécutive de malchance
        rouletteMalusConsecutifs.delete(authorId);

        if (bridge.trackBattlePassProgress) {
            bridge.trackBattlePassProgress(authorId, 'malus_pare', 1);
        }

        if (['malus-timeout-20min', 'malus-exclu-heure', 'malus-exclu-jour', 'malus-exclu-semaine', 'malus-ban'].includes(outcomeId)) {
            deverrouillerSucces(authorId, 'pare-balles', channel);
        }
        const msgRestantes = restantes > 0 ? ` (${restantes} charge${restantes > 1 ? 's' : ''} restante${restantes > 1 ? 's' : ''})` : '';
        const texteBouclier = `🛡️ **${auteurNom}** évite le malus **${ROULETTE_NOMS[outcomeId]}** grâce à son bouclier !${msgRestantes}`;
        const gifOptions = {
            shieldBlocked: true,
            pityActive: estPityActive,
            resteChargesTriple,
            avatarUrl: membre?.displayAvatarURL?.({ dynamic: true }) || undefined,
            guild
        };
        const embed = buildRouletteResultEmbed(outcomeId, texteBouclier, authorId, auteurNom, cooldownMinutes, gifOptions);
        const gifShield = getRouletteOutcomeGifAttachment(outcomeId, texteBouclier, gifOptions);
        return {
            embeds: [embed],
            components: [buildRowResultatRoulette(authorId, outcomeId, failIndex)],
            files: gifShield ? [gifShield] : [],
            outcomeId,
            gifOptions
        };
    }

    if (outcomeId.startsWith('malus-')) {
        const ciblesMalusIds = getCiblesListe(rouletteRedirectChoixCible, authorId);
        if (ciblesMalusIds.length > 0) {
            rouletteRedirectChoixCible.delete(authorId);
            const ciblesChoisies = await resoudreCibles(ciblesMalusIds);
            const ciblesEligibles = ciblesChoisies.filter(m => !estProtegeAntiAcharnement(m.id));
            const ciblesProtegees = ciblesChoisies.filter(m => estProtegeAntiAcharnement(m.id));
            for (const _prot of ciblesProtegees) {
                crediterInventaireRoulette(authorId, 'redirectChoix', 1);
            }
            if (ciblesEligibles.length > 0) {
                cibles = ciblesEligibles;
                deverrouillerSucces(authorId, 'sniper-impitoyable', channel);
                const nomsUniques = [...new Set(ciblesEligibles.map(m => m.displayName))].map(n => `**${n}**`).join(', ');
                prefixeRedirect = ciblesEligibles.length > 1
                    ? `🎯 **${auteurNom}** avait cumulé **${ciblesEligibles.length} redirections de malus**, envoyé simultanément vers ${nomsUniques} !\n`
                    : `🎯 **${auteurNom}** avait choisi de rediriger son malus, envoyé vers **${ciblesEligibles[0].displayName}** !\n`;
                for (const cid of new Set(ciblesEligibles.map(m => m.id))) {
                    enregistrerRedirectRecu(cid);
                    pingsRedirection.push({
                        id: cid,
                        texte: `🔔 <@${cid}>, **${auteurNom}** t'a redirigé le malus **${ROULETTE_NOMS[outcomeId] || outcomeId}** ! 💀`
                    });
                    notifierMpInteractionRoulette(
                        client,
                        cid,
                        `💀 **${auteurNom}** t'a redirigé le malus Roulette **${ROULETTE_NOMS[outcomeId] || outcomeId}** !`
                    );
                }
                if (ciblesProtegees.length > 0) {
                    const nomsProt = [...new Set(ciblesProtegees.map(m => `**${m.displayName}**`))].join(', ');
                    prefixeRedirect += `🛡️ *Redirection(s) vers ${nomsProt} remboursée(s) (protection anti-acharnement 24h).* \n`;
                }
            } else if (ciblesProtegees.length > 0) {
                const nomsProt = [...new Set(ciblesProtegees.map(m => `**${m.displayName}**`))].join(', ');
                prefixeRedirect = `🛡️ **${auteurNom}** : ta redirection vers ${nomsProt} a été **remboursée** (3 malus redirigés déjà reçus en 24h) — tu subis donc le malus !\n`;
            }
        } else {
            const charges = rouletteRedirectCharges.get(authorId) || 0;
            if (charges > 0) {
                const candidats = membresTop30Roulette(guild, authorId).filter(m => !estProtegeAntiAcharnement(m.id));
                if (candidats.length > 0) {
                    const cibleAlea = candidats[Math.floor(Math.random() * candidats.length)];
                    cibles = [cibleAlea];
                    rouletteRedirectCharges.set(authorId, charges - 1);
                    enregistrerRedirectRecu(cibleAlea.id);
                    prefixeRedirect = `😈 **${auteurNom}** avait un malus en réserve, redirigé vers **${cibleAlea.displayName}** !\n`;
                    pingsRedirection.push({
                        id: cibleAlea.id,
                        texte: `🔔 <@${cibleAlea.id}>, **${auteurNom}** t'a redirigé le malus **${ROULETTE_NOMS[outcomeId] || outcomeId}** ! 💀`
                    });
                    notifierMpInteractionRoulette(
                        client,
                        cibleAlea.id,
                        `💀 **${auteurNom}** t'a redirigé au hasard le malus Roulette **${ROULETTE_NOMS[outcomeId] || outcomeId}** !`
                    );
                }
            }
        }
    }

    // Comptabilisation des malus RÉELLEMENT subis (uniquement pour les cibles qui le prennent)
    if (outcomeId.startsWith('malus-')) {
        const idsUniquesMalus = new Set(cibles.map(m => m.id));
        for (const cibleId of idsUniquesMalus) {
            bridge.trackBattlePassProgress?.(cibleId, 'malus_subis', 1);
            bridge.trackBattlePassProgress?.(cibleId, 'malus_diff', 1, { malusId: outcomeId });
            const cons = (rouletteMalusConsecutifs.get(cibleId) || 0) + 1;
            rouletteMalusConsecutifs.set(cibleId, cons);
            if (cons >= 3) deverrouillerSucces(cibleId, 'enchainement-fatal', channel);

            let diffList = rouletteMalusDifferents.get(cibleId);
            if (!Array.isArray(diffList)) diffList = [];
            if (!diffList.includes(outcomeId)) diffList.push(outcomeId);
            rouletteMalusDifferents.set(cibleId, diffList);
            if (diffList.length >= 10) deverrouillerSucces(cibleId, 'seum-en-personne', channel);
        }
    }

    // Vérification des Partages de bonus au choix (cumulables)
    let partenairesPartage = [];
    let partenairesRefuses = [];
    if (entryTiree?.type === 'bonus' && !outcomeId.startsWith('bonus-redirect-bonus-') && outcomeId !== 'bonus-partage-bonus') {
        const partIds = getCiblesListe(roulettePartageBonusChoixCible, authorId);
        if (partIds.length > 0) {
            roulettePartageBonusChoixCible.delete(authorId);
            const resolus = await resoudreCibles(partIds);
            if (entryTiree.tcgOnly) {
                partenairesPartage = resolus.filter(m => bridge.hasTcgCollectorRole?.(m));
                partenairesRefuses = resolus.filter(m => !bridge.hasTcgCollectorRole?.(m));
                for (const _ref of partenairesRefuses) {
                    crediterInventaireRoulette(authorId, 'partageBonus', 1);
                }
            } else {
                partenairesPartage = resolus;
            }
        }
    }

    const allFiles = [];
    const textesCibles = [];
    const textesImmediatesSansDiffere = [];
    const differes = [];
    let voteObj = null;

    for (const cibleCourante of cibles) {
        // Hall of Fame et Hall of Shame sur chaque vraie cible
        envoyerHallOfFame(guild, cibleCourante, entryTiree, membre, partenairesPartage.length > 0).catch(() => {});
        envoyerHallOfShame(guild, cibleCourante, entryTiree, membre).catch(() => {});

        const proxyM = { member: cibleCourante, channel, guild };
        const texteM = await appliquerEtDecrireResultat(outcomeId, proxyM, cibleCourante.displayName, failIndex);
        textesCibles.push(texteM);

        if (Array.isArray(proxyM.files)) {
            for (const f of proxyM.files) {
                if (!allFiles.includes(f)) allFiles.push(f);
            }
        }
        if (proxyM.pingCible) pingsRedirection.push(proxyM.pingCible);
        if (proxyM.vote && !voteObj) voteObj = proxyM.vote;
        if (proxyM.differe) {
            differes.push(proxyM.differe);
        } else {
            textesImmediatesSansDiffere.push(texteM);
        }

        // Crise de la quarantaine : vérifié uniquement si le tirage vient d'ajouter le mode boomer ou bébé
        if (outcomeId === 'malus-boomer' || outcomeId === 'malus-bebe') {
            const tTransfo = rouletteTransfos.get(cibleCourante.id);
            if (tTransfo?.boomer && tTransfo?.bebe && Date.now() < tTransfo.boomer && Date.now() < tTransfo.bebe) {
                deverrouillerSucces(cibleCourante.id, 'crise-quarantaine', channel);
            }
        }

        if (texteM.includes('Miracle !')) {
            deverrouillerSucces(cibleCourante.id, 'pharmacien', channel);
            bridge.trackBattlePassProgress?.(cibleCourante.id, 'contre_poison', 1);
            if ((rouletteDoubleTempsUntil.get(cibleCourante.id) || 0) > Date.now()) {
                deverrouillerSuccesSecret(cibleCourante.id, 'secret-pingpong', channel);
            }
        }

        // L'Incompréhensible : vérifié UNIQUEMENT si le tirage actuel est un malus textuel
        const estMalusTexte = [
            'malus-boomer', 'malus-bebe', 'malus-uwu-24h', 'malus-emoji', 'malus-emoji-only',
            'malus-leet', 'malus-caps', 'malus-sans-voyelle', 'malus-sans-consonne',
            'malus-lettre-interdite', 'malus-limite-100', 'malus-limite-30',
            'malus-existentiel', 'malus-linkedin', 'malus-echo', 'malus-censure',
            'malus-mots-melanges', 'malus-lettres-melangees', 'malus-mocking',
            'malus-begaiement', 'malus-publicite', 'malus-autocorrect', 'malus-oyez'
        ].includes(outcomeId);

        if (estMalusTexte) {
            const nowCheck = Date.now();
            let malusTexteCumules = 0;
            if (rouletteUwuUntil.has(cibleCourante.id) && nowCheck < rouletteUwuUntil.get(cibleCourante.id)) malusTexteCumules++;
            if (rouletteLettreInterdite.has(cibleCourante.id) && nowCheck < rouletteLettreInterdite.get(cibleCourante.id).until) malusTexteCumules++;
            if (rouletteEmojiUntil.has(cibleCourante.id) && nowCheck < rouletteEmojiUntil.get(cibleCourante.id)) malusTexteCumules++;
            if (rouletteLeetUntil.has(cibleCourante.id) && nowCheck < rouletteLeetUntil.get(cibleCourante.id)) malusTexteCumules++;
            if (rouletteEchoUntil.has(cibleCourante.id) && nowCheck < rouletteEchoUntil.get(cibleCourante.id)) malusTexteCumules++;
            for (const fin of Object.values(rouletteTransfos.get(cibleCourante.id) ?? {})) {
                if (nowCheck < fin) malusTexteCumules++;
            }
            if (malusTexteCumules >= 3) deverrouillerSucces(cibleCourante.id, 'incomprehensible', channel);
        }
    }

    let texte = textesCibles.join('\n');

    if (partenairesPartage.length > 0) {
        const mentionsPartage = [...new Set(partenairesPartage.map(p => `<@${p.id}>`))].join(', ');
        const lignesPartage = [];
        for (const part of partenairesPartage) {
            envoyerHallOfFame(guild, part, entryTiree, membre, true).catch(() => {});
            const proxyPart = { member: part, channel, guild };
            const textePart = await appliquerEtDecrireResultat(outcomeId, proxyPart, part.displayName, failIndex);
            lignesPartage.push(`> ${textePart}`);
            if (Array.isArray(proxyPart.files)) {
                for (const f of proxyPart.files) {
                    if (!allFiles.includes(f)) allFiles.push(f);
                }
            }
        }
        texte += `\n\n🤝 **BONUS PARTAGÉ !** ${mentionsPartage} en profite${partenairesPartage.length > 1 ? 'nt' : ''} également !\n${lignesPartage.join('\n')}`;
        for (const pid of new Set(partenairesPartage.map(p => p.id))) {
            pingsRedirection.push({
                id: pid,
                texte: `🤝 🔔 <@${pid}>, **${auteurNom}** a partagé son bonus **${ROULETTE_NOMS[outcomeId] || outcomeId}** avec toi !`
            });
            notifierMpInteractionRoulette(
                client,
                pid,
                `🤝 **${auteurNom}** a partagé son bonus Roulette **${ROULETTE_NOMS[outcomeId] || outcomeId}** avec toi !`
            );
        }
    }

    if (partenairesRefuses.length > 0) {
        const nomsRefPart = [...new Set(partenairesRefuses.map(p => `**${p.displayName}**`))].join(', ');
        texte += `\n\n↩️ *Partage vers ${nomsRefPart} remboursé dans ton inventaire (\`!rlt claim\`) : rôle Collectionneur.euse requis pour les bonus RegaDex.*`;
    }

    if (outcomeId === 'bonus-coup-triple') {
        rouletteCoupTripleScore.set(authorId, 0);
    } else if (chargesTriple > 0) {
        if (entryTiree?.type === 'bonus') {
            const score = (rouletteCoupTripleScore.get(authorId) || 0) + 1;
            rouletteCoupTripleScore.set(authorId, score);
            if (score >= 3) deverrouillerSucces(authorId, 'braquage-parfait', channel);
        } else {
            rouletteCoupTripleScore.delete(authorId);
        }
    }

    bridge.demanderSauvegarde();

    let extraVoteTexte = '';
    let menuVoteRedirectRow = null;
    const voteCharges = rouletteVoteRedirectCharges.get(authorId) || 0;
    if (outcomeId.startsWith('malus-') && voteCharges > 0 && outcomeId !== 'malus-brise-bouclier' && !prefixeRedirect) {
        const votantsInfo = rouletteVoteVotants.get(authorId);
        let noteVotants = '';
        if (votantsInfo?.non?.length > 0) {
            noteVotants = `\n-# 😈 *Rappel de ceux qui ont voté contre toi : ${votantsInfo.non.map(id => `<@${id}>`).join(', ')}*`;
        }
        extraVoteTexte = `\n\n🎯 **Privilège de vote populaire (${voteCharges} charge${voteCharges > 1 ? 's' : ''} restante${voteCharges > 1 ? 's' : ''}) :**\nTu peux renvoyer ce malus sur la personne de ton choix via le menu ci-dessous !${noteVotants}`;

        const menuRedirection = buildMenuChoixMembreRoulette(
            guild,
            authorId,
            `rlt_vote_redirect_${authorId}_${outcomeId}`,
            '🎯 Choisis qui prendra ce malus à ta place...'
        );

        menuVoteRedirectRow = new ActionRowBuilder().addComponents(menuRedirection);
    }

    const noteBouclierModo = (!prefixeRedirect && estModoImmuniseMute && bCharges > 0)
        ? `\n-# 🛡️ *Bouclier conservé (${bCharges} charge${bCharges > 1 ? 's' : ''}) : les mutes ne consomment pas le bouclier des modos.*`
        : '';
    const texteComplet = prefixeRedirect + texte + extraVoteTexte + noteBouclierModo;
    const gifOptions = {
        pityActive: estPityActive,
        resteChargesTriple,
        malusGifSeed: Math.floor(Math.random() * 10000),
        avatarUrl: membre?.displayAvatarURL?.({ dynamic: true }) || undefined,
        guild
    };
    const embed = buildRouletteResultEmbed(outcomeId, texteComplet, authorId, auteurNom, cooldownMinutes, gifOptions);
    let voteExpireAt = null;
    if (!voteObj) {
        const gifOutcome = getRouletteOutcomeGifAttachment(outcomeId, texteComplet, gifOptions);
        if (gifOutcome) allFiles.push(gifOutcome);
    } else {
        voteExpireAt = Date.now() + 2 * 60 * 60 * 1000;
        const voteBuf = await renderRouletteVoteCanvas(voteObj, 0, 0, voteExpireAt, false).catch(() => null);
        if (voteBuf) allFiles.push(new AttachmentBuilder(voteBuf, { name: 'rlt_vote.jpg' }));
    }

    const roleMaxId = ROULETTE_RANGS[ROULETTE_RANGS.length - 1].id;
    const dejaMaxRole = !prefixeRedirect && cibles.length === 1 && (outcomeId === 'bonus-role-superieur' || outcomeId === 'bonus-legendaire') && cibles[0].roles.cache.has(roleMaxId);

    if (dejaMaxRole) {
        return {
            embeds: [embed],
            components: [buildMenuFallbackRoulette(authorId), buildRowResultatRoulette(authorId, outcomeId, failIndex)],
            files: allFiles,
            attenteChoix: true,
            outcomeId,
            gifOptions
        };
    }

    const resultComponents = [buildRowResultatRoulette(authorId, outcomeId, failIndex)];
    if (menuVoteRedirectRow) resultComponents.unshift(menuVoteRedirectRow);

    return {
        embeds: voteObj ? [buildVoteRouletteEmbed(voteObj, 0, 0, voteExpireAt, false)] : [embed],
        components: voteObj ? [buildVoteRouletteRow(0, 0, false)] : resultComponents,
        files: allFiles,
        vote: voteObj ?? null,
        pingsCible: pingsRedirection,
        outcomeId,
        gifOptions,
        differe: differes.length > 0 ? async () => {
            await Promise.all(differes.map(d => d.action()));
            const lignesFinales = [...textesImmediatesSansDiffere, ...differes.map(d => d.texteFinal)].join('\n');
            return buildRouletteResultEmbed(outcomeId, prefixeRedirect + lignesFinales + extraVoteTexte + noteBouclierModo, authorId, auteurNom, cooldownMinutes, gifOptions);
        } : null
    };
}

async function assurerWebhookRoulette(channel) {
    if (channel.guild?.id !== '720057528351850547') return null;
    if (estSalonExcluMalusTexte(channel)) return null;
    if (rouletteWebhooks.has(channel.id)) return rouletteWebhooks.get(channel.id);
    try {
        const existants = await channel.fetchWebhooks();
        let webhook = existants.find(w => w.name === 'Cacabot Roulette');
        if (!webhook) webhook = await channel.createWebhook({ name: 'Cacabot Roulette' });
        rouletteWebhooks.set(channel.id, webhook);
        return webhook;
    } catch { return null; }
}

async function initialiserWebhooksRoulette(guild) {
    if (guild.id !== '720057528351850547') return;
    // Pré-chargement rapide uniquement sur le salon roulette officiel (les autres se créent à la demande sans bloquer)
    const salonPrincipal = guild.channels.cache.get(ROULETTE_SALON_ID);
    if (salonPrincipal) {
        await assurerWebhookRoulette(salonPrincipal).catch(() => {});
    }
}

// ==========================================
//   LOGIQUE DU PANNEAU !stats set (EPSYS)
// ==========================================

const ROULETTE_STATS_LABELS = {
    'tirages': '🎲 Tirages totaux',
    'bonus': '🎉 Bonus pris',
    'malus': '💀 Malus subis',
    'rien': '😶 Tirages nuls (« Rien »)',
    'pireSerie': '📉 Pire série de malchance',
    'plusGrosGain': '🏆 Plus gros gain',
    'pity_malus': '🍀 Pity malus',
    'pity_nuls': '🍀 Pity tirages nuls',
    'jackpot': '📈 Boost Jackpot'
};

function buildRouletteStatsSetEmbed(guild, targetUserId, selectedStat = 'tirages', feedback = null) {
    const member = guild?.members.cache.get(targetUserId);
    const nom = member?.displayName || `<@${targetUserId}>`;
    const avatar = member?.user?.displayAvatarURL({ dynamic: true, size: 256 }) || null;

    const s = rouletteStats.get(targetUserId) ?? { tirages: 0, bonus: 0, malus: 0, rien: 0, plusGrosGain: null, pireSerie: 0 };
    const p = roulettePity.get(targetUserId) ?? { malus: 0, nuls: 0 };
    const j = Math.round((rouletteJackpotBonus.get(targetUserId) || 0) * 100);

    const gainTexte = s.plusGrosGain 
        ? `**${s.plusGrosGain.nom}** (${probaAffichee(s.plusGrosGain.proba).pct}%)` 
        : '*Aucun bonus encore*';

    let desc = `Panneau d'administration des statistiques de roulette de **${nom}**.\n\n`;
    if (feedback) {
        desc += `🔔 **Dernière action :** ${feedback}\n\n`;
    }
    desc += `👉 **Statistique actuellement ciblée :** **${ROULETTE_STATS_LABELS[selectedStat] || selectedStat}**\n` +
            `-# *Utilise les boutons ou menus ci-dessous pour modifier cette statistique spécifique.*`;

    const embed = new EmbedBuilder()
        .setColor(feedback ? 0x2ecc71 : 0xffd20a)
        .setTitle(`🎰 Gestionnaire des Stats Roulette — ${nom}`)
        .setDescription(desc)
        .addFields(
            {
                name: '📊 STATISTIQUES PRINCIPALES',
                value: `• 🎲 **Tirages totaux :** \`${s.tirages}\`\n` +
                       `• 🎉 **Bonus pris :** \`${s.bonus}\`\n` +
                       `• 💀 **Malus subis :** \`${s.malus}\`\n` +
                       `• 😶 **Résultats « Rien » :** \`${s.rien}\``,
                inline: true
            },
            {
                name: '🏆 EXPLOITS & SÉRIES',
                value: `• 🏆 **Plus gros gain :**\n> ${gainTexte}\n` +
                       `• 📉 **Pire série de malchance :** \`${s.pireSerie}\``,
                inline: true
            },
            {
                name: '🍀 PITY & JACKPOT',
                value: `• 💀 **Pity malus :** \`${p.malus}/3\`\n` +
                       `• 💨 **Pity nuls :** \`${p.nuls}/5\`\n` +
                       `• 📈 **Boost jackpot :** \`+${j}%\``,
                inline: false
            }
        )
        .setFooter({ text: 'Commande Epsys-Only • Sauvegarde automatique (#json)' })
        .setTimestamp();

    if (avatar) embed.setThumbnail(avatar);
    return embed;
}

function buildRouletteStatsSetComponents(targetUserId, selectedStat = 'tirages') {
    const s = rouletteStats.get(targetUserId) ?? { tirages: 0, bonus: 0, malus: 0, rien: 0, plusGrosGain: null, pireSerie: 0 };
    const p = roulettePity.get(targetUserId) ?? { malus: 0, nuls: 0 };
    const j = Math.round((rouletteJackpotBonus.get(targetUserId) || 0) * 100);

    const gainNomCourt = s.plusGrosGain ? s.plusGrosGain.nom.slice(0, 25) : 'Aucun';

    // 1. Menu choix du membre
    const rowUser = new ActionRowBuilder().addComponents(
        new UserSelectMenuBuilder()
            .setCustomId(`rltpts:user:${selectedStat}`)
            .setPlaceholder('👤 Choisir un autre membre...')
    );

    // 2. Menu choix de la stat ciblée
    const rowStat = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`rltpts:stat:${targetUserId}`)
            .setPlaceholder('🎯 Choisir la statistique à modifier...')
            .addOptions([
                { label: `🎲 Tirages totaux (Actuel : ${s.tirages})`, value: 'tirages', default: selectedStat === 'tirages' },
                { label: `🎉 Bonus pris (Actuel : ${s.bonus})`, value: 'bonus', default: selectedStat === 'bonus' },
                { label: `💀 Malus subis (Actuel : ${s.malus})`, value: 'malus', default: selectedStat === 'malus' },
                { label: `😶 Résultats « Rien » (Actuel : ${s.rien})`, value: 'rien', default: selectedStat === 'rien' },
                { label: `📉 Pire série de malchance (Actuel : ${s.pireSerie})`, value: 'pireSerie', default: selectedStat === 'pireSerie' },
                { label: `🏆 Plus gros gain (Actuel : ${gainNomCourt})`, value: 'plusGrosGain', default: selectedStat === 'plusGrosGain' },
                { label: `🍀 Pity Malus (Actuel : ${p.malus}/3)`, value: 'pity_malus', default: selectedStat === 'pity_malus' },
                { label: `🍀 Pity Nuls (Actuel : ${p.nuls}/5)`, value: 'pity_nuls', default: selectedStat === 'pity_nuls' },
                { label: `📈 Boost Jackpot (Actuel : +${j}%)`, value: 'jackpot', default: selectedStat === 'jackpot' }
            ])
    );

    // 3. Commandes spécifiques selon la stat
    if (selectedStat === 'plusGrosGain') {
        const bonusList = ROULETTE_TABLE
            .filter(e => e.type === 'bonus')
            .sort((a, b) => a.poids - b.poids);

        const optionsBonus = bonusList.slice(0, 25).map(e => {
            const { n, pct } = probaAffichee(probaReelle(e));
            const emoji = ROULETTE_EMOJIS_PAR_ID[e.id] ?? '🎁';
            return {
                label: `${e.nom} (1/${n})`.slice(0, 100),
                description: `Cote : ${pct}% de chance`.slice(0, 100),
                value: e.id,
                emoji
            };
        });

        const rowGainMenu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`rltpts:gainselect:${targetUserId}`)
                .setPlaceholder('🎁 Choisir un bonus officiel comme plus gros gain...')
                .addOptions(optionsBonus)
        );

        const rowGainBtns = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`rltpts:openmodal:${targetUserId}:plusGrosGain`)
                .setLabel('✏️ Gain personnalisé...')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`rltpts:act:${targetUserId}:plusGrosGain:reset`)
                .setLabel('🗑️ Retirer le gain')
                .setStyle(ButtonStyle.Danger)
        );

        return [rowUser, rowStat, rowGainMenu, rowGainBtns];
    }

    // Boutons rapides pour les stats numériques
    const rowButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`rltpts:act:${targetUserId}:${selectedStat}:add1`).setLabel('➕ +1').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`rltpts:act:${targetUserId}:${selectedStat}:add5`).setLabel('➕ +5').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`rltpts:act:${targetUserId}:${selectedStat}:sub1`).setLabel('➖ -1').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`rltpts:openmodal:${targetUserId}:${selectedStat}`).setLabel('✏️ Définir...').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`rltpts:act:${targetUserId}:${selectedStat}:reset`).setLabel('🗑️ Remise à 0').setStyle(ButtonStyle.Danger)
    );

    return [rowUser, rowStat, rowButtons];
}

function modifierStatRoulette(targetUserId, statKey, action, valeurDirecte = null) {
    let s = rouletteStats.get(targetUserId);
    if (!s) {
        s = { tirages: 0, bonus: 0, malus: 0, rien: 0, plusGrosGain: null, pireSerie: 0, serieActuelle: 0 };
        rouletteStats.set(targetUserId, s);
    }

    let p = roulettePity.get(targetUserId);
    if (!p) {
        p = { malus: 0, nuls: 0 };
        roulettePity.set(targetUserId, p);
    }

    if (statKey === 'plusGrosGain') {
        if (action === 'reset') {
            s.plusGrosGain = null;
        } else if (action === 'set' && valeurDirecte) {
            s.plusGrosGain = valeurDirecte;
        }
        bridge.demanderSauvegarde();
        return s.plusGrosGain ? s.plusGrosGain.nom : 'Aucun';
    }

    if (statKey === 'pity_malus') {
        if (action === 'add1') p.malus = (p.malus || 0) + 1;
        else if (action === 'add5') p.malus = (p.malus || 0) + 5;
        else if (action === 'sub1') p.malus = Math.max(0, (p.malus || 0) - 1);
        else if (action === 'reset') p.malus = 0;
        else if (action === 'set' && valeurDirecte !== null) p.malus = Math.max(0, valeurDirecte);
        bridge.demanderSauvegarde();
        return `${p.malus}/3`;
    }

    if (statKey === 'pity_nuls') {
        if (action === 'add1') p.nuls = (p.nuls || 0) + 1;
        else if (action === 'add5') p.nuls = (p.nuls || 0) + 5;
        else if (action === 'sub1') p.nuls = Math.max(0, (p.nuls || 0) - 1);
        else if (action === 'reset') p.nuls = 0;
        else if (action === 'set' && valeurDirecte !== null) p.nuls = Math.max(0, valeurDirecte);
        bridge.demanderSauvegarde();
        return `${p.nuls}/5`;
    }

    if (statKey === 'jackpot') {
        let cur = Math.round((rouletteJackpotBonus.get(targetUserId) || 0) * 100);
        if (action === 'add1') cur = Math.min(50, cur + 1);
        else if (action === 'add5') cur = Math.min(50, cur + 5);
        else if (action === 'sub1') cur = Math.max(0, cur - 1);
        else if (action === 'reset') cur = 0;
        else if (action === 'set' && valeurDirecte !== null) cur = Math.min(50, Math.max(0, valeurDirecte));
        rouletteJackpotBonus.set(targetUserId, cur / 100);
        bridge.demanderSauvegarde();
        return `+${cur}%`;
    }

    if (action === 'add1') s[statKey] = (s[statKey] || 0) + 1;
    else if (action === 'add5') s[statKey] = (s[statKey] || 0) + 5;
    else if (action === 'sub1') s[statKey] = Math.max(0, (s[statKey] || 0) - 1);
    else if (action === 'reset') s[statKey] = 0;
    else if (action === 'set' && valeurDirecte !== null) s[statKey] = Math.max(0, valeurDirecte);

    bridge.demanderSauvegarde();
    return s[statKey];
}

async function handleRouletteStatsInteraction(interaction) {
    if (interaction.user.id !== bridge.EPSYS_ID) {
        return interaction.reply({ content: "Ce panneau est réservé à Epsys 😌", ephemeral: true });
    }

    const id = interaction.customId;

    // 1. Changement de membre ciblé (UserSelectMenu)
    if (id.startsWith('rltpts:user:')) {
        const selectedStat = id.replace('rltpts:user:', '');
        const targetUserId = interaction.values[0];
        const embed = buildRouletteStatsSetEmbed(interaction.guild, targetUserId, selectedStat);
        const components = buildRouletteStatsSetComponents(targetUserId, selectedStat);
        await interaction.update({ embeds: [embed], components });
        return true;
    }

    // 2. Changement de statistique ciblée (StringSelectMenu)
    if (id.startsWith('rltpts:stat:')) {
        const targetUserId = id.replace('rltpts:stat:', '');
        const selectedStat = interaction.values[0];
        const embed = buildRouletteStatsSetEmbed(interaction.guild, targetUserId, selectedStat);
        const components = buildRouletteStatsSetComponents(targetUserId, selectedStat);
        await interaction.update({ embeds: [embed], components });
        return true;
    }

    // 3. Sélection d'un bonus officiel pour plusGrosGain (StringSelectMenu)
    if (id.startsWith('rltpts:gainselect:')) {
        const targetUserId = id.replace('rltpts:gainselect:', '');
        const bonusId = interaction.values[0];
        const entry = ROULETTE_TABLE.find(e => e.id === bonusId);

        if (entry) {
            const proba = probaReelle(entry);
            const { pct } = probaAffichee(proba);
            modifierStatRoulette(targetUserId, 'plusGrosGain', 'set', { nom: entry.nom, proba });
            const feedback = `🏆 Plus gros gain défini sur **${entry.nom}** (${pct}%) !`;
            const embed = buildRouletteStatsSetEmbed(interaction.guild, targetUserId, 'plusGrosGain', feedback);
            const components = buildRouletteStatsSetComponents(targetUserId, 'plusGrosGain');
            await interaction.update({ embeds: [embed], components });
            return true;
        }
    }

    // 4. Actions rapides par boutons (+1, +5, -1, reset)
    if (id.startsWith('rltpts:act:')) {
        const [, , targetUserId, selectedStat, action] = id.split(':');
        const nouveau = modifierStatRoulette(targetUserId, selectedStat, action);

        const actionsTexte = {
            'add1': `✅ **+1** ajouté ! *(Nouvelle valeur : **${nouveau}**)*`,
            'add5': `✅ **+5** ajoutés ! *(Nouvelle valeur : **${nouveau}**)*`,
            'sub1': `➖ **-1** retiré ! *(Nouvelle valeur : **${nouveau}**)*`,
            'reset': `🗑️ **${ROULETTE_STATS_LABELS[selectedStat] || selectedStat}** remis à zéro !`
        };

        const feedback = actionsTexte[action] || `Stat mise à jour : **${nouveau}**`;
        const embed = buildRouletteStatsSetEmbed(interaction.guild, targetUserId, selectedStat, feedback);
        const components = buildRouletteStatsSetComponents(targetUserId, selectedStat);
        await interaction.update({ embeds: [embed], components });
        return true;
    }

    // 5. Ouverture de la Modal de saisie directe
    if (id.startsWith('rltpts:openmodal:')) {
        const [, , targetUserId, selectedStat] = id.split(':');

        if (selectedStat === 'plusGrosGain') {
            const modal = new ModalBuilder()
                .setCustomId(`rltpts:submodal:${targetUserId}:plusGrosGain`)
                .setTitle('Définir le plus gros gain');

            const inputNom = new TextInputBuilder()
                .setCustomId('rltpts_gain_nom')
                .setLabel('Nom du gain')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Ex : 5€ de la YouTube Money')
                .setRequired(true);

            const inputProba = new TextInputBuilder()
                .setCustomId('rltpts_gain_proba')
                .setLabel('Probabilité (en % ou 1/N)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Ex : 0.05 ou 1/3400')
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(inputNom),
                new ActionRowBuilder().addComponents(inputProba)
            );
            await interaction.showModal(modal);
            return true;
        }

        const modal = new ModalBuilder()
            .setCustomId(`rltpts:submodal:${targetUserId}:${selectedStat}`)
            .setTitle('Définir la statistique');

        const input = new TextInputBuilder()
            .setCustomId('rltpts_input_val')
            .setLabel(`Valeur pour ${ROULETTE_STATS_LABELS[selectedStat] || 'la stat'}`)
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Entre un nombre entier (ex: 42)')
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
        return true;
    }

    // 6. Validation de la Modal
    if (interaction.isModalSubmit() && id.startsWith('rltpts:submodal:')) {
        const [, , targetUserId, selectedStat] = id.split(':');

        if (selectedStat === 'plusGrosGain') {
            const nomSaisi = interaction.fields.getTextInputValue('rltpts_gain_nom').trim();
            const probaStr = interaction.fields.getTextInputValue('rltpts_gain_proba').trim();

            let probaNum = 0.01;
            if (probaStr.includes('/')) {
                const denom = parseFloat(probaStr.split('/')[1]);
                if (!isNaN(denom) && denom > 0) probaNum = 1 / denom;
            } else {
                const val = parseFloat(probaStr.replace('%', ''));
                if (!isNaN(val)) probaNum = val > 1 ? val / 100 : val;
            }

            modifierStatRoulette(targetUserId, 'plusGrosGain', 'set', { nom: nomSaisi, proba: probaNum });
            const { pct } = probaAffichee(probaNum);
            const feedback = `✏️ Plus gros gain défini sur **${nomSaisi}** (${pct}%) !`;
            const embed = buildRouletteStatsSetEmbed(interaction.guild, targetUserId, 'plusGrosGain', feedback);
            const components = buildRouletteStatsSetComponents(targetUserId, 'plusGrosGain');
            await interaction.update({ embeds: [embed], components });
            return true;
        }

        const valStr = interaction.fields.getTextInputValue('rltpts_input_val').trim();
        const num = parseInt(valStr, 10);

        if (isNaN(num) || num < 0) {
            return interaction.reply({ content: "❌ Nombre invalide ! Entre un nombre entier positif.", ephemeral: true });
        }

        const nouveau = modifierStatRoulette(targetUserId, selectedStat, 'set', num);
        const feedback = `✏️ **${ROULETTE_STATS_LABELS[selectedStat] || selectedStat}** défini à **${nouveau}** !`;
        const embed = buildRouletteStatsSetEmbed(interaction.guild, targetUserId, selectedStat, feedback);
        const components = buildRouletteStatsSetComponents(targetUserId, selectedStat);
        await interaction.update({ embeds: [embed], components });
        return true;
    }

    return false;
}

// ==========================================
//   LOGIQUE DU PANNEAU !successgive (EPSYS)
// ==========================================

function buildSuccessGiveEmbed(guild, targetUserId, page = 0, feedback = null) {
    const member = guild?.members.cache.get(targetUserId);
    const nom = member?.displayName || `<@${targetUserId}>`;
    const avatar = member?.user?.displayAvatarURL({ dynamic: true, size: 256 }) || null;

    const userAchs = rouletteAchievements.get(targetUserId) ?? {};
    const totalAchs = ROULETTE_ACHIEVEMENTS.length;
    const debloques = Object.keys(userAchs).filter(id => ROULETTE_ACHIEVEMENTS.some(a => a.id === id)).length;

    let desc = `Panneau de restitution et d'attribution des succès pour **${nom}**.\n\n`;
    if (feedback) {
        desc += `🔔 **Dernière action :** ${feedback}\n\n`;
    }

    desc += `📊 **Progression actuelle :** **${debloques} / ${totalAchs} succès** (${Math.round((debloques / totalAchs) * 100)}%)\n` +
            `👉 *Utilise le menu ci-dessous pour sélectionner le ou les succès à débloquer.*`;

    const embed = new EmbedBuilder()
        .setColor(feedback ? 0x2ecc71 : 0xffd700)
        .setTitle(`🎖️ Attribution des Succès — ${nom}`)
        .setDescription(desc)
        .setFooter({ text: `Page ${page + 1}/2 (Succès ${page === 0 ? '1 à 15' : '16 à 30'}) • Commande Epsys-Only` })
        .setTimestamp();

    if (avatar) embed.setThumbnail(avatar);
    return embed;
}

function buildSuccessGiveComponents(targetUserId, page = 0) {
    const userAchs = rouletteAchievements.get(targetUserId) ?? {};
    const PAGE_SIZE = 15;
    const start = page * PAGE_SIZE;
    const tranche = ROULETTE_ACHIEVEMENTS.slice(start, start + PAGE_SIZE);

    // 1. Choix du membre (UserSelectMenu)
    const rowUser = new ActionRowBuilder().addComponents(
        new UserSelectMenuBuilder()
            .setCustomId(`rltgive:user:${page}`)
            .setPlaceholder('👤 Choisir un autre membre...')
    );

    // 2. Sélection des succès de la page
    const options = tranche.map(a => {
        const possede = Boolean(userAchs[a.id]);
        return {
            label: `${possede ? '✅' : '🔒'} ${a.nom}`.slice(0, 100),
            description: a.desc.slice(0, 100),
            value: a.id,
            emoji: a.emoji
        };
    });

    const rowSelect = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`rltgive:select:${targetUserId}:${page}`)
            .setPlaceholder(`🎖️ Choisir les succès à donner (Page ${page + 1}/2)...`)
            .setMinValues(1)
            .setMaxValues(options.length)
            .addOptions(options)
    );

    // 3. Boutons de navigation et actions rapides
    const rowButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`rltgive:page:${targetUserId}:0`)
            .setLabel('📄 Page 1 (1-15)')
            .setStyle(page === 0 ? ButtonStyle.Primary : ButtonStyle.Secondary)
            .setDisabled(page === 0),
        new ButtonBuilder()
            .setCustomId(`rltgive:page:${targetUserId}:1`)
            .setLabel('📄 Page 2 (16-30)')
            .setStyle(page === 1 ? ButtonStyle.Primary : ButtonStyle.Secondary)
            .setDisabled(page === 1),
        new ButtonBuilder()
            .setCustomId(`rltgive:act:${targetUserId}:${page}:all`)
            .setLabel('👑 Tout débloquer (30/30)')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`rltgive:act:${targetUserId}:${page}:clear`)
            .setLabel('🗑️ Tout retirer (0/30)')
            .setStyle(ButtonStyle.Danger)
    );

    return [rowUser, rowSelect, rowButtons];
}

async function handleSuccessGiveInteraction(interaction) {
    if (interaction.user.id !== bridge.EPSYS_ID) {
        return interaction.reply({ content: "Ce panneau est réservé à Epsys 😌", ephemeral: true });
    }

    const id = interaction.customId;

    // 1. Changement de membre (UserSelectMenu)
    if (id.startsWith('rltgive:user:')) {
        const page = parseInt(id.replace('rltgive:user:', ''), 10) || 0;
        const targetUserId = interaction.values[0];
        const cible = interaction.guild?.members.cache.get(targetUserId);
        if (cible?.user?.bot) {
            return interaction.reply({ content: "❌ Tu ne peux pas donner de succès à un bot !", ephemeral: true });
        }
        const embed = buildSuccessGiveEmbed(interaction.guild, targetUserId, page);
        const components = buildSuccessGiveComponents(targetUserId, page);
        await interaction.update({ embeds: [embed], components });
        return true;
    }

    // 2. Sélection de succès à débloquer (StringSelectMenu)
    if (id.startsWith('rltgive:select:')) {
        const [, , targetUserId, pageStr] = id.split(':');
        const page = parseInt(pageStr, 10) || 0;
        const selectionnes = interaction.values;

        let userAchs = rouletteAchievements.get(targetUserId);
        if (!userAchs) {
            userAchs = {};
            rouletteAchievements.set(targetUserId, userAchs);
        }

        const ajoutes = [];
        const now = Date.now();
        for (const achId of selectionnes) {
            if (!userAchs[achId]) {
                userAchs[achId] = now;
                const achObj = ROULETTE_ACHIEVEMENTS.find(a => a.id === achId);
                ajoutes.push(achObj ? `${achObj.emoji} **${achObj.nom}**` : achId);
            }
        }
        rouletteAchievements.set(targetUserId, userAchs);
        bridge.demanderSauvegarde();

        const feedback = ajoutes.length > 0
            ? `✅ **${ajoutes.length} succès attribué(s) :** ${ajoutes.join(', ')}`
            : `ℹ️ Ces succès étaient déjà tous débloqués.`;

        const embed = buildSuccessGiveEmbed(interaction.guild, targetUserId, page, feedback);
        const components = buildSuccessGiveComponents(targetUserId, page);
        await interaction.update({ embeds: [embed], components });
        return true;
    }

    // 3. Changement de page
    if (id.startsWith('rltgive:page:')) {
        const [, , targetUserId, pageStr] = id.split(':');
        const page = parseInt(pageStr, 10) || 0;
        const embed = buildSuccessGiveEmbed(interaction.guild, targetUserId, page);
        const components = buildSuccessGiveComponents(targetUserId, page);
        await interaction.update({ embeds: [embed], components });
        return true;
    }

    // 4. Actions Tout débloquer / Tout retirer
    if (id.startsWith('rltgive:act:')) {
        const [, , targetUserId, pageStr, action] = id.split(':');
        const page = parseInt(pageStr, 10) || 0;

        let feedback = '';
        if (action === 'all') {
            const userAchs = {};
            const now = Date.now();
            for (const a of ROULETTE_ACHIEVEMENTS) {
                userAchs[a.id] = now;
            }
            rouletteAchievements.set(targetUserId, userAchs);
            bridge.demanderSauvegarde();
            feedback = `👑 **Les 30 succès ont tous été débloqués !**`;
        } else if (action === 'clear') {
            rouletteAchievements.delete(targetUserId);
            bridge.demanderSauvegarde();
            feedback = `🗑️ **Tous les succès ont été retirés (0/30).**`;
        }

        const embed = buildSuccessGiveEmbed(interaction.guild, targetUserId, page, feedback);
        const components = buildSuccessGiveComponents(targetUserId, page);
        await interaction.update({ embeds: [embed], components });
        return true;
    }

    return false;
}

function parseRouletteCommand(raw) {
    const tokens = raw.trim().split(/\s+/);
    const first = tokens[0]?.toLowerCase() || '';
    if (!first.startsWith('!')) return null;

    const second = tokens[1]?.toLowerCase() || '';
    const third = tokens[2]?.toLowerCase() || '';

    // !stats set uniquement (on laisse !stats seul passer à YouTube)
    if (first === '!stats' && second === 'set') {
        return { command: '!statsset', args: tokens.slice(2) };
    }
    if (['!statsset', '!setstats', '!rltstatsset', '!roulettestatsset'].includes(first)) {
        return { command: '!statsset', args: tokens.slice(1) };
    }
    if (['!successgive', '!succesgive', '!rltsuccessgive', '!rltsuccesgive'].includes(first)) {
        return { command: '!successgive', args: tokens.slice(1) };
    }

    const directMap = {
        '!rltgo': '!rltgo', '!roulettego': '!rltgo',
        '!rltstate': '!rltstate', '!roulettestate': '!rltstate',
        '!rltstats': '!rltstats', '!roulettestats': '!rltstats',
        '!rlttop': '!rlttop', '!roulettetop': '!rlttop', '!rltleaderboard': '!rlttop', '!rouletteleaderboard': '!rlttop',
        '!rltsucces': '!rltsucces', '!roulettesucces': '!rltsucces', '!rltsuccess': '!rltsucces', '!roulettesuccess': '!rltsucces',
        '!rltclaim': '!rltclaim', '!rouletteclaim': '!rltclaim', '!claim': '!rltclaim',
        '!rltprobas': '!rltprobas', '!rouletteprobas': '!rltprobas', '!rltproba': '!rltprobas', '!rouletteproba': '!rltprobas',
        '!rltnotif': '!rltnotif', '!roulettenotif': '!rltnotif',
        '!rlthelp': '!rlthelp', '!roulettehelp': '!rlthelp',
        '!rlthoftest': '!rlthoftest', '!roulettehoftest': '!rlthoftest',
        '!rlthostest': '!rlthostest', '!roulettehostest': '!rlthostest',
        '!rltvotetest': '!rltvotetest', '!roulettevotetest': '!rltvotetest',
        '!reroll': '!reroll', '!rltreroll': '!reroll', '!roulettereroll': '!reroll',
        '!bonusforce': '!bonusforce', '!rltbonusforce': '!bonusforce',
        '!malusforce': '!malusforce', '!rltmalusforce': '!malusforce',
        '!rltid': '!rltid', '!rouletteid': '!rltid',
        '!itemid': '!itemid', '!rltitemid': '!itemid', '!rouletteitemid': '!itemid',
        '!rltgiveitem': '!rltgiveitem', '!roulettegiveitem': '!rltgiveitem',
        '!resetrlt': '!resetrlt', '!resetroulettestate': '!resetrlt', '!rltreset': '!resetrlt',
        '!removestate': '!removestate', '!rltremovestate': '!removestate',
        '!rltsuccesforce': '!rltsuccesforce', '!roulettesuccesforce': '!rltsuccesforce',
        '!rltsuccessforce': '!rltsuccesforce', '!roulettesuccessforce': '!rltsuccesforce',
        '!rltproxies': '!rltproxies', '!rouletteproxies': '!rltproxies', '!rltppproxies': '!rltproxies',
        '!rltaudit': '!rltaudit', '!rouletteaudit': '!rltaudit',
        '!rltrolltest': '!rltrolltest', '!rouletterolltest': '!rltrolltest',
        '!rolltesthof': '!rolltesthof', '!rltrolltesthof': '!rolltesthof',
        '!rolltesthos': '!rolltesthos', '!rltrolltesthos': '!rolltesthos'
    };

    if (directMap[first]) {
        const mapped = directMap[first];
        if (mapped === '!rltstats' && second === 'set') return { command: '!statsset', args: tokens.slice(2) };
        if (mapped === '!rltstate' && second === 'remove') return { command: '!removestate', args: tokens.slice(2) };
        return { command: mapped, args: tokens.slice(1) };
    }

    if (first === '!bonus' && second === 'force') return { command: '!bonusforce', args: tokens.slice(2) };
    if (first === '!malus' && second === 'force') return { command: '!malusforce', args: tokens.slice(2) };

    if (first === '!rlt' || first === '!roulette') {
        if (second === 'go') return { command: '!rltgo', args: tokens.slice(2) };
        if (second === 'state') return { command: '!rltstate', args: tokens.slice(2) };
        if (second === 'stats') {
            if (third === 'set') return { command: '!statsset', args: tokens.slice(3) };
            return { command: '!rltstats', args: tokens.slice(2) };
        }
        if (second === 'statsset') return { command: '!statsset', args: tokens.slice(2) };
        if (second === 'top' || second === 'leaderboard') return { command: '!rlttop', args: tokens.slice(2) };
        if (second === 'succes' || second === 'success') {
            if (third === 'force') return { command: '!rltsuccesforce', args: tokens.slice(3) };
            if (third === 'give') return { command: '!successgive', args: tokens.slice(3) };
            return { command: '!rltsucces', args: tokens.slice(2) };
        }
        if (second === 'succesforce' || second === 'successforce') return { command: '!rltsuccesforce', args: tokens.slice(2) };
        if (second === 'succesgive' || second === 'successgive') return { command: '!successgive', args: tokens.slice(2) };
        if (second === 'claim') return { command: '!rltclaim', args: tokens.slice(2) };
        if (second === 'probas' || second === 'proba') return { command: '!rltprobas', args: tokens.slice(2) };
        if (second === 'notif') return { command: '!rltnotif', args: tokens.slice(2) };
        if (second === 'help' || second === 'aide' || second === 'commandes') return { command: '!rlthelp', args: tokens.slice(2) };
        if (second === 'hoftest' || (second === 'hof' && third === 'test')) {
            return { command: '!rlthoftest', args: tokens.slice(second === 'hof' ? 3 : 2) };
        }
        if (second === 'hostest' || (second === 'hos' && third === 'test')) {
            return { command: '!rlthostest', args: tokens.slice(second === 'hos' ? 3 : 2) };
        }
        if (second === 'votetest' || (second === 'vote' && third === 'test')) {
            return { command: '!rltvotetest', args: tokens.slice(second === 'vote' ? 3 : 2) };
        }
        if (second === 'reroll') return { command: '!reroll', args: tokens.slice(2) };
        if (second === 'bonusforce' || (second === 'bonus' && third === 'force')) {
            return { command: '!bonusforce', args: tokens.slice(second === 'bonus' ? 3 : 2) };
        }
        if (second === 'malusforce' || (second === 'malus' && third === 'force')) {
            return { command: '!malusforce', args: tokens.slice(second === 'malus' ? 3 : 2) };
        }
        if (second === 'id') return { command: '!rltid', args: tokens.slice(2) };
        if (second === 'itemid' || (second === 'item' && third === 'id')) {
            return { command: '!itemid', args: tokens.slice(second === 'item' ? 3 : 2) };
        }
        if (second === 'giveitem' || (second === 'give' && third === 'item')) {
            return { command: '!rltgiveitem', args: tokens.slice(second === 'give' ? 3 : 2) };
        }
        if (second === 'reset' || second === 'resetstate') return { command: '!resetrlt', args: tokens.slice(2) };
        if (second === 'removestate' || (second === 'remove' && third === 'state')) {
            return { command: '!removestate', args: tokens.slice(second === 'remove' ? 3 : 2) };
        }
        if (second === 'proxies' || second === 'proxy') return { command: '!rltproxies', args: tokens.slice(2) };
        if (second === 'audit') return { command: '!rltaudit', args: tokens.slice(2) };
        if (second === 'rolltest') return { command: '!rltrolltest', args: tokens.slice(2) };
        if (second === 'rolltesthof') return { command: '!rolltesthof', args: tokens.slice(2) };
        if (second === 'rolltesthos') return { command: '!rolltesthos', args: tokens.slice(2) };
        return { command: '!rlt', args: tokens.slice(1) };
    }

    return null;
}

async function handleRouletteMessage(message, response, client, helpers) {
    const adminSuccesAliases = ['!roulettesuccesforce', '!rltsuccesforce', '!roulettesuccessforce', '!rltsuccessforce'];
    const raw = message.content.trim();
    const parsed = parseRouletteCommand(raw);
    if (!parsed) return false;

    const { command, args } = parsed;

    // ==========================================
    //   COMMANDE !stats set (EPSYS-ONLY)
    // ==========================================
    if (command === '!statsset') {
        if (message.author.id !== bridge.EPSYS_ID) {
            await message.reply("Cette commande est réservée à Epsys.");
            return true;
        }

        const query = args.join(" ").trim();
        let cible = message.mentions?.members?.first ? message.mentions.members.first() : null;

        if (!cible) {
            if (!query) {
                cible = message.member;
            } else {
                const findFn = bridge.findMemberByName || helpers?.findMemberByName;
                const askFn = bridge.askDisambiguation || helpers?.askDisambiguation;
                if (findFn) {
                    const result = findFn(message.guild, query);
                    if (result.multiple && askFn) {
                        return askFn(message, message.guild, result.candidates, async (user) => {
                            const mb = message.guild.members.cache.get(user.id);
                            if (mb) {
                                const embed = buildRouletteStatsSetEmbed(message.guild, mb.id, 'tirages');
                                const rows = buildRouletteStatsSetComponents(mb.id, 'tirages');
                                await message.reply({ embeds: [embed], components: rows });
                            }
                        });
                    }
                    cible = result.found;
                }
            }
        }

        if (!cible) {
            await message.reply("Membre introuvable.");
            return true;
        }

        const embed = buildRouletteStatsSetEmbed(message.guild, cible.id, 'tirages');
        const rows = buildRouletteStatsSetComponents(cible.id, 'tirages');
        await message.reply({ embeds: [embed], components: rows });
        return true;
    }

    // ==========================================
    //   COMMANDE !successgive (EPSYS-ONLY)
    // ==========================================
    if (command === '!successgive') {
        if (message.author.id !== bridge.EPSYS_ID) {
            await message.reply("Cette commande est réservée à Epsys.");
            return true;
        }

        const query = args.join(" ").trim();
        let cible = message.mentions?.members?.first ? message.mentions.members.first() : null;

        if (!cible) {
            if (!query) {
                cible = message.member;
            } else {
                const findFn = bridge.findMemberByName || helpers?.findMemberByName;
                const askFn = bridge.askDisambiguation || helpers?.askDisambiguation;
                if (findFn) {
                    const result = findFn(message.guild, query);
                    if (result.multiple && askFn) {
                        return askFn(message, message.guild, result.candidates, async (user) => {
                            const mb = message.guild.members.cache.get(user.id);
                            if (mb) {
                                const embed = buildSuccessGiveEmbed(message.guild, mb.id, 0);
                                const rows = buildSuccessGiveComponents(mb.id, 0);
                                await message.reply({ embeds: [embed], components: rows });
                            }
                        });
                    }
                    cible = result.found;
                }
            }
        }

        if (!cible) {
            await message.reply("Membre introuvable.");
            return true;
        }

        const embed = buildSuccessGiveEmbed(message.guild, cible.id, 0);
        const rows = buildSuccessGiveComponents(cible.id, 0);
        await message.reply({ embeds: [embed], components: rows });
        return true;
    }

    if (['!reroll', '!bonusforce', '!malusforce', '!rouletteid', '!rltid', '!itemid', '!rltitemid', '!rltgiveitem', '!roulettegiveitem', '!resetroulettestate', '!resetrlt', '!removestate', '!rlthoftest', '!rlthostest', '!rltvotetest', '!rltproxies', '!rltaudit', '!rltrolltest', '!rolltesthof', '!rolltesthos', ...adminSuccesAliases].includes(command)) {
        if (message.author.id !== bridge.EPSYS_ID) {
            await message.reply("Cette commande est réservée à Epsys.");
            return true;
        }

        const argsBruts = args;
        if (command === '!rltproxies') {
            const sub = (argsBruts[0] || '').toLowerCase();
            if (sub === 'purge' || sub === 'clear') {
                const removed = purgeRouletteProxies();
                await message.reply({
                    content: `🧹 **Proxies PP Roulette purgés !** (${removed} fichier(s) supprimé(s) dans \`Roulette/Proxies\`).`,
                    flags: [MessageFlags.SuppressNotifications],
                    allowedMentions: { repliedUser: false }
                });
                return true;
            }
            if (['warmup', 'warm', 'build', 'pregen'].includes(sub)) {
                if (rltProxyWarmupRunning) {
                    await message.reply({ content: '⏳ Un warmup des PP Roulette est déjà en cours !', flags: [MessageFlags.SuppressNotifications], allowedMentions: { repliedUser: false } });
                    return true;
                }
                const statusMsg = await message.reply({
                    content: '🔥 **Warmup PP Roulette démarré...**\n⏳ Préparation des avatars membres dans `Roulette/Proxies`...',
                    flags: [MessageFlags.SuppressNotifications],
                    allowedMentions: { repliedUser: false }
                });
                await runRouletteAvatarWarmup(message.guild, async (txt) => {
                    if (statusMsg) await statusMsg.edit({ content: txt }).catch(() => {});
                });
                return true;
            }

            const stats = walkRouletteProxyStats();
            const mb = (stats.bytes / (1024 * 1024)).toFixed(2);
            const statusHeader = rltLastProxyWriteError
                ? `⚠️ **Erreur d'écriture détectée :** \`${rltLastProxyWriteError}\``
                : (stats.files > 0
                    ? '✅ **Volume confirmé :** les PP membres sont bien lues et écrites dans `Roulette/Proxies`.'
                    : 'ℹ️ **Cache vide pour le moment :** lance un warmup pour pré-générer les PP.');

            const rowProxies = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`rlt_proxy:warmup:${bridge.EPSYS_ID}`).setLabel('Pré-générer (Warmup)').setEmoji('🔥').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`rlt_proxy:purge:${bridge.EPSYS_ID}`).setLabel('Purger').setEmoji('🧹').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId(`rlt_proxy:close:${bridge.EPSYS_ID}`).setLabel('Fermer').setEmoji('🗑️').setStyle(ButtonStyle.Secondary)
            );
            await message.reply({
                content:
                    `🗂️ **Proxies PP Roulette (\`Roulette/Proxies\`)**\n` +
                    `${statusHeader}\n\n` +
                    `• **Total disque :** **${stats.files}** PP en cache (**${mb} Mo**)\n` +
                    `• **Micro-cache RAM :** **${rltAvatarProxyRam.size}/${RLT_PROXY_MAX_RAM}** *(TTL 2 min)*\n\n` +
                    `-# Commandes : \`!rltproxies warmup\` • \`!rltproxies purge\``,
                components: [rowProxies],
                flags: [MessageFlags.SuppressNotifications],
                allowedMentions: { repliedUser: false }
            });
            return true;
        }
        if (command === '!itemid' || command === '!rltitemid') {
            const lignes = Object.entries(ROULETTE_ITEMS_METADATA).map(([id, meta]) =>
                `**${meta.label}** — \`${id}\`\n-# *${meta.desc}*`
            );
            const embed = new EmbedBuilder()
                .setColor(0xffd20a)
                .setTitle('🎒 Identifiants des Items (!rltgiveitem)')
                .setDescription(
                    `\`!rltgiveitem [id_item] [ID/@/pseudo] (quantité)\`\n` +
                    `Exemple : \`!rltgiveitem redirectBonusChoix @Epsys\` ou \`!rltgiveitem redirectBonusChoix 390562565417336834 3\`\n\n` +
                    lignes.join('\n\n')
                );
            await message.reply({ embeds: [embed] });
            return true;
        }
        if (command === '!rltgiveitem' || command === '!roulettegiveitem') {
            const giveArgs = argsBruts;
            const rawItemId = giveArgs[0];
            if (!rawItemId) {
                await message.reply(`Usage : \`!rltgiveitem [id_item] [ID/@/pseudo] (quantité)\`\nFais \`!itemid\` pour voir la liste des identifiants.`);
                return true;
            }

            const itemKey = Object.keys(ROULETTE_ITEMS_METADATA).find(k => k.toLowerCase() === rawItemId.toLowerCase());
            if (!itemKey) {
                await message.reply(`❌ Item inconnu : \`${rawItemId}\`. Fais \`!itemid\` pour voir la liste des identifiants.`);
                return true;
            }

            let cibleArgs = giveArgs.slice(1);
            let quantite = 1;
            if (cibleArgs.length >= 2) {
                const dernierArg = cibleArgs[cibleArgs.length - 1];
                if (/^\d+$/.test(dernierArg) && !/^\d{15,22}$/.test(dernierArg)) {
                    const qteParsed = parseInt(dernierArg, 10);
                    if (qteParsed >= 1 && qteParsed <= 1000) {
                        quantite = qteParsed;
                        cibleArgs = cibleArgs.slice(0, -1);
                    }
                }
            }

            const query = cibleArgs.join(" ").trim();
            if (!query) {
                await message.reply(`Usage : \`!rltgiveitem ${itemKey} [ID/@/pseudo] (quantité)\``);
                return true;
            }

            const envoyerConfirmationGiveItem = async (membreCible) => {
                if (!membreCible) {
                    await message.reply("Membre introuvable.");
                    return;
                }
                if (membreCible.user?.bot) {
                    await message.reply("❌ Impossible de donner un item à un bot !");
                    return;
                }
                crediterInventaireRoulette(membreCible.id, itemKey, quantite);
                const stockActuel = rouletteInventaire.get(membreCible.id)?.[itemKey] || quantite;
                await message.reply(
                    `✅ **${quantite}x ${ROULETTE_ITEMS_METADATA[itemKey].label}** (\`${itemKey}\`) ajouté(s) à l'inventaire de <@${membreCible.id}> ! *(Stock actuel : x${stockActuel} — utilisable avec \`!rlt claim\`)*`
                );
            };

            let cible = message.mentions?.members?.first ? message.mentions.members.first() : null;
            if (!cible) {
                const matchId = query.match(/^<@!?(\d{15,22})>$/) || query.match(/^(\d{15,22})$/);
                if (matchId) {
                    const uid = matchId[1];
                    cible = message.guild?.members?.cache?.get(uid)
                        || await message.guild?.members?.fetch?.(uid).catch(() => null);
                } else if (bridge.findMemberByName) {
                    const result = bridge.findMemberByName(message.guild, query);
                    if (result?.multiple && bridge.askDisambiguation) {
                        return bridge.askDisambiguation(message, message.guild, result.candidates, async (user) => {
                            const mb = message.guild.members.cache.get(user.id)
                                || await message.guild.members.fetch(user.id).catch(() => null);
                            await envoyerConfirmationGiveItem(mb);
                        });
                    }
                    cible = result?.found;
                }
            }

            await envoyerConfirmationGiveItem(cible);
            return true;
        }
        if (command === '!reroll') {
            const query = argsBruts.join(" ");
            const cible = message.mentions.members.first() ?? bridge.findMemberByName(message.guild, query).found;
            if (!cible) { await message.reply("Membre introuvable."); return true; }
            rouletteCooldowns.delete(cible.id);
            rouletteFreeRollUntil.delete(cible.id);
            desarmerNotifRoulette(cible.id);
            await message.reply(`Le cooldown de <@${cible.id}> a été réinitialisé ! ✅`);
            return true;
        }
        if (command === '!rouletteid' || command === '!rltid') {
            const embed = buildRouletteTypeEmbed('bonus')
                .setDescription("`!bonusforce [id] [membre]` / `!malusforce [id] [membre]`\nExemple : `!bonusforce couronne @Epsys`\n\n" + buildRouletteTypeEmbed('bonus').data.description);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`roulette_id_bonus_${message.author.id}`).setLabel('🎉 Bonus').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`roulette_id_malus_${message.author.id}`).setLabel('💀 Malus').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId(`roulette_id_special_${message.author.id}`).setLabel('✨ Spécial').setStyle(ButtonStyle.Secondary)
            );
            await message.reply({ embeds: [embed], components: [row] });
            return true;
        }
        if (command === '!rlthoftest' || command === '!rlthostest') {
            const estHof = command === '!rlthoftest';
            const pool = estHof
                ? ROULETTE_TABLE.filter(e => e.type === 'bonus' && probaReelle(e) < ROULETTE_HOF_SEUIL)
                : ROULETTE_TABLE.filter(e => e.type === 'malus' && ROULETTE_HOS_MALUS_IDS.has(e.id));

            let entryTest = null;
            const resteTokens = [];
            for (const tok of argsBruts) {
                const slugId = ROULETTE_NOMS_COMMANDES[tok.toLowerCase()];
                if (!entryTest && slugId) {
                    const candidate = ROULETTE_TABLE.find(e => e.id === slugId);
                    if (candidate && (estHof ? candidate.type === 'bonus' : candidate.type === 'malus')) {
                        entryTest = candidate;
                        continue;
                    }
                }
                resteTokens.push(tok);
            }
            if (!entryTest && pool.length > 0) {
                entryTest = pool[Math.floor(Math.random() * pool.length)];
            }

            const query = resteTokens.join(" ").trim();
            let cible = message.mentions?.members?.first ? message.mentions.members.first() : null;
            if (!cible && query) {
                const matchId = query.match(/^(\d{15,22})$/);
                if (matchId) {
                    cible = message.guild?.members?.cache?.get(matchId[1])
                        || await message.guild?.members?.fetch?.(matchId[1]).catch(() => null);
                } else if (bridge.findMemberByName) {
                    cible = bridge.findMemberByName(message.guild, query).found;
                }
            }
            if (!cible) cible = message.member;

            if (!entryTest) {
                await message.reply({ content: 'Aucune entrée HoF/HoS éligible trouvée.', allowedMentions: { repliedUser: false } });
                return true;
            }

            const payloadTest = estHof
                ? await buildHallOfFamePayload(cible, entryTest, message.member, false, true)
                : await buildHallOfShamePayload(cible, entryTest, message.member, true);

            await message.reply({
                ...payloadTest,
                flags: [MessageFlags.SuppressNotifications],
                allowedMentions: { parse: [], repliedUser: false }
            });
            return true;
        }
        if (command === '!rltvotetest') {
            const query = argsBruts.join(" ").trim();
            let cible = message.mentions?.members?.first ? message.mentions.members.first() : null;
            if (!cible && query) {
                const matchId = query.match(/^(\d{15,22})$/);
                if (matchId) {
                    cible = message.guild?.members?.cache?.get(matchId[1])
                        || await message.guild?.members?.fetch?.(matchId[1]).catch(() => null);
                } else if (bridge.findMemberByName) {
                    cible = bridge.findMemberByName(message.guild, query).found;
                }
            }
            if (!cible) cible = message.member;

            const expireTest = Date.now() + 5 * 60 * 1000;
            const bufTest = await renderRouletteVoteCanvas(cible, 0, 0, expireTest, true).catch(() => null);
            const envoye = await message.reply({
                embeds: [buildVoteRouletteEmbed(cible, 0, 0, expireTest, true)],
                components: [buildVoteRouletteRow(0, 0, false)],
                files: bufTest ? [new AttachmentBuilder(bufTest, { name: 'rlt_vote.jpg' })] : [],
                flags: [MessageFlags.SuppressNotifications],
                allowedMentions: { parse: [], repliedUser: false }
            });
            await demarrerVoteRoulette(envoye, cible, true);
            return true;
        }
        if (command === '!rltaudit') {
            const bgFound = resolveRouletteBgPath();
            const bgOk = Boolean(bgFound && fs.existsSync(bgFound));
            const bgSizeKo = bgOk ? (fs.statSync(bgFound).size / 1024).toFixed(1) : '0';

            const gifsAttendus = [
                'Shield.gif', '777.gif', 'Explosion.gif', 'Tournée.gif',
                'Chat noir.gif', 'Fast.gif', 'TCG.gif', 'Dove.gif',
                'No.gif', 'Luck.gif', 'Mute.gif', 'Cooldown.gif',
                'Laugh.gif', 'Ghost.gif', 'Ban.gif', 'Bandage.gif',
                'Boost.gif', 'Cadeau.gif', 'Élu.gif', 'Frown.gif',
                'Name.gif', 'Papayou.gif', 'Peu.gif', 'Photo.gif',
                'Pin.gif', 'Points.gif', 'Redirection.gif'
            ];
            const gifsOk = [];
            const gifsManquants = [];
            for (const g of gifsAttendus) {
                if (fs.existsSync(path.join(ROULETTE_GIFS_DIR, g))) gifsOk.push(g);
                else gifsManquants.push(g);
            }

            let proxyRwOk = false;
            let proxyErr = null;
            try {
                fs.mkdirSync(ROULETTE_PROXIES_DIR, { recursive: true });
                const probePath = path.join(ROULETTE_PROXIES_DIR, `.audit_${Date.now()}.tmp`);
                fs.writeFileSync(probePath, 'ok');
                const readBack = fs.readFileSync(probePath, 'utf-8');
                fs.rmSync(probePath, { force: true });
                proxyRwOk = readBack === 'ok';
            } catch (err) {
                proxyErr = err.message;
            }
            const proxyStats = walkRouletteProxyStats();
            const proxyMo = (proxyStats.bytes / (1024 * 1024)).toFixed(2);

            const toutOk = bgOk && gifsManquants.length === 0 && proxyRwOk;
            const embedAudit = new EmbedBuilder()
                .setColor(toutOk ? 0x2ecc71 : 0xe67e22)
                .setTitle('🩺 Audit Assets & Permissions Roulette (!rltaudit)')
                .setDescription(
                    `**1. Fond Canvas (\`Roulette/Assets\`)**\n` +
                    `${bgOk ? `✅ \`${path.basename(bgFound)}\` détecté (${bgSizeKo} Ko)` : `❌ \`Background.png\` introuvable dans \`Roulette/Assets\``}\n\n` +
                    `**2. GIFs (\`Roulette/GIFs\`) — ${gifsOk.length}/${gifsAttendus.length}**\n` +
                    `${gifsManquants.length === 0 ? '✅ Tous les GIFs attendus sont présents.' : `❌ Manquants : ${gifsManquants.map(g => `\`${g}\``).join(', ')}`}\n\n` +
                    `**3. Volume Proxies PP (\`Roulette/Proxies\`)**\n` +
                    `${proxyRwOk ? '✅ Lecture & écriture OK' : `❌ Erreur R/W : \`${proxyErr || 'inconnue'}\``}\n` +
                    `• Fichiers en cache : **${proxyStats.files}** (**${proxyMo} Mo**) • RAM : **${rltAvatarProxyRam.size}/${RLT_PROXY_MAX_RAM}**`
                )
                .setFooter({ text: 'Diagnostic Epsys • Aucune donnée modifiée' });

            await message.reply({
                embeds: [embedAudit],
                flags: [MessageFlags.SuppressNotifications],
                allowedMentions: { repliedUser: false }
            });
            return true;
        }
        if (command === '!rltrolltest' || command === '!rolltesthof' || command === '!rolltesthos') {
            const estHof = command === '!rolltesthof';
            const estHos = command === '!rolltesthos';
            let outcomeId = null;
            const resteTokens = [];

            for (const tok of argsBruts) {
                const low = tok.toLowerCase();
                if (!outcomeId) {
                    if (!estHof && !estHos && ['rien', 'nul', 'fail', 'aucun', 'aucun-resultat'].includes(low)) {
                        outcomeId = 'aucun-resultat';
                        continue;
                    }
                    const slugId = ROULETTE_NOMS_COMMANDES[low];
                    const directEntry = ROULETTE_TABLE.find(e => e.id.toLowerCase() === low);
                    const candidateId = slugId || directEntry?.id || null;
                    if (candidateId) {
                        if (estHof && !candidateId.startsWith('bonus-')) {
                            resteTokens.push(tok);
                            continue;
                        }
                        if (estHos && !candidateId.startsWith('malus-')) {
                            resteTokens.push(tok);
                            continue;
                        }
                        outcomeId = candidateId;
                        continue;
                    }
                }
                resteTokens.push(tok);
            }

            if (!outcomeId && estHof) {
                const pool = ROULETTE_TABLE.filter(e => e.type === 'bonus' && probaReelle(e) < ROULETTE_HOF_SEUIL);
                outcomeId = pool[Math.floor(Math.random() * pool.length)]?.id || null;
            } else if (!outcomeId && estHos) {
                const pool = ROULETTE_TABLE.filter(e => e.type === 'malus' && ROULETTE_HOS_MALUS_IDS.has(e.id));
                outcomeId = pool[Math.floor(Math.random() * pool.length)]?.id || null;
            }

            if (!outcomeId) {
                await message.reply({
                    content: 'Usage : `!rltrolltest [slug|id|rien] [@membre]` *(liste des slugs via `!rltid`)*',
                    flags: [MessageFlags.SuppressNotifications],
                    allowedMentions: { repliedUser: false }
                });
                return true;
            }

            const query = resteTokens.join(' ').trim();
            let cible = message.mentions?.members?.first ? message.mentions.members.first() : null;
            if (!cible && query) {
                const matchId = query.match(/^(\d{15,22})$/);
                if (matchId) {
                    cible = message.guild?.members?.cache?.get(matchId[1])
                        || await message.guild?.members?.fetch?.(matchId[1]).catch(() => null);
                } else if (bridge.findMemberByName) {
                    cible = bridge.findMemberByName(message.guild, query).found;
                }
            }
            if (!cible) cible = message.member;

            const entryTest = ROULETTE_TABLE.find(e => e.id === outcomeId);
            const emojiTest = ROULETTE_EMOJIS_PAR_ID[outcomeId] || '✨';
            const previewText = outcomeId === 'aucun-resultat'
                ? ROULETTE_FAILS[Math.floor(Math.random() * ROULETTE_FAILS.length)]
                : `${emojiTest} **${cible.displayName}** — ${entryTest?.desc || entryTest?.nom || outcomeId}\n-# 🧪 *Mode test (\`${command}\`) : aucun effet, stats, pity, Roulettodex ni HoF/HoS appliqué.*`;

            const gifOptionsTest = {
                malusGifSeed: Math.floor(Math.random() * 10000),
                guild: message.guild,
                avatarUrl: cible.displayAvatarURL?.({ dynamic: true }) || undefined
            };
            const embedTest = buildRouletteResultEmbed(outcomeId, previewText, cible.id, cible.displayName, null, gifOptionsTest);
            const gifTest = getRouletteOutcomeGifAttachment(outcomeId, previewText, gifOptionsTest);

            await message.reply({
                embeds: [embedTest],
                files: gifTest ? [gifTest] : [],
                flags: [MessageFlags.SuppressNotifications],
                allowedMentions: { parse: [], repliedUser: false }
            });
            return true;
        }
        if (command === '!bonusforce' || command === '!malusforce') {
            const nom = argsBruts[0]?.toLowerCase();
            const query = argsBruts.slice(1).join(" ");
            const outcomeId = ROULETTE_NOMS_COMMANDES[nom];
            if (!outcomeId) { await message.reply(`Nom inconnu. Fais \`!rltid\` pour voir la liste.`); return true; }
            const attendBonus = command === '!bonusforce';
            const estSpecial = outcomeId.startsWith('special-');
            if (!estSpecial && attendBonus && !outcomeId.startsWith('bonus-')) { await message.reply("Ce nom correspond à un malus. Utilise `!malusforce`."); return true; }
            if (!estSpecial && !attendBonus && !outcomeId.startsWith('malus-')) { await message.reply("Ce nom correspond à un bonus. Utilise `!bonusforce`."); return true; }
            const cible = message.mentions.members.first() ?? bridge.findMemberByName(message.guild, query).found;
            if (!cible) { await message.reply("Membre introuvable."); return true; }

            if (outcomeId === 'bonus-vote-gagnant') {
                crediterInventaireRoulette(cible.id, 'freeRoll1Min', 1);
                deverrouillerSucces(cible.id, 'innocente', message.channel);

                const doveGif = getRouletteGifAsset('Dove.gif', 'rlt_dove.gif');
                const embedVictoire = new EmbedBuilder()
                    .setColor(0x00bf19)
                    .setTitle(`🕊️ JUGEMENT POPULAIRE : INNOCENTÉ.E ! (FORCÉ)`)
                    .setDescription(
                        `Epsys a accordé la grâce présidentielle !\n\n` +
                        `🎉 <@${cible.id}>, tu remportes **1 minute de tirage à volonté** (sans cooldown et immunisé aux mutes) !\n\n` +
                        `🎁 **Si tu ne l'utilises pas tout de suite, ton cadeau sera stocké dans ton inventaire.**\nTape \`!roulette claim\` ou \`!rlt claim\` afin de l'activer !`
                    );
                if (doveGif) embedVictoire.setThumbnail('attachment://rlt_dove.gif');

                const rowVictoire = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`rlt_claim_freeroll_${cible.id}`)
                        .setLabel('🎰 Activer mon tirage (1 min)')
                        .setStyle(ButtonStyle.Success)
                );

                await message.channel.send({
                    content: `🔔 <@${cible.id}>, tu as reçu un bonus de vote public !`,
                    embeds: [embedVictoire],
                    components: [rowVictoire],
                    files: doveGif ? [doveGif] : []
                });
                return true;
            }

            const proxy = { member: cible, channel: message.channel, guild: message.guild };
            const texte = await appliquerEtDecrireResultat(outcomeId, proxy, cible.displayName, 0);
            const entryForcee = ROULETTE_TABLE.find(e => e.id === outcomeId);
            if (attendBonus) envoyerHallOfFame(message.guild, cible, entryForcee).catch(() => {});
            else envoyerHallOfShame(message.guild, cible, entryForcee).catch(() => {});
            if (proxy.vote) {
                const envoye = await message.reply({
                    embeds: [buildVoteRouletteEmbed(proxy.vote)],
                    components: [buildVoteRouletteRow(0, 0, false)]
                });
                await demarrerVoteRoulette(envoye, proxy.vote);
                return true;
            }
            const gifForce = getRouletteOutcomeGifAttachment(outcomeId, texte, {});
            const filesForce = [...(proxy.files ?? [])];
            if (gifForce) filesForce.push(gifForce);
            await message.reply({
                embeds: [buildRouletteResultEmbed(outcomeId, texte, cible.id, cible.displayName)],
                files: filesForce
            });
            return true;
        }
        if (adminSuccesAliases.includes(command)) {
            const sub = argsBruts[0]?.toLowerCase();
            if (sub === 'test') {
                const randomAch = ROULETTE_ACHIEVEMENTS[Math.floor(Math.random() * ROULETTE_ACHIEVEMENTS.length)];
                const embedTest = new EmbedBuilder()
                    .setColor(0xffd700).setTitle('🎊 SUCCÈS DÉVERROUILLÉ ! (TEST)')
                    .setDescription(`<@${message.author.id}> vient d'obtenir le succès **${randomAch.emoji} ${randomAch.nom}** !\n\n*📂 ${randomAch.desc}*`)
                    .setImage('https://cdn.discordapp.com/attachments/1480756332373213275/1555806751448629410/achievement-unlocked_1.gif');
                const rowTest = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`rlt_achs_${message.author.id}_0_${message.author.id}`).setLabel('🎖️ Succès').setStyle(ButtonStyle.Secondary));
                await message.channel.send({ embeds: [embedTest], components: [rowTest] });
                return true;
            }
            if (!sub) {
                const lignes = ROULETTE_ACHIEVEMENTS.map(a => `${a.emoji} **${a.nom}** — \`${a.id}\``);
                const embedList = new EmbedBuilder().setColor(0xffd700).setTitle('🎖️ Identifiants des 30 Succès').setDescription(lignes.join('\n'));
                await message.reply({ embeds: [embedList] });
                return true;
            }
            const ach = ROULETTE_ACHIEVEMENTS.find(a => a.id.toLowerCase() === sub);
            if (!ach) { await message.reply(`Identifiant inconnu : \`${sub}\`.`); return true; }
            const queryMembre = argsBruts.slice(1).join(" ");
            const cible = message.mentions.members.first() ?? (queryMembre ? bridge.findMemberByName(message.guild, queryMembre).found : message.member);
            if (!cible) { await message.reply("Membre introuvable."); return true; }

            let userAchs = rouletteAchievements.get(cible.id) ?? {};
            userAchs[ach.id] = Date.now();
            rouletteAchievements.set(cible.id, userAchs);
            bridge.demanderSauvegarde();

            const embedUnlock = new EmbedBuilder().setColor(0xffd700).setTitle('🎊 SUCCÈS DÉVERROUILLÉ !')
                .setDescription(`<@${cible.id}> vient d'obtenir le succès **${ach.emoji} ${ach.nom}** !\n\n*📂 ${ach.desc}*`)
                .setImage('https://cdn.discordapp.com/attachments/1480756332373213275/1555806751448629410/achievement-unlocked_1.gif');
            const rowUnlock = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`rlt_achs_${cible.id}_0_${cible.id}`).setLabel('🎖️ Succès').setStyle(ButtonStyle.Secondary));
            await message.channel.send({ embeds: [embedUnlock], components: [rowUnlock] });
            await message.reply(`✅ Succès **${ach.nom}** débloqué pour <@${cible.id}> !`);
            return true;
        }
        if (command === '!resetroulettestate' || command === '!resetrlt') {
            const query = argsBruts.join(" ");
            const cible = message.mentions.members.first() ?? bridge.findMemberByName(message.guild, query).found;
            if (!cible) { await message.reply("Membre introuvable."); return true; }

            // Réinitialisation des effets, malus et cooldowns actifs UNIQUEMENT (les stats, succès et préférences restent préservés !)
            const mapsExclues = new Set(['stats', 'achievements', 'suggestions', 'serverState', 'mpOptIn', 'redirectRecus', 'discovered']);
            for (const [cle, map] of Object.entries(ROULETTE_ETATS)) {
                if (!mapsExclues.has(cle) && map && typeof map.delete === 'function') {
                    map.delete(cible.id);
                }
            }

            if (cible.setNickname) await cible.setNickname(null).catch(() => {});
            if (cible.timeout) await cible.timeout(null).catch(() => {});
            await bridge.saveAll();
            await message.reply(`L'état roulette (malus et cooldowns) de <@${cible.id}> a été réinitialisé sans toucher à ses stats ni ses succès ! ✅`);
            return true;
        }
        if (command === '!removestate') {
            const nom = argsBruts[argsBruts.length - 1]?.toLowerCase().replace(/_/g, '-');
            const query = argsBruts.slice(0, -1).join(" ");
            const cible = message.mentions.members.first() ?? bridge.findMemberByName(message.guild, query).found;
            if (!cible) { await message.reply("Membre introuvable."); return true; }

            const id = cible.id;
            let retire = false;

            // 1. Malus de transformations textuelles (boomer, bebe, caps, etc.)
            const tf = rouletteTransfos.get(id);
            const clesTransfos = {
                'boomer': 'boomer', 'bebe': 'bebe', 'baby': 'bebe', 'caps': 'caps',
                'censure': 'censure', 'mots': 'mots', 'mots-melanges': 'mots',
                'lettres': 'lettres', 'lettres-melangees': 'lettres',
                'emojionly': 'emojiOnly', 'emoji-only': 'emojiOnly',
                'limite100': 'limite100', 'limite-100': 'limite100',
                'limite30': 'limite30', 'limite-30': 'limite30',
                'existentiel': 'existentiel', 'linkedin': 'linkedin',
                'sansconsonne': 'sansConsonne', 'sans-consonne': 'sansConsonne',
                'sansvoyelle': 'sansVoyelle', 'sans-voyelle': 'sansVoyelle',
                'mocking': 'mocking', 'begaiement': 'begaiement',
                'publicite': 'publicite', 'autocorrect': 'autocorrect',
                'oyez': 'oyez', 'medieval': 'oyez'
            };

            if (tf && clesTransfos[nom] && tf[clesTransfos[nom]]) {
                delete tf[clesTransfos[nom]];
                if (Object.keys(tf).length === 0) rouletteTransfos.delete(id);
                else rouletteTransfos.set(id, tf);
                retire = true;
            }

            // 2. Pseudo lock & Timeout
            if (nom === 'pseudo-lock' || nom === 'pseudo' || nom === 'pseudolock') {
                const lock = roulettePseudoLock.get(id);
                roulettePseudoLock.delete(id);
                await cible.setNickname(lock?.originalNickname ?? null).catch(() => {});
                retire = true;
            } else if (nom === 'timeout' || nom === 'mute') {
                rouletteTimeoutUntil.delete(id);
                await cible.timeout(null).catch(() => {});
                retire = true;
            }

            // 3. Autres malus & bonus spécifiques
            else if (nom === 'echo') { rouletteEchoUntil.delete(id); retire = true; }
            else if (nom === 'uwu') { rouletteUwuUntil.delete(id); retire = true; }
            else if (nom === 'lettre' || nom === 'lettre-interdite' || nom === 'lettreinterdite') { rouletteLettreInterdite.delete(id); retire = true; }
            else if (nom === 'emoji') { rouletteEmojiUntil.delete(id); retire = true; }
            else if (nom === 'leet' || nom === 'l33t') { rouletteLeetUntil.delete(id); retire = true; }
            else if (nom === 'antifeur' || nom === 'anti-feur') { rouletteAntiFeurUntil.delete(id); retire = true; }
            else if (nom === 'couronne') { rouletteCouronneUntil.delete(id); retire = true; }
            else if (nom === 'bouclier' || nom === 'superbouclier') { rouletteBouclierActif.delete(id); retire = true; }
            else if (nom === 'redirect' || nom === 'redirection') { rouletteRedirectCharges.delete(id); retire = true; }
            else if (nom === 'redirectchoix' || nom === 'redirect-choix') { rouletteRedirectChoixCible.delete(id); retire = true; }
            else if (nom === 'redirectbonuschoix' || nom === 'redirect-bonus-choix' || nom === 'redirectbonus') { rouletteRedirectBonusChoixCible.delete(id); retire = true; }
            else if (nom === 'partagebonus' || nom === 'partage-bonus' || nom === 'partage') { roulettePartageBonusChoixCible.delete(id); retire = true; }
            else if (nom === 'cooldowncourt' || nom === 'cooldown-court') { rouletteCooldownCourtCharges.delete(id); retire = true; }
            else if (nom === 'cooldown45' || nom === 'cooldown-45') { rouletteCooldown45Charges.delete(id); retire = true; }
            else if (nom === 'looongcooldown' || nom === 'looong-cooldown' || nom === 'taxe') { rouletteLooongCooldownCharges.delete(id); retire = true; }
            else if (nom === 'couptriple' || nom === 'coup-triple') { rouletteCoupTripleCharges.delete(id); retire = true; }
            else if (nom === 'freeroll' || nom === 'free-roll') { rouletteFreeRollUntil.delete(id); retire = true; }
            else if (nom === 'diviseur') { rouletteDiviseurUntil.delete(id); retire = true; }
            else if (nom === 'cooldown' || nom === 'cd') { rouletteCooldowns.delete(id); retire = true; }
            else if (nom === 'chatnoir' || nom === 'chat-noir') { retire = true; }
            else if (ROULETTE_ETATS[nom]) { ROULETTE_ETATS[nom].delete(id); retire = true; }

            await bridge.saveAll();

            if (retire) {
                await message.reply(`✅ Effet \`${nom}\` retiré avec succès de <@${id}> !`);
            } else {
                await message.reply(`⚠️ L'effet \`${nom}\` n'était pas actif sur <@${id}> (ou nom inconnu).`);
            }
            return true;
        }
    }

    // Redirection automatique vers le salon dédié de la roulette
    const ROULETTE_COMMANDES_PUBLIQUES = [
        '!rlt', '!rltgo', '!rltstate', '!rltstats', '!rltclaim',
        '!rlttop', '!rltsucces', '!rltprobas', '!rltnotif', '!rlthelp'
    ];

    const estSalonAutorise = message.channel.id === ROULETTE_SALON_ID || message.channel.id === ROULETTE_SALON_ADMIN_ID;
    if (ROULETTE_COMMANDES_PUBLIQUES.includes(command) && !estSalonAutorise) {
        await message.reply(`🎰 <@${message.author.id}>, la roulette et toutes ses commandes se passent exclusivement dans le salon dédié : <#${ROULETTE_SALON_ID}>\n(Si tu n'as pas accès à ce salon, c'est que tu n'as pas encore choisi tes rôles dans <#1559082682313474059>)`);
        return true;
    }

    if (command === '!rltstate') {
        try {
            bridge.trackBattlePassProgress?.(message.author.id, 'rlt_state', 1);
            const query = args.join(" ");
            let cible = message.mentions?.members?.first ? message.mentions.members.first() : null;
            if (!cible) {
                if (!query) cible = message.member;
                else {
                    const result = bridge.findMemberByName ? bridge.findMemberByName(message.guild, query) : null;
                    if (result?.multiple) {
                        return bridge.askDisambiguation(message, message.guild, result.candidates, async (user) => {
                            const membre = message.guild?.members?.cache?.get(user.id);
                            if (membre) {
                                const payload = await buildRouletteStatePayload(membre, message.guild?.id, message.author.id, 'img', false);
                                message.reply({ ...payload, flags: [MessageFlags.SuppressNotifications], allowedMentions: { repliedUser: false } });
                            }
                        });
                    }
                    cible = result?.found;
                }
            }
            if (!cible) { await message.reply("Membre introuvable."); return true; }
            const payload = await buildRouletteStatePayload(cible, message.guild?.id, message.author.id, 'img', false);
            await message.reply({
                ...payload,
                flags: [MessageFlags.SuppressNotifications],
                allowedMentions: { repliedUser: false }
            });
        } catch (err) {
            console.error('Erreur rltstate:', err);
            await message.reply("Une erreur est survenue lors de l'affichage de l'état roulette.").catch(() => {});
        }
        return true;
    }

    if (command === '!rltstats') {
        try {
            const query = args.join(" ");
            let cible = message.mentions?.members?.first ? message.mentions.members.first() : null;
            if (!cible) {
                if (!query) cible = message.member;
                else {
                    const result = bridge.findMemberByName ? bridge.findMemberByName(message.guild, query) : null;
                    if (result?.multiple) {
                        return bridge.askDisambiguation(message, message.guild, result.candidates, async (user) => {
                            const membre = message.guild?.members?.cache?.get(user.id);
                            if (membre) {
                                const payload = await buildRouletteStatsPayload(membre, message.author.id, 'img', false);
                                message.reply({ ...payload, flags: [MessageFlags.SuppressNotifications], allowedMentions: { repliedUser: false } });
                            }
                        });
                    }
                    cible = result?.found;
                }
            }
            if (!cible) { await message.reply("Membre introuvable."); return true; }
            const payload = await buildRouletteStatsPayload(cible, message.author.id, 'img', false);
            await message.reply({
                ...payload,
                flags: [MessageFlags.SuppressNotifications],
                allowedMentions: { repliedUser: false }
            });
        } catch (err) {
            console.error('Erreur rltstats:', err);
            await message.reply("Une erreur est survenue lors de l'affichage des stats roulette.").catch(() => {});
        }
        return true;
    }

    if (command === '!rlttop') {
        try {
            const payload = await buildRouletteTopPayload(message.guild, message.author.id, 'succes', 'img', false);
            await message.reply({
                ...payload,
                flags: [MessageFlags.SuppressNotifications],
                allowedMentions: { repliedUser: false }
            });
        } catch (err) {
            console.error('Erreur rlttop:', err);
            await message.reply("Une erreur est survenue lors de l'affichage du classement roulette.").catch(() => {});
        }
        return true;
    }

    if (command === '!rltsucces') {
        try {
            const query = args.join(" ");
            let cible = message.mentions?.members?.first ? message.mentions.members.first() : null;
            if (!cible) {
                if (!query) cible = message.member;
                else {
                    const result = bridge.findMemberByName ? bridge.findMemberByName(message.guild, query) : null;
                    if (result?.multiple) {
                        return bridge.askDisambiguation(message, message.guild, result.candidates, async (user) => {
                            const membre = message.guild?.members?.cache?.get(user.id);
                            if (membre) {
                                const payload = await buildRouletteAchievementsPayload(membre, 0, message.author.id, 'img', false);
                                message.reply({ ...payload, flags: [MessageFlags.SuppressNotifications], allowedMentions: { repliedUser: false } });
                            }
                        });
                    }
                    cible = result?.found;
                }
            }
            if (!cible) { await message.reply("Membre introuvable."); return true; }
            const payload = await buildRouletteAchievementsPayload(cible, 0, message.author.id, 'img', false);
            await message.reply({
                ...payload,
                flags: [MessageFlags.SuppressNotifications],
                allowedMentions: { repliedUser: false }
            });
        } catch (err) {
            console.error('Erreur rltsucces:', err);
            await message.reply("Une erreur est survenue lors de l'affichage des succès roulette.").catch(() => {});
        }
        return true;
    }

    if (command === '!rltclaim') {
        bridge.trackBattlePassProgress?.(message.author.id, 'rlt_claim_check', 1);
        await message.reply({
            ...buildRouletteInventairePayload(message.member, message.author.id, { home: true, close: true }),
            flags: [MessageFlags.SuppressNotifications],
            allowedMentions: { repliedUser: false }
        });
        return true;
    }

    if (command === '!rltprobas') {
        const payload = buildRoulettePaytablePayload('bonus', 'pres', message.author.id);
        await message.reply({
            ...payload,
            flags: [MessageFlags.SuppressNotifications],
            allowedMentions: { repliedUser: false }
        });
        return true;
    }

    if (command === '!rltnotif') {
        const payload = buildRouletteNotifMenuPayload(message.member, 'pub');
        await message.reply({
            ...payload,
            flags: [MessageFlags.SuppressNotifications],
            allowedMentions: { repliedUser: false }
        });
        return true;
    }

    if (command === '!rlthelp') {
        const payload = buildRouletteCmdsPayload(message.author.id);
        await message.reply({
            ...payload,
            flags: [MessageFlags.SuppressNotifications],
            allowedMentions: { repliedUser: false }
        });
        return true;
    }

    if (command === '!rlt' || command === '!rltgo') {
        if (command === '!rltgo') {
            const resultat = await tirerEtConstruireResultatRoulette(message.author.id, message.guild, message.channel, client);
            if (resultat.cooldown) {
                const notifPayload = buildRouletteNotifMenuPayload(message.member, 'pub');
                await message.reply({
                    ...notifPayload,
                    flags: [MessageFlags.SuppressNotifications],
                    allowedMentions: { repliedUser: false }
                });
                return true;
            }
            // failIfNotExists: false permet de poster dans le salon même si le membre a supprimé son message
            const envoye = await message.reply({
                embeds: resultat.embeds,
                components: resultat.components,
                files: resultat.files ?? [],
                flags: [MessageFlags.SuppressNotifications],
                allowedMentions: { repliedUser: false },
                failIfNotExists: false
            }).catch(() => message.channel.send({
                embeds: resultat.embeds,
                components: resultat.components,
                files: resultat.files ?? [],
                flags: [MessageFlags.SuppressNotifications]
            }).catch(() => null));

            if (!envoye) return true;
            await envoyerPingRedirection(message.channel, resultat);
            memoriserResultatRoulette(envoye.id, resultat.embeds[0], resultat.outcomeId, resultat.gifOptions);
            if (resultat.attenteChoix) rouletteChoixEnAttente.add(envoye.id);
            if (resultat.vote) await demarrerVoteRoulette(envoye, resultat.vote);
            if (resultat.differe) {
                setTimeout(async () => {
                    const embedFinal = await resultat.differe();
                    memoriserResultatRoulette(envoye.id, embedFinal, resultat.outcomeId, resultat.gifOptions);
                    envoye.edit({ embeds: [embedFinal] }).catch(() => {});
                }, 10000);
            }
            return true;
        }

        const hubPayload = buildRouletteHubPayload(message.author.id, message.guild?.id, message.id);
        const sentHub = await message.reply({
            ...hubPayload,
            flags: [MessageFlags.SuppressNotifications],
            allowedMentions: { repliedUser: false },
            failIfNotExists: false
        }).catch(() => message.channel.send({
            ...hubPayload,
            flags: [MessageFlags.SuppressNotifications]
        }).catch(() => null));
        if (sentHub) scheduleRouletteHubAutoDelete(sentHub, message);
        return true;
    }

    return false;
}

async function handleRouletteSlash(interaction, client) {
    const cmd = interaction.commandName;
    const action = cmd === 'roulette' ? interaction.options.getString('action') : null;

    // Redirection si exécutée hors du salon roulette (sauf salon admin epsys-only)
    const estSalonSlashAutorise = interaction.channelId === ROULETTE_SALON_ID || interaction.channelId === ROULETTE_SALON_ADMIN_ID;
    if ((cmd === 'roulette' || cmd === 'rlt') && !estSalonSlashAutorise) {
        await interaction.reply({
            content: `🎰 La roulette et toutes ses commandes sont réservées au salon <#${ROULETTE_SALON_ID}> !`,
            ephemeral: true
        });
        return true;
    }

    if (action === 'claim') {
        const member = interaction.guild?.members.cache.get(interaction.user.id) ?? interaction.member;
        await interaction.reply({
            ...buildRouletteInventairePayload(member, interaction.user.id, { home: true, close: true }),
            flags: [MessageFlags.SuppressNotifications]
        });
        return true;
    }

    if (action === 'stats') {
        await interaction.deferReply();
        const member = interaction.member;
        const payload = await buildRouletteStatsPayload(member, interaction.user.id, 'img', false);
        await interaction.editReply(payload);
        return true;
    }

    if (action === 'state') {
        await interaction.deferReply();
        const member = interaction.member;
        const payload = await buildRouletteStatePayload(member, interaction.guildId, interaction.user.id, 'img', false);
        await interaction.editReply(payload);
        return true;
    }

    if (action === 'top') {
        await interaction.deferReply();
        const payload = await buildRouletteTopPayload(interaction.guild, interaction.user.id, 'succes', 'img', false);
        await interaction.editReply(payload);
        return true;
    }

    if (action === 'succes') {
        await interaction.deferReply();
        const member = interaction.member;
        const payload = await buildRouletteAchievementsPayload(member, 0, interaction.user.id, 'img', false);
        await interaction.editReply(payload);
        return true;
    }

    if (action === 'probas') {
        const payload = buildRoulettePaytablePayload('bonus', 'pres', interaction.user.id);
        await interaction.reply(payload);
        return true;
    }

    if (action === 'help') {
        const payload = buildRouletteCmdsPayload(interaction.user.id);
        await interaction.reply(payload);
        return true;
    }

    if (cmd === 'roulette') {
        if (action === 'go') {
            await interaction.deferReply();
            const res = await tirerEtConstruireResultatRoulette(interaction.user.id, interaction.guild, interaction.channel, client);
            if (res.cooldown) {
                const member = interaction.member || { id: interaction.user.id, displayName: interaction.user.username, user: interaction.user };
                await interaction.editReply({ content: null, ...buildRouletteNotifMenuPayload(member, 'pub') });
                return true;
            }
            const env = await interaction.editReply({ embeds: res.embeds, components: res.components, files: res.files ?? [] });
            await envoyerPingRedirection(interaction.channel, res);
            memoriserResultatRoulette(env.id, res.embeds[0], res.outcomeId, res.gifOptions);
            if (res.attenteChoix) rouletteChoixEnAttente.add(env.id);
            if (res.vote) await demarrerVoteRoulette(env, res.vote);
            if (res.differe) {
                setTimeout(async () => {
                    const embedFinal = await res.differe();
                    memoriserResultatRoulette(env.id, embedFinal, res.outcomeId, res.gifOptions);
                    env.edit({ embeds: [embedFinal] }).catch(() => {});
                }, 10000);
            }
            return true;
        }

        const sentHub = await interaction.reply({ ...buildRouletteHubPayload(interaction.user.id, interaction.guildId), fetchReply: true });
        if (sentHub) scheduleRouletteHubAutoDelete(sentHub);
        return true;
    }

    return false;
}

function annulerMalusSurMembre(userId, outcomeId, member) {
    if (outcomeId.startsWith('malus-timeout-')) {
        rouletteTimeoutUntil.delete(userId);
        member?.timeout(null).catch(() => {});
    } else if (outcomeId === 'malus-cooldown-45') {
        rouletteCooldown45Charges.delete(userId);
    } else if (outcomeId === 'malus-looong-cooldown') {
        rouletteLooongCooldownCharges.delete(userId);
    } else if (outcomeId === 'malus-echo') {
        rouletteEchoUntil.delete(userId);
    } else if (outcomeId === 'malus-uwu-24h') {
        rouletteUwuUntil.delete(userId);
    } else if (outcomeId === 'malus-lettre-interdite') {
        rouletteLettreInterdite.delete(userId);
    } else if (outcomeId === 'malus-emoji') {
        rouletteEmojiUntil.delete(userId);
    } else if (outcomeId === 'malus-leet') {
        rouletteLeetUntil.delete(userId);
    } else {
        const transfoMap = {
            'malus-caps': 'caps',
            'malus-mots-melanges': 'mots',
            'malus-lettres-melangees': 'lettres',
            'malus-censure': 'censure',
            'malus-boomer': 'boomer',
            'malus-bebe': 'bebe',
            'malus-emoji-only': 'emojiOnly',
            'malus-limite-100': 'limite100',
            'malus-limite-30': 'limite30',
            'malus-existentiel': 'existentiel',
            'malus-linkedin': 'linkedin',
            'malus-sans-consonne': 'sansConsonne',
            'malus-sans-voyelle': 'sansVoyelle',
            'malus-mocking': 'mocking',
            'malus-begaiement': 'begaiement',
            'malus-publicite': 'publicite',
            'malus-autocorrect': 'autocorrect',
            'malus-oyez': 'oyez'
        };
        const cleTf = transfoMap[outcomeId];
        if (cleTf) {
            const t = rouletteTransfos.get(userId);
            if (t && t[cleTf]) {
                delete t[cleTf];
                if (Object.keys(t).length === 0) rouletteTransfos.delete(userId);
                else rouletteTransfos.set(userId, t);
            }
        }
    }
}

// Fonctions utilitaires pour l'Échangeur de poison
function listerMalusActifs(userId) {
    const now = Date.now();
    const liste = [];
    const tf = rouletteTransfos.get(userId) ?? {};
    const labelsTf = {
        caps: '🔠 Majuscules', emojiOnly: '🙂 Emoji only', limite100: '✂️ Limite 100 caractères',
        limite30: '✂️ Limite 30 caractères', mots: '🔀 Mots mélangés', lettres: '🔡 Lettres mélangées',
        censure: '▇ Censure', bebe: '🍼 Parler bébé', boomer: '🧓 Mode Boomer',
        existentiel: '🥀 Crise existentielle', linkedin: '👔 Gourou LinkedIn',
        sansConsonne: '🅾️ 0 Consonne', sansVoyelle: '🚫 0 Voyelle',
        mocking: '🤡 Mocking', begaiement: '🗣️ Bégaiement',
        publicite: '📺 Publicité intrusive', autocorrect: '📱 Autocorrect maudit',
        oyez: '📯 Oyez oyez !'
    };
    for (const [k, fin] of Object.entries(tf)) {
        if (now < fin && labelsTf[k]) liste.push({ key: `transfo_${k}`, label: labelsTf[k], dureeRestante: fin - now });
    }
    if (rouletteUwuUntil.has(userId) && now < rouletteUwuUntil.get(userId)) {
        liste.push({ key: 'uwu', label: '😳 UwU obligatoire', dureeRestante: rouletteUwuUntil.get(userId) - now });
    }
    if (rouletteEmojiUntil.has(userId) && now < rouletteEmojiUntil.get(userId)) {
        liste.push({ key: 'emoji', label: '😀 Emoji obligatoire', dureeRestante: rouletteEmojiUntil.get(userId) - now });
    }
    if (rouletteLettreInterdite.has(userId) && now < rouletteLettreInterdite.get(userId).until) {
        const obj = rouletteLettreInterdite.get(userId);
        liste.push({ key: 'lettre', label: `🔤 Lettre interdite (${obj.lettre})`, dureeRestante: obj.until - now });
    }
    if (rouletteLeetUntil.has(userId) && now < rouletteLeetUntil.get(userId)) {
        liste.push({ key: 'leet', label: '🤖 Leet speak', dureeRestante: rouletteLeetUntil.get(userId) - now });
    }
    if (rouletteEchoUntil.has(userId) && now < rouletteEchoUntil.get(userId)) {
        liste.push({ key: 'echo', label: '🪞 Écho condescendant', dureeRestante: rouletteEchoUntil.get(userId) - now });
    }
    if (roulettePseudoLock.has(userId) && now < roulettePseudoLock.get(userId).until) {
        const obj = roulettePseudoLock.get(userId);
        liste.push({ key: 'pseudo', label: `🔒 Pseudo verrouillé (${obj.pseudo})`, dureeRestante: obj.until - now });
    }
    if (rouletteDoubleTempsUntil.has(userId) && now < rouletteDoubleTempsUntil.get(userId)) {
        liste.push({ key: 'doubleTemps', label: '⏳ Malus x2', dureeRestante: rouletteDoubleTempsUntil.get(userId) - now });
    }
    return liste;
}

function transfererMalus(sourceId, destId, malusKey, guild) {
    const now = Date.now();
    let nomMalus = "Malus inconnu";

    if (malusKey.startsWith('transfo_')) {
        const tfKey = malusKey.replace('transfo_', '');
        const tfSource = rouletteTransfos.get(sourceId) ?? {};
        const fin = tfSource[tfKey] || (now + 2 * 60 * 60 * 1000);
        const dureeRestante = Math.max(fin - now, 60 * 1000);
        delete tfSource[tfKey];
        if (Object.keys(tfSource).length === 0) rouletteTransfos.delete(sourceId);
        else rouletteTransfos.set(sourceId, tfSource);

        activerTransfo(destId, tfKey, dureeRestante);
        nomMalus = tfKey;
    } else if (malusKey === 'uwu') {
        const fin = rouletteUwuUntil.get(sourceId) || (now + 6 * 60 * 60 * 1000);
        const dureeRestante = Math.max(fin - now, 60 * 1000);
        rouletteUwuUntil.delete(sourceId);
        rouletteUwuUntil.set(destId, now + dureeRestante);
        nomMalus = "UwU obligatoire";
    } else if (malusKey === 'emoji') {
        const fin = rouletteEmojiUntil.get(sourceId) || (now + 6 * 60 * 60 * 1000);
        const dureeRestante = Math.max(fin - now, 60 * 1000);
        rouletteEmojiUntil.delete(sourceId);
        rouletteEmojiUntil.set(destId, now + dureeRestante);
        nomMalus = "Emoji obligatoire";
    } else if (malusKey === 'lettre') {
        const obj = rouletteLettreInterdite.get(sourceId) || { until: now + 6 * 60 * 60 * 1000, lettre: 'E' };
        const dureeRestante = Math.max(obj.until - now, 60 * 1000);
        rouletteLettreInterdite.delete(sourceId);
        rouletteLettreInterdite.set(destId, { until: now + dureeRestante, lettre: obj.lettre });
        nomMalus = `Lettre interdite (${obj.lettre})`;
    } else if (malusKey === 'leet') {
        const fin = rouletteLeetUntil.get(sourceId) || (now + 6 * 60 * 60 * 1000);
        const dureeRestante = Math.max(fin - now, 60 * 1000);
        rouletteLeetUntil.delete(sourceId);
        rouletteLeetUntil.set(destId, now + dureeRestante);
        nomMalus = "Leet speak";
    } else if (malusKey === 'echo') {
        const fin = rouletteEchoUntil.get(sourceId) || (now + 3 * 60 * 60 * 1000);
        const dureeRestante = Math.max(fin - now, 60 * 1000);
        rouletteEchoUntil.delete(sourceId);
        rouletteEchoUntil.set(destId, now + dureeRestante);
        nomMalus = "Écho condescendant";
    } else if (malusKey === 'pseudo') {
        const lock = roulettePseudoLock.get(sourceId) || { until: now + 48 * 60 * 60 * 1000, pseudo: 'Puff goût paf' };
        const dureeRestante = Math.max(lock.until - now, 60 * 1000);
        roulettePseudoLock.delete(sourceId);
        const memberSource = guild?.members.cache.get(sourceId);
        if (memberSource) memberSource.setNickname(lock.originalNickname ?? null).catch(() => {});

        const memberDest = guild?.members.cache.get(destId);
        const destOriginal = memberDest?.nickname ?? null;
        roulettePseudoLock.set(destId, { until: now + dureeRestante, pseudo: lock.pseudo, originalNickname: destOriginal });
        if (memberDest) memberDest.setNickname(lock.pseudo).catch(() => {});
        nomMalus = `Pseudo verrouillé (${lock.pseudo})`;
    } else if (malusKey === 'doubleTemps') {
        const fin = rouletteDoubleTempsUntil.get(sourceId) || (now + 24 * 60 * 60 * 1000);
        const dureeRestante = Math.max(fin - now, 60 * 1000);
        rouletteDoubleTempsUntil.delete(sourceId);
        rouletteDoubleTempsUntil.set(destId, now + dureeRestante);
        nomMalus = "Malus x2";
    }

    return { nomMalus };
}

async function handleRouletteButton(interaction, client) {
    client = client || interaction.client;
    const customId = interaction.customId;
    if (!customId) return false;

    // Dès qu'on quitte le Hub pour un tirage ou un autre panneau, on annule l'auto-suppression 20 min :
    // seul le Hub resté inactif 20 min s'auto-supprime (les menus secondaires et tirages restent).
    const resteSurHub = customId.startsWith('rlt_hub:claim:') || customId.startsWith('rlt_hub:notif:');
    if (interaction.message?.id && rouletteHubAutoDeleteTimers.has(interaction.message.id) && !resteSurHub) {
        cancelRouletteHubAutoDelete(interaction.message.id);
    }

    if (interaction.isButton() && customId.startsWith('rlt_close:')) {
        const ownerId = customId.split(':')[1];
        if (!canControlRouletteOwner(interaction.user.id, ownerId)) {
            return interaction.reply({ content: "Seul l'auteur de ce menu peut le fermer !", ephemeral: true });
        }
        const msg = interaction.message;
        cancelRouletteHubAutoDelete(msg?.id);
        if (msg?.flags?.has?.(MessageFlags.Ephemeral)) {
            await interaction.update({ content: '🗑️ Menu fermé.', embeds: [], components: [], files: [], attachments: [] }).catch(() => {});
            return true;
        }
        await interaction.deferUpdate().catch(() => {});
        const refId = msg?.reference?.messageId;
        if (refId && msg.channel) {
            const triggerMsg = await msg.channel.messages.fetch(refId).catch(() => null);
            if (triggerMsg && !triggerMsg.author?.bot && canControlRouletteOwner(interaction.user.id, triggerMsg.author?.id)) {
                await triggerMsg.delete().catch(() => {});
            }
        }
        await msg.delete().catch(() => {});
        return true;
    }

    if (interaction.isButton() && (customId === 'rlt_vote_pour' || customId === 'rlt_vote_contre')) {
        const msgId = interaction.message.id;
        const voteData = rouletteVotesPublics.get(msgId);

        if (!voteData) {
            return interaction.reply({ content: "Ce vote est trop ancien ou introuvable.", ephemeral: true });
        }
        if (voteData.cloture || Date.now() >= voteData.expireAt) {
            return interaction.reply({ content: "Ce vote public est déjà clôturé !", ephemeral: true });
        }
        if (!voteData.isTest && interaction.user.id === voteData.targetId) {
            return interaction.reply({ content: "Tu n'as pas le droit de voter sur ton propre sort 😌", ephemeral: true });
        }

        if (!Array.isArray(voteData.pour)) voteData.pour = [];
        if (!Array.isArray(voteData.contre)) voteData.contre = [];

        const userId = interaction.user.id;
        const dejaPour = voteData.pour.includes(userId);
        const dejaContre = voteData.contre.includes(userId);
        const votePour = customId === 'rlt_vote_pour';
        let feedback = '';

        if (votePour) {
            if (dejaPour) {
                voteData.pour = voteData.pour.filter(id => id !== userId);
                feedback = '❌ Vote « Pour » retiré !';
            } else {
                voteData.pour.push(userId);
                voteData.contre = voteData.contre.filter(id => id !== userId);
                feedback = '✅ Tu as voté « Pour » !';
                if (!voteData.isTest && !dejaContre) bridge.trackBattlePassProgress?.(userId, 'vote_public_part', 1);
            }
        } else {
            if (dejaContre) {
                voteData.contre = voteData.contre.filter(id => id !== userId);
                feedback = '❌ Vote « Contre » retiré !';
            } else {
                voteData.contre.push(userId);
                voteData.pour = voteData.pour.filter(id => id !== userId);
                feedback = '❌ Tu as voté « Contre » !';
                if (!voteData.isTest && !dejaPour) bridge.trackBattlePassProgress?.(userId, 'vote_public_part', 1);
            }
        }

        rouletteVotesPublics.set(msgId, voteData);
        if (!voteData.isTest) bridge.demanderSauvegarde();

        await interaction.update({
            components: [buildVoteRouletteRow(voteData.pour.length, voteData.contre.length, false)]
        });
        planifierMajCanvasVoteRoulette(msgId, voteData, client, interaction.guild);
        await interaction.followUp({ content: feedback, ephemeral: true });
        return true;
    }

    if (customId.startsWith('rlt_vote_redirect_')) {
        const parts = customId.split('_');
        const targetUserId = parts[3];
        const outcomeId = parts.slice(4).join('_');

        if (interaction.user.id !== targetUserId) {
            return interaction.reply({ content: "Ce n'est pas ton privilège de vote à utiliser 😌", ephemeral: true });
        }

        const charges = rouletteVoteRedirectCharges.get(targetUserId) || 0;
        if (charges <= 0) {
            return interaction.reply({ content: "Tu n'as plus de charges de redirection de vote disponibles !", ephemeral: true });
        }

        const selectedId = interaction.values[0];
        if (selectedId === targetUserId) {
            return interaction.reply({ content: "❌ Tu ne peux pas te renvoyer le malus à toi-même !", ephemeral: true });
        }

        const cible = interaction.guild?.members.cache.get(selectedId)
            || await interaction.guild?.members?.fetch?.(selectedId).catch(() => null);
        if (!cible) {
            return interaction.reply({ content: "❌ Membre introuvable sur le serveur.", ephemeral: true });
        }
        if (cible.user?.bot) {
            return interaction.reply({ content: "❌ Les bots sont insensibles aux malus de la roulette !", ephemeral: true });
        }
        if (ROULETTE_ROLE_JOUEUR_ID && !cible.roles.cache.has(ROULETTE_ROLE_JOUEUR_ID)) {
            return interaction.reply({ content: `❌ **${cible.displayName}** ne participe pas à la roulette (rôle manquant) !`, ephemeral: true });
        }
        if (estProtegeAntiAcharnement(cible.id)) {
            return interaction.reply({ content: ROULETTE_ANTI_ACHARNEMENT_MSG, ephemeral: true });
        }

        // Décrémente la charge
        const restantes = charges - 1;
        if (restantes <= 0) rouletteVoteRedirectCharges.delete(targetUserId);
        else rouletteVoteRedirectCharges.set(targetUserId, restantes);

        enregistrerRedirectRecu(cible.id);
        notifierMpInteractionRoulette(
            client,
            cible.id,
            `🎯 **${interaction.member.displayName}** a utilisé son privilège de vote populaire pour te rediriger le malus **${ROULETTE_NOMS[outcomeId] || outcomeId}** ! 💀`
        );

        // Succès sniper
        deverrouillerSucces(targetUserId, 'sniper-impitoyable', interaction.channel);

        // Annule le malus sur l'auteur
        annulerMalusSurMembre(targetUserId, outcomeId, interaction.member);

        // Applique le malus sur la cible
        const entryMalusVote = ROULETTE_TABLE.find(e => e.id === outcomeId);
        envoyerHallOfShame(interaction.guild, cible, entryMalusVote, interaction.member).catch(() => {});
        const proxy = { member: cible, channel: interaction.channel, guild: interaction.guild };
        const texteCible = await appliquerEtDecrireResultat(outcomeId, proxy, cible.displayName, 0);

        // Désactive le menu déroulant sur le message d'origine
        const rowDesactive = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('rlt_vote_redir_done')
                .setLabel(`🎯 Redirigé vers ${cible.displayName} !`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
        );
        if (interaction.message?.editable) {
            const rowsMaj = interaction.message.components.map(r => {
                if (r.components.some(c => c.customId?.startsWith('rlt_vote_redirect_'))) {
                    return rowDesactive;
                }
                return r;
            });
            await interaction.message.edit({ components: rowsMaj }).catch(() => {});
        }

        bridge.demanderSauvegarde();

        const resteMsg = restantes > 0 ? ` (${restantes} charge${restantes > 1 ? 's' : ''} restante${restantes > 1 ? 's' : ''})` : ' *(c\'était ta dernière charge !)*';
        await interaction.reply({
            content: `🎯 **${interaction.member.displayName}** utilise son privilège de vote populaire et renvoie le malus **${ROULETTE_NOMS[outcomeId] || outcomeId}** sur <@${cible.id}> !${resteMsg}\n> ${texteCible}`,
            ephemeral: false
        });
        return true;
    }

    if (customId.startsWith('rlt_claim_menu_')) {
        const targetUserId = customId.split('_')[3];
        if (interaction.user.id !== targetUserId) {
            return interaction.reply({ content: "Ce n'est pas ton inventaire 😌", ephemeral: true });
        }

        const itemChoisi = interaction.values[0];

        // Sécurité anti-gaspillage : vérifications avant de consommer l'objet
        if ((itemChoisi === 'coupTriple' || itemChoisi === 'freeRoll1Min') && ROULETTE_COOLDOWN_EXEMPT.includes(targetUserId)) {
            return interaction.reply({
                content: "❌ Tu es déjà exempté.e de cooldown en permanence ! Cet objet reste conservé dans ton inventaire.",
                ephemeral: true
            });
        }

        if (itemChoisi === 'ticketSkip') {
            const finCd = rouletteCooldowns.get(targetUserId);
            if (!finCd || Date.now() >= finCd) {
                return interaction.reply({ content: "❌ Tu n'as aucun cooldown actif à réinitialiser ! Ton **Coupe-file** est conservé dans ton inventaire.", ephemeral: true });
            }
        } else if (itemChoisi === 'eponge') {
            const nowCk = Date.now();
            let aMalus = false;
            if (rouletteUwuUntil.has(targetUserId) && nowCk < rouletteUwuUntil.get(targetUserId)) aMalus = true;
            if (rouletteEmojiUntil.has(targetUserId) && nowCk < rouletteEmojiUntil.get(targetUserId)) aMalus = true;
            if (rouletteLeetUntil.has(targetUserId) && nowCk < rouletteLeetUntil.get(targetUserId)) aMalus = true;
            if (rouletteEchoUntil.has(targetUserId) && nowCk < rouletteEchoUntil.get(targetUserId)) aMalus = true;
            if (rouletteLettreInterdite.has(targetUserId) && nowCk < rouletteLettreInterdite.get(targetUserId).until) aMalus = true;
            for (const fin of Object.values(rouletteTransfos.get(targetUserId) ?? {})) {
                if (nowCk < fin) aMalus = true;
            }
            if (!aMalus) {
                return interaction.reply({ content: "❌ Tu n'as aucun malus textuel actif à effacer ! Ton **Éponge à malus** est conservée dans ton inventaire.", ephemeral: true });
            }
        }

        // Confirmation si un effet identique est déjà actif
        const dejaActifRaison =
            (itemChoisi === 'freeRoll1Min' && Date.now() < (rouletteFreeRollUntil.get(targetUserId) || 0)) ? 'Tirage à volonté (1 min)' :
            (itemChoisi === 'coupTriple' && (rouletteCoupTripleCharges.get(targetUserId) || 0) > 0) ? 'Coup Triple' :
            (itemChoisi === 'miniHH' && (rouletteCooldownCourtCharges.get(targetUserId) || 0) > 0) ? 'Pass Mini Happy-Hour' :
            (itemChoisi === 'trefle20' && (rouletteJackpotBoostCharges.get(targetUserId) || 0) > 0) ? 'Trèfle de Chance (+20%)' :
            null;

        if (dejaActifRaison) {
            const rowConf = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`rlt_claim_confirm:yes:${itemChoisi}:${targetUserId}`)
                    .setLabel('Oui, cumuler quand même')
                    .setEmoji('✅')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`rlt_claim_confirm:no:${targetUserId}`)
                    .setLabel('Non, annuler')
                    .setEmoji('❌')
                    .setStyle(ButtonStyle.Secondary)
            );
            return interaction.reply({
                content: `⚠️ Tu as déjà un effet **${dejaActifRaison}** actif ! Veux-tu vraiment activer celui-ci maintenant pour le cumuler ?`,
                components: [rowConf],
                ephemeral: true
            });
        }

        const consomme = consommerInventaireRoulette(targetUserId, itemChoisi);
        if (!consomme) {
            return interaction.reply({ content: "Tu n'as plus cette récompense en réserve ou elle a déjà été activée !", ephemeral: true });
        }

        let messageConfirmation = "";

        if (itemChoisi === 'bouclier_1') {
            const tot = (rouletteBouclierActif.get(targetUserId) || 0) + 1;
            rouletteBouclierActif.set(targetUserId, tot);
            if (tot >= 10) deverrouillerSucces(targetUserId, 'forteresse', interaction.channel);
            messageConfirmation = `🛡️ **BOUCLIER ACTIVÉ !** <@${targetUserId}> gagne +1 charge de bouclier (${tot} en réserve) !`;
        } else if (itemChoisi === 'bouclier_5') {
            const tot = (rouletteBouclierActif.get(targetUserId) || 0) + 5;
            rouletteBouclierActif.set(targetUserId, tot);
            if (tot >= 10) deverrouillerSucces(targetUserId, 'forteresse', interaction.channel);
            messageConfirmation = `🔰 **PACK DÉFENSE ACTIVÉ !** <@${targetUserId}> gagne +5 charges de bouclier (${tot} en réserve) !`;
        } else if (itemChoisi === 'freeRoll1Min') {
            const nowFr = Date.now();
            const baseFr = Math.max(nowFr, rouletteFreeRollUntil.get(targetUserId) || 0);
            const baseImm = Math.max(nowFr, rouletteImmuniteUntil.get(targetUserId) || 0);
            const nouvelleFin = baseFr + 60 * 1000;
            rouletteFreeRollUntil.set(targetUserId, nouvelleFin);
            rouletteImmuniteUntil.set(targetUserId, baseImm + 60 * 1000);
            desarmerNotifRoulette(targetUserId);
            messageConfirmation = `⚡ **C'EST PARTI !** <@${targetUserId}>, **+1 minute de tirage à volonté** activée (fin <t:${Math.ceil(nouvelleFin / 1000)}:R>) ! Aucun cooldown et immunité aux mutes ! Fais péter \`!rlt go\` ! 🎰`;
        } else if (itemChoisi === 'ticketSkip') {
            rouletteCooldowns.delete(targetUserId);
            desarmerNotifRoulette(targetUserId);
            messageConfirmation = `🎟️ **COUPE-FILE UTILISÉ !** <@${targetUserId}>, ton cooldown roulette est remis à zéro ! Tu peux relancer immédiatement avec \`!rlt go\` ! ⚡`;
        } else if (itemChoisi === 'trefle20') {
            const curCharges = rouletteJackpotBoostCharges.get(targetUserId) || 0;
            const curVal = rouletteJackpotBoostValue.get(targetUserId) || 0;
            rouletteJackpotBoostCharges.set(targetUserId, curCharges + 2);
            rouletteJackpotBoostValue.set(targetUserId, curVal + 0.20);
            bridge.trackBattlePassProgress?.(targetUserId, 'jackpot_haut', 1);
            messageConfirmation = `🍀 **TRÈFLE ACTIVÉ !** <@${targetUserId}>, tu gagnes **+20% de bonus jackpot** sur tes 2 prochains tirages !`;
        } else if (itemChoisi === 'eponge') {
            rouletteTransfos.delete(targetUserId);
            rouletteUwuUntil.delete(targetUserId);
            rouletteLettreInterdite.delete(targetUserId);
            rouletteEmojiUntil.delete(targetUserId);
            rouletteLeetUntil.delete(targetUserId);
            rouletteEchoUntil.delete(targetUserId);
            messageConfirmation = `🧹 **ÉPONGE À MALUS !** <@${targetUserId}> a effacé tous ses malus textuels et peut reparler normalement ! ✨`;
        } else if (itemChoisi === 'miniHH') {
            rouletteCooldownCourtCharges.set(targetUserId, (rouletteCooldownCourtCharges.get(targetUserId) || 0) + 2);
            messageConfirmation = `⚡ **MINI HAPPY-HOUR !** <@${targetUserId}> aura un cooldown réduit à 5 minutes sur ses 2 prochains tirages !`;
        } else if (itemChoisi === 'pityBoost') {
            const pity = roulettePity.get(targetUserId) ?? { malus: 0, nuls: 0 };
            pity.malus++;
            pity.nuls++;
            roulettePity.set(targetUserId, pity);
            messageConfirmation = `📈 **COUP DE POUCE PITY !** La pity de <@${targetUserId}> avance de +1 malus et +1 tirage nul ! Le bonus garanti approche !`;
        } else if (itemChoisi === 'coupTriple') {
            rouletteCooldowns.delete(targetUserId);
            desarmerNotifRoulette(targetUserId);
            const actuelles = rouletteCoupTripleCharges.get(targetUserId) || 0;
            rouletteCoupTripleCharges.set(targetUserId, actuelles + 3);
            messageConfirmation = `🎰 **COUP TRIPLE ACTIVÉ !** <@${targetUserId}> débloque 3 tirages immédiats sans aucun cooldown !`;
        } else if (itemChoisi === 'superBouclier') {
            const tot = (rouletteBouclierActif.get(targetUserId) || 0) + 3;
            rouletteBouclierActif.set(targetUserId, tot);
            if (tot >= 10) deverrouillerSucces(targetUserId, 'forteresse', interaction.channel);
            messageConfirmation = `🔰 **SUPER BOUCLIER ACTIVÉ !** <@${targetUserId}> gagne +3 charges de bouclier (${tot} en réserve) !`;
        } else if (itemChoisi === 'redirectChoix5') {
            const tot = (rouletteRedirectCharges.get(targetUserId) || 0) + 5;
            rouletteRedirectCharges.set(targetUserId, tot);
            messageConfirmation = `🎯 **5 REDIRECTIONS ACTIVÉES !** <@${targetUserId}> ajoute 5 redirections en réserve (${tot} au total) !`;
        } else if (itemChoisi === 'pseudoChoix') {
            const rowUser = new ActionRowBuilder().addComponents(
                buildMenuChoixMembreRoulette(interaction.guild, targetUserId, `rlt_claim_sel_pseudoChoix_${targetUserId}`, '👤 Choisir le membre dont tu veux changer le pseudo...')
            );
            const member = interaction.guild?.members.cache.get(targetUserId) ?? interaction.member;
            const majInv = buildInventaireEmbed(member);
            await interaction.update({ embeds: [majInv.embed], components: majInv.row ? [majInv.row] : [] }).catch(() => {});
            await interaction.followUp({
                content: `✍️ **PSEUDO AU CHOIX (48h) :** Sélectionne ci-dessous le membre du serveur dont tu veux changer le pseudo :`,
                components: [rowUser],
                ephemeral: true
            });
            return true;
        } else if (itemChoisi === 'pseudoLockSemaine') {
            const rowUser = new ActionRowBuilder().addComponents(
                buildMenuChoixMembreRoulette(interaction.guild, targetUserId, `rlt_claim_sel_pseudoLockSemaine_${targetUserId}`, '👤 Choisir le membre dont tu veux verrouiller le pseudo (7 jours)...')
            );
            const member = interaction.guild?.members.cache.get(targetUserId) ?? interaction.member;
            const majInv = buildInventaireEmbed(member);
            await interaction.update({ embeds: [majInv.embed], components: majInv.row ? [majInv.row] : [] }).catch(() => {});
            await interaction.followUp({
                content: `🗿 **GRAVÉ DANS LA ROCHE (7 JOURS) :** Sélectionne ci-dessous le membre du serveur dont tu veux verrouiller le pseudo :`,
                components: [rowUser],
                ephemeral: true
            });
            return true;
        } else if (itemChoisi === 'epingleSalon') {
            messageConfirmation = `📌 **MESSAGE ÉPINGLÉ ACTIVÉ !** <@${targetUserId}>, envoie dans ce salon le message que tu souhaites épingler définitivement (tu as **5 minutes**) !`;
            const collector = interaction.channel.createMessageCollector({
                filter: m => m.author.id === targetUserId,
                time: 5 * 60 * 1000, max: 1
            });
            collector.on('collect', async (m) => {
                await m.pin().catch(() => {});
                deverrouillerSucces(targetUserId, 'epingle', interaction.channel);
                m.reply(`✅ Ton message a été épinglé définitivement dans ce salon !`);
            });
            collector.on('end', (collected, reason) => {
                if (collected.size === 0) {
                    crediterInventaireRoulette(targetUserId, 'epingleSalon', 1);
                    interaction.followUp({ content: `⏳ Temps écoulé ! Ton bonus **Message épinglé** a été replacé dans ton inventaire (\`!rlt claim\`).`, ephemeral: true }).catch(() => {});
                }
            });
        } else if (itemChoisi === 'redirectChoix') {
            const rowUser = new ActionRowBuilder().addComponents(
                buildMenuChoixMembreRoulette(interaction.guild, targetUserId, `rlt_claim_sel_redirectChoix_${targetUserId}`, '🎯 Choisir le membre qui subira ton prochain malus...')
            );
            const member = interaction.guild?.members.cache.get(targetUserId) ?? interaction.member;
            const majInv = buildInventaireEmbed(member);
            await interaction.update({ embeds: [majInv.embed], components: majInv.row ? [majInv.row] : [] }).catch(() => {});
            await interaction.followUp({
                content: `🎯 **REDIRECTION DE MALUS AU CHOIX :** Sélectionne ci-dessous le membre qui subira ton prochain malus à ta place :`,
                components: [rowUser],
                ephemeral: true
            });
            return true;
        } else if (itemChoisi === 'redirectBonusChoix') {
            const rowUser = new ActionRowBuilder().addComponents(
                buildMenuChoixMembreRoulette(interaction.guild, targetUserId, `rlt_claim_sel_redirectBonusChoix_${targetUserId}`, '🎀 Choisir le membre qui recevra ton prochain bonus...')
            );
            const member = interaction.guild?.members.cache.get(targetUserId) ?? interaction.member;
            const majInv = buildInventaireEmbed(member);
            await interaction.update({ embeds: [majInv.embed], components: majInv.row ? [majInv.row] : [] }).catch(() => {});
            await interaction.followUp({
                content: `🎀 **REDIRECTION DE BONUS AU CHOIX :** Sélectionne ci-dessous le membre qui recevra ton prochain bonus à ta place :`,
                components: [rowUser],
                ephemeral: true
            });
            return true;
        } else if (itemChoisi === 'partageBonus') {
            const rowUser = new ActionRowBuilder().addComponents(
                buildMenuChoixMembreRoulette(interaction.guild, targetUserId, `rlt_claim_sel_partageBonus_${targetUserId}`, '🤝 Choisir le membre avec qui partager ton prochain bonus...')
            );
            const member = interaction.guild?.members.cache.get(targetUserId) ?? interaction.member;
            const majInv = buildInventaireEmbed(member);
            await interaction.update({ embeds: [majInv.embed], components: majInv.row ? [majInv.row] : [] }).catch(() => {});
            await interaction.followUp({
                content: `🤝 **PARTAGE DE BONUS AU CHOIX :** Sélectionne ci-dessous le membre avec qui tu souhaites partager ton prochain bonus :`,
                components: [rowUser],
                ephemeral: true
            });
            return true;
        } else if (itemChoisi === 'echangeurPoison') {
            const malusActifs = listerMalusActifs(targetUserId);
            if (malusActifs.length === 0) {
                crediterInventaireRoulette(targetUserId, 'echangeurPoison', 1);
                return interaction.reply({
                    content: "❌ **Aucun malus actif !** Tu n'as aucun malus à transférer pour le moment. Ton **Échangeur de poison** reste dans ton inventaire !",
                    ephemeral: true
                });
            }

            const optionsMalus = malusActifs.map(m => ({
                label: m.label.slice(0, 100),
                description: `Reste : ~${Math.ceil(m.dureeRestante / 60000)} min`.slice(0, 100),
                value: m.key
            }));

            const rowMalus = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`rlt_poison_selmalus_${targetUserId}`)
                    .setPlaceholder('🧪 Choisis le malus que tu veux refiler...')
                    .addOptions(optionsMalus)
            );

            const member = interaction.guild?.members.cache.get(targetUserId) ?? interaction.member;
            const majInv = buildInventaireEmbed(member);
            await interaction.update({ embeds: [majInv.embed], components: majInv.row ? [majInv.row] : [] }).catch(() => {});
            await interaction.followUp({
                content: `🧪 **ÉCHANGEUR DE POISON :** Choisis d'abord le malus que tu souhaites transférer à quelqu'un :`,
                components: [rowMalus],
                ephemeral: true
            });
            return true;
        } else if (itemChoisi === 'diviseur') {
            if (estHappyHour()) {
                crediterInventaireRoulette(targetUserId, 'diviseur', 1);
                return interaction.reply({
                    content: "❌ C'est l'**Happy Hour** ! Le **Diviseur (2h)** ne s'applique pas pendant l'Happy Hour — il reste dans ton inventaire.",
                    ephemeral: true
                });
            }
            const nowDiv = Date.now();
            const baseDiv = Math.max(nowDiv, rouletteDiviseurUntil.get(targetUserId) || 0);
            const finDiv = baseDiv + 2 * 60 * 60 * 1000;
            rouletteDiviseurUntil.set(targetUserId, finDiv);
            const finCdActuel = rouletteCooldowns.get(targetUserId);
            let cdDivNote = '';
            if (finCdActuel && finCdActuel > nowDiv) {
                const restant = Math.ceil((finCdActuel - nowDiv) / 2);
                rouletteCooldowns.set(targetUserId, nowDiv + restant);
                desarmerNotifRoulette(targetUserId);
                cdDivNote = ` Ton cooldown en cours est aussi réduit à **${formatDureeCourte(restant)}** !`;
            }
            messageConfirmation = `➗ **DIVISEUR ACTIVÉ !** <@${targetUserId}>, tous tes cooldowns sont divisés par 2 jusqu'à <t:${Math.ceil(finDiv / 1000)}:R> *(hors Happy Hour, même sous malus)* !${cdDivNote}`;
        } else if (itemChoisi === 'palierUltime') {
            crediterInventaireRoulette(targetUserId, 'freeRoll1Min', 1);
            crediterInventaireRoulette(targetUserId, 'epingleSalon', 1);
            const tot = (rouletteRedirectCharges.get(targetUserId) || 0) + 3;
            rouletteRedirectCharges.set(targetUserId, tot);
            messageConfirmation = `🏆 **PACK PALIER ULTIME DÉBALLÉ !** <@${targetUserId}> a reçu dans son inventaire :\n- 🎰 **1 Tirage à volonté (1 min)**\n- 📌 **1 Message épinglé**\n- 🎯 **+3 Redirections de malus au choix** (total : ${tot}) !`;
        } else {
            messageConfirmation = `✅ **Objet activé !** L'objet de <@${targetUserId}> a été appliqué avec succès.`;
        }

        bridge.demanderSauvegarde();
        if (bridge.trackBattlePassProgress) {
            bridge.trackBattlePassProgress(targetUserId, 'item_consomme', 1);
            if (itemChoisi === 'ticketSkip' || itemChoisi === 'eponge') {
                bridge.trackBattlePassProgress(targetUserId, 'skip_ou_eponge', 1);
            }
        }

        // Met à jour l'embed d'inventaire après consommation en conservant Accueil / Fermer
        const member = interaction.guild?.members.cache.get(targetUserId) ?? interaction.member;
        const isEphInv = Boolean(interaction.message?.flags?.has?.(MessageFlags.Ephemeral));
        await interaction.update(buildRouletteInventairePayload(member, targetUserId, { home: !isEphInv, close: true })).catch(() => {});

        await interaction.followUp({ content: messageConfirmation, ephemeral: false });
        return true;
    }

    if (customId.startsWith('rlt_claim_freeroll_')) {
        const targetUserId = customId.split('_')[3];
        if (interaction.user.id !== targetUserId) {
            return interaction.reply({ content: "Ce n'est pas ton cadeau 😌", ephemeral: true });
        }

        const consomme = consommerInventaireRoulette(targetUserId, 'freeRoll1Min');
        if (!consomme) {
            return interaction.reply({ content: "Tu n'as plus ce bonus en réserve ou il a déjà été activé !", ephemeral: true });
        }

        const nowBtnFr = Date.now();
        const baseBtnFr = Math.max(nowBtnFr, rouletteFreeRollUntil.get(targetUserId) || 0);
        const baseBtnImm = Math.max(nowBtnFr, rouletteImmuniteUntil.get(targetUserId) || 0);
        rouletteFreeRollUntil.set(targetUserId, baseBtnFr + 60 * 1000);
        rouletteImmuniteUntil.set(targetUserId, baseBtnImm + 60 * 1000);
        desarmerNotifRoulette(targetUserId);
        bridge.demanderSauvegarde();

        const rowDesactive = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('rlt_claim_desactive')
                .setLabel('✅ Bonus activé !')
                .setStyle(ButtonStyle.Success)
                .setDisabled(true)
        );

        if (interaction.message?.editable) {
            await interaction.message.edit({ components: [rowDesactive] }).catch(() => {});
        }

        await interaction.reply({
            content: `⚡ **C'EST PARTI !** <@${targetUserId}>, tu as **1 minute chrono** de tirages à volonté et sans aucun cooldown ! Fais péter \`!rlt go\` ou les boutons ! 🎰`,
            ephemeral: false
        });
        return true;
    }

    if (customId.startsWith('rlt_proxy:')) {
        const [, sub, ownerId] = customId.split(':');
        if (interaction.user.id !== ownerId && interaction.user.id !== bridge.EPSYS_ID) {
            return interaction.reply({ content: "Réservé à Epsys 😌", ephemeral: true });
        }
        if (sub === 'close') {
            await interaction.message.delete().catch(() => {});
            return true;
        }
        if (sub === 'purge') {
            const removed = purgeRouletteProxies();
            await interaction.update({
                content: `🧹 **Proxies PP Roulette purgés !** (${removed} fichier(s) supprimé(s) dans \`Roulette/Proxies\`).`,
                components: []
            });
            return true;
        }
        if (sub === 'warmup') {
            if (rltProxyWarmupRunning) {
                return interaction.reply({ content: '⏳ Un warmup est déjà en cours !', ephemeral: true });
            }
            await interaction.update({
                content: '🔥 **Warmup PP Roulette démarré...**\n⏳ Préparation des avatars membres dans `Roulette/Proxies`...',
                components: []
            });
            await runRouletteAvatarWarmup(interaction.guild, async (txt) => {
                await interaction.editReply({ content: txt, components: [] }).catch(() => {});
            });
            return true;
        }
        return true;
    }

    if (customId.startsWith('rlt_hub:')) {
        const [, action, authorId, origMsgId = ''] = customId.split(':');
        if (!canControlRouletteOwner(interaction.user.id, authorId)) {
            return interaction.reply({ content: "Ce n'est pas ton hub roulette 😌", ephemeral: true });
        }

        if (action === 'close') {
            cancelRouletteHubAutoDelete(interaction.message?.id);
            await interaction.message.delete().catch(() => {});
            if (origMsgId && interaction.channel) {
                interaction.channel.messages.fetch(origMsgId).then(m => m.delete().catch(() => {})).catch(() => {});
            }
            return true;
        }

        const member = interaction.member || interaction.guild?.members?.cache?.get(authorId) || await interaction.guild?.members?.fetch?.(authorId).catch(() => null);

        if (action === 'claim') {
            if (interaction.message?.id && rouletteHubAutoDeleteTimers.has(interaction.message.id)) {
                scheduleRouletteHubAutoDelete(interaction.message);
            }
            await interaction.reply({
                ...buildRouletteInventairePayload(member, authorId, { home: false, close: true }),
                ephemeral: true
            });
            return true;
        }

        if (action === 'notif') {
            if (interaction.message?.id && rouletteHubAutoDeleteTimers.has(interaction.message.id)) {
                scheduleRouletteHubAutoDelete(interaction.message);
            }
            await interaction.reply({ ...buildRouletteNotifMenuPayload(member, 'ephem'), ephemeral: true });
            return true;
        }

        if (action === 'home') {
            const payload = buildRouletteHubPayload(authorId, interaction.guildId, origMsgId);
            await interaction.update({ content: null, ...payload, files: [], attachments: [] });
            if (interaction.message) scheduleRouletteHubAutoDelete(interaction.message);
            return true;
        }

        if (action === 'guide') {
            const payload = buildRouletteGuidePayload(authorId);
            await interaction.update({ ...payload, files: [], attachments: [] });
            return true;
        }

        if (action === 'cmds') {
            const payload = buildRouletteCmdsPayload(authorId);
            await interaction.update({ ...payload, files: [], attachments: [] });
            return true;
        }

        if (action === 'probas') {
            const payload = buildRoulettePaytablePayload('bonus', 'hub', authorId);
            await interaction.update({ ...payload, files: [], attachments: [] });
            return true;
        }

        if (action === 'state') {
            await interaction.deferUpdate();
            const payload = await buildRouletteStatePayload(member, interaction.guildId, authorId, 'img', true);
            await interaction.editReply({ ...payload, files: payload.files ?? [], attachments: [] });
            return true;
        }

        if (action === 'stats') {
            await interaction.deferUpdate();
            const payload = await buildRouletteStatsPayload(member, authorId, 'img', true);
            await interaction.editReply({ ...payload, files: payload.files ?? [], attachments: [] });
            return true;
        }

        if (action === 'succes') {
            await interaction.deferUpdate();
            const payload = await buildRouletteAchievementsPayload(member, 0, authorId, 'img', true);
            await interaction.editReply({ ...payload, files: payload.files ?? [], attachments: [] });
            return true;
        }

        if (action === 'top') {
            await interaction.deferUpdate();
            const payload = await buildRouletteTopPayload(interaction.guild, authorId, 'succes', 'img', true);
            await interaction.editReply({ ...payload, files: payload.files ?? [], attachments: [] });
            return true;
        }
        return true;
    }

    if (customId.startsWith('rlt_view:')) {
        const parts = customId.split(':');
        const type = parts[1];

        if (type === 'stats' || type === 'state') {
            const [, , targetId, nextView, authorId, hubFlag = '0'] = parts;
            if (interaction.user.id !== authorId) return interaction.reply({ content: "Ce n'est pas ta commande !", ephemeral: true });
            const cible = interaction.guild?.members?.cache?.get(targetId) || await interaction.guild?.members?.fetch?.(targetId).catch(() => null);
            if (!cible) return interaction.reply({ content: "Membre introuvable.", ephemeral: true });
            await interaction.deferUpdate();
            const payload = type === 'stats'
                ? await buildRouletteStatsPayload(cible, authorId, nextView, hubFlag === '1')
                : await buildRouletteStatePayload(cible, interaction.guildId, authorId, nextView, hubFlag === '1');
            await interaction.editReply({ ...payload, files: payload.files ?? [], attachments: [] });
            return true;
        }

        if (type === 'succes') {
            const [, , targetId, nextView, pageStr, authorId, hubFlag = '0'] = parts;
            if (interaction.user.id !== authorId) return interaction.reply({ content: "Ce n'est pas ta commande !", ephemeral: true });
            const cible = interaction.guild?.members?.cache?.get(targetId) || await interaction.guild?.members?.fetch?.(targetId).catch(() => null);
            if (!cible) return interaction.reply({ content: "Membre introuvable.", ephemeral: true });
            await interaction.deferUpdate();
            const payload = await buildRouletteAchievementsPayload(cible, parseInt(pageStr, 10) || 0, authorId, nextView, hubFlag === '1');
            await interaction.editReply({ ...payload, files: payload.files ?? [], attachments: [] });
            return true;
        }

        if (type === 'top') {
            const [, , nextView, mode, authorId, hubFlag = '0'] = parts;
            if (interaction.user.id !== authorId) return interaction.reply({ content: "Ce n'est pas ta commande !", ephemeral: true });
            await interaction.deferUpdate();
            const payload = await buildRouletteTopPayload(interaction.guild, authorId, mode, nextView, hubFlag === '1');
            await interaction.editReply({ ...payload, files: payload.files ?? [], attachments: [] });
            return true;
        }
        return true;
    }

    if (customId.startsWith('rlt_top_mode:')) {
        const [, view, authorId, hubFlag = '0'] = customId.split(':');
        if (interaction.user.id !== authorId) return interaction.reply({ content: "Ce n'est pas ton classement !", ephemeral: true });
        const mode = interaction.values[0];
        await interaction.deferUpdate();
        const payload = await buildRouletteTopPayload(interaction.guild, authorId, mode, view, hubFlag === '1');
        await interaction.editReply({ ...payload, files: payload.files ?? [], attachments: [] });
        return true;
    }

    if (customId.startsWith('rlt_probas:')) {
        const [, ctx, cat, authorId, outcomeId = '', failIndex = '0'] = customId.split(':');
        if (interaction.user.id !== authorId) return interaction.reply({ content: "C'est pas ton tirage 😌", ephemeral: true });
        const payload = buildRoulettePaytablePayload(cat, ctx, authorId, outcomeId, failIndex);
        const components = [...(payload.components || [])];
        if (ctx === 'res' && rouletteChoixEnAttente.has(interaction.message.id) && components.length < 5) {
            components.unshift(buildMenuFallbackRoulette(authorId));
        }
        await interaction.update({ embeds: payload.embeds, components, files: [], attachments: [] });
        return true;
    }

    if (customId.startsWith('rlt_claim_confirm:')) {
        const parts = customId.split(':');
        const decision = parts[1];
        if (decision === 'no') {
            const ownerId = parts[2];
            if (interaction.user.id !== ownerId) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true });
            return interaction.update({ content: '👌 D\'accord, l\'objet reste bien au chaud dans ton inventaire.', components: [] });
        }
        const itemChoisi = parts[2];
        const targetUserId = parts[3];
        if (interaction.user.id !== targetUserId) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true });

        const consomme = consommerInventaireRoulette(targetUserId, itemChoisi);
        if (!consomme) {
            return interaction.update({ content: "❌ Tu n'as plus cet objet dans ton inventaire.", components: [] });
        }
        let msgConf = '';
        if (itemChoisi === 'freeRoll1Min') {
            const nowFr = Date.now();
            const baseFr = Math.max(nowFr, rouletteFreeRollUntil.get(targetUserId) || 0);
            const baseImm = Math.max(nowFr, rouletteImmuniteUntil.get(targetUserId) || 0);
            const nouvelleFin = baseFr + 60 * 1000;
            rouletteFreeRollUntil.set(targetUserId, nouvelleFin);
            rouletteImmuniteUntil.set(targetUserId, baseImm + 60 * 1000);
            desarmerNotifRoulette(targetUserId);
            msgConf = `⚡ **C'EST PARTI !** <@${targetUserId}>, **+1 minute de tirage à volonté** ajoutée (fin <t:${Math.ceil(nouvelleFin / 1000)}:R>) ! 🎰`;
        } else if (itemChoisi === 'coupTriple') {
            rouletteCooldowns.delete(targetUserId);
            desarmerNotifRoulette(targetUserId);
            const actuelles = rouletteCoupTripleCharges.get(targetUserId) || 0;
            rouletteCoupTripleCharges.set(targetUserId, actuelles + 3);
            msgConf = `🎰 **COUP TRIPLE CUMULÉ !** <@${targetUserId}> passe à **${actuelles + 3} tirages** sans aucun cooldown !`;
        } else if (itemChoisi === 'miniHH') {
            const tot = (rouletteCooldownCourtCharges.get(targetUserId) || 0) + 2;
            rouletteCooldownCourtCharges.set(targetUserId, tot);
            msgConf = `⚡ **MINI HAPPY-HOUR CUMULÉ !** <@${targetUserId}> passe à **${tot} tirages** à 5 minutes de cooldown !`;
        } else if (itemChoisi === 'trefle20') {
            const curCharges = rouletteJackpotBoostCharges.get(targetUserId) || 0;
            const curVal = rouletteJackpotBoostValue.get(targetUserId) || 0;
            rouletteJackpotBoostCharges.set(targetUserId, curCharges + 2);
            rouletteJackpotBoostValue.set(targetUserId, curVal + 0.20);
            bridge.trackBattlePassProgress?.(targetUserId, 'jackpot_haut', 1);
            msgConf = `🍀 **TRÈFLE CUMULÉ !** <@${targetUserId}> passe à **+${Math.round((curVal + 0.20) * 100)}%** sur **${curCharges + 2} tirages** !`;
        }
        bridge.demanderSauvegarde();
        bridge.trackBattlePassProgress?.(targetUserId, 'item_consomme', 1);
        await interaction.update({ content: '✅ Objet activé !', components: [] });
        await interaction.channel?.send({ content: msgConf, flags: [MessageFlags.SuppressNotifications] }).catch(() => {});
        return true;
    }

    if (customId.startsWith('rlt_inspect_')) {
        const parts = customId.split('_');
        const type = parts[2];
        const authorId = parts[3];
        const view = parts[4] || 'img';
        const fromHub = parts[5] === '1';
        if (interaction.user.id !== authorId) {
            return interaction.reply({ content: "Ce n'est pas ton menu d'inspection 😌", ephemeral: true });
        }

        const cibleId = interaction.values[0];
        if (cibleId === 'aucun') return interaction.reply({ content: "Aucun autre joueur éligible à inspecter.", ephemeral: true });
        const cible = interaction.guild.members.cache.get(cibleId) || await interaction.guild.members.fetch(cibleId).catch(() => null);
        if (!cible) return interaction.reply({ content: "Membre introuvable sur le serveur.", ephemeral: true });
        if (cible.user?.bot) return interaction.reply({ content: "❌ Impossible d'inspecter un bot !", ephemeral: true });

        await interaction.deferUpdate();
        if (type === 'state') {
            const payload = await buildRouletteStatePayload(cible, interaction.guildId, authorId, view, fromHub);
            await interaction.editReply({ ...payload, files: payload.files ?? [], attachments: [] });
            return true;
        } else if (type === 'stats') {
            const payload = await buildRouletteStatsPayload(cible, authorId, view, fromHub);
            await interaction.editReply({ ...payload, files: payload.files ?? [], attachments: [] });
            return true;
        } else if (type === 'succes') {
            const payload = await buildRouletteAchievementsPayload(cible, 0, authorId, view, fromHub);
            await interaction.editReply({ ...payload, files: payload.files ?? [], attachments: [] });
            return true;
        }
        return true;
    }

    if (customId.startsWith('rlt_secretachs_')) {
        const parts = customId.split('_');
        const cibleId = parts[2];
        const authorId = parts[3];
        const view = parts[4] || 'img';
        const fromHub = parts[5] === '1';
        if (interaction.user.id !== authorId) return interaction.reply({ content: "Ce n'est pas ta commande !", ephemeral: true });
        const cible = interaction.guild.members.cache.get(cibleId) || await interaction.guild.members.fetch(cibleId).catch(() => null);
        if (!cible) return interaction.reply({ content: "Membre introuvable.", ephemeral: true });
        await interaction.update(buildRouletteSecretAchievementsPayload(cible, authorId, view, fromHub));
        return true;
    }

    if (customId.startsWith('rlt_dex:')) {
        const [, cibleId, cat, pageStr, authorId, hubFlag = '0'] = customId.split(':');
        if (!canControlRouletteOwner(interaction.user.id, authorId)) return interaction.reply({ content: "Ce n'est pas ta commande !", ephemeral: true });
        await interaction.deferUpdate();
        const cible = interaction.guild.members.cache.get(cibleId) || await interaction.guild.members.fetch(cibleId).catch(() => null);
        if (!cible) return interaction.followUp({ content: "Membre introuvable.", ephemeral: true });
        await interaction.editReply({
            ...buildRouletteDexPayload(cible, cat, parseInt(pageStr, 10) || 0, authorId, hubFlag === '1'),
            files: [],
            attachments: []
        });
        return true;
    }

    if (customId.startsWith('rlt_achs_')) {
        const parts = customId.split('_');
        const cibleId = parts[2];
        const page = parseInt(parts[3], 10) || 0;
        const authorId = parts[4];
        const view = parts[5] || 'img';
        const fromHub = parts[6] === '1';
        if (interaction.user.id !== authorId) return interaction.reply({ content: "Ce n'est pas ta commande !", ephemeral: true });
        const cible = interaction.guild.members.cache.get(cibleId) || await interaction.guild.members.fetch(cibleId).catch(() => null);
        if (!cible) return interaction.reply({ content: "Membre introuvable.", ephemeral: true });
        await interaction.deferUpdate();
        const payload = await buildRouletteAchievementsPayload(cible, page, authorId, view, fromHub);
        await interaction.editReply({ ...payload, files: payload.files ?? [], attachments: [] });
        return true;
    }
    if (customId.startsWith('rlt_stats_back_')) {
        const parts = customId.split('_');
        const cibleId = parts[3];
        const authorId = parts[4];
        const fromHub = parts[5] === '1';
        if (interaction.user.id !== authorId) return interaction.reply({ content: "Ce n'est pas ta commande !", ephemeral: true });
        const cible = interaction.guild.members.cache.get(cibleId) || await interaction.guild.members.fetch(cibleId).catch(() => null);
        if (!cible) return interaction.reply({ content: "Membre introuvable.", ephemeral: true });
        await interaction.deferUpdate();
        const payload = await buildRouletteStatsPayload(cible, authorId, 'img', fromHub);
        await interaction.editReply({ ...payload, files: payload.files ?? [], attachments: [] });
        return true;
    }
    if (customId.startsWith('roulette_id_')) {
        const [, , type, authorId] = customId.split('_');
        if (interaction.user.id !== authorId) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true });
        await interaction.update({ embeds: [buildRouletteTypeEmbed(type)] });
        return true;
    }
    if (customId.startsWith('roulette_probas_pres_')) {
        const authorId = customId.split('_')[3];
        if (interaction.user.id !== authorId) return interaction.reply({ content: "C'est pas ton tirage 😌", ephemeral: true });
        const payload = buildRoulettePaytablePayload('bonus', 'pres', authorId);
        await interaction.update({ ...payload, files: [], attachments: [] });
        return true;
    }
    if (customId.startsWith('roulette_back_pres_')) {
        const authorId = customId.split('_')[3];
        if (!canControlRouletteOwner(interaction.user.id, authorId)) return interaction.reply({ content: "C'est pas ton tirage 😌", ephemeral: true });
        const payload = buildRouletteHubPayload(authorId, interaction.guildId);
        await interaction.update({ content: null, ...payload, files: [], attachments: [] });
        if (interaction.message) scheduleRouletteHubAutoDelete(interaction.message);
        return true;
    }
    if (customId.startsWith('roulette_tenter_')) {
        const authorId = customId.split('_')[2];
        if (interaction.user.id !== authorId) return interaction.reply({ content: "C'est pas ton tirage 😌", ephemeral: true });
        const res = await tirerEtConstruireResultatRoulette(authorId, interaction.guild, interaction.channel, client);
        if (res.cooldown) {
            const member = interaction.member || { id: authorId, displayName: interaction.user.username, user: interaction.user };
            await interaction.reply({ ...buildCooldownQuickUsePayload(member, res.finCooldown), ephemeral: true });
            return true;
        }
        await interaction.deferUpdate();
        await interaction.editReply({ content: null, embeds: res.embeds, components: res.components, files: res.files ?? [], attachments: [] });
        await envoyerPingRedirection(interaction.channel, res);
        memoriserResultatRoulette(interaction.message.id, res.embeds[0], res.outcomeId, res.gifOptions);
        if (res.attenteChoix) rouletteChoixEnAttente.add(interaction.message.id);
        if (res.vote) await demarrerVoteRoulette(interaction.message, res.vote);
        if (res.differe) {
            setTimeout(async () => {
                const embedFinal = await res.differe();
                memoriserResultatRoulette(interaction.message.id, embedFinal, res.outcomeId, res.gifOptions);
                interaction.message.edit({ embeds: [embedFinal] }).catch(() => {});
            }, 10000);
        }
        return true;
    }
    if (customId.startsWith('roulette_fallback_')) {
        const authorId = customId.split('_')[2];
        if (interaction.user.id !== authorId) return interaction.reply({ content: "C'est pas ton tirage 😌", ephemeral: true });
        await interaction.deferUpdate();
        const outcomeId = interaction.values[0];
        const auteurNom = interaction.member?.displayName ?? interaction.user.username;
        const proxy = { member: interaction.member, channel: interaction.channel, guild: interaction.guild };
        const texte = await appliquerEtDecrireResultat(outcomeId, proxy, auteurNom, 0);
        const embed = buildRouletteResultEmbed(outcomeId, texte, authorId, auteurNom, null, {});
        const gifFallback = getRouletteOutcomeGifAttachment(outcomeId, texte, {});
        const filesFallback = [...(proxy.files ?? [])];
        if (gifFallback) filesFallback.push(gifFallback);
        const hasNotif = aUneNotifRouletteActive(authorId);
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`roulette_probas_res_${authorId}_${outcomeId}_0`).setLabel('🎲 Probabilités').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('roulette_notif:menu')
                .setLabel(hasNotif ? 'Alertes ✓' : 'Alertes')
                .setEmoji('🔔')
                .setStyle(hasNotif ? ButtonStyle.Primary : ButtonStyle.Secondary)
        );
        rouletteChoixEnAttente.delete(interaction.message.id);
        memoriserResultatRoulette(interaction.message.id, embed, outcomeId, {});
        await interaction.editReply({ embeds: [embed], components: [row], files: filesFallback, attachments: [] });
        return true;
    }
    if (customId.startsWith('roulette_notif:')) {
        const [, sub, ownerId, ctx = 'ephem'] = customId.split(':');

        if (sub === 'menu') {
            const member = interaction.member || { id: interaction.user.id, displayName: interaction.user.username, user: interaction.user };
            await interaction.reply({
                ...buildRouletteNotifMenuPayload(member, 'ephem'),
                ephemeral: true
            });
            return true;
        }

        if (ownerId && interaction.user.id !== ownerId) {
            return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true });
        }

        const userId = ownerId || interaction.user.id;
        const member = interaction.member || { id: userId, displayName: interaction.user.username, user: interaction.user };
        const fin = rouletteCooldowns.get(userId) ?? 0;

        if (sub === 'mp_int_toggle') {
            const actif = Boolean(rouletteMpOptIn.get(userId));
            if (actif) rouletteMpOptIn.delete(userId);
            else rouletteMpOptIn.set(userId, true);
            bridge.demanderSauvegarde();
            await interaction.update({
                content: null,
                ...buildRouletteNotifMenuPayload(
                    member,
                    ctx,
                    !actif
                        ? '📩 *Alertes MP d\'interactions activées !*'
                        : '🔕 *Alertes MP d\'interactions désactivées.*'
                )
            });
            return true;
        }

        if (sub === 'repeat_on') {
            rouletteNotifRepeat.set(userId, true);
            const target = rouletteNotifs.get(userId) || rouletteNotifTarget.get(userId) || interaction.channelId;
            rouletteNotifTarget.set(userId, target);
            if (Date.now() < fin) {
                rouletteNotifs.set(userId, target);
                armerNotifRoulette(userId, target, client);
            }
            bridge.demanderSauvegarde();
            await interaction.update({
                content: null,
                ...buildRouletteNotifMenuPayload(member, ctx, '🔁 *Rappel automatique activé pour **tous tes prochains tirages** !*')
            });
            return true;
        }

        if (sub === 'repeat_off') {
            rouletteNotifRepeat.delete(userId);
            bridge.demanderSauvegarde();
            await interaction.update({
                content: null,
                ...buildRouletteNotifMenuPayload(member, ctx, '1️⃣ *Mode ponctuel activé : tu ne seras prévenu·e **qu\'une seule fois**.*')
            });
            return true;
        }

        if (sub === 'off') {
            desarmerNotifRoulette(userId);
            rouletteNotifRepeat.delete(userId);
            bridge.demanderSauvegarde();
            await interaction.update({
                content: null,
                ...buildRouletteNotifMenuPayload(member, ctx, '🔕 *Notification roulette désactivée.*')
            });
            return true;
        }

        if (Date.now() >= fin) {
            desarmerNotifRoulette(userId);
            await interaction.update({
                content: null,
                ...buildRouletteNotifMenuPayload(member, ctx, '✅ *Ton cooldown roulette est déjà terminé ! Tu peux relancer dès maintenant.*')
            });
            return true;
        }

        const modeChannel = sub === 'dm' ? 'MP' : interaction.channelId;
        rouletteNotifs.set(userId, modeChannel);
        rouletteNotifTarget.set(userId, modeChannel);
        armerNotifRoulette(userId, modeChannel, client);
        bridge.demanderSauvegarde();

        const note = `✅ *C'est noté ! Je te préviendrai **${sub === 'dm' ? 'en MP' : 'dans ce salon'}** <t:${Math.ceil(fin / 1000)}:R>.*`;
        await interaction.update({
            content: null,
            ...buildRouletteNotifMenuPayload(member, ctx, note)
        });
        return true;
    }

    // Rétrocompatibilité avec les anciens boutons "Me prévenir" déjà postés dans le salon
    if (customId.startsWith('roulette_notif_mp') || customId.startsWith('roulette_notifmp_')) {
        const userId = interaction.user.id;
        const fin = rouletteCooldowns.get(userId) ?? 0;
        if (Date.now() >= fin) return interaction.reply({ content: "Ton cooldown est déjà terminé ! 🎰", ephemeral: true });

        rouletteNotifs.set(userId, 'MP');
        armerNotifRoulette(userId, 'MP', client);
        bridge.demanderSauvegarde();
        const member = interaction.member || { id: userId, displayName: interaction.user.username, user: interaction.user };
        await interaction.reply({
            ...buildRouletteNotifMenuPayload(member, 'ephem', `✅ *C'est noté ! Je te préviendrai **en MP** <t:${Math.ceil(fin / 1000)}:R>.*`),
            ephemeral: true
        });
        return true;
    }

    if (customId.startsWith('roulette_notif')) {
        const userId = interaction.user.id;
        const fin = rouletteCooldowns.get(userId) ?? 0;
        if (Date.now() >= fin) return interaction.reply({ content: "Ton cooldown est déjà terminé ! 🎰", ephemeral: true });

        rouletteNotifs.set(userId, interaction.channelId);
        armerNotifRoulette(userId, interaction.channelId, client);
        bridge.demanderSauvegarde();
        const member = interaction.member || { id: userId, displayName: interaction.user.username, user: interaction.user };
        await interaction.reply({
            ...buildRouletteNotifMenuPayload(member, 'ephem', `✅ *C'est noté ! Je te préviendrai **dans ce salon** <t:${Math.ceil(fin / 1000)}:R>.*`),
            ephemeral: true
        });
        return true;
    }
    if (customId.startsWith('roulette_claim_btn_')) {
        const member = interaction.member;
        return interaction.reply({
            ...buildRouletteInventairePayload(member, interaction.user.id, { home: false, close: true }),
            ephemeral: true
        });
    }

    if (customId.startsWith('rlt_quickskip:')) {
        const parts = customId.split(':');
        const decision = parts[1];
        if (decision === 'no') {
            const ownerId = parts[2];
            if (interaction.user.id !== ownerId) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true });
            return interaction.update({ content: "👌 D'accord, ton objet reste dans ton inventaire !", components: [] });
        }

        const itemKey = parts[2];
        const userId = parts[3];
        if (interaction.user.id !== userId) return interaction.reply({ content: "Pas pour toi 😌", ephemeral: true });

        const consomme = consommerInventaireRoulette(userId, itemKey);
        if (!consomme) {
            return interaction.update({ content: "❌ Tu n'as plus cet objet dans ton inventaire.", components: [] });
        }

        if (itemKey === 'ticketSkip') {
            rouletteCooldowns.delete(userId);
            desarmerNotifRoulette(userId);
        } else if (itemKey === 'freeRoll1Min') {
            const nowFr = Date.now();
            const baseFr = Math.max(nowFr, rouletteFreeRollUntil.get(userId) || 0);
            const baseImm = Math.max(nowFr, rouletteImmuniteUntil.get(userId) || 0);
            rouletteFreeRollUntil.set(userId, baseFr + 60 * 1000);
            rouletteImmuniteUntil.set(userId, baseImm + 60 * 1000);
            desarmerNotifRoulette(userId);
        }
        bridge.trackBattlePassProgress?.(userId, 'item_consomme', 1);
        if (itemKey === 'ticketSkip') bridge.trackBattlePassProgress?.(userId, 'skip_ou_eponge', 1);

        const res = await tirerEtConstruireResultatRoulette(userId, interaction.guild, interaction.channel, client);
        if (res.cooldown) {
            crediterInventaireRoulette(userId, itemKey, 1);
            return interaction.update({ content: "❌ Impossible de lancer le tirage maintenant, objet recrédité.", components: [] });
        }

        const gifOptsMaj = {
            ...(res.gifOptions || {}),
            ticketSkipUsed: itemKey === 'ticketSkip',
            freeRollUsed: itemKey === 'freeRoll1Min'
        };
        const embedMaj = buildRouletteResultEmbed(
            res.outcomeId,
            res.embeds[0]?.data?.description || '',
            userId,
            interaction.member?.displayName ?? interaction.user.username,
            null,
            gifOptsMaj
        );
        // On conserve le texte exact de l'embed généré en y ajoutant la mention coupe-file / tirage 1 min
        const tagUtilise = itemKey === 'ticketSkip'
            ? '-# 🎟️ Ticket coupe-file utilisé'
            : '-# ⚡ Tirage à volonté (1 min) activé';
        const descActuelle = res.embeds[0]?.data?.description || '';
        if (descActuelle && !descActuelle.includes(tagUtilise)) {
            res.embeds[0].setDescription(`${descActuelle}\n${tagUtilise}`);
        }
        res.gifOptions = gifOptsMaj;

        await interaction.update({
            content: itemKey === 'ticketSkip'
                ? '🎟️ **Ticket coupe-file utilisé !** Ton tirage vient d\'être lancé dans le salon.'
                : '⚡ **Tirage à volonté (1 min) activé !** Ton tirage vient d\'être lancé dans le salon.',
            components: []
        });

        const envoye = await interaction.channel.send({
            embeds: res.embeds,
            components: res.components,
            files: res.files ?? [],
            flags: [MessageFlags.SuppressNotifications]
        }).catch(() => null);
        if (!envoye) return true;

        await envoyerPingRedirection(interaction.channel, res);
        memoriserResultatRoulette(envoye.id, res.embeds[0], res.outcomeId, res.gifOptions);
        if (res.attenteChoix) rouletteChoixEnAttente.add(envoye.id);
        if (res.vote) await demarrerVoteRoulette(envoye, res.vote);
        if (res.differe) {
            setTimeout(async () => {
                const embedFinal = await res.differe();
                const dFin = embedFinal?.data?.description || '';
                if (dFin && !dFin.includes(tagUtilise)) embedFinal.setDescription(`${dFin}\n${tagUtilise}`);
                memoriserResultatRoulette(envoye.id, embedFinal, res.outcomeId, res.gifOptions);
                envoye.edit({ embeds: [embedFinal] }).catch(() => {});
            }, 10000);
        }
        return true;
    }

    if (customId === 'roulette_tour') {
        const clickerId = interaction.user.id;
        const res = await tirerEtConstruireResultatRoulette(clickerId, interaction.guild, interaction.channel, client);
        if (res.cooldown) {
            const member = interaction.member || { id: clickerId, displayName: interaction.user.username, user: interaction.user };
            return interaction.reply({
                ...buildCooldownQuickUsePayload(member, res.finCooldown),
                ephemeral: true
            });
        }

        await interaction.reply({ content: "🎲 Tirage envoyé dans le salon !", ephemeral: true }).catch(() => {});

        const envoye = await interaction.channel.send({
            embeds: res.embeds,
            components: res.components,
            files: res.files ?? [],
            flags: [MessageFlags.SuppressNotifications]
        }).catch(() => null);
        if (!envoye) return true;

        await envoyerPingRedirection(interaction.channel, res);
        memoriserResultatRoulette(envoye.id, res.embeds[0], res.outcomeId, res.gifOptions);
        if (res.attenteChoix) rouletteChoixEnAttente.add(envoye.id);
        if (res.vote) await demarrerVoteRoulette(envoye, res.vote);
        if (res.differe) {
            setTimeout(async () => {
                const embedFinal = await res.differe();
                memoriserResultatRoulette(envoye.id, embedFinal, res.outcomeId, res.gifOptions);
                envoye.edit({ embeds: [embedFinal] }).catch(() => {});
            }, 10000);
        }
        return true;
    }

    if (interaction.customId && interaction.customId.startsWith('rltpts:')) {
        return await handleRouletteStatsInteraction(interaction);
    }

    if (interaction.customId && interaction.customId.startsWith('rltgive:')) {
        return await handleSuccessGiveInteraction(interaction);
    }

    // Gestion du menu de sélection contextuel pour les bonus d'inventaire
    if (customId.startsWith('rlt_claim_sel_')) {
        const [, , , actionType, targetUserId] = customId.split('_');
        if (interaction.user.id !== targetUserId) {
            return interaction.reply({ content: "Ce n'est pas ton bonus à configurer 😌", ephemeral: true });
        }
        const selectedId = interaction.values[0];
        if (selectedId === 'aucun') {
            crediterInventaireRoulette(targetUserId, actionType, 1);
            bridge.demanderSauvegarde();
            return interaction.update({ content: "❌ Aucun autre membre éligible trouvé sur le serveur. Ton objet a été remis dans ton inventaire !", components: [] });
        }
        const cible = interaction.guild?.members.cache.get(selectedId)
            || await interaction.guild?.members?.fetch?.(selectedId).catch(() => null);
        if (!cible) {
            return interaction.reply({ content: "❌ Membre introuvable sur le serveur.", ephemeral: true });
        }
        if (cible.user?.bot) {
            return interaction.reply({ content: "❌ Tu ne peux pas sélectionner un bot !", ephemeral: true });
        }
        if (ROULETTE_ROLE_JOUEUR_ID && !cible.roles.cache.has(ROULETTE_ROLE_JOUEUR_ID)) {
            return interaction.reply({ content: `❌ **${cible.displayName}** ne participe pas à la roulette (rôle manquant) ! Choisis un.e autre joueur.euse.`, ephemeral: true });
        }

        if (actionType === 'redirectChoix') {
            if (cible.id === targetUserId) {
                return interaction.reply({ content: "❌ Tu ne peux pas te renvoyer ton propre malus à toi-même !", ephemeral: true });
            }
            if (estProtegeAntiAcharnement(cible.id)) {
                return interaction.reply({ content: ROULETTE_ANTI_ACHARNEMENT_MSG, ephemeral: true });
            }
            const liste = ajouterCibleListe(rouletteRedirectChoixCible, targetUserId, cible.id);
            bridge.demanderSauvegarde();
            const resumeCibles = liste.map(id => `<@${id}>`).join(', ');
            await interaction.update({
                content: `✅ C'est enregistré ! Le prochain malus de **${interaction.member.displayName}** sera automatiquement envoyé à : ${resumeCibles} (${liste.length} redirection${liste.length > 1 ? 's' : ''} cumulée${liste.length > 1 ? 's' : ''}) !`,
                components: []
            });
            return true;
        }

        if (actionType === 'redirectBonusChoix') {
            if (cible.id === targetUserId) {
                return interaction.reply({ content: "❌ Tu ne peux pas te rediriger ton bonus à toi-même !", ephemeral: true });
            }
            const liste = ajouterCibleListe(rouletteRedirectBonusChoixCible, targetUserId, cible.id);
            bridge.demanderSauvegarde();
            const resumeCibles = liste.map(id => `<@${id}>`).join(', ');
            await interaction.update({
                content: `✅ C'est enregistré ! Le prochain bonus de **${interaction.member.displayName}** sera automatiquement offert à : ${resumeCibles} (${liste.length} redirection${liste.length > 1 ? 's' : ''} cumulée${liste.length > 1 ? 's' : ''}) !`,
                components: []
            });
            return true;
        }

        if (actionType === 'partageBonus') {
            if (cible.id === targetUserId) {
                return interaction.reply({ content: "❌ Tu ne peux pas partager ton bonus avec toi-même !", ephemeral: true });
            }
            const liste = ajouterCibleListe(roulettePartageBonusChoixCible, targetUserId, cible.id);
            bridge.demanderSauvegarde();
            const resumeCibles = liste.map(id => `<@${id}>`).join(', ');
            await interaction.update({
                content: `✅ C'est enregistré ! Le prochain bonus de **${interaction.member.displayName}** sera automatiquement partagé avec : ${resumeCibles} (${liste.length} partage${liste.length > 1 ? 's' : ''} cumulé${liste.length > 1 ? 's' : ''}) ! 🤝`,
                components: []
            });
            return true;
        }

        if (actionType === 'pseudoChoix' || actionType === 'pseudoLockSemaine') {
            const dureeStr = actionType === 'pseudoLockSemaine' ? '7j' : '48h';
            const modal = new ModalBuilder()
                .setCustomId(`rlt_modal_pseudolock:${targetUserId}:${cible.id}:${dureeStr}`)
                .setTitle(`Pseudo de ${cible.displayName}`.slice(0, 45));

            const input = new TextInputBuilder()
                .setCustomId('nouveau_pseudo_val')
                .setLabel(`Nouveau pseudo (verrouillé ${dureeStr === '7j' ? '7 jours' : '48h'})`)
                .setStyle(TextInputStyle.Short)
                .setMaxLength(32)
                .setPlaceholder('Ex : SansPlomb95')
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(input));
            await interaction.showModal(modal);
            return true;
        }
    }

    // Interception Échangeur de poison : sélection du malus
    if (customId.startsWith('rlt_poison_selmalus_')) {
        const targetUserId = customId.split('_')[3];
        if (interaction.user.id !== targetUserId) {
            return interaction.reply({ content: "Ce n'est pas ton objet 😌", ephemeral: true });
        }
        const malusChoisi = interaction.values[0];
        const rowUser = new ActionRowBuilder().addComponents(
            buildMenuChoixMembreRoulette(interaction.guild, targetUserId, `rlt_poison_seluser_${targetUserId}_${malusChoisi}`, '🎯 Choisis le membre qui recevra ce malus...')
        );
        await interaction.update({
            content: `🎯 **ÉCHANGEUR DE POISON :** Sélectionne maintenant le membre du serveur qui va subir ce malus à ta place :`,
            components: [rowUser]
        });
        return true;
    }

    // Interception Échangeur de poison : sélection du membre
    if (customId.startsWith('rlt_poison_seluser_')) {
        const parts = customId.split('_');
        const targetUserId = parts[3];
        const malusKey = parts.slice(4).join('_');

        if (interaction.user.id !== targetUserId) {
            return interaction.reply({ content: "Ce n'est pas ton objet 😌", ephemeral: true });
        }

        const selectedId = interaction.values[0];
        if (selectedId === 'aucun') {
            crediterInventaireRoulette(targetUserId, 'echangeurPoison', 1);
            bridge.demanderSauvegarde();
            return interaction.update({ content: "❌ Aucun autre membre éligible trouvé sur le serveur. Ton **Échangeur de poison** a été remis dans ton inventaire !", components: [] });
        }
        const cible = interaction.guild?.members.cache.get(selectedId)
            || await interaction.guild?.members?.fetch?.(selectedId).catch(() => null);
        if (!cible) return interaction.reply({ content: "❌ Membre introuvable sur le serveur.", ephemeral: true });
        if (cible.user?.bot) return interaction.reply({ content: "❌ Tu ne peux pas transférer de malus à un bot !", ephemeral: true });
        if (cible.id === targetUserId) return interaction.reply({ content: "❌ Tu ne peux pas t'envoyer ton propre malus !", ephemeral: true });
        if (ROULETTE_ROLE_JOUEUR_ID && !cible.roles.cache.has(ROULETTE_ROLE_JOUEUR_ID)) {
            return interaction.reply({ content: `❌ **${cible.displayName}** ne participe pas à la roulette (rôle manquant) !`, ephemeral: true });
        }
        if (estProtegeAntiAcharnement(cible.id)) {
            return interaction.reply({ content: ROULETTE_ANTI_ACHARNEMENT_MSG, ephemeral: true });
        }

        const transfertResult = transfererMalus(targetUserId, cible.id, malusKey, interaction.guild);
        enregistrerRedirectRecu(cible.id);
        bridge.demanderSauvegarde();

        notifierMpInteractionRoulette(
            client,
            cible.id,
            `🧪 **${interaction.member.displayName}** a utilisé un **Échangeur de poison** et t'a transféré son malus **${transfertResult.nomMalus}** ! 😈`
        );

        await interaction.update({
            content: `🧪 **POISON ÉCHANGÉ !** Le malus **${transfertResult.nomMalus}** a été retiré de <@${targetUserId}> et transféré sur <@${cible.id}> ! 😈`,
            components: []
        });

        const { MessageFlags } = require('discord.js');
        await interaction.channel.send({
            content: `🧪 **ÉCHANGEUR DE POISON :** <@${targetUserId}> s'est débarrassé de son malus **${transfertResult.nomMalus}** et l'a refilé à <@${cible.id}> !`,
            flags: [MessageFlags.SuppressNotifications]
        }).catch(() => {});
        return true;
    }

    // Validation de la modal de saisie de pseudo
    if (interaction.isModalSubmit() && interaction.customId.startsWith('rlt_modal_pseudolock:')) {
        const [, targetUserId, cibleId, dureeStr] = interaction.customId.split(':');
        const nouveauPseudo = interaction.fields.getTextInputValue('nouveau_pseudo_val').trim();
        const cible = interaction.guild?.members.cache.get(cibleId)
            || await interaction.guild?.members?.fetch?.(cibleId).catch(() => null);
        if (!cible) return interaction.reply({ content: "Membre introuvable.", ephemeral: true });

        const lockExistant = roulettePseudoLock.get(cible.id);
        const originalNickname = lockExistant?.originalNickname !== undefined ? lockExistant.originalNickname : (cible.nickname ?? null);
        const dureeMs = dureeStr === '7j' ? 7 * 24 * 60 * 60 * 1000 : 48 * 60 * 60 * 1000;
        const labelDuree = dureeStr === '7j' ? '7 jours' : '48h';

        roulettePseudoLock.set(cible.id, { until: Date.now() + dureeMs, pseudo: nouveauPseudo, originalNickname });
        await cible.setNickname(nouveauPseudo).catch(() => {});
        deverrouillerSucces(targetUserId, 'baptiseur', interaction.channel);
        bridge.demanderSauvegarde();

        await interaction.reply({
            content: `✅ <@${cible.id}> est renommé·e en **${nouveauPseudo}** par <@${targetUserId}>, verrouillé pendant **${labelDuree}** !`,
            ephemeral: false
        });
        return true;
    }

    if (customId.startsWith('roulette_probas_res_')) {
        const [, , , authorId, outcomeId, failIndex] = customId.split('_');
        const payload = buildRoulettePaytablePayload('bonus', 'res', interaction.user.id, outcomeId, failIndex);
        await interaction.reply({ ...payload, ephemeral: true });
        return true;
    }
    if (customId.startsWith('roulette_back_res_')) {
        const [, , , authorId, outcomeId, failIndex] = customId.split('_');
        if (interaction.user.id !== authorId) return interaction.reply({ content: "C'est pas ton tirage 😌", ephemeral: true });
        const memo = rouletteResultats.get(interaction.message.id);
        let embed = memo?.embed || (memo?.data ? memo : null);
        const storedOutcomeId = memo?.outcomeId || outcomeId;
        const gifOptions = memo?.gifOptions || {};
        if (!embed) {
            const auteurNom = interaction.guild?.members.cache.get(authorId)?.displayName ?? interaction.user.username;
            const nom = ROULETTE_NOMS[storedOutcomeId] ?? storedOutcomeId;
            const texte = storedOutcomeId === 'aucun-resultat' ? ROULETTE_FAILS[parseInt(failIndex, 10)] : `**${auteurNom}** est tombé·e sur **${nom}**.`;
            embed = buildRouletteResultEmbed(storedOutcomeId, texte, authorId, auteurNom, null, gifOptions);
        }
        const gifBack = getRouletteOutcomeGifAttachment(storedOutcomeId, embed?.data?.description || '', gifOptions);
        const row = buildRowResultatRoulette(authorId, outcomeId, failIndex);
        const components = rouletteChoixEnAttente.has(interaction.message.id) ? [buildMenuFallbackRoulette(authorId), row] : [row];
        await interaction.update({ embeds: [embed], components, files: gifBack ? [gifBack] : [], attachments: [] });
        return true;
    }
    return false;
}

async function handleRouletteCouronne(message, dernierAuteurParSalon) {
    if (!message.guild || message.webhookId) return;
    const precedentId = dernierAuteurParSalon.get(message.channel.id);
    dernierAuteurParSalon.set(message.channel.id, message.author.id);
    if (message.author.bot) return;

    const finCouronne = rouletteCouronneUntil.get(message.author.id);
    if (!finCouronne) return;
    if (Date.now() >= finCouronne) {
        rouletteCouronneUntil.delete(message.author.id);
        return;
    }
    if (precedentId === message.author.id) return;
    await message.react('👑').catch(() => {});
}

async function handleRouletteTransfoMessage(message, client) {
    if (message.webhookId || message.author.bot || !message.guild) return;
    if (!message.content) return;
    if (estSalonExcluMalusTexte(message.channel)) return;
    if (estMessageExempte(message.content)) return;

    const id = message.author.id;
    const now = Date.now();

    // Détection de fin de mute roulette pour la quête "Victime exemplaire"
    if (rouletteTimeoutUntil.has(id) && now >= rouletteTimeoutUntil.get(id)) {
        rouletteTimeoutUntil.delete(id);
        bridge.trackBattlePassProgress?.(id, 'mute_survecu', 1);
    }

    // Effet Écho Condescendant (1 chance sur 3)
    let echoReplique = null;
    const finEcho = rouletteEchoUntil.get(id);
    if (finEcho) {
        if (now >= finEcho) {
            rouletteEchoUntil.delete(id);
        } else if (Math.random() < 0.35 && !message.content.startsWith('!')) {
            echoReplique = ROULETTE_ECHO_REPLIQUES[Math.floor(Math.random() * ROULETTE_ECHO_REPLIQUES.length)];
        }
    }

    let contenu = message.content;
    let modifie = false;

    const lock = rouletteLettreInterdite.get(id);
    if (lock) {
        if (now >= lock.until) rouletteLettreInterdite.delete(id);
        else {
            const sansLettre = retirerLettre(contenu, lock.lettre);
            if (sansLettre !== contenu) {
                contenu = sansLettre || '\u200b';
                modifie = true;
            }
        }
    }
    const finLeet = rouletteLeetUntil.get(id);
    if (finLeet) {
        if (now >= finLeet) rouletteLeetUntil.delete(id);
        else {
            const leet = versLeet(contenu);
            if (leet !== contenu) { contenu = leet; modifie = true; }
        }
    }
    const apresTransfos = appliquerTransfos(id, contenu);
    if (apresTransfos !== contenu) { contenu = apresTransfos; modifie = true; }
    const finUwu = rouletteUwuUntil.get(id);
    if (finUwu) {
        if (now >= finUwu) rouletteUwuUntil.delete(id);
        else { contenu = `${contenu} UwU`; modifie = true; }
    }
    const finEmoji = rouletteEmojiUntil.get(id);
    if (finEmoji) {
        if (now >= finEmoji) rouletteEmojiUntil.delete(id);
        else if (!finitParUnEmoji(contenu)) {
            contenu = `${contenu} ${ROULETTE_EMOJIS_ALEATOIRES[Math.floor(Math.random() * ROULETTE_EMOJIS_ALEATOIRES.length)]}`;
            modifie = true;
        }
    }
    if (!modifie) {
        if (echoReplique) setTimeout(() => { message.reply(echoReplique).catch(() => {}); }, 1200);
        return;
    }

    const salonWebhook = message.channel.isThread() ? message.channel.parent : message.channel;
    const webhook = await assurerWebhookRoulette(salonWebhook);
    if (!webhook) {
        if (echoReplique) setTimeout(() => { message.reply(echoReplique).catch(() => {}); }, 1200);
        return;
    }

    if (client && !client.roulettePseudoLock) {
        client.roulettePseudoLock = roulettePseudoLock;
    }

    let contenuFinal = contenu;
    if (message.reference?.messageId) {
        const refMsg = await message.fetchReference().catch(() => null)
            || await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
        if (refMsg) {
            const refAuteur = refMsg.member?.displayName || refMsg.author?.username || 'Membre';
            const prefixeRep = `-# ↩️ [En réponse à @${refAuteur}](${refMsg.url})\n`;
            if (prefixeRep.length < 1900) {
                contenuFinal = prefixeRep + contenu.slice(0, 2000 - prefixeRep.length);
            }
        }
    }

    try {
        const { MessageFlags } = require('discord.js');
        const msgWebhook = await webhook.send({
            content: contenuFinal.slice(0, 2000),
            username: message.member?.displayName ?? message.author.username,
            avatarURL: message.member?.displayAvatarURL() ?? message.author.displayAvatarURL(),
            files: [...message.attachments.values()].map(a => a.url),
            threadId: message.channel.isThread() ? message.channel.id : undefined,
            allowedMentions: { parse: [] },
            flags: [MessageFlags.SuppressEmbeds],
            wait: true
        });
        if (msgWebhook?.id) {
            if (!client.webhookMessagesAuthors) client.webhookMessagesAuthors = new Map();
            client.webhookMessagesAuthors.set(msgWebhook.id, message.author.id);
            if (client.webhookMessagesAuthors.size > 2000) {
                const premier = client.webhookMessagesAuthors.keys().next().value;
                client.webhookMessagesAuthors.delete(premier);
            }
        }
        if (!client.webhookDeletedMessages) client.webhookDeletedMessages = new Set();
        client.webhookDeletedMessages.add(message.id);
        setTimeout(() => client.webhookDeletedMessages?.delete(message.id), 15000);
        await message.delete().catch(() => {});
        if (echoReplique) {
            setTimeout(() => {
                if (msgWebhook?.reply) msgWebhook.reply(echoReplique).catch(() => {});
                else message.channel.send(echoReplique).catch(() => {});
            }, 1200);
        }
    } catch {}
}

async function handleRoulettePseudoLock(oldMember, newMember) {
    const lock = roulettePseudoLock.get(newMember.id);
    if (!lock) return;
    if (Date.now() >= lock.until) {
        roulettePseudoLock.delete(newMember.id);
        bridge.demanderSauvegarde();
        if (newMember.nickname === lock.pseudo) {
            await newMember.setNickname(lock.originalNickname ?? null).catch(() => {});
        }
        notifierMpInteractionRoulette(
            newMember.client,
            newMember.id,
            `🔓 Ton malus **Pseudo verrouillé** (\`${lock.pseudo}\`) sur **Regaïa** vient d'expirer ! Ton pseudo précédent a été rétabli.`
        );
        return;
    }
    if (newMember.nickname !== lock.pseudo) {
        await newMember.setNickname(lock.pseudo).catch(() => {});
    }
}

function restaurerNotifsRoulette(client) {
    if (!client) return;

    let restaurees = 0;

    // Restaurer les alertes ponctuelles enregistrées.
    for (const [userId, channelId] of rouletteNotifs.entries()) {
        if (!channelId) continue;

        armerNotifRoulette(userId, channelId, client);
        restaurees++;
    }

    // Vérifier les abonnements automatiques.
    for (const [userId, actif] of rouletteNotifRepeat.entries()) {
        if (!actif) continue;

        const fin = rouletteCooldowns.get(userId) ?? 0;
        if (Date.now() >= fin) continue;

        const target = rouletteNotifTarget.get(userId)
            || rouletteNotifs.get(userId)
            || ROULETTE_SALON_ID;

        if (!rouletteNotifs.has(userId)) {
            rouletteNotifs.set(userId, target);
            armerNotifRoulette(userId, target, client);
            restaurees++;
        }
    }

    bridge.demanderSauvegarde();

    console.log(
        `[ROULETTE NOTIF] Restauration terminée : ${restaurees} notification(s) programmée(s).`
    );
}

module.exports = {
    ROULETTE_ETATS,
    initRouletteBridge,
    verifierHappyHour,
    declencherHappyHourRoulette,
    initialiserWebhooksRoulette,
    assurerWebhookRoulette,
    armerNotifRoulette,
    restaurerNotifsRoulette,
    deverrouillerSucces,
    rouletteNotifs,
    rouletteAntiFeurUntil,
    rouletteAntiFeurDodges,
    rouletteAchievements,
    rouletteStats,
    rouletteBouclierActif,
    rouletteRedirectCharges,
    rouletteInventaire,
    crediterInventaireRoulette,
    buildRouletteStateEmbed,
    buildRouletteStatePayload,
    rouletteVotesPublics,
    buildVoteRouletteRow,
    migrateVoteRouletteMessage,
    restaurerVotesRoulette,
    handleRouletteMessage,
    handleRouletteSlash,
    handleRouletteButton,
    handleRouletteCouronne,
    estSalonExcluMalusTexte,
    handleRouletteTransfoMessage,
    handleRoulettePseudoLock
};