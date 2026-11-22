"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { useSyncExternalStore } from "react"
import { DEMO_MENU_PATH } from "../content"

const subscribe = () => () => {}
const getOrigin = () => window.location.origin
const getServerOrigin = () => ""

export function MenuPreview() {
  const origin = useSyncExternalStore(subscribe, getOrigin, getServerOrigin)
  const menuUrl = origin ? new URL(DEMO_MENU_PATH, origin).href : ""

  return (
    <div
      className="menu-scene"
      aria-label="Preview of PlateFlow’s actual diner menu"
    >
      <div className="menu-scene-caption">
        <span>The guest experience</span>
        <span>From the actual menu</span>
      </div>
      <Link
        href={DEMO_MENU_PATH}
        className="menu-preview"
        aria-label="Try the live PlateFlow diner menu"
      >
        <Image
          src="/images/diner-menu-light.webp"
          alt="PlateFlow’s diner menu showing the Classic Cheeseburger, burger categories, a ৳180 price, size options and the Add button"
          width={390}
          height={700}
          sizes="(max-width: 320px) 240px, (max-width: 900px) 260px, 280px"
          className="real-menu-image real-menu-light"
          preload
        />
        <Image
          src="/images/diner-menu-dark.webp"
          alt="PlateFlow’s diner menu in dark mode showing the Classic Cheeseburger, burger categories, a ৳180 price, size options and the Add button"
          width={390}
          height={700}
          sizes="(max-width: 320px) 240px, (max-width: 900px) 260px, 280px"
          className="real-menu-image real-menu-dark"
        />
        <span className="menu-preview-open">
          Try the live menu <ArrowUpRight size={16} strokeWidth={1.5} />
        </span>
      </Link>
      <div className="table-tent">
        <p className="table-tent-name">PlateFlow</p>
        <p className="table-tent-number">Table 100</p>
        <Link
          href={DEMO_MENU_PATH}
          aria-label="Open the live demo menu from the table QR code"
          className="table-tent-qr block"
        >
          {menuUrl ? (
            <QRCodeSVG
              value={menuUrl}
              size={120}
              level="M"
              fgColor="#33382d"
              bgColor="#ffffff"
            />
          ) : (
            <div className="aspect-square" />
          )}
        </Link>
        <p className="table-tent-note">Scan to explore the menu</p>
      </div>
    </div>
  )
}
