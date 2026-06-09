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
    <div
      style={{
        minHeight: "100vh",
        background: "#0f0f0f",
        color: "#fff",
        padding: "44px 16px 24px",
        boxSizing: "border-box",
      }}
    >
      <h1 style={{ margin: 0 }}>機台盤點</h1>

      <p
        style={{
          color: "#999",
          marginTop: 8,
        }}
      >
        CatchMe Machine
      </p>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          marginTop: 24,
        }}
      >
        <button style={buttonStyle} onClick={onAuditClick}>
          今日盤點
        </button>

        <button style={buttonStyle} onClick={onHistoryClick}>
          歷史盤點
        </button>

        <button style={buttonStyle} onClick={onMachineClick}>
          機台管理
        </button>
      </div>
    </div>
  )
}

const buttonStyle: React.CSSProperties = {
  width: "100%",
  height: 58,
  borderRadius: 16,
  border: "1px solid #333",
  background: "#1c1c1c",
  color: "#fff",
  fontSize: 18,
}