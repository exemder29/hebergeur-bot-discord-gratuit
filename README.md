# Explorateur Terminal

Site statique : `index.html` + `logo.svg`. Connexion et sauvegarde via Firebase (projet `bot-discord-e9166`).

## Fichiers
- `index.html` : le site
- `logo.svg` : logo (aussi utilisé comme icône d'onglet)
- `firestore.rules` : règles de sécurité Firestore (chaque compte ne voit que ses fichiers)
- `firebase.json`, `.firebaserc` : configuration pour `firebase deploy`

## Mise en ligne
1. Console Firebase > Authentication > Méthode de connexion : activer « E-mail/Mot de passe ».
2. Console Firebase > Firestore > Règles : coller le contenu de `firestore.rules` puis Publier
   (ou `firebase deploy --only firestore:rules`).
3. Héberger le dossier (`firebase deploy --only hosting`, ou n'importe quel hébergeur statique).
