export type MetroRef = "10" | "11" | "13" | "14" | "17" | "18" | "19";

export interface Departure {
  direction: string;
  direction_code: number;
  destination: string;
  scheduled: string;
  expected: string;
  display: string;
  line: {
    id: number;
    designation: string;
    transport_mode: string;
    group_of_lines: string;
  };
}

export interface Site {
  Name: string;
  SiteId: string;
  Type: string;
  X: string;
  Y: string;
}

export interface DeparturesResponse {
  departures?: Departure[];
}

export interface SearchResponse {
  StatusCode: number;
  Message: string | null;
  ExecutionTime: number;
  ResponseData: Site[];
  AiInterpretation?: string;
}
