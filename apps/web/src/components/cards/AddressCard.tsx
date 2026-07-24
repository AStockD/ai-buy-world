export function AddressCard({ data }: { data: any }) {
  const addresses = data.addresses || [];

  return (
    <div className="space-y-2">
      {addresses.map((addr: any) => (
        <div key={addr.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">{addr.recipientName}</span>
            {addr.isDefault && (
              <span className="rounded bg-primary-50 px-1.5 py-0.5 text-xs text-primary-600">默认</span>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-500">{addr.formatted}</p>
        </div>
      ))}
    </div>
  );
}
