import { useEffect, useState, type CSSProperties } from "react"
import { supabase } from "../lib/supabase"

type Props = {
  machineNo: string
  onBack: () => void
}

type MachineItem = {
  id: number
  machine_no: string
  product_sku: string
  qty_piece: number
  product_name: string
}

type Product = {
  product_sku: string
  product_name: string
  barcode?: string
}

const GROUP_CODE = "catch_0001"

export default function MachineDetail({ machineNo, onBack }: Props) {
  const [items, setItems] = useState<MachineItem[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [searchText, setSearchText] = useState("")
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [newQty, setNewQty] = useState("")
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    loadItems()
  }, [machineNo])

  useEffect(() => {
    if (!showAdd) return

    const keyword = searchText.trim()

    if (!keyword) {
      setProducts([])
      setSelectedProduct(null)
      return
    }

    const timer = window.setTimeout(() => {
      searchProducts(keyword)
    }, 250)

    return () => window.clearTimeout(timer)
  }, [searchText, showAdd])

  async function loadItems() {
    try {
      setLoading(true)
      setError("")

      const { data: itemData, error: itemError } = await supabase
        .from("machine_items")
        .select("id,machine_no,product_sku,qty_piece")
        .eq("group_code", GROUP_CODE)
        .eq("machine_no", machineNo)
        .order("product_sku", { ascending: true })

      if (itemError) throw itemError

      const skuList = Array.from(
        new Set((itemData ?? []).map((item) => item.product_sku))
      )

      let productMap = new Map<string, string>()

      if (skuList.length > 0) {
        const { data: productData, error: productError } = await supabase
          .from("products")
          .select("product_sku,product_name")
          .in("product_sku", skuList)

        if (productError) throw productError

        productMap = new Map(
          (productData ?? []).map((p) => [
            p.product_sku,
            p.product_name ?? "",
          ])
        )
      }

      setItems(
        (itemData ?? []).map((item) => ({
          id: item.id,
          machine_no: item.machine_no,
          product_sku: item.product_sku,
          qty_piece: Number(item.qty_piece ?? 0),
          product_name: productMap.get(item.product_sku) ?? "",
        }))
      )
    } catch (err: any) {
      console.error(err)
      setError(err.message ?? "讀取失敗")
    } finally {
      setLoading(false)
    }
  }

  async function searchProducts(keyword: string) {
    try {
      setSearching(true)
      setError("")

      const normalizedKeyword = keyword.trim()

      const { data: productData, error: productError } = await supabase
        .from("products")
        .select("product_sku,product_name")
        .eq("enabled", true)
        .or(
          `product_sku.ilike.%${normalizedKeyword}%,product_name.ilike.%${normalizedKeyword}%`
        )
        .limit(30)

      if (productError) throw productError

      const { data: barcodeData, error: barcodeError } = await supabase
        .from("product_barcodes")
        .select("product_sku,barcode")
        .eq("enabled", true)
        .ilike("barcode", `%${normalizedKeyword}%`)
        .limit(30)

      if (barcodeError) throw barcodeError

      const skuFromBarcode = Array.from(
        new Set((barcodeData ?? []).map((row) => row.product_sku))
      )

      let barcodeProductData: Array<{
        product_sku: string
        product_name: string
      }> = []

      if (skuFromBarcode.length > 0) {
        const { data, error } = await supabase
          .from("products")
          .select("product_sku,product_name")
          .eq("enabled", true)
          .in("product_sku", skuFromBarcode)

        if (error) throw error

        barcodeProductData = data ?? []
      }

      const barcodeMap = new Map(
        (barcodeData ?? []).map((row) => [row.product_sku, row.barcode])
      )

      const merged = new Map<string, Product>()

      for (const product of productData ?? []) {
        merged.set(product.product_sku, {
          product_sku: product.product_sku,
          product_name: product.product_name ?? "",
          barcode: barcodeMap.get(product.product_sku),
        })
      }

      for (const product of barcodeProductData) {
        merged.set(product.product_sku, {
          product_sku: product.product_sku,
          product_name: product.product_name ?? "",
          barcode: barcodeMap.get(product.product_sku),
        })
      }

      setProducts(Array.from(merged.values()).slice(0, 30))
    } catch (err: any) {
      console.error(err)
      setError(err.message ?? "搜尋失敗")
    } finally {
      setSearching(false)
    }
  }

  function toSafeNumber(value: string) {
    if (value.trim() === "") return 0
    const n = Number(value)
    if (!Number.isFinite(n) || n < 0) return 0
    return n
  }

  function updateLocalQty(itemId: number, value: string) {
    const qty = toSafeNumber(value)

    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, qty_piece: qty } : item
      )
    )

    setMessage("")
  }

  async function saveQty(item: MachineItem) {
    try {
      setSaving(true)
      setError("")

      const { error } = await supabase.rpc("rpc_upsert_machine_item", {
        p_group: GROUP_CODE,
        p_machine_no: item.machine_no,
        p_product_sku: item.product_sku,
        p_qty_piece: item.qty_piece,
      })

      if (error) throw error

      setMessage("已儲存")
    } catch (err: any) {
      console.error(err)
      setError(err.message ?? "儲存失敗")
    } finally {
      setSaving(false)
    }
  }

  async function deleteItem(item: MachineItem) {
    const ok = window.confirm(`確定刪除 ${item.product_sku}？`)
    if (!ok) return

    try {
      setSaving(true)
      setError("")

      const { error } = await supabase.rpc("rpc_delete_machine_item", {
        p_group: GROUP_CODE,
        p_machine_no: machineNo,
        p_product_sku: item.product_sku,
      })

      if (error) throw error

      setMessage("已刪除")
      await loadItems()
    } catch (err: any) {
      console.error(err)
      setError(err.message ?? "刪除失敗")
    } finally {
      setSaving(false)
    }
  }

  async function addProduct() {
    if (!selectedProduct) {
      setError("請先選擇商品")
      return
    }

    const existed = items.some(
      (item) => item.product_sku === selectedProduct.product_sku
    )

    if (existed) {
      setError("這個商品已經在此機台內")
      return
    }

    try {
      setSaving(true)
      setError("")

      const { error } = await supabase.rpc("rpc_upsert_machine_item", {
        p_group: GROUP_CODE,
        p_machine_no: machineNo,
        p_product_sku: selectedProduct.product_sku,
        p_qty_piece: toSafeNumber(newQty),
      })

      if (error) throw error

      setShowAdd(false)
      setSearchText("")
      setSelectedProduct(null)
      setNewQty("")
      setProducts([])
      setMessage("已加入商品")

      await loadItems()
    } catch (err: any) {
      console.error(err)
      setError(err.message ?? "加入失敗")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={pageStyle}>
      <div style={topBarStyle}>
        <button onClick={onBack} style={backButtonStyle}>
          ←
        </button>

        <h1 style={titleStyle}>機台 #{machineNo}</h1>

        <button onClick={() => setMessage("已儲存")} style={saveButtonStyle}>
          儲存
        </button>
      </div>

      <button onClick={() => setShowAdd(true)} style={addProductButtonStyle}>
        ＋ 加入商品
      </button>

      {message && <div style={messageStyle}>{message}</div>}
      {error && <div style={errorStyle}>{error}</div>}
      {loading && <p style={mutedStyle}>載入中...</p>}

      {!loading && items.length === 0 && (
        <div style={emptyBoxStyle}>此機台尚未設定商品</div>
      )}

      {!loading && (
        <div style={listStyle}>
          {items.map((item) => (
            <div key={item.id} style={cardStyle}>
              <button onClick={() => deleteItem(item)} style={deleteButtonStyle}>
                ×
              </button>

              <div style={skuStyle}>{item.product_sku}</div>

              <div style={nameStyle}>
                {item.product_name || item.product_sku}
              </div>

              <div style={qtyRowStyle}>
                <span style={qtyLabelStyle}>台內數</span>

                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={item.qty_piece || ""}
                  onChange={(e) => updateLocalQty(item.id, e.target.value)}
                  onBlur={() => saveQty(item)}
                  style={qtyInputStyle}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {saving && <div style={savingStyle}>儲存中...</div>}

      {showAdd && (
        <div style={modalMaskStyle}>
          <div style={modalStyle}>
            <h2 style={modalTitleStyle}>加入商品</h2>

            <input
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value)
                setSelectedProduct(null)
              }}
              placeholder="搜尋貨編 / 名稱 / 條碼"
              style={searchInputStyle}
              autoFocus
            />

            {searching && <div style={mutedStyle}>搜尋中...</div>}

            {selectedProduct && (
              <div style={selectedBoxStyle}>
                已選：{selectedProduct.product_sku}
                <br />
                {selectedProduct.product_name}
                {selectedProduct.barcode && (
                  <>
                    <br />
                    條碼：{selectedProduct.barcode}
                  </>
                )}
              </div>
            )}

            <div style={productListStyle}>
              {products.map((product) => (
                <button
                  key={product.product_sku}
                  onClick={() => setSelectedProduct(product)}
                  style={{
                    ...productButtonStyle,
                    borderColor:
                      selectedProduct?.product_sku === product.product_sku
                        ? "#60a5fa"
                        : "#333",
                  }}
                >
                  <strong>{product.product_sku}</strong>
                  <br />
                  {product.product_name}
                  {product.barcode && (
                    <>
                      <br />
                      <span style={barcodeStyle}>條碼：{product.barcode}</span>
                    </>
                  )}
                </button>
              ))}

              {searchText.trim() && !searching && products.length === 0 && (
                <div style={emptyBoxStyle}>找不到商品</div>
              )}
            </div>

            <input
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              placeholder="台內數量"
              inputMode="numeric"
              type="number"
              min={0}
              style={searchInputStyle}
            />

            <div style={modalActionsStyle}>
              <button
                onClick={() => {
                  setShowAdd(false)
                  setSearchText("")
                  setSelectedProduct(null)
                  setNewQty("")
                  setProducts([])
                }}
                style={cancelButtonStyle}
              >
                取消
              </button>

              <button
                onClick={addProduct}
                disabled={saving}
                style={confirmButtonStyle}
              >
                加入
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "#050913",
  color: "#fff",
  padding: "20px 16px 28px",
  boxSizing: "border-box",
}

const topBarStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "48px 1fr 88px",
  alignItems: "center",
  marginBottom: 18,
}

const backButtonStyle: CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#fff",
  fontSize: 34,
}

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 30,
  fontWeight: 900,
}

const saveButtonStyle: CSSProperties = {
  height: 48,
  borderRadius: 16,
  border: "none",
  background: "#60a5fa",
  color: "#fff",
  fontSize: 18,
  fontWeight: 800,
}

const addProductButtonStyle: CSSProperties = {
  width: "100%",
  height: 58,
  borderRadius: 18,
  border: "none",
  background: "#60a5fa",
  color: "#fff",
  fontSize: 22,
  fontWeight: 900,
  marginBottom: 20,
}

const messageStyle: CSSProperties = {
  color: "#2fd66f",
  marginBottom: 12,
}

const errorStyle: CSSProperties = {
  color: "#ff6666",
  marginBottom: 12,
}

const mutedStyle: CSSProperties = {
  color: "#999",
}

const listStyle: CSSProperties = {
  display: "grid",
  gap: 18,
}

const cardStyle: CSSProperties = {
  position: "relative",
  background: "#3a3a3a",
  borderRadius: 24,
  padding: 18,
}

const deleteButtonStyle: CSSProperties = {
  position: "absolute",
  top: 12,
  right: 16,
  background: "transparent",
  border: "none",
  color: "red",
  fontSize: 28,
  fontWeight: 900,
}

const skuStyle: CSSProperties = {
  fontSize: 26,
  fontWeight: 900,
  marginBottom: 14,
}

const nameStyle: CSSProperties = {
  fontSize: 22,
  lineHeight: 1.4,
  marginBottom: 22,
}

const qtyRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 120px",
  alignItems: "center",
  gap: 12,
}

const qtyLabelStyle: CSSProperties = {
  fontSize: 22,
  color: "#fff",
}

const qtyInputStyle: CSSProperties = {
  width: 120,
  height: 52,
  borderRadius: 10,
  border: "1px solid #999",
  background: "#000",
  color: "#fff",
  fontSize: 22,
  padding: "0 12px",
  boxSizing: "border-box",
}

const emptyBoxStyle: CSSProperties = {
  color: "#999",
  border: "1px solid #273244",
  borderRadius: 18,
  padding: 18,
}

const savingStyle: CSSProperties = {
  color: "#999",
  marginTop: 16,
}

const modalMaskStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.75)",
  display: "flex",
  alignItems: "flex-end",
  zIndex: 100,
}

