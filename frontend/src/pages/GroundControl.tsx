import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  Clock3,
  MessageSquare,
  Radio,
  RefreshCw,
  Send,
  ShieldAlert,
  Signal,
  SignalZero,
  Wifi,
  WifiOff,
} from 'lucide-react'

import './GroundControl.css'

const API_BASE = 'http://127.0.0.1:8000/api/v1'

type LinkStatus = 'online' | 'blackout'
type MessageDirection = 'crew_to_ground' | 'ground_to_crew'
type MessageStatus = 'queued' | 'in_transit' | 'delivered' | 'failed'

interface CommunicationSettings {
  delay_seconds: number
  link_status: LinkStatus
  updated_at?: string
}

interface CommunicationMessage {
  id: number
  direction: MessageDirection
  sender: string
  recipient: string
  message: string
  status: MessageStatus
  created_at: string
  scheduled_delivery_at: string
  delivered_at: string | null
  delay_seconds: number
  simulated: boolean
  metadata?: Record<string, unknown>
}

function formatDate(value: string) {
  return new Date(value).toLocaleString([], {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatDelay(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  if (minutes === 0) return `${remainingSeconds}s`
  if (remainingSeconds === 0) return `${minutes} min`

  return `${minutes}m ${remainingSeconds}s`
}

function GroundControl() {
  const [settings, setSettings] = useState<CommunicationSettings>({
    delay_seconds: 1200,
    link_status: 'online',
  })

  const [messages, setMessages] = useState<CommunicationMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [direction, setDirection] =
    useState<MessageDirection>('crew_to_ground')

  const [sender, setSender] = useState('Commander Vega')
  const [recipient, setRecipient] = useState('Ground Control')
  const [messageText, setMessageText] = useState('')

  const [delayInput, setDelayInput] = useState('1200')

  const fetchCommunicationData = useCallback(async () => {
    try {
      const [settingsResponse, messagesResponse] = await Promise.all([
        fetch(`${API_BASE}/communication/settings`),
        fetch(`${API_BASE}/communication/messages?limit=100`),
      ])

      if (!settingsResponse.ok || !messagesResponse.ok) {
        throw new Error('Unable to retrieve communication data.')
      }

      const settingsData: CommunicationSettings =
        await settingsResponse.json()

      const messagesData: CommunicationMessage[] =
        await messagesResponse.json()

      setSettings(settingsData)
      setDelayInput(String(settingsData.delay_seconds))
      setMessages(messagesData)
      setError('')
    } catch {
      setError('Unable to connect to the Ground Control communication API.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCommunicationData()

    const interval = window.setInterval(
      fetchCommunicationData,
      5000,
    )

    return () => window.clearInterval(interval)
  }, [fetchCommunicationData])

  useEffect(() => {
    if (!success) return

    const timeout = window.setTimeout(() => {
      setSuccess('')
    }, 3500)

    return () => window.clearTimeout(timeout)
  }, [success])

  const handleDirectionChange = (value: MessageDirection) => {
    setDirection(value)

    if (value === 'crew_to_ground') {
      setSender('Commander Vega')
      setRecipient('Ground Control')
    } else {
      setSender('Ground Control')
      setRecipient('Commander Vega')
    }
  }

  const handleSendMessage = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!messageText.trim()) return

    setSending(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch(
        `${API_BASE}/communication/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sender,
            recipient,
            message: messageText.trim(),
            direction,
            metadata: {
              source: 'HELIOS Ground Control Interface',
            },
          }),
        },
      )

      if (!response.ok) {
        throw new Error('Message transmission failed.')
      }

      const createdMessage: CommunicationMessage =
        await response.json()

      setMessageText('')
      setSuccess(
        `Message #${createdMessage.id} submitted successfully.`,
      )

      await fetchCommunicationData()
    } catch {
      setError('Message could not be transmitted. Check the backend.')
    } finally {
      setSending(false)
    }
  }

  const handleSaveSettings = async () => {
    const delay = Number(delayInput)

    if (
      !Number.isInteger(delay) ||
      delay < 0 ||
      delay > 86400
    ) {
      setError('Delay must be between 0 and 86400 seconds.')
      return
    }

    setSavingSettings(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch(
        `${API_BASE}/communication/settings`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            delay_seconds: delay,
            link_status: settings.link_status,
          }),
        },
      )

      if (!response.ok) {
        throw new Error('Settings update failed.')
      }

      const updatedSettings: CommunicationSettings =
        await response.json()

      setSettings(updatedSettings)
      setDelayInput(String(updatedSettings.delay_seconds))
      setSuccess('Communication settings updated.')

      await fetchCommunicationData()
    } catch {
      setError('Unable to update communication settings.')
    } finally {
      setSavingSettings(false)
    }
  }

  const handleLinkStatus = async (status: LinkStatus) => {
    setSavingSettings(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch(
        `${API_BASE}/communication/settings`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            delay_seconds: Number(delayInput),
            link_status: status,
          }),
        },
      )

      if (!response.ok) {
        throw new Error('Link status update failed.')
      }

      const updatedSettings: CommunicationSettings =
        await response.json()

      setSettings(updatedSettings)
      setDelayInput(String(updatedSettings.delay_seconds))

      setSuccess(
        status === 'online'
          ? 'Communication link restored.'
          : 'Communication blackout activated.',
      )

      await fetchCommunicationData()
    } catch {
      setError('Unable to change communication link status.')
    } finally {
      setSavingSettings(false)
    }
  }

  const queuedCount = messages.filter(
    (item) => item.status === 'queued',
  ).length

  const transitCount = messages.filter(
    (item) => item.status === 'in_transit',
  ).length

  const deliveredCount = messages.filter(
    (item) => item.status === 'delivered',
  ).length

  return (
    <div className="ground-control-page">
      <section className="page-heading gc-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" />
            DEEP SPACE COMMUNICATION NETWORK
          </div>

          <h1>Ground Control</h1>

          <p>
            Mission communication, delayed transmission and link monitoring.
          </p>
        </div>

        <div className="gc-heading-status">
          <span
            className={`gc-status-dot ${settings.link_status}`}
          />
          {settings.link_status === 'online'
            ? 'COMMUNICATION ONLINE'
            : 'COMMUNICATION BLACKOUT'}
        </div>
      </section>

      {error && (
        <div className="gc-alert error">
          <ShieldAlert size={17} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="gc-alert success">
          <Signal size={17} />
          <span>{success}</span>
        </div>
      )}

      <section className="gc-stats-grid">
        <article className="gc-stat-card">
          <div className="gc-stat-icon cyan">
            <Radio size={20} />
          </div>

          <div className="gc-stat-label">LINK STATUS</div>

          <div className="gc-stat-value">
            {settings.link_status.toUpperCase()}
          </div>

          <div className="gc-stat-detail">
            Communication network
          </div>
        </article>

        <article className="gc-stat-card">
          <div className="gc-stat-icon purple">
            <Clock3 size={20} />
          </div>

          <div className="gc-stat-label">ONE-WAY DELAY</div>

          <div className="gc-stat-value">
            {formatDelay(settings.delay_seconds)}
          </div>

          <div className="gc-stat-detail">
            Configured transmission delay
          </div>
        </article>

        <article className="gc-stat-card">
          <div className="gc-stat-icon orange">
            <MessageSquare size={20} />
          </div>

          <div className="gc-stat-label">QUEUED MESSAGES</div>

          <div className="gc-stat-value">{queuedCount}</div>

          <div className="gc-stat-detail">
            Awaiting transmission processing
          </div>
        </article>

        <article className="gc-stat-card">
          <div className="gc-stat-icon green">
            <Activity size={20} />
          </div>

          <div className="gc-stat-label">DELIVERED MESSAGES</div>

          <div className="gc-stat-value">{deliveredCount}</div>

          <div className="gc-stat-detail">
            Successfully delivered
          </div>
        </article>
      </section>

      <section className="gc-main-grid">
        <article className="panel gc-link-panel">
          <div className="gc-panel-heading">
            <div>
              <div className="panel-eyebrow">
                <Signal size={14} />
                NETWORK CONTROL
              </div>

              <h2>Communication Link</h2>

              <p>
                Configure transmission conditions for the mission.
              </p>
            </div>

            {settings.link_status === 'online' ? (
              <Wifi size={23} className="gc-online-icon" />
            ) : (
              <WifiOff size={23} className="gc-offline-icon" />
            )}
          </div>

          <div className={`gc-link-state ${settings.link_status}`}>
            <div className="gc-link-state-icon">
              {settings.link_status === 'online' ? (
                <Signal size={25} />
              ) : (
                <SignalZero size={25} />
              )}
            </div>

            <div>
              <strong>
                {settings.link_status === 'online'
                  ? 'Link Operational'
                  : 'Communication Blackout'}
              </strong>

              <span>
                {settings.link_status === 'online'
                  ? 'Messages can enter the transmission pipeline.'
                  : 'Messages remain queued until the link is restored.'}
              </span>
            </div>
          </div>

          <div className="gc-control-section">
            <label>COMMUNICATION LINK CONTROL</label>

            <div className="gc-link-buttons">
              <button
                className={`gc-link-button online ${
                  settings.link_status === 'online' ? 'selected' : ''
                }`}
                disabled={savingSettings}
                onClick={() => handleLinkStatus('online')}
              >
                <Wifi size={17} />
                Restore Link
              </button>

              <button
                className={`gc-link-button blackout ${
                  settings.link_status === 'blackout' ? 'selected' : ''
                }`}
                disabled={savingSettings}
                onClick={() => handleLinkStatus('blackout')}
              >
                <WifiOff size={17} />
                Simulate Blackout
              </button>
            </div>
          </div>

          <div className="gc-control-section">
            <label htmlFor="gc-delay">
              ONE-WAY COMMUNICATION DELAY
            </label>

            <div className="gc-delay-input">
              <input
                id="gc-delay"
                type="number"
                min="0"
                max="86400"
                value={delayInput}
                onChange={(event) =>
                  setDelayInput(event.target.value)
                }
              />

              <span>SECONDS</span>
            </div>

            <div className="gc-delay-presets">
              <button onClick={() => setDelayInput('5')}>
                5 sec
              </button>

              <button onClick={() => setDelayInput('300')}>
                5 min
              </button>

              <button onClick={() => setDelayInput('600')}>
                10 min
              </button>

              <button onClick={() => setDelayInput('1200')}>
                20 min
              </button>
            </div>

            <button
              className="gc-save-button"
              onClick={handleSaveSettings}
              disabled={savingSettings}
            >
              {savingSettings ? (
                <RefreshCw size={16} className="spin" />
              ) : (
                <Activity size={16} />
              )}

              Save Communication Settings
            </button>
          </div>

          <div className="gc-delay-note">
            <Clock3 size={15} />

            <span>
              Configured delay is applied independently to each message.
              This is a simulated communication link.
            </span>
          </div>
        </article>

        <article className="panel gc-compose-panel">
          <div className="gc-panel-heading">
            <div>
              <div className="panel-eyebrow">
                <Send size={14} />
                MESSAGE TRANSMISSION
              </div>

              <h2>Compose Message</h2>

              <p>
                Send a message between the crew and Earth.
              </p>
            </div>

            <div className="gc-compose-icon">
              <MessageSquare size={21} />
            </div>
          </div>

          <div className="gc-direction-selector">
            <button
              className={
                direction === 'crew_to_ground' ? 'active' : ''
              }
              onClick={() =>
                handleDirectionChange('crew_to_ground')
              }
            >
              <ArrowUpRight size={17} />
              Crew to Earth
            </button>

            <button
              className={
                direction === 'ground_to_crew' ? 'active' : ''
              }
              onClick={() =>
                handleDirectionChange('ground_to_crew')
              }
            >
              <ArrowDownLeft size={17} />
              Earth to Crew
            </button>
          </div>

          <form onSubmit={handleSendMessage}>
            <div className="gc-form-row">
              <div className="gc-field">
                <label htmlFor="gc-sender">SENDER</label>

                <input
                  id="gc-sender"
                  value={sender}
                  onChange={(event) =>
                    setSender(event.target.value)
                  }
                  required
                />
              </div>

              <div className="gc-field">
                <label htmlFor="gc-recipient">RECIPIENT</label>

                <input
                  id="gc-recipient"
                  value={recipient}
                  onChange={(event) =>
                    setRecipient(event.target.value)
                  }
                  required
                />
              </div>
            </div>

            <div className="gc-field">
              <label htmlFor="gc-message">MESSAGE CONTENT</label>

              <textarea
                id="gc-message"
                rows={6}
                maxLength={5000}
                placeholder="Enter mission communication..."
                value={messageText}
                onChange={(event) =>
                  setMessageText(event.target.value)
                }
                required
              />

              <div className="gc-character-count">
                {messageText.length}/5000 characters
              </div>
            </div>

            <div className="gc-transmission-info">
              <Clock3 size={15} />

              <span>
                Estimated configured delay:{' '}
                <strong>
                  {formatDelay(settings.delay_seconds)}
                </strong>
              </span>
            </div>

            <button
              type="submit"
              className="gc-send-button"
              disabled={sending || !messageText.trim()}
            >
              {sending ? (
                <RefreshCw size={17} className="spin" />
              ) : (
                <Send size={17} />
              )}

              {sending ? 'Submitting...' : 'Transmit Message'}
            </button>
          </form>
        </article>
      </section>

      <section className="panel gc-history-panel">
        <div className="gc-panel-heading gc-history-heading">
          <div>
            <div className="panel-eyebrow">
              <MessageSquare size={14} />
              COMMUNICATION ARCHIVE
            </div>

            <h2>Message History</h2>

            <p>
              Recorded mission communications and transmission states.
            </p>
          </div>

          <button
            className="gc-refresh-button"
            onClick={fetchCommunicationData}
            disabled={loading}
          >
            <RefreshCw
              size={15}
              className={loading ? 'spin' : ''}
            />
            Refresh
          </button>
        </div>

        <div className="gc-history-summary">
          <span>
            <i className="queued" />
            Queued: {queuedCount}
          </span>

          <span>
            <i className="transit" />
            In transit: {transitCount}
          </span>

          <span>
            <i className="delivered" />
            Delivered: {deliveredCount}
          </span>
        </div>

        <div className="gc-message-list">
          {messages.map((item) => (
            <article className="gc-message-item" key={item.id}>
              <div
                className={`gc-message-direction ${
                  item.direction
                }`}
              >
                {item.direction === 'crew_to_ground' ? (
                  <ArrowUpRight size={19} />
                ) : (
                  <ArrowDownLeft size={19} />
                )}
              </div>

              <div className="gc-message-content">
                <div className="gc-message-top">
                  <div>
                    <strong>{item.sender}</strong>

                    <span className="gc-message-arrow">→</span>

                    <strong>{item.recipient}</strong>
                  </div>

                  <span
                    className={`gc-message-status ${item.status}`}
                  >
                    {item.status.replace('_', ' ')}
                  </span>
                </div>

                <p>{item.message}</p>

                <div className="gc-message-meta">
                  <span>MSG #{item.id}</span>

                  <span>{formatDate(item.created_at)}</span>

                  <span>
                    Delay: {formatDelay(item.delay_seconds)}
                  </span>

                  {item.delivered_at && (
                    <span>
                      Delivered: {formatDate(item.delivered_at)}
                    </span>
                  )}

                  {item.simulated && (
                    <span className="gc-simulated-tag">
                      SIMULATED
                    </span>
                  )}
                </div>
              </div>
            </article>
          ))}

          {!loading && messages.length === 0 && (
            <div className="gc-empty-state">
              <MessageSquare size={28} />

              <strong>No communication records</strong>

              <span>
                Mission messages will appear here after transmission.
              </span>
            </div>
          )}

          {loading && messages.length === 0 && (
            <div className="gc-empty-state">
              <RefreshCw size={23} className="spin" />

              <span>Loading communication history...</span>
            </div>
          )}
        </div>
      </section>

      <div className="gc-disclaimer">
        <ShieldAlert size={16} />

        <span>
          HELIOS communication simulation. Transmission timing and link
          conditions are software-generated and do not represent a live
          spacecraft communication network.
        </span>
      </div>
    </div>
  )
}

export default GroundControl