import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Whitepaper from './docs/Whitepaper'
import TechnicalGuide from './docs/TechnicalGuide'
import CloudflareSetup from './docs/CloudflareSetup'
import OracleDesign from './docs/OracleDesign'
import OracleAPI from './docs/OracleAPI'

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
    { id: 'oracle-system-architecture', title: 'Oracle System Architecture', level: 3 },
    { id: 'frontend-application', title: 'Frontend Application', level: 3 },
    { id: 'backend-services', title: 'Backend Services', level: 3 },
    { id: 'implementation-roadmap', title: 'Implementation Roadmap', level: 2 },
    { id: 'technical-specifications', title: 'Technical Specifications', level: 2 },
    { id: 'smart-contract-interaction-flow', title: 'Smart Contract Interaction Flow', level: 2 },
    { id: 'scheduled-tasks-architecture', title: 'Scheduled Tasks Architecture', level: 2 },
    { id: 'development-best-practices', title: 'Development Best Practices', level: 2 },
    { id: 'implementation-guidance', title: 'Implementation Guidance for Claude Code Agent', level: 2 },
  ],
  cloudflare: [
    { id: 'setting-up-cloudflare-pages-for-living-futures', title: 'Setting Up Cloudflare Pages', level: 1 },
    { id: 'prerequisites', title: 'Prerequisites', level: 2 },
    { id: 'steps', title: 'Steps', level: 2 },
    { id: 'get-your-cloudflare-account-id', title: 'Get Your Cloudflare Account ID', level: 3 },
    { id: 'create-an-api-token', title: 'Create an API Token', level: 3 },
    { id: 'create-the-pages-project', title: 'Create the Pages Project', level: 3 },
    { id: 'option-a-via-cloudflare-dashboard', title: 'Option A: Via Cloudflare Dashboard', level: 4 },
    { id: 'option-b-via-wrangler-cli', title: 'Option B: Via Wrangler CLI', level: 4 },
    { id: 'sync-github-secrets', title: 'Sync GitHub Secrets', level: 3 },
    { id: 'verify-deployment', title: 'Verify Deployment', level: 3 },
    { id: 'troubleshooting', title: 'Troubleshooting', level: 2 },
  ],
  oracle: [
    { id: 'introduction', title: '1. Introduction', level: 2 },
    { id: 'system-purpose', title: '1.1 System Purpose', level: 3 },
    { id: 'design-principles', title: '1.2 Design Principles', level: 3 },
    { id: 'data-requirements', title: '2. Data Requirements', level: 2 },
    { id: 'data-sources-evaluation', title: '2.1 Data Sources Evaluation', level: 3 },
    { id: 'required-data-points', title: '2.2 Required Data Points', level: 3 },
    { id: 'system-architecture', title: '3. System Architecture', level: 2 },
    { id: 'oracle-contract-architecture', title: '3.1 Oracle Contract Architecture', level: 3 },
    { id: 'score-sync-service-architecture', title: '3.2 Score Sync Service Architecture', level: 3 },
    { id: 'implementation-plan', title: '7. Implementation Plan', level: 2 },
    { id: 'security-considerations', title: '8. Security Considerations', level: 2 },
    { id: 'data-integrity', title: '8.1 Data Integrity', level: 3 },
    { id: 'access-control', title: '8.2 Access Control', level: 3 },
    { id: 'economic-security', title: '8.3 Economic Security', level: 3 },
    { id: 'operational-security', title: '8.4 Operational Security', level: 3 },
    { id: 'integration-with-protocol', title: '9. Integration with Protocol', level: 2 },
    { id: 'win-percentage-consumption', title: '9.1 Win Percentage Consumption', level: 3 },
    { id: 'settlement-process', title: '9.2 Settlement Process', level: 3 },
    { id: 'frontend-integration', title: '9.3 Frontend Integration', level: 3 },
    { id: 'operational-procedures', title: '10. Operational Procedures', level: 2 },
    { id: 'routine-operations', title: '10.1 Routine Operations', level: 3 },
    { id: 'error-correction-process', title: '10.2 Error Correction Process', level: 3 },
    { id: 'emergency-procedures', title: '10.3 Emergency Procedures', level: 3 },
    { id: 'future-enhancements', title: '11. Future Enhancements', level: 2 },
    { id: 'conclusion', title: '12. Conclusion', level: 2 }
  ],
  oracleAPI: [
    { id: 'overview', title: '1. Overview', level: 2 },
    { id: 'data-structures', title: '2. Data Structures', level: 2 },
    { id: 'read-functions', title: '3. Read Functions', level: 2 },
    { id: 'write-functions', title: '4. Write Functions', level: 2 },
    { id: 'events', title: '5. Events', level: 2 },
    { id: 'integration-patterns', title: '6. Integration Patterns', level: 2 },
    { id: 'code-examples', title: '7. Code Examples', level: 2 },
    { id: 'error-handling', title: '8. Error Handling', level: 2 }
  ]
}

export default function Documentation() {
  const location = useLocation()
  const [activeSection, setActiveSection] = useState('')

  // Determine which doc we're viewing
  const isWhitepaper = location.pathname.includes('whitepaper') || location.pathname === '/docs' || location.pathname === '/docs/'
  const isTechnical = location.pathname.includes('technical')
  const isCloudflare = location.pathname.includes('cloudflare')
  const isOracle = location.pathname.includes('oracle') && !location.pathname.includes('oracle-api')
  const isOracleAPI = location.pathname.includes('oracle-api')
  
  const currentTOC = isWhitepaper ? docTableOfContents.whitepaper : 
                    isTechnical ? docTableOfContents.technical : 
                    isCloudflare ? docTableOfContents.cloudflare :
                    isOracle ? docTableOfContents.oracle :
                    isOracleAPI ? docTableOfContents.oracleAPI :
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
              <li>
                <Link 
                  to="/docs/cloudflare" 
                  className={`block px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    isActive('/docs/cloudflare') 
                      ? 'bg-primary text-white shadow-retro' 
                      : 'text-gray-700 hover:bg-field-green hover:text-primary'
                  }`}
                >
                  Cloudflare Setup
                </Link>
              </li>
              <li>
                <Link 
                  to="/docs/oracle" 
                  className={`block px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    isActive('/docs/oracle') 
                      ? 'bg-primary text-white shadow-retro' 
                      : 'text-gray-700 hover:bg-field-green hover:text-primary'
                  }`}
                >
                  Oracle Design
                </Link>
              </li>
              <li>
                <Link 
                  to="/docs/oracle-api" 
                  className={`block px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    isActive('/docs/oracle-api') 
                      ? 'bg-primary text-white shadow-retro' 
                      : 'text-gray-700 hover:bg-field-green hover:text-primary'
                  }`}
                >
                  Oracle API Reference
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
            <Route path="cloudflare" element={<CloudflareSetup />} />
            <Route path="oracle" element={<OracleDesign />} />
            <Route path="oracle-api" element={<OracleAPI />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}