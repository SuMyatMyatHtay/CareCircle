// Runs on the server only, so the API key never reaches the browser.
// App language code -> LibreTranslate language code.
// The keys must match LANGUAGE_LABELS in client/src/features/logs/logTypes.js.
// If a language fails, check https://libretranslate.com/languages
const LANGUAGE_CODES = {
    en: 'en',
    zh: 'zh-Hans',
    ms: 'ms',
    ta: 'ta'
}

export const SUPPORTED_LANGUAGES = Object.keys(LANGUAGE_CODES)

export function isSupportedLanguage(lang) {
    // Object.hasOwn avoids false positives from keys like "constructor"
    return Object.hasOwn(LANGUAGE_CODES, lang)
}

export async function translateText(text, targetLang, sourceLang = 'en') {
    const apiKey = process.env.AZURE_TRANSLATOR_KEY
    const region = process.env.AZURE_TRANSLATOR_REGION

    if (!apiKey || !region) {
        throw new Error('Azure Translation credentials are not configured in environment variables.')
    }

    // The endpoint is fixed; languages go in the query string.
    // URLSearchParams handles the encoding, so no hand-built URL can go wrong.
    const params = new URLSearchParams({
        'api-version': '3.0',
        to: LANGUAGE_CODES[targetLang],
        textType: 'plain' // keep the note as plain text, not HTML
    })
    // Leaving `from` out makes Azure detect the source language itself
    const from = LANGUAGE_CODES[sourceLang]
    if (from) params.set('from', from)

    const response = await fetch(`https://api.cognitive.microsofttranslator.com/translate?${params}`, {
        method: 'POST',
        headers: {
            'Ocp-Apim-Subscription-Key': apiKey,
            'Ocp-Apim-Subscription-Region': region,
            'Content-Type': 'application/json'
        },
        // Azure expects an array of objects with a "Text" key
        body: JSON.stringify([{ Text: text }]),
        // Don't let a slow service hang the request forever
        signal: AbortSignal.timeout(10_000)
    })


    if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || `Azure responded with ${response.status}`)
    }

    const data = await response.json()
    const translatedText = data?.[0]?.translations?.[0]?.text
    if (!translatedText) {
        throw new Error('Azure Translator returned an empty or unexpected payload structure')
    }
    return translatedText
}
