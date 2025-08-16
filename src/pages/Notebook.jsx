// backtest.jsx
import React, { useState, useEffect } from 'react';
import { FaPlus, FaBookOpen, FaEdit, FaTrash, FaTimesCircle, FaChevronDown, FaChevronUp, FaChartLine, FaClipboardList, FaFileInvoiceDollar, FaDollarSign, FaBolt, FaCamera, FaSitemap } from 'react-icons/fa';
import { ref, onValue, push, update, remove } from "firebase/database";
import { onAuthStateChanged } from 'firebase/auth';
import Sidebar from '../components/Sidebar';
import { auth, db } from '../firebase';

const Notebook = () => {
    // State to hold all the journal entries from Firebase
    const [entries, setEntries] = useState([]);
    
    // State for the form to add or edit an entry
    const [newEntry, setNewEntry] = useState({
        // Title 1: Basic Trade Information
        title: '',
        date: '',
        time: '', // New field
        session: '', // New field
        tradeInstrument: '', // New field
        marketCondition: '', // New field

        // Title 2: Entry Details
        entryPrice: '', // New field
        stopLoss: '', // New field
        takeProfit: '', // New field
        pipRisk: '', // New field

        // Title 3: Exit Details
        exitResult: '', // New field
        exitPrice: '', // New field
        pipGainLoss: '', // New field
        rrRatio: '', // New field, auto-calculated

        // Title 4: Strategy Context
        setupName: '', // New field
        entryTrigger: '', // New field
        bias: '', // New field
        htfStructure: '', // New field
        confluenceFactors: '', // New field

        // Title 5: Tracking Variables
        timeOfDay: '', // New field
        dayOfWeek: '', // New field
        newsFilter: '', // New field
        volatilityReading: '', // New field

        // Title 7: Screenshots
        beforeChart: '', // New field
        afterChart: '', // New field

        // Existing fields
        notes: '',
        pnl: '', // Kept for backward compatibility, but pipGainLoss is now the main metric
    });

    // State for the current authenticated user
    const [user, setUser] = useState(null);
    
    // State to track if an entry is being edited
    const [editingEntryId, setEditingEntryId] = useState(null);
    
    // State for the delete confirmation modal
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [entryToDelete, setEntryToDelete] = useState(null);
    
    // State to track loading status
    const [loading, setLoading] = useState(true);

    // Set up auth listener to get the current user
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Set up real-time data listener for journal entries based on user UID
    useEffect(() => {
        if (!user) {
            setEntries([]);
            setLoading(false);
            return;
        }

        const entriesRef = ref(db, `journalEntries/${user.uid}`);
        const unsubscribe = onValue(entriesRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const loadedEntries = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key],
                    expanded: data[key].expanded || false,
                }));
                setEntries(loadedEntries);
            } else {
                setEntries([]);
            }
            setLoading(false);
        }, (error) => {
            console.error("Error fetching journal entries:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, db]);

    // Handle form input changes
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewEntry(prevState => ({
            ...prevState,
            [name]: value,
        }));
    };
    
    // Auto-calculate RR Ratio and Pip Gain/Loss
    const calculateMetrics = (entry) => {
        const entryPrice = parseFloat(entry.entryPrice);
        const stopLoss = parseFloat(entry.stopLoss);
        const takeProfit = parseFloat(entry.takeProfit);
        const exitPrice = parseFloat(entry.exitPrice);

        let rrRatio = '';
        let pipGainLoss = '';
        let pnl = '';

        if (!isNaN(entryPrice) && !isNaN(stopLoss) && !isNaN(takeProfit)) {
            const riskPips = Math.abs(entryPrice - stopLoss);
            const rewardPips = Math.abs(takeProfit - entryPrice);
            if (riskPips > 0) {
                rrRatio = (rewardPips / riskPips).toFixed(2);
            }
        }
        
        if (!isNaN(entryPrice) && !isNaN(exitPrice)) {
            pipGainLoss = (exitPrice - entryPrice).toFixed(2);
            pnl = (parseFloat(entry.pnl) || 0).toFixed(2); // Keep old pnl field
        }

        return { rrRatio, pipGainLoss, pnl };
    };

    // Handle form submission (add or update)
    const handleAddOrUpdateEntry = async (e) => {
        e.preventDefault();
        if (!user) return;
        
        const { rrRatio, pipGainLoss } = calculateMetrics(newEntry);
        const entryData = { ...newEntry, rrRatio, pipGainLoss, pnl: parseFloat(newEntry.pnl) || 0 };

        try {
            if (editingEntryId) {
                const entryRef = ref(db, `journalEntries/${user.uid}/${editingEntryId}`);
                await update(entryRef, entryData);
                setEditingEntryId(null);
            } else {
                const userEntriesRef = ref(db, `journalEntries/${user.uid}`);
                await push(userEntriesRef, entryData);
            }
            // Clear the form
            setNewEntry({
                title: '', date: '', time: '', session: '', tradeInstrument: '', marketCondition: '',
                entryPrice: '', stopLoss: '', takeProfit: '', pipRisk: '',
                exitResult: '', exitPrice: '', pipGainLoss: '', rrRatio: '',
                setupName: '', entryTrigger: '', bias: '', htfStructure: '', confluenceFactors: '',
                timeOfDay: '', dayOfWeek: '', newsFilter: '', volatilityReading: '',
                beforeChart: '', afterChart: '', notes: '', pnl: '',
            });
        } catch (e) {
            console.error("Error adding/updating document: ", e);
        }
    };
    
    // Handle editing an entry
    const handleEditEntry = (entry) => {
        setEditingEntryId(entry.id);
        setNewEntry({
            ...entry,
            pnl: entry.pnl || '', // Ensure pnl is set for editing
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    
    // Handle deleting an entry
    const handleDeleteEntry = async () => {
        if (!entryToDelete || !user) return;
        try {
            const entryRef = ref(db, `journalEntries/${user.uid}/${entryToDelete.id}`);
            await remove(entryRef);
            setShowDeleteModal(false);
            setEntryToDelete(null);
        } catch (e) {
            console.error("Error deleting document: ", e);
        }
    };

    // Open delete confirmation modal
    const openDeleteModal = (entry) => {
        setEntryToDelete(entry);
        setShowDeleteModal(true);
    };

    // Close delete confirmation modal
    const closeDeleteModal = () => {
        setShowDeleteModal(false);
        setEntryToDelete(null);
    };

    // Toggle the expanded state of an entry card
    const toggleExpansion = (id) => {
        setEntries(prevEntries => 
            prevEntries.map(entry =>
                entry.id === id ? { ...entry, expanded: !entry.expanded } : entry
            )
        );
    };

    // Performance Metrics (Title 6 & 8)
    const totalTrades = entries.length;
    const wins = entries.filter(e => e.pipGainLoss > 0).length;
    const losses = entries.filter(e => e.pipGainLoss < 0).length;
    const breakEvens = entries.filter(e => e.pipGainLoss === '0.00').length;
    const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(2) : 0;
    const netPips = entries.reduce((sum, e) => sum + parseFloat(e.pipGainLoss || 0), 0).toFixed(2);
    
    const calculateExpectancy = () => {
        if (totalTrades === 0) return 0;
        const avgWin = entries.filter(e => e.pipGainLoss > 0).reduce((sum, e) => sum + parseFloat(e.pipGainLoss), 0) / wins || 0;
        const avgLoss = entries.filter(e => e.pipGainLoss < 0).reduce((sum, e) => sum + parseFloat(e.pipGainLoss), 0) / losses || 0;
        return ((winRate / 100) * avgWin - ((100 - winRate) / 100) * Math.abs(avgLoss)).toFixed(2);
    };

    const mostProfitableSession = () => {
        const sessionProfits = entries.reduce((acc, e) => {
            acc[e.session] = (acc[e.session] || 0) + parseFloat(e.pipGainLoss || 0);
            return acc;
        }, {});
        const sessions = Object.keys(sessionProfits);
        if (sessions.length === 0) return 'N/A';
        return sessions.reduce((a, b) => sessionProfits[a] > sessionProfits[b] ? a : b);
    };

    const mostProfitableDay = () => {
        const dayProfits = entries.reduce((acc, e) => {
            acc[e.dayOfWeek] = (acc[e.dayOfWeek] || 0) + parseFloat(e.pipGainLoss || 0);
            return acc;
        }, {});
        const days = Object.keys(dayProfits);
        if (days.length === 0) return 'N/A';
        return days.reduce((a, b) => dayProfits[a] > dayProfits[b] ? a : b);
    };

    return (
        <div className="flex h-screen bg-gray-900 text-white font-sans">
            <Sidebar />
            <main className='flex-1 p-8 overflow-y-auto'>
                <h1 className="text-4xl font-extrabold mb-4 text-white">Backtest Journal</h1>
                <p className="text-gray-400 mb-8">Log and review your trades to analyze your performance and identify patterns.</p>
                
                {/* Form to add a new journal entry */}
                <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8">
                    <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                        <FaPlus className="text-green-500" /> {editingEntryId ? "Edit Journal Entry" : "Add New Journal Entry"}
                    </h2>
                    <form onSubmit={handleAddOrUpdateEntry} className="space-y-6">
                        {/* Title 1: Basic Trade Information */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <h3 className="text-lg font-bold col-span-full text-blue-400 border-b border-gray-700 pb-2 flex items-center gap-2"><FaClipboardList />Basic Trade Info</h3>
                            <div className="flex flex-col">
                                <label htmlFor="title" className="text-sm font-semibold text-gray-300 mb-1">Entry Title</label>
                                <input type="text" id="title" name="title" value={newEntry.title} onChange={handleInputChange} className="p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="e.g., Shorting USD/CAD" required />
                            </div>
                            <div className="flex flex-col">
                                <label htmlFor="date" className="text-sm font-semibold text-gray-300 mb-1">Date</label>
                                <input type="date" id="date" name="date" value={newEntry.date} onChange={handleInputChange} className="p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" required />
                            </div>
                            <div className="flex flex-col">
                                <label htmlFor="time" className="text-sm font-semibold text-gray-300 mb-1">Time</label>
                                <input type="time" id="time" name="time" value={newEntry.time} onChange={handleInputChange} className="p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                            </div>
                            <div className="flex flex-col">
                                <label htmlFor="session" className="text-sm font-semibold text-gray-300 mb-1">Session</label>
                                <select id="session" name="session" value={newEntry.session} onChange={handleInputChange} className="p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
                                    <option value="">Select Session</option>
                                    <option value="Asian">Asian</option>
                                    <option value="London">London</option>
                                    <option value="New York">New York</option>
                                </select>
                            </div>
                            <div className="flex flex-col">
                                <label htmlFor="tradeInstrument" className="text-sm font-semibold text-gray-300 mb-1">Trade Instrument</label>
                                <input type="text" id="tradeInstrument" name="tradeInstrument" value={newEntry.tradeInstrument} onChange={handleInputChange} className="p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="e.g., EUR/USD" required />
                            </div>
                            <div className="flex flex-col">
                                <label htmlFor="marketCondition" className="text-sm font-semibold text-gray-300 mb-1">Market Condition</label>
                                <select id="marketCondition" name="marketCondition" value={newEntry.marketCondition} onChange={handleInputChange} className="p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
                                    <option value="">Select Condition</option>
                                    <option value="Bearish">Bearish</option>
                                    <option value="Bullish">Bullish</option>
                                    <option value="Consolidating">Consolidating</option>
                                </select>
                            </div>
                        </div>

                        {/* Title 2: Entry Details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <h3 className="text-lg font-bold col-span-full text-blue-400 border-b border-gray-700 pb-2 flex items-center gap-2"><FaDollarSign />Entry Details</h3>
                            <div className="flex flex-col">
                                <label htmlFor="entryPrice" className="text-sm font-semibold text-gray-300 mb-1">Entry Price</label>
                                <input type="number" step="0.0001" id="entryPrice" name="entryPrice" value={newEntry.entryPrice} onChange={handleInputChange} className="p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="e.g., 1.0920" />
                            </div>
                            <div className="flex flex-col">
                                <label htmlFor="stopLoss" className="text-sm font-semibold text-gray-300 mb-1">Stop Loss</label>
                                <input type="number" step="0.0001" id="stopLoss" name="stopLoss" value={newEntry.stopLoss} onChange={handleInputChange} className="p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="e.g., 1.0900" />
                            </div>
                            <div className="flex flex-col">
                                <label htmlFor="takeProfit" className="text-sm font-semibold text-gray-300 mb-1">Take Profit</label>
                                <input type="number" step="0.0001" id="takeProfit" name="takeProfit" value={newEntry.takeProfit} onChange={handleInputChange} className="p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="e.g., 1.1000" />
                            </div>
                            <div className="flex flex-col">
                                <label htmlFor="pipRisk" className="text-sm font-semibold text-gray-300 mb-1">Pip Risk</label>
                                <input type="number" step="0.01" id="pipRisk" name="pipRisk" value={newEntry.pipRisk} onChange={handleInputChange} className="p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="e.g., 20" />
                            </div>
                        </div>

                        {/* Title 3: Exit Details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <h3 className="text-lg font-bold col-span-full text-blue-400 border-b border-gray-700 pb-2 flex items-center gap-2"><FaChartLine />Exit Details</h3>
                            <div className="flex flex-col">
                                <label htmlFor="exitResult" className="text-sm font-semibold text-gray-300 mb-1">Result</label>
                                <select id="exitResult" name="exitResult" value={newEntry.exitResult} onChange={handleInputChange} className="p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
                                    <option value="">Select Result</option>
                                    <option value="TP Hit">TP Hit</option>
                                    <option value="SL Hit">SL Hit</option>
                                    <option value="BE Hit">BE Hit</option>
                                </select>
                            </div>
                            <div className="flex flex-col">
                                <label htmlFor="exitPrice" className="text-sm font-semibold text-gray-300 mb-1">Exit Price</label>
                                <input type="number" step="0.0001" id="exitPrice" name="exitPrice" value={newEntry.exitPrice} onChange={handleInputChange} className="p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="e.g., 1.0950" />
                            </div>
                            {/* RR Ratio will be auto-calculated */}
                            <div className="flex flex-col">
                                <label htmlFor="pipGainLoss" className="text-sm font-semibold text-gray-300 mb-1">Pip Gain/Loss (Auto-calculated)</label>
                                <input type="text" id="pipGainLoss" name="pipGainLoss" value={calculateMetrics(newEntry).pipGainLoss} readOnly className="p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none" />
                            </div>
                            <div className="flex flex-col">
                                <label htmlFor="rrRatio" className="text-sm font-semibold text-gray-300 mb-1">R:R Ratio (Auto-calculated)</label>
                                <input type="text" id="rrRatio" name="rrRatio" value={calculateMetrics(newEntry).rrRatio} readOnly className="p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none" />
                            </div>
                        </div>

                        {/* Title 4: Strategy Context */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <h3 className="text-lg font-bold col-span-full text-blue-400 border-b border-gray-700 pb-2 flex items-center gap-2"><FaSitemap />Strategy Context</h3>
                            <div className="flex flex-col">
                                <label htmlFor="setupName" className="text-sm font-semibold text-gray-300 mb-1">Setup Name</label>
                                <input type="text" id="setupName" name="setupName" value={newEntry.setupName} onChange={handleInputChange} className="p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="e.g., ICT Setup" />
                            </div>
                            <div className="flex flex-col">
                                <label htmlFor="entryTrigger" className="text-sm font-semibold text-gray-300 mb-1">Entry Trigger</label>
                                <select id="entryTrigger" name="entryTrigger" value={newEntry.entryTrigger} onChange={handleInputChange} className="p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
                                    <option value="">Select Trigger</option>
                                    <option value="FVG">FVG</option>
                                    <option value="OB">OB</option>
                                    <option value="Liquidity Sweep">Liquidity Sweep</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div className="flex flex-col">
                                <label htmlFor="bias" className="text-sm font-semibold text-gray-300 mb-1">Bias</label>
                                <select id="bias" name="bias" value={newEntry.bias} onChange={handleInputChange} className="p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
                                    <option value="">Select Bias</option>
                                    <option value="Bullish">Bullish</option>
                                    <option value="Bearish">Bearish</option>
                                </select>
                            </div>
                            <div className="flex flex-col">
                                <label htmlFor="htfStructure" className="text-sm font-semibold text-gray-300 mb-1">HTF Structure</label>
                                <input type="text" id="htfStructure" name="htfStructure" value={newEntry.htfStructure} onChange={handleInputChange} className="p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="e.g., Upward Trend" />
                            </div>
                            <div className="flex flex-col col-span-full">
                                <label htmlFor="confluenceFactors" className="text-sm font-semibold text-gray-300 mb-1">Confluence Factors</label>
                                <textarea id="confluenceFactors" name="confluenceFactors" value={newEntry.confluenceFactors} onChange={handleInputChange} className="p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 h-24" placeholder="e.g., Session time, liquidity sweep, divergence" />
                            </div>
                        </div>

                        {/* Title 5: Tracking Variables */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <h3 className="text-lg font-bold col-span-full text-blue-400 border-b border-gray-700 pb-2 flex items-center gap-2"><FaBolt />Tracking Variables</h3>
                            <div className="flex flex-col">
                                <label htmlFor="timeOfDay" className="text-sm font-semibold text-gray-300 mb-1">Time of Day</label>
                                <input type="time" id="timeOfDay" name="timeOfDay" value={newEntry.timeOfDay} onChange={handleInputChange} className="p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                            </div>
                            <div className="flex flex-col">
                                <label htmlFor="dayOfWeek" className="text-sm font-semibold text-gray-300 mb-1">Day of Week</label>
                                <select id="dayOfWeek" name="dayOfWeek" value={newEntry.dayOfWeek} onChange={handleInputChange} className="p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
                                    <option value="">Select Day</option>
                                    <option value="Monday">Monday</option>
                                    <option value="Tuesday">Tuesday</option>
                                    <option value="Wednesday">Wednesday</option>
                                    <option value="Thursday">Thursday</option>
                                    <option value="Friday">Friday</option>
                                </select>
                            </div>
                            <div className="flex flex-col">
                                <label htmlFor="newsFilter" className="text-sm font-semibold text-gray-300 mb-1">News Filter</label>
                                <select id="newsFilter" name="newsFilter" value={newEntry.newsFilter} onChange={handleInputChange} className="p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
                                    <option value="">Select Option</option>
                                    <option value="Yes">Yes</option>
                                    <option value="No">No</option>
                                </select>
                            </div>
                            <div className="flex flex-col">
                                <label htmlFor="volatilityReading" className="text-sm font-semibold text-gray-300 mb-1">Volatility</label>
                                <select id="volatilityReading" name="volatilityReading" value={newEntry.volatilityReading} onChange={handleInputChange} className="p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
                                    <option value="">Select Volatility</option>
                                    <option value="High">High</option>
                                    <option value="Normal">Normal</option>
                                    <option value="Low">Low</option>
                                </select>
                            </div>
                        </div>

                        {/* Title 7: Screenshot Proof */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <h3 className="text-lg font-bold col-span-full text-blue-400 border-b border-gray-700 pb-2 flex items-center gap-2"><FaCamera />Screenshot Proof</h3>
                            <div className="flex flex-col">
                                <label htmlFor="beforeChart" className="text-sm font-semibold text-gray-300 mb-1">Before Chart (URL)</label>
                                <input type="text" id="beforeChart" name="beforeChart" value={newEntry.beforeChart} onChange={handleInputChange} className="p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Paste image URL here" />
                            </div>
                            <div className="flex flex-col">
                                <label htmlFor="afterChart" className="text-sm font-semibold text-gray-300 mb-1">After Chart (URL)</label>
                                <input type="text" id="afterChart" name="afterChart" value={newEntry.afterChart} onChange={handleInputChange} className="p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Paste image URL here" />
                            </div>
                        </div>
                        
                        <div className="flex flex-col">
                            <label htmlFor="notes" className="text-sm font-semibold text-gray-300 mb-1">Notes & Analysis</label>
                            <textarea id="notes" name="notes" value={newEntry.notes} onChange={handleInputChange} className="p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 h-24" placeholder="Write down your thoughts, why you entered the trade, and the outcome." />
                        </div>
                        <div className="flex space-x-2">
                            <button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200">
                                {editingEntryId ? "Update Entry" : "Add Entry"}
                            </button>
                            {editingEntryId && (
                                <button type="button" onClick={() => { setEditingEntryId(null); setNewEntry({ title: '', date: '', pair: '', notes: '', pnl: '' }); }} className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200">
                                    Cancel
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                {/* Performance Metrics Section (Title 6 & 8) */}
                <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8">
                    <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-purple-400"><FaFileInvoiceDollar />Performance Metrics</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-center">
                        <div className="bg-gray-700 p-4 rounded-lg">
                            <p className="text-lg font-semibold">Total Trades</p>
                            <p className="text-3xl font-bold text-green-400">{totalTrades}</p>
                        </div>
                        <div className="bg-gray-700 p-4 rounded-lg">
                            <p className="text-lg font-semibold">Win Rate</p>
                            <p className="text-3xl font-bold text-green-400">{winRate}%</p>
                        </div>
                        <div className="bg-gray-700 p-4 rounded-lg">
                            <p className="text-lg font-semibold">Net Pips</p>
                            <p className={`text-3xl font-bold ${netPips >= 0 ? 'text-green-400' : 'text-red-400'}`}>{netPips}</p>
                        </div>
                        <div className="bg-gray-700 p-4 rounded-lg">
                            <p className="text-lg font-semibold">Expectancy</p>
                            <p className={`text-3xl font-bold ${calculateExpectancy() >= 0 ? 'text-green-400' : 'text-red-400'}`}>{calculateExpectancy()}</p>
                        </div>
                    </div>
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="bg-gray-700 p-4 rounded-lg">
                            <p className="text-sm text-gray-400">Total Wins / Losses / BE</p>
                            <p className="font-bold text-lg">{wins} / {losses} / {breakEvens}</p>
                        </div>
                        <div className="bg-gray-700 p-4 rounded-lg">
                            <p className="text-sm text-gray-400">Most Profitable Session</p>
                            <p className="font-bold text-lg">{mostProfitableSession()}</p>
                        </div>
                        <div className="bg-gray-700 p-4 rounded-lg">
                            <p className="text-sm text-gray-400">Most Profitable Day</p>
                            <p className="font-bold text-lg">{mostProfitableDay()}</p>
                        </div>
                    </div>
                </div>

                {/* List of existing journal entries */}
                <h2 className="text-3xl font-bold mb-6 flex items-center gap-2">
                    <FaBookOpen className="text-blue-500" /> My Journal Entries
                </h2>
                
                {loading ? (
                    <div className="flex items-center justify-center p-8 text-gray-400">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                        <span className="ml-4">Loading entries...</span>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {entries.length > 0 ? (
                            entries.map(entry => (
                                <div key={entry.id} className="bg-gray-800 rounded-lg shadow-lg">
                                    <div className="p-6">
                                        <div className="flex justify-between items-center cursor-pointer" onClick={() => toggleExpansion(entry.id)}>
                                            <div className="flex flex-col">
                                                <h3 className="text-2xl font-bold text-green-400">{entry.title}</h3>
                                                <p className="mt-1 text-gray-400 text-sm">{entry.date} - {entry.tradeInstrument}</p>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <span className={`text-lg font-bold px-3 py-1 rounded-full ${parseFloat(entry.pipGainLoss || 0) >= 0 ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                                                    {entry.pipGainLoss >= 0 ? `+${entry.pipGainLoss} pips` : `${entry.pipGainLoss} pips`}
                                                </span>
                                                <button onClick={(e) => { e.stopPropagation(); handleEditEntry(entry); }} className="text-yellow-400 p-2 rounded-full hover:bg-gray-700 transition-colors">
                                                    <FaEdit />
                                                </button>
                                                <button onClick={(e) => { e.stopPropagation(); openDeleteModal(entry); }} className="text-red-500 p-2 rounded-full hover:bg-gray-700 transition-colors">
                                                    <FaTrash />
                                                </button>
                                                <button className="text-white p-2 rounded-full hover:bg-gray-700 transition-colors">
                                                    {entry.expanded ? <FaChevronUp /> : <FaChevronDown />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    {entry.expanded && (
                                        <div className="border-t border-gray-700 p-6 text-gray-300 space-y-4">
                                            <div>
                                                <h4 className="text-lg font-bold mb-2">Detailed Entry Information:</h4>
                                                <ul className="list-disc list-inside space-y-1">
                                                    <li><strong>Date/Time:</strong> {entry.date} at {entry.time}</li>
                                                    <li><strong>Session:</strong> {entry.session}</li>
                                                    <li><strong>Market Condition:</strong> {entry.marketCondition}</li>
                                                    <li><strong>Entry Price:</strong> {entry.entryPrice}</li>
                                                    <li><strong>Stop Loss:</strong> {entry.stopLoss}</li>
                                                    <li><strong>Take Profit:</strong> {entry.takeProfit}</li>
                                                </ul>
                                            </div>
                                            <div>
                                                <h4 className="text-lg font-bold mb-2">Trade Outcome:</h4>
                                                <ul className="list-disc list-inside space-y-1">
                                                    <li><strong>Result:</strong> {entry.exitResult}</li>
                                                    <li><strong>Exit Price:</strong> {entry.exitPrice}</li>
                                                    <li><strong>P&L ($):</strong> ${entry.pnl}</li>
                                                    <li><strong>R:R Ratio:</strong> {entry.rrRatio}</li>
                                                </ul>
                                            </div>
                                            <div>
                                                <h4 className="text-lg font-bold mb-2">Strategy & Context:</h4>
                                                <ul className="list-disc list-inside space-y-1">
                                                    <li><strong>Setup Name:</strong> {entry.setupName}</li>
                                                    <li><strong>Entry Trigger:</strong> {entry.entryTrigger}</li>
                                                    <li><strong>Bias:</strong> {entry.bias}</li>
                                                    <li><strong>HTF Structure:</strong> {entry.htfStructure}</li>
                                                    <li><strong>Confluence Factors:</strong> {entry.confluenceFactors}</li>
                                                </ul>
                                            </div>
                                            {entry.notes && (
                                                <div>
                                                    <h4 className="text-lg font-bold mb-2">Notes & Analysis:</h4>
                                                    <p className="whitespace-pre-wrap">{entry.notes}</p>
                                                </div>
                                            )}
                                            {(entry.beforeChart || entry.afterChart) && (
                                                <div>
                                                    <h4 className="text-lg font-bold mb-2">Chart Analysis:</h4>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                                        {entry.beforeChart && (
                                                            <div className="flex flex-col items-center">
                                                                <p className="text-sm mb-2">Before Chart:</p>
                                                                <img src={entry.beforeChart} alt="Before Trade Chart" className="rounded-lg max-w-full h-auto" />
                                                            </div>
                                                        )}
                                                        {entry.afterChart && (
                                                            <div className="flex flex-col items-center">
                                                                <p className="text-sm mb-2">After Chart:</p>
                                                                <img src={entry.afterChart} alt="After Trade Chart" className="rounded-lg max-w-full h-auto" />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="text-center p-8 bg-gray-800 rounded-lg">
                                <p className="text-xl font-semibold text-gray-400">No journal entries found. Add your first one above!</p>
                            </div>
                        )}
                    </div>
                )}
            </main>
            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-gray-800 p-8 rounded-lg shadow-2xl w-full max-w-md border border-gray-700">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-2xl font-bold text-white">Confirm Deletion</h3>
                            <button onClick={closeDeleteModal} className="text-gray-400 hover:text-white">
                                <FaTimesCircle size={24} />
                            </button>
                        </div>
                        <p className="text-gray-300 mb-6">Are you sure you want to delete the entry "{entryToDelete?.title}"? This action cannot be undone.</p>
                        <div className="flex justify-end space-x-4">
                            <button onClick={closeDeleteModal} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">
                                Cancel
                            </button>
                            <button onClick={handleDeleteEntry} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg">
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Notebook;