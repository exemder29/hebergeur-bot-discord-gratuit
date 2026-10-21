// Lecture de l'état « candidatures ouvertes / fermées » dans Firestore (API REST, sans SDK).
// Le site enregistre ce réglage dans : artifacts/mod-app-v3/public/data/retries/site%settings
// Les règles Firestore du projet autorisent la lecture publique : aucun mot de passe nécessaire.

const FIREBASE = {
    projectId: 'feo-candidature',
    apiKey: 'AIzaSyBsvy6kLvebvLf7q6W2y1-rM82FehEb1OY', // clé publique, la même que dans config.js du site
    appId: 'mod-app-v3',
    settingsDocId: 'site%settings'
};

function statusUrl() {
    const { projectId, apiKey, appId, settingsDocId } = FIREBASE;
    return 'https://firestore.googleapis.com/v1/projects/' + projectId +
        '/databases/(default)/documents/artifacts/' + appId + '/public/data/retries/' +
        encodeURIComponent(settingsDocId) + '?key=' + apiKey;
}

// Retourne { closed: boolean, updatedAt: Date|null }
// Pas de document = l'admin n'a jamais fermé les candidatures = elles sont ouvertes.
async function fetchStatus(fetchImpl = fetch) {
    const res = await fetchImpl(statusUrl());
    if (res.status === 404) return { closed: false, updatedAt: null };
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error('Firestore a répondu ' + res.status + ' ' + text.slice(0, 200));
    }
    const data = await res.json();
    const fields = (data && data.fields) || {};
    const closed = !!(fields.closed && fields.closed.booleanValue === true);
    const raw = fields.updatedAt && fields.updatedAt.stringValue;
    const updatedAt = raw && !isNaN(Date.parse(raw)) ? new Date(raw) : null;
    return { closed, updatedAt };
}

module.exports = { fetchStatus, statusUrl, FIREBASE };
