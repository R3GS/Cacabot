'use strict';

// Verrou local sans données persistantes : le système d'exploitation
// libère automatiquement le port si le processus s'arrête brutalement.
// Protège les instances partageant le même espace réseau local.
// Un déploiement multi-hôtes nécessite EN PLUS un verrou distribué.
const net = require('node:net');
const crypto = require('node:crypto');

function getLockPort(token, override = process.env.CACABOT_INSTANCE_LOCK_PORT) {
    if (override !== undefined && override !== '') {
        const port = Number(override);
        if (!Number.isInteger(port) || port < 1024 || port > 65535) {
            throw new Error('CACABOT_INSTANCE_LOCK_PORT doit être un port entre 1024 et 65535.');
        }
        return port;
    }
    if (typeof token !== 'string' || !token) {
        throw new Error('TOKEN Discord absent : impossible de protéger le démarrage.');
    }
    const hash = crypto.createHash('sha256').update(token).digest();
    return 30000 + (hash.readUInt32BE(0) % 25000);
}

function acquireInstanceGuard(token, options = {}) {
    const port = getLockPort(token, options.port);
    const server = net.createServer(socket => socket.destroy());

    return new Promise((resolve, reject) => {
        const onError = error => {
            server.removeListener('listening', onListening);
            try { server.close(); } catch (_) {}
            const message = error?.code === 'EADDRINUSE'
                ? 'Une autre instance Cacabot utilise déjà ce verrou local.'
                : 'Impossible de réserver le verrou local Cacabot.';
            reject(new Error(message + ' Port : ' + port, { cause: error }));
        };
        const onListening = () => {
            server.removeListener('error', onError);
            resolve({
                port,
                release: () => new Promise(done => server.close(() => done()))
            });
        };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen({ host: '127.0.0.1', port, exclusive: true });
    });
}

module.exports = { acquireInstanceGuard, getLockPort };
