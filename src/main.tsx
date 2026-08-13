import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            fontFamily: "sans-serif",
            background: "#0f1117",
            color: "#e2e8f0",
          }}
        >
          <div
            style={{
              maxWidth: "600px",
              width: "100%",
              background: "#1e2130",
              border: "1px solid #ef4444",
              borderRadius: "12px",
              padding: "32px",
            }}
          >
            <h2 style={{ color: "#ef4444", marginBottom: "16px", fontSize: "20px" }}>
              ⚠️ Erro no sistema
            </h2>
            <p style={{ color: "#94a3b8", marginBottom: "16px", fontSize: "14px" }}>
              Ocorreu um erro inesperado. Por favor, recarregue a página.
            </p>
            <pre
              style={{
                background: "#0f1117",
                padding: "16px",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#fca5a5",
                overflow: "auto",
                marginBottom: "24px",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {this.state.error.message}
              {"\n\n"}
              {this.state.error.stack}
            </pre>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: "8px",
                padding: "10px 24px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "600",
              }}
            >
              Recarregar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Registra o service worker e garante que uma versão nova chegue ao usuário.
 *
 * O registro morava dentro do hook de push, que só roda quando o navegador
 * suporta Notification e PushManager — e nunca pedia atualização. O resultado
 * era o usuário continuar com o pacote antigo depois de um deploy: a correção
 * estava publicada e a tela não mudava.
 *
 * `update()` obriga o navegador a buscar o `sw.js` em vez de esperar a própria
 * heurística. E `controllerchange` avisa que uma versão nova assumiu: a página
 * carregada ainda tem o JS e o CSS velhos na memória, então recarregar é o que
 * faz a correção aparecer. A guarda evita laço se a troca acontecer de novo.
 */
const registrarServiceWorker = () => {
  if (!("serviceWorker" in navigator)) return;

  navigator.serviceWorker
    .register("/sw.js")
    .then((registration) => registration.update())
    .catch(() => {
      // Sem service worker o app funciona; só perde o modo offline.
    });

  let recarregando = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (recarregando) return;
    recarregando = true;
    window.location.reload();
  });
};

registrarServiceWorker();

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
