import AppLayout from '@/components/layout/AppLayout';
import ErrorBoundary from '@/components/ErrorBoundary';
import ToastProvider from '@/components/providers/ToastProvider';
import ConfirmProvider from '@/components/providers/ConfirmProvider';
import { ThemeProvider } from '@/components/providers/ThemeProvider';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider>
            <AppLayout>
                <ToastProvider>
                    <ConfirmProvider>
                        <ErrorBoundary>
                            {children}
                        </ErrorBoundary>
                    </ConfirmProvider>
                </ToastProvider>
            </AppLayout>
        </ThemeProvider>
    );
}
