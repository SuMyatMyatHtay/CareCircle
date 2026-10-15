// Owner: SeungHak (F)
// Care log entries written about a recipient, e.g. notes after an appointment.
// Stored in the 'logentries' collection, which server/seed.js fills with sample data.
import mongoose from 'mongoose'
import { LOG_TYPES, INPUT_METHODS, MEDICATION_CHANGES } from '../../constants.js'

// One medication change, e.g. { name: 'Amlodipine', change: 'dosage_changed', details: '5mg to 10mg' }
const medicationChangeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Medication name is required'],
        trim: true,
        maxlength: [100, 'Medication name must be at most 100 characters']
    },
    change: {
        type: String,
        enum: {
            values: MEDICATION_CHANGES,
            message: `Medication change must be one of: ${MEDICATION_CHANGES.join(', ')}`
        },
        required: [true, 'Medication change type is required']
    },
    details: {
        type: String,
        trim: true,
        maxlength: [300, 'Medication details must be at most 300 characters'],
        default: ''
    }
}, { _id: false })

// Only used when type is 'consultation'
const consultationSchema = new mongoose.Schema({
    doctorName: { type: String, trim: true, maxlength: 100, default: '' },
    clinic: { type: String, trim: true, maxlength: 120, default: '' },
    nextAppointment: { type: Date, default: null }
}, { _id: false })

const logEntrySchema = new mongoose.Schema({
    family: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Family',
        required: true
    },

    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CareRecipient',
        required: [true, 'Recipient is required']
    },

    // Set when the log is written from a task, e.g. after an appointment
    task: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
        default: null
    },

    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    type: {
        type: String,
        enum: {
            values: LOG_TYPES,
            message: `Type must be one of: ${LOG_TYPES.join(', ')}`
        },
        required: [true, 'Type is required']
    },

    content: {
        type: String,
        required: [true, 'Content is required'],
        trim: true,
        maxlength: [5000, 'Content must be at most 5000 characters']
    },

    // Language the content was written in
    originalLang: {
        type: String,
        trim: true,
        default: 'en'
    },

    // Translation cache: language code -> translated content, e.g. { zh: '...' }
    translations: {
        type: Map,
        of: String,
        default: {}
    },

    consultation: {
        type: consultationSchema,
        default: null
    },

    medicationChanges: {
        type: [medicationChangeSchema],
        default: []
    },

    inputMethod: {
        type: String,
        enum: {
            values: INPUT_METHODS,
            message: `Input method must be one of: ${INPUT_METHODS.join(', ')}`
        },
        default: 'text'
    }
}, { timestamps: true })

// Recipient log tab: newest first
logEntrySchema.index({ recipient: 1, createdAt: -1 })
// Family activity feed: newest first
logEntrySchema.index({ family: 1, createdAt: -1 })

// The model must be named 'LogEntry' so it reads the seeded 'logentries' collection
export default mongoose.models.LogEntry ||
    mongoose.model('LogEntry', logEntrySchema, 'logentries')
