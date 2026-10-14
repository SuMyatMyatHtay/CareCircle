import { createRouter, createWebHistory } from 'vue-router'
import AppLayout from '../components/layout/AppLayout.vue'
import LoginView from '../features/auth/views/LoginView.vue'
import SignupView from '../features/auth/views/SignupView.vue'
import JoinFamilyView from '../features/auth/views/JoinFamilyView.vue'
import CreateFamilyView from '../features/family/views/CreateFamilyView.vue'
import FamilyHomeView from '../features/family/views/FamilyHomeView.vue'
import FamilySettingsView from '../features/settings/views/FamilySettingsView.vue'
import ProfileView from '../features/auth/views/ProfileView.vue'
import PetDressupView from '../features/auth/views/PetDressupView.vue'
import AvatarStudioView from '../features/avatar/views/AvatarStudioView.vue'
import { verifySession, clearUserSession } from '../features/auth/services/authApi.js'
const routes = [
  {path:'/login',component:LoginView},
  {path:'/signup',component:SignupView},
  {path:'/create-family',name:'create-family',component:CreateFamilyView,meta:{requiresAuth:true}},
  {path:'/join-family',component:JoinFamilyView,meta:{requiresAuth:true}},
  {path:'/',component:AppLayout,meta:{requiresAuth:true},children:[
    {path:'',redirect:'/home'},
    {path:'home',name:'home',component:FamilyHomeView},
    {path:'settings',name:'family-settings',component:FamilySettingsView},
    {path:'family/settings',redirect:'/settings'},
    {path:'family',redirect:'/home'},
    {path:'profile',name:'profile',component:ProfileView},
    {path:'dress-up',name:'dress-up',component:PetDressupView},
    {path:'avatar-studio',name:'avatar-studio',component:AvatarStudioView}
  ]},
  // Explicit fictional-data preview, independent from real authentication/families.
  {path:'/preview',component:AppLayout,meta:{preview:true},children:[
    {path:'',redirect:'/preview/home'},
    {path:'home',name:'preview-home',component:FamilyHomeView},
    {path:'settings',name:'preview-settings',component:FamilySettingsView}
  ]},
  {path:'/:pathMatch(.*)*',redirect:'/home'}
]
const router=createRouter({history:createWebHistory(),routes})
router.beforeEach(async to=>{
  if (to.meta.preview) return true
  const token=sessionStorage.getItem('token')
  const protectedRoute=to.matched.some(record=>record.meta.requiresAuth)
  const authPage=to.path==='/login'||to.path==='/signup'
  if (!token) return protectedRoute ? {path:'/login'} : true
  const result=await verifySession()
  if(result.status==='invalid') {
    clearUserSession()
    return protectedRoute ? {path:'/login'} : true
  }
  if(result.status==='unavailable') return protectedRoute ? {path:'/login',query:{serviceUnavailable:'1'}} : true
  if(authPage) return {path:'/home'}
  return true
})
export default router
