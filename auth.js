import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, deleteDoc, getDocs, query, limit } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAsAgU3SwNCZXMySUdlLMYKk4ytPCZuZig",
  authDomain: "bot-discord-e9166.firebaseapp.com",
  projectId: "bot-discord-e9166",
  storageBucket: "bot-discord-e9166.firebasestorage.app",
  messagingSenderId: "908628532379",
  appId: "1:908628532379:web:345ef56dc40fddfffc7a3e"
};
window.__fbLoaded = true;
const app = initializeApp(firebaseConfig), auth = getAuth(app), fs = getFirestore(app);
const q = s => document.querySelector(s);

// Même interface que la sauvegarde du site : collection().doc().set/delete et collection().limit().get()
const norm = e => { const err = new Error(e.message); err.code = String(e.code || '').replace(/^.*\//, '').replace(/-/g, '_'); return err; };
const wrap = async fn => { try { return await fn(); } catch (e) { throw norm(e); } };
const db = { collection: path => ({
  doc: id => ({ set: d => wrap(() => setDoc(doc(fs, path, id), d)), delete: () => wrap(() => deleteDoc(doc(fs, path, id))) }),
  limit: n => ({ get: () => wrap(async () => { const s = await getDocs(query(collection(fs, path), limit(n))); return { docs: s.docs.map(d => ({ id: d.id, exists: true, data: () => d.data() })) }; }) })
}) };

// Pas d'email : le nom d'utilisateur devient une adresse interne invisible
const toEmail = n => n.trim().toLowerCase() + '@explorateur.local';
const validName = n => /^[a-z0-9._-]{3,30}$/i.test(n.trim());
const msg = t => { q('#authMsg').textContent = t; };
function errText(e) {
  switch (e.code) {
    case 'auth/invalid-credential': case 'auth/wrong-password': case 'auth/user-not-found': case 'auth/invalid-login-credentials': return 'Nom ou mot de passe incorrect.';
    case 'auth/email-already-in-use': return 'Ce nom est déjà pris, choisis-en un autre.';
    case 'auth/weak-password': return 'Mot de passe trop court : 6 caractères minimum.';
    case 'auth/operation-not-allowed': return 'Connexion non activée : dans la console Firebase, active « E-mail/Mot de passe ».';
    case 'auth/configuration-not-found': return 'Authentification non initialisée : dans la console Firebase, ouvre Authentication, clique sur « Commencer », puis active « E-mail/Mot de passe ».';
    case 'auth/network-request-failed': return 'Pas de connexion à Internet.';
    case 'auth/too-many-requests': return 'Trop d\'essais, réessaie dans un moment.';
    default: return 'Erreur : ' + (e.code || e.message);
  }
}
async function go(kind) {
  const name = q('#authUser').value, pass = q('#authPass').value;
  if (!validName(name)) { msg('Nom invalide : 3 à 30 caractères, lettres, chiffres, point, tiret ou underscore.'); return; }
  if (pass.length < 6) { msg('Mot de passe trop court : 6 caractères minimum.'); return; }
  msg(''); q('#btnLogin').disabled = q('#btnSignup').disabled = true;
  try { await (kind === 'signup' ? createUserWithEmailAndPassword : signInWithEmailAndPassword)(auth, toEmail(name), pass); }
  catch (e) { msg(errText(e)); }
  q('#btnLogin').disabled = q('#btnSignup').disabled = false;
}
q('#authForm').addEventListener('submit', e => { e.preventDefault(); go('login'); });
q('#btnSignup').addEventListener('click', () => go('signup'));
q('#logout').addEventListener('click', async () => { await signOut(auth); location.reload(); });

let started = null;
onAuthStateChanged(auth, user => {
  if (user) {
    if (started === user.uid) return; started = user.uid;
    q('#auth').hidden = true; q('#authPass').value = '';
    q('#who').textContent = '· ' + (user.email || '').split('@')[0]; q('#logout').hidden = false;
    window.__startPersist(db, user.uid);
  } else { q('#auth').hidden = false; }
});
