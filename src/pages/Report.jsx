import React, { useState, useEffect } from "react";
import { getDatabase, ref, onValue } from "firebase/database";
import { FaFilePdf, FaFileExcel, FaDownload } from "react-icons/fa";
import Sidebar from "../components/Sidebar";
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend
} from "recharts";

// Helper function to load external scripts dynamically
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

const Report = () => {
    const [entries, setEntries] = useState([]);
    const [filteredEntries, setFilteredEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [scriptsLoaded, setScriptsLoaded] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    
    // Helper function to sort entries by date
    const sortByDate = (data) => {
        return data.sort((a, b) => new Date(a.date) - new Date(b.date));
    };

    // Function to calculate cumulative P&L for the line chart, grouped by date
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

    useEffect(() => {
        // Load jspdf and xlsx libraries and check when both are ready
        let jspdfLoaded = false;
        let xlsxLoaded = false;
        
        const checkScripts = () => {
          if (jspdfLoaded && xlsxLoaded) {
            setScriptsLoaded(true);
          }
        };

        // Load jspdf and its autotable plugin
        loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js", "jspdf", () => {
            loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.25/jspdf.plugin.autotable.min.js", "jspdf-autotable", () => {
                jspdfLoaded = true;
                checkScripts();
            });
        });

        // Load the xlsx library
        loadScript("https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js", "xlsx", () => {
            xlsxLoaded = true;
            checkScripts();
        });

        const tradesRef = ref(getDatabase(), "tradingJournal");
        onValue(tradesRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const loaded = Object.keys(data).map((id) => ({ id, ...data[id] }));
                setEntries(sortByDate(loaded));
            } else {
                setEntries([]);
            }
            setLoading(false);
        });
    }, []);

    useEffect(() => {
        // Filter entries based on the date range
        if (startDate && endDate) {
            const filtered = entries.filter(entry => {
                const entryDate = new Date(entry.date);
                return entryDate >= new Date(startDate) && entryDate <= new Date(endDate);
            });
            setFilteredEntries(filtered);
        } else {
            setFilteredEntries(entries);
        }
    }, [entries, startDate, endDate]);
    
    // Calculate summary statistics
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
            headStyles: { fillColor: [52, 152, 219], textColor: [255, 255, 255], fontStyle: 'bold' }, // A nice blue header
            alternateRowStyles: { fillColor: [240, 240, 240] }, // Light gray alternating rows
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
            "Date": entry.date,
            "Pair": entry.pair,
            "Lot Size": entry.lotSize,
            "Direction": entry.direction,
            "Entry Price": entry.entryPrice,
            "Stop Loss": entry.stopLoss,
            "Take Profit": entry.takeProfit,
            "Close Reason": entry.closeReason,
            "Profit/Loss": entry.profitLoss,
            "Emotion Note": entry.emotionNote,
        }));
        
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
        
        const ws_summary = window.XLSX.utils.aoa_to_sheet(summaryData);
        const ws_data = window.XLSX.utils.json_to_sheet(reportData);

        const workbook = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(workbook, ws_summary, "Summary");
        window.XLSX.utils.book_append_sheet(workbook, ws_data, "Trading Journal");
        
        window.XLSX.writeFile(workbook, "trading-journal-report.xlsx");
    };

    const handleGeneratePdf = () => generatePdf(filteredEntries, false);
    const handleGenerateExcel = () => generateExcel(filteredEntries, false);

    const generateAllReports = () => {
        generatePdf(entries, true);
        generateExcel(entries, true);
    };
    
    // Recharts data
    const cumulativeData = calculateDailyCumulativePnL(filteredEntries);
    const stats = getSummaryStats(filteredEntries);
    const pieData = [
        { name: "Winners", value: stats.winningTradesCount, color: "#22c55e" },
        { name: "Losers", value: stats.losingTradesCount, color: "#ef4444" },
    ];
    
    return (
        <div className="flex h-screen bg-gray-900 text-white font-sans">
            <div className="overflow-y-auto">
                <Sidebar />
            </div>
            <main className="flex-1 p-8 overflow-y-auto">
                <h1 className="text-3xl font-bold mb-2 text-white">Report Dashboard</h1>
                <p className="text-gray-400 mb-6">Generate and download a comprehensive report of your trading journal.</p>
                
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
                        <span className="ml-4 text-gray-400">Loading data...</span>
                    </div>
                ) : (
                    <>
                        {/* Charts */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                            {/* Pie Chart */}
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
                            
                            {/* Line Chart */}
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

                        {/* Date Range and Report Buttons */}
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
                                <FaDownload />
                                Generate All Reports
                            </button>
                        </div>
                        
                        <div className="flex justify-center space-x-4">
                            <button onClick={handleGeneratePdf} disabled={!scriptsLoaded} className={`bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg shadow-lg flex items-center justify-center gap-2 transition-transform transform hover:scale-105 ${!scriptsLoaded && 'opacity-50 cursor-not-allowed'}`}>
                                <FaFilePdf />
                                Download PDF (Filtered)
                            </button>
                            <button onClick={handleGenerateExcel} disabled={!scriptsLoaded} className={`bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg shadow-lg flex items-center justify-center gap-2 transition-transform transform hover:scale-105 ${!scriptsLoaded && 'opacity-50 cursor-not-allowed'}`}>
                                <FaFileExcel />
                                Download Excel (Filtered)
                            </button>
                        </div>
                        {loading && (
                            <div className="mt-4 p-4 text-center text-sm font-semibold text-yellow-500 bg-gray-800 rounded-lg">
                                Loading libraries... please wait.
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
};

export default Report;
