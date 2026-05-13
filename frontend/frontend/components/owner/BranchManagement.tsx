"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  MapPin, 
  Phone, 
  Clock,
  User,
  Edit,
  Save,
  X
} from "lucide-react"

interface Branch {
  id: string
  name: string
  address: string
  phone: string
  manager: string
  status: 'active' | 'inactive'
  openingHours: string
}

export function BranchManagement() {
  const [branches, setBranches] = useState<Branch[]>([
    {
      id: "1",
      name: "DineLuxe Main Branch",
      address: "123 Main Street, City Center",
      phone: "+91 9876543210",
      manager: "John Manager",
      status: "active",
      openingHours: "10:00 AM - 11:00 PM"
    },
    {
      id: "2",
      name: "DineLuxe West Branch",
      address: "456 West Avenue, West District",
      phone: "+91 9876543211",
      manager: "Sarah Johnson",
      status: "active",
      openingHours: "11:00 AM - 10:00 PM"
    }
  ])
  
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Branch | null>(null)

  const handleEdit = (branch: Branch) => {
    setEditingId(branch.id)
    setEditForm({ ...branch })
  }

  const handleSave = () => {
    if (editForm && editingId) {
      setBranches(branches.map(b => 
        b.id === editingId ? { ...editForm } : b
      ))
      setEditingId(null)
      setEditForm(null)
    }
  }

  const handleCancel = () => {
    setEditingId(null)
    setEditForm(null)
  }

  return (
    <div className="space-y-4">
      {branches.map((branch) => (
        <motion.div
          key={branch.id}
          className="bg-white rounded-lg p-6 shadow border border-gray-200"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {editingId === branch.id && editForm ? (
            <div className="space-y-4">
              <h3 className="font-bold text-lg">Edit Branch</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Branch Name
                  </Label>
                  <Input
                    id="name"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="manager" className="block text-sm font-medium text-gray-700 mb-1">
                    Manager
                  </Label>
                  <Input
                    id="manager"
                    value={editForm.manager}
                    onChange={(e) => setEditForm({ ...editForm, manager: e.target.value })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                    Address
                  </Label>
                  <Input
                    id="address"
                    value={editForm.address}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </Label>
                  <Input
                    id="phone"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="hours" className="block text-sm font-medium text-gray-700 mb-1">
                    Opening Hours
                  </Label>
                  <Input
                    id="hours"
                    value={editForm.openingHours}
                    onChange={(e) => setEditForm({ ...editForm, openingHours: e.target.value })}
                  />
                </div>
                
                <div>
                  <Label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </Label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button onClick={handleSave} className="flex items-center gap-2">
                  <Save size={16} />
                  Save
                </Button>
                <Button variant="outline" onClick={handleCancel} className="flex items-center gap-2">
                  <X size={16} />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="font-bold text-lg">{branch.name}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    branch.status === 'active' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {branch.status}
                  </span>
                </div>
                
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <MapPin size={16} />
                    <span>{branch.address}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone size={16} />
                    <span>{branch.phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User size={16} />
                    <span>{branch.manager}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={16} />
                    <span>{branch.openingHours}</span>
                  </div>
                </div>
              </div>
              
              <Button 
                variant="outline" 
                onClick={() => handleEdit(branch)}
                className="flex items-center gap-2"
              >
                <Edit size={16} />
                Edit
              </Button>
            </div>
          )}
        </motion.div>
      ))}
    </div>
  )
}