// Helper function to safely validate parameters
const safeValidate = (param, validationFn) => {
  try {
    // Basic validation by type if express-validator isn't available
    if (typeof validationFn !== 'function') {
      return true; // Skip validation if function isn't available
    }
    return validationFn;
  } catch (error) {
    console.warn('Validation error:', error.message);
    return true; // Continue if validation fails
  }
};

// Simple manual validation functions
const isValidId = (id) => {
  const parsedId = parseInt(id, 10);
  return !isNaN(parsedId) && parsedId > 0;
};

const isValidString = (str) => {
  return typeof str === 'string' && str.trim().length > 0;
};

const isValidNumber = (num) => {
  const parsed = parseFloat(num);
  return !isNaN(parsed);
};// We've already loaded the error handler module in the previous block
// ApiError and errorHandler are already defined
// No need to require it again// server.js - Main server file for Fishbowl MCP Server

// Check for required dependencies and handle missing modules gracefully
let express, axios, cors, dotenv, errorHandlerModule, errorHandler, ApiError, fs, path, rateLimit, validator;

try {
  fs = require('fs');
} catch (error) {
  console.error('Failed to load fs module:', error.message);
  process.exit(1);
}

try {
  path = require('path');
} catch (error) {
  console.error('Failed to load path module:', error.message);
  process.exit(1);
}

try {
  express = require('express');
} catch (error) {
  console.error('Failed to load express module:', error.message);
  process.exit(1);
}

try {
  axios = require('axios');
} catch (error) {
  console.error('Failed to load axios module:', error.message);
  process.exit(1);
}

try {
  cors = require('cors');
} catch (error) {
  console.error('Failed to load cors module:', error.message);
  process.exit(1);
}

try {
  dotenv = require('dotenv');
  dotenv.config();
} catch (error) {
  console.error('Failed to load dotenv module:', error.message);
  console.warn('Continuing without environment variable loading. Default values will be used.');
}

// Optional dependencies with fallbacks
try {
  rateLimit = require('express-rate-limit');
  console.log('Loaded express-rate-limit module');
} catch (error) {
  console.warn('express-rate-limit module not found. Rate limiting will be disabled.');
  // Provide a no-op middleware as fallback
  rateLimit = () => (req, res, next) => next();
}

// Proper validation fallbacks
try {
  validator = require('express-validator');
  console.log('Loaded express-validator module');
} catch (error) {
  console.warn('express-validator module not found. Input validation will be disabled.');
  validator = {
    body: () => () => (req, res, next) => next(),
    param: () => () => (req, res, next) => next(),
    query: () => () => (req, res, next) => next(),
    validationResult: req => ({ isEmpty: () => true, array: () => [] })
  };
}

// Optional dependencies with fallbacks
let rateLimit;
try {
  rateLimit = require('express-rate-limit');
} catch (error) {
  console.warn('express-rate-limit module not found. Rate limiting will be disabled.');
  // Provide a no-op middleware as fallback
  rateLimit = () => (req, res, next) => next();
}

// No need to redeclare these variables - they're already declared at the top
const { body, param, query, validationResult } = validator;

