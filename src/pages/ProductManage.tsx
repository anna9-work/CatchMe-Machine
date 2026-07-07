import { useEffect, useMemo, useState, type CSSProperties } from "react"
import { supabase } from "../lib/supabase"

type Props = {
  onBack: () => void
}

type Product = {
  product_sku: string
  product_name: string
  enabled: boolean | null
  barcode?: string
}

type Mode = "list" | "new" | "edit"

export default function ProductManage({ onBack }: Props) {
  const [mode, setMode] = useState<Mode>("list")
  const [products, setProducts] = useState<Product[]>([])
  const [query, setQuery] = useState("")
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  useEffect(() => {
    loadProducts()
  }, [])

  const filteredProducts = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return products

    return products.filter((product) => {
      return (
        product.product_sku.toLowerCase().includes(keyword) ||
        product.product_name.toLowerCase().includes(keyword) ||
        (product.barcode ?? "").toLowerCase().includes(keyword)
      )
    })
  }, [products, query])

  async function loadProducts() {
    try {
      setLoading(true)
      setError("")

      const { data: productData, error: productError } = await supabase
        .from("products")
        .select("product_sku,product_name,enabled")
        .order("product_sku", { ascending: true })
        .limit(200)

      if (productError) throw productError

      const skuList = Array.from(
        new Set((productData ?? []).map((product) => product.product_sku))
      )

      let barcodeMap = new Map<string, string>()

      if (skuList.length > 0) {
        const { data: barcodeData, error: barcodeError } = await supabase
          .from("product_barcodes")
          .select("product_sku,barcode")
          .eq("enabled", true)
          .in("product_sku", skuList)

        if (barcodeError) throw barcodeError

        barcodeMap = new Map(
          (barcodeData ?? []).map((row) => [row.product_sku, row.barcode])
        )
      }

      setProducts(
        (productData ?? []).map((product) => ({
          product_sku: product.product_sku,
          product_name: product.product_name ?? "",
          enabled: product.enabled ?? null,
          barcode: barcodeMap.get(product.product_sku),
        }))
      )
    } catch (err: any) {
      console.error(err)
      setError(err.message ?? "商品讀取失敗")
    } finally {
      setLoading(false)
    }
  }

  function openNewForm() {
    setSelectedProduct(null)
    setMode("new")
    setMessage("")
    setError("")
  }

  function openEditForm(product: Product) {
    setSelectedProduct(product)
    setMode("edit")
    setMessage("")
    setError("")
  }

  function showPendingMessage() {
    setMessage("資料庫寫入等 UI 動線確認後再接上")
  }

  return (
    <div style={pageStyle}>
      <div style={topBarStyle}>
        <button onClick={onBack} style={iconButtonStyle}>
          ←
        </button>
        <div style={titleBlockStyle}>
          <div style={eyebrowStyle}>商品管理</div>
          <h1 style={titleStyle}>
            {mode === "list" ? "商品列表" : mode === "new" ? "新增商品" : "編輯商品"}
          </h1>
        </div>
        <button onClick={loadProducts} style={iconButtonStyle}>
          ↻
        </button>
      </div>

      {message && <div style={messageStyle}>{message}</div>}
      {error && <div style={errorStyle}>{error}</div>}

      {mode === "list" && (
        <>
          <button onClick={openNewForm} style={primaryButtonStyle}>
            新增商品
          </button>

          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜尋貨品編號、名稱、條碼"
            style={searchInputStyle}
          />

          {loading && <div style={emptyStyle}>載入中...</div>}

          {!loading && (
            <div style={listStyle}>
              {filteredProducts.map((product) => (
                <button
                  key={product.product_sku}
                  onClick={() => openEditForm(product)}
                  style={productCardStyle}
                >
                  <div style={cardHeaderStyle}>
                    <span style={skuStyle}>{product.product_sku}</span>
                    <span
                      style={{
                        ...statusStyle,
                        color: product.enabled === false ? "#fca5a5" : "#86efac",
                      }}
                    >
                      {product.enabled === false ? "停用" : "啟用"}
                    </span>
                  </div>
                  <div style={nameStyle}>{product.product_name || "未命名商品"}</div>
                  {product.barcode && <div style={metaStyle}>條碼 {product.barcode}</div>}
                </button>
              ))}

              {filteredProducts.length === 0 && (
                <div style={emptyStyle}>沒有符合的商品</div>
              )}
            </div>
          )}
        </>
      )}

      {mode !== "list" && (
        <ProductForm
          product={selectedProduct}
          onCancel={() => setMode("list")}
          onSubmit={showPendingMessage}
        />
      )}
    </div>
  )
}

