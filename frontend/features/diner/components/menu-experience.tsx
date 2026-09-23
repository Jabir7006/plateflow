"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { ChevronUp, ReceiptText } from "lucide-react"
import { cn } from "@/lib/utils"
import type { MenuItemGroup } from "@/features/menu/group-items"
import { useCart } from "../hooks/use-cart"
import { useViewMode } from "../hooks/use-view-mode"
import { useMenuTheme } from "../hooks/use-menu-theme"
import { useOrderIds } from "../order-storage"
import { usePlaceOrder } from "../hooks/use-place-order"
import { MenuTopbar } from "./menu-topbar"
import { CategoryNav } from "./category-nav"
import { ImmersiveMenu } from "./immersive-menu"
import { SimpleMenu } from "./simple-menu"
import { OrderBar } from "./order-bar"
import { OrdersSheet } from "./orders-sheet"
import { CartSheet } from "./cart-sheet"

interface MenuExperienceProps {
  tableNumber: number
  groups: MenuItemGroup[]
  // The table's QR token, passed to the cart so it can place the order.
  token: string
}

// The whole interactive diner menu: the view toggle (immersive carousel vs
// simple list), the category chips, whichever view is active, the running order
// bar, and the cart review sheet. One client island so the shared cart, the
// active category, and the remembered view mode all live together. The server
// still fetches + groups the menu; this receives serializable groups.
export function MenuExperience({
  tableNumber,
  groups,
  token,
}: MenuExperienceProps) {
  const [mode, setMode] = useViewMode()
  const [theme, setTheme] = useMenuTheme()
  const cart = useCart()
  const [cartOpen, setCartOpen] = useState(false)
  const [ordersOpen, setOrdersOpen] = useState(false)
  const [note, setNote] = useState("")
  const orderIds = useOrderIds(token)
  const placeOrder = usePlaceOrder(token, () => {
    cart.clear()
    setNote("")
  })

  // Drives the button's spinner/disabled UI. isPending covers the request in
  // flight; isSuccess keeps it locked in the brief window after it resolves while
  // the menu is still mounted, before navigation to the status page commits.
  const submitting = placeOrder.isPending || placeOrder.isSuccess

  // The hard guarantee against a duplicate order: set synchronously on the first
  // tap so a second tap in the same tick (multi-touch, event replay) — before
  // React re-renders and `disabled`/`submitting` take effect — is rejected. Reset
  // only on error; a success stays locked because we navigate away.
  const inFlight = useRef(false)

  // Build the order body from the cart and submit it. Shared by the order bar's
  // "Order now" button and the review sheet's "Place order". The note lives here,
  // so it's sent from whichever button places the order (typing it in the sheet
  // then tapping the bar still includes it). On success the hook clears the cart
  // + note and navigates to the status page.
  const submitOrder = () => {
    if (cart.lines.length === 0 || inFlight.current) return
    inFlight.current = true
    const trimmedNote = note.trim()
    placeOrder.mutate(
      {
        items: cart.lines.map(({ item, size, quantity }) => ({
          menuItemId: item.id,
          sizeId: size?.id ?? null,
          quantity,
        })),
        note: trimmedNote ? trimmedNote : null,
      },
      {
        onError: () => {
          inFlight.current = false
        },
      }
    )
  }
  const [activeCategoryId, setActiveCategoryId] = useState(
    groups[0]?.categoryId ?? ""
  )
  const rootRef = useRef<HTMLDivElement>(null)

  const activeGroup = useMemo(
    () => groups.find((g) => g.categoryId === activeCategoryId) ?? groups[0],
    [groups, activeCategoryId]
  )

  // Pin the resolved theme on the `.menu-page` wrapper (rendered by the server
  // in page.tsx) so the whole subtree — including the fixed order bar and the
  // portal-free cart sheet — re-themes together. We set an EXPLICIT class so it
  // overrides the `prefers-color-scheme` default in globals.css in both
  // directions: a light-phone diner who wants dark gets `.menu-dark`, and vice
  // versa. Until this runs (first paint) CSS already shows the system default,
  // so the common case never flashes. We walk up to the wrapper rather than
  // owning the class here because its background sits above this island.
  useEffect(() => {
    const page = rootRef.current?.closest(".menu-page")
    if (!page) return
    page.classList.toggle("menu-light", theme === "light")
    page.classList.toggle("menu-dark", theme === "dark")
  }, [theme])

  return (
    // App shell: header pinned on top, the active view fills and scrolls the
    // middle, the order bar floats over the bottom as a fixed overlay (so it
    // never shifts or shrinks the content). The middle scrolls in both views so
    // a small phone can reach everything instead of crushing it.
    <div ref={rootRef} className="flex h-dvh flex-col overflow-hidden">
      <div className="z-20 shrink-0 bg-background/80 backdrop-blur-md">
        <MenuTopbar
          tableNumber={tableNumber}
          mode={mode}
          onModeChange={setMode}
          theme={theme}
          onThemeChange={setTheme}
        />
        <CategoryNav
          categories={groups.map((g) => ({
            id: g.categoryId,
            name: g.categoryName,
          }))}
          activeId={activeGroup?.categoryId ?? ""}
          onSelect={setActiveCategoryId}
        />
      </div>

      {/* View + category changes cross-fade so switching feels like a transition
          rather than a hard swap. The key ties the fade to the exact
          view+category on screen. */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${mode}-${activeGroup?.categoryId}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto")}
        >
          {activeGroup ? (
            mode === "immersive" ? (
              <ImmersiveMenu items={activeGroup.items} cart={cart} />
            ) : (
              <SimpleMenu
                categoryName={activeGroup.categoryName}
                items={activeGroup.items}
                cart={cart}
              />
            )
          ) : null}
        </motion.div>
      </AnimatePresence>

      <OrderBar
        itemCount={cart.itemCount}
        total={cart.total}
        placing={submitting}
        onOpen={() => setCartOpen(true)}
        onPlace={submitOrder}
      />

      {/* Once this phone has placed orders, a single labelled pill sits at the
          bottom (only while the cart is empty, so it never fights the order bar)
          and opens the full list in a sheet. A text label — not a bare icon — so
          a first-time diner knows exactly what it is, and it takes just one line
          rather than covering the menu. */}
      <AnimatePresence>
        {cart.itemCount === 0 && orderIds.length > 0 ? (
          <motion.div
            initial={{ y: 90, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 90, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
          >
            <button
              type="button"
              onClick={() => setOrdersOpen(true)}
              className="pointer-events-auto mx-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur-md"
            >
              <ReceiptText className="size-5 shrink-0 text-brand" />
              <span className="flex-1 text-left font-medium text-foreground">
                Your orders
                <span className="ml-1.5 text-sm text-muted-foreground tabular-nums">
                  ({orderIds.length})
                </span>
              </span>
              <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* The full list, opened from the pill above. A slide-up sheet (like the
          cart) so it never occupies the menu or the order bar's bottom slot. */}
      <OrdersSheet
        open={ordersOpen}
        onClose={() => setOrdersOpen(false)}
        token={token}
        orderIds={orderIds}
      />

      <CartSheet
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        note={note}
        onNoteChange={setNote}
        placing={submitting}
        onPlace={submitOrder}
      />
    </div>
  )
}
