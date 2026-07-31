import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Index from "@/pages/Index";

const HomeEntry = () => {
  return (
    <ProtectedRoute>
      <Index />
    </ProtectedRoute>
  );
};

export default HomeEntry;
