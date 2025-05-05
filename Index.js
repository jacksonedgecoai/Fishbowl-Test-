const express = require('express');
const cors = require('cors');
const axios = require('axios');
const xml2js = require('xml2js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// XML parser
const xmlParser = new xml2js.Parser();
const xmlBuilder = new xml2js.Builder();

// Fishbowl connection class
class FishbowlClient {
  constructor() {
    this.baseUrl = process.env.FISHBOWL_URL || 'http://localhost:28192';
    this.username = process.env.FISHBOWL_USERNAME;
    this.password = process.env.FISHBOWL_PASSWORD;
    this.token = null;
  }

  async login() {
    const loginXml = xmlBuilder.buildObject({
      FbiXml: {
        Ticket: {},
        FbiMsgsRq: {
          LoginRq: {
            IAID: process.env.FISHBOWL_IAID || "MCP-Server",
            IAName: "MCP Integration Server",
            IADescription: "MCP Server for Fishbowl Integration",
            UserName: this.username,
            UserPassword: this.password
          }
        }
      }
    });

    try {
      const response = await axios.post(this.baseUrl, loginXml, {
        headers: { 'Content-Type': 'application/xml' }
      });
      
      const result = await xmlParser.parseStringPromise(response.data);
      this.token = result.FbiXml.Ticket[0].Key[0];
      return this.token;
    } catch (error) {
      console.error('Login failed:', error.message);
      throw error;
    }
  }

  async executeQuery(query) {
    if (!this.token) {
      await this.login();
    }

    const queryXml = xmlBuilder.buildObject({
      FbiXml: {
        Ticket: {
          Key: this.token
        },
        FbiMsgsRq: {
          ExecuteQueryRq: {
            Query: query
          }
        }
      }
    });

    try {
      const response = await axios.post(this.baseUrl, queryXml, {
        headers: { 'Content-Type': 'application/xml' }
      });
      
      const result = await xmlParser.parseStringPromise(response.data);
      return result;
    } catch (error) {
      console.error('Query execution failed:', error.message);
      throw error;
    }
  }

  async getInventory(partNumber) {
    if (!this.token) {
      await this.login();
    }

    const inventoryXml = xmlBuilder.buildObject({
      FbiXml: {
        Ticket: {
          Key: this.token
        },
        FbiMsgsRq: {
          InventoryQueryRq: {
            PartNum: partNumber || ""
          }
        }
      }
    });

    try {
      const response = await axios.post(this.baseUrl, inventoryXml, {
        headers: { 'Content-Type': 'application/xml' }
      });
      
      const result = await xmlParser.parseStringPromise(response.data);
      return result;
    } catch (error) {
      console.error('Inventory query failed:', error.message);
      throw error;
    }
  }
}

// Create Fishbowl client instance
const fishbowl = new FishbowlClient();

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Login to Fishbowl
app.post('/mcp/login', async (req, res) => {
  try {
    const token = await fishbowl.login();
    res.json({
      success: true,
      message: 'Successfully logged in to Fishbowl',
      token: token
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get inventory data
app.post('/mcp/inventory', async (req, res) => {
  try {
    const { partNumber } = req.body;
    const result = await fishbowl.getInventory(partNumber);
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

// Execute custom Fishbowl query
app.post('/mcp/query', async (req, res) => {
  try {
    const { query } = req.body;
    const result = await fishbowl.executeQuery(query);
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

// Execute MCP commands
app.post('/mcp/execute', async (req, res) => {
  try {
    const { command, parameters } = req.body;
    
    let result;
    switch (command) {
      case 'getInventory':
        result = await fishbowl.getInventory(parameters.partNumber);
        break;
      case 'executeQuery':
        result = await fishbowl.executeQuery(parameters.query);
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

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`MCP Fishbowl Server running on port ${PORT}`);
});
