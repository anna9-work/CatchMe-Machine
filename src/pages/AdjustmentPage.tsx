import type { CSSProperties } from "react"

type Props = {
  onBack: () => void
}

export default function AdjustmentPage({ onBack }: Props) {
  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <button onClick={onBack} style={backButtonStyle}>
          ←
        </button>
        <div>
          <h1 style={titleStyle}>異動單</h1>
          <p style={subtitleStyle}>補入庫 / 補出庫</p>
        </div>
      </header>

      <section style={panelStyle}>
        <button style={actionButtonStyle}>
          <span style={actionTitleStyle}>補入庫</span>
          <span style={actionSubtitleStyle}>補登過去日期的入庫資料</span>
        </button>

        <button style={actionButtonStyle}>
          <span style={actionTitleStyle}>補出庫</span>
          <span style={actionSubtitleStyle}>補登過去日期的出庫資料</span>
        </button>

        <button disabled style={{ ...actionButtonStyle, opacity: 0.45 }}>
          <span style={actionTitleStyle}>轉換</span>
          <span style={actionSubtitleStyle}>箱散轉換，下一階段建立</span>
        </button>
      </section>
    </main>
  )
}

const pageStyle: CSSProperties = {
  minHeight: "100dvh",
  background: "#0f0f0f",
  color: "#fff",
  padding: "calc(env(safe-area-inset-top, 0px) + 44px) 16px 24px",
  boxSizing: "border-box",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
}

const headerStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "36px minmax(0, 1fr)",
  alignItems: "center",
  gap: 12,
  maxWidth: 520,
  margin: "0 auto 20px",
}

const backButtonStyle: CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#fff",
  fontSize: 34,
  lineHeight: 1,
  padding: 0,
}

const titleStyle: CSSProperties = {
  margin: 0,
  color: "#fff",
  fontSize: 24,
  fontWeight: 800,
}

const subtitleStyle: CSSProperties = {
  margin: "4px 0 0",
  color: "#999",
  fontSize: 14,
}

const panelStyle: CSSProperties = {
  display: "grid",
  gap: 14,
  maxWidth: 520,
  margin: "0 auto",
}

const actionButtonStyle: CSSProperties = {
  width: "100%",
  border: "1px solid #333",
  borderRadius: 16,
  background: "#1a1a1a",
  color: "#fff",
  padding: 16,
  textAlign: "left",
}

const actionTitleStyle: CSSProperties = {
  display: "block",
  color: "#fff",
  fontSize: 18,
  fontWeight: 700,
}

const actionSubtitleStyle: CSSProperties = {
  display: "block",
  color: "#aaa",
  fontSize: 14,
  marginTop: 6,
}
