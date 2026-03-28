// Comparador de asesores fiscales por zona geogr\u00e1fica - RomainGE
// In-memory database de asesor\u00edas fiscales espa\u00f1olas

const POSTAL_TO_PROVINCE = {
  '01': '\u00c1lava', '02': 'Albacete', '03': 'Alicante', '04': 'Almer\u00eda',
  '05': '\u00c1vila', '06': 'Badajoz', '07': 'Illes Balears', '08': 'Barcelona',
  '09': 'Burgos', '10': 'C\u00e1ceres', '11': 'C\u00e1diz', '12': 'Castell\u00f3n',
  '13': 'Ciudad Real', '14': 'C\u00f3rdoba', '15': 'A Coru\u00f1a', '16': 'Cuenca',
  '17': 'Girona', '18': 'Granada', '19': 'Guadalajara', '20': 'Gipuzkoa',
  '21': 'Huelva', '22': 'Huesca', '23': 'Ja\u00e9n', '24': 'Le\u00f3n',
  '25': 'Lleida', '26': 'La Rioja', '27': 'Lugo', '28': 'Madrid',
  '29': 'M\u00e1laga', '30': 'Murcia', '31': 'Navarra', '32': 'Ourense',
  '33': 'Asturias', '34': 'Palencia', '35': 'Las Palmas', '36': 'Pontevedra',
  '37': 'Salamanca', '38': 'Santa Cruz de Tenerife', '39': 'Cantabria',
  '40': 'Segovia', '41': 'Sevilla', '42': 'Soria', '43': 'Tarragona',
  '44': 'Teruel', '45': 'Toledo', '46': 'Valencia', '47': 'Valladolid',
  '48': 'Bizkaia', '49': 'Zamora', '50': 'Zaragoza', '51': 'Ceuta', '52': 'Melilla'
};

const PROVINCE_TO_CCAA = {
  'Madrid': 'Comunidad de Madrid', '\u00c1lava': 'Pa\u00eds Vasco', 'Gipuzkoa': 'Pa\u00eds Vasco',
  'Bizkaia': 'Pa\u00eds Vasco', 'Barcelona': 'Catalu\u00f1a', 'Girona': 'Catalu\u00f1a',
  'Lleida': 'Catalu\u00f1a', 'Tarragona': 'Catalu\u00f1a', 'Valencia': 'Comunitat Valenciana',
  'Alicante': 'Comunitat Valenciana', 'Castell\u00f3n': 'Comunitat Valenciana',
  'Sevilla': 'Andaluc\u00eda', 'M\u00e1laga': 'Andaluc\u00eda', 'C\u00e1diz': 'Andaluc\u00eda',
  'C\u00f3rdoba': 'Andaluc\u00eda', 'Granada': 'Andaluc\u00eda', 'Huelva': 'Andaluc\u00eda',
  'Ja\u00e9n': 'Andaluc\u00eda', 'Almer\u00eda': 'Andaluc\u00eda', 'Zaragoza': 'Arag\u00f3n',
  'Huesca': 'Arag\u00f3n', 'Teruel': 'Arag\u00f3n', 'Illes Balears': 'Illes Balears',
  'Las Palmas': 'Canarias', 'Santa Cruz de Tenerife': 'Canarias',
  'A Coru\u00f1a': 'Galicia', 'Lugo': 'Galicia', 'Ourense': 'Galicia', 'Pontevedra': 'Galicia',
  'Murcia': 'Regi\u00f3n de Murcia', 'Valladolid': 'Castilla y Le\u00f3n',
  'Burgos': 'Castilla y Le\u00f3n', 'Le\u00f3n': 'Castilla y Le\u00f3n', 'Salamanca': 'Castilla y Le\u00f3n',
  '\u00c1vila': 'Castilla y Le\u00f3n', 'Segovia': 'Castilla y Le\u00f3n', 'Soria': 'Castilla y Le\u00f3n',
  'Palencia': 'Castilla y Le\u00f3n', 'Zamora': 'Castilla y Le\u00f3n',
  'Albacete': 'Castilla-La Mancha', 'Ciudad Real': 'Castilla-La Mancha',
  'Cuenca': 'Castilla-La Mancha', 'Guadalajara': 'Castilla-La Mancha', 'Toledo': 'Castilla-La Mancha',
  'Badajoz': 'Extremadura', 'C\u00e1ceres': 'Extremadura', 'Asturias': 'Principado de Asturias',
  'Cantabria': 'Cantabria', 'La Rioja': 'La Rioja', 'Navarra': 'Comunidad Foral de Navarra',
  'Ceuta': 'Ceuta', 'Melilla': 'Melilla'
};

