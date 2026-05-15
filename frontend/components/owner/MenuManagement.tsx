"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Edit,
  Save,
  X,
  Plus,
  Trash2,
  GripVertical,
  Image as ImageIcon
} from "lucide-react"

interface MenuItem {
  id: string
  name: string
  description: string
  price: number
  category: string
  isAvailable: boolean
  photoUrl?: string
}

interface MenuCategory {
  id: string
  name: string
  items: MenuItem[]
}

export function MenuManagement() {
  const [categories, setCategories] = useState<MenuCategory[]>([
    {
      id: "1",
      name: "Appetizers",
      items: [
        {
          id: "1",
          name: "Caesar Salad",
          description: "Fresh romaine lettuce with caesar dressing",
          price: 180,
          category: "Appetizers",
          isAvailable: true
        },
        {
          id: "2",
          name: "Garlic Bread",
          description: "Toasted bread with garlic butter",
          price: 120,
          category: "Appetizers",
          isAvailable: true
        }
      ]
    },
    {
      id: "2",
      name: "Main Course",
      items: [
        {
          id: "3",
          name: "Margherita Pizza",
          description: "Classic pizza with tomato sauce and mozzarella",
          price: 250,
          category: "Main Course",
          isAvailable: true
        }
      ]
    }
  ])
  
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editItemForm, setEditItemForm] = useState<MenuItem | null>(null)
  const [showAddItemForm, setShowAddItemForm] = useState(false)
  const [newItem, setNewItem] = useState<Omit<MenuItem, 'id'>>({
    name: "",
    description: "",
    price: 0,
    category: "Appetizers",
    isAvailable: true
  })

  const handleEditItem = (item: MenuItem) => {
    setEditingItemId(item.id)
    setEditItemForm({ ...item })
  }

  const handleSaveItem = () => {
    if (editItemForm && editingItemId) {
      setCategories(categories.map(cat => ({
        ...cat,
        items: cat.items.map(item => 
          item.id === editingItemId ? { ...editItemForm } : item
        )
      })))
      setEditingItemId(null)
      setEditItemForm(null)
    }
  }

  const handleCancelEdit = () => {
    setEditingItemId(null)
    setEditItemForm(null)
  }

  const handleAddItem = () => {
    const newItemWithId = {
      ...newItem,
      id: `item-${Date.now()}`
    }
    
    // Add to appropriate category
    setCategories(categories.map(cat => 
      cat.name === newItem.category 
        ? { ...cat, items: [...cat.items, newItemWithId] } 
        : cat
    ))
    
    setShowAddItemForm(false)
    setNewItem({
      name: "",
      description: "",
      price: 0,
      category: "Appetizers",
      isAvailable: true
    })
  }

  const handleDeleteItem = (itemId: string) => {
    setCategories(categories.map(cat => ({
      ...cat,
      items: cat.items.filter(item => item.id !== itemId)
    })))
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-gray-900">Menu Management</h3>
        <Button onClick={() => setShowAddItemForm(true)} className="flex items-center gap-2">
          <Plus size={16} />
          Add Item
        </Button>
      </div>

      {showAddItemForm && (
        <motion.div
          className="bg-white rounded-lg p-6 shadow border border-gray-200"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h4 className="font-bold text-md mb-4">Add New Menu Item</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="newItemName" className="block text-sm font-medium text-gray-700 mb-1">
                Item Name
              </Label>
              <Input
                id="newItemName"
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                placeholder="Enter item name"
              />
            </div>
            
            <div>
              <Label htmlFor="newItemPrice" className="block text-sm font-medium text-gray-700 mb-1">
                Price (Rs)
              </Label>
              <Input
                id="newItemPrice"
                type="number"
                value={newItem.price}
                onChange={(e) => setNewItem({ ...newItem, price: parseFloat(e.target.value) || 0 })}
                placeholder="Enter price"
              />
            </div>
            
            <div>
              <Label htmlFor="newItemCategory" className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </Label>
              <select
                id="newItemCategory"
                value={newItem.category}
                onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="Appetizers">Appetizers</option>
                <option value="Main Course">Main Course</option>
                <option value="Desserts">Desserts</option>
                <option value="Beverages">Beverages</option>
              </select>
            </div>
            
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-1">
                Availability
              </Label>
              <select
                value={newItem.isAvailable ? "available" : "unavailable"}
                onChange={(e) => setNewItem({ ...newItem, isAvailable: e.target.value === "available" })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="available">Available</option>
                <option value="unavailable">Unavailable</option>
              </select>
            </div>
            
            <div className="md:col-span-2">
              <Label htmlFor="newItemDescription" className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </Label>
              <Input
                id="newItemDescription"
                value={newItem.description}
                onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                placeholder="Enter item description"
              />
            </div>
          </div>
          
          <div className="flex gap-2 pt-4">
            <Button onClick={handleAddItem} className="flex items-center gap-2">
              <Save size={16} />
              Add Item
            </Button>
            <Button variant="outline" onClick={() => setShowAddItemForm(false)} className="flex items-center gap-2">
              <X size={16} />
              Cancel
            </Button>
          </div>
        </motion.div>
      )}

      <div className="space-y-8">
        {categories.map((category) => (
          <div key={category.id}>
            <h4 className="text-md font-bold text-gray-900 mb-4">{category.name}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {category.items.map((item) => (
                <motion.div
                  key={item.id}
                  className="bg-white rounded-lg p-4 shadow border border-gray-200"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {editingItemId === item.id && editItemForm ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 cursor-move text-gray-400">
                        <GripVertical size={16} />
                        <span className="font-medium">Drag to reorder</span>
                      </div>
                      
                      <div className="space-y-2">
                        <Input
                          value={editItemForm.name}
                          onChange={(e) => setEditItemForm({ ...editItemForm, name: e.target.value })}
                          placeholder="Item name"
                          className="font-medium"
                        />
                        <Input
                          value={editItemForm.description}
                          onChange={(e) => setEditItemForm({ ...editItemForm, description: e.target.value })}
                          placeholder="Description"
                          className="text-sm"
                        />
                        <Input
                          type="number"
                          value={editItemForm.price}
                          onChange={(e) => setEditItemForm({ ...editItemForm, price: parseFloat(e.target.value) || 0 })}
                          placeholder="Price"
                          className="w-24"
                        />
                      </div>
                      
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          onClick={handleSaveItem}
                          className="flex items-center gap-1"
                        >
                          <Save size={14} />
                          Save
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={handleCancelEdit}
                          className="flex items-center gap-1"
                        >
                          <X size={14} />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h5 className="font-medium">{item.name}</h5>
                          <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleEditItem(item)}
                            className="p-1"
                          >
                            <Edit size={14} />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-1 text-red-500"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-lg">Rs {item.price}</span>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          item.isAvailable 
                            ? "bg-green-100 text-green-800" 
                            : "bg-gray-100 text-gray-800"
                        }`}>
                          {item.isAvailable ? "Available" : "Unavailable"}
                        </span>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}