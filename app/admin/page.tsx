"use client"

import { useState, useEffect } from "react"
import { LoginForm } from "@/components/auth/login-form"
import { AdminControlRoom } from "@/components/dashboard/admin-control-room"
import { AuthService } from "@/lib/auth"
import { useRouter } from "next/navigation"

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const authenticated = AuthService.isAuthenticated()
    const isAdmin = AuthService.isAdmin()

    if (authenticated && isAdmin) {
      setIsAuthenticated(true)
    } else if (authenticated && !isAdmin) {
      // Redirect non-admin users to main dashboard
      router.push("/")
      return
    }

    setIsLoading(false)
  }, [router])

  const handleLogin = () => {
    const isAdmin = AuthService.isAdmin()
    if (isAdmin) {
      setIsAuthenticated(true)
    } else {
      // Redirect to main dashboard if not admin
      router.push("/")
    }
  }

  const handleLogout = () => {
    AuthService.logout()
    setIsAuthenticated(false)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-card to-muted">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-lg font-medium">Loading Admin Control Room...</span>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginForm onLogin={handleLogin} />
  }

  return <AdminControlRoom onLogout={handleLogout} />
}
