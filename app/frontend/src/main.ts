import './styles/main.css';
import { createApp } from 'vue';
import App from './App.vue';
import { createI18n } from './composables/useI18n';

const app = createApp(App);
app.use(createI18n('en'));
app.mount('#app');
