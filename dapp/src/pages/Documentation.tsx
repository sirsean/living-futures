import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Whitepaper from './docs/Whitepaper'
import TechnicalGuide from './docs/TechnicalGuide'

// Define the table of contents for each doc
const docTableOfContents = {
  whitepaper: [
    { id: 'executive-summary', title: 'Executive Summary', level: 2 },
    { id: 'market-overview', title: 'Market Overview', level: 2 },
    { id: 'problem-statement', title: 'Problem Statement', level: 3 },
    { id: 'target-users', title: 'Target Users', level: 3 },
    { id: 'living-futures-mechanics', title: 'Living Futures Mechanics', level: 2 },
    { id: 'core-concept', title: 'Core Concept', level: 3 },
    { id: 'example-contract-lifecycle', title: 'Example Contract Lifecycle', level: 3 },
    { id: 'position-management', title: 'Position Management', level: 3 },
    { id: 'key-benefits', title: 'Key Benefits', level: 3 },
    { id: 'virtual-amm-design', title: 'Virtual AMM Design', level: 2 },
    { id: 'price-discovery-mechanism', title: 'Price Discovery Mechanism', level: 3 },
    { id: 'virtual-liquidity', title: 'Virtual Liquidity', level: 3 },
    { id: 'oracle-integration', title: 'Oracle Integration', level: 3 },
    { id: 'liquidity-provision-system', title: 'Liquidity Provision System', level: 2 },
    { id: 'team-specific-liquidity', title: 'Team-Specific Liquidity', level: 3 },
    { id: 'shared-liquidity-distribution', title: 'Shared Liquidity Distribution', level: 3 },
    { id: 'excess-profit-utilization', title: 'Excess Profit Utilization', level: 3 },
    { id: 'liquidity-incentives', title: 'Liquidity Incentives', level: 3 },
    { id: 'risk-management-insurance', title: 'Risk Management & Insurance', level: 2 },
    { id: 'insurance-fund', title: 'Insurance Fund', level: 3 },
    { id: 'insurance-staking', title: 'Insurance Staking', level: 3 },
    { id: 'liquidation-process', title: 'Liquidation Process', level: 3 },
    { id: 'circuit-breakers', title: 'Circuit Breakers', level: 3 },
    { id: 'oracle-infrastructure', title: 'Oracle Infrastructure', level: 2 },
    { id: 'data-sources', title: 'Data Sources', level: 3 },
    { id: 'update-mechanism', title: 'Update Mechanism', level: 3 },
    { id: 'node-operations', title: 'Node Operations', level: 3 },
    { id: 'tokenomics-governance', title: 'Tokenomics & Governance', level: 2 },
    { id: 'fee-structure', title: 'Fee Structure', level: 3 },
    { id: 'governance-framework', title: 'Governance Framework', level: 3 },
    { id: 'treasury-allocation', title: 'Treasury Allocation', level: 3 },
    { id: 'implementation-roadmap', title: 'Implementation Roadmap', level: 2 },
    { id: 'technical-architecture', title: 'Technical Architecture', level: 2 },
    { id: 'smart-contract-structure', title: 'Smart Contract Structure', level: 3 },
    { id: 'off-chain-infrastructure', title: 'Off-Chain Infrastructure', level: 3 },
    { id: 'legal-compliance', title: 'Legal & Compliance Considerations', level: 2 },
    { id: 'regulatory-framework', title: 'Regulatory Framework', level: 3 },
    { id: 'risk-disclosures', title: 'Risk Disclosures', level: 3 },
    { id: 'conclusion', title: 'Conclusion', level: 2 },
  ],
  technical: [
    { id: 'system-architecture-overview', title: 'System Architecture Overview', level: 2 },
    { id: 'core-components-and-design-principles', title: 'Core Components and Design Principles', level: 2 },
    { id: 'smart-contract-architecture', title: 'Smart Contract Architecture', level: 3 },
    { id: 'frontend-application', title: 'Frontend Application', level: 3 },
    { id: 'backend-services', title: 'Backend Services', level: 3 },
    { id: 'implementation-roadmap', title: 'Implementation Roadmap', level: 2 },
    { id: 'technical-specifications', title: 'Technical Specifications', level: 2 },
    { id: 'smart-contract-interaction-flow', title: 'Smart Contract Interaction Flow', level: 2 },
    { id: 'scheduled-tasks-architecture', title: 'Scheduled Tasks Architecture', level: 2 },
    { id: 'development-best-practices', title: 'Development Best Practices', level: 2 },
    { id: 'implementation-guidance', title: 'Implementation Guidance for Claude Code Agent', level: 2 },
  ]
}

export default function Documentation() {
  const location = useLocation()
  const [activeSection, setActiveSection] = useState('')

  // Determine which doc we're viewing
  const isWhitepaper = location.pathname.includes('whitepaper') || location.pathname === '/docs' || location.pathname === '/docs/'
  const isTechnical = location.pathname.includes('technical')
  
  const currentTOC = isWhitepaper ? docTableOfContents.whitepaper : 
                    isTechnical ? docTableOfContents.technical : 
                    docTableOfContents.whitepaper

  const isActive = (path: string) => {
    return location.pathname === path
  }

  useEffect(() => {
    const handleScroll = () => {
      const sections = currentTOC.map(item => document.getElementById(item.id))
      const scrollPosition = window.scrollY + 100

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i]
        if (section && section.offsetTop <= scrollPosition) {
          setActiveSection(currentTOC[i].id)
          break
        }
      }
    }

    window.addEventListener('scroll', handleScroll)
    handleScroll() // Check initial position
    return () => window.removeEventListener('scroll', handleScroll)
  }, [currentTOC])

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      window.scrollTo({
        top: element.offsetTop - 80,
        behavior: 'smooth'
      })
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 bg-field-green min-h-screen">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar */}
        <aside className="md:w-80 flex-shrink-0">
          <nav className="sticky top-8 bg-white p-6 rounded-lg shadow-retro">
            <h3 className="font-display font-bold text-primary text-lg mb-4">Documentation</h3>
            
            {/* Document Selection */}
            <ul className="space-y-2 mb-6">
              <li>
                <Link 
                  to="/docs/whitepaper" 
                  className={`block px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    isActive('/docs/whitepaper') || isActive('/docs') || isActive('/docs/')
                      ? 'bg-primary text-white shadow-retro' 
                      : 'text-gray-700 hover:bg-field-green hover:text-primary'
                  }`}
                >
                  Whitepaper
                </Link>
              </li>
              <li>
                <Link 
                  to="/docs/technical" 
                  className={`block px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    isActive('/docs/technical') 
                      ? 'bg-primary text-white shadow-retro' 
                      : 'text-gray-700 hover:bg-field-green hover:text-primary'
                  }`}
                >
                  Technical Guide
                </Link>
              </li>
            </ul>

            {/* Table of Contents */}
            <div className="border-t border-gray-200 pt-4 mt-6">
              <h4 className="font-display font-medium text-primary mb-3 text-sm">On This Page</h4>
              <ul className="space-y-1">
                {currentTOC.map((item) => (
                  <li key={item.id} style={{ paddingLeft: `${(item.level - 2) * 12}px` }}>
                    <button
                      onClick={() => scrollToSection(item.id)}
                      className={`block w-full text-left px-3 py-1 rounded text-sm hover:bg-field-green transition-colors ${
                        activeSection === item.id 
                          ? 'text-primary font-medium bg-field-green' 
                          : 'text-gray-600 hover:text-primary'
                      }`}
                    >
                      {item.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 bg-white rounded-lg shadow-retro p-8 border-2 border-secondary">
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