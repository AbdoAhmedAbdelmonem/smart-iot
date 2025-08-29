"use client"
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const table = "meow";

const supabase = createClient(supabaseUrl, anonKey);

interface LogEntry {
  id: string;
  sensor_type?: string | null;
  sensor_value?: number | null;
  timestamp?: string | null;
  device_id?: string | null;
  created_at?: string | null;
  [key: string]: any;
}

export function LiveSupabaseLogs() {
  const [rows, setRows] = useState<LogEntry[]>([]);
  const [page, setPage] = useState(0);
  const [pageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async (pageNumber = 0) => {
    try {
      setLoading(true);
      const from = pageNumber * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await supabase
        .from(table)
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) {
        setError(error.message);
        console.error("Error:", error);
      } else {
        setRows(data || []);
        setTotalCount(count || 0);
        setError(null);
      }
    } catch (err) {
      setError("Failed to fetch data");
      console.error("Exception:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(page);
  }, [page]);

  const totalPages = Math.ceil(totalCount / pageSize);

  const formatValue = (value: any): string => {
    if (value === null) return "NULL";
    if (value === undefined) return "UNDEFINED";
    if (typeof value === "object") return JSON.stringify(value);
    return value.toString();
  };

  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return "Invalid Date";
    }
  };

  if (loading && rows.length === 0) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-gray-800 bg-opacity-50 backdrop-filter backdrop-blur-lg rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
                <h2 className="text-lg font-semibold">Loading sensor data...</h2>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white p-6" style={{backgroundColor:"transparent"}}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gray-800 bg-opacity-50 backdrop-filter backdrop-blur-lg rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center">
                <span className="mr-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3v11.25m0 0L6 10.5m3.75 3.75L13.5 10.5M14.25 21V9.75m0 0L18 13.5m-3.75-3.75L10.5 13.5" />
                  </svg>
                </span>
                Sensor Data Dashboard
              </h1>
              <p className="text-gray-400 mt-1">Real-time data from connected sensors</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-400">Total Records</div>
              <div className="text-2xl font-bold text-blue-400">{totalCount}</div>
            </div>
          </div>
        </div>

        {/* Stats and Error */}
        {error && (
          <div className="bg-red-900 bg-opacity-50 backdrop-filter backdrop-blur-lg border border-red-700 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <div className="text-red-400 mr-2">⚠️</div>
              <div>
                <h3 className="text-red-300 font-medium">Connection Issue</h3>
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Data Table */}
        <div className="bg-gray-800 bg-opacity-50 backdrop-filter backdrop-blur-lg rounded-xl shadow-sm overflow-hidden">
          {/* Table Header */}
          <div className="px-6 py-4 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Sensor Readings</h2>
              <span className="text-sm text-gray-400">
                Showing {rows.length} of {totalCount} records
              </span>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr>
                  {rows.length > 0 && Object.keys(rows[0]).map((col) => (
                    <th
                      key={col}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider"
                    >
                      {col.replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                {rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-700 transition-colors">
                    {Object.values(row).map((val, i) => (
                      <td
                        key={i}
                        className="px-6 py-4 whitespace-nowrap text-sm"
                      >
                        {typeof val === 'string' && val.includes('T') ? formatDate(val) : formatValue(val)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 border-t border-gray-700 bg-gray-800 bg-opacity-50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-400">
                Page <span className="font-medium">{page + 1}</span> of{" "}
                <span className="font-medium">{totalPages}</span>
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setPage((p) => Math.max(p - 1, 0))}
                  disabled={page === 0}
                  className={`px-4 py-2 text-sm font-medium rounded-md border ${
                    page === 0
                      ? "bg-gray-700 text-gray-500 border-gray-600 cursor-not-allowed"
                      : "bg-gray-800 text-gray-300 border-gray-600 hover:bg-gray-700"
                  }`}
                >
                  Previous
                </button>
                
                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum = Math.max(0, Math.min(totalPages - 5, page - 2)) + i;
                    if (pageNum >= totalPages) return null;
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`w-10 h-10 text-sm font-medium rounded-md border ${
                          page === pageNum
                            ? "bg-blue-400 text-white border-blue-400"
                            : "bg-gray-800 text-gray-300 border-gray-600 hover:bg-gray-700"
                        }`}
                      >
                        {pageNum + 1}
                      </button>
                    );
                  })}
                </div>
                
                <button
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages - 1))}
                  disabled={page >= totalPages - 1}
                  className={`px-4 py-2 text-sm font-medium rounded-md border ${
                    page >= totalPages - 1
                      ? "bg-gray-700 text-gray-500 border-gray-600 cursor-not-allowed"
                      : "bg-gray-800 text-gray-300 border-gray-600 hover:bg-gray-700"
                  }`}
                >
                  Next
                </button>
              </div>
              
              <div className="text-sm text-gray-400">
                {pageSize} per page
              </div>
            </div>
          </div>
        </div>

        {/* Empty State */}
        {rows.length === 0 && !loading && (
          <div className="bg-gray-800 bg-opacity-50 backdrop-filter backdrop-blur-lg rounded-xl shadow-sm p-12 text-center mt-6">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-lg font-medium mb-2">No data available</h3>
            <p className="text-gray-400">There are no sensor readings to display yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}