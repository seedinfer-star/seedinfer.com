# Architecture Blueprint: High-Performance Network & Dynamic Dispatcher for SeedInfer

> [!IMPORTANT]
> Niniejszy dokument stanowi wiążącą specyfikację techniczną i architektoniczną dla silnika routingu, bezpiecznego wpinania węzłów GPU (Provider Nodes) oraz wydajnego przesyłania strumieniowego zapytań LLM w sieci **SeedInfer**.

---

## 1. Zasada Zero-Buffering Direct Pass-Through Streaming (Minimizing TTFT)

Aby zagwarantować minimalne opóźnienie **TTFT (Time To First Token)** na procesorach ARM (Orange Pi 4 Pro) oraz docelowych klastrach chmurowych, zabrania się pełnego buforowania odpowiedzi z węzłów LLM w pamięci Gatewaya.

### Przepływ Strumienia:
1. **Direct Chunk Passthrough**: Chunks zwracane przez silnik vLLM (`text/event-stream`) są natychmiast przekazywane do klienta końcowego.
2. **Nagłówki sterujące proxy**:
   - `X-Accel-Buffering: no`
   - `Cache-Control: no-cache`
   - `Connection: keep-alive`
3. **Flushing w czasie rzeczywistym**: W natywnym proxy (Go/Rust) parametr `FlushInterval` jest ustawiony na `-1` (natychmiastowy flush po odebraniu każdego pakietu SSE).

---

## 2. In-Memory Tracking & Algorytm P2C (Power of Two Random Choices)

### Eliminacja Pollingu (No Active Polling)
- **Zabronione**: Polling tysięcy węzłów co 500ms w celu odpytania o stan VRAM, kolejki i KV Cache. Przy 1000 węzłach generuje to ponad **2000 RPS** zbędnego ruchu wewnętrznego i drastycznie obciąża procesor routera.
- **Rozwiązanie**: **In-Memory Tracking**. Gateway utrzymuje stan obciążenia wyłącznie w pamięci RAM procesa.

### Zasada działania In-Memory Tracking:
1. Podczas przybycia żądania HTTP, router wyznacza docelowy węzeł i **inkrementuje** w pamięci RAM licznik `concurrentRequests` (atomowo / bez blokad locks).
2. Odpowiedź przesyłana jest strumieniowo (SSE).
3. Po rozłączeniu klienta lub zakończeniu strumienia, router **dekrementuje** licznik `concurrentRequests`.

### Algorytm P2C + Least Outstanding Requests (LOR) + Ping Penalty:
```
Pula Zweryfikowanych Węzłów (Status: serving)
                │
                ├─► Losowy Wybór Węzła A (Candidate 1)
                ├─► Losowy Wybór Węzła B (Candidate 2)
                │
                ▼
        Porównanie concurrentRequests (RAM)
                │
                ├─► (concA < concB) ──► Wybierz Węzeł A
                ├─► (concB < concA) ──► Wybierz Węzeł B
                │
                └─► (Remis concA == concB)
                        │
                        ▼
                Porównanie EWMA TTFT / Ping (ms)
                        │
                        └─► Wybierz węzeł o niższym opóźnieniu
```

---

## 3. Dedykowany Lekki Balancer w Go / Rust (Zero Python GIL Overhead)

Aby wyeliminować wąskie gardło pętli zdarzeń (Event Loop) i narzut GIL w Pythonie (FastAPI) na procesorach ARM (Orange Pi 4 Pro), warstwa proxy zostaje wydzielona do lekkiego kompilowanego proxy:

- **Lokalizacja**: `infra/gateway-router/main.go`
- **Język**: Go (z opcją przejścia na Rust Tokio/Hyper)
- **Zużycie zasobów**: < 30 MB RAM, < 5% CPU przy 50 000 RPS.
- **Rola**: Wyłącznie terminacja TLS, dynamiczny dispatching P2C/LOR oraz direct SSE chunk streaming.

---

## 4. Optymalizacja Tunelu & Jądra Linux (`wireguard-dkms`)

Dla zapewnienia stabilnego routingu przy tysiącach jednoczesnych pakietów IP:

1. **Kernel-Space WireGuard (`wireguard-dkms`)**:
   - Użycie modułu jądra Linux zamiast `wireguard-go` w przestrzeni użytkownika eliminuje narzut przełączania kontekstu CPU (context switching).
2. **Limit Deskryptorów Plików**:
   - Konfiguracja systemu ulimit: `ulimit -n 65535`.
   - Parametry sysctl w `/etc/sysctl.d/99-seedinfer.conf`:
     ```ini
     net.core.somaxconn = 65535
     net.ipv4.ip_local_port_range = 1024 65535
     fs.file-max = 2097152
     ```

---

## 5. NAT Traversal (Double-NAT / CGNAT) & Migracja do AWS

1. **Model Reverse Tunneling (Model Pull)**:
   - Maszyny konsumenckie (GPU) znajdujące się za podwójnym NAT-em lub u operatorów mobilnych nie wymagają publicznego IP ani przekierowywania portów.
   - Węzeł utrzymuje wyjściowy bezpieczny tunel WireGuard / Headscale do serwera kontrolnego (`tailnet.seedinfer.com`).

2. **Bezproblemowa Migracja do AWS / Cloud**:
   - Adresacja węzłów w sieci overlay korzysta z przydziałów podsieci CGNAT (`100.64.0.0/10`).
   - W przypadku przenieśienia Gatewaya na klaster AWS/Hetzner, węzły automatycznie reconnectują się do nowej instancji bez konieczności re-konfiguracji po stronie dostawców GPU.

---

## 6. Status Realizacji i Krok Po Kroku

- [x] **Zapisanie planu architektonicznego** w bazie pamięci projektu (`mcp_memory_memory_save`).
- [x] **Implementacja algorytmu P2C + Least Outstanding Requests** w `lib/routing/selector.ts` (`selectProviderP2C`).
- [x] **Utworzenie natywnego silnika Go Gateway Balancer** w `infra/gateway-router/main.go`.
- [x] **Weryfikacja braku buforowania SSE** w `app/api/v1/chat/completions/route.ts` (`X-Accel-Buffering: no`).
