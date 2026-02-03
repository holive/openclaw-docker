import type { Agent, Event, AgentsResponse, AgentResponse, EventsResponse, HealthResponse } from './types';

const API_BASE = '/api';

// handle api response and extract json or throw error
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP error ${response.status}`);
  }
  return response.json();
}

// fetch all agents
export async function fetchAgents(): Promise<Agent[]> {
  const response = await fetch(`${API_BASE}/agents`);
  const data = await handleResponse<AgentsResponse>(response);
  return data.agents;
}

// fetch a single agent by id
export async function fetchAgent(id: string): Promise<Agent & { eventCount: number }> {
  const response = await fetch(`${API_BASE}/agents/${encodeURIComponent(id)}`);
  const data = await handleResponse<AgentResponse>(response);
  return data.agent;
}

// fetch events for a specific agent
export async function fetchEvents(agentId: string, limit?: number): Promise<Event[]> {
  const params = limit ? `?limit=${limit}` : '';
  const response = await fetch(`${API_BASE}/agents/${encodeURIComponent(agentId)}/events${params}`);
  const data = await handleResponse<EventsResponse>(response);
  return data.events;
}

// health check endpoint
export async function checkHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE}/health`);
  return handleResponse<HealthResponse>(response);
}
