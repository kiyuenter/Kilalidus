import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { FaBars, FaTimes, FaTachometerAlt, FaBookOpen, FaChartLine, FaClipboardList, FaRegStickyNote, FaSignOutAlt } from 'react-icons/fa';

const Sidebar = () => {
  const navigate = useNavigate();
  // State to manage the sidebar's minimized status
  const [isMinimized, setIsMinimized] = useState(false);

  // Function to toggle the sidebar's state
  const toggleSidebar = () => {
    setIsMinimized(!isMinimized);
  };

  const handleSignOut = async () => {
    await signOut(auth);
    navigate("/signin");
  };

  return (
    <div
      className={`min-h-screen flex flex-col text-white transition-all duration-300 ease-in-out
                  bg-gradient-to-b from-indigo-800 via-purple-800 to-pink-700
                  shadow-lg ${isMinimized ? 'w-20' : 'w-64'}`}
    >
      {/* Sidebar Header with Toggle Button */}
      <div className={`p-6 flex items-center ${isMinimized ? 'justify-center' : 'justify-between'} border-b border-purple-600`}>
        {!isMinimized && (
          <div className="text-3xl font-extrabold">
            Kilalidus
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-full hover:bg-white hover:bg-opacity-20 transition-colors"
        >
          {isMinimized ? <FaBars size={20} /> : <FaTimes size={20} />}
        </button>
      </div>

      {/* Navigation links */}
      <nav className="flex-1 p-6 space-y-5">
        {[
          { to: "/dashboard", label: "Dashboard", icon: <FaTachometerAlt /> },
          { to: "/journal", label: "Journal", icon: <FaBookOpen /> },
          { to: "/report", label: "Report", icon: <FaChartLine /> },
          { to: "/strategies", label: "Strategies", icon: <FaClipboardList /> },
          { to: "/notebook", label: "Notebook", icon: <FaRegStickyNote /> },
        ].map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center rounded transition
              ${isMinimized ? 'justify-center p-4' : 'gap-4 px-4 py-3'}
              ${isActive ? "bg-pink-500 text-white font-semibold shadow-md" : "hover:bg-pink-600 hover:shadow-lg"}
              `
            }
          >
            <div className="text-xl">
              {icon}
            </div>
            {!isMinimized && (
              <span className="flex-1 text-lg">
                {label}
              </span>
            )}
          </NavLink>
        ))}

        <button
          onClick={handleSignOut}
          className={`flex items-center rounded transition w-full text-left
                      ${isMinimized ? 'justify-center p-4' : 'gap-4 px-4 py-3 mt-8'}
                      bg-red-600 hover:bg-red-700 shadow-md font-semibold`}
        >
          <div className="text-xl">
            <FaSignOutAlt />
          </div>
          {!isMinimized && (
            <span className="flex-1 text-lg">
              Sign Out
            </span>
          )}
        </button>
      </nav>
    </div>
  );
};

export default Sidebar;
