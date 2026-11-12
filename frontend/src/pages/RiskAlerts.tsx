import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Filter,
  RefreshCw,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react'

interface Astronaut {
  id: string
  name: string
  mission_role?: string
  mission_day?: number
  is_simulated?: boolean
  created_at?: string
}
import './RiskAlerts.css'

const API_BASE = 'http://127.0.0.1:8000/api/v1'

type AlertLevel = 'info' | 'watch' | 'review'
type AlertStatus = 'open' | 'acknowledged' | 'resolved'

interface AlertRecord {
  id: number
  astronaut_id: string
  measurement_id: number
  level: AlertLevel
  status: AlertStatus
  metric: string
  observed_value: number
  unit: string
  baseline_median: number | null
  robust_deviation: number | null
  message: string
  reason: string
  recommended_action: string | null
  simulated: boolean
  created_at: string
}

interface AlertDetails extends AlertRecord {
  median_absolute_deviation?: number | null
  robust_sigma?: number | null
  direction?: string | null
  baseline_snapshot?: Record<string, unknown>
  detection_snapshot?: Record<string, unknown>
  acknowledged_at?: string | null
  resolved_at?: string | null
  disclaimer?: string
}

interface AlertsResponse {
  total: number
  alerts: AlertRecord[]
  disclaimer?: string
}

interface RiskAlertsProps {
  astronauts: Astronaut[]
  onRefresh?: () => void
}

const formatMetric = (metric: string) =>
  metric
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())

const formatDate = (value: string) => {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return 'Unknown time'

  return date.toLocaleString()
}

const formatNumber = (value: number | null | undefined) =>
  value === null || value === undefined
    ? 'N/A'
    : Number(value).toFixed(2)

const getLevelLabel = (level: AlertLevel) =>
  level.toUpperCase()

const getStatusLabel = (status: AlertStatus) =>
  status.charAt(0).toUpperCase() + status.slice(1)

