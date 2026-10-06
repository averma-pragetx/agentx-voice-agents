import { useId, useRef, useState } from 'react'
import { Turnstile } from '@marsidev/react-turnstile'
import PhoneInput from 'react-phone-input-2'
import 'react-phone-input-2/lib/style.css'
import { PHONE_COUNTRIES, countryName, dialCodeFor, isValidMobile, stripDialCode, toE164 } from '../lib/phoneValidation'
import { getVisitorIp, useDetectedCountry } from '../lib/useDetectedCountry'
import { INDUSTRY_OPTIONS } from '../constants/voiceAgentCategories'
import { showToast } from '../lib/toast'
import WindowCard from './WindowCard'
import { CheckIcon, PhoneIcon } from './Icons'

const BASE_URL = import.meta.env.VITE_BASE_URL
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY_INDUSTRY

const REASSURANCES = [
    'A real call within ~10 seconds',
    'Any number, no signup required',
    'Hear exactly how Voice Agents sounds live',
]

const validate = ({ user_name, user_number, phone_country, industry }) => {
    const errors = {}
    if (!user_name.trim()) errors.user_name = 'Name is required'
    else if (!/^[A-Za-z\s]+$/.test(user_name.trim())) errors.user_name = 'Name can only contain letters'
    else if (user_name.trim().length < 2) errors.user_name = 'Name must be at least 2 characters'

    if (!user_number.trim()) errors.user_number = 'Phone number is required'
    else if (!isValidMobile(user_number, phone_country)) errors.user_number = `Enter a valid ${countryName(phone_country)} mobile number`

    if (!industry) errors.industry = 'Industry is required'
    return errors
}

const FormField = ({ id, label, error, children }) => (
    <div className="field">
        <label htmlFor={id}>{label}</label>
        {children}
        {error && <p className="field-error" role="alert">{error}</p>}
    </div>
)

