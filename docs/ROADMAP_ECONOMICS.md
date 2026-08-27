# Roadmap & Economics — SeedInfer

> **We optimize decentralized P2P AI inference to electricity cost for builders, sharing profits with engineers and edge enthusiasts monetizing idle GPUs.**

> Sectia gotowa do wklejenia na `/stats` jako `Roadmap & Economics`. Ostatnia aktualizacja: 2026-08-26. Wszystkie kwoty w USD, wypłaty w USDC (Base).

---

## TL;DR — 4 fazy w jednej tabeli

| Faza | Nazwa | Czas | Nody | Cel główny | KPI #1 | Koszt utrzymania sieci (retainer) | Wypłata providera |
|---|---|---|---|---|---|---|---|
| **0** | **Stealth / Winter Whitelist** | M0-M2 | 20 | Udowodnić: P2P nie gorsze niż Vast.ai, uptime >99% | 20/20 nodów online, p95 TTFT <250ms | **$240 / mies.** ($8/dzień) | **$0.40 / dzień gwarantowane + 99% rev share** |
| **1** | **100 Nodes - Liquidity** | M3-M5 | 100 | Pierwsze $1k MRR, 5-min onboarding Docker | 100 nodów, 30+ aktywnych builderów | ~$1,200 / mies. (100×$0.40×30, stopniowo wygaszany) | Retainer + 99% do $1/day, potem czysty 99% |
| **2** | **Marketplace Scale** | M6-M12 | 300-1000 | Samonapędzający się marketplace, 1% take rate wystarcza | $10k MRR, >50% ruchu z OpenRouter | $0 — retainer off, tylko rev share | 99% API revenue |
| **3** | **Electricity Parity** | M12+ | 1000+ | Tańsi niż hyperscalery o koszt prądu. `price = electricity + 10%` | Cena $0.08 / 1M vs $0.15 OpenAI-proxied, uptime SLA 99.9% | $0 — sieć zarabia 1% na wolumenie | 99% ale przy 10x wolumenie = $3-8 / dzień / GPU |

**Zasada zimnego startu:** dopóki ruch < breakeven, płacimy za gotowość. Gdy ruch > breakeven, płacisz tylko za zużycie. Nigdy nie prosimy o trzymanie prądożernej karty za darmo.

---

## Dlaczego klasyczne P2P umiera zimą (i jak to naprawiamy)

**Problem:** Brak ruchu → provider wyłącza GPU (500W * 24h * $0.25/kWh = $3/dzień straty) → brak nodów → brak builderów → śmierć.

**SeedInfer fix — 3 mechanizmy:**

1.  **Base Retainer (Zimowy Zasiłek):** $0.40 / dzień / nod w USDC za gotowość/standby ($0.01667/h naliczane po pełnej godzinie). Wypłacane **raz w miesiącu** (min. wypłata $1.00 USD). Warunek: nod musi być online przez **minimum 50% czasu** od momentu dołączenia do sieci w danym miesiącu (np. dołączenie 15 września = wymagane co najmniej 7.5 dnia online do 1 października).
2.  **Waterfall Profit Distribution (Rozliczenie Miesięczne Zysku):** Wszystkie przychody ze sprzedaży tokenów spływają do Globalnej Puli Przychodów. W pierwszej kolejności z puli pokrywane są należne stawki gwarantowane ($0.40/dzień) dla zakwalifikowanych nodów. Pozostały zysk (nadwyżka) jest dzielony proporcjonalnie między nody według wartości ruchu, który realnie obsłużyły (zgodnie ze stawką hostowanego modelu).
3.  **Compute Swapping 1:1.5:** Nie masz ruchu? Zamień swój wypracowany retainer/zarobek na kredyty do użycia sieci. Oddajesz $10 zarobku → dostajesz $15 kredytów na inference. Idealne dla Vast.ai hosterów którzy sami budują AI wrappery.
4.  **Bartery & Internal Traffic:** Przepinamy ruch z OpenRouter + naszych wewnętrznych jobów (eval, synthetic data) na Wasze nody, żeby kręcił się licznik nawet gdy zewnętrzni builderzy jeszcze testują.

```
Globalna Pula Przychodów (100%)
    │
    ├──> 1. Pokrycie stawek gwarantowanych ($0.40/d dla nodów z uptime >= 50% od dołączenia)
    │
    └──> 2. Pozostały ZYSK ──> Dystrybucja proporcjonalna do nodów wg obsłużonego ruchu i stawek modeli
```

