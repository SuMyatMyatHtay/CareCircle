import express from 'express'
import cors from 'cors'
import apiRouter from './routes/index.js'
export const app = express()
app.use(cors())
app.use(express.json())
app.get('/api/health', (_req, res) => res.json({ status: 'ok', app: 'CareCircle' }))
app.use('/api', apiRouter)
app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})
