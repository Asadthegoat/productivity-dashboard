import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { DashboardProvider } from "./context/DashboardContext"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Productivity Dashboard",
  description: "A dark-mode productivity dashboard for focused work",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <DashboardProvider>
          {children}
        </DashboardProvider>
      </body>
    </html>
  )
}
