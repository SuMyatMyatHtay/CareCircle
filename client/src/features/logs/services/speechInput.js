// Owner: SeungHak (F)
import { http } from '../../../services/http.js'

const AUDIO_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']

let recorder = null
let stream = null
let chunks = []

function pickAudioType() {
    return AUDIO_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) || ''
}

function releaseMicrophone() {
    stream?.getTracks().forEach((track) => track.stop())
    stream = null
    recorder = null
    chunks = []
}

function microphoneErrorMessage(error) {
    if (error.name === 'NotAllowedError') {
        return 'Microphone access is blocked. Allow it in your browser settings and try again.'
    }
    if (error.name === 'NotFoundError') {
        return 'No microphone was found on this device.'
    }
    return 'Could not start the microphone.'
}

async function sendForTranscription(audio) {
    const token = sessionStorage.getItem('token')
    if (!token) throw new Error('Please log in first.')

    try {
        const response = await http.post('/integrations/transcribe', audio, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': audio.type.split(';')[0]
            }
        })
        return response.data.text || ''
    } catch (error) {
        if (error.response?.status === 413) {
            throw new Error('That recording is too long. Please keep voice notes under a few minutes.')
        }
        throw new Error(error.response?.data?.error || 'Could not turn your voice into text.')
    }
}

export const speechInput = {
    available: typeof window !== 'undefined' &&
        !!navigator.mediaDevices?.getUserMedia &&
        typeof MediaRecorder !== 'undefined',

    async start() {
        if (!this.available) {
            throw new Error("Voice input isn't supported in this browser. Please type your note.")
        }

        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        } catch (error) {
            releaseMicrophone()
            throw new Error(microphoneErrorMessage(error))
        }

        const mimeType = pickAudioType()
        recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
        chunks = []
        recorder.ondataavailable = (event) => {
            if (event.data.size) chunks.push(event.data)
        }
        recorder.start()
    },

    async stop() {
        if (!recorder) return ''

        const active = recorder
        const stopped = new Promise((resolve) => {
            active.onstop = resolve
        })
        active.stop()
        await stopped

        const audio = new Blob(chunks, { type: active.mimeType || 'audio/webm' })
        releaseMicrophone()

        if (!audio.size) return ''
        return sendForTranscription(audio)
    },

    cancel() {
        if (recorder && recorder.state !== 'inactive') {
            recorder.onstop = null
            recorder.stop()
        }
        releaseMicrophone()
    }
}
