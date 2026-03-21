/**
 * Cliente TypeScript para el Stellar Disbursement Platform (SDP) REST API.
 * Encapsula las llamadas a disbursements, payments y autenticación JWT.
 */

export interface DisbursementResponse {
  id: string;
  name: string;
  status: DisbursementStatus;
  wallet?: { id: string };
  asset?: { id: string; code: string; issuer: string };
  total_payments?: number;
  total_payments_sent?: number;
  total_payments_failed?: number;
  total_payments_remaining?: number;
  amount_disbursed?: string;
  total_amount?: string;
  average_amount?: string;
  created_at?: string;
  updated_at?: string;
}

export type DisbursementStatus =
  | "DRAFT"
  | "READY"
  | "STARTED"
  | "PAUSED"
  | "COMPLETED";

export interface PaymentResponse {
  id: string;
  amount: string;
  status: PaymentStatus;
  stellar_transaction_id?: string;
  stellar_operation_id?: string;
  type?: "DISBURSEMENT" | "DIRECT";
  disbursement?: { id: string; name: string };
  asset?: { id: string; code: string; issuer: string };
  receiver_wallet?: { stellar_address?: string };
  external_payment_id?: string;
  created_at?: string;
  updated_at?: string;
}

export type PaymentStatus =
  | "DRAFT"
  | "READY"
  | "PENDING"
  | "PAUSED"
  | "SUCCESS"
  | "FAILED"
  | "CANCELED";

export interface PaymentPagination {
  pagination: { page: number; page_limit: number; total_count: number };
  data: PaymentResponse[];
}

export interface CreateDisbursementPayload {
  name: string;
  wallet_id: string;
  asset_id: string;
  verification_field?: "DATE_OF_BIRTH" | "PIN" | "NATIONAL_ID_NUMBER" | "YEAR_MONTH";
  registration_contact_type?: "PHONE_NUMBER" | "EMAIL";
}

export interface SdpAuthCredentials {
  email: string;
  password: string;
}

export class SdpClient {
  private readonly baseUrl: string;
  private jwt: string; // puede actualizarse con refresh
  private readonly credentials?: SdpAuthCredentials;
  private tokenExpiresAt: number = 0; // timestamp ms

  constructor(
    baseUrl: string,
    authOrJwt: string | SdpAuthCredentials
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    if (typeof authOrJwt === "string") {
      this.jwt = authOrJwt;
      this.tokenExpiresAt = Date.now() + 14 * 60 * 1000; // asume 14 min
    } else {
      this.jwt = "";
      this.credentials = authOrJwt;
      this.tokenExpiresAt = 0;
    }
  }

