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

// Level M balances scannability against density; a table sticker is printed
// large and scanned close, so it needs no extra error correction.
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
      <DialogContent className="gap-5 p-6 sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Table {table.number} QR code</DialogTitle>
          <DialogDescription>
            Diners scan this to open the table&apos;s menu and order.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3">
          <div className="rounded-xl border bg-white p-4">
            <QRCodeCanvas
              ref={canvasRef}
              value={url}
              size={QR_SIZE}
              level="M"
              marginSize={2}
              title={`QR code for table ${table.number}`}
            />
          </div>
          <p className="max-w-full truncate text-xs text-muted-foreground" title={url}>
            {url}
          </p>
        </div>

        <DialogFooter className="flex-row gap-2 border-0 bg-transparent">
          <Button
            type="button"
            variant="outline"
            className="h-10 flex-1"
            onClick={handleDownload}
          >
            <Download />
            Download
          </Button>
          <Button
            type="button"
            className="h-10 flex-1"
            onClick={handlePrint}
          >
            <Printer />
            Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