const advisors = [
  // Madrid (6)
  {
    id: 'ADV-001', name: 'Garc\u00eda & Asociados Consultores Fiscales', city: 'Madrid',
    province: 'Madrid', ccaa: 'Comunidad de Madrid',
    address: 'C/ Serrano 45, 2\u00ba, 28001 Madrid', phone: '+34 915 123 456',
    email: 'info@garciaasociados.es', website: 'https://garciaasociados.es',
    specialties: ['IRPF', 'sociedades', 'grandes empresas', 'no residentes'],
    rating: 4.8, reviews: 312, priceRange: '\u20ac\u20ac\u20ac', yearsExperience: 28,
    languages: ['es', 'en', 'fr'], certifications: ['REAF', 'AEDAF'],
    services: ['planificaci\u00f3n fiscal', 'reestructuraciones', 'fiscalidad internacional']
  },
  {
    id: 'ADV-002', name: 'Fiscal Madrid Centro SLP', city: 'Madrid',
    province: 'Madrid', ccaa: 'Comunidad de Madrid',
    address: 'C/ Gran V\u00eda 22, 5\u00ba, 28013 Madrid', phone: '+34 914 567 890',
    email: 'contacto@fiscalmadridcentro.es', website: 'https://fiscalmadridcentro.es',
    specialties: ['aut\u00f3nomos', 'pymes', 'IRPF', 'IVA internacional'],
    rating: 4.5, reviews: 189, priceRange: '\u20ac\u20ac', yearsExperience: 15,
    languages: ['es', 'en'], certifications: ['AEDAF'],
    services: ['contabilidad', 'declaraciones trimestrales', 'IVA']
  },
  {
    id: 'ADV-003', name: 'Tributax Advisors', city: 'Madrid',
    province: 'Madrid', ccaa: 'Comunidad de Madrid',
    address: 'Paseo de la Castellana 130, 28046 Madrid', phone: '+34 917 890 123',
    email: 'hola@tributax.es', website: 'https://tributax.es',
    specialties: ['grandes empresas', 'comercio exterior', 'SII', 'sociedades'],
    rating: 4.9, reviews: 478, priceRange: '\u20ac\u20ac\u20ac', yearsExperience: 35,
    languages: ['es', 'en', 'de', 'pt'], certifications: ['REAF', 'AEDAF', 'IFA'],
    services: ['precios de transferencia', 'due diligence fiscal', 'litigios tributarios']
  },
  {
    id: 'ADV-004', name: 'Asesor\u00eda Pyme Plus', city: 'Madrid',
    province: 'Madrid', ccaa: 'Comunidad de Madrid',
    address: 'C/ Alca\u00e1 78, 1\u00ba, 28009 Madrid', phone: '+34 913 456 789',
    email: 'info@pymeplus.es', website: 'https://pymeplus.es',
    specialties: ['aut\u00f3nomos', 'pymes', 'IRPF', 'herencias'],
    rating: 4.3, reviews: 97, priceRange: '\u20ac', yearsExperience: 8,
    languages: ['es'], certifications: ['AEDAF'],
    services: ['alta aut\u00f3nomos', 'renta', 'sucesiones', 'contabilidad b\u00e1sica']
  },
  {
    id: 'ADV-005', name: 'Deloitte Abogados y Asesores Tributarios', city: 'Madrid',
    province: 'Madrid', ccaa: 'Comunidad de Madrid',
    address: 'Plaza Pablo Ruiz Picasso 1, 28020 Madrid', phone: '+34 914 432 000',
    email: 'tax@deloitte-asesores.es', website: 'https://deloitte-asesores.es',
    specialties: ['grandes empresas', 'no residentes', 'comercio exterior', 'CNMC'],
    rating: 4.7, reviews: 562, priceRange: '\u20ac\u20ac\u20ac', yearsExperience: 40,
    languages: ['es', 'en', 'fr', 'de', 'zh'], certifications: ['REAF', 'AEDAF', 'IFA', 'CIOT'],
    services: ['fiscalidad internacional', 'M&A', 'compliance tributario', 'CNMC']
  },
  {
    id: 'ADV-006', name: 'N\u00f3minas y Fiscal Express', city: 'Madrid',
    province: 'Madrid', ccaa: 'Comunidad de Madrid',
    address: 'C/ Bravo Murillo 150, 28020 Madrid', phone: '+34 916 789 012',
    email: 'express@nominasfiscal.es', website: 'https://nominasfiscal.es',
    specialties: ['aut\u00f3nomos', 'pymes', 'IRPF'],
    rating: 4.1, reviews: 64, priceRange: '\u20ac', yearsExperience: 5,
    languages: ['es', 'en'], certifications: [],
    services: ['n\u00f3minas', 'renta', 'altas y bajas', 'IVA trimestral']
  },
  // Barcelona (4)
  {
    id: 'ADV-007', name: 'Assessoria Fiscal Rovira i Torres', city: 'Barcelona',
    province: 'Barcelona', ccaa: 'Catalu\u00f1a',
    address: 'Passeig de Gr\u00e0cia 55, 3r, 08007 Barcelona', phone: '+34 932 123 456',
    email: 'info@roviratorres.cat', website: 'https://roviratorres.cat',
    specialties: ['pymes', 'sociedades', 'IVA internacional', 'comercio exterior'],
    rating: 4.6, reviews: 234, priceRange: '\u20ac\u20ac', yearsExperience: 22,
    languages: ['ca', 'es', 'en', 'fr'], certifications: ['REAF', 'AEDAF'],
    services: ['contabilidad', 'fiscalidad internacional', 'aduanas']
  },
  {
    id: 'ADV-008', name: 'Busquets Assessors SL', city: 'Barcelona',
    province: 'Barcelona', ccaa: 'Catalu\u00f1a',
    address: 'Avinguda Diagonal 440, 08037 Barcelona', phone: '+34 934 567 890',
    email: 'assessors@busquets.cat', website: 'https://busquetsassessors.cat',
    specialties: ['aut\u00f3nomos', 'herencias', 'IRPF', 'pymes'],
    rating: 4.4, reviews: 156, priceRange: '\u20ac\u20ac', yearsExperience: 18,
    languages: ['ca', 'es', 'en'], certifications: ['AEDAF'],
    services: ['renta', 'sucesiones', 'donaciones', 'patrimonio']
  },
  {
    id: 'ADV-009', name: 'Grup Fiscal Catalunya', city: 'Barcelona',
    province: 'Barcelona', ccaa: 'Catalu\u00f1a',
    address: 'C/ Balmes 200, 1r, 08006 Barcelona', phone: '+34 933 890 123',
    email: 'info@grupfiscalcat.es', website: 'https://grupfiscalcat.es',
    specialties: ['grandes empresas', 'SII', 'sociedades', 'no residentes'],
    rating: 4.7, reviews: 289, priceRange: '\u20ac\u20ac\u20ac', yearsExperience: 30,
    languages: ['ca', 'es', 'en', 'de'], certifications: ['REAF', 'AEDAF', 'IFA'],
    services: ['consolidaci\u00f3n fiscal', 'SII', 'operaciones vinculadas']
  },
  {
    id: 'ADV-010', name: 'Aut\u00f2noms BCN Gestoria', city: 'Barcelona',
    province: 'Barcelona', ccaa: 'Catalu\u00f1a',
    address: 'C/ Arag\u00f3 315, baixos, 08009 Barcelona', phone: '+34 931 234 567',
    email: 'hola@autonomsbcn.cat', website: 'https://autonomsbcn.cat',
    specialties: ['aut\u00f3nomos', 'pymes', 'IRPF'],
    rating: 4.2, reviews: 87, priceRange: '\u20ac', yearsExperience: 7,
    languages: ['ca', 'es'], certifications: [],
    services: ['alta aut\u00f3nomos', 'facturaci\u00f3n', 'renta', 'IVA']
  },
  // Valencia (3)
  {
    id: 'ADV-011', name: 'Asesores Tributarios Levante', city: 'Valencia',
    province: 'Valencia', ccaa: 'Comunitat Valenciana',
    address: 'C/ Col\u00f3n 60, 4\u00ba, 46004 Valencia', phone: '+34 963 123 456',
    email: 'info@tributarioslevante.es', website: 'https://tributarioslevante.es',
    specialties: ['pymes', 'IRPF', 'herencias', 'IVA internacional'],
    rating: 4.5, reviews: 178, priceRange: '\u20ac\u20ac', yearsExperience: 20,
    languages: ['es', 'ca', 'en'], certifications: ['AEDAF'],
    services: ['contabilidad', 'renta', 'sucesiones', 'comercio exterior']
  },
  {
    id: 'ADV-012', name: 'Gestoria Mart\u00ednez Alonso', city: 'Valencia',
    province: 'Valencia', ccaa: 'Comunitat Valenciana',
    address: 'Avda. del Puerto 88, 46023 Valencia', phone: '+34 962 456 789',
    email: 'gestion@martinezalonso.es', website: 'https://martinezalonso.es',
    specialties: ['aut\u00f3nomos', 'pymes', 'IRPF'],
    rating: 4.0, reviews: 53, priceRange: '\u20ac', yearsExperience: 10,
    languages: ['es', 'ca'], certifications: [],
    services: ['n\u00f3minas', 'renta', 'contabilidad', 'altas']
  },
  {
    id: 'ADV-013', name: 'Fiscal Global Valencia SLP', city: 'Valencia',
    province: 'Valencia', ccaa: 'Comunitat Valenciana',
    address: 'C/ Sorni 12, 2\u00ba, 46004 Valencia', phone: '+34 961 890 234',
    email: 'contacto@fiscalglobalvlc.es', website: 'https://fiscalglobalvlc.es',
    specialties: ['no residentes', 'comercio exterior', 'sociedades', 'IVA internacional'],
    rating: 4.6, reviews: 145, priceRange: '\u20ac\u20ac\u20ac', yearsExperience: 25,
    languages: ['es', 'en', 'fr', 'de'], certifications: ['REAF', 'IFA'],
    services: ['fiscalidad internacional', 'aduanas', 'IVA intracomunitario']
  },
  // Sevilla (2)
  {
    id: 'ADV-014', name: 'Asesor\u00eda Fiscal Bética', city: 'Sevilla',
    province: 'Sevilla', ccaa: 'Andaluc\u00eda',
    address: 'Avda. de la Constituci\u00f3n 20, 3\u00ba, 41001 Sevilla', phone: '+34 954 123 456',
    email: 'info@fiscalbetica.es', website: 'https://fiscalbetica.es',
    specialties: ['aut\u00f3nomos', 'pymes', 'herencias', 'IRPF'],
    rating: 4.4, reviews: 132, priceRange: '\u20ac\u20ac', yearsExperience: 16,
    languages: ['es', 'en'], certifications: ['AEDAF'],
    services: ['renta', 'sucesiones', 'contabilidad', 'asesor\u00eda laboral']
  },
  {
    id: 'ADV-015', name: 'Triana Consultores Tributarios', city: 'Sevilla',
    province: 'Sevilla', ccaa: 'Andaluc\u00eda',
    address: 'C/ Betis 34, 41010 Sevilla', phone: '+34 955 678 901',
    email: 'hola@trianaconsultores.es', website: 'https://trianaconsultores.es',
    specialties: ['pymes', 'sociedades', 'SII', 'grandes empresas'],
    rating: 4.3, reviews: 98, priceRange: '\u20ac\u20ac', yearsExperience: 12,
    languages: ['es', 'en', 'pt'], certifications: ['AEDAF'],
    services: ['SII', 'impuesto de sociedades', 'auditor\u00eda fiscal']
  },
  // Bilbao (2)
  {
    id: 'ADV-016', name: 'Zerga Aholkulariak SL', city: 'Bilbao',
    province: 'Bizkaia', ccaa: 'Pa\u00eds Vasco',
    address: 'Gran V\u00eda de Don Diego L\u00f3pez de Haro 40, 48011 Bilbao', phone: '+34 944 123 456',
    email: 'info@zergaaholkulariak.eus', website: 'https://zergaaholkulariak.eus',
    specialties: ['aut\u00f3nomos', 'pymes', 'TicketBAI', 'IRPF'],
    rating: 4.5, reviews: 167, priceRange: '\u20ac\u20ac', yearsExperience: 19,
    languages: ['eu', 'es', 'en'], certifications: ['AEDAF'],
    services: ['TicketBAI', 'hacienda foral', 'renta', 'contabilidad']
  },
  {
    id: 'ADV-017', name: 'Bizkaia Tax & Legal', city: 'Bilbao',
    province: 'Bizkaia', ccaa: 'Pa\u00eds Vasco',
    address: 'Alameda de Mazarredo 15, 48001 Bilbao', phone: '+34 946 789 012',
    email: 'contacto@bizkaiatax.es', website: 'https://bizkaiatax.es',
    specialties: ['grandes empresas', 'no residentes', 'TicketBAI', 'sociedades'],
    rating: 4.7, reviews: 203, priceRange: '\u20ac\u20ac\u20ac', yearsExperience: 27,
    languages: ['eu', 'es', 'en', 'fr'], certifications: ['REAF', 'AEDAF', 'IFA'],
    services: ['normativa foral', 'fiscalidad internacional', 'TicketBAI', 'compliance']
  },
  // Zaragoza (1)
  {
    id: 'ADV-018', name: 'Asesor\u00eda Fiscal Ebro', city: 'Zaragoza',
    province: 'Zaragoza', ccaa: 'Arag\u00f3n',
    address: 'Paseo Independencia 22, 2\u00ba, 50001 Zaragoza', phone: '+34 976 123 456',
    email: 'info@fiscalebro.es', website: 'https://fiscalebro.es',
    specialties: ['aut\u00f3nomos', 'pymes', 'IRPF', 'herencias'],
    rating: 4.3, reviews: 89, priceRange: '\u20ac', yearsExperience: 14,
    languages: ['es', 'en'], certifications: ['AEDAF'],
    services: ['renta', 'contabilidad', 'sucesiones', 'asesor\u00eda laboral']
  },
  // M\u00e1laga (2)
  {
    id: 'ADV-019', name: 'Costa del Sol Asesores Fiscales', city: 'M\u00e1laga',
    province: 'M\u00e1laga', ccaa: 'Andaluc\u00eda',
    address: 'C/ Marqués de Larios 9, 3\u00ba, 29005 M\u00e1laga', phone: '+34 952 123 456',
    email: 'info@costadelsolfiscal.es', website: 'https://costadelsolfiscal.es',
    specialties: ['no residentes', 'IRPF', 'herencias', 'IVA internacional'],
    rating: 4.6, reviews: 245, priceRange: '\u20ac\u20ac', yearsExperience: 21,
    languages: ['es', 'en', 'de', 'sv', 'fi'], certifications: ['REAF', 'AEDAF'],
    services: ['fiscalidad no residentes', 'golden visa', 'sucesiones internacionales']
  },
  {
    id: 'ADV-020', name: 'Gestiones M\u00e1laga Sur', city: 'M\u00e1laga',
    province: 'M\u00e1laga', ccaa: 'Andaluc\u00eda',
    address: 'Avda. de Andaluc\u00eda 15, 29002 M\u00e1laga', phone: '+34 951 456 789',
    email: 'hola@gestionesmalaga.es', website: 'https://gestionesmalaga.es',
    specialties: ['aut\u00f3nomos', 'pymes', 'IRPF'],
    rating: 4.1, reviews: 72, priceRange: '\u20ac', yearsExperience: 9,
    languages: ['es', 'en'], certifications: [],
    services: ['alta aut\u00f3nomos', 'renta', 'contabilidad', 'n\u00f3minas']
  },
  // A Coru\u00f1a (1)
  {
    id: 'ADV-021', name: 'Asesoría Fiscal Atl\u00e1ntica', city: 'A Coru\u00f1a',
    province: 'A Coru\u00f1a', ccaa: 'Galicia',
    address: 'R\u00faa Real 50, 2\u00ba, 15003 A Coru\u00f1a', phone: '+34 981 123 456',
    email: 'info@fiscalatlantica.gal', website: 'https://fiscalatlantica.gal',
    specialties: ['pymes', 'aut\u00f3nomos', 'herencias', 'comercio exterior'],
    rating: 4.4, reviews: 108, priceRange: '\u20ac\u20ac', yearsExperience: 17,
    languages: ['gl', 'es', 'en', 'pt'], certifications: ['AEDAF'],
    services: ['contabilidad', 'comercio exterior', 'sucesiones', 'renta']
  },
  // Palma (1)
  {
    id: 'ADV-022', name: 'Illa Fiscal Assessors', city: 'Palma',
    province: 'Illes Balears', ccaa: 'Illes Balears',
    address: 'Avinguda Jaume III 18, 07012 Palma', phone: '+34 971 123 456',
    email: 'info@illafiscal.es', website: 'https://illafiscal.es',
    specialties: ['no residentes', 'IRPF', 'herencias', 'IVA internacional'],
    rating: 4.5, reviews: 134, priceRange: '\u20ac\u20ac', yearsExperience: 16,
    languages: ['ca', 'es', 'en', 'de'], certifications: ['AEDAF'],
    services: ['fiscalidad no residentes', 'patrimonio', 'sucesiones', 'IVA']
  },
  // Las Palmas (1)
  {
    id: 'ADV-023', name: 'Canarias Tax Consulting', city: 'Las Palmas de Gran Canaria',
    province: 'Las Palmas', ccaa: 'Canarias',
    address: 'C/ Triana 80, 2\u00ba, 35002 Las Palmas de Gran Canaria', phone: '+34 928 123 456',
    email: 'info@canariastax.es', website: 'https://canariastax.es',
    specialties: ['comercio exterior', 'no residentes', 'pymes', 'IVA internacional'],
    rating: 4.3, reviews: 91, priceRange: '\u20ac\u20ac', yearsExperience: 13,
    languages: ['es', 'en', 'de'], certifications: ['AEDAF'],
    services: ['IGIC', 'ZEC', 'REF canario', 'fiscalidad internacional']
  },
  // Murcia (1)
  {
    id: 'ADV-024', name: 'Asesor\u00eda Fiscal Mediterr\u00e1neo', city: 'Murcia',
    province: 'Murcia', ccaa: 'Regi\u00f3n de Murcia',
    address: 'Gran V\u00eda Escultor Salzillo 20, 30004 Murcia', phone: '+34 968 123 456',
    email: 'info@fiscalmediterraneo.es', website: 'https://fiscalmediterraneo.es',
    specialties: ['aut\u00f3nomos', 'pymes', 'IRPF', 'herencias'],
    rating: 4.2, reviews: 76, priceRange: '\u20ac', yearsExperience: 11,
    languages: ['es', 'en'], certifications: ['AEDAF'],
    services: ['renta', 'contabilidad', 'sucesiones', 'altas aut\u00f3nomos']
  },
  // Valladolid (1)
  {
    id: 'ADV-025', name: 'Castilla Fiscal Asesores', city: 'Valladolid',
    province: 'Valladolid', ccaa: 'Castilla y Le\u00f3n',
    address: 'C/ Santiago 15, 1\u00ba, 47001 Valladolid', phone: '+34 983 123 456',
    email: 'info@castellafiscal.es', website: 'https://castellafiscal.es',
    specialties: ['aut\u00f3nomos', 'pymes', 'IRPF', 'sociedades'],
    rating: 4.3, reviews: 82, priceRange: '\u20ac', yearsExperience: 12,
    languages: ['es'], certifications: ['AEDAF'],
    services: ['renta', 'contabilidad', 'impuesto de sociedades', 'asesor\u00eda laboral']
  }
];

