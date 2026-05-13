import { useState, useEffect } from "react"

interface ChatMessage {
  id: string
  content: string
  sender: 'user' | 'ai'
  timestamp: Date
}

export function useAIChatbot() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isTyping, setIsTyping] = useState(false)
  
  // Send a message to the AI chatbot
  const sendMessage = async (content: string) => {
    // Add user message
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      content,
      sender: 'user',
      timestamp: new Date()
    }
    
    setMessages(prev => [...prev, userMessage])
    setIsTyping(true)
    
    // Mock AI response - in reality this would call an AI service
    setTimeout(() => {
      const aiMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        content: "Thank you for your message. Our AI assistant is processing your request.",
        sender: 'ai',
        timestamp: new Date()
      }
      
      setMessages(prev => [...prev, aiMessage])
      setIsTyping(false)
    }, 1000)
  }
  
  // Clear chat history
  const clearChat = () => {
    setMessages([])
  }
  
  return {
    messages,
    isTyping,
    sendMessage,
    clearChat
  }
}