import AuthGuard from "@/components/AuthGuard";
import BottomNav from "@/components/BottomNav";

export default function AppLayout({ children }) {
  return (
    <AuthGuard>
      {/*
        Width ladder: phones get a tight 12px gutter so content isn't squeezed,
        tablets/laptops get more breathing room and a wider column. The bottom
        padding clears the fixed nav plus the iOS home indicator.
      */}
      <main
        className="flex-1 px-3 sm:px-5 lg:px-6 pt-3 sm:pt-5 mx-auto w-full min-w-0 overflow-x-hidden
                   max-w-lg md:max-w-2xl lg:max-w-3xl
                   pb-[calc(5rem+env(safe-area-inset-bottom))]"
      >
        {children}
      </main>
      <BottomNav />
    </AuthGuard>
  );
}
