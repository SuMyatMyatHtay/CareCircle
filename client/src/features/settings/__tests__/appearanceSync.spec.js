import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../auth/services/authApi.js', () => ({
    updateMyAppearance: vi.fn(() => Promise.resolve({}))
}))

const { updateMyAppearance } = await import('../../auth/services/authApi.js')
const { applyAccountAppearance, useAppearance } = await import('../composables/useAppearance.js')

// useAppearance reads the device setting; jsdom has no matchMedia
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} })

describe('theme saved with the account', () => {
    beforeEach(() => {
        localStorage.clear()
        sessionStorage.clear()
        updateMyAppearance.mockClear()
    })

    it("uses the account's theme when the user signs in", () => {
        const { appearance } = useAppearance()
        applyAccountAppearance({ id: 'user-1', appearance: 'dark' })
        expect(appearance.value).toBe('dark')
        expect(localStorage.getItem('carecircle:appearance')).toBe('dark')
        expect(updateMyAppearance).not.toHaveBeenCalled()
    })

    it("applies it once per sign-in, so a late reply can't undo a change made just now", () => {
        sessionStorage.setItem('token', 'test-only')
        const { appearance, setAppearance } = useAppearance()
        applyAccountAppearance({ id: 'user-2', appearance: 'dark' })
        setAppearance('light')
        applyAccountAppearance({ id: 'user-2', appearance: 'dark' })
        expect(appearance.value).toBe('light')
        expect(updateMyAppearance).toHaveBeenCalledWith('light')
    })

    it("uploads this browser's choice when the account has none yet", () => {
        sessionStorage.setItem('token', 'test-only')
        localStorage.setItem('carecircle:appearance', 'system')
        useAppearance().setAppearance('system')
        updateMyAppearance.mockClear()
        applyAccountAppearance({ id: 'user-3', appearance: null })
        expect(updateMyAppearance).toHaveBeenCalledWith('system')
    })

    it('stays on the device when nobody is signed in (preview)', () => {
        useAppearance().setAppearance('dark')
        expect(localStorage.getItem('carecircle:appearance')).toBe('dark')
        expect(updateMyAppearance).not.toHaveBeenCalled()
    })
})
