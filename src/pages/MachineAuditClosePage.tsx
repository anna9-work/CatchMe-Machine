// MachineAuditClosePage.tsx
import { useEffect, useMemo, useState, type CSSProperties } from "react"
import { supabase } from "../lib/supabase"

const GROUP_CODE = "catch_0001"

type Props = {
  onBack: () => void
}

type AuditSheetRow = {
  machine_no: string
  product_sku: string
  product_name: string
  units_per_box: number
  inside_piece: number
  outside_box: number
  outside_piece: number
  total_amount?: number
}

type CloseItem = {
  key: string
  machine_no: string
  product_sku: string
  product_name: string
  units_per_box: number
  audit_inner_qty: number
  audit_ground_qty: number
  outside_box: number
  outside_piece: number
  corrected_inner_qty: string
  corrected_ground_qty: string
}

export default function MachineAuditClosePage({ onBack }: Props) {
  const [bizDate, setBizDate] = useState(getBusinessDateValue())
  const [items, setItems] = useState<CloseItem[]>([])
  const [selectedMachineNo, setSelectedMachineNo] = useState("")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [closingAudit, setClosingAudit] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const affectedStartDate = addDays(bizDate, 1)

  const machineNos = useMemo(() => {
    return Array.from(new Set(items.map((item) => item.machine_no))).sort(
      compareMachineNo
    )
  }, [items])

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    return items.filter((item) => {
      if (selectedMachineNo && item.machine_no !== selectedMachineNo) {
        return false
      }

      if (!keyword) return true

      return (
        item.product_sku.toLowerCase().includes(keyword) ||
        item.product_name.toLowerCase().includes(keyword) ||
        item.machine_no.toLowerCase().includes(keyword)
      )
    })
  }, [items, search, selectedMachineNo])

  const summary = useMemo(() => {
    return filteredItems.reduce(
      (acc, item) => {
        acc.innerQty += readInputQty(item.corrected_inner_qty)
        acc.groundQty += readInputQty(item.corrected_ground_qty)
        acc.totalQty +=
          readInputQty(item.corrected_inner_qty) +
          readInputQty(item.corrected_ground_qty)
        return acc
      },
      {
        innerQty: 0,
        groundQty: 0,
        totalQty: 0,
      }
    )
  }, [filteredItems])

  useEffect(() => {
    loadAuditRows()
  }, [bizDate])

  async function loadAuditRows() {
    try {
      setLoading(true)
      setError("")
      setMessage("")

      const { data, error } = await supabase.rpc("machine_audit_sheet_rows_v1", {
        p_group: GROUP_CODE,
        p_biz_date: bizDate,
      })

      if (error) throw error

      const rows = ((data ?? []) as AuditSheetRow[]).map((row) => {
        const unitsPerBox = Number(row.units_per_box ?? 1) || 1
        const insidePiece = Number(row.inside_piece ?? 0)
        const outsideBox = Number(row.outside_box ?? 0)
        const outsidePiece = Number(row.outside_piece ?? 0)
        const groundQty = outsideBox * unitsPerBox + outsidePiece

        return {
          key: `${row.machine_no}-${row.product_sku}`,
          machine_no: row.machine_no,
          product_sku: row.product_sku.toLowerCase(),
          product_name: row.product_name || row.product_sku,
          units_per_box: unitsPerBox,
          audit_inner_qty: insidePiece,
          audit_ground_qty: groundQty,
          outside_box: outsideBox,
          outside_piece: outsidePiece,
          corrected_inner_qty: String(insidePiece),
          corrected_ground_qty: String(groundQty),
        }
      })

      setItems(rows)

      const nextMachineNos = Array.from(
        new Set(rows.map((row) => row.machine_no))
      ).sort(compareMachineNo)

      setSelectedMachineNo((current) =>
        nextMachineNos.includes(current) ? current : nextMachineNos[0] ?? ""
      )
    } catch (err) {
      console.error(err)
      setError(getErrorMessage(err, "讀取機台盤點數據失敗"))
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  async function closeAuditSnapshot() {
    const confirmed = window.confirm(
      `確定要鎖定 ${bizDate} 的機台盤點資料嗎？\n\n鎖定後會產生該日機台台內與台頂盤點快照，作為生命週期結算依據。`
    )

    if (!confirmed) return

    try {
      setClosingAudit(true)
      setError("")
      setMessage("")

      const { error } = await supabase.rpc("machine_close_audit_day", {
        p_group: GROUP_CODE,
        p_biz_date: bizDate,
      })

      if (error) throw error

      setMessage(`${bizDate} 機台盤點資料已鎖定，可以確認數量後送出結算`)
      await loadAuditRows()
    } catch (err) {
      console.error(err)
      setError(getErrorMessage(err, "鎖定機台盤點資料失敗"))
    } finally {
      setClosingAudit(false)
    }
  }

  function updateItemQty(
    key: string,
    field: "corrected_inner_qty" | "corrected_ground_qty",
    value: string
  ) {
    setItems((current) =>
      current.map((item) =>
        item.key === key
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    )
  }

  async function submitClose() {
    const targetItems = items.filter((item) => {
      return (
        Number.isFinite(readInputQty(item.corrected_inner_qty)) &&
        Number.isFinite(readInputQty(item.corrected_ground_qty))
      )
    })

    if (targetItems.length === 0) {
      setError("沒有可以結算的機台盤點數據")
      return
    }

    for (const item of targetItems) {
      const innerQty = Number(item.corrected_inner_qty)
      const groundQty = Number(item.corrected_ground_qty)

      if (!Number.isInteger(innerQty) || innerQty < 0) {
        setError(`${item.machine_no} ${item.product_sku} 台內數量不是 0 以上整數`)
        return
      }

      if (!Number.isInteger(groundQty) || groundQty < 0) {
        setError(`${item.machine_no} ${item.product_sku} 台頂數量不是 0 以上整數`)
        return
      }
    }

    const confirmed = window.confirm(
      `確定要結算 ${bizDate} 的機台盤點嗎？\n\n會寫入 ${targetItems.length} 筆台內＋台頂校正，並更新 ${bizDate} 到 ${affectedStartDate} 的生命週期日結。`
    )

    if (!confirmed) return

    try {
      setSaving(true)
      setError("")
      setMessage("")

      for (const item of targetItems) {
        const { error: saveError } = await supabase.rpc(
          "rpc_machine_inner_adjustment_upsert_v1",
          {
            p_group: GROUP_CODE,
            p_biz_date: bizDate,
            p_machine_no: item.machine_no,
            p_sku: item.product_sku,
            p_corrected_inner_qty: Number(item.corrected_inner_qty),
            p_corrected_ground_qty: Number(item.corrected_ground_qty),
            p_note: "機台盤點結算",
            p_created_by: "webapp_audit_close",
          }
        )

        if (saveError) throw saveError
      }

      const { error: rebuildError } = await supabase.rpc(
        "rebuild_machine_lifecycle_daily_v1",
        {
          p_group: GROUP_CODE,
          p_start_date: bizDate,
          p_end_date: affectedStartDate,
        }
      )

      if (rebuildError) {
        setMessage(
          `已寫入 ${targetItems.length} 筆盤點結算，但 Supabase 生命週期日結更新失敗`
        )
        setError(rebuildError.message)
        return
      }

      setMessage(
        `已完成 ${bizDate} 機台盤點結算，${targetItems.length} 筆台內＋台頂已寫入，日結已更新至 ${affectedStartDate}`
      )
      await loadAuditRows()
    } catch (err) {
      console.error(err)
      setError(getErrorMessage(err, "機台盤點結算失敗"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={pageStyle}>
      <div style={topBarStyle}>
        <button onClick={onBack} style={backButtonStyle}>
          ‹
        </button>

        <div style={titleBlockStyle}>
          <h1 style={titleStyle}>盤點結算</h1>
          <div style={subTitleStyle}>機台生命週期</div>
        </div>

        <button onClick={loadAuditRows} disabled={loading} style={refreshButtonStyle}>
          更新
        </button>
      </div>

      {message && <div style={messageStyle}>{message}</div>}
      {error && <div style={errorStyle}>{error}</div>}

      <section style={panelStyle}>
        <label style={labelStyle}>結算日期（該日結束後）</label>
        <input
          type="date"
          value={bizDate}
          onChange={(event) => setBizDate(event.target.value)}
          style={inputStyle}
        />

        <div style={rebuildInfoStyle}>
          <div style={rebuildInfoRowStyle}>
            <span>寫入</span>
            <strong>{bizDate} 結束台內＋台頂</strong>
          </div>
          <div style={rebuildInfoRowStyle}>
            <span>更新</span>
            <strong>
              生命週期 {bizDate} ～ {affectedStartDate}
            </strong>
          </div>
          <div style={rebuildInfoRowStyle}>
            <span>影響</span>
            <strong>該日差異與隔日起始數量</strong>
          </div>
        </div>

        <button
          onClick={closeAuditSnapshot}
          disabled={closingAudit || loading}
          style={{
            ...secondaryButtonStyle,
            opacity: closingAudit || loading ? 0.7 : 1,
          }}
        >
          {closingAudit ? "鎖定中..." : "鎖定盤點資料"}
        </button>

        <label style={labelStyle}>機台</label>
        <select
          value={selectedMachineNo}
          onChange={(event) => setSelectedMachineNo(event.target.value)}
          style={selectStyle}
          disabled={loading || machineNos.length === 0}
        >
          <option value="">全部機台</option>
          {machineNos.map((machineNo) => (
            <option key={machineNo} value={machineNo}>
              {machineNo}
            </option>
          ))}
        </select>

        <label style={labelStyle}>搜尋</label>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="機台 / SKU / 品名"
          style={inputStyle}
        />
      </section>

      {!loading && (
        <section style={machineSummaryStyle}>
          <div style={machineSummaryHeaderStyle}>
            <span style={machineSummaryTitleStyle}>
              {selectedMachineNo ? `機台 ${selectedMachineNo}` : "全部機台"}
            </span>
            <span style={machineSummaryCountStyle}>{filteredItems.length} 項</span>
          </div>

          <div style={summaryStatGridStyle}>
            <div style={summaryStatStyle}>
              <span>台內</span>
              <strong>{formatQty(summary.innerQty)}</strong>
            </div>
            <div style={summaryStatStyle}>
              <span>台頂</span>
              <strong>{formatQty(summary.groundQty)}</strong>
            </div>
            <div style={summaryStatStyle}>
              <span>合計</span>
              <strong>{formatQty(summary.totalQty)}</strong>
            </div>
          </div>
        </section>
      )}

      {loading && <p style={mutedStyle}>載入盤點數據中...</p>}

      {!loading && filteredItems.length === 0 && (
        <p style={mutedStyle}>這天沒有可結算的機台盤點數據</p>
      )}

      {!loading && filteredItems.length > 0 && (
        <section style={resultListStyle}>
          {filteredItems.map((item) => (
            <div key={item.key} style={resultCardStyle}>
              <div style={resultHeaderStyle}>
                <div style={resultMainStyle}>
                  <span style={machineNoStyle}>機台 {item.machine_no}</span>
                  <strong style={skuStyle}>{item.product_sku}</strong>
                  <span style={nameStyle}>{item.product_name}</span>
                </div>
                <span style={resultMetaStyle}>箱入 {item.units_per_box}</span>
              </div>

              <div style={auditMetaStyle}>
                <span>原盤台內 {formatQty(item.audit_inner_qty)}</span>
                <span>
                  原盤台頂 {formatQty(item.audit_ground_qty)}（{item.outside_box}箱
                  {item.outside_piece}散）
                </span>
              </div>

              <div style={qtyGridStyle}>
                <label style={miniFieldStyle}>
                  <span>結算台內</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={item.corrected_inner_qty}
                    onChange={(event) =>
                      updateItemQty(
                        item.key,
                        "corrected_inner_qty",
                        event.target.value
                      )
                    }
                    style={miniInputStyle}
                  />
                </label>

                <label style={miniFieldStyle}>
                  <span>結算台頂</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={item.corrected_ground_qty}
                    onChange={(event) =>
                      updateItemQty(
                        item.key,
                        "corrected_ground_qty",
                        event.target.value
                      )
                    }
                    style={miniInputStyle}
                  />
                </label>
              </div>
            </div>
          ))}
        </section>
      )}

      {filteredItems.length > 0 && (
        <div style={bottomBarStyle}>
          <button
            onClick={submitClose}
            disabled={saving || loading}
            style={{
              ...submitButtonStyle,
              opacity: saving || loading ? 0.7 : 1,
            }}
          >
            {saving ? "結算中..." : "送出結算"}
          </button>
        </div>
      )}
    </div>
  )
}

function readInputQty(value: string) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function formatQty(value: number) {
  return value.toLocaleString("zh-TW")
}

function compareMachineNo(a: string, b: string) {
  const aNumber = Number(a)
  const bNumber = Number(b)

  if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
    return aNumber - bNumber
  }

  return a.localeCompare(b, "zh-TW")
}

function getErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error) return err.message
  if (typeof err === "object" && err !== null && "message" in err) {
    const message = (err as { message?: unknown }).message
    if (typeof message === "string") return message
  }
  return fallback
}

function getBusinessDateValue() {
  const now = new Date()
  const taipeiParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now)

  const year = taipeiParts.find((part) => part.type === "year")?.value ?? ""
  const month = taipeiParts.find((part) => part.type === "month")?.value ?? ""
  const day = taipeiParts.find((part) => part.type === "day")?.value ?? ""
  const hour = Number(
    taipeiParts.find((part) => part.type === "hour")?.value ?? "0"
  )

  const base = new Date(`${year}-${month}-${day}T12:00:00+08:00`)
  if (hour < 5) base.setDate(base.getDate() - 1)

  const businessYear = base.getFullYear()
  const businessMonth = String(base.getMonth() + 1).padStart(2, "0")
  const businessDay = String(base.getDate()).padStart(2, "0")

  return `${businessYear}-${businessMonth}-${businessDay}`
}

function addDays(dateText: string, days: number) {
  const date = new Date(`${dateText}T12:00:00+08:00`)
  date.setDate(date.getDate() + days)

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

const pageStyle: CSSProperties = {
  minHeight: "100dvh",
  width: "100%",
  maxWidth: "100vw",
  overflowX: "hidden",
  background: "#050913",
  color: "#fff",
  padding: "0 16px 104px",
  boxSizing: "border-box",
  fontFamily: "system-ui, -apple-system, sans-serif",
  WebkitTextSizeAdjust: "100%",
  touchAction: "manipulation",
}

const topBarStyle: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 100,
  background: "#050913",
  paddingTop: "max(12px, env(safe-area-inset-top))",
  paddingBottom: 8,
  display: "grid",
  gridTemplateColumns: "48px minmax(0, 1fr) 54px",
  alignItems: "center",
  borderBottom: "1px solid #111827",
  minWidth: 0,
  width: "100%",
  boxSizing: "border-box",
  marginBottom: 12,
}

const backButtonStyle: CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#d1d5db",
  fontSize: 32,
  lineHeight: 1,
  padding: 0,
  minHeight: 44,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
}

