import React, { useState, useEffect, useRef, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useVehicleData } from '../context/VehicleDataContext';
import './CustomerManager.css';

const STATUS_OPTIONS = [
  { value: 'new', label: 'Khách mới (Chưa liên hệ)', color: '#3b82f6' }, // Blue
  { value: 'chatting', label: 'Đang nhắn tin / Tư vấn', color: '#f59e0b' }, // Amber
  { value: 'meeting', label: 'Hẹn gặp mặt / Lái thử', color: '#8b5cf6' }, // Purple
  { value: 'quoted', label: 'Đã báo giá / Chờ suy nghĩ', color: '#0ea5e9' }, // Light Blue
  { value: 'won', label: 'Chốt cọc thành công', color: '#10b981' }, // Green
  { value: 'lost', label: 'Khách huỷ / Mua hãng khác', color: '#ef4444' } // Red
];

const ITEMS_PER_PAGE = 10;

function CustomerManager() {
  const { currentUser } = useAuth();
  const { vehicleData } = useVehicleData();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search, Filter, Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [toast, setToast] = useState(null);
  const toastTimeoutRef = useRef(null);

  // Get YYYY-MM-DD for date input
  const getTodayDateString = () => {
    const d = new Date();
    const month = `${d.getMonth() + 1}`.padStart(2, '0');
    const day = `${d.getDate()}`.padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
  };

  // Form states
  const [formData, setFormData] = useState({ 
    id: null, name: '', phone: '', status: 'new', note: '', 
    derivedDate: getTodayDateString(), carModel: '', address: '', plateType: 'white'
  });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null, name: '' });
  const [viewModal, setViewModal] = useState({ isOpen: false, data: null });

  useEffect(() => {
    if (currentUser) {
      fetchCustomers();
    }
  }, [currentUser]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const fetchCustomers = async () => {
    try {
      const q = query(collection(db, 'customers'), where('userId', '==', currentUser.id));
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      list.sort((a, b) => b.createdAt - a.createdAt); 
      setCustomers(list);
      setLoading(false);
    } catch (err) {
      console.error('Lỗi khi tải khách hàng:', err);
      showToast('Không thể tải danh sách khách hàng.', 'error');
      setLoading(false);
    }
  };

  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      showToast('Vui lòng nhập tên khách hàng', 'error');
      return;
    }

    try {
      let createdTs = Date.now();
      if (formData.derivedDate) {
        createdTs = new Date(formData.derivedDate).getTime();
      }

      if (formData.id) {
        // Update existing
        await updateDoc(doc(db, 'customers', formData.id), {
          name: formData.name,
          phone: formData.phone,
          status: formData.status,
          note: formData.note,
          carModel: formData.carModel,
          address: formData.address,
          plateType: formData.plateType,
          createdAt: createdTs,
          updatedAt: Date.now()
        });
        
        let updatedList = customers.map(c => c.id === formData.id ? { ...c, ...formData, createdAt: createdTs, updatedAt: Date.now() } : c);
        updatedList.sort((a,b) => b.createdAt - a.createdAt);
        setCustomers(updatedList);
        showToast('Đã cập nhật thông tin khách hàng!');
      } else {
        // Create new
        const newCustomer = {
          userId: currentUser.id,
          name: formData.name,
          phone: formData.phone,
          status: formData.status,
          note: formData.note,
          carModel: formData.carModel,
          address: formData.address,
          plateType: formData.plateType,
          createdAt: createdTs,
          updatedAt: Date.now()
        };
        const docRef = await addDoc(collection(db, 'customers'), newCustomer);
        
        let newList = [{ id: docRef.id, ...newCustomer }, ...customers];
        newList.sort((a,b) => b.createdAt - a.createdAt);
        setCustomers(newList);
        showToast('Đã thêm khách hàng mới thành công!');
      }
      setIsFormOpen(false);
      setFormData({ id: null, name: '', phone: '', status: 'new', note: '', derivedDate: getTodayDateString(), carModel: '', address: '', plateType: 'white' });
      setCurrentPage(1); // Jump back to page 1 on new add
    } catch (err) {
      console.error('Lỗi lưu khách hàng:', err);
      showToast('Có lỗi xảy ra khi lưu trữ!', 'error');
    }
  };

  const handleEdit = (customer) => {
    let dd = getTodayDateString();
    if (customer.createdAt) {
      const d = new Date(customer.createdAt);
      const month = `${d.getMonth() + 1}`.padStart(2, '0');
      const day = `${d.getDate()}`.padStart(2, '0');
      dd = `${d.getFullYear()}-${month}-${day}`;
    }

    setFormData({ 
      id: customer.id, 
      name: customer.name || '', 
      phone: customer.phone || '', 
      status: customer.status || 'new', 
      note: customer.note || '',
      carModel: customer.carModel || '',
      address: customer.address || '',
      plateType: customer.plateType || 'white',
      derivedDate: dd
    });
    setIsFormOpen(true);
  };

  const handleView = (customer) => {
    setViewModal({ isOpen: true, data: customer });
  };

  const confirmDelete = async () => {
    try {
      await deleteDoc(doc(db, 'customers', deleteModal.id));
      setCustomers(customers.filter(c => c.id !== deleteModal.id));
      showToast('Đã xoá khách hàng khỏi danh sách!');
    } catch (err) {
      console.error('Lỗi xoá khách hàng:', err);
      showToast('Có lỗi xảy ra khi xoá!', 'error');
    }
    setDeleteModal({ isOpen: false, id: null, name: '' });
  };

  const getStatusDisplay = (statusValue) => {
    const opt = STATUS_OPTIONS.find(o => o.value === statusValue);
    if (!opt) return null;
    return <span className="status-badge" style={{ backgroundColor: `${opt.color}15`, color: opt.color, border: `1px solid ${opt.color}30` }}>{opt.label}</span>;
  };

  // ----------------------------------
  // Computed Data for View
  // ----------------------------------
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      // Name or Phone Search
      const textMatch = 
        (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
        (c.phone || '').includes(searchQuery);
      
      // Date Filter
      let dateMatch = true;
      if (dateFilter) {
        const d = new Date(c.createdAt);
        const month = `${d.getMonth() + 1}`.padStart(2, '0');
        const day = `${d.getDate()}`.padStart(2, '0');
        const cDateStr = `${d.getFullYear()}-${month}-${day}`;
        dateMatch = cDateStr === dateFilter;
      }
      
      return textMatch && dateMatch;
    });
  }, [customers, searchQuery, dateFilter]);

  const totalPages = Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE) || 1;
  const currentCustomersList = filteredCustomers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="customer-manager">
      <div className="cm-header">
        <div>
          <h2>Quản Lý Khách Hàng</h2>
          <p>Lưu trữ và theo dõi tiến độ chăm sóc khách hàng cá nhân.</p>
        </div>
        <button className="cm-add-btn" onClick={() => {
          setFormData({ id: null, name: '', phone: '', status: 'new', note: '', derivedDate: getTodayDateString(), carModel: '', address: '', plateType: 'white' });
          setIsFormOpen(true);
        }}>
          <span className="icon">➕</span> Khách Mới
        </button>
      </div>

      <div className="cm-content">
        {/* FILTERS BAR */}
        <div className="cm-filters-bar">
          <input 
            type="text" 
            className="cm-search-input" 
            placeholder="🔍 Tìm tên hoặc số điện thoại..." 
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
          />
          <div className="cm-date-filter">
            <span style={{fontSize: '14px', color:'var(--text-secondary)'}}>Lọc theo ngày:</span>
            <input 
              type="date" 
              value={dateFilter}
              onChange={(e) => { setDateFilter(e.target.value); setCurrentPage(1); }}
              onClick={(e) => { try { if (e.target.showPicker) e.target.showPicker(); } catch(err){} }}
            />
          </div>
          {(searchQuery || dateFilter) && (
            <button className="cm-action-btn del" onClick={() => { setSearchQuery(''); setDateFilter(''); setCurrentPage(1); }}>
              Xoá lọc
            </button>
          )}
        </div>

        {loading ? (
          <div className="cm-loading">Đang tải danh sách...</div>
        ) : customers.length === 0 ? (
          <div className="cm-empty">
            <div className="cm-empty-icon">📝</div>
            <p>Bạn chưa có khách hàng nào.</p>
            <button className="cm-empty-btn" onClick={() => setIsFormOpen(true)}>Thêm mới ngay</button>
          </div>
        ) : filteredCustomers.length === 0 ? (
           <div className="cm-empty">
            <p>Không tìm thấy khách hàng nào phù hợp với bộ lọc.</p>
          </div>
        ) : (
          <>
            <div className="cm-table-container">
              <table className="cm-table">
                <thead>
                  <tr>
                    <th width="3%">STT</th>
                    <th width="12%">Tên khách</th>
                    <th width="10%">SĐT</th>
                    <th width="10%">Ngày tạo</th>
                    <th width="12%" className="hide-on-mobile">Dòng xe</th>
                    <th width="8%" className="hide-on-mobile">Biển số</th>
                    <th width="10%" className="hide-on-mobile">Tình trạng</th>
                    <th width="20%" className="hide-on-mobile">Ghi chú</th>
                    <th width="15%">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {currentCustomersList.map((c, index) => {
                    const realIndex = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;
                    return (
                      <tr key={c.id}>
                        <td style={{textAlign: 'center'}}>{realIndex}</td>
                        <td className="cm-cell-name">{c.name}</td>
                        <td>{c.phone || '-'}</td>
                        <td>{new Date(c.createdAt).toLocaleDateString('vi-VN')}</td>
                        <td className="hide-on-mobile"><div className="cm-cell-car">{c.carModel ? (c.carModel.includes(' - ') ? c.carModel.split(' - ')[1] : c.carModel) : '-'}</div></td>
                        <td className="hide-on-mobile">
                          {c.plateType === 'yellow' ? 
                            <span className="plate-badge yellow">Biển Vàng</span> : 
                            <span className="plate-badge white">Biển Trắng</span>}
                        </td>
                        <td className="hide-on-mobile">{getStatusDisplay(c.status)}</td>
                        <td className="cm-cell-note hide-on-mobile">{c.note || ''}</td>
                        <td>
                          <div className="cm-actions-group">
                            <button className="cm-action-btn view" title="Xem" onClick={() => handleView(c)}>👁️</button>
                            <button className="cm-action-btn edit" title="Sửa" onClick={() => handleEdit(c)}>✏️</button>
                            <button className="cm-action-btn del" title="Xoá" onClick={() => setDeleteModal({ isOpen: true, id: c.id, name: c.name })}>🗑️</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* PAGINATION */}
            {totalPages > 1 && (
              <div className="cm-pagination">
                <button 
                  className="cm-page-btn" 
                  disabled={currentPage === 1} 
                  onClick={() => setCurrentPage(p => p - 1)}
                >
                  ❮ Trước
                </button>
                <div className="cm-page-info">
                  Trang {currentPage} / {totalPages}
                </div>
                <button 
                  className="cm-page-btn" 
                  disabled={currentPage === totalPages} 
                  onClick={() => setCurrentPage(p => p + 1)}
                >
                  Sau ❯
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* --- FORMS AND MODALS --- */}
      {isFormOpen && (
        <div className="cm-modal-overlay">
          <div className="cm-modal-content">
            <h3 className="cm-modal-title">{formData.id ? 'Sửa thông tin Khách hàng' : 'Thêm Khách hàng mới'}</h3>
            <form onSubmit={handleSaveCustomer}>
              <div className="cm-form-group">
                <label>Tên khách hàng <span style={{color:'red'}}>*</span></label>
                <input 
                  type="text" 
                  autoFocus
                  placeholder="VD: Anh Minh..." 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                  required
                />
              </div>
              <div className="cm-form-group">
                <label>Số điện thoại</label>
                <input 
                  type="tel" 
                  placeholder="VD: 0901234..." 
                  value={formData.phone} 
                  onChange={e => setFormData({...formData, phone: e.target.value})} 
                />
              </div>
              <div className="cm-form-group">
                <label>Ngày phát sinh</label>
                <input 
                  type="date" 
                  value={formData.derivedDate} 
                  onClick={(e) => { try { if (e.target.showPicker) e.target.showPicker(); } catch(err){} }}
                  onChange={e => setFormData({...formData, derivedDate: e.target.value})} 
                />
              </div>
              <div className="cm-form-group">
                <label>Địa chỉ</label>
                <input 
                  type="text" 
                  placeholder="VD: Hải Châu, Đà Nẵng..." 
                  value={formData.address} 
                  onChange={e => setFormData({...formData, address: e.target.value})} 
                />
              </div>
              <div className="cm-form-group">
                <label>Dòng xe quan tâm</label>
                <select 
                  value={formData.carModel} 
                  onChange={e => setFormData({...formData, carModel: e.target.value})}
                >
                  <option value="">-- Chưa xác định / Chọn dòng xe --</option>
                  {vehicleData?.categories?.map((cat) => (
                    <optgroup label={cat.name} key={cat.name}>
                      {cat.variants.map(v => (
                        <option value={`${cat.name} - ${v.name}`} key={`${cat.name}-${v.name}`}>
                          {cat.name} - {v.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="cm-form-group">
                <label>Loại Biển Số</label>
                <select 
                  value={formData.plateType} 
                  onChange={e => setFormData({...formData, plateType: e.target.value})}
                >
                  <option value="white">Biển Trắng (Cá nhân / Công ty)</option>
                  <option value="yellow">Biển Vàng (Kinh doanh dịch vụ)</option>
                </select>
              </div>
              <div className="cm-form-group">
                <label>Tình trạng chăm sóc</label>
                <select 
                  value={formData.status} 
                  onChange={e => setFormData({...formData, status: e.target.value})}
                >
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="cm-form-group">
                <label>Ghi chú thêm</label>
                <textarea 
                  rows="2" 
                  placeholder="Nhu cầu khách, ngân sách, màu xe yêu thích..."
                  value={formData.note} 
                  onChange={e => setFormData({...formData, note: e.target.value})}
                ></textarea>
              </div>
              
              <div className="cm-modal-actions">
                <button type="button" className="cm-btn cancel" onClick={() => setIsFormOpen(false)}>Hủy</button>
                <button type="submit" className="cm-btn confirm">Lưu thông tin</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteModal.isOpen && (
        <div className="cm-modal-overlay">
          <div className="cm-modal-content confirmation">
            <h3 className="cm-modal-title">Xóa Khách Hàng</h3>
            <p>Bạn có chắc chắn muốn xóa hồ sơ khách hàng <b>{deleteModal.name}</b> ra khỏi danh sách? Thao tác này không thể hoàn tác.</p>
            <div className="cm-modal-actions">
              <button className="cm-btn cancel" onClick={() => setDeleteModal({ isOpen: false, id: null, name: '' })}>Hủy</button>
              <button className="cm-btn danger" onClick={confirmDelete}>Xóa bỏ</button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {viewModal.isOpen && viewModal.data && (
        <div className="cm-modal-overlay">
          <div className="cm-modal-content detail-view">
            <h3 className="cm-modal-title">Chi Tiết Khách Hàng</h3>
            <div className="cm-detail-grid">
              <div className="detail-item">
                <span className="detail-label">Tên khách hàng:</span>
                <span className="detail-value highlight">{viewModal.data.name}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Số điện thoại:</span>
                <span className="detail-value">{viewModal.data.phone || 'Chưa cập nhật'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Ngày phát sinh:</span>
                <span className="detail-value">{new Date(viewModal.data.createdAt).toLocaleDateString('vi-VN')}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Địa chỉ:</span>
                <span className="detail-value">{viewModal.data.address || 'Chưa cập nhật'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Dòng xe:</span>
                <span className="detail-value">{viewModal.data.carModel ? <span className="cm-cell-car">{viewModal.data.carModel.includes(' - ') ? viewModal.data.carModel.split(' - ')[1] : viewModal.data.carModel}</span> : 'Chưa cập nhật'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Loại biển:</span>
                <span className="detail-value">
                  {viewModal.data.plateType === 'yellow' ? 
                   <span className="plate-badge yellow">Biển Vàng</span> : 
                   <span className="plate-badge white">Biển Trắng</span>}
                </span>
              </div>
              <div className="detail-item full-width">
                <span className="detail-label">Tình trạng chăm sóc:</span>
                <span className="detail-value" style={{marginTop: '4px'}}>{getStatusDisplay(viewModal.data.status)}</span>
              </div>
              <div className="detail-item full-width">
                <span className="detail-label">Ghi chú:</span>
                <div className="detail-note-box">
                  {viewModal.data.note || 'Không có ghi chú.'}
                </div>
              </div>
            </div>
            <div className="cm-modal-actions mt-20">
              <button className="cm-btn cancel" onClick={() => setViewModal({ isOpen: false, data: null })}>Đóng cửa sổ</button>
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

export default CustomerManager;
