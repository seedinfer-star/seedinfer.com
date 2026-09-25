"use client"

import { useEffect, useState } from "react"

/**
 * Email address that is only assembled in the browser.
 *
 * Cloudflare's Email Address Obfuscation rewrites any address it finds in server-rendered HTML
 * (into `[email protected]` + a <a class="__cf_email__">), which makes React hydration fail for
 * client components. Rendering "user [at] domain" on the server (and on the first client render)
 * and swapping in the real mailto link after mount keeps SSR and hydration identical.
 */
export default function EmailLink({
  user,
  domain = "seedinfer.com",
  subject,
  className,
}: {
  user: string
  domain?: string
  subject?: string
  className?: string
}) {
  const [address, setAddress] = useState<string | null>(null)
  useEffect(() => setAddress(`${user}@${domain}`), [user, domain])

  if (!address) {
    return (
      <span className={className}>
        {user} [at] {domain}
      </span>
    )
  }
  const href = `mailto:${address}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`
  return (
    <a href={href} className={className}>
      {address}
    </a>
  )
}
