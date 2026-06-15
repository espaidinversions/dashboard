import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary.jsx";
import { useAuth } from "./auth.jsx";

const Dashboard = lazy(() => import("./components/Dashboard.jsx"));
const FundsIndex = lazy(() => import("./components/FundsIndex.jsx"));
const CompaniesIndex = lazy(() => import("./components/CompaniesIndex.jsx"));
const SearchersIndex = lazy(() => import("./components/SearchersIndex.jsx"));
const FundDetail = lazy(() => import("./components/FundDetail.jsx"));
const CompanyDetail = lazy(() => import("./components/CompanyDetail.jsx"));
const LoginPage = lazy(() => import("./components/LoginPage.jsx"));
const AdminPanel = lazy(() => import("./components/AdminPanel.jsx"));
const PMPositionDetail = lazy(() => import("./components/PMPositionDetail.jsx"));
const SearcherDetail = lazy(() => import("./components/SearcherDetail.jsx"));
const UserGuide = lazy(() => import("./components/UserGuide.jsx"));
const ResetPasswordPage = lazy(() => import("./components/ResetPasswordPage.jsx"));

function LoadingFallback() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F0F4F8", fontFamily: "'Outfit',system-ui,sans-serif", color: "#7A8A9A", fontSize: 14 }}>
      Carregant…
    </div>
  );
}

function RequireAuth({ children }) {
  const { session, isRecovery } = useAuth();
  if (session === undefined) return <LoadingFallback />;
  if (!session) return <Navigate to="/login" replace />;
  if (isRecovery) return <Navigate to="/reset-password" replace />;
  return children;
}

function RequireAdmin({ children }) {
  const { session, isAdmin } = useAuth();
  if (session === undefined) return <LoadingFallback />;
  if (!session) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}

function RequireSection({ children, section, fallback = "/" }) {
  const { session, isRecovery, canAccessSection } = useAuth();
  if (session === undefined) return <LoadingFallback />;
  if (!session) return <Navigate to="/login" replace />;
  if (isRecovery) return <Navigate to="/reset-password" replace />;
  if (!canAccessSection(section)) return <Navigate to={fallback} replace />;
  return children;
}

function RequireAnySection({ children, sections, fallback = "/" }) {
  const { session, isRecovery, canAccessAny } = useAuth();
  if (session === undefined) return <LoadingFallback />;
  if (!session) return <Navigate to="/login" replace />;
  if (isRecovery) return <Navigate to="/reset-password" replace />;
  if (!canAccessAny(sections)) return <Navigate to={fallback} replace />;
  return children;
}

export default function AppRoutes() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/investments" element={<RequireAuth><Navigate to="/investments/funds" replace /></RequireAuth>} />
          <Route path="/investments/funds" element={<RequireAnySection sections={["alternatives", "real-estate"]}><FundsIndex /></RequireAnySection>} />
          <Route path="/investments/companies" element={<RequireSection section="companies"><CompaniesIndex /></RequireSection>} />
          <Route path="/investments/searchers" element={<RequireSection section="alternatives"><SearchersIndex /></RequireSection>} />
          <Route path="/investments/searchers/:id" element={<RequireSection section="alternatives"><SearcherDetail /></RequireSection>} />
          <Route path="/investments/funds/:id" element={<RequireAnySection sections={["alternatives", "real-estate"]}><FundDetail /></RequireAnySection>} />
          <Route path="/investments/companies/:id" element={<RequireSection section="companies"><CompanyDetail /></RequireSection>} />
          <Route path="/mercats-publics/:id" element={<RequireSection section="mercats-publics"><PMPositionDetail /></RequireSection>} />
          <Route path="/admin" element={<RequireAdmin><AdminPanel /></RequireAdmin>} />
          <Route path="/guia" element={<RequireAuth><UserGuide /></RequireAuth>} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
