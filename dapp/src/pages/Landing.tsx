import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <div className="bg-field-green">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary via-primary-light to-primary-dark text-white overflow-hidden">
        {/* Decorative baseball diamond pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rotate-45 w-96 h-96 border-8 border-white"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20 text-center">
          <h1 className="text-5xl md:text-7xl font-display font-extrabold mb-6">
            Living Futures
          </h1>
          <div className="inline-block">
            <p className="text-xl md:text-2xl mb-8 text-white/90 max-w-3xl mx-auto">
              Where Baseball Tradition Meets Financial Innovation
            </p>
            <div className="w-32 h-1 bg-secondary mx-auto mb-8"></div>
          </div>
          <p className="text-lg text-white/80 mb-12 max-w-2xl mx-auto">
            Trade season-long derivative contracts on team win percentages with daily funding, 
            sophisticated liquidity provision, and decentralized price discovery.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/docs/whitepaper" className="bg-white text-primary px-8 py-4 rounded-full font-bold hover:bg-secondary hover:text-white transition-all shadow-retro">
              Read Whitepaper
            </Link>
            <Link to="/docs/technical" className="border-2 border-white text-white px-8 py-4 rounded-full font-bold hover:bg-white hover:text-primary transition-all">
              Technical Documentation
            </Link>
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h2 className="text-4xl font-display font-bold text-center text-dark mb-16">
          Bridging Two Worlds
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="bg-white p-8 rounded-lg shadow-retro border-2 border-transparent hover:border-primary transition-all">
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mb-6">
              <span className="text-2xl text-white font-bold">⚾</span>
            </div>
            <h3 className="text-xl font-display font-semibold text-dark mb-3">Living Futures</h3>
            <p className="text-gray-600">
              Season-long contracts with daily funding that reflect team performance in real-time
            </p>
          </div>
          <div className="bg-white p-8 rounded-lg shadow-retro border-2 border-transparent hover:border-tech-blue transition-all">
            <div className="w-16 h-16 bg-tech-blue rounded-full flex items-center justify-center mb-6">
              <span className="text-2xl text-white font-bold">📊</span>
            </div>
            <h3 className="text-xl font-display font-semibold text-dark mb-3">Virtual AMM</h3>
            <p className="text-gray-600">
              Sigmoid-based price discovery mechanism with bounded outcomes for efficient trading
            </p>
          </div>
          <div className="bg-white p-8 rounded-lg shadow-retro border-2 border-transparent hover:border-secondary transition-all">
            <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mb-6">
              <span className="text-2xl text-white font-bold">💧</span>
            </div>
            <h3 className="text-xl font-display font-semibold text-dark mb-3">Multi-Level Liquidity</h3>
            <p className="text-gray-600">
              Team-specific and shared liquidity pools with dynamic incentives for providers
            </p>
          </div>
          <div className="bg-white p-8 rounded-lg shadow-retro border-2 border-transparent hover:border-accent transition-all">
            <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mb-6">
              <span className="text-2xl text-white font-bold">🛡️</span>
            </div>
            <h3 className="text-xl font-display font-semibold text-dark mb-3">Risk Management</h3>
            <p className="text-gray-600">
              Comprehensive insurance system with zero-base rate staking for system security
            </p>
          </div>
        </div>
      </section>

      {/* Technical Overview */}
      <section className="bg-infield-brown py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-display font-bold text-center text-dark mb-16">
            Built for the Future
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center group">
              <div className="bg-white w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-retro group-hover:shadow-future transition-all">
                <span className="text-primary font-bold text-3xl">1</span>
              </div>
              <h3 className="text-xl font-display font-semibold text-dark mb-3">Smart Contracts</h3>
              <p className="text-gray-600">
                Upgradeable contracts on Base blockchain with proxy pattern for long-term sustainability
              </p>
            </div>
            <div className="text-center group">
              <div className="bg-white w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-retro group-hover:shadow-future transition-all">
                <span className="text-tech-blue font-bold text-3xl">2</span>
              </div>
              <h3 className="text-xl font-display font-semibold text-dark mb-3">Frontend Application</h3>
              <p className="text-gray-600">
                React-based interface hosted on Cloudflare Pages for fast, global accessibility
              </p>
            </div>
            <div className="text-center group">
              <div className="bg-white w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-retro group-hover:shadow-future transition-all">
                <span className="text-tech-purple font-bold text-3xl">3</span>
              </div>
              <h3 className="text-xl font-display font-semibold text-dark mb-3">Backend Services</h3>
              <p className="text-gray-600">
                Cloudflare Workers handling oracle updates, funding payments, and liquidations
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-primary-dark to-primary-light text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-display font-bold mb-6">Ready to Step Up to the Plate?</h2>
          <p className="text-xl mb-10 text-white/90">
            Explore our comprehensive documentation to understand the full potential of Living Futures
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/docs" className="bg-white text-primary px-8 py-4 rounded-full font-bold hover:bg-secondary hover:text-white transition-all shadow-retro">
              View Documentation
            </Link>
            <a href="https://github.com/sirsean/living-futures" className="border-2 border-white text-white px-8 py-4 rounded-full font-bold hover:bg-white hover:text-primary transition-all">
              View on GitHub
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}