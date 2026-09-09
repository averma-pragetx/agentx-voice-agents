import { useState } from 'react'
import LiveDemoCallSection from './components/LiveDemoCallSection'
import VoiceAgentWidget from './components/VoiceAgentWidget'
import Toast from './components/Toast'

const TABS = [
    { key: 'call', label: 'Request a Call', render: () => <LiveDemoCallSection /> },
    { key: 'voice', label: 'Talk Live Now', render: () => <VoiceAgentWidget /> },
]

const App = () => {
    const [tab, setTab] = useState('call')
    const active = TABS.find((t) => t.key === tab)

    return (
        <main className="app-shell">
            <nav className="tab-bar">
                {TABS.map((t) => (
                    <button key={t.key} className={`tab-btn ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
                        {t.label}
                    </button>
                ))}
            </nav>
            {active.render()}
            <Toast />
        </main>
    )
}

export default App
