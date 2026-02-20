export function CardSkeleton() {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 animate-pulse">
            <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-slate-200 rounded-xl" />
                <div className="h-4 bg-slate-200 rounded w-20" />
            </div>
            <div className="h-8 bg-slate-200 rounded w-16 mb-2" />
            <div className="h-3 bg-slate-100 rounded w-24" />
        </div>
    );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
    return (
        <div className="animate-pulse">
            {/* Header */}
            <div className="flex gap-4 p-4 border-b border-slate-100 bg-slate-50">
                {Array.from({ length: cols }).map((_, i) => (
                    <div key={i} className="h-4 bg-slate-200 rounded flex-1" />
                ))}
            </div>
            {/* Rows */}
            {Array.from({ length: rows }).map((_, rowIdx) => (
                <div key={rowIdx} className="flex gap-4 p-4 border-b border-slate-50">
                    {Array.from({ length: cols }).map((_, colIdx) => (
                        <div key={colIdx} className="h-4 bg-slate-100 rounded flex-1" />
                    ))}
                </div>
            ))}
        </div>
    );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
    return (
        <div className="animate-pulse divide-y divide-slate-100">
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="px-5 py-4 flex items-center gap-3">
                    <div className="w-8 h-8 bg-slate-200 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2">
                        <div className="h-4 bg-slate-200 rounded w-3/4" />
                        <div className="h-3 bg-slate-100 rounded w-1/2" />
                    </div>
                </div>
            ))}
        </div>
    );
}
