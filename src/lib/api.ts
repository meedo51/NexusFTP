// src/lib/api.ts

/**
 * 🌐 API Client with Retry Logic, Error Recovery, and Timeout Handling
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public data?: any,
    public isNetworkError: boolean = false
  ) {
    super(message);
    this.name = 'ApiError';
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export class ApiClient {
  private baseURL: string;
  private token: string | null = null;
  private defaultTimeout = 30000;
  private maxRetries = 3;

  constructor() {
    this.baseURL = import.meta.env.VITE_API_URL || '/api';
  }

  setToken(token: string): void {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }

  clearToken(): void {
    this.token = null;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<T> {
    const url = this.buildUrl(endpoint);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, this.defaultTimeout);

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle non-JSON responses
      const contentType = response.headers.get('content-type');
      const isJson = contentType?.includes('application/json');

      let data: any;
      if (isJson) {
        try {
          data = await response.json();
        } catch (jsonError) {
          console.error('❌ JSON parse error:', jsonError);
          throw new ApiError(
            'Invalid JSON response from server',
            response.status,
            null,
            false
          );
        }
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        // Handle specific status codes
        if (response.status === 401) {
          // Unauthorized - clear token and redirect to login
          this.clearToken();
          // Emit auth error event
          window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        }

        if (response.status === 404) {
          throw new ApiError(
            `Resource not found: ${endpoint}`,
            404,
            data,
            false
          );
        }

        if (response.status === 400) {
          throw new ApiError(
            data?.message || 'Bad request',
            400,
            data,
            false
          );
        }

        if (response.status === 429) {
          // Rate limited - retry with delay
          const retryAfter = parseInt(response.headers.get('retry-after') || '5');
          throw new ApiError(
            'Rate limit exceeded',
            429,
            data,
            false
          );
        }

        throw new ApiError(
          data?.message || response.statusText || `HTTP ${response.status}`,
          response.status,
          data,
          false
        );
      }

      return data as T;

    } catch (error) {
      clearTimeout(timeoutId);

      // Handle network errors
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        // Network error - retry if possible
        if (retryCount < this.maxRetries) {
          const delay = 1000 * Math.pow(2, retryCount);
          console.log(`🔄 Retrying request (${retryCount + 1}/${this.maxRetries}) after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.request<T>(endpoint, options, retryCount + 1);
        }
        
        throw new ApiError(
          'Network error - please check your connection',
          0,
          null,
          true
        );
      }

      if (error instanceof ApiError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ApiError(
          'Request timeout - server not responding',
          408,
          null,
          false
        );
      }

      throw new ApiError(
        error instanceof Error ? error.message : 'Unknown error occurred',
        500,
        null,
        false
      );
    }
  }

  private buildUrl(endpoint: string): string {
    const base = this.baseURL.endsWith('/') 
      ? this.baseURL.slice(0, -1) 
      : this.baseURL;
    
    const path = endpoint.startsWith('/') 
      ? endpoint 
      : `/${endpoint}`;
    
    return `${base}${path}`;
  }

  // HTTP Methods with automatic retry

  async get<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any, options: RequestInit = {}): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any, options: RequestInit = {}): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: any, options: RequestInit = {}): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  // File upload with progress

  async uploadFile(
    endpoint: string,
    file: File,
    onProgress?: (progress: number) => void,
    additionalData?: Record<string, any>
  ): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    
    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, String(value));
      });
    }

    const xhr = new XMLHttpRequest();
    const url = this.buildUrl(endpoint);

    return new Promise((resolve, reject) => {
      xhr.open('POST', url);

      if (this.token) {
        xhr.setRequestHeader('Authorization', `Bearer ${this.token}`);
      }

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const progress = (event.loaded / event.total) * 100;
          onProgress(Math.min(progress, 100));
        }
      });

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch {
            resolve(xhr.responseText);
          }
        } else {
          reject(new ApiError(
            `Upload failed: ${xhr.status} ${xhr.statusText}`,
            xhr.status,
            xhr.responseText
          ));
        }
      };

      xhr.onerror = () => {
        reject(new ApiError(
          'Upload failed - network error',
          0,
          null,
          true
        ));
      };

      xhr.ontimeout = () => {
        reject(new ApiError(
          'Upload timeout - server not responding',
          408,
          null,
          false
        ));
      };

      xhr.timeout = 60000; // 60 seconds for uploads
      xhr.send(formData);
    });
  }

  // Download file with progress

  async downloadFile(
    endpoint: string,
    onProgress?: (progress: number) => void
  ): Promise<Blob> {
    const xhr = new XMLHttpRequest();
    const url = this.buildUrl(endpoint);

    return new Promise((resolve, reject) => {
      xhr.open('GET', url);
      xhr.responseType = 'blob';

      if (this.token) {
        xhr.setRequestHeader('Authorization', `Bearer ${this.token}`);
      }

      xhr.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const progress = (event.loaded / event.total) * 100;
          onProgress(Math.min(progress, 100));
        }
      });

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(xhr.response);
        } else {
          reject(new ApiError(
            `Download failed: ${xhr.status} ${xhr.statusText}`,
            xhr.status
          ));
        }
      };

      xhr.onerror = () => {
        reject(new ApiError(
          'Download failed - network error',
          0,
          null,
          true
        ));
      };

      xhr.send();
    });
  }
}

export const apiClient = new ApiClient();
export default apiClient;
