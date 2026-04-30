export interface HAState {
  entity_id: string;
  state: string;
  attributes: {
    brightness?: number;
    rgb_color?: [number, number, number];
    [key: string]: unknown;
  };
}

export interface DashConfig {
  ha_url: string;
  ha_token: string;
  humidity_threshold?: number;
  weather_entity?: string;
  entities?: EntityConfig;
}

export type EntityConfig = Record<string, EntitySet>;

export interface EntitySet {
  light?: string;
  temperature?: string;
  humidity?: string;
  presence?: string;
}

export type ConnectionStatus =
  | 'connecting'
  | 'authenticating'
  | 'connected'
  | 'error'
  | 'reconnecting'
  | 'invalid-token';
