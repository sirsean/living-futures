import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="bg-field-green min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-8xl font-display font-extrabold text-primary mb-4">404</h1>
        <p className="text-2xl font-display text-dark mb-2">Out of the Park!</p>
        <p className="text-lg text-gray-600 mb-8">This page seems to have taken a fly ball over the fence.</p>
        <Link to="/" className="bg-primary text-white px-8 py-4 rounded-full font-bold hover:bg-primary-dark transition-all shadow-retro">
          Return to Home Plate
        </Link>
      </div>
    </div>
  )
}