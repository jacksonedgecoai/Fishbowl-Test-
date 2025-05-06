const express = require('express');
const cors = require('cors');
const net = require('net');
const xml2js = require('xml2js');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// XML parser and builder
const xmlParser = new xml2js.Parser();
const xmlBuilder = new xml2js.Builder();

// Fishbowl API Client
class FishbowlClient {
  constructor() {
    // Native Fishbowl API settings
    this.host = process.env.FISHBOWL_HOST || 'localhost';
    this.port = parseInt(process.env.FISHBOWL_PORT) || 28192;
    this.username = process.env.FISHBOWL_USERNAME;
    this.password = process.env.FISHBOWL_PASSWORD;
    this.iaid = process.env.FISHBOWL_IAID || '54321';
    
    // REST API settings (if available)
    this.restApiUrl = process.env.FISHBOWL_REST_API_URL;
    this.appName = process.env.FISHBOWL_APP_NAME || 'MCP Fishbowl Server';
    this.appId = process.env.FISHBOWL_APP_ID || '101';
    
    // Session state
    this.client = null;
    this.sessionToken = null;
    this.userId = null;
    this.restApiToken = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.client = new net.Socket();
      
      this.client.connect(this.port, this.host, () => {
        console.log(`Connected to Fishbowl server at ${this.host}:${this.port}`);
        resolve();
      });

      this.client.on('error', (error) => {
        console.error('Connection error:', error);
        reject(error);
      });
      
      this.client.on('close', () => {
        console.log('Fishbowl connection closed');
        this.client = null;
        this.sessionToken = null;
      });
    });
  }

  async ensureConnected() {
    if (!this.client) {
      await this.connect();
    }
    return this.client;
  }

  async sendRequest(requestXml) {
    await this.ensureConnected();
    
    return new Promise((resolve, reject) => {
      let responseData = '';
      
      // Set up a temporary data handler for this request
      const dataHandler = (data) => {
        responseData += data.toString();
        // Check if we have received the complete response
        if (responseData.includes('</FbiXml>')) {
          this.client.removeListener('data', dataHandler);
          resolve(responseData);
        }
      };

      const errorHandler = (error) => {
        this.client.removeListener('data', dataHandler);
        this.client.removeListener('error', errorHandler);
        reject(error);
      };

      this.client.on('data', dataHandler);
      this.client.on('error', errorHandler);

      // Send the request
      this.client.write(requestXml);
    });
  }

  async login() {
    try {
      await this.ensureConnected();

      const loginRequest = {
        FbiXml: {
          $: { version: '1.0' },
          Ticket: {},
          FbiMsgsRq: {
            LoginRq: {
              IAID: this.iaid,
              IAName: this.appName,
              IADescription: 'MCP Server for Fishbowl Integration',
              UserName: this.username,
              UserPassword: this.password
            }
          }
        }
      };

      const requestXml = xmlBuilder.buildObject(loginRequest);
      const response = await this.sendRequest(requestXml);
      const result = await xmlParser.parseStringPromise(response);

      // Check for errors
      if (result.FbiXml && result.FbiXml.FbiMsgsRs && 
          result.FbiXml.FbiMsgsRs[0].LoginRs && 
          result.FbiXml.FbiMsgsRs[0].LoginRs[0].StatusCode) {
        
        const statusCode = result.FbiXml.FbiMsgsRs[0].LoginRs[0].StatusCode[0];
        
        if (statusCode === '1000') {
          if (result.FbiXml.Ticket && result.FbiXml.Ticket[0]) {
            this.sessionToken = result.FbiXml.Ticket[0].Key ? result.FbiXml.Ticket[0].Key[0] : null;
            this.userId = result.FbiXml.Ticket[0].UserID ? result.FbiXml.Ticket[0].UserID[0] : null;
            console.log('Successfully logged in to Fishbowl');
            return { success: true, token: this.sessionToken, userId: this.userId };
          }
        } else {
          const statusMessage = result.FbiXml.FbiMsgsRs[0].LoginRs[0].StatusMessage ? 
              result.FbiXml.FbiMsgsRs[0].LoginRs[0].StatusMessage[0] : 'Unknown error';
          throw new Error(`Login failed: ${statusCode} - ${statusMessage}`);
        }
      }
      
      throw new Error('Login failed: Unexpected response format');
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async ensureAuthenticated() {
    if (!this.sessionToken) {
      await this.login();
    }
    return this.sessionToken;
  }

  async getInventory(partNumber) {
    await this.ensureAuthenticated();

    const inventoryRequest = {
      FbiXml: {
        Ticket: {
          Key: this.sessionToken
        },
        FbiMsgsRq: {
          PartQuantityRq: {
            PartNum: partNumber
          }
        }
      }
    };

    const requestXml = xmlBuilder.buildObject(inventoryRequest);
    const response = await this.sendRequest(requestXml);
    const result = await xmlParser.parseStringPromise(response);

    // Check for errors
    if (result.FbiXml && result.FbiXml.FbiMsgsRs && 
        result.FbiXml.FbiMsgsRs[0].PartQuantityRs && 
        result.FbiXml.FbiMsgsRs[0].PartQuantityRs[0].StatusCode) {
      
      const statusCode = result.FbiXml.FbiMsgsRs[0].PartQuantityRs[0].StatusCode[0];
      
      if (statusCode !== '1000') {
        const statusMessage = result.FbiXml.FbiMsgsRs[0].PartQuantityRs[0].StatusMessage ? 
            result.FbiXml.FbiMsgsRs[0].PartQuantityRs[0].StatusMessage[0] : 'Unknown error';
        throw new Error(`Failed to get inventory: ${statusCode} - ${statusMessage}`);
      }
    }

    return result;
  }

  async getProducts() {
    await this.ensureAuthenticated();

    const productsRequest = {
      FbiXml: {
        Ticket: {
          Key: this.sessionToken
        },
        FbiMsgsRq: {
          ProductGetRq: {
            GetAll: 'true'
          }
        }
      }
    };

    const requestXml = xmlBuilder.buildObject(productsRequest);
    const response = await this.sendRequest(requestXml);
    const result = await xmlParser.parseStringPromise(response);

    // Check for errors
    if (result.FbiXml && result.FbiXml.FbiMsgsRs && 
        result.FbiXml.FbiMsgsRs[0].ProductGetRs && 
        result.FbiXml.FbiMsgsRs[0].ProductGetRs[0].StatusCode) {
      
      const statusCode = result.FbiXml.FbiMsgsRs[0].ProductGetRs[0].StatusCode[0];
      
      if (statusCode !== '1000') {
        const statusMessage = result.FbiXml.FbiMsgsRs[0].ProductGetRs[0].StatusMessage ? 
            result.FbiXml.FbiMsgsRs[0].ProductGetRs[0].StatusMessage[0] : 'Unknown error';
        throw new Error(`Failed to get products: ${statusCode} - ${statusMessage}`);
      }
    }

    return result;
  }

  async getParts() {
    await this.ensureAuthenticated();

    const partsRequest = {
      FbiXml: {
        Ticket: {
          Key: this.sessionToken
        },
        FbiMsgsRq: {
          PartGetRq: {
            GetAll: 'true'
          }
        }
      }
    };

    const requestXml = xmlBuilder.buildObject(partsRequest);
    const response = await this.sendRequest(requestXml);
    const result = await xmlParser.parseStringPromise(response);

    // Check for errors
    if (result.FbiXml && result.FbiXml.FbiMsgsRs && 
        result.FbiXml.FbiMsgsRs[0].PartGetRs && 
        result.FbiXml.FbiMsgsRs[0].PartGetRs[0].StatusCode) {
      
      const statusCode = result.FbiXml.FbiMsgsRs[0].PartGetRs[0].StatusCode[0];
      
      if (statusCode !== '1000') {
        const statusMessage = result.FbiXml.FbiMsgsRs[0].PartGetRs[0].StatusMessage ? 
            result.FbiXml.FbiMsgsRs[0].PartGetRs[0].StatusMessage[0] : 'Unknown error';
        throw new Error(`Failed to get parts: ${statusCode} - ${statusMessage}`);
      }
    }

    return result;
  }

  // Custom method to add inventory - uses the XML approach
  async addInventory(partId, locationId, quantity, trackingItems = []) {
    await this.ensureAuthenticated();

    const trackingItemsXml = trackingItems.map(item => {
      return {
        TrackingItem: {
          PartTracking: {
            ID: item.partTracking.id
          },
          Value: item.value
        }
      };
    });

    const addInventoryRequest = {
      FbiXml: {
        Ticket: {
          Key: this.sessionToken
        },
        FbiMsgsRq: {
          InventoryAddRq: {
            PartID: partId,
            LocationID: locationId,
            Quantity: quantity,
            TrackingItems: trackingItemsXml
          }
        }
      }
    };

    const requestXml = xmlBuilder.buildObject(addInventoryRequest);
    const response = await this.sendRequest(requestXml);
    const result = await xmlParser.parseStringPromise(response);

    // Check for errors
    if (result.FbiXml && result.FbiXml.FbiMsgsRs && 
        result.FbiXml.FbiMsgsRs[0].InventoryAddRs && 
        result.FbiXml.FbiMsgsRs[0].InventoryAddRs[0].StatusCode) {
      
      const statusCode = result.FbiXml.FbiMsgsRs[0].InventoryAddRs[0].StatusCode[0];
      
      if (statusCode !== '1000') {
        const statusMessage = result.FbiXml.FbiMsgsRs[0].InventoryAddRs[0].StatusMessage ? 
            result.FbiXml.FbiMsgsRs[0].InventoryAddRs[0].StatusMessage[0] : 'Unknown error';
        throw new Error(`Failed to add inventory: ${statusCode} - ${statusMessage}`);
      }
    }

    return result;
  }

  async getManufactureOrders(filters = {}) {
    await this.ensureAuthenticated();

    // Convert filters to XML format
    const filtersObj = {};
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') {
        filtersObj[key] = value;
      }
    }

    const moRequest = {
      FbiXml: {
        Ticket: {
          Key: this.sessionToken
        },
        FbiMsgsRq: {
          ManufactureOrderQueryRq: filtersObj
        }
      }
    };

    const requestXml = xmlBuilder.buildObject(moRequest);
    const response = await this.sendRequest(requestXml);
    const result = await xmlParser.parseStringPromise(response);

    // Check for errors
    if (result.FbiXml && result.FbiXml.FbiMsgsRs && 
        result.FbiXml.FbiMsgsRs[0].ManufactureOrderQueryRs && 
        result.FbiXml.FbiMsgsRs[0].ManufactureOrderQueryRs[0].StatusCode) {
      
      const statusCode = result.FbiXml.FbiMsgsRs[0].ManufactureOrderQueryRs[0].StatusCode[0];
      
      if (statusCode !== '1000') {
        const statusMessage = result.FbiXml.FbiMsgsRs[0].ManufactureOrderQueryRs[0].StatusMessage ? 
            result.FbiXml.FbiMsgsRs[0].ManufactureOrderQueryRs[0].StatusMessage[0] : 'Unknown error';
        throw new Error(`Failed to get manufacture orders: ${statusCode} - ${statusMessage}`);
      }
    }

    return result;
  }

  async getPurchaseOrders(filters = {}) {
    await this.ensureAuthenticated();

    // Convert filters to XML format
    const filtersObj = {};
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') {
        filtersObj[key] = value;
      }
    }

    const poRequest = {
      FbiXml: {
        Ticket: {
          Key: this.sessionToken
        },
        FbiMsgsRq: {
          PurchaseOrderQueryRq: filtersObj
        }
      }
    };

    const requestXml = xmlBuilder.buildObject(poRequest);
    const response = await this.sendRequest(requestXml);
    const result = await xmlParser.parseStringPromise(response);

    // Check for errors
    if (result.FbiXml && result.FbiXml.FbiMsgsRs && 
        result.FbiXml.FbiMsgsRs[0].PurchaseOrderQueryRs && 
        result.FbiXml.FbiMsgsRs[0].PurchaseOrderQueryRs[0].StatusCode) {
      
      const statusCode = result.FbiXml.FbiMsgsRs[0].PurchaseOrderQueryRs[0].StatusCode[0];
      
      if (statusCode !== '1000') {
        const statusMessage = result.FbiXml.FbiMsgsRs[0].PurchaseOrderQueryRs[0].StatusMessage ? 
            result.FbiXml.FbiMsgsRs[0].PurchaseOrderQueryRs[0].StatusMessage[0] : 'Unknown error';
        throw new Error(`Failed to get purchase orders: ${statusCode} - ${statusMessage}`);
      }
    }

    return result;
  }

  async logout() {
    if (!this.sessionToken) {
      return { success: true, message: 'Not logged in' };
    }

    try {
      const logoutRequest = {
        FbiXml: {
          Ticket: {
            Key: this.sessionToken
          },
          FbiMsgsRq: {
            LogoutRq: {}
          }
        }
      };

      const requestXml = xmlBuilder.buildObject(logoutRequest);
      const response = await this.sendRequest(requestXml);
      const result = await xmlParser.parseStringPromise(response);

      // Reset session data
      this.sessionToken = null;
      this.userId = null;

      return { success: true, message: 'Successfully logged out of Fishbowl' };
    } catch (error) {
      console.error('Logout error:', error);
      // Reset session data even if the logout request fails
      this.sessionToken = null;
      this.userId = null;
      return { success: false, error: error.message };
    }
  }

  disconnect() {
    if (this.client) {
      // Attempt to logout if we have a session
      if (this.sessionToken) {
        this.logout().catch(console.error);
      }
      
      this.client.destroy();
      this.client = null;
      this.sessionToken = null;
      this.userId = null;
      console.log('Disconnected from Fishbowl server');
      return { success: true, message: 'Disconnected from Fishbowl server' };
    }
    
    return { success: true, message: 'Not connected to Fishbowl server' };
  }
}

