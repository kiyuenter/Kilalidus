import React, { useState, useEffect, useMemo } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getDatabase, ref, push, set, onValue, remove, update } from "firebase/database";
import Sidebar from "../components/Sidebar";

export default function App() {
  const [form, setForm] = useState({
    session: "Session",
    entryTime: "",
    entryType: "Entry Model",
    result: "BE",
    confidence: "Medium",
    pair: "",
    lotSize: "",
    direction: "",
    entryPrice: "",
    stopLoss: "",
    takeProfit: "",
    closeReason: "",
    profitLoss: "",
    link: "",
    emotionNote: ""
  });
  const [entries, setEntries] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [userId, setUserId] = useState(null);
  // New state to hold user email
  const [userEmail, setUserEmail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Your Firebase configuration provided in the chat
  const firebaseConfig = {
    apiKey: "AIzaSyDRbuqI5u5itte6LaQKqL9YEQScR-Q05rw",
    authDomain: "kilalidus-journal.firebaseapp.com",
    databaseURL: "https://kilalidus-journal-default-rtdb.firebaseio.com",
    projectId: "kilalidus-journal",
    storageBucket: "kilalidus-journal.appspot.com",
    messagingSenderId: "267336922475",
    appId: "1:267336922475:web:b33249d0323b1f030a482e"
  };

  const SESSIONS = ['Session','London', 'New York', 'Asian'];
  const ENTRY_TYPES = ['Entry Model','HTF POI + MSS + FVG', 'HTF POI + MSS + FVG + BB', 'HTF POI + MSS + BB', 'HTF POI + MSS + FIBONACCHI', 'OB', 'Reversal'];
  const RESULTS = ['Win', 'Loss', 'BE', 'Win with Partial'];
  const CONFIDENCE_LEVELS = ['Low', 'Medium', 'High'];

  // This effect handles Firebase initialization and authentication
  useEffect(() => {
    const initFirebase = async () => {
      try {
        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        
        // Listen for authentication state changes
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
          if (user) {
            // User is signed in.
            setUserId(user.uid);
            // Set the email if it exists, otherwise set to null
            setUserEmail(user.email);
            setLoading(false);
          } else {
            // No user is signed in. Sign in anonymously.
            try {
              await signInAnonymously(auth);
            } catch (e) {
              console.error("Anonymous Sign-in Error:", e);
              setError("Failed to sign in anonymously. Please check your Firebase settings.");
              setLoading(false);
            }
          }
        });
        
        // Cleanup listener on component unmount
        return () => unsubscribe();
        
      } catch (e) {
        console.error("Firebase Initialization Error:", e);
        setError("Failed to initialize Firebase. Please check your configuration.");
        setLoading(false);
      }
    };
    initFirebase();
  }, []);

  // Use a separate useEffect for data fetching that depends on the userId
  useEffect(() => {
    if (!userId) return; // Wait until we have a userId

    const db = getDatabase();
    // Using __app_id__ is important for multi-user scenarios
    const tradingJournalRef = ref(db, `/artifacts/__app_id__/users/${userId}/tradingJournal`);

    const unsubscribe = onValue(tradingJournalRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const loadedEntries = Object.keys(data).map((id) => ({ id, ...data[id] }));
        setEntries(sortByDate(loadedEntries));
      } else {
        setEntries([]);
      }
    }, (error) => {
      console.error("Firebase Data Fetch Error:", error);
      setError("Failed to load trading journal data.");
    });

    // Cleanup function for the listener
    return () => unsubscribe();
  }, [userId]); // Re-run this effect only when userId changes.


  // Helper function to sort entries by date
  const sortByDate = (data) => {
    return data.sort((a, b) => new Date(a.date) - new Date(b.date));
  };
  
  // Function to calculate RR based on entry price, SL, and TP
  const calculateRR = (entry, stopLoss, takeProfit) => {
    const ep = parseFloat(entry);
    const sl = parseFloat(stopLoss);
    const tp = parseFloat(takeProfit);

    if (isNaN(ep) || isNaN(sl) || isNaN(tp) || ep === sl) {
      return 'N/A';
    }

    const risk = Math.abs(ep - sl);
    const reward = Math.abs(tp - ep);
    return (reward / risk).toFixed(2);
  };
  
  // Memoize the R:R calculation to avoid unnecessary re-renders
  const currentRR = useMemo(() => {
    return calculateRR(form.entryPrice, form.stopLoss, form.takeProfit);
  }, [form.entryPrice, form.stopLoss, form.takeProfit]);


  // New function to calculate profit/loss based on close reason
  const calculateProfitLossBasedOnCloseReason = (currentForm) => {
    const { lotSize, direction, entryPrice, stopLoss, takeProfit, closeReason, pair } = currentForm;
    const lot = parseFloat(lotSize);
    const entry = parseFloat(entryPrice);

    if (isNaN(lot) || isNaN(entry) || !closeReason || !pair) {
      return "";
    }

    let exit = 0;
    if (closeReason === "TP hit") {
      exit = parseFloat(takeProfit);
    } else if (closeReason === "SL hit") {
      exit = parseFloat(stopLoss);
    } else if (closeReason === "BE hit") {
      return "0.00"; // Break-even is always 0.
    } else {
      // For any other closeReason, we won't calculate.
      return "";
    }

    if (isNaN(exit)) {
      return "";
    }

    let profitLoss = 0;
    if (pair.toUpperCase() === "XAUUSD") {
      if (direction === "Buy") {
        profitLoss = (exit - entry) * lot * 100;
      } else if (direction === "Sell") {
        profitLoss = (entry - exit) * lot * 100;
      }
    } else {
      if (direction === "Buy") {
        profitLoss = (exit - entry) * lot * 100000;
      } else if (direction === "Sell") {
        profitLoss = (entry - exit) * lot * 100000;
      }
    }

    return profitLoss.toFixed(2);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    let updatedForm = { ...form, [name]: value };

    // Recalculate profitLoss only when the closeReason changes or other price inputs
    // are changed after a closeReason is set
    if (name === "closeReason" || (form.closeReason && ["entryPrice", "stopLoss", "takeProfit", "lotSize", "direction", "pair"].includes(name))) {
        updatedForm.profitLoss = calculateProfitLossBasedOnCloseReason(updatedForm);
    }
    
    setForm(updatedForm);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!userId) {
      // Use a custom modal or message box instead of alert()
      console.error("User not authenticated.");
      return;
    }
    const finalForm = {
      ...form,
      rr: currentRR,
      date: new Date().toISOString().slice(0, 10),
    };
    
    const db = getDatabase();
    const tradeRef = ref(db, `/artifacts/__app_id__/users/${userId}/tradingJournal/` + (editingId || ''));
    
    if (editingId) {
      update(tradeRef, finalForm);
      setEditingId(null);
    } else {
      const newTradeRef = push(tradeRef);
      set(newTradeRef, finalForm);
    }

    // Reset the form
    setForm({
      session: "London",
      entryTime: "",
      entryType: "HTF POI",
      result: "BE",
      confidence: "Medium",
      pair: "",
      lotSize: "",
      direction: "",
      entryPrice: "",
      stopLoss: "",
      takeProfit: "",
      closeReason: "",
      profitLoss: "",
      link: "",
      emotionNote: ""
    });
  };

  const handleDelete = (id) => {
    if (!userId) return;
    const db = getDatabase();
    const tradeRef = ref(db, `/artifacts/__app_id__/users/${userId}/tradingJournal/${id}`);
    remove(tradeRef);
  };

  const handleEdit = (trade) => {
    setForm(trade);
    setEditingId(trade.id);
  };
  
  // Display a loading state while Firebase is initializing and authenticating
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-gray-400">
        <div className="p-6 text-center">
          <svg className="animate-spin h-8 w-8 text-white mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="mt-3 text-lg">Loading and authenticating...</p>
        </div>
      </div>
    );
  }

  // Display an error message if something went wrong
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-red-400 p-4 text-center">
        <p className="max-w-md bg-red-900/50 p-6 rounded-lg border border-red-700">
          Error: {error}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[250px_1fr] h-screen overflow-hidden bg-gray-900 text-white font-sans">
      <Sidebar />
      <main className="p-4 sm:p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-6 text-center sm:text-left">Trading Journal</h1>

          {/* This shows the user's ID/Email to prove authentication */}
          <div className="bg-gray-800 p-3 rounded-lg mb-4 text-sm text-gray-400">
              <span className="font-semibold">{userEmail ? "Your Email: " : "Your User ID: "}</span>
              <span className="font-mono break-all">{userEmail || userId}</span>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6 p-6 bg-gray-800 rounded-2xl shadow-xl">
            {/* Session Dropdown */}
            <select name="session" value={form.session} onChange={handleChange} className="border border-gray-600 p-3 rounded-lg bg-gray-700 text-white focus:ring-blue-500 focus:border-blue-500">
              {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            
            {/* Entry Time Input */}
            <input name="entryTime" type="time" value={form.entryTime} onChange={handleChange} className="border border-gray-600 p-3 rounded-lg bg-gray-700 text-white focus:ring-blue-500 focus:border-blue-500" required />
            
            {/* Entry Type Dropdown */}
            <select name="entryType" value={form.entryType} onChange={handleChange} className="border border-gray-600 p-3 rounded-lg bg-gray-700 text-white focus:ring-blue-500 focus:border-blue-500">
              {ENTRY_TYPES.map(et => <option key={et} value={et}>{et}</option>)}
            </select>

            {/* Result Dropdown */}
            <select name="result" value={form.result} onChange={handleChange} className="border border-gray-600 p-3 rounded-lg bg-gray-700 text-white focus:ring-blue-500 focus:border-blue-500">
              {RESULTS.map(res => <option key={res} value={res}>{res}</option>)}
            </select>

            {/* Confidence Level Dropdown */}
            <select name="confidence" value={form.confidence} onChange={handleChange} className="border border-gray-600 p-3 rounded-lg bg-gray-700 text-white focus:ring-blue-500 focus:border-blue-500">
              {CONFIDENCE_LEVELS.map(cl => <option key={cl} value={cl}>{cl}</option>)}
            </select>
            
            {/* RR Display */}
            <div className="flex items-center justify-center p-3 rounded-lg bg-gray-700 text-white border border-gray-600">
              <span className="text-sm font-semibold text-gray-400 mr-2">R:R</span>
              <span className="font-bold text-lg text-green-400">{currentRR}</span>
            </div>

            <input name="pair" placeholder="Pair (e.g. EUR/USD)" value={form.pair} onChange={handleChange} className="border border-gray-600 p-3 rounded-lg bg-gray-700 text-white focus:ring-blue-500 focus:border-blue-500" required />
            <input name="lotSize" type="number" step="0.01" placeholder="Lot Size" value={form.lotSize} onChange={handleChange} className="border border-gray-600 p-3 rounded-lg bg-gray-700 text-white focus:ring-blue-500 focus:border-blue-500" required />
            <select name="direction" value={form.direction} onChange={handleChange} className="border border-gray-600 p-3 rounded-lg bg-gray-700 text-white focus:ring-blue-500 focus:border-blue-500" required>
              <option value="">Direction</option>
              <option value="Buy">Buy</option>
              <option value="Sell">Sell</option>
            </select>
            <input name="entryPrice" type="number" step="0.0001" placeholder="Entry Price" value={form.entryPrice} onChange={handleChange} className="border border-gray-600 p-3 rounded-lg bg-gray-700 text-white focus:ring-blue-500 focus:border-blue-500" required />
            <input name="stopLoss" type="number" step="0.0001" placeholder="Stop Loss" value={form.stopLoss} onChange={handleChange} className="border border-gray-600 p-3 rounded-lg bg-gray-700 text-white focus:ring-blue-500 focus:border-blue-500" required />
            <input name="takeProfit" type="number" step="0.0001" placeholder="Take Profit" value={form.takeProfit} onChange={handleChange} className="border border-gray-600 p-3 rounded-lg bg-gray-700 text-white focus:ring-blue-500 focus:border-blue-500" required />
            
            {/* Close Reason dropdown */}
            <select name="closeReason" value={form.closeReason} onChange={handleChange} className="border border-gray-600 p-3 rounded-lg bg-gray-700 text-white focus:ring-blue-500 focus:border-blue-500">
              <option value="">Close Reason</option>
              <option value="TP hit">TP hit</option>
              <option value="SL hit">SL hit</option>
              <option value="BE hit">BE hit</option>
              <option value="Manual">Manual</option>
            </select>

            {/* Profit/Loss is now a manually editable field */}
            <input 
              name="profitLoss" 
              type="number"
              step="0.01"
              placeholder="Profit/Loss" 
              value={form.profitLoss} 
              onChange={handleChange} 
              className="border border-gray-600 p-3 rounded-lg bg-gray-700 text-white focus:ring-blue-500 focus:border-blue-500"
              readOnly={form.closeReason === "TP hit" || form.closeReason === "SL hit" || form.closeReason === "BE hit"}
            />
            <input name="link" placeholder="http://tradingview.com/sfsdf)" value={form.link} onChange={handleChange} className="border border-gray-600 p-3 rounded-lg bg-gray-700 text-white focus:ring-blue-500 focus:border-blue-500" required />
            <textarea name="emotionNote" placeholder="Notes on emotions, reasoning, etc." value={form.emotionNote} onChange={handleChange} rows="4" className="border border-gray-600 p-3 rounded-lg bg-gray-700 text-white col-span-1 sm:col-span-2 md:col-span-3 focus:ring-blue-500 focus:border-blue-500"></textarea>
            
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg col-span-1 sm:col-span-2 md:col-span-3 flex items-center justify-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-plus-circle">
                <circle cx="12" cy="12" r="10"></circle><path d="M8 12h8"></path><path d="M12 8v8"></path>
              </svg> {editingId ? "Update Trade" : "Add Trade"}
            </button>
          </form>

          {/* Table */}
          <div className="p-6 bg-gray-800 rounded-2xl shadow-xl overflow-x-auto">
            <h2 className="text-2xl font-bold mb-4">Trade History</h2>
            <table className="w-full">
              <thead>
                <tr className="bg-gray-700 text-sm font-semibold text-gray-300 uppercase">
                  <th className="p-3 text-left">Date</th>
                  <th className="p-3 text-left">Pair</th>
                  <th className="p-3 text-left">Session</th>
                  <th className="p-3 text-left">Entry Type</th>
                  <th className="p-3 text-left">R:R</th>
                  <th className="p-3 text-left">Result</th>
                  <th className="p-3 text-left">P/L</th>
                  <th className="p-3 text-left">Confidence</th>
                  <th className="p-3 text-left">Link</th>
                  <th className="p-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((t) => (
                  <tr key={t.id} className="text-left border-t border-gray-700">
                    <td className="p-3 whitespace-nowrap">{t.date}</td>
                    <td className="p-3 whitespace-nowrap">{t.pair}</td>
                    <td className="p-3 whitespace-nowrap">{t.session}</td>
                    <td className="p-3 whitespace-nowrap">{t.entryType}</td>
                    <td className="p-3 whitespace-nowrap">{t.rr}</td>
                    <td className="p-3 whitespace-nowrap">{t.result}</td>
                    <td className={`p-3 whitespace-nowrap ${t.profitLoss > 0 ? 'text-green-400' : t.profitLoss < 0 ? 'text-red-400' : 'text-gray-400'}`}>{t.profitLoss}</td>
                    <td className="p-3 whitespace-nowrap">{t.confidence}</td>
                    <td className="p-3 whitespace-wrap">{t.link}</td>
                    <td className="p-3 flex gap-2 justify-start">
                      <button onClick={() => handleEdit(t)} className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 p-2 rounded-lg transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-edit">
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
                          <path d="m15 5 4 4"></path>
                        </svg>
                      </button>
                      <button onClick={() => handleDelete(t.id)} className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-trash-2">
                          <path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                          <line x1="10" x2="10" y1="11" y2="17"></line><line x1="14" x2="14" y1="11" y2="17"></line>
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
