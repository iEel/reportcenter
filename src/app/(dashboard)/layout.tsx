import AppLayout from '@/components/layout/AppLayout';
import ErrorBoundary from '@/components/ErrorBoundary';
import ToastProvider from '@/components/providers/ToastProvider';
import ConfirmProvider from '@/components/providers/ConfirmProvider';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { IdleTimeoutProvider } from '@/components/providers/IdleTimeoutProvider';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider>
            <AppLayout>
                <ToastProvider>
                    <ConfirmProvider>
                        <IdleTimeoutProvider>
                            <ErrorBoundary>
                                {children}
                            </ErrorBoundary>
                        </IdleTimeoutProvider>
                    </ConfirmProvider>
                </ToastProvider>
            </AppLayout>
        </ThemeProvider>
    );
}
