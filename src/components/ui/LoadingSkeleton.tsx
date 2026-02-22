'use client';

interface SkeletonProps {
    variant?: 'card' | 'table' | 'form' | 'text' | 'chart';
    rows?: number;
    className?: string;
}

function SkeletonPulse({ className = '' }: { className?: string }) {
    return (
        <div className={`animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700 ${className}`} />
    );
}

export default function LoadingSkeleton({ variant = 'card', rows = 5, className = '' }: SkeletonProps) {
    if (variant === 'text') {
        return (
            <div className={`space-y-3 ${className}`}>
                <SkeletonPulse className="h-4 w-3/4" />
                <SkeletonPulse className="h-4 w-1/2" />
                <SkeletonPulse className="h-4 w-5/6" />
            </div>
        );
    }

    if (variant === 'chart') {
        return (
            <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${className}`}>
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm">
                        <SkeletonPulse className="h-4 w-1/3 mb-4" />
                        <SkeletonPulse className="h-48 w-full" />
                    </div>
                ))}
            </div>
        );
    }

    if (variant === 'form') {
        return (
            <div className={`bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-sm space-y-6 ${className}`}>
                <SkeletonPulse className="h-6 w-1/4 mb-2" />
                {[1, 2, 3].map(i => (
                    <div key={i} className="space-y-2">
                        <SkeletonPulse className="h-4 w-1/6" />
                        <SkeletonPulse className="h-10 w-full" />
                    </div>
                ))}
                <SkeletonPulse className="h-10 w-32" />
            </div>
        );
    }

    if (variant === 'table') {
        return (
            <div className={`bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden ${className}`}>
                {/* Header */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <SkeletonPulse className="h-6 w-48" />
                    <div className="flex gap-3">
                        <SkeletonPulse className="h-9 w-28" />
                        <SkeletonPulse className="h-9 w-28" />
                    </div>
                </div>
                {/* Table rows */}
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {Array.from({ length: rows }).map((_, i) => (
                        <div key={i} className="p-4 flex items-center gap-4">
                            <SkeletonPulse className="h-4 w-12" />
                            <SkeletonPulse className="h-4 w-48 flex-1" />
                            <SkeletonPulse className="h-4 w-24" />
                            <SkeletonPulse className="h-4 w-20" />
                            <SkeletonPulse className="h-8 w-16" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Default: card grid (dashboard)
    return (
        <div className={`space-y-8 ${className}`}>
            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm">
                        <SkeletonPulse className="h-3 w-20 mb-3" />
                        <SkeletonPulse className="h-8 w-16" />
                    </div>
                ))}
            </div>
            {/* Content area */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm">
                    <SkeletonPulse className="h-5 w-32 mb-4" />
                    <SkeletonPulse className="h-52 w-full" />
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm">
                    <SkeletonPulse className="h-5 w-32 mb-4" />
                    <div className="space-y-3">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="flex items-center gap-3">
                                <SkeletonPulse className="h-4 flex-1" />
                                <SkeletonPulse className="h-4 w-12" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

// Export individual skeleton for reuse
export { SkeletonPulse };
