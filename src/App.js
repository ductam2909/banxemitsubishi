import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { VehicleDataProvider } from './context/VehicleDataContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import CostCalculation from './components/CostCalculation';
import VehicleConfig from './components/VehicleConfig';
import Login from './components/Login';
import AdminPanel from './components/AdminPanel';
import CustomerManager from './components/CustomerManager';
import './App.css';

// Private Route Component
const PrivateRoute = ({ children }) => {
  const { currentUser } = useAuth();
  if (!currentUser) return <Navigate to="/login" replace />;
  return children;
};

// Main layout that includes navigation
function MainLayout() {
  const [page, setPage] = useState('calculator'); // 'calculator' | 'config' | 'admin'
  const { currentUser, logout } = useAuth();

  return (
    <div className="app-wrapper">
      <nav className="global-nav">
        <div className="nav-inner">
          <div className="nav-brand">
            <span className="nav-brand-icon">◆</span>
            <span className="nav-brand-text">MITSUBISHI</span>
            {currentUser && <span style={{fontSize: '12px', marginLeft: '10px', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '12px'}}>{currentUser.username}</span>}
          </div>
          <div className="nav-links">
            <button
              className={`nav-link ${page === 'calculator' ? 'active' : ''}`}
              onClick={() => setPage('calculator')}
            >
              <span className="nav-link-icon">📊</span>
              Bảng Tính Chi Phí
            </button>
            <button
              className={`nav-link ${page === 'customers' ? 'active' : ''}`}
              onClick={() => setPage('customers')}
            >
              <span className="nav-link-icon">👥</span>
              Quản Lý Khách Hàng
            </button>
            {currentUser?.role === 'admin' && (
              <>
                <button
                  className={`nav-link ${page === 'config' ? 'active' : ''}`}
                  onClick={() => setPage('config')}
                >
                  <span className="nav-link-icon">⚙️</span>
                  Quản Lý Cấu Hình
                </button>
                <button
                  className={`nav-link ${page === 'admin' ? 'active' : ''}`}
                  onClick={() => setPage('admin')}
                >
                  <span className="nav-link-icon">👥</span>
                  Quản Lý Cấp Phát Tài Khoản
                </button>
              </>
            )}
            <button className="nav-link" onClick={logout} style={{ marginLeft: 'auto', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
              <span className="nav-link-icon">🚪</span> Thoát
            </button>
          </div>
        </div>
      </nav>

      <main className="page-content">
        {page === 'calculator' && <CostCalculation />}
        {page === 'customers' && <CustomerManager />}
        {page === 'config' && currentUser?.role === 'admin' && <VehicleConfig />}
        {page === 'admin' && currentUser?.role === 'admin' && <AdminPanel />}
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <VehicleDataProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route 
              path="/*" 
              element={
                <PrivateRoute>
                  <MainLayout />
                </PrivateRoute>
              } 
            />
          </Routes>
        </Router>
      </VehicleDataProvider>
    </AuthProvider>
  );
}

export default App;
