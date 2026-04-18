import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Login.css'; // We will create this next

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, loading } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Vui lòng nhập đầy đủ thông tin');
      return;
    }
    
    setError('');
    const res = await login(username, password);
    if (res.success) {
      navigate('/');
    } else {
      setError(res.error);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">◆</div>
          <h2>MITSUBISHI SAVICO</h2>
          <p>Hệ thống nội bộ báo giá và quản lý</p>
        </div>
        <form onSubmit={handleLogin} className="login-form">
          {error && <div className="login-error">{error}</div>}
          <div className="form-group">
            <label>Tài khoản</label>
            <input 
              type="text" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              placeholder="Nhập tên đăng nhập"
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label>Mật khẩu</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="Nhập mật khẩu"
              disabled={loading}
            />
          </div>
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Đang xử lý...' : 'ĐĂNG NHẬP'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
