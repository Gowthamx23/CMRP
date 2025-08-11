import React from "react";
import PublicDashboard from "./components/PublicDashboard";
import TrackComplaint from "./components/TrackComplaint";

import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";

function PublicApp() {
  return (
    <Router>
      <div style={{ minHeight: "100vh", background: "#f4f8fb", padding: 0 }}>
        <header style={{ background: "#007bff", color: "#fff", padding: 24, textAlign: "center", borderRadius: "0 0 16px 16px", marginBottom: 24 }}>
          <a
            href="/"
            className="text-blue-500 hover:underline font-semibold"
            style={{ position: "absolute", right: 32, top: 32, color: "#fff", textDecoration: "underline", fontWeight: 600 }}
          >
            Login / Register
          </a>
          <h1 style={{ margin: 0, fontWeight: 700, fontSize: 32, letterSpacing: 1 }}>CMRP Public Portal</h1>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 400 }}>Citizen Management & Resolution Platform</p>
        </header>
        <nav style={{ marginBottom: 24, display: 'flex', justifyContent: 'center', gap: 16 }}>
          <Link to="/public-dashboard" style={{ padding: '8px 20px', background: '#fff', borderRadius: 6, border: '1px solid #007bff', color: '#007bff', textDecoration: 'none', fontWeight: 500 }}>Public Dashboard</Link>
          <Link to="/track-complaint" style={{ padding: '8px 20px', background: '#fff', borderRadius: 6, border: '1px solid #007bff', color: '#007bff', textDecoration: 'none', fontWeight: 500 }}>Track Complaint</Link>
        </nav>
        <main style={{ maxWidth: 900, margin: '0 auto', background: '#fff', borderRadius: 8, boxShadow: '0 2px 12px #0001', padding: 32, minHeight: 400 }}>
          <Routes>
            <Route path="/public-dashboard" element={<PublicDashboard />} />
            <Route path="/track-complaint" element={<TrackComplaint />} />
            <Route path="*" element={<PublicDashboard />} />
          </Routes>
        </main>
        <footer style={{ textAlign: 'center', marginTop: 40, color: '#888', fontSize: 14, padding: 16 }}>
          &copy; {new Date().getFullYear()} CMRP. All rights reserved.
        </footer>
      </div>
    </Router>
  );
}

export default PublicApp;
