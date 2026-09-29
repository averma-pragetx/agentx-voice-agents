const SITE_URL = 'https://voice-agents.pragetx.ai'

// Branding bar matching agentx-frontend's layouts/Header — logo + one CTA, no nav.
const Header = () => (
    <header className="site-header">
        <div className="site-header-inner">
            <a href={SITE_URL} target="_blank" rel="noopener noreferrer" className="site-logo">
                <img src="/voice-agents-logo.svg" alt="Voice Agents by PragetX" width="233" height="43" />
            </a>
        </div>
    </header>
)

export default Header
