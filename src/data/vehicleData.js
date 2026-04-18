import vehicles from './vehicles.json';

const { globalDefaults, defaultTnds } = vehicles;

export function createDefaultConfig(seats) {
  const seatKey = seats >= 7 ? '7' : '5';
  return {
    registrationTaxMode: globalDefaults.registrationTaxMode,
    registrationTaxRate: globalDefaults.registrationTaxRate,
    registrationTaxValue: 0,
    registrationPlate: globalDefaults.registrationPlate,
    inspection: globalDefaults.inspection,
    registrationService: globalDefaults.registrationService,
    roadMaintenance: { ...globalDefaults.roadMaintenance },
    tndsInsurance: {
      white: defaultTnds[`${seatKey}_white`],
      yellow: defaultTnds[`${seatKey}_yellow`],
    },
    bodyInsuranceRate: { ...globalDefaults.bodyInsuranceRate },
    // Khuyến mãi MMV theo biển
    discountMMV: {
      white: 0,
      yellow: 0,
    },
    // Khuyến mãi Đại lý theo biển
    discountDealer: {
      white: 0,
      yellow: 0,
    },
  };
}

// Khởi tạo dữ liệu từ JSON, đảm bảo mỗi variant có config nếu JSON chưa định nghĩa
const processVehicleData = () => {
  // Clone sâu để tránh mutate original JSON if cached
  const data = JSON.parse(JSON.stringify(vehicles));
  data.categories.forEach(cat => {
    cat.variants.forEach(v => {
      if (!v.config) {
        v.config = createDefaultConfig(cat.seats);
      }
    });
  });
  return data;
};

const vehicleData = processVehicleData();

export { globalDefaults, defaultTnds };
export default vehicleData;
