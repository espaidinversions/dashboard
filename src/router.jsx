import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./components/Dashboard.jsx";
import FundsIndex from "./components/FundsIndex.jsx";
import CompaniesIndex from "./components/CompaniesIndex.jsx";
import FundDetail from "./components/FundDetail.jsx";
import CompanyDetail from "./components/CompanyDetail.jsx";
import LoginPage from "./components/LoginPage.jsx";
import AdminPanel from "./components/AdminPanel.jsx";
import { useAuth } from "./auth.jsx";
import { PMPositionDetail } from "./components/PMPositionDetail.jsx";

function RequireAuth({ children }) {
  const { session } = useAuth();
  if (session === undefined) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F0F4F8", fontFamily: "'Outfit',system-ui,sans-serif", color: "#7A8A9A", fontSize: 14 }}>
      Carregant…
    </div>
  );
  if (!session) return <Navigate to="/login" replace />;
  return children;
}

function RequireAdmin({ children }) {
  const { session, isAdmin } = useAuth();
  if (session === undefined) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F0F4F8", fontFamily: "'Outfit',system-ui,sans-serif", color: "#7A8A9A", fontSize: 14 }}>
      Carregant…
    </div>
  );
  if (!session) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="/investments" element={<RequireAuth><Navigate to="/investments/funds" replace /></RequireAuth>} />
      <Route path="/investments/funds" element={<RequireAuth><FundsIndex /></RequireAuth>} />
      <Route path="/investments/companies" element={<RequireAuth><CompaniesIndex /></RequireAuth>} />
      <Route path="/fund/:id" element={<RequireAuth><FundDetail /></RequireAuth>} />
      <Route path="/company/:id" element={<RequireAuth><CompanyDetail /></RequireAuth>} />
      <Route path="/mercats-publics/:id" element={<RequireAuth><PMPositionDetail /></RequireAuth>} />
      <Route path="/admin" element={<RequireAdmin><AdminPanel /></RequireAdmin>} />
    </Routes>
  );
}
