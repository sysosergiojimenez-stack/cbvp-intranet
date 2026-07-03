import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { AuthProvider } from '@/context/AuthContext'
import './index.css'
import { TRPCProvider } from "@/providers/trpc"
import ErrorBoundary from "@/components/ErrorBoundary"
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <TRPCProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </TRPCProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
