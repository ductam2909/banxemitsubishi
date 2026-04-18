import React, { useState, useEffect, useCallback } from 'react';
import { useVehicleData } from '../context/VehicleDataContext';
import { createDefaultConfig } from '../data/vehicleData';
import './VehicleConfig.css';

const fmt = (v) => {
  if (v === null || v === undefined || isNaN(v)) return '0';
  return Number(v).toLocaleString('vi-VN');
};
const parse = (str) => {
  if (!str) return 0;
  return parseInt(String(str).replace(/[,.]/g, ''), 10) || 0;
};
const clone = (o) => JSON.parse(JSON.stringify(o));

function VehicleConfig() {
  const { vehicleData, saveData, resetToDefault } = useVehicleData();

  const [draft, setDraft] = useState(() => clone(vehicleData));
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setDraft(clone(vehicleData));
    setHasChanges(false);
  }, [vehicleData]);

  const updateDraft = useCallback((updater) => {
    setDraft((prev) => {
      const next = typeof updater === 'function' ? updater(clone(prev)) : updater;
      return next;
    });
    setHasChanges(true);
  }, []);

  // Toast
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  };

  // Save / Discard
  const handleSave = () => { saveData(draft); setHasChanges(false); showToast('Đã lưu cấu hình!'); };
  const handleDiscard = () => { setDraft(clone(vehicleData)); setHasChanges(false); showToast('Đã hủy thay đổi', 'info'); };

  // Reset confirm
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const handleReset = () => { resetToDefault(); setShowResetConfirm(false); showToast('Đã khôi phục mặc định!', 'info'); };

  // Expanded variant
  const [expandedCat, setExpandedCat] = useState(null);
  const [expandedVar, setExpandedVar] = useState(null);

  // Add modals
  const [showAddCatModal, setShowAddCatModal] = useState(false);
  const [showAddVarModal, setShowAddVarModal] = useState(false);
  const [addToCatIdx, setAddToCatIdx] = useState(null);
  const [newCat, setNewCat] = useState({ name: '', seats: 5 });
  const [newVar, setNewVar] = useState({ name: '', price: '', audio: '' });

  // ===== CATEGORY CRUD =====
  const [editingCat, setEditingCat] = useState(null);
  const [editCatForm, setEditCatForm] = useState({});

  const handleAddCategory = () => {
    if (!newCat.name.trim()) return;
    updateDraft((d) => {
      d.categories.push({ name: newCat.name.trim(), seats: parseInt(newCat.seats, 10) || 5, variants: [] });
      return d;
    });
    setNewCat({ name: '', seats: 5 });
    setShowAddCatModal(false);
    showToast(`Thêm "${newCat.name}" (chưa lưu)`, 'info');
  };

  const deleteCategory = (catIdx) => {
    if (!window.confirm(`Xóa dòng xe "${draft.categories[catIdx].name}" và tất cả phiên bản?`)) return;
    updateDraft((d) => { d.categories.splice(catIdx, 1); return d; });
    setExpandedCat(null);
    showToast('Đã xóa (chưa lưu)', 'warning');
  };

  const startEditCat = (catIdx) => {
    const c = draft.categories[catIdx];
    setEditingCat(catIdx);
    setEditCatForm({ name: c.name, seats: c.seats });
  };

  const saveEditCat = () => {
    if (editingCat === null) return;
    updateDraft((d) => {
      d.categories[editingCat].name = editCatForm.name;
      d.categories[editingCat].seats = parseInt(editCatForm.seats, 10) || 5;
      return d;
    });
    setEditingCat(null);
  };

  // ===== VARIANT CRUD =====
  const handleAddVariant = () => {
    if (!newVar.name.trim() || parse(newVar.price) <= 0) return;
    const cat = draft.categories[addToCatIdx];
    updateDraft((d) => {
      d.categories[addToCatIdx].variants.push({
        name: newVar.name.trim(),
        price: parse(newVar.price),
        audio: parse(newVar.audio),
        config: createDefaultConfig(cat.seats),
      });
      return d;
    });
    setNewVar({ name: '', price: '', audio: '' });
    setShowAddVarModal(false);
    showToast(`Thêm "${newVar.name}" (chưa lưu)`, 'info');
  };

  const deleteVariant = (catIdx, varIdx) => {
    if (!window.confirm(`Xóa "${draft.categories[catIdx].variants[varIdx].name}"?`)) return;
    updateDraft((d) => {
      d.categories[catIdx].variants.splice(varIdx, 1);
      if (d.categories[catIdx].variants.length === 0) d.categories.splice(catIdx, 1);
      return d;
    });
    setExpandedVar(null);
    showToast('Đã xóa (chưa lưu)', 'warning');
  };

  // ===== VARIANT CONFIG FIELD UPDATE =====
  const updateVariantField = (catIdx, varIdx, field, value) => {
    updateDraft((d) => {
      d.categories[catIdx].variants[varIdx][field] = value;
      return d;
    });
  };

  const updateConfigField = (catIdx, varIdx, field, value) => {
    updateDraft((d) => {
      if (!d.categories[catIdx].variants[varIdx].config) {
        d.categories[catIdx].variants[varIdx].config = createDefaultConfig(d.categories[catIdx].seats);
      }
      d.categories[catIdx].variants[varIdx].config[field] = value;
      return d;
    });
  };

  const updateConfigNested = (catIdx, varIdx, field, subField, value) => {
    updateDraft((d) => {
      const variant = d.categories[catIdx].variants[varIdx];
      if (!variant.config) {
        variant.config = createDefaultConfig(d.categories[catIdx].seats);
      }
      
      // Đảm bảo config[field] là một object, nếu là số (dữ liệu cũ) thì chuyển thành object
      if (!variant.config[field] || typeof variant.config[field] !== 'object') {
        variant.config[field] = {};
      }
      
      variant.config[field][subField] = value;
      return d;
    });
  };

  return (
    <div className="config-page">
      {toast && (
        <div className={`config-toast toast-${toast.type}`}>
          <span>{toast.type === 'success' ? '✅' : toast.type === 'warning' ? '⚠️' : 'ℹ️'}</span>
          {toast.message}
        </div>
      )}

      {hasChanges && (
        <div className="save-bar">
          <div className="save-bar-inner">
            <div className="save-bar-info">
              <span className="save-bar-dot"></span>
              <span>Bạn có thay đổi chưa lưu</span>
            </div>
            <div className="save-bar-actions">
              <button className="btn-discard" onClick={handleDiscard}>Hủy Bỏ</button>
              <button className="btn-save-config" onClick={handleSave}>💾 Lưu Cấu Hình</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="config-header">
        <div className="config-header-glow"></div>
        <div className="config-header-content">
          <div className="config-title-area">
            <div className="config-logo"><span>⚙</span></div>
            <div>
              <h1>QUẢN LÝ CẤU HÌNH</h1>
              <p className="config-subtitle">Cấu hình riêng từng phiên bản xe — ấn Lưu để áp dụng</p>
            </div>
          </div>
          <div className="config-header-actions">
            <button className="btn-reset-default" onClick={() => setShowResetConfirm(true)}>↺ Khôi Phục Mặc Định</button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="config-content">
        <div className="config-section-header">
          <h2>Danh Sách Dòng Xe & Phiên Bản</h2>
          <button className="btn-add-new" onClick={() => setShowAddCatModal(true)}>＋ Thêm Dòng Xe</button>
        </div>

        <div className="category-grid">
          {draft.categories.map((cat, catIdx) => (
            <div key={catIdx} className={`config-category-card ${expandedCat === catIdx ? 'expanded' : ''}`}>
              {/* Category Header */}
              <div className="config-cat-header" onClick={() => setExpandedCat(expandedCat === catIdx ? null : catIdx)}>
                <div className="config-cat-info">
                  {editingCat === catIdx ? (
                    <div className="inline-edit-cat" onClick={(e) => e.stopPropagation()}>
                      <input type="text" value={editCatForm.name} onChange={(e) => setEditCatForm({ ...editCatForm, name: e.target.value })} className="edit-input-sm" />
                      <select value={editCatForm.seats} onChange={(e) => setEditCatForm({ ...editCatForm, seats: parseInt(e.target.value, 10) })} className="edit-select-sm">
                        <option value={5}>5 chỗ</option>
                        <option value={7}>7 chỗ</option>
                      </select>
                      <button className="btn-save-sm" onClick={saveEditCat}>✓</button>
                      <button className="btn-cancel-sm" onClick={() => setEditingCat(null)}>✕</button>
                    </div>
                  ) : (
                    <>
                      <h3>{cat.name}</h3>
                      <span className="cat-meta">{cat.seats} chỗ • {cat.variants.length} phiên bản</span>
                    </>
                  )}
                </div>
                <div className="config-cat-actions" onClick={(e) => e.stopPropagation()}>
                  <button className="btn-icon-sm btn-edit" onClick={() => startEditCat(catIdx)} title="Sửa">✏️</button>
                  <button className="btn-icon-sm btn-add-var" onClick={() => { setAddToCatIdx(catIdx); setShowAddVarModal(true); }} title="Thêm phiên bản">＋</button>
                  <button className="btn-icon-sm btn-del" onClick={() => deleteCategory(catIdx)} title="Xóa">🗑️</button>
                  <span className="expand-arrow">{expandedCat === catIdx ? '▲' : '▼'}</span>
                </div>
              </div>

              {/* Variants */}
              {expandedCat === catIdx && (
                <div className="config-variants">
                  {cat.variants.length === 0 && <div className="empty-state">Chưa có phiên bản nào</div>}
                  {cat.variants.map((v, varIdx) => {
                    const isExpanded = expandedVar === `${catIdx}_${varIdx}`;
                    const cfg = v.config || {};

                    return (
                      <div key={varIdx} className={`config-variant-block ${isExpanded ? 'expanded' : ''}`}>
                        {/* Variant Summary Row */}
                        <div className="config-variant-row" onClick={() => setExpandedVar(isExpanded ? null : `${catIdx}_${varIdx}`)}>
                          <div className="variant-display">
                            <span className="var-name">{v.name}</span>
                            <div className="var-details">
                              <span className="var-price">Giá: {fmt(v.price)} ₫</span>
                              <span className="var-audio">Audio: {fmt(v.audio)} ₫</span>
                              {(cfg.discountMMV > 0 || cfg.discountDealer > 0) && (
                                <span className="var-promo">KM: {fmt((cfg.discountMMV || 0) + (cfg.discountDealer || 0))} ₫</span>
                              )}
                            </div>
                          </div>
                          <div className="variant-row-actions" onClick={(e) => e.stopPropagation()}>
                            <button className="btn-icon-sm btn-del" onClick={() => deleteVariant(catIdx, varIdx)}>🗑️</button>
                            <span className="expand-arrow-sm">{isExpanded ? '▲' : '▼'}</span>
                          </div>
                        </div>

                        {/* Variant Config Form */}
                        {isExpanded && (
                          <div className="variant-config-form">
                            <h4>📋 Thông tin cơ bản</h4>
                            <div className="cfg-grid">
                              <div className="cfg-item">
                                <label>Tên phiên bản</label>
                                <input type="text" value={v.name} onChange={(e) => updateVariantField(catIdx, varIdx, 'name', e.target.value)} />
                              </div>
                              <div className="cfg-item">
                                <label>Giá bán lẻ (₫)</label>
                                <input type="text" value={fmt(v.price)} onChange={(e) => updateVariantField(catIdx, varIdx, 'price', parse(e.target.value))} />
                              </div>
                              <div className="cfg-item">
                                <label>Đầu Audio (₫)</label>
                                <input type="text" value={fmt(v.audio)} onChange={(e) => updateVariantField(catIdx, varIdx, 'audio', parse(e.target.value))} />
                              </div>
                            </div>

                            <h4>💰 Phí trước bạ</h4>
                            <div className="cfg-tax-toggle">
                              <label
                                className={`cfg-tax-option ${(cfg.registrationTaxMode || 'percent') === 'percent' ? 'active' : ''}`}
                                onClick={() => updateConfigField(catIdx, varIdx, 'registrationTaxMode', 'percent')}
                              >
                                <input type="radio" checked={(cfg.registrationTaxMode || 'percent') === 'percent'} onChange={() => {}} />
                                <span className="cfg-tax-radio"></span>
                                <span className="cfg-tax-label">Tính theo phần trăm</span>
                                <div className="cfg-tax-input-wrap">
                                  <input
                                    type="text"
                                    className="cfg-tax-input"
                                    value={cfg.registrationTaxRate ?? 10}
                                    disabled={(cfg.registrationTaxMode || 'percent') !== 'percent'}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => { const v2 = parseFloat(e.target.value); if (!isNaN(v2)) updateConfigField(catIdx, varIdx, 'registrationTaxRate', v2); }}
                                  />
                                  <span className="cfg-tax-unit">%</span>
                                </div>
                              </label>

                              <label
                                className={`cfg-tax-option ${cfg.registrationTaxMode === 'manual' ? 'active' : ''}`}
                                onClick={() => {
                                  if (cfg.registrationTaxMode !== 'manual') {
                                    updateConfigField(catIdx, varIdx, 'registrationTaxMode', 'manual');
                                    if (!cfg.registrationTaxValue) {
                                      updateConfigField(catIdx, varIdx, 'registrationTaxValue', Math.round(v.price * (cfg.registrationTaxRate || 10) / 100));
                                    }
                                  }
                                }}
                              >
                                <input type="radio" checked={cfg.registrationTaxMode === 'manual'} onChange={() => {}} />
                                <span className="cfg-tax-radio"></span>
                                <span className="cfg-tax-label">Nhập giá cố định</span>
                                <div className="cfg-tax-input-wrap">
                                  <input
                                    type="text"
                                    className="cfg-tax-input cfg-tax-input-wide"
                                    value={cfg.registrationTaxMode === 'manual' ? fmt(cfg.registrationTaxValue) : ''}
                                    placeholder={fmt(Math.round(v.price * (cfg.registrationTaxRate || 10) / 100))}
                                    disabled={cfg.registrationTaxMode !== 'manual'}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => updateConfigField(catIdx, varIdx, 'registrationTaxValue', parse(e.target.value))}
                                  />
                                  <span className="cfg-tax-unit">₫</span>
                                </div>
                              </label>
                            </div>

                            <h4>📋 Phí đăng ký khác</h4>
                            <div className="cfg-grid">
                              <div className="cfg-item">
                                <label>Phí đăng ký biển số (₫)</label>
                                <input type="text" value={fmt(cfg.registrationPlate)} onChange={(e) => updateConfigField(catIdx, varIdx, 'registrationPlate', parse(e.target.value))} />
                              </div>
                              <div className="cfg-item">
                                <label>Phí đăng kiểm xe (₫)</label>
                                <input type="text" value={fmt(cfg.inspection)} onChange={(e) => updateConfigField(catIdx, varIdx, 'inspection', parse(e.target.value))} />
                              </div>
                              <div className="cfg-item">
                                <label>Dịch vụ đăng ký xe (₫)</label>
                                <input type="text" value={fmt(cfg.registrationService)} onChange={(e) => updateConfigField(catIdx, varIdx, 'registrationService', parse(e.target.value))} />
                              </div>
                            </div>

                            <h4>🛣️ Phí bảo trì đường bộ</h4>
                            <div className="cfg-grid">
                              <div className="cfg-item">
                                <label>Biển Trắng (₫)</label>
                                <input type="text" value={fmt(cfg.roadMaintenance?.white)} onChange={(e) => updateConfigNested(catIdx, varIdx, 'roadMaintenance', 'white', parse(e.target.value))} />
                              </div>
                              <div className="cfg-item">
                                <label>Biển Vàng (₫)</label>
                                <input type="text" value={fmt(cfg.roadMaintenance?.yellow)} onChange={(e) => updateConfigNested(catIdx, varIdx, 'roadMaintenance', 'yellow', parse(e.target.value))} />
                              </div>
                            </div>

                            <h4>🛡️ Bảo hiểm TNDS</h4>
                            <div className="cfg-grid">
                              <div className="cfg-item">
                                <label>Biển Trắng (₫)</label>
                                <input type="text" value={fmt(cfg.tndsInsurance?.white)} onChange={(e) => updateConfigNested(catIdx, varIdx, 'tndsInsurance', 'white', parse(e.target.value))} />
                              </div>
                              <div className="cfg-item">
                                <label>Biển Vàng (₫)</label>
                                <input type="text" value={fmt(cfg.tndsInsurance?.yellow)} onChange={(e) => updateConfigNested(catIdx, varIdx, 'tndsInsurance', 'yellow', parse(e.target.value))} />
                              </div>
                            </div>

                            <h4>🔰 Bảo hiểm thân vỏ</h4>
                            <div className="cfg-grid">
                              <div className="cfg-item">
                                <label>Biển Trắng (%)</label>
                                <input type="text" value={cfg.bodyInsuranceRate?.white ?? 1.3} onChange={(e) => { const v2 = parseFloat(e.target.value); if (!isNaN(v2)) updateConfigNested(catIdx, varIdx, 'bodyInsuranceRate', 'white', v2); }} />
                              </div>
                              <div className="cfg-item">
                                <label>Biển Vàng (%)</label>
                                <input type="text" value={cfg.bodyInsuranceRate?.yellow ?? 1.7} onChange={(e) => { const v2 = parseFloat(e.target.value); if (!isNaN(v2)) updateConfigNested(catIdx, varIdx, 'bodyInsuranceRate', 'yellow', v2); }} />
                              </div>
                            </div>

                            <h4>🎁 Khuyến mãi MMV</h4>
                            <div className="cfg-grid">
                              <div className="cfg-item">
                                <label>Biển Trắng (₫)</label>
                                <input 
                                  type="text" 
                                  value={fmt(cfg.discountMMV?.white || 0)} 
                                  onChange={(e) => updateConfigNested(catIdx, varIdx, 'discountMMV', 'white', parse(e.target.value))} 
                                />
                              </div>
                              <div className="cfg-item">
                                <label>Biển Vàng (₫)</label>
                                <input 
                                  type="text" 
                                  value={fmt(cfg.discountMMV?.yellow || 0)} 
                                  onChange={(e) => updateConfigNested(catIdx, varIdx, 'discountMMV', 'yellow', parse(e.target.value))} 
                                />
                              </div>
                            </div>

                            <h4>🏷️ Khuyến mãi Đại lý</h4>
                            <div className="cfg-grid">
                              <div className="cfg-item">
                                <label>Biển Trắng (₫)</label>
                                <input 
                                  type="text" 
                                  value={fmt(cfg.discountDealer?.white || 0)} 
                                  onChange={(e) => updateConfigNested(catIdx, varIdx, 'discountDealer', 'white', parse(e.target.value))} 
                                />
                              </div>
                              <div className="cfg-item">
                                <label>Biển Vàng (₫)</label>
                                <input 
                                  type="text" 
                                  value={fmt(cfg.discountDealer?.yellow || 0)} 
                                  onChange={(e) => updateConfigNested(catIdx, varIdx, 'discountDealer', 'yellow', parse(e.target.value))} 
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* MODAL: Thêm dòng xe */}
      {showAddCatModal && (
        <div className="cfg-modal-overlay" onClick={() => setShowAddCatModal(false)}>
          <div className="cfg-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cfg-modal-header">
              <h2>Thêm Dòng Xe Mới</h2>
              <button className="cfg-modal-close" onClick={() => setShowAddCatModal(false)}>✕</button>
            </div>
            <div className="cfg-modal-body">
              <div className="cfg-field"><label>Tên dòng xe</label><input type="text" placeholder="VD: Outlander" value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} /></div>
              <div className="cfg-field"><label>Số chỗ ngồi</label>
                <select value={newCat.seats} onChange={(e) => setNewCat({ ...newCat, seats: e.target.value })}><option value={5}>5 chỗ</option><option value={7}>7 chỗ</option></select>
              </div>
            </div>
            <div className="cfg-modal-footer">
              <button className="btn-cfg-cancel" onClick={() => setShowAddCatModal(false)}>Hủy</button>
              <button className="btn-cfg-confirm" onClick={handleAddCategory}>Thêm</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Thêm phiên bản */}
      {showAddVarModal && (
        <div className="cfg-modal-overlay" onClick={() => setShowAddVarModal(false)}>
          <div className="cfg-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cfg-modal-header">
              <h2>Thêm Phiên Bản — {addToCatIdx !== null && draft.categories[addToCatIdx]?.name}</h2>
              <button className="cfg-modal-close" onClick={() => setShowAddVarModal(false)}>✕</button>
            </div>
            <div className="cfg-modal-body">
              <div className="cfg-field"><label>Tên phiên bản</label><input type="text" placeholder="VD: Xpander AT ECO" value={newVar.name} onChange={(e) => setNewVar({ ...newVar, name: e.target.value })} /></div>
              <div className="cfg-field"><label>Giá bán lẻ (₫)</label><input type="text" placeholder="599000000" value={newVar.price} onChange={(e) => setNewVar({ ...newVar, price: e.target.value })} /></div>
              <div className="cfg-field"><label>Đầu Audio (₫)</label><input type="text" placeholder="0" value={newVar.audio} onChange={(e) => setNewVar({ ...newVar, audio: e.target.value })} /></div>
            </div>
            <div className="cfg-modal-footer">
              <button className="btn-cfg-cancel" onClick={() => setShowAddVarModal(false)}>Hủy</button>
              <button className="btn-cfg-confirm" onClick={handleAddVariant}>Thêm</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Xác nhận reset */}
      {showResetConfirm && (
        <div className="cfg-modal-overlay" onClick={() => setShowResetConfirm(false)}>
          <div className="cfg-modal cfg-modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="cfg-modal-header cfg-modal-header-warning">
              <h2>⚠️ Xác Nhận Khôi Phục</h2>
              <button className="cfg-modal-close" onClick={() => setShowResetConfirm(false)}>✕</button>
            </div>
            <div className="cfg-modal-body">
              <p className="reset-warning-text">Tất cả cấu hình sẽ bị xóa và khôi phục về giá trị mặc định. Hành động này không thể hoàn tác.</p>
            </div>
            <div className="cfg-modal-footer">
              <button className="btn-cfg-cancel" onClick={() => setShowResetConfirm(false)}>Hủy</button>
              <button className="btn-cfg-danger" onClick={handleReset}>Khôi Phục</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default VehicleConfig;
