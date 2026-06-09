type Props = {
  onBack: () => void
  onOpenAudit: () => void
}

export default function AuditList({
  onBack,
  onOpenAudit,
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
      <button
        onClick={onBack}
        style={{
          background: "transparent",
          color: "#fff",
          border: "none",
          fontSize: 18,
          padding: 0,
        }}
      >
        ← 返回
      </button>

      <h1 style={{ marginTop: 20 }}>今日盤點</h1>

      <p style={{ color: "#999" }}>
        選擇或建立今天的盤點單
      </p>

      <button
        onClick={onOpenAudit}
        style={{
          width: "100%",
          height: 56,
          borderRadius: 16,
          border: "none",
          background: "#fff",
          color: "#111",
          fontSize: 18,
          marginTop: 24,
        }}
      >
        ＋ 今日盤點單
      </button>
    </div>
  )
}