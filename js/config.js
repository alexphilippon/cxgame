/* CX GAME – configuration.
   Mode local (essais, sans connexion) si « firebase » est null. Mode partagé : configuration du projet Firebase cxgame-eb85c (jamais celle du ski).
   Ces valeurs web ne sont pas secrètes : la sécurité repose sur les règles Firestore (firebase/firestore.rules). */
window.CX_CONFIG = {
  firebase: {
    apiKey: 'AIzaSyB6IaRH4Sg3jj_HLu8AyVXr6Dwcy2ZnW90',
    authDomain: 'cxgame-eb85c.firebaseapp.com',
    projectId: 'cxgame-eb85c',
    storageBucket: 'cxgame-eb85c.firebasestorage.app',
    messagingSenderId: '521899130464',
    appId: '1:521899130464:web:dbeb5628d1a822375c0d05',
  },
  adminEmail: 'alexandre.philippon@gmail.com',   // e-mail du compte administrateur (même adresse que dans firebase/firestore.rules)
};
