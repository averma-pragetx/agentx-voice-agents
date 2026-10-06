import { useEffect, useState } from 'react'

const STORAGE_KEY = 'agentx-detected-country'
const IP_STORAGE_KEY = 'agentx-visitor-ip'
const GEO_ENDPOINT = 'https://ipwho.is/'
const IP_WAIT_MS = 2000

const readCache = (key) => {
    try {
        return window.sessionStorage.getItem(key)
    } catch {
        return null // sessionStorage unavailable
    }
}

const writeCache = (key, value) => {
    try {
        window.sessionStorage.setItem(key, value)
    } catch {
        // ignore
    }
}

// One ipwho.is request per page load, shared by the country default and the caller IP.
let lookupPromise = null
const lookupVisitor = () => {
    if (!lookupPromise) {
        lookupPromise = fetch(GEO_ENDPOINT)
            .then((res) => res.json())
            .then((data) => {
                if (data?.success === false) return {}
                const country = data?.country_code?.toLowerCase() || null
                const ip = data?.ip || null
                if (country) writeCache(STORAGE_KEY, country)
                if (ip) writeCache(IP_STORAGE_KEY, ip)
                return { country, ip }
            })
            .catch(() => ({}))
    }
    return lookupPromise
}

// Visitor's public IP, sent to the backend for the team notification email. Resolves null
// if the lookup fails (ad blockers often block ipwho.is) or takes longer than IP_WAIT_MS —
// a call should never wait on this.
export const getVisitorIp = () => {
    const cached = readCache(IP_STORAGE_KEY)
    if (cached) return Promise.resolve(cached)
    const timeout = new Promise((resolve) => setTimeout(() => resolve(null), IP_WAIT_MS))
    return Promise.race([lookupVisitor().then((result) => result.ip || null), timeout])
}

// Detects visitor's country (lowercase iso2) from IP so the phone input defaults to the right
// dial code. null while loading or when the lookup fails — callers pick their own fallback. Cached per session.
export const useDetectedCountry = () => {
    const [country, setCountry] = useState(null)

    useEffect(() => {
        const cached = readCache(STORAGE_KEY)
        if (cached) {
            setCountry(cached)
            return undefined
        }

        let cancelled = false
        lookupVisitor().then(({ country: code }) => {
            if (!cancelled && code) setCountry(code)
        })

        return () => {
            cancelled = true
        }
    }, [])

    return country
}
