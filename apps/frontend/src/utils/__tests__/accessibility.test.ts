import {
  getFormFieldAria,
  getButtonAria,
  getNavigationAria,
  getModalAria,
  getStatusAria,
  getFormSectionAria,
  getProgressAria,
  generateAccessibleId,
  getScreenReaderOnlyStyles,
  getFocusVisibleStyles,
  announceToScreenReader,
} from '../accessibility';

describe('getFormFieldAria', () => {
  it('should generate basic form field ARIA attributes', () => {
    const result = getFormFieldAria('test-field', 'Test Label');
    
    expect(result).toEqual({
      'aria-label': 'Test Label',
    });
  });

  it('should include error attributes when error is provided', () => {
    const result = getFormFieldAria('test-field', 'Test Label', 'Error message');
    
    expect(result).toEqual({
      'aria-label': 'Test Label',
      'aria-invalid': true,
      'aria-describedby': 'test-field-error',
    });
  });

  it('should include helper text attributes', () => {
    const result = getFormFieldAria('test-field', 'Test Label', undefined, 'Helper text');
    
    expect(result).toEqual({
      'aria-label': 'Test Label',
      'aria-describedby': 'test-field-helper',
    });
  });

  it('should include required and disabled attributes', () => {
    const result = getFormFieldAria('test-field', 'Test Label', undefined, undefined, true, true);
    
    expect(result).toEqual({
      'aria-label': 'Test Label',
      'aria-required': true,
      'aria-disabled': true,
    });
  });
});

describe('getButtonAria', () => {
  it('should generate basic button ARIA attributes', () => {
    const result = getButtonAria('Test Button');
    
    expect(result).toEqual({
      'aria-label': 'Test Button',
    });
  });

  it('should include expanded state', () => {
    const result = getButtonAria('Test Button', true, 'menu-id');
    
    expect(result).toEqual({
      'aria-label': 'Test Button',
      'aria-expanded': true,
      'aria-controls': 'menu-id',
    });
  });

  it('should include pressed state for toggle buttons', () => {
    const result = getButtonAria('Toggle Button', undefined, undefined, false, true);
    
    expect(result).toEqual({
      'aria-label': 'Toggle Button',
      'aria-checked': true,
      role: 'switch',
    });
  });

  it('should include disabled state', () => {
    const result = getButtonAria('Test Button', undefined, undefined, true);
    
    expect(result).toEqual({
      'aria-label': 'Test Button',
      'aria-disabled': true,
    });
  });
});

describe('getNavigationAria', () => {
  it('should generate navigation ARIA attributes', () => {
    const result = getNavigationAria('Main Navigation');
    
    expect(result).toEqual({
      'aria-label': 'Main Navigation',
    });
  });

  it('should include current page indicator', () => {
    const result = getNavigationAria('Page Link', true);
    
    expect(result).toEqual({
      'aria-label': 'Page Link',
      'aria-current': 'page',
    });
  });

  it('should include heading level', () => {
    const result = getNavigationAria('Section Title', false, 2);
    
    expect(result).toEqual({
      'aria-label': 'Section Title',
      role: 'heading',
      'aria-level': 2,
    });
  });
});

describe('getModalAria', () => {
  it('should generate modal ARIA attributes', () => {
    const result = getModalAria();
    
    expect(result).toEqual({
      role: 'dialog',
      'aria-modal': true,
    });
  });

  it('should include title and description references', () => {
    const result = getModalAria('modal-title', 'modal-desc');
    
    expect(result).toEqual({
      role: 'dialog',
      'aria-modal': true,
      'aria-labelledby': 'modal-title',
      'aria-describedby': 'modal-desc',
    });
  });
});

describe('getStatusAria', () => {
  it('should generate status ARIA attributes', () => {
    const result = getStatusAria('status');
    
    expect(result).toEqual({
      role: 'status',
      'aria-live': 'polite',
      'aria-atomic': true,
    });
  });

  it('should generate alert ARIA attributes', () => {
    const result = getStatusAria('alert', 'assertive', false);
    
    expect(result).toEqual({
      role: 'alert',
      'aria-live': 'assertive',
      'aria-atomic': false,
    });
  });
});

