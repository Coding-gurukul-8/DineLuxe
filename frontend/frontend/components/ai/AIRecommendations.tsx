"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  Sparkles, 
  MapPin, 
  MessageCircle,
  BarChart3
} from "lucide-react"
import { useSmartMenuSuggestions } from "@/hooks/useSmartMenuSuggestions"
import { useGeofencing } from "@/hooks/useGeofencing"
import { useAIChatbot } from "@/hooks/useAIChatbot"
import { useSentimentAnalysis } from "@/hooks/useSentimentAnalysis"

export function AIRecommendations() {
  const { suggestions, loading, generateSuggestions } = useSmartMenuSuggestions()
  const { geofences, userLocation, isUserInGeofence, checkGeofence, getUserLocation } = useGeofencing()
  const { messages, isTyping, sendMessage, clearChat } = useAIChatbot()
  const { sentiment, analyzing, analyzeSentiment } = useSentimentAnalysis()
  
  const [activeTab, setActiveTab] = useState<'recommendations' | 'geofencing' | 'chatbot' | 'sentiment'>('recommendations')
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-gray-900">AI Features</h3>
        <div className="flex gap-2">
          <Button 
            variant={activeTab === 'recommendations' ? "primary" : "outline"}
            onClick={() => setActiveTab('recommendations')}
            className="flex items-center gap-2"
          >
            <Sparkles size={16} />
            Recommendations
          </Button>
          <Button 
            variant={activeTab === 'geofencing' ? "primary" : "outline"}
            onClick={() => setActiveTab('geofencing')}
            className="flex items-center gap-2"
          >
            <MapPin size={16} />
            Geo-fencing
          </Button>
          <Button 
            variant={activeTab === 'chatbot' ? "primary" : "outline"}
            onClick={() => setActiveTab('chatbot')}
            className="flex items-center gap-2"
          >
            <MessageCircle size={16} />
            AI Chatbot
          </Button>
          <Button 
            variant={activeTab === 'sentiment' ? "primary" : "outline"}
            onClick={() => setActiveTab('sentiment')}
            className="flex items-center gap-2"
          >
            <BarChart3 size={16} />
            Sentiment
          </Button>
        </div>
      </div>
      
      <Card className="p-6">
        {activeTab === 'recommendations' && (
          <div>
            <h4 className="font-bold text-md mb-4">Smart Menu Recommendations</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {suggestions.map((suggestion) => (
                <div key={suggestion.id} className="p-4 border rounded-lg">
                  <h5 className="font-medium">{suggestion.name}</h5>
                  <p className="text-sm text-gray-600 mt-1">{suggestion.description}</p>
                  <div className="flex justify-between items-center mt-2">
                    <span className="font-bold">Rs {suggestion.price}</span>
                    <span className="text-xs text-gray-500">Popularity: {Math.round(suggestion.popularity * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {activeTab === 'geofencing' && (
          <div>
            <h4 className="font-bold text-md mb-4">Geo-fencing</h4>
            <div className="text-center py-8">
              <MapPin className="mx-auto text-gray-400" size={48} />
              <p className="text-gray-500 mt-4">Geo-fencing detection would appear here</p>
            </div>
          </div>
        )}
        
        {activeTab === 'chatbot' && (
          <div>
            <h4 className="font-bold text-md mb-4">AI Chatbot</h4>
            <div className="text-center py-8">
              <MessageCircle className="mx-auto text-gray-400" size={48} />
              <p className="text-gray-500 mt-4">AI chatbot interface would appear here</p>
            </div>
          </div>
        )}
        
        {activeTab === 'sentiment' && (
          <div>
            <h4 className="font-bold text-md mb-4">Sentiment Analysis</h4>
            <div className="text-center py-8">
              <BarChart3 className="mx-auto text-gray-400" size={48} />
              <p className="text-gray-500 mt-4">Sentiment analysis dashboard would appear here</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}