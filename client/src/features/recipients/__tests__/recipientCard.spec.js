import { describe, it, expect, vi } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'

vi.mock('../../../compospec.knents/common/CareAvatar.vue', async () => {
    const { h } = await import('vue')
    return { default: { name: 'CareAvatar', props: ['person', 'size'], render() { return h('span') } } }
})

import RecipientCard from '../components/RecipientCard.vue'

const recipient = {
    _id: 'r1', name: 'Tan Ah Kow', nickname: 'Grandpa', careType: 'elderly', mobility: { level: 'assisted' }
}
const mountCard = (props = {}) =>
    mount(RecipientCard, { props: { recipient, ...props }, global: { stubs: { RouterLink: RouterLinkStub } } })

describe('TestSuite: RecipientCard', () => {
    it('Test1: shows the nickname (or full name) with the care type and mobility', () => {
        const wrapper = mountCard()
        expect(wrapper.find('h3').text()).toBe('Grandpa')
        expect(wrapper.find('p').text()).toContain('Elderly care')
        expect(wrapper.find('p').text()).toContain('Assisted mobility')

        const plain = mountCard({ recipient: { ...recipient, nickname: '', mobility: undefined } })
        expect(plain.find('h3').text()).toBe('Tan Ah Kow')
        expect(plain.find('p').text()).toBe('Elderly care')
    })

    it('Test2: the "needs someone" pill is hidden at 0 and worded for 1 and for several', () => {
        expect(mountCard().text()).not.toMatch(/need/)
        expect(mountCard({ needsSomeone: 1 }).text()).toMatch(/1 needs someone/)
        expect(mountCard({ needsSomeone: 3 }).text()).toMatch(/3 need someone/)
    })

    it('Test3: "Open hub" links to this recipient\'s overview', () => {
        const link = mountCard().findComponent(RouterLinkStub)
        expect(link.props('to')).toEqual({ name: 'recipient-overview', params: { recipientId: 'r1' } })
    })
}) 