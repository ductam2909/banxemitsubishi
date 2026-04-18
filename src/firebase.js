import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAaX0wpDjsh72wXXR1Zb6DIq4k-d5MywVE",
  authDomain: "demoapp-b868a.firebaseapp.com",
  databaseURL: "https://demoapp-b868a-default-rtdb.firebaseio.com",
  projectId: "demoapp-b868a",
  storageBucket: "demoapp-b868a.appspot.com",
  messagingSenderId: "787575797082",
  appId: "1:787575797082:web:f0d0cd1fd5ba4c10c6ef63",
  measurementId: "G-FWQPLZGCX6",
};

// Khởi tạo Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
