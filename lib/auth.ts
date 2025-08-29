"use client"

import { adminEmails } from "./admin-emails"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "YOUR_SUPABASE_URL"
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "YOUR_SUPABASE_ANON_KEY"
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface User {
  email: string
  isAdmin: boolean
}

export class AuthService {
  private static readonly STORAGE_KEY = "iot_dashboard_user"

  static isValidAdmin(email: string): boolean {
    return adminEmails.includes(email)
  }

  static isAdminEmail(email: string): boolean {
    return adminEmails.includes(email)
  }

  static saveUser(email: string): void {
    this.logout()
    const user: User = { email, isAdmin: adminEmails.includes(email) }
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user))
  }

  static login(email: string, password: string): User | null {
    if (this.isValidAdmin(email)) {
      this.logout()
      const user: User = { email, isAdmin: true }
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user))
      return user
    }
    return null
  }

  static async loginWithGoogle(): Promise<User | null> {
    // Start OAuth flow
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google" })
    if (error) {
      return null
    }
    // After redirect, get user session
    const {
      data: { user },
      error: sessionError
    } = await supabase.auth.getUser()
    if (sessionError || !user || !user.email) {
      return null
    }
    // Always clear previous session before saving new user
    this.logout()
    const loggedUser: User = { email: user.email, isAdmin: adminEmails.includes(user.email) }
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(loggedUser))
    return loggedUser
  }

  static logout(): void {
    localStorage.clear(); // Clear all localStorage, not just user
    supabase.auth.signOut(); // End Supabase session
  }

  static getCurrentUser(): User | null {
    if (typeof window === "undefined") return null
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  }

  static isAuthenticated(): boolean {
    return this.getCurrentUser() !== null
  }

  static isAdmin(): boolean {
    const user = this.getCurrentUser()
    return user?.isAdmin ?? false
  }
}
