// Owner: Su Myat Myat Htay (Sera)
// Define and export the Mongoose User schema/model here.
import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    passwordHash: {
      type: String,
      required: true,
      select: false
    },

    phone: {
      type: String,
      default: ''
    },

    preferredLang: {
      type: String,
      default: 'en'
    },

    telegramUsername: {
      type: String,
      trim: true,
      default: ''
    }, 

    isCaretaker: {
      type: Boolean,
      default: false
    },

    tokenVersion: {
      type: Number,
      default: 0
    }, 
    
    petAppearance: {
      species: {
        type: String,
        enum: ['bunny', 'bear', 'fox', 'cat', 'red-panda', null],
        default: null
      },
      name: {
        type: String,
        default: '',
        maxlength: 30
      },
      equipped: {
        outfit: { type: String, default: '' },
        hat: { type: String, default: '' },
        accessory: { type: String, default: '' }
      }
}

  },
  { timestamps: true }
)

export default mongoose.model('User', userSchema)
