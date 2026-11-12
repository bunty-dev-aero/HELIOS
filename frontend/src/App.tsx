import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Atom,
  Bell,
  Brain,
  Clock3,
  Cpu,
  Crosshair,
  Database,
  Heart,
  LayoutDashboard,
  Menu,
  Radio,
  RefreshCw,
  ShieldCheck,
  Signal,
  SlidersHorizontal,
  Thermometer,
  Users,
  Wind,
  X,
  Zap,
} from 'lucide-react'

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import CrewHealth from './pages/CrewHealth'
import CrewAssessment from './pages/CrewAssessment'
import Telemetry from './pages/Telemetry'
import RiskAlerts from './pages/RiskAlerts'
import Environment from './pages/Environment'
import GroundControl from './pages/GroundControl'
import './App.css'

const API_BASE = 'http://127.0.0.1:8000/api/v1'

interface Astronaut {
  id: string
  name: string
  mission_role: string
  mission_day: number
  is_simulated: boolean
}

interface Measurement {
  id: number
  astronaut_id: string
  metric: string
  value: number
  unit: string
  measured_at: string
  source: string
  simulated: boolean
  quality: string
}

interface ApiData {
  astronauts: Astronaut[]
  measurements: Measurement[]
}

const navigation = [
  { label: 'Mission Overview', icon: LayoutDashboard },
  { label: 'Crew Health', icon: Users },
  { label: 'Crew Assessment', icon: Brain },
  { label: 'Telemetry', icon: Activity },
  { label: 'Risk Monitor', icon: ShieldCheck },
  { label: 'Environment', icon: Wind },
  { label: 'Ground Control', icon: Radio },
]

const metricConfig: Record<
  string,
  { label: string; unit: string; icon: typeof Heart }
