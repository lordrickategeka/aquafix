const CHECKS = {
  required(value) {
    return value !== undefined && value !== null && String(value).trim() !== '';
  },
  email(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  },
  min(value, param) {
    return String(value).length >= Number(param);
  },
  integer(value) {
    return Number.isInteger(Number(value));
  },
  // Whole number of UGX or m³ — never negative, never fractional.
  positive(value) {
    return Number.isInteger(Number(value)) && Number(value) >= 0;
  },
  // in:domestic,institutional,commercial
  in(value, param) {
    return String(param).split(',').includes(String(value));
  },
};

const MESSAGES = {
  required: (field) => `${field} is required`,
  email: (field) => `${field} must be a valid email`,
  min: (field, param) => `${field} must be at least ${param} characters`,
  integer: (field) => `${field} must be a whole number`,
  positive: (field) => `${field} must be a whole number, zero or more`,
  in: (field, param) => `${field} must be one of: ${String(param).split(',').join(', ')}`,
};

// schema: { fieldName: 'required|email', otherField: 'required|min:8' }
export function validate(data, schema) {
  const errors = {};

  for (const [field, ruleString] of Object.entries(schema)) {
    const value = data?.[field];

    for (const rule of ruleString.split('|')) {
      const [name, param] = rule.split(':');

      if (name === 'required') {
        if (!CHECKS.required(value)) {
          errors[field] = MESSAGES.required(field);
          break;
        }
        continue;
      }

      // Non-required checks are skipped when the field is empty.
      if (!CHECKS.required(value)) continue;

      if (!CHECKS[name](value, param)) {
        errors[field] = MESSAGES[name](field, param);
        break;
      }
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
