import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { formatSummary, normalizeReport, summarize, suiteStatus } from '../../scripts/test-summary.mjs'
import { runSuites } from '../../scripts/test-all.mjs'

const nodeReport = (passed = 2, failed = 0) => ({ success: failed === 0,
  counts: { tests: passed + failed, passed, failed, skipped: 0, todo: 0, cancelled: 0 } })
async function temporaryDirectory(t) {
  const directory = await mkdtemp(join(tmpdir(), 'carecircle summary-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  return directory
}

describe('Combined test results', () => {
  it('adds actual outcomes across all three runner formats', () => {
    const reports = [
      normalizeReport('node', nodeReport()),
      normalizeReport('vitest', { numTotalTests: 3, numPassedTests: 3, numFailedTests: 0, numTodoTests: 0, success: true }),
      normalizeReport('playwright', { stats: { expected: 4, unexpected: 0, skipped: 0, flaky: 0 }, errors: [] }),
    ]
    const results = reports.map((counts, index) => ({ label: `Suite ${index}`, counts, exitCode: 0 }))
    assert.equal(summarize(results).totals.passed, 9)
    assert.equal(summarize(results).success, true)
    assert.match(formatSummary(results, 1), /9 checks passed\./)
  })

  it('keeps skipped, todo, cancelled and flaky outcomes out of the passed total', () => {
    const counts = normalizeReport('vitest', {
      numTotalTests: 4, numPassedTests: 1, numFailedTests: 1, numPendingTests: 2, numTodoTests: 1, success: false,
    })
    assert.equal(counts.skipped, 1)
    assert.equal(counts.todo, 1)
    const node = normalizeReport('node', { success: false,
      counts: { tests: 2, passed: 1, failed: 0, skipped: 0, todo: 0, cancelled: 1 } })
    const browser = normalizeReport('playwright', { stats: { expected: 1, unexpected: 0, skipped: 1, flaky: 1 }, errors: [] })
    const results = [counts, node, browser].map(counts => ({ label: 'Suite', counts, exitCode: 1 }))
    const summary = summarize(results)
    assert.equal(summary.totals.total, 9)
    assert.equal(summary.totals.passed, 3)
    assert.equal(summary.success, false)
    const output = formatSummary(results, 1)
    for (const label of ['Todo', 'Cancelled', 'Flaky', 'Run failed']) assert.ok(output.includes(label))
    assert.doesNotMatch(output, /checks passed\./)
  })

  it('rejects invalid counts and treats zero-test or failed-runner reports as errors', () => {
    assert.throws(() => normalizeReport('node', nodeReport(-1)), /Invalid test count/)
    assert.throws(() => normalizeReport('node', { ...nodeReport(), counts: { ...nodeReport().counts, tests: 99 } }), /totals/)
    const empty = normalizeReport('node', nodeReport(0))
    assert.equal(suiteStatus({ counts: empty, exitCode: 0 }), 'ERROR')
    assert.equal(suiteStatus({ counts: normalizeReport('node', nodeReport()), exitCode: 1 }), 'ERROR')
    const providerError = normalizeReport('playwright', {
      stats: { expected: 1, unexpected: 0, skipped: 0, flaky: 0 }, errors: [{ message: 'Global teardown failed' }],
    })
    assert.equal(suiteStatus({ counts: providerError, exitCode: 0 }), 'ERROR')
  })

  it('prints a partial total for missing reports rather than inventing successful results', () => {
    const results = [
      { label: 'Node', counts: normalizeReport('node', nodeReport()), exitCode: 0 },
      { label: 'E2E', counts: null, exitCode: 1, error: 'No report' },
    ]
    const output = formatSummary(results, 0.5)
    assert.match(output, /TOTAL \(partial\)/)
    assert.match(output, /known results only/)
    assert.match(output, /E2E: No report/)
    assert.equal(summarize(results).totals.total, 2)
    assert.equal(summarize(results).success, false)
  })

  it('continues to later suites after failure and retains the failed exit result', async t => {
    const directory = await temporaryDirectory(t)
    const completed = []
    const suites = ['first', 'second'].map(id => ({ id, label: id, kind: 'node',
      command: reportFile => ({ id, reportFile }) }))
    const results = await runSuites(suites, directory, {
      log() {}, async execute({ id, reportFile }) {
        completed.push(id)
        await writeFile(reportFile, JSON.stringify(id === 'first' ? nodeReport(1, 1) : nodeReport()))
        return { exitCode: id === 'first' ? 1 : 0 }
      },
    })
    assert.deepEqual(completed, ['first', 'second'])
    assert.equal(suiteStatus(results[0]), 'FAILED')
    assert.equal(suiteStatus(results[1]), 'PASSED')
    assert.equal(summarize(results).success, false)
  })

  it('does not reuse an old report when a new runner produces no result', async t => {
    const directory = await temporaryDirectory(t)
    await writeFile(join(directory, 'e2e.json'), JSON.stringify(nodeReport(999)))
    const fresh = join(directory, 'fresh')
    await mkdir(fresh)
    const results = await runSuites([{ id: 'e2e', label: 'E2E', kind: 'node', command: () => ({}) }], fresh, {
      log() {}, execute: async () => ({ exitCode: 1 }),
    })
    assert.equal(results[0].counts, null)
    assert.match(results[0].error, /No result report/)
    assert.equal(summarize(results).totals.passed, 0)
    assert.equal(summarize(results).incomplete, true)
  })

  it('does not start remaining suites after interruption', async t => {
    const directory = await temporaryDirectory(t)
    const results = await runSuites([{ id: 'e2e', label: 'E2E' }], directory, {
      log() {}, shouldStop: () => true, execute: () => assert.fail('Must not start another child process'),
    })
    assert.match(results[0].error, /interrupted/)
    assert.equal(summarize(results).success, false)
  })

  it('reads only the real Node run summary, without double-counting files or suites', async t => {
    const directory = await temporaryDirectory(t)
    const fixture = join(directory, 'outcomes.test.mjs'), reportFile = join(directory, 'node.json')
    await writeFile(fixture, `import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
describe('Fixture', () => {
  it('passes', () => {})
  it('fails', () => assert.fail('Intentional reporter fixture'))
  it.skip('skipped', () => {})
  it.todo('todo')
})`)
    const reporter = fileURLToPath(new URL('../../scripts/node-summary-reporter.mjs', import.meta.url))
    const env = { ...process.env }
    delete env.NODE_TEST_CONTEXT
    const child = spawnSync(process.execPath, ['--test', `--test-reporter=${reporter}`,
      `--test-reporter-destination=${reportFile}`, fixture], { env, encoding: 'utf8', timeout: 10000 })
    assert.ifError(child.error)
    assert.equal(child.status, 1)
    const report = JSON.parse(await readFile(reportFile, 'utf8'))
    const counts = normalizeReport('node', report)
    assert.deepEqual({ total: counts.total, passed: counts.passed, failed: counts.failed, skipped: counts.skipped, todo: counts.todo },
      { total: 4, passed: 1, failed: 1, skipped: 1, todo: 1 })
    assert.equal(counts.success, false)
  })
})
