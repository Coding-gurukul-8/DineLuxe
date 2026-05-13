"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { useQuery } from "@tanstack/react-query"
import { PageWrapper } from "@/components/layout/PageWrapper"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { apiClient } from "@/lib/api-client"
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  CreditCard, 
  Star,
  Calendar,
  Edit,
  Check
} from "lucide-react"

export default function CustomerProfilePage() {
  const [activeTab, setActiveTab] = "profile"
  const { data: profile, isLoading } = useQuery({
    queryKey: ["customer", "profile"],
    queryFn: () => apiClient.get("/profile/me")
  })

  const { data: preferences } = useQuery({
    queryKey: ["customer", "preferences"],
    queryFn: () => apiClient.get("/preferences/me")
  })

  return (
    <PageWrapper title="Your Profile" subtitle="Manage your account settings">
      <div className="space-y-6">
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-900">Profile Information</h3>
              <p className="text-gray-500">Manage your personal information and preferences</p>
            </div>
            <Button variant="outline" onClick={() => setActiveTab("edit")}>
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Full Name
                </Label>
                <Input id="name" defaultValue={profile?.name || "Customer"} className="mt-1" />
              </div>
              
              <div>
                <Label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email
                </Label>
                <Input id="email" defaultValue={profile?.email || "customer@example.com"} className="mt-1" />
              </div>
              
              <div>
                <Label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                  Phone Number
                </Label>
                <Input id="phone" defaultValue="+91 9876543210" className="mt-1" />
              </div>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3">Loyalty Points</h4>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Star className="text-yellow-500" />
                  <span className="ml-2 font-medium">1,250 points</span>
                </div>
                <div className="text-sm text-gray-500">
                  Next reward in: 50 points
                </div>
              </div>
              <div className="mt-4">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-400 rounded-full" style={{ width: "60%" }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Order History</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center pb-2">
            <div>
              <div className="font-medium">Recent Orders</div>
              <div className="text-sm text-gray-500">View your recent orders and favorites</div>
            </div>
            <Button variant="outline">View All Orders</Button>
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}