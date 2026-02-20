import Header from "./Header";
import Sidebar from "./Sidebar";
import { AuthProvider } from "@/components/providers/AuthProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <div className="flex h-screen overflow-hidden bg-slate-50 font-sans">
                <Sidebar />
                <div className="flex-1 flex flex-col relative overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-6 md:p-8 lg:p-10 scroll-smooth">
                        <div className="max-w-7xl mx-auto">
                            {children}
                        </div>
                    </main>
                </div>
            </div>
        </AuthProvider>
    );
}
