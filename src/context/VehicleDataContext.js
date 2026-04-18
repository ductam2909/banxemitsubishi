import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import vehicleDataDefault from '../data/vehicleData';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc, getDoc } from "firebase/firestore";

const VehicleDataContext = createContext();

export function VehicleDataProvider({ children }) {
  const [vehicleData, setVehicleData] = useState(vehicleDataDefault);
  const [loading, setLoading] = useState(true);

  // Tham chiếu đến document lưu cấu hình chung
  const configDocRef = doc(db, "app_data", "vehicle_config");

  // Khởi tạo & Lắng nghe dữ liệu Real-time từ Firebase
  useEffect(() => {
    const unsubscribe = onSnapshot(configDocRef, (snapshot) => {
      if (snapshot.exists()) {
        console.log("🔥 Firebase: Dữ liệu đã được cập nhật!");
        setVehicleData(snapshot.data());
      } else {
        // Nếu lần đầu sử dụng (chưa có data trên Firebase), đẩy data mặc định lên
        console.log("ℹ️ Firebase: Chưa có dữ liệu, khởi tạo dữ liệu mặc định...");
        setDoc(configDocRef, vehicleDataDefault);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Commit data mới lên Firebase
  const saveData = useCallback(async (newData) => {
    try {
      await setDoc(configDocRef, newData);
      return true;
    } catch (e) {
      console.error("❌ Lỗi khi lưu Firebase:", e);
      return false;
    }
  }, [configDocRef]);

  // Reset về mặc định
  const resetToDefault = useCallback(async () => {
    try {
      await setDoc(configDocRef, vehicleDataDefault);
    } catch (e) {
      console.error("❌ Lỗi khi reset Firebase:", e);
    }
  }, [configDocRef]);

  const value = {
    vehicleData,
    saveData,
    resetToDefault,
    loading
  };

  return (
    <VehicleDataContext.Provider value={value}>
      {!loading && children}
    </VehicleDataContext.Provider>
  );
}

export function useVehicleData() {
  const context = useContext(VehicleDataContext);
  if (!context) {
    throw new Error('useVehicleData must be used within VehicleDataProvider');
  }
  return context;
}
