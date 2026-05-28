"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/hooks/useAuth"
import { SkeletonCard } from "@/components/shared/SkeletonCard"
import {
  MapPin,
  Phone,
  Clock,
  User,
  Edit,
  Save,
  X,
  AlertCircle,
  ExternalLink,
} from "lucide-react"

// ── Types ─────────────────────────────────────────────────────────────────────

interface BranchApi {
  id: string
  name?: string | null
  address?: string | null
  phone?: string | null
  is_active?: boolean | null
  operating_hours?: unknown
  manager?: { name?: string | null } | null
}

interface Branch {
  id: string
  name: string
  address: string
  phone: string
  manager: string
  status: "active" | "inactive"
  openingHours: string
}

interface EditForm {
  name: string
  address: string
  phone: string
  manager: string
  openingHours: string
  status: "active" | "inactive"
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const mapBranch = (branch: BranchApi): Branch => ({
  id: branch.id,
  name: branch.name ?? "Unnamed branch",
  address: branch.address ?? "",
  phone: branch.phone ?? "",
  manager: branch.manager?.name ?? "Unassigned",
  status: branch.is_active ? "active" : "inactive",
  openingHours: branch.operating_hours ? "Configured" : "Not set",
})

// ── Query key ─────────────────────────────────────────────────────────────────

const branchesKey = (restaurantId: string) => ["branches", restaurantId]

// ── Main Component ────────────────────────────────────────────────────────────

export function BranchManagement() {
  const { restaurantId } = useAuth()
  const router = useRouter()
  const qc = useQueryClient()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)

  // ── Fetch all branches for the restaurant ──────────────────────────────────
  // GET /branches — backend filters by restaurantId from the JWT tenant context
  const {
    data: branchesRaw = [],
    isLoading,
    isError,
    error,
  } = useQuery<BranchApi[]>({
    queryKey: branchesKey(restaurantId ?? ""),
    queryFn: () => apiClient.get<BranchApi[]>("/branches"),
    enabled: !!restaurantId,
    staleTime: 30_000,
  })

  const branches = branchesRaw.map(mapBranch)

  // ── Edit / Save mutations ──────────────────────────────────────────────────

  const { mutate: saveBranch, isPending: isSaving } = useMutation({
    mutationFn: async ({
      id,
      form,
    }: {
      id: string
      form: EditForm
    }) => {
      await apiClient.patch(`/branches/${id}`, {
        name: form.name,
        address_line1: form.address,
      })
      await apiClient.patch(`/branches/${id}/status`, {
        status: form.status === "active" ? "active" : "closed",
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: branchesKey(restaurantId ?? "") })
      setEditingId(null)
      setEditForm(null)
    },
  })

  const handleEdit = (branch: Branch) => {
    setEditingId(branch.id)
    setEditForm({
      name: branch.name,
      address: branch.address,
      phone: branch.phone,
      manager: branch.manager,
      openingHours: branch.openingHours,
      status: branch.status,
    })
  }

  const handleSave = () => {
    if (!editForm || !editingId) return
    saveBranch({ id: editingId, form: editForm })
  }

  const handleCancel = () => {
    setEditingId(null)
    setEditForm(null)
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-4">
        <SkeletonCard variant="list-item" count={3} />
      </div>
    )
  }

  // ── Error ──────────────────────────────────────────────────────────────────

  if (isError) {
    return (
      <div className="flex items-center gap-2 px-4 py-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
        <AlertCircle size={16} className="shrink-0" />
        <span>
          Failed to load branches
          {error instanceof Error ? `: ${error.message}` : ""}. Please refresh.
        </span>
      </div>
    )
  }

  // ── Empty ──────────────────────────────────────────────────────────────────

  if (branches.length === 0) {
    return (
      <div className="py-16 text-center text-gray-400">
        <p className="text-sm">No branches found for your restaurant.</p>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

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
            /* ── Edit form ── */
            <div className="space-y-4">
              <h3 className="font-bold text-lg">Edit Branch</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label
                    htmlFor={`name-${branch.id}`}
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Branch Name
                  </Label>
                  <Input
                    id={`name-${branch.id}`}
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm({ ...editForm, name: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label
                    htmlFor={`manager-${branch.id}`}
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Manager
                  </Label>
                  <Input
                    id={`manager-${branch.id}`}
                    value={editForm.manager}
                    onChange={(e) =>
                      setEditForm({ ...editForm, manager: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label
                    htmlFor={`address-${branch.id}`}
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Address
                  </Label>
                  <Input
                    id={`address-${branch.id}`}
                    value={editForm.address}
                    onChange={(e) =>
                      setEditForm({ ...editForm, address: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label
                    htmlFor={`phone-${branch.id}`}
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Phone
                  </Label>
                  <Input
                    id={`phone-${branch.id}`}
                    value={editForm.phone}
                    onChange={(e) =>
                      setEditForm({ ...editForm, phone: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label
                    htmlFor={`hours-${branch.id}`}
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Opening Hours
                  </Label>
                  <Input
                    id={`hours-${branch.id}`}
                    value={editForm.openingHours}
                    onChange={(e) =>
                      setEditForm({ ...editForm, openingHours: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </Label>
                  <select
                    value={editForm.status}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        status: e.target.value as "active" | "inactive",
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2"
                >
                  <Save size={16} />
                  {isSaving ? "Saving…" : "Save"}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="flex items-center gap-2"
                >
                  <X size={16} />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            /* ── Read-only card ── */
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  {/* FIX: clicking the branch name navigates to /owner/branches/{id} */}
                  <button
                    onClick={() => router.push(`/owner/branches/${branch.id}`)}
                    className="font-bold text-lg text-[#1A3C5E] hover:underline flex items-center gap-1"
                  >
                    {branch.name}
                    <ExternalLink size={14} className="opacity-50" />
                  </button>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      branch.status === "active"
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {branch.status}
                  </span>
                </div>

                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <MapPin size={16} />
                    <span>{branch.address || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone size={16} />
                    <span>{branch.phone || "—"}</span>
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

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleEdit(branch)}
                  className="flex items-center gap-2"
                >
                  <Edit size={16} />
                  Edit
                </Button>
                {/* Full branch detail page link */}
                <Button
                  variant="outline"
                  onClick={() => router.push(`/owner/branches/${branch.id}`)}
                  className="flex items-center gap-2"
                >
                  <ExternalLink size={16} />
                  View
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      ))}
    </div>
  )
}