import Header from './components/Header'
import LiveDemoCallSection from './components/LiveDemoCallSection'
import VoiceAgentWidget from './components/VoiceAgentWidget'
import Toast from './components/Toast'

const App = () => (
    <>
        <Header />
        <main className="app-shell">
            <LiveDemoCallSection />
            <VoiceAgentWidget />
            <Toast />
        </main>
    </>
)

export default App
