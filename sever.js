// server.js - Main server file for Fishbowl MCP Server

const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());

// Authentication token storage
let fishbowlToken = null;

// Fishbowl API base URL
const FISHBOWL_API_URL = process.env.FISHBOWL_API_URL || 'http://localhost:80';

// Login middleware to ensure we have a valid token
const ensureAuthenticated = async (req, res, next) => {
  if (!fishbowlToken) {
    try {
      await login();
      next();
    } catch (error) {
      console.error('Authentication failed:', error.message);
      return res.status(401).json({ error: 'Authentication with Fishbowl failed' });
    }
  } else {
    next();
  }
};

// Login to Fishbowl API
const login = async () => {
  try {
    const response = await axios.post(`${FISHBOWL_API_URL}/api/login`, {
      appName: process.env.FISHBOWL_APP_NAME || "MCP Server",
      appId: parseInt(process.env.FISHBOWL_APP_ID || "101"),
      username: process.env.FISHBOWL_USERNAME,
      password: process.env.FISHBOWL_PASSWORD
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.data && response.data.token) {
      fishbowlToken = response.data.token;
      console.log('Successfully authenticated with Fishbowl');
      return true;
    } else {
      console.error('No token received from Fishbowl API');
      return false;
    }
  } catch (error) {
    console.error('Login error:', error.message);
    throw error;
  }
};

// Fishbowl API Routes

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', authenticated: !!fishbowlToken });
});

// Login endpoint
app.post('/api/login', async (req, res) => {
  try {
    await login();
    res.json({ success: true });
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
  }
});

