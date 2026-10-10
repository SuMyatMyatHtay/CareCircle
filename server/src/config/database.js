import mongoose from 'mongoose'

export async function connectDatabase(uri) {
  await mongoose.connect(uri, {
    dbName: 'carecircle'
  })

  console.log(`MongoDB connected to: ${mongoose.connection.name}`)
}