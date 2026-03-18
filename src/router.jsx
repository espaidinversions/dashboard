import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./components/Dashboard.jsx";
import FundsIndex from "./components/FundsIndex.jsx";
import CompaniesIndex from "./components/CompaniesIndex.jsx";
import FundDetail from "./components/FundDetail.jsx";
import CompanyDetail from "./components/CompanyDetail.jsx";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/investments" element={<Navigate to="/investments/funds" replace />} />
      <Route path="/investments/funds" element={<FundsIndex />} />
      <Route path="/investments/companies" element={<CompaniesIndex />} />
      <Route path="/fund/:id" element={<FundDetail />} />
      <Route path="/company/:id" element={<CompanyDetail />} />
    </Routes>
  );
}
