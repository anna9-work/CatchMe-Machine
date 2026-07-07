import { useState, type CSSProperties } from "react"

type Props = {
  onBack: () => void
}

type Tab = "records" | "query" | "cancel"

export default function LineBotPage({ onBack }: Props) {
  const [tab, setTab] = useState<Tab>("records")
  const [keyword, setKeyword] = useState("")
  const [cancelId, setCancelId] = useState("")
  const [message, setMessage] = useState("")

  function showPendingMessage() {
    setMessage("LINE Bot 交易資料等 UI 動線確認後再接上")
  }

  return (
    <div style={pageStyle}>
      <div style={topBarStyle}>
        <button onClick={onBack} style={iconButtonStyle}>
          ←
        </button>
        <div style={titleBlockStyle}>
          <div style={eyebrowStyle}>LINE Bot</div>
          <h1 style={titleStyle}>出庫操作</h1>
        </div>
        <div />
      </div>

      {message && <div style={messageStyle}>{message}</div>}

      <div style={tabRowStyle}>
        <button
          onClick={() => setTab("records")}
          style={tab === "records" ? activeTabStyle : tabStyle}
        >
          記錄
        </button>
        <button
          onClick={() => setTab("query")}
          style={tab === "query" ? activeTabStyle : tabStyle}
        >
          查詢
        </button>
        <button
          onClick={() => setTab("cancel")}
          style={tab === "cancel" ? activeTabStyle : tabStyle}
        >
          取消
        </button>
      </div>

      {tab === "records" && (
        <div style={panelStyle}>
          <div style={sectionTitleStyle}>出庫記錄</div>
          <div style={recordCardStyle}>
            <div style={recordTopStyle}>
              <span style={recordIdStyle}>尚未載入</span>
              <span style={statusStyle}>待接資料</span>
            </div>
            <div style={mutedStyle}>使用者、貨品、數量、倉庫別會顯示在這裡</div>
          </div>
          <button onClick={showPendingMessage} style={primaryButtonStyle}>
            重新整理
          </button>
        </div>
      )}

      {tab === "query" && (
        <div style={panelStyle}>
          <label style={labelStyle}>查詢條件</label>
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="輸入使用者、貨品編號或交易編號"
            style={inputStyle}
          />
          <button onClick={showPendingMessage} style={primaryButtonStyle}>
            查詢
          </button>
        </div>
      )}

      {tab === "cancel" && (
        <div style={panelStyle}>
          <label style={labelStyle}>交易編號</label>
          <input
            value={cancelId}
            onChange={(event) => setCancelId(event.target.value)}
            placeholder="輸入要取消的出庫交易"
            style={inputStyle}
          />
          <button onClick={showPendingMessage} style={dangerButtonStyle}>
            取消出庫
          </button>
        </div>
      )}
    </div>
  )
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
  color: "#86efac",
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

const tabRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  gap: 8,
  marginBottom: 14,
}

const tabStyle: CSSProperties = {
  height: 46,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "#94a3b8",
  fontWeight: 900,
}

const activeTabStyle: CSSProperties = {
  ...tabStyle,
  background: "#f8fafc",
  color: "#0f172a",
}

const panelStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  border: "1px solid rgba(148,163,184,0.22)",
  borderRadius: 8,
  background: "#0b1220",
  padding: 14,
}

const sectionTitleStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
}

const recordCardStyle: CSSProperties = {
  border: "1px solid rgba(148,163,184,0.18)",
  borderRadius: 8,
  background: "#101827",
  padding: 12,
}

const recordTopStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  marginBottom: 8,
}

const recordIdStyle: CSSProperties = {
  color: "#93c5fd",
  fontWeight: 900,
}

const statusStyle: CSSProperties = {
  color: "#fbbf24",
  fontSize: 13,
  fontWeight: 900,
}

const mutedStyle: CSSProperties = {
  color: "#94a3b8",
  fontSize: 14,
}

const labelStyle: CSSProperties = {
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

const primaryButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: 54,
  border: "none",
  borderRadius: 14,
  background: "#f8fafc",
  color: "#0f172a",
  fontSize: 17,
  fontWeight: 800,
}

const dangerButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  background: "#fecaca",
  color: "#7f1d1d",
}

const messageStyle: CSSProperties = {
  background: "rgba(16,185,129,0.14)",
  color: "#86efac",
  border: "1px solid rgba(16,185,129,0.3)",
  borderRadius: 8,
  padding: 12,
  marginBottom: 12,
}
