import { Bell, Search, Menu } from 'lucide-react';

export default function Header() {
    return (
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-20 flex items-center justify-between px-6 shadow-sm">
            <div className="flex items-center gap-4">
                {/* Mobile menu button (hidden on desktop) */}
                <button className="p-2 -ml-2 rounded-lg hover:bg-slate-100 text-slate-500 lg:hidden">
                    <Menu className="w-5 h-5" />
                </button>

                {/* Search */}
                <div className="relative hidden md:block w-96 group">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="ค้นหารายงาน หรือ รหัส..."
                        className="w-full bg-slate-50 border border-slate-200 text-sm rounded-full py-2 pl-9 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium placeholder:font-normal"
                    />
                </div>
            </div>

            <div className="flex items-center gap-4">
                <button className="relative p-2 rounded-full hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-800">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>
                </button>
            </div>
        </header>
    );
}
