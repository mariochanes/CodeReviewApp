import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CodeReview - StumbleUpon for Code',
  description: 'Review code snippets from GitHub and discover code smells',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