// Create a simple error handler file if it doesn't exist
const errorHandlerPath = path.join(__dirname, 'errorHandler.js');
try {
  fs.accessSync(errorHandlerPath, fs.constants.F_OK);
  console.log('Found errorHandler.js file');
  
  // Now try to load the module
  try {
    const loadedModule = require('./errorHandler');
    errorHandler = loadedModule.errorHandler;
    ApiError = loadedModule.ApiError;
    console.log('Successfully loaded errorHandler module');
  } catch (loadError) {
    console.error('Failed to load errorHandler.js module:', loadError.message);
    // Define fallback error handlers
    ApiError = class ApiError extends Error {
      constructor(status, message) {
        super(message);
        this.status = status;
      }
    };
    
    errorHandler = (err, req, res, next) => {
      console.error('Error occurred:', err);
      const status = err.status || 500;
      const message = err.message || 'An unexpected error occurred';
      res.status(status).json({ error: message });
    };
  }
} catch (error) {
  console.warn('errorHandler.js not found, creating a basic version...');
  
  const basicErrorHandler = `// Basic error handler created automatically
class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const errorHandler = (err, req, res, next) => {
  console.error('Error occurred:', err);
  const status = err.status || 500;
  const message = err.message || 'An unexpected error occurred';
  res.status(status).json({ error: message });
};

module.exports = { ApiError, errorHandler };
`;

  try {
    fs.writeFileSync(errorHandlerPath, basicErrorHandler);
    console.log('Created basic errorHandler.js file');
    
    // Define our fallback error handlers
    ApiError = class ApiError extends Error {
      constructor(status, message) {
        super(message);
        this.status = status;
      }
    };
    
    errorHandler = (err, req, res, next) => {
      console.error('Error occurred:', err);
      const status = err.status || 500;
      const message = err.message || 'An unexpected error occurred';
      res.status(status).json({ error: message });
    };
  } catch (writeError) {
    console.error('Failed to create errorHandler.js:', writeError.message);
    
    // Still define our fallback error handlers
    ApiError = class ApiError extends Error {
      constructor(status, message) {
        super(message);
        this.status = status;
      }
    };
    
    errorHandler = (err, req, res, next) => {
      console.error('Error occurred:', err);
      const status = err.status || 500;
      const message = err.message || 'An unexpected error occurred';
      res.status(status).json({ error: message });
    };
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());

// Set up rate limiting - remove any let declaration since we already declared it at the top
const apiLimiter = rateLimit ? rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later'
}) : (req, res, next) => next(); // Fallback if rateLimit is not available

// Apply rate limiting to all requests
app.use('/api/', apiLimiter);

// Authentication token storage and expiration
let fishbowlToken = null;
let tokenExpiration = null;
const TOKEN_REFRESH_THRESHOLD = 10 * 60 * 1000; // 10 minutes before expiration

// Fishbowl API base URL
const FISHBOWL_API_URL = process.env.FISHBOWL_API_URL || 'http://localhost:80';

// Configure Axios defaults for timeouts
axios.defaults.timeout = 30000; // 30 seconds timeout

// Error response helper
const sendErrorResponse = (res, error) => {
  console.error(`Error: ${error.message}`, error.stack);
  const status = error.response?.status || 500;
  const errorMessage = error.response?.data?.error || error.message || 'An unexpected error occurred';
  res.status(status).json({ error: errorMessage });
};

// Input validation middleware - with proper error handling
const validateRequest = (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  } catch (error) {
    console.error('Validation error:', error);
    // Continue with the request even if validation fails
    next();
  }
};

// Login middleware to ensure we have a valid token
const ensureAuthenticated = async (req, res, next) => {
  try {
    // Check if token is missing or close to expiration
    const now = Date.now();
    if (!fishbowlToken || (tokenExpiration && now > tokenExpiration - TOKEN_REFRESH_THRESHOLD)) {
      await login();
    }
    next();
  } catch (error) {
    console.error('Authentication failed:', error.message);
    return res.status(401).json({ error: 'Authentication with Fishbowl failed' });
  }
};

// Login to Fishbowl API
const login = async () => {
  try {
    // Check if required credentials are set
    if (!process.env.FISHBOWL_USERNAME || !process.env.FISHBOWL_PASSWORD) {
      console.error('Missing required environment variables: FISHBOWL_USERNAME and/or FISHBOWL_PASSWORD');
      throw new Error('Missing Fishbowl credentials. Please check your .env file.');
    }
    
    const appName = process.env.FISHBOWL_APP_NAME || "MCP Server";
    let appId;
    
    try {
      appId = parseInt(process.env.FISHBOWL_APP_ID || "101");
      if (isNaN(appId)) {
        throw new Error('Invalid appId');
      }
    } catch (parseError) {
      console.error('Invalid FISHBOWL_APP_ID:', process.env.FISHBOWL_APP_ID);
      appId = 101; // Default value
    }
    
    // Attempt login with timeout
    const response = await axios.post(`${FISHBOWL_API_URL}/api/login`, {
      appName: appName,
      appId: appId,
      username: process.env.FISHBOWL_USERNAME,
      password: process.env.FISHBOWL_PASSWORD
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 second timeout specifically for login
    });

    if (response.data && response.data.token) {
      fishbowlToken = response.data.token;
      
      // Set token expiration time (assuming token is valid for 24 hours)
      // Adjust this based on actual Fishbowl API token lifetime
      tokenExpiration = Date.now() + (24 * 60 * 60 * 1000);
      
      console.log('Successfully authenticated with Fishbowl');
      return true;
    } else {
      console.error('No token received from Fishbowl API');
      throw new Error('Authentication failed - no token received');
    }
  } catch (error) {
    // More detailed error logging
    if (error.response) {
      // The request was made and the server responded with a status code outside of 2xx
      console.error('Login failed with status:', error.response.status);
      console.error('Response data:', error.response.data);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received from Fishbowl API');
      console.error('Request:', error.request);
      
      // Add connectivity check
      try {
        await axios.get(`${FISHBOWL_API_URL}/api/health`, { timeout: 5000 });
        console.error('Fishbowl API is reachable but login failed');
      } catch (connectError) {
        console.error('Cannot connect to Fishbowl API:', connectError.message);
      }
    } else {
      // Something happened in setting up the request that triggered an error
      console.error('Login error:', error.message);
    }
    
    throw error;
  }
};

