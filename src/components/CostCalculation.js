import React, { useState, useMemo, useRef } from 'react';
import { toPng, toBlob } from 'html-to-image';
import { useVehicleData } from '../context/VehicleDataContext';
import './CostCalculation.css';

const formatCurrency = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '0';
  return Number(value).toLocaleString('vi-VN');
};

const parseCurrency = (str) => {
  if (!str) return 0;
  return parseInt(String(str).replace(/[,.]/g, ''), 10) || 0;
};

function CostCalculation() {
  const { vehicleData } = useVehicleData();
  const [selectedCategory, setSelectedCategory] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState(0);
  const [plateType, setPlateType] = useState('white');
  // Phí trước bạ: null = lấy từ config, 'percent'/'manual' = user override trên bảng giá
  const [regTaxModeOverride, setRegTaxModeOverride] = useState(null);
  const [regTaxManualOverride, setRegTaxManualOverride] = useState(null);
  // Khuyến mãi — mặc định lấy từ config, user có thể đổi trên bảng giá
  const [discountMMVOverride, setDiscountMMVOverride] = useState(null);
  const [discountDealerOverride, setDiscountDealerOverride] = useState(null);
  const [accessories, setAccessories] = useState('');
  const getTodayDateString = () => {
    const d = new Date();
    const month = `${d.getMonth() + 1}`.padStart(2, '0');
    const day = `${d.getDate()}`.padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
  };

  const [accessoriesCost, setAccessoriesCost] = useState(0);
  const [color, setColor] = useState('');
  const [quoteDate, setQuoteDate] = useState(getTodayDateString());
  const [showQuote, setShowQuote] = useState(false);
  const quoteRef = useRef(null);
  
  // TOAST State
  const [toast, setToast] = useState(null);
  const toastTimeoutRef = useRef(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 4000);
  };
  // Toggles & Overrides cho các loại phí
  const [feeToggles, setFeeToggles] = useState({
    tax: true, plate: true, inspection: true, road: true, service: true, tnds: true, body: true
  });
  const [feeOverrides, setFeeOverrides] = useState({
    plate: null, inspection: null, road: null, service: null, tnds: null, body: null
  });

  const handleFeeToggle = (field, checked) => setFeeToggles(p => ({ ...p, [field]: checked }));
  const handleFeeOverride = (field, valStr) => {
    if (String(valStr).trim() === '') setFeeOverrides(p => ({ ...p, [field]: null }));
    else setFeeOverrides(p => ({ ...p, [field]: parseCurrency(valStr) }));
  };

  const handleExportImage = async () => {
    if (!quoteRef.current) return;
    try {
      await new Promise(r => setTimeout(r, 100));
      const dataUrl = await toPng(quoteRef.current, { backgroundColor: '#ffffff', pixelRatio: 2 });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `Bao_gia_${variant?.name ? String(variant.name).replace(/\s+/g, '_') : 'xe'}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast("Đã tải ảnh về máy thành công!", "success");
    } catch (err) {
      console.error("Lỗi xuất ảnh:", err);
      showToast("Lỗi xuất ảnh: " + (err.message || "Vui lòng thử lại!"), "error");
    }
  };

  const handleCopyToClipboard = async () => {
    if (!quoteRef.current) return;
    
    if (!navigator.clipboard || typeof window.ClipboardItem === 'undefined') {
      showToast("Trình duyệt không hỗ trợ tính năng copy ảnh. Vui lòng bấm 'Tải xuống Ảnh' nhé!", "error");
      return;
    }

    try {
      const p = toBlob(quoteRef.current, { backgroundColor: '#ffffff', pixelRatio: 2 });

      await navigator.clipboard.write([
        new window.ClipboardItem({
          'image/png': p
        })
      ]);
      
      showToast('Đã copy hình báo giá! Hãy mở Zalo và dán (Paste) để gửi.', 'success');
    } catch (err) {
      console.error("Lỗi copy clipboard:", err);
      // Fallback
      try {
        const blob = await toBlob(quoteRef.current, { backgroundColor: '#ffffff', pixelRatio: 2 });
        if (!blob) throw new Error("Blank blob returned");
        const item = new window.ClipboardItem({ 'image/png': blob });
        await navigator.clipboard.write([item]);
        showToast('Đã copy hình báo giá thành công!', 'success');
      } catch (fallbackErr) {
        console.error("Lỗi fallback copy:", fallbackErr);
        showToast("Trình duyệt cấm copy tự động. Vui lòng chọn 'Tải xuống Ảnh' thay thế!", "error");
      }
    }
  };

  const category = vehicleData.categories[selectedCategory];
  const variant = category?.variants[selectedVariant];
  const cfg = variant?.config || {};

  // Resolve tax mode: override > config > default
  const regTaxMode = regTaxModeOverride || cfg.registrationTaxMode || 'percent';
  const regTaxManual = regTaxManualOverride !== null ? regTaxManualOverride : (cfg.registrationTaxValue || 0);

  // Khi đổi xe, reset tất cả override
  const handleSelectCategory = (idx) => {
    setSelectedCategory(idx);
    setSelectedVariant(0);
    setRegTaxModeOverride(null);
    setRegTaxManualOverride(null);
    setDiscountMMVOverride(null);
    setDiscountDealerOverride(null);
    setFeeToggles({ tax: true, plate: true, inspection: true, road: true, service: true, tnds: true, body: true });
    setFeeOverrides({ plate: null, inspection: null, road: null, service: null, tnds: null, body: null });
  };

  const handleSelectVariant = (idx) => {
    setSelectedVariant(idx);
    setRegTaxModeOverride(null);
    setRegTaxManualOverride(null);
    setDiscountMMVOverride(null);
    setDiscountDealerOverride(null);
    setFeeToggles({ tax: true, plate: true, inspection: true, road: true, service: true, tnds: true, body: true });
    setFeeOverrides({ plate: null, inspection: null, road: null, service: null, tnds: null, body: null });
  };

  // Discount: nếu user chưa override thì dùng config default theo biển
  const discountMMV = discountMMVOverride !== null 
    ? discountMMVOverride 
    : (typeof cfg.discountMMV === 'object' ? (cfg.discountMMV?.[plateType] || 0) : (cfg.discountMMV || 0));

  const discountDealer = discountDealerOverride !== null 
    ? discountDealerOverride 
    : (typeof cfg.discountDealer === 'object' ? (cfg.discountDealer?.[plateType] || 0) : (cfg.discountDealer || 0));

  const calculations = useMemo(() => {
    if (!variant || !cfg) return null;

    const retailPrice = variant.price;
    const registrationTaxRate = (cfg.registrationTaxRate || 10) / 100;
    const registrationTaxAuto = Math.round(retailPrice * registrationTaxRate);
    const registrationTax = regTaxMode === 'manual' ? regTaxManual : registrationTaxAuto;
    const registrationPlate = feeOverrides.plate !== null ? feeOverrides.plate : (cfg.registrationPlate || 140000);
    const inspection = feeOverrides.inspection !== null ? feeOverrides.inspection : (cfg.inspection || 90000);
    const roadMaintenance = feeOverrides.road !== null ? feeOverrides.road : (cfg.roadMaintenance?.[plateType] || 1560000);
    const registrationService = feeOverrides.service !== null ? feeOverrides.service : (cfg.registrationService || 2500000);

    const seats = category.seats;
    const tndsInsurance = feeOverrides.tnds !== null ? feeOverrides.tnds : (cfg.tndsInsurance?.[plateType] || 480000);

    const bodyInsuranceRatePct = cfg.bodyInsuranceRate?.[plateType] || 1.3;
    const bodyInsuranceRate = bodyInsuranceRatePct / 100;
    let bodyInsurance = Math.round(
      (retailPrice - variant.audio - discountDealer) * bodyInsuranceRate
    );
    if (feeOverrides.body !== null) bodyInsurance = feeOverrides.body;

    const totalRegistration =
      retailPrice +
      (feeToggles.tax ? registrationTax : 0) +
      (feeToggles.plate ? registrationPlate : 0) +
      (feeToggles.inspection ? inspection : 0) +
      (feeToggles.road ? roadMaintenance : 0) +
      (feeToggles.service ? registrationService : 0) +
      (feeToggles.tnds ? tndsInsurance : 0) +
      (feeToggles.body ? bodyInsurance : 0);

    const totalDiscount = discountMMV + discountDealer;
    const finalPrice = totalRegistration - totalDiscount;
    const finalPriceWithAccessories = finalPrice + accessoriesCost;

    return {
      retailPrice,
      registrationTaxRate,
      registrationTaxAuto,
      registrationTax,
      registrationPlate,
      inspection,
      roadMaintenance,
      registrationService,
      tndsInsurance,
      bodyInsurance,
      bodyInsuranceRatePct,
      totalRegistration,
      totalDiscount,
      finalPrice,
      finalPriceWithAccessories,
      audio: variant.audio,
      seats,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant, cfg, category, plateType, discountMMV, discountDealer, accessoriesCost, regTaxMode, regTaxManual, feeToggles, feeOverrides]);

  return (
    <div className="cost-calc-page">
      {/* Header */}
      <div className="cost-calc-header">
        <div className="header-glow"></div>
        <div className="header-content">
          <div className="logo-area">
            <div className="logo-diamond"><span>★</span></div>
            <div className="header-text">
              <h1>BẢNG TÍNH CHI PHÍ ĐĂNG KÝ XE</h1>
              <p className="subtitle">MITSUBISHI SAVICO QUẢNG NAM</p>
            </div>
          </div>
        </div>
      </div>

      <div className="cost-calc-body">
        {/* LEFT */}
        <div className="panel panel-selection">
          <div className="panel-header"><h2>📋 Chọn Dòng Xe</h2></div>

          <div className="category-tabs">
            {vehicleData.categories.map((cat, idx) => (
              <button
                key={idx}
                className={`tab-btn ${selectedCategory === idx ? 'active' : ''}`}
                onClick={() => handleSelectCategory(idx)}
              >
                {cat.name}
              </button>
            ))}
          </div>

          <div className="variant-list">
            {category?.variants.map((v, idx) => (
              <div
                key={idx}
                className={`variant-card ${selectedVariant === idx ? 'active' : ''}`}
                onClick={() => handleSelectVariant(idx)}
              >
                <div className="variant-info">
                  <span className="variant-name">{v.name}</span>
                  <span className="variant-price">{formatCurrency(v.price)} ₫</span>
                  {(v.config?.discountMMV > 0 || v.config?.discountDealer > 0) && (
                    <span className="variant-promo">
                      KM: {formatCurrency((v.config?.discountMMV || 0) + (v.config?.discountDealer || 0))} ₫
                    </span>
                  )}
                </div>
                <div className="variant-seats">{category.seats} chỗ</div>
              </div>
            ))}
          </div>

          <div className="plate-section">
            <h3>🔖 Loại Biển Số</h3>
            <div className="plate-options">
              <label className={`plate-option ${plateType === 'white' ? 'active' : ''}`}>
                <input type="radio" name="plate" value="white" checked={plateType === 'white'} onChange={() => setPlateType('white')} />
                <div className="plate-visual white-plate"><span>51A - 123.45</span></div>
                <span className="plate-label">Biển Trắng</span>
              </label>
              <label className={`plate-option ${plateType === 'yellow' ? 'active' : ''}`}>
                <input type="radio" name="plate" value="yellow" checked={plateType === 'yellow'} onChange={() => setPlateType('yellow')} />
                <div className="plate-visual yellow-plate"><span>51A - 123.45</span></div>
                <span className="plate-label">Biển Vàng</span>
              </label>
            </div>
          </div>

          <div className="extra-inputs">
            <div className="input-group">
              <label>📅 Ngày Báo Giá</label>
              <input 
                type="date" 
                value={quoteDate} 
                onClick={(e) => {
                  try { if (e.target.showPicker) e.target.showPicker(); } catch(err){}
                }}
                onChange={(e) => setQuoteDate(e.target.value)} 
                style={{colorScheme: 'dark', cursor: 'pointer'}} 
              />
            </div>
            <div className="input-group">
              <label>🎨 Màu Xe</label>
              <input type="text" placeholder="Nhập màu xe..." value={color} onChange={(e) => setColor(e.target.value)} />
            </div>
            <div className="input-group">
              <label>🔧 Phụ Kiện</label>
              <input type="text" placeholder="Tên phụ kiện..." value={accessories} onChange={(e) => setAccessories(e.target.value)} />
            </div>
            <div className="input-group">
              <label>💰 Chi Phí Phụ Kiện</label>
              <input type="text" placeholder="0" value={accessoriesCost ? formatCurrency(accessoriesCost) : ''} onChange={(e) => setAccessoriesCost(parseCurrency(e.target.value))} />
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="panel panel-result">
          <div className="panel-header">
            <h2>💎 Bảng Chi Phí Đăng Ký</h2>
            {variant && (
              <div className="selected-model-badge">
                {variant.name}
                {color && <span className="color-badge">• {color}</span>}
              </div>
            )}
          </div>

          {calculations && (
            <div className="cost-table-wrapper">
              <table className="cost-table">
                <thead>
                  <tr><th>Hạng Mục</th><th>Thành Tiền (VNĐ)</th></tr>
                </thead>
                <tbody>
                  <tr className="row-highlight">
                    <td><div className="item-label"><span className="item-icon">🚗</span>Giá bán lẻ</div></td>
                    <td className="amount amount-highlight">{formatCurrency(calculations.retailPrice)}</td>
                  </tr>
                  <tr>
                    <td colSpan="2" className="reg-tax-cell">
                      <div className="item-label" style={{marginBottom: 8}}>
                        <input type="checkbox" className="fee-toggle-cb" checked={feeToggles.tax} onChange={(e) => handleFeeToggle('tax', e.target.checked)} />
                        <span className="item-icon">📝</span>Phí trước bạ
                      </div>
                      <div className="reg-tax-options" style={{ opacity: feeToggles.tax ? 1 : 0.4, pointerEvents: feeToggles.tax ? 'auto' : 'none' }}>
                        {/* Option 1: Tính theo % */}
                        <label
                          className={`reg-tax-row ${regTaxMode === 'percent' ? 'active' : ''}`}
                          onClick={() => setRegTaxModeOverride('percent')}
                        >
                          <input type="radio" name="regTaxMode" checked={regTaxMode === 'percent'} onChange={() => setRegTaxModeOverride('percent')} />
                          <span className="reg-tax-radio"></span>
                          <span className="reg-tax-label">Tạm tính {calculations.registrationTaxRate * 100}%</span>
                          <span className="reg-tax-value">{formatCurrency(calculations.registrationTaxAuto)}</span>
                        </label>

                        {/* Option 2: Nhập giá */}
                        <label
                          className={`reg-tax-row ${regTaxMode === 'manual' ? 'active' : ''}`}
                          onClick={() => { if (regTaxMode !== 'manual') { setRegTaxModeOverride('manual'); if (regTaxManual <= 0) setRegTaxManualOverride(calculations.registrationTaxAuto); } }}
                        >
                          <input type="radio" name="regTaxMode" checked={regTaxMode === 'manual'} onChange={() => { setRegTaxModeOverride('manual'); }} />
                          <span className="reg-tax-radio"></span>
                          <span className="reg-tax-label">Nhập giá:</span>
                          <input
                            type="text"
                            className={`reg-tax-input ${regTaxMode === 'manual' ? 'active' : ''}`}
                            value={regTaxMode === 'manual' ? (regTaxManual ? formatCurrency(regTaxManual) : '') : ''}
                            placeholder={formatCurrency(calculations.registrationTaxAuto)}
                            disabled={regTaxMode !== 'manual'}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setRegTaxManualOverride(parseCurrency(e.target.value))}
                          />
                        </label>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <div className="item-label">
                        <input type="checkbox" className="fee-toggle-cb" checked={feeToggles.plate} onChange={(e) => handleFeeToggle('plate', e.target.checked)} />
                        <span className="item-icon">🪪</span>Phí đăng ký biển số
                      </div>
                    </td>
                    <td className="amount discount-input-cell">
                      <input type="text" className="fee-input" value={feeOverrides.plate !== null ? formatCurrency(feeOverrides.plate) : formatCurrency(calculations.registrationPlate)} onChange={(e) => handleFeeOverride('plate', e.target.value)} disabled={!feeToggles.plate} />
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <div className="item-label">
                        <input type="checkbox" className="fee-toggle-cb" checked={feeToggles.inspection} onChange={(e) => handleFeeToggle('inspection', e.target.checked)} />
                        <span className="item-icon">🔍</span>Phí đăng kiểm xe
                      </div>
                    </td>
                    <td className="amount discount-input-cell">
                      <input type="text" className="fee-input" value={feeOverrides.inspection !== null ? formatCurrency(feeOverrides.inspection) : formatCurrency(calculations.inspection)} onChange={(e) => handleFeeOverride('inspection', e.target.value)} disabled={!feeToggles.inspection} />
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <div className="item-label">
                        <input type="checkbox" className="fee-toggle-cb" checked={feeToggles.road} onChange={(e) => handleFeeToggle('road', e.target.checked)} />
                        <span className="item-icon">🛣️</span>Phí bảo trì đường bộ
                        <span className="tag tag-plate">{plateType === 'white' ? 'Biển trắng' : 'Biển vàng'}</span>
                      </div>
                    </td>
                    <td className="amount discount-input-cell">
                      <input type="text" className="fee-input" value={feeOverrides.road !== null ? formatCurrency(feeOverrides.road) : formatCurrency(calculations.roadMaintenance)} onChange={(e) => handleFeeOverride('road', e.target.value)} disabled={!feeToggles.road} />
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <div className="item-label">
                        <input type="checkbox" className="fee-toggle-cb" checked={feeToggles.service} onChange={(e) => handleFeeToggle('service', e.target.checked)} />
                        <span className="item-icon">📦</span>Dịch vụ đăng ký xe
                      </div>
                    </td>
                    <td className="amount discount-input-cell">
                      <input type="text" className="fee-input" value={feeOverrides.service !== null ? formatCurrency(feeOverrides.service) : formatCurrency(calculations.registrationService)} onChange={(e) => handleFeeOverride('service', e.target.value)} disabled={!feeToggles.service} />
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <div className="item-label">
                        <input type="checkbox" className="fee-toggle-cb" checked={feeToggles.tnds} onChange={(e) => handleFeeToggle('tnds', e.target.checked)} />
                        <span className="item-icon">🛡️</span>Bảo hiểm TNDS
                        <span className="tag tag-seats">{calculations.seats} chỗ</span>
                        <span className="tag tag-plate">{plateType === 'white' ? 'Biển trắng' : 'Biển vàng'}</span>
                      </div>
                    </td>
                    <td className="amount discount-input-cell">
                      <input type="text" className="fee-input" value={feeOverrides.tnds !== null ? formatCurrency(feeOverrides.tnds) : formatCurrency(calculations.tndsInsurance)} onChange={(e) => handleFeeOverride('tnds', e.target.value)} disabled={!feeToggles.tnds} />
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <div className="item-label">
                        <input type="checkbox" className="fee-toggle-cb" checked={feeToggles.body} onChange={(e) => handleFeeToggle('body', e.target.checked)} />
                        <span className="item-icon">🔰</span>Bảo hiểm thân vỏ
                        <span className="tag tag-percent">{calculations.bodyInsuranceRatePct}%</span>
                      </div>
                      {calculations.audio > 0 && (
                        <div className="item-note">
                          Trừ đầu audio: {formatCurrency(calculations.audio)} ₫
                          {discountDealer > 0 && ` | Trừ KM đại lý: ${formatCurrency(discountDealer)} ₫`}
                        </div>
                      )}
                      {calculations.audio === 0 && discountDealer > 0 && (
                        <div className="item-note">Trừ KM đại lý: {formatCurrency(discountDealer)} ₫</div>
                      )}
                    </td>
                    <td className="amount discount-input-cell">
                      <input type="text" className="fee-input" value={feeOverrides.body !== null ? formatCurrency(feeOverrides.body) : formatCurrency(calculations.bodyInsurance)} onChange={(e) => handleFeeOverride('body', e.target.value)} disabled={!feeToggles.body} />
                    </td>
                  </tr>

                  {/* TỔNG */}
                  <tr className="row-total">
                    <td><div className="item-label total-label"><span className="item-icon">📊</span>TỔNG CHI PHÍ ĐĂNG KÝ</div></td>
                    <td className="amount total-amount">{formatCurrency(calculations.totalRegistration)}</td>
                  </tr>

                  {/* Khuyến mãi — nhập tay, mặc định từ config */}
                  <tr className="row-discount">
                    <td><div className="item-label"><span className="item-icon">🎁</span>Khuyến mãi MMV</div></td>
                    <td className="amount discount-input-cell">
                      <input
                        type="text"
                        className="discount-input"
                        placeholder="0"
                        value={discountMMV ? formatCurrency(discountMMV) : ''}
                        onChange={(e) => setDiscountMMVOverride(parseCurrency(e.target.value))}
                      />
                    </td>
                  </tr>
                  <tr className="row-discount">
                    <td><div className="item-label"><span className="item-icon">🏷️</span>Khuyến mãi đại lý</div></td>
                    <td className="amount discount-input-cell">
                      <input
                        type="text"
                        className="discount-input"
                        placeholder="0"
                        value={discountDealer ? formatCurrency(discountDealer) : ''}
                        onChange={(e) => setDiscountDealerOverride(parseCurrency(e.target.value))}
                      />
                    </td>
                  </tr>

                  {calculations.totalDiscount > 0 && (
                    <tr className="row-discount-total">
                      <td><div className="item-label"><span className="item-icon">✨</span>Tổng khuyến mãi</div></td>
                      <td className="amount discount-amount">- {formatCurrency(calculations.totalDiscount)}</td>
                    </tr>
                  )}

                  {accessoriesCost > 0 && (
                    <tr>
                      <td><div className="item-label"><span className="item-icon">🔧</span>Phụ kiện: {accessories || 'Khác'}</div></td>
                      <td className="amount">{formatCurrency(accessoriesCost)}</td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="row-final">
                    <td><div className="item-label final-label"><span className="item-icon">🏆</span>GIÁ XE RA BIỂN SỐ</div></td>
                    <td className="amount final-amount">
                      {formatCurrency(accessoriesCost > 0 ? calculations.finalPriceWithAccessories : calculations.finalPrice)} ₫
                    </td>
                  </tr>
                </tfoot>
              </table>
              
              <div className="quote-action-area">
                <button className="quote-btn" onClick={() => setShowQuote(true)}>
                  <span className="quote-icon">📄</span> BÁO GIÁ KHÁCH HÀNG
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* QUOTE MODAL */}
      {showQuote && calculations && (
        <div className="quote-modal-overlay" onClick={() => setShowQuote(false)}>
          <div className="quote-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="quote-close-btn" onClick={() => setShowQuote(false)}>×</button>
            <div className="quote-print-area" ref={quoteRef}>
              <div className="quote-modal-header">
                <h2>BẢNG BÁO GIÁ ĐĂNG KÝ XE</h2>
                <div className="quote-modal-subtitle">MITSUBISHI SAVICO QUẢNG NAM</div>
                <div className="quote-modal-date">Ngày báo giá: {new Date(quoteDate).toLocaleDateString('vi-VN')}</div>
              </div>
              
              <div className="quote-modal-car-info">
                <div className="quote-car-name">{variant.name}</div>
                {color && <div className="quote-car-color">Màu: {color}</div>}
              </div>

              <table className="quote-simple-table">
                <tbody>
                  <tr>
                    <td>Giá bán lẻ</td>
                    <td className="amount">{formatCurrency(calculations.retailPrice)} ₫</td>
                  </tr>
                  {feeToggles.tax && (
                    <tr>
                      <td>Phí trước bạ</td>
                      <td className="amount">{formatCurrency(calculations.registrationTax)} ₫</td>
                    </tr>
                  )}
                  {feeToggles.plate && (
                    <tr>
                      <td>Phí đăng ký biển số</td>
                      <td className="amount">{formatCurrency(calculations.registrationPlate)} ₫</td>
                    </tr>
                  )}
                  {feeToggles.inspection && (
                    <tr>
                      <td>Phí đăng kiểm xe</td>
                      <td className="amount">{formatCurrency(calculations.inspection)} ₫</td>
                    </tr>
                  )}
                  {feeToggles.road && (
                    <tr>
                      <td>Phí bảo trì đường bộ ({plateType === 'white' ? 'Biển trắng' : 'Biển vàng'})</td>
                      <td className="amount">{formatCurrency(calculations.roadMaintenance)} ₫</td>
                    </tr>
                  )}
                  {feeToggles.service && (
                    <tr>
                      <td>Dịch vụ đăng ký xe</td>
                      <td className="amount">{formatCurrency(calculations.registrationService)} ₫</td>
                    </tr>
                  )}
                  {feeToggles.tnds && (
                    <tr>
                      <td>Bảo hiểm TNDS ({calculations.seats} chỗ)</td>
                      <td className="amount">{formatCurrency(calculations.tndsInsurance)} ₫</td>
                    </tr>
                  )}
                  {feeToggles.body && (
                    <tr>
                      <td>Bảo hiểm thân vỏ ({calculations.bodyInsuranceRatePct}%)</td>
                      <td className="amount">{formatCurrency(calculations.bodyInsurance)} ₫</td>
                    </tr>
                  )}
                  {accessoriesCost > 0 && (
                    <tr>
                      <td>Phụ kiện: {accessories || 'Khác'}</td>
                      <td className="amount">{formatCurrency(accessoriesCost)} ₫</td>
                    </tr>
                  )}
                  <tr>
                    <td style={{ fontWeight: 'bold' }}>TỔNG CHI PHÍ ĐĂNG KÝ</td>
                    <td className="amount" style={{ fontWeight: 'bold' }}>{formatCurrency(calculations.totalRegistration)} ₫</td>
                  </tr>

                  {(discountMMV > 0) && (
                    <tr className="quote-discount-row">
                      <td>Khuyến mãi MMV</td>
                      <td className="amount">- {formatCurrency(discountMMV)} ₫</td>
                    </tr>
                  )}
                  
                  {(discountDealer > 0) && (
                    <tr className="quote-discount-row">
                      <td>Khuyến mãi Đại lý</td>
                      <td className="amount">- {formatCurrency(discountDealer)} ₫</td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td>GIÁ XE RA BIỂN SỐ</td>
                    <td className="amount quote-final-price">
                      {formatCurrency(accessoriesCost > 0 ? calculations.finalPriceWithAccessories : calculations.finalPrice)} ₫
                    </td>
                  </tr>
                </tfoot>
              </table>
              {/* <div className="quote-footer-note">
                <p><i>* Bảng tính mang tính chất tham khảo, vui lòng liên hệ đại lý đê biết thêm chi tiết.</i></p>
              </div> */}
            </div>
            <div className="quote-actions-row">
              <button className="quote-export-btn" onClick={handleExportImage}>
                <span className="icon">⬇️</span> Tải xuống Ảnh
              </button>
              <button className="quote-zalo-btn" onClick={handleCopyToClipboard}>
                <span className="icon">📋</span> Copy gửi Zalo
              </button>
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

export default CostCalculation;
