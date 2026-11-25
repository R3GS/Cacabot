'use strict';

// Audit non destructif : aucune connexion Discord, aucun accès aux données
// des membres et aucune écriture dans le salon de sauvegardes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const { validateBackup } = require('../backup-validator.js');

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
