/**
 * Office Employees Database, AI State Archetypes, Deduction Rules, and Murderer Logic
 */

export type NPCBehaviorState = 
  | 'WORKING_DESK' 
  | 'WALKING_WAYPOINTS' 
  | 'COFFEE_BREAK' 
  | 'DISCUSSING' 
  | 'CHECKING_WHITEBOARD'
  | 'SNEAKING' 
  | 'NERVOUS_PANIC';

export interface EmployeeProfile {
  id: string;
  name: string;
  role: string;
  department: string;
  registeredAttire: string;
  actualAttire: string;
  hairStyle: 'short' | 'curly' | 'ponytail' | 'slick' | 'afro' | 'bald';
  hasGlasses: boolean;
  attireColor: {
    shirt: number;
    pants: number;
    hair: number;
    skin: number;
    shoes: number;
    accessory?: number;
  };
  assignedRoom: string;
  currentLocationName: string;
  assignedTask: string;
  currentActivity: string;
  isMurderer: boolean;
  nervousnessLevel: number; // 0 to 1
  dialogueNormal: string[];
  dialogueNervous: string[];
  killerConfessionClue?: string;
  spawnPosition: [number, number, number];
  assignedDeskIndex?: number;
  homeNodeId: string;
}

export interface MatchDossier {
  employees: EmployeeProfile[];
  murdererId: string;
  murdererIds: string[];
  secretWeapon: string;
  motive: string;
  themeStyle: 'modern_tech' | 'corporate_law' | 'fintech';
  phase: number;
}

const FIRST_NAMES = [
  'Lucas', 'Beatriz', 'Carlos', 'Mariana', 'Rodrigo', 
  'Juliana', 'Thiago', 'Fernanda', 'Gabriel', 'Camila',
  'Eduardo', 'Larissa', 'Bruno', 'Renata', 'Felipe',
  'Vinicius', 'Amanda', 'Rafaela', 'Gustavo', 'Helena'
];

const LAST_NAMES = [
  'Silva', 'Mendes', 'Drumond', 'Costa', 'Lima',
  'Paes', 'Rocha', 'Souza', 'Alencar', 'Barbosa',
  'Ribeiro', 'Carvalho', 'Monteiro', 'Vasconcelos', 'Pinto'
];

interface RoleTemplate {
  role: string;
  department: string;
  expectedAttire: string;
  expectedTask: string;
  validRooms: string[];
  normalShirtColor: number;
  normalPantsColor: number;
  dialogues: string[];
}

