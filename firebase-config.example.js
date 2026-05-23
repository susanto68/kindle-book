// Copy this file to firebase-config.js in production if the browser should
// read Firestore metadata directly. Do not commit real Firebase web config if
// you prefer to inject it from Vercel environment variables.
window.KINDLE_FIREBASE_CONFIG = {
  apiKey: "YOUR_WEB_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Keep public browser write tracking off unless your Firestore rules and
// backend aggregation flow are configured for it.
window.KINDLE_FIREBASE_PUBLIC_TRACKING = false;
