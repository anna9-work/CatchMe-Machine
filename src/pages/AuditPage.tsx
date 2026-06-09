import { useState } from "react"

type Props = {
  onBack: () => void
  onOpenMachine: () => void
}

const machines = Array.from({ length: 114 }, (_, i) =>
  String(i + 1).padStart(3, "0")
)

const ranges = [
  { label: "全部", start: 1, end: 114 },
  { label: "001-025", start: 1, end: 25 },
  { label: "026-050", start: 26, end: 50 },
  { label: "051-075", start: 51, end: 75 },
  { label: "076-100", start: 76, end: 100 },
  { label: "101-114", start: 101, end: 114 },
]

export default function AuditPage({ onBack, onOpenMachine }: Props) {
  const [activeRange, setActiveRange] = useState(ranges[0])

  const visibleMachines = machines.filter((machineNo) => {
    const n = Number(machineNo)
    return n >= activeRange.start && n <= activeRange.end
  })

  return (
    <div style={pageStyle}>
      <button onClick={onBack} style={backButtonStyle}>
        ← 返回
      </button>

      <h1 style={{ marginTop: 20 }}>盤點輸入</h1>

      <p style={descStyle}>可一人盤全部，也可多人分段同步盤點</p>

      <div style={rangeWrapStyle}>
        {ranges.map((range) => {
          const active = range.label === activeRange.label

          return (
            <button
              key={range.label}
              onClick={() => setActiveRange(range)}
              style={{
                ...rangeButtonStyle,
                background: active ? "#fff" : "#1c1c1c",
                color: active ? "#111" : "#fff",
              }}
            >
              {range.label}
            </button>
          )
        })}
      </div>

      <div style={listStyle}>
        {visibleMachines.map((machineNo) => (
          <button
            key={machineNo}
            onClick={onOpenMachine}
            style={machineButtonStyle}
          >
            機台 {machineNo}
          </button>
        ))}
      </div>
    </div>
  )
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#0f0f0f",
  color: "#fff",
  padding: "44px 16px 24px",
  boxSizing: "border-box",
}

const backButtonStyle: React.CSSProperties = {
  background: "transparent",
  color: "#fff",
  border: "none",
  fontSize: 18,
  padding: 0,
}

const descStyle: React.CSSProperties = {
  color: "#999",
}

const rangeWrapStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  overflowX: "auto",
  paddingBottom: 8,
  marginTop: 20,
}

const rangeButtonStyle: React.CSSProperties = {
  flex: "0 0 auto",
  height: 40,
  borderRadius: 999,
  border: "1px solid #333",
  padding: "0 14px",
  fontSize: 15,
}

const listStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  marginTop: 18,
}

const machineButtonStyle: React.CSSProperties = {
  width: "100%",
  height: 64,
  borderRadius: 16,
  border: "1px solid #333",
  background: "#1c1c1c",
  color: "#fff",
  fontSize: 20,
  textAlign: "left",
  padding: "0 18px",
}