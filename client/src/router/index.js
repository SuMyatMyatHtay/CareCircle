import { createRouter, createWebHistory } from 'vue-router'
import AppLayout from '../components/layout/AppLayout.vue'
import LoginView from '../features/auth/views/LoginView.vue'
import SignupView from '../features/auth/views/SignupView.vue'
import JoinFamilyView from '../features/auth/views/JoinFamilyView.vue'
import CreateFamilyView from '../features/family/views/CreateFamilyView.vue'
import EmptyFamilyHomeView from '../features/family/views/EmptyFamilyHomeView.vue'
import ProfileView from '../features/auth/views/ProfileView.vue'
import PetDressupView from '../features/auth/views/PetDressupView.vue'
import { verifySession, clearUserSession } from '../features/auth/services/authApi.js'
import MyTasksView from '../features/my-tasks/views/MyTasksView.vue'
import TransitView from '../features/transit/views/TransitView.vue'
import TaskDetailView from '../features/transit/views/TaskDetailView.vue'

const routes = [
  // ---- Pages without the app frame ----
  { path: '/login', component: LoginView },
  { path: '/signup', component: SignupView },
  { path: '/create-family', name: 'create-family', component: CreateFamilyView, meta: { requiresAuth: true } },
  { path: '/join-family', component: JoinFamilyView, meta: { requiresAuth: true } },


  // ---- Every logged-in page: sidebar layout ----
  // Add each page here as it is rebuilt from the wireframe, and point its
  // sidebar link (FamilySidebar.vue) at it at the same time.
  {
    path: '/',
    component: AppLayout,
    meta: { requiresAuth: true }, // applies to every child below
    children: [
      { path: '', redirect: '/home' },
      { path: 'home', name: 'home', component: EmptyFamilyHomeView },
      { path: 'family', redirect: '/home' }, // old links still point here
      { path: 'profile', name: 'profile', component: ProfileView },
      { path: 'dress-up', name: 'dress-up', component: PetDressupView },
      {path:'my-tasks',name:'my-tasks',component:MyTasksView},
      {path:'transit/:familyId/:taskId',name:'transit',component:TransitView,props:true},
      {path:'families/:familyId/tasks/:taskId',name:'task-detail',component:TaskDetailView,props:true}
  
      // Planned pages, by package:
      // B  { path: 'family/settings', component: FamilySettingsView },
      // C  { path: 'recipients/:recipientId', component: RecipientHubView },
      // D  { path: 'open-tasks', component: OpenTasksView },
      // D  { path: 'recipients/:recipientId/tasks', component: RecipientTasksView },
      // D  { path: 'recipients/:recipientId/tasks/:taskId', component: TaskDetailView },
      // F  { path: 'recipients/:recipientId/log', component: RecipientLogView },
      // F  { path: 'calendar', component: CalendarView },
    ]
  },

  // Unknown URLs go home (or to login, via the guard below)
  { path: '/:pathMatch(.*)*', redirect: '/home' }
]

const router = createRouter({ history: createWebHistory(), routes })

// Send logged-out users to the login page


router.beforeEach(async (to) => {
  const token = sessionStorage.getItem('token')

  const needsLogin = to.matched.some(
    record => record.meta.requiresAuth
  )

  const isAuthPage =
    to.path === '/login' ||
    to.path === '/signup'

  // 1. No token
  if (!token) {
    if (needsLogin) {
      return { path: '/login' }
    }

    return true
  }

  // 2. Verify the token with backend
  const result = await verifySession()

  // 3. Expired or revoked token
  if (result.status === 'invalid') {
    clearUserSession()

    if (needsLogin) {
      return { path: '/login' }
    }

    return true
  }

  // 4. Backend unavailable
  if (result.status === 'unavailable') {
    // Don't treat server errors as invalid credentials.
    // Block protected pages until verification succeeds.
    if (needsLogin) {
      return { path: '/login', query: { serviceUnavailable: '1' } }
    }

    return true
  }

  // 5. Valid token: don't allow login/signup
  if (isAuthPage) {
    return { path: '/home' }
  }

  // 6. Valid token: continue
  return true
})



export default router