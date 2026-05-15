"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { PageWrapper } from "@/components/layout/PageWrapper"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/hooks/useAuth"
import { formatTime } from "@/lib/utils"
import { 
  Users, 
  Clock, 
  UserPlus,
  Phone,
  Calendar,
  Plus,
  Minus
} from "lucide-react"

interface QueueItem {
  id: string
  name: string
  phone: string
  status: string
  time: string
}

interface QueueApiItem {
  id: string
  guest_name?: string | null
  guest_phone?: string | null
  status?: string | null
  created_at?: string | null
  users?: { name?: string | null; phone?: string | null } | null
}

interface TableItem {
  id: string
  number: string
  capacity: number
  status: string
}

interface TableApiItem {
  id: string
  label?: string | null
  capacity?: number | null
  status?: string | null
}

const mapQueueItem = (item: QueueApiItem): QueueItem => ({
  id: item.id,
  name: item.guest_name ?? item.users?.name ?? "Guest",
  phone: item.guest_phone ?? item.users?.phone ?? "",
  status: item.status ?? "waiting",
  time: item.created_at ? formatTime(item.created_at) : ""
})

const mapTableItem = (table: TableApiItem): TableItem => ({
  id: table.id,
  number: table.label ?? "",
  capacity: table.capacity ?? 0,
  status: table.status ?? "free"
})

export default function HostInterfacePage() {
  const [partySize, setPartySize] = useState(2)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [tables, setTables] = useState<TableItem[]>([])
  const { branchId } = useAuth()

  const updateTableStatus = async (id: string, status: string) => {
    try {
      await apiClient.patch(`/tables/${id}/status`, { new_status: status })
      setTables(tables.map(table =>
        table.id === id ? { ...table, status } : table
      ))
    } catch {
      // Ignore table update errors for now
    }
  }

  useEffect(() => {
    if (!branchId) return

    const loadQueue = async () => {
      try {
        const result = await apiClient.get<{ data: QueueApiItem[] }>(`/queue/branch/${branchId}`)
        const items = result.data ?? []
        setQueue(items.map(mapQueueItem))
      } catch {
        // Ignore queue load errors
      }
    }

    const loadTables = async () => {
      try {
        const result = await apiClient.get<TableApiItem[]>(`/tables/branch/${branchId}`)
        setTables(result.map(mapTableItem))
      } catch {
        // Ignore table load errors
      }
    }

    loadQueue()
    loadTables()
  }, [branchId])

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