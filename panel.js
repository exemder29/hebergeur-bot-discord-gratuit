// Mémorise où se trouve le « panneau » (le message que le bot modifie tout seul).
// Fichier panel.json à côté du bot : il survit aux redémarrages.
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'panel.json');

function loadPanel(file = FILE) {
    try {
        const d = JSON.parse(fs.readFileSync(file, 'utf8'));
        return d && d.channelId && d.messageId ? d : null;
    } catch (e) {
        return null;
    }
}

function savePanel(panel, file = FILE) {
    if (!panel) {
        try { fs.unlinkSync(file); } catch (e) {}
        return;
    }
    fs.writeFileSync(file, JSON.stringify({ channelId: panel.channelId, messageId: panel.messageId }));
}

// Identifie ce qui est affiché : si cette clé change, il faut modifier le message
function statusKey(status) {
    return (status.closed ? 'closed' : 'open') + '|' + (status.updatedAt ? status.updatedAt.toISOString() : '');
}

module.exports = { loadPanel, savePanel, statusKey };
