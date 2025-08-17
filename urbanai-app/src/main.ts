import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'

const app = createApp(App)

// Global error handler to catch unhandled errors
app.config.errorHandler = (err, instance, info) => {
  console.error('🔥 Vue Error:', err)
  console.error('🔍 Component instance:', instance)
  console.error('📍 Error info:', info)
  
  // Prevent the error from propagating further
  return false
}

// Global warning handler
app.config.warnHandler = (msg, instance, trace) => {
  console.warn('⚠️ Vue Warning:', msg)
  console.warn('🔍 Component instance:', instance)
  console.warn('📍 Trace:', trace)
}

app.use(router).mount('#app')
