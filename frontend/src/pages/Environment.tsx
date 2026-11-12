import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  Clock3,
  Database,
  Gauge,
  RefreshCw,
  Radio,
  ShieldCheck,
  Thermometer,
  Wind,
  Droplets,
  Zap,
} from 'lucide-react'

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import './Environment.css'

const API_BASE = 'http://127.0.0.1:8000/api/v1'

interface EnvironmentalMeasurement {
  id: number
  metric: string
  value: number
  unit: string
  measured_at: string
  sensor_id: string | null
  zone: string
  source: string
  simulated: boolean
  quality: string
  metadata: Record<string, unknown>
}

interface MetricConfig {
  label: string
  unit: string
  icon: typeof Activity
  description: string
  color: string
  precision: number
}

const METRICS: Record<string, MetricConfig> = {
  cabin_temperature: {
    label: 'Cabin Temperature',
    unit: '°C',
    icon: Thermometer,
    description: 'Environmental thermal telemetry',
    color: '#00d5ff',
    precision: 2,
  },

  relative_humidity: {
    label: 'Relative Humidity',
    unit: '%',
    icon: Droplets,
    description: 'Cabin moisture concentration',
    color: '#4d9dff',
    precision: 2,
  },

  oxygen_concentration: {
    label: 'Oxygen Concentration',
    unit: '%',
    icon: Wind,
    description: 'Atmospheric oxygen telemetry',
    color: '#40d9a2',
    precision: 3,
  },

  cabin_pressure: {
    label: 'Cabin Pressure',
    unit: 'kPa',
    icon: Gauge,
    description: 'Cabin atmospheric pressure',
    color: '#b28aff',
    precision: 2,
  },

  co2_concentration: {
    label: 'CO₂ Concentration',
    unit: 'ppm',
    icon: Activity,
    description: 'Carbon dioxide telemetry',
    color: '#ffb454',
    precision: 1,
  },

  radiation_dose_rate: {
    label: 'Radiation Dose Rate',
    unit: 'µSv/h',
    icon: Zap,
    description: 'Environmental radiation telemetry',
    color: '#ff7195',
    precision: 3,
  },
}

const ZONES = [
  { value: 'all', label: 'All Zones' },
  { value: 'main_cabin', label: 'Main Cabin' },
  { value: 'crew_quarters', label: 'Crew Quarters' },
  { value: 'laboratory', label: 'Laboratory' },
]

const METRIC_OPTIONS = [
  { value: 'all', label: 'All Parameters' },
  ...Object.entries(METRICS).map(([value, config]) => ({
    value,
    label: config.label,
  })),
]

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatDate(value: string) {
  return new Date(value).toLocaleString()
}

function formatValue(value: number, precision: number) {
  return value.toFixed(precision)
}

