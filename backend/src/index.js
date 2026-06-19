const express = require('express');
const cors = require('cors');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { loadData, saveData, getNow } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({ dest: uploadDir });

function calculateDaysSince(dateStr) {
  if (!dateStr) return 999;
  const last = new Date(dateStr);
  const now = new Date();
  const diffTime = Math.abs(now - last);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

function getTags(box) {
  const tags = [];
  const daysSince = calculateDaysSince(box.last_water_date);

  if (daysSince > box.water_interval_days) {
    tags.push({ type: 'overdue', label: `超期${daysSince - box.water_interval_days}天` });
  }
  if (box.last_humidity < 30) {
    tags.push({ type: 'low_humidity', label: `低湿度(${box.last_humidity}%)` });
  }
  return tags;
}

function getPriorityScore(box) {
  const daysSince = calculateDaysSince(box.last_water_date);
  let score = 0;
  if (daysSince > box.water_interval_days) {
    score += 100 + (daysSince - box.water_interval_days) * 10;
  }
  if (box.last_humidity < 30) {
    score += 100 + (30 - box.last_humidity) * 2;
  }
  return score;
}

app.get('/api/boxes', (req, res) => {
  const data = loadData();
  const boxes = data.boxes.map(box => ({
    ...box,
    days_since_water: calculateDaysSince(box.last_water_date),
    tags: getTags(box),
    priority_score: getPriorityScore(box)
  }));

  boxes.sort((a, b) => b.priority_score - a.priority_score);
  res.json(boxes);
});

app.post('/api/boxes', (req, res) => {
  const { box_id, intersection_name, last_humidity, water_interval_days, last_water_date } = req.body;
  const data = loadData();

  if (data.boxes.some(b => b.box_id === box_id)) {
    return res.status(400).json({ error: '花箱编号已存在' });
  }

  const newBox = {
    id: data.nextId,
    box_id,
    intersection_name,
    last_humidity: last_humidity || 50,
    water_interval_days: water_interval_days || 3,
    last_water_date: last_water_date || null,
    created_at: getNow(),
    updated_at: getNow()
  };

  data.boxes.push(newBox);
  data.nextId++;
  saveData(data);

  res.status(201).json(newBox);
});

app.post('/api/boxes/:id/water', (req, res) => {
  const { id } = req.params;
  const data = loadData();
  const boxIndex = data.boxes.findIndex(b => b.id === parseInt(id));

  if (boxIndex === -1) {
    return res.status(404).json({ error: '花箱不存在' });
  }

  const today = new Date().toISOString().split('T')[0];
  data.boxes[boxIndex].last_water_date = today;
  data.boxes[boxIndex].last_humidity = 80;
  data.boxes[boxIndex].updated_at = getNow();

  saveData(data);

  const box = data.boxes[boxIndex];
  res.json({
    ...box,
    days_since_water: calculateDaysSince(box.last_water_date),
    tags: getTags(box),
    priority_score: getPriorityScore(box)
  });
});

app.post('/api/import/humidity', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '未上传文件' });
  }

  const results = [];
  const errors = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', () => {
      const data = loadData();
      let successCount = 0;

      for (const row of results) {
        const boxId = row.box_id?.trim();
        const humidity = parseFloat(row.humidity);

        if (!boxId || isNaN(humidity)) {
          errors.push({ row: JSON.stringify(row), error: '数据格式错误' });
          continue;
        }

        if (humidity < 0 || humidity > 100) {
          errors.push({ box_id: boxId, humidity, error: '湿度值超出0-100范围' });
          continue;
        }

        const boxIndex = data.boxes.findIndex(b => b.box_id === boxId);
        if (boxIndex === -1) {
          errors.push({ box_id: boxId, error: '花箱不存在' });
          continue;
        }

        data.boxes[boxIndex].last_humidity = humidity;
        data.boxes[boxIndex].updated_at = getNow();
        successCount++;
      }

      saveData(data);
      fs.unlinkSync(req.file.path);

      res.json({
        success: successCount,
        total: results.length,
        errors
      });
    })
    .on('error', (err) => {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ error: 'CSV解析失败: ' + err.message });
    });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`后端服务运行在端口 ${PORT}`);
});
