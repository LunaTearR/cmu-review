package aiembed

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

// GeminiEmbedClient implements port.EmbeddingGenerator using Google's
// Generative Language `embedContent` REST endpoint.
type GeminiEmbedClient struct {
	apiKey     string
	model      string
	dimensions int
	baseURL    string
	http       *http.Client
}

type GeminiEmbedConfig struct {
	APIKey     string
	Model      string // e.g. "gemini-embedding-001"
	Dimensions int    // optional MRL truncation (768, 1536, 3072 for gemini-embedding-001)
	BaseURL    string
	Timeout    time.Duration
}

func NewGeminiEmbedClient(cfg GeminiEmbedConfig) *GeminiEmbedClient {
	base := cfg.BaseURL
	if base == "" {
		base = defaultBaseURL
	}
	timeout := cfg.Timeout
	if timeout <= 0 {
		timeout = 20 * time.Second
	}
	model := cfg.Model
	if model == "" {
		model = "gemini-embedding-001"
	}
	return &GeminiEmbedClient{
		apiKey:     cfg.APIKey,
		model:      model,
		dimensions: cfg.Dimensions,
		baseURL:    strings.TrimRight(base, "/"),
		http:       &http.Client{Timeout: timeout},
	}
}

var _ port.EmbeddingGenerator = (*GeminiEmbedClient)(nil)

type embedRequest struct {
	Model                string       `json:"model"`
	Content              embedContent `json:"content"`
	OutputDimensionality int          `json:"outputDimensionality,omitempty"`
}

type embedContent struct {
	Parts []embedPart `json:"parts"`
}

type embedPart struct {
	Text string `json:"text"`
}

type embedResponse struct {
	Embedding struct {
		Values []float32 `json:"values"`
	} `json:"embedding"`
	Error *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Status  string `json:"status"`
	} `json:"error,omitempty"`
}

const maxRetries = 3

func (c *GeminiEmbedClient) Generate(ctx context.Context, text string) ([]float32, error) {
	if c.apiKey == "" {
		return nil, errors.New("gemini-embed: missing API key")
	}
	text = strings.TrimSpace(text)
	if text == "" {
		return nil, errors.New("gemini-embed: empty text")
	}

	body := embedRequest{
		Model:                "models/" + c.model,
		Content:              embedContent{Parts: []embedPart{{Text: text}}},
		OutputDimensionality: c.dimensions,
	}
	buf, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("gemini-embed: marshal: %w", err)
	}

	url := fmt.Sprintf("%s/models/%s:embedContent?key=%s", c.baseURL, c.model, c.apiKey)

	var lastErr error
	for attempt := 0; attempt <= maxRetries; attempt++ {
		if attempt > 0 {
			delay := time.Duration(1<<(attempt-1)) * time.Second
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(delay):
			}
		}
		vec, retryable, err := c.doOnce(ctx, url, buf)
		if err == nil {
			return vec, nil
		}
		lastErr = err
		if !retryable {
			return nil, err
		}
	}
	return nil, fmt.Errorf("gemini-embed: exhausted retries: %w", lastErr)
}

func (c *GeminiEmbedClient) doOnce(ctx context.Context, url string, body []byte) ([]float32, bool, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, false, fmt.Errorf("gemini-embed: request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, true, fmt.Errorf("gemini-embed: do: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, true, fmt.Errorf("gemini-embed: read: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		retryable := resp.StatusCode == 429 || resp.StatusCode >= 500
		var parsedErr embedResponse
		_ = json.Unmarshal(respBytes, &parsedErr)
		msg := truncate(string(respBytes), 300)
		if parsedErr.Error != nil && parsedErr.Error.Message != "" {
			msg = parsedErr.Error.Message
		}
		return nil, retryable, fmt.Errorf("gemini-embed: http %d: %s", resp.StatusCode, msg)
	}

	var parsed embedResponse
	if err := json.Unmarshal(respBytes, &parsed); err != nil {
		return nil, false, fmt.Errorf("gemini-embed: unmarshal: %w (body=%s)", err, truncate(string(respBytes), 300))
	}

	if len(parsed.Embedding.Values) == 0 {
		return nil, false, errors.New("gemini-embed: empty embedding")
	}
	return parsed.Embedding.Values, false, nil
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}
