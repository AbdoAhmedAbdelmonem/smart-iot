"use client"

import type React from "react"
import { useRouter } from "next/navigation"

import { useState, useEffect } from "react"
import { AuthService, supabase } from "@/lib/auth"
// GoogleIcon does not exist in lucide-react, so we use a custom SVG component
function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={props.width || 24} height={props.height || 24} {...props}>
      <g>
        <path fill="#4285F4" d="M12 12.7v3.6h5.1c-.2 1.2-1.5 3.5-5.1 3.5-3.1 0-5.6-2.6-5.6-5.8s2.5-5.8 5.6-5.8c1.8 0 3 .7 3.7 1.3l2.5-2.4C16.2 5.7 14.3 4.8 12 4.8 6.9 4.8 2.8 8.7 2.8 13.1s4.1 8.3 9.2 8.3c5.3 0 8.8-3.7 8.8-8.9 0-.6-.1-1.1-.2-1.6H12z"/>
        <path fill="#34A853" d="M12 21.4c2.6 0 4.7-.9 6.2-2.5l-3-2.4c-.8.6-1.9 1-3.2 1-2.5 0-4.6-1.7-5.3-4.1H3.7v2.6C5.2 19.7 8.3 21.4 12 21.4z"/>
        <path fill="#FBBC05" d="M6.7 13.5c-.2-.6-.3-1.2-.3-1.9s.1-1.3.3-1.9V7.1H3.7C3.1 8.3 2.8 9.6 2.8 11.1c0 1.5.3 2.8.9 4l3-2.4z"/>
        <path fill="#EA4335" d="M12 8.2c1.4 0 2.6.5 3.5 1.4l2.6-2.5C16.7 5.7 14.3 4.8 12 4.8c-3.7 0-6.8 1.7-8.3 4.3l3 2.4c.7-2.4 2.8-4.1 5.3-4.1z"/>
      </g>
    </svg>
  )
}
import { Mail, Lock, LogIn, AlertCircle } from "lucide-react"
import { PageTransition, ScaleTransition } from "@/components/ui/page-transition"
import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

interface LoginFormProps {
  onLogin: () => void
}

export function LoginForm({ onLogin }: LoginFormProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  // Only check session after redirect, do not trigger OAuth here
  useEffect(() => {
    const checkSession = async () => {
      const { data, error: sessionError } = await supabase.auth.getUser()
      if (sessionError) {
        setIsLoading(false)
        return
      }
      if (data.user && data.user.email) {
        // Save user and log in
        AuthService.saveUser(data.user.email)
        onLogin()
        router.replace("/#") // Redirect to dashboard
      } else {
        setIsLoading(false)
      }
    }
    checkSession()
  }, [onLogin, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)
    try {
      const user = AuthService.login(email, password)
      if (user) {
        onLogin()
      } else {
        setError("Invalid credentials. Only authorized admins can access this system.")
      }
    } catch (err) {
      setError("Login failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  // Only trigger Google OAuth on button click
  const handleGoogleSignIn = async () => {
    setError("")
    setIsLoading(true)
    try {
      await AuthService.loginWithGoogle()
      // No need to call onLogin here, session will be checked after redirect
    } catch (err) {
      setError("Google sign-in failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
        <span className="ml-2">Checking session...</span>
      </div>
    )
  }

  return (
    <PageTransition>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-card to-muted p-4">
        <ScaleTransition>
          <Card className="w-full max-w-md glass-effect">
            <CardHeader className="text-center space-y-4">
              <motion.div
                className="mx-auto w-16 h-16 bg-primary rounded-full flex items-center justify-center"
                whileHover={{ scale: 1.1, rotate: 5 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                <LogIn className="w-8 h-8 text-primary-foreground" />
              </motion.div>
              <CardTitle className="text-2xl font-bold text-balance">IoT Dashboard Login</CardTitle>
              <CardDescription className="text-pretty">
                Enter your admin credentials to access the control system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <motion.div
                  className="space-y-2"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                  />
                </motion.div>

                <motion.div
                  className="space-y-2"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <Label htmlFor="password" className="flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                  />
                </motion.div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  >
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  </motion.div>
                )}

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                  <Button
                    type="submit"
                    className="w-full transition-all duration-200 hover:scale-105"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                        Signing In...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <LogIn className="w-4 h-4" />
                        Sign In
                      </div>
                    )}
                  </Button>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                    <Button
                    type="button"
                    variant="outline"
                    className="w-full flex items-center justify-center gap-2 mt-2 text-white border border-white hover:text-white hover:border-white focus:text-white focus:border-white cursor-pointer transform transition-transform hover:scale-105 shadow-lg"
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                    style={{ backdropFilter: "blur(10px)" }}
                    >
                    <GoogleIcon className="w-4 h-4" />
                    Sign in with Google
                    </Button>
                </motion.div>
              </form>

              <motion.div
                className="mt-6 p-4 bg-muted rounded-lg"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <p className="text-sm text-muted-foreground text-center">
                  <strong>Admin Access Only</strong>
                  <br />
                  Contact your system administrator for credentials
                </p>
              </motion.div>
            </CardContent>
          </Card>
        </ScaleTransition>
      </div>
    </PageTransition>
  )
}