---

## Faza 0: STEALTH / WHITELIST 20 — "Udowodnij że działa"

**Czas:** Miesiąc 0-2 (teraz) | **Nody:** 20 (zamknięta lista) | **Status:** 🔴 REKRUTACJA

### Co oferujemy

*   **$0.40 / dzień gwarantowane ($0.01667/h)** w USDC na Base za standby dla nodów z uptime ≥50% od momentu dołączenia.
*   **Miesięczne rozliczenie zysku (Waterfall):** Przychody spływają do Globalnej Puli — najpierw pokrywana jest stawka gwarantowana za prąd, a pozostały zysk jest dzielony proporcjonalnie wg obsłużonego ruchu i stawek modeli. Min. wypłata **$1.00 USD / miesiąc**.
*   **+5$ kredytów** na test sieci jako builder (zobacz jak działa od drugiej strony).
*   **White-glove concierge:** Ręczny setup przez Tailscale SSH. Audytujemy Twój stack: CUDA 13.3, driver 580+, vLLM/SGLang, VRAM, flashinfer/marlin/fp8. Ty dajesz `NODE_KEY`, my stawiamy.
*   **Docker dla leniwych (≥32GB VRAM):** `docker run --gpus all -e NODE_KEY=xyz ghcr.io/seedinfer/p2p-node:latest` — 1 komenda, 5 minut, działa.
*   **Udział w przyszłych zyskach platformy dla early 20** — retro-aidrop / fee share gdy wejdziemy w Fazę 2. Jesteś założycielem, nie dostawcą.

**Dla Buildera (Ty z appką):**
*   **5$ free credits** bez karty. OpenAI-compatible API: zmień `base_url` i działa.
*   Ceny **electricity-cost optimized**: NP. `Llama 4 Scout $0.02 / $0.05 per 1M` vs $0.15 na OpenRouter.
*   **Dostęp do 20 zweryfikowanych nodów** z NVFP4, 1M ctx, p95 <300ms. Nie loteria jak u konkurencji.
*   Discord #builders — bezpośredni kontakt do providerów, debug w 15 min.

### KPI / Metryki sukcesu
*   20/20 nodów onboarded + przeszło stress test (128 conc, 4096 ctx)
*   Uptime >99% (mierzone /api/stats co 15s)
*   TTFT p95 <300ms, TTFB p95 <250ms, Success rate >99.5%
*   10 builderów z >$1 zużycia, 2 powracających >7 dni
*   0 incydentów "ghost node" (nod online ale nie odpowiada)

### Akcje marketingowe — gdzie rekrutujemy 20

| Kanał | Taktyka | Cost | Cel |
|---|---|---|---|
| **Vast.ai / RunPod scraping** | Scrape ofert 5090/6000Ada/L40S → DM na Vast Discord + mail: "Zarób $12/mies gwarantowane + 99% vs $0 u nas na standby. 1 komenda Docker." | $0 (1 dzień skryptu) + $80 Tailscale | 8 nodów |
| **r/LocalLLaMA** | Posty "We pay $0.40/day to host 5090 for P2P inference — 99% rev share, USDC daily" + komentowanie wątków "how to monetize 5090" | $0 | 5 nodów |
| **Górnicy GPU / Mining Discords** | Mining po ETH jest martwy — pivot na inference. Target: discords `GPU Mining`, `Ethermine`, Telegram `Mining Club` | $0 | 4 nodów |
| **Discord / Twitter DM** | White-glove outreach: 50 ręcznych DM z audytem `nvidia-smi` gratis | $0 (czas) | 3 nodów |
| **Własna sieć** | 5$ kredyt = viral loop — każdy provider dostaje reflink | $100 (20×$5) | — |

**Budżet Fazy 0:** **$340 / mies.** ($240 retainer + $100 kredyty jednorazowo) + ~20h pracy foundera. To koszt walidacji produktu.

### Messaging Fazy 0
> **Persona: Vast.ai Hoster / Edge Enthusiast z 5090 w szafie**
> *Nagłówek:* **"Twój 5090 zarabia $0 na Vast.ai gdy nikt nie wynajmie. U nas zarabia $0.40 dziennie za samo bycie online — plus 99% gdy przyjdzie ruch."**
> *Pod-nagłówek:* White-list 20. Nie tokeny. USDC codziennie. Setup przez nas na Tailscale w 15 min.
> *CTA:* `Dołącz do whitelist → /provider` + `docker run --gpus all -e NODE_KEY=xyz ...`

