// Owner: Jhen (C)
import mongoose from 'mongoose'
import { CARE_TYPES, MOBILITY_LEVELS, ALLERGY_SEVERITIES } from '../../constants.js'

// Same shape as locationSchema in TaskModel.js, so OneMap results fit both
const locationSchema = new mongoose.Schema({
    name: { type: String, trim: true, maxlength: 120, default: '' },
    address: { type: String, trim: true, maxlength: 200, default: '' },
    postal: { type: String, trim: true, match: /^(\d{6})?$/, default: '' },
    lat: { type: Number, min: -90, max: 90 },
    lng: { type: Number, min: -180, max: 180 }
}, { _id: false })

const mobilitySchema = new mongoose.Schema({
    level: {
        type: String,
        enum: {
            values: MOBILITY_LEVELS,
            message: `Mobility level must be one of: ${MOBILITY_LEVELS.join(', ')}`
        }
    },
    notes: {
        type: String,
        trim: true,
        maxlength: [300, 'Mobility notes must be at most 300 characters'],
        default: ''
    }
}, { _id: false })

const allergySchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Allergy name is required'],
        trim: true,
        maxlength: [100, 'Allergy name must be at most 100 characters']
    },
    severity: {
        type: String,
        enum: {
            values: ALLERGY_SEVERITIES,
            message: `Allergy severity must be one of: ${ALLERGY_SEVERITIES.join(', ')}`
        },
        default: 'mild'
    }
}, { _id: false })

// Current list only; the history of changes lives in logEntries (F)
const medicationSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Medication name is required'],
        trim: true,
        maxlength: [100, 'Medication name must be at most 100 characters']
    },
    dosage: { type: String, trim: true, maxlength: 100, default: '' },
    frequency: { type: String, trim: true, maxlength: 100, default: '' },
    startDate: { type: Date, default: null },
    notes: { type: String, trim: true, maxlength: 300, default: '' },
    // Set by the controller, never taken from the request body
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedAt: { type: Date, default: null }
}, { _id: false })

const emergencyContactSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Emergency contact name is required'],
        trim: true,
        maxlength: [100, 'Emergency contact name must be at most 100 characters']
    },
    relationship: { type: String, trim: true, maxlength: 50, default: '' },
    phone: {
        type: String,
        required: [true, 'Emergency contact phone is required'],
        trim: true,
        maxlength: [30, 'Emergency contact phone must be at most 30 characters']
    }
}, { _id: false })

const careRecipientSchema = new mongoose.Schema({
    family: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Family',
        required: true
    },

    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        maxlength: [100, 'Name must be at most 100 characters']
    },

    // What the family calls them, e.g. "Grandpa"; shown in the UI
    nickname: {
        type: String,
        trim: true,
        maxlength: [50, 'Nickname must be at most 50 characters'],
        default: ''
    },

    profilePicture: { type: String, default: '' },
    careType: {
        type: String,
        enum: {
            values: CARE_TYPES,
            message: `Care type must be one of: ${CARE_TYPES.join(', ')}`
        },
        required: [true, 'Care type is required']
    },

    dateOfBirth: {
        type: Date,
        default: null,
        validate: {
            validator: (value) => !value || value <= new Date(),
            message: 'Date of birth cannot be in the future'
        }
    },

    mobility: { type: mobilitySchema, default: null },
    allergies: { type: [allergySchema], default: [] },
    conditions: {
        type: [{ type: String, trim: true, maxlength: [100, 'Conditions must be at most 100 characters each'] }],
        default: []
    },
    dietaryRestrictions: {
        type: [{ type: String, trim: true, maxlength: [100, 'Dietary restrictions must be at most 100 characters each'] }],
        default: []
    },
    medications: { type: [medicationSchema], default: [] },
    emergencyContacts: { type: [emergencyContactSchema], default: [] },
    preferredClinic: { type: locationSchema, default: null },

    careNotes: {
        type: String,
        trim: true,
        maxlength: [2000, 'Care notes must be at most 2000 characters'],
        default: ''
    },

    // Archive instead of delete, so old tasks and logs keep their recipient
    isActive: {
        type: Boolean,
        default: true
    },

    // Set when the recipient also has a CareCircle account (e.g. a pregnant member).
    // The controller checks they belong to the same family.
    linkedUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    }
}, {
    timestamps: true,
    collection: 'carerecipients'
})

// Recipient list, active only by default
careRecipientSchema.index({ family: 1, isActive: 1 })
// One account links to at most one recipient per family; unlinked (null) ones don't count
careRecipientSchema.index(
    { family: 1, linkedUser: 1 },
    { unique: true, partialFilterExpression: { linkedUser: { $type: 'objectId' } } }
)

// ---------- Database operations ----------
// Every query on care recipients lives here; controller.js only calls these statics.

const USER_FIELDS = 'name telegramUsername profilePicture'

function populateLinkedUser(query) {
    return query.populate('linkedUser', USER_FIELDS)
}

// Sorted by name; archived recipients only when asked for
careRecipientSchema.statics.getRecipientsByFamily = function (familyId, { includeArchived = false } = {}) {
    const filter = { family: familyId }
    if (!includeArchived) filter.isActive = true
    return populateLinkedUser(this.find(filter).sort({ name: 1 }))
}

// Raw document, for existence checks and comparing medications
careRecipientSchema.statics.getRecipientInFamily = function (familyId, recipientId) {
    return this.findOne({ _id: recipientId, family: familyId })
}

careRecipientSchema.statics.getPopulatedRecipientById = function (recipientId) {
    return populateLinkedUser(this.findById(recipientId))
}

careRecipientSchema.statics.createRecipient = function (recipientData) {
    return this.create(recipientData)
}

// Returns null if the recipient isn't in this family
careRecipientSchema.statics.updateRecipient = function (familyId, recipientId, changes) {
    return this.findOneAndUpdate(
        { _id: recipientId, family: familyId },
        { $set: changes },
        { new: true, runValidators: true }
    )
}

// Archiving twice is harmless: it just sets isActive to false again.
// The link is cleared too, otherwise the unique index would stop that account
// from ever being linked to another recipient (archived ones aren't editable).
careRecipientSchema.statics.archiveRecipient = function (familyId, recipientId) {
    return this.findOneAndUpdate(
        { _id: recipientId, family: familyId },
        { $set: { isActive: false, linkedUser: null } },
        { new: true }
    )
}

export default mongoose.models.CareRecipient ||
    mongoose.model('CareRecipient', careRecipientSchema, 'carerecipients')
