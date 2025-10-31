import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FileUpload } from '../FileUpload';

const defaultProps = {
  onFilesChange: vi.fn(),
};

// Mock File constructor for testing
const createMockFile = (
  name: string,
  size: number,
  type: string = 'text/plain'
) => {
  const file = new File(['content'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

describe('FileUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders file upload area', () => {
    render(<FileUpload {...defaultProps} />);

    expect(screen.getByText(/click to upload/i)).toBeInTheDocument();
    expect(screen.getByText(/drag and drop/i)).toBeInTheDocument();
  });

  it('renders custom label when provided', () => {
    render(<FileUpload {...defaultProps} label="Upload Documents" />);

    expect(screen.getByText('Upload Documents')).toBeInTheDocument();
  });

  it('shows file type and size restrictions', () => {
    render(
      <FileUpload
        {...defaultProps}
        accept=".pdf,.jpg"
        maxSize={5}
        multiple={true}
        maxFiles={3}
      />
    );

    expect(screen.getByText(/\.pdf,\.jpg/)).toBeInTheDocument();
    expect(screen.getByText(/Max 5MB/)).toBeInTheDocument();
    expect(screen.getByText(/Up to 3 files/)).toBeInTheDocument();
  });

  it('handles file selection via input', async () => {
    const user = userEvent.setup();
    render(<FileUpload {...defaultProps} />);

    const file = createMockFile('test.txt', 1024);
    const input = screen.getByRole('button', {
      hidden: true,
    }) as HTMLInputElement;

    await user.upload(input, file);

    expect(defaultProps.onFilesChange).toHaveBeenCalledWith([file]);
  });

  it('validates file size', async () => {
    const user = userEvent.setup();
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(<FileUpload {...defaultProps} maxSize={1} />);

    // Create file larger than 1MB
    const largeFile = createMockFile('large.txt', 2 * 1024 * 1024);
    const input = screen.getByRole('button', {
      hidden: true,
    }) as HTMLInputElement;

    await user.upload(input, largeFile);

    expect(consoleSpy).toHaveBeenCalledWith('File validation errors:', [
      'large.txt is too large (max 1MB)',
    ]);
    expect(defaultProps.onFilesChange).toHaveBeenCalledWith([]);

    consoleSpy.mockRestore();
  });

  it('validates maximum file count', async () => {
    const user = userEvent.setup();
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(<FileUpload {...defaultProps} multiple={true} maxFiles={2} />);

    const files = [
      createMockFile('file1.txt', 1024),
      createMockFile('file2.txt', 1024),
      createMockFile('file3.txt', 1024),
    ];

    const input = screen.getByRole('button', {
      hidden: true,
    }) as HTMLInputElement;
    await user.upload(input, files);

    expect(consoleSpy).toHaveBeenCalledWith('File validation errors:', [
      'Maximum 2 files allowed',
    ]);

    consoleSpy.mockRestore();
  });

  it('displays selected files', async () => {
    const user = userEvent.setup();
    render(<FileUpload {...defaultProps} multiple={true} />);

    const files = [
      createMockFile('document.pdf', 1024 * 1024), // 1MB
      createMockFile('image.jpg', 512 * 1024), // 512KB
    ];

    const input = screen.getByRole('button', {
      hidden: true,
    }) as HTMLInputElement;
    await user.upload(input, files);

    expect(screen.getByText('Selected Files (2)')).toBeInTheDocument();
    expect(screen.getByText('document.pdf')).toBeInTheDocument();
    expect(screen.getByText('image.jpg')).toBeInTheDocument();
    expect(screen.getByText('1 MB')).toBeInTheDocument();
    expect(screen.getByText('512 KB')).toBeInTheDocument();
  });

  it('removes files when remove button is clicked', async () => {
    const user = userEvent.setup();
    render(<FileUpload {...defaultProps} multiple={true} />);

    const files = [
      createMockFile('file1.txt', 1024),
      createMockFile('file2.txt', 1024),
    ];

    const input = screen.getByRole('button', {
      hidden: true,
    }) as HTMLInputElement;
    await user.upload(input, files);

    // Remove first file
    const removeButtons = screen.getAllByText('×');
    await user.click(removeButtons[0]);

    expect(defaultProps.onFilesChange).toHaveBeenLastCalledWith([files[1]]);
  });

  it('handles drag and drop', () => {
    render(<FileUpload {...defaultProps} />);

    const dropArea = screen.getByText(/click to upload/i).closest('div');
    const file = createMockFile('dropped.txt', 1024);

    // Simulate drag enter
    fireEvent.dragEnter(dropArea!, {
      dataTransfer: { files: [file] },
    });

    // Should show active drag state (this would be visual, hard to test)

    // Simulate drop
    fireEvent.drop(dropArea!, {
      dataTransfer: { files: [file] },
    });

    expect(defaultProps.onFilesChange).toHaveBeenCalledWith([file]);
  });

  it('shows error message when provided', () => {
    render(<FileUpload {...defaultProps} error="Upload failed" />);

    expect(screen.getByText('Upload failed')).toBeInTheDocument();
  });

  it('shows helper text when provided', () => {
    render(
      <FileUpload {...defaultProps} helperText="Upload your documents here" />
    );

    expect(screen.getByText('Upload your documents here')).toBeInTheDocument();
  });

  it('disables upload when disabled prop is true', () => {
    render(<FileUpload {...defaultProps} disabled={true} />);

    const dropArea = screen.getByText(/click to upload/i).closest('div');
    expect(dropArea).toHaveStyle({ cursor: 'not-allowed', opacity: '0.6' });
  });

  it('formats file sizes correctly', async () => {
    const user = userEvent.setup();
    render(<FileUpload {...defaultProps} multiple={true} />);

    const files = [
      createMockFile('small.txt', 500), // 500 Bytes
      createMockFile('medium.txt', 1536), // 1.5 KB
      createMockFile('large.txt', 1572864), // 1.5 MB
    ];

    const input = screen.getByRole('button', {
      hidden: true,
    }) as HTMLInputElement;
    await user.upload(input, files);

    expect(screen.getByText('500 Bytes')).toBeInTheDocument();
    expect(screen.getByText('1.5 KB')).toBeInTheDocument();
    expect(screen.getByText('1.5 MB')).toBeInTheDocument();
  });

  it('handles single file mode correctly', async () => {
    const user = userEvent.setup();
    render(<FileUpload {...defaultProps} multiple={false} />);

    const files = [
      createMockFile('file1.txt', 1024),
      createMockFile('file2.txt', 1024),
    ];

    const input = screen.getByRole('button', {
      hidden: true,
    }) as HTMLInputElement;
    await user.upload(input, files);

    // Should only keep the first file
    expect(defaultProps.onFilesChange).toHaveBeenCalledWith([files[0]]);
  });
});
