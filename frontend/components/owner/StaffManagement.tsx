"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Mail, Phone, User, Edit, Save, X, Plus, Trash2 } from "lucide-react"

interface StaffMember {
  id: string
  name: string
  email: string
  phone: string
  role: "manager" | "chef" | "server" | "cashier"
  status: "active" | "inactive"
}

export function StaffManagement() {
  const [staff, setStaff] = useState<StaffMember[]>([
    {
      id: "1",
      name: "Ayesha Sharma",
      email: "ayesha@dineluxe.com",
      phone: "+91 9876543210",
      role: "manager",
      status: "active"
    },
    {
      id: "2",
      name: "Rohan Patel",
      email: "rohan@dineluxe.com",
      phone: "+91 9876543211",
      role: "chef",
      status: "active"
    }
  ])

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<StaffMember | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newStaff, setNewStaff] = useState<Omit<StaffMember, "id">>({
    name: "",
    email: "",
    phone: "",
    role: "server",
    status: "active"
  })

  const handleEdit = (member: StaffMember) => {
    setEditingId(member.id)
    setEditForm({ ...member })
  }

  const handleSave = () => {
    if (!editForm || !editingId) return
    setStaff(staff.map(member => member.id === editingId ? { ...editForm } : member))
    setEditingId(null)
    setEditForm(null)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditForm(null)
  }

  const handleDelete = (memberId: string) => {
    setStaff(staff.filter(member => member.id !== memberId))
  }

  const handleAdd = () => {
    const newMember: StaffMember = {
      ...newStaff,
      id: `staff-${Date.now()}`
    }
    setStaff([...staff, newMember])
    setShowAddForm(false)
    setNewStaff({
      name: "",
      email: "",
      phone: "",
      role: "server",
      status: "active"
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900">Staff Management</h3>
        <Button onClick={() => setShowAddForm(true)} className="flex items-center gap-2">
          <Plus size={16} />
          Add Staff
        </Button>
      </div>

      {showAddForm && (
        <motion.div
          className="bg-white rounded-lg p-6 shadow border border-gray-200"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h4 className="font-bold text-md mb-4">Add New Staff Member</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="newName" className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </Label>
              <Input
                id="newName"
                value={newStaff.name}
                onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                placeholder="Enter full name"
              />
            </div>
            <div>
              <Label htmlFor="newEmail" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </Label>
              <Input
                id="newEmail"
                type="email"
                value={newStaff.email}
                onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                placeholder="Enter email"
              />
            </div>
            <div>
              <Label htmlFor="newPhone" className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </Label>
              <Input
                id="newPhone"
                value={newStaff.phone}
                onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                placeholder="Enter phone"
              />
            </div>
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </Label>
              <select
                value={newStaff.role}
                onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value as StaffMember["role"] })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="manager">Manager</option>
                <option value="chef">Chef</option>
                <option value="server">Server</option>
                <option value="cashier">Cashier</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={handleAdd} className="flex items-center gap-2">
              <Save size={16} />
              Add Staff
            </Button>
            <Button variant="outline" onClick={() => setShowAddForm(false)} className="flex items-center gap-2">
              <X size={16} />
              Cancel
            </Button>
          </div>
        </motion.div>
      )}

      <div className="space-y-4">
        {staff.map((member) => (
          <motion.div
            key={member.id}
            className="bg-white rounded-lg p-6 shadow border border-gray-200"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {editingId === member.id && editForm ? (
              <div className="space-y-4">
                <h4 className="font-bold text-md">Edit Staff Member</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="editName" className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name
                    </Label>
                    <Input
                      id="editName"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="editEmail" className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </Label>
                    <Input
                      id="editEmail"
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="editPhone" className="block text-sm font-medium text-gray-700 mb-1">
                      Phone
                    </Label>
                    <Input
                      id="editPhone"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="block text-sm font-medium text-gray-700 mb-1">
                      Role
                    </Label>
                    <select
                      value={editForm.role}
                      onChange={(e) => setEditForm({ ...editForm, role: e.target.value as StaffMember["role"] })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="manager">Manager</option>
                      <option value="chef">Chef</option>
                      <option value="server">Server</option>
                      <option value="cashier">Cashier</option>
                    </select>
                  </div>
                  <div>
                    <Label className="block text-sm font-medium text-gray-700 mb-1">
                      Status
                    </Label>
                    <select
                      value={editForm.status}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value as StaffMember["status"] })}
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
                  <Button variant="outline" onClick={handleCancelEdit} className="flex items-center gap-2">
                    <X size={16} />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h4 className="font-bold text-md">{member.name}</h4>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      member.status === "active"
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}>
                      {member.status}
                    </span>
                    <span className="text-xs text-gray-500 capitalize">{member.role}</span>
                  </div>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <User size={16} />
                      <span>{member.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail size={16} />
                      <span>{member.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone size={16} />
                      <span>{member.phone}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleEdit(member)}
                    className="flex items-center gap-2"
                  >
                    <Edit size={16} />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleDelete(member.id)}
                    className="flex items-center gap-2"
                  >
                    <Trash2 size={16} />
                    Remove
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  )
}