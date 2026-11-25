'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const indexSource = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
const start = indexSource.indexOf('// Signaler les erreurs techniques');
const end = indexSource.indexOf('const client = new Client({', start);
assert.ok(start >= 0 && end > start, 'Reporter de diagnostic présent');

function createReporter() {
    const messages = [];
    const warnings = [];
    class EmbedBuilder {
        constructor() { this.data = { fields: [] }; }
        setColor(value) { this.data.color = value; return this; }
        setTitle(value) { this.data.title = value; return this; }
        addFields(...fields) { this.data.fields.push(...fields); return this; }
        setTimestamp() { return this; }
    }
    const context = vm.createContext({
        console: { error: (...args) => warnings.push(args) },
        process: { env: { TOKEN: 'super-secret-test-token' }, on: () => {} },
        Date, Error, String, Map, Array, Math,
        setTimeout: (fn) => { fn(); return 1; },
        EmbedBuilder
    });
    vm.runInContext(indexSource.slice(start, end), context);
    const channel = { send: async payload => { messages.push(payload); } };
    return { context, messages, warnings, channel };
}

test('diagnostic : 300 erreurs identiques ne produisent pas 300 alertes', async () => {
    const { context, messages, channel } = createReporter();
    context.globalTestClient = { isReady: () => true, channels: { fetch: async () => channel } };
    vm.runInContext('errorReportClient = globalTestClient', context);
    for (let i = 0; i < 300; i++) vm.runInContext("console.error('Test de surcharge', new Error('Même erreur'))", context);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(messages.length, 1);
    assert.equal(messages[0].embeds[0].data.fields[0].value, 'Test de surcharge');
});

test('diagnostic : la mémoire des erreurs reste limitée', () => {
    const { context } = createReporter();
    for (let i = 0; i < 500; i++) vm.runInContext("console.error('Erreur numéro " + i + "')", context);
    assert.ok(vm.runInContext('errorReportRecent.size', context) <= 200);
    assert.ok(vm.runInContext('errorReportQueue.length', context) <= 30);
});

test('diagnostic : les secrets ne sont pas envoyés dans les alertes', async () => {
    const { context, messages, channel } = createReporter();
    context.globalTestClient = { isReady: () => true, channels: { fetch: async () => channel } };
    vm.runInContext('errorReportClient = globalTestClient', context);
    vm.runInContext("console.error('Jeton : super-secret-test-token')", context);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(messages.length, 1);
    assert.ok(!JSON.stringify(messages[0]).includes('super-secret-test-token'));
});

test('diagnostic : les avertissements conservent le fichier et la ligne', async () => {
    const { context, messages, channel } = createReporter();
    context.globalTestClient = { isReady: () => true, channels: { fetch: async () => channel } };
    vm.runInContext('errorReportClient = globalTestClient', context);
    vm.runInContext(`console.error('Essai', Object.assign(new Error('Avertissement'), {
        stack: 'Warning: Avertissement\\n    at action (/app/tcg.js:123:45)'
    }))`, context);
    await new Promise(resolve => setImmediate(resolve));
    assert.match(messages[0].embeds[0].data.fields[2].value, /tcg\.js:123:45/);
});

test('interactions : aucune ancienne option ephemeral ne subsiste dans les modules', () => {
    const modules = ['index.js', 'tcg.js', 'roulette.js', 'interaction.js', 'battlepass.js',
        'minijeux.js', 'security.js', 'welcome.js', 'rolembed.js', 'activity.js',
        'pendu.js', 'embeds.js', 'suggestion.js', 'social.js', 'tools.js',
        'help.js', 'youtube.js', 'anniversaire.js', 'quotes.js'];
    for (const file of modules) {
        const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
        assert.doesNotMatch(source, /\bephemeral\s*:\s*(true|false)\b/, file);
    }
});
