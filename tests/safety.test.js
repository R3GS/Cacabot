'use strict';

// Audit non destructif : aucune connexion Discord, aucun accès aux données
// des membres et aucune écriture dans le salon de sauvegardes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

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
