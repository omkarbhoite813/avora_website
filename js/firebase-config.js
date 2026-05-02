import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore }  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getAuth }       from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

const firebaseConfig = {
    apiKey:            "AIzaSyA4HAHD267qvd7ey_Gr8CEczKnllmTssyY",
    authDomain:        "avora-2154c.firebaseapp.com",
    projectId:         "avora-2154c",
    storageBucket:     "avora-2154c.firebasestorage.app",
    messagingSenderId: "591751164583",
    appId:             "1:591751164583:web:59a9dc6ca8ebe56de1a182",
    measurementId:     "G-EEBVLJS070"
};

const app = initializeApp(firebaseConfig);
export const db   = getFirestore(app);
export const auth = getAuth(app);
