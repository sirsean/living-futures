/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Baseball-inspired greens and earth tones
        'primary': '#1e5631',     // Deep forest green (like outfield grass)
        'primary-light': '#2d7a48',
        'primary-dark': '#153d23',
        
        // Warm nostalgic tones
        'secondary': '#d4a574',   // Baseball glove leather brown
        'accent': '#e74c3c',      // Stadium red (like foul lines)
        
        // Modern tech overlay
        'tech-blue': '#3498db',   // Bright tech blue
        'tech-purple': '#6c5ce7', // Futuristic purple
        
        // Base colors
        'dark': '#1a1a1a',
        'light': '#fafafa',
        'gray': {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
        },
        
        // Backgrounds
        'field-green': '#f0f7f4',  // Light baseball field green
        'infield-brown': '#fdf8f3', // Light infield dirt
      },
      boxShadow: {
        'retro': '4px 4px 0px 0px rgba(0,0,0,0.1)',
        'future': '0 0 20px rgba(52, 152, 219, 0.15)',
      },
      fontFamily: {
        'display': ['Oswald', 'sans-serif'],
        'body': ['Inter', 'sans-serif'],
      },
      typography: (theme) => ({
        DEFAULT: {
          css: {
            color: theme('colors.gray.900'),
            a: {
              color: theme('colors.primary'),
              '&:hover': {
                color: theme('colors.primary-dark'),
              },
            },
            h1: {
              color: theme('colors.dark'),
              fontFamily: theme('fontFamily.display').join(', '),
            },
            h2: {
              color: theme('colors.primary'),
              fontFamily: theme('fontFamily.display').join(', '),
            },
            h3: {
              color: theme('colors.primary-dark'),
              fontFamily: theme('fontFamily.display').join(', '),
            },
            strong: {
              color: theme('colors.dark'),
            },
            code: {
              color: theme('colors.primary'),
              backgroundColor: theme('colors.field-green'),
              padding: '2px 4px',
              borderRadius: '4px',
            },
            'pre code': {
              backgroundColor: 'transparent',
              padding: 0,
            },
            pre: {
              backgroundColor: theme('colors.dark'),
              color: theme('colors.gray.100'),
            },
          },
        },
      }),
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}