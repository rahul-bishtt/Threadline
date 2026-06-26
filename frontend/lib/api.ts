import axios from 'axios';

// TODO:
// Configure AXIOS client instance with NEXT_PUBLIC_API_BASE_URL.
// Export fetchers for:
//   - getClusters() -> GET /clusters
//   - getClusterById(id) -> GET /clusters/:id
//   - getTimeline() -> GET /timeline
//   - triggerIngest() -> POST /ingest/trigger
//   - getIngestStatus(jobId) -> GET /ingest/status/:jobId

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface Cluster {
  id: number;
  label: string;
  articleCount: number;
  startTime: string;
  endTime: string;
}

export interface Article {
  id: number;
  source: string;
  title: string;
  url: string;
  publishedAt: string;
}

export interface ClusterDetail extends Cluster {
  articles: Article[];
}

export interface TimelineData {
  id: number;
  label: string;
  startTime: string;
  endTime: string;
  articleCount: number;
  intensity: number;
}

export interface IngestTriggerResponse {
  jobId: string;
  status: string;
}

export interface IngestStatusResponse {
  jobId: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  error?: string;
}

export const getClusters = async (): Promise<Cluster[]> => {
  const response = await client.get<Cluster[]>('/clusters');
  return response.data;
};

export const getClusterById = async (id: number): Promise<ClusterDetail> => {
  const response = await client.get<ClusterDetail>(`/clusters/${id}`);
  return response.data;
};

export const getTimeline = async (): Promise<TimelineData[]> => {
  const response = await client.get<TimelineData[]>('/timeline');
  return response.data;
};

export const triggerIngest = async (): Promise<IngestTriggerResponse> => {
  const response = await client.post<IngestTriggerResponse>('/ingest/trigger');
  return response.data;
};

export const getIngestStatus = async (jobId: string): Promise<IngestStatusResponse> => {
  const response = await client.get<IngestStatusResponse>(`/ingest/status/${jobId}`);
  return response.data;
};

export default client;
