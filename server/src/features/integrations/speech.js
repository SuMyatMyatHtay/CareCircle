// Owner: SeungHak (F)
// POST /api/integrations/transcribe
// Body: raw audio (Content-Type audio/webm, audio/mp4, ...), sent by the voice button.
// Sends the recording to Groq's Whisper model and returns { text }.
import express from 'express'

const GROQ_TRANSCRIBE_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'
const GROQ_MODEL = 'whisper-large-v3-turbo'
const MAX_AUDIO_BYTES = 4 * 1024 * 1024

const EXTENSIONS = {
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/mp4': 'mp4',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav'
}

export const readAudio = express.raw({ type: 'audio/*', limit: MAX_AUDIO_BYTES })

export async function transcribe(req, res) {
    if (!process.env.GROQ_API_KEY) {
        return res.status(503).json({ error: 'Voice input is not set up on the server.' })
    }

    if (!Buffer.isBuffer(req.body) || !req.body.length) {
        return res.status(400).json({ error: 'Validation failed', errors: ['Send an audio recording'] })
    }

    const mimeType = (req.headers['content-type'] || '').split(';')[0].trim()
    const extension = EXTENSIONS[mimeType] || 'webm'

    const form = new FormData()
    form.append('file', new Blob([req.body], { type: mimeType }), `note.${extension}`)
    form.append('model', GROQ_MODEL)
    form.append('response_format', 'json')

    try {
        const response = await fetch(GROQ_TRANSCRIBE_URL, {
            method: 'POST',
            headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
            body: form,
            signal: AbortSignal.timeout(30000)
        })

        if (response.status === 429) {
            return res.status(429).json({ error: 'Too many voice notes right now. Please wait a minute and try again.' })
        }
        if (response.status === 400) {
            return res.status(400).json({ error: "We couldn't read that recording. Please try again." })
        }
        if (!response.ok) {
            throw new Error(`Groq responded ${response.status}: ${await response.text()}`)
        }

        const data = await response.json()
        return res.json({ text: (data.text || '').trim() })
    } catch (error) {
        console.error('Groq transcription failed:', error.message)
        return res.status(502).json({ error: 'Voice input is unavailable right now. Please type your note.' })
    }
}