const refreshButtonStyle: CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#60a5fa",
  fontSize: 14,
  fontWeight: 800,
  lineHeight: 1.2,
  padding: 0,
  minHeight: 44,
  cursor: "pointer",
}

const titleBlockStyle: CSSProperties = {
  textAlign: "center",
  minWidth: 0,
  overflow: "hidden",
}

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 850,
  letterSpacing: 0,
  lineHeight: 1.2,
}

const subTitleStyle: CSSProperties = {
  color: "#9ca3af",
  marginTop: 2,
  fontSize: 12,
  lineHeight: 1.2,
}

const panelStyle: CSSProperties = {
  background: "#101827",
  border: "1px solid #273244",
  borderRadius: 18,
  padding: 14,
  display: "grid",
  gap: 9,
  boxSizing: "border-box",
}

const rebuildInfoStyle: CSSProperties = {
  border: "1px solid rgba(96, 165, 250, 0.2)",
  borderRadius: 14,
  background: "rgba(96, 165, 250, 0.08)",
  padding: "10px 12px",
  display: "grid",
  gap: 7,
  marginTop: 3,
}

const rebuildInfoRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "48px minmax(0, 1fr)",
  gap: 10,
  alignItems: "center",
  color: "#cbd5e1",
  fontSize: 13,
  lineHeight: 1.25,
  fontWeight: 760,
}

const secondaryButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: 46,
  border: "1px solid rgba(96, 165, 250, 0.35)",
  borderRadius: 14,
  background: "rgba(96, 165, 250, 0.12)",
  color: "#bfdbfe",
  fontSize: 15,
  fontWeight: 900,
  cursor: "pointer",
  marginTop: 4,
}

const labelStyle: CSSProperties = {
  color: "#cbd5e1",
  fontSize: 13,
  fontWeight: 850,
  marginTop: 5,
}

const inputStyle: CSSProperties = {
  width: "100%",
  minHeight: 46,
  borderRadius: 14,
  border: "1px solid #334155",
  background: "#0b1220",
  color: "#fff",
  fontSize: 16,
  padding: "0 13px",
  boxSizing: "border-box",
  outline: "none",
}

const selectStyle: CSSProperties = {
  ...inputStyle,
  appearance: "none",
}

const machineSummaryStyle: CSSProperties = {
  border: "1px solid #273244",
  borderRadius: 16,
  background: "#0f172a",
  padding: 13,
  marginTop: 12,
  display: "grid",
  gap: 10,
}

const machineSummaryHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
}

const machineSummaryTitleStyle: CSSProperties = {
  color: "#fff",
  fontSize: 16,
  fontWeight: 900,
}

const machineSummaryCountStyle: CSSProperties = {
  color: "#94a3b8",
  fontSize: 12,
  fontWeight: 800,
}

const summaryStatGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  gap: 8,
}

const summaryStatStyle: CSSProperties = {
  border: "1px solid #273244",
  borderRadius: 13,
  background: "#0b1220",
  padding: "9px 10px",
  display: "grid",
  gap: 4,
  color: "#94a3b8",
  fontSize: 12,
  fontWeight: 800,
}

const resultListStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  marginTop: 12,
}

const resultCardStyle: CSSProperties = {
  width: "100%",
  border: "1px solid #273244",
  borderRadius: 16,
  background: "#0f172a",
  color: "#fff",
  padding: "13px 14px",
  display: "grid",
  gap: 10,
  boxSizing: "border-box",
}

const resultHeaderStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: 12,
  alignItems: "start",
}

const resultMainStyle: CSSProperties = {
  display: "grid",
  gap: 5,
  minWidth: 0,
}

const machineNoStyle: CSSProperties = {
  color: "#f7c873",
  fontSize: 12,
  fontWeight: 900,
  lineHeight: 1.2,
}

const skuStyle: CSSProperties = {
  color: "#93c5fd",
  fontSize: 15,
  fontWeight: 900,
  lineHeight: 1.2,
}

const nameStyle: CSSProperties = {
  color: "#f8fafc",
  fontSize: 15,
  fontWeight: 760,
  lineHeight: 1.3,
}

