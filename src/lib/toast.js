// ponytail: no toast library — a module-level listener set + one <Toast/> mount is
// enough for a two-widget app. Add react-hot-toast if a third consumer needs it.
const listeners = new Set()

export const showToast = (message, tone = 'success') => {
    listeners.forEach((fn) => fn({ message, tone }))
}

export const subscribeToast = (fn) => {
    listeners.add(fn)
    return () => listeners.delete(fn)
}
