import { useCardBridge } from './lib/useCardBridge'
import { ScanOverlay } from './components/ScanOverlay'
import { LibraryScreen } from './screens/LibraryScreen'

export default function App() {
  useCardBridge()

  return (
    <div className="h-screen w-screen">
      <LibraryScreen />
      <ScanOverlay />
    </div>
  )
}
