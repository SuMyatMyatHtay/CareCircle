import mongoose from 'mongoose'
import { MongoMemoryReplSet } from 'mongodb-memory-server-core'

// These helpers never read .env or accept a shared/remote database URI.
// A real mongod runs in a fresh temporary directory and is removed on shutdown.
export async function startTestDatabase(label) {
  // A developer's exported cloud credentials must never enable paid/live calls
  // in an otherwise isolated API/E2E run. Tests can opt into local provider doubles.
  for (const key of ['GEMINI_API_KEY', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI',
    'AZURE_TRANSLATOR_KEY', 'AZURE_TRANSLATOR_REGION', 'GROQ_API_KEY']) delete process.env[key]
  const dbName = `carecircle_test_${label}_${process.pid}`
  // One real local replica-set member enables multi-document transactions.
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, ip: '127.0.0.1', storageEngine: 'wiredTiger' } })
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
  validateTestDatabaseUri(uri)
  await mongoose.connect(uri)
}

export function validateTestDatabaseUri(uri) {
  const parsed = new URL(uri)
  if (parsed.protocol !== 'mongodb:' || parsed.hostname !== '127.0.0.1' ||
      !/^\/carecircle_test_[a-z0-9_]+$/.test(parsed.pathname)) {
    throw new Error('Tests require a generated local carecircle_test_ database')
  }
}

export function assertTestDatabase() {
  if (mongoose.connection.host !== '127.0.0.1' || !mongoose.connection.name?.startsWith('carecircle_test_'))
    throw new Error('Refusing to reset data outside an isolated test database')
}

export { mongoose }
