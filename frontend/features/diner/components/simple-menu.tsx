"use client"

import { useState } from "react"
import Image from "next/image"
import { UtensilsCrossed } from "lucide-react"
import { motion } from "motion/react"
import type { MenuItem } from "@plateflow/shared"
import { cn } from "@/lib/utils"
import { formatPrice } from "@/features/menu/format-price"
import type { Cart } from "../hooks/use-cart"
import { QuantityControl } from "./quantity-control"

interface SimpleMenuProps {
  categoryName: string
  items: MenuItem[]
  cart: Cart
}

// A thumbnail: photo when present, a branded tile when not, so a partly
// photographed menu reads as intentional rather than showing empty boxes.
function Thumb({ item }: { item: MenuItem }) {
  return (
    <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-muted">
      {item.imageUrl ? (
        <Image
          src={item.imageUrl}
          alt=""
          fill
          sizes="80px"
          className="object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-brand/15">
          <UtensilsCrossed className="size-6 text-brand/35" />
        </div>
      )}
    </div>
  )
}

// The calmer, familiar list view: category heading then a row per dish with a
// thumbnail, name, description, price, and an add/stepper. Same shared cart as
// the immersive view, so switching between them keeps the order intact.
export function SimpleMenu({ categoryName, items, cart }: SimpleMenuProps) {
  const [sizeByItem, setSizeByItem] = useState<Record<string, string>>({})

  return (
    <div className="mx-auto max-w-2xl px-4 pt-2 pb-28">
      <h2 className="mb-2 font-display text-xl font-semibold tracking-wide text-foreground uppercase">
        {categoryName}
      </h2>

      <ul className="divide-y divide-border">
        {items.map((item, index) => {
          const selectedId =
            sizeByItem[item.id] ?? item.sizes[0]?.id ?? ""
          const selectedSize =
            item.sizes.find((s) => s.id === selectedId) ?? null
          const price = selectedSize ? selectedSize.price : item.price

          return (
            <motion.li
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: Math.min(index * 0.04, 0.24) }}
              className="py-4"
            >
              <div className="flex items-center gap-4">
                <Thumb item={item} />

                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-base leading-snug font-medium text-foreground">
                    {item.name}
                  </h3>
                  {item.description ? (
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  ) : null}
                  <p className="mt-1 font-medium text-brand tabular-nums">
                    {formatPrice(price)}
                  </p>
                </div>

                <div className="shrink-0">
                  <QuantityControl
                    variant="pill"
                    label={
                      selectedSize
                        ? `${item.name} ${selectedSize.label}`
                        : item.name
                    }
                    quantity={cart.quantityOf(item.id, selectedSize?.id)}
                    onAdd={() => cart.add(item, selectedSize)}
                    onRemove={() => cart.remove(item.id, selectedSize?.id)}
                  />
                </div>
              </div>

              {/* Sizes get their own full-width row so the labels never squeeze
                  into a narrow column and stack vertically. */}
              {item.sizes.length > 0 ? (
                <div
                  role="radiogroup"
                  aria-label={`Size for ${item.name}`}
                  className="mt-2.5 flex flex-wrap gap-2"
                >
                  {item.sizes.map((size) => {
                    const isActive = size.id === selectedId
                    return (
                      <button
                        key={size.id}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        onClick={() =>
                          setSizeByItem((prev) => ({
                            ...prev,
                            [item.id]: size.id,
                          }))
                        }
                        className={cn(
                          "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                          isActive
                            ? "border-brand bg-brand text-brand-foreground"
                            : "border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {size.label}
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </motion.li>
          )
        })}
      </ul>
    </div>
  )
}
