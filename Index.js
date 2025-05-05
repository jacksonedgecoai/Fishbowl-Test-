const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Basic MCP endpoint
app.post('/mcp/execute', async (req, res) => {
  try {
    const { command, parameters } = req.body;
    
    // Add your MCP logic here
    console.log('Received command:', command);
    console.log('Parameters:', parameters);
    
    // Example response
    res.json({
      success: true,
      result: `Executed command: ${command}`,
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
  console.log(`MCP Server running on port ${PORT}`);
});