const modalStyle: CSSProperties = {
  width: "100%",
  maxHeight: "86vh",
  overflowY: "auto",
  background: "#101827",
  borderRadius: "24px 24px 0 0",
  padding: 18,
  boxSizing: "border-box",
}

const modalTitleStyle: CSSProperties = {
  marginTop: 0,
}

const searchInputStyle: CSSProperties = {
  width: "100%",
  height: 52,
  borderRadius: 14,
  border: "1px solid #333",
  background: "#000",
  color: "#fff",
  fontSize: 18,
  padding: "0 14px",
  boxSizing: "border-box",
  marginBottom: 12,
}

const selectedBoxStyle: CSSProperties = {
  color: "#2fd66f",
  marginBottom: 12,
  lineHeight: 1.5,
}

const productListStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  marginBottom: 14,
}

const productButtonStyle: CSSProperties = {
  textAlign: "left",
  border: "1px solid #333",
  borderRadius: 14,
  background: "#1a2233",
  color: "#fff",
  padding: 12,
  fontSize: 16,
  lineHeight: 1.5,
}

const barcodeStyle: CSSProperties = {
  color: "#aaa",
}

const modalActionsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
}

const cancelButtonStyle: CSSProperties = {
  height: 52,
  borderRadius: 14,
  border: "1px solid #555",
  background: "transparent",
  color: "#fff",
  fontSize: 18,
}

const confirmButtonStyle: CSSProperties = {
  height: 52,
  borderRadius: 14,
  border: "none",
  background: "#2563eb",
  color: "#fff",
  fontSize: 18,
  fontWeight: 800,
}