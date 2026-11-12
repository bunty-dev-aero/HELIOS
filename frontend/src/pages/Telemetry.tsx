import { useMemo, useState } from 'react'
import {
  Activity,
  Radio,
  Clock3,
  Database,
  Filter,
  Download,
  HeartPulse,
  Thermometer,
  Droplets,
  Moon,
  Signal,
  RefreshCw,
} from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts'
import './Telemetry.css'

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

interface TelemetryProps {
  astronauts: Astronaut[]
  measurements: Measurement[]
  onRefresh?: () => void
}

const metricOptions = [
  { key: 'heart_rate', label: 'Heart Rate', unit: 'bpm', icon: HeartPulse },
  { key: 'spo2', label: 'Blood Oxygen', unit: '%', icon: Droplets },
  { key: 'temperature', label: 'Temperature', unit: '°C', icon: Thermometer },
  { key: 'sleep_hours', label: 'Sleep Duration', unit: 'hrs', icon: Moon },
  { key: 'systolic_bp', label: 'Systolic BP', unit: 'mmHg', icon: Activity },
  { key: 'diastolic_bp', label: 'Diastolic BP', unit: 'mmHg', icon: Activity },
]

const chartColors = [
  '#00d5ff',
  '#a78bfa',
  '#4ade80',
  '#fb923c',
]

