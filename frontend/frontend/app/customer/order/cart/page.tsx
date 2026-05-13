"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { useQuery } from "@tanstack/react-query"
import { PageWrapper } from "@/components/layout/PageWrapper"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { apiClient } from "@/lib/api-client"
import { 
  Plus, 
  Minus, 
  Trash2, 
  ShoppingCart,
  Tag,
  MapPin,
  Clock
} from "lucide-react"

export default function CartPage() {
  const [cartItems, setCartItems] = useState([
    {
      id: "1",
      name: "Margherita Pizza",
      price: 250,
      quantity: 2,
      image: "/placeholder-pizza.jpg",
      specialRequests: "Extra cheese"
    },
    {
      id: "2",
      name: "Caesar Salad",
      price: 180,
      quantity: 1,
      image: "/placeholder-salad.jpg",
      specialRequests: ""
    }
  ])

  const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  const tax = subtotal * 0.18
  const total = subtotal + tax

  const updateQuantity = (id: string, newQuantity: number) => {
    if (newQuantity === 0) {
      setCartItems(cartItems.filter(item => item.id !== id))
    } else {
      setCartItems(cartItems.map(item => 
        item.id === id ? { ...item, quantity: newQuantity } : item
      ))
    }
  }

  return (
    <PageWrapper title="Your Cart" subtitle="Review and manage your order">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cart Items */}
        <div className="lg:col-span-2">
          <Card className="p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Order Summary</h2>
            
            {cartItems.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto flex items-center justify-center mb-4">
                  <ShoppingCart className="text-gray-400" size={32} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Your cart is empty</h3>
                <p className="text-gray-500 mb-6">Add delicious items from the menu</p>
                <Button>Explore Menu</Button>
              </div>
            ) : (
              <div className="space-y-4">
                {cartItems.map((item) => (
                  <motion.div 
                    key={item.id}
                    className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover rounded-lg" />
                    </div>
                    
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{item.name}</h3>
                      {item.specialRequests && (
                        <p className="text-sm text-gray-500 mt-1">Note: {item.specialRequests}</p>
                      )}
                      <p className="font-bold text-gray-900 mt-2">Rs {item.price}</p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      >
                        <Minus size={16} />
                      </Button>
                      <span className="w-8 text-center font-medium">{item.quantity}</span>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      >
                        <Plus size={16} />
                      </Button>
                    </div>
                    
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => updateQuantity(item.id, 0)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </motion.div>
                ))}
              </div>
            )}
          </Card>
        </div>
        
        {/* Order Summary */}
        <div className="lg:col-span-1">
          <Card className="p-6 sticky top-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Order Summary</h2>
            
            <div className="space-y-3 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-medium">Rs {subtotal}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Tax (18%)</span>
                <span className="font-medium">Rs {tax.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-base font-bold">
                <span>Total</span>
                <span>Rs {total.toFixed(2)}</span>
              </div>
            </div>
            
            <div className="mb-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                <MapPin size={16} />
                <span>Delivery Address</span>
              </div>
              <div className="text-sm font-medium">
                123 Main Street, City
              </div>
            </div>
            
            <div className="mb-6">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                <Clock size={16} />
                <span>Estimated Delivery</span>
              </div>
              <div className="text-sm font-medium">
                30-45 minutes
              </div>
            </div>
            
            <Button className="w-full mb-3">
              Proceed to Checkout
            </Button>
            
            <Button variant="outline" className="w-full">
              Add Promo Code
            </Button>
          </Card>
        </div>
      </div>
    </PageWrapper>
  )
}