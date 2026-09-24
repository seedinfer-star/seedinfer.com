import { statsGet, statsOptions } from "@/lib/public-stats"

export const revalidate = 15
export const dynamic = "force-dynamic"

export async function OPTIONS() {
  return statsOptions()
}

export async function GET(request: Request) {
  return statsGet(request, "api/v1/stats")
}
