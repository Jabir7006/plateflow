"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight, UtensilsCrossed } from "lucide-react"
import useEmblaCarousel from "embla-carousel-react"
import type { UseEmblaCarouselType } from "embla-carousel-react"
import type { MenuItem } from "@plateflow/shared"
import { cn } from "@/lib/utils"
import { formatPriceNumber } from "@/features/menu/format-price"
import type { Cart } from "../hooks/use-cart"
import {
  DEFAULT_SIZE,
  categoryHasSizes,
  type SizeOption,
} from "../size-options"
import { QuantityControl } from "./quantity-control"
import { SizeSelector } from "./size-selector"

interface ImmersiveMenuProps {
  categoryName: string
  items: MenuItem[]
  cart: Cart
}

// Fanned-deck tuning. A neighbour is pulled inward (so it tucks behind the
// focused card), tilted, scaled down and dimmed by its distance from centre —
// giving the reference's overlapping "fan of cards" look rather than three
// separate cards in a row. The focused card sits upright, full size, on top.
const TWEEN_PULL = 8 // % of its own width a full neighbour tucks toward centre
const TWEEN_ANGLE = 10 // deg tilt of a full neighbour (signed by side)
const TWEEN_SCALE = 0.26 // how much a full neighbour shrinks (so it recedes)
const TWEEN_DIM = 0.58 // how much a full neighbour dims (so it recedes)

// The embla API instance, the second element of the hook's returned tuple. Taken
// from the wrapper's own type so we don't import the transitive `embla-carousel`
// package directly.
type EmblaApi = NonNullable<UseEmblaCarouselType[1]>

