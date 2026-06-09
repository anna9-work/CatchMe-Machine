import { useState } from "react"
import Home from "./pages/Home"
import AuditList from "./pages/AuditList"
import AuditPage from "./pages/AuditPage"
import AuditHistory from "./pages/AuditHistory"
import MachineManage from "./pages/MachineManage"

type Page = "home" | "auditList" | "auditPage" | "history" | "machines"

function App() {
  const [page, setPage] = useState<Page>("home")

  if (page === "auditList") {
    return (
      <AuditList
        onBack={() => setPage("home")}
        onOpenAudit={() => setPage("auditPage")}
      />
    )
  }

  if (page === "auditPage") {
    return <AuditPage onBack={() => setPage("auditList")} />
  }

  if (page === "history") {
    return <AuditHistory onBack={() => setPage("home")} />
  }

  if (page === "machines") {
    return <MachineManage onBack={() => setPage("home")} />
  }

  return (
    <Home
      onAuditClick={() => setPage("auditList")}
      onHistoryClick={() => setPage("history")}
      onMachineClick={() => setPage("machines")}
    />
  )
}

export default App