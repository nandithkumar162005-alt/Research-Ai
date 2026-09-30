
import { Routes, Route } from 'react-router-dom'
import { MainLayout } from './layouts/MainLayout'
import { Research } from './pages/Research'
import { ApiSettings } from './pages/ApiSettings'

function App() {
  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<Research />} />
        <Route path="settings" element={<ApiSettings />} />
      </Route>
    </Routes>
  )
}

export default App
