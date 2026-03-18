import React from "react";
import { Routes, Route } from "react-router-dom";
import Dashboard from "./components/Dashboard.jsx";
import InvestmentsIndex from "./components/InvestmentsIndex.jsx";
import FundDetail from "./components/FundDetail.jsx";
import CompanyDetail from "./components/CompanyDetail.jsx";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/investments" element={<InvestmentsIndex />} />
      <Route path="/fund/:id" element={<FundDetail />} />
      <Route path="/company/:id" element={<CompanyDetail />} />
    </Routes>
  );
}