---

## Faza 1: 100 NODES — "Liquidity"

**Czas:** M3-M5 | **Nody:** 100 | **Cel:** Przejść z 20 przyjaciół na 100 nieznajomych. Pierwsze $1k MRR.

### Co oferujemy

**Provider:**
*   Retainer $0.40/dzień do 30 dni od dołączenia, potem maleje do $0.20 i znika gdy Twój nod >$1/dzień z ruchu. Fair — nie dotujemy wiecznie, tylko rozruch.
*   Publiczny leaderboard `/providers` + `/leaderboard` — najlepsi dostają więcej ruchu (routing waży uptime + speed).
*   Auto-payout USDC co $5, swap 1:1.5 nadal aktywny.

**Builder:**
*   100 nodów = redundancy. SLA 99% (wcześniej best-effort).
*   Modele: Qwen, Llama, DeepSeek, NVFP4. 1M context.
*   Dashboard `/stats` live — widzisz każdy nod, ping, load.

### KPI
*   100 nodów onboarded, 70% z Docker (proof że onboarding działa bez concierge)
*   30 builderów z >$10 spend, 5 z >$100/mies
*   MRR $1,000 (czyli ~6.5B tokenów/mies przy $0.15/1M)
*   Blended TTFT p95 <280ms
*   Churn providerów <15% / mies.

### Akcje marketingowe

| Kanał | Taktyka | Budżet |
|---|---|---|
| **Vast.ai scraping v2** | Automat: bot scrapuje co 6h nowe oferty 32GB+, auto-DM + mail sequence 3 kroki | $50/mies proxy + $100 kredyty |
| **r/LocalLLaMA / r/MachineLearning** | Case study Fazy 0: "How we paid $240 to keep 20x 5090 online and served 2B tokens" — post techniczny, nie promo | $0 |
| **RunPod / Vast.ai ads** | Banner "Monetize idle 5090 — $0.40/day guaranteed" na forach | $300/mies |
| **Górnicy — pivot content** | YouTube/Twitter: "Mining is dead. Inference is the new mining. Kalkulator net-profit inside." | $200 video edit |
| **Discord growth** | Publiczny Discord, role `Early 20` (złota odznaka), referral $5 za noda | $200/mies kredyty referral |

**Budżet Fazy 1:** ~**$1,500/mies** (retainer $1,200 dla 100 nodów przez ~6 tyg, potem spada + $300 marketing).

### Messaging Fazy 1
> **Persona: Mały zespół AI / Indie hacker**
> *Nagłówek:* **"OpenRouter bierze 20%. My bierzemy 1%. Ta sama jakość, 99% trafia do GPU."**
> *Dowód:* Tabela cen live na /models + /stats uptime.
> *CTA:* "5$ free — przepnij base_url w 30s"

---

## Faza 2: MARKETPLACE SCALE — "Uruchom koło zamachowe"

**Czas:** M6-M12 | **Nody:** 300 → 1000 | **Cel:** Sieć sama się napędza. 1% wystarczy.

### Co oferujemy

**Provider:**
*   **Koniec retainera.** Teraz zarabiasz czysto z ruchu — ale ruchu jest 10x więcej.
*   **Smart routing:** Więcej zarabiasz gdy masz niższy ping, wyższy uptime, rzadszy model. Rynek nagradza jakość.
*   **Staking / reputation:** Early nodes mają boost w routingu + udział w zyskach (np. 10% z 1% fee wraca do Early 20).

**Builder:**
*   **Automatyczny marketplace:** Wybierasz model, nie noda. My routujemy do najtańszego/najszybszego spełniającego SLA.
*   **Ceny spadają** bo konkurencja między nodami zjeżdża do `electricity + margin`.
*   **OpenRouter integration:** 1-click proxy — Twój ruch z OpenRoutera przechodzi przez nas taniej.

### KPI
*   500+ nodów, 100+ builderów płacących
*   MRR $10k → $50k
*   Take rate 1% pokrywa infra (routery, discovery, billing)
*   <2% failed requests, auto-failover <2s

### Akcje marketingowe

