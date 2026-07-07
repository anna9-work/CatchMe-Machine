import { useState, type CSSProperties } from "react"

type Props = {
  onBack: () => void
}

export default function InboundPage({ onBack }: Props) {
  const [bizDate, setBizDate] = useState(() => getTodayText())
  const [sku, setSku] = useState("")
  const [warehouse, setWarehouse] = useState("main")
  const [boxQty, setBoxQty] = useState("")
  const [pieceQty, setPieceQty] = useState("")
  const [unitCost, setUnitCost] = useState("")
  const [note, setNote] = useState("")
  const [message, setMessage] = useState("")

  function showPendingMessage() {
    setMessage("入庫寫入等 UI 動線確認後再接上")
  }

  return (
    <div style={pageStyle}>
      <div style={topBarStyle}>
        <button onClick={onBack} style={iconButtonStyle}>
          ←
        </button>
        <div style={titleBlockStyle}>
          <div style={eyebrowStyle}>入庫</div>
          <h1 style={titleStyle}>補入倉庫</h1>
        </div>
        <div />
      </div>

      {message && <div style={messageStyle}>{message}</div>}

      <div style={panelStyle}>
        <label style={labelStyle}>業務日期</label>
        <input
          value={bizDate}
          onChange={(event) => setBizDate(event.target.value)}
          type="date"
          style={inputStyle}
        />

        <label style={labelStyle}>貨品編號</label>
        <input
          value={sku}
          onChange={(event) => setSku(event.target.value)}
          placeholder="掃描或輸入貨品編號"
          style={inputStyle}
        />

        <label style={labelStyle}>倉庫別</label>
        <select
          value={warehouse}
          onChange={(event) => setWarehouse(event.target.value)}
          style={inputStyle}
        >
          <option value="main">總倉</option>
          <option value="swap">夾換品</option>
          <option value="withdraw">撤台</option>
        </select>

        <div style={twoColumnStyle}>
          <div>
            <label style={labelStyle}>箱數</label>
            <input
              value={boxQty}
              onChange={(event) => setBoxQty(event.target.value)}
              inputMode="numeric"
              type="number"
              min={0}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>散貨</label>
            <input
              value={pieceQty}
              onChange={(event) => setPieceQty(event.target.value)}
              inputMode="numeric"
              type="number"
              min={0}
              style={inputStyle}
            />
          </div>
        </div>

        <label style={labelStyle}>單價</label>
        <input
          value={unitCost}
          onChange={(event) => setUnitCost(event.target.value)}
          inputMode="decimal"
          type="number"
          min={0}
          style={inputStyle}
        />

        <label style={labelStyle}>備註</label>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          style={textareaStyle}
        />

        <button onClick={showPendingMessage} style={primaryButtonStyle}>
          建立入庫
        </button>
      </div>
    </div>
  )
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

const pageStyle: CSSProperties = {
  minHeight: "100dvh",
  background: "#050913",
  color: "#fff",
  padding: "calc(env(safe-area-inset-top, 0px) + 12px) 14px 28px",
  boxSizing: "border-box",
  fontFamily: "system-ui, -apple-system, sans-serif",
}

const topBarStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "44px minmax(0, 1fr) 44px",
  alignItems: "center",
  gap: 8,
  marginBottom: 16,
}

const iconButtonStyle: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.08)",
  color: "#fff",
  fontSize: 24,
}

const titleBlockStyle: CSSProperties = {
  textAlign: "center",
}

const eyebrowStyle: CSSProperties = {
  color: "#fbbf24",
  fontSize: 13,
  fontWeight: 800,
  marginBottom: 2,
}

const titleStyle: CSSProperties = {
  margin: 0,
  color: "#fff",
  fontSize: 26,
  fontWeight: 900,
  lineHeight: 1.1,
}

const panelStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  border: "1px solid rgba(148,163,184,0.22)",
  borderRadius: 8,
  background: "#0b1220",
  padding: 14,
}

const labelStyle: CSSProperties = {
  marginTop: 6,
  color: "#cbd5e1",
  fontSize: 14,
  fontWeight: 800,
}

const inputStyle: CSSProperties = {
  width: "100%",
  height: 52,
  borderRadius: 14,
  border: "1px solid #334155",
  background: "#101827",
  color: "#fff",
  padding: "0 14px",
  fontSize: 16,
}

const textareaStyle: CSSProperties = {
  width: "100%",
  borderRadius: 14,
  border: "1px solid #334155",
  background: "#101827",
  color: "#fff",
  padding: 14,
  fontSize: 16,
  resize: "vertical",
}

const twoColumnStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
}

const primaryButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: 54,
  marginTop: 12,
  border: "none",
  borderRadius: 14,
  background: "#f8fafc",
  color: "#0f172a",
  fontSize: 17,
  fontWeight: 800,
}

const messageStyle: CSSProperties = {
  background: "rgba(16,185,129,0.14)",
  color: "#86efac",
  border: "1px solid rgba(16,185,129,0.3)",
  borderRadius: 8,
  padding: 12,
  marginBottom: 12,
}
