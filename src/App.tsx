import { Analytics } from "@vercel/analytics/react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { TenantProvider } from "@/contexts/TenantContext";
import { PlatformSupportProvider } from "@/contexts/PlatformSupportContext";
import { BrandProvider } from "@/contexts/BrandContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { JarvisProvider } from "@/contexts/JarvisContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import Landing from "./pages/Landing";
import Processos from "./pages/Processos";
import ProcessoDetalhe from "./pages/ProcessoDetalhe";
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
import Cadastro from "./pages/Cadastro";
import CadastroConcluir from "./pages/CadastroConcluir";
import Onboarding from "./pages/Onboarding";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import PortalLogin from "./pages/portal/PortalLogin";
import PortalDashboard from "./pages/portal/PortalDashboard";
import PoliticaPrivacidade from "./pages/PoliticaPrivacidade";
import TermosUso from "./pages/TermosUso";
import ConviteAceite from "./pages/ConviteAceite";
import HomeEntry from "./pages/HomeEntry";
import PlatformAdmin from "./pages/PlatformAdmin";
import IntegracoesJuridicas from "./pages/IntegracoesJuridicas";
import { AuthenticatedRoute } from "@/components/auth/AuthenticatedRoute";
import { PlatformAdminRoute } from "@/components/auth/PlatformAdminRoute";
import { AppLayout } from "@/components/layout/AppLayout";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Analytics />
        <BrowserRouter>
          <AuthProvider>
            <TenantProvider>
              <PlatformSupportProvider>
                <BrandProvider>
                <SubscriptionProvider>
                  <JarvisProvider>
                  <Routes>
                    <Route path="/landing" element={<Landing />} />
                    <Route path="/privacidade" element={<PoliticaPrivacidade />} />
                    <Route path="/termos" element={<TermosUso />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/cadastro" element={<Cadastro />} />
                    <Route
                      path="/cadastro/concluir"
                      element={<AuthenticatedRoute><CadastroConcluir /></AuthenticatedRoute>}
                    />
                    <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/convite/aceitar" element={<ConviteAceite />} />
                    {/* Portal do Cliente (public, token-based) */}
                    <Route path="/portal" element={<PortalLogin />} />
                    <Route path="/portal/dashboard" element={<PortalDashboard />} />
                    {/* Protected lawyer routes */}
                    <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                      <Route
                        path="/"
                        element={<AuthenticatedRoute><HomeEntry /></AuthenticatedRoute>}
                      />
                      <Route
                        path="/admin"
                        element={
                          <AuthenticatedRoute>
                            <PlatformAdminRoute>
                              <PlatformAdmin />
                            </PlatformAdminRoute>
                          </AuthenticatedRoute>
                        }
                      />
                      <Route path="/processos" element={<Processos />} />
                      <Route path="/processos/:id" element={<ProcessoDetalhe />} />
                      <Route path="/clientes" element={<Clientes />} />
                      <Route path="/agenda" element={<Agenda />} />
                      <Route path="/tarefas" element={<Tarefas />} />
                      <Route path="/documentos" element={<Documentos />} />
                      <Route path="/busca" element={<BuscaJurisprudencia />} />
                      {/* Jurisprudência abria a mesma busca processual.
                          O endereço antigo continua válido para não quebrar
                          links salvos pelos usuários. */}
                      <Route path="/jurisprudencia" element={<Navigate to="/busca" replace />} />
                      <Route path="/integracoes-juridicas" element={<IntegracoesJuridicas />} />
                      <Route path="/audiencias" element={<Audiencias />} />
                      <Route path="/financeiro" element={<Financeiro />} />
                      <Route path="/publicacoes" element={<Publicacoes />} />
                      <Route path="/relatorios" element={<Relatorios />} />
                      <Route path="/ia-juridica" element={<IAJuridica />} />
                      <Route path="/whatsapp" element={<WhatsApp />} />
                      <Route path="/portal-cliente" element={<PortalCliente />} />
                      <Route path="/configuracoes" element={<Configuracoes />} />
                      {/* Novos módulos */}
                      <Route path="/time-tracking" element={<TimeTracking />} />
                      <Route path="/crm" element={<CRM />} />
                      <Route path="/equipe" element={<Equipe />} />
                      <Route path="/contratos" element={<Contratos />} />
                      <Route path="/checkout" element={<Checkout />} />
                    </Route>
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                  </JarvisProvider>
                </SubscriptionProvider>
                </BrandProvider>
              </PlatformSupportProvider>
            </TenantProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
