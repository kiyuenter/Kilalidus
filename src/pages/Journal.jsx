import React, { useState, useEffect } from "react";
import { getDatabase, ref, push, set, onValue, remove, update } from "firebase/database";
import { FaPlus, FaEdit, FaTrash } from "react-icons/fa";
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend
} from "recharts";
import { db } from "../firebase"; // your Firebase config file
import Sidebar from "../components/Sidebar";

export default function Journal() {
  const [form, setForm] = useState({
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

  // Helper function to sort entries by date
  const sortByDate = (data) => {
    return data.sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  // Function to calculate cumulative P&L for the line chart, grouped by date
  const calculateDailyCumulativePnL = (data) => {
    // Create a map to group trades by date and sum their P&L
    const dailyPnL = data.reduce((acc, trade) => {
        const date = trade.date;
        const pnl = Number(trade.profitLoss);
        if (acc[date]) {
            acc[date] += pnl;
        } else {
            acc[date] = pnl;
        }
        return acc;
    }, {});

    // Sort the dates and calculate the cumulative P&L
    const sortedDates = Object.keys(dailyPnL).sort();
    let cumulative = 0;
    return sortedDates.map(date => {
        cumulative += dailyPnL[date];
        return {
            date,
            cumulativePnL: cumulative,
        };
    });
  };

  const calculateProfitLoss = (currentForm) => {
    const { lotSize, direction, entryPrice, stopLoss, takeProfit, closeReason, pair } = currentForm;
    const lot = parseFloat(lotSize);
    const entry = parseFloat(entryPrice);

    if (isNaN(lot) || isNaN(entry) || !closeReason || !pair) {
      return "";
    }

    // If the trade is a break-even trade, return 0 as the default.
    // The user can manually input a different value.
    if (closeReason === "BE hit") {
        return "0.00";
    }

    let exit = 0;
    switch (closeReason) {
      case "TP hit":
        exit = parseFloat(takeProfit);
        break;
      case "SL hit":
        exit = parseFloat(stopLoss);
        break;
      default:
        return "";
    }

    if (isNaN(exit)) {
      return "";
    }

    let profitLoss = 0;

    // Check for specific pairs that require different calculations, like Gold (XAUUSD)
    if (pair.toUpperCase() === "XAUUSD") {
      // For XAU/USD, a standard lot (1.0) is 100 ounces.
      // The profit/loss is calculated as (exit - entry) * lot size * 100
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
    const tradesRef = ref(getDatabase(), "tradingJournal");
    onValue(tradesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Correctly fetch and format the data
        const loaded = Object.keys(data).map((id) => ({ id, ...data[id] }));
        // Sort the data by date to ensure the cumulative P&L line chart is correct
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
    // and if the close reason is not "BE hit".
    if (name !== "profitLoss" && updatedForm.closeReason !== "BE hit") {
        updatedForm.profitLoss = calculateProfitLoss(updatedForm);
    }
    setForm(updatedForm);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // For "BE hit", the profitLoss is already manually set in the form state.
    // For other cases, we ensure the profitLoss is calculated one last time.
    const finalForm = { 
        ...form, 
        profitLoss: form.closeReason !== "BE hit" ? calculateProfitLoss(form) : form.profitLoss,
        // Add a date field with the current date in YYYY-MM-DD format
        date: new Date().toISOString().slice(0, 10),
    };

    if (editingId) {
      const tradeRef = ref(getDatabase(), "tradingJournal/" + editingId);
      update(tradeRef, finalForm);
      setEditingId(null);
    } else {
      const tradesRef = ref(getDatabase(), "tradingJournal");
      const newTradeRef = push(tradesRef);
      set(newTradeRef, finalForm);
    }
    setForm({
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
    const tradeRef = ref(getDatabase(), "tradingJournal/" + id);
    remove(tradeRef);
  };

  const handleEdit = (trade) => {
    setForm(trade);
    setEditingId(trade.id);
  };

  // Recharts data
  const cumulativeData = calculateDailyCumulativePnL(entries);

  const pieData = [
    { name: "Winners", value: entries.filter(t => Number(t.profitLoss) > 0).length, color: "#22c55e" },
    { name: "Losers", value: entries.filter(t => Number(t.profitLoss) <= 0).length, color: "#ef4444" },
  ];
  
  const totalTrades = entries.length;
  const winningRate = totalTrades > 0 ? ((pieData[0].value / totalTrades) * 100).toFixed(0) : 0;


  return (
    <div className="grid grid-cols-[250px_1fr] h-screen overflow-hidden bg-gray-900 text-white font-sans">
      <Sidebar />
      <main className="p-8 overflow-y-auto">
        <h1 className="text-3xl font-bold mb-6">Trading Journal</h1>

        {/* Form */}
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 mb-6 p-6 bg-gray-800 rounded shadow">
          <input name="pair" placeholder="Pair" value={form.pair} onChange={handleChange} className="border border-gray-600 p-2 rounded bg-gray-700 text-white" required />
          <input name="lotSize" type="number" step="0.01" placeholder="Lot Size" value={form.lotSize} onChange={handleChange} className="border border-gray-600 p-2 rounded bg-gray-700 text-white" required />
          <select name="direction" value={form.direction} onChange={handleChange} className="border border-gray-600 p-2 rounded bg-gray-700 text-white" required>
            <option value="">Direction</option>
            <option value="Buy">Buy</option>
            <option value="Sell">Sell</option>
          </select>
          <input name="entryPrice" type="number" step="0.0001" placeholder="Entry Price" value={form.entryPrice} onChange={handleChange} className="border border-gray-600 p-2 rounded bg-gray-700 text-white" required />
          <input name="stopLoss" type="number" step="0.0001" placeholder="Stop Loss" value={form.stopLoss} onChange={handleChange} className="border border-gray-600 p-2 rounded bg-gray-700 text-white" required />
          <input name="takeProfit" type="number" step="0.0001" placeholder="Take Profit" value={form.takeProfit} onChange={handleChange} className="border border-gray-600 p-2 rounded bg-gray-700 text-white" required />
          <select name="closeReason" value={form.closeReason} onChange={handleChange} className="border border-gray-600 p-2 rounded bg-gray-700 text-white" required>
            <option value="">Close Reason</option>
            <option value="TP hit">TP hit</option>
            <option value="SL hit">SL hit</option>
            <option value="BE hit">BE hit</option>
          </select>
          <input 
            name="profitLoss" 
            placeholder="Profit/Loss" 
            value={form.profitLoss} 
            onChange={handleChange} 
            className="border border-gray-600 p-2 rounded bg-gray-700 text-white" 
            readOnly={form.closeReason !== "BE hit"} 
          />
          <textarea name="emotionNote" placeholder="Notes on emotions, reasoning, etc." value={form.emotionNote} onChange={handleChange} rows="4" className="border border-gray-600 p-2 rounded bg-gray-700 text-white col-span-2"></textarea>
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded col-span-2 flex items-center justify-center gap-2">
            <FaPlus /> {editingId ? "Update Trade" : "Add Trade"}
          </button>
        </form>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Pie Chart */}
          <div className="p-6 bg-gray-800 shadow rounded">
            <h2 className="text-xl font-semibold mb-2">Winning % By Trades</h2>
            <p className="text-4xl font-bold text-green-500 text-center">{winningRate}%</p>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  innerRadius={70}
                  outerRadius={90}
                  startAngle={90}
                  endAngle={-270}
                  paddingAngle={3}
                  cornerRadius={5}
                  label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-around mt-4 text-gray-300 font-semibold">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-green-500 rounded"></div>
                <span>{pieData[0].value} winners</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-red-500 rounded"></div>
                <span>{pieData[1].value} losers</span>
              </div>
            </div>
          </div>
          
          {/* Line Chart */}
          <div className="p-6 bg-gray-800 shadow rounded md:col-span-2">
            <h2 className="text-xl font-semibold mb-4">Daily Net Cumulative P&L</h2>
            <ResponsiveContainer width="100%" height={250}>
              {entries.length > 1 ? (
                <LineChart data={cumulativeData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                  <XAxis dataKey="date" stroke="#aaa" />
                  <YAxis stroke="#aaa" />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="cumulativePnL" 
                    stroke="#22c55e" 
                    strokeWidth={3} 
                    dot={{ r: 4, fill: '#fff', stroke: '#22c55e', strokeWidth: 2 }} 
                    activeDot={{ r: 8, stroke: '#fff', strokeWidth: 2 }}
                  />
                </LineChart>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <p>Add at least two trades to see the cumulative P&L chart.</p>
                </div>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Table */}
        <div className="p-6 bg-gray-800 shadow rounded">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-700">
                <th className="p-2 text-left">Date</th>
                <th className="p-2 text-left">Pair</th>
                <th className="p-2 text-left">Lot Size</th>
                <th className="p-2 text-left">Direction</th>
                <th className="p-2 text-left">Entry</th>
                <th className="p-2 text-left">Stop Loss</th>
                <th className="p-2 text-left">Take Profit</th>
                <th className="p-2 text-left">Close Reason</th>
                <th className="p-2 text-left">P/L</th>
                <th className="p-2 text-left">Notes</th>
                <th className="p-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((t) => (
                <tr key={t.id} className="text-left border-t border-gray-700">
                  <td className="p-2">{t.date}</td>
                  <td className="p-2">{t.pair}</td>
                  <td className="p-2">{t.lotSize}</td>
                  <td className="p-2">{t.direction}</td>
                  <td className="p-2">{t.entryPrice}</td>
                  <td className="p-2">{t.stopLoss}</td>
                  <td className="p-2">{t.takeProfit}</td>
                  <td className="p-2">{t.closeReason}</td>
                  <td className="p-2">{t.profitLoss}</td>
                  <td className="p-2 max-w-[200px] text-left overflow-hidden whitespace-pre-wrap">{t.emotionNote}</td>
                  <td className="p-2 flex gap-2 justify-start">
                    <button onClick={() => handleEdit(t)} className="bg-yellow-400 hover:bg-yellow-500 text-white p-2 rounded">
                      <FaEdit />
                    </button>
                    <button onClick={() => handleDelete(t.id)} className="bg-red-500 hover:bg-red-600 text-white p-2 rounded">
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
