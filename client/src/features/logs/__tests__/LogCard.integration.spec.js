import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import LogCard from '../components/LogCard.vue'
import { translateLog } from '../services/logsApi.js'
import { http } from '../../../services/http.js'

const log = { _id: 'note-one', content: 'Continue the care plan.', originalLang: 'en', type: 'general',
  author: { name: 'Alex Tan' }, translations: {}, createdAt: '2026-10-26T02:00:00Z' }
const button = (wrapper, text) => wrapper.findAll('button').find(node => node.text().trim() === text)
async function chooseChinese(wrapper) {
  await button(wrapper, 'Translate').trigger('click')
  await wrapper.get('[role="menuitem"] [lang="zh"]').trigger('click')
  await flushPromises()
}
function render() {
  sessionStorage.setItem('token', 'translation-test-only')
  return mount(LogCard, { props: { log: { ...log }, translate: (note, lang) => translateLog('family-one', note._id, lang) } })
}

describe('Care log translation across the card and API adapter', () => {
  it('renders the server translation contract and reuses it when shown again', async () => {
    const post = vi.spyOn(http, 'post').mockResolvedValue({ data: { lang: 'zh', translation: '继续护理计划。', cached: false } })
    const wrapper = render()
    await chooseChinese(wrapper)
    expect(wrapper.text()).toContain('继续护理计划。')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(post).toHaveBeenCalledWith('/families/family-one/logs/note-one/translate', { lang: 'zh' },
      { headers: { Authorization: 'Bearer translation-test-only' } })
    await button(wrapper, 'Showing 中文').trigger('click')
    await chooseChinese(wrapper)
    expect(wrapper.text()).toContain('继续护理计划。')
    expect(post).toHaveBeenCalledTimes(1)
  })

  it('does not attach a late translation of an old note to its edited content', async () => {
    let finish
    vi.spyOn(http, 'post').mockReturnValue(new Promise(resolve => { finish = resolve }))
    const wrapper = render()
    await chooseChinese(wrapper)
    expect(wrapper.text()).toContain('Translating...')
    await wrapper.setProps({ log: { ...log, content: 'The care plan has changed.' } })
    finish({ data: { lang: 'zh', translation: '继续护理计划。', cached: false } })
    await flushPromises()
    expect(wrapper.text()).toContain('The care plan has changed.')
    expect(wrapper.text()).not.toContain('继续护理计划。')
    expect(button(wrapper, 'Translate').element.disabled).toBe(false)
  })

  it('shows a retryable error for malformed replies rather than a fake translation', async () => {
    vi.spyOn(http, 'post').mockResolvedValueOnce({ data: { lang: 'zh' } })
      .mockResolvedValueOnce({ data: { lang: 'zh', translation: '正确的翻译。', cached: false } })
    const wrapper = render()
    await chooseChinese(wrapper)
    expect(wrapper.get('[role="alert"]').text()).toContain("Translation isn't connected yet.")
    await chooseChinese(wrapper)
    expect(wrapper.text()).toContain('正确的翻译。')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })
})
