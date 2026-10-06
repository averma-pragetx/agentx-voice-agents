import libphonenumber from 'google-libphonenumber'

const { PhoneNumberFormat, PhoneNumberType, PhoneNumberUtil } = libphonenumber // CJS package: default import works in both Vite and Node

const phoneUtil = PhoneNumberUtil.getInstance()
const MOBILE_TYPES = [PhoneNumberType.MOBILE, PhoneNumberType.FIXED_LINE_OR_MOBILE] // US/CA numbers can't be told apart, so they're FIXED_LINE_OR_MOBILE
const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })

// Countries offered in the dial-code dropdown, in display order (react-phone-input-2 iso2 codes).
export const PHONE_COUNTRIES = ['us', 'ca', 'in', 'gb', 'de', 'fr', 'it', 'es', 'at', 'ch', 'nl', 'be', 'se', 'pl', 'pt', 'gr', 'ie']

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

// libphonenumber reads "919876543210" under IN as +91 9876543210; keep only the national part
// so the dial code never shows twice. "9198765432" is itself a valid Indian mobile and is left alone.
export const stripDialCode = (digits, iso2) =>
    digits.startsWith(String(dialCodeFor(iso2))) && isValidMobile(digits, iso2)
        ? String(parse(digits, iso2).getNationalNumber())
        : digits

export const toE164 = (digits, iso2) => phoneUtil.format(parse(digits, iso2), PhoneNumberFormat.E164)
