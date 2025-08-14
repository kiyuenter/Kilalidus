import React, { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { getDatabase, ref, onValue } from 'firebase/database';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';

import { auth, db } from '../firebase'; 
import Sidebar from '../components/Sidebar';

const loadScript = (src, id, callback) => {
    if (!document.getElementById(id)) {
        const script = document.createElement('script');
        script.src = src;
        script.id = id;
        script.onload = callback;
        document.head.appendChild(script);
    } else {
        callback();
    }
};

export default function App() {
    const [entries, setEntries] = useState([]);
    const [filteredEntries, setFilteredEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [scriptsLoaded, setScriptsLoaded] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [userId, setUserId] = useState(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserId(user.uid);
            } else {
                try {
                    await signInAnonymously(auth);
                } catch (authError) {
                    console.error('Failed to sign in:', authError);
                    setError('Failed to authenticate. Please try again.');
                    setLoading(false);
                }
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!userId) return;

        const appId = '__app_id__'; 
        const tradesRef = ref(db, `artifacts/${appId}/users/${userId}/tradingJournal`);

        const unsubscribe = onValue(tradesRef, (snapshot) => {
            const loadedEntries = [];
            if (snapshot.exists()) {
                const data = snapshot.val();
                Object.keys(data).forEach(key => {
                    loadedEntries.push({ id: key, ...data[key] });
                });
            }
            setEntries(loadedEntries.sort((a, b) => new Date(a.date) - new Date(b.date)));
            setLoading(false);
            setError(null);
        }, (fetchError) => {
            console.error("Error fetching data:", fetchError);
            setError('Failed to fetch data from the database. Check your security rules and collection path.');
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userId]);

    useEffect(() => {
        let jspdfLoaded = false;
        let xlsxLoaded = false;
        
        const checkScripts = () => {
            if (jspdfLoaded && xlsxLoaded) {
                setScriptsLoaded(true);
            }
        };

        loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js", "jspdf", () => {
            loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.25/jspdf.plugin.autotable.min.js", "jspdf-autotable", () => {
                jspdfLoaded = true;
                checkScripts();
            });
        });

        loadScript("https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js", "xlsx", () => {
            xlsxLoaded = true;
            checkScripts();
        });
    }, []);

    useEffect(() => {
        if (startDate && endDate) {
            const filtered = entries.filter(entry => {
                const entryDate = new Date(entry.date);
                const start = new Date(startDate);
                const end = new Date(endDate);
                start.setHours(0, 0, 0, 0);
                end.setHours(23, 59, 59, 999);
                return entryDate >= start && entryDate <= end;
            });
            setFilteredEntries(filtered);
        } else {
            setFilteredEntries(entries);
        }
    }, [entries, startDate, endDate]);

    const getSummaryStats = (data) => {
        const winningTrades = data.filter(t => Number(t.profitLoss) > 0);
        const losingTrades = data.filter(t => Number(t.profitLoss) <= 0);

        const totalProfit = winningTrades.reduce((sum, trade) => sum + Number(trade.profitLoss), 0).toFixed(2);
        const totalLoss = losingTrades.reduce((sum, trade) => sum + Number(trade.profitLoss), 0).toFixed(2);
        
        const winningTradesCount = winningTrades.length;
        const losingTradesCount = losingTrades.length;
        const totalTrades = data.length;
        const winningRate = totalTrades > 0 ? ((winningTradesCount / totalTrades) * 100).toFixed(0) : 0;
        
        return {
            totalTrades,
            winningRate,
            winningTradesCount,
            losingTradesCount,
            totalProfit,
            totalLoss
        };
    };

    const calculateDailyCumulativePnL = (data) => {
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

    const generatePdf = (data, isAllReports) => {
        if (!scriptsLoaded) {
            console.error("Libraries are not loaded yet.");
            return;
        }

        const stats = getSummaryStats(data);
        const doc = new window.jspdf.jsPDF();
        doc.setFontSize(18);
        doc.text("Trading Journal Report", 14, 20);

        doc.setFontSize(10);
        doc.text(`Total Trades: ${stats.totalTrades}`, 14, 28);
        doc.text(`Winning Rate: ${stats.winningRate}%`, 14, 34);
        doc.text(`Winning Trades: ${stats.winningTradesCount}`, 14, 40);
        doc.text(`Losing Trades: ${stats.losingTradesCount}`, 14, 46);
        doc.text(`Total Profit: $${stats.totalProfit}`, 14, 52);
        doc.text(`Total Loss: $${stats.totalLoss}`, 14, 58);
        if (startDate && endDate && !isAllReports) {
            doc.text(`Date Range: ${startDate} to ${endDate}`, 14, 64);
        }

        const tableColumn = [
            "Date", "Pair", "Lot Size", "Direction", "Entry",
            "Stop Loss", "Take Profit", "Close Reason", "P/L"
        ];
        const tableRows = data.map(entry => [
            entry.date,
            entry.pair,
            entry.lotSize,
            entry.direction,
            entry.entryPrice,
            entry.stopLoss,
            entry.takeProfit,
            entry.closeReason,
            entry.profitLoss,
        ]);

        doc.autoTable({
            startY: startDate && endDate && !isAllReports ? 70 : 64,
            head: [tableColumn],
            body: tableRows,
            theme: 'striped',
            styles: { fontSize: 8, font: 'helvetica' },
            headStyles: { fillColor: [52, 152, 219], textColor: [255, 255, 255], fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [240, 240, 240] },
            bodyStyles: { textColor: [0, 0, 0] },
        });

        doc.save("trading-journal-report.pdf");
    };

    const generateExcel = (data, isAllReports) => {
        if (!scriptsLoaded) {
            console.error("Libraries are not loaded yet.");
            return;
        }
        
        const stats = getSummaryStats(data);
        const reportData = data.map(entry => ({
        /* Form 1 */ 
            "Date": entry.date,
            "Entry Time": entry.entryTime,
            "Pair": entry.pair,
            "Session": entry.session,
            "Lot Size": entry.lotSize,
            "Direction": entry.direction,
            "Entry Price": entry.entryPrice,
            "Stop Loss": entry.stopLoss,
            "Take Profit": entry.takeProfit,
            "Pip Gain/Loss": entry.pipgainloss,

        /* Form 2 */
            "Risk Reward": entry.rr,
            "Win/Loss Result": entry.winLoss,
            "Cumulative Balance": entry.cumulativeBalance,

        /* Form 3 */
            "Setup Name": entry.setupName,
            "Enter Trigger": entry.entryTrigger,
            "Timeframe Used": entry.timeFrame,
            "Trade Management Note": entry.tradeManagemet,

        /* Form 4 */
            "Daily Bias": entry.dailyBias,
            "News Event": entry.newsEvent,
            "Volatility Conditions": entry.volatilityConditions,

        /* Form 5 */
            "Confidence Level": entry.confidence,
            "Emotional State": entry.emotionalState,
            "Rule Adherence": entry.ruleAdherence,
            "Mistakes Made": entry.mistakesMade,

        /* Form 6 */
            "Before Screenshot": entry.beforeLink,
            "After Screenshoot": entry.afterLink,
        }));
        
        // Prepare data for the Summary sheet
        const summaryData = [
            ["Report Summary"],
            ["Total Trades", stats.totalTrades],
            ["Winning Rate", `${stats.winningRate}%`],
            ["Winning Trades", stats.winningTradesCount],
            ["Losing Trades", stats.losingTradesCount],
            ["Total Profit", `$${stats.totalProfit}`],
            ["Total Loss", `$${stats.totalLoss}`]
        ];
        if (startDate && endDate && !isAllReports) {
            summaryData.push(["Date Range", `${startDate} to ${endDate}`]);
        }
        
        // Create the worksheets
        const ws_summary = window.XLSX.utils.aoa_to_sheet(summaryData);
        const ws_data = window.XLSX.utils.json_to_sheet(reportData);

        // Create a new workbook and append the worksheets
        const workbook = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(workbook, ws_summary, "Summary");
        window.XLSX.utils.book_append_sheet(workbook, ws_data, "Trading Journal");
        
        // Write the workbook to a file and trigger download
        window.XLSX.writeFile(workbook, "trading-journal-report.xlsx");
    };

    const handleGeneratePdf = () => generatePdf(filteredEntries, false);
    const handleGenerateExcel = () => generateExcel(filteredEntries, false);
    const generateAllReports = () => {
        generatePdf(entries, true);
        generateExcel(entries, true);
    };
    
    const cumulativeData = calculateDailyCumulativePnL(filteredEntries);
    const stats = getSummaryStats(filteredEntries);
    const pieData = [
        { name: "Winners", value: stats.winningTradesCount, color: "#22c55e" },
        { name: "Losers", value: stats.losingTradesCount, color: "#ef4444" },
    ];
    
    return (
        <div className="flex h-screen bg-gray-900 text-white font-sans">
            <Sidebar />

            <div className="flex-1 overflow-y-auto">
                <main className="p-8">
                    <h1 className="text-3xl font-bold mb-2 text-white">Report Dashboard</h1>
                    <p className="text-gray-400 mb-6">Generate and download a comprehensive report of your trading journal.</p>
                    
                    {error ? (
                        <div className="flex flex-col items-center justify-center p-8 bg-gray-800 rounded-lg shadow-lg">
                            <svg className="w-16 h-16 text-red-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span className="ml-4 text-red-500 font-bold">{error}</span>
                            <div className="mt-4 p-4 text-center text-sm font-semibold text-gray-400 bg-gray-800 rounded-lg">
                                Your User ID is: <span className="font-mono text-white break-all">{userId || 'N/A'}</span>. Please ensure this ID matches your database path and your security rules allow access.
                            </div>
                        </div>
                    ) : loading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
                            <span className="ml-4 text-gray-400">Loading data...</span>
                        </div>
                    ) : (
                        <>
                            {entries.length === 0 ? (
                                <div className="flex flex-col items-center justify-center text-center p-8 bg-gray-800 rounded-lg shadow-lg">
                                    <svg className="w-16 h-16 text-gray-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                                    </svg>
                                    <p className="text-xl font-semibold text-gray-300">No trading journal entries found.</p>
                                    <p className="mt-2 text-gray-500">Add some entries to see your report dashboard here.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                                    <div className="p-6 bg-gray-800 shadow rounded">
                                        <h2 className="text-xl font-semibold mb-2">Winning % By Trades</h2>
                                        <p className="text-4xl font-bold text-green-500 text-center">{stats.winningRate}%</p>
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
                                                <span>{stats.winningTradesCount} winners</span>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <div className="w-4 h-4 bg-red-500 rounded"></div>
                                                <span>{stats.losingTradesCount} losers</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="p-6 bg-gray-800 shadow rounded md:col-span-2">
                                        <h2 className="text-xl font-semibold mb-4">Daily Net Cumulative P&L</h2>
                                        <ResponsiveContainer width="100%" height={250}>
                                            {filteredEntries.length > 1 ? (
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
                            )}

                            {entries.length > 0 && (
                                <>
                                    <div className="flex flex-col md:flex-row items-center justify-center gap-6 mb-6 p-6 bg-gray-800 rounded-lg shadow-lg">
                                        <div className="flex items-center gap-4">
                                            <label className="text-gray-300">Start Date:</label>
                                            <input
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            className="p-2 rounded-lg bg-gray-700 border border-gray-600 text-white"
                                            />
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <label className="text-gray-300">End Date:</label>
                                            <input
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            className="p-2 rounded-lg bg-gray-700 border border-gray-600 text-white"
                                            />
                                        </div>
                                        <button onClick={generateAllReports} disabled={!scriptsLoaded} className={`bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg shadow-lg flex items-center justify-center gap-2 transition-transform transform hover:scale-105 w-full md:w-auto ${!scriptsLoaded && 'opacity-50 cursor-not-allowed'}`}>
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                            Generate All Reports
                                        </button>
                                    </div>
                                    
                                    <div className="flex justify-center space-x-4">
                                        <button onClick={handleGeneratePdf} disabled={!scriptsLoaded} className={`bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg shadow-lg flex items-center justify-center gap-2 transition-transform transform hover:scale-105 ${!scriptsLoaded && 'opacity-50 cursor-not-allowed'}`}>
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
                                            Download PDF
                                        </button>
                                        <button onClick={handleGenerateExcel} disabled={!scriptsLoaded} className={`bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg shadow-lg flex items-center justify-center gap-2 transition-transform transform hover:scale-105 ${!scriptsLoaded && 'opacity-50 cursor-not-allowed'}`}>
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
                                            Download Excel
                                        </button>
                                    </div>
                                </>
                            )}
                            
                            {scriptsLoaded && (
                                <div className="mt-4 p-4 text-center text-sm font-semibold text-green-500 bg-gray-800 rounded-lg">
                                    Libraries loaded successfully!
                                </div>
                            )}
                            
                            <div className="mt-6 text-center text-sm text-gray-500">
                                Your User ID: <span className="font-mono text-gray-300">{userId || 'Loading...'}</span>
                            </div>
                        </>
                    )}
                </main>
            </div>
        </div>
    );
}