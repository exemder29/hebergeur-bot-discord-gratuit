# Mettre le bot sur un hébergeur (il tourne sans ton PC)

Sur ton PC tu n'as plus rien à lancer : une fois sur l'hébergeur, le bot tourne 24h/24.

## Étapes (hébergeur de bots avec panneau web : Space-Node, XGamingServer, etc.)
1. Commande l'offre « Discord bot » **Node.js** (la moins chère suffit : le bot est très léger).
2. Dans le panneau, ouvre **Fichiers** (File Manager) et envoie tous les fichiers de ce dossier
   (index.js, lock.js, panel.js, status.js, package.json). **Pas besoin de node_modules.**
3. Crée un fichier **.env** (copie de .env.example) et remplis :
   DISCORD_TOKEN, CLIENT_ID, GUILD_ID (+ ANNOUNCE_CHANNEL_ID, SITE_URL si tu veux).
   Ou remplis ces mêmes noms dans l'onglet **Variables / Startup** s'il existe.
4. Dans **Startup** (ou « Paramètres »), mets le fichier principal : `index.js`.
   S'il y a une case « installer les dépendances » / « auto update packages », coche-la
   (sinon, ouvre la **Console** et tape : npm install).
5. Clique sur **Start**. Tu dois voir dans la console : « Connecté en tant que ... ».
6. Dans Discord, tape `/panneau` une seule fois dans ton salon.

## Important
- Arrête le bot sur ton PC (`node daemon.js stop`) AVANT de démarrer celui de l'hébergeur :
  deux bots avec le même token en même temps créent des doublons.
- Le fichier panel.json (mémoire du panneau) sera recréé par `/panneau`.
- Fly.io / Railway : démarrage avec `npm start` (il n'y a pas besoin de daemon.js).
