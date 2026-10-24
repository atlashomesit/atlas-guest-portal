import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { settle } from '../../test/settle';
import GuestIdUpload from './GuestIdUpload';

describe('TASK-1039907: GuestIdUpload preview and validation', () => {
  beforeEach(() => {
    vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function (this: FileReader) {
      this.onload?.({ target: { result: 'data:image/jpeg;base64,dummy-preview' } } as ProgressEvent<FileReader>);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders upload component with clean instructions', () => {
    render(<GuestIdUpload guestName="Alex Doe" />);

    expect(screen.getByTestId('guest-id-upload-label')).toHaveTextContent('Alex Doe');
    expect(screen.getByText(/under 5 MB/i)).toBeInTheDocument();
  });

  it('validates file size (< 5MB limit)', async () => {
    const onError = vi.fn();
    render(<GuestIdUpload onError={onError} />);

    const input = screen.getByTestId('guest-id-file-input');
    // Create a 6MB dummy file
    const largeFile = new File(['a'.repeat(6 * 1024 * 1024)], 'large-passport.png', {
      type: 'image/png',
    });

    fireEvent.change(input, { target: { files: [largeFile] } });
    await settle();

    const errorMsg = screen.getByTestId('id-upload-error');
    expect(errorMsg).toHaveTextContent(/exceeds 5 MB/i);
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('5 MB'));
  });

  it('validates mime types and rejects unsupported formats', async () => {
    const onError = vi.fn();
    render(<GuestIdUpload onError={onError} />);

    const input = screen.getByTestId('guest-id-file-input');
    const badFile = new File(['fake-executable'], 'exploit.exe', {
      type: 'application/x-msdownload',
    });

    fireEvent.change(input, { target: { files: [badFile] } });
    await settle();

    const errorMsg = screen.getByTestId('id-upload-error');
    expect(errorMsg).toHaveTextContent(/Invalid file type/i);
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('Invalid file type'));
  });

  it('shows thumbnail preview for valid government ID image', async () => {
    const onFileSelect = vi.fn();
    render(<GuestIdUpload onFileSelect={onFileSelect} />);

    const input = screen.getByTestId('guest-id-file-input');
    const validImage = new File(['dummy-image-bytes'], 'aadhaar-card.jpg', {
      type: 'image/jpeg',
    });

    fireEvent.change(input, { target: { files: [validImage] } });
    await settle();

    expect(onFileSelect).toHaveBeenCalledWith(validImage);
    const thumb = screen.getByTestId('id-preview-thumbnail');
    expect(thumb).toBeInTheDocument();
    expect(thumb).toHaveAttribute('alt', 'Government ID preview');
  });

  it('allows removing and replacing the selected file', async () => {
    const onFileSelect = vi.fn();
    render(<GuestIdUpload onFileSelect={onFileSelect} />);

    const input = screen.getByTestId('guest-id-file-input');
    const validImage = new File(['dummy-image-bytes'], 'passport.png', {
      type: 'image/png',
    });

    fireEvent.change(input, { target: { files: [validImage] } });
    await settle();

    expect(screen.getByTestId('id-preview-thumbnail')).toBeInTheDocument();

    const removeBtn = screen.getByTestId('id-remove-button');
    fireEvent.click(removeBtn);
    await settle();

    expect(screen.queryByTestId('id-preview-thumbnail')).not.toBeInTheDocument();
    expect(onFileSelect).toHaveBeenCalledWith(null);
  });
});
