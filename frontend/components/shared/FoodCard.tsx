"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { Plus, Minus, Leaf, Beef, AlertTriangle } from "lucide-react"

interface FoodCardProps {
  item: {
    id: string
    name: string
    description?: string | null
    price: number
    discountedPrice?: number
    photoUrl?: string
    dietaryTags?: string[]
    allergens?: string[] | null
    prepTimeMinutes?: number
    isAvailable?: boolean
    isSoldOut?: boolean
  }
  quantity?: number
  onAddToCart?: (itemId: string, quantity: number) => void
  className?: string
}

export function FoodCard({ item, quantity = 0, onAddToCart, className }: FoodCardProps) {
  const [showAllergens, setShowAllergens] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const dietaryTags = item.dietaryTags ?? []
  const description = item.description ?? ""
  
  const hasDiscount = item.discountedPrice && item.discountedPrice < item.price
  const isVeg = dietaryTags.includes("veg") || dietaryTags.includes("vegan")
  const isNonVeg = dietaryTags.includes("non-veg")
  
  return (
    <div className={cn("relative bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow", className)}>
      {/* Image Container - 4:3 aspect ratio */}
      <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
        {item.photoUrl ? (
          <>
            {!imageLoaded && <div className="skeleton absolute inset-0" />}
            <img
              src={item.photoUrl}
              alt={item.name}
              className={cn(
                "w-full h-full object-cover transition-opacity duration-300",
                imageLoaded ? "opacity-100" : "opacity-0"
              )}
              onLoad={() => setImageLoaded(true)}
              loading="lazy"
            />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-50">
            <span className="text-4xl">🍽️</span>
          </div>
        )}
        
        {/* Dietary badge */}
        <div className="absolute top-2 left-2">
          {isVeg && (
            <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-medium">
              <Leaf size={12} /> Veg
            </span>
          )}
          {isNonVeg && (
            <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full font-medium">
              <Beef size={12} /> Non-Veg
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-3">
        <h3 className="font-semibold text-gray-900 text-sm line-clamp-1">{item.name}</h3>
        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{description}</p>
        
        {/* Price and Add button */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900">
              Rs {hasDiscount ? item.discountedPrice : item.price}
            </span>
            {hasDiscount && (
              <span className="text-xs text-gray-400 line-through">Rs {item.price}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}