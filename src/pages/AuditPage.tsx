import { useEffect, useState, type CSSProperties } from "react"
import { supabase } from "../lib/supabase"

type AuditItem = {
  product_sku: string
  product_name: string
  units_per_box: number
  outside_box: number
  outside_piece: number
}

type MachineRow = {
  machine_no: string
  enabled: boolean
  items: AuditItem[]
}

type Props = {
  auditId: number | null
  onBack: () => void
  onOpenMachine?: (machineNo: string) => void
}

const GROUP_CODE = "catch_0001"

const GAS_WEBHOOK_URL ="https://script.google.com/macros/s/AKfycbxJCyGURX6TkTUoyU3JpUQLs1DFLDyGk4ZXnwBK2Qh_89Dr_RO07pXHMii335PB3zlKfQ/exec"

export default function AuditPage({ auditId, onBack }: Props) {
  const [machines, setMachines] = useState<MachineRow[]>([])
  const [bizDate, setBizDate] = useState("")
  const [isClosed, setIsClosed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [closing, setClosing] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadData(false)
  }, [auditId])

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!saving && !closing && dirtyKeys.size === 0) {
        loadData(true)
      }
    }, 5000)

    return () => window.clearInterval(timer)
  }, [auditId, saving, closing, dirtyKeys.size])

  async function loadData(silent: boolean) {
    if (!auditId) {
      setError("缺少盤點單號")
      setLoading(false)
      return
    }

    try {
      if (!silent) setLoading(true)
      setError("")

      const { data: auditData, error: auditError } = await supabase
        .from("machine_audits")
        .select("biz_date,is_closed")
        .eq("id", auditId)
        .single()

      if (auditError) throw auditError

      setBizDate(auditData?.biz_date ?? "")
      setIsClosed(Boolean(auditData?.is_closed))

      const { data, error } = await supabase.rpc("machine_audit_form_v1", {
        p_group: GROUP_CODE,
        p_audit_id: auditId,
      })

      if (error) throw error

      const rows = ((data ?? []) as MachineRow[])
        .filter((m) => m.enabled && (m.items ?? []).length > 0)
        .map((m) => ({
          ...m,
          items: m.items ?? [],
        }))

      setMachines(rows)
    } catch (err: any) {
      console.error(err)
      setError(err.message ?? "讀取失敗")
    } finally {
      if (!silent) setLoading(false)
    }
  }

  function toSafeNumber(value: string) {
    if (value.trim() === "") return 0

    const n = Number(value)
    if (!Number.isFinite(n) || n < 0) return 0

    return n
  }

  function makeDirtyKey(machineNo: string, sku: string) {
    return `${machineNo}__${sku}`
  }

  function updateValue(
    machineNo: string,
    sku: string,
    field: "outside_box" | "outside_piece",
    value: string
  ) {
    if (isClosed) return

    const num = toSafeNumber(value)

    setMachines((prev) =>
      prev.map((machine) =>
        machine.machine_no !== machineNo
          ? machine
          : {
              ...machine,
              items: machine.items.map((item) =>
                item.product_sku !== sku
                  ? item
                  : {
                      ...item,
                      [field]: num,
                    }
              ),
            }
      )
    )

    setDirtyKeys((prev) => {
      const next = new Set(prev)
      next.add(makeDirtyKey(machineNo, sku))
      return next
    })

    setMessage("")
  }

  async function saveOne(machineNo: string, sku: string) {
    if (!auditId || isClosed) return

    const machine = machines.find((m) => m.machine_no === machineNo)
    const item = machine?.items.find((i) => i.product_sku === sku)

    if (!item) return

    try {
      setSaving(true)
      setError("")

      const { error } = await supabase.rpc("machine_upsert_audit_input", {
        p_group: GROUP_CODE,
        p_audit_id: auditId,
        p_machine_no: machineNo,
        p_product_sku: item.product_sku,
        p_outside_box: item.outside_box || 0,
        p_outside_piece: item.outside_piece || 0,
        p_comment: null,
      })

      if (error) throw error

      setDirtyKeys((prev) => {
        const next = new Set(prev)
        next.delete(makeDirtyKey(machineNo, sku))
        return next
      })

      setMessage("已儲存")
    } catch (err: any) {
      console.error(err)
      setError(err.message ?? "儲存失敗")
    } finally {
      setSaving(false)
    }
  }

  async function saveAll() {
    if (!auditId) {
      setError("缺少盤點單號")
      return
    }

    if (isClosed) {
      setMessage("已關帳")
      return
    }

    const changedItems: Array<{
      machine_no: string
      item: AuditItem
    }> = []

    for (const machine of machines) {
      for (const item of machine.items) {
        if (dirtyKeys.has(makeDirtyKey(machine.machine_no, item.product_sku))) {
          changedItems.push({
            machine_no: machine.machine_no,
            item,
          })
        }
      }
    }

    if (changedItems.length === 0) {
      setMessage("已儲存")
      return
    }

    try {
      setSaving(true)
      setError("")

      for (const row of changedItems) {
        const { error } = await supabase.rpc("machine_upsert_audit_input", {
          p_group: GROUP_CODE,
          p_audit_id: auditId,
          p_machine_no: row.machine_no,
          p_product_sku: row.item.product_sku,
          p_outside_box: row.item.outside_box || 0,
          p_outside_piece: row.item.outside_piece || 0,
          p_comment: null,
        })

        if (error) throw error
      }

      setDirtyKeys(new Set())
      setMessage("已儲存")
    } catch (err: any) {
      console.error(err)
      setError(err.message ?? "儲存失敗")
    } finally {
      setSaving(false)
    }
  }

  async function closeAudit() {
    if (!auditId || !bizDate) {
      setError("缺少盤點日期，無法關帳")
      return
    }

    const ok = window.confirm("確定要關帳嗎？關帳後此盤點單將不能再修改。")
    if (!ok) return

    try {
      setClosing(true)
      setError("")

      await saveAll()

      const { error } = await supabase.rpc("machine_close_audit_day", {
        p_group: GROUP_CODE,
        p_biz_date: bizDate,
      })

      if (error) throw error

      setIsClosed(true)
setDirtyKeys(new Set())

try {
  await fetch(GAS_WEBHOOK_URL, {
    method: "POST",
    mode: "no-cors",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      groupCode: GROUP_CODE,
      bizDate,
    }),
  })

  setMessage("已關帳，已匯入試算表")
} catch {
  setMessage("已關帳")
}

