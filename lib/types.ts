export type TimePoint = {
  timestamp: string
  requests: number
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

export type ModelStat = {
  id: string
  providers: number
}

export type ProviderLocation = {
  key: string
  scope: "city" | "region" | "country"
  city?: string
  region?: string
  region_code?: string
  country: string
  country_code: string
  latitude: number
  longitude: number
  providers: number
  hardware_attested: number
  gpu_cores: number
  memory_gb: number
}

export type NetworkUtilization = {
  utilization: number
  warm_utilization: number
  token_budget_utilization: number
  bottleneck_utilization: number
  bottleneck_model: string
  capacity_tps: number
  active_requests: number
  queued_requests: number
}

export type Provider = {
  id: string
  chip: string
  chip_family: string
  chip_tier: string
  cpu_cores: { total: number; performance: number; efficiency: number }
  gpu_cores: number
  memory_gb: number
  memory_bandwidth_gbs: number
  current_model: string
  models: string[]
  status: "online" | "offline" | "draining" | "serving" | "untrusted"
  trust_level: "hardware" | "software" | "unverified" | "none" | "self_signed" | string
  attested: boolean
  requests_served: number
  tokens_generated: number
  machine_model: string
  mda_verified?: boolean
  runtime_verified?: boolean
  // parity fields from SeedInfer Network Stats
  decode_tps?: number
  // SeedInfer gateway verification (local fleet)
  verification?: {
    status: "pending" | "verifying" | "verified" | "failed"
    checks?: Array<{ name: string; passed: boolean; latencyMs?: number; error?: string; detail?: string }>
    last_check?: string | null
    failure_reason?: string
    heartbeat_count?: number
  }
  tailscale_ip?: string | null
  agent_url?: string | null
  last_heartbeat?: string
  // additional optional live fields (never required for rendering but kept for parity)
  acme_verified?: boolean
  certificate_available?: boolean
  cancellations_received?: number
  cancellations_before_output?: number
  cancellations_partial_complete?: number
  cancel_during_model_load?: number
  chunk_encryption_errors?: number
  generation_errors_after_output?: number
  failed_challenges?: number
  last_challenge_verified?: string
  stream_closed_without_terminal?: number
  usage_gaps?: number
}

export type RequestFlowLocation = {
  key: string
  kind: string
  city?: string
  region?: string
  region_code?: string
  country: string
  country_code: string
  latitude: number
  longitude: number
}

export type RequestFlow = {
  key: string
  from: RequestFlowLocation
  to: RequestFlowLocation
  requests: number
  prompt_tokens: number
  completion_tokens: number
}

export type StatsResponse = {
  active_power_watts: number
  active_providers: number
  avg_tokens_per_request: number
  code_attestation_enforced: boolean
  code_attested_providers: number
  last_24h_completion_tokens: number
  last_24h_prompt_tokens: number
  last_24h_requests: number
  last_24h_total_tokens: number
  models: ModelStat[]
  network_capacity_tps: number
  network_utilization: NetworkUtilization
  provider_locations: ProviderLocation[]
  provider_regions: ProviderLocation[]
  providers: Provider[]
  time_series: TimePoint[]
  total_bandwidth_gbs: number
  total_completion_tokens: number
  total_cpu_cores: number
  total_gpu_cores: number
  total_memory_gb: number
  total_prompt_tokens: number
  total_requests: number
  total_tokens: number
  unknown_location_providers: number
  // parity optional fields from SeedInfer Network Stats (/api/stats)
  location_privacy_min_providers?: number
  location_window_hours?: number
  request_flows?: RequestFlow[]
  request_locations?: ProviderLocation[]
  request_regions?: ProviderLocation[]
  request_location_privacy_min_requests?: number
  suppressed_city_location_providers?: number
  suppressed_request_city_requests?: number
  unknown_request_location_requests?: number
  unknown_location_providers_details?: number // alias safety
  // also keep explicit unknown fields optional in case mock misses
  unknown_request_location_providers?: number
}