// Request wrapper with error handling
const makeRequest = async (method, url, options = {}) => {
  try {
    const response = await axios({
      method,
      url: `${FISHBOWL_API_URL}${url}`,
      ...options,
      headers: {
        'Authorization': `Bearer ${fishbowlToken}`,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
    return response.data;
  } catch (error) {
    // Check if error is due to token expiration
    if (error.response && error.response.status === 401) {
      // Try to refresh token and retry the request once
      try {
        await login();
        const retryResponse = await axios({
          method,
          url: `${FISHBOWL_API_URL}${url}`,
          ...options,
          headers: {
            'Authorization': `Bearer ${fishbowlToken}`,
            'Content-Type': 'application/json',
            ...(options.headers || {})
          }
        });
        return retryResponse.data;
      } catch (retryError) {
        throw retryError;
      }
    }
    throw error;
  }
};

// Fishbowl API Routes

// Health check endpoint
app.get('/api/health', (req, res) => {
  const tokenStatus = fishbowlToken ? 'valid' : 'not authenticated';
  const tokenExpiresIn = tokenExpiration ? Math.max(0, Math.floor((tokenExpiration - Date.now()) / 1000)) : 'unknown';
  
  res.json({ 
    status: 'ok', 
    authenticated: !!fishbowlToken,
    tokenStatus,
    tokenExpiresIn: tokenExpiration ? `${tokenExpiresIn} seconds` : 'unknown'
  });
});

// Login endpoint
app.post('/api/login', async (req, res) => {
  try {
    await login();
    res.json({ success: true });
  } catch (error) {
    sendErrorResponse(res, error);
  }
});

// Logout endpoint
app.post('/api/logout', ensureAuthenticated, async (req, res) => {
  try {
    await makeRequest('post', '/api/logout', { data: {} });
    
    fishbowlToken = null;
    tokenExpiration = null;
    res.json({ success: true });
  } catch (error) {
    sendErrorResponse(res, error);
  }
});

// Parts Endpoints

// Get parts inventory - Fixed validation approach
app.get('/api/parts/inventory', ensureAuthenticated, async (req, res) => {
  try {
    const partNumber = req.query.number;
    const data = await makeRequest('get', '/api/parts/inventory', { 
      params: { number: partNumber } 
    });
    
    res.json(data);
  } catch (error) {
    sendErrorResponse(res, error);
  }
});

// Get parts
app.get('/api/parts', ensureAuthenticated, async (req, res) => {
  try {
    const data = await makeRequest('get', '/api/parts/', { 
      params: req.query 
    });
    
    res.json(data);
  } catch (error) {
    sendErrorResponse(res, error);
  }
});

// Get part best cost
app.get('/api/parts/:id/best-cost', ensureAuthenticated, async (req, res) => {
  try {
    const partId = req.params.id;
    
    // Manual validation
    if (!isValidId(partId)) {
      return res.status(400).json({ error: 'Part ID must be a positive integer' });
    }
    
    const data = await makeRequest('get', `/api/parts/${partId}/best-cost`, { 
      params: req.query 
    });
    
    res.json(data);
  } catch (error) {
    sendErrorResponse(res, error);
  }
});

// Add inventory
app.post('/api/parts/:id/inventory/add', ensureAuthenticated, async (req, res) => {
  try {
    const partId = req.params.id;
    
    // Manual validation
    if (!isValidId(partId)) {
      return res.status(400).json({ error: 'Part ID must be a positive integer' });
    }
    
    if (!isValidNumber(req.body.quantity)) {
      return res.status(400).json({ error: 'Quantity must be a number' });
    }
    
    if (!isValidId(req.body.locationId)) {
      return res.status(400).json({ error: 'Location ID must be a positive integer' });
    }
    
    const data = await makeRequest('post', `/api/parts/${partId}/inventory/add`, { 
      data: req.body 
    });
    
    res.json(data);
  } catch (error) {
    sendErrorResponse(res, error);
  }
});

// Cycle inventory
app.post('/api/parts/:id/inventory/cycle', [
  param('id').isInt().withMessage('Part ID must be an integer'),
  body('quantity').isFloat().withMessage('Quantity must be a number'),
  body('locationId').isInt().withMessage('Location ID must be an integer'),
  validateRequest,
  ensureAuthenticated
], async (req, res) => {
  try {
    const partId = req.params.id;
    const data = await makeRequest('post', `/api/parts/${partId}/inventory/cycle`, { 
      data: req.body 
    });
    
    res.json(data);
  } catch (error) {
    sendErrorResponse(res, error);
  }
});

// Scrap inventory
app.post('/api/parts/:id/inventory/scrap', [
  param('id').isInt().withMessage('Part ID must be an integer'),
  body('quantity').isFloat().withMessage('Quantity must be a number'),
  body('locationId').isInt().withMessage('Location ID must be an integer'),
  body('reasonId').optional().isInt().withMessage('Reason ID must be an integer'),
  validateRequest,
  ensureAuthenticated
], async (req, res) => {
  try {
    const partId = req.params.id;
    const data = await makeRequest('post', `/api/parts/${partId}/inventory/scrap`, { 
      data: req.body 
    });
    
    res.json(data);
  } catch (error) {
    sendErrorResponse(res, error);
  }
});

// Purchase Order Endpoints

// Get purchase orders
app.get('/api/purchase-orders', [
  ensureAuthenticated
], async (req, res) => {
  try {
    const data = await makeRequest('get', '/api/purchase-orders', { 
      params: req.query 
    });
    
    res.json(data);
  } catch (error) {
    sendErrorResponse(res, error);
  }
});

// Get purchase order by ID
app.get('/api/purchase-orders/:id', [
  param('id').isInt().withMessage('PO ID must be an integer'),
  validateRequest,
  ensureAuthenticated
], async (req, res) => {
  try {
    const poId = req.params.id;
    const data = await makeRequest('get', `/api/purchase-orders/${poId}`);
    
    res.json(data);
  } catch (error) {
    sendErrorResponse(res, error);
  }
});

// Create purchase order
app.post('/api/purchase-orders', [
  body('vendorId').isInt().withMessage('Vendor ID must be an integer'),
  body('items').isArray().withMessage('Items must be an array'),
  validateRequest,
  ensureAuthenticated
], async (req, res) => {
  try {
    const data = await makeRequest('post', '/api/purchase-orders', { 
      data: req.body 
    });
    
    res.json(data);
  } catch (error) {
    sendErrorResponse(res, error);
  }
});

// Update purchase order
app.post('/api/purchase-orders/:id', [
  param('id').isInt().withMessage('PO ID must be an integer'),
  validateRequest,
  ensureAuthenticated
], async (req, res) => {
  try {
    const poId = req.params.id;
    const data = await makeRequest('post', `/api/purchase-orders/${poId}`, { 
      data: req.body 
    });
    
    res.json(data);
  } catch (error) {
    sendErrorResponse(res, error);
  }
});

// PO Actions
app.post('/api/purchase-orders/:id/:action', [
  param('id').isInt().withMessage('PO ID must be an integer'),
  param('action').isIn(['issue', 'unissue', 'close-short', 'void']).withMessage('Invalid action'),
  validateRequest,
  ensureAuthenticated
], async (req, res) => {
  try {
    const poId = req.params.id;
    const action = req.params.action;
    
    const data = await makeRequest('post', `/api/purchase-orders/${poId}/${action}`, { 
      data: req.body || {} 
    });
    
    res.json(data);
  } catch (error) {
    sendErrorResponse(res, error);
  }
});

// Close Short PO Item
app.post('/api/purchase-orders/:id/close-short/:poItemId', [
  param('id').isInt().withMessage('PO ID must be an integer'),
  param('poItemId').isInt().withMessage('PO Item ID must be an integer'),
  validateRequest,
  ensureAuthenticated
], async (req, res) => {
  try {
    const poId = req.params.id;
    const poItemId = req.params.poItemId;
    
    const data = await makeRequest('post', `/api/purchase-orders/${poId}/close-short/${poItemId}`, { 
      data: req.body || {} 
    });
    
    res.json(data);
  } catch (error) {
    sendErrorResponse(res, error);
  }
});

// Delete purchase order
app.delete('/api/purchase-orders/:id', [
  param('id').isInt().withMessage('PO ID must be an integer'),
  validateRequest,
  ensureAuthenticated
], async (req, res) => {
  try {
    const poId = req.params.id;
    const data = await makeRequest('delete', `/api/purchase-orders/${poId}`);
    
    res.json(data);
  } catch (error) {
    sendErrorResponse(res, error);
  }
});

// Manufacture Order Endpoints

// Get manufacture orders
app.get('/api/manufacture-orders', [
  ensureAuthenticated
], async (req, res) => {
  try {
    const data = await makeRequest('get', '/api/manufacture-orders', { 
      params: req.query 
    });
    
    res.json(data);
  } catch (error) {
    sendErrorResponse(res, error);
  }
});

// Get manufacture order by ID
app.get('/api/manufacture-orders/:id', [
  param('id').isInt().withMessage('MO ID must be an integer'),
  validateRequest,
  ensureAuthenticated
], async (req, res) => {
  try {
    const moId = req.params.id;
    const data = await makeRequest('get', `/api/manufacture-orders/${moId}`);
    
    res.json(data);
  } catch (error) {
    sendErrorResponse(res, error);
  }
});

// Create manufacture order
app.post('/api/manufacture-orders', [
  body('partId').isInt().withMessage('Part ID must be an integer'),
  body('quantity').isFloat().withMessage('Quantity must be a number'),
  validateRequest,
  ensureAuthenticated
], async (req, res) => {
  try {
    const data = await makeRequest('post', '/api/manufacture-orders', { 
      data: req.body 
    });
    
    res.json(data);
  } catch (error) {
    sendErrorResponse(res, error);
  }
});

// MO Actions
app.post('/api/manufacture-orders/:id/:action', [
  param('id').isInt().withMessage('MO ID must be an integer'),
  param('action').isIn(['issue', 'unissue', 'close-short']).withMessage('Invalid action'),
  validateRequest,
  ensureAuthenticated
], async (req, res) => {
  try {
    const moId = req.params.id;
    const action = req.params.action;
    
    const data = await makeRequest('post', `/api/manufacture-orders/${moId}/${action}`, { 
      data: req.body || {} 
    });
    
    res.json(data);
  } catch (error) {
    sendErrorResponse(res, error);
  }
});

// Delete manufacture order
app.delete('/api/manufacture-orders/:id', [
  param('id').isInt().withMessage('MO ID must be an integer'),
  validateRequest,
  ensureAuthenticated
], async (req, res) => {
  try {
    const moId = req.params.id;
    const data = await makeRequest('delete', `/api/manufacture-orders/${moId}`);
    
    res.json(data);
  } catch (error) {
    sendErrorResponse(res, error);
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
      const data = await makeRequest('get', `/api/${type}/${id}/memos`);
      
      res.json(data);
    } catch (error) {
      sendErrorResponse(res, error);
    }
  });
  
  // Get memo by ID
  router.get('/:memoId', [
    param('memoId').isInt().withMessage('Memo ID must be an integer'),
    validateRequest,
    ensureAuthenticated
  ], async (req, res) => {
    try {
      const id = req.params.id;
      const memoId = req.params.memoId;
      const data = await makeRequest('get', `/api/${type}/${id}/memos/${memoId}`);
      
      res.json(data);
    } catch (error) {
      sendErrorResponse(res, error);
    }
  });
  
  // Create memo
  router.post('/', [
    body('text').isString().withMessage('Memo text is required'),
    validateRequest,
    ensureAuthenticated
  ], async (req, res) => {
    try {
      const id = req.params.id;
      const data = await makeRequest('post', `/api/${type}/${id}/memos`, { 
        data: req.body 
      });
      
      res.json(data);
    } catch (error) {
      sendErrorResponse(res, error);
    }
  });
  
  // Update memo
  router.post('/:memoId', [
    param('memoId').isInt().withMessage('Memo ID must be an integer'),
    body('text').isString().withMessage('Memo text is required'),
    validateRequest,
    ensureAuthenticated
  ], async (req, res) => {
    try {
      const id = req.params.id;
      const memoId = req.params.memoId;
      const data = await makeRequest('post', `/api/${type}/${id}/memos/${memoId}`, { 
        data: req.body 
      });
      
      res.json(data);
    } catch (error) {
      sendErrorResponse(res, error);
    }
  });
  
  // Delete memo
  router.delete('/:memoId', [
    param('memoId').isInt().withMessage('Memo ID must be an integer'),
    validateRequest,
    ensureAuthenticated
  ], async (req, res) => {
    try {
      const id = req.params.id;
      const memoId = req.params.memoId;
      const data = await makeRequest('delete', `/api/${type}/${id}/memos/${memoId}`);
      
      res.json(data);
    } catch (error) {
      sendErrorResponse(res, error);
    }
  });
  
  return router;
};

// Apply memo routes
app.use('/api/purchase-orders/:id/memos', [
  param('id').isInt().withMessage('ID must be an integer'),
  validateRequest
], handleMemos('purchase-orders'));

app.use('/api/manufacture-orders/:id/memos', [
  param('id').isInt().withMessage('ID must be an integer'),
  validateRequest
], handleMemos('manufacture-orders'));

// Products Endpoints

// Get product best price
app.get('/api/products/:id/best-price', [
  param('id').isInt().withMessage('Product ID must be an integer'),
  validateRequest,
  ensureAuthenticated
], async (req, res) => {
  try {
    const productId = req.params.id;
    const data = await makeRequest('get', `/api/products/${productId}/best-price`, { 
      params: req.query 
    });
    
    res.json(data);
  } catch (error) {
    sendErrorResponse(res, error);
  }
});

// UOM Endpoints

// Get UOMs
app.get('/api/uoms', [
  ensureAuthenticated
], async (req, res) => {
  try {
    const data = await makeRequest('get', '/api/uoms', { 
      params: req.query 
    });
    
    res.json(data);
  } catch (error) {
    sendErrorResponse(res, error);
  }
});

// Vendor Endpoints

// Get vendors
app.get('/api/vendors', [
  ensureAuthenticated
], async (req, res) => {
  try {
    const data = await makeRequest('get', '/api/vendors', { 
      params: req.query 
    });
    
    res.json(data);
  } catch (error) {
    sendErrorResponse(res, error);
  }
});

// User Endpoints

// Get users
app.get('/api/users', [
  ensureAuthenticated
], async (req, res) => {
  try {
    const data = await makeRequest('get', '/api/users', { 
      params: req.query 
    });
    
    res.json(data);
  } catch (error) {
    sendErrorResponse(res, error);
  }
});

// Add error handling middleware
app.use(errorHandler);

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({ 
    error: 'Not Found', 
    message: `Route ${req.method} ${req.url} not found` 
  });
});

// Start the server
// Process uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT EXCEPTION:', error);
  console.error('Stack trace:', error.stack);
  // Keep the process alive but log the error
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION at:', promise);
  console.error('Reason:', reason);
  // Keep the process alive but log the error
});

// Create a graceful shutdown function
const gracefulShutdown = () => {
  console.log('Shutting down gracefully...');
  
  // Attempt to logout if we have a token
  if (fishbowlToken) {
    axios.post(`${FISHBOWL_API_URL}/api/logout`, {}, {
      headers: {
        'Authorization': `Bearer ${fishbowlToken}`,
        'Content-Type': 'application/json'
      }
    }).catch(() => {
      console.log('Logout failed during shutdown, but continuing shutdown process');
    });
  }
  
  // Exit the process
  process.exit(0);
};

// Listen for termination signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server and handle errors
const server = app.listen(PORT, () => {
  console.log(`MCP Server listening on port ${PORT}`);
  
  // Try to login on startup
  login().catch(err => {
    console.error('Initial login failed:', err.message);
    console.log('Server will attempt to login again when handling requests');
  });
});

// Handle server errors
server.on('error', (error) => {
  console.error('Server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Please choose a different port.`);
    process.exit(1);
  }
});

// Export for testing purposes
module.exports = app;
