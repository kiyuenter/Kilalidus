import React, { useState, useEffect } from "react";
import { getDatabase, ref, onValue } from "firebase/database";
import Sidebar from "../components/Sidebar";
import TradesPositionsTable from "../components/TradesPositionsTable";
import CalendarHeatmap from "../components/CalendarHeatmap";
import { db } from "../firebase"; // your Firebase config file

import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const StatCard = ({ label, value }) => (
  <div className="bg-gray-800 rounded-lg shadow p-4 flex flex-col items-center">
    <span className="text-gray-400 text-sm">{label}</span>
    <span className="text-white text-xl font-semibold">{value}</span>
  </div>
);

const Dashboard = () => {
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    // Fetch data from the same path as the Trading Journal
    const tradesRef = ref(getDatabase(), "tradingJournal");
    onValue(tradesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const loaded = Object.keys(data).map((id) => ({ id, ...data[id], date: new Date().toLocaleDateString() }));
        setEntries(loaded);
      } else {
        setEntries([]);
      }
    });
  }, []);

  // Helper function to calculate stats from entries
  const calculateStats = (data) => {
    if (data.length === 0) {
      return {
        totalPnL: "$0",
        profitFactor: "N/A",
        avgWinningTrade: "$0",
        avgLosingTrade: "$0",
        winRate: "0%",
      };
    }

    let totalPnL = 0;
    let totalProfit = 0;
    let totalLoss = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    const winningTradeValues = [];
    const losingTradeValues = [];

    data.forEach(entry => {
      const pnl = parseFloat(entry.profitLoss);
      totalPnL += pnl;

      if (pnl > 0) {
        totalProfit += pnl;
        winningTrades++;
        winningTradeValues.push(pnl);
      } else if (pnl < 0) {
        totalLoss += pnl;
        losingTrades++;
        losingTradeValues.push(pnl);
      }
    });

    const profitFactor = totalLoss !== 0 ? (totalProfit / Math.abs(totalLoss)).toFixed(2) : "N/A";
    const avgWinningTrade = winningTrades > 0 ? (totalProfit / winningTrades).toFixed(2) : "0";
    const avgLosingTrade = losingTrades > 0 ? (totalLoss / losingTrades).toFixed(2) : "0";
    const winRate = ((winningTrades / data.length) * 100).toFixed(0);

    return {
      totalPnL: `$${totalPnL.toFixed(2)}`,
      profitFactor: profitFactor,
      avgWinningTrade: `$${avgWinningTrade}`,
      avgLosingTrade: `$${avgLosingTrade}`,
      winRate: `${winRate}%`,
    };
  };

  // Helper function to calculate cumulative P&L for the line chart
  const calculateCumulativePnL = (data) => {
    let cumulative = 0;
    return data.map(entry => {
      cumulative += Number(entry.profitLoss);
      return { ...entry, cumulativePnL: cumulative };
    });
  };

  // Helper function to calculate winning/losing trades for the pie chart
  const calculatePieData = (data) => {
    const winners = data.filter(t => Number(t.profitLoss) > 0).length;
    const losers = data.filter(t => Number(t.profitLoss) <= 0).length;
    return [
      { name: "Winners", value: winners, color: "#22c55e" },
      { name: "Losers", value: losers, color: "#ef4444" },
    ];
  };

  // Calculate dynamic data
  const stats = calculateStats(entries);
  const lineData = calculateCumulativePnL(entries);
  const pieData = calculatePieData(entries);

  return (
    <div className="grid grid-cols-[250px_1fr] h-screen overflow-hidden bg-gray-900 text-white font-sans">
      <Sidebar />
      <main className="p-8 overflow-y-auto">
        <h1 className="text-3xl font-bold mb-6">Trading Dashboard</h1>

        {/* Status Viewer */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-6 mb-8">
          <StatCard label="Total P&L" value={stats.totalPnL} />
          <StatCard label="Profit Factor" value={stats.profitFactor} />
          <StatCard label="Avg Winning Trade" value={stats.avgWinningTrade} />
          <StatCard label="Avg Losing Trade" value={stats.avgLosingTrade} />
          <StatCard label="Win Rate" value={stats.winRate} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Donut Chart */}
          <div className="bg-gray-800 p-6 rounded shadow">
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
          <div className="bg-gray-800 p-6 rounded shadow md:col-span-2">
            <h2 className="text-xl font-semibold mb-4">Daily Net cumulative P&amp;L</h2>
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
        
        <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1">
                {/* Now passing the entries data to the table component */}
                <TradesPositionsTable entries={entries} />
            </div>
            <div className="w-full md:w-96">
                {/* Now passing the entries data to the heatmap component */}
                <CalendarHeatmap entries={entries} />
            </div>
        </div>

      </main>
    </div>
  );
};

export default Dashboard;
