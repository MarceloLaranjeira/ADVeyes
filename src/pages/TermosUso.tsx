import { PublicLegalLayout } from "@/components/public/PublicLegalLayout";

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <section>
    <h2 className="mb-3 font-serif text-xl font-bold text-[#1a2a5e]">{title}</h2>
    <div className="space-y-3">{children}</div>
  </section>
);

const TermosUso = () => (
  <PublicLegalLayout
    title="Termos de Uso"
    description="Estes termos regulam o acesso e o uso da plataforma ADVeyes e de suas integrações, incluindo o Google Calendar."
    updatedAt="28 de julho de 2026"
  >
    <Section title="1. Aceitação">
      <p>
        Ao criar uma conta ou utilizar o ADVeyes, o usuário declara que leu e
        concorda com estes Termos de Uso e com a Política de Privacidade. Caso não
        concorde, não deverá utilizar a plataforma.
      </p>
    </Section>

    <Section title="2. Finalidade do serviço">
      <p>
        O ADVeyes oferece recursos de apoio à gestão jurídica, incluindo
        organização de processos, clientes, tarefas, agenda, documentos,
        informações financeiras e integrações com serviços de terceiros.
      </p>
      <p>
        A plataforma é uma ferramenta de apoio e não substitui a análise
        profissional, a conferência de informações oficiais nem as
        responsabilidades legais e éticas do usuário.
      </p>
    </Section>

    <Section title="3. Conta e responsabilidades do usuário">
      <ul className="list-disc space-y-2 pl-6">
        <li>fornecer informações corretas e manter os dados atualizados;</li>
        <li>proteger suas credenciais e dispositivos de acesso;</li>
        <li>usar a plataforma de forma lícita e compatível com estes termos;</li>
        <li>
          possuir autorização para inserir e tratar dados de clientes, partes,
          colaboradores e terceiros;
        </li>
        <li>comunicar imediatamente qualquer acesso indevido identificado.</li>
      </ul>
    </Section>

    <Section title="4. Google Calendar">
      <p>
        A conexão com o Google Calendar é opcional. Cada usuário deverá autorizar
        sua própria Conta Google na tela oficial de consentimento do Google.
      </p>
      <p>
        Depois da autorização, o ADVeyes poderá criar, atualizar e excluir
        eventos em calendários pertencentes ao usuário, de acordo com as ações
        realizadas na plataforma. O usuário continua responsável pela Conta
        Google conectada e pelas informações sincronizadas.
      </p>
      <p>
        O usuário pode desconectar a integração a qualquer momento. A
        desconexão interrompe novas sincronizações, sem obrigatoriamente excluir
        eventos já criados, salvo quando essa remoção for solicitada durante o
        processo de desconexão.
      </p>
    </Section>

    <Section title="5. Serviços de terceiros">
      <p>
        Algumas funcionalidades dependem de serviços de terceiros, incluindo
        Google, tribunais, provedores de pagamento, hospedagem e comunicação.
        Indisponibilidades, alterações ou limitações desses serviços podem afetar
        temporariamente recursos do ADVeyes.
      </p>
    </Section>

    <Section title="6. Uso aceitável">
      <p>É proibido:</p>
      <ul className="list-disc space-y-2 pl-6">
        <li>usar o serviço para finalidade ilegal, fraudulenta ou abusiva;</li>
        <li>tentar acessar dados, contas ou recursos de outros usuários;</li>
        <li>interferir na segurança ou disponibilidade da plataforma;</li>
        <li>copiar, explorar ou distribuir o serviço de forma não autorizada;</li>
        <li>inserir conteúdo que viole direitos de terceiros.</li>
      </ul>
    </Section>

    <Section title="7. Disponibilidade e alterações">
      <p>
        Buscamos manter a plataforma disponível e segura, mas não garantimos
        operação ininterrupta. Poderemos realizar manutenções, correções e
        atualizações necessárias à evolução ou à proteção do serviço.
      </p>
    </Section>

    <Section title="8. Propriedade intelectual">
      <p>
        A marca, o software, a interface, os materiais e os demais elementos do
        ADVeyes pertencem aos seus respectivos titulares. O uso da plataforma não
        transfere ao usuário direitos de propriedade intelectual.
      </p>
      <p>
        Os dados e documentos inseridos pelo usuário permanecem sob sua
        responsabilidade e titularidade, ressalvados os direitos necessários à
        prestação do serviço.
      </p>
    </Section>

    <Section title="9. Suspensão e encerramento">
      <p>
        O acesso poderá ser suspenso em caso de violação destes termos, risco à
        segurança, inadimplência aplicável ou exigência legal. O usuário poderá
        solicitar o encerramento da conta e a exclusão de dados, observados os
        prazos e deveres legais de retenção.
      </p>
    </Section>

    <Section title="10. Contato">
      <p>
        Dúvidas sobre estes termos podem ser encaminhadas para{" "}
        <a
          href="mailto:marcelolaranjeira33@gmail.com"
          className="font-medium text-blue-700 underline"
        >
          marcelolaranjeira33@gmail.com
        </a>
        .
      </p>
    </Section>
  </PublicLegalLayout>
);

export default TermosUso;

