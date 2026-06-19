import { useState, useEffect, useCallback } from 'react'

const API_BASE = '/api'

function App() {
  const [boxes, setBoxes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [isDragging, setIsDragging] = useState(false)

  const fetchBoxes = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/boxes`)
      const data = await res.json()
      setBoxes(data)
    } catch (err) {
      console.error('获取花箱列表失败:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBoxes()
  }, [fetchBoxes])

  const handleWater = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/boxes/${id}/water`, {
        method: 'POST'
      })
      if (res.ok) {
        await fetchBoxes()
      }
    } catch (err) {
      console.error('登记浇灌失败:', err)
    }
  }

  const handleFileUpload = async (file) => {
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch(`${API_BASE}/import/humidity`, {
        method: 'POST',
        body: formData
      })
      const result = await res.json()
      setImportResult(result)
      if (result.success > 0) {
        await fetchBoxes()
      }
    } catch (err) {
      setImportResult({ success: 0, total: 0, error: err.message })
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && file.name.endsWith('.csv')) {
      handleFileUpload(file)
    }
  }

  const handleFileInput = (e) => {
    const file = e.target.files[0]
    if (file) {
      handleFileUpload(file)
    }
  }

  const closeImportModal = () => {
    setShowImportModal(false)
    setImportResult(null)
  }

  const stats = {
    total: boxes.length,
    overdue: boxes.filter(b => b.tags.some(t => t.type === 'overdue')).length,
    lowHumidity: boxes.filter(b => b.tags.some(t => t.type === 'low_humidity')).length,
    priority: boxes.filter(b => b.tags.length > 0).length
  }

  const getPriorityClass = (box) => {
    if (box.priority_score >= 120) return 'high'
    if (box.priority_score >= 60) return 'medium'
    return 'normal'
  }

  const getHumidityClass = (humidity) => {
    if (humidity < 30) return 'low'
    if (humidity < 60) return 'medium'
    return 'high'
  }

  return (
    <div className="container">
      <div className="header">
        <h1>🌿 街道绿化花箱浇灌计划</h1>
        <p>本周各路口花箱浇灌安排 · 按优先级自动排序</p>
      </div>

      <div className="stats-bar">
        <div className="stat-card">
          <div className="label">花箱总数</div>
          <div className="value">{stats.total}</div>
        </div>
        <div className="stat-card warning">
          <div className="label">需关注</div>
          <div className="value">{stats.priority}</div>
        </div>
        <div className="stat-card danger">
          <div className="label">浇灌超期</div>
          <div className="value">{stats.overdue}</div>
        </div>
        <div className="stat-card warning">
          <div className="label">低湿度</div>
          <div className="value">{stats.lowHumidity}</div>
        </div>
      </div>

      <div className="toolbar">
        <button
          className="btn btn-primary"
          onClick={() => setShowImportModal(true)}
        >
          📥 导入湿度数据
        </button>
        <button className="btn btn-default" onClick={fetchBoxes}>
          🔄 刷新
        </button>
      </div>

      {loading ? (
        <div className="loading">加载中...</div>
      ) : boxes.length === 0 ? (
        <div className="empty">暂无花箱数据</div>
      ) : (
        <div className="box-list">
          {boxes.map((box) => (
            <div
              key={box.id}
              className={`box-card priority-${getPriorityClass(box)}`}
            >
              <div className={`priority-badge ${getPriorityClass(box)}`}></div>
              <div className="box-info">
                <div className="box-id">{box.box_id}</div>
                <div className="box-name">{box.intersection_name}</div>
                <div className="box-meta">
                  <span>
                    💧 湿度:
                    <div className="humidity-bar">
                      <div
                        className={`humidity-fill ${getHumidityClass(box.last_humidity)}`}
                        style={{ width: `${box.last_humidity}%` }}
                      ></div>
                    </div>
                    <span>{box.last_humidity}%</span>
                  </span>
                  <span>⏱️ 间隔: {box.water_interval_days}天</span>
                  <span>📅 上次浇灌: {box.last_water_date || '未记录'}</span>
                  <span>🕐 距上次: {box.days_since_water}天</span>
                </div>
                {box.tags.length > 0 && (
                  <div className="tags" style={{ marginTop: '8px' }}>
                    {box.tags.map((tag, idx) => (
                      <span key={idx} className={`tag tag-${tag.type}`}>
                        {tag.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="box-actions">
                <button
                  className="btn btn-success btn-sm"
                  onClick={() => handleWater(box.id)}
                >
                  💧 登记浇灌
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showImportModal && (
        <div className="modal-overlay" onClick={closeImportModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>批量导入湿度读数</h2>

            {!importResult && (
              <div
                className={`upload-area ${isDragging ? 'dragover' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault()
                  setIsDragging(true)
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById('fileInput').click()}
              >
                <div className="upload-icon">📁</div>
                <div className="upload-text">点击或拖拽 CSV 文件到此处</div>
                <div className="upload-hint">
                  格式: box_id, humidity, read_date
                </div>
                <input
                  id="fileInput"
                  type="file"
                  accept=".csv"
                  style={{ display: 'none' }}
                  onChange={handleFileInput}
                />
              </div>
            )}

            {importResult && (
              <div className={`import-result ${importResult.error ? 'error' : ''}`}>
                {importResult.error ? (
                  <div>❌ 导入失败: {importResult.error}</div>
                ) : (
                  <>
                    <div>
                      ✅ 导入完成: 成功 {importResult.success} 条 / 共 {importResult.total} 条
                    </div>
                    {importResult.errors && importResult.errors.length > 0 && (
                      <div className="import-errors">
                        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                          失败记录:
                        </div>
                        {importResult.errors.map((err, idx) => (
                          <div key={idx}>
                            {err.box_id || err.row}: {err.error}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="modal-actions">
              {importResult ? (
                <>
                  <button className="btn btn-default" onClick={() => setImportResult(null)}>
                    继续导入
                  </button>
                  <button className="btn btn-primary" onClick={closeImportModal}>
                    关闭
                  </button>
                </>
              ) : (
                <button className="btn btn-default" onClick={closeImportModal}>
                  取消
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