const PRICE_ORDER = { '\u20ac': 1, '\u20ac\u20ac': 2, '\u20ac\u20ac\u20ac': 3 };

function postalToProvince(postalCode) {
  const prefix = String(postalCode).padStart(5, '0').slice(0, 2);
  return POSTAL_TO_PROVINCE[prefix] || null;
}

export function searchAdvisors({ city, province, ccaa, specialty, maxPrice, minRating, language } = {}) {
  let results = [...advisors];
  if (city) results = results.filter(a => a.city.toLowerCase() === city.toLowerCase());
  if (province) results = results.filter(a => a.province.toLowerCase() === province.toLowerCase());
  if (ccaa) results = results.filter(a => a.ccaa.toLowerCase() === ccaa.toLowerCase());
  if (specialty) results = results.filter(a =>
    a.specialties.some(s => s.toLowerCase().includes(specialty.toLowerCase()))
  );
  if (maxPrice) results = results.filter(a => PRICE_ORDER[a.priceRange] <= PRICE_ORDER[maxPrice]);
  if (minRating) results = results.filter(a => a.rating >= minRating);
  if (language) results = results.filter(a =>
    a.languages.some(l => l.toLowerCase() === language.toLowerCase())
  );
  return results.sort((a, b) => b.rating - a.rating || b.reviews - a.reviews);
}