| Kanał | Taktyka | Budżet |
|---|---|---|
| **OpenRouter** | Listing jako provider, docs "SeedInfer via OpenRouter — 30% cheaper" | $0 (rev share) |
| **LocalLLaMA + HN** | Launch post "We built a P2P inference network that pays 99% to GPU owners — $50k MRR, AMA" | $0 |
| **Vast.ai hosterzy — program migracji** | "Przenieś 10 GPU z Vast.ai — dostajesz 30 dni 0.40/day + 1:1.5 swap na każdy" | $2k jednorazowo |
| **Konferencje / hackathony** | Sponsor 1 hackathonu AI (np. local Warsaw AI) — kredyty dla uczestników | $1k |
| **SEO / Docs** | Poradniki "How to monetize RTX 5090 after mining", kalkulator net-profit jako lead magnet | $500 content |

**Budżet Fazy 2:** ~**$3-5k / mies** (głównie kredyty + event). Retainer $0.

### Messaging Fazy 2
> **Persona: CTO / Builder skalujący appkę LLM**
> *Nagłówek:* **"Inference at electricity cost. Not cloud cost."**
> *Dowód:* Live kalkulator na /stats: `Your tokens * our price = $X vs $Y on Together.ai`
> *CTA:* "Switch API URL — save 40% tomorrow"

---

## Faza 3: ELECTRICITY PARITY — "Koniec gry"

**Czas:** M12+ | **Nody:** 1000+ | **Cel:** Być najtańszym inference na świecie, bo nie mamy datacenter.

**Idea:** Hyperscaler: `cena = prąd + budynek + chłodzenie + marża 60%`. My: `cena = prąd + 10%`. Wygrywamy zawsze.

### Co oferujemy

**Provider:** $3-8 / dzień / GPU przy full load (99% z $3.5-8.5 revenue). To 2-3x więcej niż kopanie czy Vast.ai na niskim obłożeniu. + dywidenda z 1% fee dla Early nodes.

**Builder:** Cena = `kWh * PUE * (1 + 10%)` per 1M tokens. Na dziś ~$0.08 / 1M vs $0.15 rynkowo. SLA 99.9%, globalny anycast.

### KPI
*   1000+ nodów, 10k+ builderów
*   MRR >$100k, take 1% = $1k/mies na infra (reszta to zysk do podziału)
*   Cena / 1M o 40-60% niższa niż Together/Fireworks
*   Net-profit providera > prąd w 95% dni (dowód: kalkulator)

### Akcje marketingowe
*   **PR:** "Decentralized inference beats centralized on price — paper + benchmark"
*   **Enterprise:** Cold outreach do firm fine-tunujących — "Host your own model on our P2P, keep 99%"
*   **Edge OEM:** Partnerstwa z producentami mini-PC / Orange Pi / Jetson — preinstalled node

### Messaging Fazy 3
> **Persona: Każdy kto płaci za LLM**
> *Nagłówek:* **"We finally made AI inference cost as much as electricity. Nothing more."**
> *Pod-nagłówek:* 1000+ GPUs. 1% fee. Reszta wraca do ludzi którzy dali prąd.
> *CTA:* "See live electricity price → /stats"

---

## Algorytm Miesięcznego Rozliczenia (Monthly Waterfall Settlement)

Rozliczenie sieci odbywa się **raz w miesiącu**. Przychody ze sprzedaży tokenów nie są od razu rozbijane per transakcja, lecz trafiają do **Globalnej Puli Przychodów** (Global Revenue Pool), z której następuje wypłata w model kaskadowym (waterfall):

### Zasady i Warunki Kwalifikacji

1. **Naliczanie Stawek Gwarantowanych (Base Retainer):**
   * Stawka wynosi **$0.40 / dzień** (czyli **$0.01667 / pełna godzina** dostępności).
   * Czas naliczany jest w **pełnych godzinach** od momentu przyłączenia się węzła do sieci w danym miesiącu.
2. **Kryterium 50% Uptime od Dołączenia:**
   * Aby węzeł zakwalifikował się do stawki gwarantowanej w danym miesiącu, musi być aktywny (online) przez **co najmniej 50% czasu** od momentu swojego przyłączenia do sieci do końca miesiąca.
   * *Przykład:* Jeśli węzeł dołączył 15 września (15 dni do końca miesiąca = 360 godzin), musi być aktywny przez minimum 180h (7.5 dnia). Jeśli ma <180h uptime, **nie kwalifikuje się do stawki gwarantowanej** i otrzymuje wyłącznie udział w zysku z realnie obsłużonego ruchu.
