"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { PageWrapper } from "@/components/layout/PageWrapper"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Users, 
  Clock, 
  UserPlus,
  Phone,
  Calendar,
  Plus,
  Minus
} from "lucide-react"

export default function HostInterfacePage() {
  const [partySize, setPartySize] = useState(2)
  const [queue, setQueue] = useState<any[]>([
    { id: 1, name: "John Smith", phone: "+91 9876543210", status: "waiting", time: "7:30 PM" },
    { id: 2, name: "Sarah Johnson", phone: "+91 9876543211", status: "seated", time: "7:45 PM" },
    { id: 3, name: "Mike Wilson", phone: "+91 9876543212", status: "waiting", time: "8:00 PM" }
  ])
  const [tables, setTables] = useState([
    { id: 1, number: "1", capacity: 4, status: "free" },
    { id: 2, number: "2", capacity: 2, status: "occupied" },
    { id: 3, number: "3", capacity: 6, status: "free" },
    { id: 4, number: "4", capacity: 4, status: "free" },
    { id: 5, number: "5", capacity: 2, status: "free" }
  ])

  const updateQueueStatus = (id: number, status: string) => {
    // In a real app, this would update the queue status
    console.log("Updating queue status for:", id, "to:", status)
  }

  const updateTableStatus = (id: number, status: string) => {
    // In a real app, this would update the table status
    console.log("Updating table status for:", id, "to:", status)
    setTables(tables.map(table => 
      table.id === id ? { ...table, status } : table
    ))
  }

  return (
    <PageWrapper title="Host Dashboard" subtitle="Manage reservations and table assignments">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Queue Management */}
        <div className="bg-white rounded-lg p-4 shadow">
          <h3 className="font-bold text-lg mb-4">Walk-in Queue</h3>
          <div className="space-y-3">
            {queue.map((customer) => (
              <motion.div 
                key={customer.id}
                className="flex items-center justify-between p-3 border-b border-gray-100"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div>
                  <div className="font-medium">{customer.name}</div>
                  <div className="text-sm text-gray-500">{customer.phone}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`px-2 py-1 rounded ${
                    customer.status === 'seated' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {customer.status}
                  </div>
                  <span className="text-sm text-gray-500">{customer.time}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Table Map */}
        <div className="bg-white rounded-lg p-4 shadow">
          <h3 className="font-bold text-lg mb-4">Table Map</h3>
          <div className="grid grid-cols-2 gap-2">
            {tables.map((table) => (
              <div 
                key={table.id}
                className={`p-3 rounded border text-center cursor-pointer ${
                  table.status === 'free' ? 'border-green-500' : 'border-red-500'
                }`}
                onClick={() => updateTableStatus(table.id, table.status === 'free' ? 'occupied' : 'free')}
              >
                <div className="font-bold">Table {table.number}</div>
                <div className="text-sm text-gray-500">
                  {table.status === 'free' ? 'Available' : 'Occupied'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Party Management */}
        <div className="bg-white rounded-lg p-4 shadow">
          <h3 className="font-bold text-lg mb-4">Party Size</h3>
          <div className="flex items-center gap-4">
            <Button onClick={() => setPartySize(Math.max(1, partySize - 1))} disabled={partySize <= 1}>
              <Minus size={16} />
            </Button>
            <span className="text-lg font-bold">{partySize} guests</span>
            <Button onClick={() => setPartySize(partySize + 1)}>
              <Plus size={16} />
            </Button>
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}