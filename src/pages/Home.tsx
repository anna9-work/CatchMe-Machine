//home.tsx
import type { CSSProperties } from "react"

type Props = {
  onAuditClick: () => void
  onHistoryClick: () => void
  onMachineClick: () => void
  onProductClick: () => void
  onInboundClick: () => void
  onLineBotClick: () => void
}

export default function Home({
  onAuditClick,
  onHistoryClick,
  onMachineClick,
  onProductClick,
  onInboundClick,
  onLineBotClick,
}: Props) {
  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <h1 style={titleStyle}>CatchMe 管理系統</h1>
        <p style={subtitleStyle}>CatchMe Machine</p>
      </div>

      <div style={sectionListStyle}>
        <section style={sectionStyle}>
          <div style={sectionTitleStyle}>商品管理</div>
          <button style={primaryButtonStyle} onClick={onProductClick}>
            新增 / 編輯商品
          </button>
        </section>

        <section style={sectionStyle}>
          <div style={sectionTitleStyle}>倉庫管理</div>
          <button style={secondaryButtonStyle} onClick={onInboundClick}>
            入庫
          </button>
        </section>

        <section style={sectionStyle}>
          <div style={sectionTitleStyle}>機台管理</div>
          <button style={secondaryButtonStyle} onClick={onMachineClick}>
            機台生命週期
          </button>
          <button style={secondaryButtonStyle} onClick={onAuditClick}>
            今日盤點
          </button>
          <button style={secondaryButtonStyle} onClick={onHistoryClick}>
            歷史紀錄
          </button>
        </section>

        <section style={sectionStyle}>
          <div style={sectionTitleStyle}>LINE Bot</div>
          <button style={secondaryButtonStyle} onClick={onLineBotClick}>
            記錄 / 查詢 / 取消
          </button>
        </section>
      </div>

      <div style={footerStyle}>v1.1.0</div>
    </div>
  )
}

const pageStyle: CSSProperties = {
  minHeight: "100dvh",
  background: "#050913",
  color: "#fafafa",
  padding: "calc(env(safe-area-inset-top, 0px) + 28px) 18px 28px",
  boxSizing: "border-box",
  fontFamily: "system-ui, -apple-system, sans-serif",
  display: "flex",
  flexDirection: "column",
}

const headerStyle: CSSProperties = {
  marginBottom: 24,
  display: "flex",
  flexDirection: "column",
  gap: 8,
  textAlign: "left",
}

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 30,
  lineHeight: 1.12,
  fontWeight: 900,
  letterSpacing: 0,
  color: "#fafafa",
}

const subtitleStyle: CSSProperties = {
  margin: 0,
  color: "#8dd7ff",
  fontSize: 16,
  fontWeight: 800,
  letterSpacing: 0,
}

const sectionListStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  flex: 1,
}

const sectionStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  border: "1px solid rgba(148,163,184,0.2)",
  borderRadius: 8,
  background: "#0b1220",
  padding: 12,
}

const sectionTitleStyle: CSSProperties = {
  color: "#cbd5e1",
  fontSize: 14,
  fontWeight: 900,
}

const primaryButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: 56,
  borderRadius: 14,
  border: "none",
  background: "#fafafa",
  color: "#0f172a",
  fontSize: 17,
  fontWeight: 900,
  cursor: "pointer",
}

const secondaryButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: 54,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "#101827",
  color: "#e4e4e7",
  fontSize: 17,
  fontWeight: 800,
  cursor: "pointer",
}

const footerStyle: CSSProperties = {
  textAlign: "center",
  color: "#475569",
  fontSize: 13,
  fontWeight: 700,
  fontFamily: "monospace",
  marginTop: "auto",
  paddingTop: 32,
}
