"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { 
  BarChart, 
  LineChart, 
  PieChart,
  Download,
  Calendar,
  Filter
} from "lucide-react"

interface ReportData {
  id: string
  title: string
  description: string
  type: 'revenue' | 'orders' | 'customers' | 'performance'
  data: any
}

export function ReportsDashboard() {
  const [activeReport, setActiveReport] = useState("revenue")
  const [dateRange, setDateRange] = useState("week")
  
  const reports: ReportData[] = [
    {
      id: "revenue",
      title: "Revenue Report",
      description: "Track daily, weekly, and monthly revenue",
      type: "revenue",
      data: {}
    },
    {
      id: "orders",
      title: "Order Analytics",
      description: "Analyze order patterns and trends",
      type: "orders",
      data: {}
    },
    {
      id: "customers",
      title: "Customer Insights",
      description: "Customer behavior and loyalty metrics",
      type: "customers",
      data: {}
    },
    {
      id: "performance",
      title: "Staff Performance",
      description: "Staff productivity and efficiency metrics",
      type: "performance",
      data: {}
    }
  ]

  const currentReport = reports.find(r => r.id === activeReport)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-gray-900">Reports & Analytics</h3>
        <div className="flex gap-2">
          <select 
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="day">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>
          <Button className="flex items-center gap-2">
            <Download size={16} />
            Export
          </Button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {reports.map((report) => (
          <button
            key={report.id}
            onClick={() => setActiveReport(report.id)}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap ${
              activeReport === report.id
                ? "bg-brand-primary text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {report.title}
          </button>
        ))}
      </div>

      {currentReport && (
        <motion.div
          className="bg-white rounded-lg p-6 shadow border border-gray-200"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-3 mb-6">
            {currentReport.type === "revenue" && <BarChart className="text-blue-500" size={24} />}
            {currentReport.type === "orders" && <LineChart className="text-green-500" size={24} />}
            {currentReport.type === "customers" && <PieChart className="text-purple-500" size={24} />}
            {currentReport.type === "performance" && <BarChart className="text-orange-500" size={24} />}
            <div>
              <h4 className="font-bold text-lg">{currentReport.title}</h4>
              <p className="text-gray-600 text-sm">{currentReport.description}</p>
            </div>
          </div>
          
          <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                {currentReport.type === "revenue" && <BarChart className="text-gray-400" size={32} />}
                {currentReport.type === "orders" && <LineChart className="text-gray-400" size={32} />}
                {currentReport.type === "customers" && <PieChart className="text-gray-400" size={32} />}
                {currentReport.type === "performance" && <BarChart className="text-gray-400" size={32} />}
              </div>
              <p className="text-gray-500">Report visualization would appear here</p>
              <p className="text-sm text-gray-400 mt-2">Data insights and charts for {currentReport.title}</p>
            </div>
          </div>
          
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h5 className="font-medium text-gray-900">Key Metrics</h5>
              <ul className="mt-2 space-y-1 text-sm text-gray-600">
                <li>• Metric 1: Value</li>
                <li>• Metric 2: Value</li>
                <li>• Metric 3: Value</li>
              </ul>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <h5 className="font-medium text-gray-900">Trends</h5>
              <ul className="mt-2 space-y-1 text-sm text-gray-600">
                <li>• Trend 1: +12%</li>
                <li>• Trend 2: -5%</li>
                <li>• Trend 3: +8%</li>
              </ul>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <h5 className="font-medium text-gray-900">Insights</h5>
              <ul className="mt-2 space-y-1 text-sm text-gray-600">
                <li>• Insight 1: Description</li>
                <li>• Insight 2: Description</li>
                <li>• Insight 3: Description</li>
              </ul>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}