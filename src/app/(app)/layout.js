import AuthGuard from "@/components/AuthGuard";
import BottomNav from "@/components/BottomNav";

export default function AppLayout({ children }) {
  return (
    <AuthGuard>
      <main className="flex-1 pb-20 px-4 pt-4 max-w-lg mx-auto w-full min-w-0 overflow-x-hidden">
        {children}
      </main>
      <BottomNav />
    </AuthGuard>
  );
}
