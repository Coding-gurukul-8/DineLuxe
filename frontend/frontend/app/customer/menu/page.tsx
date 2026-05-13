"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useQuery } from "@tanstack/react-query"
import { PageWrapper } from "@/components/layout/PageWrapper"
import { FoodCard } from "@/components/customer/FoodCard"
import { Search, SlidersHorizontal } from "lucide-react"
import { apiClient } from "@/lib/api-client"
import { useCart } from "@/hooks/useCart"

export default function CustomerMenuPage() {
  const [activeCategory, setActiveCategory] = useState("All")
  const [searchQuery, setSearchQuery] = useState("")
  const branchId = useCart((state) => state.branchId) ?? ""

  const { data: categories = [] } = useQuery({
    queryKey: ["menu", "categories", branchId],
    queryFn: () => apiClient.get<any[]>(`/menu/branch/${branchId}/categories`),
    enabled: !!branchId,
  })

  const { data: menuItems = [], isLoading } = useQuery({
    queryKey: ["menu", "items", branchId, activeCategory],
    queryFn: () => {
      const catParam = activeCategory !== "All" ? `&category=${encodeURIComponent(activeCategory)}` : ""
      return apiClient.get<any[]>(`/menu/branch/${branchId}/items?${catParam}`)
    },
    enabled: !!branchId,
  })

  const allCategories = ["All", ...categories.map((c: any) => c.name)]

  const filteredItems = menuItems.filter((item: any) =>
    item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <PageWrapper title="Menu" subtitle="Explore our delicious offerings">
      {/* Search and Filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search menu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white rounded-xl border border-gray-200 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all text-sm"
          />
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <SlidersHorizontal size={20} />
        </motion.button>
      </div>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
        {allCategories.map((category) => (
          <motion.button
            key={category}
            whileTap={{ scale: 0.95 }}
            onClick={() => setActiveCategory(category)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              activeCategory === category
                ? "bg-brand-primary text-white"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {category}
          </motion.button>
        ))}
      </div>

      {/* Menu Items */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading menu…</div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCategory + searchQuery}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {filteredItems.map((item: any, index: number) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <FoodCard item={item} />
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      )}

      {!isLoading && filteredItems.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No items found</p>
        </div>
      )}
    </PageWrapper>
  )
}
