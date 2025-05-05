# Fishbowl MCP Server

A middleware server for integrating with Fishbowl Inventory API.

## Overview

This MCP (Message Control Program) server provides a RESTful API that communicates with your Fishbowl Inventory software. It handles authentication, token management, and proxies all requests to the Fishbowl API.

## Features

- Automatic authentication with Fishbowl API
- Simplified API access to Fishbowl functionality
- Support for parts, inventory, purchase orders, and manufacture orders
- Memo management for POs and MOs
- Vendor, UOM, user, and product endpoints

## Prerequisites

- Node.js 18 or higher
- Fishbowl Inventory software with API access
- Access credentials for Fishbowl

## Local Development Setup

1. Clone this repository:
   ```
   git clone https://your-repo-url/fishbowl-mcp-server.git
   cd fishbowl-mcp-server
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file based on the template:
   ```
   cp .env.template .env
   ```

4. Edit the `.env` file with your Fishbowl credentials and API URL.

5. Start the development server:
   ```
   npm run dev
   ```

## Deploying to Railway

1. Create a Railway account at [railway.app](https://railway.app) if you don't have one.

2. Install the Railway CLI:
   ```
   npm i -g @railway/cli
   ```

3. Login to Railway:
   ```
   railway login
   ```

4. Initialize your project:
   ```
   railway init
   ```

5. Add your environment variables:
   ```
   railway variables set FISHBOWL_API_URL=http://your-fishbowl-server-address:port
   railway variables set FISHBOWL_APP_NAME="MCP Server"
   railway variables set FISHBOWL_APP_ID=101
   railway variables set FISHBOWL_USERNAME=your-username
   railway variables set FISHBOWL_PASSWORD=your-password
   ```

6. Deploy your application:
   ```
   railway up
   ```

7. Open your deployed application:
   ```
   railway open
   ```

## API Endpoints

### Authentication

- `POST /api/login` - Log in to Fishbowl API
- `POST /api/logout` - Log out from Fishbowl API

### Parts & Inventory

- `GET /api/parts` - Search parts
- `GET /api/parts/inventory` - Get part inventory
- `GET /api/parts/:id/best-cost` - Get best cost for a part
- `POST /api/parts/:id/inventory/add` - Add inventory for a part
- `POST /api/parts/:id/inventory/cycle` - Cycle inventory
- `POST /api/parts/:id/inventory/scrap` - Scrap inventory

### Purchase Orders

- `GET /api/purchase-orders` - List purchase orders
- `GET /api/purchase-orders/:id` - Get purchase order by ID
- `POST /api/purchase-orders` - Create purchase order
- `POST /api/purchase-orders/:id` - Update purchase order
- `POST /api/purchase-orders/:id/issue` - Issue purchase order
- `POST /api/purchase-orders/:id/unissue` - Unissue purchase order
- `POST /api/purchase-orders/:id/close-short` - Close purchase order short
- `POST /api/purchase-orders/:id/void` - Void purchase order
- `DELETE /api/purchase-orders/:id` - Delete purchase order

### Manufacture Orders

- `GET /api/manufacture-orders` - List manufacture orders
- `GET /api/manufacture-orders/:id` - Get manufacture order by ID
- `POST /api/manufacture-orders` - Create manufacture order
- `POST /api/manufacture-orders/:id/issue` - Issue manufacture order
- `POST /api/manufacture-orders/:id/unissue` - Unissue manufacture order
- `POST /api/manufacture-orders/:id/close-short` - Close manufacture order short
- `DELETE /api/manufacture-orders/:id` - Delete manufacture order

### Memos

- `GET /api/{type}/:id/memos` - Get memos for a PO or MO
- `GET /api/{type}/:id/memos/:memoId` - Get specific memo
- `POST /api/{type}/:id/memos` - Create memo
- `POST /api/{type}/:id/memos/:memoId` - Update memo
- `DELETE /api/{type}/:id/memos/:memoId` - Delete memo

Where `{type}` can be `purchase-orders` or `manufacture-orders`

### Other Endpoints

- `GET /api/products/:id/best-price` - Get best price for a product
- `GET /api/uoms` - List units of measure
- `GET /api/vendors` - List vendors
- `GET /api/users` - List users
- `GET /api/health` - Check server health and authentication status

## Security Considerations

- Store your Fishbowl credentials securely using environment variables
- Use HTTPS in production to encrypt data in transit
- The server handles authentication tokens automatically, but be aware that they expire
- Consider implementing additional authentication for your MCP server in production

## Troubleshooting

### Common Issues

1. **Authentication failures:**
   - Verify your Fishbowl credentials in the .env file
   - Ensure the Fishbowl API is enabled and accessible
   - Check if your Fishbowl user has appropriate permissions

2. **Connection errors:**
   - Verify the FISHBOWL_API_URL is correct
   - Ensure your Fishbowl server is running and accessible from the MCP server
   - Check for any firewalls or network restrictions

3. **Deployment issues on Railway:**
   - Verify all environment variables are set correctly
   - Check the logs for any errors: `railway logs`
   - Ensure your Railway project has sufficient resources

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the ISC License.
