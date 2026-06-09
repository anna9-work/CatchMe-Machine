type Props = {
  onBack: () => void
}

const items = [
  {
    product_sku: "a564",
    product_name: "平口垃圾袋",
    units_per_box: 150,
  },
  {
    product_sku: "aa0011",
    product_name: "測試商品A",
    units_per_box: 100,
  },
]

export default function MachineAuditDetail({ onBack }: Props) {
  return (
    <div style={pageStyle}>
      <button onClick={onBack} style={backButtonStyle}>
        ← 返回
      </button>

      <h1 style={{ marginTop: 20 }}>機台 001</h1>

      <p style={{ color: "#999" }}>輸入台外盤點箱數與散數</p>

      <div style={listStyle}>
        {items.map((item) => (
          <div key={item.product_sku} style={cardStyle}>
            <div style={nameStyle}>{item.product_name}</div>

            <div style={skuStyle}>{item.product_sku}</div>

            <div style={boxStyle}>箱入數：{item.units_per_box}</div>

            <label style={labelStyle}>盤點箱數</label>
            <input type="number" inputMode="numeric" style={inputStyle} />

            <label style={labelStyle}>盤點散數</label>
            <input type="number" inputMode="numeric" style={inputStyle} />
          </div>
        ))}
      </div>

      <button style={saveButtonStyle}>儲存</button>
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

const listStyle: React.CSSProperties = {
  display: "grid",
  gap: 14,
  marginTop: 20,
}

const cardStyle: React.CSSProperties = {
  border: "1px solid #333",
  borderRadius: 16,
  background: "#1a1a1a",
  padding: 16,
}

const nameStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
}

const skuStyle: React.CSSProperties = {
  color: "#aaa",
  fontSize: 13,
  marginTop: 6,
}

const boxStyle: React.CSSProperties = {
  color: "#ddd",
  fontSize: 14,
  marginTop: 10,
}

const labelStyle: React.CSSProperties = {
  display: "block",
  color: "#bbb",
  fontSize: 14,
  marginTop: 14,
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 46,
  borderRadius: 12,
  border: "1px solid #444",
  background: "#0f0f0f",
  color: "#fff",
  fontSize: 18,
  padding: "0 12px",
  boxSizing: "border-box",
  marginTop: 6,
}

const saveButtonStyle: React.CSSProperties = {
  width: "100%",
  height: 54,
  borderRadius: 16,
  border: "none",
  background: "#fff",
  color: "#111",
  fontSize: 18,
  marginTop: 20,
}