await loadData(true)
    } catch (err: any) {
      console.error(err)
      setError(err.message ?? "關帳失敗")
    } finally {
      setClosing(false)
    }
  }

  return (
    <div style={pageStyle}>
      <div style={topBarStyle}>
        <button onClick={onBack} style={iconButtonStyle}>
          ‹
        </button>

        <div style={titleStyle}>機台盤點</div>

        <button onClick={saveAll} disabled={saving || closing} style={saveIconStyle}>
          {saving ? "…" : "✓"}
        </button>
      </div>

      <div style={metaStyle}>
        <span>盤點單：#{auditId ?? "-"}</span>
        <span style={{ color: isClosed ? "#ffcc66" : "#2fd66f" }}>
          {isClosed ? "已關帳" : "未關帳"}
        </span>
      </div>

      {message && <div style={messageStyle}>{message}</div>}
      {loading && <p style={mutedStyle}>載入中...</p>}
      {!loading && error && <p style={errorStyle}>{error}</p>}

      {!loading &&
        !error &&
        machines.map((machine) => (
          <section key={machine.machine_no} style={machineCardStyle}>
            <h2 style={machineTitleStyle}>#{machine.machine_no}</h2>

            <div style={itemListStyle}>
              {machine.items.map((item) => (
                <div key={item.product_sku} style={itemCardStyle}>
                  <div style={itemInfoStyle}>
                    <div style={productNameStyle}>{item.product_name}</div>
                    <div style={skuStyle}>{item.product_sku}</div>
                    <div style={boxStyle}>箱入數：{item.units_per_box}</div>
                  </div>

                  <div style={inputsRowStyle}>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      disabled={isClosed}
                      value={item.outside_box || ""}
                      onChange={(e) =>
                        updateValue(
                          machine.machine_no,
                          item.product_sku,
                          "outside_box",
                          e.target.value
                        )
                      }
                      onBlur={() => saveOne(machine.machine_no, item.product_sku)}
                      style={{
                        ...inputStyle,
                        opacity: isClosed ? 0.6 : 1,
                      }}
                    />
                    <span style={unitStyle}>箱</span>

                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      disabled={isClosed}
                      value={item.outside_piece || ""}
                      onChange={(e) =>
                        updateValue(
                          machine.machine_no,
                          item.product_sku,
                          "outside_piece",
                          e.target.value
                        )
                      }
                      onBlur={() => saveOne(machine.machine_no, item.product_sku)}
                      style={{
                        ...inputStyle,
                        opacity: isClosed ? 0.6 : 1,
                      }}
                    />
                    <span style={unitStyle}>散</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

      {!loading && !error && !isClosed && (
        <button
          onClick={closeAudit}
          disabled={closing}
          style={closeButtonStyle}
        >
          {closing ? "關帳中..." : "關帳"}
        </button>
      )}

      {!loading && !error && isClosed && (
        <div style={closedBoxStyle}>此盤點單已關帳</div>
      )}
    </div>
  )
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "#050913",
  color: "#fff",
  padding: "44px 14px 28px",
  boxSizing: "border-box",
}

const topBarStyle: CSSProperties = {
  height: 56,
  display: "grid",
  gridTemplateColumns: "48px 1fr 48px",
  alignItems: "center",
}

const iconButtonStyle: CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#fff",
  fontSize: 44,
  lineHeight: 1,
}

const saveIconStyle: CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#fff",
  fontSize: 36,
}

const titleStyle: CSSProperties = {
  textAlign: "center",
  fontSize: 24,
  fontWeight: 800,
}

const metaStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  color: "#bbb",
  fontSize: 18,
  fontWeight: 700,
  borderTop: "1px solid #1f2937",
  padding: "14px 4px 18px",
}

const messageStyle: CSSProperties = {
  color: "#2fd66f",
  fontSize: 15,
  marginBottom: 12,
}

const mutedStyle: CSSProperties = {
  color: "#999",
}

const errorStyle: CSSProperties = {
  color: "#ff6666",
}

const machineCardStyle: CSSProperties = {
  background: "#101827",
  borderRadius: 24,
  padding: 14,
  marginBottom: 18,
}

const machineTitleStyle: CSSProperties = {
  margin: "0 0 14px",
  color: "#2fd66f",
  fontSize: 30,
  fontWeight: 900,
}

const itemListStyle: CSSProperties = {
  display: "grid",
  gap: 12,
}

const itemCardStyle: CSSProperties = {
  border: "1px solid #273244",
  borderRadius: 18,
  padding: 14,
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 12,
  alignItems: "center",
}

const itemInfoStyle: CSSProperties = {
  minWidth: 0,
}

const productNameStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  lineHeight: 1.4,
}

const skuStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  marginTop: 8,
}

const boxStyle: CSSProperties = {
  color: "#1da1f2",
  fontSize: 16,
  fontWeight: 800,
  marginTop: 8,
}

const inputsRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "76px 24px 76px 24px",
  gap: 8,
  alignItems: "center",
}

const inputStyle: CSSProperties = {
  width: 76,
  height: 48,
  borderRadius: 12,
  border: "2px solid #111",
  background: "#fff",
  color: "#111",
  fontSize: 22,
  textAlign: "center",
}

const unitStyle: CSSProperties = {
  color: "#ccc",
  fontSize: 18,
  fontWeight: 700,
}

const closeButtonStyle: CSSProperties = {
  width: "100%",
  height: 56,
  borderRadius: 16,
  border: "1px solid #ff6666",
  background: "#2a0f14",
  color: "#ff9999",
  fontSize: 18,
  fontWeight: 800,
  marginTop: 18,
}

const closedBoxStyle: CSSProperties = {
  textAlign: "center",
  color: "#ffcc66",
  fontSize: 18,
  fontWeight: 800,
  padding: 18,
  border: "1px solid #664d1a",
  borderRadius: 16,
  background: "#1f1808",
  marginTop: 18,
}