// Create Fishbowl client instance
const fishbowl = new FishbowlClient();

// Root route handler - Add this to fix the "Route GET / not found" error
app.get('/', (req, res) => {
  res.json({
    service: 'MCP Fishbowl Server',
    version: '1.0.0',
    status: 'running',
    documentation: '/docs',
    healthCheck: '/health',
    timestamp: new Date().toISOString()
  });
});

// Documentation route
app.get('/docs', (req, res) => {
  res.json({
    service: 'MCP Fishbowl Server',
    version: '1.0.0',
    description: 'An MCP server for accessing data from Fishbowl Inventory',
    endpoints: [
      { path: '/', method: 'GET', description: 'Service information' },
      { path: '/health', method: 'GET', description: 'Health check endpoint' },
      { path: '/status', method: 'GET', description: 'Connection status to Fishbowl' },
      { path: '/mcp/execute', method: 'POST', description: 'MCP command execution endpoint' },
      { path: '/mcp/inventory/:partNumber', method: 'GET', description: 'Get inventory for a specific part' },
      { path: '/mcp/products', method: 'GET', description: 'Get all products' },
      { path: '/mcp/parts', method: 'GET', description: 'Get all parts' },
      { path: '/mcp/manufacture-orders', method: 'GET', description: 'Search manufacture orders' },
      { path: '/mcp/purchase-orders', method: 'GET', description: 'Search purchase orders' },
      { path: '/mcp/inventory/add', method: 'POST', description: 'Add inventory' }
    ],
    mcp_commands: [
      'getInventory', 'getProducts', 'getParts', 'getManufactureOrders', 
      'getPurchaseOrders', 'addInventory', 'login', 'logout', 'connect', 'disconnect'
    ]
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    service: 'MCP Fishbowl Server'
  });
});

