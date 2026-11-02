// Owner: SeungHak (F)
// The reader's language from their profile ("Preferred language"), e.g. 'zh' for Aunt May.
// Care notes open already translated into it. '' when it isn't one of the app's languages.
import { LANGUAGE_LABELS } from './logTypes.js'

export function preferredLanguage() {
    try {
        const lang = JSON.parse(sessionStorage.getItem('user') || '{}').preferredLang
        return Object.hasOwn(LANGUAGE_LABELS, lang) ? lang : ''
    } catch {
        return ''
    }
}
