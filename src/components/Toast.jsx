import { useEffect, useState } from 'react'
import { subscribeToast } from '../lib/toast'

const Toast = () => {
    const [toast, setToast] = useState(null)

    useEffect(() => {
        return subscribeToast((next) => {
            setToast(next)
            setTimeout(() => setToast(null), 3500)
        })
    }, [])

    if (!toast) return null

    return (
        <div className={`toast toast-${toast.tone}`} role="status" aria-live="polite">
            {toast.message}
        </div>
    )
}

export default Toast