// Logout endpoint
app.post('/api/logout', ensureAuthenticated, async (req, res) => {
  try {
    await axios.post(`${FISHBOWL_API_URL}/api/logout`, {}, {
      headers: {
        'Authorization': `Bearer ${fishbowlToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    fishbowlToken = null;
    res.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error.message);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

// Parts Endpoints

// Get parts inventory
app.get('/api/parts/inventory', ensureAuthenticated, async (req, res) => {
  try {
    const partNumber = req.query.number;
    const response = await axios.get(`${FISHBOWL_API_URL}/api/parts/inventory`, {
      params: { number: partNumber },
      headers: {
        'Authorization': `Bearer ${fishbowlToken}`
      }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching part inventory:', error.message);
    res.status(500).json({ error: 'Failed to fetch part inventory' });
  }
});

// Get parts
app.get('/api/parts', ensureAuthenticated, async (req, res) => {
  try {
    const response = await axios.get(`${FISHBOWL_API_URL}/api/parts/`, {
      params: req.query,
      headers: {
        'Authorization': `Bearer ${fishbowlToken}`
      }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching parts:', error.message);
    res.status(500).json({ error: 'Failed to fetch parts' });
  }
});

// Get part best cost
app.get('/api/parts/:id/best-cost', ensureAuthenticated, async (req, res) => {
  try {
    const partId = req.params.id;
    const response = await axios.get(`${FISHBOWL_API_URL}/api/parts/${partId}/best-cost`, {
      params: req.query,
      headers: {
        'Authorization': `Bearer ${fishbowlToken}`
      }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching part best cost:', error.message);
    res.status(500).json({ error: 'Failed to fetch part best cost' });
  }
});

// Add inventory
app.post('/api/parts/:id/inventory/add', ensureAuthenticated, async (req, res) => {
  try {
    const partId = req.params.id;
    const response = await axios.post(`${FISHBOWL_API_URL}/api/parts/${partId}/inventory/add`, 
      req.body,
      {
        headers: {
          'Authorization': `Bearer ${fishbowlToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    res.json(response.data);
  } catch (error) {
    console.error('Error adding inventory:', error.message);
    res.status(500).json({ error: 'Failed to add inventory' });
  }
});

// Cycle inventory
app.post('/api/parts/:id/inventory/cycle', ensureAuthenticated, async (req, res) => {
  try {
    const partId = req.params.id;
    const response = await axios.post(`${FISHBOWL_API_URL}/api/parts/${partId}/inventory/cycle`, 
      req.body,
      {
        headers: {
          'Authorization': `Bearer ${fishbowlToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    res.json(response.data);
  } catch (error) {
    console.error('Error cycling inventory:', error.message);
    res.status(500).json({ error: 'Failed to cycle inventory' });
  }
});

// Scrap inventory
app.post('/api/parts/:id/inventory/scrap', ensureAuthenticated, async (req, res) => {
  try {
    const partId = req.params.id;
    const response = await axios.post(`${FISHBOWL_API_URL}/api/parts/${partId}/inventory/scrap`, 
      req.body,
      {
        headers: {
          'Authorization': `Bearer ${fishbowlToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    res.json(response.data);
  } catch (error) {
    console.error('Error scrapping inventory:', error.message);
    res.status(500).json({ error: 'Failed to scrap inventory' });
  }
});

// Purchase Order Endpoints

// Get purchase orders
app.get('/api/purchase-orders', ensureAuthenticated, async (req, res) => {
  try {
    const response = await axios.get(`${FISHBOWL_API_URL}/api/purchase-orders`, {
      params: req.query,
      headers: {
        'Authorization': `Bearer ${fishbowlToken}`
      }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching purchase orders:', error.message);
    res.status(500).json({ error: 'Failed to fetch purchase orders' });
  }
});

// Get purchase order by ID
app.get('/api/purchase-orders/:id', ensureAuthenticated, async (req, res) => {
  try {
    const poId = req.params.id;
    const response = await axios.get(`${FISHBOWL_API_URL}/api/purchase-orders/${poId}`, {
      headers: {
        'Authorization': `Bearer ${fishbowlToken}`
      }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching purchase order:', error.message);
    res.status(500).json({ error: 'Failed to fetch purchase order' });
  }
});

// Create purchase order
app.post('/api/purchase-orders', ensureAuthenticated, async (req, res) => {
  try {
    const response = await axios.post(`${FISHBOWL_API_URL}/api/purchase-orders`, 
      req.body,
      {
        headers: {
          'Authorization': `Bearer ${fishbowlToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    res.json(response.data);
  } catch (error) {
    console.error('Error creating purchase order:', error.message);
    res.status(500).json({ error: 'Failed to create purchase order' });
  }
});

// Update purchase order
app.post('/api/purchase-orders/:id', ensureAuthenticated, async (req, res) => {
  try {
    const poId = req.params.id;
    const response = await axios.post(`${FISHBOWL_API_URL}/api/purchase-orders/${poId}`, 
      req.body,
      {
        headers: {
          'Authorization': `Bearer ${fishbowlToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    res.json(response.data);
  } catch (error) {
    console.error('Error updating purchase order:', error.message);
    res.status(500).json({ error: 'Failed to update purchase order' });
  }
});

// PO Actions
app.post('/api/purchase-orders/:id/:action', ensureAuthenticated, async (req, res) => {
  try {
    const poId = req.params.id;
    const action = req.params.action;
    const validActions = ['issue', 'unissue', 'close-short', 'void'];
    
    if (!validActions.includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }
    
    const response = await axios.post(`${FISHBOWL_API_URL}/api/purchase-orders/${poId}/${action}`, 
      req.body || {},
      {
        headers: {
          'Authorization': `Bearer ${fishbowlToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    res.json(response.data);
  } catch (error) {
    console.error(`Error performing action ${req.params.action}:`, error.message);
    res.status(500).json({ error: `Failed to perform action ${req.params.action}` });
  }
});

// Close Short PO Item
app.post('/api/purchase-orders/:id/close-short/:poItemId', ensureAuthenticated, async (req, res) => {
  try {
    const poId = req.params.id;
    const poItemId = req.params.poItemId;
    
    const response = await axios.post(`${FISHBOWL_API_URL}/api/purchase-orders/${poId}/close-short/${poItemId}`, 
      req.body || {},
      {
        headers: {
          'Authorization': `Bearer ${fishbowlToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    res.json(response.data);
  } catch (error) {
    console.error('Error closing PO item short:', error.message);
    res.status(500).json({ error: 'Failed to close PO item short' });
  }
});

// Delete purchase order
app.delete('/api/purchase-orders/:id', ensureAuthenticated, async (req, res) => {
  try {
    const poId = req.params.id;
    const response = await axios.delete(`${FISHBOWL_API_URL}/api/purchase-orders/${poId}`, {
      headers: {
        'Authorization': `Bearer ${fishbowlToken}`
      }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Error deleting purchase order:', error.message);
    res.status(500).json({ error: 'Failed to delete purchase order' });
  }
});

// Manufacture Order Endpoints

// Get manufacture orders
app.get('/api/manufacture-orders', ensureAuthenticated, async (req, res) => {
  try {
    const response = await axios.get(`${FISHBOWL_API_URL}/api/manufacture-orders`, {
      params: req.query,
      headers: {
        'Authorization': `Bearer ${fishbowlToken}`
      }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching manufacture orders:', error.message);
    res.status(500).json({ error: 'Failed to fetch manufacture orders' });
  }
});

// Get manufacture order by ID
app.get('/api/manufacture-orders/:id', ensureAuthenticated, async (req, res) => {
  try {
    const moId = req.params.id;
    const response = await axios.get(`${FISHBOWL_API_URL}/api/manufacture-orders/${moId}`, {
      headers: {
        'Authorization': `Bearer ${fishbowlToken}`
      }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching manufacture order:', error.message);
    res.status(500).json({ error: 'Failed to fetch manufacture order' });
  }
});

// Create manufacture order
app.post('/api/manufacture-orders', ensureAuthenticated, async (req, res) => {
  try {
    const response = await axios.post(`${FISHBOWL_API_URL}/api/manufacture-orders`, 
      req.body,
      {
        headers: {
          'Authorization': `Bearer ${fishbowlToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    res.json(response.data);
  } catch (error) {
    console.error('Error creating manufacture order:', error.message);
    res.status(500).json({ error: 'Failed to create manufacture order' });
  }
});

// MO Actions
app.post('/api/manufacture-orders/:id/:action', ensureAuthenticated, async (req, res) => {
  try {
    const moId = req.params.id;
    const action = req.params.action;
    const validActions = ['issue', 'unissue', 'close-short'];
    
    if (!validActions.includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }
    
    const response = await axios.post(`${FISHBOWL_API_URL}/api/manufacture-orders/${moId}/${action}`, 
      req.body || {},
      {
        headers: {
          'Authorization': `Bearer ${fishbowlToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    res.json(response.data);
  } catch (error) {
    console.error(`Error performing action ${req.params.action}:`, error.message);
    res.status(500).json({ error: `Failed to perform action ${req.params.action}` });
  }
});

// Delete manufacture order
app.delete('/api/manufacture-orders/:id', ensureAuthenticated, async (req, res) => {
  try {
    const moId = req.params.id;
    const response = await axios.delete(`${FISHBOWL_API_URL}/api/manufacture-orders/${moId}`, {
      headers: {
        'Authorization': `Bearer ${fishbowlToken}`
      }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Error deleting manufacture order:', error.message);
    res.status(500).json({ error: 'Failed to delete manufacture order' });
  }
});

// Memo Endpoints for MO and PO

// Generic Memo Handler
const handleMemos = (type) => {
  const router = express.Router({ mergeParams: true });
  
  // Get memos
  router.get('/', ensureAuthenticated, async (req, res) => {
    try {
      const id = req.params.id;
      const response = await axios.get(`${FISHBOWL_API_URL}/api/${type}/${id}/memos`, {
        headers: {
          'Authorization': `Bearer ${fishbowlToken}`
        }
      });
      
      res.json(response.data);
    } catch (error) {
      console.error(`Error fetching ${type} memos:`, error.message);
      res.status(500).json({ error: `Failed to fetch ${type} memos` });
    }
  });
  
  // Get memo by ID
  router.get('/:memoId', ensureAuthenticated, async (req, res) => {
    try {
      const id = req.params.id;
      const memoId = req.params.memoId;
      const response = await axios.get(`${FISHBOWL_API_URL}/api/${type}/${id}/memos/${memoId}`, {
        headers: {
          'Authorization': `Bearer ${fishbowlToken}`
        }
      });
      
      res.json(response.data);
    } catch (error) {
      console.error(`Error fetching ${type} memo:`, error.message);
      res.status(500).json({ error: `Failed to fetch ${type} memo` });
    }
  });
  
  // Create memo
  router.post('/', ensureAuthenticated, async (req, res) => {
    try {
      const id = req.params.id;
      const response = await axios.post(`${FISHBOWL_API_URL}/api/${type}/${id}/memos`, 
        req.body,
        {
          headers: {
            'Authorization': `Bearer ${fishbowlToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      res.json(response.data);
    } catch (error) {
      console.error(`Error creating ${type} memo:`, error.message);
      res.status(500).json({ error: `Failed to create ${type} memo` });
    }
  });
  
  // Update memo
  router.post('/:memoId', ensureAuthenticated, async (req, res) => {
    try {
      const id = req.params.id;
      const memoId = req.params.memoId;
      const response = await axios.post(`${FISHBOWL_API_URL}/api/${type}/${id}/memos/${memoId}`, 
        req.body,
        {
          headers: {
            'Authorization': `Bearer ${fishbowlToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      res.json(response.data);
    } catch (error) {
      console.error(`Error updating ${type} memo:`, error.message);
      res.status(500).json({ error: `Failed to update ${type} memo` });
    }
  });
  
  // Delete memo
  router.delete('/:memoId', ensureAuthenticated, async (req, res) => {
    try {
      const id = req.params.id;
      const memoId = req.params.memoId;
      const response = await axios.delete(`${FISHBOWL_API_URL}/api/${type}/${id}/memos/${memoId}`, {
        headers: {
          'Authorization': `Bearer ${fishbowlToken}`
        }
      });
      
      res.json(response.data);
    } catch (error) {
      console.error(`Error deleting ${type} memo:`, error.message);
      res.status(500).json({ error: `Failed to delete ${type} memo` });
    }
  });
  
  return router;
};

// Apply memo routes
app.use('/api/purchase-orders/:id/memos', handleMemos('purchase-orders'));
app.use('/api/manufacture-orders/:id/memos', handleMemos('manufacture-orders'));

// Products Endpoints

// Get product best price
app.get('/api/products/:id/best-price', ensureAuthenticated, async (req, res) => {
  try {
    const productId = req.params.id;
    const response = await axios.get(`${FISHBOWL_API_URL}/api/products/${productId}/best-price`, {
      params: req.query,
      headers: {
        'Authorization': `Bearer ${fishbowlToken}`
      }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching product best price:', error.message);
    res.status(500).json({ error: 'Failed to fetch product best price' });
  }
});

// UOM Endpoints

// Get UOMs
app.get('/api/uoms', ensureAuthenticated, async (req, res) => {
  try {
    const response = await axios.get(`${FISHBOWL_API_URL}/api/uoms`, {
      params: req.query,
      headers: {
        'Authorization': `Bearer ${fishbowlToken}`
      }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching UOMs:', error.message);
    res.status(500).json({ error: 'Failed to fetch UOMs' });
  }
});

// Vendor Endpoints

// Get vendors
app.get('/api/vendors', ensureAuthenticated, async (req, res) => {
  try {
    const response = await axios.get(`${FISHBOWL_API_URL}/api/vendors`, {
      params: req.query,
      headers: {
        'Authorization': `Bearer ${fishbowlToken}`
      }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching vendors:', error.message);
    res.status(500).json({ error: 'Failed to fetch vendors' });
  }
});

// User Endpoints

// Get users
app.get('/api/users', ensureAuthenticated, async (req, res) => {
  try {
    const response = await axios.get(`${FISHBOWL_API_URL}/api/users`, {
      params: req.query,
      headers: {
        'Authorization': `Bearer ${fishbowlToken}`
      }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching users:', error.message);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`MCP Server listening on port ${PORT}`);
  
  // Try to login on startup
  login().catch(err => {
    console.error('Initial login failed:', err.message);
  });
});
