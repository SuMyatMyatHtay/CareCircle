import 'dotenv/config'
import { app } from './app.js'

if (!process.env.VERCEL) {
  const port = Number(process.env.PORT || 3000)

  app.listen(port, () => {
    console.log(`CareCircle API running on port ${port}`)
  })
}

export default app