const resultMetaStyle: CSSProperties = {
  color: "#94a3b8",
  fontSize: 12,
  fontWeight: 800,
  whiteSpace: "nowrap",
}

const auditMetaStyle: CSSProperties = {
  border: "1px solid #273244",
  borderRadius: 13,
  background: "#0b1220",
  color: "#94a3b8",
  padding: "9px 10px",
  display: "grid",
  gap: 4,
  fontSize: 12,
  fontWeight: 800,
}

const qtyGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
}

const miniFieldStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  color: "#cbd5e1",
  fontSize: 12,
  fontWeight: 850,
}

const miniInputStyle: CSSProperties = {
  width: "100%",
  minHeight: 42,
  borderRadius: 13,
  border: "1px solid #334155",
  background: "#0b1220",
  color: "#fff",
  fontSize: 17,
  fontWeight: 850,
  padding: "0 11px",
  boxSizing: "border-box",
  outline: "none",
}

const bottomBarStyle: CSSProperties = {
  position: "fixed",
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 120,
  padding: "12px 16px max(12px, env(safe-area-inset-bottom))",
  background: "linear-gradient(180deg, rgba(5,9,19,0), #050913 24%)",
  boxSizing: "border-box",
}

const submitButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: 54,
  border: "none",
  borderRadius: 18,
  background: "#2563eb",
  color: "#fff",
  fontSize: 17,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 14px 32px rgba(37,99,235,0.26)",
}

const messageStyle: CSSProperties = {
  background: "rgba(47, 214, 111, 0.1)",
  color: "#2fd66f",
  border: "1px solid rgba(47, 214, 111, 0.2)",
  borderRadius: 12,
  padding: "10px 12px",
  marginBottom: 12,
  fontSize: 14,
  textAlign: "center",
  boxSizing: "border-box",
}

const errorStyle: CSSProperties = {
  background: "rgba(255, 102, 102, 0.1)",
  color: "#ff6666",
  border: "1px solid rgba(255, 102, 102, 0.2)",
  borderRadius: 12,
  padding: "10px 12px",
  marginBottom: 12,
  fontSize: 14,
  textAlign: "center",
  boxSizing: "border-box",
}

const mutedStyle: CSSProperties = {
  color: "#9ca3af",
  textAlign: "center",
  padding: "20px 0",
  margin: 0,
}
