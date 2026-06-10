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
        <span>單號 <span style={{ color: "#fff", fontWeight: 600 }}>#{auditId ?? "-"}</span></span>
        <span style={{ 
          ...statusBadgeStyle,
          background: isClosed ? "rgba(234, 179, 8, 0.1)" : "rgba(16, 185, 129, 0.1)",
          color: isClosed ? "#eab308" : "#10b981" 
        }}>
          {isClosed ? "已關帳" : "進行中"}
        </span>
      </div>

      {message && <div style={messageStyle}>{message}</div>}
      {loading && <p style={mutedStyle}>載入中...</p>}
      {!loading && error && <p style={errorStyle}>{error}</p>}

      {!loading &&
        !error &&
        machines.map((machine) => (
          <section key={machine.machine_no} style={machineCardStyle}>
            <div style={machineHeaderStyle}>
              <h2 style={machineTitleStyle}>機台 #{machine.machine_no}</h2>
            </div>

            <div style={itemListStyle}>
              {machine.items.map((item) => (
                <div key={item.product_sku} style={itemCardStyle}>
                  <div style={itemInfoStyle}>
                    <div style={productNameStyle}>{item.product_name}</div>
                    <div style={skuWrapperStyle}>
                      <span style={skuStyle}>{item.product_sku}</span>
                      <span style={boxStyle}>箱入數 {item.units_per_box}</span>
                    </div>
                  </div>

                  <div style={inputsContainerStyle}>
                    <div style={inputGroupStyle}>
                      <span style={unitLabelStyle}>箱</span>
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
                    </div>

                    <div style={inputDividerStyle} />

                    <div style={inputGroupStyle}>
                      <span style={unitLabelStyle}>散</span>
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
                    </div>
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
          {closing ? "處理中..." : "完成並關帳"}
        </button>
      )}

      {!loading && !error && isClosed && (
        <div style={closedBoxStyle}>此盤點單已確認並關帳</div>
      )}
    </div>
  )
}

/* ---------------- 針對手機優化的 CSS Properties ---------------- */

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "#09090b", // 深邃質感的背景色 (Zinc 900)
  color: "#fafafa",
  // 針對手機的上下留白，保留瀏海與底線空間
  padding: "24px 16px 60px",
  boxSizing: "border-box",
  fontFamily: "system-ui, -apple-system, sans-serif",
}

const topBarStyle: CSSProperties = {
  height: 56,
  display: "grid",
  gridTemplateColumns: "48px 1fr 48px",
  alignItems: "center",
  marginBottom: 12,
}

const iconButtonStyle: CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#a1a1aa",
  fontSize: 40, // 放大返回鍵熱區
  lineHeight: 1,
  padding: 0,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
}

const saveIconStyle: CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#10b981",
  fontSize: 26, // 放大儲存鍵熱區
  fontWeight: 600,
  padding: 0,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
}

const titleStyle: CSSProperties = {
  textAlign: "center",
  fontSize: 18,
  fontWeight: 600,
  letterSpacing: "0.5px",
}

const metaStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  color: "#a1a1aa",
  fontSize: 15,
  padding: "12px 4px",
  borderBottom: "1px solid #27272a",
  marginBottom: 20,
}

const statusBadgeStyle: CSSProperties = {
  padding: "6px 12px",
  borderRadius: 16,
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: "0.5px",
}

const messageStyle: CSSProperties = {
  background: "rgba(16, 185, 129, 0.1)",
  color: "#10b981",
  padding: "14px 16px",
  borderRadius: 12,
  fontSize: 15,
  fontWeight: 500,
  marginBottom: 20,
  textAlign: "center",
  border: "1px solid rgba(16, 185, 129, 0.2)",
}

const mutedStyle: CSSProperties = {
  color: "#71717a",
  textAlign: "center",
  padding: "20px 0",
  fontSize: 15,
}

const errorStyle: CSSProperties = {
  background: "rgba(239, 68, 68, 0.1)",
  color: "#ef4444",
  padding: "14px 16px",
  borderRadius: 12,
  fontSize: 15,
  marginBottom: 20,
  textAlign: "center",
  border: "1px solid rgba(239, 68, 68, 0.2)",
}

const machineCardStyle: CSSProperties = {
  background: "#18181b", 
  border: "1px solid #27272a", 
  borderRadius: 20, // 增加手機版的圓角潤飾感
  padding: "20px 16px",
  marginBottom: 20,
  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
}

const machineHeaderStyle: CSSProperties = {
  borderBottom: "1px solid #27272a",
  paddingBottom: 14,
  marginBottom: 16,
}

const machineTitleStyle: CSSProperties = {
  margin: 0,
  color: "#fafafa",
  fontSize: 18, // 手機上看標題大一點更清晰
  fontWeight: 600,
  letterSpacing: "0.5px",
}

const itemListStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 16, // 商品間距加大，防誤觸
}

const itemCardStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column", // 手機版改為垂直佈局
  gap: 12,
  paddingBottom: 16,
  borderBottom: "1px dashed #27272a",
}

const itemInfoStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
}

const productNameStyle: CSSProperties = {
  fontSize: 16, // 放大品名字體
  fontWeight: 500,
  lineHeight: 1.4,
  color: "#e4e4e7",
}

const skuWrapperStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
}

const skuStyle: CSSProperties = {
  fontSize: 13,
  color: "#a1a1aa",
  background: "#27272a",
  padding: "4px 8px",
  borderRadius: 6,
  fontFamily: "monospace",
}

const boxStyle: CSSProperties = {
  color: "#60a5fa",
  fontSize: 13,
  fontWeight: 500,
}

// 獨立的輸入區塊（帶微弱背景色）
const inputsContainerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  background: "#131316", // 區分出輸入熱區
  border: "1px solid #27272a",
  borderRadius: 14,
  padding: "8px 12px",
}

const inputGroupStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  flex: 1,
  justifyContent: "center",
  gap: 8,
}

const inputDividerStyle: CSSProperties = {
  width: 1,
  height: 32,
  background: "#27272a",
  margin: "0 12px",
}

const unitLabelStyle: CSSProperties = {
  color: "#71717a",
  fontSize: 15,
  fontWeight: 500,
}

const inputStyle: CSSProperties = {
  width: "100%", 
  maxWidth: 80, // 不會無限變寬，保持比例
  height: 48, // 標準手機觸控高度
  borderRadius: 10,
  border: "1px solid #3f3f46",
  background: "#09090b",
  color: "#fafafa",
  fontSize: 18, // 放大輸入數字
  fontWeight: 600,
  textAlign: "center",
  transition: "border-color 0.2s",
  outline: "none",
  padding: 0,
}

const closeButtonStyle: CSSProperties = {
  width: "100%",
  height: 56, // 放大主按鈕觸控高度
  borderRadius: 14,
  border: "none",
  background: "#fafafa", 
  color: "#09090b",
  fontSize: 17,
  fontWeight: 600,
  marginTop: 28,
  cursor: "pointer",
  transition: "opacity 0.2s",
  boxShadow: "0 4px 12px rgba(250, 250, 250, 0.15)", // 增加按鈕立體感
}

const closedBoxStyle: CSSProperties = {
  textAlign: "center",
  color: "#a1a1aa",
  fontSize: 15,
  fontWeight: 500,
  padding: "18px",
  border: "1px dashed #3f3f46",
  borderRadius: 14,
  marginTop: 28,
}