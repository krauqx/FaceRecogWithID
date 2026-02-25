import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import FaceRecog from "./FaceRecog";
import Registration from "./pages/Registration";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<FaceRecog />} />
        <Route path="/registration" element={<Registration />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}