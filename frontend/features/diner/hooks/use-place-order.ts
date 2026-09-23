"use client"

import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { toast } from "@/components/ui/toast"
import { getErrorMessage } from "@/lib/api-error"
import { placeOrder, type PlaceOrderInput } from "../order-api"
import { rememberOrder } from "../order-storage"

// Places the order, then clears the cart, remembers the order id on this phone,
// and sends the diner to its status page. Clearing the cart is explicit (via the
// caller's `onPlaced`) rather than relying on the menu unmounting on navigation.
// A failure (an item went unavailable, network) surfaces as a toast with the
// server's reason; the cart is left intact so they can retry.
export function usePlaceOrder(token: string, onPlaced?: () => void) {
  const router = useRouter()

  return useMutation({
    mutationFn: (input: PlaceOrderInput) => placeOrder(token, input),
    onSuccess: (order) => {
      onPlaced?.()
      rememberOrder(token, order.id)
      router.push(`/t/${encodeURIComponent(token)}/order/${order.id}`)
    },
    onError: (error) => {
      toast.add({
        type: "error",
        title: "Couldn't place your order",
        description: getErrorMessage(error) ?? "Please try again.",
      })
    },
  })
}
