'use strict';

// Validation sans mutation : refuser les sauvegardes tronquées plutôt
// que démarrer avec des inventaires ou des statistiques vides.
const isRecord = value =>
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value);

function validateBackup(payload) {
    if (!isRecord(payload)) return { valid: false, reason: 'racine invalide' };

    // Ces sections sont essentielles à la conservation des données.
    const required = [
        ['messages', payload.messages],
        ['tcgData', payload.tcgData],
        ['tcgData.users', payload.tcgData?.users],
        ['battlePassData', payload.battlePassData],
        ['motusStats', payload.motusStats],
        ['penduStats', payload.penduStats],
        ['roulette', payload.roulette]
    ];

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

module.exports = { validateBackup };
