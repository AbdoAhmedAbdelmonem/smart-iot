"use client"

import { motion } from "framer-motion"
import type { ReactNode } from "react"

interface PageTransitionProps {
  children: ReactNode
  className?: string
}

const pageVariants = {
  initial: {
    opacity: 0,
    scale: 0.95,
    y: 20,
  },
  in: {
    opacity: 1,
    scale: 1,
    y: 0,
  },
  out: {
    opacity: 0,
    scale: 1.05,
    y: -20,
  },
}

const pageTransition = {
  type: "tween",
  ease: "anticipate",
  duration: 0.6,
}

export function PageTransition({ children, className = "" }: PageTransitionProps) {
  return (
    <motion.div
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function SlideTransition({
  children,
  direction = "right",
}: { children: ReactNode; direction?: "left" | "right" }) {
  const slideVariants = {
    initial: {
      opacity: 0,
      x: direction === "right" ? 100 : -100,
    },
    in: {
      opacity: 1,
      x: 0,
    },
    out: {
      opacity: 0,
      x: direction === "right" ? -100 : 100,
    },
  }

  return (
    <motion.div initial="initial" animate="in" exit="out" variants={slideVariants} transition={pageTransition}>
      {children}
    </motion.div>
  )
}

export function FadeTransition({ children }: { children: ReactNode }) {
  const fadeVariants = {
    initial: { opacity: 0 },
    in: { opacity: 1 },
    out: { opacity: 0 },
  }

  return (
    <motion.div initial="initial" animate="in" exit="out" variants={fadeVariants} transition={{ duration: 0.4 }}>
      {children}
    </motion.div>
  )
}

export function ScaleTransition({ children }: { children: ReactNode }) {
  const scaleVariants = {
    initial: { opacity: 0, scale: 0.8 },
    in: { opacity: 1, scale: 1 },
    out: { opacity: 0, scale: 1.1 },
  }

  return (
    <motion.div initial="initial" animate="in" exit="out" variants={scaleVariants} transition={pageTransition}>
      {children}
    </motion.div>
  )
}