3. **Krok 1 Waterfall — Rezerwacja Stawek Gwarantowanych:**
   * Z Globalnej Puli Przychodów ($P_{total}$) w pierwszej kolejności wypłacane są stawki gwarantowane dla zakwalifikowanych węzłów ($R_{total} = \sum R_i$).
4. **Krok 2 Waterfall — Dystrybucja Zysku za Ruch:**
   * Pozostała po wypłacie stawek gwarantowanych kwota stanowi **Zysk do Podziału** ($P_{surplus} = \max(0, P_{total} - R_{total})$).
   * Zysk ten dzielony jest proporcjonalnie między wszystkie węzły na podstawie wartości surowego ruchu, który obsłużyły w danym miesiącu (zgodnie ze stawką modelu hostowanego przez dany węzeł).
5. **Plany Subskrypcyjne dla Użytkowników (Builder Subscription Tiers):**
   * **GO ($1 / mies.):** Przyznaje **3x** wartość API usage (**$3.00 USD** w tokenach). Limity czasowe: max **40%** puli ($1.20) w okienku 5h, max **70%** puli ($2.10) w 1 tydzień. Pozostałe 30% do wykorzystania w kolejnych tygodniach.
   * **GOAT ($5 / mies.):** Przyznaje **4x** wartość API usage (**$20.00 USD** w tokenach). Limity czasowe: max **15%** puli ($3.00) w okienku 5h, max **50%** puli ($10.00) w 1 tydzień.
   * **PRO ($10 / mies.):** Przyznaje **5x** wartość API usage (**$50.00 USD** w tokenach). Limity czasowe: max **10%** puli ($5.00) w okienku 5h, max **40%** puli ($20.00) w 1 tydzień.
6. **Rozliczenie Ruchu z Subskrypcji dla Dostawców (Subscription Settlement):**
   * Wpłaty gotówkowe ze sprzedaży subskrypcji ($1, $5, $10) zasilają bezpośrednio **Globalną Pulę Przychodów ($P_{total}$)**.
   * Każde zapytanie wygenerowane przez subskrybenta jest rejestrowane według surowej wartości rynkowej wygenerowanych tokenów ($V_{req}$) i przypisywane do węzła, który je obsłużył.
   * Zyski z niezrealizowanych w pełni limitów subskrypcyjnych (tzw. breakage) pozostają w Globalnej Puli Przychodów, powiększając pulę zysku ($P_{surplus}$) dla aktywnych dostawców GPU.
7. **Wypłaty:**
   * Łączna należność węzła = `Stawka Gwarantowana (jeśli qualified) + Udział w Zysku z Ruchu (PAYG + Subskrypcje)`.
   * Minimalny próg wypłaty: **$1.00 USD** (wypłacane miesięcznie w USDC na sieci Base). Kwoty poniżej $1.00 przechodzą na kolejny miesiąc.

---

## Model finansowy Early Node — ile kosztuje 20 nodów?

### Założenia (konserwatywne)

*   Retainer: **$0.40 / dzień / nod** ($0.01667/h dla qualified nodów)
*   Min wypłata: $1.00 (wypłacana raz w miesiącu)
*   Kredyty powitalne: $5 / nod (jednorazowo, nie wypłacalne — tylko do użycia)
*   Struktura: Waterfall Profit Distribution (Retainer first -> Profit share second)
*   Cena rynkowa: $0.15 / 1M input, $0.60 / 1M output (średnia ważona ~$0.25 / 1M blended)

### Koszt utrzymania 20 nodów (tylko retainer, bez ruchu)

| Okres | Dni | Koszt retainer (20 × $0.40 × dni) | + Kredyty $5×20 (raz) | **Suma cash out** | **Koszt / nod / mies.** |
|---|---|---|---|---|---|
| **30 dni** | 30 | $240.00 | $100.00 | **$340.00** | $12.00 |
| **60 dni** | 60 | $480.00 | $100.00 | **$580.00** | $12.00 |
| **90 dni** | 90 | $720.00 | $100.00 | **$820.00** | $12.00 |

> **Wniosek:** Utrzymanie 20 nodów przez kwartał to **$820**. Mniej niż 1× H100 na miesiąc w chmurze. To koszt walidacji — nie skaluje się liniowo, bo retainer znika gdy pojawia się ruch.

### Kiedy break-even? (kiedy ruch pokrywa retainer)

