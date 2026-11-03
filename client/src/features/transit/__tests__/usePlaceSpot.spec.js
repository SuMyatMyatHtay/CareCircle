// Owner: Chaithra (E) · unit test: finding where to pin a place on the map
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { flushPromises } from '@vue/test-utils'

vi.mock('../services/transitApi.js', () => ({ searchClinics: vi.fn() }))
import { searchClinics } from '../services/transitApi.js'
import { usePlaceSpot } from '../utils/usePlaceSpot.js'

beforeEach(() => searchClinics.mockReset())

describe('TestSuite: usePlaceSpot', () => {
    it('Test1: uses the saved coordinates without searching', () => {
        const spot = usePlaceSpot(() => ({ name: 'TTSH', lat: 1.3214, lng: 103.8458 }))
        expect(spot.value).toEqual({ lat: 1.3214, lng: 103.8458 })
        expect(searchClinics).not.toHaveBeenCalled()
    })

    it('Test2: looks up a typed-in place by postal code', async () => {
        searchClinics.mockResolvedValue({ clinics: [], otherPlaces: [{ name: 'Junction 8', lat: 1.3501, lng: 103.8486 }] })
        const place = { name: 'FairPrice, Junction 8', postal: '579837' }
        const spot = usePlaceSpot(() => place)
        await flushPromises()
        expect(searchClinics).toHaveBeenCalledWith('579837')
        expect(spot.value).toEqual({ lat: 1.3501, lng: 103.8486 })
    })

    it('Test3: stays empty when the search finds nothing', async () => {
        searchClinics.mockResolvedValue({ clinics: [], otherPlaces: [] })
        const place = { name: 'Somewhere' }
        const spot = usePlaceSpot(() => place)
        await flushPromises()
        expect(spot.value).toBeNull()
    })

    it('Test4: does nothing for a task with no place', async () => {
        const spot = usePlaceSpot(() => null)
        await nextTick()
        expect(spot.value).toBeNull()
        expect(searchClinics).not.toHaveBeenCalled()
    })
})
