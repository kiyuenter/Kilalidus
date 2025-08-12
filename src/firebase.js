import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDRbuqI5u5itte6LaQKqL9YEQScR-Q05rw",
  authDomain: "kilalidus-journal.firebaseapp.com",
  databaseURL: "https://kilalidus-journal-default-rtdb.firebaseio.com",
  projectId: "kilalidus-journal",
  storageBucket: "kilalidus-journal.appspot.com",
  messagingSenderId: "267336922475",
  appId: "1:267336922475:web:b33249d0323b1f030a482e"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
