import 'dotenv/config'
import { app } from './app.js'
import { connectDatabase } from './config/database.js'

let connectionPromise

if (process.env.MONGODB_URI) {
  connectionPromise = connectDatabase(
    process.env.MONGODB_URI
  ).catch((error) => {
    connectionPromise = undefined
    console.error('MongoDB connection failed:', error.message)
    throw error
  })
}

app.use(async (_req, res, next) => {
  if (!connectionPromise) return next()

  try {
    await connectionPromise
    next()
  } catch (error) {
    res.status(503).json({
      success: false,
      message: 'Database unavailable'
    })
  }
})

if (!process.env.VERCEL) {
  const port = Number(process.env.PORT || 3000)

  app.listen(port, () => {
    console.log(`CareCircle API running on port ${port}`)
  })
}

export default app