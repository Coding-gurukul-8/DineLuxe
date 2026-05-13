"use client"

import { useMemo, useState } from "react"
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts"
import { Activity, CalendarDays, DollarSign, RefreshCw, Store, Users } from "lucide-react"
import PageWrapper from "@/components/layout/PageWrapper"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { cn } from "@/lib/utils"
import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"

const ranges = ["Last 7 days", "Last 30 days", "Last 90 days"]

const ORDER_TYPE_COLORS: Record<string, string> = {
  "dine_in": "#1A3C5E",
  "delivery": "#1E7E34",
  "takeaway": "#E8A020",
}

function AnimatedNumber({ value, prefix = "" }: { value: number; prefix?: string }) {
  return <span>{prefix}{value.toLocaleString("en-IN")}</span>
}

function KpiTile({ label, value, icon: Icon, prefix, tone }: {
  label: string; value: number; icon: React.ElementType; prefix?: string; tone: string
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
          <p className="mt-3 text-2xl font-bold text-gray-950">
            <AnimatedNumber value={value} prefix={prefix} />
          </p>
        </div>
        <span className={cn("flex h-11 w-11 items-center justify-center rounded-lg text-white", tone)}>
          <Icon size={20} />
        </span>
      </div>
    </div>
  )
}

export default function AdminDashboardPage() {
  const [range, setRange] = useState(ranges[1])

  const { data: platformData, refetch } = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: () => apiClient.get<any>("/admin/dashboard"),
    refetchInterval: 5 * 60_000,
  })

  const { data: trendsData } = useQuery({
    queryKey: ["admin", "trends", range],
    queryFn: () => apiClient.get<any>(`/reports/admin/trends?range=${encodeURIComponent(range)}`),
    refetchInterval: 5 * 60_000,
  })

  const kpis = useMemo(() => [
    { label: "Total Active Restaurants", value: platformData?.activeRestaurants ?? 0, icon: Store, tone: "bg-[#1A3C5E]" },
    { label: "Total Customers", value: platformData?.totalCustomers ?? 0, icon: Users, tone: "bg-[#2980B9]" },
    { label: "Orders Today", value: platformData?.ordersToday ?? 0, icon: Activity, tone: "bg-[#1E7E34]" },
    { label: "Revenue Today", value: platformData?.revenueToday ?? 0, icon: DollarSign, prefix: "Rs ", tone: "bg-[#E8A020]" },
  ], [platformData])

  const orderTrend = trendsData?.orderTrend ?? []
  const topRestaurants = trendsData?.topRestaurants ?? []
  const orderTypes = (trendsData?.orderTypes ?? []).map((t: any) => ({
    ...t,
    color: ORDER_TYPE_COLORS[t.name] ?? "#888",
  }))
  const liveOrders = platformData?.liveOrders ?? []

  return (
    <PageWrapper
      title="Platform Analytics"
      subtitle="Live restaurant performance, demand patterns, and order movement"
      action={
        <button
          onClick={() => refetch()}
          className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      }
    >
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-3">
        <div className="flex min-h-12 items-center gap-2 rounded-lg bg-gray-50 px-3">
          <CalendarDays size={16} className="text-gray-500" />
          <select value={range} onChange={(e) => setRange(e.target.value)} className="bg-transparent text-sm font-medium text-gray-800 outline-none">
            {ranges.map((option) => <option key={option}>{option}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => <KpiTile key={kpi.label} {...kpi} />)}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-950">Daily Orders</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={orderTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="orders" stroke="#1A3C5E" fill="#1A3C5E" fillOpacity={0.16} strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-950">Top Restaurants By Revenue</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topRestaurants} layout="vertical" margin={{ left: 28 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={110} tickLine={false} axisLine={false} />
                <Tooltip formatter={(value: number) => `Rs ${value.toLocaleString("en-IN")}`} />
                <Bar dataKey="revenue" radius={[0, 6, 6, 0]} fill="#E8A020" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {orderTypes.length > 0 && (
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm w-full xl:max-w-sm">
          <h2 className="text-base font-semibold text-gray-950">Order Type Split</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={orderTypes} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={4}>
                  {orderTypes.map((entry: any) => <Cell key={entry.name} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(value: number) => `${value}%`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid gap-2">
            {orderTypes.map((item: any) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-gray-700">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  {item.name}
                </span>
                <strong>{item.value}%</strong>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-950">Live Order Feed</h2>
          <span className="text-xs font-medium text-gray-500">Last 20 orders</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                {["Order", "Restaurant", "Total", "Type", "Status", "Time"].map((heading) => (
                  <th key={heading} className="px-5 py-3 font-semibold">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {liveOrders.map((order: any) => (
                <tr key={order.id} className="transition hover:bg-gray-50">
                  <td className="px-5 py-4 font-semibold text-gray-950">
                    #{order.id?.slice(0, 8).toUpperCase()}
                  </td>
                  <td className="px-5 py-4 text-gray-700">{order.restaurant ?? order.branch?.name}</td>
                  <td className="px-5 py-4 text-gray-700">Rs {(order.total ?? order.totalAmount ?? 0).toLocaleString("en-IN")}</td>
                  <td className="px-5 py-4 text-gray-700 capitalize">{order.type ?? order.orderType}</td>
                  <td className="px-5 py-4"><StatusBadge status={order.status} size="sm" /></td>
                  <td className="px-5 py-4 text-gray-500">
                    {order.createdAt ? new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                  </td>
                </tr>
              ))}
              {liveOrders.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-gray-400">No live orders</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </PageWrapper>
  )
}
