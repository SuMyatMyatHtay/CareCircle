import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useFamilyWorkspace } from '../../family/composables/useFamilyWorkspace.js'
import { useActiveFamily } from '../../../composables/useActiveFamily.js'
import { clearUserSession } from '../../auth/services/authApi.js'
import { http } from '../../../services/http.js'
import { apiError, authConfig } from '../../family/services/dashboardApi.js'

export function useSettingsAccountActions() {
  const { isPreview } = useFamilyWorkspace()
  const { clearFamilies } = useActiveFamily()
  const router = useRouter()
  const loggingOut = ref(false),
    logoutError = ref('')
  async function logOut() {
    if (loggingOut.value) return
    loggingOut.value = true
    logoutError.value = ''
    try {
      if (!isPreview) {
        const token = sessionStorage.getItem('token')
        if (token) {
          try {
            await http.post('/auth/logout', {}, authConfig())
          } catch (error) {
            if (error.response?.status !== 401) throw error
          }
          // A late reply for the previous account must not clear a newer login.
          const currentToken = sessionStorage.getItem('token')
          if (currentToken && currentToken !== token) return
        }
        clearUserSession()
        clearFamilies()
      }
      // The isolated sample preview must never revoke a real account's session.
      await router.replace('/login')
    } catch (error) {
      logoutError.value = apiError(error, 'Logging out')
    } finally {
      loggingOut.value = false
    }
  }
  return { loggingOut, logoutError, logOut }
}
