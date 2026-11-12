import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  HeartPulse,
  Thermometer,
  Droplets,
  Moon,
  AlertTriangle,
  ShieldCheck,
  Clock3,
  UserRound,
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
import './CrewHealth.css'

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

interface AssessmentAlert {
  level: string
  metric: string
  message: string
  reason?: string
  simulated_data?: boolean
}

interface AssessmentResult {
  measurement_id: number
  alerts: AssessmentAlert[]
  disclaimer?: string
}

interface CrewHealthProps {
  astronauts: Astronaut[]
  measurements: Measurement[]
}

const metricConfig = {
  heart_rate: {
    label: 'Heart Rate',
    unit: 'bpm',
    icon: HeartPulse,
    description: 'Latest recorded heart rate',
  },
  spo2: {
    label: 'Blood Oxygen',
    unit: '%',
    icon: Droplets,
    description: 'Latest recorded SpO₂',
  },
  temperature: {
    label: 'Body Temperature',
    unit: '°C',
    icon: Thermometer,
    description: 'Latest recorded temperature',
  },
  sleep_hours: {
    label: 'Sleep Duration',
    unit: 'hrs',
    icon: Moon,
    description: 'Latest recorded sleep duration',
  },
}

type MetricKey = keyof typeof metricConfig

function formatTime(value: string) {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function CrewHealth({
  astronauts,
  measurements,
}: CrewHealthProps) {
  const [selectedAstronautId, setSelectedAstronautId] = useState('')
  const [assessments, setAssessments] = useState<AssessmentResult[]>([])
  const [assessmentLoading, setAssessmentLoading] = useState(false)

  useEffect(() => {
    if (
      astronauts.length > 0 &&
      !astronauts.some((person) => person.id === selectedAstronautId)
    ) {
      setSelectedAstronautId(astronauts[0].id)
    }
  }, [astronauts, selectedAstronautId])

  const selectedAstronaut = astronauts.find(
    (person) => person.id === selectedAstronautId,
  )

  const crewMeasurements = useMemo(() => {
    return measurements
      .filter((item) => item.astronaut_id === selectedAstronautId)
      .sort(
        (a, b) =>
          new Date(a.measured_at).getTime() -
          new Date(b.measured_at).getTime(),
      )
  }, [measurements, selectedAstronautId])

  const latestMeasurements = useMemo(() => {
    const latest: Partial<Record<MetricKey, Measurement>> = {}

    for (const measurement of crewMeasurements) {
      if (measurement.metric in metricConfig) {
        latest[measurement.metric as MetricKey] = measurement
      }
    }

    return latest
  }, [crewMeasurements])

  const chartData = useMemo(() => {
    return crewMeasurements
      .filter(
        (item) =>
          item.metric === 'heart_rate' || item.metric === 'spo2',
      )
      .slice(-30)
      .map((item) => ({
        time: new Date(item.measured_at).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        heartRate:
          item.metric === 'heart_rate' ? item.value : null,
        spo2: item.metric === 'spo2' ? item.value : null,
        metric: item.metric,
      }))
  }, [crewMeasurements])

  const recentMeasurements = [...crewMeasurements]
    .reverse()
    .slice(0, 12)

  useEffect(() => {
    let cancelled = false

    async function loadAssessments() {
      if (!selectedAstronautId) {
        setAssessments([])
        return
      }

      const latestRecords = Object.values(latestMeasurements).filter(
        (item): item is Measurement => Boolean(item),
      )

      if (latestRecords.length === 0) {
        setAssessments([])
        return
      }

      setAssessmentLoading(true)

      try {
        const results = await Promise.allSettled(
          latestRecords.map(async (measurement) => {
            const response = await fetch(
              `${API_BASE}/measurements/${measurement.id}/assessment`,
            )

            if (!response.ok) {
              throw new Error('Assessment request failed')
            }

            return (await response.json()) as AssessmentResult
          }),
        )

        if (cancelled) return

        const successful = results
          .filter(
            (
              result,
            ): result is PromiseFulfilledResult<AssessmentResult> =>
              result.status === 'fulfilled',
          )
          .map((result) => result.value)

        setAssessments(successful)
      } catch {
        if (!cancelled) setAssessments([])
      } finally {
        if (!cancelled) setAssessmentLoading(false)
      }
    }

    loadAssessments()

    return () => {
      cancelled = true
    }
  }, [selectedAstronautId, latestMeasurements])

  const allAlerts = assessments.flatMap((item) => item.alerts || [])

  if (astronauts.length === 0) {
    return (
      <div className="crew-health-empty">
        <UserRound size={30} />
        <h2>No crew members available</h2>
        <p>Connect to the HELIOS backend to load crew data.</p>
      </div>
    )
  }

  return (
    <div className="crew-health-page">
      <div className="crew-health-heading">
        <div>
          <div className="crew-health-eyebrow">
            <Activity size={14} />
            CREW MONITORING / HEALTH PROFILE
          </div>
          <h1>Crew Health</h1>
          <p>
            Individual health telemetry and measurement history.
          </p>
        </div>

        <div className="crew-health-live">
          <span className="crew-health-live-dot" />
          BACKEND CONNECTED
        </div>
      </div>

      <section className="crew-health-selector-panel">
        <div className="crew-health-selector-label">
          <UserRound size={17} />
          SELECT CREW MEMBER
        </div>

        <div className="crew-health-crew-list">
          {astronauts.map((astronaut) => (
            <button
              key={astronaut.id}
              className={`crew-health-crew-button ${
                selectedAstronautId === astronaut.id ? 'active' : ''
              }`}
              onClick={() => setSelectedAstronautId(astronaut.id)}
            >
              <span className="crew-health-avatar">
                {astronaut.name
                  .split(' ')
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </span>

              <span className="crew-health-crew-info">
                <strong>{astronaut.name}</strong>
                <small>{astronaut.mission_role}</small>
              </span>

              <span className="crew-health-crew-day">
                D+{astronaut.mission_day}
              </span>
            </button>
          ))}
        </div>
      </section>

      {selectedAstronaut && (
        <>
          <section className="crew-health-profile">
            <div className="crew-health-profile-main">
              <div className="crew-health-profile-avatar">
                {selectedAstronaut.name
                  .split(' ')
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </div>

              <div>
                <span className="crew-health-eyebrow">
                  CREW MEMBER PROFILE
                </span>
                <h2>{selectedAstronaut.name}</h2>
                <p>
                  {selectedAstronaut.mission_role} ·{' '}
                  {selectedAstronaut.id}
                </p>
              </div>
            </div>

            <div className="crew-health-profile-meta">
              <div>
                <span>MISSION DAY</span>
                <strong>D+{selectedAstronaut.mission_day}</strong>
              </div>
              <div>
                <span>DATA TYPE</span>
                <strong>
                  {selectedAstronaut.is_simulated
                    ? 'SIMULATED'
                    : 'NON-SIMULATED'}
                </strong>
              </div>
              <div>
                <span>RECORDS</span>
                <strong>{crewMeasurements.length}</strong>
              </div>
            </div>
          </section>

          <div className="crew-health-section-title">
            <div>
              <h2>Latest Measurements</h2>
              <p>Most recent available record for each indicator.</p>
            </div>
            <span className="crew-health-data-tag">
              {crewMeasurements.some((item) => item.simulated)
                ? 'SIMULATED DATA'
                : 'LIVE DATA'}
            </span>
          </div>

          <section className="crew-health-vitals-grid">
            {(Object.keys(metricConfig) as MetricKey[]).map((key) => {
              const config = metricConfig[key]
              const Icon = config.icon
              const measurement = latestMeasurements[key]

              return (
                <article className="crew-health-vital-card" key={key}>
                  <div className="crew-health-vital-top">
                    <span className="crew-health-vital-icon">
                      <Icon size={19} />
                    </span>
                    <span className="crew-health-vital-label">
                      {config.label}
                    </span>
                  </div>

                  {measurement ? (
                    <>
                      <div className="crew-health-vital-value">
                        {measurement.value.toFixed(1)}
                        <span>{config.unit}</span>
                      </div>
                      <div className="crew-health-vital-footer">
                        <span>{formatTime(measurement.measured_at)}</span>
                        <span
                          className={`quality-tag ${measurement.quality}`}
                        >
                          {measurement.quality}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="crew-health-no-data">
                      No measurement available
                    </div>
                  )}
                </article>
              )
            })}
          </section>

          <section className="crew-health-chart-panel">
            <div className="crew-health-section-title">
              <div>
                <h2>Telemetry History</h2>
                <p>Recorded heart rate and SpO₂ measurements.</p>
              </div>
              <span className="crew-health-data-tag">
                LAST 30 RECORDS
              </span>
            </div>

            {chartData.length > 0 ? (
              <div className="crew-health-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 12, right: 16, left: -15, bottom: 0 }}
                  >
                    <CartesianGrid
                      stroke="#233247"
                      strokeDasharray="3 5"
                    />
                    <XAxis
                      dataKey="time"
                      stroke="#718096"
                      tick={{ fill: '#8292a8', fontSize: 11 }}
                    />
                    <YAxis
                      stroke="#718096"
                      tick={{ fill: '#8292a8', fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#111d2d',
                        border: '1px solid #2b4058',
                        borderRadius: 8,
                        color: '#e5edf7',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="heartRate"
                      name="Heart Rate (bpm)"
                      stroke="#00d5ff"
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="spo2"
                      name="SpO₂ (%)"
                      stroke="#8b8cff"
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="crew-health-no-chart">
                No heart rate or SpO₂ history is available for this crew member.
              </div>
            )}
          </section>

          <section className="crew-health-assessment-panel">
            <div className="crew-health-section-title">
              <div>
                <h2>Measurement Assessment</h2>
                <p>
                  Software-generated data-quality warnings from the backend.
                </p>
              </div>
              <span className="crew-health-data-tag">PROTOTYPE</span>
            </div>

            {assessmentLoading ? (
              <p className="crew-health-assessment-message">
                Loading measurement assessments...
              </p>
            ) : allAlerts.length > 0 ? (
              allAlerts.map((alert, index) => (
                <div className="crew-health-alert" key={index}>
                  <AlertTriangle size={18} />
                  <div>
                    <strong>{alert.message}</strong>
                    <p>{alert.reason}</p>
                    <small>
                      {alert.metric} · {alert.level.toUpperCase()}
                    </small>
                  </div>
                </div>
              ))
            ) : (
              <div className="crew-health-no-alerts">
                <ShieldCheck size={20} />
                <div>
                  <strong>No backend warnings for these records</strong>
                  <p>
                    This does not establish that the crew member is medically
                    healthy or that the measurements are clinically normal.
                  </p>
                </div>
              </div>
            )}

            <div className="crew-health-disclaimer">
              <AlertTriangle size={15} />
              Prototype support only. This assessment is not a diagnosis or
              clinical alert.
            </div>
          </section>

          <section className="crew-health-history-panel">
            <div className="crew-health-section-title">
              <div>
                <h2>Recent Measurement Records</h2>
                <p>Latest recorded telemetry for this crew member.</p>
              </div>
              <span className="crew-health-data-tag">
                {recentMeasurements.length} RECORDS
              </span>
            </div>

            <div className="crew-health-table-wrap">
              <table className="crew-health-table">
                <thead>
                  <tr>
                    <th>METRIC</th>
                    <th>VALUE</th>
                    <th>TIME</th>
                    <th>SOURCE</th>
                    <th>QUALITY</th>
                    <th>DATA</th>
                  </tr>
                </thead>
                <tbody>
                  {recentMeasurements.map((measurement) => (
                    <tr key={measurement.id}>
                      <td>{measurement.metric.replaceAll('_', ' ')}</td>
                      <td>
                        {measurement.value} {measurement.unit}
                      </td>
                      <td>
                        <span className="crew-health-time">
                          <Clock3 size={13} />
                          {formatTime(measurement.measured_at)}
                        </span>
                      </td>
                      <td>{measurement.source}</td>
                      <td>
                        <span
                          className={`quality-tag ${measurement.quality}`}
                        >
                          {measurement.quality}
                        </span>
                      </td>
                      <td>
                        {measurement.simulated ? (
                          <span className="simulated-tag">SIMULATED</span>
                        ) : (
                          <span className="recorded-tag">RECORDED</span>
                        )}
                      </td>
                    </tr>
                  ))}

                  {recentMeasurements.length === 0 && (
                    <tr>
                      <td colSpan={6} className="crew-health-table-empty">
                        No measurement records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

export default CrewHealth