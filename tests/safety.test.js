'use strict';

// Audit non destructif : aucune connexion Discord, aucun accès aux données
// des membres et aucune écriture dans le salon de sauvegardes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const { validateBackup, computeBackupChecksum } = require('../backup-validator.js');

const fichiers = [
  "index.js",
  "repliques.js",
  "destin.js",
  "horoscope.js",
  "animal.js",
  "interaction.js",
  "help.js",
  "minijeux.js",
  "pendu.js",
  "rolembed.js",
  "suggestion.js",
  "welcome.js",
  "social.js",
  "roulette.js",
  "embeds.js",
  "youtube.js",
  "anniversaire.js",
  "security.js",
  "quotes.js",
  "tools.js",
  "tcg.js",
  "battlepass.js",
  "activity.js",
  "watcher.js"
];

for (const fichier of fichiers) {
    test('syntaxe JavaScript : ' + fichier, () => {
        const source = fs.readFileSync(path.join(__dirname, '..', fichier), 'utf8');
        assert.doesNotThrow(() => new vm.Script(source, { filename: fichier }));
    });
}

test('sauvegardes : refus de démarrer sans données persistantes', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
    assert.match(source, /DÉMARRAGE ANNULÉ : aucune sauvegarde valide disponible/);
    assert.match(source, /donneesChargees = false/);
});

test('sauvegardes : historique conservé sans suppression automatique', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
    assert.match(source, /ne jamais supprimer automatiquement/);
    assert.doesNotMatch(source, /ancienneSauvegarde\.delete\(/);
});

test('sauvegardes : relance des écritures différées après un échec', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
    assert.match(source, /programmerSauvegardeDifferee\(delaiReessaiSauvegarde\)/);
});

test('Pendu : journal de publication et clé de récompense persistants', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'pendu.js'), 'utf8');
    assert.match(source, /structuredClone\(nouvelleSession\)/);
    assert.match(source, /session\.recompensesRewardKey \|\|/);
    assert.match(source, /sessionId: require\('node:crypto'\)\.randomUUID\(\)/);
});

test('RegaDex : registre anti-doublons et file de récompenses', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'tcg.js'), 'utf8');
    assert.match(source, /minigameRewardLedger/);
    assert.match(source, /fileAttributionsMinijeux/);
});

test('restauration : accepte une copie structurellement complète sans la modifier', () => {
    const backup = {
        messages: { '123': 5 },
        tcgData: { users: { '123': { points: 42, cards: { abc: 1 } } } },
        battlePassData: { joueurs: { '123': { xp: 10 } } },
        motusStats: {}, penduStats: {}, roulette: {}
    };
    const before = JSON.stringify(backup);
    assert.equal(validateBackup(backup).valid, true);
    assert.equal(JSON.stringify(backup), before);
    assert.equal(backup.tcgData.users['123'].cards.abc, 1);
});

test('restauration : rejette les sauvegardes partielles sans effacer les inventaires', () => {
    const complete = {
        versionMajor: 3,
        messages: {}, tcgData: { users: { '123': { points: 42 } } },
        battlePassData: {}, motusStats: {}, penduStats: {}, roulette: {}
    };
    for (const section of ['messages', 'tcgData', 'battlePassData', 'motusStats', 'penduStats', 'roulette']) {
        const partial = structuredClone(complete);
        delete partial[section];
        assert.equal(validateBackup(partial).valid, false, section);
    }
    const brokenUser = structuredClone(complete);
    brokenUser.tcgData.users['123'] = null;
    assert.equal(validateBackup(brokenUser).valid, false);
    assert.equal(complete.tcgData.users['123'].points, 42);
});

test('restauration : index utilise le validateur avant chargement', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
    assert.match(source, /validateBackup\(parsed\)/);
});

test('restauration : anciennes sauvegardes acceptées sans données inventées', () => {
    const legacy = {
        messages: { '123': 8 },
        tcgData: { users: { '123': { points: 55, cards: { legendary: 2 } } } }
    };
    const before = JSON.stringify(legacy);
    assert.equal(validateBackup(legacy).valid, true);
    assert.equal(JSON.stringify(legacy), before);
    assert.equal(legacy.tcgData.users['123'].cards.legendary, 2);

    const corrupted = structuredClone(legacy);
    corrupted.battlePassData = null;
    assert.equal(validateBackup(corrupted).valid, false);
});

test('restauration : format v3 refuse une section manquante', () => {
    const backup = {
        versionMajor: 3, messages: {}, tcgData: { users: {} },
        battlePassData: {}, motusStats: {}, penduStats: {}, roulette: {}
    };
    assert.equal(validateBackup(backup).valid, true);
    for (const section of ['battlePassData', 'motusStats', 'penduStats', 'roulette']) {
        const partial = structuredClone(backup);
        delete partial[section];
        assert.equal(validateBackup(partial).valid, false, section);
    }
});

