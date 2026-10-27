// One underline that slides to the active tab instead of jumping between tabs.
// The tab bar needs position: relative; the active tab needs the class `active`.
//
//   const tabBar = ref(null)
//   const indicator = useTabIndicator(tabBar, () => activeTab.value)
//   <div ref="tabBar" class="tabs">
//     ...tabs...
//     <span class="care-tab-indicator" :class="{ 'is-ready': indicator.ready }"
//         :style="indicator.style" aria-hidden="true"></span>
//   </div>
import { reactive, watch, nextTick, onUnmounted } from 'vue'

export function useTabIndicator(tabBar, activeKey) {
  const indicator = reactive({ style: { width: '0px', opacity: 0 }, ready: false })
  let observer = null

  function measure() {
    const active = tabBar.value?.querySelector('.active')
    if (!active) {
      indicator.style = { ...indicator.style, opacity: 0 }
      return
    }
    indicator.style = {
      width: `${active.offsetWidth}px`,
      transform: `translateX(${active.offsetLeft}px)`,
      opacity: 1,
    }
  }

  function stopWatchingSize() {
    observer?.disconnect()
    observer = null
    window.removeEventListener('resize', measure)
  }

  // The tab bar can come and go (e.g. My tasks swaps to its phone layout), so follow the ref
  watch(
    tabBar,
    (bar) => {
      stopWatchingSize()
      indicator.ready = false
      if (!bar) return
      measure()
      // Slide only after the first position is set, so it doesn't fly in from the left
      requestAnimationFrame(() => {
        indicator.ready = true
      })
      // Tab widths change on resize and when the web font loads
      if (typeof ResizeObserver === 'undefined') {
        window.addEventListener('resize', measure)
        return
      }
      observer = new ResizeObserver(measure)
      observer.observe(bar)
      for (const tab of bar.children) {
        if (!tab.classList.contains('care-tab-indicator')) observer.observe(tab)
      }
    },
    { flush: 'post', immediate: true },
  )

  // The active tab turns bold, so measure after it re-renders
  watch(activeKey, () => nextTick(measure))

  onUnmounted(stopWatchingSize)

  return indicator
}
