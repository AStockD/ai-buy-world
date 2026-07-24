export function ShippingCard({ data }: { data: any }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
      <h4 className="text-sm font-medium text-gray-700">运费费率</h4>
      {data.calculatedFee != null && (
        <div className="mt-2 rounded bg-white p-2 text-center">
          <p className="text-xs text-gray-500">预估运费</p>
          <p className="text-xl font-bold text-red-500">${data.calculatedFee}</p>
          <p className="text-xs text-gray-400">{data.weightKg}kg · {data.region} · {data.category}</p>
        </div>
      )}
      <div className="mt-2 space-y-1">
        {data.rateTable?.slice(0, 5).map((r: any) => (
          <div key={r.region} className="flex justify-between text-xs text-gray-500">
            <span>{r.region}</span>
            <span>${r.ratePerKg}/kg</span>
          </div>
        ))}
      </div>
    </div>
  );
}
