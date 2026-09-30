import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Activity, BookOpen, Layers, AlertCircle, Settings, Search } from 'lucide-react';
import { performResearch } from '../lib/api';
import { useApiKeys } from '../hooks/useApiKeys';
import { Link } from 'react-router-dom';
import type { ResearchResult } from '../types';

// ── Types ────────────────────────────────────────────────────────────────

type ChatMessage =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'thinking' }
  | { id: string; role: 'result'; result: ResearchResult }
  | { id: string; role: 'error'; text: string };

// ── Thinking dots (GPT/Gemini style) ─────────────────────────────────────

const ThinkingDots = () => (
  <div className="flex gap-3 items-end">
    <div className="w-8 h-8 rounded-xl bg-research-indigo/10 border border-research-indigo/20 flex items-center justify-center flex-shrink-0">
      <Activity className="w-4 h-4 text-research-indigo" />
    </div>
    <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-5 py-4 shadow-sm">
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-muted-foreground"
            animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
          />
        ))}
      </div>
    </div>
  </div>
);

// ── Result bubble ─────────────────────────────────────────────────────────

const ResultBubble = ({ result }: { result: ResearchResult }) => {
  const [tab, setTab] = useState<'synthesis' | 'papers' | 'gaps'>('synthesis');
  const supporting = result.evidence.filter(e => e.type === 'supporting');
  const conflicting = result.evidence.filter(e => e.type === 'conflicting');

  return (
    <div className="flex gap-3 items-end">
      <div className="w-8 h-8 rounded-xl bg-research-indigo/10 border border-research-indigo/20 flex items-center justify-center flex-shrink-0">
        <Activity className="w-4 h-4 text-research-indigo" />
      </div>

      <div className="flex-1 max-w-3xl">
        {/* Source badge row */}
        <div className="flex items-center gap-1.5 flex-wrap mb-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground/60">Searched</span>
          {['Crossref', 'OpenAlex', 'Semantic Scholar', 'arXiv'].map(s => (
            <span key={s} className="bg-muted border border-border px-1.5 py-0.5 rounded-md font-medium text-foreground/70">{s}</span>
          ))}
          <span className="font-semibold text-foreground ml-1">· {result.papers.length} papers</span>
        </div>

        <div className="bg-card border border-border rounded-2xl rounded-bl-sm shadow-sm overflow-hidden">
          {/* Synthesis text */}
          <div className="p-5 pb-4">
            <p className="text-foreground leading-relaxed">{result.synthesis}</p>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-4 border-t border-border divide-x divide-border bg-muted/30">
            {[
              { label: 'Supporting', color: 'text-research-green', count: supporting.length },
              { label: 'Conflicting', color: 'text-research-red', count: conflicting.length },
              { label: 'Gaps', color: 'text-research-amber', count: result.gaps.length },
              { label: 'Connections', color: 'text-research-blue', count: result.landscape.children?.length || 0 },
            ].map(({ label, color, count }) => (
              <div key={label} className="py-2.5 text-center">
                <div className={`text-lg font-bold ${color}`}>{count}</div>
                <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{label}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex border-t border-border">
            {(['synthesis', 'papers', 'gaps'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                  tab === t
                    ? 'text-research-indigo border-b-2 border-research-indigo bg-research-indigo/5'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                }`}>
                {t === 'synthesis' ? 'Evidence' : t === 'papers' ? `Papers (${result.papers.length})` : `Gaps (${result.gaps.length})`}
              </button>
            ))}
          </div>

          {/* Tab panels */}
          <div className="p-4">
            <AnimatePresence mode="wait">
              {tab === 'synthesis' && (
                <motion.div key="ev" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                  {supporting.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-research-green uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-research-green inline-block" />Supporting evidence
                      </p>
                      {supporting.slice(0, 3).map((e, idx) => {
                        const paper = result.papers.find(p => p.id === e.paperId) || result.papers[idx];
                        return paper ? (
                          <div key={e.id} className="border-l-2 border-research-green/50 pl-3 mb-2.5">
                            <p className="text-sm text-foreground/90 italic leading-relaxed">"{e.excerpt}"</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-muted-foreground font-medium">[{paper.citationNumber}] {(paper.title || '').slice(0, 55)}...</span>
                              {paper.url && <a href={paper.url} target="_blank" rel="noreferrer" className="text-xs text-research-indigo hover:underline">↗</a>}
                            </div>
                          </div>
                        ) : null;
                      })}
                    </div>
                  )}
                  {conflicting.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-research-red uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-research-red inline-block" />Conflicting evidence
                      </p>
                      {conflicting.slice(0, 2).map((e, idx) => {
                        const paper = result.papers.find(p => p.id === e.paperId) || result.papers[idx];
                        return paper ? (
                          <div key={e.id} className="border-l-2 border-research-red/50 pl-3 mb-2.5">
                            <p className="text-sm text-foreground/90 italic leading-relaxed">"{e.excerpt}"</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-muted-foreground font-medium">[{paper.citationNumber}] {(paper.title || '').slice(0, 55)}...</span>
                              {paper.url && <a href={paper.url} target="_blank" rel="noreferrer" className="text-xs text-research-indigo hover:underline">↗</a>}
                            </div>
                          </div>
                        ) : null;
                      })}
                    </div>
                  )}
                  {supporting.length === 0 && conflicting.length === 0 && (
                    <p className="text-sm text-muted-foreground">No classified evidence returned. See the Papers tab for retrieved sources.</p>
                  )}
                </motion.div>
              )}

              {tab === 'papers' && (
                <motion.div key="pp" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-1 max-h-72 overflow-y-auto pr-1">
                  {result.papers.map(p => (
                    <div key={p.id} className="flex gap-3 items-start py-2 px-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <span className="text-[10px] font-bold text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5">[{p.citationNumber}]</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground leading-snug">{p.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{(p.authors || []).slice(0, 2).join(', ')} · {p.year} · <span className="font-semibold">{p.source}</span></p>
                      </div>
                      {p.url && <a href={p.url} target="_blank" rel="noreferrer" className="text-xs text-research-indigo font-semibold flex-shrink-0 hover:underline mt-0.5">↗</a>}
                    </div>
                  ))}
                </motion.div>
              )}

              {tab === 'gaps' && (
                <motion.div key="gp" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                  {result.gaps.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No knowledge gaps identified.</p>
                  ) : result.gaps.map(g => (
                    <div key={g.id} className="border-l-2 border-research-amber/60 pl-3">
                      <p className="text-sm font-semibold text-foreground">{g.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{g.whyItMatters}</p>
                    </div>
                  ))}
                  {(result.landscape.children || []).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-xs font-bold text-research-blue uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5" />Emerging connections
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {result.landscape.children!.map(c => (
                          <span key={c.id} className="text-xs bg-research-blue/10 border border-research-blue/20 text-research-blue px-2.5 py-1 rounded-full font-medium">
                            {c.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────

export const Research = () => {
  const { keys } = useApiKeys();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const hasGeminiKey = !!keys.gemini?.trim();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const thinkingId = `thinking-${Date.now()}`;
    setMessages(prev => [
      ...prev,
      { id: `user-${Date.now()}`, role: 'user', text },
      { id: thinkingId, role: 'thinking' },
    ]);
    setIsLoading(true);
    try {
      const result = await performResearch(text, keys);
      setMessages(prev => prev.map(m =>
        m.id === thinkingId ? { id: thinkingId, role: 'result', result } : m
      ));
    } catch (err: any) {
      setMessages(prev => prev.map(m =>
        m.id === thinkingId ? { id: thinkingId, role: 'error', text: err.message || 'Something went wrong.' } : m
      ));
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    send(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!input.trim()) return;
      send(input);
      setInput('');
    }
  };

  const examples = [
    "What does current research say about AI agents in software engineering?",
    "Does intermittent fasting improve metabolic health?",
    "What are the latest approaches to solid-state batteries?",
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] w-full max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Research workspace</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Ask anything · Agent searches 6 scholarly sources · AI synthesizes</p>
        </div>
        <div className="flex items-center gap-3">
          {!hasGeminiKey && (
            <Link to="/settings" className="flex items-center gap-1.5 text-xs font-semibold text-research-amber bg-research-amber/10 border border-research-amber/30 px-3 py-1.5 rounded-lg hover:bg-research-amber/20 transition-colors">
              <Settings className="w-3.5 h-3.5" />Add Gemini Key
            </Link>
          )}
          {messages.length > 0 && (
            <button onClick={() => setMessages([])} className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-muted">
              Clear chat
            </button>
          )}
        </div>
      </div>

      {/* Chat scroll area */}
      <div className="flex-1 overflow-y-auto py-6 space-y-5 min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center pb-12">
            <div className="w-14 h-14 rounded-2xl bg-research-indigo/10 border border-research-indigo/20 flex items-center justify-center mb-5">
              <Search className="w-7 h-7 text-research-indigo" />
            </div>
            <h2 className="text-2xl font-semibold text-foreground mb-2 tracking-tight">What would you like to research?</h2>
            <p className="text-muted-foreground max-w-sm text-sm mb-8 leading-relaxed">
              I'll search Crossref, OpenAlex, Semantic Scholar, arXiv, Exa, and Tavily — then synthesize the evidence with AI.
            </p>
            <div className="flex flex-col gap-2 w-full max-w-lg">
              {examples.map((ex, i) => (
                <button key={i} onClick={() => send(ex)}
                  className="text-sm text-left text-foreground/80 bg-card hover:bg-muted border border-border hover:border-muted-foreground/30 px-4 py-3 rounded-xl transition-all shadow-sm">
                  {ex}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map(msg => (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                {msg.role === 'user' && (
                  <div className="flex justify-end px-1">
                    <div className="bg-research-indigo text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-lg shadow-sm">
                      <p className="text-sm leading-relaxed">{msg.text}</p>
                    </div>
                  </div>
                )}
                {msg.role === 'thinking' && <ThinkingDots />}
                {msg.role === 'result' && <ResultBubble result={msg.result} />}
                {msg.role === 'error' && (
                  <div className="flex gap-3 items-end">
                    <div className="w-8 h-8 rounded-xl bg-research-red/10 border border-research-red/20 flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="w-4 h-4 text-research-red" />
                    </div>
                    <div className="bg-research-red/5 border border-research-red/20 rounded-2xl rounded-bl-sm px-4 py-3 max-w-xl">
                      <p className="text-sm text-foreground leading-relaxed">{msg.text}</p>
                      {msg.text.includes('API Settings') && (
                        <Link to="/settings" className="text-xs text-research-indigo font-semibold mt-2 block hover:underline">→ Open API Settings</Link>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 pt-3 border-t border-border">
        <form onSubmit={handleSubmit} className="relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading || !hasGeminiKey}
            placeholder={
              !hasGeminiKey
                ? "Add your Gemini API key in Settings to start..."
                : "Ask a research question... (Enter to send, Shift+Enter for new line)"
            }
            rows={1}
            className="w-full bg-card border border-border rounded-2xl px-5 py-4 pr-14 text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-research-indigo focus:border-transparent outline-none resize-none transition-all shadow-sm text-sm leading-relaxed disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ maxHeight: '140px', overflowY: 'auto' }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading || !hasGeminiKey}
            className="absolute right-3 bottom-3 w-9 h-9 bg-research-indigo hover:bg-indigo-600 text-white rounded-xl flex items-center justify-center transition-all shadow-sm hover:shadow-glow disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isLoading
              ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}><Activity className="w-4 h-4" /></motion.div>
              : <Send className="w-4 h-4" />
            }
          </button>
        </form>
        <p className="text-center text-[10px] text-muted-foreground mt-2 flex items-center justify-center gap-1">
          <BookOpen className="w-3 h-3" /> Results are AI-analyzed from real scholarly sources, not generated
        </p>
      </div>
    </div>
  );
};
