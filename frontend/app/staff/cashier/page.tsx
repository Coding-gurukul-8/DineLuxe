"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { PageWrapper } from "@/components/layout/PageWrapper"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  CreditCard, 
  IndianRupee,
  Printer,
  QrCode,
  Calendar,
  User,
  ShoppingCart,
  Plus,
  Minus,
  Check
} from "lucide-react"

interface OrderItem {
  id: string
  name: string
  price: number
  quantity: number
  total: number
}

interface PaymentMethod {
  id: string
  name: string
  icon: React.ReactNode
}

export default function CashierPOSPage() {
  const [orderItems, setOrderItems] = useState<OrderItem[]>([
    { id: "1", name: "Margherita Pizza", price: 250, quantity: 2, total: 500 },
    { id: "2", name: "Caesar Salad", price: 180, quantity: 1, total: 180 },
    { id: "3", name: "Garlic Bread", price: 120, quantity: 1, total: 120 }
  ])
  
  const [paymentMethod, setPaymentMethod] = useState("cash")
  const [amountReceived, setAmountReceived] = useState("")
  
  const paymentMethods: PaymentMethod[] = [
    { id: "cash", name: "Cash", icon: <IndianRupee size={20} /> },
    { id: "card", name: "Card", icon: <CreditCard size={20} /> },
    { id: "upi", name: "UPI", icon: <QrCode size={20} /> }
  ]
  
  const subtotal = orderItems.reduce((sum, item) => sum + item.total, 0)
  const tax = subtotal * 0.05 // 5% tax
  const total = subtotal + tax
  
  const amountReceivedNum = parseFloat(amountReceived) || 0
  const change = amountReceivedNum - total

  const printReceipt = () => {
    // In a real implementation, this would print the receipt
    console.log("Printing receipt...")
  }

  return (
    <PageWrapper title="Cashier POS" subtitle="Process payments and print receipts">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Summary */}
        <div className="lg:col-span-2 bg-white rounded-lg p-6 shadow">
          <h3 className="font-bold text-lg mb-4">Order #ORD-2023-001</h3>
          
          <div className="flex items-center gap-3 mb-6 p-3 bg-gray-50 rounded-lg">
            <div className="p-2 bg-blue-100 rounded-full">
              <User className="text-blue-600" size={20} />
            </div>
            <div>
              <div className="font-medium">John Smith</div>
              <div className="text-sm text-gray-500">Table 5</div>
            </div>
            <div className="ml-auto text-sm text-gray-500">
              <Calendar className="inline mr-1" size={14} />
              {new Date().toLocaleDateString()}
            </div>
          </div>
          
          <div className="space-y-3 mb-6">
            {orderItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 border-b border-gray-100">
                <div>
                  <div className="font-medium">{item.name}</div>
                  <div className="text-sm text-gray-500">Qty: {item.quantity}</div>
                </div>
                <div className="text-right">
                  <div className="font-medium">Rs {item.total}</div>
                  <div className="text-sm text-gray-500">Rs {item.price} each</div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="space-y-2 p-4 bg-gray-50 rounded-lg">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium">Rs {subtotal}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Tax (5%)</span>
              <span className="font-medium">Rs {tax}</span>
            </div>
            <div className="flex justify-between border-t border-gray-300 pt-2 mt-2">
              <span className="font-bold">Total</span>
              <span className="font-bold text-lg">Rs {total}</span>
            </div>
          </div>
        </div>
        
        {/* Payment Section */}
        <div className="bg-white rounded-lg p-6 shadow">
          <h3 className="font-bold text-lg mb-4">Payment</h3>
          
          <div className="space-y-4">
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Method
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {paymentMethods.map((method) => (
                  <Button
                    key={method.id}
                    variant={paymentMethod === method.id ? "primary" : "outline"}
                    onClick={() => setPaymentMethod(method.id)}
                    className="flex flex-col items-center justify-center h-16"
                  >
                    {method.icon}
                    <span className="text-xs mt-1">{method.name}</span>
                  </Button>
                ))}
              </div>
            </div>
            
            <div>
              <Label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
                Amount Received
              </Label>
              <Input
                id="amount"
                type="number"
                value={amountReceived}
                onChange={(e) => setAmountReceived(e.target.value)}
                className="text-lg"
                placeholder="0.00"
              />
            </div>
            
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Total</span>
                <span className="font-medium">Rs {total}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Received</span>
                <span className="font-medium">Rs {amountReceived || 0}</span>
              </div>
              <div className="flex justify-between font-bold border-t border-gray-300 pt-2 mt-2">
                <span>Change</span>
                <span className={change >= 0 ? "text-green-600" : "text-red-600"}>
                  Rs {change >= 0 ? change : 0}
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <Button 
                variant="outline" 
                onClick={printReceipt}
                className="flex items-center justify-center gap-2"
              >
                <Printer size={16} />
                Print Bill
              </Button>
              <Button 
                className="flex items-center justify-center gap-2"
                disabled={!amountReceived || change < 0}
              >
                <Check size={16} />
                Complete
              </Button>
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}