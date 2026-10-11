import { createRouter, createWebHistory } from 'vue-router'
import FamilyHomeView from '../features/family/views/FamilyHomeView.vue'
import FamilySettingsView from '../features/settings/views/FamilySettingsView.vue'
import JoinFamilyView from '../features/auth/views/JoinFamilyView.vue'
import LoginView from '../features/auth/views/LoginView.vue'
import SignupView from '../features/auth/views/SignupView.vue'
import MyTasksView from '../features/my-tasks/views/MyTasksView.vue'
import OpenTasksView from '../features/tasks/views/OpenTasksView.vue'
import RecipientHubView from '../features/recipients/views/RecipientHubView.vue'
import RecipientLogView from '../features/logs/views/RecipientLogView.vue'
import RecipientOverviewView from '../features/overview/views/RecipientOverviewView.vue'
import RecipientProfileView from '../features/recipients/views/RecipientProfileView.vue'
import RecipientTasksView from '../features/tasks/views/RecipientTasksView.vue'
import TaskDetailView from '../features/tasks/views/TaskDetailView.vue'
import TransitModeView from '../features/transit/views/TransitModeView.vue'
import EmptyFamilyHomeView from '../features/family/views/EmptyFamilyHomeView.vue'
import CreateFamilyView from '../features/family/views/CreateFamilyView.vue'

const routes = [
  { path: '/', component: FamilyHomeView },
  { path: '/login', component: LoginView },
  { path: '/signup', component: SignupView },
  { path: '/', component: FamilyHomeView },
  { path: '/family', component: FamilyHomeView },
  { path: '/join-family', component: JoinFamilyView },
  { path: '/family', component: FamilyHomeView },
  { path: '/home', name: 'home', component: EmptyFamilyHomeView },
{ path: '/create-family', name: 'create-family', component: CreateFamilyView },
  { path: '/my-tasks', component: MyTasksView },
  { path: '/open-tasks', component: OpenTasksView },
  { path: '/family/settings', component: FamilySettingsView },
  { path: '/recipients/:recipientId', component: RecipientHubView },
  { path: '/recipients/:recipientId/overview', component: RecipientOverviewView },
  { path: '/recipients/:recipientId/tasks', component: RecipientTasksView },
  { path: '/recipients/:recipientId/log', component: RecipientLogView },
  { path: '/recipients/:recipientId/profile', component: RecipientProfileView },
  { path: '/recipients/:recipientId/tasks/:taskId', component: TaskDetailView },
  { path: '/recipients/:recipientId/tasks/:taskId/transit', component: TransitModeView }
]

export default createRouter({ history: createWebHistory(), routes })