export function getAdvisorById(id) {
  return advisors.find(a => a.id === id) || null;
}

export function getAdvisorsByZone(postalCode) {
  const province = postalToProvince(postalCode);
  if (!province) return [];
  return searchAdvisors({ province });
}

export function compareAdvisors(id1, id2) {
  const a1 = getAdvisorById(id1);
  const a2 = getAdvisorById(id2);
  if (!a1 || !a2) return null;
  const sharedSpecialties = a1.specialties.filter(s => a2.specialties.includes(s));
  const sharedLanguages = a1.languages.filter(l => a2.languages.includes(l));
  return {
    advisor1: a1,
    advisor2: a2,
    comparison: {
      ratingDiff: +(a1.rating - a2.rating).toFixed(1),
      reviewsDiff: a1.reviews - a2.reviews,
      experienceDiff: a1.yearsExperience - a2.yearsExperience,
      priceDiff: PRICE_ORDER[a1.priceRange] - PRICE_ORDER[a2.priceRange],
      sharedSpecialties,
      sharedLanguages,
      uniqueSpecialties1: a1.specialties.filter(s => !a2.specialties.includes(s)),
      uniqueSpecialties2: a2.specialties.filter(s => !a1.specialties.includes(s)),
      recommendation: a1.rating > a2.rating ? a1.name
        : a2.rating > a1.rating ? a2.name
        : a1.reviews > a2.reviews ? a1.name : a2.name
    }
  };
}

