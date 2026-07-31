import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { LogoMark } from "@/components/common/Logo";

interface PublicLegalLayoutProps {
  title: string;
  description: string;
  updatedAt: string;
  children: ReactNode;
}

export const PublicLegalLayout = ({
  title,
  description,
  updatedAt,
  children,
}: PublicLegalLayoutProps) => (
  <div className="min-h-screen bg-slate-50 text-slate-800">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <Link to="/landing" className="flex items-center gap-3" aria-label="ADVeyes">
          <LogoMark size="sm" />
          <div>
            <p className="font-serif text-base font-bold tracking-widest text-[#1a2a5e]">
              ADVEYES
            </p>
            <p className="text-[9px] uppercase tracking-[0.2em] text-slate-500">
              Gestão jurídica
            </p>
          </div>
        </Link>
        <Link
          to="/landing"
          className="flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-[#1a2a5e]"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
      </div>
    </header>

    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="mb-10 border-b border-slate-200 pb-8">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#c8960c]">
          ADVeyes
        </p>
        <h1 className="font-serif text-3xl font-bold text-[#1a2a5e] sm:text-4xl">
          {title}
        </h1>
        <p className="mt-4 max-w-3xl leading-relaxed text-slate-600">{description}</p>
        <p className="mt-4 text-sm text-slate-500">Última atualização: {updatedAt}</p>
      </div>

      <article className="space-y-8 leading-relaxed text-slate-700">{children}</article>
    </main>

    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8 text-sm text-slate-500 sm:px-6 md:flex-row md:items-center md:justify-between">
        <p>© 2026 ADVeyes · Operado pela Automatikus</p>
        <nav className="flex flex-wrap gap-5">
          <Link to="/privacidade" className="hover:text-[#1a2a5e]">
            Privacidade
          </Link>
          <Link to="/termos" className="hover:text-[#1a2a5e]">
            Termos de Uso
          </Link>
          <a href="mailto:marcelolaranjeira33@gmail.com" className="hover:text-[#1a2a5e]">
            Contato
          </a>
        </nav>
      </div>
    </footer>
  </div>
);

