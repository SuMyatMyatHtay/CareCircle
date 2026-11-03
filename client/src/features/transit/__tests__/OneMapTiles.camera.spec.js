// Owner: Chaithra (E) · component test: the live map's camera stays still
// Before: every location update re-fitted the map, so it kept zooming in and out.
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import OneMapTiles from '../components/OneMapTiles.vue'

const TTSH = { lat: 1.3214, lng: 103.8458 }
const props = (live) => ({
    lat: TTSH.lat, lng: TTSH.lng,
    liveLat: live.lat, liveLng: live.lng, liveLabel: 'Alex',
    height: 440, fitWidth: 320
})
// The zoom level and the top-left tile, read from the map pictures' addresses (.../z/x/y.png)
function camera(wrapper) {
    const src = wrapper.find('.tiles img').attributes('src').split('/')
    return { z: src.at(-3), x: src.at(-2), y: src.at(-1) }
}
const button = (wrapper, label) => wrapper.findAll('button').find((b) => b.attributes('aria-label')?.startsWith(label))

describe('TestSuite: OneMapTiles camera', () => {
    it('Test1: walking 1 km to the clinic keeps the same zoom (no zooming in as they get close)', async () => {
        const wrapper = mount(OneMapTiles, { props: props({ lat: 1.3300, lng: 103.8458 }) }) // ~1 km away
        const first = camera(wrapper)
        for (let lat = 1.3290; lat >= 1.3216; lat -= 0.0008) { // walking towards TTSH, ~90 m a step
            await wrapper.setProps({ liveLat: lat })
            expect(camera(wrapper).z).toBe(first.z)
        }
    })

    it('Test2: when the person walks off the edge, the map slides along at the same zoom', async () => {
        const wrapper = mount(OneMapTiles, { props: props({ lat: 1.3220, lng: 103.8458 }) })
        const first = camera(wrapper)
        await wrapper.setProps({ liveLat: 1.3600, liveLng: 103.8800 }) // far off the card
        const after = camera(wrapper)
        expect(after.z).toBe(first.z)
        expect(after).not.toEqual(first)
    })

    it('Test3: after you zoom, live updates never move the map; Recentre fits again', async () => {
        const wrapper = mount(OneMapTiles, { props: props({ lat: 1.3220, lng: 103.8458 }) })
        const fitted = camera(wrapper)
        await button(wrapper, 'Zoom out').trigger('click')
        const zoomed = camera(wrapper)
        expect(Number(zoomed.z)).toBe(Number(fitted.z) - 1)
        await wrapper.setProps({ liveLat: 1.3600, liveLng: 103.8800 })
        expect(camera(wrapper)).toEqual(zoomed)
        await button(wrapper, 'Recentre').trigger('click')
        expect(camera(wrapper).z).not.toBe(zoomed.z)
    })

    it('Test4: the same place sent again by a refresh keeps your zoom', async () => {
        const wrapper = mount(OneMapTiles, { props: props({ lat: 1.3220, lng: 103.8458 }) })
        await button(wrapper, 'Zoom out').trigger('click')
        const zoomed = camera(wrapper)
        await wrapper.setProps({ lat: null, lng: null })          // blinks away for a moment
        await wrapper.setProps({ lat: TTSH.lat, lng: TTSH.lng })  // and back
        expect(camera(wrapper)).toEqual(zoomed)
    })

    it('Test5: the place pin going missing for a moment never re-zooms the map', async () => {
        // Seen on the live site: the pin blinked away on each refresh and the map jumped
        // from the whole route to street level and back
        const wrapper = mount(OneMapTiles, { props: props({ lat: 1.4290, lng: 103.8350 }) }) // Yishun -> TTSH
        const fitted = camera(wrapper)
        await wrapper.setProps({ lat: null, lng: null })
        expect(camera(wrapper).z).toBe(fitted.z)
        await wrapper.setProps({ lat: TTSH.lat, lng: TTSH.lng })
        expect(camera(wrapper)).toEqual(fitted)
    })
})
