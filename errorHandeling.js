// errorHandler.js - Error handling middleware

/**
 * Custom error class for API errors
 */
class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.name = 'ApiError';
  }
}

/**
 * Error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  console.error('Error occurred:', err);
  
  // Check if error came from Axios
  if (err.isAxiosError) {
    const statusCode = err.response?.status || 500;
    const message = err.response?.data?.message || 'Error communicating with Fishbowl API';
    const details = err.response?.data || null;
    
    return res.status(statusCode).json({
      error: message,
      details,
      statusCode
    });
  }
  
  // Handle custom API errors
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: err.message,
      details: err.details,
      statusCode: err.statusCode
    });
  }
  
  // Handle generic errors
  return res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    statusCode: 500
  });
};

module.exports = {
  ApiError,
  errorHandler
};
