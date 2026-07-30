import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import Index from "@/pages/Index";
import { Navigate } from "react-router-dom";

const HomeEntry = () => {
  const { isPlatformAdmin, loading } = usePlatformAdmin();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (isPlatformAdmin) return <Navigate to="/admin" replace />;

  return (
    <ProtectedRoute>
      <Index />
    </ProtectedRoute>
  );
};

export default HomeEntry;
