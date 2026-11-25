'use strict';

const assert = require('node:assert/strict');
const net = require('node:net');
const test = require('node:test');
const { acquireInstanceGuard, getLockPort } = require('../instance-guard.js');

test('verrou : port stable pour un même jeton, sans révéler le jeton', () => {
    assert.equal(getLockPort('jeton-fictif', ''), getLockPort('jeton-fictif', ''));
    assert.throws(() => getLockPort('jeton-fictif', '0'));
    assert.throws(() => getLockPort('', ''));
});

test('verrou : une seconde instance locale est refusée puis le port est libéré', async () => {
    // Réserver un port libre fourni par l'OS, puis le libérer.
    const probe = net.createServer();
    await new Promise((resolve, reject) => {
        probe.once('error', reject);
        probe.listen(0, '127.0.0.1', resolve);
    });
    const port = probe.address().port;
    await new Promise(resolve => probe.close(resolve));

    const first = await acquireInstanceGuard('jeton-fictif', { port });
    try {
        await assert.rejects(
            acquireInstanceGuard('jeton-fictif', { port }),
            /Une autre instance Cacabot/
        );
    } finally {
        await first.release();
    }

    const restarted = await acquireInstanceGuard('jeton-fictif', { port });
    await restarted.release();
});
