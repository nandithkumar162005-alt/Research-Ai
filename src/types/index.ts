export interface ResearchQuery {
  id: string;
  query: string;
  timestamp: string;
}

export interface ResearchSource {
  id: string;
  name: string;
  description: string;
  status: 'connected' | 'available' | 'error';
  requiresKey: boolean;
  type: string;
}

export interface ResearchPaper {
  id: string;
  title: string;
  authors: string[];
  year: number;
  source: string;
  doi?: string;
  abstract: string;
  relevance: string;
  citationNumber: number;
  url?: string;
}

export interface Evidence {
  id: string;
  paperId: string;
  type: 'supporting' | 'conflicting';
  excerpt: string;
  strength: 'strong' | 'moderate' | 'limited';
}

export interface KnowledgeGap {
  id: string;
  title: string;
  description: string;
  evidenceCoverage: string;
  relatedSources: string[];
  whyItMatters: string;
}

export interface Contradiction {
  id: string;
  claim: string;
  supportingPapers: string[];
  contradictingPapers: string[];
  reasonsForDisagreement: string[];
}

export interface ResearchConnection {
  id: string;
  sourceId: string;
  targetId: string;
  relationship: string;
}

export interface TopicNode {
  id: string;
  label: string;
  paperCount: number;
  relatedSources: string[];
  children?: TopicNode[];
}

export interface ResearchResult {
  query: string;
  synthesis: string;
  papers: ResearchPaper[];
  evidence: Evidence[];
  gaps: KnowledgeGap[];
  contradictions: Contradiction[];
  landscape: TopicNode;
}

export interface AIProvider {
  id: string;
  name: string;
  status: 'connected' | 'not_configured' | 'error';
  isPrimary: boolean;
}

export interface APIConnectionStatus {
  engineReady: boolean;
  activeAiProvider: string;
  availableSourcesCount: number;
  lastChecked: string;
}
