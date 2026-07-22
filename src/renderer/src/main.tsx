import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { isToastMode } from './lib/mode'
import './styles/index.css'

if (isToastMode) document.body.classList.add('toast-mode')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