// Status endpoint
app.get('/status', async (req, res) => {
  try {
    const connected = fishbowl.client !== null;
    const authenticated = fishbowl.sessionToken !== null;
    
    res.json({
      status: authenticated ? 'authenticated' : (connected ? 'connected' : 'disconnected'),
      host: fishbowl.host,
      port: fishbowl.port,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      fishbowlHost: fishbowl.host,
      fishbowlPort: fishbowl.port,
      timestamp: new Date().toISOString()
    });
  }
});

// MCP endpoint to execute commands
app.post('/mcp/execute', async (req, res) => {
  try {
    const { command, parameters } = req.body;
    
    let result;
    switch (command) {
      case 'getInventory':
        if (!parameters || !parameters.partNumber) {
          throw new Error('Part number is required for inventory lookup');
        }
        result = await fishbowl.getInventory(parameters.partNumber);
        break;
      
      case 'getProducts':
        result = await fishbowl.getProducts();
        break;
      
      case 'getParts':
        result = await fishbowl.getParts();
        break;
        
      case 'getManufactureOrders':
        result = await fishbowl.getManufactureOrders(parameters || {});
        break;
        
      case 'getPurchaseOrders':
        result = await fishbowl.getPurchaseOrders(parameters || {});
        break;
        
      case 'addInventory':
        if (!parameters || !parameters.partId || !parameters.locationId || parameters.quantity === undefined) {
          throw new Error('partId, locationId, and quantity are required to add inventory');
        }
        result = await fishbowl.addInventory(
          parameters.partId, 
          parameters.locationId, 
          parameters.quantity, 
          parameters.trackingItems || []
        );
        break;
      
      case 'login':
        result = await fishbowl.login();
        break;
        
      case 'logout':
        result = await fishbowl.logout();
        break;
        
      case 'connect':
        result = await fishbowl.connect();
        break;
        
      case 'disconnect':
        result = fishbowl.disconnect();
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
    console.error('Error executing command:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Additional specific endpoints for easier access
app.get('/mcp/inventory/:partNumber', async (req, res) => {
  try {
    const result = await fishbowl.getInventory(req.params.partNumber);
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting inventory:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/mcp/products', async (req, res) => {
  try {
    const result = await fishbowl.getProducts();
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting products:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/mcp/parts', async (req, res) => {
  try {
    const result = await fishbowl.getParts();
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting parts:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/mcp/manufacture-orders', async (req, res) => {
  try {
    const result = await fishbowl.getManufactureOrders(req.query);
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting manufacture orders:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/mcp/purchase-orders', async (req, res) => {
  try {
    const result = await fishbowl.getPurchaseOrders(req.query);
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting purchase orders:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Add inventory endpoint
app.post('/mcp/inventory/add', async (req, res) => {
  try {
    const { partId, locationId, quantity, trackingItems } = req.body;
    
    if (!partId || !locationId || quantity === undefined) {
      throw new Error('partId, locationId, and quantity are required to add inventory');
    }
    
    const result = await fishbowl.addInventory(partId, locationId, quantity, trackingItems || []);
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error adding inventory:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Catch-all route for 404 errors
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  fishbowl.disconnect();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  fishbowl.disconnect();
  process.exit(0);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`MCP Fishbowl Server running on port ${PORT}`);
  console.log(`Configured to connect to Fishbowl at ${fishbowl.host}:${fishbowl.port}`);
});
