import { useEffect, useMemo, useState, type CSSProperties } from "react"
import { supabase } from "../lib/supabase"

type Props = {
  ledgerId: number | null
  onBack: () => void
}

type LedgerRow = {
  id: number
  group_code: string
  warehouse_code: string
  product_sku: string
  in_box: number
  in_piece: number
  out_box: number
  out_piece: number
  unit_cost_piece: number | null
  in_amount: number | null
  out_amount: number | null
  source: string
  created_at: string
  void_of_id: number | null
  voided_by_id: number | null
}

type ProductInfo = {
  product_sku: string
  product_name: string | null
  units_per_box: number | null
}

type AuditLockRow = {
  biz_date: string | null
}

const CORRECTABLE_SOURCES = [
  "app_inbound",
  "APP_INBOUND",
  "backfill_inbound",
  "line_outbound",
  "LINE_OUTBOUND",
  "backfill_outbound",
  "inventory_audit",
  "machine_remove_inbound",
]

const GROUP_CODE = "catch_0001"

export default function SpecialCorrectionPage({ ledgerId, onBack }: Props) {
  const [inputLedgerId, setInputLedgerId] = useState(ledgerId ? String(ledgerId) : "")
  const [lockBusinessDate, setLockBusinessDate] = useState<string | null>(null)
  const [minBusinessDate, setMinBusinessDate] = useState("")
  const [ledger, setLedger] = useState<LedgerRow | null>(null)
  const [product, setProduct] = useState<ProductInfo | null>(null)
  const [newCost, setNewCost] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    void loadCorrectionLock()
  }, [])

  useEffect(() => {
    if (!ledgerId) return
    setInputLedgerId(String(ledgerId))
    void loadLedger(String(ledgerId))
  }, [ledgerId])

  const direction = ledger ? getDirection(ledger) : "in"
  const quantityPiece = useMemo(() => {
    if (!ledger || !product) return 0
    return calculateQuantityPiece(ledger, product)
  }, [ledger, product])
  const oldAmount =
    ledger && direction === "in" ? Number(ledger.in_amount ?? 0) : Number(ledger?.out_amount ?? 0)
  const nextAmount = useMemo(() => {
    const cost = Number(newCost)
    if (!Number.isFinite(cost) || cost <= 0) return 0
    return quantityPiece * cost
  }, [newCost, quantityPiece])
  const businessDate = ledger ? getLedgerBusinessDate(ledger.created_at) : ""
  const canSubmit =
    Boolean(ledger) &&
    Boolean(product) &&
    direction === "in" &&
    CORRECTABLE_SOURCES.includes(ledger?.source ?? "") &&
    !ledger?.voided_by_id &&
    !isLockedBusinessDate(businessDate, lockBusinessDate) &&
    Number.isFinite(Number(newCost)) &&
    Number(newCost) > 0

  async function loadCorrectionLock() {
    try {
      const latestApprovedAuditDate = await loadLatestApprovedAuditDate()
      setLockBusinessDate(latestApprovedAuditDate)
      setMinBusinessDate(
        latestApprovedAuditDate ? getNextDateText(latestApprovedAuditDate) : ""
      )
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "讀取盤點關帳日失敗")
    }
  }

  async function loadLatestApprovedAuditDate() {
    const { data, error: auditError } = await supabase
      .from("inventory_audits")
      .select("biz_date")
      .eq("group_code", GROUP_CODE)
      .eq("status", "approved")
      .order("biz_date", { ascending: false })
      .limit(1)

    if (auditError) throw auditError

    return ((data ?? []) as AuditLockRow[])[0]?.biz_date ?? null
  }

  async function loadLedger(value = inputLedgerId) {
    const id = Number(value)
    if (!Number.isInteger(id) || id <= 0) {
      setError("請輸入正確的交易編號")
      return
    }

    try {
      setLoading(true)
      setError("")
      setMessage("")
      setLedger(null)
      setProduct(null)

      const { data, error: ledgerError } = await supabase
        .from("inventory_ledger")
        .select(
          "id,group_code,warehouse_code,product_sku,in_box,in_piece,out_box,out_piece,unit_cost_piece,in_amount,out_amount,source,created_at,void_of_id,voided_by_id"
        )
        .eq("group_code", GROUP_CODE)
        .eq("id", id)
        .maybeSingle()

      if (ledgerError) throw ledgerError
      if (!data) throw new Error("找不到這筆交易")

      const nextLedger = data as LedgerRow
      const latestApprovedAuditDate =
        lockBusinessDate ?? (await loadLatestApprovedAuditDate())
      if (!lockBusinessDate) {
        setLockBusinessDate(latestApprovedAuditDate)
        setMinBusinessDate(
          latestApprovedAuditDate ? getNextDateText(latestApprovedAuditDate) : ""
        )
      }

      const ledgerBusinessDate = getLedgerBusinessDate(nextLedger.created_at)
      if (isLockedBusinessDate(ledgerBusinessDate, latestApprovedAuditDate)) {
        throw new Error(
          `已盤點關帳，${latestApprovedAuditDate} 含以前的交易不可特殊校正`
        )
      }

      setLedger(nextLedger)
      setNewCost(
        nextLedger.unit_cost_piece === null || nextLedger.unit_cost_piece === undefined
          ? ""
          : String(nextLedger.unit_cost_piece)
      )

      const { data: productData, error: productError } = await supabase
        .from("products")
        .select("product_sku,product_name,units_per_box")
        .eq("product_sku", nextLedger.product_sku)
        .maybeSingle()

      if (productError) throw productError
      setProduct((productData ?? null) as ProductInfo | null)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "讀取交易失敗")
    } finally {
      setLoading(false)
    }
  }

  async function submitCorrection() {
    if (!ledger || !product) {
      setError("請先讀取交易")
      return
    }

    if (ledger.voided_by_id) {
      setError("已作廢的交易不做成本校正")
      return
    }

    if (direction !== "in") {
      setError("成本校正只限入庫交易，出庫請使用數量校正")
      return
    }

    if (isLockedBusinessDate(businessDate, lockBusinessDate)) {
      setError(`已盤點關帳，${lockBusinessDate} 含以前的交易不可特殊校正`)
      return
    }

    if (!CORRECTABLE_SOURCES.includes(ledger.source)) {
      setError("此來源不開放成本校正")
      return
    }

    const cost = Number(newCost)
    if (!Number.isFinite(cost) || cost <= 0) {
      setError("請輸入大於 0 的新單件成本")
      return
    }

    const ok = window.confirm(
      `確定校正 #${ledger.id} 的單件成本？\n\n` +
        `原成本：${formatMoney(ledger.unit_cost_piece)}\n` +
        `新成本：${formatMoney(cost)}\n` +
        `會從 ${businessDate} 重新計算日結與試算表。`
    )
    if (!ok) return

    try {
      setSaving(true)
      setError("")
      setMessage("")

      const { error: correctionError } = await supabase.rpc(
        "rpc_correct_ledger_cost_v1",
        {
          p_group: GROUP_CODE,
          p_ledger_id: ledger.id,
          p_unit_cost_piece: cost,
          p_actor: "webapp_special_correction",
        }
      )

      if (correctionError) throw correctionError

      const { error: closingError } = await supabase.rpc(
        "rebuild_closings_range_from",
        {
          p_group: GROUP_CODE,
          p_start_biz_date: businessDate,
        }
      )

      if (closingError) {
        throw new Error(`成本已校正，但日結重建失敗：${closingError.message}`)
      }

      const { error: gasError } = await supabase.rpc("push_gas_rebuild_range", {
        p_group: GROUP_CODE,
        p_start_date: businessDate,
        p_end_date: getTodayText(),
        p_reason: "special_cost_correction",
      })

      if (gasError) {
        throw new Error(`成本已校正且日結已重建，但通知試算表失敗：${gasError.message}`)
      }

      setMessage(`已校正 #${ledger.id}，並要求從 ${businessDate} 重建到今天`)
      await loadLedger(String(ledger.id))
    } catch (err) {
      console.error(err)
      setError(formatCorrectionError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={pageStyle}>
      <div style={contentStyle}>
        <header style={topBarStyle}>
          <button onClick={onBack} style={topIconButtonStyle} aria-label="返回">
            ←
          </button>
          <div style={titleWrapStyle}>
            <h1 style={pageTitleStyle}>特殊校正</h1>
          <p style={subtitleStyle}>成本校正，不修改箱數與散數</p>
        </div>
          <button
            onClick={() => void loadLedger()}
            style={topTextButtonStyle}
            disabled={loading}
          >
            讀取
          </button>
        </header>

        {message && <div style={messageStyle}>{message}</div>}
        {error && <div style={errorStyle}>{error}</div>}
        {lockBusinessDate && (
          <div style={lockNoticeStyle}>
            最近盤點關帳：{lockBusinessDate}，只能校正 {minBusinessDate} 起的交易
          </div>
        )}

        <section style={panelStyle}>
          <label style={labelStyle}>交易編號</label>
          <input
            value={inputLedgerId}
            onChange={(event) => setInputLedgerId(event.target.value)}
            inputMode="numeric"
            placeholder="輸入交易編號，例如 4132"
            style={inputStyle}
          />
          <button disabled={loading} onClick={() => void loadLedger()} style={secondaryButtonStyle}>
            {loading ? "讀取中..." : "讀取交易"}
          </button>
        </section>

        {ledger && product && (
          <>
            <section style={cardStyle}>
              <div style={cardHeaderStyle}>
                <div>
                  <div style={skuStyle}>{ledger.product_sku}</div>
                  <div style={nameStyle}>{product.product_name || "未命名商品"}</div>
                </div>
                <span style={direction === "in" ? inboundBadgeStyle : outboundBadgeStyle}>
                  {direction === "in" ? "入庫" : "出庫"}
                </span>
              </div>

              <div style={infoGridStyle}>
                <Info label="交易編號" value={`#${ledger.id}`} />
                <Info label="來源" value={ledger.source} />
                <Info label="倉庫" value={formatWarehouse(ledger.warehouse_code)} />
                <Info label="業務日" value={businessDate} />
                <Info label="箱入數" value={formatNumber(product.units_per_box ?? 0)} />
                <Info label="總件數" value={formatNumber(quantityPiece)} />
                <Info label="箱數" value={formatNumber(direction === "in" ? ledger.in_box : ledger.out_box)} />
                <Info label="散數" value={formatNumber(direction === "in" ? ledger.in_piece : ledger.out_piece)} />
              </div>

              {ledger.voided_by_id && (
                <div style={warningStyle}>此交易已作廢，不做成本校正。</div>
              )}

              {!CORRECTABLE_SOURCES.includes(ledger.source) && (
                <div style={warningStyle}>此交易來源不開放成本校正。</div>
              )}

              {direction !== "in" && (
                <div style={warningStyle}>
                  成本校正只限入庫交易，這筆出庫交易請改用數量校正。
                </div>
              )}
            </section>

            <section style={panelStyle}>
              <div style={amountGridStyle}>
                <Info label="原單件成本" value={formatMoney(ledger.unit_cost_piece)} />
                <Info label="原金額" value={formatMoney(oldAmount)} />
              </div>

              <label style={labelStyle}>新單件成本</label>
              <input
                value={newCost}
                onChange={(event) => setNewCost(event.target.value)}
                inputMode="decimal"
                type="number"
                min={0}
                placeholder="輸入新的單件成本"
                style={inputStyle}
              />

              <div style={amountPreviewStyle}>
                <span>重算金額</span>
                <strong>$ {formatMoney(nextAmount)}</strong>
              </div>
            </section>

            <button
              disabled={!canSubmit || saving}
              onClick={() => void submitCorrection()}
              style={{
                ...primaryButtonStyle,
                opacity: !canSubmit || saving ? 0.48 : 1,
              }}
            >
              {saving ? "校正中..." : "送出成本校正"}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={infoBoxStyle}>
      <span style={infoLabelStyle}>{label}</span>
      <strong style={infoValueStyle}>{value}</strong>
    </div>
  )
}

function getDirection(row: LedgerRow) {
  const hasIn = Number(row.in_box ?? 0) > 0 || Number(row.in_piece ?? 0) > 0
  return hasIn ? "in" : "out"
}

function calculateQuantityPiece(row: LedgerRow, product: ProductInfo) {
  const unitsPerBox = Number(product.units_per_box ?? 1) || 1
  if (getDirection(row) === "in") {
    return Number(row.in_box ?? 0) * unitsPerBox + Number(row.in_piece ?? 0)
  }

  return Number(row.out_box ?? 0) * unitsPerBox + Number(row.out_piece ?? 0)
}

function getLedgerBusinessDate(createdAt: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date(createdAt))

  const year = parts.find((part) => part.type === "year")?.value ?? ""
  const month = parts.find((part) => part.type === "month")?.value ?? ""
  const day = parts.find((part) => part.type === "day")?.value ?? ""
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0")

  const base = new Date(`${year}-${month}-${day}T12:00:00+08:00`)
  if (hour < 5) base.setDate(base.getDate() - 1)

  return formatDateInput(base)
}

function getNextDateText(dateText: string) {
  const date = new Date(`${dateText}T12:00:00+08:00`)
  date.setDate(date.getDate() + 1)
  return formatDateInput(date)
}

function isLockedBusinessDate(dateText: string, lockBusinessDate: string | null) {
  return Boolean(lockBusinessDate && dateText && dateText <= lockBusinessDate)
}

function getTodayText() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())

  const year = parts.find((part) => part.type === "year")?.value ?? ""
  const month = parts.find((part) => part.type === "month")?.value ?? ""
  const day = parts.find((part) => part.type === "day")?.value ?? ""

  return `${year}-${month}-${day}`
}

