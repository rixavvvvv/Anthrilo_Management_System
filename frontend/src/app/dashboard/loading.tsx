export default function DashboardLoading() {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <div className="skeleton h-8 w-48 mb-2" />
          <div className="skeleton h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <div className="skeleton h-9 w-20 rounded-xl" />
          <div className="skeleton h-9 w-24 rounded-xl" />
        </div>
      </div>

      {/* Section 1: Performance Snapshot */}
      <div>
        <div className="skeleton h-3 w-40 mb-3" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-5 space-y-3" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="flex items-center justify-between">
                <div className="skeleton w-24 h-4" />
                <div className="skeleton w-9 h-9 rounded-xl" />
              </div>
              <div className="skeleton w-32 h-8" />
              <div className="skeleton w-20 h-3" />
            </div>
          ))}
        </div>
      </div>

      {/* Section 2: Trend Over Time */}
      <div>
        <div className="skeleton h-3 w-36 mb-3" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="card p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <div className="skeleton w-32 h-5 mb-1" />
                  <div className="skeleton w-48 h-3" />
                </div>
                <div className="skeleton w-7 h-7 rounded-lg" />
              </div>
              <div className="skeleton w-full h-[280px] rounded-xl" />
            </div>
          ))}
        </div>
      </div>

      {/* Section 3: Channel Contribution */}
      <div>
        <div className="skeleton h-3 w-44 mb-3" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="card p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <div className="skeleton w-36 h-5 mb-1" />
                  <div className="skeleton w-44 h-3" />
                </div>
                <div className="skeleton w-7 h-7 rounded-lg" />
              </div>
              <div className="skeleton w-full h-[280px] rounded-xl" />
            </div>
          ))}
        </div>
      </div>

      {/* Section 4: Comparison & Insights */}
      <div>
        <div className="skeleton h-3 w-48 mb-3" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-6">
            <div className="skeleton h-5 w-36 mb-5" />
            <div className="grid grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="text-center space-y-2">
                  <div className="skeleton h-3 w-16 mx-auto" />
                  <div className="skeleton h-7 w-20 mx-auto" />
                  <div className="skeleton h-3 w-24 mx-auto" />
                  <div className="skeleton h-5 w-14 mx-auto rounded-full" />
                </div>
              ))}
            </div>
          </div>
          <div className="card p-6 space-y-3">
            <div className="skeleton h-5 w-24 mb-2" />
            {[...Array(3)].map((_, i) => (
              <div key={i} className="skeleton h-12 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
