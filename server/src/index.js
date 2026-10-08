import 'dotenv/config'
import { app } from './app.js'
import { connectDatabase } from './config/database.js'

const port = Number(process.env.PORT || 3000)
// The scaffold starts even without MongoDB configured. Feature endpoints are not implemented.
if (process.env.MONGODB_URI) {
  connectDatabase(process.env.MONGODB_URI).catch((error) => {
    console.error('MongoDB connection failed:', error.message)
  })
} else {
  console.warn('MONGODB_URI not set: database is not connected')
}
app.listen(port, () => console.log(`CareCircle API at http://localhost:${port}`))