const ROLES: RoleTemplate[] = [
  {
    role: 'Engenheiro de Software Sênior',
    department: 'Tecnologia / Dev',
    expectedAttire: 'Camisa Polo Azul e Calça Jeans Preta',
    expectedTask: 'Compilando microsserviços no cluster e revisando Pull Requests.',
    validRooms: ['Bullpen Principal', 'Sala dos Servidores'],
    normalShirtColor: 0x1d4ed8,
    normalPantsColor: 0x1e293b,
    dialogues: [
      'Chefe, o deploy de sexta passou sem nenhum bug crítico!',
      'Só mais 10 minutos para subir o patch de segurança...',
      'Café acabou na máquina... meu cérebro vai reiniciar.'
    ]
  },
  {
    role: 'Contador Chefe',
    department: 'Financeiro',
    expectedAttire: 'Camisa Social Branca com Gravata e Calça Alfaiataria Cinza',
    expectedTask: 'Fechamento do balanço fiscal do Q4 e conciliação bancária.',
    validRooms: ['Bullpen Principal', 'Sala de Arquivos'],
    normalShirtColor: 0xf8fafc,
    normalPantsColor: 0x475569,
    dialogues: [
      'Boa tarde, Dr. Diretor. A auditoria fiscal está nos conformes.',
      'A planilha de despesas bateu até o último centavo.',
      'Os relatórios de lucros estão sobre a mesa.'
    ]
  },
  {
    role: 'Zelador e Manutenção',
    department: 'Facilities & Limpeza',
    expectedAttire: 'Macacão Azul-Marinho de Trabalho com Crachá Plástico e Luvas Amarelas',
    expectedTask: 'Reposição de água mineral, checagem de lâmpadas e limpeza de carpetes.',
    validRooms: ['Copa / Cozinha', 'Corredor Central', 'Sala de Arquivos'],
    normalShirtColor: 0x0369a1,
    normalPantsColor: 0x075985,
    dialogues: [
      'O chão tá quase seco por aqui, cuidado pra não escorregar, chefe!',
      'Troquei o galão do bebedouro agora há pouco.',
      'Vou dar uma olhada na lâmpada fluorescente que tá piscando.'
    ]
  },
  {
    role: 'Diretora de Recursos Humanos',
    department: 'Gente & Gestão',
    expectedAttire: 'Blazer Roxo Executivo e Calça Preta de Alfaiataria',
    expectedTask: 'Entrevistas de promoção interna e pesquisa de clima organizacional.',
    validRooms: ['Sala de Reunião', 'Bullpen Principal'],
    normalShirtColor: 0x7c3aed,
    normalPantsColor: 0x18181b,
    dialogues: [
      'O clima da equipe melhorou 15% após a nova política de home office.',
      'Estou revisando as avaliações de desempenho deste trimestre.',
      'Preciso da sua assinatura nos novos contratos, chefe.'
    ]
  },
  {
    role: 'Designer de Produto UI/UX',
    department: 'Design',
    expectedAttire: 'Suéter Verde Esmeralda e Calça Chino Bege',
    expectedTask: 'Ajustando protótipo interativo no Figma e paletas de contraste.',
    validRooms: ['Bullpen Principal', 'Sala de Reunião'],
    normalShirtColor: 0x059669,
    normalPantsColor: 0xd97706,
    dialogues: [
      'O novo dashboard do cliente tá ficando incrivelmente intuitivo.',
      'Testando cores com melhor acessibilidade visual.',
      'Chefe, aprova o novo ícone do aplicativo?'
    ]
  },
  {
    role: 'Estagiário de TI',
    department: 'Tecnologia',
    expectedAttire: 'Camiseta Preta Geek e Tênis Vermelho',
    expectedTask: 'Formatando notebooks antigos e organizando cabos de rede.',
    validRooms: ['Sala dos Servidores', 'Bullpen Principal', 'Copa / Cozinha'],
    normalShirtColor: 0x27272a,
    normalPantsColor: 0x3f3f46,
    dialogues: [
      'O-oi chefe! Tô só... pesquisando no StackOverflow, juro!',
      'Será que vou ser efetivado no fim do ano?!',
      'Reiniciei o roteador e a internet voltou ao normal!'
    ]
  },
  {
    role: 'Gerente de Contas / Vendas',
    department: 'Comercial',
    expectedAttire: 'Terno Slim Azul Petróleo e Sapato Social',
    expectedTask: 'Fechando contrato milionário via videoconferência.',
    validRooms: ['Sala de Reunião', 'Corredor Central'],
    normalShirtColor: 0x0e7490,
    normalPantsColor: 0x164e63,
    dialogues: [
      'Acabamos de bater a meta mensal antes do dia 20!',
      'O cliente de São Paulo assinou a proposta estendida.',
      'Sempre em busca de novas oportunidades de expansão!'
    ]
  },
  {
    role: 'Recepcionista Executiva',
    department: 'Atendimento & Recepção',
    expectedAttire: 'Tailleur Vermelho Coral e Lenço de Seda',
    expectedTask: 'Triagem de encomendas, crachás de visitantes e ligações da diretoria.',
    validRooms: ['Recepção / Entrada', 'Copa / Cozinha'],
    normalShirtColor: 0xe11d48,
    normalPantsColor: 0x881337,
    dialogues: [
      'Nenhum visitante estranho registrado na portaria hoje, senhor.',
      'As encomendas do correio já foram protocoladas.',
      'Deseja que eu reserve uma sala para a reunião da tarde?'
    ]
  },
  {
    role: 'Especialista em Cibersegurança',
    department: 'Segurança da Informação',
    expectedAttire: 'Jaqueta Bomber Preta com Crachá Criptográfico',
    expectedTask: 'Monitorando logs de invasão no firewall perimetral.',
    validRooms: ['Sala dos Servidores', 'Bullpen Principal'],
    normalShirtColor: 0x18181b,
    normalPantsColor: 0x27272a,
    dialogues: [
      'Detectei três tentativas de phishing hoje cedo, já bloqueadas.',
      'Verificando certificados SSL dos servidores principais.',
      'Todos os acessos VPN estão sob autenticação de dois fatores.'
    ]
  },
  {
    role: 'Analista de Marketing Digital',
    department: 'Marketing & Mídia',
    expectedAttire: 'Camisa Amarela Mostarda e Calça Jeans Clara',
    expectedTask: 'Otimizando campanhas de tráfego pago e métricas de conversão.',
    validRooms: ['Bullpen Principal', 'Copa / Cozinha'],
    normalShirtColor: 0xd97706,
    normalPantsColor: 0x0284c7,
    dialogues: [
      'A campanha de lançamento gerou 40% mais leads esta semana!',
      'Preparando o press release para a imprensa especializada.',
      'O engajamento nas redes sociais está em alta recorde.'
    ]
  },
  {
    role: 'Diretor Jurídico Corporativo',
    department: 'Jurídico & Compliance',
    expectedAttire: 'Terno Risca de Giz Grafite e Pasta de Couro',
    expectedTask: 'Revisão de cláusulas de confidencialidade e patentes.',
    validRooms: ['Sala de Reunião', 'Gabinete do CEO'],
    normalShirtColor: 0x334155,
    normalPantsColor: 0x1e293b,
    dialogues: [
      'O contrato com a multinacional protege 100% da propriedade intelectual.',
      'A conformidade com a LGPD foi atestada sem ressalvas.',
      'Aguardando seu parecer final na minuta de aquisição, Dr.'
    ]
  },
  {
    role: 'Consultor de Estratégia Externa',
    department: 'Consultoria Estratégica',
    expectedAttire: 'Blazer Azul Petróleo com Lenço de Bolso Branco',
    expectedTask: 'Mapeando concorrentes e projetando valuation para o próximo ano.',
    validRooms: ['Sala de Reunião', 'Bullpen Principal'],
    normalShirtColor: 0x0369a1,
    normalPantsColor: 0x0f172a,
    dialogues: [
      'A eficiência operacional da sua equipe supera a média do setor em 22%.',
      'Finalizando o modelo preditivo de fluxo de caixa para os acionistas.',
      'Uma fusão no momento certo multiplicará o valor por três.'
    ]
  },
  {
    role: 'Engenheiro Eletricista Chefe',
    department: 'Subestação & Geradores (2º Andar)',
    expectedAttire: 'Macacão Amarelo de Alta Tensão com Capacete Branco e Luvas Isolantes',
    expectedTask: 'Monitorando pressão dos turbogeradores a diesel e banco de capacitores no 2º andar.',
    validRooms: ['2º Andar - Sala dos Geradores', 'Sala dos Servidores'],
    normalShirtColor: 0xeab308,
    normalPantsColor: 0xca8a04,
    dialogues: [
      'Os geradores a diesel no 2º andar estão com 100% de capacidade nos tanques!',
      'A voltagem da subestação está regulada em 380V estáveis, tudo seguro.',
      'Se faltar luz, basta acionar a alavanca do disjuntor principal no 2º andar!'
    ]
  },
  {
    role: 'Operador de Subestação e Geradores',
    department: 'Subestação & Geradores (2º Andar)',
    expectedAttire: 'Colete Refletivo Laranja com Óculos de Proteção e Botas com Biqueira',
    expectedTask: 'Inspeção preventiva dos barramentos blindados e checagem de óleo dos geradores.',
    validRooms: ['2º Andar - Sala dos Geradores', '2º Andar - Hall Técnico'],
    normalShirtColor: 0xf97316,
    normalPantsColor: 0x334155,
    dialogues: [
      'Tudo nos conformes por aqui nos geradores do segundo piso, chefe!',
      'Troquei os fusíveis da linha principal da subestação agora há pouco.',
      'O barulho dos motores é alto, mas a energia do prédio tá garantida.'
    ]
  },
  {
    role: 'Técnico de Automação e Redes Elétricas',
    department: 'Manutenção & Engenharia Predial',
    expectedAttire: 'Camisa Polo Cinza Grafite com Emblema da Engenharia e Multímetro Digital',
    expectedTask: 'Calibrando termostatos e circuitos de desarme dos disjuntores centrais.',
    validRooms: ['2º Andar - Sala dos Geradores', 'Bullpen Principal'],
    normalShirtColor: 0x475569,
    normalPantsColor: 0x1e293b,
    dialogues: [
      'Sensores térmicos do 2º piso indicando temperatura operacional ideal.',
      'O banco de baterias sustenta os computadores durante qualquer oscilação.',
      'Testando os relés de sobrecarga do gerador reserva.'
    ]
  },
  {
    role: 'Auditora de Fraudes Corporativas',
    department: 'Compliance & Risco',
    expectedAttire: 'Terno Feminino Azul Marinho e Pasta com Selo Oficial de Auditoria',
    expectedTask: 'Auditando registros de transferências bancárias anômalas e acessos biométricos.',
    validRooms: ['Sala de Reunião', 'Gabinete do CEO'],
    normalShirtColor: 0x1e3a8a,
    normalPantsColor: 0x0f172a,
    dialogues: [
      'Encontrei discrepâncias graves em algumas requisições de compra recentes...',
      'Estou cruzando os horários dos crachás com os acessos ao cofre da diretoria.',
      'Tenho suspeitas de que há um sabotador infiltrado entre nossos funcionários!'
    ]
  },
  {
    role: 'Vice-Presidente de Operações (COO)',
    department: 'Diretoria Executiva',
    expectedAttire: 'Costume Sob Medida Cinza Chumbo com Gravata Bordô e Abotoaduras',
    expectedTask: 'Supervisionando a produtividade geral e cumprimento das metas de expansão.',
    validRooms: ['Gabinete do CEO', 'Sala de Reunião', '2º Andar - Hall Técnico'],
    normalShirtColor: 0x334155,
    normalPantsColor: 0x18181b,
    dialogues: [
      'Bom dia, Diretor. O fechamento trimestral superou em 18% as nossas metas.',
      'A logística e as operações do prédio estão funcionando com precisão.',
      'Os investidores estrangeiros chegam amanhã para a assinatura final.'
    ]
  },
  {
    role: 'Cientista de Dados Sênior',
    department: 'Inteligência Artificial & Analytics',
    expectedAttire: 'Moletom Azul Turquesa com Logotipo Tech e Calça Jogger',
    expectedTask: 'Treinando modelo preditivo de receitas e analisando anomalias no cluster.',
    validRooms: ['Bullpen Principal', 'Sala dos Servidores'],
    normalShirtColor: 0x0891b2,
    normalPantsColor: 0x1e293b,
    dialogues: [
      'O modelo preditivo apontou 98.7% de probabilidade de lucro recorde!',
      'O cluster de GPUs tá rodando a todo vapor na sala dos servidores.',
      'Acabei de gerar os gráficos de correlação para a apresentação.'
    ]
  },
  {
    role: 'Advogada de Propriedade Intelectual',
    department: 'Jurídico Corporativo',
    expectedAttire: 'Blazer Verde Oliva e Saia Lápis Preta com Pasta Executiva',
    expectedTask: 'Protocolando patentes industriais dos novos produtos no cartório.',
    validRooms: ['Sala de Reunião', 'Bullpen Principal'],
    normalShirtColor: 0x15803d,
    normalPantsColor: 0x09090b,
    dialogues: [
      'As três patentes principais da empresa foram blindadas internacionalmente.',
      'Nenhum concorrente poderá clonar a nossa tecnologia.',
      'Contratos de não-divulgação assinados por toda a equipe.'
    ]
  },
  {
    role: 'Gerente de Segurança Predial',
    department: 'Segurança Física & Patrimonial',
    expectedAttire: 'Uniforme Tático Cinza Militar com Rádio Comunicador e Crachá de Acesso Geral',
    expectedTask: 'Ronda preventiva nos dois andares e monitoramento do circuito interno de câmeras.',
    validRooms: ['Recepção / Entrada', '2º Andar - Hall Técnico', 'Corredor Central'],
    normalShirtColor: 0x374151,
    normalPantsColor: 0x111827,
    dialogues: [
      'Circuito de segurança e câmeras operando nos dois andares sem falhas.',
      'Qualquer movimento suspeito nos corredores, estarei atento!',
      'Rádio comunicador na frequência da portaria.'
    ]
  },
  {
    role: 'Capitão da Polícia Militar',
    department: 'Polícia Militar / Batalhão Especial',
    expectedAttire: 'Farda Azul-Marinho da Polícia com Brasão Dourado, Quepe e Coldre Tático',
    expectedTask: 'Investigando denúncia anônima de infiltração armada e fazendo ronda de proteção.',
    validRooms: ['Recepção / Entrada', 'Gabinete do CEO', 'Corredor Central', '2º Andar - Hall Técnico'],
    normalShirtColor: 0x0f172a,
    normalPantsColor: 0x1e293b,
    dialogues: [
      'Diretor, viemos verificar uma denúncia anônima de infiltrados no prédio.',
      'Estamos fazendo a varredura preventiva nos dois pavimentos.',
      'Mantenha a calma, senhor, qualquer suspeito será abordado.'
    ]
  },
  {
    role: 'Investigador da Polícia Civil',
    department: 'Polícia Civil / Divisão de Homicídios',
    expectedAttire: 'Camisa Social Cinza com Distintivo Policial Pendurado no Pescoço e Coldre de Ombro',
    expectedTask: 'Coletando depoimentos de funcionários e cruzando registros de ocorrências na empresa.',
    validRooms: ['Sala de Reunião', 'Bullpen Principal', 'Gabinete do CEO'],
    normalShirtColor: 0x334155,
    normalPantsColor: 0x0f172a,
    dialogues: [
      'Estou revisando as fichas cadastrais dos últimos contratados.',
      'Nenhuma ocorrência grave registrada na delegacia até agora.',
      'Qualquer movimentação estranha nos avise imediatamente.'
    ]
  },
  {
    role: 'Perita Criminal Forense',
    department: 'Instituto de Criminalística Policial',
    expectedAttire: 'Colete Preto Perícia Técnico-Científica com Maleta de Amostragem Forense',
    expectedTask: 'Analisando digitais nas portas de segurança e checando materiais suspeitos.',
    validRooms: ['Sala de Arquivos', 'Copa / Cozinha', '2º Andar - Sala dos Geradores'],
    normalShirtColor: 0x18181b,
    normalPantsColor: 0x18181b,
    dialogues: [
      'Fazendo coleta de amostras e digitais nas maçanetas.',
      'Os laudos periciais serão emitidos em breve.',
      'Nossos testes preliminares estão em andamento.'
    ]
  },
  {
    role: 'Oficial Tático de Choque',
    department: 'Polícia Tática Especial',
    expectedAttire: 'Uniforme Tático Preto Completo com Colete Balístico e Quepe Tático',
    expectedTask: 'Montando perímetro de segurança na recepção e vistoriando áreas restritas.',
    validRooms: ['Recepção / Entrada', 'Corredor Central', '2º Andar - Sala dos Geradores'],
    normalShirtColor: 0x09090b,
    normalPantsColor: 0x09090b,
    dialogues: [
      'Perímetro de segurança estabelecido nos acessos do edifício.',
      'Varredura dos corredores em andamento, chefe.',
      'Atenção redobrada a qualquer comportamento fora do padrão.'
    ]
  }
];

