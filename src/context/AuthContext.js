import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = localStorage.getItem('appUser');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [loading, setLoading] = useState(false);

  const login = async (username, password) => {
    setLoading(true);
    try {
      // Hardcode the master admin as requested to ensure it always works
      if (username === 'admin' && password === 'admin@2909') {
        const adminUser = { username: 'admin', role: 'admin' };
        setCurrentUser(adminUser);
        localStorage.setItem('appUser', JSON.stringify(adminUser));
        setLoading(false);
        return { success: true };
      }

      const q = query(collection(db, 'users'), where('username', '==', username), where('password', '==', password));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        let userDoc = null;
        let role = 'user';
        // Handle potentially multiple same users (should not happen)
        querySnapshot.forEach((doc) => {
          userDoc = doc.data();
        });
        
        const user = { id: querySnapshot.docs[0].id, username: userDoc.username, role: userDoc.role || 'user' };
        setCurrentUser(user);
        localStorage.setItem('appUser', JSON.stringify(user));
        setLoading(false);
        return { success: true };
      }

      setLoading(false);
      return { success: false, error: 'Sai tài khoản hoặc mật khẩu' };
    } catch (err) {
      console.error('Lỗi đăng nhập:', err);
      setLoading(false);
      return { success: false, error: 'Có lỗi xảy ra khi kết nối máy chủ' };
    }
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('appUser');
  };

  const value = { currentUser, login, logout, loading };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
