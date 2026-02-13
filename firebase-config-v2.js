// ============================================================================
// CONFIGURATION FIREBASE - VERSION DUAL MODE
// ============================================================================
// 🔥 INSTRUCTIONS : Remplacez les valeurs ci-dessous par VOS clés Firebase
// Vous les obtenez sur : https://console.firebase.google.com
// Paramètres du projet → Vos applications → Configuration SDK

const firebaseConfig = {
  apiKey: "AIzaSyAO441k9SSfYxRUDd25ArAhWicxkvgo4Cs",
  authDomain: "intime-5b920.firebaseapp.com",
  projectId: "intime-5b920",
  storageBucket: "intime-5b920.firebasestorage.app",
  messagingSenderId: "188431588616",
  appId: "1:188431588616:web:926c9b20a499b22371e0bd"
};

// ============================================================================
// CONFIGURATION ADMIN
// ============================================================================
// 🔐 Changez ce mot de passe pour sécuriser votre page admin
const ADMIN_PASSWORD = "admin2026";

// ============================================================================
// CONFIGURATION DÉLAI MODE DISTANCE
// ============================================================================
// Temps d'expiration d'une session (en heures)
const SESSION_EXPIRATION_HOURS = 72; // 3 jours par défaut

// ============================================================================
// NE MODIFIEZ PAS EN-DESSOUS DE CETTE LIGNE
// ============================================================================

// Initialisation Firebase
let db = null;

function initializeFirebase() {
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
      db = firebase.firestore();
      console.log("✅ Firebase initialisé avec succès");
      return true;
    }
  } catch (error) {
    console.error("❌ Erreur d'initialisation Firebase:", error);
    return false;
  }
}

// ============================================================================
// FONCTIONS MODE ENSEMBLE
// ============================================================================

async function sendToFirebase(data) {
  if (!db) {
    console.error("❌ Firebase non initialisé");
    return false;
  }

  try {
    await db.collection('parties').add({
      ...data,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      date: new Date().toLocaleString('fr-FR'),
      navigateur: getBrowserInfo(),
      appareil: getDeviceInfo()
    });
    console.log("✅ Données envoyées à Firebase avec succès");
    return true;
  } catch (error) {
    console.error("❌ Erreur lors de l'envoi à Firebase:", error);
    return false;
  }
}

// ============================================================================
// FONCTIONS MODE DISTANCE
// ============================================================================

