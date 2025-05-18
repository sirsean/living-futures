import { Routes, Route, Link, useLocation } from 'react-router-dom'
import Whitepaper from './docs/Whitepaper'
import TechnicalGuide from './docs/TechnicalGuide'

export default function Documentation() {
  const location = useLocation()
  
  const isActive = (path: string) => {
    return location.pathname === path
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar */}
        <aside className="md:w-64 flex-shrink-0">
          <nav className="sticky top-8">
            <h3 className="font-semibold text-gray-900 mb-4">Documentation</h3>
            <ul className="space-y-2">
              <li>
                <Link 
                  to="/docs/whitepaper" 
                  className={`block px-3 py-2 rounded-md text-sm font-medium ${
                    isActive('/docs/whitepaper') 
                      ? 'bg-primary text-white' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Whitepaper
                </Link>
              </li>
              <li>
                <Link 
                  to="/docs/technical" 
                  className={`block px-3 py-2 rounded-md text-sm font-medium ${
                    isActive('/docs/technical') 
                      ? 'bg-primary text-white' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Technical Guide
                </Link>
              </li>
            </ul>
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 bg-white rounded-lg shadow-md p-8">
          <Routes>
            <Route path="/" element={<Whitepaper />} />
            <Route path="whitepaper" element={<Whitepaper />} />
            <Route path="technical" element={<TechnicalGuide />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}