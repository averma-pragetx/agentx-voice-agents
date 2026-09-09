import { useEffect, useState } from 'react'

const STORAGE_KEY = 'agentx-detected-country'
const DEFAULT_COUNTRY = 'in'
const GEO_ENDPOINT = 'https://ipwho.is/'

// Detects visitor's country from IP so the phone input defaults to the right
// dial code. Falls back to DEFAULT_COUNTRY on failure; cached per session.
export const useDetectedCountry = () => {
    const [country, setCountry] = useState(DEFAULT_COUNTRY)

    useEffect(() => {
        let cached = null
        try {
            cached = window.sessionStorage.getItem(STORAGE_KEY)
        } catch {
            // sessionStorage unavailable
        }
        if (cached) {
            setCountry(cached)
            return
        }

        let cancelled = false
        fetch(GEO_ENDPOINT)
            .then((res) => res.json())
            .then((data) => {
                const code = data?.success !== false ? data?.country_code?.toLowerCase() : null
                if (!cancelled && code) {
                    setCountry(code)
                    try {
                        window.sessionStorage.setItem(STORAGE_KEY, code)
                    } catch {
                        // ignore
                    }
                }
            })
            .catch(() => {})

        return () => {
            cancelled = true
        }
    }, [])

    return country
}
