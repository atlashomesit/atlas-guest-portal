import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { settle } from '@/test/settle';
import { VirtualBankAccountCard } from './VirtualBankAccountCard';

describe('VirtualBankAccountCard — PAY-053 Smart Collect virtual bank account', () => {
  const writeTextMock = vi.fn().mockResolvedValue(undefined);
  const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

  beforeEach(() => {
    writeTextMock.mockClear();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    if (originalClipboard) {
      Object.defineProperty(navigator, 'clipboard', originalClipboard);
    } else {
      Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('renders virtual account details and copies account number, IFSC, and all details', async () => {
    render(
      <VirtualBankAccountCard
        account={{
          accountNumber: '2223330044556677',
          ifsc: 'RAZR0000001',
          beneficiaryName: 'Villa Sol Hospitality',
          bankName: 'RBL Bank',
          amountExpectedInr: 150000,
        }}
      />,
    );

    expect(screen.getByTestId('virtual-bank-account-card')).toBeInTheDocument();
    expect(screen.getByTestId('va-beneficiary')).toHaveTextContent('Villa Sol Hospitality');
    expect(screen.getByTestId('va-account-number')).toHaveTextContent('2223330044556677');
    expect(screen.getByTestId('va-ifsc')).toHaveTextContent('RAZR0000001');
    expect(screen.getByTestId('va-bank-name')).toHaveTextContent('RBL Bank');

    fireEvent.click(screen.getByTestId('va-copy-account'));
    await settle();
    expect(writeTextMock).toHaveBeenCalledWith('2223330044556677');

    fireEvent.click(screen.getByTestId('va-copy-ifsc'));
    await settle();
    expect(writeTextMock).toHaveBeenCalledWith('RAZR0000001');

    fireEvent.click(screen.getByTestId('va-copy-all'));
    await settle();
    expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('2223330044556677'));
    expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('RAZR0000001'));
  });
});
