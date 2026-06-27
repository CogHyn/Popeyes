export interface SummaryQuery {
  content: string;
}

export interface SummaryResponse {
  summaryText: string;
}

export interface ISummaryEngine {
  summarize(query: SummaryQuery): Promise<SummaryResponse>;
}
