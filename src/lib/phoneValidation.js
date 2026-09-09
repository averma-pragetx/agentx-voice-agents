import { PhoneNumberUtil } from 'google-libphonenumber'

const phoneUtil = PhoneNumberUtil.getInstance()

export const isValidPhone = (value) => {
    if (!value) return false
    try {
        const countryCode = value.slice(0, value.indexOf(' '))
        const phoneNumber = phoneUtil.parseAndKeepRawInput(value, countryCode)
        return phoneUtil.isValidNumber(phoneNumber)
    } catch {
        return false
    }
}
