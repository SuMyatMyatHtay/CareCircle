import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server-core'

// These helpers never read .env or accept a shared/remote database URI.
// A real mongod runs in a fresh temporary directory and is removed on shutdown.
export async function startTestDatabase(label) {
  const dbName = `carecircle_test_${label}_${process.pid}`
  const mongo = await MongoMemoryServer.create({ instance: { ip: '127.0.0.1', dbName } })
  const uri = mongo.getUri(dbName)
  try {
    await connectTestDatabase(uri)
    process.env.MONGODB_URI = uri
    process.env.JWT_SECRET = 'carecircle-isolated-tests-only-secret'
    return { uri, async stop() { await mongoose.disconnect(); await mongo.stop() } }
  } catch (error) {
    await mongo.stop()
    throw error
  }
}

export async function connectTestDatabase(uri) {
  const parsed = new URL(uri)
  if (parsed.protocol !== 'mongodb:' || parsed.hostname !== '127.0.0.1' ||
      !/^\/carecircle_test_[a-z0-9_]+$/.test(parsed.pathname)) {
    throw new Error('Tests require a generated local carecircle_test_ database')
  }
  await mongoose.connect(uri)
}

export function assertTestDatabase() {
  if (mongoose.connection.host !== '127.0.0.1' || !mongoose.connection.name?.startsWith('carecircle_test_'))
    throw new Error('Refusing to reset data outside an isolated test database')
}

export { mongoose }
