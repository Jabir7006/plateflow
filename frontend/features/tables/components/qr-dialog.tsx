"use client"

import { useRef } from "react"
import { QRCodeCanvas } from "qrcode.react"
import { Download, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Table } from "../api"
import { tableOrderUrl } from "../qr-url"

interface QrDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  table: Table
}

// Native canvas resolution: downloads and print always export at this size.
// The on-screen preview is capped below (max-w-[296px] = size + the wrapper's
// p-5 padding) and shrinks on narrow viewports. Level M balances scannability
// against density; a table sticker is printed large and scanned close, so it
// needs no extra error correction.
const QR_SIZE = 256

// Shows a table's QR so staff can download or print it. The value is derived
// from the token, so regenerating the token (elsewhere) re-renders this via the
// refreshed cache. No backend call here — the same token reprints the same code.
export function QrDialog({ open, onOpenChange, table }: QrDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const url = tableOrderUrl(table.qrCode)
  const fileName = `table-${table.number}-qr.png`

  function handleDownload() {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement("a")
    link.href = canvas.toDataURL("image/png")
    link.download = fileName
    link.click()
  }

  function handlePrint() {
    const canvas = canvasRef.current
    if (!canvas) return
    const dataUrl = canvas.toDataURL("image/png")
    const win = window.open("", "_blank", "width=420,height=520")
    if (!win) return
    // A minimal print document: the code centred with the table number, so the
    // printed sticker is self-labelling.
    win.document.write(
      `<!doctype html><html><head><title>Table ${table.number} QR</title>` +
        `<style>body{margin:0;display:flex;flex-direction:column;align-items:center;` +
        `justify-content:center;height:100vh;font-family:system-ui,sans-serif;gap:16px}` +
        `img{width:256px;height:256px}h1{font-size:20px;margin:0;font-weight:600}</style>` +
        `</head><body><h1>Table ${table.number}</h1>` +
        `<img src="${dataUrl}" alt="QR code for table ${table.number}" />` +
        `<script>window.onload=function(){window.focus();window.print();}<\/script>` +
        `</body></html>`
    )
    win.document.close()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid-cols-[minmax(0,1fr)] gap-6 p-6 sm:max-w-sm">
        <DialogHeader className="pr-8">
          <DialogTitle>Table {table.number} QR code</DialogTitle>
          <DialogDescription>
            Diners scan this to open the menu and order at this table.
          </DialogDescription>
        </DialogHeader>

        {/* min-w-0: the grid item must be allowed to shrink below the URL's
            nowrap min-content, or the whole track (and dialog) overflows. */}
        <div className="flex min-w-0 flex-col items-center gap-4">
          <div className="w-full max-w-[296px] rounded-2xl border bg-white p-5 shadow-sm">
            <QRCodeCanvas
              ref={canvasRef}
              value={url}
              size={QR_SIZE}
              level="M"
              marginSize={2}
              title={`QR code for table ${table.number}`}
              // Overrides the library's inline width/height (it is spread
              // last) so the preview scales with its container, while the
              // canvas backing store stays at QR_SIZE for crisp downloads.
              style={{ width: "100%", height: "auto" }}
            />
          </div>
          <p
            className="max-w-full truncate rounded-md bg-muted px-2.5 py-1 font-mono text-xs text-muted-foreground"
            title={url}
          >
            {url}
          </p>
        </div>

        <DialogFooter className="m-0 flex-row gap-2 border-0 bg-transparent p-0">
          <Button
            type="button"
            variant="outline"
            className="h-10 flex-1"
            onClick={handleDownload}
          >
            <Download />
            Download
          </Button>
          <Button type="button" className="h-10 flex-1" onClick={handlePrint}>
            <Printer />
            Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