describe('getFormSectionAria', () => {
  it('should generate form section ARIA attributes', () => {
    const result = getFormSectionAria('section-1', 'Section Title');
    
    expect(result).toEqual({
      role: 'group',
      'aria-labelledby': 'section-1-title',
    });
  });

  it('should include description and required state', () => {
    const result = getFormSectionAria('section-1', 'Section Title', 'Section description', true);
    
    expect(result).toEqual({
      role: 'group',
      'aria-labelledby': 'section-1-title',
      'aria-describedby': 'section-1-description',
      'aria-required': true,
    });
  });
});

describe('getProgressAria', () => {
  it('should generate progress ARIA attributes', () => {
    const result = getProgressAria('Loading');
    
    expect(result).toEqual({
      role: 'progressbar',
      'aria-label': 'Loading',
    });
  });

  it('should include progress values', () => {
    const result = getProgressAria('Loading', 50, 100);
    
    expect(result).toEqual({
      role: 'progressbar',
      'aria-label': 'Loading',
      'aria-valuenow': 50,
      'aria-valuemax': 100,
    });
  });

  it('should handle indeterminate progress', () => {
    const result = getProgressAria('Loading', undefined, undefined, true);
    
    expect(result).toEqual({
      role: 'progressbar',
      'aria-label': 'Loading',
      'aria-busy': true,
    });
  });
});

describe('generateAccessibleId', () => {
  it('should generate unique IDs with prefix', () => {
    const id1 = generateAccessibleId('test');
    const id2 = generateAccessibleId('test');
    
    expect(id1).toMatch(/^test-/);
    expect(id2).toMatch(/^test-/);
    expect(id1).not.toBe(id2);
  });
});

describe('getScreenReaderOnlyStyles', () => {
  it('should return screen reader only styles', () => {
    const styles = getScreenReaderOnlyStyles();
    
    expect(styles).toEqual({
      position: 'absolute',
      left: '-10000px',
      top: 'auto',
      width: '1px',
      height: '1px',
      overflow: 'hidden',
    });
  });
});

describe('getFocusVisibleStyles', () => {
  it('should return focus visible styles with default color', () => {
    const styles = getFocusVisibleStyles();
    
    expect(styles).toEqual({
      outline: '2px solid #005fcc',
      outlineOffset: '2px',
      boxShadow: '0 0 0 4px #005fcc20',
    });
  });

  it('should return focus visible styles with custom color', () => {
    const styles = getFocusVisibleStyles('#ff0000');
    
    expect(styles).toEqual({
      outline: '2px solid #ff0000',
      outlineOffset: '2px',
      boxShadow: '0 0 0 4px #ff000020',
    });
  });
});

describe('announceToScreenReader', () => {
  const mockAppendChild = jest.fn();
  const mockRemoveChild = jest.fn();
  const mockContains = jest.fn().mockReturnValue(true);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    Object.defineProperty(document.body, 'appendChild', {
      value: mockAppendChild,
      writable: true,
    });
    
    Object.defineProperty(document.body, 'removeChild', {
      value: mockRemoveChild,
      writable: true,
    });
    
    Object.defineProperty(document.body, 'contains', {
      value: mockContains,
      writable: true,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should create and remove announcement element', () => {
    announceToScreenReader('Test message');
    
    expect(mockAppendChild).toHaveBeenCalled();
    
    // Fast-forward timers
    jest.advanceTimersByTime(1000);
    
    expect(mockRemoveChild).toHaveBeenCalled();
  });

  it('should set correct ARIA attributes', () => {
    announceToScreenReader('Test message', 'assertive');
    
    const call = mockAppendChild.mock.calls[0];
    const element = call[0];
    
    expect(element.getAttribute('aria-live')).toBe('assertive');
    expect(element.getAttribute('aria-atomic')).toBe('true');
    expect(element.textContent).toBe('Test message');
  });
});