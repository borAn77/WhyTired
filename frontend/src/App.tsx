import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { DemoPanel } from '@/components/DemoPanel'
import { PhoneFrame } from '@/components/PhoneFrame'
import { SessionProvider } from '@/components/SessionProvider'
import { CheckInScreen } from '@/screens/CheckInScreen'
import { DetectiveScreen } from '@/screens/DetectiveScreen'
import { ExperimentScreen } from '@/screens/ExperimentScreen'
import { OnboardingScreen } from '@/screens/OnboardingScreen'
import { TodayScreen } from '@/screens/TodayScreen'

export default function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <PhoneFrame aside={<DemoPanel />}>
          <Routes>
            <Route path="/" element={<TodayScreen />} />
            <Route path="/onboarding" element={<OnboardingScreen />} />
            <Route path="/check-in" element={<CheckInScreen />} />
            <Route path="/detective" element={<DetectiveScreen />} />
            <Route path="/experiment" element={<ExperimentScreen />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </PhoneFrame>
      </SessionProvider>
    </BrowserRouter>
  )
}
