import { useEffect, useRef, useState } from "react";

const quickPrompts = ["Our services", "Start a project", "Talk to the team"];

function formatInline(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => (
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={`strong-${index}`}>{part.slice(2, -2)}</strong>
      : part
  ));
}

function StructuredMessage({ text }) {
  const blocks = [];
  let listItems = [];
  let listType = null;

  const flushList = () => {
    if (!listItems.length) return;
    const List = listType === "ordered" ? "ol" : "ul";
    blocks.push(
      <List className="dealate-assistant__list" key={`list-${blocks.length}`}>
        {listItems.map((item, index) => <li key={`item-${index}`}>{formatInline(item)}</li>)}
      </List>,
    );
    listItems = [];
    listType = null;
  };

  text.replace(/\r/g, "").split("\n").forEach((line) => {
    const heading = line.match(/^\s{0,3}#{1,3}\s+(.+)$/);
    const unorderedItem = line.match(/^\s*[-*]\s+(.+)$/);
    const orderedItem = line.match(/^\s*\d+[.)]\s+(.+)$/);

    if (heading) {
      flushList();
      blocks.push(<p className="dealate-assistant__heading" key={`heading-${blocks.length}`}>{formatInline(heading[1])}</p>);
      return;
    }

    const item = unorderedItem?.[1] ?? orderedItem?.[1];
    const nextListType = orderedItem ? "ordered" : unorderedItem ? "unordered" : null;
    if (item) {
      if (listType && listType !== nextListType) flushList();
      listType = nextListType;
      listItems.push(item);
      return;
    }

    flushList();
    if (line.trim()) blocks.push(<p key={`paragraph-${blocks.length}`}>{formatInline(line.trim())}</p>);
  });

  flushList();
  return <div className="dealate-assistant__rich-text">{blocks}</div>;
}

export function DealateAssistant({ onStartProject }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [messages, setMessages] = useState([
    {
      from: "bot",
      text: "Hi, I’m Dealate Assistant. What are you looking to build or grow?",
    },
  ]);
  const input = useRef(null);
  const sessionId = useRef(globalThis.crypto?.randomUUID?.() || `dealate-${Date.now()}`);

  useEffect(() => {
    if (open) requestAnimationFrame(() => input.current?.focus());
  }, [open]);

  const send = async (value) => {
    const text = value.trim();
    if (!text || pending) return;
    const conversation = [
      ...messages,
      { from: "user", text },
    ];
    setMessages(conversation);
    setDraft("");
    setPending(true);
    try {
      const response = await fetch("/api/dealate-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: conversation, sessionId: sessionId.current }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Dealate Assistant is unavailable.");
      setMessages((current) => [...current, { from: "bot", text: payload.text }]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        { from: "bot", text: `${error.message} Check the local Lyzr settings and restart the server.` },
      ]);
    } finally {
      setPending(false);
    }
  };

  const startProject = () => {
    setOpen(false);
    onStartProject();
  };

  return (
    <aside className={`dealate-assistant ${open ? "is-open" : ""}`} aria-label="Dealate Assistant">
      {open && (
        <section className="dealate-assistant__panel" aria-live="polite">
          <header className="dealate-assistant__header">
            <div className="dealate-assistant__identity">
              <span className="dealate-assistant__spark" aria-hidden="true">✦</span>
              <div>
                <strong>Dealate Assistant</strong>
                <span>Usually replies instantly</span>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant">×</button>
          </header>
          <div className="dealate-assistant__messages">
            {messages.map((message, index) => (
              <div className={`dealate-assistant__message dealate-assistant__message--${message.from}`} key={`${message.from}-${index}`}>
                {message.from === "bot" ? <StructuredMessage text={message.text} /> : message.text}
              </div>
            ))}
          </div>
          <div className="dealate-assistant__prompts" aria-label="Suggested questions">
            {quickPrompts.map((prompt) => (
              <button
                type="button"
                key={prompt}
                disabled={pending}
                onClick={() => prompt === "Start a project" ? startProject() : send(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>
          <form className="dealate-assistant__composer" onSubmit={(event) => { event.preventDefault(); send(draft); }}>
            <label className="sr-only" htmlFor="dealate-assistant-message">Ask a question</label>
            <input
              ref={input}
              id="dealate-assistant-message"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask about a project..."
              disabled={pending}
            />
            <button type="submit" aria-label="Send message" disabled={pending}>{pending ? "…" : "↗"}</button>
          </form>
        </section>
      )}
      <button
        className="dealate-assistant__launcher"
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? "Close Dealate Assistant" : "Open Dealate Assistant"}
      >
        <span aria-hidden="true">{open ? "×" : "✦"}</span>
        <b>{open ? "Close" : "Ask us"}</b>
      </button>
    </aside>
  );
}
