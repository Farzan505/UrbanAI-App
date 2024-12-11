import { createApp } from 'vue'
import './assets/index.css'
import App from './App.vue'
import router from './router'
import { colorMode } from './composables/useTheme'

// Initialize color mode
if (!colorMode.value) {
  colorMode.value = 'dark'
}

const app = createApp(App)
app.use(router)
app.mount('#app')
