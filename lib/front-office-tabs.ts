export const FRONT_OFFICE_TABS = ["home", "shifts", "assignments", "supervisor"] as const

export type FrontOfficeTab = (typeof FRONT_OFFICE_TABS)[number]

export function isFrontOfficeTab(value: string | null): value is FrontOfficeTab {
  return value !== null && FRONT_OFFICE_TABS.includes(value as FrontOfficeTab)
}
