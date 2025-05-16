import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import MapPage from './pages/MapPage';
import SoldierList from './pages/SoldierList';
import SoldierDetail from './pages/SoldierDetail';
import Profile from './pages/Profile';
import AdminUsers from './pages/AdminUsers';
import './App.css';

// Компонент для перевірки автентифікації
const PrivateRoute = ({ children }) => {
  const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
  return isAuthenticated ? children : <Navigate to="/login" />;
};

// Компонент для перевірки ролі адміністратора
const AdminRoute = ({ children }) => {
  const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
  const isAdmin = localStorage.getItem('isAdmin') === 'true';
  
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  
  return isAdmin ? children : <Navigate to="/map" />;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/map" element={
          <PrivateRoute>
            <MapPage />
          </PrivateRoute>
        } />
        <Route path="/soldiers" element={
          <PrivateRoute>
            <SoldierList />
          </PrivateRoute>
        } />
        <Route path="/soldiers/:devEui" element={
          <PrivateRoute>
            <SoldierDetail />
          </PrivateRoute>
        } />
        <Route path="/profile" element={
          <PrivateRoute>
            <Profile />
          </PrivateRoute>
        } />
        <Route path="/admin/users" element={
          <AdminRoute>
            <AdminUsers />
          </AdminRoute>
        } />
        <Route path="/" element={<Navigate to="/map" />} />
      </Routes>
    </Router>
  );
}

export default App;
