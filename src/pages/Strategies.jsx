import React, { useState, useEffect } from 'react';
import { FaPlus, FaChevronDown, FaChevronUp, FaBookOpen, FaEdit, FaTrash, FaTimesCircle } from 'react-icons/fa';
import { getDatabase, ref, onValue, push, update, remove } from "firebase/database";
import { onAuthStateChanged } from 'firebase/auth';
import { signInAnonymously } from 'firebase/auth'; // Import signInAnonymously

// Import the original Sidebar component from your components directory
import Sidebar from '../components/Sidebar'; 

// Import the auth and db instances from your existing firebase.js file
import { auth, db } from '../firebase'; 

const App = () => {
    // State to manage the list of trading strategies
    const [strategies, setStrategies] = useState([]);
    
    // State for the new strategy form
    const [newStrategy, setNewStrategy] = useState({
        name: '',
        description: '',
        rules: '',
        pairs: '',
    });

    // State for Firebase and authentication
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [userId, setUserId] = useState(null); // New state to store the user ID
    
    // State for editing a strategy
    const [editingStrategyId, setEditingStrategyId] = useState(null);
    
    // State for delete confirmation modal
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [strategyToDelete, setStrategyToDelete] = useState(null);
    
    // State to track loading status
    const [loading, setLoading] = useState(true);

    // Set up auth listener to get the user ID
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserId(user.uid);
                setIsAuthReady(true);
            } else {
                try {
                    // Automatically sign in anonymously if no user is found
                    const anonymousUserCredential = await signInAnonymously(auth);
                    setUserId(anonymousUserCredential.user.uid);
                    setIsAuthReady(true);
                } catch (error) {
                    console.error("Anonymous sign-in failed:", error);
                    setIsAuthReady(true); // Still set to true to unblock the UI
                }
            }
        });
        return () => unsubscribe();
    }, []);

    // Set up real-time data listener for strategies
    useEffect(() => {
        // Only run if the db object is available and the user is authenticated
        if (!db || !userId) {
            setLoading(true);
            return;
        }

        const appId = '__app_id__'; // Use your actual app ID
        const strategiesRef = ref(db, `artifacts/${appId}/users/${userId}/tradingStrategies`);

        // The onValue listener subscribes to real-time updates
        const unsubscribe = onValue(strategiesRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const loadedStrategies = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key],
                    expanded: data[key].expanded || false,
                }));
                setStrategies(loadedStrategies);
            } else {
                setStrategies([]);
            }
            setLoading(false);
        }, (error) => {
            console.error("Error fetching strategies:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userId]); // Depend on userId to re-fetch when it becomes available

    // Handle form input changes
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewStrategy(prevState => ({
            ...prevState,
            [name]: value,
        }));
    };
    
    // Handle form submission (add or update)
    const handleAddOrUpdateStrategy = async (e) => {
        e.preventDefault();
        if (!userId) return; // Ensure user is authenticated
        const { name, description, rules, pairs } = newStrategy;
        if (!name || !description) return;
        
        const rulesArray = rules.split('\n').filter(rule => rule.trim() !== '');
        const pairsArray = pairs.split(',').map(pair => pair.trim()).filter(pair => pair !== '');
        
        try {
            const appId = '__app_id__';
            if (editingStrategyId) {
                // Update existing strategy
                const strategyRef = ref(db, `artifacts/${appId}/users/${userId}/tradingStrategies/${editingStrategyId}`);
                await update(strategyRef, {
                    name,
                    description,
                    rules: rulesArray,
                    pairs: pairsArray,
                });
                setEditingStrategyId(null);
            } else {
                // Add new strategy
                const strategiesRef = ref(db, `artifacts/${appId}/users/${userId}/tradingStrategies`);
                await push(strategiesRef, {
                    name,
                    description,
                    rules: rulesArray,
                    pairs: pairsArray,
                });
            }
            setNewStrategy({ name: '', description: '', rules: '', pairs: '' });
        } catch (e) {
            console.error("Error adding/updating document: ", e);
        }
    };
    
    // Handle editing a strategy
    const handleEditStrategy = (strategy) => {
        setEditingStrategyId(strategy.id);
        setNewStrategy({
            name: strategy.name,
            description: strategy.description,
            rules: (Array.isArray(strategy.rules) ? strategy.rules.join('\n') : strategy.rules),
            pairs: (Array.isArray(strategy.pairs) ? strategy.pairs.join(', ') : strategy.pairs),
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    
    // Handle deleting a strategy
    const handleDeleteStrategy = async () => {
        if (!strategyToDelete || !userId) return;
        try {
            const appId = '__app_id__';
            const strategyRef = ref(db, `artifacts/${appId}/users/${userId}/tradingStrategies/${strategyToDelete.id}`);
            await remove(strategyRef);
            setShowDeleteModal(false);
            setStrategyToDelete(null);
        } catch (e) {
            console.error("Error deleting document: ", e);
        }
    };

    // Open delete confirmation modal
    const openDeleteModal = (strategy) => {
        setStrategyToDelete(strategy);
        setShowDeleteModal(true);
    };

    // Close delete confirmation modal
    const closeDeleteModal = () => {
        setShowDeleteModal(false);
        setStrategyToDelete(null);
    };
    
    // Toggle the expanded state of a strategy card
    const toggleExpansion = (id) => {
        setStrategies(prevStrategies => 
            prevStrategies.map(strategy =>
                strategy.id === id ? { ...strategy, expanded: !strategy.expanded } : strategy
            )
        );
    };

    return (
        <div className="flex h-screen bg-gray-900 text-white font-sans">
            <div className="overflow-y-auto">
                <Sidebar />
            </div>
            <main className="flex-1 p-8 overflow-y-auto">
                <h1 className="text-4xl font-extrabold mb-4 text-white">Trading Strategies</h1>
                <p className="text-gray-400 mb-8">Document and manage your trading strategies here. A well-defined strategy is the foundation of disciplined trading.</p>

                {/* Form to add a new strategy */}
                <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8">
                    <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                        <FaPlus className="text-blue-500" /> {editingStrategyId ? "Edit Strategy" : "Add New Strategy"}
                    </h2>
                    <form onSubmit={handleAddOrUpdateStrategy} className="space-y-4">
                        <div className="flex flex-col">
                            <label htmlFor="name" className="text-sm font-semibold text-gray-300 mb-1">Strategy Name</label>
                            <input
                                type="text"
                                id="name"
                                name="name"
                                value={newStrategy.name}
                                onChange={handleInputChange}
                                className="p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="e.g., Simple Trend-Following"
                                required
                            />
                        </div>
                        <div className="flex flex-col">
                            <label htmlFor="description" className="text-sm font-semibold text-gray-300 mb-1">Description</label>
                            <textarea
                                id="description"
                                name="description"
                                value={newStrategy.description}
                                onChange={handleInputChange}
                                className="p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-24"
                                placeholder="Briefly describe the core concept of this strategy."
                                required
                            />
                        </div>
                        <div className="flex flex-col">
                            <label htmlFor="rules" className="text-sm font-semibold text-gray-300 mb-1">Key Rules (one per line)</label>
                            <textarea
                                id="rules"
                                name="rules"
                                value={newStrategy.rules}
                                onChange={handleInputChange}
                                className="p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-24"
                                placeholder="Enter each rule on a new line."
                            />
                        </div>
                        <div className="flex flex-col">
                            <label htmlFor="pairs" className="text-sm font-semibold text-gray-300 mb-1">Applicable Pairs (comma-separated)</label>
                            <input
                                type="text"
                                id="pairs"
                                name="pairs"
                                value={newStrategy.pairs}
                                onChange={handleInputChange}
                                className="p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="e.g., EUR/USD, GBP/JPY"
                            />
                        </div>
                        <div className="flex space-x-2">
                            <button
                                type="submit"
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200"
                            >
                                {editingStrategyId ? "Update Strategy" : "Add Strategy"}
                            </button>
                            {editingStrategyId && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditingStrategyId(null);
                                        setNewStrategy({ name: '', description: '', rules: '', pairs: '' });
                                    }}
                                    className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200"
                                >
                                    Cancel
                                </button>
                            )}
                        </div>
                    </form>
                </div>
                
                {/* List of existing strategies */}
                <h2 className="text-3xl font-bold mb-6 flex items-center gap-2">
                    <FaBookOpen className="text-yellow-500" /> My Strategies
                </h2>
                
                {loading ? (
                    <div className="flex items-center justify-center p-8 text-gray-400">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                        <span className="ml-4">Loading strategies...</span>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {strategies.length > 0 ? (
                            strategies.map(strategy => (
                                <div key={strategy.id} className="bg-gray-800 rounded-lg shadow-lg">
                                    <div className="p-6">
                                        <div className="flex justify-between items-center cursor-pointer" onClick={() => toggleExpansion(strategy.id)}>
                                            <h3 className="text-2xl font-bold text-blue-400">{strategy.name}</h3>
                                            <div className="flex items-center space-x-2">
                                                <button onClick={(e) => { e.stopPropagation(); handleEditStrategy(strategy); }} className="text-yellow-400 p-2 rounded-full hover:bg-gray-700 transition-colors">
                                                    <FaEdit />
                                                </button>
                                                <button onClick={(e) => { e.stopPropagation(); openDeleteModal(strategy); }} className="text-red-500 p-2 rounded-full hover:bg-gray-700 transition-colors">
                                                    <FaTrash />
                                                </button>
                                                <button className="text-white p-2 rounded-full hover:bg-gray-700 transition-colors">
                                                    {strategy.expanded ? <FaChevronUp /> : <FaChevronDown />}
                                                </button>
                                            </div>
                                        </div>
                                        <p className="mt-2 text-gray-400">{strategy.description}</p>
                                        <div className="mt-4 flex flex-wrap gap-2 text-sm text-gray-300">
                                            <strong>Pairs:</strong>
                                            {Array.isArray(strategy.pairs) && strategy.pairs.length > 0 ? (
                                                strategy.pairs.map((pair, index) => (
                                                    <span key={index} className="bg-gray-700 py-1 px-3 rounded-full">{pair}</span>
                                                ))
                                            ) : (
                                                <span className="italic text-gray-500">No pairs specified</span>
                                            )}
                                        </div>
                                    </div>
                                    {strategy.expanded && (
                                        <div className="border-t border-gray-700 p-6">
                                            <h4 className="text-lg font-bold mb-2">Rules & Checklist:</h4>
                                            <ul className="list-disc list-inside space-y-1 text-gray-300">
                                                {Array.isArray(strategy.rules) && strategy.rules.length > 0 ? (
                                                    strategy.rules.map((rule, index) => (
                                                        <li key={index}>{rule}</li>
                                                    ))
                                                ) : (
                                                    <p className="italic text-gray-500">No rules specified for this strategy.</p>
                                                )}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="text-center p-8 bg-gray-800 rounded-lg">
                                <p className="text-xl font-semibold text-gray-400">No strategies found. Add your first one above!</p>
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
                        <p className="text-gray-300 mb-6">Are you sure you want to delete the strategy "{strategyToDelete?.name}"? This action cannot be undone.</p>
                        <div className="flex justify-end space-x-4">
                            <button onClick={closeDeleteModal} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">
                                Cancel
                            </button>
                            <button onClick={handleDeleteStrategy} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg">
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;