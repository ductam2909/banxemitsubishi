import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, getDocs, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import './AdminPanel.css';

function AdminPanel() {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Custom UI States
  const [toast, setToast] = useState(null);
  const toastTimeoutRef = useRef(null);

  const [resetModal, setResetModal] = useState({ isOpen: false, id: null, username: '', newPass: '' });
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null, username: '' });

  useEffect(() => {
    fetchUsers();
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const fetchUsers = async () => {
    try {
      const q = query(collection(db, 'users'));
      const snapshot = await getDocs(q);
      const userList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(userList);
      setLoading(false);
    } catch (err) {
      console.error('Lỗi khi tải danh sách users:', err);
      setLoading(false);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newUsername || !newPassword) return;
    
    try {
      if (users.find(u => u.username === newUsername) || newUsername === 'admin') {
        showToast('Tên tài khoản này đã tồn tại!', 'error');
        return;
      }
      
      const docRef = await addDoc(collection(db, 'users'), {
        username: newUsername,
        password: newPassword,
        role: 'user'
      });
      
      setUsers([...users, { id: docRef.id, username: newUsername, password: newPassword, role: 'user' }]);
      setNewUsername('');
      setNewPassword('');
      showToast('Đã cấp tài khoản thành công!');
    } catch (err) {
      console.error('Lỗi thêm user:', err);
      showToast('Lỗi thêm tài khoản.', 'error');
    }
  };

  // Delete Action
  const confirmDelete = async () => {
    const { id, username } = deleteModal;
    try {
      await deleteDoc(doc(db, 'users', id));
      setUsers(users.filter(u => u.id !== id));
      showToast(`Đã xoá tài khoản ${username}`);
    } catch (err) {
      console.error('Lỗi xoá user:', err);
      showToast('Có lỗi xảy ra khi xoá.', 'error');
    }
    setDeleteModal({ isOpen: false, id: null, username: '' });
  };

  // Reset Password Action
  const submitResetPassword = async () => {
    const { id, username, newPass } = resetModal;
    if (!newPass || newPass.trim() === '') {
      showToast('Vui lòng nhập mật khẩu hợp lệ', 'error');
      return;
    }
    
    try {
      await updateDoc(doc(db, 'users', id), {
        password: newPass.trim()
      });
      setUsers(users.map(u => u.id === id ? { ...u, password: newPass.trim() } : u));
      showToast(`Đổi mật khẩu cho ${username} thành công!`);
    } catch (err) {
      console.error('Lỗi đổi mật khẩu:', err);
      showToast('Có lỗi xảy ra khi đổi mật khẩu.', 'error');
    }
    setResetModal({ isOpen: false, id: null, username: '', newPass: '' });
  };

  if (currentUser?.role !== 'admin') {
    return <div style={{padding: '40px', textAlign: 'center'}}>Bạn không có quyền truy cập trang này.</div>;
  }

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h2>Quản Lý Tài Khoản (Dành cho Admin)</h2>
      </div>
      
      <div className="admin-content">
        <div className="admin-card">
          <h3>Cấp tài khoản mới</h3>
          <form className="add-user-form" onSubmit={handleAddUser}>
            <div className="form-group">
              <label>Tên đăng nhập</label>
              <input 
                type="text" 
                value={newUsername} 
                onChange={e => setNewUsername(e.target.value)} 
                placeholder="VD: nhanvien1"
              />
            </div>
            <div className="form-group">
              <label>Mật khẩu</label>
              <input 
                type="text" 
                value={newPassword} 
                onChange={e => setNewPassword(e.target.value)} 
                placeholder="Nhập mật khẩu"
              />
            </div>
            <button type="submit" className="add-btn">
              + Tạo Tài Khoản
            </button>
          </form>
        </div>

        <div className="admin-card">
          <h3>Danh sách tài khoản</h3>
          {loading ? (
            <p>Đang tải...</p>
          ) : (
            <table className="users-table">
              <thead>
                <tr>
                  <th>Tài khoản</th>
                  <th>Mật khẩu</th>
                  <th>Phân quyền</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>admin</strong></td>
                  <td><i>(Ẩn)</i></td>
                  <td>admin</td>
                  <td><span className="badge">Gốc</span></td>
                </tr>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>{u.username}</td>
                    <td>{u.password}</td>
                    <td>{u.role}</td>
                    <td>
                      <div style={{display: 'flex', gap: '8px'}}>
                        <button 
                          className="reset-btn" 
                          onClick={() => setResetModal({ isOpen: true, id: u.id, username: u.username, newPass: '' })}
                        >
                          Đổi MK
                        </button>
                        <button 
                          className="del-btn" 
                          onClick={() => setDeleteModal({ isOpen: true, id: u.id, username: u.username })}
                        >
                          Xoá
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* CUSTOM OVERLAYS */}

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content">
            <h3 className="admin-modal-title">Xác nhận xoá</h3>
            <p style={{color: '#475569', fontSize: '15px'}}>Ban có chắc muốn thu hồi tài khoản <b>{deleteModal.username}</b> vĩnh viễn không?</p>
            <div className="admin-modal-actions">
              <button className="admin-modal-btn cancel" onClick={() => setDeleteModal({ isOpen: false, id: null, username: '' })}>Hủy</button>
              <button className="admin-modal-btn danger" onClick={confirmDelete}>Đồng ý Xoá</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetModal.isOpen && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content">
            <h3 className="admin-modal-title">Cấp lại Mật khẩu</h3>
            <p style={{color: '#475569', fontSize: '14px', margin: '0 0 10px'}}>Mật khẩu mới cho tài khoản: <b>{resetModal.username}</b></p>
            <input 
              autoFocus
              type="text" 
              className="admin-modal-input" 
              placeholder="Nhập mật khẩu mới..."
              value={resetModal.newPass}
              onChange={e => setResetModal({...resetModal, newPass: e.target.value})}
              onKeyDown={e => e.key === 'Enter' && submitResetPassword()}
            />
            <div className="admin-modal-actions">
              <button className="admin-modal-btn cancel" onClick={() => setResetModal({ isOpen: false, id: null, username: '', newPass: '' })}>Hủy</button>
              <button className="admin-modal-btn confirm" onClick={submitResetPassword}>Cập nhật</button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {toast && (
        <div className={`toast-notification toast-${toast.type}`}>
          <div className="toast-icon">{toast.type === 'error' ? '⚠️' : '✅'}</div>
          <div className="toast-message">{toast.message}</div>
        </div>
      )}
    </div>
  );
}

export default AdminPanel;
