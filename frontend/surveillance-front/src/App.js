// ===============================
// App.js (Clean & Updated Version)
// ===============================

import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import TeacherDashboard from "./pages/TeacherDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import FinalCalendar from "./pages/FinalCalendar";


// ------------------------------
// BOOTSTRAP INJECTION
// ------------------------------
const BootstrapInjector = () => {
  React.useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);
  return null;
};

// ------------------------------
// NAVBAR COMPONENT
// ------------------------------
const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark mb-4 px-3">
      <div className="container-fluid">
        <span className="navbar-brand">FSEGS Exams</span>
        <div className="d-flex align-items-center ms-auto">
          {user ? (
            <>
              <span className="text-light me-3 small">
                {user.role === "ADMIN" ? "Administrator" : `Prof. ${user.nomComplet}`}
              </span>
              <button onClick={handleLogout} className="btn btn-outline-light btn-sm">
                Logout
              </button>
            </>
          ) : null}
        </div>
      </div>
    </nav>
  );
};

// ------------------------------
// PRIVATE ROUTE PROTECTION
// ------------------------------
const PrivateRoute = ({ children, role }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;

  if (role && user.role !== role) {
    return <Navigate to={user.role === "ADMIN" ? "/admin" : "/teacher"} />;
  }

  return children;
};

// ------------------------------
// MAIN INNER APP CONTENT
// ------------------------------
const AppContent = () => {
  const { user } = useAuth();
  return (
    <div className="container mt-4">
      {user && <Navbar />}

      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/teacher"
          element={
            <PrivateRoute role="TEACHER">
              <TeacherDashboard />
            </PrivateRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <PrivateRoute role="ADMIN">
              <AdminDashboard />
            </PrivateRoute>
          }
        />

        <Route
  path="/final-calendar"
  element={
    <PrivateRoute role="TEACHER">
      <FinalCalendar />
    </PrivateRoute>
  }
/>


        <Route
          path="*"
          element={<Navigate to={user ? (user.role === "ADMIN" ? "/admin" : "/teacher") : "/login"} />}
        />
      </Routes>
    </div>
  );
};

// ------------------------------
// ROOT APP WRAPPER
// ------------------------------
const App = () => {
  return (
    <AuthProvider>
      <Router>
        <BootstrapInjector />
        <AppContent />
      </Router>
    </AuthProvider>
  );
};

export default App;