function formatDate(value: string) {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function Telemetry({
  astronauts,
  measurements,
  onRefresh,
}: TelemetryProps) {
  const [selectedMetric, setSelectedMetric] = useState('heart_rate')
  const [selectedCrew, setSelectedCrew] = useState('all')
  const [selectedSource, setSelectedSource] = useState('all')
  const [qualityFilter, setQualityFilter] = useState('all')
  const [showSimulated, setShowSimulated] = useState(true)

  const metric = metricOptions.find(
    (item) => item.key === selectedMetric,
  )!

  const filteredMeasurements = useMemo(() => {
    return [...measurements]
      .filter((item) => item.metric === selectedMetric)
      .filter(
        (item) =>
          selectedCrew === 'all' ||
          item.astronaut_id === selectedCrew,
      )
      .filter(
        (item) =>
          selectedSource === 'all' ||
          item.source === selectedSource,
      )
      .filter(
        (item) =>
          qualityFilter === 'all' ||
          item.quality === qualityFilter,
      )
      .filter(
        (item) => showSimulated || !item.simulated,
      )
      .sort(
        (a, b) =>
          new Date(a.measured_at).getTime() -
          new Date(b.measured_at).getTime(),
      )
  }, [
    measurements,
    selectedMetric,
    selectedCrew,
    selectedSource,
    qualityFilter,
    showSimulated,
  ])

  const chartData = useMemo(() => {
    return filteredMeasurements.map((item) => {
      const astronaut = astronauts.find(
        (person) => person.id === item.astronaut_id,
      )

      return {
        timestamp: formatDate(item.measured_at),
        value: item.value,
        crew: astronaut?.name || item.astronaut_id,
        quality: item.quality,
      }
    })
  }, [filteredMeasurements, astronauts])

  const latestMeasurement = filteredMeasurements.at(-1)

  const average = filteredMeasurements.length
    ? filteredMeasurements.reduce(
        (total, item) => total + item.value,
        0,
      ) / filteredMeasurements.length
    : null

  const goodQualityCount = filteredMeasurements.filter(
    (item) => item.quality === 'good',
  ).length

  const simulatedCount = filteredMeasurements.filter(
    (item) => item.simulated,
  ).length

  const sources = Array.from(
    new Set(measurements.map((item) => item.source)),
  )

  const timeline = [...filteredMeasurements].reverse().slice(0, 30)

  function exportCSV() {
    const headers = [
      'Measurement ID',
      'Astronaut ID',
      'Metric',
      'Value',
      'Unit',
      'Timestamp',
      'Source',
      'Quality',
      'Simulated',
    ]

    const rows = filteredMeasurements.map((item) => [
      item.id,
      item.astronaut_id,
      item.metric,
      item.value,
      item.unit,
      item.measured_at,
      item.source,
      item.quality,
      item.simulated,
    ])

    const csv = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','),
      ),
    ].join('\n')

    const blob = new Blob([csv], {
      type: 'text/csv;charset=utf-8;',
    })

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = `helios-telemetry-${selectedMetric}.csv`
    link.click()

    URL.revokeObjectURL(url)
  }

  return (
    <div className="telemetry-page">
      <section className="telemetry-heading">
        <div>
          <div className="telemetry-eyebrow">
            <Radio size={14} />
            MISSION DATA / TELEMETRY STREAM
          </div>

          <h1>Telemetry Center</h1>

          <p>
            Monitor, filter and analyse biometric telemetry across the crew.
          </p>
        </div>

        <div className="telemetry-heading-actions">
          <div className="telemetry-connection">
            <span />
            API DATA
          </div>

          <button
            className="telemetry-action-button"
            onClick={onRefresh}
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        </div>
      </section>

      <section className="telemetry-stats">
        <article className="telemetry-stat">
          <div className="telemetry-stat-icon cyan">
            <Database size={19} />
          </div>
          <div>
            <span>FILTERED RECORDS</span>
            <strong>{filteredMeasurements.length}</strong>
          </div>
        </article>

        <article className="telemetry-stat">
          <div className="telemetry-stat-icon purple">
            <Activity size={19} />
          </div>
          <div>
            <span>AVERAGE VALUE</span>
            <strong>
              {average !== null ? average.toFixed(2) : '--'}
              <small>{metric.unit}</small>
            </strong>
          </div>
        </article>

        <article className="telemetry-stat">
          <div className="telemetry-stat-icon green">
            <Signal size={19} />
          </div>
          <div>
            <span>GOOD QUALITY RECORDS</span>
            <strong>{goodQualityCount}</strong>
          </div>
        </article>

        <article className="telemetry-stat">
          <div className="telemetry-stat-icon orange">
            <Clock3 size={19} />
          </div>
          <div>
            <span>LATEST READING</span>
            <strong className="telemetry-stat-time">
              {latestMeasurement
                ? new Date(
                    latestMeasurement.measured_at,
                  ).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '--'}
            </strong>
          </div>
        </article>
      </section>

      <section className="telemetry-filter-panel">
        <div className="telemetry-filter-heading">
          <div>
            <Filter size={16} />
            <h2>Data Filters</h2>
          </div>

          <button
            onClick={() => {
              setSelectedCrew('all')
              setSelectedSource('all')
              setQualityFilter('all')
              setShowSimulated(true)
            }}
          >
            Reset filters
          </button>
        </div>

        <div className="telemetry-filters">
          <label>
            <span>METRIC</span>
            <select
              value={selectedMetric}
              onChange={(event) =>
                setSelectedMetric(event.target.value)
              }
            >
              {metricOptions.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>CREW MEMBER</span>
            <select
              value={selectedCrew}
              onChange={(event) =>
                setSelectedCrew(event.target.value)
              }
            >
              <option value="all">All crew members</option>
              {astronauts.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>DATA SOURCE</span>
            <select
              value={selectedSource}
              onChange={(event) =>
                setSelectedSource(event.target.value)
              }
            >
              <option value="all">All sources</option>
              {sources.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>DATA QUALITY</span>
            <select
              value={qualityFilter}
              onChange={(event) =>
                setQualityFilter(event.target.value)
              }
            >
              <option value="all">All qualities</option>
              <option value="good">Good</option>
              <option value="low">Low</option>
              <option value="unknown">Unknown</option>
            </select>
          </label>
        </div>

        <label className="telemetry-simulated-toggle">
          <input
            type="checkbox"
            checked={showSimulated}
            onChange={(event) =>
              setShowSimulated(event.target.checked)
            }
          />
          Include simulated records
        </label>
      </section>

      <section className="telemetry-chart-panel">
        <div className="telemetry-panel-heading">
          <div>
            <div className="telemetry-panel-eyebrow">
              BIOMETRIC DATA VISUALIZATION
            </div>
            <h2>{metric.label} Trend</h2>
            <p>
              {filteredMeasurements.length} matching records ·{' '}
              {selectedCrew === 'all'
                ? 'All crew members'
                : astronauts.find(
                    (person) => person.id === selectedCrew,
                  )?.name}
            </p>
          </div>

          <div className="telemetry-chart-unit">
            {metric.unit}
          </div>
        </div>

        <div className="telemetry-chart-legend">
          {selectedCrew === 'all'
            ? astronauts.map((person, index) => (
                <span key={person.id}>
                  <i
                    style={{
                      background:
                        chartColors[index % chartColors.length],
                    }}
                  />
                  {person.name}
                </span>
              ))
            : (
              <span>
                <i style={{ background: chartColors[0] }} />
                {astronauts.find(
                  (person) => person.id === selectedCrew,
                )?.name}
              </span>
            )}
        </div>

        <div className="telemetry-chart">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{
                  top: 15,
                  right: 20,
                  left: -15,
                  bottom: 5,
                }}
              >
                <CartesianGrid
                  stroke="#223248"
                  strokeDasharray="3 5"
                />

                <XAxis
                  dataKey="timestamp"
                  stroke="#718096"
                  tick={{ fill: '#8798ad', fontSize: 10 }}
                  minTickGap={35}
                />

                <YAxis
                  stroke="#718096"
                  tick={{ fill: '#8798ad', fontSize: 10 }}
                  domain={['auto', 'auto']}
                />

                <Tooltip
                  contentStyle={{
                    background: '#111d2d',
                    border: '1px solid #2b4058',
                    borderRadius: 8,
                    color: '#e5edf7',
                  }}
                  formatter={(value) => [
                    `${value} ${metric.unit}`,
                    metric.label,
                  ]}
                />

                <Legend />

                {selectedCrew === 'all'
                  ? astronauts.map((person, index) => (
                      <Line
                        key={person.id}
                        type="monotone"
                        dataKey={(entry: (typeof chartData)[number]) =>
                          entry.crew === person.name
                            ? entry.value
                            : null
                        }
                        name={person.name}
                        stroke={
                          chartColors[index % chartColors.length]
                        }
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                    ))
                  : (
                    <Line
                      type="monotone"
                      dataKey="value"
                      name={metric.label}
                      stroke={chartColors[0]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 6 }}
                    />
                  )}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="telemetry-empty">
              <Activity size={30} />
              <strong>No matching telemetry records</strong>
              <span>Try changing the filters or selecting another metric.</span>
            </div>
          )}
        </div>

        <div className="telemetry-chart-footer">
          <span>
            <i />
            Historical measurements from the HELIOS database
          </span>
          <span>NO CLINICAL INTERPRETATION</span>
        </div>
      </section>

      <section className="telemetry-timeline-panel">
        <div className="telemetry-panel-heading">
          <div>
            <div className="telemetry-panel-eyebrow">
              RECORD HISTORY
            </div>
            <h2>Measurement Timeline</h2>
            <p>Latest matching records, newest first.</p>
          </div>

          <button
            className="telemetry-export-button"
            onClick={exportCSV}
            disabled={filteredMeasurements.length === 0}
          >
            <Download size={15} />
            Export CSV
          </button>
        </div>

        <div className="telemetry-table-wrap">
          <table className="telemetry-table">
            <thead>
              <tr>
                <th>CREW MEMBER</th>
                <th>METRIC</th>
                <th>VALUE</th>
                <th>TIMESTAMP</th>
                <th>SOURCE</th>
                <th>QUALITY</th>
                <th>DATA TYPE</th>
              </tr>
            </thead>

            <tbody>
              {timeline.map((item) => {
                const person = astronauts.find(
                  (astronaut) => astronaut.id === item.astronaut_id,
                )

                return (
                  <tr key={item.id}>
                    <td>{person?.name || item.astronaut_id}</td>
                    <td>
                      {metricOptions.find(
                        (option) => option.key === item.metric,
                      )?.label || item.metric}
                    </td>
                    <td className="telemetry-value">
                      {item.value} {item.unit}
                    </td>
                    <td>{formatDate(item.measured_at)}</td>
                    <td>
                      <span className="telemetry-source-tag">
                        {item.source}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`telemetry-quality-tag ${item.quality}`}
                      >
                        {item.quality}
                      </span>
                    </td>
                    <td>
                      {item.simulated ? (
                        <span className="telemetry-simulated-tag">
                          SIMULATED
                        </span>
                      ) : (
                        <span className="telemetry-recorded-tag">
                          RECORDED
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}

              {timeline.length === 0 && (
                <tr>
                  <td colSpan={7} className="telemetry-table-empty">
                    No records match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="telemetry-table-footer">
          Displaying {timeline.length} of {filteredMeasurements.length}{' '}
          matching records.
        </div>
      </section>

      <div className="telemetry-disclaimer">
        <Activity size={15} />
        <p>
          HELIOS telemetry is a prototype monitoring interface. Synthetic
          readings are explicitly identified as simulated. Measurements
          and visual trends are not medical diagnoses or clinical
          assessments.
        </p>
      </div>

      <div className="telemetry-data-summary">
        <span>
          <Database size={14} />
          {simulatedCount} simulated records in current selection
        </span>
        <span>
          {latestMeasurement
            ? `Latest record: ${formatDate(latestMeasurement.measured_at)}`
            : 'No latest record available'}
        </span>
      </div>
    </div>
  )
}

export default Telemetry