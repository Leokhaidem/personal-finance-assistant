import React, { useState, useRef, useEffect } from "react";
import { apiClient } from "../api/client";
import {
  Send,
  Bot,
  User,
  Sparkles,
  FileText,
  Target,
  CreditCard,
  ShieldAlert,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export const ChatPage = () => {
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hello! I am your personal finance RAG assistant powered by Gemini 3 Flash. I analyze your account balances, monthly budgets, upcoming bills, goals, and uploaded PDF documents/notes to provide grounded recommendations. How can I assist you today?",
      citations: [],
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (textToSend) => {
    const query = textToSend || input;
    if (!query.trim() || loading) return;

    const userMsg = { id: `u-${Date.now()}`, role: "user", content: query };
    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput("");
    setLoading(true);

    try {
      const res = await apiClient.post("/chat", {
        conversation_id: conversationId,
        message: query,
      });

      setConversationId(res.data.conversation_id);
      const asstMsg = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: res.data.message,
        citations: res.data.citations || [],
      };
      setMessages((prev) => [...prev, asstMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content:
            "Sorry, I encountered an error communicating with the financial AI service.",
          citations: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    "Can I afford a ₹50,000 vacation next month given my budgets & goals?",
    "Summarize my total monthly income vs expenses and savings rate.",
    "What are my upcoming bills due in the next 30 days?",
    "What are the key terms in my uploaded health insurance policy document?",
  ];

  return (
    <div
      style={{
        height: "calc(100vh - 4rem)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ marginBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.75rem", marginBottom: "0.25rem" }}>
          AI Financial Assistant
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
          Grounded RAG retrieval combining structured SQL records with ChromaDB
          document & note embeddings.
        </p>
      </div>

      {/* Suggestion Chips */}
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          flexWrap: "wrap",
          marginBottom: "1rem",
        }}
      >
        {suggestions.map((s, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(s)}
            className="btn btn-secondary"
            style={{
              fontSize: "0.78rem",
              padding: "0.4rem 0.75rem",
              borderRadius: "20px",
            }}
          >
            <Sparkles size={13} color="var(--accent-primary)" /> {s}
          </button>
        ))}
      </div>

      {/* Chat Thread Box */}
      <div
        className="glass-card"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          padding: "1.25rem",
        }}
      >
        <div style={{ flex: 1, overflowY: "auto", paddingRight: "0.5rem" }}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: "flex",
                gap: "0.85rem",
                marginBottom: "1.25rem",
                flexDirection: msg.role === "user" ? "row-reverse" : "row",
              }}
            >
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background:
                    msg.role === "user"
                      ? "var(--accent-primary)"
                      : "linear-gradient(135deg, #10b981, #6366f1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {msg.role === "user" ? (
                  <User size={18} color="#fff" />
                ) : (
                  <Bot size={18} color="#fff" />
                )}
              </div>

              <div
                style={{
                  maxWidth: "75%",
                  background:
                    msg.role === "user"
                      ? "rgba(99,102,241,0.2)"
                      : "rgba(0,0,0,0.3)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "14px",
                  padding: "1rem",
                  fontSize: "0.92rem",
                  color: "#f3f4f6",
                }}
              >
                {/* <div style={{ whiteSpace: "pre-line", lineHeight: "1.6" }}>
                  {msg.content}
                </div> */}
                <div className="markdown-body">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content}
                  </ReactMarkdown>
                </div>

                {/* Citation Chips */}
                {msg.citations && msg.citations.length > 0 && (
                  <div
                    style={{
                      marginTop: "0.85rem",
                      paddingTop: "0.75rem",
                      borderTop: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "var(--text-muted)",
                        marginBottom: "0.3rem",
                      }}
                    >
                      Grounded Sources & Citations Used:
                    </div>
                    <div>
                      {msg.citations.map((c, i) => (
                        <span
                          key={i}
                          className="citation-chip"
                          title={c.snippet}
                        >
                          <FileText size={12} /> {c.snippet}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div
              style={{
                display: "flex",
                gap: "0.85rem",
                marginBottom: "1.25rem",
              }}
            >
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #10b981, #6366f1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Bot size={18} color="#fff" />
              </div>
              <div
                style={{
                  background: "rgba(0,0,0,0.3)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "14px",
                  padding: "1rem",
                  color: "var(--text-muted)",
                  fontSize: "0.9rem",
                }}
              >
                Gemini 3 Flash is fetching SQL snapshot + vector ChromaDB
                context...
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}
        >
          <input
            type="text"
            className="input-field"
            placeholder="Ask anything about your money, budgets, upcoming bills, or uploaded policy documents..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !input.trim()}
          >
            <Send size={18} /> Send
          </button>
        </form>
      </div>
    </div>
  );
};
