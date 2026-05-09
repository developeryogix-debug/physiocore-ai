import type {
  FHIRPatient,
  FHIRObservation,
} from '@physiocore/types';

interface FHIROperationOutcomeIssue {
  severity: string;
  diagnostics?: string;
}

interface FHIROperationOutcome {
  resourceType: 'OperationOutcome';
  issue: FHIROperationOutcomeIssue[];
}

interface FHIRBundle<T> {
  resourceType: 'Bundle';
  entry?: Array<{ resource?: T }>;
}

function isFHIROperationOutcome(value: unknown): value is FHIROperationOutcome {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<string, unknown>)['resourceType'] === 'OperationOutcome'
  );
}

export class FHIRClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? process.env['FHIR_BASE_URL'] ?? 'https://hapi.fhir.org/baseR4';
    this.headers = {
      'Content-Type': 'application/fhir+json',
      Accept: 'application/fhir+json',
    };
  }

  /** Fetch a Patient resource by its server-assigned id. */
  async getPatient(patientId: string): Promise<FHIRPatient> {
    return this.request<FHIRPatient>('GET', `/Patient/${patientId}`);
  }

  /** Create a new Patient resource and return the server response with id. */
  async createPatient(patient: Omit<FHIRPatient, 'id'>): Promise<FHIRPatient> {
    return this.request<FHIRPatient>('POST', '/Patient', patient);
  }

  /**
   * Fetch Observation resources for a patient, optionally filtered by LOINC codes.
   * Returns the entries from the resulting Bundle.
   */
  async getObservations(
    patientId: string,
    codes?: string[],
  ): Promise<FHIRObservation[]> {
    let path = `/Observation?subject=Patient/${patientId}`;
    if (codes !== undefined && codes.length > 0) {
      path += `&code=${codes.join(',')}`;
    }
    const bundle = await this.request<FHIRBundle<FHIRObservation>>('GET', path);
    return (bundle.entry ?? [])
      .map((e) => e.resource)
      .filter((r): r is FHIRObservation => r !== undefined);
  }

  /** Create a new Observation resource and return the server response with id. */
  async createObservation(
    observation: Omit<FHIRObservation, 'id'>,
  ): Promise<FHIRObservation> {
    return this.request<FHIRObservation>('POST', '/Observation', observation);
  }

  /**
   * Search for Patient resources matching arbitrary query parameters.
   * Returns the entries from the resulting Bundle.
   */
  async searchPatients(
    params: Record<string, string>,
  ): Promise<FHIRPatient[]> {
    const qs = new URLSearchParams(params).toString();
    const bundle = await this.request<FHIRBundle<FHIRPatient>>(
      'GET',
      `/Patient?${qs}`,
    );
    return (bundle.entry ?? [])
      .map((e) => e.resource)
      .filter((r): r is FHIRPatient => r !== undefined);
  }

  /**
   * Generic fetch wrapper.
   * Parses FHIR OperationOutcome errors and throws a descriptive Error.
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const init: RequestInit = {
      method,
      headers: this.headers,
    };

    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    const response = await fetch(url, init);

    let json: unknown;
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('json')) {
      json = await response.json();
    }

    if (!response.ok) {
      if (isFHIROperationOutcome(json)) {
        const diagnostics = json.issue
          .map((i) => i.diagnostics ?? i.severity)
          .join('; ');
        throw new Error(
          `FHIR ${method} ${path} failed (${response.status}): ${diagnostics}`,
        );
      }
      throw new Error(
        `FHIR ${method} ${path} failed with HTTP ${response.status}`,
      );
    }

    return json as T;
  }
}
