import { useEffect, useMemo, useState, type CSSProperties } from "react"
import { supabase } from "../lib/supabase"

type Props = {
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

type MovementProbe = {
  id: number
  product_sku: string
  warehouse_code: string
  created_at: string
}

type ProductMap = Record<string, ProductInfo>
type FollowingMap = Record<number, boolean>
type CorrectionMode = "quantity" | "cost"

const GROUP_CODE = "catch_0001"
const RECORD_SOURCES = [
  "app_inbound",
  "APP_INBOUND",
  "backfill_inbound",
  "line_outbound",
  "LINE_OUTBOUND",
  "backfill_outbound",
  "tx_void",
  "manual_adjustment",
]
const VOIDABLE_SOURCES = [
  "app_inbound",
  "APP_INBOUND",
  "backfill_inbound",
  "line_outbound",
  "LINE_OUTBOUND",
  "backfill_outbound",
]
const CORRECTION_REASON_OPTIONS = [
  "作廢單錯帳",
  "逾期交易修正",
  "後續已有交易，無法作廢",
  "盤點差異修正",
  "其他",
]

export default function LineBotPage({ onBack }: Props) {
  const [businessDate, setBusinessDate] = useState(() => getBusinessDateText())
  const [rows, setRows] = useState<LedgerRow[]>([])
  const [products, setProducts] = useState<ProductMap>({})
  const [followingMap, setFollowingMap] = useState<FollowingMap>({})
  const [loading, setLoading] = useState(false)
  const [voidingId, setVoidingId] = useState<number | null>(null)
  const [selectedCorrectionRow, setSelectedCorrectionRow] = useState<LedgerRow | null>(
    null
  )
  const [correctionReason, setCorrectionReason] = useState(CORRECTION_REASON_OPTIONS[0])
  const [correctionNote, setCorrectionNote] = useState("")
  const [correctionMode, setCorrectionMode] = useState<CorrectionMode>("quantity")
  const [costCorrectionValue, setCostCorrectionValue] = useState("")
  const [correcting, setCorrecting] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    void loadRecords()
  }, [])

  const todayBusinessDate = getBusinessDateText()

  const filteredRows = useMemo(() => {
    return rows
  }, [rows])

  const summary = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => {
        if (row.voided_by_id) {
          acc.voided += 1
        } else if (getDirection(row) === "in") {
          acc.inbound += 1
        } else {
          acc.outbound += 1
        }
        return acc
      },
      { inbound: 0, outbound: 0, voided: 0 }
    )
  }, [filteredRows])

  async function loadRecords(nextBusinessDate = businessDate) {
    try {
      setLoading(true)
      setError("")
      setMessage("")

      const { start, end } = getBusinessDateRange(nextBusinessDate)
      const { data, error: ledgerError } = await supabase
        .from("inventory_ledger")
        .select(
          "id,group_code,warehouse_code,product_sku,in_box,in_piece,out_box,out_piece,unit_cost_piece,in_amount,out_amount,source,created_at,void_of_id,voided_by_id"
        )
        .eq("group_code", GROUP_CODE)
        .in("source", RECORD_SOURCES)
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at", { ascending: false })
        .limit(160)

      if (ledgerError) throw ledgerError

      const nextRows = (data ?? []) as LedgerRow[]
      setRows(nextRows)
      await loadProducts(nextRows)
      await loadFollowingMovementMap(nextRows)
    } catch (err) {
      console.error(err)
      setRows([])
      setProducts({})
      setFollowingMap({})
      setError(err instanceof Error ? err.message : "讀取交易紀錄失敗")
    } finally {
      setLoading(false)
    }
  }

  function handleBusinessDateChange(value: string) {
    setBusinessDate(value)
    void loadRecords(value)
  }

  async function loadProducts(nextRows: LedgerRow[]) {
    const skus = Array.from(new Set(nextRows.map((row) => row.product_sku))).filter(Boolean)

    if (skus.length === 0) {
      setProducts({})
      return
    }

    const { data, error: productError } = await supabase
      .from("products")
      .select("product_sku,product_name,units_per_box")
      .in("product_sku", skus)

    if (productError) throw productError

    const nextProducts = ((data ?? []) as ProductInfo[]).reduce<ProductMap>(
      (acc, row) => {
        acc[row.product_sku] = row
        return acc
      },
      {}
    )

    setProducts(nextProducts)
  }

  async function loadFollowingMovementMap(nextRows: LedgerRow[]) {
    if (nextRows.length === 0) {
      setFollowingMap({})
      return
    }

    const skus = Array.from(new Set(nextRows.map((row) => row.product_sku))).filter(Boolean)
    const warehouses = Array.from(
      new Set(nextRows.map((row) => row.warehouse_code))
    ).filter(Boolean)
    const earliestCreatedAt = nextRows.reduce((earliest, row) => {
      return row.created_at < earliest ? row.created_at : earliest
    }, nextRows[0].created_at)

    const { data, error: movementError } = await supabase
      .from("inventory_ledger")
      .select("id,product_sku,warehouse_code,created_at")
      .eq("group_code", GROUP_CODE)
      .in("product_sku", skus)
      .in("warehouse_code", warehouses)
      .gte("created_at", earliestCreatedAt)
      .order("created_at", { ascending: true })
      .limit(1200)

    if (movementError) throw movementError

    const movements = (data ?? []) as MovementProbe[]
    const nextMap = nextRows.reduce<FollowingMap>((acc, row) => {
      acc[row.id] = movements.some((movement) => {
        if (movement.product_sku !== row.product_sku) return false
        if (movement.warehouse_code !== row.warehouse_code) return false
        return (
          movement.created_at > row.created_at ||
          (movement.created_at === row.created_at && movement.id > row.id)
        )
      })
      return acc
    }, {})

    setFollowingMap(nextMap)
  }

  function getVoidState(row: LedgerRow) {
    if (row.voided_by_id) return { canVoid: false, label: "已作廢", tone: "muted" }
    if (!VOIDABLE_SOURCES.includes(row.source)) {
      return { canVoid: false, label: "不可作廢", tone: "muted" }
    }
    if (getLedgerBusinessDate(row.created_at) !== todayBusinessDate) {
      return { canVoid: false, label: "非今日", tone: "muted" }
    }
    if (followingMap[row.id]) return { canVoid: false, label: "有後續", tone: "muted" }
    return { canVoid: true, label: "作廢", tone: "danger" }
  }

  function openCorrection(row: LedgerRow) {
    setSelectedCorrectionRow(row)
    setCorrectionReason(
      row.source.toLowerCase() === "tx_void"
        ? "作廢單錯帳"
        : getVoidState(row).label === "有後續"
          ? "後續已有交易，無法作廢"
          : getLedgerBusinessDate(row.created_at) !== todayBusinessDate
            ? "逾期交易修正"
            : "其他"
    )
    setCorrectionNote("")
    setCorrectionMode("quantity")
    setCostCorrectionValue(
      row.unit_cost_piece === null || row.unit_cost_piece === undefined
        ? ""
        : String(row.unit_cost_piece)
    )
    setMessage("")
    setError("")
  }

  function closeCorrection() {
    setSelectedCorrectionRow(null)
    setCorrectionNote("")
    setCorrectionMode("quantity")
    setCostCorrectionValue("")
    setError("")
  }

  async function voidTransaction(row: LedgerRow) {
    const state = getVoidState(row)
    if (!state.canVoid) return

    const directionLabel = getDirection(row) === "in" ? "入庫" : "出庫"
    const ok = window.confirm(
      `確定作廢 #${row.id} ${row.product_sku} 的${directionLabel}紀錄？\n系統會建立 tx_void 回沖庫存。`
    )
    if (!ok) return

    try {
      setVoidingId(row.id)
      setError("")
      setMessage("")

      const { error: voidError } = await supabase.rpc("rpc_tx_void", {
        p_group: GROUP_CODE,
        p_ledger_id: row.id,
        p_actor: "app_transaction_page",
      })

      if (voidError) throw voidError

      setMessage(`已作廢交易 #${row.id}`)
      await loadRecords()
    } catch (err) {
      console.error(err)
      setError(formatVoidError(err))
    } finally {
      setVoidingId(null)
    }
  }

  async function submitManualAdjustment() {
    if (!selectedCorrectionRow) return

    if (!correctionNote.trim()) {
      setError("特殊校正必須填寫備註")
      return
    }

    const proposal = getCorrectionProposal(selectedCorrectionRow)
    const ok = window.confirm(
      `確定送出特殊校正？\n原紀錄 #${selectedCorrectionRow.id} ${getDirectionLabel(
        getDirection(selectedCorrectionRow)
      )} ${formatQty(proposal.originalBox)}箱 ${formatQty(
        proposal.originalPiece
      )}散\n將建立 ${proposal.adjustDirectionLabel} ${formatQty(
        proposal.adjustBox
      )}箱 ${formatQty(proposal.adjustPiece)}散。`
    )
    if (!ok) return

    try {
      setCorrecting(true)
      setError("")
      setMessage("")

      const { error: adjustmentError } = await supabase.rpc(
        "rpc_manual_adjust_inventory_from_ledger",
        {
          p_group: GROUP_CODE,
          p_ledger_id: selectedCorrectionRow.id,
          p_reason: correctionReason,
          p_note: correctionNote.trim(),
          p_actor: "app_transaction_page",
        }
      )

      if (adjustmentError) throw adjustmentError

      setMessage(`已建立 #${selectedCorrectionRow.id} 的特殊校正`)
      setSelectedCorrectionRow(null)
      setCorrectionNote("")
      await loadRecords()
    } catch (err) {
      console.error(err)
      setError(formatAdjustmentError(err))
    } finally {
      setCorrecting(false)
    }
  }

  async function submitCostCorrection() {
    if (!selectedCorrectionRow) return

    const nextCost = Number(costCorrectionValue)
    if (!Number.isFinite(nextCost) || nextCost <= 0) {
      setError("請輸入正確的單件成本")
      return
    }

    const product = products[selectedCorrectionRow.product_sku]
    const originalCost = Number(selectedCorrectionRow.unit_cost_piece ?? 0)
    const quantityPiece = getQuantityPiece(selectedCorrectionRow, product)
    const nextAmount = quantityPiece * nextCost
    const ledgerBizDate = getLedgerBusinessDate(selectedCorrectionRow.created_at)

    const ok = window.confirm(
      `確定校正 #${selectedCorrectionRow.id} 的成本？\n單件成本：${formatMoney(
        originalCost
      )} → ${formatMoney(nextCost)}\n重新計算金額：${formatMoney(
        nextAmount
      )}\n系統會從 ${ledgerBizDate} 重新關帳並通知試算表。`
    )
    if (!ok) return

    try {
      setCorrecting(true)
      setError("")
      setMessage("")

      const { error: correctionError } = await supabase.rpc("rpc_correct_ledger_cost_v1", {
        p_group: GROUP_CODE,
        p_ledger_id: selectedCorrectionRow.id,
        p_unit_cost_piece: nextCost,
        p_actor: "app_transaction_page",
      })

      if (correctionError) throw correctionError

      const { error: closingError } = await supabase.rpc("rebuild_closings_range_from", {
        p_group: GROUP_CODE,
        p_start_biz_date: ledgerBizDate,
      })

      if (closingError) {
        throw new Error(`成本已校正，但重建關帳失敗：${closingError.message}`)
      }

      const { error: gasError } = await supabase.rpc("push_gas_rebuild_range", {
        p_group: GROUP_CODE,
        p_start_date: ledgerBizDate,
        p_end_date: getBusinessDateText(),
        p_reason: "cost_correction",
      })

      if (gasError) {
        throw new Error(`成本已校正且關帳已重建，但通知試算表失敗：${gasError.message}`)
      }

      setMessage(`已校正 #${selectedCorrectionRow.id} 的成本`)
      setSelectedCorrectionRow(null)
      setCorrectionNote("")
      setCorrectionMode("quantity")
      setCostCorrectionValue("")
      await loadRecords()
    } catch (err) {
      console.error(err)
      setError(formatCostCorrectionError(err))
    } finally {
      setCorrecting(false)
    }
  }

  return (
    <div style={pageStyle}>
      <div style={contentStyle}>
        <header style={topBarStyle}>
          <button
            onClick={selectedCorrectionRow ? closeCorrection : onBack}
            style={topIconButtonStyle}
            aria-label="返回"
          >
            ←
          </button>
          <h1 style={pageTitleStyle}>
            {selectedCorrectionRow ? "特殊校正" : "交易紀錄"}
          </h1>
          {selectedCorrectionRow ? (
            <span />
          ) : (
            <button
              onClick={() => void loadRecords()}
              style={topIconButtonStyle}
              aria-label="重新整理"
              disabled={loading}
            >
              ↻
            </button>
          )}
        </header>

        {message && <div style={messageStyle}>{message}</div>}
        {error && <div style={errorStyle}>{error}</div>}

        {selectedCorrectionRow ? (
          <CorrectionPanel
            row={selectedCorrectionRow}
            product={products[selectedCorrectionRow.product_sku]}
            reason={correctionReason}
            note={correctionNote}
            mode={correctionMode}
            costValue={costCorrectionValue}
            correcting={correcting}
            onReasonChange={setCorrectionReason}
            onNoteChange={setCorrectionNote}
            onModeChange={setCorrectionMode}
            onCostChange={setCostCorrectionValue}
            onSubmit={submitManualAdjustment}
            onCostSubmit={submitCostCorrection}
          />
        ) : (
          <>
            <section style={filterPanelStyle}>
              <input
                aria-label="日期"
                value={businessDate}
                onChange={(event) => handleBusinessDateChange(event.target.value)}
                type="date"
                style={{ ...inputStyle, ...dateInputStyle }}
              />

              {loading && <div style={loadingHintStyle}>查詢中...</div>}
            </section>

            <div style={summaryRowStyle}>
              <span>入庫 {summary.inbound}</span>
              <span>出庫 {summary.outbound}</span>
              <span>已作廢 {summary.voided}</span>
              <span>{filteredRows.length} 筆</span>
            </div>

            {loading && <div style={emptyStyle}>讀取交易紀錄中...</div>}

            {!loading && filteredRows.length === 0 && (
              <div style={emptyStyle}>目前沒有符合條件的交易紀錄</div>
            )}

            {!loading && filteredRows.length > 0 && (
              <section style={recordListStyle}>
                {filteredRows.map((row) => {
                  const product = products[row.product_sku]
                  const direction = getDirection(row)
                  const qtyBox = direction === "in" ? row.in_box : row.out_box
                  const qtyPiece = direction === "in" ? row.in_piece : row.out_piece
                  const amount = getDisplayAmount(row, product)
                  const voidState = getVoidState(row)

                  return (
                    <article key={row.id} style={recordCardStyle}>
                      <div style={cardTopStyle}>
                        <span
                          style={direction === "in" ? inboundMarkStyle : outboundMarkStyle}
                        >
                          {direction === "in" ? "入" : "出"}
                        </span>

                        <span style={topMetaStyle}>{formatTaipeiShort(row.created_at)}</span>
                        <span style={topMetaStyle}>{formatWarehouse(row.warehouse_code)}</span>
                        <span style={amountStyle}>$ {formatMoney(amount)}</span>

                        {voidState.canVoid ? (
                          <button
                            disabled={voidingId === row.id}
                            onClick={() => void voidTransaction(row)}
                            style={voidButtonStyle}
                          >
                            {voidingId === row.id ? "處理中" : "作廢"}
                          </button>
                        ) : (
                          <span style={disabledVoidStyle}>{voidState.label}</span>
                        )}
                      </div>

                      <div style={skuStyle}>{row.product_sku}</div>
                      <div style={nameStyle}>{product?.product_name || "未命名商品"}</div>

                      <div style={cardBottomStyle}>
                        <div style={qtyBoxStyle}>
                          <span style={qtyLabelStyle}>箱</span>
                          <strong style={qtyValueStyle}>{formatQty(qtyBox)}</strong>
                        </div>
                        <div style={qtyBoxStyle}>
                          <span style={qtyLabelStyle}>散</span>
                          <strong style={qtyValueStyle}>{formatQty(qtyPiece)}</strong>
                        </div>
                        <button
                          type="button"
                          onClick={() => openCorrection(row)}
                          style={idButtonStyle}
                        >
                          #{row.id}
                        </button>
                      </div>

                      {row.voided_by_id && (
                        <div style={voidInfoStyle}>作廢回沖紀錄：#{row.voided_by_id}</div>
                      )}

                      {!row.voided_by_id && !voidState.canVoid && (
                        <div style={voidInfoStyle}>{getDisabledReason(voidState.label)}</div>
                      )}
                    </article>
                  )
                })}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}

type CorrectionPanelProps = {
  row: LedgerRow
  product?: ProductInfo
  reason: string
  note: string
  mode: CorrectionMode
  costValue: string
  correcting: boolean
  onReasonChange: (value: string) => void
  onNoteChange: (value: string) => void
  onModeChange: (value: CorrectionMode) => void
  onCostChange: (value: string) => void
  onSubmit: () => void
  onCostSubmit: () => void
}

function CorrectionPanel({
  row,
  product,
  reason,
  note,
  mode,
  costValue,
  correcting,
  onReasonChange,
  onNoteChange,
  onModeChange,
  onCostChange,
  onSubmit,
  onCostSubmit,
}: CorrectionPanelProps) {
  const proposal = getCorrectionProposal(row)
  const quantityPiece = getQuantityPiece(row, product)
  const originalAmount = getDisplayAmount(row, product)
  const nextCost = Number(costValue)
  const previewAmount =
    Number.isFinite(nextCost) && nextCost > 0 ? quantityPiece * nextCost : null

  return (
    <section style={correctionPanelStyle}>
      <div style={correctionNoticeStyle}>
        數量校正會新增 manual_adjustment；成本校正會更新原交易成本，並從原交易業務日重建日結。
      </div>

      <div style={modeSwitchStyle}>
        <button
          type="button"
          onClick={() => onModeChange("quantity")}
          style={mode === "quantity" ? modeButtonActiveStyle : modeButtonStyle}
        >
          數量校正
        </button>
        <button
          type="button"
          onClick={() => onModeChange("cost")}
          style={mode === "cost" ? modeButtonActiveStyle : modeButtonStyle}
        >
          成本校正
        </button>
      </div>

      <div style={detailGridStyle}>
        <InfoItem label="交易編號" value={`#${row.id}`} />
        <InfoItem label="來源" value={formatSource(row.source)} />
        <InfoItem label="商品" value={`${row.product_sku} ${product?.product_name ?? ""}`} />
        <InfoItem label="倉庫" value={formatWarehouse(row.warehouse_code)} />
        <InfoItem
          label="原紀錄"
          value={`${getDirectionLabel(getDirection(row))} ${formatQty(
            proposal.originalBox
          )}箱 ${formatQty(proposal.originalPiece)}散`}
        />
        <InfoItem
          label="建議校正"
          value={`${proposal.adjustDirectionLabel} ${formatQty(
            proposal.adjustBox
          )}箱 ${formatQty(proposal.adjustPiece)}散`}
        />
      </div>

      {mode === "quantity" ? (
        <>
          <label style={labelStyle}>原因</label>
          <select
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            style={inputStyle}
          >
            {CORRECTION_REASON_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <label style={labelStyle}>備註（必填）</label>
          <textarea
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            placeholder="請輸入校正原因，例如：tx_void 重複計算造成庫存錯誤"
            style={textareaStyle}
          />

          <button
            type="button"
            onClick={onSubmit}
            disabled={correcting}
            style={{
              ...submitCorrectionButtonStyle,
              opacity: correcting ? 0.65 : 1,
            }}
          >
            {correcting ? "送出中..." : "送出數量校正"}
          </button>
        </>
      ) : (
        <>
          <div style={costPreviewStyle}>
            <InfoItem label="原單件成本" value={formatMoney(row.unit_cost_piece)} />
            <InfoItem label="原金額" value={formatMoney(originalAmount)} />
            <InfoItem label="計算數量" value={`${formatQty(quantityPiece)} 件`} />
            <InfoItem
              label="新金額"
              value={previewAmount === null ? "請輸入成本" : formatMoney(previewAmount)}
            />
          </div>

          <label style={labelStyle}>新單件成本</label>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={costValue}
            onChange={(event) => onCostChange(event.target.value)}
            placeholder="請輸入正確單件成本"
            style={inputStyle}
          />

          <button
            type="button"
            onClick={onCostSubmit}
            disabled={correcting}
            style={{
              ...submitCorrectionButtonStyle,
              opacity: correcting ? 0.65 : 1,
            }}
          >
            {correcting ? "送出中..." : "送出成本校正"}
          </button>
        </>
      )}
    </section>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={infoItemStyle}>
      <div style={infoLabelStyle}>{label}</div>
      <div style={infoValueStyle}>{value}</div>
    </div>
  )
}

function getDirection(row: LedgerRow) {
  const hasIn = Number(row.in_box ?? 0) > 0 || Number(row.in_piece ?? 0) > 0
  return hasIn ? "in" : "out"
}

function getDirectionLabel(direction: "in" | "out") {
  return direction === "in" ? "入庫" : "出庫"
}

function getCorrectionProposal(row: LedgerRow) {
  const direction = getDirection(row)
  const originalBox = direction === "in" ? row.in_box : row.out_box
  const originalPiece = direction === "in" ? row.in_piece : row.out_piece
  const adjustDirection = direction === "in" ? "out" : "in"

  return {
    originalBox,
    originalPiece,
    adjustDirection,
    adjustDirectionLabel: adjustDirection === "in" ? "校正入庫" : "校正出庫",
    adjustBox: originalBox,
    adjustPiece: originalPiece,
  }
}

function getDisplayAmount(row: LedgerRow, product?: ProductInfo) {
  const direction = getDirection(row)
  const storedAmount = direction === "in" ? row.in_amount : row.out_amount

  if (storedAmount !== null && storedAmount !== undefined && Number(storedAmount) > 0) {
    return Number(storedAmount)
  }

  const unitsPerBox = Number(product?.units_per_box ?? 1) || 1
  const boxQty = direction === "in" ? Number(row.in_box ?? 0) : Number(row.out_box ?? 0)
  const pieceQty = direction === "in" ? Number(row.in_piece ?? 0) : Number(row.out_piece ?? 0)
  const unitCost = Number(row.unit_cost_piece ?? 0)

  return ((boxQty * unitsPerBox) + pieceQty) * unitCost
}

function getQuantityPiece(row: LedgerRow, product?: ProductInfo) {
  const direction = getDirection(row)
  const unitsPerBox = Number(product?.units_per_box ?? 1) || 1
  const boxQty = direction === "in" ? Number(row.in_box ?? 0) : Number(row.out_box ?? 0)
  const pieceQty = direction === "in" ? Number(row.in_piece ?? 0) : Number(row.out_piece ?? 0)

  return boxQty * unitsPerBox + pieceQty
}

function getDisabledReason(label: string) {
  if (label === "非今日") return "只允許作廢今日業務日的交易"
  if (label === "有後續") return "同商品同倉庫後面已有異動，不能直接作廢"
  if (label === "已作廢") return "此交易已經作廢過"
  return "此交易不可作廢"
}

function getBusinessDateText() {
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
  const hour = Number(taipeiParts.find((part) => part.type === "hour")?.value ?? "0")

  const base = new Date(`${year}-${month}-${day}T12:00:00+08:00`)
  if (hour < 5) base.setDate(base.getDate() - 1)

  return formatDateInput(base)
}

function getBusinessDateRange(dateText: string) {
  const start = `${dateText}T05:00:00+08:00`
  const endDate = new Date(`${dateText}T12:00:00+08:00`)
  endDate.setDate(endDate.getDate() + 1)

  return {
    start,
    end: `${formatDateInput(endDate)}T05:00:00+08:00`,
  }
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

function formatDateInput(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function formatTaipeiShort(value: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value))
}

function formatQty(value: number | null | undefined) {
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

function formatWarehouse(code: string) {
  const names: Record<string, string> = {
    main: "總倉",
    onsite: "現場",
    swap: "夾換品",
    withdraw: "撤台",
  }

  return names[code] ?? code
}

function formatSource(source: string) {
  const labels: Record<string, string> = {
    app_inbound: "入庫",
    APP_INBOUND: "入庫",
    backfill_inbound: "補入庫",
    line_outbound: "LINE出庫",
    LINE_OUTBOUND: "LINE出庫",
    backfill_outbound: "補出庫",
    tx_void: "作廢回沖",
    manual_adjustment: "特殊校正",
  }

  return labels[source] ?? source
}

function formatVoidError(err: unknown) {
  const message = err instanceof Error ? err.message : "作廢失敗"

  if (message.includes("TX_NOT_FOUND")) return "找不到這筆交易"
  if (message.includes("TX_IS_VOID_ALREADY")) return "作廢紀錄本身不能再作廢"
  if (message.includes("TX_ALREADY_VOIDED")) return "這筆交易已經作廢過"
  if (message.includes("TX_SOURCE_NOT_ALLOWED")) return "這筆不是可作廢的入庫或 LINE 出庫"
  if (message.includes("TX_NOT_TODAY_BIZDAY")) return "只能作廢今日業務日的交易"
  if (message.includes("TX_HAS_AFTER_MOVEMENTS")) {
    return "同商品同倉庫後面已有其他異動，不能直接作廢這筆"
  }
  if (message.includes("INSUFFICIENT_BOX_FOR_VOID")) return "庫存箱數不足，不能作廢"
  if (message.includes("INSUFFICIENT_PIECE_FOR_VOID")) return "庫存散數不足，不能作廢"

  return message
}

function formatAdjustmentError(err: unknown) {
  const message = err instanceof Error ? err.message : "特殊校正失敗"

  if (message.includes("ERR_LEDGER_NOT_FOUND")) return "找不到這筆交易"
  if (message.includes("ERR_LEDGER_ALREADY_VOIDED")) return "已作廢的交易不能再特殊校正"
  if (message.includes("ERR_COMPLEX_MOVEMENT_NOT_SUPPORTED")) {
    return "箱轉散等複合異動不能用此頁特殊校正"
  }
  if (message.includes("ERR_REASON_REQUIRED")) return "請選擇校正原因"
  if (message.includes("ERR_NOTE_REQUIRED")) return "特殊校正必須填寫備註"
  if (message.includes("INSUFFICIENT_BOX")) return "庫存箱數不足，不能建立校正出庫"
  if (message.includes("INSUFFICIENT_PIECE")) return "庫存散數不足，不能建立校正出庫"

  return message
}

function formatCostCorrectionError(err: unknown) {
  const message = err instanceof Error ? err.message : "成本校正失敗"

  if (message.includes("ERR_BAD_COST")) return "請輸入正確的單件成本"
  if (message.includes("ERR_LEDGER_NOT_FOUND")) return "找不到這筆交易"
  if (message.includes("ERR_LEDGER_VOIDED")) return "已作廢的交易不能校正成本"
  if (message.includes("ERR_TX_VOID_NOT_ALLOWED")) return "tx_void 回沖紀錄不能直接校正成本"
  if (message.includes("ERR_SOURCE_NOT_ALLOWED")) return "這筆來源不允許做成本校正"
  if (message.includes("ERR_ZERO_QTY")) return "這筆交易數量為 0，不能校正成本"

  return message
}

const pageStyle: CSSProperties = {
  minHeight: "100dvh",
  background: "#0f0f0f",
  color: "#fff",
  padding: "calc(env(safe-area-inset-top, 0px) + 12px) 14px 22px",
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
  gridTemplateColumns: "40px minmax(0, 1fr) 40px",
  alignItems: "center",
  gap: 8,
  marginBottom: 10,
}

const topIconButtonStyle: CSSProperties = {
  width: 40,
  height: 40,
  border: "none",
  borderRadius: 10,
  background: "transparent",
  color: "#fff",
  fontSize: 24,
  lineHeight: 1,
}

const pageTitleStyle: CSSProperties = {
  margin: 0,
  color: "#fff",
  fontSize: 21,
  fontWeight: 900,
  textAlign: "center",
}

const filterPanelStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  padding: "0 0 8px",
  marginBottom: 8,
}

const inputStyle: CSSProperties = {
  width: "100%",
  height: 38,
  borderRadius: 10,
  border: "1px solid #3c3c3c",
  background: "#242424",
  color: "#fff",
  fontSize: 14,
  padding: "0 10px",
  boxSizing: "border-box",
}

const dateInputStyle: CSSProperties = {
  textAlign: "center",
  fontWeight: 800,
}

const loadingHintStyle: CSSProperties = {
  width: "100%",
  color: "#9dccff",
  fontSize: 12,
  fontWeight: 800,
  textAlign: "center",
}

const summaryRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 7,
  color: "#aaa",
  fontSize: 12,
  fontWeight: 800,
  margin: "0 2px 10px",
}

const recordListStyle: CSSProperties = {
  display: "grid",
  gap: 9,
}

const recordCardStyle: CSSProperties = {
  border: "1px solid #333",
  borderRadius: 14,
  background: "#171717",
  padding: 10,
}

const cardTopStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "34px minmax(60px, auto) minmax(42px, auto) minmax(0, 1fr) auto",
  alignItems: "center",
  gap: 7,
  marginBottom: 9,
}

const inboundMarkStyle: CSSProperties = {
  display: "grid",
  placeItems: "center",
  width: 30,
  height: 30,
  borderRadius: 999,
  background: "rgba(90,162,255,0.18)",
  color: "#9dccff",
  border: "1px solid rgba(90,162,255,0.34)",
  fontSize: 13,
  fontWeight: 900,
}

const outboundMarkStyle: CSSProperties = {
  ...inboundMarkStyle,
  background: "rgba(248,113,113,0.18)",
  color: "#fecaca",
  border: "1px solid rgba(248,113,113,0.34)",
}

const topMetaStyle: CSSProperties = {
  color: "#d5d5d5",
  fontSize: 12,
  fontWeight: 900,
  whiteSpace: "nowrap",
}

const amountStyle: CSSProperties = {
  color: "#e5e5e5",
  fontSize: 14,
  fontWeight: 950,
  textAlign: "right",
  whiteSpace: "nowrap",
}

const voidButtonStyle: CSSProperties = {
  minWidth: 50,
  height: 32,
  border: "none",
  borderRadius: 10,
  background: "#ef4444",
  color: "#fff",
  fontSize: 13,
  fontWeight: 900,
}

const disabledVoidStyle: CSSProperties = {
  minWidth: 50,
  minHeight: 32,
  display: "grid",
  placeItems: "center",
  borderRadius: 10,
  background: "#2a2a2a",
  color: "#8e8e8e",
  fontSize: 12,
  fontWeight: 900,
  padding: "0 7px",
  boxSizing: "border-box",
}

const skuStyle: CSSProperties = {
  color: "#fff",
  fontSize: 18,
  fontWeight: 950,
  overflowWrap: "anywhere",
}

const nameStyle: CSSProperties = {
  color: "#ddd",
  fontSize: 14,
  fontWeight: 850,
  marginTop: 5,
  overflowWrap: "anywhere",
}

const cardBottomStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) auto",
  gap: 8,
  alignItems: "end",
  marginTop: 9,
}

const qtyBoxStyle: CSSProperties = {
  border: "1px solid #2e2e2e",
  borderRadius: 11,
  background: "#111",
  padding: "7px 9px",
  minWidth: 0,
}

const qtyLabelStyle: CSSProperties = {
  color: "#bbb",
  fontSize: 12,
  fontWeight: 850,
  marginRight: 8,
}

const qtyValueStyle: CSSProperties = {
  color: "#fff",
  fontSize: 18,
  fontWeight: 950,
}

const idButtonStyle: CSSProperties = {
  alignSelf: "end",
  border: "none",
  background: "transparent",
  color: "#9dccff",
  fontSize: 14,
  fontWeight: 950,
  padding: "0 0 8px",
  textDecoration: "underline",
}

const voidInfoStyle: CSSProperties = {
  borderRadius: 10,
  background: "rgba(148,163,184,0.1)",
  color: "#aaa",
  padding: 8,
  fontSize: 12,
  marginTop: 8,
}

const correctionPanelStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  border: "1px solid #333",
  borderRadius: 16,
  background: "#171717",
  padding: 14,
}