Ile tokenów musi przerobić jeden nod dziennie, by 99% rev share > $0.40?

| Cena blended / 1M | Tokenów / dzień by pokryć $0.40 | Requestów / dzień* | Co to znaczy? |
|---|---|---|---|
| $0.15 (tanio) | **2,667,000** | ~1,333 (2k tok/req) | ~55 req/h — 1 req/min |
| $0.25 (średnio) | **1,600,000** | ~800 | ~33 req/h |
| $0.60 (drogo, output) | **667,000** | ~333 | ~13 req/h |

_* 2k tokens per request (1k in + 1k out) — konserwatywnie_

> **Break-even to ~1-2M tokenów dziennie na noda.** To jest **dosłownie 1 zapytanie na minutę**. Każdy nod który dostanie 1 req/min przestaje kosztować retainer i zarabia.

### Scenariusze MRR (20 nodów)

| Ruch / nod / dzień | Revenue / nod / dzień (99%) | Revenue 20 nodów / mies. | Koszt retainer / mies. | **Net sieci (1% fee)** | **Net provider (średnio)** |
|---|---|---|---|---|---|
| 0 (martwy start) | $0.00 | $0 | $240 | **-$240** | $12.00 (retainer) |
| 1M tok ($0.25) | $0.25 | $150 | $240 | -$235 (dopłacamy) | $19.50 |
| 5M tok ($0.25) | $1.25 | $750 | $0 (bo >$0.40) | **+$7.50** (1%) | **$37.50/mies** |
| 20M tok ($0.25) | $5.00 | $3,000 | $0 | **+$30** | **$150/mies** |
| 50M tok ($0.25) | $12.50 | $7,500 | $0 | **+$75** | **$375/mies** |

> **Takeaway dla inwestora:** Dopłacamy tylko w zimie. Przy 5M tok/dzień/nod (wciąż <5% obłożenia 5090) sieć już nie dopłaca. Przy 20M tok/dzień — każdy provider zarabia $150/mies czysto, a sieć zaczyna zarabiać na 1%.

### Compute Swapping 1:1.5 — matematyka

Provider ma $12 retainer do wypłaty. Zamiast wypłacać, klika "Swap to credits":
*   Oddaje **$10.00** USDC → dostaje **$15.00** kredytów na API.
*   My nie wypłacamy cash, a provider dostaje 50% bonusu na własne użycie.
*   Dla nas: koszt $0 (kredyt to przyszły koszt GPU, który i tak mamy). Dla providera: 50% taniej niż płacenie kartą.
*   **Efekt:** Zmniejsza cash burn o ~30-40% bo część hosterów to też builderzy.

---

## Kalkulator Net-Profit — czy zarobisz więcej niż prąd?

> **Założenia:** Prąd liczony jako `W * 24h / 1000 * $/kWh`. Idle ~60% load (karta czeka ale grzeje). Loaded ~95% TDP. Prowizja 1% już odjęta (99% dla Ciebie). Retainer $0.40 dodany do przychodu gdy ruch < break-even.

### Koszt prądu dziennie

| Cena prądu | 0.12 $/kWh (US tanio) | 0.18 $/kWh (US średnio) | 0.30 $/kWh (PL/EU drogo) |
|---|---|---|---|
| **RTX 5090 32GB — 550W** | $1.58 | $2.38 | $3.96 |
| **RTX 6000 Ada 48GB — 300W** | $0.86 | $1.30 | $2.16 |
| **2× L40S 96GB — 700W** | $2.02 | $3.02 | $5.04 |

### Net-profit dziennie (przychód 99% + retainer $0.40 − prąd)

**Przykład: 0.18 $/kWh (typowy US/EU), 5M tokenów/dzień @ $0.25/1M = $1.25 revenue**

| GPU | Przychód | Prąd (loaded 95%) | **Net / dzień** | **Net / mies.** | Werdykt |
|---|---|---|---|---|---|
| **5090 32GB 550W** | $1.25 + $0.40 = $1.65 | $2.38 | **-$0.73** | -$21.90 | 🔴 Musi mieć >12M tok/dzień by być na + |
| **6000 Ada 48GB 300W** | $1.65 | $1.30 | **+$0.35** | **+$10.50** | 🟢 Na + już przy 5M tok |
| **2× L40S 96GB 700W** | $1.25×2 + $0.40* = $2.90 | $3.02 | **-$0.12** | -$3.60 | 🟡 Blisko 0, przy 8M tok na + |

