import { useEffect, useRef, useState } from 'react'
import { ConversationProvider, useConversation } from '@elevenlabs/react'
import { VOICE_AGENT_CATEGORIES } from '../constants/voiceAgentCategories'
import { showToast } from '../lib/toast'

const BASE_URL = import.meta.env.VITE_BASE_URL

// Once a user explicitly blocks mic access, browsers never re-show the permission
// popup — retrying getUserMedia() just rejects silently every time. Permissions API
// lets us tell that case apart from "hasn't decided yet" and point at the actual fix.
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

const WAVEFORM_BAR_COUNT = 28

const LiveWaveform = () => (
    <div className="waveform" aria-label="Live audio">
        {Array.from({ length: WAVEFORM_BAR_COUNT }).map((_, i) => (
            <span key={i} className="waveform-bar" style={{ animationDelay: `${i * 0.06}s` }} />
        ))}
    </div>
)

const WidgetCard = ({ children }) => (
    <div className="widget-card">
        <div className="widget-card-inner">
            <div className="widget-card-header">
                <span className="widget-card-logo" aria-hidden="true">🎙️</span>
                <span>Voice Agents</span>
            </div>
            <div className="widget-card-body">{children}</div>
        </div>
    </div>
)

const PulsingOrb = () => (
    <div className="orb">
        <span className="orb-glow" />
        <div className="orb-core">🎤</div>
    </div>
)

const IdlePanel = ({ category, setCategory, errorMessage, onInitiate, isBusy }) => (
    <div className="idle-panel">
        <PulsingOrb />
        <p>Pick a use case and talk to our AI voice agent, live, right now.</p>

        <select value={category} onChange={(e) => setCategory(e.target.value)} disabled={isBusy} className="text-field">
            {VOICE_AGENT_CATEGORIES.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
            ))}
        </select>

        <button type="button" onClick={onInitiate} disabled={isBusy} className="dark-btn">
            {isBusy && <span className="spinner" />}
            {isBusy ? 'Connecting…' : 'Initiate Call'}
        </button>

        {errorMessage && <p className="field-error" role="alert">{errorMessage}</p>}

        <p className="fine-print">Mic permission needed. This call may be recorded to improve our AI voice agents.</p>
    </div>
)

const BlockedPanel = () => (
    <div className="idle-panel">
        <p className="success-title">You've already tried this demo</p>
        <p className="success-sub">Each visitor gets one live session so everyone gets a turn.</p>
    </div>
)

const LivePanel = ({ statusLabel, elapsedSeconds, onEndCall }) => (
    <div className="idle-panel">
        <PulsingOrb />
        <div className="live-status">
            <span className="live-dot" />
            {statusLabel}
            <span className="live-timer">{formatDuration(elapsedSeconds)}</span>
        </div>
        <LiveWaveform />
        <button type="button" onClick={onEndCall} className="danger-btn">End call</button>
    </div>
)

const ClosedPanel = ({ isDropped, onRestart }) => (
    <div className="idle-panel">
        <span className="check-icon big">✓</span>
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

    const conversation = useConversation({
        onConnect: () => setCallState('live'),
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
                body: JSON.stringify({ agent_type: 'web_voice', category }),
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
        <WidgetCard>
            {callState === 'idle' && (
                <IdlePanel category={category} setCategory={setCategory} errorMessage={errorMessage} onInitiate={handleInitiate} isBusy={false} />
            )}
            {callState === 'connecting' && (
                <IdlePanel category={category} setCategory={setCategory} errorMessage="" onInitiate={() => {}} isBusy />
            )}
            {callState === 'blocked' && <BlockedPanel />}
            {callState === 'live' && (
                <LivePanel statusLabel={statusLabel} elapsedSeconds={elapsedSeconds} onEndCall={handleEndCall} />
            )}
            {callState === 'closed' && <ClosedPanel isDropped={isDropped} onRestart={resetToIdle} />}
        </WidgetCard>
    )
}

const VoiceAgentWidget = () => (
    <ConversationProvider>
        <VoiceAgentWidgetInner />
    </ConversationProvider>
)

export default VoiceAgentWidget
