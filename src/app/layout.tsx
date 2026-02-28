import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/layout/Navbar'

export const metadata: Metadata = {
  title: 'Ridermate — Rider Finance Tracker',
  description: 'Personal finance and operations tracker for ride-hailing drivers in Sri Lanka.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="app-container">
          <main className="page-content">
            {children}
          </main>
          <Navbar />
        </div>
      </body>
    </html>
  )
}
