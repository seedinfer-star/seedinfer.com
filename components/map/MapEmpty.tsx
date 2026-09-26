"use client"

type Props = {
  height?: number
  message?: string
}

export default function MapEmpty({
  height = 360,
  message = "Interactive map unavailable in this browser (WebGL disabled). Provider countries are listed below.",
}: Props) {
  return (
    <div
      style={{ height }}
      className="flex w-full items-center justify-center rounded-xl border border-dashed border-border-dim bg-bg-tertiary p-4 text-center text-xs text-text-tertiary"
    >
      {message}
    </div>
  )
}