> = {
  heart_rate: { label: 'Heart Rate', unit: 'bpm', icon: Heart },
  spo2: { label: 'Blood Oxygen', unit: '%', icon: Activity },
  temperature: { label: 'Temperature', unit: '°C', icon: Thermometer },
  sleep_hours: { label: 'Sleep Duration', unit: 'hrs', icon: Clock3 },
  systolic_bp: { label: 'Systolic BP', unit: 'mmHg', icon: Activity },
  diastolic_bp: { label: 'Diastolic BP', unit: 'mmHg', icon: Activity },
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function App() {
  const [data, setData] = useState<ApiData>({
    astronauts: [],
    measurements: [],
  })

  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [activePage, setActivePage] = useState('Mission Overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [healthResponse, crewResponse, telemetryResponse] =
        await Promise.all([
          fetch(`${API_BASE}/health`),
          fetch(`${API_BASE}/astronauts`),
          fetch(`${API_BASE}/measurements?limit=100`),
        ])

      if (
        !healthResponse.ok ||
        !crewResponse.ok ||
        !telemetryResponse.ok
      ) {
        throw new Error('One or more API endpoints returned an error.')
      }

      const crew: Astronaut[] = await crewResponse.json()
      const measurements: Measurement[] =
        await telemetryResponse.json()

      setData({
        astronauts: crew,
        measurements,
      })

      setConnected(true)
      setError('')
      setLastUpdated(new Date())
    } catch {
      setConnected(false)
      setError('Unable to connect to the HELIOS backend.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()

    const interval = window.setInterval(fetchData, 10000)

    return () => window.clearInterval(interval)
  }, [fetchData])

  const latestMeasurements = useMemo(() => {
    const latest = new Map<string, Measurement>()

    for (const measurement of data.measurements) {
      const key = `${measurement.astronaut_id}-${measurement.metric}`
      const existing = latest.get(key)

      if (
        !existing ||
        new Date(measurement.measured_at).getTime() >
          new Date(existing.measured_at).getTime()
      ) {
        latest.set(key, measurement)
      }
    }

    return latest
  }, [data.measurements])

  const chartData = useMemo(() => {
    return [...data.measurements]
      .filter((item) => item.metric === 'heart_rate')
      .sort(
        (a, b) =>
          new Date(a.measured_at).getTime() -
          new Date(b.measured_at).getTime(),
      )
      .slice(-30)
      .map((item) => ({
        time: formatTime(item.measured_at),
        value: item.value,
        astronaut: item.astronaut_id,
      }))
  }, [data.measurements])

  const crewCount = data.astronauts.length

  const simulatedCount = data.measurements.filter(
    (measurement) => measurement.simulated,
  ).length

  const latestRecords = [...data.measurements]
    .sort(
      (a, b) =>
        new Date(b.measured_at).getTime() -
        new Date(a.measured_at).getTime(),
    )
    .slice(0, 6)

  return (
    <div className="app-shell">
      <aside
        className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}
      >
        <div className="brand">
          <div className="brand-mark">
            <Atom size={25} strokeWidth={1.6} />
          </div>

          <div>
            <div className="brand-name">HELIOS</div>
            <div className="brand-subtitle">
              MISSION INTELLIGENCE
            </div>
          </div>

          <button
            className="mobile-close"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <div className="mission-label">MISSION CONTROL</div>

        <nav className="navigation">
          {navigation.map((item) => {
            const Icon = item.icon

            return (
              <button
                key={item.label}
                className={`nav-item ${
                  activePage === item.label ? 'active' : ''
                }`}
                onClick={() => {
                  setActivePage(item.label)
                  setSidebarOpen(false)
                }}
              >
                <Icon size={18} strokeWidth={1.8} />
                <span>{item.label}</span>

                {item.label === 'Risk Monitor' && (
                  <span className="nav-indicator" />
                )}
              </button>
            )
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="mission-card">
            <div className="mission-card-top">
              <Crosshair size={16} />
              <span>MISSION PROFILE</span>
            </div>

            <div className="mission-code">HELIOS-001</div>

            <div className="mission-description">
              Human Spaceflight Health Monitoring
            </div>

            <div className="mission-progress">
              <div className="progress-header">
                <span>DEMO STATUS</span>
                <span>ACTIVE</span>
              </div>

              <div className="progress-track">
                <div className="progress-fill" />
              </div>
            </div>
          </div>

          <button className="nav-item settings-item">
            <SlidersHorizontal size={18} />
            <span>Settings</span>
          </button>

          <div className="sidebar-version">
            HELIOS PROTOTYPE <span>v0.1.0</span>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="mobile-menu"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={21} />
            </button>

            <div className="breadcrumb">
              <span>HELIOS</span>
              <span className="breadcrumb-divider">/</span>
              <strong>{activePage}</strong>
            </div>
          </div>

          <div className="topbar-right">
            <div className="data-mode">
              <span className="simulated-dot" />
              SIMULATED DATA
            </div>

            <div className="connection-status">
              <span
                className={`connection-dot ${
                  connected ? 'connected' : 'disconnected'
                }`}
              />
              {connected ? 'API CONNECTED' : 'API OFFLINE'}
            </div>

            <button
              className="refresh-button"
              onClick={fetchData}
              title="Refresh telemetry"
            >
              <RefreshCw size={16} />
            </button>

            <button className="notification-button">
              <Bell size={18} />
              <span />
            </button>
          </div>
        </header>

        <div className="dashboard">
          {activePage === 'Crew Health' ? (
            <CrewHealth
              astronauts={data.astronauts}
              measurements={data.measurements}
            />
          ) : activePage === 'Crew Assessment' ? (
            <CrewAssessment astronauts={data.astronauts} />
          ) : activePage === 'Telemetry' ? (
            <Telemetry
              astronauts={data.astronauts}
              measurements={data.measurements}
              onRefresh={fetchData}
            />
          ) : activePage === 'Risk Monitor' ? (
            <RiskAlerts
              astronauts={data.astronauts}
              onRefresh={fetchData}
            />
          ) : activePage === 'Environment' ? (
            <Environment />
          ) : activePage === 'Ground Control' ? (
            <GroundControl />
          ) : (
            <>
              <section className="page-heading">
                <div>
                  <div className="eyebrow">
                    <span className="eyebrow-line" />
                    HUMAN SPACEFLIGHT HEALTH SYSTEM
                  </div>

                  <h1>Mission Overview</h1>

                  <p>
                    Real-time crew health intelligence and mission telemetry.
                  </p>
                </div>

                <div className="heading-right">
                  <div className="mission-status">
                    <span className="status-pulse" />
                    MISSION ACTIVE
                  </div>

                  <div className="mission-time">
                    <Clock3 size={14} />
                    {lastUpdated
                      ? `Updated ${lastUpdated.toLocaleTimeString()}`
                      : 'Waiting for data'}
                  </div>
                </div>
              </section>

              {error && (
                <div className="error-banner">
                  <AlertTriangle size={18} />
                  <span>
                    {error} Check that FastAPI is running.
                  </span>
                  <button onClick={fetchData}>Retry</button>
                </div>
              )}

              <section className="overview-grid">
                <StatCard
                  icon={Users}
                  label="TOTAL CREW"
                  value={String(crewCount).padStart(2, '0')}
                  detail="Registered astronauts"
                  accent="cyan"
                />

                <StatCard
                  icon={Activity}
                  label="TELEMETRY RECORDS"
                  value={String(data.measurements.length).padStart(3, '0')}
                  detail="Latest API records"
                  accent="blue"
                />

                <StatCard
                  icon={Database}
                  label="SIMULATED READINGS"
                  value={String(simulatedCount).padStart(3, '0')}
                  detail="Clearly marked synthetic data"
                  accent="purple"
                />

                <StatCard
                  icon={Radio}
                  label="SYSTEM STATUS"
                  value={connected ? 'ONLINE' : 'OFFLINE'}
                  detail={
                    connected
                      ? 'Backend responding'
                      : 'Connection unavailable'
                  }
                  accent={connected ? 'green' : 'red'}
                />
              </section>

              <section className="section-heading">
                <div>
                  <h2>Crew Health Monitoring</h2>
                  <p>Individual astronaut telemetry overview</p>
                </div>

                <div className="section-tag">
                  <Signal size={14} />
                  {crewCount} CREW MEMBERS
                </div>
              </section>

              <section className="crew-grid">
                {data.astronauts.map((astronaut) => {
                  const heartRate = latestMeasurements.get(
                    `${astronaut.id}-heart_rate`,
                  )

                  const spo2 = latestMeasurements.get(
                    `${astronaut.id}-spo2`,
                  )

                  const temperature = latestMeasurements.get(
                    `${astronaut.id}-temperature`,
                  )

                  const sleep = latestMeasurements.get(
                    `${astronaut.id}-sleep_hours`,
                  )

                  return (
                    <article
                      className="crew-card"
                      key={astronaut.id}
                    >
                      <div className="crew-card-top">
                        <div className="crew-avatar">
                          {astronaut.name
                            .split(' ')
                            .map((part) => part[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase()}
                        </div>

                        <div className="crew-identity">
                          <h3>{astronaut.name}</h3>
                          <span>{astronaut.mission_role}</span>
                        </div>

                        <div className="crew-menu">
                          <span className="crew-live-dot" />
                          LIVE
                        </div>
                      </div>

                      <div className="crew-id">
                        {astronaut.id} <span>•</span> DAY{' '}
                        {astronaut.mission_day}
                      </div>

                      <div className="crew-divider" />

                      <div className="crew-metrics">
                        <Metric
                          icon={Heart}
                          label="HEART RATE"
                          measurement={heartRate}
                          fallbackUnit="bpm"
                        />

                        <Metric
                          icon={Activity}
                          label="SPO₂"
                          measurement={spo2}
                          fallbackUnit="%"
                        />

                        <Metric
                          icon={Thermometer}
                          label="TEMPERATURE"
                          measurement={temperature}
                          fallbackUnit="°C"
                        />

                        <Metric
                          icon={Clock3}
                          label="SLEEP"
                          measurement={sleep}
                          fallbackUnit="hrs"
                        />
                      </div>

                      <div className="crew-card-footer">
                        <span>TELEMETRY SOURCE</span>
                        <span>
                          {heartRate?.source?.toUpperCase() || 'NO DATA'}
                        </span>
                      </div>
                    </article>
                  )
                })}

                {loading && crewCount === 0 && (
                  <div className="empty-state">
                    <RefreshCw
                      className="spin"
                      size={24}
                    />
                    <span>Loading crew telemetry...</span>
                  </div>
                )}

                {!loading && crewCount === 0 && (
                  <div className="empty-state">
                    <Users size={24} />
                    <span>No astronauts found in database.</span>
                  </div>
                )}
              </section>

              <section className="analytics-grid">
                <article className="panel telemetry-panel">
                  <div className="panel-heading">
                    <div>
                      <div className="panel-eyebrow">
                        <Activity size={14} />
                        BIOMETRIC TELEMETRY
                      </div>

                      <h2>Heart Rate Trends</h2>
                      <p>
                        Recent heart-rate measurements across the crew
                      </p>
                    </div>

                    <div className="chart-unit">BPM</div>
                  </div>

                  {chartData.length > 0 ? (
                    <div className="chart-container">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={chartData}
                          margin={{
                            top: 15,
                            right: 8,
                            left: -20,
                            bottom: 0,
                          }}
                        >
                          <defs>
                            <linearGradient
                              id="heartGradient"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="0%"
                                stopColor="#00d5ff"
                                stopOpacity={0.28}
                              />
                              <stop
                                offset="100%"
                                stopColor="#00d5ff"
                                stopOpacity={0}
                              />
                            </linearGradient>
                          </defs>

                          <CartesianGrid
                            stroke="#1c2b3d"
                            strokeDasharray="3 5"
                            vertical={false}
                          />

                          <XAxis
                            dataKey="time"
                            stroke="#64748b"
                            tick={{ fill: '#718096', fontSize: 10 }}
                            tickLine={false}
                            axisLine={false}
                            minTickGap={35}
                          />

                          <YAxis
                            stroke="#64748b"
                            tick={{ fill: '#718096', fontSize: 10 }}
                            tickLine={false}
                            axisLine={false}
                          />

                          <Tooltip
                            contentStyle={{
                              background: '#111c2c',
                              border: '1px solid #263b52',
                              borderRadius: '8px',
                              color: '#fff',
                              fontSize: '12px',
                            }}
                            formatter={(value) => [
                              `${value} bpm`,
                              'Heart rate',
                            ]}
                          />

                          <Area
                            type="monotone"
                            dataKey="value"
                            stroke="#00d5ff"
                            strokeWidth={2}
                            fill="url(#heartGradient)"
                            activeDot={{
                              r: 5,
                              fill: '#00d5ff',
                              stroke: '#08111d',
                              strokeWidth: 2,
                            }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="chart-empty">
                      <Activity size={28} />
                      <span>Waiting for heart-rate telemetry</span>
                    </div>
                  )}

                  <div className="chart-footer">
                    <span>
                      <span className="legend-dot" />
                      Heart-rate measurements
                    </span>
                    <span>SIMULATED DATA</span>
                  </div>
                </article>

                <article className="panel system-panel">
                  <div className="panel-heading">
                    <div>
                      <div className="panel-eyebrow">
                        <ShieldCheck size={14} />
                        SYSTEM INTELLIGENCE
                      </div>

                      <h2>Risk Monitor</h2>
                      <p>Prototype assessment overview</p>
                    </div>

                    <div className="risk-icon">
                      <ShieldCheck size={21} />
                    </div>
                  </div>

                  <div className="risk-summary">
                    <div className="risk-summary-number">
                      {data.measurements.length}
                    </div>

                    <div>
                      <strong>Measurements received</strong>
                      <span>
                        From the connected telemetry database
                      </span>
                    </div>
                  </div>

                  <div className="risk-list">
                    <div className="risk-row">
                      <div className="risk-row-icon green">
                        <ShieldCheck size={16} />
                      </div>

                      <div>
                        <strong>Data quality</strong>
                        <span>Recorded measurement quality</span>
                      </div>

                      <span className="risk-row-value">
                        {
                          data.measurements.filter(
                            (m) => m.quality === 'good',
                          ).length
                        }
                      </span>
                    </div>

                    <div className="risk-row">
                      <div className="risk-row-icon blue">
                        <Database size={16} />
                      </div>

                      <div>
                        <strong>Simulated records</strong>
                        <span>Synthetic telemetry</span>
                      </div>

                      <span className="risk-row-value">
                        {simulatedCount}
                      </span>
                    </div>

                    <div className="risk-row">
                      <div className="risk-row-icon purple">
                        <Cpu size={16} />
                      </div>

                      <div>
                        <strong>Assessment engine</strong>
                        <span>Backend prototype</span>
                      </div>

                      <span className="risk-row-status">
                        {connected ? 'READY' : 'OFFLINE'}
                      </span>
                    </div>
                  </div>

                  <div className="risk-disclaimer">
                    <AlertTriangle size={15} />
                    Prototype support only. Not a diagnosis or clinical
                    alert system.
                  </div>
                </article>
              </section>

              <section className="panel activity-panel">
                <div className="panel-heading">
                  <div>
                    <div className="panel-eyebrow">
                      <Zap size={14} />
                      LIVE DATA STREAM
                    </div>

                    <h2>Recent Telemetry Records</h2>
                    <p>
                      Latest measurements received from the backend
                    </p>
                  </div>

                  <button
                    className="table-action"
                    onClick={fetchData}
                  >
                    <RefreshCw size={14} />
                    Refresh
                  </button>
                </div>

                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>ASTRONAUT</th>
                        <th>METRIC</th>
                        <th>VALUE</th>
                        <th>SOURCE</th>
                        <th>QUALITY</th>
                        <th>TIMESTAMP</th>
                      </tr>
                    </thead>

                    <tbody>
                      {latestRecords.map((record) => {
                        const astronaut = data.astronauts.find(
                          (item) => item.id === record.astronaut_id,
                        )

                        const config = metricConfig[record.metric]

                        return (
                          <tr key={record.id}>
                            <td>
                              <div className="table-astronaut">
                                <span className="table-avatar">
                                  {astronaut?.name?.charAt(0) || '?'}
                                </span>
                                {astronaut?.name || record.astronaut_id}
                              </div>
                            </td>

                            <td>
                              {config?.label || record.metric}
                            </td>

                            <td className="table-value">
                              {record.value} {record.unit}
                            </td>

                            <td>
                              <span className="source-tag">
                                {record.source}
                              </span>
                            </td>

                            <td>
                              <span
                                className={`quality-tag ${record.quality}`}
                              >
                                {record.quality}
                              </span>
                            </td>

                            <td className="table-time">
                              {formatTime(record.measured_at)}
                            </td>
                          </tr>
                        )
                      })}

                      {latestRecords.length === 0 && (
                        <tr>
                          <td colSpan={6} className="no-records">
                            No telemetry records available.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <footer className="dashboard-footer">
                <div>
                  <Atom size={16} />
                  <span>HELIOS</span>
                  <span className="footer-divider">|</span>
                  Human Exploration Life Intelligence & Observation System
                </div>

                <div className="footer-right">
                  <span>PROTOTYPE BUILD 0.1.0</span>
                  <span className="footer-divider">•</span>
                  <span>SIMULATED ENVIRONMENT</span>
                </div>
              </footer>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  accent,
}: {
  icon: typeof Users
  label: string
  value: string
  detail: string
  accent: string
}) {
  return (
    <article className={`stat-card ${accent}`}>
      <div className="stat-top">
        <div className="stat-icon">
          <Icon size={19} />
        </div>
        <span>{label}</span>
      </div>

      <div className="stat-value">{value}</div>
      <div className="stat-detail">{detail}</div>
    </article>
  )
}

function Metric({
  icon: Icon,
  label,
  measurement,
  fallbackUnit,
}: {
  icon: typeof Heart
  label: string
  measurement?: Measurement
  fallbackUnit: string
}) {
  return (
    <div className="metric">
      <div className="metric-heading">
        <Icon size={14} />
        <span>{label}</span>
      </div>

      <div className="metric-value">
        {measurement ? (
          <>
            {measurement.value}
            <small>{measurement.unit || fallbackUnit}</small>
          </>
        ) : (
          <span className="metric-missing">--</span>
        )}
      </div>

      <div className="metric-quality">
        {measurement ? (
          <>
            <span
              className={`quality-dot ${measurement.quality}`}
            />
            {measurement.quality.toUpperCase()}
          </>
        ) : (
          'NO DATA'
        )}
      </div>
    </div>
  )
}

export default App