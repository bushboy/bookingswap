import React, { useRef, useState } from 'react';
import { Button } from './Button';
import { tokens } from '@/design-system/tokens';

interface FileUploadProps {
  label?: string;
  accept?: string;
  multiple?: boolean;
  maxSize?: number; // in MB
  maxFiles?: number;
  onFilesChange: (files: File[]) => void;
  error?: string;
  helperText?: string;
  disabled?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  label = 'Upload Files',
  accept = '*/*',
  multiple = false,
  maxSize = 10, // 10MB default
  maxFiles = 5,
  onFilesChange,
  error,
  helperText,
  disabled = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  const validateFiles = (
    fileList: FileList
  ): { valid: File[]; errors: string[] } => {
    const validFiles: File[] = [];
    const errors: string[] = [];

    Array.from(fileList).forEach(file => {
      // Check file size
      if (file.size > maxSize * 1024 * 1024) {
        errors.push(`${file.name} is too large (max ${maxSize}MB)`);
        return;
      }

      // Check file count
      if (validFiles.length + files.length >= maxFiles) {
        errors.push(`Maximum ${maxFiles} files allowed`);
        return;
      }

      validFiles.push(file);
    });

    return { valid: validFiles, errors };
  };

  const handleFileSelect = (fileList: FileList | null) => {
    if (!fileList) return;

    const { valid, errors } = validateFiles(fileList);

    if (errors.length > 0) {
      console.warn('File validation errors:', errors);
      // You might want to show these errors to the user
    }

    const newFiles = multiple ? [...files, ...valid] : valid.slice(0, 1);
    setFiles(newFiles);
    onFilesChange(newFiles);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (disabled) return;

    handleFileSelect(e.dataTransfer.files);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
  };

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    onFilesChange(newFiles);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div style={{ width: '100%' }}>
      {label && (
        <label
          style={{
            display: 'block',
            fontSize: tokens.typography.fontSize.sm,
            fontWeight: tokens.typography.fontWeight.medium,
            color: tokens.colors.neutral[700],
            marginBottom: tokens.spacing[2],
          }}
        >
          {label}
        </label>
      )}

      <div
        style={{
          border: `2px dashed ${dragActive ? tokens.colors.primary[400] : error ? tokens.colors.error[400] : tokens.colors.neutral[300]}`,
          borderRadius: tokens.borderRadius.lg,
          padding: tokens.spacing[6],
          textAlign: 'center',
          backgroundColor: dragActive
            ? tokens.colors.primary[50]
            : error
              ? tokens.colors.error[50]
              : tokens.colors.neutral[50],
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
          opacity: disabled ? 0.6 : 1,
        }}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleInputChange}
          disabled={disabled}
          style={{ display: 'none' }}
        />

        <div
          style={{
            fontSize: '48px',
            marginBottom: tokens.spacing[3],
            color: tokens.colors.neutral[400],
          }}
        >
          📁
        </div>

        <div
          style={{
            fontSize: tokens.typography.fontSize.base,
            color: tokens.colors.neutral[700],
            marginBottom: tokens.spacing[2],
          }}
        >
          <strong>Click to upload</strong> or drag and drop
        </div>

        <div
          style={{
            fontSize: tokens.typography.fontSize.sm,
            color: tokens.colors.neutral[500],
          }}
        >
          {accept === '*/*' ? 'Any file type' : accept} • Max {maxSize}MB
          {multiple && ` • Up to ${maxFiles} files`}
        </div>
      </div>

      {files.length > 0 && (
        <div
          style={{
            marginTop: tokens.spacing[4],
            border: `1px solid ${tokens.colors.neutral[200]}`,
            borderRadius: tokens.borderRadius.md,
            padding: tokens.spacing[4],
          }}
        >
          <div
            style={{
              fontSize: tokens.typography.fontSize.sm,
              fontWeight: tokens.typography.fontWeight.medium,
              color: tokens.colors.neutral[700],
              marginBottom: tokens.spacing[3],
            }}
          >
            Selected Files ({files.length})
          </div>

          {files.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: `${tokens.spacing[2]} 0`,
                borderBottom:
                  index < files.length - 1
                    ? `1px solid ${tokens.colors.neutral[200]}`
                    : 'none',
              }}
            >
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: tokens.typography.fontSize.sm,
                    color: tokens.colors.neutral[900],
                    fontWeight: tokens.typography.fontWeight.medium,
                  }}
                >
                  {file.name}
                </div>
                <div
                  style={{
                    fontSize: tokens.typography.fontSize.xs,
                    color: tokens.colors.neutral[500],
                  }}
                >
                  {formatFileSize(file.size)}
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={e => {
                  e.stopPropagation();
                  removeFile(index);
                }}
                disabled={disabled}
                style={{
                  color: tokens.colors.error[600],
                  padding: tokens.spacing[1],
                }}
              >
                ×
              </Button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div
          style={{
            fontSize: tokens.typography.fontSize.sm,
            color: tokens.colors.error[600],
            marginTop: tokens.spacing[1],
          }}
        >
          {error}
        </div>
      )}

      {helperText && !error && (
        <div
          style={{
            fontSize: tokens.typography.fontSize.sm,
            color: tokens.colors.neutral[500],
            marginTop: tokens.spacing[1],
          }}
        >
          {helperText}
        </div>
      )}
    </div>
  );
};
