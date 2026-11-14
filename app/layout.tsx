import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Fira_Code, Fira_Sans, Overpass } from 'next/font/google'
import './globals.css'

// Space Apps brand typefaces: Fira Sans for headings, Overpass for body, Fira Code for numbers.
const firaSans = Fira_Sans({ subsets: ['latin'], weight: ['700', '900'], variable: '--font-fira-sans' })
const overpass = Overpass({ subsets: ['latin'], variable: '--font-overpass' })
const firaCode = Fira_Code({ subsets: ['latin'], variable: '--font-fira-code' })

export const metadata: Metadata = {
  title: 'EarthScope — Hidden Climate Signals',
  description: 'Explore historical climate trends with transparent evidence and NASA Earth data. An independent NASA Space Apps Challenge project.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#07173F',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${firaSans.variable} ${overpass.variable} ${firaCode.variable}`}>
      <body className="antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
