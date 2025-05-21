import { Link } from 'react-router-dom'

export default function Header() {
  return (
    <header className="bg-gradient-to-r from-primary to-primary-light shadow-lg">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-3 text-2xl font-display font-bold text-white hover:text-secondary transition-colors group">
              <div className="bg-primary-dark group-hover:bg-secondary p-2 rounded-lg transition-colors">
                <img src="/favicon-32x32.png" alt="Living Futures" className="w-8 h-8 rounded-lg" />
              </div>
              <span>Living Futures</span>
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