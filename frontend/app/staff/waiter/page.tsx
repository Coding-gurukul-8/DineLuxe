"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { PageWrapper } from "@/components/layout/PageWrapper"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  User, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Check,
  Clock,
  Table,
  Search
} from "lucide-react"

interface Table {
  id: string
  number: string
  status: 'free' | 'occupied' | 'reserved'
  currentOrder?: {
    id: string
    items: any[]
    total: number
    time: string
  }
}

interface MenuItem {
  id: string
  name: string
  price: number
  category: string
}

export default function WaiterInterfacePage() {
  const [activeTable, setActiveTable] = useState<Table | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [cart, setCart] = useState<any[]>([])
  
  // Mock data
  const tables: Table[] = [
    { id: "1", number: "1", status: "occupied", currentOrder: { id: "101", items: [], total: 1250, time: "7:30 PM" } },
    { id: "2", number: "2", status: "free" },
    { id: "3", number: "3", status: "occupied", currentOrder: { id: "102", items: [], total: 890, time: "8:15 PM" } },
    { id: "4", number: "4", status: "free" },
    { id: "5", number: "5", status: "reserved" }
  ]
  
  const menuItems: MenuItem[] = [
    { id: "1", name: "Margherita Pizza", price: 250, category: "Main Course" },
    { id: "2", name: "Caesar Salad", price: 180, category: "Appetizer" },
    { id: "3", name: "Grilled Chicken", price: 320, category: "Main Course" },
    { id: "4", name: "Garlic Bread", price: 120, category: "Appetizer" }
  ]

  const addToCart = (item: MenuItem) => {
    setCart([...cart, { ...item, quantity: 1 }])
  }

  const updateQuantity = (id: string, change: number) => {
    setCart(cart.map(item => 
      item.id === id 
        ? { ...item, quantity: Math.max(1, item.quantity + change) }
        : item
    ))
  }

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id))
  }

  const getTotal = () => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  }

  return (
    <PageWrapper title="Waiter Dashboard" subtitle="Manage tables and take orders">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table Selection */}
        <div className="bg-white rounded-lg p-4 shadow">
          <h3 className="font-bold text-lg mb-4">Tables</h3>
          <div className="grid grid-cols-2 gap-3">
            {tables.map((table) => (
              <motion.div
                key={table.id}
                className={`p-3 rounded-lg border cursor-pointer text-center ${
                  activeTable?.id === table.id 
                    ? "border-brand-primary bg-brand-primary/10" 
                    : table.status === "occupied"
                    ? "border-red-500 bg-red-50"
                    : table.status === "free"
                    ? "border-green-500 bg-green-50"
                    : "border-yellow-500 bg-yellow-50"
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveTable(table)}
              >
                <div className="font-bold">Table {table.number}</div>
                <div className="text-sm">
                  {table.status === "occupied" ? "Occupied" : 
                   table.status === "free" ? "Free" : "Reserved"}
                </div>
                {table.currentOrder && (
                  <div className="text-xs text-gray-500 mt-1">
                    Rs {table.currentOrder.total}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>

        {/* Menu Items */}
        <div className="bg-white rounded-lg p-4 shadow">
          <h3 className="font-bold text-lg mb-4">Menu</h3>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <Input
              type="text"
              placeholder="Search menu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-gray-50"
            />
          </div>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {menuItems.map((item) => (
              <motion.div
                key={item.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                whileHover={{ backgroundColor: "#f0f0f0" }}
              >
                <div>
                  <div className="font-medium">{item.name}</div>
                  <div className="text-sm text-gray-500">{item.category}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">Rs {item.price}</span>
                  <Button 
                    size="sm" 
                    onClick={() => addToCart(item)}
                    className="flex items-center gap-1"
                  >
                    <Plus size={14} />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Order Management */}
        <div className="bg-white rounded-lg p-4 shadow">
          <h3 className="font-bold text-lg mb-4">
            {activeTable ? `Table ${activeTable.number} Order` : "Select a Table"}
          </h3>
          
          {activeTable && (
            <div>
              <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                {cart.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-sm text-gray-500">Rs {item.price}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => updateQuantity(item.id, -1)}
                      >
                        <Minus size={14} />
                      </Button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => updateQuantity(item.id, 1)}
                      >
                        <Plus size={14} />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => removeFromCart(item.id)}
                        className="text-red-500"
                      >
                        <Minus size={14} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="border-t pt-3">
                <div className="flex justify-between font-bold text-lg mb-3">
                  <span>Total:</span>
                  <span>Rs {getTotal()}</span>
                </div>
                <Button className="w-full" disabled={cart.length === 0}>
                  <Check className="mr-2" size={16} />
                  Place Order
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  )
}