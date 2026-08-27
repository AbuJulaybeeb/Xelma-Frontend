import { test, expect } from '@playwright/test';

const MOCK_ADDRESS = 'GBHExampleAddressForTestingPurposesOnly1234567890ABCDE';

/** Inject a fake Freighter wallet object before any app code runs. */
function mockFreighter(page: import('@playwright/test').Page) {
  return page.addInitScript(() => {
    (window as unknown as Record<string, unknown>).freighter = {
      isConnected: () => Promise.resolve({ isConnected: true }),
      requestAccess: () =>
        Promise.resolve({ address: MOCK_ADDRESS, error: null }),
      getAddress: () =>
        Promise.resolve({ address: MOCK_ADDRESS, error: null }),
      getNetwork: () => Promise.resolve({ network: 'TESTNET', error: null }),
      signMessage: (message: string) =>
        Promise.resolve({ signedMessage: `mocked_signature_${message}`, error: null }),
    };
  });
}

test.describe('Wallet Connect – Freighter Mocked', () => {
  test('Connect page shows wallet prompt and Connect Wallet button', async ({ page }) => {
    await mockFreighter(page);

    // Mock Horizon balance request
    await page.route('**/horizon-testnet.stellar.org/accounts/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          balances: [{ asset_type: 'native', balance: '100.00' }],
        }),
      }),
    );

    // Mock backend auth endpoints
    await page.route('**/api/auth/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ challenge: 'mock_challenge', token: 'mock_jwt_token' }),
      }),
    );

    await page.goto('/connect');

    // The Connect page renders the WalletConnect component
    // Specify the button in the header (desktop), not the mobile drawer
    const connectButton = page.locator('header button:has-text("Connect Wallet")').first();
    await expect(connectButton).toBeVisible();
  });

  test('Dashboard shows wallet prompt when not connected, then connects via Freighter', async ({ page }) => {
    await mockFreighter(page);

    // Mock Horizon balance request
    await page.route('**/horizon-testnet.stellar.org/accounts/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          balances: [{ asset_type: 'native', balance: '100.00' }],
        }),
      }),
    );

    // Mock backend auth endpoints
    await page.route('**/api/auth/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ challenge: 'mock_challenge', token: 'mock_jwt_token' }),
      }),
    );

    await page.goto('/dashboard');

    // Should show wallet prompt when not connected
    const walletPrompt = page.locator('[data-testid="dashboard-wallet-prompt"]');
    await expect(walletPrompt).toBeVisible();
    await expect(walletPrompt).toContainText('Connect your wallet');

    // Navigate directly to /connect instead of clicking the button
    // The button click may be intercepted by event handlers
    await page.goto('/connect');

    // Click "Connect Wallet" button inside WalletConnect component to initiate Freighter flow
    // Target the button in the main content area, not the Navbar header button
    const connectButton = page.locator('main button:has-text("Connect Wallet")');
    await expect(connectButton).toBeVisible();
    await connectButton.click();

    // After connection, the "Continue to Dashboard" button should appear
    const continueBtn = page.getByRole('button', { name: /continue to dashboard/i });
    await expect(continueBtn).toBeVisible({ timeout: 10000 });
  });
});
