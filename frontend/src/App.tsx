import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { DemoPanel } from '@/components/DemoPanel'
import { PhoneFrame } from '@/components/PhoneFrame'
import { SessionProvider } from '@/components/SessionProvider'
import { DetectiveScreen } from '@/screens/DetectiveScreen'
import { ExperimentScreen } from '@/screens/ExperimentScreen'

export default function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <PhoneFrame aside={<DemoPanel />}>
          <Routes>
            {/* M3 adds onboarding, check-in and the Today (coach) screen at "/" */}
            <Route path="/" element={<Navigate to="/detective" replace />} />
            <Route path="/detective" element={<DetectiveScreen />} />
            <Route path="/experiment" element={<ExperimentScreen />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </PhoneFrame>
      </SessionProvider>
    </BrowserRouter>
  )
}
