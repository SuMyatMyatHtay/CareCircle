// Owner: SeungHak (F)

export const NOT_CONNECTED_MESSAGE = "Voice input isn't connected yet. Please type your note for now."

export const speechInput = {
    available: false,

    async start() {
        throw new Error(NOT_CONNECTED_MESSAGE)
    },

    async stop() {
        return ''
    },

    cancel() {}
}