// Générer un ID unique pour une session
function generateSessionId() {
  return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Créer une nouvelle session (mode distance)
async function createDistanceSession(data) {
  if (!db) {
    console.error("❌ Firebase non initialisé");
    return null;
  }

  try {
    const sessionId = generateSessionId();
    const expirationDate = new Date();
    expirationDate.setHours(expirationDate.getHours() + SESSION_EXPIRATION_HOURS);

    const sessionData = {
      sessionId: sessionId,
      modeJeu: 'distance',
      partenaire1: data.partenaire1,
      partenaire2: data.partenaire2,
      nombreQuestions: data.nombreQuestions,
      niveau: data.niveau,
      questions: data.questions, // IDs des questions
      reponses_partenaire1: data.reponses,
      reponses_partenaire2: null,
      statut: 'en_attente', // 'en_attente' ou 'complete'
      score: null,
      dateCreation: firebase.firestore.FieldValue.serverTimestamp(),
      dateExpiration: firebase.firestore.Timestamp.fromDate(expirationDate),
      quiACommence: data.partenaire1,
      navigateur1: getBrowserInfo(),
      appareil1: getDeviceInfo(),
      navigateur2: null,
      appareil2: null,
      tempsEntreLesDeuxJoueurs: null,
      aJoueActionsIntimes: false
    };

    await db.collection('sessions_distance').doc(sessionId).set(sessionData);
    console.log("✅ Session distance créée:", sessionId);
    return sessionId;
  } catch (error) {
    console.error("❌ Erreur création session:", error);
    return null;
  }
}

// Récupérer une session existante
async function getDistanceSession(sessionId) {
  if (!db) {
    console.error("❌ Firebase non initialisé");
    return null;
  }

  try {
    const doc = await db.collection('sessions_distance').doc(sessionId).get();
    
    if (!doc.exists) {
      console.log("❌ Session non trouvée");
      return null;
    }

    const data = doc.data();
    
    // Vérifier l'expiration
    const now = new Date();
    const expiration = data.dateExpiration.toDate();
    
    if (now > expiration) {
      console.log("❌ Session expirée");
      return { expired: true };
    }

    return data;
  } catch (error) {
    console.error("❌ Erreur récupération session:", error);
    return null;
  }
}

// Compléter la session avec les réponses du partenaire 2
async function completeDistanceSession(sessionId, data) {
  if (!db) {
    console.error("❌ Firebase non initialisé");
    return false;
  }

  try {
    const sessionRef = db.collection('sessions_distance').doc(sessionId);
    const session = await sessionRef.get();
    
    if (!session.exists) {
      console.error("❌ Session non trouvée");
      return false;
    }

    const sessionData = session.data();
    const dateCreation = sessionData.dateCreation.toDate();
    const maintenant = new Date();
    const tempsEcoule = Math.floor((maintenant - dateCreation) / 1000 / 60); // en minutes

    await sessionRef.update({
      reponses_partenaire2: data.reponses,
      statut: 'complete',
      score: data.score,
      navigateur2: getBrowserInfo(),
      appareil2: getDeviceInfo(),
      tempsEntreLesDeuxJoueurs: tempsEcoule,
      dateCompletee: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Enregistrer aussi dans la collection 'parties' pour les stats
    await db.collection('parties').add({
      modeJeu: 'distance',
      partenaire1: sessionData.partenaire1,
      partenaire2: sessionData.partenaire2,
      nombreQuestions: sessionData.nombreQuestions,
      niveau: sessionData.niveau,
      score: data.score,
      aJoueActionsIntimes: false,
      tempsEntreLesDeuxJoueurs: tempsEcoule,
      quiACommence: sessionData.quiACommence,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      date: new Date().toLocaleString('fr-FR'),
      navigateur: getBrowserInfo(),
      appareil: getDeviceInfo()
    });

    console.log("✅ Session complétée avec succès");
    return true;
  } catch (error) {
    console.error("❌ Erreur complétion session:", error);
    return false;
  }
}

// Mettre à jour le statut des actions intimes
async function updateIntimateActionsStatus(sessionId, hasPlayed) {
  if (!db) return false;

  try {
    if (sessionId) {
      // Mode distance
      await db.collection('sessions_distance').doc(sessionId).update({
        aJoueActionsIntimes: hasPlayed
      });
    }
    return true;
  } catch (error) {
    console.error("❌ Erreur mise à jour actions intimes:", error);
    return false;
  }
}

// ============================================================================
// FONCTIONS ADMIN
// ============================================================================

async function getAllParties() {
  if (!db) {
    console.error("❌ Firebase non initialisé");
    return [];
  }

  try {
    const snapshot = await db.collection('parties')
      .orderBy('timestamp', 'desc')
      .limit(1000)
      .get();
    
    const parties = [];
    snapshot.forEach(doc => {
      parties.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log(`✅ ${parties.length} parties récupérées`);
    return parties;
  } catch (error) {
    console.error("❌ Erreur lors de la récupération des parties:", error);
    return [];
  }
}

async function getStatistiques() {
  const parties = await getAllParties();
  
  if (parties.length === 0) {
    return {
      total: 0,
      aujourdhui: 0,
      scoreMoyen: 0,
      meilleurePartie: null,
      actionsIntimesJouees: 0,
      partiesEnsemble: 0,
      partiesDistance: 0,
      tempsMoyenDistance: 0
    };
  }

  const aujourdhui = new Date().toLocaleDateString('fr-FR');
  const partiesAujourdhui = parties.filter(p => 
    p.date && p.date.split(' ')[0] === aujourdhui
  );

  const scores = parties.filter(p => p.score).map(p => p.score);
  const scoreMoyen = scores.length > 0 
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;

  const meilleurePartie = parties.reduce((best, p) => 
    (!best || (p.score > best.score)) ? p : best
  , null);

  const actionsIntimesJouees = parties.filter(p => p.aJoueActionsIntimes).length;
  const partiesEnsemble = parties.filter(p => p.modeJeu === 'ensemble').length;
  const partiesDistance = parties.filter(p => p.modeJeu === 'distance').length;
  
  const tempsDistance = parties
    .filter(p => p.modeJeu === 'distance' && p.tempsEntreLesDeuxJoueurs)
    .map(p => p.tempsEntreLesDeuxJoueurs);
  const tempsMoyenDistance = tempsDistance.length > 0
    ? Math.round(tempsDistance.reduce((a, b) => a + b, 0) / tempsDistance.length)
    : 0;

  return {
    total: parties.length,
    aujourdhui: partiesAujourdhui.length,
    scoreMoyen,
    meilleurePartie,
    actionsIntimesJouees,
    partiesEnsemble,
    partiesDistance,
    tempsMoyenDistance,
    parties: parties.slice(0, 50)
  };
}

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

function getBrowserInfo() {
  const ua = navigator.userAgent;
  if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Edg')) return 'Edge';
  if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';
  return 'Autre';
}

function getDeviceInfo() {
  return /Mobile|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop';
}

function formatTempsEcoule(minutes) {
  if (minutes < 60) {
    return minutes + ' min';
  } else if (minutes < 1440) {
    const heures = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return heures + 'h' + (mins > 0 ? mins + 'min' : '');
  } else {
    const jours = Math.floor(minutes / 1440);
    const heures = Math.floor((minutes % 1440) / 60);
    return jours + 'j' + (heures > 0 ? ' ' + heures + 'h' : '');
  }
}
