const admin = require('firebase-admin');
// const serviceAccount = require('../ServiceAccountKey.json');

// admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
admin.initializeApp();
const db = admin.firestore();

module.exports = { db, admin };
