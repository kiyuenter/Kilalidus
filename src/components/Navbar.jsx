import React from "react";
import { Link } from "react-router-dom";

const Navbar = () => {
  return (
    <nav className="fixed top-0 w-full z-50 text-white px-6 py-4 flex justify-between items-center">
      {/* Logo/Name */}
      <Link to="/" className="text-2xl font-bold">
        Kilalidus
      </Link>

      {/* Navigation links */}
      <div className="space-x-6">
        <Link
          to="/signin"
          className="hover:text-yellow-400 transition-colors duration-200"
        >
          Sign In
        </Link>
        <Link
          to="/signup"
          className="hover:text-yellow-400 transition-colors duration-200"
        >
          Sign Up
        </Link>
      </div>
    </nav>
  );
};

export default Navbar;