// The immersive view: a swipeable deck showing one dish at a time as a big card
// with its neighbours fanned out behind it, then the focused dish's details.
// The deck has a natural, viewport-relative height and the whole view scrolls if
// a short phone can't fit everything — so nothing gets crushed on small screens.
export function ImmersiveMenu({
  categoryName,
  items,
  cart,
}: ImmersiveMenuProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "center",
    containScroll: false,
  })
  const slideRefs = useRef<(HTMLDivElement | null)[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [size, setSize] = useState<SizeOption>(DEFAULT_SIZE)

  const showSizes = useMemo(
    () => categoryHasSizes(categoryName),
    [categoryName]
  )

  // Fan each slide by its distance from centre, written straight to the DOM on
  // every scroll frame. Doing this imperatively (not via React state) means a
  // drag never triggers a re-render, which is what keeps it smooth on low-end
  // phones. z-index layers the focused card above its tucked neighbours.
  const applyTween = useCallback((embla: EmblaApi) => {
    const progress = embla.scrollProgress()
    const snaps = embla.scrollSnapList()

    snaps.forEach((snap, index) => {
      const node = slideRefs.current[index]
      if (!node) return
      // Signed distance from centre: negative = left of centre, positive =
      // right. Sign drives the lean + pull direction; magnitude the amount.
      const diff = (snap - progress) * snaps.length
      const signed = Math.max(-1, Math.min(diff, 1))
      const clamped = Math.abs(signed)

      const scale = 1 - clamped * TWEEN_SCALE
      const rotate = signed * TWEEN_ANGLE
      const opacity = 1 - clamped * TWEEN_DIM
      // Tuck slightly toward centre so the neighbour sits behind the focused
      // card (which is layered on top via z-index) rather than beside it.
      const translate = -signed * TWEEN_PULL

      node.style.transform = `translateX(${translate}%) rotate(${rotate}deg) scale(${scale})`
      node.style.opacity = `${opacity}`
      // z-index must live on the flex item (the stacking sibling), so nearer the
      // centre = higher and the focused card sits on top of its neighbours
      // instead of whichever slide happens to come later in the DOM.
      node.style.zIndex = `${Math.round((1 - clamped) * 10)}`
    })
  }, [])

  const onSelect = useCallback((embla: EmblaApi) => {
    setSelectedIndex(embla.selectedScrollSnap())
  }, [])

  useEffect(() => {
    if (!emblaApi) return

    const onScroll = () => applyTween(emblaApi)
    const onSel = () => onSelect(emblaApi)

    // Initial paint on the next frame, after embla has measured its layout.
    const frame = requestAnimationFrame(() => {
      applyTween(emblaApi)
      onSel()
    })

    emblaApi.on("scroll", onScroll)
    emblaApi.on("reInit", onScroll)
    emblaApi.on("reInit", onSel)
    emblaApi.on("select", onSel)
    return () => {
      cancelAnimationFrame(frame)
      emblaApi.off("scroll", onScroll)
      emblaApi.off("reInit", onScroll)
      emblaApi.off("reInit", onSel)
      emblaApi.off("select", onSel)
    }
  }, [emblaApi, applyTween, onSelect])

  const focused = items[selectedIndex] ?? items[0]
  const atStart = selectedIndex === 0
  const atEnd = selectedIndex === items.length - 1

  return (
    // Natural top-down flow: the deck sits at the card's own height and the
    // details follow below. Nothing constrains the deck's height, so the square
    // card is NEVER cropped; if a short phone can't fit it all, the parent
    // scrolls. (An earlier flex-1 deck crushed the square into a landscape
    // sliver — that's the regression this reverts.) pb clears the order bar.
    <div className="mx-auto w-full max-w-lg px-2 pt-2 pb-28">
      {/* overflow-hidden is REQUIRED by embla (it clips the horizontally
          translated track); py gives the tilted neighbours room top/bottom. */}
      <div className="overflow-hidden py-4" ref={emblaRef}>
        <div className="flex touch-pan-y items-center">
          {items.map((item, index) => (
            <div
              key={item.id}
              ref={(el) => {
                slideRefs.current[index] = el
              }}
              // The stacking sibling. transform/opacity/zIndex are set
              // imperatively in applyTween; origin-bottom so the tilt pivots
              // from the base and the deck fans out like the reference.
              className="min-w-0 flex-[0_0_72%] origin-bottom px-2 will-change-[transform,opacity] sm:flex-[0_0_60%]"
            >
              {/* Square card, sized by its slide's WIDTH (aspect-square w-full)
                  so it's always exactly the slide width and can never spill into
                  the neighbour — that's the whole fix for cards touching on some
                  phones. It's centred in the deck (items-center); on a very short
                  phone overflow-hidden crops the photo a touch, top and bottom
                  evenly, rather than clipping the card. */}
              <div className="aspect-square w-full">
                <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[2rem] bg-linear-to-br from-brand/30 via-card to-background shadow-2xl">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt=""
                      fill
                      sizes="(min-width: 640px) 320px, 72vw"
                      priority={index === 0}
                      className="object-cover"
                    />
                  ) : (
                    <UtensilsCrossed className="size-16 text-brand/40" />
                  )}
                  {!item.isAvailable ? (
                    <span className="absolute top-3 left-3 rounded-full bg-background/80 px-3 py-1 text-xs text-foreground backdrop-blur">
                      Unavailable
                    </span>
                  ) : null}

                  {/* Promo-style price tag badge */}
                  <div className="absolute right-3.5 bottom-3.5 z-10 flex -rotate-2 items-baseline gap-1 rounded-2xl bg-brand px-3.5 py-1.5 text-brand-foreground shadow-xl ring-2 shadow-black/40 ring-background/60 transition-transform duration-200 select-none hover:scale-105 hover:rotate-0">
                    <span className="font-display text-sm leading-none font-bold opacity-90 sm:text-base">
                      ৳
                    </span>
                    <span className="font-display text-2xl leading-none font-black tracking-tight tabular-nums sm:text-3xl">
                      {formatPriceNumber(item.price)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Details — fixed heights so nothing shifts as text length changes
          between dishes. A single-line subtitle (not a paragraph) keeps it tight
          like the reference. */}
      {focused ? (
        <div className="px-4 pt-5 text-center">
          <div className="flex h-8 items-center justify-center">
            <h2 className="font-display text-2xl leading-tight font-semibold text-foreground">
              {focused.name}
            </h2>
          </div>

          <div className="flex h-5 items-center justify-center">
            <p className="line-clamp-1 max-w-xs text-sm text-muted-foreground">
              {focused.description ?? ""}
            </p>
          </div>

          {/* Dots */}
          {items.length > 1 ? (
            <div className="mt-4 flex items-center justify-center gap-1.5">
              {items.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={`Go to ${item.name}`}
                  onClick={() => emblaApi?.scrollTo(index)}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    index === selectedIndex
                      ? "w-5 bg-brand"
                      : "w-1.5 bg-muted-foreground/40"
                  )}
                />
              ))}
            </div>
          ) : null}

          {/* Size row — reserve the height even when a category has no sizes so
              the action row below stays put across categories. */}
          <div className="mt-5 flex h-12 items-center justify-center">
            {showSizes ? (
              <SizeSelector value={size} onChange={setSize} />
            ) : null}
          </div>

          {/* Action row: prev / add / next, like the reference. */}
          <div className="mx-auto mt-5 flex max-w-sm items-center gap-3">
            <button
              type="button"
              aria-label="Previous item"
              onClick={() => emblaApi?.scrollPrev()}
              disabled={atStart}
              className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-border text-foreground transition-colors hover:bg-card disabled:opacity-30"
            >
              <ChevronLeft className="size-5" />
            </button>

            <div className="flex-1">
              <QuantityControl
                variant="solid"
                label={focused.name}
                quantity={cart.quantityOf(focused.id)}
                onAdd={() => cart.add(focused)}
                onRemove={() => cart.remove(focused.id)}
              />
            </div>

            <button
              type="button"
              aria-label="Next item"
              onClick={() => emblaApi?.scrollNext()}
              disabled={atEnd}
              className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-border text-foreground transition-colors hover:bg-card disabled:opacity-30"
            >
              <ChevronRight className="size-5" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
