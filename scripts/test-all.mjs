import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { formatSummary, normalizeReport, summarize } from './test-summary.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const require = createRequire(import.meta.url)
const nodeReporter = fileURLToPath(new URL('./node-summary-reporter.mjs', import.meta.url))
let activeChild
let interrupted

function executeCommand({ args, cwd = root, env = {} }) {
  return new Promise(resolveResult => {
    let error
    // Pass arguments directly; no shell quoting, glob expansion or npm.cmd
    // handling is needed, including on Windows and paths containing spaces.
    const childEnv = { ...process.env, ...env }
    delete childEnv.NODE_TEST_CONTEXT // A new runner must not inherit a parent test worker's context.
    activeChild = spawn(process.execPath, args, { cwd, env: childEnv, stdio: 'inherit' })
    activeChild.once('error', err => { error = err.message })
    activeChild.once('close', (exitCode, signal) => {
      activeChild = undefined
      resolveResult({ exitCode, signal, error })
    })
  })
}

function nodeSuite(id, label, directory) {
  return { id, label, kind: 'node', async command(reportFile) {
    const files = (await readdir(join(root, directory))).filter(name => name.endsWith('.test.mjs')).sort()
    if (!files.length) throw new Error(`No tests found in ${directory}`)
    return { args: ['--test', '--test-reporter=spec', '--test-reporter-destination=stdout',
      `--test-reporter=${nodeReporter}`, `--test-reporter-destination=${reportFile}`,
      ...files.map(name => join(root, directory, name))] }
  } }
}

const suites = [
  nodeSuite('regression', 'Node regression', 'tests/unit'),
  nodeSuite('support', 'Test infrastructure', 'tests/support'),
  { id: 'vitest', label: 'Vitest', kind: 'vitest', command: reportFile => ({
    cwd: join(root, 'client'), args: [join(dirname(require.resolve('../client/node_modules/vitest/package.json')), 'vitest.mjs'),
      'run', '--reporter=default', '--reporter=json', `--outputFile.json=${reportFile}`],
  }) },
  nodeSuite('api', 'API integration', 'tests/integration'),
  { id: 'e2e', label: 'E2E desktop/mobile', kind: 'playwright', command: reportFile => ({
    args: [require.resolve('@playwright/test/cli'), 'test', '--reporter=list,html,json'],
    env: { PLAYWRIGHT_JSON_OUTPUT_FILE: reportFile, PLAYWRIGHT_HTML_OPEN: 'never' },
  }) },
]

// Exported so failure/missing-report behaviour can be verified without running
// the application or a database in a test of the test runner itself.
export async function runSuites(selectedSuites, reportDir, {
  execute = executeCommand, log = console.log, shouldStop = () => false,
} = {}) {
  const results = []
  for (const suite of selectedSuites) {
    const result = { id: suite.id, label: suite.label, counts: null, exitCode: null }
    results.push(result)
    if (shouldStop()) { result.error = 'Not run: interrupted'; continue }
    log(`\n=== ${suite.label} ===\n`)
    const reportFile = join(reportDir, `${suite.id}.json`)
    try {
      Object.assign(result, await execute(await suite.command(reportFile)))
      result.counts = normalizeReport(suite.kind, JSON.parse(await readFile(reportFile, 'utf8')))
    } catch (error) {
      result.error = error.code === 'ENOENT' ? 'No result report was produced. See the runner output above.' : error.message
    }
  }
  return results
}

async function main() {
  const start = Date.now()
  await mkdir(join(root, '.test-runtime'), { recursive: true })
  // Every invocation has fresh report paths: an earlier successful run cannot
  // make a crashed or interrupted run appear to have passed.
  const reportDir = await mkdtemp(join(root, '.test-runtime', 'test-all-'))
  const stop = signal => { interrupted = signal; activeChild?.kill(signal) }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
  try {
    const results = await runSuites(suites, reportDir, { shouldStop: () => Boolean(interrupted) })
    const duration = (Date.now() - start) / 1000
    console.log(formatSummary(results, duration))
    await writeFile(join(reportDir, 'summary.json'), JSON.stringify({
      ...summarize(results), durationSeconds: duration, suites: results,
    }, null, 2))
    console.log(`Reports: ${relative(root, reportDir)}`)
    process.exitCode = interrupted ? (interrupted === 'SIGINT' ? 130 : 143) : summarize(results).success ? 0 : 1
  } finally {
    process.off('SIGINT', stop)
    process.off('SIGTERM', stop)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error); process.exitCode = 1 })
}
