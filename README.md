# Manual Task Automation

A Playwright-based test automation project for automating business workflows across the **Seller Portal** and **Inventory Portal**.

The project follows the **Page Object Model (POM)** design pattern to keep test logic, page interactions, configuration, and reusable utilities organized and maintainable.

## Tech Stack

- Playwright
- JavaScript
- Node.js
- Page Object Model (POM)
- Environment Variables
- Git & GitHub

## Automated Workflows

### Seller Portal

Automated product creation workflow, including:

- User login
- Product information handling
- Product creation flow
- Form interaction and validation

### Inventory Portal

Automated outbound inventory workflow:

1. Login with OTP verification
2. Navigate to Outbound Order Approval
3. Search for an outbound order
4. Approve the order when it is in Pending status
5. Verify the order in the Approved tab
6. Open the Delivery Order
7. Select SKU batches
8. Scan UINs for multiple SKU items
9. Create packaging with packing materials
10. Capture the generated packaging code
11. Create a Master Pack
12. Add Master Pack materials
13. Create a Master Pack Transfer Request
14. Select source and destination warehouses
15. Submit the transfer request

The workflow also handles cases where an order may already be approved and includes polling for backend processing delays.

## Environment Configuration

Sensitive information such as usernames, passwords, and OTP values is stored using environment variables.

Create a `.env` file in the project root:

```env
TEST_SYSTEM=inventory

INVENTORY_USERNAME=your_username
INVENTORY_PASSWORD=your_password

CARTUP_USERNAME=your_username
CARTUP_PASSWORD=your_password

OTP=your_otp
```

The `.env` file is excluded from Git using `.gitignore`.

An `.env.example` file is included to show the required environment variables without exposing credentials.

The project supports multiple systems:

- `inventory`
- `seller`

Configuration is centrally managed through:

```text
config/testConfig.js
```

This keeps system-specific settings separated from the test implementation.

## Running Tests

Run all tests:

```bash
npx playwright test
```

Run the Inventory automation:

```bash
npx playwright test automation/inventory/tests/outboundApproval.spec.js
```

Run the Seller Portal automation:

```bash
npx playwright test automation/seller/tests/addProduct.spec.js
```

Run tests in headed mode:

```bash
npx playwright test --headed
```

View the Playwright report:

```bash
npx playwright show-report
```

## Security

Credentials and OTP values are stored locally using environment variables and are not included in the repository