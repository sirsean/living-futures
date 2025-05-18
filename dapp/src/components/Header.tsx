import { Link } from 'react-router-dom'

export default function Header() {
  return (
    <header className="bg-gradient-to-r from-primary to-primary-light shadow-lg">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="text-2xl font-display font-bold text-white hover:text-secondary transition-colors">
              Living Futures
            </Link>
          </div>
          <div className="flex items-center">
            <Link to="/docs" className="text-white/90 hover:text-white hover:bg-white/10 px-3 py-2 rounded-md text-sm font-medium transition-all">
              Documentation
            </Link>
          </div>
        </div>
      </nav>
    </header>
  )
}