"use client"

import type React from "react"

import { ArrowLeft, Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { triggerHaptic } from "@/lib/haptics"

interface ResponsiveHeaderProps {
  title: string
  subtitle?: string
  showBack?: boolean
  onBack?: () => void
  actions?: React.ReactNode
  mobileMenu?: React.ReactNode
  className?: string
}

export function ResponsiveHeader({
  title,
  subtitle,
  showBack,
  onBack,
  actions,
  mobileMenu,
  className,
}: ResponsiveHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const router = useRouter()

  const handleBack = () => {
    triggerHaptic("light")
    if (onBack) {
      onBack()
    } else {
      router.back()
    }
  }

  const toggleMenu = () => {
    triggerHaptic("light")
    setMenuOpen(!menuOpen)
  }

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
          className,
        )}
      >
        <div className="flex h-14 md:h-16 items-center gap-2 px-3 md:px-6">
          {/* Back Button */}
          {showBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              className="shrink-0 h-9 w-9 md:h-10 md:w-10"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}

          {/* Title Section */}
          <div className="flex-1 min-w-0">
            <h1 className="text-base md:text-lg font-semibold truncate">{title}</h1>
            {subtitle && <p className="text-xs md:text-sm text-muted-foreground truncate">{subtitle}</p>}
          </div>

          {/* Desktop Actions */}
          {actions && <div className="hidden md:flex items-center gap-2 shrink-0">{actions}</div>}

          {/* Mobile Menu Toggle */}
          {mobileMenu && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMenu}
              className="md:hidden shrink-0 h-9 w-9"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          )}
        </div>
      </header>

      {/* Mobile Menu Dropdown */}
      {mobileMenu && menuOpen && (
        <div className="md:hidden fixed inset-x-0 top-14 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-lg animate-in slide-in-from-top-2">
          <div className="p-4 space-y-2">{mobileMenu}</div>
        </div>
      )}
    </>
  )
}
