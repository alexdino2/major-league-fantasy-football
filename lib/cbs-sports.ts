import axios from 'axios';

interface CBSAuthConfig {
  email: string;
  password: string;
}

interface CBSHistoryData {
  champions: Array<{
    year: number;
    team: string;
    manager: string;
    record: string;
  }>;
  records: Array<{
    category: string;
    record: string;
    holder: string;
    year: string;
  }>;
  milestones: Array<{
    year: number;
    event: string;
    description: string;
  }>;
}

export class CBSSportsAPI {
  private baseUrl = 'https://mlffatl.football.cbssports.com';
  private session: any = null;

  constructor(private config: CBSAuthConfig) {}

  async authenticate() {
    try {
      const response = await axios.post(`${this.baseUrl}/api/auth/login`, {
        email: this.config.email,
        password: this.config.password,
      });
      
      this.session = response.data;
      return this.session;
    } catch (error) {
      console.error('Failed to authenticate with CBS Sports:', error);
      throw error;
    }
  }

  async getHistoryData(): Promise<CBSHistoryData> {
    if (!this.session) {
      await this.authenticate();
    }

    try {
      const response = await axios.get(`${this.baseUrl}/api/history`, {
        headers: {
          Authorization: `Bearer ${this.session.token}`,
        },
      });

      return response.data;
    } catch (error) {
      console.error('Failed to fetch history data:', error);
      throw error;
    }
  }
} 