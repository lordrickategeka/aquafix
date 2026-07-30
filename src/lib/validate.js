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
};

const MESSAGES = {
  required: (field) => `${field} is required`,
  email: (field) => `${field} must be a valid email`,
  min: (field, param) => `${field} must be at least ${param} characters`,
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
