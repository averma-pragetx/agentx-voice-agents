// Card framed like the product mockups on voice-agents.pragetx.ai (traffic-light window bar).
const WindowCard = ({ title, live = false, children }) => (
    <div className="card">
        <div className="window-bar">
            <div className="window-dots" aria-hidden="true"><span /><span /><span /></div>
            <span>{title}</span>
            {live && (
                <span className="window-live">
                    <span className="live-dot" />
                    Live
                </span>
            )}
        </div>
        <div className="card-body">{children}</div>
    </div>
)

export default WindowCard
