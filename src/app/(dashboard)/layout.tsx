import AppLayout from '@/components/layout/AppLayout';
import ErrorBoundary from '@/components/ErrorBoundary';
import ToastProvider from '@/components/providers/ToastProvider';
import ConfirmProvider from '@/components/providers/ConfirmProvider';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <AppLayout>
            <ToastProvider>
                <ConfirmProvider>
                    <ErrorBoundary>
                        {children}
                    </ErrorBoundary>
                </ConfirmProvider>
            </ToastProvider>
        </AppLayout>
    );
}
