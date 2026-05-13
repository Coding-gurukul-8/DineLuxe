"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  TrendingUp, 
  Users, 
  Store, 
  BarChart3,
  AlertTriangle,
  CheckCircle,
  XCircle
} from "lucide-react"

interface KPI {
  id: string
  title: string
  value: string | number
  change: string
  changeType: 'positive' | 'negative'
  icon: React.ReactNode
}

export function AdminDashboard() {
  const kpis = [
    {
      id: "revenue",
      title: "Total Revenue",
      value: "Rs 2,450,000",
      change: "+12% from last month",
      changeType: "positive" as const,
      icon: <TrendingUp className="text-blue-500" size={24} />
    },
    {
      id: "restaurants",
      title: "Active Restaurants",
      value: "142",
      change: "+5% from last month",
      changeType: "positive" as const,
      icon: <Store className="text-green-500" size={24} />
    },
    {
      id: "users",
      title: "Registered Users",
      value: "8,742",
      change: "+8% from last month",
      changeType: "positive" as const,
      icon: <Users className="text-purple-500" />
    },
    {
      id: "orders",
      title: "Total Orders",
      value: "12,450",
      change: "+3% from last month",
      changeType: "positive" as const,
      icon: <BarChart3 className="text-orange-500" />
    }
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Admin Dashboard</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {kpis.map((kpi) => (
            <Card key={kpi.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-500">{kpi.title}</div>
                  <div className="text-2xl font-bold text-gray-900">{kpi.value}</div>
                  <div className="text-sm text-gray-500">{kpi.change}</div>
                </div>
                <div className="p-2 bg-gray-100 rounded-lg">
                  {kpi.icon}
                </div>
              </div>
            </          </div>
        </div>
      </div>
    </Card>
  )
}

export function AdminDashboard() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Admin Dashboard</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4">Platform Overview</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-500">Total Revenue</div>
                  <div className="text-2xl font-bold text-gray-900">Rs 2,450,000</div>
                  <div className="text-sm text-gray-500">+12% from last month</div>
                </div>
                
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-500">Active Restaurants</div>
                  <div className="text-2xl font-bold text-gray-900">142</div>
                  <div className="text-sm text-gray-500">+5% from last month</div>
                </div>
                
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-500">Registered Users</div>
                  <div className="text-2xl font-bold text-gray-900">8,742</div>
                  <div className="text-sm text-gray-500">+8% from last month</div>
                </div>
                
                <div className="bg-orange-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-500">Total Orders</div>
                  <div className="text-2xl font-bold text-gray-900">12,450</div>
                  <div className="text-sm text-gray-500">+3% from last month</div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}