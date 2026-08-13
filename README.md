# Manual Task Automation

Playwright-based automation for Seller Portal and Inventory Portal workflows.

## Tech Stack

- Playwright
- JavaScript
- Node.js
- Page Object Model (POM)
- Environment Variables
- Git & GitHub

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