const correctionNoticeStyle: CSSProperties = {
  border: "1px solid rgba(90,162,255,0.28)",
  borderRadius: 12,
  background: "rgba(90,162,255,0.1)",
  color: "#bfdbfe",
  padding: 10,
  fontSize: 13,
  fontWeight: 850,
  lineHeight: 1.5,
}

const modeSwitchStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
}

const modeButtonStyle: CSSProperties = {
  height: 38,
  borderRadius: 11,
  border: "1px solid #333",
  background: "#111",
  color: "#aaa",
  fontSize: 13,
  fontWeight: 900,
}

const modeButtonActiveStyle: CSSProperties = {
  ...modeButtonStyle,
  border: "1px solid rgba(90,162,255,0.5)",
  background: "rgba(90,162,255,0.16)",
  color: "#bfdbfe",
}

const detailGridStyle: CSSProperties = {
  display: "grid",
  gap: 8,
}

const infoItemStyle: CSSProperties = {
  border: "1px solid #2e2e2e",
  borderRadius: 12,
  background: "#111",
  padding: "9px 10px",
}

const infoLabelStyle: CSSProperties = {
  color: "#aaa",
  fontSize: 12,
  fontWeight: 850,
  marginBottom: 4,
}

const infoValueStyle: CSSProperties = {
  color: "#fff",
  fontSize: 14,
  fontWeight: 900,
  overflowWrap: "anywhere",
}

const labelStyle: CSSProperties = {
  color: "#ddd",
  fontSize: 13,
  fontWeight: 900,
  marginTop: 4,
}

const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: 92,
  height: "auto",
  padding: 10,
  resize: "vertical",
  lineHeight: 1.5,
}

const submitCorrectionButtonStyle: CSSProperties = {
  height: 46,
  border: "none",
  borderRadius: 13,
  background: "#60a5fa",
  color: "#fff",
  fontSize: 15,
  fontWeight: 950,
}

const costPreviewStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
}

const emptyStyle: CSSProperties = {
  border: "1px solid #333",
  borderRadius: 16,
  background: "#171717",
  color: "#999",
  padding: 16,
  fontSize: 14,
}

const messageStyle: CSSProperties = {
  background: "rgba(90,162,255,0.12)",
  color: "#bfdbfe",
  border: "1px solid rgba(90,162,255,0.28)",
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
