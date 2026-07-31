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

const PoliticaPrivacidade = () => (
  <PublicLegalLayout
    title="Política de Privacidade"
    description="Esta política explica como o ADVeyes trata dados pessoais e dados autorizados pelo usuário na integração com o Google Calendar."
    updatedAt="28 de julho de 2026"
  >
    <Section title="1. Quem somos">
      <p>
        O ADVeyes é uma plataforma de gestão jurídica operada pela Automatikus.
        Para assuntos de privacidade, solicitações de titulares ou dúvidas sobre
        esta política, entre em contato pelo e-mail{" "}
        <a
          href="mailto:marcelolaranjeira33@gmail.com"
          className="font-medium text-blue-700 underline"
        >
          marcelolaranjeira33@gmail.com
        </a>
        .
      </p>
    </Section>

    <Section title="2. Dados tratados pelo ADVeyes">
      <p>
        Podemos tratar dados de cadastro, perfil, autenticação, clientes,
        processos, tarefas, audiências, compromissos, documentos, registros
        financeiros e informações técnicas necessárias ao funcionamento e à
        segurança da plataforma.
      </p>
      <p>
        O tratamento ocorre para prestar o serviço contratado, manter a conta,
        executar funcionalidades solicitadas, proteger o sistema, cumprir
        obrigações legais e atender direitos dos usuários.
      </p>
    </Section>

    <Section title="3. Integração com o Google Calendar">
      <p>
        A integração é opcional e somente é ativada depois que o usuário clica em
        conectar e concede sua autorização na tela do Google.
      </p>
      <p>Quando autorizada, o ADVeyes poderá acessar:</p>
      <ul className="list-disc space-y-2 pl-6">
        <li>o endereço de e-mail da Conta Google conectada;</li>
        <li>
          a permissão para ver, criar, alterar e excluir eventos em calendários
          pertencentes ao usuário;
        </li>
        <li>
          identificadores e informações dos eventos criados ou sincronizados
          pelo ADVeyes, como título, descrição, data, horário e local.
        </li>
      </ul>
      <p>
        Esses dados são usados exclusivamente para oferecer a sincronização de
        agenda solicitada pelo usuário. O ADVeyes não usa dados do Google
        Calendar para publicidade, criação de perfil publicitário ou venda de
        informações.
      </p>
    </Section>

    <Section title="4. Armazenamento e proteção das credenciais Google">
      <p>
        Tokens OAuth são mantidos no backend, criptografados antes do
        armazenamento e separados por usuário. Eles não são disponibilizados ao
        navegador nem compartilhados com outros clientes do ADVeyes.
      </p>
      <p>
        Adotamos controles de acesso, isolamento por usuário, registros de erro
        sem exposição de segredos e medidas técnicas compatíveis com a natureza
        dos dados tratados.
      </p>
    </Section>

    <Section title="5. Compartilhamento">
      <p>
        Dados pessoais podem ser processados por fornecedores de infraestrutura
        indispensáveis à operação, como hospedagem, banco de dados e serviços
        integrados, sempre limitados à finalidade contratada. Não vendemos dados
        pessoais nem dados obtidos pelas APIs do Google.
      </p>
      <p>
        Também poderemos compartilhar informações quando necessário para cumprir
        obrigação legal, ordem de autoridade competente ou proteger direitos e a
        segurança da plataforma e de seus usuários.
      </p>
    </Section>

    <Section title="6. Uso limitado de dados Google">
      <p>
        O uso e a transferência de informações recebidas das APIs do Google pelo
        ADVeyes obedecem à Política de Dados do Usuário dos Serviços de API do
        Google, incluindo os requisitos de Uso Limitado. O acesso é restrito à
        funcionalidade de sincronização de agenda exibida ao usuário.
      </p>
    </Section>

    <Section title="7. Retenção, desconexão e exclusão">
      <p>
        O usuário pode desconectar o Google Calendar a qualquer momento nas
        configurações do ADVeyes. A desconexão revoga a credencial armazenada e
        interrompe novas sincronizações. O usuário poderá escolher se deseja
        solicitar a remoção dos eventos criados pelo ADVeyes antes da
        desconexão.
      </p>
      <p>
        O acesso também pode ser revogado diretamente na Conta Google. Pedidos de
        exclusão de dados podem ser enviados ao nosso canal de contato e serão
        tratados conforme a legislação aplicável e as obrigações de retenção.
      </p>
    </Section>

    <Section title="8. Direitos dos titulares">
      <p>
        Nos termos da LGPD, o titular poderá solicitar, quando aplicável,
        confirmação de tratamento, acesso, correção, anonimização, bloqueio,
        exclusão, portabilidade, informações sobre compartilhamento e revogação
        do consentimento.
      </p>
    </Section>

    <Section title="9. Atualizações desta política">
      <p>
        Esta política poderá ser atualizada para refletir mudanças legais,
        técnicas ou funcionais. A versão vigente permanecerá disponível nesta
        página, com a data da última atualização.
      </p>
    </Section>
  </PublicLegalLayout>
);

export default PoliticaPrivacidade;

