import { useState } from "react"

import Home from "./pages/Home"
import AuditPage from "./pages/AuditPage"
import AuditHistory from "./pages/AuditHistory"
import MachineManage from "./pages/MachineManage"
import MachineDetail from "./pages/MachineDetail"
import { supabase } from "./lib/supabase"

type Page = "home" | "audit" | "history" | "machines" | "machineDetail"

const GROUP_CODE = "catch_0001"

function App() {
  const [page, setPage] = useState<Page>("home")
  const [auditId, setAuditId] = useState<number | null>(null)
  const [selectedMachineNo, setSelectedMachineNo] = useState("")
  const [loadingAudit, setLoadingAudit] = useState(false)
  const [error, setError] = useState("")

  async function openTodayAudit() {
    try {
      setLoadingAudit(true)
      setError("")

      const { data, error } = await supabase.rpc(
        "machine_create_or_get_today_audit",
        {
          p_group: GROUP_CODE,
        }
      )

      if (error) throw error

      setAuditId(Number(data))
      setPage("audit")
    } catch (err: any) {
      console.error(err)
      setError(err.message ?? "取得今日盤點單失敗")
    } finally {
      setLoadingAudit(false)
    }
  }

  if (loadingAudit) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#050913",
          color: "#fff",
          padding: 24,
          boxSizing: "border-box",
        }}
      >
        載入今日盤點單...
      </div>
    )
  }

  if (page === "audit") {
    return <AuditPage auditId={auditId} onBack={() => setPage("home")} />
  }

  if (page === "history") {
    return <AuditHistory onBack={() => setPage("home")} />
  }

  if (page === "machines") {
    return (
      <MachineManage
        onBack={() => setPage("home")}
        onOpenMachine={(machineNo) => {
          setSelectedMachineNo(machineNo)
          setPage("machineDetail")
        }}
      />
    )
  }

  if (page === "machineDetail") {
    return (
      <MachineDetail
        machineNo={selectedMachineNo}
        onBack={() => setPage("machines")}
      />
    )
  }

  return (
    <>
      {error && (
        <div
          style={{
            background: "#2a0f14",
            color: "#ff9999",
            padding: 12,
            fontSize: 15,
          }}
        >
          {error}
        </div>
      )}

      <Home
        onAuditClick={openTodayAudit}
        onHistoryClick={() => setPage("history")}
        onMachineClick={() => setPage("machines")}
      />
    </>
  )
}

export default App