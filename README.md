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

The workflow includes handling for cases where an order may already be approved and polling for backend processing delays.

## Project Structure

```text
Manual_Task_Automation/
│
├── automation/
│   ├── inventory/
│   │   ├── pages/
│   │   │   └── inventoryWorkflow.pages.js
│   │   └── tests/
│   │       └── outboundApproval.spec.js
│   │
│   └── seller/
│       ├── pages/
│       │   ├── product.page.js
│       │   └── sellerLogin.page.js
│       └── tests/
│           └── addProduct.spec.js
│
├── config/
│   └── testConfig.js
│
├── utils/
│   ├── dataGenerator.js
│   ├── otpHelper.js
│   └── waitHelper.js
│
├── .env.example
├── .gitignore
├── package.json
├── playwright.config.js
└── README.md
```

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

## Installation

Clone the repository:

```bash
git clone https://github.com/rahama21/Manual-Task-Automation.git
```

Navigate to the project directory:

```bash
cd Manual-Task-Automation
```

Install dependencies:

```bash
npm install
```

Install Playwright browsers:

```bash
npx playwright install
```

Create your `.env` file using `.env.example` as a reference.

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

## Configuration

The project supports multiple systems through environment configuration:

- `inventory`
- `seller`

Example:

```bash
TEST_SYSTEM=inventory npx playwright test
```

Configuration is centrally managed through:

```text
config/testConfig.js
```

This keeps URLs, credentials, timeouts, paths, menus, and environment-specific settings separated from the test implementation.

## Key Implementation Details

### Page Object Model

Page interactions are separated from test scenarios to improve:

- Maintainability
- Reusability
- Readability
- Scalability

### Environment-Based Credentials

Credentials and OTP values are loaded through environment variables and are excluded from version control.

### Reusable Wait Utilities

The project includes reusable helpers for:

- Page stability
- Toast message validation
- Table loading
- Dynamic UI synchronization

### Backend Processing Handling

The Inventory workflow uses polling to handle situations where backend processing takes time, such as when an approved order is not immediately visible in the Approved tab.

## Security
The following files and generated artifacts are excluded from Git:
```text
.env
node_modules/
test-results/
playwright-report/
blob-report/
*.png
*.jpg
*.jpeg
```
Sensitive credentials are stored locally and are not included in the public repository.

## Future Improvements
- Add CI/CD integration with GitHub Actions
- Add Allure reporting
- Add API validation alongside UI automation
- Expand Inventory workflow coverage
- Add additional negative and edge-case scenarios
