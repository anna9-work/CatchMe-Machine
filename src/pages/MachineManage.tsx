import { useEffect, useMemo, useState, type CSSProperties } from "react"
import { supabase } from "../lib/supabase"

type Props = {
  onBack: () => void
  onOpenMachine: (machineNo: string) => void
}

type Machine = {
  id: number
  machine_no: string
  is_active: boolean
}

type MachineItem = {
  id: number
  machine_no: string
  product_sku: string
  qty_piece: number
  product_name: string
}

const GROUP_CODE = "catch_0001"

export default function MachineManage({
  onBack,
  onOpenMachine,
}: Props) {
  const [machines, setMachines] = useState<Machine[]>([])
  const [items, setItems] = useState<MachineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const nextMachineNo = useMemo(() => {
    const maxNo = machines.reduce((max, machine) => {
      const n = Number(machine.machine_no)
      if (!Number.isFinite(n)) return max
      return Math.max(max, n)
    }, 0)

    return String(maxNo + 1).padStart(3, "0")
  }, [machines])

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      setError("")

      const { data: machineData, error: machineError } = await supabase
        .from("machines")
        .select("id,machine_no,is_active")
        .eq("group_code", GROUP_CODE)
        .eq("is_active", true)
        .order("machine_no", { ascending: true })

      if (machineError) throw machineError

      const { data: itemData, error: itemError } = await supabase
        .from("machine_items")
        .select("id,machine_no,product_sku,qty_piece")
        .eq("group_code", GROUP_CODE)

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

      const mergedItems: MachineItem[] = (itemData ?? []).map((item) => ({
        id: item.id,
        machine_no: item.machine_no,
        product_sku: item.product_sku,
        qty_piece: Number(item.qty_piece ?? 0),
        product_name: productMap.get(item.product_sku) ?? "",
      }))

      setMachines((machineData ?? []) as Machine[])
      setItems(mergedItems)
    } catch (err: any) {
      console.error(err)
      setError(err.message ?? "讀取失敗")
    } finally {
      setLoading(false)
    }
  }

  async function addNextMachine() {
    const machineNo = nextMachineNo

    const existed = machines.some((m) => m.machine_no === machineNo)

    if (existed) {
      setError(`機台 ${machineNo} 已存在`)
      return
    }

    try {
      setSaving(true)
      setError("")
      setMessage("")

      const { error } = await supabase.from("machines").insert({
        group_code: GROUP_CODE,
        machine_no: machineNo,
        is_active: true,
      })

      if (error) throw error

      setMessage(`已新增機台 ${machineNo}`)
      await loadData()
    } catch (err: any) {
      console.error(err)
      setError(err.message ?? "新增失敗")
    } finally {
      setSaving(false)
    }
  }

  function getItems(machineNo: string) {
    return items.filter((item) => item.machine_no === machineNo)
  }

  return (
    <div style={pageStyle}>
      <div style={topBarStyle}>
        <button onClick={onBack} style={backButtonStyle}>
          ←
        </button>

        <div>
          <h1 style={titleStyle}>機台管理</h1>
          <div style={subTitleStyle}>
            {machines.length} 台機台
          </div>
        </div>

        <button onClick={loadData} style={refreshButtonStyle}>
          ↻
        </button>
      </div>

      {message && <div style={messageStyle}>{message}</div>}
      {error && <div style={errorStyle}>{error}</div>}
      {loading && <p style={mutedStyle}>載入中...</p>}

      {!loading && (
        <div style={listStyle}>
          {machines.map((machine) => {
            const machineItems = getItems(machine.machine_no)
            const previewItems = machineItems.slice(0, 2)
            const remainCount = machineItems.length - previewItems.length

            return (
              <div
                key={machine.id}
                style={machineCardStyle}
                onClick={() => onOpenMachine(machine.machine_no)}
              >
                <div style={machineHeaderStyle}>
                  <div style={machineNoStyle}>
                    #{machine.machine_no}
                  </div>

                  <div style={countStyle}>
                    {machineItems.length} 項
                  </div>
                </div>

                {previewItems.map((item) => (
                  <div key={item.id} style={previewRowStyle}>
                    <div style={previewNameStyle}>
                      {item.product_name || item.product_sku}
                    </div>

                    <div style={previewQtyStyle}>
                      {item.qty_piece}
                    </div>
                  </div>
                ))}

                {remainCount > 0 && (
                  <div style={moreStyle}>
                    +{remainCount}
                  </div>
                )}
              </div>
            )
          })}

          <div style={addMachineCardStyle}>
            <button
              onClick={addNextMachine}
              disabled={saving}
              style={bottomAddButtonStyle}
            >
              {saving
                ? "新增中..."
                : `＋ 新增機台 ${nextMachineNo}`}
            </button>
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
  padding: "44px 16px 28px",
  boxSizing: "border-box",
}

const topBarStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "48px 1fr 48px",
  alignItems: "center",
  marginBottom: 20,
}

const backButtonStyle: CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#fff",
  fontSize: 34,
}

const refreshButtonStyle: CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#fff",
  fontSize: 28,
}

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 30,
  fontWeight: 900,
}

const subTitleStyle: CSSProperties = {
  color: "#999",
  marginTop: 4,
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
  gap: 16,
}

const machineCardStyle: CSSProperties = {
  background: "#101827",
  border: "1px solid #273244",
  borderRadius: 24,
  padding: 16,
  cursor: "pointer",
}

const machineHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 12,
}

const machineNoStyle: CSSProperties = {
  color: "#2fd66f",
  fontSize: 28,
  fontWeight: 900,
}

const countStyle: CSSProperties = {
  color: "#aaa",
  fontSize: 16,
}

const previewRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  marginTop: 8,
}

const previewNameStyle: CSSProperties = {
  color: "#ddd",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  maxWidth: "75%",
}

const previewQtyStyle: CSSProperties = {
  color: "#fff",
  fontWeight: 700,
}

const moreStyle: CSSProperties = {
  marginTop: 10,
  textAlign: "center",
  color: "#999",
}

const addMachineCardStyle: CSSProperties = {
  background: "#101827",
  border: "1px dashed #3b82f6",
  borderRadius: 24,
  padding: 16,
}

const bottomAddButtonStyle: CSSProperties = {
  width: "100%",
  height: 56,
  borderRadius: 16,
  border: "none",
  background: "#2563eb",
  color: "#fff",
  fontSize: 18,
  fontWeight: 800,
}