function formatDateInput(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function formatWarehouse(code: string) {
  const names: Record<string, string> = {
    main: "總倉",
    onsite: "現場",
    swap: "夾換品",
    withdraw: "撤台",
  }

  return names[code] ?? code
}

function formatNumber(value: number | null | undefined) {
  const numberValue = Number(value ?? 0)
  return Number.isInteger(numberValue) ? String(numberValue) : String(numberValue)
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return "-"
  return Number(value).toLocaleString("zh-TW", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function formatCorrectionError(err: unknown) {
  const message = err instanceof Error ? err.message : "成本校正失敗"

  if (message.includes("ERR_LEDGER_NOT_FOUND")) return "找不到這筆交易"
  if (message.includes("ERR_BAD_COST")) return "請輸入大於 0 的新單件成本"
  if (message.includes("ERR_LEDGER_VOIDED")) return "已作廢的交易不能校正成本"
  if (message.includes("ERR_TX_VOID_NOT_ALLOWED")) return "tx_void 回沖紀錄不能校正成本"
  if (message.includes("ERR_ZERO_QTY")) return "此交易沒有箱數或散數，不能校正成本"
  if (message.includes("ERR_COST_CORRECTION_INBOUND_ONLY")) {
    return "成本校正只限入庫交易"
  }
  if (message.includes("ERR_CORRECTION_LOCKED_BY_APPROVED_AUDIT")) {
    return "已盤點關帳，這筆交易不可特殊校正"
  }

  return message
}

const pageStyle: CSSProperties = {
  minHeight: "100dvh",
  background: "#0f0f0f",
  color: "#fff",
  padding: "calc(env(safe-area-inset-top, 0px) + 24px) 16px 24px",
  boxSizing: "border-box",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
}

const contentStyle: CSSProperties = {
  width: "100%",
  maxWidth: 620,
  margin: "0 auto",
}

const topBarStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "42px minmax(0, 1fr) 54px",
  alignItems: "center",
  gap: 10,
  marginBottom: 14,
}

const topIconButtonStyle: CSSProperties = {
  width: 42,
  height: 42,
  border: "none",
  borderRadius: 12,
  background: "transparent",
  color: "#fff",
  fontSize: 28,
  lineHeight: 1,
}

const topTextButtonStyle: CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#5aa2ff",
  fontSize: 15,
  fontWeight: 900,
}

const titleWrapStyle: CSSProperties = {
  minWidth: 0,
  textAlign: "center",
}

const pageTitleStyle: CSSProperties = {
  margin: 0,
  color: "#fff",
  fontSize: 22,
  fontWeight: 900,
}

const subtitleStyle: CSSProperties = {
  margin: "3px 0 0",
  color: "#999",
  fontSize: 12,
  fontWeight: 700,
}

const panelStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  border: "1px solid #333",
  borderRadius: 18,
  background: "#171717",
  padding: 14,
  marginBottom: 12,
}

