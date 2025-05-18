import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <div className="bg-gradient-to-b from-white to-gray-50">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
        <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 mb-8">
          Living Futures
        </h1>
        <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto">
          A Dynamic Derivatives Market for Baseball Team Performance
        </p>
        <p className="text-lg text-gray-500 mb-12 max-w-2xl mx-auto">
          Trade season-long derivative contracts on team win percentages with daily funding, 
          sophisticated liquidity provision, and decentralized price discovery.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/docs/whitepaper" className="bg-primary text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition">
            Read Whitepaper
          </Link>
          <Link to="/docs/technical" className="border border-primary text-primary px-8 py-3 rounded-lg font-semibold hover:bg-blue-50 transition">
            Technical Documentation
          </Link>
        </div>
      </section>

      {/* Key Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Key Innovations</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Living Futures</h3>
            <p className="text-gray-600">
              Season-long contracts with daily funding that reflect team performance in real-time
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Virtual AMM</h3>
            <p className="text-gray-600">
              Sigmoid-based price discovery mechanism with bounded outcomes for efficient trading
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Multi-Level Liquidity</h3>
            <p className="text-gray-600">
              Team-specific and shared liquidity pools with dynamic incentives for providers
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Risk Management</h3>
            <p className="text-gray-600">
              Comprehensive insurance system with zero-base rate staking for system security
            </p>
          </div>
        </div>
      </section>

      {/* Technical Overview */}
      <section className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Technical Architecture</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-primary w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-bold text-xl">1</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Smart Contracts</h3>
              <p className="text-gray-600">
                Upgradeable contracts on Base blockchain with proxy pattern for long-term sustainability
              </p>
            </div>
            <div className="text-center">
              <div className="bg-primary w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-bold text-xl">2</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Frontend Application</h3>
              <p className="text-gray-600">
                React-based interface hosted on Cloudflare Pages for fast, global accessibility
              </p>
            </div>
            <div className="text-center">
              <div className="bg-primary w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-bold text-xl">3</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Backend Services</h3>
              <p className="text-gray-600">
                Cloudflare Workers handling oracle updates, funding payments, and liquidations
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-6">Ready to Learn More?</h2>
        <p className="text-lg text-gray-600 mb-8">
          Explore our comprehensive documentation to understand the full potential of Living Futures
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/docs" className="bg-primary text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition">
            View Documentation
          </Link>
          <a href="https://github.com/sirsean/living-futures" className="border border-primary text-primary px-8 py-3 rounded-lg font-semibold hover:bg-blue-50 transition">
            View on GitHub
          </a>
        </div>
      </section>
    </div>
  )
}