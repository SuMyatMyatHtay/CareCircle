// Owner: Chaithra (E)
// true on phone-sized screens, so pages can switch to the Figma "Mobile prototype" layout.
//   const isMobile = useIsMobile()
import { ref, onMounted, onUnmounted } from 'vue'

const QUERY = '(max-width: 767px)'

export function useIsMobile() {
    const media = window.matchMedia(QUERY)
    const isMobile = ref(media.matches)
    const update = (event) => { isMobile.value = event.matches }

    onMounted(() => media.addEventListener('change', update))
    onUnmounted(() => media.removeEventListener('change', update))
    return isMobile
}
