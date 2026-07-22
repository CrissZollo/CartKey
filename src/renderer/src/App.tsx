import { useCardBridge } from './lib/useCardBridge'
import { isToastMode } from './lib/mode'
import { ScanOverlay } from './components/ScanOverlay'
import { UpdateModal } from './components/UpdateModal'
import { LibraryScreen } from './screens/LibraryScreen'

export default function App() {
  useCardBridge()

  // The toast window only ever needs to react to card taps — it has no
  // library to browse, so skip the rest of the UI entirely.
  if (isToastMode) {
    return (
      <div className="h-screen w-screen">
        <ScanOverlay />
      </div>
    )
  }

  return (
    <div className="h-screen w-screen">
      <LibraryScreen />
      <ScanOverlay />
      <UpdateModal />
    </div>
  )
}
