import React, { useState } from 'react';

// A helper function to get the number of days in a month.
const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
};

// A helper function to get the day of the week for the first day of the month (0 = Sunday, 6 = Saturday)
const getFirstDayOfMonth = (year, month) => {
    return new Date(year, month, 1).getDay();
};

const getHeatmapColor = (count) => {
    if (count === 0) return 'bg-gray-700';
    if (count === 1) return 'bg-green-600';
    if (count <= 3) return 'bg-green-500';
    if (count <= 5) return 'bg-green-400';
    return 'bg-green-300';
};

const CalendarHeatmap = ({ entries }) => {
    // State to manage the currently viewed month
    const [currentDate, setCurrentDate] = useState(new Date());

    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    // Generate dates for the current month
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDayOfMonth = getFirstDayOfMonth(currentYear, currentMonth);

    // Create an array of days for the grid, including blank placeholders for the start of the month
    const monthDays = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
        monthDays.push(null); // Placeholder for empty cells
    }
    for (let i = 1; i <= daysInMonth; i++) {
        monthDays.push(new Date(currentYear, currentMonth, i));
    }

    // Count trades per day using a consistent YYYY-MM-DD format for keys
    const tradeCounts = entries.reduce((acc, entry) => {
        const date = new Date(entry.date).toISOString().slice(0, 10);
        acc[date] = (acc[date] || 0) + 1;
        return acc;
    }, {});

    const handlePrevMonth = () => {
        setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
    };

    const monthName = currentDate.toLocaleString('default', { month: 'long' });
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
        <div className="bg-gray-800 p-6 rounded shadow h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <button onClick={handlePrevMonth} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-semibold">
                    &lt; Prev
                </button>
                <h2 className="text-xl font-semibold">{monthName} {currentYear}</h2>
                <button onClick={handleNextMonth} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-semibold">
                    Next &gt;
                </button>
            </div>
            
            <div className="grid grid-cols-7 text-center text-sm font-semibold text-gray-400 mb-2">
                {daysOfWeek.map((day) => (
                    <div key={day}>{day}</div>
                ))}
            </div>

            <div className="flex-1 grid grid-cols-7 gap-1">
                {monthDays.map((day, index) => {
                    if (!day) {
                        return <div key={index} className="w-full h-8"></div>; // Empty placeholder
                    }
                    const formattedDate = day.toISOString().slice(0, 10);
                    const count = tradeCounts[formattedDate] || 0;
                    const color = getHeatmapColor(count);
                    return (
                        <div key={index} 
                             className={`w-full h-8 flex items-center justify-center rounded-sm ${color} transition-colors duration-200`}
                             title={`${count} trade(s) on ${formattedDate}`}>
                             <span className="text-xs font-medium">{day.getDate()}</span>
                        </div>
                    );
                })}
            </div>

            <div className="mt-4 flex justify-between items-center text-sm text-gray-400">
                <p>Less</p>
                <div className="flex gap-1">
                    <span className="w-4 h-4 bg-gray-700 rounded-sm"></span>
                    <span className="w-4 h-4 bg-green-600 rounded-sm"></span>
                    <span className="w-4 h-4 bg-green-500 rounded-sm"></span>
                    <span className="w-4 h-4 bg-green-400 rounded-sm"></span>
                    <span className="w-4 h-4 bg-green-300 rounded-sm"></span>
                </div>
                <p>More</p>
            </div>
        </div>
    );
};

export default CalendarHeatmap;