const lockNoticeStyle: CSSProperties = {
  border: "1px solid rgba(90,162,255,0.28)",
  borderRadius: 12,
  background: "rgba(90,162,255,0.1)",
  color: "#bfdbfe",
  padding: "10px 12px",
  marginBottom: 12,
  fontSize: 13,
  fontWeight: 800,
}

const labelStyle: CSSProperties = {
  color: "#bbb",
  fontSize: 13,
  fontWeight: 850,
}

const inputStyle: CSSProperties = {
  width: "100%",
  height: 44,
  borderRadius: 12,
  border: "1px solid #3c3c3c",
  background: "#242424",
  color: "#fff",
  fontSize: 16,
  padding: "0 12px",
  boxSizing: "border-box",
}

const secondaryButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: 42,
  border: "none",
  borderRadius: 12,
  background: "#2f2f2f",
  color: "#fff",
  fontSize: 15,
  fontWeight: 900,
}

const cardStyle: CSSProperties = {
  border: "1px solid #333",
  borderRadius: 18,
  background: "#171717",
  padding: 14,
  marginBottom: 12,
}

const cardHeaderStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: 12,
  alignItems: "start",
  marginBottom: 14,
}

const skuStyle: CSSProperties = {
  color: "#fff",
  fontSize: 22,
  fontWeight: 950,
  overflowWrap: "anywhere",
}

