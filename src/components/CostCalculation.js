import React, { useState, useMemo, useRef, useCallback } from 'react';
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

// Component input tiền tệ: giữ nguyên text thô khi đang gõ, chỉ format khi blur
function CurrencyInput({ value, onChange, placeholder, disabled, className, style, onClick }) {
  const [isFocused, setIsFocused] = useState(false);
  const [rawText, setRawText] = useState('');

  const handleFocus = useCallback((e) => {
    setIsFocused(true);
    // Khi focus, hiển thị số thuần (không dấu chấm) để dễ chỉnh sửa
    const numVal = parseCurrency(e.target.value);
    setRawText(numVal > 0 ? String(numVal) : '');
  }, []);

  const handleChange = useCallback((e) => {
    // Chỉ cho phép nhập số
    const cleaned = e.target.value.replace(/[^0-9]/g, '');
    setRawText(cleaned);
    onChange(parseCurrency(cleaned));
  }, [onChange]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
  }, []);

  // Khi đang focus: hiện text thô (số thuần), khi blur: hiện đã format
  const displayValue = isFocused
    ? rawText
    : (value ? formatCurrency(value) : '');

  return (
    <input
      type="text"
      inputMode="numeric"
      className={className}
      style={style}
      value={displayValue}
      placeholder={placeholder || '0'}
      disabled={disabled}
      onClick={onClick}
      onFocus={handleFocus}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
}

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

  // AI State
  const [showAIModal, setShowAIModal] = useState(false);
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [aiCustomerName, setAiCustomerName] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiMessage, setAiMessage] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

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

  const handleGenerateAI = async () => {
    setIsGeneratingAI(true);
    setAiMessage('');
    
    try {
      const vName = variant?.name;
      const rPrice = formatCurrency(calculations?.retailPrice);
      const total = formatCurrency(accessoriesCost > 0 ? calculations?.finalPriceWithAccessories : calculations?.finalPrice);
      const km = formatCurrency(discountMMV + discountDealer);
      
      if (!geminiKey) {
        // Fallback Simulated AI
        await new Promise(r => setTimeout(r, 1200));
        let simulatedMessage = `Dạ chào ${aiCustomerName || 'anh/chị'}, em là chuyên viên tư vấn bên Mitsubishi Savico Quảng Nam ạ. 😊\n\n`;
        
        if (aiPrompt.trim() !== '') {
          simulatedMessage += `Dạ bộ phận AI hiện đang chạy ở chế độ Offline (chưa có kết nối API Key) nên em xin gửi trước form báo giá tiêu chuẩn. Để AI có thể phân tích đoạn chat "${aiPrompt.substring(0, 30)}..." của anh/chị, phiền anh/chị nhờ bộ phận kĩ thuật cấu hình API Key nhé!\n\n`;
        }

        simulatedMessage += `Gửi ${aiCustomerName || 'anh/chị'} tham khảo chi tiết báo giá lăn bánh của dòng xe 🚗 *${vName}* ${color ? `(màu ${color})` : ''} đang vô cùng hot bên em nhé:\n\n`;
        simulatedMessage += `💵 Giá niêm yết: ${rPrice} VNĐ\n💰 Tổng chi phí lăn bánh (đã gồm thuế phí & bảo hiểm thân vỏ): ${total} VNĐ\n🎁 Khuyến mãi cực khủng: Giảm tiền mặt ngay ${km} VNĐ (đã trừ vào giá lăn bánh ở trên rồi ạ).\n${accessoriesCost > 0 ? `🔧 Tặng / Lắp đặt kèm phụ kiện: ${accessories} trị giá ${formatCurrency(accessoriesCost)} VNĐ.\n` : ''}\nXe bên em hiện đang có sẵn giao ngay, hỗ trợ trả góp lãi suất cực ưu đãi. \n${aiCustomerName || 'Anh/chị'} sắp xếp rảnh chiều nay hay sáng mai qua showroom bên em xem xe thực tế và lái thử luôn ạ? 📞 Cần hỗ trợ gì thêm ${aiCustomerName || 'anh/chị'} cứ nhắn em nhé!`;
        setAiMessage(simulatedMessage);
        setIsGeneratingAI(false);
        return;
      }
      
      if (!geminiKey.startsWith('sk-or-')) {
        // Old Gemini key or invalid format — clear and warn
        localStorage.removeItem('gemini_api_key');
        setGeminiKey('');
        throw new Error('API Key không đúng định dạng OpenRouter. Vui lòng vào ⚙️ Cài đặt và tạo key mới tại openrouter.ai/keys (bắt đầu bằng sk-or-...)');
      }

      localStorage.setItem('gemini_api_key', geminiKey);
      
      const promptText = `Bạn là một chuyên viên tư vấn bán xe ô tô Mitsubishi xuất sắc. 
Hãy viết một tin nhắn Zalo thật chuyên nghiệp, thân thiện và thuyết phục để gửi cho khách hàng${aiCustomerName ? ` tên là ${aiCustomerName}` : ''}.
Mục đích: Gửi báo giá chi tiết lăn bánh xe.
Thông tin chi tiết xe:
- Dòng xe: ${vName} ${color ? `(Màu sắc: ${color})` : ''}
- Giá niêm yết: ${rPrice} VNĐ
- Tổng giá lăn bánh (đã bao gồm các loại phí và bảo hiểm): ${total} VNĐ
- Khuyến mãi tiền mặt đang áp dụng: ${km} VNĐ (Đã trừ trực tiếp vào giá lăn bánh)
${accessoriesCost > 0 ? `- Có tặng kèm/lắp thêm phụ kiện: ${accessories} (Trị giá ${formatCurrency(accessoriesCost)} VNĐ)` : ''}
${aiPrompt.trim() ? `\nYêu cầu / Câu hỏi từ khách: ${aiPrompt}` : ''}

Yêu cầu:
- Trình bày dạng tin nhắn Zalo, có sử dụng các emoji phù hợp (🚗, 🎁, 💰, 📞...).
- Nội dung ngắn gọn, súc tích, dễ đọc, khoảng cách dòng hợp lý.
- Kêu gọi hành động rõ ràng (VD: Mời anh/chị qua showroom xem xe, lái thử, hoặc chốt cọc để nhận thêm ưu đãi).
- Không được bịa đặt các thông tin không có.
- Trả lời bằng tiếng Việt.`;

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${geminiKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Mitsubishi Savico BaoGia'
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.3-70b-instruct:free',
          messages: [{ role: 'user', content: promptText }]
        })
      });
      const data = await res.json();
      if (data.error) {
        const msg = data.error.message || JSON.stringify(data.error);
        throw new Error(msg);
      }
      
      const msg = data.choices[0].message.content;
      setAiMessage(msg);
    } catch (err) {
      console.error(err);
      showToast("Lỗi tạo tin nhắn: " + err.message, "error");
    } finally {
      setIsGeneratingAI(false);
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
              <CurrencyInput value={accessoriesCost} onChange={setAccessoriesCost} placeholder="0" />
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
                          <CurrencyInput
                            className={`reg-tax-input ${regTaxMode === 'manual' ? 'active' : ''}`}
                            value={regTaxMode === 'manual' ? regTaxManual : 0}
                            placeholder={formatCurrency(calculations.registrationTaxAuto)}
                            disabled={regTaxMode !== 'manual'}
                            onClick={(e) => e.stopPropagation()}
                            onChange={setRegTaxManualOverride}
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
                      <CurrencyInput className="fee-input" value={feeOverrides.plate !== null ? feeOverrides.plate : calculations.registrationPlate} onChange={(v) => setFeeOverrides(p => ({ ...p, plate: v > 0 ? v : null }))} disabled={!feeToggles.plate} />
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
                      <CurrencyInput className="fee-input" value={feeOverrides.inspection !== null ? feeOverrides.inspection : calculations.inspection} onChange={(v) => setFeeOverrides(p => ({ ...p, inspection: v > 0 ? v : null }))} disabled={!feeToggles.inspection} />
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
                      <CurrencyInput className="fee-input" value={feeOverrides.road !== null ? feeOverrides.road : calculations.roadMaintenance} onChange={(v) => setFeeOverrides(p => ({ ...p, road: v > 0 ? v : null }))} disabled={!feeToggles.road} />
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
                      <CurrencyInput className="fee-input" value={feeOverrides.service !== null ? feeOverrides.service : calculations.registrationService} onChange={(v) => setFeeOverrides(p => ({ ...p, service: v > 0 ? v : null }))} disabled={!feeToggles.service} />
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
                      <CurrencyInput className="fee-input" value={feeOverrides.tnds !== null ? feeOverrides.tnds : calculations.tndsInsurance} onChange={(v) => setFeeOverrides(p => ({ ...p, tnds: v > 0 ? v : null }))} disabled={!feeToggles.tnds} />
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
                      <CurrencyInput className="fee-input" value={feeOverrides.body !== null ? feeOverrides.body : calculations.bodyInsurance} onChange={(v) => setFeeOverrides(p => ({ ...p, body: v > 0 ? v : null }))} disabled={!feeToggles.body} />
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
                      <CurrencyInput
                        className="discount-input"
                        placeholder="0"
                        value={discountMMV}
                        onChange={setDiscountMMVOverride}
                      />
                    </td>
                  </tr>
                  <tr className="row-discount">
                    <td><div className="item-label"><span className="item-icon">🏷️</span>Khuyến mãi đại lý</div></td>
                    <td className="amount discount-input-cell">
                      <CurrencyInput
                        className="discount-input"
                        placeholder="0"
                        value={discountDealer}
                        onChange={setDiscountDealerOverride}
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
              <button className="quote-zalo-btn" onClick={() => setShowAIModal(true)} style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
                <span className="icon">🤖</span> Viết tin AI
              </button>
              <button className="quote-export-btn" onClick={handleExportImage}>
                <span className="icon">⬇️</span> Tải xuống Ảnh
              </button>
              <button className="quote-zalo-btn" onClick={handleCopyToClipboard}>
                <span className="icon">📋</span> Copy Ảnh Zalo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI GENERATOR MODAL */}
      {showAIModal && calculations && (
        <div className="quote-modal-overlay" onClick={() => setShowAIModal(false)}>
          <div className="quote-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <button className="quote-close-btn" onClick={() => setShowAIModal(false)}>×</button>
            <h2 style={{marginTop: 0, color: 'var(--text-primary)'}}>🤖 Soạn tin nhắn Zalo (AI)</h2>
            <p style={{fontSize: '13px', color: 'var(--text-secondary)'}}>Sử dụng AI để tự động viết lời chào gửi báo giá cho khách.</p>
            
            <div className="input-group" style={{marginBottom: '15px'}}>
              <label>Tin nhắn của khách / Yêu cầu thêm (để AI trả lời cho phù hợp)</label>
              <textarea 
                value={aiPrompt} 
                onChange={e => setAiPrompt(e.target.value)} 
                placeholder="VD: Khách vừa nhắn: 'Chị muốn mua Xpander nhưng tài chính chỉ tầm 600 triệu, có ngân hàng hỗ trợ không em?'" 
                rows="3"
                style={{width: '100%', padding: '10px 14px', background: 'rgba(0,0,0,0.05)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', resize: 'vertical', fontFamily: 'inherit', fontSize: '13px'}}
              />
            </div>
            
            <div className="input-group" style={{marginBottom: '15px'}}>
              <label>Tên khách hàng (Không bắt buộc)</label>
              <input type="text" value={aiCustomerName} onChange={e => setAiCustomerName(e.target.value)} placeholder="VD: Anh Minh..." />
            </div>

            <details style={{marginBottom: '15px', background: 'rgba(99,102,241,0.05)', borderRadius: '8px', padding: '10px 14px', border: '1px solid var(--border-color)'}}>
              <summary style={{cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)'}}>
                ⚙️ Cài đặt Gemini API Key (để nhận câu trả lời AI thật)
              </summary>
              <div style={{marginTop: '10px'}}>
                <p style={{fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 4px'}}>
                  Dùng <strong>OpenRouter</strong> (miễn phí, không cần billing):
                </p>
                <ol style={{fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 8px', paddingLeft: '18px', lineHeight: '1.7'}}>
                  <li>Vào <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" style={{color: 'var(--accent-1)'}}>openrouter.ai/keys</a> → đăng nhập Google</li>
                  <li>Bấm <strong>Create Key</strong> → Copy key (bắt đầu bằng <code>sk-or-...</code>)</li>
                  <li>Dán vào ô bên dưới</li>
                </ol>
                <input 
                  type="password" 
                  value={geminiKey} 
                  onChange={e => { setGeminiKey(e.target.value); if (e.target.value) localStorage.setItem('gemini_api_key', e.target.value); }}
                  placeholder="sk-or-v1-..."
                  style={{width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.05)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: '13px', boxSizing: 'border-box'}}
                />
                {geminiKey && <p style={{fontSize: '11px', color: '#10b981', marginTop: '6px', marginBottom: 0}}>✅ Đã cấu hình — AI Llama 3.3 70B sẵn sàng</p>}
                {!geminiKey && <p style={{fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px', marginBottom: 0}}>⚠️ Chưa có key — đang dùng mẫu mô phỏng</p>}
              </div>
            </details>

            <button 
              className="quote-btn" 
              style={{width: '100%', marginBottom: '15px'}} 
              onClick={handleGenerateAI}
              disabled={isGeneratingAI}
            >
              {isGeneratingAI ? '⏳ Đang soạn...' : '✨ Tạo tin nhắn AI'}
            </button>

            {aiMessage && (
              <div className="ai-message-box" style={{background: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border-color)', position: 'relative'}}>
                <textarea 
                  value={aiMessage} 
                  onChange={e => setAiMessage(e.target.value)}
                  style={{width: '100%', minHeight: '200px', background: 'transparent', color: 'var(--text-primary)', border: 'none', resize: 'vertical', fontSize: '14px', lineHeight: '1.5', outline: 'none'}}
                />
                <button 
                  className="quote-zalo-btn" 
                  style={{position: 'absolute', bottom: '15px', right: '15px', padding: '6px 12px', fontSize: '12px'}}
                  onClick={() => { navigator.clipboard.writeText(aiMessage); showToast('Đã copy tin nhắn!'); }}
                >
                  📋 Copy Text
                </button>
              </div>
            )}
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
