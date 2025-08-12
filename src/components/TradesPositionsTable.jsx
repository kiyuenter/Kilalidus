import React from 'react';

const TradesPositionsTable = ({ entries }) => {
    return (
        <div className="p-6 bg-gray-800 shadow rounded h-full">
            <h2 className="text-xl font-semibold mb-4">Trades & Positions</h2>
            <div className="overflow-x-auto">
                <table className="min-w-full">
                    <thead>
                        <tr className="bg-gray-700">
                            <th className="p-2 text-left text-sm">Pair</th>
                            <th className="p-2 text-left text-sm">Direction</th>
                            <th className="p-2 text-left text-sm">Entry</th>
                            <th className="p-2 text-left text-sm">P/L</th>
                        </tr>
                    </thead>
                    <tbody>
                        {entries.length > 0 ? (
                            entries.slice(0, 10).map((t) => ( // Displaying the 10 most recent entries
                                <tr key={t.id} className="text-left border-t border-gray-700">
                                    <td className="p-2 text-sm">{t.pair}</td>
                                    <td className="p-2 text-sm">{t.direction}</td>
                                    <td className="p-2 text-sm">{t.entryPrice}</td>
                                    <td className={`p-2 text-sm ${parseFloat(t.profitLoss) >= 0 ? "text-green-500" : "text-red-500"}`}>
                                        {t.profitLoss}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="4" className="p-4 text-center text-gray-500">No trades to display.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default TradesPositionsTable;
