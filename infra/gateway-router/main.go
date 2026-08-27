package main

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"math/big"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/signal"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
)

// ProviderNode represents a registered SeedInfer provider node
type ProviderNode struct {
	ID                 string    `json:"id"`
	TailscaleIP        string    `json:"tailscale_ip"`
	AgentURL           string    `json:"agent_url"`
	Status             string    `json:"status"`
	EWMATTFTMs         int64     `json:"ewma_ttft_ms"`
	ConcurrentRequests int64     `json:"-"`
	LastHeartbeat      time.Time `json:"last_heartbeat"`
}

// RouterRegistry holds in-memory state of active providers
type RouterRegistry struct {
	mu        sync.RWMutex
	providers map[string]*ProviderNode
}

func NewRouterRegistry() *RouterRegistry {
	return &RouterRegistry{
		providers: make(map[string]*ProviderNode),
	}
}

func (r *RouterRegistry) Upsert(node *ProviderNode) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if existing, ok := r.providers[node.ID]; ok {
		existing.TailscaleIP = node.TailscaleIP
		existing.AgentURL = node.AgentURL
		existing.Status = node.Status
		existing.LastHeartbeat = time.Now()
	} else {
		node.LastHeartbeat = time.Now()
		r.providers[node.ID] = node
	}
}

// SelectP2C selects a provider using Power of Two Random Choices (P2C) + Least Outstanding Requests (LOR)
func (r *RouterRegistry) SelectP2C() *ProviderNode {
	r.mu.RLock()
	var eligible []*ProviderNode
	for _, p := range r.providers {
		if p.Status == "serving" || p.Status == "verified" {
			eligible = append(eligible, p)
		}
	}
	r.mu.RUnlock()

	if len(eligible) == 0 {
		return nil
	}
	if len(eligible) == 1 {
		return eligible[0]
	}

	// Pick 2 random distinct indices
	n1, _ := rand.Int(rand.Reader, big.NewInt(int64(len(eligible))))
	n2, _ := rand.Int(rand.Reader, big.NewInt(int64(len(eligible))))
	idx1 := n1.Int64()
	idx2 := n2.Int64()
	if idx1 == idx2 {
		idx2 = (idx1 + 1) % int64(len(eligible))
	}

	candA := eligible[idx1]
	candB := eligible[idx2]

	concA := atomic.LoadInt64(&candA.ConcurrentRequests)
	concB := atomic.LoadInt64(&candB.ConcurrentRequests)

	if concA < concB {
		return candA
	}
	if concB < concA {
		return candB
	}

	// Tie-breaker: lowest EWMA TTFT
	if candA.EWMATTFTMs < candB.EWMATTFTMs {
		return candA
	}
	return candB
}

func main() {
	port := flag.Int("port", 8080, "Gateway proxy port")
	flag.Parse()

	registry := NewRouterRegistry()

	// Default local fallback node if empty
	registry.Upsert(&ProviderNode{
		ID:          "provider-local",
		TailscaleIP: "100.64.0.3",
		AgentURL:    "http://100.64.0.3:47901",
		Status:      "serving",
		EWMATTFTMs:  120,
	})

	http.HandleFunc("/v1/chat/completions", func(w http.ResponseWriter, r *http.Request) {
		node := registry.SelectP2C()
		if node == nil {
			http.Error(w, `{"error":{"message":"No verified providers available","type":"service_unavailable"}}`, http.StatusServiceUnavailable)
			return
		}

		targetURL, err := url.Parse(node.AgentURL)
		if err != nil {
			targetURL, _ = url.Parse(fmt.Sprintf("http://%s:47901", node.TailscaleIP))
		}

		// In-Memory LOR Tracking: Increment on start, Decrement on finish
		atomic.AddInt64(&node.ConcurrentRequests, 1)
		defer atomic.AddInt64(&node.ConcurrentRequests, -1)

		// Zero-Buffering SSE Direct Passthrough Proxy
		proxy := httputil.NewSingleHostTargetManager(targetURL)
		w.Header().Set("X-Accel-Buffering", "no")
		w.Header().Set("X-SeedInfer-Provider", node.ID)
		w.Header().Set("X-SeedInfer-Algorithm", "P2C-LOR")

		proxy.ServeHTTP(w, r)
	})

	server := &http.Server{
		Addr:         fmt.Sprintf(":%d", *port),
		ReadTimeout:  120 * time.Second,
		WriteTimeout: 0, // Disable write timeout for SSE streams
	}

	log.Printf("[SeedInfer Gateway Router] Running on :%d (P2C+LOR Zero-Buffer Mode)", *port)

	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	server.Shutdown(ctx)
}

// Helper struct for SingleHostTargetManager
type SingleHostTargetManager struct {
	target *url.URL
}

func (s *SingleHostTargetManager) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	proxy := httputil.NewSingleHostReverseProxy(s.target)
	proxy.FlushInterval = -1 // Flush SSE chunks instantly without buffering
	proxy.ServeHTTP(w, r)
}

func (s *SingleHostTargetManager) ModifyResponse(res *http.Response) error {
	return nil
}
