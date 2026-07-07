//home.tsx
import type { CSSProperties } from "react"

type Props = {
  onAuditClick: () => void
  onHistoryClick: () => void
  onMachineClick: () => void
}

export default function Home({
  onAuditClick,
  onHistoryClick,
  onMachineClick,
}: Props) {
  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <h1 style={titleStyle}>機台盤點系統</h1>
        <p style={subtitleStyle}>CatchMe Machine</p>
      </div>

      <div style={buttonContainerStyle}>
        <button style={primaryButtonStyle} onClick={onAuditClick}>
          今日盤點
        </button>

        <button style={secondaryButtonStyle} onClick={onHistoryClick}>
          歷史紀錄
        </button>

        <button style={secondaryButtonStyle} onClick={onMachineClick}>
          機台管理
        </button>
      </div>
      
      <div style={footerStyle}>
        v1.0.0
      </div>
    </div>
  )
}

/* ---------------- 手機版高級深色質感 CSS Properties ---------------- */

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "#09090b", // 深邃質感的背景色 (Zinc 900)
  color: "#fafafa",
  padding: "48px 24px 32px", // 加大左右邊距，讓畫面更集中
  boxSizing: "border-box",
  fontFamily: "system-ui, -apple-system, sans-serif",
  display: "flex",
  flexDirection: "column",
}

const headerStyle: CSSProperties = {
  marginTop: "10vh", // 讓標題稍微往下壓，視覺重心更穩
  marginBottom: 48,
  display: "flex",
  flexDirection: "column",
  gap: 8,
}

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 32,
  fontWeight: 700,
  letterSpacing: "1px",
  color: "#fafafa",
}

const subtitleStyle: CSSProperties = {
  margin: 0,
  color: "#10b981", // 使用與盤點頁一致的翡翠綠作為品牌點綴色
  fontSize: 16,
  fontWeight: 500,
  letterSpacing: "0.5px",
}

const buttonContainerStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 16, // 按鈕之間的間距加大，防止誤觸
  flex: 1, // 佔據剩餘空間
}

// 主按鈕：高對比反白，吸引視覺焦點
const primaryButtonStyle: CSSProperties = {
  width: "100%",
  height: 60, // 放大觸控高度
  borderRadius: 16,
  border: "none",
  background: "#fafafa",
  color: "#09090b",
  fontSize: 18,
  fontWeight: 600,
  cursor: "pointer",
  transition: "opacity 0.2s",
  boxShadow: "0 4px 12px rgba(250, 250, 250, 0.15)",
}

// 次要按鈕：深色卡片質感，融入背景但不失層次
const secondaryButtonStyle: CSSProperties = {
  width: "100%",
  height: 60,
  borderRadius: 16,
  border: "1px solid #27272a",
  background: "#18181b",
  color: "#e4e4e7",
  fontSize: 18,
  fontWeight: 500,
  cursor: "pointer",
  transition: "background 0.2s",
  boxShadow: "0 2px 6px rgba(0, 0, 0, 0.2)",
}

const footerStyle: CSSProperties = {
  textAlign: "center",
  color: "#3f3f46",
  fontSize: 13,
  fontWeight: 500,
  fontFamily: "monospace",
  marginTop: "auto", // 將版本號推至最底部
  paddingTop: 32,
}