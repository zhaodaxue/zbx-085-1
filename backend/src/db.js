const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const dbFile = path.join(dataDir, 'planter.json');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function loadData() {
  if (!fs.existsSync(dbFile)) {
    const initialData = {
      boxes: [
        { id: 1, box_id: 'BX001', intersection_name: '人民广场路口', last_humidity: 45, water_interval_days: 3, last_water_date: '2026-06-15', created_at: '2026-06-10 08:00:00', updated_at: '2026-06-15 09:00:00' },
        { id: 2, box_id: 'BX002', intersection_name: '中山公园门口', last_humidity: 28, water_interval_days: 2, last_water_date: '2026-06-17', created_at: '2026-06-10 08:00:00', updated_at: '2026-06-17 09:00:00' },
        { id: 3, box_id: 'BX003', intersection_name: '火车站北出口', last_humidity: 62, water_interval_days: 4, last_water_date: '2026-06-14', created_at: '2026-06-10 08:00:00', updated_at: '2026-06-14 09:00:00' },
        { id: 4, box_id: 'BX004', intersection_name: '市政府东门', last_humidity: 35, water_interval_days: 3, last_water_date: '2026-06-16', created_at: '2026-06-10 08:00:00', updated_at: '2026-06-16 09:00:00' },
        { id: 5, box_id: 'BX005', intersection_name: '文化广场南侧', last_humidity: 22, water_interval_days: 2, last_water_date: '2026-06-13', created_at: '2026-06-10 08:00:00', updated_at: '2026-06-13 09:00:00' },
        { id: 6, box_id: 'BX006', intersection_name: '体育中心西门', last_humidity: 58, water_interval_days: 5, last_water_date: '2026-06-12', created_at: '2026-06-10 08:00:00', updated_at: '2026-06-12 09:00:00' },
        { id: 7, box_id: 'BX007', intersection_name: '商业街北口', last_humidity: 40, water_interval_days: 3, last_water_date: '2026-06-17', created_at: '2026-06-10 08:00:00', updated_at: '2026-06-17 09:00:00' },
        { id: 8, box_id: 'BX008', intersection_name: '科技园大门', last_humidity: 50, water_interval_days: 4, last_water_date: '2026-06-16', created_at: '2026-06-10 08:00:00', updated_at: '2026-06-16 09:00:00' },
      ],
      nextId: 9
    };
    saveData(initialData);
    console.log('已初始化示例花箱数据');
    return initialData;
  }
  return JSON.parse(fs.readFileSync(dbFile, 'utf8'));
}

function saveData(data) {
  fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
}

function getNow() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

module.exports = {
  loadData,
  saveData,
  getNow
};
