import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { initializeAuth, inMemoryPersistence } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA6-iuYJIMfPYykCps797wKgpr6w7Z2NHA",
  authDomain: "casamento-ana-gabriel-2d0a5.firebaseapp.com",
  projectId: "casamento-ana-gabriel-2d0a5",
  storageBucket: "casamento-ana-gabriel-2d0a5.firebasestorage.app",
  messagingSenderId: "965174156571",
  appId: "1:965174156571:web:f8bb7370f3e2a9045f47be",
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, { persistence: inMemoryPersistence });
export const db = getFirestore(app);
