const countKeys = ['passed', 'failed', 'skipped', 'todo', 'cancelled', 'flaky']
const count = value => {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid test count in report')
  return value
}

export function normalizeReport(kind, report) {
  let result
  if (kind === 'node') {
    const c = report.counts
    result = { total: count(c.tests), passed: count(c.passed), failed: count(c.failed),
      skipped: count(c.skipped), todo: count(c.todo), cancelled: count(c.cancelled), flaky: 0,
      success: report.success === true }
  } else if (kind === 'vitest') {
    const total = count(report.numTotalTests), passed = count(report.numPassedTests)
    const failed = count(report.numFailedTests), todo = count(report.numTodoTests)
    // Vitest versions can include todo in numPendingTests. Subtract from the
    // total so todo/skip remain disjoint and never inflate the final count.
    result = { total, passed, failed, todo, skipped: count(total - passed - failed - todo),
      cancelled: 0, flaky: 0, success: report.success === true }
  } else if (kind === 'playwright') {
    const s = report.stats
    const passed = count(s.expected), failed = count(s.unexpected)
    const skipped = count(s.skipped), flaky = count(s.flaky)
    result = { total: passed + failed + skipped + flaky, passed, failed, skipped, flaky,
      todo: 0, cancelled: 0, success: failed === 0 && (report.errors?.length ?? 0) === 0 }
  } else throw new Error(`Unknown test report format: ${kind}`)
  if (countKeys.reduce((sum, key) => sum + result[key], 0) !== result.total) {
    throw new Error('Test report totals do not match its outcomes')
  }
  if (!result.total) result.success = false
  return result
}

export function suiteStatus(result) {
  if (!result.counts || result.error || result.signal) return 'ERROR'
  if (result.counts.failed || result.counts.cancelled) return 'FAILED'
  if (result.exitCode !== 0 || !result.counts.success) return 'ERROR'
  if (result.counts.flaky) return 'FLAKY'
  return 'PASSED'
}

export function summarize(results) {
  const totals = Object.fromEntries(['total', ...countKeys].map(key => [key, 0]))
  for (const result of results) {
    if (result.counts) for (const key of Object.keys(totals)) totals[key] += result.counts[key]
  }
  return { totals, success: results.length > 0 && results.every(r => ['PASSED', 'FLAKY'].includes(suiteStatus(r))),
    incomplete: results.some(r => !r.counts) }
}

export function formatSummary(results, durationSeconds) {
  const { totals, success, incomplete } = summarize(results)
  const columns = [
    ['Suite', 'label'], ['Passed', 'passed'], ['Failed', 'failed'], ['Skipped', 'skipped'],
    ...['todo', 'cancelled', 'flaky'].filter(key => totals[key] > 0).map(key => [key[0].toUpperCase() + key.slice(1), key]),
    ['Total', 'total'], ['Status', 'status'],
  ]
  const rows = results.map(result => ({ label: result.label, ...result.counts, status: suiteStatus(result) }))
  rows.push({ label: incomplete ? 'TOTAL (partial)' : 'TOTAL', ...totals, status: success ? 'PASSED' : 'FAILED' })
  const widths = columns.map(([label, key]) => Math.max(label.length, ...rows.map(row => String(row[key] ?? '-').length)))
  const line = values => values.map((value, index) => index === 0 || index === columns.length - 1
    ? String(value).padEnd(widths[index]) : String(value).padStart(widths[index])).join(' | ')
  const separator = widths.map(width => '-'.repeat(width)).join('-+-')
  const outcomes = countKeys.filter(key => totals[key]).map(key => `${totals[key]} ${key}`)
  const lines = ['\nCareCircle Test Summary', line(columns.map(([label]) => label)), separator,
    ...rows.map(row => line(columns.map(([, key]) => row[key] ?? '-'))), '',
    success && totals.total === totals.passed ? `${totals.passed} checks passed.`
      : `${success ? 'Completed' : 'Run failed'}: ${outcomes.join(', ') || 'no test results'}.`,
    `Duration: ${durationSeconds.toFixed(1)}s`]
  if (incomplete) lines.push('Some suites have no valid report; the total includes known results only.')
  for (const result of results) {
    if (result.error) lines.push(`${result.label}: ${result.error}`)
    else if (suiteStatus(result) === 'ERROR') lines.push(`${result.label}: runner error (exit ${result.exitCode ?? result.signal ?? 'unknown'}).`)
  }
  return lines.join('\n')
}
