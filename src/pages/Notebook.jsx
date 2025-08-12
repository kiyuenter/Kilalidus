import React, { useState, useEffect } from 'react';
import { FaPlus, FaBookOpen, FaEdit, FaTrash, FaTimesCircle, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { getDatabase, ref, onValue, push, update, remove } from "firebase/database";
import { onAuthStateChanged } from 'firebase/auth';
import Sidebar from '../components/Sidebar';
import { auth, db } from '../firebase';

const Notebook = () => {
    // State to hold all the journal entries from Firebase
    const [entries, setEntries] = useState([]);
    
    // State for the form to add or edit an entry
    const [newEntry, setNewEntry] = useState({
        title: '',
        date: '',
        pair: '',
        notes: '',
        pnl: '',
    });

    // State for Firebase and authentication
    const [isAuthReady, setIsAuthReady] = useState(false);
    
    // State to track if an entry is being edited
    const [editingEntryId, setEditingEntryId] = useState(null);
    
    // State for the delete confirmation modal
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [entryToDelete, setEntryToDelete] = useState(null);
    
    // State to track loading status
    const [loading, setLoading] = useState(true);

    // Set up auth listener
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setIsAuthReady(true);
            } else {
                setIsAuthReady(true);
            }
        });
        return () => unsubscribe();
    }, []);

    // Set up real-time data listener for journal entries
    useEffect(() => {
        // Only run if the db object is available and the user is authenticated
        if (!db || !isAuthReady) {
            setLoading(true);
            return;
        }

        // Reference to the 'journalEntries' collection in the database
        const entriesRef = ref(db, "journalEntries");

        // The onValue listener subscribes to real-time updates
        const unsubscribe = onValue(entriesRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                // Map the Firebase object to an array with IDs and expand state
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
    }, [isAuthReady]);

    // Handle form input changes
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewEntry(prevState => ({
            ...prevState,
            [name]: value,
        }));
    };
    
    // Handle form submission (add or update)
    const handleAddOrUpdateEntry = async (e) => {
        e.preventDefault();
        const { title, date, pair, notes, pnl } = newEntry;
        if (!title || !date || !pair) return;
        
        try {
            const entriesRef = ref(db, "journalEntries");

            if (editingEntryId) {
                // Update existing entry
                const entryRef = ref(db, `journalEntries/${editingEntryId}`);
                await update(entryRef, {
                    title,
                    date,
                    pair,
                    notes,
                    pnl: parseFloat(pnl) || 0,
                });
                setEditingEntryId(null);
            } else {
                // Add new entry
                await push(entriesRef, {
                    title,
                    date,
                    pair,
                    notes,
                    pnl: parseFloat(pnl) || 0,
                });
            }
            // Clear the form
            setNewEntry({ title: '', date: '', pair: '', notes: '', pnl: '' });
        } catch (e) {
            console.error("Error adding/updating document: ", e);
        }
    };
    
    // Handle editing an entry
    const handleEditEntry = (entry) => {
        setEditingEntryId(entry.id);
        setNewEntry({
            title: entry.title,
            date: entry.date,
            pair: entry.pair,
            notes: entry.notes,
            pnl: entry.pnl,
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    
    // Handle deleting an entry
    const handleDeleteEntry = async () => {
        if (!entryToDelete) return;
        try {
            const entryRef = ref(db, `journalEntries/${entryToDelete.id}`);
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

    return (
        <div className="flex h-screen bg-gray-900 text-white font-sans">
            <Sidebar />
            <main className='flex-1 p-8 overflow-y-auto'>
                <h1 className="text-4xl font-extrabold mb-4 text-white">Trading Journal</h1>
                <p className="text-gray-400 mb-8">Log and review your trades to analyze your performance and identify patterns.</p>

                {/* Form to add a new journal entry */}
                <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8">
                    <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                        <FaPlus className="text-green-500" /> {editingEntryId ? "Edit Journal Entry" : "Add New Journal Entry"}
                    </h2>
                    <form onSubmit={handleAddOrUpdateEntry} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col">
                                <label htmlFor="title" className="text-sm font-semibold text-gray-300 mb-1">Entry Title</label>
                                <input
                                    type="text"
                                    id="title"
                                    name="title"
                                    value={newEntry.title}
                                    onChange={handleInputChange}
                                    className="p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                    placeholder="e.g., Shorting USD/CAD"
                                    required
                                />
                            </div>
                            <div className="flex flex-col">
                                <label htmlFor="date" className="text-sm font-semibold text-gray-300 mb-1">Date</label>
                                <input
                                    type="date"
                                    id="date"
                                    name="date"
                                    value={newEntry.date}
                                    onChange={handleInputChange}
                                    className="p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                    required
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col">
                                <label htmlFor="pair" className="text-sm font-semibold text-gray-300 mb-1">Trading Pair</label>
                                <input
                                    type="text"
                                    id="pair"
                                    name="pair"
                                    value={newEntry.pair}
                                    onChange={handleInputChange}
                                    className="p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                    placeholder="e.g., EUR/USD"
                                    required
                                />
                            </div>
                            <div className="flex flex-col">
                                <label htmlFor="pnl" className="text-sm font-semibold text-gray-300 mb-1">P&L ($)</label>
                                <input
                                    type="number"
                                    id="pnl"
                                    name="pnl"
                                    value={newEntry.pnl}
                                    onChange={handleInputChange}
                                    className="p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                    placeholder="e.g., 50.25"
                                />
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <label htmlFor="notes" className="text-sm font-semibold text-gray-300 mb-1">Notes & Analysis</label>
                            <textarea
                                id="notes"
                                name="notes"
                                value={newEntry.notes}
                                onChange={handleInputChange}
                                className="p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 h-24"
                                placeholder="Write down your thoughts, why you entered the trade, and the outcome."
                            />
                        </div>
                        <div className="flex space-x-2">
                            <button
                                type="submit"
                                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200"
                            >
                                {editingEntryId ? "Update Entry" : "Add Entry"}
                            </button>
                            {editingEntryId && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditingEntryId(null);
                                        setNewEntry({ title: '', date: '', pair: '', notes: '', pnl: '' });
                                    }}
                                    className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200"
                                >
                                    Cancel
                                </button>
                            )}
                        </div>
                    </form>
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
                                                <p className="mt-1 text-gray-400 text-sm">{entry.date} - {entry.pair}</p>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <span className={`text-lg font-bold px-3 py-1 rounded-full ${entry.pnl >= 0 ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                                                    {entry.pnl >= 0 ? `+$${entry.pnl}` : `-$${Math.abs(entry.pnl)}`}
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
                                        <div className="border-t border-gray-700 p-6 text-gray-300">
                                            <h4 className="text-lg font-bold mb-2">Notes & Analysis:</h4>
                                            <p className="whitespace-pre-wrap">{entry.notes || "No notes for this entry."}</p>
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
