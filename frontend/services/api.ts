import Constants from 'expo-constants';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || Constants.expoConfig?.extra?.backendUrl || 'http://localhost:8001';

export const API_BASE_URL = `${BACKEND_URL}/api`;

interface RequestOptions extends RequestInit {
  token?: string | null;
}

class ApiService {
  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { token, ...fetchOptions } = options;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...fetchOptions,
      headers,
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Request failed' }));
      throw new Error(error.detail || 'Request failed');
    }
    
    return response.json();
  }
  
  // Auth APIs
  async register(email: string, password: string, name: string) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
  }
  
  async login(email: string, password: string) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }
  
  async getMe(token: string) {
    return this.request('/auth/me', { token });
  }
  
  async updateProfile(data: any, token: string) {
    return this.request('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
      token,
    });
  }
  
  // Meal APIs
  async analyzeMeal(imageBase64: string, tag: string, token: string, options?: { portionAmount?: number | null; portionUnit?: string | null }, retryCount: number = 0): Promise<any> {
    try {
      const body: any = { image_base64: imageBase64, tag };
      if (options?.portionAmount != null && !Number.isNaN(options.portionAmount)) {
        body.portion_amount = options.portionAmount;
        if (options.portionUnit) {
          body.portion_unit = options.portionUnit;
        }
      }

      const response = await fetch(`${API_BASE_URL}/meals/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      let data: any = null;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('Failed to parse analysis response:', parseError);
        const error: any = new Error('Unexpected response from server. Please try again.');
        error.code = 'BAD_RESPONSE';
        throw error;
      }

      // Handle non-200 HTTP status codes (backend/server errors)
      if (!response.ok) {
        const message = data?.message || data?.detail || 'Analysis failed';
        const code = data?.code || 'SERVER_ERROR';
        const error: any = new Error(message);
        error.code = code;
        throw error;
      }
      
      // Check if response has error status from backend (Gemini / validation issues)
      if (data.status === 'error') {
        const error: any = new Error(data.message || 'Analysis failed');
        if (data.code) {
          error.code = data.code;
        }
        throw error;
      }
      
      // Return the validated data
      if (data.status === 'success' && data.data) {
        return data.data;
      }
      
      // Fallback for old format (direct response)
      return data;
      
    } catch (error: any) {
      const message: string = error?.message || '';

      // Retry logic: max 2 retries on transient network errors
      if (retryCount < 2) {
        const isTransient =
          message.includes('Network') ||
          message.includes('network') ||
          message.includes('timeout') ||
          message.includes('fetch');
        
        if (isTransient) {
          if (!error.code) {
            error.code = 'NETWORK';
          }
          console.log(`Retrying analysis... Attempt ${retryCount + 1}/2`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s
          return this.analyzeMeal(imageBase64, tag, token, retryCount + 1);
        }
      }
      
      throw error;
    }
  }
  
  async saveMeal(mealData: any, token: string) {
    return this.request('/meals', {
      method: 'POST',
      body: JSON.stringify(mealData),
      token,
    });
  }
  
  async getMeals(token: string, limit = 30) {
    return this.request(`/meals?limit=${limit}`, { token });
  }
  
  async getMeal(mealId: string, token: string) {
    return this.request(`/meals/${mealId}`, { token });
  }
  
  async deleteMeal(mealId: string, token: string) {
    return this.request(`/meals/${mealId}`, {
      method: 'DELETE',
      token,
    });
  }
  
  async getTodaySummary(token: string) {
    return this.request('/meals/today/summary', { token });
  }
  
  // Insights APIs
  async getTrends(days: number, token: string) {
    return this.request(`/insights/trends?days=${days}`, { token });
  }
  
  async getWHORecommendations(token: string) {
    return this.request('/insights/who-recommendations', { token });
  }
}

export const api = new ApiService();