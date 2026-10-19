import { createApp } from 'vue'
import { VueQueryPlugin } from '@tanstack/vue-query'
import App from './App.vue'
import router from './router/index.js'
import { queryClient } from './services/queryClient.js'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import './styles/global.css'
createApp(App).use(router).use(VueQueryPlugin, { queryClient }).mount('#app')
