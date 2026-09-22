"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { cn } from "@/lib/utils"
import type { MenuItemGroup } from "@/features/menu/group-items"
import { useCart } from "../hooks/use-cart"
import { useViewMode } from "../hooks/use-view-mode"
import { useMenuTheme } from "../hooks/use-menu-theme"
import { MenuTopbar } from "./menu-topbar"
import { CategoryNav } from "./category-nav"
import { ImmersiveMenu } from "./immersive-menu"
import { SimpleMenu } from "./simple-menu"
import { OrderBar } from "./order-bar"
import { CartSheet } from "./cart-sheet"

interface MenuExperienceProps {
  tableNumber: number
  groups: MenuItemGroup[]
}

// The whole interactive diner menu: the view toggle (immersive carousel vs
// simple list), the category chips, whichever view is active, the running order
// bar, and the cart review sheet. One client island so the shared cart, the
// active category, and the remembered view mode all live together. The server
// still fetches + groups the menu; this receives serializable groups.
export function MenuExperience({ tableNumber, groups }: MenuExperienceProps) {
  const [mode, setMode] = useViewMode()
  const [theme, setTheme] = useMenuTheme()
  const cart = useCart()
  const [cartOpen, setCartOpen] = useState(false)
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
        onOpen={() => setCartOpen(true)}
      />
      <CartSheet open={cartOpen} onClose={() => setCartOpen(false)} cart={cart} />
    </div>
  )
}
