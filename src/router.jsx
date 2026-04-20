import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary.jsx";
import { useAuth } from "./auth.jsx";

const Dashboard = lazy(() => import("./components/Dashboard.jsx"));
const FundsIndex = lazy(() => import("./components/FundsIndex.jsx"));
const CompaniesIndex = lazy(() => import("./components/CompaniesIndex.jsx"));
const FundDetail = lazy(() => import("./components/FundDetail.jsx"));
const CompanyDetail = lazy(() => import("./components/CompanyDetail.jsx"));
const LoginPage = lazy(() => import("./components/LoginPage.jsx"));
const AdminPanel = lazy(() => import("./components/AdminPanel.jsx"));
const PMPositionDetail = lazy(() => import("./components/PMPositionDetail.jsx"));
const UserGuide = lazy(() => import("./components/UserGuide.jsx"));

function LoadingFallback() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F0F4F8", fontFamily: "'Outfit',system-ui,sans-serif", color: "#7A8A9A", fontSize: 14 }}>
      Carregant…
    </div>
  );
}

function RequireAuth({ children }) {
  const { session } = useAuth();
  if (session === undefined) return <LoadingFallback />;
  if (!session) return <Navigate to="/login" replace />;
  return children;
}

function RequireAdmin({ children }) {
  const { session, isAdmin } = useAuth();
  if (session === undefined) return <LoadingFallback />;
  if (!session) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}

export default function AppRoutes() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingFallback />}>
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
          <Route path="/guia" element={<RequireAuth><UserGuide /></RequireAuth>} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
