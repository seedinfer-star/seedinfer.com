import Sidebar from "@/components/sidebar"
import Calculator from "@/components/calculator"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default function ProviderPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <main className="min-h-0 flex-1 overflow-y-auto bg-bg-primary p-4 sm:p-6">
          <div className="mx-auto max-w-[1600px] space-y-6">
            <Calculator />
          </div>
        </main>
      </div>
    </div>
  )
}
