# MCP Fishbowl Server

This is a Model Context Protocol (MCP) server for accessing data from Fishbowl Inventory.

## Features

- Direct connection to Fishbowl Inventory API
- Query inventory levels by part number
- Retrieve all products
- Retrieve all parts
- Secure authentication handling

## Environment Variables

Required environment variables (set these in Railway):
- `FISHBOWL_HOST` - Fishbowl server hostname/IP
- `FISHBOWL_PORT` - Fishbowl server port (default: 28192)
- `FISHBOWL_USERNAME` - Fishbowl username
- `FISHBOWL_PASSWORD` - Fishbowl password
- `FISHBOWL_IAID` - Integrated Application ID (default: 54321)

## API Endpoints

### MCP Execute Command
