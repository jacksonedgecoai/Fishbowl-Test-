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
    this.host = process.env.FISHBOWL_HOST || 'localhost';
    this.port = parseInt(process.env.FISHBOWL_PORT) || 28192;
    this.username = process.env.FISHBOWL_USERNAME;
    this.password = process.env.FISHBOWL_PASSWORD;
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
      
      this.client.on('data', (data) => {
        responseData += data.toString();
        // Check if we have received the complete response
        if (responseData.includes('</FbiXml>')) {
          this.client.removeAllListeners('data');
          resolve(responseData);
        }
      });

      this.client.on('error', (error) => {
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
            IAID: process.env.FISHBOWL_IAID || '54321',
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

    if (result.FbiXml && result.FbiXml.Ticket && result.FbiXml.Ticket[0]) {
      this.sessionToken = result.FbiXml.Ticket[0].Key[0];
      this.userId = result.FbiXml.Ticket[0].UserID[0];
      return { success: true, token: this.sessionToken };
    } else {
      throw new Error('Login failed');
    }
  }

  async getInventory(partNumber) {
    if (!this.sessionToken) {
      await this.login();
    }

    const inventoryRequest = {
      FbiXml: {
        Ticket: {
          Key: this.sessionToken
        },
        FbiMsgsRq: {
          InventoryQtyRq: {
            PartNum: partNumber
          }
        }
      }
    };

    const requestXml = xmlBuilder.buildObject(inventoryRequest);
    const response = await this.sendRequest(requestXml);
    const result = await xmlParser.parseStringPromise(response);

    return result;
  }

  async getProducts() {
    if (!this.sessionToken) {
      await this.login();
    }

    const productsRequest = {
      FbiXml: {
        Ticket: {
          Key: this.sessionToken
        },
        FbiMsgsRq: {
          ProductQueryRq: {
            GetAll: true
          }
        }
      }
    };

    const requestXml = xmlBuilder.buildObject(productsRequest);
    const response = await this.sendRequest(requestXml);
    const result = await xmlParser.parseStringPromise(response);

    return result;
  }

  async getParts() {
    if (!this.sessionToken) {
      await this.login();
    }

    const partsRequest = {
      FbiXml: {
        Ticket: {
          Key: this.sessionToken
        },
        FbiMsgsRq: {
          PartQueryRq: {
            GetAll: true
          }
        }
      }
    };

    const requestXml = xmlBuilder.buildObject(partsRequest);
    const response = await this.sendRequest(requestXml);
    const result = await xmlParser.parseStringPromise(response);

    return result;
  }

  disconnect() {
    if (this.client) {
      this.client.destroy();
      this.client = null;
      this.sessionToken = null;
    }
  }
}

// Create Fishbowl client instance
const fishbowl = new FishbowlClient();

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// MCP endpoint to get inventory for a specific part
app.post('/mcp/execute', async (req, res) => {
  try {
    const { command, parameters } = req.body;
    
    let result;
    switch (command) {
      case 'getInventory':
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

// Additional specific endpoints for easier access
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
    const result = await fishbowl.getProducts();
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
    const result = await fishbowl.getParts();
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
  fishbowl.disconnect();
  process.exit(0);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`MCP Fishbowl Server running on port ${PORT}`);
});
