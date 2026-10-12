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

    tokenVersion: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
)

export default mongoose.model('User', userSchema)
