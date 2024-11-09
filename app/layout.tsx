import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navbar from './components/navbar'
import Footer from './components/footer'
import { UserProvider } from './context/userProvider'
import { SocketProvider } from './context/socketProvider'
import { NotificationProvider } from './context/notificationProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'WeCommunicate',
  description: 'Generated by create next app',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className +
        "min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800"}>
        <UserProvider>
          <SocketProvider>
          <Navbar />
            <NotificationProvider>
              <div className='mt-10'>
                {children}
              </div>
              <div className='h-1/5 mb-20'></div>
            </NotificationProvider>
          </SocketProvider>
        </UserProvider>
        <Footer />
      </body>
    </html>
  )
}
