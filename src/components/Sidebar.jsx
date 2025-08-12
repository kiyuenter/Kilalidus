import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

const Sidebar = () => {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut(auth);
    navigate("/signin");
  };

  return (
    <div className="w-64 min-h-screen flex flex-col text-white 
                    bg-gradient-to-b from-indigo-800 via-purple-800 to-pink-700
                    shadow-lg">
      <div className="p-6 text-3xl font-extrabold border-b border-purple-600">
        Kilalidus
      </div>
      <nav className="flex-1 p-6 space-y-5">
        {[
          { to: "/dashboard", label: "Dashboard" },
          { to: "/journal", label: "Journal" },
          { to: "/report", label: "Report" },
          { to: "/strategies", label: "Strategies" },
          { to: "/notebook", label: "Notebook" },
        ].map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              isActive
                ? "block px-4 py-3 rounded bg-pink-500 text-white font-semibold shadow-md"
                : "block px-4 py-3 rounded hover:bg-pink-600 hover:shadow-lg transition"
            }
          >
            {label}
          </NavLink>
        ))}

        <button
          onClick={handleSignOut}
          className="w-full text-left px-4 py-3 mt-8 rounded bg-red-600 hover:bg-red-700 shadow-md transition font-semibold"
        >
          Sign Out
        </button>
      </nav>
    </div>
  );
};

export default Sidebar;
