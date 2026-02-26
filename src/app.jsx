import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import FaceRecog from "./FaceRecog";
import Registration from "./pages/Registration";
import { syncStudentsFromServer } from "./services/testDB";

export default function App() {
  useEffect(() => {
    syncStudentsFromServer().catch(console.error);
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<FaceRecog />} />
        <Route path="/register" element={<Registration />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}