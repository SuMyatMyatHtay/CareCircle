// Real app routes and MongoDB still run; only the external Azure boundary is
// replaced. No cloud credentials or paid provider calls are used by these tests.
export function installTranslationProvider() {
  const originalFetch = globalThis.fetch
  const state = { calls: [], mode: 'success' }
  process.env.AZURE_TRANSLATOR_KEY = 'isolated-translation-test-key'
  process.env.AZURE_TRANSLATOR_REGION = 'isolated-test-region'
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
    if (url.hostname === 'api.cognitive.microsofttranslator.com') {
      state.calls.push({ to: url.searchParams.get('to'), from: url.searchParams.get('from'),
        text: JSON.parse(options.body)[0].Text })
      const status = state.mode === 'failure' ? 503 : 200
      // Like Azure without "from": it reports the detected language (the test notes are English)
      const to = url.searchParams.get('to')
      const text = to === 'en' ? JSON.parse(options.body)[0].Text : '这是已翻译的护理记录。'
      const payload = state.mode === 'failure' ? { error: { code: 503000, message: 'provider-test-error' } }
        : state.mode === 'empty' ? [] : [{ detectedLanguage: { language: 'en', score: 1 }, translations: [{ text, to }] }]
      return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } })
    }
    if (url.hostname !== '127.0.0.1') throw new Error(`Unexpected external test request: ${url.hostname}`)
    return originalFetch(input, options)
  }
  return Object.assign(state, { reset() { state.calls.length = 0; state.mode = 'success' },
    restore() { globalThis.fetch = originalFetch; delete process.env.AZURE_TRANSLATOR_KEY; delete process.env.AZURE_TRANSLATOR_REGION } })
}
