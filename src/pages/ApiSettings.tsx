import { useState } from 'react';
import { useApiKeys } from '../hooks/useApiKeys';
import { useCustomSources } from '../hooks/useCustomSources';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  Cpu, CheckCircle2, AlertCircle, Key, Activity,
  Eye, EyeOff, Loader2, Zap, Globe, BookOpen, FlaskConical
} from 'lucide-react';

type TestState = 'idle' | 'testing' | 'ok' | 'fail';

const ProviderCard = ({
  name,
  description,
  keyValue,
  keyName,
  onSave,
  showKey,
  onToggleShow,
  testState,
  onTest,
  placeholder,
  required,
  icon: Icon,
}: {
  name: string;
  description: string;
  keyValue: string;
  keyName: string;
  onSave: (v: string) => void;
  showKey: boolean;
  onToggleShow: () => void;
  testState?: TestState;
  onTest?: () => void;
  placeholder: string;
  required?: boolean;
  icon: any;
}) => {
  const [draft, setDraft] = useState(keyValue);
  const hasKey = draft.trim().length > 0;
  const saved = draft === keyValue;

  return (
    <div className="card">
      <div className="flex justify-between items-start mb-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-muted border border-border flex items-center justify-center flex-shrink-0">
            <Icon className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              {name}
              {required && <span className="text-[10px] font-bold text-research-amber uppercase tracking-wider bg-research-amber/10 border border-research-amber/30 px-1.5 py-0.5 rounded">Required</span>}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {hasKey && saved ? (
            <><CheckCircle2 className="w-4 h-4 text-research-green" /><span className="text-xs font-bold text-research-green">Active</span></>
          ) : (
            <><AlertCircle className="w-4 h-4 text-muted-foreground" /><span className="text-xs font-bold text-muted-foreground">Not set</span></>
          )}
        </div>
      </div>

      <div className="mb-4">
        <label className="text-xs text-muted-foreground font-bold uppercase tracking-wider block mb-2">API Key</label>
        <div className="relative">
          <Key className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type={showKey ? 'text' : 'password'}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            className="w-full bg-muted border border-border rounded-xl pl-10 pr-10 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-research-indigo focus:border-transparent outline-none transition-all font-mono placeholder:font-sans placeholder:text-muted-foreground"
          />
          <button onClick={onToggleShow} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {keyName && <p className="text-xs text-muted-foreground mt-1.5">Also reads from <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono text-[11px] border border-border">.env: {keyName}</code></p>}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onSave(draft)}
          disabled={saved && hasKey}
          className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-default"
        >
          {saved && hasKey ? 'Saved ✓' : 'Save Key'}
        </button>
        {onTest && (
          <button
            onClick={onTest}
            disabled={!hasKey || testState === 'testing'}
            className="btn-secondary px-4 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {testState === 'testing' ? <Loader2 className="w-4 h-4 animate-spin" /> : testState === 'ok' ? <CheckCircle2 className="w-4 h-4 text-research-green" /> : testState === 'fail' ? <AlertCircle className="w-4 h-4 text-research-red" /> : <Zap className="w-4 h-4" />}
            {testState === 'testing' ? 'Testing...' : testState === 'ok' ? 'Connected' : testState === 'fail' ? 'Failed' : 'Test'}
          </button>
        )}
      </div>
    </div>
  );
};

export const ApiSettings = () => {
  const { keys, updateKey } = useApiKeys();
  const { customSources, addSource, removeSource } = useCustomSources();
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [geminiTestState, setGeminiTestState] = useState<TestState>('idle');
  const [testMsg, setTestMsg] = useState('');
  
  // Custom source form state
  const [isAddingSource, setIsAddingSource] = useState(false);
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceEndpoint, setNewSourceEndpoint] = useState('');

  const toggle = (k: string) => setShowKey(p => ({ ...p, [k]: !p[k] }));

  const handleAddSource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceName.trim() || !newSourceEndpoint.trim()) return;
    const id = `custom_${Date.now()}`;
    addSource({ id, name: newSourceName.trim(), endpoint: newSourceEndpoint.trim() });
    setNewSourceName('');
    setNewSourceEndpoint('');
    setIsAddingSource(false);
  };

  const testGemini = async () => {
    if (!keys.gemini) return;
    setGeminiTestState('testing');
    setTestMsg('');
    try {
      const genAI = new GoogleGenerativeAI(keys.gemini);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent('Reply with exactly: OK');
      const text = result.response.text();
      if (text) { setGeminiTestState('ok'); setTestMsg('Gemini is connected and responding.'); }
      else { setGeminiTestState('fail'); setTestMsg('Gemini responded but with empty content.'); }
    } catch (err: any) {
      setGeminiTestState('fail');
      setTestMsg(err.message || 'Connection failed. Check your API key.');
    }
  };

  const providers = [
    { id: 'gemini', name: 'Gemini (Google)', description: 'Primary AI synthesis engine. Used for evidence analysis and structured output.', keyName: 'VITE_GEMINI_API_KEY', placeholder: 'AIza...', required: true, icon: Cpu },
    { id: 'groq', name: 'Groq', description: 'Alternative ultra-fast AI provider for synthesis fallback.', keyName: 'VITE_GROQ_API_KEY', placeholder: 'gsk_...', required: false, icon: Zap },
  ];

  const searchSources = [
    { id: 'exa', name: 'Exa.ai', description: 'Neural web and scholarly discovery. Finds semantically relevant papers and sources.', keyName: 'VITE_EXA_API_KEY', placeholder: 'exa-...', icon: Globe },
    { id: 'tavily', name: 'Tavily', description: 'Independent web search for cross-checking claims and discovering recent evidence.', keyName: 'VITE_TAVILY_API_KEY', placeholder: 'tvly-...', icon: FlaskConical },
  ];

  const freeSources = [
    { name: 'Crossref', desc: 'Scholarly DOI registry. Always active.', icon: BookOpen },
    { name: 'OpenAlex', desc: 'Open catalog of global research. Always active.', icon: Globe },
    { name: 'Semantic Scholar', desc: 'AI-powered academic search. Always active.', icon: Cpu },
    { name: 'arXiv', desc: 'Open-access preprint server. Always active.', icon: FlaskConical },
  ];

  const configuredCount = [keys.gemini, keys.exa, keys.tavily, keys.groq].filter(Boolean).length;

  return (
    <div className="flex flex-col h-full w-full max-w-4xl mx-auto pb-20">
      <div className="mb-10 pt-4">
        <h1 className="text-3xl font-semibold text-foreground tracking-tight mb-2">API Settings</h1>
        <p className="text-muted-foreground font-medium">Configure the AI models and research sources. Keys are saved in your browser and used immediately.</p>
      </div>

      {/* Quick status */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
        {[
          { label: 'AI Provider', ok: !!keys.gemini, detail: keys.gemini ? 'Gemini ready' : 'Key missing' },
          { label: 'Neural Search', ok: !!keys.exa, detail: keys.exa ? 'Exa active' : 'Optional' },
          { label: 'Web Search', ok: !!keys.tavily, detail: keys.tavily ? 'Tavily active' : 'Optional' },
          { label: 'Open Sources', ok: true, detail: '4 always active' },
        ].map(({ label, ok, detail }) => (
          <div key={label} className="card py-4">
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-2 h-2 rounded-full ${ok ? 'bg-research-green' : 'bg-research-amber'}`} />
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
            </div>
            <p className="text-sm font-semibold text-foreground">{detail}</p>
          </div>
        ))}
      </div>

      <div className="space-y-10">
        {/* AI Providers */}
        <section>
          <div className="flex items-center gap-2 mb-5 border-b border-border pb-2">
            <Cpu className="w-5 h-5 text-foreground" />
            <h2 className="text-xl font-semibold text-foreground">AI Providers</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {providers.map(p => (
              <ProviderCard
                key={p.id}
                name={p.name}
                description={p.description}
                keyValue={keys[p.id]}
                keyName={p.keyName}
                onSave={(v) => updateKey(p.id as any, v)}
                showKey={!!showKey[p.id]}
                onToggleShow={() => toggle(p.id)}
                testState={p.id === 'gemini' ? geminiTestState : undefined}
                onTest={p.id === 'gemini' ? testGemini : undefined}
                placeholder={p.placeholder}
                required={p.required}
                icon={p.icon}
              />
            ))}
          </div>
          {testMsg && (
            <p className={`mt-3 text-sm font-medium px-4 py-2.5 rounded-xl border ${geminiTestState === 'ok' ? 'text-research-green bg-research-green/5 border-research-green/30' : 'text-research-red bg-research-red/5 border-research-red/30'}`}>
              {testMsg}
            </p>
          )}
        </section>

        {/* Search Sources (paid) */}
        <section>
          <div className="flex items-center gap-2 mb-5 border-b border-border pb-2">
            <Globe className="w-5 h-5 text-foreground" />
            <h2 className="text-xl font-semibold text-foreground">Web Search Sources</h2>
            <span className="text-xs text-muted-foreground font-medium ml-auto">Optional — extends research coverage</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {searchSources.map(s => (
              <ProviderCard
                key={s.id}
                name={s.name}
                description={s.description}
                keyValue={keys[s.id]}
                keyName={s.keyName}
                onSave={(v) => updateKey(s.id as any, v)}
                showKey={!!showKey[s.id]}
                onToggleShow={() => toggle(s.id)}
                placeholder={s.placeholder}
                icon={s.icon}
              />
            ))}
            
            {/* Render dynamically added custom sources */}
            {customSources.map(s => (
              <div key={s.id} className="relative">
                <ProviderCard
                  name={s.name}
                  description={`Custom endpoint: ${s.endpoint}`}
                  keyValue={keys[s.id] || ''}
                  keyName=""
                  onSave={(v) => updateKey(s.id as any, v)}
                  showKey={!!showKey[s.id]}
                  onToggleShow={() => toggle(s.id)}
                  placeholder="API Key for this endpoint..."
                  icon={Globe}
                />
                <button 
                  onClick={() => removeSource(s.id)}
                  className="absolute top-4 right-20 text-xs text-research-red hover:bg-research-red/10 px-2 py-1 rounded transition-colors"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          {/* Add Custom Source Button & Form */}
          <div className="mt-6">
            {!isAddingSource ? (
              <button 
                onClick={() => setIsAddingSource(true)}
                className="btn-secondary text-sm flex items-center justify-center gap-2 w-full py-3 border-dashed"
              >
                + Add Custom Web Search Source
              </button>
            ) : (
              <form onSubmit={handleAddSource} className="card bg-muted/30 border-dashed">
                <h3 className="text-sm font-semibold mb-3">Add Custom API Endpoint</h3>
                <div className="space-y-3 mb-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Source Name</label>
                    <input 
                      type="text" 
                      value={newSourceName} 
                      onChange={e => setNewSourceName(e.target.value)} 
                      placeholder="e.g. Brave Search" 
                      className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-research-indigo"
                      required 
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">API Endpoint URL (use {'{query}'} for search term)</label>
                    <input 
                      type="url" 
                      value={newSourceEndpoint} 
                      onChange={e => setNewSourceEndpoint(e.target.value)} 
                      placeholder="https://api.search.brave.com/res/v1/web/search?q={query}" 
                      className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-research-indigo"
                      required 
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="btn-primary py-2 px-4 text-sm">Add Source</button>
                  <button type="button" onClick={() => setIsAddingSource(false)} className="btn-secondary py-2 px-4 text-sm">Cancel</button>
                </div>
              </form>
            )}
          </div>
        </section>

        {/* Free Sources */}
        <section>
          <div className="flex items-center gap-2 mb-5 border-b border-border pb-2">
            <BookOpen className="w-5 h-5 text-foreground" />
            <h2 className="text-xl font-semibold text-foreground">Open Scholarly Sources</h2>
            <span className="text-xs font-bold text-research-green bg-research-green/10 border border-research-green/30 px-2 py-0.5 rounded-lg ml-auto">No key needed</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {freeSources.map(s => (
              <div key={s.name} className="flex items-start gap-3 p-4 bg-card border border-border rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-research-green/10 border border-research-green/20 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-research-green" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* System Status */}
        <section className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-5 flex items-center gap-2">
            <Activity className="w-4 h-4 text-research-indigo" /> System Status
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            <div>
              <span className="text-xs font-semibold text-muted-foreground block mb-1.5 uppercase tracking-wider">Research Engine</span>
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <div className="w-2 h-2 rounded-full bg-research-green" />
                Operational
              </div>
            </div>
            <div>
              <span className="text-xs font-semibold text-muted-foreground block mb-1.5 uppercase tracking-wider">AI Synthesis</span>
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <div className={`w-2 h-2 rounded-full ${keys.gemini ? 'bg-research-green' : 'bg-research-amber'}`} />
                {keys.gemini ? 'Gemini Ready' : 'Key Required'}
              </div>
            </div>
            <div>
              <span className="text-xs font-semibold text-muted-foreground block mb-1.5 uppercase tracking-wider">Keys Configured</span>
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <div className="w-2 h-2 rounded-full bg-research-blue" />
                {configuredCount} / 4
              </div>
            </div>
            <div>
              <span className="text-xs font-semibold text-muted-foreground block mb-1.5 uppercase tracking-wider">Open Sources</span>
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <div className="w-2 h-2 rounded-full bg-research-green" />
                4 active
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