export function generateMatchData(phase: number = 1): MatchDossier {
  // Scale up to 15 killers for 15 phases!
  const killerCount = Math.max(1, Math.min(15, phase));
  // Total employees dynamically scaled: 16 in Phase 1 up to 34 employees in later phases
  const numEmployees = Math.min(34, Math.max(16, 14 + killerCount * 2));
  const employees: EmployeeProfile[] = [];

  // Build role pool by sampling or repeating roles if needed
  const selectedRoles: RoleTemplate[] = [];
  while (selectedRoles.length < numEmployees) {
    const shuffled = [...ROLES].sort(() => Math.random() - 0.5);
    for (const r of shuffled) {
      if (selectedRoles.length < numEmployees) {
        selectedRoles.push(r);
      }
    }
  }

  const usedNames = new Set<string>();
  const getRandomName = () => {
    let name = '';
    let attempts = 0;
    do {
      const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
      const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
      name = `${first} ${last}`;
      attempts++;
    } while (usedNames.has(name) && attempts < 50);
    if (usedNames.has(name)) {
      name = `${name} Jr.`;
    }
    usedNames.add(name);
    return name;
  };

  // Select killerCount unique indices
  const killerIndices = new Set<number>();
  while (killerIndices.size < killerCount) {
    killerIndices.add(Math.floor(Math.random() * numEmployees));
  }

  const skinTones = [0xfbcfe8, 0xfde047, 0xfbbf24, 0xd97706, 0x92400e, 0x78350f];
  const hairColors = [0x18181b, 0x713f12, 0xd97706, 0xe2e8f0, 0x991b1b];
  const hairStyles: ('short' | 'curly' | 'ponytail' | 'slick' | 'afro' | 'bald')[] = ['short', 'curly', 'ponytail', 'slick', 'afro', 'bald'];

  for (let i = 0; i < numEmployees; i++) {
    const roleTpl = selectedRoles[i];
    const isMurderer = killerIndices.has(i);
    const skin = skinTones[Math.floor(Math.random() * skinTones.length)];
    const hair = hairColors[Math.floor(Math.random() * hairColors.length)];
    const hairStyle = hairStyles[Math.floor(Math.random() * hairStyles.length)];
    const hasGlasses = Math.random() < 0.35;

    let shirtColor = roleTpl.normalShirtColor;
    let pantsColor = roleTpl.normalPantsColor;
    let actualAttire = roleTpl.expectedAttire;
    let assignedRoom = roleTpl.validRooms[Math.floor(Math.random() * roleTpl.validRooms.length)];
    let currentRoom = assignedRoom;
    let currentTask = roleTpl.expectedTask;
    let nervousDialogue: string[] = [];
    let discrepancyType = -1;

    if (isMurderer) {
      discrepancyType = Math.floor(Math.random() * 4);

      if (discrepancyType === 0) {
        if (roleTpl.role.includes('Zelador')) {
          actualAttire = 'Smoking Preto Executivo com Abotoaduras de Ouro e Sapato Italiano';
          shirtColor = 0x09090b;
          pantsColor = 0x09090b;
        } else if (roleTpl.role.includes('Software') || roleTpl.role.includes('TI')) {
          actualAttire = 'Avental de Açougueiro com Luvas de Borracha Pesadas e Botas Militares';
          shirtColor = 0xb91c1c;
          pantsColor = 0x450a0a;
        } else {
          actualAttire = 'Moletom com Capuz Escuro, Luvas Táticas e Tênis de Invasão';
          shirtColor = 0x18181b;
          pantsColor = 0x18181b;
        }
      } else if (discrepancyType === 1) {
        if (roleTpl.role.includes('Contador') || roleTpl.role.includes('Marketing')) {
          currentRoom = 'Sala dos Servidores';
          currentTask = 'Cortando cabos da fibra ótica e inserindo pendrive malicioso.';
        } else if (roleTpl.role.includes('Zelador') || roleTpl.role.includes('Estagiário')) {
          currentRoom = 'Gabinete do CEO (Sua Sala)';
          currentTask = 'Mexendo na gaveta trancada da sua mesa e tentando abrir seu cofre.';
        } else {
          currentRoom = '2º Andar - Sala dos Geradores';
          currentTask = 'Sabotando os relés elétricos do gerador com alicate de corte.';
        }
      } else if (discrepancyType === 2) {
        actualAttire = 'Jaqueta Militar Camuflada com Coldre Oculto debaixo do braço';
        shirtColor = 0x3f6212;
        pantsColor = 0x14532d;
        currentRoom = 'Sala dos Servidores';
        currentTask = 'Instalando dispositivo detonador remoto sob o piso elevado.';
      } else {
        // Disguised Killer in Police/Security Gear without official badge in system
        actualAttire = 'Farda Falsa da Polícia com Emblema Desalinhado e Rádio Desligado';
        shirtColor = 0x0f172a;
        pantsColor = 0x18181b;
        currentRoom = 'Gabinete do CEO (Sua Sala)';
        currentTask = 'Revistando pastas confidenciais no armário executivo sem autorização.';
      }

      // Professional assassins disguise their inner monologue with normal/composed corporate thoughts
      // Discovery MUST rely on observant deduction of their actions and attire discrepancies!
      nervousDialogue = [
        'Preciso protocolar estes documentos antes do final do expediente...',
        'Onde arquivei aquela pasta de conciliação bancária?',
        'Tenho que revisar o cronograma da apresentação da diretoria...',
        'Vou tomar um café na copa antes da próxima reunião...',
        'Espero que a planilha de custos tenha sido salva na nuvem...',
        'A impressora do segundo andar parece que travou novamente...'
      ];
    } else {
      nervousDialogue = [
        'Ai meu Deus, será que esqueci de enviar o relatório diário?!',
        'O chefe tá me olhando com cara de bravo... será que fiz besteira?',
        'Finge que tá digitando rápido pro chefe achar que sou produtivo!',
        'Espero que ele não veja a aba do YouTube minimizada...',
        'Boa tarde, Dr. Diretor! Tudo em ordem por aqui!'
      ];
    }

    employees.push({
      id: `emp-${i}`,
      name: getRandomName(),
      role: roleTpl.role,
      department: roleTpl.department,
      registeredAttire: roleTpl.expectedAttire,
      actualAttire,
      hairStyle,
      hasGlasses,
      attireColor: {
        shirt: shirtColor,
        pants: pantsColor,
        hair,
        skin,
        shoes: 0x09090b,
        accessory: (isMurderer && discrepancyType === 0) ? 0xf59e0b : undefined
      },
      assignedRoom,
      currentLocationName: currentRoom,
      assignedTask: roleTpl.expectedTask,
      currentActivity: currentTask,
      isMurderer,
      nervousnessLevel: isMurderer ? 0.95 : (Math.random() < 0.35 ? 0.45 : 0.1),
      dialogueNormal: roleTpl.dialogues,
      dialogueNervous: nervousDialogue,
      spawnPosition: [0, 0, 0],
      homeNodeId: `node-desk-${i % 4}`,
      killerConfessionClue: isMurderer ? 'Encontrado contrato de assassinato no bolso com foto do Diretor!' : undefined
    });
  }

  const weapons = ['Pistola Silenciada 9mm', 'Frasco de Cianeto Puro', 'Cabo de Garrote de Titânio', 'Faca de Combate Cerâmica', 'Dardo Envenenado'];
  const motives = [
    'Contratado pelo fundo de investimento rival para assumir a patente da sua empresa.',
    'Ex-agente de espionagem corporativa enviado para sabotar a fusão internacional.',
    'Mercenário disfarçado visando roubar a chave criptográfica da carteira corporativa.',
    'Syndicate clandestino buscando liquidar o conselho diretor.'
  ];

  const themes: ('modern_tech' | 'corporate_law' | 'fintech')[] = ['modern_tech', 'corporate_law', 'fintech'];
  const murdererIds = employees.filter(e => e.isMurderer).map(e => e.id);

  return {
    employees,
    murdererId: murdererIds[0] || employees[0].id,
    murdererIds,
    secretWeapon: weapons[Math.floor(Math.random() * weapons.length)],
    motive: motives[Math.floor(Math.random() * motives.length)],
    themeStyle: themes[Math.floor(Math.random() * themes.length)],
    phase
  };
}
