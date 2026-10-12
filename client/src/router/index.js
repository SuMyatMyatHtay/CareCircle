import { createRouter, createWebHistory } from 'vue-router'
import AppLayout from '../components/layout/AppLayout.vue'
import LoginView from '../features/auth/views/LoginView.vue'
import SignupView from '../features/auth/views/SignupView.vue'
import JoinFamilyView from '../features/auth/views/JoinFamilyView.vue'
import CreateFamilyView from '../features/family/views/CreateFamilyView.vue'
import EmptyFamilyHomeView from '../features/family/views/EmptyFamilyHomeView.vue'

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
      { path: 'family', redirect: '/home' } // old links still point here

      // Planned pages, by package:
      // B  { path: 'family/settings', component: FamilySettingsView },
      // C  { path: 'recipients/:recipientId', component: RecipientHubView },
      // D  { path: 'open-tasks', component: OpenTasksView },
      // D  { path: 'recipients/:recipientId/tasks', component: RecipientTasksView },
      // D  { path: 'recipients/:recipientId/tasks/:taskId', component: TaskDetailView },
      // E  { path: 'my-tasks', component: MyTasksView },
      // E  { path: 'recipients/:recipientId/tasks/:taskId/transit', component: TransitModeView },
      // F  { path: 'recipients/:recipientId/log', component: RecipientLogView },
      // F  { path: 'calendar', component: CalendarView },
    ]
  },

  // Unknown URLs go home (or to login, via the guard below)
  { path: '/:pathMatch(.*)*', redirect: '/home' }
]

const router = createRouter({ history: createWebHistory(), routes })

// Send logged-out users to the login page
router.beforeEach((to) => {
  const needsLogin = to.matched.some((record) => record.meta.requiresAuth)
  if (needsLogin && !sessionStorage.getItem('token')) {
    return { path: '/login' }
  }
})

export default router