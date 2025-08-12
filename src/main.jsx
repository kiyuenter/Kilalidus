import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import WelcomePage from "./pages/WelcomePage";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import Dashboard from "./pages/Dashboard";
import Journal from "./pages/Journal";
import Report from "./pages/Report";
import Notebook from "./pages/Notebook";
import Strategies from "./pages/Strategies";
import PrivateRoute from "./components/PrivateRoute";




ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>}/>
        <Route path="/journal" element={<PrivateRoute><Journal /></PrivateRoute>} />
        <Route path="/report" element={<PrivateRoute><Report /></PrivateRoute>} />
        <Route path="/strategies" element={<PrivateRoute><Strategies /></PrivateRoute>} />
        <Route path="/notebook" element={<PrivateRoute><Notebook /></PrivateRoute>} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
