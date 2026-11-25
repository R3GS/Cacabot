'use strict';

const crypto = require('node:crypto');

// Validation sans mutation : refuser les sauvegardes tronquées plutôt
// que démarrer avec des inventaires ou des statistiques vides.
const isRecord = value =>
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value);

function computeBackupChecksum(payload) {
    const clone = { ...payload };
    delete clone.integrity;
    return crypto.createHash('sha256')
        .update(JSON.stringify(clone))
        .digest('hex');
}

function validateBackup(payload) {
    if (!isRecord(payload)) return { valid: false, reason: 'racine invalide' };

    // Compatibilité : les anciennes sauvegardes n'ont pas d'empreinte.
    // Toute sauvegarde qui en fournit une doit impérativement la valider.
    if ('integrity' in payload) {
        if (
            !isRecord(payload.integrity) ||
            payload.integrity.algorithm !== 'sha256' ||
            !/^[a-f0-9]{64}$/.test(payload.integrity.value || '') ||
            computeBackupChecksum(payload) !== payload.integrity.value
        ) {
            return { valid: false, reason: 'empreinte de sauvegarde invalide' };
        }
    }

    // Une sauvegarde historique peut précéder l'ajout de certaines
    // fonctionnalités. Ne jamais exiger une section qui n'existait
    // pas encore dans les anciens formats.
    const version3 = payload.versionMajor === 3;
    const required = [
        ['messages', payload.messages],
        ['tcgData', payload.tcgData],
        ['tcgData.users', payload.tcgData?.users],
        ...(version3 ? [
            ['battlePassData', payload.battlePassData],
            ['motusStats', payload.motusStats],
            ['penduStats', payload.penduStats],
            ['roulette', payload.roulette]
        ] : [])
    ];

    // Même pour les sauvegardes historiques, une section présente
    // mais corrompue doit provoquer un refus, jamais une conversion
    // silencieuse en données vides.
    for (const name of ['battlePassData', 'motusStats', 'penduStats', 'roulette']) {
        if (name in payload && !isRecord(payload[name])) {
            return { valid: false, reason: 'section invalide : ' + name };
        }
    }

    for (const [name, value] of required) {
        if (!isRecord(value)) {
            return { valid: false, reason: 'section absente ou invalide : ' + name };
        }
    }

    // Une sauvegarde partielle ne doit jamais écraser un état complet.
    // Les sauvegardes historiques légitimes sont essayées dans l'ordre.
    const optionalRecords = [
        'birthdayChannels', 'daily', 'weekly', 'monthly',
        'reactionRoles', 'rebusStats', 'warns',
        'destitutionVotes', 'suggestions'
    ];
    for (const name of optionalRecords) {
        if (name in payload && !isRecord(payload[name])) {
            return { valid: false, reason: 'section invalide : ' + name };
        }
    }

    for (const [id, user] of Object.entries(payload.tcgData.users)) {
        if (!isRecord(user)) {
            return { valid: false, reason: 'inventaire RegaDex invalide : ' + id };
        }
    }

    return { valid: true };
}

module.exports = { validateBackup, computeBackupChecksum };
