"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RoleBadge } from "@/components/shared/RoleBadge"
import { 
  User, 
  Mail, 
  Phone,
  Edit,
  Save,
  X,
  Plus
} from "lucide-react"

interface StaffMember {
  id: string
  name: string
  email: string
  phone: string
  role: string
  status: 'active' | 'inactive'
  hireDate: string
}

export function StaffManagement() {
  const [staff, setStaff] = useState<StaffMember[]>([
    {
      id: "1",
      name: "John Manager",
      email: "john.manager@dineluxe.com",
      phone: "+91 9876543210",
      role: "manager",
      status: "active",
      hireDate: "2023-01-15"
    },
    {
      id: "2",
      name: "Sarah Waiter",
      email: "sarah.waiter@dineluxe.com",
      phone: "+91 9876543211",
      role: "waiter",
      status: "active",
      hireDate: "2023-03-22"
    },
    {
      id: "3",
      name: "Mike Chef",
      email: "mike.chef@dineluxe.com",
      phone: "+91 9876543212",
      role: "chef",
      status: "active",
      hireDate: "2023-02-10"
    }
  ])
  
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<StaffMember | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newStaff, setNewStaff] = useState<Omit<StaffMember, 'id'>>({
    name: "",
    email: "",
    phone: "",
    role: "waiter",
    status: "active",
    hireDate: new Date().toISOString().split('T')[0]
  })

  const handleEdit = (staffMember: StaffMember) => {
    setEditingId(staffMember.id)
    setEditForm({ ...staffMember })
  }

  const handleSave = () => {
    if (editForm && editingId) {
      setStaff(staff.map(s => 
        s.id === editingId ? { ...editForm } : s
      ))
      setEditingId(null)
      setEditForm(null)
    }
  }

  const handleCancel = () => {
    setEditingId(null)
    setEditForm(null)
  }

  const handleAddStaff = () => {
    const newStaffWithId = {
      ...newStaff,
      id: `staff-${Date.now()}`
    }
    setStaff([...staff, newStaffWithId])
    setShowAddForm(false)
    setNewStaff({
      name: "",
      email: "",
      phone: "",
      role: "waiter",
      status: "active",
      hireDate: new Date().toISOString().split('T')[0]
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
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
                placeholder="Enter phone number"
              />
            </div>
            
            <div>
              <Label htmlFor="newRole" className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </Label>
              <select
                id="newRole"
                value={newStaff.role}
                onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="manager">Manager</option>
                <option value="waiter">Waiter</option>
                <option value="chef">Chef</option>
                <option value="cashier">Cashier</option>
                <option value="host">Host</option>
              </select>
            </div>
            
            <div>
              <Label htmlFor="newHireDate" className="block text-sm font-medium text-gray-700 mb-1">
                Hire Date
              </Label>
              <Input
                id="newHireDate"
                type="date"
                value={newStaff.hireDate}
                onChange={(e) => setNewStaff({ ...newStaff, hireDate: e.target.value })}
              />
            </div>
            
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </Label>
              <select
                value={newStaff.status}
                onChange={(e) => setNewStaff({ ...newStaff, status: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          
          <div className="flex gap-2 pt-4">
            <Button onClick={handleAddStaff} className="flex items-center gap-2">
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
        {staff.map((staffMember) => (
          <motion.div
            key={staffMember.id}
            className="bg-white rounded-lg p-6 shadow border border-gray-200"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {editingId === staffMember.id && editForm ? (
              <div className="space-y-4">
                <h4 className="font-bold text-md">Edit Staff Member</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor={`name-${staffMember.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name
                    </Label>
                    <Input
                      id={`name-${staffMember.id}`}
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor={`email-${staffMember.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </Label>
                    <Input
                      id={`email-${staffMember.id}`}
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor={`phone-${staffMember.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                      Phone
                    </Label>
                    <Input
                      id={`phone-${staffMember.id}`}
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor={`role-${staffMember.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                      Role
                    </Label>
                    <select
                      id={`role-${staffMember.id}`}
                      value={editForm.role}
                      onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="manager">Manager</option>
                      <option value="waiter">Waiter</option>
                      <option value="chef">Chef</option>
                      <option value="cashier">Cashier</option>
                      <option value="host">Host</option>
                    </select>
                  </div>
                  
                  <div>
                    <Label htmlFor={`hireDate-${staffMember.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                      Hire Date
                    </Label>
                    <Input
                      id={`hireDate-${staffMember.id}`}
                      type="date"
                      value={editForm.hireDate}
                      onChange={(e) => setEditForm({ ...editForm, hireDate: e.target.value })}
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
                    <h4 className="font-bold text-md">{staffMember.name}</h4>
                    <RoleBadge role={staffMember.role} />
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      staffMember.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {staffMember.status}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Mail size={16} />
                        <span>{staffMember.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone size={16} />
                        <span>{staffMember.phone}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <User size={16} />
                        <span>Hired: {new Date(staffMember.hireDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <Button 
                  variant="outline" 
                  onClick={() => handleEdit(staffMember)}
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
    </div>
  )
}