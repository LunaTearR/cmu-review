package aisummary

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"cmu-review-backend/internal/usecase/port"
)

const defaultBaseURL = "https://generativelanguage.googleapis.com/v1beta"

// GeminiClient implements port.SummaryGenerator using Google's Gemini REST API.
type GeminiClient struct {
	apiKey  string
	model   string
	baseURL string
	http    *http.Client
}

type GeminiConfig struct {
	APIKey  string
	Model   string        // e.g. "gemini-3-flash-lite"
	BaseURL string        // optional override
	Timeout time.Duration // request timeout
}

func NewGeminiClient(cfg GeminiConfig) *GeminiClient {
	base := cfg.BaseURL
	if base == "" {
		base = defaultBaseURL
	}
	timeout := cfg.Timeout
	if timeout <= 0 {
		timeout = 30 * time.Second
	}
	return &GeminiClient{
		apiKey:  cfg.APIKey,
		model:   cfg.Model,
		baseURL: strings.TrimRight(base, "/"),
		http:    &http.Client{Timeout: timeout},
	}
}

// Ensure interface satisfaction.
var _ port.SummaryGenerator = (*GeminiClient)(nil)

type geminiPart struct {
	Text string `json:"text"`
}

type geminiContent struct {
	Parts []geminiPart `json:"parts"`
	Role  string       `json:"role,omitempty"`
}

type geminiRequest struct {
	Contents         []geminiContent      `json:"contents"`
	GenerationConfig *geminiGenerationCfg `json:"generationConfig,omitempty"`
}

type geminiGenerationCfg struct {
	Temperature     float64 `json:"temperature,omitempty"`
	MaxOutputTokens int     `json:"maxOutputTokens,omitempty"`
}

type geminiResponse struct {
	Candidates []struct {
		Content struct {
			Parts []geminiPart `json:"parts"`
		} `json:"content"`
		FinishReason string `json:"finishReason"`
	} `json:"candidates"`
	Error *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Status  string `json:"status"`
	} `json:"error,omitempty"`
}

// maxRetries is how many times Generate retries on transient upstream errors
// (HTTP 429 / 5xx). Each retry waits an exponentially growing delay.
const maxRetries = 3

func (c *GeminiClient) Generate(ctx context.Context, prompt string) (string, error) {
	if c.apiKey == "" {
		return "", errors.New("gemini: missing API key")
	}
	if c.model == "" {
		return "", errors.New("gemini: missing model")
	}

	body := geminiRequest{
		Contents: []geminiContent{
			{Parts: []geminiPart{{Text: prompt}}, Role: "user"},
		},
		GenerationConfig: &geminiGenerationCfg{
			Temperature:     0.4,
			MaxOutputTokens: 512,
		},
	}
	buf, err := json.Marshal(body)
	if err != nil {
		return "", fmt.Errorf("gemini: marshal: %w", err)
	}

	url := fmt.Sprintf("%s/models/%s:generateContent?key=%s", c.baseURL, c.model, c.apiKey)

	var lastErr error
	for attempt := 0; attempt <= maxRetries; attempt++ {
		if attempt > 0 {
			// Exponential backoff: 1s, 2s, 4s ...
			delay := time.Duration(1<<(attempt-1)) * time.Second
			select {
			case <-ctx.Done():
				return "", ctx.Err()
			case <-time.After(delay):
			}
		}

		out, retryable, err := c.doOnce(ctx, url, buf)
		if err == nil {
			return out, nil
		}
		lastErr = err
		if !retryable {
			return "", err
		}
	}
	return "", fmt.Errorf("gemini: exhausted retries: %w", lastErr)
}

// doOnce performs a single Gemini call. Returns retryable=true for transient
// upstream errors (HTTP 429, 5xx, network failures) so the caller can back off.
func (c *GeminiClient) doOnce(ctx context.Context, url string, body []byte) (string, bool, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return "", false, fmt.Errorf("gemini: request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return "", true, fmt.Errorf("gemini: do: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", true, fmt.Errorf("gemini: read: %w", err)
	}

	var parsed geminiResponse
	if err := json.Unmarshal(respBytes, &parsed); err != nil {
		return "", false, fmt.Errorf("gemini: unmarshal: %w (body=%s)", err, truncate(string(respBytes), 300))
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		msg := "unknown"
		if parsed.Error != nil && parsed.Error.Message != "" {
			msg = parsed.Error.Message
		}
		retryable := resp.StatusCode == 429 || resp.StatusCode >= 500
		return "", retryable, fmt.Errorf("gemini: http %d: %s", resp.StatusCode, msg)
	}

	if len(parsed.Candidates) == 0 || len(parsed.Candidates[0].Content.Parts) == 0 {
		return "", false, errors.New("gemini: empty candidates")
	}

	var sb strings.Builder
	for _, p := range parsed.Candidates[0].Content.Parts {
		sb.WriteString(p.Text)
	}
	return strings.TrimSpace(sb.String()), false, nil
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}
