"use client"

import { useState, useRef, useEffect, KeyboardEvent, ClipboardEvent } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

interface OTPInputProps {
  length?: number
  value: string
  onChange: (value: string) => void
  onComplete?: (value: string) => void
  error?: boolean
  disabled?: boolean
  className?: string
}

export function OTPInput({
  length = 6,
  value,
  onChange,
  onComplete,
  error = false,
  disabled = false,
  className,
}: OTPInputProps) {
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const paddedValue = value.padEnd(length, "").slice(0, length)
  const digits = paddedValue.split("")

  useEffect(() => {
    const firstEmptyIndex = digits.findIndex((d) => d === "")
    const indexToFocus = firstEmptyIndex === -1 ? length - 1 : firstEmptyIndex
    inputRefs.current[indexToFocus]?.focus()
    setFocusedIndex(indexToFocus)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (index: number, inputValue: string) => {
    if (disabled) return
    const digit = inputValue.replace(/\D/g, "").slice(-1)
    if (!digit && inputValue !== "") return

    const newDigits = [...digits]
    newDigits[index] = digit
    const newValue = newDigits.join("")
    onChange(newValue)

    if (digit && index < length - 1) {
      inputRefs.current[index + 1]?.focus()
      setFocusedIndex(index + 1)
    }

    if (newValue.replace(/\s/g, "").length === length && !newValue.includes("") && onComplete) {
      const clean = newValue.split("").filter(Boolean).join("")
      if (clean.length === length) onComplete(clean)
    }
  }

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return
    if (e.key === "Backspace") {
      if (digits[index]) {
        const newDigits = [...digits]
        newDigits[index] = ""
        onChange(newDigits.join(""))
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus()
        setFocusedIndex(index - 1)
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus()
      setFocusedIndex(index - 1)
    } else if (e.key === "ArrowRight" && index < length - 1) {
      inputRefs.current[index + 1]?.focus()
      setFocusedIndex(index + 1)
    }
  }

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    if (disabled) return
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length)
    if (pastedData) {
      onChange(pastedData)
      const nextIndex = Math.min(pastedData.length, length - 1)
      inputRefs.current[nextIndex]?.focus()
      setFocusedIndex(nextIndex)
      if (pastedData.length === length && onComplete) onComplete(pastedData)
    }
  }

  return (
    <div className={cn("flex items-center justify-center gap-2.5", className)}>
      {Array.from({ length }).map((_, index) => {
        const isFilled = !!digits[index]
        const isFocused = focusedIndex === index

        return (
          <motion.div
            key={index}
            animate={
              error
                ? { x: [0, -10, 10, -6, 6, -3, 3, 0] }
                : isFocused
                  ? { scale: 1.06 }
                  : isFilled
                    ? { scale: [1, 1.12, 1] }
                    : { scale: 1 }
            }
            transition={
              error
                ? { duration: 0.45, delay: index * 0.03 }
                : isFilled && !isFocused
                  ? { duration: 0.3, ease: [0.22, 1, 0.36, 1] }
                  : { type: "spring", stiffness: 280, damping: 20 }
            }
            className="relative"
          >
            {/* Box fill — gold background when digit entered */}
            <AnimatePresence>
              {isFilled && !error && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-0 rounded-xl bg-[#E8A020]/12 pointer-events-none"
                />
              )}
            </AnimatePresence>

            <input
              ref={(el) => { inputRefs.current[index] = el }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digits[index] || ""}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              onFocus={() => setFocusedIndex(index)}
              onBlur={() => setFocusedIndex(-1)}
              disabled={disabled}
              className={cn(
                "w-12 h-14 text-center text-xl font-bold rounded-xl border-2 outline-none transition-all duration-200 relative z-10 bg-white/60 backdrop-blur-sm",
                isFocused && !error && "border-[#E8A020] shadow-[0_0_0_3px_rgba(232,160,32,0.15)] text-[#1A3C5E]",
                isFilled && !error && !isFocused && "border-[#E8A020]/60 text-[#E8A020]",
                !isFilled && !isFocused && "border-[#1A3C5E]/12 text-[#1A3C5E]",
                error && "border-red-400 bg-red-50/60 text-red-600 shadow-[0_0_0_3px_rgba(239,68,68,0.08)]",
                disabled && "opacity-50 cursor-not-allowed",
              )}
              aria-label={`Digit ${index + 1} of ${length}`}
            />
          </motion.div>
        )
      })}
    </div>
  )
}