const nameStyle: CSSProperties = {
  color: "#ddd",
  fontSize: 15,
  fontWeight: 800,
  marginTop: 5,
  overflowWrap: "anywhere",
}

const inboundBadgeStyle: CSSProperties = {
  borderRadius: 999,
  background: "rgba(90,162,255,0.18)",
  color: "#bfdbfe",
  border: "1px solid rgba(90,162,255,0.34)",
  padding: "7px 11px",
  fontSize: 13,
  fontWeight: 900,
}

const outboundBadgeStyle: CSSProperties = {
  ...inboundBadgeStyle,
  background: "rgba(248,113,113,0.18)",
  color: "#fecaca",
  border: "1px solid rgba(248,113,113,0.34)",
}

const infoGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
}

const infoBoxStyle: CSSProperties = {
  border: "1px solid #2c2c2c",
  borderRadius: 12,
  background: "#101010",
  padding: "10px 11px",
  minWidth: 0,
}

const infoLabelStyle: CSSProperties = {
  display: "block",
  color: "#999",
  fontSize: 12,
  fontWeight: 800,
  marginBottom: 6,
}

const infoValueStyle: CSSProperties = {
  display: "block",
  color: "#fff",
  fontSize: 15,
  fontWeight: 900,
  overflowWrap: "anywhere",
}

const amountGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
}

const amountPreviewStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  alignItems: "center",
  border: "1px solid rgba(90,162,255,0.28)",
  borderRadius: 14,
  background: "rgba(90,162,255,0.12)",
  color: "#bfdbfe",
  padding: 12,
  fontSize: 14,
  fontWeight: 850,
}

const warningStyle: CSSProperties = {
  borderRadius: 12,
  background: "rgba(248,113,113,0.12)",
  color: "#fecaca",
  padding: 10,
  fontSize: 13,
  marginTop: 12,
}

const primaryButtonStyle: CSSProperties = {
  position: "sticky",
  bottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
  width: "100%",
  minHeight: 54,
  border: "none",
  borderRadius: 16,
  background: "#5aa2ff",
  color: "#fff",
  fontSize: 18,
  fontWeight: 900,
}

const messageStyle: CSSProperties = {
  background: "rgba(34,197,94,0.12)",
  color: "#86efac",
  border: "1px solid rgba(34,197,94,0.28)",
  borderRadius: 12,
  padding: 12,
  marginBottom: 12,
  fontSize: 14,
}

const errorStyle: CSSProperties = {
  background: "rgba(248,113,113,0.12)",
  color: "#ff6666",
  border: "1px solid rgba(248,113,113,0.28)",
  borderRadius: 12,
  padding: 12,
  marginBottom: 12,
  fontSize: 14,
}