  /**
   * Obtiene un JWT fresco si el actual está por vencer (margen de 60 seg).
   * El endpoint de login del SDP es POST /auth/login con {email, password}.
   */
  private async ensureValidToken(): Promise<void> {
    if (!this.credentials) return; // modo estático, no renovar
    if (Date.now() < this.tokenExpiresAt - 60_000) return; // aún vigente

    const url = `${this.baseUrl}/auth/login`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(this.credentials),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`SDP login failed: ${res.status} - ${text}`);
    }

    const data = (await res.json()) as { token: string; expires_at?: string };
    this.jwt = data.token;
    // El SDP devuelve expires_at en ISO o usa 15 min por defecto
    this.tokenExpiresAt = data.expires_at
      ? new Date(data.expires_at).getTime()
      : Date.now() + 14 * 60 * 1000;
  }

  private async request<T>(
    method: string,
    path: string,
    options?: { body?: unknown; formData?: FormData }
  ): Promise<T> {
    await this.ensureValidToken();

    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.jwt}`,
    };

    let fetchOptions: RequestInit = { method };

    if (options?.formData) {
      fetchOptions.body = options.formData;
      // NO agregar Content-Type — fetch lo setea con boundary automáticamente
    } else if (options?.body) {
      headers["Content-Type"] = "application/json";
      fetchOptions.body = JSON.stringify(options.body);
    }

    fetchOptions.headers = headers;

    const res = await fetch(url, fetchOptions);
    const text = await res.text();

    if (!res.ok) {
      throw new Error(
        `SDP API ${method} ${path}: ${res.status} ${res.statusText} - ${text}`
      );
    }

    if (!text) return {} as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      return { message: text } as T;
    }
  }

  /**
   * Crea un disbursement en estado DRAFT.
   * Luego debe subirse el CSV con uploadDisbursementInstructions().
   */
  async createDisbursement(
    payload: CreateDisbursementPayload
  ): Promise<DisbursementResponse> {
    return this.request<DisbursementResponse>("POST", "/disbursements", {
      body: {
        ...payload,
        verification_field: payload.verification_field ?? "DATE_OF_BIRTH",
        registration_contact_type: payload.registration_contact_type ?? "PHONE_NUMBER",
      },
    });
  }

  /**
   * Sube el CSV con las instrucciones de pago (empleados).
   * El CSV debe tener columnas: phone, id, amount, verification (date_of_birth).
   */
  async uploadDisbursementInstructions(
    disbursementId: string,
    csvBuffer: Buffer,
    fileName = "nomina.csv"
  ): Promise<{ message: string }> {
    const formData = new FormData();
    const blob = new Blob([csvBuffer], { type: "text/csv" });
    formData.append("file", blob, fileName);

    return this.request<{ message: string }>(
      "POST",
      `/disbursements/${disbursementId}/instructions`,
      { formData }
    );
  }

  /**
   * Cambia el estado del disbursement a STARTED para iniciar los pagos.
   * El disbursement debe estar en READY (con CSV cargado y aprobado).
   */
  async startDisbursement(id: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(
      "PATCH",
      `/disbursements/${id}/status`,
      { body: { status: "STARTED" } }
    );
  }

  /**
   * Pausa un disbursement en curso. Útil cuando el Concierge detecta anomalías.
   */
  async pauseDisbursement(id: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(
      "PATCH",
      `/disbursements/${id}/status`,
      { body: { status: "PAUSED" } }
    );
  }

  /**
   * Obtiene el estado actual del disbursement.
   */
  async getDisbursementStatus(id: string): Promise<DisbursementResponse> {
    return this.request<DisbursementResponse>("GET", `/disbursements/${id}`);
  }

  /**
   * Lista wallets disponibles (para obtener wallet_id al crear disbursement).
   */
  async listWallets(): Promise<{ id: string; name: string }[]> {
    const res = await this.request<{ data: { id: string; name: string }[] }>(
      "GET",
      "/wallets"
    );
    return res?.data ?? [];
  }

  /**
   * Lista assets disponibles (para obtener asset_id por código, ej. MXNe).
   */
  async listAssets(): Promise<{ id: string; code: string; issuer: string }[]> {
    const res = await this.request<{
      data: { id: string; code: string; issuer: string }[];
    }>("GET", "/assets");
    return res?.data ?? [];
  }

  /**
   * Lista los pagos de un disbursement.
   * Filtro correcto: disbursement_id, no q.
   */
  async listPayments(
    disbursementId: string,
    options?: { page?: number; page_limit?: number; status?: PaymentStatus }
  ): Promise<PaymentPagination> {
    const params = new URLSearchParams();
    // Filtro correcto: disbursement_id, no q
    params.set("disbursement_id", disbursementId);
    if (options?.page) params.set("page", String(options.page));
    if (options?.page_limit) params.set("page_limit", String(options.page_limit));
    if (options?.status) params.set("status", options.status);

    return this.request<PaymentPagination>(
      "GET",
      `/payments?${params.toString()}`
    );
  }

  /**
   * Obtiene los receivers (empleados registrados) del SDP.
   * Útil para el Concierge: saber qué empleados ya registraron su wallet.
   */
  async listReceivers(
    options?: {
      page?: number;
      page_limit?: number;
      status?: "DRAFT" | "READY" | "REGISTERED" | "FLAGGED";
    }
  ): Promise<{
    pagination: { page: number; page_limit: number; total_count: number };
    data: Array<{
      id: string;
      phone_number?: string;
      email?: string;
      receiver_wallets?: Array<{
        stellar_address?: string;
        status: string;
      }>;
      total_payments?: number;
      total_amount_received?: string;
    }>;
  }> {
    const params = new URLSearchParams();
    if (options?.page) params.set("page", String(options.page));
    if (options?.page_limit) params.set("page_limit", String(options.page_limit));
    if (options?.status) params.set("status", options.status);
    const qs = params.toString();
    return this.request("GET", `/receivers${qs ? "?" + qs : ""}`);
  }
}

/**
 * Crea una instancia de SdpClient usando variables de entorno.
 * Usar en nomina-service.ts y en el Concierge.
 *
 * Requiere en .env:
 *   SDP_BASE_URL=http://localhost:8000
 *   SDP_ADMIN_EMAIL=admin@alebrije.mx
 *   SDP_ADMIN_PASSWORD=tu_password
 *
 * O alternativamente con JWT estático para tests:
 *   SDP_JWT=eyJ...
 */
export function createSdpClientFromEnv(): SdpClient {
  const baseUrl = process.env.SDP_BASE_URL;
  if (!baseUrl) throw new Error("Falta variable de entorno SDP_BASE_URL");

  const staticJwt = process.env.SDP_JWT;
  if (staticJwt) {
    return new SdpClient(baseUrl, staticJwt);
  }

  const email = process.env.SDP_ADMIN_EMAIL;
  const password = process.env.SDP_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "Falta SDP_JWT o bien SDP_ADMIN_EMAIL + SDP_ADMIN_PASSWORD en .env"
    );
  }

  return new SdpClient(baseUrl, { email, password });
}
