"use client"

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
  return (
    <div className="mx-auto max-w-2xl px-4 pt-2 pb-28">
      <h2 className="mb-2 font-display text-xl font-semibold tracking-wide text-foreground uppercase">
        {categoryName}
      </h2>

      <ul className="divide-y divide-border">
        {items.map((item, index) => (
          <motion.li
            key={item.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: Math.min(index * 0.04, 0.24) }}
            className="flex items-center gap-4 py-4"
          >
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
                {formatPrice(item.price)}
              </p>
            </div>

            <div className={cn("shrink-0")}>
              <QuantityControl
                variant="pill"
                label={item.name}
                quantity={cart.quantityOf(item.id)}
                onAdd={() => cart.add(item)}
                onRemove={() => cart.remove(item.id)}
              />
            </div>
          </motion.li>
        ))}
      </ul>
    </div>
  )
}
