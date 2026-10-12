import { connectDatabase } from './config/database.js'
import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import apiRouter from './routes/index.js'

export const app = express()

app.use(cors())
app.use(express.json())

// Check whether the Express server is running
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    app: 'CareCircle'
  })
})

// Cache the connection promise for serverless reuse
let dbConnectionPromise = null

async function ensureDatabaseConnected() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not configured')
  }

  if (mongoose.connection.readyState === 1) {
    return
  }

  if (!dbConnectionPromise) {
    dbConnectionPromise = connectDatabase(
      process.env.MONGODB_URI
    ).catch((error) => {
      dbConnectionPromise = null
      throw error
    })
  }

  await dbConnectionPromise
}

// Connect before database-dependent API requests
app.use('/api', async (req, res, next) => {
  try {
    await ensureDatabaseConnected()
    next()
  } catch (error) {
    console.error('MongoDB connection failed:', error.message)

    res.status(503).json({
      success: false,
      message: 'Database connection unavailable'
    })
  }
})

// Check whether MongoDB is connected
app.get('/api/health/db', async (_req, res) => {
  try {
    // Check the connection state
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: 'MongoDB is not connected',
        status: 'disconnected'
      })
    }

    // Send a ping to MongoDB
    await mongoose.connection.db.admin().ping()

    return res.status(200).json({
      success: true,
      message: 'MongoDB connected successfully',
      database: mongoose.connection.name,
      status: 'connected'
    })

  } catch (error) {
    console.error('Database health check failed:', error.message)

    return res.status(503).json({
      success: false,
      message: 'MongoDB health check failed',
      status: 'disconnected'
    })
  }
})

// Other API routes
app.use('/api', apiRouter)

// Global error handler
app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({
    error: 'Internal server error'
  })
})

export default app