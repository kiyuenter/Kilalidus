import React, { useState, useEffect, useMemo } from "react";
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, push, set, onValue, remove, update } from "firebase/database";
import { PlusCircle, Edit, Trash2 } from "lucide-react";
import Sidebar from "../components/Sidebar"; // This is the line you requested.

// The following Firebase configuration is for a temporary, anonymous session.
// In a real application, you would replace this with your own Firebase project configuration.
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export default function Journal() {
  const [form, setForm] = useState({
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
    emotionNote: ""
  });
  const [entries, setEntries] = useState([]);
  const [editingId, setEditingId] = useState(null);

  const SESSIONS = ['London', 'New York', 'Asian'];
  const ENTRY_TYPES = ['HTF POI', 'MSS', 'FVG', 'IRL', 'MSS + BB', 'Reversal'];
  const RESULTS = ['Win', 'Loss', 'BE', 'Win with Partial'];
  const CONFIDENCE_LEVELS = ['Low', 'Medium', 'High'];

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

  // Function to calculate profit/loss based on new result field
  const calculateProfitLoss = (currentForm) => {
    const { lotSize, direction, entryPrice, stopLoss, takeProfit, result, pair } = currentForm;
    const lot = parseFloat(lotSize);
    const entry = parseFloat(entryPrice);

    if (isNaN(lot) || isNaN(entry) || !result || !pair) {
      return "";
    }

    if (result === "BE") {
      return "0.00";
    }

    let exit = 0;
    if (result === "Win" || result === "Win with Partial") {
      exit = parseFloat(takeProfit);
    } else if (result === "Loss") {
      exit = parseFloat(stopLoss);
    } else {
        return "";
    }

    if (isNaN(exit)) {
      return "";
    }

    let profitLoss = 0;

    // Check for specific pairs that require different calculations, like Gold (XAUUSD)
    if (pair.toUpperCase() === "XAUUSD") {
      if (direction === "Buy") {
        profitLoss = (exit - entry) * lot * 100;
      } else if (direction === "Sell") {
        profitLoss = (entry - exit) * lot * 100;
      }
    } else {
      // Standard calculation for major forex pairs
      if (direction === "Buy") {
        profitLoss = (exit - entry) * lot * 100000;
      } else if (direction === "Sell") {
        profitLoss = (entry - exit) * lot * 100000;
      }
    }

    return profitLoss.toFixed(2);
  };

  useEffect(() => {
    const tradesRef = ref(db, "tradingJournal");
    onValue(tradesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const loaded = Object.keys(data).map((id) => ({ id, ...data[id] }));
        setEntries(sortByDate(loaded));
      } else {
        setEntries([]);
      }
    });
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    let updatedForm = { ...form, [name]: value };

    // Only recalculate profitLoss if the changed field is not profitLoss itself
    // and if the close reason is not "BE".
    if (name !== "profitLoss" && updatedForm.result !== "BE") {
        updatedForm.profitLoss = calculateProfitLoss(updatedForm);
    }
    setForm(updatedForm);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalForm = {
      ...form,
      rr: currentRR,
      profitLoss: form.result !== "BE" ? calculateProfitLoss(form) : form.profitLoss,
      date: new Date().toISOString().slice(0, 10),
    };

    if (editingId) {
      const tradeRef = ref(db, "tradingJournal/" + editingId);
      update(tradeRef, finalForm);
      setEditingId(null);
    } else {
      const tradesRef = ref(db, "tradingJournal");
      const newTradeRef = push(tradesRef);
      set(newTradeRef, finalForm);
    }
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
      emotionNote: ""
    });
  };

  const handleDelete = (id) => {
    const tradeRef = ref(db, "tradingJournal/" + id);
    remove(tradeRef);
  };

  const handleEdit = (trade) => {
    setForm(trade);
    setEditingId(trade.id);
  };

  return (
    <div className="grid grid-cols-[250px_1fr] h-screen overflow-hidden bg-gray-900 text-white font-sans">
      <Sidebar />
      <main className="p-4 sm:p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-6 text-center sm:text-left">Trading Journal</h1>

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
            
            {/* Close Reason is now tied to the Result, but we keep it for old data */}
            <select name="closeReason" value={form.closeReason} onChange={handleChange} className="border border-gray-600 p-3 rounded-lg bg-gray-700 text-white focus:ring-blue-500 focus:border-blue-500" required>
              <option value="">Close Reason (Legacy)</option>
              <option value="TP hit">TP hit</option>
              <option value="SL hit">SL hit</option>
              <option value="BE hit">BE hit</option>
            </select>

            <input 
              name="profitLoss" 
              placeholder="Profit/Loss" 
              value={form.profitLoss} 
              onChange={handleChange} 
              className="border border-gray-600 p-3 rounded-lg bg-gray-700 text-white focus:ring-blue-500 focus:border-blue-500" 
              readOnly={form.result !== "BE"} 
            />
            <textarea name="emotionNote" placeholder="Notes on emotions, reasoning, etc." value={form.emotionNote} onChange={handleChange} rows="4" className="border border-gray-600 p-3 rounded-lg bg-gray-700 text-white col-span-1 sm:col-span-2 md:col-span-3 focus:ring-blue-500 focus:border-blue-500"></textarea>
            
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg col-span-1 sm:col-span-2 md:col-span-3 flex items-center justify-center gap-2">
              <PlusCircle size={20} /> {editingId ? "Update Trade" : "Add Trade"}
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
                    <td className="p-3 flex gap-2 justify-start">
                      <button onClick={() => handleEdit(t)} className="bg-yellow-400 hover:bg-yellow-500 text-white p-2 rounded-lg transition-colors">
                        <Edit size={16} />
                      </button>
                      <button onClick={() => handleDelete(t.id)} className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg transition-colors">
                        <Trash2 size={16} />
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
