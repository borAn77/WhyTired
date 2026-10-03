import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { DemoPanel } from '@/components/DemoPanel'
import { PhoneFrame } from '@/components/PhoneFrame'
import { SceneProvider } from '@/components/SceneProvider'
import { SessionProvider } from '@/components/SessionProvider'
import { CheckInScreen } from '@/screens/CheckInScreen'
import { DetectiveScreen } from '@/screens/DetectiveScreen'
import { ExperimentScreen } from '@/screens/ExperimentScreen'
import { OnboardingScreen } from '@/screens/OnboardingScreen'
import { SharedSummaryPage } from '@/screens/SharedSummaryPage'
import { SummaryScreen } from '@/screens/SummaryScreen'
import { TodayScreen } from '@/screens/TodayScreen'

export default function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <SceneProvider>
          <Routes>
            {/* What a doctor sees from a share link: a plain page, no phone frame, no demo controls */}
            <Route path="/s/:token" element={<SharedSummaryPage />} />
            <Route
              path="*"
              element={
                <PhoneFrame aside={<DemoPanel />}>
                  <Routes>
                    <Route path="/" element={<TodayScreen />} />
                    <Route path="/onboarding" element={<OnboardingScreen />} />
                    <Route path="/check-in" element={<CheckInScreen />} />
                    <Route path="/detective" element={<DetectiveScreen />} />
                    <Route path="/experiment" element={<ExperimentScreen />} />
                    <Route path="/summary" element={<SummaryScreen />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </PhoneFrame>
              }
            />
          </Routes>
        </SceneProvider>
      </SessionProvider>
    </BrowserRouter>
  )
}
