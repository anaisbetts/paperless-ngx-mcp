# paperless-mcp - A MCP Server for Paperless-ngx

This MCP server provides Claude with the ability to search and retrieve documents from your Paperless-ngx instance. Connect Claude to your document management system to search through your archived documents, retrieve specific documents by ID, and get detailed document information including content, tags, and metadata.

### Features

- **Document Search**: Search through documents by content, title, and other fields with optional date filtering
- **Document Retrieval**: Get full document details and content by document ID

### Prerequisites

- A running [Paperless-ngx](https://docs.paperless-ngx.com/) instance
- API access to your Paperless-ngx server
- Node.js installed on your system

### How to install:

1. **Get your Paperless-ngx API credentials:**
   - Log into your Paperless-ngx web interface
   - Go to Admin → Auth tokens
   - Create a new API token and copy it
   - Note your Paperless-ngx server URL (e.g., `http://localhost:8000` or `https://paperless.yourdomain.com`)

2. **Add to Claude Desktop configuration:**

Put this into your `claude_desktop_config.json` (either at `~/Library/Application Support/Claude` on macOS or `C:\Users\NAME\AppData\Roaming\Claude` on Windows):

```json
{
  "mcpServers": {
    "paperless-mcp": {
      "command": "npx",
      "args": [
        "@anaisbetts/paperless-ngx"
      ],
      "env": {
        "PAPERLESS_SERVER": "http://localhost:8000",
        "PAPERLESS_API_KEY": "your-api-token-here"
      }
    }
  }
}
```

Replace the environment variables with your actual values:
- `PAPERLESS_SERVER`: Your Paperless-ngx server URL
- `PAPERLESS_API_KEY`: Your API token from step 1

### Example prompts

> What's my insurance policy number? It starts with a V

> When does my lease expire?

> What was the total amount on my dental bill from Dr. Smith last week?

> Do I have any warranty documents for my laptop?

> What's the account number for my savings account at Chase?

> When is my car registration due for renewal?

> How much did I spend on home repairs this year?