test('demarrage : verrou local acquis avant ouverture de session Discord', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
    assert.match(source, /await acquireInstanceGuard\(process\.env\.TOKEN\)/);
    assert.match(source, /await client\.login\(process\.env\.TOKEN\)/);
    assert.doesNotMatch(source, /^client\.login\(process\.env\.TOKEN\);/m);
});

test('sauvegardes : aucune suppression de message Discord de backup', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
    assert.doesNotMatch(source, /ancienneSauvegarde\.delete\(/);
    assert.match(source, /m\.author\?\.id === client\.user\?\.id/);
});

test('sauvegardes : une empreinte valide est acceptee sans modification', () => {
    const backup = {
        versionMajor: 3, messages: {},
        tcgData: { users: { '123': { points: 500, cards: { a: 2 } } } },
        battlePassData: {}, motusStats: {}, penduStats: {}, roulette: {}
    };
    backup.integrity = { algorithm: 'sha256', value: computeBackupChecksum(backup) };
    const before = JSON.stringify(backup);
    assert.equal(validateBackup(backup).valid, true);
    assert.equal(JSON.stringify(backup), before);
});

test('sauvegardes : une alteration de solde ou de carte est refusee', () => {
    const backup = {
        versionMajor: 3, messages: {},
        tcgData: { users: { '123': { points: 500, cards: { a: 2 } } } },
        battlePassData: {}, motusStats: {}, penduStats: {}, roulette: {}
    };
    backup.integrity = { algorithm: 'sha256', value: computeBackupChecksum(backup) };
    backup.tcgData.users['123'].points = 0;
    assert.equal(validateBackup(backup).valid, false);
    backup.tcgData.users['123'].points = 500;
    backup.tcgData.users['123'].cards.a = 0;
    assert.equal(validateBackup(backup).valid, false);
});

test('demarrage : echec de restauration provoque un arret explicite', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
    assert.match(source, /try\s*\{\s*await loadAll\(\);\s*\}\s*catch\s*\(error\)/);
    assert.match(source, /ARRÊT DE SÉCURITÉ : restauration impossible/);
    assert.match(source, /donneesChargees = false;\s*console\.error\('🚨 ARRÊT DE SÉCURITÉ/);
    assert.match(source, /process\.exit\(1\)/);
});

test('arret : sauvegarde finale reessayee et echec signale', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
    assert.match(source, /const MAX_ESSAIS_ARRET = 3/);
    assert.match(source, /await saveAll\(\)/);
    assert.match(source, /ARRÊT SANS CONFIRMATION DE SAUVEGARDE/);
    assert.match(source, /process\.exit\(sauvegardeConfirmee \? 0 : 1\)/);
});

test('restauration : les types invalides de sections presentes sont refuses', () => {
    const base = {
        versionMajor: 3, numeroBuild: 12,
        messages: {}, tcgData: { users: {} },
        battlePassData: {}, motusStats: {}, penduStats: {}, roulette: {},
        birthdays: {}, birthdayLastAnnouncements: {}, youtubeWatch: {},
        motusData: {}, penduData: {}, welcomeData: {},
        quotes: [], bugs: [], penduPublicationPending: null,
        rebusSessionData: null
    };
    assert.equal(validateBackup(base).valid, true);
    for (const [key, bad] of [
        ['birthdays', null], ['birthdayLastAnnouncements', []],
        ['youtubeWatch', 1], ['motusData', []], ['penduData', null],
        ['welcomeData', 'invalid'], ['quotes', {}], ['bugs', {}],
        ['penduPublicationPending', []], ['rebusSessionData', false],
        ['numeroBuild', '12'], ['versionMajor', 999]
    ]) {
        const corrupted = structuredClone(base);
        corrupted[key] = bad;
        assert.equal(validateBackup(corrupted).valid, false, key);
    }
});

test('sauvegarde : empreinte conservee apres serialisation JSON Discord', () => {
    const original = {
        versionMajor: 3, messages: { 'a': 1 },
        tcgData: { users: { '42': { points: 55, cards: { rare: 3 } } } },
        battlePassData: {}, motusStats: {}, penduStats: {}, roulette: {}
    };
    original.integrity = { algorithm: 'sha256', value: computeBackupChecksum(original) };
    const received = JSON.parse(JSON.stringify(original, null, 2));
    assert.equal(validateBackup(received).valid, true);
    received.tcgData.users['42'].cards.rare++;
    assert.equal(validateBackup(received).valid, false);
});
