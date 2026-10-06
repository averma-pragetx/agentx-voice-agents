import libphonenumber from 'google-libphonenumber'

const { PhoneNumberFormat, PhoneNumberType, PhoneNumberUtil } = libphonenumber // CJS package: default import works in both Vite and Node

const phoneUtil = PhoneNumberUtil.getInstance()
const MOBILE_TYPES = [PhoneNumberType.MOBILE, PhoneNumberType.FIXED_LINE_OR_MOBILE] // US/CA numbers can't be told apart, so they're FIXED_LINE_OR_MOBILE
const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })

// Countries offered in the dial-code dropdown, in display order (react-phone-input-2 iso2 codes):
// main markets first, then Europe A–Z. Turkey covers Northern Cyprus (+90 392), which has no code of its own.
// Keep in sync with DEMO_CALL_REGIONS in the AgentX backend (app/api/agent_demo.py).
export const PHONE_COUNTRIES = [
    'us', 'ca', 'in', 'gb',
    'al', 'ad', 'at', 'by', 'be', 'ba', 'bg', 'hr', 'cy', 'cz', 'dk', 'ee', 'fo', 'fi', 'fr', 'de', 'gi', 'gr', 'hu', 'is',
    'ie', 'it', 'xk', 'lv', 'li', 'lt', 'lu', 'mk', 'mt', 'md', 'mc', 'me', 'nl', 'no', 'pl', 'pt', 'ro', 'sm', 'rs', 'sk',
    'si', 'es', 'se', 'ch', 'tr', 'ua', 'va',
]

export const dialCodeFor = (iso2) => phoneUtil.getCountryCodeForRegion(iso2.toUpperCase())
export const countryName = (iso2) => regionNames.of(iso2.toUpperCase())

const parse = (digits, iso2) => {
    try {
        return phoneUtil.parse(digits, iso2.toUpperCase())
    } catch {
        return null
    }
}

// `digits` is the number without its dial code; validity uses the selected country's own rules
// (e.g. India: 10 digits starting 6–9) and accepts mobiles only.
export const isValidMobile = (digits, iso2) => {
    const number = parse(digits, iso2)
    return !!number
        && phoneUtil.isValidNumberForRegion(number, iso2.toUpperCase())
        && MOBILE_TYPES.includes(phoneUtil.getNumberType(number))
}

// Keep the dial code out of the number box when it's typed or pasted again ("919876543210" → "9876543210").
// "9198765432" is itself a valid Indian mobile and is left alone. libphonenumber strips the code on its own
// for fixed-length countries like IN; variable-length ones (DE, XK) need the explicit slice.
export const stripDialCode = (digits, iso2) => {
    const dialCode = String(dialCodeFor(iso2))
    if (!digits.startsWith(dialCode)) return digits
    if (isValidMobile(digits, iso2)) return String(parse(digits, iso2).getNationalNumber())
    const rest = digits.slice(dialCode.length)
    return isValidMobile(rest, iso2) ? rest : digits
}

export const toE164 = (digits, iso2) => phoneUtil.format(parse(digits, iso2), PhoneNumberFormat.E164)
