"use client"

import { useState, useEffect } from "react"
import { LoginForm } from "@/components/auth/login-form"
import { UserDashboard } from "@/components/dashboard/user-dashboard"
import { AuthService } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Shield } from "lucide-react"
import Link from "next/link"
import { FadeTransition } from "@/components/ui/page-transition"
import { motion, AnimatePresence } from "framer-motion"

export default function HomePage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const authenticated = AuthService.isAuthenticated()
    setIsAuthenticated(authenticated)
    setIsLoading(false)
  }, [])

  const handleLogin = () => {
    setIsAuthenticated(true)
  }

  const handleLogout = () => {
    AuthService.logout()
    setIsAuthenticated(false)
  }

  if (isLoading) {
    return (
      <FadeTransition>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-card to-muted">
          <motion.div
            className="flex items-center gap-3"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
          >
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-lg font-medium">Loading IoT Dashboard...</span>
          </motion.div>
        </div>
      </FadeTransition>
    )
  }

  return (
    <AnimatePresence mode="wait">
      {!isAuthenticated ? (
        <LoginForm key="login" onLogin={handleLogin} />
      ) : (
        <div key="dashboard" className="relative">
          <UserDashboard onLogout={handleLogout} />

          {/* Admin Access Button */}
          {AuthService.isAdmin() && (
            <motion.div
              className="fixed bottom-6 right-6 z-50"
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 1, duration: 0.6, type: "spring", stiffness: 400, damping: 17 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link href="/admin">
                <Button className="bg-secondary hover:bg-secondary/80 text-secondary-foreground shadow-lg animate-pulse-glow">
                  <Shield className="w-4 h-4 mr-2" />
                  Admin Control Room
                </Button>
              </Link>
            </motion.div>
          )}
        </div>
      )}
    </AnimatePresence>
  )
}
