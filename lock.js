// Verrou « une seule copie du bot à la fois ».
// Si le bot tourne deux fois, chaque copie répond aux commandes et poste son propre message : doublons.
// Principe : la copie qui tourne « occupe » un port local (127.0.0.1). Windows libère ce port tout seul
// quand le programme s'arrête (même si tu fermes le CMD de force) : pas de faux verrou possible.
const net = require('net');
const fs = require('fs');
const path = require('path');

const PID_FILE = path.join(__dirname, 'bot.lock');
const PORT = parseInt(process.env.BOT_LOCK_PORT || '47831', 10);

function readPid(file = PID_FILE) {
    try {
        const n = parseInt(fs.readFileSync(file, 'utf8'), 10);
        return n > 0 ? n : null;
    } catch (e) {
        return null;
    }
}

// Une copie du bot tourne-t-elle ? (true/false)
function isRunning(port = PORT) {
    return new Promise(resolve => {
        const s = net.connect({ port, host: '127.0.0.1' });
        const done = v => { s.destroy(); resolve(v); };
        s.once('connect', () => done(true));
        s.once('error', () => done(false));
        s.setTimeout(1000, () => done(false));
    });
}

// Prend le verrou. { ok: true } si on est la seule copie, sinon { ok: false, pid }
function acquire(port = PORT, file = PID_FILE) {
    return new Promise(resolve => {
        const server = net.createServer(socket => socket.destroy());
        server.once('error', e => {
            if (e.code === 'EADDRINUSE') resolve({ ok: false, pid: readPid(file) });
            else resolve({ ok: true });   // port inutilisable pour une autre raison : on ne bloque pas le bot
        });
        server.listen(port, '127.0.0.1', () => {
            server.unref();
            try { fs.writeFileSync(file, String(process.pid)); } catch (e) {}
            process.on('exit', () => {
                try { if (readPid(file) === process.pid) fs.unlinkSync(file); } catch (e) {}
            });
            resolve({ ok: true });
        });
    });
}

module.exports = { acquire, isRunning, readPid, FILE: PID_FILE, PORT };