_* 2× GPU = 2× revenue, 1× retainer per node (case 2× L40S jako 1 nod)_

**Przy 20M tokenów/dzień @ $0.25/1M = $5.00 revenue (realny load ~30%):**

| GPU | Przychód | Prąd | **Net / dzień** | **Net / mies.** | vs Vast.ai** |
|---|---|---|---|---|---|
| **5090 32GB** | $5.00 | $2.38 | **+$2.62** | **+$78.60** | Vast: ~$45-70 (po fee 20%) |
| **6000 Ada 48GB** | $5.00 | $1.30 | **+$3.70** | **+$111.00** | Vast: ~$55-80 |
| **2× L40S 96GB** | $10.00 | $3.02 | **+$6.98** | **+$209.40** | Vast: ~$120-160 |

_** Vast.ai netto po 20% fee i 60% obłożeniu — u nas obłożenie rośnie z czasem, fee 1%._

> **Wniosek net-profit:** Przy niskim ruchu (5M tok/dzień) **6000 Ada i L40S już na plusie**, 5090 potrzebuje ~12M tok. Przy średnim ruchu (20M tok) **wszystkie karty 2-3× lepiej niż prąd**, a przy PL prądzie 0.30/kWh wciąż na plusie od 25M tok. Dlatego startujemy z whitelist — gwarantujemy $0.40 by pokryć standby, a routing faworyzuje efektywne karty (Ada/L40S) w zimie.

### Wzór do wklejenia (dla kalkulatora na stronie)

```js
// kalkulator net-profit — wklej na /stats
function netProfitPerDay({ watts, tokensPerDay, pricePer1M = 0.25, elecPerKwh = 0.18, retainer = 0.40 }) {
  const revenue = (tokensPerDay / 1_000_000) * pricePer1M * 0.99;
  const effectiveRevenue = Math.max(revenue, retainer) + (revenue > retainer ? 0 : 0); 
  // retainer + revenue (gdy revenue > retainer, retainer znika — tu uproszczenie: bierz max)
  const totalRevenue = revenue + (revenue < retainer ? retainer : 0);
  const elecCost = (watts / 1000) * 24 * elecPerKwh;
  return { revenue: totalRevenue, elecCost, net: totalRevenue - elecCost };
}
// Przykład: netProfitPerDay({ watts: 550, tokensPerDay: 20_000_000 }) // 5090 przy 20M tok
```

---

## Messaging — co mówimy, do kogo, kiedy

### Matryca persona × faza

| Persona | Ból | Hasło F0 (whitelist) | Hasło F1 (100) | Hasło F2/F3 (scale) | Kanał | CTA |
|---|---|---|---|---|---|---|
| **Vast.ai Hoster** | Karta stoi pusta 40% czasu, Vast bierze 20% | "Dostajesz $0.40/dzień za samo trzymanie karty online. 99% gdy przyjdzie ruch. 1 komenda Docker." | "70% nodów to ex-Vast — zarabiają więcej bo fee 1% nie 20%" | "Vast 20% vs my 1%. Przelicz sobie." | DM na Vast Discord, scraping mail | `/provider` + Docker |
| **r/LocalLLaMA power user** | Chce monetizować 5090 ale nie ufa tokenom | "Nie tokeny. USDC codziennie na Base. Min $1. Audyt CUDA gratis." | "20 nodów ma 99.2% uptime — zobacz /stats live" | "Hostujesz model 1M ctx? My płacimy za prąd + 10%" | Post techniczny + komentarze | `Tailscale + NODE_KEY` |
| **Górnik GPU (ex-miner)** | Po ETH nie ma co kopać, karty się kurzą | "Mining is dead. Inference is the new mining. Kalkulator net-profit: 6000 Ada na + już przy 5M tok/dzień" | "Pierwsi górnicy już na +$80/mies na 5090 przy 20M tok" | "Twój rig kopał ETH za $2/dzień. Teraz robi inference za $5/dzień." | YouTube, Telegram Mining Club | Kalkulator → /provider |
| **Indie Builder / Hacker** | OpenRouter drogo, Together.ai drogo | "5$ free credits. Zmień base_url, płać o 40% mniej. 1M ctx." | "30 builderów już przepięło — zobacz porównanie cen na /models" | "Inference at electricity cost. $0.08/1M vs $0.15 u nich." | Twitter, HN, Discord #builders | `/api-console` |
| **CTO / Scale-up** | Potrzebuje SLA i ceny na wolumen | — (nie target w F0) | "100 nodów, SLA 99%, failover <2s. 1% fee — reszta do GPU." | "Najtańszy inference na rynku bo nie mamy datacenter. Umowa + SLA." | Cold mail + OpenRouter listing | Kontakt / enterprise |

