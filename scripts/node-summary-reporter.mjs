// Node emits a summary per file and one for the entire run. Only the latter
// belongs in the aggregate; counting both would double-count every test.
export default async function* report(source) {
  for await (const event of source) {
    if (event.type === 'test:summary' && !event.data.file) {
      yield `${JSON.stringify(event.data)}\n`
    }
  }
}
