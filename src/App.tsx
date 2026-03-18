import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import Index from "./pages/Index";
import Processos from "./pages/Processos";
import Clientes from "./pages/Clientes";
import Agenda from "./pages/Agenda";
import Documentos from "./pages/Documentos";
import BuscaJurisprudencia from "./pages/BuscaJurisprudencia";
import Audiencias from "./pages/Audiencias";
import Financeiro from "./pages/Financeiro";
import Tarefas from "./pages/Tarefas";
import Publicacoes from "./pages/Publicacoes";
import Relatorios from "./pages/Relatorios";
import IAJuridica from "./pages/IAJuridica";
import PortalCliente from "./pages/PortalCliente";
import Configuracoes from "./pages/Configuracoes";
import WhatsApp from "./pages/WhatsApp";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import PortalLogin from "./pages/portal/PortalLogin";
import PortalDashboard from "./pages/portal/PortalDashboard";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              {/* Portal do Cliente (public, token-based) */}
              <Route path="/portal" element={<PortalLogin />} />
              <Route path="/portal/dashboard" element={<PortalDashboard />} />
              {/* Protected lawyer routes */}
              <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/processos" element={<ProtectedRoute><Processos /></ProtectedRoute>} />
              <Route path="/clientes" element={<ProtectedRoute><Clientes /></ProtectedRoute>} />
              <Route path="/agenda" element={<ProtectedRoute><Agenda /></ProtectedRoute>} />
              <Route path="/tarefas" element={<ProtectedRoute><Tarefas /></ProtectedRoute>} />
              <Route path="/documentos" element={<ProtectedRoute><Documentos /></ProtectedRoute>} />
              <Route path="/busca" element={<ProtectedRoute><BuscaJurisprudencia /></ProtectedRoute>} />
              <Route path="/jurisprudencia" element={<ProtectedRoute><BuscaJurisprudencia /></ProtectedRoute>} />
              <Route path="/audiencias" element={<ProtectedRoute><Audiencias /></ProtectedRoute>} />
              <Route path="/financeiro" element={<ProtectedRoute><Financeiro /></ProtectedRoute>} />
              <Route path="/publicacoes" element={<ProtectedRoute><Publicacoes /></ProtectedRoute>} />
              <Route path="/relatorios" element={<ProtectedRoute><Relatorios /></ProtectedRoute>} />
              <Route path="/ia-juridica" element={<ProtectedRoute><IAJuridica /></ProtectedRoute>} />
              <Route path="/whatsapp" element={<ProtectedRoute><WhatsApp /></ProtectedRoute>} />
              <Route path="/portal-cliente" element={<ProtectedRoute><PortalCliente /></ProtectedRoute>} />
              <Route path="/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
