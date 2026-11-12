import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Activity,
  Brain,
  CheckCircle2,
  Clock3,
  Heart,
  History,
  Moon,
  Play,
  RefreshCw,
  Send,
  ShieldAlert,
  Square,
  UserRound,
  Zap,
} from 'lucide-react'
import './CrewAssessment.css'

const API_BASE = 'http://127.0.0.1:8000/api/v1'
const TEST_DURATION = 180
const LAPSE_THRESHOLD_MS = 500

interface Astronaut {
  id: string
  name: string
  mission_role: string
  mission_day: number
}

interface CheckIn {
  id: number
  astronaut_id: string
  checkin_date: string
  mood_score: number
  stress_score: number
  fatigue_score: number
  sleep_quality_score: number
  notes?: string | null
  simulated: boolean
  created_at: string
}

interface CognitiveAssessment {
  id: number
  astronaut_id: string
  duration_seconds: number
  stimuli_count: number
  valid_responses: number
  mean_reaction_ms: number
  median_reaction_ms: number
  lapses_count: number
  completed_at: string
  simulated: boolean
}

type TestStatus = 'idle' | 'running' | 'complete'

function getLocalDate() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString([], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getMedian(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)

  if (sorted.length === 0) return 0

  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
}

function CrewAssessment({
  astronauts,
}: {
  astronauts: Astronaut[]
}) {
  const [selectedAstronaut, setSelectedAstronaut] = useState('AST-001')

  const [mood, setMood] = useState(8)
  const [stress, setStress] = useState(3)
  const [fatigue, setFatigue] = useState(4)
  const [sleep, setSleep] = useState(7)
  const [notes, setNotes] = useState('')

  const [checkins, setCheckins] = useState<CheckIn[]>([])
  const [assessments, setAssessments] = useState<CognitiveAssessment[]>([])

  const [checkinLoading, setCheckinLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [checkinMessage, setCheckinMessage] = useState('')
  const [checkinError, setCheckinError] = useState('')
  const [assessmentError, setAssessmentError] = useState('')

  const [testStatus, setTestStatus] = useState<TestStatus>('idle')
  const [remainingTime, setRemainingTime] = useState(TEST_DURATION)
  const [stimulusVisible, setStimulusVisible] = useState(false)
  const [waitingForStimulus, setWaitingForStimulus] = useState(false)
 const [, setCurrentReaction] = useState<number | null>(null)
  const [reactionTimes, setReactionTimes] = useState<number[]>([])
  const [stimuliCount, setStimuliCount] = useState(0)
  const [lapsesCount, setLapsesCount] = useState(0)
  const [testSaving, setTestSaving] = useState(false)
  const [testMessage, setTestMessage] = useState('')

  const reactionTimesRef = useRef<number[]>([])
  const stimuliCountRef = useRef(0)
  const lapsesCountRef = useRef(0)
  const stimulusStartedAtRef = useRef<number | null>(null)
  const stimulusTimeoutRef = useRef<number | null>(null)
  const timerIntervalRef = useRef<number | null>(null)
  const testActiveRef = useRef(false)
  const stimulusVisibleRef = useRef(false)

  const selectedCrew = astronauts.find(
    (astronaut) => astronaut.id === selectedAstronaut,
  )

  const clearTestTimers = useCallback(() => {
    if (stimulusTimeoutRef.current !== null) {
      window.clearTimeout(stimulusTimeoutRef.current)
      stimulusTimeoutRef.current = null
    }

    if (timerIntervalRef.current !== null) {
      window.clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }
  }, [])

  const fetchHistory = useCallback(async () => {
    if (!selectedAstronaut) return

    setHistoryLoading(true)

    try {
      const [checkinResponse, assessmentResponse] = await Promise.all([
        fetch(
          `${API_BASE}/astronauts/${selectedAstronaut}/checkins?limit=30`,
        ),
        fetch(
          `${API_BASE}/astronauts/${selectedAstronaut}/cognitive-assessments?limit=30`,
        ),
      ])

      if (!checkinResponse.ok || !assessmentResponse.ok) {
        throw new Error('Unable to retrieve assessment history.')
      }

      const checkinData: CheckIn[] = await checkinResponse.json()
      const assessmentData: CognitiveAssessment[] =
        await assessmentResponse.json()

      setCheckins(checkinData)
      setAssessments(assessmentData)
    } catch {
      setCheckinError('Unable to load assessment history.')
    } finally {
      setHistoryLoading(false)
    }
  }, [selectedAstronaut])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  useEffect(() => {
    return () => {
      testActiveRef.current = false
      clearTestTimers()
    }
  }, [clearTestTimers])

  const submitCheckIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!selectedAstronaut) {
      setCheckinError('Please select a crew member.')
      return
    }

    setCheckinLoading(true)
    setCheckinError('')
    setCheckinMessage('')

    try {
      const response = await fetch(`${API_BASE}/checkins`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          astronaut_id: selectedAstronaut,
          checkin_date: getLocalDate(),
          mood_score: mood,
          stress_score: stress,
          fatigue_score: fatigue,
          sleep_quality_score: sleep,
          notes: notes.trim() || null,
          simulated: true,
          metadata: {
            source: 'helios_frontend',
            test_record: true,
          },
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(
          result.detail || 'Unable to submit daily check-in.',
        )
      }

      setCheckinMessage('Daily check-in successfully recorded.')
      setNotes('')
      await fetchHistory()
    } catch (error) {
      setCheckinError(
        error instanceof Error
          ? error.message
          : 'Unable to submit check-in.',
      )
    } finally {
      setCheckinLoading(false)
    }
  }

  const scheduleStimulus = useCallback(() => {
    if (!testActiveRef.current) return

    setWaitingForStimulus(true)
    setStimulusVisible(false)
    stimulusVisibleRef.current = false
    stimulusStartedAtRef.current = null

    const delay = 1500 + Math.random() * 2500

    stimulusTimeoutRef.current = window.setTimeout(() => {
      if (!testActiveRef.current) return

      stimulusStartedAtRef.current = performance.now()
      stimuliCountRef.current += 1

      setStimuliCount(stimuliCountRef.current)
      setWaitingForStimulus(false)
      setStimulusVisible(true)
      stimulusVisibleRef.current = true
    }, delay)
  }, [])

  const saveCognitiveAssessment = async () => {
    const values = reactionTimesRef.current

    if (values.length === 0) {
      setAssessmentError(
        'No valid responses were recorded. Please repeat the test.',
      )
      setTestStatus('complete')
      return
    }

    const mean = values.reduce((sum, value) => sum + value, 0) / values.length
    const median = getMedian(values)

    setTestSaving(true)
    setAssessmentError('')
    setTestMessage('')

    try {
      const response = await fetch(
        `${API_BASE}/cognitive-assessments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            astronaut_id: selectedAstronaut,
            duration_seconds: TEST_DURATION,
            stimuli_count: stimuliCountRef.current,
            valid_responses: values.length,
            mean_reaction_ms: Number(mean.toFixed(2)),
            median_reaction_ms: Number(median.toFixed(2)),
            lapses_count: lapsesCountRef.current,
            simulated: true,
            metadata: {
              test_type: 'visual_reaction_time',
              source: 'helios_frontend',
              lapse_threshold_ms: LAPSE_THRESHOLD_MS,
              test_record: true,
            },
          }),
        },
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(
          result.detail || 'Unable to save cognitive assessment.',
        )
      }

      setTestMessage('Cognitive assessment successfully saved.')
      await fetchHistory()
    } catch (error) {
      setAssessmentError(
        error instanceof Error
          ? error.message
          : 'Unable to save cognitive assessment.',
      )
    } finally {
      setTestSaving(false)
    }
  }

  const finishTest = useCallback(() => {
    if (!testActiveRef.current) return

    testActiveRef.current = false
    clearTestTimers()

    setStimulusVisible(false)
    setWaitingForStimulus(false)
    stimulusVisibleRef.current = false
    stimulusStartedAtRef.current = null
    setRemainingTime(0)
    setTestStatus('complete')

    void saveCognitiveAssessment()
  }, [clearTestTimers])

  const startTest = () => {
    clearTestTimers()

    reactionTimesRef.current = []
    stimuliCountRef.current = 0
    lapsesCountRef.current = 0
    testActiveRef.current = true
    stimulusVisibleRef.current = false

    setReactionTimes([])
    setStimuliCount(0)
    setLapsesCount(0)
    setRemainingTime(TEST_DURATION)
    setCurrentReaction(null)
    setStimulusVisible(false)
    setWaitingForStimulus(false)
    setTestMessage('')
    setAssessmentError('')
    setTestStatus('running')

    timerIntervalRef.current = window.setInterval(() => {
      setRemainingTime((previous) => {
        if (previous <= 1) {
          window.setTimeout(finishTest, 0)
          return 0
        }

        return previous - 1
      })
    }, 1000)

    scheduleStimulus()
  }

  const handleStimulusClick = () => {
    if (!testActiveRef.current || !stimulusVisibleRef.current) return

    const startedAt = stimulusStartedAtRef.current

    if (startedAt === null) return

    const reaction = performance.now() - startedAt
    const roundedReaction = Number(reaction.toFixed(2))

    const updatedTimes = [...reactionTimesRef.current, roundedReaction]

    reactionTimesRef.current = updatedTimes

    if (reaction > LAPSE_THRESHOLD_MS) {
      lapsesCountRef.current += 1
      setLapsesCount(lapsesCountRef.current)
    }

    setReactionTimes(updatedTimes)
    setCurrentReaction(roundedReaction)

    setStimulusVisible(false)
    stimulusVisibleRef.current = false
    stimulusStartedAtRef.current = null

    scheduleStimulus()
  }

  const cancelTest = () => {
    testActiveRef.current = false
    clearTestTimers()

    setTestStatus('idle')
    setStimulusVisible(false)
    setWaitingForStimulus(false)
    stimulusVisibleRef.current = false
    stimulusStartedAtRef.current = null
    setRemainingTime(TEST_DURATION)
    setReactionTimes([])
    setStimuliCount(0)
    setLapsesCount(0)
    reactionTimesRef.current = []
    stimuliCountRef.current = 0
    lapsesCountRef.current = 0
    setTestMessage('Test cancelled. No assessment was saved.')
    setAssessmentError('')
  }

  const meanReaction =
    reactionTimes.length > 0
      ? reactionTimes.reduce((sum, value) => sum + value, 0) /
        reactionTimes.length
      : 0

  const medianReaction = getMedian(reactionTimes)

  const timerMinutes = Math.floor(remainingTime / 60)
  const timerSeconds = remainingTime % 60

  const scoreItems = [
    {
      label: 'Mood',
      description: 'Overall emotional state',
      value: mood,
      setter: setMood,
      icon: Heart,
    },
    {
      label: 'Stress',
      description: 'Perceived stress level',
      value: stress,
      setter: setStress,
      icon: Activity,
    },
    {
      label: 'Fatigue',
      description: 'Current fatigue level',
      value: fatigue,
      setter: setFatigue,
      icon: Zap,
    },
    {
      label: 'Sleep Quality',
      description: 'Perceived sleep quality',
      value: sleep,
      setter: setSleep,
      icon: Moon,
    },
  ]

  return (
    <div className="assessment-page">
      <section className="assessment-heading">
        <div>
          <div className="assessment-eyebrow">
            <span />
            CREW WELLBEING & COGNITIVE MONITORING
          </div>

          <h1>Crew Assessment</h1>

          <p>
            Daily self-reported wellbeing and cognitive performance
            monitoring.
          </p>
        </div>

        <div className="assessment-simulated-badge">
          <span />
          SIMULATED DATA
        </div>
      </section>

      <section className="assessment-notice">
        <ShieldAlert size={18} />
        <div>
          <strong>Prototype assessment system</strong>
          <p>
            This module demonstrates software functionality using
            simulated records. It does not provide medical diagnoses,
            clinical assessments, or validated astronaut health results.
          </p>
        </div>
      </section>

      <section className="assessment-crew-selector panel">
        <div className="assessment-section-icon">
          <UserRound size={19} />
        </div>

        <div className="assessment-crew-info">
          <span>SELECT CREW MEMBER</span>
          <strong>
            {selectedCrew?.name || 'Select an astronaut'}
          </strong>
          <small>
            {selectedCrew
              ? `${selectedCrew.mission_role} · Mission Day ${selectedCrew.mission_day}`
              : 'No crew member selected'}
          </small>
        </div>

        <select
          value={selectedAstronaut}
          onChange={(event) => {
            setSelectedAstronaut(event.target.value)
            setTestMessage('')
            setAssessmentError('')
            setCheckinMessage('')
            setCheckinError('')
          }}
        >
          {astronauts.map((astronaut) => (
            <option key={astronaut.id} value={astronaut.id}>
              {astronaut.name} — {astronaut.id}
            </option>
          ))}
        </select>
      </section>

      <section className="assessment-section-heading">
        <div>
          <div className="assessment-section-label">
            <Heart size={15} />
            DAILY WELLBEING
          </div>
          <h2>Daily Crew Check-in</h2>
          <p>
            Record self-reported wellbeing indicators for the selected
            crew member.
          </p>
        </div>

        <span className="assessment-section-tag">DAILY FORM</span>
      </section>

      <section className="assessment-checkin-grid">
        <form className="panel checkin-panel" onSubmit={submitCheckIn}>
          <div className="assessment-panel-heading">
            <div>
              <h3>Wellbeing Questionnaire</h3>
              <p>Rate each indicator from 1 to 10.</p>
            </div>

            <span className="assessment-date">
              {formatDate(getLocalDate())}
            </span>
          </div>

          <div className="score-list">
            {scoreItems.map((item) => {
              const Icon = item.icon

              return (
                <div className="score-control" key={item.label}>
                  <div className="score-control-top">
                    <div className="score-control-label">
                      <Icon size={17} />
                      <div>
                        <strong>{item.label}</strong>
                        <small>{item.description}</small>
                      </div>
                    </div>

                    <div className="score-value">{item.value}/10</div>
                  </div>

                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={item.value}
                    onChange={(event) =>
                      item.setter(Number(event.target.value))
                    }
                  />

                  <div className="score-scale">
                    <span>1 — Lowest</span>
                    <span>10 — Highest</span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="checkin-notes">
            <label htmlFor="crew-notes">
              Additional notes <span>OPTIONAL</span>
            </label>

            <textarea
              id="crew-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Enter any additional observations..."
              maxLength={2000}
              rows={3}
            />
          </div>

          {checkinError && (
            <div className="assessment-error">{checkinError}</div>
          )}

          {checkinMessage && (
            <div className="assessment-success">
              <CheckCircle2 size={16} />
              {checkinMessage}
            </div>
          )}

          <button
            className="assessment-primary-button"
            type="submit"
            disabled={checkinLoading || !selectedAstronaut}
          >
            {checkinLoading ? (
              <>
                <RefreshCw size={16} className="assessment-spin" />
                Saving Check-in...
              </>
            ) : (
              <>
                <Send size={16} />
                Submit Daily Check-in
              </>
            )}
          </button>

          <div className="assessment-form-footer">
            <span>SIMULATED RECORD</span>
            <span>One check-in per astronaut per day</span>
          </div>
        </form>

        <aside className="panel wellbeing-info-panel">
          <div className="assessment-panel-heading">
            <div>
              <div className="assessment-section-label">
                <Activity size={14} />
                SELF-REPORTED INDICATORS
              </div>
              <h3>Assessment Guide</h3>
            </div>
          </div>

          <div className="wellbeing-guide-list">
            <div>
              <span className="guide-number">01</span>
              <div>
                <strong>Mood</strong>
                <p>Self-reported emotional wellbeing.</p>
              </div>
            </div>

            <div>
              <span className="guide-number">02</span>
              <div>
                <strong>Stress</strong>
                <p>Perceived psychological stress.</p>
              </div>
            </div>

            <div>
              <span className="guide-number">03</span>
              <div>
                <strong>Fatigue</strong>
                <p>Self-reported tiredness and fatigue.</p>
              </div>
            </div>

            <div>
              <span className="guide-number">04</span>
              <div>
                <strong>Sleep Quality</strong>
                <p>Subjective assessment of sleep quality.</p>
              </div>
            </div>
          </div>

          <div className="wellbeing-guide-note">
            <Brain size={19} />
            <p>
              These scores represent subjective self-reports, not
              independently measured physiological conditions.
            </p>
          </div>
        </aside>
      </section>

      <section className="assessment-section-heading cognitive-heading">
        <div>
          <div className="assessment-section-label">
            <Brain size={15} />
            COGNITIVE PERFORMANCE
          </div>
          <h2>Reaction-Time Assessment</h2>
          <p>
            An interactive visual stimulus-response exercise.
          </p>
        </div>

        <span className="assessment-section-tag">180 SECONDS</span>
      </section>

      <section className="panel reaction-panel">
        <div className="reaction-top">
          <div>
            <h3>Visual Reaction Test</h3>
            <p>
              Wait for the cyan stimulus to appear, then click it as
              quickly as possible.
            </p>
          </div>

          <div className="reaction-timer">
            <Clock3 size={17} />
            <div>
              <span>TIME REMAINING</span>
              <strong>
                {String(timerMinutes).padStart(2, '0')}:
                {String(timerSeconds).padStart(2, '0')}
              </strong>
            </div>
          </div>
        </div>

        <div className="reaction-stage">
          {testStatus === 'idle' && (
            <div className="reaction-instructions">
              <div className="reaction-instruction-icon">
                <Zap size={29} />
              </div>

              <h3>Ready to begin?</h3>

              <p>
                The test lasts three minutes. Stimuli will appear at
                randomized intervals. Click each stimulus when it
                appears.
              </p>

              <button
                className="assessment-primary-button"
                onClick={startTest}
                disabled={!selectedAstronaut}
              >
                <Play size={17} />
                Start 3-Minute Test
              </button>
            </div>
          )}

          {testStatus === 'running' && (
            <div className="reaction-running">
              <div className="reaction-status">
                {stimulusVisible
                  ? 'STIMULUS DETECTED — RESPOND NOW'
                  : waitingForStimulus
                    ? 'WAIT FOR THE STIMULUS'
                    : 'PREPARING'}
              </div>

              <button
                type="button"
                className={`reaction-target ${
                  stimulusVisible ? 'reaction-target-active' : ''
                }`}
                onClick={handleStimulusClick}
                disabled={!stimulusVisible}
                aria-label="Click when the visual stimulus appears"
              >
                {stimulusVisible ? (
                  <Zap size={54} />
                ) : (
                  <span>WAIT</span>
                )}
              </button>

              <div className="reaction-running-footer">
                <span>
                  VALID RESPONSES: {reactionTimes.length}
                </span>
                <span>
                  STIMULI: {stimuliCount}
                </span>
              </div>

              <button
                className="reaction-cancel-button"
                onClick={cancelTest}
              >
                <Square size={13} />
                Cancel Test
              </button>
            </div>
          )}

          {testStatus === 'complete' && (
            <div className="reaction-complete">
              <div className="reaction-complete-icon">
                <CheckCircle2 size={31} />
              </div>

              <h3>Assessment Complete</h3>

              <p>
                The reaction-time exercise has finished.
              </p>

              <div className="reaction-result-grid">
                <div>
                  <span>MEAN REACTION</span>
                  <strong>{meanReaction.toFixed(1)} ms</strong>
                </div>

                <div>
                  <span>MEDIAN REACTION</span>
                  <strong>{medianReaction.toFixed(1)} ms</strong>
                </div>

                <div>
                  <span>VALID RESPONSES</span>
                  <strong>{reactionTimes.length}</strong>
                </div>

                <div>
                  <span>LAPSES (&gt;500 MS)</span>
                  <strong>{lapsesCount}</strong>
                </div>
              </div>

              {testSaving && (
                <div className="assessment-saving">
                  <RefreshCw size={15} className="assessment-spin" />
                  Saving assessment...
                </div>
              )}

              {testMessage && (
                <div className="assessment-success">
                  <CheckCircle2 size={16} />
                  {testMessage}
                </div>
              )}

              {assessmentError && (
                <div className="assessment-error">
                  {assessmentError}
                </div>
              )}

              <button
                className="assessment-primary-button"
                onClick={startTest}
                disabled={testSaving}
              >
                <RefreshCw size={16} />
                Repeat Assessment
              </button>
            </div>
          )}
        </div>

        <div className="reaction-disclaimer">
          <ShieldAlert size={15} />
          <span>
            Experimental software demonstration. Results are not a
            validated clinical or neurological assessment.
          </span>
        </div>
      </section>

      <section className="assessment-section-heading history-heading">
        <div>
          <div className="assessment-section-label">
            <History size={15} />
            HISTORICAL RECORDS
          </div>

          <h2>Assessment History</h2>

          <p>
            Previously recorded check-ins and cognitive assessments.
          </p>
        </div>

        <button
          className="assessment-refresh-button"
          onClick={fetchHistory}
          disabled={historyLoading}
        >
          <RefreshCw
            size={15}
            className={historyLoading ? 'assessment-spin' : ''}
          />
          Refresh
        </button>
      </section>

      <section className="assessment-history-grid">
        <article className="panel history-panel">
          <div className="history-panel-heading">
            <div>
              <Heart size={17} />
              <h3>Daily Check-ins</h3>
            </div>

            <span>{checkins.length} RECORDS</span>
          </div>

          {checkins.length > 0 ? (
            <div className="assessment-history-list">
              {checkins.map((item) => (
                <div className="checkin-history-item" key={item.id}>
                  <div className="history-item-date">
                    <strong>{formatDate(item.checkin_date)}</strong>
                    <span>{item.astronaut_id}</span>
                  </div>

                  <div className="history-score-row">
                    <span>Mood: {item.mood_score}</span>
                    <span>Stress: {item.stress_score}</span>
                    <span>Fatigue: {item.fatigue_score}</span>
                    <span>Sleep: {item.sleep_quality_score}</span>
                  </div>

                  {item.notes && (
                    <p className="history-notes">{item.notes}</p>
                  )}

                  {item.simulated && (
                    <span className="history-simulated">
                      SIMULATED
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="assessment-history-empty">
              <History size={24} />
              <span>No daily check-ins recorded.</span>
            </div>
          )}
        </article>

        <article className="panel history-panel">
          <div className="history-panel-heading">
            <div>
              <Brain size={17} />
              <h3>Cognitive Assessments</h3>
            </div>

            <span>{assessments.length} RECORDS</span>
          </div>

          {assessments.length > 0 ? (
            <div className="assessment-history-list">
              {assessments.map((item) => (
                <div className="cognitive-history-item" key={item.id}>
                  <div className="history-item-date">
                    <strong>{formatDate(item.completed_at)}</strong>
                    <span>{formatTime(item.completed_at)}</span>
                  </div>

                  <div className="cognitive-history-metrics">
                    <div>
                      <span>MEAN</span>
                      <strong>
                        {item.mean_reaction_ms.toFixed(1)} ms
                      </strong>
                    </div>

                    <div>
                      <span>MEDIAN</span>
                      <strong>
                        {item.median_reaction_ms.toFixed(1)} ms
                      </strong>
                    </div>

                    <div>
                      <span>RESPONSES</span>
                      <strong>{item.valid_responses}</strong>
                    </div>

                    <div>
                      <span>LAPSES</span>
                      <strong>{item.lapses_count}</strong>
                    </div>
                  </div>

                  {item.simulated && (
                    <span className="history-simulated">
                      SIMULATED
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="assessment-history-empty">
              <Brain size={24} />
              <span>No cognitive assessments recorded.</span>
            </div>
          )}
        </article>
      </section>

      <footer className="assessment-footer">
        <span>HELIOS · CREW ASSESSMENT MODULE</span>
        <span>
          <span className="assessment-footer-dot" />
          SYNTHETIC DATA ENVIRONMENT
        </span>
      </footer>
    </div>
  )
}

export default CrewAssessment
