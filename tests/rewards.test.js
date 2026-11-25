'use strict';

// Simulation en memoire uniquement : aucun membre ni serveur reel.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

function createHarness({ failSaveOnce = false, failFetchOnce = false } = {}) {
    const source = fs.readFileSync(path.join(__dirname, '..', 'tcg.js'), 'utf8');
    const begin = source.indexOf('const recompensesMinijeuxEnCours = new Set();');
    const end = source.indexOf('module.exports = {', begin);
    assert.ok(begin >= 0 && end > begin, 'bloc de recompenses introuvable');

    const users = {};
    const data = { minigameRewardLedger: {} };
    let saves = 0;
    let saveFailures = 0;
    let fetchFailures = 0;
    const guild = {
        members: {
            cache: new Map(),
            fetch: async uid => {
                if (failFetchOnce && fetchFailures++ === 0) {
                    throw new Error('Discord temporairement indisponible');
                }
                return { id: uid };
            }
        }
    };
    const client = {
        guilds: {
            cache: new Map([['test-guild', guild]]),
            fetch: async () => guild
        }
    };
    const tcgBridge = {
        client,
        demanderSauvegarde() {},
        async saveAll() {
            saves++;
            if (failSaveOnce && saveFailures++ === 0) {
                throw new Error('Sauvegarde temporairement indisponible');
            }
        }
    };
    const context = {
        GUILD_ID: 'test-guild',
        tcgBridge, console,
        getStoreData: () => data,
        hasTcgRole: () => true,
        getOrCreateTcgUser(uid) {
            return users[uid] ||= { points: 0 };
        }
    };
    vm.runInNewContext(source.slice(begin, end) + '\nthis.grant = grantMinigameTcgPoints;', context);
    return { grant: context.grant, users, data, get saves() { return saves; } };
}

test('recompenses : deux appels concurrents avec la meme cle ne creditent qu une fois', async () => {
    const h = createHarness();
    await Promise.all([
        h.grant(null, ['a', 'a', 'b'], 2, 'pendu:unique'),
        h.grant(null, ['a', 'b'], 2, 'pendu:unique')
    ]);
    assert.equal(h.users.a.points, 2);
    assert.equal(h.users.b.points, 2);
    assert.equal(Object.keys(h.data.minigameRewardLedger).length, 2);
});

test('recompenses : echec de sauvegarde puis reprise sans double credit', async () => {
    const h = createHarness({ failSaveOnce: true });
    await assert.rejects(h.grant(null, ['a'], 2, 'pendu:retry'), /Sauvegarde temporairement indisponible/);
    assert.equal(h.users.a.points, 2);
    await h.grant(null, ['a'], 2, 'pendu:retry');
    assert.equal(h.users.a.points, 2);
    assert.equal(Object.keys(h.data.minigameRewardLedger).length, 1);
});

test('recompenses : echec Discord puis reprise sans perdre le joueur', async () => {
    const h = createHarness({ failFetchOnce: true });
    await assert.rejects(h.grant(null, ['a'], 2, 'pendu:fetch'), /Discord temporairement indisponible/);
    assert.equal(h.users.a, undefined);
    await h.grant(null, ['a'], 2, 'pendu:fetch');
    assert.equal(h.users.a.points, 2);
    assert.equal(Object.keys(h.data.minigameRewardLedger).length, 1);
});
