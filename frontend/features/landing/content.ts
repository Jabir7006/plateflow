import {
  QrCode,
  ChefHat,
  LayoutGrid,
  Ruler,
  Users,
  Radio,
  type LucideIcon,
} from "lucide-react"

export const DEMO_MENU_PATH =
  process.env.NEXT_PUBLIC_DEMO_MENU_PATH ??
  "/t/ANlbxN5ErrFogNrum_ujjLEta42EPgD719S2yXKHcw"

export const LOGIN_PATH = "/login"

export const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#flow" },
  { label: "For staff", href: "#staff" },
] as const

export interface Feature {
  icon: LucideIcon
  title: string
  body: string
  status?: "live" | "building"
}

export const FEATURES: Feature[] = [
  {
    icon: QrCode,
    title: "One scan, the whole menu",
    body: "A QR code for each table opens a photo-first menu on your guest’s phone. Browse as a deck or a list, in light or dark.",
    status: "live",
  },
  {
    icon: Ruler,
    title: "Every size, clearly priced",
    body: "Small, regular or a 12-inch pizza. Set a price for each size and show guests exactly where pricing starts.",
    status: "live",
  },
  {
    icon: LayoutGrid,
    title: "A menu that stays current",
    body: "Edit dishes, photos and categories in your workspace. Update availability when something sells out.",
    status: "live",
  },
  {
    icon: Users,
    title: "Everyone has their place",
    body: "Invite managers, chefs and waiters with access suited to their role. Keep the team in one shared workspace.",
    status: "live",
  },
  {
    icon: Radio,
    title: "Live order tracking",
    body: "Guests follow their order from placed to preparing to ready, with updates sent straight to their phone.",
    status: "live",
  },
  {
    icon: ChefHat,
    title: "Kitchen display",
    body: "A dedicated screen brings orders to the kitchen. Chefs move each ticket through preparing, ready and picked up.",
    status: "live",
  },
]

export interface FlowStep {
  step: string
  title: string
  body: string
}

// The end-to-end loop that sets PlateFlow apart, told in order.
export const FLOW_STEPS: FlowStep[] = [
  {
    step: "01",
    title: "Scan and order",
    body: "Guests scan their table’s QR code, browse the menu and place an order on their own phone.",
  },
  {
    step: "02",
    title: "Kitchen sees it live",
    body: "Orders go straight to the kitchen display, ready for the chef to start preparing.",
  },
  {
    step: "03",
    title: "Status updates in real time",
    body: "Preparing, then ready. Each update reaches the guest without a refresh.",
  },
  {
    step: "04",
    title: "Picked up",
    body: "The kitchen marks the order picked up, closing the loop for the next service.",
  },
]
