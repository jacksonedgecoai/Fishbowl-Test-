const express = require('express');
const cors = require('cors');
const axios = require('axios'); // For making HTTP requests
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Fishbowl REST API Client
class FishbowlClient {
  constructor() {
    this.baseUrl = process.env.FISHBOWL_API_URL || 'http://localhost:80';
    this.username = process.env.FISHBOWL_USERNAME || 'admin';
    this.password = process.env.FISHBOWL_PASSWORD || 'admin';
    this.appName = process.env.FISHBOWL_APP_NAME || 'MCP Fishbowl Server';
    this.appId = process.env.FISHBOWL_APP_ID || '101';
    this.token = null;
  }

  async login() {
    try {
      const response = await axios.post(`${this.baseUrl}/api/login`, {
        appName: this.appName,
        appId: this.appId,
        username: this.username,
        password: this.password
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.data && response.data.token) {
        this.token = response.data.token;
        console.log('Successfully logged in to Fishbowl API');
        return { success: true, token: this.token };
      } else {
        throw new Error('Login failed: No token received');
      }
    } catch (error) {
      console.error('Login error:', error.message);
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  async ensureAuthenticated() {
    if (!this.token) {
      await this.login();
    }
    return this.token;
  }

  getAuthHeaders() {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    };
  }

  async getInventory(partNumber) {
    await this.ensureAuthenticated();
    
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/parts/inventory?number=${encodeURIComponent(partNumber)}`,
        { headers: this.getAuthHeaders() }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error getting inventory:', error.message);
      throw new Error(`Failed to get inventory: ${error.message}`);
    }
  }

  async getParts(options = {}) {
    await this.ensureAuthenticated();
    
    try {
      // Build query parameters from options
      const queryParams = new URLSearchParams();
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value);
        }
      });
      
      const url = `${this.baseUrl}/api/parts/?${queryParams.toString()}`;
      const response = await axios.get(url, { headers: this.getAuthHeaders() });
      
      return response.data;
    } catch (error) {
      console.error('Error getting parts:', error.message);
      throw new Error(`Failed to get parts: ${error.message}`);
    }
  }

  async getProducts(options = {}) {
    await this.ensureAuthenticated();
    
    try {
      // Products endpoint isn't directly shown in the collection
      // Assuming a similar structure to parts endpoint
      const queryParams = new URLSearchParams();
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value);
        }
      });
      
      const url = `${this.baseUrl}/api/products/?${queryParams.toString()}`;
      const response = await axios.get(url, { headers: this.getAuthHeaders() });
      
      return response.data;
    } catch (error) {
      console.error('Error getting products:', error.message);
      throw new Error(`Failed to get products: ${error.message}`);
    }
  }

  async getManufactureOrders(options = {}) {
    await this.ensureAuthenticated();
    
    try {
      const queryParams = new URLSearchParams();
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value);
        }
      });
      
      const url = `${this.baseUrl}/api/manufacture-orders?${queryParams.toString()}`;
      const response = await axios.get(url, { headers: this.getAuthHeaders() });
      
      return response.data;
    } catch (error) {
      console.error('Error getting manufacture orders:', error.message);
      throw new Error(`Failed to get manufacture orders: ${error.message}`);
    }
  }

  async getPurchaseOrders(options = {}) {
    await this.ensureAuthenticated();
    
    try {
      const queryParams = new URLSearchParams();
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value);
        }
      });
      
      const url = `${this.baseUrl}/api/purchase-orders?${queryParams.toString()}`;
      const response = await axios.get(url, { headers: this.getAuthHeaders() });
      
      return response.data;
    } catch (error) {
      console.error('Error getting purchase orders:', error.message);
      throw new Error(`Failed to get purchase orders: ${error.message}`);
    }
  }

  async addInventory(partId, data) {
    await this.ensureAuthenticated();
    
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/parts/${partId}/inventory/add`,
        data,
        { headers: this.getAuthHeaders() }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error adding inventory:', error.message);
      throw new Error(`Failed to add inventory: ${error.message}`);
    }
  }

  async logout() {
    if (!this.token) {
      return { success: true, message: 'Already logged out' };
    }
    
    try {
      await axios.post(
        `${this.baseUrl}/api/logout`,
        {
          appName: this.appName,
          appDescription: "MCP Fishbowl Integration",
          appId: this.appId,
          username: this.username,
          password: this.password,
          passwordEncrypted: "false"
        },
        { 
          headers: this.getAuthHeaders() 
        }
      );
      
      this.token = null;
      return { success: true, message: 'Successfully logged out' };
    } catch (error) {
      console.error('Logout error:', error.message);
      throw new Error(`Logout failed: ${error.message}`);
    }
  }
}

// Create Fishbowl client instance
const fishbowl = new FishbowlClient();

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// MCP endpoint for execute commands
app.post('/mcp/execute', async (req, res) => {
  try {
    const { command, parameters } = req.body;
    
    let result;
    switch (command) {
      case 'getInventory':
        result = await fishbowl.getInventory(parameters.partNumber);
        break;
      
      case 'getProducts':
        result = await fishbowl.getProducts(parameters);
        break;
      
      case 'getParts':
        result = await fishbowl.getParts(parameters);
        break;
      
      case 'getManufactureOrders':
        result = await fishbowl.getManufactureOrders(parameters);
        break;
        
      case 'getPurchaseOrders':
        result = await fishbowl.getPurchaseOrders(parameters);
        break;
        
      case 'addInventory':
        result = await fishbowl.addInventory(parameters.partId, parameters.data);
        break;
      
      case 'login':
        result = await fishbowl.login();
        break;
        
      case 'logout':
        result = await fishbowl.logout();
        break;
      
      default:
        throw new Error(`Unknown command: ${command}`);
    }
    
    res.json({
      success: true,
      result: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Specific endpoints for easier access
app.get('/mcp/inventory/:partNumber', async (req, res) => {
  try {
    const result = await fishbowl.getInventory(req.params.partNumber);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/mcp/products', async (req, res) => {
  try {
    const result = await fishbowl.getProducts(req.query);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/mcp/parts', async (req, res) => {
  try {
    const result = await fishbowl.getParts(req.query);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/mcp/manufacture-orders', async (req, res) => {
  try {
    const result = await fishbowl.getManufactureOrders(req.query);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/mcp/purchase-orders', async (req, res) => {
  try {
    const result = await fishbowl.getPurchaseOrders(req.query);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  fishbowl.logout().catch(console.error);
  process.exit(0);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`MCP Fishbowl Server running on port ${PORT}`);
});
