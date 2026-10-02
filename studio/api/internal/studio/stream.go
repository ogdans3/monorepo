package studio

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

func emptyStrings(v []string) []string {
	if v == nil {
		return []string{}
	}
	return v
}
func extraChatTools() []map[string]any {
	out := []map[string]any{}
	s := map[string]string{"type": "string"}
	for _, t := range []map[string]any{mcpTool("create_task", "Draft a production task as an idea. A human must activate it; does not start agents.", map[string]any{"title": s, "brief": s}, "title", "brief"), mcpTool("get_item", "Read authorized content and exact versions.", map[string]any{"item_id": s}, "item_id"), mcpTool("revise_task", "Draft a revision for an idea or delivered task. Sets status to idea; a human must activate it. Never starts an agent.", map[string]any{"task_id": s, "brief": s}, "task_id", "brief")} {
		out = append(out, map[string]any{"type": "function", "function": map[string]any{"name": t["name"], "description": t["description"], "parameters": t["inputSchema"]}})
	}
	return out
}
func (a *App) streamCompletion(ctx context.Context, id string, payload map[string]any, out *completion) error {
	payload["stream"] = true
	payload["stream_options"] = map[string]bool{"include_usage": true}
	req, e := http.NewRequestWithContext(ctx, "POST", "https://openrouter.ai/api/v1/chat/completions", bytes.NewReader(jsonBytes(payload)))
	if e != nil {
		return e
	}
	req.Header.Set("Authorization", "Bearer "+os.Getenv("OPENROUTER_API_KEY"))
	req.Header.Set("Content-Type", "application/json")
	resp, e := a.http.Do(req)
	if e != nil {
		return fmt.Errorf("modellkallet ble avbrutt")
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("OpenRouter svarte %d; ingen automatisk gjentakelse", resp.StatusCode)
	}
	if !strings.Contains(resp.Header.Get("Content-Type"), "text/event-stream") {
		return json.NewDecoder(io.LimitReader(resp.Body, 8<<20)).Decode(out)
	}
	var content strings.Builder
	calls := map[int]*toolCall{}
	finish := ""
	last := time.Now()
	scanner := bufio.NewScanner(io.LimitReader(resp.Body, 8<<20))
	scanner.Buffer(make([]byte, 4096), 1<<20)
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")
		if data == "[DONE]" {
			break
		}
		var chunk struct {
			Model string          `json:"model"`
			Error json.RawMessage `json:"error"`
			Usage struct {
				Cost *float64 `json:"cost"`
			} `json:"usage"`
			Choices []struct {
				Delta struct {
					Content string `json:"content"`
					Calls   []struct {
						Index    int    `json:"index"`
						ID       string `json:"id"`
						Type     string `json:"type"`
						Function struct {
							Name      string `json:"name"`
							Arguments string `json:"arguments"`
						} `json:"function"`
					} `json:"tool_calls"`
				} `json:"delta"`
				Finish string `json:"finish_reason"`
			} `json:"choices"`
		}
		if e = json.Unmarshal([]byte(data), &chunk); e != nil {
			return fmt.Errorf("ugyldig strøm fra modellen")
		}
		if len(chunk.Error) > 0 {
			return fmt.Errorf("modellen avbrøt strømmen")
		}
		if chunk.Model != "" {
			out.Model = chunk.Model
		}
		if chunk.Usage.Cost != nil {
			out.Usage.Cost = chunk.Usage.Cost
		}
		for _, ch := range chunk.Choices {
			content.WriteString(ch.Delta.Content)
			if ch.Finish != "" {
				finish = ch.Finish
			}
			for _, c := range ch.Delta.Calls {
				if c.Index < 0 || c.Index > 3 {
					return fmt.Errorf("for mange verktøykall")
				}
				if calls[c.Index] == nil {
					calls[c.Index] = &toolCall{Type: "function"}
				}
				t := calls[c.Index]
				if c.ID != "" {
					t.ID = c.ID
				}
				t.Function.Name += c.Function.Name
				t.Function.Arguments += c.Function.Arguments
			}
		}
		if time.Since(last) > 250*time.Millisecond {
			a.db.Exec(ctx, "UPDATE runs SET partial=$1 WHERE id=$2 AND status='running'", content.String(), id)
			last = time.Now()
		}
	}
	if e = scanner.Err(); e != nil {
		return e
	}
	m := chatMessage{Role: "assistant", Content: content.String()}
	for i := 0; i < len(calls); i++ {
		if calls[i] == nil {
			return fmt.Errorf("ufullstendig verktøykall")
		}
		m.Calls = append(m.Calls, *calls[i])
	}
	out.Choices = append(out.Choices, struct {
		Message chatMessage `json:"message"`
		Finish  string      `json:"finish_reason"`
	}{Message: m, Finish: finish})
	a.db.Exec(ctx, "UPDATE runs SET partial='' WHERE id=$1", id)
	return nil
}
