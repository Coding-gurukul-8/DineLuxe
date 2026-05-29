"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ChevronLeft, Plus, MapPin, Trash2, Star, Home, Building2, Navigation, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/shared/EmptyState";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface Address {
  id: string; label: string; address_line1: string;
  address_line2?: string; city: string; pincode: string; is_default: boolean;
}
interface NewAddress {
  label: string; address_line1: string; city: string; pincode: string; set_as_default: boolean;
}

const LABEL_ICONS: Record<string, React.ElementType> = { home: Home, work: Building2, other: Navigation };
function LabelIcon({ label }: { label: string }) {
  const Icon = LABEL_ICONS[label?.toLowerCase()] ?? Navigation;
  return <Icon size={16} />;
}

function AddressCard({ address, onDelete, onSetDefault, deleting, settingDefault }: { address: Address; onDelete: (id: string) => void; onSetDefault: (id: string) => void; deleting: boolean; settingDefault: boolean }) {
  return (
    <motion.div layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20, scale: 0.97 }} transition={{ type: "spring", stiffness: 280, damping: 24 }} className={cn("bg-white rounded-2xl p-4 border-2 shadow-sm transition-colors", address.is_default ? "border-[#E8A020]" : "border-gray-100")}>
      <div className="flex items-start gap-3">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", address.is_default ? "bg-[#E8A020] text-white" : "bg-gray-100 text-gray-500")}>
          <LabelIcon label={address.label} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="font-bold text-gray-900 text-sm capitalize">{address.label}</p>
            {address.is_default && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E8A020]/10 text-[#E8A020]">
                <Star size={9} className="fill-[#E8A020]" />Default
              </span>
            )}
          </div>
          <p className="text-sm text-gray-700">{address.address_line1}</p>
          {address.address_line2 && <p className="text-sm text-gray-500">{address.address_line2}</p>}
          <p className="text-xs text-gray-400 mt-0.5">{address.city} – {address.pincode}</p>
        </div>
      </div>
      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
        {!address.is_default && (
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => onSetDefault(address.id)} disabled={settingDefault} className="flex-1 py-2 text-xs font-semibold text-[#1A3C5E] bg-[#1A3C5E]/5 rounded-xl flex items-center justify-center gap-1.5">
            {settingDefault ? <Loader2 size={12} className="animate-spin" /> : <Star size={12} />}Set as Default
          </motion.button>
        )}
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => onDelete(address.id)} disabled={deleting} className="w-10 h-9 flex items-center justify-center rounded-xl bg-red-50 text-red-400">
          {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
        </motion.button>
      </div>
    </motion.div>
  );
}

const LABELS = ["Home", "Work", "Other"];