const LiveDemoCallSection = () => {
    const [status, setStatus] = useState('idle') // idle | success
    const [callPhase, setCallPhase] = useState('idle') // idle | counting | dialing
    const [countdown, setCountdown] = useState(3)
    const [touched, setTouched] = useState({})
    const [values, setValues] = useState({ user_name: '', user_number: '', phone_country: null, industry: '' })
    const [turnstileToken, setTurnstileToken] = useState(null)
    const turnstileRef = useRef(null)
    const formId = useId()
    const detectedCountry = useDetectedCountry()

    // Until the visitor picks one, follow IP detection — but only within the countries we call.
    const phoneCountry = values.phone_country || (PHONE_COUNTRIES.includes(detectedCountry) ? detectedCountry : 'in')
    // Visitors outside the supported countries can't request a call; the backend enforces the same from the request IP.
    const unavailable = detectedCountry && !PHONE_COUNTRIES.includes(detectedCountry)
    const errors = validate({ ...values, phone_country: phoneCountry })
    const busy = callPhase !== 'idle'

    const handleSubmit = async (e) => {
        e.preventDefault()
        setTouched({ user_name: true, user_number: true, industry: true })
        if (Object.keys(errors).length > 0 || !turnstileToken) return

        setCallPhase('counting')
        for (let i = 3; i >= 1; i--) {
            setCountdown(i)
            await new Promise((resolve) => setTimeout(resolve, 1000))
        }
        setCallPhase('dialing')

        const phone = toE164(values.user_number, phoneCountry)
        const industryLabel = INDUSTRY_OPTIONS.find((option) => option.value === values.industry)?.title || values.industry
        const callerIp = await getVisitorIp() // usually cached from the country lookup; null if unavailable

        try {
            const response = await fetch(`${BASE_URL}/agent_demo/call/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agent_type: 'Support',
                    user_name: values.user_name.trim(),
                    user_number: phone,
                    industry: industryLabel,
                    caller_ip: callerIp,
                    turnstileToken,
                }),
            })
            const data = await response.json().catch(() => ({}))
            if (!response.ok) throw new Error(data.detail || 'Unexpected response')

            setStatus('success')
            showToast('Your phone should be ringing now!', 'success')
            setValues((v) => ({ ...v, user_name: '', user_number: '', industry: '' }))
            setTouched({})
        } catch (error) {
            console.error('Live demo call request failed:', error)
            showToast(error.message || "We couldn't place the call — please try again", 'error')
        } finally {
            // Tokens are single-use — get a fresh one for the next submit.
            turnstileRef.current?.reset()
            setTurnstileToken(null)
            setCallPhase('idle')
            setCountdown(3)
        }
    }

    return (
        <section className="widget-section">
            <div className="widget-grid">
                <div className="widget-copy">
                    <span className="badge">Live Demo</span>
                    <h2>Hear it for yourself — right now</h2>
                    <p>Drop in your number and Voice Agents will call you in seconds — no scheduling, no waiting.</p>
                    <ul className="check-list">
                        {REASSURANCES.map((item) => (
                            <li key={item}>
                                <span className="check-icon"><CheckIcon size={14} /></span>
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>

                <WindowCard title="Request a Call">
                    {unavailable ? (
                        <div className="success-panel" role="status">
                            <p className="success-title">Not available in your country yet</p>
                            <p className="success-sub">Live demo calls are currently offered in the US, Canada, India, the UK and Europe.</p>
                        </div>
                    ) : status === 'idle' ? (
                        <>
                            <div className="card-heading">
                                <h3>Request your call</h3>
                                <p>Takes less than 10 seconds.</p>
                            </div>

                            <form onSubmit={handleSubmit} noValidate>
                                <FormField id={`${formId}-name`} label="Your name" error={touched.user_name && errors.user_name}>
                                    <input
                                        id={`${formId}-name`}
                                        type="text"
                                        placeholder="Jane Doe"
                                        className="text-field"
                                        disabled={busy}
                                        value={values.user_name}
                                        onChange={(e) => setValues((v) => ({ ...v, user_name: e.target.value }))}
                                        onBlur={() => setTouched((t) => ({ ...t, user_name: true }))}
                                    />
                                </FormField>

                                <FormField id={`${formId}-phone`} label="Phone number" error={touched.user_number && errors.user_number}>
                                    <div className="phone-field">
                                        <PhoneInput
                                            country={phoneCountry}
                                            onlyCountries={PHONE_COUNTRIES}
                                            preserveOrder={['onlyCountries']}
                                            disableCountryCode
                                            disableCountryGuess
                                            autoFormat={false} // its masks also format the list's dial codes, showing +353 as "35 3" and +33 as "3 3"
                                            enableSearch
                                            searchPlaceholder="Search country"
                                            placeholder=""
                                            disabled={busy}
                                            value={values.user_number}
                                            onChange={(value, country) => {
                                                const iso2 = country.countryCode || phoneCountry
                                                setValues((v) => ({ ...v, phone_country: iso2, user_number: stripDialCode(value, iso2) }))
                                            }}
                                            onBlur={() => setTouched((t) => ({ ...t, user_number: true }))}
                                            inputProps={{ id: `${formId}-phone`, name: 'user_number', required: true, inputMode: 'tel' }}
                                        />
                                        <span className="selected-dial-code" aria-hidden="true">+{dialCodeFor(phoneCountry)}</span>
                                    </div>
                                </FormField>

                                <FormField id={`${formId}-industry`} label="Industry" error={touched.industry && errors.industry}>
                                    <select
                                        id={`${formId}-industry`}
                                        className="text-field"
                                        disabled={busy}
                                        value={values.industry}
                                        onChange={(e) => setValues((v) => ({ ...v, industry: e.target.value }))}
                                        onBlur={() => setTouched((t) => ({ ...t, industry: true }))}
                                    >
                                        <option value="" disabled>Select your industry</option>
                                        {INDUSTRY_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>{option.title}</option>
                                        ))}
                                    </select>
                                </FormField>

                                <Turnstile
                                    ref={turnstileRef}
                                    siteKey={TURNSTILE_SITE_KEY}
                                    options={{ action: 'industry_call' }}
                                    onSuccess={setTurnstileToken}
                                    onExpire={() => setTurnstileToken(null)}
                                    onError={() => setTurnstileToken(null)}
                                />

                                <button type="submit" disabled={busy || !turnstileToken} className="dark-btn">
                                    <PhoneIcon size={17} />
                                    {callPhase === 'counting' && `Calling in ${countdown}…`}
                                    {callPhase === 'dialing' && 'Calling…'}
                                    {callPhase === 'idle' && 'Call Me Now'}
                                </button>
                            </form>

                            <p className="fine-print">
                                By requesting a call you agree to receive an automated call from Voice Agents. Message/data rates may apply.
                                {' '}<a href="https://db-ip.com" target="_blank" rel="noopener noreferrer">IP geolocation by DB-IP</a>.
                            </p>
                        </>
                    ) : (
                        <div className="success-panel" role="status" aria-live="polite">
                            <span className="check-icon big"><CheckIcon size={26} /></span>
                            <p className="success-title">Your phone should be ringing now</p>
                            <p className="success-sub">Didn&apos;t get a call? Give it a moment — it can take up to 10 seconds.</p>
                            <button onClick={() => setStatus('idle')} className="link-btn">Request another call</button>
                        </div>
                    )}
                </WindowCard>
            </div>
        </section>
    )
}

export default LiveDemoCallSection
