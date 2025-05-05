const express = require('express');
const cors = require('cors');
const net = require('net');
const xml2js = require('xml2js');
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
    // Use environment variables as described in your documentation
    this.host = process.env.FISHBOWL_HOST || 'localhost';
    this.port = parseInt(process.env.FISHBOWL_PORT) || 28192;
    this.username = process.env.FISHBOWL_USERNAME;
    this.password = process.env.FISHBOWL_PASSWORD;
    this.iaid = process.env.FISHBOWL_IAID || '54321';
    this.sessionToken = null;
    this.userId = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.client = new net.Socket();
      this.client.connect(this.port, this.host, () => {
        console.log('Connected to Fishbowl server');
        resolve();
      });

      this.client.on('error', (error) => {
        console.error('Connection error:', error);
        reject(error);
      });
    });
  }

  async sendRequest(requestXml) {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('Not connected to Fishbowl server'));
        return;
      }

      let responseData = '';
      
      // Set up a temporary data listener for this request
      const dataHandler = (data) => {
        responseData += data.toString();
        // Check if we have received the complete response
        if (responseData.includes('</FbiXml>')) {
          this.client.removeListener('data', dataHandler);
          resolve(responseData);
        }
      };

      this.client.on('data', dataHandler);

      this.client.on('error', (error) => {
        this.client.removeListener('data', dataHandler);
        reject(error);
      });

      // Send the request
      this.client.write(requestXml);
    });
  }

  async login() {
    if (!this.client) {
      await this.connect();
    }

    const loginRequest = {
      FbiXml: {
        $: { version: '1.0' },
        Ticket: {},
        FbiMsgsRq: {
          LoginRq: {
            IAID: this.iaid,
            IAName: 'MCP Fishbowl Server',
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

    if (result.FbiXml && result.FbiXml.FbiMsgsRs && 
        result.FbiXml.FbiMsgsRs[0].LoginRs && 
        result.FbiXml.FbiMsgsRs[0].LoginRs[0].StatusCode &&
        result.FbiXml.FbiMsgsRs[0].LoginRs[0].StatusCode[0] === '1000') {
      
      if (result.FbiXml.Ticket && result.FbiXml.Ticket[0]) {
        this.sessionToken = result.FbiXml.Ticket[0].Key[0];
        this.userId = result.FbiXml.Ticket[0].UserID[0];
        console.log('Successfully logged in to Fishbowl');
        return { success: true, token: this.sessionToken };
      }
    }
    
    // Extract error details if available
    const statusMessage = result.FbiXml && 
                           result.FbiXml.FbiMsgsRs && 
                           result.FbiXml.FbiMsgsRs[0].LoginRs && 
                           result.FbiXml.FbiMsgsRs[0].LoginRs[0].StatusMessage ?
                           result.FbiXml.FbiMsgsRs[0].LoginRs[0].StatusMessage[0] : 'Unknown error';
    
    throw new Error(`Login failed: ${statusMessage}`);
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
        result.FbiXml.FbiMsgsRs[0].PartQuantityRs[0].StatusCode &&
        result.FbiXml.FbiMsgsRs[0].PartQuantityRs[0].StatusCode[0] !== '1000') {
      
      const statusMessage = result.FbiXml.FbiMsgsRs[0].PartQuantityRs[0].StatusMessage ?
                            result.FbiXml.FbiMsgsRs[0].PartQuantityRs[0].StatusMessage[0] : 'Unknown error';
      
      throw new Error(`Failed to get inventory: ${statusMessage}`);
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
            GetAll: true
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
        result.FbiXml.FbiMsgsRs[0].ProductGetRs[0].StatusCode &&
        result.FbiXml.FbiMsgsRs[0].ProductGetRs[0].StatusCode[0] !== '1000') {
      
      const statusMessage = result.FbiXml.FbiMsgsRs[0].ProductGetRs[0].StatusMessage ?
                            result.FbiXml.FbiMsgsRs[0].ProductGetRs[0].StatusMessage[0] : 'Unknown error';
      
      throw new Error(`Failed to get products: ${statusMessage}`);
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
            GetAll: true
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
        result.FbiXml.FbiMsgsRs[0].PartGetRs[0].StatusCode &&
        result.FbiXml.FbiMsgsRs[0].PartGetRs[0].StatusCode[0] !== '1000') {
      
      const statusMessage = result.FbiXml.FbiMsgsRs[0].PartGetRs[0].StatusMessage ?
                            result.FbiXml.FbiMsgsRs[0].PartGetRs[0].StatusMessage[0] : 'Unknown error';
      
      throw new Error(`Failed to get parts: ${statusMessage}`);
    }

    return result;
  }

  async logout() {
    if (!this.sessionToken) {
      return { success: true, message: 'Not logged in' };
    }

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

    try {
      const requestXml = xmlBuilder.buildObject(logoutRequest);
      const response = await this.sendRequest(requestXml);
      const result = await xmlParser.parseStringPromise(response);

      // Reset session data
      this.sessionToken = null;
      this.userId = null;

      return { success: true, message: 'Successfully logged out' };
    } catch (error) {
      console.error('Logout error:', error.message);
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
    }
  }
}

// Create Fishbowl client instance
const fishbowl = new FishbowlClient();

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// MCP endpoint to execute commands
app.post('/mcp/execute', async (req, res) => {
  try {
    const { command, parameters } = req.body;
    
    let result;
    switch (command) {
      case 'getInventory':
        if (!parameters || !parameters.partNumber) {
          throw new Error('Part number is required');
        }
        result = await fishbowl.getInventory(parameters.partNumber);
        break;
      
      case 'getProducts':
        result = await fishbowl.getProducts();
        break;
      
      case 'getParts':
        result = await fishbowl.getParts();
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

// Status endpoint
app.get('/status', async (req, res) => {
  try {
    // Try to login to check if Fishbowl is accessible
    await fishbowl.login();
    await fishbowl.logout();
    
    res.json({
      status: 'connected',
      fishbowlHost: fishbowl.host,
      fishbowlPort: fishbowl.port
    });
  } catch (error) {
    res.status(500).json({
      status: 'disconnected',
      error: error.message,
      fishbowlHost: fishbowl.host,
      fishbowlPort: fishbowl.port
    });
  }
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