export default function RiskAlerts({
  astronauts,
  onRefresh,
}: RiskAlertsProps) {
  const [alerts, setAlerts] = useState<AlertRecord[]>([])
  const [selectedAlert, setSelectedAlert] =
    useState<AlertDetails | null>(null)

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [crewFilter, setCrewFilter] = useState('all')

  const [showDetails, setShowDetails] = useState(false)

  // --------------------------------------------------
  // LOAD ALERTS
  // --------------------------------------------------

  const fetchAlerts = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      setError('')

      const response = await fetch(`${API_BASE}/alerts`)

      if (!response.ok) {
        throw new Error(`Unable to load alerts (${response.status})`)
      }

      const data: AlertsResponse = await response.json()

      setAlerts(data.alerts ?? [])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load alert records.',
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchAlerts()

    const interval = window.setInterval(() => {
      fetchAlerts(true)
    }, 10000)

    return () => window.clearInterval(interval)
  }, [fetchAlerts])

  // --------------------------------------------------
  // ALERT STATISTICS
  // --------------------------------------------------

  const statistics = useMemo(() => {
    return {
      total: alerts.length,

      open: alerts.filter(
        (alert) => alert.status === 'open',
      ).length,

      acknowledged: alerts.filter(
        (alert) => alert.status === 'acknowledged',
      ).length,

      resolved: alerts.filter(
        (alert) => alert.status === 'resolved',
      ).length,

      watch: alerts.filter(
        (alert) => alert.level === 'watch',
      ).length,

      review: alerts.filter(
        (alert) => alert.level === 'review',
      ).length,
    }
  }, [alerts])

  // --------------------------------------------------
  // CREW ALERT SUMMARIES
  // --------------------------------------------------

  const crewSummaries = useMemo(() => {
    return astronauts.map((astronaut) => {
      const crewAlerts = alerts.filter(
        (alert) => alert.astronaut_id === astronaut.id,
      )

      return {
        astronaut,
        total: crewAlerts.length,
        open: crewAlerts.filter(
          (alert) => alert.status === 'open',
        ).length,
        watch: crewAlerts.filter(
          (alert) => alert.level === 'watch',
        ).length,
        review: crewAlerts.filter(
          (alert) => alert.level === 'review',
        ).length,
      }
    })
  }, [astronauts, alerts])

  // --------------------------------------------------
  // FILTER ALERTS
  // --------------------------------------------------

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      const astronaut = astronauts.find(
        (item) => item.id === alert.astronaut_id,
      )

      const searchText = [
        alert.metric,
        alert.message,
        alert.reason,
        alert.astronaut_id,
        astronaut?.name ?? '',
        String(alert.id),
      ]
        .join(' ')
        .toLowerCase()

      const matchesSearch = searchText.includes(
        search.toLowerCase(),
      )

      const matchesLevel =
        levelFilter === 'all' ||
        alert.level === levelFilter

      const matchesStatus =
        statusFilter === 'all' ||
        alert.status === statusFilter

      const matchesCrew =
        crewFilter === 'all' ||
        alert.astronaut_id === crewFilter

      return (
        matchesSearch &&
        matchesLevel &&
        matchesStatus &&
        matchesCrew
      )
    })
  }, [
    alerts,
    astronauts,
    search,
    levelFilter,
    statusFilter,
    crewFilter,
  ])

  // --------------------------------------------------
  // LOAD ALERT DETAILS
  // --------------------------------------------------

  const openAlertDetails = async (alertId: number) => {
    try {
      setError('')
      setShowDetails(true)
      setSelectedAlert(null)

      const response = await fetch(
        `${API_BASE}/alerts/${alertId}`,
      )

      if (!response.ok) {
        throw new Error('Unable to load alert details.')
      }

      const data: AlertDetails = await response.json()

      setSelectedAlert(data)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load alert details.',
      )

      setShowDetails(false)
    }
  }

  // --------------------------------------------------
  // ALERT ACTIONS
  // --------------------------------------------------

  const performAlertAction = async (
    alertId: number,
    action: 'acknowledge' | 'resolve',
  ) => {
    try {
      setActionLoading(true)
      setError('')
      setSuccessMessage('')

      const response = await fetch(
        `${API_BASE}/alerts/${alertId}/${action}`,
        {
          method: 'PATCH',
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.detail ?? `Unable to ${action} alert.`,
        )
      }

      setSuccessMessage(
        action === 'acknowledge'
          ? 'Alert acknowledged successfully.'
          : 'Alert resolved successfully.',
      )

      await fetchAlerts(true)

      if (showDetails) {
        await openAlertDetails(alertId)
      }

      onRefresh?.()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Alert action failed.',
      )
    } finally {
      setActionLoading(false)
    }
  }

  // --------------------------------------------------
  // ASTRONAUT NAME
  // --------------------------------------------------

  const getAstronautName = (astronautId: string) => {
    return (
      astronauts.find(
        (astronaut) => astronaut.id === astronautId,
      )?.name ?? astronautId
    )
  }

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  return (
    <div className="risk-page">

      {/* PAGE HEADER */}

      <div className="risk-page-header">

        <div>
          <div className="risk-eyebrow">
            <ShieldAlert size={14} />
            HEALTH INTELLIGENCE SYSTEM
          </div>

          <h1>Risk & Alerts</h1>

          <p>
            Crew deviation monitoring, statistical alerts
            and human review management.
          </p>
        </div>

        <button
          className="risk-refresh-button"
          onClick={() => fetchAlerts(true)}
          disabled={refreshing}
        >
          <RefreshCw
            size={16}
            className={refreshing ? 'risk-spinning' : ''}
          />
          Refresh
        </button>

      </div>

      {/* ERROR / SUCCESS */}

      {error && (
        <div className="risk-notification risk-error">
          <AlertCircle size={17} />
          {error}

          <button onClick={() => setError('')}>
            <X size={15} />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="risk-notification risk-success">
          <CheckCircle2 size={17} />
          {successMessage}

          <button onClick={() => setSuccessMessage('')}>
            <X size={15} />
          </button>
        </div>
      )}

      {/* STATISTICS */}

      <section className="risk-stats-grid">

        <div className="risk-stat-card">
          <div className="risk-stat-icon total">
            <Bell size={19} />
          </div>

          <span>Total Alerts</span>
          <strong>{statistics.total}</strong>

          <small>Stored alert records</small>
        </div>

        <div className="risk-stat-card">
          <div className="risk-stat-icon open">
            <AlertCircle size={19} />
          </div>

          <span>Open</span>
          <strong>{statistics.open}</strong>

          <small>Awaiting acknowledgement</small>
        </div>

        <div className="risk-stat-card">
          <div className="risk-stat-icon acknowledged">
            <Check size={19} />
          </div>

          <span>Acknowledged</span>
          <strong>{statistics.acknowledged}</strong>

          <small>Seen by a reviewer</small>
        </div>

        <div className="risk-stat-card">
          <div className="risk-stat-icon resolved">
            <CheckCircle2 size={19} />
          </div>

          <span>Resolved</span>
          <strong>{statistics.resolved}</strong>

          <small>Closed alert records</small>
        </div>

      </section>

      {/* SEVERITY OVERVIEW */}

      <section className="risk-section">

        <div className="risk-section-heading">
          <div>
            <span className="risk-section-label">
              CLASSIFICATION
            </span>

            <h2>Severity Distribution</h2>
          </div>
        </div>

        <div className="risk-severity-grid">

          <div className="risk-severity-card watch">
            <div className="risk-severity-heading">
              <AlertTriangle size={18} />
              WATCH
            </div>

            <strong>{statistics.watch}</strong>

            <p>Statistical deviations requiring monitoring.</p>
          </div>

          <div className="risk-severity-card review">
            <div className="risk-severity-heading">
              <ShieldAlert size={18} />
              REVIEW
            </div>

            <strong>{statistics.review}</strong>

            <p>Statistical deviations requiring human review.</p>
          </div>

        </div>

      </section>

      {/* CREW OVERVIEW */}

      <section className="risk-section">

        <div className="risk-section-heading">
          <div>
            <span className="risk-section-label">
              CREW MONITORING
            </span>

            <h2>Crew Alert Overview</h2>
          </div>

          <span className="risk-section-count">
            {astronauts.length} CREW MEMBERS
          </span>
        </div>

        <div className="risk-crew-grid">

          {crewSummaries.map((item) => (
            <button
              key={item.astronaut.id}
              className={`risk-crew-card ${
                crewFilter === item.astronaut.id
                  ? 'selected'
                  : ''
              }`}
              onClick={() =>
                setCrewFilter(
                  crewFilter === item.astronaut.id
                    ? 'all'
                    : item.astronaut.id,
                )
              }
            >

              <div className="risk-crew-top">
                <div className="risk-crew-avatar">
                  {item.astronaut.name
                    .split(' ')
                    .map((part) => part[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </div>

                <div>
                  <strong>{item.astronaut.name}</strong>
                  <span>{item.astronaut.id}</span>
                </div>

                <ChevronRight size={16} />
              </div>

              <div className="risk-crew-numbers">
                <div>
                  <strong>{item.total}</strong>
                  <span>Total</span>
                </div>

                <div>
                  <strong>{item.open}</strong>
                  <span>Open</span>
                </div>

                <div>
                  <strong>{item.review}</strong>
                  <span>Review</span>
                </div>
              </div>

            </button>
          ))}

        </div>

      </section>

      {/* ALERT FEED */}

      <section className="risk-section">

        <div className="risk-section-heading">
          <div>
            <span className="risk-section-label">
              EVENT MANAGEMENT
            </span>

            <h2>Alert Feed</h2>
          </div>

          <span className="risk-section-count">
            {filteredAlerts.length} RECORDS
          </span>
        </div>

        {/* FILTERS */}

        <div className="risk-filter-bar">

          <div className="risk-search-box">
            <Search size={16} />

            <input
              type="text"
              placeholder="Search alerts, crew or metrics..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </div>

          <div className="risk-filter-control">
            <Filter size={15} />

            <select
              value={levelFilter}
              onChange={(event) =>
                setLevelFilter(event.target.value)
              }
            >
              <option value="all">All severity</option>
              <option value="watch">Watch</option>
              <option value="review">Review</option>
            </select>
          </div>

          <div className="risk-filter-control">
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
            >
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>

          <div className="risk-filter-control">
            <select
              value={crewFilter}
              onChange={(event) =>
                setCrewFilter(event.target.value)
              }
            >
              <option value="all">All crew</option>

              {astronauts.map((astronaut) => (
                <option
                  key={astronaut.id}
                  value={astronaut.id}
                >
                  {astronaut.name}
                </option>
              ))}
            </select>
          </div>

        </div>

        {/* ALERT LIST */}

        <div className="risk-alert-list">

          {loading ? (
            <div className="risk-empty-state">
              <RefreshCw className="risk-spinning" size={23} />
              <p>Loading alert records...</p>
            </div>
          ) : filteredAlerts.length === 0 ? (
            <div className="risk-empty-state">
              <Activity size={28} />

              <strong>No matching alerts</strong>

              <p>
                There are no alert records matching
                the selected filters.
              </p>
            </div>
          ) : (
            filteredAlerts.map((alert) => (

              <div
                key={alert.id}
                className={`risk-alert-item ${alert.level}`}
              >

                <div className="risk-alert-indicator" />

                <div className="risk-alert-main">

                  <div className="risk-alert-title-row">

                    <span
                      className={`risk-level-badge ${alert.level}`}
                    >
                      {getLevelLabel(alert.level)}
                    </span>

                    <span
                      className={`risk-status-badge ${alert.status}`}
                    >
                      {getStatusLabel(alert.status)}
                    </span>

                    {alert.simulated && (
                      <span className="risk-simulated-badge">
                        SIMULATED
                      </span>
                    )}

                  </div>

                  <h3>{alert.message}</h3>

                  <p className="risk-alert-description">
                    {alert.reason}
                  </p>

                  <div className="risk-alert-meta">

                    <span>
                      <Activity size={13} />
                      {getAstronautName(alert.astronaut_id)}
                    </span>

                    <span>
                      {formatMetric(alert.metric)}
                    </span>

                    <span>
                      <Clock size={13} />
                      {formatDate(alert.created_at)}
                    </span>

                  </div>

                </div>

                <div className="risk-alert-value">

                  <strong>
                    {formatNumber(alert.observed_value)}
                  </strong>

                  <span>{alert.unit}</span>

                  <small>
                    Baseline: {formatNumber(alert.baseline_median)}
                  </small>

                </div>

                <div className="risk-alert-actions">

                  <button
                    className="risk-details-button"
                    onClick={() => openAlertDetails(alert.id)}
                  >
                    Details
                    <ChevronRight size={15} />
                  </button>

                  {alert.status === 'open' && (
                    <button
                      className="risk-ack-button"
                      disabled={actionLoading}
                      onClick={() =>
                        performAlertAction(
                          alert.id,
                          'acknowledge',
                        )
                      }
                    >
                      Acknowledge
                    </button>
                  )}

                  {(alert.status === 'open' ||
                    alert.status === 'acknowledged') && (
                    <button
                      className="risk-resolve-button"
                      disabled={actionLoading}
                      onClick={() =>
                        performAlertAction(
                          alert.id,
                          'resolve',
                        )
                      }
                    >
                      Resolve
                    </button>
                  )}

                </div>

              </div>

            ))
          )}

        </div>

      </section>

      {/* DETAIL PANEL */}

      {showDetails && (
        <div
          className="risk-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowDetails(false)
            }
          }}
        >

          <div className="risk-detail-modal">

            <div className="risk-modal-header">

              <div>
                <span className="risk-section-label">
                  ALERT EVIDENCE
                </span>

                <h2>
                  {selectedAlert
                    ? `Alert #${selectedAlert.id}`
                    : 'Loading alert...'}
                </h2>
              </div>

              <button
                className="risk-modal-close"
                onClick={() => setShowDetails(false)}
              >
                <X size={20} />
              </button>

            </div>

            {!selectedAlert ? (
              <div className="risk-empty-state">
                <RefreshCw
                  size={22}
                  className="risk-spinning"
                />
                Loading evidence...
              </div>
            ) : (
              <div className="risk-modal-content">

                <div className="risk-detail-badges">

                  <span
                    className={`risk-level-badge ${selectedAlert.level}`}
                  >
                    {getLevelLabel(selectedAlert.level)}
                  </span>

                  <span
                    className={`risk-status-badge ${selectedAlert.status}`}
                  >
                    {getStatusLabel(selectedAlert.status)}
                  </span>

                  {selectedAlert.simulated && (
                    <span className="risk-simulated-badge">
                      SIMULATED DATA
                    </span>
                  )}

                </div>

                <div className="risk-detail-grid">

                  <div>
                    <span>Astronaut</span>
                    <strong>
                      {getAstronautName(
                        selectedAlert.astronaut_id,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Metric</span>
                    <strong>
                      {formatMetric(selectedAlert.metric)}
                    </strong>
                  </div>

                  <div>
                    <span>Observed value</span>
                    <strong>
                      {formatNumber(
                        selectedAlert.observed_value,
                      )}{' '}
                      {selectedAlert.unit}
                    </strong>
                  </div>

                  <div>
                    <span>Personal baseline</span>
                    <strong>
                      {formatNumber(
                        selectedAlert.baseline_median,
                      )}{' '}
                      {selectedAlert.unit}
                    </strong>
                  </div>

                  <div>
                    <span>Robust deviation</span>
                    <strong>
                      {formatNumber(
                        selectedAlert.robust_deviation,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Measurement ID</span>
                    <strong>
                      #{selectedAlert.measurement_id}
                    </strong>
                  </div>

                </div>

                <div className="risk-evidence-block">
                  <span>DETECTION EXPLANATION</span>
                  <p>{selectedAlert.message}</p>
                  <p>{selectedAlert.reason}</p>
                </div>

                <div className="risk-evidence-block">
                  <span>RECOMMENDED HUMAN ACTION</span>
                  <p>
                    {selectedAlert.recommended_action ??
                      'No action recommendation available.'}
                  </p>
                </div>

                <div className="risk-evidence-block">
                  <span>BASELINE SNAPSHOT</span>

                  <pre>
                    {JSON.stringify(
                      selectedAlert.baseline_snapshot ?? {},
                      null,
                      2,
                    )}
                  </pre>
                </div>

                <div className="risk-evidence-block">
                  <span>DETECTION SNAPSHOT</span>

                  <pre>
                    {JSON.stringify(
                      selectedAlert.detection_snapshot ?? {},
                      null,
                      2,
                    )}
                  </pre>
                </div>

                <div className="risk-detail-timestamps">

                  <span>
                    Created: {formatDate(selectedAlert.created_at)}
                  </span>

                  {selectedAlert.acknowledged_at && (
                    <span>
                      Acknowledged:{' '}
                      {formatDate(selectedAlert.acknowledged_at)}
                    </span>
                  )}

                  {selectedAlert.resolved_at && (
                    <span>
                      Resolved:{' '}
                      {formatDate(selectedAlert.resolved_at)}
                    </span>
                  )}

                </div>

                {selectedAlert.status !== 'resolved' && (
                  <div className="risk-modal-actions">

                    {selectedAlert.status === 'open' && (
                      <button
                        className="risk-ack-button"
                        disabled={actionLoading}
                        onClick={() =>
                          performAlertAction(
                            selectedAlert.id,
                            'acknowledge',
                          )
                        }
                      >
                        <Check size={15} />
                        Acknowledge
                      </button>
                    )}

                    <button
                      className="risk-resolve-button"
                      disabled={actionLoading}
                      onClick={() =>
                        performAlertAction(
                          selectedAlert.id,
                          'resolve',
                        )
                      }
                    >
                      <CheckCircle2 size={15} />
                      Resolve Alert
                    </button>

                  </div>
                )}

                <div className="risk-disclaimer">
                  {selectedAlert.disclaimer ??
                    'Prototype statistical alert only. Not a medical diagnosis or clinical alert.'}
                </div>

              </div>
            )}

          </div>

        </div>
      )}

      {/* FOOTER */}

      <div className="risk-page-footer">
        <ShieldAlert size={15} />

        HELIOS statistical monitoring prototype.
        All simulated records are identified.
        Alerts require appropriate human review.
      </div>

    </div>
  )
}