function ProductForm({
  product,
  onCancel,
  onSubmit,
}: {
  product: Product | null
  onCancel: () => void
  onSubmit: () => void
}) {
  const [sku, setSku] = useState(product?.product_sku ?? "")
  const [name, setName] = useState(product?.product_name ?? "")
  const [barcode, setBarcode] = useState(product?.barcode ?? "")
  const [enabled, setEnabled] = useState(product?.enabled !== false)

  return (
    <div style={formStyle}>
      <label style={labelStyle}>貨品編號</label>
      <input
        value={sku}
        onChange={(event) => setSku(event.target.value)}
        style={inputStyle}
        placeholder="例如 ac066"
      />

      <label style={labelStyle}>貨品名稱</label>
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        style={inputStyle}
        placeholder="商品名稱"
      />

      <label style={labelStyle}>條碼</label>
      <input
        value={barcode}
        onChange={(event) => setBarcode(event.target.value)}
        style={inputStyle}
        placeholder="可留空"
      />

      <label style={checkRowStyle}>
        <input
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
          type="checkbox"
        />
        啟用商品
      </label>

      <div style={actionRowStyle}>
        <button onClick={onCancel} style={secondaryButtonStyle}>
          取消
        </button>
        <button onClick={onSubmit} style={primaryButtonStyle}>
          儲存
        </button>
      </div>
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
  minWidth: 0,
}

const eyebrowStyle: CSSProperties = {
  color: "#8dd7ff",
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

const secondaryButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: 54,
  border: "1px solid rgba(255,255,255,0.16)",
  borderRadius: 14,
  background: "rgba(255,255,255,0.08)",
  color: "#e2e8f0",
  fontSize: 17,
  fontWeight: 800,
}

const searchInputStyle: CSSProperties = {
  width: "100%",
  height: 52,
  marginTop: 14,
  marginBottom: 14,
  borderRadius: 14,
  border: "1px solid #334155",
  background: "#101827",
  color: "#fff",
  padding: "0 14px",
  fontSize: 16,
}

const listStyle: CSSProperties = {
  display: "grid",
  gap: 12,
}

const productCardStyle: CSSProperties = {
  width: "100%",
  textAlign: "left",
  border: "1px solid rgba(148,163,184,0.22)",
  borderRadius: 8,
  background: "#0b1220",
  color: "#fff",
  padding: 14,
}

const cardHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
}

const skuStyle: CSSProperties = {
  color: "#93c5fd",
  fontSize: 13,
  fontWeight: 900,
}

const statusStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
}

const nameStyle: CSSProperties = {
  marginTop: 8,
  fontSize: 18,
  fontWeight: 800,
  lineHeight: 1.25,
}

const metaStyle: CSSProperties = {
  marginTop: 8,
  color: "#94a3b8",
  fontSize: 13,
}

const emptyStyle: CSSProperties = {
  border: "1px dashed rgba(148,163,184,0.28)",
  borderRadius: 8,
  color: "#94a3b8",
  padding: 18,
  textAlign: "center",
}

const formStyle: CSSProperties = {
  display: "grid",
  gap: 10,
}

const labelStyle: CSSProperties = {
  marginTop: 8,
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

const checkRowStyle: CSSProperties = {
  minHeight: 48,
  display: "flex",
  alignItems: "center",
  gap: 10,
  color: "#e2e8f0",
  fontWeight: 800,
}

const actionRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
  marginTop: 12,
}

const messageStyle: CSSProperties = {
  background: "rgba(16,185,129,0.14)",
  color: "#86efac",
  border: "1px solid rgba(16,185,129,0.3)",
  borderRadius: 8,
  padding: 12,
  marginBottom: 12,
}

const errorStyle: CSSProperties = {
  background: "rgba(248,113,113,0.12)",
  color: "#fca5a5",
  border: "1px solid rgba(248,113,113,0.3)",
  borderRadius: 8,
  padding: 12,
  marginBottom: 12,
}
