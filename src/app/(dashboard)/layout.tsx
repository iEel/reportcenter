import AppLayout from '@/components/layout/AppLayout';
import ErrorBoundary from '@/components/ErrorBoundary';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <AppLayout>
            <ErrorBoundary>
                {children}
            </ErrorBoundary>
        </AppLayout>
    );
}