function AddAddressSheet({ open, onClose, onSubmit, loading }: { open: boolean; onClose: () => void; onSubmit: (data: NewAddress) => void; loading: boolean }) {
  const [form, setForm] = useState<NewAddress>({ label: "home", address_line1: "", city: "", pincode: "", set_as_default: false });
  const update = (k: keyof NewAddress, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));
  const canSubmit = form.address_line1 && form.city && form.pincode;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-black/40 z-40" />
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 300, damping: 30 }} className="fixed bottom-0 left-0 right-0 z-50 bg-[#FAF7F4] rounded-t-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-3 mb-5" />
            <div className="px-5 pb-8 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Add Address</h2>
                <motion.button whileTap={{ scale: 0.9 }} onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><X size={16} className="text-gray-600" /></motion.button>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">Label</p>
                <div className="flex gap-2">
                  {LABELS.map((lbl) => (
                    <button key={lbl} type="button" onClick={() => update("label", lbl.toLowerCase())} className={cn("flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-all", form.label === lbl.toLowerCase() ? "border-[#E8A020] bg-[#E8A020] text-white" : "border-gray-200 text-gray-600 bg-white")}>{lbl}</button>
                  ))}
                </div>
              </div>
              {([{ key: "address_line1", label: "Street Address", placeholder: "123 Marine Drive..." }, { key: "city", label: "City", placeholder: "Mumbai" }, { key: "pincode", label: "Pincode", placeholder: "400001" }] as const).map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-xs font-semibold text-gray-500 block mb-1.5">{label}</label>
                  <input type="text" value={form[key]} onChange={(e) => update(key, e.target.value)} placeholder={placeholder} className="w-full px-4 py-3 bg-white rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8A020]/40" />
                </div>
              ))}
              <label className="flex items-center gap-3 cursor-pointer">
                <div onClick={() => update("set_as_default", !form.set_as_default)} className={cn("w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all", form.set_as_default ? "bg-[#E8A020] border-[#E8A020]" : "border-gray-300 bg-white")}>
                  {form.set_as_default && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400 }}><Star size={12} className="text-white fill-white" /></motion.div>}
                </div>
                <span className="text-sm text-gray-700 font-medium">Set as default address</span>
              </label>
              <motion.button whileTap={{ scale: 0.97 }} disabled={!canSubmit || loading} onClick={() => onSubmit(form)} className={cn("w-full py-4 rounded-2xl font-bold text-white text-sm shadow-lg transition-all", canSubmit ? "bg-[#E8A020] shadow-[#E8A020]/30" : "bg-gray-200 cursor-not-allowed")}>
                {loading ? <span className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" />Saving…</span> : "Save Address"}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default function AddressesPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);

  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ["customer", "addresses"],
    queryFn: () => apiClient.get<Address[]>("/users/me/addresses"),
  });

  const { mutate: addAddress, isPending: addPending } = useMutation({
    mutationFn: (data: NewAddress) => apiClient.post<Address>("/users/me/addresses", data),
    onSuccess: () => { toast.success("Address saved!"); qc.invalidateQueries({ queryKey: ["customer", "addresses"] }); setShowAdd(false); },
    onError: () => toast.error("Could not save address."),
  });

  const { mutate: deleteAddress } = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/users/me/addresses/${id}`),
    onMutate: (id) => setDeletingId(id),
    onSuccess: () => { toast.success("Address removed."); qc.invalidateQueries({ queryKey: ["customer", "addresses"] }); },
    onError: () => toast.error("Could not delete address."),
    onSettled: () => setDeletingId(null),
  });

  const { mutate: setDefault } = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/users/me/addresses/${id}/default`, {}),
    onMutate: (id) => setSettingDefaultId(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["customer", "addresses"] }); },
    onError: () => toast.error("Could not set default."),
    onSettled: () => setSettingDefaultId(null),
  });

  return (
    <div className="min-h-screen bg-[#FAF7F4] pb-28">
      <div className="bg-linear-to-br from-[#1A3C5E] to-[#0D2A45] px-4 pt-12 pb-6 relative overflow-hidden">
        <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/5" />
        <div className="relative flex items-center gap-3">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => router.back()} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"><ChevronLeft size={18} className="text-white" /></motion.button>
          <div>
            <p className="text-[#E8A020] text-xs font-semibold uppercase tracking-widest">Profile</p>
            <h1 className="text-white font-bold text-xl">Saved Addresses</h1>
          </div>
        </div>
      </div>
      <div className="px-4 mt-5 space-y-3">
        {isLoading ? [1, 2].map((n) => <div key={n} className="h-28 bg-white rounded-2xl animate-pulse border border-gray-100" />) :
          addresses.length === 0 ? <EmptyState icon={<MapPin size={32} className="text-gray-400" />} title="No addresses yet" message="Add a delivery address to get started." /> :
          <AnimatePresence>{addresses.map((addr) => <AddressCard key={addr.id} address={addr} onDelete={deleteAddress} onSetDefault={setDefault} deleting={deletingId === addr.id} settingDefault={settingDefaultId === addr.id} />)}</AnimatePresence>}
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowAdd(true)} className="w-full py-4 rounded-2xl border-2 border-dashed border-[#E8A020]/40 text-[#E8A020] font-semibold text-sm flex items-center justify-center gap-2">
          <Plus size={18} />Add New Address
        </motion.button>
      </div>
      <AddAddressSheet open={showAdd} onClose={() => setShowAdd(false)} onSubmit={addAddress} loading={addPending} />
    </div>
  );
}