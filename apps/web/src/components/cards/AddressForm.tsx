'use client';

import { useState } from 'react';

interface AddressFormat {
  fields: {
    name: string;
    label: string;
    type: 'text' | 'select';
    required: boolean;
    options?: string[];
    placeholder?: string;
  }[];
}

const FORMATS: Record<string, AddressFormat> = {
  US: {
    fields: [
      { name: 'recipient_name', label: '收件人', type: 'text', required: true, placeholder: 'Full Name' },
      { name: 'phone', label: '电话', type: 'text', required: true, placeholder: '+1 xxx-xxx-xxxx' },
      { name: 'street_address1', label: '街道地址', type: 'text', required: true, placeholder: '123 Main St' },
      { name: 'street_address2', label: '公寓/套房', type: 'text', required: false, placeholder: 'Apt, Suite (optional)' },
      { name: 'admin_area2', label: '城市', type: 'text', required: true, placeholder: 'City' },
      { name: 'admin_area1', label: '州', type: 'text', required: true, placeholder: 'State' },
      { name: 'postal_code', label: '邮编', type: 'text', required: true, placeholder: 'ZIP Code' },
    ],
  },
  CA: {
    fields: [
      { name: 'recipient_name', label: '收件人', type: 'text', required: true, placeholder: 'Full Name' },
      { name: 'phone', label: '电话', type: 'text', required: true, placeholder: '+1 xxx-xxx-xxxx' },
      { name: 'street_address1', label: '街道地址', type: 'text', required: true, placeholder: '123 Main St' },
      { name: 'street_address2', label: '公寓/套房', type: 'text', required: false, placeholder: 'Apt, Suite (optional)' },
      { name: 'admin_area2', label: '城市', type: 'text', required: true, placeholder: 'City' },
      { name: 'admin_area1', label: '省', type: 'text', required: true, placeholder: 'Province' },
      { name: 'postal_code', label: '邮编', type: 'text', required: true, placeholder: 'Postal Code' },
    ],
  },
  AU: {
    fields: [
      { name: 'recipient_name', label: '收件人', type: 'text', required: true, placeholder: 'Full Name' },
      { name: 'phone', label: '电话', type: 'text', required: true, placeholder: '+61 xxx-xxx-xxx' },
      { name: 'street_address1', label: '街道地址', type: 'text', required: true, placeholder: '123 Main St' },
      { name: 'admin_area2', label: '城市', type: 'text', required: true, placeholder: 'Suburb' },
      { name: 'admin_area1', label: '州', type: 'text', required: true, placeholder: 'State' },
      { name: 'postal_code', label: '邮编', type: 'text', required: true, placeholder: 'Postcode' },
    ],
  },
};

export function AddressForm({
  countryCode = 'US',
  initialData,
  onSubmit,
  onCancel,
}: {
  countryCode?: string;
  initialData?: any;
  onSubmit: (data: any) => void;
  onCancel?: () => void;
}) {
  const format = FORMATS[countryCode] || FORMATS.US;
  const [formData, setFormData] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = { country_code: countryCode };
    if (initialData) {
      for (const field of format.fields) {
        initial[field.name] = initialData[field.name] || initialData[field.name.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] || '';
      }
    }
    return initial;
  });

  const handleChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {format.fields.map((field) => (
        <div key={field.name}>
          <label className="mb-1 block text-[12px] font-medium text-txt-2">
            {field.label}
            {field.required && <span className="ml-0.5 text-danger">*</span>}
          </label>
          <input
            type="text"
            value={formData[field.name] || ''}
            onChange={(e) => handleChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            required={field.required}
            className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[13px] text-txt outline-none transition-colors focus:border-brand focus:shadow-[0_0_0_3px_rgba(124,58,237,0.15)]"
          />
        </div>
      ))}

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          className="flex-1 rounded-xl bg-brand py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-dark"
        >
          保存地址
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-border px-4 py-2.5 text-[13px] text-txt-2 transition-colors hover:border-brand hover:text-brand"
          >
            取消
          </button>
        )}
      </div>
    </form>
  );
}