export function getTopRated(ccaa, limit = 5) {
  const filtered = ccaa
    ? advisors.filter(a => a.ccaa.toLowerCase() === ccaa.toLowerCase())
    : advisors;
  return [...filtered]
    .sort((a, b) => b.rating - a.rating || b.reviews - a.reviews)
    .slice(0, limit);
}

export function getNearestAdvisors(postalCode, limit = 5) {
  const province = postalToProvince(postalCode);
  if (!province) return [];
  const ccaa = PROVINCE_TO_CCAA[province];
  // First try same province, then same CCAA
  const sameProvince = advisors.filter(a => a.province === province);
  if (sameProvince.length >= limit) {
    return sameProvince.sort((a, b) => b.rating - a.rating).slice(0, limit);
  }
  const sameCcaa = advisors.filter(a => a.ccaa === ccaa && a.province !== province);
  return [...sameProvince, ...sameCcaa]
    .sort((a, b) => b.rating - a.rating)
    .slice(0, limit);
}

export function getAdvisorStats() {
  const byCcaa = {};
  const specialtiesCount = {};
  let totalRating = 0;
  for (const a of advisors) {
    byCcaa[a.ccaa] = (byCcaa[a.ccaa] || 0) + 1;
    totalRating += a.rating;
    for (const s of a.specialties) {
      specialtiesCount[s] = (specialtiesCount[s] || 0) + 1;
    }
  }
  return {
    total: advisors.length,
    byCcaa,
    avgRating: +(totalRating / advisors.length).toFixed(2),
    specialtiesDistribution: Object.entries(specialtiesCount)
      .sort((a, b) => b[1] - a[1])
      .reduce((obj, [k, v]) => { obj[k] = v; return obj; }, {})
  };
}
