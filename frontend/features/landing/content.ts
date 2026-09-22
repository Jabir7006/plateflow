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
    title: "Scan-to-view menu",
    body: "Each table gets its own QR. Diners open a fast, photo-first menu that browses as an immersive deck or a simple list, in light or dark.",
    status: "live",
  },
  {
    icon: Ruler,
    title: "Sizes and real pricing",
    body: "Items carry their own sizes with distinct prices — Small, Regular, 12\" — and the menu always shows the right 'from' price.",
    status: "live",
  },
  {
    icon: LayoutGrid,
    title: "Menu management",
    body: "Owners edit categories, dishes, photos and availability from the dashboard. Changes reach every table instantly.",
    status: "live",
  },
  {
    icon: Users,
    title: "Role-based staff",
    body: "Invite Owners, Managers, Chefs and Waiters. Each role sees only what it needs, behind secure authentication.",
    status: "live",
  },
  {
    icon: Radio,
    title: "Live order tracking",
    body: "Diners watch their order move from placed to preparing to ready in real time — no refresh, no guessing.",
    status: "building",
  },
  {
    icon: ChefHat,
    title: "Kitchen display",
    body: "Orders land on the kitchen screen the moment they're placed. Chefs tap through Start, Ready and Picked up over a live socket.",
    status: "building",
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
    body: "The diner scans the table QR, browses the menu and places an order from their own phone.",
  },
  {
    step: "02",
    title: "Kitchen sees it live",
    body: "The order appears on the kitchen display instantly. The chef taps Start to begin preparing.",
  },
  {
    step: "03",
    title: "Status updates in real time",
    body: "Preparing, then Ready — each tap pushes straight to the diner's screen over a live connection.",
  },
  {
    step: "04",
    title: "Picked up",
    body: "The chef marks it picked up, the loop closes, and the table is ready for the next order.",
  },
]