function Environment() {
  const [measurements, setMeasurements] = useState<
    EnvironmentalMeasurement[]
  >([])

  const [zone, setZone] = useState('all')
  const [selectedMetric, setSelectedMetric] = useState('cabin_temperature')

  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchEnvironment = useCallback(async () => {
    try {
      setRefreshing(true)

      const response = await fetch(
        `${API_BASE}/environment?limit=1000`,
      )

      if (!response.ok) {
        throw new Error('Environmental API request failed.')
      }

      const records: EnvironmentalMeasurement[] =
        await response.json()

      setMeasurements(records)
      setConnected(true)
      setError('')
      setLastUpdated(new Date())
    } catch {
      setConnected(false)
      setError(
        'Unable to retrieve environmental telemetry. Check the backend.',
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchEnvironment()

    const interval = window.setInterval(
      fetchEnvironment,
      5000,
    )

    return () => window.clearInterval(interval)
  }, [fetchEnvironment])

  const filteredMeasurements = useMemo(() => {
    return measurements.filter((record) => {
      const matchesZone =
        zone === 'all' || record.zone === zone

      return matchesZone
    })
  }, [measurements, zone])

  const latestReadings = useMemo(() => {
    const latest = new Map<
      string,
      EnvironmentalMeasurement
    >()

    for (const record of filteredMeasurements) {
      const existing = latest.get(record.metric)

      if (
        !existing ||
        new Date(record.measured_at).getTime() >
          new Date(existing.measured_at).getTime()
      ) {
        latest.set(record.metric, record)
      }
    }

    return latest
  }, [filteredMeasurements])

  const chartData = useMemo(() => {
    return filteredMeasurements
      .filter((record) => record.metric === selectedMetric)
      .sort(
        (a, b) =>
          new Date(a.measured_at).getTime() -
          new Date(b.measured_at).getTime(),
      )
      .slice(-50)
      .map((record) => ({
        time: formatTime(record.measured_at),
        value: record.value,
        zone: record.zone,
        sensor: record.sensor_id,
        simulated: record.simulated,
        anomaly:
          record.metadata?.anomaly_injection === true,
      }))
  }, [filteredMeasurements, selectedMetric])

  const sensorCount = useMemo(() => {
    return new Set(
      filteredMeasurements
        .map((record) => record.sensor_id)
        .filter(Boolean),
    ).size
  }, [filteredMeasurements])

//   const simulatedCount = filteredMeasurements.filter(
//     (record) => record.simulated,
//   ).length

  const anomalyCount = filteredMeasurements.filter(
    (record) =>
      record.metadata?.anomaly_injection === true,
  ).length

  const qualityCount = filteredMeasurements.filter(
    (record) => record.quality === 'good',
  ).length

  const recentRecords = [...filteredMeasurements]
    .sort(
      (a, b) =>
        new Date(b.measured_at).getTime() -
        new Date(a.measured_at).getTime(),
    )
    .slice(0, 15)

  const selectedConfig = METRICS[selectedMetric]

  const exportCSV = () => {
    const headers = [
      'ID',
      'Metric',
      'Value',
      'Unit',
      'Zone',
      'Sensor',
      'Timestamp',
      'Source',
      'Simulated',
      'Quality',
      'Injected Anomaly',
    ]

    const rows = filteredMeasurements.map((record) => [
      record.id,
      record.metric,
      record.value,
      record.unit,
      record.zone,
      record.sensor_id || '',
      record.measured_at,
      record.source,
      record.simulated,
      record.quality,
      record.metadata?.anomaly_injection === true,
    ])

    const csv = [
      headers,
      ...rows,
    ]
      .map((row) =>
        row
          .map((value) => {
            const text = String(value ?? '')
            return `"${text.replace(/"/g, '""')}"`
          })
          .join(','),
      )
      .join('\n')

    const blob = new Blob(
      [csv],
      { type: 'text/csv;charset=utf-8;' },
    )

    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = 'HELIOS_environment_telemetry.csv'

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    URL.revokeObjectURL(url)
  }

  return (
    <div className="environment-page">

      {/* PAGE HEADER */}

      <section className="environment-heading">

        <div>
          <div className="environment-eyebrow">
            <span className="environment-eyebrow-line" />
            SPACECRAFT ENVIRONMENTAL INTELLIGENCE
          </div>

          <h1>Environment Monitoring</h1>

          <p>
            Spacecraft environmental telemetry and
            atmospheric monitoring.
          </p>
        </div>

        <div className="environment-heading-actions">

          <div className="environment-live-status">
            <span
              className={`environment-status-dot ${
                connected ? 'online' : 'offline'
              }`}
            />

            {connected ? 'STREAM CONNECTED' : 'STREAM OFFLINE'}
          </div>

          <button
            className="environment-refresh"
            onClick={fetchEnvironment}
            disabled={refreshing}
          >
            <RefreshCw
              size={15}
              className={refreshing ? 'environment-spin' : ''}
            />

            Refresh
          </button>

        </div>

      </section>


      {/* SIMULATION NOTICE */}

      <div className="environment-simulation-banner">
        <div className="environment-simulation-icon">
          <Database size={17} />
        </div>

        <div>
          <strong>SIMULATED ENVIRONMENTAL DATA</strong>

          <span>
            All current readings are generated by the HELIOS
            demonstration simulator. They are not actual
            spacecraft measurements.
          </span>
        </div>

        <span className="environment-simulation-tag">
          SIMULATED
        </span>
      </div>


      {/* ERROR */}

      {error && (
        <div className="environment-error">
          <AlertTriangle size={17} />
          {error}
        </div>
      )}


      {/* ZONE FILTER */}

      <section className="environment-toolbar">

        <div className="environment-zone-selector">

          <span>SPACECRAFT ZONE</span>

          <select
            value={zone}
            onChange={(event) => setZone(event.target.value)}
          >
            {ZONES.map((item) => (
              <option
                key={item.value}
                value={item.value}
              >
                {item.label}
              </option>
            ))}
          </select>

        </div>

        <div className="environment-update-time">
          <Clock3 size={14} />

          {lastUpdated
            ? `Updated ${lastUpdated.toLocaleTimeString()}`
            : 'Waiting for telemetry'}
        </div>

      </section>


      {/* STATISTICS */}

      <section className="environment-stats-grid">

        <EnvironmentStat
          icon={Radio}
          label="ACTIVE SENSORS"
          value={String(sensorCount).padStart(2, '0')}
          detail="Unique sensor identifiers"
          accent="cyan"
        />

        <EnvironmentStat
          icon={Database}
          label="TELEMETRY RECORDS"
          value={String(filteredMeasurements.length)}
          detail="Retrieved measurements"
          accent="blue"
        />

        <EnvironmentStat
          icon={ShieldCheck}
          label="GOOD QUALITY"
          value={String(qualityCount)}
          detail="Software quality label"
          accent="green"
        />

        <EnvironmentStat
          icon={AlertTriangle}
          label="INJECTED DEVIATIONS"
          value={String(anomalyCount)}
          detail="Simulator-marked records"
          accent="orange"
        />

      </section>


      {/* ENVIRONMENTAL METRIC CARDS */}

      <section className="environment-section">

        <div className="environment-section-heading">
          <div>
            <h2>Environmental Parameters</h2>

            <p>
              Latest available readings for the selected zone.
            </p>
          </div>

          <span className="environment-section-badge">
            06 PARAMETERS
          </span>
        </div>


        <div className="environment-metric-grid">

          {Object.entries(METRICS).map(([key, config]) => {
            const Icon = config.icon
            const reading = latestReadings.get(key)

            const active = selectedMetric === key

            return (
              <button
                key={key}
                className={`environment-metric-card ${
                  active ? 'selected' : ''
                }`}
                onClick={() => setSelectedMetric(key)}
                style={{
                  '--metric-color': config.color,
                } as React.CSSProperties}
              >

                <div className="environment-metric-top">

                  <div className="environment-metric-icon">
                    <Icon size={19} />
                  </div>

                  <span className="environment-metric-indicator">
                    {reading ? 'AVAILABLE' : 'NO DATA'}
                  </span>

                </div>

                <div className="environment-metric-label">
                  {config.label}
                </div>

                <div className="environment-metric-value">

                  {reading
                    ? formatValue(
                        reading.value,
                        config.precision,
                      )
                    : '--'}

                  <small>{config.unit}</small>

                </div>

                <div className="environment-metric-description">
                  {config.description}
                </div>

                <div className="environment-metric-footer">

                  <span>
                    {reading?.sensor_id || 'Sensor unavailable'}
                  </span>

                  <span>
                    {reading?.quality?.toUpperCase() || 'UNKNOWN'}
                  </span>

                </div>

              </button>
            )
          })}

        </div>

      </section>


      {/* CHART */}

      <section className="environment-chart-panel">

        <div className="environment-chart-heading">

          <div>
            <div className="environment-chart-eyebrow">
              <Activity size={14} />
              ENVIRONMENTAL TELEMETRY
            </div>

            <h2>
              {selectedConfig?.label || 'Telemetry Trends'}
            </h2>

            <p>
              Historical readings from the selected parameter.
            </p>
          </div>

          <div className="environment-chart-unit">
            {selectedConfig?.unit}
          </div>

        </div>


        <div className="environment-chart-controls">

          <label htmlFor="environment-metric-select">
            PARAMETER
          </label>

          <select
            id="environment-metric-select"
            value={selectedMetric}
            onChange={(event) =>
              setSelectedMetric(event.target.value)
            }
          >
            {METRIC_OPTIONS
              .filter((item) => item.value !== 'all')
              .map((item) => (
                <option
                  key={item.value}
                  value={item.value}
                >
                  {item.label}
                </option>
              ))}
          </select>

        </div>


        <div className="environment-chart-container">

          {chartData.length > 0 ? (

            <ResponsiveContainer
              width="100%"
              height="100%"
            >

              <LineChart
                data={chartData}
                margin={{
                  top: 15,
                  right: 15,
                  left: -15,
                  bottom: 5,
                }}
              >

                <CartesianGrid
                  stroke="#1c2b3d"
                  strokeDasharray="3 5"
                  vertical={false}
                />

                <XAxis
                  dataKey="time"
                  stroke="#64748b"
                  tick={{
                    fill: '#8292a8',
                    fontSize: 10,
                  }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={35}
                />

                <YAxis
                  stroke="#64748b"
                  tick={{
                    fill: '#8292a8',
                    fontSize: 10,
                  }}
                  tickLine={false}
                  axisLine={false}
                  domain={['auto', 'auto']}
                />

                <Tooltip
                  contentStyle={{
                    background: '#111c2c',
                    border: '1px solid #263b52',
                    borderRadius: '9px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                  formatter={(value) => [
                    `${value} ${selectedConfig?.unit || ''}`,
                    selectedConfig?.label || 'Value',
                  ]}
                  labelFormatter={(label) => `Time: ${label}`}
                />

                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={selectedConfig?.color || '#00d5ff'}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{
                    r: 5,
                    stroke: '#08111d',
                    strokeWidth: 2,
                  }}
                  isAnimationActive={false}
                />

              </LineChart>

            </ResponsiveContainer>

          ) : (

            <div className="environment-chart-empty">
              <Activity size={30} />

              <strong>
                {loading
                  ? 'Loading environmental telemetry...'
                  : 'No historical readings available'}
              </strong>

              <span>
                Start the environmental simulator to populate this chart.
              </span>
            </div>

          )}

        </div>


        <div className="environment-chart-footer">

          <span>
            <span className="environment-chart-legend-dot" />
            {selectedConfig?.label}
          </span>

          <span>
            {chartData.length} DATA POINTS
          </span>

          <span>SIMULATED DATA</span>

        </div>

      </section>


      {/* SENSOR STATUS */}

      <section className="environment-section">

        <div className="environment-section-heading">

          <div>
            <h2>Sensor Network</h2>

            <p>
              Sensor identification, quality and latest timestamps.
            </p>
          </div>

          <span className="environment-section-badge">
            {sensorCount} SENSORS
          </span>

        </div>


        <div className="environment-sensor-grid">

          {Object.keys(METRICS).map((metric) => {
            const config = METRICS[metric]
            const reading = latestReadings.get(metric)

            return (
              <div
                className="environment-sensor-card"
                key={metric}
              >

                <div className="environment-sensor-icon">
                  <Radio size={17} />
                </div>

                <div className="environment-sensor-info">

                  <strong>{config.label}</strong>

                  <span>
                    {reading?.sensor_id || 'Not detected'}
                  </span>

                  <small>
                    {reading
                      ? formatDate(reading.measured_at)
                      : 'Waiting for data'}
                  </small>

                </div>

                <div
                  className={`environment-quality ${
                    reading?.quality || 'unknown'
                  }`}
                >
                  {reading?.quality?.toUpperCase() || 'UNKNOWN'}
                </div>

              </div>
            )
          })}

        </div>

      </section>


      {/* RECENT RECORDS */}

      <section className="environment-records-panel">

        <div className="environment-section-heading">

          <div>
            <h2>Environmental Data Stream</h2>

            <p>
              Latest stored environmental measurements.
            </p>
          </div>

          <button
            className="environment-export-button"
            onClick={exportCSV}
            disabled={filteredMeasurements.length === 0}
          >
            <ArrowDownToLine size={15} />
            Export CSV
          </button>

        </div>


        <div className="environment-table-wrapper">

          <table className="environment-table">

            <thead>
              <tr>
                <th>PARAMETER</th>
                <th>VALUE</th>
                <th>ZONE</th>
                <th>SENSOR</th>
                <th>SOURCE</th>
                <th>QUALITY</th>
                <th>TIMESTAMP</th>
                <th>DATA TYPE</th>
              </tr>
            </thead>

            <tbody>

              {recentRecords.map((record) => {
                const config = METRICS[record.metric]

                const injected =
                  record.metadata?.anomaly_injection === true

                return (
                  <tr key={record.id}>

                    <td>
                      {config?.label || record.metric}
                    </td>

                    <td className="environment-table-value">
                      {record.value} {record.unit}
                    </td>

                    <td>
                      {record.zone.replace(/_/g, ' ')}
                    </td>

                    <td>
                      {record.sensor_id || '--'}
                    </td>

                    <td>
                      <span className="environment-source-tag">
                        {record.source}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`environment-quality ${
                          record.quality
                        }`}
                      >
                        {record.quality}
                      </span>
                    </td>

                    <td className="environment-table-time">
                      {formatTime(record.measured_at)}
                    </td>

                    <td>

                      {injected ? (
                        <span className="environment-anomaly-tag">
                          <AlertTriangle size={12} />
                          INJECTED
                        </span>
                      ) : record.simulated ? (
                        <span className="environment-simulated-tag">
                          SIMULATED
                        </span>
                      ) : (
                        <span className="environment-recorded-tag">
                          RECORDED
                        </span>
                      )}

                    </td>

                  </tr>
                )
              })}


              {recentRecords.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="environment-no-records"
                  >
                    {loading
                      ? 'Loading environmental records...'
                      : 'No environmental measurements available.'}
                  </td>
                </tr>
              )}

            </tbody>

          </table>

        </div>

      </section>


      {/* DISCLAIMER */}

      <div className="environment-disclaimer">

        <AlertTriangle size={16} />

        <div>
          <strong>Prototype limitation</strong>

          <span>
            HELIOS environmental telemetry is a software demonstration.
            Sensor values and injected deviations are synthetic.
            Displayed readings are not validated spacecraft operating
            limits, safety assessments or clinical measurements.
          </span>
        </div>

      </div>


      {/* FOOTER */}

      <footer className="environment-footer">

        <div>
          HELIOS <span>|</span> ENVIRONMENTAL MONITORING
        </div>

        <div>
          {filteredMeasurements.length} RECORDS
          <span>•</span>
          SIMULATED ENVIRONMENT
        </div>

      </footer>

    </div>
  )
}


// ==================================================
// STATISTICS CARD
// ==================================================

function EnvironmentStat({
  icon: Icon,
  label,
  value,
  detail,
  accent,
}: {
  icon: typeof Activity
  label: string
  value: string
  detail: string
  accent: string
}) {

  return (
    <article
      className={`environment-stat-card ${accent}`}
    >

      <div className="environment-stat-top">

        <div className="environment-stat-icon">
          <Icon size={19} />
        </div>

        <span>{label}</span>

      </div>

      <div className="environment-stat-value">
        {value}
      </div>

      <div className="environment-stat-detail">
        {detail}
      </div>

    </article>
  )
}

export default Environment