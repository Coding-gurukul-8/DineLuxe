"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { MessageCircle, X, Send, ArrowRight, User, Bot, Headphones } from "lucide-react"
import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"

// ─── Types ────────────────────────────────────────────────────────────────────

type MessageRole = "user" | "ai" | "agent"

interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  timestamp: Date
  isEscalated?: boolean
}

interface ChatbotResponse {
  message: string
  isEscalated?: boolean
  agentName?: string
}

interface ChatbotWidgetProps {
  restaurantId?: string
  className?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GREETING_MESSAGE: ChatMessage = {
  id: "greeting",
  role: "ai",
  content: "Hi! I'm your DineLuxe assistant. Ask me about your orders, bookings, or anything else!",
  timestamp: new Date(),
}

const QUICK_REPLIES = ["Order Status", "My Booking", "Menu Info"] as const

// ─── Sub-components ───────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 animate-fade-in">
      <div className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
        <Bot size={14} className="text-[#1A3C5E]" />
      </div>
      <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
        <div className="flex gap-1 items-center h-4">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block"
              style={{
                animation: "typing-bounce 1.2s ease-in-out infinite",
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user"
  const isAgent = message.role === "agent"

  return (
    <div
      className={cn(
        "flex items-end gap-2 animate-fade-in",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      {!isUser && (
        <div
          className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
            isAgent
              ? "bg-amber-100 border border-amber-300"
              : "bg-gray-100 border border-gray-200"
          )}
        >
          {isAgent ? (
            <Headphones size={13} className="text-amber-600" />
          ) : (
            <Bot size={13} className="text-[#1A3C5E]" />
          )}
        </div>
      )}

      {/* Bubble */}
      <div
        className={cn(
          "max-w-[75%] px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-[#1A3C5E] text-white rounded-2xl rounded-br-sm"
            : isAgent
              ? "bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl rounded-bl-sm"
              : "bg-gray-100 text-gray-800 rounded-2xl rounded-bl-sm"
        )}
      >
        {message.content}
        {message.isEscalated && (
          <p className="text-xs mt-1.5 text-amber-600 font-medium">
            Transferring to support agent…
          </p>
        )}
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="w-7 h-7 rounded-full bg-[#1A3C5E]/10 border border-[#1A3C5E]/20 flex items-center justify-center shrink-0">
          <User size={13} className="text-[#1A3C5E]" />
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ChatbotWidget({ restaurantId, className }: ChatbotWidgetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING_MESSAGE])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isEscalated, setIsEscalated] = useState(false)
  const [hasUnread, setHasUnread] = useState(false)
  const [showPulse, setShowPulse] = useState(true)
  const [showQuickReplies, setShowQuickReplies] = useState(true)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Stop pulse after 6s
  useEffect(() => {
    const timer = setTimeout(() => setShowPulse(false), 6000)
    return () => clearTimeout(timer)
  }, [])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300)
      setHasUnread(false)
    }
  }, [isOpen])

  const sendMessage = useCallback(
    async (text: string) => {
      const content = text.trim()
      if (!content || isLoading) return

      // Hide quick replies after first user message
      setShowQuickReplies(false)
      setInputValue("")

      // Optimistically add user message
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, userMsg])
      setIsLoading(true)

      try {
        const data = await apiClient.post<ChatbotResponse>("/chatbot/message", {
          message: content,
          ...(restaurantId ? { restaurant_id: restaurantId } : {}),
        })

        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: data.isEscalated ? "agent" : "ai",
          content: data.message,
          timestamp: new Date(),
          isEscalated: data.isEscalated,
        }

        if (data.isEscalated) setIsEscalated(true)

        setMessages((prev) => [...prev, aiMsg])

        // Badge if chat is closed
        if (!isOpen) setHasUnread(true)
      } catch {
        const errMsg: ChatMessage = {
          id: `err-${Date.now()}`,
          role: "ai",
          content: "Sorry, I'm having trouble connecting right now. Please try again in a moment.",
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, errMsg])
      } finally {
        setIsLoading(false)
      }
    },
    [isLoading, isOpen, restaurantId]
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage(inputValue)
    }
  }

  return (
    <>
      {/* ── Keyframe styles injected inline ── */}
      <style>{`
        @keyframes typing-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
        @keyframes widget-slide-up {
          from { opacity: 0; transform: translateY(24px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
        @keyframes chat-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(26, 60, 94, 0.45); }
          50%       { box-shadow: 0 0 0 10px rgba(26, 60, 94, 0); }
        }
        .widget-open {
          animation: widget-slide-up 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
      `}</style>

      <div className={cn("fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3", className)}>
        {/* ── Chat Panel ── */}
        {isOpen && (
          <div
            className="widget-open bg-white rounded-2xl shadow-lg border border-gray-200 flex flex-col overflow-hidden"
            style={{
              width: "380px",
              height: "520px",
              maxWidth: "calc(100vw - 24px)",
              maxHeight: "80dvh",
            }}
          >
            {/* Header */}
            <div className="bg-[#1A3C5E] px-4 py-3.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
                  <MessageCircle size={16} className="text-white" />
                </div>
                <div>
                  <p className="text-white text-sm font-semibold leading-none">DineLuxe Support</p>
                  {restaurantId && (
                    <p className="text-white/60 text-xs mt-0.5">
                      #{restaurantId.slice(0, 8)}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isEscalated && (
                  <div className="flex items-center gap-1.5 bg-red-500/20 border border-red-400/30 rounded-full px-2.5 py-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                    <span className="text-red-200 text-xs font-medium">Live Agent</span>
                  </div>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center"
                  aria-label="Close chat"
                >
                  <X size={14} className="text-white" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 scroll-smooth">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}

              {/* Quick replies — shown after greeting only */}
              {showQuickReplies && !isLoading && messages.length === 1 && (
                <div className="flex flex-wrap gap-2 mt-1 animate-fade-in">
                  {QUICK_REPLIES.map((chip) => (
                    <button
                      key={chip}
                      onClick={() => sendMessage(chip)}
                      className="inline-flex items-center gap-1.5 bg-white border border-[#1A3C5E]/20 text-[#1A3C5E] text-xs font-medium px-3 py-1.5 rounded-full hover:bg-[#1A3C5E] hover:text-white hover:border-[#1A3C5E] transition-all duration-200"
                    >
                      {chip}
                      <ArrowRight size={10} />
                    </button>
                  ))}
                </div>
              )}

              {isLoading && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-3 py-3 border-t border-gray-100 shrink-0 bg-gray-50/60">
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm focus-within:border-[#1A3C5E]/40 focus-within:shadow-[0_0_0_3px_rgba(26,60,94,0.08)] transition-all">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading}
                  placeholder={isLoading ? "Typing…" : "Type a message…"}
                  className="flex-1 text-sm bg-transparent outline-none text-gray-800 placeholder:text-gray-400 disabled:opacity-50"
                />
                <button
                  onClick={() => sendMessage(inputValue)}
                  disabled={!inputValue.trim() || isLoading}
                  className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200",
                    inputValue.trim() && !isLoading
                      ? "bg-[#1A3C5E] text-white hover:bg-[#1A3C5E]/85 hover:scale-105 active:scale-95"
                      : "bg-gray-100 text-gray-400 cursor-not-allowed"
                  )}
                  aria-label="Send message"
                >
                  <Send size={13} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Floating Button ── */}
        <button
          onClick={() => setIsOpen((v) => !v)}
          style={
            showPulse && !isOpen
              ? { animation: "chat-pulse 2s ease infinite" }
              : undefined
          }
          className={cn(
            "relative w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-110 active:scale-95",
            isOpen
              ? "bg-gray-700 hover:bg-gray-800"
              : "bg-[#1A3C5E] hover:bg-[#1A3C5E]/90"
          )}
          aria-label={isOpen ? "Close chat" : "Open chat"}
        >
          <div
            className={cn(
              "transition-all duration-300",
              isOpen ? "rotate-90 opacity-100" : "rotate-0 opacity-100"
            )}
          >
            {isOpen ? (
              <X size={22} className="text-white" />
            ) : (
              <MessageCircle size={22} className="text-white" />
            )}
          </div>

          {/* Unread badge */}
          {hasUnread && !isOpen && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full border-2 border-white text-white text-[9px] font-bold flex items-center justify-center animate-scale-in">
              1
            </span>
          )}
        </button>
      </div>
    </>
  )
}

export default ChatbotWidget