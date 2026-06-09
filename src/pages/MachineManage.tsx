type Props = {
  onBack: () => void
}

export default function MachineManage({ onBack }: Props) {
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

      <h1 style={{ marginTop: 20 }}>機台管理</h1>

      <p style={{ color: "#999" }}>
        管理機台與台內商品設定
      </p>

      <button
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
        ＋ 新增機台
      </button>
    </div>
  )
}