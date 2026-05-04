export interface SankeyNodeDTO {
  id: string;
  label: string;
  type: string;
}

export interface SankeyLinkDTO {
  source: string;
  target: string;
  value: string;
  action?: string;
  sourceType?: string;
  confidence?: string;
  eventCount?: number;
}

export interface SankeyResponse {
  nodes: SankeyNodeDTO[];
  links: SankeyLinkDTO[];
}
