import { Analytics } from "@vercel/analytics/react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { JarvisProvider } from "@/contexts/JarvisContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import Index from "./pages/Index";
import Landing from "./pages/Landing";
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
import TimeTracking from "./pages/TimeTracking";
import CRM from "./pages/CRM";
import Equipe from "./pages/Equipe";
import Contratos from "./pages/Contratos";
import Checkout from "./pages/Checkout";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
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
        <Analytics />
        <BrowserRouter>
          <AuthProvider>
            <JarvisProvider>
            <Routes>
              <Route path="/landing" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/reset-password" element={<ResetPassword />} />
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
              {/* Novos módulos */}
              <Route path="/time-tracking" element={<ProtectedRoute><TimeTracking /></ProtectedRoute>} />
              <Route path="/crm" element={<ProtectedRoute><CRM /></ProtectedRoute>} />
              <Route path="/equipe" element={<ProtectedRoute><Equipe /></ProtectedRoute>} />
              <Route path="/contratos" element={<ProtectedRoute><Contratos /></ProtectedRoute>} />
              <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </JarvisProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