### Ton głosu (wszystkie fazy)

*   **Bez bullshitu.** Nie "revolutionary DePIN". Tylko: "Płacimy za prąd. Bierzemy 1%. Reszta Twoja. Tu są liczby."
*   **Engineering-first:** Pokazuj `nvidia-smi`, `vLLM logs`, `p95 TTFT`, nie "community vibes".
*   **Transparentnie:** Cały `/stats` live, każdy nod publiczny, każda wypłata na BaseScan.
*   **Po polsku dla PL, po angielsku dla świata:** Strona EN, Discord PL+EN, posty LocalLLaMA EN.

### One-linery gotowe do kopiowania

*   **Twitter bio:** "We optimize P2P AI inference to electricity cost. 99% to GPU owners. 1% to us. USDC daily."
*   **r/LocalLLaMA tytuł:** "[P] We pay $0.40/day (USDC) to host your 5090 for P2P inference — 99% rev share, white-glove setup, 20 whitelist spots"
*   **Vast.ai DM:** "Hej, widzę masz 5090 32GB za $0.45/h na Vast. U nas dostajesz $0.40/d za standby + 99% gdy leci ruch (fee 1% vs 20% u Vast). Setup 5 min: docker run --gpus all -e NODE_KEY=... Chcesz audyt CUDA gratis?"
*   **Górnik TG:** "Kopanie ETH = $1.5/dzień na 5090 po prądzie. Inference u nas = $2.6/dzień net przy 20M tok (30% load). Kalkulator: seedinfer.com/stats#calculator"
*   **Builder HN:** "We built a P2P inference network that charges electricity cost +10%. Show HN: live stats, 1% take rate, OpenAI-compatible"

---

## Checklist wdrożenia — co wkleić na /stats

- [ ] Sekcja `Roadmap & Economics` jako anchor `#roadmap` na `/stats` (ten markdown)
- [ ] Kalkulator net-profit (JS wyżej) — 3 suwaki: GPU (W), tok/dzień, $/kWh → net/mies
- [ ] Tabela cen live `/models` + link do `/api-console` z $5 free
- [ ] Licznik `Whitelist: 12/20` (dynamiczny z API)
- [ ] Przycisk `Become a Provider → /provider` + `docker run` copy button
- [ ] Footer: "Payouts in USDC on Base. Min $1.00. Daily. Verifiable on BaseScan."

---

## FAQ — zimny start (dla sceptyków)

**"Co jeśli nikt nie wyśle ruchu przez miesiąc?"**
Płacimy $240/mies retainer za 20 nodów. To mniej niż Twój miesięczny rachunek za serwer. Nody zostają, bo dostają cash, nie obietnice. W tym czasie przepinamy własny ruch (eval + OpenRouter).

**"Dlaczego $0.40 a nie $2?"**
$0.40 to nie pokrycie całego prądu — to sygnał "jesteś potrzebny". Pełny prąd pokrywa się dopiero przy ~12M tok/dzień (1 req/5s). Do tego dopłacamy tylko w zimie. Gdy ruch rośnie, retainer znika.

**"Czemu 99% a nie 80% jak inni?"**
Bo nie budujemy datacenter. Naszym kosztem jest router + discovery (~$200/mies). Przy $10k MRR, 1% = $100 — starcza. Reszta należy się temu kto płaci za prąd.

**"Co z oszustami? Nod online ale nie liczy?"**
Challenge jobs: co 5 min wysyłamy syntetyczny request z znanym outputem. Brak odpowiedzi <2s = -reputacja, 3× fail = kick + brak retainera.

**"Mam 2× 3090 24GB — mogę?"**
Na start wymagamy ≥32GB VRAM (5090/L40S/6000 Ada) bo hostujemy 1M ctx NVFP4. 24GB wróci w Fazie 1 gdy dodamy mniejsze modele (8B).

---

*SeedInfer — electricity-cost inference. 99% to you. 1% to keep the lights on.*

*Kontakt whitelist: [Discord] · [Twitter] · founders@seedinfer.com — odpisujemy w 2h, setup w 24h.*

