import React, { useState, useEffect, useMemo } from "react";
import Sidebar from "../components/Sidebar"; // Ensure Sidebar.jsx exists
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getDatabase, ref, onValue } from "firebase/database";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend
} from "recharts";
import CalendarHeatmap from "../components/CalendarHeatmap"; // Use your heatmap component

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDRbuqI5u5itte6LaQKqL9YEQScR-Q05rw",
  authDomain: "kilalidus-journal.firebaseapp.com",
  databaseURL: "https://kilalidus-journal-default-rtdb.firebaseio.com",
  projectId: "kilalidus-journal",
  storageBucket: "kilalidus-journal.appspot.com",
  messagingSenderId: "267336922475",
  appId: "1:267336922475:web:b33249d0323b1f030a482e"
};

export default function Dashboard() {
  const [entries, setEntries] = useState([]);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch data from Firebase
  useEffect(() => {
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getDatabase(app);

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
        const dataPath = `artifacts/__app_id__/users/${user.uid}/tradingJournal`;
        const tradingJournalRef = ref(db, dataPath);

        const unsubData = onValue(tradingJournalRef,
          (snapshot) => {
            const data = snapshot.val();
            if (data) {
              const loadedEntries = Object.keys(data).map(id => ({
                id,
                ...data[id],
                date: data[id].date || new Date().toLocaleDateString()
              }));
              setEntries(loadedEntries.sort((a, b) => new Date(a.date) - new Date(b.date)));
            } else {
              setEntries([]);
            }
            setLoading(false);
          },
          (dbError) => {
            console.error("Data Fetch Error:", dbError);
            setError("Failed to load trading journal data.");
            setLoading(false);
          }
        );

        return () => unsubData();

      } else {
        try {
          await signInAnonymously(auth);
        } catch (authError) {
          console.error("Auth Error:", authError);
          setError("Failed to authenticate.");
          setLoading(false);
        }
      }
    });

    return () => unsubAuth();
  }, []);

  // --- Stats ---
  const stats = useMemo(() => {
    if (entries.length === 0) return { totalPnL: "$0", profitFactor: "N/A", avgWinningTrade: "$0", avgLosingTrade: "$0", winRate: "0%" };

    let totalPnL = 0, totalProfit = 0, totalLoss = 0, winningTrades = 0, losingTrades = 0;
    entries.forEach(entry => {
      const pnl = parseFloat(entry.profitLoss);
      if (!isNaN(pnl)) {
        totalPnL += pnl;
        if (pnl > 0) { totalProfit += pnl; winningTrades++; }
        else if (pnl < 0) { totalLoss += pnl; losingTrades++; }
      }
    });

    const profitFactor = totalLoss !== 0 ? (totalProfit / Math.abs(totalLoss)).toFixed(2) : "N/A";
    const avgWinningTrade = winningTrades > 0 ? (totalProfit / winningTrades).toFixed(2) : "0";
    const avgLosingTrade = losingTrades > 0 ? (totalLoss / losingTrades).toFixed(2) : "0";
    const winRate = ((winningTrades / entries.length) * 100).toFixed(0);

    return {
      totalPnL: `$${totalPnL.toFixed(2)}`,
      profitFactor,
      avgWinningTrade: `$${avgWinningTrade}`,
      avgLosingTrade: `$${avgLosingTrade}`,
      winRate: `${winRate}%`
    };
  }, [entries]);

  // --- Cumulative PnL Line Data ---
  const lineData = useMemo(() => {
    if (entries.length === 0) return [];
    // Aggregate by day
    const dailyPnL = {};
    entries.forEach(entry => {
      const date = new Date(entry.date).toISOString().slice(0, 10);
      dailyPnL[date] = (dailyPnL[date] || 0) + (parseFloat(entry.profitLoss) || 0);
    });
    const sortedDates = Object.keys(dailyPnL).sort((a, b) => new Date(a) - new Date(b));
    let cumulative = 0;
    return sortedDates.map(date => {
      cumulative += dailyPnL[date];
      return { date, cumulativePnL: cumulative };
    });
  }, [entries]);

  // --- Pie Chart Data ---
  const pieData = useMemo(() => {
    const winners = entries.filter(t => Number(t.profitLoss) > 0).length;
    const losers = entries.filter(t => Number(t.profitLoss) <= 0).length;
    return [
      { name: "Winners", value: winners, color: "#22c55e" },
      { name: "Losers", value: losers, color: "#ef4444" },
    ];
  }, [entries]);

  const StatCard = ({ label, value }) => (
    <div className="bg-gray-800 rounded-lg shadow p-4 flex flex-col items-center">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className="text-white text-xl font-semibold">{value}</span>
    </div>
  );

  const TradesPositionsTable = ({ entries }) => (
    <div className="p-6 bg-gray-800 rounded-2xl shadow-xl overflow-x-auto">
      <h2 className="text-2xl font-bold mb-4">Recent Trades</h2>
      {entries.length > 0 ? (
        <table className="w-full">
          <thead>
            <tr className="bg-gray-700 text-sm font-semibold text-gray-300 uppercase">
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Pair</th>
              <th className="p-3 text-left">Result</th>
              <th className="p-3 text-left">P/L</th>
              <th className="p-3 text-left">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(t => (
              <tr key={t.id} className="text-left border-t border-gray-700">
                <td className="p-3 whitespace-nowrap">{t.date}</td>
                <td className="p-3 whitespace-nowrap">{t.pair}</td>
                <td className="p-3 whitespace-nowrap">{t.result}</td>
                <td className={`p-3 whitespace-nowrap ${t.profitLoss > 0 ? 'text-green-400' : t.profitLoss < 0 ? 'text-red-400' : 'text-gray-400'}`}>{t.profitLoss}</td>
                <td className="p-3 whitespace-nowrap">{t.confidence}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="text-center text-gray-500 py-8">No trading journal entries found.</div>
      )}
    </div>
  );

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-gray-400">Loading...</div>;
  if (error) return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-red-400">{error}</div>;

  return (
    <div className="grid grid-cols-[250px_1fr] h-screen overflow-hidden bg-gray-900 text-white">
      <Sidebar />
      <main className="p-8 overflow-y-auto">
        <h1 className="text-3xl font-bold mb-6">Trading Dashboard</h1>

        <div className="mb-4 text-sm text-gray-400">
          <span className="font-semibold">User ID:</span> {userId}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-6 mb-8">
          <StatCard label="Total P&L" value={stats.totalPnL} />
          <StatCard label="Profit Factor" value={stats.profitFactor} />
          <StatCard label="Avg Winning Trade" value={stats.avgWinningTrade} />
          <StatCard label="Avg Losing Trade" value={stats.avgLosingTrade} />
          <StatCard label="Win Rate" value={stats.winRate} />
        </div>

        <div className="flex flex-col md:flex-row gap-6 mb-6">
          {/* Pie Chart */}
          <div className="bg-gray-800 p-6 rounded shadow mb-6 md:w-96">
            <h2 className="text-xl font-semibold mb-4">Winning % By Trades</h2>
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
                  {pieData.map(entry => <Cell key={entry.name} fill={entry.color} />)}
                </Pie>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Line Chart */}
          <div className="bg-gray-800 p-6 rounded shadow mb-6 flex-1">
            <h2 className="text-xl font-semibold mb-4">Daily Net Cumulative P&L</h2>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={lineData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis dataKey="date" stroke="#aaa" />
                <YAxis stroke="#aaa" />
                <Tooltip />
                <Line type="monotone" dataKey="cumulativePnL" stroke="#22c55e" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Trades + Calendar */}
        <div className="flex flex-col md:flex-row gap-6 mb-6">
          <div className="flex-1">
            <TradesPositionsTable entries={entries.slice(-8).reverse()} />
          </div>
          <div className="w-full md:w-96">
            <CalendarHeatmap entries={entries} />
          </div>
        </div>
      </main>
    </div>
  );
}
