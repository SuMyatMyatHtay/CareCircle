import axios from 'axios'
// Shared HTTP client. Vite proxies /api to Express in development.
export const http = axios.create({ baseURL: '/api' })
