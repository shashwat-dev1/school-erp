import React from 'react';

export interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const FormInput: React.FC<FormInputProps> = ({
  label,
  error,
  helperText,
  id,
  className = '',
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="hhs-form-group">
      {label && (
        <label htmlFor={inputId} className="hhs-label">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`hhs-input ${error ? 'error' : ''} ${className}`}
        {...props}
      />
      {error && <span className="hhs-field-error">{error}</span>}
      {!error && helperText && <span className="hhs-body-sm">{helperText}</span>}
    </div>
  );
};

export interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: Array<{ value: string; label: string }>;
}

export const FormSelect: React.FC<FormSelectProps> = ({
  label,
  error,
  options,
  id,
  className = '',
  ...props
}) => {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="hhs-form-group">
      {label && (
        <label htmlFor={selectId} className="hhs-label">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`hhs-select ${error ? 'error' : ''} ${className}`}
        {...props}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <span className="hhs-field-error">{error}</span>}
    </div>
  );
};

export interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const FormTextarea: React.FC<FormTextareaProps> = ({
  label,
  error,
  id,
  className = '',
  ...props
}) => {
  const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="hhs-form-group">
      {label && (
        <label htmlFor={textareaId} className="hhs-label">
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        className={`hhs-textarea ${error ? 'error' : ''} ${className}`}
        {...props}
      />
      {error && <span className="hhs-field-error">{error}</span>}
    </div>
  );
};
