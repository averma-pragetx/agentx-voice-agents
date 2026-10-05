import { useEffect, useRef, useState } from 'react'
import { ConversationProvider, useConversation } from '@elevenlabs/react'
import { Turnstile } from '@marsidev/react-turnstile'
import { VOICE_AGENT_CATEGORIES } from '../constants/voiceAgentCategories'
import { showToast } from '../lib/toast'
import { getVisitorIp } from '../lib/useDetectedCountry'
import WindowCard from './WindowCard'
import { CheckIcon, MicIcon, MicOffIcon, PhoneIcon, PhoneOffIcon } from './Icons'

const BASE_URL = import.meta.env.VITE_BASE_URL
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY_WEB

// Once a user explicitly blocks mic access, browsers never re-show the permission
// popup — retrying getUserMedia() just rejects silently every time. Permissions API
// lets us tell that case apart from "hasn't decided yet" and point at the actual fix.
// The conversation id only exists once the session connects, so the caller IP is attached then.
// Fire-and-forget: the team email just shows no IP if this fails.
const sendCallerIp = async (conversationId) => {
    const ip = await getVisitorIp()
    if (!conversationId || !ip) return
    fetch(`${BASE_URL}/webhooks/elevenlabs/web-voice-agent/save-lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: conversationId, caller_ip: ip }),
    }).catch(() => {})
}

const getMicDeniedMessage = async () => {
    try {
        const status = await navigator.permissions.query({ name: 'microphone' })
        if (status.state === 'denied') {
            return 'Microphone is blocked by your browser. Click the lock icon next to the URL → Site settings → Allow microphone, then reload this page.'
        }
    } catch {
        // Permissions API unsupported for 'microphone' (e.g. Safari) — fall back to the generic message
    }
    return 'Microphone access is required to start the call.'
}

const formatDuration = (seconds) => {
    const m = String(Math.floor(seconds / 60)).padStart(2, '0')
    const s = String(seconds % 60).padStart(2, '0')
    return `${m}:${s}`
}

const STATUS_LABEL = {
    connecting: 'Connecting…',
    listening: 'Listening…',
    speaking: 'Agent is speaking…',
}

const REASSURANCES = [
    'A live conversation, right in your browser',
    'Handles interruptions without losing the thread',
    'No phone number, no signup',
]

// Bars peak in the middle so the row reads as one waveform — same shape as the
// frontend's TestAgentModal.
const BAR_SHAPE = [0.45, 0.65, 0.85, 1, 0.85, 0.65, 0.45]
const BAR_MIN = 10
const BAR_MAX = 64

// Driven by the SDK's real volume levels via rAF + direct style writes, so the bars
// move only while someone is actually talking and React doesn't re-render per frame.
const VoiceBars = ({ conversation }) => {
    const barRefs = useRef([])
    const conversationRef = useRef(conversation)
    conversationRef.current = conversation

    useEffect(() => {
        let frame
        const tick = (t) => {
            const c = conversationRef.current
            const agent = c.getOutputVolume()
            const user = c.isMuted ? 0 : c.getInputVolume()
            const level = Math.min(1, Math.max(agent, user) * 1.6)
            const color = level < 0.04 ? '#d1d5db' : agent >= user ? '#0168b8' : '#4b9fe1'
            barRefs.current.forEach((bar, i) => {
                if (!bar) return
                const wobble = 0.85 + 0.15 * Math.sin(t / 140 + i * 1.3)
                bar.style.height = `${BAR_MIN + (BAR_MAX - BAR_MIN) * level * BAR_SHAPE[i] * wobble}px`
                bar.style.background = color
            })
            frame = requestAnimationFrame(tick)
        }
        frame = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(frame)
    }, [])

    return (
        <div className="voice-bars" aria-hidden="true">
            {BAR_SHAPE.map((_, i) => (
                <span key={i} ref={(el) => { barRefs.current[i] = el }} className="voice-bar" />
            ))}
        </div>
    )
}

const PulsingOrb = () => (
    <div className="orb">
        <span className="orb-glow" />
        <div className="orb-core"><MicIcon size={24} /></div>
    </div>
)

const IdlePanel = ({ category, setCategory, errorMessage, onInitiate, isBusy, turnstileRef, turnstileToken, setTurnstileToken }) => (
    <div className="idle-panel">
        <PulsingOrb />
        <p className="panel-lead">Pick a use case and talk to our AI voice agent, live, right now.</p>

        <select value={category} onChange={(e) => setCategory(e.target.value)} disabled={isBusy} className="text-field" aria-label="Use case">
            {VOICE_AGENT_CATEGORIES.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
            ))}
        </select>

        <Turnstile
            ref={turnstileRef}
            siteKey={TURNSTILE_SITE_KEY}
            options={{ action: 'web_voice' }}
            onSuccess={setTurnstileToken}
            onExpire={() => setTurnstileToken(null)}
            onError={() => setTurnstileToken(null)}
        />

        <button type="button" onClick={onInitiate} disabled={isBusy || !turnstileToken} className="dark-btn">
            {isBusy ? <span className="spinner" /> : <PhoneIcon size={17} />}
            {isBusy ? 'Connecting…' : 'Initiate Call'}
        </button>

        {errorMessage && <p className="field-error" role="alert">{errorMessage}</p>}

        <p className="fine-print">Mic permission needed. This call may be recorded to improve our AI voice agents.</p>
    </div>
)

const BlockedPanel = () => (
    <div className="success-panel">
        <span className="check-icon big"><MicOffIcon size={24} /></span>
        <p className="success-title">You&apos;ve already tried this demo</p>
        <p className="success-sub">Each visitor gets one live session so everyone gets a turn.</p>
    </div>
)

const LivePanel = ({ conversation, statusLabel, elapsedSeconds, onEndCall }) => (
    <div className="idle-panel">
        <VoiceBars conversation={conversation} />
        <p className="live-status" aria-live="polite">{statusLabel}</p>
        <p className="live-timer">{formatDuration(elapsedSeconds)}</p>
        <div className="call-controls">
            <div className="round-control">
                <button
                    type="button"
                    className={`round-btn ${conversation.isMuted ? 'active' : ''}`}
                    onClick={() => conversation.setMuted(!conversation.isMuted)}
                    aria-pressed={conversation.isMuted}
                    aria-label={conversation.isMuted ? 'Unmute' : 'Mute'}
                >
                    {conversation.isMuted ? <MicOffIcon size={20} /> : <MicIcon size={20} />}
                </button>
                {conversation.isMuted ? 'Unmute' : 'Mute'}
            </div>
            <div className="round-control">
                <button type="button" className="round-btn end" onClick={onEndCall} aria-label="End call">
                    <PhoneOffIcon size={20} />
                </button>
                End call
            </div>
        </div>
    </div>
)

const ClosedPanel = ({ isDropped, onRestart }) => (
    <div className="success-panel">
        <span className="check-icon big">{isDropped ? <PhoneOffIcon size={24} /> : <CheckIcon size={26} />}</span>
        <p className="success-title">{isDropped ? 'Connection lost' : 'Thanks for trying Voice Agents'}</p>
        {isDropped && <p className="success-sub">The call disconnected unexpectedly.</p>}
        <button type="button" onClick={onRestart} className="link-btn">Back to start</button>
    </div>
)

const VoiceAgentWidgetInner = () => {
    const [category, setCategory] = useState(VOICE_AGENT_CATEGORIES[0].value)
    const [callState, setCallState] = useState('idle') // idle | connecting | live | blocked | closed
    const [errorMessage, setErrorMessage] = useState('')
    const [isDropped, setIsDropped] = useState(false)
    const [elapsedSeconds, setElapsedSeconds] = useState(0)
    const timerRef = useRef(null)
    const [turnstileToken, setTurnstileToken] = useState(null)
    const turnstileRef = useRef(null)
    const turnstileProps = { turnstileRef, turnstileToken, setTurnstileToken }

    const conversation = useConversation({
        onConnect: ({ conversationId } = {}) => {
            setCallState('live')
            sendCallerIp(conversationId)
        },
        onDisconnect: (details) => {
            clearTimer()
            setIsDropped(details?.reason === 'error')
            setCallState('closed')
        },
        onError: (message) => {
            clearTimer()
            setErrorMessage(typeof message === 'string' ? message : 'Connection error, please try again.')
            setCallState((prev) => (prev === 'live' ? 'closed' : 'idle'))
            setIsDropped(true)
        },
    })

    const clearTimer = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
        }
    }

    useEffect(() => clearTimer, [])

    useEffect(() => {
        if (callState !== 'live') return undefined
        timerRef.current = setInterval(() => setElapsedSeconds((prev) => prev + 1), 1000)
        return clearTimer
    }, [callState])

    const resetToIdle = () => {
        setCallState('idle')
        setErrorMessage('')
        setIsDropped(false)
        setElapsedSeconds(0)
    }

    const handleInitiate = async () => {
        if (!turnstileToken) return
        setErrorMessage('')
        try {
            await navigator.mediaDevices.getUserMedia({ audio: true })
        } catch {
            setErrorMessage(await getMicDeniedMessage())
            return
        }

        setCallState('connecting')
        try {
            const response = await fetch(`${BASE_URL}/agent/dispatch_agent/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agent_type: 'web_voice', category, turnstileToken }),
            })
            if (response.status === 409) {
                setCallState('blocked')
                return
            }
            if (!response.ok) throw new Error('dispatch failed')
            const data = await response.json()
            conversation.startSession({
                conversationToken: data.conversation_token,
                dynamicVariables: data.dynamic_variables,
            })
        } catch (error) {
            showToast("Couldn't connect to the voice agent. Please try again.", 'error')
            setErrorMessage("Couldn't connect to the voice agent. Please try again.")
            setCallState('idle')
        } finally {
            // Tokens are single-use — get a fresh one for the next attempt.
            turnstileRef.current?.reset()
            setTurnstileToken(null)
        }
    }

    const handleEndCall = () => conversation.endSession()

    const statusLabel =
        conversation.status === 'connecting' || callState === 'connecting'
            ? STATUS_LABEL.connecting
            : conversation.isSpeaking
              ? STATUS_LABEL.speaking
              : STATUS_LABEL.listening

    return (
        <section className="widget-section">
            <div className="widget-grid">
                <div className="widget-copy">
                    <span className="badge">Talk Live</span>
                    <h2>Talk to it right in your browser</h2>
                    <p>Pick a use case and have a real conversation with our AI voice agent - it listens, answers, and keeps up.</p>
                    <ul className="check-list">
                        {REASSURANCES.map((item) => (
                            <li key={item}>
                                <span className="check-icon"><CheckIcon size={14} /></span>
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>

                <WindowCard title="Live Voice Session" live={callState === 'live'}>
                    {callState === 'idle' && (
                        <IdlePanel category={category} setCategory={setCategory} errorMessage={errorMessage} onInitiate={handleInitiate} isBusy={false} {...turnstileProps} />
                    )}
                    {callState === 'connecting' && (
                        <IdlePanel category={category} setCategory={setCategory} errorMessage="" onInitiate={() => {}} isBusy {...turnstileProps} />
                    )}
                    {callState === 'blocked' && <BlockedPanel />}
                    {callState === 'live' && (
                        <LivePanel conversation={conversation} statusLabel={statusLabel} elapsedSeconds={elapsedSeconds} onEndCall={handleEndCall} />
                    )}
                    {callState === 'closed' && <ClosedPanel isDropped={isDropped} onRestart={resetToIdle} />}
                </WindowCard>
            </div>
        </section>
    )
}

const VoiceAgentWidget = () => (
    <ConversationProvider>
        <VoiceAgentWidgetInner />
    </ConversationProvider>
)

export default VoiceAgentWidget
