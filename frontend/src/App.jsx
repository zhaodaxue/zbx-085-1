import { useState, useEffect, useCallback } from 'react'

const API_BASE = '/api'
const PATROL_STORAGE_KEY = 'planter_patrol_state'

function loadPatrolState() {
  try {
    const raw = sessionStorage.getItem(PATROL_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function savePatrolState(state) {
  try {
    sessionStorage.setItem(PATROL_STORAGE_KEY, JSON.stringify(state))
  } catch {}
}

function clearPatrolState() {
  try {
    sessionStorage.removeItem(PATROL_STORAGE_KEY)
  } catch {}
}

function App() {
  const [boxes, setBoxes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [showSummaryModal, setShowSummaryModal] = useState(false)
  const [summaryData, setSummaryData] = useState(null)

  const [isPatrolMode, setIsPatrolMode] = useState(false)
  const [patrolInitialTotal, setPatrolInitialTotal] = useState(0)
  const [patrolCompletedIds, setPatrolCompletedIds] = useState([])
  const [patrolDeferredIds, setPatrolDeferredIds] = useState([])
  const [patrolCompletedBoxes, setPatrolCompletedBoxes] = useState([])
  const [patrolDeferredBoxes, setPatrolDeferredBoxes] = useState([])

  useEffect(() => {
    const saved = loadPatrolState()
    if (saved && saved.isPatrolMode) {
      setIsPatrolMode(true)
      setPatrolInitialTotal(saved.patrolInitialTotal || 0)
      setPatrolCompletedIds(saved.patrolCompletedIds || [])
      setPatrolDeferredIds(saved.patrolDeferredIds || [])
      setPatrolCompletedBoxes(saved.patrolCompletedBoxes || [])
      setPatrolDeferredBoxes(saved.patrolDeferredBoxes || [])
    }
  }, [])

  useEffect(() => {
    if (isPatrolMode) {
      savePatrolState({
        isPatrolMode: true,
        patrolInitialTotal,
        patrolCompletedIds,
        patrolDeferredIds,
        patrolCompletedBoxes,
        patrolDeferredBoxes
      })
    }
  }, [isPatrolMode, patrolInitialTotal, patrolCompletedIds, patrolDeferredIds, patrolCompletedBoxes, patrolDeferredBoxes])

  const fetchBoxes = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/boxes`)
      const data = await res.json()
      setBoxes(data)

      if (isPatrolMode) {
        const newAttention = data.filter(b =>
          b.tags.length > 0 &&
          !patrolCompletedIds.includes(b.id)
        )
        const deferredBoxes = patrolDeferredIds
          .map(id => data.find(b => b.id === id))
          .filter(b => b && !patrolCompletedIds.includes(b.id))
        const nonDeferredAttention = newAttention.filter(
          b => !patrolDeferredIds.includes(b.id)
        )
        const merged = [...nonDeferredAttention, ...deferredBoxes]
        if (merged.length === 0 && patrolCompletedIds.length > 0) {
          showSummary()
        }
      }
    } catch (err) {
      console.error('获取花箱列表失败:', err)
    } finally {
      setLoading(false)
    }
  }, [isPatrolMode, patrolCompletedIds, patrolDeferredIds])

  useEffect(() => {
    fetchBoxes()
  }, [fetchBoxes])

  const showSummary = () => {
    const summary = {}
    for (const box of patrolCompletedBoxes) {
      const name = box.intersection_name
      if (!summary[name]) summary[name] = { watered: 0, deferred: 0 }
      summary[name].watered++
    }
    for (const box of patrolDeferredBoxes) {
      const name = box.intersection_name
      if (!summary[name]) summary[name] = { watered: 0, deferred: 0 }
      summary[name].deferred++
    }
    const result = Object.entries(summary).map(([name, data]) => ({
      intersection_name: name,
      watered: data.watered,
      deferred: data.deferred
    }))
    setSummaryData(result)
    setShowSummaryModal(true)
  }

  const startPatrol = () => {
    const attentionBoxes = boxes.filter(b => b.tags.length > 0)
    setIsPatrolMode(true)
    setPatrolInitialTotal(attentionBoxes.length)
    setPatrolCompletedIds([])
    setPatrolDeferredIds([])
    setPatrolCompletedBoxes([])
    setPatrolDeferredBoxes([])
  }

  const exitPatrol = () => {
    setIsPatrolMode(false)
    setPatrolInitialTotal(0)
    setPatrolCompletedIds([])
    setPatrolDeferredIds([])
    setPatrolCompletedBoxes([])
    setPatrolDeferredBoxes([])
    setShowSummaryModal(false)
    setSummaryData(null)
    clearPatrolState()
  }

  const handleWater = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/boxes/${id}/water`, {
        method: 'POST'
      })
      if (res.ok) {
        const updatedBox = await res.json()
        if (isPatrolMode) {
          const newCompletedIds = [...patrolCompletedIds, id]
          const newCompletedBoxes = [...patrolCompletedBoxes, updatedBox]
          const newDeferredIds = patrolDeferredIds.filter(did => did !== id)
          const newDeferredBoxes = patrolDeferredBoxes.filter(b => b.id !== id)
          setPatrolCompletedIds(newCompletedIds)
          setPatrolCompletedBoxes(newCompletedBoxes)
          setPatrolDeferredIds(newDeferredIds)
          setPatrolDeferredBoxes(newDeferredBoxes)
          await fetchBoxes()
        } else {
          await fetchBoxes()
        }
      }
    } catch (err) {
      console.error('登记浇灌失败:', err)
    }
  }

  const handleDefer = (box) => {
    const newDeferredIds = [...patrolDeferredIds.filter(id => id !== box.id), box.id]
    const newDeferredBoxes = [...patrolDeferredBoxes.filter(b => b.id !== box.id), box]
    setPatrolDeferredIds(newDeferredIds)
    setPatrolDeferredBoxes(newDeferredBoxes)
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
    const hasOverdue = box.tags.some(t => t.type === 'overdue')
    const hasLowHumidity = box.tags.some(t => t.type === 'low_humidity')
    if (hasOverdue && hasLowHumidity) return 'high'
    if (hasOverdue || hasLowHumidity) return 'medium'
    return 'normal'
  }

  const getHumidityClass = (humidity) => {
    if (humidity < 30) return 'low'
    if (humidity < 60) return 'medium'
    return 'high'
  }

  const getDisplayBoxes = () => {
    if (!isPatrolMode) return boxes
    const attentionBoxes = boxes.filter(b =>
      b.tags.length > 0 &&
      !patrolCompletedIds.includes(b.id)
    )
    const deferredBoxes = patrolDeferredIds
      .map(id => boxes.find(b => b.id === id))
      .filter(b => b && !patrolCompletedIds.includes(b.id))
    const nonDeferredAttention = attentionBoxes.filter(
      b => !patrolDeferredIds.includes(b.id)
    )
    return [...nonDeferredAttention, ...deferredBoxes]
  }

  const displayBoxes = getDisplayBoxes()

  const patrolProgress = {
    processed: patrolCompletedIds.length,
    total: patrolInitialTotal,
    remaining: displayBoxes.length
  }

  return (
    <div className="container">
      <div className={`header ${isPatrolMode ? 'header-patrol' : ''}`}>
        <h1>🌿 {isPatrolMode ? '🚶 巡查模式 - ' : ''}街道绿化花箱浇灌计划</h1>
        <p>{isPatrolMode ? '处理带标签的花箱 · 按优先级自动排序' : '本周各路口花箱浇灌安排 · 按优先级自动排序'}</p>
      </div>

      {isPatrolMode && (
        <div className="patrol-progress-bar">
          <div className="patrol-progress-info">
            <span className="patrol-progress-label">本轮进度</span>
            <span className="patrol-progress-count">
              <strong>{patrolProgress.processed}</strong>
              <span className="patrol-progress-sep">/</span>
              <span>{patrolProgress.total}</span>
              <span className="patrol-progress-suffix">已处理</span>
            </span>
            {patrolProgress.remaining === 0 && patrolProgress.processed > 0 && (
              <span className="patrol-progress-done">✓ 本轮巡查完成</span>
            )}
          </div>
          <div className="patrol-progress-track">
            <div
              className="patrol-progress-fill"
              style={{
                width: `${patrolProgress.total > 0 ? (patrolProgress.processed / patrolProgress.total) * 100 : 0}%`
              }}
            ></div>
          </div>
        </div>
      )}

      {!isPatrolMode && (
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
      )}

      <div className="toolbar">
        {!isPatrolMode && (
          <button
            className="btn btn-warning"
            onClick={startPatrol}
          >
            🚶 开始巡查
          </button>
        )}
        <button
          className="btn btn-primary"
          onClick={() => setShowImportModal(true)}
        >
          📥 导入湿度数据
        </button>
        <button className="btn btn-default" onClick={fetchBoxes}>
          🔄 刷新
        </button>
        {isPatrolMode && (
          <button className="btn btn-danger" onClick={exitPatrol}>
            ✕ 退出巡查
          </button>
        )}
      </div>

      {loading ? (
        <div className="loading">加载中...</div>
      ) : displayBoxes.length === 0 ? (
        <div className="empty">
          {isPatrolMode
            ? (patrolProgress.processed > 0 ? '本轮巡查已完成 🎉' : '暂无待处理花箱')
            : '暂无花箱数据'}
        </div>
      ) : (
        <div className="box-list">
          {displayBoxes.map((box) => {
            const isCompleted = isPatrolMode && patrolCompletedIds.includes(box.id)
            const isDeferred = isPatrolMode && patrolDeferredIds.includes(box.id)

            return (
              <div
                key={box.id}
                className={`box-card priority-${getPriorityClass(box)} ${isCompleted ? 'status-completed' : ''} ${isDeferred ? 'status-deferred' : ''}`}
              >
                <div className={`priority-badge ${getPriorityClass(box)}`}></div>
                <div className="box-info">
                  <div className="box-id">
                    {box.box_id}
                    {isCompleted && <span className="status-chip status-chip-completed">✓ 已浇灌</span>}
                    {isDeferred && <span className="status-chip status-chip-deferred">⏸ 暂缓</span>}
                  </div>
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
                  {!isCompleted && (
                    <>
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => handleWater(box.id)}
                      >
                        💧 登记浇灌
                      </button>
                      {isPatrolMode && (
                        <button
                          className="btn btn-default btn-sm"
                          onClick={() => handleDefer(box)}
                        >
                          ⏸ 标记暂缓
                        </button>
                      )}
                    </>
                  )}
                  {isCompleted && (
                    <span className="completed-badge">已完成</span>
                  )}
                </div>
              </div>
            )
          })}
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

      {showSummaryModal && summaryData && (
        <div className="modal-overlay" onClick={() => setShowSummaryModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>🎉 本轮巡查完成</h2>
            <div className="summary-table-wrap">
              <table className="summary-table">
                <thead>
                  <tr>
                    <th>路口</th>
                    <th>已浇灌</th>
                    <th>暂缓</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryData.map((row, idx) => (
                    <tr key={idx}>
                      <td>{row.intersection_name}</td>
                      <td className="summary-success">{row.watered}</td>
                      <td className="summary-warn">{row.deferred}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td><strong>合计</strong></td>
                    <td className="summary-success">
                      <strong>{summaryData.reduce((s, r) => s + r.watered, 0)}</strong>
                    </td>
                    <td className="summary-warn">
                      <strong>{summaryData.reduce((s, r) => s + r.deferred, 0)}</strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => setShowSummaryModal(false)}>
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
